"""The two quick toggles on a cue: loop, and go on by itself when the cue ends."""
import asyncio, os, sys
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = 'file://' + os.path.join(ROOT, 'app', 'cuey.html') + '?nosplash&notour'
FX = os.path.join(ROOT, 'tests', 'fixtures')
fails = []; n = [0]
def ok(name, cond, extra=''):
    n[0] += 1
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + str(extra)))
    if not cond: fails.append(name)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        for lang in ('en', 'he'):
            L = f'[{lang}] '
            pg = await b.new_page(viewport={'width': 1360, 'height': 860}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(APP); await pg.wait_for_timeout(600)
            await pg.evaluate(f"setLang('{lang}')")
            await pg.set_input_files('#fileIn', [os.path.join(FX, x) for x in ('v.webm', 'red.png', 'tone.wav', 'blue.png')]); await pg.wait_for_timeout(1200)
            q = lambda i, k: f"document.querySelectorAll('#list .item')[{i}].querySelector('[data-k=\"{k}\"]')"
            kinds = await pg.evaluate("items.map(x=>x.type)")
            iv, ii, ia = kinds.index('video'), kinds.index('image'), kinds.index('audio')
            have = await pg.evaluate(f"[!!{q(iv,'loop')},!!{q(iv,'auto')},!!{q(ii,'loop')},!!{q(ii,'auto')},!!{q(ia,'loop')},!!{q(ia,'auto')}]")
            ok(L + 'a video and a music cue have both toggles; a picture has only the auto one', have == [True, True, False, True, True, True], have)
            tips = await pg.evaluate(f"[{q(iv,'loop')}.title==t('ic_loop'),{q(iv,'auto')}.title==t('ic_auto'),{q(ii,'auto')}.title==t('ic_auto_s',{{s:items[{ii}].hold||5}})]")
            ok(L + 'each toggle says what it does, in the language', all(tips), tips)
            # loop on
            await pg.evaluate(f"{q(iv,'loop')}.click()"); await pg.wait_for_timeout(150)
            st = await pg.evaluate(f"[items[{iv}].loop,{q(iv,'loop')}.classList.contains('on'),{q(iv,'loop')}.getAttribute('aria-pressed'),cur]")
            ok(L + 'tapping loop turns it on, lights it, and does not put the cue live', st[0] is True and st[1] and st[2] == 'true' and st[3] == -1, st)
            # auto on switches loop off (a cue that loops never ends)
            await pg.evaluate(f"{q(iv,'auto')}.click()"); await pg.wait_for_timeout(150)
            st = await pg.evaluate(f"[items[{iv}].loop,items[{iv}].onEnd,{q(iv,'auto')}.classList.contains('on'),{q(iv,'loop')}.classList.contains('on')]")
            ok(L + 'tapping auto turns loop off — one or the other', st == [False, 'next', True, False], st)
            await pg.evaluate(f"{q(iv,'loop')}.click()"); await pg.wait_for_timeout(150)
            st = await pg.evaluate(f"[items[{iv}].loop,items[{iv}].onEnd,{q(iv,'auto')}.classList.contains('on')]")
            ok(L + '…and tapping loop turns auto off', st == [True, 'hold', False], st)
            await pg.evaluate(f"{q(iv,'loop')}.click()"); await pg.evaluate(f"{q(iv,'auto')}.click()"); await pg.wait_for_timeout(150)
            # the video really moves on by itself
            await pg.evaluate(f"show({iv})"); await pg.wait_for_timeout(600)
            await pg.evaluate("(()=>{const m=pvStage.media;if(m&&m.duration)m.currentTime=Math.max(0,m.duration-0.25)})()")
            await pg.wait_for_function(f"cur!=={iv}", timeout=8000)
            ok(L + 'a video with auto on moves to the next cue by itself when it ends', await pg.evaluate(f"cur==={iv}+1"), await pg.evaluate("cur"))
            # picture: auto after its seconds; off again → waits for GO
            await pg.evaluate(f"items[{ii}].hold=1;render()"); await pg.evaluate(f"{q(ii,'auto')}.click()"); await pg.wait_for_timeout(100)
            await pg.evaluate(f"show({ii})"); await pg.wait_for_function(f"cur!=={ii}", timeout=6000)
            ok(L + 'a picture with auto on moves on after its seconds', await pg.evaluate(f"cur==={ii}+1"))
            await pg.evaluate(f"{q(ii,'auto')}.click()"); await pg.wait_for_timeout(100)
            await pg.evaluate(f"show({ii})"); await pg.wait_for_timeout(1800)
            ok(L + '…and with auto off it waits for GO', await pg.evaluate(f"cur==={ii}&&items[{ii}].onEnd==='hold'"))
            # toggling the live cue acts at once
            await pg.evaluate(f"{q(ii,'auto')}.click()"); await pg.wait_for_function(f"cur!=={ii}", timeout=6000)
            ok(L + 'turning auto on while the cue is live starts its countdown', True)
            # music loop reaches the player
            await pg.evaluate(f"show({ia})"); await pg.wait_for_timeout(400); await pg.evaluate(f"{q(ia,'loop')}.click()"); await pg.wait_for_timeout(150)
            ok(L + 'loop on a live music cue reaches the player', await pg.evaluate(f"items[{ia}].loop===true&&slideAudio.loop===true"), await pg.evaluate(f"[items[{ia}].loop,slideAudio.loop]"))
            tags = await pg.evaluate("[...document.querySelectorAll('#list .tg')].map(x=>x.textContent)")
            ok(L + 'the old Loop / Next chips are gone (the toggles show it)', not any('🔁' in x or x.startswith('→') for x in tags), tags)
            if '--shot' in sys.argv:
                await pg.evaluate("clearStages&&clearStages();cur=-1;render()")
                el = await pg.query_selector('#list'); await el.screenshot(path=f'/tmp/qk_{lang}.png')
            ok(L + 'no page errors', not errs, errs[:2])
            await pg.close()
        await b.close()
    print(f'{n[0]-len(fails)}/{n[0]} passed'); sys.exit(1 if fails else 0)
asyncio.run(main())
