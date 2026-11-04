"""AI Builder (one breathtaking slide): examples open in a sandboxed preview, text fields update it,
'Add' records a looping video cue, the cue loops back to the end of its intro, duplicate + edit makes a second slide,
the scene survives Save/Open, and the scene code cannot reach Cuey."""
import asyncio, os, json
SC = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "scenes.json")))
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(viewport={'width': 1400, 'height': 900}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await ctx.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', headers={'Content-Type': 'text/css'}))
        await pg.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour'); await pg.wait_for_timeout(800)
        await pg.evaluate("window.__sceneFps=2")
        await pg.evaluate("$('#adBe').click()"); await pg.wait_for_timeout(400)
        ok('the AI Builder tile opens the slide builder', await pg.evaluate("!$('#dirDlg').hidden"))
        ok('it opens on the magic: stars + "Let the magic happen", no examples', await pg.evaluate("!$('#dirMagic').hidden&&$('#dirGo').textContent.includes('magic')&&!document.getElementById('dirSmp')"))
        # example 1 (2D)
        await pg.evaluate("__dirTest.use(%s)" % json.dumps(SC[0])); await pg.wait_for_function("!$('#dirAdd').disabled", timeout=20000)
        ok('a scene runs in the preview (magic hidden)', await pg.evaluate("!$('#dirS2').hidden&&!$('#dirAdd').disabled&&$('#dirMagic').hidden"))
        ok('the preview is sandboxed (scripts only, no same-origin)', await pg.evaluate("$('#dirFrame').getAttribute('sandbox')==='allow-scripts'"))
        # the scene cannot reach the app
        leak = await pg.evaluate("""new Promise(r=>{const f=document.createElement('iframe');f.sandbox='allow-scripts';document.body.appendChild(f);
          addEventListener('message',e=>{if(e.source===f.contentWindow)r(e.data)},{once:false});
          f.srcdoc='<script>let a=[];try{a.push(!!parent.cueyNative||!!parent.items)}catch(e){a.push("blocked")}try{localStorage.x=1;a.push("ls")}catch(e){a.push("nols")}parent.postMessage(a,"*")<\\/script>'})""")
        ok('a sandboxed scene cannot read Cuey or its storage', leak == ['blocked', 'nols'], leak)
        # change the title -> preview reloads
        await pg.fill('#dirF_title', 'ACME 2027'); await pg.wait_for_timeout(600); await pg.wait_for_function("!$('#dirAdd').disabled", timeout=20000)
        ok('changing a field keeps the preview running', await pg.evaluate("!$('#dirAdd').disabled"))
        await pg.click('#dirAdd'); await pg.wait_for_function("$('#dirDlg').hidden", timeout=180000)
        it = await pg.evaluate("(()=>{const x=items[items.length-1];return x?{t:x.type,n:x.name,sz:x.file.size,sc:!!x.scene,ttl:x.scene&&x.scene.fields.title,intro:x.scene&&x.scene.intro}:null})()")
        ok('Add records a video cue with the scene', it and it['t'] == 'video' and it['sc'] and it['sz'] > 50000, it)
        ok('the cue is named after the title', it and it['n'] == 'ACME 2027', it)
        # GO plays it; at the end it jumps back to the end of the intro
        await pg.evaluate("go()"); await pg.wait_for_timeout(1500)
        v = await pg.evaluate("(()=>{const m=pvStage.media;return m?{tag:m.tagName,loop:m.loop,paused:m.paused}:null})()")
        ok('GO plays the slide', v and v['tag'] == 'VIDEO' and not v['paused'], v)
        jump = await pg.evaluate("""new Promise(r=>{const m=pvStage.media;m.currentTime=Math.max(0,m.duration-0.4);setTimeout(()=>r([m.currentTime,m.duration]),1600)})""")
        ok('at the end it loops back into the loop part (not to 0)', jump and jump[0] > 4.5 and jump[0] < jump[1]-0.2, jump)
        # duplicate + edit = a second slide with another title
        await pg.evaluate("(()=>{const i=items.length-1;items.splice(i+1,0,cloneCue(items[i]));render()})()")
        await pg.evaluate("editText(items[items.length-1])"); await pg.wait_for_function("!$('#dirAdd').disabled", timeout=20000)
        ok('editing a slide opens it with its own texts', await pg.evaluate("$('#dirF_title').value==='ACME 2027'"))
        await pg.fill('#dirF_title', 'SECOND'); await pg.wait_for_timeout(500); await pg.wait_for_function("!$('#dirAdd').disabled", timeout=20000)
        await pg.click('#dirAdd'); await pg.wait_for_function("$('#dirDlg').hidden", timeout=180000)
        two = await pg.evaluate("items.slice(-2).map(x=>[x.name,x.scene.fields.title,x.file.name])")
        ok('the copy changed, the original did not', two[0][1] == 'ACME 2027' and two[1][1] == 'SECOND' and two[0][2] != two[1][2], two)
        # 3D example
        await pg.evaluate("openDirector()"); await pg.evaluate("__dirTest.use(%s)" % json.dumps(SC[3]))
        ok3 = True
        try: await pg.wait_for_function("!$('#dirAdd').disabled", timeout=180000)
        except Exception: ok3 = False
        ok('a 3D scene runs (three.js inside the sandbox)', ok3, await pg.evaluate("$('#dirErr2').textContent"))
        await pg.evaluate("$('#dirDlg').hidden=true")
        # save keeps the scene
        data = await pg.evaluate("JSON.stringify(showData())"); d = json.loads(data)
        sc = [c for c in d['cues'] if c.get('scene')]
        ok('Save keeps each slide\'s scene and texts', len(sc) == 2 and sc[1]['scene']['fields']['title'] == 'SECOND' and 'code' in sc[1]['scene']['src'], len(sc))
        # AI Builder v3 with a mocked server: the director picks an engine + footage; the engine plays over the real footage
        calls = []; FOOT = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'footage.webm'), 'rb').read()
        async def fake(route):
            b = json.loads(route.request.post_data or '{}'); calls.append(b.get('step'))
            body = {'direct': {'engine': 'compose', 'mood': 'corporate', 'look': {'layout': 'auto', 'font': 'heebo', 'reveal': 'rise', 'energy': .5, 'light': 'halo', 'fx': 'dust', 'rule': True, 'camera': 'push', 'dark': .45, 'blur': 1.5}, 'footage': ['sunset clouds'], 'title': 'Test', 'captions': ['🎬 one', '✨ two'],
                    'fields': [{'k': 'kicker', 'label': 'Kicker', 'type': 'text', 'value': 'NORTHWIND'}, {'k': 'title', 'label': 'Title', 'type': 'text', 'value': 'WELCOME'},
                               {'k': 'sub', 'label': 'Sub', 'type': 'text', 'value': 'TEL AVIV 2026'}, {'k': 'accent', 'label': 'Accent', 'type': 'color', 'value': '#ffcf6b'}, {'k': 'accent2', 'label': 'Accent 2', 'type': 'color', 'value': '#7cf5ff'}]}}
            await route.fulfill(status=200, body=json.dumps(body), headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'})
        async def pbx(route):
            await route.fulfill(status=200, body=json.dumps({'total': 1, 'hits': [{'id': 7, 'full': 'https://cdn.pixabay.com/test/footage.webm', 'w': 640, 'h': 360, 'dur': 20}]}), headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'})
        async def cdn(route):
            await route.fulfill(status=200, body=FOOT, headers={'Content-Type': 'video/webm', 'Access-Control-Allow-Origin': '*'})
        await pg.route('**/functions/v1/ai-director', fake); await pg.route('**/functions/v1/pixabay**', pbx); await pg.route('https://cdn.pixabay.com/**', cdn)
        n0 = await pg.evaluate("items.length")
        await pg.evaluate("window.token=async()=>'test';openDirector();$('#dirPrompt').value='Opening slide for our employees evening';$('#dirGo').click()")
        ok3 = True
        try: await pg.wait_for_function("!$('#dirS2').hidden&&!$('#dirAdd').disabled", timeout=180000)
        except Exception: ok3 = False
        ok('AI Builder: the director picks an engine and it runs (one call)', ok3 and calls == ['direct'], [calls, await pg.evaluate("$('#dirErr').textContent+' | '+$('#dirErr2').textContent")])
        ok('the director\'s words fill the fields', await pg.evaluate("$('#dirF_title').value==='WELCOME'&&$('#dirF_kicker').value==='NORTHWIND'"))
        await pg.click('#dirAdd'); await pg.wait_for_function("$('#dirDlg').hidden", timeout=240000)
        eng = await pg.evaluate("(()=>{const x=items[items.length-1];return {n:items.length,t:x.type,sz:x.file.size,eng:x.scene&&x.scene.src.engine,ff:!!(x.scene&&x.scene.footFile),nm:x.name}})()")
        ok('Add records the engine slide over the footage into a video cue', eng['n'] == n0 + 1 and eng['t'] == 'video' and eng['eng'] == 'compose' and eng['ff'] and eng['sz'] > 50000, eng)
        ok('it is named after the title', eng['nm'] == 'WELCOME', eng)
        ok('no page errors', not errs, errs)
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
