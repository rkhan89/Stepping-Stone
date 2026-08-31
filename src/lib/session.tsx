"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

const RunContext = createContext<{
  run: Run;
  /** False until sessionStorage has been read. Don't redirect before this. */
  hydrated: boolean;
  /**
   * Pass a function whenever the patch derives from current state — two clicks
   * in the same tick would otherwise both read a stale `run` and one would win.
   */
  update: (patch: Partial<Run> | ((prev: Run) => Partial<Run>)) => void;
  reset: () => void;
} | null>(null);

export function RunProvider({ children }: { children: React.ReactNode }) {
  // One piece of state, so restoring costs exactly one extra render on mount.
  const [{ run, hydrated }, setState] = useState<{
    run: Run;
    hydrated: boolean;
  }>({ run: EMPTY, hydrated: false });

  // Read storage in an effect, not in a useState initialiser: the server has no
  // sessionStorage, so initialising from it would render different markup on
  // the client and trip a hydration mismatch. One cascading render is the
  // cheaper trade.
  useEffect(() => {
    let restored = EMPTY;
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) restored = { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      // A blocked or corrupt store just means we start fresh.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ run: restored, hydrated: true });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(run));
    } catch {
      // Out of quota or blocked — the in-memory copy still works.
    }
  }, [run, hydrated]);

  return (
    <RunContext.Provider
      value={{
        run,
        hydrated,
        update: (patch) =>
          setState((prev) => ({
            ...prev,
            run: {
              ...prev.run,
              ...(typeof patch === "function" ? patch(prev.run) : patch),
            },
          })),
        reset: () => {
          setState((prev) => ({ ...prev, run: EMPTY }));
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
