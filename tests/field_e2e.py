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
            await pg.drag_and_drop('#fmList .mt[data-id="winner_1"]', '#list .item >> nth=2'); await pg.wait_for_timeout(1200)
            r = await pg.evaluate("({n:items.length,aud:items[2].audio&&items[2].audio.name,kept:null})")
            ok(L + 'a track dragged from Cuey Music onto a cue becomes the music of that cue', r['n'] == n0 and r['aud'] and 'Cuey' in r['aud'], r)
            ok(L + 'no page errors', not errs, errs[:2])
            await pg.close()
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed'); raise SystemExit(0 if all(res) else 1)
asyncio.run(main())
