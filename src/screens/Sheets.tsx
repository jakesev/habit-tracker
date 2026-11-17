import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Check } from "../components/Check";
import { CATEGORY_COLOR, CATEGORY_LABEL, GhostButton, Icon, Pressable, PrimaryButton, Sheet, spring } from "../components/ui";
import { haptic, sound } from "../lib/feedback";
import { useAccent } from "../lib/identity";
import { blockCredit, completion, currentStandard, dailyScore, difficulty, restPassesUsedInWeek, stayedHard, timing, timingTip } from "../lib/score";
import { fmtDateLong, fmtDuration, fmtRange, fmtTime, todayKey, weekStart } from "../lib/time";
import { leadsOf, type DayBlock, type SkipReason } from "../lib/types";
import { LeadPicker } from "../components/LeadPicker";
import { SKIP_OPTIONS, voice } from "../lib/voice";
import { blocksFor, isEditable, selectBlock, useStore } from "../store/store";
import { useUI } from "../store/ui";
import { completeBlock } from "./actions";
import { statusLabel, usesTimer } from "./Today";

/* ================================================================ Block detail */

export function BlockSheet() {
  const ref = useUI((s) => s.block);
  const open = useUI((s) => s.open);
  const b = useStore((s) => (ref ? selectBlock(s, ref.date, ref.id) : undefined));
  const close = () => open("block", null);
  return (
    <Sheet open={!!ref && !!b} onClose={close} label={b?.title ?? "Block"}>
      {ref && b && <BlockBody date={ref.date} b={b} onClose={close} />}
    </Sheet>
  );
}

function BlockBody({ date, b, onClose }: { date: string; b: DayBlock; onClose: () => void }) {
  const accent = useAccent();
  const { setNote, setReminderLeads, toggleChecklist, reopen, tick } = useStore.getState();
  const focus = useStore((s) => s.focus);
  const open = useUI((s) => s.open);
  const [note, setLocal] = useState(b.note ?? "");
  const editable = isEditable(date);
  const isToday = date === todayKey();
  const label = statusLabel(b);
  const doneish = b.status === "done" || b.status === "partial";
  const isEvent = b.category === "event";

  useEffect(() => setLocal(b.note ?? ""), [b.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="pb-2">
      <div className="flex items-center gap-2 text-[13px] text-mute">
        <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[b.category] }} />
        <span>{CATEGORY_LABEL[b.category]}</span>
        <span className="text-faint">·</span>
        <span className="num">{fmtRange(b.start, b.duration)}</span>
        {!isToday && (
          <>
            <span className="text-faint">·</span>
            <span>{fmtDateLong(date)}</span>
          </>
        )}
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[26px] leading-tight font-semibold tracking-[-0.02em]">{b.title}</h2>
          {b.subtitle && <p className="mt-1 text-[15px] text-mute">{b.subtitle}</p>}
        </div>
        {!isEvent && <Check
          status={b.status}
          disabled={!editable}
          size={34}
          label={`Mark ${b.title} done`}
          onToggle={() => {
            if (doneish) tick(date, b.id);
            else {
              onClose();
              completeBlock(date, b.id);
            }
          }}
        />}
      </div>

      {(label || stayedHard(b)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {label && (
            <span className={`rounded-full px-3 py-1 text-[12px] font-medium ${label.tone === "bad" ? "bg-red-500/10 text-red-300" : "bg-white/[0.06] text-mute"}`}>{label.text}</span>
          )}
          {stayedHard(b) && <span className="rounded-full bg-ember/15 px-3 py-1 text-[12px] font-semibold text-ember-hi">Stayed hard</span>}
        </div>
      )}

      {/* main action */}
      {editable && b.status === "planned" && isToday && !isEvent && !usesTimer(b) && (
        <PrimaryButton
          className="mt-5"
          onClick={() => {
            onClose();
            completeBlock(date, b.id);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="check" size={18} stroke={2.6} /> Done{b.challenge ? ` · ${b.challenge.toLowerCase()}?` : ""}
          </span>
        </PrimaryButton>
      )}
      {editable && b.status === "planned" && isToday && !isEvent && usesTimer(b) && (
        <PrimaryButton
          className="mt-5"
          onClick={() => {
            onClose();
            open("focusSetup", { date, id: b.id });
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="play" size={18} fill stroke={0} /> {focus?.blockId === b.id ? "Back to the timer" : `Start focus · ${fmtDuration(b.duration)}`}
          </span>
        </PrimaryButton>
      )}
      {editable && b.status === "missed" && !isEvent && (
        <div className="mt-5 rounded-2xl border border-line bg-white/[0.03] p-4">
          <p className="text-[14px] text-mute">{voice.missed}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <GhostButton
              onClick={() => {
                onClose();
                completeBlock(date, b.id);
              }}
            >
              I did it
            </GhostButton>
            <GhostButton onClick={() => open("skip", { date, id: b.id })}>Give a reason</GhostButton>
          </div>
          <p className="mt-3 text-[12px] text-faint">Corrections are logged and close at the end of tomorrow.</p>
        </div>
      )}

      {/* timing: how far off the plan, and one tip */}
      {!isEvent && b.templateId !== "once" && <TimingNote date={date} b={b} />}

      {/* checklist */}
      {b.checklist && b.checklist.length > 0 && (
        <section className="mt-6">
          <div className="eyebrow mb-2">Checklist</div>
          <div className="overflow-hidden rounded-2xl border border-line">
            {b.checklist.map((item, i) => {
              const on = b.checklistDone?.includes(i);
              return (
                <Pressable
                  key={i}
                  scale={0.99}
                  disabled={!editable}
                  onClick={() => toggleChecklist(date, b.id, i)}
                  className="flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-b-0"
                >
                  <motion.span
                    animate={{ backgroundColor: on ? accent(1) : "rgba(0, 0, 0, 0)", borderColor: on ? accent(1) : "rgba(255, 255, 255, 0.25)" }}
                    transition={{ duration: 0.15 }}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-md border-[1.5px]"
                  >
                    {on && <Icon name="check" size={14} stroke={3} className="text-black" />}
                  </motion.span>
                  <span className={`text-[15px] ${on ? "text-mute line-through decoration-white/20" : ""}`}>{item}</span>
                </Pressable>
              );
            })}
          </div>
        </section>
      )}

      {/* note */}
      <section className="mt-6">
        <div className="eyebrow mb-2">Note</div>
        <input
          value={note}
          disabled={!editable}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => note !== (b.note ?? "") && setNote(date, b.id, note.trim())}
          placeholder="One line. What happened?"
          className="h-12 w-full rounded-2xl border border-line bg-white/[0.04] px-4 text-[15px] text-ink placeholder:text-faint focus:border-ember/50 focus:outline-none"
        />
      </section>

      {/* ratings, if given */}
      {feelLabel(b) && (
        <section className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-white/[0.03] px-4 py-3">
          <span className="text-[13px] text-faint">Felt</span>
          <span className={`text-[15px] font-semibold ${(b.resistance ?? 0) > 7 ? "text-ember-hi" : ""}`}>{feelLabel(b)}</span>
        </section>
      )}

      {/* reminder */}
      {isToday && b.status === "planned" && (
        <section className="mt-6">
          <div className="eyebrow mb-2 flex items-center gap-1.5">
            <Icon name="bell" size={13} /> Remind me before
          </div>
          <LeadPicker id={`lead-${b.id}`} value={leadsOf(b)} onChange={(v) => setReminderLeads(date, b.id, v)} />
        </section>
      )}

      {/* secondary */}
      {editable && (
        <div className="mt-6 flex gap-2">
          {date >= todayKey() && b.templateId !== "gcal" && (
            <GhostButton
              className="flex-1"
              onClick={() => {
                onClose();
                setTimeout(() => open("block", null), 0);
                useUI.getState().openEditor({ mode: "edit", date, id: b.id });
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Icon name="note" size={16} /> Edit
              </span>
            </GhostButton>
          )}
          {b.status === "planned" && !isEvent && (
            <GhostButton className="flex-1" onClick={() => open("skip", { date, id: b.id })}>
              <span className="inline-flex items-center gap-2">
                <Icon name="skip" size={16} /> Skip
              </span>
            </GhostButton>
          )}
          {b.status === "skipped" && (
            <GhostButton className="flex-1" onClick={() => reopen(date, b.id)}>
              <span className="inline-flex items-center gap-2">
                <Icon name="undo" size={16} /> Undo skip
              </span>
            </GhostButton>
          )}
          {doneish && (
            <GhostButton className="flex-1" onClick={() => tick(date, b.id)}>
              <span className="inline-flex items-center gap-2">
                <Icon name="undo" size={16} /> Not done after all
              </span>
            </GhostButton>
          )}
        </div>
      )}
      {!editable && <p className="mt-6 text-center text-[12px] text-faint">This day is locked. The record stands.</p>}
      {b.corrections && b.corrections.length > 0 && (
        <p className="mt-3 text-center text-[12px] text-faint">
          Corrected {b.corrections.length}× · last {new Date(b.corrections[b.corrections.length - 1].at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}

/* ================================================================ Skip reason */

export function SkipSheet() {
  const ref = useUI((s) => s.skip);
  const open = useUI((s) => s.open);
  const b = useStore((s) => (ref ? selectBlock(s, ref.date, ref.id) : undefined));
  const skip = useStore((s) => s.skip);
  const close = () => open("skip", null);
  const choose = (r: SkipReason) => {
    if (!ref) return;
    skip(ref.date, ref.id, r);
    haptic("tap");
    close();
    open("block", null);
  };
  return (
    <Sheet open={!!ref && !!b} onClose={close} label="Skip reason">
      <h2 className="text-[24px] font-semibold tracking-[-0.02em]">{voice.skip.title}</h2>
      <p className="mt-1 text-[15px] text-mute">{voice.skip.sub}</p>
      {(["excused", "miss"] as const).map((g) => (
        <div key={g} className="mt-5">
          <div className="eyebrow mb-2">{g === "excused" ? "Excused · doesn't count against you" : "Counts as a miss"}</div>
          <div className="grid gap-2">
            {SKIP_OPTIONS.filter((o) => o.group === g).map((o) => (
              <Pressable
                key={o.id}
                scale={0.98}
                onClick={() => choose(o.id as SkipReason)}
                className="flex h-14 items-center justify-between rounded-2xl border border-line bg-white/[0.04] px-4 text-left"
              >
                <span className="text-[16px] font-medium">{o.label}</span>
                {"hint" in o && <span className="text-[13px] text-faint">{o.hint}</span>}
              </Pressable>
            ))}
          </div>
        </div>
      ))}
    </Sheet>
  );
}

/* ================================================================ Post-task check-in */

/** One plain question. Doing it when you didn't feel like it is what earns extra credit. */
export const FEELS = [
  { id: "easy", label: "Easy", hint: "Wanted to do it", value: 3 },
  { id: "push", label: "Pushed through", hint: "Didn't feel like it. Did it anyway.", value: 6 },
  { id: "hard", label: "Hard. Did it anyway.", hint: "Everything said quit.", value: 9 },
] as const;

/** "Pushed through" etc. for a block that was answered. */
export function feelLabel(b: Pick<DayBlock, "resistance">): string | null {
  if (b.resistance == null) return null;
  return b.resistance <= 4 ? "Easy" : b.resistance <= 7 ? "Pushed through" : "Hard, did it anyway";
}

export function CheckInSheet() {
  const ref = useUI((s) => s.checkin);
  const open = useUI((s) => s.open);
  const toast = useUI((s) => s.showToast);
  const b = useStore((s) => (ref ? selectBlock(s, ref.date, ref.id) : undefined));
  const setAnswers = useStore((s) => s.setAnswers);
  const [note, setNote] = useState("");
  const [hard, setHard] = useState<boolean | null>(null);

  useEffect(() => {
    if (ref && b) {
      setHard(b.challengeDone ?? null);
      setNote(b.note ?? "");
    }
  }, [ref?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (feel: number | null) => {
    if (!ref || !b) return open("checkin", null);
    const answers = { resistance: feel, energy: null, startDifficulty: null, note: note.trim() || b.note, challengeDone: hard ?? undefined };
    setAnswers(ref.date, ref.id, answers);
    if (difficulty({ ...b, ...answers }) >= 7 && (b.status === "done" || b.status === "partial")) {
      haptic("hard");
      sound("hard");
      toast(voice.stayedHard.title, voice.stayedHard.line, "hard");
    }
    open("checkin", null);
  };

  return (
    <Sheet open={!!ref && !!b} onClose={() => (hard != null || note ? save(b?.resistance ?? null) : open("checkin", null))} label="Check-in">
      {b && (
        <div className="pb-2">
          <div className="flex items-center justify-between">
            <div className="eyebrow">{b.title} · done</div>
            <Pressable onClick={() => (hard != null ? save(null) : open("checkin", null))} className="h-10 rounded-full px-4 text-[14px] font-medium text-mute">
              Skip
            </Pressable>
          </div>

          {b.challenge && (
            <div className="mt-2">
              <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{b.challenge}?</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[true, false].map((v) => (
                  <Pressable
                    key={String(v)}
                    scale={0.96}
                    aria-pressed={hard === v}
                    onClick={() => setHard(hard === v ? null : v)}
                    className={`h-14 rounded-2xl text-[16px] font-semibold transition-colors ${
                      hard === v ? (v ? "bg-ember text-black" : "bg-white/[0.14] text-ink") : "bg-white/[0.05] text-mute"
                    }`}
                  >
                    {v ? `Yes, ${(b.challenge ?? "").toLowerCase()}` : "Not this time"}
                  </Pressable>
                ))}
              </div>
            </div>
          )}

          <h2 className={`${b.challenge ? "mt-6" : "mt-2"} text-[22px] font-semibold tracking-[-0.02em]`}>How was it?</h2>
          <p className="mt-1 text-[13px] text-faint">One tap. Doing it when you didn't feel like it counts for more.</p>
          <div className="mt-4 grid gap-2">
            {FEELS.map((f) => (
              <Pressable
                key={f.id}
                scale={0.98}
                onClick={() => save(f.value)}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left ${f.id === "hard" ? "border-ember/40 bg-ember/[0.08]" : "border-line bg-white/[0.04]"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block text-[16px] font-semibold ${f.id === "hard" ? "text-ember-hi" : ""}`}>{f.label}</span>
                  <span className="block text-[13px] text-faint">{f.hint}</span>
                </span>
                {f.id === "hard" && <span className="shrink-0 rounded-full bg-ember/15 px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-ember-hi uppercase">Stayed hard</span>}
              </Pressable>
            ))}
          </div>

          <input
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder="Add a note first (optional)"
            className="mt-4 h-12 w-full rounded-2xl border border-line bg-white/[0.04] px-4 text-[15px] placeholder:text-faint focus:border-ember/50 focus:outline-none"
          />
        </div>
      )}
    </Sheet>
  );
}

/* ================================================================ Day detail (from the calendar) */

export function DaySheet() {
  const date = useUI((s) => s.day);
  const openDay = useUI((s) => s.openDay);
  const open = useUI((s) => s.open);
  const day = useStore((s) => (date ? s.days[date] : undefined));
  const days = useStore((s) => s.days);
  const openEditor = useUI((s) => s.openEditor);
  const settings = useStore((s) => s.settings);
  const useRestPass = useStore((s) => s.useRestPass);
  const removeRestPass = useStore((s) => s.removeRestPass);
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    setReason("");
    setAsking(false);
  }, [date]);

  if (!date) return <Sheet open={false} onClose={() => {}} label="Day" children={null} />;
  const pct = completion(day);
  const score = dailyScore(day);
  const firstDay = useStore.getState().firstDay ?? todayKey();
  const passesLeft = currentStandard(days, settings, todayKey(), firstDay).passes - restPassesUsedInWeek(days, date);
  const dayStandard = day?.standard ?? settings.streakThreshold;
  const thisWeek = weekStart(date) === weekStart(todayKey());
  const below = pct != null && pct < dayStandard;

  return (
    <Sheet open={!!date} onClose={() => openDay(null)} label="Day detail">
      <div className="eyebrow">{date === todayKey() ? "Today" : "Day"}</div>
      <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.02em]">{fmtDateLong(date)}</h2>

      {!day && date > todayKey() ? (
        <FutureDay date={date} />
      ) : !day ? (
        <p className="mt-4 text-[15px] text-mute">Before you started. Nothing tracked.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat k={`Completed · needed ${dayStandard}%`} v={pct == null ? "–" : `${Math.round(pct)}%`} />
            <Stat k="Discipline score" v={score == null ? "–" : `${Math.round(score)}`} />
          </div>

          {day.restPass && (
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-[#8f9dff]/25 bg-[#8f9dff]/[0.07] p-4">
              <Icon name="shield" size={20} className="mt-0.5 shrink-0 text-skill" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium">Rest pass used</div>
                <div className="text-[14px] text-mute">“{day.restPass.reason}”</div>
              </div>
              {thisWeek && (
                <Pressable onClick={() => removeRestPass(date)} className="text-[13px] text-faint">
                  Undo
                </Pressable>
              )}
            </div>
          )}

          <div className="mt-5 overflow-hidden rounded-2xl border border-line">
            {day.blocks.length === 0 && <div className="p-4 text-[14px] text-mute">Nothing planned.</div>}
            {day.blocks.map((b) => {
              const l = statusLabel(b);
              return (
                <Pressable
                  key={b.id}
                  scale={0.99}
                  onClick={() => open("block", { date, id: b.id })}
                  className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[b.category], opacity: blockCredit(b) > 0 ? 1 : 0.35 }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-medium">{b.title}</span>
                      {stayedHard(b) && <Icon name="bolt" size={14} className="shrink-0 text-ember" fill stroke={0} />}
                    </div>
                    <div className="truncate text-[12px] text-faint">
                      {fmtRange(b.start, b.duration)}
                      {l ? ` · ${l.text}` : ""}
                      {feelLabel(b) ? ` · ${feelLabel(b)!.toLowerCase()}` : ""}
                      {b.note ? ` · “${b.note}”` : ""}
                    </div>
                  </div>
                  <Icon name="right" size={16} className="shrink-0 text-faint" />
                </Pressable>
              );
            })}
          </div>

          {date >= todayKey() && (
            <GhostButton className="mt-3 w-full" onClick={() => openEditor({ mode: "add", date })}>
              <span className="inline-flex items-center gap-2">
                <Icon name="plus" size={16} /> Add to this day
              </span>
            </GhostButton>
          )}

          {!day.restPass && below && thisWeek && date !== todayKey() && (
            <div className="mt-5">
              {!asking ? (
                <GhostButton className="w-full" disabled={passesLeft <= 0} onClick={() => setAsking(true)}>
                  <span className="inline-flex items-center gap-2">
                    <Icon name="shield" size={16} />
                    {passesLeft > 0 ? `Use rest pass · ${passesLeft} left this week` : "No rest pass left this week"}
                  </span>
                </GhostButton>
              ) : (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="rounded-2xl border border-line bg-white/[0.03] p-4">
                  <div className="text-[16px] font-medium">{voice.restPass.title}</div>
                  <p className="mt-1 text-[14px] text-mute">{voice.restPass.sub}</p>
                  <input
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Life happened because…"
                    className="mt-3 h-12 w-full rounded-2xl border border-line bg-white/[0.04] px-4 text-[15px] placeholder:text-faint focus:border-ember/50 focus:outline-none"
                  />
                  <PrimaryButton
                    className="mt-3"
                    disabled={reason.trim().length < 3}
                    onClick={() => {
                      useRestPass(date, reason.trim());
                      haptic("success");
                      setAsking(false);
                    }}
                  >
                    Keep the chain alive
                  </PrimaryButton>
                </motion.div>
              )}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white/[0.03] px-4 py-3">
      <div className="num text-[24px] font-semibold">{v}</div>
      <div className="text-[12px] text-faint">{k}</div>
    </div>
  );
}

/** A day that hasn't started: the routine it will get, plus anything you've added. */
function FutureDay({ date }: { date: string }) {
  const template = useStore((s) => s.template);
  const settings = useStore((s) => s.settings);
  const extra = useStore((s) => s.oneOffs[date]);
  const openEditor = useUI((s) => s.openEditor);
  const planned = [...blocksFor(date, template, settings), ...(extra ?? [])].sort((a, b) => a.start - b.start);
  return (
    <>
      <p className="mt-2 text-[14px] text-mute">Coming up. Plan it now and it'll be waiting.</p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-line">
        {planned.length === 0 && <div className="p-4 text-[14px] text-mute">Nothing in the routine yet.</div>}
        {planned.map((b) => {
          const added = b.templateId === "once";
          return (
            <Pressable
              key={b.id}
              scale={0.99}
              disabled={!added}
              onClick={() => openEditor({ mode: "edit", date, id: b.id })}
              className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0"
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[b.category] }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium">{b.title}</div>
                <div className="truncate text-[12px] text-faint">
                  {fmtRange(b.start, b.duration)}
                  {added ? " · added" : " · routine"}
                </div>
              </div>
              {added && <Icon name="right" size={16} className="shrink-0 text-faint" />}
            </Pressable>
          );
        })}
      </div>
      <PrimaryButton className="mt-4" onClick={() => openEditor({ mode: "add", date })}>
        <span className="inline-flex items-center gap-2">
          <Icon name="plus" size={18} stroke={2.2} /> Add to this day
        </span>
      </PrimaryButton>
    </>
  );
}

/** "On time 3 of 5 · usually 35 min late", plus a one-tap fix when a block keeps running late. */
function TimingNote({ date, b }: { date: string; b: DayBlock }) {
  const days = useStore((s) => s.days);
  const template = useStore((s) => s.template);
  const updateBlock = useStore((s) => s.updateBlock);
  const toast = useUI((s) => s.showToast);
  const today = todayKey();
  const t = timing(days, today, b.templateId, 14);
  const tpl = template.find((x) => x.id === b.templateId);
  const tip = tpl ? timingTip(days, today, tpl.id, tpl.title, tpl.start) : null;
  if (!t.done) return null;
  return (
    <section className="mt-6 rounded-2xl border border-line bg-white/[0.025] p-4">
      <div className="flex items-center justify-between">
        <div className="eyebrow">Timing · last 2 weeks</div>
        <div className="num text-[13px] text-mute">
          {t.onTime} of {t.done} on time
        </div>
      </div>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full bg-good" style={{ width: `${(t.onTime / t.done) * 100}%` }} />
        <div className="h-full bg-warn" style={{ width: `${(t.late / t.done) * 100}%` }} />
      </div>
      {t.late > 0 && <div className="num mt-2 text-[12px] text-faint">Late {t.late}× · usually {t.avgLate} min after the planned start</div>}
      {tip && (
        <div className="mt-3 flex items-start gap-2 text-[13px] text-mute">
          <Icon name="sparkle" size={14} className="mt-0.5 shrink-0 text-ember" />
          <span>{tip.text}</span>
        </div>
      )}
      {tip?.moveTo != null && tpl && (
        <GhostButton
          className="mt-3 w-full"
          onClick={() => {
            updateBlock(
              date,
              b.id,
              { title: tpl.title, date, start: tip.moveTo!, duration: tpl.duration, category: tpl.category, movable: tpl.type !== "fixed", repeat: tpl.days },
              "every",
            );
            toast("Moved", `${tpl.title} now starts at ${fmtTime(tip.moveTo!)}, every week.`);
          }}
        >
          Move it to {fmtTime(tip.moveTo)} every week
        </GhostButton>
      )}
    </section>
  );
}
