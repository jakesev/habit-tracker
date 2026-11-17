/**
 * Pure mapping between the app's blocks and Google Calendar events.
 * No network here, so it can be tested on its own.
 */
import { STEP } from "./time";
import type { Category, DateKey, DayBlock } from "./types";

export const APP_TAG = "shugyo";

/** Minimal shape of a Google Calendar event we read or write. */
export interface GEvent {
  id?: string;
  summary?: string;
  description?: string;
  status?: string;
  transparency?: string;
  colorId?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
  extendedProperties?: { private?: Record<string, string> };
}

/**
 * Google event ids allow only base32hex characters (0-9, a-v), 5–1024 long.
 * Deterministic per date + block, so re-syncing updates instead of duplicating.
 */
export function eventId(date: DateKey, blockId: string): string {
  const src = `${APP_TAG}|${date}|${blockId}`;
  let out = "";
  for (const ch of new TextEncoder().encode(src)) out += ch.toString(32).padStart(2, "0");
  return out.slice(0, 1000);
}

// Google's event colour ids, picked to sit close to the app's category colours.
const COLOR: Record<Category, string> = {
  skill: "9", // blueberry
  reading: "1", // lavender
  family: "4", // flamingo
  chore: "5", // banana
  anchor: "8", // graphite
  event: "7", // peacock
  body: "2", // sage
};

const pad = (n: number) => String(n).padStart(2, "0");
/** Local wall-clock time for a date + minutes, as Google expects with a timeZone beside it. */
export const localDateTime = (date: DateKey, min: number) => {
  const d = Math.floor(min / 1440);
  const m = min % 1440;
  const day = d ? new Date(new Date(`${date}T00:00:00`).getTime() + d * 86_400_000).toISOString().slice(0, 10) : date;
  return `${day}T${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`;
};

const STATUS_MARK: Partial<Record<DayBlock["status"], string>> = { done: "✓ ", partial: "◐ ", skipped: "– ", missed: "✕ " };

/** A block as it appears in your "Shugyo" Google calendar. */
export function blockToEvent(date: DateKey, b: DayBlock, timeZone: string): GEvent {
  const lines = [
    b.subtitle,
    b.status === "planned" ? undefined : `Status: ${b.status}${b.excused ? " (excused)" : ""}`,
    b.focusedMinutes ? `Focused: ${b.focusedMinutes} min` : undefined,
    b.note ? `Note: ${b.note}` : undefined,
  ].filter(Boolean);
  return {
    id: eventId(date, b.id),
    summary: `${STATUS_MARK[b.status] ?? ""}${b.title}`,
    description: lines.join("\n"),
    colorId: COLOR[b.category],
    transparency: "opaque",
    start: { dateTime: localDateTime(date, b.start), timeZone },
    end: { dateTime: localDateTime(date, b.start + b.duration), timeZone },
    extendedProperties: { private: { app: APP_TAG, date, blockId: b.id } },
  };
}

/** Minutes since local midnight of `date` for an RFC3339 time (handles events crossing midnight). */
export function minutesOn(date: DateKey, rfc: string): number {
  const base = new Date(`${date}T00:00:00`).getTime();
  return Math.round((new Date(rfc).getTime() - base) / 60_000);
}

/**
 * An event from your other calendars, read as busy time on `date`.
 * Snapped outward to the 15-minute grid. All-day, free, cancelled and declined events are skipped.
 */
export function eventToBusyBlock(date: DateKey, e: GEvent, calendarName?: string): DayBlock | null {
  if (e.status === "cancelled" || e.transparency === "transparent") return null;
  if (!e.start?.dateTime || !e.end?.dateTime) return null; // all-day
  if (e.extendedProperties?.private?.app === APP_TAG) return null; // our own blocks
  if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) return null;
  let start = minutesOn(date, e.start.dateTime);
  let end = minutesOn(date, e.end.dateTime);
  start = Math.max(0, Math.floor(start / STEP) * STEP);
  end = Math.min(24 * 60, Math.ceil(end / STEP) * STEP);
  if (end <= start) return null;
  return {
    id: `gcal-${e.id}`,
    templateId: "gcal",
    title: e.summary?.trim() || "Busy",
    subtitle: calendarName ? `From ${calendarName}` : "From Google Calendar",
    category: "event",
    type: "fixed",
    priority: 3,
    start,
    duration: end - start,
    minDuration: end - start,
    status: "planned",
    reminderLead: 10,
  };
}

/** Replace a day's Google busy blocks with a fresh read, leaving everything else alone. */
export function mergeBusy(blocks: DayBlock[], busy: DayBlock[]): DayBlock[] {
  const keep = blocks.filter((b) => b.templateId !== "gcal");
  return [...keep, ...busy].sort((a, b) => a.start - b.start);
}
