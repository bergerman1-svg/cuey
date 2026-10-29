"""Music cues: Fade out button (on every cue with sound, works on the live cue, out only, colour follows the fade),
fade time per cue, GO starts the next cue at full level; IN / OUT on music cues; the Edit window for a music cue shows
only what matters for sound; PowerPoint in the browser explains itself."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
VOL = "(()=>{const it=items[cur];if(!it)return null;if(it.type==='audio'||(slideAudio.src&&it.audio))return slideAudio.volume;const m=pvStage.media;return m?m.volume:null})()"
LIVE = '.item.cur [data-k=fade]'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        for lang in ('en', 'he'):
            L = f'[{lang}] '
            pg = await (await b.new_context()).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('file://' + ROOT + f'/app/cuey.html?nosplash&notour&lang={lang}'); await pg.wait_for_timeout(700)
            await pg.set_input_files('#fileIn', [os.path.join(FIX, 'tone.wav'), os.path.join(FIX, 'va.webm'), os.path.join(FIX, 'red.png')]); await pg.wait_for_timeout(1200)
            ok(L + 'no fade button in the GO bar', await pg.evaluate("!document.querySelector('.side [data-k=fade],#fadeBtn')"))
            ok(L + 'every cue with sound shows "Fade out", the picture does not', await pg.evaluate("[...document.querySelectorAll('.item')].map(r=>!!r.querySelector('[data-k=fade]')).join()") == 'true,true,false')
            label = await pg.evaluate("document.querySelector('.item [data-k=fade]').textContent")
            ok(L + 'the button says fade out', label in ('Fade out', 'פייד אאוט'), label)
            xs = await pg.evaluate("[...document.querySelectorAll('.item [data-k=fade]')].map(b=>Math.round(b.getBoundingClientRect().right))")
            ok(L + 'fade buttons line up on every row', len(set(xs)) == 1, xs)
            await pg.evaluate("go()"); await pg.wait_for_timeout(500)
            v0 = await pg.evaluate(VOL)
            ok(L + 'music cue plays at full level', v0 and v0 > 0.9, v0)
            await pg.evaluate("items[cur].fadeT=1")
            await pg.click(LIVE); await pg.wait_for_timeout(500)
            mid = await pg.evaluate(VOL)
            ok(L + 'fade is gradual (half-way after 0.5 s)', mid is not None and 0.05 < mid < 0.9, mid)
            fk = await pg.evaluate("parseFloat(document.querySelector('.item.cur [data-k=fade]').style.getPropertyValue('--fk'))")
            ok(L + 'the button colour follows the fade', 0.05 < fk < 0.95, fk)
            await pg.wait_for_timeout(800)
            ok(L + "faded out after the cue's fade time", (await pg.evaluate(VOL)) < 0.01, await pg.evaluate(VOL))
            ok(L + 'still playing (fade, not stop)', await pg.evaluate("!slideAudio.paused"))
            await pg.click(LIVE); await pg.wait_for_timeout(600)
            ok(L + 'fade out only: a second press keeps it down', (await pg.evaluate(VOL)) < 0.01)
            await pg.evaluate("go()"); await pg.wait_for_timeout(700)
            v2 = await pg.evaluate(VOL)
            ok(L + 'GO: the next cue (video) starts at full level', v2 is not None and v2 > 0.9, v2)
            await pg.evaluate("setMaster(0.5)"); await pg.wait_for_timeout(100)
            ok(L + 'master still works with fade', abs((await pg.evaluate(VOL)) - 0.5) < 0.02, await pg.evaluate(VOL))
            await pg.evaluate("setMaster(1)")
            await pg.evaluate("document.querySelectorAll('.item [data-k=fade]')[0].click()"); await pg.wait_for_timeout(300)
            ok(L + 'fade on a cue that is not playing leaves the live sound alone', (await pg.evaluate(VOL)) > 0.9)
            # Edit window for a music cue: only what matters for sound
            await pg.evaluate("openEdit(items[0],true)"); await pg.wait_for_timeout(200)
            ok(L + 'music cue Edit: fade-out time', await pg.evaluate("!!document.querySelector('#edBox [data-f=fadeT]')"))
            ok(L + 'music cue Edit: IN / OUT', await pg.evaluate("!!document.querySelector('#edBox [data-f=in]')"))
            ok(L + 'music cue Edit: no picture transition', await pg.evaluate("!document.querySelector('#edBox [data-v=dissolve],#edBox [data-f=dur]')"))
            ends = await pg.evaluate("[...document.querySelectorAll('#edBox [data-g=onEndV] button,#edBox [data-s=onEndV] button')].map(b=>b.textContent)")
            ok(L + 'music cue Edit: end = wait for GO / next cue (no "last frame", no Black)', len(ends) in (0, 2) and not any('Black' in e or 'שחור' in e for e in ends), ends)
            await pg.evaluate("const i=document.querySelector('#edBox [data-f=fadeT]');i.value='7';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}))")
            await pg.evaluate("document.getElementById('edOk').click()"); await pg.wait_for_timeout(200)
            ok(L + 'fade time saved on the cue and in the show file', await pg.evaluate("items[0].fadeT===7&&showData().cues[0].fadeT===7"))
            await pg.evaluate("openEdit(items[1],true)"); await pg.wait_for_timeout(200)
            ok(L + 'video Edit still has its transition', await pg.evaluate("!!document.querySelector('#edBox [data-f=dur]')"))
            await pg.evaluate("document.getElementById('edX').click()")
            # IN / OUT on a music cue
            await pg.evaluate("items[0].in=0.5;items[0].out=1.2;show(0)"); await pg.wait_for_timeout(400)
            st = await pg.evaluate("slideAudio.currentTime")
            ok(L + 'music cue starts at its IN point', 0.45 <= st < 1.1, st)
            ok(L + 'IN / OUT buttons are active for music', await pg.evaluate("!$('#inBtn').disabled&&!$('#outBtn').disabled"))
            await pg.wait_for_timeout(1500)
            ok(L + 'music cue stops at its OUT point', await pg.evaluate("slideAudio.paused||items[cur]!==items[0]"), await pg.evaluate("slideAudio.currentTime"))
            ok(L + 'no page errors', not errs, errs)
            await pg.set_input_files('#fileIn', [os.path.join(FIX, 'deck.pptx')]); await pg.wait_for_timeout(2500)
            t = await pg.evaluate("$('#importDlg').hidden?'':$('#imT').textContent")
            ok(L + 'PowerPoint in the browser shows the explanation', t in ('PowerPoint in the browser version', 'פאוורפוינט בגרסת הדפדפן'), t)
            ok(L + '…with a link to Cuey for desktop', await pg.evaluate("!$('#imDl').hidden&&/#download$/.test($('#imDl').href)"))
            await pg.evaluate("$('#imX').click()")
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
