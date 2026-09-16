#!/usr/bin/env python3
"""Isolated, bounded native layer-shell exercise. No live desktop changes."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
TARGET = Path(sys.argv[1]).resolve()
PIN = 'c668141e9c42b13c80c9ca4ea108e11708c5e8a5'
assert subprocess.check_output(['git','-C',str(TARGET),'rev-parse','HEAD'],text=True).strip() == PIN
OUT = ROOT/'test-results'/'native'
if OUT.exists(): shutil.rmtree(OUT)
OUT.mkdir(parents=True)
WORK = OUT/'harness'
WORK.mkdir()
for name in ['Commons','Ui']:
    shutil.copytree(TARGET/'shell'/name,WORK/name)
shutil.copytree(ROOT, WORK/'Plugin',ignore=shutil.ignore_patterns('.git','test-results','node_modules','__pycache__','.qt-*'))
shutil.copy(ROOT/'test/native/shell.qml',WORK/'shell.qml')
subprocess.run(['node',str(ROOT/'test/native/fixtures.mjs'),str(WORK/'fixtures.json')],check=True)
fixtures = json.loads((WORK/'fixtures.json').read_text())
(OUT/'provenance.json').write_text(json.dumps({'omarchy':PIN,'pluginHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'files':{str(p.relative_to(WORK/'Plugin')):hashlib.sha256(p.read_bytes()).hexdigest() for p in (WORK/'Plugin').rglob('*') if p.is_file()}},indent=2))
# AF_UNIX paths are limited to 108 bytes; keep runtime beside this clone.
runtime=ROOT.parent/'.r'; runtime.mkdir(mode=0o700, exist_ok=True)
home=OUT/'home'; home.mkdir()
(OUT/'sway.conf').write_text('output * mode 1200x900@60Hz\noutput * background #12171d solid_color\nseat * hide_cursor 100\nfocus_follows_mouse no\nxwayland disable\n')
env=dict(os.environ,XDG_RUNTIME_DIR=str(runtime),HOME=str(home),OMARCHY_PATH=str(TARGET),WLR_BACKENDS='headless',WLR_HEADLESS_OUTPUTS='1',WLR_RENDERER='pixman',QT_QUICK_BACKEND='software',QT_QPA_PLATFORM='wayland')
env.pop('WAYLAND_DISPLAY',None)
env.pop('SWAYSOCK',None)
processes=[]

def wait_for(check, seconds=12):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        value=check()
        if value: return value
        time.sleep(.1)
    raise AssertionError('Timed out waiting for native harness')

def run(*args):
    return subprocess.check_output(args,env=env,stderr=subprocess.STDOUT,text=True,timeout=10).strip()

def ipc(target,method,*args):
    return run('quickshell','ipc','-p',str(WORK/'shell.qml'),'call',target,method,*map(str,args))

def snapshot(): return json.loads(ipc('test','snapshot'))
def key(*keys):
    run('wtype',*sum((['-k',k] for k in keys),[])); time.sleep(.12)
def typed(text): run('wtype',text); time.sleep(.12)
def shot(name):
    time.sleep(.25)
    run('grim',str(OUT/(name+'.png')))

def equal_game(expected):
    actual=snapshot()['game']
    assert actual==expected, (actual, expected)
    cards = actual['deck'] + sum(actual['grid'], []) + actual['ploys'] + actual['spent'] + actual['shame'] + actual['queue']
    if actual['pending']: cards.append(actual['pending'])
    for royal in actual['royals']:
        if royal: cards += [royal['card']] + royal['armourCards']
    assert len(cards) == 54 and len({c['id'] for c in cards}) == 54

def action(id): ipc('test','action',id)

def check_inks():
    rendered = json.loads(ipc('test', 'inks'))
    red = {c['ink'] for c in rendered['cells'] if c['suit'] in ['H', 'D']}
    black = {c['ink'] for c in rendered['cells'] if c['suit'] in ['S', 'C']}
    assert len(red) == 1 and black == {rendered['neutral']} and red.isdisjoint(black), rendered
    if rendered['pending']:
        expected = red if rendered['pending']['suit'] in ['H', 'D'] else black
        assert rendered['hand'] in expected, rendered

try:
    with (OUT/'sway.log').open('w') as log:
        processes.append(subprocess.Popen(['sway','--unsupported-gpu','-c',str(OUT/'sway.conf')],env=env,stdout=log,stderr=subprocess.STDOUT))
    socket=wait_for(lambda:next((p for p in runtime.glob('wayland-*') if not p.name.endswith('.lock')),None))
    env['WAYLAND_DISPLAY']=socket.name
    env['SWAYSOCK']=str(next(runtime.glob('sway-ipc.*.sock')))
    # Keep a keyboard device on the otherwise input-less headless seat.
    processes.append(subprocess.Popen(['wtype','-s','60000'],env=env))
    with (OUT/'quickshell.log').open('w') as log:
        processes.append(subprocess.Popen(['quickshell','--no-color','-p',str(WORK/'shell.qml')],env=env,stdout=log,stderr=subprocess.STDOUT))
    wait_for(lambda:'Configuration Loaded' in (OUT/'quickshell.log').read_text())
    ipc('test','theme','dark')
    ipc('test','fixture','start')
    shot('closed-dark')
    ipc('geekkingcloud.gridcannon','open'); time.sleep(.25)
    shot('open-dark')
    check_inks()
    # Tab chooses Keep deal; Enter activates it through the real key catcher.
    key('Tab','Return'); equal_game(fixtures['states'][0])
    typed('d'); equal_game(fixtures['states'][1])
    ipc('test','click',11); equal_game(fixtures['states'][2])
    typed('dd'); equal_game(fixtures['states'][4])
    typed('5'); equal_game(fixtures['states'][5])
    typed('d'); equal_game(fixtures['states'][6])
    action(24); typed('5'); assert snapshot()['source']==4
    shot('ploy-source')
    ipc('geekkingcloud.gridcannon','close'); ipc('geekkingcloud.gridcannon','open'); time.sleep(.2)
    assert snapshot()['source']==4; equal_game(fixtures['states'][6])
    typed('9'); equal_game(fixtures['states'][7])
    shot('suspended-hand')
    check_inks()
    a=fixtures['actions'][8]; action(a['index']+9); equal_game(fixtures['states'][8])
    a=fixtures['actions'][9]; action(a['index']+9); equal_game(fixtures['states'][9])
    shot('armour-resolved')
    saved=snapshot()['game']
    key('Escape'); assert not snapshot()['opened']
    ipc('geekkingcloud.gridcannon','open'); time.sleep(.2)
    equal_game(saved)
    typed('n'); assert snapshot()['confirmation']=='revised'
    key('Escape'); equal_game(saved)
    action(28); key('Tab','Return'); assert snapshot()['game']['mode']=='classic'
    action(28); typed('y'); assert snapshot()['game']['mode']=='revised'
    typed('?'); assert snapshot()['help']; shot('rules'); key('Escape')
    for name, control, gridkey, expected in [
        ('extract',23,'5','extracted'), ('blockedClassic',25,'5','reset'),
        ('emptyClassic',26,'1','refilled'), ('victory',None,'7','won'),
        ('start',None,'1','replacement')]:
        ipc('test','fixture',name)
        if control is not None: action(control)
        typed(gridkey); equal_game(fixtures[expected])
        shot(expected)
    ipc('test','fixture','start')
    ipc('test','theme','light'); shot('open-light-live')
    check_inks()
    ipc('geekkingcloud.gridcannon','close'); shot('closed-light-live')
    ipc('geekkingcloud.gridcannon','open'); time.sleep(.2)
    ipc('test','theme','mono'); shot('open-mono-live')
    check_inks()
    for orientation in ['bottom','left','right','top']:
        ipc('geekkingcloud.gridcannon','close')
        ipc('test','orientation',orientation)
        ipc('geekkingcloud.gridcannon','open'); time.sleep(.2)
        shot('orientation-'+orientation)
        key('Escape'); assert not snapshot()['opened']
    ipc('test','scale',18)
    ipc('geekkingcloud.gridcannon','open'); shot('large-font')
    output=json.loads(run('swaymsg','-t','get_outputs'))[0]['name']
    run('swaymsg',f'output {output} mode 800x600'); time.sleep(.2)
    key('Tab','Tab','Tab','Tab'); assert snapshot()['cursor']==29
    shot('small-large-font-focus-scroll')
    key('Return'); assert snapshot()['help']; key(*(['Down']*8)); shot('small-help-scroll'); key('Escape')
    log=(OUT/'quickshell.log').read_text()
    assert 'ERROR' not in log and 'TypeError' not in log and 'ReferenceError' not in log,log
    print('NATIVE_PASS: real Qt/Wayland game, softlock cycle/restore/armour, keyboard, lifecycle, modes, live themes, four bar orientations')
    (OUT/'result.txt').write_text('NATIVE_PASS\n')
finally:
    for p in reversed(processes):
        p.terminate()
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:p.kill(); p.wait()
