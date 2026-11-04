/* Cuey motion kit (K) — small helpers the AI Builder's scenes use inside the sandboxed preview.
   Loaded as source text into the sandbox (never runs in Cuey itself). Everything is deterministic: time comes only from t. */
function CueyKit(THREE){
const K={};
const cl=K.cl=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
K.k=(t,a,b)=>cl((t-a)/(b-a));
K.lerp=(a,b,u)=>a+(b-a)*u;
K.rng=s=>{s=(s>>>0)||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}};
K.e={o3:u=>1-Math.pow(1-cl(u),3),o5:u=>1-Math.pow(1-cl(u),5),i3:u=>Math.pow(cl(u),3),
  io3:u=>{u=cl(u);return u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2},sine:u=>.5-.5*Math.cos(Math.PI*cl(u)),
  back:u=>{u=cl(u);const c=1.70158;return 1+(c+1)*Math.pow(u-1,3)+c*Math.pow(u-1,2)},
  elastic:u=>{u=cl(u);return u===0||u===1?u:Math.pow(2,-10*u)*Math.sin((u*10-.75)*2.094)+1}};
/* loop phase: during the intro u=0; after it u runs 0..1 every `loop` seconds (use sin/cos(n*ph) with whole n) */
K.lp=(t,intro,loop)=>{const u=t<intro?0:((t-intro)%loop)/loop;return {u,ph:u*Math.PI*2,on:t>=intro}};
/* keyframe track: keys [{t, v:number|array}] eased between keys (io3 by default, or key.e name) */
K.track=keys=>t=>{if(t<=keys[0].t)return keys[0].v;for(let i=1;i<keys.length;i++){const a=keys[i-1],b=keys[i];if(t<=b.t){const u=(K.e[b.e||'io3'])((t-a.t)/(b.t-a.t));
  return Array.isArray(a.v)?a.v.map((x,j)=>x+(b.v[j]-x)*u):a.v+(b.v-a.v)*u}}return keys[keys.length-1].v};

/* ---------- 2D ---------- */
/* camera for a 2D world: (0,0) = screen centre; z = zoom; r = roll (radians) */
K.cam2d=(x,{x:cx=0,y:cy=0,z=1,r=0}={})=>{x.setTransform(1,0,0,1,0,0);x.translate(960,540);x.rotate(r);x.scale(z,z);x.translate(-cx,-cy)};
K.fit=(x,s,font,maxW,px,ls=0)=>{let p=px;for(let i=0;i<40;i++){x.font=font.replace('#',p+'px');if('letterSpacing'in x)x.letterSpacing=(ls*p/px)+'px';if(x.measureText(s).width<=maxW||p<14)break;p-=Math.max(2,p*.06)}return p};
K.text2d=(x,s,{font='900 # Poppins',px=160,maxW=1700,color='#fff',glow=null,blur=40,ls=0,dir='ltr',align='center',base='middle',at=[960,540],alpha=1}={})=>{
  x.save();x.globalAlpha*=alpha;x.direction=dir;x.textAlign=align;x.textBaseline=base;const p=K.fit(x,String(s),font,maxW,px,dir==='rtl'?0:ls);
  if(glow){x.shadowColor=glow;x.shadowBlur=blur}x.fillStyle=color;x.fillText(String(s),at[0],at[1]);x.restore();return p};
K.vignette=(x,a=.6)=>{x.save();x.setTransform(1,0,0,1,0,0);const g=x.createRadialGradient(960,540,380,960,540,1150);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${a})`);x.fillStyle=g;x.fillRect(0,0,1920,1080);x.restore()};
K.glow2d=(x,cx,cy,r,color,a=1)=>{x.save();x.globalCompositeOperation='lighter';x.globalAlpha*=a;const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2);x.restore()};

if(!THREE)return K;
/* ---------- 3D ---------- */
const V=(a)=>Array.isArray(a)?new THREE.Vector3(...a):a;
/* stage: renderer (ACES, sRGB, soft shadows) + scene + camera + bloom. Call st.render() at the end of draw(t). */
K.stage=(canvas,{bg='#05060c',fog=null,fov=40,bloom={s:.8,r:.5,th:.82},exposure=1.05,shadows=true}={})=>{
  const q=K.q||1,R=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});R.setPixelRatio(q);R.setSize(1920,1080,false);
  R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=exposure;R.outputColorSpace=THREE.SRGBColorSpace;R.shadowMap.enabled=shadows;R.shadowMap.type=THREE.PCFSoftShadowMap;
  const S=new THREE.Scene();S.background=new THREE.Color(bg);if(fog)S.fog=new THREE.Fog(fog[0],fog[1],fog[2]);
  const C=new THREE.PerspectiveCamera(fov,16/9,.1,4000);C.position.set(0,2,14);
  let comp=null,bp=null;if(bloom){comp=new THREE.EffectComposer(R);comp.setPixelRatio(q);comp.setSize(1920,1080);comp.addPass(new THREE.RenderPass(S,C));
    bp=new THREE.UnrealBloomPass(new THREE.Vector2(960,540),bloom.s,bloom.r,bloom.th);comp.addPass(bp);comp.addPass(new THREE.OutputPass())}
  return {R,S,C,bloom:bp,render(){if(comp)comp.render();else R.render(S,C)}}};
/* lights: soft sky/ground + a key light with shadows + a coloured rim */
K.lights=(S,{sky='#9fb4ff',ground='#1a1020',key='#ffffff',keyI=2.2,rim='#ff6a3d',rimI=2,amb=.35,keyPos=[6,10,8]}={})=>{
  const h=new THREE.HemisphereLight(sky,ground,amb*2);S.add(h);const k=new THREE.DirectionalLight(key,keyI);k.position.set(...keyPos);k.castShadow=true;k.shadow.mapSize.set(1024,1024);
  const sc=k.shadow.camera;sc.left=sc.bottom=-20;sc.right=sc.top=20;sc.far=80;S.add(k);const r=new THREE.DirectionalLight(rim,rimI);r.position.set(-8,4,-10);S.add(r);return {hemi:h,key:k,rim:r}};
/* camera moves: keys [{t, p:[x,y,z], look:[x,y,z], fov?, e?}] — eased between keys; returns f(t) that places C */
K.camera=(C,keys)=>{const P=K.track(keys.map(k=>({t:k.t,v:k.p,e:k.e}))),L=K.track(keys.map(k=>({t:k.t,v:k.look||[0,0,0],e:k.e}))),F=K.track(keys.map(k=>({t:k.t,v:k.fov||C.fov,e:k.e})));
  return (t,shake=0)=>{const p=P(t),l=L(t);C.position.set(p[0]+Math.sin(t*13.1)*shake,p[1]+Math.sin(t*17.3)*shake,p[2]);C.lookAt(l[0],l[1],l[2]);const f=F(t);if(Math.abs(C.fov-f)>1e-3){C.fov=f;C.updateProjectionMatrix()}}};
/* text on a plane (canvas texture). h = world height of the text line. opts.dir='rtl' for Hebrew (Heebo). Returns a Group (scale/move it freely) with .material (opacity) .setText(s) .width */
K.text=(s,{font='900 # Poppins',color='#ffffff',h=1.4,glow=null,ls=0,dir='ltr',px=220,maxW=3000,emissive=.92}={})=>{
  const cv=new OffscreenCanvas(4,4),x=cv.getContext('2d');const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false,color:new THREE.Color(emissive,emissive,emissive)}));
  m.setText=str=>{const pad=glow?px*.5:px*.12;x.font=font.replace('#',px+'px');if('letterSpacing'in x)x.letterSpacing=(dir==='rtl'?0:ls)+'px';let w=Math.min(maxW,Math.ceil(x.measureText(String(str)).width));
    cv.width=Math.max(4,w+pad*2);cv.height=Math.ceil(px*1.35+pad*2);x.font=font.replace('#',px+'px');if('letterSpacing'in x)x.letterSpacing=(dir==='rtl'?0:ls)+'px';x.direction=dir;x.textAlign='center';x.textBaseline='middle';
    if(glow){x.shadowColor=glow;x.shadowBlur=px*.35}x.fillStyle=color;x.fillText(String(str),cv.width/2,cv.height/2,maxW);tex.needsUpdate=true;const sc=h/(px*1.35);m.scale.set(cv.width*sc,cv.height*sc,1);G.width=w*sc};
  const G=new THREE.Group();G.add(m);G.mesh=m;G.material=m.material;G.setText=m.setText;m.setText(s);return G};
/* the user's logo (ImageBitmap) on a plane, h = world height */
K.logo=(bm,{h=3,emissive=1.1}={})=>{const tex=new THREE.Texture(bm);tex.flipY=false;tex.center.set(.5,.5);tex.repeat.set(1,-1);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(h*bm.width/bm.height,h),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false,color:new THREE.Color(emissive,emissive,emissive)}));return m};
/* soft additive glow sprite */
const gtex={};K.glowTex=(color='#ffffff')=>{if(gtex[color])return gtex[color];const c=new OffscreenCanvas(128,128),x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,color);g.addColorStop(.25,color);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return gtex[color]=t};
K.glow=(color='#ffffff',size=3,opacity=1)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:K.glowTex(color),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity,toneMapped:false}));s.scale.set(size,size,1);return s};
/* star field / floating dust (Points) — call .update(t) to twinkle/drift */
K.stars=(n=1500,{r=300,size=1.6,color='#ffffff',seed=3,y=[-50,300]}={})=>{const R=K.rng(seed),p=new Float32Array(n*3);for(let i=0;i<n;i++){const a=R()*6.283,d=r*(.4+.6*R());p[i*3]=Math.cos(a)*d;p[i*3+1]=y[0]+R()*(y[1]-y[0]);p[i*3+2]=Math.sin(a)*d}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));const m=new THREE.PointsMaterial({color,size,sizeAttenuation:false,transparent:true,opacity:.9,depthWrite:false,toneMapped:false});return new THREE.Points(g,m)};
/* confetti: InstancedMesh; c.burst(age, origin[x,y,z], power) — deterministic for any age */
K.confetti=(n=500,{colors=['#ff2d55','#ffd166','#06d6a0','#4cc9f0','#ffffff'],size=.18,seed=9,gravity=4.5,drag=1.4}={})=>{
  const g=new THREE.PlaneGeometry(size,size*.6),m=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.5,metalness:.2,emissive:'#222'}),im=new THREE.InstancedMesh(g,m,n);const R=K.rng(seed),d=[];
  for(let i=0;i<n;i++){const th=R()*6.283,ph=Math.acos(2*R()-1),sp=3+R()*9;d.push({v:[Math.sin(ph)*Math.cos(th)*sp,Math.abs(Math.cos(ph))*sp*1.1,Math.sin(ph)*Math.sin(th)*sp],r:[R()*6,R()*6,R()*6],w:[(R()-.5)*14,(R()-.5)*14,(R()-.5)*14],s:.6+R()*.8});im.setColorAt(i,new THREE.Color(colors[i%colors.length]))}
  const o=new THREE.Object3D();im.burst=(age,origin=[0,0,0],power=1)=>{const a=Math.max(0,age),dd=(1-Math.exp(-drag*a))/drag;for(let i=0;i<n;i++){const q=d[i];
    o.position.set(origin[0]+q.v[0]*power*dd+Math.sin(a*2+i)*.25*a,origin[1]+q.v[1]*power*dd-.5*gravity*a*a*.35,origin[2]+q.v[2]*power*dd);o.rotation.set(q.r[0]+q.w[0]*a,q.r[1]+q.w[1]*a,q.r[2]+q.w[2]*a);
    o.scale.setScalar(age<0?0:q.s);o.updateMatrix();im.setMatrixAt(i,o.matrix)}im.instanceMatrix.needsUpdate=true};im.burst(-1);im.instanceColor.needsUpdate=true;im.frustumCulled=false;return im};
const mat=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.55,metalness:.05,flatShading:!!o.flat,...o});
/* PROPS — stylised low-poly, all stand on y=0, ~1 unit = 1 metre. Each returns a Group; colours are options. */
/* person: .pose({armL,armR (radians, 0=down, PI=up), walk (phase), head}) */
K.person=({body='#2b6cff',skin='#f1c7a5',legs='#1d2433',hair='#2a1b12',h=1.7,kid=false}={})=>{const G=new THREE.Group(),s=kid?h/1.2:h/1.75;
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.2,.45,4,10),mat(body));torso.position.y=1.15;const head=new THREE.Mesh(new THREE.SphereGeometry(kid?.19:.16,20,14),mat(skin));head.position.y=1.62;
  const hr=new THREE.Mesh(new THREE.SphereGeometry(kid?.2:.17,20,14,0,6.283,0,1.3),mat(hair));hr.position.y=1.65;
  const mk=(c,len,r)=>{const p=new THREE.Group(),m=new THREE.Mesh(new THREE.CapsuleGeometry(r,len,4,8),mat(c));m.position.y=-len/2-r;p.add(m);return p};
  const aL=mk(body,.42,.065),aR=mk(body,.42,.065);aL.position.set(-.27,1.4,0);aR.position.set(.27,1.4,0);const lL=mk(legs,.5,.085),lR=mk(legs,.5,.085);lL.position.set(-.11,.82,0);lR.position.set(.11,.82,0);
  G.add(torso,head,hr,aL,aR,lL,lR);G.traverse(o=>{if(o.isMesh){o.castShadow=true}});G.scale.setScalar(s);
  G.hand=new THREE.Object3D();aR.add(G.hand);G.hand.position.y=-.62;
  G.pose=({armL=.1,armR=.1,walk=0,head:hd=0}={})=>{aL.rotation.z=-armL;aR.rotation.z=armR;const w=Math.sin(walk)*.5;lL.rotation.x=w;lR.rotation.x=-w;aL.rotation.x=-w*.6;aR.rotation.x=w*.6;head.rotation.y=hd;hr.rotation.y=hd};G.pose();return G};
/* balloon on a string: .handle is the string end (attach to a hand via world position) */
K.balloon=({color='#ff2d3d',r=.42}={})=>{const G=new THREE.Group(),b=new THREE.Mesh(new THREE.SphereGeometry(r,32,24),new THREE.MeshPhysicalMaterial({color,roughness:.18,clearcoat:1,clearcoatRoughness:.1,sheen:.5}));
  b.scale.y=1.18;b.position.y=1.25+r;b.castShadow=true;const knot=new THREE.Mesh(new THREE.ConeGeometry(.06,.1,8),mat(color));knot.position.y=1.25-.0;knot.rotation.x=Math.PI;
  const str=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,1.25,4),new THREE.MeshBasicMaterial({color:'#eeeeee'}));str.position.y=.625;G.add(b,knot,str);G.bulb=b;G.string=str;return G};
/* airliner: body/accent colours, name painted on the side (text). Nose points +x. ~10 m long */
K.airplane=({body='#f4f6fb',accent='#e11d2a',tail=null,text='',textColor=null,font='800 # Poppins'}={})=>{const G=new THREE.Group(),bm=mat(body,{roughness:.35,metalness:.25}),am=mat(accent,{roughness:.4,metalness:.2});
  const f=new THREE.Mesh(new THREE.CapsuleGeometry(.55,7.2,8,20),bm);f.rotation.z=Math.PI/2;f.castShadow=true;G.add(f);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(.55,20,14,0,6.283,0,1.6),bm);nose.rotation.z=-Math.PI/2;nose.position.x=3.6;nose.scale.set(1,1.5,1);G.add(nose);
  const wingG=new THREE.BoxGeometry(2.2,.08,9.5);const w=new THREE.Mesh(wingG,bm);w.position.set(.2,-.25,0);w.rotation.y=.18;w.castShadow=true;G.add(w);
  const ts=new THREE.Mesh(new THREE.BoxGeometry(1.2,.06,3.4),bm);ts.position.set(-3.7,.1,0);G.add(ts);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(1.7,2.1,.08),mat(tail||accent));fin.position.set(-3.6,1.2,0);fin.rotation.z=.45;G.add(fin);
  const stripe=new THREE.Mesh(new THREE.CylinderGeometry(.56,.56,6.8,24,1,true,Math.PI*.42,Math.PI*.16),am);stripe.rotation.z=Math.PI/2;G.add(stripe);
  const stripe2=stripe.clone();stripe2.rotation.x=Math.PI;G.add(stripe2);
  for(const z of[-2.1,2.1]){const e=new THREE.Mesh(new THREE.CylinderGeometry(.32,.28,1.3,16),mat('#c9ced8',{metalness:.6,roughness:.3}));e.rotation.z=Math.PI/2;e.position.set(.6,-.6,z);G.add(e)}
  const win=new THREE.Mesh(new THREE.BoxGeometry(5.2,.12,1.12),new THREE.MeshBasicMaterial({color:'#1b2540'}));win.position.set(.3,.18,0);win.scale.z=1;G.add(win);
  if(text){for(const sd of[1,-1]){const t=K.text(text,{font,color:textColor||accent,h:.42,px:160});t.position.set(-.4,.18,.57*sd);t.rotation.y=sd>0?0:Math.PI;G.add(t)}}
  G.traverse(o=>{if(o.isMesh)o.castShadow=true});return G};
/* soft volumetric-looking cloud (layered billboards). color = lit side, shade = underside tint. s = size (~8 units wide at s=1) */
const ctex={};const cloudTex=(seed,color,shade)=>{const key=seed+color+shade;if(ctex[key])return ctex[key];const R=K.rng(seed*97+5),c=new OffscreenCanvas(512,256),x=c.getContext('2d');
  x.filter='blur(6px)';for(let i=0;i<120;i++){const u=R(),cx=70+u*372,top=Math.sin(u*Math.PI),cy=168-top*(60+R()*30)+R()*30,r=(18+R()*46)*(.45+.55*top);const g=x.createRadialGradient(cx,cy-r*.35,0,cx,cy,r);
    g.addColorStop(0,color);g.addColorStop(.6,shade);g.addColorStop(1,'rgba(0,0,0,0)');x.globalAlpha=.10+R()*.14;x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,6.283);x.fill()}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return ctex[key]=t};
K.cloud=({seed=1,s=1,color='#ffffff',shade='#c3c6dc',opacity=1,layers=3}={})=>{const R=K.rng(seed),G=new THREE.Group();for(let i=0;i<layers;i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex(seed*7+i,color,shade),transparent:true,opacity,depthWrite:false,fog:false}));
  const w=(6+R()*5)*s;sp.scale.set(w,w*.5,1);sp.position.set((R()-.5)*4*s,(R()-.5)*.8*s,(R()-.5)*2*s);G.add(sp)}G.opacity=v=>G.children.forEach(c=>c.material.opacity=v*opacity);return G};
/* simple shapes people ask for */
K.gift=({box='#e63946',ribbon='#ffd166',s=1}={})=>{const G=new THREE.Group(),b=new THREE.Mesh(new THREE.RoundedBoxGeometry(1,1,1,4,.06),mat(box));b.position.y=.5;
  const r1=new THREE.Mesh(new THREE.BoxGeometry(1.02,1.02,.16),mat(ribbon,{metalness:.4,roughness:.3}));r1.position.y=.5;const r2=r1.clone();r2.rotation.y=Math.PI/2;G.add(b,r1,r2);G.scale.setScalar(s);G.traverse(o=>{if(o.isMesh)o.castShadow=true});return G};
K.trophy=({color='#ffcf5a',s=1}={})=>{const G=new THREE.Group(),m=mat(color,{metalness:1,roughness:.22});const cup=new THREE.Mesh(new THREE.LatheGeometry([[0,.25],[.16,.27],[.09,.4],[.09,.85],[.3,.95],[.55,1.15],[.62,1.55],[.6,1.8],[.56,1.8],[.5,1.2],[0,1.05]].map(p=>new THREE.Vector2(p[0],p[1])),48),m);const base=new THREE.Mesh(new THREE.BoxGeometry(.9,.25,.9),mat('#1b1b22',{metalness:.3,roughness:.4}));base.position.y=.12;G.add(cup,base);G.scale.setScalar(s);G.traverse(o=>{if(o.isMesh)o.castShadow=true});return G};
/* ground with soft shadows */
K.ground=({color='#0b0d14',size=400,rough=.95}={})=>{const g=new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.MeshStandardMaterial({color,roughness:rough}));g.rotation.x=-Math.PI/2;g.receiveShadow=true;return g};
/* ---------- footage + premium type (AI Builder engines) ---------- */
K.he=s=>/[֐-׿]/.test(String(s||''));
/* full-screen real footage behind everything: A.bg / A.bg2 (ImageBitmaps) and A.mix (crossfade for the seamless loop).
   grade: {dark 0..1, tint '#hex', tintA 0..1, sat 0..2, blur 0..6 (soft focus), vig 0..1}; zoom/pan for camera moves. */
K.footage=(S,{dark=.35,tint='#000000',tintA=0,sat=1,blur=0,vig=.55}={})=>{const mk=()=>{const t=new THREE.Texture();t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;return t};
  const ta=mk(),tb=mk(),u={a:{value:ta},b:{value:tb},m:{value:0},has:{value:0},dark:{value:dark},tint:{value:new THREE.Color(tint)},tintA:{value:tintA},sat:{value:sat},blur:{value:blur},vig:{value:vig},zoom:{value:1},pan:{value:new THREE.Vector2()},aspect:{value:16/9},flash:{value:0},fcol:{value:new THREE.Color('#ffffff')}};
  const m=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:u,depthTest:false,depthWrite:false,fog:false,toneMapped:false,
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,1.,1.);}',
    fragmentShader:`uniform sampler2D a,b;uniform float m,has,dark,tintA,sat,blur,vig,zoom,aspect,flash;uniform vec3 tint,fcol;uniform vec2 pan;varying vec2 v;
    vec2 cov(vec2 p){float r=aspect/(16./9.);vec2 q=vec2(p.x,1.-p.y)-.5;if(r>1.)q.x/=r;else q.y*=r;return q/zoom+.5+pan;}
    void main(){vec2 q=cov(v);vec3 c=texture2D(a,q,blur).rgb;if(m>0.)c=mix(c,texture2D(b,q,blur).rgb,m);if(has<.5)c=vec3(.02,.025,.05);
    float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,sat);c=mix(c,tint*l*1.6,tintA);c*=1.-dark;
    float d=distance(v,vec2(.5));c*=1.-vig*smoothstep(.35,.85,d);c+=fcol*flash;gl_FragColor=vec4(c,1.);}`}));
  m.frustumCulled=false;m.renderOrder=-1000;S.add(m);let la=null,lb=null;
  m.feed=A=>{if(A.bg&&A.bg!==la){ta.image=A.bg;ta.needsUpdate=true;la=A.bg;u.aspect.value=A.bg.width/A.bg.height;u.has.value=1}
    if(A.bg2&&A.bg2!==lb){tb.image=A.bg2;tb.needsUpdate=true;lb=A.bg2}u.m.value=A.bg2?(A.mix||0):0};m.u=u;return m};
/* premium text: canvas texture + shader with light reveal (rev 0..1 along reading direction), a moving shine, edge glow, gradient fill.
   Returns Group: .u uniforms {rev, shine, glow, op, edge}, .width, .height */
K.type=(str,{font=null,px=240,h=2,color='#ffffff',color2=null,glow=null,ls=null,weight=900,stroke=0,emissive=1}={})=>{
  const he=K.he(str),fam=font||(he?'Heebo':'Poppins'),f=weight+' '+px+'px '+fam,sp=he?0:(ls==null?px*.06:ls);
  const cv=new OffscreenCanvas(4,4),x=cv.getContext('2d');x.font=f;if('letterSpacing'in x)x.letterSpacing=sp+'px';const w=Math.ceil(x.measureText(String(str)).width)+(he?0:sp),pad=Math.ceil(px*.45);
  cv.width=Math.max(8,w+pad*2);cv.height=Math.ceil(px*1.3+pad*2);x.font=f;if('letterSpacing'in x)x.letterSpacing=sp+'px';x.direction=he?'rtl':'ltr';x.textAlign='center';x.textBaseline='middle';
  const g=x.createLinearGradient(0,pad,0,cv.height-pad);g.addColorStop(0,color);g.addColorStop(1,color2||color);x.fillStyle=g;
  if(glow){x.shadowColor=glow;x.shadowBlur=px*.28}x.fillText(String(str),cv.width/2+(he?0:sp/2),cv.height/2+px*.04);
  if(stroke){x.shadowBlur=0;x.lineWidth=stroke;x.strokeStyle=color2||color;x.strokeText(String(str),cv.width/2,cv.height/2)}
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;tex.generateMipmaps=true;
  const u={map:{value:tex},rev:{value:1},shine:{value:-1},glow:{value:0},op:{value:1},edge:{value:new THREE.Color(glow||'#ffffff')},dir:{value:he?-1:1},em:{value:emissive},soft:{value:.06}};
  const mat=new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D map;uniform float rev,shine,glow,op,dir,em,soft;uniform vec3 edge;varying vec2 v;
    void main(){vec4 c=texture2D(map,v);float px=dir>0.?v.x:1.-v.x;float r=smoothstep(rev,rev-soft,px);float e=exp(-pow((px-rev)/.025,2.))*step(.0001,rev)*step(rev,.9999);
    float s=exp(-pow((px+(v.y-.5)*.25-shine)/.06,2.));vec3 col=c.rgb*em+edge*(e*2.5+s*1.2*c.a)+edge*glow*c.a;gl_FragColor=vec4(col,(c.a*r+e*.9*smoothstep(.0,.6,c.a+.3))*op);}`});
  const sc=h/(px*1.3),m=new THREE.Mesh(new THREE.PlaneGeometry(cv.width*sc,cv.height*sc),mat),G=new THREE.Group();G.add(m);G.mesh=m;G.u=u;G.width=w*sc;G.height=h;G.he=he;return G};
/* logo plane with the same reveal/shine shader */
K.logoFX=(bm,{h=3,glow='#ffffff'}={})=>{const t=new THREE.Texture(bm);t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;
  const u={map:{value:t},rev:{value:1},shine:{value:-1},glow:{value:0},op:{value:1},edge:{value:new THREE.Color(glow)},dir:{value:1},em:{value:1},soft:{value:.06}};
  const mat=new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D map;uniform float rev,shine,glow,op,em,soft;uniform vec3 edge;varying vec2 v;void main(){vec4 c=texture2D(map,vec2(v.x,1.-v.y));float r=smoothstep(rev,rev-soft,v.x);float e=exp(-pow((v.x-rev)/.025,2.))*step(.0001,rev)*step(rev,.9999);float s=exp(-pow((v.x+(v.y-.5)*.25-shine)/.06,2.));gl_FragColor=vec4(c.rgb*em+edge*(e*2.+s*1.1*c.a+glow*c.a),(c.a*r+e*.6*c.a)*op);}`});
  const w=h*bm.width/bm.height,m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat),G=new THREE.Group();G.add(m);G.mesh=m;G.u=u;G.width=w;G.height=h;return G};
/* points that sample the inked pixels of a text or logo (for particle builds). Returns Float32Array of [x,y] in world units, centred */
K.sample=(src,{n=9000,h=3,font=null,weight=900,seed=4}={})=>{let cv,x,W,H;if(typeof src==='string'){const he=K.he(src),f=weight+' 200px '+(font||(he?'Heebo':'Poppins'));cv=new OffscreenCanvas(8,8);x=cv.getContext('2d');x.font=f;
    W=Math.ceil(x.measureText(src).width)+40;H=280;cv.width=W;cv.height=H;x.font=f;x.direction=he?'rtl':'ltr';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#fff';x.fillText(src,W/2,H/2)}
  else{const s=Math.min(1,700/Math.max(src.width,src.height));W=Math.round(src.width*s);H=Math.round(src.height*s);cv=new OffscreenCanvas(W,H);x=cv.getContext('2d');x.drawImage(src,0,0,W,H)}
  const d=x.getImageData(0,0,W,H).data,on=[],col=[];for(let y=0;y<H;y+=2)for(let i=0;i<W;i+=2){const k=(y*W+i)*4;if(d[k+3]>110){on.push(i,y);col.push(d[k]/255,d[k+1]/255,d[k+2]/255)}}
  const R=K.rng(seed),P=new Float32Array(n*2),C=new Float32Array(n*3),sc=h/H;for(let j=0;j<n;j++){const q=Math.floor(R()*(on.length/2));P[j*2]=(on[q*2]-W/2+(R()-.5)*2)*sc;P[j*2+1]=-(on[q*2+1]-H/2+(R()-.5)*2)*sc;C.set(col.slice(q*3,q*3+3),j*3)}
  return {P,C,w:W*sc,h}};
/* soft round additive points with per-point size/colour; update positions yourself (attribute 'position') */
K.points=(n,{size=6,color='#ffffff',additive=true}={})=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3).fill(1),3));g.setAttribute('sz',new THREE.BufferAttribute(new Float32Array(n).fill(1),1));g.setAttribute('al',new THREE.BufferAttribute(new Float32Array(n).fill(1),1));
  const m=new THREE.ShaderMaterial({uniforms:{s:{value:size},c:{value:new THREE.Color(color)},op:{value:1}},transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false,vertexColors:true,
    vertexShader:'attribute float sz,al;uniform float s;varying vec3 vc;varying float va;void main(){vc=color;va=al;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=s*sz*(60./-mv.z);gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform vec3 c;uniform float op;varying vec3 vc;varying float va;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);a*=a;gl_FragColor=vec4(c*vc,a*va*op);}'});
  const p=new THREE.Points(g,m);p.frustumCulled=false;return p};
/* light rays from a point (additive fan of soft beams) */
K.rays=(n=14,{color='#ffffff',len=30,width=2.2,seed=2,op=.18}={})=>{const R=K.rng(seed),G=new THREE.Group(),tx=(()=>{const c=new OffscreenCanvas(64,256),x=c.getContext('2d'),g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,256);const h=x.createLinearGradient(0,0,64,0);h.addColorStop(0,'rgba(0,0,0,1)');h.addColorStop(.5,'rgba(0,0,0,0)');h.addColorStop(1,'rgba(0,0,0,1)');x.globalCompositeOperation='destination-out';x.fillStyle=h;x.fillRect(0,0,64,256);return new THREE.CanvasTexture(c)})();
  for(let i=0;i<n;i++){const w=width*(.4+R()),m=new THREE.Mesh(new THREE.PlaneGeometry(w,len),new THREE.MeshBasicMaterial({map:tx,color,transparent:true,opacity:op*(.4+R()*.8),blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    m.geometry.translate(0,-len/2,0);m.rotation.z=(R()-.5)*1.3;m.userData={r0:m.rotation.z,o:m.material.opacity,ph:R()*6.28};G.add(m)}G.sway=(t,a=.08)=>G.children.forEach(m=>{m.rotation.z=m.userData.r0+Math.sin(t*.6+m.userData.ph)*a;m.material.opacity=m.userData.o*(.7+.3*Math.sin(t*1.3+m.userData.ph*2))});return G};
/* anamorphic flare streak */
K.flare=(color='#9fd0ff',{w=40,h=.5}={})=>{const c=new OffscreenCanvas(512,32),x=c.getContext('2d'),g=x.createLinearGradient(0,0,512,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.5,'#fff');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,512,32);const v=x.createLinearGradient(0,0,0,32);
  v.addColorStop(0,'rgba(0,0,0,1)');v.addColorStop(.5,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,1)');x.globalCompositeOperation='destination-out';x.fillStyle=v;x.fillRect(0,0,512,32);
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));return m};
/* ---------- studio easing palette + split-type reveals (motion-design rules, see claude/research/motion-design-for-event-slides.md) ---------- */
K.bez=(x1,y1,x2,y2)=>{const cx=3*x1,bx=3*(x2-x1)-cx,ax=1-cx-bx,cy=3*y1,by=3*(y2-y1)-cy,ay=1-cy-by,X=t=>((ax*t+bx)*t+cx)*t,Y=t=>((ay*t+by)*t+cy)*t,D=t=>(3*ax*t+2*bx)*t+cx;
  return u=>{u=cl(u);if(u<=0||u>=1)return u;let t=u;for(let i=0;i<8;i++){const e=X(t)-u,d=D(t);if(Math.abs(e)<1e-5||Math.abs(d)<1e-6)break;t-=e/d}return Y(cl(t))}};
K.ez={heroIn:K.bez(.19,1,.22,1),emphasizedIn:K.bez(.05,.7,.1,1),calmIn:K.bez(0,0,.3,1),move:K.bez(.4,.14,.3,1),exit:K.bez(.4,.14,1,1),settle:K.bez(.34,1.56,.64,1),sweep:K.e.sine};
/* reveal recipes (per unit duration / stagger in seconds) */
K.recipes={maskLines:{unit:'line',dur:.8,st:.08,ez:'heroIn',mode:0},maskWords:{unit:'word',dur:.6,st:.06,ez:'heroIn',mode:0},maskChars:{unit:'char',dur:.4,st:.012,ez:'heroIn',mode:0},
  soft:{unit:'char',dur:.4,st:.045,ez:'calmIn',mode:1},blur:{unit:'word',dur:.85,st:.08,ez:'emphasizedIn',mode:2,s0:1.05},slam:{unit:'word',dur:.6,st:.07,ez:'settle',mode:1,s0:.8},
  track:{unit:'char',dur:2.2,st:0,ez:'heroIn',mode:1,track:.4},calm:{unit:'word',dur:.7,st:.07,ez:'calmIn',mode:0}};
/* split type: one canvas, one plane per unit (grapheme / word / line) sharing global uniforms.
   G.at(t,start,recipe) animates; G.u = {op, shine, glow, edge, rev} shared; RTL text reveals in reading order (right to left). */
K.typeFX=(str,{font=null,px=240,h=2,color='#ffffff',color2=null,glow=null,weight=900,ls=null,emissive=.85,unit='word',shadow=null}={})=>{
  str=String(str||'');const he=K.he(str),fam=font||(he?'Heebo':'Poppins'),f=weight+' '+px+'px "'+fam+'"',sp=he?0:(ls==null?px*.01:ls);
  const cv=new OffscreenCanvas(8,8),x=cv.getContext('2d');const setf=()=>{x.font=f;if('letterSpacing'in x)x.letterSpacing=sp+'px';x.direction=he?'rtl':'ltr';x.textAlign='left';x.textBaseline='middle'};setf();
  const W=Math.ceil(x.measureText(str).width),padX=Math.ceil(px*.35),padY=Math.ceil(px*.42);cv.width=Math.max(8,W+padX*2);cv.height=Math.ceil(px*1.25+padY*2);setf();
  const g=x.createLinearGradient(0,padY,0,cv.height-padY);g.addColorStop(0,color);g.addColorStop(1,color2||color);x.fillStyle=g;
  if(shadow){x.shadowColor=shadow;x.shadowBlur=px*.12;x.shadowOffsetY=px*.03}else if(glow){x.shadowColor=glow;x.shadowBlur=px*.22}
  const x0=padX,cy=cv.height/2+px*.04;if(he){x.textAlign='right';x.fillText(str,x0+W,cy)}else x.fillText(str,x0,cy);
  const seg=typeof Intl!=='undefined'&&Intl.Segmenter?[...new Intl.Segmenter(he?'he':'en',{granularity:'grapheme'}).segment(str)].map(s=>s.segment):Array.from(str);
  let units=[];if(unit==='line')units=[str];else if(unit==='word'){units=str.split(/(?<=\s)/)}else units=seg;
  const mw=s=>{setf();return x.measureText(s).width};let acc='';const rngs=units.map(u=>{const a=mw(acc);acc+=u;const b=mw(acc);return he?[x0+W-b,x0+W-a]:[x0+a,x0+b]});
  const sorted=rngs.map((r,i)=>[r,i]).sort((p,q)=>p[0][0]-q[0][0]);const cut=new Array(rngs.length);sorted.forEach(([r,i],j)=>{const L=j===0?0:(sorted[j-1][0][1]+r[0])/2,R=j===sorted.length-1?cv.width:(r[1]+sorted[j+1][0][0])/2;cut[i]=[L,R]});
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;tex.generateMipmaps=true;tex.minFilter=THREE.LinearMipmapLinearFilter;
  const S={map:{value:tex},op:{value:1},shine:{value:-1},glow:{value:0},edge:{value:new THREE.Color(glow||'#ffffff')},dir:{value:he?-1:1},em:{value:emissive},rev:{value:1},soft:{value:.06},rise:{value:(px*1.15)/cv.height}};
  const sc=h/(px*1.25),G=new THREE.Group(),parts=[];
  cut.forEach(([L,R],i)=>{const u={...S,p:{value:1},mode:{value:0},bl:{value:0}};const w=(R-L)*sc,ht=cv.height*sc,geo=new THREE.PlaneGeometry(w,ht),uv=geo.attributes.uv;
    for(let k=0;k<uv.count;k++)uv.setX(k,(uv.getX(k)?R:L)/cv.width);
    const m=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,toneMapped:false,
      vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform sampler2D map;uniform float op,shine,glow,dir,em,rev,soft,rise,p,mode,bl;uniform vec3 edge;varying vec2 v;
      void main(){vec2 q=v;float a=1.;if(mode<.5){q.y+=(1.-p)*rise;}else{a=p;}vec4 c=texture2D(map,q,mode>1.5&&mode<2.5?bl:0.);
      float px=dir>0.?v.x:1.-v.x;float r=smoothstep(rev,rev-soft,px);float e=exp(-pow((px-rev)/.02,2.))*step(.0001,rev)*step(rev,.9999);
      float s=exp(-pow((px+(v.y-.5)*.3-shine)/.05,2.));vec3 col=c.rgb*em+edge*(s*.9*c.a+glow*c.a+e*2.);gl_FragColor=vec4(col,(c.a*r+e*.8*c.a)*a*op);}`}));
    m.position.x=((L+R)/2-cv.width/2)*sc;m.userData={i,x0:m.position.x};G.add(m);parts.push(m)});
  G.u=S;G.parts=parts;G.width=W*sc;G.height=h;G.he=he;G.n=parts.length;G.mesh=parts[0];
  G.set=v=>parts.forEach(m=>{m.material.uniforms.p.value=v;m.scale.setScalar(1);m.position.x=m.userData.x0});
  /* animate the reveal: returns overall progress 0..1 */
  G.at=(t,start,rec='maskWords')=>{const R=typeof rec==='string'?K.recipes[rec]||K.recipes.maskWords:rec,ez=K.ez[R.ez]||K.ez.heroIn,n=parts.length;let all=1;
    const st=R.unit==='char'&&n>40?Math.min(R.st,1.2/n):R.st;
    parts.forEach(m=>{const i=m.userData.i,pe=ez((t-start-i*st)/R.dur),pr=cl((t-start-i*st)/R.dur);all=Math.min(all,pr);const U=m.material.uniforms;U.p.value=R.mode===0?pe:Math.min(1,pr*1.6);U.mode.value=R.mode;U.bl.value=(1-pr)*5;
      const s=R.s0?R.s0+(1-R.s0)*pe:1;m.scale.setScalar(Math.max(.001,s));m.position.x=m.userData.x0*(1+(R.track||0)*(1-pe))});return all};
  return G};

K.V=V;
return K}
window.__KIT_SRC='self.K=('+CueyKit.toString()+')(self.THREE||null);';
