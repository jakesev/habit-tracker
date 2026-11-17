import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Check } from "../components/Check";
import { CATEGORY_COLOR, CATEGORY_LABEL, GhostButton, Icon, Pressable, PrimaryButton, Scale, Segmented, Sheet, spring } from "../components/ui";
import { haptic, sound } from "../lib/feedback";
import { useAccent } from "../lib/identity";
import { blockCredit, completion, dailyScore, difficulty, restPassesUsedInWeek, stayedHard } from "../lib/score";
import { fmtDateLong, fmtDuration, fmtRange, todayKey, weekStart } from "../lib/time";
import type { DayBlock, SkipReason } from "../lib/types";
import { SKIP_OPTIONS, voice } from "../lib/voice";
import { isEditable, selectBlock, useStore } from "../store/store";
import { useUI } from "../store/ui";
import { completeBlock } from "./actions";
import { statusLabel } from "./Today";

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
  const { setNote, setReminderLead, toggleChecklist, reopen, tick } = useStore.getState();
  const focus = useStore((s) => s.focus);
  const open = useUI((s) => s.open);
  const [note, setLocal] = useState(b.note ?? "");
  const editable = isEditable(date);
  const isToday = date === todayKey();
  const label = statusLabel(b);
  const doneish = b.status === "done" || b.status === "partial";

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
        <Check
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
        />
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
      {editable && b.status === "planned" && isToday && (
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
      {editable && b.status === "missed" && (
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
      {(b.resistance != null || b.energy != null || b.startDifficulty != null) && (
        <section className="mt-6 grid grid-cols-3 gap-2">
          {[
            ["Excuse", b.resistance],
            ["Tank", b.energy],
            ["Getting moving", b.startDifficulty],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-2xl border border-line bg-white/[0.03] px-3 py-3 text-center">
              <div className="num text-[22px] font-semibold">{v ?? "–"}</div>
              <div className="mt-0.5 text-[11px] text-faint">{k}</div>
            </div>
          ))}
        </section>
      )}

      {/* reminder */}
      {isToday && b.status === "planned" && (
        <section className="mt-6">
          <div className="eyebrow mb-2 flex items-center gap-1.5">
            <Icon name="bell" size={13} /> Remind me before
          </div>
          <Segmented
            id={`lead-${b.id}`}
            value={b.reminderLead}
            onChange={(v) => setReminderLead(date, b.id, v)}
            options={[5, 10, 15, 30, 60].map((m) => ({ value: m, label: `${m}m` }))}
          />
        </section>
      )}

      {/* secondary */}
      {editable && (
        <div className="mt-6 flex gap-2">
          {b.status === "planned" && (
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

export function CheckInSheet() {
  const ref = useUI((s) => s.checkin);
  const open = useUI((s) => s.open);
  const toast = useUI((s) => s.showToast);
  const b = useStore((s) => (ref ? selectBlock(s, ref.date, ref.id) : undefined));
  const setAnswers = useStore((s) => s.setAnswers);
  const timing = useStore((s) => s.settings.questionTiming);
  const [r, setR] = useState<number | null>(null);
  const [e, setE] = useState<number | null>(null);
  const [d, setD] = useState<number | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (ref && b) {
      setR(b.resistance ?? null);
      setE(b.energy ?? null);
      setD(b.startDifficulty ?? null);
      setNote(b.note ?? "");
    }
  }, [ref?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (save: boolean) => {
    if (!ref || !b) return open("checkin", null);
    if (save) {
      setAnswers(ref.date, ref.id, { resistance: r, energy: e, startDifficulty: d, note: note.trim() || b.note });
      const hard = difficulty({ ...b, resistance: r, energy: e, startDifficulty: d }) >= 7;
      if (hard && (b.status === "done" || b.status === "partial")) {
        haptic("hard");
        sound("hard");
        toast(voice.stayedHard.title, voice.stayedHard.line, "hard");
      }
    }
    open("checkin", null);
  };

  return (
    <Sheet open={!!ref && !!b} onClose={() => finish(r != null || e != null || d != null || !!note)} label="Check-in">
      {b && (
        <div>
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">{b.title} · done</div>
              <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.02em]">{voice.checkIn.title}</h2>
            </div>
            <Pressable onClick={() => finish(false)} className="h-10 rounded-full px-4 text-[14px] font-medium text-mute">
              Skip
            </Pressable>
          </div>
          <p className="mt-1 text-[14px] text-faint">{voice.checkIn.sub}</p>

          <div className="mt-6 space-y-6">
            {timing === "after" && (
              <Q title={voice.checkIn.resistance.q}>
                <Scale value={r} onChange={setR} lo={voice.checkIn.resistance.lo} hi={voice.checkIn.resistance.hi} />
              </Q>
            )}
            <Q title={voice.checkIn.energy.q}>
              <Scale value={e} onChange={setE} lo={voice.checkIn.energy.lo} hi={voice.checkIn.energy.hi} invert />
            </Q>
            <Q title={voice.checkIn.start.q}>
              <Scale value={d} onChange={setD} lo={voice.checkIn.start.lo} hi={voice.checkIn.start.hi} />
            </Q>
            <input
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder="Optional note"
              className="h-12 w-full rounded-2xl border border-line bg-white/[0.04] px-4 text-[15px] placeholder:text-faint focus:border-ember/50 focus:outline-none"
            />
          </div>
          <PrimaryButton className="mt-6" onClick={() => finish(true)}>
            Log it
          </PrimaryButton>
        </div>
      )}
    </Sheet>
  );
}

function Q({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-[16px] font-medium tracking-[-0.01em]">{title}</div>
      {children}
    </div>
  );
}

/* ================================================================ Day detail (from the calendar) */

export function DaySheet() {
  const date = useUI((s) => s.day);
  const openDay = useUI((s) => s.openDay);
  const open = useUI((s) => s.open);
  const day = useStore((s) => (date ? s.days[date] : undefined));
  const days = useStore((s) => s.days);
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
  const passesLeft = settings.restPassesPerWeek - restPassesUsedInWeek(days, date);
  const thisWeek = weekStart(date) === weekStart(todayKey());
  const below = pct != null && pct < settings.streakThreshold;

  return (
    <Sheet open={!!date} onClose={() => openDay(null)} label="Day detail">
      <div className="eyebrow">{date === todayKey() ? "Today" : "Day"}</div>
      <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.02em]">{fmtDateLong(date)}</h2>

      {!day ? (
        <p className="mt-4 text-[15px] text-mute">Before you started. Nothing tracked.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat k="Completed" v={pct == null ? "–" : `${Math.round(pct)}%`} />
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
                      {b.resistance != null ? ` · excuse ${b.resistance}/10` : ""}
                      {b.note ? ` · “${b.note}”` : ""}
                    </div>
                  </div>
                  <Icon name="right" size={16} className="shrink-0 text-faint" />
                </Pressable>
              );
            })}
          </div>

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
