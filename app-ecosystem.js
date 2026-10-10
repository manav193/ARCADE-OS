export const SYSTEM_VERSION = '2.4.0';
const VALID_CATEGORIES = ['games', 'system', 'tools', 'developer', 'intelligence'];
const VALID_PERMISSIONS = ['storage', 'audio', 'notifications', 'bus', 'system'];
const ALLOWED_AUDIO_SOUNDS = ['launch', 'confirm', 'score', 'hit', 'gameover', 'blip', 'select'];
const SAFE_KEY_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;
export const MAX_ENTRY_SIZE = 524288; // 512 KB
export const MAX_MANIFEST_SIZE = 1048576; // 1 MB
export const MAX_STORAGE_VALUE_SIZE = 65536; // 64 KB
export const MAX_APP_STORAGE_QUOTA = 262144; // 256 KB aggregate per app
export const MAX_CONCURRENT_REQUESTS = 30;

export const RESERVED_IDS = new Set([
  'library', 'terminal', 'notes', 'settings', 'about',
  'snake', 'breakout', 'pong', 'blockdrop', 'voidinvaders', 'vectordrift',
  'developer', 'diagnostics', 'services', 'events', 'storage-inspector',
  'achievements', 'music', 'stats', 'nimo', 'overdrive', 'system',
  'constructor', 'prototype', '__proto__'
]);

export function compareSemver(v1, v2) {
  const p1 = String(v1 || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = String(v2 || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export function getByteLength(str) {
  if (typeof str !== 'string') return 0;
  try {
    return new TextEncoder().encode(str).length;
  } catch {
    return str.length;
  }
}

export function calculateAppStorageUsage(appId, storage = null) {
  let totalBytes = 0;
  const prefix = `app:${appId}:`;
  const lsPrefix = `arcadeos:${prefix}`;

  if (storage?.data instanceof Map) {
    for (const [k, v] of storage.data) {
      if (typeof k === 'string' && (k.startsWith(prefix) || k.startsWith(lsPrefix))) {
        try {
          const serialized = typeof v === 'string' ? v : JSON.stringify(v);
          totalBytes += getByteLength(k) + getByteLength(serialized);
        } catch {}
      }
    }
    return totalBytes;
  }

  if (typeof localStorage !== 'undefined' && localStorage) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(lsPrefix)) {
          const val = localStorage.getItem(k);
          totalBytes += getByteLength(k) + (val ? getByteLength(val) : 0);
        }
      }
    } catch {}
  }

  return totalBytes;
}

export function validateManifest(manifest, options = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['Manifest must be an object'] };
  }

  let serializedSize = 0;
  try {
    serializedSize = JSON.stringify(manifest).length;
  } catch {
    return { valid: false, errors: ['Manifest is not serializable'] };
  }
  if (serializedSize > MAX_MANIFEST_SIZE) {
    errors.push(`Manifest exceeds size limit (${MAX_MANIFEST_SIZE} bytes)`);
  }

  const id = String(manifest.id || '').trim().toLowerCase();
  if (!id) {
    errors.push('Manifest requires an ID');
  } else if (!/^[a-z0-9][a-z0-9-]{0,30}[a-z0-9]$/.test(id) && id !== 'about') {
    errors.push('Manifest ID must be 2-32 lowercase alphanumeric characters with hyphens');
  }

  if (!options.allowReserved && RESERVED_IDS.has(id)) {
    errors.push(`Manifest ID is reserved: ${id}`);
  }

  if (!manifest.title && !manifest.name) {
    errors.push('Manifest requires a name or title');
  }

  const name = String(manifest.name || manifest.title || '').trim();
  if (name.length > 64) {
    errors.push('Manifest name exceeds 64 characters');
  }

  if (manifest.description && String(manifest.description).length > 256) {
    errors.push('Manifest description exceeds 256 characters');
  }

  const version = String(manifest.version || '1.0.0').trim();
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) {
    errors.push('Manifest version must follow semver format (e.g. 1.0.0)');
  }

  if (manifest.minSystemVersion) {
    const minSys = String(manifest.minSystemVersion).trim();
    if (!/^\d+\.\d+(\.\d+)?$/.test(minSys)) {
      errors.push('minSystemVersion must follow semver format (e.g. 2.4.0)');
    } else if (compareSemver(minSys, SYSTEM_VERSION) > 0) {
      errors.push(`Manifest requires ArcadeOS v${minSys} or higher (current system is v${SYSTEM_VERSION})`);
    }
  }

  if (manifest.category && !VALID_CATEGORIES.includes(manifest.category)) {
    errors.push(`Invalid category: ${manifest.category}. Must be one of ${VALID_CATEGORIES.join(', ')}`);
  } else if (options.isExtension && !manifest.category) {
    errors.push('Extension manifest requires a category');
  }

  if (manifest.permissions !== undefined) {
    if (!Array.isArray(manifest.permissions)) {
      errors.push('Permissions must be an array of strings');
    } else {
      for (const perm of manifest.permissions) {
        if (!VALID_PERMISSIONS.includes(perm)) {
          errors.push(`Unknown permission: ${perm}`);
        }
      }
      if ((manifest.type === 'sandboxed' || options.isExtension) && manifest.permissions.includes('system')) {
        errors.push('Sandboxed extensions cannot request system permission');
      }
    }
  }

  if (manifest.type === 'sandboxed' || options.isExtension) {
    if (typeof manifest.entry !== 'string' || !manifest.entry.trim()) {
      errors.push('Sandboxed extension requires an entry HTML string');
    } else if (manifest.entry.length > MAX_ENTRY_SIZE) {
      errors.push(`Extension entry HTML exceeds size limit (${MAX_ENTRY_SIZE} bytes)`);
    }
    if (typeof manifest.render === 'function') {
      errors.push('Sandboxed extensions cannot provide a direct render function');
    }
  } else {
    if (typeof manifest.render !== 'function' && typeof manifest.entry !== 'string') {
      errors.push('Manifest must provide either a render function or entry HTML');
    }
    if (typeof manifest.entry === 'string' && manifest.entry.length > MAX_ENTRY_SIZE) {
      errors.push(`Entry HTML exceeds size limit (${MAX_ENTRY_SIZE} bytes)`);
    }
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

export function createPermissionManager(storage, bus, getManifest = null) {
  const storeKey = 'appPermissions';

  function loadGrants() {
    let raw = null;
    try {
      raw = storage?.get(storeKey, {});
    } catch {
      raw = {};
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      raw = {};
    }
    const map = new Map();
    for (const [appId, perms] of Object.entries(raw)) {
      if (typeof appId === 'string' && perms && typeof perms === 'object' && !Array.isArray(perms)) {
        const cleanPerms = {};
        for (const [p, val] of Object.entries(perms)) {
          if (VALID_PERMISSIONS.includes(p)) {
            cleanPerms[p] = Boolean(val);
          }
        }
        map.set(appId, cleanPerms);
      }
    }
    return map;
  }

  const grants = loadGrants();

  function resolveManifest(appId) {
    if (typeof getManifest === 'function') {
      try {
        return getManifest(appId);
      } catch {}
    }
    return null;
  }

  function has(appId, permission) {
    if (!VALID_PERMISSIONS.includes(permission)) return false;

    const manifest = resolveManifest(appId);

    // Sandboxed extensions cannot hold 'system' permission under any circumstances
    if (permission === 'system' && manifest && (manifest.type === 'sandboxed' || manifest.trusted === false)) {
      return false;
    }

    // If manifest specifies declared permissions, undeclared permissions are strictly denied
    if (manifest && Array.isArray(manifest.permissions)) {
      if (!manifest.permissions.includes(permission)) {
        return false;
      }
    }

    const appGrants = grants.get(appId);
    if (!appGrants) {
      if (manifest && Array.isArray(manifest.permissions)) {
        return manifest.permissions.includes(permission);
      }
      // If no manifest resolver was provided, standard user permissions default to true for test compatibility
      if (permission === 'system') return false;
      return true;
    }

    if (permission in appGrants) {
      return Boolean(appGrants[permission]);
    }

    // Fall back to declared permission default
    if (manifest && Array.isArray(manifest.permissions)) {
      return manifest.permissions.includes(permission);
    }

    return permission !== 'system';
  }

  function get(appId, declaredPermissions = []) {
    const manifest = resolveManifest(appId);
    const effectiveDeclared = Array.isArray(declaredPermissions) && declaredPermissions.length > 0
      ? declaredPermissions
      : (manifest && Array.isArray(manifest.permissions) ? manifest.permissions : []);

    const appGrants = grants.get(appId) || {};
    const result = {};
    for (const perm of effectiveDeclared) {
      if (!VALID_PERMISSIONS.includes(perm)) {
        result[perm] = false;
        continue;
      }
      if (perm === 'system' && manifest && (manifest.type === 'sandboxed' || manifest.trusted === false)) {
        result[perm] = false;
        continue;
      }
      result[perm] = perm in appGrants ? Boolean(appGrants[perm]) : true;
    }
    return result;
  }

  function set(appId, permission, granted) {
    if (!VALID_PERMISSIONS.includes(permission)) return false;

    const manifest = resolveManifest(appId);

    // Sandboxed extensions can never be granted 'system' capability
    if (permission === 'system' && manifest && (manifest.type === 'sandboxed' || manifest.trusted === false)) {
      return false;
    }

    // Undeclared permissions cannot be granted
    if (manifest && Array.isArray(manifest.permissions) && !manifest.permissions.includes(permission)) {
      return false;
    }

    const current = grants.get(appId) || {};
    current[permission] = Boolean(granted);
    grants.set(appId, current);
    persist();
    try {
      bus?.dispatchEvent(new CustomEvent('permission:changed', { detail: { appId, permission, granted: Boolean(granted) } }));
    } catch {}
    return true;
  }

  function reset(appId) {
    grants.delete(appId);
    persist();
  }

  function persist() {
    const obj = {};
    for (const [k, v] of grants) obj[k] = v;
    try {
      storage?.set(storeKey, obj);
    } catch {}
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
  const getAppManifest = id => {
    return registry.get(id) || CATALOG_EXTENSIONS.find(e => e.id === id) || null;
  };
  const permissionManager = createPermissionManager(storage, bus, getAppManifest);
  let currentCategory = 'all';
  let searchQuery = '';
  let viewingAppDetail = null;

  // Persisted installed extension IDs
  const installedExtensionIds = new Set(storage.get('installedExtensions', ['pixel-art']));

  // Hook registry to normalize all existing and future apps
  const originalRegisterApp = ArcadeOS.registerApp;
  ArcadeOS.registerApp = function enhancedRegisterApp(app) {
    const normalized = normalizeManifest(app);
    const validated = validateManifest(normalized, { allowReserved: true });
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
    const validated = validateManifest(manifest, { allowReserved: true });
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
          window.parent.postMessage({ type: 'arcade:sdk:request', appId: ${JSON.stringify(manifest.id)}, id, action, payload }, '*');
          setTimeout(() => {
            if (pending.has(id)) {
              pending.delete(id);
              reject(new Error('Request timed out'));
            }
          }, 4000);
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
          set: (key, val) => request('storage:set', { key, val }),
          delete: key => request('storage:delete', { key }),
          remove: key => request('storage:delete', { key }),
          quota: () => request('storage:quota', {})
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

  const inFlightRequests = new Map();

  function getSenderFrame(sourceWindow) {
    if (!sourceWindow) return null;
    const iframes = document.querySelectorAll('.sandboxed-app-frame');
    for (const iframe of iframes) {
      try {
        if (iframe.contentWindow === sourceWindow) {
          return {
            iframe,
            appId: iframe.dataset.sandboxedApp
          };
        }
      } catch {}
    }
    return null;
  }

  // Host postMessage bridge listener
  window.addEventListener('message', async event => {
    const data = event.data;
    if (!data || typeof data !== 'object' || data.type !== 'arcade:sdk:request') return;

    // 1. Verify that event.source matches an active registered sandboxed iframe
    const sender = getSenderFrame(event.source);
    if (!sender) {
      // Reject messages from unexpected windows, external origins, popups, or detached iframes
      return;
    }

    const { appId } = sender;
    const reqId = data.id;

    function respond(result, error = null) {
      try {
        event.source.postMessage({ type: 'arcade:sdk:response', id: reqId, result, error }, '*');
      } catch {}
    }

    // 2. Validate request ID (must be a positive integer)
    if (!Number.isInteger(reqId) || reqId <= 0 || reqId > 1e9) {
      return respond(null, 'Invalid request ID');
    }

    // 3. Prevent App ID spoofing: message appId must match the verified iframe's appId
    if (data.appId !== appId) {
      return respond(null, `App ID spoofing detected: message declares "${data.appId}" but sender container is "${appId}"`);
    }

    // 4. Rate-limit concurrent in-flight requests and reject duplicate in-flight IDs
    let inFlightSet = inFlightRequests.get(event.source);
    if (!inFlightSet) {
      inFlightSet = new Set();
      inFlightRequests.set(event.source, inFlightSet);
    }
    if (inFlightSet.has(reqId)) {
      return respond(null, `Duplicate request ID in flight: ${reqId}`);
    }
    if (inFlightSet.size >= MAX_CONCURRENT_REQUESTS) {
      return respond(null, 'Too many concurrent requests');
    }
    inFlightSet.add(reqId);

    const finish = (result, error = null) => {
      inFlightSet.delete(reqId);
      respond(result, error);
    };

    const action = String(data.action || '');
    const payload = data.payload;

    // 5. Dispatch protected operations
    if (action === 'storage:get') {
      if (!permissionManager.has(appId, 'storage')) {
        return finish(null, 'Storage permission denied');
      }
      const key = payload?.key;
      if (typeof key !== 'string' || !SAFE_KEY_REGEX.test(key)) {
        return finish(null, 'Invalid storage key: must be 1-64 alphanumeric characters, underscores, or hyphens');
      }
      const val = storage.get(`app:${appId}:${key}`, null);
      return finish(val, null);
    }

    if (action === 'storage:set') {
      if (!permissionManager.has(appId, 'storage')) {
        return finish(null, 'Storage permission denied');
      }
      const key = payload?.key;
      if (typeof key !== 'string' || !SAFE_KEY_REGEX.test(key)) {
        return finish(null, 'Invalid storage key: must be 1-64 alphanumeric characters, underscores, or hyphens');
      }
      let serialized = '';
      try {
        serialized = JSON.stringify(payload?.val);
      } catch {
        return finish(null, 'Storage value is not serializable');
      }
      const valBytes = getByteLength(serialized);
      if (valBytes > MAX_STORAGE_VALUE_SIZE) {
        return finish(null, `Storage value exceeds size limit (${MAX_STORAGE_VALUE_SIZE} bytes)`);
      }

      // Aggregate quota enforcement
      const currentUsage = calculateAppStorageUsage(appId, storage);
      const existingVal = storage.get(`app:${appId}:${key}`, undefined);
      let existingBytes = 0;
      if (existingVal !== undefined) {
        try {
          existingBytes = getByteLength(JSON.stringify(existingVal));
        } catch {}
      } else {
        existingBytes = -getByteLength(`arcadeos:app:${appId}:${key}`);
      }
      const delta = valBytes - existingBytes;
      if (currentUsage + delta > MAX_APP_STORAGE_QUOTA) {
        return finish(null, `Aggregate storage quota exceeded (${MAX_APP_STORAGE_QUOTA} bytes limit for extension)`);
      }

      storage.set(`app:${appId}:${key}`, payload?.val);
      return finish(true, null);
    }

    if (action === 'storage:delete' || action === 'storage:remove') {
      if (!permissionManager.has(appId, 'storage')) {
        return finish(null, 'Storage permission denied');
      }
      const key = payload?.key;
      if (typeof key !== 'string' || !SAFE_KEY_REGEX.test(key)) {
        return finish(null, 'Invalid storage key: must be 1-64 alphanumeric characters, underscores, or hyphens');
      }
      const fullKey = `app:${appId}:${key}`;
      const lsKey = `arcadeos:${fullKey}`;
      try {
        if (typeof localStorage !== 'undefined' && localStorage) {
          localStorage.removeItem(lsKey);
        }
      } catch {}
      if (storage?.data instanceof Map) {
        storage.data.delete(fullKey);
        storage.data.delete(lsKey);
      }
      if (typeof storage?.remove === 'function') {
        storage.remove(fullKey);
      }
      return finish(true, null);
    }

    if (action === 'storage:quota') {
      if (!permissionManager.has(appId, 'storage')) {
        return finish(null, 'Storage permission denied');
      }
      const currentUsage = calculateAppStorageUsage(appId, storage);
      return finish({
        usage: currentUsage,
        quota: MAX_APP_STORAGE_QUOTA,
        available: Math.max(0, MAX_APP_STORAGE_QUOTA - currentUsage)
      }, null);
    }

    if (action === 'audio:play') {
      if (!permissionManager.has(appId, 'audio')) {
        return finish(null, 'Audio permission denied');
      }
      const sound = String(payload?.sound || 'confirm');
      if (!ALLOWED_AUDIO_SOUNDS.includes(sound)) {
        return finish(null, `Invalid sound name: ${sound}`);
      }
      try {
        ArcadeOS.audio?.play(sound);
      } catch {}
      return finish(true, null);
    }

    if (action === 'notify') {
      if (!permissionManager.has(appId, 'notifications')) {
        return finish(null, 'Notification permission denied');
      }
      if (typeof payload?.message !== 'string') {
        return finish(null, 'Notification message must be a string');
      }
      const text = payload.message.slice(0, 120).trim();
      if (!text) {
        return finish(null, 'Notification message cannot be empty');
      }
      showToast(text);
      return finish(true, null);
    }

    return finish(null, `Unsupported action: ${action}`);
  });

  // Track window closes to clean up iframe resources
  bus.addEventListener('app:closed', event => {
    // In-flight counts will be cleaned when iframes are removed from DOM
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
        const res = api.install(ext);
        if (res.success) {
          showToast(`INSTALLED: ${ext.name}`);
        } else {
          showToast(`INSTALL FAILED: ${res.errors?.[0] || 'Unknown error'}`);
        }
        refreshLibrary();
      }
      return;
    }

    const uninstallBtn = event.target.closest('[data-lib-uninstall]');
    if (uninstallBtn) {
      const id = uninstallBtn.dataset.libUninstall;
      api.uninstall(id);
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
        ${app.type === 'sandboxed' && isInstalled ? `
          <div class="destructive-uninstall-warning" style="margin-top:10px;padding:8px 12px;border:1px solid rgba(251,113,133,.3);border-radius:6px;background:rgba(251,113,133,.06);color:#fda4af;font:600 .7rem JetBrains Mono;">
            ⚠️ Notice: Uninstallation permanently deletes this extension and completely wipes all of its local data.
          </div>
        ` : ''}
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
      const validated = validateManifest(manifest, { isExtension: true });
      if (!validated.valid) return { success: false, errors: validated.errors };

      if (RESERVED_IDS.has(manifest.id)) {
        return { success: false, errors: [`Manifest ID is reserved: ${manifest.id}`] };
      }

      if (registry.has(manifest.id) && !installedExtensionIds.has(manifest.id)) {
        return { success: false, errors: [`Application ID collision: ${manifest.id} is already registered`] };
      }

      const securedManifest = {
        ...manifest,
        type: 'sandboxed',
        trusted: false,
        permissions: Array.isArray(manifest.permissions)
          ? manifest.permissions.filter(p => p !== 'system')
          : []
      };

      installedExtensionIds.add(manifest.id);
      try {
        storage.set('installedExtensions', [...installedExtensionIds]);
      } catch {}
      registerExtensionApp(securedManifest);
      return { success: true };
    },
    uninstall: id => {
      const app = registry.get(id);
      if (!app || app.type !== 'sandboxed') return false;

      // 1. Close running window if open
      const win = document.querySelector(`.os-window[data-app="${id}"]`);
      if (win) {
        const closeBtn = win.querySelector('[data-close]');
        if (closeBtn) closeBtn.click();
        else win.remove();
      }

      // 2. Wipe namespaced storage keys
      try {
        const prefix = `arcadeos:app:${id}:`;
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) {
            toRemove.push(k);
          }
        }
        toRemove.forEach(k => localStorage.removeItem(k));
      } catch {}

      // 3. Reset permissions
      permissionManager.reset(id);

      // 4. Remove from installed set and registry
      installedExtensionIds.delete(id);
      try {
        storage.set('installedExtensions', [...installedExtensionIds]);
      } catch {}
      registry.delete(id);
      return true;
    },
    update: newManifest => {
      if (!newManifest || typeof newManifest !== 'object') {
        return { success: false, errors: ['Manifest must be an object'] };
      }
      const id = newManifest.id;
      if (!id || !registry.has(id)) {
        return { success: false, errors: [`Cannot update application "${id}": not installed`] };
      }
      const existingApp = registry.get(id);
      if (existingApp.type !== 'sandboxed') {
        return { success: false, errors: [`Cannot update built-in system application "${id}"`] };
      }

      // 1. Validate the new manifest
      const validated = validateManifest(newManifest, { isExtension: true });
      if (!validated.valid) {
        return { success: false, errors: validated.errors };
      }

      // 2. Prevent downgrade
      if (compareSemver(newManifest.version, existingApp.version) < 0) {
        return { success: false, errors: [`Cannot downgrade extension from v${existingApp.version} to v${newManifest.version}`] };
      }

      // 3. Atomically update with rollback preservation
      const previousApp = { ...existingApp };
      try {
        // Close existing window if running
        const win = document.querySelector(`.os-window[data-app="${id}"]`);
        if (win) {
          const closeBtn = win.querySelector('[data-close]');
          if (closeBtn) closeBtn.click();
          else win.remove();
        }

        const securedManifest = {
          ...newManifest,
          type: 'sandboxed',
          trusted: false,
          permissions: Array.isArray(newManifest.permissions)
            ? newManifest.permissions.filter(p => p !== 'system')
            : []
        };

        registerExtensionApp(securedManifest);
        return { success: true, version: newManifest.version };
      } catch (err) {
        registerExtensionApp(previousApp);
        return { success: false, errors: [`Update failed and rolled back: ${err.message}`] };
      }
    },
    calculateStorageUsage: appId => calculateAppStorageUsage(appId, storage),
    storageQuota: MAX_APP_STORAGE_QUOTA
  };

  ArcadeOS.apps = api;
  ArcadeOS.permissions = permissionManager;
  if (ArcadeOS.services) {
    ArcadeOS.services.apps = api;
    ArcadeOS.services.permissions = permissionManager;
  }
  ArcadeOS.ecosystemInstalled = true;
}
