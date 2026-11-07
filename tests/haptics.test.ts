import { describe, it, expect } from 'vitest';
import {
  HAPTIC_LEVELS,
  HAPTIC_PROFILES,
  HAPTIC_LABELS,
  HAPTIC_MODES,
  HAPTIC_MODE_LABELS,
  HAPTIC_AMPLITUDES,
  HapticDiagnostics,
  isHapticLevel,
  isHapticMode,
  patternPulses,
  triggerOptions,
  describeDiagnostics,
  vibrationBlockers,
} from '../src/core/haptics';

describe('Perfiles de vibración (src/core/haptics.ts)', () => {
  it('cada intensidad es más larga que la anterior en todos los eventos', () => {
    const [soft, normal, strong] = HAPTIC_LEVELS.map((l) => HAPTIC_PROFILES[l]);
    expect(soft.tap).toBeLessThan(normal.tap);
    expect(normal.tap).toBeLessThan(strong.tap);
    expect(soft.connect).toBeLessThan(normal.connect);
    expect(normal.connect).toBeLessThan(strong.connect);
  });

  it('conectar siempre se siente más que un simple giro', () => {
    for (const level of HAPTIC_LEVELS) {
      expect(HAPTIC_PROFILES[level].connect).toBeGreaterThan(HAPTIC_PROFILES[level].tap);
    }
  });

  it('los pulsos son lo bastante largos para que el motor los reproduzca y lo bastante cortos para sentirse como un toque', () => {
    for (const level of HAPTIC_LEVELS) {
      const { tap, connect, win } = HAPTIC_PROFILES[level];
      for (const ms of [tap, connect, ...win]) {
        expect(ms).toBeGreaterThanOrEqual(15);
        expect(ms).toBeLessThanOrEqual(200);
      }
    }
  });

  it('el patrón de victoria empieza y termina con un pulso (longitud impar)', () => {
    for (const level of HAPTIC_LEVELS) {
      expect(HAPTIC_PROFILES[level].win.length % 2).toBe(1);
    }
  });

  it('la victoria dura menos de un segundo en total', () => {
    for (const level of HAPTIC_LEVELS) {
      expect(HAPTIC_PROFILES[level].win.reduce((a, b) => a + b, 0)).toBeLessThan(1000);
    }
  });

  it('patternPulses calcula el retraso acumulado de cada pulso e ignora las pausas', () => {
    expect(patternPulses([45, 70, 45, 70, 90])).toEqual([
      { delay: 0, duration: 45 },
      { delay: 115, duration: 45 },
      { delay: 230, duration: 90 },
    ]);
    expect(patternPulses([])).toEqual([]);
    expect(patternPulses([30])).toEqual([{ delay: 0, duration: 30 }]);
  });

  it('reconoce solo las intensidades válidas', () => {
    expect(isHapticLevel('soft')).toBe(true);
    expect(isHapticLevel('strong')).toBe(true);
    for (const bad of ['medium', '', null, undefined, 3, {}]) expect(isHapticLevel(bad)).toBe(false);
  });

  it('cada intensidad tiene su etiqueta en español', () => {
    expect(HAPTIC_LEVELS.map((l) => HAPTIC_LABELS[l])).toEqual(['Suave', 'Normal', 'Fuerte']);
  });

  describe('vías de vibración', () => {
    it('reconoce solo los modos válidos y cada uno tiene su etiqueta', () => {
      for (const mode of HAPTIC_MODES) expect(isHapticMode(mode)).toBe(true);
      for (const bad of ['', 'todos', null, undefined, 4, {}]) expect(isHapticMode(bad)).toBe(false);
      expect(HAPTIC_MODES.map((m) => HAPTIC_MODE_LABELS[m])).toEqual(['Auto', 'Sistema', 'Motor', 'Táctil', 'Alarma']);
    });

    it('la potencia crece con la intensidad y está en el rango válido de Android (1 a 255)', () => {
      const [soft, normal, strong] = HAPTIC_LEVELS.map((l) => HAPTIC_AMPLITUDES[l]);
      expect(soft).toBeLessThan(normal);
      expect(normal).toBeLessThan(strong);
      for (const a of [soft, normal, strong]) {
        expect(a).toBeGreaterThanOrEqual(1);
        expect(a).toBeLessThanOrEqual(255);
      }
    });

    it('triggerOptions arma lo que recibe el plugin nativo para cada evento', () => {
      expect(triggerOptions('tap', 'normal', 'all')).toEqual({ kind: 'tap', mode: 'all', duration: 25, amplitude: 220 });
      expect(triggerOptions('connect', 'strong', 'system')).toEqual({ kind: 'connect', mode: 'system', duration: 70, amplitude: 255 });
      const win = triggerOptions('win', 'soft', 'touch');
      expect(win.pattern).toEqual([30, 70, 30]);
      expect(win.duration).toBe(30);
      expect(win.pattern).not.toBe(HAPTIC_PROFILES.soft.win); // copia: nunca se comparte el original
    });
  });

  describe('diagnóstico del teléfono', () => {
    const healthy: HapticDiagnostics = {
      sdk: 35, manufacturer: 'Xiaomi', model: '24069PC21G', hasMotor: true, hasAmplitudeControl: true,
      hapticFeedbackEnabled: 1, touchIntensity: 2, mediaIntensity: 2, notificationIntensity: 3, ringIntensity: 3,
      ringerMode: 2, interruptionFilter: 1, powerSave: false,
    };

    it('un teléfono sin problemas no muestra bloqueos', () => {
      expect(vibrationBlockers(healthy)).toEqual([]);
    });

    it('detecta cada ajuste que puede bloquear la vibración', () => {
      expect(vibrationBlockers({ ...healthy, hasMotor: false })).toHaveLength(1);
      expect(vibrationBlockers({ ...healthy, hapticFeedbackEnabled: 0 })[0]).toContain('respuesta táctil');
      expect(vibrationBlockers({ ...healthy, touchIntensity: 0 })[0]).toContain('táctil');
      expect(vibrationBlockers({ ...healthy, mediaIntensity: 0 })[0]).toContain('medios');
      expect(vibrationBlockers({ ...healthy, interruptionFilter: 3 })[0]).toContain('No molestar');
      expect(vibrationBlockers({ ...healthy, interruptionFilter: 4 })).toHaveLength(1);
      expect(vibrationBlockers({ ...healthy, powerSave: true })[0]).toContain('ahorro de batería');
      expect(vibrationBlockers({ ...healthy, ringerMode: 0 })[0]).toContain('silencio');
    });

    it('un valor que el teléfono no expone (-1) no se confunde con "desactivado"', () => {
      expect(vibrationBlockers({ ...healthy, touchIntensity: -1, mediaIntensity: -1, hapticFeedbackEnabled: -1 })).toEqual([]);
    });

    it('acumula varios bloqueos a la vez', () => {
      expect(vibrationBlockers({ ...healthy, mediaIntensity: 0, powerSave: true, interruptionFilter: 3 })).toHaveLength(3);
    });

    it('describe el teléfono en líneas legibles en español', () => {
      const lines = describeDiagnostics(healthy);
      expect(lines[0]).toBe('Teléfono: Xiaomi 24069PC21G (Android API 35)');
      expect(lines).toContain('Motor de vibración: Sí (con control de potencia)');
      expect(describeDiagnostics({ ...healthy, hasAmplitudeControl: false })).toContain('Motor de vibración: Sí');
      expect(describeDiagnostics({ ...healthy, hasMotor: false, hasAmplitudeControl: true })).toContain('Motor de vibración: No');
      expect(lines).toHaveLength(9); // caben en la pantalla de diagnóstico junto a las causas probables
      expect(lines).toContain('Intensidad de notificaciones: Alta');
      expect(lines).toContain('Modo del timbre: Normal');
      expect(lines).toContain('No molestar: Desactivado');
      const blocked = describeDiagnostics({ ...healthy, mediaIntensity: 0, hapticFeedbackEnabled: 0 });
      expect(blocked).toContain('Intensidad de medios y juegos: Desactivada');
      expect(blocked).toContain('Respuesta táctil del sistema: No');
    });

    it('los valores desconocidos se describen como "No disponible"', () => {
      const lines = describeDiagnostics({ ...healthy, touchIntensity: -1, ringerMode: 9, interruptionFilter: 0, hapticFeedbackEnabled: -1 });
      expect(lines).toContain('Intensidad táctil: No disponible');
      expect(lines).toContain('Modo del timbre: No disponible');
      expect(lines).toContain('No molestar: No disponible');
      expect(lines).toContain('Respuesta táctil del sistema: No disponible');
    });
  });
});
