import { generateObject } from "ai";
import { MODEL_MID, VOICE, missingKeyResponse } from "@/lib/model";
import { questionsSchema } from "@/lib/schemas";
import { AXIS_IDS, JOB_SEARCH_AXES, MAX_QUESTIONS } from "@/lib/job-search-spec";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return missingKeyResponse();

  const { input } = (await req.json()) as { input?: string };
  if (!input?.trim()) {
    return Response.json({ error: "Nothing to ask about." }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: MODEL_MID,
      schema: questionsSchema,
      system: `${VOICE}

You reword a fixed set of questions so they sound like they were written for
this one person, after reading what they typed.

Hard rules:
- Return every axis you are given, in the order given. Never add, drop or
  reorder one. Never exceed ${MAX_QUESTIONS} questions.
- axisId and every option id must come back exactly as supplied. Only the
  human-readable labels change.
- Keep each option's meaning identical to the supplied one. "Mid career" can
  become "A few years in", it cannot become "Some experience or a lot".
- Options stay short enough to read at a glance. Under 7 words.
- Where an axis has a free-text trigger, write a placeholder that gives real
  examples in their world. Where it does not, return null.
- The intro sits above the questions and says how many there are and why, e.g.
  "Four quick things, then we go digging."`,
      prompt: `They typed:\n\n${input}\n\nThe axes, with ids that must survive unchanged:\n\n${JSON.stringify(
        JOB_SEARCH_AXES,
        null,
        2,
      )}`,
    });

    // Trust the schema, not the model: drop anything off-spec, keep spec order.
    const byAxis = new Map(object.questions.map((q) => [q.axisId, q]));
    const questions = JOB_SEARCH_AXES.filter((a) => AXIS_IDS.includes(a.id))
      .map((axis) => {
        const generated = byAxis.get(axis.id);
        const validIds = new Set<string>(axis.options.map((o) => o.id));
        return {
          axisId: axis.id,
          label: generated?.label ?? axis.label,
          options: axis.options.map((o) => ({
            id: o.id,
            label:
              generated?.options.find((g) => g.id === o.id && validIds.has(g.id))
                ?.label ?? o.label,
          })),
          freeTextPrompt: axis.freeText
            ? (generated?.freeTextPrompt ?? axis.freeText)
            : null,
        };
      })
      .slice(0, MAX_QUESTIONS);

    return Response.json({ intro: object.intro, questions });
  } catch (err) {
    console.error("questions failed", err);
    return Response.json(
      { error: "Couldn't put the questions together. Try again?" },
      { status: 502 },
    );
  }
}
