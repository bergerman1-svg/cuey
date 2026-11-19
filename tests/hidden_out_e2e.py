"""Field report 20.11: with the event-screen window open but hidden behind the Cuey window (one screen, at the desk), the browser
puts a video without sound to sleep in the hidden window. PROGRAM used to be pulled back to that sleeping video every second:
the picture jumped in a one-second loop and the time stood still. A hidden event screen is no longer followed."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
S = "(()=>{const p=pvStage.media,o=outStage.media;return {p:p.currentTime,o:o.currentTime,pp:p.paused,k:pvDiag.kicks,tm:$('#tm').textContent}})()"
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 860}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour&lang=en'); await pg.wait_for_timeout(700)
        await pg.set_input_files('#fileIn', [os.path.join(FIX, 'va.webm'), os.path.join(FIX, 'blue.png')]); await pg.wait_for_timeout(1000)
        await pg.evaluate("items[0].loop=true")
        async with ctx.expect_page() as np:
            await pg.evaluate("openOut()")
        out = await np.value; await pg.bring_to_front(); await pg.wait_for_timeout(600)
        await pg.click('#list .item >> nth=0'); await pg.wait_for_timeout(1500)
        a = await pg.evaluate(S); await pg.wait_for_timeout(2200); b2 = await pg.evaluate(S)
        dur = await pg.evaluate("pvStage.media.duration")
        ok('event screen in view: PROGRAM and the event screen play together', abs(b2['p'] - b2['o']) < .5 and not b2['pp'], [a, b2, dur])
        # the event screen goes out of sight and the browser stops its video
        await pg.evaluate("Object.defineProperty(outWin.document,'hidden',{get:()=>true,configurable:true});outStage.media.pause()")
        k0 = (await pg.evaluate(S))['k']; seen = []
        for i in range(5):
            await pg.wait_for_timeout(1000); seen.append(await pg.evaluate(S))
        moved = len({round(x['p'], 1) for x in seen}) >= 4
        ok('event screen hidden and asleep: PROGRAM keeps playing, it is not pulled back every second', moved and seen[-1]['k'] == k0 and not seen[-1]['pp'], [k0, [(round(x['p'], 2), x['k']) for x in seen]])
        ok('and the time under PROGRAM keeps running', len({x['tm'] for x in seen}) >= 3, [x['tm'] for x in seen])
        # in sight again and awake: PROGRAM lines up with it as before
        await pg.evaluate("delete outWin.document.hidden;outStage.media.play()"); await pg.wait_for_timeout(2600); c = await pg.evaluate(S)
        ok('in view again: PROGRAM lines up with the event screen', abs(c['p'] - c['o']) < .5, c)
        # a stalled event screen that IS in view is still the truth PROGRAM follows
        await pg.evaluate("outStage.media.pause()"); k1 = (await pg.evaluate(S))['k']; await pg.wait_for_timeout(2600); d = await pg.evaluate(S)
        ok('an event screen in view that stops is still followed by PROGRAM', d['k'] > k1 and abs(d['p'] - d['o']) < 1.2, [k1, d])
        ok('no page errors', not errs, errs[:3])
        await b.close()
    print(f"{sum(res)}/{len(res)} passed")
asyncio.run(main())
