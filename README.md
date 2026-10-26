# Script Rehearser

I made this to practice presentations at my desk. Choose a script, read it in the teleprompter, and use the timer to keep track of a run. The app can also show a slide, a temporary transcript, and feedback while you rehearse.

## Start the app

On Windows, double-click `Launch Script Rehearser.bat`. It sets up a local Python environment, installs the packages, and starts the app.

You can also run it yourself with Python 3.8 or newer:

```powershell
pip install -r requirements.txt
python app.py
```

Then open <http://127.0.0.1:5055> if it doesn’t open automatically. Allow camera and microphone access for the live feedback.

## Using it

- Choose one of the sample scripts or add your own.
- Change the text size and teleprompter speed.
- Import a PDF or a slide image (PNG, JPG, or WebP). To use a PowerPoint deck, export it as a PDF or images first.
- Start, pause, and finish a rehearsal. The app saves session metrics and lets you export a report.
- View the live transcript and session suggestions in the summary.

The transcript is temporary: it stays in the page during the session and is cleared when you close the summary. It isn’t saved in session history or reports. The suggestions are generated locally from the rehearsal metrics; the app doesn’t send the transcript to an AI service. Browser speech recognition may process audio through the browser’s speech provider. Camera frames are processed in the browser; the face-tracking library and model load from public hosts.

## Files

- `app.py` — Flask server, scripts, session history, and report export
- `templates/index.html` — app interface
- `static/css/style.css` — styles
- `static/js/app.js` — rehearsal controls and slide/transcript display
- `static/js/teleprompter.js` — script display and scrolling
- `static/js/speech_coach.js` — speech recognition and speech metrics
- `static/js/audio_coach.js` — pitch and tone metrics
- `static/js/vision_coach.js` — camera expression and gaze estimates
- `static/js/scorecard.js` — session score and suggestions
- `static/data/sample_scripts.json` — sample scripts
- `data/` — saved scripts and session metrics
