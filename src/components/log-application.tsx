"use client";

import { useState } from "react";
import { ErrorNote } from "./ui";
import { isoDate } from "@/lib/applications";
import type { Application } from "@/lib/applications";
import type { ParsedJob } from "@/lib/job-page";

/**
 * Logging has to be nearly free or nobody does it, and the whole feature rests
 * on people logging. So: paste a link, we read the page, they confirm.
 */
export function LogApplication({
  onLogged,
  onCancel,
}: {
  onLogged: (a: Application) => void;
  onCancel?: () => void;
}) {
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [appliedOn, setAppliedOn] = useState(isoDate(new Date()));
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [via, setVia] = useState<ParsedJob["via"] | null>(null);

  async function readLink() {
    const link = url.trim();
    if (!link) return;
    setReading(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const { parsed } = (await res.json()) as { parsed: ParsedJob };
      if (parsed.company) setCompany(parsed.company);
      if (parsed.roleTitle) setRoleTitle(parsed.roleTitle);
      setVia(parsed.via);
    } catch {
      setVia("url-only");
    } finally {
      setReading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company: company.trim(),
          roleTitle: roleTitle.trim(),
          url: url.trim() || null,
          appliedOn,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't save that.");
      onLogged(body.application as Application);
      setUrl("");
      setCompany("");
      setRoleTitle("");
      setVia(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const ready = company.trim() && roleTitle.trim();

  return (
    <div className="ss-rise rounded-[10px] border-2 border-[#17262b] bg-[#fbfbf7] p-5">
      <div className="t-kicker">Log what you applied for</div>
      <h2 className="t-display mt-2 text-[22px] leading-[1.16]">
        Paste the link and we&rsquo;ll fill the rest in
      </h2>

      <div className="mt-4 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={readLink}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              readLink();
            }
          }}
          placeholder="Paste the job advert link"
          className="ss-field flex-1 p-[13px] text-[15px]"
          inputMode="url"
        />
        <button
          type="button"
          onClick={readLink}
          disabled={!url.trim() || reading}
          className="ss-btn w-auto flex-none px-4 text-[15px]"
          style={{ padding: "13px 16px" }}
        >
          {reading ? "Reading" : "Read"}
        </button>
      </div>

      {via && (
        <div className="t-hand mt-2 text-[17px] text-[#1f4fd8]">
          {via === "structured-data"
            ? "Got it off the page. Check it's right."
            : via === "open-graph" || via === "title-tag"
              ? "Best guess from the page title. Worth a check."
              : "That site won't let us read it. Fill these in yourself."}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <div className="t-legend">Company</div>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Who you applied to"
            className="ss-field mt-[6px] p-[13px] text-[16px]"
          />
        </div>
        <div>
          <div className="t-legend">Role</div>
          <input
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="The title on the advert"
            className="ss-field mt-[6px] p-[13px] text-[16px]"
          />
        </div>
        <div>
          <div className="t-legend">When you applied</div>
          <input
            type="date"
            value={appliedOn}
            max={isoDate(new Date())}
            onChange={(e) => setAppliedOn(e.target.value)}
            className="ss-field mt-[6px] p-[13px] text-[16px]"
          />
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      <button
        type="button"
        onClick={save}
        disabled={!ready || saving}
        className="ss-btn mt-4 text-[16px]"
        style={{ padding: "15px 18px" }}
      >
        {saving ? "Saving" : "Log it"}
      </button>
      <div className="mt-2 text-center text-[13.5px] leading-[1.45] text-[#17262b]/55">
        We&rsquo;ll chase you about this in five working days.
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="t-hand mt-3 block w-full text-center text-[17px] text-[#1f4fd8]"
        >
          Not now
        </button>
      )}
    </div>
  );
}
