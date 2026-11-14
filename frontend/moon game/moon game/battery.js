// battery.js: battery HUD, power modes, low-battery guide and mission menu.
// Load it AFTER base.js:  <script src="battery.js"></script>   (frontend only, no other edits needed)
(() => {
  const BATT = { FULL: 0.15, SAVER: 0.04, WARN: 50 };   // battery % lost per SECOND by one unit (tweak these)
  const INTRO_MS = 7000;                                // wait for the landing story to finish before starting
  const pw = { level: 100, life: 'full', comms: 'full', started: false, guided: false, guideOpen: false, empty: false, last: performance.now() };
  window.pw = pw;                                       // so base.js can read/change the battery if you add the optional edits
  const t0 = performance.now();
  const backBtn = document.getElementById('back-btn');
  const inBase = () => !backBtn || backBtn.style.display === 'none';   // base.js hides "Back to base" while you stand outside

  const mkEl = (tag, id) => { const e = document.createElement(tag); e.id = id; document.body.appendChild(e); return e; };
  const css = document.createElement('style');
  css.textContent = `
    #ev-notes-btn{bottom:4.6rem !important}
    #ev-notes{bottom:8rem !important}
    #bt-hud{position:fixed;top:4.4rem;left:1rem;z-index:5;display:none;padding:.55rem .75rem;border-radius:12px;background:rgba(5,14,24,.82);border:1px solid rgba(160,190,235,.35);color:#eef1f6;font:600 .85rem Barlow,sans-serif;backdrop-filter:blur(6px);--bc:#7ddba3;min-width:190px}
    .bt-row{display:flex;align-items:center;gap:.6rem}
    .bt-ico{position:relative;width:50px;height:24px;border:2px solid #eef1f6;border-radius:6px;padding:2px;box-sizing:border-box}
    .bt-ico::after{content:"";position:absolute;right:-7px;top:5px;width:4px;height:10px;background:#eef1f6;border-radius:0 3px 3px 0}
    .bt-ico i{display:block;height:100%;border-radius:3px;background:var(--bc);box-shadow:0 0 10px var(--bc);transition:width .3s,background .3s}
    @keyframes btpulse{to{opacity:.45}}
    #bt-hud.low .bt-ico{animation:btpulse .8s ease-in-out infinite alternate}
    .bt-pct{font:700 1.15rem Barlow,sans-serif;min-width:3rem}
    .bt-i{background:transparent;border:1px solid #9fb4c7;color:#9fb4c7;border-radius:50%;width:1.5rem;height:1.5rem;cursor:pointer;font:700 .8rem Barlow,sans-serif;line-height:1;margin-left:auto}
    .bt-rate{display:block;font-weight:500;font-size:.72rem;opacity:.7;margin:.2rem 0 .4rem}
    .bt-u{display:flex;width:100%;justify-content:space-between;gap:.8rem;margin:.25rem 0;padding:.3rem .65rem;border-radius:999px;border:1.5px solid var(--uc,#7ddba3);background:rgba(255,255,255,.05);color:#eef1f6;cursor:pointer;font:600 .8rem Barlow,sans-serif}
    .bt-u b{color:var(--uc,#7ddba3)}.bt-u.eco{--uc:#ffb066}
    #bt-note{position:fixed;top:1rem;left:0;right:0;display:none;justify-content:center;z-index:7;pointer-events:none}
    .bt-nc{width:min(560px,92vw);padding:.7rem 1rem;border-radius:12px;background:rgba(5,14,24,.94);border:2px solid var(--c,#7ddba3);color:#eef1f6;font:500 .95rem Barlow,sans-serif;box-shadow:0 0 28px rgba(0,0,0,.5);animation:btin .35s ease-out}
    @keyframes btin{from{opacity:0;transform:translateY(-16px)}}
    #bt-guide,#mn-panel{position:fixed;inset:0;z-index:9;display:none;align-items:center;justify-content:center;background:rgba(2,4,10,.72);backdrop-filter:blur(4px);font-family:Barlow,sans-serif}
    .bt-card,.mn-card{width:min(640px,94vw);max-height:92vh;overflow:auto;background:rgba(13,21,38,.97);border:1px solid rgba(160,190,235,.35);border-radius:14px;padding:18px 20px;color:#eef1f6;box-shadow:0 24px 60px rgba(0,0,0,.6)}
    .mn-card{width:min(440px,92vw)}
    .bt-gh{display:flex;justify-content:space-between;align-items:center}.bt-gh b{color:#ffb066;letter-spacing:.12em}
    .bt-x{background:transparent;border:1px solid #ffb066;color:#ffb066;border-radius:999px;padding:.25rem .8rem;cursor:pointer;font:600 .8rem Barlow,sans-serif}
    .bt-card p{margin:.6rem 0;font-size:.95rem}
    .bt-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .bt-col{padding:.6rem .8rem;border-radius:10px;border:1.5px solid var(--c);background:rgba(255,255,255,.04)}
    .bt-col h4{margin:0 0 .3rem;color:var(--c);font-size:.9rem}.bt-col ul{margin:0;padding-left:1.1rem;font-size:.84rem;line-height:1.35}
    .bt-h{margin:1rem 0 .4rem;font-weight:700;font-size:.82rem;letter-spacing:.08em;color:#6ab4ff}
    .bt-opt,.mn-opt{display:flex;gap:.8rem;align-items:center;width:100%;text-align:left;margin:.45rem 0;padding:.65rem .9rem;border-radius:10px;border:1.5px solid var(--c,#6ab4ff);background:rgba(255,255,255,.05);color:#eef1f6;cursor:pointer;font:600 1rem Barlow,sans-serif}
    .bt-opt:hover,.mn-opt:hover{background:rgba(255,255,255,.12)}
    .bt-opt small,.mn-opt small{display:block;font-weight:500;opacity:.7;font-size:.8rem;margin-top:2px}
    .mn-ico{font-size:1.5rem}
    .bt-keep{display:block;margin:.6rem auto 0;background:transparent;border:0;color:#9fb4c7;text-decoration:underline;cursor:pointer;font:500 .85rem Barlow,sans-serif}
    .mn-card h3{margin:0 0 .3rem;font:800 1.6rem 'Big Shoulders Display',sans-serif;text-transform:uppercase;letter-spacing:.03em}
    .mn-card p{margin:0 0 .8rem;opacity:.8;font-size:.92rem}
    #mn-btn{position:fixed;top:1rem;left:1rem;z-index:6;display:none}
    @media(max-width:560px){.bt-cols{grid-template-columns:1fr}}`;
  document.head.appendChild(css);

  const btHud = mkEl('div', 'bt-hud'), btNote = mkEl('div', 'bt-note'), btGuide = mkEl('div', 'bt-guide');
  const menuBtn = mkEl('button', 'mn-btn'), menuPanel = mkEl('div', 'mn-panel');
  menuBtn.className = 'btn btn-ghost'; menuBtn.innerHTML = '☰ Mission menu';
  btHud.innerHTML = '<div class="bt-row"><div class="bt-ico"><i id="bt-fill"></i></div><b class="bt-pct" id="bt-pct">100%</b><button class="bt-i" id="bt-info" title="Power guide">i</button></div>'
    + '<span class="bt-rate" id="bt-rate"></span>'
    + '<button class="bt-u" data-u="life" title="Click to switch between full power and battery saving">🌬️ Life Support <b></b></button>'
    + '<button class="bt-u" data-u="comms" title="Click to switch between full power and battery saving">📡 Communication <b></b></button>';
  [btHud, menuBtn, btGuide, menuPanel].forEach(el => el.addEventListener('pointerdown', e => e.stopPropagation()));   // clicks here must not make the astronaut walk

  // ---------- battery HUD ----------
  const btRate = () => (pw.life === 'full' ? BATT.FULL : BATT.SAVER) + (pw.comms === 'full' ? BATT.FULL : BATT.SAVER);
  function btRender() {
    const p = Math.round(pw.level), col = p >= 50 ? '#7ddba3' : p >= 25 ? '#ffb066' : '#ff5d5d';
    btHud.style.setProperty('--bc', col); btHud.classList.toggle('low', p < 25);
    btHud.querySelector('#bt-fill').style.width = p + '%';
    btHud.querySelector('#bt-pct').textContent = p + '%';
    btHud.querySelector('#bt-rate').textContent = 'Using about ' + (btRate() * 60).toFixed(0) + '% per minute';
    btHud.querySelectorAll('.bt-u').forEach(b => { const eco = pw[b.dataset.u] === 'saver'; b.classList.toggle('eco', eco); b.querySelector('b').textContent = eco ? 'SAVING' : 'FULL'; });
  }
  let btTimer = null;
  function btNotify(html, color, ms) {
    btNote.innerHTML = '<div class="bt-nc" style="--c:' + (color || '#7ddba3') + '">' + html + '</div>'; btNote.style.display = 'flex';
    clearTimeout(btTimer); btTimer = setTimeout(() => { btNote.style.display = 'none'; }, ms || 7000);
  }
  btHud.addEventListener('click', e => {
    if (e.target.id === 'bt-info') { openGuide(); return; }
    const b = e.target.closest('.bt-u'); if (!b) return;
    const u = b.dataset.u; pw[u] = pw[u] === 'full' ? 'saver' : 'full'; btRender();
    const name = u === 'life' ? '🌬️ Life Support' : '📡 Communication', eco = pw[u] === 'saver';
    btNotify(eco
      ? name + ' is now in <b>BATTERY SAVING</b> mode, so the battery drains slower. ' + (u === 'life' ? 'CO₂ removal and oxygen generation are slower, and heating is weaker.' : 'Emergency messages only, more noise, longer delay.')
      : name + ' is back at <b>FULL POWER</b>. The battery drains faster.', eco ? '#ffb066' : '#7ddba3', 7000);
  });

  // ---------- guide shown when the battery drops below 50% ----------
  function guideHTML() {
    return `<div class="bt-card">
      <div class="bt-gh"><b>⚠ BATTERY BELOW ${BATT.WARN}%</b><button class="bt-x" data-a="close">✕ Close</button></div>
      <p>The base can no longer keep every unit at full power. You may keep <b>one unit at full power</b> and put the <b>other unit in battery saving mode</b>. A unit in saving mode uses only about a quarter of the power.</p>
      <div class="bt-cols">
        <div class="bt-col" style="--c:#ff6fa5"><h4>📡 Communication in saving mode</h4><ul><li>Only emergency messages can be received</li><li>The signal has more noise</li><li>Delay gets longer (1.3 s becomes about 4 s)</li></ul></div>
        <div class="bt-col" style="--c:#6ab4ff"><h4>🌬️ Life Support in saving mode</h4><ul><li>CO₂ removal gets slower, and after some time an astronaut may fall ill</li><li>Oxygen generation takes much longer</li><li>Temperature control cannot keep the cabin warm</li></ul></div>
      </div>
      <div class="bt-h">WHICH UNIT KEEPS FULL POWER?</div>
      <button class="bt-opt" data-a="life" style="--c:#6ab4ff"><span>🌬️</span><span>Keep Life Support at full power<small>Communication goes to battery saving mode</small></span></button>
      <button class="bt-opt" data-a="comms" style="--c:#ff6fa5"><span>📡</span><span>Keep Communication at full power<small>Life Support goes to battery saving mode</small></span></button>
      <button class="bt-keep" data-a="both">Keep both at full power for now (the battery drains fast)</button></div>`;
  }
  function openGuide() { pw.guideOpen = true; pw.guided = true; btGuide.innerHTML = guideHTML(); btGuide.style.display = 'flex'; }
  function closeGuide() { pw.guideOpen = false; btGuide.style.display = 'none'; }
  btGuide.addEventListener('click', e => {
    if (e.target === btGuide) { closeGuide(); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'life') { pw.life = 'full'; pw.comms = 'saver'; }
    if (a === 'comms') { pw.comms = 'full'; pw.life = 'saver'; }
    closeGuide(); btRender();
    if (a === 'life') btNotify('📡 Communication is in <b>BATTERY SAVING</b> mode: emergency messages only, more noise, longer delay. 🌬️ Life Support stays at <b>FULL POWER</b>.', '#ffb066', 9000);
    if (a === 'comms') btNotify('🌬️ Life Support is in <b>BATTERY SAVING</b> mode: CO₂ removal and oxygen generation are slower, and heating is weaker. 📡 Communication stays at <b>FULL POWER</b>.', '#ffb066', 9000);
  });

  // ---------- mission menu: back to the mode screen or the title screen ----------
  menuPanel.innerHTML = '<div class="mn-card"><h3>Mission menu</h3><p>Where would you like to go? Leaving the base restarts this mission.</p>'
    + '<button class="mn-opt" data-a="mode" style="--c:#ffb066"><span class="mn-ico">🗺️</span><span>Change mission category<small>Go back to the Category A / B screen</small></span></button>'
    + '<button class="mn-opt" data-a="home" style="--c:#6ab4ff"><span class="mn-ico">🏠</span><span>Back to the title screen<small>Start the game from the beginning</small></span></button>'
    + '<button class="btn btn-play" data-a="stay" style="width:100%;margin-top:.8rem">Keep playing</button></div>';
  function leaveBase(url) {
    try { ['astro_intro_done', 'astro_last_page', 'mode'].forEach(k => localStorage.removeItem(k)); } catch (err) { }   // so progress.js does not bounce you back here
    location.href = url;
  }
  menuBtn.addEventListener('click', () => { menuPanel.style.display = 'flex'; });
  menuPanel.addEventListener('click', e => {
    if (e.target === menuPanel) { menuPanel.style.display = 'none'; return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'mode') leaveBase('mode.html?home');
    else if (b.dataset.a === 'home') leaveBase('index.html?home');
    else menuPanel.style.display = 'none';
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') { menuPanel.style.display = 'none'; if (pw.guideOpen) closeGuide(); } });

  // ---------- the clock: drains the battery and watches the thresholds ----------
  setInterval(() => {
    const now = performance.now(), dt = Math.min((now - pw.last) / 1000, .5); pw.last = now;
    const outside = inBase() && now - t0 > INTRO_MS;
    menuBtn.style.display = outside ? 'inline-flex' : 'none';
    if (!pw.started && outside) {
      pw.started = true; btHud.style.display = 'block';
      btNotify('⚡ <b>Life Support</b> and <b>Communication</b> are running at <b>FULL POWER</b>.', '#7ddba3', 8000);
    }
    if (pw.started && !pw.guideOpen) pw.level = Math.max(0, pw.level - btRate() * dt);
    if (window.lifeD && window.lifeD.res) window.lifeD.res[2].pct = Math.round(pw.level);   // only if you added optional edit A
    btRender();
    if (pw.started && pw.level < BATT.WARN && !pw.guided && !pw.guideOpen) openGuide();
    if (pw.level <= 0 && !pw.empty) { pw.empty = true; btNotify('🪫 <b>Battery empty!</b> The units have almost no power left.', '#ff5d5d', 9000); }
  }, 250);
})();
