/**
 * The hand-drawn marks. One per screen, pointing at the single thing that
 * matters. Paths lifted from the design handoff — don't tidy them up, the
 * wobble is the point.
 */

export function UnderlineDouble({ className }: { className?: string }) {
  return (
    <svg
      width="128"
      height="16"
      viewBox="0 0 128 16"
      className={className}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <path
        d="M3 9c21-5 46-7 72-6 20 1 37 3 51 6"
        fill="none"
        stroke="#1f4fd8"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d="M11 14c25-3 53-4 82-2"
        fill="none"
        stroke="#1f4fd8"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity=".45"
      />
    </svg>
  );
}

/** Curved arrow pointing down-left, at the box to type in. */
export function ArrowToBox({ className }: { className?: string }) {
  return (
    <svg
      width="86"
      height="52"
      viewBox="0 0 86 52"
      className={className}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <path
        d="M78 3C70 22 52 34 30 39"
        fill="none"
        stroke="#1f4fd8"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        d="M40 30c-6 4-9 7-11 10M28 40c4 1 8 3 11 5"
        fill="none"
        stroke="#1f4fd8"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The lasso round the free-text box — the bit that changes the plan. */
export function CircleAround({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 330 150"
      preserveAspectRatio="none"
      className={className}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <path
        d="M166 8C88 6 16 22 10 62c-6 42 62 74 158 76 92 2 152-26 152-70C320 32 268 12 190 7"
        fill="none"
        stroke="#1f4fd8"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity=".85"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Ring round a detail on the live step — a number, a link. */
export function RingInline({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block self-start px-3 pb-2 pt-[7px]">
      <svg
        viewBox="0 0 220 60"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ overflow: "visible" }}
        aria-hidden
      >
        <path
          d="M112 5C58 3 10 12 6 30c-4 17 44 27 106 27 58 0 102-11 102-27C214 14 168 5 118 4"
          fill="none"
          stroke="#1f4fd8"
          strokeWidth="2.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

export function Check({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.81}
      viewBox="0 0 16 13"
      aria-hidden
    >
      <path
        d="M2 7l4 4 8-9"
        fill="none"
        stroke="#1f4fd8"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
