package com.placeholder.puzzleadaptativo;

import android.content.Context;

import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Guarda el motivo del último cierre inesperado en un archivo para poder enseñarlo en Ajustes
 * (no hay forma cómoda de leer los registros de Android desde el teléfono sin un cable).
 */
final class CrashLog {
    static final String FILE_NAME = "last_crash.txt";

    private CrashLog() {}

    static void install(final Context context) {
        final Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                StringWriter text = new StringWriter();
                throwable.printStackTrace(new PrintWriter(text));
                String trace = text.toString();
                if (trace.length() > 3000) trace = trace.substring(0, 3000);
                try (FileOutputStream out = new FileOutputStream(new File(context.getFilesDir(), FILE_NAME))) {
                    out.write((thread.getName() + "\n" + trace).getBytes("UTF-8"));
                }
            } catch (Throwable ignored) {
                // si no se puede guardar, se sigue con el cierre normal
            }
            if (previous != null) previous.uncaughtException(thread, throwable);
        });
    }
}
