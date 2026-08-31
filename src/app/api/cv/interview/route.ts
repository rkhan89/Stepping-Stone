import { generateObject } from "ai";
import { MODEL_MID, VOICE, CV_CRAFT, missingKeyResponse } from "@/lib/model";
import { cvInterviewSchema } from "@/lib/schemas";

export const maxDuration = 60;

type Body = {
  input?: string;
  answers?: Record<string, { question: string; answer: string }>;
  notes?: string;
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return missingKeyResponse();

  const { input, answers = {}, notes } = (await req.json()) as Body;
  if (!input?.trim()) {
    return Response.json({ error: "Nothing to ask about." }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: MODEL_MID,
      schema: cvInterviewSchema,
      system: `${VOICE}

${CV_CRAFT}

Someone has no CV. You are collecting just enough to write them one, the
smallest set of questions that yields a real two-page CV, not a form.

Rules:
- Between four and seven questions. Fewer is better.
- One question per thing. Never "your roles, dates and achievements" in one box.
- Ask for the raw material, not the finished sentence. "What did you actually do
  all day in your last job?" beats "Describe your key achievements."
- At least one question must dig for evidence and numbers, because without it
  every bullet ends up as a placeholder.
- Ask about the thing they're moving *towards* too, so the profile can aim.
- Never ask for anything a CV shouldn't carry: no age, no marital status, no
  photo, no nationality unless a visa genuinely bears on their situation.
- The placeholder shows them what a good answer looks like, in their world.
- 'why' is one short line telling them what it changes. It earns the question.`,
      prompt: [
        `They want to start:\n${input}`,
        `\nWhat they've told us:`,
        ...Object.entries(answers).map(([, v]) => `- ${v.question} → ${v.answer}`),
        notes?.trim() ? `- Plan around: ${notes}` : ``,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return Response.json(object);
  } catch (err) {
    console.error("cv interview failed", err);
    return Response.json(
      { error: "Couldn't put the questions together. Try again?" },
      { status: 502 },
    );
  }
}
