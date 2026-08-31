"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNote, OptionRow, Screen, Working } from "@/components/ui";
import { CircleAround } from "@/components/marks";
import { useRun } from "@/lib/session";
import { isAxisSkipped } from "@/lib/job-search-spec";
import type { Outline, Step } from "@/lib/schemas";

export default function Questions() {
  const router = useRouter();
  const { run, hydrated, update } = useRun();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Straight in on a refresh with nothing in the session — send them back.
  // Only once sessionStorage has been read, or we'd bounce a valid run.
  useEffect(() => {
    if (hydrated && !run.questions && !run.input) router.replace("/start");
  }, [hydrated, run.questions, run.input, router]);

  if (!run.questions) {
    return (
      <Screen className="pt-[70px]">
        <Working lines={["Picking up where you left off."]} />
      </Screen>
    );
  }

  const visible = run.questions.questions.filter(
    (q) => !isAxisSkipped(q.axisId, run.answers),
  );
  const answeredAll = visible.every((q) => run.answers[q.axisId]);
  const cvSkip = run.answers.cv_status === "cv_none";

  function pick(axisId: string, optionId: string) {
    update((prev) => ({ answers: { ...prev.answers, [axisId]: optionId } }));
  }

  async function dig() {
    setBusy(true);
    setError(null);
    try {
      const answers = Object.fromEntries(
        visible
          .filter((q) => run.answers[q.axisId])
          .map((q) => [
            q.axisId,
            {
              question: q.label,
              answer:
                q.options.find((o) => o.id === run.answers[q.axisId])?.label ?? "",
            },
          ]),
      );

      const context = {
        input: run.input,
        answers,
        freeText: run.freeText,
        notes: run.notes,
      };

      // The arc first — titles and intent only.
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(context),
      });
      const outline: Outline & { error?: string } = await res.json();
      if (!res.ok) throw new Error(outline.error ?? "Plan failed");

      // Then step one, written properly. Every later step is written the same
      // way, at the moment it's revealed.
      const sRes = await fetch("/api/step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...context,
          outline: outline.outline,
          stepIndex: 0,
          outcomes: [],
          cv: null,
        }),
      });
      const step: Step & { error?: string } = await sRes.json();
      if (!sRes.ok) throw new Error(step.error ?? "Step failed");

      update({
        outline,
        steps: [step],
        outcomes: [],
        cv: null,
        // Keep the resolved answers so later steps get the labels, not the ids.
        answers: run.answers,
      });
      router.push("/plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <Screen className="pt-[70px]">
        <Working
          lines={[
            "Going digging.",
            "Reading what you told us.",
            "Working out the one thing to do first.",
          ]}
        />
      </Screen>
    );
  }

  return (
    <Screen className="px-7 pb-10 pt-[70px]">
      {run.classification && (
        <div className="t-hand text-[17px] leading-[1.35] text-[#1f4fd8]">
          You said: {run.classification.restatement}
        </div>
      )}
      <h1 className="t-display mt-[10px] text-[30px] leading-[1.12]">
        {run.questions.intro}
      </h1>

      {visible.map((q, i) => (
        <div key={q.axisId} className="mt-[26px] first-of-type:mt-[30px]">
          <div className="t-legend">
            {String(i + 1).padStart(2, "0")} · {q.label}
          </div>
          <div className="mt-3 flex flex-col gap-[10px]" role="radiogroup" aria-label={q.label}>
            {q.options.map((o) => (
              <OptionRow
                key={o.id}
                label={o.label}
                picked={run.answers[q.axisId] === o.id}
                onPick={() => pick(q.axisId, o.id)}
              />
            ))}
          </div>

          {/* Free text where the spec calls for it, once the axis is answered. */}
          {q.freeTextPrompt && run.answers[q.axisId] && (
            <textarea
              rows={2}
              value={run.freeText[q.axisId] ?? ""}
              onChange={(e) =>
                update((prev) => ({
                  freeText: { ...prev.freeText, [q.axisId]: e.target.value },
                }))
              }
              placeholder={q.freeTextPrompt}
              className="ss-field ss-rise mt-[10px] p-[15px] text-[16.5px]"
            />
          )}

          {/* Spec: no CV routes to CV-building before role targeting. */}
          {q.axisId === "cv_status" && cvSkip && (
            <div className="t-hand ss-rise mt-3 text-[18px] leading-[1.3] text-[#1f4fd8]">
              Then we start with the CV. No point aiming at roles you can&rsquo;t
              apply to yet.
            </div>
          )}
        </div>
      ))}

      <div className="relative mt-[30px]">
        <CircleAround className="pointer-events-none absolute -left-[14px] top-4 h-[150px] w-[330px]" />
        <div className="t-legend">Anything unusual we should plan around?</div>
        <textarea
          rows={3}
          value={run.notes}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="A visa, a two-year gap, no childcare on Wednesdays. Whatever it is."
          className="ss-field mt-3 p-[15px] text-[16.5px]"
        />
        <div className="t-hand mt-3 text-[18px] leading-[1.3] text-[#1f4fd8]">
          This is the bit that changes the plan.
        </div>
      </div>

      {error && <ErrorNote message={error} onRetry={dig} />}

      <button
        type="button"
        className="ss-btn mt-[34px]"
        disabled={!answeredAll}
        onClick={dig}
      >
        Go and dig
      </button>
      <div className="mt-[14px] text-center text-[14px] leading-[1.5] text-[#17262b]/50">
        {answeredAll
          ? "Takes about a minute."
          : `${visible.filter((q) => run.answers[q.axisId]).length} of ${visible.length} answered.`}
      </div>
    </Screen>
  );
}
