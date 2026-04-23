from __future__ import annotations

import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright


def main() -> None:
    parser = argparse.ArgumentParser(description="Capture a screenshot of the upload page.")
    parser.add_argument("--url", default="http://127.0.0.1:5000", help="App URL to capture")
    parser.add_argument(
        "--output",
        default="artifacts/upload-page.png",
        help="Output path for the screenshot file",
    )
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto(args.url, wait_until="networkidle")
        page.screenshot(path=str(output_path), full_page=True)
        browser.close()

    print(f"Screenshot written to {output_path}")


if __name__ == "__main__":
    main()
