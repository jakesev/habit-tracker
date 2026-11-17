package com.jakesev.routine;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * The plan as the native side sees it: a compact copy the web app pushes on every change
 * (today and tomorrow), plus a queue of actions taken from notifications and the widget
 * that the web app applies when it next runs.
 */
public final class PlanStore {
    private static final String PREFS = "shugyo_plan";
    private static final String KEY_PLAN = "plan";
    private static final String KEY_ACTIONS = "actions";
    private static final String KEY_CODES = "scheduled";

    private PlanStore() {}

    public static final class Block {
        public String date;
        public String id;
        public String title;
        public int start;
        public int duration;
        public String status;
        public String category;
        public boolean fixed;
        public String challenge;
        public int lead;
        /** Every heads-up, minutes before the start. */
        public int[] leads;
        public boolean alarm;
        public boolean timer;
        /** Do it any time between start and until (no clock time). */
        public boolean anytime;
        public int until;

        public boolean isEvent() { return "event".equals(category); }
        public boolean isPlanned() { return "planned".equals(status); }
        public int end() { return start + duration; }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static synchronized void savePlan(Context ctx, String json) {
        prefs(ctx).edit().putString(KEY_PLAN, json).apply();
    }

    public static synchronized JSONObject plan(Context ctx) {
        try {
            return new JSONObject(prefs(ctx).getString(KEY_PLAN, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    public static boolean notify(JSONObject plan) { return plan.optBoolean("notify", false); }
    public static boolean upNext(JSONObject plan) { return plan.optBoolean("upNext", true); }
    public static int nudgeAt(JSONObject plan) { return plan.optInt("nudgeAt", 20 * 60 + 30); }

    public static int accent(JSONObject plan) {
        try {
            return android.graphics.Color.parseColor(plan.optString("accent", "#F0502E"));
        } catch (Exception e) {
            return 0xFFF0502E;
        }
    }

    /** All blocks for a date, in time order. */
    public static List<Block> blocks(JSONObject plan, String date) {
        List<Block> out = new ArrayList<>();
        JSONArray days = plan.optJSONArray("days");
        if (days == null) return out;
        for (int i = 0; i < days.length(); i++) {
            JSONObject d = days.optJSONObject(i);
            if (d == null || !date.equals(d.optString("date"))) continue;
            JSONArray bs = d.optJSONArray("blocks");
            if (bs == null) continue;
            for (int j = 0; j < bs.length(); j++) {
                JSONObject o = bs.optJSONObject(j);
                if (o == null) continue;
                Block b = new Block();
                b.date = date;
                b.id = o.optString("id");
                b.title = o.optString("title");
                b.start = o.optInt("start");
                b.duration = o.optInt("dur", 15);
                b.status = o.optString("status", "planned");
                b.category = o.optString("cat", "skill");
                b.fixed = o.optBoolean("fixed", false);
                b.challenge = o.isNull("challenge") ? null : o.optString("challenge", null);
                if (b.challenge != null && b.challenge.isEmpty()) b.challenge = null;
                b.lead = o.optInt("lead", 10);
                JSONArray ls = o.optJSONArray("leads");
                if (ls != null) {
                    b.leads = new int[ls.length()];
                    for (int k = 0; k < ls.length(); k++) b.leads[k] = ls.optInt(k);
                } else {
                    b.leads = new int[] { b.lead };
                }
                b.alarm = o.optBoolean("alarm", false);
                b.timer = o.optBoolean("timer", false);
                b.anytime = o.optBoolean("anytime", false);
                b.until = o.isNull("until") ? b.start + b.duration : o.optInt("until", b.start + b.duration);
                out.add(b);
            }
        }
        out.sort((a, c) -> Integer.compare(a.start, c.start));
        return out;
    }

    public static Block find(JSONObject plan, String date, String id) {
        for (Block b : blocks(plan, date)) if (b.id.equals(id)) return b;
        return null;
    }

    /** Mark a block done in the stored copy, so the widget and "Up next" move on right away. */
    public static synchronized void setStatus(Context ctx, String date, String id, String status) {
        try {
            JSONObject plan = plan(ctx);
            JSONArray days = plan.optJSONArray("days");
            if (days == null) return;
            for (int i = 0; i < days.length(); i++) {
                JSONObject d = days.getJSONObject(i);
                if (!date.equals(d.optString("date"))) continue;
                JSONArray bs = d.optJSONArray("blocks");
                if (bs == null) continue;
                for (int j = 0; j < bs.length(); j++) {
                    JSONObject o = bs.getJSONObject(j);
                    if (id.equals(o.optString("id"))) o.put("status", status);
                }
            }
            savePlan(ctx, plan.toString());
        } catch (Exception ignored) {
        }
    }

    public static synchronized void addAction(Context ctx, String type, String date, String id, int at) {
        try {
            JSONArray a = new JSONArray(prefs(ctx).getString(KEY_ACTIONS, "[]"));
            JSONObject o = new JSONObject();
            o.put("type", type);
            o.put("date", date);
            o.put("id", id);
            o.put("at", at);
            o.put("ts", System.currentTimeMillis());
            a.put(o);
            prefs(ctx).edit().putString(KEY_ACTIONS, a.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    /** Hand the queued actions to the web app and clear them. */
    public static synchronized String takeActions(Context ctx) {
        String a = prefs(ctx).getString(KEY_ACTIONS, "[]");
        prefs(ctx).edit().putString(KEY_ACTIONS, "[]").apply();
        return a;
    }

    public static synchronized List<Integer> scheduledCodes(Context ctx) {
        List<Integer> out = new ArrayList<>();
        try {
            JSONArray a = new JSONArray(prefs(ctx).getString(KEY_CODES, "[]"));
            for (int i = 0; i < a.length(); i++) out.add(a.getInt(i));
        } catch (Exception ignored) {
        }
        return out;
    }

    public static synchronized void saveScheduledCodes(Context ctx, List<Integer> codes) {
        JSONArray a = new JSONArray();
        for (int c : codes) a.put(c);
        prefs(ctx).edit().putString(KEY_CODES, a.toString()).apply();
    }

    /* ---------------------------------------------------------------- time helpers */

    public static String todayKey() { return key(Calendar.getInstance()); }

    public static String tomorrowKey() {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_YEAR, 1);
        return key(c);
    }

    private static String key(Calendar c) {
        return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    /** Epoch millis for minutes since local midnight of a "yyyy-MM-dd" date. */
    public static long at(String date, int minutes) {
        String[] p = date.split("-");
        Calendar c = Calendar.getInstance();
        c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]), 0, 0, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis() + minutes * 60_000L;
    }

    public static int nowMinutes() {
        Calendar c = Calendar.getInstance();
        return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
    }

    public static String fmt(int min) {
        int h = (min / 60) % 24;
        int m = min % 60;
        int h12 = h % 12 == 0 ? 12 : h % 12;
        return String.format(Locale.US, "%d:%02d%s", h12, m, h < 12 ? "am" : "pm");
    }
}
