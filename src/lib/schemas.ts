import { z } from "zod";

/**
 * Length convention, learned the hard way: `.describe()` sets the target and is
 * what actually shortens the output; `.max()` is only a guard against runaway
 * generation. Never set `.max()` at the target. A model cannot count characters,
 * so a cap sitting on the target turns a sentence that runs ten characters long
 * into a schema violation, and generateObject throws away the whole response.
 * Keep max at roughly 3x the stated word target.
 */

/** LLM call 1, classify freeform input against the fixed category list. */
export const classificationSchema = z.object({
  category: z.enum([
    "job_search",
    "sport_or_hobby",
    "small_business",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  /** Short restatement shown back to the user: "You said: …" */
  restatement: z
    .string()
    .describe(
      "How the goal reads back to the user, under 12 words, their own framing, no quote marks",
    ),
  signals: z
    .array(z.string())
    .describe("Words or phrases in the input that drove the classification"),
});
export type Classification = z.infer<typeof classificationSchema>;

/** LLM call 2, questions, worded for what they typed, from the fixed axes. */
export const questionsSchema = z.object({
  intro: z
    .string()
    .describe(
      "One line above the questions, e.g. 'Four quick things, then we go digging.'",
    ),
  questions: z.array(
    z.object({
      axisId: z.string().describe("Must be one of the supplied axis ids"),
      label: z.string().describe("The question, reworded for this person"),
      options: z.array(
        z.object({
          id: z.string().describe("Must be the supplied option id, unchanged"),
          label: z.string().describe("The option, reworded for this person"),
        }),
      ),
      freeTextPrompt: z
        .string()
        .nullable()
        .describe("Placeholder for the free-text box, or null if this axis has none"),
    }),
  ),
});
export type GeneratedQuestions = z.infer<typeof questionsSchema>;

/**
 * Helpers a step can carry. A step that asks someone to *make* something must
 * offer to help make it, otherwise the plan stalls and nothing feeds forward.
 */
export const helperKinds = ["cv_builder", "none"] as const;

/**
 * LLM call 3, the arc only. Titles and intent, no prose. The prose for each
 * step is written later, when the step is revealed, so it can use what the
 * earlier steps actually produced.
 */
export const outlineSchema = z.object({
  goalLabel: z
    .string()
    .describe("Short plan title in the header, e.g. 'Into UX research · Manchester'"),
  headline: z
    .string()
    .describe("One line over the steps, e.g. 'Four steps. Do the top one today.'"),
  honestNote: z
    .string()
    .max(700)
    .nullable()
    .describe(
      "Only if there is something they genuinely need to know before starting. 40 words maximum. Null far more often than not.",
    ),
  outline: z
    .array(
      z.object({
        title: z.string().describe("The action, as an instruction, under 9 words"),
        timing: z.string().describe("When, e.g. 'today', 'this week'"),
        intent: z
          .string()
          .describe(
            "What this step is for and what it must produce, one sentence, written for the model that will draft this step later, not shown to the user",
          ),
        helper: z.enum(helperKinds),
      }),
    )
    .min(4)
    .max(5),
});
export type Outline = z.infer<typeof outlineSchema>;
export type OutlineStep = Outline["outline"][number];

/**
 * LLM call 4, one step, written at the moment it is revealed, with every
 * artifact and outcome so far in hand.
 */
export const stepSchema = z.object({
  title: z.string().describe("The action, as an instruction, under 9 words"),
  timing: z.string().describe("When to do it, e.g. 'today', 'before Friday'"),
  detail: z
    .string()
    .max(600)
    .describe(
      "Why this step, and what done looks like. ONE or TWO sentences, 35 words maximum. Anything that is a list of things to gather, write or check goes in checklist instead, not here.",
    ),
  checklist: z
    .array(z.string().max(220))
    .max(4)
    .describe(
      "The things to actually write down, gather or check. Each item 10 words maximum, no full stop, no leading verb repetition. Empty array if the step is a single action.",
    ),
  links: z
    .array(
      z.object({
        label: z.string(),
        url: z.string().describe("A real, constructible URL, never invented"),
      }),
    )
    .describe("Things they can open now. May be empty."),
  aside: z
    .string()
    .max(400)
    .nullable()
    .describe(
      "A handwritten margin note. One sharp tip, 20 words maximum. Null unless it genuinely adds something the detail does not.",
    ),
  helper: z.enum(helperKinds),
  /**
   * Spec: 'Tick → reveal next step, with branch logic based on outcome
   * reported.' These are how this specific step can go.
   */
  reportOptions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "Ways this step can actually turn out, in their words, e.g. 'Applied', 'None of these fit'. Short.",
    ),
});
export type Step = z.infer<typeof stepSchema>;

/** What a finished step left behind, and what it means for the rest. */
export type Outcome = {
  title: string;
  /** Which reportOption they picked. */
  report: string;
  /** Anything they typed when reporting back. */
  note?: string;
};

/** The CV, as content. flowcv does the formatting. */
export const cvSchema = z.object({
  fullName: z.string(),
  headlineTitle: z
    .string()
    .describe("The title line under their name, e.g. 'User Researcher'"),
  contactLine: z
    .string()
    .describe(
      "ATS-safe: 'City, Country | email | +phone'. Plain text, no icons, no emoji. Use placeholders in square brackets for anything not supplied.",
    ),
  profile: z.string().describe("Three or four lines, front-loading what they're aiming at"),
  roles: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string(),
      dates: z.string(),
      bullets: z
        .array(z.string())
        .describe("Google XYZ: accomplished X, measured by Y, by doing Z"),
    }),
  ),
  skills: z.array(
    z.object({ category: z.string(), items: z.array(z.string()) }),
  ),
  education: z.array(z.string()),
  /** Honesty channel: what we could not fill without making it up. */
  gaps: z
    .array(z.string())
    .describe(
      "Anything left as a placeholder, or a metric they need to supply. Say exactly what to go and find.",
    ),
});
export type Cv = z.infer<typeof cvSchema>;

/** Questions for someone with no CV to work from. */
export const cvInterviewSchema = z.object({
  intro: z
    .string()
    .max(250)
    .describe(
      "One line setting expectations, e.g. 'Rough notes are fine, I'll do the shaping.' 12 words maximum. Do NOT state how many questions there are: the app counts them and prints that itself.",
    ),
  questions: z
    .array(
      z.object({
        id: z.string(),
        label: z
          .string()
          .max(350)
          .describe("The question. 18 words maximum. One thing per question."),
        placeholder: z
          .string()
          .max(300)
          .describe("What a good answer looks like, in their world. Short."),
        why: z
          .string()
          .max(220)
          .describe("What it changes, in their case. 10 words maximum."),
      }),
    )
    .min(4)
    .max(7),
});
export type CvInterview = z.infer<typeof cvInterviewSchema>;

/** The 'guide me' path, specific instructions, not generic advice. */
export const cvGuideSchema = z.object({
  intro: z
    .string()
    .max(280)
    .describe("One line: what they're doing and how long it takes. 14 words maximum."),
  moves: z
    .array(
      z.object({
        do: z.string().max(220).describe("One concrete instruction, 10 words maximum"),
        detail: z
          .string()
          .max(450)
          .describe("What it means in their case. ONE sentence, 22 words maximum."),
      }),
    )
    .min(3)
    .max(6),
  toolTip: z
    .string()
    .max(300)
    .describe("Why flowcv.com helps here. One line, 16 words maximum."),
});
export type CvGuide = z.infer<typeof cvGuideSchema>;
