"""The last cue finished — GO (or Play) runs it again (Avi, 29.10: "cue 1 ended, GO didn't play it again, Play neither").
Covers a music cue and a video cue, alone in the list and last in a longer list; a cue that is still playing is never restarted."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
POS = "(()=>{const m=tlSource();return m?[+m.currentTime.toFixed(2),m.paused]:null})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        for name, files, last in (('music cue alone', ['tone.wav'], 0), ('video cue alone', ['va.webm'], 0),
                                  ('music cue last in list', ['red.png', 'tone.wav'], 1), ('video cue last in list', ['green.png', 'va.webm'], 1)):
            pg = await (await b.new_context()).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour&lang=he'); await pg.wait_for_timeout(700)
            await pg.set_input_files('#fileIn', [os.path.join(FIX, f) for f in files]); await pg.wait_for_timeout(1200)
            await pg.evaluate(f"items[{last}].in=0;items[{last}].out=0;items.forEach(x=>{{x.loop=false;x.onEnd='hold'}});show({last})"); await pg.wait_for_timeout(500)
            # still playing: GO must not restart it
            a = await pg.evaluate(POS); await pg.evaluate("go()"); await pg.wait_for_timeout(300); b2 = await pg.evaluate(POS)
            ok(f'{name}: GO while it is still playing does not restart it', a and b2 and b2[0] >= a[0] and not b2[1], [a, b2])
            # let it end
            await pg.evaluate("{const m=tlSource();m.currentTime=Math.max(0,m.duration-0.3)}"); await pg.wait_for_timeout(1200)
            ok(f'{name}: it finished', (await pg.evaluate(POS))[1], await pg.evaluate(POS))
            await pg.evaluate("go()"); await pg.wait_for_timeout(600)
            r = await pg.evaluate(POS)
            ok(f'{name}: GO after it ended plays it again from the start', r and not r[1] and r[0] < 1.5 and await pg.evaluate(f"cur==={last}"), r)
            await pg.evaluate("{const m=tlSource();m.currentTime=Math.max(0,m.duration-0.3)}"); await pg.wait_for_timeout(1200)
            await pg.click('#pp'); await pg.wait_for_timeout(600)
            r = await pg.evaluate(POS)
            ok(f'{name}: Play after it ended plays it again', r and not r[1] and r[0] < 1.5, r)
            ok(f'{name}: no page errors', not errs, errs)
            await pg.context.close()
        # music cue with IN / OUT: GO after the OUT point starts again at IN
        pg = await (await b.new_context()).new_page()
        await pg.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour&lang=he'); await pg.wait_for_timeout(700)
        await pg.set_input_files('#fileIn', [os.path.join(FIX, 'tone.wav')]); await pg.wait_for_timeout(1000)
        await pg.evaluate("items[0].in=1;items[0].out=1.6;items[0].loop=false;show(0)"); await pg.wait_for_timeout(1300)
        ok('IN/OUT music cue stopped at OUT', (await pg.evaluate(POS))[1])
        await pg.evaluate("go()"); await pg.wait_for_timeout(250)
        r = await pg.evaluate(POS)
        ok('IN/OUT music cue: GO plays it again from IN', r and not r[1] and 0.95 <= r[0] < 1.6, r)
        # a still picture as the last cue: GO does nothing (nothing to replay)
        await pg.set_input_files('#fileIn', [os.path.join(FIX, 'red.png')]); await pg.wait_for_timeout(800)
        await pg.evaluate("show(1)"); await pg.wait_for_timeout(300); await pg.evaluate("go()"); await pg.wait_for_timeout(300)
        ok('last cue is a picture: GO keeps it', await pg.evaluate("cur===1&&!blackOn"))
        # Avi 29.10: Chrome's picker refused a .pptx in a protected folder ("contains system files") and Cuey said nothing.
        # After the picker comes back empty, a way out shows: the classic picker, which opens files from any folder.
        await pg.evaluate("window.showOpenFilePicker=async()=>{throw new DOMException('blocked','AbortError')};0")
        await pg.evaluate("pickFiles()"); await pg.wait_for_timeout(200)
        txt = await pg.evaluate("(()=>{const e=document.getElementById('pkHelp');return e&&!e.hidden?e.innerText:''})()")
        ok('picker came back empty: the "choose another way" help shows (Hebrew)', 'כרום' in txt and 'לבחור בדרך אחרת' in txt, txt)
        async with pg.expect_file_chooser() as fc:
            await pg.click('#pkHelp button')
        ch = await fc.value
        await ch.set_files([os.path.join(FIX, 'deck.pptx')]); await pg.wait_for_timeout(2500)
        ok('…its button opens the classic picker and the PowerPoint goes in', await pg.evaluate("!$('#importDlg').hidden&&document.getElementById('pkHelp').hidden"))
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
