/* Cuey AI Builder — premium engines (wave 1). Hand-made, deterministic motion pieces that run in the sandbox over real footage.
   The AI director only picks an engine + footage + texts/colours/variants; it never writes code here.
   Each engine: async (canvas, F, A, THREE, K) => draw(t). F = fields (title, sub, kicker, accent, accent2, …), A = {logo, bg, bg2, mix, intro, loop}. */
function CueyEngines(THREE,K){
const E=K.e,k=K.k,TAU=Math.PI*2;
const META={
  light:{intro:7,loop:8,fields:['kicker','title','sub','accent','accent2']},
  particles:{intro:7.5,loop:8,fields:['kicker','title','sub','accent','accent2']},
  cinema:{intro:7,loop:8,fields:['kicker','title','sub','accent','accent2']},
  celebrate:{intro:6.5,loop:8,fields:['kicker','title','sub','accent','accent2']},
  award:{intro:7,loop:8,fields:['kicker','title','sub','accent','accent2']},
  holiday:{intro:7.5,loop:8,fields:['kicker','title','sub','accent','accent2']},
  compose:{intro:7,loop:8,fields:['kicker','title','sub','accent','accent2']},
};
const hex=(c,d)=>/^#[0-9a-f]{6}$/i.test(String(c||''))?c:d;
/* moods (research rules L.66–70): font, reveal recipes, bloom. The director may pick one; each engine has a default. */
const MOODS={corporate:{font:null,w:800,title:'maskWords',kick:'maskLines',sub:'maskLines',bloom:.5},gala:{font:'Frank Ruhl Libre',w:700,title:'blur',kick:'soft',sub:'soft',bloom:.7},
  tech:{font:null,w:900,title:'maskChars',kick:'maskChars',sub:'maskLines',bloom:.6},party:{font:'Secular One',w:400,title:'slam',kick:'maskWords',sub:'maskWords',bloom:.85},
  memorial:{font:'Frank Ruhl Libre',w:500,title:'soft',kick:'soft',sub:'soft',bloom:.3}};
/* shared: stage + footage + the hero block (logo / kicker / title / sub) laid out inside graphics-safe (5%) */
function core(canvas,F,A,{bloom={s:.75,r:.5,th:.9},fov=36,grade={},titleColor='#ffffff',titleColor2=null,glow=null,camZ=15,mood='corporate'}={}){
  const M=MOODS[A.mood]||MOODS[mood]||MOODS.corporate;bloom={...bloom,s:M.bloom,r:Math.min(.6,bloom.r)};
  const st=K.stage(canvas,{bg:'#000000',fov,bloom,shadows:false,exposure:1}),{S,C}=st;C.position.set(0,0,camZ);C.lookAt(0,0,0);
  const fg=K.footage(S,{dark:.42,vig:.6,...grade});const ac=hex(F.accent,'#ffd27a'),ac2=hex(F.accent2,'#7cf5ff');
  const H=new THREE.Group();S.add(H);const vw=2*camZ*Math.tan(fov*Math.PI/360)*16/9;let y=0;const items={};
  const fit=(g,maxW)=>{if(g.width>maxW){const s=maxW/g.width;g.scale.setScalar(s);g.width*=s;g.height*=s}return g};
  const tf=(str,o)=>K.typeFX(str,{font:M.font,weight:M.w,...o});
  const logo=A.logo?fit(K.logoFX(A.logo,{h:3.4,glow:ac}),vw*.5):null;
  const kick=F.kicker?fit(tf(F.kicker,{px:120,h:.5,weight:K.he(F.kicker)?700:600,font:M.font==='Secular One'?null:M.font,color:'#ffffff',color2:ac,shadow:'rgba(0,0,0,.65)',ls:K.he(F.kicker)?0:120*.2,emissive:.92,unit:M.kick==='maskChars'?'char':'line'}),vw*.7):null;
  const title=F.title?fit(tf(F.title,{px:260,h:logo?1.35:2.2,color:titleColor,color2:titleColor2||titleColor,glow:glow||ac,emissive:.85,ls:-260*.015,unit:(K.recipes[M.title]||{}).unit||'word'}),vw*.9):null;
  const sub=F.sub?fit(tf(F.sub,{px:130,h:logo?.52:.66,weight:M.font==='Secular One'?400:500,font:M.font==='Secular One'?null:M.font,color:'#ffffff',shadow:'rgba(0,0,0,.7)',ls:K.he(F.sub)?0:130*.06,emissive:.9,unit:'line'}),vw*.8):null;
  const stack=[logo&&[logo,.55],kick&&[kick,.42],title&&[title,.5],sub&&[sub,0]].filter(Boolean);let tot=0;stack.forEach(([g,gap])=>tot+=g.height+gap);y=tot/2;
  stack.forEach(([g,gap])=>{g.position.y=y-g.height/2;y-=g.height+gap;H.add(g)});Object.assign(items,{logo,kick,title,sub});
  /* scrim sized to the words; its strength comes from the measured footage brightness so white text keeps ≥ 4.5:1 (rule 45) */
  const sv=(()=>{const cv=new OffscreenCanvas(256,128),x=cv.getContext('2d'),g=x.createRadialGradient(128,64,0,128,64,128);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.55,'rgba(0,0,0,.75)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,256,128);return new THREE.CanvasTexture(cv)})();
  const scrim=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:sv,transparent:true,depthWrite:false,opacity:0,toneMapped:false}));scrim.scale.set(Math.min(vw*1.1,Math.max(...stack.map(([g])=>g.width))*1.6+4),tot*1.9+2.5,1);scrim.position.z=-1.5;scrim.renderOrder=-10;S.add(scrim);
  const lum=typeof A.lum==='number'?A.lum:.3,dk=fg.u.dark.value,need=K.cl(1-.16/Math.max(lum*(1-dk),.02),.3,.85);
  const rv=(g,t,s,rec)=>{if(g)g.at(t,s,rec)};
  return {st,S,C,fg,H,ac,ac2,vw,M,tf,...items,scrim,lum,sc(v){scrim.material.opacity=need*v},feed(){fg.feed(A)},
    /* kicker → title → sub in the mood's recipes, overlapping (rule 5); returns when the title has settled */
    typeIn(t,t0,{title:doTitle=true}={}){rv(kick,t,t0,M.kick);if(doTitle)rv(title,t,t0+.3,M.title);rv(sub,t,t0+(doTitle?.85:.4),M.sub);const R=K.recipes[M.title]||K.recipes.maskWords;return t0+.3+R.dur+R.st*((title&&title.n)||1)},
    /* one light sweep per reveal, after it settles (rule 43) */
    sweep(g,t,s){if(!g)return;const u=k(t,s,s+.9);g.u.shine.value=u>0&&u<1?-.2+1.4*K.e.sine(u):-1},
    breath(L){if(L.on)H.scale.setScalar(1+.012*Math.sin(L.ph))}}}
const lp=(t,A)=>{const I=A.intro,L=A.loop;return {I,L,ph:TAU*(t-I)/L,u:t<I?0:((t-I)%L)/L,on:t>=I}};
/* floating dust in light — periodic with the loop (whole multiples of the phase) */
function dust(S,n,{spread=[26,15,10],size=1,color='#ffe9c4',seed=11,op=.4}={}){const p=K.points(n,{size,color}),R=K.rng(seed),b=[];const pos=p.geometry.attributes.position.array,al=p.geometry.attributes.al.array,sz=p.geometry.attributes.sz.array;
  for(let i=0;i<n;i++){b.push([(R()-.5)*spread[0],(R()-.5)*spread[1],(R()-.5)*spread[2]-2,1+Math.floor(R()*2),R()*TAU,.2+R()*.8]);sz[i]=.3+R()*1.2}p.material.uniforms.op.value=op;S.add(p);
  p.tick=ph=>{for(let i=0;i<n;i++){const q=b[i];pos[i*3]=q[0]+Math.sin(ph*q[3]+q[4])*.6;pos[i*3+1]=q[1]+Math.cos(ph*q[3]+q[4]*1.3)*.45;pos[i*3+2]=q[2];al[i]=q[5]*(.55+.45*Math.sin(ph*q[3]*2+q[4]*2))}
    p.geometry.attributes.position.needsUpdate=true;p.geometry.attributes.al.needsUpdate=true};return p}

/* 1 · LIGHT — the title (and logo) are revealed by light: rays from above, a light streak, an edge of light sweeping across the letters */
async function light(canvas,F,A){const c=core(canvas,F,A,{mood:'corporate',grade:{dark:.5,blur:2}}),{st,S,C,fg,H,ac,ac2}=c;
  const rays=K.rays(16,{color:ac,len:34,width:2.6,op:.16});rays.position.set(0,12,-4);S.add(rays);
  const streak=K.flare(ac2,{w:30,h:.32});streak.position.set(0,c.title?c.title.position.y:0,.4);S.add(streak);
  const edgeF=K.flare('#ffffff',{w:12,h:.8});S.add(edgeF);const ds=dust(S,450,{color:'#fff1d6'});
  const halo=K.glow(ac,22,0);halo.position.set(0,0,-3);S.add(halo);
  const heros=[c.logo,c.title].filter(Boolean);
  return t=>{const L=lp(t,A);c.feed();const f=fg.u;
    f.dark.value=.5+.5*(1-E.o3(k(t,0,1.6)));f.zoom.value=1.16-.1*E.io3(k(t,0,L.I))+(L.on?.012*Math.sin(L.ph):0);f.blur.value=2.6-1.2*E.o3(k(t,2.5,5));
    C.position.set(Math.sin(L.ph)*.25,Math.cos(L.ph)*.12,15.6-1.2*E.io3(k(t,0,L.I)));C.lookAt(0,0,0);
    rays.sway(t);rays.children.forEach(m=>m.material.opacity*=E.o3(k(t,.8,3)));ds.tick(L.ph);ds.material.uniforms.op.value=.4*E.o3(k(t,.5,2.5));
    const s1=E.io3(k(t,2,3.2));streak.scale.x=Math.max(.001,s1);streak.material.opacity=s1*(1-.75*E.o3(k(t,3.4,5)))*(L.on?1+.15*Math.sin(L.ph*2):1);
    const rv=E.io3(k(t,3,4.7));heros.forEach(g=>{g.u.rev.value=rv;g.u.glow.value=.12*E.o3(k(t,4.2,5.4))*(1-.6*E.o3(k(t,5.4,6.8)))});
    const he=c.title&&c.title.he,ex=c.title?(he?1:-1)*(c.title.width/2-c.title.width*rv):0;edgeF.position.set(ex,c.title?c.title.position.y:0,.6);edgeF.material.opacity=rv>0&&rv<1?1:0;
    c.kick&&c.kick.at(t,4.3,c.M.kick);c.sub&&c.sub.at(t,4.7,c.M.sub);
    heros.forEach(g=>c.sweep(g,t,5.4));if(c.logo&&L.on)c.logo.u.glow.value=0;c.breath(L);
    c.sc(E.o3(k(t,2.6,4.4)));halo.material.opacity=.32*E.o3(k(t,3.4,5))*(1+.12*Math.sin(L.ph));H.position.y=.06*Math.sin(L.ph);st.bloom.strength=.7+.12*Math.sin(L.ph)+.5*Math.exp(-Math.pow((t-4)/.6,2));st.render()}}

/* 2 · PARTICLES — thousands of sparks fly in from depth and assemble the logo / title, then the crisp letters light up */
async function particles(canvas,F,A){const c=core(canvas,F,A,{mood:'tech',grade:{dark:.55,blur:2.5}}),{st,S,C,fg,H,ac,ac2}=c;
  const tgt=c.logo||c.title,src=A.logo||F.title||'Cuey';const n=A.logo?14000:11000;const smp=K.sample(src,{n,h:tgt?tgt.height*(A.logo?1:.78):2,seed:5});
  const p=K.points(n,{size:1.15,color:'#ffffff'}),R=K.rng(21),pos=p.geometry.attributes.position.array,col=p.geometry.attributes.color.array,sz=p.geometry.attributes.sz.array,al=p.geometry.attributes.al.array;
  const ca=new THREE.Color(ac),cb=new THREE.Color(ac2),st0=[],dl=[];for(let i=0;i<n;i++){const r=8+R()*26,a=R()*TAU,b=(R()-.5)*2;st0.push([Math.cos(a)*r,b*r*.5,-10-R()*40+Math.sin(a)*8]);dl.push(R());
    const m=A.logo?null:(R());if(A.logo){col[i*3]=smp.C[i*3];col[i*3+1]=smp.C[i*3+1];col[i*3+2]=smp.C[i*3+2]}else{const q=ca.clone().lerp(cb,m);col[i*3]=q.r;col[i*3+1]=q.g;col[i*3+2]=q.b}sz[i]=.5+R()*1.1}
  p.geometry.attributes.color.needsUpdate=true;H.add(p);const ty=tgt?tgt.position.y:0;const ds=dust(S,500,{color:ac,op:.4});
  const ring=K.glow(ac,16,0);ring.position.set(0,ty,-1);S.add(ring);
  return t=>{const L=lp(t,A);c.feed();const f=fg.u;f.dark.value=.55+.45*(1-E.o3(k(t,0,1.4)));f.zoom.value=1.14-.1*E.io3(k(t,0,L.I))+(L.on?.01*Math.sin(L.ph):0);
    C.position.set(Math.sin(t*.0+L.ph)*.4,.1*Math.cos(L.ph),16-1.6*E.io3(k(t,0,L.I)));C.lookAt(0,0,0);
    for(let i=0;i<n;i++){const d=dl[i],u=E.io3(k(t,1+d*1.6,3.6+d*1.6)),s=st0[i],sw=(1-u)*(1-u),ang=sw*3.2+d*TAU,cx=Math.cos(ang),sx=Math.sin(ang);
      const x0=s[0]*cx-s[2]*sx*.2,z0=s[2];const tx=smp.P[i*2],tyy=smp.P[i*2+1]+ty;
      const br=L.on||t>5.5?.035*Math.sin(L.ph*2+d*TAU):0;pos[i*3]=x0+(tx-x0)*u+br;pos[i*3+1]=s[1]+(tyy-s[1])*u+br*.6;pos[i*3+2]=z0*(1-u)+.02*Math.sin(L.ph*3+d*20);
      al[i]=.42*(.25+.75*E.o3(k(t,.2+d*1.4,1+d*1.4)))*(1-.6*E.o3(k(t,5.6,6.8)))*(.75+.25*Math.sin(L.ph*4+d*31))}
    p.geometry.attributes.position.needsUpdate=true;p.geometry.attributes.al.needsUpdate=true;ds.tick(L.ph);
    const rv=E.o3(k(t,5.1,6.2));[c.logo,c.title].filter(Boolean).forEach(g=>{g.u.op.value=rv;g.u.rev.value=1;g.u.glow.value=.35*(1-rv)+.08});
    [c.logo,c.title].filter(Boolean).forEach(g=>c.sweep(g,t,6.2));c.breath(L);
    if(!c.logo&&c.title){}c.kick&&c.kick.at(t,5.6,c.M.kick);c.sub&&c.sub.at(t,5.9,c.M.sub);
    c.sc(E.o3(k(t,3,5.2)));ring.material.opacity=.22*Math.exp(-Math.pow((t-4.9)/.7,2))+.08*E.o3(k(t,5,6.5))*(1+.2*Math.sin(L.ph));ring.scale.setScalar(14+6*E.o3(k(t,4.4,6)));
    st.bloom.strength=.75+.35*Math.exp(-Math.pow((t-5)/.6,2))+.1*Math.sin(L.ph);st.render()}}

/* 3 · CINEMA — a deep, extruded title; the camera glides from a low side angle to the hero frame; light sweeps across the face */
async function cinema(canvas,F,A){const c=core(canvas,F,A,{mood:'corporate',grade:{dark:.5,blur:4.5},titleColor:'#ffffff',titleColor2:'#d9dde6',camZ:15}),{st,S,C,fg,H,ac,ac2}=c;
  const T=c.title||c.logo;const layers=[];if(T&&c.title){for(let i=1;i<=22;i++){const g=c.tf(F.title,{px:260,h:A.logo?1.35:2.2,color:'#2a2f3a',color2:'#0d0f14',emissive:.55,ls:-260*.015,unit:'line'});
    g.scale.copy(T.scale);g.position.set(T.position.x,T.position.y,-i*.035);g.parts.forEach(m=>m.renderOrder=-i);g.u.op.value=1;layers.push(g);H.add(g)}}
  const flare=K.flare(ac2,{w:36,h:.5});flare.position.set(0,T?T.position.y:0,.5);S.add(flare);const ds=dust(S,600,{color:'#dfe8ff',op:.4});
  const back=K.glow(ac,30,0);back.position.set(0,T?T.position.y:0,-6);S.add(back);
  const cam=K.camera(C,[{t:0,p:[-9,-2.6,7],look:[0,-.3,0],fov:30},{t:2.6,p:[-6,-1.4,9.5],look:[0,0,0],fov:32},{t:5.2,p:[-1.2,.1,14],look:[0,0,0],fov:35},{t:A.intro,p:[0,0,15],look:[0,0,0],fov:36,e:'o3'}]);
  return t=>{const L=lp(t,A);c.feed();const f=fg.u;f.dark.value=.5+.5*(1-E.o3(k(t,0,1.2)));f.zoom.value=1.2-.12*E.io3(k(t,0,L.I));f.pan.value.set(-.04*(1-E.io3(k(t,0,L.I)))+(L.on?.006*Math.sin(L.ph):0),0);
    cam(t);if(L.on){C.position.x+=Math.sin(L.ph)*.5;C.position.y+=Math.sin(L.ph*2)*.08;C.lookAt(0,0,0)}
    const a=E.o3(k(t,.3,1.6));[c.title,c.logo].filter(Boolean).forEach(g=>{g.u.op.value=a;g.u.rev.value=1});layers.forEach(g=>g.u.op.value=a);
    const sh=k(t,2.4,4.6);[c.title,c.logo].filter(Boolean).forEach(g=>{g.u.shine.value=sh>0&&sh<1?-.2+1.4*E.io3(sh):-1;g.u.glow.value=L.on?0:.06});c.breath(L);
    flare.material.opacity=.55*Math.exp(-Math.pow((sh-.5)/.22,2))*(sh>0&&sh<1?1:0);flare.position.x=(sh-.5)*(T?T.width:10);c.kick&&c.kick.at(t,4.6,c.M.kick);c.sub&&c.sub.at(t,5,c.M.sub);ds.tick(L.ph);
    c.sc(E.o3(k(t,.3,2)),.5);back.material.opacity=.3*E.o3(k(t,3,5))*(1+.15*Math.sin(L.ph));st.bloom.strength=.75+.15*Math.sin(L.ph);st.render()}}

/* 4 · CELEBRATE — fireworks bloom over real footage, a flash, the title pops in with confetti raining through the frame */
async function celebrate(canvas,F,A){const c=core(canvas,F,A,{mood:'party',grade:{dark:.58,blur:1.6},bloom:{s:.8,r:.55,th:.88}}),{st,S,C,fg,H,ac,ac2}=c;S.add(new THREE.AmbientLight('#ffffff',1.6));const dl0=new THREE.DirectionalLight('#ffffff',2.2);dl0.position.set(3,5,8);S.add(dl0);
  const cols=[ac,ac2,'#ffffff','#ff5c8a','#ffd166'];const shells=[[-6,3.5,-6,1.0,0],[5.5,4.2,-7,1.7,1],[-2,5.4,-9,2.6,2],[7,1.8,-8,3.4,3],[-7.5,1,-7,4.1,4],[1.5,4.8,-6,4.7,1]];
  const N=360,fw=shells.map(([x,y,z,t0,ci],j)=>{const p=K.points(N,{size:2.6,color:'#ffffff'}),R=K.rng(40+j),v=[];const cc=new THREE.Color(cols[ci]),col=p.geometry.attributes.color.array;
    for(let i=0;i<N;i++){const th=R()*TAU,ph=Math.acos(2*R()-1),s=2.2+R()*.6;v.push([Math.sin(ph)*Math.cos(th)*s,Math.cos(ph)*s,Math.sin(ph)*Math.sin(th)*s]);col.set([cc.r,cc.g,cc.b],i*3)}
    p.geometry.attributes.color.needsUpdate=true;S.add(p);return {p,v,o:[x,y,z],t0}});
  const conf=K.confetti(900,{colors:cols,size:.16,gravity:2.2});S.add(conf);const rain=K.confetti(500,{colors:cols,size:.13,gravity:0,seed:31});S.add(rain);
  const rr=K.rng(77),rp=[];for(let i=0;i<500;i++)rp.push([(rr()-.5)*26,rr()*16,-2-rr()*8,.4+rr()*.6,rr()]);const o=new THREE.Object3D();
  const halo=K.glow(ac,24,0);halo.position.set(0,c.title?c.title.position.y:0,-2);S.add(halo);
  const burst=(s,age)=>{const pos=s.p.geometry.attributes.position.array,al=s.p.geometry.attributes.al.array,a=Math.max(0,age),dd=(1-Math.exp(-2.2*a))/2.2;
    for(let i=0;i<N;i++){pos[i*3]=s.o[0]+s.v[i][0]*dd*1.6;pos[i*3+1]=s.o[1]+s.v[i][1]*dd*1.6-.35*a*a;pos[i*3+2]=s.o[2]+s.v[i][2]*dd*1.6;al[i]=age<0?0:Math.max(0,1-a/2.2)*(.6+.4*Math.sin(a*30+i))}
    s.p.geometry.attributes.position.needsUpdate=true;s.p.geometry.attributes.al.needsUpdate=true};
  const POP=3.2;
  return t=>{const L=lp(t,A);c.feed();const f=fg.u;f.dark.value=.58+.42*(1-E.o3(k(t,0,1)));f.zoom.value=1.1-.06*E.io3(k(t,0,L.I))+(L.on?.01*Math.sin(L.ph):0);
    let fl=0;fw.forEach(s=>{const age=L.on?((L.u*L.L-s.t0*.9)%L.L+L.L)%L.L:t-s.t0;burst(s,age);fl+=Math.max(0,.08-age*.15)*(age>=0?1:0)});
    fl+=.28*Math.exp(-Math.pow((t-POP)/.12,2));f.flash.value=fl;f.fcol.value.set(ac);
    C.position.set(Math.sin(L.ph)*.3,Math.cos(L.ph)*.15,15-.8*E.io3(k(t,0,L.I))+(t>POP&&t<POP+.4?Math.sin((t-POP)*60)*.04:0));C.lookAt(0,0,0);
    conf.burst(t-POP,[0,c.title?c.title.position.y:0,-1],1.1);conf.visible=t<L.I+.1||!L.on?true:false;
    for(let i=0;i<500;i++){const q=rp[i],yy=((q[1]-(L.on?L.u*L.L:t-L.I)*q[3]*2)%16+16)%16-7;o.position.set(q[0]+Math.sin(L.ph+q[4]*9)*.4,yy,q[2]);o.rotation.set(L.ph*2+q[4]*7,L.ph*3+q[4]*5,q[4]*6);o.scale.setScalar(E.o3(k(t,POP,POP+1.5)));o.updateMatrix();rain.setMatrixAt(i,o.matrix)}rain.instanceMatrix.needsUpdate=true;
    if(c.title){c.title.at(t,POP,c.M.title);c.title.u.glow.value=.1*Math.exp(-Math.max(0,t-POP))+.02+.02*Math.sin(L.ph*2)}
    if(c.logo){c.logo.u.op.value=E.o3(k(t,POP-.2,POP+.4));c.logo.scale.setScalar((c.logo.userData.s0||(c.logo.userData.s0=c.logo.scale.x))*(.7+.3*E.back(k(t,POP-.2,POP+.6))))}
    c.kick&&c.kick.at(t,POP+.5,c.M.kick);c.sub&&c.sub.at(t,POP+.8,c.M.sub);c.sweep(c.title,t,POP+1.1);c.breath(L);
    c.sc(E.o3(k(t,POP-.6,POP+.4)),.7);halo.material.opacity=.22*E.o3(k(t,POP,POP+.6))*(1+.15*Math.sin(L.ph*2));st.bloom.strength=.8+.3*fl;st.render()}}

/* 5 · AWARD — gold: spotlights sweep the stage, a slow golden ring turns behind a metallic title, glitter falls through the light */
async function award(canvas,F,A){const c=core(canvas,F,A,{mood:'gala',grade:{dark:.6,blur:3,sat:.7,tint:'#3a2a10',tintA:.25},titleColor:'#fff4cf',titleColor2:'#c9952f',glow:'#ffcf6b'}),{st,S,C,fg,H,ac}=c;
  const gold='#ffcf6b',env=(()=>{const cv=new OffscreenCanvas(256,128),x=cv.getContext('2d'),g=x.createLinearGradient(0,0,0,128);g.addColorStop(0,'#fff6dc');g.addColorStop(.45,'#6b4a12');g.addColorStop(.55,'#1a1206');g.addColorStop(1,'#d9a441');x.fillStyle=g;x.fillRect(0,0,256,128);
    const t=new THREE.CanvasTexture(cv);t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;return new THREE.PMREMGenerator(st.R).fromEquirectangular(t).texture})();
  const gm=new THREE.MeshStandardMaterial({color:'#e7b75a',metalness:1,roughness:.22,envMap:env,envMapIntensity:1.4});
  const ty=c.title?c.title.position.y:0,ring=new THREE.Mesh(new THREE.TorusGeometry(6.4,.08,24,200),gm),ring2=new THREE.Mesh(new THREE.TorusGeometry(6.9,.03,16,200),gm);ring.position.set(0,ty,-5);ring2.position.copy(ring.position);S.add(ring,ring2);
  S.add(new THREE.AmbientLight('#ffffff',.4));const kl=new THREE.DirectionalLight('#fff0d0',2.2);kl.position.set(4,6,8);S.add(kl);
  const spots=[-1,1].map(s=>{const r=K.rays(5,{color:'#fff1c9',len:40,width:3.2,op:.14,seed:s>0?3:8});r.position.set(s*11,13,-5);S.add(r);return r});
  const gl=K.points(1400,{size:1.1,color:gold}),R=K.rng(9),gp=[];for(let i=0;i<1400;i++)gp.push([(R()-.5)*26,R()*16,(R()-.5)*8-1,.25+R()*.5,R()*TAU]);S.add(gl);const halo=K.glow(gold,24,0);halo.position.set(0,ty,-4);S.add(halo);
  return t=>{const L=lp(t,A);c.feed();const f=fg.u;f.dark.value=.6+.4*(1-E.o3(k(t,0,1.4)));f.zoom.value=1.15-.08*E.io3(k(t,0,L.I));
    C.position.set(Math.sin(L.ph)*.35,.2+Math.cos(L.ph)*.1,16.5-1.5*E.io3(k(t,0,L.I)));C.lookAt(0,0,0);
    spots.forEach((r,i)=>{r.rotation.z=(i?-1:1)*(.55-.5*E.io3(k(t,.4,3.2)))+(i?-1:1)*.06*Math.sin(L.ph+i);r.children.forEach(m=>m.material.opacity=m.userData.o*E.o3(k(t,.2,1.5))*(.85+.15*Math.sin(L.ph*2+i)))});
    const rs=E.io3(k(t,1.4,3.6));ring.scale.setScalar(.3+.7*rs);ring2.scale.setScalar(.2+.8*E.io3(k(t,1.7,4)));ring.rotation.set(.18*Math.sin(L.ph)+(1-rs)*1.4,.22*Math.cos(L.ph)+(1-rs)*2.2,0);ring2.rotation.set(-.15*Math.cos(L.ph)+(1-rs)*-1,-.2*Math.sin(L.ph)+(1-rs)*1.6,.2);gm.opacity=1;ring.visible=ring2.visible=t>1.3;
    const pos=gl.geometry.attributes.position.array,al=gl.geometry.attributes.al.array;for(let i=0;i<1400;i++){const q=gp[i],yy=((q[1]-(t-L.I)*q[3]*1.4)%16+16)%16-7;pos[i*3]=q[0]+Math.sin(L.ph+q[4])*.3;pos[i*3+1]=yy;pos[i*3+2]=q[2];al[i]=E.o3(k(t,1,3))*(.4+.6*Math.max(0,Math.sin(L.ph*3+q[4]*7)))}
    gl.geometry.attributes.position.needsUpdate=true;gl.geometry.attributes.al.needsUpdate=true;
    if(c.logo){c.logo.u.rev.value=E.io3(k(t,2.4,3.8));c.logo.u.glow.value=L.on?0:.1}if(c.title){c.title.at(t,3,c.M.title);c.title.u.glow.value=.1}[c.title,c.logo].filter(Boolean).forEach(g=>c.sweep(g,t,5.2));c.breath(L);
    c.sc(E.o3(k(t,2.6,4.4)));c.kick&&c.kick.at(t,4.2,c.M.kick);c.sub&&c.sub.at(t,4.6,c.M.sub);halo.material.opacity=.3*E.o3(k(t,3,5))*(1+.12*Math.sin(L.ph));st.bloom.strength=.8+.15*Math.sin(L.ph);st.render()}}

/* 6 · HOLIDAY — warm bokeh and snow; glowing sparks gather into the title / logo; soft golden light breathes */
async function holiday(canvas,F,A){const c=core(canvas,F,A,{mood:'gala',grade:{dark:.6,blur:3.5,sat:.85},titleColor:'#ffffff',glow:hex(F.accent,'#ffcf6b')}),{st,S,C,fg,H,ac,ac2}=c;
  const sn=K.points(1600,{size:1.5,color:'#ffffff'}),R=K.rng(14),sp=[];for(let i=0;i<1600;i++){sp.push([(R()-.5)*30,R()*18,(R()-.5)*14-2,.35+R()*.6,R()*TAU]);sn.geometry.attributes.sz.array[i]=.4+R()*1.3}S.add(sn);
  const bk=K.points(70,{size:38,color:ac}),bp=[];for(let i=0;i<70;i++){bp.push([(R()-.5)*30,(R()-.5)*16,-8-R()*10,R()*TAU]);const q=new THREE.Color(i%3?ac:ac2);bk.geometry.attributes.color.array.set([q.r,q.g,q.b],i*3)}bk.geometry.attributes.color.needsUpdate=true;bk.material.uniforms.op.value=.18;S.add(bk);
  const tgt=c.logo||c.title,n=7000,smp=K.sample(A.logo||F.title||'Cuey',{n,h:tgt?tgt.height*(A.logo?1:.78):2,seed:3});const p=K.points(n,{size:1.1,color:'#ffffff'}),pos=p.geometry.attributes.position.array,al=p.geometry.attributes.al.array;
  const s0=[],dl=[];for(let i=0;i<n;i++){s0.push([(R()-.5)*30,10+R()*10,(R()-.5)*10]);dl.push(R())}const cc=new THREE.Color(ac);for(let i=0;i<n;i++)p.geometry.attributes.color.array.set([1,.9+.1*cc.g,.75+.25*cc.b],i*3);p.geometry.attributes.color.needsUpdate=true;H.add(p);
  const ty=tgt?tgt.position.y:0,halo=K.glow(ac,22,0);halo.position.set(0,ty,-3);S.add(halo);
  return t=>{const L=lp(t,A);c.feed();const f=fg.u;f.dark.value=.6+.4*(1-E.o3(k(t,0,1.4)));f.zoom.value=1.14-.1*E.io3(k(t,0,L.I))+(L.on?.01*Math.sin(L.ph):0);
    C.position.set(Math.sin(L.ph)*.35,.1*Math.cos(L.ph),15.5-1.2*E.io3(k(t,0,L.I)));C.lookAt(0,0,0);
    const a=sn.geometry.attributes,sx=a.position.array,sa=a.al.array;for(let i=0;i<1600;i++){const q=sp[i],yy=((q[1]-(t-L.I)*q[3]*1.2)%18+18)%18-8;sx[i*3]=q[0]+Math.sin(L.ph*2+q[4])*.5;sx[i*3+1]=yy;sx[i*3+2]=q[2];sa[i]=E.o3(k(t,.2,1.8))*.8}a.position.needsUpdate=true;a.al.needsUpdate=true;
    const b=bk.geometry.attributes.position.array;for(let i=0;i<70;i++){const q=bp[i];b[i*3]=q[0]+Math.sin(L.ph+q[3])*.8;b[i*3+1]=q[1]+Math.cos(L.ph+q[3])*.5;b[i*3+2]=q[2]}bk.geometry.attributes.position.needsUpdate=true;bk.material.uniforms.op.value=.2*E.o3(k(t,.3,2))*(1+.2*Math.sin(L.ph*2));
    for(let i=0;i<n;i++){const d=dl[i],u=E.io3(k(t,1.2+d*2,3.8+d*2)),q=s0[i],x0=q[0]+Math.sin(t*1.3+d*30)*.6*(1-u),y0=q[1]-(t*1.4)*(1-u)*.5;
      pos[i*3]=x0+(smp.P[i*2]-x0)*u;pos[i*3+1]=y0+(smp.P[i*2+1]+ty-y0)*u+.03*Math.sin(L.ph*2+d*20);pos[i*3+2]=q[2]*(1-u);al[i]=.5*E.o3(k(t,.8+d*2,1.6+d*2))*(1-.6*E.o3(k(t,5.6,6.8)))*(.7+.3*Math.sin(L.ph*4+d*40))}
    p.geometry.attributes.position.needsUpdate=true;p.geometry.attributes.al.needsUpdate=true;
    const rv=E.o3(k(t,5.2,6.4));[c.title,c.logo].filter(Boolean).forEach(g=>{g.u.op.value=rv;g.u.glow.value=.15+.05*Math.sin(L.ph*2)});[c.title,c.logo].filter(Boolean).forEach(g=>c.sweep(g,t,6.4));if(c.logo&&L.on)c.logo.u.glow.value=0;c.breath(L);
    c.sc(E.o3(k(t,3.5,5.5)));c.kick&&c.kick.at(t,5.6,c.M.kick);c.sub&&c.sub.at(t,6,c.M.sub);halo.material.opacity=.3*E.o3(k(t,4.5,6.5))*(1+.15*Math.sin(L.ph));st.bloom.strength=.95+.15*Math.sin(L.ph);st.render()}}

/* 7 · COMPOSE — the designer engine. The director writes a LOOK (layout, font, reveal, energy, light, fx, rule, grade) and this one
   engine builds it from blocks. Rules: everything settles before the hold; the hold is periodic in ph (seamless loop, no jumps);
   the slide fades up from black; text sits where the footage is empty ('auto' reads the first frame). */
const BGFS="uniform float ph,fade,mode,asp;uniform vec3 c0,c1,c2;varying vec2 v;\nfloat h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}\nfloat fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}\nvoid main(){vec2 p=vec2((v.x-.5)*asp,v.y-.5);vec2 o=vec2(cos(ph),sin(ph));vec3 col=c0*(1.2-.5*length(p));\n if(mode<.5){for(int k=0;k<3;k++){float fk=float(k);float y=-.08+.13*fk+.24*(fb(vec2(p.x*1.1+fk*3.,fk)+o*.35)-.5);float d=p.y-y;float w=.0035+.004*fk;float band=exp(-d*d/w)*(.55+.45*fb(vec2(p.x*3.,fk*5.)+o*.5));float glow=exp(-abs(d)*7.)*.18;vec3 cc=mix(c1,c2,fk/2.);col+=cc*(band*(.5-.1*fk)+glow*(.6-.15*fk));}}\n else if(mode<1.5){vec2 q=p*1.5;float f=fb(q+fb(q*1.3+o*.4)*1.3+o*.25);float r=pow(.5+.5*sin(f*5.+p.x*.7+o.x*.3),3.);col=mix(c0,c1*.22,smoothstep(.3,.85,f))+c1*r*.16+c2*pow(r,4.)*.1;}\n else if(mode<2.5){float a=fb(p*1.4+o*.3),b=fb(p*2.8-o*.4+3.);col+=c1*pow(a,3.)*1.5+c2*pow(b,4.)*1.3;}\n else if(mode<3.5){float a=fb(p*1.1+o*.5),b=fb(p*1.1+vec2(5.)-o*.5);col=mix(c0,c1*.55,smoothstep(.3,.85,a)*.55);col=mix(col,c2*.55,smoothstep(.5,.9,b)*.4);}\n else {float a=fb(p*.9+o*.25);col=c0*(1.04-.12*length(p))+(c1-c0)*.05*smoothstep(.35,.8,a);}\n vec2 gv=v*vec2(320.,180.),g=floor(gv);float s=h(g);vec2 fc=fract(gv)-.5-vec2(h(g+3.1),h(g+7.7))*.5+.25;float st=smoothstep(.09+.07*h(g+1.3),0.,length(fc));col+=step(.993,s)*st*(.45+.55*sin(ph*3.+s*40.))*(mode>3.5?0.:mode>2.5?.15:.85);\n col*=1.-(mode>3.5?.18:.5)*smoothstep(.45,1.05,length((v-.5)*vec2(1.25,1.)));gl_FragColor=vec4(col*fade,1.);}\n";
const FONTS={heebo:['Heebo',800],heeboLight:['Heebo',300],rubik:['Rubik',800],rubikBlack:['Rubik',900],karantina:['Karantina',700],suez:['Suez One',400],secular:['Secular One',400],
  frank:['Frank Ruhl Libre',700],frankLight:['Frank Ruhl Libre',400],bellefair:['Bellefair',400],notoSerif:['Noto Serif Hebrew',300],david:['David Libre',500],amatic:['Amatic SC',700],fredoka:['Fredoka',600],assistant:['Assistant',200]};
const XREC={veil:{unit:'line',dur:1.7,st:0,ez:'calmIn',mode:2,s0:1.025},rise:{unit:'word',dur:1.1,st:.12,ez:'heroIn',mode:0},pop:{unit:'word',dur:.55,st:.06,ez:'settle',mode:1,s0:.6},
  type:{unit:'char',dur:.42,st:.11,ez:'calmIn',mode:1},center:{unit:'char',dur:.55,st:.05,ez:'heroIn',mode:0,from:'center'},
  scramble:{unit:'char',dur:.45,st:.06,ez:'heroIn',mode:1},glitch:{unit:'word',dur:.35,st:.05,ez:'heroIn',mode:1},snap:{unit:'word',dur:.55,st:.08,ez:'settle',mode:1},count:{unit:'char',dur:2.2,st:0,ez:'heroIn',mode:1}};
const rec=n=>XREC[n]||K.recipes[n]||K.recipes.maskWords;
async function loadFonts(list,sample){try{const fam=[...new Set(list.map(f=>f[0]))];const href='https://fonts.googleapis.com/css2?'+fam.map(f=>'family='+f.replace(/ /g,'+')+':wght@200;300;400;500;600;700;800;900').join('&')+'&display=block';
  if(!document.querySelector('link[data-cf="'+href+'"]')){const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.dataset.cf=href;document.head.appendChild(l);await new Promise(r=>{l.onload=r;l.onerror=r;setTimeout(r,2500)})}
  await Promise.race([Promise.all(list.map(([f,w])=>document.fonts.load(w+' 100px "'+f+'"',sample))),new Promise(r=>setTimeout(r,3000))])}catch(e){}}
/* where is the subject? brightness/contrast centroid of the first footage frame (16x9 grid) */
function readFrame(bm){try{const c=new OffscreenCanvas(32,18),x=c.getContext('2d');x.drawImage(bm,0,0,32,18);const d=x.getImageData(0,0,32,18).data,L=[];
  for(let i=0;i<576;i++)L.push((.2126*d[i*4]+.7152*d[i*4+1]+.0722*d[i*4+2])/255);return L}catch(e){return null}}
function subject(L){if(!L)return null;let m=0;for(const v of L)m+=v;m/=576;let sx=0,sy=0,sw=0;
  for(let y=0;y<18;y++)for(let x0=0;x0<32;x0++){const w=Math.max(0,L[y*32+x0]-m);sx+=w*x0;sy+=w*y;sw+=w}
  return {L,mean:m,cx:sw>1e-3?sx/sw/31:.5,cy:sw>1e-3?sy/sw/17:.5,str:sw/576}}
const lin=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
function region(fr,x0,x1,y0,y1){if(!fr)return .3;let s=0,n=0;for(let y=Math.max(0,Math.floor(y0*18));y<Math.min(18,Math.ceil(y1*18));y++)for(let x=Math.max(0,Math.floor(x0*32));x<Math.min(32,Math.ceil(x1*32));x++){s+=lin(fr.L[y*32+x]);n++}return n?s/n:.3}
/* periodic particle fields (all motion in whole cycles of the loop) */
function field(S,kind,{n=400,color='#ffffff',ac='#ffd27a',ac2='#7cf5ff',e=.5,seed=3}={}){
  const cfg={dust:{n,size:1,op:.35,rise:0,wob:.6,spread:[26,15,10]},embers:{n:Math.round(n*.6),size:1.3,op:.55,rise:1,wob:.5,spread:[26,16,8],col:'#ffb36b'},
    snow:{n:n*3,size:1.5,op:.7,rise:-1,wob:.5,spread:[30,18,14],col:'#ffffff'},glitter:{n:n*2,size:1.1,op:.6,rise:-1,wob:.3,spread:[26,16,8],col:ac,tw:1},
    bokeh:{n:60,size:38,op:.16,rise:0,wob:.8,spread:[30,16,6],z:-12,col:ac}}[kind];if(!cfg)return null;
  const N=cfg.n,p=K.points(N,{size:cfg.size,color:'#ffffff'}),R=K.rng(seed),b=[],pos=p.geometry.attributes.position.array,al=p.geometry.attributes.al.array,sz=p.geometry.attributes.sz.array,col=p.geometry.attributes.color.array;
  const ca=new THREE.Color(cfg.col||color),cb=new THREE.Color(ac2);
  for(let i=0;i<N;i++){const sp=cfg.spread;b.push([(R()-.5)*sp[0],(R()-.5)*sp[1],(cfg.z||0)+(R()-.5)*sp[2]-2,1+Math.floor(R()*2),R()*TAU,.25+R()*.75,1+Math.floor(R()*2)]);sz[i]=.35+R()*1.2;const q=kind==='bokeh'&&i%3===0?cb:ca;col.set([q.r,q.g,q.b],i*3)}
  p.geometry.attributes.color.needsUpdate=true;S.add(p);const H=cfg.spread[1]+4;
  p.tick=(ph,fade)=>{const cyc=ph/TAU;for(let i=0;i<N;i++){const q=b[i];let y=q[1];if(cfg.rise){y=((q[1]+H/2+cfg.rise*q[6]*cyc*H*.5)%H+H)%H-H/2}
    pos[i*3]=q[0]+Math.sin(ph*q[3]+q[4])*cfg.wob;pos[i*3+1]=y+Math.cos(ph*q[3]+q[4]*1.3)*cfg.wob*.6;pos[i*3+2]=q[2];
    const edge=cfg.rise?Math.min(1,(H/2-Math.abs(y))/2):1;al[i]=cfg.op*q[5]*fade*edge*(cfg.tw?.35+.65*Math.max(0,Math.sin(ph*q[3]*3+q[4]*7)):.6+.4*Math.sin(ph*q[3]*2+q[4]*2))}
    p.geometry.attributes.position.needsUpdate=true;p.geometry.attributes.al.needsUpdate=true};return p}

/* brand palette from the logo: dominant saturated hues (up to 4), in reading order of strength */
function logoPalette(bm){try{const w=96,h=Math.max(8,Math.round(96*bm.height/bm.width)),c=new OffscreenCanvas(w,h),x=c.getContext('2d');x.drawImage(bm,0,0,w,h);const d=x.getImageData(0,0,w,h).data,bins={};
  for(let i=0;i<w*h;i++){const a=d[i*4+3];if(a<140)continue;const r=d[i*4]/255,g=d[i*4+1]/255,b=d[i*4+2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),sat=mx?(mx-mn)/mx:0;if(sat<.28||mx<.25)continue;
    let hh=mx===r?((g-b)/(mx-mn))%6:mx===g?(b-r)/(mx-mn)+2:(r-g)/(mx-mn)+4;hh=((hh*60)+360)%360;const k=Math.floor(hh/30);const B=bins[k]||(bins[k]={n:0,r:0,g:0,b:0});B.n++;B.r+=r;B.g+=g;B.b+=b}
  const tot=Object.values(bins).reduce((s,b)=>s+b.n,0);return Object.values(bins).filter(b=>b.n>tot*.06).sort((a,b)=>b.n-a.n).slice(0,4).map(b=>'#'+[b.r,b.g,b.b].map(v=>Math.round(v/b.n*255).toString(16).padStart(2,'0')).join(''))}catch(e){return []}}
const PANELFS=`uniform sampler2D a,b;uniform float m,has,pa,shape,prog,zoom,op;uniform vec3 edge;varying vec2 v;
float rb(vec2 p,vec2 s,float r){vec2 q=abs(p)-s+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
void main(){vec2 p=v-.5;float sd;if(shape<.5){sd=rb(p*vec2(pa,1.),vec2(pa*.5,.5),.06);}else if(shape<1.5){sd=length(p)-.5;}else{vec2 q=vec2(p.x+(p.y)*.28/pa,p.y);sd=rb(q*vec2(pa,1.),vec2(pa*.5-.1,.5),.02);}
 float in1=1.-smoothstep(-.004,.004,sd);float bd=(1.-smoothstep(.0,.008,abs(sd+.006)))*in1;
 vec2 q=p;float r=pa/(16./9.);if(r<1.)q.x*=r;else q.y/=r;q=q/zoom+.5;vec2 tq=vec2(q.x,1.-q.y);
 vec3 c=texture2D(a,tq).rgb;if(m>0.)c=mix(c,texture2D(b,tq).rgb,m);if(has<.5)c=vec3(.05);c=c*.92+bd*edge*.9;float rv=smoothstep(-.02,.02,prog*1.04-v.y);gl_FragColor=vec4(c,in1*op*rv);}`;

async function compose(canvas,F,A){
  const lk={layout:'auto',font:'heebo',reveal:'maskWords',energy:.5,light:'none',fx:'dust',rule:false,camera:'push',dark:.45,blur:2,sat:1,tint:null,...(A.look||F.look||{})};
  const PANEL={window:0,circle:1,strip:2}[lk.panel];if(PANEL!=null){if(!lk.bg||lk.bg==='footage')lk.bg='liquid';lk.overlay=0;lk.layout=K.he(String(F.title||F.kicker||''))?'right':'left'}
  const e=K.cl(+lk.energy||0,0,1),I=A.intro,ac=hex(F.accent,'#e8d9b0'),ac2=hex(F.accent2,'#8a8f9c'),calm=e<.35;
  const FT=FONTS[lk.font]||FONTS.heebo,kf=calm?FT:(FT[0]==='Karantina'||FT[0]==='Amatic SC'?['Heebo',700]:FT);
  await loadFonts([FT,kf,[kf[0],Math.min(700,kf[1])],[FT[0],Math.min(500,FT[1])],['Heebo',500],['Heebo',700]],[F.title,F.kicker,F.sub].filter(Boolean).join(' ')+' Aa');
  const camZ=15,fov=36,st=K.stage(canvas,{bg:'#000000',fov,bloom:{s:.12+.45*e,r:.38,th:.93},shadows:false,exposure:1}),{S,C}=st;C.position.set(0,0,camZ);C.lookAt(0,0,0);
  const DUO=lk.grade==='duotone',fg=K.footage(S,{dark:1,vig:.55+.2*(1-e),blur:+lk.blur||0,sat:DUO?0:lk.sat==null?1:+lk.sat,tint:DUO?hex(F.accent,'#3b6ef5'):hex(lk.tint,'#000000'),tintA:DUO?.6:lk.tint?.22:0});
  const vw=2*camZ*Math.tan(fov*Math.PI/360)*16/9,vh=vw*9/16;
  const ST=String(F.title||''),ISNUM=/\d/.test(ST)&&/^[\d.,+%$₪\s]+$/.test(ST);if(lk.reveal==='count'&&!ISNUM)lk.reveal='rise';
  const SCR=lk.reveal==='scramble',CNT=lk.reveal==='count',GL=lk.reveal==='glitch',SNAP=lk.reveal==='snap';
  const WAVE=lk.hold==='wave'&&e>.15&&!CNT,RC0=rec(lk.reveal),unitOf=r=>WAVE||SCR||CNT?'char':r.unit==='char'?'char':r.unit==='line'?'line':'word',shadow='rgba(0,0,0,.55)';
  const tf=(s,o)=>K.typeFX(s,{font:o.font||FT[0],weight:o.weight||FT[1],...o});
  const FILL={gold:['#fff1c4','#c08a2b'],silver:['#ffffff','#98a2ae'],accent:[hex(F.accent,'#ffffff'),hex(F.accent,'#ffffff')]}[lk.fill]||null;
  const BGK={aurora:0,silk:1,nebula:2,liquid:3,brand:4}[lk.bg];let bgM=null;const BRC=new THREE.Color(hex(F.accent2,'#ff5a1f')),INK=BGK===4&&(.2126*BRC.r+.7152*BRC.g+.0722*BRC.b)>.28;
  if(BGK!=null){const c0=BGK===4?BRC.clone():new THREE.Color('#03050c').lerp(new THREE.Color(ac2),.1);bgM=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{ph:{value:0},fade:{value:0},mode:{value:BGK},asp:{value:16/9},c0:{value:c0},c1:{value:new THREE.Color(ac)},c2:{value:new THREE.Color(ac2)}},depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,.999,1.);}',fragmentShader:BGFS}));bgM.frustumCulled=false;bgM.renderOrder=-999;S.add(bgM)}
  const OV=bgM?K.cl(+lk.overlay||0,0,.6):0;if(OV){fg.renderOrder=-998;fg.material.transparent=true;fg.material.blending=THREE.AdditiveBlending;fg.material.depthTest=false}
  const titleC=INK?'#0d0d10':FILL?FILL[0]:calm?'#f4efe4':'#ffffff',TAG=!!lk.tag&&!!F.kicker;
  const acL=(()=>{const c=new THREE.Color(ac);return .2126*c.r+.7152*c.g+.0722*c.b})(),kc=acL<.35?'#'+new THREE.Color(ac).lerp(new THREE.Color('#ffffff'),.5).getHexString():ac;
  const kick=F.kicker?tf(F.kicker,{px:120,h:.64,font:kf[0],weight:Math.min(700,kf[1]),color:INK&&!TAG?'#0d0d10':TAG?'#0b0b10':kc,shadow:TAG||INK?null:'rgba(0,0,0,.6)',ls:K.he(F.kicker)?0:120*.22,emissive:.95,unit:'line'}):null;
  const title=F.title?tf(F.title,{px:260,h:(lk.reveal==='count'?3.6:2.1+.9*e),color:titleC,color2:INK?titleC:FILL?FILL[1]:calm?'#e6dfd0':titleC,glow:null,shadow:INK?null:shadow,ls:K.he(F.title)?0:-260*.015,emissive:calm?.9:.86,unit:unitOf(RC0)}):null;
  const RC=WAVE&&RC0.unit!=='char'?{...RC0,unit:'char',st:Math.min(.05,(RC0.st*Math.max(1,String(F.title||'').split(/\s+/).length))/Math.max(1,(title&&title.n)||1)+.012)}:RC0;
  /* scramble / counter: ghost glyphs from a pool rendered in the same face and size, swapped per frame */
  const tOpt={px:260,h:(CNT?3.6:2.1+.9*e),color:titleC,shadow:INK?null:shadow,emissive:calm?.9:.86,unit:'char'};
  const mkPool=chars=>{const g=tf(chars,tOpt);return g};
  const gOff=pm=>pm.userData.gc-pm.userData.x0,ghostOf=pg=>{const m0=pg.parts[0],mat=m0.material.clone();mat.uniforms.map.value=m0.material.uniforms.map.value;mat.uniforms.mode.value=1;mat.uniforms.p.value=1;const m=new THREE.Mesh(m0.geometry,mat);m.renderOrder=21;m.visible=false;return m};
  let pool=null,ghosts=null;const hsh=(a,b)=>{let x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x)};
  if(title&&(SCR||CNT)){pool=mkPool(CNT?'0123456789':(K.he(ST)?'אבגדהוזחטיכלמנסעפצקרשת':'ABCDEFGHJKLMNPRSTUVWXYZ0123456789#%&'));ghosts=title.parts.map(m=>{const g=ghostOf(pool);title.add(g);return g})}
  const showG=(g,m,pm)=>{g.geometry=pm.geometry;g.position.x=m.userData.gc-gOff(pm)};
  const sub=F.sub?tf(F.sub,{px:130,h:.68,font:calm?FT[0]:'Heebo',weight:calm?Math.min(500,FT[1]):500,color:INK?'#16161a':'#ffffff',shadow:INK?null:'rgba(0,0,0,.7)',ls:K.he(F.sub)?0:130*.06,emissive:.86,unit:'line'}):null;
  const logo=A.logo?K.logoFX(A.logo,{h:1.1,glow:ac}):null;
  const ruleM=lk.rule&&lk.ornament!=='stars'?new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:ac,transparent:true,opacity:0,depthWrite:false,toneMapped:false})):null;
  const orn=lk.ornament==='stars'?tf('★ ★ ★ ★ ★',{px:90,h:.56,font:'Heebo',weight:400,color:ac,shadow:null,emissive:.95,unit:'line'}):null;
  const tagM=TAG?new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:ac,transparent:true,opacity:0,depthWrite:false,toneMapped:false})):null;if(tagM)tagM.renderOrder=19;
  if(title&&INK)title.u.edge.value.set('#0d0d10');else if(title&&!FILL)title.u.edge.value.set(calm?'#8a8478':e>.6?hex(F.accent2,'#ffffff'):'#ffffff');
  const B=new THREE.Group();S.add(B);[logo,kick,title,orn,sub,ruleM,tagM].filter(Boolean).forEach(g=>B.add(g));
  /* brand language: palette from the logo drives the motif (the leading element) */
  const PAL0=A.logo?logoPalette(A.logo):[],PAL=PAL0.length>=2?PAL0:[ac,ac2,'#'+new THREE.Color(ac).lerp(new THREE.Color('#ffffff'),.4).getHexString()];
  const MOT=lk.motif&&lk.motif!=='none'?lk.motif:null,mot=new THREE.Group();S.add(mot);const mm=[],mb=c=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
  if(MOT==='dots'){const nd=Math.max(3,Math.min(4,PAL.length));for(let i=0;i<nd;i++){const d=new THREE.Mesh(new THREE.CircleGeometry(.3,40),mb(PAL[i%PAL.length]));d.renderOrder=18;mot.add(d);mm.push(d)}}
  if(MOT==='stripes'){for(let i=0;i<4;i++){const d=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mb(PAL[i%PAL.length]));d.renderOrder=-5;mot.add(d);mm.push(d)}}
  if(MOT==='rings'){for(let i=0;i<3;i++){const d=new THREE.Mesh(new THREE.RingGeometry(1,1.05,96,1,0,Math.PI*1.35),mb(PAL[i%PAL.length]));d.renderOrder=-5;mot.add(d);mm.push(d)}}
  if(MOT==='bars'){for(let i=0;i<28;i++){const d=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mb(PAL[i%PAL.length]));d.geometry.translate(0,.5,0);d.renderOrder=-5;mot.add(d);mm.push(d)}}
  let arcG=null;if(MOT==='arc'){const d=new THREE.Mesh(new THREE.BufferGeometry(),mb(PAL[0]));d.renderOrder=-4;mot.add(d);mm.push(d)}
  /* media layer: footage inside a framed window beside the words */
  let pnl=null;if(PANEL!=null){const fu=fg.u;pnl=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({uniforms:{a:fu.a,b:fu.b,m:fu.m,has:fu.has,pa:{value:1},shape:{value:PANEL},prog:{value:0},zoom:{value:1.1},op:{value:1},edge:{value:new THREE.Color(ac)}},transparent:true,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:PANELFS}));pnl.renderOrder=-3;S.add(pnl);fg.visible=false}
  /* scrim */
  const sv=(()=>{const cv=new OffscreenCanvas(256,128),x=cv.getContext('2d'),g=x.createRadialGradient(128,64,0,128,64,128);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.6,'rgba(0,0,0,.7)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,256,128);return new THREE.CanvasTexture(cv)})();
  const scrim=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:sv,transparent:true,depthWrite:false,opacity:0,toneMapped:false}));scrim.position.z=-1.5;scrim.renderOrder=-10;S.add(scrim);
  /* light + fx blocks */
  let rays=null,spots=null,halo=null,flare=null;
  if(lk.light==='rays'){rays=K.rays(e<.4?9:16,{color:ac,len:34,width:2.6,op:.05+.12*e});rays.position.set(0,12,-4);S.add(rays)}
  if(lk.light==='spots'){spots=[-1,1].map(s=>{const r=K.rays(5,{color:'#fff1c9',len:40,width:3.2,op:.05+.05*e,seed:s>0?3:8});r.position.set(s*11,13,-5);S.add(r);return r})}
  let rings=null;if(lk.light==='ripple'){const rt=(()=>{const c=new OffscreenCanvas(256,256),x=c.getContext('2d');x.strokeStyle='#fff';x.lineWidth=5;x.shadowColor='#fff';x.shadowBlur=14;x.beginPath();x.arc(128,128,108,0,TAU);x.stroke();return new THREE.CanvasTexture(c)})();
    rings=[0,1,2].map(()=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:rt,color:ac,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));m.position.z=-2.5;S.add(m);return m})}
  if(lk.light==='halo'||lk.light==='rays'){halo=K.glow(ac,18,0);halo.position.z=-3;S.add(halo)}
  if(lk.light==='sweep'||e>.55){flare=K.flare(ac2,{w:26,h:.3});S.add(flare)}
  const fxs=String(lk.fx||'').split(/[,+ ]+/).filter(Boolean);const fields=fxs.map((f,i)=>field(S,f,{n:Math.round(260+400*e),ac,ac2,e,seed:7+i})).filter(Boolean);
  let prop=null;const PR=lk.prop;if(PR&&PR!=='none'){S.add(new THREE.AmbientLight('#ffffff',1.1));const dl2=new THREE.DirectionalLight('#ffffff',2);dl2.position.set(4,6,8);S.add(dl2);
    if(PR==='airplane'){prop=K.airplane({body:'#f3f5fa',accent:hex(F.accent2,'#1f4aa8')});prop.scale.setScalar(.4);if(K.he(F.title||''))prop.rotation.y=Math.PI;S.add(prop)}
    else if(PR==='trophy'){prop=K.trophy({color:hex(F.accent,'#ffcf5a'),s:1.25});S.add(prop)}
    else if(PR==='balloons'){prop=new THREE.Group();const cs=[ac,ac2,'#ff5c8a','#ffd166','#4cc9f0'];for(let i=0;i<7;i++){const b=K.balloon({color:cs[i%cs.length],r:.85});b.userData={x:(i/6-.5)*22+(i%2?1:-1)*.8,ph:i*.9,sp:1+(i%3)};prop.add(b)}S.add(prop)}}
  let vtx=null,vq=null,vN=0;if(fxs.includes('vortex')){vN=2200;vtx=K.points(vN,{size:2,color:ac});const R=K.rng(55);vq=[];for(let i=0;i<vN;i++){vq.push([1.5+Math.pow(R(),.7)*13,Math.floor(R()*3)*TAU/3+(R()-.5)*.5,(R()-.5)*2,1+Math.floor(R()*3),R()*TAU]);vtx.geometry.attributes.sz.array[i]=.4+R()*1.2}S.add(vtx)}
  const cols=[ac,ac2,'#ffffff','#ff5c8a','#ffd166'];let conf=null,rain=null,rp=null,fw=null;
  if(fxs.includes('confetti')){S.add(new THREE.AmbientLight('#ffffff',1.6));const dl=new THREE.DirectionalLight('#ffffff',2.2);dl.position.set(3,5,8);S.add(dl);conf=K.confetti(700,{colors:cols,size:.16,gravity:2.2});S.add(conf);rain=K.confetti(380,{colors:cols,size:.13,gravity:0,seed:31});S.add(rain);const r=K.rng(77);rp=[];for(let i=0;i<380;i++)rp.push([(r()-.5)*26,r()*16,-2-r()*8,1+Math.floor(r()*2),r()])}
  if(fxs.includes('fireworks')){const N=320;fw=[[-6,3.5,-7,0,0],[5.5,4.2,-8,.25,1],[-2,5.2,-9,.5,2],[7,2,-8,.75,3]].map(([x,y,z,o,ci],j)=>{const p=K.points(N,{size:2.4,color:'#ffffff'}),R=K.rng(40+j),v=[],cc=new THREE.Color(cols[ci]),c=p.geometry.attributes.color.array;
    for(let i=0;i<N;i++){const th=R()*TAU,ph=Math.acos(2*R()-1),s=2.1+R()*.6;v.push([Math.sin(ph)*Math.cos(th)*s,Math.cos(ph)*s,Math.sin(ph)*Math.sin(th)*s]);c.set([cc.r,cc.g,cc.b],i*3)}p.geometry.attributes.color.needsUpdate=true;S.add(p);return {p,v,o:[x,y,z],off:o,N}})}
  /* layout: decided on the first frame that has footage (or immediately when there is none) */
  let laid=false,need=.5,blk={x:0,y:0,w:0,h:0},acc=null,accN=0,pan=0,panT=0;const zoomR=1.42;
  const lay=fr=>{laid=true;let L=lk.layout;if(L==='auto'){if(!fr||fr.str<.003)L='center';else if(fr.cx>.6)L='left';else if(fr.cx<.4)L='right';
      else{/* subject in the middle: reframe it to one third (eased camera move) and put the words on the other side */const to=fr.cx>=.5?.32:.68;pan=K.cl(fr.cx-.5-(to-.5)/zoomR,-.5+.5/zoomR+.01,.5-.5/zoomR-.01);L=to<.5?'right':'left';const sh=(to-fr.cx);fr={...fr,L:fr.L.map((v,i)=>{const x=i%32,sx=Math.round(x-sh*31);return sx>=0&&sx<32?fr.L[(i-x)+sx]:0})}}}
    const side=L==='left'||L==='right',maxW=side?vw*.46:vw*.84,items=[logo,kick,title,orn,sub].filter(Boolean);
    items.forEach(g=>{const s0=g.userData.s0||(g.userData.s0=1);const w=g.width/s0,mw=g===logo?Math.min(maxW,vw*.3):maxW;const s=w>mw?mw/w:1;g.scale.setScalar(s);g.userData.s0=s;g.width=w*s;g.height=(g.height/s0)*s});
    const gap=g=>g===logo?.55:g===kick?(TAG?.5:.34):g===title?(ruleM&&!orn?.62:.4):g===orn?.36:0,tot=items.reduce((a,g)=>a+g.height+gap(g),0)+(ruleM?.0:0);
    const he=K.he(F.title||F.kicker||''),align=side||L==='top'||L==='bottom'?(L==='left'?(he?'right':'left'):L==='right'?(he?'right':'left'):'center'):'center';
    const bw=Math.max(...items.map(g=>g.width));const m=vw*.05;
    const cx=L==='left'?-vw/2+m+bw/2:L==='right'?vw/2-m-bw/2:0,top=L==='top'?vh/2-vh*.09:L==='bottom'?-vh/2+vh*.1+tot:tot/2+.15;
    let y=top;items.forEach(g=>{g.position.y=y-g.height/2;g.position.x=align==='center'?cx:align==='right'?cx+bw/2-g.width/2:cx-bw/2+g.width/2;
      if(g===title&&ruleM){const rw=Math.min(2.6,bw*.3);ruleM.scale.set(rw,.035,1);ruleM.userData={w:rw,x:align==='center'?cx:align==='right'?cx+bw/2-rw/2:cx-bw/2+rw/2,dir:align==='right'?1:align==='left'?-1:0};ruleM.position.set(ruleM.userData.x,y-g.height-.3,0)}
      y-=g.height+gap(g)});
    if(tagM&&kick){tagM.scale.set(kick.width+.55,kick.height*1.05,1);tagM.position.set(kick.position.x,kick.position.y,-.05);tagM.userData={w:kick.width+.55,x:kick.position.x,dir:align==='right'?1:align==='left'?-1:0}}
    blk={x:cx,y:top-tot/2,w:bw,h:tot};scrim.scale.set(Math.min(vw*1.1,bw*1.5+4),tot*1.8+2.4,1);scrim.position.set(cx,blk.y,-1.5);
    if(halo)halo.position.set(cx,title?title.position.y:blk.y,-3);if(flare)flare.position.set(cx,title?title.position.y:0,.5);
    if(pnl){const sh=PANEL,w=sh===1?vh*.62:sh===2?vw*.34:vw*.4,h=sh===1?vh*.62:sh===2?vh*.86:vh*.62,px=(L==='right'?-1:1)*(vw/2-vw*.05-w/2);pnl.scale.set(w,h,1);pnl.position.set(px,0,-.3);pnl.material.uniforms.pa.value=w/h;pnl.userData={x:px}}
    if(MOT==='arc'&&title){const he2=title.he,x0=blk.x-blk.w/2-.3,x1=blk.x+blk.w/2+.3,yb=sub?sub.position.y-sub.height*.5-.45:title.position.y-title.height*.62,pts=[];for(let i=0;i<=64;i++){const u=i/64,xx=x0+(x1-x0)*u;pts.push(new THREE.Vector3(xx,yb-.35*Math.sin(Math.PI*u)+.25*u*(he2?-1:1),0))}
      const crv=new THREE.CatmullRomCurve3(he2?pts.reverse():pts);mm[0].geometry=new THREE.TubeGeometry(crv,128,.045,8,false);mm[0].userData.cnt=mm[0].geometry.index.count}
    const u0=(cx-bw/2)/vw+.5,u1=(cx+bw/2)/vw+.5,v0=.5-(top)/vh,v1=.5-(top-tot)/vh,lum=fr?region(fr,u0,u1,v0,v1):(typeof A.lum==='number'?A.lum:.3);
    if(fr&&fr.mean>.3)dark=Math.min(.75,dark+(fr.mean-.3)*.9);need=K.cl(1-.16/Math.max(lum*(1-dark),.02),.2,.85);if(bgM)need=Math.max(need,FILL?.62:.42);if(INK)need=0};
  /* timeline (calm slides breathe slower) */
  const sp=calm?1.35:1,T0=.9*sp,kickT=T0,titleT=T0+(kick?.45*sp:0),nT=(title&&title.n)||1,stS=Math.min(.06,1.2/nT),tEnd=SCR?titleT+.35+stS*(nT-1)+.45:CNT?titleT+2.2:titleT+RC.dur+RC.st*Math.max(0,nT-1),ruleT=tEnd-.2,subT=tEnd+.05,logoT=T0-.1;
  const POP=titleT+.25;let dark=K.cl(+lk.dark||.45,0,.9);const zoom0=1.04+.1*e;
  return t=>{const ph=TAU*(t-I)/A.loop,amp=K.k(t,I-2.2,I-.2),f=fg.u;if(!laid){const Tdec=T0-.15,L0=A.bg&&!bgM?readFrame(A.bg):null;if(L0){if(!acc)acc=L0.map(()=>0);L0.forEach((v,i)=>acc[i]+=v);accN++}
      if(t>=Tdec||lk.layout!=='auto'){panT=t;lay(accN?subject(acc.map(v=>v/accN)):null)}}fg.feed(A);if(bgM){const u=bgM.material.uniforms;u.ph.value=ph;u.fade.value=K.ez.calmIn(K.k(t,0,1.8*sp));}
    /* up from black, push in (settles before the hold) */
    f.dark.value=OV?1-OV*K.ez.calmIn(K.k(t,0,1.8*sp)):dark+(1-dark)*(1-K.ez.calmIn(K.k(t,0,1.8*sp)));const rf=pan?E.io3(K.k(t,panT,panT+1.6)):0,zr=1+(zoomR-1)*rf;f.zoom.value=(zoom0-(zoom0-1.02)*E.io3(K.k(t,0,I-.3))+.006*e*Math.sin(ph)*amp)*zr;f.pan.value.set(pan*rf,0);
    if(lk.camera!=='still'){C.position.set(.22*e*Math.sin(ph)*amp,.1*e*Math.cos(ph)*amp-.1*e*amp,camZ+(lk.camera==='push'?.9*(1-E.io3(K.k(t,0,I-.3))):0));C.lookAt(blk.x*.04,0,0)}
    if(logo){logo.u.rev.value=E.io3(K.k(t,logoT,logoT+1.4*sp));logo.u.glow.value=0}
    if(kick)kick.at(t,kickT,'soft'===lk.reveal||calm?rec('veil'):rec('maskLines'));
    if(title&&SCR){title.parts.forEach((m,j)=>{const i=m.userData.i,lock=titleT+.35+i*stS,U=m.material.uniforms,g=ghosts[j];U.mode.value=1;const on=t>=titleT&&t<lock;U.p.value=t>=lock?1:0;
        g.visible=on;if(on){showG(g,m,pool.parts[Math.floor(hsh(i,Math.floor(t*16))*pool.n)]);g.material.uniforms.op.value=.55+.3*hsh(i+9,Math.floor(t*16))}})}
    else if(title&&CNT){const pr=E.o3(K.k(t,titleT,titleT+2.2)),dn=ST.replace(/[^\d.]/g,''),dec=(dn.split('.')[1]||'').length,v=(parseFloat(dn)||0)*pr,ds=v.toFixed(dec).replace('.',''),slots=title.parts.filter(m=>/\d/.test(ST[m.userData.i])),fin=pr>=1,fade=E.o3(K.k(t,titleT-.1,titleT+.4));
      const digs=ds.padStart(slots.length,' ').slice(-slots.length);let anyLeft=false;
      title.parts.forEach((m,j)=>{const ch=ST[m.userData.i],U=m.material.uniforms,g=ghosts[j];U.mode.value=1;if(/\d/.test(ch)){const si=slots.indexOf(m),d=digs[si];U.p.value=fin?fade:0;g.visible=!fin&&d!==' '&&t>=titleT-.1;if(g.visible){showG(g,m,pool.parts[+d]);g.material.uniforms.op.value=fade;anyLeft=true}}
        else{U.p.value=(/[,.]/.test(ch)?(fin||anyLeft):true)?fade:0}})}
    else if(title){if(lk.reveal==='light'){const rv=E.io3(K.k(t,titleT,titleT+1.6));title.u.rev.value=rv;if(flare){flare.position.x=blk.x+(title.he?1:-1)*(title.width/2-title.width*rv);flare.material.opacity=rv>0&&rv<1?.9:0}}else{title.at(t,titleT,RC);
        if(SNAP)title.parts.forEach(m=>{const pr=K.cl((t-titleT-m.userData.i*RC.st)/RC.dur,0,1),q=1-K.ez.settle(pr);m.scale.set(Math.max(.001,1+.8*q),Math.max(.001,1-.45*q),1)});
        if(GL){const bursts=[titleT+.05,titleT+.32,titleT+.6,tEnd+.35];let b=0;bursts.forEach(t0=>{if(t>=t0&&t<t0+.12)b=1});const fr=Math.floor(t*30);
          title.parts.forEach(m=>{const i=m.userData.i;m.position.x=m.userData.x0+(b?(hsh(i,fr)-.5)*.35*title.height:0);m.position.y=b&&hsh(i+3,fr)>.6?(hsh(i+5,fr)-.5)*.25*title.height:0});if(b){f.fcol.value.set(hsh(fr,1)>.5?'#ff2bd6':'#2bf2ff')}}}
      title.u.glow.value=0;const sw=K.k(t,tEnd+.5,tEnd+1.4);title.u.shine.value=(lk.light==='sweep'||e>.55)&&sw>0&&sw<1?-.2+1.4*E.sine(sw):-1}
    if(ruleM){const r=E.io3(K.k(t,ruleT,ruleT+.9*sp)),u=ruleM.userData;ruleM.scale.x=Math.max(.001,u.w*r);ruleM.position.x=u.x+u.dir*(u.w-u.w*r)/2;ruleM.material.opacity=.9*r}
    if(sub)sub.at(t,subT,calm?rec('veil'):rec('maskLines'));
    if(tagM){const r=E.io3(K.k(t,kickT-.35,kickT+.25)),u=tagM.userData;tagM.scale.x=Math.max(.001,u.w*r);tagM.position.x=u.x+(u.dir||0)*(u.w-u.w*r)/2;tagM.material.opacity=.95*Math.min(1,r*3)}
    if(orn)orn.at(t,ruleT,'soft');
    if(title&&lk.shine!==false&&lk.fill!=='accent'&&!CNT){const dur=calm?2.2:1.2,sw2=K.k(((t-I)%A.loop+A.loop)%A.loop,A.loop*.35,A.loop*.35+dur);if(t>I&&sw2>0&&sw2<1)title.u.shine.value=-.2+1.4*E.sine(sw2)}
    if(WAVE&&title){const A0=title.height*(.03+.05*e)*amp;title.parts.forEach(m=>{m.position.y=A0*Math.sin(ph*3-m.userData.i*.42)})}
    B.scale.setScalar(1+(lk.hold==='none'||WAVE?0:.004+.008*e)*Math.sin(ph)*amp);B.position.y=.04*Math.sin(ph)*amp;
    scrim.material.opacity=need*E.o3(K.k(t,T0-.6,T0+1));
    if(rays){rays.children.forEach(m=>{m.rotation.z=m.userData.r0+Math.sin(ph+m.userData.ph)*.06;m.material.opacity=m.userData.o*(.75+.25*Math.sin(ph*2+m.userData.ph*2))*E.o3(K.k(t,.6,3))})}
    if(spots)spots.forEach((r,i)=>{r.rotation.z=(i?-1:1)*(.55-.5*E.io3(K.k(t,.4,3.2)))+(i?-1:1)*.05*Math.sin(ph+i)*amp;r.children.forEach(m=>m.material.opacity=m.userData.o*E.o3(K.k(t,.2,1.5))*(.85+.15*Math.sin(ph*2+i)))});
    if(rings){const on=E.o3(K.k(t,titleT,tEnd+.8)),cyc=((t-I)/A.loop%1+1)%1;rings.forEach((m,j)=>{const u=((cyc*2+j/3)%1+1)%1;m.position.set(blk.x,title?title.position.y:blk.y,-2.5);m.scale.setScalar((title?title.width:6)*(.5+1.1*u));m.material.opacity=on*(.05+.14*e)*Math.sin(Math.PI*u)})}
    if(halo)halo.material.opacity=(.04+.26*e)*E.o3(K.k(t,titleT,tEnd+.6))*(1+.12*Math.sin(ph)*amp);
    if(flare&&lk.reveal!=='light'){const s1=K.k(t,tEnd+.5,tEnd+1.4);flare.material.opacity=e>.55?.28*Math.sin(Math.PI*s1):0;flare.position.x=blk.x+(s1-.5)*(title?title.width:6)}
    fields.forEach(p=>p.tick(ph,E.o3(K.k(t,.4,2.4))));
    if(MOT){const on=K.k(t,ruleT-.2,ruleT+1.2),he3=title&&title.he;
      if(MOT==='dots'){const n=mm.length,gap=.75,y0=blk.y-blk.h/2-.75;mm.forEach((d,i)=>{const j=he3?n-1-i:i,lt=K.k(t,ruleT+j*.12,ruleT+j*.12+.55);d.material.opacity=Math.min(1,lt*3);d.scale.setScalar(Math.max(.001,K.ez.settle(lt)));d.position.set(blk.x+(i-(n-1)/2)*gap,y0+.14*Math.sin(ph*2-j*1.1)*amp,0)})}
      else if(MOT==='stripes'){mm.forEach((d,i)=>{const lt=E.io3(K.k(t,T0-.4+i*.12,T0+.9+i*.12)),dir=he3?-1:1;d.scale.set(34,.06+.05*(i%2),1);d.rotation.z=.18*dir;d.position.set(dir*(30*(1-lt))+.6*Math.sin(ph+i)*amp,blk.y-blk.h/2-.5-i*.32,-1.2);d.material.opacity=.75*Math.min(1,lt*2)*(.8+.2*Math.sin(ph*2+i))})}
      else if(MOT==='rings'){mm.forEach((d,i)=>{const lt=E.io3(K.k(t,T0+i*.15,T0+1.4+i*.15)),R0=(blk.h*.62+.8)+i*.55;d.scale.setScalar(R0*(.6+.4*lt));d.position.set(blk.x,title?title.position.y:blk.y,-2);d.rotation.z=(i%2?-1:1)*(ph+(1-lt)*2)+i*2.1;d.material.opacity=.55*lt})}
      else if(MOT==='bars'){const n=mm.length;mm.forEach((d,i)=>{const lt=E.o3(K.k(t,T0+i*.03,T0+.8+i*.03)),hh=(.25+1.1*Math.abs(Math.sin(ph*2+i*.55))*(.4+.6*e))*lt;d.scale.set(vw/n*.55,Math.max(.001,hh),1);d.position.set(-vw/2+(i+.5)*vw/n,-vh/2+.05,-1);d.material.opacity=.7*lt})}
      else if(MOT==='arc'&&mm[0].userData.cnt){const p2=E.io3(K.k(t,ruleT-.3,ruleT+1.1));mm[0].geometry.setDrawRange(0,Math.floor(mm[0].userData.cnt*p2/3)*3);mm[0].material.opacity=.95*(.75+.25*Math.sin(ph*2)*amp)*(p2>0?1:0)}}
    if(pnl){const pr=E.io3(K.k(t,T0-.3,T0+1.1));pnl.material.uniforms.prog.value=pr;pnl.material.uniforms.zoom.value=1.12-.06*E.io3(K.k(t,0,I))+.02*Math.sin(ph)*amp;pnl.position.y=.08*Math.sin(ph)*amp}
    if(prop){const cyc=(((t-I)/A.loop)%1+1)%1,on=E.o3(K.k(t,.8,2.4));
      if(PR==='airplane'){const dir=prop.rotation.y?-1:1,x=dir*(-17+34*cyc),tp=blk.y+blk.h/2,bt=blk.y-blk.h/2,up=vh/2-tp,dn=bt+vh/2,ys=up>dn?tp+up*.5:bt-dn*.5;prop.position.set(x,ys*(camZ+9)/camZ+.4*Math.sin(cyc*Math.PI),-9);prop.rotation.z=.04*Math.sin(ph);prop.rotation.x=.12;prop.visible=on>.01}
      else if(PR==='trophy'){const side=blk.x>0?-1:1;prop.position.set(blk.x+side*(blk.w/2+2.4),(title?title.position.y:0)-1.4,-1);prop.rotation.y=ph;prop.scale.setScalar(1.25*on)}
      else{prop.children.forEach(b=>{const u=b.userData,y=((cyc*u.sp+u.ph/6)%1)*22-13;b.position.set(u.x+Math.sin(ph+u.ph)*.5,y,-5-u.sp);b.rotation.z=.12*Math.sin(ph*2+u.ph)});prop.visible=on>.01}}
    if(vtx){const pos=vtx.geometry.attributes.position.array,al=vtx.geometry.attributes.al.array,on=E.o3(K.k(t,.3,2.5)),cy=title?title.position.y:blk.y;for(let i=0;i<vN;i++){const q=vq[i],a=q[1]+ph+q[0]*.55;pos[i*3]=blk.x+Math.cos(a)*q[0]*1.35;pos[i*3+1]=cy+Math.sin(a)*q[0]*.8;pos[i*3+2]=-7+q[2];al[i]=on*(.25+.6*Math.max(0,Math.sin(ph*q[3]+q[4])))*Math.min(1,q[0]/3)}vtx.geometry.attributes.position.needsUpdate=true;vtx.geometry.attributes.al.needsUpdate=true}
    let fl=0;if(conf){conf.burst(t-POP,[blk.x,title?title.position.y:0,-1],1);conf.visible=t<I;const o=new THREE.Object3D(),cyc=(t-I)/A.loop;
      for(let i=0;i<rp.length;i++){const q=rp[i],yy=((q[1]-cyc*q[3]*16)%16+16)%16-7;o.position.set(q[0]+Math.sin(ph+q[4]*9)*.4,yy,q[2]);o.rotation.set(ph*2+q[4]*7,ph*3+q[4]*5,q[4]*6);o.scale.setScalar(E.o3(K.k(t,POP,POP+1.2)));o.updateMatrix();rain.setMatrixAt(i,o.matrix)}rain.instanceMatrix.needsUpdate=true;
      if(e>.7)fl+=.22*Math.exp(-Math.pow((t-POP)/.12,2))}
    if(fw){const cyc=((t-I)/A.loop%1+1)%1;fw.forEach(s=>{const age=((cyc-s.off)%1+1)%1*A.loop*.5,pos=s.p.geometry.attributes.position.array,al=s.p.geometry.attributes.al.array,a=age,dd=(1-Math.exp(-2.2*a))/2.2,on=E.o3(K.k(t,1,2.5));
      for(let i=0;i<s.N;i++){pos[i*3]=s.o[0]+s.v[i][0]*dd*1.6;pos[i*3+1]=s.o[1]+s.v[i][1]*dd*1.6-.35*a*a;pos[i*3+2]=s.o[2]+s.v[i][2]*dd*1.6;al[i]=on*Math.max(0,1-a/2)*(.6+.4*Math.sin(a*30+i))}
      s.p.geometry.attributes.position.needsUpdate=true;s.p.geometry.attributes.al.needsUpdate=true;fl+=on*Math.max(0,.05-a*.1)})}
    let gfl=0;if(GL){[titleT+.05,titleT+.32,titleT+.6,tEnd+.35].forEach(t0=>{if(t>=t0&&t<t0+.12)gfl=.04})}
    f.flash.value=fl+gfl;if(!gfl)f.fcol.value.set(ac);st.bloom.strength=.12+.45*e+.3*fl;st.render()}}

return {META,light,particles,cinema,celebrate,award,holiday,compose}}
window.__ENG_SRC='self.ENG=('+CueyEngines.toString()+')(self.THREE,self.K);';
