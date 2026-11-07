package com.placeholder.puzzleadaptativo;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Los plugins propios de la app se registran antes de iniciar el puente de Capacitor
        registerPlugin(GameHapticsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
