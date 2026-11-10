# 05 · Publicación en Play Store

> Los requisitos de Google Play cambian. **Verifica cada punto en la Ayuda de Play Console antes de actuar.** Resumen revisado en octubre de 2026.

## Cuenta de desarrollador

- Tipo **Personal** (la opción realista para un estudiante). El registro tiene una cuota única de pago (verificar monto vigente en Play Console) y verificación de identidad.
- Las cuentas personales nuevas también deben verificar acceso a un dispositivo Android mediante la app Play Console antes de poder publicar.
- Las cuentas de **Organización** no tienen el requisito de pruebas cerradas, pero requieren una entidad legal real; no tiene sentido crear una solo para saltarse la regla.

**Estado:** la cuenta de desarrollador ya se pagó (nov 2026); lo que falte de su verificación sigue en manos del usuario (#7).

## Requisito de pruebas cerradas (cuentas personales nuevas)

Si la cuenta personal se creó después del **13 de noviembre de 2023**:

- Se necesita una **prueba cerrada con al menos 12 testers** con participación continua durante **14 días** antes de poder solicitar acceso a producción.
- El requisito aplica **por app**: cada app nueva debe cumplirlo.
- Subir builds nuevas durante la prueba **no** reinicia el plazo; **pausar o detener** la pista de pruebas cerradas **sí**.
- Si un tester se sale y baja del mínimo, el conteo puede verse afectado: conviene reclutar de más.
- Las pruebas internas (hasta 100 testers) sirven para iterar rápido, pero **no cuentan** para este requisito.
- Google revisa también las versiones de pruebas cerradas, así que no se debe subir una build de relleno.

### Plan para conseguir testers

- Meta: **15–20 personas** para tener colchón.
- Compañeros de la carrera, familia y amigos con Android.
- Pedirles que instalen la app, la abran varias veces durante los 14 días y dejen comentarios.
- Calendario compartido con fecha de inicio y fin, y recordatorios semanales.
- Desconfía de servicios que "venden testers": pueden contravenir las políticas y no aportan feedback real.

### Línea de tiempo realista

```
Día 0     Build estable subida a pruebas cerradas, testers invitados
Día 1–14  Prueba continua (mientras tanto: Fases 4 y 5)
Día 14+   Solicitud de acceso a producción
Después   Revisión de Google (varios días)
```

Presupuesta alrededor de **3 semanas** entre empezar la prueba y poder publicar.

## Requisitos técnicos

- Las apps nuevas se publican como **Android App Bundle (AAB)**, no como APK.
- Activar **Play App Signing** y guardar el keystore de subida en un lugar seguro (nunca en el repo; ya está en `.gitignore`).
- Verifica el **nivel de API objetivo** exigido actualmente y mantén Capacitor y las dependencias al día.
- Probar en al menos un teléfono físico de gama baja.

## Ficha de la tienda

- [x] Nombre, descripción corta y larga (español e inglés): `docs/store/ficha.md`
- [x] Icono 512×512 y gráfico de funciones 1024×500: `docs/store/`
- [x] Capturas de teléfono (13 generadas con `e2e/store.mjs`; Play admite 8 como máximo, hay una propuesta en la ficha)
- [x] URL de **política de privacidad** pública (GitHub Pages)
- [ ] Categoría: Juegos → Puzzle (se elige en Play Console)

## Declaraciones obligatorias en Play Console

- [x] **Audiencia objetivo:** 13+ (decidido el 2026-11-09), sin Familias. Pendiente solo marcarlo en el formulario
- [ ] **Anuncios:** hoy la app **no contiene anuncios**; si se añaden, cambiar la declaración antes de publicar esa versión
- [ ] **Seguridad de los datos:** con `UPDATE_SOURCE='play'` no se recopila ni comparte nada; las respuestas están en `docs/store/play-console.md`
- [ ] **Clasificación de contenido** (cuestionario)
- [ ] **Acceso a la app** (no aplica login, indicar que no requiere)
- [ ] Declaración de ID de publicidad si corresponde

## Lanzamiento

1. Subir el AAB `aab-android` que genera el flujo de publicación (ya compilado con `UPDATE_SOURCE='play'`). Si algún día hay anuncios, sustituir los IDs de prueba por reales **solo** en la build de release.
2. Publicar con **despliegue escalonado** (por ejemplo 10 % → 50 % → 100 %).
3. Vigilar crashes (Android vitals) y reseñas los primeros días.
4. Responder reseñas; las primeras pesan mucho.

## Versión web

- La web ya se despliega sola en GitHub Pages (`pages.yml`): https://damanu123.github.io/lumihilo/.
- Si algún día hay anuncios web, AdSense normalmente pide un **dominio propio** y contenido suficiente; revisar los requisitos vigentes.
- Enlazar la web desde la ficha de Play y viceversa.
