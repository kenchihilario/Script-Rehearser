
class VisionCoach {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        this.landmarker = null;
        this.isRunning = false;
        this.animId = null;
        this.lastInferenceAt = 0;
        this.lastFaceCenter = null;
        this.smileSamples = [];
        this.eyeContactSamples = [];
        this.expressionVarianceSamples = [];
        this.currentSmileScore = 0;
        this.isEyeContact = null;
        this.gazeStatus = "Loading eye tracking…";
        this.expressionState = "Waiting for camera";
        this.faceDetected = false;
        this.onMetricsUpdate = null;
        this.onCoachTip = null;
        this.lastEyeContactAlert = 0;
    }

    async init(videoElement, canvasElement, stream, callbacks = {}) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = this.canvas?.getContext("2d");
        this.stream = stream;
        this.onMetricsUpdate = callbacks.onMetricsUpdate || null;
        this.onCoachTip = callbacks.onCoachTip || null;
        this.smileSamples = [];
        this.eyeContactSamples = [];
        this.expressionVarianceSamples = [];
        this.lastFaceCenter = null;
        this.isRunning = true;

        if (this.video && this.stream) {
            this.video.srcObject = this.stream;
            try { await this.video.play(); } catch (error) { console.warn("Video play notice:", error); }
        }

        this._publishMetrics();
        this._processLoop();
        this._loadLandmarker().catch((error) => {
            console.warn("Local face tracking could not start:", error);
            this.gazeStatus = "Gaze estimate unavailable";
            this.expressionState = "Face tracking unavailable";
            this._publishMetrics();
        });
        return true;
    }

    async _loadLandmarker() {
        const { FaceLandmarker, FilesetResolver } = await import(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.mjs"
        );
        const fileset = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm"
        );
        this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                delegate: "CPU"
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true
        });
    }

    stop() {
        this.isRunning = false;
        if (this.animId) cancelAnimationFrame(this.animId);
        this.animId = null;
        this.landmarker?.close();
        this.landmarker = null;
        if (this.video) this.video.srcObject = null;
    }

    _processLoop() {
        if (!this.isRunning) return;
        const w = this.canvas?.width || 0;
        const h = this.canvas?.height || 0;
        if (this.video?.readyState >= 2 && this.canvas && this.ctx && w && h) {
            this.ctx.save();
            this.ctx.translate(w, 0);
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(this.video, 0, 0, w, h);
            this.ctx.restore();

            const now = performance.now();
            if (this.landmarker && now - this.lastInferenceAt >= 220) {
                this.lastInferenceAt = now;
                try {
                    const result = this.landmarker.detectForVideo(this.video, now);
                    this._readLandmarks(result, w, h);
                } catch (error) {
                    console.warn("Eye tracking frame skipped:", error);
                }
            } else if (!this.landmarker) {
                this.ctx.clearRect(0, 0, w, h);
            }
        }
        this.animId = requestAnimationFrame(() => this._processLoop());
    }

    _readLandmarks(result, width, height) {
        const landmarks = result.faceLandmarks?.[0];
        if (!landmarks || landmarks.length < 478) {
            this.faceDetected = false;
            this.isEyeContact = null;
            this.gazeStatus = "Face not detected";
            this.expressionState = "Move into the camera view";
            this.lastFaceCenter = null;
            this._publishMetrics();
            this._renderFrameStatus(width, height);
            return;
        }

        this.faceDetected = true;
        const gaze = this._estimateGaze(landmarks);
        this.isEyeContact = gaze;
        this.gazeStatus = gaze === null
            ? "Gaze estimate unavailable"
            : gaze ? "Direct Eye Contact" : "Looking Away";
        if (gaze !== null) {
            this.eyeContactSamples.push(gaze ? 1 : 0);
            if (this.eyeContactSamples.length > 180) this.eyeContactSamples.shift();
        }

        const faceBox = this._getFaceBox(landmarks);
        const faceCenter = { x: faceBox.x + faceBox.w / 2, y: faceBox.y + faceBox.h / 2 };
        const movement = this.lastFaceCenter
            ? Math.hypot(faceCenter.x - this.lastFaceCenter.x, faceCenter.y - this.lastFaceCenter.y)
            : 0;
        this.lastFaceCenter = faceCenter;
        const normalizedMotion = Math.min(100, Math.round(movement * 1800));
        this.expressionVarianceSamples.push(normalizedMotion);
        if (this.expressionVarianceSamples.length > 80) this.expressionVarianceSamples.shift();

        const blendshapes = result.faceBlendshapes?.[0]?.categories || [];
        const smileLeft = blendshapes.find((item) => item.categoryName === "mouthSmileLeft")?.score || 0;
        const smileRight = blendshapes.find((item) => item.categoryName === "mouthSmileRight")?.score || 0;
        const smile = Math.round(((smileLeft + smileRight) / 2) * 100);
        this.currentSmileScore = Math.round(this.currentSmileScore * 0.65 + smile * 0.35);
        this.smileSamples.push(this.currentSmileScore);
        if (this.smileSamples.length > 120) this.smileSamples.shift();

        if (this.currentSmileScore >= 45) this.expressionState = "Warm Smile";
        else if (gaze === false) this.expressionState = "Looking Away";
        else if (normalizedMotion > 8) this.expressionState = "Engaged & Animated";
        else if (gaze === null) this.expressionState = "Gaze not clear";
        else this.expressionState = "Neutral & Composed";

        this._renderFaceBox(faceBox, width, height);
        this._publishMetrics(normalizedMotion);

        const now = Date.now();
        if (gaze === false && now - this.lastEyeContactAlert > 8000) {
            this.lastEyeContactAlert = now;
            this.onCoachTip?.({
                category: "eye_contact",
                type: "warning",
                icon: "eye",
                message: "Your eyes seem to be looking away from the camera."
            });
        }
    }

    _estimateGaze(landmarks) {
        const eyeRatios = [
            { corners: [33, 133], iris: 468, top: 159, bottom: 145 },
            { corners: [362, 263], iris: 473, top: 386, bottom: 374 }
        ];
        const readings = [];
        for (const eye of eyeRatios) {
            const a = landmarks[eye.corners[0]];
            const b = landmarks[eye.corners[1]];
            const iris = landmarks[eye.iris];
            const top = landmarks[eye.top];
            const bottom = landmarks[eye.bottom];
            const eyeWidth = Math.abs(b.x - a.x);
            const eyeHeight = Math.abs(bottom.y - top.y);
            if (eyeWidth < 0.008 || eyeHeight < 0.002) continue;
            const horizontal = (iris.x - Math.min(a.x, b.x)) / eyeWidth;
            const vertical = (iris.y - Math.min(top.y, bottom.y)) / eyeHeight;
            readings.push({ horizontal, vertical });
        }
        if (readings.length !== 2) return null;

        const horizontal = readings.reduce((sum, reading) => sum + reading.horizontal, 0) / readings.length;
        const vertical = readings.reduce((sum, reading) => sum + reading.vertical, 0) / readings.length;
        const centered = horizontal >= 0.32 && horizontal <= 0.68 && vertical >= 0.14 && vertical <= 0.86;
        const clearlyAverted = horizontal < 0.20 || horizontal > 0.80 || vertical < 0.04 || vertical > 0.96;
        return centered ? true : clearlyAverted ? false : null;
    }

    _getFaceBox(landmarks) {
        const xs = landmarks.map((point) => point.x);
        const ys = landmarks.map((point) => point.y);
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const top = Math.min(...ys);
        const bottom = Math.max(...ys);
        return { x: left, y: top, w: right - left, h: bottom - top };
    }

    _renderFaceBox(box, width, height) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, width, height);
        const x = (1 - box.x - box.w) * width;
        const y = box.y * height;
        const w = box.w * width;
        const h = box.h * height;
        ctx.strokeStyle = this.isEyeContact === false ? "#d97706" : "#3b82f6";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
    }

    _renderFrameStatus(width, height) {
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
        this.ctx.fillRect(0, 0, width, 28);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.font = '600 12px system-ui, sans-serif';
        this.ctx.fillText(this.gazeStatus, 10, 19);
    }

    _publishMetrics(facialEnergy = 0) {
        if (!this.onMetricsUpdate) return;
        const validEyeSamples = this.eyeContactSamples;
        const eyePct = validEyeSamples.length
            ? Math.round(validEyeSamples.reduce((sum, value) => sum + value, 0) / validEyeSamples.length * 100)
            : null;
        this.onMetricsUpdate({
            smileScore: this.currentSmileScore,
            isEyeContact: this.isEyeContact,
            eyeContactPercentage: eyePct,
            gazeStatus: this.gazeStatus,
            expressionState: this.expressionState,
            facialEnergy,
            faceDetected: this.faceDetected
        });
    }

    getSummary() {
        const avgSmile = this.smileSamples.length
            ? Math.round(this.smileSamples.reduce((sum, value) => sum + value, 0) / this.smileSamples.length)
            : 25;
        const avgMotion = this.expressionVarianceSamples.length
            ? Math.round(this.expressionVarianceSamples.reduce((sum, value) => sum + value, 0) / this.expressionVarianceSamples.length)
            : 20;
        const eyeContactAvailable = this.eyeContactSamples.length > 0;
        const eyePct = eyeContactAvailable
            ? Math.round(this.eyeContactSamples.reduce((sum, value) => sum + value, 0) / this.eyeContactSamples.length * 100)
            : null;
        const expressionScore = Math.max(30, Math.min(99, Math.round(
            (eyePct ?? 75) * 0.45 + Math.min(100, avgSmile * 2.2) * 0.30 + Math.min(100, avgMotion * 2.5) * 0.25
        )));
        return {
            eyeContactPercentage: eyePct,
            eyeContactAvailable,
            avgSmileScore: avgSmile,
            facialEnergyScore: avgMotion,
            expressionScore
        };
    }
}

window.VisionCoach = VisionCoach;
