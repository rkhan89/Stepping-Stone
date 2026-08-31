"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorNote, Screen, Working } from "@/components/ui";
import { ArrowToBox } from "@/components/marks";
import { useRun } from "@/lib/session";
import type { Classification, GeneratedQuestions } from "@/lib/schemas";

export default function Intake() {
  const router = useRouter();
  const { run, update } = useRun();
  const [text, setText] = useState(run.input);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offCategory, setOffCategory] = useState<Classification | null>(null);

  async function go() {
    const input = text.trim();
    if (!input) return;
    setBusy(true);
    setError(null);
    setOffCategory(null);

    try {
      // LLM call 1 — classify.
      const cRes = await fetch("/api/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const classification = await cRes.json();
      if (!cRes.ok) throw new Error(classification.error ?? "Classify failed");

      // Only the job-search vertical is built. Say so rather than guessing.
      if (classification.category !== "job_search") {
        setOffCategory(classification);
        setBusy(false);
        return;
      }

      // LLM call 2 — questions, worded for what they typed.
      const qRes = await fetch("/api/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const questions: GeneratedQuestions & { error?: string } = await qRes.json();
      if (!qRes.ok) throw new Error(questions.error ?? "Questions failed");

      update({
        input,
        classification,
        questions,
        answers: {},
        freeText: {},
        notes: "",
        outline: null,
        steps: [],
        outcomes: [],
        cv: null,
      });
      router.push("/questions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <Screen className="pt-[78px]">
        <Working
          lines={["Reading what you wrote.", "Working out what to ask you."]}
        />
      </Screen>
    );
  }

  return (
    <Screen className="pb-6 pt-[78px]">
      <h1 className="t-display m-0 text-[38px] leading-[1.08]">
        What do you want to start?
      </h1>

      <div className="relative mt-11">
        <ArrowToBox className="absolute -top-[46px] right-[6px]" />
        <textarea
          rows={5}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go();
          }}
          placeholder="Say it however it comes out."
          className="ss-field text-[21px]"
        />
        <div className="t-hand mt-[14px] pl-[3px] text-[19px] leading-[1.3] text-[#1f4fd8]">
          Plain words. We&rsquo;ll ask the rest.
        </div>
      </div>

      {offCategory && (
        <div className="ss-rise mt-6 rounded-lg border-[1.5px] border-[#17262b]/20 bg-[#fbfbf7] p-4">
          <div className="t-hand text-[18px] text-[#1f4fd8]">
            You said: {offCategory.restatement}
          </div>
          <p className="mt-2 text-[15.5px] leading-[1.45] text-[#17262b]/80">
            That reads as{" "}
            {offCategory.category === "sport_or_hobby"
              ? "a sport or hobby"
              : offCategory.category === "small_business"
                ? "a business idea"
                : "something we can't place yet"}
            . We&rsquo;ve only built the job-search side so far. That one&rsquo;s
            coming.
          </p>
        </div>
      )}

      {error && <ErrorNote message={error} onRetry={go} />}

      <div className="flex-1" />

      <button type="button" className="ss-btn mb-[14px]" disabled={!text.trim()} onClick={go}>
        Next
      </button>
    </Screen>
  );
}
