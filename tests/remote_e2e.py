"""Cuey Remote (Avi, 31.10): the phone is the clicker. App → "Remote" → QR → phone page /r/?c=CODE connects (WebRTC data channel,
signalling through a local stand-in for ntfy.sh) → GO / BACK / FREEZE / BLACK from the phone run the show; the phone shows LIVE / NEXT.
Also: the ntfy fallback when the data channel is down, one press = one command, disconnect makes a new code, the screen-share code is separate."""
import asyncio, json, os, re
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
APP = 'file://' + ROOT + '/app/cuey.html?nosplash&notour&lang='
PHONE = 'file://' + ROOT + '/docs/r/index.html'
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''), flush=True)

subs = {}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context()
        posts = []
        async def on_post(route):
            req = route.request; topic = re.search(r'ntfy\.sh/([^/?]+)', req.url).group(1); body = req.post_data or ''
            posts.append((topic, body)); msg = json.dumps({'event': 'message', 'topic': topic, 'message': body, 'id': str(len(posts))})
            for ws in list(subs.get(topic, [])):
                try: ws.send(msg)
                except Exception: pass
            await route.fulfill(status=200, body='{}', headers={'access-control-allow-origin': '*'})
        await ctx.route(re.compile(r'https://ntfy\.sh/.*'), on_post)
        def on_ws(ws):
            topic = re.search(r'ntfy\.sh/([^/]+)/ws', ws.url).group(1); subs.setdefault(topic, []).append(ws)
            ws.send(json.dumps({'event': 'open', 'topic': topic}))
            ws.on_close(lambda *a: subs.get(topic, []).remove(ws) if ws in subs.get(topic, []) else None)
        await ctx.route_web_socket(re.compile(r'wss://ntfy\.sh/.*'), on_ws)

        app = await ctx.new_page(); errs = []
        app.on('pageerror', lambda e: errs.append(str(e)))
        await app.goto(APP + 'he'); await app.wait_for_timeout(800)
        ok('[he] header button "שלט" with a phone icon', await app.evaluate("$('#rmT').textContent==='שלט'&&!!$('#rmBtn svg')"))
        # English
        en = await ctx.new_page(); await en.goto(APP + 'en'); await en.wait_for_timeout(600)
        ok('[en] header button "Remote"', await en.evaluate("$('#rmT').textContent") == 'Remote')
        ph2 = await ctx.new_page(); await ph2.goto(PHONE + '?c=ABC'); await ph2.wait_for_timeout(300)
        ok('[en] phone page in English, waiting screen until Cuey answers', await ph2.evaluate("document.getElementById('msg').textContent") == 'Connecting to Cuey…')
        ph3 = await ctx.new_page(); await ph3.goto(PHONE); await ph3.wait_for_timeout(200)
        ok('opened from the home screen (no code in the link): uses the code this phone had last time', (await ph3.evaluate("location.search")).startswith('?c=ABC'))
        await ph3.evaluate("localStorage.removeItem('cuey.remote')"); await ph3.goto(PHONE); await ph3.wait_for_timeout(200)
        ok('never scanned: explains to press 📱 Remote in Cuey', 'Remote' in await ph3.evaluate("document.getElementById('msg').textContent"))
        ok('no installable-app manifest (Samsung turns it into an app that Play Protect blocks)', await ph3.evaluate("!document.querySelector('link[rel=manifest]')"))
        for pg_ in (en, ph2, ph3): await pg_.close()
        await app.set_input_files('#fileIn', [os.path.join(FIX, n) for n in ('red.png', 'green.png', 'blue.png')]); await app.wait_for_timeout(1200)
        await app.click('#rmBtn'); await app.wait_for_timeout(300)
        code = await app.evaluate("rmCode"); link = await app.evaluate("$('#rmLink').textContent")
        ok('Remote window: QR + link with a 12-char code (+ the app language)', bool(re.fullmatch(r'[A-HJKMNP-Z2-9]{12}', code or '')) and link == 'https://cuey.live/r/?c=' + code + '&l=he' and await app.evaluate("!!$('#rmQr svg')"), link)
        ok('…says it is waiting for a phone', 'מחכה לטלפון' in await app.evaluate("$('#rmStat').textContent"))
        ok('the code is kept on this computer for next time', await app.evaluate("localStorage.getItem('cuey.rm')") == code)

        ph = await ctx.new_page(); perrs = []
        ph.on('pageerror', lambda e: perrs.append(str(e)))
        await ph.set_viewport_size({'width': 390, 'height': 844})
        await ph.goto(PHONE + '?c=' + code.lower() + '&l=he')
        con = False
        for _ in range(40):
            await ph.wait_for_timeout(250)
            if await ph.evaluate("document.getElementById('conn').classList.contains('ok')"): con = True; break
        ok('phone connects (data channel open) and says "מחובר"', con and await ph.evaluate("document.getElementById('connT').textContent") == 'מחובר')
        await app.wait_for_timeout(300)
        ok('app: "● טלפון אחד מחובר" and the button turns on', 'טלפון אחד מחובר' in await app.evaluate("$('#rmStat').textContent") and await app.evaluate("$('#rmBtn').classList.contains('on')"))
        ok('phone page: Hebrew, right to left', await ph.evaluate("document.body.dir") == 'rtl' and await ph.evaluate("document.querySelector('#back span').textContent") == 'אחורה')
        await app.click('#rmDone')

        async def wait_app(js, ms=3000):
            for _ in range(ms // 100):
                if await app.evaluate(js): return True
                await app.wait_for_timeout(100)
            return False
        async def wait_ph(js, ms=3000):
            for _ in range(ms // 100):
                if await ph.evaluate(js): return True
                await ph.wait_for_timeout(100)
            return False
        ok('labels follow Cuey: PROGRAM / NEXT, אחורה / הקפאה / מסך שחור', (await ph.evaluate("[...document.querySelectorAll('.lb')].map(e=>e.textContent.trim()).join('|')")).startswith('PROGRAM') and await ph.evaluate("document.querySelector('#blk span').textContent") == 'מסך שחור')
        await app.evaluate("lang='en';applyLang()"); 
        ok('Cuey switched to English → the phone follows', await wait_ph("document.querySelector('#back span').textContent==='BACK'&&document.body.dir==='ltr'"))
        await app.evaluate("lang='he';applyLang()")
        ok('…and back to Hebrew', await wait_ph("document.querySelector('#back span').textContent==='אחורה'&&document.body.dir==='rtl'"))
        ok('before GO: phone shows NEXT = the first cue', await wait_ph("document.getElementById('nnm').textContent==='red'"))
        await ph.dispatch_event('#go', 'pointerdown');
        ok('GO on the phone → cue 1 is live in Cuey', await wait_app("cur===0"))
        ok('phone shows LIVE red / NEXT green, with pictures', await wait_ph("document.getElementById('lnm').textContent==='red'&&document.getElementById('nnm').textContent==='green'&&getComputedStyle(document.getElementById('lth')).backgroundImage.startsWith('url(')"))
        await ph.wait_for_timeout(300); await ph.dispatch_event('#go', 'pointerdown')
        ok('GO again → cue 2', await wait_app("cur===1"))
        await ph.wait_for_timeout(300); await ph.dispatch_event('#back', 'pointerdown')
        ok('BACK → cue 1', await wait_app("cur===0"))
        await ph.wait_for_timeout(300); await ph.dispatch_event('#blk', 'pointerdown')
        ok('BLACK → Cuey goes to black', await wait_app("blackOn===true"))
        ok('…and the phone shows BLACK lit + a tag', await wait_ph("document.getElementById('blk').classList.contains('on')&&document.getElementById('tags').textContent.includes('שחור')"))
        await ph.wait_for_timeout(300); await ph.dispatch_event('#blk', 'pointerdown')
        ok('BLACK again → back to the picture', await wait_app("blackOn===false"))
        # a double tap inside 250 ms is one press
        await ph.wait_for_timeout(300); await ph.dispatch_event('#go', 'pointerdown'); await ph.dispatch_event('#go', 'pointerdown')
        await app.wait_for_timeout(700)
        ok('two taps within 250 ms = one GO', await app.evaluate("cur") == 1)
        # a real phone tap = pointerdown + the browser's click (detail 0 on Samsung): must be ONE command (Avi, 31.10: GO jumped 2, BLACK on+off)
        async def tap(sel):
            await ph.dispatch_event(sel, 'pointerdown'); await ph.dispatch_event(sel, 'pointerup'); await ph.evaluate(f"document.querySelector('{sel}').dispatchEvent(new MouseEvent('click',{{bubbles:true,detail:0}}))")
        c0 = await app.evaluate("cur"); await ph.wait_for_timeout(400); await tap('#back'); await app.wait_for_timeout(800)
        ok('tap BACK (pointerdown + click) = one cue back', await app.evaluate("cur") == c0 - 1, await app.evaluate("cur"))
        await ph.wait_for_timeout(400); await tap('#go'); await app.wait_for_timeout(800)
        ok('tap GO (pointerdown + click) = one cue forward', await app.evaluate("cur") == c0, await app.evaluate("cur"))
        await ph.wait_for_timeout(400); await tap('#blk'); await app.wait_for_timeout(800)
        ok('tap BLACK = black stays on', await app.evaluate("blackOn") is True)
        await ph.wait_for_timeout(400); await tap('#blk'); await app.wait_for_timeout(800)
        ok('tap BLACK again = picture back', await app.evaluate("blackOn") is False)
        # keyboard / switch access still works (a click with no touch before it)
        await ph.wait_for_timeout(1600); await ph.evaluate("document.querySelector('#blk').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:0}))"); await app.wait_for_timeout(800)
        ok('keyboard press (click only) still works, once', await app.evaluate("blackOn") is True)
        await ph.wait_for_timeout(400); await ph.dispatch_event('#blk', 'pointerdown'); await app.wait_for_timeout(600)
        # fallback through ntfy (no data channel): the same command id twice runs once
        n0 = await app.evaluate("cur")
        await app.evaluate(f"fetch('https://ntfy.sh/cuey-r1-{code}',{{method:'POST',body:JSON.stringify({{t:'cmd',id:'zz1',c:'back',s:7}})}})")
        await app.evaluate(f"fetch('https://ntfy.sh/cuey-r1-{code}',{{method:'POST',body:JSON.stringify({{t:'cmd',id:'zz1',c:'back',s:7}})}})")
        await app.wait_for_timeout(700)
        ok('fallback path (through the internet relay) works, and a repeated press runs once', await app.evaluate("cur") == n0 - 1, await app.evaluate("cur"))
        # unknown command does nothing
        await app.evaluate(f"fetch('https://ntfy.sh/cuey-r1-{code}',{{method:'POST',body:JSON.stringify({{t:'cmd',id:'zz1',c:'delete-all',s:8}})}})"); await app.wait_for_timeout(400)
        ok('an unknown command does nothing', await app.evaluate("items.length") == 3)
        # remote and screen share never share a topic
        await app.evaluate("sess={email:'t@e.com',id:'00000000-0000-0000-0000-000000000000'};licensed=true;startShare()"); await app.wait_for_timeout(300)
        ok('screen-share code is different from the remote code', await app.evaluate("shCode!==rmCode"))
        await app.evaluate("stopShare()")
        ok('remote still connected after screen share stops', await ph.evaluate("document.getElementById('conn').classList.contains('ok')"))
        # disconnect phones → phone told, new code next time
        await app.click('#rmBtn'); await app.click('#rmStop'); await ph.wait_for_timeout(800)
        ok('Disconnect phones: phone says it was disconnected', 'נותק' in await ph.evaluate("document.getElementById('msg').textContent") and not await ph.evaluate("document.getElementById('conn').classList.contains('ok')"))
        ok('…the saved code is gone', await app.evaluate("localStorage.getItem('cuey.rm')") is None)
        await app.click('#rmBtn'); await app.wait_for_timeout(200)
        ok('…and the next Remote has a new code', await app.evaluate("rmCode") != code)
        await app.evaluate("stopRemote()")
        ok('no page errors (app)', not errs, errs[:3]); ok('no page errors (phone)', not perrs, perrs[:3])
        print(f'\n{sum(res)}/{len(res)} passed', flush=True)  # before closing: playwright's websocket stand-in can trip while pages close
        try: await asyncio.wait_for(b.close(), 10)
        except Exception: pass
asyncio.run(main())
