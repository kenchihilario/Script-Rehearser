# Script Rehearser

A local practice studio for scripts and presentations. It combines a teleprompter, live delivery feedback, a slide viewer, and a session summary.

## Run

On Windows, double-click `Launch Script Rehearser.bat`. It creates a local Python environment, installs the requirements, and starts the app.

Or use Python 3.8 or newer:

```powershell
pip install -r requirements.txt
python app.py
```

The app opens at <http://127.0.0.1:5055>. Allow camera and microphone access when prompted.

## Features

- Pick a built-in script or create one.
- Import a PDF or slide image to display while rehearsing. PowerPoint slides can be exported as PDF or images first.
- Use the teleprompter with adjustable text size and scroll speed.
- View live pacing, filler word, repetition, vocal tone, expression, and eye-direction indicators.
- See a temporary transcript and local rule-based suggestions in the session summary.
- Browse previous session metrics and export a report.

The app does not send the transcript to an AI service or save it in session history or reports. Browser speech recognition may process audio through the browser's speech provider. Camera frames are processed in the browser; the face-tracking library and model are loaded from their public CDN and model host.

## Project files

- `app.py` — Flask server, script library, session history, and report generation
- `templates/index.html` — rehearsal interface
- `static/css/style.css` — interface styling
- `static/js/app.js` — rehearsal controls, slide viewer, and temporary transcript display
- `static/js/teleprompter.js` — script display and scrolling
- `static/js/speech_coach.js` — speech recognition and delivery metrics
- `static/js/audio_coach.js` — pitch and tone metrics
- `static/js/vision_coach.js` — camera expression and gaze estimates
- `static/js/scorecard.js` — session score and local suggestions
- `static/data/sample_scripts.json` — built-in scripts
- `data/` — custom scripts and saved session metrics
