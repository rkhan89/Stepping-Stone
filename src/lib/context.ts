import { isAxisSkipped } from "./job-search-spec";
import type { Run } from "./session";

/**
 * The run, flattened into what every generation call needs. Answers are
 * resolved from ids to their labels here so the model reads words, not keys.
 */
export function buildContext(run: Run) {
  const questions = run.questions?.questions ?? [];
  const answers = Object.fromEntries(
    questions
      .filter((q) => !isAxisSkipped(q.axisId, run.answers) && run.answers[q.axisId])
      .map((q) => [
        q.axisId,
        {
          question: q.label,
          answer: q.options.find((o) => o.id === run.answers[q.axisId])?.label ?? "",
        },
      ]),
  );

  return {
    input: run.input,
    answers,
    freeText: run.freeText,
    notes: run.notes,
  };
}
