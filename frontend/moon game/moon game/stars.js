// stars.js: shining stars background (own canvas, no libraries). Add <script src="stars.js"></script> to the page.
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cv = document.createElement("canvas");
  cv.setAttribute("aria-hidden", "true");
  cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none";
  const ref = document.getElementById("scene");               // sits behind the 3D scene
  if (ref) ref.parentNode.insertBefore(cv, ref); else document.body.prepend(cv);
  const ctx = cv.getContext("2d");

  const TINTS = ["255,255,255", "190,215,255", "255,235,205"]; // white, blue, warm
  let W = 0, H = 0, stars = [], shoot = null, nextShoot = 4;

  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(W * H / 5500), bigCount = Math.max(10, Math.round(n * 0.06));
    stars = [];
    for (let i = 0; i < n; i++) {
      const big = i < bigCount;
      stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: big ? 1.4 + Math.random() * 1.2 : 0.4 + Math.random() * 0.9,
        big, ph: Math.random() * 6.28, sp: 0.8 + Math.random() * 2.2,
        c: TINTS[Math.floor(Math.random() * 3)]
      });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const a = reduce ? 0.8 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));   // twinkle
      ctx.fillStyle = "rgba(" + s.c + "," + a + ")";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
      if (s.big) {                                                                      // glow + cross flare
        const R = s.r * 7, g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R);
        g.addColorStop(0, "rgba(" + s.c + "," + a * 0.5 + ")"); g.addColorStop(1, "rgba(" + s.c + ",0)");
        ctx.fillStyle = g; ctx.fillRect(s.x - R, s.y - R, R * 2, R * 2);
        const L = s.r * 9 * a;
        ctx.strokeStyle = "rgba(" + s.c + "," + a * 0.7 + ")"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x - L, s.y); ctx.lineTo(s.x + L, s.y); ctx.moveTo(s.x, s.y - L); ctx.lineTo(s.x, s.y + L); ctx.stroke();
      }
    }
    if (shoot) {                                                                        // shooting star
      const k = (t - shoot.t0) / shoot.life;
      if (k >= 1) shoot = null;
      else {
        const x = shoot.x + shoot.vx * (t - shoot.t0), y = shoot.y + shoot.vy * (t - shoot.t0);
        const tx = x - shoot.vx * 0.12, ty = y - shoot.vy * 0.12, f = 1 - k;
        const g = ctx.createLinearGradient(x, y, tx, ty);
        g.addColorStop(0, "rgba(255,255,255," + f + ")"); g.addColorStop(1, "rgba(160,200,255,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
      }
    } else if (!reduce && t > nextShoot) {
      shoot = { x: W * (0.45 + Math.random() * 0.5), y: Math.random() * H * 0.35, vx: -700, vy: 380, t0: t, life: 0.9 };
      nextShoot = t + 6 + Math.random() * 6;
    }
  }

  function loop(ms) { draw(ms / 1000); if (!document.hidden) requestAnimationFrame(loop); }
  addEventListener("resize", () => { build(); if (reduce) draw(0); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !reduce) requestAnimationFrame(loop); });
  build();
  if (reduce) draw(0); else requestAnimationFrame(loop);
})();