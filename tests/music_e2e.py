"""Cuey Music: our own short cues in a side drawer — listen, add with one click, or drag into the cue list.
The drawer sits beside the cue list (never on it), the old Pixabay way is still there for whole songs."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        for lang in ('en', 'he'):
            L = f'[{lang}] '
            pg = await (await b.new_context(viewport={'width': 1440, 'height': 860})).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('file://' + ROOT + f'/app/cuey.html?nosplash&notour&lang={lang}'); await pg.wait_for_timeout(700)
            await pg.evaluate("$('#adFm').click()"); await pg.wait_for_timeout(300)
            ok(L + 'the Free music tile opens Cuey Music with all its cues', await pg.evaluate("!$('#fmDlg').hidden&&document.querySelectorAll('#fmList .mt').length===MUS.length&&MUS.length>=10"))
            files = [f for f in os.listdir(ROOT + '/app/music')]
            ok(L + 'every cue ships with its file', await pg.evaluate("MUS.map(m=>m[0])") and all(m + e in files for m in await pg.evaluate("MUS.map(m=>m[0])") for e in ('.mp3',)))
            box = await pg.evaluate("(()=>{const a=$('#list').getBoundingClientRect(),d=$('#fmDlg .dbox').getBoundingClientRect();return [a.right,d.left,d.right,innerWidth]})()")
            ok(L + 'the drawer sits beside the cue list, not on it', box[1] >= box[0] and box[2] <= box[3], box)
            await pg.click('#fmChips button[data-c="feel"]')
            ok(L + 'a category shows only its cues', await pg.evaluate("document.querySelectorAll('#fmList .mt').length===MUS.filter(m=>m[1]==='feel').length"))
            await pg.click('#fmChips button[data-c="all"]')
            await pg.click('#fmList .mt[data-id="walk_on_funk_1"] .pl'); await pg.wait_for_timeout(1300)
            st = await pg.evaluate("({on:musOn,t:musA.currentTime,e:musA.error&&musA.error.code})")
            ok(L + 'play previews the cue right here', st['on'] == 'walk_on_funk_1' and st['t'] > .4 and not st['e'], st)
            await pg.click('#fmList .mt[data-id="walk_on_funk_1"] .pl'); await pg.wait_for_timeout(200)
            ok(L + 'pressing again stops it', await pg.evaluate("musOn===null&&musA.paused"))
            await pg.click('#fmList .mt[data-id="winner_1"] .ad'); await pg.wait_for_timeout(1000)
            it = await pg.evaluate("items.map(i=>[i.type,i.name,i.file.size>20000])")
            ok(L + '+ Add puts the cue in the list as a music cue', len(it) == 1 and it[0][0] == 'audio' and it[0][2] and 'Cuey' in it[0][1], it)
            ok(L + 'the drawer stays open for the next one', await pg.evaluate("!$('#fmDlg').hidden"))
            await pg.drag_and_drop('#fmList .mt[data-id="thank_you_1"]', '#list'); await pg.wait_for_timeout(1000)
            it = await pg.evaluate("items.map(i=>i.type)")
            ok(L + 'dragging a cue into the cue list adds it', it == ['audio', 'audio'], it)
            await pg.evaluate("go()"); await pg.wait_for_timeout(900)
            ok(L + 'the added cue really plays on GO', await pg.evaluate("cur===0&&!slideAudio.paused&&slideAudio.currentTime>0"), await pg.evaluate("[cur,slideAudio.paused,slideAudio.currentTime]"))
            ok(L + 'whole songs: the Pixabay way is still offered', await pg.evaluate("!$('#fmGo').hidden&&$('#fmGo').offsetParent!==null"))
            await pg.click('#fmList .mt[data-id="doors_open_1"] .pl'); await pg.wait_for_timeout(300); await pg.click('#fmX')
            ok(L + 'closing the drawer stops the preview', await pg.evaluate("$('#fmDlg').hidden&&musA.paused"))
            ok(L + 'no page errors', not errs, errs[:2])
            await pg.close()
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed'); raise SystemExit(0 if all(res) else 1)
asyncio.run(main())
