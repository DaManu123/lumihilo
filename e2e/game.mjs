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
    check('elegir "Todos" la guarda', s.settings?.hapticsMode === 'all');
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

  section('Errores de consola durante toda la batería');
  const real = consoleErrors.filter((e) => !/WebGL|GPU stall|swiftshader|AudioContext/i.test(e));
  check('sin errores de JavaScript ni de consola', real.length === 0, real.slice(0, 3).join(' | '));
}
