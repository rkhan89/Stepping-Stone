"use client";

import Link from "next/link";
import { useRun } from "@/lib/session";

/**
 * The return path. Without this the whole "tick it off, come back for the next
 * one" promise has no door back in.
 */
export function ResumeBanner() {
  const { run, hydrated } = useRun();

  if (!hydrated || !run.outline) return null;

  const total = run.outline.outline.length;
  const done = run.outcomes.length;

  return (
    <Link
      href={done >= total ? "/plan" : "/plan"}
      className="ss-rise mt-6 block rounded-[10px] border-2 border-[#17262b] bg-[#fbfbf7] p-4 no-underline"
      style={{ boxShadow: "4px 4px 0 rgba(31,79,216,.24)" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="t-kicker">Your plan, still here</div>
        <div className="text-[13px] font-semibold text-[#17262b]/50">
          {done}/{total}
        </div>
      </div>
      <div className="t-display mt-[6px] text-[20px] leading-[1.15] text-[#17262b]">
        {run.outline.goalLabel}
      </div>
      <div className="t-hand mt-1 text-[17px] text-[#1f4fd8]">
        {done === 0
          ? "Step one is waiting for you."
          : done >= total
            ? "All done. Come and tell us how it went."
            : `Step ${done + 1} is ready.`}
      </div>
    </Link>
  );
}
