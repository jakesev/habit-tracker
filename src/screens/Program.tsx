import { motion } from "framer-motion";
import { GhostButton, Icon, Pressable, PrimaryButton } from "../components/ui";
import { haptic } from "../lib/feedback";
import { ADVANCE_AFTER, PHASES } from "../lib/program";
import { dayState } from "../lib/score";
import { addDays, diffDays, todayKey } from "../lib/time";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";

/** Where you are in Warm-up → Build → Strong, and whether you've earned the next step. */
export function useProgress() {
  const days = useStore((s) => s.days);
  const settings = useStore((s) => s.settings);
  const firstDay = useStore((s) => s.firstDay);
  const today = todayKey();
  const prog = settings.program ?? { phase: 1, since: firstDay ?? today };
  const phase = PHASES[Math.max(0, Math.min(PHASES.length - 1, prog.phase - 1))];
  const next = PHASES[prog.phase] as (typeof PHASES)[number] | undefined;
  const dayIn = diffDays(prog.since, today) + 1;
  let held = 0;
  for (let i = 1; i <= 7; i++) {
    const k = addDays(today, -i);
    if (k < prog.since) break;
    const st = dayState(days[k], settings, false);
    if (st === "streak" || st === "rest") held++;
  }
  const snoozed = !!prog.snoozeUntil && today < prog.snoozeUntil;
  const ready = !!next && dayIn > 7 && held >= ADVANCE_AFTER && !snoozed;
  return { prog, phase, next, dayIn, held, ready };
}

/** Home: shows up only when you've held the standard long enough to step up. */
export function StepUpCard() {
  const { prog, phase, next, held, ready } = useProgress();
  const setProgram = useStore((s) => s.setProgram);
  const update = useStore((s) => s.updateSettings);
  const toast = useUI((s) => s.showToast);
  if (!ready || !next) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 overflow-hidden rounded-[24px] border border-ember/35 p-5"
      style={{ background: "radial-gradient(120% 120% at 0% 0%, rgb(var(--ember-rgb) / 0.18), transparent 60%)" }}
    >
      <div className="eyebrow text-ember-hi">{phase.name} held · {held} of 7 days</div>
      <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em]">Ready for {next.name}?</h2>
      <p className="mt-1 text-[14px] text-mute">Adds: {next.adds}. One step at a time.</p>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <PrimaryButton
          onClick={() => {
            setProgram(next.n);
            haptic("hard");
            toast(`${next.name} starts now`, "New blocks from tomorrow, or later today if there's time.");
          }}
        >
          Step up
        </PrimaryButton>
        <GhostButton className="h-14" onClick={() => update({ program: { ...prog, snoozeUntil: addDays(todayKey(), 3) } })}>
          Not yet
        </GhostButton>
      </div>
    </motion.section>
  );
}

/** You → Your plan: the phases, where you are, and a way to change it yourself. */
export function PlanSection() {
  const { prog, next, dayIn, held } = useProgress();
  const setProgram = useStore((s) => s.setProgram);
  const toast = useUI((s) => s.showToast);
  return (
    <section className="mt-7">
      <div className="eyebrow mb-2 px-1">Your plan</div>
      <div className="card overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="text-[15px] font-medium">
            Day {dayIn} of {PHASES[prog.phase - 1]?.name ?? "Warm-up"}
          </div>
          <div className="mt-0.5 text-[12px] text-faint">
            {next
              ? dayIn <= 7
                ? `Hold the standard ${ADVANCE_AFTER} of 7 days and ${next.name} unlocks after day 7. ${held} so far.`
                : `${held} of the last 7 days held. ${ADVANCE_AFTER} unlocks ${next.name}.`
              : "The full routine. Hold it."}
          </div>
        </div>
        <ol className="border-t border-line">
          {PHASES.map((p) => {
            const cur = p.n === prog.phase;
            const past = p.n < prog.phase;
            return (
              <li key={p.n} className="relative flex items-start gap-3 border-b border-line px-4 py-3 last:border-b-0" style={cur ? { background: "rgb(var(--ember-rgb) / 0.07)" } : undefined}>
                {cur && <span className="absolute inset-y-0 left-0 w-[3px] bg-ember" />}
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                    cur ? "bg-ember text-black" : past ? "bg-white/15 text-ink" : "border border-white/15 text-faint"
                  }`}
                >
                  {past ? <Icon name="check" size={13} stroke={3} /> : p.n}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-[15px] font-medium ${cur ? "" : past ? "text-mute" : "text-faint"}`}>{p.name}</div>
                  <div className="text-[12px] leading-snug text-faint">{p.line}</div>
                </div>
                {!cur && (
                  <Pressable
                    scale={0.94}
                    onClick={() => {
                      setProgram(p.n);
                      toast(`Switched to ${p.name}`, "Today keeps what you've done. The rest follows the new plan.");
                    }}
                    className="shrink-0 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-mute"
                  >
                    {past ? "Go back" : "Jump"}
                  </Pressable>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
