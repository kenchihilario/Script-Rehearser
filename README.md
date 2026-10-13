# Rehearse AI — Smart Script Rehearsal & Speaker Coach

An intelligent multimodal presentation and speech rehearsal coach modeled after Microsoft PowerPoint's Speaker Coach. Analyzes your speech pacing, detects stutters and filler words, tracks facial expressions and eye contact via webcam, and evaluates vocal pitch and monotone delivery in real time.

---

## Key Features

1. **Voice-Synchronized Interactive Teleprompter**:
   - Word-by-word emerald illumination as you speak.
   - Intelligent auto-scroll keeping your spoken words centered in the sweet spot.
   - Adjustable font size (18px – 44px) and target cadence (WPM).
   - Pre-loaded sample scripts (Startup Pitch, TED Talk, Keynote, Thesis Defense) + Custom script creator.

2. **PowerPoint-Style Real-Time Speaker Coach**:
   - **Pacing & Tempo Diagnostics**: Real-time Words Per Minute (WPM) gauge tracking whether you are speaking too fast (>175 WPM), too slow (<115 WPM), or in the ideal conversational zone (130–160 WPM).
   - **Stutter & Repetition Engine**: Detects immediate word repetitions ("I, I", "we we", "the the"), false starts, and syllable hesitations.
   - **Filler Word Detection**: Identifies crutch words ("um", "uh", "like", "you know", "basically", "actually") with live counters.
   - **Floating Coach Nudges**: Real-time non-intrusive floating toasts with actionable advice during rehearsal.

3. **Computer Vision & Facial Expression Tracking**:
   - Uses webcam with futuristic cyber-HUD overlay.
   - **Warmth & Smile Score**: Measures smiling intensity and facial expression engagement.
   - **Eye Contact Gaze Tracking**: Evaluates if you are looking straight at the audience/camera vs scanning down at notes.
   - **Facial Dynamics**: Detects flat/deadpan/stone-face delivery vs animated, confident expressions.

4. **Web Audio Pitch & Vocal Tone Analysis**:
   - Real-time fundamental frequency ($F_0$) pitch detection in Hz via Web Audio API autocorrelation.
   - **Monotone Diagnostic**: Calculates pitch standard deviation to flag flat/monotone delivery vs rich vocal melody.
   - **Live Audio Waveform**: Real-time oscilloscope visualizer.

5. **Post-Rehearsal Performance Scorecard**:
   - Overall Score (0–100) and Letter Grade (A+, A, B, C, Needs Work).
   - 5-Axis Multimodal Competency Radar Chart (Fluency, Pacing, Vocal Tone, Expressions, Script Accuracy).
   - Chronological Stutter & Hesitation Log.
   - Actionable AI Feedback Tips tailored to your session.
   - Export session summaries to Markdown and save history over time.

---

## Quick Start

### 1. Requirements
- Python 3.8+
- Modern Web Browser (Google Chrome, Microsoft Edge, or Firefox)

### 2. Installation
```bash
cd "D:\Projects for PC\Script_Rehearser"
pip install -r requirements.txt
```

### 3. Launching the Studio
```bash
python app.py
```
This automatically opens the studio at `http://127.0.0.1:5055` in your default browser.

---

## How to Rehearse
1. **Pick or Create a Script**: Select a preset script or click **"+ New Script"** to paste your own presentation notes.
2. **Set Your Target Pace**: Default is 140 WPM. Adjust font size to your reading comfort.
3. **Click "Start Rehearsal"**: A 3-2-1 countdown will begin. Allow camera and microphone permissions when prompted.
4. **Speak Naturally**: Watch the teleprompter highlight your words in real time. Pay attention to floating coach alerts if you talk too fast or repeat words.
5. **Click "Finish & Score"**: Review your comprehensive Scorecard, Spider Radar Chart, stutter timeline, and download your performance report.
