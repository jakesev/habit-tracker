package com.jakesev.routine;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RoutineNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
