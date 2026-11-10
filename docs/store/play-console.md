# Play Console: respuestas listas para las declaraciones

Borrador para rellenar los formularios cuando exista la cuenta de desarrollador (#7). **Verifica cada pregunta contra el formulario vigente** (Google los cambia); aquí está lo que corresponde al juego tal como está hoy.

## Antes de generar la build para Play

1. El AAB que sale del flujo de publicación ya se compila con `UPDATE_SOURCE='play'` (a mano: `npm run build:play`; no se edita `src/config.ts`). Así la app **no contacta con GitHub** y no envía ningún dato fuera del dispositivo (ver `docs/08-publicar-versiones.md`). Las respuestas de «Seguridad de los datos» de abajo dependen de esto.
2. Identificador definitivo ya fijado: `com.damanu.lumihilo`.
3. Clave de subida propia y Play App Signing (ver «Clave de subida» más abajo).
4. Versión y notas de la versión (`docs/releases/`).

## Ficha

Textos (ES/EN), icono, gráfico y capturas (13; Play admite 8): `docs/store/ficha.md`. Categoría **Juegos → Puzzle**. Política de privacidad: `https://damanu123.github.io/lumihilo/privacidad.html` (inglés: `/en/privacy.html`). Correo de contacto: myprimemg@gmail.com.

## Declaraciones

| Formulario | Respuesta |
|---|---|
| **Acceso a la app** | Todo el contenido es accesible sin iniciar sesión ni credenciales. |
| **Anuncios** | **No contiene anuncios** (hoy). Si se añaden después, hay que cambiarlo y actualizar la política antes de publicar esa versión. |
| **Compras dentro de la app** | Ninguna (las Chispas solo se ganan jugando; no se venden). |
| **Seguridad de los datos: ¿recopila o comparte datos?** | **No** recopila ni comparte datos de usuario (con `UPDATE_SOURCE = 'play'`). Todo el progreso vive en el dispositivo. |
| **Seguridad de los datos: ¿cifrado en tránsito?** | No aplica (no se transmiten datos). |
| **Seguridad de los datos: ¿puede pedir que se borren?** | No aplica; se borran desinstalando o con «Borrar datos» (explicado en la política). |
| **ID de publicidad** | **No** se usa. |
| **Permisos** | Vibración. (`INTERNET` figura en el manifiesto por Capacitor; con `'play'` el juego no hace peticiones.) |
| **Clasificación de contenido** | Cuestionario IARC: sin violencia, sin sexo, sin lenguaje fuerte, sin sustancias, sin juego de azar con dinero, sin compras, sin interacción entre usuarios ni compartir ubicación. Resultado esperado: apto para todas las edades. |
| **App para niños / Familias** | No: la app no está dirigida a menores de 13 (ver «Audiencia»). |
| **Apps gubernamentales / financieras / de salud** | No. |
| **Funciones de noticias / COVID** | No. |

## Audiencia objetivo (decidida: 13 años en adelante)

En el formulario: grupo de edad **13+**, sin Familias, y que la app **no** se dirige a menores de 13.

**Decisión del 2026-11-09: Opción A.** En Play Console, declarar que la app **no** está dirigida a menores de 13. Las opciones que se barajaron:

- **Opción A, 13 años en adelante:** más sencilla. Sin requisitos de Familias. Es la recomendada para empezar, y la audiencia se puede ampliar después.
- **Opción B, incluye menores de 13:** aplica la política de Familias (hoy no hay anuncios ni datos, así que se cumple casi todo, pero habría que respetarla también si luego se añaden anuncios: SDKs autocertificados y tratamiento dirigido a menores).

La política de privacidad ya dice «público general»; si se elige A, conviene dejar el texto de la sección de menores tal cual.

## Clave de subida y Play App Signing (#46)

Lo hace quien tenga el equipo con la clave: **la clave no entra nunca en el repositorio**.

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore lumihilo-subida.p12 \
  -alias lumihilo-subida -keyalg RSA -keysize 2048 -validity 10000
```

1. Guarda el `.p12` y su contraseña en dos lugares seguros (gestor de contraseñas y copia fuera del equipo). Si se pierde, hay que pedir un restablecimiento a Google.
2. En Play Console, al subir la primera build, acepta **Play App Signing**: Google guarda la clave de firma final y tú firmas con la de subida.
3. En GitHub → Settings → Secrets, sustituye los secretos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD` por los de la clave nueva (nombres exactos en `docs/08-publicar-versiones.md`). Las betas que se reparten por GitHub pasarían a firmarse con esa clave; esas betas ya instaladas con la clave anterior **no se actualizarían encima**, así que conviene hacerlo en el cambio de versión en que se pida desinstalar.
4. El AAB que se sube sale del flujo de publicación (artefacto `aab-android`).

## Pruebas cerradas (#49)

Requisito de 12 testers durante 14 días en cuentas personales nuevas: ver `docs/05-publicacion-play-store.md`. Antes de invitar testers: build firmada y subida, ficha en borrador, política publicada.
