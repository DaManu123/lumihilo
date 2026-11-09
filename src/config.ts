export const APP_NAME = 'Lumihilo';

/** Versión de la app (la de package.json). En las pruebas unitarias, donde Vite no la inyecta, es 0.0.0. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

/** Repositorio donde se publican las versiones. */
export const RELEASES_REPO = 'DaManu123/lumihilo';

/**
 * Listas de versiones publicadas, en orden de preferencia. La primera es un archivo pequeño que el flujo de la web
 * regenera con cada versión (sin límite de consultas); la segunda es la API de GitHub, por si la primera falla.
 */
export const RELEASES_FEEDS: readonly string[] = [
  'https://damanu123.github.io/lumihilo/releases.json',
  `https://api.github.com/repos/${RELEASES_REPO}/releases?per_page=30`,
];

/**
 * De dónde llegan las actualizaciones:
 * - 'github': se compara con la última versión publicada en GitHub (betas de APK, Windows y Linux).
 * - 'play': las gestiona Google Play (actualizaciones dentro de la app); el juego no busca nada por su cuenta.
 * Se decide al compilar con la variable de entorno `UPDATE_SOURCE` (`npm run build:play`); sin ella, 'github'.
 * El flujo de publicación ya compila el AAB (el de Google Play) con 'play' y el APK (el de GitHub) con 'github'.
 */
export const UPDATE_SOURCE: 'github' | 'play' = typeof __UPDATE_SOURCE__ === 'string' && __UPDATE_SOURCE__ === 'play' ? 'play' : 'github';
