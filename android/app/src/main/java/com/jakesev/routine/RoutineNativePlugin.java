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
 *  - switch the launcher icon + name between the four identities (activity aliases)
 *  - keep the screen on while a focus timer runs
 */
@CapacitorPlugin(name = "RoutineNative")
public class RoutineNativePlugin extends Plugin {

    private static final String[] IDS = { "ember", "callus", "standard", "forge" };

    private ComponentName alias(String id) {
        String cap = id.substring(0, 1).toUpperCase() + id.substring(1);
        return new ComponentName(getContext().getPackageName(), "com.jakesev.routine.Launcher" + cap);
    }

    @PluginMethod
    public void setIdentity(PluginCall call) {
        String id = call.getString("id", "ember");
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
        String current = "ember";
        for (String s : IDS) {
            int state = pm.getComponentEnabledSetting(alias(s));
            boolean enabled = state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && s.equals("ember"));
            if (enabled) {
                current = s;
                break;
            }
        }
        JSObject ret = new JSObject();
        ret.put("id", current);
        call.resolve(ret);
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
