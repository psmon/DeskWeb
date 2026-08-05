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
  // The lib's public surface is loosely typed; keep these as any locally.
  private synth: any = null;
  private seq: any = null;
  private ready: Promise<void> | null = null;
  private chProg: number[] = new Array(16).fill(0);
  private volume = 0.9;

  constructor(private cb: RealEngineCallbacks = {}) {}

  /** One-time init: audio context, worklet, synth, soundfont, sequencer. */
  private ensure(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      // Reuse the context primed on the first user gesture (iOS unlock) so we
      // never create/resume it outside a gesture.
      const AC: typeof AudioContext =
        window.AudioContext || (window as any).webkitAudioContext;
      const ctx = this.ctx ?? new AC();
      this.ctx = ctx;
      // AudioWorklet only exists in a secure context (HTTPS or localhost).
      // Over plain HTTP on a remote host it is undefined → give a clear message.
      if (!ctx.audioWorklet) {
        throw new Error(
          "오디오 재생에는 HTTPS(보안 컨텍스트)가 필요합니다. HTTPS로 접속하거나 " +
            "해당 호스트에서 localhost로 열어주세요. (원격 HTTP는 AudioWorklet 미지원)",
        );
      }
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
      this.synth = synth;
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

  /** True once the synth is initialized (soundfont loaded). */
  get isReady(): boolean {
    return !!this.synth;
  }

  /**
   * Unlock audio on the first user gesture (critical on iOS): create + resume
   * the AudioContext synchronously and play a silent buffer, so it is already
   * running by the time the (async) soundfont finishes loading.
   */
  prime(): void {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AC();
      }
      void this.ctx.resume();
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }

  /**
   * Trigger a percussion hit on the GM drum channel (10 / index 9). Note number
   * selects the drum sound (e.g. 36=kick, 38=snare, 42=hat). Mixes with the
   * song's own drums — great for tapping out a beat.
   */
  playDrum(drumNote: number, velocity = 112): void {
    const synth = this.synth;
    if (!synth) return;
    try {
      this.ctx?.resume();
      synth.noteOn(9, drumNote, velocity);
      window.setTimeout(() => {
        try {
          synth.noteOff(9, drumNote);
        } catch {
          /* ignore */
        }
      }, 180);
    } catch {
      /* ignore */
    }
  }

  /**
   * Play a one-off melodic note on a dedicated channel beyond the song's 16.
   * (Kept for possible future use; the click UI uses playDrum.)
   */
  playNote(program: number, midiNote: number, velocity: number, durationMs = 700): void {
    const synth = this.synth;
    if (!synth) return;
    try {
      this.ctx?.resume();
      while (synth.channelCount <= 16) synth.addNewChannel();
      const ch = 16;
      synth.programChange(ch, program);
      synth.noteOn(ch, midiNote, velocity);
      window.setTimeout(() => {
        try {
          synth.noteOff(ch, midiNote);
        } catch {
          /* ignore */
        }
      }, durationMs);
    } catch {
      /* ignore */
    }
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
