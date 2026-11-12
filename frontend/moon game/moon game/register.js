// register.js: the avatar asks one question at a time and saves the answers to localStorage ("astronaut")
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PREV_PAGE = "briefing.html", NEXT_PAGE = "mode.html";
  const $ = (id) => document.getElementById(id);
  const sayEl = $("say"), formEl = $("form"), nextBtn = $("next"), backBtn = $("back"), chipEl = $("step-chip"), avatar = $("avatar");

  /* ---------- saved data (shape: {name, age, role, callsign, suit}) ---------- */
  const data = { name: "", age: 0, role: "Commander", callsign: "", suit: "#ff8a3d" };
  try { localStorage.removeItem("astronaut"); } catch (e) {}   // always start fresh: no old answers in the fields
  function save() {
    try { localStorage.setItem("astronaut", JSON.stringify({ name: data.name, age: data.age, role: "Commander", callsign: data.callsign, suit: data.suit })); } catch (e) {}
  }
  avatar.style.setProperty("--suit", data.suit);

  /* ---------- typing sound (uses the same on/off choice as the briefing page) ---------- */
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
    { key: "name", ask: () => "What should we call you?", label: "Your name", ph: "Type your name", hint: "2 to 20 letters.",
      validate: (v) => /^\p{L}[\p{L} '.-]{1,19}$/u.test(v) ? "" : "Please use 2 to 20 letters." },
    { key: "age", ask: (d) => "Nice to meet you, " + d.name + "! How old are you?", label: "Your age", ph: "Type your age", hint: "Ages 5 to 99.", number: true,
      validate: (v) => (/^\d{1,2}$/.test(v) && +v >= 5 && +v <= 99) ? "" : "Enter an age from 5 to 99." },
    { key: "callsign", ask: (d) => "Every pilot needs a callsign, Commander " + d.name + ". What's yours?", label: "Callsign", ph: "e.g. Falcon",
      hint: "2 to 12 letters or numbers. Pick one below or type your own.", suggest: ["Falcon", "Comet", "Orion", "Rocket", "Nebula"],
      validate: (v) => /^[\p{L}\p{N}]{2,12}$/u.test(v) ? "" : "Use 2 to 12 letters or numbers, no spaces." },
    { kind: "suit", ask: () => "Now choose your suit color. Pick the one that looks best on you!" },
    { kind: "review", ask: (d) => "All set, Commander " + d.name + "! Check your crew ID. Ready for launch?" }
  ];
  let step = 0;
  if (!data.name) step = 0;

  function render() {
    const s = STEPS[step];
    chipEl.textContent = step < 4 ? "Crew registration: " + (step + 1) + " of 4" : "Crew registration: ready";
    formEl.innerHTML = "";
    say(s.ask(data));
    if (s.kind === "suit") renderSuit(); else if (s.kind === "review") renderReview(); else renderField(s);
    nextBtn.textContent = step === 3 ? "Review" : step === 4 ? "Continue" : "Next";
  }

  function renderField(s) {
    const f = document.createElement("div"); f.className = "field"; f.style.marginBottom = "0";
    const lab = document.createElement("label"); lab.htmlFor = "answer"; lab.textContent = s.label;
    const inp = document.createElement("input");
    inp.id = "answer"; inp.type = s.number ? "number" : "text"; inp.placeholder = s.ph; inp.autocomplete = "off";
    if (s.number) { inp.min = 5; inp.max = 99; inp.inputMode = "numeric"; } else inp.maxLength = 20;
    const cur = data[s.key]; inp.value = cur ? cur : "";
    const hint = document.createElement("span"); hint.className = "hint"; hint.textContent = s.hint;
    const err = document.createElement("span"); err.className = "error"; err.setAttribute("role", "alert");
    f.append(lab, inp, hint, err);
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
    [["Callsign", data.callsign], ["Age", String(data.age)], ["Suit", null]].forEach(([k, v]) => {
      const line = document.createElement("div"); line.className = "review-line";
      const a = document.createElement("span"); a.textContent = k;
      const b = document.createElement("b");
      if (v === null) { const d = document.createElement("span"); d.className = "dot"; d.style.background = data.suit; b.append(d); }
      else b.textContent = v;
      line.append(a, b); formEl.append(line);
    });
  }

  function next() {
    const s = STEPS[step];
    if (s.kind === "review") { save(); location.href = NEXT_PAGE; return; }
    if (!s.kind) {
      const inp = $("answer"), f = inp.closest(".field"), err = f.querySelector(".error");
      const v = inp.value.trim().replace(/\s+/g, " "), msg = s.validate(v);
      if (msg) { f.classList.add("invalid"); err.textContent = msg; inp.focus(); return; }
      data[s.key] = s.number ? Number(v) : v;
    }
    save(); step++; render();
  }
  function back() { if (step === 0) location.href = PREV_PAGE; else { step--; render(); } }

  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", back);
  render();
})();
