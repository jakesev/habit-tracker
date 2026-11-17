import { useEffect, useState } from "react";
import { useStore } from "../store/store";
import { todayKey } from "./time";

/** Re-renders every `ms` and keeps the day list (and auto-miss) current. */
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNow(n);
      useStore.getState().ensureDays(n);
    };
    const t = setInterval(tick, ms);
    const vis = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [ms]);
  return now;
}

export function useToday() {
  const now = useNow();
  return { now, today: todayKey(now) };
}
