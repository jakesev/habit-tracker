import { GhostButton, Icon, Pressable, Sheet } from "../components/ui";
import { haptic, sound } from "../lib/feedback";
import { GRACE } from "../lib/score";
import { fmtRange, fmtTime, nowMin, PERIODS, todayKey } from "../lib/time";
import { selectBlock, useStore } from "../store/store";
import { useUI } from "../store/ui";

/** "When did you do it?" Honest either way: forgot to tick = full credit, late = half. */
export function LateSheet() {
  const ref = useUI((s) => s.late);
  const open = useUI((s) => s.open);
  const b = useStore((s) => (ref ? selectBlock(s, ref.date, ref.id) : undefined));
  const markDone = useStore((s) => s.markDone);
  const isToday = ref?.date === todayKey();
  const now = Math.floor(nowMin());

  const finish = (when: number) => {
    if (!ref) return;
    markDone(ref.date, ref.id, when);
    haptic("success");
    sound("tick");
    open("late", null);
    setTimeout(() => open("checkin", ref), 300);
  };

  const deadline = b ? b.start + b.duration + GRACE : 0;
  return (
    <Sheet open={!!ref && !!b} onClose={() => open("late", null)} label="When did you do it?">
      {b && (
        <div className="pb-2">
          <div className="eyebrow">{b.title}</div>
          <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.02em]">When did you do it?</h2>
          <p className="mt-1 text-[14px] text-mute">
            Planned {fmtRange(b.start, b.duration)}. Done by {fmtTime(deadline)} is on time. After that it's done late, worth half.
          </p>

          <div className="mt-5 grid gap-2">
            <Pressable
              scale={0.98}
              onClick={() => finish(b.start + b.duration)}
              className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.04] p-4 text-left"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-good/15 text-good">
                <Icon name="check" size={20} stroke={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">On time, I forgot to tick</span>
                <span className="block text-[13px] text-faint">Full credit. Be honest.</span>
              </span>
            </Pressable>
            {isToday && (
              <Pressable
                scale={0.98}
                onClick={() => finish(now)}
                className="flex items-center gap-3 rounded-2xl border border-line bg-white/[0.04] p-4 text-left"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-mute">
                  <Icon name="clock" size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">Just now · {fmtTime(now)}</span>
                  <span className="block text-[13px] text-faint">Done late, half credit. Still beats skipping it.</span>
                </span>
              </Pressable>
            )}
          </div>

          <div className="eyebrow mt-6 mb-2">Or roughly when</div>
          <div className="grid grid-cols-3 gap-1.5">
            {PERIODS.map((p) => {
              const future = isToday && p.from > now;
              // The block's own part of the day counts as on time.
              const onTime = b.start >= p.from && b.start < p.to;
              const when = onTime ? b.start + b.duration : Math.min(p.at, isToday ? now : p.at);
              return (
                <Pressable
                  key={p.id}
                  scale={0.94}
                  disabled={future}
                  onClick={() => finish(when)}
                  className="flex h-14 flex-col items-center justify-center rounded-xl bg-white/[0.05] disabled:opacity-30"
                >
                  <span className="text-[14px] font-semibold">{p.label}</span>
                  <span className={`text-[11px] ${when > deadline ? "text-faint" : "text-good"}`}>{when > deadline ? "late" : "on time"}</span>
                </Pressable>
              );
            })}
          </div>
          <GhostButton className="mt-2 w-full" onClick={() => open("late", null)}>
            Cancel
          </GhostButton>
        </div>
      )}
    </Sheet>
  );
}
