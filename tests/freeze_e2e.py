"""FREEZE works on every cue that moves — including a Create cue (text over a breathing / moving loop) with no music,
which has no timeline. Picture cues and cues without movement keep working as before."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        for lang in ('en', 'he'):
            L = f'[{lang}] '
            pg = await (await b.new_context()).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('file://' + ROOT + f'/app/cuey.html?nosplash&notour&lang={lang}'); await pg.wait_for_timeout(700)
            await pg.set_input_files('#fileIn', [os.path.join(FIX, 'va.webm')]); await pg.wait_for_timeout(900)
            # Create cue: text over the moving loop, no music
            await pg.evaluate("openCard(null)"); await pg.wait_for_timeout(200)
            await pg.fill('#mkTitle', 'Welcome'); await pg.evaluate("mkSetBg(items[0].file,'pc')"); await pg.wait_for_timeout(400)
            await pg.click('#mkOk'); await pg.wait_for_timeout(1500)
            c = await pg.evaluate("(()=>{const i=items[items.length-1];return {type:i.type,text:!!i.text,aud:!!i.audio}})()")
            ok(L + 'made a text-over-moving-loop cue without music', c == {'type': 'video', 'text': True, 'aud': False}, c)
            await pg.evaluate("show(items.length-1)"); await pg.wait_for_timeout(900)
            ok(L + 'its loop is moving', await pg.evaluate("!!pvStage.media&&!pvStage.media.paused"))
            await pg.click('#frz'); await pg.wait_for_timeout(300)
            ok(L + 'FREEZE stops the loop', await pg.evaluate("pvStage.media.paused&&frozen"))
            ok(L + 'FREEZE button shows it is frozen', await pg.evaluate("$('#frz').classList.contains('on')"))
            await pg.click('#frz'); await pg.wait_for_timeout(400)
            ok(L + 'second press restarts the loop', await pg.evaluate("!pvStage.media.paused&&!frozen"))
            await pg.evaluate("go()"); await pg.wait_for_timeout(300)
            ok(L + 'no page errors', not errs, errs)
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
