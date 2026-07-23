// Web Audio API Ambient Sound Synthesizer for Live Focus Rooms
// Generates rain, brown noise, lo-fi binaural beats, and ocean waves procedurally without external assets.

export type SoundType = 'rain' | 'brownian' | 'lofi' | 'ocean' | 'off';

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying: boolean = false;
  private currentType: SoundType = 'off';
  private activeNodes: (AudioNode | number)[] = [];
  private lfoInterval: number | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime, 0.05);
    }
  }

  public stop() {
    if (this.lfoInterval) {
      window.clearInterval(this.lfoInterval);
      this.lfoInterval = null;
    }
    this.activeNodes.forEach(node => {
      if (typeof node === 'object' && node !== null) {
        if ('stop' in node && typeof (node as any).stop === 'function') {
          try { (node as any).stop(); } catch (e) {}
        }
        if ('disconnect' in node && typeof (node as any).disconnect === 'function') {
          try { (node as any).disconnect(); } catch (e) {}
        }
      }
    });
    this.activeNodes = [];
    this.isPlaying = false;
    this.currentType = 'off';
  }

  public play(type: SoundType, volume: number = 0.5) {
    this.stop();
    if (type === 'off') return;

    this.initCtx();
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
    this.isPlaying = true;
    this.currentType = type;

    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    if (type === 'brownian' || type === 'rain' || type === 'ocean') {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'brownian') {
          // Brown noise integration filter
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        } else {
          output[i] = white;
        }
      }

      const whiteSource = this.ctx.createBufferSource();
      whiteSource.buffer = noiseBuffer;
      whiteSource.loop = true;

      if (type === 'brownian') {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 350;
        whiteSource.connect(filter);
        filter.connect(this.masterGain);
        this.activeNodes.push(filter);
      } else if (type === 'rain') {
        const lowpass = this.ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 1200;

        const highpass = this.ctx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 400;

        whiteSource.connect(lowpass);
        lowpass.connect(highpass);
        highpass.connect(this.masterGain);
        this.activeNodes.push(lowpass, highpass);
      } else if (type === 'ocean') {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 250;

        whiteSource.connect(filter);
        filter.connect(this.masterGain);
        this.activeNodes.push(filter);

        // Modulate ocean wave frequency rhythmically
        let angle = 0;
        this.lfoInterval = window.setInterval(() => {
          if (!this.ctx || !this.isPlaying) return;
          angle += 0.05;
          const sweep = 200 + Math.sin(angle) * 180;
          filter.frequency.setTargetAtTime(Math.max(100, sweep), this.ctx.currentTime, 0.1);
        }, 100);
      }

      whiteSource.start();
      this.activeNodes.push(whiteSource);
    } else if (type === 'lofi') {
      // 432Hz binaural sine pad + harmonic layer
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.value = 216; // A3 root
      osc2.frequency.value = 226; // 10Hz binaural beat offset (Alpha wave stimulation)

      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'triangle';
      subOsc.frequency.value = 108; // Deep sub

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;

      const padGain = this.ctx.createGain();
      padGain.gain.value = 0.3;

      osc1.connect(padGain);
      osc2.connect(padGain);
      subOsc.connect(padGain);
      padGain.connect(filter);
      filter.connect(this.masterGain);

      osc1.start();
      osc2.start();
      subOsc.start();
      this.activeNodes.push(osc1, osc2, subOsc, filter, padGain);
    }
  }

  public getSoundType(): SoundType {
    return this.currentType;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const ambientEngine = new AmbientSoundEngine();
