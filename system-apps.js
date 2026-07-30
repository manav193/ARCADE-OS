const THEMES = [
  { id: '', name: 'Cyan Grid' },
  { id: 'theme-violet', name: 'Violet Core' },
  { id: 'theme-amber', name: 'Amber Alert' }
];

export function installSystemApps(ArcadeOS) {
  if (!ArcadeOS || ArcadeOS.systemAppsInstalled) return;
  const { registerApp, bus, storage, registry } = ArcadeOS;

  const settingRow = (title, description, control) => `
    <div class="setting">
      <div><strong>${title}</strong><small>${description}</small></div>
      ${control}
    </div>`;

  registerApp({
    id: 'settings', icon: '⚙', title: 'SYSTEM CONFIG', name: 'System Config',
    description: 'Appearance, accessibility, storage and boot controls',
    render: () => `
      <div class="system-panel">
        <div class="system-panel__hero"><span>ARCADEOS CONTROL CENTER</span><strong>System Settings</strong><small>Changes are stored locally on this device.</small></div>
        <div class="settings-list">
          ${settingRow('Visual theme', 'Select the system accent palette', `<select data-setting-theme>${THEMES.map(theme => `<option value="${theme.id}" ${storage.get('theme','') === theme.id ? 'selected' : ''}>${theme.name}</option>`).join('')}</select>`)}
          ${settingRow('Interface motion', 'Reduce window and boot animations', `<label class="switch"><input type="checkbox" data-setting-motion ${storage.get('reduceMotion',false) ? 'checked' : ''}><span></span></label>`)}
          ${settingRow('Boot sequence', 'Show initialization screen on each reload', `<label class="switch"><input type="checkbox" data-setting-boot ${storage.get('showBoot',true) ? 'checked' : ''}><span></span></label>`)}
          ${settingRow('Sound effects', 'Enable interface audio hooks for future apps', `<label class="switch"><input type="checkbox" data-setting-sound ${storage.get('sound',false) ? 'checked' : ''}><span></span></label>`)}
          ${settingRow('Developer Mode', 'Expose diagnostics, event monitor and runtime tools', `<button data-open="developer">OPEN</button>`)}
          ${settingRow('Local system data', 'Export, import or reset ArcadeOS preferences', `<div class="setting-actions"><button data-export-system>EXPORT</button><button data-import-system>IMPORT</button><button class="danger" data-reset-system>RESET</button></div>`)}
        </div>
        <input type="file" accept="application/json" data-import-file hidden>
      </div>`
  });

  registerApp({
    id: 'developer', icon: '⌘', title: 'DEVELOPER MODE', name: 'Developer Mode',
    description: 'Runtime inspector, event stream and system commands',
    render: () => `
      <div class="developer-shell">
        <aside class="developer-sidebar">
          <span class="developer-badge">DEV MODE</span>
          <button data-dev-tab="overview" class="is-active">Overview</button>
          <button data-dev-tab="events">Event Monitor</button>
          <button data-dev-tab="storage">Storage Inspector</button>
          <button data-dev-tab="commands">Runtime Commands</button>
        </aside>
        <section class="developer-content" data-dev-content>${renderOverview(registry, storage)}</section>
      </div>`
  });

  registerApp({
    id: 'diagnostics', icon: '⌁', title: 'SYSTEM DIAGNOSTICS', name: 'Diagnostics',
    description: 'Browser capabilities and ArcadeOS health checks',
    render: () => renderDiagnostics(registry, storage)
  });

  registerApp({
    id: 'achievements', icon: '★', title: 'ACHIEVEMENTS', name: 'Achievements',
    description: 'Local milestones from ArcadeOS activity',
    render: () => renderAchievements(storage)
  });

  registerApp({
    id: 'customizer', icon: '◩', title: 'CABINET CUSTOMIZER', name: 'Customizer',
    description: 'Wallpaper density and desktop presentation controls',
    render: () => `
      <div class="settings-list">
        ${settingRow('Grid density', 'Change wallpaper grid spacing', `<input type="range" min="28" max="72" value="${storage.get('gridSize',42)}" data-grid-size>`)}
        ${settingRow('Ambient glow', 'Control background light intensity', `<input type="range" min="0" max="100" value="${storage.get('glow',35)}" data-glow>`)}
        ${settingRow('Desktop hero', 'Show or hide the main ArcadeOS heading', `<label class="switch"><input type="checkbox" data-hero-toggle ${storage.get('showHero',true) ? 'checked' : ''}><span></span></label>`)}
        ${settingRow('Restore defaults', 'Reset visual customization only', `<button data-reset-visuals>RESTORE</button>`)}
      </div>`
  });

  const eventLog = [];
  ['system:ready','app:opened','app:closed'].forEach(type => bus.addEventListener(type, event => {
    eventLog.unshift({ type, detail: event.detail || null, time: new Date().toLocaleTimeString() });
    eventLog.splice(40);
    storage.set('eventLog', eventLog);
    trackAchievement(type, event.detail, storage);
  }));

  document.addEventListener('change', event => handleChange(event, storage, bus));
  document.addEventListener('input', event => handleInput(event, storage));
  document.addEventListener('click', event => handleSystemClick(event, ArcadeOS, eventLog));

  applyPreferences(storage);
  ArcadeOS.systemAppsInstalled = true;
  ArcadeOS.system = { applyPreferences: () => applyPreferences(storage), runDiagnostics: () => collectDiagnostics(registry, storage) };
}

function handleChange(event, storage, bus) {
  if (event.target.matches('[data-setting-theme]')) {
    document.body.classList.remove('theme-violet','theme-amber');
    if (event.target.value) document.body.classList.add(event.target.value);
    storage.set('theme', event.target.value);
    bus.dispatchEvent(new CustomEvent('settings:changed',{detail:{key:'theme',value:event.target.value}}));
  }
  if (event.target.matches('[data-setting-motion]')) {
    document.body.classList.toggle('reduce-motion', event.target.checked);
    storage.set('reduceMotion', event.target.checked);
  }
  if (event.target.matches('[data-setting-boot]')) storage.set('showBoot', event.target.checked);
  if (event.target.matches('[data-setting-sound]')) storage.set('sound', event.target.checked);
  if (event.target.matches('[data-hero-toggle]')) {
    storage.set('showHero', event.target.checked);
    document.body.classList.toggle('hide-desktop-hero', !event.target.checked);
  }
  if (event.target.matches('[data-import-file]') && event.target.files?.[0]) importSystemFile(event.target.files[0], storage);
}

function handleInput(event, storage) {
  if (event.target.matches('[data-grid-size]')) {
    storage.set('gridSize', Number(event.target.value));
    document.documentElement.style.setProperty('--grid-size', `${event.target.value}px`);
  }
  if (event.target.matches('[data-glow]')) {
    storage.set('glow', Number(event.target.value));
    document.documentElement.style.setProperty('--ambient-opacity', String(Number(event.target.value) / 100));
  }
}

function handleSystemClick(event, ArcadeOS, eventLog) {
  const { storage, registry, openApp, bus } = ArcadeOS;
  const tab = event.target.closest('[data-dev-tab]');
  if (tab) {
    const shell = tab.closest('.developer-shell');
    shell.querySelectorAll('[data-dev-tab]').forEach(button => button.classList.toggle('is-active', button === tab));
    const content = shell.querySelector('[data-dev-content]');
    const id = tab.dataset.devTab;
    content.innerHTML = id === 'overview' ? renderOverview(registry, storage)
      : id === 'events' ? renderEvents(eventLog.length ? eventLog : storage.get('eventLog',[]))
      : id === 'storage' ? renderStorage(storage)
      : renderCommands();
  }
  if (event.target.closest('[data-dev-refresh]')) event.target.closest('.os-window').querySelector('[data-dev-content]').innerHTML = renderOverview(registry, storage);
  if (event.target.closest('[data-dev-clear-events]')) { eventLog.length = 0; storage.set('eventLog',[]); event.target.closest('.os-window').querySelector('[data-dev-content]').innerHTML = renderEvents([]); }
  if (event.target.closest('[data-dev-open-all]')) [...registry.keys()].filter(id => id !== 'library').slice(0,6).forEach((id,index)=>setTimeout(()=>openApp(id),index*90));
  if (event.target.closest('[data-dev-close-all]')) document.querySelectorAll('.os-window').forEach(win => { if(win.dataset.app !== 'developer') win.querySelector('[data-close]')?.click(); });
  if (event.target.closest('[data-dev-test-event]')) bus.dispatchEvent(new CustomEvent('developer:test',{detail:{source:'Developer Mode'}}));
  if (event.target.closest('[data-export-system]')) exportSystem(storage);
  if (event.target.closest('[data-import-system]')) event.target.closest('.os-window').querySelector('[data-import-file]')?.click();
  if (event.target.closest('[data-reset-system]')) { if(confirm('Reset all ArcadeOS local data?')) { storage.clear(); location.reload(); } }
  if (event.target.closest('[data-reset-visuals]')) { ['gridSize','glow','showHero','theme','reduceMotion'].forEach(key=>localStorage.removeItem(`arcadeos:${key}`)); location.reload(); }
}

function applyPreferences(storage) {
  const theme = storage.get('theme','');
  document.body.classList.remove('theme-violet','theme-amber');
  if (theme) document.body.classList.add(theme);
  document.body.classList.toggle('reduce-motion', storage.get('reduceMotion',false));
  document.body.classList.toggle('hide-desktop-hero', !storage.get('showHero',true));
  document.documentElement.style.setProperty('--grid-size', `${storage.get('gridSize',42)}px`);
  document.documentElement.style.setProperty('--ambient-opacity', String(storage.get('glow',35)/100));
  if (!storage.get('showBoot',true)) document.querySelector('[data-boot]')?.classList.add('is-done');
}

function collectDiagnostics(registry, storage) {
  return [
    ['Runtime', 'PASS', 'ArcadeOS JavaScript initialized'],
    ['App Registry', registry.size ? 'PASS' : 'FAIL', `${registry.size} applications registered`],
    ['Local Storage', storageAvailable() ? 'PASS' : 'WARN', storageAvailable() ? 'Persistence available' : 'Storage blocked'],
    ['Canvas 2D', document.createElement('canvas').getContext('2d') ? 'PASS' : 'FAIL', 'Game renderer capability'],
    ['Pointer Events', 'PointerEvent' in window ? 'PASS' : 'WARN', 'Window drag input'],
    ['Reduced Motion', matchMedia('(prefers-reduced-motion: reduce)').matches ? 'INFO' : 'PASS', 'System preference detected'],
    ['Viewport', innerWidth >= 900 ? 'PASS' : 'INFO', `${innerWidth} × ${innerHeight}`]
  ];
}

function renderDiagnostics(registry, storage) {
  return `<div class="diagnostic-grid">${collectDiagnostics(registry,storage).map(([name,status,detail])=>`<article><span class="diag-status diag-${status.toLowerCase()}">${status}</span><strong>${name}</strong><small>${detail}</small></article>`).join('')}</div>`;
}

function renderOverview(registry, storage) {
  return `<div class="developer-overview"><div class="metric-grid"><article><span>REGISTERED APPS</span><strong>${registry.size}</strong></article><article><span>OPEN WINDOWS</span><strong>${document.querySelectorAll('.os-window').length}</strong></article><article><span>STORAGE KEYS</span><strong>${Object.keys(localStorage).filter(k=>k.startsWith('arcadeos:')).length}</strong></article><article><span>RUNTIME</span><strong>2.1</strong></article></div><div class="developer-actions"><button data-dev-refresh>REFRESH</button><button data-dev-open-all>OPEN APP SET</button><button data-dev-close-all>CLOSE WINDOWS</button><button data-dev-test-event>EMIT TEST EVENT</button></div><pre class="runtime-block">${escapeHtml(JSON.stringify({userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],online:navigator.onLine,language:navigator.language},null,2))}</pre></div>`;
}

function renderEvents(events) {
  return `<div class="event-monitor"><div class="developer-actions"><button data-dev-clear-events>CLEAR LOG</button></div>${events.length ? events.map(item=>`<div><time>${item.time}</time><strong>${escapeHtml(item.type)}</strong><code>${escapeHtml(JSON.stringify(item.detail))}</code></div>`).join('') : '<p>No runtime events captured yet.</p>'}</div>`;
}

function renderStorage(storage) {
  const entries = Object.keys(localStorage).filter(key=>key.startsWith('arcadeos:')).map(key=>[key,localStorage.getItem(key)]);
  return `<div class="storage-inspector">${entries.length ? entries.map(([key,value])=>`<article><strong>${escapeHtml(key)}</strong><pre>${escapeHtml(value)}</pre></article>`).join('') : '<p>No ArcadeOS storage entries.</p>'}</div>`;
}

function renderCommands() {
  return `<div class="command-cards"><article><code>ArcadeOS.openApp('snake')</code><span>Launch an application</span></article><article><code>ArcadeOS.registry</code><span>Inspect registered applications</span></article><article><code>ArcadeOS.bus.dispatchEvent(...)</code><span>Emit a runtime event</span></article><article><code>ArcadeOS.storage.get('key')</code><span>Read namespaced state</span></article></div>`;
}

function renderAchievements(storage) {
  const unlocked = storage.get('achievements',{});
  const definitions = [['first-boot','FIRST BOOT','Initialize ArcadeOS'],['app-explorer','APP EXPLORER','Open five different applications'],['game-on','GAME ON','Launch an arcade game'],['developer','SYSTEM OPERATOR','Open Developer Mode']];
  return `<div class="achievement-grid">${definitions.map(([id,title,desc])=>`<article class="${unlocked[id]?'is-unlocked':''}"><span>${unlocked[id]?'★':'◇'}</span><strong>${title}</strong><small>${desc}</small></article>`).join('')}</div>`;
}

function trackAchievement(type, detail, storage) {
  const achievements = storage.get('achievements',{});
  const opened = storage.get('openedApps',[]);
  achievements['first-boot'] = true;
  if(type === 'app:opened' && detail?.id){ if(!opened.includes(detail.id)) opened.push(detail.id); storage.set('openedApps',opened); if(opened.length>=5) achievements['app-explorer']=true; if(['snake','breakout','pong'].includes(detail.id)) achievements['game-on']=true; if(detail.id==='developer') achievements['developer']=true; }
  storage.set('achievements',achievements);
}

function exportSystem(storage) {
  const data = {};
  Object.keys(localStorage).filter(key=>key.startsWith('arcadeos:')).forEach(key=>data[key]=localStorage.getItem(key));
  const blob = new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),data},null,2)],{type:'application/json'});
  const link = document.createElement('a'); link.href=URL.createObjectURL(blob); link.download='arcadeos-settings.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

function importSystemFile(file, storage) {
  const reader = new FileReader(); reader.onload=()=>{try{const payload=JSON.parse(reader.result);Object.entries(payload.data||{}).forEach(([key,value])=>{if(key.startsWith('arcadeos:'))localStorage.setItem(key,value)});location.reload()}catch{alert('Invalid ArcadeOS settings file.')}};reader.readAsText(file);
}
function storageAvailable(){try{const key='__arcade_test__';localStorage.setItem(key,'1');localStorage.removeItem(key);return true}catch{return false}}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))}
