package com.damanu.lumihilo;

import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.net.Uri;
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

import java.io.File;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;

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
 *  - "alarm":  el motor, marcado como alarma (casi nunca bloqueado; en el POCO F6 es la única que llega).
 *  - "all":    todas las anteriores a la vez (por defecto). Android descarta las que el teléfono bloquea y
 *              se queda con la que sí puede sonar, así que el jugador no tiene que elegir nada.
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
        // Capacitor convierte cualquier excepción no capturada en un cierre de la app: aquí nunca debe escapar ninguna
        try {
            doTrigger(call);
        } catch (Throwable t) {
            call.reject("trigger: " + describe(t));
        }
    }

    private static String describe(Throwable t) {
        return t.getClass().getSimpleName() + ": " + t.getMessage();
    }

    private void doTrigger(PluginCall call) {
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
        if (hasMotor && (all || "alarm".equals(mode))) {
            String error = motorWithUsage(vibrator, AudioAttributes.USAGE_ALARM, duration, amplitude, pattern);
            if (error == null) performed.append("alarm ");
            else errors.append("alarm: ").append(error).append("; ");
        }
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

    private String motorWithUsage(Vibrator vibrator, int usage, int duration, int amplitude, long[] pattern) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return motor(vibrator, false, duration, amplitude, pattern);
            VibrationEffect effect = pattern != null
                ? VibrationEffect.createWaveform(pattern, -1)
                : VibrationEffect.createOneShot(duration, vibrator.hasAmplitudeControl() ? amplitude : VibrationEffect.DEFAULT_AMPLITUDE);
            AudioAttributes attributes = new AudioAttributes.Builder().setUsage(usage).build();
            vibrator.vibrate(effect, attributes);
            return null;
        } catch (Throwable e) {
            return describe(e);
        }
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
        } catch (Throwable e) {
            return describe(e);
        }
    }

    /** Respuesta táctil del sistema sobre la vista web. Devuelve null si todo fue bien o el texto del error. */
    private String system(String kind) {
        try {
            final View view = getBridge().getWebView();
            final int constant = hapticConstant(kind);
            // La vista solo se puede tocar desde el hilo de la interfaz
            getActivity().runOnUiThread(() -> {
                try {
                    view.performHapticFeedback(constant);
                } catch (Throwable ignored) {
                    // en el hilo de la interfaz una excepción cerraría la app
                }
            });
            return null;
        } catch (Throwable e) {
            return describe(e);
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

    private static int readSetting(ContentResolver resolver, String name) {
        try {
            return Settings.System.getInt(resolver, name, -1);
        } catch (Throwable t) {
            return -1;
        }
    }

    private static void put(JSObject result, String key, Object value) {
        try {
            result.put(key, value);
        } catch (Throwable ignored) {
            // un dato que no se pueda leer no debe impedir mostrar el resto
        }
    }

    /** Ajustes del teléfono que pueden impedir que la app vibre (solo lectura). Nunca lanza excepciones. */
    @PluginMethod
    public void diagnose(PluginCall call) {
        JSObject result = new JSObject();
        StringBuilder problems = new StringBuilder();
        Context context = getContext();
        ContentResolver resolver = null;
        Vibrator vibrator = null;
        try {
            resolver = context.getContentResolver();
            vibrator = vibrator();
        } catch (Throwable t) {
            problems.append("contexto: ").append(describe(t)).append("; ");
        }

        put(result, "sdk", Build.VERSION.SDK_INT);
        put(result, "manufacturer", String.valueOf(Build.MANUFACTURER));
        put(result, "model", String.valueOf(Build.MODEL));

        boolean hasMotor = false;
        boolean hasAmplitude = false;
        try {
            hasMotor = vibrator != null && vibrator.hasVibrator();
            hasAmplitude = vibrator != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && vibrator.hasAmplitudeControl();
        } catch (Throwable t) {
            problems.append("motor: ").append(describe(t)).append("; ");
        }
        put(result, "hasMotor", hasMotor);
        put(result, "hasAmplitudeControl", hasAmplitude);

        // 0 = desactivada, 1 = baja, 2 = media, 3 = alta, -1 = el teléfono no la expone
        put(result, "hapticFeedbackEnabled", resolver == null ? -1 : readSetting(resolver, Settings.System.HAPTIC_FEEDBACK_ENABLED));
        put(result, "touchIntensity", resolver == null ? -1 : readSetting(resolver, "haptic_feedback_intensity"));
        put(result, "mediaIntensity", resolver == null ? -1 : readSetting(resolver, "media_vibration_intensity"));
        put(result, "notificationIntensity", resolver == null ? -1 : readSetting(resolver, "notification_vibration_intensity"));
        put(result, "ringIntensity", resolver == null ? -1 : readSetting(resolver, "ring_vibration_intensity"));

        int ringer = -1; // 0 silencio, 1 vibrar, 2 normal
        try {
            AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audio != null) ringer = audio.getRingerMode();
        } catch (Throwable t) {
            problems.append("sonido: ").append(describe(t)).append("; ");
        }
        put(result, "ringerMode", ringer);

        int filter = -1; // 1 todo permitido, 2 solo prioritarias, 3 nada, 4 solo alarmas
        try {
            NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notifications != null) filter = notifications.getCurrentInterruptionFilter();
        } catch (Throwable t) {
            problems.append("no molestar: ").append(describe(t)).append("; ");
        }
        put(result, "interruptionFilter", filter);

        boolean powerSave = false;
        try {
            PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            powerSave = power != null && power.isPowerSaveMode();
        } catch (Throwable t) {
            problems.append("batería: ").append(describe(t)).append("; ");
        }
        put(result, "powerSave", powerSave);
        put(result, "problems", problems.toString().trim());

        call.resolve(result);
    }

    /** Texto del último cierre inesperado de la app (si lo hubo); se borra al leerlo. */
    @PluginMethod
    public void lastCrash(PluginCall call) {
        JSObject result = new JSObject();
        String text = "";
        try {
            File file = new File(getContext().getFilesDir(), CrashLog.FILE_NAME);
            if (file.exists()) {
                try (FileInputStream in = new FileInputStream(file); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[4096];
                    int read;
                    while ((read = in.read(buffer)) > 0 && out.size() < 6000) out.write(buffer, 0, read);
                    text = out.toString("UTF-8");
                }
                //noinspection ResultOfMethodCallIgnored
                file.delete();
            }
        } catch (Throwable ignored) {
            // sin registro, sin problema
        }
        put(result, "text", text);
        call.resolve(result);
    }

    /**
     * Abre en el navegador la página de descargas de una versión nueva. Solo acepta enlaces del repositorio del
     * juego, para que el plugin no sirva de puerta a otras direcciones.
     */
    @PluginMethod
    public void openUrl(PluginCall call) {
        try {
            String url = call.getString("url");
            if (url == null || !url.startsWith("https://github.com/DaManu123/lumihilo/")) {
                call.reject("Dirección no permitida");
                return;
            }
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Throwable t) {
            call.reject("No se pudo abrir el navegador");
        }
    }
}
