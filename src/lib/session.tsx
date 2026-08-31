"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type {
  Classification,
  Cv,
  GeneratedQuestions,
  Outcome,
  Outline,
  Step,
} from "./schemas";

/**
 * Everything the run needs, held in memory and mirrored to sessionStorage so a
 * refresh mid-flow doesn't dump you back at the start. No database yet — when
 * the tab closes, the run is gone. That's deliberate for now.
 */
export type Run = {
  input: string;
  classification: Classification | null;
  questions: GeneratedQuestions | null;
  answers: Record<string, string>;
  freeText: Record<string, string>;
  notes: string;
  /** The arc: titles and intent only. Prose is written per step, on reveal. */
  outline: Outline | null;
  /** Steps written so far, index-aligned with outline. Sparse by design. */
  steps: (Step | null)[];
  /** What each finished step turned into. Drives what the next one becomes. */
  outcomes: Outcome[];
  /** The artifact the rest of the plan reads. */
  cv: Cv | null;
};

const EMPTY: Run = {
  input: "",
  classification: null,
  questions: null,
  answers: {},
  freeText: {},
  notes: "",
  outline: null,
  steps: [],
  outcomes: [],
  cv: null,
};

const KEY = "stepping-stone-run";
/** Long enough that typing in a textarea is one write, short enough to feel safe. */
const SAVE_DEBOUNCE_MS = 1200;

const RunContext = createContext<{
  run: Run;
  /** False until the stored run has been fetched. Don't redirect before this. */
  hydrated: boolean;
  /** True when the run is on the server rather than only in this tab. */
  persisted: boolean;
  /**
   * Pass a function whenever the patch derives from current state — two clicks
   * in the same tick would otherwise both read a stale `run` and one would win.
   */
  update: (patch: Partial<Run> | ((prev: Run) => Partial<Run>)) => void;
  /** Forget this run locally and start again. Does not delete server-side. */
  reset: () => void;
  /** Delete everything held for this browser, for real. */
  forgetMe: () => Promise<void>;
} | null>(null);

export function RunProvider({ children }: { children: React.ReactNode }) {
  // One piece of state, so restoring costs exactly one extra render on mount.
  const [{ run, hydrated, persisted }, setState] = useState<{
    run: Run;
    hydrated: boolean;
    persisted: boolean;
  }>({ run: EMPTY, hydrated: false, persisted: false });

  /** Server row id. A ref, so changing it never triggers a save loop. */
  const runId = useRef<string | null>(null);
  /** Skips the save that would otherwise fire immediately after loading. */
  const dirty = useRef(false);

  // Load in an effect, not in a useState initialiser: the server has no
  // sessionStorage and no fetch result at render time, so initialising from
  // either would trip a hydration mismatch.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // sessionStorage first, so a reload paints instantly instead of waiting
      // on the network. The server copy wins if it has one.
      let restored = EMPTY;
      try {
        const raw = sessionStorage.getItem(KEY);
        if (raw) restored = { ...EMPTY, ...JSON.parse(raw) };
      } catch {
        // A blocked or corrupt store just means we start fresh.
      }

      let onServer = false;
      try {
        const res = await fetch("/api/run");
        const body = await res.json();
        onServer = !!body.persisted;
        if (body.run) {
          runId.current = body.run.id;
          restored = { ...EMPTY, ...body.run.state };
        }
      } catch {
        // No database, or it is down. Carry on with whatever the tab had.
      }

      if (!cancelled) {
        setState({ run: restored, hydrated: true, persisted: onServer });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror to sessionStorage on every change, and to the server on a debounce.
  useEffect(() => {
    if (!hydrated) return;

    try {
      sessionStorage.setItem(KEY, JSON.stringify(run));
    } catch {
      // Out of quota or blocked — the in-memory copy still works.
    }

    // Nothing has been edited since load, so there is nothing worth writing.
    if (!dirty.current) return;

    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/run", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: runId.current, state: run }),
        });
        const body = await res.json();
        if (body.id) runId.current = body.id;
      } catch {
        // Losing a save is survivable; the next edit retries the whole run.
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [run, hydrated]);

  return (
    <RunContext.Provider
      value={{
        run,
        hydrated,
        persisted,
        update: (patch) => {
          dirty.current = true;
          setState((prev) => ({
            ...prev,
            run: {
              ...prev.run,
              ...(typeof patch === "function" ? patch(prev.run) : patch),
            },
          }));
        },
        reset: () => {
          runId.current = null;
          dirty.current = false;
          setState((prev) => ({ ...prev, run: EMPTY }));
          try {
            sessionStorage.removeItem(KEY);
          } catch {}
        },
        forgetMe: async () => {
          try {
            await fetch("/api/run", { method: "DELETE" });
          } catch {
            // Nothing useful to do; the local copy still goes.
          }
          runId.current = null;
          dirty.current = false;
          setState({ run: EMPTY, hydrated: true, persisted: false });
          try {
            sessionStorage.removeItem(KEY);
          } catch {}
        },
      }}
    >
      {children}
    </RunContext.Provider>
  );
}

export function useRun() {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error("useRun must be used inside RunProvider");
  return ctx;
}
