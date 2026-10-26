
document.addEventListener("DOMContentLoaded", async () => {
    let currentScript = null;
    let allScripts = [];
    let sessionState = "IDLE";
    let sessionTimerInterval = null;
    let sessionStartTimestamp = 0;
    let sessionElapsedSeconds = 0;
    let mediaStream = null;
    let speechRecognitionAvailable = false;
    const teleprompter = new Teleprompter(document.getElementById("prompterContainer"), {
        fontSize: 26,
        targetWpm: 140
    });
    const audioCoach = new AudioCoach();
    const visionCoach = new VisionCoach();
    const speechCoach = new SpeechCoach();
    const elements = {
        scriptSelect: document.getElementById("scriptSelect"),
        targetWpmInput: document.getElementById("targetWpmInput"),
        fontSizeSlider: document.getElementById("fontSizeSlider"),
        fontSizeVal: document.getElementById("fontSizeVal"),
        scriptWordCount: document.getElementById("scriptWordCount"),
        scriptEstDuration: document.getElementById("scriptEstDuration"),
        sessionTimer: document.getElementById("sessionTimer"),
        btnStart: document.getElementById("btnStart"),
        btnPause: document.getElementById("btnPause"),
        btnFinish: document.getElementById("btnFinish"),
        btnNewScript: document.getElementById("btnNewScript"),
        btnHistory: document.getElementById("btnHistory"),
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
        webcamVideo: document.getElementById("webcamVideo"),
        visionCanvas: document.getElementById("visionCanvas"),
        audioCanvas: document.getElementById("audioCanvas"),
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
        liveTranscript: document.getElementById("liveTranscript"),
        transcriptStatus: document.getElementById("transcriptStatus"),
        btnImportSlide: document.getElementById("btnImportSlide"),
        slideFileInput: document.getElementById("slideFileInput"),
        slideEmptyState: document.getElementById("slideEmptyState"),
        slideImage: document.getElementById("slideImage"),
        slidePdf: document.getElementById("slidePdf"),
        slideFileName: document.getElementById("slideFileName"),
        btnClearSlide: document.getElementById("btnClearSlide"),
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
    let slideObjectUrl = null;

    const iconNames = new Set([
        "mic", "plus", "chart", "repeat", "alert", "image", "eye", "activity", "target",
        "bulb", "message", "file", "download", "calendar", "clock", "play", "pause",
        "stop", "smile", "check", "gauge", "sparkle"
    ]);
    function iconMarkup(name, extraClass = "") {
        const iconName = iconNames.has(name) ? name : "bulb";
        return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#icon-${iconName}"></use></svg>`;
    }

    function clearSessionTranscript() {
        elements.liveTranscript.textContent = "Your words will appear here while you speak.";
        elements.liveTranscript.classList.add("is-empty");
        elements.transcriptStatus.textContent = "Waiting to start";
        elements.transcriptStatus.classList.remove("is-active");
        elements.reportTranscript.textContent = "";
        speechCoach.clearTranscript();
    }

    function clearImportedSlide() {
        if (slideObjectUrl) URL.revokeObjectURL(slideObjectUrl);
        slideObjectUrl = null;
        elements.slidePdf.src = "about:blank";
        elements.slideImage.removeAttribute("src");
        elements.slidePdf.classList.add("hidden");
        elements.slideImage.classList.add("hidden");
        elements.slideEmptyState.classList.remove("hidden");
        elements.slideFileName.textContent = "No slide loaded";
        elements.btnClearSlide.classList.add("hidden");
        elements.slideFileInput.value = "";
    }

    function showImportedSlide(file) {
        clearImportedSlide();
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const isImage = file.type.startsWith("image/");
        if (!isPdf && !isImage) {
            alert("Choose a PDF or a slide image (PNG, JPG, or WebP). Export PowerPoint slides to one of these formats first.");
            return;
        }

        slideObjectUrl = URL.createObjectURL(file);
        elements.slideEmptyState.classList.add("hidden");
        elements.slideFileName.textContent = file.name;
        elements.btnClearSlide.classList.remove("hidden");
        if (isPdf) {
            elements.slidePdf.src = `${slideObjectUrl}#toolbar=1&navpanes=0&view=FitH`;
            elements.slidePdf.classList.remove("hidden");
        } else {
            elements.slideImage.src = slideObjectUrl;
            elements.slideImage.classList.remove("hidden");
        }
    }
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
            return null;
        }
    }
    function showCoachTip(tip) {
        if (!tip || !elements.coachTipBox) return;
        elements.coachTipIcon.innerHTML = iconMarkup(tip.icon || "bulb");
        elements.coachTipText.textContent = tip.message;
        elements.coachTipBox.className = `coach-tip-box show ${tip.type || 'info'}`;

        if (activeCoachTipTimeout) clearTimeout(activeCoachTipTimeout);
        activeCoachTipTimeout = setTimeout(() => {
            elements.coachTipBox.className = "coach-tip-box";
        }, 4500);
    }
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
                void elements.countdownNum.offsetWidth;
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
        clearSessionTranscript();
        elements.transcriptStatus.textContent = "Listening…";
        elements.transcriptStatus.classList.add("is-active");

        elements.btnStart.classList.add("hidden");
        elements.btnPause.classList.remove("hidden");
        elements.btnPause.innerHTML = `<span class="btn-icon">${iconMarkup("pause")}</span> Pause`;
        elements.btnFinish.classList.remove("hidden");

        teleprompter.reset();
        const targetWpm = parseInt(elements.targetWpmInput.value) || 140;
        const stream = await setupMediaStreams();
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
        if (stream && stream.getVideoTracks().length > 0) {
            await visionCoach.init(elements.webcamVideo, elements.visionCanvas, stream, {
                onMetricsUpdate: (vm) => {
                    elements.liveSmileScore.textContent = `${vm.smileScore}%`;
                    elements.liveExpressionState.textContent = vm.expressionState;
                    elements.liveEyeContactStatus.textContent = vm.gazeStatus;
                    const gazeClass = vm.isEyeContact === true ? "success" : vm.isEyeContact === false ? "warning" : "neutral";
                    elements.liveEyeContactStatus.className = `stat-badge ${gazeClass}`;
                },
                onCoachTip: showCoachTip
            });
        } else {
            elements.liveEyeContactStatus.textContent = "Camera unavailable";
            elements.liveEyeContactStatus.className = "stat-badge neutral";
            elements.liveExpressionState.textContent = "Camera unavailable";
        }
        speechRecognitionAvailable = speechCoach.init(currentScript ? currentScript.text : "", targetWpm, {
            onSpeechResult: (sr) => {
                const transcriptText = [sr.fullTranscript, sr.interimText].filter(Boolean).join(" ").trim();
                elements.liveTranscript.textContent = transcriptText || "Listening for speech…";
                elements.liveTranscript.classList.toggle("is-empty", !transcriptText);
                elements.liveTranscript.scrollTop = elements.liveTranscript.scrollHeight;
                elements.liveWpmValue.textContent = sr.currentWpm || "--";
                elements.liveStutterCount.textContent = sr.totalStutters;
                elements.liveFillerCount.textContent = sr.totalFillers;
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
        elements.transcriptStatus.textContent = speechRecognitionAvailable
            ? "Listening · temporary transcript"
            : "Speech recognition is unavailable in this browser";
        elements.transcriptStatus.classList.toggle("is-active", speechRecognitionAvailable);
        sessionTimerInterval = setInterval(() => {
            sessionElapsedSeconds++;
            const mins = String(Math.floor(sessionElapsedSeconds / 60)).padStart(2, '0');
            const secs = String(sessionElapsedSeconds % 60).padStart(2, '0');
            elements.sessionTimer.textContent = `${mins}:${secs}`;
        }, 1000);

        showCoachTip({
            category: "start",
            type: "info",
            icon: "play",
            message: "Rehearsal live! Speak clearly, maintain camera contact, and let your voice breathe."
        });
    }

    async function pauseSession() {
        sessionState = "PAUSED";
        clearInterval(sessionTimerInterval);
        await speechCoach.pause();
        teleprompter.stopAutoScroll();
        elements.transcriptStatus.textContent = "Paused";
        elements.transcriptStatus.classList.remove("is-active");
        elements.btnPause.innerHTML = `<span class="btn-icon">${iconMarkup("play")}</span> Resume`;
        showCoachTip({
            category: "pause",
            type: "info",
            icon: "pause",
            message: "Rehearsal paused. Click Resume when you're ready to continue."
        });
    }

    function resumeSession() {
        sessionState = "RECORDING";
        speechCoach.start(true);
        elements.transcriptStatus.textContent = speechRecognitionAvailable
            ? "Listening · temporary transcript"
            : "Speech recognition is unavailable in this browser";
        elements.transcriptStatus.classList.toggle("is-active", speechRecognitionAvailable);
        sessionTimerInterval = setInterval(() => {
            sessionElapsedSeconds++;
            const mins = String(Math.floor(sessionElapsedSeconds / 60)).padStart(2, '0');
            const secs = String(sessionElapsedSeconds % 60).padStart(2, '0');
            elements.sessionTimer.textContent = `${mins}:${secs}`;
        }, 1000);
        elements.btnPause.innerHTML = `<span class="btn-icon">${iconMarkup("pause")}</span> Pause`;
    }

    async function finishSession() {
        sessionState = "FINISHED";
        clearInterval(sessionTimerInterval);

        await speechCoach.stop();
        audioCoach.stop();
        visionCoach.stop();
        teleprompter.stopAutoScroll();

        elements.btnStart.classList.remove("hidden");
        elements.btnPause.classList.add("hidden");
        elements.btnFinish.classList.add("hidden");
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
            coachingTips: tips.map(t => `${t.title}: ${t.detail}`)
        };

        lastCompletedReportData = sessionPayload;
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
        populateReportCard(evaluation, speechSummary, audioSummary, visionSummary, tips);
        elements.transcriptStatus.textContent = "Session ended · transcript is temporary";
        elements.transcriptStatus.classList.remove("is-active");
        elements.reportModal.classList.add("active");
    }

    function populateReportCard(evaluation, speechSummary, audioSummary, visionSummary, tips) {
        elements.reportOverallScore.textContent = evaluation.overallScore;
        elements.reportGrade.textContent = evaluation.grade;
        const gradeClasses = { "A+": "grade-s", "A": "grade-a", "B+": "grade-b", "B": "grade-b", "C": "grade-c" };
        elements.reportGrade.className = `grade-badge ${gradeClasses[evaluation.grade] || 'grade-d'}`;

        elements.reportWpm.textContent = `${speechSummary.overallWpm} WPM`;
        elements.reportStutters.textContent = speechSummary.totalStutters;
        elements.reportFillers.textContent = speechSummary.totalFillers;
        elements.reportToneScore.textContent = `${audioSummary.toneScore}/100`;
        elements.reportEyeContact.textContent = visionSummary.eyeContactPercentage == null
            ? "N/A"
            : `${visionSummary.eyeContactPercentage}%`;
        elements.reportScriptAccuracy.textContent = `${speechSummary.scriptAccuracy}%`;
        elements.reportTranscript.textContent = speechSummary.fullTranscript || "(No spoken words recorded during this rehearsal)";
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
        elements.reportTipsList.innerHTML = "";
        tips.forEach(t => {
            const item = document.createElement("div");
            item.className = "tip-card";
            item.innerHTML = `
                <div class="tip-icon">${iconMarkup(t.icon)}</div>
                <div class="tip-body">
                    <div class="tip-title">${t.title}</div>
                    <div class="tip-detail">${t.detail}</div>
                </div>
            `;
            elements.reportTipsList.appendChild(item);
        });
        setTimeout(() => {
            Scorecard.renderRadarChart(elements.reportRadarCanvas, evaluation.categories);
        }, 150);
    }
    elements.btnCloseReport.addEventListener("click", () => {
        elements.reportModal.classList.remove("active");
        clearSessionTranscript();
    });
    elements.btnRehearseAgain.addEventListener("click", () => {
        elements.reportModal.classList.remove("active");
        teleprompter.reset();
        elements.sessionTimer.textContent = "00:00";
        clearSessionTranscript();
    });

    elements.btnExportReport.addEventListener("click", () => {
        if (lastCompletedReportData && lastCompletedReportData.reportFile) {
            window.open(`/api/reports/${lastCompletedReportData.reportFile}`, "_blank");
        } else {
            const blob = new Blob([JSON.stringify(lastCompletedReportData, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `rehearsal_report_${Date.now()}.json`;
            a.click();
        }
    });
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
                        <span>${iconMarkup("calendar", "icon-small")} ${dateStr}</span>
                        <span>${iconMarkup("clock", "icon-small")} ${item.durationSeconds}s</span>
                        <span>${iconMarkup("activity", "icon-small")} ${item.metrics.wpm} WPM</span>
                        <span>${iconMarkup("repeat", "icon-small")} ${item.metrics.stutterCount} Stutters</span>
                        <span>${iconMarkup("alert", "icon-small")} ${item.metrics.fillerCount} Fillers</span>
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
    elements.fontSizeSlider.addEventListener("input", (e) => {
        const sz = e.target.value;
        elements.fontSizeVal.textContent = `${sz}px`;
        teleprompter.applyFontSize(parseInt(sz));
    });
    elements.scriptSelect.addEventListener("change", (e) => {
        const found = allScripts.find(s => s.id === e.target.value);
        if (found) {
            selectScript(found);
        }
    });
    elements.btnImportSlide.addEventListener("click", () => elements.slideFileInput.click());
    elements.slideFileInput.addEventListener("change", (event) => {
        const file = event.target.files?.[0];
        if (file) showImportedSlide(file);
    });
    elements.btnClearSlide.addEventListener("click", clearImportedSlide);
    window.addEventListener("beforeunload", () => {
        if (slideObjectUrl) URL.revokeObjectURL(slideObjectUrl);
    });
    elements.targetWpmInput.addEventListener("change", (e) => {
        const wpm = parseInt(e.target.value) || 140;
        teleprompter.targetWpm = wpm;
        const stats = teleprompter.getStats();
        elements.scriptEstDuration.textContent = `~${stats.estimatedDurationFormatted}`;
    });
    await loadScripts();
});
