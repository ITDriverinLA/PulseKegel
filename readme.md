# PulseKegel

Simple Flask web app that accepts an uploaded `.m4a`, `.mp3`, or `.mp4` file and transcodes it with `ffmpeg`.

## Requirements

- Python 3.10+
- `ffmpeg` installed and available on your PATH

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000` and upload a file.

## Notes

- Input formats allowed: `.m4a`, `.mp3`, `.mp4`
- Output formats available: `mp3`, `m4a`, `wav`, `mp4`

## Optional: automated screenshot of upload page

You can capture a screenshot of the upload page with Playwright.

```bash
# in the same virtual environment
pip install -r requirements-dev.txt
python -m playwright install chromium
python scripts/screenshot_upload_page.py --url http://127.0.0.1:5000 --output artifacts/upload-page.png
```

The screenshot is written to `artifacts/upload-page.png` by default.
