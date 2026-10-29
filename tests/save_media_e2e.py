"""Desktop "save with media": a show made on computer A (PDF pages + a picture) opens on computer B with nothing missing.
Runs the real app twice in two fresh browser profiles; the desktop bridge is a stand-in that keeps the media folder in memory."""
import asyncio, json, os, sys, base64
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
FIX = os.environ.get('CUEY_FIXTURES') or os.path.join(ROOT, 'tests', 'fixtures')
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''))
BRIDGE = """window.__folder=window.__folder||{};window.__saved=null;
window.cueyNative={platform:'darwin',onMenu(cb){window.__menu=cb},setLang(){},setRecent(){},watchDownloads(){},onDownloaded(){},
 saveShow:async(o)=>{window.__saved=o.json;return {path:'/Users/x/Shows/My show.cuey',name:'My show.cuey'}},
 openShow:async()=>({path:'/Users/x/Shows/My show.cuey',name:'My show.cuey',text:window.__open}),
 filePath:(f)=>'',
 packMedia:async(p,files)=>{for(const f of files){window.__folder[f.name]=f.data?Array.from(new Uint8Array(f.data)):null}return {dir:p,count:files.length}},
 readMedia:async(p,n)=>{const a=window.__folder[n];return a?new Uint8Array(a):null}};"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files'])
        # computer A
        a = await b.new_context(); pa = await a.new_page(); errs = []
        pa.on('pageerror', lambda e: errs.append(str(e)))
        await pa.add_init_script(BRIDGE)
        await pa.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour'); await pa.wait_for_timeout(800)
        await pa.set_input_files('#fileIn', [os.path.join(FIX, 'red.png'), os.path.join(FIX, 'deck.pdf')]); await pa.wait_for_timeout(4000)
        names = await pa.evaluate("items.map(x=>x.name)")
        ok('computer A: picture + 3 PDF pages', len(names) == 4, names)
        ok('desktop: "Save with all media" is in the Show menu', await pa.evaluate("!$('#savePackBtn').hidden"))
        await pa.evaluate("window.__menu('save')"); await pa.wait_for_timeout(1500)
        folder = await pa.evaluate("Object.keys(window.__folder)")
        ok('plain Save puts the PDF pages in the media folder (not the user\'s own picture)', len(folder) == 3 and not any(n.startswith('red') for n in folder), folder)
        await pa.evaluate("window.__menu('savepack')"); await pa.wait_for_timeout(1500)
        folder = await pa.evaluate("Object.keys(window.__folder)")
        ok('Save with all media adds the picture too', len(folder) == 4, folder)
        show = await pa.evaluate("window.__saved"); media = await pa.evaluate("window.__folder")
        ok('computer A: no page errors', not errs, errs)
        # computer B: fresh profile, nothing in this browser's storage
        bctx = await b.new_context(); pb = await bctx.new_page(); errs2 = []
        pb.on('pageerror', lambda e: errs2.append(str(e)))
        await pb.add_init_script(BRIDGE + 'window.__open=' + json.dumps(show) + ';window.__folder=' + json.dumps(media) + ';')
        await pb.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour'); await pb.wait_for_timeout(800)
        await pb.evaluate("openShow()"); await pb.wait_for_timeout(2500)
        asked = await pb.evaluate("!$('#pickDlg').hidden")
        st = await pb.evaluate("items.map(x=>[x.name,x.bad,x.file.size>0])")
        ok('computer B: nothing to look for', not asked, st)
        ok('computer B: all 4 cues present and playable', len(st) == 4 and all(not bad and has for _, bad, has in st), st)
        await pb.evaluate("go()"); await pb.wait_for_timeout(400); await pb.evaluate("go()"); await pb.wait_for_timeout(600)
        ok('computer B: GO shows the PDF page', await pb.evaluate("cur===1&&!!pvStage.media"))
        ok('computer B: no page errors', not errs2, errs2)
        # unsaved-changes guard on Open
        await pb.evaluate("items[0].name='changed';render()")
        await pb.evaluate("(()=>{window.__op=openShow();return 1})()"); await pb.wait_for_timeout(300)
        ok('Open with unsaved changes asks first', await pb.evaluate("!!document.getElementById('unsDlg')"))
        await pb.click('#unsDlg [data-v=cancel]'); await pb.wait_for_timeout(300)
        ok('Cancel keeps the show as it was', await pb.evaluate("items[0].name==='changed'"))
        await b.close()
    print(f'\n{sum(res)}/{len(res)} passed')
asyncio.run(main())
