---
name: eden-theme
description: Build, extend, fix and ship the EDEN Shopify Online Store 2.0 theme in this repo (theme folders at the repo root) — new sections, effects (loader, Lenis, GSAP ScrollTrigger/SplitText scenes, WebGL hover, cursor, marquee, page transitions), product/cart/collection behaviour, copy, settings and schema. Use this skill whenever the task touches assets/, config/, layout/, locales/, sections/, snippets/, templates/, tools/preview/ or src/webgl/, mentions EDEN, Chapter drops, FAITH OVER FEAR, the countdown, Theme Check, the theme zip, or asks to add/change a section, block, setting, animation or template in this Shopify theme — even if the user doesn't say "skill" or "theme".
---

# EDEN theme

EDEN is Christian streetwear ("faith that is worn, not preached"). The theme is a cinematic, dark, motion-heavy Shopify OS 2.0 theme that must still be fast (LCP < 2.5s mobile, CLS < 0.1, INP < 200ms), accessible (WCAG 2.2 AA) and pass Theme Check with zero errors. Every change you make has to keep all three true — the motion is the brand, but the store still has to sell on a phone.

## Before you change anything

Read `references/architecture.md` once per session. It maps the files, the JS modules (theme.js / motion.js / product.js / facets.js), the `data-*` hooks that wire markup to effects, and the design tokens. Most tasks are a small edit in the right place once you know the map; guessing leads to duplicate systems.

If you are adding a section, copy the pattern in `references/section-recipe.md` — it already has the schema conventions, scheme/grain options, split-text hooks and preset the merchant expects.

## Non-negotiables (and why)

- **Brand voice & visuals.** Black `#0A0A0A`, bone `#F4F1EA`, white text, grey `#8C8C88`; blood red `#5C121A` only for hover fills and the countdown. Headlines Archivo Black, uppercase, tight tracking; labels 11px uppercase wide tracking. Copy is raw, honest, confident, never cheesy — no church clichés or stock religious imagery. Merchant-facing copy goes in section settings; UI strings go in `locales/en.default.json`.
- **Every effect needs three versions:** desktop, a lighter phone version (via `gsap.matchMedia` / CSS media queries) and a static one for `prefers-reduced-motion` or the *Enable motion* master switch (`html.motion-off`). Never hide content in a way that depends on JS finishing — use the existing failsafes (`motion-ready`, `is-split`, `is-in`).
- **No JS pinning.** Scroll scenes use CSS `position: sticky` inside a tall section, with ScrollTrigger only scrubbing (`start: 'top top', end: 'bottom bottom'`). GSAP `pin: true` registered ~1.0 CLS per pin boundary in Chrome; sticky registers ~0. Parents of sticky elements must use `overflow: clip`, not `hidden`.
- **Performance.** Libraries are self-hosted in `assets/` and loaded with `defer`; WebGL is lazy (desktop + fine pointer + near viewport). The first large image of a template gets `loading: 'eager', fetchpriority: 'high'` (hero also `preload: true`); everything else lazy. All images through `image_url` + `image_tag` with `widths` and `sizes`.
- **Accessibility.** 44px targets, visible focus, labelled icon buttons, focus-trapped drawers/dialogs (`eden-drawer`, native `<dialog>`), keyboard paths for anything the cursor/drag does, no `aria-label` on plain `<p>`/`<div>`.
- **Theme Check clean.** `npm run check` must report 0 offenses before you commit.
- **Theme folders stay at the repo root.** Shopify's GitHub integration only accepts a branch whose root holds `assets/ config/ layout/ locales/ sections/ snippets/ templates/`; a subfolder gives "Branch isn't a valid theme". Everything else at the root (README, tools, src, dist, .claude) is ignored by Shopify. The integration may also commit editor changes (usually `config/settings_data.json` and `templates/*.json`) back to the branch — pull before you edit those files.

## Workflow

1. **Locate** the change with the architecture map (section, snippet, asset, locale, settings schema).
2. **Edit** following the conventions. New UI strings → locale file (plural keys use `one`/`other` when passed `count:`). New global settings → `config/settings_schema.json` *and* regenerate defaults into `settings_data.json` if needed.
3. **Read `references/liquid-gotchas.md`** before writing non-trivial Liquid — it lists real bugs this codebase hit (filters inside `t:`/named args, `forloop.parentloop`, snippet scope, conditional tags). Theme Check does not catch them.
4. **Verify** with `bash .claude/skills/eden-theme/scripts/verify.sh` (Theme Check → local preview → 56 browser checks incl. axe, overflow, cart flow, CLS-sensitive scenes). For visual changes also open the screenshots in `tools/preview/shots/` and look at them — tests passing does not mean it looks right (grain strength, word breaks and gutters were all caught by eye). Add a check to `tools/preview/test.mjs` when you add behaviour worth protecting.
5. **Ship:** `npm run build` (rebuilds `eden-webgl.js` if `src/webgl` changed and `dist/eden-theme.zip`), then commit. The zip must contain `assets/ config/ layout/ locales/ sections/ snippets/ templates/` at its root.

The preview (`npm run preview`, port 4321) renders the real theme files with liquidjs and a mock catalog; it is not Shopify. When something only fails there, check whether it's a harness limitation (e.g. a missing mock filter) before "fixing" the theme — and extend the mock instead.

## Reporting

When you finish, tell the user: what changed and where, the Theme Check result, the browser-check result (x/56), anything you could only verify in the mock (checkout, real filters, metafields), and any remaining trade-off. Point them to the zip if it changed.
