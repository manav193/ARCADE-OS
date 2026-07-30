const NAV_GROUPS = [
  { label: 'PLAY', items: [
    ['snake', '◉', 'Snake'], ['breakout', '▤', 'Breakout'], ['pong', '↔', 'Pong'],
    ['blockdrop', '▦', 'Block Drop'], ['voidinvaders', '⌁', 'Invaders'], ['vectordrift', '△', 'Drift']
  ]},
  { label: 'SYSTEM', items: [
    ['library', '▦', 'Library'], ['terminal', '>_', 'Terminal'], ['stats', '▥', 'Stats'],
    ['music', '♪', 'Music'], ['developer', '⌘', 'Developer'], ['settings', '⚙', 'Settings']
  ]},
  { label: 'INTELLIGENCE', items: [
    ['nimo', 'N', 'NIMO'], ['overdrive', 'Ø', 'Overdrive'], ['services', '◇', 'Services'], ['diagnostics', '◎', 'Diagnostics']
  ]}
];

const FLAT_ITEMS = NAV_GROUPS.flatMap(group => group.items.map(item => ({ group: group.label, id: item[0], icon: item[1], label: item[2] })));

export function installNavigationShell(ArcadeOS) {
  if (!ArcadeOS || document.querySelector('[data-command-rail]')) return;

  const rail = document.createElement('aside');
  rail.className = 'command-rail';
  rail.dataset.commandRail = '';
  rail.setAttribute('aria-label', 'ArcadeOS command rail');
  rail.innerHTML = renderRail(ArcadeOS);
  document.querySelector('[data-desktop]')?.appendChild(rail);

  const scrim = document.createElement('button');
  scrim.className = 'command-rail-scrim';
  scrim.dataset.commandRailScrim = '';
  scrim.setAttribute('aria-label', 'Close navigation');
  document.querySelector('[data-desktop]')?.appendChild(scrim);

  const mobileToggle = document.createElement('button');
  mobileToggle.className = 'command-rail-toggle';
  mobileToggle.dataset.commandRailToggle = '';
  mobileToggle.setAttribute('aria-label', 'Toggle ArcadeOS navigation');
  mobileToggle.setAttribute('aria-expanded', 'false');
  mobileToggle.innerHTML = '<span></span><span></span><span></span>';
  document.querySelector('.topbar')?.appendChild(mobileToggle);

  const state = {
    favorites: new Set(ArcadeOS.storage?.get('commandRailFavorites', ['snake', 'blockdrop', 'nimo']) || []),
    recents: ArcadeOS.storage?.get('commandRailRecents', []) || [],
    collapsed: false
  };

  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-command-rail-toggle],[data-command-rail-collapse]');
    if (toggle) {
      setCollapsed(!rail.classList.contains('is-collapsed'));
      return;
    }

    if (event.target.closest('[data-command-rail-scrim]')) {
      setCollapsed(true);
      return;
    }

    const favorite = event.target.closest('[data-rail-favorite]');
    if (favorite) {
      event.stopPropagation();
      toggleFavorite(favorite.dataset.railFavorite);
      return;
    }

    const launcher = event.target.closest('[data-rail-open]');
    if (launcher) {
      openFromRail(launcher.dataset.railOpen);
      return;
    }

    if (event.target.closest('[data-rail-home]')) {
      document.querySelectorAll('.os-window').forEach(win => win.classList.add('is-min'));
      markActive();
    }

    if (event.target.closest('[data-rail-clear-search]')) {
      const input = rail.querySelector('[data-rail-search]');
      if (input) input.value = '';
      applySearch('');
      input?.focus();
    }
  });

  document.addEventListener('input', event => {
    if (event.target.matches('[data-rail-search]')) applySearch(event.target.value);
  });

  document.addEventListener('keydown', event => {
    const editable = event.target.matches('input,textarea,[contenteditable="true"]');
    if (!editable && event.key === '/' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (matchMedia('(max-width: 860px)').matches) setCollapsed(false);
      rail.querySelector('[data-rail-search]')?.focus();
    }
    if (event.altKey && /^[1-6]$/.test(event.key)) {
      event.preventDefault();
      openFromRail(FLAT_ITEMS[Number(event.key) - 1]?.id);
    }
    if (event.key === 'Escape' && matchMedia('(max-width: 860px)').matches && !rail.classList.contains('is-collapsed')) {
      setCollapsed(true);
    }
  });

  ArcadeOS.bus?.addEventListener('app:opened', event => {
    rememberRecent(event.detail?.id);
    markActive();
  });
  ArcadeOS.bus?.addEventListener('app:closed', markActive);

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  window.addEventListener('resize', syncResponsiveState, { passive: true });

  const stored = ArcadeOS.storage?.get('commandRailCollapsed', false);
  const mobile = matchMedia('(max-width: 860px)').matches;
  setCollapsed(stored || mobile, false);
  renderDynamicSections();
  updateStatus();
  markActive();

  ArcadeOS.navigation = {
    focusSearch: () => rail.querySelector('[data-rail-search]')?.focus(),
    open: id => openFromRail(id),
    collapse: value => setCollapsed(Boolean(value)),
    get favorites() { return [...state.favorites]; },
    get recents() { return [...state.recents]; }
  };
  if (ArcadeOS.services) ArcadeOS.services.navigation = ArcadeOS.navigation;

  function openFromRail(id) {
    if (!id || !ArcadeOS.registry?.has(id)) return;
    ArcadeOS.openApp(id);
    rememberRecent(id);
    if (matchMedia('(max-width: 860px)').matches) setCollapsed(true);
  }

  function setCollapsed(collapsed, persist = true) {
    state.collapsed = collapsed;
    rail.classList.toggle('is-collapsed', collapsed);
    document.body.classList.toggle('rail-collapsed', collapsed);
    document.body.classList.toggle('rail-open-mobile', !collapsed && matchMedia('(max-width: 860px)').matches);
    mobileToggle.setAttribute('aria-expanded', String(!collapsed));
    if (persist && !matchMedia('(max-width: 860px)').matches) ArcadeOS.storage?.set('commandRailCollapsed', collapsed);
  }

  function syncResponsiveState() {
    if (matchMedia('(max-width: 860px)').matches && !document.body.classList.contains('rail-open-mobile')) setCollapsed(true, false);
    else document.body.classList.remove('rail-open-mobile');
  }

  function rememberRecent(id) {
    if (!id || !ArcadeOS.registry?.has(id) || id === 'library') return;
    state.recents = [id, ...state.recents.filter(item => item !== id)].slice(0, 5);
    ArcadeOS.storage?.set('commandRailRecents', state.recents);
    renderDynamicSections();
  }

  function toggleFavorite(id) {
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    ArcadeOS.storage?.set('commandRailFavorites', [...state.favorites]);
    renderDynamicSections();
  }

  function renderDynamicSections() {
    const favoritesHost = rail.querySelector('[data-rail-favorites]');
    const recentsHost = rail.querySelector('[data-rail-recents]');
    if (favoritesHost) favoritesHost.innerHTML = renderCompactList([...state.favorites], 'No pinned apps');
    if (recentsHost) recentsHost.innerHTML = renderCompactList(state.recents, 'No recent apps');
    rail.querySelectorAll('[data-rail-open]').forEach(button => {
      const id = button.dataset.railOpen;
      const star = button.querySelector('[data-rail-favorite]');
      if (star) {
        star.classList.toggle('is-favorite', state.favorites.has(id));
        star.setAttribute('aria-label', state.favorites.has(id) ? `Unpin ${id}` : `Pin ${id}`);
      }
    });
    markActive();
  }

  function renderCompactList(ids, emptyText) {
    const items = ids.map(id => FLAT_ITEMS.find(item => item.id === id)).filter(Boolean);
    if (!items.length) return `<small class="command-rail__empty">${emptyText}</small>`;
    return items.map(item => `<button data-rail-open="${item.id}" title="${item.label}"><span>${item.icon}</span><b>${item.label}</b><i></i></button>`).join('');
  }

  function applySearch(raw) {
    const query = String(raw || '').trim().toLowerCase();
    rail.classList.toggle('is-searching', Boolean(query));
    rail.querySelector('[data-rail-clear-search]')?.toggleAttribute('hidden', !query);
    let matches = 0;
    rail.querySelectorAll('.command-rail__group[data-static-group] > button').forEach(button => {
      const haystack = `${button.dataset.railOpen} ${button.querySelector('b')?.textContent || ''}`.toLowerCase();
      const visible = !query || haystack.includes(query);
      button.hidden = !visible;
      if (visible) matches++;
    });
    const empty = rail.querySelector('[data-rail-search-empty]');
    if (empty) empty.hidden = matches > 0 || !query;
  }

  function markActive() {
    const visible = [...document.querySelectorAll('.os-window:not(.is-min)')];
    const open = new Set(visible.map(win => win.dataset.app));
    rail.querySelectorAll('[data-rail-open]').forEach(button => {
      const active = open.has(button.dataset.railOpen);
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const count = rail.querySelector('[data-open-window-count]');
    if (count) count.textContent = String(visible.length);
  }

  function updateStatus() {
    const online = navigator.onLine;
    const label = rail.querySelector('[data-rail-status]');
    if (label) label.textContent = online ? 'SYSTEM ONLINE' : 'OFFLINE MODE';
    rail.classList.toggle('is-offline', !online);
  }
}

function renderRail(ArcadeOS) {
  return `
    <div class="command-rail__head">
      <button class="command-rail__home" data-rail-home title="Show desktop"><span>A</span><b>ARCADEOS</b></button>
      <button class="command-rail__collapse" data-command-rail-collapse aria-label="Collapse navigation">‹</button>
    </div>
    <label class="command-rail__search">
      <span>⌕</span><input data-rail-search placeholder="Search apps" autocomplete="off" aria-label="Search ArcadeOS apps">
      <button type="button" data-rail-clear-search hidden aria-label="Clear search">×</button>
      <kbd>/</kbd>
    </label>
    <div class="command-rail__scroll">
      <section class="command-rail__group command-rail__dynamic" data-dynamic-group>
        <p>PINNED</p><div data-rail-favorites></div>
      </section>
      <section class="command-rail__group command-rail__dynamic" data-dynamic-group>
        <p>RECENT</p><div data-rail-recents></div>
      </section>
      ${NAV_GROUPS.map(group => `
        <section class="command-rail__group" data-static-group>
          <p>${group.label}</p>
          ${group.items.map(([id, icon, label], index) => `
            <button data-rail-open="${id}" aria-pressed="false" title="${label}${group.label === 'PLAY' ? ` · Alt+${index + 1}` : ''}">
              <span>${icon}</span><b>${label}</b><i></i><em data-rail-favorite="${id}" role="button" tabindex="-1">★</em>
            </button>
          `).join('')}
        </section>
      `).join('')}
      <small class="command-rail__search-empty" data-rail-search-empty hidden>No matching application.</small>
    </div>
    <div class="command-rail__footer">
      <span class="status-dot"></span><b data-rail-status>SYSTEM ONLINE</b>
      <span class="command-rail__window-count"><strong data-open-window-count>0</strong> OPEN</span>
    </div>
  `;
}