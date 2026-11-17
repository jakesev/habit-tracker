import { describe, expect, it } from "vitest";
import { PHASES, programTemplate } from "./program";

describe("program phases", () => {
  for (const p of PHASES) {
    it(`${p.name}: on the 15-minute grid, no clock blocks overlap`, () => {
      const t = programTemplate(p.n);
      for (const b of t) {
        expect(b.start % 15, b.title).toBe(0);
        expect(b.duration % 15, b.title).toBe(0);
      }
      for (let d = 0; d < 7; d++) {
        const day = t.filter((b) => b.days.includes(d) && !b.anytime).sort((a, b) => a.start - b.start);
        for (let i = 1; i < day.length; i++)
          expect(day[i].start, `${day[i - 1].title} → ${day[i].title}`).toBeGreaterThanOrEqual(day[i - 1].start + day[i - 1].duration);
      }
    });
  }
  it("each phase adds to the last", () => {
    const ids = PHASES.map((p) => new Set(programTemplate(p.n).map((b) => b.id)));
    for (let i = 1; i < ids.length; i++) for (const id of ids[i - 1]) expect(ids[i].has(id)).toBe(true);
  });
  it("Foundation is just what's set: push-ups, cold shower, reading at 8", () => {
    const tue = programTemplate(1).filter((b) => b.days.includes(2));
    expect(tue.map((b) => b.id).sort()).toEqual(["cold-shower", "pushups", "reading"]);
    const sat = programTemplate(1).filter((b) => b.days.includes(6));
    expect(sat.map((b) => b.id).sort()).toEqual(["cold-shower-weekend", "pushups", "reading"]);
    expect(programTemplate(1).find((b) => b.id === "reading")!.start).toBe(20 * 60);
  });
  it("only reading is on the clock; the rest are anytime windows", () => {
    for (const b of programTemplate(4)) expect(!!b.anytime, b.title).toBe(b.id !== "reading");
  });
  it("adds one skill per phase", () => {
    expect(programTemplate(2).map((b) => b.id)).toContain("script");
    expect(programTemplate(3).map((b) => b.id)).toContain("writing");
    expect(programTemplate(4).map((b) => b.id)).toContain("speaking");
  });
});
