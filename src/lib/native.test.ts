import { describe, expect, it } from "vitest";
import { buildPlanPayload } from "./native";
import { hm } from "./time";
import type { Day, DayBlock } from "./types";

const b = (id: string, start: number, p: Partial<DayBlock> = {}): DayBlock => ({
  id,
  templateId: id,
  title: id,
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

describe("plan handed to Android", () => {
  const today = "2026-11-17";
  const days: Record<string, Day> = {
    [today]: {
      date: today,
      blocks: [
        b("shower", hm(17), { category: "chore", challenge: "Cold" }),
        b("writing", hm(18, 15)),
        b("dogs", hm(19, 45), { category: "anchor", type: "fixed", alarm: true }),
        b("summary", hm(20, 30), { dropped: true, status: "skipped" }),
        b("dentist", hm(15), { category: "event", type: "fixed", alarm: true }),
      ],
    },
    "2026-11-18": { date: "2026-11-18", blocks: [b("writing2", hm(18, 15))] },
    "2026-11-19": { date: "2026-11-19", blocks: [b("later", hm(18, 15))] },
  };
  const p = buildPlanPayload(days, today, { notify: true, upNext: true, accent: "#F0502E" });

  it("covers today and tomorrow only", () => {
    expect(p.days.map((d) => d.date)).toEqual([today, "2026-11-18"]);
  });
  it("leaves out dropped blocks", () => {
    expect(p.days[0].blocks.map((x) => x.id)).not.toContain("summary");
  });
  it("timers only for deep work; alarms only on real blocks", () => {
    const by = Object.fromEntries(p.days[0].blocks.map((x) => [x.id, x]));
    expect(by.writing.timer).toBe(true);
    expect(by.shower.timer).toBe(false);
    expect(by.shower.challenge).toBe("Cold");
    expect(by.dogs.alarm).toBe(true);
    expect(by.dogs.fixed).toBe(true);
    expect(by.dentist.alarm).toBe(false);
  });
});
