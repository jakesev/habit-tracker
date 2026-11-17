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
import { addDays } from "./time";
import type { Day, DateKey } from "./types";

export const isNative = Capacitor.isNativePlatform();

/* ------------------------------------------------------------------ Launcher */

interface RoutineNativePlugin {
  setIdentity(o: { id: string }): Promise<void>;
  keepAwake(o: { on: boolean }): Promise<void>;
  setPlan(o: { json: string }): Promise<void>;
  takeActions(): Promise<{ json: string }>;
  test(): Promise<void>;
  snooze(o: { date: string; id: string; minutes: number }): Promise<void>;
  clearBlock(o: { date: string; id: string }): Promise<void>;
  focusShow(o: { title: string; endsAt: number; paused: boolean; remainingMs: number; accent: string }): Promise<void>;
  focusHide(): Promise<void>;
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
/*
 * The Android side schedules every reminder, alarm, "Up next" update and widget refresh
 * itself (PlanScheduler.java), from a compact copy of the plan we push here on each change.
 * Done / Snooze tapped on a notification or the widget is queued natively and applied by
 * applyNativeActions() when the app runs.
 */

export interface PlanPayload {
  v: 1;
  notify: boolean;
  upNext: boolean;
  accent: string;
  nudgeAt: number;
  days: { date: DateKey; blocks: { id: string; title: string; start: number; dur: number; status: string; cat: string; fixed: boolean; challenge: string | null; lead: number; alarm: boolean; timer: boolean }[] }[];
}

/** What the native side needs: today and tomorrow, without dropped blocks. Pure, so it's tested. */
export function buildPlanPayload(days: Record<DateKey, Day>, today: DateKey, opts: { notify: boolean; upNext: boolean; accent: string; nudgeAt?: number }): PlanPayload {
  return {
    v: 1,
    notify: opts.notify,
    upNext: opts.upNext,
    accent: opts.accent,
    nudgeAt: opts.nudgeAt ?? 20 * 60 + 30,
    days: [today, addDays(today, 1)]
      .filter((d) => days[d])
      .map((date) => ({
        date,
        blocks: days[date].blocks
          .filter((b) => !b.dropped)
          .map((b) => ({
            id: b.id,
            title: b.title,
            start: b.start,
            dur: b.duration,
            status: b.status,
            cat: b.category,
            fixed: b.type === "fixed",
            challenge: b.challenge ?? null,
            lead: b.reminderLead,
            alarm: !!b.alarm && b.category !== "event",
            timer: b.category === "skill" || b.category === "reading",
          })),
      })),
  };
}

let lastSig = "";
let cleaned = false;

/** Hand the plan to Android, which schedules everything from it. */
export async function pushPlan(payload: PlanPayload) {
  if (!isNative) return;
  const json = JSON.stringify(payload);
  if (json === lastSig) return;
  lastSig = json;
  if (!cleaned) {
    cleaned = true;
    // Older builds scheduled block reminders through the notifications plugin: clear those once.
    try {
      const pending = await LocalNotifications.getPending();
      const old = pending.notifications.filter((n) => n.id !== FOCUS_ID);
      if (old.length) await LocalNotifications.cancel({ notifications: old.map((n) => ({ id: n.id })) });
      await LocalNotifications.deleteChannel({ id: "blocks" }).catch(() => {});
      await LocalNotifications.deleteChannel({ id: "plan" }).catch(() => {});
    } catch {
      /* ignore */
    }
  }
  try {
    await RoutineNative.setPlan({ json });
  } catch {
    lastSig = "";
  }
}

/** Done taps from notifications and the widget, oldest first. */
export async function takeNativeActions(): Promise<{ type: string; date: DateKey; id: string; at: number }[]> {
  if (!isNative) return [];
  try {
    const { json } = await RoutineNative.takeActions();
    return JSON.parse(json || "[]");
  } catch {
    return [];
  }
}

export function snoozeNative(date: DateKey, id: string, minutes: number) {
  if (isNative) RoutineNative.snooze({ date, id, minutes }).catch(() => {});
}

export function clearBlockNotifications(date: DateKey, id: string) {
  if (isNative) RoutineNative.clearBlock({ date, id }).catch(() => {});
}

/** The running focus timer as a live countdown in the notification shade. */
export function showFocusNotification(o: { title: string; endsAt: number; paused: boolean; remainingMs: number; accent: string }) {
  if (isNative) RoutineNative.focusShow(o).catch(() => {});
}
export function hideFocusNotification() {
  if (isNative) RoutineNative.focusHide().catch(() => {});
}

export async function notificationsAllowed(): Promise<boolean> {
  if (!isNative) return false;
  try {
    return (await LocalNotifications.checkPermissions()).display === "granted";
  } catch {
    return false;
  }
}

/** Ask once to show notifications. On-the-minute timing is allowed by the app itself (no settings detour). */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNative) return false;
  const p = await LocalNotifications.requestPermissions();
  return p.display === "granted";
}

/** A sample reminder right now, so you can see what they look like. */
export async function sendTestReminder(): Promise<boolean> {
  if (!isNative) return false;
  await RoutineNative.test();
  return true;
}

const FOCUS_ID = 777_001;
const CHANNEL = "focus_end";
let channelReady = false;

async function ensureChannels() {
  if (channelReady) return;
  await LocalNotifications.createChannel({ id: CHANNEL, name: "Focus timer ends", description: "When a focus timer runs out", importance: 5, vibration: true, visibility: 1 });
  channelReady = true;
}

async function canExact(): Promise<boolean> {
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted";
  } catch {
    return true;
  }
}

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
