// mode.js: choose Category A or B, save it as localStorage "mode", then continue to the game
(function () {
  const NEXT_PAGE = "base.html";
  const TITLES = { A: "Core Survival", B: "Advanced Survival" };

  // greet the player by name (saved by register.js or by a successful login)
  let name = "";
  try { const a = JSON.parse(localStorage.getItem("astronaut") || "null"); if (a && typeof a.name === "string") name = a.name; } catch (e) {}
  document.getElementById("who").textContent =
    (name ? "Commander " + name + ", pick" : "Commander, pick") + " how tough your mission will be.";

  // players who came in through Login go back to the start page, not to registration
  let viaLogin = false;
  try { viaLogin = sessionStorage.getItem("astroViaLogin") === "1"; } catch (e) {}
  const backLink = document.querySelector('a[href="register.html"]');
  if (viaLogin && backLink) backLink.href = "index.html?home";

  const cards = Array.from(document.querySelectorAll(".mode-card"));
  const go = document.getElementById("go");
  const hint = document.getElementById("hint");

  try { localStorage.removeItem("mode"); } catch (e) {}      // nothing is pre-selected on a new visit

  function choose(m) {
    cards.forEach(c => {
      const on = c.dataset.mode === m;
      c.classList.toggle("selected", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
      c.querySelector(".pick").textContent = on ? "✓ Selected" : "Tap to choose";
    });
    try { localStorage.setItem("mode", m); } catch (e) {}
    go.disabled = false;
    hint.textContent = "Category " + m + " selected: " + TITLES[m] + ".";
  }
  cards.forEach(c => c.addEventListener("click", () => choose(c.dataset.mode)));
   go.addEventListener("click", () => { if (!go.disabled) location.replace(NEXT_PAGE); });
})();
