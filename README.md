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
vercel.json            Static deployment configuration
```

The public runtime exposes `window.ArcadeOS` with `openApp`, `registerApp`, `registry`, `bus`, `storage`, `system`, `audio` and `services`. New applications can be registered without rewriting the desktop shell.

## Migration status

ArcadeOS began as the flagship interactive experience inside Manav's portfolio. It now runs as an independent product repository with its own application runtime, games, developer tooling, settings, diagnostics, audio service and persistent state. Portfolio-specific navigation remains outside this repository by design.

## Author

Manav Agarwal — Creative Frontend Developer and UI/UX Designer
