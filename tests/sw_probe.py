"""Offline / service-worker probe: serve /tmp/cuey/docs on localhost, install the SW, then go offline."""
import asyncio, json, os, subprocess, time
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 8765
BASE = f'http://localhost:{PORT}/app/'
def P(*a): print(*a, flush=True)
async def main():
    srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '-d', '/tmp/cuey/docs'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
            ctx = await b.new_context(service_workers='allow')
            hits = {'user': 0}
            async def sb(route):
                u = route.request.url
                if '/auth/v1/user' in u:
                    hits['user'] += 1
                    em = 'first@example.com' if hits['user'] == 1 else 'second@example.com'
                    await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*'}, body=json.dumps({'email': em, 'id': str(hits['user'])}))
                else:
                    await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*'}, body='[]')
            await ctx.route('https://lgemvnntlgasxhrpsdww.supabase.co/**', sb)
            await ctx.route('https://*.goatcounter.com/**', lambda r: r.fulfill(status=200, body=''))
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(BASE + '?nosplash&notour'); await pg.wait_for_timeout(1500)
            await pg.evaluate("navigator.serviceWorker.ready"); await pg.reload(); await pg.wait_for_timeout(1200)
            P('SW controls page:', await pg.evaluate("!!navigator.serviceWorker.controller"))
            P('shell cache keys (online, fresh install):', await pg.evaluate("caches.open('cuey-shell-v1').then(c=>c.keys()).then(k=>k.map(r=>r.url.replace(location.origin,'')))"))
            # Supabase GET through the SW: same URL twice, two different users
            r1 = await pg.evaluate("sb('/auth/v1/user',null,'tokenA').then(j=>j.email)")
            await pg.wait_for_timeout(300)
            r2 = await pg.evaluate("sb('/auth/v1/user',null,'tokenB').then(j=>j.email)")
            P('GET /auth/v1/user  1st:', r1, ' 2nd (different token):', r2, ' server hits:', hits['user'])
            P('cross-origin entries now in shell cache:', await pg.evaluate("caches.open('cuey-shell-v1').then(c=>c.keys()).then(k=>k.map(r=>r.url).filter(u=>!u.startsWith(location.origin)))"))
            # offline
            await ctx.set_offline(True)
            await pg.reload(); await pg.wait_for_timeout(1500)
            P('offline reload: app loaded =', await pg.evaluate("typeof go==='function'"), ' errors:', errs[:2])
            await pg.add_style_tag(content='#nudge{display:none!important}')
            await pg.set_input_files('#fileIn', [os.path.join(HERE, 'red.png'), os.path.join(HERE, 'deck.pdf')]); await pg.wait_for_timeout(4000)
            P('offline PDF import: items =', await pg.evaluate('items.map(i=>i.name)'), ' flash:', await pg.evaluate("(document.querySelector('#flash')||{}).textContent||''"))
            async with ctx.expect_page() as np:
                await pg.click('#openOut'); await pg.wait_for_timeout(400)
            o = await np.value; await pg.wait_for_timeout(4000)
            P('offline Output window: url', o.url, '| stage present', await o.evaluate("!!document.getElementById('stage')"), '| outStage', await pg.evaluate('!!outStage'), '| has a whole Cuey app inside:', await o.evaluate("typeof go==='function'"))
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(1200)
            P('offline GO -> output shows an image:', await o.evaluate("!!document.querySelector('#stage img')"))
            await b.close()
    finally:
        srv.terminate()
asyncio.run(main())
