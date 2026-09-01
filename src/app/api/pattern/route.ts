import { generateObject } from "ai";
import { z } from "zod";
import { MODEL_DEEP, VOICE, missingKeyResponse } from "@/lib/model";
import type { Application } from "@/lib/applications";
import type { Cv } from "@/lib/schemas";

export const maxDuration = 120;

/** Below this there is no pattern, only noise. Say so rather than inventing one. */
export const MIN_FOR_PATTERN = 4;

const patternSchema = z.object({
  verdict: z
    .string()
    .max(300)
    .describe(
      "What is actually going wrong, said plainly. One or two sentences, 40 words maximum. If nothing is wrong yet, say that instead of manufacturing a problem.",
    ),
  evidence: z
    .array(z.string().max(160))
    .max(4)
    .describe(
      "The counts behind the verdict, each under 15 words. e.g. 'Seven of eight were Senior titles'. Numbers, not adjectives.",
    ),
  change: z
    .string()
    .max(300)
    .describe(
      "The one thing to do differently on the next few applications. Specific and testable, 40 words maximum.",
    ),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe(
      "How much the sample supports this. Four applications is low. Fifteen with a consistent shape is high.",
    ),
});

type Body = {
  applications?: Application[];
  cv?: Cv | null;
  input?: string;
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return missingKeyResponse();

  const { applications = [], cv, input } = (await req.json()) as Body;

  if (applications.length < MIN_FOR_PATTERN) {
    return Response.json(
      {
        error: `Not enough to see a pattern yet. Log at least ${MIN_FOR_PATTERN}.`,
        tooFew: true,
      },
      { status: 400 },
    );
  }

  const counts = applications.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  try {
    const { object } = await generateObject({
      model: MODEL_DEEP,
      schema: patternSchema,
      system: `${VOICE}

You look at what someone has applied for, what came back, and their CV, and you
say what is going wrong. This is the one thing a spreadsheet cannot do, so it has
to be worth reading.

You are looking for things like:
- Aiming at a level the CV does not evidence. This is the commonest cause of
  silence and the easiest to fix.
- A title mismatch: applying under words their sector does not use.
- One sector or company size taking everything and rejecting everything.
- Applying to roles that need a credential or a portfolio they have not got.
- Volume too low to conclude anything, which is itself the finding.
- Nothing wrong at all. Four applications and silence is normal, and saying so
  honestly is more useful than inventing a diagnosis.

Rules:
- Count before you conclude. Every claim in evidence is a number you can see in
  the data given, never an impression.
- Never blame effort or attitude. "You need to apply to more" is only a finding
  if the number genuinely is too low, and then say the number.
- The change must be testable on the next few applications, not a project.
- Silence is data. Ghosted and no-response are the normal outcome, not failure,
  and the volume of it is usually the clearest signal you have.
- If the honest answer is "too early to tell", give that as the verdict and set
  confidence to low. Do not manufacture a pattern to seem useful.`,
      prompt: [
        input ? `Their goal: ${input}` : ``,
        `\n${applications.length} applications logged. Status counts: ${JSON.stringify(counts)}`,
        `\nThe applications:`,
        ...applications.map(
          (a) =>
            `- ${a.roleTitle} at ${a.company}, applied ${a.appliedOn}, status ${a.status}` +
            (a.outcomeNote ? ` ("${a.outcomeNote}")` : ""),
        ),
        cv
          ? `\nTheir CV:\n${cv.headlineTitle}\n${cv.profile}\n${cv.roles
              .map((r) => `${r.title} at ${r.company} (${r.dates}): ${r.bullets.join(" ")}`)
              .join("\n")}\nSkills: ${cv.skills.map((s) => `${s.category}: ${s.items.join(", ")}`).join("; ")}`
          : `\nNo CV on file, so judge the applications on their own.`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return Response.json(object);
  } catch (err) {
    console.error("pattern read failed", err);
    return Response.json(
      { error: "Couldn't read the pattern. Try again?" },
      { status: 502 },
    );
  }
}
