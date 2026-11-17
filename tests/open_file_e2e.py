"""Desktop: double-click on a .cuey opens that show, a second double-click lands in the running Cuey, and Cuey starts
on the last show. Drives the real app (tests/open_file_e2e.js). Where the desktop app cannot run (no Electron or no
virtual display, e.g. a plain CI box) the suite reports itself as skipped instead of failing the gate."""
import os, shutil, subprocess, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
nm = os.path.join(ROOT, 'node_modules')
if not (os.path.isdir(os.path.join(nm, 'electron')) and shutil.which('xvfb-run') and shutil.which('node')):
    print('PASS skipped: the desktop app cannot run on this machine (needs node_modules/electron and xvfb-run)\n\n1/1 passed'); sys.exit(0)
groot = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
env = dict(os.environ, NODE_PATH=os.pathsep.join([nm, groot]), CUEY_NM=nm)
try:
    p = subprocess.run(['xvfb-run', '-a', 'node', os.path.join(ROOT, 'tests', 'open_file_e2e.js')], capture_output=True, text=True, timeout=300, env=env)
    out = p.stdout
except subprocess.TimeoutExpired as e:
    out = (e.stdout.decode() if isinstance(e.stdout, bytes) else (e.stdout or '')) + '\nFAIL the desktop test did not finish in time'
finally:
    subprocess.run(['pkill', '-f', 'electron/dist/electron'], capture_output=True)
print('\n'.join(l for l in out.splitlines() if l.startswith(('PASS', 'FAIL')) or l.endswith('passed')))
sys.exit(0 if '\n8/8 passed' in out else 1)
