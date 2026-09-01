/** Shared shapes and date maths for logged applications. */

export const APPLICATION_STATUSES = [
  "applied",
  "followed_up",
  "replied",
  "interview",
  "rejected",
  /** Silence. The commonest outcome, so it is a real state and not a blank. */
  "ghosted",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type Application = {
  id: string;
  company: string;
  roleTitle: string;
  url: string | null;
  source: string | null;
  appliedOn: string;
  status: ApplicationStatus;
  followUpDue: string | null;
  followedUpOn: string | null;
  outcomeNote: string | null;
};

/** Nothing more to chase once one of these is set. */
export const CLOSED_STATUSES: ApplicationStatus[] = [
  "replied",
  "interview",
  "rejected",
  "ghosted",
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  followed_up: "Followed up",
  replied: "They replied",
  interview: "Interview",
  rejected: "Rejected",
  ghosted: "Heard nothing",
};

export const FOLLOW_UP_WORKING_DAYS = 5;

/**
 * Five working days, not five days. Applying on a Thursday should not have you
 * chasing on the Tuesday, and a weekend nudge gets ignored anyway.
 */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

/** YYYY-MM-DD, which is what a Postgres `date` wants and what inputs emit. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function followUpDateFor(appliedOn: string): string {
  const base = new Date(`${appliedOn}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return appliedOn;
  return isoDate(addWorkingDays(base, FOLLOW_UP_WORKING_DAYS));
}

/** Applications that are still waiting and whose follow-up date has passed. */
export function dueNow(apps: Application[], today = isoDate(new Date())) {
  return apps.filter(
    (a) => a.status === "applied" && a.followUpDue !== null && a.followUpDue <= today,
  );
}

/** Waiting, but not yet due. Shown so the wait feels accounted for. */
export function waiting(apps: Application[], today = isoDate(new Date())) {
  return apps.filter(
    (a) => a.status === "applied" && (a.followUpDue === null || a.followUpDue > today),
  );
}

export function daysBetween(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** "3 days ago", "today". Used everywhere a date would read as noise. */
export function relativeDay(date: string, today = isoDate(new Date())): string {
  const n = daysBetween(date, today);
  if (n === 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 0) return `in ${Math.abs(n)} days`;
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.floor(n / 7)} weeks ago`;
  return `${Math.floor(n / 30)} months ago`;
}
