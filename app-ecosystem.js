const VALID_CATEGORIES = ['games', 'system', 'tools', 'developer', 'intelligence'];
const VALID_PERMISSIONS = ['storage', 'audio', 'notifications', 'bus', 'system'];

export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be an object'] };
  }
  const id = String(manifest.id || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/.test(id) && id !== 'about') {
    errors.push('Manifest ID must be 2-32 lowercase alphanumeric characters with hyphens');
  }
  if (!manifest.title && !manifest.name) {
    errors.push('Manifest requires a name or title');
  }
  const version = String(manifest.version || '1.0.0').trim();
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) {
    errors.push('Manifest version must follow semver format (e.g. 1.0.0)');
  }
  if (manifest.category && !VALID_CATEGORIES.includes(manifest.category)) {
    errors.push(`Invalid category: ${manifest.category}. Must be one of ${VALID_CATEGORIES.join(', ')}`);
  }
  if (manifest.permissions) {
    if (!Array.isArray(manifest.permissions)) {
      errors.push('Permissions must be an array of strings');
    } else {
      for (const perm of manifest.permissions) {
        if (!VALID_PERMISSIONS.includes(perm)) {
          errors.push(`Unknown permission: ${perm}`);
        }
      }
    }
  }
  if (typeof manifest.render !== 'function' && typeof manifest.entry !== 'string') {
    errors.push('Manifest must provide either a render function or entry HTML');
  }
  return { valid: errors.length === 0, errors, manifest };
}

export function normalizeManifest(app) {
  if (!app?.id) throw new Error('App requires an id');
  const id = String(app.id).toLowerCase();
  let category = app.category;
  if (!category) {
    if (['snake','breakout','pong','blockdrop','voidinvaders','vectordrift'].includes(id)) category = 'games';
    else if (['settings','about','customizer','sound','stats'].includes(id)) category = 'system';
    else if (['developer','diagnostics','services'].includes(id)) category = 'developer';
    else if (['nimo','overdrive'].includes(id)) category = 'intelligence';
    else category = 'tools';
  }

  let permissions = Array.isArray(app.permissions) ? [...app.permissions] : [];
  if (!permissions.length) {
    if (category === 'games') permissions = ['storage', 'audio'];
    else if (['developer','diagnostics','services'].includes(id)) permissions = ['storage', 'bus', 'system'];
    else if (['settings','customizer'].includes(id)) permissions = ['storage', 'system'];
    else if (id === 'terminal') permissions = ['system'];
    else permissions = ['storage'];
  }

  return {
    id,
    name: app.name || app.title || id.toUpperCase(),
    title: app.title || app.name || id.toUpperCase(),
    description: app.description || 'ArcadeOS integrated application',
    version: app.version || '1.0.0',
    category,
    icon: app.icon || '◈',
    type: app.type || (app.entry ? 'sandboxed' : 'builtin'),
    permissions,
    author: app.author || (app.type === 'sandboxed' ? 'Community Extension' : 'Manav Agarwal'),
    entry: app.entry || null,
    render: app.render || null,
    minSystemVersion: app.minSystemVersion || '2.0.0',
    trusted: app.type !== 'sandboxed'
  };
}

export function createPermissionManager(storage, bus) {
  const storeKey = 'appPermissions';
  const grants = new Map(Object.entries(storage?.get(storeKey, {}) || {}));

  function has(appId, permission) {
    const appGrants = grants.get(appId);
    if (!appGrants) return true; // Default granted for declared permissions if unconfigured
    return Boolean(appGrants[permission]);
  }

  function get(appId, declaredPermissions = []) {
    const appGrants = grants.get(appId) || {};
    const result = {};
    for (const perm of declaredPermissions) {
      result[perm] = perm in appGrants ? Boolean(appGrants[perm]) : true;
    }
    return result;
  }

  function set(appId, permission, granted) {
    if (!VALID_PERMISSIONS.includes(permission)) return false;
    const current = grants.get(appId) || {};
    current[permission] = Boolean(granted);
    grants.set(appId, current);
    persist();
    bus?.dispatchEvent(new CustomEvent('permission:changed', { detail: { appId, permission, granted: Boolean(granted) } }));
    return true;
  }

  function reset(appId) {
    grants.delete(appId);
    persist();
  }

  function persist() {
    const obj = {};
    for (const [k, v] of grants) obj[k] = v;
    storage?.set(storeKey, obj);
  }

  return { has, get, set, reset };
}

const CATALOG_EXTENSIONS = [
  {
    id: 'pixel-art',
    name: 'Retro Canvas',
    title: 'RETRO CANVAS // PIXEL ART',
    version: '1.0.0',
    category: 'tools',
    icon: '🎨',
    type: 'sandboxed',
    permissions: ['storage', 'notifications'],
    author: 'ArcadeOS Labs',
    description: '16×16 retro neon pixel drawing pad with color palette and local state storage.',
    entry: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; background: #030712; color: #67e8f9; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; user-select: none; }
    .grid { display: grid; grid-template-columns: repeat(16, 18px); grid-template-rows: repeat(16, 18px); gap: 1px; background: rgba(103,232,249,0.15); padding: 8px; border: 1px solid rgba(103,232,249,0.3); border-radius: 8px; }
    .cell { width: 18px; height: 18px; background: #070e1e; cursor: pointer; transition: background .1s; }
    .palette { display: flex; gap: 8px; margin-top: 12px; }
    .color { width: 22px; height: 22px; border-radius: 4px; cursor: pointer; border: 1px solid rgba(255,255,255,0.3); }
    .color.active { outline: 2px solid #fff; }
    .actions { display: flex; gap: 8px; margin-top: 12px; }
    button { padding: 6px 12px; background: rgba(103,232,249,0.15); color: #67e8f9; border: 1px solid rgba(103,232,249,0.4); border-radius: 6px; font-family: monospace; font-size: 11px; cursor: pointer; }
    button:hover { background: rgba(103,232,249,0.3); color: #fff; }
  </style>
</head>
<body>
  <div class="grid" id="grid"></div>
  <div class="palette" id="palette"></div>
  <div class="actions">
    <button id="saveBtn">SAVE ARTWORK</button>
    <button id="clearBtn">CLEAR</button>
  </div>
  <script>
    const colors = ['#070e1e', '#67e8f9', '#a78bfa', '#fb7185', '#facc15', '#22c55e', '#ffffff'];
    let selectedColor = colors[1];
    let pixels = Array(256).fill(0);
    const gridEl = document.getElementById('grid');
    const paletteEl = document.getElementById('palette');

    colors.forEach((c, idx) => {
      const el = document.createElement('div');
      el.className = 'color' + (c === selectedColor ? ' active' : '');
      el.style.background = c;
      el.addEventListener('click', () => {
        document.querySelectorAll('.color').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        selectedColor = c;
      });
      paletteEl.appendChild(el);
    });

    for (let i = 0; i < 256; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.addEventListener('mousedown', () => paint(i, cell));
      gridEl.appendChild(cell);
    }

    function paint(idx, el) {
      pixels[idx] = colors.indexOf(selectedColor);
      el.style.background = selectedColor;
    }

    document.getElementById('clearBtn').addEventListener('click', () => {
      pixels.fill(0);
      document.querySelectorAll('.cell').forEach(c => c.style.background = colors[0]);
    });

    document.getElementById('saveBtn').addEventListener('click', async () => {
      if (window.Arcade?.storage) {
        try {
          await window.Arcade.storage.set('artwork', pixels);
          if (window.Arcade?.notify) window.Arcade.notify('Artwork saved to isolated storage!');
        } catch (e) {
          if (window.Arcade?.notify) window.Arcade.notify('Save failed: ' + e.message);
        }
      }
    });

    // Load saved artwork on boot
    window.addEventListener('load', async () => {
      if (window.Arcade?.storage) {
        try {
          const saved = await window.Arcade.storage.get('artwork');
          if (Array.isArray(saved) && saved.length === 256) {
            pixels = saved;
            const cells = document.querySelectorAll('.cell');
            saved.forEach((colIdx, i) => {
              if (cells[i]) cells[i].style.background = colors[colIdx] || colors[0];
            });
          }
        } catch {}
      }
    });
  </script>
</body>
</html>`
  },
  {
    id: 'calculator',
    name: 'Cyber Calc',
    title: 'CYBER CALC // SCIENTIFIC',
    version: '1.0.0',
    category: 'tools',
    icon: '🖩',
    type: 'sandboxed',
    permissions: ['audio'],
    author: 'ArcadeOS Labs',
    description: 'Retro arithmetic calculator with Web Audio sound feedback.',
    entry: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; background: #030712; color: #67e8f9; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
    .calc { width: 220px; padding: 14px; border: 1px solid rgba(103,232,249,0.3); border-radius: 12px; background: rgba(5,10,24,0.9); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .display { width: 100%; height: 38px; box-sizing: border-box; background: #02050c; border: 1px solid rgba(103,232,249,0.2); border-radius: 8px; color: #a78bfa; font-size: 18px; text-align: right; padding: 6px 10px; margin-bottom: 12px; overflow: hidden; }
    .keys { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    button { height: 38px; background: rgba(103,232,249,0.08); border: 1px solid rgba(103,232,249,0.25); border-radius: 6px; color: #fff; font-family: monospace; font-size: 14px; cursor: pointer; }
    button:hover { background: rgba(103,232,249,0.22); color: #67e8f9; }
    button.op { background: rgba(167,139,250,0.12); border-color: rgba(167,139,250,0.3); color: #a78bfa; }
    button.eq { background: rgba(251,113,133,0.16); border-color: rgba(251,113,133,0.4); color: #fb7185; grid-column: span 2; }
  </style>
</head>
<body>
  <div class="calc">
    <div class="display" id="disp">0</div>
    <div class="keys">
      <button class="op" data-key="C">C</button>
      <button class="op" data-key="/">÷</button>
      <button class="op" data-key="*">×</button>
      <button class="op" data-key="-">-</button>
      <button data-key="7">7</button><button data-key="8">8</button><button data-key="9">9</button>
      <button class="op" data-key="+">+</button>
      <button data-key="4">4</button><button data-key="5">5</button><button data-key="6">6</button>
      <button class="op" data-key=".">.</button>
      <button data-key="1">1</button><button data-key="2">2</button><button data-key="3">3</button>
      <button data-key="0">0</button>
      <button class="eq" data-key="=">=</button>
    </div>
  </div>
  <script>
    let expr = '';
    const disp = document.getElementById('disp');
    document.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.key;
        if (window.Arcade?.audio) window.Arcade.audio.play('hit').catch(() => {});
        if (k === 'C') { expr = ''; disp.textContent = '0'; return; }
        if (k === '=') {
          try {
            const res = Function('"use strict";return (' + expr + ')')();
            disp.textContent = String(res);
            expr = String(res);
          } catch {
            disp.textContent = 'ERR';
            expr = '';
          }
          return;
        }
        expr += k;
        disp.textContent = expr;
      });
    });
  </script>
</body>
</html>`
  }
];

export function installAppEcosystem(ArcadeOS) {
  if (!ArcadeOS || ArcadeOS.ecosystemInstalled) return;

  const { storage, registry, bus, openApp } = ArcadeOS;
  const permissionManager = createPermissionManager(storage, bus);
  const activeIframes = new Map();
  let currentCategory = 'all';
  let searchQuery = '';
  let viewingAppDetail = null;

  // Persisted installed extension IDs
  const installedExtensionIds = new Set(storage.get('installedExtensions', ['pixel-art']));

  // Hook registry to normalize all existing and future apps
  const originalRegisterApp = ArcadeOS.registerApp;
  ArcadeOS.registerApp = function enhancedRegisterApp(app) {
    const normalized = normalizeManifest(app);
    const validated = validateManifest(normalized);
    if (!validated.valid) {
      console.warn(`[ArcadeOS Ecosystem] Manifest warning for ${app.id}:`, validated.errors);
    }
    // Attach normalized metadata onto app object
    Object.assign(app, normalized);
    return originalRegisterApp.call(ArcadeOS, app);
  };

  // Normalize apps already in registry
  for (const [id, app] of registry) {
    try {
      const normalized = normalizeManifest(app);
      Object.assign(app, normalized);
    } catch {}
  }

  // Register catalog extension apps that are marked as installed
  function registerInstalledExtensions() {
    for (const ext of CATALOG_EXTENSIONS) {
      if (installedExtensionIds.has(ext.id)) {
        registerExtensionApp(ext);
      }
    }
  }

  function registerExtensionApp(manifest) {
    const validated = validateManifest(manifest);
    if (!validated.valid) {
      console.error(`Cannot install extension ${manifest.id}:`, validated.errors);
      return false;
    }
    const appEntry = {
      ...manifest,
      render: () => createSandboxedContainer(manifest)
    };
    ArcadeOS.registerApp(appEntry);
    return true;
  }

  function createSandboxedContainer(manifest) {
    const srcdoc = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script>
    (function() {
      let seq = 1;
      const pending = new Map();
      function request(action, payload) {
        return new Promise((resolve, reject) => {
          const id = seq++;
          pending.set(id, { resolve, reject });
          window.parent.postMessage({ type: 'arcade:sdk:request', appId: '${manifest.id}', id, action, payload }, '*');
          setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error('Request timed out')); } }, 4000);
        });
      }
      window.addEventListener('message', e => {
        if (e.data?.type === 'arcade:sdk:response' && pending.has(e.data.id)) {
          const { resolve, reject } = pending.get(e.data.id);
          pending.delete(e.data.id);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data.result);
        }
      });
      window.Arcade = {
        storage: {
          get: key => request('storage:get', { key }),
          set: (key, val) => request('storage:set', { key, val })
        },
        audio: {
          play: sound => request('audio:play', { sound })
        },
        notify: message => request('notify', { message })
      };
    })();
  <\/script>
</head>
<body>
  ${manifest.entry || ''}
</body>
</html>`;

    return `<div class="sandboxed-app-container"><iframe class="sandboxed-app-frame" sandbox="allow-scripts" srcdoc="${escapeAttr(srcdoc)}" data-sandboxed-app="${manifest.id}"></iframe></div>`;
  }

  // Host postMessage bridge listener
  window.addEventListener('message', async event => {
    const data = event.data;
    if (!data || data.type !== 'arcade:sdk:request' || !data.appId || !data.id) return;
    const { appId, id: reqId, action, payload } = data;

    function respond(result, error = null) {
      try {
        event.source?.postMessage({ type: 'arcade:sdk:response', id: reqId, result, error }, '*');
      } catch {}
    }

    if (action === 'storage:get') {
      if (!permissionManager.has(appId, 'storage')) {
        return respond(null, 'Storage permission denied');
      }
      const val = storage.get(`app:${appId}:${payload?.key}`, null);
      return respond(val);
    }

    if (action === 'storage:set') {
      if (!permissionManager.has(appId, 'storage')) {
        return respond(null, 'Storage permission denied');
      }
      storage.set(`app:${appId}:${payload?.key}`, payload?.val);
      return respond(true);
    }

    if (action === 'audio:play') {
      if (!permissionManager.has(appId, 'audio')) {
        return respond(null, 'Audio permission denied');
      }
      ArcadeOS.audio?.play(payload?.sound || 'confirm');
      return respond(true);
    }

    if (action === 'notify') {
      if (!permissionManager.has(appId, 'notifications')) {
        return respond(null, 'Notification permission denied');
      }
      const text = String(payload?.message || '').slice(0, 80);
      showToast(text);
      return respond(true);
    }

    return respond(null, `Unsupported action: ${action}`);
  });

  // Track window closes to clean up iframe resources
  bus.addEventListener('app:closed', event => {
    const id = event.detail?.id;
    if (activeIframes.has(id)) {
      activeIframes.delete(id);
    }
  });

  registerInstalledExtensions();

  // Upgrade App Library in the Registry
  ArcadeOS.registerApp({
    id: 'library',
    icon: '▦',
    title: 'APP LIBRARY',
    name: 'App Library',
    category: 'system',
    description: 'System applications, games and sandboxed extension catalog',
    render: () => renderAppLibrary()
  });

  // Event handlers for library clicks & inputs
  document.addEventListener('input', event => {
    if (event.target.matches('[data-lib-search]')) {
      searchQuery = event.target.value.toLowerCase().trim();
      refreshLibrary();
    }
  });

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-lib-category]');
    if (tab) {
      currentCategory = tab.dataset.libCategory;
      refreshLibrary();
      return;
    }

    const infoBtn = event.target.closest('[data-lib-info]');
    if (infoBtn) {
      viewingAppDetail = infoBtn.dataset.libInfo;
      refreshLibrary();
      return;
    }

    const backBtn = event.target.closest('[data-lib-back]');
    if (backBtn) {
      viewingAppDetail = null;
      refreshLibrary();
      return;
    }

    const installBtn = event.target.closest('[data-lib-install]');
    if (installBtn) {
      const id = installBtn.dataset.libInstall;
      const ext = CATALOG_EXTENSIONS.find(e => e.id === id);
      if (ext) {
        installedExtensionIds.add(id);
        storage.set('installedExtensions', [...installedExtensionIds]);
        registerExtensionApp(ext);
        showToast(`INSTALLED: ${ext.name}`);
        refreshLibrary();
      }
      return;
    }

    const uninstallBtn = event.target.closest('[data-lib-uninstall]');
    if (uninstallBtn) {
      const id = uninstallBtn.dataset.libUninstall;
      installedExtensionIds.delete(id);
      storage.set('installedExtensions', [...installedExtensionIds]);
      registry.delete(id);
      permissionManager.reset(id);
      showToast(`UNINSTALLED: ${id.toUpperCase()}`);
      viewingAppDetail = null;
      refreshLibrary();
      return;
    }

    const permToggle = event.target.closest('[data-lib-perm-toggle]');
    if (permToggle) {
      const appId = permToggle.dataset.app;
      const perm = permToggle.dataset.perm;
      const next = permToggle.checked;
      permissionManager.set(appId, perm, next);
      showToast(`${perm.toUpperCase()} ${next ? 'GRANTED' : 'REVOKED'}`);
      return;
    }
  });

  function refreshLibrary() {
    const win = document.querySelector('.os-window[data-app="library"] .window-content');
    if (win) {
      win.innerHTML = renderAppLibrary();
      const input = win.querySelector('[data-lib-search]');
      if (input && searchQuery) {
        input.value = searchQuery;
        input.focus();
        input.setSelectionRange(searchQuery.length, searchQuery.length);
      }
    }
  }

  function renderAppLibrary() {
    if (viewingAppDetail) {
      const app = registry.get(viewingAppDetail) || CATALOG_EXTENSIONS.find(e => e.id === viewingAppDetail);
      if (app) return renderAppDetail(app);
      viewingAppDetail = null;
    }

    const allApps = getAllLibraryItems();
    const filtered = allApps.filter(app => {
      if (currentCategory !== 'all' && app.category !== currentCategory) return false;
      if (searchQuery) {
        const text = `${app.name} ${app.title} ${app.description} ${app.id}`.toLowerCase();
        if (!text.includes(searchQuery)) return false;
      }
      return true;
    });

    const categories = [
      ['all', 'ALL APPS'],
      ['games', 'GAMES'],
      ['tools', 'TOOLS'],
      ['system', 'SYSTEM'],
      ['developer', 'DEV'],
      ['intelligence', 'NIMO']
    ];

    return `
      <div class="app-library-shell">
        <header class="app-library-hero">
          <div class="app-library-title">
            <span>ARCADEOS ECOSYSTEM</span>
            <strong>Application Library</strong>
          </div>
          <div class="app-library-stats">
            <span>${registry.size} INSTALLED</span>
            <span>${installedExtensionIds.size} EXTENSIONS</span>
          </div>
        </header>

        <section class="app-library-controls">
          <div class="app-library-search-wrap">
            <span class="app-library-search-icon">🔍</span>
            <input type="search" class="app-library-search" data-lib-search placeholder="Search apps, games, tools..." value="${escapeHtml(searchQuery)}" autocomplete="off">
          </div>
          <nav class="app-library-tabs" aria-label="App categories">
            ${categories.map(([id, label]) => `
              <button class="app-library-tab ${currentCategory === id ? 'is-active' : ''}" data-lib-category="${id}">${label}</button>
            `).join('')}
          </nav>
        </section>

        <section class="ecosystem-grid">
          ${filtered.length ? filtered.map(renderAppCard).join('') : '<p style="color:var(--muted);grid-column:1/-1;padding:24px 0;text-align:center;">No matching applications found.</p>'}
        </section>
      </div>
    `;
  }

  function renderAppCard(app) {
    const isInstalled = registry.has(app.id);
    const badgeType = app.type === 'sandboxed' ? 'sandboxed' : 'builtin';
    const badgeText = app.type === 'sandboxed' ? 'SANDBOXED' : 'BUILT-IN';

    return `
      <article class="ecosystem-card">
        <div>
          <div class="ecosystem-card__top">
            <span class="ecosystem-card__icon">${app.icon || '◈'}</span>
            <span class="ecosystem-badge ecosystem-badge--${badgeType}">${badgeText}</span>
          </div>
          <div class="ecosystem-card__body">
            <strong>${escapeHtml(app.name || app.title)}</strong>
            <p>${escapeHtml(app.description || '')}</p>
          </div>
        </div>
        <div>
          <div class="ecosystem-card__meta">
            <span>v${escapeHtml(app.version || '1.0')}</span>
            <span>•</span>
            <span style="text-transform:capitalize;">${escapeHtml(app.category || 'tools')}</span>
          </div>
          <div class="ecosystem-card__actions">
            ${isInstalled ? `
              <button class="ecosystem-btn-open" data-open="${app.id}">OPEN</button>
              <button class="ecosystem-btn-info" data-lib-info="${app.id}" title="Inspect permissions and details">INFO</button>
            ` : `
              <button class="ecosystem-btn-install" data-lib-install="${app.id}">INSTALL</button>
              <button class="ecosystem-btn-info" data-lib-info="${app.id}" title="Inspect details">INFO</button>
            `}
          </div>
        </div>
      </article>
    `;
  }

  function renderAppDetail(app) {
    const isInstalled = registry.has(app.id);
    const declaredPerms = Array.isArray(app.permissions) ? app.permissions : [];
    const permStatus = permissionManager.get(app.id, declaredPerms);

    const permDescriptions = {
      storage: 'Scoped local storage for app persistence',
      audio: 'Synthesized sound engine output',
      notifications: 'System desktop toast messages',
      bus: 'System-wide event bus observation',
      system: 'Core operating system capabilities'
    };

    return `
      <div class="app-detail-view">
        <div class="app-detail-header">
          <button class="app-detail-back" data-lib-back>← BACK TO LIBRARY</button>
          <span class="ecosystem-badge ecosystem-badge--${app.type === 'sandboxed' ? 'sandboxed' : 'builtin'}">${app.type === 'sandboxed' ? 'SANDBOXED CONTAINER' : 'TRUSTED BUILT-IN'}</span>
        </div>

        <div class="app-detail-hero">
          <div class="app-detail-hero__icon">${app.icon || '◈'}</div>
          <div class="app-detail-hero__meta">
            <h3>${escapeHtml(app.name || app.title)}</h3>
            <p>${escapeHtml(app.description || '')}</p>
          </div>
        </div>

        <div class="security-notice">
          <span>ℹ</span>
          <div>
            ${app.type === 'sandboxed' 
              ? '<strong>Sandboxed Isolation:</strong> This application executes in an isolated &lt;iframe&gt; container without same-origin access. Requests are routed through the validated ArcadeOS postMessage bridge.' 
              : '<strong>Built-in Application:</strong> Native system component running with in-process performance. Declared permissions indicate system feature access.'}
          </div>
        </div>

        <section class="app-detail-section">
          <h4>Declared Capabilities & Permissions</h4>
          <div class="permission-list">
            ${declaredPerms.length ? declaredPerms.map(perm => `
              <div class="permission-item">
                <div class="permission-item__info">
                  <strong>${perm.toUpperCase()}</strong>
                  <small>${permDescriptions[perm] || 'Capability access'}</small>
                </div>
                <label>
                  <input type="checkbox" class="permission-toggle" data-lib-perm-toggle data-app="${app.id}" data-perm="${perm}" ${permStatus[perm] ? 'checked' : ''} ${app.type !== 'sandboxed' ? 'disabled' : ''}>
                </label>
              </div>
            `).join('') : '<p style="margin:0;color:var(--muted);font-size:.8rem;">No privileged capabilities requested.</p>'}
          </div>
        </section>

        <section class="app-detail-section">
          <h4>Application Metadata</h4>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;font:600 .75rem JetBrains Mono;color:var(--muted);">
            <div>ID: <span style="color:#fff;">${escapeHtml(app.id)}</span></div>
            <div>VERSION: <span style="color:#fff;">${escapeHtml(app.version || '1.0.0')}</span></div>
            <div>CATEGORY: <span style="color:#fff;text-transform:capitalize;">${escapeHtml(app.category || 'tools')}</span></div>
            <div>AUTHOR: <span style="color:#fff;">${escapeHtml(app.author || 'Unknown')}</span></div>
          </div>
        </section>

        <div style="display:flex;gap:12px;margin-top:6px;">
          ${isInstalled ? `
            <button class="ecosystem-btn-open" style="padding:12px;" data-open="${app.id}">LAUNCH APPLICATION</button>
            ${app.type === 'sandboxed' ? `<button class="ecosystem-btn-uninstall" style="padding:12px;border:1px solid rgba(251,113,133,.3);border-radius:8px;background:rgba(251,113,133,.1);color:#fda4af;font:700 .72rem JetBrains Mono;cursor:pointer;" data-lib-uninstall="${app.id}">UNINSTALL</button>` : ''}
          ` : `
            <button class="ecosystem-btn-install" style="padding:12px;" data-lib-install="${app.id}">INSTALL EXTENSION</button>
          `}
        </div>
      </div>
    `;
  }

  function getAllLibraryItems() {
    const list = [];
    const seen = new Set();
    for (const [id, app] of registry) {
      if (id === 'library') continue;
      list.push(app);
      seen.add(id);
    }
    for (const ext of CATALOG_EXTENSIONS) {
      if (!seen.has(ext.id)) {
        list.push(ext);
      }
    }
    return list;
  }

  function showToast(message) {
    let toast = document.querySelector('.system-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'system-toast';
      toast.style.cssText = 'position:fixed;right:18px;bottom:90px;z-index:999;padding:12px 15px;border:1px solid var(--line);border-radius:9px;background:rgba(5,10,24,.94);color:var(--cyan);font:700 .7rem JetBrains Mono;box-shadow:var(--shadow)';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.remove(), 2600);
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  function escapeAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;');
  }

  const api = {
    validateManifest,
    normalizeManifest,
    permissions: permissionManager,
    list: (cat, query) => {
      return getAllLibraryItems().filter(app => {
        if (cat && cat !== 'all' && app.category !== cat) return false;
        if (query && !`${app.name} ${app.description}`.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      });
    },
    get: id => registry.get(id) || CATALOG_EXTENSIONS.find(e => e.id === id) || null,
    install: manifest => {
      const validated = validateManifest(manifest);
      if (!validated.valid) return { success: false, errors: validated.errors };
      installedExtensionIds.add(manifest.id);
      storage.set('installedExtensions', [...installedExtensionIds]);
      registerExtensionApp(manifest);
      return { success: true };
    },
    uninstall: id => {
      const app = registry.get(id);
      if (!app || app.type !== 'sandboxed') return false;
      installedExtensionIds.delete(id);
      storage.set('installedExtensions', [...installedExtensionIds]);
      registry.delete(id);
      permissionManager.reset(id);
      return true;
    }
  };

  ArcadeOS.apps = api;
  ArcadeOS.permissions = permissionManager;
  if (ArcadeOS.services) {
    ArcadeOS.services.apps = api;
    ArcadeOS.services.permissions = permissionManager;
  }
  ArcadeOS.ecosystemInstalled = true;
}
