const APP_TITLE = 'ArcadeOS';

export function installWindowStateSync(ArcadeOS) {
  if (!ArcadeOS || ArcadeOS.windowState) return;
  const layer = document.querySelector('[data-window-layer]');
  if (!layer) return;

  let frame = 0;
  let previousSignature = '';
  const observer = new MutationObserver(scheduleSync);
  observer.observe(layer, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'data-app']
  });

  ArcadeOS.bus?.addEventListener('app:opened', scheduleSync);
  ArcadeOS.bus?.addEventListener('app:closed', scheduleSync);
  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('pagehide', destroy, { once: true });

  const api = {
    sync: syncNow,
    getSnapshot,
    get focusedApp() { return getSnapshot().focusedApp; },
    get openApps() { return getSnapshot().openApps; },
    get minimizedApps() { return getSnapshot().minimizedApps; },
    destroy
  };

  ArcadeOS.windowState = api;
  if (ArcadeOS.services) ArcadeOS.services.windowState = api;
  scheduleSync();

  function scheduleSync() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(syncNow);
  }

  function getSnapshot() {
    const windows = [...layer.querySelectorAll('.os-window[data-app]')];
    const visible = windows.filter(win => !win.classList.contains('is-min'));
    const focused = visible
      .slice()
      .sort((a, b) => zIndex(b) - zIndex(a))[0] || null;

    return {
      total: windows.length,
      visible: visible.length,
      minimized: windows.length - visible.length,
      openApps: windows.map(win => win.dataset.app).filter(Boolean),
      visibleApps: visible.map(win => win.dataset.app).filter(Boolean),
      minimizedApps: windows.filter(win => win.classList.contains('is-min')).map(win => win.dataset.app).filter(Boolean),
      focusedApp: focused?.dataset.app || null,
      maximizedApp: visible.find(win => win.classList.contains('is-max'))?.dataset.app || null
    };
  }

  function syncNow() {
    const snapshot = getSnapshot();
    const signature = JSON.stringify(snapshot);
    updateWindowAttributes(snapshot);
    updateLaunchSurfaces(snapshot);
    updateDocumentState(snapshot);
    ArcadeOS.animations?.sync?.();

    if (signature !== previousSignature) {
      previousSignature = signature;
      ArcadeOS.bus?.dispatchEvent(new CustomEvent('window:state', { detail: snapshot }));
    }
    return snapshot;
  }

  function updateWindowAttributes(snapshot) {
    layer.querySelectorAll('.os-window[data-app]').forEach(win => {
      const focused = win.dataset.app === snapshot.focusedApp && !win.classList.contains('is-min');
      win.classList.toggle('is-focused', focused);
      win.setAttribute('aria-hidden', String(win.classList.contains('is-min')));
      win.toggleAttribute('inert', win.classList.contains('is-min'));
      win.setAttribute('aria-label', `${win.querySelector('.window-title')?.textContent || win.dataset.app} window`);
    });
  }

  function updateLaunchSurfaces(snapshot) {
    const open = new Set(snapshot.openApps);
    const visible = new Set(snapshot.visibleApps);
    const focused = snapshot.focusedApp;

    document.querySelectorAll('[data-rail-open],[data-open]').forEach(control => {
      const id = control.dataset.railOpen || control.dataset.open;
      if (!id) return;
      const isOpen = open.has(id);
      const isVisible = visible.has(id);
      control.classList.toggle('is-open', isOpen);
      control.classList.toggle('is-active', isVisible);
      control.classList.toggle('is-focused', id === focused);
      if (control.matches('button')) control.setAttribute('aria-pressed', String(isVisible));
      if (id === focused) control.setAttribute('aria-current', 'true');
      else control.removeAttribute('aria-current');
    });

    document.querySelectorAll('[data-open-window-count]').forEach(node => {
      node.textContent = String(snapshot.visible);
    });
  }

  function updateDocumentState(snapshot) {
    document.body.dataset.openWindows = String(snapshot.total);
    document.body.dataset.visibleWindows = String(snapshot.visible);
    if (snapshot.focusedApp) document.body.dataset.activeApp = snapshot.focusedApp;
    else delete document.body.dataset.activeApp;

    const app = snapshot.focusedApp ? ArcadeOS.registry?.get(snapshot.focusedApp) : null;
    document.title = app ? `${app.name || app.title} · ${APP_TITLE}` : APP_TITLE;

    const status = document.querySelector('[data-status]');
    if (status) {
      status.textContent = snapshot.focusedApp
        ? `${String(app?.name || snapshot.focusedApp).toUpperCase()} ACTIVE`
        : navigator.onLine ? 'ONLINE' : 'OFFLINE';
    }
  }

  function destroy() {
    cancelAnimationFrame(frame);
    observer.disconnect();
    ArcadeOS.bus?.removeEventListener('app:opened', scheduleSync);
    ArcadeOS.bus?.removeEventListener('app:closed', scheduleSync);
    window.removeEventListener('resize', scheduleSync);
  }
}

function zIndex(win) {
  return Number.parseInt(win.style.zIndex || getComputedStyle(win).zIndex, 10) || 0;
}
