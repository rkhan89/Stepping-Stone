"use client";

import { useRef, useState } from "react";
import { ErrorNote, Working } from "./ui";
import { useRun } from "@/lib/session";
import { buildContext } from "@/lib/context";
import type { Cv, CvGuide, CvInterview } from "@/lib/schemas";

type Mode =
  | "choose"
  | "paste"
  | "interview"
  | "guide"
  | "guide_paste"
  | "working"
  | "done";

const FLOWCV = "https://flowcv.com/";

export function CvBuilder({ onDone }: { onDone: (cv: Cv) => void }) {
  const { run, update } = useRun();
  const [mode, setMode] = useState<Mode>(run.cv ? "done" : "choose");
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  /** Upload is the default; the text box is there for anyone who'd rather. */
  const [typing, setTyping] = useState(false);
  const [interview, setInterview] = useState<CvInterview | null>(null);
  const [material, setMaterial] = useState<Record<string, string>>({});
  const [guide, setGuide] = useState<CvGuide | null>(null);
  const [workingLines, setWorkingLines] = useState<string[]>([]);

  // They already said whether they have a CV. Don't ask twice.
  const hasExisting = run.answers.cv_status !== "cv_none";

  async function call<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "That didn't work.");
    return json as T;
  }

  /** Same endpoint, multipart, so the file never becomes a string on the way. */
  async function callWithFile<T>(url: string, payload: unknown, file: File): Promise<T> {
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("file", file);
    const res = await fetch(url, { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "That didn't work.");
    return json as T;
  }

  async function startWriteForMe() {
    setError(null);
    if (hasExisting) {
      setMode("paste");
      return;
    }
    setWorkingLines(["Working out what we need to ask you."]);
    setMode("working");
    try {
      setInterview(await call<CvInterview>("/api/cv/interview", buildContext(run)));
      setMode("interview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMode("choose");
    }
  }

  async function startGuideMe() {
    setError(null);
    setWorkingLines(["Working out what you specifically need to change."]);
    setMode("working");
    try {
      setGuide(await call<CvGuide>("/api/cv/guide", buildContext(run)));
      setMode("guide");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMode("choose");
    }
  }

  async function writeCv(
    payload:
      | { mode: "rewrite"; existingCv: string }
      | { mode: "rewrite"; file: File }
      | { mode: "build" },
  ) {
    setError(null);
    const uploading = "file" in payload;
    setWorkingLines(
      uploading
        ? ["Reading your CV.", "Then rewriting it. This takes a minute."]
        : ["Writing it properly.", "This takes a minute. It's checking every line."],
    );
    const previous = mode;
    setMode("working");
    try {
      const body = {
        ...buildContext(run),
        mode: payload.mode,
        existingCv: "existingCv" in payload ? payload.existingCv : undefined,
        material:
          payload.mode === "build" && interview
            ? interview.questions.map((q) => ({
                question: q.label,
                answer: material[q.id] ?? "",
              }))
            : undefined,
      };
      const cv = uploading
        ? await callWithFile<Cv>("/api/cv/write", body, payload.file)
        : await call<Cv>("/api/cv/write", body);
      update({ cv });
      onDone(cv);
      setMode("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMode(previous);
    }
  }

  if (mode === "working") return <Working lines={workingLines} />;

  if (mode === "done" && run.cv) {
    return <CvSheet cv={run.cv} onRedo={() => setMode("choose")} />;
  }

  return (
    <div className="mt-4 border-t border-[#17262b]/[.14] pt-4">
      {mode === "choose" && (
        <div className="ss-rise">
          <div className="t-hand text-[18px] leading-[1.3] text-[#1f4fd8]">
            You don&rsquo;t have to do this bit on your own.
          </div>
          <div className="mt-3 flex flex-col gap-[10px]">
            <button type="button" className="ss-btn text-[16.5px]" onClick={startWriteForMe}>
              Write it for me
            </button>
            <div className="px-1 text-[14px] leading-[1.45] text-[#17262b]/55">
              {hasExisting
                ? "Upload the CV you've got. We rewrite it for where you're going. Your facts, better told."
                : "We ask you a handful of things, then write it. Takes a few minutes because it's worth getting right."}
            </div>
            <button
              type="button"
              onClick={startGuideMe}
              className="rounded-lg border-[1.5px] border-[#17262b]/25 bg-[#fbfbf7] px-4 py-[14px] text-[16.5px] font-semibold text-[#17262b] hover:border-[#1f4fd8]"
            >
              I&rsquo;ll do it myself, guide me
            </button>
            <div className="px-1 text-[14px] leading-[1.45] text-[#17262b]/55">
              We tell you exactly what to change, and where to build it.
            </div>
          </div>
        </div>
      )}

      {mode === "paste" && (
        <div className="ss-rise">
          <div className="t-legend">Send us the CV you&rsquo;ve got</div>
          <p className="mt-2 text-[14.5px] leading-[1.45] text-[#17262b]/60">
            We keep every fact and change how it&rsquo;s told.
          </p>
          <div className="mt-3">
            <DropZone
              hint="Whatever you last sent someone. It doesn't need tidying up first."
              onFile={(file) => writeCv({ mode: "rewrite", file })}
            />
          </div>
          {error && <ErrorNote message={error} />}
          <button
            type="button"
            onClick={() => setTyping((t) => !t)}
            className="t-hand mt-3 block w-full text-center text-[17px] text-[#1f4fd8]"
          >
            {typing ? "Hide the text box" : "Haven't got the file? Type it instead"}
          </button>
          {typing && (
            <div className="ss-rise">
              <textarea
                rows={8}
                autoFocus
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Name, jobs, dates, the lot."
                className="ss-field mt-2 p-4 text-[15px]"
              />
              <button
                type="button"
                className="ss-btn mt-3 text-[16.5px]"
                disabled={pasted.trim().length < 80}
                onClick={() => writeCv({ mode: "rewrite", existingCv: pasted })}
              >
                {pasted.trim().length < 80 ? "A bit more than that" : "Rewrite it"}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="t-hand mt-3 block w-full text-center text-[17px] text-[#1f4fd8]"
          >
            Back
          </button>
        </div>
      )}

      {mode === "interview" && interview && (
        <div className="ss-rise">
          <div className="t-hand text-[19px] leading-[1.3] text-[#1f4fd8]">
            {interview.questions.length} questions. {interview.intro}
          </div>
          {interview.questions.map((q, i) => (
            <div key={q.id} className="mt-5">
              <div className="t-legend">
                {String(i + 1).padStart(2, "0")} · {q.label}
              </div>
              <div className="t-hand mt-1 text-[16px] text-[#1f4fd8]">{q.why}</div>
              <textarea
                rows={3}
                value={material[q.id] ?? ""}
                onChange={(e) =>
                  setMaterial((m) => ({ ...m, [q.id]: e.target.value }))
                }
                placeholder={q.placeholder}
                className="ss-field mt-2 p-[14px] text-[15.5px]"
              />
            </div>
          ))}
          {error && <ErrorNote message={error} />}
          <button
            type="button"
            className="ss-btn mt-5 text-[16.5px]"
            disabled={
              interview.questions.filter((q) => (material[q.id] ?? "").trim()).length <
              Math.ceil(interview.questions.length / 2)
            }
            onClick={() => writeCv({ mode: "build" })}
          >
            Write my CV
          </button>
          <div className="mt-2 text-center text-[13.5px] text-[#17262b]/50">
            Answer what you can. Anything you skip, we&rsquo;ll flag rather than make up.
          </div>
        </div>
      )}

      {mode === "guide" && guide && (
        <div className="ss-rise">
          <div className="t-display text-[22px] leading-[1.15]">{guide.intro}</div>
          <div className="mt-4 flex flex-col gap-3">
            {guide.moves.map((m, i) => (
              <div
                key={i}
                className="rounded-[9px] border-[1.5px] border-[#17262b]/[.16] bg-[#fbfbf7] p-[14px]"
              >
                <div className="flex gap-3">
                  <span className="t-kicker mt-[3px]">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="text-[16px] font-semibold leading-[1.3]">{m.do}</div>
                    <p className="mt-1 text-[14.5px] leading-[1.45] text-[#17262b]/70">
                      {m.detail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <a
            href={FLOWCV}
            target="_blank"
            rel="noopener noreferrer"
            className="ss-btn mt-4 text-[16.5px]"
          >
            Build it on flowcv.com
          </a>
          <div className="t-hand mt-3 text-[17px] leading-[1.35] text-[#1f4fd8]">
            {guide.toolTip}
          </div>
          <button
            type="button"
            onClick={() => setMode("guide_paste")}
            className="mt-4 w-full rounded-lg border-[1.5px] border-[#17262b]/25 bg-[#fbfbf7] px-4 py-[13px] text-[15.5px] font-semibold hover:border-[#1f4fd8]"
          >
            Done it, upload it here
          </button>
          <div className="mt-2 text-center text-[13.5px] leading-[1.45] text-[#17262b]/55">
            So the next steps can read it and find you actual roles.
          </div>
          <button
            type="button"
            onClick={() => setMode("choose")}
            className="t-hand mt-3 block w-full text-center text-[17px] text-[#1f4fd8]"
          >
            Back
          </button>
        </div>
      )}

      {mode === "guide_paste" && (
        <div className="ss-rise">
          <div className="t-legend">Upload what you built</div>
          <p className="mt-2 text-[14.5px] leading-[1.45] text-[#17262b]/60">
            Download it from flowcv and drop the PDF straight in. We read it so the next
            steps can target real roles.
          </p>
          <div className="mt-3">
            <DropZone
              hint="The PDF you just downloaded."
              onFile={(file) => writeCv({ mode: "rewrite", file })}
            />
          </div>
          {error && <ErrorNote message={error} />}
          <button
            type="button"
            onClick={() => setTyping((t) => !t)}
            className="t-hand mt-3 block w-full text-center text-[17px] text-[#1f4fd8]"
          >
            {typing ? "Hide the text box" : "Rather paste the text? Do that instead"}
          </button>
          {typing && (
            <div className="ss-rise">
              <textarea
                rows={8}
                autoFocus
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Paste the CV you just built."
                className="ss-field mt-2 p-4 text-[15px]"
              />
              <button
                type="button"
                className="ss-btn mt-3 text-[16.5px]"
                disabled={pasted.trim().length < 80}
                onClick={() => writeCv({ mode: "rewrite", existingCv: pasted })}
              >
                Save it and carry on
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMode("guide")}
            className="t-hand mt-3 block w-full text-center text-[17px] text-[#1f4fd8]"
          >
            Back
          </button>
        </div>
      )}

      {error && mode === "choose" && <ErrorNote message={error} />}
    </div>
  );
}

const ACCEPT = ".pdf,.docx,.txt,.md,application/pdf,text/plain";

/**
 * Drop a file or pick one. Uploading is the normal way to hand over a CV;
 * pasting is the fallback for anyone who'd rather.
 */
function DropZone({
  onFile,
  hint,
}: {
  onFile: (f: File) => void;
  hint: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className="rounded-[10px] border-2 border-dashed p-5 text-center transition-colors"
      style={{
        borderColor: over ? "#1f4fd8" : "rgba(23,38,43,.28)",
        background: over ? "rgba(31,79,216,.06)" : "#fbfbf7",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="ss-btn text-[16px]"
        style={{ padding: "14px 18px" }}
      >
        Choose a file
      </button>
      <div className="mt-[10px] text-[14px] leading-[1.45] text-[#17262b]/60">
        {hint}
      </div>
      <div className="t-hand mt-1 text-[16px] text-[#1f4fd8]">
        Or drag it in. PDF, Word or plain text.
      </div>
    </div>
  );
}

/** The finished CV, in copyable blocks. flowcv does the formatting. */
function CvSheet({ cv, onRedo }: { cv: Cv; onRedo: () => void }) {
  const [copied, setCopied] = useState(false);

  const plain = [
    cv.fullName,
    cv.headlineTitle,
    cv.contactLine,
    "",
    "PROFILE",
    cv.profile,
    "",
    "EXPERIENCE",
    ...cv.roles.flatMap((r) => [
      `${r.title}, ${r.company}, ${r.location} (${r.dates})`,
      ...r.bullets.map((b) => `• ${b}`),
      "",
    ]),
    "SKILLS",
    ...cv.skills.map((s) => `${s.category}: ${s.items.join(", ")}`),
    "",
    "EDUCATION",
    ...cv.education,
  ].join("\n");

  return (
    <div className="ss-rise mt-4 border-t border-[#17262b]/[.14] pt-4">
      <div className="t-hand text-[18px] text-[#1f4fd8]">
        That&rsquo;s your CV. Every fact is yours. We only changed how it&rsquo;s told.
      </div>

      <div className="mt-3 rounded-[9px] border-[1.5px] border-[#17262b]/[.16] bg-[#fbfbf7] p-4">
        <div className="text-[17px] font-bold leading-[1.2]">{cv.fullName}</div>
        <div className="text-[15px] font-semibold text-[#1f4fd8]">{cv.headlineTitle}</div>
        <div className="mt-1 text-[13.5px] text-[#17262b]/60">{cv.contactLine}</div>

        <div className="t-kicker mt-4">Profile</div>
        <p className="mt-1 text-[14.5px] leading-[1.5]">{cv.profile}</p>

        <div className="t-kicker mt-4">Experience</div>
        {cv.roles.map((r, i) => (
          <div key={i} className="mt-2">
            <div className="text-[14.5px] font-semibold leading-[1.3]">
              {r.title}, {r.company}
            </div>
            <div className="text-[13px] text-[#17262b]/55">
              {r.location} · {r.dates}
            </div>
            <ul className="mt-1 list-disc pl-5">
              {r.bullets.map((b, bi) => (
                <li key={bi} className="text-[14px] leading-[1.45] text-[#17262b]/80">
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="t-kicker mt-4">Skills</div>
        {cv.skills.map((s, i) => (
          <div key={i} className="mt-1 text-[14px] leading-[1.45]">
            <span className="font-semibold">{s.category}:</span> {s.items.join(", ")}
          </div>
        ))}

        {cv.education.length > 0 && (
          <>
            <div className="t-kicker mt-4">Education</div>
            {cv.education.map((e, i) => (
              <div key={i} className="mt-1 text-[14px] leading-[1.45]">
                {e}
              </div>
            ))}
          </>
        )}
      </div>

      {cv.gaps.length > 0 && (
        <div className="mt-3 rounded-[9px] border-[1.5px] border-[#b03a1a]/35 bg-[#fbfbf7] p-4">
          <div className="text-[14px] font-bold uppercase tracking-[.08em] text-[#b03a1a]">
            Go and find these
          </div>
          <p className="mt-1 text-[13.5px] leading-[1.45] text-[#17262b]/70">
            We left these blank rather than invent them.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {cv.gaps.map((g, i) => (
              <li key={i} className="text-[14px] leading-[1.45] text-[#17262b]/85">
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="ss-btn mt-3 text-[16px]"
        onClick={() => {
          navigator.clipboard?.writeText(plain).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            },
            () => setCopied(false),
          );
        }}
      >
        {copied ? "Copied" : "Copy the whole thing"}
      </button>
      <a
        href={FLOWCV}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-[10px] block w-full rounded-lg border-[1.5px] border-[#17262b]/25 bg-[#fbfbf7] px-4 py-[13px] text-center text-[15.5px] font-semibold hover:border-[#1f4fd8]"
      >
        Paste it into flowcv.com
      </a>
      <div className="mt-2 text-center text-[13.5px] leading-[1.45] text-[#17262b]/55">
        Free, and the templates get through CV scanners. We wrote the words; it does
        the layout.
      </div>
      <button
        type="button"
        onClick={onRedo}
        className="t-hand mt-3 block w-full text-center text-[17px] text-[#1f4fd8]"
      >
        Start it again
      </button>
    </div>
  );
}
