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
};
const hex=(c,d)=>/^#[0-9a-f]{6}$/i.test(String(c||''))?c:d;
/* shared: stage + footage + the hero block (logo / kicker / title / sub) laid out to fit the frame */
function core(canvas,F,A,{bloom={s:.75,r:.5,th:.9},fov=36,grade={},titleColor='#ffffff',titleColor2=null,glow=null,camZ=15}={}){
  const st=K.stage(canvas,{bg:'#000000',fov,bloom,shadows:false,exposure:1}),{S,C}=st;C.position.set(0,0,camZ);C.lookAt(0,0,0);
  const fg=K.footage(S,{dark:.42,vig:.6,...grade});const ac=hex(F.accent,'#ffd27a'),ac2=hex(F.accent2,'#7cf5ff');
  const H=new THREE.Group();S.add(H);const vw=2*camZ*Math.tan(fov*Math.PI/360)*16/9;let y=0;const items={};
  const fit=(g,maxW)=>{if(g.width>maxW){const s=maxW/g.width;g.scale.setScalar(s);g.width*=s;g.height*=s}return g};
  const logo=A.logo?fit(K.logoFX(A.logo,{h:3.4,glow:ac}),vw*.5):null;
  const kick=F.kicker?fit(K.type(F.kicker,{px:130,h:.55,weight:700,color:ac,glow:null,ls:K.he(F.kicker)?0:40,emissive:1}),vw*.7):null;
  const title=F.title?fit(K.type(F.title,{px:260,h:logo?1.35:2.35,color:titleColor,color2:titleColor2||titleColor,glow:glow||ac,emissive:.82}),vw*(logo?.72:.82)):null;
  const sub=F.sub?fit(K.type(F.sub,{px:130,h:logo?.5:.62,weight:500,color:'#ffffff',ls:K.he(F.sub)?0:30,emissive:.85}),vw*.75):null;
  const stack=[logo&&[logo,.55],kick&&[kick,.42],title&&[title,.5],sub&&[sub,0]].filter(Boolean);let tot=0;stack.forEach(([g,gap])=>tot+=g.height+gap);y=tot/2;
  stack.forEach(([g,gap])=>{g.position.y=y-g.height/2;y-=g.height+gap;H.add(g)});Object.assign(items,{logo,kick,title,sub});
  /* scrim: a soft dark pool of shade behind the words so they read on any footage */
  const sv=(()=>{const cv=new OffscreenCanvas(256,128),x=cv.getContext('2d'),g=x.createRadialGradient(128,64,0,128,64,128);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(.55,'rgba(0,0,0,.75)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,256,128);return new THREE.CanvasTexture(cv)})();
  const scrim=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:sv,transparent:true,depthWrite:false,opacity:0,toneMapped:false}));scrim.scale.set(Math.min(vw*1.1,Math.max(...stack.map(([g])=>g.width))*1.6+4),tot*1.9+2.5,1);scrim.position.z=-1.5;scrim.renderOrder=-10;S.add(scrim);
  return {st,S,C,fg,H,ac,ac2,vw,...items,scrim,sc(v,a=.62){scrim.material.opacity=a*v},feed(){fg.feed(A)}}}
/* standard type-in for kicker/sub: fade + tracking */
function soft(g,u){if(!g)return;g.u.op.value=E.o3(u);g.position.x=0;g.scale.x=g.scale.y*(1+.06*(1-E.o3(u)))}
const lp=(t,A)=>{const I=A.intro,L=A.loop;return {I,L,ph:TAU*(t-I)/L,u:t<I?0:((t-I)%L)/L,on:t>=I}};
/* floating dust in light — periodic with the loop (whole multiples of the phase) */
function dust(S,n,{spread=[26,15,10],size=1,color='#ffe9c4',seed=11,op=.4}={}){const p=K.points(n,{size,color}),R=K.rng(seed),b=[];const pos=p.geometry.attributes.position.array,al=p.geometry.attributes.al.array,sz=p.geometry.attributes.sz.array;
  for(let i=0;i<n;i++){b.push([(R()-.5)*spread[0],(R()-.5)*spread[1],(R()-.5)*spread[2]-2,1+Math.floor(R()*2),R()*TAU,.2+R()*.8]);sz[i]=.3+R()*1.2}p.material.uniforms.op.value=op;S.add(p);
  p.tick=ph=>{for(let i=0;i<n;i++){const q=b[i];pos[i*3]=q[0]+Math.sin(ph*q[3]+q[4])*.6;pos[i*3+1]=q[1]+Math.cos(ph*q[3]+q[4]*1.3)*.45;pos[i*3+2]=q[2];al[i]=q[5]*(.55+.45*Math.sin(ph*q[3]*2+q[4]*2))}
    p.geometry.attributes.position.needsUpdate=true;p.geometry.attributes.al.needsUpdate=true};return p}

/* 1 · LIGHT — the title (and logo) are revealed by light: rays from above, a light streak, an edge of light sweeping across the letters */
async function light(canvas,F,A){const c=core(canvas,F,A,{grade:{dark:.5,blur:2}}),{st,S,C,fg,H,ac,ac2}=c;
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
    soft(c.kick,k(t,4.3,5.6));soft(c.sub,k(t,4.7,6));
    const sh=L.on?k(L.u,.25,.55):k(t,5.6,6.9);heros.forEach(g=>g.u.shine.value=sh>0&&sh<1?-.2+1.4*E.io3(sh):-1);
    c.sc(E.o3(k(t,2.6,4.4)));halo.material.opacity=.32*E.o3(k(t,3.4,5))*(1+.12*Math.sin(L.ph));H.position.y=.06*Math.sin(L.ph);st.bloom.strength=.7+.12*Math.sin(L.ph)+.5*Math.exp(-Math.pow((t-4)/.6,2));st.render()}}

/* 2 · PARTICLES — thousands of sparks fly in from depth and assemble the logo / title, then the crisp letters light up */
async function particles(canvas,F,A){const c=core(canvas,F,A,{grade:{dark:.55,blur:2.5}}),{st,S,C,fg,H,ac,ac2}=c;
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
    const sh=L.on?k(L.u,.3,.6):k(t,6.2,7.3);[c.logo,c.title].filter(Boolean).forEach(g=>g.u.shine.value=sh>0&&sh<1?-.2+1.4*E.io3(sh):-1);
    if(!c.logo&&c.title){}soft(c.kick,k(t,5.6,6.8));soft(c.sub,k(t,5.9,7.1));
    c.sc(E.o3(k(t,3,5.2)));ring.material.opacity=.22*Math.exp(-Math.pow((t-4.9)/.7,2))+.08*E.o3(k(t,5,6.5))*(1+.2*Math.sin(L.ph));ring.scale.setScalar(14+6*E.o3(k(t,4.4,6)));
    st.bloom.strength=.75+.35*Math.exp(-Math.pow((t-5)/.6,2))+.1*Math.sin(L.ph);st.render()}}

/* 3 · CINEMA — a deep, extruded title; the camera glides from a low side angle to the hero frame; light sweeps across the face */
async function cinema(canvas,F,A){const c=core(canvas,F,A,{grade:{dark:.5,blur:4.5},titleColor:'#ffffff',titleColor2:'#d9dde6',camZ:15}),{st,S,C,fg,H,ac,ac2}=c;
  const T=c.title||c.logo;const layers=[];if(T&&c.title){for(let i=1;i<=22;i++){const g=K.type(F.title,{px:260,h:A.logo?1.35:2.35,color:'#2a2f3a',color2:'#0d0f14',emissive:.55});
    g.scale.copy(T.scale);g.position.set(T.position.x,T.position.y,-i*.035);g.u.op.value=1;layers.push(g);H.add(g)}}
  const flare=K.flare(ac2,{w:36,h:.5});flare.position.set(0,T?T.position.y:0,.5);S.add(flare);const ds=dust(S,600,{color:'#dfe8ff',op:.4});
  const back=K.glow(ac,30,0);back.position.set(0,T?T.position.y:0,-6);S.add(back);
  const cam=K.camera(C,[{t:0,p:[-9,-2.6,7],look:[0,-.3,0],fov:30},{t:2.6,p:[-6,-1.4,9.5],look:[0,0,0],fov:32},{t:5.2,p:[-1.2,.1,14],look:[0,0,0],fov:35},{t:A.intro,p:[0,0,15],look:[0,0,0],fov:36,e:'o3'}]);
  return t=>{const L=lp(t,A);c.feed();const f=fg.u;f.dark.value=.5+.5*(1-E.o3(k(t,0,1.2)));f.zoom.value=1.2-.12*E.io3(k(t,0,L.I));f.pan.value.set(-.04*(1-E.io3(k(t,0,L.I)))+(L.on?.006*Math.sin(L.ph):0),0);
    cam(t);if(L.on){C.position.x+=Math.sin(L.ph)*.5;C.position.y+=Math.sin(L.ph*2)*.08;C.lookAt(0,0,0)}
    const a=E.o3(k(t,.3,1.6));[c.title,c.logo].filter(Boolean).forEach(g=>{g.u.op.value=a;g.u.rev.value=1});layers.forEach(g=>g.u.op.value=a);
    const sh=L.on?k(L.u,.2,.5):k(t,2.4,4.6);[c.title,c.logo].filter(Boolean).forEach(g=>{g.u.shine.value=sh>0&&sh<1?-.2+1.4*E.io3(sh):-1;g.u.glow.value=.06});
    flare.material.opacity=Math.exp(-Math.pow((sh-.5)/.22,2))*(sh>0&&sh<1?1:0);flare.position.x=(sh-.5)*(T?T.width:10);soft(c.kick,k(t,4.6,5.8));soft(c.sub,k(t,5,6.2));ds.tick(L.ph);
    c.sc(E.o3(k(t,.3,2)),.5);back.material.opacity=.3*E.o3(k(t,3,5))*(1+.15*Math.sin(L.ph));st.bloom.strength=.75+.15*Math.sin(L.ph);st.render()}}

/* 4 · CELEBRATE — fireworks bloom over real footage, a flash, the title pops in with confetti raining through the frame */
async function celebrate(canvas,F,A){const c=core(canvas,F,A,{grade:{dark:.58,blur:1.6},bloom:{s:.8,r:.55,th:.88},glow:'#ffffff'}),{st,S,C,fg,H,ac,ac2}=c;S.add(new THREE.AmbientLight('#ffffff',1.6));const dl0=new THREE.DirectionalLight('#ffffff',2.2);dl0.position.set(3,5,8);S.add(dl0);
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
    const p=E.back(k(t,POP,POP+.7));if(c.title){c.title.scale.setScalar(c.title.userData.s0||(c.title.userData.s0=c.title.scale.x));c.title.scale.multiplyScalar(.6+.4*p);c.title.u.op.value=E.o3(k(t,POP,POP+.3));c.title.u.glow.value=.12*Math.exp(-(t-POP))+.02+.02*Math.sin(L.ph*2)}
    if(c.logo){c.logo.u.op.value=E.o3(k(t,POP-.2,POP+.4));c.logo.scale.setScalar((c.logo.userData.s0||(c.logo.userData.s0=c.logo.scale.x))*(.7+.3*E.back(k(t,POP-.2,POP+.6))))}
    soft(c.kick,k(t,POP+.5,POP+1.5));soft(c.sub,k(t,POP+.8,POP+1.8));const sh=L.on?k(L.u,.55,.8):-1;if(c.title)c.title.u.shine.value=sh>0&&sh<1?-.2+1.4*E.io3(sh):-1;
    c.sc(E.o3(k(t,POP-.6,POP+.4)),.7);halo.material.opacity=.22*E.o3(k(t,POP,POP+.6))*(1+.15*Math.sin(L.ph*2));st.bloom.strength=.8+.3*fl;st.render()}}

/* 5 · AWARD — gold: spotlights sweep the stage, a slow golden ring turns behind a metallic title, glitter falls through the light */
async function award(canvas,F,A){const c=core(canvas,F,A,{grade:{dark:.6,blur:3,sat:.7,tint:'#3a2a10',tintA:.25},titleColor:'#fff4cf',titleColor2:'#c9952f',glow:'#ffcf6b'}),{st,S,C,fg,H,ac}=c;
  const gold='#ffcf6b',env=(()=>{const cv=new OffscreenCanvas(256,128),x=cv.getContext('2d'),g=x.createLinearGradient(0,0,0,128);g.addColorStop(0,'#fff6dc');g.addColorStop(.45,'#6b4a12');g.addColorStop(.55,'#1a1206');g.addColorStop(1,'#d9a441');x.fillStyle=g;x.fillRect(0,0,256,128);
    const t=new THREE.CanvasTexture(cv);t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;return new THREE.PMREMGenerator(st.R).fromEquirectangular(t).texture})();
  const gm=new THREE.MeshStandardMaterial({color:'#e7b75a',metalness:1,roughness:.22,envMap:env,envMapIntensity:1.4});
  const ty=c.title?c.title.position.y:0,ring=new THREE.Mesh(new THREE.TorusGeometry(5.2,.09,24,180),gm),ring2=new THREE.Mesh(new THREE.TorusGeometry(5.6,.035,16,180),gm);ring.position.set(0,ty,-3);ring2.position.copy(ring.position);S.add(ring,ring2);
  S.add(new THREE.AmbientLight('#ffffff',.4));const kl=new THREE.DirectionalLight('#fff0d0',2.2);kl.position.set(4,6,8);S.add(kl);
  const spots=[-1,1].map(s=>{const r=K.rays(5,{color:'#fff1c9',len:40,width:3.2,op:.14,seed:s>0?3:8});r.position.set(s*11,13,-5);S.add(r);return r});
  const gl=K.points(1400,{size:1.1,color:gold}),R=K.rng(9),gp=[];for(let i=0;i<1400;i++)gp.push([(R()-.5)*26,R()*16,(R()-.5)*8-1,.25+R()*.5,R()*TAU]);S.add(gl);const halo=K.glow(gold,24,0);halo.position.set(0,ty,-4);S.add(halo);
  return t=>{const L=lp(t,A);c.feed();const f=fg.u;f.dark.value=.6+.4*(1-E.o3(k(t,0,1.4)));f.zoom.value=1.15-.08*E.io3(k(t,0,L.I));
    C.position.set(Math.sin(L.ph)*.35,.2+Math.cos(L.ph)*.1,16.5-1.5*E.io3(k(t,0,L.I)));C.lookAt(0,0,0);
    spots.forEach((r,i)=>{r.rotation.z=(i?-1:1)*(.55-.5*E.io3(k(t,.4,3.2)))+(i?-1:1)*.06*Math.sin(L.ph+i);r.children.forEach(m=>m.material.opacity=m.userData.o*E.o3(k(t,.2,1.5))*(.85+.15*Math.sin(L.ph*2+i)))});
    const rs=E.io3(k(t,1.4,3.6));ring.scale.setScalar(.3+.7*rs);ring2.scale.setScalar(.2+.8*E.io3(k(t,1.7,4)));ring.rotation.set(.35*Math.sin(L.ph)+(1-rs)*1.4,L.ph+(1-rs)*2,0);ring2.rotation.set(-.3*Math.cos(L.ph),-L.ph,.2);gm.opacity=1;ring.visible=ring2.visible=t>1.3;
    const pos=gl.geometry.attributes.position.array,al=gl.geometry.attributes.al.array;for(let i=0;i<1400;i++){const q=gp[i],yy=((q[1]-(t-L.I)*q[3]*1.4)%16+16)%16-7;pos[i*3]=q[0]+Math.sin(L.ph+q[4])*.3;pos[i*3+1]=yy;pos[i*3+2]=q[2];al[i]=E.o3(k(t,1,3))*(.4+.6*Math.max(0,Math.sin(L.ph*3+q[4]*7)))}
    gl.geometry.attributes.position.needsUpdate=true;gl.geometry.attributes.al.needsUpdate=true;
    const rv=E.io3(k(t,3,4.6));[c.title,c.logo].filter(Boolean).forEach(g=>{g.u.rev.value=rv;g.u.glow.value=.12});const sh=L.on?k(L.u,.3,.6):k(t,5,6.4);[c.title,c.logo].filter(Boolean).forEach(g=>g.u.shine.value=sh>0&&sh<1?-.2+1.4*E.io3(sh):-1);
    c.sc(E.o3(k(t,2.6,4.4)));soft(c.kick,k(t,4.2,5.4));soft(c.sub,k(t,4.6,5.8));halo.material.opacity=.3*E.o3(k(t,3,5))*(1+.12*Math.sin(L.ph));st.bloom.strength=.8+.15*Math.sin(L.ph);st.render()}}

/* 6 · HOLIDAY — warm bokeh and snow; glowing sparks gather into the title / logo; soft golden light breathes */
async function holiday(canvas,F,A){const c=core(canvas,F,A,{grade:{dark:.45,blur:2.2},titleColor:'#ffffff',glow:hex(F.accent,'#ffcf6b')}),{st,S,C,fg,H,ac,ac2}=c;
  const sn=K.points(1600,{size:1.5,color:'#ffffff'}),R=K.rng(14),sp=[];for(let i=0;i<1600;i++){sp.push([(R()-.5)*30,R()*18,(R()-.5)*14-2,.35+R()*.6,R()*TAU]);sn.geometry.attributes.sz.array[i]=.4+R()*1.3}S.add(sn);
  const bk=K.points(70,{size:38,color:ac}),bp=[];for(let i=0;i<70;i++){bp.push([(R()-.5)*30,(R()-.5)*16,-8-R()*10,R()*TAU]);const q=new THREE.Color(i%3?ac:ac2);bk.geometry.attributes.color.array.set([q.r,q.g,q.b],i*3)}bk.geometry.attributes.color.needsUpdate=true;bk.material.uniforms.op.value=.18;S.add(bk);
  const tgt=c.logo||c.title,n=7000,smp=K.sample(A.logo||F.title||'Cuey',{n,h:tgt?tgt.height*(A.logo?1:.78):2,seed:3});const p=K.points(n,{size:1.1,color:'#ffffff'}),pos=p.geometry.attributes.position.array,al=p.geometry.attributes.al.array;
  const s0=[],dl=[];for(let i=0;i<n;i++){s0.push([(R()-.5)*30,10+R()*10,(R()-.5)*10]);dl.push(R())}const cc=new THREE.Color(ac);for(let i=0;i<n;i++)p.geometry.attributes.color.array.set([1,.9+.1*cc.g,.75+.25*cc.b],i*3);p.geometry.attributes.color.needsUpdate=true;H.add(p);
  const ty=tgt?tgt.position.y:0,halo=K.glow(ac,22,0);halo.position.set(0,ty,-3);S.add(halo);
  return t=>{const L=lp(t,A);c.feed();const f=fg.u;f.dark.value=.45+.55*(1-E.o3(k(t,0,1.4)));f.zoom.value=1.14-.1*E.io3(k(t,0,L.I))+(L.on?.01*Math.sin(L.ph):0);
    C.position.set(Math.sin(L.ph)*.35,.1*Math.cos(L.ph),15.5-1.2*E.io3(k(t,0,L.I)));C.lookAt(0,0,0);
    const a=sn.geometry.attributes,sx=a.position.array,sa=a.al.array;for(let i=0;i<1600;i++){const q=sp[i],yy=((q[1]-(t-L.I)*q[3]*1.2)%18+18)%18-8;sx[i*3]=q[0]+Math.sin(L.ph*2+q[4])*.5;sx[i*3+1]=yy;sx[i*3+2]=q[2];sa[i]=E.o3(k(t,.2,1.8))*.8}a.position.needsUpdate=true;a.al.needsUpdate=true;
    const b=bk.geometry.attributes.position.array;for(let i=0;i<70;i++){const q=bp[i];b[i*3]=q[0]+Math.sin(L.ph+q[3])*.8;b[i*3+1]=q[1]+Math.cos(L.ph+q[3])*.5;b[i*3+2]=q[2]}bk.geometry.attributes.position.needsUpdate=true;bk.material.uniforms.op.value=.2*E.o3(k(t,.3,2))*(1+.2*Math.sin(L.ph*2));
    for(let i=0;i<n;i++){const d=dl[i],u=E.io3(k(t,1.2+d*2,3.8+d*2)),q=s0[i],x0=q[0]+Math.sin(t*1.3+d*30)*.6*(1-u),y0=q[1]-(t*1.4)*(1-u)*.5;
      pos[i*3]=x0+(smp.P[i*2]-x0)*u;pos[i*3+1]=y0+(smp.P[i*2+1]+ty-y0)*u+.03*Math.sin(L.ph*2+d*20);pos[i*3+2]=q[2]*(1-u);al[i]=.5*E.o3(k(t,.8+d*2,1.6+d*2))*(1-.6*E.o3(k(t,5.6,6.8)))*(.7+.3*Math.sin(L.ph*4+d*40))}
    p.geometry.attributes.position.needsUpdate=true;p.geometry.attributes.al.needsUpdate=true;
    const rv=E.o3(k(t,5.2,6.4));[c.title,c.logo].filter(Boolean).forEach(g=>{g.u.op.value=rv;g.u.glow.value=.15+.05*Math.sin(L.ph*2)});const sh=L.on?k(L.u,.35,.65):-1;[c.title,c.logo].filter(Boolean).forEach(g=>g.u.shine.value=sh>0&&sh<1?-.2+1.4*E.io3(sh):-1);
    c.sc(E.o3(k(t,3.5,5.5)));soft(c.kick,k(t,5.6,6.8));soft(c.sub,k(t,6,7.2));halo.material.opacity=.3*E.o3(k(t,4.5,6.5))*(1+.15*Math.sin(L.ph));st.bloom.strength=.95+.15*Math.sin(L.ph);st.render()}}

return {META,light,particles,cinema,celebrate,award,holiday}}
window.__ENG_SRC='self.ENG=('+CueyEngines.toString()+')(self.THREE,self.K);';
