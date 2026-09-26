/*
 * EDEN — theme.js
 * Core storefront behaviour. No dependencies, loaded with `defer`.
 * Motion-only effects (Lenis, GSAP, cursor, WebGL) live in motion.js.
 */
(() => {
  const EDEN = (window.EDEN = window.EDEN || {});
  const html = document.documentElement;
  const settings = EDEN.settings || {};
  const strings = EDEN.strings || {};
  const routes = EDEN.routes || {};
  const motionOK = html.classList.contains('motion-ok');

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ------------------------------------------------------------------
   * Utilities
   * ------------------------------------------------------------------ */
  const debounce = (fn, wait = 250) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const announce = (message) => {
    const region = $('[data-live-region]');
    if (!region || !message) return;
    region.textContent = '';
    setTimeout(() => (region.textContent = message), 60);
  };

  const FOCUSABLE =
    'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

  let trapHandler = null;
  const trapFocus = (container, first) => {
    releaseFocus();
    trapHandler = (e) => {
      if (e.key !== 'Tab') return;
      const els = $$(FOCUSABLE, container).filter((el) => el.getClientRects().length);
      if (!els.length) return;
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || !container.contains(document.activeElement))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (document.activeElement === lastEl || !container.contains(document.activeElement))) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', trapHandler);
    const target = first || $(FOCUSABLE, container) || container;
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
  };
  const releaseFocus = () => {
    if (trapHandler) document.removeEventListener('keydown', trapHandler);
    trapHandler = null;
  };

  let locks = 0;
  const lockScroll = () => {
    if (locks++ === 0) {
      html.classList.add('is-locked');
      document.dispatchEvent(new CustomEvent('eden:scroll:lock'));
    }
  };
  const unlockScroll = () => {
    locks = Math.max(0, locks - 1);
    if (locks === 0) {
      html.classList.remove('is-locked');
      document.dispatchEvent(new CustomEvent('eden:scroll:unlock'));
    }
  };

  const shade = {
    el: null,
    handler: null,
    show(onClick) {
      this.el = this.el || $('[data-shade]');
      if (!this.el) return;
      this.handler = onClick;
      this.el.hidden = false;
      requestAnimationFrame(() => this.el.classList.add('is-visible'));
      this.el.onclick = () => this.handler && this.handler();
    },
    hide() {
      if (!this.el) return;
      this.el.classList.remove('is-visible');
      const el = this.el;
      setTimeout(() => {
        if (!el.classList.contains('is-visible')) el.hidden = true;
      }, 500);
      this.handler = null;
    },
  };

  const parseHTML = (text) => new DOMParser().parseFromString(text, 'text/html');

  EDEN.utils = { $, $$, debounce, announce, trapFocus, releaseFocus, lockScroll, unlockScroll, shade, parseHTML };

  /* ------------------------------------------------------------------
   * Drawer base: cart, menu, search, filters
   * ------------------------------------------------------------------ */
  class EdenDrawer extends HTMLElement {
    connectedCallback() {
      if (this._bound) return;
      this._bound = true;
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          e.stopPropagation();
          this.close();
        }
      });
      this.addEventListener('click', (e) => {
        if (e.target.closest('[data-drawer-close]')) this.close();
      });
    }
    get panel() {
      return this.querySelector('[data-drawer-panel]') || this;
    }
    get isOpen() {
      return this.panel.classList.contains('is-open');
    }
    open(opener) {
      if (this.isOpen) return;
      this.opener = opener || document.activeElement;
      this.panel.classList.add('is-open');
      this.setAttribute('aria-hidden', 'false');
      if (!this.hasAttribute('data-no-shade')) shade.show(() => this.close());
      lockScroll();
      trapFocus(this.panel, this.querySelector('[data-autofocus]'));
      $$('[aria-controls="' + this.id + '"]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
      this.dispatchEvent(new CustomEvent('drawer:open', { bubbles: true }));
    }
    close() {
      if (!this.isOpen) return;
      this.panel.classList.remove('is-open');
      this.setAttribute('aria-hidden', 'true');
      if (!this.hasAttribute('data-no-shade')) shade.hide();
      unlockScroll();
      releaseFocus();
      $$('[aria-controls="' + this.id + '"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      if (this.opener && document.contains(this.opener)) this.opener.focus({ preventScroll: true });
      this.dispatchEvent(new CustomEvent('drawer:close', { bubbles: true }));
    }
    toggle(opener) {
      this.isOpen ? this.close() : this.open(opener);
    }
  }
  customElements.define('eden-drawer', EdenDrawer);

  // Openers: <button data-drawer-open="CartDrawer" aria-controls="CartDrawer">
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-drawer-open]');
    if (!opener) return;
    const drawer = document.getElementById(opener.dataset.drawerOpen);
    if (!drawer || typeof drawer.open !== 'function') return;
    if (opener.id === 'HeaderCart' && (settings.cartType === 'page' || document.body.classList.contains('template-cart'))) return;
    e.preventDefault();
    drawer.toggle(opener);
  });

  /* ------------------------------------------------------------------
   * Cart API (AJAX) + Section Rendering
   * ------------------------------------------------------------------ */
  const Cart = {
    sectionIds() {
      const ids = ['cart-drawer'];
      $$('[data-cart-section]').forEach((el) => ids.push(el.dataset.cartSection));
      return ids;
    },

    async request(url, body) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status) {
        const error = new Error(data.description || data.message || strings.cartError);
        error.data = data;
        throw error;
      }
      return data;
    },

    async add(items) {
      const payload = { items, sections: this.sectionIds().join(','), sections_url: window.location.pathname };
      const data = await this.request(`${routes.cartAdd}.js`, payload);
      this.render(data.sections);
      document.dispatchEvent(new CustomEvent('eden:cart:added', { detail: data }));
      return data;
    },

    async change(key, quantity) {
      const payload = { id: key, quantity, sections: this.sectionIds().join(','), sections_url: window.location.pathname };
      const data = await this.request(`${routes.cartChange}.js`, payload);
      this.render(data.sections);
      return data;
    },

    async update(attributes) {
      return this.request(`${routes.cartUpdate}.js`, attributes);
    },

    render(sections) {
      if (!sections) return;
      Object.entries(sections).forEach(([id, markup]) => {
        if (!markup) return;
        const doc = parseHTML(markup);
        if (id === 'cart-drawer') {
          const drawer = $('#CartDrawer');
          const next = doc.querySelector('#CartDrawer');
          if (drawer && next) {
            const scroller = drawer.querySelector('[data-drawer-scroll]');
            const top = scroller ? scroller.scrollTop : 0;
            const focus = this.focusMemo(drawer);
            drawer.querySelector('[data-drawer-panel]').innerHTML = next.querySelector('[data-drawer-panel]').innerHTML;
            const newScroller = drawer.querySelector('[data-drawer-scroll]');
            if (newScroller) newScroller.scrollTop = top;
            this.restoreFocus(drawer, focus);
          }
          const count = doc.querySelector('[data-cart-count-source]');
          if (count) this.setCount(parseInt(count.dataset.cartCountSource, 10) || 0);
          return;
        }
        const target = $(`[data-cart-section="${id}"]`);
        const next = doc.querySelector(`[data-cart-section="${id}"]`);
        if (target && next) {
          const focus = this.focusMemo(target);
          target.innerHTML = next.innerHTML;
          this.restoreFocus(target, focus);
        }
      });
      document.dispatchEvent(new CustomEvent('eden:cart:updated'));
    },

    // Re-rendering replaces the markup; put keyboard focus back on the same control.
    focusMemo(scope) {
      const el = document.activeElement;
      if (!el || !scope.contains(el)) return null;
      const line = el.closest('[data-line-key]');
      const attrs = ['data-qty-change', 'data-line-remove', 'data-qty-input', 'data-drawer-close', 'data-cart-note'];
      const attr = attrs.find((a) => el.hasAttribute(a));
      return { key: line ? line.dataset.lineKey : null, attr, value: attr ? el.getAttribute(attr) : null };
    },
    restoreFocus(scope, memo) {
      if (!memo) return;
      let target = null;
      if (memo.key && memo.attr) {
        const line = scope.querySelector(`[data-line-key="${CSS.escape(memo.key)}"]`);
        if (line) target = line.querySelector(memo.value ? `[${memo.attr}="${memo.value}"]` : `[${memo.attr}]`);
      }
      if (!target && memo.attr === 'data-cart-note') target = scope.querySelector('[data-cart-note]');
      if (!target) target = scope.querySelector('[data-drawer-close]') || scope.querySelector('a, button');
      if (target) target.focus({ preventScroll: true });
    },

    setCount(count) {
      $$('[data-cart-count]').forEach((el) => {
        el.textContent = count > 0 ? count : '';
        el.classList.remove('is-bumped');
        void el.offsetWidth;
        el.classList.add('is-bumped');
      });
      $$('[data-cart-label]').forEach((el) => {
        el.textContent = (strings.cartCount || 'Bag, [count] items').replace('[count]', count);
      });
    },

    openDrawer(opener) {
      if (settings.cartType === 'page') {
        window.location.href = routes.cart;
        return;
      }
      const drawer = $('#CartDrawer');
      if (drawer) {
        drawer.close && drawer.isOpen && drawer.close();
        drawer.open(opener);
      }
    },
  };
  EDEN.cart = Cart;

  /* Line item controls — drawer and cart page share markup. */
  class CartItems extends HTMLElement {
    connectedCallback() {
      if (this._bound) return;
      this._bound = true;
      this.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-qty-change], [data-line-remove]');
        if (!btn) return;
        e.preventDefault();
        const line = btn.closest('[data-line-key]');
        if (!line) return;
        const input = line.querySelector('[data-qty-input]');
        let qty = 0;
        if (btn.hasAttribute('data-qty-change')) {
          qty = Math.max(0, (parseInt(input.value, 10) || 0) + parseInt(btn.dataset.qtyChange, 10));
        }
        this.update(line, qty);
      });
      this.addEventListener(
        'change',
        debounce((e) => {
          const input = e.target.closest('[data-qty-input]');
          if (!input) return;
          const line = input.closest('[data-line-key]');
          this.update(line, Math.max(0, parseInt(input.value, 10) || 0));
        }, 350)
      );
      this.addEventListener(
        'input',
        debounce((e) => {
          const note = e.target.closest('[data-cart-note]');
          if (note) Cart.update({ note: note.value }).catch(() => {});
        }, 500)
      );
    }
    async update(line, quantity) {
      const key = line.dataset.lineKey;
      line.classList.add('is-loading');
      try {
        await Cart.change(key, quantity);
        if (quantity === 0) announce(line.dataset.removedText || '');
      } catch (err) {
        line.classList.remove('is-loading');
        const error = line.querySelector('[data-line-error]');
        if (error) {
          error.textContent = err.message;
          error.hidden = false;
        }
        announce(err.message);
      }
    }
  }
  customElements.define('cart-items', CartItems);

  /* ------------------------------------------------------------------
   * Product form (PDP) + quick add (cards)
   * ------------------------------------------------------------------ */
  class ProductForm extends HTMLElement {
    connectedCallback() {
      if (this._bound) return;
      this._bound = true;
      this.form = this.querySelector('form');
      if (!this.form) return;
      this.form.addEventListener('submit', (e) => this.onSubmit(e));
    }
    get submitButtons() {
      const id = this.form.id;
      return $$(`[type="submit"][form="${id}"]`).concat($$('[type="submit"]', this.form));
    }
    showError(message) {
      const box = this.querySelector('[data-form-error]');
      if (box) {
        box.textContent = message || '';
        box.hidden = !message;
      }
      if (message) announce(message);
    }
    async onSubmit(e) {
      const idInput = this.form.querySelector('[name="id"]');
      if (!idInput || !idInput.value) {
        e.preventDefault();
        this.showError(strings.selectSize);
        this.dispatchEvent(new CustomEvent('product-form:needs-option', { bubbles: true }));
        return;
      }
      if (settings.cartType === 'page') return; // let the browser post to /cart/add
      e.preventDefault();
      const buttons = this.submitButtons;
      if (buttons.some((b) => b.classList.contains('is-loading'))) return;
      buttons.forEach((b) => {
        b.classList.add('is-loading');
        b.setAttribute('aria-disabled', 'true');
      });
      this.showError('');
      const fd = new FormData(this.form);
      const item = { id: fd.get('id'), quantity: parseInt(fd.get('quantity') || '1', 10) };
      const properties = {};
      for (const [k, v] of fd.entries()) {
        const m = k.match(/^properties\[(.+)\]$/);
        if (m && v) properties[m[1]] = v;
      }
      if (Object.keys(properties).length) item.properties = properties;
      if (fd.get('selling_plan')) item.selling_plan = fd.get('selling_plan');
      try {
        await Cart.add([item]);
        announce(strings.added);
        Cart.openDrawer(e.submitter || buttons[0]);
      } catch (err) {
        this.showError(err.message);
      } finally {
        buttons.forEach((b) => {
          b.classList.remove('is-loading');
          b.removeAttribute('aria-disabled');
        });
      }
    }
  }
  customElements.define('product-form', ProductForm);

  class QuickAdd extends HTMLElement {
    connectedCallback() {
      if (this._bound) return;
      this._bound = true;
      this.toggleBtn = this.querySelector('[data-quick-toggle]');
      if (this.toggleBtn) {
        this.toggleBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const open = !this.classList.contains('is-open');
          this.classList.toggle('is-open', open);
          this.toggleBtn.setAttribute('aria-expanded', String(open));
          if (open) {
            const first = this.querySelector('[data-variant-id]:not([disabled])');
            if (first) first.focus({ preventScroll: true });
          }
        });
      }
      this.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.classList.contains('is-open')) {
          this.classList.remove('is-open');
          this.toggleBtn && this.toggleBtn.setAttribute('aria-expanded', 'false');
          this.toggleBtn && this.toggleBtn.focus();
        }
      });
      this.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-variant-id]');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        btn.classList.add('is-loading');
        try {
          await Cart.add([{ id: parseInt(btn.dataset.variantId, 10), quantity: 1 }]);
          announce(strings.added);
          this.classList.remove('is-open');
          Cart.openDrawer(btn);
        } catch (err) {
          announce(err.message);
          btn.setAttribute('title', err.message);
        } finally {
          btn.classList.remove('is-loading');
        }
      });
    }
  }
  customElements.define('quick-add', QuickAdd);

  /* ------------------------------------------------------------------
   * Header: solid/transparent state, hide on scroll down, show on up
   * ------------------------------------------------------------------ */
  const initHeader = () => {
    const wrapper = $('.section-header');
    if (!wrapper) return;
    let lastY = window.scrollY;
    let ticking = false;
    const behaviour = (wrapper.querySelector('[data-header-behaviour]') || {}).dataset?.headerBehaviour || 'smart';
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      wrapper.classList.toggle('is-scrolled', y > 10);
      if (behaviour === 'smart' && !html.classList.contains('is-locked')) {
        const delta = y - lastY;
        if (y > 320 && delta > 6) wrapper.classList.add('is-hidden');
        else if (delta < -6 || y < 320) wrapper.classList.remove('is-hidden');
      }
      lastY = y;
    };
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    // Keyboard users must never lose the header.
    wrapper.addEventListener('focusin', () => wrapper.classList.remove('is-hidden'));
    update();
  };

  /* ------------------------------------------------------------------
   * Predictive search
   * ------------------------------------------------------------------ */
  class PredictiveSearch extends HTMLElement {
    connectedCallback() {
      if (this._bound) return;
      this._bound = true;
      this.input = this.querySelector('input[type="search"]');
      this.results = this.querySelector('[data-predictive-results]');
      if (!this.input || !this.results || !settings.predictiveSearch) return;
      this.input.addEventListener(
        'input',
        debounce(() => this.search(this.input.value.trim()), 260)
      );
    }
    async search(q) {
      if (this.controller) this.controller.abort();
      if (!q) {
        this.results.innerHTML = '';
        return;
      }
      this.controller = new AbortController();
      const params = new URLSearchParams({
        q,
        section_id: 'predictive-search',
        'resources[type]': 'product,query,collection',
        'resources[limit]': '4',
      });
      try {
        const res = await fetch(`${routes.predictiveSearch}?${params}`, { signal: this.controller.signal });
        if (!res.ok) throw new Error(res.status);
        const doc = parseHTML(await res.text());
        const markup = doc.querySelector('#shopify-section-predictive-search');
        this.results.innerHTML = markup ? markup.innerHTML : '';
        const status = this.results.querySelector('[data-predictive-status]');
        if (status) announce(status.textContent.trim());
      } catch (err) {
        if (err.name !== 'AbortError') this.results.innerHTML = '';
      }
    }
  }
  customElements.define('predictive-search', PredictiveSearch);

  /* ------------------------------------------------------------------
   * Countdown (announcement bar, drop section, password page)
   * ------------------------------------------------------------------ */
  const countdowns = new Set();
  let countdownTimer = null;
  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');

  class DropCountdown extends HTMLElement {
    connectedCallback() {
      const iso = this.dataset.target;
      this.target = iso ? new Date(iso) : null;
      this.startAt = this.dataset.start ? new Date(this.dataset.start) : null;
      if (!this.target || isNaN(this.target.getTime())) {
        this.classList.add('is-invalid');
        return;
      }
      countdowns.add(this);
      this.tick();
      if (!countdownTimer) countdownTimer = setInterval(() => countdowns.forEach((c) => c.tick()), 1000);
    }
    disconnectedCallback() {
      countdowns.delete(this);
      if (!countdowns.size && countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }
    tick() {
      const now = Date.now();
      const diff = this.target.getTime() - now;
      if (diff <= 0) {
        if (!this.classList.contains('is-live')) {
          this.classList.add('is-live');
          const scope = this.closest('[data-countdown-scope]') || this;
          scope.classList.add('is-live');
          $$('[data-countdown-text]', this).forEach((el) => (el.textContent = this.dataset.liveText || strings.liveNow));
          this.dispatchEvent(new CustomEvent('countdown:live', { bubbles: true }));
        }
        countdowns.delete(this);
        return;
      }
      const s = Math.floor(diff / 1000);
      const parts = {
        days: Math.floor(s / 86400),
        hours: Math.floor((s % 86400) / 3600),
        minutes: Math.floor((s % 3600) / 60),
        seconds: s % 60,
      };
      $$('[data-unit]', this).forEach((el) => {
        const v = pad(parts[el.dataset.unit]);
        if (el.textContent !== v) el.textContent = v;
      });
      $$('[data-countdown-text]', this).forEach((el) => {
        el.textContent = `${pad(parts.days)}D ${pad(parts.hours)}H ${pad(parts.minutes)}M ${pad(parts.seconds)}S`;
      });
      if (this.startAt && !isNaN(this.startAt.getTime())) {
        const total = this.target - this.startAt;
        const elapsed = Math.min(1, Math.max(0, (now - this.startAt) / total));
        this.style.setProperty('--elapsed', elapsed.toFixed(4));
      }
    }
  }
  customElements.define('drop-countdown', DropCountdown);

  /* ------------------------------------------------------------------
   * Marquee: CSS animation on the compositor; scroll only nudges its
   * playbackRate, so speed and direction follow the scroll.
   * ------------------------------------------------------------------ */
  class ScrollMarquee extends HTMLElement {
    connectedCallback() {
      if (!motionOK || this._bound) return;
      this._bound = true;
      this.track = this.querySelector('.marquee__track');
      if (!this.track || !this.track.getAnimations) return;
      this.reactive = this.dataset.reactive !== 'false';
      this.boost = parseFloat(this.dataset.boost || '4');
      this.rate = 1;
      this.target = 1;
      this.dir = 1;
      this.visible = false;

      const io = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        const anim = this.anim();
        if (!anim) return;
        this.visible ? anim.play() : anim.pause();
      });
      io.observe(this);
      this._io = io;

      if (!this.reactive) return;
      let lastY = window.scrollY;
      let lastT = performance.now();
      this.onScroll = () => {
        if (!this.visible) return;
        const y = window.scrollY;
        const t = performance.now();
        const v = (y - lastY) / Math.max(8, t - lastT);
        lastY = y;
        lastT = t;
        if (Math.abs(v) > 0.05) this.dir = v > 0 ? 1 : -1;
        this.target = this.dir * (1 + Math.min(Math.abs(v) * this.boost, 7));
        this.kick();
      };
      window.addEventListener('scroll', this.onScroll, { passive: true });
    }
    disconnectedCallback() {
      if (this.onScroll) window.removeEventListener('scroll', this.onScroll);
      if (this._io) this._io.disconnect();
      this._bound = false;
    }
    anim() {
      return this.track.getAnimations()[0];
    }
    kick() {
      if (this.raf) return;
      const step = () => {
        const anim = this.anim();
        this.target += (this.dir - this.target) * 0.04;
        this.rate += (this.target - this.rate) * 0.12;
        if (anim) {
          if (anim.updatePlaybackRate) anim.updatePlaybackRate(this.rate);
          else anim.playbackRate = this.rate;
        }
        if (Math.abs(this.rate - this.dir) < 0.01 && Math.abs(this.target - this.dir) < 0.01) {
          this.raf = null;
          return;
        }
        this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }
  }
  customElements.define('scroll-marquee', ScrollMarquee);

  /* ------------------------------------------------------------------
   * Gallery scroller: native horizontal scroll with buttons, arrow keys
   * and a progress bar. motion.js pins it on desktop instead.
   * ------------------------------------------------------------------ */
  class GalleryScroller extends HTMLElement {
    connectedCallback() {
      if (this._bound) return;
      this._bound = true;
      this.section = this.closest('[data-gallery], [data-carousel]') || this.parentElement;
      this.track = this.querySelector('[data-track], .gallery__track');
      this.prev = this.section.querySelector('[data-gallery-prev]');
      this.next = this.section.querySelector('[data-gallery-next]');
      const smooth = motionOK ? 'smooth' : 'auto';
      const step = () => {
        const item = this.track && this.track.querySelector('li');
        const gap = this.track ? parseFloat(getComputedStyle(this.track).columnGap) || 24 : 24;
        return item ? item.getBoundingClientRect().width + gap : this.clientWidth * 0.8;
      };
      const go = (dir) => this.scrollBy({ left: dir * step(), behavior: smooth });
      if (this.prev) this.prev.addEventListener('click', () => go(-1));
      if (this.next) this.next.addEventListener('click', () => go(1));
      if (this.track) {
        this.track.addEventListener('keydown', (e) => {
          if (this.section.classList.contains('is-pinned')) return;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            go(1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            go(-1);
          }
        });
      }
      const update = () => {
        if (this.section.classList.contains('is-pinned')) return;
        const max = this.scrollWidth - this.clientWidth;
        const p = max > 0 ? this.scrollLeft / max : 0;
        this.section.style.setProperty('--progress', p.toFixed(4));
        if (this.prev) this.prev.disabled = this.scrollLeft < 4;
        if (this.next) this.next.disabled = this.scrollLeft > max - 4;
      };
      this.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', debounce(update, 150));
      update();
    }
  }
  customElements.define('gallery-scroller', GalleryScroller);

  /* ------------------------------------------------------------------
   * Modals (native <dialog>): [data-modal-open="Id"]
   * ------------------------------------------------------------------ */
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-modal-open]');
    if (opener) {
      const dialog = document.getElementById(opener.dataset.modalOpen);
      if (dialog && typeof dialog.showModal === 'function') {
        e.preventDefault();
        dialog.showModal();
        lockScroll();
        dialog.addEventListener('close', () => unlockScroll(), { once: true });
        dialog.dispatchEvent(new CustomEvent('modal:open', { detail: { opener } }));
      }
      return;
    }
    if (e.target.closest('[data-modal-close]')) {
      const dialog = e.target.closest('dialog');
      if (dialog) dialog.close();
      return;
    }
    // Click on the backdrop closes.
    if (e.target.tagName === 'DIALOG' && e.target.open) {
      const r = e.target.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) e.target.close();
    }
  });

  /* ------------------------------------------------------------------
   * Page transitions
   *  - Chromium/Safari: native cross-document View Transitions (CSS), plus a
   *    shared "product-media" element from card to product page.
   *  - Others: a curtain covers the page, then we navigate; the next page
   *    starts covered (html.pt-enter) and the curtain lifts.
   * ------------------------------------------------------------------ */
  const transitionsOn = motionOK && settings.transitions && !EDEN.designMode;
  const hasNativeVT = 'CSSViewTransitionRule' in window;

  const isTransitionLink = (a, e) => {
    if (!a || !a.href) return false;
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (a.target && a.target !== '_self') return false;
    if (a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return false;
    if (a.closest('[data-drawer-open], [data-modal-open], [data-search-open]')) return false;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (!/^https?:$/.test(url.protocol)) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
    if (/\/(checkout|account\/logout|cart\/(add|change|clear))/.test(url.pathname)) return false;
    return true;
  };

  if (transitionsOn) {
    // Remember which card was clicked so the product image can morph.
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-product-handle]');
      if (card && e.target.closest('a')) {
        try {
          sessionStorage.setItem('eden:vt', card.dataset.productHandle);
        } catch (err) {}
        EDEN._vtMedia = card.querySelector('[data-vt-media]');
      }
    });

    if (hasNativeVT) {
      window.addEventListener('pageswap', (e) => {
        if (!e.viewTransition) return;
        const media = EDEN._vtMedia;
        const url = e.activation && e.activation.entry && e.activation.entry.url;
        if (media && url && url.includes('/products/')) {
          media.style.viewTransitionName = 'product-media';
          e.viewTransition.finished.finally(() => (media.style.viewTransitionName = ''));
        }
      });
    } else {
      document.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!isTransitionLink(a, e)) return;
        e.preventDefault();
        try {
          sessionStorage.setItem('eden:pt', '1');
        } catch (err) {}
        html.classList.add('pt-leave');
        setTimeout(() => (window.location.href = a.href), 430);
      });
      if (html.classList.contains('pt-enter')) setTimeout(() => html.classList.remove('pt-enter'), 900);
    }
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) html.classList.remove('pt-leave', 'pt-enter');
    });
  }

  /* ------------------------------------------------------------------
   * Theme editor support
   * ------------------------------------------------------------------ */
  if (EDEN.designMode) {
    document.addEventListener('shopify:section:select', (e) => {
      if (e.target.querySelector('#CartDrawer')) $('#CartDrawer').open();
    });
    document.addEventListener('shopify:section:deselect', (e) => {
      if (e.target.querySelector('#CartDrawer')) $('#CartDrawer').close();
    });
  }

  /* ------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------ */
  initHeader();
})();
