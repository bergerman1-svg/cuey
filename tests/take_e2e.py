"""TAKE (asked for after the second event, 18.11): press TAKE, click a cue, and that cue plays next out of order;
after it the show returns to the order it left. The click in TAKE mode never puts a cue live."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
ST = "({cur,next:nextIdx(),mode:takeMode,arm:$('#take').classList.contains('arm'),set:$('#take').classList.contains('set'),tag:[...document.querySelectorAll('#list .item')].findIndex(r=>r.querySelector('.tk')),nxtRow:[...document.querySelectorAll('#list .item')].findIndex(r=>r.classList.contains('nxt')),pv:($('#pvNext .nm')||$('#pvNext')).textContent})"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        for lang in ('en', 'he'):
            L = f'[{lang}] '
            pg = await (await b.new_context(viewport={'width': 1440, 'height': 860})).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('file://' + ROOT + f'/app/cuey.html?nosplash&notour&lang={lang}'); await pg.wait_for_timeout(700)
            names = ['red.png', 'green.png', 'blue.png', 'yellow.png', 'red.png', 'green.png', 'blue.png', 'yellow.png']
            await pg.set_input_files('#fileIn', [os.path.join(FIX, n) for n in names[:4]]); await pg.wait_for_timeout(700)
            await pg.set_input_files('#fileIn', [os.path.join(FIX, n) for n in names[4:]]); await pg.wait_for_timeout(900)
            n = await pg.evaluate("items.forEach((x,i)=>x.name='C'+(i+1));render();items.length")
            ok(L + 'eight cues loaded', n == 8, n)
            # layout: TAKE sits before BACK in the same block, BACK is the narrower one, GO did not move or shrink
            lay = await pg.evaluate("(()=>{const r=s=>$(s).getBoundingClientRect();const t=r('#take'),k=r('#back'),g=r('#go');return {tw:t.width,bw:k.width,sameRow:Math.abs(t.top-k.top)<2&&Math.abs(t.height-k.height)<2,tLeftOfBack:t.right<=k.left+1,backLeftOfGo:k.right<=g.left+1,gw:g.width,vis:t.width>60&&t.height>40,txt:$('#take').textContent}})()")
            ok(L + 'TAKE is in the bar, to the left of BACK, and BACK is the smaller of the two', lay['vis'] and lay['sameRow'] and lay['tLeftOfBack'] and lay['backLeftOfGo'] and lay['bw'] < lay['tw'] and lay['txt'] == 'TAKE', lay)
            ok(L + 'GO keeps its size', lay['gw'] >= 280, lay)
            await pg.click('#list .item >> nth=2'); await pg.wait_for_timeout(300)        # C3 live
            s = await pg.evaluate(ST); ok(L + 'start: C3 is live, C4 is next', s['cur'] == 2 and s['next'] == 3, s)
            await pg.click('#take'); await pg.wait_for_timeout(150)
            s = await pg.evaluate(ST); ok(L + 'TAKE pressed: the button is armed and nothing changed on the screen', s['mode'] and s['arm'] and s['cur'] == 2 and s['next'] == 3, s)
            await pg.click('#list .item >> nth=7'); await pg.wait_for_timeout(300)        # choose C8
            s = await pg.evaluate(ST)
            ok(L + 'clicking C8 does NOT put it live — it becomes the next cue', s['cur'] == 2 and s['next'] == 7 and not s['mode'], s)
            ok(L + 'the row is marked (NEXT colour + TAKE tag), the button stays lit, the NEXT preview shows it', s['tag'] == 7 and s['nxtRow'] == 7 and s['set'] and not s['arm'] and 'C8' in s['pv'], s)
            await pg.click('#go'); await pg.wait_for_timeout(300)
            s = await pg.evaluate(ST); ok(L + 'GO plays C8, and the next cue is back in the order: C4', s['cur'] == 7 and s['next'] == 3 and not s['set'] and s['tag'] == -1, s)
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(300)
            s = await pg.evaluate(ST); ok(L + 'GO again returns to C4, then the list runs on as usual (next C5)', s['cur'] == 3 and s['next'] == 4, s)
            await pg.click('#go'); await pg.wait_for_timeout(250)
            s = await pg.evaluate(ST); ok(L + 'C5 follows', s['cur'] == 4 and s['next'] == 5, s)
            # an earlier cue, with the keyboard
            await pg.keyboard.press('t'); await pg.wait_for_timeout(120); await pg.click('#list .item >> nth=0'); await pg.wait_for_timeout(250); await pg.keyboard.press('Space'); await pg.wait_for_timeout(250)
            s = await pg.evaluate(ST); ok(L + 'T + click on an earlier cue (C1) + GO: C1 is live, next is C6', s['cur'] == 0 and s['next'] == 5, s)
            await pg.keyboard.press('Space'); await pg.wait_for_timeout(250)
            s = await pg.evaluate(ST); ok(L + 'and back to C6', s['cur'] == 5 and s['next'] == 6, s)
            # cancelling
            await pg.wait_for_timeout(450); await pg.click('#take'); await pg.wait_for_timeout(450); await pg.click('#take'); await pg.wait_for_timeout(150)
            s = await pg.evaluate(ST); ok(L + 'TAKE, then TAKE again = cancelled; the next click works as always', not s['mode'] and not s['arm'], s)
            await pg.wait_for_timeout(450); await pg.dblclick('#take'); await pg.wait_for_timeout(200)
            s = await pg.evaluate(ST); ok(L + 'a double press on TAKE is one press (still armed, a click will not go live by surprise)', s['mode'] and s['arm'], s)
            lbl = await pg.evaluate("$('#take').textContent")
            ok(L + 'the armed button says what to do', lbl == ('PICK A CUE' if lang == 'en' else 'בחר קיו'), lbl)
            await pg.dblclick('#list .item >> nth=1'); await pg.wait_for_timeout(700)
            s = await pg.evaluate(ST); ok(L + 'a double-click on a cue while armed chooses it and does NOT put it live', s['cur'] == 5 and s['next'] == 1 and s['set'], s)
            ok(L + 'the button shows the take is set', await pg.evaluate("$('#take').textContent") == 'TAKE ✓')
            # changing your mind: TAKE again + another cue replaces the choice, nothing goes live
            await pg.click('#take'); await pg.wait_for_timeout(150)
            s = await pg.evaluate(ST); ok(L + 'TAKE with a cue already chosen arms again and keeps the choice meanwhile', s['mode'] and s['next'] == 1 and s['cur'] == 5, s)
            await pg.click('#list .item >> nth=3'); await pg.wait_for_timeout(600)
            s = await pg.evaluate(ST); ok(L + 'the next click replaces the chosen cue — nothing goes live', s['cur'] == 5 and s['next'] == 3 and s['tag'] == 3 and not s['mode'], s)
            await pg.click('#take'); await pg.wait_for_timeout(450); await pg.click('#take'); await pg.wait_for_timeout(200)
            s = await pg.evaluate(ST); ok(L + 'TAKE, TAKE removes the chosen cue', s['next'] == 6 and not s['set'] and s['tag'] == -1 and not s['mode'], s)
            await pg.wait_for_timeout(450); await pg.click('#take'); await pg.click('#list .item >> nth=1'); await pg.wait_for_timeout(500); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
            s = await pg.evaluate(ST); ok(L + 'and by Esc', s['next'] == 6 and not s['set'], s)
            await pg.wait_for_timeout(450); await pg.click('#take'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
            s = await pg.evaluate(ST); ok(L + 'Esc also leaves the armed state', not s['mode'], s)
            # an armed TAKE that is forgotten: GO drops it, so a later click is not swallowed
            await pg.wait_for_timeout(450); await pg.click('#take'); await pg.wait_for_timeout(100); await pg.click('#go'); await pg.wait_for_timeout(250)
            s = await pg.evaluate(ST); ok(L + 'GO with TAKE armed and no cue chosen: plain GO, and TAKE lets go', s['cur'] == 6 and not s['mode'] and not s['arm'], s)
            await pg.click('#back'); await pg.wait_for_timeout(250); await pg.wait_for_timeout(450); await pg.click('#take'); await pg.wait_for_timeout(100); await pg.evaluate("clearTimeout(takeTm);takeTm=setTimeout(()=>{if(takeMode){takeOff();render()}},600)"); await pg.wait_for_timeout(900)
            s = await pg.evaluate(ST); ok(L + 'an armed TAKE that is not used lets go by itself', s['cur'] == 5 and not s['mode'] and not s['arm'], s)
            await pg.wait_for_timeout(450)
            # the natural next cue taken: nothing odd, no return loop
            await pg.click('#take'); await pg.click('#list .item >> nth=6'); await pg.wait_for_timeout(150); await pg.click('#go'); await pg.wait_for_timeout(250)
            s = await pg.evaluate(ST); ok(L + 'taking the cue that was next anyway just plays it and goes on (C7 → next C8)', s['cur'] == 6 and s['next'] == 7, s)
            # clicking the live cue in TAKE mode chooses nothing
            await pg.click('#take'); await pg.click('#list .item >> nth=6'); await pg.wait_for_timeout(200)
            s = await pg.evaluate(ST); ok(L + 'clicking the live cue in TAKE mode chooses nothing and leaves the mode', s['cur'] == 6 and s['next'] == 7 and not s['mode'] and not s['set'], s)
            # a take, then the operator jumps somewhere else by hand: the way back is forgotten, the take stays
            await pg.click('#take'); await pg.click('#list .item >> nth=1'); await pg.wait_for_timeout(150); await pg.click('#go'); await pg.wait_for_timeout(250)   # C2 live, return = C8
            await pg.click('#list .item >> nth=4'); await pg.wait_for_timeout(250)                                                                                        # click C5 live
            s = await pg.evaluate(ST); ok(L + 'after a take, putting another cue live by hand drops the way back (C5 → next C6)', s['cur'] == 4 and s['next'] == 5, s)
            # BACK after a take
            await pg.click('#take'); await pg.click('#list .item >> nth=7'); await pg.wait_for_timeout(150); await pg.click('#go'); await pg.wait_for_timeout(250); await pg.click('#back'); await pg.wait_for_timeout(250)
            s = await pg.evaluate(ST); ok(L + 'BACK from a taken cue goes back to the cue the show came from (C5), and the order continues from there', s['cur'] == 4 and s['next'] == 5, s)
            # the cue to return to is removed while the taken cue is live → the one after it
            await pg.wait_for_timeout(450); await pg.click('#take'); await pg.click('#list .item >> nth=7'); await pg.wait_for_timeout(500); await pg.click('#go'); await pg.wait_for_timeout(250)
            keep = await pg.evaluate("(()=>{const want=items[6].name;items.splice(5,1);cur--;render();return [want,items[nextIdx()]&&items[nextIdx()].name]})()")
            ok(L + 'the cue to return to was removed: the show returns to the one after it', keep[0] == keep[1], keep)
            await pg.evaluate("location.hash='';0"); await pg.click('#back'); await pg.wait_for_timeout(250)
            # the taken cue is deleted before GO
            await pg.click('#list .item >> nth=1'); await pg.wait_for_timeout(200)       # C2 live
            await pg.click('#take'); await pg.click('#list .item >> nth=5'); await pg.wait_for_timeout(150)
            await pg.evaluate("items.splice(5,1);render()"); await pg.wait_for_timeout(150)
            s = await pg.evaluate(ST); ok(L + 'a taken cue that is deleted leaves the normal next cue', s['next'] == 2 and not s['set'], s)
            # a cue that continues by itself goes to the taken cue too
            await pg.evaluate("items[1].onEnd='next';items[1].hold=0.6;show(1)"); await pg.wait_for_timeout(150)
            await pg.click('#take'); await pg.click('#list .item >> nth=5'); await pg.wait_for_timeout(1300)
            s = await pg.evaluate(ST); ok(L + 'a cue set to continue by itself continues to the taken cue, and the way back is kept', s['cur'] == 5 and s['next'] == 2, s)
            # last cue: take, then the list has nothing to return to
            last = await pg.evaluate("items.length-1")
            await pg.evaluate(f"items.forEach(x=>{{x.onEnd='hold'}});show(0);show({last})"); await pg.wait_for_timeout(200)
            await pg.click('#take'); await pg.click('#list .item >> nth=0'); await pg.wait_for_timeout(150); await pg.click('#go'); await pg.wait_for_timeout(250)
            s = await pg.evaluate(ST); ok(L + 'a take from the last cue: the list had ended, so the show simply goes on from the taken cue (next C2)', s['cur'] == 0 and s['next'] == 1, s)
            await pg.click('#go'); await pg.wait_for_timeout(250)
            ok(L + 'and every GO does something (no dead press)', await pg.evaluate("cur") == 1)
            await pg.evaluate("show(0)"); await pg.wait_for_timeout(200)
            # a slide show: the header can be taken; the take waits until the slide show is left
            await pg.evaluate("studioOk=true;sel.clear();sel.add(items[2].id);sel.add(items[3].id);render()"); await pg.wait_for_timeout(150); await pg.click('#ssMake'); await pg.wait_for_timeout(300)
            g = await pg.evaluate("items[2].grp")
            await pg.evaluate(f"groups['{g}'].hold=0.5;groups['{g}'].end='loop';applyGrp('{g}');show(0)"); await pg.wait_for_timeout(200)
            await pg.click('#take'); await pg.click('#list .grpc'); await pg.wait_for_timeout(200)
            s = await pg.evaluate(ST); ok(L + 'TAKE + click on a slide show header chooses the slide show', s['cur'] == 0 and s['next'] == 2, s)
            await pg.click('#go'); await pg.wait_for_timeout(300)
            await pg.click('#take'); await pg.click('#list .item:not(.grpc):not(.ingrp) >> nth=3'); await pg.wait_for_timeout(1400)
            s = await pg.evaluate(ST); inG = await pg.evaluate(f"items[cur].grp==='{g}'")
            ok(L + 'inside a running slide show the slides keep changing; the take waits for GO', inG and s['set'], s)
            tk = await pg.evaluate("takeIdx()"); await pg.click('#go'); await pg.wait_for_timeout(300)
            s = await pg.evaluate(ST); ok(L + 'GO leaves the slide show to the taken cue, and then back to the cue after the slide show', s['cur'] == tk and s['next'] == 1, s)
            ok(L + 'no page errors', not errs, errs[:2])
            await pg.close()
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed'); raise SystemExit(0 if all(res) else 1)
asyncio.run(main())
