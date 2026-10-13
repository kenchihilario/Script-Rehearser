/**
 * Script Rehearser - Main Application Orchestrator
 * Coordinates Teleprompter, AudioCoach, VisionCoach, SpeechCoach, and Scorecard UI.
 */
document.addEventListener("DOMContentLoaded", async () => {
    // State variables
    let currentScript = null;
    let allScripts = [];
    let sessionState = "IDLE"; // IDLE, COUNTDOWN, RECORDING, PAUSED, FINISHED
    let sessionTimerInterval = null;
    let sessionStartTimestamp = 0;
    let sessionElapsedSeconds = 0;
    let mediaStream = null;

    // Component instances
    const teleprompter = new Teleprompter(document.getElementById("prompterContainer"), {
        fontSize: 26,
        targetWpm: 140
    });
    const audioCoach = new AudioCoach();
    const visionCoach = new VisionCoach();
    const speechCoach = new SpeechCoach();

    // DOM Elements
    const elements = {
        scriptSelect: document.getElementById("scriptSelect"),
        targetWpmInput: document.getElementById("targetWpmInput"),
        fontSizeSlider: document.getElementById("fontSizeSlider"),
        fontSizeVal: document.getElementById("fontSizeVal"),
        scriptWordCount: document.getElementById("scriptWordCount"),
        scriptEstDuration: document.getElementById("scriptEstDuration"),
        sessionTimer: document.getElementById("sessionTimer"),

        // Controls
        btnStart: document.getElementById("btnStart"),
        btnPause: document.getElementById("btnPause"),
        btnFinish: document.getElementById("btnFinish"),
        btnNewScript: document.getElementById("btnNewScript"),
        btnHistory: document.getElementById("btnHistory"),

        // Live HUD Badges & Meters
        liveWpmValue: document.getElementById("liveWpmValue"),
        liveWpmStatus: document.getElementById("liveWpmStatus"),
        wpmGaugeBar: document.getElementById("wpmGaugeBar"),
        liveStutterCount: document.getElementById("liveStutterCount"),
        liveFillerCount: document.getElementById("liveFillerCount"),
        liveToneStatus: document.getElementById("liveToneStatus"),
        livePitchHz: document.getElementById("livePitchHz"),
        liveEyeContactStatus: document.getElementById("liveEyeContactStatus"),
        liveSmileScore: document.getElementById("liveSmileScore"),
        liveExpressionState: document.getElementById("liveExpressionState"),
        coachTipBox: document.getElementById("coachTipBox"),
        coachTipText: document.getElementById("coachTipText"),
        coachTipIcon: document.getElementById("coachTipIcon"),

        // Media elements
        webcamVideo: document.getElementById("webcamVideo"),
        visionCanvas: document.getElementById("visionCanvas"),
        audioCanvas: document.getElementById("audioCanvas"),

        // Modals & Drawers
        countdownOverlay: document.getElementById("countdownOverlay"),
        countdownNum: document.getElementById("countdownNum"),
        reportModal: document.getElementById("reportModal"),
        btnCloseReport: document.getElementById("btnCloseReport"),
        btnExportReport: document.getElementById("btnExportReport"),
        btnRehearseAgain: document.getElementById("btnRehearseAgain"),
        scriptModal: document.getElementById("scriptModal"),
        btnCloseScriptModal: document.getElementById("btnCloseScriptModal"),
        btnSaveCustomScript: document.getElementById("btnSaveCustomScript"),
        historyModal: document.getElementById("historyModal"),
        btnCloseHistoryModal: document.getElementById("btnCloseHistoryModal"),
        historyList: document.getElementById("historyList"),

        // Report DOM elements
        reportOverallScore: document.getElementById("reportOverallScore"),
        reportGrade: document.getElementById("reportGrade"),
        reportWpm: document.getElementById("reportWpm"),
        reportStutters: document.getElementById("reportStutters"),
        reportFillers: document.getElementById("reportFillers"),
        reportToneScore: document.getElementById("reportToneScore"),
        reportEyeContact: document.getElementById("reportEyeContact"),
        reportScriptAccuracy: document.getElementById("reportScriptAccuracy"),
        reportTipsList: document.getElementById("reportTipsList"),
        reportRadarCanvas: document.getElementById("reportRadarCanvas"),
        reportTranscript: document.getElementById("reportTranscript"),
        stutterDetailsList: document.getElementById("stutterDetailsList"),
    };

    let activeCoachTipTimeout = null;
    let lastCompletedReportData = null;

    // 1. Initial Load: Fetch scripts
    async function loadScripts() {
        try {
            const res = await fetch("/api/scripts");
            const data = await res.json();
            allScripts = data.all || [];

            elements.scriptSelect.innerHTML = "";
            allScripts.forEach(script => {
                const opt = document.createElement("option");
                opt.value = script.id;
                opt.textContent = `[${script.category || 'General'}] ${script.title}`;
                elements.scriptSelect.appendChild(opt);
            });

            if (allScripts.length > 0) {
                selectScript(allScripts[0]);
            }
        } catch (e) {
            console.error("Failed to load scripts:", e);
        }
    }

    function selectScript(script) {
        currentScript = script;
        elements.targetWpmInput.value = script.targetWpm || 140;
        teleprompter.loadScript(script.text, script.targetWpm || 140);
        const stats = teleprompter.getStats();
        elements.scriptWordCount.textContent = `${stats.totalWords} words`;
        elements.scriptEstDuration.textContent = `~${stats.estimatedDurationFormatted}`;
    }

    // 2. Camera & Microphone Setup
    async function setupMediaStreams() {
        if (mediaStream) return mediaStream;
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            return mediaStream;
        } catch (err) {
            console.warn("Real camera/mic access failed or denied. Initializing synthetic mock for testing:", err);
            // Create audio dummy via Web Audio
            return null;
        }
    }

    // 3. Floating Coach Tips Notification
    function showCoachTip(tip) {
        if (!tip || !elements.coachTipBox) return;
        elements.coachTipIcon.textContent = tip.icon || "💡";
        elements.coachTipText.textContent = tip.message;
        elements.coachTipBox.className = `coach-tip-box show ${tip.type || 'info'}`;

        if (activeCoachTipTimeout) clearTimeout(activeCoachTipTimeout);
        activeCoachTipTimeout = setTimeout(() => {
            elements.coachTipBox.className = "coach-tip-box";
        }, 4500);
    }

    // 4. Session Controls
    elements.btnStart.addEventListener("click", async () => {
        if (sessionState === "IDLE" || sessionState === "FINISHED") {
            startCountdown();
        }
    });

    elements.btnPause.addEventListener("click", () => {
        if (sessionState === "RECORDING") {
            pauseSession();
        } else if (sessionState === "PAUSED") {
            resumeSession();
        }
    });

    elements.btnFinish.addEventListener("click", () => {
        if (sessionState === "RECORDING" || sessionState === "PAUSED") {
            finishSession();
        }
    });

    function startCountdown() {
        sessionState = "COUNTDOWN";
        elements.countdownOverlay.classList.add("active");
        let count = 3;
        elements.countdownNum.textContent = count;

        const countInterval = setInterval(() => {
            count--;
            if (count > 0) {
                elements.countdownNum.textContent = count;
                elements.countdownNum.style.animation = "none";
                void elements.countdownNum.offsetWidth; // trigger reflow
                elements.countdownNum.style.animation = "popIn 0.8s ease-out";
            } else {
                clearInterval(countInterval);
                elements.countdownOverlay.classList.remove("active");
                beginRecordingSession();
            }
        }, 1000);
    }

    async function beginRecordingSession() {
        sessionState = "RECORDING";
        sessionStartTimestamp = Date.now();
        sessionElapsedSeconds = 0;

        elements.btnStart.classList.add("hidden");
        elements.btnPause.classList.remove("hidden");
        elements.btnPause.innerHTML = `<span class="btn-icon">⏸️</span> Pause`;
        elements.btnFinish.classList.remove("hidden");

        teleprompter.reset();
        const targetWpm = parseInt(elements.targetWpmInput.value) || 140;

        // Init media
        const stream = await setupMediaStreams();

        // Start Audio Coach
        if (stream && stream.getAudioTracks().length > 0) {
            audioCoach.init(stream, elements.audioCanvas, {
                onMetricsUpdate: (m) => {
                    if (m.currentPitch) {
                        elements.livePitchHz.textContent = `${m.currentPitch} Hz`;
                    }
                    elements.liveToneStatus.textContent = m.toneStatus;
                    elements.liveToneStatus.className = `stat-badge ${m.pitchStdDev < 16 ? 'warning' : 'success'}`;
                },
                onCoachTip: showCoachTip
            });
        }

        // Start Vision Coach
        if (stream && stream.getVideoTracks().length > 0) {
            visionCoach.init(elements.webcamVideo, elements.visionCanvas, stream, {
                onMetricsUpdate: (vm) => {
                    elements.liveSmileScore.textContent = `${vm.smileScore}%`;
                    elements.liveExpressionState.textContent = vm.expressionState;
                    elements.liveEyeContactStatus.textContent = vm.isEyeContact ? "Direct Eye Contact" : "Looking Away";
                    elements.liveEyeContactStatus.className = `stat-badge ${vm.isEyeContact ? 'success' : 'warning'}`;
                },
                onCoachTip: showCoachTip
            });
        }

        // Start Speech Coach
        speechCoach.init(currentScript ? currentScript.text : "", targetWpm, {
            onSpeechResult: (sr) => {
                elements.liveWpmValue.textContent = sr.currentWpm || "--";
                elements.liveStutterCount.textContent = sr.totalStutters;
                elements.liveFillerCount.textContent = sr.totalFillers;

                // Update WPM gauge bar
                const pct = Math.min(100, Math.max(10, ((sr.currentWpm || 100) / 220) * 100));
                elements.wpmGaugeBar.style.width = `${pct}%`;

                if (sr.currentWpm < 115) {
                    elements.liveWpmStatus.textContent = "Slow";
                    elements.liveWpmStatus.className = "stat-badge warning";
                } else if (sr.currentWpm > 175) {
                    elements.liveWpmStatus.textContent = "Fast";
                    elements.liveWpmStatus.className = "stat-badge warning";
                } else {
                    elements.liveWpmStatus.textContent = "Ideal Pace";
                    elements.liveWpmStatus.className = "stat-badge success";
                }
            },
            onWordMatched: (m) => {
                teleprompter.highlightWord(m.index);
            },
            onCoachTip: showCoachTip
        });

        speechCoach.start();

        // Session timer ticker
        sessionTimerInterval = setInterval(() => {
            sessionElapsedSeconds++;
            const mins = String(Math.floor(sessionElapsedSeconds / 60)).padStart(2, '0');
            const secs = String(sessionElapsedSeconds % 60).padStart(2, '0');
            elements.sessionTimer.textContent = `${mins}:${secs}`;
        }, 1000);

        showCoachTip({
            category: "start",
            type: "info",
            icon: "🚀",
            message: "Rehearsal live! Speak clearly, maintain camera contact, and let your voice breathe."
        });
    }

    function pauseSession() {
        sessionState = "PAUSED";
        clearInterval(sessionTimerInterval);
        speechCoach.stop();
        teleprompter.stopAutoScroll();
        elements.btnPause.innerHTML = `<span class="btn-icon">▶️</span> Resume`;
        showCoachTip({
            category: "pause",
            type: "info",
            icon: "⏸️",
            message: "Rehearsal paused. Click Resume when you're ready to continue."
        });
    }

    function resumeSession() {
        sessionState = "RECORDING";
        speechCoach.start();
        sessionTimerInterval = setInterval(() => {
            sessionElapsedSeconds++;
            const mins = String(Math.floor(sessionElapsedSeconds / 60)).padStart(2, '0');
            const secs = String(sessionElapsedSeconds % 60).padStart(2, '0');
            elements.sessionTimer.textContent = `${mins}:${secs}`;
        }, 1000);
        elements.btnPause.innerHTML = `<span class="btn-icon">⏸️</span> Pause`;
    }

    async function finishSession() {
        sessionState = "FINISHED";
        clearInterval(sessionTimerInterval);

        speechCoach.stop();
        audioCoach.stop();
        visionCoach.stop();
        teleprompter.stopAutoScroll();

        elements.btnStart.classList.remove("hidden");
        elements.btnPause.classList.add("hidden");
        elements.btnFinish.classList.add("hidden");

        // Synthesize summaries
        const speechSummary = speechCoach.getSummary();
        const audioSummary = audioCoach.getSummary();
        const visionSummary = visionCoach.getSummary();

        const evaluation = Scorecard.computeOverallScore(speechSummary, audioSummary, visionSummary);
        const tips = Scorecard.generateActionableTips(speechSummary, audioSummary, visionSummary);

        const sessionPayload = {
            scriptTitle: currentScript ? currentScript.title : "Free Speech",
            durationSeconds: sessionElapsedSeconds,
            overallScore: evaluation.overallScore,
            grade: evaluation.grade,
            wpm: speechSummary.overallWpm,
            pacingScore: speechSummary.pacingScore,
            stutterCount: speechSummary.totalStutters,
            stutterList: speechSummary.stutterEvents,
            fillerCount: speechSummary.totalFillers,
            fillerBreakdown: speechSummary.fillerBreakdown,
            fluencyScore: speechSummary.fluencyScore,
            toneScore: audioSummary.toneScore,
            pitchVariabilityHz: audioSummary.pitchVariabilityHz,
            pitchMonotone: audioSummary.pitchMonotone,
            expressionScore: visionSummary.expressionScore,
            smilePercentage: visionSummary.avgSmileScore,
            eyeContactPercentage: visionSummary.eyeContactPercentage,
            scriptAccuracy: speechSummary.scriptAccuracy,
            coachingTips: tips.map(t => `${t.title}: ${t.detail}`),
            transcript: speechSummary.fullTranscript
        };

        lastCompletedReportData = sessionPayload;

        // Save session to backend
        try {
            const resp = await fetch("/api/rehearsals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(sessionPayload)
            });
            const data = await resp.json();
            if (data.reportFile) {
                lastCompletedReportData.reportFile = data.reportFile;
            }
        } catch (e) {
            console.warn("Could not save session to server:", e);
        }

        // Populate Report Card
        populateReportCard(evaluation, speechSummary, audioSummary, visionSummary, tips);
        elements.reportModal.classList.add("active");
    }

    function populateReportCard(evaluation, speechSummary, audioSummary, visionSummary, tips) {
        elements.reportOverallScore.textContent = evaluation.overallScore;
        elements.reportGrade.textContent = evaluation.grade;

        // Grade color styling
        const gradeClasses = { "A+": "grade-s", "A": "grade-a", "B+": "grade-b", "B": "grade-b", "C": "grade-c" };
        elements.reportGrade.className = `grade-badge ${gradeClasses[evaluation.grade] || 'grade-d'}`;

        elements.reportWpm.textContent = `${speechSummary.overallWpm} WPM`;
        elements.reportStutters.textContent = speechSummary.totalStutters;
        elements.reportFillers.textContent = speechSummary.totalFillers;
        elements.reportToneScore.textContent = `${audioSummary.toneScore}/100`;
        elements.reportEyeContact.textContent = `${visionSummary.eyeContactPercentage}%`;
        elements.reportScriptAccuracy.textContent = `${speechSummary.scriptAccuracy}%`;
        elements.reportTranscript.textContent = speechSummary.fullTranscript || "(No spoken words recorded during this rehearsal)";

        // Stutter details list
        elements.stutterDetailsList.innerHTML = "";
        if (speechSummary.stutterEvents && speechSummary.stutterEvents.length > 0) {
            speechSummary.stutterEvents.forEach(evt => {
                const li = document.createElement("li");
                li.innerHTML = `<strong>${evt.timeSec}s</strong>: ${evt.type} on <em>"${evt.word}"</em>`;
                elements.stutterDetailsList.appendChild(li);
            });
        } else {
            elements.stutterDetailsList.innerHTML = "<li class='clean-note'>No stuttered repetitions recorded! Delivery was exceptionally clean.</li>";
        }

        // Actionable Coaching Tips List
        elements.reportTipsList.innerHTML = "";
        tips.forEach(t => {
            const item = document.createElement("div");
            item.className = "tip-card";
            item.innerHTML = `
                <div class="tip-icon">${t.icon}</div>
                <div class="tip-body">
                    <div class="tip-title">${t.title}</div>
                    <div class="tip-detail">${t.detail}</div>
                </div>
            `;
            elements.reportTipsList.appendChild(item);
        });

        // Render Radar Chart
        setTimeout(() => {
            Scorecard.renderRadarChart(elements.reportRadarCanvas, evaluation.categories);
        }, 150);
    }

    // Modal Events
    elements.btnCloseReport.addEventListener("click", () => {
        elements.reportModal.classList.remove("active");
    });
    elements.btnRehearseAgain.addEventListener("click", () => {
        elements.reportModal.classList.remove("active");
        teleprompter.reset();
        elements.sessionTimer.textContent = "00:00";
    });

    elements.btnExportReport.addEventListener("click", () => {
        if (lastCompletedReportData && lastCompletedReportData.reportFile) {
            window.open(`/api/reports/${lastCompletedReportData.reportFile}`, "_blank");
        } else {
            // Client-side fallback download
            const blob = new Blob([JSON.stringify(lastCompletedReportData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `rehearsal_report_${Date.now()}.json`;
            a.click();
        }
    });

    // Custom Script Modal
    elements.btnNewScript.addEventListener("click", () => {
        elements.scriptModal.classList.add("active");
    });
    elements.btnCloseScriptModal.addEventListener("click", () => {
        elements.scriptModal.classList.remove("active");
    });
    elements.btnSaveCustomScript.addEventListener("click", async () => {
        const title = document.getElementById("newScriptTitle").value.trim() || "Custom Script";
        const category = document.getElementById("newScriptCategory").value.trim() || "General";
        const wpm = parseInt(document.getElementById("newScriptWpm").value) || 140;
        const text = document.getElementById("newScriptText").value.trim();

        if (!text) {
            alert("Please provide the text for your script.");
            return;
        }

        try {
            const res = await fetch("/api/scripts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, category, targetWpm: wpm, text })
            });
            const data = await res.json();
            if (data.script) {
                await loadScripts();
                selectScript(data.script);
                elements.scriptSelect.value = data.script.id;
                elements.scriptModal.classList.remove("active");
            }
        } catch (e) {
            console.error("Save script error:", e);
        }
    });

    // History Modal
    elements.btnHistory.addEventListener("click", async () => {
        elements.historyModal.classList.add("active");
        elements.historyList.innerHTML = "<div class='loading-spinner'>Loading history...</div>";
        try {
            const res = await fetch("/api/rehearsals");
            const history = await res.json();
            elements.historyList.innerHTML = "";
            if (!history || history.length === 0) {
                elements.historyList.innerHTML = "<div class='empty-state'>No rehearsals recorded yet. Complete your first session to see your stats here!</div>";
                return;
            }
            history.forEach(item => {
                const dateStr = new Date(item.timestamp).toLocaleString();
                const card = document.createElement("div");
                card.className = "history-card";
                card.innerHTML = `
                    <div class="history-card-header">
                        <span class="history-title">${item.scriptTitle}</span>
                        <span class="history-score">${item.overallScore}/100 (Grade ${item.grade})</span>
                    </div>
                    <div class="history-card-meta">
                        <span>📅 ${dateStr}</span>
                        <span>⏱️ ${item.durationSeconds}s</span>
                        <span>🗣️ ${item.metrics.wpm} WPM</span>
                        <span>🔄 ${item.metrics.stutterCount} Stutters</span>
                        <span>⚠️ ${item.metrics.fillerCount} Fillers</span>
                    </div>
                `;
                elements.historyList.appendChild(card);
            });
        } catch (e) {
            elements.historyList.innerHTML = "<div class='error-state'>Failed to load history.</div>";
        }
    });
    elements.btnCloseHistoryModal.addEventListener("click", () => {
        elements.historyModal.classList.remove("active");
    });

    // Font size slider
    elements.fontSizeSlider.addEventListener("input", (e) => {
        const sz = e.target.value;
        elements.fontSizeVal.textContent = `${sz}px`;
        teleprompter.applyFontSize(parseInt(sz));
    });

    // Script dropdown switch
    elements.scriptSelect.addEventListener("change", (e) => {
        const found = allScripts.find(s => s.id === e.target.value);
        if (found) {
            selectScript(found);
        }
    });

    // Target WPM change
    elements.targetWpmInput.addEventListener("change", (e) => {
        const wpm = parseInt(e.target.value) || 140;
        teleprompter.targetWpm = wpm;
        const stats = teleprompter.getStats();
        elements.scriptEstDuration.textContent = `~${stats.estimatedDurationFormatted}`;
    });

    // Load scripts on boot
    await loadScripts();
});
