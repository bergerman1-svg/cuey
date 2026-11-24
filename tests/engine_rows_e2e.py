"""AI Builder engine (24.11.2026): a long title goes on two rows before it shrinks, the split frame, one star, the block always fits the frame.
Runs the real kit + compose engine on a bare page (no network, no footage server)."""
import asyncio, os
from playwright.async_api import async_playwright
V = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'app', 'vendor'))
res = []
def ok(name, cond, info=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  -> ' + str(info)[:400]))
RUN = """async([F,look,logo])=>{const old=document.getElementById('c'),n=document.createElement('canvas');n.id='c';n.width=960;n.height=540;old.replaceWith(n);
  let lg=null;if(logo){const c=new OffscreenCanvas(600,200),x=c.getContext('2d');x.fillStyle='#111';x.fillRect(20,40,560,120);lg=await createImageBitmap(c)}
  const bc=new OffscreenCanvas(64,36),bx=bc.getContext('2d');bx.fillStyle='#00ff00';bx.fillRect(0,0,64,36);
  const A={mood:null,lum:null,logo:lg,intro:ENG.META.compose.intro,loop:ENG.META.compose.loop,look,bg:await createImageBitmap(bc),bg2:null,mix:0};const D=await ENG.compose(n,F,A,self.THREE,self.K);for(const t of [0,.5,2,A.intro+2])D(t);
  const c2=document.createElement('canvas');c2.width=96;c2.height=54;const x=c2.getContext('2d');x.drawImage(n,0,0,96,54);const d=x.getImageData(0,0,96,54).data;
  const px=(u,v)=>{const i=(Math.round(v*53)*96+Math.round(u*95))*4;return [d[i],d[i+1],d[i+2]]};
  /* rows of bright text: for each scan line, is there a near-white pixel */
  const rows=[];for(let y=0;y<54;y++){let w=0;for(let xx=0;xx<96;xx++){const i=(y*96+xx)*4;if(d[i]>170&&d[i+1]>170&&d[i+2]>170)w++}rows.push(w)}
  let ymin=54,ymax=-1;rows.forEach((w,y)=>{if(w>0){ymin=Math.min(ymin,y);ymax=Math.max(ymax,y)}});
  return {L:px(.03,.96),R:px(.97,.96),rows,ymin,ymax}}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--allow-file-access-from-files', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await b.new_context(viewport={'width': 960, 'height': 540}); await ctx.route(lambda u: u.startswith('http'), lambda r: r.abort())
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.set_content('<body style="margin:0;background:#000"><canvas id=c width=960 height=540></canvas>')
        for f in ('three.src.js', 'kit.js', 'engines.js'): await pg.add_script_tag(path=os.path.join(V, f))
        await pg.evaluate('(0,eval)(window.__THREE_SRC);(0,eval)(window.__KIT_SRC);(0,eval)(window.__ENG_SRC)')
        # the kit: one row is the old path; two rows stack
        k = await pg.evaluate("""()=>{const a=K.typeFX('Champions of the Finish Line',{h:2,unit:'word'}),b=K.typeFX('Champions of the Finish Line',{h:2,unit:'word',lines:['Champions of','the Finish Line']}),c=K.typeFX('שלום עולם יפה',{h:2,unit:'char',lines:['שלום','עולם יפה']});
          const ys=g=>[...new Set(g.parts.map(m=>+m.position.y.toFixed(3)))];b.align('left');const xl=b.parts.filter(m=>m.userData.row===0).map(m=>m.position.x-m.geometry.parameters.width/2),xl2=b.parts.filter(m=>m.userData.row===1).map(m=>m.position.x-m.geometry.parameters.width/2);
          return {a:[a.rows,a.n,a.height,ys(a)],b:[b.rows,b.n,+b.height.toFixed(2),ys(b),b.width<a.width*.75],order:b.parts.map(m=>m.userData.row).join(''),c:[c.rows,c.n,ys(c).length,c.he]}}""")
        ok('one row is the old single-line title (height, one line of parts)', k['a'][0] == 1 and k['a'][2] == 2 and k['a'][3] == [0], k['a'])
        ok('two rows: the same words stacked, narrower and taller, in reading order', k['b'][0] == 2 and k['b'][1] == k['a'][1] and k['b'][2] > 3 and len(k['b'][3]) == 2 and k['b'][4] and k['order'] == '00111', [k['b'], k['order']])
        ok('Hebrew letters in two rows', k['c'][0] == 2 and k['c'][1] == 12 and k['c'][2] == 2 and k['c'][3], k['c'])
        base = {'layout': 'center', 'font': 'heebo', 'reveal': 'rise', 'energy': .5, 'bg': 'liquid', 'fx': 'none', 'light': 'none', 'camera': 'still'}
        F = lambda t, **o: {'title': t, 'kicker': '', 'sub': '', 'accent': '#3355ff', 'accent2': '#102060', **o}
        gaps = lambda r: sum(1 for i in range(r['ymin'], r['ymax']) if r['rows'][i] == 0 and r['rows'][i - 1] > 0)
        s1 = await pg.evaluate(RUN, [F('Hello'), base, False]); s2 = await pg.evaluate(RUN, [F('Champions of the Finish Line today'), {**base, 'layout': 'left'}, False])
        ok('a short title stays on one row', s1['ymax'] > s1['ymin'] and gaps(s1) == 0, [s1['ymin'], s1['ymax'], gaps(s1)])
        ok('a long title in a side column is drawn on two rows', gaps(s2) >= 1, [s2['ymin'], s2['ymax'], gaps(s2), s1['ymin'], s1['ymax']])
        # split frame: the footage (pure green here) fills one half, the brand colour the other, words on the brand half
        sp = await pg.evaluate(RUN, [F('Level Up', accent='#101010', accent2='#ff8a1f'), {**base, 'layout': 'auto', 'bg': 'brand', 'panel': 'split', 'splitOn': True}, True])
        green = lambda c: c[1] > 150 and c[1] > c[0] + 50 and c[1] > c[2] + 50; orange = lambda c: c[0] > 180 and 80 < c[1] < 190 and c[2] < 110
        ok('split frame (kept in the engine, off by default): footage on one half, the brand colour on the other', green(sp['R']) and orange(sp['L']), [sp['L'], sp['R']])
        sph = await pg.evaluate(RUN, [F('מהחווה לשולחן', accent='#101010', accent2='#ff8a1f'), {**base, 'layout': 'auto', 'bg': 'brand', 'panel': 'split', 'splitOn': True}, True])
        off = await pg.evaluate(RUN, [F('Level Up', accent='#101010', accent2='#ff8a1f'), {**base, 'layout': 'auto', 'bg': 'brand', 'panel': 'split'}, True])
        ok('the split frame is switched off: a plain request for it gives the framed window, the brand colour in both corners', orange(off['L']) and orange(off['R']), [off['L'], off['R']])
        ok('split frame in Hebrew: the words keep the right half, the footage the left', green(sph['L']) and orange(sph['R']), [sph['L'], sph['R']])
        # a tall block (logo + tag + two-row title + sub) never leaves the frame
        tall = await pg.evaluate(RUN, [F('Champions of the Finish Line', kicker='HALF MARATHON AWARDS', sub='Race day'), {**base, 'layout': 'left', 'tag': True}, True])
        ok('a tall block stays inside the frame', tall['ymin'] >= 2 and tall['ymax'] <= 51, [tall['ymin'], tall['ymax']])
        ok('no page errors', not errs, errs[:3])
        await b.close()
    print(f"{sum(res)}/{len(res)} passed")
asyncio.run(main())
