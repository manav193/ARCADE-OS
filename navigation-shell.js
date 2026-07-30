const NAV_GROUPS = [
  {
    label: 'PLAY',
    items: [
      ['snake', '◉', 'Snake'],
      ['breakout', '▤', 'Breakout'],
      ['pong', '↔', 'Pong'],
      ['blockdrop', '▦', 'Block Drop'],
      ['voidinvaders', '⌁', 'Invaders'],
      ['vectordrift', '△', 'Drift']
    ]
  },
  {
    label: 'SYSTEM',
    items: [
      ['library', '▦', 'Library'],
      ['terminal', '>_', 'Terminal'],
      ['stats', '▥', 'Stats'],
      ['music', '♪', 'Music'],
      ['developer', '⌘', 'Developer'],
      ['settings', '⚙', 'Settings']
    ]
  },
  {
    label: 'INTELLIGENCE',
    items: [
      ['nimo', 'N', 'NIMO'],
      ['overdrive', 'Ø', 'Overdrive'],
      ['services', '◇', 'Services'],
      ['diagnostics', '◎', 'Diagnostics']
    ]
  }
];

export function installNavigationShell(ArcadeOS) {
  if (!ArcadeOS || document.querySelector('[data-command-rail]')) return;

  const rail = document.createElement('aside');
  rail.className = 'command-rail';
  rail.dataset.commandRail = '';
  rail.setAttribute('aria-label', 'ArcadeOS command rail');
  rail.innerHTML = renderRail();
  document.querySelector('[data-desktop]')?.appendChild(rail);

  const mobileToggle = document.createElement('button');
  mobileToggle.className = 'command-rail-toggle';
  mobileToggle.dataset.commandRailToggle = '';
  mobileToggle.setAttribute('aria-label', 'Toggle ArcadeOS navigation');
  mobileToggle.innerHTML = '<span></span><span></span><span></span>';
  document.querySelector('.topbar')?.appendChild(mobileToggle);

  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-command-rail-toggle],[data-command-rail-collapse]');
    if (toggle) {
      const collapsed = rail.classList.toggle('is-collapsed');
      document.body.classList.toggle('rail-collapsed', collapsed);
      ArcadeOS.storage?.set('commandRailCollapsed', collapsed);
      return;
    }

    const launcher = event.target.closest('[data-rail-open]');
    if (launcher) {
      ArcadeOS.openApp(launcher.dataset.railOpen);
      if (matchMedia('(max-width: 860px)').matches) rail.classList.add('is-collapsed');
      return;
    }

    if (event.target.closest('[data-rail-home]')) {
      document.querySelectorAll('.os-window').forEach(win => win.classList.add('is-min'));
      markActive();
    }
  });

  ArcadeOS.bus?.addEventListener('app:opened', markActive);
  ArcadeOS.bus?.addEventListener('app:closed', markActive);

  const stored = ArcadeOS.storage?.get('commandRailCollapsed', false);
  const mobile = matchMedia('(max-width: 860px)').matches;
  rail.classList.toggle('is-collapsed', stored || mobile);
  document.body.classList.toggle('rail-collapsed', stored || mobile);
  markActive();

  function markActive() {
    const open = new Set([...document.querySelectorAll('.os-window:not(.is-min)')].map(win => win.dataset.app));
    rail.querySelectorAll('[data-rail-open]').forEach(button => {
      button.classList.toggle('is-active', open.has(button.dataset.railOpen));
      button.setAttribute('aria-pressed', String(open.has(button.dataset.railOpen)));
    });
  }
}

function renderRail() {
  return `
    <div class="command-rail__head">
      <button class="command-rail__home" data-rail-home title="Show desktop"><span>A</span><b>ARCADEOS</b></button>
      <button class="command-rail__collapse" data-command-rail-collapse aria-label="Collapse navigation">‹</button>
    </div>
    <div class="command-rail__scroll">
      ${NAV_GROUPS.map(group => `
        <section class="command-rail__group">
          <p>${group.label}</p>
          ${group.items.map(([id, icon, label]) => `
            <button data-rail-open="${id}" aria-pressed="false" title="${label}">
              <span>${icon}</span><b>${label}</b><i></i>
            </button>
          `).join('')}
        </section>
      `).join('')}
    </div>
    <div class="command-rail__footer">
      <span class="status-dot"></span><b>SYSTEM ONLINE</b>
    </div>
  `;
}
