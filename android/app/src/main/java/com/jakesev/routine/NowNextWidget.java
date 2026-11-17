package com.jakesev.routine;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.res.ColorStateList;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Home-screen widget: what's now (with progress) or next, what follows, and a Done button. */
public class NowNextWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    public static void updateAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        if (mgr == null) return;
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, NowNextWidget.class));
        if (ids != null && ids.length > 0) render(ctx, mgr, ids);
    }

    private static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        JSONObject plan = PlanStore.plan(ctx);
        int accent = PlanStore.accent(plan);
        int now = PlanStore.nowMinutes();
        PlanStore.Block cur = PlanScheduler.current(plan);
        PlanStore.Block nxt = PlanScheduler.next(plan, cur != null ? cur.start : now);
        PlanStore.Block then = nxt != null ? PlanScheduler.next(plan, nxt.start) : null;

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_now_next);
        v.setOnClickPendingIntent(R.id.widget_root, PlanScheduler.open(ctx, "routine://today"));
        v.setTextColor(R.id.widget_label, accent);
        v.setTextColor(R.id.widget_done, accent);

        PlanStore.Block main = cur != null ? cur : nxt;
        if (main == null) {
            v.setTextViewText(R.id.widget_label, "TODAY");
            v.setTextViewText(R.id.widget_title, "All done. Rest.");
            v.setTextViewText(R.id.widget_time, "Tomorrow you go again.");
            v.setViewVisibility(R.id.widget_progress, View.GONE);
            v.setViewVisibility(R.id.widget_then, View.GONE);
            v.setViewVisibility(R.id.widget_done, View.GONE);
        } else {
            if (cur != null) {
                v.setTextViewText(R.id.widget_label, "NOW · until " + PlanStore.fmt(cur.end()));
                v.setViewVisibility(R.id.widget_progress, View.VISIBLE);
                v.setProgressBar(R.id.widget_progress, cur.duration, Math.max(0, Math.min(cur.duration, now - cur.start)), false);
                if (Build.VERSION.SDK_INT >= 31) v.setColorStateList(R.id.widget_progress, "setProgressTintList", ColorStateList.valueOf(accent));
            } else {
                int mins = main.start - now;
                String in = mins >= 60 ? (mins / 60) + "h " + (mins % 60) + "m" : mins + " min";
                v.setTextViewText(R.id.widget_label, "NEXT · in " + in);
                v.setViewVisibility(R.id.widget_progress, View.GONE);
            }
            v.setTextViewText(R.id.widget_title, main.title + (main.challenge != null ? " · " + main.challenge.toLowerCase() : ""));
            v.setTextViewText(R.id.widget_time, PlanStore.fmt(main.start) + " – " + PlanStore.fmt(main.end()));
            PlanStore.Block after = cur != null ? nxt : then;
            if (after != null) {
                v.setViewVisibility(R.id.widget_then, View.VISIBLE);
                v.setTextViewText(R.id.widget_then, "Then " + after.title + " · " + PlanStore.fmt(after.start));
            } else {
                v.setViewVisibility(R.id.widget_then, View.GONE);
            }
            if (main.isEvent()) {
                v.setViewVisibility(R.id.widget_done, View.GONE);
            } else {
                v.setViewVisibility(R.id.widget_done, View.VISIBLE);
                v.setOnClickPendingIntent(R.id.widget_done, PlanScheduler.action(ctx, PlanReceiver.DONE, main.date, main.id, 0));
            }
        }
        mgr.updateAppWidget(ids, v);
    }
}
