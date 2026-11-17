import { useEffect, useState } from "react";
import { GhostButton, Icon, PrimaryButton, Sheet } from "../components/ui";
import { haptic } from "../lib/feedback";
import { isNative, requestNotificationPermission, sendTestReminder } from "../lib/native";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";

const EXAMPLES = [
  { t: "Writing in 10 min", b: "6:15–6:45pm. You said you'd do it. Prove it." },
  { t: "Now: Shower (cold)", b: "Until 5:15pm. Next: Dinner at 5:15pm." },
  { t: "Today: 9 blocks, first Shower at 5:00pm", b: "The whole plan, in your notifications." },
];

/** First open of the Android app: ask for reminders once, with what they'll look like. */
export function NotifyPrompt() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const toast = useUI((s) => s.showToast);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isNative || settings.notifications || settings.notificationsAsked) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [settings.notifications, settings.notificationsAsked]);

  const close = () => {
    update({ notificationsAsked: true });
    setOpen(false);
  };

  return (
    <Sheet open={open} onClose={close} label="Turn on reminders">
      <div className="pb-2">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ember/15 text-ember">
          <Icon name="bell" size={24} />
        </span>
        <h2 className="mt-4 text-[24px] font-semibold tracking-[-0.02em]">Get a heads-up before every block</h2>
        <p className="mt-1 text-[15px] text-mute">Reminders arrive even when the app is closed. Next, Android asks to allow notifications, then "Alarms &amp; reminders" so they land on the minute.</p>
        <div className="mt-5 grid gap-2">
          {EXAMPLES.map((e) => (
            <div key={e.t} className="flex items-start gap-3 rounded-2xl border border-line bg-white/[0.03] px-4 py-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ember" />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">{e.t}</div>
                <div className="text-[13px] text-faint">{e.b}</div>
              </div>
            </div>
          ))}
        </div>
        <PrimaryButton
          className="mt-6"
          onClick={async () => {
            const ok = await requestNotificationPermission();
            update({ notifications: ok, notificationsAsked: true });
            setOpen(false);
            if (ok) {
              haptic("success");
              await sendTestReminder();
              toast("Reminders on", "A test one arrives in 5 seconds.");
            } else toast("Notifications blocked", "Turn them on in Android settings → Apps → Shugyo.");
          }}
        >
          Turn on reminders
        </PrimaryButton>
        <GhostButton className="mt-2 w-full" onClick={close}>
          Not now
        </GhostButton>
      </div>
    </Sheet>
  );
}
