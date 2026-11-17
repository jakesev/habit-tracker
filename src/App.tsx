import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Icon, Pressable, spring } from "./components/ui";
import { notify } from "./lib/feedback";
import { useApplyIdentity } from "./lib/identity";
import { handleAuthRedirect } from "./lib/cloud";
import { useCloud } from "./lib/useCloud";
import { isNative, setupNativeChrome, syncReminders } from "./lib/native";
import { fmtClock, nowMin, todayKey } from "./lib/time";
import { selectBlock, useStore } from "./store/store";
import { TABS, useUI, type Tab } from "./store/ui";
import { FocusScreen, useFocusWatcher } from "./screens/Focus";
import { Home } from "./screens/Home";
import { ArriveSheet } from "./screens/Arrive";
import { EditorSheet } from "./screens/Editor";
import { PlanMenu } from "./screens/PlanMenu";
import { BlockSheet, CheckInSheet, DaySheet, SkipSheet } from "./screens/Sheets";
import { Streak } from "./screens/Streak";
import { Today } from "./screens/Today";
import { You } from "./screens/You";

const SCREENS: Record<Tab, () => React.JSX.Element> = { home: Home, today: Today, streak: Streak, you: You };

export default function App() {
  const tab = useUI((s) => s.tab);
  const dir = useUI((s) => s.dir);
  const Screen = SCREENS[tab];
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useStore.getState().ensureDays();
    setupNativeChrome(handleBack, handleLink);
    // Keep the phone's scheduled reminders in step with the plan.
    let t: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const s = useStore.getState();
        syncReminders(s.days, s.settings.notifications);
      }, 400);
    };
    sync();
    return useStore.subscribe((s, prev) => {
      if (s.days !== prev.days || s.settings !== prev.settings) sync();
    });
  }, []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);
  useFocusWatcher();
  useReminders();
  useApplyIdentity();
  useCloud();

  return (
    <MotionConfig reducedMotion="user">
      <div className="backdrop" />
      <div ref={scroller} className="relative mx-auto h-full max-w-[520px] overflow-x-hidden overflow-y-auto no-scrollbar">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.main
            key={tab}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 48, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -48, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: "spring", stiffness: 420, damping: 40 }, opacity: { duration: 0.18 } }}
          >
            <Screen />
          </motion.main>
        </AnimatePresence>
      </div>
      <TimerPill />
      <TabBar />
      <DaySheet />
      <BlockSheet />
      <SkipSheet />
      <CheckInSheet />
      <ArriveSheet />
      <PlanMenu />
      <EditorSheet />
      <FocusScreen />
      <Toast />
    </MotionConfig>
  );
}

/** routine://im-home → open the "I'm home" re-plan on Today. */
function handleLink(url: string) {
  if (url.startsWith("routine://auth-callback")) {
    handleAuthRedirect(url).catch(() => useUI.getState().showToast("Sign-in didn't finish", "Try connecting again."));
    return;
  }
  if (url.includes("im-home")) {
    const ui = useUI.getState();
    ui.go("today");
    setTimeout(() => ui.openHome(true), 250);
  } else if (url.includes("today")) useUI.getState().go("today");
}

/** Android back button: close the top-most layer, then go Home, then leave the app. */
function handleBack(): boolean {
  const ui = useUI.getState();
  if (ui.focusSetup) return ui.open("focusSetup", null), true;
  if (ui.checkin) return ui.open("checkin", null), true;
  if (ui.skip) return ui.open("skip", null), true;
  if (ui.editor) return ui.openEditor(null), true;
  if (ui.menu) return ui.openMenu(false), true;
  if (ui.home) return ui.openHome(false), true;
  if (ui.block) return ui.open("block", null), true;
  if (ui.day) return ui.openDay(null), true;
  if (ui.tab !== "home") return ui.go("home"), true;
  return false;
}

/* ------------------------------------------------------------------ Tab bar */

const TAB_META: Record<Tab, { label: string; icon: string }> = {
  home: { label: "Home", icon: "home" },
  today: { label: "Today", icon: "today" },
  streak: { label: "Streak", icon: "flame" },
  you: { label: "You", icon: "user" },
};

function TabBar() {
  const tab = useUI((s) => s.tab);
  const go = useUI((s) => s.go);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[520px] px-4 pb-[calc(10px+var(--safe-bottom))]" aria-label="Main">
      <div className="pointer-events-none absolute inset-x-0 -top-10 bottom-0 bg-gradient-to-t from-bg via-bg/90 to-transparent" />
      <div className="relative flex rounded-[24px] border border-line bg-[#141417]/85 p-1.5 shadow-[0_20px_40px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl">
        {TABS.map((t) => {
          const on = t === tab;
          return (
            <Pressable
              key={t}
              scale={0.9}
              onClick={() => go(t)}
              aria-current={on ? "page" : undefined}
              className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] transition-colors duration-200 ${on ? "text-ink" : "text-faint"}`}
            >
              {on && <motion.span layoutId="tab-pill" transition={spring} className="absolute inset-0 rounded-[18px] bg-white/[0.07]" />}
              <span className={`relative ${on && t === "streak" ? "text-ember" : ""}`}>
                <Icon name={TAB_META[t].icon} size={22} stroke={on ? 2 : 1.7} fill={on && t === "streak"} />
              </span>
              <span className="relative text-[11px] font-medium">{TAB_META[t].label}</span>
            </Pressable>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ Timer pill (while minimised) */

function TimerPill() {
  const focus = useStore((s) => s.focus);
  const title = useStore((s) => (s.focus ? selectBlock(s, s.focus.date, s.focus.blockId)?.title : undefined));
  const showing = useUI((s) => !!s.focusSetup);
  const open = useUI((s) => s.open);
  const [, force] = useState(0);
  useEffect(() => {
    if (!focus) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [focus]);
  const rem = focus ? (focus.endsAt != null ? focus.endsAt - Date.now() : focus.pausedRemaining ?? 0) : 0;
  return (
    <AnimatePresence>
      {focus && !showing && (
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={spring}
          className="fixed inset-x-0 bottom-[calc(96px+var(--safe-bottom))] z-30 mx-auto flex max-w-[520px] justify-center px-4"
        >
          <Pressable
            onClick={() => open("focusSetup", { date: focus.date, id: focus.blockId })}
            className="flex h-12 items-center gap-3 rounded-full border border-ember/30 bg-[color-mix(in_oklab,var(--color-ember)_10%,#101012)]/95 pr-5 pl-4 shadow-[0_12px_30px_-8px_rgb(var(--ember-rgb)/0.45)] backdrop-blur-xl"
          >
            <span className="h-2 w-2 rounded-full bg-ember" style={{ animation: focus.endsAt ? "breathe 1.4s ease-in-out infinite" : undefined }} />
            <span className="max-w-[160px] truncate text-[14px] font-medium">{title}</span>
            <span className="num text-[15px] font-semibold text-ember-hi">{focus.endsAt == null ? "Paused" : fmtClock(rem)}</span>
          </Pressable>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ Toast */

function Toast() {
  const toast = useUI((s) => s.toast);
  const [shown, setShown] = useState(toast);
  useEffect(() => {
    setShown(toast);
    if (!toast) return;
    const t = setTimeout(() => setShown(null), toast.tone === "hard" ? 3800 : 2600);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(12px+var(--safe-top))] z-[70] flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            initial={{ y: -24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -16, opacity: 0, scale: 0.98 }}
            transition={spring}
            className={`max-w-[400px] rounded-[20px] border px-5 py-3.5 shadow-[0_20px_40px_-12px_rgb(0_0_0/0.9)] backdrop-blur-xl ${
              shown.tone === "hard" ? "border-ember/40 bg-[color-mix(in_oklab,var(--color-ember)_12%,#101012)]/95" : "border-line-strong bg-[#18181c]/95"
            }`}
          >
            <div className={`flex items-center gap-2 text-[15px] font-semibold ${shown.tone === "hard" ? "text-ember-hi" : ""}`}>
              {shown.tone === "hard" && <Icon name="bolt" size={16} fill stroke={0} />}
              {shown.title}
            </div>
            {shown.line && <div className="mt-0.5 text-[14px] text-mute">{shown.line}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ Reminders */

/**
 * In-app reminders: fire `reminderLead` minutes before each planned block,
 * plus an 8:30 PM nudge if blocks are still open. Works while the app is open
 * or backgrounded. Closed-app push needs a server and arrives in Phase 2.
 */
function useReminders() {
  useEffect(() => {
    if (isNative) return; // the Android app schedules these with the system instead
    const sent = new Set<string>(JSON.parse(sessionStorageSafe("stride-sent") ?? "[]"));
    const check = () => {
      const s = useStore.getState();
      if (!s.settings.notifications) return;
      const today = todayKey();
      const t = nowMin();
      for (const b of s.days[today]?.blocks ?? []) {
        if (b.status !== "planned") continue;
        const key = `${today}:${b.id}`;
        if (!sent.has(key) && t >= b.start - b.reminderLead && t < b.start) {
          sent.add(key);
          const firm = b.type === "fixed";
          notify(firm ? `${b.title} · ${Math.round(b.start - t)} min` : `${b.title} in ${Math.round(b.start - t)} min`, firm ? "Non-negotiable. Get up." : "You said you'd do it. Prove it.", key);
        }
      }
      const nudgeKey = `${today}:nudge`;
      const open = (s.days[today]?.blocks ?? []).filter((b) => b.status === "planned").length;
      if (!sent.has(nudgeKey) && t >= 20 * 60 + 30 && t < 21 * 60 && open > 0) {
        sent.add(nudgeKey);
        notify(`${open} block${open > 1 ? "s" : ""} still open`, "There's still time. Finish the day on your terms.", nudgeKey);
      }
      try {
        sessionStorage.setItem("stride-sent", JSON.stringify([...sent]));
      } catch {
        /* ignore */
      }
    };
    check();
    const i = setInterval(check, 20_000);
    return () => clearInterval(i);
  }, []);
}

function sessionStorageSafe(k: string) {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
}
