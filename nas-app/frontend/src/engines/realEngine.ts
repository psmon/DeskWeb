// Real (HQ) playback engine — SpessaSynth WASM AudioWorklet with a locally
// vendored SF3 soundfont. Ported from DeskWeb MidiPlayerWindow._ensureSpessa,
// with the qooxdoo inline-<script> dynamic-import workaround removed (a real
// bundler supports ESM imports directly) and all CDN URLs made local.

import { WorkletSynthesizer, Sequencer } from "spessasynth_lib";
// Vite emits the worklet as a static asset and gives us its URL.
import workletUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";

/** Locally hosted soundfont. Placed by scripts/fetch-assets into public/vendor. */
const SOUNDFONT_URL = "/vendor/GeneralUserGS.sf3";

export interface NoteEvent {
  channel: number;
  program: number;
  midiNote: number;
  velocity: number;
}

export interface RealEngineCallbacks {
  onEnded?: () => void;
  onNote?: (e: NoteEvent) => void;
}

export class RealEngine {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  // The lib's public surface is loosely typed; keep this as any locally.
  private seq: any = null;
  private ready: Promise<void> | null = null;
  private chProg: number[] = new Array(16).fill(0);
  private volume = 0.9;

  constructor(private cb: RealEngineCallbacks = {}) {}

  /** One-time init: audio context, worklet, synth, soundfont, sequencer. */
  private ensure(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      const AC: typeof AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      await ctx.audioWorklet.addModule(workletUrl);

      const synth = new (WorkletSynthesizer as any)(ctx);
      const gain = ctx.createGain();
      gain.gain.value = this.volume;
      synth.connect(gain);
      gain.connect(ctx.destination);

      const sfResp = await fetch(SOUNDFONT_URL);
      if (!sfResp.ok) {
        throw new Error(
          `사운드폰트를 찾을 수 없습니다 (${SOUNDFONT_URL}). ` +
            `scripts/fetch-assets 로 GeneralUserGS.sf3 를 내려받아 주세요.`,
        );
      }
      const sf = await sfResp.arrayBuffer();
      await synth.soundBankManager.addSoundBank(sf, "main");
      await synth.isReady;

      const seq = new (Sequencer as any)(synth);
      seq.loopCount = 0;

      // Track program changes so the band animation can pick performers later.
      synth.eventHandler.addEvent(
        "programChange",
        "midi-ani-prog",
        (e: any) => {
          if (typeof e?.channel === "number") this.chProg[e.channel] = e.program ?? 0;
        },
      );
      synth.eventHandler.addEvent("noteOn", "midi-ani-note", (e: any) => {
        this.cb.onNote?.({
          channel: e.channel ?? 0,
          program: this.chProg[e.channel ?? 0] ?? 0,
          midiNote: e.midiNote ?? e.note ?? 0,
          velocity: e.velocity ?? 0,
        });
      });
      seq.eventHandler.addEvent("songEnded", "midi-ani-end", () => {
        this.cb.onEnded?.();
      });

      this.ctx = ctx;
      this.gain = gain;
      this.seq = seq;
    })().catch((err) => {
      // Allow a retry after a failed init.
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  /** Load and play a MIDI file (binary) with a display name. */
  async play(binary: ArrayBuffer, fileName: string): Promise<void> {
    await this.ensure();
    this.chProg = new Array(16).fill(0);
    await this.ctx!.resume();
    this.seq.loadNewSongList([{ binary, fileName }]);
    this.seq.play();
  }

  pause(): void {
    if (this.seq && !this.seq.paused) this.seq.pause();
  }

  resume(): void {
    if (this.seq && this.seq.paused) this.seq.play();
  }

  stop(): void {
    if (this.seq) {
      this.seq.pause();
      try {
        this.seq.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }

  get paused(): boolean {
    return this.seq ? !!this.seq.paused : true;
  }

  get currentTime(): number {
    return this.seq ? this.seq.currentTime ?? 0 : 0;
  }

  set currentTime(t: number) {
    if (this.seq) this.seq.currentTime = t;
  }

  get duration(): number {
    return this.seq ? this.seq.duration ?? 0 : 0;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gain) this.gain.gain.value = this.volume;
  }

  async dispose(): Promise<void> {
    try {
      this.seq?.pause();
    } catch {
      /* ignore */
    }
    try {
      await this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.seq = null;
    this.ready = null;
  }
}
