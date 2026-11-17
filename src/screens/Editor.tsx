import { useEffect, useMemo, useState } from "react";
import { CATEGORY_COLOR, GhostButton, Icon, Pressable, PrimaryButton, Segmented, Sheet, Toggle } from "../components/ui";
import { haptic } from "../lib/feedback";
import { addDays, DOW_SHORT, fmtDateLong, fmtDuration, fmtRange, fmtTime, fromKey, nowMin, STEP, todayKey } from "../lib/time";
import { leadsOf, type Category, type DateKey } from "../lib/types";
import { LeadPicker } from "../components/LeadPicker";
import { blocksFor, useStore, type BlockInput, type Scope } from "../store/store";
import { useUI } from "../store/ui";

const KINDS: { value: Category; label: string }[] = [
  { value: "skill", label: "Skill" },
  { value: "reading", label: "Reading" },
  { value: "family", label: "Family" },
  { value: "chore", label: "Chore" },
  { value: "body", label: "Body" },
];
const LENGTHS = [15, 30, 45, 60, 90];
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** Add or edit a block or event. Everything snaps to the 15-minute grid. */
type EditorRef = NonNullable<ReturnType<typeof useUI.getState>["editor"]>;

export function EditorSheet() {
  const current = useUI((s) => s.editor);
  // Keep showing the last form while the sheet slides away.
  const [shown, setShown] = useState<EditorRef | null>(current);
  useEffect(() => {
    if (current) setShown(current);
  }, [current]);
  const close = () => useUI.getState().openEditor(null);
  const ed = current ?? shown;
  return (
    <Sheet open={!!current} onClose={close} label={ed?.mode === "edit" ? "Edit" : "Add to your plan"}>
      {ed && <EditorBody key={ed.mode === "edit" ? ed.id : `${ed.date}-${ed.event}`} ed={ed} onClose={close} />}
    </Sheet>
  );
}

function EditorBody({ ed, onClose }: { ed: EditorRef; onClose: () => void }) {
  const toast = useUI((s) => s.showToast);
  const { addBlock, updateBlock, deleteBlock } = useStore.getState();
  const template = useStore((s) => s.template);
  const days = useStore((s) => s.days);
  const oneOffs = useStore((s) => s.oneOffs);
  const settings = useStore((s) => s.settings);
  const today = todayKey();

  const editing =
    ed.mode === "edit" ? (days[ed.date]?.blocks.find((b) => b.id === ed.id) ?? oneOffs[ed.date]?.find((b) => b.id === ed.id)) : undefined;
  const tpl = editing ? template.find((t) => t.id === editing.templateId) : undefined;

  const [isEvent, setIsEvent] = useState(editing ? editing.category === "event" : ed.mode === "add" && !!ed.event);
  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState<Category>(editing && editing.category !== "event" ? editing.category : "skill");
  const [date, setDate] = useState<DateKey>(ed.date);
  const [start, setStart] = useState(() => editing?.start ?? Math.min(20 * 60 + 45, Math.ceil((ed.date === today ? nowMin() + 1 : 18 * 60) / STEP) * STEP));
  const [duration, setDuration] = useState(editing?.duration ?? (isEvent ? 60 : 30));
  const [movable, setMovable] = useState(editing ? editing.type !== "fixed" : true);
  const [challenge, setChallenge] = useState(editing?.challenge ?? "");
  const [alarm, setAlarm] = useState(!!editing?.alarm);
  const defaultLeads = useStore((s) => s.settings.defaultReminderLeads);
  const [leads, setLeads] = useState<number[]>(editing ? leadsOf(editing) : defaultLeads);
  const [weekly, setWeekly] = useState(!!tpl);
  const [repeat, setRepeat] = useState<number[]>(tpl?.days ?? [fromKey(ed.date).getDay()]);
  const [scope, setScope] = useState<Scope>("day");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!weekly) return;
    if (!repeat.length) setRepeat([fromKey(date).getDay()]);
  }, [weekly]); // eslint-disable-line react-hooks/exhaustive-deps

  // What else is on that day, to warn about overlaps.
  const sameDay = useMemo(() => {
    const list = days[date]?.blocks ?? [...blocksFor(date, template, settings), ...(oneOffs[date] ?? [])];
    return list.filter((b) => b.id !== editing?.id && !b.dropped && b.status !== "skipped");
  }, [days, date, template, settings, oneOffs, editing?.id]);
  const clash = sameDay.find((b) => b.start < start + duration && start < b.start + b.duration);

  const input: BlockInput = {
    title,
    date,
    start,
    duration,
    category: isEvent ? "event" : category,
    movable: isEvent ? false : movable,
    repeat: weekly && repeat.length ? [...repeat].sort() : null,
    challenge,
    alarm,
    reminderLeads: leads,
  };
  const canSave = title.trim().length > 0 && start + duration <= 24 * 60;

  const save = () => {
    if (!canSave) return;
    if (editing) updateBlock(ed.date, editing.id, input, tpl ? scope : "day");
    else addBlock(input);
    haptic("success");
    onClose();
    toast(editing ? "Saved" : isEvent ? "Event added" : "Added to your plan", `${title.trim()} · ${input.repeat ? "every " + input.repeat.map((d) => DOW_SHORT[d]).join(", ") : fmtDateLong(date)}`);
  };

  return (
    <div className="pb-2">
      <h2 className="text-[24px] font-semibold tracking-[-0.02em]">{editing ? `Edit ${editing.category === "event" ? "event" : "block"}` : "Add to your plan"}</h2>

      {!editing && (
        <div className="mt-4">
          <Segmented
            id="kind"
            value={isEvent ? "event" : "block"}
            onChange={(v) => {
              setIsEvent(v === "event");
              if (v === "event" && duration < 30) setDuration(60);
            }}
            options={[
              { value: "block", label: "Habit block" },
              { value: "event", label: "Event" },
            ]}
          />
          <p className="mt-2 px-1 text-[12px] text-faint">
            {isEvent ? "Busy time like a dentist or a client. Your blocks plan around it. Not scored." : "Something you'll do and tick off. It counts toward your day."}
          </p>
        </div>
      )}

      <input
        id="block-title"
        autoFocus={!editing}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={isEvent ? "Dentist, client call…" : "Muay Thai, cold shower…"}
        className="mt-5 h-14 w-full rounded-2xl border border-line bg-white/[0.04] px-4 text-[17px] font-medium text-ink placeholder:font-normal placeholder:text-faint focus:border-ember/50 focus:outline-none"
      />

      {!isEvent && (
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {KINDS.map((k) => {
            const on = category === k.value;
            return (
              <Pressable
                key={k.value}
                scale={0.94}
                onClick={() => setCategory(k.value)}
                className={`flex h-10 items-center justify-center gap-1 rounded-full px-1 text-[12px] font-medium transition-colors ${on ? "bg-white/[0.12] text-ink" : "bg-white/[0.04] text-faint"}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[k.value] }} />
                {k.label}
              </Pressable>
            );
          })}
        </div>
      )}

      {/* When */}
      <section className="mt-6">
        <div className="eyebrow mb-2">When</div>
        {(!editing || !tpl || scope === "day") && (
          <Segmented
            id="repeat"
            value={weekly ? "weekly" : "once"}
            onChange={(v) => setWeekly(v === "weekly")}
            options={[
              { value: "once", label: "Once" },
              { value: "weekly", label: "Every week" },
            ]}
          />
        )}
        {weekly ? (
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {WEEK.map((d) => {
              const on = repeat.includes(d);
              return (
                <Pressable
                  key={d}
                  scale={0.9}
                  aria-pressed={on}
                  onClick={() => setRepeat((r) => (on ? r.filter((x) => x !== d) : [...r, d]))}
                  className={`h-11 rounded-xl text-[13px] font-semibold transition-colors ${on ? "bg-ember text-black" : "bg-white/[0.05] text-faint"}`}
                >
                  {DOW_SHORT[d].slice(0, 2)}
                </Pressable>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            {[today, addDays(today, 1)].map((k, i) => (
              <Pressable
                key={k}
                scale={0.95}
                onClick={() => setDate(k)}
                className={`h-11 flex-1 rounded-xl text-[14px] font-medium transition-colors ${date === k ? "bg-white/[0.12] text-ink" : "bg-white/[0.04] text-faint"}`}
              >
                {i === 0 ? "Today" : "Tomorrow"}
              </Pressable>
            ))}
            <label
              className={`relative flex h-11 flex-[1.3] items-center justify-center rounded-xl text-[14px] font-medium ${date !== today && date !== addDays(today, 1) ? "bg-white/[0.12] text-ink" : "bg-white/[0.04] text-faint"}`}
            >
              {date !== today && date !== addDays(today, 1) ? fmtDateLong(date).replace(/^\w+, /, "") : "Pick a day"}
              <input
                type="date"
                aria-label="Pick a day"
                min={today}
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="absolute inset-0 opacity-0"
              />
            </label>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stepper label="Starts" value={fmtTime(start)} onMinus={() => setStart((s) => Math.max(0, s - STEP))} onPlus={() => setStart((s) => Math.min(24 * 60 - STEP, s + STEP))}>
            <input
              type="time"
              step={900}
              aria-label="Start time"
              value={`${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                if (!Number.isNaN(h)) setStart(Math.round((h * 60 + m) / STEP) * STEP);
              }}
              className="absolute inset-0 opacity-0"
            />
          </Stepper>
          <Stepper label="Length" value={fmtDuration(duration)} onMinus={() => setDuration((d) => Math.max(STEP, d - STEP))} onPlus={() => setDuration((d) => Math.min(8 * 60, d + STEP))} />
        </div>
        <div className="mt-2 flex gap-1.5">
          {LENGTHS.map((l) => (
            <Pressable
              key={l}
              scale={0.92}
              onClick={() => setDuration(l)}
              className={`num h-9 flex-1 rounded-lg text-[13px] font-medium transition-colors ${duration === l ? "bg-white/[0.12] text-ink" : "bg-white/[0.03] text-faint"}`}
            >
              {l < 60 ? `${l}m` : fmtDuration(l)}
            </Pressable>
          ))}
        </div>
        {clash && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#fbbf24]/10 px-3 py-2.5 text-[13px] text-[#fcd34d]">
            <Icon name="clock" size={15} className="mt-0.5 shrink-0" />
            Overlaps {clash.title}, {fmtRange(clash.start, clash.duration)}.
          </p>
        )}
      </section>

      {!isEvent && (
        <div className="mt-4 rounded-2xl border border-line px-4 py-3">
          <label htmlFor="block-challenge" className="text-[15px] font-medium">
            Hard version <span className="text-faint">(optional)</span>
          </label>
          <div className="text-[12px] text-faint">Asked when you tick it. Doing it counts as Stayed hard.</div>
          <input
            id="block-challenge"
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            placeholder="Cold, no phone, fasted…"
            className="mt-2 h-11 w-full rounded-xl border border-line bg-white/[0.04] px-3 text-[15px] text-ink placeholder:text-faint focus:border-ember/50 focus:outline-none"
          />
        </div>
      )}

      {!isEvent && (
        <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
          <div className="min-w-0">
            <div className="text-[15px] font-medium">Can move if the day changes</div>
            <div className="text-[12px] text-faint">Off = it stays at this time, like the dogs.</div>
          </div>
          <Toggle label="Can move" on={movable} onChange={setMovable} />
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-line px-4 py-3">
        <div className="mb-3 text-[15px] font-medium">Remind me before</div>
        <LeadPicker id="editor-leads" value={leads} onChange={setLeads} />
      </div>

      {!isEvent && (
        <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
          <div className="min-w-0">
            <div className="text-[15px] font-medium">Alarm</div>
            <div className="text-[12px] text-faint">Rings until you dismiss it. For non-negotiables.</div>
          </div>
          <Toggle label="Alarm" on={alarm} onChange={setAlarm} />
        </div>
      )}

      {editing && tpl && (
        <div className="mt-5">
          <div className="eyebrow mb-2">Change</div>
          <Segmented
            id="scope"
            value={scope}
            onChange={(v) => {
              setScope(v);
              if (v === "every") {
                setWeekly(true);
                setRepeat(tpl.days);
              }
            }}
            options={[
              { value: "day", label: `Just ${ed.date === today ? "today" : "this day"}` },
              { value: "every", label: "Every week" },
            ]}
          />
        </div>
      )}

      <PrimaryButton className="mt-6" disabled={!canSave} onClick={save}>
        {editing ? "Save" : isEvent ? "Add event" : "Add to plan"}
      </PrimaryButton>

      {editing &&
        (!confirmDelete ? (
          <GhostButton className="mt-2 w-full text-red-300" onClick={() => setConfirmDelete(true)}>
            Delete
          </GhostButton>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <GhostButton
              onClick={() => {
                deleteBlock(ed.date, editing.id, "day");
                onClose();
                useUI.getState().open("block", null);
              }}
            >
              {tpl ? "Just this day" : "Delete it"}
            </GhostButton>
            {tpl ? (
              <Pressable
                onClick={() => {
                  deleteBlock(ed.date, editing.id, "every");
                  onClose();
                  useUI.getState().open("block", null);
                }}
                className="h-12 rounded-2xl bg-red-500/90 font-medium text-white"
              >
                Every week
              </Pressable>
            ) : (
              <GhostButton onClick={() => setConfirmDelete(false)}>Keep it</GhostButton>
            )}
          </div>
        ))}
    </div>
  );
}

function Stepper({ label, value, onMinus, onPlus, children }: { label: string; value: string; onMinus: () => void; onPlus: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex items-center rounded-2xl border border-line bg-white/[0.03] p-1">
      <Pressable aria-label={`${label} earlier`} onClick={onMinus} className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-mute">
        <Icon name="minus" size={16} />
      </Pressable>
      <div className="relative min-w-0 flex-1 text-center">
        <div className="text-[11px] text-faint">{label}</div>
        <div className="num text-[16px] font-semibold">{value}</div>
        {children}
      </div>
      <Pressable aria-label={`${label} later`} onClick={onPlus} className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-mute">
        <Icon name="plus" size={16} />
      </Pressable>
    </div>
  );
}
