// Page 1 3D scene (Three.js r128). Moon and Earth textures are generated in code, no image files needed.
(function () {
  const canvas = document.getElementById("scene");
  if (!canvas || !window.THREE) return;            // page still works without 3D
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return; }

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 600);
  camera.position.set(0, 0, 16);

  /* ---------- helpers: seeded random + 3D value noise ---------- */
  const rng = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
    h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  const lerp = (a, b, t) => a + (b - a) * t;
  function noise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = x - xi, v = y - yi, w = z - zi;
    const a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v), c = w * w * (3 - 2 * w);
    return lerp(
      lerp(lerp(hash(xi, yi, zi), hash(xi + 1, yi, zi), a), lerp(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), a), b),
      lerp(lerp(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), a), lerp(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), a), b), c);
  }
  const fbm = (x, y, z, o) => { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * noise(x * f, y * f, z * f); f *= 2; a *= 0.5; } return s; };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  /* ---------- Moon: grey highlands, dark maria, thousands of craters ---------- */
  function moonTextures(W, H) {
    const rnd = rng(11);
    const hgt = new Float32Array(W * H), alb = new Float32Array(W * H);

    for (let y = 0; y < H; y++) {
      const lat = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(lat), sy = Math.sin(lat);
      for (let x = 0; x < W; x++) {
        const lon = (x + 0.5) / W * Math.PI * 2, px = cl * Math.cos(lon), pz = cl * Math.sin(lon);
        const mare = smooth(0.5, 0.6, fbm(px * 1.5 + 5, sy * 1.5 + 5, pz * 1.5 + 5, 3));
        const d = fbm(px * 9, sy * 9, pz * 9, 4), i = y * W + x;
        alb[i] = 0.64 - 0.3 * mare + (d - 0.5) * 0.24;
        hgt[i] = d * 0.45 - mare * 0.12;
      }
    }

    for (let k = 0; k < 1700; k++) {
      const r = 0.006 * Math.pow(40, Math.pow(rnd(), 2.4));       // 0.006 to 0.24 rad
      const z = rnd() * 2 - 1, t = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      const cx = s * Math.cos(t), cy = z, cz = s * Math.sin(t);
      const clat = Math.asin(cy), R = r * 1.7;
      let u = Math.atan2(cz, cx) / (Math.PI * 2); if (u < 0) u += 1;
      const xc = Math.floor(u * W);
      const halfLon = Math.min(Math.PI, R / Math.max(Math.cos(Math.min(1.55, Math.abs(clat) + R)), 0.05));
      const dx = Math.ceil(halfLon / (Math.PI * 2) * W);
      const y0 = Math.max(0, Math.floor((0.5 - (clat + R) / Math.PI) * H));
      const y1 = Math.min(H - 1, Math.ceil((0.5 - (clat - R) / Math.PI) * H));
      const amp = 0.05 * Math.pow(r / 0.05, 0.7), cosR = Math.cos(R);
      for (let y = y0; y <= y1; y++) {
        const lat = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(lat), sy = Math.sin(lat);
        for (let x = xc - dx; x <= xc + dx; x++) {
          const xi = ((x % W) + W) % W, lon = (xi + 0.5) / W * Math.PI * 2;
          const dot = cl * Math.cos(lon) * cx + sy * cy + cl * Math.sin(lon) * cz;
          if (dot < cosR) continue;
          const d = Math.acos(Math.min(1, dot)) / r, i = y * W + xi;
          const rim = Math.exp(-((d - 1) * (d - 1)) / 0.02);
          hgt[i] += (d < 1 ? -amp * (1 - d * d) * 0.8 : amp * 0.25 * Math.exp(-(d - 1) * 4)) + amp * 0.55 * rim;
          alb[i] += (d < 1 ? -0.07 * (1 - d) : 0) + 0.1 * rim * Math.min(1, r * 14);
        }
      }
    }

    // colour map
    const cc = document.createElement("canvas"); cc.width = W; cc.height = H;
    const cctx = cc.getContext("2d"), cimg = cctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const g = Math.min(1, Math.max(0.05, alb[i])) * 255;
      cimg.data[i * 4] = g * 1.0; cimg.data[i * 4 + 1] = g * 0.975; cimg.data[i * 4 + 2] = g * 0.93; cimg.data[i * 4 + 3] = 255;
    }
    cctx.putImageData(cimg, 0, 0);

    // normal map from the height map
    const nc = document.createElement("canvas"); nc.width = W; nc.height = H;
    const nctx = nc.getContext("2d"), nimg = nctx.createImageData(W, H), S = 45 * W / 2048;
    for (let y = 0; y < H; y++) {
      const ym = Math.max(0, y - 1), yp = Math.min(H - 1, y + 1);
      for (let x = 0; x < W; x++) {
        const xm = (x - 1 + W) % W, xp = (x + 1) % W, i = y * W + x;
        const nx = -(hgt[y * W + xp] - hgt[y * W + xm]) * S, ny = (hgt[yp * W + x] - hgt[ym * W + x]) * S;
        const l = Math.sqrt(nx * nx + ny * ny + 1);
        nimg.data[i * 4] = (nx / l * 0.5 + 0.5) * 255; nimg.data[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255;
        nimg.data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; nimg.data[i * 4 + 3] = 255;
      }
    }
    nctx.putImageData(nimg, 0, 0);
    return { map: cc, normal: nc };
  }

  /* ---------- Earth: oceans, continents, ice caps, clouds ---------- */
  function earthTextures(W, H) {
    const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); return [c, x, x.createImageData(W, H)]; };
    const [c1, x1, i1] = mk(), [c2, x2, i2] = mk();
    for (let y = 0; y < H; y++) {
      const lat = (0.5 - (y + 0.5) / H) * Math.PI, cl = Math.cos(lat), sy = Math.sin(lat);
      for (let x = 0; x < W; x++) {
        const lon = (x + 0.5) / W * Math.PI * 2, px = cl * Math.cos(lon), pz = cl * Math.sin(lon), i = (y * W + x) * 4;
        const h = fbm(px * 1.7 + 9, sy * 1.7 + 9, pz * 1.7 + 9, 5);
        const land = smooth(0.5, 0.52, h), ice = smooth(1.1, 1.3, Math.abs(lat));
        let r, g, b;
        if (land > 0.5) {
          const e = smooth(0.52, 0.66, h), dry = smooth(0.2, 0.6, 1 - Math.abs(lat) / 1.2) * smooth(0.45, 0.7, fbm(px * 4, sy * 4, pz * 4, 3));
          r = lerp(lerp(48, 120, e), 176, dry * 0.7); g = lerp(lerp(88, 100, e), 146, dry * 0.7); b = lerp(lerp(46, 70, e), 96, dry * 0.7);
        } else { const d = smooth(0.4, 0.5, h); r = lerp(5, 22, d); g = lerp(24, 68, d); b = lerp(64, 128, d); }
        i1.data[i] = lerp(r, 238, ice); i1.data[i + 1] = lerp(g, 242, ice); i1.data[i + 2] = lerp(b, 250, ice); i1.data[i + 3] = 255;
        const cl2 = smooth(0.5, 0.68, fbm(px * 3.2 + 40, sy * 3.2 + 40, pz * 3.2 + 40, 5));
        i2.data[i] = i2.data[i + 1] = i2.data[i + 2] = 255; i2.data[i + 3] = cl2 * 230;
      }
    }
    x1.putImageData(i1, 0, 0); x2.putImageData(i2, 0, 0);
    return { map: c1, clouds: c2 };
  }

  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };

  /* ---------- glow sprite + stars ---------- */
  function glowTex(stops, w, h) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    stops.forEach(([o, col]) => g.addColorStop(o, col)); x.fillStyle = g; x.fillRect(0, 0, w, h);
    return new THREE.CanvasTexture(c);
  }
  const dot = glowTex([[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,.6)"], [1, "rgba(255,255,255,0)"]], 64, 64);

  function stars(n, size, band, bright) {
    const p = new Float32Array(n * 3), col = new Float32Array(n * 3), r = rng(band ? 5 : 3 + n);
    const tint = [[1, 1, 1], [0.8, 0.88, 1], [1, 0.92, 0.8]];
    for (let i = 0; i < n; i++) {
      let z = r() * 2 - 1, th = r() * Math.PI * 2;
      if (band) z = (r() + r() + r() - 1.5) * 0.28;                 // concentrate along a band (Milky Way)
      const s = Math.sqrt(1 - z * z), R = 300;
      let v = [R * s * Math.cos(th), R * z, R * s * Math.sin(th)];
      const tl = 0.45, c = Math.cos(tl), sn = Math.sin(tl);           // tilt the band
      if (band) v = [v[0] * c - v[1] * sn, v[0] * sn + v[1] * c, v[2]];
      p.set(v, i * 3);
      const k = tint[Math.floor(r() * 3)], b = bright * (0.35 + r() * 0.65);
      col.set([k[0] * b, k[1] * b, k[2] * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, map: dot,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  }
  const sky = new THREE.Group();
  sky.add(stars(2600, 1.6, false, 0.9), stars(260, 3.2, false, 1), stars(7000, 1.1, true, 0.35));
  scene.add(sky);

  /* ---------- lights ---------- */
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.position.set(-10, 4, 3); scene.add(sun);
  scene.add(new THREE.AmbientLight(0x1b2c4a, 0.35));            // faint earthshine on the dark side

  const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 128, 96), new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, color: 0x555555 }));
  const earth = new THREE.Group(), clouds = new THREE.Mesh(new THREE.SphereGeometry(1.52, 64, 48), new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false }));
  const ground = new THREE.Mesh(new THREE.SphereGeometry(1.5, 96, 64), new THREE.MeshPhongMaterial({ specular: 0x335577, shininess: 22, color: 0x555555 }));
  const atmos = new THREE.Mesh(new THREE.SphereGeometry(1.5 * 1.1, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: "varying vec3 n; void main(){ n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec3 n; void main(){ float i = pow(0.68 - dot(n, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(0.32,0.62,1.0,1.0) * i * 1.8; }"
  }));
  earth.add(ground, clouds, atmos);
  scene.add(moon, earth);

  // sun glare (decoration) top-left
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex([[0, "rgba(255,244,225,1)"], [0.12, "rgba(255,225,180,.55)"], [1, "rgba(255,200,140,0)"]], 256, 256),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  glare.position.set(-15, 8, -16); glare.scale.set(11, 11, 1);
  const streak = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex([[0, "rgba(200,220,255,.9)"], [1, "rgba(200,220,255,0)"]], 256, 256),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
  streak.position.copy(glare.position); streak.scale.set(34, 0.35, 1);
  scene.add(glare, streak);


  /* ---------- Spacecraft: capsule + gold service module + 4 solar wings ---------- */
  const ship = new THREE.Group(), inner = new THREE.Group();
  ship.userData.base = new THREE.Vector3();
  function panelTexture() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 256, 128); g.addColorStop(0, "#1a3a8f"); g.addColorStop(1, "#08122e");
    x.fillStyle = g; x.fillRect(0, 0, 256, 128); x.strokeStyle = "rgba(150,190,255,.55)"; x.lineWidth = 2;
    for (let i = 0; i <= 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); }
    for (let j = 0; j <= 128; j += 32) { x.beginPath(); x.moveTo(0, j); x.lineTo(256, j); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  const white = new THREE.MeshStandardMaterial({ color: 0xeef1f6, metalness: 0.3, roughness: 0.4 });
  const gold  = new THREE.MeshStandardMaterial({ color: 0xe0b040, metalness: 0.6, roughness: 0.35 });
  const dark  = new THREE.MeshStandardMaterial({ color: 0x2b2826, metalness: 0.5, roughness: 0.6 });
  const part = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; inner.add(m); return m; };
  part(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 16), dark, 1.6);                  // docking probe
  part(new THREE.CylinderGeometry(0.2, 0.5, 0.6, 48), white, 1.2);                    // crew capsule
  part(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 48), dark, 0.87);                   // heat shield
  part(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 48), new THREE.MeshStandardMaterial({ color: 0x9aa3b2, metalness: 0.5, roughness: 0.4 }), 0.8);
  part(new THREE.CylinderGeometry(0.5, 0.5, 0.95, 48), gold, 0.28);                   // service module
  part(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 48), white, 0.5);
  part(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 48), white, 0.0);
  part(new THREE.CylinderGeometry(0.16, 0.32, 0.42, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }), -0.4); // engine
  const pTex = panelTexture();
  const panelMat = new THREE.MeshStandardMaterial({ map: pTex, metalness: 0.6, roughness: 0.3, emissive: 0x0a1c4a, emissiveIntensity: 0.5 });
  for (let i = 0; i < 4; i++) {
    const wing = new THREE.Group(); wing.rotation.y = i * Math.PI / 2; wing.position.y = 0.28;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04), dark); arm.position.x = 0.62;
    const pan = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.02, 0.55), panelMat); pan.position.x = 1.4;
    wing.add(arm, pan); inner.add(wing);
  }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex([[0, "rgba(180,225,255,1)"], [0.35, "rgba(90,150,255,.6)"], [1, "rgba(60,100,255,0)"]], 128, 128),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  flame.position.y = -0.8; flame.scale.set(1, 1, 1); inner.add(flame);
  ship.add(inner); ship.rotation.set(0.4, 0, -1.2);
  scene.add(ship);

  /* ---------- layout (desktop vs phone) ---------- */
  function layout() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (w / h > 1.1) { moon.scale.setScalar(1.25); moon.position.set(0, -8.4, 0); earth.position.set(7.5, 3.8, -14); ship.userData.base.set(-5.2, 0.2, 3.2); ship.scale.setScalar(0.7); }
    else { moon.scale.setScalar(0.75); moon.position.set(0, -5.3, 0); earth.position.set(2.2, 2.6, -8); ship.userData.base.set(1.4, -1.3, 3.2); ship.scale.setScalar(0.42); }
  }
  addEventListener("resize", layout); layout();

  /* ---------- parallax + loop ---------- */
  let mx = 0, my = 0;
  addEventListener("pointermove", (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  const clock = new THREE.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduce) {
      moon.rotation.y += dt * 0.018; ground.rotation.y += dt * 0.03; clouds.rotation.y += dt * 0.042; sky.rotation.y += dt * 0.002;
      camera.position.x += (mx * 0.9 - camera.position.x) * 0.03;
      camera.position.y += (-my * 0.6 - camera.position.y) * 0.03;
    }
    const t = reduce ? 0 : clock.elapsedTime, b = ship.userData.base;
    ship.position.set(b.x + Math.sin(t * 0.25) * 0.35, b.y + Math.cos(t * 0.3) * 0.2, b.z);
    if (!reduce) { inner.rotation.y += dt * 0.35; flame.material.opacity = 0.8 + Math.sin(t * 18) * 0.12; }
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    if (!document.hidden) requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { clock.getDelta(); requestAnimationFrame(frame); } });

  // Show stars + spacecraft instantly, then sharpen the Moon and Earth in two quick steps
  moon.material.color.set(0x8a8a8a); ground.material.color.set(0x2a60a8); clouds.visible = false;
  function applyTextures(mw, mh, ew, eh) {
    const m = moonTextures(mw, mh), e = earthTextures(ew, eh);
    [moon.material.map, moon.material.normalMap, ground.material.map, clouds.material.map].forEach((t) => t && t.dispose());
    moon.material.map = tex(m.map, true); moon.material.normalMap = tex(m.normal, false);
    moon.material.normalScale = new THREE.Vector2(1.2, 1.2); moon.material.color.set(0xffffff);
    ground.material.map = tex(e.map, true); ground.material.color.set(0xffffff);
    clouds.material.map = tex(e.clouds, true); clouds.visible = true;
    [moon, ground, clouds].forEach((o) => { o.material.needsUpdate = true; });
  }
  frame(); canvas.classList.add("ready");
  setTimeout(() => applyTextures(512, 256, 256, 128), 20);
  setTimeout(() => applyTextures(2048, 1024, 1024, 512), 800);
})();
