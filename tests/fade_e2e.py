"""FADE button: fades the current cue's sound out and back in; time per cue; GO starts the next cue at full level; saved in the show."""
import asyncio, os, json
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
VOL = "(()=>{const it=items[cur];if(!it)return null;if(it.type==='audio'||(slideAudio.src&&it.audio))return slideAudio.volume;const m=pvStage.media;return m?m.volume:null})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        for lang in ('en', 'he'):
            L = f'[{lang}] '
            pg = await (await b.new_context()).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('file://' + ROOT + f'/app/cuey.html?nosplash&notour&lang={lang}'); await pg.wait_for_timeout(700)
            await pg.set_input_files('#fileIn', [os.path.join(FIX, 'tone.wav'), os.path.join(FIX, 'va.webm'), os.path.join(FIX, 'red.png')]); await pg.wait_for_timeout(1200)
            ok(L + 'FADE button is on the control screen', await pg.evaluate("!!document.getElementById('fadeBtn')&&document.getElementById('fadeBtn').offsetParent!==null"))
            label0 = await pg.evaluate("document.getElementById('fadeBtn').textContent")
            await pg.evaluate("go()"); await pg.wait_for_timeout(500)
            v0 = await pg.evaluate(VOL)
            ok(L + 'music cue plays at full level', v0 and v0 > 0.9, v0)
            await pg.evaluate("items[cur].fadeT=1")
            await pg.click('#fadeBtn'); await pg.wait_for_timeout(500)
            mid = await pg.evaluate(VOL)
            ok(L + 'fade is gradual (half-way after 0.5 s)', mid is not None and 0.05 < mid < 0.9, mid)
            await pg.wait_for_timeout(800)
            ok(L + 'faded out after the cue\'s fade time', (await pg.evaluate(VOL)) < 0.01, await pg.evaluate(VOL))
            ok(L + 'still playing (fade, not stop)', await pg.evaluate("!slideAudio.paused"))
            ok(L + 'button now offers to bring it back', await pg.evaluate("document.getElementById('fadeBtn').textContent") != label0)
            await pg.click('#fadeBtn'); await pg.wait_for_timeout(1300)
            ok(L + 'second press fades back in', (await pg.evaluate(VOL)) > 0.95, await pg.evaluate(VOL))
            await pg.click('#fadeBtn'); await pg.wait_for_timeout(300)
            await pg.evaluate("go()"); await pg.wait_for_timeout(700)
            v2 = await pg.evaluate(VOL)
            ok(L + 'GO mid-fade: the next cue (video) starts at full level', v2 is not None and v2 > 0.9, v2)
            ok(L + 'button resets after GO', await pg.evaluate("document.getElementById('fadeBtn').textContent") == label0)
            await pg.evaluate("setMaster(0.5)"); await pg.wait_for_timeout(100)
            ok(L + 'master still works with fade', abs((await pg.evaluate(VOL)) - 0.5) < 0.02, await pg.evaluate(VOL))
            await pg.evaluate("setMaster(1)")
            # edit dialog has the per-cue time; the show file keeps it
            await pg.evaluate("openEdit(items[0],true)"); await pg.wait_for_timeout(200)
            ok(L + 'Edit ▸ Sound has the fade time', await pg.evaluate("!!document.querySelector('#edBox [data-f=fadeT]')"))
            await pg.evaluate("const i=document.querySelector('#edBox [data-f=fadeT]');i.value='7';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))")
            await pg.evaluate("document.getElementById('edOk').click()"); await pg.wait_for_timeout(200)
            ok(L + 'fade time saved on the cue', await pg.evaluate("items[0].fadeT") == 7, await pg.evaluate("items[0].fadeT"))
            ok(L + 'fade time saved in the show file', await pg.evaluate("showData().cues[0].fadeT") == 7)
            ok(L + 'the event screen never shows the button', await pg.evaluate("!document.querySelector('#outBox #fadeBtn')"))
            ok(L + 'no page errors', not errs, errs)
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
