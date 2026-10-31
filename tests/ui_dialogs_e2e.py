"""Cuey's own dialogs instead of the system's (Mac debug, 31.10.2026: the export question came out as a grey macOS alert with
English "Cancel / OK" and mixed-up Hebrew). Clear / export / delete-slide-show ask in Cuey's look, in the app language;
messages never block; the update notice follows the language and never covers the cue list."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
URL = 'file://' + ROOT + '/app/cuey.html?nosplash&notour&lang='
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''), flush=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); pg = await ctx.new_page(); errs = []; sysd = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: (sysd.append(d.message), asyncio.ensure_future(d.dismiss())))
        await pg.goto(URL + 'he'); await pg.wait_for_timeout(600)
        await pg.set_input_files('#fileIn', [os.path.join(FIX, n) for n in ('red.png', 'green.png', 'blue.png')]); await pg.wait_for_timeout(900)
        await pg.click('#clearAll'); await pg.wait_for_timeout(200)
        t = await pg.evaluate("document.querySelector('.uiq')?document.querySelector('.uiq').innerText:''")
        ok('Clear asks in Cuey\'s own window, in Hebrew', 'לנקות את כל הרשימה' in t and 'ביטול' in t and 'נקה' in t, t)
        ok('…the red Clear is not the default (Cancel has focus)', await pg.evaluate("document.activeElement&&document.activeElement.dataset.v==='no'"))
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
        ok('Escape = cancel: the list stays', await pg.evaluate("items.length") == 3 and not await pg.evaluate("!!document.querySelector('.uiq')"))
        await pg.click('#clearAll'); await pg.wait_for_timeout(150); await pg.click('.uiq .dang'); await pg.wait_for_timeout(200)
        ok('Clear → the list is empty', await pg.evaluate("items.length") == 0)
        await pg.evaluate("alert('בדיקה')"); await pg.wait_for_timeout(150)
        ok('a message shows in Cuey\'s window with one button, and does not block', await pg.evaluate("(()=>{const d=document.querySelector('.uiq');return !!d&&d.querySelectorAll('button').length===1&&d.innerText.includes('בדיקה')})()"))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(100)
        ok('…Enter closes it', not await pg.evaluate("!!document.querySelector('.uiq')"))
        # slide show delete asks in-app; cancel keeps it
        await pg.set_input_files('#fileIn', [os.path.join(FIX, n) for n in ('red.png', 'green.png')]); await pg.wait_for_timeout(800)
        await pg.evaluate("selAll();makeGroup()"); await pg.wait_for_timeout(200)
        g = await pg.evaluate("Object.keys(groups)[0]")
        await pg.evaluate(f"grpAct('{g}','del')"); await pg.wait_for_timeout(150)
        ok('Delete slide show asks in Cuey\'s window', 'Slide show' in await pg.evaluate("document.querySelector('.uiq')?document.querySelector('.uiq').innerText:''"))
        await pg.click('.uiq [data-v=no]'); await pg.wait_for_timeout(150)
        ok('…Cancel keeps the slide show and its cues', await pg.evaluate(f"!!groups['{g}']&&items.length===2"))
        await pg.evaluate(f"grpAct('{g}','del')"); await pg.wait_for_timeout(150); await pg.click('.uiq .dang'); await pg.wait_for_timeout(200)
        ok('…Delete removes it', await pg.evaluate(f"!groups['{g}']&&items.length===0"))
        ok('no system alert / confirm was ever shown', not sysd, sysd)
        # status lines in Hebrew are not in the typewriter font
        await pg.evaluate("openRemote()"); await pg.wait_for_timeout(200)
        ff = await pg.evaluate("getComputedStyle(document.querySelector('#rmStat')).fontFamily")
        ok('Hebrew status line ("מחכה לטלפון…") uses the normal font', 'mono' not in ff.lower() and 'jetbrains' not in ff.lower(), ff)
        await pg.evaluate("$('#rmDlg').hidden=true")
        # update notice: follows the language, sits over the monitors (not over Add / Clear)
        await pg.evaluate("UPD.latest='99.0.0';UPD.later='';UPD.desk=false;updShow()"); await pg.wait_for_timeout(100)
        if await pg.evaluate("$('#updBar').hidden"):
            await pg.evaluate("$('#updBar').hidden=false")
        await pg.evaluate("setLang('en')"); await pg.wait_for_timeout(150)
        ok('update notice switches language with Cuey', 'Cuey' in await pg.evaluate("$('#updBar').innerText") and not any('֐' <= ch <= '׿' for ch in await pg.evaluate("$('#updBar').innerText")))
        hit = await pg.evaluate("(()=>{const a=$('#updBar').getBoundingClientRect(),c=$('#clearAll').getBoundingClientRect(),d=$('#addBtn').getBoundingClientRect();const o=(r,s)=>!(r.right<=s.left||s.right<=r.left||r.bottom<=s.top||s.bottom<=r.top);return o(a,c)||o(a,d)})()")
        ok('update notice never covers Add / Clear', not hit)
        ok('no page errors', not errs, errs[:3])
        print(f'\n{sum(res)}/{len(res)} passed', flush=True)
        await b.close()
asyncio.run(main())
