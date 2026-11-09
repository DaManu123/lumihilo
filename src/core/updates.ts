/**
 * Comprobación de versiones nuevas. Lógica pura (sin red ni Phaser) para poder probarla en Node.
 */

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  /** Partes de la etiqueta de prelanzamiento (p. ej. ['beta', 9]); vacía si es una versión final. */
  pre: Array<string | number>;
}

export function parseVersion(text: string): ParsedVersion | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(text.trim());
  if (!m) return null;
  const pre = m[4] ? m[4].split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part)) : [];
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre };
}

/** Compara dos versiones: negativo si a < b, 0 si son iguales, positivo si a > b (reglas de SemVer). */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (x[key] !== y[key]) return x[key] - y[key];
  }
  // Una versión final es mayor que cualquiera de sus prelanzamientos
  if (x.pre.length === 0 || y.pre.length === 0) return y.pre.length - x.pre.length;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    if (typeof p === 'number' && typeof q === 'number') return p - q;
    if (typeof p === 'number') return -1; // los números van antes que el texto
    if (typeof q === 'number') return 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

export interface UpdateInfo {
  /** Versión sin la "v" (p. ej. "0.1.0-beta.9"). */
  version: string;
  /** Página de la versión, donde están las descargas. */
  url: string;
}

interface ReleaseLike {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
}

/** De la lista de publicaciones de GitHub, la de versión más alta (ignora borradores y datos raros). */
export function pickLatest(releases: unknown): UpdateInfo | null {
  if (!Array.isArray(releases)) return null;
  let best: UpdateInfo | null = null;
  for (const raw of releases as ReleaseLike[]) {
    if (typeof raw !== 'object' || raw === null) continue;
    if (raw.draft === true) continue;
    if (typeof raw.tag_name !== 'string' || typeof raw.html_url !== 'string') continue;
    if (!/^https:\/\/github\.com\//.test(raw.html_url)) continue;
    const parsed = parseVersion(raw.tag_name);
    if (!parsed) continue;
    const version = raw.tag_name.replace(/^v/, '');
    if (!best || compareVersions(version, best.version) > 0) best = { version, url: raw.html_url };
  }
  return best;
}

/** ¿La versión publicada es más nueva que la instalada? (El aviso sale cada vez que se abre la app mientras sea así.) */
export function isUpdateAvailable(current: string, latest: UpdateInfo | null): boolean {
  return latest !== null && compareVersions(latest.version, current) > 0;
}
