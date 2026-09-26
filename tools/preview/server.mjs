// Local preview harness for the EDEN theme: liquidjs + mocked Shopify objects/filters.
// Not a Shopify replacement — it renders the real theme files with a fake catalog so the
// HTML/CSS/JS can be exercised in a real browser (npm run preview, npm run test:browser).
// Shopify-only behaviour (checkout, real filters, pagination, metafield editors) is mocked.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Liquid, Drop, Tag, Hash } from 'liquidjs';

const THEME = process.env.THEME || new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const PORT = +(process.env.PORT || 4321);
// Files saved by the Shopify editor start with an auto-generated /* … */ header.
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
const locale = readJSON(path.join(THEME, 'locales/en.default.json'));
const settingsData = readJSON(path.join(THEME, 'config/settings_data.json'));
const SETTINGS = { ...settingsData.presets.Default, ...(process.env.SETTINGS ? JSON.parse(process.env.SETTINGS) : {}) };
// Colors are objects with .red/.green/.blue in Shopify.
class ColorDrop extends Drop {
  constructor(hex) { super(); this.hex = hex; const n = parseInt(hex.slice(1), 16); this.red = (n >> 16) & 255; this.green = (n >> 8) & 255; this.blue = n & 255; }
  valueOf() { return this.hex; } toString() { return this.hex; }
}
for (const k of Object.keys(SETTINGS)) if (/^color_/.test(k)) SETTINGS[k] = new ColorDrop(SETTINGS[k]);

class TemplateDrop extends Drop {
  constructor(name) { super(); this.name = name.split('/').pop(); this.directory = name.includes('/') ? name.split('/')[0] : null; this.suffix = null; this.full = name; }
  valueOf() { return this.full; } toString() { return this.full; }
}
/* ---------------- Mock catalog ---------------- */
const COLORS = { Black: '#0f0f0f', Bone: '#e8e2d4', 'Washed Black': '#34312d', Stone: '#b2aa9b', Blood: '#5c121a', Olive: '#4b4a36' };
function productSvg(color, variant, label) {
  const c = COLORS[color] || '#333';
  const light = variant === 2 ? '70%' : '28%';
  const back = variant === 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1500" width="1200" height="1500">
<defs><radialGradient id="l" cx="${light}" cy="22%" r="85%"><stop offset="0" stop-color="#3a3834"/><stop offset=".55" stop-color="#141413"/><stop offset="1" stop-color="#050505"/></radialGradient>
<linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient></defs>
<rect width="1200" height="1500" fill="url(#l)"/>
<g transform="translate(600 ${label === 'jogger' ? 820 : 760})">
${label === 'jogger'
  ? `<path d="M-230 -470 H230 L270 520 H60 L0 -150 L-60 520 H-270 Z" fill="${c}"/><path d="M-230 -470 H230 L270 520 H60 L0 -150 L-60 520 H-270 Z" fill="url(#g)"/>`
  : `<path d="M-160 -520 Q0 -600 160 -520 L420 -380 L520 60 L400 90 L330 -170 L330 520 H-330 L-330 -170 L-400 90 L-520 60 L-420 -380 Z" fill="${c}"/><path d="M-160 -520 Q0 -600 160 -520 L420 -380 L520 60 L400 90 L330 -170 L330 520 H-330 L-330 -170 L-400 90 L-520 60 L-420 -380 Z" fill="url(#g)"/>
<path d="M-110 -520 Q0 -420 110 -520" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="10"/>`}
${back ? `<text x="0" y="${label === 'jogger' ? -300 : -250}" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="64" fill="${color === 'Bone' || color === 'Stone' ? '#0a0a0a' : '#f4f1ea'}">FAITH</text><text x="0" y="${label === 'jogger' ? -240 : -190}" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="30" fill="#8c8c88">OVER FEAR</text>` : ''}
</g></svg>`;
}
const images = new Map(); // name -> svg
let mediaId = 1000;
function makeImage(name, svg, w = 1200, h = 1500, alt = '') {
  images.set(name, svg);
  const img = { __image: true, id: mediaId++, src: `/images/${name}.svg`, url: `/images/${name}.svg`, width: w, height: h, alt, aspect_ratio: w / h, media_type: 'image', presentation: { focal_point: '50% 40%' } };
  img.preview_image = { src: img.src, width: w, height: h, aspect_ratio: w / h, alt };
  return img;
}
function heroSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 1500" width="2400" height="1500"><defs><radialGradient id="a" cx="62%" cy="30%" r="70%"><stop offset="0" stop-color="#4a463f"/><stop offset=".5" stop-color="#151413"/><stop offset="1" stop-color="#030303"/></radialGradient></defs><rect width="2400" height="1500" fill="url(#a)"/><g fill="#0a0a0a" opacity=".92"><circle cx="1480" cy="520" r="120"/><path d="M1300 700 Q1480 620 1660 700 L1760 1500 H1200 Z"/></g><g fill="none" stroke="#f4f1ea" stroke-opacity=".08" stroke-width="3"><path d="M0 1200 Q1200 1000 2400 1250"/></g></svg>`;
}
class OptionValue extends Drop {
  constructor(name, selected, swatchHex) { super(); this.name = name; this.selected = selected; this.available = true; this.swatch = swatchHex ? { color: swatchHex } : null; }
  valueOf() { return this.name; } toString() { return this.name; }
}
function makeProduct({ title, handle, kind, colors, sizes, price, tags = [], allSoldOut = false, compare = 0, sizeName = 'Size', sizeOnly = false }) {
  const media = [];
  colors.forEach((c, i) => {
    media.push(makeImage(`${handle}-${i}-1`, productSvg(c, 1, kind), 1200, 1500, `${title} in ${c}, front`));
    if (i === 0) media.push(makeImage(`${handle}-${i}-2`, productSvg(c, 2, kind), 1200, 1500, `${title} in ${c}, back`));
  });
  const variants = [];
  let vid = Math.floor(Math.random() * 1e6) * 10;
  colors.forEach((c, ci) => sizes.forEach((s, si) => {
    const available = !allSoldOut && !tags.includes('coming-soon') && !(ci === 0 && si === sizes.length - 1);
    variants.push({ id: vid++, title: `${c} / ${s}`, options: [c, s], option1: c, option2: s, available, price, compare_at_price: compare || null, sku: `${handle}-${c}-${s}`.toUpperCase(), barcode: '', featured_media: media.find((m) => m.alt.includes(c)) || media[0], url: `/products/${handle}?variant=${vid - 1}` });
  }));
  const first = variants.find((v) => v.available) || variants[0];
  const opt = (name, values, pos, sel) => ({ name, position: pos, values: values.map((v) => new OptionValue(v, v === sel, name === 'Color' ? COLORS[v] : null)), selected_value: sel });
  const colorOpt = opt('Color', colors, 1, first.options[0]);
  const sizeOpt = opt(sizeName, sizes, 2, first.options[1]);
  return {
    id: Math.floor(Math.random() * 1e9), title, handle, url: `/products/${handle}`, vendor: 'EDEN', type: kind === 'jogger' ? 'Joggers' : 'Hoodies', tags,
    price, price_min: price, price_varies: false, compare_at_price: compare || null, available: variants.some((v) => v.available),
    description: `<p>Heavyweight 480 GSM brushed-back fleece. Oversized fit, dropped shoulders, double-layer hood. FAITH OVER FEAR on the chest, the crossed nails on the back.</p><ul><li>100% organic cotton</li><li>Made to order</li></ul>`,
    featured_media: media[0], featured_image: media[0], images: media, media,
    options: ['Color', sizeName], options_with_values: [colorOpt, sizeOpt], options_by_name: { Color: colorOpt, color: colorOpt, [sizeName]: sizeOpt, [sizeName.toLowerCase()]: sizeOpt },
    has_only_default_variant: false, variants, selected_variant: null, selected_or_first_available_variant: first, first_available_variant: first,
    metafields: { custom: {} },
    ...(sizeOnly ? sizeOnlyShape(variants, sizeName, sizes, first) : {}),
  };
}
// One product per colour (the EDEN catalog CSV): a single Size option.
function sizeOnlyShape(variants, sizeName, sizes, first) {
  const vs = variants.map((v) => ({ ...v, title: v.options[1], options: [v.options[1]], option1: v.options[1], option2: null }));
  const f = vs.find((v) => v.id === first.id);
  const sizeOpt = { name: sizeName, position: 1, values: sizes.map((v) => new OptionValue(v, v === f.options[0], null)), selected_value: f.options[0] };
  return { variants: vs, options: [sizeName], options_with_values: [sizeOpt], options_by_name: { [sizeName]: sizeOpt, [sizeName.toLowerCase()]: sizeOpt }, selected_or_first_available_variant: f, first_available_variant: f };
}
const P = [
  makeProduct({ title: 'Faith Over Fear Hoodie', handle: 'faith-over-fear-hoodie', kind: 'hoodie', colors: ['Black', 'Bone', 'Washed Black', 'Stone', 'Blood'], sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], price: 11000 }),
  makeProduct({ title: 'Faith Over Fear Jogger', handle: 'faith-over-fear-jogger', kind: 'jogger', colors: ['Black', 'Bone', 'Washed Black', 'Stone', 'Blood'], sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], price: 9000 }),
  makeProduct({ title: 'He Is Risen Hoodie', handle: 'he-is-risen-hoodie', kind: 'hoodie', colors: ['Bone', 'Black'], sizes: ['S', 'M', 'L', 'XL'], price: 11000, sizeName: 'Talla' }),
  makeProduct({ title: 'He Is Risen Jogger', handle: 'he-is-risen-jogger', kind: 'jogger', colors: ['Bone', 'Black'], sizes: ['S', 'M', 'L', 'XL'], price: 9000 }),
  makeProduct({ title: 'Be Still Hoodie', handle: 'be-still-hoodie', kind: 'hoodie', colors: ['Olive', 'Black', 'Stone'], sizes: ['S', 'M', 'L', 'XL'], price: 11500, tags: ['coming-soon'] }),
  makeProduct({ title: 'Be Still Jogger', handle: 'be-still-jogger', kind: 'jogger', colors: ['Olive', 'Black'], sizes: ['S', 'M', 'L', 'XL'], price: 9500, allSoldOut: true }),
];
P[0].metafields.custom.complete_the_set = { value: P[1] };
P[0].metafields.custom.ships_in_days = { value: '7–10' };
// Grouped products (tags group:/color:) → colour links on the product page. Only in collections.all.
const GROUPED = ['Black', 'Olive', 'Stone'].map((c) => makeProduct({ title: `Hoodie Eden — ${c}`, handle: `hoodie-eden-${c.toLowerCase()}`, kind: 'hoodie', colors: [c], sizes: ['S', 'M', 'L', 'XL', '2XL'], price: 9500, sizeOnly: true, tags: ['chapter-001', 'group:hoodie-eden', `color:${c}`] }));
const byHandle = Object.fromEntries([...P, ...GROUPED].map((p) => [p.handle, p]));
const filters = [
  { type: 'list', label: 'Color', param_name: 'filter.v.option.color', active_values: [], values: Object.keys(COLORS).map((c) => ({ label: c, value: c, param_name: 'filter.v.option.color', count: 2, active: false, swatch: { color: COLORS[c] } })) },
  { type: 'list', label: 'Size', param_name: 'filter.v.option.size', active_values: [], values: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((s) => ({ label: s, value: s, param_name: 'filter.v.option.size', count: s === 'XS' ? 0 : 4, active: false })) },
  { type: 'price_range', label: 'Price', param_name: 'filter.v.price', range_max: 11500, min_value: { param_name: 'filter.v.price.gte', value: null }, max_value: { param_name: 'filter.v.price.lte', value: null }, url_to_remove: '/collections/chapter-001' },
];
const COLLECTION = {
  id: 1, handle: 'chapter-001', title: 'Chapter 001', url: '/collections/chapter-001', description: '<p>Six pieces. Three lines. One idea: faith over fear.</p>',
  products: P, all_products_count: P.length, products_count: P.length, filters, sort_by: 'manual', default_sort_by: 'manual',
  sort_options: [{ name: 'Featured', value: 'manual' }, { name: 'Price, low to high', value: 'price-ascending' }, { name: 'Price, high to low', value: 'price-descending' }, { name: 'Newest', value: 'created-descending' }],
  featured_image: P[0].featured_media, image: null,
};

// Shopify's `collections` is iterable and also exposes collections.all (every product).
const ALL_COLLECTIONS = [COLLECTION];
ALL_COLLECTIONS.all = { ...COLLECTION, id: 0, handle: 'all', title: 'Products', url: '/collections/all', description: '', products: [...P, ...GROUPED], products_count: P.length + GROUPED.length, all_products_count: P.length + GROUPED.length };
// EMPTY_STORE=1: a freshly installed store (no products, no images) to check the built-in placeholders.
const EMPTY = !!process.env.EMPTY_STORE;
if (EMPTY) Object.assign(ALL_COLLECTIONS.all, { products: [], products_count: 0, all_products_count: 0 });
const LINKLISTS = {
  'main-menu': { links: [{ title: 'Chapter 001', url: '/collections/chapter-001', links: [] }, { title: 'Hoodies', url: '/collections/chapter-001', links: [] }, { title: 'Joggers', url: '/collections/chapter-001', links: [] }, { title: 'Our story', url: '/pages/our-story', links: [] }] },
  footer: { links: [{ title: 'FAQ', url: '/pages/faq', links: [] }, { title: 'Contact', url: '/pages/contact', links: [] }, { title: 'Shipping', url: '/policies/shipping-policy', links: [] }, { title: 'Terms', url: '/policies/terms-of-service', links: [] }] },
};
/* ---------------- Cart ---------------- */
const cart = { items: [], note: '' };
const allVariants = () => P.flatMap((p) => p.variants.map((v) => ({ v, p })));
function cartDrop() {
  const items = cart.items.map((it, i) => {
    const { v, p } = allVariants().find((x) => x.v.id === it.id);
    return { key: `${it.id}:k`, id: it.id, index: i + 1, quantity: it.qty, title: `${p.title} - ${v.title}`, product: p, variant: v, url: v.url, image: v.featured_media, final_line_price: v.price * it.qty, original_line_price: v.price * it.qty, final_price: v.price, options_with_values: [{ name: 'Color', value: v.options[0] }, { name: 'Size', value: v.options[1] }], properties: [], line_level_discount_allocations: [], url_to_remove: `/cart/change?id=${it.id}&quantity=0` };
  });
  return { items, item_count: items.reduce((a, b) => a + b.quantity, 0), total_price: items.reduce((a, b) => a + b.final_line_price, 0), note: cart.note, currency: { iso_code: 'USD', symbol: '$' }, cart_level_discount_applications: [], taxes_included: false };
}

/* ---------------- Liquid engine ---------------- */
const engine = new Liquid({ root: [path.join(THEME, 'snippets'), path.join(THEME, 'sections'), path.join(THEME, 'layout')], extname: '.liquid', strictFilters: true, jsTruthy: false, dynamicPartials: true, relativeReference: false });
const money = (c) => (c == null ? '' : `$${(Number(c) / 100).toFixed(2)}`);
const lookup = (key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), locale);
engine.registerFilter('t', (key, ...args) => {
  const opts = {};
  for (const a of args) if (Array.isArray(a)) opts[a[0]] = a[1];
  let v = lookup(key);
  if (v == null) return `translation missing: ${key}`;
  if (typeof v === 'object') v = opts.count === 1 ? v.one : v.other;
  return String(v).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (opts[k] ?? ''));
});
const imgUrl = (img) => (typeof img === 'string' ? img : img && (img.src || img.url || (img.preview_image && img.preview_image.src))) || '';
engine.registerFilter('asset_url', (f) => `/assets/${f}`);
engine.registerFilter('shopify_asset_url', (f) => `/shopify/${f}`);
engine.registerFilter('image_url', (img, ...args) => { const u = imgUrl(img); const w = args.find((a) => a[0] === 'width'); return u ? `${u}?width=${w ? w[1] : ''}` : ''; });
engine.registerFilter('image_tag', (url, ...args) => {
  const o = Object.fromEntries(args.filter(Array.isArray));
  const base = String(url).split('?')[0];
  const widths = String(o.widths || '').split(',').map((s) => s.trim()).filter(Boolean);
  const attrs = { src: url, alt: o.alt ?? '', width: 1200, height: 1500 };
  if (base.includes('hero')) { attrs.width = 2400; attrs.height = 1500; }
  if (widths.length) attrs.srcset = widths.map((w) => `${base}?width=${w} ${w}w`).join(', ');
  for (const [k, v] of Object.entries(o)) if (!['widths', 'alt', 'preload'].includes(k)) attrs[k] = v;
  return `<img ${Object.entries(attrs).map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ')}>`;
});
engine.registerFilter('stylesheet_tag', (u) => `<link href="${u}" rel="stylesheet" type="text/css" media="all">`);
engine.registerFilter('preload_tag', (u, ...args) => { const o = Object.fromEntries(args); return `<link rel="preload" href="${u}" as="${o.as}" type="${o.type}" crossorigin="${o.crossorigin}">`; });
engine.registerFilter('money', money);
engine.registerFilter('money_with_currency', (c) => `${money(c)} USD`);
engine.registerFilter('money_without_currency', (c) => (c == null ? '' : (Number(c) / 100).toFixed(2)));
engine.registerFilter('placeholder_svg_tag', (n, cls) => `<svg class="${cls}" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"></svg>`);
engine.registerFilter('payment_type_svg_tag', (t) => `<svg viewBox="0 0 38 24" width="38" height="24" role="img" aria-label="${t}"><rect width="38" height="24" rx="3" fill="#222"/></svg>`);
engine.registerFilter('link_to', (t, u) => `<a href="${u}">${t}</a>`);
engine.registerFilter('handle', (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerFilter('url_encode', (s) => encodeURIComponent(s ?? ''));
engine.registerFilter('time_tag', (d) => `<time>${d}</time>`);
engine.registerFilter('default_errors', () => 'Error');
engine.registerFilter('format_address', () => 'Address');
engine.registerFilter('format_code', (s) => s);
engine.registerFilter('payment_button', () => '<div class="shopify-payment-button"><button class="shopify-payment-button__button shopify-payment-button__button--unbranded" type="button">Buy it now</button></div>');
engine.registerFilter('structured_data', () => '');
engine.registerFilter('video_tag', () => '<video></video>');
engine.registerFilter('external_video_tag', () => '<iframe title="video"></iframe>');

// Tags
engine.registerTag('schema', { parse(t, remain) { this.tpls = []; const stream = this.liquid.parser.parseStream(remain); stream.on('tag:endschema', () => stream.stop()).on('template', () => {}).on('end', () => { throw new Error('schema not closed'); }); stream.start(); }, render() { return ''; } });
for (const name of ['doc', 'comment_block']) {
  engine.registerTag(name, { parse(t, remain) { const stream = this.liquid.parser.parseStream(remain); stream.on(`tag:end${name}`, () => stream.stop()).on('template', () => {}).on('end', () => { throw new Error(`${name} not closed`); }); stream.start(); }, render() { return ''; } });
}
engine.registerTag('layout', { parse() {}, render() { return ''; } });
class FormTag extends Tag {
  constructor(token, remain, liquid) {
    super(token, remain, liquid);
    const m = token.args.match(/^\s*'([^']+)'\s*,?\s*(.*)$/s);
    this.type = m[1]; this.rest = m[2];
    this.tpls = [];
    const stream = liquid.parser.parseStream(remain);
    stream.on('tag:endform', () => stream.stop()).on('template', (tpl) => this.tpls.push(tpl)).on('end', () => { throw new Error('form not closed'); });
    stream.start();
  }
  * render(ctx, emitter) {
    const attrs = {};
    for (const mm of this.rest.matchAll(/(\w[\w-]*):\s*('([^']*)'|[\w.]+)/g)) attrs[mm[1]] = mm[3] ?? (yield this.liquid.evalValue(mm[2], ctx));
    const action = { product: '/cart/add', customer: '/contact#newsletter', localization: '/localization', contact: '/contact' }[this.type] || '/';
    ctx.push({ form: { errors: null, posted_successfully: false, password_needed: true } });
    emitter.write(`<form method="post" action="${action}"${attrs.id ? ` id="${attrs.id}"` : ''}${attrs.class ? ` class="${attrs.class}"` : ''}${attrs.novalidate ? ' novalidate' : ''}>`);
    yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    emitter.write('</form>');
    ctx.pop();
  }
}
engine.registerTag('form', FormTag);
class PaginateTag extends Tag {
  constructor(token, remain, liquid) {
    super(token, remain, liquid);
    const m = token.args.match(/^\s*([\w.]+)\s+by\s+([\w.]+)/);
    this.coll = m[1]; this.by = m[2]; this.tpls = [];
    const stream = liquid.parser.parseStream(remain);
    stream.on('tag:endpaginate', () => stream.stop()).on('template', (tpl) => this.tpls.push(tpl)).on('end', () => { throw new Error('paginate not closed'); });
    stream.start();
  }
  * render(ctx, emitter) {
    ctx.push({ paginate: { pages: 1, current_page: 1, parts: [], previous: null, next: null } });
    yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
    ctx.pop();
  }
}
engine.registerTag('paginate', PaginateTag);

/* ---------------- Section rendering ---------------- */
function schemaOf(type) {
  const src = fs.readFileSync(path.join(THEME, 'sections', `${type}.liquid`), 'utf8');
  const m = src.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  return m ? JSON.parse(m[1]) : {};
}
function sectionDrop(id, data, index) {
  const schema = schemaOf(data.type);
  const defaults = {};
  for (const s of schema.settings || []) if ('default' in s) defaults[s.id] = s.default;
  const settings = { ...defaults, ...(data.settings || {}) };
  for (const s of schema.settings || []) {
    if (s.type === 'collection' && typeof settings[s.id] === 'string') settings[s.id] = settings[s.id] === 'chapter-001' && !process.env.NO_CHAPTER && !EMPTY ? COLLECTION : null;
    if (s.type === 'image_picker' && settings[s.id] === undefined) settings[s.id] = null;
    if (s.type === 'image_picker' && s.id === 'image' && data.type === 'hero' && !EMPTY) settings.image = makeImage('hero', heroSvg(), 2400, 1500, 'Model in the Faith Over Fear hoodie');
    if (s.type === 'link_list' && typeof settings[s.id] === 'string') settings[s.id] = LINKLISTS[settings[s.id]] || { links: [] };
    if (s.type === 'url' && typeof settings[s.id] === 'string' && settings[s.id].startsWith('shopify://')) settings[s.id] = '/' + settings[s.id].replace('shopify://', '');
  }
  const blocks0 = (data.block_order || Object.keys(data.blocks || {})).map((bid) => {
    const b = data.blocks[bid];
    const bschema = (schema.blocks || []).find((x) => x.type === b.type) || {};
    const bdef = {};
    for (const s of bschema.settings || []) if ('default' in s) bdef[s.id] = s.default;
    const bs = { ...bdef, ...(b.settings || {}) };
    for (const st of bschema.settings || []) if (st.type === 'link_list' && typeof bs[st.id] === 'string') bs[st.id] = LINKLISTS[bs[st.id]] || { links: [] };
    return { id: bid, type: b.type, settings: bs, shopify_attributes: '' };
  });
  const blocks = blocks0;
  return { schema, drop: { id, settings, blocks, index } };
}
async function renderSection(id, data, ctxBase, index, groupClass = '') {
  const { schema, drop } = sectionDrop(id, data, index);
  const html = await engine.renderFile(data.type, { section: drop }, { globals: ctxBase });
  const tag = schema.tag || 'div';
  return `<${tag} id="shopify-section-${id}" class="shopify-section${groupClass}${schema.class ? ' ' + schema.class : ''}">${html}</${tag}>`;
}
async function renderJSONTemplate(file, ctxBase) {
  const tpl = readJSON(path.join(THEME, 'templates', file));
  let out = '';
  let i = 1;
  for (const key of tpl.order) out += await renderSection(`template--1__${key}`, tpl.sections[key], ctxBase, i++);
  return { html: out, layout: tpl.layout || 'theme' };
}
async function renderGroup(name, ctxBase) {
  const g = readJSON(path.join(THEME, 'sections', `${name}.json`));
  let out = '';
  for (const key of g.order) out += await renderSection(`sections--1__${key}`, g.sections[key], ctxBase, 0, ` shopify-section-group-${name}`);
  return out;
}
// {% sections 'x' %} and {% section 'x' %}
engine.registerTag('sections', { parse(token) { this.name = token.args.trim().replace(/'/g, ''); }, * render(ctx) { return yield renderGroup(this.name, ctx.getAll()); } });
engine.registerTag('section', { parse(token) { this.name = token.args.trim().replace(/'/g, ''); }, * render(ctx) { return yield renderSection(this.name, { type: this.name, settings: {} }, ctx.getAll(), 0); } });

function baseContext(req, extra = {}) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  return {
    settings: SETTINGS, shop: { name: 'EDEN', url: `http://localhost:${PORT}`, description: 'Faith over fear. Christian streetwear.', money_format: '${{amount}}', customer_accounts_enabled: true, enabled_payment_types: ['visa', 'master', 'american_express', 'paypal', 'apple_pay'], password_message: '', shipping_policy: { body: 'x', url: '/policies/shipping-policy' }, checkout: { guest_login: false } },
    routes: { root_url: '/', cart_url: '/cart', cart_add_url: '/cart/add', cart_change_url: '/cart/change', cart_update_url: '/cart/update', search_url: '/search', predictive_search_url: '/search/suggest', account_url: '/account', account_login_url: '/account/login', account_register_url: '/account/register', account_logout_url: '/account/logout', account_addresses_url: '/account/addresses', all_products_collection_url: '/collections/all', product_recommendations_url: '/recommendations/products' },
    request: { page_type: extra.page_type || 'index', design_mode: false, locale: { iso_code: 'en' }, origin: `http://localhost:${PORT}`, path: url.pathname },
    localization: { available_countries: [{ iso_code: 'US', name: 'United States', currency: { iso_code: 'USD', symbol: '$' } }, { iso_code: 'GB', name: 'United Kingdom', currency: { iso_code: 'GBP', symbol: '£' } }, { iso_code: 'CA', name: 'Canada', currency: { iso_code: 'CAD', symbol: '$' } }, { iso_code: 'AU', name: 'Australia', currency: { iso_code: 'AUD', symbol: '$' } }], available_languages: [{ iso_code: 'en', endonym_name: 'English' }], country: { iso_code: 'US' }, language: { iso_code: 'en' } },
    cart: cartDrop(), customer: null, canonical_url: `http://localhost:${PORT}${url.pathname}`, page_title: extra.page_title || 'EDEN', page_description: 'Faith over fear.', current_page: 1, current_tags: null,
    template: new TemplateDrop(extra.template || 'index'), content_for_header: '', powered_by_link: '<a href="https://shopify.com">Shopify</a>',
    recommendations: { performed: false, products_count: 0, products: [] }, collections: ALL_COLLECTIONS, all_products: byHandle, additional_checkout_buttons: false,
    ...extra,
  };
}

async function renderPage(req, templateFile, extra) {
  const ctx = baseContext(req, extra);
  const { html, layout } = await renderJSONTemplate(templateFile, ctx);
  return engine.renderFile(layout, { content_for_layout: html }, { globals: ctx });
}

/* ---------------- HTTP ---------------- */
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.json': 'application/json' };
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
async function sectionsFor(req, ids) {
  const out = {};
  for (const id of String(ids || '').split(',').filter(Boolean)) {
    if (id === 'cart-drawer') out[id] = await renderSection('cart-drawer', { type: 'cart-drawer', settings: {} }, baseContext(req), 0);
  }
  return out;
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (code, body, type = 'text/html; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
  try {
    if (url.pathname.startsWith('/assets/')) {
      const f = path.join(THEME, 'assets', path.basename(url.pathname));
      return send(200, fs.readFileSync(f), TYPES[path.extname(f)] || 'application/octet-stream');
    }
    if (url.pathname.startsWith('/images/')) return send(200, images.get(path.basename(url.pathname, '.svg')) || '', 'image/svg+xml');
    if (url.pathname.startsWith('/shopify/')) return send(200, '', 'text/javascript');
    if (url.pathname === '/cart/add.js' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      for (const it of body.items) {
        const found = allVariants().find((x) => x.v.id === +it.id);
        if (!found || !found.v.available) return send(422, JSON.stringify({ status: 422, message: 'Sold out', description: 'That size is sold out.' }), 'application/json');
        const ex = cart.items.find((c) => c.id === +it.id);
        if (ex) ex.qty += it.quantity || 1; else cart.items.push({ id: +it.id, qty: it.quantity || 1 });
      }
      return send(200, JSON.stringify({ items: body.items, sections: await sectionsFor(req, body.sections) }), 'application/json');
    }
    if (url.pathname === '/cart/change.js' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      const id = parseInt(String(body.id), 10);
      const ex = cart.items.find((c) => c.id === id);
      if (ex) { ex.qty = body.quantity; if (!ex.qty) cart.items = cart.items.filter((c) => c !== ex); }
      return send(200, JSON.stringify({ item_count: cartDrop().item_count, sections: await sectionsFor(req, body.sections) }), 'application/json');
    }
    if (url.pathname === '/cart/update.js') { const b = JSON.parse(await readBody(req)); cart.note = b.note || ''; return send(200, '{}', 'application/json'); }
    if (url.pathname === '/__reset') { cart.items = []; return send(200, 'ok'); }
    if (url.searchParams.get('section_id') === 'predictive-search') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const products = P.filter((p) => p.title.toLowerCase().includes(q));
      const html = await renderSection('predictive-search', { type: 'predictive-search', settings: {} }, baseContext(req, { predictive_search: { performed: true, terms: q, resources: { products, queries: [], collections: [] } } }), 0);
      return send(200, html);
    }
    if (url.pathname.startsWith('/recommendations/products')) {
      const sid = url.searchParams.get('section_id');
      const type = sid.split('__')[1] === 'set' ? 'complete-the-set' : 'product-recommendations';
      const tpl = readJSON(path.join(THEME, 'templates/product.json'));
      const data = tpl.sections[sid.split('__')[1]];
      const html = await renderSection(sid, { ...data, type }, baseContext(req, { product: null, recommendations: { performed: true, products_count: 3, products: P.slice(2, 6) } }), 0);
      return send(200, html);
    }
    if (url.pathname.startsWith('/collections/')) {
      if (url.searchParams.get('section_id')) {
        return send(200, await renderSection(url.searchParams.get('section_id'), { type: 'main-collection', settings: readJSON(path.join(THEME, 'templates/collection.json')).sections.main.settings }, baseContext(req, { collection: COLLECTION, page_type: 'collection', template: 'collection' }), 1));
      }
      return send(200, await renderPage(req, 'collection.json', { collection: COLLECTION, page_type: 'collection', template: 'collection', page_title: 'Chapter 001' }));
    }
    if (url.pathname.startsWith('/products/')) {
      const p = byHandle[url.pathname.split('/')[2]];
      if (!p) return send(404, await renderPage(req, '404.json', { page_type: '404', template: '404' }));
      return send(200, await renderPage(req, 'product.json', { product: p, page_type: 'product', template: 'product', page_title: p.title, page_image: p.featured_media }));
    }
    if (url.pathname === '/cart') return send(200, await renderPage(req, 'cart.json', { page_type: 'cart', template: 'cart', page_title: 'Your bag' }));
    if (url.pathname === '/search') return send(200, await renderPage(req, 'search.json', { page_type: 'search', template: 'search', search: { performed: !!url.searchParams.get('q'), terms: url.searchParams.get('q'), results: P, results_count: P.length, filters, sort_options: COLLECTION.sort_options, sort_by: 'relevance', default_sort_by: 'relevance' } }));
    if (url.pathname === '/pages/our-story') return send(200, await renderPage(req, 'page.story.json', { page_type: 'page', template: 'page', page: { title: 'Our story', content: '' } }));
    if (url.pathname === '/pages/faq') return send(200, await renderPage(req, 'page.faq.json', { page_type: 'page', template: 'page', page: { title: 'FAQ', content: '' } }));
    if (url.pathname === '/pages/contact') return send(200, await renderPage(req, 'page.contact.json', { page_type: 'page', template: 'page', page: { title: 'Contact', content: '<p>We read everything.</p>' } }));
    if (url.pathname === '/password') return send(200, await renderPage(req, 'password.json', { page_type: 'password', template: 'password' }));
    if (url.pathname === '/account/login') return send(200, await renderPage(req, 'customers/login.json', { page_type: 'customers/login', template: 'customers/login' }));
    if (url.pathname === '/') return send(200, await renderPage(req, 'index.json', { page_type: 'index', template: 'index' }));
    return send(404, await renderPage(req, '404.json', { page_type: '404', template: '404' }));
  } catch (err) {
    console.error(err);
    send(500, `<pre>${String(err.stack || err).replace(/</g, '&lt;')}</pre>`);
  }
});
server.listen(PORT, () => console.log(`EDEN preview on http://localhost:${PORT}`));
