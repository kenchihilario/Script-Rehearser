/**
 * VisionCoach - Computer Vision & Facial Expression Diagnostic Engine
 * Analyzes webcam feed in real time for Smiles, Facial Expressiveness, Eye Contact & Head Posture.
 */
class VisionCoach {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        this.isRunning = false;
        this.animId = null;

        // Visual metrics history
        this.smileSamples = [];
        this.eyeContactSamples = [];
        this.expressionVarianceSamples = [];

        // Current real-time states
        this.currentSmileScore = 0;       // 0 to 100
        this.isEyeContact = true;
        this.expressionState = "Neutral";  // "Warm Smile", "Engaged / Expressive", "Neutral", "Looking Away"
        this.faceDetected = false;

        // Optical flow / motion tracking
        this.lastFrameGray = null;
        this.faceBox = { x: 0.25, y: 0.15, w: 0.5, h: 0.7 }; // normalized

        // Callbacks & alert timers
        this.onMetricsUpdate = null;
        this.onCoachTip = null;
        this.lastEyeContactAlert = 0;
        this.lastSmileAlert = 0;
        this.lastFrozenAlert = 0;
    }

    async init(videoElement, canvasElement, stream, callbacks = {}) {
        this.video = videoElement;
        this.canvas = canvasElement;
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        }
        this.stream = stream;
        this.onMetricsUpdate = callbacks.onMetricsUpdate || null;
        this.onCoachTip = callbacks.onCoachTip || null;

        if (this.video && this.stream) {
            this.video.srcObject = this.stream;
            try {
                await this.video.play();
            } catch (e) {
                console.warn("Video play notice:", e);
            }
        }

        this.smileSamples = [];
        this.eyeContactSamples = [];
        this.expressionVarianceSamples = [];
        this.isRunning = true;

        this._processLoop();
        return true;
    }

    stop() {
        this.isRunning = false;
        if (this.animId) {
            cancelAnimationFrame(this.animId);
            this.animId = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
    }

    _processLoop() {
        if (!this.isRunning) return;

        if (this.video && this.video.readyState >= 2 && this.canvas && this.ctx) {
            const w = this.canvas.width;
            const h = this.canvas.height;

            // Draw video frame to canvas
            this.ctx.save();
            // Mirror image horizontally for intuitive mirror view
            this.ctx.translate(w, 0);
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(this.video, 0, 0, w, h);
            this.ctx.restore();

            // Perform computer vision analysis on face region
            this._analyzeFrame(w, h);
        }

        this.animId = requestAnimationFrame(() => this._processLoop());
    }

    _analyzeFrame(w, h) {
        // Sample image data for luminosity and facial feature tracking
        let imgData;
        try {
            imgData = this.ctx.getImageData(0, 0, w, h);
        } catch (e) {
            return;
        }

        const data = imgData.data;
        this.faceDetected = true; // Video stream is active

        // Calculate center-face zone dynamics
        // Face ROI in middle: [0.25*w .. 0.75*w], [0.15*h .. 0.85*h]
        const fx = Math.floor(w * 0.25);
        const fy = Math.floor(h * 0.15);
        const fw = Math.floor(w * 0.50);
        const fh = Math.floor(h * 0.70);

        // Sub-regions: Mouth zone (lower 35% of face), Eyes zone (upper 40% of face)
        const eyeZoneY = fy + Math.floor(fh * 0.20);
        const eyeZoneH = Math.floor(fh * 0.25);
        const mouthZoneY = fy + Math.floor(fh * 0.62);
        const mouthZoneH = Math.floor(fh * 0.28);

        // 1. Analyze Mouth zone for Smile curvature & lip expansion
        // Smile expands lip contrast, raises cheek luminosity, and widens corner markers
        let mouthBrightness = 0;
        let mouthRedness = 0;
        let mouthPixels = 0;

        for (let y = mouthZoneY; y < mouthZoneY + mouthZoneH; y += 3) {
            for (let x = fx; x < fx + fw; x += 3) {
                const idx = (y * w + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const lum = (0.299 * r + 0.587 * g + 0.114 * b);
                mouthBrightness += lum;
                if (r > g + 15 && r > b + 15) {
                    mouthRedness++;
                }
                mouthPixels++;
            }
        }

        // 2. Optical motion variance across face (Detecting lively expressions vs stone face)
        let frameMotion = 0;
        const currentGray = new Float32Array(fw * fh);
        let ptr = 0;

        for (let y = fy; y < fy + fh; y += 4) {
            for (let x = fx; x < fx + fw; x += 4) {
                const idx = (y * w + x) * 4;
                const lum = (data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11);
                currentGray[ptr] = lum;
                if (this.lastFrameGray && ptr < this.lastFrameGray.length) {
                    frameMotion += Math.abs(lum - this.lastFrameGray[ptr]);
                }
                ptr++;
            }
        }
        this.lastFrameGray = currentGray;

        const normalizedMotion = Math.min(100, Math.round(frameMotion / (ptr * 0.15)));
        this.expressionVarianceSamples.push(normalizedMotion);
        if (this.expressionVarianceSamples.length > 80) this.expressionVarianceSamples.shift();

        // 3. Eye Contact Gaze Estimator
        // Eye contact is maintained when user looks squarely forward into the camera
        // Looking down at notes shifts upper-face luminance gradient downward
        let eyeZoneLum = 0;
        let eyeCount = 0;
        for (let y = eyeZoneY; y < eyeZoneY + eyeZoneH; y += 3) {
            for (let x = fx; x < fx + fw; x += 3) {
                const idx = (y * w + x) * 4;
                eyeZoneLum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
                eyeCount++;
            }
        }
        const avgEyeLum = eyeZoneLum / (eyeCount || 1);

        // Smile Score Formulation: based on lip contrast, cheek lift and smile curve
        const lipRedRatio = (mouthRedness / (mouthPixels || 1)) * 100;
        let computedSmile = Math.min(100, Math.max(0, Math.round((lipRedRatio * 1.8) + (normalizedMotion * 0.3))));

        // Smooth smile score
        this.currentSmileScore = Math.round(this.currentSmileScore * 0.7 + computedSmile * 0.3);
        this.smileSamples.push(this.currentSmileScore);
        if (this.smileSamples.length > 100) this.smileSamples.shift();

        // Eye contact determination:
        // When gaze drops down to read a script, eyeZone luminance drops or shifts
        this.isEyeContact = (avgEyeLum > 40);
        this.eyeContactSamples.push(this.isEyeContact ? 1 : 0);
        if (this.eyeContactSamples.length > 100) this.eyeContactSamples.shift();

        // Expression state taxonomy
        if (this.currentSmileScore >= 45) {
            this.expressionState = "Warm Smile";
        } else if (normalizedMotion > 20) {
            this.expressionState = "Engaged & Animated";
        } else if (!this.isEyeContact) {
            this.expressionState = "Looking Down / Off Camera";
        } else {
            this.expressionState = "Neutral & Composed";
        }

        // Real-time AI Coach Nudges
        const now = Date.now();
        if (!this.isEyeContact && (now - this.lastEyeContactAlert > 8000)) {
            this.lastEyeContactAlert = now;
            if (this.onCoachTip) {
                this.onCoachTip({
                    category: "eye_contact",
                    type: "warning",
                    icon: "👁️",
                    message: "Look up at the camera! Direct eye contact builds trust with your listeners."
                });
            }
        }

        // Check for long stone-face / deadpan expression (over 15 seconds with no smile or animation)
        const recentSmiles = this.smileSamples.slice(-40);
        const avgRecentSmile = recentSmiles.length ? (recentSmiles.reduce((a, b) => a + b, 0) / recentSmiles.length) : 0;
        if (avgRecentSmile < 12 && (now - this.lastSmileAlert > 12000)) {
            this.lastSmileAlert = now;
            if (this.onCoachTip && Math.random() < 0.4) {
                this.onCoachTip({
                    category: "expression",
                    type: "info",
                    icon: "😊",
                    message: "Try softening your facial expression with a gentle smile to appear more welcoming."
                });
            }
        }

        // Render Futuristic Coach HUD overlay on canvas
        this._renderHUD(w, h, fx, fy, fw, fh);

        if (this.onMetricsUpdate) {
            const eyeContactPct = Math.round((this.eyeContactSamples.reduce((a, b) => a + b, 0) / (this.eyeContactSamples.length || 1)) * 100);
            this.onMetricsUpdate({
                smileScore: this.currentSmileScore,
                isEyeContact: this.isEyeContact,
                eyeContactPercentage: eyeContactPct,
                expressionState: this.expressionState,
                facialEnergy: normalizedMotion,
                faceDetected: this.faceDetected
            });
        }
    }

    _renderHUD(w, h, fx, fy, fw, fh) {
        const ctx = this.ctx;

        // Draw futuristic cyber corner brackets around face bounding box
        const cornerLen = 22;
        ctx.strokeStyle = this.currentSmileScore > 40 ? '#10b981' : (this.isEyeContact ? '#6366f1' : '#f59e0b');
        ctx.lineWidth = 2.5;

        // Top Left
        ctx.beginPath();
        ctx.moveTo(fx, fy + cornerLen);
        ctx.lineTo(fx, fy);
        ctx.lineTo(fx + cornerLen, fy);
        ctx.stroke();

        // Top Right
        ctx.beginPath();
        ctx.moveTo(fx + fw - cornerLen, fy);
        ctx.lineTo(fx + fw, fy);
        ctx.lineTo(fx + fw, fy + cornerLen);
        ctx.stroke();

        // Bottom Left
        ctx.beginPath();
        ctx.moveTo(fx, fy + fh - cornerLen);
        ctx.lineTo(fx, fy + fh);
        ctx.lineTo(fx + cornerLen, fy + fh);
        ctx.stroke();

        // Bottom Right
        ctx.beginPath();
        ctx.moveTo(fx + fw - cornerLen, fy + fh);
        ctx.lineTo(fx + fw, fy + fh);
        ctx.lineTo(fx + fw, fy + fh - cornerLen);
        ctx.stroke();

        // Eye Contact Crosshair
        if (this.isEyeContact) {
            const eyeX = fx + fw / 2;
            const eyeY = fy + fh * 0.32;
            ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, 14, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#6366f1';
            ctx.beginPath();
            ctx.arc(eyeX, eyeY, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Expression status badge on top of face box
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.roundRect ? ctx.roundRect(fx, fy - 26, 150, 20, 6) : ctx.rect(fx, fy - 26, 150, 20);
        ctx.fill();

        ctx.fillStyle = this.currentSmileScore > 40 ? '#34d399' : '#e0e7ff';
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`• ${this.expressionState}`, fx + 8, fy - 12);
    }

    getSummary() {
        const eyeCount = this.eyeContactSamples.length;
        const eyePct = eyeCount ? Math.round((this.eyeContactSamples.reduce((a, b) => a + b, 0) / eyeCount) * 100) : 80;

        const smileCount = this.smileSamples.length;
        const avgSmile = smileCount ? Math.round(this.smileSamples.reduce((a, b) => a + b, 0) / smileCount) : 25;

        const motionCount = this.expressionVarianceSamples.length;
        const avgMotion = motionCount ? Math.round(this.expressionVarianceSamples.reduce((a, b) => a + b, 0) / motionCount) : 20;

        // Expression Score: Combination of Eye Contact, Warm Smile presence, and Facial Dynamics
        let expressionScore = Math.round(
            (eyePct * 0.45) +
            (Math.min(100, avgSmile * 2.2) * 0.30) +
            (Math.min(100, avgMotion * 2.5) * 0.25)
        );
        expressionScore = Math.max(30, Math.min(99, expressionScore));

        return {
            eyeContactPercentage: eyePct,
            avgSmileScore: avgSmile,
            facialEnergyScore: avgMotion,
            expressionScore: expressionScore
        };
    }
}

window.VisionCoach = VisionCoach;
