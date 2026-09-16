#!/usr/bin/env python3
"""Real Qt JS parity; fail on missing pass marker, QML errors or mismatch."""
import os
from pathlib import Path
import selectors
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]

def qt_run(work):
    env = dict(os.environ, QT_QPA_PLATFORM='offscreen')
    env.pop('WAYLAND_DISPLAY', None)
    p = subprocess.Popen(['quickshell', '--no-color', '-p', str(work / 'Parity.qml')],
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
    lines = []
    try:
        selector = selectors.DefaultSelector()
        selector.register(p.stdout, selectors.EVENT_READ)
        end = time.monotonic() + 45
        while time.monotonic() < end:
            if not selector.select(1):
                if p.poll() is not None: break
                continue
            line = p.stdout.readline()
            if not line: break
            lines.append(line)
            if 'QT_PASS' in line or 'QT_FAIL' in line: break
        output = ''.join(lines)
        print(output)
        return 'QT_PASS' in output and 'QT_FAIL' not in output and 'ERROR:' not in output
    finally:
        p.terminate()
        try: p.wait(timeout=5)
        except subprocess.TimeoutExpired: p.kill(); p.wait()

with tempfile.TemporaryDirectory(prefix='.qt-', dir=ROOT) as temp:
    work = Path(temp)
    subprocess.run(['node', str(ROOT/'test/qt/generate.mjs'), temp], check=True)
    subprocess.run(['node', str(work/'run.mjs')], check=True)
    shutil.copy(ROOT/'engine.mjs', work/'engine.mjs')
    shutil.copy(ROOT/'test/qt/Parity.qml', work/'Parity.qml')
    if not qt_run(work): sys.exit(1)
    if '--mutation' in sys.argv:
        engine = (work/'engine.mjs').read_text()
        (work/'engine.mjs').write_text(engine.replace('kills(s) === 12', 'kills(s) === 13'))
        if qt_run(work):
            sys.exit('Mutation unexpectedly passed')
        print('MUTATION_REJECTED: twelfth-kill regression failed real Qt parity')
