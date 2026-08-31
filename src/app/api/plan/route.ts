import { generateObject } from "ai";
import { MODEL_MID, VOICE, missingKeyResponse } from "@/lib/model";
import { outlineSchema } from "@/lib/schemas";
import { JOB_SEARCH_PLAN_TEMPLATE } from "@/lib/job-search-spec";

export const maxDuration = 120;

type Body = {
  input?: string;
  answers?: Record<string, { question: string; answer: string }>;
  freeText?: Record<string, string>;
  notes?: string;
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return missingKeyResponse();

  const { input, answers = {}, freeText = {}, notes } = (await req.json()) as Body;
  if (!input?.trim()) {
    return Response.json({ error: "Nothing to plan." }, { status: 400 });
  }

  // Spec: no CV means the CV-building sub-flow comes before role targeting.
  const noCv = Object.values(answers).some((a) =>
    /don'?t have one|no cv|nothing written down|haven'?t got one/i.test(a.answer),
  );

  try {
    const { object } = await generateObject({
      model: MODEL_MID,
      schema: outlineSchema,
      system: `${VOICE}

You lay out the arc of a first plan for someone changing jobs. You are NOT
writing the steps, only their titles, their timing, and a private note of what
each one is for. Each step gets written properly later, at the moment it is
revealed, by which point the earlier steps will have produced something real to
write from. That is the whole point: do not front-load detail you cannot
possibly have yet.

The shape is fixed by the template:

${JOB_SEARCH_PLAN_TEMPLATE.map((s, i) => `${i + 1}. ${s}`).join("\n")}

${
  noCv
    ? `They have no CV, so step one builds one and role targeting waits until
they have something to send.`
    : `Step one is only about the CV if theirs needs work. If their CV is current,
drop that step and start at role targeting, so there are still four steps.`
}

The plan is a chain, not a list. Each step must consume what the one before it
produced, the CV step produces a CV, so the targeting step reads that CV rather
than guessing, and the search step searches for what the targeting step chose.
Write each 'intent' so the later writer knows exactly what it is handed and what
it must hand on.

helper: set 'cv_builder' on the step that produces or fixes the CV, because the
app can do that work with them. 'none' everywhere else, for now.

honestNote: only if there is something real they need to hear before starting -
a hard target, a gap that will get asked about, a timeline that will not happen.
Otherwise null. Never use it to be encouraging.`,
      prompt: [
        `They want to start:\n${input}`,
        `\nWhat they told us:`,
        ...Object.entries(answers).map(([, v]) => `- ${v.question} → ${v.answer}`),
        ...Object.entries(freeText)
          .filter(([, v]) => v?.trim())
          .map(([k, v]) => `- (${k}, in their words) ${v}`),
        notes?.trim()
          ? `\nAnything unusual to plan around, in their words:\n${notes}`
          : `\nThey said nothing unusual to plan around.`,
      ].join("\n"),
    });

    return Response.json(object);
  } catch (err) {
    console.error("plan failed", err);
    return Response.json(
      { error: "Couldn't build the plan. Try again?" },
      { status: 502 },
    );
  }
}
