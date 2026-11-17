import { describe, expect, it } from "vitest";
import { plannedNotifications } from "./native";
import { hm } from "./time";
import type { Day, DayBlock } from "./types";

const b = (id: string, start: number, p: Partial<DayBlock> = {}): DayBlock => ({
  id,
  templateId: id,
  title: id[0].toUpperCase() + id.slice(1),
  category: "skill",
  type: "flexible",
  priority: 4,
  start,
  duration: 30,
  minDuration: 15,
  status: "planned",
  reminderLead: 10,
  ...p,
});

describe("reminders", () => {
  const today = "2026-11-17";
  const at = (min: number) => new Date(`${today}T00:00:00`).getTime() + min * 60_000;
  const days: Record<string, Day> = {
    [today]: { date: today, blocks: [b("shower", hm(17), { challenge: "Cold", duration: 15 }), b("writing", hm(18, 15)), b("reading", hm(20), { status: "done" })] },
  };

  it("gives the plan, a heads-up before, and a nudge when each block starts", () => {
    const list = plannedNotifications(days, at(hm(15)), today);
    const titles = list.map((n) => n.title);
    expect(titles).toContain("Today: 2 blocks, first Shower at 5:00pm");
    expect(titles).toContain("Shower in 10 min");
    expect(titles).toContain("Now: Shower (cold)");
    expect(titles).toContain("Writing in 10 min");
    expect(list.find((n) => n.title === "Now: Shower (cold)")!.body).toBe("Until 5:15pm. Next: Writing at 6:15pm.");
  });

  it("skips anything already past and blocks already done", () => {
    const list = plannedNotifications(days, at(hm(18, 10)), today);
    expect(list.map((n) => n.title)).toEqual(["Now: Writing"]);
  });

  it("ids are unique", () => {
    const list = plannedNotifications(days, at(hm(6)), today);
    expect(new Set(list.map((n) => n.id)).size).toBe(list.length);
  });
});
