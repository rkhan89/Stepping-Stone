"use client";

import { Check } from "./marks";

/**
 * The phone-shaped column the whole app lives in. Ledger paper edge to edge on
 * a phone; a page on a desk on anything wider.
 */
export function Screen({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-screen justify-center bg-[#cfd4c8] sm:py-8">
      <div
        className={`ledger relative flex w-full max-w-[402px] flex-col px-[30px] pb-10 pt-14 sm:rounded-[26px] sm:shadow-[0_18px_40px_rgba(23,38,43,.22)] ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-baseline gap-[9px]">
      <div className="h-[13px] w-[13px] rounded-[3px] bg-[#1f4fd8]" />
      <div className="t-hand text-[19px] leading-none font-bold">Stepping Stone</div>
    </div>
  );
}

export function TickBox({
  checked,
  size = 22,
  strong = false,
}: {
  checked: boolean;
  size?: number;
  strong?: boolean;
}) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-[5px]"
      style={{
        width: size,
        height: size,
        border: `${strong ? 2.5 : 2}px solid ${strong ? "#17262b" : "rgba(23,38,43,.55)"}`,
        background: strong ? "#fff" : "transparent",
      }}
    >
      {checked && <Check size={size * 0.73} />}
    </span>
  );
}

export function OptionRow({
  label,
  picked,
  onPick,
}: {
  label: string;
  picked: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={picked}
      data-picked={picked}
      className="ss-option"
      onClick={onPick}
    >
      <TickBox checked={picked} strong />
      <span>{label}</span>
    </button>
  );
}

/** The pause while Claude works. Says what it's doing, in the app's voice. */
export function Working({ lines }: { lines: string[] }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-3">
      <div className="t-display text-[30px]">{lines[0]}</div>
      {lines.slice(1).map((l) => (
        <div key={l} className="t-hand text-[19px] text-[#1f4fd8]">
          {l}
        </div>
      ))}
      <div className="mt-4 flex gap-[6px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[9px] w-[9px] rounded-full bg-[#1f4fd8]"
            style={{
              animation: `ss-pulse 1s ${i * 0.16}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
      <style>{`@keyframes ss-pulse{0%,100%{opacity:.25}50%{opacity:1}}`}</style>
    </div>
  );
}

export function ErrorNote({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mt-5 rounded-lg border-[1.5px] border-[#b03a1a]/40 bg-[#fbfbf7] p-4">
      <p className="text-[15.5px] leading-[1.4] text-[#b03a1a]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="t-hand mt-2 text-[18px] text-[#1f4fd8] underline"
        >
          Try that again
        </button>
      )}
    </div>
  );
}
