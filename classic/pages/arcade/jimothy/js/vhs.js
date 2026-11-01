/**
 * Retro VHS / glitch toggle (DOM overlay + optional CSS class).
 */
(function (global) {
  "use strict";

  let on = false;
  let el = null;
  let btn = null;

  function init() {
    el = document.getElementById("vhs");
    btn = document.getElementById("btn-vhs");
    if (btn) {
      btn.addEventListener("click", toggle);
    }
    apply();
  }

  function apply() {
    if (!el) return;
    el.classList.toggle("off", !on);
    el.setAttribute("aria-hidden", on ? "false" : "true");
    if (btn) btn.classList.toggle("on", on);
    document.body.classList.toggle("vhs-on", on);
  }

  function toggle() {
    on = !on;
    apply();
    if (window.JIMPTHY_AUDIO) JIMPTHY_AUDIO.play("ui", { volume: 0.3 });
    return on;
  }

  function set(v) {
    on = !!v;
    apply();
  }

  function isOn() {
    return on;
  }

  global.JIMPTHY_VHS = { init, toggle, set, isOn };
})(window);
