"""Cuey feature-by-feature checks (complements browser_suite.py).
Run from the folder that holds the test media (red.png, green.png, blue.png, v.webm, va.webm, tone.wav):
    python3 /path/to/feature_suite.py
Each feature runs on a fresh page, in English and Hebrew."""
import asyncio, json, os, sys, traceback, urllib.parse
from playwright.async_api import async_playwright

APP = 'file:///tmp/cuey/app/cuey.html'
HERE = os.getcwd()
RES = []
def ok(name, cond, info=''):
    RES.append((name, bool(cond), info))
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  -> ' + str(info)[:300]))

IMG = open(os.path.join(HERE, 'green.png'), 'rb').read()
VID = open(os.path.join(HERE, 'va.webm'), 'rb').read()
PB_MODE = {'status': 200}
async def pixabay(route):
    if PB_MODE['status'] != 200:
        await route.fulfill(status=PB_MODE['status'], content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body='{"error":"x"}'); return
    q = urllib.parse.parse_qs(urllib.parse.urlparse(route.request.url).query); typ = q.get('type', ['image'])[0]
    hits = [{'id': i, 'thumb': f'https://cdn.pixabay.com/t{i}.png', 'full': f'https://cdn.pixabay.com/f{i}.' + ('webm' if typ == 'video' else 'png'), 'preview': 'https://cdn.pixabay.com/p.webm', 'user': 'u', 'dur': 6} for i in range(6)]
    await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps({'total': 6, 'hits': hits}))
async def cdn(route):
    v = route.request.url.endswith('.webm')
    await route.fulfill(status=200, content_type='video/webm' if v else 'image/png', headers={'Access-Control-Allow-Origin': '*'}, body=VID if v else IMG)

E = lambda pg, js: pg.evaluate(js)
W = lambda pg, ms: pg.wait_for_timeout(ms)

async def fresh(ctx, lang):
    pg = await ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(APP)
    await E(pg, f"localStorage.clear();localStorage.setItem('cuey.lang','{lang}')")
    await pg.reload(); await W(pg, 300)
    await pg.add_style_tag(content='#nudge{display:none!important}')
    return pg
async def add(pg, *names):
    await pg.set_input_files('#fileIn', [os.path.join(HERE, n) for n in names]); await W(pg, 900)
async def fileFromDisk(pg, name, mime):
    # a real File object made from a test file (for setAudio / Create cue)
    await E(pg, "(()=>{let i=document.getElementById('tmpIn');if(!i){i=document.createElement('input');i.type='file';i.id='tmpIn';i.hidden=true;document.body.appendChild(i)}})()")
    await pg.set_input_files('#tmpIn', os.path.join(HERE, name))
    await E(pg, "window.__f=document.getElementById('tmpIn').files[0]")
async def edit(pg, i, clicks=(), fills=()):
    await E(pg, f'openEdit(items[{i}],true)'); await W(pg, 150)
    for sel in clicks: await pg.click(sel)
    for sel, v in fills: await pg.fill(sel, v)
    await pg.click('#edOk'); await W(pg, 150)

async def features(ctx, L, lang):
    T = {}
    async def feature(name, fn):
        pg = await fresh(ctx, lang)
        try: await fn(pg)
        except Exception as e: ok(L + name + ' crashed', False, traceback.format_exc()[-400:])
        ok(L + name + ': no page errors', not pg.errs, pg.errs[:3])
        await pg.close()

    async def video_end(pg):
        await add(pg, 'v.webm', 'red.png')
        await edit(pg, 0, ['#edBox .seg[data-f=onEndV] button[data-v=next]'])
        await E(pg, 'show(0)'); await W(pg, 3200)
        ok(L + 'video "next" advances at the end', await E(pg, 'cur') == 1, await E(pg, 'cur'))
        await edit(pg, 0, ['#edBox .seg[data-f=onEndV] button[data-v=black]'])
        await E(pg, 'show(0)'); await W(pg, 3200)
        ok(L + 'video "Black" at the end', await E(pg, 'blackOn') and await E(pg, 'cur') == 0)
        await E(pg, 'setBlack(false)')
        await edit(pg, 0, ['#edBox [data-f=loop]'])
        await E(pg, 'show(0)'); await W(pg, 3500)
        ok(L + 'video loop keeps playing', await E(pg, "cur===0&&!pvStage.media.paused&&pvStage.media.currentTime<2.1"))
    await feature('video end / loop', video_end)

    async def standby_trim(pg):
        await add(pg, 'va.webm', 'red.png')
        await edit(pg, 0, ['#edBox [data-f=standby]'])
        await E(pg, 'show(0)'); await W(pg, 900)
        ok(L + 'wait-before-play: armed + paused', await E(pg, 'armed&&pvStage.media.paused'))
        await E(pg, 'go()'); await W(pg, 700)
        ok(L + 'wait-before-play: GO plays it', await E(pg, '!armed&&!pvStage.media.paused&&cur===0'), await E(pg, '[armed,cur]'))
        await edit(pg, 0, ['#edBox [data-f=standby]', '#edBox .seg[data-f=onEndV] button[data-v=next]'], [('#edBox [data-f=in]', '1'), ('#edBox [data-f=out]', '2')])
        await E(pg, 'show(0)'); await pg.wait_for_function('pvStage.media&&pvStage.media.tagName==="VIDEO"&&pvStage.media.currentTime>0', timeout=4000)
        ok(L + 'IN trim starts at 1 s', await E(pg, 'pvStage.media.currentTime>=0.9'), await E(pg, 'pvStage.media.currentTime'))
        await W(pg, 1500)
        ok(L + 'OUT trim ends + advances', await E(pg, 'cur') == 1, await E(pg, 'cur'))
    await feature('wait-before-play + trims', standby_trim)

    async def pictures(pg):
        await add(pg, 'red.png', 'green.png', 'blue.png')
        for i in range(3): await edit(pg, i, ['#edBox .seg[data-f=onEndI] button[data-v=next]'], [('#edBox [data-f=hold]', '0.6')])
        await E(pg, 'show(0)'); await W(pg, 2400)
        ok(L + 'timed pictures run to the last one', await E(pg, 'cur') == 2, await E(pg, 'cur'))
        await E(pg, 'go()'); await W(pg, 200)
        ok(L + 'GO on the last cue stays put', await E(pg, 'cur') == 2)
        await E(pg, 'show(0)'); await E(pg, 'back()'); await W(pg, 200)
        ok(L + 'BACK on the first cue stays put', await E(pg, 'cur') == 0)
        await E(pg, 'show(0)'); await W(pg, 100); await E(pg, 'playPause(false,true)'); await W(pg, 1200)
        ok(L + 'FREEZE stops the picture timer', await E(pg, 'cur') == 0)
        await E(pg, 'playPause(true,false)'); await W(pg, 900)
        ok(L + 'un-freeze continues the timer', await E(pg, 'cur') == 1, await E(pg, 'cur'))
        await edit(pg, 1, ['#edBox .seg[data-f=trans] button[data-v=cut]'])
        await E(pg, 'show(1)'); await W(pg, 60)
        ok(L + 'cut is instant', await E(pg, "pvStage.ly.some(l=>getComputedStyle(l).opacity==='1')"))
    await feature('pictures, timers, GO/BACK edges, freeze, cut', pictures)

    async def music(pg):
        await add(pg, 'red.png', 'green.png', 'tone.wav')
        await fileFromDisk(pg, 'tone.wav', 'audio/wav')
        await E(pg, 'setAudio(items[0],window.__f)'); await E(pg, 'show(0)'); await W(pg, 500)
        ok(L + 'music under a picture plays', await E(pg, '!slideAudio.paused&&slideAudio.currentTime>0'))
        await E(pg, 'show(1)'); await W(pg, 300)
        ok(L + 'music stops on a cue without music', await E(pg, 'slideAudio.paused||!slideAudio.src'))
        ai = await E(pg, "items.findIndex(i=>i.type==='audio')")
        ok(L + 'audio file becomes an audio cue', ai == 2)
        await edit(pg, ai, ['#edBox .seg[data-f=onEndV] button[data-v=next]'])
        await E(pg, f'show({ai})'); await W(pg, 500)
        ok(L + 'audio cue plays', await E(pg, '!slideAudio.paused'))
        await W(pg, 700); ok(L + 'audio cue fills the yellow seek bar', float((await E(pg, "$('#seek').style.getPropertyValue('--p')") or '0%').rstrip('%') or 0) > 0)
        await E(pg, "setMaster(0.3)"); await W(pg, 100)
        ok(L + 'master volume reaches the music', await E(pg, 'Math.abs(slideAudio.volume-0.3*(items[2].vol??1))<0.05'), await E(pg, 'slideAudio.volume'))
    await feature('music under pictures + audio cues', music)

    async def slideshows(pg):
        await add(pg, 'red.png', 'green.png', 'blue.png', 'v.webm')
        await E(pg, "studioOk=true;sel.clear();sel.add(items[0].id);sel.add(items[1].id);render()"); await W(pg, 200)
        await pg.click('#ssMake'); await W(pg, 300)
        g = await E(pg, 'items[0].grp')
        await E(pg, f"groups['{g}'].hold=0.6;groups['{g}'].end='next';applyGrp('{g}')")
        await E(pg, 'show(0)'); await W(pg, 1800)
        ok(L + 'slide show end = next cue', await E(pg, 'cur') == 2, await E(pg, 'cur'))
        await E(pg, f"groups['{g}'].end='black';applyGrp('{g}')"); await E(pg, 'setBlack(false)')
        await E(pg, 'show(0)'); await W(pg, 1800)
        ok(L + 'slide show end = Black', await E(pg, 'blackOn'))
        await E(pg, 'setBlack(false)')
        await E(pg, f"groups['{g}'].end='loop';applyGrp('{g}')"); await E(pg, 'show(0)'); await W(pg, 1600)
        ok(L + 'slide show loops', await E(pg, 'cur') in (0, 1))
        # a video inside a slide show plays to its end, then moves on
        await E(pg, f"items[3].grp='{g}';const x=items.splice(3,1)[0];items.splice(2,0,x);applyGrp('{g}');render()")
        await E(pg, f"groups['{g}'].end='next'"); await E(pg, 'show(2)'); await W(pg, 3000)
        ok(L + 'video in a slide show plays then moves on', await E(pg, 'cur') == 3, await E(pg, 'cur'))
    await feature('slide shows', slideshows)

    async def studio_gate(pg):
        await add(pg, 'red.png', 'green.png', 'blue.png')
        await E(pg, "sel.clear();sel.add(items[1].id);sel.add(items[2].id);render()"); await pg.click('#ssMake'); await W(pg, 200)
        ok(L + 'free plan: slide show carries a STUDIO tag', await E(pg, "!!document.querySelector('.grpc .tg.st')"))
        await pg.click('#openOut'); await W(pg, 300)
        ok(L + 'opening Output warns about Studio cues first', await E(pg, "!$('#pfDlg').hidden&&$('#pfN').textContent.includes('2')"), await E(pg, "$('#pfN').textContent"))
        async with ctx.expect_page() as np:
            await pg.click('#pfGo')
        o = await np.value; await W(pg, 800)
        await E(pg, 'show(0)'); await W(pg, 600)
        await E(pg, 'show(1)'); await W(pg, 600)
        ok(L + 'GO on a Studio cue: no window in the middle of the show', await E(pg, "$('#studioDlg').hidden"))
        ok(L + 'GO on a Studio cue: the event screen keeps the previous cue', await E(pg, "outStage.it===items[0]&&pvStage.it===items[1]"))
        ok(L + 'PROGRAM says it is not on the event screen', await E(pg, "!$('#pvHeld').hidden"))
        await E(pg, 'setLicensed(true)'); await W(pg, 300); await E(pg, 'show(1)'); await W(pg, 700)
        ok(L + 'with Studio the slide show goes to the event screen', await E(pg, "outStage.it===items[1]&&$('#pvHeld').hidden&&!document.querySelector('.grpc .tg.st')"))
        ok(L + 'with Studio no watermark', await E(pg, "!outWin.document.getElementById('badge').classList.contains('on')"))
        await E(pg, 'setLicensed(false)')
        ok(L + 'watermark element on Output', await E(pg, "!!outWin.document.getElementById('badge')"))
        # PROGRAM follows OUTPUT: a stalled preview copy restarts and lines up
        await add(pg, 'va.webm'); vi = await E(pg, "items.findIndex(i=>i.type==='video')")
        await E(pg, f'show({vi})'); await W(pg, 1200)
        await E(pg, 'pvStage.media.pause();pvStage.media.currentTime=0'); await W(pg, 2300)
        ok(L + 'PROGRAM restarts + follows OUTPUT', await E(pg, '!pvStage.media.paused&&Math.abs(pvStage.media.currentTime-outStage.media.currentTime)<0.6'), await E(pg, '[pvStage.media.paused,pvStage.media.currentTime,outStage.media.currentTime]'))
        await E(pg, 'setBlack(true)'); await W(pg, 700)
        ok(L + 'Black reaches Output', await E(pg, "parseFloat(getComputedStyle(outWin.document.querySelector('#stage .blk')).opacity)>0.95"))
        await E(pg, 'setBlack(false)'); await E(pg, 'closeOut()'); await W(pg, 500)
        ok(L + 'Output closes cleanly', await E(pg, '!outStage'))
    await feature('Studio gate, watermark, Black on Output', studio_gate)

    async def list_ops(pg):
        await add(pg, 'red.png', 'green.png', 'blue.png')
        n0 = await E(pg, 'items.map(i=>i.name).join()')
        await E(pg, 'moveItem(0,2)'); await W(pg, 100)
        ok(L + 'move a cue', await E(pg, 'items.map(i=>i.name).join()') != n0)
        await E(pg, "document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyA',key:'a',metaKey:true,ctrlKey:true,bubbles:true}))"); await W(pg, 100)
        ok(L + 'select all (Ctrl/⌘A) ticks every cue', await E(pg, 'sel.size') == 3, await E(pg, 'sel.size'))
        await E(pg, "sel.clear();render()")
        await pg.dblclick('#list .item .name >> nth=0'); await W(pg, 150)
        inp = await E(pg, "!!document.querySelector('#list .item input.rn')")
        ok(L + 'double-click renames', inp)
        if inp:
            await pg.keyboard.type('Stage welcome'); await pg.keyboard.press('Enter'); await W(pg, 150)
            ok(L + 'rename saved', await E(pg, "items.some(i=>i.name==='Stage welcome')"))
        await E(pg, '$("#clearBtn")?$("#clearBtn").click():null'); await W(pg, 300)
    await feature('list operations', list_ops)

    async def card_click(pg):
        await add(pg, 'red.png', 'green.png')
        bx = await pg.locator('#list .item >> nth=1').bounding_box()
        await pg.mouse.click(bx['x']+bx['width']*.6, bx['y']+bx['height']*.78); await W(pg, 300)
        ok(L + 'click on the empty part of a cue card puts it on screen', await E(pg, 'cur') == 1, await E(pg, 'cur'))
        await pg.mouse.click(bx['x']+bx['width']*.55, bx['y']+bx['height']*.3); await W(pg, 120)
        ok(L + 'click on the name waits (could be a rename)…', await E(pg, 'cur') == 1)
        bx0 = await pg.locator('#list .item >> nth=0').bounding_box()
        await pg.mouse.click(bx0['x']+bx0['width']*.55, bx0['y']+bx0['height']*.3); await W(pg, 450)
        ok(L + '…then a single click on the name goes to that cue', await E(pg, 'cur') == 0, await E(pg, 'cur'))
        await pg.dblclick('#list .item >> nth=1 >> .name'); await W(pg, 450)
        ok(L + 'double-click on a name renames without going live', await E(pg, "!!document.querySelector('#list input.rn')") and await E(pg, 'cur') == 0, await E(pg, 'cur'))
        await pg.keyboard.press('Escape')
        await E(pg, "$('#mAll').click()"); await W(pg, 100)
        await pg.mouse.click(bx['x']+bx['width']*.6, bx['y']+bx['height']*.78); await W(pg, 300)
        ok(L + 'a click with ticks on clears them (and does not go live)', await E(pg, 'sel.size') == 0 and await E(pg, 'cur') == 0, await E(pg, '[sel.size,cur]'))
        await pg.click('#cueMenu .mn'); await W(pg, 100)
        m = await E(pg, "['#mPc','#mLink','#mPdf','#mTxt','#mFm'].every(s=>!!document.querySelector(s))&&!document.querySelector('#cueMenu [data-t=m_music]')")
        ok(L + 'Add cue from… matches the Add window', m)
        await pg.mouse.click(900, 600)
        ok(L + 'version label matches the app version', (await E(pg, "document.querySelector('.ver').textContent")).startswith('v0.3'))
    await feature('cue card clicks + menus', card_click)

    async def create_cue(pg):
        await add(pg, 'va.webm', 'red.png')
        await E(pg, "openCard(null)"); await W(pg, 200)
        await pg.fill('#mkTitle', 'ברוכים הבאים' if lang == 'he' else 'Welcome'); await pg.fill('#mkBody', 'Horizon 2026')
        await E(pg, "mkSetBg(items[0].file,'pc')"); await W(pg, 400)
        await pg.click('#mkPos [data-p=low]')
        await fileFromDisk(pg, 'tone.wav', 'audio/wav'); await E(pg, "mk.audio=window.__f;mkMusShow()")
        await pg.click('#mkOk'); await W(pg, 1500)
        c = await E(pg, "(()=>{const i=items[items.length-1];return {type:i.type,ov:!!i.overlay,dim:i.ovDim,box:i.text.box,y:i.text.y,aud:!!i.audio,thumb:!!i.thumb,loop:i.loop}})()")
        ok(L + 'Create cue: moving background + text + music', c['type'] == 'video' and c['ov'] and c['aud'] and c['box'] and c['y'] > .7, c)
        await E(pg, f'show(2)'); await W(pg, 900)
        ok(L + 'Create cue: background silent, music plays', await E(pg, 'pvStage.media.muted&&!slideAudio.paused'))
        ok(L + 'Create cue: mask + text layers on stage', await E(pg, "document.querySelectorAll('#nowStage .dim,#nowStage img.ov').length>=2"))
        # switch it to a colour background, then back to the picture
        await E(pg, 'openCard(items[2])'); await W(pg, 200); await pg.click('#mkBgSeg [data-b=color]'); await W(pg, 100); await E(pg, "$('#mkDlg').hidden||0")
        await pg.keyboard.press('Escape'); await W(pg, 100)
        await E(pg, 'openCard(items[2])'); await W(pg, 200); await pg.click('#mkBgX'); await pg.click('#mkOk'); await W(pg, 1000)
        ok(L + 'Create cue: switch to colour background', await E(pg, "items[2].type==='image'&&!items[2].overlay&&!items[2].ovDim"), await E(pg, '[items[2].type,items[2].ovDim]'))
        # duplicate then edit the copy only
        await E(pg, "const c2=cloneCue(items[2]);items.push(c2);render()")
        await E(pg, 'openCard(items[3])'); await W(pg, 200); await pg.fill('#mkTitle', 'Copy'); await pg.click('#mkOk'); await W(pg, 900)
        ok(L + 'Create cue: editing a copy leaves the original', await E(pg, "items[2].text.title!=='Copy'&&items[3].text.title==='Copy'"))
        # save and reopen: the background came from this computer without a file handle → Cuey asks to find it
        data = await E(pg, 'JSON.stringify(showData())')
        await E(pg, "setTimeout(()=>0)"); pg_task = asyncio.ensure_future(pg.evaluate('t=>loadShowFromText(t)', data))
        await W(pg, 1200)
        asked = await E(pg, "!$('#pickDlg').hidden")
        ok(L + 'reopen asks for the missing background file', asked)
        if asked: await pg.click('#pkSkip')
        await pg_task; await W(pg, 1500)
        r = await E(pg, "items.map(i=>[i.type,i.text?i.text.bgKind:null,!!i.bad])")
        ok(L + 'colour Create cue reopens fine (no file asked for it)', r[2] == ['image', 'color', False], r)
        ok(L + 'copy reopens fine', r[3][2] is False, r)
        # a moving-background cue whose file is missing can be found again
        await E(pg, "openCard(items[2])"); await W(pg, 200); await E(pg, "mkSetBg(items[0].file,'pc')"); await W(pg, 300); await pg.click('#mkOk'); await W(pg, 900)
        await E(pg, "items[2].bad=true;render()")
        ok(L + 'missing moving background shows "find it"', await E(pg, "!!document.querySelector('#list .item[data-id=\"'+items[2].id+'\"] [data-k=relink]')"))
    await feature('Create cue', create_cue)

    async def card_dup(pg):
        await add(pg, 'va.webm', 'v.webm', 'red.png')
        await E(pg, "(async()=>{openCard(null);mkSetBg(items[0].file,'pc');$('#mkTitle').value='A';await mkCreate()})()"); await W(pg, 1500)
        await E(pg, "items.push(cloneCue(items[3]));render()")
        await E(pg, "(async()=>{openCard(items[3]);mkSetBg(items[1].file,'pc');await mkCreate()})()"); await W(pg, 1500)
        await E(pg, 'show(4)'); await W(pg, 1200)
        ok(L + 'copy keeps its own moving background', await E(pg, "!items[4].bad&&pvStage.media&&pvStage.media.readyState>=2&&!pvStage.media.error"), await E(pg, "[items[4].bad,pvStage.media&&pvStage.media.error&&pvStage.media.error.code]"))
        # text dragged into an edge and back follows the mouse
        await E(pg, 'openCard(items[3])'); await W(pg, 300)
        bx = await pg.locator('#mkPv').bounding_box()
        await pg.mouse.move(bx['x']+bx['width']*.5, bx['y']+bx['height']*.5); await pg.mouse.down(); await pg.mouse.move(bx['x']+bx['width']*.999, bx['y']+bx['height']*.5, steps=6); await pg.mouse.up()
        x1 = await E(pg, 'mk.T.x')
        r = await E(pg, 'mk.rect'); cx = (r['x']+r['w']/2)/1920
        await pg.mouse.move(bx['x']+bx['width']*cx, bx['y']+bx['height']*.5); await pg.mouse.down(); await pg.mouse.move(bx['x']+bx['width']*(cx-.15), bx['y']+bx['height']*.5, steps=6); await pg.mouse.up()
        ok(L + 'text pushed to the edge comes back with the mouse', await E(pg, 'mk.T.x') < x1 - 0.1, [x1, await E(pg, 'mk.T.x')])
        await pg.keyboard.press('Escape')
        ok(L + 'Esc closes Create cue and stops its preview', await E(pg, "$('#mkDlg').hidden&&!$('#mkBg video')"))
    await feature('Create cue: copies + dragging', card_dup)

    async def lib_race(pg):
        await E(pg, "openLib('add')"); await pg.click('#pbTabV'); await W(pg, 900)
        ok(L + 'switching tab fast shows only loops', await E(pg, "[...document.querySelectorAll('#pbGrid .cell')].every(c=>c._t==='video')&&document.querySelectorAll('#pbGrid .cell').length>0"))
        q = await E(pg, "[pbQuery('כדורים'),pbQuery('בחתונה'),pbQuery('מסיבת סיום'),pbQuery('שקיעה וים'),pbQuery('אשדוד')]")
        ok(L + 'Hebrew search matches whole words', q[0] == '' and q[1] == 'wedding' and 'sunset' in q[3] and 'sea' in q[3] and q[4] == '', q)
    await feature('free backgrounds: races + Hebrew words', lib_race)

    async def fs_notice(pg):
        await add(pg, 'red.png')
        async with ctx.expect_page() as np:
            await pg.click('#openOut')
        o = await np.value; await W(pg, 700)
        # simulate: full screen, then the operator presses Esc (no file window opened by Cuey)
        await E(pg, "outWin.__fsWas=true;pickerAt=-1e9;outWin.document.dispatchEvent(new Event('fullscreenchange'))"); await W(pg, 200)
        ok(L + 'leaving full screen on purpose shows no warning', await E(pg, "$('#fsWarn').hidden&&outWin.document.getElementById('fsb').style.display!=='flex'"))
        await E(pg, "outWin.__fsWas=true;markPicker();outWin.document.dispatchEvent(new Event('fullscreenchange'))"); await W(pg, 200)
        ok(L + 'file window from Cuey → one-click-back notice', await E(pg, "!$('#fsWarn').hidden"))
        ok(L + 'clear banner in Cuey for the lost full screen', await E(pg, "!$('#obBar').hidden&&$('#obT').textContent===t('ob_fs_t')"))
        ok(L + 'hint on the windowed Output', await E(pg, "outWin.document.getElementById('fsh').style.display==='block'"))
        await pg.click('#obOk'); ok(L + 'banner closes with OK', await E(pg, "$('#obBar').hidden"))
        ok(L + 'no text on the audience screen', await E(pg, "outWin.document.getElementById('fsb').textContent.trim()===''"))
        await E(pg, 'closeOut()')
    await feature('Output full-screen notice', fs_notice)

    async def library(pg):
        await E(pg, "openLib('add')"); await W(pg, 700)
        ok(L + 'library shows results', await E(pg, "document.querySelectorAll('#pbGrid .cell').length") == 6)
        await pg.click('#pbGrid .cell >> nth=1'); await W(pg, 1200)
        ok(L + 'library photo becomes a cue', await E(pg, "items.length===1&&items[0].type==='image'&&/Pixabay/.test(items[0].name)"), await E(pg, 'items.map(i=>i.name)'))
        await E(pg, "openLib('add')"); await W(pg, 300); await pg.click('#pbTabV'); await W(pg, 500)
        await pg.hover('#pbGrid .cell >> nth=2'); await W(pg, 1200)
        ok(L + 'hovering a loop plays it in its tile', await E(pg, "(()=>{const v=document.querySelector('#pbGrid .cell:nth-child(3) video');return !!v&&!v.paused&&v.currentTime>0})()"))
        await pg.click('#pbGrid .cell >> nth=0'); await W(pg, 1500)
        ok(L + 'library loop becomes a looping video cue', await E(pg, "items[1]&&items[1].type==='video'&&items[1].loop"))
        await E(pg, "openCard(null)"); await W(pg, 200); await pg.click('#mkBgSeg [data-b=lib]'); await W(pg, 500)
        ok(L + 'library above Create cue', await E(pg, "!$('#libDlg').hidden&&!$('#mkDlg').hidden"))
        await pg.keyboard.press('Escape'); await W(pg, 150)
        ok(L + 'Esc closes only the library', await E(pg, "$('#libDlg').hidden&&!$('#mkDlg').hidden"))
        await pg.keyboard.press('Escape'); await W(pg, 150)
        PB_MODE['status'] = 503; await E(pg, "openLib('add')"); await W(pg, 600)
        ok(L + 'library not configured → friendly message', await E(pg, "$('#pbGrid').textContent.length>10&&!$('#pbGrid .cell')"))
        await E(pg, 'closeLib()')
        PB_MODE['status'] = 500; await E(pg, "openLib('add')"); await W(pg, 600)
        ok(L + 'library error → friendly message', await E(pg, "$('#pbGrid').textContent===t('pb_err')"), await E(pg, "$('#pbGrid').textContent"))
        PB_MODE['status'] = 200
    await feature('free backgrounds', library)

    async def paste_link(pg):
        await E(pg, "(()=>{const dt=new DataTransfer();dt.setData('text/plain','https://www.youtube.com/watch?v=aqz-KE-bpKQ');document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true}))})()"); await W(pg, 800)
        ok(L + 'Ctrl+V a YouTube link adds an online cue', await E(pg, "items.length===1&&!!items[0].web"))
        await E(pg, "setLicensed(true);window.__posts=[];shPost=o=>{__posts.push(o);return Promise.resolve()};sharing=true;cur=0;pvStage.media={currentTime:12,paused:false,tagName:'VIDEO'};shWebTick(true)")
        ok(L + 'Share screen tells the screen page which online video to play', await E(pg, "__posts.some(p=>p.t==='web'&&p.on&&p.p==='yt'&&p.at===12)"), await E(pg, 'JSON.stringify(__posts)'))
        await E(pg, "setBlack(true)"); await W(pg, 100)
        ok(L + 'Black stops the online video on the screen page', await E(pg, "__posts.some(p=>p.t==='web'&&!p.on)"))
        await E(pg, "sharing=false;setBlack(false)")
    await feature('paste a link', paste_link)

    async def strings(pg):
        miss = await E(pg, "(()=>{const en=L.en,he=L.he;return Object.keys(en).filter(k=>!(k in he))})()") if await E(pg, "typeof L!=='undefined'&&!!L.he") else None
        if miss is None:
            ok(L + 'translation table found', False, 'I18N not found'); return
        ok(L + 'every English text has a Hebrew one', not miss, miss[:20])
    if lang == 'he': await feature('translations', strings)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.route(lambda u: u.startswith('http') and 'pixabay' not in u, lambda r: r.abort())
        await ctx.route('**/functions/v1/pixabay**', pixabay); await ctx.route('https://cdn.pixabay.com/**', cdn)
        for lang in ['en', 'he']:
            await features(ctx, f'[{lang}] ', lang)
        await b.close()
    n = sum(1 for r in RES if r[1]); print(f'\n{n}/{len(RES)} passed')
asyncio.run(main())
