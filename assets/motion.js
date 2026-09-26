/*
 * EDEN — motion.js
 * Everything that moves: Lenis, GSAP ScrollTrigger scenes, SplitText reveals,
 * parallax, the sticky gallery, the FAITH OVER FEAR scene, the cursor,
 * magnetic buttons, card tilt and the lazy WebGL loader.
 *
 * Never runs when the visitor prefers reduced motion or when motion is
 * switched off in theme settings (<html> lacks .motion-ok). Every effect has a
 * lighter phone version via gsap.matchMedia().
 */
(() => {
  const EDEN = (window.EDEN = window.EDEN || {});
  const html = document.documentElement;
  const settings = EDEN.settings || {};

  const unhide = () => {
    html.classList.add('motion-ready');
    document.querySelectorAll('[data-split]').forEach((el) => el.classList.add('is-split'));
  };

  if (!html.classList.contains('motion-ok') || !window.gsap || !window.ScrollTrigger) {
    unhide();
    return;
  }

  const { gsap, ScrollTrigger } = window;
  const SplitText = window.SplitText;
  gsap.registerPlugin(ScrollTrigger);
  if (SplitText) gsap.registerPlugin(SplitText);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const DESKTOP = '(min-width: 990px)';
  const MOBILE = '(max-width: 989px)';
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const isDesktop = () => window.matchMedia(DESKTOP).matches;

  html.classList.add('motion-ready');
  if (!SplitText || !settings.splitText) unhide();

  /* ------------------------------------------------------------------
   * Lenis smooth scroll (desktop wheel/trackpad; touch stays native)
   * ------------------------------------------------------------------ */
  let lenis = null;
  if (settings.smoothScroll && window.Lenis && !EDEN.designMode) {
    lenis = new window.Lenis({
      duration: settings.smoothDuration || 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      anchors: { offset: -80 },
      allowNestedScroll: true,
      prevent: (node) => !!(node.closest && node.closest('[data-lenis-prevent], dialog, .cart-drawer, .menu-drawer, .search-modal')),
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    document.addEventListener('eden:scroll:lock', () => lenis.stop());
    document.addEventListener('eden:scroll:unlock', () => lenis.start());
    EDEN.lenis = lenis;
  }

  const scrollToY = (y, immediate = false) => {
    if (lenis) lenis.scrollTo(y, { immediate, force: true });
    else window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
  };

  if (html.classList.contains('has-loader')) {
    if (lenis) lenis.stop();
    document.addEventListener(
      'eden:loader:done',
      () => {
        if (lenis) lenis.start();
        ScrollTrigger.refresh();
      },
      { once: true }
    );
  }

  /* ------------------------------------------------------------------
   * Split-text reveals: [data-split="chars|words|lines"]
   * ------------------------------------------------------------------ */
  const initSplit = (root) => {
    if (!SplitText || !settings.splitText) return;
    root.querySelectorAll('[data-split]').forEach((el) => {
      if (el.closest('[data-no-motion]')) {
        el.classList.add('is-split');
        return;
      }
      const type = el.dataset.split || 'lines';
      // Lines/words keep whole words, so the text reads normally: leave ARIA alone.
      // Letters: headings get SplitText's aria-label; other elements get a
      // screen-reader copy, because aria-label is not allowed on a <p>.
      let aria = 'none';
      if (type === 'chars') {
        if (/^H[1-6]$/.test(el.tagName)) {
          aria = 'auto';
        } else {
          aria = 'hidden';
          if (!el.previousElementSibling || !el.previousElementSibling.hasAttribute('data-split-sr')) {
            const copy = document.createElement('span');
            copy.className = 'visually-hidden';
            copy.setAttribute('data-split-sr', '');
            copy.textContent = el.textContent.trim();
            el.parentNode.insertBefore(copy, el);
          }
        }
      }
      try {
        SplitText.create(el, {
          type: type === 'chars' ? 'lines,words,chars' : type === 'words' ? 'lines,words' : 'lines',
          mask: 'lines',
          linesClass: 'split-line',
          autoSplit: true,
          aria,
          onSplit(self) {
            el.classList.add('is-split');
            const targets = type === 'chars' ? self.chars : type === 'words' ? self.words : self.lines;
            return gsap.from(targets, {
              yPercent: 115,
              rotate: type === 'chars' ? 5 : 0,
              duration: type === 'lines' ? 1.15 : 1,
              ease: 'expo.out',
              stagger: type === 'chars' ? 0.026 : type === 'words' ? 0.06 : 0.1,
              delay: parseFloat(el.dataset.splitDelay || '0'),
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            });
          },
        });
      } catch (err) {
        el.classList.add('is-split');
      }
    });
  };
  // Failsafe: never leave a headline hidden.
  setTimeout(unhide, 3000);

  /* ------------------------------------------------------------------
   * Fade-up reveals: [data-reveal]
   * ------------------------------------------------------------------ */
  const initReveal = (root) => {
    const els = Array.from(root.querySelectorAll('[data-reveal]:not(.is-in)'));
    if (!els.length) return;
    ScrollTrigger.batch(els, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) =>
        batch.forEach((el, i) => {
          el.style.setProperty('--reveal-delay', `${i * 0.08}s`);
          el.classList.add('is-in');
        }),
    });
  };

  /* ------------------------------------------------------------------
   * Parallax: [data-parallax="0.2"] (half strength on phones)
   * ------------------------------------------------------------------ */
  const initParallax = (root, mm) => {
    const els = root.querySelectorAll('[data-parallax]');
    if (!els.length) return;
    mm.add({ desktop: DESKTOP, mobile: MOBILE }, (ctx) => {
      const factor = ctx.conditions.desktop ? 1 : 0.5;
      els.forEach((el) => {
        const amount = (parseFloat(el.dataset.parallax) || 0.15) * factor * 100;
        const trigger = el.closest('[data-parallax-scope]') || el.parentElement;
        gsap.fromTo(
          el,
          { yPercent: -amount / 2 },
          { yPercent: amount / 2, ease: 'none', scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: true } }
        );
      });
    });
  };

  /* ------------------------------------------------------------------
   * Hero: video, scroll-out parallax, pointer-driven layer
   * ------------------------------------------------------------------ */
  const initHero = (root, mm) => {
    const hero = root.querySelector('[data-hero]');
    if (!hero) return;

    const video = hero.querySelector('[data-hero-video]');
    if (video) {
      const desktop = isDesktop();
      const src = desktop ? video.dataset.srcDesktop : video.dataset.srcMobile;
      if (src && (desktop || video.dataset.mobile === 'true')) {
        video.src = src;
        const toggle = hero.querySelector('[data-hero-video-toggle]');
        video.addEventListener(
          'playing',
          () => {
            video.classList.add('is-playing');
            if (toggle) toggle.hidden = false;
          },
          { once: true }
        );
        // WCAG 2.2.2: moving media longer than 5s needs a pause control.
        if (toggle) {
          toggle.addEventListener('click', () => {
            const paused = !video.paused;
            if (paused) video.pause();
            else video.play().catch(() => {});
            toggle.querySelector('[data-when-playing]').hidden = paused;
            toggle.querySelector('[data-when-paused]').hidden = !paused;
          });
        }
        const play = () => video.play().catch(() => {});
        if (html.classList.contains('has-loader')) document.addEventListener('eden:loader:done', play, { once: true });
        else play();
      }
    }

    if (hero.dataset.parallax !== 'true') return;
    const media = hero.querySelector('.hero__media');
    const layer = hero.querySelector('[data-hero-layer]');
    const content = hero.querySelector('.hero__content');

    mm.add({ desktop: DESKTOP, mobile: MOBILE }, (ctx) => {
      const desktop = ctx.conditions.desktop;
      const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to(media, { yPercent: desktop ? 22 : 12, ease: 'none', scrollTrigger: st });
      if (content) gsap.to(content, { yPercent: desktop ? -40 : -18, autoAlpha: 0.15, ease: 'none', scrollTrigger: { ...st, end: 'bottom 25%' } });
      if (layer) gsap.to(layer, { yPercent: desktop ? -14 : -6, ease: 'none', scrollTrigger: st });

      if (desktop && finePointer && layer) {
        const xTo = gsap.quickTo(layer, 'x', { duration: 1.2, ease: 'power3' });
        const yTo = gsap.quickTo(layer, 'y', { duration: 1.2, ease: 'power3' });
        const onMove = (e) => {
          xTo((e.clientX / window.innerWidth - 0.5) * -36);
          yTo((e.clientY / window.innerHeight - 0.5) * -24);
        };
        hero.addEventListener('pointermove', onMove);
        return () => hero.removeEventListener('pointermove', onMove);
      }
      return undefined;
    });
  };

  /* ------------------------------------------------------------------
   * Chapter gallery: sticky horizontal scroll scene on desktop.
   * Phones keep the native swipe carousel (theme.js handles buttons).
   * ------------------------------------------------------------------ */
  const initGallery = (root, mm) => {
    const section = root.querySelector('[data-gallery]');
    if (!section || section.dataset.pin !== 'true') return;
    const viewport = section.querySelector('.gallery__viewport');
    const track = section.querySelector('.gallery__track');
    if (!viewport || !track) return;

    mm.add(DESKTOP, () => {
      section.classList.add('is-pinned');
      const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
      // The section's height = viewport + travel; its content is position: sticky.
      const setTravel = () => section.style.setProperty('--travel', `${distance()}px`);
      setTravel();
      ScrollTrigger.addEventListener('refreshInit', setTravel);

      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
          invalidateOnRefresh: true,
          onUpdate: (self) => section.style.setProperty('--progress', self.progress.toFixed(4)),
        },
      });

      // Each image drifts inside its frame while the row slides.
      section.querySelectorAll('.gallery__item-media img').forEach((img) => {
        gsap.fromTo(
          img,
          { xPercent: -5 },
          {
            xPercent: 5,
            ease: 'none',
            scrollTrigger: { trigger: img.closest('.gallery__item'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
          }
        );
      });

      // Keyboard: focusing a product scrolls the page so it slides into view.
      const onFocus = (e) => {
        const item = e.target.closest('.gallery__item, .gallery__end');
        const st = tween.scrollTrigger;
        if (!item || !st) return;
        const x = Math.min(distance(), Math.max(0, item.offsetLeft - viewport.clientWidth * 0.25));
        scrollToY(st.start + x, true);
      };
      section.addEventListener('focusin', onFocus);

      // Drag to scrub.
      let drag = null;
      const onDown = (e) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        drag = { x: e.clientX, y: window.scrollY, moved: false };
        section.classList.add('is-dragging');
      };
      const onMove = (e) => {
        if (!drag) return;
        const dx = drag.x - e.clientX;
        if (Math.abs(dx) > 6) drag.moved = true;
        if (drag.moved) scrollToY(drag.y + dx * 1.4, true);
      };
      const onUp = () => {
        if (!drag) return;
        const moved = drag.moved;
        drag = null;
        section.classList.remove('is-dragging');
        if (moved) {
          const block = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          };
          section.addEventListener('click', block, { capture: true, once: true });
          setTimeout(() => section.removeEventListener('click', block, { capture: true }), 50);
        }
      };
      viewport.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp);
      viewport.addEventListener('dragstart', (e) => e.preventDefault());

      return () => {
        ScrollTrigger.removeEventListener('refreshInit', setTravel);
        section.style.removeProperty('--travel');
        section.classList.remove('is-pinned');
        section.removeEventListener('focusin', onFocus);
        viewport.removeEventListener('pointerdown', onDown);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        gsap.set(track, { clearProps: 'transform' });
      };
    });
  };

  /* ------------------------------------------------------------------
   * FAITH OVER FEAR — sticky scroll scene.
   * Letters scale up and fill with white; FEAR cracks and shatters;
   * FAITH stays, centred. Phones: shorter scene, fewer shards, no crack lines.
   * ------------------------------------------------------------------ */
  const seeded = (seed) => () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Tile the glyph box (with overhang) into `count` shards around a crack origin.
  const buildShards = (seed, count) => {
    const rnd = seeded(seed * 7919 + 17);
    const MIN = -18;
    const MAX = 118;
    const cx = 38 + rnd() * 24;
    const cy = 34 + rnd() * 30;
    const TAU = Math.PI * 2;
    const norm = (a) => ((a % TAU) + TAU) % TAU;
    const angles = [];
    const offset = rnd() * TAU;
    for (let k = 0; k < count; k += 1) angles.push(norm(offset + (k / count) * TAU + (rnd() - 0.5) * 0.7));
    angles.sort((a, b) => a - b);

    const ray = (a) => {
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const ts = [];
      if (dx > 0) ts.push((MAX - cx) / dx);
      if (dx < 0) ts.push((MIN - cx) / dx);
      if (dy > 0) ts.push((MAX - cy) / dy);
      if (dy < 0) ts.push((MIN - cy) / dy);
      const t = Math.min(...ts);
      return [cx + dx * t, cy + dy * t];
    };
    const edges = angles.map(ray);
    const jags = edges.map(([ex, ey]) => {
      const dx = ex - cx;
      const dy = ey - cy;
      const len = Math.hypot(dx, dy) || 1;
      const off = (rnd() - 0.5) * 16;
      const at = 0.35 + rnd() * 0.25;
      return [cx + dx * at - (dy / len) * off, cy + dy * at + (dx / len) * off];
    });
    const corners = [
      [MIN, MIN],
      [MAX, MIN],
      [MAX, MAX],
      [MIN, MAX],
    ].map(([x, y]) => ({ p: [x, y], a: norm(Math.atan2(y - cy, x - cx)) }));

    const polys = [];
    for (let k = 0; k < count; k += 1) {
      const a0 = angles[k];
      const a1 = angles[(k + 1) % count];
      const inSector = (a) => (a0 <= a1 ? a > a0 && a < a1 : a > a0 || a < a1);
      const between = corners
        .filter((c) => inSector(c.a))
        .sort((c1, c2) => norm(c1.a - a0) - norm(c2.a - a0))
        .map((c) => c.p);
      polys.push([[cx, cy], jags[k], edges[k], ...between, edges[(k + 1) % count], jags[(k + 1) % count]]);
    }
    const cracks = edges.map((e, k) => {
      const end = [cx + (e[0] - cx) * 0.8, cy + (e[1] - cy) * 0.8];
      return `M${cx.toFixed(1)} ${cy.toFixed(1)}L${jags[k][0].toFixed(1)} ${jags[k][1].toFixed(1)}L${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
    });
    return { polys, cracks: cracks.join(''), origin: [cx, cy] };
  };

  const initFOF = (root, mm) => {
    const section = root.querySelector('[data-fof]');
    if (!section || section.dataset.scene === 'false') return;
    const stage = section.querySelector('.fof__stage');
    const words = section.querySelector('.fof__words');
    const faithWord = section.querySelector('.fof__word--faith');
    const overWord = section.querySelector('.fof__word--over');
    const fearWord = section.querySelector('.fof__word--fear');
    const subline = section.querySelector('.fof__subline');
    const wordmark = section.querySelector('.fof__wordmark');
    if (!stage || !words || !faithWord || !fearWord) return;

    const chars = (word) => (word ? Array.from(word.querySelectorAll('.fof__char')) : []);

    mm.add({ desktop: DESKTOP, mobile: MOBILE }, (ctx) => {
      const desktop = ctx.conditions.desktop;
      section.classList.add('is-scene');

      const shardCount = desktop ? 5 : 3;
      const shards = [];
      const cracks = [];
      chars(fearWord).forEach((ch, i) => {
        const letter = ch.dataset.char || ch.textContent;
        const { polys, cracks: crackPath } = buildShards(i + 3, shardCount);
        ch.classList.add('has-shards');
        polys.forEach((poly) => {
          const s = document.createElement('span');
          s.className = 'fof__shard';
          s.setAttribute('aria-hidden', 'true');
          s.textContent = letter;
          s.style.clipPath = `polygon(${poly.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(',')})`;
          ch.appendChild(s);
          const cxp = poly.reduce((acc, p) => acc + p[0], 0) / poly.length;
          const cyp = poly.reduce((acc, p) => acc + p[1], 0) / poly.length;
          shards.push({ el: s, cx: cxp, cy: cyp, i });
        });
        if (desktop) {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('class', 'fof__crack');
          svg.setAttribute('viewBox', '0 0 100 100');
          svg.setAttribute('preserveAspectRatio', 'none');
          svg.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', crackPath);
          path.setAttribute('pathLength', '1');
          svg.appendChild(path);
          ch.appendChild(svg);
          cracks.push(path);
        }
      });

      const rnd = seeded(42);
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        // The stage is position: sticky inside a tall section (380vh desktop,
        // 270vh phones, see base.css), so we only scrub — no JS pinning.
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: desktop ? 0.9 : 0.5,
          invalidateOnRefresh: true,
        },
      });

      const allChars = chars(faithWord).concat(chars(overWord), chars(fearWord));
      gsap.set(allChars, { '--fill': 0 });

      tl.fromTo(words, { scale: desktop ? 0.5 : 0.7 }, { scale: 1, duration: 3.2, ease: 'power2.out' }, 0);
      tl.to(chars(faithWord), { '--fill': 1, duration: 1, stagger: 0.16 }, 0.2);
      tl.to(chars(overWord), { '--fill': 1, duration: 0.6, stagger: 0.1 }, 1.1);
      // Shards inherit --fill from their letter, so FEAR fills as one piece.
      tl.to(chars(fearWord), { '--fill': 1, duration: 1, stagger: 0.14 }, 1.5);

      if (cracks.length) {
        tl.to(cracks, { strokeDashoffset: 0, duration: 0.9, stagger: 0.12, ease: 'power1.in' }, 3.1);
        tl.to(fearWord, { x: 5, duration: 0.06, repeat: 9, yoyo: true, ease: 'sine.inOut' }, 3.4);
      } else {
        tl.to(fearWord, { x: 3, duration: 0.08, repeat: 5, yoyo: true, ease: 'sine.inOut' }, 3.1);
      }

      const breakAt = desktop ? 4.1 : 3.6;
      shards.forEach((s) => {
        const dirX = (s.cx - 50) / 50;
        const dirY = (s.cy - 50) / 50;
        tl.to(
          s.el,
          {
            x: dirX * (60 + rnd() * 160) * (desktop ? 1.4 : 1),
            y: dirY * 60 + 220 + rnd() * (desktop ? 480 : 260),
            rotation: (rnd() - 0.5) * 140,
            autoAlpha: 0,
            duration: 1.5 + rnd() * 0.5,
            ease: 'power2.in',
          },
          breakAt + s.i * 0.06 + rnd() * 0.25
        );
      });
      if (cracks.length) tl.to(cracks, { autoAlpha: 0, duration: 0.25 }, breakAt);
      if (overWord) tl.to(overWord, { autoAlpha: 0, y: 30, duration: 0.8, ease: 'power2.in' }, breakAt + 0.3);

      tl.to(
        faithWord,
        {
          // Layout offsets ignore transforms, so this stays correct mid-scrub.
          y: () => words.offsetHeight / 2 - (faithWord.offsetTop + faithWord.offsetHeight / 2),
          scale: desktop ? 1.18 : 1.1,
          duration: 1.6,
          ease: 'power2.inOut',
        },
        breakAt + 0.9
      );
      if (wordmark) tl.to(wordmark, { autoAlpha: 1, duration: 0.8 }, breakAt + 2.2).to(faithWord, { autoAlpha: 0, duration: 0.6 }, '<');
      if (subline) tl.fromTo(subline, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' }, breakAt + 1.8);
      tl.to({}, { duration: 0.6 });

      return () => {
        section.classList.remove('is-scene');
        section.querySelectorAll('.fof__shard, .fof__crack').forEach((n) => n.remove());
        section.querySelectorAll('.has-shards').forEach((n) => n.classList.remove('has-shards'));
      };
    });
  };

  /* ------------------------------------------------------------------
   * Custom cursor (fine pointers only)
   * ------------------------------------------------------------------ */
  const initCursor = () => {
    const cursor = document.querySelector('.cursor');
    if (!cursor || !finePointer || !settings.cursor) return;
    const label = cursor.querySelector('.cursor__label');
    cursor.classList.add('is-ready', 'is-hidden');
    if (cursor.classList.contains('cursor--replace')) html.classList.add('cursor-replace');

    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.28, ease: 'power3' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.28, ease: 'power3' });
    let shown = false;

    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        if (!shown) {
          gsap.set(cursor, { x: e.clientX, y: e.clientY });
          shown = true;
        }
        cursor.classList.remove('is-hidden');
        xTo(e.clientX);
        yTo(e.clientY);
      },
      { passive: true }
    );
    document.documentElement.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    window.addEventListener('blur', () => cursor.classList.add('is-hidden'));
    window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));

    let current = null;
    document.addEventListener('pointerover', (e) => {
      const target = e.target.closest ? e.target.closest('[data-cursor]') : null;
      const interactive = e.target.closest ? e.target.closest('a, button, [role="button"], label, summary, select') : null;
      const type = target ? target.dataset.cursor : interactive ? 'link' : null;
      const text = target ? target.dataset.cursorLabel || type : '';
      if (type === current && label.textContent === text) return;
      current = type;
      cursor.classList.toggle('is-label', type === 'view' || type === 'drag');
      cursor.classList.toggle('is-drag', type === 'drag');
      cursor.classList.toggle('is-link', type === 'link');
      label.textContent = type === 'view' || type === 'drag' ? text : '';
    });
  };

  /* ------------------------------------------------------------------
   * Magnetic buttons: [data-magnetic]
   * ------------------------------------------------------------------ */
  const initMagnetic = () => {
    if (!settings.magnetic || !finePointer) return;
    const movers = new WeakMap();
    const get = (el) => {
      if (!movers.has(el)) {
        const inner = el.querySelector('.btn__label');
        movers.set(el, {
          x: gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' }),
          y: gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' }),
          ix: inner ? gsap.quickTo(inner, 'x', { duration: 0.6, ease: 'power3' }) : null,
          iy: inner ? gsap.quickTo(inner, 'y', { duration: 0.6, ease: 'power3' }) : null,
        });
      }
      return movers.get(el);
    };
    let active = null;
    const release = () => {
      if (!active) return;
      const el = active;
      active = null;
      const inner = el.querySelector('.btn__label');
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
      if (inner) gsap.to(inner, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
    };
    window.addEventListener(
      'pointermove',
      (e) => {
        const el = e.target.closest ? e.target.closest('[data-magnetic]') : null;
        if (el !== active) release();
        if (!el) return;
        active = el;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const strength = parseFloat(el.dataset.magnetic) || 0.35;
        const m = get(el);
        m.x(dx * strength);
        m.y(dy * strength);
        if (m.ix) {
          m.ix(dx * strength * 0.4);
          m.iy(dy * strength * 0.4);
        }
      },
      { passive: true }
    );
    document.documentElement.addEventListener('mouseleave', release);
  };

  /* ------------------------------------------------------------------
   * Product cards: 3D tilt + lazy WebGL (desktop only)
   * ------------------------------------------------------------------ */
  const initCards = () => {
    if (!finePointer) return;

    if (settings.tilt) {
      const tilts = new WeakMap();
      let active = null;
      const reset = () => {
        if (!active) return;
        gsap.to(active, { rotateX: 0, rotateY: 0, duration: 0.9, ease: 'power3.out' });
        active = null;
      };
      window.addEventListener(
        'pointermove',
        (e) => {
          const el = e.target.closest ? e.target.closest('[data-tilt]') : null;
          if (el !== active) reset();
          if (!el || !isDesktop()) return;
          active = el;
          if (!tilts.has(el)) {
            gsap.set(el, { transformPerspective: 1100 });
            tilts.set(el, {
              rx: gsap.quickTo(el, 'rotateX', { duration: 0.6, ease: 'power3' }),
              ry: gsap.quickTo(el, 'rotateY', { duration: 0.6, ease: 'power3' }),
            });
          }
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          const t = tilts.get(el);
          t.ry(px * 7);
          t.rx(-py * 7);
        },
        { passive: true }
      );
    }

    if (!settings.webgl) return;
    let requested = false;
    const load = () => {
      if (requested || !isDesktop()) return;
      requested = true;
      const s = document.createElement('script');
      s.src = EDEN.assets.webgl;
      s.async = true;
      s.onload = () => window.EdenWebGL && window.EdenWebGL.init();
      document.head.appendChild(s);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          load();
          io.disconnect();
        }
      },
      { rootMargin: '200px 0px' }
    );
    document.querySelectorAll('[data-webgl-media]').forEach((el) => io.observe(el));
    document.addEventListener('pointerover', (e) => e.target.closest && e.target.closest('[data-webgl-media]') && load());
  };

  /* ------------------------------------------------------------------
   * Section lifecycle (also handles the theme editor)
   * ------------------------------------------------------------------ */
  const scopes = new Map();
  const initSection = (section) => {
    if (scopes.has(section)) scopes.get(section).revert();
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      initHero(section, mm);
      initGallery(section, mm);
      initFOF(section, mm);
      initParallax(section, mm);
      initSplit(section);
      initReveal(section);
    }, section);
    scopes.set(section, {
      revert() {
        mm.revert();
        ctx.revert();
      },
    });
  };

  const boot = () => {
    document.querySelectorAll('.shopify-section').forEach(initSection);
    initCursor();
    initMagnetic();
    initCards();
    ScrollTrigger.refresh();
  };

  EDEN.motion = {
    reveal: (root) => initReveal(root || document),
    refresh: () => ScrollTrigger.refresh(),
    scrollTo: scrollToY,
  };

  document.addEventListener('shopify:section:load', (e) => {
    initSection(e.target);
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  });
  document.addEventListener('shopify:section:unload', (e) => {
    const scope = scopes.get(e.target);
    if (scope) scope.revert();
    scopes.delete(e.target);
    ScrollTrigger.refresh();
  });

  const start = () => {
    if (document.fonts && document.fonts.status !== 'loaded') {
      // Split and measure once headline fonts are in, but never wait long.
      Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))]).then(boot);
    } else {
      boot();
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
