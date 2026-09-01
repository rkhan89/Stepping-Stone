/**
 * Best-effort reading of a job advert URL.
 *
 * Most job pages carry a JSON-LD JobPosting block, because that is what Google
 * for Jobs requires to index them. So the reliable path is structured data, not
 * an LLM and not scraping the layout: it is deterministic, free, and works when
 * the model is unavailable. Open Graph tags and <title> are the fallbacks.
 *
 * This is allowed to fail. LinkedIn and Indeed block server-side fetches, and
 * the form behind this always accepts typing it in by hand.
 */

export type ParsedJob = {
  company: string | null;
  roleTitle: string | null;
  location: string | null;
  closesOn: string | null;
  source: string;
  /** How we got it, so the UI can say whether to trust it. */
  via: "structured-data" | "open-graph" | "title-tag" | "url-only";
};

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 2_000_000;

/** Hosts we must never fetch: this endpoint takes a URL from the public. */
function isForbiddenHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  // IPv4 literals in private or link-local ranges.
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // cloud metadata
  }
  // IPv6 unique-local and link-local.
  if (/^f[cd]/.test(h) || /^fe80:/.test(h)) return true;
  return false;
}

export function sourceFromUrl(raw: string): string {
  try {
    const h = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    if (h.includes("linkedin")) return "linkedin";
    if (h.includes("indeed")) return "indeed";
    if (h.includes("bayt") || h.includes("naukrigulf") || h.includes("gulftalent"))
      return "job board";
    if (h.includes("greenhouse") || h.includes("lever.co") || h.includes("ashbyhq"))
      return "company";
    if (h.includes("glassdoor") || h.includes("reed") || h.includes("totaljobs"))
      return "job board";
    return "company";
  } catch {
    return "other";
  }
}

/** Company guessed from the domain, for when the page tells us nothing. */
function companyFromUrl(raw: string): string | null {
  try {
    const h = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    // An IP address or a host we refused to fetch is not a company name.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":")) return null;
    if (isForbiddenHost(h) || !h.includes(".")) return null;
    const generic = /linkedin|indeed|glassdoor|bayt|naukrigulf|gulftalent|reed|totaljobs|greenhouse|lever|ashbyhq|workable|smartrecruiters/;
    if (generic.test(h)) return null;
    const label = h.split(".")[0];
    if (!label || label.length < 2) return null;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function firstString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return decodeEntities(v.trim());
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = firstString(item);
      if (s) return s;
    }
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const key of ["name", "title", "@value"]) {
      const s = firstString(o[key]);
      if (s) return s;
    }
  }
  return null;
}

/** Walks nested @graph structures looking for a JobPosting node. */
function findJobPosting(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || !node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const o = node as Record<string, unknown>;
  const type = o["@type"];
  const isJob = Array.isArray(type)
    ? type.some((t) => String(t).toLowerCase() === "jobposting")
    : String(type ?? "").toLowerCase() === "jobposting";
  if (isJob) return o;
  for (const key of ["@graph", "mainEntity", "itemListElement"]) {
    const found = findJobPosting(o[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function locationOf(posting: Record<string, unknown>): string | null {
  const loc = posting.jobLocation;
  const addr = (Array.isArray(loc) ? loc[0] : loc) as Record<string, unknown> | undefined;
  const address = addr?.address as Record<string, unknown> | undefined;
  if (!address) return firstString(loc);
  const city = firstString(address.addressLocality);
  const region = firstString(address.addressRegion);
  const country = firstString(address.addressCountry);
  return [city, region ?? country].filter(Boolean).join(", ") || null;
}

export async function parseJobPage(raw: string): Promise<ParsedJob> {
  const fallback: ParsedJob = {
    company: companyFromUrl(raw),
    roleTitle: null,
    location: null,
    closesOn: null,
    source: sourceFromUrl(raw),
    via: "url-only",
  };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fallback;
  }
  if (!["http:", "https:"].includes(url.protocol)) return fallback;
  if (isForbiddenHost(url.hostname)) return fallback;

  let html: string;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Plenty of boards serve a stub to anything that looks automated.
        "user-agent":
          "Mozilla/5.0 (compatible; SteppingStone/1.0; +https://stepping-stone-woad.vercel.app)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return fallback;
    const buf = await res.arrayBuffer();
    html = new TextDecoder().decode(buf.slice(0, MAX_BYTES));
  } catch {
    // Blocked, timed out, or unreachable. The form still works.
    return fallback;
  }

  // 1. JSON-LD JobPosting: the only source that is actually structured.
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const posting = findJobPosting(JSON.parse(m[1].trim()));
      if (!posting) continue;
      const roleTitle = firstString(posting.title);
      const company = firstString(posting.hiringOrganization);
      if (!roleTitle && !company) continue;
      const validThrough = firstString(posting.validThrough);
      return {
        company: company ?? fallback.company,
        roleTitle,
        location: locationOf(posting),
        closesOn: validThrough ? validThrough.slice(0, 10) : null,
        source: fallback.source,
        via: "structured-data",
      };
    } catch {
      // Malformed block. Try the next one.
    }
  }

  // 2. Open Graph. Usually "Role at Company" or "Role - Company".
  const og = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  )?.[1];
  const ogSite = html.match(
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
  )?.[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const headline = og ?? title;
  if (headline) {
    const clean = decodeEntities(headline).replace(/\s+/g, " ");
    const split = clean.match(/^(.*?)\s+(?:\bat\b|[-|–—])\s+(.*)$/);
    return {
      company: ogSite ? decodeEntities(ogSite) : (split?.[2]?.trim() ?? fallback.company),
      roleTitle: (split?.[1] ?? clean).trim().slice(0, 120) || null,
      location: null,
      closesOn: null,
      source: fallback.source,
      via: og ? "open-graph" : "title-tag",
    };
  }

  return fallback;
}
