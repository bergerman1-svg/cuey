"""Add from Canva (Pro · beta): the whole flow with Canva and our server mocked — runs offline in CI.
Nothing changes for people who didn't opt in (tile stays "SOON"); signed out → sign-in; connect → designs → slides / video → cues;
paid-element and expired-link errors explain themselves."""
import asyncio, os, re, json
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
PNG = open(os.path.join(FIX, 'red.png'), 'rb').read()
VID = open(os.path.join(FIX, 'v.webm'), 'rb').read()
SESS = "saveSess({at:'tk',rt:'rt',exp:Date.now()+3600e3,email:'t@cuey.live',id:'u1'});freshSess&&freshSess();0"

async def setup(b, lang, state):
    ctx = await b.new_context(); calls = []
    async def fn(route):
        req = route.request
        if req.method == 'OPTIONS': return await route.fulfill(status=204, headers={'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*'})
        body = json.loads(req.post_data or '{}'); a = body.get('action'); calls.append(a)
        H = {'Access-Control-Allow-Origin': '*'}
        def js(d, s=200): return route.fulfill(status=s, headers=H, content_type='application/json', body=json.dumps(d))
        if a == 'status': return await js({'connected': state['connected']})
        if a == 'start': return await js({'url': 'https://www.canva.com/api/oauth/authorize?x=1'})
        if a == 'list':
            if state.get('list401'): return await js({'error': 'not_connected'}, 401)
            return await js({'items': [{'id': 'DAF1', 'title': 'Opening slides', 'pages': 2, 'thumb': 'https://document-export.canva.com/t1.png'}, {'id': 'DAF2', 'title': 'Promo clip', 'pages': 1, 'thumb': ''}, {'id': 'DAF3', 'title': '', 'pages': 8, 'thumb': ''}], 'continuation': None})
        if a == 'export':
            if body.get('design_id') == 'DAF2' and state.get('lic'): return await js({'job': {'id': 'J9', 'status': 'failed', 'error': {'code': 'license_required'}}})
            state['kind'] = body.get('kind'); return await js({'job': {'id': 'J1', 'status': 'in_progress'}})
        if a == 'job':
            if state['kind'] == 'mp4': return await js({'job': {'id': 'J1', 'status': 'success', 'urls': ['https://export-download.canva.com/v.mp4']}})
            return await js({'job': {'id': 'J1', 'status': 'success', 'urls': ['https://export-download.canva.com/p1.png', 'https://export-download.canva.com/p2.png']}})
        if a == 'thumb': state['thumbs'] = state.get('thumbs', 0) + 1; return await js({'url': 'https://document-export.canva.com/page1.jpg'})
        if a == 'disconnect': state['connected'] = False; return await js({'ok': True})
        return await js({'error': 'action'}, 400)
    await ctx.route(re.compile(r'.*/functions/v1/canva$'), fn)
    await ctx.route(re.compile(r'^https://export-download\.canva\.com/.*'), lambda r: r.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*'}, body=VID if r.request.url.endswith('.mp4') else PNG, content_type='video/webm' if r.request.url.endswith('.mp4') else 'image/png'))
    await ctx.route(re.compile(r'^https://document-export\.canva\.com/.*'), lambda r: r.fulfill(status=200, body=PNG, content_type='image/png'))
    await ctx.route(re.compile(r'^https://(www\.)?canva\.com/.*'), lambda r: r.fulfill(status=200, body='<html>canva</html>', content_type='text/html'))
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    return ctx, pg, errs, calls

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        URL = 'file://' + ROOT + '/app/cuey.html?nosplash&notour&lang='
        # 1. nobody opted in: exactly as before
        ctx, pg, errs, calls = await setup(b, 'en', {'connected': False})
        await pg.goto(URL + 'en'); await pg.wait_for_timeout(700)
        ok('not opted in: Canva tile still disabled with "SOON"', await pg.evaluate("$('#adCv').disabled&&/SOON/.test($('#adCv').innerText)"))
        ok('not opted in: no calls to the Canva server', not calls, calls)
        await pg.evaluate("saveSess({at:'tk',rt:'rt',exp:Date.now()+3600e3,email:'someone@school.org',id:'u2'});acctUI()")
        ok('signed in as anyone else: still "SOON"', await pg.evaluate("$('#adCv').disabled"))
        await pg.evaluate("saveSess({at:'tk',rt:'rt',exp:Date.now()+3600e3,email:'hello@cuey.live',id:'u1'});acctUI()")
        ok('our own account (also the desktop app): tile is on without ?canva=1', await pg.evaluate("!$('#adCv').disabled"))
        await ctx.close()
        for lang in ('en', 'he'):
            L = f'[{lang}] '; st = {'connected': False}
            ctx, pg, errs, calls = await setup(b, lang, st)
            await pg.goto(URL + lang + '&canva=1'); await pg.wait_for_timeout(700)
            ok(L + 'opted in: tile is on (PRO · BETA)', await pg.evaluate("!$('#adCv').disabled&&/BETA/.test($('#adCv').innerText)"))
            # signed out → sign-in window
            await pg.evaluate("$('#addBtn').click()"); await pg.click('#adCv'); await pg.wait_for_timeout(300)
            ok(L + 'signed out: asks to sign in', await pg.evaluate("!$('#acctDlg').hidden&&$('#cvDlg').hidden"))
            await pg.evaluate("$('#acctDlg').hidden=true;" + SESS)
            # not connected → connect screen
            await pg.evaluate("openCanva()"); await pg.wait_for_timeout(400)
            ok(L + 'not connected yet: "Connect Canva" screen', await pg.evaluate("!$('#cvConn').hidden&&$('#cvPick').hidden"))
            async with pg.expect_popup() as pop:
                await pg.click('#cvGo')
            popup = await pop.value
            ok(L + 'Connect opens Canva in its own window', 'canva.com/api/oauth/authorize' in popup.url, popup.url)
            ok(L + '…and says to finish there', await pg.evaluate("!$('#cvWait').hidden"))
            st['connected'] = True; await popup.close(); await pg.wait_for_timeout(3200)
            ok(L + 'after connecting, Cuey continues by itself to the designs', await pg.evaluate("!$('#cvPick').hidden&&document.querySelectorAll('#cvGrid .cvd').length===3"))
            await pg.wait_for_timeout(600)
            ok(L + 'designs Canva sent no preview for get one (page 1)', await pg.evaluate("document.querySelectorAll('#cvGrid .cvd img').length===3&&!document.querySelector('#cvGrid .cvd i')"))
            un = await pg.evaluate("document.querySelectorAll('#cvGrid .cvd b')[2].textContent")
            ok(L + 'an untitled design is called "Untitled design", not "Canva"', un in ('Untitled design', 'עיצוב ללא שם'), un)
            ok(L + 'nothing chosen yet: the bring-in buttons wait', await pg.evaluate("$('#cvImg').disabled&&$('#cvVid').disabled"))
            # slides
            n0 = await pg.evaluate("items.length")
            await pg.click('#cvGrid .cvd >> nth=0'); await pg.click('#cvImg'); await pg.wait_for_timeout(2500)
            r = await pg.evaluate(f"items.slice({n0}).map(x=>[x.type,x.name])")
            ok(L + 'slides: every page of the design becomes a picture cue, in order', r == [['image', 'Opening slides · 1'], ['image', 'Opening slides · 2']], r)
            ok(L + 'slides: dialog closes when done', await pg.evaluate("$('#cvDlg').hidden"))
            kept = await pg.evaluate(f"Promise.all(items.slice({n0}).map(x=>idbGet('gen:'+x.file.name).then(f=>!!f)))")
            ok(L + 'slides: kept with the show (opens again without Canva)', all(kept), kept)
            # video
            await pg.evaluate("openCanva()"); await pg.wait_for_timeout(500)
            n1 = await pg.evaluate("items.length")
            await pg.click('#cvGrid .cvd >> nth=1'); await pg.click('#cvVid'); await pg.wait_for_timeout(2500)
            r = await pg.evaluate(f"items.slice({n1}).map(x=>[x.type,x.name])")
            ok(L + 'video: the design comes in as one video cue', r == [['video', 'Promo clip']], r)
            # paid elements
            st['lic'] = True; await pg.evaluate("openCanva()"); await pg.wait_for_timeout(500)
            await pg.click('#cvGrid .cvd >> nth=1'); await pg.click('#cvImg'); await pg.wait_for_timeout(800)
            msg = await pg.evaluate("$('#cvErr').textContent")
            ok(L + 'paid Canva elements: says so (not a vague error)', ('paid' in msg) or ('בתשלום' in msg), msg)
            ok(L + '…and the dialog stays open to pick another', await pg.evaluate("!$('#cvDlg').hidden&&!$('#cvImg').disabled"))
            # link to Canva gone → connect again
            st['list401'] = True; await pg.evaluate("$('#cvDlg').hidden=true;openCanva()"); await pg.wait_for_timeout(600)
            ok(L + 'Canva link expired: back to "Connect Canva"', await pg.evaluate("!$('#cvConn').hidden"))
            st['list401'] = False
            # disconnect
            await pg.evaluate("openCanva()"); await pg.wait_for_timeout(500); await pg.click('#cvOut'); await pg.wait_for_timeout(300)
            ok(L + 'Disconnect Canva: forgets the link', 'disconnect' in calls and await pg.evaluate("!$('#cvConn').hidden"))
            rtl = await pg.evaluate("getComputedStyle($('#cvDlg .dbox')).direction")
            if lang == 'he': ok(L + 'Hebrew dialog is right-to-left', rtl == 'rtl', rtl)
            ok(L + 'no page errors', not errs, errs)
            await ctx.close()
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
