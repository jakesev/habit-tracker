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

/* ------------------------------------------------------------------ Launcher identity */

interface RoutineNativePlugin {
  setIdentity(o: { id: string }): Promise<void>;
  getIdentity(): Promise<{ id: string }>;
  keepAwake(o: { on: boolean }): Promise<void>;
}
const RoutineNative = registerPlugin<RoutineNativePlugin>("RoutineNative");

/** Switch the home-screen icon and name (Android activity aliases). */
export async function setLauncherIdentity(id: string): Promise<boolean> {
  if (!isNative) return false;
  try {
    await RoutineNative.setIdentity({ id });
    return true;
  } catch {
    return false;
  }
}

export async function getLauncherIdentity(): Promise<string | null> {
  if (!isNative) return null;
  try {
    return (await RoutineNative.getIdentity()).id;
  } catch {
    return null;
  }
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

const CHANNEL = "blocks";
let channelReady = false;

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
  return true;
}

async function ensureChannel() {
  if (channelReady) return;
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: "Block reminders",
    description: "Before each block in your routine",
    importance: 5,
    vibration: true,
    visibility: 1,
  });
  channelReady = true;
}

/** Stable numeric id per date + block. */
function nid(date: DateKey, blockId: string, kind: number) {
  let h = kind;
  for (const c of date + blockId) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

let lastSig = "";

/**
 * Replace every scheduled reminder with the current plan for today and tomorrow.
 * Called whenever the plan changes (ticks, skips, "I'm home" re-plans, settings).
 */
export async function syncReminders(days: Record<DateKey, Day>, enabled: boolean, nudgeAt = 20 * 60 + 30) {
  if (!isNative) return;
  const today = todayKey();
  const now = Date.now();
  type N = { id: number; title: string; body: string; at: number };
  const list: N[] = [];
  if (enabled) {
    for (const date of [today, addDays(today, 1)]) {
      const day = days[date];
      if (!day) continue;
      const base = fromKey(date).getTime();
      const at = (min: number) => base + min * 60_000;
      for (const b of day.blocks) {
        if (b.status !== "planned") continue;
        const t = at(b.start - b.reminderLead);
        if (t > now)
          list.push({
            id: nid(date, b.id, 1),
            title: b.type === "fixed" ? `${b.title} in ${b.reminderLead} min` : `${b.title} in ${b.reminderLead} min`,
            body: b.type === "fixed" ? "Non-negotiable. Get up." : "You said you'd do it. Prove it.",
            at: t,
          });
      }
      const open = day.blocks.filter((b) => b.status === "planned" && b.start >= nudgeAt).length;
      if (open > 0 && at(nudgeAt) > now)
        list.push({ id: nid(date, "nudge", 2), title: `${open} block${open > 1 ? "s" : ""} still open`, body: "There's still time. Finish the day on your terms.", at: at(nudgeAt) });
    }
  }
  const sig = JSON.stringify(list);
  if (sig === lastSig) return;
  lastSig = sig;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    if (!list.length) return;
    await ensureChannel();
    await LocalNotifications.schedule({
      notifications: list.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        channelId: CHANNEL,
        smallIcon: "ic_stat_icon",
        schedule: { at: new Date(n.at), allowWhileIdle: true },
      })),
    });
  } catch {
    lastSig = "";
  }
}

/** A one-off alert, e.g. when the focus timer ends while the screen is off. */
export async function scheduleOnce(id: number, title: string, body: string, at: number) {
  if (!isNative) return;
  try {
    await ensureChannel();
    await LocalNotifications.cancel({ notifications: [{ id }] });
    if (at > Date.now())
      await LocalNotifications.schedule({
        notifications: [{ id, title, body, channelId: CHANNEL, smallIcon: "ic_stat_icon", schedule: { at: new Date(at), allowWhileIdle: true } }],
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
