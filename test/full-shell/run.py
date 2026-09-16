#!/usr/bin/env python3
"""Real pinned shell lifecycle and compositor-pointer smoke; never a live install.

Usage: python3 test/full-shell/run.py OMARCHY_CHECKOUT VIRTUAL_POINTER_XML
The XML is wlr-protocols/unstable/wlr-virtual-pointer-unstable-v1.xml.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import select
import shutil
import subprocess
import sys
import time
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
TARGET = Path(sys.argv[1]).resolve()
PROTOCOL = Path(sys.argv[2]).resolve()
PIN = 'c668141e9c42b13c80c9ca4ea108e11708c5e8a5'
ID = 'geekkingcloud.gridcannon'
FILES = ['manifest.json', 'BarWidget.qml', 'CannonButton.qml', 'engine.mjs']
assert subprocess.check_output(['git', '-C', str(TARGET), 'rev-parse', 'HEAD'], text=True).strip() == PIN
assert not subprocess.check_output(['git', '-C', str(TARGET), 'status', '--porcelain'], text=True).strip(), 'Use a clean pinned upstream checkout'
OUT = ROOT/'test-results/full-shell'
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
HOME = OUT/'home'
CONFIG = HOME/'.config/omarchy'
CONFIG.mkdir(parents=True)
THEME = HOME/'.local/state/omarchy/current/theme'
THEME.mkdir(parents=True)
# Omitted built-ins default to enabled in this release. Explicitly disable all
# but the bar: do not run idle, lock, polkit, networking or desktop services.
disabled = [json.loads(p.read_text())['id'] for p in (TARGET/'shell/plugins').rglob('manifest.json')]
disabled.remove('omarchy.bar')
(CONFIG/'shell.json').write_text(json.dumps({'version': 1, 'plugins': [], 'disabledPlugins': disabled,
    'bar': {'position': 'top', 'transparent': False, 'layout': {'left': [], 'center': [], 'right': []}}}))
(CONFIG/'shell.toml').write_text('')
(THEME/'colors.toml').write_text('background = "#101820"\nforeground = "#e0eeee"\naccent = "#55eebb"\n')
(THEME/'shell.toml').write_text('')
# Keep UNIX socket names short, and every artifact under this checkout's parent.
runtime = ROOT.parent/'.f'
runtime.mkdir(mode=0o700)
env = dict(os.environ, HOME=str(HOME), XDG_CONFIG_HOME=str(HOME/'.config'),
    XDG_CACHE_HOME=str(HOME/'.cache'), XDG_DATA_HOME=str(HOME/'.local/share'),
    XDG_STATE_HOME=str(HOME/'.local/state'), XDG_RUNTIME_DIR=str(runtime),
    OMARCHY_PATH=str(TARGET), PATH=str(TARGET/'bin')+':'+os.environ['PATH'],
    WLR_BACKENDS='headless', WLR_HEADLESS_OUTPUTS='1', WLR_RENDERER='pixman',
    QT_QUICK_BACKEND='software', QT_QPA_PLATFORM='wayland',
    DBUS_SESSION_BUS_ADDRESS='unix:path='+str(runtime/'absent-bus'),
    DBUS_SYSTEM_BUS_ADDRESS='unix:path='+str(runtime/'absent-system-bus'))
for k in ['WAYLAND_DISPLAY', 'SWAYSOCK', 'HYPRLAND_INSTANCE_SIGNATURE', 'DISPLAY']:
    env.pop(k, None)
processes = []
transcript = []

def run(*args):
    result = subprocess.check_output(list(map(str, args)), env=env, stderr=subprocess.STDOUT, text=True, timeout=12).strip()
    transcript.append({'argv': list(map(str, args)), 'output': result})
    return result

def start(*args, **kw):
    p = subprocess.Popen(list(map(str, args)), env=env, **kw)
    processes.append(p)
    return p

def wait(check, seconds=12):
    end = time.monotonic()+seconds
    while time.monotonic() < end:
        result = check()
        if result:
            return result
        time.sleep(.1)
    raise AssertionError('Timed out waiting for full-shell condition')

def ipc(target, method, *args):
    return run('omarchy-shell', target, method, *args)

def plugins():
    return json.loads(ipc('shell', 'listPlugins'))

def entries():
    return [p for p in json.loads(ipc('shell', 'debugBarGeometry')) if p['id'] == ID]

def shot(name):
    time.sleep(.35)
    path = OUT/(name+'.png')
    run('grim', path)
    return Image.open(path).convert('RGB')

def pixels(image):
    # Ignore bar, cursor parked bottom-left, and compositor background.
    return image.crop((625, 31, 1195, 600))

def changed(a, b):
    return ImageChops.difference(pixels(a), pixels(b)).getbbox() is not None

try:
    run('wayland-scanner', 'client-header', PROTOCOL, OUT/'pointer.h')
    run('wayland-scanner', 'private-code', PROTOCOL, OUT/'pointer-protocol.c')
    flags = run('pkg-config', '--cflags', '--libs', 'wayland-client').split()
    run('cc', ROOT/'test/full-shell/pointer.c', OUT/'pointer-protocol.c', '-I'+str(OUT), '-o', OUT/'pointer', *flags)
    (OUT/'sway.conf').write_text('output * mode 1200x900@60Hz\nfocus_follows_mouse no\nxwayland disable\n')
    start('sway', '--unsupported-gpu', '-c', OUT/'sway.conf', stdout=(OUT/'sway.log').open('w'), stderr=subprocess.STDOUT)
    socket = wait(lambda: next((p for p in runtime.glob('wayland-*') if not p.name.endswith('.lock')), None))
    env['WAYLAND_DISPLAY'] = socket.name
    env['SWAYSOCK'] = str(wait(lambda: next(runtime.glob('sway-ipc.*.sock'), None)))
    start('wtype', '-s', '120000')  # retain keyboard focus on the empty seat
    pointer = start(OUT/'pointer', stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    assert pointer.stdout is not None and pointer.stdin is not None

    def response(expected):
        assert pointer.stdout is not None
        assert select.select([pointer.stdout], [], [], 3)[0], 'Virtual pointer timed out'
        assert pointer.stdout.readline().strip() == expected

    response('ready')

    def point(x, y, button=2):
        assert pointer.stdin is not None
        pointer.stdin.write(f'{x} {y} {button}\n')
        pointer.stdin.flush()
        response('ok')
        time.sleep(.08)

    def click(x, y):
        point(x, y)
        point(x, y, 1)
        point(x, y, 0)
        point(1, 899)

    shell = start('quickshell', '--no-color', '-p', TARGET/'shell', stdout=(OUT/'shell.log').open('w'), stderr=subprocess.STDOUT)
    wait(lambda: 'Configuration Loaded' in (OUT/'shell.log').read_text())
    assert ipc('shell', 'ping') == 'ok'
    wait(lambda: len(plugins()) > 1 and not any(p['enabled'] and p['id'] != 'omarchy.bar' for p in plugins()))
    point(1, 899)
    blank = shot('01-before-install')
    install = CONFIG/'plugins'/ID
    install.mkdir(parents=True)
    for name in FILES:
        shutil.copy(ROOT/name, install/name)
        assert (ROOT/name).read_bytes() == (install/name).read_bytes()
    run('omarchy-plugin-validate', install)
    ipc('shell', 'rescanPlugins')
    wait(lambda: any(p['id'] == ID for p in plugins()))
    run('omarchy-plugin-enable', ID)
    wait(lambda: len(entries()) == 1 and entries()[0]['visible'])
    run('omarchy-plugin-enable', ID)  # idempotent: no duplicate bar entry
    assert len(entries()) == 1
    geometry = entries()[0]
    (OUT/'bar-geometry.json').write_text(json.dumps(geometry, indent=2))
    closed = shot('02-enabled-bar')
    bx, by = int(geometry['x']+geometry['width']/2), int(geometry['y']+geometry['height']/2)
    click(bx, by)
    opening = shot('03-pointer-open')
    assert changed(closed, opening), 'Compositor pointer did not open panel'
    # Random initial deals may queue royals before the optional replacement.
    # Resolve only highlighted royal slots through compositor clicks; do not
    # inject fixtures or add a diagnostic API to the production plugin.
    royal_edges = [(749,74),(857,74),(965,74),(1073,143),(1073,212),(1073,281),
                   (965,350),(857,350),(749,350),(641,281),(641,212),(641,143)]
    def deploy_queued(image, prefix):
        for i in range(13):
            legal = [(x,y) for x,y in royal_edges if image.getpixel((x,y)) == (85,238,187) and image.getpixel((x+3,y+3)) == (16,24,32)]
            if not legal:
                return image
            x,y = legal[0]
            click(x+50,y+30)
            image = shot(f'{prefix}-royal-{i}')
        raise AssertionError('Royal placement did not terminate')
    opening = deploy_queued(opening, 'opening')
    assert opening.getpixel((749,143)) == (85,238,187), 'Expected optional replacement stage'
    # Actual first grid cell, not a QtTest event or internal activate() call.
    click(800, 175)
    played = shot('04-pointer-replacement')
    assert changed(opening, played), 'Grid click did not change the opening'
    played = deploy_queued(played, 'replacement')
    run('wtype', 'd')
    drawn = shot('05-keyboard-draw')
    assert changed(played, drawn), 'Keyboard draw did not change state'
    run('wtype', '-k', 'Escape')
    hidden = shot('06-escape-closed')
    assert not changed(closed, hidden), 'Escape left a popup behind'
    # Enter through real bar coordinator rather than the plugin's own IPC.
    assert ipc('shell', 'togglePanelAt', 'right', '1') == ID
    reopened = shot('07-coordinator-reopen')
    assert not changed(drawn, reopened), 'Close/reopen changed the rendered game'
    # This file really is watched; theme colors.toml itself is startup-only.
    (CONFIG/'shell.toml').write_text('[popups]\nbackground = "#202830"\n')
    time.sleep(.5)
    override = shot('08-watched-user-theme-file')
    assert override.getpixel((630, 50)) == (32, 40, 48), 'Watched popup colour did not update'
    (CONFIG/'shell.toml').write_text('')
    time.sleep(.5)
    colors = 'background = "#f2f4f5"\nforeground = "#17212b"\naccent = "#006c70"\n'
    (THEME/'colors.toml').write_text(colors)
    # Same payload path used by omarchy-theme-set, without its unrelated host changes.
    assert ipc('shell', 'applyTheme', base64.b64encode(colors.encode()).decode(), '') == 'ok'
    light = shot('09-live-light-theme')
    assert light.getpixel((630, 50)) == (242, 244, 245)
    assert ipc('shell', 'togglePanelAt', 'right', '1') == ID
    light_closed = shot('10-light-bar')
    click(bx, by)
    assert changed(light_closed, shot('11-light-pointer-reopen'))
    run('omarchy-plugin-disable', ID)
    wait(lambda: not entries())
    assert not next(p for p in plugins() if p['id'] == ID)['enabled']
    assert not changed(blank, shot('12-disabled'))
    assert 'Target not found.' in run('quickshell', 'ipc', '-p', TARGET/'shell', 'call', ID, 'open')
    run('omarchy-plugin-enable', ID)
    wait(lambda: len(entries()) == 1)
    ipc(ID, 'open')
    shot('13-reenabled-new-session')
    run('omarchy-plugin-remove', ID, '--yes')
    wait(lambda: not any(p['id'] == ID for p in plugins()))
    assert not install.exists() and not entries()
    config = json.loads(ipc('shell', 'listShellConfig'))
    assert ID not in json.dumps(config), 'Removed plugin remains in active config'
    assert not changed(blank, shot('14-removed'))
    assert 'Target not found.' in run('quickshell', 'ipc', '-p', TARGET/'shell', 'call', ID, 'open')
    # Upstream intentionally keeps a hidden backup for copied local plugins.
    assert len(list((CONFIG/'plugins').glob('.'+ID+'.bak.*'))) == 1
    log = (OUT/'shell.log').read_text()
    assert not any(token in log for token in ['ERROR', 'TypeError', 'ReferenceError', 'failed to load']), log
    (OUT/'provenance.json').write_text(json.dumps({'omarchy': PIN,
        'pluginHead': run('git', '-C', ROOT, 'rev-parse', 'HEAD'),
        'productionSha256': {f: hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in FILES},
        'pointerProtocolSha256': hashlib.sha256(PROTOCOL.read_bytes()).hexdigest(),
        'limitations': ['headless Sway, not target Hyprland hardware', 'software renderer', 'other desktop services disabled', 'no touch or monitor scaling test']}, indent=2))
    (OUT/'result.txt').write_text('FULL_SHELL_PASS\n')
    print('FULL_SHELL_PASS: exact shell registry, enable, compositor pointer, keyboard, reopen pixels, real theme file/IPC, disable/remove')
finally:
    for p in reversed(processes):
        p.terminate()
        try:
            p.wait(timeout=5)
        except subprocess.TimeoutExpired:
            p.kill()
            p.wait()
    assert all(p.poll() is not None for p in processes)
    (OUT/'cleanup.json').write_text(json.dumps({'ownedProcesses': [{'pid': p.pid, 'returncode': p.returncode} for p in processes], 'allStopped': True}, indent=2))
    (OUT/'transcript.json').write_text(json.dumps(transcript, indent=2))
    shutil.rmtree(runtime)
