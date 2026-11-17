/**
 * Google sign-in (through Supabase) and the Google access token for calendar sync.
 *
 * Off until the build has VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
 * (see SETUP-GOOGLE.md). Without them the app runs exactly as before, fully on-device.
 */
import { Browser } from "@capacitor/browser";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { isNative } from "./native";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const cloudConfigured = !!(URL_ && KEY);

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(URL_!, KEY!, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: !isNative },
    })
  : null;

/** Create a calendar for the app and manage it; read your other calendars. Nothing else. */
const SCOPES = ["https://www.googleapis.com/auth/calendar.app.created", "https://www.googleapis.com/auth/calendar.readonly"].join(" ");

const NATIVE_REDIRECT = "routine://auth-callback";

export async function connectGoogle(): Promise<void> {
  if (!supabase) throw new Error("Calendar sync isn't set up in this build yet.");
  const redirectTo = isNative ? NATIVE_REDIRECT : window.location.origin + window.location.pathname;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      scopes: SCOPES,
      redirectTo,
      skipBrowserRedirect: isNative,
      // offline + consent = Google hands over a refresh token, so sync keeps working.
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw error;
  // Google blocks sign-in inside app web views, so the Android app uses a browser tab.
  if (isNative && data?.url) await Browser.open({ url: data.url, presentationStyle: "popover" });
}

/** routine://auth-callback?code=… from the browser tab, back in the Android app. */
export async function handleAuthRedirect(url: string): Promise<boolean> {
  if (!supabase || !url.startsWith(NATIVE_REDIRECT)) return false;
  const code = new URL(url.replace("routine://", "https://app/")).searchParams.get("code");
  Browser.close().catch(() => {});
  if (!code) return true;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return true;
}

export async function disconnectGoogle() {
  if (!supabase) return;
  try {
    await supabase.functions.invoke("google-token", { body: { action: "revoke" } });
  } finally {
    token = null;
    await supabase.auth.signOut();
  }
}

/** Right after sign-in Google's refresh token is in the session once; keep it server-side. */
export async function storeRefreshToken(session: Session) {
  if (!supabase || !session.provider_refresh_token) return;
  await supabase.functions.invoke("google-token", { body: { action: "store", refresh_token: session.provider_refresh_token } });
  if (session.provider_token) token = { value: session.provider_token, expires: Date.now() + 50 * 60_000 };
}

let token: { value: string; expires: number } | null = null;

export class ReconnectNeeded extends Error {}

/** A Google access token, refreshed through the google-token Edge Function when it runs out. */
export async function googleAccessToken(force = false): Promise<string> {
  if (!supabase) throw new Error("not configured");
  if (!force && token && token.expires > Date.now() + 60_000) return token.value;
  const { data, error } = await supabase.functions.invoke("google-token", { body: { action: "access" } });
  if (error || !data?.access_token) {
    if (data?.error === "reconnect" || (error as { context?: { status?: number } })?.context?.status === 409) throw new ReconnectNeeded("Google needs you to connect again.");
    throw error ?? new Error("No Google token");
  }
  token = { value: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return token.value;
}
