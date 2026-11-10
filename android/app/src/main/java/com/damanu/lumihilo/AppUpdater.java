package com.damanu.lumihilo;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Actualización dentro de la app (solo en el APK que se descarga de GitHub).
 *
 * Descarga el APK de la versión nueva desde la Release oficial del juego en GitHub, comprueba que es el de esta app y
 * de la versión esperada, y abre el instalador de Android (el jugador siempre tiene que confirmar). Android además
 * rechaza cualquier APK que no esté firmado con la misma clave que la app instalada.
 *
 * La versión de Google Play NO declara el permiso REQUEST_INSTALL_PACKAGES (el flujo de publicación lo comprueba), así que
 * `isSupported` es falso y nada de esto se usa: ahí actualiza la tienda.
 */
final class AppUpdater {
    private AppUpdater() {}

    /** Solo se descarga de las Releases del repositorio del juego. */
    static final String DOWNLOAD_PREFIX = "https://github.com/DaManu123/lumihilo/releases/download/";
    private static final String PERMISSION = "android.permission.REQUEST_INSTALL_PACKAGES";
    private static final long MIN_APK_BYTES = 1024 * 1024;

    interface Progress {
        void onProgress(long received, long total);
    }

    static boolean isValidUrl(String url) {
        return url != null && url.startsWith(DOWNLOAD_PREFIX) && url.endsWith("-android.apk") && !url.contains("..");
    }

    /** Solo letras, números y . + - (así la versión no puede colarse como ruta de archivo). */
    static boolean isValidVersion(String version) {
        return version != null && version.matches("[0-9A-Za-z.+-]{1,40}");
    }

    /** ¿Este APK declara el permiso de instalar paquetes (y el sistema permite pedirlo)? La versión de Play, no. */
    static boolean isSupported(Context context) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
            PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), PackageManager.GET_PERMISSIONS);
            if (info.requestedPermissions == null) return false;
            for (String permission : info.requestedPermissions) {
                if (PERMISSION.equals(permission)) return true;
            }
        } catch (Throwable ignored) {
            // sin permiso declarado o sin datos: no se ofrece la actualización dentro de la app
        }
        return false;
    }

    private static File updatesDir(Context context) {
        return new File(context.getCacheDir(), "updates");
    }

    static File apkFile(Context context, String version) {
        return new File(updatesDir(context), "Lumihilo-" + version + ".apk");
    }

    /** El archivo es un APK de esta app y de la versión esperada. */
    private static boolean isExpectedApk(Context context, File file, String version) {
        try {
            if (!file.isFile() || file.length() < MIN_APK_BYTES) return false;
            PackageInfo info = context.getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(), 0);
            return info != null && context.getPackageName().equals(info.packageName) && version.equals(info.versionName);
        } catch (Throwable ignored) {
            return false;
        }
    }

    /** Descarga el APK (si no está ya descargado y sano). Devuelve la ruta, o lanza una excepción con el motivo. */
    static File download(Context context, String url, String version, Progress progress) throws Exception {
        File dir = updatesDir(context);
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        File target = apkFile(context, version);
        if (isExpectedApk(context, target, version)) return target;

        // Limpia descargas anteriores
        File[] old = dir.listFiles();
        if (old != null) for (File f : old) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
        }

        // El nombre termina en .apk para que Android lea el archivo como un paquete
        File part = new File(dir, "Lumihilo-" + version + "-descarga.apk");
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(true);
            if (connection.getResponseCode() != 200) throw new Exception("HTTP " + connection.getResponseCode());
            long total = connection.getContentLengthLong();
            try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(part)) {
                byte[] buffer = new byte[32 * 1024];
                long received = 0;
                long lastReport = 0;
                int read;
                while ((read = in.read(buffer)) > 0) {
                    out.write(buffer, 0, read);
                    received += read;
                    long now = System.currentTimeMillis();
                    if (progress != null && now - lastReport > 120) {
                        lastReport = now;
                        progress.onProgress(received, total);
                    }
                }
                if (progress != null) progress.onProgress(received, total);
            }
            if (!isExpectedApk(context, part, version)) throw new Exception("El archivo no es la versión " + version);
            if (!part.renameTo(target)) throw new Exception("No se pudo guardar el archivo");
            return target;
        } finally {
            if (connection != null) connection.disconnect();
            if (part.exists()) {
                //noinspection ResultOfMethodCallIgnored
                part.delete();
            }
        }
    }

    /**
     * Abre el instalador de Android con el APK descargado. Si el jugador aún no ha permitido a Lumihilo instalar
     * aplicaciones, abre ese ajuste y devuelve "needs-permission"; el APK queda descargado para el siguiente intento.
     */
    static String install(Context context, String version) throws Exception {
        File file = apkFile(context, version);
        if (!isExpectedApk(context, file, version)) throw new Exception("No hay una descarga válida");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(settings);
            return "needs-permission";
        }
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        return "started";
    }
}
