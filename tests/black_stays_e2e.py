"""BLACK the operator pressed stays until the operator lifts it (Avi 25.11.2026) — through GO, BACK, a click on a cue and the event screen opening.
A black that a cue's own "End: Black" put up still gives way to the next cue."""
import asyncio, os
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); FIX = os.path.join(HERE, 'fixtures')
APP = 'file://' + os.path.abspath(os.path.join(HERE, '..', 'app', 'cuey.html')) + '?nosplash&notour&lang=en'
res = []
def ok(name, cond, info=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  -> ' + str(info)[:300]))
on = lambda d: bool(d['out']) and all(float(x) > .95 for x in d['out'].split(','))
off = lambda d: bool(d['out']) and all(float(x) < .05 for x in d['out'].split(','))
S = "({b:blackOn,cur,btn:document.querySelector('#blk').classList.contains('on'),pv:getComputedStyle(document.querySelector('#nowStage .blk')||document.body).opacity,out:(typeof outWin!=='undefined'&&outWin&&!outWin.closed)?[...outWin.document.querySelectorAll('*')].filter(e=>e.className==='blk').map(e=>getComputedStyle(e).opacity).join(','):null})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 860}); pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(APP); await pg.wait_for_timeout(700)
        await pg.set_input_files('#fileIn', [os.path.join(FIX, f) for f in ('va.webm', 'blue.png', 'va.webm', 'blue.png')]); await pg.wait_for_timeout(2500)
        async with ctx.expect_page() as np:
            await pg.click('#openOut')
        out = await np.value; await pg.bring_to_front(); await pg.wait_for_timeout(500)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(900)
        await pg.click('#blk'); await pg.wait_for_timeout(1200); a = await pg.evaluate(S)
        ok('BLACK goes on (button, PROGRAM, event screen)', a['b'] and a['btn'] and a['out'] and on(a), a)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(1500); g = await pg.evaluate(S)
        ok('GO under BLACK: the next cue is taken, the screen stays black', g['cur'] == 1 and g['b'] and g['btn'] and on(g), g)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(1500); g2 = await pg.evaluate(S)
        ok('a second GO: still black', g2['cur'] == 2 and g2['b'] and on(g2), g2)
        await pg.click('#back'); await pg.wait_for_timeout(1200); k = await pg.evaluate(S)
        ok('BACK under BLACK: still black', k['cur'] == 1 and k['b'] and on(k), k)
        await pg.click('#list .item >> nth=3'); await pg.wait_for_timeout(1200); c = await pg.evaluate(S)
        ok('a click on a cue under BLACK: still black', c['cur'] == 3 and c['b'] and on(c), c)
        await out.close(); await pg.wait_for_timeout(600)
        async with ctx.expect_page() as np:
            await pg.click('#openOut')
        out = await np.value; await pg.bring_to_front(); await pg.wait_for_timeout(1200); o = await pg.evaluate(S)
        ok('the event screen opened again under BLACK: it opens black', o['b'] and o['out'] and on(o), o)
        await pg.keyboard.press('b'); await pg.wait_for_timeout(1300); r = await pg.evaluate(S)
        ok('B lifts it: only the operator releases BLACK', not r['b'] and not r['btn'] and off(r), r)
        # End: Black is the cue's own black: the next cue lifts it
        await pg.evaluate("items[0].onEnd='black';items[0].loop=false;show(0)"); await pg.wait_for_timeout(900)
        await pg.evaluate("pvStage.media.currentTime=pvStage.media.duration-.5"); await pg.wait_for_timeout(2500); e = await pg.evaluate(S)
        ok('a cue set to "End: Black" goes black at its end', e['b'] and e['cur'] == 0, e)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(1500); e2 = await pg.evaluate(S)
        ok('...and the next GO shows the next cue (that black was the cue\'s, not the operator\'s)', e2['cur'] == 1 and not e2['b'] and off(e2), e2)
        # blind round 27.11: on the free plan the "powered by" mark stayed on a black event screen
        B = "(()=>{const b=document.getElementById('badge');return b?+getComputedStyle(b).opacity:null})()"
        await pg.evaluate("setLicensed(false);badgeShown=true;badgeT0=performance.now();applyBadge()"); await pg.wait_for_timeout(1900)
        b0 = await out.evaluate(B)
        await pg.click('#blk'); await pg.wait_for_timeout(250); b1 = await out.evaluate(B); pb1 = await pg.evaluate("$('#pvBadge').hidden")
        ok('free plan: the mark is on the event screen, and BLACK takes it off at once (PROGRAM too)', b0 and b0 > .2 and b1 == 0 and pb1, [b0, b1, pb1])
        await pg.keyboard.press('b'); await pg.wait_for_timeout(1900); b2 = await out.evaluate(B)
        ok('...and it is back when BLACK is lifted', b2 and b2 > .2, b2)
        ok('no page errors', not errs, errs[:3])
        await b.close()
    print(f"{sum(res)}/{len(res)} passed")
asyncio.run(main())
