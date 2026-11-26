"""Field report, event on Windows, 26.11.2026 (Avi):
1. a Slide show made while one of its slides was already on the screen: GO did nothing (or left the show) until BACK was pressed -> GO now starts it.
2. BLACK the operator pressed stays while a Slide show moves from slide to slide.
3. A slide is deleted inside a Slide show without breaking it; Ctrl+A ticks every cue and Ctrl+G makes the Slide show."""
import asyncio, os
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); FIX = os.path.join(HERE, 'fixtures')
APP = 'file://' + os.path.abspath(os.path.join(HERE, '..', 'app', 'cuey.html')) + '?nosplash&notour&lang=en'
IM = ['blue.png', 'green.png', 'purple.png', 'red.png']
res = []
def ok(name, cond, info=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  -> ' + str(info)[:300]))
S = "({cur,n:items.length,grp:items.map(x=>x.grp||'-').join(''),halt:haltGrp,hold:!!holdTimer,black:blackOn,sel:sel.size,groups:Object.keys(groups).length})"
MAKE = "items.forEach(x=>{if(x.type!=='video')sel.add(x.id)});makeGroup();Object.values(groups)[0].hold=1;applyGrp(Object.keys(groups)[0])"
async def fresh(p, files):
    b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
    ctx = await b.new_context(viewport={'width': 1440, 'height': 860}); pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(APP); await pg.wait_for_timeout(700)
    await pg.set_input_files('#fileIn', [os.path.join(FIX, f) for f in files]); await pg.wait_for_timeout(2000); return b, pg, errs
async def main():
    async with async_playwright() as p:
        # 1a. the first slide is live, the show is the whole list
        b, pg, errs = await fresh(p, IM)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(700); await pg.evaluate(MAKE); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(500); s = await pg.evaluate(S)
        ok('made from a live first slide: GO starts the show', s['cur'] == 0 and s['hold'] and not s['halt'], s)
        await pg.wait_for_timeout(2600); s2 = await pg.evaluate(S)
        ok('…and it moves on by itself', s2['cur'] >= 1 and s2['hold'], s2)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(500); s3 = await pg.evaluate(S)
        ok('the next GO leaves the show as before (last in the list: it stops)', s3['halt'] and not s3['hold'], s3)
        ok('no page errors (1a)', not errs, errs); await b.close()
        # 1b. the third slide is live, a video follows the show
        b, pg, errs = await fresh(p, IM + ['va.webm'])
        await pg.evaluate("show(2)"); await pg.wait_for_timeout(700); await pg.evaluate(MAKE); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(500); s = await pg.evaluate(S)
        ok('made from a live third slide: GO starts the show from its first slide', s['cur'] == 0 and s['hold'], s)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(700); s2 = await pg.evaluate(S)
        ok('the next GO goes on to the cue after the show', s2['cur'] == 4, s2)
        ok('no page errors (1b)', not errs, errs); await b.close()
        # 1c. nothing live / another cue live: unchanged
        b, pg, errs = await fresh(p, ['va.webm'] + IM)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(700); await pg.evaluate(MAKE); await pg.wait_for_timeout(300)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(500); s = await pg.evaluate(S)
        ok('a video is live, the show is made after it: GO enters the show', s['cur'] == 1 and s['hold'], s)
        # 2. BLACK through the slides of a running show
        await pg.click('#blk'); await pg.wait_for_timeout(300); c0 = (await pg.evaluate(S))['cur']
        await pg.wait_for_timeout(1500); s = await pg.evaluate(S)  # one slide on (hold 1 s; four slides would be back where they started after 4 s)
        ok('BLACK stays while the show moves from slide to slide', s['black'] and s['cur'] != c0, (c0, s))
        op = await pg.evaluate("getComputedStyle(document.querySelector('#nowStage .blk')).opacity")
        ok('PROGRAM is black', float(op) > .95, op)
        await pg.keyboard.press('b'); await pg.wait_for_timeout(900); s = await pg.evaluate(S)
        ok('B lifts it', not s['black'], s)
        ok('no page errors (2)', not errs, errs); await b.close()
        # 3. Ctrl+A, Ctrl+G, delete inside
        b, pg, errs = await fresh(p, IM)
        await pg.keyboard.press('Control+a'); await pg.wait_for_timeout(300); s = await pg.evaluate(S)
        ok('Ctrl+A ticks every cue', s['sel'] == 4, s)
        await pg.keyboard.press('Control+g'); await pg.wait_for_timeout(300); s = await pg.evaluate(S)
        ok('Ctrl+G makes the Slide show', s['groups'] == 1 and s['grp'] == 'g1g1g1g1', s)
        await pg.evaluate("grpAct(Object.keys(groups)[0],'tog')"); await pg.wait_for_timeout(300)
        await pg.locator('#list .item').nth(1).click(button='right'); await pg.wait_for_timeout(200)
        await pg.click('#ctxm [data-a="del"], #ctxm [data-c="del"]'); await pg.wait_for_timeout(500); s = await pg.evaluate(S)
        ok('a slide deleted inside the show: the rest is still one Slide show', s['n'] == 3 and s['grp'] == 'g1g1g1' and s['groups'] == 1, s)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(500); s = await pg.evaluate(S)
        ok('…and GO runs it', s['cur'] == 0 and s['hold'], s)
        ok('no page errors (3)', not errs, errs); await b.close()
    print(f'\n{sum(res)}/{len(res)} passed'); raise SystemExit(0 if all(res) else 1)
asyncio.run(main())
