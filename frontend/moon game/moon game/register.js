// register.js: the avatar asks one question at a time (name, age, email, callsign, password, suit)
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PREV_PAGE = "briefing.html", NEXT_PAGE = "mode.html";
  const $ = (id) => document.getElementById(id);
  const sayEl = $("say"), formEl = $("form"), nextBtn = $("next"), backBtn = $("back"), chipEl = $("step-chip"), avatar = $("avatar");

  /* ---------- answers (kept only in memory while you register) ---------- */
  const data = { name: "", age: 0, email: "", callsign: "", pass: "", suit: "#ff8a3d" };
    try { localStorage.removeItem("astronaut"); localStorage.removeItem("mode"); localStorage.removeItem("astro_intro_done"); } catch (e) {}      // fresh start: no old answers in the fields
  function save() {                                               // shape the other pages read
    try { localStorage.setItem("astronaut", JSON.stringify({ name: data.name, age: data.age, role: "Commander", callsign: data.callsign, suit: data.suit })); } catch (e) {}
  }
  avatar.style.setProperty("--suit", data.suit);
  const taken = (email, call) => window.AstroAuth ? AstroAuth.exists(email, call) : { email: false, callsign: false };

  /* ---------- typing sound (same on/off choice as the briefing page) ---------- */
  let ac = null, soundOn = true;
  try { soundOn = localStorage.getItem("sound") !== "off"; } catch (e) {}
  function audio() {
    if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; ac = new A(); }
    if (ac.state === "suspended") ac.resume();
  }
  ["pointerdown", "keydown"].forEach(ev => addEventListener(ev, audio, { passive: true }));
  audio();
  function tick() {
    if (!soundOn || !ac || ac.state !== "running") return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "square"; o.frequency.value = 850 + Math.random() * 450; f.type = "bandpass"; f.frequency.value = 1800;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.04);
  }

  /* ---------- the avatar talks (typed text replaces the old text) ---------- */
  let timer = null;
  function stopSay() { clearInterval(timer); avatar.classList.remove("talk"); }
  function say(text) {
    stopSay(); sayEl.setAttribute("aria-label", text);
    if (reduce) { sayEl.textContent = text; return; }
    const ch = Array.from(text); let c = 0;
    sayEl.textContent = ""; avatar.classList.add("talk");
    timer = setInterval(() => {
      c++; sayEl.textContent = ch.slice(0, c).join("");
      if (ch[c - 1].trim()) tick();
      if (c >= ch.length) stopSay();
    }, 22);
  }

  /* ---------- the questions ---------- */
  const COLORS = [["Orange", "#ff8a3d"], ["Blue", "#6ab4ff"], ["Mint", "#7ddba3"], ["Pink", "#ff6fa5"], ["Yellow", "#ffd166"]];
  const STEPS = [
    { key: "name", type: "text", max: 20, ask: () => "What should we call you?", label: "Your name", ph: "Type your name",hint: "2 to 20 letters. You will log in with this name or your email.",
      validate: (v) => /^\p{L}[\p{L} '.-]{1,19}$/u.test(v) ? "" : "Please use 2 to 20 letters." },
    { key: "age", type: "number", ask: (d) => "Nice to meet you, " + d.name + "! How old are you?", label: "Your age", ph: "Type your age", hint: "Ages 5 to 99.",
      validate: (v) => (/^\d{1,2}$/.test(v) && +v >= 5 && +v <= 99) ? "" : "Enter an age from 5 to 99." },
    { key: "email", type: "email", max: 60, ask: (d) => "Where can Mission Control reach you, " + d.name + "? What's your email?", label: "Email", ph: "name@example.com",
      hint: "You will use it to log in later.",
      validate: (v) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "Enter a valid email like name@example.com."
        : taken(v, "").email ? "This email already has an account. Use Login on the start page." : "" },
        { key: "callsign", type: "text", max: 12, ask: (d) => "Every pilot needs a callsign, Commander " + d.name + ". What's yours?", label: "Callsign", ph: "e.g. Falcon",
     hint: "2 to 12 letters or numbers. This is your pilot nickname in the game.", suggest: ["Falcon", "Comet", "Orion", "Rocket", "Nebula"],
      validate: (v) => /^[\p{L}\p{N}]{2,12}$/u.test(v) ? "" : "Use 2 to 12 letters or numbers, no spaces." },
    { key: "pass", type: "password", max: 30, ask: (d) => "Let's lock your command console, Commander " + d.name + ". Choose a secret password.",
      label: "Password", ph: "Type a password", hint: "6 to 30 characters.",
      validate: (v) => (v.length >= 6 && v.length <= 30 && /\S/.test(v)) ? "" : "Use 6 to 30 characters." },
    { kind: "suit", ask: () => "Now choose your suit color. Pick the one that looks best on you!" },
    { kind: "review", ask: (d) => "All set, Commander " + d.name + "! Check your crew ID. Ready for launch?" }
  ];
  const QUESTIONS = 6;
  let step = 0;

  function render() {
    const s = STEPS[step];
    chipEl.textContent = step < QUESTIONS ? "Crew registration: " + (step + 1) + " of " + QUESTIONS : "Crew registration: ready";
    formEl.innerHTML = "";
    say(s.ask(data));
    if (s.kind === "suit") renderSuit(); else if (s.kind === "review") renderReview(); else renderField(s);
    nextBtn.textContent = step === QUESTIONS - 1 ? "Review" : step === QUESTIONS ? "Continue" : "Next";
  }

  function renderField(s) {
    const f = document.createElement("div"); f.className = "field"; f.style.marginBottom = "0";
    const lab = document.createElement("label"); lab.htmlFor = "answer"; lab.textContent = s.label;
    const inp = document.createElement("input");
    inp.id = "answer"; inp.type = s.type; inp.placeholder = s.ph;
    inp.autocomplete = s.type === "password" ? "new-password" : s.type === "email" ? "email" : "off";
    if (s.type === "number") { inp.min = 5; inp.max = 99; inp.inputMode = "numeric"; } else inp.maxLength = s.max;
    if (s.type === "email") inp.inputMode = "email";
    const cur = data[s.key]; inp.value = cur ? cur : "";
    const hint = document.createElement("span"); hint.className = "hint"; hint.textContent = s.hint;
    const err = document.createElement("span"); err.className = "error"; err.setAttribute("role", "alert");
    f.append(lab, inp, hint);
    if (s.type === "password") {
      const tog = document.createElement("button"); tog.type = "button"; tog.className = "chip"; tog.textContent = "Show"; tog.style.marginTop = ".6rem";
      tog.addEventListener("click", () => { const show = inp.type === "password"; inp.type = show ? "text" : "password"; tog.textContent = show ? "Hide" : "Show"; inp.focus(); });
      f.append(tog);
    }
    f.append(err);
    formEl.append(f);
    if (s.suggest) {
      const row = document.createElement("div"); row.className = "chip-row"; row.style.cssText = "justify-content:flex-start;margin-top:.6rem";
      s.suggest.forEach(w => {
        const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = w;
        b.addEventListener("click", () => { inp.value = w; f.classList.remove("invalid"); err.textContent = ""; inp.focus(); });
        row.append(b);
      });
      formEl.append(row);
    }
    inp.addEventListener("input", () => { f.classList.remove("invalid"); err.textContent = ""; });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); next(); } });
        setTimeout(() => inp.focus(), 60);
  }

  function renderSuit() {
    const t = document.createElement("p"); t.textContent = "Suit color"; t.style.cssText = "margin:0 0 .8rem;font:600 1rem var(--font-body)";
    const row = document.createElement("div"); row.className = "swatches";
    COLORS.forEach(([name, hex]) => {
      const lab = document.createElement("label"); lab.className = "swatch";
      const r = document.createElement("input"); r.type = "radio"; r.name = "suit"; r.value = hex; r.setAttribute("aria-label", name);
      r.checked = hex.toLowerCase() === data.suit.toLowerCase();
      const sp = document.createElement("span"); sp.style.setProperty("--c", hex);
      r.addEventListener("change", () => { data.suit = hex; avatar.style.setProperty("--suit", hex); save(); });
      lab.append(r, sp); row.append(lab);
    });
    formEl.append(t, row);
  }

  function renderReview() {
    const box = document.createElement("div"); box.className = "role-fixed";
    const big = document.createElement("span"); big.className = "big"; big.textContent = "🧑‍🚀";
    const col = document.createElement("div");
    const st = document.createElement("strong"); st.textContent = "Commander " + data.name;
    const sm = document.createElement("small"); sm.textContent = "Mission role: Commander";
    col.append(st, sm); box.append(big, col);
    formEl.append(box);
    [["Callsign", data.callsign], ["Email", data.email], ["Age", String(data.age)], ["Password", "••••••••"], ["Suit", null]].forEach(([k, v]) => {
      const line = document.createElement("div"); line.className = "review-line";
      const a = document.createElement("span"); a.textContent = k;
      const b = document.createElement("b");
      if (v === null) { const d = document.createElement("span"); d.className = "dot"; d.style.background = data.suit; b.append(d); }
      else b.textContent = v;
      line.append(a, b); formEl.append(line);
    });
  }

  let busy = false;
  async function next() { if (busy) return; busy = true; try { await go(); } finally { busy = false; } }
  async function go() {
    const s = STEPS[step];
    if (s.kind === "review") {
      save();
      if (window.AstroAuth) await AstroAuth.register({ name: data.name, age: data.age, email: data.email, callsign: data.callsign, suit: data.suit }, data.pass);
      try { sessionStorage.removeItem("astroViaLogin"); } catch (e) {}
       location.replace(NEXT_PAGE); return;
    }
    if (!s.kind) {
      const inp = $("answer"), f = inp.closest(".field"), err = f.querySelector(".error");
      const v = s.type === "password" ? inp.value : inp.value.trim().replace(/\s+/g, " "), msg = s.validate(v);
      if (msg) { f.classList.add("invalid"); err.textContent = msg; inp.focus(); return; }
      data[s.key] = s.type === "number" ? Number(v) : s.type === "email" ? v.toLowerCase() : v;
    }
    save(); step++; render();
  }
  function back() { if (step === 0) location.href = PREV_PAGE; else { step--; render(); } }

  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", back);
  render();
})();