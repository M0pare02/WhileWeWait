# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**While We Wait** is a mobile-first, browser-based collection of multiplayer mini-games designed to be played in-person by groups waiting together. No backend, no accounts — pure static HTML/CSS/JS.

There is no build step, no package manager, and no framework. Open `index.html` directly in a browser to run the app.

## Architecture

The app follows a flat multi-page structure:

```
index.html                  ← Home screen / game launcher
styles/main.css             ← Global design tokens and shared component styles
grid-grab/
  setup.html                ← Game-specific setup screen
  game.html                 ← Game-specific play screen
  styles/grid-grab.css      ← Game-specific styles (imports tokens from main.css via phone-shell)
  js/setup.js               ← Setup screen logic (player config → sessionStorage)
  js/engine.js              ← Pure game logic (no DOM), exposed as GGEngine IIFE
  js/game.js                ← Canvas rendering + input + animation (consumes GGEngine)
img/                        ← Splash/background images
```

**Data flow for Grid Grab:** `setup.js` serialises player config into `sessionStorage` (`gg_config`) and navigates to `game.html`. `game.js` reads it on load; if missing it redirects back to `setup.html`.

**Adding a new game** means creating a new subfolder with its own `setup.html` + `game.html` + CSS + JS files, following the same shell/header/footer pattern as Grid Grab. Register it in `index.html` by adding a `game-card` button to the grid.

## Design System

All games **must** import `../styles/main.css` before their own stylesheet. CSS custom properties defined in `:root` are the single source of truth for the visual language.

### Color Palette

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#12082A` | Page/screen background |
| `--bg-card` | `#1C1040` | Card and surface backgrounds |
| `--bg-nav` | `#0F0726` | Bottom nav and game headers |
| `--accent-primary` | `#6B4EFF` | Buttons, active borders, selected states |
| `--accent-glow` | `#9B7BFF` | SVG strokes, highlighted text, icon colors |
| `--text-white` | `#FFFFFF` | Primary text |
| `--text-muted` | `#9B8EC4` | Secondary text, inactive icons |
| `--text-label` | `#7B6B9E` | Section labels, placeholder text |
| `--gold` | `#FFD700` | Animated stars, "compete" badges, tie results |
| `--gold-light` | `#FFF0A0` | Gold highlights |
| `--nav-pill` | `#3D2B8E` | Active tab pill in bottom nav |
| `--border-card` | `rgba(107,78,255,0.15)` | Default card borders |

Body background is `#080418` (slightly darker than `--bg-base`). The `.phone-shell` wrapper constrains the layout to `max-width: 390px` and centers it.

### Player Colors (game palette)

Six fixed options for player assignment: `#FF6B6B` (coral), `#45B7D1` (sky), `#FFC947` (amber), `#4ECDC4` (mint), `#FF6B9D` (pink), `#98D856` (lime).

### Layout Conventions

- **Phone shell:** Every page uses `<div class="phone-shell">` as the root layout container.
- **Game screens** additionally add `.gg-shell` and set `height: 100dvh` so the layout fills the viewport without scrolling.
- **Game header:** `.gg-header` — 56px tall, `--bg-nav` background, centered title, back/quit button at left.
- **Section labels:** `.section__label` / `.gg-section__label` — 0.62rem, uppercase, `0.14em` letter-spacing, `--text-label` color.
- **Cards:** `border-radius: 16px`, `1px solid var(--border-card)`, `background: var(--bg-card)`.
- **Primary buttons:** `border-radius: 14px`, `background: var(--accent-primary)`, `box-shadow: 0 4px 20px rgba(107,78,255,0.5)`.
- **Hover glow pattern:** `border-color: rgba(107,78,255,0.7)` + `box-shadow: 0 0 0 1px rgba(107,78,255,0.4), 0 0 18px rgba(107,78,255,0.45), 0 0 40px rgba(107,78,255,0.2)`.
- **Overlays:** `background: rgba(18,8,42,0.88)` + `backdrop-filter: blur(4px)`.

### Typography

System font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif`. No external fonts are loaded. All inline SVG icons use `stroke` (not `fill`) at `#9B7BFF` / `currentColor`.

## Game Engine Pattern

New games should separate **pure logic** (an IIFE that returns a state-manipulation API) from **rendering** (a separate script that owns the DOM and canvas). See `engine.js` + `game.js` as the reference implementation. This keeps logic testable in isolation.

Canvas games should:
- Scale by `window.devicePixelRatio` for crisp rendering on retina screens.
- Use `touch-action: none` on the canvas element and listen on `pointerdown` (not mouse/touch separately).
- Re-`initCanvas()` on `window resize`.
