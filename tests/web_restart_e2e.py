"""A YouTube cue always starts from its start (or its IN point) — Avi, 2.11.2026, on the Mac:
"leave a YouTube cue and come back to it: it carries on from where you left it, not from the start".
YouTube's own player resumes a video from where it was last watched; Cuey now tells it where to start on every GO.
Uses a stand-in YouTube player (no network) that behaves like the real one, resume included."""
import asyncio, os, json
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''), flush=True)

FAKE = """<!doctype html><body style="margin:0;background:#222"><script>
const P=new URLSearchParams(location.search);let t=+(P.get('start')||0),st=-1,pw=null;
if(!t){t=+(localStorage.getItem('pos')||0)} // like YouTube: no start given → resume where it was last watched
const send=o=>{if(pw)pw.postMessage(JSON.stringify(o),'*')};
addEventListener('message',e=>{let d;try{d=JSON.parse(e.data)}catch(x){return}pw=e.source;
  if(d.event==='listening'){send({event:'onReady'});send({event:'infoDelivery',info:{duration:120,currentTime:t,playerState:-1}})}
  if(d.event==='command'){if(d.func==='seekTo')t=d.args[0];if(d.func==='playVideo'){st=1;send({event:'onStateChange',info:1})}if(d.func==='pauseVideo'){st=2;send({event:'onStateChange',info:2})}}});
setInterval(()=>{if(st===1){t+=0.25;localStorage.setItem('pos',t)}send({event:'infoDelivery',info:{currentTime:t,playerState:st}})},250);
</script></body>"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        async def route(r):
            u = r.request.url
            if 'youtube-nocookie.com/embed/' in u: await r.fulfill(status=200, body=FAKE, headers={'content-type': 'text/html'})
            elif 'oembed' in u: await r.fulfill(status=200, body=json.dumps({'title': 'Test video', 'thumbnail_url': ''}), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
            else: await r.abort()
        await ctx.route(lambda u: u.startswith('http'), route)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour&lang=he'); await pg.wait_for_timeout(600)
        await pg.set_input_files('#fileIn', [os.path.join(FIX, 'red.png')]); await pg.wait_for_timeout(600)
        await pg.evaluate("(()=>{const dt=new DataTransfer();dt.setData('text/plain','https://www.youtube.com/watch?v=aqz-KE-bpKQ');document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true}))})()")
        await pg.wait_for_timeout(1200)
        yi = await pg.evaluate("items.findIndex(i=>i.web)")
        ok('a YouTube cue is in the list', yi >= 0, await pg.evaluate("items.map(i=>i.name)"))
        pos = lambda: pg.evaluate("(()=>{const m=pvStage.media;return m?+m.currentTime.toFixed(2):-1})()")
        await pg.evaluate(f"show({yi})"); await pg.wait_for_timeout(3500)
        p1 = await pos()
        ok('it plays (first time)', p1 > 1.5, p1)
        await pg.evaluate("show(items.findIndex(i=>!i.web))"); await pg.wait_for_timeout(1200)
        await pg.evaluate(f"show({yi})"); await pg.wait_for_timeout(1500)
        p2 = await pos()
        ok('back to it: it starts again from the start, not from where it was left', 0 <= p2 < 1.5, {'left_at': p1, 'now': p2})
        # with an IN point it starts there
        await pg.evaluate(f"items[{yi}].in=10"); await pg.evaluate("show(items.findIndex(i=>!i.web))"); await pg.wait_for_timeout(800)
        await pg.evaluate(f"show({yi})"); await pg.wait_for_timeout(1500)
        p3 = await pos()
        ok('with an IN point: it starts at the IN point', 9.5 <= p3 < 11.5, p3)
        ok('no page errors', not errs, errs[:3])
        print(f'\n{sum(res)}/{len(res)} passed', flush=True)
        await b.close()
asyncio.run(main())
