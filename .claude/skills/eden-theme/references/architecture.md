# EDEN theme architecture

## Contents
1. Repo layout
2. Page boot order
3. JS modules and custom elements
4. `data-*` hooks (markup → effects)
5. CSS tokens, schemes, utilities
6. Settings that drive effects
7. Metafields, tags and conventions the merchant relies on

## 1. Repo layout

```
(repo root = the theme; Shopify's GitHub integration requires this and ignores other folders)
layout/theme.liquid       head bootstrap, deferred scripts, loader, groups, cart drawer, cursor, grain
layout/password.liquid    coming-soon layout (no motion.js)
sections/                 39 sections + header-group.json / footer-group.json
snippets/                 head-bootstrap, css-variables, meta-tags, seo-title, logo-eden (SVG wordmark),
                          loader, icon, product-card, price, cart-line-item, countdown(+ -iso),
                          newsletter-form, localization-form, facets, pagination, size-guide,
                          product-media-item, json-ld-*, media-placeholder, swatch-value, address-fields
assets/                   base.css (global + marketing sections), product.css, collection.css, cart.css,
                          customer.css, theme.js, motion.js, product.js, facets.js, eden-webgl.js (built),
                          gsap.min.js, ScrollTrigger.min.js, SplitText.min.js, lenis.min.js, fonts (woff2)
config/                   settings_schema.json, settings_data.json
locales/en.default.json   storefront strings (schemas use plain English labels)
templates/                JSON templates + gift_card.liquid + customers/*
--- not part of the theme (ignored by Shopify) ---
src/webgl/eden-webgl.js   OGL hover shader source → npm run build:webgl
tools/preview/            server.mjs (liquidjs mock of Shopify) + test.mjs (Playwright + axe)
scripts/                  build-zip.sh, copy-vendor.mjs
dist/                     eden-theme.zip (manual upload), eden-theme.skill
```

## 2. Page boot order

1. `snippets/head-bootstrap.liquid` (inline, first in `<head>`): sets `window.EDEN` (routes, settings, strings, asset URLs) and classes on `<html>` before first paint:
   - `motion-ok` | `motion-off` (settings master switch AND `prefers-reduced-motion`)
   - `split-on` (hide `[data-split]` until split), `has-hover` (fine pointer)
   - `has-loader` + `intro-delay` once per session (`sessionStorage['eden:intro']`), never in the editor
   - `pt-enter` when the previous page left through the fallback curtain
   - registers `pagereveal` for the card → product View Transition morph
2. `base.css` (render-blocking, the only global CSS).
3. Deferred scripts in order: `theme.js`, then (if motion enabled) `gsap`, `ScrollTrigger`, `SplitText`, `lenis`, `motion.js`. Section CSS/JS (`product.css/js`, `collection.css`, `facets.js`, …) are included by their main sections.
4. `snippets/loader.liquid` runs its own tiny inline script; timeline is pure CSS (≤1.8s) and dispatches `eden:loader:done`.
5. `motion.js` boots after fonts (max 900ms wait), inits per `.shopify-section` inside a `gsap.context` + `gsap.matchMedia`, re-inits on `shopify:section:load`, reverts on `unload`.

## 3. JS modules and custom elements

`theme.js` (no deps) exposes `EDEN.utils` (`$`, `$$`, `debounce`, `announce`, `trapFocus`, `lockScroll`/`unlockScroll`, `shade`) and `EDEN.cart`:
- `<eden-drawer id>` with `[data-drawer-panel]` (gets `.is-open`), `[data-drawer-close]`, `[data-autofocus]`; opened by any `[data-drawer-open="Id"]`. Used for CartDrawer, MenuDrawer, SearchModal, Facets-*.
- `EDEN.cart.add(items)`, `.change(key, qty)`, `.update({note})` → AJAX Cart API with `sections` = `cart-drawer` + every `[data-cart-section]`; re-renders and restores focus.
- `<cart-items>`, `<product-form>` (requires a variant id; emits `product-form:needs-option`), `<quick-add>`, `<predictive-search>`, `<drop-countdown data-target="ISO">` (adds `.is-live`), `<scroll-marquee data-reactive>` (changes the CSS animation's playbackRate on scroll), `<gallery-scroller>` (native row: buttons, arrows, progress).
- `[data-modal-open="Id"]` opens a native `<dialog>`; `[data-modal-close]` closes; backdrop click closes.
- Page transitions: native cross-document View Transitions (`@view-transition` inline in theme.liquid when enabled); curtain fallback when `CSSViewTransitionRule` is missing.

`motion.js` (exits early unless `html.motion-ok`): Lenis (desktop wheel only, stops on `eden:scroll:lock`), split reveals, `[data-reveal]` batches, `[data-parallax]`, hero (video + scroll-out + pointer layer), chapter gallery (sticky horizontal scene, drag + keyboard focus mapping), FAITH OVER FEAR (fill via `--fill`, shards via clip-path polygons, crack SVG), cursor, magnetic, tilt, WebGL lazy loader. Public: `EDEN.motion.reveal(root)`, `.refresh()`, `.scrollTo(y)` — call `reveal` + `refresh` after injecting markup (facets and recommendations already do).

`product.js`: `<variant-picker>` (JSON in `[data-product-json]`, size required unless `?variant=`), `<media-gallery>` (zoom dialog, variant image), `<sticky-atc>`, size-guide units, `<product-recommendations data-url data-id>`.

`facets.js`: `<facet-filters data-section>` swaps `[data-facets-results|active|count|form-body|show|badge]` from the Section Rendering API and pushes history.

`eden-webgl.js`: one shared OGL canvas moved into whichever `[data-webgl-media]` is hovered (never more than one WebGL context).

## 4. `data-*` hooks

| Hook | Effect |
|---|---|
| `data-split="chars|words|lines"` (+ `data-split-delay`) | SplitText reveal on enter. Letters on non-headings get a screen-reader copy automatically. |
| `data-reveal` | Fade-up when entering (failsafe after 3s if JS never arrives). |
| `data-parallax="0.2"` (+ `data-parallax-scope` on the frame) | Scrubbed y parallax; half strength on phones. |
| `data-magnetic` on a wrapper (`.magnetic`) | Magnetic button; inner `.btn__label` moves more. |
| `data-cursor="view|drag"` + `data-cursor-label` | Cursor label state (use `general.cursor.*` strings). |
| `data-tilt` | 3D tilt (desktop). |
| `data-webgl-media` | WebGL hover target; needs two `<img>` children (primary, secondary). |
| `data-vt-media` (card) / `data-vt-product-media data-handle` (PDP first media) | View Transition morph pair. |
| `data-header-overlay` | First section sits under a transparent header. |
| `data-hero`, `data-gallery data-pin`, `data-fof data-scene` | Section scene roots read by motion.js. |
| `data-lenis-prevent` | Let this element scroll natively (drawers, modals). |
| `data-no-transition` | Link skips the page-transition fallback. |

## 5. CSS tokens, schemes, utilities

Tokens from `snippets/css-variables.liquid`: `--c-black --c-bone --c-white --c-grey --c-accent` (+ `-rgb`), `--font-display --font-body`, `--heading-scale --heading-tracking`, `--card-ratio`, `--grain-opacity`, `--logo-w`. Layout tokens in base.css: `--gutter`, `--section-pad`, `--grid-gap`, `--header-h`, `--fs-*`, `--ease-out/-in-out`.

Schemes: `.scheme-dark` / `.scheme-bone` set `--fg --fg-muted --bg --line --line-strong --surface`; always style with those so both schemes work. `.section-grain` adds vignette (`::before`) + subtle noise (`::after`); its child rule is `:where()` so component positioning wins. `.media-lit` adds the drifting light. Type: `.h-display .h1 .h2 .h3 .h4 .label .body-lg .muted`. Buttons: `.btn` (+ `--bone --solid --lg --small --full`), `.icon-btn`, `.text-btn`, `.link` (+ `--static`; underline position via `--uy`).

Headline sizes are clamps sized so the longest default line fits its column (Archivo Black ≈ 0.72em per capital). If you add a heading in a narrow column, size it down rather than letting `overflow-wrap` break a word.

## 6. Settings that drive effects

`settings.motion_enable` (master), `loader_enable`/`loader_scope`, `smooth_scroll`/`smooth_scroll_duration`, `page_transitions`, `split_text`, `cursor_enable`/`cursor_hide_native`, `magnetic_enable`, `webgl_enable`, `card_tilt`, `grain_enable`/`grain_opacity`, `image_lighting`. Products: `ships_in_days`, `card_ratio`, `card_second_image`, `card_color_count`, `quick_add`, `coming_soon_tag`, `swatch_map`. Cart: `cart_type` (drawer/page), `cart_note`, `cart_message`. These are mirrored into `window.EDEN.settings` by head-bootstrap — add new JS-relevant settings there.

## 7. Merchant conventions

- Collection handle `chapter-001` is pre-wired in `templates/index.json`.
- Menus `main-menu`, `footer`. Pages use templates `page.story`, `page.faq`, `page.contact`.
- Metafields: `custom.ships_in_days` (text), `custom.complete_the_set` (product reference).
- Tag `coming-soon` → badge, no add to bag, notify form. Sold out is automatic.
- Countdown dates are text `YYYY-MM-DD HH:MM` + an offset select, turned into ISO by `snippets/countdown-iso.liquid`.
