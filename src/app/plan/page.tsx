"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ErrorNote, Screen, TickBox, Working } from "@/components/ui";
import { RingInline } from "@/components/marks";
import { CvBuilder } from "@/components/cv-builder";
import { useRun } from "@/lib/session";
import { buildContext } from "@/lib/context";
import type { Step } from "@/lib/schemas";

const ORDINALS = ["one", "two", "three", "four", "five"];

export default function PlanScreen() {
  const router = useRouter();
  const { run, hydrated, persisted, update, reset, forgetMe } = useRun();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Ticking opens the report-back prompt rather than jumping straight on. */
  const [reporting, setReporting] = useState(false);
  const [reportNote, setReportNote] = useState("");

  useEffect(() => {
    if (hydrated && !run.outline && !run.input) router.replace("/start");
  }, [hydrated, run.outline, run.input, router]);

  if (!run.outline) {
    return (
      <Screen className="pt-[70px]">
        <Working lines={["Finding your plan."]} />
      </Screen>
    );
  }

  const { outline, steps, outcomes } = run;
  const total = outline.outline.length;
  const liveIndex = outcomes.length;
  const allDone = liveIndex >= total;
  const live = steps[liveIndex] ?? null;

  /** Report the outcome, then write the next step from everything so far. */
  async function reportAndAdvance(report: string) {
    if (!live) return;
    setBusy(true);
    setError(null);

    const nextOutcomes = [
      ...outcomes,
      { title: live.title, report, note: reportNote.trim() || undefined },
    ];
    const nextIndex = nextOutcomes.length;

    try {
      if (nextIndex >= total) {
        update({ outcomes: nextOutcomes });
        setReporting(false);
        setReportNote("");
        return;
      }

      const res = await fetch("/api/step", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...buildContext(run),
          outline: outline.outline,
          stepIndex: nextIndex,
          outcomes: nextOutcomes,
          cv: run.cv,
        }),
      });
      const step: Step & { error?: string } = await res.json();
      if (!res.ok) throw new Error(step.error ?? "Couldn't write the next step.");

      const nextSteps = [...steps];
      nextSteps[nextIndex] = step;
      update({ outcomes: nextOutcomes, steps: nextSteps });
      setReporting(false);
      setReportNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <Screen className="pt-[70px]">
        <Working
          lines={[
            "Taking that in.",
            run.cv ? "Reading your CV properly." : "Working out what's next for you.",
          ]}
        />
      </Screen>
    );
  }

  return (
    <Screen className="px-6 pb-10 pt-[70px]">
      <div className="flex items-baseline justify-between">
        <div className="t-hand text-[17px] leading-none text-[#1f4fd8]">
          {outline.goalLabel}
        </div>
        <div className="text-[14px] font-semibold leading-none text-[#17262b]/50">
          {outcomes.length}/{total}
        </div>
      </div>

      <h1 className="t-display mt-[10px] text-[30px] leading-[1.1]">
        {allDone ? "That's the plan done." : outline.headline}
      </h1>

      {outline.honestNote && outcomes.length === 0 && (
        <p className="mt-4 border-l-[3px] border-[#1f4fd8] pl-3 text-[15.5px] leading-[1.45] text-[#17262b]/80">
          {outline.honestNote}
        </p>
      )}

      {/* Done, with what they reported — it's why the next step looks like it does. */}
      {outcomes.length > 0 && (
        <div className="mt-6 flex flex-col gap-[10px]">
          {outcomes.map((o, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-[9px] border-[1.5px] border-[#17262b]/[.16] bg-[#fbfbf7]/70 p-4"
            >
              <TickBox checked strong size={24} />
              <div>
                <div className="text-[15.5px] font-medium leading-[1.35] text-[#17262b]/60 line-through decoration-[#17262b]/30">
                  {o.title}
                </div>
                <div className="t-hand text-[16px] leading-[1.3] text-[#1f4fd8]">
                  {o.report}
                  {o.note ? `: ${o.note}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The live step, written when it was reached. */}
      {!allDone && live && (
        <div
          key={liveIndex}
          className="ss-rise mt-[26px] rounded-[10px] border-2 border-[#17262b] bg-[#fbfbf7] p-5"
          style={{ boxShadow: "5px 5px 0 rgba(31,79,216,.28)" }}
        >
          <div className="t-kicker">
            Step {ORDINALS[liveIndex]} · {live.timing}
          </div>
          <h2 className="t-display mt-2 text-[25px] leading-[1.16]">{live.title}</h2>
          <p className="mt-[10px] text-[16px] leading-[1.5] text-[#17262b]/[.78]">
            {live.detail}
          </p>

          {/* Lists read as lists. Cramming them into prose is what made the
              old step cards a wall of text. */}
          {live.checklist.length > 0 && (
            <ul className="mt-3 flex flex-col gap-[7px]">
              {live.checklist.map((c, i) => (
                <li key={i} className="flex gap-[10px] text-[15.5px] leading-[1.35]">
                  <span className="mt-[7px] h-[6px] w-[6px] flex-none rounded-full bg-[#1f4fd8]" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}

          {(live.links.length > 0 || live.aside) && (
            <div className="mt-4 flex flex-col gap-[9px] border-t border-[#17262b]/[.14] pt-[14px]">
              {live.links.map((l, li) =>
                li === 0 ? (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start"
                  >
                    <RingInline>
                      <span className="text-[17px] font-semibold text-[#17262b]">
                        {l.label}
                      </span>
                    </RingInline>
                  </a>
                ) : (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[15.5px] font-medium leading-[1.35] text-[#1f4fd8] underline decoration-[#1f4fd8]/40"
                  >
                    {l.label}
                  </a>
                ),
              )}
              {live.aside && (
                <div className="t-hand text-[17px] leading-[1.35] text-[#17262b]/70">
                  {live.aside}
                </div>
              )}
            </div>
          )}

          {/* A step that asks you to make something helps you make it. */}
          {live.helper === "cv_builder" && (
            <CvBuilder onDone={() => setReporting(true)} />
          )}

          {error && <ErrorNote message={error} />}

          {!reporting ? (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="ss-btn mt-5 text-[16px]"
              style={{ padding: "15px 18px" }}
            >
              Done. What happens next?
            </button>
          ) : (
            <div className="ss-rise mt-5 border-t border-[#17262b]/[.14] pt-4">
              <div className="t-legend">How did it go?</div>
              <div className="t-hand mt-1 text-[16px] text-[#1f4fd8]">
                Straight answer. It changes what we do next.
              </div>
              <div className="mt-3 flex flex-col gap-[9px]">
                {live.reportOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className="ss-option"
                    onClick={() => reportAndAdvance(opt)}
                  >
                    <TickBox checked={false} strong />
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="Anything worth knowing? Optional."
                className="ss-field mt-3 p-[14px] text-[15.5px]"
              />
              <button
                type="button"
                onClick={() => setReporting(false)}
                className="t-hand mt-3 block w-full text-center text-[17px] text-[#1f4fd8]"
              >
                Not yet, take me back
              </button>
            </div>
          )}
        </div>
      )}

      {/* What's left, kept shut — it isn't written yet, and that's the point. */}
      {!allDone && total - liveIndex - 1 > 0 && (
        <div className="mt-[22px] flex flex-col gap-[10px]">
          {outline.outline.slice(liveIndex + 1).map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-[9px] border-[1.5px] border-dashed border-[#17262b]/20 p-4"
            >
              <TickBox checked={false} size={22} />
              <span className="text-[15px] leading-[1.35] text-[#17262b]/45">
                Step {ORDINALS[liveIndex + 1 + i]}, written once you&rsquo;ve done the
                one above.
              </span>
            </div>
          ))}
        </div>
      )}

      {allDone && (
        <p className="mt-6 text-[16px] leading-[1.5] text-[#17262b]/80">
          That&rsquo;s all {total}. Come back and tell us how the applications went and
          we&rsquo;ll work out what&rsquo;s next.
        </p>
      )}

      <div className="mt-8 border-t border-[#17262b]/[.16] pt-5 text-center">
        <Link href="/start" onClick={reset} className="t-hand text-[18px] text-[#1f4fd8]">
          Start something else
        </Link>
        <div className="mt-2 text-[13.5px] leading-[1.45] text-[#17262b]/45">
          {persisted
            ? "Saved to this browser. Come back any time and carry on."
            : "Nothing’s saved. Close this tab and the plan goes with it."}
        </div>
        {persisted && (
          <button
            type="button"
            onClick={async () => {
              if (!confirm("Delete your plan and your CV? This cannot be undone.")) return;
              await forgetMe();
              router.push("/");
            }}
            className="mt-3 text-[13.5px] text-[#b03a1a] underline decoration-[#b03a1a]/40"
          >
            Delete everything you hold on me
          </button>
        )}
      </div>
    </Screen>
  );
}
