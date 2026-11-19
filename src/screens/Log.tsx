import { useEffect, useMemo, useState } from "react";
import { GhostButton, Icon, Pressable, PrimaryButton, Sheet } from "../components/ui";
import { haptic, sound } from "../lib/feedback";
import { pace } from "../lib/goals";
import { fmtTime, nowMin, todayKey } from "../lib/time";
import type { LogEntry } from "../lib/types";
import { useStore } from "../store/store";
import { WhenPicker, type When } from "../components/WhenPicker";
import { useUI } from "../store/ui";

const UNITS = ["reps", "km", "min", ""];

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));

export const fmtLog = (l: Pick<LogEntry, "title" | "count" | "unit" | "minutes">) => {
  const parts = [l.title];
  if (l.count) parts.push(`${num(l.count)}${l.unit ? ` ${l.unit}` : ""}`);
  if (l.minutes) parts.push(`${Math.round(l.minutes)} min`);
  const p = l.unit === "km" ? pace(l.count, l.minutes) : null;
  if (p) parts.push(p);
  return parts.join(" · ");
};

type Preset = { key: string; title: string; unit: string; count?: number; step: number; timed?: boolean };
const PRESETS: Preset[] = [
  { key: "pushups", title: "Push-ups", unit: "reps", count: 20, step: 5 },
  { key: "run", title: "Run", unit: "km", step: 0.5, timed: true },
  { key: "walk", title: "Walk", unit: "km", step: 0.5, timed: true },
];


/** Log something you did: a set of push-ups, a run, anything. Any time today. */
export function LogSheet() {
  const open = useUI((s) => s.log);
  const setOpen = useUI((s) => s.openLog);
  const toast = useUI((s) => s.showToast);
  const days = useStore((s) => s.days);
  const addLog = useStore((s) => s.addLog);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState("");
  const [unit, setUnit] = useState("reps");
  const [mins, setMins] = useState("");
  const [timed, setTimed] = useState(false);
  const [step, setStep] = useState(5);
  const [when, setWhen] = useState<When>(() => ({ at: Math.floor(nowMin()) }));

  const reset = () => {
    setTitle("");
    setCount("");
    setUnit("reps");
    setMins("");
    setTimed(false);
    setStep(5);
    setWhen({ at: Math.floor(nowMin()) });
  };
  useEffect(() => {
    if (open) reset();
  }, [open]);

  // What you log most, for one-tap repeats.
  const usual = useMemo(() => {
    const seen = new Map<string, { e: LogEntry; n: number }>();
    for (const d of Object.values(days))
      for (const l of d.logs ?? []) {
        const k = l.title.toLowerCase();
        seen.set(k, { e: l, n: (seen.get(k)?.n ?? 0) + 1 });
      }
    return [...seen.values()]
      .sort((a, b) => b.n - a.n)
      .map((x) => x.e)
      .filter((e) => !PRESETS.some((p) => p.title.toLowerCase() === e.title.toLowerCase()))
      .slice(0, 4);
  }, [days]);

  const save = (e: Omit<LogEntry, "id">) => {
    addLog(todayKey(), e);
    haptic("success");
    sound("tick");
    setOpen(false);
    toast("Logged", `${fmtLog(e)}, ${e.period ? `this ${e.period}` : `at ${fmtTime(e.at)}`}. It all counts.`);
  };

  const usePreset = (p: Preset) => {
    setTitle(p.title);
    setUnit(p.unit);
    setStep(p.step);
    setTimed(!!p.timed);
    setCount(p.count ? String(p.count) : "");
  };

  const n = parseFloat(count.replace(",", "."));
  const m = parseFloat(mins.replace(",", "."));
  const now = Math.floor(nowMin());

  return (
    <Sheet open={open} onClose={() => setOpen(false)} label="Log it">
      <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Log it</h2>
      <p className="mt-1 text-[14px] text-mute">Something you did. Push-ups count toward your 20; anything else is a bonus.</p>

      {/* One tap: a set of 20 push-ups, right now */}
      <Pressable
        scale={0.97}
        onClick={() => save({ title: "Push-ups", count: 20, unit: "reps", at: now })}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ember/15 text-[16px] font-semibold text-ember-hi"
      >
        <Icon name="plus" size={18} stroke={2.6} /> 20 push-ups, now
      </Pressable>

      <div className="eyebrow mt-6 mb-2">Or log</div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Pressable
            key={p.key}
            scale={0.94}
            onClick={() => usePreset(p)}
            className={`h-10 rounded-full px-4 text-[14px] font-medium transition-colors ${title === p.title ? "bg-ember text-black" : "bg-white/[0.06] text-mute"}`}
          >
            {p.title}
          </Pressable>
        ))}
        {usual.map((u) => (
          <Pressable
            key={u.id}
            scale={0.94}
            onClick={() => {
              setTitle(u.title);
              setUnit(u.unit ?? "");
              setCount(u.count ? String(u.count) : "");
              setTimed(!!u.minutes);
            }}
            className={`h-10 rounded-full px-4 text-[14px] font-medium transition-colors ${title === u.title ? "bg-ember text-black" : "bg-white/[0.06] text-mute"}`}
          >
            {u.title}
          </Pressable>
        ))}
      </div>

      <input
        id="log-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What did you do?"
        className="mt-3 h-14 w-full rounded-2xl border border-line bg-white/[0.04] px-4 text-[17px] font-medium text-ink placeholder:font-normal placeholder:text-faint focus:border-ember/50 focus:outline-none"
      />

      {/* How many / how far */}
      <div className="mt-3">
        <div className="flex items-center rounded-2xl border border-line bg-white/[0.03] p-1">
          <Pressable
            aria-label="Less"
            onClick={() => setCount((c) => num(Math.max(0, (parseFloat(c) || 0) - step)) || "")}
            className="grid h-11 w-10 place-items-center rounded-xl text-mute"
          >
            <Icon name="minus" size={16} />
          </Pressable>
          <input
            inputMode="decimal"
            aria-label="How many or how far"
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder={unit === "km" ? "Distance" : "How many"}
            className="num min-w-0 flex-1 bg-transparent text-center text-[17px] font-semibold text-ink placeholder:text-[14px] placeholder:font-normal placeholder:text-faint focus:outline-none"
          />
          <Pressable aria-label="More" onClick={() => setCount((c) => num((parseFloat(c) || 0) + step))} className="grid h-11 w-10 place-items-center rounded-xl text-mute">
            <Icon name="plus" size={16} />
          </Pressable>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-2xl bg-white/[0.04] p-1">
          {UNITS.map((u) => (
            <Pressable
              key={u || "none"}
              scale={0.92}
              onClick={() => {
                setUnit(u);
                setStep(u === "km" ? 0.5 : 5);
                if (u === "km") setTimed(true);
              }}
              className={`h-10 rounded-xl text-[13px] font-medium transition-colors ${unit === u ? "bg-white/[0.12] text-ink" : "text-faint"}`}
            >
              {u || "none"}
            </Pressable>
          ))}
        </div>
      </div>

      {/* How long (runs, walks, anything timed) */}
      {timed ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-white/[0.03] px-4 py-1">
          <span className="text-[14px] text-mute">Took</span>
          <input
            inputMode="decimal"
            aria-label="How long, in minutes"
            value={mins}
            onChange={(e) => setMins(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder="23"
            className="num h-11 min-w-0 flex-1 bg-transparent text-right text-[17px] font-semibold text-ink placeholder:text-faint focus:outline-none"
          />
          <span className="text-[14px] text-mute">min</span>
          {unit === "km" && pace(n, m) && <span className="num ml-2 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-mute">{pace(n, m)}</span>}
        </div>
      ) : (
        <Pressable onClick={() => setTimed(true)} className="mt-2 h-9 px-1 text-[13px] text-faint">
          + How long it took
        </Pressable>
      )}

      {/* When: a part of the day is enough */}
      <div className="mt-4">
        <div className="eyebrow mb-2">When</div>
        <WhenPicker value={when} onChange={setWhen} />
      </div>

      <PrimaryButton
        className="mt-5"
        disabled={!title.trim()}
        onClick={() =>
          save({
            title: title.trim(),
            count: n > 0 ? Math.round(n * 100) / 100 : undefined,
            unit: n > 0 ? unit || undefined : undefined,
            minutes: timed && m > 0 ? m : undefined,
            at: when.at,
            period: when.period,
          })
        }
      >
        Log it
      </PrimaryButton>
      <GhostButton className="mt-2 w-full" onClick={() => setOpen(false)}>
        Cancel
      </GhostButton>
    </Sheet>
  );
}
