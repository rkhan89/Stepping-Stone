import { generateObject } from "ai";
import { MODEL, VOICE, CV_CRAFT, missingKeyResponse } from "@/lib/model";
import { cvSchema, type Cv } from "@/lib/schemas";
import { readCvUpload, UploadError, type UploadedCv } from "@/lib/cv-upload";

export const maxDuration = 180;

type Body = {
  input?: string;
  answers?: Record<string, { question: string; answer: string }>;
  freeText?: Record<string, string>;
  notes?: string;
  /** 'rewrite' from an existing CV, 'build' from interview answers. */
  mode?: "rewrite" | "build";
  /** The pasted CV, when they typed rather than uploaded. */
  existingCv?: string;
  /** Interview answers, for build. */
  material?: { question: string; answer: string }[];
};

/** Bracketed placeholders the model leaves in place of facts it wasn't given. */
const PLACEHOLDER = /\[[^\]]{3,}\]/g;

/**
 * The model is told to list every placeholder it leaves under gaps, and it
 * mostly does, but not reliably. gaps drives the "Go and find these" panel, so
 * an empty one means a CV goes out with [what changed?] still in it and nothing
 * telling the person to fix it. Reconcile the two here rather than trusting it.
 */
function backfillGaps(cv: Cv): Cv {
  const found: { text: string; where: string }[] = [];
  const scan = (text: string, where: string) => {
    for (const m of text.matchAll(PLACEHOLDER)) found.push({ text: m[0], where });
  };

  scan(cv.profile, "your profile");
  scan(cv.contactLine, "the contact line");
  cv.roles.forEach((r) => {
    scan(`${r.title} ${r.company} ${r.location} ${r.dates}`, `the ${r.title} heading`);
    r.bullets.forEach((b) => scan(b, `${r.title} at ${r.company}`));
  });
  cv.skills.forEach((s) => scan(s.items.join(" "), `your ${s.category} skills`));
  cv.education.forEach((e) => scan(e, "education"));

  const covered = cv.gaps.join(" ").toLowerCase();
  const missing = found
    .filter((f) => !covered.includes(f.text.toLowerCase().slice(1, -1).slice(0, 24)))
    .map((f) => `Fill in ${f.text} in ${f.where}.`);

  // Same placeholder in two bullets only needs saying once.
  return { ...cv, gaps: [...cv.gaps, ...Array.from(new Set(missing))] };
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return missingKeyResponse();

  // Uploads arrive as multipart; the paste and interview paths stay JSON.
  let body: Body;
  let upload: UploadedCv | null = null;

  try {
    if (req.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await req.formData();
      body = JSON.parse(String(form.get("payload") ?? "{}")) as Body;
      const file = form.get("file");
      if (file instanceof File) upload = await readCvUpload(file);
    } else {
      body = (await req.json()) as Body;
    }
  } catch (err) {
    if (err instanceof UploadError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return Response.json({ error: "Couldn't read that upload." }, { status: 400 });
  }

  const { input, answers = {}, notes, mode = "build", existingCv, material = [] } = body;

  // A PDF upload counts as material even though there's no text to check.
  const uploadedText = upload?.kind === "text" ? upload.text : "";
  const cvText = uploadedText || existingCv || "";
  const haveMaterial =
    mode === "rewrite"
      ? !!cvText.trim() || upload?.kind === "pdf"
      : material.some((m) => m.answer?.trim());

  if (!input?.trim() || !haveMaterial) {
    return Response.json({ error: "Nothing to work from yet." }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: cvSchema,
      system: `${VOICE}

${CV_CRAFT}

${
  mode === "rewrite"
    ? `They have given you their existing CV. Rewrite it towards the field they're
moving into. Keep every real fact, employers, titles, dates, education, exactly
as given. Change how the work is described, not what the work was. If their CV
is thin on evidence, keep the bullet and mark what's missing in gaps rather than
inventing a number to fill it.`
    : `They have no CV. Build one from the answers they gave. Where an answer is
vague, write the strongest honest version of it and add the specific thing they
need to go and find to gaps, do not paper over it.`
}

gaps is the honesty channel and it matters more than the polish. Every bracketed
placeholder you leave must appear there, phrased as an instruction: "Find the
number of accounts you handled, check an old performance review." If you had
enough to write a genuinely complete CV, gaps can be short, but it is almost
never empty and an empty one usually means you invented something.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text" as const,
              text: [
                `They want to start:\n${input}`,
                `\nWhat they told us:`,
                ...Object.entries(answers).map(
                  ([, v]) => `- ${v.question} → ${v.answer}`,
                ),
                notes?.trim() ? `- Plan around: ${notes}` : ``,
                mode === "rewrite"
                  ? upload?.kind === "pdf"
                    ? `\nTheir existing CV is the attached PDF. Read it, including
anything set in columns or side panels, and treat every name, title and date in
it as fact.`
                    : `\nTheir existing CV, verbatim:\n\n${cvText}`
                  : `\nWhat they told us about their history:\n${material
                      .filter((m) => m.answer?.trim())
                      .map((m) => `- ${m.question}\n  ${m.answer}`)
                      .join("\n")}`,
              ]
                .filter(Boolean)
                .join("\n"),
            },
            // Claude reads the PDF itself, so multi-column layouts survive.
            ...(upload?.kind === "pdf"
              ? [
                  {
                    type: "file" as const,
                    data: upload.bytes,
                    mediaType: "application/pdf",
                  },
                ]
              : []),
          ],
        },
      ],
    });

    return Response.json(backfillGaps(object));
  } catch (err) {
    console.error("cv write failed", err);
    return Response.json(
      { error: "Couldn't write the CV. Try again?" },
      { status: 502 },
    );
  }
}
