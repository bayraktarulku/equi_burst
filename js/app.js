/**
 * EquiBurst — Interactive STEM / equity art piece
 * ─────────────────────────────────────────────────
 * CONFIG  → tweak particle behaviour, colours, timing
 * QUOTES  → add more entries freely
 * Particle / ParticleSystem → physics & rendering
 * QuoteManager → quote display lifecycle
 */

/* ═══════════════════════════════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════════════════════════════ */
const CONFIG = {
  /* Particles per burst */
  particleCount: 120,

  /**
   * Powder palette — HSL bands [hue, satMin, satMax, lightMin, lightMax]
   * Each click picks one dominant band and sprinkles nearby hues.
   */
  palettes: [
    { name: 'rose',     band: [340, 60, 80, 75, 92] },
    { name: 'blue',     band: [200, 50, 70, 75, 90] },
    { name: 'lavender', band: [270, 45, 65, 78, 93] },
    { name: 'mint',     band: [160, 38, 58, 76, 90] },
    { name: 'peach',    band: [30,  55, 72, 80, 93] },
    { name: 'gold',     band: [48,  60, 78, 80, 93] },
    { name: 'lilac',    band: [290, 42, 62, 80, 93] },
    { name: 'sky',      band: [210, 55, 72, 78, 91] },
  ],

  /* Scatter radius around click origin (px) */
  scatterRadius: 6,

  /* Speed range (px / frame @ 60 fps) */
  speedMin: 0.8,
  speedMax: 5.5,

  /* Particle size range (radius, px) */
  sizeMin: 2,
  sizeMax: 11,

  /* Lifetime range (frames @ 60 fps) */
  lifetimeMin: 55,
  lifetimeMax: 110,

  /* Per-frame speed multiplier (friction) */
  friction: 0.965,

  /* Downward pull per frame */
  gravity: 0.055,

  /* Max random angle nudge per frame (radians) */
  wobble: 0.035,

  /* How quickly the canvas trail fades (lower = longer ghost) */
  trailAlpha: 0.14,

  /* Quote display duration (ms) before fade starts */
  quoteDuration: 4200,

  /* How long the full-screen flash stays at peak opacity (ms) */
  flashHoldDuration: 320,
};

/* ═══════════════════════════════════════════════════════════════════════
   QUOTES  — extend freely
   ═══════════════════════════════════════════════════════════════════════ */
const QUOTES = [
  {
    text: 'The important thing is not to stop questioning. Curiosity has its own reason for existing.',
    author: 'Albert Einstein',
  },
  {
    text: 'I have no special talents. I am only passionately curious.',
    author: 'Albert Einstein',
  },
  {
    text: 'Nothing in life is to be feared, it is only to be understood.',
    author: 'Marie Curie',
  },
  {
    text: 'Be less curious about people and more curious about ideas.',
    author: 'Marie Curie',
  },
  {
    text: 'That brain of mine is something more than merely mortal, as time will show.',
    author: 'Ada Lovelace',
  },
  {
    text: 'The science of operations is a science of itself, and has its own abstract truth and value.',
    author: 'Ada Lovelace',
  },
  {
    text: 'If I have seen further, it is by standing on the shoulders of giants.',
    author: 'Isaac Newton',
  },
  {
    text: 'To every action there is always opposed an equal reaction.',
    author: 'Isaac Newton',
  },
  {
    text: 'Science is not a boy\'s game, it\'s not a girl\'s game. It\'s everyone\'s game.',
    author: 'Nichelle Nichols',
  },
  {
    text: 'What one fool can do, another can.',
    author: 'Silvanus P. Thompson',
  },
  {
    text: 'The only way to do great work is to love what you do.',
    author: 'Katherine Johnson',
  },
  {
    text: 'We choose to go to the Moon — not because it is easy, but because it is hard.',
    author: 'John F. Kennedy (NASA era)',
  },
  {
    text: 'Pure mathematics is, in its way, the poetry of logical ideas.',
    author: 'Albert Einstein',
  },
  {
    text: 'A person who never made a mistake never tried anything new.',
    author: 'Albert Einstein',
  },
  {
    text: 'The mathematician\'s patterns must be beautiful; there is no permanent place for ugly mathematics.',
    author: 'G. H. Hardy',
  },
  {
    text: 'Equipped with his five senses, man explores the universe around him and calls the adventure Science.',
    author: 'Edwin Hubble',
  },
  {
    text: 'In mathematics you don\'t understand things. You just get used to them.',
    author: 'John von Neumann',
  },
  {
    text: 'The most beautiful thing we can experience is the mysterious.',
    author: 'Albert Einstein',
  },
  {
    text: 'Science knows no country, because knowledge belongs to humanity.',
    author: 'Louis Pasteur',
  },
  {
    text: 'Somewhere, something incredible is waiting to be known.',
    author: 'Carl Sagan',
  },
];

/* ═══════════════════════════════════════════════════════════════════════
   UTILITY
   ═══════════════════════════════════════════════════════════════════════ */
/** Uniformly-distributed random float in [min, max]. */
function rand(min, max) {
  return min + Math.random() * (max - min);
}

/** Pick a random element from an array without repeating the last pick. */
function pickUnique(arr, lastIndex) {
  let idx;
  do { idx = Math.floor(Math.random() * arr.length); }
  while (arr.length > 1 && idx === lastIndex);
  return { item: arr[idx], idx };
}

/** Clamp a value between lo and hi. */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ═══════════════════════════════════════════════════════════════════════
   SCREEN FLASH
   Fills the entire background with a mesh-gradient colour wash, then
   fades back to black. Completely independent of the particle canvas.
   ═══════════════════════════════════════════════════════════════════════ */
class ScreenFlash {
  constructor() {
    this.el     = document.getElementById('screen-flash');
    this._timer = null;
  }

  /**
   * @param {number} h  – hue (0-360)
   * @param {number} s  – saturation % (0-100)
   * @param {number} l  – lightness % (0-100)
   */
  fire(h, s, l) {
    clearTimeout(this._timer);

    /* Build a cinematic mesh-gradient:
       centre bright core → mid ring → dark edge, keeping black visible */
    const core   = `hsla(${h},${s}%,${l}%,0.55)`;
    const mid    = `hsla(${h},${s - 10}%,${l - 12}%,0.30)`;
    const edge   = `hsla(${h + 20},${s - 20}%,${l - 25}%,0.0)`;

    this.el.style.background = [
      `radial-gradient(ellipse 90% 70% at 50% 50%, ${core} 0%, ${mid} 45%, ${edge} 80%)`,
    ].join(',');

    /* Snap to visible */
    this.el.classList.remove('fading');
    this.el.classList.add('flashing');

    /* Hold → then drift out */
    this._timer = setTimeout(() => {
      this.el.classList.replace('flashing', 'fading');
    }, CONFIG.flashHoldDuration);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   PARTICLE
   ═══════════════════════════════════════════════════════════════════════ */
class Particle {
  /**
   * @param {number} x     – burst origin X (CSS px)
   * @param {number} y     – burst origin Y (CSS px)
   * @param {number[]} band – HSL colour band
   */
  constructor(x, y, band) {
    /* Position — scatter around origin */
    this.x = x + (Math.random() - 0.5) * CONFIG.scatterRadius * 2;
    this.y = y + (Math.random() - 0.5) * CONFIG.scatterRadius * 2;

    /* Velocity */
    const angle = Math.random() * Math.PI * 2;
    const speed = rand(CONFIG.speedMin, CONFIG.speedMax);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    /* Shape */
    this.radius    = rand(CONFIG.sizeMin, CONFIG.sizeMax);
    /** 0 = circle, 1 = soft diamond, 2 = elongated streak */
    this.shape     = Math.floor(Math.random() * 3);
    this.rotation  = Math.random() * Math.PI * 2;
    this.rotSpeed  = (Math.random() - 0.5) * 0.08;

    /* Lifetime */
    this.lifetime  = Math.round(rand(CONFIG.lifetimeMin, CONFIG.lifetimeMax));
    this.age       = 0;

    /* Wobble direction */
    this.wobbleDir = Math.random() < 0.5 ? 1 : -1;

    /* Colour */
    const h = band[0] + (Math.random() - 0.5) * 22;
    const s = rand(band[1], band[2]);
    const l = rand(band[3], band[4]);
    this.hsl = `${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%`;
  }

  update() {
    this.age++;
    this.rotation += this.rotSpeed;

    /* Organic wobble */
    const spd   = Math.hypot(this.vx, this.vy);
    const angle = Math.atan2(this.vy, this.vx)
                + CONFIG.wobble * this.wobbleDir * (Math.random() - 0.5);
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd;

    /* Friction + gravity */
    this.vx *= CONFIG.friction;
    this.vy  = this.vy * CONFIG.friction + CONFIG.gravity;

    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx) {
    const progress = this.age / this.lifetime;
    const alpha    = (1 - progress) ** 2;           // quadratic ease-out
    const r        = this.radius * (1 - progress * 0.35);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    /* Glow halo */
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.8);
    grd.addColorStop(0,   `hsla(${this.hsl},0.9)`);
    grd.addColorStop(0.4, `hsla(${this.hsl},0.35)`);
    grd.addColorStop(1,   `hsla(${this.hsl},0)`);

    ctx.beginPath();
    ctx.arc(0, 0, r * 2.8, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    /* Core shape */
    ctx.fillStyle = `hsla(${this.hsl},1)`;
    ctx.beginPath();

    if (this.shape === 0) {
      /* Circle */
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else if (this.shape === 1) {
      /* Soft diamond */
      ctx.moveTo(0, -r * 1.2);
      ctx.quadraticCurveTo( r * 0.7,  0,  0,  r * 1.2);
      ctx.quadraticCurveTo(-r * 0.7,  0,  0, -r * 1.2);
    } else {
      /* Elongated streak */
      ctx.ellipse(0, 0, r * 0.5, r * 1.8, 0, 0, Math.PI * 2);
    }

    ctx.fill();
    ctx.restore();
  }

  get isDead() { return this.age >= this.lifetime; }
}

/* ═══════════════════════════════════════════════════════════════════════
   QUOTE MANAGER
   ═══════════════════════════════════════════════════════════════════════ */
class QuoteManager {
  constructor() {
    this.overlay    = document.getElementById('quote-overlay');
    this.textEl     = document.getElementById('quote-text');
    this.authorEl   = document.getElementById('quote-author');
    this.ruleEl     = document.getElementById('quote-rule');
    this._timer     = null;
    this._lastIdx   = -1;
  }

  /**
   * Show a random quote tinted with the burst colour.
   * @param {string} hsl – "h,s%,l%" string for text colour tint
   */
  show(hsl) {
    /* Cancel any pending fade */
    clearTimeout(this._timer);
    this.overlay.classList.remove('visible', 'fading');

    const { item, idx } = pickUnique(QUOTES, this._lastIdx);
    this._lastIdx = idx;

    this.textEl.textContent   = item.text;
    this.authorEl.textContent = `— ${item.author}`;

    /* Tint the quote lightly towards the burst colour */
    const lightHsl = hsl.replace(/,[\d.]+%$/, ',96%'); // keep hue/sat, push lightness up
    this.textEl.style.color = `hsla(${lightHsl},1)`;

    /* Tint the decorative rule to match the palette */
    if (this.ruleEl) {
      this.ruleEl.style.color = `hsla(${lightHsl},1)`;
    }

    /* Trigger visible transition (rAF ensures class is applied after paint) */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.overlay.classList.add('visible');
      });
    });

    /* Schedule fade-out */
    this._timer = setTimeout(() => {
      this.overlay.classList.replace('visible', 'fading');

      /* Clean up after transition ends */
      this.overlay.addEventListener('transitionend', () => {
        this.overlay.classList.remove('fading');
      }, { once: true });
    }, CONFIG.quoteDuration);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   PARTICLE SYSTEM
   ═══════════════════════════════════════════════════════════════════════ */
class ParticleSystem {
  constructor(canvas, quoteManager, screenFlash) {
    this.canvas       = canvas;
    this.ctx          = canvas.getContext('2d');
    this.pool         = [];
    this.quoteManager = quoteManager;
    this.screenFlash  = screenFlash;
    this._lastPalette = -1;

    this._resize = this._resize.bind(this);
    this._loop   = this._loop.bind(this);

    this._init();
  }

  _init() {
    window.addEventListener('resize', this._resize);
    this._resize();

    /* Desktop click */
    this.canvas.addEventListener('click', (e) => {
      this._burst(e.clientX, e.clientY);
    });

    /* Mobile multi-touch */
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        this._burst(t.clientX, t.clientY);
      }
    }, { passive: false });

    /* Space key → burst from screen centre */
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        this._burst(window.innerWidth / 2, window.innerHeight / 2);
      }
    });

    requestAnimationFrame(this._loop);
  }

  /** HiDPI-aware canvas resize. */
  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = window.innerWidth  * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width  = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.scale(dpr, dpr);
  }

  /** Spawn a full burst + show a quote. */
  _burst(x, y) {
    const { item: palette, idx } = pickUnique(CONFIG.palettes, this._lastPalette);
    this._lastPalette = idx;
    const band = palette.band;

    const midH     = band[0];
    const midS     = (band[1] + band[2]) / 2;
    const midL     = clamp((band[3] + band[4]) / 2, 60, 85);
    const burstHsl = `${midH},${midS.toFixed(0)}%,${midL.toFixed(0)}%`;

    for (let i = 0; i < CONFIG.particleCount; i++) {
      this.pool.push(new Particle(x, y, band));
    }

    this.screenFlash.fire(midH, midS, midL);
    this.rippleSystem.add(x, y, midH, midS, midL);
    this.counter.increment();
    this.quoteManager.show(burstHsl);
  }

  _loop() {
    const { ctx } = this;
    const W = window.innerWidth;
    const H = window.innerHeight;

    ctx.fillStyle = `rgba(0,0,0,${CONFIG.trailAlpha})`;
    ctx.fillRect(0, 0, W, H);

    this.pool = this.pool.filter((p) => {
      p.update();
      p.draw(ctx);
      return !p.isDead;
    });

    requestAnimationFrame(this._loop);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   RIPPLE SYSTEM
   Sonar-style expanding rings drawn on a separate canvas layer.
   ═══════════════════════════════════════════════════════════════════════ */
class RippleSystem {
  constructor() {
    this.canvas = document.getElementById('ripple-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this.rings  = [];
    this._resize = this._resize.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
    requestAnimationFrame(this._loop.bind(this));
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width  = window.innerWidth  * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width  = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.scale(dpr, dpr);
  }

  /** Add up to 3 staggered rings per burst. */
  add(x, y, h, s, l) {
    const count = 3;
    for (let i = 0; i < count; i++) {
      this.rings.push({
        x, y,
        radius:   0,
        maxR:     Math.max(window.innerWidth, window.innerHeight) * rand(0.55, 0.9),
        delay:    i * 90,          // ms between rings
        born:     performance.now() + i * 90,
        h, s, l,
        speed:    rand(3.5, 6),    // px per frame
        thickness: rand(1.2, 2.8),
      });
    }
  }

  _loop() {
    const { ctx } = this;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const now = performance.now();
    this.rings = this.rings.filter((r) => {
      if (now < r.born) return true;         // not started yet
      r.radius += r.speed;
      if (r.radius > r.maxR) return false;   // done

      const progress = r.radius / r.maxR;
      const alpha    = (1 - progress) * 0.55;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `hsl(${r.h},${r.s}%,${r.l}%)`;
      ctx.lineWidth   = r.thickness * (1 - progress * 0.6);
      ctx.shadowColor = `hsl(${r.h},${r.s}%,${r.l}%)`;
      ctx.shadowBlur  = 12;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      return true;
    });

    requestAnimationFrame(this._loop.bind(this));
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   IMPACT COUNTER
   Animated number in the bottom-right corner.
   ═══════════════════════════════════════════════════════════════════════ */
class ImpactCounter {
  constructor() {
    this.numEl  = document.getElementById('counter-num');
    this.count  = 0;
    this._bumpTimer = null;
  }

  increment() {
    this.count++;
    this.numEl.textContent = this.count;

    /* Bump animation */
    clearTimeout(this._bumpTimer);
    this.numEl.classList.remove('bump');
    /* Force reflow so the class re-triggers */
    void this.numEl.offsetWidth;
    this.numEl.classList.add('bump');
    this._bumpTimer = setTimeout(() => this.numEl.classList.remove('bump'), 350);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   CURSOR TRAIL
   Tiny micro-particles follow the mouse for a subtle comet effect.
   ═══════════════════════════════════════════════════════════════════════ */
class CursorTrail {
  constructor(particleSystem) {
    this.ps       = particleSystem;
    this._lastX   = -999;
    this._lastY   = -999;
    this._enabled = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (!this._enabled) return;   // skip on touch-only devices

    window.addEventListener('mousemove', (e) => {
      const dx = e.clientX - this._lastX;
      const dy = e.clientY - this._lastY;
      const dist = Math.hypot(dx, dy);

      /* Only emit when moving fast enough */
      if (dist < 8) return;

      this._lastX = e.clientX;
      this._lastY = e.clientY;

      /* Pick palette based on current last-used palette */
      const palette = CONFIG.palettes[this.ps._lastPalette < 0 ? 0 : this.ps._lastPalette];
      const band    = palette.band;

      /* Spawn 1-2 tiny ghost particles */
      const n = dist > 20 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const p          = new Particle(e.clientX, e.clientY, band);
        p.radius         = rand(1, 3.5);
        p.lifetime       = Math.round(rand(18, 38));
        p.vx            *= 0.2;
        p.vy            *= 0.2;
        this.ps.pool.push(p);
      }
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   ABOUT MODAL
   ═══════════════════════════════════════════════════════════════════════ */
class AboutModal {
  constructor() {
    this.modal    = document.getElementById('about-modal');
    this.openBtn  = document.getElementById('about-btn');
    this.closeBtn = document.getElementById('about-close');
    this._init();
  }

  _init() {
    this.openBtn.addEventListener('click',  () => this.open());
    this.closeBtn.addEventListener('click', () => this.close());

    /* Click on backdrop closes modal */
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    /* Escape key closes modal */
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  open()  { this.modal.classList.add('open');    this.closeBtn.focus(); }
  close() { this.modal.classList.remove('open'); this.openBtn.focus();  }
}

/* ═══════════════════════════════════════════════════════════════════════
   SHARE MANAGER
   Uses Web Share API on mobile; falls back to clipboard copy on desktop.
   ═══════════════════════════════════════════════════════════════════════ */
class ShareManager {
  constructor() {
    this.btn   = document.getElementById('share-btn');
    this.toast = document.getElementById('share-toast');
    this._toastTimer = null;

    this.shareData = {
      title: 'EquiBurst — Gender Equity in STEM',
      text:  'Click anywhere. Watch the universe react. An interactive art piece celebrating every mind that dared to push further.',
      url:   'https://bayraktarulku.github.io/equi_burst/',
    };

    this.btn.addEventListener('click', () => this._share());
  }

  async _share() {
    /* Native share sheet (mobile / supported browsers) */
    if (navigator.share) {
      try {
        await navigator.share(this.shareData);
        return;
      } catch (_) {
        /* User cancelled — no fallback needed */
        return;
      }
    }

    /* Fallback: copy URL to clipboard */
    try {
      await navigator.clipboard.writeText(this.shareData.url);
      this._showToast('Link copied!');
    } catch (_) {
      this._showToast('Copy: ' + this.shareData.url);
    }
  }

  _showToast(msg) {
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove('show'), 2400);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════════════════ */
const canvas        = document.getElementById('burst-canvas');
const quoteManager  = new QuoteManager();
const screenFlash   = new ScreenFlash();
const rippleSystem  = new RippleSystem();
const counter       = new ImpactCounter();

const ps = new ParticleSystem(canvas, quoteManager, screenFlash);
ps.rippleSystem = rippleSystem;
ps.counter      = counter;

new CursorTrail(ps);
new AboutModal();
new ShareManager();
