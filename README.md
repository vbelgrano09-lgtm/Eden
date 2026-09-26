# EDEN — Shopify theme

Faith that is worn, not preached. A cinematic, dark Online Store 2.0 theme for EDEN: heavy on motion, fast on phones, built to sell.

- **Connect from GitHub:** Shopify admin → **Online Store → Themes → Add theme → Connect from GitHub** → this repository and branch. The theme folders (`assets/ config/ layout/ locales/ sections/ snippets/ templates/`) live at the repo root, as Shopify's GitHub integration requires. Everything else here (README, `tools/`, `src/`, `dist/`) is ignored by Shopify.
- **Or upload a zip:** `dist/eden-theme.zip` → **Online Store → Themes → Add theme → Upload zip file** (rebuild it with `npm run zip`).
- **Theme Check:** `shopify theme check` → **0 errors, 0 warnings** (92 files).

---

## First-time setup (15 minutes)

1. **Logo & wordmark.** Theme settings → *Identity* → upload `eden-logo-white.png` (Logo) and `faith-over-fear.png` (FAITH OVER FEAR wordmark). Without them the theme uses a built-in EDEN wordmark with the crossed nails, and live type for FAITH OVER FEAR.
2. **Collection.** Create a collection with the handle `chapter-001`. The home gallery, product grid and hero button are already pointed at it.
3. **Menus.** Navigation → `main-menu` (header + mobile menu) and `footer` (footer column).
4. **Pages.** Create `Our story` (template `page.story`), `FAQ` (`page.faq`), `Contact` (`page.contact`).
5. **Product metafields** (Settings → Custom data → Products):
   - `custom.ships_in_days` (single line text, e.g. `7–10`): the "Made to order · ships in X days" note. Falls back to Theme settings → *Products*.
   - `custom.complete_the_set` (product reference): link each hoodie to its matching jogger for **Complete the set**.
6. **Badges.** Tag a product `coming-soon` → **COMING SOON** badge, no add to bag, "Notify me" signup. **SOLD OUT** is automatic.
7. **Filters.** Install *Search & Discovery* and add Color, Size and Price filters.
8. **Markets.** Add the US, UK, Canada and Australia. The footer and mobile menu get a country/currency selector automatically.
9. **Drop date.** Header → *Announcement bar* and Home → *Drop countdown* → set the date `YYYY-MM-DD HH:MM` and time zone. At zero both switch to **LIVE NOW**.

Colour option names `Color`/`Colour` become swatches. Shopify's native swatches are used when set; otherwise the *Color swatches* list in Theme settings → *Products* (`Name: #hex`).

---

## Effect toggles (Theme settings → Motion & effects)

| Setting | What it does | Phones | Reduced motion |
|---|---|---|---|
| **Enable motion** (master) | Turns every effect below on/off and ships a static site when off. | — | always off |
| **Show intro loader** + *Show loader on* | Nails draw and cross over the D, EDEN fades in, the screen splits open. ≤1.8s, skippable (button, Esc, click, scroll), once per session. | yes | off |
| **Smooth scroll (Lenis)** + *weight* | Weighted wheel/trackpad scrolling. | native touch scroll | off |
| **Page transitions** | View Transitions API (the product image morphs from card to product page); curtain wipe fallback in other browsers. | yes | off |
| **Split-text reveals** | Headlines reveal letter by letter or line by line as they enter (GSAP SplitText). | yes | text shown static |
| **Custom cursor** + *Hide system cursor* | Dot that grows into **VIEW** over products and **DRAG** over the gallery. Text fields keep the system cursor. | never | off |
| **Magnetic buttons** | Buttons lean toward the pointer. | off | off |
| **WebGL liquid hover** | OGL shader swaps to the second photo with a ripple from the pointer. Loaded only on desktop, only once a card is near the viewport. | crossfade | off |
| **3D tilt on hover** | Subtle card tilt. | off | off |
| **Film grain** + *strength* | Fixed grain over the whole site (animated on desktop). | static | static |
| **Image lighting** | Slow drifting light and vignette on imagery. | yes | static |

Per-section switches live in each section (below). Visitors whose device asks for reduced motion get **no loader, parallax, scroll scenes or WebGL**: everything static and readable.

---

## Sections

**Global**

| Section | Notes & settings |
|---|---|
| Announcement bar | Text, link, black/blood-red style, **drop countdown** (date, time zone, "live" text). |
| Header | Menu, *hide on scroll down / always visible*, search & account toggles. Transparent over a first-section Hero or Image banner. Full-screen mobile menu with country selector. Predictive search overlay. |
| Cart drawer | Slide-out bag (AJAX Cart API + Section Rendering): quantity, remove, note, subtotal, checkout. Empty-state copy. |
| Footer | Newsletter, menu/text blocks (max 4), giant FAITH OVER FEAR wordmark (image or text), country/currency, social, payment icons, grain. |

**Home & content**

| Section | Notes & settings |
|---|---|
| Hero | Image (+ mobile crop) or MP4 video (desktop, optional on phones, pause control), parallax PNG layer, eyebrow, multi-line headline ("CHAPTER 001 / IS LIVE"), two buttons. Toggles: **slow zoom** (+ duration), **scroll parallax**, **magnetic buttons**, scroll hint, transparent header. Image is `fetchpriority="high"`, never lazy. |
| Marquee | Text blocks (outline option), ✝ / nails / no separator, loop speed, size, direction, **react to scroll** (+ boost): speed and direction follow the scroll. |
| Chapter gallery | Collection, product count, **pin & move sideways on desktop** (sticky scene; drag, keyboard and arrow keys supported), end card, scheme, grain. Phones get a swipe row with arrows. |
| Faith over fear scene | The three words, closing line, **enable scroll scene**, end on the wordmark image, grain. Letters scale and fill with white; FEAR cracks and shatters; FAITH stays. |
| Product grid | Collection, count, columns (desktop 2–4, phones 1–2), "View all", scheme, grain. Cards: badges, **5 COLORS** count, quick add by size. |
| Brand story | Image left/right (+ parallax), eyebrow, "We fall. / We rise.", text, sign-off, button, scheme. |
| Verse | Verse, reference (Psalm 46:10), note, reveal style (letters/words/lines), optional background image (+ strength, parallax), scheme, grain. |
| Drop countdown | Label, date, optional start date (blood-red progress bar), time zone, live title/link/button. Switches to **LIVE NOW** at zero. |
| Newsletter | "No discounts. Just drops.", text, placeholder, button, success message, scheme. |
| Image banner | Image, title, text, button, height, position, shade, parallax, transparent header, grain. |
| Rich text | Eyebrow, heading, text, button, alignment, split-text toggle, scheme. |
| Text columns | Up to 6 columns (image, title, text), numbering, columns count, scheme. |
| FAQ | Group headings + questions. Outputs FAQPage JSON-LD. |
| Contact form | Title, text, detail blocks, success message. |
| Apps | For app blocks. |

**Commerce & system**

| Section | Notes & settings |
|---|---|
| Product | Sticky info column; gallery (stacked or grid) with zoom dialog (pan on desktop, pinch on phones); blocks: title, price, **color & size picker** (size required by default, size guide in cm/in), **made-to-order note**, buy buttons (express checkout toggle), text, description, **accordions** (Details, Size & fit, The meaning, Care, Shipping), share, app blocks. **Sticky add-to-bag bar on phones** whenever the main button is off screen. Product JSON-LD. |
| Complete the set | Metafield `custom.complete_the_set` → fallback product → Shopify complementary recommendations. |
| Related products | Title, count, columns. Lazy-loaded. |
| Collection | Filters drawer (Search & Discovery), sorting, AJAX updates with URL history, columns, per page. |
| Collections list · Search results · Cart · Page · Blog · Article | Standard templates in EDEN style (search has filters + predictive search). |
| 404 | "Lost? So were we. Come home." |
| Coming soon (password page) | Countdown, "No discounts. Just drops." signup, password dialog. |
| Customer pages | Login (+ password reset), register, account, order, addresses, activate, reset. |

Templates: `index`, `product`, `collection`, `list-collections`, `search`, `cart`, `page`, `page.story`, `page.faq`, `page.contact`, `blog`, `article`, `404`, `password`, `gift_card`, `customers/*`.

---

## Performance & accessibility

- **LCP:** hero/product first image `fetchpriority="high"` + eager (+ preload); fonts self-hosted and preloaded (`font-display: swap` with metric-matched fallbacks); no render-blocking JS (everything `defer`); WebGL (~16 KB gz) lazy-loaded on desktop only.
- **CLS:** scroll scenes use CSS `position: sticky` instead of JS pinning, and scene lengths are set in CSS from the first paint. Measured CLS in the local preview: **0.0002 desktop / 0.0012 mobile** while scrolling the full home page.
- **INP:** the marquee runs on the compositor (scroll only changes its playback rate); effects use rAF and passive listeners.
- **Images:** everything goes through `image_url` + `image_tag` with `widths`/`sizes`.
- **Accessibility (WCAG 2.2 AA):** skip link, visible focus, focus-trapped drawers and dialogs, keyboard access to quick add / gallery / zoom, labelled icon buttons, live-region announcements, ≥44px targets, pause control for video, SplitText keeps screen-reader text intact. axe-core: **0 violations** on every template tested.
- **SEO:** clean titles, meta description, Open Graph/Twitter tags, canonical, Organization + WebSite, Product, and FAQPage JSON-LD.

Known trade-off: Theme Check's optional `theme-check:all` config adds `AssetSizeJavaScript` (a 10 KB-per-page JS budget). GSAP + ScrollTrigger alone are ~46 KB gzipped, so that optional check flags them. The default/recommended config (what `shopify theme check` runs) is clean. Visitors with reduced motion still download the libraries (deferred, cached) but none of them run.

---

## Development

```bash
npm install
npm run check          # Shopify Theme Check
npm run preview        # local preview with a mock catalog → http://localhost:4321
npm run test:browser   # 56 browser checks: effects, cart, a11y (axe), overflow (needs Chromium)
npm run build          # rebuild the OGL/WebGL bundle + dist/eden-theme.zip
npm run vendor         # recopy GSAP, Lenis and fonts from node_modules after an upgrade
```

| Path | What |
|---|---|
| `assets/theme.js` | Core: cart API + drawer, quick add, header, menus, search, countdown, marquee, modals, page-transition fallback. No dependencies. |
| `assets/motion.js` | Everything that moves: Lenis, ScrollTrigger scenes, SplitText, parallax, cursor, magnetic, tilt, WebGL loader. Exits early for reduced motion. |
| `assets/product.js` / `facets.js` | Variant picker, gallery/zoom, sticky bar, size guide / AJAX filtering. |
| `src/webgl/eden-webgl.js` | Source of the WebGL hover (OGL); built into `assets/eden-webgl.js`. |
| `tools/preview/` | The local preview harness (liquidjs + mocked Shopify objects) and browser tests. Not part of the theme. |

Libraries (self-hosted in `assets/`): GSAP 3.15 + ScrollTrigger + SplitText (GSAP standard license, free), Lenis 1.3 (MIT), OGL 1.0 (Unlicense), Archivo / Archivo Black (SIL OFL).
