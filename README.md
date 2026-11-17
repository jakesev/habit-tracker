# Shugyo · Vow

A mobile-first accountability app built around one idea: choose discomfort on purpose, every day, and keep the promise you made to yourself. Dark, calm, one accent. Tough on the next action, kind about the past.

Two identities, switchable in **You → Name and look**. On Android the home-screen icon and name switch too.

- **Shugyo** (修行, "austere training"): daily, deliberate discomfort that forges the spirit, not just the skill. Its mark is an ensō, the open Zen brush circle: practice is never finished.
- **Vow**: a promise to yourself, kept when no one is watching. Its mark is a chain link: the bond, and the streak you don't break.

## Install on Android

1. On your phone, open **github.com/jakesev/habit-tracker/releases/tag/android-latest**.
2. Tap **routine-app.apk**, open the download, and allow installs from your browser if Android asks.
3. Open the app, go to **You → Reminders** and turn notifications on.

Every push rebuilds the app (`.github/workflows/android.yml`). Installing a new build goes over the top and keeps your data.

Long-press the app icon for the **I'm home** shortcut.

This is **Phase 1: core accountability**. Phases 2 (dynamic re-planning, Google Calendar, push) and 3 (smart planning, trends, weekly review, template editor) come next.

## What's in Phase 1

| Area | What it does |
| --- | --- |
| **Home** | Streak hero with a glow that grows at 3/7/14/30/60 days, 7-day strip, Discipline and Productivity gauges, today %, focused hours this week, the next block with a Start button, and one rule-based smart line. |
| **Today** | The block to do *now* (or next) as the hero card with one main action, then a vertical timeline with a live "now" line. Every block has a tick box, a note, a checklist, Skip with a reason and an adjustable reminder. |
| **Focus timer** | Full screen, presets 15/30/45/60/90 and ±15 steps, draining ring, pause/resume, finish early, "Did you complete it?" (Done / Partly / Skipped), halfway and 2-minute buzzes, screen kept awake. Survives reloads. |
| **Check-in** | Ten seconds after each block: *How loud was the excuse?*, *What was in the tank?*, *How hard was it to get moving?*, plus a note. All optional. Difficulty 7+ earns **Stayed hard**. |
| **Streak** | Month calendar. Boxes fill with the share of the day done, streak days link with a bar and glow, rest passes show as a shield. Tap a day for its blocks, notes and ratings. |
| **Standards** | No manual threshold. Your level sets the bar: Starting out 70% (2 rest passes a week), Building 80%, Solid 90%, Elite 100% (1 rest pass each). Each day keeps the standard it started with, so levelling up never rewrites history. |
| **Scoring** | Daily discipline score (priority × difficulty), streak day when the day's standard is met, discipline index = 30-day avg × consistency, productivity = minutes + blocks delivered with a streak bonus up to 1.2×. |
| **On time** | Each block has its time plus 15 min of grace. Done in that window = full credit. Done after = **done late, half credit**, recorded with how late. Ticking after the grace asks "When did you do it?": *On time, I forgot to tick* keeps full credit. |
| **Hard version** | Any block can have one (Shower → **Cold**). Ticking asks "Cold?". Yes = **Stayed hard** and a discipline boost. |
| **Log it** | **+ Add → Log it** for things off the plan: "Push-ups · 20 reps · 6:42am". Shows on Today at that time. +2 to the day's discipline score each (max +6). Never needed for the streak. Logged often = one-tap buttons. |
| **Timing and advice** | On-time rate and average minutes late, per block and overall (Home → On time). When a block runs late most days, a tip offers a one-tap "Move it to …" for every week. |
| **Timers** | Only for deep work (skills, reading). Everything else is a plain **Done**. |
| **Rules** | 15-minute grid everywhere. Unticked blocks auto-mark *Not done* 15 min after their window closes. Corrections are logged and lock at the end of the next day. Excused skips leave the day's total. |
| **Add and edit** | The **+ Add** on Today: add a habit block or an event (busy time, not scored) to any day, once or every week; edit or delete any block for just that day or every week. Tap a future day on the calendar to see its plan and add to it. |
| **I'm home** | Only when you choose it (+ Add → "Home early or late?", or long-press the app icon): shower and dinner go first, then the evening re-plans around the fixed anchors (dogs, wind down). Flexible blocks shrink 15 min at a time before anything drops; family time is never cut. You see what changed and why before applying, and can undo. |
| **You** | Name and look (Shugyo / Vow), your standard ladder, check-in timing, reminder defaults, haptics, sounds, family night, backup/restore, reset. |

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (also on your LAN for your phone)
npm test         # scoring, streak and 15-minute rule tests
npm run build    # static site in dist/
npx cap sync android   # copy the build into the Android project (android/)
```

Deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages). On your phone, open it and **Add to Home Screen** to install it. The app works offline.

## Data

Phase 1 is **local-first**: everything is stored on the device, so it's instant and works offline. Use **You → Back up** now and then.

**Google Calendar sync** (You → Google Calendar) is built in but stays off until it's set up. Follow **[SETUP-GOOGLE.md](SETUP-GOOGLE.md)** (about 10 minutes). Once on, your blocks go into a "Shugyo" calendar in your Google account, and your other events show in Today as busy time. Sign-in uses Supabase Auth with Google, and the Google refresh token is kept server-side by the `google-token` Edge Function.

`supabase/migrations/` holds the Postgres schema with row-level security.

## Platform notes

- **Android app:** reminders are scheduled with the system, so they fire even when the app is closed, after a restart, and in Doze. The focus timer alarm does too. Haptics are native.
- **Web version:** reminders fire while the page is open or in the background. iPhone browsers block web vibration, and web push on iPhone needs the page added to the Home Screen (iOS 16.4+).
- **Reduce motion:** respected. Slides become fades.

## Structure

```
src/
  lib/       time (15-min grid), seed routine, scoring + streaks, "I'm home" planner (pure, tested),
             Google sign-in + calendar sync (cloud.ts, gcal.ts, gcal-map.ts),
             identities, native bridge (notifications, haptics, icon switch), voice, feedback
  store/     persisted app state (zustand) and UI state
  screens/   Home, Today, Streak, You, Focus, sheets
  components/ Check (tick + burst), DayBox, Ring, Sheet, Scale, Segmented, icons
android/     Capacitor Android project: launcher aliases per identity, RoutineNative plugin, icons
supabase/    schema migrations and the google-token Edge Function
```

The sideload signing key in `android/keystore/` is deliberately committed. It lets new builds install over old ones. It protects no account or data. Before publishing to the Play Store, switch to a private key stored as a GitHub secret.
