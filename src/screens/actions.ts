import type { DateKey } from "../lib/types";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";

/** Tick a block done and open the ten-second check-in. */
export function completeBlock(date: DateKey, id: string) {
  const s = useStore.getState();
  const b = s.days[date]?.blocks.find((x) => x.id === id);
  if (!b) return;
  const wasDone = b.status === "done" || b.status === "partial";
  s.tick(date, id);
  if (!wasDone) {
    // Let the burst play before the sheet rises.
    setTimeout(() => useUI.getState().open("checkin", { date, id }), 420);
  }
}
