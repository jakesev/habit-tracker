import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { DayBox } from "../components/DayBox";
import { CountUp, Icon, Pressable } from "../components/ui";
import { useToday } from "../lib/hooks";
import { completion, currentStreak, dayState, glowTier, longestStreak, restPassesUsedInWeek, streakEndingAt } from "../lib/score";
import { MONTHS, toKey } from "../lib/time";
import type { DateKey } from "../lib/types";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";

const GAP = 8;

export function Streak() {
  const { today } = useToday();
  const days = useStore((s) => s.days);
  const settings = useStore((s) => s.settings);
  const firstDay = useStore((s) => s.firstDay) ?? today;
  const openDay = useUI((s) => s.openDay);
  const [offset, setOffset] = useState(0);
  const [dir, setDir] = useState(0);

  const base = new Date();
  const month = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const y = month.getFullYear();
  const m = month.getMonth();
  const daysIn = new Date(y, m + 1, 0).getDate();
  const lead = (month.getDay() + 6) % 7; // Monday first

  const cells: (DateKey | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => toKey(new Date(y, m, i + 1)))];
  while (cells.length % 7) cells.push(null);

  const state = (k: DateKey) => (k > today ? "future" : k < firstDay ? "before" : dayState(days[k], settings, k === today));
  const linked = (k: DateKey | null) => {
    if (!k) return false;
    const s = state(k);
    return s === "streak" || s === "rest";
  };

  // Month completion: average of tracked days so far.
  const tracked = cells.filter((k): k is DateKey => !!k && k <= today && k >= firstDay);
  const pcts = tracked.map((k) => (days[k]?.restPass ? null : completion(days[k]))).filter((v): v is number => v != null);
  const monthPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;

  const streak = currentStreak(days, settings, today, firstDay);
  const longest = longestStreak(days, settings, today, firstDay);
  const passesLeft = Math.max(0, settings.restPassesPerWeek - restPassesUsedInWeek(days, today));
  const canNext = offset < 0;
  const canPrev = toKey(new Date(y, m, 1)) > firstDay.slice(0, 8) + "01";

  const nav = (d: number) => {
    setDir(d);
    setOffset((o) => o + d);
  };

  return (
    <div className="px-5 pt-[calc(18px+var(--safe-top))] pb-32">
      <header>
        <div className="eyebrow">Streak calendar</div>
        <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.025em]">Don't break the chain.</h1>
      </header>

      <section className="mt-6 grid grid-cols-3 gap-2.5">
        <Stat label="Current" value={streak} unit="d" accent />
        <Stat label="Longest" value={longest} unit="d" />
        <Stat label="This month" value={monthPct} unit="%" />
      </section>

      <section className="card mt-4 px-4 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <Pressable aria-label="Previous month" disabled={!canPrev} onClick={() => nav(-1)} className="grid h-10 w-10 place-items-center rounded-full text-mute disabled:opacity-25">
            <Icon name="left" size={20} />
          </Pressable>
          <div className="text-[16px] font-semibold tracking-[-0.01em]">
            {MONTHS[m]} <span className="text-faint">{y}</span>
          </div>
          <Pressable aria-label="Next month" disabled={!canNext} onClick={() => nav(1)} className="grid h-10 w-10 place-items-center rounded-full text-mute disabled:opacity-25">
            <Icon name="right" size={20} />
          </Pressable>
        </div>

        <div className="mt-3 grid grid-cols-7 text-center" style={{ gap: GAP }}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="text-[11px] font-medium text-faint">
              {d}
            </div>
          ))}
        </div>

        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={`${y}-${m}`}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="mt-2 grid grid-cols-7"
            style={{ gap: GAP }}
          >
            {cells.map((k, i) => {
              if (!k) return <div key={`e${i}`} />;
              const s = state(k);
              const col = i % 7;
              const linkRight = col < 6 && linked(k) && linked(cells[i + 1]);
              const chain = linked(k) ? streakEndingAt(days, k, settings, today, firstDay) : 0;
              const tier = glowTier(chain);
              return (
                <Pressable key={k} scale={0.9} disabled={s === "before" || s === "future"} onClick={() => openDay(k)} className="relative" aria-label={k}>
                  {linkRight && (
                    <motion.span
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.2 + i * 0.008, type: "spring", stiffness: 200, damping: 26 }}
                      className="absolute top-1/2 left-1/2 z-0 h-[6px] origin-left -translate-y-1/2 rounded-full"
                      style={{
                        width: `calc(100% + ${GAP}px)`,
                        background: "var(--color-ember)",
                        boxShadow: tier ? `0 0 ${6 + tier * 3}px rgb(var(--ember-rgb) / ${0.25 + tier * 0.08})` : undefined,
                      }}
                    />
                  )}
                  <div className="relative z-10">
                    <DayBox pct={completion(days[k])} state={s} tier={tier} isToday={k === today} label={Number(k.slice(8))} delay={0.05 + i * 0.01} />
                  </div>
                </Pressable>
              );
            })}
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[4px] bg-ember" /> {settings.streakThreshold}%+ counts
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[4px] bg-skill" /> Rest pass
          </span>
          <span className="flex items-center gap-1.5">
            <span className="relative h-3 w-3 overflow-hidden rounded-[4px] bg-white/10">
              <span className="absolute inset-x-0 bottom-0 h-1/2 bg-white/25" />
            </span>
            Partly done
          </span>
        </div>
      </section>

      <section className="mt-4 flex items-center gap-3 rounded-[22px] border border-line px-4 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-skill/10 text-skill">
          <Icon name="shield" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">
            {passesLeft} rest pass{passesLeft === 1 ? "" : "es"} left this week
          </div>
          <div className="text-[13px] text-faint">Tap a missed day to use it. Life happens. Say why.</div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, unit, accent }: { label: string; value: number; unit: string; accent?: boolean }) {
  return (
    <div className="card px-3.5 py-3.5">
      <div className="flex items-baseline gap-0.5">
        <CountUp value={value} className={`text-[28px] leading-none font-semibold ${accent ? "text-ember" : ""}`} />
        <span className="text-[13px] text-mute">{unit}</span>
      </div>
      <div className="mt-1.5 text-[12px] text-faint">{label}</div>
    </div>
  );
}
