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
        # the full AI flow with a mocked server: plan -> build -> review (gets real frames) -> the reviewed scene is used
        calls = []
        async def fake(route):
            b = json.loads(route.request.post_data or '{}'); calls.append(b)
            if b.get('step') == 'plan': body = {'plan': {'captions': ['🎬 one', '✨ two'], 'fields': SC[0]['fields'], 'shots': [{}, {}]}}
            elif b.get('step') == 'build': body = {'scene': SC[0]}
            else:
                s2 = dict(SC[0]); s2['title'] = 'REVIEWED'; body = {'scene': s2}
            await route.fulfill(status=200, body=json.dumps(body), headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'})
        await pg.route('**/functions/v1/build-scene', fake)
        await pg.evaluate("window.token=async()=>'test';openDirector();$('#dirPrompt').value='A test slide with a story';$('#dirGo').click()")
        await pg.wait_for_function("__dirTest.cur()==='REVIEWED'&&$('#dirBusy').hidden", timeout=150000)
        await pg.wait_for_timeout(1500)
        steps = [c.get('step') for c in calls]
        rv = [c for c in calls if c.get('step') == 'review']
        ok('AI flow: plan → build → review', steps == ['plan', 'build', 'review'], steps)
        ok('review gets rendered frames of the draft', rv and len(rv[0].get('frames', [])) >= 5 and len(rv[0]['frames'][0]['data']) > 2000, rv and len(rv[0].get('frames', [])))
        ok('the reviewed scene is the one shown', await pg.evaluate("$('#dirS2').hidden===false&&$('#dirBusy').hidden"))
        ok('no page errors', not errs, errs)
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
