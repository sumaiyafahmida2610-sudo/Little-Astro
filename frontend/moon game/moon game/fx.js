// Shared on every page: sound effects (made in code, no audio files), pop-in text, warp page transition.
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let ctx = null, muted = false, amb = null;
  const AMB_VOL = 0.1;   // background sound volume: 0.05 softer, 0.15 louder
  try { muted = localStorage.getItem("sfx") === "off"; } catch (e) {}

  function ac() {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(f0, f1, dur, type, vol, delay) {
    if (muted) return;
    const c = ctx; if (!c || c.state !== "running") return;      // browsers allow sound only after a first click
    const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  const Sfx = window.Sfx = {
    pop()    { tone(320, 950, 0.12, "sine", 0.12); },
    hover()  { tone(700, 900, 0.05, "sine", 0.04); },
    click()  { tone(520, 800, 0.09, "triangle", 0.12); tone(800, 1200, 0.12, "triangle", 0.09, 0.07); },
    whoosh() { tone(140, 1100, 0.45, "sawtooth", 0.04); tone(900, 200, 0.4, "sine", 0.05, 0.1); },
  };
  // ---- DRAMATIC BACKGROUND SOUND: deep drone, rising swells, distant booms, high twinkles ----
  function setAmbVol() { if (amb && ctx) { amb.gain.cancelScheduledValues(ctx.currentTime); amb.gain.setTargetAtTime(muted ? 0 : AMB_VOL, ctx.currentTime, 1.8); } }
  function startAmbient() {
    if (amb) return; const c = ac(); if (!c) return;
    const out = c.createGain(); out.gain.value = 0; out.connect(c.destination);
    const echo = c.createDelay(); echo.delayTime.value = 0.45;               // big empty-space echo
    const fb = c.createGain(); fb.gain.value = 0.42; echo.connect(fb); fb.connect(echo); echo.connect(out);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 300; lp.Q.value = 0.8;
    lp.connect(out); lp.connect(echo);
    // deep drone (A1, E2, A2) with slightly detuned saws
    [[55, "sawtooth", 0.35, -7], [55, "sawtooth", 0.35, 7], [82.41, "sawtooth", 0.18, 0], [110, "sine", 0.4, 0], [164.81, "triangle", 0.12, 3]]
      .forEach(([f, type, v, det]) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.value = f; o.detune.value = det; g.gain.value = v;
        o.connect(g); g.connect(lp); o.start();
      });
    // rising swell: the sound slowly opens up, then falls back (every 16 s)
    (function swell() {
      const t = c.currentTime;
      lp.frequency.cancelScheduledValues(t); lp.frequency.setValueAtTime(300, t);
      lp.frequency.linearRampToValueAtTime(1600, t + 7); lp.frequency.linearRampToValueAtTime(300, t + 15);
      setTimeout(swell, 16000);
    })();
    // distant boom every 12 to 20 s
    (function boom() { tone(75, 28, 2.4, "sine", 0.28); setTimeout(boom, 12000 + Math.random() * 8000); })();
    // space wind
    const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const n = c.createBufferSource(), ng = c.createGain(); n.buffer = buf; n.loop = true; ng.gain.value = 0.5;
    n.connect(ng); ng.connect(out); n.start();
    // high twinkles
    const notes = [523.25, 587.33, 659.25, 783.99, 880];
    (function twinkle() { const f = notes[Math.floor(Math.random() * 5)]; tone(f, f * 0.99, 1.6, "sine", 0.02); setTimeout(twinkle, 5000 + Math.random() * 7000); })();
    amb = out; setAmbVol();
  }
  ["pointerdown", "keydown"].forEach((ev) => addEventListener(ev, () => { ac(); startAmbient(); }, { once: true }));
  startAmbient();   // ready now; heard after the player's first click

  // mute button
  const tgl = document.createElement("button"); tgl.type = "button"; tgl.className = "sfx-toggle";
  const paint = () => { tgl.textContent = muted ? "🔇" : "🔊"; tgl.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off"); };
  tgl.addEventListener("click", () => { muted = !muted; try { localStorage.setItem("sfx", muted ? "off" : "on"); } catch (e) {} paint(); setAmbVol(); if (!muted) Sfx.pop(); });
  paint(); document.body.appendChild(tgl);

  document.addEventListener("pointerover", (e) => { const b = e.target.closest(".btn, .swatch"); if (b && !b.contains(e.relatedTarget)) Sfx.hover(); });
  document.addEventListener("click", (e) => { if (e.target.closest(".btn")) Sfx.click(); });

  // text pops in one by one
  if (!reduce) {
    const sel = [".game-title span", ".h2", ".lead", ".chip", ".btn", ".readouts > div", ".level"].map((q) => ".screen:not([hidden]) " + q).join(",");
    document.querySelectorAll(sel).forEach((el, i) => {
      const d = 0.2 + i * 0.11;
      el.style.animationDelay = d + "s"; el.classList.add("pop-in");
      setTimeout(Sfx.pop, d * 1000 + 80);
    });
  }

  // warp transition between pages
  const warp = document.createElement("div"); warp.className = "warp"; document.body.appendChild(warp);
  let arrive = false;
  try { arrive = sessionStorage.getItem("warp") === "1"; sessionStorage.removeItem("warp"); } catch (e) {}
  if (arrive && !reduce) {
    warp.style.transition = "none"; warp.classList.add("go"); void warp.offsetWidth;
    warp.style.transition = ""; requestAnimationFrame(() => warp.classList.remove("go"));
  }
  addEventListener("pageshow", (e) => { if (e.persisted) warp.classList.remove("go"); });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target || a.getAttribute("href").startsWith("#")) return;
    e.preventDefault(); Sfx.whoosh(); warp.classList.add("go");
    try { sessionStorage.setItem("warp", "1"); } catch (err) {}
    setTimeout(() => { location.href = a.href; }, reduce ? 0 : 480);
  });
})();
