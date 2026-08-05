// Band animation (악단 애니메이션) — a canvas performer stage driven by MIDI
// note events. Faithful port of DeskWeb MidiPlayerWindow's stage renderer
// (_mapProgram / _onNote / _startLoop) to a standalone, framework-agnostic class.

// Sprite sheet spec (4-frame horizontal, 192px frames at stride 200, offset 8).
const FRAME_SIZE = 192;
const FRAME_COUNT = 4;
const FRAME_STRIDE = 200;
const FRAME_OFFSET = 8;

const SPRITE_BASE = "/band"; // /band/<slug>/{idle,play}.png

export interface BandNote {
  channel: number;
  program: number;
  midiNote: number;
  velocity: number;
}

interface Performer {
  slug: string;
  lastNote: number;
  bornAt: number;
  program: number;
  hue: number;
  // last-drawn screen box (for click hit-testing)
  x: number;
  y: number;
  size: number;
}

interface Ripple {
  x: number;
  y: number;
  at: number;
  hue: number;
}

export interface PerformerHit {
  slug: string;
  program: number;
  hue: number;
}

/** GM program (or drum flag) → performer sprite slug. */
export function mapProgram(program: number, isDrum: boolean): string {
  if (isDrum) return "drum";
  const p = program || 0;
  if (p <= 7) return "piano";
  if (p <= 15) return "keytar";
  if (p <= 23) return "synth";
  if (p <= 25) return "guitar";
  if (p <= 31) return "elec-guitar";
  if (p === 32) return "contrabass";
  if (p <= 39) return "elec-bass";
  if (p === 40) return "violin";
  if (p === 41) return "viola";
  if (p === 42) return "cello";
  if (p === 43) return "contrabass";
  if (p <= 45) return "violin";
  if (p === 46) return "harp";
  if (p === 47) return "drum";
  if (p <= 51) return "violin";
  if (p <= 54) return "vocal-1";
  if (p === 55) return "drum";
  if (p === 56 || p === 59) return "trumpet";
  if (p === 57) return "trombone";
  if (p === 58) return "tuba";
  if (p === 60) return "horn";
  if (p <= 63) return "trumpet";
  if (p <= 67) return "clarinet";
  if (p === 68 || p === 69) return "oboe";
  if (p <= 71) return "clarinet";
  if (p <= 79) return "flute";
  if (p <= 95) return "synth";
  if (p <= 103) return "dj-deck";
  if (p === 104 || p === 105 || p === 107) return "guitar";
  if (p === 110) return "violin";
  if (p <= 111) return "flute";
  if (p <= 119) return "drum";
  return "dj-deck";
}

export class BandStage {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private performers: Record<string, Performer> = {};
  private order: string[] = [];
  private spectrum: number[] = new Array(64).fill(0);
  private sprites: Record<string, HTMLImageElement> = {};
  private songLabel: string | null = null;
  private ripples: Ripple[] = [];
  private recentPitch = new Map<number, number>(); // pitchClass → last-heard timestamp
  private ro: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
  }

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w && h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  setSong(label: string | null): void {
    this.songLabel = label;
  }

  /** Number of performers currently on stage (for diagnostics/tests). */
  get performerCount(): number {
    return this.order.length;
  }

  /** Pitch classes (0–11) heard recently — the current chord/harmony to snap to. */
  chordClasses(windowMs = 2600): number[] {
    const now = performance.now();
    const out: number[] = [];
    this.recentPitch.forEach((t, pc) => {
      if (now - t < windowMs) out.push(pc);
    });
    return out;
  }

  /** The performer nearest a click x (which instrument was clicked), or null. */
  performerAt(px: number): PerformerHit | null {
    let best: Performer | null = null;
    let bestDx = Infinity;
    for (const slug of this.order) {
      const p = this.performers[slug];
      if (!p.size) continue;
      const dx = Math.abs(px - p.x);
      if (dx < p.size * 0.85 && dx < bestDx) {
        bestDx = dx;
        best = p;
      }
    }
    return best ? { slug: best.slug, program: best.program, hue: best.hue } : null;
  }

  /** Spawn a sound-wave ripple at a click point. */
  addRipple(x: number, y: number, hue: number): void {
    this.ripples.push({ x, y, at: performance.now(), hue });
    if (this.ripples.length > 48) this.ripples.shift();
  }

  /** Re-activate a performer's sprite (as if it just played). */
  strike(slug: string): void {
    const p = this.performers[slug];
    if (p) p.lastNote = performance.now();
  }

  reset(): void {
    this.performers = {};
    this.order = [];
    this.spectrum = new Array(64).fill(0);
    this.ripples = [];
    this.recentPitch.clear();
  }

  /** Feed a MIDI note: spawn/activate its performer + inject spectrum energy. */
  onNote(e: BandNote): void {
    const isDrum = e.channel === 9; // GM channel 10 (0-indexed 9) = percussion
    const slug = mapProgram(e.program, isDrum);

    if (!this.performers[slug]) {
      this.performers[slug] = {
        slug,
        lastNote: 0,
        bornAt: performance.now(),
        program: e.program,
        hue: (this.order.length * 47) % 360,
        x: 0,
        y: 0,
        size: 0,
      };
      this.order.push(slug);
    }
    const perf = this.performers[slug];
    perf.lastNote = performance.now();
    perf.program = e.program;
    // track the current harmony (pitch classes), skipping drums
    if (!isDrum) this.recentPitch.set(((e.midiNote % 12) + 12) % 12, performance.now());

    const bins = this.spectrum.length;
    const idx = Math.max(0, Math.min(bins - 1, Math.floor(((e.midiNote - 24) / 72) * bins)));
    const energy = Math.min(1, (e.velocity || 80) / 127);
    this.spectrum[idx] = Math.max(this.spectrum[idx], energy);
    if (idx > 0) this.spectrum[idx - 1] = Math.max(this.spectrum[idx - 1], energy * 0.5);
    if (idx < bins - 1) this.spectrum[idx + 1] = Math.max(this.spectrum[idx + 1], energy * 0.5);
  }

  private sprite(slug: string, mode: "idle" | "play"): HTMLImageElement {
    const key = `${slug}/${mode}`;
    if (!this.sprites[key]) {
      const img = new Image();
      img.src = `${SPRITE_BASE}/${slug}/${mode}.png`;
      this.sprites[key] = img;
    }
    return this.sprites[key];
  }

  start(): void {
    if (this.raf) return;
    const draw = () => {
      this.raf = requestAnimationFrame(draw);
      this.render();
    };
    draw();
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose(): void {
    this.stop();
    this.ro.disconnect();
  }

  private render(): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas || canvas.width === 0) return;
    const w = canvas.width;
    const h = canvas.height;
    const now = performance.now();

    // stage gradient
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0A0A18");
    bg.addColorStop(0.7, "#141428");
    bg.addColorStop(1, "#2A2A44");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // spectrum bars (behind performers)
    const bins = this.spectrum.length;
    const barW = w / bins;
    for (let i = 0; i < bins; i++) {
      const v = this.spectrum[i];
      if (v > 0.01) {
        const barH = v * h * 0.55;
        const hue = (i / bins) * 300;
        ctx.fillStyle = `hsla(${hue}, 85%, 60%, 0.55)`;
        ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH);
        ctx.fillStyle = `hsla(${hue}, 90%, 75%, 0.9)`;
        ctx.fillRect(i * barW + 1, h - barH, barW - 2, 3);
        this.spectrum[i] *= 0.94;
      }
    }

    // stage floor
    ctx.fillStyle = "rgba(60, 50, 90, 0.5)";
    ctx.fillRect(0, h * 0.88, w, h * 0.12);

    // performers
    const order = this.order;
    const n = order.length;
    if (n > 0) {
      const perRow = Math.min(n, n > 5 ? Math.ceil(n / 2) : n);
      const size = Math.min(170, Math.max(80, (w - 40) / (perRow + 0.5)));
      for (let k = 0; k < n; k++) {
        const perf = this.performers[order[k]];
        const row = Math.floor(k / perRow);
        const col = k % perRow;
        const rowCount = row === Math.floor((n - 1) / perRow) ? n - row * perRow : perRow;
        const cx = w / 2 + (col - (rowCount - 1) / 2) * (size * 1.05);
        const cy = h * (n > perRow ? (row === 0 ? 0.52 : 0.8) : 0.72);
        // remember screen box for click hit-testing
        perf.x = cx;
        perf.y = cy - size / 2;
        perf.size = size;

        const active = now - perf.lastNote < 300;
        const img = this.sprite(perf.slug, active ? "play" : "idle");
        if (img.complete && img.naturalWidth > 0) {
          const frame = active
            ? Math.floor(now / 140) % FRAME_COUNT
            : Math.floor(now / 500) % FRAME_COUNT;
          const sx = FRAME_OFFSET + frame * FRAME_STRIDE;
          const age = Math.min(1, (now - perf.bornAt) / 400);
          const s = size * (0.6 + 0.4 * age);
          const bounce = active ? Math.sin(now / 90) * 4 : 0;
          ctx.drawImage(img, sx, FRAME_OFFSET, FRAME_SIZE, FRAME_SIZE, cx - s / 2, cy - s + bounce, s, s);
        }
      }
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "16px Tahoma, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("연주자 대기중 — 곡을 재생하면 악단이 등장합니다", w / 2, h / 2);
    }

    // click sound-wave ripples (on top)
    const RIP = 720;
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      const age = now - r.at;
      if (age > RIP) {
        this.ripples.splice(i, 1);
        continue;
      }
      const p = age / RIP;
      const rad = 8 + p * 130;
      const a = (1 - p) * 0.7;
      ctx.strokeStyle = `hsla(${r.hue}, 90%, 62%, ${a})`;
      ctx.lineWidth = 3.5 * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `hsla(${r.hue}, 95%, 72%, ${a * 0.4})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }

    // song title
    if (this.songLabel) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 15px Tahoma, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("♪ " + this.songLabel, w / 2, 28);
    }
  }
}
