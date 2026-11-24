"""Decision 20.11: the sound of the show always plays in the control window; the event-screen window is picture only (so it never
has to be clicked to be allowed to play). The picture there follows the sound: the copy that is heard is never touched while it
plays, the silent copy is kept in step with it."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:320]) if extra and not c else ''))
S = "(()=>{const V=m=>m&&m.tagName==='VIDEO'?m:null,p=V(pvStage.media),o=V(outStage&&outStage.media);return {p:p?+p.currentTime.toFixed(3):null,pm:p?p.muted:null,pp:p?p.paused:null,pv:p?p.volume:null,pr:p?p.playbackRate:null,o:o?+o.currentTime.toFixed(3):null,om:o?o.muted:null,op:o?o.paused:null,k:pvDiag.kicks,warn:!$('#sndWarn').hidden||!$('#obBar').hidden,sndb:outWin&&!outWin.closed&&outWin.document.getElementById('sndb')?outWin.getComputedStyle(outWin.document.getElementById('sndb')).display:'none'}})()"
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=['--allow-file-access-from-files'])  # NO autoplay flag: the browser's real rule about sound applies
        ctx = await b.new_context(viewport={'width': 1440, 'height': 860}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour&lang=en'); await pg.wait_for_timeout(700)
        await pg.set_input_files('#fileIn', [os.path.join(FIX, 'va.webm'), os.path.join(FIX, 'blue.png'), os.path.join(FIX, 'va.webm')]); await pg.wait_for_timeout(1000)
        await pg.evaluate("items[0].loop=true")
        # no event screen: sound here, as always
        await pg.click('#list .item >> nth=0'); await pg.wait_for_timeout(1500); a = await pg.evaluate(S)
        ok('no event screen: the video is heard in the control window', a['pm'] is False and not a['pp'] and a['pv'] == 1, a)
        # the event screen opens while the cue plays (it is never clicked)
        async with ctx.expect_page() as np:
            await pg.evaluate("openOut()")
        out = await np.value; await pg.bring_to_front(); await pg.wait_for_timeout(2500); b1 = await pg.evaluate(S)
        ok('the event screen opens mid-cue: the sound stays in the control window, uninterrupted', b1['pm'] is False and not b1['pp'] and b1['p'] > a['p'] and b1['pr'] == 1, [a, b1])
        ok('the event screen is silent and plays the picture', b1['om'] is True and not b1['op'], b1)
        ok('nobody is asked to click the event screen for sound', not b1['warn'] and b1['sndb'] == 'none', b1)
        # in step: sampled for a few seconds across a loop point
        dur = await pg.evaluate("pvStage.media.duration"); ds = []; rates = set()
        for i in range(30):
            await pg.wait_for_timeout(250); x = await pg.evaluate(S); d = abs(x['o'] - x['p']); d = min(d, abs(dur - d)); ds.append(round(d, 3)); rates.add(x['pr'])
        late = sorted(ds[8:])
        ok('picture and sound stay in step (within 0.08 s; usually far less)', late[-1] <= .08 and late[len(late) // 2] <= .05, [late[-3:], late[len(late) // 2]])
        ok('the copy that is heard is never sped up or slowed down', rates == {1}, rates)
        # GO to another video cue, a still, and back
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(1200); c = await pg.evaluate(S)
        await pg.keyboard.press('Space'); await pg.wait_for_timeout(2600); d2 = await pg.evaluate(S)
        ok('after GO the next video is heard here and silent there, in step', d2['pm'] is False and d2['om'] is True and not d2['pp'] and not d2['op'] and abs(d2['o'] - d2['p']) <= .12, [c, d2])
        # pause / play / seek from the time line
        await pg.click('#pp'); await pg.wait_for_timeout(500); e = await pg.evaluate(S)
        ok('pause stops both', e['pp'] and e['op'], e)
        await pg.click('#pp'); await pg.wait_for_timeout(1500); f = await pg.evaluate(S)
        ok('play starts both, in step', not f['pp'] and not f['op'] and abs(f['o'] - f['p']) <= .12, f)
        await pg.evaluate("seekTo(1.0)"); await pg.wait_for_timeout(1500); g = await pg.evaluate(S)
        ok('a jump on the time line moves both', abs(g['o'] - g['p']) <= .12 and 1 < g['p'] < 4, g)
        # the picture stalls on the event screen: it catches up, the sound is not touched
        k0 = g['k']; await pg.evaluate("outStage.media.pause()"); await pg.wait_for_timeout(1500); h = await pg.evaluate(S)
        ok('a stalled picture on the event screen starts again and catches up; the sound never stopped', not h['op'] and not h['pp'] and h['k'] > k0 and abs(h['o'] - h['p']) <= .2 and h['pr'] == 1, h)
        await pg.evaluate("outStage.media.currentTime=Math.max(0,pvStage.media.currentTime-1.2)"); await pg.wait_for_timeout(1200); h2 = await pg.evaluate(S)
        ok('a picture that fell far behind jumps back into step', abs(h2['o'] - h2['p']) <= .15, h2)
        # volume and master
        await pg.evaluate("setMaster(.5)"); await pg.wait_for_timeout(300); v = await pg.evaluate(S)
        ok('MASTER changes the volume of what is heard here', abs(v['pv'] - .5) < .02, v)
        await pg.evaluate("setMaster(1)"); await pg.click('#list .item >> nth=0'); await pg.wait_for_timeout(1500); h2 = await pg.evaluate(S)
        # closing the event screen changes nothing for the sound
        await out.close(); await pg.wait_for_timeout(900); z = await pg.evaluate(S)
        ok('closing the event screen: the sound goes on here', z['pm'] is False and not z['pp'] and z['p'] != h2['p'], z)
        # blind round 24.11: opening the event screen in the middle of a cue never restarts what is heard
        await pg.evaluate("pvStage.media.__same=1")
        async with ctx.expect_page() as np:
            await pg.click('#openOut')
        out = await np.value; await pg.bring_to_front(); await pg.wait_for_timeout(2000)
        r = await pg.evaluate("({same:pvStage.media.__same===1,pp:pvStage.media.paused,pm:pvStage.media.muted,o:!!(outStage&&outStage.media&&outStage.media.tagName==='VIDEO'),om:outStage.media.muted,d:Math.abs(outStage.media.currentTime-pvStage.media.currentTime)})")
        dd = min(r['d'], abs(dur - r['d']))
        ok('opening the event screen mid-cue: the video that is heard is not restarted or replaced', r['same'] and not r['pp'] and r['pm'] is False, r)
        ok('the new event screen shows the picture, silent, in step with the sound', r['o'] and r['om'] is True and dd <= .15, [r, dd])
        # a click on the timeline knob that moves nothing must not leave the show paused
        bx = await pg.locator('#seek').bounding_box(); v = await pg.evaluate("+$('#seek').value/1000")
        await pg.mouse.move(bx['x'] + 8 + (bx['width'] - 16) * v, bx['y'] + bx['height'] / 2); await pg.mouse.down(); await pg.wait_for_timeout(120); await pg.mouse.up(); await pg.wait_for_timeout(700)
        k = await pg.evaluate(S)
        ok('a click on the timeline knob: the show goes on playing', not k['pp'] and not k['op'], k)
        # an audio cue: opening the event screen does not start the music again
        await out.close(); await pg.wait_for_timeout(700)
        await pg.set_input_files('#fileIn', [os.path.join(FIX, 'tone.wav')]); await pg.wait_for_timeout(1200)
        await pg.click('#list .item >> nth=3'); await pg.wait_for_timeout(1500); a1 = await pg.evaluate("[slideAudio.currentTime,slideAudio.paused,slideAudio.duration]")
        async with ctx.expect_page() as np:
            await pg.click('#openOut')
        out = await np.value; await pg.bring_to_front(); await pg.wait_for_timeout(800); a2 = await pg.evaluate("[slideAudio.currentTime,slideAudio.paused]")
        ok('an audio cue: opening the event screen does not start the music again', (a1[2] < 3 or a2[0] > a1[0]) and not a2[1] and not a1[1], [a1, a2])
        await out.close(); await pg.wait_for_timeout(500)
        ok('no page errors', not errs, errs[:3])
        await b.close()
    print(f"{sum(res)}/{len(res)} passed")
asyncio.run(main())
