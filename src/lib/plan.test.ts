import { describe, expect, it } from "vitest";
import { planHome, snapArrival } from "./plan";
import { seedTemplate } from "./seed";
import { hm } from "./time";
import type { DayBlock } from "./types";

/** A Tuesday built from the real seed routine. */
function tuesday(): DayBlock[] {
  return seedTemplate()
    .filter((t) => t.days.includes(2))
    .sort((a, b) => a.start - b.start)
    .map((t) => ({
      id: t.id,
      templateId: t.id,
      title: t.title,
      category: t.category,
      type: t.type,
      priority: t.priority,
      start: t.start,
      duration: t.duration,
      minDuration: t.minDuration,
      homeAnchor: t.homeAnchor,
      status: "planned" as const,
      reminderLead: 10,
    }));
}
const opts = { usualHome: hm(17), bedTime: hm(21) };
const get = (r: ReturnType<typeof planHome>, id: string) => r.blocks.find((b) => b.id === id)!;

describe("snapArrival", () => {
  it("rounds down within 5 minutes, otherwise up", () => {
    expect(snapArrival(hm(17, 2))).toBe(hm(17));
    expect(snapArrival(hm(19, 10))).toBe(hm(19, 15));
    expect(snapArrival(hm(18, 0))).toBe(hm(18));
  });
});

describe("planHome", () => {
  it("home on time: shower and dinner first, the evening keeps its times", () => {
    const r = planHome(tuesday(), hm(17), opts);
    expect(get(r, "shower").start).toBe(hm(17));
    expect(get(r, "dinner").start).toBe(hm(17, 15));
    expect(get(r, "writing").start).toBe(hm(18, 15));
    expect(get(r, "writing").duration).toBe(30);
    expect(r.changes.filter((c) => c.kind === "dropped")).toHaveLength(0);
  });

  it("home late: fixed anchors stay, flexible blocks shrink before anything drops", () => {
    const r = planHome(tuesday(), hm(18, 30), opts);
    expect(get(r, "dogs").start).toBe(hm(19, 45));
    expect(get(r, "winddown").start).toBe(hm(20, 45));
    expect(get(r, "shower").start).toBe(hm(18, 30));
    // nothing overlaps and everything sits on the grid
    const live = r.blocks.filter((b) => b.status === "planned").sort((a, b) => a.start - b.start);
    for (let i = 1; i < live.length; i++) expect(live[i].start).toBeGreaterThanOrEqual(live[i - 1].start + live[i - 1].duration);
    for (const b of live) {
      expect(b.start % 15).toBe(0);
      expect(b.duration % 15).toBe(0);
      expect(b.duration).toBeGreaterThanOrEqual(b.minDuration);
      expect(b.start + b.duration).toBeLessThanOrEqual(hm(21));
    }
    expect(get(r, "dinner").duration).toBe(30);
  });

  it("never cuts protected family time, and drops are excused", () => {
    const r = planHome(tuesday(), hm(18, 45), opts);
    expect(get(r, "family").status).toBe("planned");
    expect(get(r, "family").duration).toBe(30);
    const dropped = r.blocks.filter((b) => b.status === "skipped");
    expect(dropped.length).toBeGreaterThan(0);
    for (const b of dropped) expect(b.excused).toBe(true);
  });

  it("very late: still valid, anchors first, nothing overlaps", () => {
    const r = planHome(tuesday(), hm(19, 10), opts);
    const live = r.blocks.filter((b) => b.status === "planned").sort((a, b) => a.start - b.start);
    for (let i = 1; i < live.length; i++) expect(live[i].start).toBeGreaterThanOrEqual(live[i - 1].start + live[i - 1].duration);
    expect(get(r, "shower").start).toBe(hm(19, 15));
    expect(get(r, "dogs").start).toBe(hm(19, 45));
  });

  it("revives blocks auto-missed while still at work", () => {
    const blocks = tuesday().map((b) => (b.id === "writing" ? { ...b, status: "missed" as const } : b));
    const r = planHome(blocks, hm(18, 45), opts);
    const w = get(r, "writing");
    expect(["planned", "skipped"]).toContain(w.status);
    expect(w.start).toBeGreaterThanOrEqual(hm(18, 45));
  });

  it("re-planning twice starts from the template lengths", () => {
    const first = planHome(tuesday(), hm(19, 0), opts).blocks;
    const reopened = first.map((b) => (b.status === "skipped" ? { ...b, status: "planned" as const, skipReason: undefined, excused: undefined } : b));
    const again = planHome(reopened, hm(17), opts);
    expect(get(again, "writing").duration).toBe(30);
    expect(get(again, "writing").start).toBe(hm(18, 15));
  });
});
