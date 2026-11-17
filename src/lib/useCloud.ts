import { useEffect } from "react";
import { useStore } from "../store/store";
import { useUI } from "../store/ui";
import { ReconnectNeeded, storeRefreshToken, supabase } from "./cloud";
import { pushBlocks, syncCalendar } from "./gcal";

/** Keeps Google Calendar in step: on sign-in, on open, every 10 minutes, and shortly after plan changes. */
export function useCloud() {
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const report = (e: unknown) => {
      if (e instanceof ReconnectNeeded) {
        useStore.getState().setCloud({ connected: false });
        useUI.getState().showToast("Calendar disconnected", "Google asked you to connect again. You → Google Calendar.");
      }
    };
    const full = () => {
      if (useStore.getState().cloud.connected) syncCalendar().catch(report);
    };

    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        useStore.getState().setCloud({ connected: true, email: data.session.user.email ?? undefined });
        full();
      }
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") useStore.getState().setCloud({ connected: false, email: undefined });
      if (session && event === "SIGNED_IN") {
        useStore.getState().setCloud({ connected: true, email: session.user.email ?? undefined, error: undefined });
        storeRefreshToken(session)
          .then(() => syncCalendar())
          .then(() => useUI.getState().showToast("Google Calendar connected", "Your plan is in your calendar now."))
          .catch(report);
      }
    });

    const vis = () => document.visibilityState === "visible" && full();
    document.addEventListener("visibilitychange", vis);
    const every = setInterval(full, 10 * 60_000);

    // Push edits a few seconds after they happen.
    let t: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStore.subscribe((s, prev) => {
      if (s.days === prev.days || !s.cloud.connected) return;
      clearTimeout(t);
      t = setTimeout(() => pushBlocks().catch(report), 4000);
    });

    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", vis);
      clearInterval(every);
      clearTimeout(t);
      unsub();
    };
  }, []);
}
