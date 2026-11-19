import { goalProgress } from "../lib/goals";
import { GRACE } from "../lib/score";
import { nowMin, todayKey } from "../lib/time";
import type { DateKey } from "../lib/types";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";

/**
 * Tick a block done and open the ten-second check-in.
 * After its time + 15 min grace (or on a past day), first ask when it was really done:
 * forgetting to tick shouldn't cost you, but doing it late is half credit.
 */
export function completeBlock(date: DateKey, id: string) {
  const s = useStore.getState();
  const b = s.days[date]?.blocks.find((x) => x.id === id);
  if (!b) return;
  const wasDone = b.status === "done" || b.status === "partial";
  // A daily goal (push-ups): the tick logs a set that gets you to the target.
  if (b.goal) {
    if (wasDone) return useUI.getState().open("block", { date, id });
    const left = Math.max(1, b.goal.target - goalProgress(s.days[date], b));
    s.addLog(date, { title: b.title, count: left, unit: b.goal.unit, at: Math.floor(nowMin()) });
    setTimeout(() => useUI.getState().open("checkin", { date, id }), 420);
    return;
  }
  if (wasDone) return s.tick(date, id);
  const pastGrace = date !== todayKey() || nowMin() > (b.until ?? b.start + b.duration + GRACE);
  if (pastGrace) return useUI.getState().open("late", { date, id });
  s.tick(date, id);
  // Let the burst play before the sheet rises.
  setTimeout(() => useUI.getState().open("checkin", { date, id }), 420);
}
