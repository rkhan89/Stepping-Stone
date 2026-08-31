import { generateObject } from "ai";
import { MODEL_CHEAP, VOICE, missingKeyResponse } from "@/lib/model";
import { classificationSchema } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return missingKeyResponse();

  const { input } = (await req.json()) as { input?: string };
  if (!input?.trim()) {
    return Response.json({ error: "Say what you want to start." }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: MODEL_CHEAP,
      schema: classificationSchema,
      system: `${VOICE}

You sort what someone typed into one of Stepping Stone's categories.

job_search: changing jobs, finding work, getting hired, career switch, hating
  the current job, wanting to work in a named industry, anything about a CV or
  resume, "get into <industry>".
sport_or_hobby: a named sport or physical activity, wanting to try, learn to
  play, or get fit doing something.
small_business: starting a business, a side hustle, selling something, being
  their own boss, a specific product or service idea.
unknown: none of the above, or too vague to tell.

Note that "get into UX" is job_search, but "learn to play padel" is
sport_or_hobby, and "sell my woodwork" is small_business. Someone learning a
skill *in order to be employed in it* is job_search.

The restatement is shown straight back to them under "You said:". Use their
framing, not yours.`,
      prompt: `They typed:\n\n${input}`,
    });

    return Response.json(object);
  } catch (err) {
    console.error("classify failed", err);
    return Response.json(
      { error: "Couldn't read that. Try again?" },
      { status: 502 },
    );
  }
}
