
class SpeechCoach {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.startTime = null;
        this.activeElapsedMs = 0;
        this.activeSegmentStartedAt = 0;
        this.acceptFinalResults = false;
        this.pendingStopResolve = null;
        this.fullTranscript = "";
        this.spokenWords = [];
        this.wordTimestamps = [];
        this.fillerCounts = {};
        this.totalFillers = 0;
        this.stutterEvents = [];
        this.totalStutters = 0;
        this.lastSpokenWord = "";
        this.lastWordTime = 0;
        this.scriptTokens = [];
        this.scriptWordMap = new Map();
        this.matchedScriptIndices = new Set();
        this.targetWpm = 140;
        this.currentWpm = 0;
        this.rollingWordWindow = [];
        this.lastPacingAlertTime = 0;
        this.lastFillerAlertTime = 0;
        this.lastStutterAlertTime = 0;
        this.onSpeechResult = null;
        this.onCoachTip = null;
        this.onWordMatched = null;

        this.fillerPatterns = [
            "um", "uh", "er", "ah", "like", "you know", "basically",
            "actually", "literally", "sort of", "kind of", "i mean"
        ];
    }

    init(targetScriptText = "", targetWpm = 140, callbacks = {}) {
        this.targetWpm = targetWpm || 140;
        this.onSpeechResult = callbacks.onSpeechResult || null;
        this.onCoachTip = callbacks.onCoachTip || null;
        this.onWordMatched = callbacks.onWordMatched || null;

        if (targetScriptText) {
            this.setScript(targetScriptText);
        }

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            console.warn("SpeechRecognition API not available in this browser. Enabling simulated fallback mode.");
            return false;
        }

        this.recognition = new SpeechRec();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";
        this.recognition.maxAlternatives = 1;

        this.recognition.onresult = (event) => this._handleSpeechResult(event);
        this.recognition.onerror = (event) => {
            console.warn("Speech recognition notice:", event.error);
        };
        this.recognition.onend = () => {
            if (this.isListening) {
                try {
                    this.recognition.start();
                } catch (e) {}
            } else if (this.acceptFinalResults && this.pendingStopResolve) {
                this.pendingStopResolve();
            }
        };

        return true;
    }

    setScript(text) {
        this.scriptTokens = text
            .toLowerCase()
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter(Boolean);

        this.matchedScriptIndices.clear();
    }

    start(resumeSession = false) {
        const now = Date.now();
        this.acceptFinalResults = false;
        if (resumeSession) {
            if (this.isListening) return;
            this.startTime = now - this.activeElapsedMs;
        } else {
            this.activeElapsedMs = 0;
            this.startTime = now;
            this.fullTranscript = "";
            this.spokenWords = [];
            this.wordTimestamps = [];
            this.fillerCounts = {};
            this.totalFillers = 0;
            this.stutterEvents = [];
            this.totalStutters = 0;
            this.rollingWordWindow = [];
            this.lastSpokenWord = "";
            this.lastWordTime = now;
        }

        this.isListening = true;
        this.activeSegmentStartedAt = now;

        if (this.recognition) {
            try {
                this.recognition.start();
            } catch (e) {
                console.warn("Recognition start notice:", e);
            }
        }
    }

    stop() {
        if (this.isListening) {
            this.activeElapsedMs += Date.now() - this.activeSegmentStartedAt;
        }
        this.isListening = false;
        if (!this.recognition) return Promise.resolve();
        this.acceptFinalResults = true;
        return new Promise((resolve) => {
            let timeoutId;
            const finish = () => {
                clearTimeout(timeoutId);
                this.acceptFinalResults = false;
                this.pendingStopResolve = null;
                resolve();
            };
            this.pendingStopResolve = finish;
            timeoutId = setTimeout(finish, 700);
            try {
                this.recognition.stop();
            } catch (e) {
                finish();
            }
        });
    }

    async pause() {
        await this.stop();
        if (this.startTime) this.startTime = Date.now() - this.activeElapsedMs;
    }

    clearTranscript() {
        this.fullTranscript = "";
        this.spokenWords = [];
        this.wordTimestamps = [];
        this.fillerCounts = {};
        this.totalFillers = 0;
        this.stutterEvents = [];
        this.totalStutters = 0;
        this.rollingWordWindow = [];
        this.lastSpokenWord = "";
    }

    _handleSpeechResult(event) {
        if (!this.isListening && !this.acceptFinalResults) return;

        let interim = "";
        let finalChunk = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalChunk += transcript + " ";
            } else {
                interim += transcript;
            }
        }

        if (finalChunk.trim()) {
            this._processWords(finalChunk.trim());
        }

        if (this.onSpeechResult && (this.isListening || finalChunk.trim())) {
            this.onSpeechResult({
                fullTranscript: this.fullTranscript,
                interimText: interim,
                currentWpm: this.currentWpm,
                totalFillers: this.totalFillers,
                totalStutters: this.totalStutters
            });
        }
    }

    _processWords(textChunk) {
        const now = Date.now();
        this.fullTranscript = (this.fullTranscript + " " + textChunk).trim();
        const words = textChunk.split(/\s+/).filter(Boolean);

        for (let i = 0; i < words.length; i++) {
            const rawWord = words[i];
            const cleanWord = rawWord.toLowerCase().replace(/[^\w]/g, "");
            if (!cleanWord) continue;

            const wordObj = {
                word: cleanWord,
                raw: rawWord,
                time: (now - this.startTime) / 1000
            };
            this.spokenWords.push(wordObj);
            this.rollingWordWindow.push({ word: cleanWord, timestamp: now });
            this._checkStutter(cleanWord, rawWord, now);
            this._checkFiller(cleanWord, rawWord, now);
            this._alignWithScript(cleanWord);

            this.lastSpokenWord = cleanWord;
            this.lastWordTime = now;
        }
        this._updatePacing(now);
    }

    _checkStutter(cleanWord, rawWord, now) {
        const isRepeated = (this.lastSpokenWord && cleanWord === this.lastSpokenWord);
        const isHyphenStutter = rawWord.includes("-") && rawWord.length > 2;

        if (isRepeated || isHyphenStutter) {
            this.totalStutters++;
            const stutterInfo = {
                word: cleanWord,
                type: isRepeated ? "Immediate Repetition" : "Syllable Hesitation",
                timeSec: Math.round((now - this.startTime) / 1000)
            };
            this.stutterEvents.push(stutterInfo);

            if (now - this.lastStutterAlertTime > 5000) {
                this.lastStutterAlertTime = now;
                if (this.onCoachTip) {
                    this.onCoachTip({
                        category: "stutter",
                        type: "warning",
                        icon: "repeat",
                        message: `Stutter detected on "${cleanWord}". Take a relaxed breath and restart the phrase smoothly.`
                    });
                }
            }
        }
    }

    _checkFiller(cleanWord, rawWord, now) {
        if (this.fillerPatterns.includes(cleanWord)) {
            this.totalFillers++;
            this.fillerCounts[cleanWord] = (this.fillerCounts[cleanWord] || 0) + 1;

            if (now - this.lastFillerAlertTime > 6000) {
                this.lastFillerAlertTime = now;
                if (this.onCoachTip) {
                    this.onCoachTip({
                        category: "filler",
                        type: "warning",
                        icon: "alert",
                        message: `Filler word noticed: "${cleanWord}". Try replacing it with a brief pause.`
                    });
                }
            }
        }
    }

    _alignWithScript(cleanWord) {
        if (!this.scriptTokens.length) return;
        const searchRange = 8;
        let bestIndex = -1;
        const lastMatched = this.matchedScriptIndices.size ? Math.max(...this.matchedScriptIndices) : 0;

        for (let i = lastMatched; i < Math.min(this.scriptTokens.length, lastMatched + searchRange); i++) {
            if (this.scriptTokens[i] === cleanWord && !this.matchedScriptIndices.has(i)) {
                bestIndex = i;
                break;
            }
        }

        if (bestIndex !== -1) {
            this.matchedScriptIndices.add(bestIndex);
            if (this.onWordMatched) {
                this.onWordMatched({
                    index: bestIndex,
                    word: cleanWord,
                    progressPercent: Math.round((this.matchedScriptIndices.size / this.scriptTokens.length) * 100)
                });
            }
        }
    }

    _updatePacing(now) {
        const cutoff = now - 20000;
        this.rollingWordWindow = this.rollingWordWindow.filter(w => w.timestamp >= cutoff);

        const elapsedSec = (now - this.startTime) / 1000;
        if (elapsedSec < 3) return;
        const rollingSec = Math.min(20, elapsedSec);
        const rollingWpm = Math.round((this.rollingWordWindow.length / (rollingSec / 60)));
        this.currentWpm = rollingWpm;
        if (now - this.lastPacingAlertTime > 10000 && elapsedSec > 8) {
            this.lastPacingAlertTime = now;
            if (this.currentWpm < 115) {
                if (this.onCoachTip) {
                    this.onCoachTip({
                        category: "pace",
                        type: "warning",
                        icon: "gauge",
                        message: `Pacing is a bit slow (${this.currentWpm} WPM). Aim for 130–160 WPM to keep listeners engaged.`
                    });
                }
            } else if (this.currentWpm > 175) {
                if (this.onCoachTip) {
                    this.onCoachTip({
                        category: "pace",
                        type: "warning",
                        icon: "activity",
                        message: `Speaking very fast (${this.currentWpm} WPM). Slow down and enunciate key takeaways.`
                    });
                }
            } else if (this.currentWpm >= 130 && this.currentWpm <= 160) {
                if (this.onCoachTip && Math.random() < 0.3) {
                    this.onCoachTip({
                        category: "pace",
                        type: "success",
                        icon: "target",
                        message: `Terrific cadence (${this.currentWpm} WPM)! Your pacing sounds natural and confident.`
                    });
                }
            }
        }
    }

    getSummary() {
        const totalDurationSec = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
        const totalDurationMin = Math.max(0.1, totalDurationSec / 60);
        const overallWpm = Math.round(this.spokenWords.length / totalDurationMin);
        let pacingScore = 100;
        const diffFromTarget = Math.abs(overallWpm - this.targetWpm);
        if (diffFromTarget > 10) {
            pacingScore = Math.max(30, Math.round(100 - (diffFromTarget - 10) * 1.8));
        }
        const stuttersPerMin = this.totalStutters / totalDurationMin;
        const fillersPerMin = this.totalFillers / totalDurationMin;
        let fluencyScore = Math.round(100 - (stuttersPerMin * 12 + fillersPerMin * 6));
        fluencyScore = Math.max(25, Math.min(100, fluencyScore));
        let scriptAccuracy = 0;
        if (this.scriptTokens.length > 0) {
            scriptAccuracy = Math.round((this.matchedScriptIndices.size / this.scriptTokens.length) * 100);
        } else {
            scriptAccuracy = 100;
        }

        return {
            totalDurationSec: Math.round(totalDurationSec),
            totalWordsSpoken: this.spokenWords.length,
            overallWpm: overallWpm,
            pacingScore: pacingScore,
            totalStutters: this.totalStutters,
            stutterEvents: this.stutterEvents,
            totalFillers: this.totalFillers,
            fillerBreakdown: this.fillerCounts,
            fluencyScore: fluencyScore,
            scriptAccuracy: scriptAccuracy,
            fullTranscript: this.fullTranscript
        };
    }
}

window.SpeechCoach = SpeechCoach;
