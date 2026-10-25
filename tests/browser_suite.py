import asyncio, json, sys, traceback
from playwright.async_api import async_playwright

APP = 'file:///tmp/cuey/app/cuey.html'
RES = []
def ok(name, cond, info=''):
    RES.append((name, bool(cond), info))
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  -> ' + str(info)))

async def fresh(ctx, lang='en'):
    pg = await ctx.new_page()
    pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.on('console', lambda m: pg.errs.append('console:' + m.text) if m.type == 'error' and 'ERR_' not in m.text and 'favicon' not in m.text and 'fonts.g' not in m.text else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto(APP)
    await pg.evaluate(f"localStorage.clear();localStorage.setItem('cuey.lang','{lang}')")
    await pg.reload()
    await pg.wait_for_timeout(300)
    return pg

async def add(pg, files):
    await pg.set_input_files('#fileIn', files)
    await pg.wait_for_timeout(700)

E = lambda pg, js: pg.evaluate(js)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        await ctx.route(lambda u: u.startswith('http'), lambda r: r.abort())
        for lang in ['en', 'he']:
            L = f'[{lang}] '
            pg = await fresh(ctx, lang)
            try:
                # --- empty state + top bar
                ok(L+'version shown', (await E(pg, "document.querySelector('.ver').textContent")).startswith('v0.'))
                ok(L+'layout LTR', await E(pg, "document.documentElement.dir")=='ltr')
                ok(L+'no keys strip on page', await E(pg, "!document.querySelector('main .keys')"))
                for m in ['#fileMenu', '#cueMenu', '#showMenu', '#helpMenu']:
                    await pg.click(m + ' .mn'); await pg.wait_for_timeout(80)
                    ok(L+'menu opens '+m, await E(pg, f"document.querySelector('{m}').classList.contains('open')"))
                    await pg.mouse.click(700, 500)
                    ok(L+'menu closes '+m, await E(pg, f"!document.querySelector('{m}').classList.contains('open')"))
                await pg.click('#acctBtn'); await pg.wait_for_timeout(80)
                ok(L+'profile menu has language + no shortcuts', await E(pg, "!!document.querySelector('#pm .seg') && !document.querySelector('#pmKeys')"))
                await pg.mouse.click(700, 500)
                # --- add dialog
                await pg.click('#addBtn'); ok(L+'add dialog opens', await E(pg, "!$('#addDlg').hidden"))
                await pg.keyboard.press('Escape'); ok(L+'add dialog Esc closes', await E(pg, "$('#addDlg').hidden"))
                # --- files
                await add(pg, ['red.png', 'green.png', 'va.webm', 'blue.png'])
                ok(L+'4 cues added', await E(pg, 'items.length')==4)
                ok(L+'thumbs made', await E(pg, 'items.every(i=>!!i.thumb)'), await E(pg,'items.map(i=>!!i.thumb)'))
                ok(L+'card has no edit/arrow buttons', await E(pg, "!document.querySelector('.item [data-k=edit],.item [data-k=up],.item [data-k=del]')"))
                ok(L+'video card has volume', await E(pg, "!!document.querySelectorAll('.item')[2].querySelector('[data-k=vol]')"))
                # --- GO / back / black / freeze
                await pg.keyboard.press('Space'); await pg.wait_for_timeout(500)
                ok(L+'GO -> cue 0', await E(pg, 'cur')==0)
                await pg.keyboard.press('Enter'); await pg.wait_for_timeout(400)
                ok(L+'Enter -> cue 1', await E(pg, 'cur')==1)
                await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(900)
                ok(L+'→ video playing', await E(pg, "cur==2&&pvStage.media&&!pvStage.media.paused"), await E(pg,'cur'))
                await pg.keyboard.press('f'); await pg.wait_for_timeout(200)
                ok(L+'freeze pauses + button says play', await E(pg, "pvStage.media.paused&&$('#frz').classList.contains('on')"))
                await pg.keyboard.press('f'); await pg.wait_for_timeout(300)
                ok(L+'unfreeze plays', await E(pg, "!pvStage.media.paused"))
                await pg.keyboard.press('b'); ok(L+'black on', await E(pg, 'blackOn'))
                await pg.keyboard.press('b'); ok(L+'black off', await E(pg, '!blackOn'))
                await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(300)
                ok(L+'back -> cue 1', await E(pg, 'cur')==1)
                await pg.keyboard.press('Home'); await pg.wait_for_timeout(300)
                ok(L+'Home -> first', await E(pg, 'cur')==0)
                # --- slider focus must not steal GO; holding Space = one GO
                await E(pg, 'show(0)'); await pg.wait_for_timeout(300)
                await pg.locator('.item [data-k=vol]').first.click(); await pg.keyboard.press('Space'); await pg.wait_for_timeout(300)
                ok(L+'Space after touching a slider still GOes', await E(pg, 'cur')==1, await E(pg,'cur'))
                await E(pg, 'show(0)'); await pg.wait_for_timeout(200)
                await pg.keyboard.down('Space'); await E(pg, "for(let k=0;k<3;k++)document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',repeat:true,bubbles:true}))"); await pg.keyboard.up('Space'); await pg.wait_for_timeout(300)
                ok(L+'held Space = one GO', await E(pg, 'cur')==1, await E(pg,'cur'))
                await E(pg, "document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyB',key:'נ',bubbles:true}))")
                ok(L+'Black works on Hebrew keyboard', await E(pg, 'blackOn')); await E(pg,'setBlack(false)')
                # --- master volume
                await E(pg, 'setMaster(.3)')
                ok(L+'master saved', await E(pg, "localStorage.getItem('cuey.master')")=='0.3')
                await E(pg, 'show(2)'); await pg.wait_for_timeout(500)
                ok(L+'master applied to video', abs(await E(pg, 'pvStage.media.volume')-0.3*await E(pg,'items[2].vol'))<0.01, await E(pg,'pvStage.media.volume'))
                await E(pg, 'setMaster(1)')
                # --- right-click menu + edit panel
                await pg.locator('.item').nth(0).click(button='right'); await pg.wait_for_timeout(100)
                ok(L+'context menu', await E(pg, "!!$('#ctxm')"))
                await pg.keyboard.press('Escape')
                await pg.click('#ctxm [data-c=edit]') if await E(pg, "!!$('#ctxm')") else None
                if await E(pg, "$('#editDlg').hidden"):
                    await pg.locator('.item').nth(0).click(button='right'); await pg.click('#ctxm [data-c=edit]')
                ok(L+'edit panel opens', await E(pg, "!$('#editDlg').hidden"))
                await pg.fill('#edBox [data-f=name]', 'Opening'); await pg.click('#edBox .seg[data-f=onEndI] button[data-v=next]'); await pg.fill('#edBox [data-f=hold]', '2')
                await pg.click('#edOk')
                ok(L+'edit saved name/onEnd/hold', await E(pg, "items[0].name==='Opening'&&items[0].onEnd==='next'&&items[0].hold===2"), await E(pg,'[items[0].name,items[0].onEnd,items[0].hold]'))
                ok(L+'tag shows timer', 'tg' in await E(pg, "document.querySelector('.item .tags').innerHTML"))
                # Esc closes edit
                await pg.locator('.item').nth(1).click(button='right'); await pg.click('#ctxm [data-c=edit]'); await pg.keyboard.press('Escape')
                ok(L+'edit Esc closes', await E(pg, "$('#editDlg').hidden"))
                # duplicate / rename / remove via context
                n0 = await E(pg, 'items.length')
                await pg.locator('.item').nth(1).click(button='right'); await pg.click('#ctxm [data-c=dup]')
                ok(L+'duplicate', await E(pg, 'items.length')==n0+1)
                await pg.locator('.item').nth(2).click(button='right'); await pg.click('#ctxm [data-c=del]')
                ok(L+'remove', await E(pg, 'items.length')==n0)
                # multi edit
                await pg.locator('.item .n').nth(0).click(); await pg.locator('.item .n').nth(1).click(); await pg.wait_for_timeout(200)
                ok(L+'slide show question at 2 ticks', await E(pg, "!$('#selBar').hidden"))
                await pg.click('#ssCancel')
                ok(L+'cancel keeps ticks', await E(pg, "sel.size===2&&$('#selBar').hidden"))
                await pg.locator('.item').nth(0).click(button='right'); await pg.click('#ctxm [data-c=edit]')
                await pg.click('#edBox .seg[data-f=trans] button[data-v=cut]'); await pg.click('#edOk')
                ok(L+'multi edit applies to both', await E(pg, "items[0].trans==='cut'&&items[1].trans==='cut'"))
                await pg.keyboard.press('Escape')
                ok(L+'Esc clears ticks', await E(pg, 'sel.size')==0)
                # --- slide show
                await pg.locator('.item .n').nth(0).click(); await pg.locator('.item .n').nth(1).click(); await pg.click('#ssMake'); await pg.wait_for_timeout(200)
                ok(L+'slide show made', await E(pg, "Object.keys(groups).length===1&&items[0].grp&&items[0].grp===items[1].grp"))
                ok(L+'slide show card closed + numbered', await E(pg, "!!document.querySelector('.grpc')&&!document.querySelector('.item.ingrp')"))
                await pg.locator('.grpc').click(button='right'); await pg.click('#ctxm [data-c=edit]')
                await pg.fill('#edBox [data-f=hold]', '1'); await pg.click('#edOk')
                await pg.locator('.grpc .gtag').click(); await pg.wait_for_timeout(2600)
                ok(L+'slide show advances + loops', await E(pg, 'cur')in(0,1))
                c = await E(pg, 'cur'); await pg.keyboard.press('Space'); await pg.wait_for_timeout(500)
                ok(L+'GO leaves slide show', await E(pg, 'cur')==2, await E(pg,'cur'))
                await pg.click('.grpc [data-g=tog]'); await pg.wait_for_timeout(300)
                ok(L+'folder opens', await E(pg, "document.querySelectorAll('.item.ingrp').length")==2)
                await pg.click('.grpc [data-g=tog]')
                # --- text slide (long)
                await E(pg, "$('#addText').click()"); await pg.wait_for_timeout(200)
                ok(L+'create cue dialog opens', await E(pg, "!$('#mkDlg').hidden"))
                await pg.fill('#mkTitle', 'A very long title that should wrap nicely and never run off the edges of the event screen at all')
                await pg.fill('#mkBody', '\n'.join(['line of text number %d with quite a few words in it to wrap' % i for i in range(10)]))
                await pg.click('#mkOk'); await pg.wait_for_timeout(900)
                ok(L+'text slide added', await E(pg, 'items.some(i=>i.text)'))
                tix = await E(pg, 'items.findIndex(i=>i.text)')
                ok(L+'duplicate is a real copy', await E(pg, f"(()=>{{const c=cloneCue(items[{tix}]);c.text.title='Changed copy';return items[{tix}].text.title!=='Changed copy'}})()"))
                # --- output window
                async with ctx.expect_page() as np:
                    await pg.click('#openOut')
                o = await np.value; await pg.wait_for_timeout(900)
                ok(L+'output open + close button', await E(pg, "!!outStage&&!$('#closeOut').hidden"))
                ti = await E(pg, 'items.findIndex(i=>i.text)')
                await E(pg, f'show({ti})'); await pg.wait_for_timeout(1200)
                ok(L+'text slide on output', await E(pg, "(()=>{const i=outWin.document.querySelector('#stage .ly:not([style*=\"opacity: 0\"]) img')||[...outWin.document.querySelectorAll('#stage img')].pop();return !!i&&i.naturalWidth===1920})()"))
                vi = await E(pg, "items.findIndex(i=>i.type==='video')")
                # --- Create cue: text over a moving background, on Output too
                await E(pg, f"(async()=>{{openCard(null);mkSetBg(items[{vi}].file,'pc');$('#mkTitle').value='Over video';mk.T.title='Over video';await mkCreate()}})()"); await pg.wait_for_timeout(1500)
                ci = await E(pg, "items.findIndex(i=>i.type==='video'&&i.overlay)")
                ok(L+'text-over-video cue created', ci >= 0)
                await E(pg, f'show({ci})'); await pg.wait_for_timeout(1500)
                ok(L+'overlay on output', await E(pg, "outWin.document.querySelectorAll('#stage img.ov').length>0"))
                ok(L+'overlay in preview', await E(pg, "document.querySelectorAll('#nowStage img.ov').length>0"))

                await E(pg, f'show({vi})'); await pg.wait_for_timeout(1200)
                ok(L+'single sound: preview muted, output not', await E(pg, "[...document.querySelectorAll('#nowStage video')].every(v=>v.muted)&&outStage.media&&!outStage.media.muted"))
                await E(pg, 'ensureGraph()'); await add(pg, ['tone.wav']); ai = await E(pg, "items.findIndex(i=>i.type==='audio')")
                await E(pg, f'show({ai})'); await pg.wait_for_timeout(800)
                ok(L+'audio cue audible with Output open', await E(pg, "!slideAudio.paused&&slideLocal&&slideLocal.gain.value===1"))
                await pg.click('#closeOut'); await pg.wait_for_timeout(500)
                ok(L+'output closes', await E(pg, '!outStage'))
                # --- online cue (offline env: just structure)
                await E(pg, "addWebCue('https://www.youtube.com/watch?v=dQw4w9WgXcQ')"); await pg.wait_for_timeout(300)
                ok(L+'online cue added with tag', await E(pg, "items.some(i=>i.web)&&!!document.querySelector('.webtag')"))
                # --- PDF / PPTX
                await add(pg, ['deck.pdf']); await pg.wait_for_timeout(2500)
                ok(L+'PDF pages added', await E(pg, "items.filter(i=>/deck — \\d+/.test(i.file.name)).length")==3)
                await add(pg, ['deck.pptx']); await pg.wait_for_timeout(1200)
                ok(L+'PPTX videos + dialog', await E(pg, "items.filter(i=>/video \\d/.test(i.file.name)).length===2&&!$('#importDlg').hidden"))
                await pg.click('#imX')
                # --- save / reopen
                data = await E(pg, 'JSON.stringify(showData())')
                d = json.loads(data)
                ok(L+'save has groups + web + renamed', bool(d.get('groups')) and any(c.get('web') for c in d['cues']) and any(c.get('renamed') for c in d['cues']))
                await pg.reload(); await pg.wait_for_timeout(300)
                await E(pg, f"void loadShowFromText({json.dumps(data)})"); await pg.wait_for_timeout(600)
                ok(L+'pick-files dialog shown', await E(pg, "!$('#pickDlg').hidden"))
                async with pg.expect_file_chooser() as fc:
                    await pg.click('#pkPick')
                await (await fc.value).set_files(['red.png', 'green.png', 'va.webm', 'blue.png', 'tone.wav'])
                await pg.wait_for_timeout(1500)
                ok(L+'reopen: same count', await E(pg, 'items.length')==len(d['cues']), [await E(pg,'items.length'),len(d['cues'])])
                ok(L+'reopen: nothing missing', await E(pg, 'items.filter(i=>i.bad).length')==0, await E(pg,'items.filter(i=>i.bad).map(i=>i.name)'))
                ok(L+'reopen: group kept', await E(pg, 'Object.keys(groups).length')==1)
                ok(L+'reopen: name kept', await E(pg, "items.some(i=>i.name==='Opening')"))
                # --- recent
                await pg.click('#fileMenu .mn'); await pg.hover('#mRecent'); await pg.wait_for_timeout(300)
                ok(L+'recent menu renders', await E(pg, "$('#recentList').children.length>0"))
                await pg.mouse.click(700, 500)
                # --- keys dialog
                await pg.keyboard.press('?'); ok(L+'? opens shortcuts', await E(pg, "!$('#keysDlg').hidden"))
                await pg.keyboard.press('Escape'); ok(L+'Esc closes shortcuts', await E(pg, "$('#keysDlg').hidden"))
                # --- typing in inputs must not trigger GO
                c0 = await E(pg, 'cur')
                await pg.locator('.item').nth(0).click(button='right'); await pg.click('#ctxm [data-c=edit]')
                await pg.locator('#edBox [data-f=name]').press('Space'); await pg.locator('#edBox [data-f=name]').press('b')
                ok(L+'typing in edit name does not GO/black', await E(pg, 'cur')==c0 and not await E(pg, 'blackOn'))
                await pg.keyboard.press('Escape')
                # --- language switch keeps layout
                await pg.click('#acctBtn'); await pg.click('.pm .seg button[data-l=%s]' % ('he' if lang=='en' else 'en'))
                ok(L+'language switch keeps LTR layout', await E(pg, "document.documentElement.dir")=='ltr')
                await pg.mouse.click(700, 500)
                await pg.screenshot(path=f'suite_{lang}.png')
                ok(L+'no page errors', not pg.errs, pg.errs[:5])
            except Exception as e:
                ok(L+'suite crashed', False, traceback.format_exc()[-600:])
            await pg.close()
        await b.close()
    fails = [r for r in RES if not r[1]]
    print(f'\n{len(RES)-len(fails)}/{len(RES)} passed')
    json.dump(RES, open('suite_result.json', 'w'))

asyncio.run(main())
