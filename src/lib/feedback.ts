import { useStore } from "../store/store";
import { nativeHaptic } from "./native";

/** Haptics: native on the Android app; navigator.vibrate in Android browsers; iOS browsers have none, so sound + motion carry it. */
export function haptic(kind: "tap" | "success" | "hard" | "alarm" = "tap") {
  if (!useStore.getState().settings.haptics) return;
  if (nativeHaptic(kind)) return;
  const pattern = { tap: 8, success: [12, 40, 18], hard: [30, 60, 30, 60, 60], alarm: [200, 120, 200, 120, 400] }[kind];
  try {
    navigator.vibrate?.(pattern as number | number[]);
  } catch {
    /* unsupported */
  }
}

let ctx: AudioContext | null = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq: number, at: number, dur: number, gain = 0.08, type: OscillatorType = "sine") {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = a.currentTime + at;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function sound(kind: "tick" | "hard" | "alarm" | "soft") {
  if (!useStore.getState().settings.sound) return;
  try {
    if (kind === "tick") {
      tone(880, 0, 0.12, 0.06);
      tone(1320, 0.06, 0.18, 0.05);
    } else if (kind === "hard") {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.4, 0.06, "triangle"));
    } else if (kind === "alarm") {
      [0, 0.35, 0.7].forEach((t) => {
        tone(988, t, 0.22, 0.09, "triangle");
        tone(1318, t + 0.11, 0.22, 0.07, "triangle");
      });
    } else {
      tone(660, 0, 0.2, 0.05);
    }
  } catch {
    /* audio blocked */
  }
}

/** Unlock audio on the first gesture (iOS needs this). */
export function primeAudio() {
  try {
    audio();
  } catch {
    /* ignore */
  }
}

export async function notify(title: string, body: string, tag?: string) {
  if (!useStore.getState().settings.notifications) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) await reg.showNotification(title, { body, tag, icon: "./icon-192.png", badge: "./icon-192.png" });
    else new Notification(title, { body, tag });
  } catch {
    try {
      new Notification(title, { body, tag });
    } catch {
      /* ignore */
    }
  }
}
