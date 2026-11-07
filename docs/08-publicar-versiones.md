# 08 · Publicar versiones (APK, Windows y Linux)

Cada versión del juego se publica sola: al subir una etiqueta `v…`, GitHub Actions compila las tres plataformas, las prueba y las adjunta a una *Release* de GitHub. El flujo está en `.github/workflows/release.yml`.

## Qué se genera

| Plataforma | Archivos | Cómo se hace |
|---|---|---|
| Android | `Lumihilo-<versión>-android.apk` (firmado) | Capacitor + Gradle |
| Windows | `…-windows-x64-portable.exe` y `…-windows-x64-instalador.exe` | Electron (`desktop/`) |
| Linux | `…-linux-x64.AppImage` y `…-linux-x64.tar.gz` | Electron (`desktop/`) |
| Todas | `SHA256SUMS.txt` | Sumas de verificación |

La versión de escritorio (`desktop/`) es solo un contenedor que carga el mismo juego web (`dist/`). Vive en su propia carpeta con su propio `package.json` para que `npm install` del juego no descargue Electron.

## Publicar una versión nueva

1. **Que el código esté listo.** Lo normal es fusionar `dev` en `main`; también se puede etiquetar `dev` para una beta.
2. **Subir la versión** en los dos `package.json` (deben coincidir con la etiqueta):
   ```bash
   npm version 0.1.0-beta.2 --no-git-tag-version
   (cd desktop && npm version 0.1.0-beta.2 --no-git-tag-version)
   ```
3. **Escribir las notas** en `docs/releases/v0.1.0-beta.2.md` (se copian tal cual a la Release) y añadir la entrada a `CHANGELOG.md`.
4. **Confirmar y etiquetar:**
   ```bash
   git add -A && git commit -m "release: v0.1.0-beta.2"
   git push origin dev
   git tag v0.1.0-beta.2 && git push origin v0.1.0-beta.2
   ```
5. **Mirar** la pestaña *Actions*. Tarda unos 15 minutos. Si todo sale bien aparece la Release; las versiones con guion (`-beta.2`) se marcan como *pre-lanzamiento*.

Si falla algún paso **no se publica nada**. Se corrige, y para repetir se borra la etiqueta y se vuelve a subir:
```bash
git push origin :refs/tags/v0.1.0-beta.2 && git tag -d v0.1.0-beta.2
```

## Qué comprueba el flujo antes de publicar

- La etiqueta, `package.json`, `desktop/package.json` y las notas coinciden.
- Pruebas de tipos y pruebas unitarias del juego.
- **APK:** está firmado, tiene la versión correcta, contiene el juego y registra el plugin de vibración.
- **Windows y Linux:** se arranca la aplicación empaquetada de verdad (con el AppImage, el portable y la carpeta desempaquetada) y se comprueba que el juego carga: lienzo, tipografías y guardado. La captura queda en los artefactos del flujo (`smoke-…`).

## Firma del APK

Android solo instala un APK firmado, y la firma debe ser **siempre la misma** entre versiones; si cambia, quien la tenga instalada debe desinstalarla antes de actualizar.

- La clave se generó una vez y vive **fuera del repositorio**: `~/.puzzle-adaptativo-signing/` (archivo `.p12`, contraseñas y copia en base64). **Haz una copia de seguridad.** GitHub no permite volver a leer los secretos: si pierdes esos archivos y borras el secreto, no podrás publicar actualizaciones que se instalen encima de las anteriores.
- Para el flujo, la clave está en cuatro *secrets* del repositorio:

  | Secreto | Contenido |
  |---|---|
  | `ANDROID_KEYSTORE_BASE64` | El archivo `.p12` codificado en base64 |
  | `ANDROID_KEYSTORE_PASSWORD` | Contraseña del almacén |
  | `ANDROID_KEY_ALIAS` | `puzzle-adaptativo-beta` |
  | `ANDROID_KEY_PASSWORD` | Contraseña de la clave (la misma) |

- Esta clave es **solo para las betas fuera de la tienda**. Para Google Play se usará *Play App Signing* con su propia clave de subida, y se subirá un `.aab`, no este APK.
- `android/app/build.gradle` firma solo si existen las variables de entorno del flujo; en el desarrollo local el APK de publicación sale sin firmar.

## Cosas a tener en cuenta

- **`appId` provisional** (`com.placeholder.puzzleadaptativo`): las betas se instalan con ese identificador. Al fijar el definitivo (antes de la primera subida a Play) habrá que desinstalar la beta.
- **Windows y Linux sin firmar:** Windows SmartScreen avisa. Firmar el `.exe` requiere un certificado de pago; por ahora se explica en las notas de cada versión.
- **Capacitor y TypeScript:** la configuración de Capacitor es `capacitor.config.json` (no `.ts`) porque el CLI no puede leer archivos `.ts` con TypeScript 7 en Node 22.
- **`npm run cap:sync`** hay que ejecutarlo en cada copia de trabajo al cambiar los plugins; el flujo de publicación lo hace solo.
- **Probar la versión de escritorio en local:** `npm run build`, luego `cd desktop && npm install && npm start`. Para generar los instaladores de Linux en local: `cd desktop && npm run dist:linux`.

## El archivo `.aab` para Google Play

Cada versión publicada también genera un **Android App Bundle** (`Lumihilo-<versión>-android.aab`), el formato que exige Google Play para apps nuevas. No se adjunta a la versión pública de GitHub: se descarga desde la pestaña **Actions → ejecución de la versión → Artifacts → `aab-android`** (se conserva 30 días).

- El flujo comprueba que el AAB contiene el juego y el manifiesto y que está firmado.
- Hoy se firma con la clave de las betas. Antes de subir a Play Console conviene generar una **clave de subida propia** y activar *Play App Signing* (ver `05-publicacion-play-store.md`), y cambiar el identificador provisional `com.placeholder.puzzleadaptativo` por el definitivo, porque no se puede cambiar después de publicar.
- El CI normal compila también un AAB de depuración (`bundleDebug`) en cada cambio, para detectar a tiempo cualquier problema al empaquetarlo.
