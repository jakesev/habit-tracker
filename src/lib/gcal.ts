/**
 * Google Calendar sync.
 *  - Write: your blocks for today and tomorrow go into a calendar the app owns
 *    (named after the app, e.g. "Shugyo"), with ✓ when done. The app is the source of truth.
 *  - Read: events on your other calendars show up in the plan as busy time.
 *    Nothing re-plans on its own; you choose when to re-plan.
 */
import { addDays, todayKey } from "./time";
import { blockToEvent, eventToBusyBlock, type GEvent } from "./gcal-map";
import { googleAccessToken } from "./cloud";
import { APP } from "./identity";
import type { DateKey } from "./types";
import { useStore } from "../store/store";

const API = "https://www.googleapis.com/calendar/v3";
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

async function g<T = unknown>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const t = await googleAccessToken();
  const res = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  if (res.status === 401 && retry) {
    await googleAccessToken(true);
    return g(path, init, false);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw Object.assign(new Error(`Google Calendar ${res.status}: ${body.slice(0, 200)}`), { status: res.status });
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

async function ensureCalendar(): Promise<string> {
  const s = useStore.getState();
  const id = s.cloud.calendarId;
  if (id) {
    try {
      await g(`/calendars/${encodeURIComponent(id)}`);
      return id;
    } catch (e) {
      if ((e as { status?: number }).status !== 404) throw e;
    }
  }
  const name = APP.name;
  const cal = await g<{ id: string }>(`/calendars`, {
    method: "POST",
    body: JSON.stringify({ summary: name, description: `Your routine from the ${name} app. Edit blocks in the app; changes here are overwritten.`, timeZone: tz() }),
  });
  s.setCloud({ calendarId: cal.id });
  return cal.id;
}

const pushed = new Map<DateKey, string>();

/** Write today's and tomorrow's blocks into the app's calendar. Only changed events are sent. */
export async function pushBlocks() {
  const s = useStore.getState();
  if (!s.cloud.connected || !s.cloud.write) return;
  const cal = await ensureCalendar();
  const zone = tz();
  for (const date of [todayKey(), addDays(todayKey(), 1)]) {
    const day = useStore.getState().days[date];
    if (!day) continue;
    const blocks = day.blocks.filter((b) => b.templateId !== "gcal" && !b.dropped);
    const want = blocks.map((b) => blockToEvent(date, b, zone));
    const sig = JSON.stringify(want);
    if (pushed.get(date) === sig) continue;

    const q = new URLSearchParams({ privateExtendedProperty: `date=${date}`, maxResults: "250", showDeleted: "false" });
    const have = (await g<{ items: GEvent[] }>(`/calendars/${encodeURIComponent(cal)}/events?${q}`)).items ?? [];
    const byId = new Map(have.map((e) => [e.id!, e]));
    const base = `/calendars/${encodeURIComponent(cal)}/events`;

    for (const e of want) {
      const cur = byId.get(e.id!);
      byId.delete(e.id!);
      const same =
        cur && cur.summary === e.summary && cur.description === (e.description || undefined) && cur.colorId === e.colorId &&
        cur.start?.dateTime?.slice(0, 16) === e.start?.dateTime?.slice(0, 16) && cur.end?.dateTime?.slice(0, 16) === e.end?.dateTime?.slice(0, 16);
      if (same) continue;
      if (cur) await g(`${base}/${e.id}`, { method: "PUT", body: JSON.stringify(e) });
      else {
        try {
          await g(base, { method: "POST", body: JSON.stringify(e) });
        } catch (err) {
          // The id exists (e.g. deleted earlier): update it back instead.
          if ((err as { status?: number }).status === 409) await g(`${base}/${e.id}`, { method: "PUT", body: JSON.stringify({ ...e, status: "confirmed" }) });
          else throw err;
        }
      }
    }
    for (const stale of byId.values()) await g(`${base}/${stale.id}`, { method: "DELETE" }).catch(() => {});
    pushed.set(date, sig);
  }
}

/** Read your other calendars for today and tomorrow and show them as busy time. */
export async function pullBusy() {
  const s = useStore.getState();
  if (!s.cloud.connected || !s.cloud.read) return;
  const today = todayKey();
  const dates = [today, addDays(today, 1)];
  const timeMin = new Date(`${today}T00:00:00`).toISOString();
  const timeMax = new Date(`${addDays(today, 2)}T00:00:00`).toISOString();
  const list = await g<{ items: { id: string; summary?: string; selected?: boolean; hidden?: boolean }[] }>(`/users/me/calendarList?minAccessRole=reader`);
  const busy: Record<DateKey, ReturnType<typeof eventToBusyBlock>[]> = Object.fromEntries(dates.map((d) => [d, []]));
  for (const c of list.items ?? []) {
    if (c.id === s.cloud.calendarId || c.hidden || c.selected === false) continue;
    const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    const items = (await g<{ items: GEvent[] }>(`/calendars/${encodeURIComponent(c.id)}/events?${q}`)).items ?? [];
    for (const e of items) for (const d of dates) busy[d].push(eventToBusyBlock(d, e, c.summary));
  }
  for (const d of dates) useStore.getState().applyBusy(d, busy[d].filter((b): b is NonNullable<typeof b> => !!b));
}

let running: Promise<void> | null = null;

/** Full sync: read busy time, then write blocks. Safe to call often. */
export function syncCalendar(): Promise<void> {
  if (running) return running;
  running = (async () => {
    try {
      await pullBusy();
      await pushBlocks();
      useStore.getState().setCloud({ lastSync: Date.now(), error: undefined });
    } catch (e) {
      useStore.getState().setCloud({ error: e instanceof Error ? e.message : String(e) });
      throw e;
    } finally {
      running = null;
    }
  })();
  return running;
}
