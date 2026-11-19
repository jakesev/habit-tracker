/**
 * Daily goals counted from what you log: push-ups are "20 reps today", hit whenever,
 * in as many sets as you like. Extra reps beyond the target count as extra.
 */
import type { Day, DayBlock, LogEntry } from "./types";

export interface Goal {
  target: number;
  unit: string;
  /** Log titles that count toward it, e.g. ["push-ups", "pushups"]. */
  match: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export const countsToward = (l: Pick<LogEntry, "title">, g: Goal) => g.match.some((m) => norm(m) === norm(l.title));

/** Reps logged today toward a goal block. */
export function goalProgress(day: Day | undefined, b: DayBlock): number {
  if (!b.goal || !day?.logs) return 0;
  return day.logs.filter((l) => countsToward(l, b.goal!)).reduce((a, l) => a + (l.count ?? 0), 0);
}

/** The time (minutes) the target was reached, or null. */
export function goalReachedAt(day: Day | undefined, b: DayBlock): number | null {
  if (!b.goal || !day?.logs) return null;
  let sum = 0;
  for (const l of [...day.logs].sort((x, y) => x.at - y.at)) {
    if (!countsToward(l, b.goal)) continue;
    sum += l.count ?? 0;
    if (sum >= b.goal.target) return l.at;
  }
  return null;
}

/** Is a log one of the day's goals (not an extra)? */
export const isGoalLog = (day: Day | undefined, l: LogEntry) => !!day?.blocks.some((b) => b.goal && countsToward(l, b.goal));

/** "20 of 20 reps · +20 extra" style progress text. */
export function goalText(day: Day | undefined, b: DayBlock): string {
  if (!b.goal) return "";
  const p = goalProgress(day, b);
  const { target, unit } = b.goal;
  if (p >= target) return p > target ? `${p} ${unit} today · +${p - target} extra` : `${p} of ${target} ${unit}`;
  return `${p} of ${target} ${unit}`;
}

/** Pace for a run or walk, e.g. "7:29/km". */
export function pace(km?: number, minutes?: number): string | null {
  if (!km || !minutes || km <= 0) return null;
  const secPerKm = Math.round((minutes * 60) / km);
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, "0")}/km`;
}
