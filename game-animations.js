const GAME_THEMES = {
  snake: { label: 'NEON SNAKE', accent: '#67e8f9', secondary: '#22d3ee', glyph: '◉', motion: 'slither' },
  breakout: { label: 'NEON BREAKOUT', accent: '#facc15', secondary: '#fb7185', glyph: '▤', motion: 'impact' },
  pong: { label: 'NEON PONG', accent: '#fb7185', secondary: '#67e8f9', glyph: '↔', motion: 'rally' },
  blockdrop: { label: 'BLOCK // DROP', accent: '#a78bfa', secondary: '#67e8f9', glyph: '▦', motion: 'stack' },
  voidinvaders: { label: 'VOID INVADERS', accent: '#a78bfa', secondary: '#facc15', glyph: '⌁', motion: 'scan' },
  vectordrift: { label: 'VECTOR DRIFT', accent: '#67e8f9', secondary: '#a78bfa', glyph: '△', motion: 'drift' }
};

export function installGameAnimations(ArcadeOS) {
  if (!ArcadeOS || ArcadeOS.animations) return;
  const sessions = new Map();
  const windowLayer = document.querySelector('[data-window-layer]');
  let observer = null;

  ArcadeOS.bus?.addEventListener('app:opened', event => {
    const id = event.detail?.id;
    if (!GAME_THEMES[id]) return;
    requestAnimationFrame(() => mount(id));
  });
  ArcadeOS.bus?.addEventListener('app:closed', event => destroy(event.detail?.id));
  ArcadeOS.bus?.addEventListener('game:score', event => finish(event.detail?.id, event.detail?.score));
  ArcadeOS.bus?.addEventListener('cheat:modifier', event => pulse(event.detail?.gameId, 'modifier'));
  ArcadeOS.bus?.addEventListener('cheat:command', event => pulse(event.detail?.gameId, 'command'));

  document.addEventListener('visibilitychange', syncAllSessions);
  window.addEventListener('pagehide', destroyAll, { once: true });

  if (windowLayer) {
    observer = new MutationObserver(records => {
      if (!records.some(record => record.type === 'childList' || record.attributeName === 'class')) return;
      syncAllSessions();
    });
    observer.observe(windowLayer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  document.addEventListener('keydown', event => {
    const active = getFocusedSession();
    if (!active || event.repeat) return;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','w','a','s','d'].includes(event.key)) pulse(active.id, 'input');
  });

  document.addEventListener('click', event => {
    const restart = event.target.closest('[data-restart-game],[data-exp-restart],[data-game-start],[data-game-control-restart]');
    if (!restart) return;
    const id = restart.dataset.restartGame || restart.dataset.expRestart || restart.dataset.gameStart || restart.dataset.gameControlRestart;
    if (GAME_THEMES[id]) setTimeout(() => reset(id), 0);
  });

  const api = {
    mount,
    pulse,
    finish,
    reset,
    pause: id => setPaused(id, true),
    resume: id => setPaused(id, false),
    sync: syncAllSessions,
    getSession: id => sessions.get(id) || null,
    themes: GAME_THEMES
  };
  ArcadeOS.animations = api;
  if (ArcadeOS.services) ArcadeOS.services.animations = api;

  function getFocusedSession() {
    return [...sessions.values()]
      .filter(session => session.win.isConnected && !session.paused && !session.win.classList.contains('is-min'))
      .sort((a, b) => (Number.parseInt(b.win.style.zIndex, 10) || 0) - (Number.parseInt(a.win.style.zIndex, 10) || 0))[0] || null;
  }

  function mount(id) {
    const win = document.querySelector(`.os-window[data-app="${id}"]`);
    if (!win || win.querySelector('[data-game-animation-layer]')) return;
    const theme = GAME_THEMES[id];
    win.dataset.gameTheme = id;
    win.style.setProperty('--game-accent', theme.accent);
    win.style.setProperty('--game-secondary', theme.secondary);

    const host = win.querySelector('.window-content');
    if (!host) return;
    const layer = document.createElement('div');
    layer.className = `game-animation-layer game-animation-layer--${theme.motion}`;
    layer.dataset.gameAnimationLayer = id;
    const particles = Array.from({ length: 12 }, (_, index) => {
      const x = 7 + index * 7;
      const y = 12 + index * 6;
      const duration = (3 + index * .22).toFixed(2);
      const delay = (-index * .31).toFixed(2);
      return `<i style="--x:${x}%;--y:${y}%;--duration:${duration}s;--delay:${delay}s"></i>`;
    }).join('');
    layer.innerHTML = `
      <div class="game-animation-intro" data-game-animation-intro>
        <span>${theme.glyph}</span><strong>${theme.label}</strong><small>SESSION LINK ESTABLISHED</small>
      </div>
      <div class="game-animation-grid" aria-hidden="true"></div>
      <div class="game-animation-particles" aria-hidden="true">${particles}</div>
      <div class="game-animation-status" data-game-animation-status><span>LIVE</span><b>00:00</b></div>
      <div class="game-animation-flash" data-game-animation-flash></div>
    `;
    host.appendChild(layer);

    const session = {
      id,
      win,
      layer,
      timer: null,
      pulseTimer: null,
      introTimer: null,
      startedAt: performance.now(),
      elapsedBeforePause: 0,
      paused: false,
      finished: false
    };
    sessions.set(id, session);
    startTimer(session);
    session.introTimer = setTimeout(() => layer.querySelector('[data-game-animation-intro]')?.classList.add('is-hidden'), 1250);
    syncSession(session);
    pulse(id, 'launch');
  }

  function startTimer(session) {
    clearInterval(session.timer);
    session.timer = setInterval(() => updateElapsed(session), 1000);
    updateElapsed(session);
  }

  function updateElapsed(session) {
    if (session.paused || session.finished || !session.win.isConnected) return;
    const elapsed = session.elapsedBeforePause + Math.max(0, performance.now() - session.startedAt);
    const seconds = Math.floor(elapsed / 1000);
    const time = session.layer.querySelector('[data-game-animation-status] b');
    if (time) time.textContent = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  }

  function pulse(id, type = 'input') {
    const session = sessions.get(id);
    if (!session || session.paused || document.hidden) return;
    const flash = session.layer.querySelector('[data-game-animation-flash]');
    session.layer.dataset.pulse = type;
    session.win.classList.remove('game-anim-pulse');
    void session.win.offsetWidth;
    session.win.classList.add('game-anim-pulse');
    flash?.classList.remove('is-active');
    void flash?.offsetWidth;
    flash?.classList.add('is-active');
    clearTimeout(session.pulseTimer);
    session.pulseTimer = setTimeout(() => {
      session.win.classList.remove('game-anim-pulse');
      flash?.classList.remove('is-active');
    }, type === 'command' ? 520 : 260);
  }

  function finish(id, score = 0) {
    const session = sessions.get(id);
    if (!session) return;
    updateElapsed(session);
    session.finished = true;
    session.win.classList.add('game-anim-finished');
    const status = session.layer.querySelector('[data-game-animation-status]');
    if (status) status.innerHTML = `<span>COMPLETE</span><b>${Number(score || 0)}</b>`;
    pulse(id, 'finish');
  }

  function reset(id) {
    const session = sessions.get(id);
    if (!session) return;
    session.startedAt = performance.now();
    session.elapsedBeforePause = 0;
    session.finished = false;
    session.win.classList.remove('game-anim-finished');
    const status = session.layer.querySelector('[data-game-animation-status]');
    if (status) status.innerHTML = '<span>LIVE</span><b>00:00</b>';
    syncSession(session);
    pulse(id, 'launch');
  }

  function setPaused(id, paused) {
    const session = sessions.get(id);
    if (!session || session.paused === paused) return;
    if (paused) {
      if (!session.finished) session.elapsedBeforePause += Math.max(0, performance.now() - session.startedAt);
      session.paused = true;
      clearInterval(session.timer);
      session.timer = null;
      clearTimeout(session.pulseTimer);
      session.win.classList.remove('game-anim-pulse');
      session.layer.classList.add('is-session-paused');
      session.layer.querySelector('[data-game-animation-flash]')?.classList.remove('is-active');
    } else {
      session.paused = false;
      session.startedAt = performance.now();
      session.layer.classList.remove('is-session-paused');
      if (!session.finished) startTimer(session);
    }
  }

  function syncSession(session) {
    const shouldPause = document.hidden || !session.win.isConnected || session.win.classList.contains('is-min');
    setPaused(session.id, shouldPause);
  }

  function syncAllSessions() {
    sessions.forEach(session => syncSession(session));
  }

  function destroy(id) {
    const session = sessions.get(id);
    if (!session) return;
    clearInterval(session.timer);
    clearTimeout(session.pulseTimer);
    clearTimeout(session.introTimer);
    sessions.delete(id);
  }

  function destroyAll() {
    observer?.disconnect();
    sessions.forEach((_, id) => destroy(id));
  }
}
