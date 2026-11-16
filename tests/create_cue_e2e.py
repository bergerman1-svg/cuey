"""Create cue: frames with corner handles on the text and the logo, resize by dragging a corner, snapping, a font choice."""
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
        b = await p.chromium.launch()
        for lang in ('en', 'he'):
            L = f'[{lang}] '
            pg = await b.new_page(viewport={'width': 1360, 'height': 900}); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(APP); await pg.wait_for_timeout(600)
            await pg.evaluate(f"setLang('{lang}')")
            await pg.evaluate("openCard(null)"); await pg.wait_for_timeout(300)
            await pg.fill('#mkTitle', 'ערב זמר' if lang == 'he' else 'Welcome'); await pg.fill('#mkBody', 'היכל התרבות' if lang == 'he' else 'Annual meeting'); await pg.wait_for_timeout(400)
            geo = "(()=>{const pv=$('#mkPv').getBoundingClientRect(),R=mk.rect,c=$('#mkTx'),k=pv.width/c.width;return {l:pv.left,t:pv.top,k,x:R.x,y:R.y,w:R.w,h:R.h}})()"
            g = await pg.evaluate(geo)
            fr = await pg.evaluate("(()=>{const e=$('#mkSelT'),r=e.getBoundingClientRect();return {hidden:e.hidden,l:r.left,t:r.top,w:r.width,h:r.height,handles:e.querySelectorAll('i').length}})()")
            ok(L + 'the text block has a frame with four handles, exactly around it', (not fr['hidden']) and fr['handles'] == 4 and abs(fr['l'] - (g['l'] + g['x'] * g['k'])) < 1.5 and abs(fr['w'] - g['w'] * g['k']) < 1.5 and abs(fr['t'] - (g['t'] + g['y'] * g['k'])) < 1.5, [fr, g])
            ok(L + 'no logo → no logo frame', await pg.evaluate("$('#mkSelL').hidden"))
            # hover: the frame lights, the cursor says what will happen
            cx, cy = g['l'] + (g['x'] + g['w'] / 2) * g['k'], g['t'] + (g['y'] + g['h'] / 2) * g['k']
            await pg.mouse.move(cx, cy); await pg.wait_for_timeout(120)
            ok(L + 'pointing at the text lights its frame and shows a grab hand', await pg.evaluate("$('#mkSelT').classList.contains('hot')&&$('#mkPv').style.cursor==='grab'"), await pg.evaluate("$('#mkPv').style.cursor"))
            brx, bry = g['l'] + (g['x'] + g['w']) * g['k'], g['t'] + (g['y'] + g['h']) * g['k']
            await pg.mouse.move(brx, bry); await pg.wait_for_timeout(120)
            ok(L + 'pointing at a corner shows a resize arrow', await pg.evaluate("$('#mkPv').style.cursor==='nwse-resize'"), await pg.evaluate("$('#mkPv').style.cursor"))
            # drag the corner out → bigger; in → smaller; the slider follows
            s0 = await pg.evaluate("mk.T.size")
            await pg.mouse.down(); await pg.mouse.move(brx + 60, bry + 34, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(150)
            s1 = await pg.evaluate("[mk.T.size,+$('#mkSize').value]")
            ok(L + 'dragging a corner outwards makes the text bigger, and the Size slider follows', s1[0] > s0 + 8 and s1[1] == s1[0], [s0, s1])
            g = await pg.evaluate(geo); tlx, tly = g['l'] + g['x'] * g['k'], g['t'] + g['y'] * g['k']; ccx, ccy = g['l'] + (g['x'] + g['w'] / 2) * g['k'], g['t'] + (g['y'] + g['h'] / 2) * g['k']
            await pg.mouse.move(tlx, tly); await pg.mouse.down(); await pg.mouse.move((tlx + ccx) / 2, (tly + ccy) / 2, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(150)
            s2 = await pg.evaluate("mk.T.size")
            ok(L + 'dragging a corner inwards makes it smaller', s2 < s1[0] - 8, [s1, s2])
            pos = await pg.evaluate("[mk.T.x,mk.T.y]")
            ok(L + 'resizing does not move the block', abs(pos[0] - .5) < .01 and abs(pos[1] - .5) < .01, pos)
            await pg.evaluate("mk.T.size=110;$('#mkSize').value=110;mkDraw()")
            g = await pg.evaluate(geo); brx, bry = g['l'] + (g['x'] + g['w']) * g['k'], g['t'] + (g['y'] + g['h']) * g['k']
            await pg.mouse.move(brx, bry); await pg.mouse.down(); await pg.mouse.move(brx + 900, bry + 600, steps=4); await pg.mouse.up()
            ok(L + 'the size stops at its limits', await pg.evaluate("mk.T.size") == 220, await pg.evaluate("mk.T.size"))
            await pg.evaluate("mk.T.size=110;$('#mkSize').value=110;mkDraw()")
            # moving still works, and snaps to the middle
            g = await pg.evaluate(geo); cx, cy = g['l'] + (g['x'] + g['w'] / 2) * g['k'], g['t'] + (g['y'] + g['h'] / 2) * g['k']
            await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx + 130, cy - 90, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(120)
            pos = await pg.evaluate("[mk.T.x,mk.T.y]")
            ok(L + 'the block still moves when grabbed in the middle', pos[0] > .55 and pos[1] < .45, pos)
            fr = await pg.evaluate("(()=>{const r=$('#mkSelT').getBoundingClientRect(),pv=$('#mkPv').getBoundingClientRect(),R=mk.rect,k=pv.width/1920;return Math.abs(r.left-(pv.left+R.x*k))+Math.abs(r.top-(pv.top+R.y*k))})()")
            ok(L + 'the frame follows the block', fr < 2, fr)
            # fonts
            f0 = await pg.evaluate("[...$('#mkFont').querySelectorAll('button')].map(b=>[b.textContent,b.classList.contains('on')])")
            ok(L + 'three fonts to choose from, Modern is on', len(f0) == 3 and f0[0][1] and not f0[1][1] and f0[0][0] == ('מודרני' if lang == 'he' else 'Modern'), f0)
            sig = "(()=>{const d=$('#mkTx').getContext('2d').getImageData(0,0,1920,1080).data;let h=0;for(let i=3;i<d.length;i+=97)h=(h*31+d[i])>>>0;return h})()"
            h0 = await pg.evaluate(sig)
            await pg.click('#mkFont button[data-f="serif"]'); await pg.wait_for_timeout(700); h1 = await pg.evaluate(sig)
            await pg.click('#mkFont button[data-f="light"]'); await pg.wait_for_timeout(700); h2 = await pg.evaluate(sig)
            st = await pg.evaluate("[mk.T.font,$('#mkFont button[data-f=\"light\"]').classList.contains('on')]")
            ok(L + 'each font really changes the picture', len({h0, h1, h2}) == 3 and st == ['light', True], [h0, h1, h2, st])
            await pg.click('#mkFont button[data-f="serif"]'); await pg.wait_for_timeout(300)
            # logo: frame, snap to the middle
            await pg.evaluate("(async()=>{const c=document.createElement('canvas');c.width=300;c.height=120;const x=c.getContext('2d');x.fillStyle='#f04';x.fillRect(0,0,300,120);const bl=await new Promise(r=>c.toBlob(r,'image/png'));await mkLogoSet(new File([bl],'logo.png',{type:'image/png'}))})()"); await pg.wait_for_timeout(500)
            lf = await pg.evaluate("(()=>{const e=$('#mkSelL'),r=e.getBoundingClientRect(),pv=$('#mkPv').getBoundingClientRect(),B=logoBox,k=pv.width/B.W;return {hidden:e.hidden,d:Math.abs(r.left-(pv.left+B.x*k))+Math.abs(r.width-B.w*k),cx:pv.left+(B.x+B.w/2)*k,cy:pv.top+(B.y+B.h/2)*k,mx:pv.left+pv.width/2,my:pv.top+pv.height*.2}})()")
            ok(L + 'the logo gets its own frame', (not lf['hidden']) and lf['d'] < 2, lf)
            await pg.mouse.move(lf['cx'], lf['cy']); await pg.mouse.down(); await pg.mouse.move(lf['mx'] + 6, lf['my'], steps=8); await pg.wait_for_timeout(80)
            snap = await pg.evaluate("[$('#mkPv').classList.contains('snapx'),mk.T.logoXY.x]"); await pg.mouse.up()
            ok(L + 'the logo snaps to the middle line while dragged', snap[0] and abs(snap[1] - .5) < 1e-6, snap)
            # create → the cue keeps it all; reopen shows it
            await pg.evaluate("mk.T.size=150;mkDraw()"); await pg.click('#mkOk'); await pg.wait_for_function("items.length===1", timeout=15000); await pg.wait_for_timeout(300)
            keep = await pg.evaluate("[items[0].text.font,items[0].text.size,!!items[0].url]")
            ok(L + 'the cue is created with the chosen font and size', keep == ['serif', 150, True], keep)
            await pg.evaluate("editText(items[0])"); await pg.wait_for_timeout(400)
            re = await pg.evaluate("[$('#mkFont button[data-f=\"serif\"]').classList.contains('on'),+$('#mkSize').value,!$('#mkSelT').hidden,!$('#mkSelL').hidden]")
            ok(L + 'opening it again shows the same font, size and frames', re == [True, 150, True, True], re)
            if '--shot' in sys.argv:
                g = await pg.evaluate(geo); await pg.mouse.move(g['l'] + (g['x'] + g['w'] / 2) * g['k'], g['t'] + (g['y'] + g['h'] / 2) * g['k']); await pg.wait_for_timeout(200)
                el = await pg.query_selector('#mkDlg .dbox'); await el.screenshot(path=f'/tmp/mk_{lang}.png')
            await pg.evaluate("mkClose()")
            # a cue made before this (no font field) opens as Modern and draws as before
            await pg.evaluate("delete items[0].text.font;editText(items[0])"); await pg.wait_for_timeout(300)
            ok(L + 'an older cue without a font opens as Modern', await pg.evaluate("$('#mkFont button[data-f=\"\"]').classList.contains('on')&&mk.T.font===undefined"))
            await pg.evaluate("mkClose()")
            ok(L + 'no page errors', not errs, errs[:2])
            await pg.close()
        await b.close()
    print(f'{n[0]-len(fails)}/{n[0]} passed'); sys.exit(1 if fails else 0)
asyncio.run(main())
