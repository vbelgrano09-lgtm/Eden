/*
 * EDEN — product.js
 * Variant picker, gallery + zoom, sticky mobile add-to-bag bar,
 * size guide units and lazy product recommendations.
 */
(() => {
  const EDEN = (window.EDEN = window.EDEN || {});
  const strings = EDEN.strings || {};
  const html = document.documentElement;
  const motionOK = html.classList.contains('motion-ok');
  const behavior = motionOK ? 'smooth' : 'auto';
  const utils = () => EDEN.utils || {};

  const formatMoney = (cents, format) => {
    const fmt = format || '${{amount}}';
    const n = Number(cents) / 100;
    const group = (value, decimals, thousands = ',', decimal = '.') => {
      const [int, dec] = value.toFixed(decimals).split('.');
      return int.replace(/\B(?=(\d{3})+(?!\d))/g, thousands) + (dec ? decimal + dec : '');
    };
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/, (_, key) => {
      switch (key) {
        case 'amount_no_decimals':
          return group(n, 0);
        case 'amount_with_comma_separator':
          return group(n, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator':
          return group(n, 0, '.', ',');
        case 'amount_with_apostrophe_separator':
          return group(n, 2, "'", '.');
        case 'amount_with_space_separator':
          return group(n, 2, ' ', ',');
        case 'amount_no_decimals_with_space_separator':
          return group(n, 0, ' ', ',');
        default:
          return group(n, 2);
      }
    });
  };

  const scrollToEl = (el, offset = 120) => {
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    if (EDEN.motion && EDEN.motion.scrollTo) EDEN.motion.scrollTo(top);
    else window.scrollTo({ top, behavior });
  };

  /* ------------------------------------------------------------------
   * Variant picker
   * ------------------------------------------------------------------ */
  class VariantPicker extends HTMLElement {
    connectedCallback() {
      if (this._bound) return;
      const json = this.querySelector('[data-product-json]');
      if (!json) return;
      this._bound = true;
      this.data = JSON.parse(json.textContent);
      this.section = this.closest('.pdp') || document;
      this.formId = this.dataset.form;
      this.form = document.getElementById(this.formId);
      this.idInput = this.form ? this.form.querySelector('[data-variant-id-input]') : null;
      this.fieldsets = Array.from(this.querySelectorAll('fieldset[data-option-index]'));
      this.addEventListener('change', () => this.onChange());
      this.section.addEventListener('product-form:needs-option', () => this.promptMissing());
      this.updateAvailability();
    }

    selected() {
      return this.fieldsets.map((fs) => {
        const input = fs.querySelector('input:checked');
        return input ? input.value : null;
      });
    }

    findVariant(sel) {
      if (sel.includes(null)) return null;
      return this.data.variants.find((v) => v.options.every((o, i) => o === sel[i])) || null;
    }

    onChange() {
      const sel = this.selected();
      this.fieldsets.forEach((fs, i) => {
        const out = fs.querySelector('[data-option-value]');
        if (out) out.textContent = sel[i] || '';
        fs.classList.remove('is-missing');
      });
      this.updateAvailability();
      this.render(this.findVariant(sel), sel);
    }

    updateAvailability() {
      const sel = this.selected();
      this.fieldsets.forEach((fs, i) => {
        fs.querySelectorAll('input').forEach((input) => {
          const ok = this.data.variants.some(
            (v) => v.available && v.options.every((o, j) => (j === i ? o === input.value : sel[j] == null || o === sel[j]))
          );
          const label = input.nextElementSibling;
          if (!label) return;
          label.classList.toggle('is-unavailable', !ok);
          let note = label.querySelector('[data-soldout-note]');
          if (!ok && !note) {
            note = document.createElement('span');
            note.className = 'visually-hidden';
            note.dataset.soldoutNote = '';
            note.textContent = ` — ${strings.soldOut}`;
            label.appendChild(note);
          } else if (ok && note) {
            note.remove();
          }
        });
      });
    }

    render(variant, sel) {
      const buttons = Array.from(document.querySelectorAll(`[data-atc][form="${this.formId}"]`)).concat(
        this.form ? Array.from(this.form.querySelectorAll('[data-atc]')) : []
      );
      let label = strings.addToBag;
      let disabled = false;
      if (!variant) {
        label = sel.includes(null) ? strings.selectSize : strings.unavailable;
        disabled = !sel.includes(null);
      } else if (!variant.available) {
        label = strings.soldOut;
        disabled = true;
      }
      buttons.forEach((btn) => {
        btn.disabled = disabled;
        const l = btn.querySelector('[data-atc-label]');
        if (l) l.textContent = label;
      });

      if (this.idInput) this.idInput.value = variant ? variant.id : '';

      if (variant) {
        const priceBox = this.section.querySelector('[data-product-price]');
        if (priceBox && !priceBox.dataset.static) {
          const price = formatMoney(variant.price, this.data.moneyFormat);
          const onSale = variant.compare > variant.price;
          priceBox.innerHTML =
            `<span class="price" data-price><span class="price__regular">${price}</span>` +
            (onSale ? `<s class="price__compare">${formatMoney(variant.compare, this.data.moneyFormat)}</s>` : '') +
            '</span>';
        }
        const sticky = this.section.querySelector('[data-sticky-price]');
        if (sticky) sticky.innerHTML = formatMoney(variant.price, this.data.moneyFormat);

        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState(window.history.state, '', url.toString());

        if (variant.media) {
          const gallery = this.section.querySelector('media-gallery');
          if (gallery && gallery.showMedia) gallery.showMedia(variant.media);
        }
        const error = this.section.querySelector('[data-form-error]');
        if (error) error.hidden = true;
      }

      const stickyVariant = this.section.querySelector('[data-sticky-variant]');
      if (stickyVariant) stickyVariant.textContent = variant ? variant.title : sel.filter(Boolean).join(' / ');

      this.section.dispatchEvent(new CustomEvent('variant:change', { detail: { variant }, bubbles: true }));
    }

    promptMissing() {
      const fs = this.fieldsets.find((f) => !f.querySelector('input:checked'));
      if (!fs) return;
      scrollToEl(fs);
      fs.classList.remove('is-missing');
      void fs.offsetWidth;
      fs.classList.add('is-missing');
      const first = fs.querySelector('input:not([disabled])');
      if (first) setTimeout(() => first.focus({ preventScroll: true }), motionOK ? 450 : 0);
    }
  }
  customElements.define('variant-picker', VariantPicker);

  /* ------------------------------------------------------------------
   * Media gallery: swipe counter (phones), variant image, zoom dialog
   * ------------------------------------------------------------------ */
  class MediaGallery extends HTMLElement {
    connectedCallback() {
      if (this._bound) return;
      this._bound = true;
      this.list = this.querySelector('[data-media-list]');
      this.counter = this.querySelector('[data-media-current]');
      this.dialog = document.getElementById(this.dataset.zoom);
      this.mobile = window.matchMedia('(max-width: 989px)');

      if (this.list && this.counter) {
        let raf = null;
        this.list.addEventListener(
          'scroll',
          () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
              raf = null;
              const i = Math.round(this.list.scrollLeft / Math.max(1, this.list.clientWidth));
              this.counter.textContent = String(i + 1);
            });
          },
          { passive: true }
        );
      }

      this.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-zoom-open]');
        if (btn) this.openZoom(btn.dataset.zoomOpen);
      });

      if (this.dialog) {
        this.dialog.addEventListener('click', (e) => {
          const img = e.target.closest('.zoom__img');
          if (!img || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
          const item = img.closest('.zoom__item');
          item.classList.toggle('is-zoomed');
          this.pan(e, item);
        });
        this.dialog.addEventListener('pointermove', (e) => {
          const item = e.target.closest('.zoom__item.is-zoomed');
          if (item) this.pan(e, item);
        });
      }
    }

    pan(e, item) {
      const r = item.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      item.style.setProperty('--zx', `${x}%`);
      item.style.setProperty('--zy', `${y}%`);
    }

    openZoom(id) {
      if (!this.dialog || typeof this.dialog.showModal !== 'function') return;
      this.dialog.showModal();
      const { lockScroll, unlockScroll } = utils();
      if (lockScroll) {
        lockScroll();
        this.dialog.addEventListener('close', () => unlockScroll(), { once: true });
      }
      const target = this.dialog.querySelector(`[data-zoom-item="${id}"]`);
      if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }

    showMedia(id) {
      if (!this.list) return;
      const item = this.list.querySelector(`[data-media-id="${id}"]`);
      if (!item) return;
      if (this.mobile.matches) {
        this.list.scrollTo({ left: item.offsetLeft - this.list.offsetLeft, behavior });
      } else if (item !== this.list.firstElementChild) {
        this.list.prepend(item);
        if (this.getBoundingClientRect().top < 0) scrollToEl(this, 100);
      }
    }
  }
  customElements.define('media-gallery', MediaGallery);

  /* ------------------------------------------------------------------
   * Sticky add-to-bag (phones): visible whenever the main button is not
   * ------------------------------------------------------------------ */
  class StickyAtc extends HTMLElement {
    connectedCallback() {
      if (this._bound) return;
      const form = document.getElementById(this.dataset.form);
      const main = form ? form.querySelector('[data-atc]') : null;
      if (!main) return;
      this._bound = true;
      this.hidden = false;
      this.mq = window.matchMedia('(max-width: 989px)');
      this.mainVisible = true;
      this.update = () => {
        const show = this.mq.matches && !this.mainVisible;
        this.classList.toggle('is-visible', show);
        this.inert = !show;
        this.setAttribute('aria-hidden', String(!show));
        document.body.classList.toggle('has-sticky-atc', show);
      };
      this.io = new IntersectionObserver(([entry]) => {
        this.mainVisible = entry.isIntersecting;
        this.update();
      });
      this.io.observe(main);
      this.mq.addEventListener('change', this.update);
      this.update();
    }
    disconnectedCallback() {
      if (this.io) this.io.disconnect();
      document.body.classList.remove('has-sticky-atc');
    }
  }
  customElements.define('sticky-atc', StickyAtc);

  /* ------------------------------------------------------------------
   * Size guide: cm / in
   * ------------------------------------------------------------------ */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.size-guide__unit');
    if (!btn) return;
    const dialog = btn.closest('dialog');
    const unit = btn.dataset.unit;
    dialog.querySelectorAll('.size-guide__unit').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    dialog.querySelectorAll('td[data-cm]').forEach((td) => {
      const cm = parseFloat(td.dataset.cm);
      if (Number.isNaN(cm)) return;
      td.textContent = unit === 'in' ? String(Math.round((cm / 2.54) * 2) / 2) : td.dataset.cm;
    });
  });

  /* ------------------------------------------------------------------
   * Product recommendations (related + complementary), loaded near view
   * ------------------------------------------------------------------ */
  class ProductRecommendations extends HTMLElement {
    connectedCallback() {
      if (this._bound || !this.dataset.url) return;
      this._bound = true;
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((en) => en.isIntersecting)) return;
          io.disconnect();
          this.load();
        },
        { rootMargin: '0px 0px 500px 0px' }
      );
      io.observe(this);
    }
    async load() {
      try {
        const res = await fetch(this.dataset.url);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const next = doc.querySelector(`product-recommendations[data-id="${this.dataset.id}"]`);
        if (next && next.querySelector('[data-product-handle]')) {
          this.innerHTML = next.innerHTML;
          this.classList.add('is-loaded');
          if (EDEN.motion) {
            EDEN.motion.reveal(this);
            EDEN.motion.refresh();
          }
        } else if (this.dataset.hideEmpty !== undefined) {
          const section = this.closest('.shopify-section');
          if (section) section.hidden = true;
        }
      } catch (err) {
        /* recommendations are optional */
      }
    }
  }
  customElements.define('product-recommendations', ProductRecommendations);
})();
