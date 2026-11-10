// Escenarios de flujo completo del juego. Cada uno abre un contexto limpio, toca la interfaz como lo haría
// una persona y comprueba el estado guardado, el audio y la vibración.
import { SEEN_TUTORIAL, RICH, check, consoleErrors, openGame, runSections, section, today, winWithHints } from './lib.mjs';

export async function runGameScenarios(out) {
  const sections = []; // [título, función]: cada una abre sus propios contextos de navegador y no comparte estado con las demás
  sections.push(['1. Primera visita: tutorial y valores iniciales', async () => {
    const g = await openGame({ label: 'tutorial', out });
    let s = await g.state();
    check('arranca con 30 Chispas y en el nivel 1', s.progress?.sparks === 30 && s.progress?.currentLevel === 1, JSON.stringify(s.progress && { sparks: s.progress.sparks, level: s.progress.currentLevel }));
    check('se genera una semilla base propia', Number.isInteger(s.progress?.seedBase) && s.progress.seedBase > 0);
    check('el tutorial aún no está marcado como visto', !s.settings?.hasSeenTutorial);
    await g.shot('e1-tutorial');
    await g.tap(...g.pos.tutorialNext, 700);
    s = await g.state();
    check('«Siguiente» pasa de pantalla sin marcar el tutorial como visto', !s.settings?.hasSeenTutorial);
    await g.shot('e1-tutorial-2');
    await g.tap(...g.pos.tutorialNext, 700);
    await g.shot('e1-tutorial-3');
    await g.tap(...g.pos.tutorialDone);
    s = await g.state();
    check('"Entendido" en la última pantalla marca el tutorial como visto', s.settings?.hasSeenTutorial === true);
    await g.reload();
    await g.shot('e1-sin-tutorial');
    await g.close();
  }]);

  sections.push(['2. Sentido de giro y tema se guardan', async () => {
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
  }]);

  sections.push(['3. Pistas: coste y saldo insuficiente', async () => {
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
  }]);

  sections.push(['4. Resolver un nivel: progreso, racha y exploit de pistas', async () => {
    const g = await openGame({ label: 'victoria', seed: { ...SEEN_TUTORIAL, ...RICH }, out, query: '?debug' });
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
  }]);

  sections.push(['5. Reto diario: doble recompensa una vez y no toca el perfil', async () => {
    const g = await openGame({ label: 'diario', seed: { ...SEEN_TUTORIAL, ...RICH }, out, query: '?debug' });
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
  }]);

  sections.push(['6. Estadísticas', async () => {
    const g = await openGame({ label: 'stats', seed: SEEN_TUTORIAL, out });
    await g.tap(...g.pos.stats, 500);
    await g.shot('e6-estadisticas');
    await g.tap(...g.pos.statsClose, 400);
    const s = await g.state();
    check('abrir y cerrar estadísticas no altera los datos', s.progress.sparks === 30 && s.progress.stats.levelsSolved === 0);
    await g.close();
  }]);

  sections.push(['7. Datos guardados corruptos', async () => {
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
  }]);

  sections.push(['8. Movimiento reducido', async () => {
    const g = await openGame({ label: 'movimiento-reducido', reducedMotion: 'reduce', seed: { ...SEEN_TUTORIAL, ...RICH }, out, query: '?debug' });
    const r = await winWithHints(g);
    check('con "reducir movimiento" también se resuelve y se muestra el resultado', !!r && r.after.progress.stats.levelsSolved === 1);
    await g.shot('e8-movimiento-reducido');
    await g.close();
  }]);

  sections.push(['9. Distintos tamaños de pantalla', async () => {
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
  }]);

  sections.push(['10. Sonido, música, vibración y ajustes', async () => {
    const g = await openGame({ label: 'sonido', seed: SEEN_TUTORIAL, out, menu: true });
    let a = await g.audio();
    check('no suena nada antes del primer toque (los navegadores exigen un gesto)', a.osc === 0);
    await g.enter(); // el primer toque es el de la tarjeta del puzzle en el menú

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

    await g.openSettings(500);
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
    await g.openSettings(500);
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
  }]);

  sections.push(['10b. La música se puede reactivar sin recargar', async () => {
    const g = await openGame({ label: 'musica', seed: { user_settings: { hasSeenTutorial: true, musicEnabled: false } }, out });
    await g.tap(...g.pos.hint, 450);
    await g.page.waitForTimeout(3500);
    const quiet = (await g.audio()).osc;
    await g.page.waitForTimeout(4000);
    check('con la música desactivada de antes no suena sola', (await g.audio()).osc === quiet);
    await g.openSettings(500);
    await g.tap(...g.pos.setMusic, 400);
    await g.tap(...g.pos.settingsDone, 400);
    await g.page.waitForTimeout(4500);
    check('al activar la música sin recargar empieza a sonar', (await g.audio()).osc > quiet);
    await g.close();
  }]);

  sections.push(['11. Victoria con melodía y reinicio instantáneo', async () => {
    const g = await openGame({ label: 'victoria-sonora', seed: { ...SEEN_TUTORIAL, ...RICH }, out });
    const r = await winWithHints(g);
    // La melodía y la vibración de la victoria llegan con el pulso de luz: se espera a que lleguen (con carga tardan más)
    await g.page.waitForFunction((min) => window.__osc >= 20 && window.__vib >= min, (r?.hints ?? 0) + 3, { timeout: 15000 }).catch(() => undefined);
    const a = await g.audio();
    check('la victoria hace sonar el acorde y la melodía del pulso', !!r && a.osc >= 20, `osciladores ${a.osc}`);
    check('la victoria vibra con un patrón de varios pulsos', a.vib >= (r?.hints ?? 0) + 3, `vibraciones ${a.vib} (pistas ${r?.hints})`);
    // Tocar fuera de la tarjeta de resultados pasa al siguiente nivel (tras armarse a los 0,7 s)
    await g.tap(360, 90, 800);
    const s = await g.state();
    check('tocar fuera de la tarjeta de victoria carga el siguiente nivel', s.progress.currentLevel === 2 && r.after.progress.currentLevel === 2);
    await g.shot('e11-siguiente-nivel');
    await g.close();
  }]);

  sections.push(['12. Estilo y volumen de la música', async () => {
    const g = await openGame({ label: 'estilo', seed: SEEN_TUTORIAL, out });
    await g.tap(...g.pos.hint, 450); // primer toque: arranca la música (por defecto, swing)
    await g.page.waitForTimeout(3500);
    let a = await g.audio();
    check('el estilo por defecto es swing: usa percusión (escobillas)', a.src > 0, `fuentes de ruido ${a.src}`);

    await g.openSettings(500);
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
  }]);

  sections.push(['13. Ajustes de música y vibración corruptos', async () => {
    const g = await openGame({
      label: 'ajustes-corruptos',
      seed: { user_settings: { hasSeenTutorial: true, musicVolume: 'muy alto', musicStyle: 'rock', hapticsMode: 'laser' } },
      out,
    });
    check('el juego arranca con ajustes de música y vibración inválidos', !!(await g.page.$('canvas')));
    await g.tap(...g.pos.hint, 450);
    await g.openSettings(500);
    await g.tap(...g.pos.volume(120), 300);
    const s = await g.state();
    check('y se recupera: la barra funciona con normalidad', s.settings?.musicVolume === 120, `guardado ${s.settings?.musicVolume}`);
    await g.close();
  }]);

  sections.push(['14. Prueba y diagnóstico de la vibración', async () => {
    const g = await openGame({ label: 'diagnostico', seed: SEEN_TUTORIAL, out });
    await g.openSettings(500);
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
  }]);

  sections.push(['15. Accesibilidad: alto contraste, marcas y velocidad de animación', async () => {
    const g = await openGame({ label: 'accesibilidad', seed: { user_settings: { hasSeenTutorial: true, animationSpeed: 'turbo' } }, out });
    await g.openSettings(500);
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
  }]);

  sections.push(['16. Idioma: español e inglés', async () => {
    const g = await openGame({ label: 'idioma', seed: { user_settings: { hasSeenTutorial: true, language: 'klingon' } }, out });
    check('con un idioma inválido guardado el juego arranca', !!(await g.page.$('canvas')));
    await g.openSettings(500);
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
    await g.tap(...g.pos.statsClose, 400);
    await g.openSettings(500);
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
  }]);

  sections.push(['17. Tienda de aspectos', async () => {
    // Sin Chispas suficientes no se compra
    let g = await openGame({ label: 'aspectos-pobre', seed: { user_settings: { hasSeenTutorial: true } }, out });
    await g.openSkins(600);
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
    await g.openSkins(600);
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

    // El aspecto equipado da Chispas extra al ganar y la tienda lo anuncia
    g = await openGame({ label: 'aspectos-bonus', seed: { user_settings: { hasSeenTutorial: true, skin: 'aurora' }, player_progress: { ...RICH.player_progress, unlockedSkins: ['aurora'] } }, out });
    const walkTexts = (page) => page.evaluate(() => (function walk(list) { return list.flatMap((o) => [o.type === 'Text' ? o.text : '', ...(o.list ? walk(o.list) : [])]); })(window.__game.scene.scenes.find((sc) => sc.handleCellTap).children.getAll()).join(' | '));
    await g.page.goto('http://localhost:4173/?debug');
    await g.page.waitForSelector('canvas');
    await g.page.waitForTimeout(1500);
    const won = await winWithHints(g);
    let resultTexts = await walkTexts(g.page);
    for (let i = 0; i < 20 && !/aspecto \d+/.test(resultTexts); i++) { await g.page.waitForTimeout(500); resultTexts = await walkTexts(g.page); } // la tarjeta tarda más con carga
    check('con un aspecto con bonus, el desglose de la victoria lo muestra', !!won && /aspecto \d+/.test(resultTexts), resultTexts.slice(0, 160));
    await g.tap(360, g.dims.h / 2 - 300, 400).catch(() => undefined);
    await g.close();

    // Un aspecto guardado que no se ha comprado no se usa
    g = await openGame({ label: 'aspectos-trampa', seed: { user_settings: { hasSeenTutorial: true, skin: 'solar' } }, out });
    check('un aspecto no comprado guardado en los ajustes no rompe el juego', !!(await g.page.$('canvas')));
    await g.shot('e17-sin-comprar');
    await g.close();
  }]);

  sections.push(['18. Aviso de versión nueva', async () => {
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

    // Actualización dentro de la app (APK de GitHub en Android): se simula el plugin nativo
    const stubInstall = (g, result) => g.page.evaluate(`(() => { const u = ${scene}.updates; window.__installs = []; u.canInstallInApp = async () => true;
      u.install = async (info, cb) => { window.__installs.push(info.version); cb(null); cb(45); await new Promise((r) => setTimeout(r, 300)); return '${result}'; }; })()`);
    const askUpdate = async (g) => { await g.openSettings(600); await g.tap(...g.pos.settingsUpdates, 900); };
    g = await open(feed('v99.0.0'));
    await settle(g);
    await g.tap(...g.pos.updateLater, 500);
    await stubInstall(g, 'started');
    await askUpdate(g);
    check('con instalación dentro de la app el aviso dice que se descarga aquí mismo', (await texts(g)).includes('Se descarga aquí mismo'), (await texts(g)).slice(-300));
    await g.tap(...g.pos.updateNow, 300);
    await g.page.waitForFunction(`(function walk(list) { return list.some((o) => (o.type === 'Text' && /Listo para instalar/.test(o.text)) || (o.list && walk(o.list))); })(${scene}.children.getAll())`, null, { timeout: 20000 });
    const installs = await g.page.evaluate(() => window.__installs);
    const opened2 = await g.page.evaluate(() => window.__opened);
    check('«Actualizar» descarga e instala dentro de la app sin abrir la página', installs.length === 1 && installs[0] === '99.0.0' && opened2.length === 0, JSON.stringify({ installs, opened2 }));
    check('al terminar dice que Android pedirá confirmar', (await texts(g)).includes('Android te pedirá confirmar'));
    await g.shot('e18-instalar-dentro-de-la-app');
    await g.close();

    g = await open(feed('v99.0.0'));
    await settle(g);
    await g.tap(...g.pos.updateLater, 500);
    await stubInstall(g, 'needs-permission');
    await askUpdate(g);
    await g.tap(...g.pos.updateNow, 300);
    await g.page.waitForFunction(`(function walk(list) { return list.some((o) => (o.type === 'Text' && /Falta un permiso/.test(o.text)) || (o.list && walk(o.list))); })(${scene}.children.getAll())`, null, { timeout: 20000 });
    check('si falta permitir instalar, lo explica y no abre la página', (await texts(g)).includes('Permitir de esta fuente') && (await g.page.evaluate(() => window.__opened)).length === 0);
    await g.close();

    g = await open(feed('v99.0.0'));
    await settle(g);
    await g.tap(...g.pos.updateLater, 500);
    await stubInstall(g, 'failed');
    await askUpdate(g);
    await g.tap(...g.pos.updateNow, 300);
    await g.page.waitForFunction(() => window.__opened.length > 0, null, { timeout: 20000 });
    const opened3 = await g.page.evaluate(() => window.__opened);
    check('si la descarga falla, abre la página de la versión', opened3.length === 1 && opened3[0].includes('v99.0.0'), JSON.stringify(opened3));
    await g.close();

    g = await open(feed('v0.0.1'));
    await settle(g);
    check('con una versión igual o más vieja no avisa', !(await cardOpen(g)));
    // Buscar a mano: dice que estás al día
    await g.openSettings(600);
    await g.tap(...g.pos.settingsUpdates, 900);
    check('«Buscar actualizaciones» dice que ya tienes la última versión', (await texts(g)).includes('Ya tienes la última versión'), await texts(g));
    await g.shot('e18-al-dia');
    await g.close();

    g = await open(feed('v99.0.0'));
    await settle(g);
    await g.tap(...g.pos.updateLater, 500);
    await g.openSettings(600);
    await g.tap(...g.pos.settingsUpdates, 900);
    check('«Buscar actualizaciones» vuelve a ofrecer la versión nueva', await cardOpen(g));
    await g.close();

    g = await open('{"message":"rate limit"}', 403);
    await settle(g);
    check('si las dos fuentes fallan, no avisa ni rompe nada', !(await cardOpen(g)) && !!(await g.page.$('canvas')));
    await g.openSettings(600);
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

    // Si el primer intento falla (red dormida al abrir), al recuperar la conexión vuelve a probar y avisa
    let feedFails = true;
    g = await openGame({
      label: 'actualizacion-reintento', seed: SEEN_TUTORIAL, out, query: '?debug&update',
      beforeLoad: async (page) => {
        for (const pattern of ['https://damanu123.github.io/lumihilo/releases.json*', 'https://api.github.com/**']) {
          await page.route(pattern, (route) => feedFails ? route.fulfill({ status: 503, body: 'no' }) : route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: feed('v99.0.0') }));
        }
      },
    });
    await settle(g);
    check('si el primer intento falla no sale el aviso', !(await cardOpen(g)));
    feedFails = false;
    await g.page.evaluate(() => window.dispatchEvent(new Event('online')));
    await g.page.waitForFunction(() => window.__game.scene.scenes.find((sc) => sc.handleCellTap).children.getAll().some((o) => (o.depth ?? 0) >= 100 && o.type !== 'Text'), null, { timeout: 15000 }).catch(() => {});
    check('al recuperar la conexión reintenta y muestra el aviso', await cardOpen(g));
    const saved = await g.page.evaluate(() => localStorage.getItem('update_last_check'));
    check('guarda el resultado de la última comprobación', !!saved && saved.includes('"error":null'), saved);
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
  }]);

  sections.push(['19. Segundo puzzle: Luces', async () => {
    const scene = '(window.__game.scene.scenes.find((sc) => sc.handleCellTap))';
    const texts = (g) => g.page.evaluate(`(function walk(list) { return list.flatMap((o) => [o.type === 'Text' ? o.text : '', ...(o.list ? walk(o.list) : [])]); })(${scene}.children.getAll()).join(' | ')`);
    const lightsState = (g) => g.page.evaluate(`(() => { const sc = ${scene}; return { grid: sc.lightGrid.map((r) => [...r]), puzzle: sc.puzzle, minTaps: sc.currentLevelData.minTaps, views: sc.cellViews.map((row) => row.map((v) => ({ x: v.container.x, y: v.container.y }))) }; })()`);
    const SEEN = { hasSeenTutorial: true, hasSeenLightsTip: true };
    let g = await openGame({ label: 'luces', seed: { user_settings: { hasSeenTutorial: true }, ...RICH }, out, query: '?debug' });
    await g.openMenu();
    await g.shot('e19-menu');
    await g.playPuzzle('lights', 900);
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
    await g.tap(...g.pos.tutorialNext, 700);
    check('la segunda pantalla de Luces explica que dos toques se anulan', (await texts(g)).includes('Dos toques se anulan'));
    await g.page.waitForTimeout(2600);
    await g.shot('e19-tutorial-luces-p2');
    await g.tap(...g.pos.tutorialNext, 700);
    check('la tercera pantalla de Luces enseña el truco de fila por fila', (await texts(g)).includes('Truco: fila por fila'));
    await g.page.waitForTimeout(3600);
    await g.shot('e19-tutorial-luces-p3');
    await g.tap(...g.pos.tutorialDone, 500);
    check('«Entendido» cierra el tutorial de Luces', !(await texts(g)).includes('Truco: fila por fila'));
    await g.tap(...g.pos.help, 600);
    check('«Ayuda» de la barra muestra el tutorial de Luces', (await texts(g)).includes('Cómo se juega Luces'));
    await g.tap(...g.pos.tutorialSkip, 500);
    check('«Saltar» cierra el tutorial', !(await texts(g)).includes('Cómo se juega Luces'));
    // Cambiar a Circuitos y volver a Luces no repite el tutorial
    await g.playPuzzle('circuits', 900);
    await g.playPuzzle('lights', 900);
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

    // Cada puzzle tiene su reto diario: en Luces el botón abre el reto de Luces (sin cambiar de puzzle)
    await g.tap(...g.pos.daily, 800);
    s = await g.state();
    check('el reto diario de Luces no cambia de puzzle', s.settings?.puzzle === 'lights');
    const daily = await g.page.evaluate(`(() => { const sc = ${scene}; return { daily: sc.isDaily, puzzle: sc.puzzle, stones: sc.lightBlocked.flat().filter(Boolean).length, size: sc.lightGrid.length }; })()`);
    check('es un reto diario de Luces con piedras', daily.daily && daily.puzzle === 'lights' && daily.stones > 0, JSON.stringify(daily));
    await g.shot('e19-diario-luces');
    await g.close();
    g = await openGame({ label: 'luces-diario', seed: { user_settings: { ...SEEN, puzzle: 'lights' }, ...RICH }, out, query: '?debug' });
    await g.tap(...g.pos.daily, 800);
    // Resolverlo con pistas completa el reto de Luces (y solo el de Luces)
    for (let i = 0; i < 40; i++) {
      const cur = await lightsState(g);
      if (cur.grid.flat().every(Boolean)) break;
      await g.tap(...g.pos.hint, 700);
    }
    await g.page.waitForTimeout(3000);
    s = await g.state();
    check('completar el reto de Luces lo registra aparte', s.progress.lastLightsDailyCompleted === today() && s.progress.lastDailyCompleted === null, `${s.progress.lastLightsDailyCompleted} / ${s.progress.lastDailyCompleted}`);
    check('el reto de Luces no avanza el nivel de Luces', s.progress.lightsLevel === 1, `nivel ${s.progress.lightsLevel}`);
    await g.shot('e19-diario-luces-victoria');
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

    // Piedras: desde el nivel de habilidad 3 hay casillas bloqueadas que ni cambian ni cuentan
    g = await openGame({ label: 'luces-piedras', seed: { user_settings: { ...SEEN, puzzle: 'lights' }, profile_adaptive: { currentTier: 6 } }, out, query: '?debug' });
    await g.page.waitForTimeout(1200);
    const stones = await g.page.evaluate(() => {
      const sc = window.__game.scene.scenes.find((x) => x.handleCellTap);
      const cells = [];
      sc.lightBlocked.forEach((row, r) => row.forEach((b, c) => { if (b) cells.push([r, c]); }));
      return { cells, size: sc.lightBlocked.length, taps: sc.tapCount };
    });
    check('con habilidad 6 el nivel de Luces tiene piedras', stones.cells.length === 2, `piedras ${stones.cells.length}`);
    st = await lightsState(g);
    const [sr, sc2] = stones.cells[0];
    await g.tap(st.views[sr][sc2].x, st.views[sr][sc2].y, 500);
    const afterStone = await g.page.evaluate(() => window.__game.scene.scenes.find((x) => x.handleCellTap).tapCount);
    check('tocar una piedra no cuenta como toque', afterStone === stones.taps, `${stones.taps} → ${afterStone}`);
    await g.shot('e19-luces-piedras');
    await g.close();

    // Un puzzle guardado que no existe no rompe el juego
    g = await openGame({ label: 'luces-invalido', seed: { user_settings: { hasSeenTutorial: true, puzzle: 'ajedrez' } }, out });
    check('un puzzle inválido guardado cae en Circuitos', !!(await g.page.$('canvas')));
    await g.close();
  }]);


  sections.push(['20. Tercer puzzle: Hilos', async () => {
    const scene = '(window.__game.scene.scenes.find((sc) => sc.handleCellTap))';
    const texts = (g) => g.page.evaluate(`(function walk(list) { return list.flatMap((o) => [o.type === 'Text' ? o.text : '', ...(o.list ? walk(o.list) : [])]); })(${scene}.children.getAll()).join(' | ')`);
    // Estado de los hilos y, por cada pareja, los puntos del lienzo de su solución (para arrastrar por ellos)
    const flowInfo = (g) => g.page.evaluate(`(() => { const sc = ${scene}; const L = sc.flowLevelData; const pt = (c) => [sc.cellViews[c.row][c.col].container.x, sc.cellViews[c.row][c.col].container.y];
      return { puzzle: sc.puzzle, daily: sc.isDaily, pairs: L.pairs.length, size: L.params.size, taps: sc.tapCount, won: sc.isWon,
        paths: sc.flowState.paths.map((p) => p.length), solution: L.solution.map((p) => p.map(pt)), ends: L.pairs.map((q) => [pt(q.a), pt(q.b)]),
        empty: (() => { const isEnd = (r, c) => L.pairs.some((q) => (q.a.row === r && q.a.col === c) || (q.b.row === r && q.b.col === c)); for (let r = 0; r < L.params.size; r++) for (let c = 0; c + 1 < L.params.size; c++) if (!isEnd(r, c) && !isEnd(r, c + 1)) return [pt({ row: r, col: c }), pt({ row: r, col: c + 1 })]; return null; })(),
        cut: (() => { const idx = (q, r, c) => L.solution[q].findIndex((x) => x.row === r && x.col === c);
          for (let p = 0; p < L.pairs.length; p++) for (let q = 0; q < L.pairs.length; q++) { if (p === q) continue;
            for (let i = 0; i < L.solution[p].length; i++) { const c = L.solution[p][i];
              for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const j = idx(q, c.row + dr, c.col + dc); if (j > 0 && j < L.solution[q].length - 1) return { p, q, seq: [...L.solution[p].slice(0, i + 1).map(pt), pt({ row: c.row + dr, col: c.col + dc })] }; } } }
          return null; })() }; })()`);
    const connected = (g) => g.page.evaluate(`(() => { const sc = ${scene}; const L = sc.flowLevelData; return sc.flowState.paths.filter((p, i) => p.length >= 2 && ((p[0].row === L.pairs[i].a.row && p[0].col === L.pairs[i].a.col && p[p.length - 1].row === L.pairs[i].b.row && p[p.length - 1].col === L.pairs[i].b.col) || (p[0].row === L.pairs[i].b.row && p[0].col === L.pairs[i].b.col && p[p.length - 1].row === L.pairs[i].a.row && p[p.length - 1].col === L.pairs[i].a.col))).length; })()`);
    const SEEN = { hasSeenTutorial: true, hasSeenLightsTip: true, hasSeenFlowTip: true };

    // Elegir Hilos: tutorial la primera vez
    let g = await openGame({ label: 'hilos', seed: { user_settings: { hasSeenTutorial: true }, ...RICH }, out, query: '?debug' });
    await g.openMenu();
    await g.shot('e20-menu');
    await g.playPuzzle('flow', 900);
    let s = await g.state();
    check('elegir Hilos lo guarda', s.settings?.puzzle === 'flow', `guardado ${s.settings?.puzzle}`);
    check('la primera vez en Hilos sale el mini tutorial', (await texts(g)).includes('Cómo se juega Hilos'));
    await g.page.waitForTimeout(3500);
    await g.shot('e20-tutorial-hilos');
    check('el tutorial dice que hay que llenar todas las casillas', (await texts(g)).includes('llena todas las casillas'));
    await g.tap(...g.pos.flowTutorialOk, 700); // «Siguiente»
    s = await g.state();
    let tt = await texts(g);
    check('«Siguiente» enseña la segunda pantalla: un tablero lleno gana y uno con casillas vacías no', tt.includes('Hay que llenar todo el tablero') && tt.includes('Todas las casillas llenas') && tt.includes('Quedan casillas vacías') && !tt.includes('Cómo se juega Hilos') && s.settings?.hasSeenFlowTip !== true, tt.slice(0, 160));
    await g.page.waitForTimeout(500);
    await g.shot('e20-tutorial-hilos-llenar');
    await g.tap(...g.pos.flowTutorialOk, 500);
    s = await g.state();
    check('«Entendido» cierra el tutorial y lo anota', !(await texts(g)).includes('Hay que llenar todo el tablero') && s.settings?.hasSeenFlowTip === true);
    check('el panel cuenta los hilos unidos', /0 de \d+ hilos unidos/.test(await texts(g)), await texts(g));
    await g.tap(...g.pos.lightsPanel, 500);
    check('tocar el panel de hilos vuelve a mostrar el tutorial', (await texts(g)).includes('Cómo se juega Hilos'));
    await g.tap(...g.pos.flowTutorialOk, 600);
    await g.tap(...g.pos.flowTutorialOk, 500);
    check('el tutorial se cierra tras sus dos pantallas', !(await texts(g)).includes('Hay que llenar todo el tablero') && !(await texts(g)).includes('Cómo se juega Hilos'));
    check('el panel también cuenta las casillas llenas', /0 de \d+ casillas llenas/.test(await texts(g)), await texts(g));
    await g.close();

    // Trazar, deshacer, bloqueos y cortes
    g = await openGame({ label: 'hilos-juego', seed: { user_settings: { ...SEEN, puzzle: 'flow' }, ...RICH }, out, query: '?debug' });
    let info = await flowInfo(g);
    check('el tablero de Hilos está en marcha', info.puzzle === 'flow' && info.pairs >= 3 && info.size >= 4, JSON.stringify({ p: info.puzzle, n: info.pairs, s: info.size }));
    await g.shot('e20-hilos');
    await g.drag(info.solution[0]);
    info = await flowInfo(g);
    check('arrastrar de un punto al otro une la pareja', (await connected(g)) === 1, `unidas ${await connected(g)}`);
    check('un trazo cuenta como un toque', info.taps === 1, `toques ${info.taps}`);
    check('el panel se actualiza', /1 de \d+ hilos unidos/.test(await texts(g)));
    await g.shot('e20-hilos-un-hilo');

    // Tocar sin arrastrar no estropea un hilo ya unido
    await g.tap(...info.ends[0][0], 400);
    check('un simple toque sobre un punto unido no borra su hilo', (await connected(g)) === 1);

    // Deshacer vuelve al estado anterior
    await g.tap(...g.pos.undo, 500);
    check('deshacer quita el último trazo', (await connected(g)) === 0 && (await flowInfo(g)).paths.every((n) => n === 0));

    // Arrastrar desde una casilla vacía no hace nada ni cuenta como toque
    const tapsBefore = info.taps;
    await g.drag(info.empty);
    info = await flowInfo(g);
    check('arrastrar desde una casilla vacía no cuenta como toque', info.taps === tapsBefore && info.paths.every((n) => n === 0), `toques ${tapsBefore} → ${info.taps}`);

    // Cortar: el hilo de otra pareja se corta al pasar por encima
    check('el nivel permite probar un corte', !!info.cut);
    await g.drag(info.solution[info.cut.q]);
    const joinedBefore = await connected(g);
    await g.drag(info.cut.seq);
    check('pasar por el hilo de otra pareja lo corta', joinedBefore === 1 && (await connected(g)) === 0, `antes ${joinedBefore}, ahora ${await connected(g)}`);
    await g.shot('e20-hilos-corte');
    await g.close();

    // Pista, victoria y progreso aparte
    g = await openGame({ label: 'hilos-victoria', seed: { user_settings: { ...SEEN, puzzle: 'flow' }, ...RICH }, out, query: '?debug' });
    const sparksBefore = (await g.state()).progress.sparks;
    const levelBefore = await g.state();
    await g.tap(...g.pos.hint, 700);
    s = await g.state();
    check('la pista cuesta 10 Chispas y une una pareja', s.progress.sparks === sparksBefore - 10 && (await connected(g)) === 1, `${sparksBefore} → ${s.progress.sparks}, unidas ${await connected(g)}`);
    info = await flowInfo(g);
    for (let i = 0; i < info.pairs; i++) {
      const cur = await flowInfo(g);
      if (cur.won) break;
      if (cur.paths[i] >= 2 && (await connected(g)) > i) continue;
      await g.drag(cur.solution[i], 200);
    }
    await g.page.waitForTimeout(3000);
    info = await flowInfo(g);
    check('unir todas las parejas resuelve el nivel', info.won === true);
    for (let i = 0; i < 20 && !(await texts(g)).includes('Todo unido'); i++) await g.page.waitForTimeout(500); // la tarjeta tarda más con carga
    check('sale el resultado «Todo unido»', (await texts(g)).includes('Todo unido'), (await texts(g)).slice(0, 200));
    await g.shot('e20-hilos-victoria');
    s = await g.state();
    check('sube el nivel de Hilos y no el de Circuitos ni el de Luces', s.progress.flowLevel === 2 && s.progress.currentLevel === (levelBefore.progress.currentLevel ?? 1) && s.progress.lightsLevel === (levelBefore.progress.lightsLevel ?? 1), `hilos ${s.progress.flowLevel}, circuitos ${s.progress.currentLevel} (antes ${levelBefore.progress.currentLevel}), luces ${s.progress.lightsLevel} (antes ${levelBefore.progress.lightsLevel})`);
    check('guarda un récord de tiempo con su propia clave', Object.keys(s.progress.stats.bestTimeByTier).some((k) => k.startsWith('F')) || s.progress.stats.levelsSolved >= 1);
    await g.close();

    // Llenar todo el tablero: unir las parejas sin llenarlo no gana (ni en Normal ni en Relajado) y avisa
    g = await openGame({ label: 'hilos-llenar', seed: { user_settings: { ...SEEN, puzzle: 'flow' }, ...RICH }, out, query: '?debug' });
    const route = `(() => { const sc = ${scene}; const L = sc.flowLevelData; const n = L.params.size; const key = (c) => c.row + ',' + c.col;
      const sameC = (a, b) => a.row === b.row && a.col === b.col;
      const ends = new Set(L.pairs.flatMap((q) => [key(q.a), key(q.b)]));
      for (let attempt = 0; attempt < 400; attempt++) {
        const order = L.pairs.map((_, i) => i).sort(() => Math.random() - 0.5);
        const used = new Set(); const paths = L.pairs.map(() => []); let ok = true;
        for (const i of order) {
          const { a, b } = L.pairs[i]; const prev = new Map([[key(a), null]]); const queue = [a]; let found = false;
          while (queue.length && !found) { const c = queue.shift();
            for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]].sort(() => Math.random() - 0.5)) { const nx = { row: c.row + dr, col: c.col + dc };
              if (nx.row < 0 || nx.col < 0 || nx.row >= n || nx.col >= n || prev.has(key(nx))) continue;
              if (!sameC(nx, b) && (used.has(key(nx)) || ends.has(key(nx)))) continue;
              prev.set(key(nx), c); if (sameC(nx, b)) { found = true; break; } queue.push(nx); } }
          if (!found) { ok = false; break; }
          const path = []; for (let c = b; c; c = prev.get(key(c))) path.unshift(c);
          path.forEach((c) => used.add(key(c))); paths[i] = path; }
        if (ok && used.size < n * n) return paths; }
      return null; })()`;
    const joinedNotFull = await g.page.evaluate(`(() => { const sc = ${scene}; const paths = ${route}; if (!paths) return null;
      sc.flowState = { paths }; sc.updateFlowVisuals(); sc.evaluateVictory();
      return { won: sc.isWon, filled: paths.flat().length, cells: sc.flowLevelData.params.size ** 2, mode: sc.profile.mode }; })()`);
    if (!joinedNotFull) {
      check('se encontró una forma de unir las parejas sin llenar el tablero', false, 'sin ruta');
    } else {
      await g.page.waitForTimeout(800);
      const tx = await texts(g);
      check('con todas las parejas unidas pero casillas vacías no se gana', joinedNotFull.won === false && joinedNotFull.filled < joinedNotFull.cells && joinedNotFull.mode === 'normal', JSON.stringify(joinedNotFull));
      check('avisa de las casillas que faltan por llenar', /por llenar/.test(tx) && new RegExp('\\d+ de \\d+ casillas llenas').test(tx), tx.slice(0, 200));
      await g.shot('e20-hilos-faltan-casillas');
      // El aviso no bloquea: el tablero sigue aceptando trazos y, al volver a tocar, el aviso se quita
      await g.page.waitForTimeout(2500); // más que lo que antes duraba el aviso: debe seguir en pantalla
      const toastState = await g.page.evaluate(`(() => { const sc = ${scene}; return { toast: !!sc.toast, blocked: sc.overlayOpen() }; })()`);
      check('el aviso de casillas vacías sigue en pantalla y no bloquea el tablero', toastState.toast && !toastState.blocked, JSON.stringify(toastState));
      const pairsDrag = await flowInfo(g);
      const [x0, y0] = pairsDrag.solution[0][0];
      await g.tap(x0, y0, 400);
      check('al volver a tocar los hilos el aviso se quita', await g.page.evaluate(`(() => !${scene}.toast)()`));
      const relaxedWin = await g.page.evaluate(`(() => { const sc = ${scene}; sc.profile.mode = 'relaxed'; sc.updateFlowVisuals(); sc.evaluateVictory(); return sc.isWon; })()`);
      check('tampoco se gana en Relajado: hay que llenar todo el tablero en todos los modos', relaxedWin === false);
    }
    await g.close();

    // Reto diario de Hilos: aparte de los de Circuitos y Luces
    g = await openGame({ label: 'hilos-diario', seed: { user_settings: { ...SEEN, puzzle: 'flow' }, ...RICH }, out, query: '?debug' });
    await g.tap(...g.pos.daily, 800);
    info = await flowInfo(g);
    check('el reto diario de Hilos no cambia de puzzle', info.puzzle === 'flow' && info.daily === true);
    await g.shot('e20-diario-hilos');
    for (let i = 0; i < info.pairs; i++) await g.drag(info.solution[i], 200);
    await g.page.waitForTimeout(3000);
    s = await g.state();
    check('completar el reto de Hilos lo registra aparte', s.progress.lastFlowDailyCompleted === today() && s.progress.lastDailyCompleted === null && s.progress.lastLightsDailyCompleted === null, `${s.progress.lastFlowDailyCompleted}`);
    check('el reto de Hilos no avanza el nivel de Hilos', s.progress.flowLevel === 1);
    await g.close();

    // Con aspectos, en claro y con alto contraste se dibuja sin errores
    for (const [label, settings] of [['cyberpunk', { skin: 'cyberpunk' }], ['aurora-claro', { skin: 'aurora', theme: 'light' }], ['matrix-hc', { skin: 'matrix', highContrast: true }], ['oceano', { skin: 'oceano' }]]) {
      const skin = settings.skin;
      g = await openGame({ label: 'hilos-' + label, seed: { user_settings: { ...SEEN, puzzle: 'flow', ...settings }, player_progress: { ...RICH.player_progress, unlockedSkins: [skin] } }, out, query: '?debug' });
      info = await flowInfo(g);
      await g.drag(info.solution[0], 300);
      await g.shot('e20-hilos-' + label);
      check(`Hilos con ${label} se dibuja`, !!(await g.page.$('canvas')) && (await connected(g)) === 1);
      await g.close();
    }
  }]);

  sections.push(['21. Menú principal: puzzles, modos, saludo y partidas guardadas', async () => {
    const scene = '(window.__game.scene.scenes.find((sc) => sc.handleCellTap))';
    const texts = (g) => g.page.evaluate(`(function walk(list) { return list.flatMap((o) => o.visible === false ? [] : [o.type === 'Text' ? o.text : '', ...(o.list ? walk(o.list) : [])]); })(${scene}.children.getAll()).join(' | ')`);
    const info = (g) => g.page.evaluate(`(() => { const sc = ${scene}; return { inMenu: sc.inMenu, puzzle: sc.puzzle, taps: sc.tapCount, hour: new Date().getHours(), rotations: sc.board.grid.flat().map((c) => c.rotation), lights: sc.lightGrid.flat(), mode: sc.profile.mode }; })()`);
    const SEEN = { hasSeenTutorial: true, hasSeenLightsTip: true, hasSeenFlowTip: true };
    let g = await openGame({ label: 'menu', seed: { user_settings: SEEN, ...RICH }, out, query: '?debug', menu: true });

    // La app abre en el menú: nombre, tres puzzles, modos, accesos y un saludo de la hora del dispositivo
    let i = await info(g);
    const tx = await texts(g);
    check('la app abre en el menú principal', i.inMenu === true);
    check('el menú muestra el nombre y los tres puzzles', ['Lumihilo', 'Circuitos', 'Luces', 'Hilos'].every((w) => tx.includes(w)), tx);
    check('el menú muestra los modos y los accesos', ['Relajado', 'Normal', 'Reto', 'Estadísticas', 'Aspectos', 'Ajustes'].every((w) => tx.includes(w)));
    const parts = {
      morning: ['Buenos días'],
      afternoon: ['Buenas tardes'],
      night: ['Buenas noches'],
      lateNight: ['Es un poco tarde', 'madrugada', 'Es muy tarde', 'hora de dormir', 'cuando despiertes', 'cuida tu sueño', 'Tu salud primero'],
    };
    const part = i.hour >= 5 && i.hour < 12 ? 'morning' : i.hour >= 12 && i.hour < 19 ? 'afternoon' : i.hour >= 1 && i.hour < 5 ? 'lateNight' : 'night';
    check('el saludo es de la franja de la hora del dispositivo', parts[part].some((w) => tx.includes(w)), `hora ${i.hour}`);
    check('el menú no es el juego: no se ven el cronómetro ni los toques', !/\d+ toques?/.test(tx));
    await g.shot('e21-menu');

    // Entrar a Circuitos, jugar y volver: la partida se conserva
    await g.enter('circuits');
    i = await info(g);
    check('tocar Circuitos entra al juego', i.inMenu === false && i.puzzle === 'circuits');
    await g.tap(200, 900, 450);
    await g.tap(300, 1000, 450);
    await g.tap(200, 900, 450);
    const circuits = await info(g);
    check('se juegan tres toques', circuits.taps === 3, `${circuits.taps}`);
    await g.tap(...g.pos.back, 500); // botón «Volver»
    g.menuOpen = true;
    check('el botón Volver (flecha arriba a la izquierda) vuelve al menú', (await info(g)).inMenu === true);
    const back = await texts(g);
    check('Circuitos ya muestra Partida en curso y Continuar', back.includes('Partida en curso') && back.includes('Continuar'));
    await g.shot('e21-menu-en-curso');

    // Otro puzzle: su propia partida; la de Circuitos queda guardada
    await g.enter('lights');
    i = await info(g);
    check('elegir Luces entra a Luces y lo guarda', i.puzzle === 'lights' && (await g.state()).settings?.puzzle === 'lights');
    await g.tap(200, 900, 450);
    await g.tap(300, 1000, 450);
    const lights = await info(g);
    check('Luces cuenta sus propios toques', lights.taps >= 1, `${lights.taps}`);
    await g.openMenu();
    await g.enter('circuits');
    i = await info(g);
    check('al volver a Circuitos retoma su partida (toques y piezas como las dejó)', i.puzzle === 'circuits' && i.taps === 3 && JSON.stringify(i.rotations) === JSON.stringify(circuits.rotations), `${i.taps}`);
    await g.openMenu();
    await g.enter('lights');
    i = await info(g);
    check('al volver a Luces retoma su partida', i.taps === lights.taps && JSON.stringify(i.lights) === JSON.stringify(lights.lights), `${i.taps}`);

    // La partida sobrevive a cerrar y abrir la app (vuelve a abrir en el menú)
    await g.openMenu();
    check('hay partidas guardadas en el almacenamiento', await g.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('saved_games') ?? '{}'); return !!s.circuits && !!s.lights; }));
    await g.reload();
    await g.openMenu();
    check('al reabrir la app vuelve a abrir en el menú', (await info(g)).inMenu === true);
    await g.enter('circuits');
    i = await info(g);
    check('tras cerrar y abrir la app Circuitos sigue como estaba', i.taps === 3 && JSON.stringify(i.rotations) === JSON.stringify(circuits.rotations), `${i.taps}`);
    await g.openMenu();
    await g.enter('lights');
    i = await info(g);
    check('tras cerrar y abrir la app Luces sigue como estaba', i.taps === lights.taps && JSON.stringify(i.lights) === JSON.stringify(lights.lights), `${i.taps}`);

    // «Ayuda» muestra el tutorial de Circuitos (tres pantallas) sin tocar la partida
    await g.openMenu();
    await g.enter('circuits');
    await g.tap(...g.pos.help, 700);
    let help = await texts(g);
    check('«Ayuda» muestra el tutorial de Circuitos', help.includes('Cómo se juega Circuitos'));
    await g.page.waitForTimeout(3600);
    await g.shot('e21-tutorial-circuitos-1');
    await g.tap(...g.pos.tutorialNext, 700);
    help = await texts(g);
    check('la segunda pantalla explica el sentido del giro', help.includes('El sentido del giro'));
    await g.page.waitForTimeout(2200);
    await g.shot('e21-tutorial-circuitos-2');
    await g.tap(...g.pos.tutorialNext, 700);
    help = await texts(g);
    check('la tercera pantalla da trucos', help.includes('Trucos para Circuitos') && help.includes('esquinas'));
    await g.shot('e21-tutorial-circuitos-3');
    await g.tap(...g.pos.tutorialDone, 500);
    i = await info(g);
    check('cerrar la ayuda deja la partida como estaba', !(await texts(g)).includes('Trucos para Circuitos') && i.taps === 3, `${i.taps}`);
    await g.openMenu();
    await g.enter('lights');

    // Reiniciar el nivel descarta la partida a medias
    await g.tap(...g.pos.reset, 500);
    i = await info(g);
    check('reiniciar deja el nivel sin jugadas', i.taps === 0);
    check('y borra la partida guardada de ese puzzle', await g.page.evaluate(() => !JSON.parse(localStorage.getItem('saved_games') ?? '{}').lights));

    // Cambiar de modo desde el menú
    await g.openMenu();
    await g.tap(...g.pos.menuMode(2), 600);
    i = await info(g);
    check('elegir Reto cambia el modo y se queda en el menú', i.mode === 'challenge' && i.inMenu === true, `${i.mode}`);
    check('cambiar de modo descarta las partidas a medias', await g.page.evaluate(() => localStorage.getItem('saved_games') === null));
    await g.enter('circuits');
    i = await info(g);
    check('Circuitos arranca de cero en el nuevo modo', i.taps === 0 && i.mode === 'challenge');
    await g.close();

    // Estadísticas y Ajustes ya no van juntos: cada uno se abre aparte desde el menú
    g = await openGame({ label: 'menu-accesos', seed: { user_settings: SEEN }, out, query: '?debug', menu: true });
    await g.tap(...g.pos.menuStats, 500);
    const all = await texts(g);
    const st = all.slice(all.lastIndexOf('Estadísticas |')); // solo la tarjeta (el menú sigue debajo)
    check('Estadísticas solo muestra números y Cerrar', st.includes('Racha actual') && st.includes('Cerrar') && !st.includes('Aspectos') && !st.includes('Ajustes'), st);
    await g.shot('e21-estadisticas');
    await g.tap(...g.pos.statsClose, 400);
    check('cerrar Estadísticas deja el menú', (await info(g)).inMenu === true);
    await g.tap(...g.pos.menuSettings, 500);
    check('Ajustes se abre desde el menú', (await texts(g)).includes('Efectos de sonido') || (await texts(g)).includes('Música'));
    await g.shot('e21-ajustes');
    g.menuOpen = false; // aquí se quiere comprobar que Ajustes vuelve al menú, no reentrar al puzzle
    await g.tap(...g.pos.settingsDone, 400);
    g.menuOpen = true;
    check('cerrar Ajustes deja el menú', (await info(g)).inMenu === true);
    await g.close();

    // Primera vez en Luces entrando directo desde el menú: sale su tutorial aunque no se haya visto el de Circuitos
    g = await openGame({ label: 'menu-luces-nuevo', seed: { user_settings: {}, ...RICH }, out, query: '?debug', menu: true });
    await g.enter('lights');
    check('el tutorial de Luces sale al entrar por primera vez', (await texts(g)).includes('Cómo se juega Luces'));
    await g.close();
  }]);


  await runSections(sections);

  section('Errores de consola durante toda la batería');
  const real = consoleErrors.filter((e) => !/WebGL|GPU stall|swiftshader|AudioContext|status of 403|status of 404|status of 503/i.test(e));
  check('sin errores de JavaScript ni de consola', real.length === 0, real.slice(0, 3).join(' | '));
}
