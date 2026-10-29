"""'A new version is ready' (Avi, 29.10): an open tab or installed app learns about a new version — never during a show.
Browser: version.json → Refresh (asks to save first). Desktop: latest GitHub release → Download page."""
import asyncio, os, json, re
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
URL = 'file://' + ROOT + '/app/cuey.html?nosplash&notour&lang=he'
BAR = "(()=>{const e=document.getElementById('updBar');return e&&!e.hidden?e.innerText:''})()"
async def page(b, url, latest, desktop=False):
    ctx = await b.new_context(); calls = []
    async def ver(r):
        calls.append(r.request.url); await r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps({'v': latest}))
    async def gh(r):
        calls.append(r.request.url); await r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps({'tag_name': 'v' + latest}))
    await ctx.route(re.compile(r'.*/version\.json.*'), ver)
    await ctx.route(re.compile(r'^https://api\.github\.com/.*'), gh)
    if desktop:
        await ctx.add_init_script("window.cueyNative={onMenu(){},onDownloaded(){},setLang(){},onCanvaCode(){}};window.__opened=[];window.open=(u)=>{window.__opened.push(u);return null}")
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(url); await pg.wait_for_timeout(600)
    return ctx, pg, calls, errs

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        # cuey.html opened from disk: never asks the internet
        ctx, pg, calls, errs = await page(b, URL, '99.0.0')
        await pg.evaluate("updCheck(true)"); await pg.wait_for_timeout(300)
        ok('cuey.html opened from disk: no update check', not calls and not await pg.evaluate(BAR), calls)
        await ctx.close()
        # browser app, same version → nothing
        ctx, pg, calls, errs = await page(b, URL + '&updcheck', '0.0.1')
        await pg.evaluate("updCheck(true)"); await pg.wait_for_timeout(300)
        ok('same or older version: no offer', calls and not await pg.evaluate(BAR), calls)
        await ctx.close()
        # browser app, newer version
        ctx, pg, calls, errs = await page(b, URL + '&updcheck', '99.0.0')
        await pg.evaluate("updCheck(true)"); await pg.wait_for_timeout(300)
        t = await pg.evaluate(BAR)
        ok('newer version: "יש גרסה חדשה של Cuey" with Refresh', 'יש גרסה חדשה של Cuey' in t and 'רענון' in t and '99.0.0' in t, t)
        # during a show: hidden, comes back after
        await pg.evaluate("outWin={closed:false};updShow()")
        ok('during a show (Output open): the offer hides', not await pg.evaluate(BAR))
        await pg.evaluate("outWin=null;updShow()")
        ok('…and comes back when the show is over', bool(await pg.evaluate(BAR)))
        await pg.set_input_files('#fileIn', [os.path.join(FIX, 'tone.wav')]); await pg.wait_for_timeout(800)
        await pg.evaluate("show(0)"); await pg.wait_for_timeout(500); await pg.evaluate("updShow()")
        ok('while sound plays: hidden', not await pg.evaluate(BAR))
        await pg.evaluate("slideAudio.pause();updShow()")
        # Refresh with unsaved changes asks first (nothing is lost)
        await pg.click('#updBar .pri'); await pg.wait_for_timeout(300)
        ok('Refresh with unsaved changes: asks to save first, does not reload', await pg.evaluate("!!document.getElementById('unsDlg')&&items.length===1"))
        await pg.click('#unsDlg [data-v=cancel]'); await pg.wait_for_timeout(200)
        await pg.click('#updBar .lt'); await pg.wait_for_timeout(200)
        await pg.evaluate("updShow()")
        ok('Later: stays away for this version', not await pg.evaluate(BAR))
        ok('browser: no page errors', not errs, errs)
        await ctx.close()
        # desktop app: checks the latest release, offers the download page
        ctx, pg, calls, errs = await page(b, URL, '99.0.0', desktop=True)
        await pg.evaluate("updCheck(true)"); await pg.wait_for_timeout(300)
        t = await pg.evaluate(BAR)
        ok('desktop: checks the latest release (installer exists)', any('api.github.com' in c for c in calls), calls)
        ok('desktop: "יש גרסה חדשה של Cuey למחשב" with Download', 'למחשב' in t and 'להורדה' in t, t)
        await pg.click('#updBar .pri'); await pg.wait_for_timeout(200)
        op = await pg.evaluate("window.__opened")
        ok('desktop: Download opens the download page', op and op[0].endswith('/he/#download'), op)
        ok('desktop: no page errors', not errs, errs)
        await ctx.close()
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
