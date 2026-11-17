import { useEffect, useMemo, useState } from "react";
import { GhostButton, Icon, Pressable, PrimaryButton, Sheet } from "../components/ui";
import { haptic, sound } from "../lib/feedback";
import { fmtTime, nowMin, todayKey } from "../lib/time";
import type { LogEntry } from "../lib/types";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";

const UNITS = ["reps", "min", "km", ""];

export const fmtLog = (l: Pick<LogEntry, "title" | "count" | "unit">) =>
  `${l.title}${l.count ? ` · ${l.count}${l.unit ? ` ${l.unit}` : ""}` : ""}`;

/** Log something you just did: 20 push-ups, an extra cold shower. Small bonus, never required. */
export function LogSheet() {
  const open = useUI((s) => s.log);
  const setOpen = useUI((s) => s.openLog);
  const toast = useUI((s) => s.showToast);
  const days = useStore((s) => s.days);
  const addLog = useStore((s) => s.addLog);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState<number | "">("");
  const [unit, setUnit] = useState("reps");
  const [at, setAt] = useState(() => Math.floor(nowMin()));

  useEffect(() => {
    if (open) {
      setTitle("");
      setCount("");
      setUnit("reps");
      setAt(Math.floor(nowMin()));
    }
  }, [open]);

  // Your usual extras, most logged first: one tap logs them again.
  const usual = useMemo(() => {
    const seen = new Map<string, { e: LogEntry; n: number }>();
    for (const d of Object.values(days))
      for (const l of d.logs ?? []) {
        const k = l.title.toLowerCase();
        const cur = seen.get(k);
        seen.set(k, { e: l, n: (cur?.n ?? 0) + 1 });
      }
    return [...seen.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((x) => x.e);
  }, [days]);

  const save = (e: Omit<LogEntry, "id">) => {
    addLog(todayKey(), e);
    haptic("success");
    sound("tick");
    setOpen(false);
    toast("Logged", `${fmtLog(e)} at ${fmtTime(e.at)}. It all counts.`);
  };

  return (
    <Sheet open={open} onClose={() => setOpen(false)} label="Log it">
      <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Log it</h2>
      <p className="mt-1 text-[14px] text-mute">Something you did that wasn't on the plan. A small bonus, never required.</p>

      {usual.length > 0 && (
        <div className="mt-5">
          <div className="eyebrow mb-2">Again, now</div>
          <div className="flex flex-wrap gap-2">
            {usual.map((u) => (
              <Pressable
                key={u.id}
                scale={0.94}
                onClick={() => save({ title: u.title, count: u.count, unit: u.unit, at: Math.floor(nowMin()) })}
                className="flex h-11 items-center gap-2 rounded-full bg-ember/12 px-4 text-[14px] font-medium text-ember-hi"
              >
                <Icon name="plus" size={14} stroke={2.4} /> {fmtLog(u)}
              </Pressable>
            ))}
          </div>
        </div>
      )}

      <input
        id="log-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Push-ups, cold plunge, extra reading…"
        className="mt-5 h-14 w-full rounded-2xl border border-line bg-white/[0.04] px-4 text-[17px] font-medium text-ink placeholder:font-normal placeholder:text-faint focus:border-ember/50 focus:outline-none"
      />

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <div className="flex items-center rounded-2xl border border-line bg-white/[0.03] p-1">
          <Pressable aria-label="Less" onClick={() => setCount((c) => Math.max(0, (c || 0) - 5) || "")} className="grid h-11 w-10 place-items-center rounded-xl text-mute">
            <Icon name="minus" size={16} />
          </Pressable>
          <input
            inputMode="numeric"
            aria-label="How many"
            value={count}
            onChange={(e) => setCount(e.target.value === "" ? "" : Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))}
            placeholder="How many"
            className="num min-w-0 flex-1 bg-transparent text-center text-[17px] font-semibold text-ink placeholder:text-[14px] placeholder:font-normal placeholder:text-faint focus:outline-none"
          />
          <Pressable aria-label="More" onClick={() => setCount((c) => (c || 0) + 5)} className="grid h-11 w-10 place-items-center rounded-xl text-mute">
            <Icon name="plus" size={16} />
          </Pressable>
        </div>
        <div className="flex rounded-2xl bg-white/[0.04] p-1">
          {UNITS.map((u) => (
            <Pressable
              key={u || "none"}
              scale={0.92}
              onClick={() => setUnit(u)}
              className={`h-11 rounded-xl px-2.5 text-[13px] font-medium transition-colors ${unit === u ? "bg-white/[0.12] text-ink" : "text-faint"}`}
            >
              {u || "–"}
            </Pressable>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-white/[0.03] p-1">
        <Pressable aria-label="5 minutes earlier" onClick={() => setAt((m) => Math.max(0, m - 5))} className="grid h-11 w-10 place-items-center rounded-xl text-mute">
          <Icon name="minus" size={16} />
        </Pressable>
        <div className="flex-1 text-center">
          <div className="text-[11px] text-faint">{at === Math.floor(nowMin()) ? "Now" : "At"}</div>
          <div className="num text-[16px] font-semibold">{fmtTime(at)}</div>
        </div>
        <Pressable aria-label="5 minutes later" onClick={() => setAt((m) => Math.min(Math.floor(nowMin()), m + 5))} className="grid h-11 w-10 place-items-center rounded-xl text-mute">
          <Icon name="plus" size={16} />
        </Pressable>
      </div>

      <PrimaryButton className="mt-5" disabled={!title.trim()} onClick={() => save({ title: title.trim(), count: count || undefined, unit: count ? unit : undefined, at })}>
        Log it
      </PrimaryButton>
      <GhostButton className="mt-2 w-full" onClick={() => setOpen(false)}>
        Cancel
      </GhostButton>
    </Sheet>
  );
}
