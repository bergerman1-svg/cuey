"""Release gate: runs every Cuey test and fails (exit 1) if any check fails or a suite crashes.
Test media: tests/fixtures. Outputs (screenshots, suite_result.json) go to the current folder.
    python3 tests/run_all.py"""
import os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SUITES = ['feature_suite.py', 'browser_suite.py', 'share_e2e.py', 'save_media_e2e.py', 'desktop_google_e2e.py', 'site_outcomes.py', 'fade_e2e.py', 'freeze_e2e.py', 'replay_e2e.py']
bad = []
for s in SUITES:
    for attempt in (1, 2):  # a suite that CRASHED before reporting (test-harness bug, e.g. Playwright's WebSocket stand-in) gets one more run; a FAIL never does
        p = subprocess.run([sys.executable, os.path.join(HERE, s)], capture_output=True, text=True, timeout=1800)
        out = p.stdout + p.stderr
        m = re.findall(r'^(\d+)/(\d+) passed$', out, re.M)
        if m or attempt == 2: break
        print(f'     {s}: crashed before reporting — running it once more')
    fails = [l for l in out.splitlines() if l.startswith('FAIL ')]
    ok = bool(m) and m[-1][0] == m[-1][1] and not fails
    print(f"{'OK  ' if ok else 'RED '} {s}: {m[-1][0] + '/' + m[-1][1] if m else 'no result'}")
    for l in fails[:20]: print('     ' + l[:300])
    if not ok:
        bad.append(s)
        if not m: print(out[-2000:])
print('\nRELEASE GATE:', 'GREEN' if not bad else 'RED — ' + ', '.join(bad))
sys.exit(1 if bad else 0)
