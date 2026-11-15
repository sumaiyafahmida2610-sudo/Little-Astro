(() => {
  // =====================================================
  //  RENDERER
  // =====================================================
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;
  requestAnimationFrame(() => canvas.classList.add('ready'));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000208);
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);
  const look = new THREE.Vector3(0, 10, -10);
  const HOME_CAM = new THREE.Vector3(0, 4, 54), HOME_LOOK = new THREE.Vector3(0, 7, 0);
  camera.position.set(0, 45, 130);

  // ---------- helpers ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const MAXA = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const LEVEL = { A: '#7ddba3', B: '#ffb066', C: '#ff5d5d' };
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const tex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = MAXA; return t; };
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .5, metalness: .5, envMapIntensity: .7 }, o));
  const glow = (c, i = 1) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: i });

  function label(text, color = '#eef1f6', w = 512, h = 128, size = 56) {
    const [c, x] = cv(w, h);
    x.fillStyle = 'rgba(13,21,38,.85)'; x.fillRect(0, 0, w, h);
    x.strokeStyle = color; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    x.fillStyle = color; x.font = `700 ${size}px Barlow, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, toneMapped: false }));
    s.scale.set(w / h * 2, 2, 1); return s;
  }
  const glowTex = (() => {
    const [c, x] = cv(128, 128), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const haloTex = (() => {
    const [c, x] = cv(256, 256), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(.74, 'rgba(255,255,255,.6)');
    g.addColorStop(.85, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
  })();
  const glowSprite = (color, size, op = 1, map = glowTex) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: op, toneMapped: false }));
    s.scale.set(size, size, 1); return s;
  };
  const strut = (a, b, r, m) => {
    const len = a.distanceTo(b), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), m);
    o.position.copy(a).add(b).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()); return o;
  };
  const box = (p, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; };
  const cyl = (p, rt, rb, h, m, x, y, z, seg = 24) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); p.add(o); return o; };
  const pipe = (pts, r, m) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V(p[0], p[1], p[2]))), 40, r, 8, false), m);

  // ---------- environment reflections ----------
  function makeEnv(stops, spots) {
    const [c, x] = cv(16, 256), g = x.createLinearGradient(0, 0, 0, 256);
    stops.forEach(([p, col]) => g.addColorStop(p, col)); x.fillStyle = g; x.fillRect(0, 0, 16, 256);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide })));
    spots.forEach(([dir, col, k, size]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k) }));
      m.position.copy(dir).normalize().multiplyScalar(40); s.add(m);
    });
    const pm = new THREE.PMREMGenerator(renderer), e = pm.fromScene(s).texture; pm.dispose(); return e;
  }
  const SUN_DIR = V(60, 28, -100).normalize();
  const envOut = makeEnv([[0, '#0d111a'], [.48, '#34373e'], [.52, '#6b6b6b'], [1, '#8d8d8d']], [[SUN_DIR, '#fff0d8', 25, 4], [V(0, 1, .6), '#6a8fd0', 1.5, 12]]);
  const envIn = makeEnv([[0, '#eaf3ff'], [.5, '#a2b2c6'], [1, '#566175']], [[V(0, 1, 0), '#ffffff', 6, 14]]);
  scene.environment = envOut;

  // =====================================================
  //  OUTSIDE WORLD
  // =====================================================
  const world = new THREE.Group(); scene.add(world);

  const sun = new THREE.DirectionalLight(0xfff1dc, 2.7);
  sun.position.copy(SUN_DIR).multiplyScalar(150); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 420 });
  const SM = renderer.capabilities.maxTextureSize >= 8192 ? 4096 : 2048;
  sun.shadow.mapSize.set(SM, SM); sun.shadow.bias = -.0004; sun.shadow.normalBias = .05;
  const fill = new THREE.DirectionalLight(0x8fb4ff, .4); fill.position.set(-30, 40, 80);
  world.add(sun, fill, new THREE.HemisphereLight(0x5f7fb5, 0x1a1a1a, .3));

  // --- CLEAR SKY: crisp Milky Way texture + thousands of sharp star points ---
  function skyTexture() {
    const [c, x] = cv(4096, 2048);
    x.fillStyle = '#000208'; x.fillRect(0, 0, 4096, 2048);
    const blob = (px, py, r, col) => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); };
    const band = px => 1024 + Math.sin(px / 4096 * 6.283) * 340;
    const spread = k => (Math.random() + Math.random() + Math.random() - 1.5) * k;
    for (let i = 0; i < 700; i++) { const px = rnd(0, 4096); blob(px, band(px) + spread(260), rnd(40, 150), Math.random() < .7 ? 'rgba(120,140,210,.035)' : 'rgba(220,175,140,.03)'); }
    for (let i = 0; i < 14; i++) { const px = rnd(0, 4096); blob(px, band(px) + rnd(-120, 120), rnd(200, 320), i % 2 ? 'rgba(110,70,170,.05)' : 'rgba(50,110,190,.05)'); }
    for (let i = 0; i < 160; i++) { const px = rnd(0, 4096); blob(px, band(px) + spread(120), rnd(20, 70), 'rgba(0,0,6,.22)'); }  // dust lanes
    for (let i = 0; i < 26000; i++) {
      const px = rnd(0, 4096), py = Math.random() < .6 ? band(px) + spread(300) : rnd(0, 2048);
      const s = Math.random() < .02 ? 2.4 : Math.random() < .15 ? 1.5 : 1, a = rnd(.35, 1), r = Math.random();
      x.fillStyle = r < .15 ? `rgba(190,215,255,${a})` : r < .25 ? `rgba(255,225,190,${a})` : `rgba(255,255,255,${a})`;
      x.fillRect(px, py, s, s);
    }
    return tex(c);
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 64, 32), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, depthWrite: false, toneMapped: false }));
  sky.rotation.set(.5, .4, .2); world.add(sky);
  (function stars() {
    const N = 5500, p = new Float32Array(N * 3), c = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * 6.2832, s = Math.sqrt(1 - u * u), R = 2800;
      p[i * 3] = R * s * Math.cos(th); p[i * 3 + 1] = R * u; p[i * 3 + 2] = R * s * Math.sin(th);
      const k = Math.random(), col = k < .2 ? [.75, .85, 1] : k < .3 ? [1, .9, .75] : [1, 1, 1], b = .55 + Math.random() * .45;
      c[i * 3] = col[0] * b; c[i * 3 + 1] = col[1] * b; c[i * 3 + 2] = col[2] * b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .95, depthWrite: false, toneMapped: false }));
    pts.frustumCulled = false; world.add(pts);
  })();

  const sunGlow = glowSprite(0xfff0d0, 650); sunGlow.position.copy(SUN_DIR).multiplyScalar(2000);
  const sunHaze = glowSprite(0xffb870, 1500, .16); sunHaze.position.copy(sunGlow.position);
  world.add(sunGlow, sunHaze);

  // --- planets ---
  function earthTexture() {
    const [c, x] = cv(1024, 512);
    x.fillStyle = '#1c5fb8'; x.fillRect(0, 0, 1024, 512);
    const blob = (px, py, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rnd(0, 3), 0, 6.283); x.fill(); };
    for (let i = 0; i < 160; i++) blob(rnd(0, 1024), rnd(0, 512), rnd(20, 90), rnd(10, 40), `rgba(${20 + rnd(0, 20)},${80 + rnd(0, 40)},${170 + rnd(0, 40)},.1)`);
    [[250, 170], [330, 340], [560, 170], [620, 300], [820, 170], [870, 380], [140, 410]].forEach(([cx, cy]) => {
      for (let i = 0; i < 38; i++) blob(cx + rnd(-90, 90), cy + rnd(-70, 70), rnd(18, 62), rnd(14, 44), Math.random() < .6 ? `rgb(${50 + rnd(0, 40)},${110 + rnd(0, 50)},${50 + rnd(0, 30)})` : `rgb(${140 + rnd(0, 40)},${115 + rnd(0, 30)},${70 + rnd(0, 20)})`);
    });
    x.fillStyle = '#f2f6fa'; x.fillRect(0, 0, 1024, 22); x.fillRect(0, 490, 1024, 22);
    for (let i = 0; i < 150; i++) blob(rnd(0, 1024), rnd(20, 490), rnd(25, 110), rnd(5, 16), `rgba(255,255,255,${rnd(.18, .5)})`);
    return tex(c);
  }
  function planetTexture(cols, bands) {
    const [c, x] = cv(512, 256);
    x.fillStyle = cols[0]; x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < (bands ? 40 : 200); i++) {
      x.fillStyle = cols[1 + (i % (cols.length - 1))]; x.globalAlpha = rnd(.2, .6);
      if (bands) x.fillRect(0, rnd(0, 256), 512, rnd(3, 16)); else { x.beginPath(); x.ellipse(rnd(0, 512), rnd(0, 256), rnd(8, 50), rnd(6, 26), 0, 0, 6.283); x.fill(); }
    }
    x.globalAlpha = 1; return tex(c);
  }
  const et = earthTexture();
  const earth = new THREE.Mesh(new THREE.SphereGeometry(70, 64, 64), new THREE.MeshStandardMaterial({ map: et, emissiveMap: et, emissive: 0xffffff, emissiveIntensity: .85, roughness: .9, metalness: 0, envMapIntensity: 0 }));
  earth.position.set(150, 110, -440); earth.rotation.z = .3;
  const earthHalo = glowSprite(0x5aa8ff, 70 * 2 * 1.32, 1, haloTex); earthHalo.position.copy(earth.position);
  const mars = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 32), mat(0xffffff, { map: planetTexture(['#b5502f', '#8f3b22', '#d98a5f'], false), roughness: 1, metalness: 0, envMapIntensity: .1 }));
  mars.position.set(-190, 90, -420);
  const ringed = new THREE.Mesh(new THREE.SphereGeometry(22, 48, 48), mat(0xffffff, { map: planetTexture(['#d9b97a', '#b8935a', '#ead3a0', '#a07c48'], true), roughness: 1, metalness: 0, envMapIntensity: .1 }));
  ringed.position.set(-320, 170, -720);
  const ring = new THREE.Mesh(new THREE.RingGeometry(30, 48, 96), new THREE.MeshBasicMaterial({ color: 0xcdb98a, side: THREE.DoubleSide, transparent: true, opacity: .6 }));
  ring.rotation.x = Math.PI / 2.2; ringed.add(ring);
  world.add(earth, earthHalo, mars, ringed);

  // --- Moon ground ---
  const craters = [];
  for (let i = 0; i < 60; i++) { const r = rnd(6, 34), d = rnd(60 + r * 1.3, 330), a = rnd(0, 6.283); craters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r, p: r * rnd(.12, .2) }); }
  function heightAt(x, z) {
    const r = Math.hypot(x, z), k = THREE.MathUtils.smoothstep(r, 70, 160);
    let h = (Math.sin(x * .05) * Math.cos(z * .04) * 5 + Math.sin(x * .21 + z * .17) * .7 + Math.sin(x * .013 + 1) * Math.cos(z * .011) * 14) * k;
    for (const c of craters) {
      const t = Math.hypot(x - c.x, z - c.z) / c.r;
      if (t < .85) h -= c.p * (1 - (t / .85) * (t / .85)); else if (t < 1.4) h += c.p * .4 * Math.sin(Math.PI * (t - .85) / .55);
    }
    return h;
  }
  const gg = new THREE.PlaneGeometry(700, 700, 200, 200); gg.rotateX(-Math.PI / 2);
  const gp = gg.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, heightAt(gp.getX(i), gp.getZ(i)));
  gg.computeVertexNormals();

  const [gc, gx] = cv(2048, 2048);
  gx.fillStyle = '#8c8c8c'; gx.fillRect(0, 0, 2048, 2048);
  for (let i = 0; i < 40000; i++) { const v = Math.floor(rnd(40, 220)), s = rnd(1, 3.2); gx.fillStyle = `rgba(${v},${v},${v},${rnd(.04, .22)})`; gx.fillRect(rnd(0, 2048), rnd(0, 2048), s, s); }
  for (let i = 0; i < 500; i++) {
    const px = rnd(0, 2048), py = rnd(0, 2048), r = rnd(30, 170), g = gx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, Math.random() < .5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,0)'); gx.fillStyle = g; gx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  for (let i = 0; i < 90; i++) {
    const r = rnd(8, 70), px = rnd(r + 4, 2044 - r), py = rnd(r + 4, 2044 - r), g = gx.createRadialGradient(px, py, r * .2, px, py, r * 1.15);
    g.addColorStop(0, 'rgba(40,40,40,.55)'); g.addColorStop(.75, 'rgba(90,90,90,.25)'); g.addColorStop(.88, 'rgba(210,210,210,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    gx.fillStyle = g; gx.beginPath(); gx.arc(px, py, r * 1.15, 0, 6.283); gx.fill();
  }
  const gMap = tex(gc), gBump = tex(gc, false);
  [gMap, gBump].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(18, 18); });
  const ground = new THREE.Mesh(gg, mat(0xffffff, { map: gMap, bumpMap: gBump, bumpScale: 3, roughness: 1, metalness: 0, envMapIntensity: .25 }));
  ground.receiveShadow = true; world.add(ground);

  // rocks + pebbles (kept clear of the base area)
  const rockGeos = [...Array(6)].map(() => {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, m = {};
    for (let i = 0; i < p.count; i++) {
      const k = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(3)).join(), s = m[k] || (m[k] = rnd(.7, 1.25));
      p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * .7, p.getZ(i) * s);
    }
    g.computeVertexNormals(); return g;
  });
  const rockMat = mat(0x6e6e6e, { roughness: 1, metalness: 0, flatShading: true, envMapIntensity: .2 });
  const clear = (x, z) => !(Math.abs(x) < 46 && z > -54 && z < 62);
  for (let i = 0; i < 170; i++) {
    const a = rnd(0, 6.283), d = rnd(28, 230), x = Math.cos(a) * d, z = Math.sin(a) * d - 8; if (!clear(x, z)) continue;
    const s = rnd(.4, 2.6), r = new THREE.Mesh(rockGeos[i % 6], rockMat);
    r.scale.set(s * rnd(.8, 1.4), s, s * rnd(.8, 1.4)); r.position.set(x, heightAt(x, z) + s * .15, z);
    r.rotation.y = rnd(0, 6.28); r.castShadow = r.receiveShadow = true; world.add(r);
  }
  const peb = new THREE.InstancedMesh(rockGeos[0], rockMat, 500), dm = new THREE.Object3D();
  for (let i = 0; i < 500; i++) {
    const a = rnd(0, 6.283), d = rnd(5, 130), x = Math.cos(a) * d, z = Math.sin(a) * d + 10, s = clear(x, z) ? rnd(.06, .22) : .0001;
    dm.position.set(x, heightAt(x, z) + s * .1, z); dm.scale.set(s, s, s); dm.rotation.y = rnd(0, 6); dm.updateMatrix(); peb.setMatrixAt(i, dm.matrix);
  }
  world.add(peb);

  // --- the landed rocket (centre-back) ---
  function makeRocket() {
    const g = new THREE.Group();
    const steel = mat(0xcdd3dc, { metalness: .95, roughness: .28, envMapIntensity: 1.3 });
    const tile = mat(0x14171c, { metalness: .3, roughness: .75, side: THREE.DoubleSide });
    const pts = [V(0, 2.4, 0), V(2.6, 2.4, 0)];
    for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push(V(2.6 * Math.sqrt(1 - u * u), 19 + 7 * u, 0)); }
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p.x, p.y)), 40), steel));
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(2.64, 2.64, 16.4, 28, 1, true, .2, 2.4), tile); shield.position.y = 10.6; g.add(shield);
    [6, 11, 16].forEach(y => { const b = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, .12, 40), mat(0x555c68)); b.position.y = y; g.add(b); });
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, .35, .2), glow(0x9fd4ff, 1.4)); win.position.set(0, 21, 2.2); win.rotation.x = -.15; g.add(win);
    [-1, 1].forEach(s => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(.2, 3.4, 2), steel); f.position.set(s * 2.9, 21, 0); f.rotation.z = s * .35; g.add(f);
      const af = new THREE.Mesh(new THREE.BoxGeometry(.25, 5, 3), tile); af.position.set(s * 3.4, 5.5, 0); af.rotation.z = -s * .25; g.add(af);
    });
    for (let i = 0; i < 3; i++) {
      const a = i * 2.094 + .5, top = V(Math.cos(a) * 2.5, 6, Math.sin(a) * 2.5), bot = V(Math.cos(a) * 6.8, .25, Math.sin(a) * 6.8);
      g.add(strut(top, bot, .22, steel));
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, .3, 16), steel); pad.position.copy(bot); g.add(pad);
    }
    for (let i = 0; i < 3; i++) {
      const a = i * 2.094, e = new THREE.Mesh(new THREE.CylinderGeometry(.55, .95, 1.8, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: 0xff6a1a, emissiveIntensity: .35, metalness: .8, roughness: .4, side: THREE.DoubleSide }));
      e.position.set(Math.cos(a) * 1.1, 1.5, Math.sin(a) * 1.1); g.add(e);
    }
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.4, .2, 48), mat(0x2d3038, { roughness: .9, metalness: .2 })); pad.position.y = .05; pad.receiveShadow = true; g.add(pad);
    const hz = new THREE.Mesh(new THREE.RingGeometry(9.2, 9.8, 48), new THREE.MeshBasicMaterial({ color: 0xffb300 })); hz.rotation.x = -Math.PI / 2; hz.position.y = .17; g.add(hz);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  const rocket = makeRocket(); rocket.position.set(0, 0, -40); rocket.scale.setScalar(1.25); world.add(rocket);
  const engineLight = new THREE.PointLight(0xff7a2a, 3, 34); engineLight.position.set(0, 2.5, -40); world.add(engineLight);

  // --- astronaut model ---
  function makeAstronaut(s = 1) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const suit = mat(0xeceff2, { roughness: .8, metalness: .05, envMapIntensity: .5 });
    const grey = mat(0xb4bac4, { roughness: .6, metalness: .3 });
    const dark = mat(0x2a2e36, { roughness: .7, metalness: .3 });
    const gold = mat(0xe0a820, { roughness: .06, metalness: 1, envMapIntensity: 1.6 });
    const add = (geo, m, x, y, z, p = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); p.add(o); return o; };
    add(new THREE.SphereGeometry(.52, 20, 16), suit, 0, 1.75, 0).scale.set(1, 1.1, .75);
    add(new THREE.BoxGeometry(.5, .35, .1), grey, 0, 1.85, .38);
    add(new THREE.BoxGeometry(.09, .09, .04), glow(0x7ddba3, 1.6), -.15, 1.9, .44);
    add(new THREE.BoxGeometry(.09, .09, .04), glow(0xff5d5d, 1.6), .05, 1.9, .44);
    add(new THREE.CylinderGeometry(.3, .34, .2, 20), grey, 0, 2.28, 0);
    add(new THREE.SphereGeometry(.44, 24, 18), suit, 0, 2.6, 0);
    add(new THREE.SphereGeometry(.37, 24, 18), gold, 0, 2.58, .14).scale.set(1, .85, .8);
    add(new THREE.BoxGeometry(.8, 1, .38), grey, 0, 1.8, -.5);
    add(new THREE.CylinderGeometry(.14, .14, .9, 12), suit, -.22, 1.8, -.78);
    add(new THREE.CylinderGeometry(.14, .14, .9, 12), suit, .22, 1.8, -.78);
    add(new THREE.CylinderGeometry(.42, .38, .35, 16), suit, 0, 1.18, 0);
    const legs = [-1, 1].map(sx => {
      const p = new THREE.Group(); p.position.set(sx * .22, 1.14, 0); body.add(p);
      add(new THREE.CylinderGeometry(.19, .16, .55, 14), suit, 0, -.3, 0, p);
      add(new THREE.SphereGeometry(.17, 12, 10), grey, 0, -.58, .02, p);
      add(new THREE.CylinderGeometry(.16, .15, .5, 14), suit, 0, -.82, 0, p);
      add(new THREE.BoxGeometry(.3, .2, .5), dark, 0, -1.02, .08, p); return p;
    });
    const arms = [-1, 1].map(sx => {
      const p = new THREE.Group(); p.position.set(sx * .62, 2.05, 0); p.rotation.z = sx * .08; body.add(p);
      add(new THREE.SphereGeometry(.18, 12, 10), grey, 0, 0, 0, p);
      add(new THREE.CylinderGeometry(.16, .14, .55, 14), suit, 0, -.3, 0, p);
      add(new THREE.CylinderGeometry(.14, .13, .45, 14), suit, 0, -.75, .03, p);
      add(new THREE.SphereGeometry(.15, 12, 10), dark, 0, -1.05, .05, p); return p;
    });
    g.scale.setScalar(s); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.userData = { body, legs, arms }; return g;
  }
  function walkPose(a, t, ph, sp = 3.6) {
    const u = a.userData, s = Math.sin(t * sp + ph);
    u.legs[0].rotation.x = s * .7; u.legs[1].rotation.x = -s * .7;
    u.arms[0].rotation.x = -s * .5; u.arms[1].rotation.x = s * .5;
    u.body.position.y = Math.abs(Math.cos(t * sp + ph)) * .2;
  }
  const hero = makeAstronaut(.9); hero.position.set(-1.8, 0, 47.4); hero.rotation.y = Math.PI; world.add(hero);
  const walkers = [
    { cx: -12, cz: 30, r: 5, s: .35 }, { cx: 12, cz: 32, r: 5.5, s: -.3 }, { cx: 0, cz: 20, r: 4, s: .4 },
    { cx: -9, cz: -10, r: 4, s: -.3 }, { cx: 10, cz: -8, r: 4, s: .35 }
  ].map((c, i) => { const a = makeAstronaut(.85); a.userData.c = c; a.userData.ph = i * 2; world.add(a); return a; });

  // =====================================================
  //  DEPARTMENT BUILDINGS (two on the left, two on the right)
  // =====================================================
 const DEPTS = [
  { id: 'life', name: 'Life Support', x: -34, z: 14, color: '#6ab4ff', tagY: 15,
    items: [['Oxygen Generator', 'A', 'tank'], ['CO₂ Filter', 'B', 'battery'], ['Power Battery', 'C', 'battery']],
    cam: { pos: [0, 5.2, 11.2], look: [0, 3.2, -3] },
    res: [
      { name: 'Oxygen Generator', short: 'O₂ reserve', pct: 86, tip: 'oxygen supply is healthy.' },
      { name: 'CO₂ Filter', short: 'Filter capacity', pct: 48, tip: 'filter will need replacing soon.' },
      { name: 'Power Battery', short: 'Battery charge', pct: 17, tip: 'recharge needed now!' }
    ] },
  { id: 'power', name: 'Power Budgeting', x: -78, z: -10, color: '#ffc46a', tagY: 13.5,
    items: [['Solar Panel', 'A', 'panel'], ['Battery Bank', 'B', 'battery'], ['Power Console', 'C', 'console']],
    cam: { pos: [0, 6.4, 10.8], look: [0, 2.8, -6] },
    con: { x: 7, z: 3, ry: -.35 },
    res: [
      { name: 'Solar Panel', short: 'Charge output', pct: 90, tip: 'solar output is strong.' },
      { name: 'Battery Bank', short: 'Stored energy', pct: 50, tip: 'stored energy is running low.' },
      { name: 'Power Console', short: 'Load margin', pct: 15, tip: 'load is too high, reduce power use now!' }
    ] },
  { id: 'comms', name: 'Communication', x: 36, z: 10, color: '#ffb066', tagY: 14,
    items: [['Antenna Dish', 'A', 'dish'], ['Bandwidth Router', 'B', 'console'], ['Signal Delay Clock', 'C', 'console']],
    cam: { pos: [0, 6.4, 10.8], look: [0, 2.8, -6] },
    con: { x: 7.4, z: 3, ry: -.35 },
    res: [
      { name: 'Antenna Dish', short: 'Signal strength', pct: 88, tip: 'signal is strong.' },
      { name: 'Bandwidth Router', short: 'Free bandwidth', pct: 46, tip: 'bandwidth is getting crowded.' },
      { name: 'Signal Delay Clock', short: 'Delay margin', pct: 14, tip: 'delay is too high, messages will arrive late!' }
    ] },
  { id: 'supply', name: 'Water & Food', x: 82, z: -14, color: '#7ddba3', tagY: 12.5,
    items: [['Water Tank', 'A', 'tank'], ['Food Crates', 'B', 'crate'], ['Recycler', 'C', 'battery']],
    cam: { pos: [0, 6.4, 10.8], look: [0, 2.8, -6] },
    con: { x: 7, z: 3, ry: -.35 },
    res: [
      { name: 'Water Tank', short: 'Water level', pct: 84, tip: 'water is plentiful.' },
      { name: 'Food Crates', short: 'Food stock', pct: 42, tip: 'order more supplies soon.' },
      { name: 'Recycler', short: 'Recycler capacity', pct: 14, tip: 'recycler is almost full, service it now!' }
    ] }
];
  // Category A = Core Survival: water stays, but there is no food production (no greenhouse plants, no food stock)
  const GAME_MODE = (() => { try { return localStorage.getItem('mode') === 'B' ? 'B' : 'A'; } catch (e) { return 'A'; } })();
  if (GAME_MODE === 'A') {
    const sd = DEPTS.find(d => d.id === 'supply');
    if (sd) { sd.name = 'Water Supply'; sd.items[1] = ['Water Filters', 'B', 'crate']; sd.res[1] = { name: 'Water Filters', short: 'Filter stock', pct: 60, tip: 'order more filters soon.' }; }
  }
  const [sc, sx2] = cv(256, 256);
  sx2.fillStyle = '#0c1d44'; sx2.fillRect(0, 0, 256, 256); sx2.strokeStyle = '#6f8fd0'; sx2.lineWidth = 2;
  for (let i = 0; i <= 8; i++) { sx2.beginPath(); sx2.moveTo(i * 32, 0); sx2.lineTo(i * 32, 256); sx2.moveTo(0, i * 32); sx2.lineTo(256, i * 32); sx2.stroke(); }
  const solarTex = tex(sc);
  const solarMat = mat(0xffffff, { map: solarTex, metalness: .6, roughness: .25, envMapIntensity: 1 });
  const solarSideTex = solarTex.clone(); solarSideTex.wrapS = solarSideTex.wrapT = THREE.RepeatWrapping; solarSideTex.repeat.set(10, 2); solarSideTex.needsUpdate = true;
  const solarSideMat = mat(0xffffff, { map: solarSideTex, metalness: .6, roughness: .25, envMapIntensity: 1 });
  const hazTex = (() => {
    const [c, x] = cv(64, 64); x.fillStyle = '#e6b020'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#16181c';
    for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 20, 0); x.lineTo(i * 20 + 10, 0); x.lineTo(i * 20 + 42, 64); x.lineTo(i * 20 + 32, 64); x.fill(); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t;
  })();
  const hazMat = mat(0xffffff, { map: hazTex, roughness: .6, metalness: .3 });
  const white = mat(0xeef1f5, { roughness: .5, metalness: .3 }), darkM = mat(0x39404d, { roughness: .6, metalness: .6 });
  const red = mat(0xc9302c, { roughness: .5, metalness: .2 }), yellowM = mat(0xe6b020, { roughness: .45, metalness: .5 });
  const frameClip = [new THREE.Plane(V(0, 1, 0), -1)];
  const domes = [], pulses = [], beacons = [];

  function door(g, x, z, col, w = 2.6, h = 3.1) {
    box(g, w + .4, h + .3, .2, glow(col, 1.5), x, h / 2 + .15, z);
    box(g, w, h, .3, mat(0x10151d, { metalness: .6, roughness: .4 }), x, h / 2, z + .06);
  }
  function wnd(g, x, y, z, w, h, col = 0xffd9a0, i = 1) {
    box(g, w + .3, h + .3, .16, darkM, x, y, z); box(g, w, h, .2, glow(col, i), x, y, z + .02);
  }
  function lattice(g, x, z, h, w0, w1, m, r = .12) {
    const n = 5, legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const pt = (l, t) => { const w = w0 + (w1 - w0) * t; return V(x + l[0] * w, t * h, z + l[1] * w); };
    legs.forEach(l => g.add(strut(pt(l, 0), pt(l, 1), r, m)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      for (let j = 0; j < 4; j++) {
        const a = pt(legs[j], t), b = pt(legs[(j + 1) % 4], t); g.add(strut(a, b, r * .6, m));
        if (k < n) g.add(strut(a, pt(legs[(j + 1) % 4], (k + 1) / n), r * .5, m));
      }
    }
  }
  function dish(g, x, y, z, R, tilt) {
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.x = tilt;
    const Rs = R * 1.8, cap = new THREE.Mesh(new THREE.SphereGeometry(Rs, 40, 12, 0, Math.PI * 2, 0, Math.asin(1 / 1.8)), mat(0xf4f6f9, { side: THREE.DoubleSide, metalness: .5, roughness: .3 }));
    cap.rotation.x = Math.PI; cap.position.y = Rs; grp.add(cap);
    grp.add(strut(V(0, 0, 0), V(0, R * 1.1, 0), .1, darkM));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 12), glow(0xff8a3a, 1.2)); tip.position.y = R * 1.1; grp.add(tip);
    g.add(grp); return grp;
  }

  function buildBase(d) {
    const g = new THREE.Group(), s = d.x < 0 ? 1 : -1;  // s = direction toward the centre of the map
    if (d.id === 'life') {
      // modular white/red habitat with control tower, ramps and rover
      box(g, 14, 4.4, 9, white, 0, 2.2, 0);
      box(g, 9, 3.6, 6.4, white, -1.8, 6.2, 0);
      box(g, 4.6, 2.6, 4.6, white, -2.4, 9.3, 0);
      box(g, 4.7, 1.2, 4.7, glow(0x7fe4ff, 1.1), -2.4, 9.4, 0);
      box(g, 5.8, .3, 5.8, white, -2.4, 10.75, 0);
      cyl(g, .07, .07, 2.8, darkM, -3.6, 12.2, 0, 8); cyl(g, .05, .05, 1.6, darkM, -1.2, 11.6, 0, 8);
      box(g, 14.05, .4, .06, red, 0, 1.2, 4.52); box(g, 14.05, .4, .06, red, 0, 3.3, 4.52);
      box(g, 9.05, .35, .06, red, -1.8, 5.6, 3.22); box(g, 9.05, .35, .06, red, -1.8, 7.1, 3.22);
      box(g, .06, .4, 9.05, red, 7.02, 2.2, 0); box(g, .06, .4, 9.05, red, -7.02, 2.2, 0);
      [-5.4, -3.4, 3.4, 5.4].forEach(x => wnd(g, x, 2.6, 4.55, 1.2, 1.1));
      [-5, -3, -1, 1].forEach(x => wnd(g, x, 6.2, 3.25, 1.2, .9, 0xbfeaff, 1.1));
      door(g, 0, 4.55, d.color);
      [[-1, .588], [1, -.55]].forEach(([sg, ang]) => {
        const r = box(g, 7.2, .28, 2.4, darkM, sg * 10.3, 2.1, 1.5); r.rotation.z = ang * -sg * -1 * (sg < 0 ? 1 : 1); r.rotation.z = sg < 0 ? .588 : -.588;
        [-1.1, 1.1].forEach(zz => { const rl = box(g, 7.2, .12, .1, yellowM, sg * 10.3, 2.7, 1.5 + zz); rl.rotation.z = r.rotation.z; });
      });
      cyl(g, .9, .9, 7, hazMat, -7.9, 5.4, -2, 20); cyl(g, .7, .7, 4, hazMat, -6.3, 8.4, -2, 16).rotation.z = Math.PI / 2;
      // six-wheel rover
      const rv = new THREE.Group(); rv.position.set(s * 5.8, 0, 10); rv.rotation.y = s * .5; g.add(rv);
      box(rv, 4.4, 1, 2.2, white, 0, 1.5, 0); box(rv, 4.45, .25, 2.25, red, 0, 1.55, 0);
      box(rv, 2, .9, 1.8, white, -.9, 2.45, 0); box(rv, 1.7, .6, 1.85, mat(0x1a2a3a, { metalness: .9, roughness: .1 }), -.9, 2.5, 0);
      cyl(rv, .08, .08, 1.6, darkM, 1.4, 2.9, 0, 6);
      [-1.6, 0, 1.6].forEach(x => [-1.3, 1.3].forEach(zz => { const w = cyl(rv, .66, .66, .5, mat(0x15171b, { roughness: .9, metalness: .1 }), x, .66, zz, 18); w.rotation.x = Math.PI / 2; }));
    } else if (d.id === 'power') {
      // dark power station with solar-cladded tower, solar fields, tanks
      box(g, 11, 5, 8.4, mat(0x2c3547, { metalness: .5, roughness: .5 }), 0, 2.5, 0);
      box(g, 11.4, .3, 8.8, white, 0, 5.15, 0);
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 4.2, 40), solarSideMat); tw.position.set(0, 7.4, -.6); g.add(tw);
      cyl(g, 3.4, 3.4, .25, white, 0, 9.55, -.6, 40);
      const top = new THREE.Mesh(new THREE.CircleGeometry(3, 40), solarMat); top.rotation.x = -Math.PI / 2; top.position.set(0, 9.7, -.6); g.add(top);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3.3, .2, 10, 48), white); rim.rotation.x = Math.PI / 2; rim.position.set(0, 9.62, -.6); g.add(rim);
      const rg = new THREE.Mesh(new THREE.TorusGeometry(3.32, .06, 8, 48), glow(0xffc46a, 1.6)); rg.rotation.x = Math.PI / 2; rg.position.set(0, 5.5, -.6); g.add(rg);
      [-4, -2, 2, 4].forEach(x => wnd(g, x, 2.9, 4.25, 1.3, 1.5, 0xffb347, 1.5));
      box(g, 4, .12, 3, glow(0xffb347, 1.6), 3.5, 5.35, 2);
      door(g, 0, 4.3, d.color);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const p = box(g, 3.8, .12, 2.4, solarMat, s * (9 + c * 4.3), 1.3, 6 - r * 3.4 - 6); p.rotation.x = -.5;
        box(g, .16, 1.2, .16, darkM, s * (9 + c * 4.3), .6, 6 - r * 3.4 - 6);
      }
      for (let c = 0; c < 4; c++) { const p = box(g, 3.8, .12, 2.4, solarMat, -s * 2.8 + s * c * 4.3 - s * 0, 1.3, 11.5); p.rotation.x = -.5; box(g, .16, 1.2, .16, darkM, -s * 2.8 + s * c * 4.3, .6, 11.5); }
      [[-s * 8.2, 6.5], [-s * 8.2, 2]].forEach(([x, z], i) => {
        const t = new THREE.Mesh(new THREE.SphereGeometry(2.1, 28, 18), mat(0x4a505d, { metalness: .6, roughness: .35 })); t.scale.y = .85; t.position.set(x, 1.8, z); g.add(t);
        const gr = new THREE.Mesh(new THREE.TorusGeometry(2.1, .06, 8, 36), glow(0xffa84a, 1.6)); gr.rotation.x = Math.PI / 2; gr.position.set(x, .6, z); g.add(gr);
      });
      cyl(g, 1.1, 1.1, 3.4, white, -s * 8, 1.7, -3.5, 24); cyl(g, 1.14, 1.14, .4, glow(0x7fd0ff, 1.2), -s * 8, 2.2, -3.5, 24);
      lattice(g, -s * 6.5, -6, 13, 1.1, .35, darkM, .09);
      const bc = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 10), glow(0xff3030, 2)); bc.position.set(-s * 6.5, 13.2, -6); g.add(bc);
      const gl = glowSprite(0xff3030, 3); gl.position.copy(bc.position); g.add(gl); beacons.push(gl);
      [[-5.5, 5.4], [5.5, 5.4]].forEach(([x, z]) => { const l = glowSprite(0xffc46a, 2.2, .9); l.position.set(x, .8, 6 + 5.4 - z + z - 5.4 + 5.2); g.add(l); });
    } else if (d.id === 'comms') {
      // low steel station, big dish on the roof, lattice tower with sphere pod, side dish, solar panels
      box(g, 11, 3.6, 7.6, mat(0x586274, { metalness: .7, roughness: .4 }), 0, 1.8, 0);
      box(g, 11.3, .3, 7.9, white, 0, 3.75, 0);
      box(g, 5.6, 2.4, 4.8, mat(0x434c5e, { metalness: .7, roughness: .4 }), -1.5, 5.1, 0);
      box(g, 5.9, .25, 5.1, white, -1.5, 6.4, 0);
      wnd(g, -4, 2.2, 3.85, 3.4, 1, 0x6fe0ff, 1.3); wnd(g, 4, 2.2, 3.85, 3.4, 1, 0x6fe0ff, 1.3);
      wnd(g, -3.2, 5.1, 2.45, 3.2, .9, 0x9fe8ff, 1.2);
      door(g, 0, 3.85, d.color);
      cyl(g, .45, .7, 3.4, darkM, 3.4, 5.6, .5, 14);
      dish(g, 3.4, 7.3, .5, 3.5, .7);
      cyl(g, .3, .45, 2.2, darkM, s * 8.6, 1.1, 5.5, 12); dish(g, s * 8.6, 2.4, 5.5, 1.9, .9);
      lattice(g, -s * 8.2, -3, 15, 1.4, .35, mat(0xa4adbb, { metalness: .8, roughness: .35 }), .1);
      const pod = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 18), mat(0xdfe5ec, { metalness: .7, roughness: .25 })); pod.position.set(-s * 8.2, 12.2, -3); g.add(pod);
      const bc = new THREE.Mesh(new THREE.SphereGeometry(.25, 12, 12), glow(0xff3030, 2)); bc.position.set(-s * 8.2, 15.2, -3); g.add(bc);
      const gl = glowSprite(0xff3030, 3.2); gl.position.copy(bc.position); g.add(gl); beacons.push(gl);
      for (let i = 0; i < 3; i++) { const p = box(g, 3.4, .12, 2.2, solarMat, s * (3.8 + i * 3.8), .9, 10); p.rotation.x = -.45; box(g, .14, .9, .14, darkM, s * (3.8 + i * 3.8), .45, 10); }
      [[-5.4, 4.6]].forEach(([x, z]) => { const l = glowSprite(0x6fe0ff, 2, .9); l.position.set(x, 1, z); g.add(l); });
    } else {
      // geodesic glass greenhouse dome
      const R = 8.4;
      cyl(g, R + .5, R + .7, 1, mat(0xdfe5ec, { metalness: .6, roughness: .35 }), 0, .5, 0, 56);
      const gl = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcff6e0, emissive: 0x2f8f4f, emissiveIntensity: .18, transparent: true, opacity: .22, roughness: .05, metalness: .1, side: THREE.DoubleSide, depthWrite: false }));
      gl.position.y = 1; g.add(gl);
      const wf = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R + .04, 2)), new THREE.LineBasicMaterial({ color: 0xe9fff2, clippingPlanes: frameClip })); wf.position.y = 1; g.add(wf);
      // inside: soil beds + plants
      const list = [];
      (GAME_MODE === 'A' ? [] : [-4.4, -.6, 3.2]).forEach(z => {
        box(g, 11, .7, 2, mat(0x3b2f24, { roughness: 1, metalness: 0 }), 0, 1.35, z); box(g, 11.2, .22, 2.2, white, 0, 1.55, z);
        for (let i = 0; i < 34; i++) list.push({ x: rnd(-5.2, 5.2), y: 1.85 + rnd(0, .3), z: z + rnd(-.8, .8), s: rnd(.28, .55) });
      });
      const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat(0xffffff, { roughness: .8, metalness: 0, flatShading: true, envMapIntensity: .3 }), list.length);
      const o = new THREE.Object3D(), col = new THREE.Color();
      list.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.scale.set(p.s, p.s * .8, p.s); o.rotation.y = rnd(0, 6); o.updateMatrix(); im.setMatrixAt(i, o.matrix); col.setHSL(rnd(.22, .36), rnd(.55, .8), rnd(.28, .45)); im.setColorAt(i, col); });
      if (list.length) g.add(im);
      [[-3.4, 5.6, Math.PI], [3.4, -6.4, 0]].forEach(([x, z, ry]) => { const a = makeAstronaut(.62); a.position.set(x, 1, z); a.rotation.y = ry; g.add(a); });
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, l = glowSprite(0xe9ffd8, 2.4, .8); l.position.set(Math.cos(a) * 4.2, 6.2, Math.sin(a) * 4.2); g.add(l); }
      // tunnel + door
      const tun = new THREE.CylinderGeometry(1.5, 1.5, 3.2, 24); tun.rotateX(Math.PI / 2);
      const tm = new THREE.Mesh(tun, white); tm.position.set(0, 1.7, R + 1.1); g.add(tm);
      const tr = new THREE.Mesh(new THREE.TorusGeometry(1.4, .16, 12, 32), glow(d.color, 1.6)); tr.position.set(0, 1.7, R + 2.75); g.add(tr);
      const tc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), glow(d.color, .9)); tc.position.set(0, 1.7, R + 2.72); g.add(tc);
      // tanks + crates beside the dome
      [[s * 11.4, 4], [s * 11.4, 7.4]].forEach(([x, z]) => { cyl(g, 1.2, 1.2, 4.2, white, x, 2.1, z, 24); cyl(g, 1.24, 1.24, .5, glow(0x6fd0ff, 1.2), x, 2.6, z, 24); });
      [[s * 11.2, 10.5], [s * 13.4, 10.2]].forEach(([x, z], i) => box(g, 1.9, 1.9, 1.9, mat(0x9a7b4f, { metalness: .1, roughness: .8 }), x, .95, z).rotation.y = i * .3);
      box(g, 1.6, 1.6, 1.6, mat(0x9a7b4f, { metalness: .1, roughness: .8 }), s * 11.4, 2.7, 10.4);
    }
    // glowing floor pulse + name tag
    const ringG = new THREE.RingGeometry(d.id === 'supply' ? 12.2 : 10.6, d.id === 'supply' ? 13 : 11.4, 56); ringG.rotateX(-Math.PI / 2);
    const pr = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    pr.position.y = .09; g.add(pr); pulses.push(pr.material); d.ringMat = pr.material; pr.raycast = () => {};
    const tag = label(d.name, d.color); tag.position.y = d.tagY; g.add(tag);
    g.position.set(d.x, 0, d.z); g.userData.dept = d; d.group = g;
    g.traverse(o => { if (o.isMesh && !(o.material && o.material.transparent && o.material.opacity < .3)) { o.castShadow = true; o.receiveShadow = true; } });
    world.add(g); domes.push(g);
  }
  DEPTS.forEach(buildBase);

  const lamps = [];
  for (let k = 0; k < 6; k++) [-8, 8].forEach(x => {   // little path lights leading to the rocket
    const z = 46 - k * 11, post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.3, 6), darkM); post.position.set(x, .65, z);
    const lamp = glowSprite(0xffe2a8, 1.7); lamp.position.set(x, 1.4, z); world.add(post, lamp); lamps.push(lamp);
  });

  // =====================================================
  //  INTERIORS
  // =====================================================
  function panelTexture() {
    const [c, x] = cv(512, 512);
    x.fillStyle = '#dde4ec'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(0,0,0,${rnd(.01, .05)})`; x.fillRect(rnd(0, 512), rnd(0, 512), rnd(20, 120), rnd(10, 60)); }
    x.strokeStyle = '#8f9bad'; x.lineWidth = 4;
    for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * 256, 0); x.lineTo(i * 256, 512); x.moveTo(0, i * 256); x.lineTo(512, i * 256); x.stroke(); }
    x.fillStyle = '#6c788b';
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) [[18, 18], [238, 18], [18, 238], [238, 238]].forEach(([a, b]) => { x.beginPath(); x.arc(i * 256 + a, j * 256 + b, 4, 0, 6.283); x.fill(); });
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function screenTex(title, lv) {
    const [c, x] = cv(256, 160), col = LEVEL[lv], n = { A: 9, B: 5, C: 2 }[lv];
    x.fillStyle = '#04101c'; x.fillRect(0, 0, 256, 160); x.strokeStyle = col; x.lineWidth = 4; x.strokeRect(2, 2, 252, 156);
    x.fillStyle = col; x.font = '700 22px Barlow, sans-serif'; x.textAlign = 'left'; x.fillText(title.toUpperCase().slice(0, 18), 12, 30);
    for (let i = 0; i < 10; i++) { x.fillStyle = i < n ? col : 'rgba(255,255,255,.1)'; x.fillRect(14 + i * 23, 50, 18, 66); }
    x.fillStyle = col; x.font = '700 20px Barlow, sans-serif'; x.fillText({ A: 'GOOD', B: 'LOW', C: 'CRITICAL' }[lv], 12, 146);
    return tex(c);
  }
  function techTex(kind, col = '#6ab4ff', title = 'SYSTEM') {
    const [c, x] = cv(256, 160);
    x.fillStyle = '#04101c'; x.fillRect(0, 0, 256, 160); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 2; x.strokeRect(2, 2, 252, 156);
    x.font = '700 14px Barlow, sans-serif'; x.fillText(title, 10, 20);
    if (kind === 0) { [18, 36, 54].forEach(r => { x.beginPath(); x.arc(128, 92, r, 0, 6.283); x.stroke(); }); x.beginPath(); x.moveTo(128, 92); x.lineTo(176, 56); x.stroke(); for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(rnd(90, 166), rnd(60, 124), 3, 0, 6.283); x.fill(); } }
    else if (kind === 1) { x.beginPath(); for (let i = 0; i < 240; i++) { const y = 92 + Math.sin(i * .12) * 28 * Math.sin(i * .03 + 1); i ? x.lineTo(8 + i, y) : x.moveTo(8, y); } x.stroke(); x.globalAlpha = .3; x.fillRect(8, 134, 240, 2); x.globalAlpha = 1; }
    else if (kind === 2) { for (let i = 0; i < 14; i++) x.fillRect(12 + i * 17, 140 - rnd(14, 100), 11, 100); }
    else { x.beginPath(); x.arc(128, 92, 50, 0, 6.283); x.stroke(); x.beginPath(); x.ellipse(128, 92, 22, 50, 0, 0, 6.283); x.stroke(); x.beginPath(); x.ellipse(128, 92, 50, 18, 0, 0, 6.283); x.stroke(); x.beginPath(); x.moveTo(78, 92); x.lineTo(178, 92); x.stroke(); }
    return tex(c);
  }
  function commTex(i) {
    const [c, x] = cv(256, 160), col = '#7dffb0';
    x.fillStyle = '#06141a'; x.fillRect(0, 0, 256, 160); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 2; x.strokeRect(3, 3, 250, 154);
    x.font = '700 13px Barlow, sans-serif'; x.fillText(['COMMUNICATIONS', 'FOUNDATION SERVICES', 'HEALTH SYSTEMS'][i], 10, 20);
    x.globalAlpha = .6; x.font = '11px Barlow, sans-serif'; x.fillText('ONLINE', 10, 34); x.globalAlpha = 1;
    if (i === 0) { x.beginPath(); x.arc(70, 94, 44, 0, 6.283); x.stroke(); x.beginPath(); x.ellipse(70, 94, 18, 44, 0, 0, 6.283); x.stroke(); x.beginPath(); x.ellipse(70, 94, 44, 16, 0, 0, 6.283); x.stroke(); x.beginPath(); x.moveTo(150, 120); x.lineTo(200, 60); x.lineTo(230, 120); x.stroke(); for (let k = 0; k < 8; k++) x.fillRect(150 + k * 11, 136, 7, 5); }
    else if (i === 1) { x.strokeRect(60, 70, 110, 36); [78, 110, 152].forEach(px => { x.beginPath(); x.arc(px, 112, 11, 0, 6.283); x.stroke(); }); x.strokeRect(84, 54, 40, 16); for (let k = 0; k < 6; k++) x.fillRect(190, 50 + k * 14, 40 - k * 4, 6); }
    else { x.beginPath(); x.arc(80, 90, 34, 0, 6.283); x.stroke(); x.beginPath(); x.arc(80, 94, 20, .2, 2.9); x.stroke(); for (let k = 0; k < 10; k++) x.fillRect(140 + k * 10, 130 - rnd(10, 70), 6, 70); }
    return tex(c);
  }
  function rackTex() {
    const [c, x] = cv(128, 256);
    x.fillStyle = '#0b0f16'; x.fillRect(0, 0, 128, 256);
    for (let r = 0; r < 16; r++) {
      x.fillStyle = '#161d29'; x.fillRect(6, 8 + r * 15, 116, 12);
      for (let k = 0; k < 9; k++) { x.fillStyle = Math.random() < .7 ? '#44ffa0' : Math.random() < .5 ? '#5ad0ff' : '#ffb347'; x.globalAlpha = rnd(.5, 1); x.fillRect(12 + k * 8, 12 + r * 15, 4, 4); }
      x.globalAlpha = 1;
    }
    return tex(c);
  }
  const starCeil = (() => {
    const [c, x] = cv(512, 512); x.fillStyle = '#01030a'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(255,255,255,${rnd(.3, 1)})`; x.fillRect(rnd(0, 512), rnd(0, 512), 1.5, 1.5); }
    return tex(c);
  })();

  // --- what you see through a window, per department ---
  const winCache = {};
  function windowView(kind) {
    if (winCache[kind]) return winCache[kind];
    const [c, x] = cv(1024, 512);
    x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(255,255,255,${rnd(.3, 1)})`; const s = Math.random() < .1 ? 2 : 1; x.fillRect(rnd(0, 1024), rnd(0, 330), s, s); }
    const ex = kind === 'solar' ? 780 : kind === 'comms' ? 560 : 250, ey = 150;
    let g = x.createRadialGradient(ex, ey, 62, ex, ey, 100); g.addColorStop(0, 'rgba(110,180,255,.55)'); g.addColorStop(1, 'rgba(110,180,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(ex, ey, 100, 0, 6.283); x.fill();
    x.save(); x.beginPath(); x.arc(ex, ey, 64, 0, 6.283); x.clip();
    x.fillStyle = '#1f64c0'; x.fillRect(ex - 70, ey - 70, 140, 140);
    for (let i = 0; i < 14; i++) { x.fillStyle = Math.random() < .6 ? `rgb(${60 + rnd(0, 30)},${120 + rnd(0, 40)},${60})` : `rgb(${150 + rnd(0, 30)},${120},${80})`; x.beginPath(); x.ellipse(ex + rnd(-50, 50), ey + rnd(-50, 50), rnd(8, 26), rnd(6, 18), rnd(0, 3), 0, 6.283); x.fill(); }
    for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(255,255,255,${rnd(.2, .55)})`; x.beginPath(); x.ellipse(ex + rnd(-55, 55), ey + rnd(-55, 55), rnd(10, 34), rnd(3, 8), 0, 0, 6.283); x.fill(); }
    g = x.createRadialGradient(ex + 24, ey - 18, 10, ex, ey, 74); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,10,30,.65)'); x.fillStyle = g; x.fillRect(ex - 70, ey - 70, 140, 140);
    x.restore();
    const hills = (y0, amp, c0, c1) => {
      const gr = x.createLinearGradient(0, y0 - amp, 0, 512); gr.addColorStop(0, c0); gr.addColorStop(1, c1); x.fillStyle = gr;
      x.beginPath(); x.moveTo(0, 512); for (let px = 0; px <= 1024; px += 16) x.lineTo(px, y0 - Math.abs(Math.sin(px * .008 + y0)) * amp - Math.sin(px * .031) * amp * .2); x.lineTo(1024, 512); x.fill();
    };
    hills(340, 60, '#7e7e82', '#2c2c30'); hills(380, 26, '#9a9a9e', '#46464a');
    for (let i = 0; i < 24; i++) { x.fillStyle = 'rgba(30,30,34,.45)'; x.beginPath(); x.ellipse(rnd(0, 1024), rnd(400, 505), rnd(10, 46), rnd(3, 9), 0, 0, 6.283); x.fill(); }
    if (kind === 'solar') {
      for (let r = 0; r < 6; r++) {
        const y = 372 + r * 24, w = 52 + r * 22, h = 12 + r * 6;
        for (let k = -6; k <= 6; k++) {
          const px = 512 + k * (62 + r * 24); x.fillStyle = '#1b3f8f'; x.fillRect(px - w / 2, y - h / 2, w, h);
          x.strokeStyle = 'rgba(157,183,255,.8)'; x.lineWidth = 1; x.strokeRect(px - w / 2, y - h / 2, w, h); x.beginPath(); x.moveTo(px, y - h / 2); x.lineTo(px, y + h / 2); x.stroke();
        }
      }
      x.strokeStyle = '#b8bec8'; x.lineWidth = 3; x.beginPath(); x.moveTo(110, 360); x.lineTo(130, 250); x.lineTo(150, 360); x.moveTo(118, 320); x.lineTo(142, 320); x.moveTo(124, 285); x.lineTo(136, 285); x.stroke();
    } else if (kind === 'comms') {
      x.fillStyle = '#cfd5dd'; x.fillRect(296, 320, 14, 70);
      x.save(); x.translate(303, 318); x.rotate(-.55); x.fillStyle = '#eef2f7'; x.beginPath(); x.ellipse(0, 0, 80, 26, 0, 0, 6.283); x.fill(); x.strokeStyle = '#8a93a0'; x.lineWidth = 2; x.stroke(); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -64); x.stroke(); x.fillStyle = '#ff8a3a'; x.beginPath(); x.arc(0, -66, 4, 0, 6.283); x.fill(); x.restore();
      [[140, 392], [640, 410], [790, 372], [880, 400], [450, 384]].forEach(([px, py]) => { x.fillStyle = '#f2f4f7'; x.fillRect(px - 4, py - 14, 8, 14); x.beginPath(); x.arc(px, py - 17, 5, 0, 6.283); x.fill(); });
      [[540, 410], [700, 440]].forEach(([px, py]) => { x.fillStyle = '#e8b520'; x.fillRect(px, py, 44, 14); x.fillStyle = '#222'; x.fillRect(px + 2, py + 14, 10, 7); x.fillRect(px + 30, py + 14, 10, 7); });
      for (let i = 0; i < 4; i++) { x.fillStyle = '#1b3f8f'; x.beginPath(); x.moveTo(740 + i * 68, 452); x.lineTo(800 + i * 68, 446); x.lineTo(820 + i * 68, 512); x.lineTo(756 + i * 68, 512); x.fill(); }
    } else {
      x.fillStyle = 'rgba(150,240,190,.3)'; x.strokeStyle = 'rgba(220,255,235,.9)'; x.lineWidth = 2;
      [[740, 386, 110], [520, 400, 70]].forEach(([px, py, r]) => { x.beginPath(); x.ellipse(px, py, r, r * .8, 0, Math.PI, 0); x.fill(); x.stroke(); x.fillStyle = '#4fbf68'; for (let i = 0; i < 10; i++) x.fillRect(px + rnd(-r * .7, r * .7), py - rnd(2, 12), 6, 6); x.fillStyle = 'rgba(150,240,190,.3)'; });
    }
    return (winCache[kind] = tex(c));
  }
  function makeWindow(pts, kind, fcol) {
    const grp = new THREE.Group(), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])))), uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x0) / (x1 - x0), (pos.getY(i) - y0) / (y1 - y0));
    grp.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: windowView(kind), toneMapped: false })));
    const sx = 1 + .9 / ((x1 - x0) / 2), sy = 1 + .9 / ((y1 - y0) / 2);
    const outer = new THREE.Shape(pts.map(p => new THREE.Vector2(cx + (p[0] - cx) * sx, cy + (p[1] - cy) * sy)));
    outer.holes.push(new THREE.Path(pts.map(p => new THREE.Vector2(p[0], p[1]))));
    const fr = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: .5, bevelEnabled: false }), mat(fcol, { metalness: .8, roughness: .35 })); fr.position.z = -.05; grp.add(fr);
    const ln = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map(p => V(p[0], p[1], .46))), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55 })); grp.add(ln);
    return grp;
  }
  const panelBase = panelTexture();

  const SHAPES = {
    tank: (lv, col) => {
      const g = new THREE.Group(), f = { A: .9, B: .5, C: .18 }[lv], steel = mat(0xcfd6e0, { metalness: .8, roughness: .3 });
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 4.4, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: .22, roughness: .05, metalness: .2, side: THREE.DoubleSide, depthWrite: false }));
      glass.position.y = 2.5;
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 4 * f, 28), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .6, transparent: true, opacity: .8 }));
      liq.position.y = .5 + 2 * f;
      const c1 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, .4, 28), steel); c1.position.y = .2;
      const c2 = c1.clone(); c2.position.y = 4.8;
      const ringL = new THREE.Mesh(new THREE.TorusGeometry(1.3, .07, 8, 32), glow(LEVEL[lv], 1.6)); ringL.rotation.x = Math.PI / 2; ringL.position.y = 4.5;
      g.add(glass, liq, c1, c2, ringL); return g;
    },
    panel: () => {
      const g = new THREE.Group(), p = new THREE.Mesh(new THREE.BoxGeometry(4, .15, 2.8), solarMat); p.rotation.x = -.9; p.position.y = 2.4;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(.15, .25, 2, 10), darkM); s.position.y = 1; g.add(p, s); return g;
    },
    battery: (lv) => {
      const g = new THREE.Group(), on = { A: 3, B: 2, C: 1 }[lv], b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 1.6), mat(0x2f3646, { metalness: .6, roughness: .4 })); b.position.y = 1.7; g.add(b);
      for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.6, .35, .1), i < on ? glow(LEVEL[lv], 1.8) : mat(0x161a22)); l.position.set(0, .9 + i * .9, .85); g.add(l); }
      return g;
    },
    crate: () => {
      const g = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 2.5), mat(0x9a7b4f, { metalness: .1, roughness: .8 })); b.position.y = 1.25; g.add(b);
      [-.7, .7].forEach(x => { const s = new THREE.Mesh(new THREE.BoxGeometry(.2, 2.6, 2.6), mat(0x3a3f4a)); s.position.set(x, 1.25, 0); g.add(s); });
      return g;
    },
    console: (lv, col, name) => {
      const g = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 1.4), mat(0x20283a, { metalness: .6, roughness: .4 })); b.position.y = .8;
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ map: screenTex(name, lv), toneMapped: false })); sc.position.set(0, 2.3, .15); sc.rotation.x = -.35;
      const fr = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, .12), darkM); fr.position.set(0, 2.3, .08); fr.rotation.x = -.35; g.add(b, fr, sc);
      for (let i = 0; i < 5; i++) { const k = new THREE.Mesh(new THREE.BoxGeometry(.3, .12, .3), glow(i % 2 ? '#ffb066' : '#6ab4ff', 1.4)); k.position.set(-1.1 + i * .55, 1.65, .4); g.add(k); }
      return g;
    },
    dish: () => {
      const g = new THREE.Group(), p = new THREE.Mesh(new THREE.CylinderGeometry(.2, .3, 3.2, 10), darkM); p.position.y = 1.6; g.add(p);
      dish(g, 0, 3.4, 0, 2, .6); return g;
    }
  };

  const THEME = {
    life: { wall: 0xf0f4f8, floor: 0x4a5262, rough: .5, metal: .3, amb: .5, l1: 0xffffff, l2: 0xfff4d6, astro: [5.9, 4.8, -1.84] },
    power: { wall: 0x3a4660, floor: 0x232a38, rough: .5, metal: .5, amb: .3, l1: 0xffe2b8, l2: 0xbcd4ff, astro: [-10.5, 0, 2.2] },
    comms: { wall: 0x2a3140, floor: 0x1c2230, rough: .5, metal: .55, amb: .28, l1: 0xcfe8ff, l2: 0x9fd0ff, astro: [-10.5, 0, 2.2] },
    supply: { wall: 0xbfd6cc, floor: 0x4a4f46, rough: .6, metal: .2, amb: .55, l1: 0xf6ffe8, l2: 0xd8f5ff, astro: [-10.8, 3.5, -1.9] }
  };

  let interior = null, blinkers = [], alarm = null, intAstro = null, spinners = [];
  let clickables = null, hintObj = null, hintRing = null, lifeDept = null, camIn = null,hintT0 = null,panelCam = null;

  // =====================================================
  //  LIFE SUPPORT STATIONS (console, oxygen generator, CO2 filter, battery)
  // =====================================================
  const lvOf = p => p >= 70 ? 'A' : p >= 30 ? 'B' : 'C';
  const LTXT = { A: 'GOOD', B: 'LOW', C: 'CRITICAL' };
  const liveTex = [], liveRead = [];   // screens that must follow the real battery

  function readout(name, pct, unit) {   // floating holo-board showing the amount left
    const [c, x] = cv(512, 288);
    const paint = (p) => {
      const lv = lvOf(p), col = LEVEL[lv];
      x.clearRect(0, 0, 512, 288);
      x.fillStyle = 'rgba(6,14,26,.92)'; x.fillRect(0, 0, 512, 288);
      x.strokeStyle = col; x.lineWidth = 8; x.strokeRect(4, 4, 504, 280);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#eef1f6'; x.font = '700 38px Barlow, sans-serif'; x.fillText(name.toUpperCase(), 256, 44);
      x.fillStyle = col; x.font = '700 104px Barlow, sans-serif'; x.fillText(p + '%', 256, 124);
      x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(40, 182, 432, 30);
      x.fillStyle = col; x.fillRect(40, 182, 432 * p / 100, 30);
      x.fillStyle = '#eef1f6'; x.font = '600 28px Barlow, sans-serif'; x.fillText(unit + '  ·  ' + LTXT[lv], 256, 245);
    };
    paint(pct);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, toneMapped: false }));
    s.userData.repaint = (p) => { paint(p); s.material.map.needsUpdate = true; };
    s.scale.set(4.6, 2.6, 1); return s;
  }

  let louvreT = null;
  const louvre = () => louvreT || (louvreT = (() => {
    const [c, x] = cv(128, 64); x.fillStyle = '#9aa2ad'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#4b525c';
    for (let i = 0; i < 10; i++) x.fillRect(6, 6 + i * 5.6, 116, 2.4);
    x.strokeStyle = '#5c6470'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 125, 61); return tex(c);
  })());

  function consoleScreenTex(res, name) {
    const [c, x] = cv(512, 256);
    const paint = () => {
    x.clearRect(0, 0, 512, 256);
    x.fillStyle = '#03121a'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#4ff0c8'; x.lineWidth = 4; x.strokeRect(3, 3, 506, 250);
    x.fillStyle = '#4ff0c8'; x.font = '700 24px Barlow, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText(name.toUpperCase() + ' · ALL SYSTEMS', 18, 28);
    res.forEach((r, i) => {
      const y = 62 + i * 46, col = LEVEL[lvOf(r.pct)];
      x.fillStyle = '#d6e6ee'; x.font = '600 20px Barlow, sans-serif'; x.textAlign = 'left'; x.fillText(r.name, 18, y);
      x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(200, y - 10, 220, 20);
      x.fillStyle = col; x.fillRect(200, y - 10, 220 * r.pct / 100, 20);
      x.font = '700 24px Barlow, sans-serif'; x.textAlign = 'right'; x.fillText(r.pct + '%', 494, y);
    });
    x.fillStyle = '#4ff0c8'; x.font = '700 21px Barlow, sans-serif'; x.textAlign = 'center'; x.fillText('▶ CLICK TO OPEN FULL VIEW', 256, 232);
    };
    paint(); const t = tex(c);
    t.repaint = () => { paint(); t.needsUpdate = true; };
    liveTex.push(t); if (liveTex.length > 12) liveTex.shift();
    return t;
  }

  function buildO2(pct) {
    const g = new THREE.Group(), col = LEVEL[lvOf(pct)];
    const wh = mat(0xf3f5f7, { roughness: .5, metalness: .1 }), teal = mat(0x17b3a0, { roughness: .45, metalness: .2 });
    const steel = mat(0xc4cad3, { metalness: .8, roughness: .3 }), pipeM = mat(0xe9eef0, { roughness: .35, metalness: .2 });
    box(g, 11, .5, 5.2, mat(0x4a505c, { roughness: .8, metalness: .3 }), 0, .25, 0);
    [-3.4, -.6].forEach(x => {
      cyl(g, 1.05, 1.05, 5.4, wh, x, 3.2, 0, 32);
      cyl(g, 1.14, 1.14, 1.5, teal, x, 1.8, 0, 32);
      cyl(g, 1.25, 1.25, .26, steel, x, 6.0, 0, 32);
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; cyl(g, .07, .07, .22, steel, x + Math.cos(a) * 1.1, 6.2, Math.sin(a) * 1.1, 6); }
    });
    const J = (a, b, r = .13) => g.add(strut(V(a[0], a[1], a[2]), V(b[0], b[1], b[2]), r, pipeM));
    J([-3.4, 6.1, 0], [-3.4, 7.3, 0]); J([-3.4, 7.3, 0], [-.6, 7.3, 0]); J([-.6, 7.3, 0], [-.6, 6.1, 0]); J([-2, 7.3, 0], [-2, 5.4, 0]);
    // control box with O2 logo
    box(g, 1.9, 2.5, .45, teal, -2, 4.7, 1.05);
    const [lc, lx] = cv(128, 160); lx.fillStyle = '#17b3a0'; lx.fillRect(0, 0, 128, 160);
    lx.fillStyle = '#fff'; lx.beginPath(); lx.arc(64, 62, 36, 0, 6.283); lx.fill();
    lx.fillStyle = '#17b3a0'; lx.font = '700 40px Barlow, sans-serif'; lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.fillText('O₂', 64, 64);
    ['#ffb020', '#ff5d5d', '#7ddba3', '#7ddba3'].forEach((cc, i) => { lx.fillStyle = cc; lx.beginPath(); lx.arc(34 + i * 20, 128, 6, 0, 6.283); lx.fill(); });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.1), new THREE.MeshBasicMaterial({ map: tex(lc), toneMapped: false })); logo.position.set(-2, 4.7, 1.3); g.add(logo);
    // front pipe loop with flanges
    const P = (a, b) => g.add(strut(V(a[0], a[1], a[2]), V(b[0], b[1], b[2]), .26, pipeM));
    P([-3.9, .6, 1.9], [-3.9, 3.3, 1.9]); P([.1, .6, 1.9], [.1, 3.3, 1.9]); P([-3.9, 3.3, 1.9], [.1, 3.3, 1.9]); P([-3.9, 1.7, 1.9], [.1, 1.7, 1.9]); P([-2, 3.3, 1.9], [-2, 3.3, .9]);
    [[-3.9, 3.3], [.1, 3.3]].forEach(([x, y]) => { const e = new THREE.Mesh(new THREE.SphereGeometry(.26, 12, 10), pipeM); e.position.set(x, y, 1.9); g.add(e); });
    [[-3.9, 2.5], [.1, 2.5], [-2, 1.7]].forEach(([x, y]) => cyl(g, .42, .42, .16, steel, x, y, 1.9, 16).rotation.x = x === -2 ? 0 : 0);
    [-3.9, .1].forEach(x => cyl(g, .62, .62, .14, steel, x, .57, 1.9, 16));
    // oxygen tank
    const tx = 3.3;
    cyl(g, 1.7, 1.7, 4.2, wh, tx, 3.1, 0, 40);
    const capT = new THREE.Mesh(new THREE.SphereGeometry(1.7, 32, 12, 0, 6.283, 0, 1.5708), wh); capT.scale.y = .42; capT.position.set(tx, 5.2, 0); g.add(capT);
    const capB = capT.clone(); capB.rotation.x = Math.PI; capB.position.set(tx, 1.0, 0); g.add(capB);
    cyl(g, 1.2, 1.3, .6, mat(0x1b1e24, { roughness: .8, metalness: .3 }), tx, .8, 0, 28);
    const [tc, tcx] = cv(256, 96); tcx.fillStyle = '#20252b'; tcx.font = '600 56px Barlow, sans-serif'; tcx.textAlign = 'center'; tcx.textBaseline = 'middle'; tcx.fillText('OXYGEN', 128, 48);
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(1.712, 1.712, .9, 32, 1, true, -.6, 1.2), new THREE.MeshBasicMaterial({ map: tex(tc), transparent: true, depthWrite: false, toneMapped: false }));
    strip.position.set(tx, 4.1, 0); g.add(strip);
    cyl(g, .34, .34, .12, steel, tx, 2.6, 1.72, 24).rotation.x = Math.PI / 2;
    const dialF = new THREE.Mesh(new THREE.CircleGeometry(.28, 24), new THREE.MeshBasicMaterial({ color: 0xffffff })); dialF.position.set(tx, 2.6, 1.79); g.add(dialF);
    const nd = box(g, .03, .24, .02, mat(0xd33333, { roughness: .5, metalness: .2 }), tx, 2.6, 1.8); nd.geometry.translate(0, .1, 0); nd.rotation.z = (.5 - pct / 100) * 3.6;
    // live level gauge on the side of the tank
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, 4, 16), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: .25, roughness: .05, depthWrite: false })); gl.position.set(5.25, 3.1, .5); g.add(gl);
    const fh = Math.max(.15, 3.8 * pct / 100);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, fh, 16), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.1 })); fill.position.set(5.25, 1.2 + fh / 2, .5); g.add(fill);
    [1.5, 4.7].forEach(y => box(g, 1.2, .18, .2, steel, 4.7, y, .5));
    return g;
  }

  function buildCO2(pct) {
    const g = new THREE.Group(), lv = lvOf(pct), col = LEVEL[lv];
    const yel = mat(0xe3ac1c, { roughness: .55, metalness: .35 }), yel2 = mat(0xc99414, { roughness: .6, metalness: .3 });
    const steel = mat(0xb4bcc8, { metalness: .85, roughness: .3 }), tealM = mat(0x4b7a76, { metalness: .5, roughness: .5 });
    const gm = mat(0x2f8f55, { roughness: .6, metalness: .3 }), dk = mat(0x2d4b49, { roughness: .6, metalness: .5 });
    const lou = new THREE.MeshStandardMaterial({ map: louvre(), roughness: .5, metalness: .5 });
    box(g, 10, 1.6, 6.4, yel, 0, .8, 0);
    box(g, 9.4, .22, 5.8, yel2, 0, 1.7, 0);
    [-3.4, -1.1, 1.1, 3.4].forEach(x => { box(g, 1.9, 1.0, .1, dk, x, .85, 3.2); const p = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .8), lou); p.position.set(x, .85, 3.27); g.add(p); });
    const nOn = Math.ceil(pct / 20);
    for (let i = 0; i < 5; i++) box(g, .5, .16, .1, i < nOn ? glow(col, 2) : mat(0x2a2e35), -1.2 + i * .6, 1.45, 3.22);
    const st = box(g, 3.2, .3, 2.2, yel, -5.9, .8, 1.2); st.rotation.z = .45;
    box(g, .12, .9, .12, steel, -4.5, 2.1, .2); box(g, .12, .9, .12, steel, -4.5, 2.1, 2.2);
    [[-2.5, .9], [2.5, .9], [0, -1.4]].forEach(([x, z]) => {
      box(g, 2.6, 1.7, 2.4, tealM, x, 2.65, z);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.0), lou); p.position.set(x, 2.5, z + 1.21); g.add(p);
      box(g, .9, .14, .6, gm, x - .6, 3.58, z + .5); box(g, .7, .14, .5, gm, x + .7, 3.58, z - .4);
      box(g, 1.7, .3, 1.7, dk, x, 3.85, z);
      const coil = new THREE.MeshStandardMaterial({ color: 0x1a8fe0, emissive: 0x1fa3ff, emissiveIntensity: .15 + pct / 100 * 1.2, roughness: .35, metalness: .3 });
      for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(.62, .13, 8, 24), coil); t.rotation.x = Math.PI / 2; t.position.set(x, 4.2 + k * .3, z); g.add(t); }
      [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]].forEach(([a, b]) => cyl(g, .06, .06, 2.4, steel, x + a, 4.9, z + b, 8));
      box(g, 1.7, .3, 1.7, dk, x, 6.15, z); cyl(g, .12, .12, .3, steel, x - .5, 6.4, z, 8); cyl(g, .12, .12, .3, steel, x + .5, 6.4, z, 8);
      g.add(pipe([[x + 1.3, 2.4, z + .3], [x + 1.75, 2.4, z + .3], [x + 1.75, 3.1, z + .3]], .09, steel));
    });
    const fr = (a, b) => g.add(strut(V(a[0], a[1], a[2]), V(b[0], b[1], b[2]), .17, steel));
    [-4.3, 4.3].forEach(x => [-2.7, 2.7].forEach(z => fr([x, 1.7, z], [x, 5.6, z])));
    [-2.7, 2.7].forEach(z => { fr([-4.3, 5.6, z], [0, 7.0, z]); fr([0, 7.0, z], [4.3, 5.6, z]); fr([-4.3, 4.4, z], [-3.5, 5.6, z]); fr([4.3, 4.4, z], [3.5, 5.6, z]); });
    fr([-4.3, 5.6, -2.7], [-4.3, 5.6, 2.7]); fr([4.3, 5.6, -2.7], [4.3, 5.6, 2.7]); fr([0, 7.0, -2.7], [0, 7.0, 2.7]);
    return g;
  }

  function buildBattery(pct) {
    const g = new THREE.Group(), col = LEVEL[lvOf(pct)], n = Math.max(1, Math.round(pct / 20));
    const R = 3, ap = R * Math.cos(Math.PI / 8);
    const whiteM = mat(0xe6e9ee, { roughness: .6, metalness: .3 }), blk = mat(0x080c10, { roughness: .8 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 5.2, 8), mat(0x1f232b, { metalness: .65, roughness: .45 })); body.rotation.y = Math.PI / 8; body.position.y = 2.9; g.add(body);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.8, R, .35, 8), mat(0x2a2f38, { metalness: .6, roughness: .45 })); top.rotation.y = Math.PI / 8; top.position.y = 5.675; g.add(top);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, R, .5, 8), mat(0x15181e, { metalness: .6, roughness: .5 })); base.rotation.y = Math.PI / 8; base.position.y = .45; g.add(base);
    box(g, 2.2, .06, 2.2, whiteM, 0, 5.86, .3);
    const face = ang => { const f = new THREE.Group(); f.rotation.y = ang; g.add(f); return f; };
    const win = (f, w, h, y, lit) => {
      const t = .24, z = ap + .06;
      box(f, w, t, .16, whiteM, 0, y + h / 2 - t / 2, z); box(f, w, t, .16, whiteM, 0, y - h / 2 + t / 2, z);
      box(f, t, h, .16, whiteM, -w / 2 + t / 2, y, z); box(f, t, h, .16, whiteM, w / 2 - t / 2, y, z);
      box(f, w - 2 * t, h - 2 * t, .1, blk, 0, y, ap + .02);
      const span = h - 2 * t - .5;
      for (let i = 0; i < 5; i++) box(f, w - 2 * t - .4, .3, .3, i < lit ? glow(col, 2) : mat(0x0d2216), 0, y - (h - 2 * t) / 2 + .25 + i * (span / 4), ap + .14);
    };
    win(face(0), 2.1, 3.7, 2.9, n);
    const fr = face(Math.PI / 4); win(fr, 1.5, 2.6, 2.1, n);
    const fl = face(-Math.PI / 4); win(fl, 1.5, 2.6, 2.1, n);
    const [cc, cx] = cv(64, 80); cx.fillStyle = '#f2c230'; cx.fillRect(0, 0, 64, 80); cx.strokeStyle = '#111'; cx.lineWidth = 3; cx.strokeRect(3, 3, 58, 74);
    cx.fillStyle = '#111'; cx.beginPath(); cx.moveTo(36, 8); cx.lineTo(18, 42); cx.lineTo(30, 42); cx.lineTo(24, 66); cx.lineTo(46, 30); cx.lineTo(33, 30); cx.closePath(); cx.fill();
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.1), new THREE.MeshBasicMaterial({ map: tex(cc), toneMapped: false })); sign.position.set(0, 4.4, ap + .04); fr.add(sign);
    box(fl, 1.0, 1.2, .06, mat(0x3a4150, { metalness: .6, roughness: .5 }), 0, 4.4, ap + .03);
    [-1.5, 1.5].forEach(x => box(g, 1.3, .3, 1, hazMat, x, .15, ap + .55));
    return g;
  }

  function buildConsole(d) {
    const g = new THREE.Group();
    const grey = mat(0x8f95a0, { roughness: .45, metalness: .5 }), dark = mat(0x272c35, { roughness: .5, metalness: .6 });
    const lgrey = mat(0xc3c8d0, { roughness: .4, metalness: .6 }), orange = glow(0xff8a2a, 1.3), blue = mat(0x2a6fe0, { roughness: .4, metalness: .3 });
    box(g, 6.2, 1.8, 2.6, grey, 0, .9, 0);
    const slope = box(g, 5.4, .4, 1.8, dark, 0, 2.0, .6); slope.rotation.x = .2;
    const [kc, kx] = cv(256, 80); kx.fillStyle = '#10141b'; kx.fillRect(0, 0, 256, 80);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 16; k++) { kx.fillStyle = (r + k) % 5 === 0 ? '#ffb066' : '#3a4a60'; kx.fillRect(6 + k * 15.5, 6 + r * 18, 12, 14); }
    const keys = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .8), new THREE.MeshBasicMaterial({ map: tex(kc), toneMapped: false })); keys.rotation.x = -Math.PI / 2; keys.position.set(-.6, .21, .1); slope.add(keys);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .8), new THREE.MeshBasicMaterial({ map: techTex(2, '#ffb066', 'KEYPAD'), toneMapped: false })); pad.rotation.x = -Math.PI / 2; pad.position.set(1.7, .21, .1); slope.add(pad);
    // big screen
    const scrG = new THREE.Group(); scrG.position.set(0, 3.55, -.75); scrG.rotation.x = -.14; g.add(scrG);
    box(scrG, 4.1, 2.0, .4, lgrey, 0, 0, 0); box(scrG, 3.8, 1.7, .1, dark, 0, 0, .18);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.55), new THREE.MeshBasicMaterial({ map: consoleScreenTex(d.res, d.name), toneMapped: false })); sm.position.set(0, 0, .24); scrG.add(sm);
    box(g, 1.1, .8, .7, dark, 0, 2.55, -.7); box(g, .9, .12, .5, orange, 0, 2.95, -.4);
    // wings
    [-1, 1].forEach(s => {
      const w = new THREE.Group(); w.position.set(s * 3.7, 0, -.1); w.rotation.y = -s * .2; g.add(w);
      box(w, 1.1, 3.9, 2.9, dark, 0, 1.95, 0); box(w, 1.0, .12, 2.7, lgrey, 0, 3.92, 0); box(w, .2, 2.5, .06, orange, 0, 1.5, 1.48);
      const sp = new THREE.Mesh(new THREE.PlaneGeometry(.8, .6), new THREE.MeshBasicMaterial({ map: techTex(s > 0 ? 1 : 3, '#6ab4ff', s > 0 ? 'PWR' : 'AIR'), toneMapped: false })); sp.position.set(0, 3.3, 1.47); w.add(sp);
    });
    // chair
    const ch = new THREE.Group(); ch.position.set(-5.4, 0, 1.8); ch.rotation.y = 1.85; g.add(ch);
    cyl(ch, 1, 1.1, .18, dark, 0, .09, 0, 6); cyl(ch, .14, .14, 1.1, dark, 0, .7, 0, 10);
    box(ch, 1.5, .35, 1.5, dark, 0, 1.35, 0); box(ch, 1.3, .1, 1.3, blue, 0, 1.58, 0);
    box(ch, 1.5, 2.2, .4, grey, 0, 2.55, -.7).rotation.x = .12; box(ch, .45, 1.7, .06, blue, 0, 2.5, -.93);
    [-1, 1].forEach(sx => box(ch, .2, .15, 1.0, blue, sx * .85, 1.95, -.1));
    g.position.set(0, 0, 3); return g;
  }

 /* function buildLifeStations(g, d) {
    lifeDept = d; const [o2, co2, bat] = d.res;
    const put = (grp, x, z, ry, sc) => { grp.position.set(x, 0, z); grp.rotation.y = ry; grp.scale.setScalar(sc); grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(grp); };
    put(buildO2(o2.pct), -11, -6.8, .22, .85);
    put(buildCO2(co2.pct), 0, -7.6, 0, .85);
    put(buildBattery(bat.pct), 11.5, -6.4, -.25, 1);
    [[o2, -11, 8.8, -6.8], [co2, 0, 8.6, -7.6], [bat, 11.5, 7.8, -6.4]].forEach(([r, x, y, z]) => {
      const s = readout(r.name, r.pct, r.short); s.userData.res = r; liveRead.push(s); if (liveRead.length > 9) liveRead.shift(); s.position.set(x, y, z); g.add(s); if (lvOf(r.pct) === 'C') blinkers.push(s);
      const lt = new THREE.PointLight(LEVEL[lvOf(r.pct)], .9, 14); lt.position.set(x, 3, z + 3); g.add(lt);
    });
    const con = buildConsole(d);
    const CON = { x: -12.5, z: 1 };
    con.position.set(CON.x, 0, CON.z); con.rotation.y = .55; con.scale.setScalar(.75);


    con.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(con);
    // "click me" indicator: bobbing arrow + label + pulsing floor ring
    const hint = new THREE.Group();hint.position.set(CON.x, 0, CON.z);
    const lab = label('CLICK TO VIEW ALL SYSTEMS', '#7ddba3', 768, 128, 50); lab.scale.set(8.4, 1.4, 1); lab.position.set(0, 6.0, 0);
    const arr = new THREE.Mesh(new THREE.ConeGeometry(.55, 1.1, 16), glow(0x7ddba3, 2)); arr.rotation.x = Math.PI; arr.position.set(0, 5.0, 0);
    hint.add(lab, arr); g.add(hint); hintObj = hint;
    const rg = new THREE.RingGeometry(3.0, 3.3, 56); rg.rotateX(-Math.PI / 2);
    hintRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x7ddba3, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    hintRing.position.set(CON.x, .06, CON.z); g.add(hintRing);
    clickables = [con];
  } */



function buildLifeStations(g, d) {
  lifeDept = d; hintT0 = null; const [o2, co2, bat] = d.res;
  const put = (grp, x, z, ry, sc) => { grp.position.set(x, 0, z); grp.rotation.y = ry; grp.scale.setScalar(sc); grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(grp); };
  put(buildO2(o2.pct), -12.5, -6.8, .2, .75);
  put(buildCO2(co2.pct), -3.5, -7.6, 0, .75);
  put(buildBattery(bat.pct), 4.5, -6.4, -.2, .85);
  [[o2, -12.5, 7.4, -6.8], [co2, -3.5, 7.2, -7.6], [bat, 4.5, 7.0, -6.4]].forEach(([r, x, y, z]) => {
    const s = readout(r.name, r.pct, r.short); s.userData.res = r; liveRead.push(s); if (liveRead.length > 9) liveRead.shift(); s.position.set(x, y, z); g.add(s); if (lvOf(r.pct) === 'C') blinkers.push(s);
    const lt = new THREE.PointLight(LEVEL[lvOf(r.pct)], .9, 14); lt.position.set(x, 3, z + 3); g.add(lt);
  });
  // control console alone on the right side
  const CON = { x: 13, z: -4.5 };
  const con = buildConsole(d);
  con.position.set(CON.x, 0, CON.z); con.rotation.y = -.45; con.scale.setScalar(.7);
  con.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(con);
  // arrow + label above the console, ring on the floor under it
  const hint = new THREE.Group(); hint.position.set(CON.x, 0, CON.z);
  const lab = label('CLICK TO VIEW ALL SYSTEMS', '#7ddba3', 768, 128, 50); lab.scale.set(7, 1.2, 1); lab.position.set(0, 5.8, 0);
  const arr = new THREE.Mesh(new THREE.ConeGeometry(.5, 1, 16), glow(0x7ddba3, 2)); arr.rotation.x = Math.PI; arr.position.set(0, 4.7, 0);
  hint.add(lab, arr); g.add(hint); hintObj = hint;
  const rg = new THREE.RingGeometry(3.2, 3.5, 56); rg.rotateX(-Math.PI / 2);
  hintRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x7ddba3, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  hintRing.position.set(CON.x, .06, CON.z); g.add(hintRing);
  clickables = [con];
  panelCam = { pos: [10, 3.6, 1.8], look: [13, 2.8, -4.5] };  buildReserves(g);
}

function buildDeptConsole(g, d) {
  lifeDept = d; hintT0 = null;
  const C = d.con, con = buildConsole(d);
  con.position.set(C.x, 0, C.z); con.rotation.y = C.ry; con.scale.setScalar(.7);
  con.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.add(con);
  const hint = new THREE.Group(); hint.position.set(C.x, 0, C.z);
  const lab = label('CLICK TO VIEW ALL SYSTEMS', '#7ddba3', 768, 128, 50); lab.scale.set(7, 1.2, 1); lab.position.set(0, 5.8, 0);
  const arr = new THREE.Mesh(new THREE.ConeGeometry(.5, 1, 16), glow(0x7ddba3, 2)); arr.rotation.x = Math.PI; arr.position.set(0, 4.7, 0);
  hint.add(lab, arr); g.add(hint); hintObj = hint;
  const rg = new THREE.RingGeometry(3.2, 3.5, 56); rg.rotateX(-Math.PI / 2);
  hintRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x7ddba3, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  hintRing.position.set(C.x, .06, C.z); g.add(hintRing);
  clickables = [con];
  panelCam = { pos: [C.x + Math.sin(C.ry) * 6.6, 3.6, C.z + Math.cos(C.ry) * 6.6], look: [C.x, 2.6, C.z] };
}





  function buildInterior(d) {
    const g = new THREE.Group(); blinkers = []; alarm = null; spinners = [];
    const W = 34, H = 14, D = 24, T = THEME[d.id];
    const wm = (w, h, tint) => { const t = panelBase.clone(); t.needsUpdate = true; t.repeat.set(w / 6, h / 6); return mat(tint, { map: t, roughness: T.rough, metalness: T.metal, envMapIntensity: .6 }); };
    const plane = (w, h, m, x, y, z, ry = 0, rx = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx, ry, 0); p.receiveShadow = true; g.add(p); return p; };
    const add = (m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };
    const scr = (x, y, z, w, h, map, ry = 0, rx = 0) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(w + .4, h + .4, .2), darkM), s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
      s.position.z = .11; f.add(s); f.position.set(x, y, z); f.rotation.set(rx, ry, 0); g.add(f); return f;
    };
    const Y = mat(0xe8b520, { roughness: .45, metalness: .5 }), Wt = mat(0xf2f4f7, { roughness: .4, metalness: .4 }), Dk = mat(0x1b2029, { roughness: .6, metalness: .5 });

    // ---- shell ----
    plane(W, D, wm(W, D, T.floor), 0, 0, 0, 0, -Math.PI / 2);
    if (d.id === 'supply') plane(W, D, new THREE.MeshBasicMaterial({ map: starCeil, toneMapped: false }), 0, H, 0, 0, Math.PI / 2);
    else plane(W, D, wm(W, D, T.wall), 0, H, 0, 0, Math.PI / 2);
    plane(W, H, wm(W, H, T.wall), 0, H / 2, -D / 2);
    plane(W, H, wm(W, H, T.wall), 0, H / 2, D / 2, Math.PI);
    plane(D, H, wm(D, H, T.wall), -W / 2, H / 2, 0, Math.PI / 2);
    plane(D, H, wm(D, H, T.wall), W / 2, H / 2, 0, -Math.PI / 2);
    [-1, 1].forEach(s => add(new THREE.Mesh(new THREE.BoxGeometry(.12, .12, D), glow(d.color, 1.6)), s * (W / 2 - .08), .25, 0));
    add(new THREE.Mesh(new THREE.BoxGeometry(W, .12, .12), glow(d.color, 1.6)), 0, .25, -D / 2 + .08);
    const fl = new THREE.RingGeometry(3.6, 4.1, 48); fl.rotateX(-Math.PI / 2); add(new THREE.Mesh(fl, new THREE.MeshBasicMaterial({ color: d.color, toneMapped: false })), 0, .03, 3);
    add(new THREE.Mesh(new THREE.BoxGeometry(W - 2, .22, .16), glow(d.color, 2)), 0, 11.6, -D / 2 + .1);

    // ---- theme decoration ----
    if (d.id === 'life') {
      // white ship interior with yellow pipes, tanks, screens
      [-4.5, 4.5, -13, 13].forEach(x => { const p = new THREE.Mesh(new THREE.PlaneGeometry(.7, D), Y); p.rotation.x = -Math.PI / 2; add(p, x, .02, 0); });
      [-1, 1].forEach(s => { const p = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, .6), Y); p.rotation.x = -Math.PI / 2; add(p, 0, .02, s * 8.5); });
      [-6.5, 6.5].forEach(x => add(new THREE.Mesh(new THREE.BoxGeometry(.6, .12, D - 2), glow(0xffd36a, 1.5)), x, H - .1, 0));
      add(new THREE.Mesh(new THREE.BoxGeometry(W, .5, .2), Y), 0, 12.3, -D / 2 + .2);
      [-1, 1].forEach(s => {
        const x = s * (W / 2 - .7);
        g.add(pipe([[x, .6, -10], [x, 5, -10], [x, 9, -6], [x, 11.7, -1], [x, 11.7, 9]], .28, Y));
        g.add(pipe([[x, .6, -4], [x, 3.2, -4], [x, 3.2, 3], [x, .6, 3]], .2, Y));
        g.add(pipe([[x, 10.5, -10], [x * .6, 12.4, -6], [x * .3, 12.9, 0], [x * .3, 12.9, 9]], .22, Y));
        [-10, -4, 3].forEach(z => { const r = new THREE.Mesh(new THREE.TorusGeometry(.34, .09, 8, 18), Dk); r.rotation.y = Math.PI / 2; add(r, x, 3.2, z); });
        const tk = cyl(g, 1.5, 1.5, 5, Wt, s * 13.8, 1.7, 3.6, 28); tk.rotation.x = Math.PI / 2;
        [-2.55, 2.55].forEach(zz => { const c = cyl(g, 1.54, 1.54, .7, Y, s * 13.8, 1.7, 3.6 + zz, 28); c.rotation.x = Math.PI / 2; });
        cyl(g, .95, .95, 3.2, Y, s * 15.2, 1.6, 8.4, 20); cyl(g, .99, .99, .4, Dk, s * 15.2, 3.2, 8.4, 20);
        for (let k = 0; k < 3; k++) scr(s * (W / 2 - .15), 6.5, -7 + k * 5.2, 4.2, 2.5, techTex(k, '#6ab4ff', ['RADAR', 'AIR FLOW', 'PRESSURE'][k]), s > 0 ? -Math.PI / 2 : Math.PI / 2);
      });
      [-8, 8].forEach(x => scr(x, 10.9, -D / 2 + .22, 3.6, 1.1, techTex(1, '#ffd36a', 'O2 LOOP')));
    } else if (d.id === 'power') {
      // control room facing the solar field + glowing reactors
      const win = makeWindow([[-12, -3.5], [12, -3.5], [12, 3.5], [-12, 3.5]], 'solar', 0x20283a); win.position.set(0, 8, -D / 2 + .06); g.add(win);
      add(new THREE.Mesh(new THREE.BoxGeometry(26, 1.1, 1.4), Dk), 0, .55, -11);
      add(new THREE.Mesh(new THREE.BoxGeometry(26, .05, 1.2), glow(0xffa63a, 1.4)), 0, 1.13, -11);
      for (let i = 0; i < 26; i++) add(new THREE.Mesh(new THREE.BoxGeometry(.25, .1, .25), glow(['#ffb066', '#6ab4ff', '#7ddba3'][i % 3], 1.8)), -12.5 + i, 1.2, -10.6);
      [-6.5, -3, 3, 6.5].forEach(x => add(new THREE.Mesh(new THREE.BoxGeometry(.12, .02, D - 2), glow(0xffa63a, 1.4)), x, .02, 0));
      add(new THREE.Mesh(new THREE.BoxGeometry(W - 4, .02, .12), glow(0xffa63a, 1.4)), 0, .02, 6.5);
      [-1, 1].forEach(s => {
        const x = s * 13.5; cyl(g, 1.9, 1.9, .4, Dk, x, .2, 2, 32);
        add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 7, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd49a, transparent: true, opacity: .18, roughness: .05, side: THREE.DoubleSide, depthWrite: false })), x, 3.9, 2);
        cyl(g, .5, .5, 6.4, glow(0xffa63a, 2.4), x, 3.9, 2, 20); cyl(g, 1.9, 1.9, .4, Dk, x, 7.6, 2, 32);
        [1.4, 3.2, 5, 6.8].forEach(y => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.36, .08, 8, 32), glow(0xffc46a, 1.8)); r.rotation.x = Math.PI / 2; add(r, x, y, 2); });
        const pl = new THREE.PointLight(0xffa04a, 1.3, 24); pl.position.set(x, 4, 2); g.add(pl);
        for (let z = -7; z <= 7; z += 4.5) {
          add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 6.5, 3.2), Dk), s * (W / 2 - .7), 3.25, z - 1.5 * (z > 3 ? -1 : 1) * 0);
          [2, 3.4, 4.8].forEach(y => add(new THREE.Mesh(new THREE.BoxGeometry(.05, .35, 2.4), glow(0xffa63a, 1.6)), s * (W / 2 - 1.3), y, z));
        }
        g.add(pipe([[x, .5, 2.6], [x * .8, .08, 5], [x * .35, .08, 7]], .1, mat(0x59627a, { metalness: .8, roughness: .35 })));
      });
      const sk = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), solarMat); sk.rotation.x = Math.PI / 2; add(sk, 0, H - .05, 3);
      const cr = new THREE.Mesh(new THREE.TorusGeometry(5, .12, 10, 56), glow(0xffd49a, 2)); cr.rotation.x = Math.PI / 2; add(cr, 0, H - .4, 2);
      [-8, 0, 8].forEach(x => add(new THREE.Mesh(new THREE.BoxGeometry(.5, .5, D), mat(0x3a4254, { metalness: .8, roughness: .4 })), x, H - .25, 0));
    } else if (d.id === 'comms') {
      // dark operations room with a big window to Earth, monitor stacks, server racks
      const win = makeWindow([[-12, -3.6], [12, -3.6], [12, 3.6], [-8.5, 3.6]], 'comms', 0x3a4254); win.position.set(0, 7.6, -D / 2 + .06); g.add(win);
      [-1, 1].forEach(s => {
        const x = s * 14.2; cyl(g, .12, .12, 11, Dk, x, 5.5, -1, 8);
        for (let k = 0; k < 3; k++) scr(x, 3.3 + k * 2.9, -1, 4.2, 2.4, commTex(k), -s * .9);
        for (let z of [-8.6, -5.8, 4.4, 7.2]) {
          add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 5.5, 2.3), Dk), s * (W / 2 - .8), 2.75, z);
          const rp = new THREE.Mesh(new THREE.PlaneGeometry(2, 5.2), new THREE.MeshBasicMaterial({ map: rackTex(), toneMapped: false })); add(rp, s * (W / 2 - 1.52), 2.75, z).rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        }
      });
      [-6, 0, 6].forEach(z => add(new THREE.Mesh(new THREE.BoxGeometry(W, .45, .5), Dk), 0, H - .25, z));
      [-8, -2.7, 2.7, 8].forEach(x => add(new THREE.Mesh(new THREE.BoxGeometry(.5, .08, D - 2), glow(0x6fe0ff, 1.6)), x, H - .03, 0));
      const globe = add(new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 14), new THREE.MeshBasicMaterial({ color: 0x6fe0ff, wireframe: true, transparent: true, opacity: .8, toneMapped: false })), 0, 2.6, 3); spinners.push(globe);
      add(new THREE.Mesh(new THREE.SphereGeometry(.5, 16, 12), glow(0x6fe0ff, 2)), 0, 2.6, 3);
      [0, 1].forEach(i => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.9, .04, 8, 40), glow(0x6fe0ff, 1.8)); r.rotation.set(Math.PI / 2 + i * .5, i * .8, 0); add(r, 0, 2.6, 3); });
      add(new THREE.Mesh(new THREE.CylinderGeometry(.5, .8, .5, 24), Dk), 0, .25, 3);
    } else {
      // greenhouse: glass starfield roof, plant beds, grow lights, water pipes
      [-3, -1, 1, 3].forEach(i => add(new THREE.Mesh(new THREE.BoxGeometry(W, .25, .35), Wt), 0, H - .15, i * 3.4 - 1));
      [-12, -6, 0, 6, 12].forEach(x => add(new THREE.Mesh(new THREE.BoxGeometry(.35, .25, D), Wt), x, H - .15, 0));
      [-13, -4.5, 4.5, 13].forEach(x => add(new THREE.Mesh(new THREE.BoxGeometry(.5, .1, D - 3), glow(0xffe6f5, 1.8)), x, H - .35, 0));
      [-6, 0, 6].forEach(z => [-4.5, 4.5].forEach(x => { const sp = glowSprite(0xffd6f0, 7, .3); sp.position.set(x, H - 2.4, z); g.add(sp); }));
      const win = makeWindow([[-10, -2.6], [10, -2.6], [10, 2.6], [-10, 2.6]], 'moon', 0x7d8f86); win.position.set(0, 8.6, -D / 2 + .06); g.add(win);
      const aisle = new THREE.Mesh(new THREE.PlaneGeometry(7, D), mat(0x8a948f, { metalness: .5, roughness: .45 })); aisle.rotation.x = -Math.PI / 2; add(aisle, 0, .015, 0);
      const list = [], soil = mat(0x3b2f24, { roughness: 1, metalness: 0 });
      const bed = (x, z, w, dp, n) => {
        add(new THREE.Mesh(new THREE.BoxGeometry(w, .8, dp), soil), x, .4, z); add(new THREE.Mesh(new THREE.BoxGeometry(w + .25, .25, dp + .25), Wt), x, .85, z);
        for (let i = 0; i < n; i++) list.push({ x: x + rnd(-w / 2 + .3, w / 2 - .3), y: 1.1 + rnd(0, .35), z: z + rnd(-dp / 2 + .3, dp / 2 - .3), s: rnd(.3, .65) });
      };
      if (GAME_MODE !== 'A') {   // no plant beds in Category A
        [-1, 1].forEach(s => [-7.5, -1.8, 4].forEach(z => bed(s * 14.4, z, 3.2, 4.8, 32)));
        [-11, 0, 11].forEach(x => bed(x, -10.8, 9, 2.2, 36));
      }
      const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat(0xffffff, { roughness: .8, metalness: 0, flatShading: true, envMapIntensity: .3 }), list.length);
      const o = new THREE.Object3D(), col = new THREE.Color();
      list.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.scale.set(p.s, p.s * .85, p.s); o.rotation.y = rnd(0, 6); o.updateMatrix(); im.setMatrixAt(i, o.matrix); col.setHSL(rnd(.22, .37), rnd(.55, .85), rnd(.28, .46)); im.setColorAt(i, col); });
      if (list.length) { im.castShadow = true; g.add(im); }
      [-1, 1].forEach(s => {
        g.add(pipe([[s * 16.5, .5, -9], [s * 16.5, 3.2, -9], [s * 16.5, 3.2, 9]], .13, Wt));
        g.add(pipe([[s * 16.4, 3.2, -9], [s * 16.4, 3.2, 9]], .06, glow(0x7fd8ff, 1.2)));
        [-9, 9].forEach(z => cyl(g, .22, .22, .7, Dk, s * 16.5, 3.2, z, 12));
        box(g, 2, 2, 2, mat(0x9a7b4f, { metalness: .1, roughness: .8 }), s * 15.5, 1, 9.6); box(g, 1.6, 1.6, 1.6, mat(0x9a7b4f, { metalness: .1, roughness: .8 }), s * 15.5, 2.8, 9.6);
      });
    }

    g.add(new THREE.AmbientLight(0xffffff, T.amb));
    const l1 = new THREE.PointLight(T.l1, 1.6, 50); l1.position.set(0, 11, 2); g.add(l1);
    const l2 = new THREE.PointLight(T.l2, 1.2, 40); l2.position.set(0, 11, -8); g.add(l2);

    // ---- the three A/B/C items on pedestals ----
    const n = d.items.length, gap = 9;
    (d.id === 'life' ? [] : d.items).forEach(([name, lv, shape], i) => {
      const obj = SHAPES[shape](lv, d.color, name);
      const bb = new THREE.Box3().setFromObject(obj), h = bb.max.y - bb.min.y; obj.position.y = .3 - bb.min.y;
      const slot = new THREE.Group(); slot.add(obj); slot.position.set((i - (n - 1) / 2) * gap, 0, -6);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, .3, 32), mat(0x2b3550, { metalness: .7, roughness: .4 })); ped.position.y = .15;
      const pr = new THREE.Mesh(new THREE.TorusGeometry(2.7, .07, 8, 48), glow(LEVEL[lv], 2)); pr.rotation.x = Math.PI / 2; pr.position.y = .3;
      const badge = label(lv, LEVEL[lv], 128, 128, 90); badge.position.set(0, h + 2.8, 0);
      const tag = label(name, '#eef1f6', 512, 128, 44); tag.scale.set(5, 1.25, 1); tag.position.set(0, h + 1.3, 0);
      const led = new THREE.PointLight(LEVEL[lv], .9, 10); led.position.set(0, h / 2, 2.2);
      if (lv === 'C') blinkers.push(badge);
      slot.add(ped, pr, badge, tag, led); slot.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(slot);
    });
    if (d.id === 'life') buildLifeStations(g, d); else buildDeptConsole(g, d);
    if (d.items.some(it => it[1] === 'C')) { alarm = new THREE.PointLight(0xff2a2a, 2, 36); alarm.position.set(0, 12, -4); g.add(alarm); }
    intAstro = makeAstronaut(.9); intAstro.position.set(T.astro[0], 0, T.astro[1]); intAstro.rotation.y = T.astro[2]; g.add(intAstro);
    return g;
  }

  // =====================================================
  //  STATE, TRANSITIONS, MOUSE LOOK
  // =====================================================
  const fade = document.getElementById('fade'), backBtn = document.getElementById('back-btn');
  const info = document.getElementById('dept-info'), nameChip = document.getElementById('dept-name');
  const line = document.getElementById('story-line');
  let state = 'intro', busy = true;
  const mouse = { x: 0, y: 0 }, off = { yaw: 0, pitch: 0 };

    let walkX = 0, walkDir = 0, walkHold = 0, walkReleased = true;
  const WALK_SPEED = 12, WALK_LIMIT = 100;

  function aim(t) {
    const dx = look.x - camera.position.x, dy = look.y - camera.position.y, dz = look.z - camera.position.z;
    const free = !busy && (state === 'base' || state === 'inside');
    const ty = free ? -mouse.x * 1.25 : 0, tp = free ? (mouse.y < 0 ? -mouse.y * .62 : -mouse.y * .5) : 0;
    off.yaw += (ty - off.yaw) * .07; off.pitch += (tp - off.pitch) * .07;
    camera.rotation.set(Math.atan2(dy, Math.hypot(dx, dz)) + off.pitch + Math.sin(t * .5) * .003, Math.atan2(-dx, -dz) + off.yaw, 0, 'YXZ');
  }

  function enter(d) {
    if (d.id === 'shelter') return enterShelter(d);
    busy = true; line.textContent = '';
    const p = d.group.position;
    gsap.timeline()
      .to(camera.position, { x: p.x, y: 3, z: p.z + 17, duration: 2.4, ease: 'power2.inOut' }, 0)
      .to(look, { x: p.x, y: 2.8, z: p.z, duration: 2.4, ease: 'power2.inOut' }, 0)
      .to(fade, { opacity: 1, duration: .6 })
      .add(() => {
        world.visible = false; interior = buildInterior(d); radAddInterior(d, interior); scene.add(interior); scene.environment = envIn;
        camIn = d.cam || { pos: [0, 4.2, 9.5], look: [0, 3.4, -6] };
        camera.position.set(camIn.pos[0], camIn.pos[1], camIn.pos[2]); look.set(camIn.look[0], camIn.look[1], camIn.look[2]);
        line.textContent = d.res ? 'Click the glowing control panel to see every system.' : '';
        nameChip.textContent = d.name; info.style.display = 'block'; backBtn.style.display = 'inline-flex';
        state = 'inside';
      })
      .to(fade, { opacity: 0, duration: .8 })
            .add(() => { busy = false; if (flareActive && d.id === 'comms') openEventPanel(); else if (lifeEv && d.id === 'life') resumeLifeEvent(); });
  }
  function leave() {
    if (busy) return; busy = true;
    gsap.timeline()
      .to(fade, { opacity: 1, duration: .6 })
      .add(() => {
        scene.remove(interior); interior = null; intAstro = null; world.visible = true; scene.environment = envOut;
        clickables = null; hintObj = null; hintRing = null; lifeDept = null; lvLeaveCleanup(); panelEl.style.display = 'none'; canvas.style.cursor = 'default';  evPanel.style.display = 'none';
        camera.position.set(HOME_CAM.x + walkX, HOME_CAM.y, HOME_CAM.z); look.set(HOME_LOOK.x + walkX, HOME_LOOK.y, HOME_LOOK.z);
        info.style.display = 'none'; backBtn.style.display = 'none';
        line.textContent = 'Click left or right to walk. Follow the arrows to find buildings.'; state = 'base';
      })
      .to(fade, { opacity: 0, duration: .8 })
      .add(() => { busy = false; });
  }
  backBtn.addEventListener('click', leave);

  // ---------- control-panel screen (full view of every resource) ----------
  const css = document.createElement('style');
  css.textContent = `
    #ls-panel{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:4;pointer-events:none;font-family:Barlow,sans-serif}
    .lsp-card{pointer-events:auto;width:min(640px,92vw);background:rgba(5,14,24,.93);border:2px solid #4ff0c8;border-radius:14px;box-shadow:0 0 40px rgba(79,240,200,.3),inset 0 0 30px rgba(79,240,200,.08);padding:18px 20px;color:#eef1f6}
    .lsp-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px}
    .lsp-head b{font-size:1.05rem;letter-spacing:.12em;color:#4ff0c8}
    .lsp-head button{background:transparent;border:1px solid #4ff0c8;color:#4ff0c8;border-radius:999px;padding:.35rem .9rem;cursor:pointer;font:600 .85rem Barlow,sans-serif}
    .lsp-head button:hover{background:rgba(79,240,200,.15)}
    .lsp-sum{font-size:.95rem;margin-bottom:10px;opacity:.9}
    .lsp-row{display:grid;grid-template-columns:1.2fr 2fr auto;gap:12px;align-items:center;padding:10px 0;border-top:1px solid rgba(79,240,200,.18)}
    .lsp-name{font-weight:600;font-size:1.05rem}.lsp-name small{display:block;font-weight:400;opacity:.65;font-size:.78rem}
    .lsp-bar{height:16px;border-radius:8px;background:rgba(255,255,255,.1);overflow:hidden}.lsp-bar i{display:block;height:100%;border-radius:8px}
    .lsp-val{text-align:right;font-weight:700;font-size:1.5rem;min-width:84px;line-height:1}.lsp-val small{display:block;font-size:.7rem;letter-spacing:.1em;margin-top:3px}
    .lsp-alert{margin-top:8px;padding:8px 10px;border-radius:8px;font-size:.88rem}
    @media(max-width:520px){.lsp-row{grid-template-columns:1fr auto}.lsp-bar{grid-column:1/-1;order:3}}`;
  document.head.appendChild(css);
  const panelEl = document.createElement('div'); panelEl.id = 'ls-panel'; document.body.appendChild(panelEl);

  function lsHTML(d) {
    const worst = Math.min.apply(null, d.res.map(r => r.pct)), wl = lvOf(worst);
    const sum = { A: 'All systems are operating normally.', B: 'Some resources are running low — keep an eye on them.', C: 'Attention! At least one resource is critical.' }[wl];
    const rows = d.res.map(r => {
      const lv = lvOf(r.pct), c = LEVEL[lv];
      return `<div class="lsp-row"><div class="lsp-name">${r.name}<small>${r.short}</small></div><div class="lsp-bar"><i style="width:${r.pct}%;background:${c}"></i></div><div class="lsp-val" style="color:${c}">${r.pct}%<small>${LTXT[lv]}</small></div></div>`;
    }).join('');
    const alerts = d.res.filter(r => r.pct < 70).map(r => {
      const lv = lvOf(r.pct), c = LEVEL[lv];
      return `<div class="lsp-alert" style="background:${c}22;border:1px solid ${c};color:${c}">${lv === 'C' ? '⚠ ' : ''}${r.name} at ${r.pct}% — ${r.tip}</div>`;
    }).join('');
    return `<div class="lsp-card"><div class="lsp-head"><b>${d.name.toUpperCase()} · CONTROL PANEL</b><button id="lsp-close">✕ Close</button></div><div class="lsp-sum">${sum}</div>${flareRow(d)}${lifeRow(d)}${rows}${alerts}</div>`;
  }
  function openPanel() {
    if (busy || !lifeDept) return; busy = true; state = 'panel'; line.textContent = ''; canvas.style.cursor = 'default';
    gsap.to(camera.position, { x: panelCam.pos[0], y: panelCam.pos[1], z: panelCam.pos[2], duration: 1.2, ease: 'power2.inOut' });
    gsap.to(look, {
    x: panelCam.look[0], y: panelCam.look[1], z: panelCam.look[2], duration: 1.2, ease: 'power2.inOut', onComplete: () => {
        panelEl.innerHTML = lsHTML(lifeDept); panelEl.style.display = 'flex';
        gsap.fromTo(panelEl.firstChild, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .35 });
        document.getElementById('lsp-close').onclick = closePanel; busy = false;
      }
    });
  }
  function closePanel() {
    if (busy || state !== 'panel') return; busy = true; panelEl.style.display = 'none';
    gsap.to(camera.position, { x: camIn.pos[0], y: camIn.pos[1], z: camIn.pos[2], duration: 1.1, ease: 'power2.inOut' });
    gsap.to(look, { x: camIn.look[0], y: camIn.look[1], z: camIn.look[2], duration: 1.1, ease: 'power2.inOut', onComplete: () => { state = 'inside'; busy = false; line.textContent = 'Click the glowing control panel to see every system.'; } });
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && state === 'panel') closePanel(); });
  function hitConsole(e) {
    if (!clickables) return false;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(clickables, true).length > 0;
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(domes, true)[0]; if (!hit) return null;
    let o = hit.object; while (o && !o.userData.dept) o = o.parent; return o && o.userData.dept;
  }
    addEventListener('pointerdown', e => {
    mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1;
    if (state === 'base' && !busy) {
      const d = pick(e);
      if (d) enter(d);
      else if (e.clientX < innerWidth * .35) { walkDir = -1; walkHold = 0; walkReleased = false; }
      else if (e.clientX > innerWidth * .65) { walkDir = 1; walkHold = 0; walkReleased = false; }
      } else if (state === 'inside' && !busy) { if (hitConsole(e)) openPanel(); else reserveClick(e); }
  });
  const stopWalk = () => { walkReleased = true; };
  addEventListener('pointerup', stopWalk); addEventListener('pointercancel', stopWalk); addEventListener('blur', stopWalk);
  addEventListener('pointermove', e => {
    mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1;
    if (state === 'base' && !busy) canvas.style.cursor = pick(e) ? 'pointer' : 'default';
      else if (state === 'inside' && !busy) canvas.style.cursor = (reserveOver(e) || hitConsole(e)) ? 'pointer' : 'default';
  else lvTip.style.display = 'none';
  });


  // ---------- direction arrows to the buildings ----------
  const aCss = document.createElement('style');
  aCss.textContent = `
    #dir-arrows{position:fixed;inset:0;pointer-events:none;z-index:3;display:none}
    .dir{position:absolute;display:flex;align-items:center;gap:.45rem;padding:.3rem .75rem;border-radius:999px;background:rgba(5,14,24,.78);border:1.5px solid var(--c);color:var(--c);font:600 .85rem Barlow,sans-serif;white-space:nowrap;animation:dirpulse 1.6s ease-in-out infinite}
    .dir b{font-size:1.1rem;line-height:1}.dir small{opacity:.75;font-weight:500}
    .dir.l{left:12px;--n:-6px}.dir.r{right:12px;flex-direction:row-reverse;--n:6px}
    @keyframes dirpulse{50%{transform:translateX(var(--n))}}`;
  document.head.appendChild(aCss);
  const arrowsEl = document.createElement('div'); arrowsEl.id = 'dir-arrows'; document.body.appendChild(arrowsEl);
  const arrowEls = DEPTS.map(d => { const el = document.createElement('div'); el.className = 'dir l'; el.style.setProperty('--c', d.color); el.style.display = 'none'; arrowsEl.appendChild(el); return el; });
  const _v = new THREE.Vector3();
  function updateArrows() {
    if (state !== 'base') { arrowsEl.style.display = 'none'; return; }
    arrowsEl.style.display = 'block';
    const slot = { l: 0, r: 0 };
    DEPTS.forEach((d, i) => {
      const el = arrowEls[i];
      _v.set(d.x, 4, d.z).project(camera);
      const behind = _v.z > 1;
      if (!behind && Math.abs(_v.x) < .88) { el.style.display = 'none'; return; }
      const side = (_v.x < 0) !== behind ? 'l' : 'r';
      const dist = Math.round(Math.hypot(d.x - camera.position.x, d.z - camera.position.z));
            const hot = (flareActive && d.id === 'comms') || (lifeEv && d.id === 'life');
      el.style.setProperty('--c', hot ? '#ff5d5d' : d.color);
      const txt = (side === 'l' ? '<b>◀</b> ' : '<b>▶</b> ') + (hot ? '⚠ ' : '') + d.name + ' <small>' + dist + ' m</small>';
      if (el._s !== side) { el.className = 'dir ' + side; el._s = side; }
      if (el._t !== txt) { el.innerHTML = txt; el._t = txt; }
      el.style.top = (innerHeight * .42 + slot[side]++ * 46) + 'px';
      el.style.display = 'flex';
    });
  }



// ================= RANDOM EVENTS: solar flare -> communication decision =================
  let evDone = false, flareActive = false, flareId = null, evLast = 0, evTimer = 30, toastOn = false;
  const ev = { prio: null, size: 'm' }, LINK = 40;
  const commsD = DEPTS.find(d => d.id === 'comms');
  const EVENTS = {

     co2: { title: 'CO₂ WARNING', msg: 'Battery power is very low and the CO₂ filter needs electricity. CO₂ is rising in the cabin.', goal: 'Find the Life Support base!', lesson: 'Life support must be prioritized when resources are limited.' },
     leak: { title: 'PRESSURE LEAK', msg: 'A small leak was detected in the habitat. Cabin pressure is dropping.', goal: 'Find the Life Support base!', lesson: 'Increasing oxygen production alone does not repair a pressure leak. Isolate the leak, then restore cabin pressure with the right gas supply.' },
     cold: { title: 'HABITAT TOO COLD', msg: 'The lunar habitat is getting too cold. The crew is shivering.', goal: 'Find the Life Support base!', lesson: 'Keeping astronauts warm is important, but heating must be balanced against other essential systems.' },


    o2: { title: 'OXYGEN GENERATOR FAULT', msg: 'The oxygen generator shut down. Oxygen in the cabin is slowly falling.', goal: 'Find the Life Support base!', lesson: 'When a life-support machine fails, switch to a backup supply first. Repair the machine afterwards.' },
    power: { title: 'POWER LINE FAULT', msg: 'A power line failed and the base is losing electricity.', goal: 'Find the Life Support base!', lesson: 'When power is short, backup power goes to the systems that keep the crew alive first.' },

    water: { title: 'WATER RECYCLER FAILURE', msg: 'A pipe in the water recycler burst. Precious water is leaking away.', goal: 'Find the Life Support base!', lesson: 'Water is very hard to bring to the Moon, so every drop is recycled. Stop the loss first, then repair.' },
    solar: { title: 'SOLAR PANEL DAMAGE', msg: 'A moon rock chipped a solar panel. The base makes less electricity, so the battery drains faster.', goal: 'Find the Life Support base!', lesson: 'When power generation drops, switch to backup power for essential systems while the panel is repaired.' },
    comm: { title: 'COMMUNICATION DISRUPTION', msg: 'The antenna lost its signal. Mission Control cannot hear the base and cannot send tips.', goal: 'Find the Life Support base!', lesson: 'Without a radio link the crew must solve problems on their own, so know your emergency steps.' },

    flare: {
      title: 'SOLAR FLARE ALERT',
      msg: 'A strong solar flare is causing radio interference. The crew cannot send a normal message to Earth.',
      goal: 'Find the Communication base!',
      lesson: 'Emergency communication must receive priority over nonessential communication.'
    }
  };
  const SIZES = [
    { id: 's', name: 'Short alert', info: 'A few words: "Flare! Need help."', bw: 15, pw: 10 },
    { id: 'm', name: 'Alert + status', info: 'Alert plus crew and power status', bw: 35, pw: 25 },
    { id: 'l', name: 'Full report + photos', info: 'Everything, with pictures', bw: 75, pw: 60 }
  ];
  let lessons = {}; try { lessons = JSON.parse(localStorage.getItem('astroLessons') || '{}'); } catch (e) { }
  const saveLessons = () => { try { localStorage.setItem('astroLessons', JSON.stringify(lessons)); } catch (e) { } refreshNotes(); };

  const evCss = document.createElement('style');
  evCss.textContent = `
    #ev-toast{position:fixed;top:1rem;left:0;right:0;display:none;justify-content:center;z-index:6;pointer-events:none;font-family:Barlow,sans-serif}
    .evt-card{display:flex;gap:.8rem;align-items:flex-start;width:min(560px,92vw);padding:.85rem 1.1rem;border-radius:12px;background:rgba(30,6,6,.93);border:2px solid #ff5d5d;color:#eef1f6;box-shadow:0 0 34px rgba(255,93,93,.45);animation:evpulse 1s ease-in-out infinite alternate}
    .evt-ico{font-size:1.8rem;line-height:1}.evt-card b{color:#ff5d5d;letter-spacing:.12em;font-size:.95rem}
    .evt-card p{margin:.3rem 0 0;font-size:.92rem}.evt-go{color:#ffb066;font-weight:600}.evt-rem{color:#7ddba3}
    @keyframes evpulse{to{box-shadow:0 0 12px rgba(255,93,93,.2)}}
    #ev-obj{position:fixed;top:.9rem;left:50%;transform:translateX(-50%);display:none;z-index:3;padding:.4rem 1rem;border-radius:999px;background:rgba(30,6,6,.85);border:1.5px solid #ff5d5d;color:#ff9a8f;font:600 .88rem Barlow,sans-serif;pointer-events:none;animation:evpulse 1s ease-in-out infinite alternate}
    #ev-flash{position:fixed;inset:0;z-index:7;pointer-events:none;opacity:0;background:radial-gradient(circle at 70% 35%,rgba(255,240,200,.95),rgba(255,140,60,.55) 45%,transparent 75%)}
    #ev-noise{position:fixed;inset:0;z-index:3;pointer-events:none;display:none;opacity:.14;background:repeating-linear-gradient(0deg,rgba(255,255,255,.5) 0 1px,transparent 1px 4px);animation:evnoise .18s steps(2) infinite}
    @keyframes evnoise{50%{transform:translateY(2px);opacity:.07}}
    #ev-panel{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:4;pointer-events:none;font-family:Barlow,sans-serif}
    .evp-card{pointer-events:auto;width:min(680px,94vw);max-height:92vh;overflow:auto;background:rgba(5,12,22,.95);border:2px solid #ff8a5c;border-radius:14px;box-shadow:0 0 40px rgba(255,138,92,.28);padding:16px 20px;color:#eef1f6}
    .evp-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.evp-head b{color:#ff8a5c;letter-spacing:.12em;font-size:1rem}.evp-head span{display:flex;gap:6px}
    .evp-x{background:transparent;border:1px solid #ff8a5c;color:#ff8a5c;border-radius:999px;padding:.3rem .8rem;cursor:pointer;font:600 .8rem Barlow,sans-serif}.evp-x:hover{background:rgba(255,138,92,.15)}
    #ev-reopen{position:fixed;right:1rem;bottom:1rem;z-index:3;display:none;border-color:#ff5d5d;color:#ff9a8f}.evp-txt{margin:.5rem 0;font-size:.95rem;opacity:.92}
    .evp-h{margin:.9rem 0 .4rem;font-weight:700;color:#6ab4ff;letter-spacing:.06em;font-size:.88rem}
    .evp-sizes,.evp-prios{display:grid;gap:8px}.evp-sizes{grid-template-columns:repeat(3,1fr)}
    .evp-size,.evp-prio{text-align:left;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.2);border-radius:10px;color:#eef1f6;padding:.55rem .7rem;cursor:pointer;font:500 .9rem Barlow,sans-serif}
    .evp-size small,.evp-prio small{display:block;opacity:.7;font-size:.76rem;margin-top:2px}
    .evp-size.on,.evp-prio.on{border-color:#7ddba3;background:rgba(125,219,163,.14)}
    .evp-prio b{display:inline-block;width:1.5rem;height:1.5rem;line-height:1.5rem;text-align:center;border-radius:50%;background:#ff8a5c;color:#02040a;margin-right:.5rem}
    .evp-m{display:grid;grid-template-columns:130px 1fr 46px;gap:10px;align-items:center;margin:.35rem 0;font-size:.85rem}
    .evp-m em{font-style:normal;font-weight:700;text-align:right}
    .evp-bar{position:relative;height:14px;border-radius:7px;background:rgba(255,255,255,.1);overflow:hidden}.evp-bar i{display:block;height:100%}
    .evp-bar u{position:absolute;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 6px #fff}
    .evp-note{font-size:.8rem;opacity:.8;margin-top:.3rem}
    .evp-go{display:block;margin:1rem 0 0 auto;padding:.55rem 1.4rem;border-radius:999px;border:0;cursor:pointer;font:700 .95rem Barlow,sans-serif;background:linear-gradient(90deg,#ffb066,#ff7a5c);color:#1a0a04}
    .evp-go:disabled{opacity:.35;cursor:not-allowed}
    .evp-res{font-size:1.2rem;font-weight:700;margin:.4rem 0}.evp-res.good{color:#7ddba3}.evp-res.bad{color:#ff5d5d}.evp-res.ok{color:#ffb066}
    .evp-learn{margin-top:.9rem;padding:.7rem .9rem;border-radius:10px;border:1.5px solid #7ddba3;background:rgba(125,219,163,.1);color:#bff3d6;font-size:.95rem}
    #ev-notes-btn{position:fixed;left:1rem;bottom:4.6rem;z-index:3;display:none}
    #ev-notes{position:fixed;left:1rem;bottom:8rem;z-index:4;display:none;width:min(340px,90vw);background:rgba(5,12,22,.95);border:2px solid #7ddba3;border-radius:12px;padding:12px 14px;color:#eef1f6;font:500 .9rem Barlow,sans-serif}
    @media(max-width:560px){.evp-sizes{grid-template-columns:1fr}.evp-m{grid-template-columns:100px 1fr 40px}}`;
  document.head.appendChild(evCss);
  const mkEl = (tag, id) => { const e = document.createElement(tag); e.id = id; document.body.appendChild(e); return e; };
  const evToast = mkEl('div', 'ev-toast'), evObj = mkEl('div', 'ev-obj'), evFlash = mkEl('div', 'ev-flash'), evNoise = mkEl('div', 'ev-noise');
  const evPanel = mkEl('div', 'ev-panel'), notesEl = mkEl('div', 'ev-notes'), notesBtn = mkEl('button', 'ev-notes-btn');
  evObj.textContent = '⚠ Solar flare: find the Communication base';
  notesBtn.className = 'btn btn-ghost'; notesBtn.textContent = '📝 Notes';
  [notesBtn, notesEl].forEach(el => el.addEventListener('pointerdown', e => e.stopPropagation()));   // clicking these must not make the astronaut walk
  notesBtn.addEventListener('click', () => { notesEl.style.display = notesEl.style.display === 'block' ? 'none' : 'block'; });
  function refreshNotes() {
    const keys = Object.keys(lessons).filter(k => EVENTS[k]);
    notesBtn.style.display = keys.length ? 'inline-flex' : 'none';
    notesEl.innerHTML = '<b style="color:#7ddba3;letter-spacing:.1em">MISSION NOTES</b>' + keys.map(k => { const l = lessons[k]; return `<p style="margin:.55rem 0 0">📌 <b>${EVENTS[k].title}</b><br>${l.text}<br><small style="opacity:.7">Right choice ${l.wins} of ${l.tries} times</small></p>`; }).join('');
  }
  refreshNotes();

  let actx = null;
  function beep(freq, dur, when) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.value = freq; g.gain.value = .04;
      o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + when); o.stop(actx.currentTime + when + dur);
    } catch (e) { }
  }

  function triggerEvent(id) {
    const E = EVENTS[id]; if (!E || flareActive) return;
    flareActive = true; flareId = id; ev.prio = null; ev.size = 'm'; evDone = false;
    commsD.ringMat.color.set(0xff3a30);
    const rem = lessons[id] ? `<p class="evt-rem">📌 Remember: ${E.lesson}</p>` : '';
    evToast.innerHTML = `<div class="evt-card"><div class="evt-ico">⚠</div><div><b>${E.title}</b><p>${E.msg}</p><p class="evt-go">▶ ${E.goal}</p>${rem}</div></div>`;
    evToast.style.display = 'flex'; toastOn = true;
    gsap.fromTo(evToast.firstChild, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: .4 });
    setTimeout(() => { toastOn = false; gsap.to(evToast.firstChild, { opacity: 0, duration: .5, onComplete: () => { evToast.style.display = 'none'; } }); }, 11000);
    evFlash.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 1000 });
    beep(880, .18, 0); beep(660, .18, .25); beep(880, .18, .5);
    line.textContent = E.goal;
  }

  function decisionHTML() {
    const s = SIZES.find(x => x.id === ev.size), bwOk = s.bw <= LINK, pwCol = s.pw <= 30 ? '#7ddba3' : s.pw <= 60 ? '#ffb066' : '#ff5d5d';
    return `<div class="evp-card">
      <div class="evp-head"><b>⚠ SOLAR FLARE · RADIO INTERFERENCE</b><span><button class="evp-x" data-act="console">📊 Control panel</button><button class="evp-x" data-act="close">✕</button></span></div>
      <p class="evp-txt">The flare is jamming the link to Earth. Only <b>${LINK}%</b> of the normal bandwidth works, and routine research data is still using it. What should the crew do?</p>
      <div class="evp-h">1 · HOW BIG IS THE EMERGENCY MESSAGE?</div>
      <div class="evp-sizes">${SIZES.map(z => `<button class="evp-size${ev.size === z.id ? ' on' : ''}" data-act="size-${z.id}"><b>${z.name}</b><small>${z.info}</small></button>`).join('')}</div>
      <div class="evp-m"><span>Bandwidth needed</span><div class="evp-bar"><i style="width:${s.bw}%;background:${bwOk ? '#7ddba3' : '#ff5d5d'}"></i><u style="left:${LINK}%"></u></div><em>${s.bw}%</em></div>
      <div class="evp-m"><span>Power use</span><div class="evp-bar"><i style="width:${s.pw}%;background:${pwCol}"></i></div><em>${s.pw}%</em></div>
      <div class="evp-note">${bwOk ? 'This fits through the weak link.' : '⚠ Too big for the weak link (the white line is the limit).'} Bigger messages use more bandwidth and more power.</div>
      <div class="evp-h">2 · WHAT GOES FIRST?</div>
      <div class="evp-prios">
        <button class="evp-prio${ev.prio === 'A' ? ' on' : ''}" data-act="prio-A"><b>A</b>Prioritize an emergency message to Earth<small>Routine data waits.</small></button>
        <button class="evp-prio${ev.prio === 'B' ? ' on' : ''}" data-act="prio-B"><b>B</b>Continue sending routine research data<small>The emergency message waits.</small></button>
      </div>
      <button class="evp-go" data-act="send"${ev.prio ? '' : ' disabled'}>Send ▶</button></div>`;
  }
  function evResult() {
    const s = SIZES.find(x => x.id === ev.size);
    if (ev.prio === 'A') {
      const fits = s.bw <= LINK;
      return fits
        ? { cls: 'good', head: 'Emergency message delivered!', text: 'The emergency message gets priority and routine data waits. Earth hears from the crew quickly, and routine data resumes after the flare.', bw: s.bw, pw: s.pw, win: true }
        : { cls: 'ok', head: 'Priority given, but the message was too big', text: 'The emergency message gets priority and routine data waits. But it needs more bandwidth than the weak link has, so it arrives slowly and uses a lot of power. A smaller message would have been faster.', bw: LINK, pw: s.pw, win: true };
    }
    return { cls: 'bad', head: 'Emergency message delayed', text: 'Bandwidth is occupied by routine data, so emergency communication is delayed. Earth does not hear about the problem in time.', bw: LINK, pw: 30, win: false };
  }
  function showEvResult() {
    if (!ev.prio) return;
    const r = evResult(), E = EVENTS[flareId], l = lessons[flareId] || (lessons[flareId] = { text: E.lesson, tries: 0, wins: 0 });
    l.tries++; if (r.win) l.wins++; saveLessons();  evDone = true;
    evPanel.innerHTML = `<div class="evp-card">
      <div class="evp-head"><b>RESULT</b><span><button class="evp-x" data-act="close">✕</button></span></div>
      <div class="evp-res ${r.cls}">${r.head}</div><p class="evp-txt">${r.text}</p>
      <div class="evp-m"><span>Bandwidth used</span><div class="evp-bar"><i style="width:${r.bw}%;background:#6ab4ff"></i></div><em>${r.bw}%</em></div>
      <div class="evp-m"><span>Power used</span><div class="evp-bar"><i style="width:${r.pw}%;background:${r.pw <= 30 ? '#7ddba3' : r.pw <= 60 ? '#ffb066' : '#ff5d5d'}"></i></div><em>${r.pw}%</em></div>
      <div class="evp-learn">📌 <b>REMEMBER:</b> ${E.lesson}</div>
      <button class="evp-go" data-act="done">Continue ▶</button></div>`;
  }
  evPanel.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a.indexOf('size-') === 0) { ev.size = a.slice(5); evPanel.innerHTML = decisionHTML(); }
    else if (a.indexOf('prio-') === 0) { ev.prio = a.slice(5); evPanel.innerHTML = decisionHTML(); }
    else if (a === 'send') showEvResult();
   else if (a === 'done') endEvent();
    else if (a === 'close') closeEventPanel();
    else if (a === 'console') { closeEventPanel(); openPanel(); }
  });
  function openEventPanel() {
    if (!flareActive) return;
    state = 'event'; line.textContent = ''; canvas.style.cursor = 'default';
    evPanel.innerHTML = decisionHTML(); evPanel.style.display = 'flex';
    gsap.fromTo(evPanel.firstChild, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .35 });
  }
  function endEvent() {
    flareActive = false; flareId = null; evPanel.style.display = 'none';
    commsD.ringMat.color.set(commsD.color);
    pw.handled++; evTimer = nextEvDelay(); state = 'inside'; line.textContent = '';
  }
  /*addEventListener('keydown', e => { if (e.key && e.key.toLowerCase() === 'f' && state === 'base' && !busy && !flareActive) triggerEvent('flare'); }); */  // test shortcut

  
  
  // ---- let the player cross the decision panel and reopen it any time ----
  const reopenBtn = mkEl('button', 'ev-reopen'); reopenBtn.className = 'btn btn-ghost'; reopenBtn.textContent = '⚠ Flare decision';
  reopenBtn.addEventListener('pointerdown', e => e.stopPropagation());
  reopenBtn.addEventListener('click', () => { if (state === 'inside' && !busy && flareActive) openEventPanel(); });
  function closeEventPanel() {
    if (evDone) { endEvent(); return; }
    evPanel.style.display = 'none'; state = 'inside';
    line.textContent = 'Click the glowing control panel to see your bandwidth.';
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && state === 'event') closeEventPanel(); });
  function flareRow(d) {   // extra rows for the Communication control panel while the flare is active
    if (!flareActive || d.id !== 'comms') return '';
    return `<div class="lsp-alert" style="background:#ff5d5d22;border:1px solid #ff5d5d;color:#ff9a8f;margin:0 0 6px">⚠ Solar flare interference: only ${LINK}% of your total bandwidth is working. Routine research data is still using it.</div>`
      + `<div class="lsp-row"><div class="lsp-name">Total bandwidth<small>Available during the flare</small></div><div class="lsp-bar"><i style="width:${LINK}%;background:#ff5d5d"></i></div><div class="lsp-val" style="color:#ff5d5d">${LINK}%<small>LIMITED</small></div></div>`;
  }
  
  
  
  function updateEvents(t) {
    const dt = Math.min(t - evLast, .1); evLast = t;
    
    const f = flareActive ? 1.5 + Math.sin(t * 7) * .35 : 1;
    sunGlow.scale.set(650 * f, 650 * f, 1); sunHaze.scale.set(1500 * f, 1500 * f, 1); sunHaze.material.opacity = flareActive ? .45 : .16;
    if (flareActive) commsD.ringMat.opacity = .4 + .5 * Math.abs(Math.sin(t * 5));
    evObj.style.display = flareActive && state === 'base' && !toastOn ? 'block' : 'none';
    evNoise.style.display = flareActive ? 'block' : 'none';
    reopenBtn.style.display = flareActive && state === 'inside' && lifeDept === commsD ? 'inline-flex' : 'none';
  }








  // =====================================================================
  //  LIFE SUPPORT EVENTS: CO2 / pressure leak / cold  +  find-the-reserve game
  // =====================================================================
  let lifeEv = null, reserveObjs = null, hoverRes = null, hintUntil = 0, lastEv = null, sayTimer = null, lifeLast = 0;
  const lifeD = DEPTS.find(d => d.id === 'life');
    const MODE = GAME_MODE;
  const EVENT_POOL = MODE === 'B' ? ['flare', 'radiation', 'co2', 'leak', 'cold', 'o2', 'power', 'water', 'solar', 'comm']
                                  : ['co2', 'leak', 'cold', 'o2', 'power', 'water', 'solar', 'comm'];   // radiation + flare are Category B only

  const RES = {
    o2: { name: 'Oxygen reserve tank', info: 'Spare breathing oxygen for the crew.' },
    n2: { name: 'Nitrogen gas reserve', info: 'Cabin air is mostly nitrogen. This refills air pressure.' },
    bat: { name: 'Spare battery pack', info: 'Extra electricity for the most important systems.' },
    lioh: { name: 'LiOH CO₂ canisters', info: 'Chemicals that soak up CO₂ without needing electricity.' },
    heat: { name: 'Backup heater', info: 'A small heater that warms the crew area.' },
    valve: { name: 'Leak isolation valve', info: 'Closes off a damaged section so air cannot escape.' }
  };

  const LIFE_EV = {
    water: {
      story: 'The water recycler has burst a pipe! Water drips onto the floor and the tank level is slowly falling.',
      gauges: () => [['Water tank', 'Falling ▼', 55, '#ffb066'], ['Daily need', '12 L', 100, '#7ddba3']],
      q: 'WHAT SHOULD THE CREW DO FIRST?',
      opts: [
        { id: 'A', t: 'Close off the broken pipe, then repair the recycler', s: 'Stop the loss before anything else.', good: true },
        { id: 'B', t: 'Drink extra water now before it is gone', s: 'Use it while we still have it.', good: false,
          out: 'The tank keeps emptying while the crew drinks. Stop the loss first!' }
      ],
      tips: [
        'Water on the Moon is recycled again and again, so a leak wastes a lot.',
        'Stop the water from escaping before you repair anything.',
        'Look for the part that closes off a damaged pipe.'
      ],
      steps: [{
        ok: ['valve'],
        goal: 'Find the part that closes off the broken section.',
        hint: 'Look for the reserve labelled Leak isolation valve.',
        done: { valve: 'The broken pipe is closed off. The water stops leaking.' },
        wrong: { o2: 'Oxygen does not stop a water leak.', n2: 'Nitrogen gas does not stop a water leak.', bat: 'A battery gives power. It cannot close a pipe.', lioh: 'These clean CO₂. They do not stop a leak.', heat: 'A heater does not stop a leak.' }
      }],
      win: 'The leak is isolated and the recycler can now be repaired safely.'
    },
    solar: {
      story: 'A moon rock chipped a solar panel! The base is making less electricity, so the battery drains faster until this is fixed.',
      gauges: () => { const b = lifeD.res[2].pct; return [['Battery power', b + '%', b, LEVEL[lvOf(b)]], ['Solar output', 'Low ▼', 35, '#ffb066']]; },
      q: 'WHAT SHOULD THE CREW DO?',
      opts: [
        { id: 'A', t: 'Connect the spare battery and protect life support while the panel is repaired', s: 'Backup power for the most important systems.', good: true },
        { id: 'B', t: 'Ignore it. The battery will be fine', s: 'No action needed.', good: false,
          out: 'The battery keeps draining faster than normal. Ignoring a power problem is risky!' }
      ],
      tips: [
        'Less sunlight on the panels means less electricity for the base.',
        'Which supply can add electricity quickly?',
        'Protect the systems that keep the crew alive first.'
      ],
      steps: [{
        ok: ['bat'],
        goal: 'Find a reserve that adds electricity to the base.',
        hint: 'Look for the reserve labelled Spare battery pack.',
        done: { bat: 'The spare battery is connected. The base has power while the panel is repaired.' },
        wrong: { o2: 'Oxygen is for breathing. It does not make electricity.', n2: 'Nitrogen does not make electricity.', lioh: 'These clean CO₂. They do not make electricity.', heat: 'A heater uses electricity. It does not make any.', valve: 'A valve closes a leak. It does not make electricity.' }
      }],
      win: 'The spare battery covers the missing solar power until the panel is repaired.'
    },
    comm: {
      story: 'The antenna lost its signal. Mission Control cannot hear the base, so no tips or hints can arrive until it is restarted.',
      gauges: () => [['Radio link', 'Lost ▼', 10, '#ff5d5d'], ['Antenna power', 'Needs reboot', 45, '#ffb066']],
      q: 'WHAT SHOULD THE CREW DO?',
      opts: [
        { id: 'A', t: 'Restart the antenna on spare power', s: 'A clean reboot restores the link.', good: true },
        { id: 'B', t: 'Keep calling on the radio until someone answers', s: 'Maybe they will hear us.', good: false,
          out: 'Nothing gets through. The antenna must be restarted first.' }
      ],
      tips: [],
      steps: [{
        ok: ['bat'],
        goal: 'Find a reserve that gives the antenna clean power.',
        hint: 'Look for the reserve labelled Spare battery pack.',
        done: { bat: 'The antenna restarts on spare power. The link to Earth is back.' },
        wrong: { o2: 'Oxygen is for breathing. The antenna needs electricity.', n2: 'Nitrogen does not power an antenna.', lioh: 'These clean CO₂. They do not power an antenna.', heat: 'A heater does not restore a radio link.', valve: 'A valve closes a leak. It does not power an antenna.' }
      }],
      win: 'The link to Mission Control is back. Help from Earth is available again.'
    },
    o2: {
      story: 'The oxygen generator has switched itself off. The air still smells fine, but the oxygen level in the cabin is slowly falling.',
      gauges: () => [['Cabin oxygen', 'Falling ▼', 55, '#ffb066'], ['Safe range', '19–23 %', 100, '#7ddba3']],
      q: 'WHAT SHOULD THE CREW DO FIRST?',
      opts: [
        { id: 'A', t: 'Switch to the spare oxygen supply', s: 'Keeps the air breathable while the generator is checked.', good: true },
        { id: 'B', t: 'Wait and see if the generator restarts by itself', s: 'Saves effort and power.', good: false,
          out: 'The generator stays off. Oxygen keeps falling and the crew starts to feel dizzy. Waiting is not a plan!' }
      ],
      tips: [
        'Astronauts use oxygen all the time. The cabin has a limited amount of it.',
        'A backup supply buys time. Fixing the broken machine comes second.',
        'Look for the reserve that holds oxygen to breathe.'
      ],
      steps: [{
        ok: ['o2'],
        goal: 'Find the spare oxygen tank and open it.',
        hint: 'Look for the reserve labelled Oxygen reserve tank.',
        done: { o2: 'The spare oxygen flows into the cabin. The oxygen level stops falling.' },
        wrong: { n2: 'Nitrogen keeps air pressure up, but the crew cannot breathe it alone.', bat: 'A battery gives power. It does not make breathable oxygen.', lioh: 'These clean CO₂. They do not add oxygen.', heat: 'A heater does not add oxygen.', valve: 'A valve closes off a leak. There is no leak here.' }
      }],
      win: 'The spare oxygen keeps the crew breathing while the generator is repaired.'
    },
    power: {
      story: 'A power line has failed. The base is losing electricity, and life support needs power to keep the crew safe.',
      gauges: () => { const b = lifeD.res[2].pct; return [['Battery power', b + '%', b, LEVEL[lvOf(b)]], ['Power line', 'Faulty ▼', 30, '#ffb066']]; },
      q: 'HOW SHOULD THE POWER BE USED?',
      opts: [
        { id: 'A', t: 'Connect the spare battery and feed life support first', s: 'Extra communication and equipment can wait.', good: true },
        { id: 'B', t: 'Keep every system on full power and hope the fault clears', s: 'Nothing is switched off.', good: false,
          out: 'The faulty line keeps wasting electricity. The battery drops even faster and nothing is protected.' }
      ],
      tips: [
        'When power is short, the crew decides which systems stay on.',
        'Which systems keep people alive right now, and which can wait?',
        'Look for a reserve that adds electricity.'
      ],
      steps: [{
        ok: ['bat'],
        goal: 'Find a reserve that adds electricity to the base.',
        hint: 'It is the yellow spare battery box.',
        done: { bat: 'The spare battery is connected. Life support has power again.' },
        wrong: { o2: 'Oxygen is for breathing. It does not make electricity.', n2: 'Nitrogen refills air pressure. It does not make electricity.', lioh: 'These clean CO₂. They do not make electricity.', heat: 'A heater uses electricity. It does not make any.', valve: 'A valve closes off a leak. It does not make electricity.' }
      }],
      win: 'Life support is running on the spare battery. The crew can breathe and stay warm.'
    },
    co2: {
      story: 'The base has very little battery power left. The CO₂ filter needs electricity to clean the air, and the CO₂ level is starting to rise. The crew must decide where the remaining power goes.',
      gauges: () => { const b = lifeD.res[2].pct; return [['Battery power', b + '%', b, LEVEL[lvOf(b)]], ['CO₂ in cabin', 'Rising ▲', 64, '#ffb066']]; },
      q: 'WHERE SHOULD THE REMAINING POWER GO?',
      opts: [
        { id: 'A', t: 'Prioritize the CO₂ removal system and essential life support', s: 'Communication and extra equipment get less power.', good: true },
        { id: 'B', t: 'Use the remaining power for communication and nonessential equipment', s: 'The CO₂ filter slows down.', good: false,
          out: 'Communication stays active for a little while, but the cabin CO₂ keeps increasing. The crew starts to feel sleepy and gets headaches.' }
      ],
      tips: [
        'Astronauts breathe out CO₂. If it builds up, people get headaches and feel sleepy.',
        'Ask yourself: which systems keep the crew alive, and which ones can wait a while?',
        'Communication is important, but "essential" means needed to stay alive right now.'
      ],
      steps: [{
        ok: ['bat', 'lioh'],
        goal: 'Keep the CO₂ filter working. Find a reserve that adds electricity, or one that absorbs CO₂ without any power.',
        hint: 'Look along the Reserve Bay. One reserve is a yellow battery box, another is a rack of purple CO₂ canisters.',
        done: { bat: 'The spare battery is connected. The CO₂ filter has power again.', lioh: 'The canisters soak up the CO₂ with no electricity needed.' },
        wrong: { o2: 'Oxygen is for breathing in. It does not take CO₂ out of the air.', n2: 'Nitrogen refills air pressure. It does not remove CO₂.', heat: 'A heater makes heat. It does not clean the air.', valve: 'A valve closes off a leak. It does not clean the air.' }
      }],
      win: 'CO₂ removal continues, so the air stays clean. Communication is limited for a while, but the crew can keep breathing safely.'
    },
    leak: {
      story: 'The leak alarm is beeping! A small crack lets cabin air slip out into space, and the pressure gauge is slowly falling.',
      gauges: () => [['Cabin pressure', '86 kPa ▼', 86, '#ffb066'], ['Normal pressure', '101 kPa', 100, '#7ddba3']],
      q: 'WHAT SHOULD THE CREW DO FIRST?',
      opts: [
        { id: 'A', t: 'Increase oxygen production', s: 'Make more breathing oxygen.', good: false,
          out: 'More oxygen is made, but the air keeps escaping through the leak, so the pressure keeps dropping. It is like pouring water into a bucket with a hole!' },
        { id: 'B', t: 'Isolate the leak, then restore cabin pressure', s: 'Seal off the damaged section, then refill the air.', good: true },
        { id: 'C', t: 'Wait and watch the gauge', s: 'Maybe it will stop by itself.', good: false,
          out: 'A leak does not fix itself. The pressure keeps falling and the crew has less and less time.' }
      ],
      tips: [
        'Pressure is how hard the air pushes on the walls. A hole lets that air escape.',
        'Making more oxygen does not close the hole.',
        'Fix the hole first, then refill the air with the correct gas supply.'
      ],
      steps: [
        {
          ok: ['valve'],
          goal: 'Step 1 of 2 · Stop the leak. Find the part that closes off the damaged section.',
          hint: 'Look for a red wheel on a pipe.',
          done: { valve: 'Leak isolated! The air stops escaping.' },
          wrong: { n2: 'Not yet! If you refill now, the new air just leaks out again. Isolate the leak first.', o2: 'More oxygen will not stop the leak. Isolate the damaged section first.', bat: 'A battery gives power. It cannot seal a leak.', lioh: 'These clean CO₂. They cannot seal a leak.', heat: 'A heater cannot seal a leak.' }
        },
        {
          ok: ['n2'],
          goal: 'Step 2 of 2 · Restore the pressure. Find the gas reserve that refills the cabin air.',
          hint: 'Cabin air is mostly nitrogen. Look for the dark bottle with the green band.',
          done: { n2: 'Nitrogen flows into the cabin and the pressure climbs back to 101 kPa.' },
          wrong: { o2: 'Pure oxygen would make the air too rich, which is a fire danger. Cabin air is mostly nitrogen.', valve: 'The leak is already sealed. Now refill the air.', bat: 'A battery gives power. It cannot refill air.', lioh: 'These clean CO₂. They cannot refill air.', heat: 'A heater cannot refill air.' }
        }
      ],
      win: 'The leak is sealed and the cabin is back to normal pressure. Making more oxygen alone would never have fixed the hole.'
    },
    cold: {
      story: 'The temperature inside the habitat is dropping. The crew is shivering and equipment is getting cold. But heating uses a lot of battery power, and the CO₂ filter and radio need that power too.',
      gauges: () => { const b = lifeD.res[2].pct; return [['Temperature', '9 °C ▼', 30, '#6ab4ff'], ['Comfortable range', '18–24 °C', 70, '#7ddba3'], ['Battery power', b + '%', b, LEVEL[lvOf(b)]]]; },
      q: 'HOW SHOULD THE HEATING BE SET?',
      opts: [
        { id: 'A', t: 'Run the heater at maximum', s: 'Warm fast, but uses most of the battery.', good: false,
          out: 'The habitat warms quickly, but the heater drinks the battery. The CO₂ filter and the radio start to lose power.' },
        { id: 'B', t: 'Warm the crew area to a comfortable level and keep essential systems powered', s: 'Medium heat. The CO₂ filter and radio keep running.', good: true },
        { id: 'C', t: 'Switch the heater off to save power', s: 'Keep all the battery power.', good: false,
          out: 'No power is used, but the cabin gets even colder. Crew and equipment are in danger.' }
      ],
      tips: [
        'Being warm matters, but a heater at full power uses a lot of electricity.',
        'List what needs power: heater, CO₂ filter, radio. Which ones can the crew not live without?',
        'A balanced plan keeps people comfortable and keeps the essential systems running.'
      ],
      steps: [{
        ok: ['heat'],
        goal: 'Find the backup heater so you can warm the crew area at a gentle setting.',
        hint: 'It is an orange box with glowing red slats.',
        done: { heat: 'The backup heater is on at a medium setting. The crew area warms up while the filter and radio keep their power.' },
        wrong: { bat: 'A battery stores electricity, but you need something that makes heat.', o2: 'Oxygen does not warm the room.', n2: 'Nitrogen does not warm the room.', lioh: 'These clean CO₂. They do not make heat.', valve: 'A valve closes off a leak. It does not make heat.' }
      }],
      win: 'The crew area is warm and comfortable, and the CO₂ filter and radio still have power. Good balance!'
    }
  };

  // ---------- styles + page elements ----------
  const lvCss = document.createElement('style');
  lvCss.textContent = `
    #lv-panel{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:4;pointer-events:none;font-family:Barlow,sans-serif}
    #lv-hud{position:fixed;top:5.6rem;left:50%;transform:translateX(-50%);z-index:3;display:none;width:min(640px,92vw);padding:.6rem .9rem;border-radius:12px;background:rgba(5,14,24,.9);border:2px solid #ffd36a;color:#eef1f6;font:500 .92rem Barlow,sans-serif;box-shadow:0 0 24px rgba(255,211,106,.25)}
    #lv-hud b{color:#ffd36a;letter-spacing:.08em}
    #lv-hud button,.lv-ask{background:transparent;border:1px solid #ffd36a;color:#ffd36a;border-radius:999px;padding:.2rem .75rem;cursor:pointer;font:600 .8rem Barlow,sans-serif;margin-left:.5rem}
    .lv-ask{margin:.45rem 0 0}
    #lv-say{position:fixed;left:50%;bottom:24%;transform:translateX(-50%);z-index:5;display:none;width:min(520px,90vw);padding:.7rem 1rem;border-radius:12px;background:rgba(5,14,24,.95);border:2px solid #6ab4ff;color:#eef1f6;font:500 .92rem Barlow,sans-serif;text-align:center;pointer-events:none}
    #lv-say.bad{border-color:#ff5d5d}#lv-say.good{border-color:#7ddba3}
    #lv-tip{position:fixed;z-index:5;display:none;max-width:240px;padding:.5rem .7rem;border-radius:10px;background:rgba(5,14,24,.95);border:1.5px solid #9fd4ff;color:#eef1f6;font:500 .82rem Barlow,sans-serif;pointer-events:none}
    #lv-tip b{color:#9fd4ff}
    #lv-reopen{position:fixed;right:1rem;bottom:1rem;z-index:3;display:none;border-color:#ff5d5d;color:#ff9a8f}
    .lv-g .evp-m{grid-template-columns:130px 1fr 92px}
    .lv-tips{margin-top:.8rem;padding:.55rem .8rem;border-radius:10px;border:1.5px dashed #ffd36a;background:rgba(255,211,106,.08);font-size:.88rem;color:#ffe7a3}
    .lv-tips p{margin:.25rem 0}
    .lv-x{opacity:.4;text-decoration:line-through}
    .lv-stars{font-size:1.7rem;letter-spacing:.2rem}`;
  document.head.appendChild(lvCss);
  const lvPanel = mkEl('div', 'lv-panel'), lvHud = mkEl('div', 'lv-hud'), lvSayEl = mkEl('div', 'lv-say'), lvTip = mkEl('div', 'lv-tip');
  const lvReopen = mkEl('button', 'lv-reopen'); lvReopen.className = 'btn btn-ghost'; lvReopen.textContent = '⚠ Life Support decision';
  [lvHud, lvReopen].forEach(el => el.addEventListener('pointerdown', e => e.stopPropagation()));
  lvReopen.addEventListener('click', () => { if (state === 'inside' && !busy && lifeEv && (lifeEv.stage === 'decide' || lifeEv.stage === 'oops')) openLifePanel(); });

  function lvSay(html, cls) {
    lvSayEl.className = cls || ''; lvSayEl.innerHTML = html; lvSayEl.style.display = 'block';
    clearTimeout(sayTimer); sayTimer = setTimeout(() => { lvSayEl.style.display = 'none'; }, 5200);
  }

  // ---------- the reserve bay (6 reserves in a row, shuffled every visit) ----------
  function makeReserve(k) {
    const g = new THREE.Group(), steel = mat(0xcfd6e0, { metalness: .8, roughness: .3 }), dk = mat(0x2a2f3a, { metalness: .6, roughness: .5 });
    cyl(g, 1.1, 1.2, .2, dk, 0, .1, 0, 24);
    if (k === 'o2' || k === 'n2') {
      const bm = mat(k === 'o2' ? 0xf1f4f8 : 0x3b4452, { roughness: .45, metalness: .35 });
      cyl(g, .62, .62, 2.6, bm, 0, 1.6, 0, 28);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(.62, 24, 10, 0, 6.283, 0, 1.5708), bm); dome.position.y = 2.9; g.add(dome);
      cyl(g, .64, .64, .45, glow(k === 'o2' ? 0x3da0ff : 0x7ddba3, .9), 0, 1.9, 0, 28);
      cyl(g, .16, .16, .35, steel, 0, 3.55, 0, 10); box(g, .6, .12, .12, steel, 0, 3.75, 0);
    } else if (k === 'bat') {
      box(g, 1.9, 2.2, 1.3, mat(0xe6b020, { roughness: .5, metalness: .3 }), 0, 1.3, 0);
      box(g, 1.5, .5, .06, dk, 0, 1.95, .66);
      [0, 1, 2].forEach(i => box(g, .3, .22, .08, glow(0x7ddba3, 1.8), -.5 + i * .5, 1.95, .7));
      box(g, .8, .8, .06, mat(0x15181e, { roughness: .8 }), 0, 1.0, .66);
      cyl(g, .12, .12, .3, steel, -.5, 2.55, 0, 8); cyl(g, .12, .12, .3, steel, .5, 2.55, 0, 8);
    } else if (k === 'lioh') {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        cyl(g, .34, .34, 1.5, mat(0xc9b8ff, { roughness: .45, metalness: .3 }), -.8 + i * .8, 1.0, -.4 + j * .8, 18);
        cyl(g, .36, .36, .12, steel, -.8 + i * .8, 1.78, -.4 + j * .8, 18);
      }
      [-1.15, 1.15].forEach(x => box(g, .08, 1.9, .08, steel, x, 1.1, 0)); box(g, 2.4, .08, .08, steel, 0, 2.05, -.4); box(g, 2.4, .08, .08, steel, 0, 2.05, .4);
    } else if (k === 'heat') {
      box(g, 2.2, 1.8, 1.2, mat(0xe8742a, { roughness: .5, metalness: .35 }), 0, 1.1, 0);
      box(g, 1.7, 1.1, .06, dk, 0, 1.1, .62);
      [0, 1, 2, 3].forEach(i => box(g, 1.5, .06, .08, glow(0xff5a2a, 1.6), 0, .75 + i * .25, .66));
      box(g, 2.2, .1, 1.3, steel, 0, 2.05, 0);
    } else {
      const p = cyl(g, .38, .38, 3, steel, 0, .9, 0, 20); p.rotation.z = Math.PI / 2;
      [-1.4, 1.4].forEach(x => { const f = cyl(g, .55, .55, .18, steel, x, .9, 0, 20); f.rotation.z = Math.PI / 2; });
      const body = new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 14), steel); body.position.y = .9; g.add(body);
      cyl(g, .1, .1, .9, dk, 0, 1.6, 0, 8);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(.55, .09, 8, 28), mat(0xd63a2f, { roughness: .5, metalness: .3 })); wheel.rotation.x = Math.PI / 2; wheel.position.y = 2.1; g.add(wheel);
      box(g, 1.1, .08, .08, mat(0xd63a2f, { roughness: .5 }), 0, 2.1, 0); box(g, .08, .08, 1.1, mat(0xd63a2f, { roughness: .5 }), 0, 2.1, 0);
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const halo = glowSprite(0x9fd4ff, 5.5, 0); halo.position.y = 1.7; halo.raycast = () => { }; g.add(halo); g.userData.halo = halo;
    return g;
  }
  function buildReserves(g) {
    const kinds = ['o2', 'n2', 'bat', 'lioh', 'heat', 'valve'];
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = kinds[i]; kinds[i] = kinds[j]; kinds[j] = t; }
    box(g, 27, .02, 3.4, mat(0x1a1f27, { roughness: .8, metalness: .4 }), 0, .01, 3.6);
    box(g, 27, .025, .3, hazMat, 0, .012, 5.2); box(g, 27, .025, .3, hazMat, 0, .012, 2.0);
    const sign = label('RESERVE BAY', '#ffd36a', 512, 128, 56); sign.scale.set(4.2, 1.05, 1); sign.position.set(0, 4.6, 3.6); g.add(sign);
    reserveObjs = [];
    kinds.forEach((k, i) => {
      const o = makeReserve(k); o.position.set(-10.5 + i * 4.2, .02, 3.6); o.userData.reserve = k; o.userData.solved = false;
      g.add(o); reserveObjs.push(o);
    });
  }
  function reserveRay(e) {
    if (!reserveObjs) return null;
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(reserveObjs, true)[0]; if (!h) return null;
    let o = h.object; while (o && !o.userData.reserve) o = o.parent; return o;
  }
  function reserveOver(e) {
    const o = reserveRay(e); hoverRes = o;
    if (!o) { lvTip.style.display = 'none'; return false; }
    const R = RES[o.userData.reserve];
    lvTip.innerHTML = '<b>' + R.name + '</b><br>' + R.info;
    lvTip.style.left = Math.min(e.clientX + 16, innerWidth - 256) + 'px'; lvTip.style.top = Math.min(e.clientY + 16, innerHeight - 90) + 'px'; lvTip.style.display = 'block';
    return true;
  }
  function reserveClick(e) {
    const o = reserveRay(e); if (!o) return false;
    const k = o.userData.reserve, R = RES[k];
    if (!lifeEv || lifeEv.stage !== 'hunt') { lvSay('<b>' + R.name + '</b><br>' + R.info, ''); return true; }
    const S = LIFE_EV[lifeEv.id].steps[lifeEv.step];
    if (S.ok.indexOf(k) < 0) {
      lifeEv.mistakes++; beep(200, .25, 0);
      lvSay('✖ <b>' + R.name + '</b><br>' + ((S.wrong && S.wrong[k]) || 'That will not solve this problem. Read the clue and try another reserve.'), 'bad');
      return true;
    }
    o.userData.solved = true; beep(660, .12, 0); beep(990, .2, .14);
    lvSay('✔ <b>' + R.name + '</b><br>' + (S.done[k] || ''), 'good');
    if (k === 'bat' && BAT_GAIN[lifeEv.id]) pw.level = Math.min(100, pw.level + BAT_GAIN[lifeEv.id]);
    lifeEv.step++;
    if (lifeEv.step < LIFE_EV[lifeEv.id].steps.length) { showHud(); }
    else {
      lvHud.style.display = 'none'; lifeEv.stage = 'win';
      setTimeout(() => {
        if (!lifeEv || lifeEv.stage !== 'win') return;
        if (lifeDept === lifeD && state === 'inside') showLifeResult(); else lifeEv.stage = 'resultWait';
      }, 2200);
    }
    return true;
  }

  // ---------- panels ----------
  function lifeHead(title, extra) { return '<div class="evp-head"><b>' + title + '</b><span>' + (extra || '') + '<button class="evp-x" data-act="lclose">✕</button></span></div>'; }
  function lifeDecideHTML() {
    const E = EVENTS[lifeEv.id], C = LIFE_EV[lifeEv.id];
    const gauges = C.gauges().map(([n, v, p, c]) => `<div class="evp-m"><span>${n}</span><div class="evp-bar"><i style="width:${p}%;background:${c}"></i></div><em style="color:${c}">${v}</em></div>`).join('');
    const opts = C.opts.map(o => { const x = lifeEv.tried.indexOf(o.id) >= 0; return `<button class="evp-prio${lifeEv.sel === o.id ? ' on' : ''}${x ? ' lv-x' : ''}" data-act="opt-${o.id}"${x ? ' disabled' : ''}><b>${o.id}</b>${o.t}<small>${o.s}</small></button>`; }).join('');
    const tips = (noLink() ? [] : C.tips.slice(0, lifeEv.tipN)).map(t => `<p>💡 ${t}</p>`).join('');
    const more = noLink() ? '<p class="evp-note">📡 There is no link to Mission Control right now (Communication is in battery saving mode, or the antenna is down), so no tips can arrive.</p>' : lifeEv.tipN < C.tips.length ? '<button class="lv-ask" data-act="tip">💡 Ask Mission Control for another tip</button>' : '';
    return `<div class="evp-card">${lifeHead('⚠ ' + E.title, '<button class="evp-x" data-act="lconsole">📊 Control panel</button>')}
      <p class="evp-txt">${C.story}</p><div class="lv-g">${gauges}</div>
      <div class="evp-h">${C.q}</div><div class="evp-prios">${opts}</div>
      <div class="lv-tips">${tips}${more}</div>
      <button class="evp-go" data-act="lgo"${lifeEv.sel ? '' : ' disabled'}>Confirm ▶</button></div>`;
  }
  function lifeOopsHTML() {
    const C = LIFE_EV[lifeEv.id], o = C.opts.find(x => x.id === lifeEv.sel);
    return `<div class="evp-card">${lifeHead('RESULT')}<div class="evp-res bad">Not the best choice</div><p class="evp-txt">${o.out}</p>
      <div class="lv-tips">💡 ${C.tips[Math.min(lifeEv.bad, C.tips.length) - 1]}</div><button class="evp-go" data-act="again">Try again ▶</button></div>`;
  }
  function lifeResultHTML() {
    const E = EVENTS[lifeEv.id], C = LIFE_EV[lifeEv.id], n = lifeEv.stars;
    return `<div class="evp-card">${lifeHead('MISSION RESULT')}<div class="lv-stars">${'⭐'.repeat(n)}${'☆'.repeat(3 - n)}</div>
      <div class="evp-res good">Crisis solved!</div><p class="evp-txt">${C.win}</p>
      ${lifeEv.first ? '' : '<p class="evp-note">You needed more than one try, and that is how real astronauts learn.</p>'}
      <div class="evp-learn">📌 <b>REMEMBER:</b> ${E.lesson}</div><button class="evp-go" data-act="ldone">Continue ▶</button></div>`;
  }
  function renderLife() { lvPanel.innerHTML = lifeEv.stage === 'oops' ? lifeOopsHTML() : lifeEv.stage === 'result' ? lifeResultHTML() : lifeDecideHTML(); }
  function openLifePanel() {
    if (!lifeEv || lifeEv.stage === 'hunt' || lifeEv.stage === 'win') return;
    state = 'levent'; canvas.style.cursor = 'default'; line.textContent = '';
    renderLife(); lvPanel.style.display = 'flex';
    gsap.fromTo(lvPanel.firstChild, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .35 });
  }
  function closeLifePanel() { lvPanel.style.display = 'none'; if (state === 'levent') state = 'inside'; }
  lvPanel.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled || !lifeEv) return;
    const a = b.dataset.act, C = LIFE_EV[lifeEv.id];
    if (a.indexOf('opt-') === 0) { lifeEv.sel = a.slice(4); renderLife(); }
    else if (a === 'tip') { lifeEv.tipN = Math.min(C.tips.length, lifeEv.tipN + 1); renderLife(); }
    else if (a === 'lgo') {
      const o = C.opts.find(x => x.id === lifeEv.sel); if (!o) return;
      if (o.good) { closeLifePanel(); startHunt(); }
      else { lifeEv.bad++; lifeEv.first = false; lifeEv.tried.push(o.id); lifeEv.stage = 'oops'; beep(220, .3, 0); renderLife(); }
    }
    else if (a === 'again') { lifeEv.stage = 'decide'; lifeEv.sel = null; lifeEv.tipN = Math.min(C.tips.length, Math.max(lifeEv.tipN, lifeEv.bad + 1)); renderLife(); }
    else if (a === 'lconsole') { closeLifePanel(); openPanel(); }
    else if (a === 'lclose') { if (lifeEv.stage === 'result') endLifeEvent(); else closeLifePanel(); }
    else if (a === 'ldone') endLifeEvent();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && state === 'levent' && lifeEv && lifeEv.stage !== 'result') closeLifePanel(); });

  // ---------- the hunt ----------
  function showHud() {
    const S = LIFE_EV[lifeEv.id].steps[lifeEv.step];
    lvHud.innerHTML = '<b>🔎 FIND THE RESERVE</b> · ' + S.goal + ' <button id="lv-hint">💡 Hint</button>';
    lvHud.style.display = 'block';
    document.getElementById('lv-hint').onclick = () => { if (noLink()) { lvSay('📡 No link to Earth right now, so hints are unavailable.', 'bad'); return; } lifeEv.hint = true; hintUntil = clock.getElapsedTime() + 6; lvSay('💡 ' + S.hint, ''); };
  }
  function startHunt() {
    lifeEv.stage = 'hunt'; lifeEv.step = 0; showHud();
    line.textContent = 'Move your mouse to look around the Reserve Bay. Hover to read each label, then click the right reserve.';
  }
  function showLifeResult() {
    if (!lifeEv) return;
    if (!lifeEv.counted) {
      lifeEv.counted = true;
      lifeEv.stars = Math.max(1, 3 - (lifeEv.first ? 0 : 1) - (lifeEv.mistakes >= 3 ? 1 : 0) - (lifeEv.hint ? 1 : 0));
      const E = EVENTS[lifeEv.id], l = lessons[lifeEv.id] || (lessons[lifeEv.id] = { text: E.lesson, tries: 0, wins: 0 });
      l.tries++; if (lifeEv.first) l.wins++; saveLessons();
    }
    lifeEv.stage = 'result'; lvHud.style.display = 'none'; state = 'levent'; line.textContent = '';
    renderLife(); lvPanel.style.display = 'flex';
    gsap.fromTo(lvPanel.firstChild, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .35 });
  }
  function endLifeEvent() {
    lvPanel.style.display = 'none'; lvHud.style.display = 'none';
    lifeD.ringMat.color.set(lifeD.color);
    if (reserveObjs) reserveObjs.forEach(o => { o.userData.solved = false; });
    if (lifeEv && lifeEv.counted) pw.handled++;
    lifeEv = null; evTimer = nextEvDelay(); if (state === 'levent') state = 'inside'; line.textContent = '';
  }
  function resumeLifeEvent() {   // called when the player walks into Life Support while an event is active
    if (!lifeEv) return;
    if (lifeEv.stage === 'hunt') { showHud(); line.textContent = 'Move your mouse to look around the Reserve Bay. Hover to read each label, then click the right reserve.'; }
    else if (lifeEv.stage === 'resultWait') showLifeResult();
    else openLifePanel();
  }
  function lvLeaveCleanup() {
    lvPanel.style.display = 'none'; lvHud.style.display = 'none'; lvTip.style.display = 'none'; lvSayEl.style.display = 'none';
    reserveObjs = null; hoverRes = null;
  }

  // ---------- control panel extra rows while an event is active ----------
  function lifeRow(d) {
    if (!lifeEv || d.id !== 'life') return '';
    const E = EVENTS[lifeEv.id], C = LIFE_EV[lifeEv.id];
    return `<div class="lsp-alert" style="background:#ff5d5d22;border:1px solid #ff5d5d;color:#ff9a8f;margin:0 0 6px">⚠ ${E.title}: ${E.msg}</div>`
      + C.gauges().map(([n, v, p, c]) => `<div class="lsp-row"><div class="lsp-name">${n}</div><div class="lsp-bar"><i style="width:${p}%;background:${c}"></i></div><div class="lsp-val" style="color:${c};font-size:1.1rem">${v}</div></div>`).join('');
  }

  // ---------- alert + random picker (every 30 s) ----------
  function triggerLifeEvent(id) {
    const E = EVENTS[id]; if (!E || lifeEv || flareActive) return;
    lifeEv = { id, stage: 'decide', sel: null, tried: [], first: true, bad: 0, mistakes: 0, hint: false, step: 0, tipN: 1, counted: false, stars: 3 };
    lifeD.ringMat.color.set(0xff3a30);
    const rem = lessons[id] ? `<p class="evt-rem">📌 Remember: ${E.lesson}</p>` : '';
    evToast.innerHTML = `<div class="evt-card"><div class="evt-ico">⚠</div><div><b>${E.title}</b><p>${E.msg}</p><p class="evt-go">▶ ${E.goal}</p>${rem}</div></div>`;
    evToast.style.display = 'flex'; toastOn = true;
    gsap.fromTo(evToast.firstChild, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: .4 });
    setTimeout(() => { toastOn = false; gsap.to(evToast.firstChild, { opacity: 0, duration: .5, onComplete: () => { evToast.style.display = 'none'; } }); }, 11000);
    evFlash.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 1000 });
    beep(880, .18, 0); beep(660, .18, .25); beep(880, .18, .5);
    line.textContent = E.goal;
  }
  // ---- emergency scheduler: random gap, weighted pick, never the same event twice in a row ----
  const recentEv = [];
  function nextEvDelay() {          // 25-50 s between emergencies, a little faster late in the mission
    const late = pw.started ? 1 - pw.time / MISSION_SEC : 0;
    return (25 + Math.random() * 25) * (1 - .25 * late);
  }
  function pickEvent() {
    if (pw.over) return;
    const W = { co2: 3, leak: 2, cold: 2, o2: 2, power: 2, water: 2, solar: 2, comm: 2, flare: 3, radiation: 3 };
    if (pw.level < 40) { W.co2 *= 2; W.power *= 2; W.solar *= 2; }
    const ok = k => (k !== 'co2' || pw.level < BATT.WARN) && (k !== 'radiation' || !rad.seen || Math.random() < .5);
    let pool = EVENT_POOL.filter(k => recentEv.indexOf(k) < 0 && ok(k));
    if (!pool.length) pool = EVENT_POOL.filter(k => k !== lastEv && (k !== 'co2' || pw.level < BATT.WARN));
    let r = Math.random() * pool.reduce((a, k) => a + W[k], 0), id = pool[pool.length - 1];
    for (const k of pool) { r -= W[k]; if (r <= 0) { id = k; break; } }
    lastEv = id; recentEv.push(id); if (recentEv.length > 2) recentEv.shift();
    const fire = () => {
      if (pw.over) return;
      if (id === 'power') pw.level = Math.max(0, pw.level - 12);   // the faulty line wastes some battery
      if (id === 'flare') triggerEvent('flare'); else if (id === 'radiation') triggerRadiation(); else triggerLifeEvent(id);
      if (!lifeEv && !flareActive && !rad.on) evTimer = 5;       // could not start right now: try again soon
    };
    if (pw.comms === 'saver' && !pw.powerOut) {                  // saving mode = delayed messages
      evTimer = 1e9;
      btNotify('📡 Communication is in saving mode, so the alert from the sensors is arriving late...', '#ffb066', 4500);
      setTimeout(fire, 4500);
    } else fire();
  }
  function updateLifeEvents(t) {
    const dt = Math.min(t - lifeLast, .1); lifeLast = t;
    if (!flareActive && !lifeEv && !rad.on && !rad.follow) { evTimer -= dt; if (evTimer <= 0 && state === 'base' && !busy && !pw.over && pw.started) pickEvent(); }
    if (lifeEv) lifeD.ringMat.opacity = .4 + .5 * Math.abs(Math.sin(t * 5));
    const txt = flareActive ? '⚠ Solar flare: find the Communication base' : lifeEv ? '⚠ ' + EVENTS[lifeEv.id].title + ': find the Life Support base' : '';
    if (evObj._t !== txt) { evObj.textContent = txt; evObj._t = txt; }
    evObj.style.display = (flareActive || lifeEv) && state === 'base' && !toastOn ? 'block' : 'none';
    lvReopen.style.display = lifeEv && (lifeEv.stage === 'decide' || lifeEv.stage === 'oops') && state === 'inside' && lifeDept === lifeD ? 'inline-flex' : 'none';
    if (reserveObjs) reserveObjs.forEach(o => {
      const u = o.userData, hov = hoverRes === o;
      const hintShow = lifeEv && lifeEv.stage === 'hunt' && hintUntil > t && LIFE_EV[lifeEv.id].steps[lifeEv.step].ok.indexOf(u.reserve) >= 0;
      u.halo.material.opacity = u.solved ? .55 : hov ? .5 : hintShow ? .3 + .35 * Math.abs(Math.sin(t * 5)) : 0;
      u.halo.material.color.set(u.solved ? 0x7ddba3 : hintShow ? 0xffd36a : 0x9fd4ff);
    });
  }




// =====================================================================
  //  ALWAYS-ON STATUS BUTTON: every resource + every alarm, from anywhere
  // =====================================================================
  const stCss = document.createElement('style');
  stCss.textContent = `
    #st-btn{position:fixed;top:1rem;right:1rem;z-index:6;display:inline-flex;align-items:center;gap:.5rem}
    #st-btn i{font-style:normal;min-width:1.4rem;height:1.4rem;line-height:1.4rem;padding:0 .3rem;text-align:center;border-radius:999px;background:#ff5d5d;color:#1a0505;font:700 .78rem Barlow,sans-serif}
    #st-btn.alarm{border-color:#ff5d5d;animation:evpulse 1s ease-in-out infinite alternate}
    #st-panel{position:fixed;top:4rem;right:1rem;z-index:6;display:none;width:min(390px,92vw);max-height:78vh;overflow:auto;background:rgba(5,14,24,.95);border:2px solid #4ff0c8;border-radius:14px;box-shadow:0 0 36px rgba(79,240,200,.25);padding:14px 16px;color:#eef1f6;font-family:Barlow,sans-serif}
    .st-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
    .st-head b{color:#4ff0c8;letter-spacing:.12em;font-size:.95rem}
    .st-head button{background:transparent;border:1px solid #4ff0c8;color:#4ff0c8;border-radius:999px;padding:.2rem .7rem;cursor:pointer;font:600 .8rem Barlow,sans-serif}
    .st-h{margin:.8rem 0 .3rem;font-weight:700;font-size:.8rem;letter-spacing:.1em;color:#9fb4c7}
    .st-al{margin:.3rem 0;padding:.45rem .6rem;border-radius:8px;font-size:.84rem;line-height:1.25}
    .st-al small{display:block;opacity:.75;font-size:.72rem;letter-spacing:.06em}
    .st-ok{color:#7ddba3;font-size:.9rem;margin:.3rem 0}
    .st-d{margin:.7rem 0 .15rem;font-weight:700;font-size:.95rem;display:flex;align-items:center;gap:.5rem}
    .st-d u{width:.7rem;height:.7rem;border-radius:50%;display:inline-block}
    .st-r{display:grid;grid-template-columns:1fr 70px 44px;gap:8px;align-items:center;margin:.22rem 0;font-size:.82rem}
    .st-r .b{height:9px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}.st-r .b i{display:block;height:100%}
    .st-r em{font-style:normal;font-weight:700;text-align:right}`;
  document.head.appendChild(stCss);
  const stBtn = mkEl('button', 'st-btn'); stBtn.className = 'btn btn-ghost';
  const stPanel = mkEl('div', 'st-panel');
  [stBtn, stPanel].forEach(el => el.addEventListener('pointerdown', e => e.stopPropagation()));
  let stOpen = false, stLastT = -1, stHtml = '', stBadge = '';
  function alarmList() {
    const a = [];
    if (flareActive) a.push({ c: '#ff5d5d', t: 'Solar flare: only 40% of the bandwidth works.', w: 'Communication', ev: 1 });
    if (rad.on && rad.phase !== 'idle') a.push({ c: '#ff5d5d', t: 'Radiation storm in progress', w: 'Whole base', ev: 1 });
    if (lifeEv) a.push({ c: '#ff5d5d', t: EVENTS[lifeEv.id].title + ': ' + EVENTS[lifeEv.id].msg, w: 'Life Support', ev: 1 });
    DEPTS.forEach(d => (d.res || []).forEach(r => {
      const lv = lvOf(r.pct); if (lv === 'A') return;
      a.push({ c: LEVEL[lv], t: r.name + ' at ' + r.pct + '% (' + LTXT[lv] + ')', w: d.name, crit: lv === 'C' ? 1 : 0 });
    }));
    return a.sort((x, y) => (y.ev || 0) - (x.ev || 0) || (y.crit || 0) - (x.crit || 0));
  }
  function statusHTML(al) {
    const alarms = al.length
      ? al.map(x => `<div class="st-al" style="background:${x.c}22;border:1px solid ${x.c};color:${x.c}">${x.ev || x.crit ? '⚠ ' : ''}${x.t}<small>${x.w.toUpperCase()}</small></div>`).join('')
      : '<div class="st-ok">✔ No alarms. All systems are normal.</div>';
    const depts = DEPTS.map(d => `<div class="st-d"><u style="background:${d.color}"></u>${d.name}</div>` + (d.res || []).map(r => {
      const lv = lvOf(r.pct), c = LEVEL[lv];
      return `<div class="st-r"><span>${r.name}</span><div class="b"><i style="width:${r.pct}%;background:${c}"></i></div><em style="color:${c}">${r.pct}%</em></div>`;
    }).join('')).join('');
    return `<div class="st-head"><b>STATUS · ALL DEPARTMENTS</b><button id="st-x">✕</button></div>
      <div class="st-h">ALARMS (${al.length})</div>${alarms}<div class="st-h">RESOURCES</div>${depts}`;
  }
  function setStatus(open) {
    stOpen = open; stPanel.style.display = open ? 'block' : 'none'; stLastT = -1;
    if (open) updateStatus(clock.getElapsedTime());
  }
  stBtn.addEventListener('click', () => setStatus(!stOpen));
  stPanel.addEventListener('click', e => { if (e.target.id === 'st-x') setStatus(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && stOpen) setStatus(false); });
  function updateStatus(t) {
    if (t - stLastT < .25) return; stLastT = t;
    const al = alarmList(), bad = al.some(x => x.ev || x.crit);
    const badge = '📊 Status' + (al.length ? ' <i style="background:' + (bad ? '#ff5d5d' : '#ffb066') + '">' + al.length + '</i>' : '');
    if (badge !== stBadge) { stBtn.innerHTML = badge; stBadge = badge; }
    stBtn.classList.toggle('alarm', bad);
    if (stOpen) { const h = statusHTML(al); if (h !== stHtml) { const keep = stPanel.scrollTop; stPanel.innerHTML = h; stPanel.scrollTop = keep; stHtml = h; } }
  }



    // =====================================================================
  //  BATTERY + POWER MODES  and  MISSION MENU (way back to the start)
  //  Frontend only: everything lives in the browser.
  // =====================================================================
  const BATT = { FULL: 0.14, SAVER: 0.03, WARN: 50, CRIT: 20, EMERG: 10, SOLAR: 0.06 };   // CRIT / EMERG = warning levels; SOLAR = extra drain while a solar panel is damaged
  const BAT_GAIN = { co2: 20, power: 15, solar: 10, comm: 5 };   // % the spare battery pack adds for each emergency
  const noLink = () => pw.comms === 'saver' || (lifeEv && lifeEv.id === 'comm');   // no radio link to Mission Control   // battery % lost per SECOND by one unit (tweak these)
  const MISSION_SEC = 600;                               // the crew must survive this long to win (10 minutes)
  // crew health lost per second (tweak these)
  const HEALTH = { EVENT: 0.45, FLARE: 0.25, SAVER: 0.1, REGEN: 0.15, GRACE: 45, GRACE_LOW: 25 };   // GRACE_LOW = seconds before an unsolved emergency hurts when Communication is in saving mode
  const pw = { level: 100, life: 'full', comms: 'full', started: false, guided: false, guideOpen: false, empty: false, last: performance.now(),
    time: MISSION_SEC, crew: 100, over: false, powerOut: false, handled: 0, lifeAge: 0, flareAge: 0, restricted: false, critShown: false };
  lifeD.res[2].pct = 100;                                // the "Power Battery" reading in Life Support now follows the real battery

  const btCss = document.createElement('style');
  btCss.textContent = `
    #bt-hud{position:fixed;top:4.4rem;left:1rem;z-index:5;display:none;padding:.55rem .75rem;border-radius:12px;background:rgba(5,14,24,.82);border:1px solid rgba(160,190,235,.35);color:#eef1f6;font:600 .85rem Barlow,sans-serif;backdrop-filter:blur(6px);--bc:#7ddba3;min-width:190px}
    .bt-row{display:flex;align-items:center;gap:.6rem}
    .bt-ico{position:relative;width:50px;height:24px;border:2px solid #eef1f6;border-radius:6px;padding:2px;box-sizing:border-box}
    .bt-ico::after{content:"";position:absolute;right:-7px;top:5px;width:4px;height:10px;background:#eef1f6;border-radius:0 3px 3px 0}
    .bt-ico i{display:block;height:100%;border-radius:3px;background:var(--bc);box-shadow:0 0 10px var(--bc);transition:width .3s,background .3s}
    #bt-hud.low .bt-ico{animation:evpulse 1s ease-in-out infinite alternate}
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
  document.head.appendChild(btCss);

  const btHud = mkEl('div', 'bt-hud'), btNote = mkEl('div', 'bt-note'), btGuide = mkEl('div', 'bt-guide');
  const menuBtn = mkEl('button', 'mn-btn'), menuPanel = mkEl('div', 'mn-panel');
  menuBtn.className = 'btn btn-ghost'; menuBtn.innerHTML = '☰ Mission menu';
  btHud.innerHTML = '<div class="bt-row"><div class="bt-ico"><i id="bt-fill"></i></div><b class="bt-pct" id="bt-pct">100%</b><button class="bt-i" id="bt-info" title="Power guide">i</button></div>'
    + '<span class="bt-rate" id="bt-rate"></span>'
    + '<span class="bt-rate" id="bt-tm" style="opacity:1;font-size:.82rem;margin:.1rem 0 .45rem"></span>'
    + '<button class="bt-u" data-u="life" title="Click to switch between full power and battery saving">🌬️ Life Support <b></b></button>'
    + '<button class="bt-u" data-u="comms" title="Click to switch between full power and battery saving">📡 Communication <b></b></button>';
  [btHud, menuBtn, btGuide, menuPanel].forEach(el => el.addEventListener('pointerdown', e => e.stopPropagation()));   // clicks here must not make the astronaut walk

  // ---------- battery HUD ----------
  const btRate = () => (pw.life === 'full' ? BATT.FULL : BATT.SAVER) + (pw.comms === 'full' ? BATT.FULL : BATT.SAVER) + (lifeEv && lifeEv.id === 'solar' ? BATT.SOLAR : 0);
  function btRender() {
    const p = Math.round(pw.level), col = p >= 50 ? '#7ddba3' : p >= 25 ? '#ffb066' : '#ff5d5d';
    btHud.style.setProperty('--bc', col); btHud.classList.toggle('low', p < 25);
    btHud.querySelector('#bt-fill').style.width = p + '%';
    btHud.querySelector('#bt-pct').textContent = p + '%';
    { const left = pw.level / Math.max(.0001, btRate()), short = left < pw.time, el = btHud.querySelector('#bt-rate');
      el.textContent = 'Using about ' + (btRate() * 60).toFixed(1) + '% per minute · ' + (short ? '⚠ empty in ' + fmtT(left) : '✔ lasts the whole mission');
      el.style.color = short ? '#ff9a8f' : '#7ddba3'; }
    btHud.querySelector('#bt-tm').innerHTML = '⏱ Mission ' + fmtT(pw.time) + ' &nbsp;·&nbsp; 👩‍🚀 Crew <b style="color:' + (pw.crew > 60 ? '#7ddba3' : pw.crew > 30 ? '#ffb066' : '#ff5d5d') + '">' + Math.round(pw.crew) + '%</b>';
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
    if (pw.over) return;
    const u = b.dataset.u;
    if (pw.restricted && pw[u] === 'saver') { btNotify('🚨 <b>Emergency power:</b> full power is locked until the battery is above ' + (BATT.EMERG + 5) + '%.', '#ff5d5d', 5000); return; }
    pw[u] = pw[u] === 'full' ? 'saver' : 'full'; btRender();
    const name = u === 'life' ? '🌬️ Life Support' : '📡 Communication', eco = pw[u] === 'saver';
    btNotify(eco
      ? name + ' is now in <b>BATTERY SAVING</b> mode, so the battery drains slower. ' + (u === 'life' ? 'CO₂ removal and oxygen generation are slower, heating is weaker, emergencies get worse faster, and the crew slowly loses health.' : 'Emergency messages only, delayed alerts, no tips from Mission Control, and emergencies hurt sooner.')
      : name + ' is back at <b>FULL POWER</b>. The battery drains faster.', eco ? '#ffb066' : '#7ddba3', 7000);
  });

  // ---------- guide shown when the battery drops below 50% ----------
  function guideHTML() {
    return `<div class="bt-card">
      <div class="bt-gh"><b>⚠ BATTERY BELOW ${BATT.WARN}%</b><button class="bt-x" data-a="close">✕ Close</button></div>
      <p>The base can no longer keep every unit at full power. You may keep <b>one unit at full power</b> and put the <b>other unit in battery saving mode</b>. A unit in saving mode uses only about a fifth of the power. <b>If the battery reaches 0% before the mission timer ends, the mission is lost.</b> The mission clock keeps running while you read this.</p>
      <div class="bt-cols">
        <div class="bt-col" style="--c:#ff6fa5"><h4>📡 Communication in saving mode</h4><ul><li>Only emergency messages can be received</li><li>The signal has more noise</li><li>Delay gets longer (1.3 s becomes about 4 s)</li><li>Mission Control cannot send tips or hints, and emergencies hurt the crew sooner</li></ul></div>
        <div class="bt-col" style="--c:#6ab4ff"><h4>🌬️ Life Support in saving mode</h4><ul><li>CO₂ removal gets slower, and after some time an astronaut may fall ill</li><li>Oxygen generation takes much longer</li><li>Temperature control cannot keep the cabin warm</li><li>The crew slowly loses health while it lasts</li></ul></div>
      </div>
      <div class="bt-h">WHICH UNIT KEEPS FULL POWER?</div>
      <button class="bt-opt" data-a="life" style="--c:#6ab4ff"><span>🌬️</span><span>Keep Life Support at full power<small>Communication goes to battery saving mode</small></span></button>
      <button class="bt-opt" data-a="comms" style="--c:#ff6fa5"><span>📡</span><span>Keep Communication at full power<small>Life Support goes to battery saving mode</small></span></button>
      <button class="bt-keep" data-a="both">Keep both at full power for now (the battery will run out in about 6 minutes)</button></div>`;
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
    + '<button class="mn-opt" data-a="restart" style="--c:#7ddba3"><span class="mn-ico">🔄</span><span>Restart mission<small>Same category, fresh battery and timer</small></span></button>'
    + '<button class="mn-opt" data-a="mode" style="--c:#ffb066"><span class="mn-ico">🗺️</span><span>Change mission category<small>Go back to the Category A / B screen</small></span></button>'
    + '<button class="mn-opt" data-a="newplayer" style="--c:#c792ff"><span class="mn-ico">👤</span><span>New player<small>Clear this astronaut and start the introduction again</small></span></button>'
    + '<button class="mn-opt" data-a="home" style="--c:#6ab4ff"><span class="mn-ico">🏠</span><span>Back to the title screen<small>Start the game from the beginning</small></span></button>'
    + '<button class="btn btn-play" data-a="stay" style="width:100%;margin-top:.8rem">Keep playing</button></div>';
  function leaveBase(url) {
    try { ['astro_intro_done', 'astro_last_page'].forEach(k => localStorage.removeItem(k)); } catch (err) { }   // the chosen category ('mode') is kept on purpose   // so progress.js does not bounce you back here
    location.href = url;
  }
  menuBtn.addEventListener('click', () => { menuPanel.style.display = 'flex'; });
  menuPanel.addEventListener('click', e => {
    if (e.target === menuPanel) { menuPanel.style.display = 'none'; return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'restart') location.reload();
    else if (b.dataset.a === 'newplayer') { try { if (window.AstroProgress) AstroProgress.logout(); else ['astronaut', 'mode', 'astro_intro_done', 'astro_last_page'].forEach(k => localStorage.removeItem(k)); } catch (err) { } location.href = 'index.html?home'; }
    else if (b.dataset.a === 'mode') leaveBase('mode.html?home');
    else if (b.dataset.a === 'home') leaveBase('index.html?home');
    else menuPanel.style.display = 'none';
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') { menuPanel.style.display = 'none'; if (pw.guideOpen) closeGuide(); } });

  // ---------- mission clock: timer, battery, crew health, win / lose ----------
  const powerD = DEPTS.find(d => d.id === 'power');
  function fmtT(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  const endCss = document.createElement('style');
  endCss.textContent = `
    #mission-end{position:fixed;inset:0;z-index:12;display:none;align-items:center;justify-content:center;background:rgba(2,4,10,.82);backdrop-filter:blur(5px);font-family:Barlow,sans-serif}
    .me-card{width:min(480px,92vw);max-height:92vh;overflow:auto;padding:22px 24px;border-radius:16px;background:rgba(13,21,38,.98);border:2px solid var(--c,#7ddba3);box-shadow:0 0 50px rgba(0,0,0,.6);color:#eef1f6;text-align:center}
    .me-card h2{margin:.2rem 0 .3rem;font:800 2.2rem 'Big Shoulders Display',sans-serif;text-transform:uppercase;color:var(--c,#7ddba3)}
    .me-card p{margin:.3rem 0 .8rem;opacity:.85}
    .me-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:.8rem 0 1rem;text-align:left}
    .me-grid div{padding:.5rem .7rem;border-radius:10px;background:rgba(255,255,255,.06);font-size:.82rem;opacity:.95}
    .me-grid b{display:block;font-size:1.25rem}
    .me-btns{display:flex;flex-direction:column;gap:.5rem}`;
  document.head.appendChild(endCss);
  const endEl = mkEl('div', 'mission-end');
  [endEl].forEach(el => el.addEventListener('pointerdown', e => e.stopPropagation()));
  endEl.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    if (b.dataset.a === 'again') location.reload();
    else if (b.dataset.a === 'mode') leaveBase('mode.html?home');
    else if (b.dataset.a === 'home') leaveBase('index.html?home');
  });
  function endMission(won, reason) {
    if (pw.over) return;
    pw.over = true; busy = true; evTimer = 1e9; walkDir = 0;
    [evPanel, lvPanel, radPanel, btGuide, menuPanel, stPanel, btNote, lvHud].forEach(el => { if (el) el.style.display = 'none'; });
    const used = MISSION_SEC - pw.time, score = Math.round(pw.crew * 4 + pw.level * 2 + pw.handled * 60 + (won ? 400 : 0));
    const c = won ? '#7ddba3' : '#ff5d5d';
    endEl.innerHTML = `<div class="me-card" style="--c:${c}"><h2>${won ? 'Mission complete!' : 'Mission failed'}</h2>`
      + `<p>${won ? 'The crew survived the whole mission. Great decisions, Commander!' : reason}</p>`
      + `<div class="me-grid"><div>Survival time<b>${fmtT(used)} / ${fmtT(MISSION_SEC)}</b></div><div>Crew health<b>${Math.round(pw.crew)}%</b></div>`
      + `<div>Battery left<b>${Math.round(pw.level)}%</b></div><div>Emergencies solved<b>${pw.handled}</b></div>`
      + `<div style="grid-column:1/-1">Mission score<b>${score}</b></div></div>`
      + `<div class="me-btns"><button class="btn btn-play" data-a="again">${won ? 'Play again' : 'Try again'}</button>`
      + `<button class="btn btn-ghost" data-a="mode">Change mission category</button><button class="btn btn-ghost" data-a="home">Back to the title screen</button></div></div>`;
    endEl.style.display = 'flex';
  }
  let lastPct = -1;
  setInterval(() => {
    const now = performance.now(), dt = Math.min((now - pw.last) / 1000, 60); pw.last = now;   // real time always counts (a hidden tab or an open panel cannot pause the mission)
    menuBtn.style.display = state === 'base' && !pw.over ? 'inline-flex' : 'none';
    if (!pw.started && state === 'base') {
      pw.started = true; btHud.style.display = 'block';
      btNotify('⚡ <b>Life Support</b> and <b>Communication</b> are running at <b>FULL POWER</b>. Survive for <b>' + fmtT(MISSION_SEC) + '</b> to complete the mission. <b>If the battery reaches 0%, the mission is over</b>, so save power!', '#7ddba3', 9000);
      evTimer = nextEvDelay();
    }
    if (pw.started && !pw.over) {
      pw.time = Math.max(0, pw.time - dt);
      pw.level = Math.max(0, pw.level - (pw.level <= 0 ? 0 : btRate()) * dt);       // never below 0
      if (pw.level <= 0) endMission(false, 'The battery reached 0% before the ' + fmtT(MISSION_SEC) + ' were over. Life support lost power and the crew could not survive.');   // the rule of the game
      if (!pw.over) {
        if (pw.level <= BATT.EMERG && !pw.restricted) {
          pw.restricted = true; pw.comms = 'saver';
          btNotify('🚨 <b>EMERGENCY POWER:</b> under ' + BATT.EMERG + '%. Communication was forced into saving mode and nothing can be switched to full power until the battery is above ' + (BATT.EMERG + 5) + '%.', '#ff5d5d', 11000);
        } else if (pw.level <= BATT.CRIT && !pw.critShown) {
          pw.critShown = true;
          btNotify('⚠️ <b>CRITICAL BATTERY:</b> ' + Math.round(pw.level) + '% left. Switch systems to saving mode or find the spare battery pack.', '#ffb066', 9000);
        }
        if (pw.restricted && pw.level > BATT.EMERG + 5) pw.restricted = false;
        if (pw.critShown && pw.level > BATT.CRIT + 5) pw.critShown = false;
      }
      pw.lifeAge = lifeEv ? pw.lifeAge + dt : 0; pw.flareAge = flareActive ? pw.flareAge + dt : 0;
      let loss = 0;
      const grace = pw.comms === 'saver' ? HEALTH.GRACE_LOW : HEALTH.GRACE;   // without a radio link Earth cannot help, so emergencies hurt sooner
      if (pw.lifeAge > grace) loss += HEALTH.EVENT * (pw.life === 'saver' ? 1.6 : 1);   // saving mode = weaker oxygen, CO₂ removal and heating, so emergencies get worse faster
      if (evTimer < -20 && !lifeEv && !flareActive && !rad.on) loss += HEALTH.EVENT * .5;   // a queued emergency is waiting: hiding inside a building is not free
      if (pw.flareAge > grace) loss += HEALTH.FLARE;
      if (pw.life === 'saver') loss += HEALTH.SAVER;
      pw.crew = loss > 0 ? Math.max(0, pw.crew - loss * dt) : Math.min(100, pw.crew + HEALTH.REGEN * dt);
      if (pw.crew <= 0) endMission(false, pw.level <= 0 ? 'The battery ran out and life support failed.' : pw.lifeAge > grace ? 'An emergency was left unsolved for too long.' : 'The crew could not survive the conditions on the Moon.');
      else if (pw.time <= 0) endMission(true);
    }
    const p = Math.round(pw.level);
    lifeD.res[2].pct = p;                              // every battery display reads pw.level
    if (powerD) powerD.res[1].pct = p;
    if (p !== lastPct) {
      lastPct = p;
      liveTex.forEach(t => t.repaint());
      liveRead.forEach(s => { if (s.userData.res === lifeD.res[2]) s.userData.repaint(p); });
    }
    btRender();
    if (pw.started && !pw.over && pw.level < BATT.WARN && !pw.guided && !pw.guideOpen && (state === 'base' || state === 'inside') && !busy) openGuide();
  }, 250);



// =====================================================================
  //  RADIATION EMERGENCY  (NASA DONKI · SEP event)
  //  Paste this whole block ABOVE the line:  // intro: landing + story lines
  //  Flow: random alert -> decision A/B -> countdown -> visit each department's
  //  intercom -> crew walk to the Radiation Shelter -> storm peak -> result ->
  //  damaged resources -> forced follow-up crisis.   (Press R in base to test.)
  // =====================================================================
  const CREW = { life: 3, power: 2, comms: 2, supply: 3 };               // 10 astronauts in total
  const WALKER_OF = { life: [0, 4], power: [1], comms: [2], supply: [3] }; // which outdoor walkers belong to which department
  const DOOR = V(0, 0, -1.6);                                              // shelter door (outside, front)
  const RADCFG = { A: { T: 150, react: 3, rate: 1 }, B: { T: 120, react: 20, rate: 2.2 } }; // T = seconds until peak
  const STORM_LEN = 15, HURT = 50, SPEED = 5;
  // [resource index in d.res, % lost if crew NOT alerted, % lost if alerted]
  const DMG = {
    life: [[2, 14, 5], [1, 18, 6]], power: [[0, 40, 12]],
    comms: [[0, 28, 9], [2, 12, 4]], supply: [[1, 24, 8], [2, 8, 3]]
  };
  const IC_POS = { life: [-8, .5], power: [-5, 1.5], comms: [-5.5, 1.5], supply: [-5, 1.5] };
  const rad = { on: false, phase: 'idle', choice: null, sel: null, el: 0, T: 150, react: 3, crew: {}, dmg: [], dsum: {}, feed: '', ic: null, follow: null, followAt: 0, seated: 0 ,seen: false };
  EVENTS.radiation = {
    title: 'RADIATION STORM', msg: 'NASA detected a solar particle event. Radiation is rising!',
    goal: 'Alert every department, then get the crew to the Radiation Shelter!',
    lesson: 'Protecting astronauts from radiation is more important than completing routine tasks.'
  };
  const alertOn = () => rad.on && (rad.phase === 'warn' || rad.phase === 'storm');
  const radIn = () => rad.on ? DEPTS.reduce((s, d) => s + (rad.crew[d.id] && rad.crew[d.id].arrived ? rad.crew[d.id].n : 0), 0) : 0;
  const crewStatus = c => c.dose >= HURT ? 'INJURED' : c.arrived ? 'IN SHELTER' : c.alerted ? 'EN ROUTE' : 'OUTDOORS';
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function radInit() {
    rad.crew = {}; rad.dmg = []; rad.dsum = {};
    DEPTS.forEach(d => { rad.crew[d.id] = { n: CREW[d.id], alerted: false, tAlert: 0, arrived: false, dose: 0, travel: Math.hypot(d.x - DOOR.x, d.z - DOOR.z) / SPEED }; });
  }

  // ---------- styles + page elements ----------
  const rCss = document.createElement('style');
  rCss.textContent = `
    #rad-hud{position:fixed;left:1rem;top:4.2rem;z-index:3;display:none;width:min(280px,72vw);padding:.6rem .8rem;border-radius:12px;background:rgba(30,6,6,.9);border:2px solid #ff5d5d;color:#eef1f6;font:500 .85rem Barlow,sans-serif;pointer-events:none;box-shadow:0 0 24px rgba(255,93,93,.35)}
    #rad-hud b{color:#ff8a7a;letter-spacing:.1em}
    .rh-t{font:800 2.3rem 'Big Shoulders Display',Barlow,sans-serif;line-height:1.05}
    .rh-r{display:flex;justify-content:space-between;gap:8px;margin:.2rem 0}
    #rad-vig{position:fixed;inset:0;z-index:2;pointer-events:none;display:none;box-shadow:inset 0 0 160px rgba(255,40,30,.6);animation:radv .7s ease-in-out infinite alternate}
    @keyframes radv{to{opacity:.4}}
    #rad-panel{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:4;pointer-events:none;font-family:Barlow,sans-serif}`;
  document.head.appendChild(rCss);
  const radHudEl = mkEl('div', 'rad-hud'), radVig = mkEl('div', 'rad-vig'), radPanel = mkEl('div', 'rad-panel');
  let radToastN = 0, radHudKey = '';
  function radToast(title, msg, goal, ms) {
    const id = ++radToastN;
    evToast.innerHTML = `<div class="evt-card"><div class="evt-ico">☢</div><div><b>${title}</b><p>${msg}</p>${goal ? `<p class="evt-go">▶ ${goal}</p>` : ''}</div></div>`;
    evToast.style.display = 'flex'; toastOn = true;
    gsap.fromTo(evToast.firstChild, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: .4 });
    setTimeout(() => { if (id !== radToastN) return; toastOn = false; gsap.to(evToast.firstChild, { opacity: 0, duration: .5, onComplete: () => { evToast.style.display = 'none'; } }); }, ms);
  }

  // ---------- drawing helpers ----------
  function trefoil(x, cx, cy, r, col, bg) {
    x.fillStyle = col;
    for (let i = 0; i < 3; i++) { const a = i * 2.0944 - Math.PI / 2; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, a - Math.PI / 6, a + Math.PI / 6); x.closePath(); x.fill(); }
    x.fillStyle = bg; x.beginPath(); x.arc(cx, cy, r * .22, 0, 6.283); x.fill();
    x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r * .13, 0, 6.283); x.fill();
  }
  const mkScreen = (w, h) => { const [c, x] = cv(w, h); return { c, x, w, h, t: tex(c) }; };
  function drawExt(S) {   // red alert screen on the outside of the shelter
    const x = S.x, w = S.w, h = S.h, on = alertOn(), col = on ? '#ff4a3a' : '#4ff0c8';
    x.fillStyle = on ? '#2a0606' : '#04121a'; x.fillRect(0, 0, w, h); x.strokeStyle = col; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
    trefoil(x, w / 2, h * .24, h * .15, col, on ? '#2a0606' : '#04121a');
    x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${h * .1}px Barlow, sans-serif`;
    x.fillText(on ? 'RADIATION' : 'SHELTER', w / 2, h * .5); x.fillText(on ? 'ALERT' : 'READY', w / 2, h * .61);
    x.fillStyle = '#eef1f6'; x.font = `600 ${h * .062}px Barlow, sans-serif`;
    x.fillText(on ? 'Move to shelter immediately!' : 'Radiation levels normal', w / 2, h * .76);
    x.fillText('Crew inside: ' + radIn() + ' / 10', w / 2, h * .88); S.t.needsUpdate = true;
  }
  function drawRadScreen(S) {   // inside: "Radiation Level" board
    const x = S.x, w = S.w, h = S.h, st = rad.phase === 'storm', f = alertOn() ? (st ? 6 : 1 + rad.el / rad.T) : .3, p = Math.min(1, f / 6);
    const col = p > .6 ? '#ff5d5d' : p > .25 ? '#ffb066' : '#7ddba3';
    x.fillStyle = '#04101c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6ab4ff'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    x.fillStyle = '#eef1f6'; x.font = '700 36px Barlow, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('Radiation Level (outside)', 22, 40);
    x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(22, 90, w - 44, 34); x.fillStyle = col; x.fillRect(22, 90, (w - 44) * p, 34);
    x.fillStyle = col; x.font = '700 32px Barlow, sans-serif'; x.fillText(alertOn() ? (st ? 'SOLAR STORM PEAK' : 'RISING') : 'NORMAL', 22, 160);
    x.fillStyle = '#7ddba3'; x.font = '700 34px Barlow, sans-serif'; x.fillText('✔ Safe inside shelter', 22, 230); S.t.needsUpdate = true;
  }
  function drawCrewScreen(S) {   // inside: where is everybody?
    const x = S.x, w = S.w, h = S.h;
    x.fillStyle = '#04101c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#4ff0c8'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    x.fillStyle = '#4ff0c8'; x.font = '700 32px Barlow, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillText('CREW STATUS · ' + radIn() + ' / 10 SEATED', 22, 38);
    if (!rad.on) { x.fillStyle = '#eef1f6'; x.font = '600 30px Barlow, sans-serif'; x.fillText('Shelter on standby', 22, 110); x.fillText('10 seats · 10 suits ready', 22, 160); }
    else DEPTS.forEach((d, i) => {
      const c = rad.crew[d.id], s = crewStatus(c), col = { 'IN SHELTER': '#7ddba3', 'EN ROUTE': '#ffb066', 'OUTDOORS': '#ff5d5d', 'INJURED': '#ff5d5d' }[s];
      x.fillStyle = '#eef1f6'; x.font = '600 28px Barlow, sans-serif'; x.textAlign = 'left'; x.fillText(d.name + ' (' + c.n + ')', 22, 90 + i * 46);
      x.fillStyle = col; x.font = '700 28px Barlow, sans-serif'; x.textAlign = 'right'; x.fillText(s, w - 22, 90 + i * 46);
    });
    S.t.needsUpdate = true;
  }

  // ---------- the Radiation Shelter building (outside) ----------
  const SH = { id: 'shelter', name: 'Radiation Shelter', color: '#ffd36a' };
  let shExtScr = null, shLight = null, shBeacon = null, shRing = null, shInt = null;
  (function buildShelterExterior() {
    const g = new THREE.Group(), hull = mat(0x7b8498, { metalness: .7, roughness: .4 }), yel = mat(0xe8b520, { metalness: .5, roughness: .45 });
    const w = 11, h = 7.2, c = 1.8;
    const pts = [[-w / 2 + c, 0], [w / 2 - c, 0], [w / 2, c], [w / 2, h - c], [w / 2 - c, h], [-w / 2 + c, h], [-w / 2, h - c], [-w / 2, c]].map(p => new THREE.Vector2(p[0], p[1]));
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 8, bevelEnabled: false }), hull); body.position.z = -4; g.add(body);
    box(g, .5, 5.2, .5, yel, -3.9, 2.8, 4.1); box(g, .5, 5.2, .5, yel, 3.9, 2.8, 4.1); box(g, 8.3, .5, .5, yel, 0, 5.5, 4.1);
    box(g, 7.3, 4.9, .3, mat(0x0a0d12, { metalness: .6, roughness: .4 }), 0, 2.65, 4.05);
    box(g, 6.4, .08, 1.2, glow(0xffd36a, 1.2), 0, .25, 4.3); box(g, 6.4, .1, .1, glow(0xffd36a, 1.8), 0, 4.95, 4.25);
    const [sc, sx] = cv(768, 160); sx.fillStyle = '#e8b520'; sx.fillRect(0, 0, 768, 160); sx.strokeStyle = '#7a5a10'; sx.lineWidth = 8; sx.strokeRect(4, 4, 760, 152);
    trefoil(sx, 88, 80, 56, '#14161a', '#e8b520'); sx.fillStyle = '#15181e'; sx.font = '700 80px Barlow, sans-serif'; sx.textAlign = 'center'; sx.textBaseline = 'middle'; sx.fillText('RADIATION SHELTER', 440, 84);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.25), new THREE.MeshBasicMaterial({ map: tex(sc), toneMapped: false })); sign.position.set(0, 6.4, 4.12); g.add(sign);
    shLight = box(g, .7, .7, .2, glow(0x3dff88, 2), 4.85, 4.4, 4.12);
    box(g, 2.6, 3.6, .6, mat(0x39404d, { metalness: .6, roughness: .5 }), 7.7, 1.9, 3.2); box(g, 2.6, .3, .7, hazMat, 7.7, .15, 3.2);
    shExtScr = mkScreen(256, 340); drawExt(shExtScr);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.9), new THREE.MeshBasicMaterial({ map: shExtScr.t, toneMapped: false })); sp.position.set(7.7, 2.0, 3.52); g.add(sp);
    shBeacon = glowSprite(0xff3030, 7, 0); shBeacon.position.set(0, 8.1, 0); shBeacon.raycast = () => { }; g.add(shBeacon);
    const rg = new THREE.RingGeometry(8.6, 9.3, 56); rg.rotateX(-Math.PI / 2);
    shRing = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); shRing.position.y = .09; shRing.raycast = () => { }; g.add(shRing);
    g.traverse(o => { if (o.isMesh && o !== shRing) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(0, 0, -6); g.userData.dept = SH; SH.group = g; world.add(g); domes.push(g);
    if (GAME_MODE === 'A') { g.visible = false; domes.pop(); }   // Category A: no shelter building
  })();

  // ---------- the shelter interior: 10 seats, 10 suit lockers, radiation boards ----------
  function buildShelterInterior() {
    const g = new THREE.Group(), W = 32, H = 10, D = 22;
    const Dk = mat(0x1b2029, { roughness: .6, metalness: .5 }), Y = mat(0xe8b520, { roughness: .45, metalness: .5 }), grey = mat(0xaab2c0, { roughness: .5, metalness: .5 }), blue = mat(0x1f3f8f, { roughness: .8, metalness: .1 });
    const wm = (w, h, tint) => { const t = panelBase.clone(); t.needsUpdate = true; t.repeat.set(w / 6, h / 6); return mat(tint, { map: t, roughness: .5, metalness: .35, envMapIntensity: .6 }); };
    const plane = (w, h, m, x, y, z, ry = 0, rx = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.set(rx, ry, 0); g.add(p); return p; };
    plane(W, D, wm(W, D, 0x353b48), 0, 0, 0, 0, -Math.PI / 2); plane(W, D, wm(W, D, 0x8e97a8), 0, H, 0, 0, Math.PI / 2);
    plane(W, H, wm(W, H, 0x8e97a8), 0, H / 2, -D / 2); plane(W, H, wm(W, H, 0x8e97a8), 0, H / 2, D / 2, Math.PI);
    plane(D, H, wm(D, H, 0x8e97a8), -W / 2, H / 2, 0, Math.PI / 2); plane(D, H, wm(D, H, 0x8e97a8), W / 2, H / 2, 0, -Math.PI / 2);
    box(g, W, .3, .2, Y, 0, .15, -D / 2 + .1); box(g, W - 8, .03, .5, hazMat, 0, .02, -6.2);
    [-8, 0, 8].forEach(x => box(g, .7, .12, D - 2, glow(0xfff1d0, 1.6), x, H - .1, 0));
    // big trefoil + two boards on the back wall
    const [tc, tx] = cv(256, 256); tx.fillStyle = '#e8b520'; tx.beginPath(); tx.arc(128, 128, 124, 0, 6.283); tx.fill(); trefoil(tx, 128, 128, 96, '#14161a', '#e8b520');
    plane(4.4, 4.4, new THREE.MeshBasicMaterial({ map: tex(tc), transparent: true, toneMapped: false }), 0, 6.4, -D / 2 + .05);
    const S1 = mkScreen(512, 288), S2 = mkScreen(512, 288); drawRadScreen(S1); drawCrewScreen(S2);
    [[9, S1], [-9, S2]].forEach(([x, S]) => { box(g, 7.6, 4.5, .2, Dk, x, 6.4, -D / 2 + .15); plane(7.2, 4.05, new THREE.MeshBasicMaterial({ map: S.t, toneMapped: false }), x, 6.4, -D / 2 + .27); });
    // 10 seats (crew sit down as they arrive)
    const seats = [];
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Group(); s.position.set(-12.15 + i * 2.7, 0, -8.4); g.add(s);
      box(s, 2, .7, 1.9, grey, 0, .35, 0); box(s, 1.8, .28, 1.6, blue, 0, .84, .05); box(s, 1.8, 2.3, .4, grey, 0, 2.0, -.8); box(s, 1.5, 1.9, .12, blue, 0, 2.0, -.58);
      box(s, .22, .4, 1.5, grey, -.95, 1.35, 0); box(s, .22, .4, 1.5, grey, .95, 1.35, 0);
      const a = makeAstronaut(.78); a.position.set(0, .09, .12);
      a.userData.legs.forEach(l => l.rotation.x = -Math.PI / 2); a.userData.arms.forEach(r => r.rotation.x = -.5); a.visible = false; s.add(a); seats.push(a);
    }
    // 10 suit lockers (5 on each side wall)
    for (let k = 0; k < 10; k++) {
      const sd = k < 5 ? -1 : 1, z = -8 + (k % 5) * 4;
      box(g, .5, 4.4, 3.2, Dk, sd * 15.7, 2.3, z);
      const su = makeAstronaut(.95); su.position.set(sd * 14.6, .15, z); su.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(su);
      box(g, .1, .12, 3, glow(0x6ab4ff, 1.6), sd * 14.35, 4.5, z);
      const lb = label('SUIT ' + (k + 1), '#ffd36a', 256, 96, 44); lb.scale.set(2.2, .8, 1); lb.position.set(sd * 14.2, 5.3, z); g.add(lb);
    }
    g.add(new THREE.AmbientLight(0xffffff, .55));
    const l1 = new THREE.PointLight(0xfff4d6, 1.6, 45); l1.position.set(0, 9, 0); g.add(l1);
    const l2 = new THREE.PointLight(0xfff4d6, 1.2, 40); l2.position.set(0, 8, -8); g.add(l2);
    return { g, seats, S1, S2 };
  }
  function enterShelter(d) {
    busy = true; line.textContent = ''; const p = d.group.position;
    gsap.timeline()
      .to(camera.position, { x: p.x, y: 3, z: p.z + 17, duration: 2.2, ease: 'power2.inOut' }, 0)
      .to(look, { x: p.x, y: 3, z: p.z, duration: 2.2, ease: 'power2.inOut' }, 0)
      .to(fade, { opacity: 1, duration: .6 })
      .add(() => {
        world.visible = false; shInt = buildShelterInterior(); interior = shInt.g; scene.add(interior); scene.environment = envIn;
        camIn = { pos: [0, 4.6, 10], look: [0, 3.4, -6] }; camera.position.set(0, 4.6, 10); look.set(0, 3.4, -6);
        blinkers = []; alarm = null; spinners = []; intAstro = null; hintObj = null; hintRing = null; clickables = null; lifeDept = null; rad.ic = null;
        nameChip.textContent = d.name; info.style.display = 'block'; backBtn.style.display = 'inline-flex'; state = 'inside';
        line.textContent = alertOn() ? 'Stay here until the storm is over. The shelter blocks the radiation.' : 'The shelter has a seat and a spacesuit for each of the 10 astronauts.';
      })
      .to(fade, { opacity: 0, duration: .8 })
      .add(() => { busy = false; });
  }

  // ---------- intercom in every department ----------
  const icCache = {};
  function icTex(mode) {
    if (icCache[mode]) return icCache[mode];
    const [c, x] = cv(256, 160), col = { standby: '#4ff0c8', alert: '#ff5d5d', done: '#7ddba3' }[mode];
    const L = { standby: ['ALL-CALL INTERCOM', 'STANDBY', 'No warning active'], alert: ['RADIATION ALERT', 'CLICK TO ALERT', 'THIS CREW'], done: ['CREW ALERTED', 'Heading to', 'the shelter'] }[mode];
    x.fillStyle = mode === 'alert' ? '#2a0606' : '#04121a'; x.fillRect(0, 0, 256, 160); x.strokeStyle = col; x.lineWidth = 5; x.strokeRect(3, 3, 250, 154);
    x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 24px Barlow, sans-serif'; x.fillText(L[0], 128, 34);
    x.font = '700 30px Barlow, sans-serif'; x.fillText(L[1], 128, 82); x.fillStyle = '#eef1f6'; x.font = '600 22px Barlow, sans-serif'; x.fillText(L[2], 128, 126);
    return (icCache[mode] = tex(c));
  }
  function makeIntercom() {
    const g = new THREE.Group();
    cyl(g, .8, .9, .25, darkM, 0, .12, 0, 20); box(g, .55, 2.2, .5, darkM, 0, 1.3, 0); box(g, 2.4, 1.6, .45, mat(0x2c3547, { metalness: .6, roughness: .4 }), 0, 3.1, 0);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.3), new THREE.MeshBasicMaterial({ map: icTex('standby'), toneMapped: false })); scr.position.set(0, 3.15, .24); g.add(scr);
    const btn = cyl(g, .28, .28, .14, glow(0xff3a30, 1.6), 0, 2.15, .3, 20); btn.rotation.x = Math.PI / 2;
    const halo = glowSprite(0xff3030, 5, 0); halo.position.set(0, 3.1, .6); halo.raycast = () => { }; g.add(halo);
    g.userData = { scr, btn, halo, mode: 'standby' }; return g;
  }
  function radAddInterior(d, g) {   // called from enter()
    const ic = makeIntercom(), p = IC_POS[d.id] || [-5, 1.5];
    ic.position.set(p[0], 0, p[1]); ic.rotation.y = .3; ic.userData.dept = d; g.add(ic); rad.ic = ic;
  }
  const rayHit = (e, obj) => { ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObject(obj, true).length > 0; };
  function alertDept(d) {
    const c = rad.crew[d.id];
    if (!alertOn() || !c) { lvSay('📢 <b>All-call intercom</b><br>Standby. There is no radiation warning right now.', ''); return; }
    if (c.alerted) { lvSay('✔ <b>' + d.name + '</b> crew was already alerted.', 'good'); return; }
    c.alerted = true; c.tAlert = rad.el; beep(660, .12, 0); beep(990, .2, .14);
    lvSay('📢 <b>' + d.name + ' crew alerted!</b><br>' + c.n + ' astronauts reach the shelter in about ' + Math.ceil(rad.react + c.travel) + ' s. Now alert the other departments.', 'good');
    if (DEPTS.every(x => rad.crew[x.id].alerted)) line.textContent = 'Everyone is alerted. Head for the shelter and watch the clock.';
  }
  addEventListener('pointerdown', e => { if (state === 'inside' && !busy && rad.ic && rayHit(e, rad.ic)) alertDept(rad.ic.userData.dept); });
  addEventListener('pointermove', e => { if (state === 'inside' && !busy && rad.ic && alertOn() && rayHit(e, rad.ic)) canvas.style.cursor = 'pointer'; });

  // ---------- storm particles + arrow to the shelter ----------
  const parts = (() => {
    const N = 400, p = new Float32Array(N * 3); for (let i = 0; i < N; i++) { p[i * 3] = rnd(-40, 40); p[i * 3 + 1] = rnd(-10, 30); p[i * 3 + 2] = rnd(-40, 40); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const o = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff0a0, size: 2.5, sizeAttenuation: false, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    o.frustumCulled = false; o.visible = false; world.add(o); return o;
  })();
  const shArrow = document.createElement('div'); shArrow.className = 'dir l'; shArrow.style.setProperty('--c', '#ffd36a'); shArrow.style.display = 'none'; arrowsEl.appendChild(shArrow);
  const _sv = new THREE.Vector3();

  // ---------- panels ----------
  function decideHTML() {
    const opt = (id, t, s) => `<button class="evp-prio${rad.sel === id ? ' on' : ''}" data-act="ropt-${id}"><b>${id}</b>${t}<small>${s}</small></button>`;
    return `<div class="evp-card"><div class="evp-head"><b>☢ RADIATION WARNING · NASA DONKI: SEP EVENT</b></div>
      <p class="evp-txt">NASA detects a solar particle event. The astronauts receive a radiation warning and must reach the designated Radiation Shelter before the particle storm peaks.</p>
      ${rad.feed ? `<div class="evp-note">🛰 ${rad.feed}</div>` : ''}
      <div class="evp-h">WHAT SHOULD THE CREW DO?</div>
      <div class="evp-prios">${opt('A', 'Move all astronauts to the radiation shelter immediately', 'Outdoor work stops. Exposure is reduced.')}${opt('B', 'Allow astronauts to finish their outdoor tasks before entering', 'Astronauts stay exposed for longer. Mission safety decreases.')}</div>
      <div class="lv-tips">💡 Either way, you must visit each department and use its intercom to tell the crew. The shelter is the octagon building in the middle of the base.</div>
      <button class="evp-go" data-act="rgo"${rad.sel ? '' : ' disabled'}>Confirm ▶</button></div>`;
  }
  function resultHTML() {
    const R = rad.res, E = EVENTS.radiation;
    const crew = DEPTS.map(d => {
      const c = rad.crew[d.id], hurt = c.dose >= HURT, mn = !hurt && c.dose >= 15, col = hurt ? '#ff5d5d' : mn ? '#ffb066' : '#7ddba3';
      return `<div class="evp-m" style="grid-template-columns:150px 1fr 120px"><span>${d.name} (${c.n})</span><div class="evp-bar"><i style="width:${Math.min(100, c.dose)}%;background:${col}"></i></div><em style="color:${col}">${hurt ? 'Injured' : mn ? 'Minor exposure' : 'Safe'}</em></div>`;
    }).join('');
    const dm = rad.dmg.map(r => `<div class="evp-m" style="grid-template-columns:150px 1fr 100px"><span>${r.name}</span><div class="evp-bar"><i style="width:${r.to}%;background:${LEVEL[lvOf(r.to)]}"></i><u style="left:${r.from}%"></u></div><em>${r.from}→${r.to}%</em></div>`).join('');
    const fu = rad.follow === 'flare' ? 'Communication: the antenna is damaged and signals are being jammed.' : 'Life Support: the battery is nearly empty and the CO₂ filter is losing power.';
    return `<div class="evp-card"><div class="evp-head"><b>☢ RADIATION RESULT</b></div>
      <div class="evp-res ${R.cls}">${R.head}</div>
      <p class="evp-txt">${rad.choice === 'A' ? 'Astronaut exposure was reduced and outdoor work stopped.' : 'Astronauts stayed exposed for longer, so mission safety decreased.'} Mission safety: <b>${R.safety}%</b></p>
      <div class="evp-h">CREW (radiation dose)</div>${crew}
      <div class="evp-h">EQUIPMENT DAMAGED BY THE STORM (white line = before)</div>${dm}
      <div class="lv-tips">⚠ New crisis developing: ${fu}</div>
      <div class="evp-learn">📌 <b>REMEMBER:</b> ${E.lesson}</div>
      <button class="evp-go" data-act="rdone">Continue ▶</button></div>`;
  }
  radPanel.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const a = b.dataset.act;
    if (a === 'ropt-A' || a === 'ropt-B') { rad.sel = a.slice(5); radPanel.innerHTML = decideHTML(); }
    else if (a === 'rgo') startWarn();
    else if (a === 'rdone') endRad();
  });

  // ---------- event flow ----------
  function triggerRadiation() {
    if (rad.on || flareActive || lifeEv || state !== 'base' || busy) return;
    rad.on = true; rad.seen = true; rad.phase = 'decide'; rad.choice = null; rad.sel = null; rad.feed = ''; rad.follow = null; radInit();
    const E = EVENTS.radiation; radToast(E.title, E.msg, E.goal, 9000);
    evFlash.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 1000 }); beep(880, .18, 0); beep(660, .18, .25); beep(880, .18, .5);
    state = 'radev'; line.textContent = ''; canvas.style.cursor = 'default';
    radPanel.innerHTML = decideHTML(); radPanel.style.display = 'flex'; gsap.fromTo(radPanel.firstChild, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .35 });
    try {   // optional live look at NASA DONKI (falls back silently)
      const iso = d => new Date(d).toISOString().slice(0, 10);
      fetch('https://api.nasa.gov/DONKI/SEP?startDate=' + iso(Date.now() - 30 * 864e5) + '&endDate=' + iso(Date.now()) + '&api_key=DEMO_KEY')
        .then(r => r.json()).then(a => {
          rad.feed = Array.isArray(a) && a.length ? 'NASA DONKI latest SEP event: ' + a[a.length - 1].sepID + ' · ' + String(a[a.length - 1].eventTime || '').slice(0, 10) : 'NASA DONKI: no SEP events in the last 30 days. This is a training scenario.';
          if (rad.phase === 'decide') radPanel.innerHTML = decideHTML();
        }).catch(() => { });
    } catch (e) { }
  }
  function startWarn() {
    const C = RADCFG[rad.sel]; rad.choice = rad.sel; rad.T = C.T; rad.react = C.react; rad.el = 0; rad.phase = 'warn';
    radPanel.style.display = 'none'; state = 'base';
    line.textContent = 'Visit every department and click its intercom to alert the crew. The shelter is the octagon building in the middle.';
    if (rad.choice === 'B') radToast('OUTDOOR TASKS CONTINUE', 'The crew keeps working outside. They will be slow to react and more exposed.', '', 6000);
  }
  function stormStart() {
    DEPTS.forEach(d => {
      const prot = rad.crew[d.id].alerted;   // alerted crews put their equipment in safe mode
      (DMG[d.id] || []).forEach(([i, un, pr]) => {
        const r = d.res[i], amt = Math.round((prot ? pr : un) * (rad.choice === 'B' ? 1.25 : 1)), from = r.pct;
        r.pct = Math.max(3, from - amt); if (r === lifeD.res[2]) pw.level = Math.max(0, pw.level - amt); rad.dmg.push({ name: r.name, from, to: r.pct }); rad.dsum[d.id] = (rad.dsum[d.id] || 0) + from - r.pct;
      });
    });
    evFlash.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 1200 }); beep(220, .4, 0); beep(180, .4, .45);
    radToast('STORM PEAK!', 'Radiation is at its maximum. Anyone outside is in danger. Equipment is being hit.', 'Stay inside the shelter!', 7000);
  }
  function radTick(dt) {
    rad.el += dt;
    if (rad.phase === 'warn' && rad.el >= rad.T) { rad.phase = 'storm'; stormStart(); }
    if (rad.phase === 'storm' && rad.el >= rad.T + STORM_LEN) rad.phase = 'done';
    const f = rad.phase === 'warn' ? 1 + rad.el / rad.T : 6, R = RADCFG[rad.choice];
    DEPTS.forEach(d => {
      const c = rad.crew[d.id];
      if (c.alerted && !c.arrived && rad.el - c.tAlert >= rad.react + c.travel) c.arrived = true;
      c.dose += c.arrived ? f * .04 * dt : f * (rad.phase === 'storm' ? .67 : .09 * R.rate) * dt;
    });
    rad.seated = radIn();
  }
  function showRadResult() {
    rad.phase = 'result';
    const cs = DEPTS.map(d => rad.crew[d.id]);
    const inj = cs.reduce((s, c) => s + (c.dose >= HURT ? c.n : 0), 0), mn = cs.reduce((s, c) => s + (c.dose < HURT && c.dose >= 15 ? c.n : 0), 0);
    const safety = Math.max(0, Math.min(100, 100 - inj * 9 - mn * 3 - (rad.choice === 'B' ? 15 : 0)));
    pw.crew = Math.max(0, pw.crew - inj * 6 - mn * 2); pw.handled++;   // radiation exposure hurts the crew
    rad.res = { safety, cls: inj ? 'bad' : (mn || rad.choice === 'B') ? 'ok' : 'good', head: inj ? inj + ' astronaut' + (inj > 1 ? 's were' : ' was') + ' injured' : mn ? 'Everyone survived, with minor exposure' : 'All 10 astronauts are protected!' };
    rad.follow = (rad.dsum.comms || 0) >= (rad.dsum.life || 0) ? 'flare' : 'co2';
    const E = EVENTS.radiation, l = lessons.radiation || (lessons.radiation = { text: E.lesson, tries: 0, wins: 0 });
    l.tries++; if (!inj && rad.choice === 'A') l.wins++; saveLessons();
    state = 'radev'; canvas.style.cursor = 'default'; radPanel.innerHTML = resultHTML(); radPanel.style.display = 'flex';
    gsap.fromTo(radPanel.firstChild, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .35 });
  }
  function endRad() {
    radPanel.style.display = 'none'; rad.on = false; rad.phase = 'idle'; rad.seated = 0; rad.followAt = clock.getElapsedTime() + 5;
    walkers.forEach(w => { w.visible = true; delete w.userData.from; });
    state = interior ? 'inside' : 'base'; evTimer = nextEvDelay(); line.textContent = '';
  }
 /* addEventListener('keydown', e => { if (e.key && e.key.toLowerCase() === 'r' && state === 'base' && !busy) triggerRadiation(); }); */   // test shortcut: delete when finished

  // ---------- per-frame update (called from the main loop) ----------
  let radLast = 0, radDraw = 0;
  function radUpdate(t) {
    if (GAME_MODE === 'A') return;   // Category A has no radiation gameplay
    const dt = Math.min(t - radLast, .1); radLast = t;
    if (alertOn()) radTick(dt);
    if (rad.on && rad.phase === 'done' && !busy && (state === 'base' || state === 'inside')) showRadResult();
    // outdoor crew run to the shelter door
    if (rad.on && world.visible) DEPTS.forEach(d => {
      const c = rad.crew[d.id];
      (WALKER_OF[d.id] || []).forEach(i => {
        const w = walkers[i]; if (!c.alerted) { w.visible = true; return; }
        const u = (rad.el - c.tAlert - rad.react) / c.travel; if (u <= 0) return;
        if (!w.userData.from) w.userData.from = w.position.clone();
        if (u >= 1) { w.visible = false; return; }
        w.visible = true; w.position.lerpVectors(w.userData.from, DOOR, u); w.rotation.y = Math.atan2(DOOR.x - w.userData.from.x, DOOR.z - w.userData.from.z); walkPose(w, t, 0, 8);
      });
    });
    // atmosphere: sun flare, particles, red edges, noise
    const storm = rad.on && rad.phase === 'storm';
    if (alertOn()) { const f = (storm ? 1.7 : 1.25) + Math.sin(t * 6) * .3; sunGlow.scale.set(650 * f, 650 * f, 1); sunHaze.scale.set(1500 * f, 1500 * f, 1); sunHaze.material.opacity = .4; }
    parts.visible = storm && world.visible;
    if (parts.visible) {
      const p = parts.geometry.attributes.position.array; parts.position.copy(camera.position);
      for (let i = 0; i < p.length; i += 3) { p[i + 1] -= dt * 45; p[i] += dt * 18; if (p[i + 1] < -10) p[i + 1] = 30; if (p[i] > 40) p[i] = -40; }
      parts.geometry.attributes.position.needsUpdate = true;
    }
    radVig.style.display = storm && !(shInt && interior === shInt.g) ? 'block' : 'none';
    if (storm) evNoise.style.display = 'block';
    // shelter building + interior displays
    const al = alertOn();
    shRing.material.opacity = al ? .3 + .35 * Math.abs(Math.sin(t * 4)) : .22; shRing.material.color.set(al ? 0xff3a30 : 0xffd36a);
    shBeacon.material.opacity = al ? Math.max(0, Math.sin(t * 6)) * .9 : 0; shLight.material.emissive.set(al ? 0xff3a30 : 0x3dff88);
    if (t - radDraw > .4) {
      radDraw = t;
      if (world.visible) drawExt(shExtScr);
      if (shInt && interior === shInt.g) { drawRadScreen(shInt.S1); drawCrewScreen(shInt.S2); }
    }
    if (shInt && interior === shInt.g) shInt.seats.forEach((a, i) => { a.visible = i < rad.seated; });
    const cr = info.querySelector('.chip-row'); if (cr) cr.style.display = shInt && interior === shInt.g ? 'none' : '';
    // intercom screen
    if (rad.ic) {
      const u = rad.ic.userData, c = rad.crew[u.dept.id], m = al && c ? (c.alerted ? 'done' : 'alert') : 'standby';
      if (u.mode !== m) { u.mode = m; u.scr.material.map = icTex(m); u.scr.material.needsUpdate = true; }
      u.halo.material.opacity = m === 'alert' ? .35 + .35 * Math.abs(Math.sin(t * 5)) : 0; u.btn.material.emissive.set(m === 'done' ? 0x3dff88 : 0xff3a30);
    }
    // arrow to the shelter while the alarm runs
    if (al && state === 'base') {
      _sv.set(0, 4, -6).project(camera); const behind = _sv.z > 1;
      if (!behind && Math.abs(_sv.x) < .88) shArrow.style.display = 'none';
      else {
        const side = (_sv.x < 0) !== behind ? 'l' : 'r', txt = (side === 'l' ? '<b>◀</b> ' : '<b>▶</b> ') + '☢ Radiation Shelter <small>' + Math.round(Math.hypot(camera.position.x, camera.position.z + 6)) + ' m</small>';
        if (shArrow._s !== side) { shArrow.className = 'dir ' + side; shArrow._s = side; } if (shArrow._t !== txt) { shArrow.innerHTML = txt; shArrow._t = txt; }
        shArrow.style.top = (innerHeight * .42 - 46) + 'px'; shArrow.style.display = 'flex';
      }
    } else shArrow.style.display = 'none';
    // countdown HUD
    const show = rad.on && (rad.phase === 'warn' || rad.phase === 'storm' || rad.phase === 'done');
    radHudEl.style.display = show ? 'block' : 'none';
    if (show) {
      const head = rad.phase === 'warn' ? `<div class="rh-t">${fmt(rad.T - rad.el)}</div><div>until the radiation peak</div>` : rad.phase === 'storm' ? `<div class="rh-t" style="color:#ff5d5d">STORM!</div><div>Peak radiation. Stay in the shelter.</div>` : `<div class="rh-t" style="color:#7ddba3">OVER</div><div>The storm has passed.</div>`;
      const rows = DEPTS.map(d => {
        const c = rad.crew[d.id], s = crewStatus(c), col = { 'IN SHELTER': '#7ddba3', 'EN ROUTE': '#ffb066', 'OUTDOORS': '#ff5d5d', 'INJURED': '#ff5d5d' }[s];
        const lab = s === 'OUTDOORS' ? '📢 ALERT NEEDED' : s === 'EN ROUTE' ? 'EN ROUTE ' + Math.max(0, Math.ceil(c.tAlert + rad.react + c.travel - rad.el)) + 's' : s;
        return `<div class="rh-r"><span>${d.name}</span><span style="color:${col};font-weight:700">${lab}</span></div>`;
      }).join('');
      const html = `<b>☢ RADIATION STORM</b>${head}${rows}<div class="rh-r"><span>Shelter</span><span>${radIn()} / 10 inside</span></div>`;
      if (html !== radHudKey) { radHudEl.innerHTML = html; radHudKey = html; }
    }
    // forced follow-up crisis after the storm
    if (rad.follow && !rad.on && t >= rad.followAt && state === 'base' && !busy && !lifeEv && !flareActive) {
      const f = rad.follow; rad.follow = null; if (f === 'flare') triggerEvent('flare'); else triggerLifeEvent('co2');
    }
  }

  // intro: landing + story lines
  gsap.to(camera.position, { x: HOME_CAM.x, y: HOME_CAM.y, z: HOME_CAM.z, duration: 5.5, ease: 'power3.out' });
  gsap.to(look, { x: HOME_LOOK.x, y: HOME_LOOK.y, z: HOME_LOOK.z, duration: 5.5, ease: 'power3.out' });
  const story = ['We landed! Welcome to the Moon.', 'Move your mouse to look around.', 'Tap a glowing building to visit a department.'];
  story.forEach((t, i) => setTimeout(() => {
    line.textContent = t;
    if (i === story.length - 1) { state = 'base'; busy = false; }
  }, 800 + i * 2800));

  // =====================================================
  //  LOOP
  // =====================================================
  const clock = new THREE.Clock();
  let lastT = 0;
  (function loop() {
    requestAnimationFrame(loop);
    const t = clock.getElapsedTime();
        const dt = Math.min(t - lastT, .1); lastT = t;
    if (state !== 'base' || busy) walkDir = 0;
    if (walkDir) { walkHold += dt; if (walkReleased && walkHold > .5) walkDir = 0; }
    if (world.visible) {
      earth.rotation.y = t * .02; mars.rotation.y = t * .03; ringed.rotation.y = t * .01;
      walkers.forEach(a => {
        const c = a.userData.c, ang = t * c.s + a.userData.ph, sg = Math.sign(c.s);
        a.position.set(c.cx + Math.cos(ang) * c.r, 0, c.cz + Math.sin(ang) * c.r);
        a.rotation.y = Math.atan2(-Math.sin(ang) * sg, Math.cos(ang) * sg);
        walkPose(a, t, a.userData.ph);
      });
            if (walkDir) {
        walkX = THREE.MathUtils.clamp(walkX + walkDir * WALK_SPEED * dt, -WALK_LIMIT, WALK_LIMIT);
        camera.position.x = HOME_CAM.x + walkX; look.x = HOME_LOOK.x + walkX;
        walkPose(hero, t, 0, 7);
      } else {
        hero.userData.legs.forEach(l => l.rotation.x *= .8); hero.userData.arms[0].rotation.x *= .8;
        hero.userData.body.position.y = Math.sin(t * 1.4) * .015; hero.userData.arms[1].rotation.x = Math.sin(t * .8) * .05;
      }
      hero.position.x = walkX - 1.8;
      let dr = (walkDir ? walkDir * Math.PI / 2 : Math.PI) - hero.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); hero.rotation.y += dr * .15;
      pulses.forEach((m, i) => m.opacity = .25 + .3 * Math.abs(Math.sin(t * 1.6 + i)));
      beacons.forEach(b => b.material.opacity = Math.max(0, Math.sin(t * 3)));
      lamps.forEach((l, i) => l.material.opacity = .75 + Math.sin(t * 2 + i) * .15);
      engineLight.intensity = 2.6 + Math.sin(t * 17) * .4 + Math.sin(t * 7.3) * .3;
    }
    if (interior) {
      blinkers.forEach(b => b.material.opacity = .45 + Math.abs(Math.sin(t * 4)) * .55);
      if (alarm) alarm.intensity = 1 + Math.abs(Math.sin(t * 3)) * 2.5;
      spinners.forEach(s => s.rotation.y = t * .6);
      if (hintObj) {
  if (hintT0 === null) hintT0 = t;
  hintObj.position.y = Math.sin(t * 3) * .25;
  hintObj.visible = ((t - hintT0) % 20) < 6;   // shows 6 s after entering, then 6 s every 20 s
  hintRing.material.opacity = .25 + .35 * Math.abs(Math.sin(t * 2));
}
      if (intAstro) { const u = intAstro.userData; u.arms[0].rotation.x = -1.15 + Math.sin(t * 2) * .12; u.arms[1].rotation.x = -1.25 + Math.sin(t * 2.3) * .12; u.body.position.y = Math.sin(t * 1.3) * .02; }
    }
    updateEvents(t);
    updateLifeEvents(t);
    radUpdate(t);
      updateStatus(t); 
    aim(t);
    renderer.render(scene, camera);
        updateArrows();
  })();

  function resize() {
    camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 1 ? 75 : 60; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize); resize();
})();