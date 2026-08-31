import { generateObject } from "ai";
import { MODEL, VOICE, CV_CRAFT, missingKeyResponse } from "@/lib/model";
import { cvGuideSchema } from "@/lib/schemas";

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
    return Response.json({ error: "Nothing to guide." }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: cvGuideSchema,
      system: `${VOICE}

${CV_CRAFT}

They want to write the CV themselves. Give them the moves, in order, specific to
their situation, not a generic checklist. Someone moving out of marketing gets
told which marketing work to rename and what to rename it to. Someone with a
two-year gap gets told exactly where the gap goes and what sentence covers it.

Each move is one instruction they can carry out and know they've finished. The
detail says what it means in *their* case, naming their field and the field
they're heading to. Two sentences at most.

toolTip: one line on flowcv.io, it's free, the templates are ATS-safe, and it
takes the formatting problem away so they can spend the time on the words. Don't
oversell it.`,
      prompt: [
        `They want to start:\n${input}`,
        `\nWhat they told us:`,
        ...Object.entries(answers).map(([, v]) => `- ${v.question} → ${v.answer}`),
        notes?.trim() ? `- Plan around: ${notes}` : ``,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return Response.json(object);
  } catch (err) {
    console.error("cv guide failed", err);
    return Response.json(
      { error: "Couldn't put the guide together. Try again?" },
      { status: 502 },
    );
  }
}
