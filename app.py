from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from flask import Flask, flash, render_template, request, send_file
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret")

ALLOWED_INPUT_EXTENSIONS = {"m4a", "mp3", "mp4"}
ALLOWED_OUTPUT_FORMATS = {"mp3", "m4a", "wav", "mp4"}


def _is_ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "GET":
        return render_template("index.html", output_formats=sorted(ALLOWED_OUTPUT_FORMATS))

    if not _is_ffmpeg_available():
        flash("ffmpeg is not available on this machine. Please install ffmpeg first.")
        return render_template("index.html", output_formats=sorted(ALLOWED_OUTPUT_FORMATS)), 500

    upload = request.files.get("media")
    output_format = request.form.get("output_format", "").lower()

    if not upload or not upload.filename:
        flash("Please choose a file to upload.")
        return render_template("index.html", output_formats=sorted(ALLOWED_OUTPUT_FORMATS)), 400

    input_filename = secure_filename(upload.filename)
    input_ext = Path(input_filename).suffix.lower().lstrip(".")

    if input_ext not in ALLOWED_INPUT_EXTENSIONS:
        flash("Unsupported input format. Please upload a .m4a, .mp3, or .mp4 file.")
        return render_template("index.html", output_formats=sorted(ALLOWED_OUTPUT_FORMATS)), 400

    if output_format not in ALLOWED_OUTPUT_FORMATS:
        flash("Unsupported output format selected.")
        return render_template("index.html", output_formats=sorted(ALLOWED_OUTPUT_FORMATS)), 400

    with tempfile.TemporaryDirectory() as tmpdir:
        source_path = Path(tmpdir) / input_filename
        upload.save(source_path)

        output_name = f"{Path(input_filename).stem}_transcoded.{output_format}"
        output_path = Path(tmpdir) / output_name

        ffmpeg_cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(source_path),
            str(output_path),
        ]

        result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)

        if result.returncode != 0 or not output_path.exists():
            flash("Transcoding failed. Check that the input file is valid media.")
            return render_template("index.html", output_formats=sorted(ALLOWED_OUTPUT_FORMATS)), 500

        return send_file(output_path, as_attachment=True, download_name=output_name)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
