# 04 · Monetización y anuncios

> Las políticas de anuncios cambian. Este documento resume lo revisado en octubre de 2026; **antes de cada release, relee las políticas oficiales de AdMob, AdSense y Google Play.**

## Estrategia recomendada

La regla: **el anuncio nunca interrumpe el puzzle**. Los ingresos vienen de momentos naturales (entre partidas) y de la recompensa voluntaria.

| Formato | Dónde | Frecuencia sugerida | Rol |
|---|---|---|---|
| **Recompensado** | Botón "ver anuncio → pista" y "ver anuncio → saltar nivel" | Siempre voluntario | El que mejor paga y menos molesta |
| **Intersticial** | Al terminar una partida, antes de empezar la siguiente | Cada 3 partidas **y** con enfriamiento mínimo (p. ej. 90–120 s) | Ingreso base |
| **Banner** | Solo en menú/resultados, nunca pegado al tablero | Fijo | Ingreso pequeño; cuidado con toques accidentales, sobre todo en personas mayores |
| Quitar anuncios (compra única) | Ajustes | — | Fase 8, con Google Play Billing |

Los números de frecuencia son un punto de partida: se ajustan con datos reales en la Fase 8.

## Reglas de AdMob que hay que cumplir

### Intersticiales

No se permite: mostrarlos antes de que la app abra o después de cerrarla, encadenar uno inmediatamente tras cerrar otro, mostrarlos tras cada acción o toque del usuario (incluido el botón Atrás), ni lanzarlos de sorpresa mientras el usuario está concentrado en una tarea como jugar. Deben ir en pausas lógicas del contenido, por ejemplo entre niveles.

Para este juego eso significa: **solo en la pantalla de resultado**, nunca al abrir la app y nunca durante el puzzle.

### Recompensados

- El jugador debe aceptar de forma clara y explícita antes de ver el anuncio (excepto el formato "rewarded interstitial", que debe mostrar una pantalla previa con opción de rechazar).
- Hay que describir con claridad qué acción se pide y qué recompensa se da, antes de cada anuncio. Ejemplo válido: "Ver un anuncio para obtener 1 pista".
- Si hay recompensas aleatorias o paquetes de varios anuncios, se debe avisar antes.
- El anuncio no puede obligar a interactuar con él: debe poder cerrarse o saltarse.

### Toques accidentales y colocación

- Prohibido pedir que se haga clic en anuncios ("toca el anuncio") o dar incentivos por hacerlo.
- Los anuncios no deben cubrir contenido ni desplazarlo en el momento de tocar.
- **Nunca hagas clic en tus propios anuncios** ni pidas a conocidos que lo hagan: es la forma más rápida de perder la cuenta. Usa siempre los IDs de prueba durante el desarrollo.

## Web

- Para juegos HTML5, AdSense ofrece **H5 Games Ads** con la **Ad Placement API** (`adBreak()` para anuncios de pantalla completa y recompensados). La misma API puede usarse dentro de un WebView de una app.
- Es un producto **con solicitud previa**: hay que pedir acceso y la cuenta puede no ser aprobada.
- Los anuncios de pantalla completa solo se permiten en transiciones (por ejemplo, entre juegos o partidas), nunca de forma inesperada mientras se juega.
- No hay que "fabricar" intersticiales propios con anuncios display normales.
- Plan alternativo mientras llega la aprobación: anuncios de display **alrededor** de la página del juego, nunca sobre el tablero.

**Estrategia práctica:** AdMob nativo en la app Android (mediante plugin de Capacitor) + AdSense/H5 en la web, ambos detrás de `AdService`.

## Plugin de Capacitor para AdMob

El plugin comunitario `@capacitor-community/admob` envuelve el SDK de Google Mobile Ads y soporta banner, intersticial, recompensado, recompensado intersticial y app open; incluye utilidades de consentimiento. Las versiones del plugin siguen a las de Capacitor (por ejemplo, plugin v8 ↔ Capacitor 8; para Capacitor 7 se instala `@7`). **Instala la versión que corresponda a tu Capacitor** y revisa su README antes de integrarlo.

## Audiencia y anuncios

- Si la app declara **solo audiencia infantil**, AdMob sirve anuncios compatibles con la política de Familias automáticamente, y notarás menos anuncios disponibles.
- Si la audiencia incluye niños **y** mayores, hay que usar SDKs de anuncios autocertificados para Familias al atender solicitudes de niños o usuarios de edad desconocida, y etiquetar las solicitudes como dirigidas a niños donde corresponda.
- Para redes de terceros vía mediación, hay que enviar el tratamiento infantil y limitar la clasificación de contenido a G en cada solicitud.

Decisión del proyecto: se resuelve en la Fase 0 (ver `01`). Si se elige el Camino A (13+), este apartado aplica solo como referencia.

## Consentimiento y privacidad

- Integrar el flujo de consentimiento (UMP) que ofrece el plugin y mostrarlo cuando corresponda según la región.
- La **política de privacidad** debe mencionar que se usan anuncios y qué SDKs recogen datos.
- Rellenar con cuidado el formulario de **seguridad de datos** de Play Console: el SDK de anuncios cuenta como recolección de datos.

## ¿Cuánto se puede ganar?

No hay forma honesta de prometer una cifra. La fórmula es:

```
ingreso ≈ (impresiones / 1000) × eCPM
```

El eCPM varía mucho por país, formato y época del año; los recompensados pagan más que los banners. Lo útil es **medir**: impresiones por usuario por día, tasa de opt-in a recompensados y eCPM real en AdMob, y decidir con esos datos. Un juego casual pequeño suele necesitar mucho tráfico para generar ingresos notables; conviene ver el proyecto primero como portafolio y aprendizaje, y como ingreso extra después.

## Checklist de cumplimiento (revisar antes de cada release)

- [ ] Ningún intersticial al abrir la app, durante el puzzle ni después de otro intersticial
- [ ] Intersticiales solo en pantalla de resultado, con enfriamiento y frecuencia limitada
- [ ] Todo anuncio recompensado se ofrece con botón claro y descripción de la recompensa
- [ ] Los anuncios recompensados se pueden cerrar y no obligan a interactuar
- [ ] Ningún banner pegado al tablero ni que desplace contenido
- [ ] Ningún texto invita a tocar anuncios
- [ ] IDs de prueba en desarrollo; IDs reales solo en la build de release
- [ ] Flujo de consentimiento funcionando
- [ ] Política de privacidad actualizada y enlazada
- [ ] Formulario de seguridad de datos y declaración de anuncios coherentes con la build
- [ ] Audiencia declarada coherente con la configuración de anuncios
