// ── CelloDetector ───────────────────────────────────────────────────────────
// Owns the microphone, the Web Audio graph, all DSP, the analysis loop, mic
// recovery, and the screen wake lock. Knows nothing about the DOM or
// localStorage — it takes a plain params object and emits results via callbacks:
//
//   const det = new CelloDetector(params);
//   det.onFrame(frame => ...)            // every analysis tick — for visualization
//   det.onDetectionChange(on => ...)     // on detected ⇄ not-detected transitions
//   det.onStatus(evt => ...)             // lifecycle: mic, wake lock, errors
//   await det.start();                   // request mic + start loop
//   det.setParams({ threshold: 20 });    // live tuning
//   det.stop();
//
// Structural constants (bar map, cello range, FFT size) live here and are
// exposed on the instance so renderers can stay in sync without duplicating them.

class CelloDetector {
  static NUM_BARS            = 80;
  static MIN_FREQ            = 30;
  static MAX_FREQ            = 4000;
  static CELLO_LOW           = 65;
  static CELLO_HIGH          = 1200;
  static FFT_SIZE            = 4096;
  static HPS_HARMONICS       = 4;
  static RELEASE_MS          = 1500;
  static STABILITY_WINDOW_MS = 500;

  constructor(params = {}) {
    this.params = {
      threshold:        15,
      attackMs:         60,
      stabilityEnabled: true,
      toleranceCents:   30,
      durationMs:       200,
      ...params,
    };

    const C = CelloDetector;

    // Exposed for renderers (bar geometry, axis ranges, scroll window).
    this.NUM_BARS            = C.NUM_BARS;
    this.MIN_FREQ            = C.MIN_FREQ;
    this.MAX_FREQ            = C.MAX_FREQ;
    this.CELLO_LOW           = C.CELLO_LOW;
    this.CELLO_HIGH          = C.CELLO_HIGH;
    this.STABILITY_WINDOW_MS = C.STABILITY_WINDOW_MS;

    // Logarithmic bar frequency map (30 Hz – 4 kHz).
    this.barDefs = Array.from({ length: C.NUM_BARS }, (_, i) => {
      const f1 = C.MIN_FREQ * Math.pow(C.MAX_FREQ / C.MIN_FREQ, i / C.NUM_BARS);
      const f2 = C.MIN_FREQ * Math.pow(C.MAX_FREQ / C.MIN_FREQ, (i + 1) / C.NUM_BARS);
      return { f1, f2, isCello: f1 < C.CELLO_HIGH && f2 > C.CELLO_LOW };
    });

    // Callbacks
    this._frameCb     = null;
    this._detectionCb = null;
    this._statusCb    = null;

    // Audio graph
    this.audioCtx   = null;
    this.analyser   = null;
    this.stream     = null;
    this.sourceNode = null;
    this.freqData   = null;
    this.hpsArray   = null;

    // Loop / lifecycle
    this.rafId        = null;
    this.running      = false;
    this.isRecovering = false;
    this.wakeLock     = null;
    this._runToken    = 0;   // bumped by stop()/_fail(); a start() whose token is
                             // stale was superseded mid-await and must self-abort.

    // Detection state machine
    this.isDetected    = false;
    this.aboveMs       = 0;
    this.belowMs       = 0;
    this.lastFrameTime = null;

    // Stability gate state
    this.f0History           = [];
    this.stabilityGate       = false;
    this.stabilityProgressMs = 0;

    this._tick         = this._tick.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
  }

  // ── Subscriptions / config ────────────────────────────────────────────────
  onFrame(cb)           { this._frameCb = cb;     return this; }
  onDetectionChange(cb) { this._detectionCb = cb; return this; }
  onStatus(cb)          { this._statusCb = cb;    return this; }

  setParams(partial)    { Object.assign(this.params, partial); }

  _emitStatus(evt) { if (this._statusCb) this._statusCb(evt); }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  // Throws on mic/AudioContext acquisition failure so the caller can format the
  // message. Async failures during recovery surface via onStatus({kind:'error'}).
  async start() {
    // Capture a token for this start. stop()/_fail() bump _runToken, so if it
    // changes under us across an await, this start was superseded (e.g. the user
    // hit Stop while the mic prompt was still open) — undo what we acquired and
    // bail, rather than building a session nobody owns.
    const token = ++this._runToken;

    this._emitStatus({ kind: 'requesting-mic' });

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      if (token === this._runToken) throw err;   // current → let the caller format it
      return;                                     // superseded → swallow (consumer is gone)
    }
    // Stopped while acquiring the mic? Drop the just-granted stream before we build
    // anything (it was never assigned to this.stream, so we can't clobber a newer one).
    if (token !== this._runToken) { stream.getTracks().forEach(t => t.stop()); return; }
    this.stream = stream;

    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = CelloDetector.FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0.35;

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.analyser);
    // NOT connected to destination — analysis only, no feedback.

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.hpsArray = new Float32Array(
      Math.floor(this.analyser.frequencyBinCount / CelloDetector.HPS_HARMONICS)
    );

    // Reset detection / stability state for a clean session.
    this.isDetected          = false;
    this.aboveMs             = 0;
    this.belowMs             = 0;
    this.lastFrameTime       = null;
    this.f0History           = [];
    this.stabilityGate       = false;
    this.stabilityProgressMs = 0;

    await this._requestWakeLock();
    // Stopped during the wake-lock request? Tear down the graph we built and bail.
    if (token !== this._runToken) { this._teardown(); this._releaseWakeLock(); return; }

    document.addEventListener('visibilitychange', this._onVisibility);

    this.running = true;
    this._emitStatus({ kind: 'listening' });
    // First tick fires on the next animation frame, giving the consumer a chance
    // to size its canvases after start() resolves but before any frame renders.
    this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this._runToken++;   // invalidate any start() currently parked on an await
    this._teardown();
    if (this.isDetected) { this.isDetected = false; if (this._detectionCb) this._detectionCb(false); }
    this._releaseWakeLock();
  }

  // Tear down loop + audio graph without touching wake lock or detection state.
  _teardown() {
    this.running = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    document.removeEventListener('visibilitychange', this._onVisibility);

    if (this.stream)   { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.audioCtx) { try { this.audioCtx.close(); } catch {} this.audioCtx = null; }
    this.sourceNode = null;
    this.analyser   = null;
    this.freqData   = null;
    this.hpsArray   = null;

    this.f0History           = [];
    this.stabilityGate       = false;
    this.stabilityProgressMs = 0;
  }

  // Unrecoverable error during a running session: tear down and notify.
  _fail(err) {
    this._runToken++;   // invalidate any in-flight start()
    this._teardown();
    this._releaseWakeLock();
    if (this.isDetected) { this.isDetected = false; if (this._detectionCb) this._detectionCb(false); }
    this._emitStatus({ kind: 'error', error: err });
  }

  // ── Wake lock ─────────────────────────────────────────────────────────────
  async _requestWakeLock() {
    if (!('wakeLock' in navigator)) { this._emitStatus({ kind: 'wakelock', state: 'unavailable' }); return; }
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this._emitStatus({ kind: 'wakelock', state: 'active' });
      this.wakeLock.addEventListener('release', () => {
        if (this.running) this._emitStatus({ kind: 'wakelock', state: 'released' });
      });
    } catch { this._emitStatus({ kind: 'wakelock', state: 'unavailable' }); }
  }

  _releaseWakeLock() {
    if (this.wakeLock) { this.wakeLock.release(); this.wakeLock = null; }
    this._emitStatus({ kind: 'wakelock', state: 'idle' });
  }

  // ── Background recovery ───────────────────────────────────────────────────
  async _onVisibility() {
    if (!this.running || document.visibilityState !== 'visible') return;
    if (this.isRecovering) return;
    await this._recover();
  }

  async _recover() {
    this.isRecovering = true;
    this._emitStatus({ kind: 'reconnecting' });
    try {
      if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
      const track = this.stream?.getAudioTracks()[0];
      if (!track || track.readyState === 'ended') {
        this._emitStatus({ kind: 'reconnecting-mic' });
        await this._restartMicStream();
      }
      await this._requestWakeLock();
      this._emitStatus({ kind: 'listening' });
    } catch (err) {
      this._fail(err);
    } finally {
      this.isRecovering = false;
    }
  }

  async _restartMicStream() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (this.sourceNode) this.sourceNode.disconnect();
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.analyser);
  }

  // ── Analysis loop ─────────────────────────────────────────────────────────
  _tick() {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);

    this.analyser.getByteFrequencyData(this.freqData);
    this._computeHPS();

    const peak = this._findCelloPeak();
    peak.note = this._freqToNote(peak.freq);
    const showPeak = peak.val > this.params.threshold * 0.3;

    const bars = new Float32Array(CelloDetector.NUM_BARS);
    for (let i = 0; i < CelloDetector.NUM_BARS; i++) {
      bars[i] = this._getHPSBarValue(this.barDefs[i]);
    }

    const now = performance.now();
    const dt  = this.lastFrameTime ? Math.min(now - this.lastFrameTime, 100) : 16;
    this.lastFrameTime = now;

    // Stage 1: pitch stability gate
    this._computeStability(peak, dt);

    const hpsPass       = peak.val > this.params.threshold;
    const stabilityPass = !this.params.stabilityEnabled || this.stabilityGate;

    if (hpsPass && stabilityPass) {
      this.belowMs = 0;
      this.aboveMs += dt;
      if (!this.isDetected && this.aboveMs >= this.params.attackMs) this._setDetection(true);
    } else {
      this.aboveMs = 0;
      this.belowMs += dt;
      if (this.isDetected && this.belowMs >= CelloDetector.RELEASE_MS) this._setDetection(false);
    }

    if (this._frameCb) {
      const f0Center = this.f0History.length >= 2
        ? this._medianOf(this.f0History.map(s => s.freq))
        : null;

      this._frameCb({
        timeMs:              now,
        detected:            this.isDetected,
        pitch:               showPeak ? { freq: peak.freq, note: peak.note } : null,
        bars,
        peak,
        showPeak,
        f0History:           this.f0History,
        f0Center,
        stabilityGate:       this.stabilityGate,
        stabilityProgressMs: this.stabilityProgressMs,
        hpsPass,
        stabilityPass,
        threshold:           this.params.threshold,
        toleranceCents:      this.params.toleranceCents,
        durationMs:          this.params.durationMs,
        stabilityEnabled:    this.params.stabilityEnabled,
      });
    }
  }

  _setDetection(on) {
    if (on === this.isDetected) return;
    this.isDetected = on;
    if (this._detectionCb) this._detectionCb(on);
  }

  // ── DSP ───────────────────────────────────────────────────────────────────

  // Harmonic Product Spectrum: geometric mean of HPS_HARMONICS harmonics.
  _computeHPS() {
    const freqData = this.freqData, hpsArray = this.hpsArray;
    const H = CelloDetector.HPS_HARMONICS;
    const len = hpsArray.length;
    for (let i = 0; i < len; i++) {
      let product = freqData[i];
      for (let k = 2; k <= H; k++) product *= freqData[k * i];
      hpsArray[i] = Math.pow(product, 1 / H);
    }
  }

  _getHPSBarValue(bar) {
    const binWidth = this.audioCtx.sampleRate / this.analyser.fftSize;
    const b1 = Math.max(0, Math.round(bar.f1 / binWidth));
    const b2 = Math.round(bar.f2 / binWidth);
    let sum = 0, count = 0;
    for (let b = b1; b <= Math.min(b2, this.hpsArray.length - 1); b++) { sum += this.hpsArray[b]; count++; }
    return count > 0 ? sum / count : 0;
  }

  // Strongest HPS peak within the cello frequency range.
  _findCelloPeak() {
    const binWidth = this.audioCtx.sampleRate / this.analyser.fftSize;
    const lowBin   = Math.max(1, Math.round(CelloDetector.CELLO_LOW / binWidth));
    const highBin  = Math.min(Math.round(CelloDetector.CELLO_HIGH / binWidth), this.hpsArray.length - 1);
    let peakBin = lowBin, peakVal = 0;
    for (let i = lowBin; i <= highBin; i++) {
      if (this.hpsArray[i] > peakVal) { peakVal = this.hpsArray[i]; peakBin = i; }
    }
    const freq   = Math.round(peakBin * binWidth);
    const barIdx = this.barDefs.findIndex(b => freq >= b.f1 && freq < b.f2);
    return { freq, val: peakVal, barIdx };
  }

  // ── Stability gate ────────────────────────────────────────────────────────
  _medianOf(arr) {
    const sorted = arr.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }

  _computeStability(peak, dt) {
    const now = performance.now();

    if (peak.val > 0) this.f0History.push({ timeMs: now, freq: peak.freq });
    const cutoff = now - CelloDetector.STABILITY_WINDOW_MS;
    while (this.f0History.length > 0 && this.f0History[0].timeMs < cutoff) this.f0History.shift();

    if (this.f0History.length < 3) {
      this.stabilityGate = false;
      this.stabilityProgressMs = 0;
      return;
    }

    const center = this._medianOf(this.f0History.map(s => s.freq));
    const cents  = Math.abs(1200 * Math.log2(peak.freq / center));

    if (cents <= this.params.toleranceCents) {
      this.stabilityProgressMs += dt;
      if (this.stabilityProgressMs >= this.params.durationMs) this.stabilityGate = true;
    } else {
      this.stabilityProgressMs = 0;
      this.stabilityGate = false;
    }
  }

  // ── Note name ─────────────────────────────────────────────────────────────
  _freqToNote(freq) {
    const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const midi  = Math.round(69 + 12 * Math.log2(freq / 440));
    return names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }
}
