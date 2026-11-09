// Escenarios de flujo completo del juego. Cada uno abre un contexto limpio, toca la interfaz como lo haría
// una persona y comprueba el estado guardado, el audio y la vibración.
import { SEEN_TUTORIAL, RICH, check, consoleErrors, openGame, section, today, winWithHints } from './lib.mjs';

export async function runGameScenarios(out) {
  section('1. Primera visita: tutorial y valores iniciales');
  {
    const g = await openGame({ label: 'tutorial', out });
    let s = await g.state();
    check('arranca con 30 Chispas y en el nivel 1', s.progress?.sparks === 30 && s.progress?.currentLevel === 1, JSON.stringify(s.progress && { sparks: s.progress.sparks, level: s.progress.currentLevel }));
    check('se genera una semilla base propia', Number.isInteger(s.progress?.seedBase) && s.progress.seedBase > 0);
    check('el tutorial aún no está marcado como visto', !s.settings?.hasSeenTutorial);
    await g.shot('e1-tutorial');
    await g.tap(...g.pos.tutorialOk);
    s = await g.state();
    check('"Entendido" marca el tutorial como visto', s.settings?.hasSeenTutorial === true);
    await g.reload();
    await g.shot('e1-sin-tutorial');
    await g.close();
  }

  section('2. Sentido de giro y tema se guardan');
  {
    const g = await openGame({ label: 'ajustes', seed: SEEN_TUTORIAL, out });
    await g.tap(...g.pos.dir);
    let s = await g.state();
    check('el botón de giro cambia a antihorario y lo guarda', s.settings?.rotationDirection === 'ccw');
    await g.reload();
    s = await g.state();
    check('el sentido antihorario persiste al recargar', s.settings?.rotationDirection === 'ccw');
    await g.shot('e2-antihorario');
    await g.tap(...g.pos.dir);
    s = await g.state();
    check('volver a tocar regresa a horario', s.settings?.rotationDirection === 'cw');
    await g.tap(...g.pos.theme, 700);
    s = await g.state();
    check('el botón de tema cambia a claro y lo guarda', s.settings?.theme === 'light');
    await g.reload();
    s = await g.state();
    check('el tema claro persiste al recargar', s.settings?.theme === 'light');
    await g.shot('e2-tema-claro');
    await g.close();
  }

  section('3. Pistas: coste y saldo insuficiente');
  {
    const g = await openGame({ label: 'pistas', seed: SEEN_TUTORIAL, out });
    await g.tap(...g.pos.hint, 450);
    let s = await g.state();
    check('la primera pista cuesta 10 Chispas (30 → 20)', s.progress.sparks === 20, `saldo ${s.progress.sparks}`);
    await g.tap(...g.pos.hint, 450);
    await g.tap(...g.pos.hint, 450);
    s = await g.state();
    check('tres pistas dejan el saldo en 0', s.progress.sparks === 0, `saldo ${s.progress.sparks}`);
    await g.tap(...g.pos.hint, 450);
    s = await g.state();
    check('sin saldo no se cobra ni se queda negativo', s.progress.sparks === 0);
    await g.shot('e3-sin-saldo');
    await g.close();
  }

  section('4. Resolver un nivel: progreso, racha y exploit de pistas');
  {
    const g = await openGame({ label: 'victoria', seed: { ...SEEN_TUTORIAL, ...RICH }, out });
    const r = await winWithHints(g);
    check('se puede resolver el nivel solo con pistas', !!r, r ? `${r.hints} pistas` : 'no se resolvió');
    if (r) {
      const s = r.after;
      check('cuenta un nivel resuelto y avanza al nivel 2', s.progress.stats.levelsSolved === 1 && s.progress.currentLevel === 2);
      check('inicia la racha en 1 día', s.progress.streak.current === 1 && s.progress.streak.lastActiveDate === today(), s.progress.streak.lastActiveDate);
      check('con pistas NO cuenta como resolución perfecta ni como récord', s.progress.stats.perfectSolves === 0 && Object.keys(s.progress.stats.bestTimeByTier).length === 0);
      check('con pistas la recompensa no incluye bonos de eficiencia ni rapidez', r.reward > 0 && r.reward <= 12, `recompensa ${r.reward}`);
      check('con 2 o más pistas el rating baja (no se premia la ayuda)', (s.profile?.rating ?? 1000) < 1000, `rating ${s.profile?.rating}`);
      await g.shot('e4-victoria');
      // Siguiente nivel (tarjeta de 6 filas: 902 px de alto)
      await g.tap(360, g.dims.h / 2 + 902 / 2 - 196, 700);
      await g.shot('e4-nivel-2');
      await g.reload();
      const s2 = await g.state();
      check('al recargar retoma en el nivel 2', s2.progress.currentLevel === 2);
    }
    await g.close();
  }

  section('5. Reto diario: doble recompensa una vez y no toca el perfil');
  {
    const g = await openGame({ label: 'diario', seed: { ...SEEN_TUTORIAL, ...RICH }, out });
    await g.tap(...g.pos.daily, 700);
    await g.shot('e5-diario');
    const r1 = await winWithHints(g, 120);
    check('se resuelve el reto diario', !!r1, r1 ? `${r1.hints} pistas` : 'no se resolvió');
    if (r1) {
      const s = r1.after;
      check('cuenta un reto diario completado hoy', s.progress.stats.dailyCompleted === 1 && s.progress.lastDailyCompleted === today());
      check('el reto diario NO altera el rating del perfil adaptativo', s.profile === null || s.profile.rating === 1000, JSON.stringify(s.profile?.rating));
      check('el reto diario NO avanza el nivel normal', s.progress.currentLevel === 1, `nivel ${s.progress.currentLevel}`);
      check('la primera vez paga el doble (sin bonos por usar pistas)', r1.reward > 0 && r1.reward % 2 === 0, `recompensa ${r1.reward}`);
      await g.shot('e5-diario-victoria');
      // Repetir el reto (tarjeta de 6 filas con desglose: 902 px)
      await g.tap(360, g.dims.h / 2 + 902 / 2 - 80, 800);
      const r2 = await winWithHints(g, 120);
      check('repetir el reto no paga Chispas', r2 && r2.reward === 0, r2 ? `recompensa ${r2.reward}` : 'no se resolvió');
      check('repetir el reto no suma otro reto completado', r2 && r2.after.progress.stats.dailyCompleted === 1);
    }
    await g.close();
  }

  section('6. Estadísticas');
  {
    const g = await openGame({ label: 'stats', seed: SEEN_TUTORIAL, out });
    await g.tap(...g.pos.stats, 500);
    await g.shot('e6-estadisticas');
    await g.tap(...g.pos.statsClose, 400);
    const s = await g.state();
    check('abrir y cerrar estadísticas no altera los datos', s.progress.sparks === 30 && s.progress.stats.levelsSolved === 0);
    await g.close();
  }

  section('7. Datos guardados corruptos');
  {
    const g = await openGame({
      label: 'corrupto',
      seed: { player_progress: '{esto no es json', user_settings: '[1,2,3]', profile_adaptive: 'null' },
      out,
    });
    check('el juego arranca aunque el almacenamiento esté corrupto', !!(await g.page.$('canvas')));
    await g.tap(...g.pos.tutorialOk);
    await g.tap(...g.pos.hint, 450);
    const s = await g.state();
    check('se recupera con valores por defecto y sigue funcionando', s.progress?.sparks === 20, JSON.stringify(s.progress && s.progress.sparks));
    await g.close();
  }

  section('8. Movimiento reducido');
  {
    const g = await openGame({ label: 'movimiento-reducido', reducedMotion: 'reduce', seed: { ...SEEN_TUTORIAL, ...RICH }, out });
    const r = await winWithHints(g);
    check('con "reducir movimiento" también se resuelve y se muestra el resultado', !!r && r.after.progress.stats.levelsSolved === 1);
    await g.shot('e8-movimiento-reducido');
    await g.close();
  }

  section('9. Distintos tamaños de pantalla');
  for (const vp of [
    { name: 'móvil pequeño 360x640', width: 360, height: 640 },
    { name: 'móvil alto 412x915', width: 412, height: 915 },
    { name: 'móvil muy alargado 360x800', width: 360, height: 800 },
    { name: 'tableta vertical 768x1024', width: 768, height: 1024 },
    { name: 'escritorio 1280x720', width: 1280, height: 720, mobile: false },
  ]) {
    const g = await openGame({ ...vp, label: vp.name, seed: SEEN_TUTORIAL, out });
    const box = await (await g.page.$('canvas')).boundingBox();
    const fits = box.x >= -1 && box.y >= -1 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1;
    check(`${vp.name}: el lienzo cabe en la pantalla`, fits, `lienzo ${Math.round(box.width)}x${Math.round(box.height)} en ${vp.width}x${vp.height}`);
    await g.tap(...g.pos.hint, 450);
    const s = await g.state();
    check(`${vp.name}: los botones responden al toque`, s.progress.sparks === 20);
    await g.shot(`e9-${vp.width}x${vp.height}`);
    await g.close();
  }

  section('10. Sonido, música, vibración y ajustes');
  {
    const g = await openGame({ label: 'sonido', seed: SEEN_TUTORIAL, out });
    let a = await g.audio();
    check('no suena nada antes del primer toque (los navegadores exigen un gesto)', a.osc === 0);

    await g.tap(...g.pos.hint, 450);
    a = await g.audio();
    check('el primer toque desbloquea el audio: suena la campanita de la pista y arranca la música', a.osc >= 10, `osciladores ${a.osc}`);
    check('la pista vibra', a.vib >= 1, `vibraciones ${a.vib}`);

    await g.page.waitForTimeout(4000);
    const m1 = (await g.audio()).osc;
    await g.page.waitForTimeout(4000);
    const m2 = (await g.audio()).osc;
    check('la música sigue sonando sola, compás tras compás', m2 > m1, `${m1} → ${m2}`);

    const before = await g.audio();
    await g.tap(200, 900, 400);
    const after = await g.audio();
    check('girar una casilla vibra', after.vib > before.vib, `${before.vib} → ${after.vib}`);

    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.shot('e10-ajustes');

    await g.tap(...g.pos.setMusic, 400);
    let s = await g.state();
    check('el interruptor de música la desactiva y lo guarda', s.settings?.musicEnabled === false);
    await g.page.waitForTimeout(1500);
    const c1 = (await g.audio()).osc;
    await g.page.waitForTimeout(4500);
    const c2 = (await g.audio()).osc;
    check('con la música desactivada se detiene (no se crean más notas)', c2 === c1, `${c1} → ${c2}`);

    await g.tap(...g.pos.setEffects, 400);
    s = await g.state();
    check('el interruptor de efectos los desactiva y lo guarda', s.settings?.soundEnabled === false);
    await g.tap(...g.pos.settingsDone, 400);
    const quiet = await g.audio();
    await g.tap(200, 900, 400);
    await g.tap(300, 1000, 400);
    const quiet2 = await g.audio();
    check('sin música ni efectos el juego es silencioso', quiet2.osc === quiet.osc, `${quiet.osc} → ${quiet2.osc}`);

    // Vibración: desactivarla bloquea la intensidad; al activarla se puede elegir
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.tap(...g.pos.setHaptics, 400);
    s = await g.state();
    check('el interruptor de vibración la desactiva y lo guarda', s.settings?.hapticsEnabled === false);
    const vOff = (await g.audio()).vib;
    await g.tap(...g.pos.levelStrong, 400);
    s = await g.state();
    check('con la vibración desactivada la intensidad no se puede cambiar', s.settings?.hapticsLevel !== 'strong');
    check('y no vibra', (await g.audio()).vib === vOff);
    await g.shot('e10-ajustes-vibracion-apagada');

    await g.tap(...g.pos.setHaptics, 400);
    const vOn = (await g.audio()).vib;
    check('al volver a activar la vibración vibra una muestra', vOn > vOff, `${vOff} → ${vOn}`);
    await g.tap(...g.pos.levelStrong, 400);
    s = await g.state();
    check('la intensidad "Fuerte" se guarda', s.settings?.hapticsLevel === 'strong');
    check('al elegir la intensidad vibra una muestra', (await g.audio()).vib > vOn);
    await g.tap(...g.pos.levelSoft, 400);
    s = await g.state();
    check('la intensidad "Suave" se guarda', s.settings?.hapticsLevel === 'soft');
    await g.shot('e10-ajustes-suave');
    await g.tap(...g.pos.settingsDone, 400);

    await g.reload();
    s = await g.state();
    check('música, efectos e intensidad persisten al recargar',
      s.settings?.musicEnabled === false && s.settings?.soundEnabled === false && s.settings?.hapticsLevel === 'soft');
    await g.close();
  }

  section('10b. La música se puede reactivar sin recargar');
  {
    const g = await openGame({ label: 'musica', seed: { user_settings: { hasSeenTutorial: true, musicEnabled: false } }, out });
    await g.tap(...g.pos.hint, 450);
    await g.page.waitForTimeout(3500);
    const quiet = (await g.audio()).osc;
    await g.page.waitForTimeout(4000);
    check('con la música desactivada de antes no suena sola', (await g.audio()).osc === quiet);
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.tap(...g.pos.setMusic, 400);
    await g.tap(...g.pos.settingsDone, 400);
    await g.page.waitForTimeout(4500);
    check('al activar la música sin recargar empieza a sonar', (await g.audio()).osc > quiet);
    await g.close();
  }

  section('11. Victoria con melodía y reinicio instantáneo');
  {
    const g = await openGame({ label: 'victoria-sonora', seed: { ...SEEN_TUTORIAL, ...RICH }, out });
    const r = await winWithHints(g);
    const a = await g.audio();
    check('la victoria hace sonar el acorde y la melodía del pulso', !!r && a.osc >= 20, `osciladores ${a.osc}`);
    check('la victoria vibra con un patrón de varios pulsos', a.vib >= (r?.hints ?? 0) + 3, `vibraciones ${a.vib} (pistas ${r?.hints})`);
    // Tocar fuera de la tarjeta de resultados pasa al siguiente nivel (tras armarse a los 0,7 s)
    await g.tap(360, 90, 800);
    const s = await g.state();
    check('tocar fuera de la tarjeta de victoria carga el siguiente nivel', s.progress.currentLevel === 2 && r.after.progress.currentLevel === 2);
    await g.shot('e11-siguiente-nivel');
    await g.close();
  }

  section('12. Estilo y volumen de la música');
  {
    const g = await openGame({ label: 'estilo', seed: SEEN_TUTORIAL, out });
    await g.tap(...g.pos.hint, 450); // primer toque: arranca la música (por defecto, swing)
    await g.page.waitForTimeout(3500);
    let a = await g.audio();
    check('el estilo por defecto es swing: usa percusión (escobillas)', a.src > 0, `fuentes de ruido ${a.src}`);

    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.shot('e12-ajustes-completos');
    let s = await g.state();
    check('los ajustes de música aún no se han tocado (usan los valores por defecto)', s.settings?.musicVolume === undefined || s.settings?.musicVolume === 100);

    // Estilo
    await g.tap(...g.pos.styleAmbient, 400);
    s = await g.state();
    check('elegir "Ambiental" lo guarda', s.settings?.musicStyle === 'ambient');
    await g.page.waitForTimeout(7000); // el cambio de estilo se aplica en el siguiente compás
    const lateA = (await g.audio()).src;
    await g.page.waitForTimeout(6000);
    check('en estilo ambiental la percusión se detiene del todo', (await g.audio()).src === lateA);
    await g.tap(...g.pos.styleSwing, 400);
    s = await g.state();
    check('volver a "Swing" lo guarda', s.settings?.musicStyle === 'swing');
    await g.page.waitForTimeout(5000);
    check('y vuelve la percusión', (await g.audio()).src > lateA);

    // Volumen: se toca la barra en distintos puntos
    await g.tap(...g.pos.volume(50), 300);
    s = await g.state();
    check('tocar la barra al 50 % guarda 50', s.settings?.musicVolume === 50, `guardado ${s.settings?.musicVolume}`);
    await g.tap(...g.pos.volume(150), 300);
    s = await g.state();
    check('tocar la barra al 150 % guarda 150 (se puede subir por encima del estándar)', s.settings?.musicVolume === 150, `guardado ${s.settings?.musicVolume}`);
    await g.tap(...g.pos.volume(200), 300);
    s = await g.state();
    check('el extremo derecho es el máximo (200 %)', s.settings?.musicVolume === 200);
    await g.tap(...g.pos.volume(0), 300);
    s = await g.state();
    check('el extremo izquierdo es el silencio (0 %)', s.settings?.musicVolume === 0);
    await g.tap(...g.pos.volume(98), 300);
    s = await g.state();
    check('cerca del 100 % la barra se pega al estándar', s.settings?.musicVolume === 100, `guardado ${s.settings?.musicVolume}`);
    await g.tap(...g.pos.volume(130), 300);
    await g.shot('e12-volumen-130');

    // Con la música apagada, estilo y volumen se bloquean
    await g.tap(...g.pos.setMusic, 400);
    await g.tap(...g.pos.volume(40), 300);
    s = await g.state();
    check('con la música apagada la barra de volumen no responde', s.settings?.musicVolume === 130, `guardado ${s.settings?.musicVolume}`);
    await g.tap(...g.pos.styleAmbient, 300);
    s = await g.state();
    check('con la música apagada el estilo no cambia', s.settings?.musicStyle === 'swing');
    await g.shot('e12-musica-apagada');
    await g.tap(...g.pos.setMusic, 400); // se vuelve a encender
    await g.tap(...g.pos.settingsDone, 400);

    await g.reload();
    s = await g.state();
    check('estilo y volumen persisten al recargar', s.settings?.musicStyle === 'swing' && s.settings?.musicVolume === 130);
    await g.close();
  }

  section('13. Ajustes de música y vibración corruptos');
  {
    const g = await openGame({
      label: 'ajustes-corruptos',
      seed: { user_settings: { hasSeenTutorial: true, musicVolume: 'muy alto', musicStyle: 'rock', hapticsMode: 'laser' } },
      out,
    });
    check('el juego arranca con ajustes de música y vibración inválidos', !!(await g.page.$('canvas')));
    await g.tap(...g.pos.hint, 450);
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.tap(...g.pos.volume(120), 300);
    const s = await g.state();
    check('y se recupera: la barra funciona con normalidad', s.settings?.musicVolume === 120, `guardado ${s.settings?.musicVolume}`);
    await g.close();
  }

  section('14. Prueba y diagnóstico de la vibración');
  {
    const g = await openGame({ label: 'diagnostico', seed: SEEN_TUTORIAL, out });
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.tap(...g.pos.diagnose, 600);
    await g.shot('e14-diagnostico');
    check('el diagnóstico se abre en el navegador sin errores', !!(await g.page.$('canvas')));
    const vib0 = (await g.audio()).vib;
    await g.tap(...g.pos.modeSystem, 500);
    let s = await g.state();
    check('elegir la vía "Sistema" la guarda', s.settings?.hapticsMode === 'system', `guardado ${s.settings?.hapticsMode}`);
    await g.tap(...g.pos.modeTouch, 500);
    s = await g.state();
    check('elegir la vía "Táctil" la guarda', s.settings?.hapticsMode === 'touch');
    await g.tap(...g.pos.modeMotor, 500);
    s = await g.state();
    check('elegir la vía "Motor" la guarda', s.settings?.hapticsMode === 'motor');
    await g.tap(...g.pos.modeAll, 500);
    s = await g.state();
    check('elegir "Auto" la guarda', s.settings?.hapticsMode === 'all');
    const vib1 = (await g.audio()).vib;
    check('al elegir una vía se hace una prueba de vibración', vib1 > vib0, `${vib0} → ${vib1}`);
    await g.tap(...g.pos.hapticsTest, 600);
    check('el botón "Probar" vibra', (await g.audio()).vib > vib1);
    await g.shot('e14-diagnostico-probado');
    await g.tap(...g.pos.hapticsDone, 400);
    await g.tap(...g.pos.settingsDone, 400);
    await g.reload();
    s = await g.state();
    check('la vía elegida persiste al recargar', s.settings?.hapticsMode === 'all');
    await g.close();
  }

  section('15. Accesibilidad: alto contraste, marcas y velocidad de animación');
  {
    const g = await openGame({ label: 'accesibilidad', seed: { user_settings: { hasSeenTutorial: true, animationSpeed: 'turbo' } }, out });
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.tap(...g.pos.accessibility, 600);
    await g.shot('e15-accesibilidad');
    let s = await g.state();
    check('con una velocidad inválida guardada el juego arranca y la tarjeta se abre', !!(await g.page.$('canvas')));
    await g.tap(...g.pos.accContrast, 700);
    s = await g.state();
    check('"Alto contraste" se guarda', s.settings?.highContrast === true);
    await g.shot('e15-alto-contraste');
    await g.tap(...g.pos.accMarks, 500);
    s = await g.state();
    check('"Marcas de energía" se guarda', s.settings?.litMarks === true);
    await g.tap(...g.pos.accOff, 500);
    s = await g.state();
    check('la velocidad "Ninguna" se guarda', s.settings?.animationSpeed === 'off', `guardado ${s.settings?.animationSpeed}`);
    await g.tap(...g.pos.accFast, 500);
    s = await g.state();
    check('la velocidad "Rápida" se guarda', s.settings?.animationSpeed === 'fast');
    await g.tap(...g.pos.accDone, 400);
    await g.tap(...g.pos.settingsDone, 400);
    // Con las marcas puestas, una pieza encendida (la fuente) debe verse con ellas; se juega con normalidad
    await g.tap(...g.pos.hint, 600);
    await g.shot('e15-juego-accesible');
    check('se puede jugar con alto contraste, marcas y animación rápida', !!(await g.page.$('canvas')));
    await g.reload();
    s = await g.state();
    check('las opciones de accesibilidad persisten al recargar', s.settings?.highContrast === true && s.settings?.litMarks === true && s.settings?.animationSpeed === 'fast');
    await g.tap(...g.pos.theme, 700);
    s = await g.state();
    check('cambiar de tema conserva el alto contraste', s.settings?.theme === 'light' && s.settings?.highContrast === true);
    await g.shot('e15-claro-alto-contraste');
    await g.close();
  }

  section('16. Idioma: español e inglés');
  {
    const g = await openGame({ label: 'idioma', seed: { user_settings: { hasSeenTutorial: true, language: 'klingon' } }, out });
    check('con un idioma inválido guardado el juego arranca', !!(await g.page.$('canvas')));
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 500);
    await g.tap(...g.pos.accessibility, 600);
    await g.tap(...g.pos.langEn, 700);
    let s = await g.state();
    check('elegir English lo guarda', s.settings?.language === 'en', `guardado ${s.settings?.language}`);
    await g.shot('e16-idioma-ingles');
    await g.tap(...g.pos.accDone, 400);
    await g.tap(...g.pos.settingsDone, 400);
    await g.tap(...g.pos.hint, 600);
    await g.shot('e16-juego-ingles');
    await g.reload();
    s = await g.state();
    check('el idioma persiste al recargar', s.settings?.language === 'en');
    await g.tap(...g.pos.stats, 500);
    await g.shot('e16-estadisticas-ingles');
    await g.tap(...g.pos.statsSettings, 500);
    await g.tap(...g.pos.accessibility, 600);
    await g.tap(...g.pos.langEs, 700);
    s = await g.state();
    check('volver a Español lo guarda', s.settings?.language === 'es');
    await g.tap(...g.pos.langAuto, 700);
    s = await g.state();
    check('Automático lo guarda', s.settings?.language === 'auto');
    await g.close();

    // En automático sigue el idioma del dispositivo
    const ctxEn = await openGame({ label: 'idioma-auto-en', seed: SEEN_TUTORIAL, out, locale: 'en-US' });
    await ctxEn.tap(...ctxEn.pos.stats, 500);
    await ctxEn.shot('e16-auto-ingles');
    check('con el dispositivo en inglés y el ajuste en automático el juego funciona', !!(await ctxEn.page.$('canvas')));
    await ctxEn.close();
  }

  section('17. Tienda de aspectos');
  {
    // Sin Chispas suficientes no se compra
    let g = await openGame({ label: 'aspectos-pobre', seed: { user_settings: { hasSeenTutorial: true } }, out });
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSkins, 600);
    await g.shot('e17-aspectos');
    await g.tap(...g.pos.skinRow(2), 600);
    let s = await g.state();
    check('sin Chispas suficientes el aspecto no se compra ni se equipa', !s.settings?.skin || s.settings.skin === 'filamento');
    check('y las Chispas no cambian', s.progress?.sparks === 30, `Chispas ${s.progress?.sparks}`);
    await g.shot('e17-faltan-chispas');
    await g.close();

    // Con Chispas: compra, equipa, persiste y se puede cambiar de aspecto gratis una vez comprado
    g = await openGame({ label: 'aspectos', seed: { ...SEEN_TUTORIAL, ...RICH }, out });
    const before = (await g.state()).progress.sparks;
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSkins, 600);
    await g.tap(...g.pos.skinRow(1), 800);
    s = await g.state();
    check('comprar Cyberpunk lo equipa', s.settings?.skin === 'cyberpunk', `aspecto ${s.settings?.skin}`);
    check('descuenta 150 Chispas', s.progress?.sparks === before - 150, `${before} → ${s.progress?.sparks}`);
    check('queda registrado como comprado', s.progress?.unlockedSkins?.includes('cyberpunk'));
    await g.shot('e17-cyberpunk');
    await g.tap(...g.pos.skinRow(4), 800);
    s = await g.state();
    check('comprar Solar también funciona', s.settings?.skin === 'solar' && s.progress.unlockedSkins.includes('solar'));
    await g.tap(...g.pos.skinRow(5), 800);
    s = await g.state();
    check('comprar Aurora (la sexta fila) también funciona', s.settings?.skin === 'aurora' && s.progress.unlockedSkins.includes('aurora'));
    await g.shot('e17-aurora');
    await g.tap(...g.pos.skinRow(1), 800);
    s = await g.state();
    check('volver a un aspecto comprado es gratis', s.settings?.skin === 'cyberpunk' && s.progress.sparks === before - 150 - 800 - 1000);
    await g.tap(...g.pos.skinRow(0), 800);
    s = await g.state();
    check('el aspecto inicial se puede volver a equipar', s.settings?.skin === 'filamento');
    await g.tap(...g.pos.skinRow(2), 800);
    await g.shot('e17-matrix');
    await g.tap(...g.pos.skinsDone, 500);
    await g.tap(...g.pos.hint, 600);
    await g.shot('e17-juego-matrix');
    await g.reload();
    s = await g.state();
    check('el aspecto equipado persiste al recargar', s.settings?.skin === 'matrix');
    await g.tap(...g.pos.theme, 700);
    await g.shot('e17-matrix-claro');
    await g.close();

    // Un aspecto guardado que no se ha comprado no se usa
    g = await openGame({ label: 'aspectos-trampa', seed: { user_settings: { hasSeenTutorial: true, skin: 'solar' } }, out });
    check('un aspecto no comprado guardado en los ajustes no rompe el juego', !!(await g.page.$('canvas')));
    await g.shot('e17-sin-comprar');
    await g.close();
  }

  section('18. Aviso de versión nueva');
  {
    const feed = (tag) => JSON.stringify([{ tag_name: tag, html_url: `https://github.com/DaManu123/lumihilo/releases/tag/${tag}`, draft: false }]);
    // Las dos fuentes de la lista de versiones: el archivo de la web y la API de GitHub
    const mock = (body, status = 200) => async (page) => {
      for (const pattern of ['https://damanu123.github.io/lumihilo/releases.json*', 'https://api.github.com/**']) {
        await page.route(pattern, (route) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body }));
      }
      await page.addInitScript(() => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return null; }; });
    };
    const scene = '(window.__game.scene.scenes.find((sc) => sc.handleCellTap))';
    const cardOpen = (g) => g.page.evaluate(`${scene}.children.getAll().some((o) => (o.depth ?? 0) >= 100 && o.type !== 'Text')`);
    const texts = (g) => g.page.evaluate(`(function walk(list) { return list.flatMap((o) => [o.type === 'Text' ? o.text : '', ...(o.list ? walk(o.list) : [])]); })(${scene}.children.getAll()).join(' | ')`);
    // En el navegador de pruebas (WebGL por software) el juego corre más lento que el reloj: se espera a que la
    // comprobación (un temporizador de 3 s del juego) haya terminado de verdad y a que llegue su respuesta.
    const settle = async (g) => {
      await g.page.waitForFunction(() => !window.__game.scene.scenes.find((sc) => sc.handleCellTap).time._active.some((e) => e.delay === 3000), null, { timeout: 60000 });
      await g.page.waitForTimeout(1500);
    };
    const open = (body, status) => openGame({ label: 'actualizacion', seed: SEEN_TUTORIAL, out, query: '?debug&update', beforeLoad: mock(body, status) });

    let g = await open(feed('v99.0.0'));
    await settle(g);
    check('con una versión más nueva se muestra el aviso', await cardOpen(g));
    await g.shot('e18-aviso-actualizacion');
    await g.tap(...g.pos.updateLater, 500);
    check('"Ahora no" cierra el aviso y se puede seguir jugando', !(await cardOpen(g)));
    await g.tap(...g.pos.hint, 450);
    let s = await g.state();
    check('el juego sigue funcionando tras rechazar', s.progress.sparks < 30);
    await g.page.reload();
    await g.page.waitForSelector('canvas');
    await settle(g);
    check('al cerrar la app del todo y abrirla otra vez vuelve a preguntar', await cardOpen(g));
    await g.tap(...g.pos.updateNow, 500);
    const opened = await g.page.evaluate(() => window.__opened);
    check('"Actualizar" abre la página de la versión', opened.length === 1 && opened[0].includes('v99.0.0'), JSON.stringify(opened));
    await g.close();

    g = await open(feed('v0.0.1'));
    await settle(g);
    check('con una versión igual o más vieja no avisa', !(await cardOpen(g)));
    // Buscar a mano: dice que estás al día
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 600);
    await g.tap(...g.pos.settingsUpdates, 900);
    check('«Buscar actualizaciones» dice que ya tienes la última versión', (await texts(g)).includes('Ya tienes la última versión'), await texts(g));
    await g.shot('e18-al-dia');
    await g.close();

    g = await open(feed('v99.0.0'));
    await settle(g);
    await g.tap(...g.pos.updateLater, 500);
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 600);
    await g.tap(...g.pos.settingsUpdates, 900);
    check('«Buscar actualizaciones» vuelve a ofrecer la versión nueva', await cardOpen(g));
    await g.close();

    g = await open('{"message":"rate limit"}', 403);
    await settle(g);
    check('si las dos fuentes fallan, no avisa ni rompe nada', !(await cardOpen(g)) && !!(await g.page.$('canvas')));
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.statsSettings, 600);
    await g.tap(...g.pos.settingsUpdates, 900);
    const failure = await texts(g);
    check('«Buscar actualizaciones» explica por qué falló', failure.includes('No se pudo consultar') && failure.includes('HTTP 403'), failure);
    await g.shot('e18-fallo');
    await g.close();

    // Si falla la primera fuente (la web), usa la segunda (la API)
    let apiHits = 0;
    g = await openGame({
      label: 'actualizacion-respaldo', seed: SEEN_TUTORIAL, out, query: '?debug&update',
      beforeLoad: async (page) => {
        await page.route('https://damanu123.github.io/lumihilo/releases.json*', (route) => route.fulfill({ status: 404, body: 'no' }));
        await page.route('https://api.github.com/**', (route) => { apiHits++; route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: feed('v99.0.0') }); });
      },
    });
    await settle(g);
    check('si falla el archivo de la web, usa la API de GitHub', apiHits >= 1 && (await cardOpen(g)), `${apiHits} consultas a la API`);
    await g.close();

    let requests = 0;
    g = await openGame({
      label: 'actualizacion-web',
      seed: SEEN_TUTORIAL,
      out,
      query: '?debug',
      beforeLoad: async (page) => {
        for (const pattern of ['https://damanu123.github.io/lumihilo/releases.json*', 'https://api.github.com/**']) await page.route(pattern, (route) => { requests++; route.abort(); });
      },
    });
    await settle(g);
    check('la versión web normal no consulta nada', requests === 0, `${requests} consultas`);
    await g.close();
  }

  section('19. Segundo puzzle: Luces');
  {
    const scene = '(window.__game.scene.scenes.find((sc) => sc.handleCellTap))';
    const texts = (g) => g.page.evaluate(`(function walk(list) { return list.flatMap((o) => [o.type === 'Text' ? o.text : '', ...(o.list ? walk(o.list) : [])]); })(${scene}.children.getAll()).join(' | ')`);
    const lightsState = (g) => g.page.evaluate(`(() => { const sc = ${scene}; return { grid: sc.lightGrid.map((r) => [...r]), puzzle: sc.puzzle, minTaps: sc.currentLevelData.minTaps, views: sc.cellViews.map((row) => row.map((v) => ({ x: v.container.x, y: v.container.y }))) }; })()`);
    const SEEN = { hasSeenTutorial: true, hasSeenLightsTip: true };
    let g = await openGame({ label: 'luces', seed: { user_settings: { hasSeenTutorial: true }, ...RICH }, out, query: '?debug' });
    await g.tap(...g.pos.stats, 500);
    await g.shot('e19-estadisticas-puzzle');
    await g.tap(...g.pos.puzzleLights, 900);
    let s = await g.state();
    check('elegir Luces lo guarda', s.settings?.puzzle === 'lights', `guardado ${s.settings?.puzzle}`);

    // Mini tutorial: sale la primera vez, se cierra con «Entendido» y no vuelve solo
    check('la primera vez en Luces sale el mini tutorial', (await texts(g)).includes('Cómo se juega Luces'));
    await g.page.waitForTimeout(1500);
    await g.shot('e19-tutorial-luces');
    await g.page.waitForTimeout(1500);
    await g.shot('e19-tutorial-luces-2');
    await g.tap(...g.pos.lightsTutorialOk, 500);
    s = await g.state();
    check('«Entendido» cierra el tutorial y lo anota', !(await texts(g)).includes('Cómo se juega Luces') && s.settings?.hasSeenLightsTip === true);
    check('el panel cuenta las luces encendidas', /\d+ de \d+ luces encendidas/.test(await texts(g)), await texts(g));
    await g.tap(...g.pos.lightsPanel, 500);
    check('tocar el panel de luces vuelve a mostrar el tutorial', (await texts(g)).includes('Cómo se juega Luces'));
    await g.tap(...g.pos.lightsTutorialOk, 500);
    // Cambiar a Circuitos y volver a Luces no repite el tutorial
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.puzzleCircuits, 900);
    await g.tap(...g.pos.stats, 500);
    await g.tap(...g.pos.puzzleLights, 900);
    check('volver a Luces no repite el tutorial', !(await texts(g)).includes('Cómo se juega Luces'));

    let st = await lightsState(g);
    check('el tablero de Luces está en marcha', st.puzzle === 'lights' && st.grid.length >= 3);
    check('no nace resuelto', st.grid.some((row) => row.some((on) => !on)));
    await g.shot('e19-luces');

    // Un toque cambia la casilla y sus vecinas
    const [r, c] = [1, 1];
    const before = st.grid.map((row) => [...row]);
    await g.tap(st.views[r][c].x, st.views[r][c].y, 500);
    st = await lightsState(g);
    const changed = [];
    st.grid.forEach((row, rr) => row.forEach((on, cc) => { if (on !== before[rr][cc]) changed.push(`${rr},${cc}`); }));
    check('un toque cambia la casilla y sus cuatro vecinas', changed.sort().join('|') === ['0,1', '1,0', '1,1', '1,2', '2,1'].sort().join('|'), changed.join(' '));

    // Deshacer lo revierte
    await g.tap(...g.pos.undo, 500);
    st = await lightsState(g);
    check('deshacer devuelve el tablero a como estaba', JSON.stringify(st.grid) === JSON.stringify(before));

    // Resolver con pistas gana, cobra Chispas, y sube el nivel de Luces (no el de Circuitos)
    const start = (await g.state()).progress;
    const result = await winWithHints(g);
    check('las pistas resuelven el nivel de Luces', !!result);
    s = await g.state();
    check('sube el nivel de Luces y no el de Circuitos', s.progress.lightsLevel === 2 && s.progress.currentLevel === start.currentLevel, `luces ${s.progress.lightsLevel}, circuitos ${s.progress.currentLevel}`);
    check('cuenta como nivel resuelto', s.progress.stats.levelsSolved === start.stats.levelsSolved + 1);
    await g.shot('e19-luces-victoria');
    await g.reload();
    s = await g.state();
    check('al recargar sigue en Luces', s.settings?.puzzle === 'lights');
    await g.close();

    // Sin Chispas la pista de Luces no se cobra ni juega por ti
    g = await openGame({ label: 'luces-pobre', seed: { user_settings: { ...SEEN, puzzle: 'lights' }, player_progress: { ...RICH.player_progress, sparks: 5 } }, out, query: '?debug' });
    st = await lightsState(g);
    await g.tap(...g.pos.hint, 500);
    const after = await lightsState(g);
    check('sin Chispas la pista no toca nada', JSON.stringify(after.grid) === JSON.stringify(st.grid));
    check('y no cobra', (await g.state()).progress.sparks === 5);

    // El reto diario es de Circuitos: desde Luces cambia de puzzle
    await g.tap(...g.pos.daily, 800);
    s = await g.state();
    check('el reto diario cambia a Circuitos', s.settings?.puzzle === 'circuits');
    await g.shot('e19-diario-desde-luces');
    await g.close();

    // Abrir la app directamente en Luces por primera vez también muestra el tutorial
    g = await openGame({ label: 'luces-directo', seed: { user_settings: { hasSeenTutorial: true, puzzle: 'lights' } }, out, query: '?debug' });
    check('si la app abre en Luces y no se vio el tutorial, sale', (await texts(g)).includes('Cómo se juega Luces'));
    await g.close();

    // Con aspecto, en claro y con alto contraste, Luces se dibuja sin errores
    for (const [label, settings] of [['cyberpunk', { skin: 'cyberpunk' }], ['oceano-claro', { skin: 'oceano', theme: 'light' }], ['matrix-hc', { skin: 'matrix', highContrast: true, litMarks: true }], ['solar', { skin: 'solar' }], ['aurora', { skin: 'aurora' }], ['aurora-claro-hc', { skin: 'aurora', theme: 'light', highContrast: true }], ['filamento-claro', { theme: 'light' }]]) {
      const skin = settings.skin;
      g = await openGame({ label: 'luces-' + label, seed: { user_settings: { ...SEEN, puzzle: 'lights', ...settings }, player_progress: { ...RICH.player_progress, unlockedSkins: skin ? [skin] : [] } }, out, query: '?debug' });
      st = await lightsState(g);
      await g.tap(st.views[0][0].x, st.views[0][0].y, 400);
      await g.shot('e19-luces-' + label);
      check(`Luces con ${label} se dibuja`, !!(await g.page.$('canvas')));
      await g.close();
    }

    // Un puzzle guardado que no existe no rompe el juego
    g = await openGame({ label: 'luces-invalido', seed: { user_settings: { hasSeenTutorial: true, puzzle: 'ajedrez' } }, out });
    check('un puzzle inválido guardado cae en Circuitos', !!(await g.page.$('canvas')));
    await g.close();
  }

  section('Errores de consola durante toda la batería');
  const real = consoleErrors.filter((e) => !/WebGL|GPU stall|swiftshader|AudioContext|status of 403|status of 404/i.test(e));
  check('sin errores de JavaScript ni de consola', real.length === 0, real.slice(0, 3).join(' | '));
}
