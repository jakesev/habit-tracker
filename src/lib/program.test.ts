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
  it("warm-up is light: four habits on a weekday evening", () => {
    const tue = programTemplate(1).filter((b) => b.days.includes(2) && b.category !== "event" && b.category !== "anchor");
    expect(tue.map((b) => b.id).sort()).toEqual(["cold-shower", "pushups", "reading", "script"]);
  });
});
