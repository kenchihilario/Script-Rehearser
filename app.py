import os
import json
import time
import uuid
import webbrowser
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

SCRIPTS_FILE = os.path.join(DATA_DIR, "user_scripts.json")
REHEARSALS_FILE = os.path.join(DATA_DIR, "rehearsal_history.json")
SAMPLE_SCRIPTS_FILE = os.path.join(BASE_DIR, "static", "data", "sample_scripts.json")

app = Flask(__name__, template_folder="templates", static_folder="static")


def load_json(filepath, default_val=None):
    if default_val is None:
        default_val = []
    if not os.path.exists(filepath):
        return default_val
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default_val


def save_json(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/scripts", methods=["GET"])
def get_scripts():
    samples = load_json(SAMPLE_SCRIPTS_FILE, [])
    user_scripts = load_json(SCRIPTS_FILE, [])
    return jsonify({
        "samples": samples,
        "user_scripts": user_scripts,
        "all": samples + user_scripts
    })


@app.route("/api/scripts", methods=["POST"])
def save_script():
    data = request.json or {}
    title = data.get("title", "").strip() or "Untitled Script"
    text = data.get("text", "").strip()
    category = data.get("category", "Custom")
    target_wpm = int(data.get("targetWpm", 140))
    desc = data.get("description", "")

    if not text:
        return jsonify({"error": "Script text cannot be empty"}), 400

    user_scripts = load_json(SCRIPTS_FILE, [])
    script_id = f"custom_{uuid.uuid4().hex[:8]}"
    script_obj = {
        "id": script_id,
        "title": title,
        "text": text,
        "category": category,
        "targetWpm": target_wpm,
        "description": desc or f"{len(text.split())} words custom rehearsal script.",
        "updatedAt": datetime.now().isoformat()
    }

    user_scripts.insert(0, script_obj)

    save_json(SCRIPTS_FILE, user_scripts)
    return jsonify({"success": True, "script": script_obj})


@app.route("/api/scripts/<script_id>", methods=["PUT"])
def update_script(script_id):
    data = request.json or {}
    title = data.get("title", "").strip() or "Untitled Script"
    text = data.get("text", "").strip()
    category = data.get("category", "Custom").strip() or "Custom"
    try:
        target_wpm = int(data.get("targetWpm", 140))
    except (TypeError, ValueError):
        return jsonify({"error": "Target WPM must be a number"}), 400
    desc = data.get("description", "")

    if not text:
        return jsonify({"error": "Script text cannot be empty"}), 400

    user_scripts = load_json(SCRIPTS_FILE, [])
    existing_idx = next((i for i, script in enumerate(user_scripts) if script.get("id") == script_id), None)
    if existing_idx is None:
        return jsonify({"error": "Only saved custom scripts can be edited"}), 404

    script_obj = {
        **user_scripts[existing_idx],
        "title": title,
        "text": text,
        "category": category,
        "targetWpm": target_wpm,
        "description": desc or f"{len(text.split())} words custom rehearsal script.",
        "updatedAt": datetime.now().isoformat()
    }
    user_scripts[existing_idx] = script_obj
    save_json(SCRIPTS_FILE, user_scripts)
    return jsonify({"success": True, "script": script_obj})


@app.route("/api/scripts/<script_id>", methods=["DELETE"])
def delete_script(script_id):
    user_scripts = load_json(SCRIPTS_FILE, [])
    filtered = [s for s in user_scripts if s.get("id") != script_id]
    save_json(SCRIPTS_FILE, filtered)
    return jsonify({"success": True})


@app.route("/api/rehearsals", methods=["GET"])
def get_rehearsals():
    history = load_json(REHEARSALS_FILE, [])
    return jsonify(history)


@app.route("/api/rehearsals", methods=["POST"])
def save_rehearsal():
    data = request.json or {}
    record_id = f"rehearsal_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    record = {
        "id": record_id,
        "timestamp": datetime.now().isoformat(),
        "scriptTitle": data.get("scriptTitle", "Free Speech"),
        "durationSeconds": data.get("durationSeconds", 0),
        "overallScore": data.get("overallScore", 0),
        "grade": data.get("grade", "N/A"),
        "metrics": {
            "wpm": data.get("wpm", 0),
            "pacingScore": data.get("pacingScore", 0),
            "stutterCount": data.get("stutterCount", 0),
            "stutterList": data.get("stutterList", []),
            "fillerCount": data.get("fillerCount", 0),
            "fillerBreakdown": data.get("fillerBreakdown", {}),
            "fluencyScore": data.get("fluencyScore", 0),
            "toneScore": data.get("toneScore", 0),
            "pitchVariabilityHz": data.get("pitchVariabilityHz", 0),
            "pitchMonotone": data.get("pitchMonotone", False),
            "expressionScore": data.get("expressionScore", 0),
            "smilePercentage": data.get("smilePercentage", 0),
            "eyeContactPercentage": data.get("eyeContactPercentage", 0),
            "scriptAccuracy": data.get("scriptAccuracy", 0),
        },
        "coachingTips": data.get("coachingTips", []),
        "timelineEvents": data.get("timelineEvents", []),
        "transcript": data.get("transcript", "")
    }

    history = load_json(REHEARSALS_FILE, [])
    history.insert(0, record)
    if len(history) > 50:
        history = history[:50]
    save_json(REHEARSALS_FILE, history)

    report_filename = f"report_{record_id}.md"
    report_path = os.path.join(REPORTS_DIR, report_filename)
    eye_contact = record["metrics"]["eyeContactPercentage"]
    eye_contact_text = f"{eye_contact}%" if eye_contact is not None else "N/A"
    try:
        with open(report_path, "w", encoding="utf-8") as rf:
            rf.write(f"# Rehearsal Performance Report: {record['scriptTitle']}\n\n")
            rf.write(f"- **Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            rf.write(f"- **Overall Score**: **{record['overallScore']}/100** (Grade: **{record['grade']}**)\n")
            rf.write(f"- **Duration**: {int(record['durationSeconds'])} seconds\n")
            rf.write(f"- **Pace**: {record['metrics']['wpm']} WPM (Pacing Score: {record['metrics']['pacingScore']}/100)\n")
            rf.write(f"- **Stutters Detected**: {record['metrics']['stutterCount']}\n")
            rf.write(f"- **Filler Words**: {record['metrics']['fillerCount']}\n")
            rf.write(f"- **Tone & Pitch Variety**: {record['metrics']['toneScore']}/100 (Monotone: {record['metrics']['pitchMonotone']})\n")
            rf.write(f"- **Facial Expression & Eye Contact**: {record['metrics']['expressionScore']}/100 (Eye Contact: {eye_contact_text})\n")
            rf.write(f"- **Script Accuracy**: {record['metrics']['scriptAccuracy']}%\n\n")
            rf.write("## Personalized Coaching Feedback\n")
            for tip in record["coachingTips"]:
                rf.write(f"- {tip}\n")
            rf.write("\n## Spoken Transcript\n")
            rf.write(f"> {record['transcript'] or '(No speech detected)'}\n")
    except Exception as e:
        print(f"Error generating markdown report: {e}")

    return jsonify({"success": True, "rehearsal": record, "reportFile": report_filename})


@app.route("/api/reports/<filename>", methods=["GET"])
def get_report(filename):
    return send_from_directory(REPORTS_DIR, filename, as_attachment=True)


if __name__ == "__main__":
    port = 5055
    print("\n" + "=" * 50)
    print("  SCRIPT REHEARSER & SPEAKER COACH")
    print(f"  Live Studio running at: http://127.0.0.1:{port}")
    print("=" * 50 + "\n")
    try:
        webbrowser.open(f"http://127.0.0.1:{port}")
    except Exception:
        pass
    app.run(host="127.0.0.1", port=port, debug=False)
