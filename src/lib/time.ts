import type { DateKey, Min } from "./types";

export const STEP = 15;

/** Snap minutes to the 15-minute grid (nearest), never below 15 for durations. */
export const snap = (m: number) => Math.round(m / STEP) * STEP;
export const snapDuration = (m: number) => Math.max(STEP, snap(m));

export const hm = (h: number, m = 0): Min => h * 60 + m;

export function fmtTime(m: Min, opts: { suffix?: boolean } = {}): string {
  const suffix = opts.suffix ?? true;
  const h24 = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ap = h24 < 12 ? "am" : "pm";
  return `${h12}:${String(mm).padStart(2, "0")}${suffix ? ap : ""}`;
}

export function fmtRange(start: Min, duration: Min): string {
  const end = start + duration;
  const sameHalf = Math.floor(start / 720) === Math.floor(end / 720);
  return `${fmtTime(start, { suffix: !sameHalf })} – ${fmtTime(end)}`;
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function toKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(k: DateKey): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(k: DateKey, n: number): DateKey {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function diffDays(a: DateKey, b: DateKey): number {
  const ms = fromKey(b).getTime() - fromKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function nowMin(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export function todayKey(d = new Date()): DateKey {
  return toKey(d);
}

/** Monday of the week the date falls in (weeks run Mon–Sun). */
export function weekStart(k: DateKey): DateKey {
  const d = fromKey(k);
  const dow = (d.getDay() + 6) % 7;
  return addDays(k, -dow);
}

export const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function fmtDateLong(k: DateKey): string {
  const d = fromKey(k);
  return `${DOW_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
