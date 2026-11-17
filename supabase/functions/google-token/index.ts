// google-token: keeps each user's Google refresh token on the server and hands the app
// short-lived access tokens for Google Calendar. The refresh token never goes back to the app.
//
// Secrets (Supabase → Edge Functions → Secrets): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await asUser.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: "signed_out" }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { action, refresh_token } = await req.json().catch(() => ({}));

  if (action === "store") {
    if (typeof refresh_token !== "string" || refresh_token.length < 10) return json({ error: "bad_token" }, 400);
    const { error } = await admin.from("google_tokens").upsert({ user_id: user.id, refresh_token, updated_at: new Date().toISOString() });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  const { data: row } = await admin.from("google_tokens").select("refresh_token").eq("user_id", user.id).maybeSingle();

  if (action === "access") {
    if (!row) return json({ error: "reconnect" }, 409);
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
        refresh_token: row.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      // Revoked or expired (e.g. the app is still in Google's "Testing" mode after 7 days).
      if (body.error === "invalid_grant") {
        await admin.from("google_tokens").delete().eq("user_id", user.id);
        return json({ error: "reconnect" }, 409);
      }
      return json({ error: body.error ?? "google_error" }, 502);
    }
    return json({ access_token: body.access_token, expires_in: body.expires_in });
  }

  if (action === "revoke") {
    if (row) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh_token)}`, { method: "POST" }).catch(() => {});
      await admin.from("google_tokens").delete().eq("user_id", user.id);
    }
    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});
