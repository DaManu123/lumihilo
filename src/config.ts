export const APP_NAME = 'Lumihilo';

/** Versión de la app (la de package.json). En las pruebas unitarias, donde Vite no la inyecta, es 0.0.0. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

/** Repositorio donde se publican las versiones. */
export const RELEASES_REPO = 'DaManu123/lumihilo';

/**
 * De dónde llegan las actualizaciones:
 * - 'github': se compara con la última versión publicada en GitHub (betas de APK, Windows y Linux).
 * - 'play': las gestiona Google Play (actualizaciones dentro de la app); el juego no busca nada por su cuenta.
 * Al publicar en Play Store hay que cambiarlo a 'play' (ver docs/08-publicar-versiones.md).
 */
export const UPDATE_SOURCE: 'github' | 'play' = 'github';
