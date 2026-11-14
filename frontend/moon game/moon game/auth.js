
// auth.js - Supabase authentication for Little Astro

(function () {
  const SUPABASE_URL = "https://vipjpvqwumiphdyfqyra.supabase.co";
  const SUPABASE_KEY = "sb_publishable_3aI3RBKcB7nHUEujYwLvxQ_j-pRFnSz";

  if (!window.supabase) {
    console.error("Supabase library was not loaded.");
    return;
  }

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  function norm(value) {
    return String(value || "").trim().toLowerCase();
  }

  // Keep the astronaut information in the format
  // already used by your game pages.
  function setActive(user) {
    const meta = user.user_metadata || {};

    const astronaut = {
      name: meta.name || "Astronaut",
      age: meta.age || 0,
      role: "Commander",
      callsign: meta.callsign || "Pilot",
      suit: meta.suit || "#ff8a3d"
    };

    localStorage.setItem("astronaut", JSON.stringify(astronaut));
    return astronaut;
  }

  async function register(profile, password) {
    const { data, error } = await db.auth.signUp({
      email: norm(profile.email),
      password: password,
      options: {
        data: {
          name: profile.name,
          age: Number(profile.age),
          callsign: profile.callsign,
          suit: profile.suit
        }
      }
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (data.user) {
      const account = setActive(data.user);

      // Only mark as logged in if Supabase created a session.
      if (data.session && window.AstroProgress) {
        AstroProgress.login(account.callsign);
      }

      return {
        ok: true,
        account: account,
        needsEmailConfirmation: !data.session
      };
    }

    return { ok: false, error: "Registration could not be completed." };
  }

  async function login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({
      email: norm(email),
      password: password
    });

    if (error) {
      return {
        ok: false,
        reason: "invalid",
        error: error.message
      };
    }

    const account = setActive(data.user);

    if (window.AstroProgress) {
      AstroProgress.login(account.callsign);
    }

    return { ok: true, account: account };
  }

  // Duplicate checks are handled by Supabase during registration.
  // Keep this method temporarily for compatibility with register.js.
  function exists() {
    return { email: false, callsign: false };
  }

  window.AstroAuth = {
    register,
    login,
    setActive,
    exists,
    db
  };
})();
