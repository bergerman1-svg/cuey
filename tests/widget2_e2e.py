"""Five more widgets (asked for 20.11): ticker, speaker name, logo, QR code, brand frame. Each sits over any cue on PROGRAM and on the
event screen, is run from a small floating panel of its own, is painted into the shared-screen picture, never into an export,
hides under BLACK and is saved with the show (always off when a show opens)."""
import asyncio, os, json
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:340]) if extra and not c else ''))
# one widget measured against the 16:9 picture of a window (w = main window or the event screen)
M = """((k,o)=>{try{const W=o?outWin:window,d=W.document,e=d.querySelector('#wxEdge>[data-k='+k+'],#wxLayer>[data-k='+k+']');if(!e)return null;const L=e.parentElement,r=e.getBoundingClientRect(),b=L.getBoundingClientRect(),cs=W.getComputedStyle(e);
  return {on:cs.visibility==='visible'&&+cs.opacity>.9&&W.getComputedStyle(L).display!=='none',cls:e.className,x:(r.left-b.left)/b.width,y:(r.top-b.top)/b.height,w:r.width/b.width,h:r.height/b.height,cx:(r.left+r.width/2-b.left)/b.width,cy:(r.top+r.height/2-b.top)/b.height,
    inside:r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1,bg:cs.backgroundColor,col:cs.color,txt:e.textContent,pe:cs.pointerEvents,box:[b.width/W.innerWidth,b.height/W.innerHeight]}}catch(x){return 'ERR '+x}})"""
async def m(pg, k, out=False):
    return await pg.evaluate(M + "(%s,%s)" % (json.dumps(k), 'true' if out else 'false'))
def near(a, b, t=.012):
    return abs(a - b) <= t
async def opn(pg, k):
    await pg.evaluate("$('#addDlg').hidden=false"); await pg.click('#adWg'); await pg.click('#wg' + k[0].upper() + k[1:]); await pg.wait_for_timeout(250)
async def setf(pg, k, f, v, leave='Tab'):
    await pg.evaluate("wgpTop($('#wxp-%s'))" % k); await pg.click('#wxp-%s [data-f=%s]' % (k, f)); await pg.keyboard.press('ControlOrMeta+a'); await pg.keyboard.press('Delete'); await pg.keyboard.type(v)
    if leave: await pg.keyboard.press(leave); await pg.evaluate("document.activeElement&&document.activeElement.blur()")
    await pg.wait_for_timeout(250)
async def rng(pg, k, f, v):
    await pg.evaluate("(([k,f,v])=>{const e=document.querySelector('#wxp-'+k+' [data-f='+f+']');e.value=v;e.dispatchEvent(new Event('input'))})", [k, f, v]); await pg.wait_for_timeout(200)
async def col(pg, k, f, v):
    await rng(pg, k, f, v)
async def show(pg, k):
    await pg.evaluate("wgpTop($('#wxp-%s'))" % k); await pg.click('#wxp-%s .wxShow' % k); await pg.wait_for_timeout(900)
async def close(pg, k):
    await pg.evaluate("wgpTop($('#wxp-%s'))" % k)
    if await pg.evaluate("WX[%s].on" % json.dumps(k)): await pg.click('#wxp-%s .wxX' % k)
    await pg.click('#wxp-%s .wxX' % k); await pg.wait_for_timeout(700)
PIX = "((x,y)=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');drawFrame(g,1280,720);return [...g.getImageData(Math.round(x*1280),Math.round(y*720),1,1).data].slice(0,3)})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        for lang in ('en', 'he'):
            L = f'[{lang}] '; he = lang == 'he'
            ctx = await b.new_context(viewport={'width': 1600, 'height': 900}); pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('file://' + ROOT + f'/app/cuey.html?nosplash&notour&lang={lang}'); await pg.wait_for_timeout(700)
            await pg.set_input_files('#fileIn', [os.path.join(FIX, n) for n in ('blue.png', 'green.png', 'red.png')]); await pg.wait_for_timeout(1000)
            await pg.click('#list .item >> nth=0'); await pg.wait_for_timeout(700)
            async with ctx.expect_page() as np:
                await pg.evaluate("openOut()")
            out = await np.value; await out.set_viewport_size({'width': 1280, 'height': 720}); await pg.bring_to_front(); await pg.wait_for_timeout(700)
            # ---------- gallery ----------
            await pg.evaluate("$('#addDlg').hidden=false"); await pg.click('#adWg'); await pg.wait_for_timeout(200)
            g = await pg.evaluate("({cards:document.querySelectorAll('#wgDlg button.wgc').length,soon:document.querySelectorAll('#wgDlg .soon').length,names:[...document.querySelectorAll('#wgDlg .wgc b')].map(e=>e.textContent)})")
            ok(L + 'the gallery has six widgets to open, none marked SOON', g['cards'] == 6 and g['soon'] == 0 and all(g['names']), g)
            await pg.click('#wgX')
            ok(L + 'nothing is on the screen before a widget is shown', not any([(await m(pg, k) or {}).get('on') for k in ('ticker', 'lower', 'logo', 'qr', 'frame')]))
            # ---------- ticker ----------
            await opn(pg, 'ticker')
            geo = await pg.evaluate("(()=>{const p=$('#wxp-ticker'),r=p.getBoundingClientRect(),hit=e=>{const b=e.getBoundingClientRect();return !(r.right<=b.left||r.left>=b.right||r.bottom<=b.top||r.top>=b.bottom)};return {open:!p.hidden,w:r.width,h:r.height,go:hit($('#go').parentElement),now:hit($('#pvNow')),next:hit($('#pvNext')),cue:[...$('#list').children].some(hit),modal:[...document.querySelectorAll('.dlg')].some(d=>!d.hidden),ovf:[...p.querySelectorAll('button,input,textarea')].some(e=>e.offsetParent&&e.getBoundingClientRect().right>r.right-4)}})()")
            ok(L + 'the ticker opens as a small floating panel that covers no GO row, preview or cue', geo['open'] and geo['w'] <= 260 and not (geo['go'] or geo['now'] or geo['next'] or geo['cue'] or geo['modal'] or geo['ovf']), geo)
            await pg.evaluate("wgpTop($('#wxp-ticker'))"); await pg.click('#wxp-ticker .wxShow'); await pg.wait_for_timeout(500)
            ok(L + 'Show with no text shows nothing and says what is missing', not (await m(pg, 'ticker'))['on'] and await pg.evaluate("!WX.ticker.on&&$('#wxp-ticker .wpst').classList.contains('need')&&$('#wxp-ticker .wpst').textContent.length>5"))
            cur0 = await pg.evaluate("cur")
            await pg.evaluate("wgpTop($('#wxp-ticker'))"); await pg.click('#wxp-ticker [data-f=text]'); await pg.keyboard.type('a b c'); await pg.wait_for_timeout(150)
            ok(L + 'typing in a widget field (spaces too) never moves the show', await pg.evaluate("cur") == cur0)
            TXT = 'ברוכים הבאים לכנס · ההרצאה הבאה בשעה 11:30' if he else 'Welcome to the conference · next talk at 11:30'
            await setf(pg, 'ticker', 'text', TXT); await show(pg, 'ticker')
            await pg.click('#wxp-ticker .wxShow'); await pg.wait_for_timeout(950); await pg.click('#wxp-ticker .wxShow'); await pg.wait_for_timeout(260)
            fo = await pg.evaluate("[+getComputedStyle(document.querySelector('#pvNow .wx-ticker')).opacity,+outWin.getComputedStyle(outWin.document.querySelector('.wx-ticker')).opacity]"); await pg.wait_for_timeout(800)
            ok(L + 'it goes off and comes on in a fade, not a cut, on both screens', all(.05 < v < .97 for v in fo), fo)
            a = await m(pg, 'ticker'); o = await m(pg, 'ticker', True)
            ok(L + 'the ticker is on PROGRAM and on the event screen', a['on'] and o['on'] and TXT in a['txt'] and TXT in o['txt'], [a, o])
            ok(L + 'a bar across the bottom of the picture, the same share of it on both', near(a['x'], 0) and near(a['w'], 1) and near(a['y'] + a['h'], 1) and near(a['h'], o['h'], .006) and near(o['y'] + o['h'], 1) and .08 < a['h'] < .18, [a, o])
            mv = "(o=>{const W=o?outWin:window,e=W.document.querySelector('#wxEdge .tkm');return [new W.DOMMatrix(W.getComputedStyle(e).transform).m41,e.getBoundingClientRect().width/2,W.document.getElementById('wxEdge').getBoundingClientRect().width,e.children.length]})"
            t1 = await pg.evaluate(mv + "(false)"); t1o = await pg.evaluate(mv + "(true)"); await pg.wait_for_timeout(700); t2 = await pg.evaluate(mv + "(false)"); t2o = await pg.evaluate(mv + "(true)")
            ok(L + 'the text runs, on both screens', abs(t2[0] - t1[0]) > 3 and abs(t2o[0] - t1o[0]) > 3, [t1, t2, t1o, t2o])
            ok(L + 'and never leaves a gap: one half of the strip is wider than the picture', t1[1] >= t1[2] and t1o[1] >= t1o[2] * .98 and t1[3] % 2 == 0, [t1, t1o])
            ok(L + 'Hebrew runs the Hebrew way (to the right), English to the left', (t2[0] > t1[0]) == he and ('rtl' in a['cls']) == he, [t1, t2, a['cls']])
            sp = await pg.evaluate("(()=>{const e=document.querySelector('#wxEdge .tkm'),L=$('#wxEdge');return parseFloat(getComputedStyle(e).animationDuration)})()")
            await pg.evaluate("wgpTop($('#wxp-ticker'))"); await pg.click('#wxp-ticker [data-f=speed] button >> nth=2'); await pg.wait_for_timeout(300)
            sp2 = await pg.evaluate("parseFloat(getComputedStyle(document.querySelector('#wxEdge .tkm')).animationDuration)")
            ok(L + 'Fast is faster', sp2 < sp * .75, [sp, sp2])
            await pg.evaluate("wgpTop($('#wxp-ticker'))"); await pg.click('#wxp-ticker [data-f=top] button >> nth=1'); await pg.wait_for_timeout(900)
            a = await m(pg, 'ticker'); o = await m(pg, 'ticker', True)
            ok(L + 'Top puts it at the top, on both', near(a['y'], 0) and near(o['y'], 0), [a, o])
            await pg.evaluate("wgpTop($('#wxp-ticker'))"); await pg.click('#wxp-ticker [data-f=top] button >> nth=0')
            await col(pg, 'ticker', 'bg', '#ffee00'); a = await m(pg, 'ticker')
            ok(L + 'a light bar gets dark letters', a['bg'].replace(' ', '') == 'rgb(255,238,0)' and a['col'].replace(' ', '') == 'rgb(10,10,12)', a)
            h0 = a['h']; await rng(pg, 'ticker', 'size', 12); a = await m(pg, 'ticker'); o = await m(pg, 'ticker', True)
            ok(L + 'the size slider makes it bigger, the same on both', a['h'] > h0 * 1.4 and near(a['h'], o['h'], .008), [h0, a, o])
            await rng(pg, 'ticker', 'size', 6); await col(pg, 'ticker', 'bg', '#0a0a0c')
            # a half-typed change stays off the screen until the field is left
            await pg.evaluate("wgpTop($('#wxp-ticker'))"); await pg.click('#wxp-ticker [data-f=text]'); await pg.keyboard.press('End'); await pg.keyboard.type(' XYZQ'); await pg.wait_for_timeout(250)
            ok(L + 'a change being typed is not on the screen yet', 'XYZQ' not in (await m(pg, 'ticker'))['txt'])
            c9 = await pg.evaluate("cur"); await pg.click('#back'); await pg.wait_for_timeout(900)
            ok(L + 'leaving the field for the show (a click on BACK) puts nothing half-typed on the screen; the field waits, marked', 'XYZQ' not in (await m(pg, 'ticker', True))['txt'] and await pg.evaluate("document.querySelector('#wxp-ticker [data-f=text]').classList.contains('wait')&&document.querySelector('#wxp-ticker [data-f=text]').value.endsWith('XYZQ')"))
            await pg.click('#wxp-ticker [data-f=text]'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
            ok(L + 'Esc puts the old text back in the field', await pg.evaluate("(()=>{const e=document.querySelector('#wxp-ticker [data-f=text]');return !e.value.includes('XYZQ')&&!e.classList.contains('wait')&&document.activeElement!==e})()") and 'XYZQ' not in (await m(pg, 'ticker'))['txt'])
            await pg.click('#wxp-ticker [data-f=text]'); await pg.keyboard.press('End'); await pg.keyboard.type(' XYZQ'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(300)
            ok(L + 'Enter puts it on both screens and hands the keyboard back', 'XYZQ' in (await m(pg, 'ticker'))['txt'] and 'XYZQ' in (await m(pg, 'ticker', True))['txt'] and await pg.evaluate("document.activeElement.tagName!=='INPUT'"))
            await pg.click('#wxp-ticker [data-f=text]'); await pg.keyboard.press('End'); await pg.keyboard.type('W'); await pg.click('#wxp-ticker .wpn'); await pg.wait_for_timeout(300)
            ok(L + 'so does a press anywhere else in the same panel', 'XYZQW' in (await m(pg, 'ticker', True))['txt'])
            c9 = await pg.evaluate("cur")
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(1300)
            ok(L + 'with the panel open and the field left, Space is GO again', await pg.evaluate("cur") == c9 + 1, [c9, await pg.evaluate('cur')])
            ok(L + 'the ticker stays over the next cue', (await m(pg, 'ticker'))['on'] and (await m(pg, 'ticker', True))['on'])
            # ---------- BLACK ----------
            await pg.click('#blk'); await pg.wait_for_timeout(600)
            ok(L + 'BLACK hides the widgets on both screens, and the panel says so', not (await m(pg, 'ticker'))['on'] and not (await m(pg, 'ticker', True))['on'] and await pg.evaluate("WX.ticker.on&&!$('#wxp-ticker .wpst').classList.contains('live')"))
            await pg.click('#blk'); await pg.wait_for_timeout(700)
            ok(L + 'and they are back after BLACK', (await m(pg, 'ticker'))['on'] and (await m(pg, 'ticker', True))['on'])
            # ---------- brand frame ----------
            await opn(pg, 'frame'); await col(pg, 'frame', 'col', '#ff00aa'); await rng(pg, 'frame', 'thick', 3); await show(pg, 'frame')
            fr = "(o=>{const W=o?outWin:window,L=W.document.getElementById('wxEdge'),e=L.querySelector('.wx-frame'),b=L.getBoundingClientRect(),w=e.querySelector('.fs').getBoundingClientRect(),fb=e.querySelector('.fb'),t=fb.getBoundingClientRect();return {bw:(w.top-b.top)/b.height,bl:(w.left-b.left)/b.width,bb:(b.bottom-w.bottom)/b.height,bc:W.getComputedStyle(e.querySelector('.ff')).backgroundColor,band:t.height/b.height,bt:fb.textContent,ty:(t.top+t.height/2-b.top)/b.height,tj:W.getComputedStyle(fb).justifyContent,rad:parseFloat(W.getComputedStyle(e.querySelector('.fs')).borderRadius)/b.height,shd:W.getComputedStyle(e.querySelector('.fs')).boxShadow!=='none',anim:W.getComputedStyle(e.querySelector('.sh')).animationName}})"
            f1 = await pg.evaluate(fr + "(false)"); f2 = await pg.evaluate(fr + "(true)"); a = await m(pg, 'frame'); o = await m(pg, 'frame', True)
            ok(L + 'the frame goes round the whole picture in the colour and thickness chosen, on both', a['on'] and o['on'] and near(a['w'], 1) and near(a['h'], 1) and near(f1['bw'], .03, .004) and near(f2['bw'], .03, .004) and near(f1['bl'], .03 * 9 / 16, .004) and near(f1['bb'], .03, .004) and f1['bc'].replace(' ', '') == 'rgb(255,0,170)' and f1['band'] == 0, [f1, f2, a])
            t = await m(pg, 'ticker'); to = await m(pg, 'ticker', True)
            ok(L + 'the ticker moves inside the frame', near(t['y'] + t['h'], .97, .008) and near(t['x'], .03 * 9 / 16, .006) and near(to['y'] + to['h'], .97, .008), [t, to])
            BT = 'כנס המוצר 2026' if he else 'Product Summit 2026'
            await setf(pg, 'frame', 'text', BT, 'Enter'); await pg.wait_for_timeout(700); f1 = await pg.evaluate(fr + "(false)"); f2 = await pg.evaluate(fr + "(true)"); t = await m(pg, 'ticker')
            ok(L + 'a text gives the frame a band at the bottom, and the ticker sits above it', f1['bt'] == BT and f2['bt'] == BT and f1['band'] > .03 and near(f1['band'], f2['band'], .006) and near(f1['bb'], .09, .006) and near(t['y'] + t['h'], .91, .01) and near(f1['ty'], .955, .006) and near(f2['ty'], .955, .006), [f1, f2, t])
            ok(L + 'the frame has round corners, a soft shadow and a gentle moving light by default, on both', f1['rad'] > .015 and near(f1['rad'], f2['rad'], .004) and f1['shd'] and f2['shd'] and f1['anim'] == 'wxSheen' and f2['anim'] == 'wxSheen', [f1, f2])
            await rng(pg, 'frame', 'round', 0); await pg.click('#wxp-frame [data-f=shadow] button >> nth=1'); await pg.click('#wxp-frame [data-f=anim] button >> nth=1'); await pg.wait_for_timeout(300); f3 = await pg.evaluate(fr + "(true)")
            ok(L + 'each of the three can be turned off', f3['rad'] == 0 and not f3['shd'] and f3['anim'] == 'none', f3)
            await pg.click('#wxp-frame [data-f=top] button >> nth=1'); await pg.click('#wxp-frame [data-f=align] button >> nth=2'); await pg.wait_for_timeout(900); f4 = await pg.evaluate(fr + "(true)"); t4 = await m(pg, 'ticker', True)
            ok(L + 'the text can go to the top and to a side; the picture window and the ticker follow', near(f4['ty'], .045, .006) and f4['tj'] == 'flex-end' and near(f4['bw'], .09, .006) and near(f4['bb'], .03, .006) and near(t4['y'] + t4['h'], .97, .01), [f4, t4])
            lab = await pg.evaluate("(()=>{const n=$('#nowNm').getBoundingClientRect(),l=document.querySelector('#pvNow .lbl').getBoundingClientRect(),w=document.querySelector('#pvNow .wx-frame .fs').getBoundingClientRect(),tk=document.querySelector('#pvNow .wx-ticker').getBoundingClientRect();return {nm:n.height>0&&n.bottom<=tk.top+1&&n.left>=w.left-1&&n.right<=w.right+1,lbl:l.top>=w.top-1&&l.left>=w.left-1}})()")
            ok(L + 'the operator\'s own labels on PROGRAM sit inside the frame and above the ticker, never on top of them', lab['nm'] and lab['lbl'], lab)
            await pg.click('#wxp-frame [data-f=top] button >> nth=0'); await pg.click('#wxp-frame [data-f=align] button >> nth=1'); await pg.wait_for_timeout(700); f1 = await pg.evaluate(fr + "(false)")
            # ---------- speaker name ----------
            await opn(pg, 'lower'); NM = 'דנה לוי' if he else 'Dana Levi'; RL = 'מנהלת מוצר' if he else 'Head of Product'
            await setf(pg, 'lower', 'name', NM, 'Enter'); await setf(pg, 'lower', 'role', RL, 'Enter'); await show(pg, 'lower')
            a = await m(pg, 'lower'); o = await m(pg, 'lower', True)
            ok(L + 'the speaker name is on both screens, name and title', a['on'] and o['on'] and NM in a['txt'] and RL in o['txt'], [a, o])
            ok(L + 'at the same place and size of the picture on both, whole inside it', near(a['cx'], o['cx']) and near(a['cy'], o['cy']) and near(a['h'], o['h'], .008) and a['inside'] and o['inside'], [a, o])
            lf = "(o=>{const W=o?outWin:window,e=W.document.querySelector('#wxLayer .wx-lower'),cs=W.getComputedStyle(e.querySelector('.ln'));return {ff:cs.fontFamily,fw:cs.fontWeight,bg:W.getComputedStyle(e.querySelector('.lt')).backgroundColor.replace(/ /g,''),c:cs.color.replace(/ /g,'')}})"
            l1 = await pg.evaluate(lf + "(true)"); await pg.click('#wxp-lower [data-f=font] button >> nth=2'); await col(pg, 'lower', 'bg', '#ffffff'); l2 = await pg.evaluate(lf + "(true)"); l2p = await pg.evaluate(lf + "(false)")
            ok(L + 'the name has its own letters (three to choose from) and its background colour can be changed; light gets dark letters — on both screens', 'Rubik' in l1['ff'] and l1['bg'].startswith('rgba(10,10,12') and 'Frank' in l2['ff'] and l2['bg'].startswith('rgba(255,255,255') and l2['c'] == 'rgb(10,10,12)' and l2p == l2, [l1, l2, l2p])
            await pg.click('#wxp-lower [data-f=font] button >> nth=0'); await col(pg, 'lower', 'bg', '#0a0a0c')
            ok(L + 'the colour bar is on the side the language starts from', ('rtl' in a['cls']) == he, a['cls'])
            ok(L + 'on the event screen nothing can be grabbed', o['pe'] == 'none' and a['pe'] == 'auto', [a['pe'], o['pe']])
            bx = await pg.evaluate("(()=>{const r=document.querySelector('#pvNow .wx-lower').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
            pv = await pg.evaluate("(()=>{const r=$('#pvNow').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
            cur1 = await pg.evaluate("cur")
            await pg.mouse.move(bx[0], bx[1]); await pg.mouse.down(); await pg.mouse.move(pv[0] + pv[2] * .5, pv[1] + pv[3] * .4, steps=8); await pg.mouse.up(); await pg.wait_for_timeout(800)
            a2 = await m(pg, 'lower'); o2 = await m(pg, 'lower', True)
            ok(L + 'dragged on PROGRAM it moves on both screens', near(a2['cx'], .5, .02) and near(a2['cy'], .4, .02) and near(o2['cx'], a2['cx']) and near(o2['cy'], a2['cy']), [a2, o2])
            ok(L + 'and the drag does not touch the show', await pg.evaluate("cur") == cur1)
            await pg.mouse.move(pv[0] + pv[2] * .5, pv[1] + pv[3] * .4); await pg.mouse.down(); await pg.mouse.move(pv[0] + pv[2] + 300, pv[1] + pv[3] + 300, steps=6); await pg.mouse.up(); await pg.wait_for_timeout(500)
            a3 = await m(pg, 'lower'); o3 = await m(pg, 'lower', True)
            ok(L + 'it cannot be dragged out of the picture', a3['inside'] and o3['inside'], [a3, o3])
            await pg.evaluate("WX.lower.x=.3;WX.lower.y=.6;wxPaint()"); h0 = (await m(pg, 'lower'))['h']
            bx = await pg.evaluate("(()=>{const r=document.querySelector('#pvNow .wx-lower').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
            await pg.mouse.move(bx[0], bx[1]); await pg.mouse.wheel(0, -300); await pg.wait_for_timeout(400); a4 = await m(pg, 'lower')
            ok(L + 'the wheel over it changes its size, and the slider follows', a4['h'] > h0 * 1.02 and await pg.evaluate("+document.querySelector('#wxp-lower [data-f=size]').value===Math.round(WX.lower.size*100)"), [h0, a4])
            await rng(pg, 'lower', 'size', 12); await pg.wait_for_timeout(300); a5 = await m(pg, 'lower'); o5 = await m(pg, 'lower', True)
            ok(L + 'at its biggest it is still whole inside the picture', a5['inside'] and o5['inside'], [a5, o5])
            await rng(pg, 'lower', 'size', 6); await setf(pg, 'lower', 'name', NM + ' ' + 'אבגדה וזחטי ' * 9, 'Enter'); await pg.wait_for_timeout(400); a6 = await m(pg, 'lower')
            await setf(pg, 'lower', 'name', NM, 'Enter'); await pg.wait_for_timeout(400); a7 = await m(pg, 'lower')
            ok(L + 'a very long name is fitted into the picture, and the next name is back at the size that was chosen', a6['inside'] and a6['h'] < a7['h'] * .8 and await pg.evaluate("WX.lower.size===.06&&+document.querySelector('#wxp-lower [data-f=size]').value===6"), [a6, a7])
            await pg.evaluate("wgpTop($('#wxp-lower'))"); await pg.click('#wxp-lower .wxShow'); await pg.wait_for_timeout(900)
            ok(L + 'Hide takes it off both screens; the panel stays', not (await m(pg, 'lower'))['on'] and not (await m(pg, 'lower', True))['on'] and await pg.evaluate("!$('#wxp-lower').hidden"))
            await pg.evaluate("wgpTop($('#wxp-lower'))"); await pg.click('#wxp-lower .wxShow'); await pg.wait_for_timeout(900)
            # ---------- logo ----------
            await opn(pg, 'logo'); await pg.evaluate("wgpTop($('#wxp-logo'))"); await pg.click('#wxp-logo .wxShow'); await pg.wait_for_timeout(300)
            ok(L + 'a logo with no picture chosen shows nothing', not (await m(pg, 'logo'))['on'] and await pg.evaluate("!WX.logo.on"))
            await pg.set_input_files('#wxp-logo .wxFile', os.path.join(FIX, 'va.webm')); await pg.wait_for_timeout(600)
            ok(L + 'a file that is not a picture is refused with a word', await pg.evaluate("!WX.logo.src&&$('#wxp-logo .wpst').classList.contains('need')"))
            await pg.set_input_files('#wxp-logo .wxFile', os.path.join(ROOT, 'docs', 'email', 'icon.png')); await pg.wait_for_timeout(700); await show(pg, 'logo')
            a = await m(pg, 'logo'); o = await m(pg, 'logo', True)
            img = await pg.evaluate("[document.querySelector('#pvNow .wx-logo img').naturalWidth,outWin.document.querySelector('.wx-logo img').naturalWidth]")
            ok(L + 'the chosen picture is on both screens, same place and size', a['on'] and o['on'] and img[0] > 0 and img[1] > 0 and near(a['cx'], o['cx']) and near(a['cy'], o['cy']) and near(a['h'], o['h'], .006) and a['inside'], [a, o, img])
            await rng(pg, 'logo', 'op', 40); await rng(pg, 'logo', 'size', 30); a2 = await m(pg, 'logo')
            ok(L + 'size and opacity follow the sliders', a2['h'] > a['h'] * 1.6 and await pg.evaluate("getComputedStyle(outWin.document.querySelector('.wx-logo img')).opacity==='0.4'") and a2['inside'], a2)
            await rng(pg, 'logo', 'op', 100); await rng(pg, 'logo', 'size', 14)
            # ---------- QR ----------
            await opn(pg, 'qr'); URL = 'https://cuey.live/he/?שאלה=כן&from=qr'
            await setf(pg, 'qr', 'url', URL, 'Enter'); await setf(pg, 'qr', 'cap', 'סרקו אותי' if he else 'Scan me', 'Enter'); await show(pg, 'qr')
            a = await m(pg, 'qr'); o = await m(pg, 'qr', True)
            ok(L + 'the QR code (a link with Hebrew in it) is on both screens with its caption, whole inside the picture', a['on'] and o['on'] and near(a['cx'], o['cx']) and near(a['h'], o['h'], .008) and a['inside'] and o['inside'] and ('סרקו' if he else 'Scan') in o['txt'], [a, o])
            shot = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'cuey_qr_%s.png' % lang); await out.screenshot(path=shot)
            try:
                import cv2; dec = cv2.QRCodeDetector().detectAndDecode(cv2.imread(shot))[0]
            except Exception as e: dec = 'ERR ' + str(e)
            if dec.startswith('ERR No module'): print('SKIP ' + L + 'reading the code back needs OpenCV (pip install opencv-python-headless)')
            else: ok(L + 'a phone reads the link from the event screen', dec == URL, dec)
            await pg.evaluate("wgpTop($('#wxp-qr'))"); await pg.fill('#wxp-qr [data-f=url]', 'https://x.y/' + 'a' * 600); await pg.press('#wxp-qr [data-f=url]', 'Enter'); await pg.wait_for_timeout(800)
            ok(L + 'a link too long to be read takes the code off the screen and the panel says why, at once', not (await m(pg, 'qr'))['on'] and not errs and await pg.evaluate("$('#wxp-qr .wpst').classList.contains('need')&&$('#wxp-qr .wpst').textContent.includes('400')"), errs[:2])
            await setf(pg, 'qr', 'url', URL, 'Enter'); await pg.wait_for_timeout(700)
            ok(L + 'and a good link brings it back', (await m(pg, 'qr'))['on'])
            # a picture of a code the operator already has
            qp = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'cuey_qr_own.png')
            try:
                import cv2, numpy as np; code = cv2.QRCodeEncoder_create().encode('https://example.org/my-own-code'); cv2.imwrite(qp, cv2.resize(code, (420, 420), interpolation=cv2.INTER_NEAREST)); own = True
            except Exception as e: own = False
            if own:
                await pg.evaluate("wgpTop($('#wxp-qr'))"); await pg.set_input_files('#wxp-qr .wxFile', qp); await pg.wait_for_timeout(900); await out.screenshot(path=shot)
                dec2 = cv2.QRCodeDetector().detectAndDecode(cv2.imread(shot))[0]; o = await m(pg, 'qr', True)
                ok(L + 'a picture of a code I already have goes on the screen instead, and a phone reads that code', dec2 == 'https://example.org/my-own-code' and o['on'] and o['inside'] and await pg.evaluate("!$('#wxp-qr .wxClr').hidden"), [dec2, o])
                qpx = await pg.evaluate("(()=>{WX.qr.x=.5;WX.qr.y=.5;const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');drawFrame(g,1280,720);const d=g.getImageData(560,280,160,160).data;let k=0;for(let i=0;i<d.length;i+=4)if(d[i]<60)k++;return k})()")
                ok(L + 'it is in the shared-screen picture too', qpx > 2000, qpx)
                ok(L + 'the picture is saved with the show', (await pg.evaluate("showData().widgets.qr.img")).startswith('data:image/png'))
                await pg.click('#wxp-qr .wxClr'); await pg.wait_for_timeout(900); await out.screenshot(path=shot); dec3 = cv2.QRCodeDetector().detectAndDecode(cv2.imread(shot))[0]
                ok(L + 'removing the picture brings back the code made from the link', dec3 == URL and await pg.evaluate("$('#wxp-qr .wxClr').hidden&&!WX.qr.img"), dec3)
                await pg.evaluate("WX.qr.x=.86;WX.qr.y=.5;wxPaint()")
            else: print('SKIP ' + L + 'own QR picture needs OpenCV')
            # ---------- another screen shape ----------
            await pg.evaluate("items[cur].scale='fill';pvStage.fit('fill');outStage.fit('fill')"); await out.set_viewport_size({'width': 1024, 'height': 768}); await pg.wait_for_timeout(900)
            a = await m(pg, 'qr'); o = await m(pg, 'qr', True); la = await m(pg, 'lower'); lo = await m(pg, 'lower', True); t = await m(pg, 'ticker', True); f43 = await pg.evaluate(fr + "(true)")
            ok(L + 'on a 4:3 event screen the widgets keep their place in the picture', near(o['box'][1], .75, .01) and near(a['cx'], o['cx']) and near(a['cy'], o['cy']) and near(la['cx'], lo['cx']) and near(la['h'], lo['h'], .008) and o['inside'], [a, o, la, lo])
            ok(L + 'a cue that fills the screen: the frame and the ticker go to the edges of the real screen, whatever its shape', near(t['w'], 1 - 2 * .03 * 3 / 4, .01) and near(t['box'][0], 1, .005) and near(t['box'][1], 1, .005) and near(f43['bw'], .03, .004) and near(f43['bl'], .03 * 3 / 4, .004) and near(f43['bb'], .09, .006), [t, f43])
            await pg.evaluate("items[cur].scale='fit';pvStage.fit('fit');outStage.fit('fit')"); await pg.wait_for_timeout(900); t2 = await m(pg, 'ticker', True)
            ok(L + 'a cue that is fitted: they keep to the 16:9 picture, as on PROGRAM', near(t2['box'][1], .75, .01) and near(t2['box'][0], 1, .005), t2)
            await out.set_viewport_size({'width': 1280, 'height': 720}); await pg.wait_for_timeout(600)
            cov = await pg.evaluate("(()=>{document.querySelectorAll('.wxp:not(.min) .wxMin').forEach(b=>b.click());const hit=(r,e)=>{const b=e.getBoundingClientRect();return !(r.right<=b.left||r.left>=b.right||r.bottom<=b.top||r.top>=b.bottom)},q=[...document.querySelectorAll('.wxp')].filter(p=>!p.hidden).map(p=>p.getBoundingClientRect());return {n:q.length,go:q.some(r=>hit(r,$('#go').parentElement)),cue:q.some(r=>[...$('#list').children].some(e=>hit(r,e))),pv:q.some(r=>hit(r,$('#pvNow'))||hit(r,$('#pvNext'))),over:q.some((r,i)=>q.some((o,j)=>j>i&&!(r.right<=o.left||r.left>=o.right||r.bottom<=o.top||r.top>=o.bottom))),h:Math.max(...q.map(r=>r.height))}})()")
            ok(L + 'five panels made small sit side by side: none on a cue, on GO, on a preview or on another panel', cov['n'] == 5 and not (cov['go'] or cov['cue'] or cov['pv'] or cov['over']) and cov['h'] < 130, cov)
            await pg.evaluate("document.querySelectorAll('.wxp.min .wxMin').forEach(b=>b.click())")
            # ---------- all together, with the timer ----------
            await pg.evaluate("wtOpen();wtShow()"); await pg.wait_for_timeout(500)
            on = [(await m(pg, k, True))['on'] for k in ('ticker', 'lower', 'logo', 'qr', 'frame')]
            ok(L + 'all five and the timer can be on the screen together', all(on) and await pg.evaluate("outWin.getComputedStyle(outWin.document.getElementById('wdgTimer')).display!=='none'"), on)
            # ---------- shared screen picture / export ----------
            await pg.evaluate("WX.frame.anim=false;WX.qr.x=.85;WX.qr.y=.4;WX.lower.x=.3;WX.lower.y=.5;wxPaint()"); await pg.wait_for_timeout(200)
            px = {n: await pg.evaluate(PIX + "(%f,%f)" % xy) for n, xy in {'frame': (.5, .008), 'tick': (.02, .9), 'qrw': (.85 - .28 * 9 / 16 / 2 - .005, .4), 'mid': (.5, .2)}.items()}
            qd = await pg.evaluate("(()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const g=c.getContext('2d');drawFrame(g,1280,720);const d=g.getImageData(Math.round(.85*1280-90),Math.round(.4*720-90),180,180).data;let k=0,w=0;for(let i=0;i<d.length;i+=4){if(d[i]<40&&d[i+1]<40&&d[i+2]<40)k++;else if(d[i]>215&&d[i+1]>215&&d[i+2]>215)w++}return [k,w]})()")
            ok(L + 'the shared-screen picture has the frame, the ticker and the QR code too', px['frame'] == [255, 0, 170] and px['tick'][0] < 30 and px['tick'][2] < 30 and px['qrw'] == [255, 255, 255] and qd[0] > 3000 and qd[1] > 3000, [px, qd])
            await pg.evaluate("exporting=true"); pe = await pg.evaluate(PIX + "(.5,.008)"); await pg.evaluate("exporting=false")
            ok(L + 'an exported video never has them', pe != [255, 0, 170], pe)
            # ---------- saved with the show ----------
            js = await pg.evaluate("JSON.stringify(showData())"); w = json.loads(js).get('widgets', {})
            ok(L + 'the set-up of every widget is saved with the show, and whether it is on the screen', all(k in w for k in ('ticker', 'lower', 'logo', 'qr', 'frame', 'timer')) and all(isinstance(w[k].get('on'), bool) and 'used' not in w[k] for k in w) and w['frame']['col'] == '#ff00aa' and w['qr']['url'] == URL and w['logo']['src'].startswith('data:image/png;base64,') and TXT in w['ticker']['text'], {k: list(v) for k, v in w.items()})
            # ---------- closing ----------
            await pg.evaluate("wgpTop($('#wxp-frame'))"); await pg.click('#wxp-frame .wxX'); await pg.wait_for_timeout(250)
            ok(L + 'the X of a widget that is on the screen asks first', await pg.evaluate("!$('#wxp-frame').hidden&&WX.frame.on&&$('#wxp-frame .wxX').classList.contains('sure')"))
            await pg.evaluate("wgpTop($('#wxp-frame'))"); await pg.click('#wxp-frame .wxX'); await pg.wait_for_timeout(900)
            ok(L + 'the second press closes the panel and takes it off both screens', await pg.evaluate("!$('#wxp-frame')||$('#wxp-frame').hidden") and not (await m(pg, 'frame'))['on'] and not (await m(pg, 'frame', True))['on'])
            t = await m(pg, 'ticker', True); ok(L + 'and the ticker is a full bar at the bottom again', near(t['w'], 1) and near(t['y'] + t['h'], 1), t)
            # the panel is dragged by its top and remembers its place
            p0 = await pg.evaluate("(()=>{const r=$('#wxp-qr').getBoundingClientRect(),h=$('#wxp-qr .wpn').getBoundingClientRect();return [r.left,r.top,h.left+4,h.top+4]})()")
            await pg.evaluate("wgpTop($('#wxp-qr'))"); await pg.mouse.move(p0[2], p0[3]); await pg.mouse.down(); await pg.mouse.move(p0[2] - 60, p0[3] - 40, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(200)
            p1 = await pg.evaluate("(()=>{const r=$('#wxp-qr').getBoundingClientRect();return [r.left,r.top]})()")
            await close(pg, 'qr'); await opn(pg, 'qr'); p2 = await pg.evaluate("(()=>{const r=$('#wxp-qr').getBoundingClientRect();return [r.left,r.top]})()")
            ok(L + 'a panel is dragged by its top bar and opens again where it was left', abs(p1[0] - p0[0] + 60) < 4 and abs(p1[1] - p0[1] + 40) < 4 and abs(p2[0] - p1[0]) < 4 and abs(p2[1] - p1[1]) < 4, [p0, p1, p2])
            ok(L + 'opened again the QR panel still has the link', await pg.evaluate("document.querySelector('#wxp-qr [data-f=url]').value") == URL)
            # ---------- Clear ----------
            await pg.evaluate("WX.ticker.on=true;WX.frame.on=true;wxPaint()")
            await pg.click('#clearAll'); await pg.wait_for_timeout(300); await pg.click('.uiq button[data-v=yes]'); await pg.wait_for_timeout(900)
            ok(L + 'Clear leaves nothing on the screens and no text of the last show in the widgets', await pg.evaluate("items.length===0&&!wxAny()&&WX.ticker.text===''&&WX.qr.url===''&&!WX.logo.src") and not (await m(pg, 'ticker', True))['on'] and not (await m(pg, 'frame', True))['on'])
            # ---------- opening shows ----------
            for k in ('ticker', 'lower', 'logo', 'qr'): await pg.evaluate("WX[%s].on=true" % json.dumps(k))
            await pg.evaluate("(j=>{loadShowFromText(j)})(%s)" % json.dumps(js)); await pg.wait_for_timeout(800); await pg.evaluate("if(!$('#pickDlg').hidden)$('#pkSkip').click()"); await pg.wait_for_timeout(600)
            st = await pg.evaluate("({on:WX_KEYS.filter(k=>WX[k].on),t:WX.ticker.text,c:WX.frame.col,th:WX.frame.thick,u:WX.qr.url,l:WX.logo.src.length,n:WX.lower.name})")
            exp = [k for k in ('ticker', 'lower', 'logo', 'qr', 'frame') if w[k]['on']]
            ok(L + 'opening the show brings every set-up back, and on the screen exactly the widgets that were on when it was saved', sorted(st['on']) == sorted(exp) and TXT in st['t'] and st['c'] == '#ff00aa' and near(st['th'], .03, .001) and st['u'] == URL and st['l'] > 500 and st['n'] == NM and [k for k in ('ticker', 'lower', 'logo', 'qr', 'frame') if (await m(pg, k))['on']] == exp, [st, exp])
            for want in (['ticker', 'frame'], []):
                d2 = json.loads(js)
                for k in ('ticker', 'lower', 'logo', 'qr', 'frame'): d2['widgets'][k]['on'] = k in want
                await pg.evaluate("(j=>{loadShowFromText(j)})(%s)" % json.dumps(json.dumps(d2))); await pg.wait_for_timeout(800); await pg.evaluate("if(!$('#pickDlg').hidden)$('#pkSkip').click()"); await pg.wait_for_timeout(700)
                got = [k for k in ('ticker', 'lower', 'logo', 'qr', 'frame') if (await m(pg, k))['on']]
                ok(L + ('saved with the ticker and the frame on: both are back on PROGRAM, nothing else' if want else 'saved with every widget off: it opens with a clean screen'), got == want and await pg.evaluate("JSON.stringify(WX_KEYS.filter(k=>WX[k].on).sort())") == json.dumps(sorted(want), separators=(',', ':')), got)
            d2 = json.loads(js); d2['widgets']['ticker'].update(on=True, text='   ')
            await pg.evaluate("(j=>{loadShowFromText(j)})(%s)" % json.dumps(json.dumps(d2))); await pg.wait_for_timeout(800); await pg.evaluate("if(!$('#pickDlg').hidden)$('#pkSkip').click()"); await pg.wait_for_timeout(600)
            ok(L + 'a widget marked on with nothing to show stays off', await pg.evaluate("!WX.ticker.on"))
            old = json.loads(js); old.pop('widgets')
            r = await pg.evaluate("(async j=>{loadShowFromText(j);await new Promise(r=>setTimeout(r,700));if(!$('#pickDlg').hidden)$('#pkSkip').click();await new Promise(r=>setTimeout(r,500));return {n:items.length,t:WX.ticker.text,l:WX.logo.src,c:WX.frame.col,w:'widgets' in showData(),on:WX_KEYS.filter(k=>WX[k].on)}})(%s)" % json.dumps(json.dumps(old)))
            ok(L + 'a show saved before widgets existed opens as always, with no widget left over from the last show', r == {'n': 3, 't': '', 'l': '', 'c': '#C8FF00', 'w': False, 'on': []}, r)
            bad = json.loads(js); bad['widgets'] = {'ticker': {'text': 5, 'size': 'x', 'bg': 'red', 'speed': 9}, 'logo': {'src': 'javascript:alert(1)', 'x': 44}, 'qr': 'nope', 'frame': {'thick': 9, 'col': '#zz'}, 'lower': None}
            r = await pg.evaluate("(async j=>{loadShowFromText(j);await new Promise(r=>setTimeout(r,700));if(!$('#pickDlg').hidden)$('#pkSkip').click();await new Promise(r=>setTimeout(r,500));return {t:WX.ticker.text,s:WX.ticker.size,b:WX.ticker.bg,sp:WX.ticker.speed,l:WX.logo.src,x:WX.logo.x,th:WX.frame.thick,c:WX.frame.col}})(%s)" % json.dumps(json.dumps(bad)))
            ok(L + 'a damaged show file cannot put anything strange into a widget', r == {'t': '', 's': .065, 'b': '#0A0A0C', 'sp': 2, 'l': '', 'x': .99, 'th': .06, 'c': '#C8FF00'}, r)
            # ---------- the show itself ----------
            await pg.evaluate("document.querySelectorAll('.wxp').forEach(p=>p.remove());$('#wtPanel').hidden=true;wtOff();try{localStorage.removeItem('cuey.wxPanel.frame')}catch(e){}"); await opn(pg, 'frame')
            hit = await pg.evaluate("(()=>{const r=$('#wxp-frame').getBoundingClientRect(),h=e=>{const b=e.getBoundingClientRect();return !(r.right<=b.left||r.left>=b.right||r.bottom<=b.top||r.top>=b.bottom)};return h($('#go').parentElement)||[...$('#list').children].some(h)})()")
            await pg.click('#list .item >> nth=0'); await pg.wait_for_timeout(1200); c1 = await pg.evaluate("cur"); await pg.click('#go'); await pg.wait_for_timeout(1500); c2 = await pg.evaluate("cur"); await pg.keyboard.press('Space'); await pg.wait_for_timeout(1500); c3 = await pg.evaluate("cur")
            ok(L + 'with a widget panel open the show runs as always (click a cue, GO, Space)', not hit and c2 == c1 + 1 and c3 == c2 + 1, [hit, c1, c2, c3])
            ok(L + 'no page errors', not errs, errs[:3])
            await ctx.close()
        await b.close()
    print(f"{sum(res)}/{len(res)} passed")
asyncio.run(main())
