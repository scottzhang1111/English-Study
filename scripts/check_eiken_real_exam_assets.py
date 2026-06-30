import argparse
import os
import re
import urllib.parse
from collections import Counter
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
MEDIA_EXTENSIONS = ('.mp3', '.png', '.gif', '.jpg', '.jpeg', '.css', '.js')

LEVELS = {
    'eiken_pre2': {
        'resource_root': Path('data/eiken/eiken real exam pre2/Listening/www.cloudsemi.com/member/eiken/eikenj2'),
        'search_roots': [
            Path('data/eiken/eiken real exam pre2/Listening/www.cloudsemi.com/member/eiken/eikenj2'),
            Path('data/eiken/eiken real exam pre2/Listening'),
            Path('data/eiken/eiken real exam pre2/Listening/www.cloudsemi.com/member/eiken/eikenj2'),
            Path('data/eiken/eiken real exam pre2'),
        ],
    },
    'eiken3': {
        'resource_root': Path('data/eiken/eiken real exam 3/English eiken 3/www.cloudsemi.com/member/eiken/eiken3'),
        'search_roots': [
            Path('data/eiken/eiken real exam 3/English eiken 3/www.cloudsemi.com/member/eiken/eiken3'),
            Path('data/eiken/eiken real exam 3/English eiken 3'),
            Path('data/eiken/eiken real exam 3/English eiken 3/www.cloudsemi.com/member/eiken/eiken3'),
            Path('data/eiken/eiken real exam 3/cloudsemi_eiken3/listening_problems'),
            Path('data/eiken/eiken real exam 3/cloudsemi_eiken3/written_problems'),
        ],
    },
}

ATTR_RE = re.compile(r'\b(?:src|href)\s*=\s*["\']([^"\']+)["\']', re.I)
MEDIA_RE = re.compile(r'(?P<path>[^"\'()<>\s]+?\.(?:mp3|png|gif|jpe?g|css|js))(?:[?#][^"\'()<>\s]*)?', re.I)


def clean_asset_ref(value):
    value = html_unescape(str(value or '').strip())
    if not value or re.match(r'^(?:https?:|data:|mailto:|javascript:|#)', value, flags=re.I):
        return ''
    value = value.split('#', 1)[0].split('?', 1)[0]
    value = urllib.parse.unquote(value).replace('\\', '/').lstrip('/')
    while value.startswith('./'):
        value = value[2:]
    value = os.path.normpath(value).replace('\\', '/')
    if value in {'', '.'} or value.startswith('../') or os.path.isabs(value):
        return ''
    return value if value.lower().endswith(MEDIA_EXTENSIONS) else ''


def html_unescape(value):
    return (
        value.replace('&amp;', '&')
        .replace('&quot;', '"')
        .replace('&#34;', '"')
        .replace('&#39;', "'")
        .replace('&apos;', "'")
    )


def candidate_paths(asset_ref):
    basename = Path(asset_ref).name
    candidates = [
        asset_ref,
        basename,
        f'mp3/{basename}',
        f'png/{basename}',
        f'images/{basename}',
        f'audio/{basename}',
        f'js/{basename}',
        f'css/{basename}',
    ]
    return list(dict.fromkeys(path for path in candidates if path and path != '.'))


def asset_exists(asset_ref, search_roots):
    searched = []
    for root in dict.fromkeys(search_roots):
        absolute_root = REPO_ROOT / root
        for candidate in candidate_paths(asset_ref):
            path = absolute_root / candidate
            searched.append(path)
            if path.is_file():
                return True, path, searched
    return False, None, searched


def extract_references(html_text):
    refs = []
    for match in ATTR_RE.finditer(html_text):
        ref = clean_asset_ref(match.group(1))
        if ref:
            refs.append(ref)
    for match in MEDIA_RE.finditer(html_text):
        ref = clean_asset_ref(match.group('path'))
        if ref:
            refs.append(ref)
    return refs


def scan_level(level, config):
    resource_root = REPO_ROOT / config['resource_root']
    html_files = sorted(resource_root.rglob('*.html')) if resource_root.is_dir() else []
    references = []
    for html_file in html_files:
        try:
            html_text = html_file.read_text(encoding='utf-8', errors='ignore')
        except OSError:
            continue
        references.extend(extract_references(html_text))

    counts = Counter(references)
    existing = []
    missing = []
    for asset_ref in sorted(counts):
        exists, found_path, _searched = asset_exists(asset_ref, config['search_roots'])
        if exists:
            existing.append((asset_ref, found_path))
        else:
            missing.append(asset_ref)

    print(f'\n[{level}]')
    print(f'resource_root: {resource_root}')
    print(f'html files scanned: {len(html_files)}')
    print(f'total referenced assets: {len(counts)} unique ({sum(counts.values())} occurrences)')
    print(f'existing assets: {len(existing)}')
    print(f'missing assets: {len(missing)}')
    print(f'mp3 directory exists: {(resource_root / "mp3").is_dir()}')
    print(f'png directory exists: {(resource_root / "png").is_dir()}')
    if missing:
        print('first 50 missing files:')
        for asset_ref in missing[:50]:
            print(f'  - {asset_ref}')

    return {
        'level': level,
        'html_files': len(html_files),
        'referenced': len(counts),
        'occurrences': sum(counts.values()),
        'existing': len(existing),
        'missing': len(missing),
    }


def main():
    parser = argparse.ArgumentParser(description='Check Eiken real exam HTML media references against local assets.')
    parser.add_argument('--level', choices=sorted(LEVELS), help='Only scan one level.')
    args = parser.parse_args()

    selected = {args.level: LEVELS[args.level]} if args.level else LEVELS
    summaries = [scan_level(level, config) for level, config in selected.items()]

    print('\nSummary')
    for item in summaries:
        print(
            f"{item['level']}: {item['existing']}/{item['referenced']} unique assets exist "
            f"({item['missing']} missing, {item['occurrences']} references)"
        )


if __name__ == '__main__':
    main()
