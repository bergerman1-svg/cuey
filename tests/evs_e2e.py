"""'Present on event screen' (Avi, 30.10): one button — lime when off, red ON AIR when live; closing asks first;
desktop app offers to extend the screens when there is only one (Windows does it, Mac opens Display settings), and offers
to put them back afterwards. Nothing changes without a yes; asked once per session."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
URL = 'file://' + ROOT + '/app/cuey.html?nosplash&notour&lang='
def native(platform, count, after):
    return ("window.__calls=[];window.__disp=%d;window.cueyNative={onMenu(){},onDownloaded(){},setLang(){},onCanvaCode(){},"
            "displays:async()=>{__calls.push('displays');return {count:__disp,platform:'%s'}},"
            "extendDisplays:async(m)=>{__calls.push('extend:'+m);if(m==='extend')__disp=%d;return {ok:true,count:__disp}},"
            "openDisplaySettings:async()=>{__calls.push('settings');return true}};" % (count, platform, after))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        # ---- the button, both languages (browser)
        for lang, off, live in (('en', 'Present on event screen', 'Event screen live'), ('he', 'הצג על מסך האירוע', 'מסך האירוע פעיל')):
            ctx = await b.new_context(); pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(URL + lang); await pg.wait_for_timeout(600)
            ok(f'[{lang}] off: lime "{off}" with the two-screens icon', await pg.evaluate(f"$('#openOut').classList.contains('off')&&$('#evsT').textContent==={off!r}&&!!$('#openOut svg.evi')"))
            ok(f'[{lang}] no "OUTPUT" left in the top bar', 'OUTPUT' not in (await pg.evaluate("document.querySelector('header').innerText")).upper().replace('EVENT', ''))
            async with pg.expect_popup() as pop:
                await pg.click('#openOut')
            await (await pop.value).wait_for_timeout(400)
            ok(f'[{lang}] live: red "{live}" with the blinking dot', await pg.evaluate(f"$('#openOut').classList.contains('live')&&$('#evsT').textContent==={live!r}&&getComputedStyle($('#openOut .dot')).display!=='none'"))
            ok(f'[{lang}] the small ✕ is gone (it closed without asking)', await pg.evaluate("$('#closeOut').hidden"))
            await pg.evaluate("$('#mClose').disabled=false;$('#mClose').click()"); await pg.wait_for_timeout(200)
            ok(f'[{lang}] the menu "Close" also asks first', await pg.evaluate("!!$('#evsQ')&&!!outStage"))
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
            ok(f'[{lang}] Escape = Cancel', await pg.evaluate("!$('#evsQ')&&!!outStage"))
            ok(f'[{lang}] no page errors', not errs, errs)
            await ctx.close()
        # ---- desktop, Windows, one screen → extend → open → close → put back
        ctx = await b.new_context(); await ctx.add_init_script(native('win32', 1, 2)); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL + 'he'); await pg.wait_for_timeout(600)
        await pg.click('#openOut'); await pg.wait_for_timeout(300)
        t = await pg.evaluate("$('#extQ')?$('#extQ').innerText:''")
        ok('Windows, one screen: asks "להרחיב את המסכים?"', 'להרחיב את המסכים' in t, t)
        ok('…and nothing changed yet', await pg.evaluate("!__calls.includes('extend:extend')&&!outStage"))
        async with pg.expect_popup() as pop:
            await pg.click('#extQ .pri')
        await (await pop.value).wait_for_timeout(400)
        ok('Yes: Cuey extends the screens, then opens the event screen', await pg.evaluate("__calls.includes('extend:extend')&&!!outStage&&$('#openOut').classList.contains('live')"))
        await pg.click('#openOut'); await pg.wait_for_timeout(200); await pg.click('#evsQ [data-v=yes]'); await pg.wait_for_timeout(400)
        t = await pg.evaluate("$('#extB')?$('#extB').innerText:''")
        ok('after closing: offers to put the screens back', 'להחזיר' in t and not await pg.evaluate("!!outStage"), t)
        await pg.click('#extB .pri'); await pg.wait_for_timeout(200)
        ok('Put back: Cuey returns them to a copy', await pg.evaluate("__calls.includes('extend:clone')"))
        ok('Windows: no page errors', not errs, errs)
        await ctx.close()
        # ---- desktop, Windows, "Not now" → opens here, not asked again this session
        ctx = await b.new_context(); await ctx.add_init_script(native('win32', 1, 1)); pg = await ctx.new_page()
        await pg.goto(URL + 'en'); await pg.wait_for_timeout(600)
        await pg.click('#openOut'); await pg.wait_for_timeout(300)
        async with pg.expect_popup() as pop:
            await pg.click('#extQ [data-v=here]')
        await (await pop.value).wait_for_timeout(300)
        ok('"Not now": opens on this screen, screens untouched', await pg.evaluate("!!outStage&&!__calls.some(c=>c.startsWith('extend'))"))
        await pg.click('#openOut'); await pg.wait_for_timeout(200); await pg.click('#evsQ [data-v=yes]'); await pg.wait_for_timeout(300)
        ok('nothing to put back when Cuey did not extend', await pg.evaluate("!$('#extB')"))
        async with pg.expect_popup() as pop:
            await pg.click('#openOut')
        await (await pop.value).wait_for_timeout(300)
        ok('asked once per session (second time it just opens)', await pg.evaluate("!$('#extQ')&&!!outStage"))
        await ctx.close()
        # ---- desktop, Mac, one screen → opens Display settings, does not open the event screen yet
        ctx = await b.new_context(); await ctx.add_init_script(native('darwin', 1, 1)); pg = await ctx.new_page()
        await pg.goto(URL + 'he'); await pg.wait_for_timeout(600)
        await pg.click('#openOut'); await pg.wait_for_timeout(300)
        t = await pg.evaluate("$('#extQ')?$('#extQ').innerText:''")
        ok('Mac: explains "מסך מורחב" and offers Display settings', 'מסך מורחב' in t and 'הגדרות מסכים' in t, t)
        await pg.click('#extQ .pri'); await pg.wait_for_timeout(200)
        ok('Mac: opens Display settings, waits for the operator', await pg.evaluate("__calls.includes('settings')&&!outStage"))
        await ctx.close()
        # ---- desktop, two screens: no question at all
        ctx = await b.new_context(); await ctx.add_init_script(native('win32', 2, 2)); pg = await ctx.new_page()
        await pg.goto(URL + 'he'); await pg.wait_for_timeout(600)
        async with pg.expect_popup() as pop:
            await pg.click('#openOut')
        await (await pop.value).wait_for_timeout(300)
        ok('two screens already: opens straight away, no question', await pg.evaluate("!$('#extQ')&&!!outStage"))
        await ctx.close()
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
