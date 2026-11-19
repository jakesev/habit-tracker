import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../store/store";
import { goalProgress, goalText, pace } from "./goals";
import { dailyScore } from "./score";
import { hm, todayKey } from "./time";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-19T12:30:00"));
  useStore.getState().resetAll();
  useStore.getState().ensureDays();
});

const day = () => useStore.getState().days[todayKey()];
const pushups = () => day().blocks.find((b) => b.templateId === "pushups")!;

describe("push-ups as a daily goal", () => {
  it("sets add up, tick themselves at 20, and extras show", () => {
    const { addLog } = useStore.getState();
    addLog(todayKey(), { title: "Push-ups", count: 10, unit: "reps", at: hm(6, 10) });
    expect(pushups().status).toBe("planned");
    expect(goalText(day(), pushups())).toBe("10 of 20 reps");
    addLog(todayKey(), { title: "pushups", count: 10, unit: "reps", at: hm(11, 40) });
    expect(pushups().status).toBe("done");
    expect(pushups().doneAt).toBe(hm(11, 40));
    expect(pushups().late).toBe(false);
    addLog(todayKey(), { title: "Push-ups", count: 20, unit: "reps", at: hm(12, 20) });
    expect(goalProgress(day(), pushups())).toBe(40);
    expect(goalText(day(), pushups())).toBe("40 reps today · +20 extra");
  });

  it("removing the set that reached 20 un-ticks it", () => {
    const { addLog } = useStore.getState();
    addLog(todayKey(), { title: "Push-ups", count: 20, unit: "reps", at: hm(7, 0) });
    expect(pushups().status).toBe("done");
    useStore.getState().removeLog(todayKey(), day().logs![0].id);
    expect(pushups().status).toBe("planned");
  });

  it("push-up sets aren't extras; a run is, and going past 20 is too", () => {
    const { addLog } = useStore.getState();
    addLog(todayKey(), { title: "Push-ups", count: 20, unit: "reps", at: hm(7, 0) });
    const base = dailyScore(day())!;
    addLog(todayKey(), { title: "Run", count: 3.13, unit: "km", minutes: 23.4, at: hm(12, 2) });
    expect(dailyScore(day())!).toBeGreaterThan(base);
  });
});

describe("pace", () => {
  it("works out minutes per km", () => {
    expect(pace(3.13, 23 + 23 / 60)).toBe("7:28/km");
    expect(pace(undefined, 20)).toBeNull();
  });
});
