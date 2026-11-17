import { describe, expect, it } from "vitest";
import {
  completion,
  currentStreak,
  dailyScore,
  difficulty,
  disciplineIndex,
  glowTier,
  longestStreak,
  stayedHard,
} from "./score";
import type { Day, DayBlock, Settings } from "./types";
import { addDays } from "./time";

const settings: Settings = {
  streakThreshold: 80,
  restPassesPerWeek: 1,
  defaultReminderLead: 10,
  questionTiming: "after",
  haptics: true,
  sound: true,
  notifications: false,
  familyNight: 6,
  identity: "ember",
  homeTime: 1020,
  bedTime: 1260,
};

let n = 0;
function block(p: Partial<DayBlock> = {}): DayBlock {
  return {
    id: `b${n++}`,
    templateId: "t",
    title: "Block",
    category: "skill",
    type: "flexible",
    priority: 3,
    start: 1080,
    duration: 30,
    minDuration: 15,
    status: "planned",
    reminderLead: 10,
    ...p,
  };
}
const day = (date: string, blocks: DayBlock[], extra: Partial<Day> = {}): Day => ({ date, blocks, ...extra });

describe("difficulty", () => {
  it("defaults to 5 when nothing answered", () => {
    expect(difficulty(block())).toBe(5);
  });
  it("averages answers and inverts energy", () => {
    expect(difficulty(block({ resistance: 8, energy: 3, startDifficulty: 8 }))).toBe(8);
  });
  it("flags stayed hard at 7+ only when done", () => {
    expect(stayedHard(block({ status: "done", resistance: 7 }))).toBe(true);
    expect(stayedHard(block({ status: "skipped", resistance: 9 }))).toBe(false);
  });
});

describe("completion", () => {
  it("is minute-weighted and removes excused blocks", () => {
    const d = day("2026-11-17", [
      block({ duration: 30, status: "done" }),
      block({ duration: 30, status: "missed" }),
      block({ duration: 60, status: "skipped", excused: true }),
    ]);
    expect(completion(d)).toBe(50);
  });
  it("credits partial blocks by timer minutes", () => {
    const d = day("2026-11-17", [block({ duration: 60, status: "partial", focusedMinutes: 15 })]);
    expect(completion(d)).toBe(25);
  });
  it("is null with nothing planned", () => {
    expect(completion(day("2026-11-17", []))).toBeNull();
  });
});

describe("dailyScore", () => {
  it("is 100 when everything is done at difficulty 5", () => {
    const d = day("x", [block({ status: "done" }), block({ status: "done", priority: 5 })]);
    expect(dailyScore(d)).toBe(100);
  });
  it("rewards doing it hard and caps at 100", () => {
    const d = day("x", [block({ status: "done", resistance: 10 }), block({ status: "missed" })]);
    // earned 3*2 = 6, possible 9 → 66.7
    expect(dailyScore(d)!).toBeCloseTo(66.67, 1);
  });
  it("scores skipped blocks at zero", () => {
    expect(dailyScore(day("x", [block({ status: "skipped", skipReason: "distracted" })]))).toBe(0);
  });
});

describe("streaks", () => {
  const first = "2026-11-01";
  const today = "2026-11-10";
  const done = (d: string) => day(d, [block({ status: "done" })]);
  const miss = (d: string) => day(d, [block({ status: "missed" })]);

  it("counts back to the last miss and keeps today open", () => {
    const days: Record<string, Day> = {};
    for (let i = 0; i < 10; i++) {
      const k = addDays(first, i);
      days[k] = i === 3 ? miss(k) : done(k);
    }
    days[today] = day(today, [block({ status: "planned" })]); // in progress
    expect(currentStreak(days, settings, today, first)).toBe(5); // days 5..9 (indices 4..8)
    expect(longestStreak(days, settings, today, first)).toBe(5);
  });

  it("rest pass keeps the chain alive", () => {
    const days: Record<string, Day> = {};
    for (let i = 0; i < 5; i++) days[addDays(first, i)] = done(addDays(first, i));
    days[addDays(first, 2)] = { ...miss(addDays(first, 2)), restPass: { reason: "sick", at: 0 } };
    expect(currentStreak(days, settings, addDays(first, 4), first)).toBe(5);
  });

  it("glow tiers step at 3, 7, 14, 30, 60", () => {
    expect([1, 3, 6, 7, 14, 29, 30, 60].map(glowTier)).toEqual([0, 1, 1, 2, 3, 3, 4, 5]);
  });
});

describe("disciplineIndex", () => {
  it("only counts days since the first tracked day", () => {
    const first = "2026-11-15";
    const today = "2026-11-16";
    const days: Record<string, Day> = {
      [first]: day(first, [block({ status: "done" })]),
      [today]: day(today, [block({ status: "done" })]),
    };
    const r = disciplineIndex(days, settings, today, first);
    expect(r.days).toBe(2);
    expect(r.consistency).toBe(1);
    expect(r.index).toBe(100);
  });
  it("punishes inconsistency", () => {
    const first = "2026-11-01";
    const days: Record<string, Day> = {};
    for (let i = 0; i < 10; i++) {
      const k = addDays(first, i);
      days[k] = day(k, [block({ status: i % 2 ? "done" : "missed" })]);
    }
    const r = disciplineIndex(days, settings, addDays(first, 9), first);
    expect(r.consistency).toBe(0.5);
    expect(r.index).toBe(25);
  });
});
