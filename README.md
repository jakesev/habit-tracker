# Stride Routine

A mobile-first accountability app for a daily routine of skill practice, reading, family time and chores. Dark, calm, one ember accent. Tough on the next action, kind about the past.

This is **Phase 1: core accountability**. Phases 2 (dynamic re-planning, Google Calendar, push) and 3 (smart planning, trends, weekly review, template editor) come next.

## What's in Phase 1

| Area | What it does |
| --- | --- |
| **Home** | Streak hero with a glow that grows at 3/7/14/30/60 days, 7-day strip, Discipline and Productivity gauges, today %, focused hours this week, the next block with a Start button, and one rule-based smart line. |
| **Today** | The block to do *now* (or next) as the hero card with one main action, then a vertical timeline with a live "now" line. Every block has a tick box, a note, a checklist, Skip with a reason and an adjustable reminder. |
| **Focus timer** | Full screen, presets 15/30/45/60/90 and ±15 steps, draining ring, pause/resume, finish early, "Did you complete it?" (Done / Partly / Skipped), halfway and 2-minute buzzes, screen kept awake. Survives reloads. |
| **Check-in** | Ten seconds after each block: *How loud was the excuse?*, *What was in the tank?*, *How hard was it to get moving?*, plus a note. All optional. Difficulty 7+ earns **Stayed hard**. |
| **Streak** | Month calendar. Boxes fill with the share of the day done, streak days link with a bar and glow, rest passes show as a shield. Tap a day for its blocks, notes and ratings. |
| **Scoring** | Daily discipline score (priority × difficulty), streak day at ≥80% (setting), discipline index = 30-day avg × consistency, productivity = minutes + blocks delivered with a streak bonus up to 1.2×. |
| **Rules** | 15-minute grid everywhere. Unticked blocks auto-mark *Not done* when their window closes. Corrections are logged and lock at the end of the next day. Excused skips leave the day's total. |
| **You** | Streak threshold, rest passes, check-in timing, reminder defaults, haptics, sounds, family night, backup/restore, reset. |

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (also on your LAN for your phone)
npm test         # scoring, streak and 15-minute rule tests
npm run build    # static site in dist/
```

Deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages). On your phone, open it and **Add to Home Screen** to install it. The app works offline.

## Data

Phase 1 is **local-first**: everything is stored on the device, so it's instant and works offline. Use **You → Back up** now and then.

`supabase/migrations/0001_phase1.sql` holds the matching Postgres schema with row-level security. To turn on Google sign-in and sync you need a Supabase project and a Google OAuth client. Both are set up in their dashboards.

## Platform notes

- **Haptics:** Android only. iPhone browsers block web vibration, so on iOS the feedback comes from sound and motion.
- **Notifications:** reminders fire while Stride is open or in the background. On iPhone you must add it to the Home Screen first (iOS 16.4+). Reminders when the app is fully closed need a push server, which comes in Phase 2.
- **Reduce motion:** respected. Slides become fades.

## Structure

```
src/
  lib/       time (15-min grid), seed routine, scoring + streaks (pure, tested), voice, feedback
  store/     persisted app state (zustand) and UI state
  screens/   Home, Today, Streak, You, Focus, sheets
  components/ Check (tick + burst), DayBox, Ring, Sheet, Scale, Segmented, icons
supabase/    Phase 1 schema
```
