"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ErrorNote, Screen, Working } from "@/components/ui";
import { LogApplication } from "@/components/log-application";
import { ApplicationCard } from "@/components/application-card";
import { useRun } from "@/lib/session";
import {
  CLOSED_STATUSES,
  dueNow,
  waiting,
  type Application,
} from "@/lib/applications";

const MIN_FOR_PATTERN = 4;

type Pattern = {
  verdict: string;
  evidence: string[];
  change: string;
  confidence: "low" | "medium" | "high";
};

export default function ApplicationsScreen() {
  const { run } = useRun();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [logging, setLogging] = useState(false);
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/applications");
        const body = await res.json();
        if (!cancelled) setApps(body.applications ?? []);
      } catch {
        if (!cancelled) setApps([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upsert = useCallback((a: Application) => {
    setApps((prev) =>
      prev ? [a, ...prev.filter((x) => x.id !== a.id)] : [a],
    );
    // Any change invalidates the read: it was drawn from the old set.
    setPattern(null);
  }, []);

  const remove = useCallback((id: string) => {
    setApps((prev) => (prev ? prev.filter((x) => x.id !== id) : prev));
    setPattern(null);
  }, []);

  async function readPattern() {
    if (!apps) return;
    setReading(true);
    setError(null);
    try {
      const res = await fetch("/api/pattern", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applications: apps, cv: run.cv, input: run.input }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't read the pattern.");
      setPattern(body as Pattern);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setReading(false);
    }
  }

  if (apps === null) {
    return (
      <Screen className="pt-[70px]">
        <Working lines={["Getting your applications."]} />
      </Screen>
    );
  }

  const due = dueNow(apps);
  const stillWaiting = waiting(apps);
  const done = apps.filter((a) => CLOSED_STATUSES.includes(a.status));
  const followedUp = apps.filter((a) => a.status === "followed_up");

  return (
    <Screen className="px-6 pb-10 pt-[70px]">
      <div className="flex items-baseline justify-between">
        <Link href="/plan" className="t-hand text-[17px] text-[#1f4fd8] no-underline">
          &lsaquo; Your plan
        </Link>
        <div className="text-[14px] font-semibold text-[#17262b]/50">
          {apps.length} logged
        </div>
      </div>

      <h1 className="t-display mt-[10px] text-[30px] leading-[1.1]">
        {due.length > 0
          ? due.length === 1
            ? "One to chase today."
            : `${due.length} to chase today.`
          : apps.length === 0
            ? "Nothing logged yet."
            : "Nothing due today."}
      </h1>

      {apps.length === 0 && !logging && (
        <p className="mt-3 text-[16px] leading-[1.5] text-[#17262b]/80">
          Apply wherever you normally do. Log it here and we&rsquo;ll make sure you
          chase it, rather than letting it go quiet.
        </p>
      )}

      {!logging && (
        <button
          type="button"
          onClick={() => setLogging(true)}
          className="ss-btn mt-5 text-[16.5px]"
        >
          Log an application
        </button>
      )}

      {logging && (
        <div className="mt-5">
          <LogApplication
            onLogged={(a) => {
              upsert(a);
              setLogging(false);
            }}
            onCancel={() => setLogging(false)}
          />
        </div>
      )}

      {due.length > 0 && (
        <section className="mt-8">
          <div className="t-legend">Due now</div>
          <div className="mt-3 flex flex-col gap-3">
            {due.map((a) => (
              <ApplicationCard
                key={a.id}
                application={a}
                due
                onChange={upsert}
                onRemove={remove}
              />
            ))}
          </div>
        </section>
      )}

      {stillWaiting.length > 0 && (
        <section className="mt-8">
          <div className="t-legend">Waiting</div>
          <div className="mt-3 flex flex-col gap-3">
            {stillWaiting.map((a) => (
              <ApplicationCard
                key={a.id}
                application={a}
                due={false}
                onChange={upsert}
                onRemove={remove}
              />
            ))}
          </div>
        </section>
      )}

      {followedUp.length > 0 && (
        <section className="mt-8">
          <div className="t-legend">Chased, still nothing</div>
          <div className="mt-3 flex flex-col gap-3">
            {followedUp.map((a) => (
              <ApplicationCard
                key={a.id}
                application={a}
                due={false}
                onChange={upsert}
                onRemove={remove}
              />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-8">
          <div className="t-legend">Closed</div>
          <div className="mt-3 flex flex-col gap-3">
            {done.map((a) => (
              <ApplicationCard
                key={a.id}
                application={a}
                due={false}
                onChange={upsert}
                onRemove={remove}
              />
            ))}
          </div>
        </section>
      )}

      {/* The bit a spreadsheet cannot do. */}
      <section className="mt-10 border-t border-[#17262b]/[.16] pt-6">
        <div className="t-legend">What&rsquo;s the pattern?</div>
        {apps.length < MIN_FOR_PATTERN ? (
          <p className="mt-2 text-[15px] leading-[1.5] text-[#17262b]/65">
            Log {MIN_FOR_PATTERN - apps.length} more and we&rsquo;ll tell you what
            your applications have in common, and what to change. Below that there
            isn&rsquo;t a pattern, only noise.
          </p>
        ) : !pattern ? (
          <>
            <p className="mt-2 text-[15px] leading-[1.5] text-[#17262b]/65">
              We&rsquo;ll read your {apps.length} applications against your CV and
              say what&rsquo;s actually going wrong.
            </p>
            <button
              type="button"
              onClick={readPattern}
              disabled={reading}
              className="ss-btn mt-3 text-[16px]"
              style={{ padding: "15px 18px" }}
            >
              {reading ? "Reading them" : "Tell me what's going wrong"}
            </button>
          </>
        ) : (
          <div
            className="ss-rise mt-3 rounded-[10px] border-2 border-[#17262b] bg-[#fbfbf7] p-5"
            style={{ boxShadow: "5px 5px 0 rgba(31,79,216,.28)" }}
          >
            <h2 className="t-display text-[23px] leading-[1.16]">{pattern.verdict}</h2>
            {pattern.evidence.length > 0 && (
              <ul className="mt-3 flex flex-col gap-[7px]">
                {pattern.evidence.map((e, i) => (
                  <li key={i} className="flex gap-[10px] text-[15px] leading-[1.35]">
                    <span className="mt-[7px] h-[6px] w-[6px] flex-none rounded-full bg-[#1f4fd8]" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-[#17262b]/[.14] pt-3">
              <div className="t-kicker">Do this next</div>
              <p className="mt-[6px] text-[16px] leading-[1.5]">{pattern.change}</p>
            </div>
            <div className="mt-3 text-[13px] text-[#17262b]/50">
              Confidence: {pattern.confidence}
              {pattern.confidence === "low" &&
                " — not much to go on yet, so treat this as a hunch."}
            </div>
          </div>
        )}
        {error && <ErrorNote message={error} onRetry={readPattern} />}
      </section>
    </Screen>
  );
}
