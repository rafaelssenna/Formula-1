/* Roteiro de QA do jogo. Uso (no console da página, com a corrida já criada):
 *   const s=document.createElement('script');s.src='qa.js?'+Date.now();document.head.appendChild(s);
 *   await QA.checks()           -> erros, carros apoiados na pista, freio, rodas (números)
 *   await QA.film(16,[1])       -> grade 4x4 de uma volta em T-cam (um quadro a cada ~1/16 de volta)
 *   await QA.film(12,[1,0,3,5,2,4],'mix') -> 12 quadros alternando câmeras e carros
 * Roda sem requestAnimationFrame (usa __dbg.tick), então funciona com o painel oculto.
 */
(function () {
  const D = window.__dbg;
  const race = () => D.race;
  const sim = (sec) => { const n = Math.round(sec / D.DT); for (let i = 0; i < n; i++) D.step(D.DT); D.tick(D.DT) };   /* física pura; renderiza só no fim */
  const errs = []; window.addEventListener('error', e => errs.push(String(e.message)));

  async function checks() {
    const R = race(); const out = {};
    // 1. sem erros por 5 s de simulação
    try { sim(5) } catch (e) { errs.push(String(e)) }
    out.erros = [...new Set(errs)].slice(0, 5);
    // 2. todos os carros apoiados na pista (malha a menos de 10 cm da altura física, longe da origem)
    out.carrosApoiados = R.cars.filter(c => c.mesh.position.lengthSq() > 1 && Math.abs(c.mesh.position.y - c.pos.y) < 0.25).length + '/' + R.cars.length;
    // 3. rodas: excentricidade (deve ser < 2 mm)
    let worst = 0;
    for (const c of R.cars.slice(0, 6)) for (const pv of c.wheels) {
      const spin = pv.userData && pv.userData.spin; if (!spin) continue; const meshes = []; spin.traverse(o => { if (o.isMesh) meshes.push(o) });
      const lows = []; const saved = spin.rotation.x;
      for (let a = 0; a < 12; a++) { spin.rotation.x = a * Math.PI / 6; pv.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(pv.matrixWorld).invert(); let lo = 1e9; const v = new THREE.Vector3();
        for (const m of meshes) { const pa = m.geometry.attributes.position, arr = pa.array; const nf = pa.normalized ? (arr instanceof Int16Array ? 1 / 32767 : arr instanceof Int8Array ? 1 / 127 : arr instanceof Uint16Array ? 1 / 65535 : 1 / 255) : 1;
          const M = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld); for (let i = 0; i < pa.count; i++) {   /* todos os vértices: amostrar pula o ponto mais baixo em pneu leve */ v.set(pa.getX(i) * nf, pa.getY(i) * nf, pa.getZ(i) * nf).applyMatrix4(M); if (v.y < lo) lo = v.y } } lows.push(lo) }
      spin.rotation.x = saved; worst = Math.max(worst, Math.max(...lows) - Math.min(...lows)) }
    out.rodaExcentricidade_mm = +(worst * 1000).toFixed(1);
    // 4. freio de referência: 300 -> 100 km/h (alvo real ~1,9 s / ~95 m)
    const c = R.cars.find(x => x.ai) || R.player; const snap = { s: c.s, ai: c.ai, v: c.v, lat: c.latNow || 0 };
    c.ai = null; c.place(1500, 0); c.temp = [95, 95, 95, 95]; c.v = 300 / 3.6; c.gear = 8; let t = 0; const s0 = c.s;
    while (c.v * 3.6 > 100 && t < 8) { c.brake = 1; c.throttle = 0; c.steer = 0; c.update(D.DT, null, R.opt, R); t += D.DT }
    out.freio300a100 = { s: +t.toFixed(2), m: Math.round(c.s - s0), travou: c.lock > 0.3 };
    c.ai = snap.ai; c.place(snap.s, snap.lat); c.v = snap.v;   /* volta na mesma velocidade: parado no meio do pelotão gerava batidas falsas */
    return out;
  }

  // grade de quadros; captura logo após renderizar (buffer ainda válido)
  async function film(n, cams, mode) {
    const R = race(); const COLS = 4, TW = 200, TH = 150; const rows = Math.ceil(n / COLS);
    let ov = document.getElementById('film'); if (!ov) { ov = document.createElement('canvas'); ov.id = 'film'; ov.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#000'; ov.onclick = () => ov.style.display = 'none'; document.body.appendChild(ov) }
    ov.width = COLS * TW; ov.height = rows * TH; ov.style.display = 'none'; const x = ov.getContext('2d'); x.font = 'bold 11px sans-serif';
    const ais = R.cars.filter(c => c.ai); const L = R.cars[0] ? 4600 : 4600; const step = L / n;
    R.laps = 99;   /* corrida não termina no meio da filmagem */
    let car = ais[0]; R.player = car; const blocked = [];
    const statics = []; D.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.visible) statics.push(o) });
    const carSet = new Set(); R.cars.forEach(c => c.mesh.traverse(o => carSet.add(o)));
    const blockedAt = () => { const dir = new THREE.Vector3(); D.camera.getWorldDirection(dir); const rc = new THREE.Raycaster(D.camera.position.clone(), dir, 0.3, 10);
      const h = rc.intersectObjects(statics.filter(o => !carSet.has(o)), false)[0]; return h ? `${h.object.geometry.type}@${h.distance.toFixed(1)}m` : null };
    for (let i = 0; i < n; i++) {
      if (mode === 'mix') { car = ais[(i * 5) % ais.length]; R.player = car; sim(1.2) } else { const s0 = car.s; let g = 0; while (((car.s - s0 + L) % L) < step && g < 4000) { D.step(D.DT); g++ } }
      D.cam.mode = cams[i % cams.length]; D.tick(0.5); D.tick(0.5); for (let k = 0; k < 10; k++) D.tick(D.DT);   /* câmeras suavizadas alcançam o carro depois do salto de física */
      const b = blockedAt(); if (b) blocked.push(`quadro ${i} s=${car.s.toFixed(0)} cam${D.cam.mode}: ${b}`);
      const cx = (i % COLS) * TW, cy = Math.floor(i / COLS) * TH; x.drawImage(D.renderer.domElement, cx, cy, TW, TH);
      x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(cx, cy, TW, 14); x.fillStyle = '#fff'; x.fillText(`${i} cam${D.cam.mode} ${car.d.c} s=${car.s.toFixed(0)} ${(car.v * 3.6).toFixed(0)}`, cx + 3, cy + 11);
    }
    ov.style.display = 'block'; return { bloqueados: blocked };
  }
  /* piloto de teclado: só teclas (tudo ou nada), decide a cada 50 ms, mira 10 m + 0,35 s à frente na linha de corrida.
     Coloca o jogador sozinho 500 m à frente do pelotão. Alvo com assistências: 0 s fora da pista, volta < 1:30. */
  function kbBot(secs = 200) {
    const R = race(), T = D.T, c = R.player; R.laps = 99;
    const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
    const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a };
    const lead = R.cars.reduce((m, o) => Math.max(m, o === c ? 0 : o.lap * 4600 + o.s), 0); c.place((lead + 500) % 4600, 0); c.v = 50; c.dmg = 0; c.temp = [95, 95, 95, 95];
    const held = {}; const set = (k, v) => { if (!!held[k] !== v) { key(k, v); held[k] = v } }; let t = 0, next = 0, off = 0, lapStart = 0, lastLap = c.lap; const laps = [];
    while (t < secs) { if (t >= next) { next += 0.05; const i = c.sIdx, j = (i + Math.round((10 + c.v * 0.35) / T.ds)) % T.N; const tx = T.p[j].x + T.n[j].x * T.RL[j], tz = T.p[j].z + T.n[j].z * T.RL[j];
        const err = wrap(Math.atan2(tz - c.pos.z, tx - c.pos.x) - c.hd); set('KeyD', err > 0.02); set('KeyA', err < -0.02); set('KeyW', true) }
      D.step(D.DT); t += D.DT; if (Math.abs(c.latNow || 0) > 7) off += D.DT; if (c.lap !== lastLap) { laps.push(+(t - lapStart).toFixed(1)); lapStart = t; lastLap = c.lap } }
    ['KeyW', 'KeyA', 'KeyD'].forEach(k => set(k, false)); return { fora_s: +off.toFixed(1), dano: +c.dmg.toFixed(2), voltas: laps.slice(1) } }
  /* nada do cenário dentro da pista: árvores e prédios (instâncias) a menos de HW+3 m de qualquer ponto do traçado */
  function scenery() { const T = D.T; const out = []; const near = (x, z) => { let b = 1e9; for (let i = 0; i < T.N; i += 2) { const p = T.p[i]; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < b) b = d } return Math.sqrt(b) };
    const HW = 7; const m = new THREE.Matrix4(), v = new THREE.Vector3();
    D.scene.traverse(o => { if (!o.isInstancedMesh) return; let bad = 0, ex = null; for (let k = 0; k < o.count; k++) { o.getMatrixAt(k, m); v.setFromMatrixPosition(m); const d = near(v.x, v.z); if (d < HW + 3) { bad++; ex = ex || [Math.round(v.x), Math.round(v.z), +d.toFixed(1)] } } if (bad) out.push(`${o.geometry.type} x${o.count}: ${bad} na pista, ex ${ex}`) });
    return { naPista: out } }
  /* piloto automático no carro do jogador (corrida "neutra" para medir tráfego e colisões) */
  function autopilot(level) { const R = race(); if (!R.player.ai) new D.AI(R.player, level || R.opt.diff || 1.06); return 'ok' }
  /* corrida de teste: N segundos com todos pilotados pela IA; conta contatos, punições e asas quebradas */
  function raceStats(secs = 240) { const R = race(); autopilot(); R.laps = 99; const log = []; D.onContact = (A, B, h) => { if (h.vn >= 2.2) log.push({ t: R.time, s: A.s }) };
    for (let i = 0; i < Math.round(secs / D.DT); i++) D.step(D.DT); D.onContact = null; const all = R.cars; const b = all.map(c => c.best).filter(Boolean).sort((a, b) => a - b);
    return { contatos: log.length, naLargada: log.filter(e => e.t < 15).length, punidos: all.filter(c => c.penalty).length, asas: all.filter(c => (c.wing || 0) > 0.2).length,
      melhor: b[0] && +b[0].toFixed(1), mediana: b[Math.floor(b.length / 2)] && +b[Math.floor(b.length / 2)].toFixed(1), fora_s: +all.reduce((s, c) => s + c.offTrack, 0).toFixed(0) } }
  window.QA = { checks, film, sim, kbBot, scenery, autopilot, raceStats };
})();
