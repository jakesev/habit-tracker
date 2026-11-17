import { useState } from "react";
import { GhostButton, Icon, PrimaryButton, Toggle } from "../components/ui";
import { cloudConfigured, connectGoogle, disconnectGoogle } from "../lib/cloud";
import { syncCalendar } from "../lib/gcal";
import { APP } from "../lib/identity";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";

function ago(t?: number) {
  if (!t) return "not yet";
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

/** You → Google Calendar. */
export function CalendarSettings() {
  const cloud = useStore((s) => s.cloud);
  const setCloud = useStore((s) => s.setCloud);
  const toast = useUI((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok?: [string, string]) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok[0], ok[1]);
    } catch (e) {
      toast("That didn't work", e instanceof Error ? e.message.slice(0, 120) : "Try again in a minute.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-7">
      <div className="eyebrow mb-2 px-1">Google Calendar</div>
      <div className="card overflow-hidden">
        <div className="flex items-start gap-3 px-4 py-4">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${cloud.connected ? "bg-good/15 text-good" : "bg-white/[0.06] text-faint"}`}>
            <Icon name="today" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium">{cloud.connected ? "Connected" : cloudConfigured ? "Not connected" : "Not set up yet"}</div>
            <div className="mt-0.5 text-[12px] leading-snug text-faint">
              {cloud.connected
                ? `${cloud.email ?? "Your Google account"} · synced ${ago(cloud.lastSync)}`
                : cloudConfigured
                  ? `Your blocks go into a "${APP.name}" calendar, and your other events show up as busy time.`
                  : "Needs a one-time setup in Google Cloud and Supabase (about 10 minutes). The steps are in SETUP-GOOGLE.md in the app's repo."}
            </div>
            {cloud.error && cloud.connected && <div className="mt-1.5 text-[12px] text-[#fca5a5]">Last sync failed: {cloud.error.slice(0, 120)}</div>}
          </div>
        </div>

        {cloud.connected ? (
          <>
            <div className="flex min-h-[60px] items-center justify-between gap-4 border-t border-line px-4 py-3">
              <div className="min-w-0">
                <div className="text-[15px] font-medium">Put my blocks in my calendar</div>
                <div className="text-[12px] text-faint">In a "{APP.name}" calendar, ✓ when done. Today and tomorrow.</div>
              </div>
              <Toggle label="Put my blocks in my calendar" on={cloud.write} onChange={(v) => setCloud({ write: v })} />
            </div>
            <div className="flex min-h-[60px] items-center justify-between gap-4 border-t border-line px-4 py-3">
              <div className="min-w-0">
                <div className="text-[15px] font-medium">Show my other events</div>
                <div className="text-[12px] text-faint">As busy time in Today. Nothing moves unless you re-plan.</div>
              </div>
              <Toggle
                label="Show my other events"
                on={cloud.read}
                onChange={(v) => {
                  setCloud({ read: v });
                  if (!v) {
                    const s = useStore.getState();
                    for (const d of Object.keys(s.days)) s.applyBusy(d, []);
                  }
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
              <GhostButton disabled={busy} onClick={() => run(syncCalendar, ["Synced", "Calendar and plan are in step."])}>
                <span className="inline-flex items-center gap-2">
                  <Icon name="undo" size={16} /> {busy ? "Syncing…" : "Sync now"}
                </span>
              </GhostButton>
              <GhostButton className="text-faint" disabled={busy} onClick={() => run(disconnectGoogle, ["Disconnected", "Your calendar keeps what's there. Nothing new is sent."])}>
                Disconnect
              </GhostButton>
            </div>
          </>
        ) : (
          cloudConfigured && (
            <div className="border-t border-line p-3">
              <PrimaryButton disabled={busy} onClick={() => run(connectGoogle)}>
                Connect Google Calendar
              </PrimaryButton>
            </div>
          )
        )}
      </div>
    </section>
  );
}
