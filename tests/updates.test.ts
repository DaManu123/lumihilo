import { describe, it, expect } from 'vitest';
import { apkUrl, compareVersions, downloadPercent, isUpdateAvailable, parseVersion, pickLatest } from '../src/core/updates';

describe('Versiones', () => {
  it('lee versiones con y sin prelanzamiento', () => {
    expect(parseVersion('v0.1.0-beta.9')).toEqual({ major: 0, minor: 1, patch: 0, pre: ['beta', 9] });
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: [] });
    expect(parseVersion('basura')).toBeNull();
    expect(parseVersion('1.2')).toBeNull();
  });

  it('ordena como SemVer', () => {
    const order = ['0.1.0-beta.1', '0.1.0-beta.2', '0.1.0-beta.9', '0.1.0-beta.10', '0.1.0-rc.1', '0.1.0', '0.1.1', '0.2.0-beta.1', '0.10.0', '1.0.0'];
    for (let i = 0; i < order.length - 1; i++) {
      expect(compareVersions(order[i], order[i + 1]), `${order[i]} < ${order[i + 1]}`).toBeLessThan(0);
      expect(compareVersions(order[i + 1], order[i])).toBeGreaterThan(0);
    }
    expect(compareVersions('v0.1.0-beta.9', '0.1.0-beta.9')).toBe(0);
  });

  it('beta.10 es mayor que beta.9 (no se ordena como texto)', () => {
    expect(compareVersions('0.1.0-beta.10', '0.1.0-beta.9')).toBeGreaterThan(0);
  });

  it('con una versión ilegible no se declara una más nueva', () => {
    expect(compareVersions('???', '1.0.0')).toBe(0);
  });
});

describe('Última publicación', () => {
  const rel = (tag: string, extra: object = {}) => ({ tag_name: tag, html_url: `https://github.com/DaManu123/lumihilo/releases/tag/${tag}`, ...extra });

  it('elige la versión más alta, aunque no venga primera', () => {
    const latest = pickLatest([rel('v0.1.0-beta.8'), rel('v0.1.0-beta.10'), rel('v0.1.0-beta.9')]);
    expect(latest?.version).toBe('0.1.0-beta.10');
    expect(latest?.url).toContain('beta.10');
  });

  it('ignora borradores, datos incompletos y enlaces que no son de GitHub', () => {
    expect(pickLatest([rel('v9.0.0', { draft: true })])).toBeNull();
    expect(pickLatest([{ tag_name: 'v2.0.0' }, { html_url: 'https://github.com/x' }, null, 5])).toBeNull();
    expect(pickLatest([{ tag_name: 'v2.0.0', html_url: 'https://evil.example/descarga' }])).toBeNull();
    expect(pickLatest([rel('latest')])).toBeNull();
  });

  it('una respuesta que no es lista no rompe nada', () => {
    expect(pickLatest({ message: 'rate limit' })).toBeNull();
    expect(pickLatest(undefined)).toBeNull();
    expect(pickLatest([])).toBeNull();
  });
});

describe('¿Hay una actualización?', () => {
  const latest = { version: '0.1.0-beta.10', url: 'https://github.com/DaManu123/lumihilo/releases/tag/v0.1.0-beta.10' };

  it('hay actualización si lo publicado es más nuevo que lo instalado', () => {
    expect(isUpdateAvailable('0.1.0-beta.9', latest)).toBe(true);
  });

  it('no la hay si ya tienes esa versión o una más nueva, ni si no se pudo consultar', () => {
    expect(isUpdateAvailable('0.1.0-beta.10', latest)).toBe(false);
    expect(isUpdateAvailable('0.2.0', latest)).toBe(false);
    expect(isUpdateAvailable('0.1.0-beta.9', null)).toBe(false);
  });
});

describe('Actualización dentro de la app', () => {
  it('la dirección del APK sigue el nombre de las Releases y solo acepta versiones válidas', () => {
    expect(apkUrl('0.2.0-beta.10')).toBe('https://github.com/DaManu123/lumihilo/releases/download/v0.2.0-beta.10/Lumihilo-0.2.0-beta.10-android.apk');
    expect(apkUrl('v1.0.0')).toBe('https://github.com/DaManu123/lumihilo/releases/download/v1.0.0/Lumihilo-1.0.0-android.apk');
    expect(apkUrl('../../x')).toBeNull();
    expect(apkUrl('basura')).toBeNull();
  });

  it('el porcentaje descargado va de 0 a 100 y es nulo si no se sabe el total', () => {
    expect(downloadPercent(0, 1000)).toBe(0);
    expect(downloadPercent(500, 1000)).toBe(50);
    expect(downloadPercent(1500, 1000)).toBe(100);
    expect(downloadPercent(10, 0)).toBeNull();
    expect(downloadPercent(10, -1)).toBeNull();
  });
});
