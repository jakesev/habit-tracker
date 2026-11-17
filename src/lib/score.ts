import { addDays, diffDays, weekStart } from "./time";
import type { Day, DayBlock, DateKey, Settings } from "./types";

/** Blocks that count toward the day: excused skips are removed from the total. */
export const countable = (b: DayBlock) => !b.excused && b.category !== "event";

/** 0–1 credit for a block: done = 1, partly done = share of the timer completed. */
export function blockCredit(b: DayBlock): number {
  if (b.status === "done") return 1;
  if (b.status === "partial") {
    const f = (b.focusedMinutes ?? 0) / Math.max(1, b.duration);
    return Math.max(0, Math.min(1, f));
  }
  return 0;
}

/** Average of the answered difficulty signals, 1–10. Defaults to 5 when none were answered. */
export function difficulty(b: DayBlock): number {
  const vals: number[] = [];
  if (b.resistance != null) vals.push(b.resistance);
  if (b.startDifficulty != null) vals.push(b.startDifficulty);
  if (b.energy != null) vals.push(11 - b.energy);
  if (!vals.length) return 5;
  return vals.reduce((a, v) => a + v, 0) / vals.length;
}

/** "Stayed hard": done when it was hard (difficulty 7+). */
export const stayedHard = (b: DayBlock) =>
  (b.status === "done" || b.status === "partial") && difficulty(b) >= 7;

/** Share of the day's planned minutes completed, 0–100. Null when nothing was planned. */
export function completion(day: Day | undefined): number | null {
  if (!day) return null;
  const blocks = day.blocks.filter(countable);
  const total = blocks.reduce((a, b) => a + b.duration, 0);
  if (!total) return null;
  const done = blocks.reduce((a, b) => a + b.duration * blockCredit(b), 0);
  return (done / total) * 100;
}

/**
 * Daily discipline score, 0–100.
 *   block points = weight × (1 + difficulty / 10)
 *   possible    = every countable block done at difficulty 5
 */
export function dailyScore(day: Day | undefined): number | null {
  if (!day) return null;
  const blocks = day.blocks.filter(countable);
  if (!blocks.length) return null;
  let earned = 0;
  let possible = 0;
  for (const b of blocks) {
    const w = b.priority;
    possible += w * 1.5;
    earned += w * (1 + difficulty(b) / 10) * blockCredit(b);
  }
  return Math.min(100, (earned / possible) * 100);
}

export type DayState = "streak" | "rest" | "miss" | "empty" | "open";

/**
 * streak – completion met the threshold
 * rest   – rest pass used
 * miss   – below threshold, day is over
 * empty  – nothing planned (neither breaks nor builds a chain)
 * open   – today, still in progress and below threshold (doesn't break the chain yet)
 */
export function dayState(day: Day | undefined, settings: Settings, isToday: boolean): DayState {
  if (day?.restPass) return "rest";
  const c = completion(day);
  if (c == null) return "empty";
  if (c >= (day?.standard ?? settings.streakThreshold) - 1e-9) return "streak";
  return isToday ? "open" : "miss";
}

/** Streak length ending at `date` (inclusive), walking back. Empty days are skipped over. */
export function streakEndingAt(
  days: Record<DateKey, Day>,
  date: DateKey,
  settings: Settings,
  today: DateKey,
  firstDay: DateKey,
): number {
  let n = 0;
  let k = date;
  while (diffDays(firstDay, k) >= 0) {
    const s = dayState(days[k], settings, k === today);
    if (s === "streak" || s === "rest") n++;
    else if (s === "miss") break;
    // empty / open: pass through without counting
    k = addDays(k, -1);
  }
  return n;
}

export function currentStreak(days: Record<DateKey, Day>, settings: Settings, today: DateKey, firstDay: DateKey) {
  return streakEndingAt(days, today, settings, today, firstDay);
}

export function longestStreak(days: Record<DateKey, Day>, settings: Settings, today: DateKey, firstDay: DateKey) {
  let best = 0;
  let run = 0;
  for (let k = firstDay; diffDays(k, today) >= 0; k = addDays(k, 1)) {
    const s = dayState(days[k], settings, k === today);
    if (s === "streak" || s === "rest") best = Math.max(best, ++run);
    else if (s === "miss") run = 0;
  }
  return best;
}

/** Glow tier for a chain length: 0 none, 1 = 3+, 2 = 7+, 3 = 14+, 4 = 30+, 5 = 60+. */
export function glowTier(chain: number): number {
  const steps = [3, 7, 14, 30, 60];
  let t = 0;
  for (const s of steps) if (chain >= s) t++;
  return t;
}

export function restPassesUsedInWeek(days: Record<DateKey, Day>, date: DateKey): number {
  const ws = weekStart(date);
  let n = 0;
  for (let i = 0; i < 7; i++) if (days[addDays(ws, i)]?.restPass) n++;
  return n;
}

export interface Level {
  name: string;
  min: number;
  max: number;
  next?: { name: string; at: number };
}

const DISCIPLINE_LEVELS = [
  { name: "Starting out", min: 0, max: 39 },
  { name: "Building", min: 40, max: 64 },
  { name: "Solid", min: 65, max: 84 },
  { name: "Elite", min: 85, max: 100 },
];
const PRODUCTIVITY_LEVELS = [
  { name: "Warming up", min: 0, max: 39 },
  { name: "Moving", min: 40, max: 64 },
  { name: "Productive", min: 65, max: 84 },
  { name: "Locked in", min: 85, max: 100 },
];

function levelFor(table: typeof DISCIPLINE_LEVELS, v: number): Level {
  const i = table.findIndex((l) => v <= l.max + 0.999);
  const idx = i < 0 ? table.length - 1 : i;
  const l = table[idx];
  const n = table[idx + 1];
  return { ...l, next: n ? { name: n.name, at: n.min } : undefined };
}
export const disciplineLevel = (v: number) => levelFor(DISCIPLINE_LEVELS, v);
export const productivityLevel = (v: number) => levelFor(PRODUCTIVITY_LEVELS, v);

/**
 * Discipline index = average daily score × consistency, over the last 30 days.
 * The window starts at the first tracked day, so day 1 is not punished for
 * 29 days that never existed. Today only counts once it has hit the streak bar.
 */
export function disciplineIndex(
  days: Record<DateKey, Day>,
  settings: Settings,
  today: DateKey,
  firstDay: DateKey,
  windowDays = 30,
) {
  let scoreSum = 0;
  let counted = 0;
  let streakDays = 0;
  let restDays = 0;
  for (let i = 0; i < windowDays; i++) {
    const k = addDays(today, -i);
    if (diffDays(firstDay, k) < 0) break;
    const s = dayState(days[k], settings, k === today);
    if (s === "empty" || s === "open") continue;
    counted++;
    if (s === "streak" || s === "rest") streakDays++;
    if (s === "rest") restDays++;
    else scoreSum += dailyScore(days[k]) ?? 0;
  }
  const scoredDays = counted - restDays;
  const avg = scoredDays > 0 ? scoreSum / scoredDays : 0;
  const consistency = counted ? streakDays / counted : 0;
  return { index: avg * consistency, avgScore: avg, consistency, days: counted };
}

/** Focused minutes for a block: timer minutes if timed, the planned length if just ticked. */
export function focusedMinutes(b: DayBlock): number {
  if (b.focusedMinutes != null) return b.focusedMinutes;
  if (b.status === "done") return b.duration;
  return 0;
}

/**
 * Productivity over a window: half planned minutes delivered, half planned blocks completed,
 * with a streak bonus of up to 1.2× at 30 days. 0–100.
 */
export function productivity(
  days: Record<DateKey, Day>,
  today: DateKey,
  firstDay: DateKey,
  streak: number,
  windowDays = 30,
) {
  let plannedMin = 0;
  let focusedMin = 0;
  let plannedBlocks = 0;
  let doneBlocks = 0;
  for (let i = 0; i < windowDays; i++) {
    const k = addDays(today, -i);
    if (diffDays(firstDay, k) < 0) break;
    const d = days[k];
    if (!d || d.restPass) continue;
    for (const b of d.blocks) {
      if (b.excused || b.category === "event") continue;
      // today's blocks that are still open don't count against you yet
      if (k === today && b.status === "planned") continue;
      plannedMin += b.duration;
      plannedBlocks++;
      focusedMin += Math.min(b.duration, focusedMinutes(b));
      doneBlocks += blockCredit(b);
    }
  }
  if (!plannedBlocks) return { score: 0, focusedMin: 0 };
  const base = ((focusedMin / plannedMin) * 0.5 + (doneBlocks / plannedBlocks) * 0.5) * 100;
  const bonus = 1 + Math.min(streak, 30) / 30 * 0.2;
  return { score: Math.min(100, base * bonus), focusedMin };
}

export function weekFocusedMinutes(days: Record<DateKey, Day>, today: DateKey): number {
  const ws = weekStart(today);
  let m = 0;
  for (let i = 0; i < 7; i++) {
    const d = days[addDays(ws, i)];
    if (!d) continue;
    for (const b of d.blocks) m += focusedMinutes(b);
  }
  return m;
}

/* ------------------------------------------------------------------ Standards: the bar rises with your level */

export interface Standard {
  level: string;
  /** Share of the day's plan needed for the day to count. */
  threshold: number;
  /** Rest passes per week. */
  passes: number;
  /** Discipline index where this level starts. */
  from: number;
}

export const STANDARDS: Standard[] = [
  { level: "Starting out", threshold: 70, passes: 2, from: 0 },
  { level: "Building", threshold: 80, passes: 1, from: 40 },
  { level: "Solid", threshold: 90, passes: 1, from: 65 },
  { level: "Elite", threshold: 100, passes: 1, from: 85 },
];

/**
 * Your standard right now, from your discipline index. No manual tweaking:
 * hold the line for weeks and the bar rises; slip and it eases back.
 */
export function currentStandard(days: Record<DateKey, Day>, settings: Settings, today: DateKey, firstDay: DateKey) {
  const { index } = disciplineIndex(days, settings, today, firstDay);
  const i = Math.max(0, STANDARDS.findIndex((s, k) => index >= s.from && (k === STANDARDS.length - 1 || index < STANDARDS[k + 1].from)));
  const cur = STANDARDS[i];
  const next = STANDARDS[i + 1];
  return { ...cur, index: i, disciplineIndex: index, next: next ? { ...next, gap: Math.max(1, Math.ceil(next.from - index)) } : undefined };
}
