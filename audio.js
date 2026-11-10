/**
 * Web Audio API Synthesizer for 3D Disc Golf
 * Generates pure procedural audio cues without external assets:
 * - Throw Whoosh (scales with power/airspeed)
 * - Metallic Chain Crash / Rattle (multi-resonant metallic frequencies)
 * - Tree Trunk Thud (woody knock + resonant body)
 * - Ground Grass/Dirt Thud (soft low-pass impact)
 * - Water Splash (OB hazard plunge with bubbling)
 * - Hole Complete / Birdie / Ace Jingle
 */

class DiscGolfAudio {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized && this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
        this.initialized = true;
      }
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  ensureContext() {
    if (!this.initialized || !this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 1. Throw Whoosh Sound (scales with throw power from 0 to 1)
  playWhoosh(power = 0.8) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const duration = 0.35 + (1.0 - power) * 0.15;

    // Buffer of white noise
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Bandpass filter for rushing wind sound
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const startFreq = 220 + power * 250;
    const peakFreq = 750 + power * 950;
    filter.frequency.setValueAtTime(startFreq, t);
    filter.frequency.exponentialRampToValueAtTime(peakFreq, t + duration * 0.4);
    filter.frequency.exponentialRampToValueAtTime(180, t + duration);
    filter.Q.setValueAtTime(2.5, t);

    // Gain envelope
    const gain = this.ctx.createGain();
    const peakGain = 0.15 + power * 0.45;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + duration * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + duration);
  }

  // 2. Realistic Metallic Chain Crash (polyphonic resonant steel links clattering)
  playChainsCrash(isCleanCenter = true) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const chainFreqs = [740, 920, 1180, 1420, 1860, 2350, 3100, 3950];
    const hitCount = isCleanCenter ? 12 : 7;

    // Master chain compressor / limiter
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0.65, t);
    masterGain.gain.exponentialRampToValueAtTime(0.01, t + 1.4);
    masterGain.connect(this.ctx.destination);

    // Multiple rapid staggered metal link strikes
    for (let i = 0; i < hitCount; i++) {
      const strikeTime = t + Math.random() * 0.18;
      const freq = chainFreqs[Math.floor(Math.random() * chainFreqs.length)] * (0.95 + Math.random() * 0.1);

      // Metal ring oscillator
      const osc = this.ctx.createOscillator();
      osc.type = Math.random() > 0.4 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, strikeTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, strikeTime + 0.3);

      // Resonant bandpass
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(freq, strikeTime);
      bp.Q.setValueAtTime(18, strikeTime);

      const oscGain = this.ctx.createGain();
      const strikeVolume = (0.2 + Math.random() * 0.3) / (i * 0.2 + 1);
      oscGain.gain.setValueAtTime(0.001, strikeTime);
      oscGain.gain.linearRampToValueAtTime(strikeVolume, strikeTime + 0.004);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, strikeTime + 0.35 + Math.random() * 0.45);

      osc.connect(bp);
      bp.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start(strikeTime);
      osc.stop(strikeTime + 0.9);
    }

    // Heavy basket pole chime / ring
    const poleOsc = this.ctx.createOscillator();
    poleOsc.type = 'sine';
    poleOsc.frequency.setValueAtTime(460, t);
    poleOsc.frequency.exponentialRampToValueAtTime(440, t + 0.8);

    const poleGain = this.ctx.createGain();
    poleGain.gain.setValueAtTime(0.35, t);
    poleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    poleOsc.connect(poleGain);
    poleGain.connect(masterGain);

    poleOsc.start(t);
    poleOsc.stop(t + 0.8);
  }

  // 3. Tree Trunk / Branch Impact Thud
  playTreeHit() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Deep wood thump
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.22);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);

    // Bark crack / snap noise burst
    const noiseDuration = 0.08;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * noiseDuration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(900, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + noiseDuration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + noiseDuration);
  }

  // 3b. Foliage / Branch Leafy Rustle & Swat
  playFoliageRustle() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const duration = 0.22;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(700, t + duration);
    filter.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + duration);
  }

  // 4c. Slick Ice Slide / Glaze Friction Sound
  playIceSlide() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const duration = 0.28;

    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.exponentialRampToValueAtTime(700, t + duration);
    filter.Q.value = 3.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + duration);
  }

  // 4. Ground Grass / Dirt Thud or Skip
  playGroundHit(isSkip = false) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const duration = isSkip ? 0.12 : 0.18;

    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isSkip ? 650 : 320, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isSkip ? 0.2 : 0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + duration);
  }

  // 4b. Dramatic Flare Skip Sound (sharp turf slap + aerodynamic whip)
  playFlareSkip(power = 1.0) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const duration = 0.22;

    // Fast whipping noise
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, t);
    filter.frequency.exponentialRampToValueAtTime(1600, t + 0.05);
    filter.frequency.exponentialRampToValueAtTime(350, t + duration);
    filter.Q.setValueAtTime(4.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.4 * power, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + duration);

    // Turf pop impulse
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.08);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.35 * power, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  // 4c. Heavy Spike / Tombstone Turf Impact
  playTombstone() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.28);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  // 5. Out-of-Bounds Water Splash
  playWaterSplash() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const duration = 0.7;

    // Splash noise
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(550, t);
    filter.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
    filter.frequency.exponentialRampToValueAtTime(300, t + duration);
    filter.Q.setValueAtTime(2.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + duration);

    // Deep water "glug" / plunge tone
    const glug = this.ctx.createOscillator();
    glug.type = 'sine';
    glug.frequency.setValueAtTime(220, t);
    glug.frequency.exponentialRampToValueAtTime(60, t + 0.4);

    const glugGain = this.ctx.createGain();
    glugGain.gain.setValueAtTime(0.35, t);
    glugGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    glug.connect(glugGain);
    glugGain.connect(this.ctx.destination);

    glug.start(t);
    glug.stop(t + 0.45);
  }

  // 6. Hole Complete / Celebration Jingle
  playCelebration(isUnderPar = true) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = isUnderPar
      ? [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6 (Bright triumph)
      : [440.0, 493.88, 523.25];         // A4, B4, C5 (Calm finish)

    notes.forEach((freq, idx) => {
      const noteTime = t + idx * 0.12;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.25, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.5);
    });
  }

  // 7. Click / UI feedback
  playClick() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.05);
  }
}

window.DiscGolfAudio = DiscGolfAudio;
