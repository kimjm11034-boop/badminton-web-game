"""Complete underrepresented action/camera cells with source-image landmark detections."""
import collections
import json
import random
import zipfile
from contextlib import ExitStack
from pathlib import Path

import cv2
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from prepare import CACHE, ROOT, TRAIN_DIR, VAL_DIR, LABELS, get_labels, read_image, estimate


def archives():
    return sorted(TRAIN_DIR.rglob('TS*.zip')) + sorted(VAL_DIR.rglob('VS*.zip'))


def tokens(member):
    return Path(member).stem.split('_')


def official():
    for path in sorted(VAL_DIR.rglob('VL*.zip')):
        for name, players in get_labels(path).items():
            for player in players:
                points = np.array([player['keypoint'][k] for k in LABELS])
                if min(points[:, 2]) > 0 and np.mean(points[:, 2] == 2) >= .65:
                    yield name, points[:, :2], player['bbox']


def records(extra=False):
    files = ['samples', 'moving-pairs']
    if extra:
        files.append('catalog-extra')
    for name in files:
        with (CACHE / (name + '.jsonl')).open(encoding='utf8') as f:
            for line in f:
                yield json.loads(line)


def main():
    cv2.setNumThreads(1)
    cells = collections.defaultdict(list)
    count = collections.Counter()
    per_source = collections.Counter()
    with ExitStack() as stack:
        zips = {p.name: stack.enter_context(zipfile.ZipFile(p)) for p in archives()}
        for source, archive in zips.items():
            for name in archive.namelist():
                t = tokens(name)
                cells[t[8], t[4]].append((source, name))
        for name, _, _ in official():
            t = tokens(name)
            count[t[8], t[4]] += 1
        for r in records():
            t = tokens(r['member'])
            count[t[8], t[4]] += 1
            per_source[r['source'], t[8]] += 1
        options = vision.PoseLandmarkerOptions(base_options=python.BaseOptions(
            model_asset_buffer=(ROOT / '.cache/pose/pose_landmarker.task').read_bytes()),
            num_poses=4, min_pose_detection_confidence=.36)
        model = stack.enter_context(vision.PoseLandmarker.create_from_options(options))
        out = stack.enter_context((CACHE / 'catalog-extra.jsonl').open('w', encoding='utf8'))
        rng = random.Random(217)
        visited = set()
        for cell, items in sorted(cells.items(), key=lambda c: (count[c[0]], c[0])):
            rng.shuffle(items)
            by_source = collections.defaultdict(list)
            for item in items:
                by_source[item[0]].append(item)
            # Rare camera/action combinations are exhausted if no eligible player is found.
            for source, members in sorted(by_source.items(), key=lambda pair: len(pair[1])):
                for _, name in members:
                    if count[cell] >= 4 and per_source[source, cell[0]] >= 3:
                        break
                    if name in visited:
                        continue
                    visited.add(name)
                    img = read_image(zips[source], name)
                    h, w = img.shape[:2]
                    found = []
                    for x, y, b, r in [(.07,.19,.94,.96),(.05,.25,.56,.95),(.44,.25,.96,.95),
                                      (.19,.14,.74,.69),(.02,.10,.54,.63),(.48,.10,.99,.63)]:
                        rect = [round(w*x), round(h*y), round(w*b), round(h*r)]
                        for pose in estimate(model, img, rect):
                            p = np.array(pose['uv'])
                            hip = p[6:8].mean(0)
                            height = np.ptp(p[:12, 1])
                            if height < h*.055 or not h*.22 < hip[1] < h*.90:
                                continue
                            if any(np.linalg.norm(hip-k) < .22*height for k in found):
                                continue
                            found.append(hip)
                            row = {**pose, 'member': name, 'source': source, 'rect': rect}
                            out.write(json.dumps(row, separators=(',', ':')) + '\n')
                            count[cell] += 1
                            per_source[source, cell[0]] += 1
                        if found:
                            break
                    out.flush()
            print(*cell, count[cell], flush=True)


if __name__ == '__main__':
    main()
