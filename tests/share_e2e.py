"""End-to-end share-screen test with a local stand-in for ntfy.sh (the real one isn't reachable here).
App (signed-in mock) shares -> the screen page /s/?c=CODE connects over WebRTC -> GO -> the screen shows the cue."""
import asyncio, json, os, re, sys
from playwright.async_api import async_playwright
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
HERE = FIX
APP = 'file://' + ROOT + '/app/cuey.html?nosplash&notour'
SCREEN = 'file://' + ROOT + '/docs/s/index.html'
res = []
def ok(n, c, extra=''):
    res.append(c); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)) if extra and not c else ''))

subs = {}   # topic -> list of ws routes
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'])
        ctx = await b.new_context()
        posts = []
        async def on_post(route):
            req = route.request
            m = re.search(r'ntfy\.sh/([^/?]+)', req.url)
            topic = m.group(1); body = req.post_data or ''
            posts.append((topic, body))
            msg = json.dumps({'event': 'message', 'topic': topic, 'message': body})
            for ws in list(subs.get(topic, [])):
                try: ws.send(msg)
                except Exception: pass
            await route.fulfill(status=200, body='{}', headers={'access-control-allow-origin': '*'})
        await ctx.route(re.compile(r'https://ntfy\.sh/.*'), on_post)
        def on_ws(ws):
            topic = re.search(r'ntfy\.sh/([^/]+)/ws', ws.url).group(1)
            subs.setdefault(topic, []).append(ws)
            ws.send(json.dumps({'event': 'open', 'topic': topic}))
            ws.on_close(lambda *a: subs.get(topic, []).remove(ws) if ws in subs.get(topic, []) else None)
        await ctx.route_web_socket(re.compile(r'wss://ntfy\.sh/.*'), on_ws)

        app = await ctx.new_page(); errs = []
        app.on('pageerror', lambda e: errs.append(str(e)))
        await app.goto(APP); await app.wait_for_timeout(800)
        # code generator
        codes = await app.evaluate("Array.from({length:5000},()=>shNewCode())")
        ok('code is 12 characters', all(len(c) == 12 for c in codes))
        ok('code uses only the safe alphabet (no 0/O/1/I/L)', all(re.fullmatch(r'[A-HJKMNP-Z2-9]{12}', c) for c in codes))
        ok('5000 codes are all different', len(set(codes)) == 5000)
        allc = ''.join(codes); freq = {ch: allc.count(ch) for ch in set(allc)}
        ok('all 31 characters are used, evenly', len(freq) == 31 and max(freq.values()) / min(freq.values()) < 1.25, freq)
        src = await app.evaluate("shNewCode.toString()+startShare.toString()")
        ok('no Math.random in the show code', 'Math.random' not in src and 'getRandomValues' in src)

        # share: fake a signed-in Studio user, one image cue
        await app.set_input_files('#fileIn', [os.path.join(HERE, 'red.png'), os.path.join(HERE, 'green.png')]); await app.wait_for_timeout(900)
        await app.evaluate("sess={email:'test@example.com',id:'00000000-0000-0000-0000-000000000000'};licensed=true")
        await app.evaluate("startShare()"); await app.wait_for_timeout(500)
        code = await app.evaluate("shCode"); link = await app.evaluate("document.querySelector('#shLink').textContent")
        ok('share link carries the 12-char code', link == 'https://cuey.live/s/?c=' + code and len(code) == 12, link)
        ok('QR code is drawn', await app.evaluate("!!document.querySelector('#shQr svg')"))

        scr = await ctx.new_page(); serrs = []
        scr.on('pageerror', lambda e: serrs.append(str(e)))
        await scr.goto(SCREEN + '?c=' + code.lower())
        shown = await scr.evaluate("document.getElementById('code').textContent")
        ok('screen page shows the code in groups of 4', shown == 'CUEY-' + '-'.join([code[i:i+4] for i in range(0, 12, 4)]), shown)
        # wait for WebRTC
        con = False
        for _ in range(40):
            await scr.wait_for_timeout(250)
            if await scr.evaluate("rtcOn&&document.getElementById('rtc').videoWidth>0"): con = True; break
        ok('screen connects to the show (WebRTC)', con)
        ok('app counts 1 connected screen', await app.evaluate("Object.values(shPCs).filter(p=>p.connectionState==='connected').length") == 1)
        # GO -> the screen shows red
        await app.evaluate("go()"); await app.wait_for_timeout(1800)
        px = await scr.evaluate("(()=>{const v=document.getElementById('rtc'),c=document.createElement('canvas');c.width=64;c.height=36;const g=c.getContext('2d');g.drawImage(v,0,0,64,36);return Array.from(g.getImageData(32,18,1,1).data)})()")
        ok('after GO the screen shows the first cue (red)', px[0] > 150 and px[1] < 90 and px[2] < 90, px)
        await app.evaluate("go()"); await app.wait_for_timeout(2500)
        px = await scr.evaluate("(()=>{const v=document.getElementById('rtc'),c=document.createElement('canvas');c.width=64;c.height=36;const g=c.getContext('2d');g.drawImage(v,0,0,64,36);return Array.from(g.getImageData(32,18,1,1).data)})()")
        ok('next GO shows the second cue (green)', px[1] > 120 and px[0] < 120, px)
        # traffic only on the new topic
        ok('signalling only on topic cuey-v1-CODE', posts and all(t == 'cuey-v1-' + code for t, _ in posts), {t for t, _ in posts})
        # a stranger with an old-style 4-char guess finds nothing
        s2 = await ctx.new_page(); await s2.goto(SCREEN + '?c=' + code[:4]); await s2.wait_for_timeout(2500)
        ok('a guessed short code gets no picture', not await s2.evaluate("rtcOn"))
        # old 4-char links still open (no crash), junk is stripped
        await s2.goto(SCREEN + '?c=ab-<script>12');
        ok('junk in the link is cleaned', await s2.evaluate("code") == 'ABSCRIPT12')
        # stop
        await app.evaluate("stopShare()"); await scr.wait_for_timeout(800)
        ok('stop sharing closes the screen connection', not await scr.evaluate("pc&&pc.connectionState==='connected'"))
        ok('same code is reused if sharing again in this session', (await app.evaluate("(startShare(),shCode)")) == code)
        await app.evaluate("stopShare()")
        ok('no page errors (app)', not errs, errs[:3]); ok('no page errors (screen)', not serrs, serrs[:3])
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
