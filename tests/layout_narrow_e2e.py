"""The smallest desktop window (1100x700): every control of the bottom row is inside the window — MASTER used to be cut off."""
import asyncio, os
from playwright.async_api import async_playwright
APP = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app', 'cuey.html'))
res = []
def ok(name, cond, info=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  -> ' + str(info)[:300]))
JS = "(()=>{const q=s=>{const r=document.querySelector(s).getBoundingClientRect();return [Math.round(r.left),Math.round(r.right),Math.round(r.width),Math.round(r.height)]};return {w:innerWidth,take:q('#take'),back:q('#back'),go:q('#go'),frz:q('#frz'),blk:q('#blk'),mv:q('.mvol'),sx:document.documentElement.scrollWidth}})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        for lang in ('en', 'he'):
            for w, h in ((1100, 700), (1280, 720), (1512, 945)):
                pg = await b.new_page(viewport={'width': w, 'height': h}); await pg.goto(APP + '?nosplash&notour&lang=' + lang); await pg.wait_for_timeout(700)
                d = await pg.evaluate(JS); order = ['take', 'back', 'go', 'frz', 'blk', 'mv']
                ok(f'{lang} {w}x{h}: the whole bottom row is inside the window, MASTER included', all(d[k][0] >= 460 and d[k][1] <= w for k in order) and d['sx'] <= w, d)
                ok(f'{lang} {w}x{h}: no control overlaps the next one, and GO stays the big button', all(d[order[i]][1] <= d[order[i + 1]][0] for i in range(5)) and d['go'][2] >= 180 and d['go'][2] > max(d['frz'][2], d['back'][2]) * 1.6, d)
                ok(f'{lang} {w}x{h}: BACK stays on one line', await pg.evaluate("(()=>{const e=document.querySelector('#back'),r=document.createRange();r.selectNodeContents(e);const t=[...r.getClientRects()].map(q=>Math.round(q.top));return Math.max(...t)-Math.min(...t)<6})()"))
                await pg.close()
        # a small ✕ in the corner closes the two builder windows (Avi 25.11)
        pg = await b.new_page(viewport={'width': 1440, 'height': 860}); await pg.goto(APP + '?nosplash&notour&lang=en'); await pg.wait_for_timeout(700)
        for name, opener, dlg, x in (('Create cue', 'openCard()', '#mkDlg', '#mkXc'), ('AI Builder', 'openDirector()', '#dirDlg', '#dirXc')):
            await pg.evaluate(opener); await pg.wait_for_timeout(700)
            r = await pg.evaluate("([d,x])=>{const D=document.querySelector(d),X=document.querySelector(x).getBoundingClientRect(),B=D.querySelector('.dbox').getBoundingClientRect();return {open:!D.hidden,inCorner:X.top-B.top<24&&B.right-X.right<24&&X.width>=24}}", [dlg, x])
            await pg.click(x); await pg.wait_for_timeout(300)
            ok(f'{name}: a ✕ in the corner, and it closes the window', r['open'] and r['inCorner'] and await pg.evaluate("d=>document.querySelector(d).hidden", dlg), r)
        await pg.close()
        # PROGRAM and NEXT sit a little lower; small widget panels dock in the strip above them (Avi 25.11)
        FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
        for w, h in ((1100, 700), (1512, 945)):
            pg = await b.new_page(viewport={'width': w, 'height': h}); await pg.goto(APP + '?nosplash&notour&lang=en'); await pg.wait_for_timeout(700)
            await pg.set_input_files('#fileIn', [os.path.join(FIX, f) for f in ('va.webm', 'blue.png', 'va.webm', 'blue.png')]); await pg.wait_for_timeout(1800)
            await pg.evaluate("wtOpen()"); await pg.wait_for_timeout(400); await pg.click('#wpMin'); await pg.wait_for_timeout(300)
            for k in ('qr', 'lower'):
                await pg.evaluate("k=>wxOpen(k)", k); await pg.wait_for_timeout(400); await pg.click(f'#wxp-{k} .wxMin'); await pg.wait_for_timeout(300)
            d = await pg.evaluate("(()=>{const R=e=>{const r=e.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]},pr=R(document.querySelector('.prev')),a=R(document.querySelector('#pvNow')),n=R(document.querySelector('#pvNext')),tl=R(document.querySelector('.tl')),l=R(document.querySelector('#list'));return {pr,a,n,tl,l,p:[...document.querySelectorAll('.wgp')].filter(e=>!e.hidden).map(R)}})()")
            ok(f'{w}x{h}: PROGRAM and NEXT leave a strip above them, and still end above the time line', d['a'][1] - d['pr'][1] >= 120 and d['n'][1] - d['pr'][1] >= 120 and d['a'][3] <= d['tl'][1] and d['n'][3] <= d['tl'][1], d)
            ok(f'{w}x{h}: three small widget panels sit side by side in that strip, on nothing else', len(d['p']) == 3 and all(q[1] >= d['pr'][1] and q[3] <= min(d['a'][1], d['n'][1]) and q[0] >= d['l'][2] and q[2] <= w for q in d['p']) and all(d['p'][i][2] <= d['p'][i + 1][0] for i in range(2)), d)
            await pg.close()
        await b.close()
    print(f"{sum(res)}/{len(res)} passed")
asyncio.run(main())
