"""Share screen: what happens when a signalling WebSocket drops and reconnects (ntfy replays history with ?since=)."""
import asyncio, json, os, re, time
from playwright.async_api import async_playwright
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
HERE = FIX
APP = 'file://' + ROOT + '/app/cuey.html?nosplash&notour'
SCREEN = 'file://' + ROOT + '/docs/s/index.html'
subs, hist = {}, {}
PX = "(()=>{const v=document.getElementById('rtc');if(!v||!v.videoWidth)return null;const c=document.createElement('canvas');c.width=64;c.height=36;const g=c.getContext('2d');g.drawImage(v,0,0,64,36);return Array.from(g.getImageData(32,18,1,1).data)})()"
async def main(which):
    subs.clear(); hist.clear()
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context()
        await ctx.add_init_script("(()=>{const W=window.WebSocket;window.__ws=[];window.WebSocket=function(u,p){const w=new W(u,p);window.__ws.push(w);return w};window.WebSocket.prototype=W.prototype;const R=window.RTCPeerConnection;window.__pcn=0;window.RTCPeerConnection=function(c){window.__pcn++;return new R(c)};window.RTCPeerConnection.prototype=R.prototype;Object.assign(window.WebSocket,{OPEN:1,CLOSED:3,CONNECTING:0,CLOSING:2})})()")
        async def on_post(route):
            req = route.request; topic = re.search(r'ntfy\.sh/([^/?]+)', req.url).group(1); body = req.post_data or ''
            msg = json.dumps({'event': 'message', 'topic': topic, 'message': body, 'time': time.time()})
            hist.setdefault(topic, []).append(msg)
            for ws in list(subs.get(topic, [])):
                try: ws.send(msg)
                except Exception: pass
            await route.fulfill(status=200, body='{}', headers={'access-control-allow-origin': '*'})
        await ctx.route(re.compile(r'https://ntfy\.sh/.*'), on_post)
        def on_ws(ws):
            topic = re.search(r'ntfy\.sh/([^/]+)/ws', ws.url).group(1)
            subs.setdefault(topic, []).append(ws)
            ws.send(json.dumps({'event': 'open', 'topic': topic}))
            for m in hist.get(topic, []): ws.send(m)          # ?since=10m / 6h: ntfy replays the cached messages
            ws.on_close(lambda *a: subs.get(topic, []).remove(ws) if ws in subs.get(topic, []) else None)
            ws.tag = 'app' if 'since=10m' in ws.url else 'screen'
        await ctx.route_web_socket(re.compile(r'wss://ntfy\.sh/.*'), on_ws)
        app = await ctx.new_page(); await app.goto(APP); await app.wait_for_timeout(800)
        await app.set_input_files('#fileIn', [os.path.join(HERE, n) for n in ('red.png', 'green.png', 'blue.png')]); await app.wait_for_timeout(900)
        await app.evaluate("sess={email:'t@e.com',id:'x'};licensed=true;startShare()"); await app.wait_for_timeout(500)
        code = await app.evaluate("shCode")
        scr = await ctx.new_page(); await scr.goto(SCREEN + '?c=' + code)
        for _ in range(40):
            await scr.wait_for_timeout(250)
            if await scr.evaluate("rtcOn&&document.getElementById('rtc').videoWidth>0"): break
        await app.evaluate("go()"); await app.wait_for_timeout(1500)
        print(which, 'before drop: screen pixel', await scr.evaluate(PX), 'host connected', await app.evaluate("Object.values(shPCs).filter(p=>p.connectionState==='connected').length"))
        topic = 'cuey-v1-' + code
        for ws in list(subs[topic]):
            if ws.tag == which: subs[topic].remove(ws)
        await (app.evaluate("shConnect()") if which=='app' else scr.evaluate("connect()"))
        t0 = time.time(); states = []
        for k in range(140):
            await app.wait_for_timeout(500)
            s = await scr.evaluate("pc?pc.connectionState:'none'"); h = await app.evaluate("Object.values(shPCs).map(p=>p.connectionState+'/'+p.signalingState).join(',')")
            states.append(f'{k*0.5:.1f}s scr={s} host=[{h}]')
        print('\n'.join(states[::10]))
        print('ws objects app', await app.evaluate("window.__ws.map(w=>w.readyState+':'+w.url.slice(-12))"), 'screen', await scr.evaluate("window.__ws.map(w=>w.readyState+':'+w.url.slice(-12))"))
        print('history', [json.loads(json.loads(m)['message']).get('t') for m in hist[topic]])
        print('host PCs created total', await app.evaluate("window.__pcn||0"), 'screen pcs', await scr.evaluate("window.__pcn||0"))
        await app.evaluate("go()"); await app.wait_for_timeout(2500)
        first_ok = next((st for st in states[1:] if 'scr=connected' in st), None); print('first connected sample after drop:', first_ok)
        print(which, 'after reconnect + GO (want green): screen pixel', await scr.evaluate(PX), 'rtcOn', await scr.evaluate('rtcOn'))
        await b.close()
import sys
asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else 'app'))
