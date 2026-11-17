import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { HOME_BLOCKS, seedTemplate } from "../lib/seed";
import type { PlanResult } from "../lib/plan";
import { addDays, diffDays, fromKey, nowMin, snapDuration, todayKey } from "../lib/time";
import {
  EXCUSED_REASONS,
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
  questionTiming: "after",
  haptics: true,
  sound: true,
  notifications: false,
  familyNight: 6,
  identity: "shugyo",
  homeTime: 17 * 60,
  bedTime: 21 * 60,
};

export type Answers = Partial<Pick<DayBlock, "resistance" | "energy" | "startDifficulty" | "note">>;

interface State {
  firstDay: DateKey | null;
  template: TemplateBlock[];
  days: Record<DateKey, Day>;
  settings: Settings;
  focus: FocusSession | null;

  ensureDays: (now?: Date) => void;
  tick: (date: DateKey, id: string) => void;
  setAnswers: (date: DateKey, id: string, a: Answers) => void;
  setNote: (date: DateKey, id: string, note: string) => void;
  skip: (date: DateKey, id: string, reason: SkipReason) => void;
  reopen: (date: DateKey, id: string) => void;
  setReminderLead: (date: DateKey, id: string, lead: number) => void;
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

function blocksFor(date: DateKey, template: TemplateBlock[], settings: Settings): DayBlock[] {
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
      status: "planned",
      reminderLead: settings.defaultReminderLead,
    }));
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
        template: seedTemplate(DEFAULT_SETTINGS.familyNight),
        days: {},
        settings: DEFAULT_SETTINGS,
        focus: null,

        ensureDays: (now = new Date()) => {
          const s = get();
          const today = todayKey(now);
          const first = s.firstDay ?? today;
          const days = { ...s.days };
          let changed = !s.firstDay;
          // Tomorrow is created a day early so its reminders can be scheduled tonight.
          const tomorrow = addDays(today, 1);
          for (let k = first; diffDays(k, tomorrow) >= 0; k = addDays(k, 1)) {
            if (!days[k]) {
              days[k] = { date: k, blocks: blocksFor(k, s.template, s.settings) };
              changed = true;
            }
            // Auto-miss: a planned block whose window has closed becomes Not done.
            const cutoff = k === today ? nowMin(now) : k > today ? -Infinity : Infinity;
            const d = days[k];
            let dirty = false;
            const blocks = d.blocks.map((b) => {
              const running = s.focus?.blockId === b.id;
              // Shower and dinner wait for "I'm home"; if it never comes they close at bed time.
              const end = b.homeAnchor && d.homeAt == null && k === today ? s.settings.bedTime : b.start + b.duration;
              if (b.status === "planned" && !running && end <= cutoff) {
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
            const next: DayBlock = {
              ...b,
              status: to,
              completedAt: to === "done" ? Date.now() : undefined,
              skipReason: undefined,
              excused: undefined,
            };
            return log(next, "status", b.status, to, date);
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

        toggleChecklist: (date, id, i) =>
          patch(date, id, (b) => {
            const cur = new Set(b.checklistDone ?? []);
            cur.has(i) ? cur.delete(i) : cur.add(i);
            return { ...b, checklistDone: [...cur].sort() };
          }),

        startFocus: (date, id, minutes) => {
          const ms = snapDuration(minutes) * 60_000;
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
            const base = { ...b, focusedMinutes: (b.focusedMinutes ?? 0) + mins, timerCompleted: remaining <= 1000 };
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
            template: seedTemplate(DEFAULT_SETTINGS.familyNight),
            days: {},
            settings: DEFAULT_SETTINGS,
            focus: null,
          }),
      };
    },
    {
      name: "stride-routine-v1",
      storage: safeStorage,
      version: 3,
      migrate: (persisted, from) => {
        const p = persisted as { template?: { id: string }[]; settings?: object; days?: Record<string, { date: string; blocks: { templateId: string }[] }> };
        if (from < 2) {
          // v2: shower + dinner, placed when you tap "I'm home".
          if (p.template && !p.template.some((t) => t.id === "shower")) p.template = [...HOME_BLOCKS, ...p.template];
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
        if (from < 3) {
          // v3: the four look-based names became Shugyo and Vow.
          const st = (p.settings ?? {}) as { identity?: string };
          if (st.identity !== "shugyo" && st.identity !== "vow") p.settings = { ...st, identity: "shugyo" };
        }
        return persisted as never;
      },
      partialize: (s) => ({
        firstDay: s.firstDay,
        template: s.template,
        days: s.days,
        settings: s.settings,
        focus: s.focus,
      }),
    },
  ),
);

/** Find a block by id on a date. */
export const selectBlock = (s: State, date: DateKey, id: string) => s.days[date]?.blocks.find((b) => b.id === id);
