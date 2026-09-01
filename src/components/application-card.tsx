"use client";

import { useState } from "react";
import { ErrorNote, TickBox } from "./ui";
import { useRun } from "@/lib/session";
import {
  CLOSED_STATUSES,
  STATUS_LABELS,
  relativeDay,
  type Application,
  type ApplicationStatus,
} from "@/lib/applications";

type Draft = { subject: string; body: string; note: string };

const OUTCOMES: ApplicationStatus[] = ["replied", "interview", "rejected", "ghosted"];

/**
 * One logged application. When it is due a chase, this is where the drafted
 * message appears, because a nudge that makes you go and write something is
 * not a nudge.
 */
export function ApplicationCard({
  application,
  due,
  onChange,
  onRemove,
}: {
  application: Application;
  due: boolean;
  onChange: (a: Application) => void;
  onRemove: (id: string) => void;
}) {
  const { run } = useRun();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reporting, setReporting] = useState(false);

  const closed = CLOSED_STATUSES.includes(application.status);

  async function patch(status: ApplicationStatus) {
    setError(null);
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't update that.");
      onChange(body.application as Application);
      setReporting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function writeFollowUp() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: application.company,
          roleTitle: application.roleTitle,
          appliedOn: application.appliedOn,
          url: application.url,
          cv: run.cv,
          input: run.input,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't draft that.");
      setDraft(body as Draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div
      className={`rounded-[10px] border bg-[#fbfbf7] p-4 ${
        due ? "border-2 border-[#17262b]" : "border-[1.5px] border-[#17262b]/[.16]"
      }`}
      style={due ? { boxShadow: "4px 4px 0 rgba(31,79,216,.24)" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[16px] font-bold leading-[1.25]">
            {application.roleTitle}
          </div>
          <div className="text-[14.5px] leading-[1.3] text-[#17262b]/70">
            {application.company}
          </div>
        </div>
        <span
          className="flex-none rounded-full px-[9px] py-[3px] text-[11px] font-bold uppercase tracking-[.06em]"
          style={{
            background: closed ? "rgba(23,38,43,.07)" : "rgba(31,79,216,.10)",
            color: closed ? "rgba(23,38,43,.55)" : "#1f4fd8",
          }}
        >
          {STATUS_LABELS[application.status]}
        </span>
      </div>

      <div className="mt-[6px] text-[13.5px] text-[#17262b]/55">
        Applied {relativeDay(application.appliedOn)}
        {application.url && (
          <>
            {" · "}
            <a
              href={application.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1f4fd8] underline decoration-[#1f4fd8]/40"
            >
              the advert
            </a>
          </>
        )}
      </div>

      {due && !draft && (
        <div className="mt-3 border-t border-[#17262b]/[.14] pt-3">
          <div className="t-hand text-[17px] leading-[1.3] text-[#1f4fd8]">
            Five working days, no reply. Time to chase.
          </div>
          <button
            type="button"
            onClick={writeFollowUp}
            disabled={drafting}
            className="ss-btn mt-2 text-[15px]"
            style={{ padding: "13px 16px" }}
          >
            {drafting ? "Writing it" : "Write the message for me"}
          </button>
        </div>
      )}

      {draft && (
        <div className="ss-rise mt-3 border-t border-[#17262b]/[.14] pt-3">
          <div className="t-legend">Ready to send</div>
          <div className="mt-2 rounded-[8px] bg-[#e8e9e0] p-3">
            <div className="text-[13px] font-bold">{draft.subject}</div>
            <div className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.5] text-[#17262b]/85">
              {draft.body}
            </div>
          </div>
          <div className="t-hand mt-2 text-[16.5px] text-[#1f4fd8]">{draft.note}</div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(`${draft.subject}\n\n${draft.body}`)
                  .then(
                    () => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    },
                    () => setCopied(false),
                  );
              }}
              className="ss-btn flex-1 text-[15px]"
              style={{ padding: "13px 14px" }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => patch("followed_up")}
              className="flex-1 rounded-lg border-[1.5px] border-[#17262b]/25 bg-[#fbfbf7] px-3 py-[13px] text-[15px] font-semibold hover:border-[#1f4fd8]"
            >
              Sent it
            </button>
          </div>
        </div>
      )}

      {error && <ErrorNote message={error} />}

      {!closed && (
        <div className="mt-3 border-t border-[#17262b]/[.14] pt-3">
          {!reporting ? (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="t-hand text-[17px] text-[#1f4fd8]"
            >
              Something happened with this one
            </button>
          ) : (
            <div className="ss-rise">
              <div className="t-legend">What happened?</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {OUTCOMES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => patch(s)}
                    className="flex items-center gap-2 rounded-[7px] border-[1.5px] border-[#17262b]/[.16] bg-[#fbfbf7] px-3 py-2 text-[14.5px] font-medium hover:border-[#1f4fd8]"
                  >
                    <TickBox checked={false} size={16} />
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setReporting(false)}
                className="t-hand mt-2 text-[16px] text-[#17262b]/50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={async () => {
          if (!confirm(`Remove ${application.roleTitle} at ${application.company}?`)) return;
          await fetch(`/api/applications/${application.id}`, { method: "DELETE" });
          onRemove(application.id);
        }}
        className="mt-3 text-[13px] text-[#17262b]/40 underline"
      >
        Remove
      </button>
    </div>
  );
}
