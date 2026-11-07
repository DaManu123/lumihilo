package com.placeholder.puzzleadaptativo;

import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.view.HapticFeedbackConstants;
import android.view.View;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

/**
 * Vibración del juego.
 *
 * El plugin genérico de Capacitor pide la vibración de la forma más básica y Android (sobre todo la
 * capa de Xiaomi, HyperOS) puede descartarla según su tipo y los ajustes del teléfono. Este plugin
 * prueba varias vías a la vez para que al menos una llegue al motor:
 *
 *  - "system": la respuesta táctil del sistema (la que usan los botones de cualquier app).
 *  - "motor":  el motor de vibración directamente, sin tipo de uso.
 *  - "touch":  el motor, marcando la vibración como respuesta a un toque.
 *  - "all":    todas las anteriores (por defecto).
 *
 * También ofrece un diagnóstico con los ajustes del teléfono que pueden bloquear la vibración.
 */
@CapacitorPlugin(name = "GameHaptics")
public class GameHapticsPlugin extends Plugin {

    private Vibrator vibrator() {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private static long[] readPattern(JSArray array) {
        if (array == null || array.length() == 0) return null;
        try {
            // Android espera [espera, pulso, pausa, pulso, ...]: se antepone una espera de 0
            long[] timings = new long[array.length() + 1];
            timings[0] = 0;
            for (int i = 0; i < array.length(); i++) {
                timings[i + 1] = clamp(array.getInt(i), 1, 600);
            }
            return timings;
        } catch (JSONException e) {
            return null;
        }
    }

    @PluginMethod
    public void trigger(PluginCall call) {
        final String kind = call.getString("kind", "tap");
        final String mode = call.getString("mode", "all");
        final int duration = clamp(call.getInt("duration", 30), 5, 400);
        final int amplitude = clamp(call.getInt("amplitude", 255), 1, 255);
        final long[] pattern = readPattern(call.getArray("pattern"));

        final boolean all = "all".equals(mode);
        final StringBuilder performed = new StringBuilder();
        final StringBuilder errors = new StringBuilder();

        Vibrator vibrator = vibrator();
        boolean hasMotor = vibrator != null && vibrator.hasVibrator();

        if (hasMotor && (all || "motor".equals(mode))) {
            String error = motor(vibrator, false, duration, amplitude, pattern);
            if (error == null) performed.append("motor ");
            else errors.append("motor: ").append(error).append("; ");
        }
        if (hasMotor && (all || "touch".equals(mode))) {
            String error = motor(vibrator, true, duration, amplitude, pattern);
            if (error == null) performed.append("touch ");
            else errors.append("touch: ").append(error).append("; ");
        }
        // La respuesta táctil del sistema es un toque corto: en la victoria (patrón largo) no se usa
        // con "all" para no interrumpir el patrón que acaba de empezar.
        boolean useSystem = "system".equals(mode) || (all && pattern == null);
        if (useSystem) {
            String error = system(kind);
            if (error == null) performed.append("system ");
            else errors.append("system: ").append(error).append("; ");
        }

        JSObject result = new JSObject();
        result.put("hasMotor", hasMotor);
        result.put("performed", performed.toString().trim());
        result.put("errors", errors.toString().trim());
        call.resolve(result);
    }

    /** Vibra con el motor. Devuelve null si todo fue bien o el texto del error. */
    @SuppressWarnings("deprecation")
    private String motor(Vibrator vibrator, boolean asTouch, int duration, int amplitude, long[] pattern) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                VibrationEffect effect;
                if (pattern != null) {
                    effect = VibrationEffect.createWaveform(pattern, -1);
                } else if (vibrator.hasAmplitudeControl()) {
                    effect = VibrationEffect.createOneShot(duration, amplitude);
                } else {
                    effect = VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE);
                }
                if (asTouch) {
                    AudioAttributes attributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                    vibrator.vibrate(effect, attributes);
                } else {
                    vibrator.vibrate(effect);
                }
            } else if (pattern != null) {
                vibrator.vibrate(pattern, -1);
            } else {
                vibrator.vibrate(duration);
            }
            return null;
        } catch (Exception e) {
            return e.getClass().getSimpleName() + ": " + e.getMessage();
        }
    }

    /** Respuesta táctil del sistema sobre la vista web. Devuelve null si todo fue bien o el texto del error. */
    private String system(String kind) {
        try {
            final View view = getBridge().getWebView();
            final int constant = hapticConstant(kind);
            // La vista solo se puede tocar desde el hilo de la interfaz
            getActivity().runOnUiThread(() -> view.performHapticFeedback(constant));
            return null;
        } catch (Exception e) {
            return e.getClass().getSimpleName() + ": " + e.getMessage();
        }
    }

    private static int hapticConstant(String kind) {
        if ("win".equals(kind)) {
            return Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? HapticFeedbackConstants.CONFIRM
                : HapticFeedbackConstants.LONG_PRESS;
        }
        if ("connect".equals(kind)) return HapticFeedbackConstants.LONG_PRESS;
        return HapticFeedbackConstants.VIRTUAL_KEY;
    }

    /** Ajustes del teléfono que pueden impedir que la app vibre (solo lectura). */
    @PluginMethod
    public void diagnose(PluginCall call) {
        Context context = getContext();
        ContentResolver resolver = context.getContentResolver();
        Vibrator vibrator = vibrator();

        JSObject result = new JSObject();
        result.put("sdk", Build.VERSION.SDK_INT);
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("model", Build.MODEL);
        result.put("hasMotor", vibrator != null && vibrator.hasVibrator());
        result.put(
            "hasAmplitudeControl",
            vibrator != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && vibrator.hasAmplitudeControl()
        );

        // 0 = desactivada, 1 = baja, 2 = media, 3 = alta, -1 = el teléfono no la expone
        result.put("hapticFeedbackEnabled", Settings.System.getInt(resolver, Settings.System.HAPTIC_FEEDBACK_ENABLED, -1));
        result.put("touchIntensity", Settings.System.getInt(resolver, "haptic_feedback_intensity", -1));
        result.put("mediaIntensity", Settings.System.getInt(resolver, "media_vibration_intensity", -1));
        result.put("notificationIntensity", Settings.System.getInt(resolver, "notification_vibration_intensity", -1));
        result.put("ringIntensity", Settings.System.getInt(resolver, "ring_vibration_intensity", -1));

        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        result.put("ringerMode", audio == null ? -1 : audio.getRingerMode()); // 0 silencio, 1 vibrar, 2 normal

        NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        // 1 todo permitido, 2 solo prioritarias, 3 nada, 4 solo alarmas
        result.put("interruptionFilter", notifications == null ? -1 : notifications.getCurrentInterruptionFilter());

        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        result.put("powerSave", power != null && power.isPowerSaveMode());

        call.resolve(result);
    }
}
