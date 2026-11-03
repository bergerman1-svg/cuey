"""Create cue: a logo on the card (Avi, 3.11.2026) — add, position, size, it is drawn on the card, saved with the show, removable.
Also the library dictionary: חנוכייה must not search plain 'menorah' (brings Kwanzaa videos)."""
import asyncio, os, json
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''), flush=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        pg = await (await b.new_context(viewport={'width': 1280, 'height': 800})).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route(lambda u: u.startswith('http'), lambda r: r.abort())
        await pg.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour&lang=en'); await pg.wait_for_timeout(700)
        await pg.evaluate("openCard()") if await pg.evaluate("typeof openCard==='function'") else (await pg.click('#addBtn'), await pg.click('#adMk'))
        await pg.wait_for_timeout(500)
        ok('Create cue window is open', await pg.evaluate("!$('#mkDlg').hidden"))
        ok('it has an "Add a logo" button', await pg.evaluate("!!$('#mkLogoAdd')&&!!$('#mkLogoAdd').offsetParent"))
        await pg.fill('#mkTitle', 'Logo test')
        # give it a logo (the picker cannot be driven, so hand the file to the same function the button uses)
        await pg.evaluate("window._fi=document.createElement('input');_fi.type='file';_fi.id='lgfi';document.body.appendChild(_fi)")
        await pg.set_input_files('#lgfi', [os.path.join(FIX, 'red.png')])
        await pg.evaluate("mkLogoSet(document.getElementById('lgfi').files[0])"); await pg.wait_for_timeout(600)
        st = await pg.evaluate("({logo:(mk.T.logo||'').slice(0,22),name:mk.T.logoName,pos:mk.T.logoPos,size:mk.T.logoSize,opts:!$('#mkLogoOpts').hidden})")
        ok('the logo is taken (PNG, name, default top-right, default size)', st['logo'].startswith('data:image/png') and st['name'] == 'red.png' and st['pos'] == 'tr' and abs(st['size'] - .14) < .001, st)
        ok('position and size controls appear', st['opts'], st)
        # it is painted on the preview, top-right
        px = await pg.evaluate("(()=>{const c=$('#mkTx'),x=c.getContext('2d');const d=x.getImageData(Math.round(c.width*.9),Math.round(c.height*.1),1,1).data;return [d[0],d[1],d[2],d[3]]})()")
        ok('the logo is drawn on the card (top-right is red)', px[0] > 150 and px[1] < 90 and px[3] > 0, px)
        await pg.click('#mkLogoPos button[data-l="bl"]') if await pg.evaluate("!!document.querySelector('#mkLogoPos button[data-l=\"bl\"]')") else None
        pos2 = await pg.evaluate("mk.T.logoPos")
        ok('the position can be changed', pos2 != 'tr', pos2)
        await pg.evaluate("$('#mkLogoSize').value=25;$('#mkLogoSize').dispatchEvent(new Event('input',{bubbles:true}))")
        ok('the size can be changed', abs(await pg.evaluate("mk.T.logoSize") - .25) < .001, await pg.evaluate("mk.T.logoSize"))
        await pg.click('#mkOk'); await pg.wait_for_timeout(1500)
        it = await pg.evaluate("(()=>{const i=items[items.length-1];return i?{name:i.name,logo:!!(i.card&&i.card.logo)||!!(i.T&&i.T.logo)||JSON.stringify(i).includes('data:image/png')}:null})()")
        ok('the cue is created with its logo', it and it['logo'], it)
        saved = await pg.evaluate("JSON.stringify(typeof showData==='function'?showData():{}).includes('red.png')")
        ok('the logo is saved with the show', saved)
        # remove
        await pg.evaluate("openCard&&openCard(items[items.length-1])") if await pg.evaluate("typeof openCard==='function'") else None
        if await pg.evaluate("!$('#mkDlg').hidden"):
            await pg.click('#mkLogoX'); await pg.wait_for_timeout(300)
            ok('✕ removes the logo', await pg.evaluate("!mk.T.logo"))
        # library words
        q = await pg.evaluate("[pbQuery('חנוכייה'),pbQuery('סופגניות')]")
        ok('חנוכייה searches "hanukkah menorah" (never plain "menorah")', q[0] == 'hanukkah menorah', q)
        ok('סופגניות searches "donuts"', q[1] == 'donuts', q)
        ok('no page errors', not errs, errs[:3])
        print(f'\n{sum(res)}/{len(res)} passed', flush=True)
        await b.close()
asyncio.run(main())
