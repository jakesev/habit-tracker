import { motion } from "framer-motion";
import type { DayState } from "../lib/score";
import { Icon } from "./ui";

/** A day as a box that fills from the bottom with the share completed. */
export function DayBox({
  pct,
  state,
  tier = 0,
  isToday,
  label,
  size,
  delay = 0,
  muted,
}: {
  pct: number | null;
  state: DayState | "future" | "before";
  tier?: number;
  isToday?: boolean;
  label?: string | number;
  size?: number;
  delay?: number;
  muted?: boolean;
}) {
  const fill = Math.max(0, Math.min(100, pct ?? 0));
  const streak = state === "streak" || state === "rest";
  const glow = streak && tier > 0 ? 4 + tier * 3 : 0;
  const color = state === "rest" ? "var(--color-skill)" : streak ? "var(--color-ember)" : "rgb(255 255 255 / 0.22)";

  return (
    <div className="relative" style={{ width: size ?? "100%" }}>
      {glow > 0 && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[10px]"
          style={{
            boxShadow: `0 0 ${glow}px ${glow / 3}px rgb(255 106 43 / ${0.22 + tier * 0.08})`,
            animation: `breathe ${3.4 - tier * 0.3}s ease-in-out infinite`,
          }}
        />
      )}
    <div
      className="relative aspect-square w-full overflow-hidden rounded-[10px]"
      style={{
        background: state === "future" || state === "before" ? "rgb(255 255 255 / 0.02)" : "rgb(255 255 255 / 0.05)",
        boxShadow: isToday ? "inset 0 0 0 1.5px rgb(255 255 255 / 0.55)" : "inset 0 0 0 1px rgb(255 255 255 / 0.05)",
        opacity: muted ? 0.35 : 1,
      }}
    >
      {state !== "future" && state !== "before" && (
        <motion.div
          className="absolute inset-x-0 bottom-0"
          style={{ background: color }}
          initial={{ height: 0 }}
          animate={{ height: state === "rest" ? "100%" : `${fill}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 22, delay }}
        />
      )}
      {state === "rest" && (
        <div className="absolute inset-0 grid place-items-center text-black/70">
          <Icon name="shield" size={14} stroke={2.2} />
        </div>
      )}
      {label != null && state !== "rest" && (
        <div
          className={`num absolute inset-0 grid place-items-center text-[12px] font-semibold ${
            streak && fill > 55 ? "text-black/75" : state === "future" || state === "before" ? "text-faint/60" : "text-mute"
          }`}
        >
          {label}
        </div>
      )}
    </div>
    </div>
  );
}
