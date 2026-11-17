# Turn on Google Calendar sync

The app works fully without this. Once it's set up, **You → Google Calendar → Connect** will:

- put today's and tomorrow's blocks into a calendar called **Shugyo** (or **Vow**) in your Google account, with ✓ when done
- show your other events (clients, appointments) in Today as busy time. Nothing re-plans unless you ask.

It takes about 10 minutes. Parts A and C are in your accounts. Claude can do part B for you: say "go ahead with the Supabase part".

---

## A. Google Cloud (you, about 6 minutes)

1. Go to **console.cloud.google.com**, create a project and name it `Shugyo`.
2. **APIs & Services → Library**: search **Google Calendar API** and click **Enable**.
3. **APIs & Services → OAuth consent screen** (also called "Google Auth Platform"):
   - User type: **External**. App name: `Shugyo`. Add your email as support and developer contact.
   - **Data access / Scopes**: add
     - `https://www.googleapis.com/auth/calendar.app.created`
     - `https://www.googleapis.com/auth/calendar.readonly`
   - **Audience**: click **Publish app** so the status is **In production**. If you leave it in "Testing", Google ends calendar access every 7 days. Personal use doesn't need Google's verification. When you connect you'll see "Google hasn't verified this app": tap **Advanced → Go to Shugyo**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Type: **Web application**. Name: `Shugyo (Supabase)`.
   - **Authorized redirect URIs**: `https://<your-project-ref>.supabase.co/auth/v1/callback` (from part B).
   - Copy the **Client ID** and **Client secret**.

## B. Supabase (Claude can do this, about 2 minutes)

1. Create a free project named `shugyo` (Sydney region).
2. Run the migrations in `supabase/migrations/` (the `0002_google_tokens.sql` table is the one sync needs).
3. Deploy the Edge Function `supabase/functions/google-token`.
4. Read the project URL and publishable key for part C.

If you do it yourself: Dashboard → SQL editor for the migrations, and `supabase functions deploy google-token` for the function.

## C. Supabase dashboard + GitHub (you, about 2 minutes)

These hold your Google client secret, so enter them yourself rather than pasting them into a chat.

1. **Supabase → Authentication → Sign In / Providers → Google**: turn it on and paste the Client ID and Client secret from A4.
2. **Supabase → Authentication → URL Configuration → Redirect URLs**: add `routine://auth-callback`.
3. **Supabase → Edge Functions → Secrets**: add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (the same two values).
4. **GitHub → this repo → Settings → Secrets and variables → Actions → Variables** (Variables, not Secrets, because both values are public):
   - `SUPABASE_URL` = `https://<your-project-ref>.supabase.co`
   - `SUPABASE_PUBLISHABLE_KEY` = the `sb_publishable_…` key
5. Push any commit, or re-run the **Android app** workflow. Install the new build from the `android-latest` release.

Then open the app: **You → Google Calendar → Connect Google Calendar**.

---

### How it works

- Sign-in goes through Supabase Auth with Google, in a browser tab. Google doesn't allow sign-in inside an app's web view.
- Google's refresh token goes straight to the `google-token` Edge Function and is stored in `google_tokens`. That table has row-level security on and no policies, so the app can never read it back. The app only ever gets a 1-hour access token.
- The app asks Google for two permissions: manage calendars **it creates**, and **read** your calendars. It can't edit or delete your own events.
- Sync runs when you open the app, every 10 minutes while it's open, and a few seconds after you change the plan. **Sync now** forces it.
- **Disconnect** revokes the token at Google and deletes it from Supabase. The Shugyo calendar stays in your Google account until you delete it there.
