// Vertical piano keyboard visualizer (canvas). Renders an 88-ish key piano
// running vertically (low notes at the bottom) and "strikes" the key that is
// playing — a punchy press with a colored glow that decays, giving 타격감.
// Driven live by MIDI noteOn events (same feed as the band).

const LOW = 33; // A1
const HIGH = 96; // C7
const BLACK = new Set([1, 3, 6, 8, 10]); // C# D# F# G# A#
const DECAY_MS = 380;

interface Hit {
  at: number;
  vel: number;
}

export class PianoKeys {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private hits = new Map<number, Hit>();
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

  onNote(e: { midiNote: number; velocity: number }): void {
    if (e.velocity <= 0) return;
    const n = e.midiNote;
    if (n < LOW || n > HIGH) return;
    this.hits.set(n, { at: performance.now(), vel: e.velocity });
  }

  reset(): void {
    this.hits.clear();
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

  private whiteYPositions(h: number): { pos: Map<number, { y: number; kh: number }>; kh: number } {
    let whites = 0;
    for (let n = LOW; n <= HIGH; n++) if (!BLACK.has(n % 12)) whites++;
    const kh = h / whites;
    const pos = new Map<number, { y: number; kh: number }>();
    let idx = 0;
    for (let n = LOW; n <= HIGH; n++) {
      if (!BLACK.has(n % 12)) {
        pos.set(n, { y: h - (idx + 1) * kh, kh });
        idx++;
      }
    }
    return { pos, kh };
  }

  private intensity(n: number, now: number): number {
    const hit = this.hits.get(n);
    if (!hit) return 0;
    const age = now - hit.at;
    if (age > DECAY_MS) return 0;
    const decay = 1 - age / DECAY_MS;
    return decay * Math.min(1, 0.4 + (hit.vel / 127) * 0.6);
  }

  private render(): void {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!W || !H) return;
    const now = performance.now();

    ctx.fillStyle = "#0e0e16";
    ctx.fillRect(0, 0, W, H);

    const { pos, kh } = this.whiteYPositions(H);

    // ---- white keys ----
    for (const [n, { y }] of pos) {
      const it = this.intensity(n, now);
      const push = it * 8;
      // base ivory → hot on strike
      if (it > 0.02) {
        ctx.fillStyle = `rgb(255, ${Math.round(210 - it * 140)}, ${Math.round(150 - it * 130)})`;
      } else {
        ctx.fillStyle = "#eef0f6";
      }
      ctx.fillRect(push, y + 1, W - push, kh - 2);
      ctx.strokeStyle = "#c8ccd8";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, y + 0.5, W - 1, kh - 1);
      if (it > 0.03) {
        ctx.save();
        ctx.shadowColor = "#e8451e";
        ctx.shadowBlur = it * 22;
        ctx.fillStyle = `rgba(232,69,30,${it * 0.45})`;
        ctx.fillRect(push, y + 1, W - push, kh - 2);
        ctx.restore();
      }
    }

    // ---- black keys (drawn on top) ----
    const bw = W * 0.62;
    for (let n = LOW; n <= HIGH; n++) {
      if (!BLACK.has(n % 12)) continue;
      const below = pos.get(n - 1);
      const above = pos.get(n + 1);
      if (!below || !above) continue;
      const yc = below.y; // shared edge between the two white keys
      const bh = kh * 0.64;
      const y = yc - bh / 2;
      const it = this.intensity(n, now);
      const push = it * 8;
      ctx.fillStyle =
        it > 0.02
          ? `rgb(${Math.round(60 + it * 195)}, ${Math.round(30 + it * 130)}, ${Math.round(20)})`
          : "#171720";
      ctx.fillRect(push, y, bw - push, bh);
      if (it > 0.03) {
        ctx.save();
        ctx.shadowColor = "#f0a020";
        ctx.shadowBlur = it * 20;
        ctx.fillStyle = `rgba(240,160,32,${it * 0.6})`;
        ctx.fillRect(push, y, bw - push, bh);
        ctx.restore();
      }
    }
  }
}
