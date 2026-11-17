import { motion } from "framer-motion";
import { DayBox } from "../components/DayBox";
import { CountUp, Icon, Pressable, Ring } from "../components/ui";
import { useToday } from "../lib/hooks";
import {
  completion,
  currentStreak,
  dayState,
  disciplineIndex,
  disciplineLevel,
  glowTier,
  longestStreak,
  productivity,
  productivityLevel,
  stayedHard,
  streakEndingAt,
  weekFocusedMinutes,
} from "../lib/score";
import { addDays, DOW_SHORT, fmtTime, fromKey, nowMin, weekStart } from "../lib/time";
import type { Day, DateKey } from "../lib/types";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";
import { Logo } from "../components/Logo";
import { useIdentity } from "../lib/identity";

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring" as const, stiffness: 300, damping: 30, delay: 0.04 + i * 0.05 },
});

export function Home() {
  const { now, today } = useToday();
  const identity = useIdentity();
  const days = useStore((s) => s.days);
  const settings = useStore((s) => s.settings);
  const firstDay = useStore((s) => s.firstDay) ?? today;
  const go = useUI((s) => s.go);
  const open = useUI((s) => s.open);
  const openDay = useUI((s) => s.openDay);

  const streak = currentStreak(days, settings, today, firstDay);
  const longest = longestStreak(days, settings, today, firstDay);
  const tier = glowTier(streak);
  const disc = disciplineIndex(days, settings, today, firstDay);
  const prod = productivity(days, today, firstDay, streak);
  const dl = disciplineLevel(disc.index);
  const pl = productivityLevel(prod.score);
  const todayPct = completion(days[today]) ?? 0;
  const weekHours = weekFocusedMinutes(days, today) / 60;

  const t = nowMin(now);
  const next = days[today]?.blocks.find((b) => b.status === "planned" && b.start + b.duration > t);
  const nextSteps = [3, 7, 14, 30, 60].find((s) => s > streak);

  return (
    <div className="px-5 pt-[calc(18px+var(--safe-top))] pb-32">
      <motion.header {...stagger(0)} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-[17px] font-semibold tracking-[-0.02em]">{identity.name}</span>
        </div>
        <span className="eyebrow">Last 30 days</span>
      </motion.header>

      {/* Hero: the streak */}
      <motion.section {...stagger(1)} className="relative mt-10 flex flex-col items-center text-center">
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-[58%] rounded-full"
          style={{
            background: `radial-gradient(circle, rgb(var(--ember-rgb) / ${0.1 + Math.min(tier, 5) * 0.06}) 0%, transparent 65%)`,
            animation: streak > 0 ? "breathe 3.4s ease-in-out infinite" : undefined,
          }}
        />
        <div className="relative flex items-center gap-1 text-ember">
          <Icon name="flame" size={18} fill stroke={0} />
          <span className="text-[12px] font-semibold tracking-[0.14em] uppercase">Streak</span>
        </div>
        <div className="relative mt-1 flex items-baseline gap-2">
          <CountUp
            value={streak}
            className="text-[112px] leading-[0.95] font-semibold"
          />
        </div>
        <div className="relative text-[16px] text-mute">{streak === 1 ? "day" : "days"} in a row</div>
        <div className="relative mt-3 flex items-center gap-2 text-[13px] text-faint">
          <span className="num">Longest {longest}</span>
          {nextSteps && (
            <>
              <span>·</span>
              <span className="num">
                {nextSteps - streak} to a {nextSteps}-day glow
              </span>
            </>
          )}
        </div>
      </motion.section>

      {/* Week strip */}
      <motion.section {...stagger(2)} className="mt-8">
        <WeekStrip days={days} today={today} firstDay={firstDay} onOpen={openDay} />
      </motion.section>

      {/* Gauges */}
      <motion.section {...stagger(3)} className="mt-4 grid grid-cols-2 gap-3">
        <Gauge
          title="Discipline"
          value={disc.index}
          level={dl.name}
          sub={dl.next ? `${Math.max(0, Math.ceil(dl.next.at - disc.index))} to ${dl.next.name}` : "Top level. Hold it."}
          color="var(--color-ember)"
        />
        <Gauge
          title="Productivity"
          value={prod.score}
          level={pl.name}
          sub={pl.next ? `${Math.max(0, Math.ceil(pl.next.at - prod.score))} to ${pl.next.name}` : "Top level. Hold it."}
          color="var(--color-ink)"
        />
      </motion.section>

      {/* Small stats */}
      <motion.section {...stagger(4)} className="mt-3 grid grid-cols-2 gap-3">
        <Pressable scale={0.98} onClick={() => go("today")} className="card px-4 py-4 text-left">
          <div className="eyebrow">Today</div>
          <div className="mt-2 flex items-baseline gap-0.5">
            <CountUp value={todayPct} className="text-[30px] leading-none font-semibold" />
            <span className="text-[14px] text-mute">%</span>
          </div>
          <div className="mt-1 text-[12px] text-faint">of the plan done</div>
        </Pressable>
        <div className="card px-4 py-4">
          <div className="eyebrow">This week</div>
          <div className="mt-2 flex items-baseline gap-1">
            <CountUp value={weekHours} decimals={1} className="text-[30px] leading-none font-semibold" />
            <span className="text-[14px] text-mute">h</span>
          </div>
          <div className="mt-1 text-[12px] text-faint">focused</div>
        </div>
      </motion.section>

      {/* Next block */}
      {next && (
        <motion.section {...stagger(5)} className="card mt-3 flex items-center gap-4 py-3 pr-3 pl-4">
          <div className="min-w-0 flex-1">
            <div className="eyebrow">{next.start <= t ? "Now" : "Next"}</div>
            <div className="mt-1 truncate text-[17px] font-medium">{next.title}</div>
            <div className="num text-[13px] text-faint">{fmtTime(next.start)}</div>
          </div>
          <Pressable
            onClick={() => open("focusSetup", { date: today, id: next.id })}
            className="flex h-12 items-center gap-2 rounded-2xl bg-ember px-5 font-semibold text-black shadow-[0_8px_24px_-8px_rgb(var(--ember-rgb)/0.7)]"
          >
            <Icon name="play" size={16} fill stroke={0} /> Start
          </Pressable>
        </motion.section>
      )}

      {/* Smart line */}
      <motion.p {...stagger(6)} className="mt-6 px-1 text-[14px] leading-relaxed text-mute">
        <Icon name="sparkle" size={14} className="mr-1.5 -mt-0.5 inline text-ember" />
        {smartLine(days, today)}
      </motion.p>
    </div>
  );
}

function Gauge({ title, value, level, sub, color }: { title: string; value: number; level: string; sub: string; color: string }) {
  return (
    <div className="card flex flex-col items-center px-3 pt-4 pb-4">
      <div className="eyebrow">{title}</div>
      <div className="mt-2">
        <Ring value={value / 100} size={124} stroke={9} arc={0.75} color={color}>
          <div className="-mt-1">
            <CountUp value={value} className="text-[34px] leading-none font-semibold" />
          </div>
        </Ring>
      </div>
      <div className="-mt-5 text-[15px] font-semibold tracking-[-0.01em]">{level}</div>
      <div className="num mt-0.5 text-[12px] text-faint">{sub}</div>
    </div>
  );
}

export function WeekStrip({ days, today, firstDay, onOpen }: { days: Record<DateKey, Day>; today: DateKey; firstDay: DateKey; onOpen: (d: DateKey) => void }) {
  const settings = useStore((s) => s.settings);
  const keys = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <div className="grid grid-cols-7 gap-2">
      {keys.map((k, i) => {
        const before = k < firstDay;
        const state = before ? "before" : dayState(days[k], settings, k === today);
        const chain = state === "streak" || state === "rest" ? streakEndingAt(days, k, settings, today, firstDay) : 0;
        return (
          <Pressable key={k} scale={0.92} disabled={before} onClick={() => onOpen(k)} className="flex w-full flex-col items-center gap-1.5">
            <DayBox pct={completion(days[k])} state={state} tier={glowTier(chain)} isToday={k === today} delay={0.15 + i * 0.04} />
            <span className={`text-[11px] ${k === today ? "font-semibold text-ink" : "text-faint"}`}>{DOW_SHORT[fromKey(k).getDay()].slice(0, 2)}</span>
          </Pressable>
        );
      })}
    </div>
  );
}

/** One rule-based sentence. No AI: weakest skill this week, and hard wins. */
function smartLine(days: Record<DateKey, Day>, today: DateKey): string {
  const ws = weekStart(today);
  const per: Record<string, { done: number; total: number }> = {};
  let hard = 0;
  for (let i = 0; i < 7; i++) {
    const k = addDays(ws, i);
    if (k > today) break;
    for (const b of days[k]?.blocks ?? []) {
      if (stayedHard(b)) hard++;
      if (b.category !== "skill" && b.category !== "reading") continue;
      if (b.excused || (k === today && b.status === "planned")) continue;
      const p = (per[b.title] ??= { done: 0, total: 0 });
      p.total++;
      if (b.status === "done" || b.status === "partial") p.done++;
    }
  }
  const entries = Object.entries(per).filter(([, v]) => v.total > 0);
  if (!entries.length) return "Week's just started. First block sets the tone.";
  entries.sort((a, b) => a[1].done / a[1].total - b[1].done / b[1].total);
  const [weak, v] = entries[0];
  const pct = Math.round((v.done / v.total) * 100);
  const hardPart = hard > 0 ? ` You stayed hard ${hard}× this week.` : "";
  if (pct === 100) return `Every skill block done this week.${hardPart} Keep the standard.`;
  return `Weakest this week: ${weak}, ${v.done} of ${v.total} done (${pct}%). Give it the next free 15.${hardPart}`;
}
