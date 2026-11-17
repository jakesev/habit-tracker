import { useEffect, useRef, useState, type ReactNode } from "react";
import { GhostButton, Icon, Pressable, Segmented, Toggle } from "../components/ui";
import { haptic } from "../lib/feedback";
import { DOW_SHORT, fmtDuration, fmtRange } from "../lib/time";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";
import { motion } from "framer-motion";
import { Logo } from "../components/Logo";
import { IDENTITIES, useIdentity } from "../lib/identity";
import { currentStandard, STANDARDS } from "../lib/score";
import { todayKey } from "../lib/time";
import { getLauncherIdentity, isNative, requestNotificationPermission, setLauncherIdentity, shareBackup } from "../lib/native";

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
    if (isNative) {
      const ok = await requestNotificationPermission();
      update({ notifications: ok });
      return ok ? toast("Reminders on", "They'll fire even when the app is closed.") : toast("Notifications blocked", "Allow them in Android settings for this app.");
    }
    if (!notifSupported) return toast("Not supported here", "Add the app to your home screen first.");
    const p = await Notification.requestPermission();
    if (p === "granted") {
      update({ notifications: true });
      toast("Reminders on", "We'll nudge you before each block.");
    } else toast("Notifications blocked", "Turn them on in your phone's settings.");
  };

  const exportData = async () => {
    const s = useStore.getState();
    const json = JSON.stringify({ firstDay: s.firstDay, template: s.template, days: s.days, settings: s.settings }, null, 2);
    const name = `${identity.name.toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (isNative) {
      try {
        await shareBackup(json, name);
      } catch {
        toast("Backup didn't save", "Try again, then pick Drive or Files.");
      }
      return;
    }
    const blob = new Blob([json], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const identity = useIdentity();
  const days = useStore((s) => s.days);
  const firstDay = useStore((s) => s.firstDay) ?? todayKey();
  const standard = currentStandard(days, settings, todayKey(), firstDay);
  const [launcherId, setLauncherId] = useState<string | null>(null);
  useEffect(() => {
    getLauncherIdentity().then(setLauncherId);
  }, []);
  const weekdays = template.filter((t) => t.days.includes(2)).sort((a, b) => a.start - b.start);

  return (
    <div className="px-5 pt-[calc(18px+var(--safe-top))] pb-32">
      <header>
        <div className="eyebrow">You</div>
        <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.025em]">Set the standard.</h1>
      </header>

      <section className="mt-7">
        <div className="eyebrow mb-2 px-1">Name and look</div>
        <div className="grid grid-cols-2 gap-2.5">
          {IDENTITIES.map((i) => {
            const on = i.id === identity.id;
            return (
              <Pressable
                key={i.id}
                scale={0.96}
                aria-pressed={on}
                onClick={() => {
                  update({ identity: i.id });
                  haptic("success");
                }}
                className="relative overflow-hidden rounded-[20px] border p-4 text-left transition-colors"
                style={{
                  borderColor: on ? `rgb(${i.rgb.join(" ")} / 0.55)` : "var(--color-line)",
                  background: on ? `radial-gradient(120% 100% at 0% 0%, rgb(${i.rgb.join(" ")} / 0.16), transparent 70%)` : "rgb(255 255 255 / 0.025)",
                }}
              >
                <div className="flex items-center justify-between">
                  <Logo identity={i} size={40} />
                  {on && (
                    <motion.span layoutId="identity-on" className="grid h-6 w-6 place-items-center rounded-full" style={{ background: `rgb(${i.rgb.join(" ")})` }}>
                      <Icon name="check" size={14} stroke={3} className="text-black" />
                    </motion.span>
                  )}
                </div>
                <div className="mt-3 text-[16px] font-semibold tracking-[-0.01em]">{i.name}</div>
                <div className="text-[12px] font-medium" style={{ color: `rgb(${i.hi.join(" ")})` }}>{i.meaning}</div>
                <div className="mt-1.5 text-[12px] leading-snug text-faint">{i.line}</div>
              </Pressable>
            );
          })}
        </div>
        {isNative && launcherId != null && launcherId !== identity.id ? (
          <div className="mt-3 rounded-2xl border border-line bg-white/[0.03] p-4">
            <GhostButton
              className="w-full"
              onClick={async () => {
                if (await setLauncherIdentity(identity.id)) {
                  setLauncherId(identity.id);
                  toast(`${identity.name} is on your phone`, "If the icon vanished from your home screen, drag it back from the app drawer.");
                }
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Logo identity={identity} size={22} /> Use {identity.name} on the home screen
              </span>
            </GhostButton>
            <p className="mt-2 text-[12px] text-faint">Changes the app's icon and name. Some launchers take the old icon off your home screen; add it back from the app drawer.</p>
          </div>
        ) : (
          <p className="mt-2 px-1 text-[12px] text-faint">Tap to try each one. {isNative ? "This one is on your home screen." : ""}</p>
        )}
      </section>

      <section className="mt-7">
        <div className="eyebrow mb-2 px-1">Your standard</div>
        <div className="card overflow-hidden">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-[17px] font-semibold tracking-[-0.01em]">{standard.level}</div>
              <div className="num text-[13px] text-mute">Discipline {Math.round(standard.disciplineIndex)}</div>
            </div>
            <p className="mt-1 text-[13px] leading-snug text-faint">
              {standard.next
                ? `${standard.next.gap} more to ${standard.next.level}. Then the bar rises to ${standard.next.threshold}%.`
                : "The top standard. Hold it."}
            </p>
          </div>
          <ol className="border-t border-line">
            {STANDARDS.map((st, i) => {
              const cur = i === standard.index;
              const past = i < standard.index;
              return (
                <li
                  key={st.level}
                  className="relative flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                  style={cur ? { background: "rgb(var(--ember-rgb) / 0.08)" } : undefined}
                >
                  {cur && <span className="absolute inset-y-0 left-0 w-[3px] bg-ember" />}
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                      cur ? "bg-ember text-black" : past ? "bg-white/15 text-ink" : "border border-white/15 text-faint"
                    }`}
                  >
                    {past ? <Icon name="check" size={13} stroke={3} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[15px] font-medium ${cur ? "" : past ? "text-mute" : "text-faint"}`}>{st.level}</div>
                    <div className="text-[12px] text-faint">
                      {st.passes} rest pass{st.passes > 1 ? "es" : ""} a week · from discipline {st.from}
                    </div>
                  </div>
                  <div className={`num shrink-0 text-[17px] font-semibold ${cur ? "text-ember-hi" : past ? "text-mute" : "text-faint"}`}>{st.threshold}%</div>
                </li>
              );
            })}
          </ol>
          <p className="px-4 py-3 text-[12px] leading-snug text-faint">
            A day counts when you finish this share of its plan. The bar rises as you hold it for weeks and eases back if you slip. Each day keeps the
            standard it started with.
          </p>
        </div>
      </section>

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
        <Row label="Notifications" hint={isNative ? "Before each block, even when the app is closed." : notifSupported ? "While the app is open or in the background." : "Add to home screen to enable."}>
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
        <Row label="Haptics" hint={isNative ? undefined : "Android only. iPhone browsers don't allow vibration."}>
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
              toast(ok ? "Restored" : "That file didn't work", ok ? "Your history is back." : "Pick a backup file from this app.");
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
      <p className="mt-6 text-center text-[12px] text-faint">{identity.name} · Phase 1</p>
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
