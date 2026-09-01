import {
  createApplication,
  db,
  listApplications,
  loadRun,
} from "@/lib/db";
import { peekOwnerId, getOwnerId } from "@/lib/owner";
import { followUpDateFor, isoDate } from "@/lib/applications";
import { parseJobPage, sourceFromUrl } from "@/lib/job-page";

export const maxDuration = 30;

/** Everything this browser has logged against its current run. */
export async function GET() {
  if (!db()) return Response.json({ applications: [], persisted: false });

  const ownerId = await peekOwnerId();
  if (!ownerId) return Response.json({ applications: [], persisted: true });

  try {
    const run = await loadRun(ownerId);
    if (!run) return Response.json({ applications: [], persisted: true });
    return Response.json({
      applications: await listApplications(ownerId, run.id),
      persisted: true,
    });
  } catch (err) {
    console.error("applications list failed", err);
    return Response.json({ applications: [], persisted: false });
  }
}

type Body = {
  company?: string;
  roleTitle?: string;
  url?: string | null;
  source?: string | null;
  appliedOn?: string;
};

export async function POST(req: Request) {
  if (!db()) {
    return Response.json(
      { error: "Nowhere to save this yet. Try again shortly." },
      { status: 503 },
    );
  }

  const body = (await req.json()) as Body;
  const company = body.company?.trim();
  const roleTitle = body.roleTitle?.trim();
  if (!company || !roleTitle) {
    return Response.json(
      { error: "We need the company and the role, at least." },
      { status: 400 },
    );
  }

  // Default to today, but never accept a date in the future: the follow-up
  // maths would silently produce a nudge that never fires.
  const today = isoDate(new Date());
  let appliedOn = body.appliedOn?.trim() || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appliedOn) || appliedOn > today) appliedOn = today;

  try {
    const ownerId = await getOwnerId();
    const run = await loadRun(ownerId);
    if (!run) {
      return Response.json(
        { error: "Start a plan first, then log what you apply for." },
        { status: 409 },
      );
    }

    const application = await createApplication(ownerId, run.id, {
      company,
      roleTitle,
      url: body.url?.trim() || null,
      source: body.source?.trim() || (body.url ? sourceFromUrl(body.url) : null),
      appliedOn,
      followUpDue: followUpDateFor(appliedOn),
    });

    if (!application) {
      return Response.json({ error: "Couldn't save that." }, { status: 502 });
    }
    return Response.json({ application });
  } catch (err) {
    console.error("application create failed", err);
    return Response.json({ error: "Couldn't save that. Try again?" }, { status: 502 });
  }
}

/**
 * Read a job advert URL so they type as little as possible. Best effort by
 * design: LinkedIn and Indeed block server-side fetches, and the form behind
 * this always accepts manual entry.
 */
export async function PUT(req: Request) {
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) return Response.json({ error: "No link given." }, { status: 400 });

  try {
    return Response.json({ parsed: await parseJobPage(url.trim()) });
  } catch (err) {
    console.error("job page parse failed", err);
    return Response.json({
      parsed: {
        company: null,
        roleTitle: null,
        location: null,
        closesOn: null,
        source: sourceFromUrl(url),
        via: "url-only",
      },
    });
  }
}
