/**
 * AudioCoach - Real-Time Vocal Pitch, Tone Inflection & Dynamics Analyzer
 * Uses Web Audio API with time-domain autocorrelation for fundamental frequency (F0) tracking.
 */
class AudioCoach {
    constructor() {
        this.audioCtx = null;
        this.analyser = null;
        this.micSource = null;
        this.mediaStream = null;
        this.isRunning = false;
        this.animFrameId = null;

        // Analysis state
        this.pitchHistory = [];
        this.volumeHistory = [];
        this.recentPitches = []; // last 50 pitch detections for short-term inflection
        this.monotoneThresholdHz = 16; // std-dev under 16 Hz = monotone
        this.expressiveThresholdHz = 28; // std-dev > 28 Hz = expressive
        this.canvas = null;
        this.canvasCtx = null;

        this.onMetricsUpdate = null;
        this.onCoachTip = null;
        this.lastMonotoneAlert = 0;
    }

    async init(stream, canvasElement, callbacks = {}) {
        this.mediaStream = stream;
        this.canvas = canvasElement;
        if (this.canvas) {
            this.canvasCtx = this.canvas.getContext('2d');
        }
        this.onMetricsUpdate = callbacks.onMetricsUpdate || null;
        this.onCoachTip = callbacks.onCoachTip || null;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContextClass();
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;

        this.micSource = this.audioCtx.createMediaStreamSource(this.mediaStream);
        this.micSource.connect(this.analyser);

        this.pitchHistory = [];
        this.volumeHistory = [];
        this.recentPitches = [];
        this.isRunning = true;

        this._analyzeLoop();
        return true;
    }

    stop() {
        this.isRunning = false;
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.micSource) {
            try { this.micSource.disconnect(); } catch (e) {}
            this.micSource = null;
        }
        if (this.audioCtx && this.audioCtx.state !== 'closed') {
            try { this.audioCtx.close(); } catch (e) {}
            this.audioCtx = null;
        }
    }

    // Autocorrelation algorithm for pitch detection (fundamental frequency F0)
    _autoCorrelate(buf, sampleRate) {
        let SIZE = buf.length;
        let rms = 0;

        for (let i = 0; i < SIZE; i++) {
            let val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.015) { // silence or noise floor
            return { pitch: -1, rms: rms };
        }

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
        }

        buf = buf.slice(r1, r2);
        SIZE = buf.length;

        let c = new Float32Array(SIZE);
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE - i; j++) {
                c[i] = c[i] + buf[j] * buf[j + i];
            }
        }

        let d = 0;
        while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < SIZE; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }
        let T0 = maxpos;

        // Parabolic interpolation for fine frequency resolution
        let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        let a = (x1 + x3 - 2 * x2) / 2;
        let b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        let pitch = sampleRate / T0;
        // Human voice fundamental pitch range is roughly 65 Hz to 420 Hz
        if (pitch >= 65 && pitch <= 420) {
            return { pitch: Math.round(pitch), rms: rms };
        }
        return { pitch: -1, rms: rms };
    }

    _calculateStdDev(arr) {
        if (arr.length < 2) return 0;
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
        return Math.sqrt(variance);
    }

    _analyzeLoop() {
        if (!this.isRunning || !this.analyser) return;

        const buffer = new Float32Array(this.analyser.fftSize);
        this.analyser.getFloatTimeDomainData(buffer);

        const { pitch, rms } = this._autoCorrelate(buffer, this.audioCtx.sampleRate);
        const volumeDb = Math.max(-60, Math.round(20 * Math.log10(rms + 1e-6)));

        if (pitch > 0) {
            this.pitchHistory.push(pitch);
            this.recentPitches.push(pitch);
            if (this.recentPitches.length > 60) {
                this.recentPitches.shift();
            }
        }
        this.volumeHistory.push(volumeDb);

        // Evaluate Tone Inflection
        let pitchStdDev = 0;
        let toneStatus = "Normal";
        let toneScore = 80;

        if (this.recentPitches.length >= 15) {
            pitchStdDev = Math.round(this._calculateStdDev(this.recentPitches));
            if (pitchStdDev < this.monotoneThresholdHz) {
                toneStatus = "Monotone (Flat Pitch)";
                toneScore = Math.max(30, 70 - (this.monotoneThresholdHz - pitchStdDev) * 3);

                const now = Date.now();
                if (now - this.lastMonotoneAlert > 8000) {
                    this.lastMonotoneAlert = now;
                    if (this.onCoachTip) {
                        this.onCoachTip({
                            category: "tone",
                            type: "warning",
                            icon: "📢",
                            message: "Tone is sounding flat. Add vocal melody and pitch inflection for emphasis!"
                        });
                    }
                }
            } else if (pitchStdDev >= this.expressiveThresholdHz) {
                toneStatus = "Expressive & Engaging";
                toneScore = Math.min(100, 85 + Math.round((pitchStdDev - this.expressiveThresholdHz) * 0.8));
            } else {
                toneStatus = "Balanced Modulation";
                toneScore = 85;
            }
        }

        // Volume check
        let volumeStatus = "Good Projection";
        if (volumeDb < -42 && rms > 0.005) {
            volumeStatus = "Low Volume (Speak louder)";
        } else if (volumeDb > -6) {
            volumeStatus = "High Volume (Slightly loud)";
        }

        if (this.onMetricsUpdate) {
            this.onMetricsUpdate({
                currentPitch: pitch > 0 ? pitch : null,
                volumeDb: volumeDb,
                pitchStdDev: pitchStdDev,
                toneStatus: toneStatus,
                toneScore: toneScore,
                volumeStatus: volumeStatus
            });
        }

        this._renderVisualizer(buffer, pitch);

        this.animFrameId = requestAnimationFrame(() => this._analyzeLoop());
    }

    _renderVisualizer(timeData, currentPitch) {
        if (!this.canvasCtx || !this.canvas) return;
        const ctx = this.canvasCtx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);

        // Draw neon oscilloscope waveform
        ctx.lineWidth = 2.5;
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#06b6d4');
        gradient.addColorStop(0.5, currentPitch > 0 ? '#8b5cf6' : '#3b82f6');
        gradient.addColorStop(1, '#ec4899');
        ctx.strokeStyle = gradient;

        ctx.beginPath();
        const sliceWidth = width / timeData.length;
        let x = 0;

        for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i];
            const y = (v * height * 0.85) + (height / 2);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        ctx.stroke();

        // If pitch detected, render glowing target frequency readout
        if (currentPitch > 0) {
            ctx.fillStyle = '#a78bfa';
            ctx.font = '600 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${currentPitch} Hz`, width - 8, 14);
        }
    }

    getSummary() {
        const validPitches = this.pitchHistory;
        const avgPitch = validPitches.length ? Math.round(validPitches.reduce((a, b) => a + b, 0) / validPitches.length) : 0;
        const overallStdDev = Math.round(this._calculateStdDev(validPitches));

        let toneScore = 75;
        let isMonotone = false;
        if (validPitches.length >= 20) {
            if (overallStdDev < this.monotoneThresholdHz) {
                isMonotone = true;
                toneScore = Math.max(35, 65 - (this.monotoneThresholdHz - overallStdDev) * 3);
            } else {
                toneScore = Math.min(98, 70 + overallStdDev);
            }
        }

        return {
            avgPitchHz: avgPitch,
            pitchVariabilityHz: overallStdDev,
            pitchMonotone: isMonotone,
            toneScore: Math.round(toneScore),
            samplesAnalyzed: validPitches.length
        };
    }
}

window.AudioCoach = AudioCoach;
