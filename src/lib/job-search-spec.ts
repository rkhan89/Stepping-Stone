/**
 * Job-search question schema, verbatim from stepping-stone-category-specs.md § 1.
 *
 * Option ids are fixed here rather than generated, because the branching logic
 * keys off them ("don't have one" for CV skips the target-role question).
 * The LLM rewords `label` / option `label` to suit what the user typed; it
 * never invents axes or option ids.
 */

export const JOB_SEARCH_AXES = [
  {
    id: "cv_status",
    label: "Where's your CV at?",
    options: [
      { id: "cv_current", label: "Have one and it's current" },
      { id: "cv_outdated", label: "Have one but it's outdated" },
      { id: "cv_none", label: "Don't have one" },
    ],
    freeText: null,
  },
  {
    id: "target_clarity",
    label: "How clear are you on what you're going for?",
    options: [
      { id: "target_role", label: "Know exactly what role" },
      { id: "target_industry", label: "Know the industry, not the role" },
      { id: "target_none", label: "No idea yet" },
    ],
    // Spec: free text trigger on this axis.
    freeText: "Describe what you've been thinking about",
  },
  {
    id: "experience_level",
    label: "Where are you in your working life?",
    options: [
      { id: "exp_entry", label: "Entry level" },
      { id: "exp_mid", label: "Mid career" },
      { id: "exp_senior_switch", label: "Senior, changing fields" },
    ],
    freeText: null,
  },
  {
    id: "employment_status",
    label: "What's your situation right now?",
    options: [
      { id: "emp_employed", label: "Currently employed" },
      { id: "emp_unemployed", label: "Unemployed" },
      { id: "emp_discreet", label: "Employed but job hunting discreetly" },
    ],
    freeText: null,
  },
  {
    id: "timeline",
    label: "How soon do you want to be in the job?",
    options: [
      { id: "time_asap", label: "ASAP" },
      { id: "time_3m", label: "Within 3 months" },
      { id: "time_open", label: "No rush" },
    ],
    freeText: null,
  },
] as const;

export type AxisId = (typeof JOB_SEARCH_AXES)[number]["id"];

export const AXIS_IDS = JOB_SEARCH_AXES.map((a) => a.id) as AxisId[];

/** Spec: cap at 5 questions. */
export const MAX_QUESTIONS = 5;

/**
 * Spec: 'If "don't have one" is selected for CV, skip target-role question
 * first, route to CV-building sub-flow before role targeting.'
 */
export function isAxisSkipped(axisId: string, answers: Record<string, string>) {
  return axisId === "target_clarity" && answers.cv_status === "cv_none";
}

/** Spec § plan template (first 4 steps). Passed to the plan generator verbatim. */
export const JOB_SEARCH_PLAN_TEMPLATE = [
  "Build or tailor CV (skip if already current)",
  "Here are 3 to 5 roles that fit your experience, based on what you told us",
  "Here are live postings matching those roles, with direct application links",
  "Apply to the first one, then come back and tell us how it went",
];
