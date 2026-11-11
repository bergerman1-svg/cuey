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
        cdon = await pg.evaluate("""new Promise(r=>{const m=pvStage.media;m.currentTime=Math.max(0,m.duration-3);let on=false;const iv=setInterval(()=>{if($('#cd').classList.contains('on')||$('#rem').classList.contains('hot'))on=true},50);setTimeout(()=>{clearInterval(iv);r(on)},1500)})""")
        ok('an AI slide shows no "to end" countdown (it never ends)', not cdon)
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
        calls = []; revs = []; crits = []; FOOT = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'footage.webm'), 'rb').read()
        async def fake(route):
            b = json.loads(route.request.post_data or '{}'); calls.append(b.get('step')); revs.append(b) if b.get('step') == 'revise' else None
            if b.get('step') == 'polish':
                crits.append(b)
                await route.fulfill(status=200, body=json.dumps({'score': 6, 'issues': ['too many effects'], 'notes': ['less dust'], 'direct': {**b['direct'], 'look': {**b['direct']['look'], 'fx': 'none'}}}), headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}); return
            body = {'direct': {'engine': 'compose', 'mood': 'corporate', 'look': {'layout': 'auto', 'font': 'heebo', 'reveal': 'rise', 'energy': .5, 'light': 'halo', 'fx': 'dust', 'rule': True, 'camera': 'push', 'dark': .45, 'blur': 1.5}, 'footage': ['sunset clouds'], 'title': 'Test', 'captions': ['🎬 one', '✨ two'],
                    'fields': [{'k': 'kicker', 'label': 'Kicker', 'type': 'text', 'value': 'NORTHWIND'}, {'k': 'title', 'label': 'Title', 'type': 'text', 'value': 'FIXED' if b.get('step') == 'revise' else 'WELCOME'},
                               {'k': 'sub', 'label': 'Sub', 'type': 'text', 'value': 'TEL AVIV 2026'}, {'k': 'accent', 'label': 'Accent', 'type': 'color', 'value': '#ffcf6b'}, {'k': 'accent2', 'label': 'Accent 2', 'type': 'color', 'value': '#7cf5ff'}]}}
            if b.get('step') == 'revise':
                if 'second logo' in b.get('ask', ''): body = {'direct': b['prev'], 'done': False, 'note': 'CANNOT: one logo per slide'}
                else: body['done'] = True; body['note'] = 'title changed'
            if 'programme' in b.get('prompt', ''): body['direct']['upload'] = 'program'
            if 'our hall photo' in b.get('prompt', ''): body['direct']['upload'] = 'background'
            await route.fulfill(status=200, body=json.dumps(body), headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'})
        async def pbx(route):
            await route.fulfill(status=200, body=json.dumps({'total': 1, 'hits': [{'id': 7, 'full': 'https://cdn.pixabay.com/test/footage.webm', 'w': 640, 'h': 360, 'dur': 20}]}), headers={'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'})
        async def cdn(route):
            await route.fulfill(status=200, body=FOOT, headers={'Content-Type': 'video/webm', 'Access-Control-Allow-Origin': '*'})
        await pg.route('**/functions/v1/ai-director', fake); await pg.route('**/functions/v1/pixabay**', pbx); await pg.route('https://cdn.pixabay.com/**', cdn)
        n0 = await pg.evaluate("items.length")
        await pg.evaluate("window.token=async()=>'test';openDirector();$('#dirPrompt').value='Opening slide for our employees evening';$('#dirGo').click()")
        ok3 = True
        try: await pg.wait_for_function("!$('#dirS2').hidden&&!$('#dirAdd').disabled&&$('#dirBusy').hidden", timeout=240000)
        except Exception: ok3 = False
        ok('finishing pass: 3 frames of the slide go to a second look, and its fix is applied before the user decides', len(crits) == 1 and len(crits[0].get('frames') or []) == 3 and all(len(f) > 2000 for f in crits[0]['frames']) and calls == ['direct', 'polish'] and 'less dust' not in await pg.evaluate("$('#dirDlg').innerText") and await pg.evaluate("__dirTest.look().fx") == 'none', [calls, len(crits)])
        ok('AI Builder: the director picks an engine and it runs (one call)', ok3 and calls[:1] == ['direct'], [calls, await pg.evaluate("$('#dirErr').textContent+' | '+$('#dirErr2').textContent")])
        ok('the director\'s words fill the fields', await pg.evaluate("$('#dirF_title').value==='WELCOME'&&$('#dirF_kicker').value==='NORTHWIND'"))
        # fix by prompt: the director gets the slide as it is now (with the user's text) + the change; ↶ goes back
        await pg.evaluate("$('#dirF_kicker').value='MY TEXT';$('#dirF_kicker').dispatchEvent(new Event('input'))")
        await pg.fill('#dirFix', 'make the background blue'); await pg.click('#dirFixGo')
        okf = True
        try: await pg.wait_for_function("$('#dirF_title').value==='FIXED'&&!$('#dirAdd').disabled&&!$('#dirUndo').hidden", timeout=180000)
        except Exception: okf = False
        ok('fix by prompt: one revise call with the change and the user\'s current texts', okf and len(revs) == 1 and revs[0].get('ask') == 'make the background blue' and any(f['k'] == 'kicker' and f['value'] == 'MY TEXT' for f in revs[0]['prev']['fields']), [okf, len(revs), await pg.evaluate("$('#dirFixErr').textContent")])
        ok('fix by prompt: says in one line what was changed', await pg.evaluate("$('#dirFixNote').textContent.includes('title changed')"), await pg.evaluate("$('#dirFixNote').textContent"))
        ok('fix by prompt: shows fixes left', await pg.evaluate("$('#dirFixN').textContent.includes('2')"), await pg.evaluate("$('#dirFixN').textContent"))
        await pg.click('#dirUndo')
        oku = True
        try: await pg.wait_for_function("$('#dirF_title').value==='WELCOME'&&$('#dirUndo').hidden", timeout=60000)
        except Exception: oku = False
        ok('fix by prompt: ↶ brings the previous version back', oku, await pg.evaluate("JSON.stringify({t:$('#dirF_title').value,u:$('#dirUndo').hidden,err:$('#dirErr2').textContent,fe:$('#dirFixErr').textContent})"))
        await pg.wait_for_function("!$('#dirAdd').disabled", timeout=180000)
        await pg.click('#dirAdd'); await pg.wait_for_function("$('#dirDlg').hidden", timeout=240000)
        eng = await pg.evaluate("(()=>{const x=items[items.length-1];return {n:items.length,t:x.type,sz:x.file.size,eng:x.scene&&x.scene.src.engine,ff:!!(x.scene&&x.scene.footFile),nm:x.name}})()")
        ok('Add records the engine slide over the footage into a video cue', eng['n'] == n0 + 1 and eng['t'] == 'video' and eng['eng'] == 'compose' and eng['ff'] and eng['sz'] > 50000, eng)
        ok('it is named after the title', eng['nm'] == 'WELCOME', eng)
        # an SVG logo (common download format) must not stop the slide: the engine gets a PNG
        await pg.evaluate("""(()=>{const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80"><rect width="200" height="80" rx="16" fill="#1e40af"/><text x="100" y="52" font-size="36" text-anchor="middle" fill="#fff">LOGO</text></svg>';
          const f=new File([svg],'logo.svg',{type:'image/svg+xml'});const dt=new DataTransfer();dt.items.add(f);const i=$('#dirLogo');openDirector();i.files=dt.files;i.dispatchEvent(new Event('change'));$('#dirPrompt').value='Opening slide with our logo';$('#dirGo').click()})()""")
        ok4 = True
        try: await pg.wait_for_function("!$('#dirS2').hidden&&!$('#dirAdd').disabled&&$('#dirBusy').hidden", timeout=240000)
        except Exception: ok4 = False
        ok('an SVG logo: the slide still runs (no decode error)', ok4 and not await pg.evaluate("$('#dirErr2').textContent"), await pg.evaluate("$('#dirErr').textContent+' | '+$('#dirErr2').textContent"))
        # a change that can't be made: said plainly, nothing changes, the fix isn't used up
        ok('a logo upload is placed as the logo', await pg.evaluate("__dirTest.logo()"))
        await pg.fill('#dirFix', 'add a second logo'); await pg.click('#dirFixGo')
        okn = True
        try: await pg.wait_for_function("$('#dirFixErr').textContent.includes('CANNOT')&&$('#dirBusy').hidden", timeout=60000)
        except Exception: okn = False
        ok("fix by prompt: a change Cuey can't make is said plainly and costs nothing", okn and await pg.evaluate("$('#dirFixN').textContent.includes('3')&&$('#dirUndo').hidden&&$('#dirF_title').value==='WELCOME'"), await pg.evaluate("$('#dirFixN').textContent+' | '+$('#dirFixErr').textContent"))
        # what was uploaded? a programme is read, never placed as a logo; a photo becomes the background
        async def again(prompt):
            await pg.evaluate("p=>{$('#dirBack').click();$('#dirPrompt').value=p;$('#dirGo').click()}", prompt)
            await pg.wait_for_function("$('#dirS1').hidden===false||true"); await pg.wait_for_timeout(600)
            try: await pg.wait_for_function("!$('#dirS2').hidden&&!$('#dirAdd').disabled&&$('#dirBusy').hidden", timeout=240000); return True
            except Exception: return False
        okp = await again('A slide from our programme')
        ok('an uploaded programme is not placed as a logo', okp and not await pg.evaluate("__dirTest.logo()"), await pg.evaluate("$('#dirErr').textContent+' | '+$('#dirErr2').textContent"))
        okb = await again('Welcome slide over our hall photo')
        ft = await pg.evaluate("__dirTest.foot()")
        ok('an uploaded photo becomes the slide background (no stock footage)', okb and ft and ft.get('id') == 'upload' and not await pg.evaluate("__dirTest.logo()"), ft)
        # rating the slide: 5 stars go straight to public.ratings with the prompt and the director's look
        rated = []
        async def rt(route):
            rated.append(json.loads(route.request.post_data or '{}')); await route.fulfill(status=201, body='', headers={'Access-Control-Allow-Origin': '*'})
        await pg.route('**/rest/v1/ratings', rt)
        await pg.evaluate("$('#dirStars').querySelector('[data-n=\"5\"]').click()"); await pg.wait_for_timeout(800)
        ok('rate the slide: 5 stars are sent with the prompt and look', len(rated) == 1 and rated[0].get('kind') == 'slide' and rated[0].get('stars') == 5 and 'hall photo' in (rated[0].get('prompt') or '') and rated[0]['meta'].get('engine') == 'compose', rated)
        # rating Cuey: after shows on 3 days, 2 stars ask what to improve and send it
        await pg.evaluate("localStorage.setItem('cuey.rate.days',JSON.stringify(['2026-01-01','2026-01-02','2026-01-03']));appRateMaybe()")
        await pg.click('#appRate .stars [data-n="2"]'); await pg.fill('#appRate textarea', 'more fonts'); await pg.click('#appRate .pri'); await pg.wait_for_timeout(800)
        ok('rate Cuey: low stars ask what to improve, then send once', len(rated) == 2 and rated[1].get('kind') == 'app' and rated[1].get('stars') == 2 and rated[1].get('note') == 'more fonts', rated[1:] )
        ok('rate Cuey is asked at most once after an answer', await pg.evaluate("(()=>{document.getElementById('appRate')?.remove();appRateMaybe();return !document.getElementById('appRate')})()"))
        await pg.evaluate("$('#dirDlg').hidden=true")
        ok('the slide language follows the prompt (names in English keep a Hebrew prompt Hebrew)', await pg.evaluate("promptLang('Opening slide for a biotech summit')==='en'&&promptLang('שקופית פתיחה לכנס של Google בתל אביב')==='he'&&promptLang('שקופית לכנס בינלאומי באנגלית')==='en'"))
        ok('an AI slide in Edit: no timer, end or trim choices', await pg.evaluate("(()=>{const x=items.find(i=>i.scene);openEdit(x);const b=$('#edBox');const r=!b.querySelector('[data-f=hold]')&&!b.querySelector('[data-f=onEndV]')&&!b.querySelector('[data-f=in]')&&!!b.querySelector('[data-f=standby]');$('#edX').click();return r})()"))
        ok('no page errors', not errs, errs)
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
