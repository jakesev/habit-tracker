import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, hm, todayKey } from "../lib/time";
import { useStore, type BlockInput } from "./store";
import { seedTemplate } from "../lib/seed";

const today = () => todayKey();
const input = (p: Partial<BlockInput> = {}): BlockInput => ({
  title: "Dentist",
  date: today(),
  start: hm(15),
  duration: 60,
  category: "event",
  movable: false,
  repeat: null,
  ...p,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T09:00:00")); // a Tuesday morning
  useStore.getState().resetAll();
  useStore.setState({ template: seedTemplate() }); // the full routine, for these tests
  useStore.getState().ensureDays();
});

const day = (k = today()) => useStore.getState().days[k];

describe("adding to the plan", () => {
  it("adds a one-off to today, in time order", () => {
    useStore.getState().addBlock(input());
    const blocks = day().blocks;
    const i = blocks.findIndex((b) => b.title === "Dentist");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(blocks[i].type).toBe("fixed");
    expect(blocks.map((b) => b.start)).toEqual([...blocks.map((b) => b.start)].sort((a, b) => a - b));
  });

  it("keeps a one-off for a future day until that day begins", () => {
    const later = addDays(today(), 5);
    useStore.getState().addBlock(input({ date: later, title: "Client call" }));
    expect(useStore.getState().oneOffs[later]).toHaveLength(1);
    vi.setSystemTime(new Date(`${later}T08:00:00`));
    useStore.getState().ensureDays();
    expect(day(later).blocks.some((b) => b.title === "Client call")).toBe(true);
    expect(useStore.getState().oneOffs[later]).toBeUndefined();
  });

  it("a weekly block joins the routine and today's plan", () => {
    useStore.getState().addBlock(input({ title: "Muay Thai", category: "skill", movable: true, start: hm(17, 30), duration: 60, repeat: [2, 4] }));
    expect(useStore.getState().template.some((t) => t.title === "Muay Thai" && t.days.join() === "2,4")).toBe(true);
    expect(day().blocks.some((b) => b.title === "Muay Thai")).toBe(true);
  });

  it("events don't count toward the day or auto-miss", () => {
    useStore.getState().addBlock(input({ start: hm(7), duration: 30 }));
    vi.setSystemTime(new Date("2026-11-17T08:00:00"));
    useStore.getState().ensureDays();
    expect(day().blocks.find((b) => b.title === "Dentist")!.status).toBe("planned");
  });
});

describe("editing", () => {
  it("edits just this day without touching the routine", () => {
    const reading = day().blocks.find((b) => b.templateId === "reading")!;
    useStore.getState().updateBlock(today(), reading.id, { ...input(), title: "Reading", category: "reading", movable: true, start: hm(20, 15), duration: 15 }, "day");
    expect(day().blocks.find((b) => b.templateId === "reading")!.start).toBe(hm(20, 15));
    expect(useStore.getState().template.find((t) => t.id === "reading")!.start).toBe(hm(20));
  });

  it("edits every week: the routine and today's planned copy", () => {
    const reading = day().blocks.find((b) => b.templateId === "reading")!;
    useStore.getState().updateBlock(today(), reading.id, { ...input(), title: "Deep reading", category: "reading", movable: true, start: hm(20), duration: 45, repeat: [1, 2, 3, 4, 5] }, "every");
    expect(useStore.getState().template.find((t) => t.id === "reading")!.title).toBe("Deep reading");
    expect(day().blocks.find((b) => b.templateId === "reading")!.duration).toBe(45);
  });

  it("deletes from every week", () => {
    const summary = day().blocks.find((b) => b.templateId === "summary")!;
    useStore.getState().deleteBlock(today(), summary.id, "every");
    expect(useStore.getState().template.some((t) => t.id === "summary")).toBe(false);
    expect(day().blocks.some((b) => b.templateId === "summary")).toBe(false);
    expect(day(addDays(today(), 1)).blocks.some((b) => b.templateId === "summary")).toBe(false);
  });
});

describe("on time vs late", () => {
  it("ticking within the time + 15 min grace is on time", () => {
    vi.setSystemTime(new Date("2026-11-17T18:50:00"));
    const w = day().blocks.find((b) => b.templateId === "writing")!; // 6:15–6:45
    useStore.getState().tick(today(), w.id);
    const b = day().blocks.find((x) => x.id === w.id)!;
    expect(b.status).toBe("done");
    expect(b.late).toBe(false);
  });

  it("marking done after the grace is late, with minutes off the planned start", () => {
    const sh = day().blocks.find((b) => b.templateId === "shower")!; // 5:00–5:15
    useStore.getState().markDone(today(), sh.id, hm(18, 25));
    const b = day().blocks.find((x) => x.id === sh.id)!;
    expect(b.late).toBe(true);
    expect(b.lateBy).toBe(70); // started ~6:10 for a 5:00 plan
  });

  it("forgot to tick: done at the planned end is on time", () => {
    const sh = day().blocks.find((b) => b.templateId === "shower")!;
    useStore.getState().markDone(today(), sh.id, sh.start + sh.duration);
    expect(day().blocks.find((x) => x.id === sh.id)!.late).toBe(false);
  });

  it("logs land on the day in time order", () => {
    useStore.getState().addLog(today(), { title: "Push-ups", count: 20, unit: "reps", at: hm(6, 42) });
    useStore.getState().addLog(today(), { title: "Cold plunge", at: hm(5, 30) });
    expect(day().logs!.map((l) => l.title)).toEqual(["Cold plunge", "Push-ups"]);
  });
});

describe("warm-up plan", () => {
  it("switching phase keeps what's done today and adds only what's still ahead", () => {
    vi.setSystemTime(new Date("2026-11-17T18:40:00"));
    useStore.getState().ensureDays();
    const w = day().blocks.find((b) => b.templateId === "writing")!;
    useStore.getState().markDone(today(), w.id, hm(18, 40));
    useStore.getState().setProgram(1);
    const ids = day().blocks.map((b) => b.templateId);
    expect(ids).toContain("writing"); // done, kept
    expect(ids).not.toContain("pushups"); // 5am already gone today
    expect(ids).toContain("reading");
    expect(ids).toContain("cold-shower");
    expect(useStore.getState().settings.program?.phase).toBe(1);
    // tomorrow is the clean warm-up
    const tomorrow = useStore.getState().days["2026-11-18"].blocks.map((b) => b.templateId);
    expect(tomorrow).toEqual(expect.arrayContaining(["pushups", "cold-shower", "dinner", "script", "dogs", "reading", "winddown"]));
    expect(tomorrow).not.toContain("writing");
  });

  it("the cold shower is on time any time before 9pm", () => {
    useStore.getState().setProgram(1);
    const cs = day().blocks.find((b) => b.templateId === "cold-shower")!;
    useStore.getState().markDone(today(), cs.id, hm(20, 30));
    expect(day().blocks.find((b) => b.id === cs.id)!.late).toBe(false);
  });
});
