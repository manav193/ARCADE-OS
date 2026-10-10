# ArcadeOS

ArcadeOS is a standalone browser-based arcade operating system by **Manav Agarwal**.

It turns a webpage into a compact desktop environment with draggable application windows, local persistence, visual themes, a command shell, developer services and playable mini-apps.

## Runtime 2.2

The standalone migration now includes:

- Registry-driven application system
- System-wide event bus
- Namespaced local-first storage
- Draggable, focusable, minimizable and maximizable windows
- Safe application cleanup lifecycle
- Terminal app launcher commands
- Persistent Notes application
- Full System Settings and Cabinet Customizer
- Developer Mode, Event Monitor and Storage Inspector
- System Diagnostics and Achievements
- Service Access runtime catalog
- Procedural Web Audio sound engine
- Persistent app-usage statistics and game high scores
- Neon Snake
- Neon Breakout
- Neon Pong with system AI
- Block Drop
- Void Invaders
- Vector Drift
- Shared game session controls, pause/resume overlay and Escape shortcuts
- Mobile touch D-pad and action button HUD
- Global Web Audio HUD with volume mixer and master mute
- NIMO intelligence and hidden Overdrive developer core
- Grouped command rail navigation with keyboard shortcuts
- Custom per-game reactive animations and particle motion
- Persistent workspace sessions with automatic state restoration
- Focused game input ownership and background loop suspension guards
- Extensible Application Manifest v1.0 specification and validation
- Scoped capability and permission management with runtime gating and user revocation
- Sandboxed iframe extension runner (`sandbox="allow-scripts"`) with postMessage RPC bridge
- Modernized App Library with category tabs, search, permission inspector, and catalog
- Responsive static deployment
- Zero-framework HTML, CSS and JavaScript architecture

## Run locally

No build step is required.

```bash
npx serve .
```

Then open the local URL printed by the server.

## Terminal commands

```text
help
apps
about
date
theme
open library
open snake
open breakout
open pong
open blockdrop
open voidinvaders
open vectordrift
open developer
open services
open stats
open notes
clear
```

## Deploy

The repository can be deployed directly as a static project on Vercel, Netlify, Cloudflare Pages or GitHub Pages. `vercel.json` is included.

## Architecture

```text
index.html             Standalone desktop shell and module wiring
styles.css             Core desktop, windows, dock and base apps
app.js                 Registry, event bus, storage and window manager
system-apps.js         Settings, Developer Mode, diagnostics and customizer
system-apps.css        System and developer application styles
arcade-expansion.js    Extra games, stats, audio and service-access layer
arcade-expansion.css   Expansion application and game styles
arcade-music.js        Procedural Web Audio music engine
arcade-music.css       Music mixer application styles
game-controls.js       Shared game pause/resume, touch d-pad & audio HUD
game-controls.css      Game control overlay and mobile D-pad styles
nimo-overdrive.js      NIMO intelligence and Overdrive cheat modifiers
nimo-overdrive.css     NIMO assistant and Overdrive core styles
navigation-shell.js    Grouped command rail and quick launcher
navigation-shell.css   Command rail navigation styles
game-animations.js     Per-game particle and motion engine
game-animations.css    Dynamic game visual themes and effects
workspace-session.js   Persistent window geometry and session restore
workspace-session.css  Workspace controls and mobile adaptations
input-ownership-guard.js  Focused window keyboard input ownership guard
game-loop-guard.js     Animation frame and timeout suspension guard
cheat-score-guard.js   Fair-play score isolation guard
window-state-sync.js   Centralized window state synchronization
app-ecosystem.js       Manifest schema, permissions, sandboxed container & App Library
app-ecosystem.css      App Library UI, inspector, and category styles
docs/APP-SDK.md        ArcadeOS App Manifest and Extension SDK documentation
vercel.json            Static deployment configuration
```

The public runtime exposes `window.ArcadeOS` with `openApp`, `registerApp`, `registry`, `bus`, `storage`, `system`, `audio`, `music`, `controls`, `navigation`, `animations`, `workspaceSession`, `inputGuard`, `loopGuard`, `services`, and `ecosystem`. New applications can be registered without rewriting the desktop shell.

## Migration status

ArcadeOS began as the flagship interactive experience inside Manav's portfolio. It now runs as an independent product repository with its own application runtime, games, developer tooling, settings, diagnostics, audio service and persistent state. Portfolio-specific navigation remains outside this repository by design.

## Author

Manav Agarwal — Creative Frontend Developer and UI/UX Designer
