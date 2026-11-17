import { motion } from "framer-motion";
import { Fragment } from "react";
import { Check } from "../components/Check";
import { CATEGORY_COLOR, CountUp, Icon, Pressable, PrimaryButton, Ring } from "../components/ui";
import { useToday } from "../lib/hooks";
import { completion, stayedHard } from "../lib/score";
import { fmtDateLong, fmtDuration, fmtRange, fmtTime, nowMin } from "../lib/time";
import type { DayBlock } from "../lib/types";
import { SKIP_OPTIONS, voice } from "../lib/voice";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";
import { completeBlock } from "./actions";

export function statusLabel(b: DayBlock): { text: string; tone: "good" | "mute" | "bad" | "live" } | null {
  switch (b.status) {
    case "done":
      return { text: b.focusedMinutes ? `Done · ${b.focusedMinutes}m focused` : "Done", tone: "good" };
    case "partial":
      return { text: `Partly · ${b.focusedMinutes ?? 0} of ${b.duration} min`, tone: "good" };
    case "skipped": {
      const o = SKIP_OPTIONS.find((s) => s.id === b.skipReason);
      return { text: `${b.excused ? "Excused" : "Skipped"} · ${o?.label ?? ""}`, tone: b.excused ? "mute" : "bad" };
    }
    case "missed":
      return { text: "Not done", tone: "bad" };
    default:
      return null;
  }
}

export function Today() {
  const { now, today } = useToday();
  const day = useStore((s) => s.days[today]);
  const focus = useStore((s) => s.focus);
  const tick = useStore((s) => s.tick);
  const undoHome = useStore((s) => s.undoHome);
  const settings = useStore((s) => s.settings);
  const open = useUI((s) => s.open);
  const openHome = useUI((s) => s.openHome);
  const openMenu = useUI((s) => s.openMenu);

  const all = day?.blocks ?? [];
  const blocks = all.filter((b) => !b.dropped);
  const droppedTonight = all.filter((b) => b.dropped);
  const t = nowMin(now);
  const pct = completion(day) ?? 0;
  const doneCount = blocks.filter((b) => b.status === "done" || b.status === "partial").length;
  const isEvent = (b: DayBlock) => b.category === "event";
  const countable = blocks.filter((b) => !b.excused && !isEvent(b)).length;
  const left = blocks.filter((b) => b.status === "planned" && !isEvent(b)).reduce((a, b) => a + b.duration, 0);

  const current = blocks.find((b) => !isEvent(b) && b.status === "planned" && b.start <= t && t < b.start + b.duration);
  const next = blocks.find((b) => !isEvent(b) && b.status === "planned" && b.start > t);
  const hero = current ?? next;
  const allDone = blocks.some((b) => !isEvent(b)) && blocks.every((b) => isEvent(b) || b.status !== "planned");

  // Where the "now" divider sits, when we're between blocks.
  const nowIndex = current ? -1 : blocks.findIndex((b) => b.start > t);

  return (
    <div className="px-5 pt-[calc(18px+var(--safe-top))] pb-32">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 pt-1">
          <div className="eyebrow">{fmtDateLong(today)}</div>
          <h1 className="mt-2 text-[27px] leading-[1.12] font-semibold tracking-[-0.025em] text-balance">
            {blocks.length === 0 ? voice.nothingPlanned : allDone && pct >= 99.5 ? voice.allDone[now.getDate() % 3] : voice.greeting(now.getHours(), now.getDate())}
          </h1>
        </div>
        <Ring value={pct / 100} size={76} stroke={7} glow={pct >= 80}>
          <div className="leading-none">
            <CountUp value={pct} className="text-[20px] font-semibold" />
            <span className="text-[11px] text-mute">%</span>
          </div>
        </Ring>
      </header>

      <div className="mt-4 flex items-center gap-2 text-[13px] text-mute">
        <span className="num">
          {doneCount} of {countable} done
        </span>
        <span className="text-faint">·</span>
        <span className="num min-w-0 truncate">{left ? `${fmtDuration(left)} left` : "Nothing left"}</span>
        <Pressable
          scale={0.92}
          aria-label="Add or re-plan"
          onClick={() => openMenu(true)}
          className="ml-auto flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-white/[0.04] pr-3.5 pl-2.5 text-[13px] font-medium text-ink"
        >
          <Icon name="plus" size={16} stroke={2.2} /> Add
        </Pressable>
      </div>

      {/* Only after you chose to re-plan: a quiet note with undo. */}
      {day?.homeAt != null && t < settings.bedTime && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-white/[0.025] py-2 pr-2 pl-4 text-[13px]">
          <Icon name="home" size={16} className="shrink-0 text-ember" />
          <span className="num min-w-0 flex-1 text-mute">Re-planned from {fmtTime(day.homeAt)}</span>
          <Pressable onClick={() => openHome(true)} className="h-9 rounded-xl px-3 font-medium text-ink">
            Change
          </Pressable>
          <Pressable onClick={() => undoHome(today)} className="h-9 rounded-xl px-3 text-faint">
            Undo
          </Pressable>
        </div>
      )}

      {/* Hero: the one thing to do now */}
      {hero && (
        <motion.section
          layout
          className="relative mt-6 overflow-hidden rounded-[26px] border p-5"
          style={{
            borderColor: current ? "rgb(var(--ember-rgb) / 0.35)" : "var(--color-line)",
            background: current
              ? "radial-gradient(120% 120% at 0% 0%, rgb(var(--ember-rgb) / 0.16), transparent 55%), linear-gradient(180deg, rgb(255 255 255 / 0.04), rgb(255 255 255 / 0.015))"
              : "linear-gradient(180deg, rgb(255 255 255 / 0.04), rgb(255 255 255 / 0.015))",
          }}
        >
          <div className="flex items-center gap-2">
            {current ? (
              <span className="flex items-center gap-1.5 rounded-full bg-ember/15 px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-ember-hi uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-ember" style={{ animation: "breathe 1.6s ease-in-out infinite" }} />
                Now
              </span>
            ) : (
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-mute uppercase">
                Up next · in {fmtDuration(Math.max(1, Math.round(hero.start - t)))}
              </span>
            )}
            <span className="num text-[13px] text-mute">{fmtRange(hero.start, hero.duration)}</span>
          </div>
          <h2 className="mt-3 text-[26px] leading-tight font-semibold tracking-[-0.02em]">{hero.title}</h2>
          {hero.subtitle && <p className="mt-1 text-[15px] text-mute">{hero.subtitle}</p>}

          {current && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                className="h-full rounded-full bg-ember"
                initial={{ width: 0 }}
                animate={{ width: `${((t - current.start) / current.duration) * 100}%` }}
                transition={{ type: "spring", stiffness: 60, damping: 20 }}
              />
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            {focus?.blockId === hero.id ? (
              <PrimaryButton onClick={() => open("focusSetup", { date: today, id: hero.id })}>Back to the timer</PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => open("focusSetup", { date: today, id: hero.id })}>
                <span className="inline-flex items-center gap-2">
                  <Icon name="play" size={18} fill stroke={0} /> Start focus · {fmtDuration(hero.duration)}
                </span>
              </PrimaryButton>
            )}
            <div className="shrink-0">
              <Check status={hero.status} onToggle={() => completeBlock(today, hero.id)} label={`Mark ${hero.title} done`} size={34} />
            </div>
          </div>
        </motion.section>
      )}

      {/* Timeline */}
      <section className="mt-8">
        <div className="eyebrow mb-3 px-1">Today's plan</div>
        <ol className="relative">
          {blocks.map((b, i) => {
            const live = current?.id === b.id;
            const label = statusLabel(b);
            const dim = b.status === "missed" || (b.status === "skipped" && b.excused);
            const color = CATEGORY_COLOR[b.category];
            return (
              <Fragment key={b.id}>
                {i === nowIndex && <NowLine t={t} />}
                <motion.li
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3), type: "spring", stiffness: 380, damping: 32 }}
                  className="relative flex gap-3"
                >
                  {/* time */}
                  <div className="w-[52px] shrink-0 pt-[18px] text-right">
                    <div className={`num text-[13px] font-medium ${live ? "text-ember-hi" : "text-mute"}`}>{fmtTime(b.start, { suffix: false })}</div>
                    <div className="num text-[11px] text-faint">{b.start < 720 ? "am" : "pm"}</div>
                  </div>
                  {/* rail */}
                  <div className="relative flex w-3 shrink-0 justify-center">
                    <div className="absolute top-0 bottom-0 w-px bg-white/[0.07]" />
                    <div
                      className="relative mt-[22px] h-2.5 w-2.5 rounded-full"
                      style={{
                        background: b.status === "done" || b.status === "partial" ? color : "var(--color-bg)",
                        boxShadow: `0 0 0 2px ${color}${live ? ", 0 0 12px 2px " + color : ""}`,
                        opacity: dim ? 0.45 : 1,
                      }}
                    />
                  </div>
                  {/* card */}
                  <div
                    className={`mb-2.5 flex min-h-[68px] min-w-0 flex-1 items-center rounded-[18px] border pr-1.5 transition-colors ${
                      live ? "border-ember/30 bg-ember/[0.07]" : "border-line bg-white/[0.025]"
                    }`}
                  >
                    <Pressable
                      scale={0.985}
                      onClick={() => open("block", { date: today, id: b.id })}
                      className={`min-w-0 flex-1 self-stretch py-3 pl-4 text-left ${dim ? "opacity-55" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`truncate text-[16px] font-medium tracking-[-0.01em] ${b.status === "done" ? "text-mute" : ""}`}>{b.title}</span>
                        {stayedHard(b) && (
                          <span className="shrink-0 rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-ember-hi uppercase">Stayed hard</span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 overflow-hidden text-[13px] whitespace-nowrap text-faint">
                        <span className="num shrink-0">{fmtDuration(b.duration)}</span>
                        {label ? (
                          <>
                            <span>·</span>
                            <span className={`truncate ${label.tone === "bad" ? "text-[#f87171]/80" : label.tone === "good" ? "text-mute" : ""}`}>{label.text}</span>
                          </>
                        ) : b.subtitle ? (
                          <>
                            <span>·</span>
                            <span className="truncate">{b.subtitle}</span>
                          </>
                        ) : null}
                        {b.note && <Icon name="note" size={13} className="ml-0.5 shrink-0 text-faint" />}
                      </div>
                    </Pressable>
                    {isEvent(b) ? (
                      <span className="mr-2.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-event/15 text-event" aria-label="Event">
                        <Icon name="today" size={16} />
                      </span>
                    ) : (
                      <Check status={b.status} onToggle={() => (b.status === "planned" || b.status === "missed" ? completeBlock(today, b.id) : tick(today, b.id))} label={`Mark ${b.title} done`} />
                    )}
                  </div>
                </motion.li>
              </Fragment>
            );
          })}
          {nowIndex === -1 && !current && blocks.length > 0 && <NowLine t={t} />}
        </ol>
        {droppedTonight.length > 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-3">
            <div className="eyebrow">Dropped tonight · excused</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {droppedTonight.map((b) => (
                <Pressable
                  key={b.id}
                  scale={0.95}
                  onClick={() => open("block", { date: today, id: b.id })}
                  className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[13px] text-mute"
                >
                  {b.title}
                </Pressable>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-faint">No time left after getting home. They don't count against you.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function NowLine({ t }: { t: number }) {
  return (
    <li className="relative my-1 mb-3 flex items-center gap-3" aria-label="Current time">
      <div className="num w-[52px] shrink-0 text-right text-[11px] font-semibold text-ember">{fmtTime(Math.floor(t))}</div>
      <div className="relative flex w-3 shrink-0 justify-center">
        <div className="h-2 w-2 rounded-full bg-ember shadow-[0_0_10px_2px_rgb(var(--ember-rgb)/0.6)]" />
      </div>
      <div className="h-px flex-1 bg-gradient-to-r from-ember/70 to-transparent" />
    </li>
  );
}
