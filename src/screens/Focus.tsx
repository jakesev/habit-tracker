import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { GhostButton, Icon, Pressable, PrimaryButton, Scale, spring } from "../components/ui";
import { haptic, notify, primeAudio, sound } from "../lib/feedback";
import { cancelOnce, hideFocusNotification, isNative, keepAwake, scheduleOnce, showFocusNotification } from "../lib/native";
import { themeOf } from "../lib/identity";
import { fmtClock, fmtDuration, fmtTime, nowMin, todayKey } from "../lib/time";
import { voice } from "../lib/voice";
import { selectBlock, useStore } from "../store/store";
import { useUI } from "../store/ui";

const PRESETS = [15, 25, 30, 45, 60];

/** Full-screen, distraction-free focus. One timer at a time; it survives reloads. */
export function FocusScreen() {
  const ref = useUI((s) => s.focusSetup);
  const focus = useStore((s) => s.focus);
  const open = useUI((s) => s.open);
  const visible = !!ref;
  const date = focus?.date ?? ref?.date;
  const id = focus?.blockId ?? ref?.id;
  const b = useStore((s) => (date && id ? selectBlock(s, date, id) : undefined));

  return (
    <AnimatePresence>
      {visible && b && date && (
        <motion.div
          key="focus"
          className="fixed inset-0 z-50 overflow-y-auto bg-bg"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label="Focus timer"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(90% 55% at 50% 30%, rgb(var(--ember-rgb) / 0.12), transparent 70%)" }}
          />
          <div className="relative mx-auto flex min-h-full max-w-[520px] flex-col px-6 pt-[calc(14px+var(--safe-top))] pb-[calc(24px+var(--safe-bottom))]">
            <div className="flex items-center justify-between">
              <Pressable aria-label="Minimise" onClick={() => open("focusSetup", null)} className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] text-mute">
                <Icon name="x" size={20} />
              </Pressable>
              <div className="eyebrow">Focus</div>
              <div className="w-11" />
            </div>
            {focus && focus.blockId === b.id ? (
              <Running title={b.title} checklist={b.checklist} done={b.checklistDone} date={date} id={b.id} />
            ) : focus ? (
              <OtherRunning />
            ) : (
              <Setup date={date} id={b.id} title={b.title} subtitle={b.subtitle} duration={b.duration} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OtherRunning() {
  const focus = useStore((s) => s.focus);
  const open = useUI((s) => s.open);
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-[18px] text-mute">Another timer is running. Finish it first.</p>
      <GhostButton className="mt-6" onClick={() => focus && open("focusSetup", { date: focus.date, id: focus.blockId })}>
        Go to it
      </GhostButton>
    </div>
  );
}

/* ---------------------------------------------------------------- Setup */

const T_STEP = 5;

/**
 * Default timer length: the time actually left in the block if you're starting late,
 * minus the transition break so you can reset before the next block.
 */
export function defaultFocusMinutes(start: number, duration: number, now: number, transition: number, isToday: boolean) {
  const left = isToday && now > start ? Math.floor(start + duration - now) : duration;
  const base = left >= 10 ? left : duration;
  const withBreak = base - transition >= 10 ? base - transition : base;
  return Math.max(T_STEP, Math.floor(withBreak / T_STEP) * T_STEP);
}

function Setup({ date, id, title, subtitle, duration }: { date: string; id: string; title: string; subtitle?: string; duration: number }) {
  const block = useStore((s) => selectBlock(s, date, id));
  const transition = useStore((s) => s.settings.transition);
  const next = useStore((s) => s.days[date]?.blocks.find((x) => x.status === "planned" && block && x.start >= block.start + block.duration && x.category !== "event"));
  const now = nowMin();
  const isToday = date === todayKey();
  const late = !!block && isToday && now > block.start + 1;
  const [mins, setMins] = useState(() => (block ? defaultFocusMinutes(block.start, block.duration, now, transition, isToday) : duration));
  const timing = useStore((s) => s.settings.questionTiming);
  const resistance = useStore((s) => selectBlock(s, date, id)?.resistance ?? null);
  const setAnswers = useStore((s) => s.setAnswers);
  const start = useStore((s) => s.startFocus);

  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-10 text-center">
        <h1 className="text-[34px] leading-tight font-semibold tracking-[-0.03em]">{title}</h1>
        {subtitle && <p className="mt-2 text-[16px] text-mute">{subtitle}</p>}
      </div>

      <div className="mt-12 flex items-center justify-center gap-6">
        <Pressable
          aria-label="15 minutes less"
          disabled={mins <= T_STEP}
          onClick={() => setMins((m) => Math.max(T_STEP, m - T_STEP))}
          className="grid h-14 w-14 place-items-center rounded-full border border-line bg-white/[0.04] disabled:opacity-30"
        >
          <Icon name="minus" size={22} />
        </Pressable>
        <div className="w-[150px] text-center">
          <motion.div key={mins} initial={{ y: 8, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="num text-[64px] leading-none font-semibold">
            {mins}
          </motion.div>
          <div className="mt-1 text-[14px] text-faint">minutes</div>
        </div>
        <Pressable
          aria-label="15 minutes more"
          disabled={mins >= 180}
          onClick={() => setMins((m) => Math.min(180, m + T_STEP))}
          className="grid h-14 w-14 place-items-center rounded-full border border-line bg-white/[0.04] disabled:opacity-30"
        >
          <Icon name="plus" size={22} />
        </Pressable>
      </div>

      <div className="mx-auto mt-8 grid w-full max-w-[340px] grid-cols-5 gap-2">
        {PRESETS.map((p) => (
          <Pressable
            key={p}
            scale={0.92}
            aria-label={`${p} minutes`}
            onClick={() => setMins(p)}
            className={`num h-11 rounded-full text-[15px] font-semibold transition-colors ${mins === p ? "bg-ink text-black" : "bg-white/[0.06] text-mute"}`}
          >
            {p}
          </Pressable>
        ))}
      </div>

      {timing === "before" && (
        <div className="mt-10">
          <div className="mb-3 text-[16px] font-medium">{voice.checkIn.resistance.q}</div>
          <Scale value={resistance} onChange={(v) => setAnswers(date, id, { resistance: v })} lo={voice.checkIn.resistance.lo} hi={voice.checkIn.resistance.hi} />
        </div>
      )}

      <div className="mt-auto pt-10">
        <p className="mb-1 text-center text-[13px] text-faint">
          {late && block ? `Started late: ${Math.max(0, Math.floor(block.start + block.duration - now))} min left in this block. ` : ""}
          Ends {fmtTime(Math.floor(now) + mins)}
          {transition && next ? ` · ${transition} min to reset before ${next.title}` : ""}
        </p>
        <p className="mb-4 text-center text-[15px] text-mute">{voice.timer.ready}</p>
        <PrimaryButton
          onClick={() => {
            primeAudio();
            haptic("success");
            start(date, id, mins);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="play" size={18} fill stroke={0} /> Start · {fmtDuration(mins)}
          </span>
        </PrimaryButton>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Running */

const R = 132;
const C = 2 * Math.PI * R;

function Running({ title, checklist, done, date, id }: { title: string; checklist?: string[]; done?: number[]; date: string; id: string }) {
  const focus = useStore((s) => s.focus)!;
  const { pauseFocus, resumeFocus, finishFocus, toggleChecklist, cancelFocus } = useStore.getState();
  const open = useUI((s) => s.open);
  const paused = focus.endsAt == null;
  const [remaining, setRemaining] = useState(() => (focus.endsAt != null ? focus.endsAt - Date.now() : focus.pausedRemaining ?? 0));
  const [ending, setEnding] = useState<null | "time" | "early">(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const alarmed = useRef(false);
  const lineIdx = useRef(Math.floor(Math.random() * voice.timer.running.length));

  // Frame loop: drains the ring smoothly and fires the in-timer buzzes.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const f = useStore.getState().focus;
      if (!f) return;
      const rem = f.endsAt != null ? f.endsAt - Date.now() : f.pausedRemaining ?? 0;
      const frac = Math.max(0, rem) / f.totalMs;
      if (ringRef.current) ringRef.current.style.strokeDashoffset = String(C * (1 - frac));
      setRemaining((prev) => (Math.ceil(prev / 1000) !== Math.ceil(rem / 1000) ? rem : prev));
      if (f.endsAt != null && rem <= 0 && !alarmed.current) {
        alarmed.current = true;
        setEnding("time");
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Keep the screen awake while the timer runs.
  useEffect(() => {
    if (keepAwake(!paused)) return () => void keepAwake(false);
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    if (!paused && nav.wakeLock) nav.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, [paused]);

  const end = (outcome: "done" | "partial" | "skipped") => {
    finishFocus(outcome);
    open("focusSetup", null);
    if (outcome === "skipped") setTimeout(() => open("skip", { date, id }), 250);
    else setTimeout(() => open("checkin", { date, id }), 250);
  };

  const elapsedMin = Math.round((focus.totalMs - Math.max(0, remaining)) / 60_000);
  const leftover = Math.max(0, Math.round(remaining / 60_000));

  return (
    <div className="flex flex-1 flex-col items-center">
      <h1 className="mt-6 text-center text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>

      <div className="relative mt-8 grid place-items-center" style={{ width: 300, height: 300 }}>
        <svg width={300} height={300} className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx={150} cy={150} r={R} fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth={10} />
          <circle
            ref={ringRef}
            cx={150}
            cy={150}
            r={R}
            fill="none"
            stroke="var(--color-ember)"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={C}
            style={{ filter: "drop-shadow(0 0 10px rgb(var(--ember-rgb) / 0.55))" }}
          />
        </svg>
        <div className="text-center">
          <div className={`num text-[72px] leading-none font-semibold ${paused ? "text-mute" : ""}`} role="timer" aria-live="off">
            {fmtClock(remaining)}
          </div>
          <div className="mt-3 text-[14px] text-faint">{paused ? "Paused" : voice.timer.running[lineIdx.current]}</div>
        </div>
      </div>

      {checklist && checklist.length > 0 && (
        <div className="mt-8 w-full max-w-[360px] space-y-1">
          {checklist.map((item, i) => {
            const on = done?.includes(i);
            return (
              <Pressable key={i} scale={0.98} onClick={() => toggleChecklist(date, id, i)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px] transition-colors ${on ? "border-ember bg-ember" : "border-white/25"}`}>
                  {on && <Icon name="check" size={14} stroke={3} className="text-black" />}
                </span>
                <span className={`text-[15px] ${on ? "text-faint line-through" : "text-mute"}`}>{item}</span>
              </Pressable>
            );
          })}
        </div>
      )}

      <div className="mt-auto grid w-full grid-cols-2 gap-3 pt-10">
        <GhostButton className="h-14" onClick={() => (paused ? resumeFocus() : pauseFocus())}>
          <span className="inline-flex items-center gap-2">
            <Icon name={paused ? "play" : "pause"} size={18} fill={paused} stroke={paused ? 0 : 2.4} /> {paused ? "Resume" : "Pause"}
          </span>
        </GhostButton>
        <GhostButton
          className="h-14"
          onClick={() => {
            pauseFocus();
            setEnding("early");
          }}
        >
          Finish early
        </GhostButton>
      </div>
      <Pressable
        onClick={() => {
          cancelFocus();
          open("focusSetup", null);
        }}
        className="mt-3 h-10 text-[13px] text-faint"
      >
        Cancel timer · nothing logged
      </Pressable>

      {/* End prompt */}
      <AnimatePresence>
        {ending && (
          <motion.div className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={spring}
              className="mx-auto w-full max-w-[520px] rounded-t-[28px] border-t border-line-strong bg-[#121215] px-6 pt-7 pb-[calc(24px+var(--safe-bottom))]"
            >
              <div className="eyebrow">{ending === "time" ? voice.timer.ended : `${elapsedMin} min in · ${leftover} min left`}</div>
              <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">{voice.timer.ask}</h2>
              {ending === "early" && leftover >= 15 && <p className="mt-1 text-[14px] text-mute">Finished early? That's {leftover} minutes back. Spend them well.</p>}
              <div className="mt-6 grid gap-2">
                <PrimaryButton onClick={() => end("done")}>Done</PrimaryButton>
                <GhostButton className="h-14" onClick={() => end("partial")}>
                  Partly done
                </GhostButton>
                <GhostButton className="h-14 text-mute" onClick={() => end("skipped")}>
                  Skipped it
                </GhostButton>
              </div>
              {ending === "early" && (
                <Pressable
                  onClick={() => {
                    resumeFocus();
                    setEnding(null);
                  }}
                  className="mt-3 h-11 w-full text-[14px] text-mute"
                >
                  Keep going
                </Pressable>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Runs app-wide (even with the timer minimised): halfway and two-minute buzzes,
 * and the end-of-timer alarm, which brings the focus screen back up.
 */
const FOCUS_ALARM_ID = 777_001;

export function useFocusWatcher() {
  // In the Android app, the end-of-timer alarm is also scheduled with the system,
  // so it rings even if the screen is off or the app was swiped away.
  useEffect(() => {
    if (!isNative) return;
    let last = "";
    const apply = (f: ReturnType<typeof useStore.getState>["focus"]) => {
      const key = f ? `${f.blockId}:${f.endsAt}:${f.pausedRemaining}` : "";
      if (key === last) return;
      last = key;
      const st = useStore.getState();
      const title = f ? selectBlock(st, f.date, f.blockId)?.title ?? "Focus" : "";
      const t = themeOf(st.settings.theme);
      const accent = "#" + t.rgb.map((n) => n.toString(16).padStart(2, "0")).join("");
      if (f?.endsAt) {
        scheduleOnce(FOCUS_ALARM_ID, `${title} · time`, voice.timer.ended, f.endsAt);
        showFocusNotification({ title, endsAt: f.endsAt, paused: false, remainingMs: f.endsAt - Date.now(), accent });
      } else if (f) {
        cancelOnce(FOCUS_ALARM_ID);
        showFocusNotification({ title, endsAt: 0, paused: true, remainingMs: f.pausedRemaining ?? 0, accent });
      } else {
        cancelOnce(FOCUS_ALARM_ID);
        hideFocusNotification();
      }
    };
    apply(useStore.getState().focus);
    return useStore.subscribe((s) => apply(s.focus));
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const st = useStore.getState();
      const f = st.focus;
      if (!f || f.endsAt == null) return;
      const rem = f.endsAt - Date.now();
      const title = selectBlock(st, f.date, f.blockId)?.title ?? "Focus";
      if (!f.buzzedHalf && f.totalMs >= 20 * 60_000 && rem <= f.totalMs / 2 && rem > 0) {
        st.markBuzz("buzzedHalf");
        haptic("tap");
        sound("soft");
        notify(title, voice.timer.half, "focus");
      }
      if (!f.buzzedTwo && f.totalMs > 5 * 60_000 && rem <= 120_000 && rem > 0) {
        st.markBuzz("buzzedTwo");
        haptic("tap");
        sound("soft");
        notify(title, voice.timer.twoMin, "focus");
      }
      if (rem <= 0 && !f.alarmed) {
        useStore.setState({ focus: { ...f, alarmed: true } });
        haptic("alarm");
        sound("alarm");
        if (!isNative) notify(`${title} · time`, voice.timer.ended, "focus");
        useUI.getState().open("focusSetup", { date: f.date, id: f.blockId });
      }
    }, 500);
    return () => clearInterval(t);
  }, []);
}

