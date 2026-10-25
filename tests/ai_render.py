"""Render a "Build my event" plan with the real Cuey engine, for AI learning sessions.
    python3 tests/ai_render.py PLAN.json [PROGRAMME.jpg] OUT_DIR
PLAN.json = the plan the build-event function returns ({title, style, cues}).
Mocks the server and the free library; uses local Heebo/Poppins/Frank Ruhl/Playfair if FONTS_DIR (an @fontsource node_modules folder) is set.
Writes one JPEG per cue (background frame at 3 s + text layer) and sheet.jpg."""
import asyncio, base64, json, os, sys
from playwright.async_api import async_playwright
APP = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app', 'cuey.html'))
plan = json.load(open(sys.argv[1])); img = sys.argv[2] if len(sys.argv) > 3 else None; out = sys.argv[-1]; os.makedirs(out, exist_ok=True)
FD = os.environ.get('FONTS_DIR', '')
FACES = [('Heebo', 'heebo', s, w) for w in (500, 700, 800) for s in ('hebrew', 'latin')] + [('Poppins', 'poppins', 'latin', w) for w in (500, 800)] + \
        [('Frank Ruhl Libre', 'frank-ruhl-libre', s, w) for w in (500, 700) for s in ('hebrew', 'latin')] + [('Playfair Display', 'playfair-display', 'latin', 700)]
CSS = ''.join(f"@font-face{{font-family:'{f}';font-weight:{w};src:url(https://fonts.gstatic.com/x/{d}/files/{d}-{s}-{w}-normal.woff2)}}" for f, d, s, w in FACES)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1500, 'height': 950})
        async def bev(r): await r.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps({'plan': plan}))
        async def gcss(r): await r.fulfill(status=200, content_type='text/css', body=CSS if FD else '')
        async def gfile(r):
            pth = os.path.join(FD, r.request.url.split('/x/')[1])
            await (r.fulfill(status=200, content_type='font/woff2', body=open(pth, 'rb').read()) if os.path.exists(pth) else r.abort())
        await ctx.route(lambda u: u.startswith('http') and 'build-event' not in u and 'fonts.g' not in u, lambda r: r.abort())
        await ctx.route('**/functions/v1/build-event', bev); await ctx.route('https://fonts.googleapis.com/**', gcss); await ctx.route('https://fonts.gstatic.com/x/**', gfile)
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(APP); await pg.evaluate("localStorage.clear();localStorage.setItem('cuey.lang','he')"); await pg.reload(); await pg.wait_for_timeout(1200)
        await pg.evaluate("sess={user:{email:'golden@cuey'},exp:Date.now()+9e9,at:'tk'}"); await pg.evaluate("openBuild()")
        if img:
            d = base64.b64encode(open(img, 'rb').read()).decode()
            await pg.evaluate("(async(d)=>{const im=new Image();im.src='data:image/jpeg;base64,'+d;await new Promise(r=>im.onload=r);beSetImg(await beShot(im))})('" + d + "')")
        else:
            await pg.fill('#beText', 'golden-set programme ' * 3)
        await pg.evaluate("beBuild()"); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.getElementById('beLib').checked=true"); await pg.evaluate("beApply()")
        await pg.wait_for_function("document.getElementById('beDlg').hidden", timeout=60000)
        n = await pg.evaluate("items.length"); files = []
        for k in range(n):
            d = await pg.evaluate(f"""(async()=>{{const it=items[{k}],c=document.createElement('canvas');c.width=1920;c.height=1080;const x=c.getContext('2d');
              if(it.text&&it.text.bgFile){{const v=document.createElement('video');v.muted=true;v.src=URL.createObjectURL(it.text.bgFile);await new Promise(r=>v.onloadeddata=r);v.currentTime=Math.min(3,(v.duration||4)-.1);await new Promise(r=>v.onseeked=r);x.drawImage(v,0,0,1920,1080);
                const o=new Image();o.src=it.overlay;await new Promise(r=>o.onload=r);x.drawImage(o,0,0)}}
              else{{const o=new Image();o.src=it.url;await new Promise(r=>{{o.onload=r;o.onerror=r}});x.drawImage(o,0,0,1920,1080)}}
              return c.toDataURL('image/jpeg',.85)}})()""")
            f = os.path.join(out, f'{k:02d}.jpg'); open(f, 'wb').write(base64.b64decode(d.split(',')[1])); files.append(f)
        print(f'{n} cues rendered → {out}', 'errors:', errs)
        await b.close()
    try:
        from PIL import Image
        W, H, cols = 640, 360, 3; rows = (len(files) + cols - 1) // cols; sh = Image.new('RGB', (W * cols, H * max(rows, 1)), 'white')
        for i, f in enumerate(files): sh.paste(Image.open(f).resize((W, H)), ((i % cols) * W, (i // cols) * H))
        sh.save(os.path.join(out, 'sheet.jpg'))
    except Exception as e: print('no sheet:', e)
asyncio.run(main())
