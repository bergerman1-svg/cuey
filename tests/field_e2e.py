"""First feedback from real events (17.11): the sound never cuts between cues, a cue can be dragged down past its
neighbour and to the end of the list, and a music file dropped ON a cue becomes that cue's music."""
import asyncio, os
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
DRAG = """(([from,to,where])=>{const rows=[...document.querySelectorAll('#list .item')],a=rows[from],dt=new DataTransfer();
  a.dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
  let tgt,y,x;if(to==='under'){tgt=document.querySelector('#list');const r=rows[rows.length-1].getBoundingClientRect();y=r.bottom+12;x=r.left+40}
  else{tgt=rows[to];const r=tgt.getBoundingClientRect();y=where==='top'?r.top+4:r.bottom-4;x=r.left+40}
  for(const n of ['dragover','drop'])tgt.dispatchEvent(new DragEvent(n,{bubbles:true,cancelable:true,dataTransfer:dt,clientX:x,clientY:y}));
  (document.querySelector('#list .item.dragging')||a).dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:dt}));
  return items.map(i=>i.name).join()})"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        for lang in ('en', 'he'):
            L = f'[{lang}] '
            pg = await (await b.new_context(viewport={'width': 1440, 'height': 860})).new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('file://' + ROOT + f'/app/cuey.html?nosplash&notour&lang={lang}'); await pg.wait_for_timeout(700)
            await pg.set_input_files('#fileIn', [os.path.join(FIX, n) for n in ('red.png', 'green.png', 'blue.png', 'yellow.png')]); await pg.wait_for_timeout(900)
            # --- dragging cues ---
            o = await pg.evaluate(DRAG, [2, 3, 'top'])
            ok(L + 'the cue before the last one can be dragged down onto the last cue (any spot on it)', o == 'red,green,yellow,blue', o)
            o = await pg.evaluate(DRAG, [3, 2, 'bot'])
            ok(L + 'and up again onto the cue above it', o == 'red,green,blue,yellow', o)
            o = await pg.evaluate(DRAG, [1, 'under', ''])
            ok(L + 'dropping a cue in the empty space under the list moves it to the end', o == 'red,blue,yellow,green', o)
            o = await pg.evaluate(DRAG, [0, 2, 'top'])
            ok(L + 'a cue dropped on the top half of a far cue still lands before it', o == 'blue,red,yellow,green', o)
            o = await pg.evaluate(DRAG, [0, 2, 'bot'])
            ok(L + 'and on the bottom half, after it', o == 'red,yellow,blue,green', o)
            # --- sound between cues ---
            await pg.evaluate("items=[];cur=-1;render()")
            await pg.set_input_files('#fileIn', [os.path.join(FIX, n) for n in ('tone.wav', 'tone.wav', 'va.webm', 'red.png')]); await pg.wait_for_timeout(1200)
            await pg.evaluate("items[0].loop=true;items[1].loop=true;items[2].loop=true;show(0)"); await pg.wait_for_timeout(600)
            await pg.evaluate("window.__a0=slideAudio;show(1)"); await pg.wait_for_timeout(300)
            s = await pg.evaluate("({same:window.__a0===slideAudio,oldPlaying:!__a0.paused,oldVol:__a0.volume,newPlaying:!slideAudio.paused,newVol:slideAudio.volume})")
            ok(L + 'music to music: the first one is still sounding and going down while the next plays at full level', (not s['same']) and s['oldPlaying'] and 0 < s['oldVol'] < .9 and s['newPlaying'] and s['newVol'] == 1, s)
            await pg.wait_for_timeout(900)
            s = await pg.evaluate("({oldPaused:__a0.paused,oldSrc:!!__a0.getAttribute('src'),newPlaying:!slideAudio.paused,t:slideAudio.currentTime})")
            ok(L + 'then the first one is gone and only the new music plays', s['oldPaused'] and not s['oldSrc'] and s['newPlaying'] and s['t'] > .8, s)
            await pg.evaluate("window.__a1=slideAudio;show(2)"); await pg.wait_for_timeout(350)
            s = await pg.evaluate("({oldVol:__a1.volume,oldPlaying:!__a1.paused,v:pvStage.media&&pvStage.media.tagName,vv:pvStage.media&&pvStage.media.volume})")
            ok(L + 'music to a video with sound: the music fades under the video', s['oldPlaying'] and 0 < s['oldVol'] < .9 and s['v'] == 'VIDEO' and s['vv'] == 1, s)
            await pg.wait_for_timeout(900)
            await pg.evaluate("window.__v=pvStage.media;show(1)"); await pg.wait_for_timeout(350)
            s = await pg.evaluate("({conn:__v.isConnected,playing:!__v.paused,vol:__v.volume,mus:!slideAudio.paused&&slideAudio.volume===1})")
            ok(L + 'a video with sound to music: the video sound fades while the music starts', s['conn'] and s['playing'] and 0 < s['vol'] < .9 and s['mus'], s)
            await pg.wait_for_timeout(1000)
            ok(L + 'and the video is cleared when its sound is down', await pg.evaluate("!__v.isConnected"))
            await pg.evaluate("window.__a2=slideAudio;show(3)"); await pg.wait_for_timeout(300)
            s = await pg.evaluate("({oldPlaying:!__a2.paused,oldVol:__a2.volume,quiet:!slideAudio.src})")
            ok(L + 'music to a silent picture: the music fades out instead of stopping dead', s['oldPlaying'] and 0 < s['oldVol'] < .9 and s['quiet'], s)
            await pg.wait_for_timeout(900)
            await pg.evaluate("show(0)"); await pg.wait_for_timeout(400); await pg.evaluate("window.__a3=slideAudio;clearStages()"); await pg.wait_for_timeout(120)
            ok(L + 'clearing the stage still silences everything at once', await pg.evaluate("__a3.paused&&__a3===slideAudio"))
            await pg.evaluate("show(0)"); await pg.wait_for_timeout(400)
            await pg.evaluate("fadeToggle()"); await pg.wait_for_timeout(3400)
            await pg.evaluate("window.__a4=slideAudio;show(1)"); await pg.wait_for_timeout(250)
            s = await pg.evaluate("({same:__a4===slideAudio,vol:slideAudio.volume,playing:!slideAudio.paused})")
            ok(L + 'after a Fade the next cue still starts at full level', s['vol'] == 1 and s['playing'], s)
            await pg.evaluate("exporting=true;window.__a5=slideAudio;show(0)"); await pg.wait_for_timeout(200)
            ok(L + 'while exporting the sound switches exactly as before (no tail in the recording)', await pg.evaluate("__a5===slideAudio"))
            await pg.evaluate("exporting=false")
            # --- a music file dropped on a cue ---
            await pg.evaluate("show(3)"); await pg.wait_for_timeout(900)
            r = await pg.evaluate("""(async()=>{const blob=await (await fetch(items[0].url)).blob();const f=new File([blob],'walk in.wav',{type:'audio/wav'});const dt=new DataTransfer();dt.items.add(f);
              const row=document.querySelectorAll('#list .item')[3],b=row.getBoundingClientRect(),o={bubbles:true,cancelable:true,dataTransfer:dt,clientX:b.left+60,clientY:b.top+10};
              const ov=new DragEvent('dragover',o);row.dispatchEvent(ov);const hl=row.classList.contains('over-aud');row.dispatchEvent(new DragEvent('drop',o));await new Promise(r=>setTimeout(r,500));
              return {hl,n:items.length,aud:items[3].audio&&items[3].audio.name,playing:!slideAudio.paused&&!!slideAudio.src}})()""")
            ok(L + 'a music file dragged over a cue lights that cue', r['hl'], r)
            ok(L + 'dropped on the cue it becomes the music of that cue (no new cue), and plays at once on the live cue', r['n'] == 4 and r['aud'] == 'walk in' and r['playing'], r)
            r = await pg.evaluate("""(async()=>{const blob=await (await fetch(items[0].url)).blob();const f=new File([blob],'second.wav',{type:'audio/wav'});const dt=new DataTransfer();dt.items.add(f);
              const row=document.querySelectorAll('#list .item')[0],b=row.getBoundingClientRect(),o={bubbles:true,cancelable:true,dataTransfer:dt,clientX:b.left+60,clientY:b.top+10};
              row.dispatchEvent(new DragEvent('dragover',o));const hl=row.classList.contains('over-aud');row.dispatchEvent(new DragEvent('drop',o));await new Promise(r=>setTimeout(r,900));
              return {hl,n:items.length,a0:!!items[0].audio}})()""")
            ok(L + 'dropped on a music cue it is added to the list as before', (not r['hl']) and r['n'] == 5 and not r['a0'], r)
            await pg.evaluate("$('#adFm').click()"); await pg.wait_for_timeout(400)
            n0 = await pg.evaluate("items.length")
            for _try in range(3):   # a simulated mouse drag sometimes does not start on a busy machine (the browser reads it as a click); the drop itself is what is tested
                await pg.drag_and_drop('#fmList .mt[data-id="winner_1"]', '#list .item >> nth=2')
                try: await pg.wait_for_function("items[2]&&items[2].audio", timeout=5000); break
                except Exception: await pg.evaluate("try{musStop()}catch(e){}")
            await pg.wait_for_timeout(300)
            r = await pg.evaluate("({n:items.length,aud:items[2].audio&&items[2].audio.name,kept:null})")
            ok(L + 'a track dragged from Cuey Music onto a cue becomes the music of that cue', r['n'] == n0 and r['aud'] and 'Cuey' in r['aud'], r)
            # --- music for a slide show ---
            await pg.evaluate("try{$('#fmX').click()}catch(e){};items=[];cur=-1;clearStages();render()")
            await pg.set_input_files('#fileIn', [os.path.join(FIX, n) for n in ('red.png', 'green.png', 'blue.png', 'yellow.png', 'tone.wav')]); await pg.wait_for_timeout(900)
            await pg.evaluate("window.__wav=items[4].file;items.pop();render()")
            await pg.evaluate("studioOk=true;sel.clear();sel.add(items[0].id);sel.add(items[1].id);sel.add(items[2].id);render()"); await pg.wait_for_timeout(200)
            await pg.click('#ssMake'); await pg.wait_for_timeout(300)
            g = await pg.evaluate("items[0].grp")
            await pg.evaluate(f"groups['{g}'].hold=0.7;groups['{g}'].end='next';applyGrp('{g}');render()")
            r = await pg.evaluate("""(async(g)=>{const f=new File([window.__wav],'party.wav',{type:'audio/wav'});const dt=new DataTransfer();dt.items.add(f);
              const h=document.querySelector('#list .grpc'),b=h.getBoundingClientRect(),o={bubbles:true,cancelable:true,dataTransfer:dt,clientX:b.left+60,clientY:b.top+10};
              h.dispatchEvent(new DragEvent('dragover',o));const hl=h.classList.contains('over-aud');h.dispatchEvent(new DragEvent('drop',o));await new Promise(r=>setTimeout(r,400));
              return {hl,n:items.length,aud:groups[g].aud,tag:!!document.querySelector('#list .grpc .tg.gmus')}})('%s')""" % g)
            ok(L + 'a music file dropped on the slide show header becomes its music (and shows on the header)', r['hl'] and r['n'] == 4 and r['aud'] == 'party.wav' and r['tag'], r)
            await pg.evaluate("show(0)"); await pg.wait_for_timeout(500)
            t0 = await pg.evaluate("[grpAon,!grpA.paused,grpA.currentTime,grpA.volume]")
            ok(L + 'the music starts with the first slide', t0[0] == g and t0[1] and t0[2] > .2 and t0[3] == 1, t0)
            await pg.evaluate("window.__g=grpA"); await pg.wait_for_timeout(1000)
            t1 = await pg.evaluate("[cur,__g===grpA,!grpA.paused,grpA.currentTime]")
            ok(L + 'and keeps playing without a restart while the slides change', t1[0] >= 1 and t1[1] and t1[2] and t1[3] > t0[2] + .7, t1)
            await pg.evaluate("playPause(false,true)"); await pg.wait_for_timeout(150)
            ok(L + 'Freeze pauses the music too', await pg.evaluate("grpA.paused"))
            await pg.evaluate("playPause(true)"); await pg.wait_for_timeout(150)
            ok(L + 'and it goes on from the same place', await pg.evaluate("!grpA.paused"))
            await pg.evaluate("setMaster(0.5)"); await pg.wait_for_timeout(80)
            ok(L + 'the master volume reaches the slide show music', await pg.evaluate("Math.abs(grpA.volume-0.5)<0.02"), await pg.evaluate("grpA.volume")); await pg.evaluate("setMaster(1)")
            await pg.evaluate("show(3)"); await pg.wait_for_timeout(300)
            t2 = await pg.evaluate("[grpAon,!__g.paused,__g.volume]")
            ok(L + 'leaving the slide show fades its music out', t2[0] is None and t2[1] and 0 < t2[2] < .9, t2)
            await pg.wait_for_timeout(900)
            ok(L + 'and then it is silent', await pg.evaluate("__g.paused&&grpA.paused"))
            js = await pg.evaluate("JSON.stringify(showData())")
            await pg.evaluate("(j=>{items=[];groups={};loadShowFromText(j)})(%s)" % __import__('json').dumps(js)); await pg.wait_for_timeout(700)
            asked = await pg.evaluate("$('#pickDlg').hidden?'':$('#pkList').textContent")   # the test pictures have no path, so Cuey asks for those — never for the music
            await pg.evaluate("if(!$('#pickDlg').hidden)$('#pkSkip').click()"); await pg.wait_for_timeout(700)
            back = await pg.evaluate("(()=>{const g=items[0].grp;return [items.length,!!(g&&grpAud[g]&&grpAud[g].file.size>1000)]})()")
            ok(L + 'a saved show opens with the slide show music, without asking for the file', back == [4, True] and 'party' not in asked, [back, asked])
            await pg.evaluate("openGrpEdit(items[0].grp)"); await pg.wait_for_timeout(200)
            ok(L + 'slide show settings show the track with a volume and a remove button', await pg.evaluate("!!$('#gAvol')&&!!$('#gNoAud')"))
            await pg.evaluate("$('#gAvol').value=40;$('#gAvol').oninput();show(0)"); await pg.wait_for_timeout(400)
            ok(L + 'its volume is set there', await pg.evaluate("Math.abs(grpA.volume-0.4)<0.02&&!grpA.paused"), await pg.evaluate("grpA.volume"))
            await pg.click('#gNoAud'); await pg.wait_for_timeout(1000)
            ok(L + 'removing the music stops it and offers Add music again', await pg.evaluate("grpA.paused&&grpAon===null&&!!$('#gAud')&&!groups[items[0].grp].aud"))
            await pg.evaluate("$('#edX').click()")
            ok(L + 'no page errors', not errs, errs[:2])
            await pg.close()
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed'); raise SystemExit(0 if all(res) else 1)
asyncio.run(main())
