"""The beta switch lives on the server (Avi 27.11.2026): app_settings.beta_open.
Open  -> every signed-in user has Studio, as before.
Closed -> every account goes back to the plan it holds; it applies from the next start of Cuey, never in the middle of an event.
The server is played by route handlers; nothing here talks to the real project."""
import asyncio, os, json
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); FIX = os.path.join(HERE, 'fixtures')
APP = 'file://' + os.path.abspath(os.path.join(HERE, '..', 'app', 'cuey.html')) + '?nosplash&notour&lang=en'
res = []
def ok(name, cond, info=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  -> ' + str(info)[:300]))
SESS = "localStorage.setItem('cuey.sess',JSON.stringify({at:'tok',rt:'r',exp:Date.now()+3600e3,email:'tester@example.com',id:'u1'}));"
ST = "({lic:licensed,beta:BETA,mem:localStorage.getItem('cuey.beta'),cur,hold:!!holdTimer})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        srv = {'beta': True, 'plans': [], 'down': False, 'asked': 0}
        async def start(ctx):
            pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            async def settings(route):
                srv['asked'] += 1
                if srv['down']: await route.abort()
                else: await route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps([] if srv['beta'] is None else [{'value': srv['beta']}]))
            async def plans(route):
                if srv['down']: await route.abort()
                else: await route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body=json.dumps(srv['plans']))
            async def other(route):
                if route.request.method == 'OPTIONS': await route.fulfill(status=204, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'})
                else: await route.fulfill(status=200, content_type='application/json', headers={'access-control-allow-origin': '*'}, body='[]')
            await pg.route('**/*supabase.co/**', other)
            await pg.route('**/rest/v1/app_settings*', lambda r: other(r) if r.request.method == 'OPTIONS' else settings(r))
            await pg.route('**/rest/v1/entitlements*', lambda r: other(r) if r.request.method == 'OPTIONS' else plans(r))
            await pg.goto(APP); await pg.wait_for_timeout(1500); return pg, errs
        async def fresh(mem=None, signed=True):
            ctx = await b.new_context(viewport={'width': 1440, 'height': 860})
            await ctx.add_init_script("try{if(!sessionStorage.getItem('_i')){sessionStorage.setItem('_i','1');" + (SESS if signed else '') + ("localStorage.setItem('cuey.beta','%s');" % mem if mem is not None else '') + "}}catch(e){}")  # try: Cuey's sandboxed frames have no storage
            pg, errs = await start(ctx); return ctx, pg, errs

        # 1. open: as before
        srv.update(beta=True, plans=[], down=False, asked=0); ctx, pg, errs = await fresh()
        s = await pg.evaluate(ST); ok('beta open on the server: a signed-in user has Studio', s['lic'] and s['beta'] and s['mem'] == '1' and srv['asked'] >= 1, [s, srv])
        # 2. the server closes it while Cuey runs with a Slide show on the screen
        await pg.set_input_files('#fileIn', [os.path.join(FIX, f) for f in ['blue.png', 'green.png', 'purple.png']]); await pg.wait_for_timeout(1500)
        await pg.evaluate("items.forEach(x=>sel.add(x.id));makeGroup()"); await pg.keyboard.press('Space'); await pg.wait_for_timeout(500)
        srv['beta'] = False; await pg.evaluate("checkPlan()"); await pg.wait_for_timeout(800); s = await pg.evaluate(ST)
        ok('closed while Cuey runs: nothing changes in this run (the show goes on, Studio stays)', s['lic'] and s['beta'] and s['hold'] and s['mem'] == '0' and await pg.evaluate("!gated(items[cur])"), s)
        await pg.reload(); await pg.wait_for_timeout(1500); s = await pg.evaluate(ST)
        ok('…and from the next start a user with no plan is back on Free', not s['lic'] and not s['beta'], s)
        await pg.evaluate("studioGate('out',()=>{})"); await pg.wait_for_timeout(200)
        ok('the Studio window no longer says "free in beta"', await pg.evaluate("!$('#studioDlg').hidden&&!/beta/i.test($('#stBeta').textContent)"), await pg.evaluate("$('#stBeta').textContent"))
        ok('no page errors (1-2)', not errs, errs); await ctx.close()
        # 3. closed, and the account holds a plan
        srv.update(beta=False, plans=[{'product': 'studio', 'expires_at': None}]); ctx, pg, errs = await fresh(mem='0')
        s = await pg.evaluate(ST); ok('closed: an account with Studio keeps Studio', s['lic'] and not s['beta'], s); await ctx.close()
        srv.update(plans=[{'product': 'pro', 'expires_at': '2020-01-01T00:00:00Z'}]); ctx, pg, errs = await fresh(mem='0')
        s = await pg.evaluate(ST); ok('closed: a plan that ran out is Free', not s['lic'], s)
        # 4. opened again: at once
        srv.update(beta=True, plans=[]); await pg.evaluate("checkPlan()"); await pg.wait_for_timeout(800); s = await pg.evaluate(ST)
        ok('opened again on the server: Studio is back at once, with no restart', s['lic'] and s['beta'] and s['mem'] == '1', s); await ctx.close()
        # 5. a copy that never heard from the server, beta already closed
        srv.update(beta=False, plans=[]); ctx, pg, errs = await fresh()
        s = await pg.evaluate(ST); ok('a new copy, beta already closed: Free from the first start', not s['lic'] and not s['beta'] and s['mem'] == '0', s); await ctx.close()
        # 6. no answer from the server
        srv.update(down=True); ctx, pg, errs = await fresh(mem='0')
        await pg.evaluate("localStorage.removeItem('cuey.licensed');checkPlan()"); await pg.wait_for_timeout(800); s = await pg.evaluate(ST)
        ok('offline, last known closed: stays closed', not s['lic'] and not s['beta'] and s['mem'] == '0', s); await ctx.close()
        ctx, pg, errs = await fresh()
        s = await pg.evaluate(ST); ok('offline, never heard from the server: open, as before', s['lic'] and s['beta'] and s['mem'] is None, s)
        ok('no page errors (6)', not errs, errs); await ctx.close()
        # 7. the row is missing / signed out
        srv.update(down=False, beta=None, plans=[]); ctx, pg, errs = await fresh()
        s = await pg.evaluate(ST); ok('the setting is missing on the server: open, as before', s['lic'] and s['beta'], s); await ctx.close()
        srv.update(beta=False, asked=0); ctx, pg, errs = await fresh(signed=False)
        s = await pg.evaluate(ST); ok('signed out: Free, and Cuey does not ask the server', not s['lic'] and srv['asked'] == 0, [s, srv['asked']]); await ctx.close()
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed'); raise SystemExit(0 if all(res) else 1)
asyncio.run(main())
