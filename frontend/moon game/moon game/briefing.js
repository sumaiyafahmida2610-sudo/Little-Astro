// briefing.js: astronaut dialogue + 3D floating astronaut (Three.js r128, no image files needed)
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let speaking = false, gestureAmt = 0;                      // read by the 3D loop

  /* ================= TYPING SOUND (synthesized, no audio files) ================= */
  let ac = null, soundOn = true;
  try { soundOn = localStorage.getItem("sound") !== "off"; } catch (e) {}
  function audio() {                                         // browsers only allow sound after a click or key press
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  ["pointerdown", "keydown"].forEach(ev => addEventListener(ev, audio, { passive: true }));
  audio();                                                   // works at once if the browser already allows it

  function tick() {                                          // short terminal-style blip per letter
    if (!soundOn || !ac || ac.state !== "running") return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "square"; o.frequency.value = 850 + Math.random() * 450;
    f.type = "bandpass"; f.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(f); f.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + 0.04);
  }

  const soundBtn = document.getElementById("sound-btn");
  function paintSound() { if (soundBtn) soundBtn.textContent = "Sound: " + (soundOn ? "On" : "Off"); }
  if (soundBtn) soundBtn.addEventListener("click", () => {
    soundOn = !soundOn; paintSound();
    try { localStorage.setItem("sound", soundOn ? "on" : "off"); } catch (e) {}
    if (soundOn) tick();                                     // quick preview
  });
  paintSound();

  /* ================= DIALOGUE ================= */
  // Edit the story here. chips = [label, extra class]
  const LINES = [
    { t: "🚀 Welcome, Commander! Humanity is counting on YOU!", chips: [], g: 1 },
    { t: "You are now in command of a space mission, far beyond Earth. Your crew's survival depends on the decisions you make.", chips: [], g: .55 },
    { t: "Manage oxygen, power, communication, and life-support systems. Face unexpected space emergencies, solve critical challenges, and keep your crew safe.",
      chips: [["Oxygen", ""], ["Power", "chip-lemon"], ["Communication", "chip-pink"], ["Life support", "chip-mint"]], g: .55 },
    { t: "Every decision matters. Every second counts.", chips: [], g: .8 },
    { t: "Are you ready to take command and bring your crew home safely? Your mission starts NOW, Commander! 🌍🚀", chips: [], g: 1 }
  ];
  const NEXT_PAGE = "register.html";

  const lineEl = document.getElementById("line");
  const chipsEl = document.getElementById("chips");
  const okBtn = document.getElementById("ok-btn");
  const countEl = document.getElementById("count");
  const fillEl = document.getElementById("fill");
  let i = 0, timer = null, typing = false;

  function finishTyping() {
    clearInterval(timer); typing = false; speaking = false;
    lineEl.textContent = LINES[i].t;
  }

  function show(n) {
    i = n;
    const L = LINES[n], last = n === LINES.length - 1;
    chipsEl.innerHTML = "";
    L.chips.forEach(([label, cls]) => {
      const s = document.createElement("span");
      s.className = ("chip " + cls).trim(); s.textContent = label; chipsEl.appendChild(s);
    });
    countEl.textContent = "Message " + (n + 1) + " of " + LINES.length;
    fillEl.style.setProperty("--pct", ((n + 1) / LINES.length * 100) + "%");
    okBtn.textContent = last ? "Continue" : "OK";

    clearInterval(timer);
    if (reduce) { lineEl.textContent = L.t; return; }
    const chars = Array.from(L.t);                           // keeps emojis whole while typing
    lineEl.textContent = ""; typing = true; speaking = true; gestureAmt = L.g;
    let c = 0;
    timer = setInterval(() => {
      c++; lineEl.textContent = chars.slice(0, c).join("");
      if (chars[c - 1].trim()) tick();
      if (c >= chars.length) finishTyping();
    }, 22);
  }

  okBtn.addEventListener("click", () => {
    if (typing) { finishTyping(); return; }                  // first click skips the typing
    if (i < LINES.length - 1) show(i + 1);
    else location.href = NEXT_PAGE;                          // last portion: Continue
  });
  show(0);

  /* ================= 3D ASTRONAUT ================= */
  const canvas = document.getElementById("scene");
  if (!canvas || !window.THREE) return;                      // dialogue still works without 3D
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return; }

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);                       // transparent: CSS stars show through
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  camera.position.set(0, 0, 9);

  // lights: warm sun, blue rim from Earth side, soft fill
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.8); sun.position.set(-6, 4, 5); scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6ab4ff, 1.6); rim.position.set(6, 2, -4); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x1a1420, 0.55));

  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; return t;
  };

  /* ---------- Earth in the background ---------- */
  const earthTex = canvasTex(512, 256, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#cfe3f5"); g.addColorStop(.12, "#0e4a8f"); g.addColorStop(.88, "#0e4a8f"); g.addColorStop(1, "#cfe3f5");
    x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 38; k++) {
      x.fillStyle = r() > .35 ? "#3f7a45" : "#a58f5f";
      x.beginPath(); x.ellipse(r() * 512, 50 + r() * 156, 12 + r() * 40, 8 + r() * 24, r() * 3, 0, 7); x.fill();
    }
    x.fillStyle = "rgba(255,255,255,.5)";
    for (let k = 0; k < 60; k++) { x.beginPath(); x.ellipse(r() * 512, r() * 256, 14 + r() * 40, 3 + r() * 6, r() * 3, 0, 7); x.fill(); }
  });
  const earth = new THREE.Group();
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshPhongMaterial({ map: earthTex, specular: 0x335577, shininess: 18 }));
  const atmos = new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 36), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec3 n; void main(){ float i = pow(0.68 - dot(n, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.32,0.62,1.0,1.0) * i * 1.8; }"
  }));
  earth.add(globe, atmos); scene.add(earth);

  /* ---------- floating dust (depth cue) ---------- */
  const dotTex = canvasTex(32, 32, (x) => {
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  }, false);
  const N = 140, dp = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) { dp[k * 3] = (Math.random() - .5) * 16; dp[k * 3 + 1] = (Math.random() - .5) * 10; dp[k * 3 + 2] = Math.random() * 6 - 3; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, map: dotTex, color: 0xbcd4ff,
    transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  /* ---------- Astronaut ---------- */
  const mat = (c, rough = .6, metal = .1) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
  const white = mat(0xf2f4f8, .65), glove = mat(0xe4e8ef, .7), grey = mat(0x8e98a8, .45, .5), dark = mat(0x23262f, .6, .3);
  const accent = mat(0xff8a3d, .5, .1), gold = mat(0xe0b040, .4, .6);
  const visor = new THREE.MeshPhongMaterial({ color: 0x101a33, specular: 0xffd9a0, shininess: 160 });
  const glow = (c) => new THREE.MeshBasicMaterial({ color: c });

  const add = (p, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); p.add(o); return o; };
  const Cyl = (a, b, h, s = 28) => new THREE.CylinderGeometry(a, b, h, s);
  const Sph = (r, s = 24) => new THREE.SphereGeometry(r, s, Math.round(s * .75));
  const ring = (p, r, tube, m, y) => { const o = add(p, new THREE.TorusGeometry(r, tube, 10, 32), m, 0, y, 0); o.rotation.x = Math.PI / 2; return o; };
  const grp = (p, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };
  const tube = (p, pts, r, m) => add(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(a => new THREE.Vector3(...a))), 28, r, 8), m);

  const astro = new THREE.Group(), body = new THREE.Group(); astro.add(body);

  // torso, belt, hips
  add(body, Cyl(.55, .5, .95, 36), white);
  add(body, Cyl(.56, .56, .09, 36), accent, 0, -.3, 0);
  ring(body, .53, .03, grey, -.2); ring(body, .55, .03, grey, .35);
  add(body, Cyl(.5, .46, .3, 36), white, 0, -.62, 0);
  ring(body, .47, .03, grey, -.5);

  // chest control box with live-looking screen + buttons
  add(body, new THREE.BoxGeometry(.5, .4, .1), dark, 0, .1, .52);
  const screenTex = canvasTex(128, 64, (x, w, h) => {
    x.fillStyle = "#04121f"; x.fillRect(0, 0, w, h);
    x.font = "bold 22px monospace"; x.fillStyle = "#7ddba3"; x.fillText("O2  98%", 8, 26);
    x.fillStyle = "#ffb066"; x.fillText("PWR 87%", 8, 54);
  });
  add(body, new THREE.PlaneGeometry(.42, .2), new THREE.MeshBasicMaterial({ map: screenTex }), 0, .18, .575);
  [0xff4d6d, 0x7ddba3, 0x6ab4ff].forEach((c, k) => add(body, Sph(.04, 12), glow(c), -.12 + k * .12, -.04, .58));

  // name patch (left chest) and mission patch (right chest)
  const nameTex = canvasTex(128, 48, (x, w, h) => {
    x.fillStyle = "#f2f4f8"; x.fillRect(0, 0, w, h); x.fillStyle = "#c9531a"; x.fillRect(0, h - 8, w, 8);
    x.fillStyle = "#1a2236"; x.font = "bold 30px sans-serif"; x.textAlign = "center"; x.fillText("NOVA", w / 2, 32);
  });
  const patchN = add(body, new THREE.PlaneGeometry(.24, .09), new THREE.MeshStandardMaterial({ map: nameTex, roughness: .8 }), -.3, .38, .485); patchN.rotation.y = -.59;
  const missionTex = canvasTex(64, 64, (x) => {
    x.fillStyle = "#0e4a8f"; x.beginPath(); x.arc(32, 32, 30, 0, 7); x.fill();
    x.strokeStyle = "#ff8a3d"; x.lineWidth = 4; x.stroke(); x.font = "30px sans-serif"; x.textAlign = "center"; x.fillText("🚀", 32, 43);
  });
  const patchM = add(body, new THREE.PlaneGeometry(.16, .16), new THREE.MeshStandardMaterial({ map: missionTex, roughness: .8, transparent: true }), .3, .38, .485); patchM.rotation.y = .59;

  // life-support backpack: body, tanks, trim, antenna
  add(body, new THREE.BoxGeometry(.9, 1.1, .4), grey, 0, .1, -.6);
  add(body, new THREE.BoxGeometry(.92, .12, .42), accent, 0, .52, -.6);
  [-.22, .22].forEach(x => { add(body, Cyl(.15, .15, .95, 24), white, x, .1, -.92); add(body, Sph(.15, 16), white, x, .575, -.92); add(body, Sph(.15, 16), white, x, -.375, -.92); ring(body, .152, .02, accent, .1).position.z = -.92; });
  add(body, Cyl(.02, .02, .45, 8), dark, .32, .9, -.6);
  add(body, Sph(.05, 10), glow(0xff4d6d), .32, 1.13, -.6);

  // hoses chest to backpack, safety tether trailing behind
  [-1, 1].forEach(s => tube(body, [[s * .22, .0, .58], [s * .6, .05, .4], [s * .64, .2, -.1], [s * .42, .3, -.5]], .035, dark));
  tube(body, [[0, -.5, -.45], [.25, -.9, -1.2], [-.3, -1.6, -1.9], [.25, -2.5, -2.4]], .03, gold);
  add(body, Sph(.06, 12), gold, 0, -.5, -.45);

  // neck ring + helmet
  ring(body, .4, .07, grey, .5);
  const head = grp(body, 0, .98, 0);
  add(head, Sph(.54, 44), white);
  const v = add(head, Sph(.42, 44), visor, 0, 0, .2); v.scale.set(1.05, .9, .82);
  const hl = canvasTex(128, 96, (x, w, h) => {                // soft sun glare + amber reflection on the visor
    const a = x.createRadialGradient(40, 28, 0, 40, 28, 46); a.addColorStop(0, "rgba(255,255,255,.75)"); a.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = a; x.fillRect(0, 0, w, h);
    const b = x.createRadialGradient(92, 70, 0, 92, 70, 36); b.addColorStop(0, "rgba(255,170,90,.45)"); b.addColorStop(1, "rgba(255,170,90,0)");
    x.fillStyle = b; x.fillRect(0, 0, w, h);
  });
  const glare = add(head, new THREE.PlaneGeometry(.5, .38), new THREE.MeshBasicMaterial({ map: hl, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, .0, .565);
  glare.scale.set(1, 1, 1);
  [-1, 1].forEach(s => {                                       // ear comms caps + helmet lamps
    const cap = add(head, Cyl(.13, .13, .12, 20), grey, s * .53, -.02, 0); cap.rotation.z = Math.PI / 2;
    add(head, Sph(.035, 10), glow(0x7ddba3), s * .6, -.02, 0);
    add(head, new THREE.BoxGeometry(.12, .07, .1), glow(0xfff4d0), s * .27, .46, .3);
  });
  add(head, new THREE.BoxGeometry(.3, .05, .06), accent, 0, .52, .1);

  // arms: shoulder, elbow, forearm, fingered glove
  function makeArm(side) {
    const sh = grp(body, side * .7, .32, 0);
    add(sh, Sph(.22, 20), white);
    add(sh, new THREE.SphereGeometry(.245, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), accent, 0, .02, 0);
    add(sh, Cyl(.17, .15, .5, 24), white, 0, -.27, 0);
    ring(sh, .165, .025, grey, -.12);
    const el = grp(sh, 0, -.55, 0);
    add(el, Sph(.16, 18), grey);
    add(el, Cyl(.15, .13, .45, 24), white, 0, -.25, 0);
    ring(el, .15, .03, accent, -.48);
    const hand = grp(el, 0, -.62, 0);
    add(hand, Sph(.15, 18), glove).scale.set(1, 1.1, .8);
    for (let k = 0; k < 4; k++) { const f = add(hand, Cyl(.03, .026, .14, 8), glove, -.075 + k * .05, -.14, .03); f.rotation.x = .35; }
    const th = add(hand, Cyl(.032, .028, .12, 8), glove, side * -.14, -.04, .06); th.rotation.z = side * .9;
    return { sh, el };
  }
  // legs: hip, thigh, knee, shin, boot
  function makeLeg(side) {
    const hip = grp(body, side * .27, -.8, 0);
    add(hip, Cyl(.2, .17, .5, 24), white, 0, -.27, 0);
    const kn = grp(hip, 0, -.55, 0);
    add(kn, Sph(.18, 18), grey);
    add(kn, new THREE.SphereGeometry(.19, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), accent, 0, 0, .06).rotation.x = Math.PI / 2;
    add(kn, Cyl(.17, .15, .45, 24), white, 0, -.25, 0);
    const boot = grp(kn, 0, -.5, 0);
    ring(boot, .155, .03, accent, 0);
    add(boot, new THREE.BoxGeometry(.36, .22, .56), dark, 0, -.12, .08);
    add(boot, new THREE.BoxGeometry(.38, .06, .6), grey, 0, -.25, .08);
    return { hip, kn };
  }
  const aL = makeArm(-1), aR = makeArm(1), lL = makeLeg(-1), lR = makeLeg(1);
  scene.add(astro);

  /* ---------- Background spacecraft: flies lower-left to upper-right, then repeats ---------- */
  const ship = new THREE.Group(), shipIn = new THREE.Group(); ship.add(shipIn);
  add(shipIn, Cyl(.07, .07, .25, 16), dark, 0, 1.6, 0);          // docking probe
  add(shipIn, Cyl(.2, .5, .6, 32), white, 0, 1.2, 0);            // crew capsule
  add(shipIn, Cyl(.5, .5, .06, 32), dark, 0, .87, 0);            // heat shield
  add(shipIn, Cyl(.5, .5, .95, 32), gold, 0, .28, 0);            // service module
  add(shipIn, Cyl(.16, .32, .42, 24), grey, 0, -.4, 0);          // engine
  const panelM = new THREE.MeshStandardMaterial({ color: 0x1a3a8f, metalness: .6, roughness: .3, emissive: 0x0a1c4a, emissiveIntensity: .5 });
  for (let k = 0; k < 4; k++) {                                   // 4 solar wings
    const w = grp(shipIn, 0, .28, 0); w.rotation.y = k * Math.PI / 2;
    add(w, new THREE.BoxGeometry(.3, .04, .04), dark, .62, 0, 0);
    add(w, new THREE.BoxGeometry(1.25, .02, .55), panelM, 1.4, 0, 0);
  }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0x6ab4ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.y = -.8; shipIn.add(flame);
  ship.scale.setScalar(.45);
  scene.add(ship);

  /* ---------- layout: desktop (astro on right) vs phone (astro on top) ---------- */
  const base = new THREE.Vector3();
  function layout() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (w / h > 1.1) { base.set(2.9, -0.1, 0); astro.scale.setScalar(1.05); earth.position.set(-1.5, 3.2, -14); earth.scale.setScalar(4); }
    else { base.set(0, 1.35, 0); astro.scale.setScalar(0.66); earth.position.set(2, 4, -14); earth.scale.setScalar(3); }
  }
  addEventListener("resize", layout); layout();

  /* ---------- animation loop ---------- */
  const clock = new THREE.Clock();
  let gest = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = reduce ? 0 : clock.elapsedTime;
    const target = speaking && !reduce ? gestureAmt : 0;
    gest += (target - gest) * 0.08;                            // 0 idle .. 1 big wave

    astro.position.set(base.x, base.y + Math.sin(t * .9) * .2, base.z);   // floating bob
    astro.rotation.y = -.35 + Math.sin(t * .4) * .25;
    astro.rotation.z = Math.sin(t * .5) * .07;
    body.rotation.x = .12 + Math.sin(t * .7) * .05;

    // left arm drifts; right arm waves/gestures while talking
    aL.sh.rotation.z = -.5 - Math.sin(t * .9) * .12; aL.sh.rotation.x = Math.sin(t * .7) * .15;
    aL.el.rotation.z = .45 + Math.sin(t * .8) * .1;
    aR.sh.rotation.z = .5 + Math.sin(t * .9 + 1) * .12 + gest * 1.7;
    aR.sh.rotation.x = Math.sin(t * .7 + 1) * .15 - gest * .25;
    aR.el.rotation.z = -.45 + gest * (.3 + Math.sin(t * 8) * .45);

    // legs: slow zero-g kicking with bent knees
    lL.hip.rotation.x = .3 + Math.sin(t * .8) * .12; lL.hip.rotation.z = -.08; lL.kn.rotation.x = -.35 + Math.sin(t * .8 + 1) * .1;
    lR.hip.rotation.x = -.1 + Math.sin(t * .8 + 1.5) * .12; lR.hip.rotation.z = .08; lR.kn.rotation.x = -.15 + Math.sin(t * .8 + 2.5) * .1;

    head.rotation.x = Math.sin(t * 10) * .05 * Math.min(1, gest);          // nods while talking
    head.rotation.y = Math.sin(t * .6) * .15;

    dust.rotation.y = t * .02; dust.position.y = Math.sin(t * .3) * .15;
    if (!reduce) earth.rotation.y += dt * 0.03;

    // spacecraft path: lower-left to upper-right
    const dur = 18, gap = 8;                                       // seconds flying, seconds waiting
    const p = (t % (dur + gap)) / dur;
    ship.visible = p < 1 && !reduce;
    if (ship.visible) {
      const hh = Math.tan(0.3054) * 14, hw = hh * camera.aspect;   // visible half-size at the ship's depth
      const x0 = -hw - 1.5, y0 = -hh - 1, x1 = hw + 1.5, y1 = hh + 1;
      ship.position.set(x0 + (x1 - x0) * p, y0 + (y1 - y0) * p, -5);
      ship.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2; // nose points along the path
      shipIn.rotation.y += dt * .6;                                 // slow roll
      flame.material.opacity = .8 + Math.sin(t * 18) * .12;
    }

    renderer.render(scene, camera);
    if (!document.hidden) requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { clock.getDelta(); requestAnimationFrame(frame); } });
  frame(); canvas.classList.add("ready");
})();