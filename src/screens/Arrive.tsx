import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { GhostButton, Icon, Pressable, PrimaryButton, Sheet, spring, CATEGORY_COLOR } from "../components/ui";
import { haptic } from "../lib/feedback";
import { planHome, snapArrival, type Change } from "../lib/plan";
import { fmtDuration, fmtRange, fmtTime, nowMin, STEP, todayKey } from "../lib/time";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";

/** "I'm home": pick the arrival time, see what changes and why, then apply. */
export function ArriveSheet() {
  const open = useUI((s) => s.home);
  const setOpen = useUI((s) => s.openHome);
  const toast = useUI((s) => s.showToast);
  const today = todayKey();
  const day = useStore((s) => s.days[today]);
  const settings = useStore((s) => s.settings);
  const apply = useStore((s) => s.applyHomePlan);
  const [at, setAt] = useState(() => snapArrival(nowMin()));

  useEffect(() => {
    if (open) setAt(snapArrival(Math.floor(nowMin())));
  }, [open]);

  // Plan from the pre-arrival version if you're correcting the time.
  const base = day?.beforeHome ?? day?.blocks ?? [];
  const plan = useMemo(() => planHome(base, at, { usualHome: settings.homeTime, bedTime: settings.bedTime }), [base, at, settings.homeTime, settings.bedTime]);
  const late = at - settings.homeTime;

  return (
    <Sheet open={open} onClose={() => setOpen(false)} label="I'm home">
      <div className="eyebrow">{late > 0 ? `${fmtDuration(late)} later than usual` : late < 0 ? "Home early" : "Right on time"}</div>
      <h2 className="mt-1.5 text-[26px] font-semibold tracking-[-0.02em]">Welcome home.</h2>
      <p className="mt-1 text-[15px] text-mute">Shower. Eat. Then get after it.</p>

      {/* Arrival time */}
      <div className="mt-5 flex items-center justify-between rounded-2xl border border-line bg-white/[0.03] py-2 pr-2 pl-4">
        <div>
          <div className="text-[12px] text-faint">Home at</div>
          <motion.div key={at} initial={{ y: 4, opacity: 0.5 }} animate={{ y: 0, opacity: 1 }} transition={spring} className="num text-[24px] font-semibold">
            {fmtTime(at)}
          </motion.div>
        </div>
        <div className="flex gap-2">
          <Pressable aria-label="15 minutes earlier" onClick={() => setAt((m) => m - STEP)} className="grid h-12 w-12 place-items-center rounded-xl bg-white/[0.06]">
            <Icon name="minus" size={18} />
          </Pressable>
          <Pressable aria-label="15 minutes later" disabled={at + STEP >= settings.bedTime} onClick={() => setAt((m) => m + STEP)} className="grid h-12 w-12 place-items-center rounded-xl bg-white/[0.06] disabled:opacity-30">
            <Icon name="plus" size={18} />
          </Pressable>
        </div>
      </div>

      {/* What changed and why */}
      <div className="mt-5 flex items-start gap-2 text-[14px] text-mute">
        <Icon name="sparkle" size={15} className="mt-0.5 shrink-0 text-ember" />
        <span>{plan.summary}</span>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line">
        {plan.changes.map((c) => (
          <ChangeRow key={c.id} c={c} category={base.find((b) => b.id === c.id)?.category ?? "anchor"} />
        ))}
        {plan.blocks
          .filter((b) => b.type === "fixed" && b.status === "planned" && b.start >= plan.homeAt)
          .map((b) => (
            <div key={b.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
              <Icon name="shield" size={15} className="shrink-0 text-faint" />
              <div className="min-w-0 flex-1 truncate text-[14px] text-faint">{b.title}</div>
              <div className="num shrink-0 text-[13px] text-faint">{fmtTime(b.start)} · fixed</div>
            </div>
          ))}
      </div>

      <PrimaryButton
        className="mt-5"
        onClick={() => {
          apply(today, plan);
          haptic("success");
          setOpen(false);
          toast("Plan updated", plan.changes.some((c) => c.kind !== "same") ? "Your evening now fits. Go." : "Nothing had to change.");
        }}
      >
        Use this plan
      </PrimaryButton>
      <GhostButton className="mt-2 w-full" onClick={() => setOpen(false)}>
        Not now
      </GhostButton>
    </Sheet>
  );
}

function ChangeRow({ c, category }: { c: Change; category: string }) {
  const dropped = c.kind === "dropped";
  const tag =
    c.kind === "dropped"
      ? "Dropped · excused"
      : c.kind === "same"
        ? "No change"
        : c.kind === "moved"
          ? `Moved from ${fmtTime(c.from.start)}`
          : c.kind === "shrunk"
            ? `${c.from.duration} → ${c.to!.duration} min`
            : `${c.from.duration} → ${c.to!.duration} min, was ${fmtTime(c.from.start)}`;
  return (
    <div className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[category], opacity: dropped ? 0.3 : 1 }} />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[15px] font-medium ${dropped ? "text-faint line-through decoration-white/25" : ""}`}>{c.title}</div>
        <div className={`truncate text-[12px] ${dropped ? "text-faint" : c.kind === "same" ? "text-faint" : "text-ember-hi"}`}>{tag}</div>
      </div>
      {c.to && <div className="num shrink-0 text-[13px] text-mute">{fmtRange(c.to.start, c.to.duration)}</div>}
    </div>
  );
}
