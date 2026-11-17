import { useRef, useState, type ReactNode } from "react";
import { GhostButton, Icon, Pressable, Segmented, Toggle } from "../components/ui";
import { haptic } from "../lib/feedback";
import { DOW_SHORT, fmtDuration, fmtRange } from "../lib/time";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";

export function You() {
  const settings = useStore((s) => s.settings);
  const template = useStore((s) => s.template);
  const update = useStore((s) => s.updateSettings);
  const toast = useUI((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const notifSupported = typeof Notification !== "undefined";

  const enableNotifications = async (on: boolean) => {
    if (!on) return update({ notifications: false });
    if (!notifSupported) return toast("Not supported here", "Add Stride to your home screen first.");
    const p = await Notification.requestPermission();
    if (p === "granted") {
      update({ notifications: true });
      toast("Reminders on", "We'll nudge you before each block.");
    } else toast("Notifications blocked", "Turn them on in your phone's settings.");
  };

  const exportData = () => {
    const s = useStore.getState();
    const blob = new Blob([JSON.stringify({ firstDay: s.firstDay, template: s.template, days: s.days, settings: s.settings }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stride-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const weekdays = template.filter((t) => t.days.includes(2)).sort((a, b) => a.start - b.start);

  return (
    <div className="px-5 pt-[calc(18px+var(--safe-top))] pb-32">
      <header>
        <div className="eyebrow">You</div>
        <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.025em]">Set the standard.</h1>
      </header>

      <Group title="Streak">
        <Row label="A day counts at" hint="One missed block shouldn't wipe a good week.">
          <Stepper value={settings.streakThreshold} min={50} max={100} step={5} unit="%" onChange={(v) => update({ streakThreshold: v })} />
        </Row>
        <Row label="Rest passes per week" hint="Keeps the chain alive. Needs a reason.">
          <Stepper value={settings.restPassesPerWeek} min={0} max={3} step={1} onChange={(v) => update({ restPassesPerWeek: v })} />
        </Row>
      </Group>

      <Group title="Check-in">
        <div className="px-4 py-4">
          <div className="text-[15px] font-medium">Ask “How loud was the excuse?”</div>
          <div className="mt-3">
            <Segmented
              id="timing"
              value={settings.questionTiming}
              onChange={(v) => update({ questionTiming: v })}
              options={[
                { value: "before", label: "Before I start" },
                { value: "after", label: "After I finish" },
              ]}
            />
          </div>
        </div>
      </Group>

      <Group title="Reminders">
        <Row label="Notifications" hint={notifSupported ? "While Stride is open or in the background." : "Add to home screen to enable."}>
          <Toggle label="Notifications" on={settings.notifications} onChange={enableNotifications} />
        </Row>
        <div className="px-4 py-4">
          <div className="text-[15px] font-medium">Default lead time</div>
          <div className="mt-3">
            <Segmented
              id="lead"
              value={settings.defaultReminderLead}
              onChange={(v) => update({ defaultReminderLead: v })}
              options={[5, 10, 15, 30, 60].map((m) => ({ value: m, label: `${m}m` }))}
            />
          </div>
        </div>
      </Group>

      <Group title="Feel">
        <Row label="Haptics" hint="Android only. iPhone browsers don't allow vibration.">
          <Toggle
            label="Haptics"
            on={settings.haptics}
            onChange={(v) => {
              update({ haptics: v });
              if (v) haptic("success");
            }}
          />
        </Row>
        <Row label="Sounds">
          <Toggle label="Sounds" on={settings.sound} onChange={(v) => update({ sound: v })} />
        </Row>
      </Group>

      <Group title="Routine">
        <Row label="Family night" hint="The one proper family block each week.">
          <select
            value={settings.familyNight}
            onChange={(e) => update({ familyNight: Number(e.target.value) })}
            className="h-10 rounded-xl border border-line bg-white/[0.05] px-3 text-[15px] text-ink"
            aria-label="Family night"
          >
            {DOW_SHORT.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </Row>
        <div className="px-4 pt-3 pb-4">
          <div className="eyebrow mb-2">Weeknights</div>
          <ul className="space-y-1.5">
            {weekdays.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-[14px]">
                <span className="text-mute">{t.title}</span>
                <span className="num text-faint">
                  {fmtRange(t.start, t.duration)} · {fmtDuration(t.duration)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-faint">Changes apply from the next new day. The full template editor comes in Phase 3.</p>
        </div>
      </Group>

      <Group title="Your data">
        <div className="grid grid-cols-2 gap-2 p-3">
          <GhostButton onClick={exportData}>
            <span className="inline-flex items-center gap-2">
              <Icon name="download" size={16} /> Back up
            </span>
          </GhostButton>
          <GhostButton onClick={() => fileRef.current?.click()}>
            <span className="inline-flex items-center gap-2">
              <Icon name="upload" size={16} /> Restore
            </span>
          </GhostButton>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const ok = useStore.getState().importData(await f.text());
              toast(ok ? "Restored" : "That file didn't work", ok ? "Your history is back." : "Pick a Stride backup file.");
              e.target.value = "";
            }}
          />
        </div>
        <p className="px-4 pb-4 text-[12px] text-faint">Everything is stored on this device. Back up now and then.</p>
      </Group>

      <div className="mt-8">
        {!confirmReset ? (
          <Pressable onClick={() => setConfirmReset(true)} className="h-12 w-full text-[14px] text-faint">
            Reset everything
          </Pressable>
        ) : (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-4">
            <div className="text-[15px] font-medium">Wipe all history?</div>
            <p className="mt-1 text-[13px] text-mute">Streaks, notes, scores. Gone. This can't be undone.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <GhostButton onClick={() => setConfirmReset(false)}>Keep it</GhostButton>
              <Pressable
                onClick={() => {
                  useStore.getState().resetAll();
                  useStore.getState().ensureDays();
                  setConfirmReset(false);
                  toast("Fresh start", "Day one. Make it count.");
                }}
                className="h-12 rounded-2xl bg-red-500/90 font-medium text-white"
              >
                Wipe it
              </Pressable>
            </div>
          </div>
        )}
      </div>
      <p className="mt-6 text-center text-[12px] text-faint">Stride Routine · Phase 1</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="eyebrow mb-2 px-1">{title}</div>
      <div className="card divide-y divide-white/[0.06] overflow-hidden">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[64px] items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[15px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-faint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Stepper({ value, min, max, step, unit = "", onChange }: { value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-xl bg-white/[0.05] p-1">
      <Pressable aria-label="Less" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="grid h-9 w-9 place-items-center rounded-lg text-mute disabled:opacity-30">
        <Icon name="minus" size={16} />
      </Pressable>
      <span className="num w-12 text-center text-[15px] font-semibold">
        {value}
        {unit}
      </span>
      <Pressable aria-label="More" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="grid h-9 w-9 place-items-center rounded-lg text-mute disabled:opacity-30">
        <Icon name="plus" size={16} />
      </Pressable>
    </div>
  );
}
