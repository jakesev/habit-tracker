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
  late: Ref | null; // "When did you do it?" after the grace window
  log: boolean; // Log it sheet
  focusSetup: Ref | null; // focus timer, before start
  day: DateKey | null; // day detail from calendar
  home: boolean; // "I'm home" re-plan sheet
  menu: boolean; // the + menu on Today
  editor: { mode: "add"; date: DateKey; event?: boolean } | { mode: "edit"; date: DateKey; id: string } | null;
  toast: { id: number; title: string; line?: string; tone: "hard" | "plain" } | null;

  go: (t: Tab) => void;
  open: (k: "block" | "skip" | "checkin" | "focusSetup" | "late", r: Ref | null) => void;
  openLog: (v: boolean) => void;
  openDay: (d: DateKey | null) => void;
  openHome: (v: boolean) => void;
  openMenu: (v: boolean) => void;
  openEditor: (v: UI["editor"]) => void;
  showToast: (title: string, line?: string, tone?: "hard" | "plain") => void;
}

export const useUI = create<UI>((set, get) => ({
  tab: "home",
  dir: 0,
  block: null,
  skip: null,
  checkin: null,
  late: null,
  log: false,
  focusSetup: null,
  day: null,
  home: false,
  menu: false,
  editor: null,
  toast: null,
  go: (t) => {
    const cur = get().tab;
    if (cur === t) return;
    set({ tab: t, dir: TABS.indexOf(t) > TABS.indexOf(cur) ? 1 : -1 });
  },
  open: (k, r) => set({ [k]: r } as Partial<UI>),
  openDay: (d) => set({ day: d }),
  openLog: (v) => set({ log: v }),
  openHome: (v) => set({ home: v }),
  openMenu: (v) => set({ menu: v }),
  openEditor: (v) => set({ editor: v }),
  showToast: (title, line, tone = "plain") => set({ toast: { id: Date.now(), title, line, tone } }),
}));
