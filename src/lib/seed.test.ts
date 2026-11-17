import { describe, expect, it } from "vitest";
import { seedTemplate } from "./seed";

describe("15-minute rule", () => {
  it("every seeded block starts on the grid and lasts a multiple of 15 (min 15)", () => {
    for (const t of seedTemplate()) {
      expect(t.start % 15, t.title).toBe(0);
      expect(t.duration % 15, t.title).toBe(0);
      expect(t.minDuration % 15, t.title).toBe(0);
      expect(t.duration).toBeGreaterThanOrEqual(15);
      expect(t.minDuration).toBeLessThanOrEqual(t.duration);
    }
  });

  it("no two blocks overlap on any day", () => {
    const tpl = seedTemplate();
    for (let d = 0; d < 7; d++) {
      const day = tpl.filter((t) => t.days.includes(d)).sort((a, b) => a.start - b.start);
      for (let i = 1; i < day.length; i++) {
        expect(day[i].start, `${day[i - 1].title} → ${day[i].title}`).toBeGreaterThanOrEqual(day[i - 1].start + day[i - 1].duration);
      }
    }
  });
});
