package com.jakesev.routine;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/** Fires scheduled reminders and handles Done / Snooze from notifications and the widget. */
public class PlanReceiver extends BroadcastReceiver {
    public static final String FIRE = "com.jakesev.routine.FIRE";
    public static final String DONE = "com.jakesev.routine.DONE";
    public static final String SNOOZE = "com.jakesev.routine.SNOOZE";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String act = intent.getAction();
        if (act == null) return;
        PlanScheduler.ensureChannels(ctx);

        if (Intent.ACTION_BOOT_COMPLETED.equals(act) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(act)
            || "android.intent.action.TIME_SET".equals(act) || "android.intent.action.TIMEZONE_CHANGED".equals(act)) {
            PlanScheduler.reschedule(ctx);
            PlanScheduler.refresh(ctx);
            return;
        }

        String date = intent.getStringExtra("date");
        String id = intent.getStringExtra("id");
        if (date == null || id == null) return;
        JSONObject plan = PlanStore.plan(ctx);

        switch (act) {
            case FIRE: {
                int kind = intent.getIntExtra("kind", 0);
                PlanStore.Block b = PlanStore.find(plan, date, id);
                switch (kind) {
                    case PlanScheduler.K_HEADS:
                        if (b != null && b.isPlanned()) PlanScheduler.postHeadsUp(ctx, plan, b, false);
                        break;
                    case PlanScheduler.K_START:
                        if (b != null && b.isPlanned()) PlanScheduler.postStart(ctx, plan, b);
                        break;
                    case PlanScheduler.K_SNOOZE:
                        if (b != null && b.isPlanned()) {
                            if (b.alarm) PlanScheduler.postAlarm(ctx, plan, b);
                            else PlanScheduler.postHeadsUp(ctx, plan, b, true);
                        }
                        break;
                    case PlanScheduler.K_ALARM:
                        if (b != null && b.isPlanned()) PlanScheduler.postAlarm(ctx, plan, b);
                        break;
                    case PlanScheduler.K_PLAN:
                        PlanScheduler.postPlan(ctx, plan, date);
                        break;
                    case PlanScheduler.K_NUDGE:
                        PlanScheduler.postNudge(ctx, plan, date);
                        break;
                    default:
                        break;
                }
                if ("midnight".equals(id)) PlanScheduler.reschedule(ctx);
                PlanScheduler.refresh(ctx);
                break;
            }
            case DONE: {
                // Recorded now; the app applies it (with the on-time / late rules) when it next runs.
                PlanStore.addAction(ctx, "done", date, id, PlanStore.nowMinutes());
                PlanStore.setStatus(ctx, date, id, "done");
                PlanScheduler.cancel(ctx, PlanScheduler.blockNotifId(date, id));
                PlanScheduler.cancel(ctx, PlanScheduler.alarmNotifId(date, id));
                PlanScheduler.reschedule(ctx);
                PlanScheduler.refresh(ctx);
                break;
            }
            case SNOOZE: {
                int minutes = intent.getIntExtra("minutes", 15);
                PlanScheduler.cancel(ctx, PlanScheduler.blockNotifId(date, id));
                PlanScheduler.cancel(ctx, PlanScheduler.alarmNotifId(date, id));
                PlanScheduler.snooze(ctx, date, id, minutes <= 0 ? 15 : minutes);
                break;
            }
            default:
                break;
        }
    }
}
