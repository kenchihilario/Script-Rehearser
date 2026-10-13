Script Rehearser & Speaker Coach

I had a big presentation coming up and instead of practicing in front of a mirror like a normal person, I decided to build my own rehearsal studio. It's basically a PowerPoint Speaker Coach-inspired setup for running through scripts and speeches with real-time feedback on everything happening as I talk — pacing, stutters, filler words, pitch variety, eye contact, and facial expressions.

There's a lightweight Python/Flask backend that serves the app and saves session reports, and a browser frontend that does all the heavy lifting using the Web Speech API for transcription, the Web Audio API for pitch/monotone detection, and canvas computer vision to track whether you're smiling or looking down at your notes.

Still very much a work in progress. I add stuff whenever I have free time and feel like tinkering.

Stack
Python (Flask) lightweight server, session history, and report generation
Web Speech API real-time speech-to-text and transcript streaming
Web Audio API real-time pitch detection (F0 autocorrelation), tone inflection, oscilloscope
Canvas / Computer Vision face bounding, smile detection, eye contact tracking
HTML / vanilla CSS / JS no framework, custom glassmorphism teleprompter and HUD
Markdown / JSON session report exporter

How it's put together
Two main pieces:

The studio frontend (templates/ & static/):
Runs directly in your browser. Handles the teleprompter, speech recognition, audio pitch extraction, and webcam computer vision. It highlights words as you speak them, shows live WPM gauges, and pops up floating coach nudges whenever you use a filler word, stutter, or sound monotone.

The server (app.py):
A simple Flask app. Serves the frontend, manages the script library (preset + custom scripts), saves completed rehearsal sessions, and exports timestamped Markdown performance reports.

The UI is built with a cyber/glassmorphism dark layout — teleprompter on the left, live camera HUD and audio oscilloscope on the right, with a comprehensive scorecard modal that pops up when you finish.

Running it
You'll need Python 3.8+ and a modern browser (Chrome, Edge, or Firefox).

Install dependencies:
pip install -r requirements.txt

Fire up the studio:
python app.py

It will automatically open http://127.0.0.1:5055 in your default browser. Allow microphone and camera access when prompted, choose or paste a script, and hit Start Rehearsal.

Layout
app.py                              -> Flask server + REST APIs + report generator
templates/index.html                -> Main rehearsal studio interface
static/css/style.css                -> Glassmorphism dark UI & HUD styling
static/js/app.js                    -> Application orchestrator & session controller
static/js/speech_coach.js           -> Speech recognition, WPM pacing, stutter & filler engine
static/js/audio_coach.js            -> Web Audio API pitch tracking, tone dynamics, oscilloscope
static/js/vision_coach.js           -> Webcam face tracking, smile scoring, eye contact gaze
static/js/teleprompter.js           -> Voice-synchronized auto-scrolling prompter
static/js/scorecard.js              -> Multi-metric evaluation, radar chart, actionable advice
static/data/sample_scripts.json     -> Built-in practice speeches (TED, pitch, keynote, academic)
requirements.txt                    -> Minimal dependencies

What it can do right now
Real-time WPM pacing gauge (flags it if you're speaking too fast or dragging)
Instant stutter & false start detection (catches repeated words like "the the" or "I I")
Filler word tracking with live counters ("um", "uh", "like", "you know", "basically", etc.)
Web Audio pitch analysis (F0 fundamental frequency in Hz) that detects flat/monotone delivery
Webcam computer vision tracking smile warmth, facial dynamics, and audience eye contact
Voice-synchronized teleprompter with adjustable font size that scrolls as you speak
Floating PowerPoint-style coach toasts that nudge you in real time
End-of-session scorecard with overall grade (A+, A, B, C), 5-axis competency radar chart, and timeline log
Exportable Markdown performance reports generated after each run
Custom script builder so you can paste your own speeches

Why this exists
I wanted something with actual PowerPoint Speaker Coach-style multimodal feedback that I could run locally on any custom script without needing an enterprise Microsoft 365 subscription or sending audio to third-party cloud services. I also specifically wanted stutter detection and facial warmth tracking, which most speech tools ignore. Plus, it gave me an excuse to play with time-domain autocorrelation in the Web Audio API and build a dense, responsive cyber HUD.

Expect this to keep changing shape as I go — I'm figuring a lot of it out as I build.

Status
Actively being worked on. Nothing here is final.
