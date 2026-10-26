
class Scorecard {
    constructor() {}

    static computeOverallScore(speechSummary, audioSummary, visionSummary) {
        const fluencyScore = speechSummary.fluencyScore || 75;
        const pacingScore = speechSummary.pacingScore || 80;
        const toneScore = audioSummary.toneScore || 75;
        const expressionScore = visionSummary.expressionScore || 75;
        const scriptScore = speechSummary.scriptAccuracy || 90;
        const overall = Math.round(
            (fluencyScore * 0.30) +
            (pacingScore * 0.20) +
            (toneScore * 0.20) +
            (expressionScore * 0.20) +
            (scriptScore * 0.10)
        );

        let grade = "B";
        if (overall >= 93) grade = "A+";
        else if (overall >= 88) grade = "A";
        else if (overall >= 80) grade = "B+";
        else if (overall >= 72) grade = "B";
        else if (overall >= 65) grade = "C";
        else grade = "Needs Work";

        return {
            overallScore: Math.min(100, Math.max(20, overall)),
            grade: grade,
            categories: {
                fluency: { name: "Fluency & Stutters", score: fluencyScore, weight: "30%" },
                pacing: { name: "Pacing & Rhythm", score: pacingScore, weight: "20%" },
                tone: { name: "Tone & Pitch Variety", score: toneScore, weight: "20%" },
                expression: { name: "Facial Expression & Eye Contact", score: expressionScore, weight: "20%" },
                script: { name: "Script Accuracy", score: scriptScore, weight: "10%" }
            }
        };
    }

    static generateActionableTips(speechSummary, audioSummary, visionSummary) {
        const tips = [];
        if (speechSummary.totalStutters > 2) {
            tips.push({
                category: "Fluency",
                icon: "repeat",
                title: "Reduce Repeated Starts",
                detail: `Detected ${speechSummary.totalStutters} stuttered repetitions. Practice taking a deliberate 1-second diaphragmatic breath before transitioning into new ideas.`
            });
        } else if (speechSummary.totalStutters === 0) {
            tips.push({
                category: "Fluency",
                icon: "check",
                title: "Exceptional Clean Delivery",
                detail: "Zero stuttered phrases or false starts detected. Your speech flowed smoothly and confidently."
            });
        }
        if (speechSummary.totalFillers > 3) {
            const topFillers = Object.entries(speechSummary.fillerBreakdown || {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 2)
                .map(([w, c]) => `"${w}" (${c}x)`)
                .join(", ");

            tips.push({
                category: "Filler Words",
                icon: "alert",
                title: "Eliminate Crutch Words",
                detail: `You used ${speechSummary.totalFillers} filler words, most notably ${topFillers || 'um/uh'}. Replace fillers with intentional pauses — silence commands respect.`
            });
        }
        if (speechSummary.overallWpm < 120) {
            tips.push({
                category: "Pacing",
                icon: "gauge",
                title: "Increase Cadence",
                detail: `Your average pace was ${speechSummary.overallWpm} WPM (target is ~140 WPM). Increasing your tempo slightly will inject more urgency and dynamism into your delivery.`
            });
        } else if (speechSummary.overallWpm > 170) {
            tips.push({
                category: "Pacing",
                icon: "activity",
                title: "Pace Yourself",
                detail: `Speaking at ${speechSummary.overallWpm} WPM can overwhelm listeners. Slow down around critical definitions and punchlines so audiences can absorb them.`
            });
        } else {
            tips.push({
                category: "Pacing",
                icon: "target",
                title: "Ideal Conversational Tempo",
                detail: `Your delivery clocked in at a crisp ${speechSummary.overallWpm} WPM. This matches the benchmark used by professional TED and keynote presenters.`
            });
        }
        if (audioSummary.pitchMonotone) {
            tips.push({
                category: "Tone of Voice",
                icon: "activity",
                title: "Add Vocal Pitch Modulation",
                detail: `Your vocal pitch variation was low (${audioSummary.pitchVariabilityHz} Hz). Monotone delivery can cause audience fatigue. Elevate your pitch on rhetorical questions and drop it on declarations.`
            });
        } else {
            tips.push({
                category: "Tone of Voice",
                icon: "activity",
                title: "Engaging Vocal Melody",
                detail: `Excellent vocal variety detected (${audioSummary.pitchVariabilityHz} Hz pitch variance). Your vocal inflection effectively highlights emphasis.`
            });
        }
        if (visionSummary.eyeContactPercentage != null && visionSummary.eyeContactPercentage < 70) {
            tips.push({
                category: "Eye Contact",
                icon: "eye",
                title: "Maintain Direct Camera Gaze",
                detail: `Eye contact was at ${visionSummary.eyeContactPercentage}%. Try memorizing your opening sentences so you can look directly into the camera lens rather than scanning down at text.`
            });
        }
        if (visionSummary.avgSmileScore < 20) {
            tips.push({
                category: "Facial Expression",
                icon: "smile",
                title: "Incorporate Warmth",
                detail: "Your facial expression remained relatively serious throughout. Smiling at greetings and positive conclusions helps build emotional rapport with listeners."
            });
        } else {
            tips.push({
                category: "Facial Expression",
                icon: "check",
                title: "Charismatic Presence",
                detail: "Strong facial engagement and natural smiles detected. You appeared confident, relatable, and poised."
            });
        }

        return tips;
    }

    static renderRadarChart(canvas, categoryScores) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const centerX = w / 2;
        const centerY = h / 2;
        const radius = Math.min(w, h) * 0.38;

        ctx.clearRect(0, 0, w, h);

        const labels = ["Fluency", "Pacing", "Vocal Tone", "Expressions", "Script Accuracy"];
        const keys = ["fluency", "pacing", "tone", "expression", "script"];
        const numAxes = labels.length;
        const angleStep = (Math.PI * 2) / numAxes;
        ctx.strokeStyle = "rgba(148, 163, 184, 0.15)";
        ctx.lineWidth = 1;

        for (let level = 1; level <= 4; level++) {
            const r = (radius / 4) * level;
            ctx.beginPath();
            for (let i = 0; i < numAxes; i++) {
                const angle = i * angleStep - Math.PI / 2;
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }
        ctx.fillStyle = "#94a3b8";
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (let i = 0; i < numAxes; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();
            const labelX = centerX + Math.cos(angle) * (radius + 24);
            const labelY = centerY + Math.sin(angle) * (radius + 16);
            ctx.fillText(labels[i], labelX, labelY);
        }
        const points = [];
        for (let i = 0; i < numAxes; i++) {
            const key = keys[i];
            const score = categoryScores[key] ? categoryScores[key].score : 70;
            const normScore = Math.max(0.1, Math.min(1.0, score / 100));
            const angle = i * angleStep - Math.PI / 2;
            const x = centerX + Math.cos(angle) * (radius * normScore);
            const y = centerY + Math.sin(angle) * (radius * normScore);
            points.push({ x, y, score });
        }
        const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, radius);
        grad.addColorStop(0, "rgba(99, 102, 241, 0.45)");
        grad.addColorStop(1, "rgba(6, 182, 212, 0.20)");
        ctx.fillStyle = grad;

        ctx.beginPath();
        points.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        points.forEach(pt => {
            ctx.fillStyle = "#8b5cf6";
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

window.Scorecard = Scorecard;
