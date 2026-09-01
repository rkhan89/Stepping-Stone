import { generateObject } from "ai";
import { z } from "zod";
import { MODEL_MID, VOICE, missingKeyResponse } from "@/lib/model";
import { daysBetween, isoDate } from "@/lib/applications";
import type { Cv } from "@/lib/schemas";

export const maxDuration = 60;

const followUpSchema = z.object({
  subject: z.string().max(160).describe("Email subject line. Under 10 words."),
  body: z
    .string()
    .max(1400)
    .describe(
      "The whole message, ready to send. Under 120 words. Plain paragraphs, no markdown, no placeholder brackets except [Your name] at the end.",
    ),
  note: z
    .string()
    .max(200)
    .describe("One line to the user on who to send it to and how. 25 words maximum."),
});

type Body = {
  company?: string;
  roleTitle?: string;
  appliedOn?: string;
  url?: string | null;
  cv?: Cv | null;
  /** Their overall goal, for tone. */
  input?: string;
};

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return missingKeyResponse();

  const { company, roleTitle, appliedOn, cv, input } = (await req.json()) as Body;
  if (!company || !roleTitle) {
    return Response.json({ error: "Nothing to follow up on." }, { status: 400 });
  }

  const waited = appliedOn ? daysBetween(appliedOn, isoDate(new Date())) : null;

  try {
    const { object } = await generateObject({
      model: MODEL_MID,
      schema: followUpSchema,
      system: `${VOICE}

You write one short follow-up message chasing a job application that has had no
reply. It has to be ready to send, because the entire point of the nudge is that
they do not have to think.

Rules:
- Under 120 words. A long chaser reads as desperate and gets skimmed.
- Polite, direct, and not apologetic. Never open with "I hope this finds you well"
  or "I am sorry to bother you".
- Reference the specific role and roughly when they applied. Do not invent a
  date, a reference number, a recruiter's name or a conversation that did not
  happen.
- Add exactly one line of genuine substance from their CV: the single most
  relevant thing to this role. This is what separates a chase from a nag. If you
  have not been given a CV, leave it out rather than making something up.
- End with a specific, easy question. "Is there anything else you need from me?"
  or "Could you tell me where the process is up to?" beat "let me know".
- Sign off with [Your name] and nothing else in brackets.

note: who to send it to and how, in one line. Usually the recruiter or hiring
manager on the original advert, or the careers address. Be honest that if they
applied through a portal with no contact, LinkedIn is the realistic route.`,
      prompt: [
        `They applied for: ${roleTitle} at ${company}`,
        waited !== null ? `They applied ${waited} days ago and have heard nothing.` : ``,
        input ? `Their overall goal: ${input}` : ``,
        cv
          ? `\nTheir CV, for the one line of substance:\n${cv.profile}\n${cv.roles
              .slice(0, 2)
              .map((r) => `${r.title} at ${r.company}: ${r.bullets.join(" ")}`)
              .join("\n")}`
          : `\nNo CV on file, so leave the substance line out.`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return Response.json(object);
  } catch (err) {
    console.error("follow-up draft failed", err);
    return Response.json(
      { error: "Couldn't draft that. Try again?" },
      { status: 502 },
    );
  }
}
