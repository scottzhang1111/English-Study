import re
import time
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


BASE_URL = "https://www.cloudsemi.com/member/eiken/eiken3/"
INDEX_URL = urljoin(BASE_URL, "eiken3.html")

OUTPUT_DIR = Path("cloudsemi_eiken3")
LISTENING_PROBLEM_DIR = OUTPUT_DIR / "listening_problems"
LISTENING_ANSWER_DIR = OUTPUT_DIR / "listening_answers"
WRITTEN_PROBLEM_DIR = OUTPUT_DIR / "written_problems"
WRITTEN_ANSWER_DIR = OUTPUT_DIR / "written_answers"

for directory in [
    LISTENING_PROBLEM_DIR,
    LISTENING_ANSWER_DIR,
    WRITTEN_PROBLEM_DIR,
    WRITTEN_ANSWER_DIR,
]:
    directory.mkdir(parents=True, exist_ok=True)

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
}


def get_html(url: str) -> str:
    response = requests.get(url, headers=headers, timeout=20)
    response.raise_for_status()
    response.encoding = response.apparent_encoding
    return response.text


def collect_pages():
    index_html = get_html(INDEX_URL)
    soup = BeautifulSoup(index_html, "lxml")

    listening_pages = set()
    written_pages = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]

        # Listening: 2025-3_1.html
        if re.match(r"\d{4}-\d+_\d+\.html$", href):
            listening_pages.add(href)

        # Written: 2025-3h_1.html
        if re.match(r"\d{4}-\d+h_\d+\.html$", href):
            written_pages.add(href)

    return listening_pages, written_pages


def download_pair(problem_href: str, problem_dir: Path, answer_dir: Path, label: str):
    problem_url = urljoin(BASE_URL, problem_href)
    answer_href = "ans" + problem_href
    answer_url = urljoin(BASE_URL, answer_href)

    try:
        problem_html = get_html(problem_url)
        (problem_dir / problem_href).write_text(problem_html, encoding="utf-8")
        print(f"{label} problem OK: {problem_href}")

        time.sleep(0.5)

        answer_html = get_html(answer_url)
        (answer_dir / answer_href).write_text(answer_html, encoding="utf-8")
        print(f"{label} answer OK: {answer_href}")

        time.sleep(0.5)

    except Exception as exc:
        print(f"{label} NG: {problem_href} -> {exc}")


def main():
    listening_pages, written_pages = collect_pages()

    print(f"Found listening pages: {len(listening_pages)}")
    print(f"Found written pages: {len(written_pages)}")

    for href in sorted(listening_pages):
        download_pair(
            href,
            LISTENING_PROBLEM_DIR,
            LISTENING_ANSWER_DIR,
            "Listening",
        )

    for href in sorted(written_pages):
        download_pair(
            href,
            WRITTEN_PROBLEM_DIR,
            WRITTEN_ANSWER_DIR,
            "Written",
        )

    print("Done.")


if __name__ == "__main__":
    main()
