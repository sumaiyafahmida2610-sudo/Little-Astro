// auth.js: tiny front-end account store shared by register.html and index.html (login).
// Demo level only: passwords are salted + hashed, but everything lives in the browser (localStorage).
// Real security needs a server.
(function () {
  const KEY = "astroAccounts";
  const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
  const hex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");

  async function hash(salt, pw) {
    const text = salt + ":" + pw;
    if (window.crypto && crypto.subtle) return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
    let h = 5381; for (const c of text) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;   // weak fallback if crypto is unavailable
    return "w" + h.toString(16);
  }
  function makeSalt() {
    if (window.crypto && crypto.getRandomValues) return hex(crypto.getRandomValues(new Uint8Array(8)));
    return Math.random().toString(16).slice(2, 18);
  }
  function load() {
    try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function store(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

  // account whose email OR registration name equals what the player typed
  function find(id) { const n = norm(id); return n ? (load().find(a => norm(a.email) === n || norm(a.name) === n) || null) : null; }
  function exists(email, callsign) {
    const l = load();
    return { email: !!norm(email) && l.some(a => norm(a.email) === norm(email)), callsign: !!norm(callsign) && l.some(a => norm(a.callsign) === norm(callsign)) };
  }

  // make this account the "current astronaut" that the other pages read
  function setActive(a) {
    try { localStorage.setItem("astronaut", JSON.stringify({ name: a.name, age: a.age, role: "Commander", callsign: a.callsign, suit: a.suit })); } catch (e) {}
  }

  async function register(profile, password) {
    const salt = makeSalt(), passHash = await hash(salt, password);
    const list = load().filter(a => norm(a.email) !== norm(profile.email));   // only the EMAIL must be unique; names and callsigns may repeat
    list.push({ name: profile.name, age: profile.age, email: norm(profile.email), callsign: profile.callsign, suit: profile.suit, salt, passHash });
    return store(list);
  }

  // TEMPORARY (no database yet): while OPEN_LOGIN is true, ANY username/email and password is accepted.
  // Set it to false later to require a registered account with the right password.
  const OPEN_LOGIN = false;

  // returns {ok:true, account} or {ok:false, reason:"nouser"|"badpass"}
  async function login(id, password) {
    const acc = find(id);
    if (OPEN_LOGIN) {
      if (acc) { setActive(acc); return { ok: true, account: acc }; }     // known player: load their saved profile
      const raw = String(id || "").trim(), base = raw.includes("@") ? raw.split("@")[0] : raw;
      const callsign = base.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 12) || "Pilot";
      const guest = { name: callsign.charAt(0).toUpperCase() + callsign.slice(1), age: 0, email: raw.includes("@") ? norm(raw) : "", callsign, suit: "#ff8a3d" };
      setActive(guest);
      return { ok: true, account: guest };
    }
    // several players may share a name, so try every account with that name/email and keep the one whose password matches
    const n = norm(id), matches = n ? load().filter(x => norm(x.email) === n || norm(x.name) === n) : [];
    if (!matches.length) return { ok: false, reason: "nouser" };
    for (const m of matches) {
      if (await hash(m.salt, password) === m.passHash) { setActive(m); return { ok: true, account: m }; }
    }
    return { ok: false, reason: "badpass" };
  }

  window.AstroAuth = { register, login, find, exists, setActive };
})();
