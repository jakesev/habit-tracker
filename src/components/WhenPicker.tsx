import { useState } from "react";
import { nowMin, PERIODS, type Period } from "../lib/time";
import { Icon, Pressable } from "./ui";

export interface When {
  at: number;
  period?: Period;
}

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** A representative time for a part of the day, never later than now. */
export function periodTime(p: Period): number {
  const def = PERIODS.find((x) => x.id === p)!;
  return Math.min(def.at, Math.floor(nowMin()));
}

/** Now · Morning · Afternoon · Evening, with an exact time only if you want one. */
export function WhenPicker({ value, onChange, allowNow = true }: { value: When; onChange: (w: When) => void; allowNow?: boolean }) {
  const now = Math.floor(nowMin());
  const [exact, setExact] = useState(false);
  const chip = (on: boolean) =>
    `h-11 rounded-xl text-[14px] font-medium transition-colors disabled:opacity-30 ${on ? "bg-ember text-black" : "bg-white/[0.05] text-mute"}`;
  const isNow = !value.period && !exact;
  return (
    <div>
      <div className={`grid gap-1.5 ${allowNow ? "grid-cols-4" : "grid-cols-3"}`}>
        {allowNow && (
          <Pressable
            scale={0.94}
            onClick={() => {
              setExact(false);
              onChange({ at: now });
            }}
            className={chip(isNow)}
          >
            Now
          </Pressable>
        )}
        {PERIODS.map((p) => (
          <Pressable
            key={p.id}
            scale={0.94}
            disabled={p.from > now}
            onClick={() => {
              setExact(false);
              onChange({ at: periodTime(p.id), period: p.id });
            }}
            className={chip(value.period === p.id && !exact)}
          >
            {p.label}
          </Pressable>
        ))}
      </div>
      {exact ? (
        <label className="mt-2 flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
          <Icon name="clock" size={16} className="text-faint" />
          <span className="flex-1 text-[13px] text-mute">Exact time</span>
          <input
            type="time"
            aria-label="Exact time"
            value={toHHMM(value.at)}
            max={toHHMM(now)}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              if (!Number.isNaN(h)) onChange({ at: Math.min(now, h * 60 + (m || 0)) });
            }}
            className="num bg-transparent text-right text-[15px] font-semibold text-ink [color-scheme:dark] focus:outline-none"
          />
        </label>
      ) : (
        <Pressable onClick={() => setExact(true)} className="mt-1 h-8 px-1 text-[12px] text-faint">
          I know the exact time
        </Pressable>
      )}
    </div>
  );
}
