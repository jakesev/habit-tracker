import { useRef, useState, type ReactNode } from "react";
import { GhostButton, Icon, Pressable, Segmented, spring, Toggle } from "../components/ui";
import { haptic } from "../lib/feedback";
import { DOW_SHORT, fmtDuration, fmtRange } from "../lib/time";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "../components/Logo";
import { LeadPicker } from "../components/LeadPicker";
import { CalendarSettings } from "./CalendarSettings";
import { PlanSection } from "./Program";
import { APP, THEMES, useTheme } from "../lib/identity";
import { currentStandard, STANDARDS } from "../lib/score";
import { todayKey } from "../lib/time";
import { isNative, requestNotificationPermission, sendTestReminder, shareBackup } from "../lib/native";

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
    const name = `${APP.name.toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`;
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

  const theme = useTheme();
  const days = useStore((s) => s.days);
  const firstDay = useStore((s) => s.firstDay) ?? todayKey();
  const standard = currentStandard(days, settings, todayKey(), firstDay);
  const [showLadder, setShowLadder] = useState(false);
  const weekdays = template.filter((t) => t.days.includes(2)).sort((a, b) => a.start - b.start);

  return (
    <div className="px-5 pt-[calc(18px+var(--safe-top))] pb-32">
      <header>
        <div className="eyebrow">You</div>
        <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.025em]">Set the standard.</h1>
      </header>

      <section className="mt-7">
        <div className="eyebrow mb-2 px-1">Theme</div>
        <div className="grid grid-cols-3 gap-2.5">
          {THEMES.map((t) => {
            const on = t.id === theme.id;
            const c = `rgb(${t.rgb.join(" ")})`;
            return (
              <Pressable
                key={t.id}
                scale={0.95}
                aria-pressed={on}
                aria-label={`${t.name} theme`}
                onClick={() => {
                  update({ theme: t.id });
                  haptic("success");
                }}
                className="relative overflow-hidden rounded-[18px] border p-2.5 text-left transition-colors"
                style={{ borderColor: on ? `rgb(${t.rgb.join(" ")} / 0.6)` : "var(--color-line)", background: t.bg }}
              >
                {/* a tiny preview of the app in this theme */}
                <div className="rounded-[12px] p-2" style={{ background: `radial-gradient(120% 90% at 50% 0%, rgb(${t.rgb.join(" ")} / 0.22), transparent 70%)` }}>
                  <div className="flex items-center justify-between">
                    <Logo theme={t} size={18} />
                    <span className="h-3.5 w-3.5 rounded-full border-2" style={{ borderColor: c, borderRightColor: "transparent" }} />
                  </div>
                  <div className="mt-2 h-1.5 w-3/4 rounded-full bg-white/15" />
                  <div className="mt-1 h-1.5 w-1/2 rounded-full bg-white/10" />
                  <div className="mt-2.5 h-4 rounded-md" style={{ background: c }} />
                </div>
                <div className="mt-2 flex items-center justify-between px-0.5">
                  <span className="text-[13px] font-semibold">{t.name}</span>
                  {on && (
                    <motion.span layoutId="theme-on" className="grid h-4 w-4 place-items-center rounded-full" style={{ background: c }}>
                      <Icon name="check" size={10} stroke={3.4} className="text-black" />
                    </motion.span>
                  )}
                </div>
              </Pressable>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[12px] text-faint">{theme.line}</p>
      </section>
      <PlanSection />

      <section className="mt-7">
        <div className="eyebrow mb-2 px-1">Your standard</div>
        <div className="card overflow-hidden">
          <Pressable
            scale={0.99}
            aria-expanded={showLadder}
            onClick={() => setShowLadder((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left"
          >
            <span className="num grid h-11 min-w-11 shrink-0 place-items-center rounded-xl bg-ember/15 px-2 text-[15px] font-semibold text-ember-hi">
              {standard.threshold}%
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold tracking-[-0.01em]">{standard.level}</span>
              <span className="block text-[12px] leading-snug text-faint">
                {standard.next ? `${standard.next.gap} more discipline to ${standard.next.level} · ${standard.next.threshold}%` : "The top standard. Every block. Hold it."}
              </span>
            </span>
            <motion.span animate={{ rotate: showLadder ? 180 : 0 }} transition={spring} className="shrink-0 text-faint">
              <Icon name="chevron" size={20} />
            </motion.span>
          </Pressable>
          <AnimatePresence initial={false}>
            {showLadder && (
              <motion.div
                key="ladder"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ height: { type: "spring", stiffness: 380, damping: 38 }, opacity: { duration: 0.18 } }}
                className="overflow-hidden"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
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
        {isNative && settings.notifications && (
          <div className="px-4 py-3">
            <GhostButton
              className="w-full"
              onClick={async () => {
                await sendTestReminder();
                toast("Test reminder sent", "Pull down your notifications to see it.");
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Icon name="bell" size={16} /> Send a test reminder
              </span>
            </GhostButton>
            <p className="mt-2 text-[12px] text-faint">
              A heads-up before each block with Done and Snooze buttons, "Now" when it starts, the day's plan before the first one. Blocks with Alarm on ring until you
              dismiss them.
            </p>
          </div>
        )}
        {isNative && settings.notifications && (
          <Row label="Up next in your notifications" hint="One quiet line that always shows what's now and next.">
            <Toggle label="Up next in your notifications" on={settings.upNext} onChange={(v) => update({ upNext: v })} />
          </Row>
        )}
        <div className="px-4 py-4">
          <div className="text-[15px] font-medium">Break between blocks</div>
          <div className="mt-0.5 text-[12px] text-faint">Focus timers end this much early so you can reset before the next block.</div>
          <div className="mt-3">
            <Segmented
              id="transition"
              value={settings.transition}
              onChange={(v) => update({ transition: v })}
              options={[
                { value: 0, label: "None" },
                { value: 5, label: "5 min" },
                { value: 10, label: "10 min" },
              ]}
            />
          </div>
        </div>
        {isNative && (
          <div className="flex items-start gap-3 px-4 py-4">
            <Icon name="home" size={18} className="mt-0.5 shrink-0 text-ember" />
            <div className="text-[12px] leading-snug text-faint">
              <span className="font-medium text-ink">Add the widget:</span> long-press an empty spot on your home screen → Widgets → Shugyo. It shows what's now and next,
              with a Done button.
            </div>
          </div>
        )}
        <div className="px-4 py-4">
          <div className="text-[15px] font-medium">Heads-ups for new blocks</div>
          <div className="mt-3">
            <LeadPicker id="lead-default" value={settings.defaultReminderLeads} onChange={(v) => update({ defaultReminderLeads: v })} />
          </div>
        </div>
      </Group>

      <CalendarSettings />

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
      <p className="mt-6 text-center text-[12px] text-faint">{APP.name} · Phase 1</p>
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
