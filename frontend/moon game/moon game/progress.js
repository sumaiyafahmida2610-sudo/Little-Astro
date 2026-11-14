/* progress.js - load in the <head> of EVERY page.
   Rule: once a player has finished the intro (briefing + registration + mode) OR has logged in,
   the intro pages (front page, briefing, register, mode) are skipped and they go straight to the game.

   >>> Set GAME_PAGE to your real game file name. */
(function () {
  var GAME_PAGE   = "base.html";
  var INTRO_PAGES = ["", "index.html", "login.html", "briefing.html", "register.html", "mode.html"];

  var K_PAGE = "astro_last_page", K_USER = "astro_user", K_DONE = "astro_intro_done";
  var page = location.pathname.split("/").pop() || "index.html";
  var isIntro = INTRO_PAGES.indexOf(page) !== -1 || INTRO_PAGES.indexOf(location.pathname.split("/").pop()) !== -1;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var api = window.AstroProgress = {
    isLoggedIn: function () { return !!get(K_USER); },
    introDone:  function () { return get(K_DONE) === "1"; },
    // Player logged in => they already did the intro on their first visit.
    login:  function (name) { set(K_USER, name || "player"); set(K_DONE, "1"); },
    logout: function () { del(K_USER); del(K_DONE); },
    // Where to send a returning player: last game page they were on, else the game.
    resumeUrl: function () {
      var last = get(K_PAGE);
      return last && INTRO_PAGES.indexOf(last.split(/[?#]/)[0]) === -1 ? last : GAME_PAGE;
    },
    resume: function () { location.replace(api.resumeUrl()); },
    // Wipe everything and play from the very beginning (testing / "new game")
    reset: function () { del(K_PAGE); del(K_USER); del(K_DONE); del("astronaut"); del("mode"); }
  };

  // Test helper: open index.html?reset to see the intro again.
  if (/[?&]reset\b/.test(location.search)) { api.reset(); return; }

  // Any page that is not an intro page is the game: remember it, and mark the intro as done.
  if (!isIntro) { set(K_PAGE, page + location.search + location.hash); set(K_DONE, "1"); }

  // Registration + mode both saved = intro finished.
  if (get("astronaut") && get("mode")) set(K_DONE, "1");

  // Intro already done: skip the intro pages. (index.html?home keeps the front page open, e.g. to log out.)
  var wantsHome = /[?&]home\b/.test(location.search);
  if (isIntro && api.introDone() && !wantsHome) location.replace(api.resumeUrl());
})();
