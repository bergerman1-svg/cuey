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
        await b.close()
    print(f"{sum(res)}/{len(res)} passed")
asyncio.run(main())
