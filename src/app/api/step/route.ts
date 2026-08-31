import { generateObject } from "ai";
import { MODEL, VOICE, missingKeyResponse } from "@/lib/model";
import { stepSchema } from "@/lib/schemas";
import type { Cv, Outcome, OutlineStep } from "@/lib/schemas";

export const maxDuration = 120;

type Body = {
  input?: string;
  answers?: Record<string, { question: string; answer: string }>;
  freeText?: Record<string, string>;
  notes?: string;
  outline?: OutlineStep[];
  stepIndex?: number;
  outcomes?: Outcome[];
  cv?: Cv | null;
};

/** The CV as plain text, so the step writer can actually read it. */
function renderCv(cv: Cv) {
  return [
    `${cv.fullName}, ${cv.headlineTitle}`,
    cv.contactLine,
    ``,
    `PROFILE`,
    cv.profile,
    ``,
    `EXPERIENCE`,
    ...cv.roles.map(
      (r) =>
        `${r.title}, ${r.company} (${r.location}) ${r.dates}\n` +
        r.bullets.map((b) => `  - ${b}`).join("\n"),
    ),
    ``,
    `SKILLS`,
    ...cv.skills.map((s) => `${s.category}: ${s.items.join(", ")}`),
    ``,
    `EDUCATION`,
    ...cv.education,
    cv.gaps.length ? `\nSTILL MISSING: ${cv.gaps.join("; ")}` : ``,
  ].join("\n");
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return missingKeyResponse();

  const {
    input,
    answers = {},
    freeText = {},
    notes,
    outline = [],
    stepIndex = 0,
    outcomes = [],
    cv = null,
  } = (await req.json()) as Body;

  const current = outline[stepIndex];
  if (!input?.trim() || !current) {
    return Response.json({ error: "Nothing to write." }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: stepSchema,
      system: `${VOICE}

You write ONE step of someone's plan, at the moment they reach it. Everything
the earlier steps produced is in front of you. Use it, that is the entire
reason this step is written now instead of at the start.

If you have been handed their CV, read it. Name the actual roles, the actual
employers, the actual years, the actual skills that are in it. Do not describe
the market in general terms when you are holding the specific document. A step
that could have been written before they did anything is a failed step.

If they reported that something did not work, the step must respond to that -
different search terms, a different route in, an acknowledgement that the last
approach was wrong. Do not repeat the advice that just failed.

What makes a step real:
- Finishable in one sitting, with an obvious "done" moment.
- Doable with what they already have, without spending money.
- Names the actual thing. Not "search job boards". Say which board, what terms,
  which filters, sorted by what.
- detail is ONE or TWO sentences, 35 words at the very most. If it wants to be
  longer, you are either writing a list (use checklist) or describing two steps.
- checklist carries anything they have to gather, write down or check. Each item
  is a fragment of under 10 words, not a sentence. Three items beats a paragraph
  naming three things. Leave it empty for a single-action step.
- Between detail, checklist and aside, the whole card must read in about fifteen
  seconds. If it does not, cut the aside first, then trim the detail.
- Links are constructed from real job-board URL patterns with their terms
  properly encoded. Never link to a specific posting: you have not seen one.
- Never name an employer, recruiter, salary or date as if you know it.
- Their timeline sets the pace, their employment status sets the tone. Someone
  hunting discreetly cannot be told to announce it to their network.

reportOptions: how this step can actually turn out, in their words, short. Cover
the good outcome and the realistic bad one, "Applied", "None of these fit",
"Couldn't get hold of them". Their answer decides what the next step becomes.

helper: keep the helper this step was given in the outline. Set 'cv_builder'
only on a step that produces or fixes the CV.`,
      prompt: [
        `Their goal:\n${input}`,
        `\nWhat they told us at the start:`,
        ...Object.entries(answers).map(([, v]) => `- ${v.question} → ${v.answer}`),
        ...Object.entries(freeText)
          .filter(([, v]) => v?.trim())
          .map(([k, v]) => `- (${k}, in their words) ${v}`),
        notes?.trim() ? `- Plan around: ${notes}` : ``,
        `\nThe whole arc, for context:`,
        ...outline.map(
          (s, i) =>
            `${i + 1}. ${s.title}, ${s.intent}${i === stepIndex ? "   <-- WRITE THIS ONE" : ""}`,
        ),
        outcomes.length
          ? `\nWhat has already happened:\n${outcomes
              .map(
                (o) =>
                  `- ${o.title} → they reported: ${o.report}${o.note ? ` ("${o.note}")` : ""}`,
              )
              .join("\n")}`
          : `\nThis is the first step. Nothing has happened yet.`,
        cv
          ? `\nTHE CV THEY HAVE NOW BUILT, read it and write from it:\n\n${renderCv(cv)}`
          : `\nNo CV on file yet.`,
        `\nWrite step ${stepIndex + 1}: "${current.title}" (${current.timing}). Its job: ${current.intent}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    // The outline decides which helper a step carries, not the step writer.
    return Response.json({ ...object, helper: current.helper });
  } catch (err) {
    console.error("step failed", err);
    return Response.json(
      { error: "Couldn't write that step. Try again?" },
      { status: 502 },
    );
  }
}
