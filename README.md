# ArcadeOS

ArcadeOS is a standalone browser-based arcade operating system by **Manav Agarwal**.

It turns a webpage into a compact desktop environment with draggable application windows, local persistence, visual themes, a command shell and playable mini-apps.

## Core 2.0

The first migration phase separated ArcadeOS from the portfolio. Core 2.0 begins the deeper product migration with an independent application runtime:

- Registry-driven application system
- System event bus
- Namespaced local-first storage adapter
- Draggable, focusable, minimizable and maximizable windows
- Safe application cleanup lifecycle
- Terminal app launcher commands
- Persistent Notes application
- Theme, motion and storage controls
- Neon Snake
- Neon Breakout
- Neon Pong with system AI
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
open notes
clear
```

## Deploy

The repository can be deployed directly as a static project on Vercel, Netlify, Cloudflare Pages or GitHub Pages. `vercel.json` is included.

## Architecture

```text
index.html   Standalone desktop shell and window template
styles.css   Visual system, windows, dock and applications
app.js       Registry, event bus, storage, window manager and apps
vercel.json  Static deployment configuration
```

The public runtime exposes `window.ArcadeOS` with `openApp`, `registerApp`, `registry`, `bus` and `storage`, allowing future applications to be plugged in without rewriting the desktop shell.

## Migration status

ArcadeOS began as the flagship interactive experience inside Manav's portfolio. This repository now contains an independent functional edition. The current phase migrates product capabilities rather than copying portfolio-specific navigation and presentation code. Additional legacy games, cabinet hardware controls and developer tooling can now be ported against the standalone registry.

## Author

Manav Agarwal — Creative Frontend Developer and UI/UX Designer