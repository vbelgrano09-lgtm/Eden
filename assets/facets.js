/*
 * EDEN — facets.js
 * Collection + search filtering and sorting without page reloads, using the
 * Section Rendering API. Pages still work without JS (plain GET forms/links).
 */
(() => {
  const EDEN = (window.EDEN = window.EDEN || {});
  const PARTS = ['[data-facets-results]', '[data-facets-active]', '[data-facets-count]', '[data-facets-form-body]', '[data-facets-show]', '[data-facets-badge]'];

  const debounce = (fn, wait) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  class FacetFilters extends HTMLElement {
    connectedCallback() {
      if (this._bound) return;
      this._bound = true;
      this.sectionId = this.dataset.section;
      this.cache = new Map();

      const onChange = debounce(() => this.apply(), 300);
      this.addEventListener('change', (e) => {
        if (e.target.closest('[data-facets-form], [data-sort-form]')) onChange();
      });
      this.addEventListener('submit', (e) => {
        if (e.target.matches('[data-facets-form], [data-sort-form]')) {
          e.preventDefault();
          this.apply();
        }
      });
      this.addEventListener('click', (e) => {
        const link = e.target.closest('[data-facet-link]');
        if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        const isPage = !!link.closest('.pagination');
        this.load(new URL(link.href, window.location.href), true, isPage);
      });
      window.addEventListener('popstate', (e) => {
        if (e.state && e.state.facets) this.load(new URL(window.location.href), false);
      });
      window.history.replaceState({ ...(window.history.state || {}), facets: true }, '');
    }

    params() {
      const params = new URLSearchParams();
      const form = this.querySelector('[data-facets-form]');
      if (form) {
        for (const [key, value] of new FormData(form)) if (value !== '') params.append(key, value);
      } else {
        const current = new URLSearchParams(window.location.search);
        if (current.get('q')) params.set('q', current.get('q'));
      }
      const sort = this.querySelector('[data-sort-form] select');
      if (sort) params.set('sort_by', sort.value);
      return params;
    }

    apply() {
      const url = new URL(window.location.pathname, window.location.origin);
      url.search = this.params().toString();
      this.load(url, true);
    }

    async load(url, push = true, scrollTop = false) {
      const request = new URL(url.toString());
      request.searchParams.set('section_id', this.sectionId);
      const key = request.toString();
      this.classList.add('is-loading');
      this.setAttribute('aria-busy', 'true');
      try {
        let text = this.cache.get(key);
        if (!text) {
          const res = await fetch(key);
          text = await res.text();
          this.cache.set(key, text);
        }
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const activeId = document.activeElement && document.activeElement.id;
        PARTS.forEach((sel) => {
          const current = this.querySelector(sel);
          const next = doc.querySelector(sel);
          if (current && next) current.innerHTML = next.innerHTML;
        });
        if (activeId) {
          const el = document.getElementById(activeId);
          if (el) el.focus({ preventScroll: true });
        }
        if (push) window.history.pushState({ facets: true }, '', url.toString());
        const count = this.querySelector('[data-facets-count]');
        if (count && EDEN.utils) EDEN.utils.announce(count.textContent.trim());
        if (EDEN.motion) {
          EDEN.motion.reveal(this);
          EDEN.motion.refresh();
        }
        if (scrollTop) {
          const top = this.getBoundingClientRect().top + window.scrollY - 100;
          if (EDEN.motion) EDEN.motion.scrollTo(top);
          else window.scrollTo({ top });
        }
      } catch (err) {
        window.location.href = url.toString();
      } finally {
        this.classList.remove('is-loading');
        this.removeAttribute('aria-busy');
      }
    }
  }
  customElements.define('facet-filters', FacetFilters);
})();
