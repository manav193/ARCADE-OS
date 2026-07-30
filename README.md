# ArcadeOS

ArcadeOS is a standalone browser-based arcade operating system by **Manav Agarwal**.

It turns a normal webpage into a compact desktop environment with draggable application windows, local persistence, visual themes, a command shell and playable mini-apps.

## Included

- Desktop-style window manager
- App library and dock
- Interactive terminal
- Persistent Notes application
- System configuration and theme controls
- Neon Snake game
- Responsive desktop/mobile layout
- Zero-framework HTML, CSS and JavaScript architecture

## Run locally

No build step is required.

```bash
npx serve .
```

Then open the local URL printed by the server.

## Deploy

The repository can be deployed directly as a static project on Vercel, Netlify, Cloudflare Pages or GitHub Pages.

## Architecture

```text
index.html   Desktop shell and window template
styles.css   Visual system, windows, dock and applications
app.js       Window manager, state, terminal and mini-app logic
```

## Origin

ArcadeOS began as the flagship interactive experience inside Manav's portfolio. This repository contains the independent standalone edition so the product can evolve without coupling its release cycle to the portfolio.

## Author

Manav Agarwal — Creative Frontend Developer and UI/UX Designer
