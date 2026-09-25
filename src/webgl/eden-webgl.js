/*
 * EDEN — product card WebGL hover.
 *
 * A single shared OGL renderer/canvas is moved into whichever card is hovered,
 * so we never hold more than one WebGL context no matter how many cards exist.
 * The shader cover-fits both card photos, then reveals the second one through a
 * liquid ripple that radiates from the pointer.
 *
 * Loaded lazily by motion.js (desktop + fine pointer + motion allowed + the
 * first card scrolled into view). Built with `npm run build:webgl`.
 */
import { Renderer } from 'ogl/src/core/Renderer.js';
import { Program } from 'ogl/src/core/Program.js';
import { Mesh } from 'ogl/src/core/Mesh.js';
import { Texture } from 'ogl/src/core/Texture.js';
import { Triangle } from 'ogl/src/extras/Triangle.js';

const vertex = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;

  uniform sampler2D tFrom;
  uniform sampler2D tTo;
  uniform vec2 uFromSize;
  uniform vec2 uToSize;
  uniform vec2 uPlane;
  uniform vec2 uMouse;
  uniform float uProgress;
  uniform float uHover;
  uniform float uTime;

  varying vec2 vUv;

  vec2 cover(vec2 uv, vec2 img, vec2 plane) {
    float rp = plane.x / plane.y;
    float ri = img.x / img.y;
    if (rp > ri) {
      uv.y = (uv.y - 0.5) * (ri / rp) + 0.5;
    } else {
      uv.x = (uv.x - 0.5) * (rp / ri) + 0.5;
    }
    return uv;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vec2 aspect = vec2(uPlane.x / uPlane.y, 1.0);
    vec2 p = vUv * aspect;
    vec2 m = uMouse * aspect;
    float d = distance(p, m);

    // 0 at rest, 1 mid-transition: the liquid only lives while the swap happens.
    float bump = sin(clamp(uProgress, 0.0, 1.0) * 3.14159265);

    float n = noise(vUv * 3.5 + uTime * 0.18);
    vec2 dir = normalize(vUv - uMouse + 0.0001);
    float ripple = sin(d * 42.0 - uTime * 5.0) * exp(-d * 3.2);

    vec2 disp = dir * ripple * (0.028 * bump + 0.004 * uHover);
    disp += (vec2(n, noise(vUv * 3.5 - uTime * 0.14)) - 0.5) * 0.05 * bump;

    // Reveal mask: a circle growing from the pointer with a torn, noisy edge.
    float radius = uProgress * 1.75;
    float mask = smoothstep(radius, radius - 0.32, d + (n - 0.5) * 0.28);

    vec2 uvFrom = cover(vUv + disp * (1.0 - mask), uFromSize, uPlane);
    vec2 uvTo = cover(vUv - disp * mask, uToSize, uPlane);

    vec4 from = texture2D(tFrom, uvFrom);
    // A touch of chromatic split on the incoming image while it is moving.
    float shift = 0.006 * bump;
    vec4 to = vec4(
      texture2D(tTo, uvTo + vec2(shift, 0.0)).r,
      texture2D(tTo, uvTo).g,
      texture2D(tTo, uvTo - vec2(shift, 0.0)).b,
      1.0
    );

    gl_FragColor = mix(from, to, mask);
  }
`;

const lerp = (a, b, t) => a + (b - a) * t;

class CardDistortion {
  constructor() {
    this.renderer = new Renderer({
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    });
    this.gl = this.renderer.gl;
    this.canvas = this.gl.canvas;
    this.canvas.className = 'card-webgl';
    this.canvas.setAttribute('aria-hidden', 'true');

    this.cache = new Map();
    this.empty = new Texture(this.gl, { image: new Uint8Array([10, 10, 10, 255]), width: 1, height: 1 });

    this.program = new Program(this.gl, {
      vertex,
      fragment,
      uniforms: {
        tFrom: { value: this.empty },
        tTo: { value: this.empty },
        uFromSize: { value: [1, 1] },
        uToSize: { value: [1, 1] },
        uPlane: { value: [1, 1] },
        uMouse: { value: [0.5, 0.5] },
        uProgress: { value: 0 },
        uHover: { value: 0 },
        uTime: { value: 0 },
      },
    });
    this.mesh = new Mesh(this.gl, { geometry: new Triangle(this.gl), program: this.program });

    this.active = null;
    this.target = 0;
    this.progress = 0;
    this.mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    this.running = false;
    this.dead = false;
    this.start = performance.now();

    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.dead = true;
      document.documentElement.classList.add('no-webgl');
      this.detach();
    });

    this.tick = this.tick.bind(this);
    this.bind();
  }

  bind() {
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType !== 'mouse' || this.dead) return;
      const media = e.target.closest && e.target.closest('[data-webgl-media]');
      if (!media) return;
      if (media === this.active) {
        this.target = 1;
        return;
      }
      this.enter(media, e);
    });
    document.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      const r = this.active.getBoundingClientRect();
      this.mouse.tx = (e.clientX - r.left) / r.width;
      this.mouse.ty = 1 - (e.clientY - r.top) / r.height;
    }, { passive: true });
    document.addEventListener('pointerout', (e) => {
      if (!this.active) return;
      const to = e.relatedTarget;
      if (to && this.active.contains(to)) return;
      if (e.target.closest && e.target.closest('[data-webgl-media]') === this.active) this.leave();
    });
    window.addEventListener('resize', () => this.active && this.resize(), { passive: true });
  }

  load(src) {
    if (this.cache.has(src)) return this.cache.get(src);
    const promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.onload = () => {
        const texture = new Texture(this.gl, { generateMipmaps: false, minFilter: this.gl.LINEAR });
        texture.image = img;
        resolve({ texture, size: [img.naturalWidth, img.naturalHeight] });
      };
      img.onerror = reject;
      img.src = src;
    });
    this.cache.set(src, promise);
    return promise;
  }

  source(img) {
    if (!img) return null;
    // Use a moderate size: the texture only has to cover the card.
    const src = img.currentSrc || img.src;
    return src || null;
  }

  async enter(media, e) {
    const imgs = media.querySelectorAll('img');
    const fromSrc = this.source(imgs[0]);
    const toSrc = this.source(imgs[1]);
    if (!fromSrc || !toSrc) return;

    if (this.active && this.active !== media) this.detach();
    this.active = media;
    this.target = 1;
    const r = media.getBoundingClientRect();
    this.mouse.x = this.mouse.tx = (e.clientX - r.left) / r.width;
    this.mouse.y = this.mouse.ty = 1 - (e.clientY - r.top) / r.height;

    try {
      const [from, to] = await Promise.all([this.load(fromSrc), this.load(toSrc)]);
      if (this.active !== media) return;
      const u = this.program.uniforms;
      u.tFrom.value = from.texture;
      u.tTo.value = to.texture;
      u.uFromSize.value = from.size;
      u.uToSize.value = to.size;
      this.resize();
      media.appendChild(this.canvas);
      media.classList.add('is-webgl');
      if (!this.running) {
        this.running = true;
        requestAnimationFrame(this.tick);
      }
    } catch (err) {
      media.classList.add('webgl-failed');
      if (this.active === media) this.active = null;
    }
  }

  leave() {
    this.target = 0;
  }

  resize() {
    if (!this.active) return;
    const r = this.active.getBoundingClientRect();
    this.renderer.setSize(r.width, r.height);
    this.program.uniforms.uPlane.value = [r.width, r.height];
  }

  detach() {
    if (this.active) this.active.classList.remove('is-webgl');
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.active = null;
    this.progress = 0;
    this.running = false;
  }

  tick(now) {
    if (!this.running || !this.active) {
      this.running = false;
      return;
    }
    const u = this.program.uniforms;
    this.progress = lerp(this.progress, this.target, 0.075);
    this.mouse.x = lerp(this.mouse.x, this.mouse.tx, 0.12);
    this.mouse.y = lerp(this.mouse.y, this.mouse.ty, 0.12);

    u.uProgress.value = this.progress;
    u.uHover.value = lerp(u.uHover.value, this.target, 0.08);
    u.uMouse.value = [this.mouse.x, this.mouse.y];
    u.uTime.value = (now - this.start) / 1000;

    this.renderer.render({ scene: this.mesh });

    if (this.target === 0 && this.progress < 0.004) {
      this.detach();
      return;
    }
    requestAnimationFrame(this.tick);
  }
}

let instance = null;

window.EdenWebGL = {
  init() {
    if (instance) return instance;
    try {
      instance = new CardDistortion();
      document.documentElement.classList.add('has-webgl');
    } catch (err) {
      document.documentElement.classList.add('no-webgl');
    }
    return instance;
  },
};
