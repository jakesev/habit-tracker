import { Icon, Pressable, Sheet } from "../components/ui";
import { nowMin, todayKey } from "../lib/time";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";

/** The + on Today: add something, or re-plan tonight when life moved. Nothing re-plans unless you ask. */
export function PlanMenu() {
  const open = useUI((s) => s.menu);
  const ui = useUI.getState;
  const bed = useStore((s) => s.settings.bedTime);
  const late = nowMin() < bed;
  const go = (fn: () => void) => {
    ui().openMenu(false);
    setTimeout(fn, 220);
  };
  const rows = [
    { icon: "plus", title: "Add a habit block", sub: "Something to do and tick off", run: () => ui().openEditor({ mode: "add", date: todayKey() }) },
    { icon: "today", title: "Add an event", sub: "Busy time: dentist, client, appointment", run: () => ui().openEditor({ mode: "add", date: todayKey(), event: true }) },
    ...(late
      ? [{ icon: "home", title: "Home early or late?", sub: "Re-plan tonight from when you got in", run: () => ui().openHome(true) }]
      : []),
  ];
  return (
    <Sheet open={open} onClose={() => ui().openMenu(false)} label="Plan">
      <div className="grid gap-2 pb-2">
        {rows.map((r) => (
          <Pressable
            key={r.title}
            scale={0.98}
            onClick={() => go(r.run)}
            className="flex items-center gap-4 rounded-2xl border border-line bg-white/[0.03] p-4 text-left"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-ink">
              <Icon name={r.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold tracking-[-0.01em]">{r.title}</span>
              <span className="block text-[13px] text-faint">{r.sub}</span>
            </span>
          </Pressable>
        ))}
      </div>
    </Sheet>
  );
}
