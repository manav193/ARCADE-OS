(function installArcadeLoopGuard(global) {
  'use strict';

  if (global.ArcadeLoopGuard) return;

  const gameIds = new Set(['snake', 'breakout', 'pong', 'blockdrop', 'voidinvaders', 'vectordrift']);
  const nativeRaf = global.requestAnimationFrame.bind(global);
  const nativeCancelRaf = global.cancelAnimationFrame.bind(global);
  const nativeSetTimeout = global.setTimeout.bind(global);
  const nativeClearTimeout = global.clearTimeout.bind(global);
  const rafTasks = new Map();
  const timeoutTasks = new Map();
  let sequence = 1;
  let runningOwner = null;

  const isGameWindow = win => Boolean(win && gameIds.has(win.dataset.app));
  const activeWindow = () => {
    const windows = [...document.querySelectorAll('.os-window[data-app]')]
      .filter(win => isGameWindow(win) && !win.classList.contains('is-min') && win.isConnected);
    return windows.sort((a, b) => (Number(b.style.zIndex) || 0) - (Number(a.style.zIndex) || 0))[0] || null;
  };
  const inferOwner = () => runningOwner || activeWindow();
  const isPaused = owner => !owner || !owner.isConnected || owner.classList.contains('is-min') || document.hidden;

  function runWithOwner(owner, callback, args) {
    const previous = runningOwner;
    runningOwner = owner;
    try {
      return callback(...args);
    } finally {
      runningOwner = previous;
    }
  }

  global.requestAnimationFrame = function guardedRequestAnimationFrame(callback) {
    const owner = inferOwner();
    if (!isGameWindow(owner) || typeof callback !== 'function') return nativeRaf(callback);

    const id = sequence++;
    const task = { owner, callback, nativeId: 0, cancelled: false };
    const tick = timestamp => {
      if (task.cancelled) return;
      if (isPaused(owner)) {
        task.nativeId = nativeRaf(tick);
        return;
      }
      rafTasks.delete(id);
      runWithOwner(owner, callback, [timestamp]);
    };
    task.nativeId = nativeRaf(tick);
    rafTasks.set(id, task);
    return id;
  };

  global.cancelAnimationFrame = function guardedCancelAnimationFrame(id) {
    const task = rafTasks.get(id);
    if (!task) return nativeCancelRaf(id);
    task.cancelled = true;
    nativeCancelRaf(task.nativeId);
    rafTasks.delete(id);
  };

  global.setTimeout = function guardedSetTimeout(callback, delay = 0, ...args) {
    const owner = inferOwner();
    if (!isGameWindow(owner) || typeof callback !== 'function') return nativeSetTimeout(callback, delay, ...args);

    const id = sequence++;
    const task = {
      owner,
      callback,
      args,
      remaining: Math.max(0, Number(delay) || 0),
      startedAt: performance.now(),
      nativeId: 0,
      cancelled: false,
      paused: false
    };

    const poll = () => {
      if (task.cancelled) return;
      const now = performance.now();
      if (isPaused(owner)) {
        if (!task.paused) {
          task.remaining = Math.max(0, task.remaining - (now - task.startedAt));
          task.paused = true;
        }
        task.startedAt = now;
        task.nativeId = nativeSetTimeout(poll, 100);
        return;
      }
      if (task.paused) {
        task.paused = false;
        task.startedAt = now;
      }
      if (task.remaining > 0) {
        const elapsed = now - task.startedAt;
        task.remaining = Math.max(0, task.remaining - elapsed);
        task.startedAt = now;
        if (task.remaining > 0) {
          task.nativeId = nativeSetTimeout(poll, Math.min(task.remaining, 100));
          return;
        }
      }
      timeoutTasks.delete(id);
      runWithOwner(owner, callback, args);
    };

    task.nativeId = nativeSetTimeout(poll, task.remaining);
    timeoutTasks.set(id, task);
    return id;
  };

  global.clearTimeout = function guardedClearTimeout(id) {
    const task = timeoutTasks.get(id);
    if (!task) return nativeClearTimeout(id);
    task.cancelled = true;
    nativeClearTimeout(task.nativeId);
    timeoutTasks.delete(id);
  };

  const cancelOwner = owner => {
    for (const [id, task] of rafTasks) {
      if (task.owner !== owner) continue;
      task.cancelled = true;
      nativeCancelRaf(task.nativeId);
      rafTasks.delete(id);
    }
    for (const [id, task] of timeoutTasks) {
      if (task.owner !== owner) continue;
      task.cancelled = true;
      nativeClearTimeout(task.nativeId);
      timeoutTasks.delete(id);
    }
  };

  const api = Object.freeze({
    activeWindow,
    isPaused,
    cancelOwner,
    stats: () => ({ animationFrames: rafTasks.size, timeouts: timeoutTasks.size })
  });

  global.ArcadeLoopGuard = api;
  global.ArcadeOS = global.ArcadeOS || {};
  global.ArcadeOS.loopGuard = api;
  global.ArcadeOS.services = global.ArcadeOS.services || {};
  global.ArcadeOS.services.loopGuard = api;

  global.addEventListener('pagehide', () => {
    for (const task of rafTasks.values()) nativeCancelRaf(task.nativeId);
    for (const task of timeoutTasks.values()) nativeClearTimeout(task.nativeId);
    rafTasks.clear();
    timeoutTasks.clear();
  }, { once: true });
})(window);
