"""PowerPoint titles stay on their line when Keynote / LibreOffice convert them (Avi, 31.10.2026, a Hebrew deck:
"תודה על" wrapped and "על" landed on "ההקשבה"). pptxFit measures one-line auto-fit boxes and shrinks the letters
just enough; nothing else changes; the file stays a valid .pptx. Uses a made-up deck built here (no client files)."""
import asyncio, base64, io, os, zipfile
from playwright.async_api import async_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
res = []
def ok(n, c, extra=''):
    res.append(bool(c)); print(('PASS ' if c else 'FAIL ') + n + (('  -> ' + str(extra)[:300]) if extra and not c else ''), flush=True)

def box(text, x, y, cx, cy, sz, algn='r', rtl=True, auto=True, paras=1, rot='', lnspc=None):
    p = ''.join(f'<a:p><a:pPr algn="{algn}"{" rtl=\"1\"" if rtl else ""}>{f"<a:lnSpc><a:spcPts val=\"{lnspc}\"/></a:lnSpc>" if lnspc else ""}</a:pPr><a:r><a:rPr lang="he-IL" sz="{sz}" b="1"><a:latin typeface="NoSuchFont"/></a:rPr><a:t>{text}</a:t></a:r></a:p>' for _ in range(paras))
    return (f'<p:sp><p:nvSpPr><p:cNvPr id="2" name="T"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm{rot}><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0">{"<a:spAutoFit/>" if auto else ""}</a:bodyPr><a:lstStyle/>{p}</p:txBody></p:sp>')
def slide(*shapes):
    return ('<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            '<p:cSld><p:spTree>' + ''.join(shapes) + '</p:spTree></p:cSld></p:sld>')
# 137 pt Hebrew title in a box far too narrow for it, on one line (height = one line): must shrink
TIGHT = box('תודה על ההקשבה', 3000000, 2700000, 2500000, 1654299, 13735, lnspc=12911)
ROOMY = box('Hi', 1000000, 100000, 6000000, 300000, 1800, algn='l', rtl=False)          # fits easily: letters unchanged
MULTI = box('שורה', 0, 0, 1000000, 300000, 4000, paras=2)                              # two paragraphs: not touched
ROT = box('ארוך מאוד מאוד מאוד', 0, 0, 500000, 400000, 4000, rot=' rot="5400000"')   # turned box: not touched
FIXED = box('ארוך מאוד מאוד מאוד', 0, 0, 500000, 400000, 4000, auto=False)           # not auto-fit: not touched

def make_pptx():
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<Types/>')
        z.writestr('ppt/presentation.xml', '<p:presentation/>')
        z.writestr('ppt/slides/slide1.xml', slide(TIGHT, ROOMY))
        z.writestr('ppt/slides/slide2.xml', slide(MULTI, ROT, FIXED))
        z.writestr('ppt/media/image1.png', b'\x89PNG' + os.urandom(2000), compress_type=zipfile.ZIP_STORED)
    return b.getvalue()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files']); pg = await b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + ROOT + '/app/cuey.html?nosplash&notour'); await pg.wait_for_timeout(600)
        src = make_pptx()
        r = await pg.evaluate("""async d=>{const u=Uint8Array.from(atob(d),c=>c.charCodeAt(0));const r=await pptxFit(u.buffer);const o=new Uint8Array(r.buf);let s='';for(let i=0;i<o.length;i+=32768)s+=String.fromCharCode.apply(null,o.subarray(i,i+32768));return {n:r.n,b:btoa(s)}}""", base64.b64encode(src).decode())
        out = base64.b64decode(r['b'])
        z = zipfile.ZipFile(io.BytesIO(out))
        ok('the result is a valid .pptx (every file checks out)', z.testzip() is None)
        orig = zipfile.ZipFile(io.BytesIO(src))
        ok('same files, same order', z.namelist() == orig.namelist())
        ok('pictures and other files are byte-for-byte the same', all(z.read(n) == orig.read(n) for n in orig.namelist() if not n.startswith('ppt/slides/')))
        s1 = z.read('ppt/slides/slide1.xml').decode(); s2 = z.read('ppt/slides/slide2.xml').decode()
        import re
        tight = re.search(r'<p:sp>.*?תודה.*?</p:sp>', s1, re.S).group(0)
        sz = int(re.search(r'sz="(\d+)"', tight).group(1)); ln = int(re.search(r'spcPts val="(\d+)"', tight).group(1))
        ok('a one-line title too wide for its box gets smaller letters', sz < 13735, sz)
        ok('…and its line spacing shrinks with it (box stays one line)', ln < 12911 and abs(ln / 12911 - sz / 13735) < .02, (ln, sz))
        ok('…right-aligned: the box grows to the left, its right edge stays', (lambda m: int(m.group(1)) + int(m.group(2)) == 3000000 + 2500000)(re.search(r'<a:off x="(-?\d+)"[^>]*/><a:ext cx="(\d+)"', tight)))
        roomy = re.search(r'<p:sp>.*?>Hi<.*?</p:sp>', s1, re.S).group(0)
        ok('a title that fits keeps its letter size', 'sz="1800"' in roomy)
        ok('two paragraphs, a turned box and a fixed-size box are left exactly as they were', s2 == slide(MULTI, ROT, FIXED))
        bad = await pg.evaluate("(async()=>{const r=await pptxFit(new Uint8Array([1,2,3,4]).buffer);return r.n===0&&r.buf.byteLength===4})()")
        ok('not a zip → the original comes back untouched', bad)
        ok('no page errors', not errs, errs[:3])
        print(f'\n{sum(res)}/{len(res)} passed', flush=True)
        await b.close()
asyncio.run(main())
