import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { HOME_BLOCKS } from "../lib/seed";
import { isCustom, programTemplate } from "../lib/program";
import type { PlanResult } from "../lib/plan";
import { currentStandard, GRACE } from "../lib/score";
import { mergeBusy } from "../lib/gcal-map";
import { addDays, diffDays, fromKey, nowMin, snapDuration, todayKey } from "../lib/time";
import {
  EXCUSED_REASONS,
  type Category,
  type LogEntry,
  type Day,
  type DayBlock,
  type DateKey,
  type FocusSession,
  type Settings,
  type SkipReason,
  type TemplateBlock,
} from "../lib/types";

export const DEFAULT_SETTINGS: Settings = {
  streakThreshold: 80,
  restPassesPerWeek: 1,
  defaultReminderLead: 10,
  defaultReminderLeads: [10],
  questionTiming: "after",
  haptics: true,
  sound: true,
  notifications: false,
  familyNight: 6,
  theme: "vermilion",
  notificationsAsked: false,
  upNext: true,
  transition: 5,
  homeTime: 17 * 60,
  bedTime: 21 * 60,
};

/** What the add / edit form produces. Times are on the 15-minute grid. */
export interface BlockInput {
  title: string;
  date: DateKey;
  start: number;
  duration: number;
  category: Category;
  movable: boolean;
  /** Weekdays (0 = Sun) it repeats on, or null for just this day. */
  repeat: number[] | null;
  /** The hard version, e.g. "Cold". */
  challenge?: string;
  /** Rings until dismissed. */
  alarm?: boolean;
  /** Heads-ups, minutes before. */
  reminderLeads?: number[];
}
export type Scope = "day" | "every";

/** Google Calendar connection (see lib/cloud.ts, lib/gcal.ts). */
export interface CloudState {
  connected: boolean;
  email?: string;
  calendarId?: string;
  /** Put my blocks in the app's own calendar. */
  write: boolean;
  /** Read my other calendars as busy time. */
  read: boolean;
  lastSync?: number;
  error?: string;
}
const DEFAULT_CLOUD: CloudState = { connected: false, write: true, read: true };

export type Answers = Partial<Pick<DayBlock, "resistance" | "energy" | "startDifficulty" | "note" | "challengeDone">>;

/** Was a block done on time? Late = started more than 15 min after its planned start. */
export function lateness(b: Pick<DayBlock, "start" | "duration" | "until">, doneAt: number, startedAt?: number) {
  // Anytime blocks: on time anywhere inside their window.
  if (b.until != null) return doneAt > b.until ? { late: true, lateBy: Math.round(doneAt - b.until) } : { late: false, lateBy: 0 };
  const began = startedAt ?? doneAt - b.duration;
  const lateBy = Math.max(0, Math.round(began - b.start));
  const late = startedAt != null ? lateBy > GRACE : doneAt > b.start + b.duration + GRACE;
  return { late, lateBy: late ? lateBy : 0 };
}

interface State {
  firstDay: DateKey | null;
  template: TemplateBlock[];
  days: Record<DateKey, Day>;
  settings: Settings;
  focus: FocusSession | null;
  /** Blocks added for days that haven't started yet; merged in when the day begins. */
  oneOffs: Record<DateKey, DayBlock[]>;
  cloud: CloudState;
  setCloud: (p: Partial<CloudState>) => void;
  /** Replace a day's Google busy blocks with a fresh read. */
  applyBusy: (date: DateKey, busy: DayBlock[]) => void;

  /** Switch the plan to a phase (Warm-up, Build, Strong). Today keeps what's done. */
  setProgram: (phase: number) => void;
  addBlock: (input: BlockInput) => void;
  updateBlock: (date: DateKey, id: string, input: BlockInput, scope: Scope) => void;
  deleteBlock: (date: DateKey, id: string, scope: Scope) => void;

  ensureDays: (now?: Date) => void;
  tick: (date: DateKey, id: string) => void;
  /** Mark done at a given time (minutes). Late if after the time + grace: half credit. */
  markDone: (date: DateKey, id: string, at: number) => void;
  addLog: (date: DateKey, e: Omit<LogEntry, "id">) => void;
  removeLog: (date: DateKey, id: string) => void;
  setAnswers: (date: DateKey, id: string, a: Answers) => void;
  setNote: (date: DateKey, id: string, note: string) => void;
  skip: (date: DateKey, id: string, reason: SkipReason) => void;
  reopen: (date: DateKey, id: string) => void;
  setReminderLead: (date: DateKey, id: string, lead: number) => void;
  setReminderLeads: (date: DateKey, id: string, leads: number[]) => void;
  toggleChecklist: (date: DateKey, id: string, i: number) => void;

  startFocus: (date: DateKey, id: string, minutes: number) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  markBuzz: (k: "buzzedHalf" | "buzzedTwo") => void;
  finishFocus: (outcome: "done" | "partial" | "skipped", focusedMs?: number) => void;
  cancelFocus: () => void;

  applyHomePlan: (date: DateKey, plan: PlanResult) => void;
  undoHome: (date: DateKey) => void;
  useRestPass: (date: DateKey, reason: string) => void;
  removeRestPass: (date: DateKey) => void;
  updateSettings: (s: Partial<Settings>) => void;
  importData: (json: string) => boolean;
  resetAll: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function blocksFor(date: DateKey, template: TemplateBlock[], settings: Settings): DayBlock[] {
  const dow = fromKey(date).getDay();
  return template
    .filter((t) => t.days.includes(dow))
    .sort((a, b) => a.start - b.start)
    .map((t) => ({
      id: `${t.id}-${uid()}`,
      templateId: t.id,
      title: t.title,
      subtitle: t.subtitle,
      category: t.category,
      type: t.type,
      priority: t.priority,
      start: t.start,
      duration: snapDuration(t.duration),
      minDuration: snapDuration(t.minDuration),
      checklist: t.checklist,
      homeAnchor: t.homeAnchor,
      challenge: t.challenge,
      alarm: t.alarm,
      anytime: t.anytime,
      until: t.until,
      status: "planned",
      reminderLead: settings.defaultReminderLead,
      reminderLeads: t.reminderLeads ?? settings.defaultReminderLeads,
    }));
}

function instance(t: TemplateBlock, settings: Settings): DayBlock {
  return {
    id: `${t.id}-${uid()}`,
    templateId: t.id,
    title: t.title,
    subtitle: t.subtitle,
    category: t.category,
    type: t.type,
    priority: t.priority,
    start: t.start,
    duration: snapDuration(t.duration),
    minDuration: snapDuration(t.minDuration),
    checklist: t.checklist,
    homeAnchor: t.homeAnchor,
    challenge: t.challenge,
    alarm: t.alarm,
    anytime: t.anytime,
    until: t.until,
    status: "planned",
    reminderLead: settings.defaultReminderLead,
    reminderLeads: t.reminderLeads ?? settings.defaultReminderLeads,
  };
}

function blockFields(i: BlockInput) {
  const duration = snapDuration(i.duration);
  const event = i.category === "event";
  return {
    title: i.title.trim() || "Untitled",
    start: Math.round(i.start / 15) * 15,
    duration,
    category: i.category,
    type: (event || !i.movable ? "fixed" : "flexible") as TemplateBlock["type"],
    minDuration: event || !i.movable ? duration : 15,
    challenge: event ? undefined : i.challenge?.trim() || undefined,
    alarm: !!i.alarm,
    ...(i.reminderLeads ? { reminderLeads: [...i.reminderLeads].sort((a, c) => c - a) } : {}),
  };
}

function toTemplate(i: BlockInput, id: string): TemplateBlock {
  const f = blockFields(i);
  return { id, ...f, days: i.repeat ?? [], priority: i.category === "skill" || i.category === "reading" ? 4 : 3 };
}

function oneOff(i: BlockInput, settings: Settings): DayBlock {
  return { ...instance({ ...toTemplate(i, "once"), days: [] }, settings), id: `once-${uid()}`, templateId: "once" };
}

const sortDay = (d: Day): Day => ({ ...d, blocks: [...d.blocks].sort((a, b) => a.start - b.start) });
const withBlock = (d: Day, b: DayBlock): Day => sortDay({ ...d, blocks: [...d.blocks, b] });

/**
 * Lay today and tomorrow out again from a new template. Anything already done, skipped,
 * missed, added by hand or from Google stays; blocks whose time has already passed today
 * aren't added (they'd only count against you).
 */
export function rebuildDays(days: Record<DateKey, Day>, template: TemplateBlock[], settings: Settings, today: DateKey, now: number) {
  const out = { ...days };
  for (const k of [today, addDays(today, 1)]) {
    const d = out[k];
    if (!d) continue;
    const keep = d.blocks.filter((b) => b.status !== "planned" || b.templateId === "once" || b.templateId === "gcal" || isCustom(b.templateId));
    const kept = new Set(keep.map((b) => b.templateId));
    const fresh = blocksFor(k, template, settings).filter((b) => !kept.has(b.templateId) && (k !== today || (b.until ?? b.start + b.duration + GRACE) > now));
    out[k] = { ...d, blocks: [...keep, ...fresh].sort((a, b) => a.start - b.start), homeAt: undefined, beforeHome: undefined };
  }
  return out;
}

/** Corrections are allowed until the end of the next day. */
export const isEditable = (date: DateKey, today = todayKey()) => diffDays(date, today) <= 1;

function log(b: DayBlock, field: string, from: unknown, to: unknown, date: DateKey): DayBlock {
  // Only past days keep a correction trail; today is just normal use.
  if (date === todayKey()) return b;
  return { ...b, corrections: [...(b.corrections ?? []), { at: Date.now(), field, from, to }] };
}

const safeStorage = createJSONStorage(() => {
  try {
    const k = "__stride_probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const patch = (date: DateKey, id: string, fn: (b: DayBlock) => DayBlock) =>
        set((s) => {
          const d = s.days[date];
          if (!d) return s;
          return { days: { ...s.days, [date]: { ...d, blocks: d.blocks.map((b) => (b.id === id ? fn(b) : b)) } } };
        });

      return {
        firstDay: null,
        template: programTemplate(1, DEFAULT_SETTINGS.familyNight),
        days: {},
        settings: DEFAULT_SETTINGS,
        focus: null,
        oneOffs: {},
        cloud: DEFAULT_CLOUD,
        setCloud: (p) => set((s) => ({ cloud: { ...s.cloud, ...p } })),
        applyBusy: (date, incoming) =>
          set((s) => {
            const busy = [...incoming].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
            const d = s.days[date];
            if (!d) return s;
            const old = d.blocks.filter((b) => b.templateId === "gcal").sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
            const same = old.length === busy.length && old.every((b, i) => b.id === busy[i]?.id && b.start === busy[i].start && b.duration === busy[i].duration && b.title === busy[i].title);
            if (same) return s;
            return { days: { ...s.days, [date]: { ...d, blocks: mergeBusy(d.blocks, busy) } } };
          }),

        setProgram: (phase) =>
          set((s) => {
            const today = todayKey();
            const template = [...programTemplate(phase, s.settings.familyNight), ...s.template.filter((t) => isCustom(t.id))];
            return {
              template,
              days: rebuildDays(s.days, template, s.settings, today, nowMin()),
              settings: { ...s.settings, program: { phase, since: today } },
            };
          }),

        addBlock: (input) =>
          set((s) => {
            const days = { ...s.days };
            const oneOffs = { ...s.oneOffs };
            let template = s.template;
            if (input.repeat?.length) {
              const t = toTemplate(input, `tpl-${uid()}`);
              template = [...template, t];
              // Days already laid out (today, tomorrow) get it too, from the chosen date on.
              for (const k of Object.keys(days)) {
                if (k >= input.date && k >= todayKey() && t.days.includes(fromKey(k).getDay()))
                  days[k] = withBlock(days[k], instance(t, s.settings));
              }
            } else {
              const b = oneOff(input, s.settings);
              if (days[input.date]) days[input.date] = withBlock(days[input.date], b);
              else oneOffs[input.date] = [...(oneOffs[input.date] ?? []), b];
            }
            return { days, oneOffs, template };
          }),

        updateBlock: (date, id, input, scope) =>
          set((s) => {
            const days = { ...s.days };
            const oneOffs = { ...s.oneOffs };
            const src = days[date]?.blocks.find((b) => b.id === id) ?? oneOffs[date]?.find((b) => b.id === id);
            if (!src) return s;
            let template = s.template;
            const fields = blockFields(input);
            if (scope === "every" && template.some((t) => t.id === src.templateId)) {
              template = template.map((t) => (t.id === src.templateId ? { ...toTemplate(input, t.id), checklist: t.checklist, subtitle: t.subtitle, priority: t.priority, homeAnchor: t.homeAnchor, days: input.repeat?.length ? input.repeat : t.days } : t));
              const t = template.find((x) => x.id === src.templateId)!;
              for (const k of Object.keys(days)) {
                if (k < todayKey()) continue;
                const d = days[k];
                const has = d.blocks.some((b) => b.templateId === t.id);
                const should = t.days.includes(fromKey(k).getDay());
                if (has && !should) days[k] = { ...d, blocks: d.blocks.filter((b) => b.templateId !== t.id || b.status !== "planned") };
                else if (has) days[k] = sortDay({ ...d, blocks: d.blocks.map((b) => (b.templateId === t.id && b.status === "planned" ? { ...b, ...fields } : b)) });
                else if (should) days[k] = withBlock(d, instance(t, s.settings));
              }
              return { days, template };
            }
            // Just this day (or a one-off). Moving it to another date moves the block.
            const moved = { ...src, ...fields };
            if (days[date]) days[date] = { ...days[date], blocks: days[date].blocks.filter((b) => b.id !== id) };
            if (oneOffs[date]) oneOffs[date] = oneOffs[date].filter((b) => b.id !== id);
            if (days[input.date]) days[input.date] = withBlock(days[input.date], moved);
            else oneOffs[input.date] = [...(oneOffs[input.date] ?? []), moved];
            return { days, oneOffs };
          }),

        deleteBlock: (date, id, scope) =>
          set((s) => {
            const days = { ...s.days };
            const oneOffs = { ...s.oneOffs };
            const src = days[date]?.blocks.find((b) => b.id === id) ?? oneOffs[date]?.find((b) => b.id === id);
            if (!src) return s;
            let template = s.template;
            if (scope === "every" && template.some((t) => t.id === src.templateId)) {
              template = template.filter((t) => t.id !== src.templateId);
              for (const k of Object.keys(days))
                if (k >= todayKey()) days[k] = { ...days[k], blocks: days[k].blocks.filter((b) => b.templateId !== src.templateId || (b.status !== "planned" && b.id !== id)) };
            }
            if (days[date]) days[date] = { ...days[date], blocks: days[date].blocks.filter((b) => b.id !== id) };
            if (oneOffs[date]) oneOffs[date] = oneOffs[date].filter((b) => b.id !== id);
            return { days, oneOffs, template };
          }),

        ensureDays: (now = new Date()) => {
          const s = get();
          const today = todayKey(now);
          const first = s.firstDay ?? today;
          const days = { ...s.days };
          let changed = !s.firstDay;
          // Tomorrow is created a day early so its reminders can be scheduled tonight.
          const tomorrow = addDays(today, 1);
          // New days take the standard of the level you're at when they begin.
          const standard = currentStandard(days, s.settings, today, first).threshold;
          for (let k = first; diffDays(k, tomorrow) >= 0; k = addDays(k, 1)) {
            if (!days[k]) {
              const extra = s.oneOffs[k] ?? [];
              // Your very first day starts now: blocks already over aren't held against you.
              const fresh = blocksFor(k, s.template, s.settings).filter((b) => !(k === today && !s.firstDay && (b.until ?? b.start + b.duration + GRACE) <= nowMin(now)));
              days[k] = { date: k, blocks: [...fresh, ...extra].sort((a, b) => a.start - b.start), standard };
              if (extra.length) {
                const { [k]: _used, ...rest } = get().oneOffs;
                set({ oneOffs: rest });
              }
              changed = true;
            } else if (k >= today && days[k].standard == null) {
              days[k] = { ...days[k], standard };
              changed = true;
            }
            // Auto-miss: a planned block whose window has closed becomes Not done.
            const cutoff = k === today ? nowMin(now) : k > today ? -Infinity : Infinity;
            const d = days[k];
            let dirty = false;
            const blocks = d.blocks.map((b) => {
              const running = s.focus?.blockId === b.id;
              // Shower and dinner wait for "I'm home"; if it never comes they close at bed time.
              // 15 minutes of grace after the planned end before it's Not done.
              const end = b.until ?? (b.homeAnchor && d.homeAt == null && k === today ? s.settings.bedTime : b.start + b.duration + GRACE);
              if (b.category !== "event" && b.status === "planned" && !running && end <= cutoff) {
                dirty = true;
                return { ...b, status: "missed" as const };
              }
              return b;
            });
            if (dirty) {
              days[k] = { ...d, blocks };
              changed = true;
            }
          }
          if (changed) set({ days, firstDay: first });
        },

        tick: (date, id) =>
          patch(date, id, (b) => {
            const doneish = b.status === "done" || b.status === "partial";
            const to = doneish ? (date === todayKey() ? "planned" : "missed") : "done";
            const at = Math.floor(nowMin());
            const next: DayBlock = {
              ...b,
              status: to,
              completedAt: to === "done" ? Date.now() : undefined,
              doneAt: to === "done" ? at : undefined,
              ...(to === "done" && date === todayKey() ? lateness(b, at) : { late: undefined, lateBy: undefined }),
              challengeDone: to === "done" ? b.challengeDone : undefined,
              skipReason: undefined,
              excused: undefined,
            };
            return log(next, "status", b.status, to, date);
          }),

        markDone: (date, id, at) =>
          patch(date, id, (b) => {
            const { late, lateBy } = lateness(b, at);
            const next: DayBlock = { ...b, status: "done", completedAt: Date.now(), doneAt: at, late, lateBy, skipReason: undefined, excused: undefined };
            return log(next, "status", b.status, late ? `done late (${lateBy}m)` : "done on time", date);
          }),

        addLog: (date, e) =>
          set((s) => {
            const d = s.days[date];
            if (!d) return s;
            const logs = [...(d.logs ?? []), { ...e, id: uid() }].sort((a, b) => a.at - b.at);
            return { days: { ...s.days, [date]: { ...d, logs } } };
          }),
        removeLog: (date, id) =>
          set((s) => {
            const d = s.days[date];
            if (!d) return s;
            return { days: { ...s.days, [date]: { ...d, logs: (d.logs ?? []).filter((l) => l.id !== id) } } };
          }),

        setAnswers: (date, id, a) =>
          patch(date, id, (b) => {
            const next = { ...b, ...a };
            const vals = [next.resistance, next.startDifficulty, next.energy != null ? 11 - next.energy : null].filter(
              (v): v is number => v != null,
            );
            next.didItAnyway =
              (next.status === "done" || next.status === "partial") &&
              vals.length > 0 &&
              vals.reduce((x, y) => x + y, 0) / vals.length >= 7;
            return next;
          }),

        setNote: (date, id, note) => patch(date, id, (b) => ({ ...b, note })),

        skip: (date, id, reason) =>
          patch(date, id, (b) =>
            log(
              { ...b, status: "skipped", skipReason: reason, excused: EXCUSED_REASONS.includes(reason), completedAt: undefined },
              "status",
              b.status,
              `skipped:${reason}`,
              date,
            ),
          ),

        reopen: (date, id) =>
          patch(date, id, (b) => {
            const end = b.start + b.duration;
            const to = date === todayKey() && nowMin() < end ? "planned" : "missed";
            return log({ ...b, status: to, skipReason: undefined, excused: undefined, dropped: undefined }, "status", b.status, to, date);
          }),

        setReminderLead: (date, id, lead) => patch(date, id, (b) => ({ ...b, reminderLead: lead })),
        setReminderLeads: (date, id, leads) => patch(date, id, (b) => ({ ...b, reminderLeads: [...leads].sort((a, c) => c - a), reminderLead: leads.length ? Math.min(...leads) : b.reminderLead })),

        toggleChecklist: (date, id, i) =>
          patch(date, id, (b) => {
            const cur = new Set(b.checklistDone ?? []);
            cur.has(i) ? cur.delete(i) : cur.add(i);
            return { ...b, checklistDone: [...cur].sort() };
          }),

        startFocus: (date, id, minutes) => {
          // Timers move in 5-minute steps (blocks stay on the 15-minute grid).
          const ms = Math.max(5, Math.round(minutes / 5) * 5) * 60_000;
          const now = Date.now();
          set({ focus: { date, blockId: id, totalMs: ms, startedAt: now, endsAt: now + ms, pausedRemaining: null } });
          patch(date, id, (b) => ({ ...b, actualStart: b.actualStart ?? now }));
        },
        pauseFocus: () => {
          const f = get().focus;
          if (!f || f.endsAt == null) return;
          set({ focus: { ...f, endsAt: null, pausedRemaining: Math.max(0, f.endsAt - Date.now()) } });
        },
        resumeFocus: () => {
          const f = get().focus;
          if (!f || f.pausedRemaining == null) return;
          set({ focus: { ...f, endsAt: Date.now() + f.pausedRemaining, pausedRemaining: null } });
        },
        markBuzz: (k) => {
          const f = get().focus;
          if (f) set({ focus: { ...f, [k]: true } });
        },
        finishFocus: (outcome, focusedMs) => {
          const f = get().focus;
          if (!f) return;
          const remaining = f.endsAt != null ? Math.max(0, f.endsAt - Date.now()) : f.pausedRemaining ?? 0;
          const ms = focusedMs ?? f.totalMs - remaining;
          const mins = Math.round(ms / 60_000);
          patch(f.date, f.blockId, (b) => {
            const at = Math.floor(nowMin());
            const started = b.actualStart ? new Date(b.actualStart).getHours() * 60 + new Date(b.actualStart).getMinutes() : undefined;
            const base = { ...b, focusedMinutes: (b.focusedMinutes ?? 0) + mins, timerCompleted: remaining <= 1000, doneAt: at, ...lateness(b, at, started) };
            if (outcome === "done") return { ...base, status: "done", completedAt: Date.now() };
            if (outcome === "partial") return { ...base, status: "partial", completedAt: Date.now() };
            return { ...base, status: "skipped", skipReason: "chose-else", excused: false };
          });
          set({ focus: null });
        },
        cancelFocus: () => set({ focus: null }),

        applyHomePlan: (date, plan) =>
          set((s) => {
            const d = s.days[date];
            if (!d) return s;
            return {
              days: { ...s.days, [date]: { ...d, blocks: plan.blocks, homeAt: plan.homeAt, beforeHome: d.beforeHome ?? d.blocks } },
            };
          }),
        undoHome: (date) =>
          set((s) => {
            const d = s.days[date];
            if (!d?.beforeHome) return s;
            const { beforeHome, homeAt: _h, ...rest } = d;
            // Keep anything ticked since; restore the rest to the old plan.
            const now = new Map(d.blocks.map((b) => [b.id, b]));
            const blocks = beforeHome.map((b) => {
              const cur = now.get(b.id);
              return cur && cur.status !== "planned" && cur.status !== "skipped" ? cur : b;
            });
            return { days: { ...s.days, [date]: { ...rest, blocks } } };
          }),

        useRestPass: (date, reason) =>
          set((s) => ({ days: { ...s.days, [date]: { ...s.days[date], restPass: { reason, at: Date.now() } } } })),
        removeRestPass: (date) =>
          set((s) => {
            const { restPass: _r, ...rest } = s.days[date];
            return { days: { ...s.days, [date]: rest } };
          }),

        updateSettings: (p) =>
          set((s) => {
            const settings = { ...s.settings, ...p };
            let template = s.template;
            if (p.familyNight != null) {
              template = template.map((t) => (t.id === "family-night" ? { ...t, days: [p.familyNight!] } : t));
            }
            return { settings, template };
          }),

        importData: (json) => {
          try {
            const d = JSON.parse(json);
            if (!d || typeof d !== "object" || !d.days || !d.template) return false;
            set({
              firstDay: d.firstDay ?? null,
              template: d.template,
              days: d.days,
              settings: { ...DEFAULT_SETTINGS, ...d.settings },
              focus: null,
            });
            return true;
          } catch {
            return false;
          }
        },

        resetAll: () =>
          set({
            firstDay: null,
            template: programTemplate(1, DEFAULT_SETTINGS.familyNight),
            days: {},
            settings: DEFAULT_SETTINGS,
            focus: null,
            oneOffs: {},
            cloud: get().cloud,
          }),
      };
    },
    {
      name: "stride-routine-v1",
      storage: safeStorage,
      version: 7,
      // New settings get their defaults even when older saved data doesn't have them.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p.settings }, cloud: { ...DEFAULT_CLOUD, ...p.cloud } };
      },
      migrate: (persisted, from) => {
        const p = persisted as { template?: { id: string }[]; settings?: object; days?: Record<string, { date: string; blocks: { templateId: string }[] }> };
        if (from < 2) {
          // v2: shower + dinner, placed when you tap "I'm home".
          if (p.template && p.template.some((t) => t.id === "writing") && !p.template.some((t) => t.id === "shower")) p.template = [...HOME_BLOCKS, ...p.template];
          p.settings = { ...DEFAULT_SETTINGS, ...p.settings };
          const today = todayKey();
          for (const k of Object.keys(p.days ?? {})) {
            const d = p.days![k];
            if (k < today || d.blocks.some((b) => b.templateId === "shower")) continue;
            const dow = fromKey(k).getDay();
            const add = HOME_BLOCKS.filter((t) => t.days.includes(dow)).map((t) => ({
              id: `${t.id}-${uid()}`,
              templateId: t.id,
              title: t.title,
              subtitle: t.subtitle,
              category: t.category,
              type: t.type,
              priority: t.priority,
              start: t.start,
              duration: t.duration,
              minDuration: t.minDuration,
              homeAnchor: true,
              status: "planned",
              reminderLead: DEFAULT_SETTINGS.defaultReminderLead,
            }));
            d.blocks = ([...add, ...d.blocks] as unknown as { start: number }[]).sort((a, b) => a.start - b.start) as unknown as typeof d.blocks;
          }
        }
        if (from < 4) {
          // v4: the shower's hard version is a cold shower.
          type T = { id: string; challenge?: string; subtitle?: string };
          p.template = (p.template as T[] | undefined)?.map((t) => (t.id === "shower" && !t.challenge ? { ...t, challenge: "Cold", subtitle: "Cold. Wash the workday off." } : t));
          for (const d of Object.values(p.days ?? {}))
            for (const b of d.blocks as unknown as { templateId: string; challenge?: string; status: string }[])
              if (b.templateId === "shower" && b.status === "planned") b.challenge = "Cold";
        }
        if (from < 3) {
          // v3: the four look-based names became Shugyo and Vow.
          const st = (p.settings ?? {}) as { identity?: string };
          if (st.identity !== "shugyo" && st.identity !== "vow") p.settings = { ...st, identity: "shugyo" };
        }
        if (from < 7) {
          // v7: start over gently with the Warm-up phase, built from what you already do.
          const st = { ...DEFAULT_SETTINGS, ...(p.settings as Partial<Settings>) };
          const own = ((p.template as TemplateBlock[] | undefined) ?? []).filter((t) => isCustom(t.id));
          const template = [...programTemplate(1, st.familyNight), ...own];
          p.template = template;
          p.settings = { ...st, program: { phase: 1, since: todayKey() } };
          if (p.days) p.days = rebuildDays(p.days as unknown as Record<DateKey, Day>, template, st, todayKey(), nowMin()) as never;
        }
        if (from < 6) {
          // v6: alarm mode for the non-negotiables.
          type T = { id: string; alarm?: boolean };
          const alarmed = new Set(["dogs", "winddown"]);
          p.template = (p.template as T[] | undefined)?.map((t) => (alarmed.has(t.id) && t.alarm == null ? { ...t, alarm: true } : t));
          for (const d of Object.values(p.days ?? {}))
            for (const b of d.blocks as unknown as { templateId: string; alarm?: boolean; status: string }[])
              if (alarmed.has(b.templateId) && b.status === "planned" && b.alarm == null) b.alarm = true;
        }
        if (from < 5) {
          // v5: one app (Shugyo); the old identities become colour themes.
          const st = (p.settings ?? {}) as { identity?: string; theme?: string };
          const theme = st.theme ?? (st.identity === "vow" ? "gold" : "vermilion");
          const { identity: _old, ...rest } = st;
          p.settings = { ...DEFAULT_SETTINGS, ...rest, theme };
        }
        return persisted as never;
      },
      partialize: (s) => ({
        firstDay: s.firstDay,
        template: s.template,
        days: s.days,
        settings: s.settings,
        focus: s.focus,
        oneOffs: s.oneOffs,
        cloud: s.cloud,
      }),
    },
  ),
);

/** Find a block by id on a date. */
export const selectBlock = (s: State, date: DateKey, id: string) => s.days[date]?.blocks.find((b) => b.id === id);
