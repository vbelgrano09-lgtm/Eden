// Browser checks for the EDEN theme preview (start `npm run preview` first).
// Ignored console noise: /favicon.ico (Shopify serves it) and /nope (the 404 page's intentional 404).
// Usage: node tools/preview/test.mjs [all|home|mobile|reduced|product|other]
// Set CHROMIUM_PATH if Chromium is not at the default location. Screenshots go to tools/preview/shots/.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:4321';
const OUT = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const AXE = fs.readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const suite = process.argv[2] || 'all';
const results = [];
const log = (ok, name, detail = '') => {
  results.push({ ok, name, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 900 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', hasTouch: !!opts.mobile, isMobile: !!opts.mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page._errors = [];
  page.on('pageerror', (e) => page._errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|\/nope$/.test(m.location().url || '')) page._errors.push(m.text() + ' @ ' + (m.location().url || '')); });
  await fetch(BASE + '/__reset');
  return page;
}
const shot = (page, name, full = false) => page.screenshot({ path: OUT + name + '.png', fullPage: full });
const overflowX = (page) => page.evaluate(() => {
  const w = document.documentElement.clientWidth;
  const offenders = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > w + 1) && getComputedStyle(el).position !== 'fixed' && !el.closest('.marquee, .gallery__viewport, .catalog__viewport, .pdp__media-list, .grain, .hero__zoom, .fof, [data-drawer-panel], .loader, .card__sizes, .zoom__body, .verse__bg, .story__img, .banner__img, .pt-curtain, .not-found__code, .size-guide__table-wrap')) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')} → ${Math.round(r.right)}px`);
  });
  return { scroll: document.scrollingElement.scrollWidth - w, offenders: offenders.slice(0, 8) };
});
async function axe(page, name) {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) }));
  });
  log(r.length === 0, `axe ${name}`, r.length ? JSON.stringify(r, null, 1) : 'no WCAG 2.2 AA violations');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- Home, desktop, first visit (loader) ---------------- */
if (suite === 'all' || suite === 'home') {
  const page = await newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const hasLoader = await page.evaluate(() => document.documentElement.classList.contains('has-loader'));
  log(hasLoader, 'loader shows on first visit');
  await sleep(350); await shot(page, 'home-loader-1-nails');
  await sleep(550); await shot(page, 'home-loader-2-eden');
  await sleep(450); await shot(page, 'home-loader-3-split');
  await sleep(700);
  const gone = await page.evaluate(() => !document.getElementById('EdenLoader') && !document.documentElement.classList.contains('has-loader'));
  log(gone, 'loader removed by 2.05s');
  await sleep(1400); await shot(page, 'home-hero');
  const lcp = await page.evaluate(() => { const img = document.querySelector('.hero__media img'); return img && { fp: img.getAttribute('fetchpriority'), loading: img.getAttribute('loading') }; });
  log(lcp && lcp.fp === 'high' && lcp.loading === 'eager', 'hero image eager + fetchpriority=high', JSON.stringify(lcp));
  const ready = await page.evaluate(() => ({ lenis: !!window.EDEN.lenis, ready: document.documentElement.classList.contains('motion-ready'), splits: document.querySelectorAll('[data-split].is-split').length, total: document.querySelectorAll('[data-split]').length }));
  log(ready.lenis && ready.ready, 'motion.js booted with Lenis', JSON.stringify(ready));

  // Scroll through the page with the wheel so Lenis + ScrollTrigger drive everything.
  const sections = ['.marquee', '[data-gallery]', '[data-fof]', '.product-grid-section', '.story', '.verse', '.countdown', '.newsletter'];
  for (const sel of sections) {
    const y = await page.evaluate((s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect().top + window.scrollY : null; }, sel);
    if (y == null) { log(false, `section ${sel} present`); continue; }
    await page.evaluate((yy) => window.EDEN.lenis ? window.EDEN.lenis.scrollTo(yy, { immediate: true }) : window.scrollTo(0, yy), y + 2);
    await sleep(900);
    await shot(page, `home-${sel.replace(/[^a-z]/g, '')}`);
  }
  // Gallery pinned state + FOF scene mid-way and at the end.
  const gal = await page.evaluate(() => { const g = document.querySelector('[data-gallery]'); return { pinned: g.classList.contains('is-pinned'), sticky: getComputedStyle(g.querySelector('.gallery__sticky')).position, tall: g.offsetHeight > innerHeight * 1.5 }; });
  log(gal.pinned && gal.sticky === 'sticky' && gal.tall, 'gallery is a sticky horizontal scene on desktop', JSON.stringify(gal));
  const fofTop = await page.evaluate(() => { const f = document.querySelector('[data-fof]'); return f.getBoundingClientRect().top + window.scrollY; });
  for (const [pct, label] of [[0.35, 'fill'], [0.62, 'crack'], [0.78, 'shatter'], [0.98, 'faith']]) {
    const h = await page.evaluate(() => document.querySelector('[data-fof]').offsetHeight - window.innerHeight);
    await page.evaluate((yy) => window.EDEN.lenis.scrollTo(yy, { immediate: true }), fofTop + h * pct);
    await sleep(1300);
    await shot(page, `home-fof-${label}`);
  }
  const shards = await page.evaluate(() => document.querySelectorAll('.fof__shard').length);
  log(shards >= 15, 'FEAR shatters into shards', `${shards} shards`);

  // WebGL hover on a product card.
  const cardSel = '.product-grid-section [data-webgl-media]';
  const box = await page.evaluate((s) => { const el = document.querySelector(s); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, cardSel);
  await sleep(600);
  await page.mouse.move(box.x - 50, box.y - 50);
  await page.mouse.move(box.x, box.y, { steps: 8 });
  await sleep(1200);
  await page.mouse.move(box.x + 30, box.y + 20, { steps: 4 });
  await sleep(500);
  const webgl = await page.evaluate(() => ({ lib: !!window.EdenWebGL, canvas: !!document.querySelector('.card-webgl'), cursor: document.querySelector('.cursor').className }));
  log(webgl.lib && webgl.canvas, 'WebGL hover canvas attached on desktop', JSON.stringify(webgl));
  log(/is-label/.test(webgl.cursor), 'cursor shows VIEW over product media');
  await shot(page, 'home-card-webgl-hover');

  const ov = await overflowX(page);
  log(ov.scroll <= 0 && ov.offenders.length === 0, 'desktop home: no horizontal overflow', JSON.stringify(ov));
  log(page._errors.length === 0, 'desktop home: no console errors', page._errors.join(' | '));

  // Second page view in the same session: no loader.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const again = await page.evaluate(() => document.documentElement.classList.contains('has-loader'));
  log(!again, 'loader never shown again in the session');
  await page.context().close();
}

/* ---------------- Home, mobile ---------------- */
if (suite === 'all' || suite === 'mobile') {
  const page = await newPage({ viewport: { width: 390, height: 844 }, mobile: true });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await sleep(2400);
  await shot(page, 'm-home-hero');
  for (const sel of ['.marquee', '[data-gallery]', '[data-fof]', '.product-grid-section', '.story', '.verse', '.countdown', '.newsletter', '.footer']) {
    await page.evaluate((s) => { const el = document.querySelector(s); if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 2); }, sel);
    await sleep(900);
    await shot(page, `m-home-${sel.replace(/[^a-z]/g, '')}`);
  }
  const gal = await page.evaluate(() => document.querySelector('[data-gallery]').classList.contains('is-pinned'));
  log(!gal, 'mobile gallery is a native swipe row (not pinned)');
  const cursor = await page.evaluate(() => { const c = document.querySelector('.cursor'); return c ? getComputedStyle(c).display : 'none'; });
  log(cursor === 'none', 'custom cursor hidden on touch', cursor);
  const ov = await overflowX(page);
  log(ov.scroll <= 0 && ov.offenders.length === 0, 'mobile home: no horizontal overflow', JSON.stringify(ov));
  const targets = await page.evaluate(() => {
    const small = [];
    document.querySelectorAll('a[href], button, input:not([type=hidden]), select, summary, label.picker__pill, label.picker__swatch').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || el.closest('[aria-hidden="true"], .visually-hidden, [data-drawer-panel]:not(.is-open), .card__sizes, .rte, .footer__links, p, .skip-link')) return;
      const after = getComputedStyle(el, '::after');
      if (after.content !== 'none' && after.position === 'absolute') return; // hit area extended by ::after overlay
      if (r.height < 24 || r.width < 24) small.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return small.slice(0, 12);
  });
  log(targets.length === 0, 'mobile: interactive targets ≥ 24px (WCAG 2.2 2.5.8)', targets.join(', '));
  log(page._errors.length === 0, 'mobile home: no console errors', page._errors.join(' | '));
  await axe(page, 'home (mobile)');
  await page.context().close();
}

/* ---------------- Reduced motion ---------------- */
if (suite === 'all' || suite === 'reduced') {
  const page = await newPage({ reduced: true });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await sleep(600);
  const st = await page.evaluate(() => ({ loader: document.documentElement.classList.contains('has-loader'), off: document.documentElement.classList.contains('motion-off'), lenis: !!window.EDEN.lenis, pinned: !!document.querySelector('.pin-spacer, .gallery.is-pinned, .fof.is-scene'), hidden: [...document.querySelectorAll('[data-split],[data-reveal]')].filter((e) => { const cs = getComputedStyle(e); return cs.visibility === 'hidden' || +cs.opacity < 0.99; }).length }));
  log(!st.loader && st.off && !st.lenis && !st.pinned && st.hidden === 0, 'reduced motion: no loader/Lenis/pins, all text visible', JSON.stringify(st));
  await shot(page, 'reduced-home-hero');
  await page.evaluate(() => window.scrollTo(0, document.querySelector('[data-fof]').offsetTop));
  await sleep(300);
  await shot(page, 'reduced-fof');
  log(page._errors.length === 0, 'reduced motion: no console errors', page._errors.join(' | '));
  await axe(page, 'home (reduced motion, desktop)');
  await page.context().close();
}

/* ---------------- Product ---------------- */
if (suite === 'all' || suite === 'product') {
  const page = await newPage();
  await page.goto(BASE + '/products/faith-over-fear-hoodie', { waitUntil: 'domcontentloaded' });
  await sleep(2400);
  await shot(page, 'pdp-desktop');
  const lcp = await page.evaluate(() => document.querySelector('.pdp__media-item img').getAttribute('fetchpriority'));
  log(lcp === 'high', 'PDP first image fetchpriority=high');
  // Submitting without a size prompts for one.
  await page.click('.pdp__atc');
  await sleep(700);
  const prompt = await page.evaluate(() => ({ err: document.querySelector('[data-form-error]').textContent, missing: !!document.querySelector('.picker.is-missing') }));
  log(prompt.missing && /size/i.test(prompt.err), 'add without size prompts "Select a size"', JSON.stringify(prompt));
  // Choose color + size, add to bag.
  await page.click('label.picker__swatch >> nth=1');
  await page.click('.picker--size label.picker__pill >> nth=2');
  await sleep(200);
  const st = await page.evaluate(() => ({ id: document.querySelector('[data-variant-id-input]').value, url: location.search, label: document.querySelector('.pdp__atc [data-atc-label]').textContent.trim(), color: document.querySelector('[data-option-value]').textContent }));
  log(!!st.id && st.url.includes('variant=') && /add/i.test(st.label), 'variant picker updates id, URL and button', JSON.stringify(st));
  await page.click('.pdp__atc');
  await sleep(1300);
  const drawer = await page.evaluate(() => ({ open: document.querySelector('.cart-drawer').classList.contains('is-open'), lines: document.querySelectorAll('.cart-drawer .line-item').length, count: document.querySelector('[data-cart-count]').textContent.trim(), focusIn: document.querySelector('.cart-drawer').contains(document.activeElement) }));
  log(drawer.open && drawer.lines === 1 && drawer.count === '1' && drawer.focusIn, 'add to bag opens drawer with the line, count, focus trapped', JSON.stringify(drawer));
  await shot(page, 'pdp-drawer');
  // Quantity + and remove inside the drawer.
  await page.click('.cart-drawer [data-qty-change="1"]');
  await sleep(900);
  const qty = await page.evaluate(() => ({ v: document.querySelector('.cart-drawer [data-qty-input]').value, focus: document.activeElement && document.activeElement.getAttribute('data-qty-change') }));
  log(qty.v === '2' && qty.focus === '1', 'drawer quantity + updates and keeps focus', JSON.stringify(qty));
  await page.keyboard.press('Escape');
  await sleep(800);
  const closed = await page.evaluate(() => !document.querySelector('.cart-drawer').classList.contains('is-open'));
  log(closed, 'Escape closes the drawer');
  // Size guide + unit switch.
  await page.click('[data-modal-open^="SizeGuide"]');
  await sleep(500);
  await page.click('.size-guide__unit[data-unit="in"]');
  const inch = await page.evaluate(() => { const td = document.querySelector('.size-guide__table td[data-cm]'); return { v: td.textContent, cm: +td.dataset.cm }; });
  log(inch.cm > 0 && +inch.v === Math.round((inch.cm / 2.54) * 2) / 2, 'size guide switches to inches', JSON.stringify(inch));
  await shot(page, 'pdp-size-guide');
  await page.keyboard.press('Escape');
  await sleep(400);
  // Complete the set section present.
  const set = await page.evaluate(() => ({ title: document.querySelector('.set__title') && document.querySelector('.set__title').textContent.trim(), card: document.querySelector('.set__match [data-product-handle]') && document.querySelector('.set__match [data-product-handle]').dataset.productHandle }));
  log(set.card === 'faith-over-fear-jogger', 'complete the set shows the matching jogger', JSON.stringify(set));
  await page.evaluate(() => document.querySelector('.set').scrollIntoView());
  await sleep(1000);
  await shot(page, 'pdp-set');
  log(page._errors.length === 0, 'PDP desktop: no console errors', page._errors.join(' | '));
  await axe(page, 'product (desktop)');
  await page.context().close();

  const m = await newPage({ viewport: { width: 390, height: 844 }, mobile: true });
  await m.goto(BASE + '/products/faith-over-fear-hoodie', { waitUntil: 'domcontentloaded' });
  await sleep(2400);
  const sticky = await m.evaluate(() => { const s = document.querySelector('sticky-atc'); return { visible: s.classList.contains('is-visible'), bottom: Math.round(s.getBoundingClientRect().bottom), vh: innerHeight }; });
  log(sticky.visible && sticky.bottom <= sticky.vh, 'mobile sticky add-to-bag visible while main button is off screen', JSON.stringify(sticky));
  await shot(m, 'm-pdp-top');
  await m.evaluate(() => document.querySelector('.pdp__info').scrollIntoView());
  await sleep(700);
  await shot(m, 'm-pdp-info');
  await m.evaluate(() => document.querySelector('.pdp__atc').scrollIntoView({ block: 'center' }));
  await sleep(700);
  const hid = await m.evaluate(() => document.querySelector('sticky-atc').classList.contains('is-visible'));
  log(!hid, 'mobile sticky bar hides when the main button is visible');
  const ov = await overflowX(m);
  log(ov.scroll <= 0 && ov.offenders.length === 0, 'mobile PDP: no horizontal overflow', JSON.stringify(ov));
  log(m._errors.length === 0, 'PDP mobile: no console errors', m._errors.join(' | '));
  await axe(m, 'product (mobile)');
  await m.context().close();

  // A product whose size option is called "Talla" still gets size pills, the size guide and required size.
  const es = await newPage();
  await es.goto(BASE + '/products/he-is-risen-hoodie', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const talla = await es.evaluate(() => ({ size: !!document.querySelector('.picker--size'), guide: !!document.querySelector('.picker--size [data-modal-open^="SizeGuide"]'), required: document.querySelector('[data-variant-id-input]').value === '' }));
  log(talla.size && talla.guide && talla.required, 'size option named "Talla" is treated as size', JSON.stringify(talla));
  await es.goto(BASE + '/collections/chapter-001', { waitUntil: 'domcontentloaded' });
  await sleep(800);
  const labels = await es.evaluate(() => Array.from(document.querySelectorAll('[data-product-handle="he-is-risen-hoodie"] .card__size')).map((b) => b.textContent.trim()));
  log(labels.length > 0 && labels.every((l) => l.length <= 3), 'quick add shows size labels for "Talla"', labels.join(' '));

  // One product per colour (tags group:/color:): swatch links to the sibling products.
  await es.goto(BASE + '/products/hoodie-eden-olive', { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  const links = await es.evaluate(() => {
    const a = Array.from(document.querySelectorAll('.picker--links a.picker__swatch'));
    return { colors: a.map((x) => x.title), current: (document.querySelector('.picker--links [aria-current="true"]') || {}).title, label: document.querySelector('.picker--links .label').textContent.trim(), size: !!document.querySelector('.picker--size') };
  });
  log(links.colors.join() === 'Black,Olive,Stone' && links.current === 'Olive' && links.label === 'Color: Olive' && links.size, 'colour links between grouped products', JSON.stringify(links));
  await shot(es, 'pdp-color-links');
  await es.click('.picker--links a[title="Black"]');
  await es.waitForURL('**/products/hoodie-eden-black', { timeout: 8000 }).catch(() => {});
  log(es.url().endsWith('/products/hoodie-eden-black'), 'colour link opens the other colour', es.url());
  await sleep(1500);
  await axe(es, 'grouped product');
  await es.context().close();
}

/* ---------------- Collection, quick add, search, 404, password ---------------- */
if (suite === 'all' || suite === 'other') {
  const cat = await newPage({ reduced: true });
  await cat.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await cat.locator('.catalog').scrollIntoViewIfNeeded();
  await sleep(800);
  const c1 = await cat.evaluate(() => {
    const v = document.querySelector('.catalog__viewport');
    const items = Array.from(document.querySelectorAll('.catalog__item'));
    const vis = items.filter((i) => { const r = i.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }).length;
    return { count: items.length, visible: vis, left: v.scrollLeft, prevDisabled: document.querySelector('.catalog [data-gallery-prev]').disabled };
  });
  await cat.click('.catalog [data-gallery-next]');
  await sleep(600);
  const left2 = await cat.evaluate(() => document.querySelector('.catalog__viewport').scrollLeft);
  log(c1.count === 9 && c1.visible === 4 && c1.prevDisabled && left2 > 0, 'catalog carousel: all products, 4 per view, arrows scroll', JSON.stringify({ ...c1, left2 }));
  await shot(cat, 'catalog-carousel');
  await cat.context().close();

  const page = await newPage();
  await page.goto(BASE + '/collections/chapter-001', { waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await shot(page, 'collection');
  // Quick add via keyboard: focus the toggle, open sizes, pick one.
  const handle = await page.evaluate(() => { const t = document.querySelector('.card__quick-toggle'); t.focus(); return t.closest('[data-product-handle]').dataset.productHandle; });
  await page.keyboard.press('Enter');
  await sleep(400);
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement.className);
  await page.keyboard.press('Enter');
  await sleep(1200);
  const qa = await page.evaluate(() => ({ open: document.querySelector('.cart-drawer').classList.contains('is-open'), lines: document.querySelectorAll('.cart-drawer .line-item').length }));
  log(qa.open && qa.lines === 1, `quick add by keyboard (${handle}) adds and opens drawer`, JSON.stringify({ ...qa, focused }));
  await page.keyboard.press('Escape');
  await sleep(700);
  await page.click('[data-drawer-open^="Facets"]');
  await sleep(900);
  await shot(page, 'collection-filters');
  const facets = await page.evaluate(() => document.querySelector('.facets').classList.contains('is-open'));
  log(facets, 'filter drawer opens');
  await page.keyboard.press('Escape');
  log(page._errors.length === 0, 'collection: no console errors', page._errors.join(' | '));
  await axe(page, 'collection');

  for (const [url, name] of [['/nope', '404'], ['/password', 'password'], ['/search?q=faith', 'search'], ['/cart', 'cart'], ['/pages/our-story', 'story'], ['/pages/faq', 'faq'], ['/account/login', 'login']]) {
    await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
    await sleep(1600);
    await shot(page, name);
    const ov = await overflowX(page);
    log(ov.scroll <= 0, `${name}: no horizontal overflow`, JSON.stringify(ov));
    await axe(page, name);
  }
  log(page._errors.length === 0, 'other pages: no console errors', page._errors.join(' | '));

  // Search predictive.
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await sleep(2400);
  await page.click('[data-drawer-open="SearchModal"]');
  await sleep(500);
  await page.keyboard.type('risen');
  await sleep(1200);
  const pred = await page.evaluate(() => document.querySelectorAll('.predictive__item').length);
  log(pred >= 1, 'predictive search returns results', `${pred}`);
  await shot(page, 'search-modal');
  await page.context().close();

  // Mobile menu.
  const m = await newPage({ viewport: { width: 390, height: 844 }, mobile: true });
  await m.goto(BASE + '/collections/chapter-001', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await m.click('.header__menu-toggle');
  await sleep(1000);
  await shot(m, 'm-menu');
  const menu = await m.evaluate(() => document.querySelector('.menu-drawer').classList.contains('is-open'));
  log(menu, 'mobile menu opens');
  await m.context().close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
fs.writeFileSync(OUT + 'results.json', JSON.stringify(results, null, 2));
