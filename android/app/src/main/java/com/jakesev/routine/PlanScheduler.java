package com.jakesev.routine;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Schedules everything time-based from the stored plan, and builds the notifications:
 *  - the day's plan, an hour before the first block
 *  - a heads-up before each block, and "Now: …" when it starts (Done / Snooze / Start focus buttons)
 *  - alarm mode for non-negotiables: rings until dismissed
 *  - the 8:30pm nudge
 *  - "Up next", one quiet notification that stays in the shade
 *  - widget refreshes at every block boundary
 */
public final class PlanScheduler {
    private PlanScheduler() {}

    public static final int K_HEADS = 1, K_START = 2, K_PLAN = 3, K_NUDGE = 4, K_ALARM = 5, K_TICK = 6, K_SNOOZE = 7;

    static final String CH_BLOCKS = "shugyo_blocks";
    static final String CH_PLAN = "shugyo_plan";
    static final String CH_UPNEXT = "shugyo_upnext";
    static final String CH_ALARM = "shugyo_alarm";

    static final int UPNEXT_ID = 4242;
    static final int TEST_ID = 4243;
    static final int FOCUS_ID = 4244;
    static final String CH_FOCUS = "shugyo_focus";

    /* ---------------------------------------------------------------- ids */

    private static int hash(String s) {
        int h = 7;
        for (int i = 0; i < s.length(); i++) h = h * 31 + s.charAt(i);
        return h & 0x00FFFFFF;
    }

    /** Request code / notification id: unique per date + block + kind. */
    static int code(String date, String key, int kind) {
        return (hash(date + "|" + key) << 3) | kind;
    }

    /** One notification slot per block: the heads-up is replaced by "Now", then by snoozes. */
    static int blockNotifId(String date, String id) {
        return code(date, id, 0);
    }

    static int alarmNotifId(String date, String id) {
        return code(date, id, K_ALARM);
    }

    /* ---------------------------------------------------------------- channels */

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel blocks = new NotificationChannel(CH_BLOCKS, "Block reminders", NotificationManager.IMPORTANCE_HIGH);
        blocks.setDescription("A heads-up before each block, and when it starts");
        blocks.enableVibration(true);
        blocks.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(blocks);

        NotificationChannel plan = new NotificationChannel(CH_PLAN, "Today's plan", NotificationManager.IMPORTANCE_DEFAULT);
        plan.setDescription("What's coming up, before your first block");
        plan.setSound(null, null);
        nm.createNotificationChannel(plan);

        NotificationChannel up = new NotificationChannel(CH_UPNEXT, "Up next", NotificationManager.IMPORTANCE_LOW);
        up.setDescription("Always shows what's now and what's next");
        up.setShowBadge(false);
        up.setSound(null, null);
        nm.createNotificationChannel(up);

        NotificationChannel focus = new NotificationChannel(CH_FOCUS, "Focus timer", NotificationManager.IMPORTANCE_LOW);
        focus.setDescription("The countdown while a focus timer runs");
        focus.setShowBadge(false);
        focus.setSound(null, null);
        nm.createNotificationChannel(focus);

        NotificationChannel alarm = new NotificationChannel(CH_ALARM, "Alarms", NotificationManager.IMPORTANCE_HIGH);
        alarm.setDescription("Non-negotiable blocks. Rings until you dismiss it.");
        alarm.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
            new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        alarm.enableVibration(true);
        alarm.setVibrationPattern(new long[] { 0, 600, 400, 600, 400, 600 });
        alarm.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        alarm.setBypassDnd(true);
        nm.createNotificationChannel(alarm);
    }

    /* ---------------------------------------------------------------- intents */

    static PendingIntent open(Context ctx, String url) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, url.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent action(Context ctx, String act, String date, String id, int minutes) {
        Intent i = new Intent(ctx, PlanReceiver.class);
        i.setAction(act);
        i.putExtra("date", date);
        i.putExtra("id", id);
        i.putExtra("minutes", minutes);
        int req = (act + date + id).hashCode();
        return PendingIntent.getBroadcast(ctx, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent fireIntent(Context ctx, int code, int kind, String date, String id, int flags) {
        Intent i = new Intent(ctx, PlanReceiver.class);
        i.setAction(PlanReceiver.FIRE);
        i.putExtra("kind", kind);
        i.putExtra("date", date);
        i.putExtra("id", id);
        return PendingIntent.getBroadcast(ctx, code, i, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    /* ---------------------------------------------------------------- scheduling */

    private static final class Trigger {
        int code; long at; int kind; String date; String id;
        Trigger(int code, long at, int kind, String date, String id) { this.code = code; this.at = at; this.kind = kind; this.date = date; this.id = id; }
    }

    /** Cancel what was scheduled before and schedule from the plan as it stands now. */
    public static synchronized void reschedule(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int c : PlanStore.scheduledCodes(ctx)) {
            PendingIntent old = fireIntent(ctx, c, 0, "", "", PendingIntent.FLAG_NO_CREATE);
            if (old != null) {
                am.cancel(old);
                old.cancel();
            }
        }

        JSONObject plan = PlanStore.plan(ctx);
        boolean notify = PlanStore.notify(plan);
        long now = System.currentTimeMillis();
        List<Trigger> list = new ArrayList<>();

        for (String date : new String[] { PlanStore.todayKey(), PlanStore.tomorrowKey() }) {
            List<PlanStore.Block> live = new ArrayList<>();
            for (PlanStore.Block b : PlanStore.blocks(plan, date)) if (b.isPlanned()) live.add(b);

            for (PlanStore.Block b : live) {
                // Widget and "Up next" move on at every block boundary, notifications or not.
                list.add(new Trigger(code(date, b.id + ":s", K_TICK), PlanStore.at(date, b.start), K_TICK, date, b.id));
                list.add(new Trigger(code(date, b.id + ":e", K_TICK), PlanStore.at(date, b.end()), K_TICK, date, b.id));
                if (!notify) continue;
                list.add(new Trigger(code(date, b.id, K_HEADS), PlanStore.at(date, b.start - b.lead), K_HEADS, date, b.id));
                list.add(new Trigger(code(date, b.id, b.alarm ? K_ALARM : K_START), PlanStore.at(date, b.start), b.alarm ? K_ALARM : K_START, date, b.id));
            }
            if (notify && !live.isEmpty()) {
                PlanStore.Block first = live.get(0);
                list.add(new Trigger(code(date, "plan", K_PLAN), PlanStore.at(date, Math.max(first.start - 60, 6 * 60)), K_PLAN, date, "plan"));
                list.add(new Trigger(code(date, "nudge", K_NUDGE), PlanStore.at(date, PlanStore.nudgeAt(plan)), K_NUDGE, date, "nudge"));
            }
        }
        // Just after midnight, tomorrow becomes today.
        String tomorrow = PlanStore.tomorrowKey();
        list.add(new Trigger(code(tomorrow, "midnight", K_TICK), PlanStore.at(tomorrow, 1), K_TICK, tomorrow, "midnight"));

        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        List<Integer> codes = new ArrayList<>();
        for (Trigger t : list) {
            if (t.at <= now) continue;
            PendingIntent pi = fireIntent(ctx, t.code, t.kind, t.date, t.id, PendingIntent.FLAG_UPDATE_CURRENT);
            try {
                if (t.kind == K_ALARM && exact) {
                    am.setAlarmClock(new AlarmManager.AlarmClockInfo(t.at, open(ctx, "routine://today")), pi);
                } else if (exact) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t.at, pi);
                } else {
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t.at, pi);
                }
                codes.add(t.code);
            } catch (SecurityException e) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t.at, pi);
                codes.add(t.code);
            }
        }
        PlanStore.saveScheduledCodes(ctx, codes);
    }

    /** Remind again in a few minutes. */
    public static void snooze(Context ctx, String date, String id, int minutes) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        int c = code(date, id, K_SNOOZE);
        PendingIntent pi = fireIntent(ctx, c, K_SNOOZE, date, id, PendingIntent.FLAG_UPDATE_CURRENT);
        long at = System.currentTimeMillis() + minutes * 60_000L;
        boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        try {
            if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    /* ---------------------------------------------------------------- notifications */

    private static boolean canPost(Context ctx) {
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled();
    }

    private static void post(Context ctx, int id, Notification n) {
        if (!canPost(ctx)) return;
        try {
            NotificationManagerCompat.from(ctx).notify(id, n);
        } catch (SecurityException ignored) {
        }
    }

    static void cancel(Context ctx, int id) {
        NotificationManagerCompat.from(ctx).cancel(id);
    }

    private static NotificationCompat.Builder base(Context ctx, String channel, JSONObject plan) {
        return new NotificationCompat.Builder(ctx, channel)
            .setSmallIcon(R.drawable.ic_stat_icon)
            .setColor(PlanStore.accent(plan))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(open(ctx, "routine://today"));
    }

    private static void addBlockActions(Context ctx, NotificationCompat.Builder nb, PlanStore.Block b, int snoozeMin) {
        if (b.isEvent()) return;
        nb.addAction(0, b.challenge != null ? "Done · " + b.challenge.toLowerCase() : "Done", action(ctx, PlanReceiver.DONE, b.date, b.id, 0));
        nb.addAction(0, "Snooze " + snoozeMin, action(ctx, PlanReceiver.SNOOZE, b.date, b.id, snoozeMin));
        if (b.timer) nb.addAction(0, "Start focus", open(ctx, "routine://focus?date=" + b.date + "&id=" + Uri.encode(b.id)));
    }

    private static PlanStore.Block nextAfter(JSONObject plan, PlanStore.Block b) {
        for (PlanStore.Block x : PlanStore.blocks(plan, b.date)) if (x.isPlanned() && x.start > b.start && !x.id.equals(b.id)) return x;
        return null;
    }

    static void postHeadsUp(Context ctx, JSONObject plan, PlanStore.Block b, boolean snoozed) {
        String when = PlanStore.fmt(b.start) + "–" + PlanStore.fmt(b.end());
        String push = b.isEvent() ? "Get ready to go." : b.fixed ? "Non-negotiable. Get up." : "You said you'd do it. Prove it.";
        String title = snoozed ? b.title + " · snoozed, it's time" : b.title + " in " + b.lead + " min";
        NotificationCompat.Builder nb = base(ctx, CH_BLOCKS, plan)
            .setContentTitle(title)
            .setContentText(when + ". " + push)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(when + ". " + push))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true);
        addBlockActions(ctx, nb, b, 15);
        post(ctx, blockNotifId(b.date, b.id), nb.build());
    }

    static void postStart(Context ctx, JSONObject plan, PlanStore.Block b) {
        PlanStore.Block next = nextAfter(plan, b);
        String title = b.isEvent() ? b.title + " · now" : "Now: " + b.title + (b.challenge != null ? " (" + b.challenge.toLowerCase() + ")" : "");
        String text = "Until " + PlanStore.fmt(b.end()) + "." + (next != null ? " Next: " + next.title + " at " + PlanStore.fmt(next.start) + "." : "");
        NotificationCompat.Builder nb = base(ctx, CH_BLOCKS, plan)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true);
        addBlockActions(ctx, nb, b, 15);
        post(ctx, blockNotifId(b.date, b.id), nb.build());
    }

    static void postAlarm(Context ctx, JSONObject plan, PlanStore.Block b) {
        cancel(ctx, blockNotifId(b.date, b.id));
        String url = "routine://alarm?date=" + b.date + "&id=" + Uri.encode(b.id);
        NotificationCompat.Builder nb = base(ctx, CH_ALARM, plan)
            .setContentTitle(b.title)
            .setContentText("Now. " + PlanStore.fmt(b.start) + "–" + PlanStore.fmt(b.end()) + ". Non-negotiable.")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM), android.media.AudioManager.STREAM_ALARM)
            .setVibrate(new long[] { 0, 600, 400, 600, 400, 600 })
            .setFullScreenIntent(open(ctx, url), true)
            .setContentIntent(open(ctx, url));
        addBlockActions(ctx, nb, b, 10);
        Notification n = nb.build();
        n.flags |= Notification.FLAG_INSISTENT; // keeps ringing until you act
        post(ctx, alarmNotifId(b.date, b.id), n);
    }

    static void postPlan(Context ctx, JSONObject plan, String date) {
        List<PlanStore.Block> live = new ArrayList<>();
        for (PlanStore.Block b : PlanStore.blocks(plan, date)) if (b.isPlanned()) live.add(b);
        if (live.isEmpty()) return;
        PlanStore.Block first = live.get(0);
        StringBuilder sb = new StringBuilder();
        for (PlanStore.Block b : live) {
            if (sb.length() > 0) sb.append('\n');
            sb.append(PlanStore.fmt(b.start)).append("  ").append(b.title);
            if (b.alarm) sb.append("  ⏰");
        }
        String title = "Today: " + live.size() + (live.size() == 1 ? " block" : " blocks") + ", first " + first.title + " at " + PlanStore.fmt(first.start);
        NotificationCompat.Builder nb = base(ctx, CH_PLAN, plan)
            .setContentTitle(title)
            .setContentText("Expand to see the plan.")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(sb.toString()).setBigContentTitle(title))
            .setAutoCancel(true);
        post(ctx, code(date, "plan", K_PLAN), nb.build());
    }

    static void postNudge(Context ctx, JSONObject plan, String date) {
        int open = 0;
        int nudgeAt = PlanStore.nudgeAt(plan);
        for (PlanStore.Block b : PlanStore.blocks(plan, date)) if (b.isPlanned() && !b.isEvent() && b.start >= nudgeAt) open++;
        if (open == 0) return;
        NotificationCompat.Builder nb = base(ctx, CH_BLOCKS, plan)
            .setContentTitle(open + (open == 1 ? " block" : " blocks") + " still open")
            .setContentText("There's still time. Finish the day on your terms.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true);
        post(ctx, code(date, "nudge", K_NUDGE), nb.build());
    }

    public static void postTest(Context ctx) {
        ensureChannels(ctx);
        JSONObject plan = PlanStore.plan(ctx);
        NotificationCompat.Builder nb = base(ctx, CH_BLOCKS, plan)
            .setContentTitle("Writing in 10 min")
            .setContentText("6:15–6:45pm. You said you'd do it. Prove it.")
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .addAction(0, "Done", open(ctx, "routine://today"))
            .addAction(0, "Snooze 15", open(ctx, "routine://today"));
        post(ctx, TEST_ID, nb.build());
    }

    /** The running focus timer, as a live countdown in the shade. Tap to go back to it. */
    public static void showFocus(Context ctx, String title, long endsAt, boolean paused, long remainingMs, String accentHex) {
        ensureChannels(ctx);
        int accent;
        try {
            accent = android.graphics.Color.parseColor(accentHex);
        } catch (Exception e) {
            accent = 0xFFF0502E;
        }
        NotificationCompat.Builder nb = new NotificationCompat.Builder(ctx, CH_FOCUS)
            .setSmallIcon(R.drawable.ic_stat_icon)
            .setColor(accent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(open(ctx, "routine://focus-open"))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setPriority(NotificationCompat.PRIORITY_LOW);
        if (paused) {
            long s = Math.max(0, remainingMs / 1000);
            nb.setContentTitle("Paused · " + title)
                .setContentText(String.format(java.util.Locale.US, "%d:%02d left. Tap to resume.", s / 60, s % 60))
                .setShowWhen(false);
        } else {
            nb.setContentTitle("Focus · " + title)
                .setContentText("Stay in it. Tap to open the timer.")
                .setWhen(endsAt)
                .setShowWhen(true)
                .setUsesChronometer(true)
                .setChronometerCountDown(true);
        }
        post(ctx, FOCUS_ID, nb.build());
    }

    public static void hideFocus(Context ctx) {
        cancel(ctx, FOCUS_ID);
    }

    /* ---------------------------------------------------------------- now / next */

    /** The block happening now, or null. */
    static PlanStore.Block current(JSONObject plan) {
        int now = PlanStore.nowMinutes();
        for (PlanStore.Block b : PlanStore.blocks(plan, PlanStore.todayKey())) if (b.isPlanned() && b.start <= now && now < b.end()) return b;
        return null;
    }

    /** The next planned block today after `after` minutes, or null. */
    static PlanStore.Block next(JSONObject plan, int after) {
        for (PlanStore.Block b : PlanStore.blocks(plan, PlanStore.todayKey())) if (b.isPlanned() && b.start > after) return b;
        return null;
    }

    static int remainingToday(JSONObject plan) {
        int n = 0;
        int now = PlanStore.nowMinutes();
        for (PlanStore.Block b : PlanStore.blocks(plan, PlanStore.todayKey())) if (b.isPlanned() && !b.isEvent() && b.end() > now) n++;
        return n;
    }

    /** "Up next": one quiet notification that always shows now and next. */
    static void refreshUpNext(Context ctx) {
        JSONObject plan = PlanStore.plan(ctx);
        if (!PlanStore.notify(plan) || !PlanStore.upNext(plan)) {
            cancel(ctx, UPNEXT_ID);
            return;
        }
        int now = PlanStore.nowMinutes();
        PlanStore.Block cur = current(plan);
        PlanStore.Block nxt = next(plan, cur != null ? cur.start : now);
        if (cur == null && nxt == null) {
            cancel(ctx, UPNEXT_ID);
            return;
        }
        NotificationCompat.Builder nb = base(ctx, CH_UPNEXT, plan)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_STATUS);
        if (cur != null) {
            nb.setContentTitle("Now: " + cur.title + " · until " + PlanStore.fmt(cur.end()));
            nb.setContentText(nxt != null ? "Next: " + nxt.title + " at " + PlanStore.fmt(nxt.start) : "Last one today. Finish strong.");
            nb.setProgress(cur.duration, Math.max(0, Math.min(cur.duration, now - cur.start)), false);
            if (!cur.isEvent()) nb.addAction(0, "Done", action(ctx, PlanReceiver.DONE, cur.date, cur.id, 0));
        } else {
            int mins = nxt.start - now;
            String in = mins >= 60 ? (mins / 60) + "h " + (mins % 60) + "m" : mins + " min";
            nb.setContentTitle("Next: " + nxt.title + " at " + PlanStore.fmt(nxt.start));
            nb.setContentText("In " + in + " · " + remainingToday(plan) + " left today");
        }
        post(ctx, UPNEXT_ID, nb.build());
    }

    /** Take reminders for finished blocks out of the shade. */
    public static void clearFinished(Context ctx) {
        JSONObject plan = PlanStore.plan(ctx);
        for (String date : new String[] { PlanStore.todayKey(), PlanStore.tomorrowKey() }) {
            for (PlanStore.Block b : PlanStore.blocks(plan, date)) {
                if (b.isPlanned()) continue;
                cancel(ctx, blockNotifId(date, b.id));
                cancel(ctx, alarmNotifId(date, b.id));
            }
        }
    }

    /** Bring the widget and "Up next" in line with the plan. */
    public static void refresh(Context ctx) {
        ensureChannels(ctx);
        refreshUpNext(ctx);
        NowNextWidget.updateAll(ctx);
    }
}
