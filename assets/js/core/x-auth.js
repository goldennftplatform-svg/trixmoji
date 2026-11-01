/**
 * DOSWAPZ X login client — identity only.
 * Talks to /api/auth/* and /api/scores. Never talks to X from the browser.
 */
(function (global) {
  'use strict';

  var ME_URL = '/api/auth/me';
  var LOGIN_URL = '/api/auth/x';
  var LOGOUT_URL = '/api/auth/logout';
  var SCORES_URL = '/api/scores';

  var state = {
    ready: false,
    configured: false,
    user: null
  };

  var readyWaiters = [];

  function notifyReady() {
    state.ready = true;
    readyWaiters.splice(0).forEach(function (fn) {
      try {
        fn(state.user);
      } catch (e) {}
    });
    try {
      document.dispatchEvent(new CustomEvent('dz-x-ready', { detail: { user: state.user } }));
    } catch (e2) {}
  }

  function currentPath() {
    return (location.pathname || '/') + (location.search || '');
  }

  function login(next) {
    var dest = next || currentPath();
    location.href = LOGIN_URL + '?next=' + encodeURIComponent(dest);
  }

  async function logout(next) {
    try {
      await fetch(LOGOUT_URL, { method: 'POST', credentials: 'same-origin' });
    } catch (e) {}
    state.user = null;
    if (next) {
      location.href = LOGOUT_URL + '?next=' + encodeURIComponent(next);
      return;
    }
    renderAll();
    try {
      document.dispatchEvent(new CustomEvent('dz-x-ready', { detail: { user: null } }));
    } catch (e2) {}
  }

  async function load() {
    try {
      var res = await fetch(ME_URL, { credentials: 'same-origin', cache: 'no-store' });
      var data = await res.json();
      state.configured = !!data.configured;
      state.user = data.user || null;
    } catch (e) {
      state.user = null;
    }
    notifyReady();
    renderAll();
    return state.user;
  }

  function onReady(fn) {
    if (state.ready) {
      fn(state.user);
      return;
    }
    readyWaiters.push(fn);
  }

  async function postScore(opts) {
    opts = opts || {};
    if (!state.user) return { ok: false, needLogin: true, error: 'Connect with X first' };
    var res = await fetch(SCORES_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        game: opts.game,
        score: opts.score,
        extra: opts.extra || {}
      })
    });
    var data = {};
    try {
      data = await res.json();
    } catch (e) {}
    if (!res.ok) {
      return { ok: false, needLogin: !!data.needLogin, error: data.error || 'Score post failed' };
    }
    return data;
  }

  async function getBoard(game) {
    var url = SCORES_URL + (game ? '?game=' + encodeURIComponent(game) : '');
    var res = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
    return res.json();
  }

  function flashFromQuery(el) {
    if (!el) return;
    try {
      var q = new URLSearchParams(location.search || '');
      var flag = q.get('xauth');
      if (!flag) return;
      var map = {
        ok: 'X LINKED — identity only. Posts / follows / DMs not read.',
        denied: 'X login cancelled.',
        bad_state: 'X login expired. Try Connect again.',
        fail: 'X login failed. Check the developer app callback URL.',
        not_configured: 'X login is not configured on this server.'
      };
      el.textContent = map[flag] || ('X login: ' + flag);
      q.delete('xauth');
      var next = location.pathname + (q.toString() ? '?' + q.toString() : '');
      if (history && history.replaceState) history.replaceState({}, '', next);
    } catch (e) {}
  }

  function widgetHtml(user, configured) {
    if (user && user.username) {
      return (
        '<div class="dz-x-row">' +
        '<div><strong class="dz-x-ok">X LINKED</strong> <span class="dz-x-handle">@' +
        user.username +
        '</span></div>' +
        '<button type="button" class="dz-x-btn" data-dz-x="logout">DISCONNECT</button>' +
        '</div>' +
        '<p class="dz-x-note">Stored: X id + @handle + scores you post. No posts, follows, or DMs.</p>'
      );
    }
    if (!configured) {
      return (
        '<div class="dz-x-row">' +
        '<div><strong>CONNECT WITH X</strong></div>' +
        '<a class="dz-x-btn" href="/classic/pages/arcade/x-connect.html">SETUP</a>' +
        '</div>' +
        '<p class="dz-x-note">X login is not configured on this server yet. Run SET-X-LOGIN.bat.</p>'
      );
    }
    return (
      '<div class="dz-x-row">' +
      '<div><strong>CONNECT WITH X</strong></div>' +
      '<button type="button" class="dz-x-btn dz-x-primary" data-dz-x="login">CONNECT WITH X</button>' +
      '</div>' +
      '<p class="dz-x-note">Identity only. We do not read your posts, follows, or DMs.</p>'
    );
  }

  function ensureStyles() {
    if (document.getElementById('dz-x-styles')) return;
    var s = document.createElement('style');
    s.id = 'dz-x-styles';
    s.textContent =
      '.dz-x-box{border:1px solid #1a5a32;background:rgba(4,16,8,.92);padding:12px 14px;margin:0 0 16px;font-family:VT323,Consolas,monospace;color:#33ff66}' +
      '.dz-x-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}' +
      '.dz-x-handle{color:#ffd700;letter-spacing:1px}' +
      '.dz-x-ok{color:#33ff66;letter-spacing:2px}' +
      '.dz-x-note{margin:8px 0 0;color:#1a9944;font-size:14px;letter-spacing:1px}' +
      '.dz-x-btn{font:inherit;letter-spacing:2px;cursor:pointer;border:1px solid #33ff66;background:transparent;color:#33ff66;padding:8px 12px;min-height:40px;text-decoration:none;display:inline-block}' +
      '.dz-x-btn:hover,.dz-x-primary:hover{background:#33ff66;color:#000}' +
      '.dz-x-status{min-height:16px;margin-top:8px;color:#9a9a6a;font-size:14px}';
    document.head.appendChild(s);
  }

  function bindBox(box) {
    box.onclick = function (ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var act = t.getAttribute('data-dz-x');
      if (act === 'login') login(box.getAttribute('data-next') || currentPath());
      if (act === 'logout') logout();
    };
  }

  function renderBox(box) {
    if (!box) return;
    ensureStyles();
    var status = box.querySelector('.dz-x-status');
    var keep = status ? status.textContent : '';
    box.innerHTML = widgetHtml(state.user, state.configured) + '<div class="dz-x-status"></div>';
    var st = box.querySelector('.dz-x-status');
    if (st && keep) st.textContent = keep;
    bindBox(box);
    flashFromQuery(st);
  }

  function renderAll() {
    var nodes = document.querySelectorAll('#xAuthMount, .dz-x-box');
    for (var i = 0; i < nodes.length; i++) renderBox(nodes[i]);
    applyVerifiedHandle();
  }

  function applyVerifiedHandle() {
    if (!state.user || !state.user.username) return;
    var inputs = document.querySelectorAll('#scHandle');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].value = '@' + state.user.username;
      inputs[i].readOnly = true;
      inputs[i].title = 'Locked to your X login';
    }
  }

  function mount(el, opts) {
    opts = opts || {};
    if (!el) return;
    el.id = el.id || 'xAuthMount';
    el.classList.add('dz-x-box');
    if (opts.next) el.setAttribute('data-next', opts.next);
    renderBox(el);
  }

  function autoMount() {
    var el = document.getElementById('xAuthMount');
    if (el) {
      el.classList.add('dz-x-box');
      renderBox(el);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoMount);
    } else {
      autoMount();
    }
    load();
  }

  global.DOSWAPZ_X = {
    state: state,
    load: load,
    login: login,
    logout: logout,
    onReady: onReady,
    postScore: postScore,
    getBoard: getBoard,
    mount: mount,
    render: renderAll,
    get user() {
      return state.user;
    },
    get configured() {
      return state.configured;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
