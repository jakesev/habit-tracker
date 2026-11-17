import { create } from "zustand";
import type { DateKey } from "../lib/types";

export type Tab = "home" | "today" | "streak" | "you";
export const TABS: Tab[] = ["home", "today", "streak", "you"];

type Ref = { date: DateKey; id: string };

interface UI {
  tab: Tab;
  dir: number;
  block: Ref | null; // block detail sheet
  skip: Ref | null; // skip reason sheet
  checkin: Ref | null; // post-task check-in
  focusSetup: Ref | null; // focus timer, before start
  day: DateKey | null; // day detail from calendar
  toast: { id: number; title: string; line?: string; tone: "hard" | "plain" } | null;

  go: (t: Tab) => void;
  open: (k: "block" | "skip" | "checkin" | "focusSetup", r: Ref | null) => void;
  openDay: (d: DateKey | null) => void;
  showToast: (title: string, line?: string, tone?: "hard" | "plain") => void;
}

export const useUI = create<UI>((set, get) => ({
  tab: "home",
  dir: 0,
  block: null,
  skip: null,
  checkin: null,
  focusSetup: null,
  day: null,
  toast: null,
  go: (t) => {
    const cur = get().tab;
    if (cur === t) return;
    set({ tab: t, dir: TABS.indexOf(t) > TABS.indexOf(cur) ? 1 : -1 });
  },
  open: (k, r) => set({ [k]: r } as Partial<UI>),
  openDay: (d) => set({ day: d }),
  showToast: (title, line, tone = "plain") => set({ toast: { id: Date.now(), title, line, tone } }),
}));
