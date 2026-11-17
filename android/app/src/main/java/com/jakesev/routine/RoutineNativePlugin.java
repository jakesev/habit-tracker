package com.jakesev.routine;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Small native helpers the web layer can't do itself:
 *  - switch the launcher icon + name between the identities (activity aliases)
 *  - keep the screen on while a focus timer runs
 */
@CapacitorPlugin(name = "RoutineNative")
public class RoutineNativePlugin extends Plugin {

    private static final String[] IDS = { "shugyo" };

    private ComponentName alias(String id) {
        String cap = id.substring(0, 1).toUpperCase() + id.substring(1);
        return new ComponentName(getContext().getPackageName(), "com.jakesev.routine.Launcher" + cap);
    }

    @PluginMethod
    public void setIdentity(PluginCall call) {
        String id = call.getString("id", "shugyo");
        boolean known = false;
        for (String s : IDS) if (s.equals(id)) known = true;
        if (!known) {
            call.reject("Unknown identity: " + id);
            return;
        }
        PackageManager pm = getContext().getPackageManager();
        // Enable the new one first so there's always a launcher entry.
        pm.setComponentEnabledSetting(alias(id), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
        for (String s : IDS) {
            if (!s.equals(id)) {
                pm.setComponentEnabledSetting(alias(s), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void getIdentity(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        String current = "shugyo";
        for (String s : IDS) {
            int state = pm.getComponentEnabledSetting(alias(s));
            boolean enabled = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && s.equals("shugyo"));
            if (enabled) {
                current = s;
                break;
            }
        }
        JSObject ret = new JSObject();
        ret.put("id", current);
        call.resolve(ret);
    }

    /** The web app pushes the plan (today + tomorrow) on every change. */
    @PluginMethod
    public void setPlan(PluginCall call) {
        String json = call.getString("json", "{}");
        PlanStore.savePlan(getContext(), json);
        PlanScheduler.ensureChannels(getContext());
        PlanScheduler.reschedule(getContext());
        PlanScheduler.clearFinished(getContext());
        PlanScheduler.refresh(getContext());
        call.resolve();
    }

    /** Done / snooze taps from notifications and the widget, for the web app to apply. */
    @PluginMethod
    public void takeActions(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("json", PlanStore.takeActions(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void test(PluginCall call) {
        PlanScheduler.postTest(getContext());
        call.resolve();
    }

    @PluginMethod
    public void snooze(PluginCall call) {
        String date = call.getString("date");
        String id = call.getString("id");
        int minutes = call.getInt("minutes", 10);
        if (date != null && id != null) {
            PlanScheduler.cancel(getContext(), PlanScheduler.alarmNotifId(date, id));
            PlanScheduler.cancel(getContext(), PlanScheduler.blockNotifId(date, id));
            PlanScheduler.snooze(getContext(), date, id, minutes);
        }
        call.resolve();
    }

    /** Clear a block's reminders and alarm from the shade (e.g. ticked in the app). */
    @PluginMethod
    public void clearBlock(PluginCall call) {
        String date = call.getString("date");
        String id = call.getString("id");
        if (date != null && id != null) {
            PlanScheduler.cancel(getContext(), PlanScheduler.alarmNotifId(date, id));
            PlanScheduler.cancel(getContext(), PlanScheduler.blockNotifId(date, id));
        }
        call.resolve();
    }

    @PluginMethod
    public void focusShow(PluginCall call) {
        PlanScheduler.showFocus(
            getContext(),
            call.getString("title", "Focus"),
            (long) call.getDouble("endsAt", 0.0).doubleValue(),
            Boolean.TRUE.equals(call.getBoolean("paused", false)),
            (long) call.getDouble("remainingMs", 0.0).doubleValue(),
            call.getString("accent", "#F0502E")
        );
        call.resolve();
    }

    @PluginMethod
    public void focusHide(PluginCall call) {
        PlanScheduler.hideFocus(getContext());
        call.resolve();
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }
}
