/**
 * Everything that only exists inside the installed Android app.
 * On the web every function here is a safe no-op, so the same code runs in both.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Share } from "@capacitor/share";
import { addDays, fromKey, todayKey } from "./time";
import type { Day, DateKey } from "./types";

export const isNative = Capacitor.isNativePlatform();

/* ------------------------------------------------------------------ Launcher */

interface RoutineNativePlugin {
  setIdentity(o: { id: string }): Promise<void>;
  keepAwake(o: { on: boolean }): Promise<void>;
}
const RoutineNative = registerPlugin<RoutineNativePlugin>("RoutineNative");

/** Make sure the Shugyo launcher icon is the enabled one (older builds could switch it). */
export function ensureLauncher() {
  if (!isNative) return;
  RoutineNative.setIdentity({ id: "shugyo" }).catch(() => {});
}

/** Keep the screen on during a focus session (the WebView has no wake lock of its own). */
export function keepAwake(on: boolean): boolean {
  if (!isNative) return false;
  RoutineNative.keepAwake({ on }).catch(() => {});
  return true;
}

/* ------------------------------------------------------------------ Haptics */

export function nativeHaptic(kind: "tap" | "success" | "hard" | "alarm"): boolean {
  if (!isNative) return false;
  const run = async () => {
    if (kind === "tap") await Haptics.impact({ style: ImpactStyle.Light });
    else if (kind === "success") await Haptics.notification({ type: NotificationType.Success });
    else if (kind === "hard") {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      setTimeout(() => Haptics.impact({ style: ImpactStyle.Heavy }), 140);
      setTimeout(() => Haptics.notification({ type: NotificationType.Success }), 300);
    } else await Haptics.vibrate({ duration: 900 });
  };
  run().catch(() => {});
  return true;
}

/* ------------------------------------------------------------------ Reminders (fire even when the app is closed) */

const CHANNEL = "blocks"; // heads-up: pops on screen, sound + vibration
const PLAN_CHANNEL = "plan"; // the day's plan: quiet, sits in the shade
let channelsReady = false;
let exactAllowed: boolean | null = null;

async function ensureChannels() {
  if (channelsReady) return;
  await LocalNotifications.createChannel({ id: CHANNEL, name: "Block reminders", description: "A heads-up before each block, and when it starts", importance: 5, vibration: true, visibility: 1 });
  await LocalNotifications.createChannel({ id: PLAN_CHANNEL, name: "Today's plan", description: "What's coming up today", importance: 3, vibration: false, visibility: 1 });
  channelsReady = true;
}

/** Exact alarms make reminders land on the minute. Checked once, never nags. */
async function canExact(): Promise<boolean> {
  if (exactAllowed != null) return exactAllowed;
  try {
    exactAllowed = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted";
  } catch {
    exactAllowed = true; // Android 11 and older: always allowed
  }
  return exactAllowed;
}

export async function notificationsAllowed(): Promise<boolean> {
  if (!isNative) return false;
  try {
    return (await LocalNotifications.checkPermissions()).display === "granted";
  } catch {
    return false;
  }
}

/** Ask once: show notifications, then "Alarms & reminders" so they land on time. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative) return false;
  const p = await LocalNotifications.requestPermissions();
  if (p.display !== "granted") return false;
  try {
    const exact = await LocalNotifications.checkExactNotificationSetting();
    if (exact.exact_alarm !== "granted") await LocalNotifications.changeExactNotificationSetting();
  } catch {
    /* older Android: exact alarms allowed by default */
  }
  exactAllowed = null;
  return true;
}

/** Stable numeric id per date + block + kind. */
function nid(date: DateKey, blockId: string, kind: number) {
  let h = kind;
  for (const c of date + blockId) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % 1_900_000_000) + kind;
}

const fmt = (min: number) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};

type N = { id: number; title: string; body: string; at: number; channel: string; large?: string };

/** What should be scheduled for the plan as it stands. Pure, so it can be tested. */
export function plannedNotifications(days: Record<DateKey, Day>, now: number, today: DateKey, nudgeAt = 20 * 60 + 30): N[] {
  const list: N[] = [];
  for (const date of [today, addDays(today, 1)]) {
    const day = days[date];
    if (!day) continue;
    const base = fromKey(date).getTime();
    const at = (min: number) => base + min * 60_000;
    const live = day.blocks.filter((b) => b.status === "planned" && !b.dropped).sort((a, b) => a.start - b.start);

    // The plan, ahead of the first block: everything coming up, in one quiet notification.
    const first = live[0];
    if (first) {
      const when = at(Math.max(first.start - 60, 6 * 60));
      if (when > now)
        list.push({
          id: nid(date, "plan", 3),
          title: `Today: ${live.length} block${live.length > 1 ? "s" : ""}, first ${first.title} at ${fmt(first.start)}`,
          body: "Tap to see the plan.",
          large: live.map((b) => `${fmt(b.start)}  ${b.title}`).join("\n"),
          at: when,
          channel: PLAN_CHANNEL,
        });
    }

    live.forEach((b, i) => {
      const next = live[i + 1];
      const event = b.category === "event";
      // Heads-up before.
      const before = at(b.start - b.reminderLead);
      if (before > now)
        list.push({
          id: nid(date, b.id, 1),
          title: `${b.title} in ${b.reminderLead} min`,
          body: `${fmt(b.start)}–${fmt(b.start + b.duration)}. ${event ? "Get ready to go." : b.type === "fixed" ? "Non-negotiable. Get up." : "You said you'd do it. Prove it."}`,
          at: before,
          channel: CHANNEL,
        });
      // When it starts.
      const start = at(b.start);
      if (start > now)
        list.push({
          id: nid(date, b.id, 2),
          title: event ? `${b.title} · now` : `Now: ${b.title}${b.challenge ? ` (${b.challenge.toLowerCase()})` : ""}`,
          body: `Until ${fmt(b.start + b.duration)}.${next ? ` Next: ${next.title} at ${fmt(next.start)}.` : ""}`,
          at: start,
          channel: CHANNEL,
        });
    });

    const open = live.filter((b) => b.category !== "event" && b.start >= nudgeAt).length;
    if (open > 0 && at(nudgeAt) > now)
      list.push({ id: nid(date, "nudge", 4), title: `${open} block${open > 1 ? "s" : ""} still open`, body: "There's still time. Finish the day on your terms.", at: at(nudgeAt), channel: CHANNEL });
  }
  return list;
}

let lastSig = "";

/**
 * Replace every scheduled reminder with the current plan for today and tomorrow,
 * and clear reminders already showing for blocks that are done.
 * Called whenever the plan changes (ticks, skips, re-plans, settings).
 */
export async function syncReminders(days: Record<DateKey, Day>, enabled: boolean) {
  if (!isNative) return;
  const today = todayKey();
  const list = enabled ? plannedNotifications(days, Date.now(), today) : [];
  const sig = JSON.stringify(list);
  if (sig === lastSig) return;
  lastSig = sig;
  try {
    const pending = await LocalNotifications.getPending();
    const keep = new Set([FOCUS_ID]);
    const stale = pending.notifications.filter((n) => !keep.has(n.id));
    if (stale.length) await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) });

    // Done or skipped? Take its reminders out of the notification shade too.
    const finished = (days[today]?.blocks ?? []).filter((b) => b.status !== "planned").flatMap((b) => [nid(today, b.id, 1), nid(today, b.id, 2)]);
    if (finished.length) await LocalNotifications.removeDeliveredNotificationsById({ ids: finished }).catch(() => {});

    if (!list.length) return;
    await ensureChannels();
    const exact = await canExact();
    await LocalNotifications.schedule({
      notifications: list.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        largeBody: n.large,
        channelId: n.channel,
        smallIcon: "ic_stat_icon",
        group: "plan",
        isExactNotification: exact,
        schedule: { at: new Date(n.at), allowWhileIdle: true },
      })),
    });
  } catch {
    lastSig = "";
  }
}

/** A test reminder, five seconds from now, so you can see what they look like. */
export async function sendTestReminder(): Promise<boolean> {
  if (!isNative) return false;
  await ensureChannels();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 777_002,
        title: "Writing in 10 min",
        body: "6:15–6:45pm. You said you'd do it. Prove it.",
        channelId: CHANNEL,
        smallIcon: "ic_stat_icon",
        isExactNotification: false,
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      },
    ],
  });
  return true;
}

const FOCUS_ID = 777_001;

/** A one-off alert, e.g. when the focus timer ends while the screen is off. */
export async function scheduleOnce(id: number, title: string, body: string, at: number) {
  if (!isNative) return;
  try {
    await ensureChannels();
    await LocalNotifications.cancel({ notifications: [{ id }] });
    if (at > Date.now())
      await LocalNotifications.schedule({
        notifications: [{ id, title, body, channelId: CHANNEL, smallIcon: "ic_stat_icon", isExactNotification: await canExact(), schedule: { at: new Date(at), allowWhileIdle: true } }],
      });
  } catch {
    /* ignore */
  }
}
export async function cancelOnce(id: number) {
  if (!isNative) return;
  LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => {});
}

/* ------------------------------------------------------------------ App chrome */

export function setupNativeChrome(onBack: () => boolean, onLink: (url: string) => void) {
  if (!isNative) return;
  // Home-screen shortcuts ("I'm home") arrive as routine:// links.
  App.getLaunchUrl()
    .then((r) => r?.url && onLink(r.url))
    .catch(() => {});
  App.addListener("appUrlOpen", (e) => onLink(e.url));
  App.addListener("backButton", () => {
    if (!onBack()) App.minimizeApp().catch(() => {});
  });
}

/* ------------------------------------------------------------------ Backup */

/** Writes the backup and opens the share sheet (Drive, email, files…). */
export async function shareBackup(json: string, filename: string): Promise<boolean> {
  if (!isNative) return false;
  const res = await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: "Backup", files: [res.uri] });
  return true;
}
