
setTimeout(function(){
"use strict";
const D=window.COURSE;
let GFX="ultra";try{GFX=localStorage.getItem("dg-gfx2")||"ultra";}catch(e){}
const LINQ={value:0};let COMP=null,GRADE=null;const MOBILE=matchMedia("(pointer:coarse)").matches;let DRS=1,FT=16,DRSnext=0;function basePR(){return Math.min(GFX==="ultra"?(MOBILE?1.25:2):(MOBILE?1.15:1.25),window.devicePixelRatio||1);}
const YD=0.9144, TOYD=1.0936, TOFT=3.2808;
const $=id=>document.getElementById(id);

/* ---------- geometry helpers ---------- */
function mkPoly(p){let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,cx=0,cy=0;for(const q of p){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);cx+=q[0];cy+=q[1];}cx/=p.length;cy/=p.length;let R=0;for(const q of p)R=Math.max(R,Math.hypot(q[0]-cx,q[1]-cy));return{p,x0,x1,y0,y1,cx,cy,R};}
function pip(x,y,p){let ins=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const xi=p[i][0],yi=p[i][1],xj=p[j][0],yj=p[j][1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)ins=!ins;}return ins;}
function inP(P,x,y){return x>=P.x0&&x<=P.x1&&y>=P.y0&&y<=P.y1&&pip(x,y,P.p);}
function dSeg(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;let u=L?((px-ax)*dx+(py-ay)*dy)/L:0;u=Math.max(0,Math.min(1,u));return Math.hypot(ax+u*dx-px,ay+u*dy-py);}
function dPL(x,y,l){let m=1e9;for(let i=1;i<l.length;i++)m=Math.min(m,dSeg(x,y,l[i-1][0],l[i-1][1],l[i][0],l[i][1]));return m;}
function plLen(l){let s=0;for(let i=1;i<l.length;i++)s+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);return s;}
function plAt(l,d){for(let i=1;i<l.length;i++){const sx=l[i][0]-l[i-1][0],sy=l[i][1]-l[i-1][1],L=Math.hypot(sx,sy);if(d<=L||i===l.length-1){const u=Math.max(0,Math.min(d,L))/L;return{x:l[i-1][0]+sx*u,y:l[i-1][1]+sy*u,tx:sx/L,ty:sy/L};}d-=L;}}
function plProj(l,x,y){let best=1e9,acc=0,res=0;for(let i=1;i<l.length;i++){const ax=l[i-1][0],ay=l[i-1][1],dx=l[i][0]-ax,dy=l[i][1]-ay,L=Math.hypot(dx,dy);let u=((x-ax)*dx+(y-ay)*dy)/(L*L);u=Math.max(0,Math.min(1,u));const d=Math.hypot(ax+u*dx-x,ay+u*dy-y);if(d<best){best=d;res=acc+u*L;}acc+=L;}return res;}
function sstep(a,b,x){const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);}
let seed=90210;function rnd(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}

/* ---------- course data ---------- */
const MAIN=mkPoly(D.f.find(f=>f.k==='golf_course'&&f.n===D.name).p);
const PAR3=(()=>{const f=D.f.find(f=>f.k==='golf_course'&&f.n!==D.name);return f?mkPoly(f.p):null;})();
const RANGE=D.f.filter(f=>f.k==='driving_range').map(f=>mkPoly(f.p));
const CLUBH=D.f.filter(f=>f.k==='clubhouse').map(f=>mkPoly(f.p));
const GREENS=D.f.filter(f=>f.k==='green'&&f.c).map(f=>mkPoly(f.p));
const TEES=D.f.filter(f=>f.k==='tee'&&f.c).map(f=>mkPoly(f.p));
const BUNKERS=D.f.filter(f=>(f.k==='bunker'||f.k==='sand')&&f.c).map(f=>mkPoly(f.p));
const PATHS=D.f.filter(f=>f.k==='cartpath'||f.k==='path').map(f=>f.p);
const WATER=D.f.filter(f=>f.k==='water'&&f.c&&f.p.length>3).map(f=>mkPoly(f.p));
/* creeks (USGS NHD centerlines): a narrow channel that counts as a water hazard */
const CREEKS=[];for(const l of (D.creek||[])){if(l.length<2)continue;const hw=1.6,L=[],Rt=[];for(let i=0;i<l.length;i++){const a=l[Math.max(0,i-1)],b=l[Math.min(l.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy)||1,nx=-dy/n,ny=dx/n;L.push([l[i][0]+nx*hw,l[i][1]+ny*hw]);Rt.push([l[i][0]-nx*hw,l[i][1]-ny*hw]);}
  const w=mkPoly(L.concat(Rt.reverse()));w.creek=true;w.line=l;WATER.push(w);CREEKS.push(w);}
const WOODS=D.f.filter(f=>f.k==='wood'&&f.c&&f.p.length>3).map(f=>mkPoly(f.p));
const HOLES=D.holes.filter(h=>h.main).sort((a,b)=>+a.ref-+b.ref), P3HOLES=D.holes.filter(h=>!h.main);
// fairways: OSM polygons, plus a centerline corridor for any par 4/5 the map leaves bare
function corridor(h){const L=plLen(h.p),a=Math.min(70,L*.2),b=L-12,left=[],right=[],s0=+h.ref*1.7;
  for(let d=a;d<=b+0.01;d+=4){const s=plAt(h.p,d),t=(d-a)/(b-a);let w=15.5*(0.8+0.2*Math.sin(Math.PI*Math.min(1,t*1.15)))+1.4*Math.sin(d/21+s0);if(t>0.88)w*=1-(t-0.88)*3;if(t<0.05)w*=0.7+t*6;
    left.push([s.x-s.ty*w,s.y+s.tx*w]);right.push([s.x+s.ty*w,s.y-s.tx*w]);}
  return mkPoly(left.concat(right.reverse()));}
const FAIRWAYS=D.f.filter(f=>f.k==='fairway'&&f.c&&f.p.length>3).map(f=>mkPoly(f.p));
HOLES.filter(h=>+h.par>=4).forEach(h=>{const L=plLen(h.p);let hit=0;for(const s of[.45,.6,.75]){const m=plAt(h.p,L*s);if(FAIRWAYS.some(f=>inP(f,m.x,m.y)))hit++;}if(!hit)FAIRWAYS.push(corridor(h));});
for(const f of FAIRWAYS){let best=HOLES[0],bd=1e9;for(const h of(PAR3?HOLES:D.holes)){const d=dPL(f.cx,f.cy,h.p);if(d<bd){bd=d;best=h;}}const s=best.p[0],e=best.p[best.p.length-1];f.ang=Math.atan2(e[1]-s[1],e[0]-s[0]);}
// green tilt: higher at the back, a touch higher on the left
for(const g of GREENS){let dx=0,dy=-1;for(const h of D.holes){const e=h.p[h.p.length-1];if(inP(g,e[0],e[1])){const q=h.p[h.p.length-2];const L=Math.hypot(e[0]-q[0],e[1]-q[1]);dx=(e[0]-q[0])/L;dy=(e[1]-q[1])/L;}}
  g.ax=dx*0.015-dy*0.007;g.ay=dy*0.015+dx*0.007;}
// real terrain: USGS 10 m elevation (via OpenTopoData), sampled every 20 m, relative to the 1st tee, smoothed with a bicubic
const DM=D.dem;function dz(i,j){i=i<0?0:i>=DM.nx?DM.nx-1:i;j=j<0?0:j>=DM.ny?DM.ny-1:j;return DM.z[j*DM.nx+i];}
function crm(p0,p1,p2,p3,t){return p1+.5*t*(p2-p0+t*(2*p0-5*p1+4*p2-p3+t*(3*(p1-p2)+p3-p0)));}
const LI=D.lidar&&D.lidar.data?D.lidar:null,RELIEF=.5;
function lz(i,j){i=i<0?0:i>=LI.nx?LI.nx-1:i;j=j<0?0:j>=LI.ny?LI.ny-1:j;return LI.data[j*LI.nx+i]*.01;}
function demH(x,y){if(LI){const fx=(x-LI.x0)/LI.sx,fy=(y-LI.y0)/LI.sy;if(fx>=0&&fy>=0&&fx<=LI.nx-1&&fy<=LI.ny-1){const i=Math.floor(fx),j=Math.floor(fy),u=fx-i,v=fy-j;
  return RELIEF*demH20(x,y)+crm(crm(lz(i-1,j-1),lz(i,j-1),lz(i+1,j-1),lz(i+2,j-1),u),crm(lz(i-1,j),lz(i,j),lz(i+1,j),lz(i+2,j),u),crm(lz(i-1,j+1),lz(i,j+1),lz(i+1,j+1),lz(i+2,j+1),u),crm(lz(i-1,j+2),lz(i,j+2),lz(i+1,j+2),lz(i+2,j+2),u),v);}}
  return (1+RELIEF)*demH20(x,y);}
function demH20(x,y){const fx=(x-DM.x0)/DM.st,fy=(y-DM.y0)/DM.st,i=Math.floor(fx),j=Math.floor(fy),u=fx-i,v=fy-j;
  return crm(crm(dz(i-1,j-1),dz(i,j-1),dz(i+1,j-1),dz(i+2,j-1),u),crm(dz(i-1,j),dz(i,j),dz(i+1,j),dz(i+2,j),u),crm(dz(i-1,j+1),dz(i,j+1),dz(i+1,j+1),dz(i+2,j+1),u),crm(dz(i-1,j+2),dz(i,j+2),dz(i+1,j+2),dz(i+2,j+2),u),v);}
function baseH(x,y){if(LI)return demH(x,y);return demH(x,y)+.35*(1.5*Math.sin(x/43+.7)*Math.cos(y/61)+1.1*Math.sin((x+y)/79+1.3)+.5*Math.sin(y/27+x/33)+.3*Math.sin(x/13.7)*Math.sin(y/17.3));}
for(const g of GREENS)g.h0=baseH(g.cx,g.cy)+0.25;
for(const t of TEES)t.h0=baseH(t.cx,t.cy)+0.3;
function H(x,y){let h=baseH(x,y);
  if(!LI)for(const g of GREENS){const dx=x-g.cx,dy=y-g.cy,r=g.R+12;if(dx>r||dx<-r||dy>r||dy<-r)continue;const d=Math.hypot(dx,dy);if(d>r)continue;const w=1-sstep(g.R*.75,r,d);const t=g.h0+g.ax*dx+g.ay*dy+.08*Math.sin(dx/3.7+1)*Math.cos(dy/4.9);h=h*(1-w)+t*w;}
  if(!LI)for(const g of TEES){const dx=x-g.cx,dy=y-g.cy,r=g.R+6;if(dx>r||dx<-r||dy>r||dy<-r)continue;const d=Math.hypot(dx,dy);if(d>r)continue;const w=1-sstep(g.R*.9,r,d);h=h*(1-w)+g.h0*w;}
  for(const b of BUNKERS){if(x<b.x0-1.4||x>b.x1+1.4||y<b.y0-1.4||y>b.y1+1.4)continue;const e=edgeDist(b,x,y);if(inP(b,x,y))h-=(LI?.05:.1)+(LI?.22:.44)*sstep(0,2.4,e);else if(e<1.35)h+=(LI?.08:.14)*sstep(0,.35,e)*(1-sstep(.4,1.35,e));}
  for(const w of WATER){if(inP(w,x,y))h-=w.creek?.28:0.6;}
  return h;}
function edgeDist(b,x,y){let m=1e9;const p=b.p;for(let i=0,j=p.length-1;i<p.length;j=i++)m=Math.min(m,dSeg(x,y,p[j][0],p[j][1],p[i][0],p[i][1]));return m;}
function grad(x,y){const e=.3;return[(H(x+e,y)-H(x-e,y))/(2*e),(H(x,y+e)-H(x,y-e))/(2*e)];}
/* current hole */
function greenOf(h){const e=h.p[h.p.length-1];return GREENS.find(g=>inP(g,e[0],e[1]))||GREENS.reduce((a,g)=>Math.hypot(g.cx-e[0],g.cy-e[1])<Math.hypot(a.cx-e[0],a.cy-e[1])?g:a);}
function pinOf(h,g){const e=h.p[h.p.length-1];let best=null,bd=1e9;for(const q of(D.pins||[])){if(!inP(g,q[0],q[1]))continue;const d=Math.hypot(q[0]-e[0],q[1]-e[1]);if(d<bd){bd=d;best={x:q[0],y:q[1]};}}if(best)return best;
  const q=h.p[h.p.length-2],L=Math.hypot(e[0]-q[0],e[1]-q[1]),ux=(e[0]-q[0])/L,uy=(e[1]-q[1])/L,c={x:g.cx+ux*3+uy*2.5,y:g.cy+uy*3-ux*2.5};return inP(g,c.x,c.y)?c:{x:g.cx,y:g.cy};}
let HOLE,H1,HOLE_LEN,H1end,GREEN1,PIN,PAR;
function computeHole(i){HOLE=HOLES[i];H1=HOLE.p;HOLE_LEN=plLen(H1);H1end=H1[H1.length-1];PAR=+HOLE.par||4;GREEN1=greenOf(HOLE);PIN=pinOf(HOLE,GREEN1);}
computeHole(0);

function nearGreenEdge(x,y){for(const g of GREENS){if(x<g.x0-2||x>g.x1+2||y<g.y0-2||y>g.y1+2)continue;const p=g.p;for(let i=1;i<p.length;i++)if(dSeg(x,y,p[i-1][0],p[i-1][1],p[i][0],p[i][1])<1.8)return true;}return false;}
function lieAt(x,y){
  if(!inP(MAIN,x,y))return'oob';
  for(const w of WATER)if(inP(w,x,y))return'water';
  for(const g of GREENS)if(inP(g,x,y))return'green';
  for(const b of BUNKERS)if(inP(b,x,y))return'bunker';
  for(const t of TEES)if(inP(t,x,y))return'tee';
  if(nearGreenEdge(x,y))return'fringe';
  for(const f of FAIRWAYS)if(inP(f,x,y))return'fairway';
  return'rough';}
const LIE_NAME={water:'Water',tee:'Tee box',fairway:'Fairway',rough:'Rough',bunker:'Bunker',fringe:'Fringe',green:'Green',oob:'Out of bounds'};

/* ---------- three.js scene ---------- */
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(basePR()*DRS);renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
const scene=new THREE.Scene();
const SKY=0xb4bcc6;scene.background=new THREE.Color(SKY);scene.fog=new THREE.Fog(SKY,220,1200);
const camera=new THREE.PerspectiveCamera(45,1,0.05,6000);
const HEMI=new THREE.HemisphereLight(0xd3dae2,0x485a36,0.62);scene.add(HEMI);let TOD='mid';try{TOD=localStorage.getItem('dg-tod')||'mid';}catch(e){}const SUNOFF=new THREE.Vector3(-15.4,23,11.5),WARM={value:0};
const sun=new THREE.DirectionalLight(0xffeccf,1.95);sun.position.set(-200,300,150);scene.add(sun,sun.target);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;sun.castShadow=true;sun.shadow.mapSize.set(MOBILE?1024:2048,MOBILE?1024:2048);Object.assign(sun.shadow.camera,{left:-4.5,right:4.5,top:4.5,bottom:-4.5,near:1,far:80});sun.shadow.bias=-.0006;sun.shadow.camera.updateProjectionMatrix();
function V(x,y,z){return new THREE.Vector3(x,z,-y);}
const TL0=new THREE.TextureLoader(),HASA=!!window.ASSETS;
function dTex(k,srgb){if(!HASA)return null;const t=TL0.load(ASSETS[k]);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=renderer.capabilities.getMaxAnisotropy();if(srgb)t.encoding=THREE.sRGBEncoding;return t;}
const dGrass=dTex('grass'),dRough=dTex('rough'),dSand=dTex('sand'),nGrass=dTex('nGrass'),nRough=dTex('nRough'),nSand=dTex('nSand');
const macroT=(()=>{const N=256,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),id=x.createImageData(N,N);const g=[];for(let i=0;i<64*64;i++)g.push(Math.random());
  const vn=(u,v,f)=>{const i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j,s=t=>t*t*(3-2*t),m=f,G=(a,b)=>g[((a%m+m)%m)*64+((b%m+m)%m)];return((G(i,j)*(1-s(fu))+G(i+1,j)*s(fu))*(1-s(fv))+(G(i,j+1)*(1-s(fu))+G(i+1,j+1)*s(fu))*s(fv));};
  for(let y=0;y<N;y++)for(let X=0;X<N;X++){let a=0,amp=.5,f=4;for(let o=0;o<5;o++){a+=amp*vn(X/N*f,y/N*f,f);amp*=.5;f*=2;}const b=vn(X/N*8+.5,y/N*8+.5,8),k=(y*N+X)*4;id.data[k]=a*255;id.data[k+1]=b*255;id.data[k+2]=128;id.data[k+3]=255;}
  x.putImageData(id,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;})();

const BBX=D.box?[{x0:D.box[0],y0:D.box[1],x1:D.box[2],y1:D.box[3]}]:[MAIN].concat(PAR3?[PAR3]:[],RANGE);const X0=Math.floor(Math.min(...BBX.map(b=>b.x0))-70),X1=Math.ceil(Math.max(...BBX.map(b=>b.x1))+70),Y0=Math.floor(Math.min(...BBX.map(b=>b.y0))-70),Y1=Math.ceil(Math.max(...BBX.map(b=>b.y1))+70),WW=X1-X0,HH=Y1-Y0,S=2048;
// surface texture drawn in world meters
const tc=document.createElement('canvas');tc.width=tc.height=S;const ctx=tc.getContext('2d');
ctx.setTransform(S/WW,0,0,-S/HH,-X0*S/WW,Y1*S/HH);
function poly(p){ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)ctx.lineTo(p[i][0],p[i][1]);ctx.closePath();}
ctx.fillStyle='#33502a';ctx.fillRect(X0,Y0,WW,HH);
for(const w of WOODS){ctx.fillStyle='#2b4125';poly(w.p);ctx.fill();}ctx.fillStyle='#3a5d2b';poly(MAIN.p);ctx.fill();if(PAR3){poly(PAR3.p);ctx.fill();}
for(const r of RANGE){ctx.fillStyle='#557f37';poly(r.p);ctx.fill();}
for(let i=0;i<420;i++){const x=X0+rnd()*WW,y=Y0+rnd()*HH,r=8+rnd()*26,gr=ctx.createRadialGradient(x,y,0,x,y,r),lt=rnd()<.5;gr.addColorStop(0,lt?'rgba(190,210,120,.10)':'rgba(20,40,10,.10)');gr.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gr;ctx.fillRect(x-r,y-r,2*r,2*r);}
for(let i=0;i<26000;i++){const x=X0+rnd()*WW,y=Y0+rnd()*HH;ctx.fillStyle=rnd()<.5?'rgba(0,0,0,.07)':'rgba(255,255,230,.05)';ctx.fillRect(x,y,.5+rnd()*1.4,.5+rnd()*1.4);}
FAIRWAYS.forEach(f=>{const ang=f.ang;
  ctx.lineJoin='round';ctx.lineWidth=5;ctx.strokeStyle='#426a30';poly(f.p);ctx.stroke();ctx.save();poly(f.p);ctx.fillStyle='#4a7a35';ctx.fill();ctx.clip();ctx.translate(f.cx,f.cy);ctx.rotate(ang);for(let k=-60;k<60;k++){const lt=k%2===0,g=ctx.createLinearGradient(k*7.5,0,k*7.5+7.5,0);g.addColorStop(0,lt?'rgba(225,245,190,.0)':'rgba(10,35,5,.0)');g.addColorStop(.18,lt?'rgba(215,240,190,.05)':'rgba(10,35,5,.045)');g.addColorStop(.82,lt?'rgba(215,240,190,.05)':'rgba(10,35,5,.045)');g.addColorStop(1,lt?'rgba(225,245,190,0)':'rgba(10,35,5,0)');ctx.fillStyle=g;ctx.fillRect(k*7.5,-400,7.5,800);}ctx.restore();
  ctx.lineWidth=1.2;ctx.strokeStyle='rgba(20,50,15,.18)';poly(f.p);ctx.stroke();});
for(const t of TEES){ctx.fillStyle='#4d7f36';poly(t.p);ctx.fill();ctx.lineWidth=.6;ctx.strokeStyle='rgba(255,255,255,.15)';ctx.stroke();}
for(const g of GREENS){ctx.lineWidth=3.6;ctx.strokeStyle='#4a7d35';ctx.lineJoin='round';poly(g.p);ctx.stroke();ctx.fillStyle='#538a3c';ctx.fill();
  ctx.save();poly(g.p);ctx.clip();for(let k=-16;k<16;k++){ctx.fillStyle=k%2?'rgba(225,245,190,.055)':'rgba(10,35,5,.05)';ctx.fillRect(g.cx+k*2.2,g.cy-40,2.2,80);}ctx.restore();}
for(const b of BUNKERS){ctx.lineWidth=1.6;ctx.strokeStyle='rgba(30,50,15,.55)';poly(b.p);ctx.stroke();ctx.fillStyle='#e9dfba';ctx.fill();ctx.save();poly(b.p);ctx.clip();ctx.lineWidth=2.6;ctx.strokeStyle='rgba(130,108,62,.45)';poly(b.p);ctx.stroke();for(let i=0;i<60;i++){ctx.fillStyle=rnd()<.5?'rgba(255,255,255,.18)':'rgba(150,125,80,.14)';ctx.fillRect(b.x0+rnd()*(b.x1-b.x0),b.y0+rnd()*(b.y1-b.y0),.6+rnd(),.3);}ctx.restore();}
ctx.lineCap='round';ctx.lineJoin='round';
for(const p of PATHS){ctx.lineWidth=2.4;ctx.strokeStyle='#aaa697';ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)ctx.lineTo(p[i][0],p[i][1]);ctx.stroke();}
for(const c of CLUBH){ctx.fillStyle='#6f6a63';poly(c.p);ctx.fill();}
for(const w of WATER){ctx.lineWidth=2;ctx.strokeStyle='#5b6b3a';poly(w.p);ctx.stroke();ctx.fillStyle='#35606b';ctx.fill();}
const mc=document.createElement('canvas');mc.width=mc.height=2048;const mx=mc.getContext('2d');mx.setTransform(2048/WW,0,0,-2048/HH,-X0*2048/WW,Y1*2048/HH);
function mpoly(p){mx.beginPath();mx.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)mx.lineTo(p[i][0],p[i][1]);mx.closePath();}
mx.fillStyle='#ff0000';mx.fillRect(X0,Y0,WW,HH);mx.fillStyle='#000';for(const f of FAIRWAYS){mpoly(f.p);mx.fill();}for(const t of TEES){mpoly(t.p);mx.fill();}for(const r of RANGE){mpoly(r.p);mx.fill();}
mx.fillStyle='#0000ff';for(const g of GREENS){mpoly(g.p);mx.fill();}mx.fillStyle='#00ff00';for(const b of BUNKERS){mpoly(b.p);mx.fill();}
mx.lineCap=mx.lineJoin='round';mx.strokeStyle='#ffff00';mx.lineWidth=2.4;for(const p of PATHS){mx.beginPath();mx.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)mx.lineTo(p[i][0],p[i][1]);mx.stroke();}
mx.fillStyle='#ffff00';for(const c of CLUBH){mpoly(c.p);mx.fill();}for(const w of WATER){mpoly(w.p);mx.fill();}const maskT=new THREE.CanvasTexture(mc);
const tex=new THREE.CanvasTexture(tc);tex.anisotropy=renderer.capabilities.getMaxAnisotropy();

const GS=WW*HH>1.8e6?3:(LI?2:2.5),gGeo=new THREE.PlaneGeometry(WW,HH,Math.round(WW/GS),Math.round(HH/GS));gGeo.rotateX(-Math.PI/2);
{const pos=gGeo.attributes.position,cx=(X0+X1)/2,cy=(Y0+Y1)/2;for(let i=0;i<pos.count;i++){const x=pos.getX(i)+cx,z=pos.getZ(i)-cy;pos.setX(i,x);pos.setZ(i,z);pos.setY(i,H(x,-z));}gGeo.computeVertexNormals();}
const detail=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),id=g.createImageData(256,256);
  for(let i=0;i<256*256;i++){const a=Math.random(),b=Math.random();id.data[i*4]=110+a*110;id.data[i*4+1]=90+b*150;id.data[i*4+2]=128;id.data[i*4+3]=255;}g.putImageData(id,0,0);
  for(let i=0;i<260;i++){g.fillStyle='rgba('+(Math.random()<.5?'60,60,60':'200,200,200')+',.12)';g.beginPath();g.arc(Math.random()*256,Math.random()*256,4+Math.random()*14,0,7);g.fill();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;})();
const gmat=new THREE.MeshLambertMaterial({map:tex});
if(HASA)gmat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{mMask:{value:maskT},dG:{value:dGrass},dR:{value:dRough},dS:{value:dSand},nG:{value:nGrass},nR:{value:nRough},nS:{value:nSand},mT:{value:macroT},lDir:{value:new THREE.Vector3(-15.4,23,11.5).normalize()},rep:{value:new THREE.Vector2(WW,HH)}});
  sh.fragmentShader=sh.fragmentShader.replace('uniform vec3 diffuse;','uniform vec3 diffuse;\nuniform sampler2D mMask,dG,dR,dS,nG,nR,nS,mT;uniform vec3 lDir;uniform vec2 rep;').replace('#include <map_fragment>','#include <map_fragment>\n vec4 mk=texture2D(mMask,vUv);vec2 w=vUv*rep;\n vec3 g=mix(texture2D(dG,w/1.7).rgb,texture2D(dG,w/11.3+.37).rgb,.42)*2.;\n vec3 gf=mix(texture2D(dG,w/.8).rgb,texture2D(dG,w/6.1+.21).rgb,.5)*2.;\n vec3 r=mix(texture2D(dR,w/1.9).rgb,texture2D(dR,w/13.7+.61).rgb,.45)*2.;\n vec3 s=mix(texture2D(dS,w/7.).rgb,texture2D(dS,w/19.+.3).rgb,.3)*2.;\n float pth=min(mk.r,mk.g),ro=mk.r-pth,sa=mk.g-pth,gr=mk.b;sa=smoothstep(.3,.7,sa);gr=smoothstep(.2,.8,gr);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.71,.5),sa*.85);\n vec3 d=g;d=mix(d,mix(vec3(1.),gf,.55),gr);d=mix(d,r,ro);d=mix(d,s,sa);d=mix(d,vec3(1.),pth);\n d=mix(vec3(dot(d,vec3(.333))),d,.6);d=clamp(vec3(1.)+(d-vec3(1.))*1.9,vec3(.5),vec3(1.6));\n vec3 nf=texture2D(nG,w/1.7).xyz*2.-1.,nr=texture2D(nR,w/1.9).xyz*2.-1.,nn=normalize(mix(mix(mix(nf,vec3(0.,0.,1.),.35*gr),nr,ro),texture2D(nS,w/7.).xyz*2.-1.,sa));vec3 nw=normalize(vec3(nn.x,nn.z,-nn.y));\n float lit=clamp(dot(nw,lDir)/max(lDir.y,.2),.45,1.5);d*=mix(1.,lit,(1.-pth)*(.55-.15*sa));\n vec2 mm=texture2D(mT,w/160.).rg,m2=texture2D(mT,w/41.+.3).rg;float mac=mm.r*.65+m2.r*.35;vec3 tint=mix(vec3(.86,.9,.82),vec3(1.1,1.07,.95),mac);tint=mix(tint,vec3(1.08,1.02,.86),smoothstep(.62,.8,m2.g)*ro*.8);d*=mix(vec3(1.),tint,(1.-sa)*(1.-pth)*(ro*.9+.45*(1.-ro))*(1.-.6*gr));diffuseColor.rgb*=pow(max(d,vec3(0.)),vec3(1.45));diffuseColor.rgb*=mix(vec3(.65,.7,.64),vec3(1.),sa);');};
const ground=new THREE.Mesh(gGeo,gmat);ground.receiveShadow=true;scene.add(ground);
/* bunkers get their own 35 cm mesh so the lip, face and floor actually show; the coarse ground under them is tucked away */
{const gp=gGeo.attributes.position;for(let i=0;i<gp.count;i++){const x=gp.getX(i),y=-gp.getZ(i);for(const b of BUNKERS){if(x<b.x0||x>b.x1||y<b.y0||y>b.y1)continue;if(inP(b,x,y)){gp.setY(i,gp.getY(i)-.7);break;}}}gp.needsUpdate=true;gGeo.computeVertexNormals();
 const gB=gmat.clone();gB.onBeforeCompile=gmat.onBeforeCompile;gB.customProgramCacheKey=gmat.customProgramCacheKey;gB.polygonOffset=true;gB.polygonOffsetFactor=-1;gB.polygonOffsetUnits=-4;
 for(const b of BUNKERS.filter(b=>b.cx>X0&&b.cx<X1&&b.cy>Y0&&b.cy<Y1&&HOLES.some(h=>dPL(b.cx,b.cy,h.p)<75))){const st=.35,m=2.8,x0=b.x0-m,y0=b.y0-m,nx=Math.ceil((b.x1-b.x0+2*m)/st)+1,ny=Math.ceil((b.y1-b.y0+2*m)/st)+1,P=new Float32Array(nx*ny*3),U=new Float32Array(nx*ny*2),I=[];
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const x=x0+i*st,y=y0+j*st,k=j*nx+i;P[k*3]=x;P[k*3+1]=H(x,y);P[k*3+2]=-y;U[k*2]=(x-X0)/WW;U[k*2+1]=(y-Y0)/HH;if(i<nx-1&&j<ny-1)I.push(k,k+1,k+nx,k+1,k+nx+1,k+nx);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('uv',new THREE.BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();const mm=new THREE.Mesh(g,gB);mm.receiveShadow=true;scene.add(mm);}}

/* terrain drawn as tiles: only tiles in view are drawn, and far tiles use every other grid line */
const TERR=[];
{const NX=Math.round(WW/GS),NY=Math.round(HH/GS),RW=NX+1,T=Math.max(4,Math.round(Math.max(WW,HH)/180)),si=Math.ceil(NX/T/2)*2,sj=Math.ceil(NY/T/2)*2,P=gGeo.attributes.position;
  for(let j0=0;j0<NY;j0+=sj)for(let i0=0;i0<NX;i0+=si){const i1=Math.min(NX,i0+si),j1=Math.min(NY,j0+sj);
    const mk=st=>{const I=[];for(let j=j0;j<j1;j+=st)for(let i=i0;i<i1;i+=st){const a=j*RW+i,ii=Math.min(st,i1-i),jj=Math.min(st,j1-j),b=a+ii,c=a+jj*RW,d=c+ii;I.push(a,c,b,b,c,d);}
      const g=new THREE.BufferGeometry();for(const k in gGeo.attributes)g.setAttribute(k,gGeo.attributes[k]);g.setIndex(I);return g;};
    const full=mk(1),half=mk(2);let mn=new THREE.Vector3(1e9,1e9,1e9),mx=new THREE.Vector3(-1e9,-1e9,-1e9),v=new THREE.Vector3();
    for(let j=j0;j<=j1;j+=2)for(let i=i0;i<=i1;i+=2){v.fromBufferAttribute(P,Math.min(j,NY)*RW+Math.min(i,NX));mn.min(v);mx.max(v);}
    const box=new THREE.Box3(mn,mx).expandByScalar(4),sph=box.getBoundingSphere(new THREE.Sphere());for(const g of[full,half]){g.boundingBox=box.clone();g.boundingSphere=sph.clone();}
    const m=new THREE.Mesh(full,gmat);m.receiveShadow=true;m.userData.full=full;m.userData.half=half;m.userData.c=sph.center.clone();m.userData.r=sph.radius;scene.add(m);TERR.push(m);}
  ground.visible=false;}
function updTerrain(){const c=camera.position;for(const m of TERR){const d=m.userData.c.distanceTo(c)-m.userData.r;const g=d>320?m.userData.half:m.userData.full;if(m.geometry!==g)m.geometry=g;}}
function worldGrass(m){if(!HASA)return m;m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,{dR:{value:dRough},nR:{value:nRough},mT:{value:macroT},lDir:{value:new THREE.Vector3(-15.4,23,11.5).normalize()}});
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;uniform sampler2D dR,nR,mT;uniform vec3 lDir;').replace('#include <color_fragment>','#include <color_fragment>\n vec2 w=vec2(vWP.x,-vWP.z);vec3 r=mix(texture2D(dR,w/1.9).rgb,texture2D(dR,w/13.7+.61).rgb,.45)*2.;r=mix(vec3(dot(r,vec3(.333))),r,.6);r=clamp(vec3(1.)+(r-vec3(1.))*1.9,vec3(.5),vec3(1.6));\n vec3 nr=texture2D(nR,w/1.9).xyz*2.-1.;vec3 nw=normalize(vec3(nr.x,nr.z,-nr.y));r*=mix(1.,clamp(dot(nw,lDir)/max(lDir.y,.2),.45,1.5),.55);\n vec2 mm=texture2D(mT,w/160.).rg,m2=texture2D(mT,w/41.+.3).rg;float mac=mm.r*.65+m2.r*.35;r*=mix(vec3(.84,.88,.8),vec3(1.1,1.06,.93),mac);diffuseColor.rgb*=pow(max(r,vec3(0.)),vec3(1.45));');};
  m.customProgramCacheKey=()=>'worldgrass';return m;}
const DMIN=Math.min(...DM.z),HZ=DM.z.reduce((a,b)=>a+b,0)/DM.z.length;
{const g=new THREE.PlaneGeometry((DM.nx-1)*DM.st,(DM.ny-1)*DM.st,DM.nx-1,DM.ny-1);g.rotateX(-Math.PI/2);const pos=g.attributes.position,cx=DM.x0+(DM.nx-1)*DM.st/2,cy=DM.y0+(DM.ny-1)*DM.st/2;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i)+cx,z=pos.getZ(i)-cy;pos.setX(i,x);pos.setZ(i,z);pos.setY(i,demH(x,-z)-1.3);}g.computeVertexNormals();scene.add(new THREE.Mesh(g,worldGrass(new THREE.MeshLambertMaterial({color:0x42602c}))));}
const outer=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),worldGrass(new THREE.MeshLambertMaterial({color:0x3e5a2a})));outer.rotation.x=-Math.PI/2;outer.position.set((X0+X1)/2,DMIN-4,-(Y0+Y1)/2);scene.add(outer);

const WT={value:0};
function swayMat(mt,amp){mt.onBeforeCompile=sh=>{sh.uniforms.uTime=WT;sh.vertexShader='uniform float uTime;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat ph=instanceMatrix[3].x*.21+instanceMatrix[3].z*.17;float yy=max(position.y,0.);transformed.x+=sin(uTime*1.3+ph)*'+amp.toFixed(3)+'*yy*yy;transformed.z+=cos(uTime*1.05+ph*1.3)*'+(amp*.7).toFixed(3)+'*yy*yy;\n#endif');};mt.customProgramCacheKey=()=>'sway'+amp;}
const IMPS=[];let NEAR=null;
/* trees: Pacific Northwest mix, kept out of every hole's playing corridor */
const TREES=[],THASH=new Map();
const CAN=D.canopy?(()=>{const s=atob(D.canopy.b64),a=new Uint8Array(s.length);for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a;})():null;
function canAt(x,y){const c=D.canopy,i=Math.floor((x-c.x0)/c.sx+.5),j=Math.floor((y-c.y0)/c.sy+.5);return(i<0||j<0||i>=c.nx||j>=c.ny)?-1:CAN[j*c.nx+i]/255;}
{const lines=D.holes.filter(h=>h.main||!PAR3).map(h=>({p:h.p,w:+h.par>=4?27:19}));const obst=GREENS.concat(TEES,BUNKERS);
 const TS0=WW*HH>600000?8.5:7;for(let x=X0;x<X1;x+=TS0)for(let y=Y0;y<Y1;y+=TS0){
  const tx=x+rnd()*TS0*.85,ty=y+rnd()*TS0*.85,r=rnd();let ok=false;
   if(WATER.some(w=>inP(w,tx,ty)))continue;
  if(RANGE.some(g=>inP(g,tx,ty))||CLUBH.some(g=>Math.hypot(tx-g.cx,ty-g.cy)<g.R+10))continue;
  if(CAN){const cv=canAt(tx,ty);if(cv>=0){if(FAIRWAYS.some(f=>inP(f,tx,ty))||obst.some(g=>Math.hypot(tx-g.cx,ty-g.cy)<g.R+4)||PATHS.some(p=>dPL(tx,ty,p)<2.5)||lines.some(l=>dPL(tx,ty,l.p)<(l.w>20?11:8)))continue;if(!(r<cv*1.08))continue;
    const fir=rnd()<.62,t={x:tx,y:ty,gz:H(tx,ty),fir,h:fir?13+rnd()*11:11+rnd()*9,r:0,v:Math.floor(rnd()*3)};t.r=fir?t.h*.2:t.h*.4;TREES.push(t);const R2=Math.ceil(t.r/10)+1,cx=Math.floor(tx/10),cy=Math.floor(ty/10);for(let i=-R2;i<=R2;i++)for(let j=-R2;j<=R2;j++){const k=(cx+i)+','+(cy+j);if(!THASH.has(k))THASH.set(k,[]);THASH.get(k).push(t);}continue;}}
  if(inP(MAIN,tx,ty)){if(lines.some(l=>dPL(tx,ty,l.p)<l.w))continue;if(FAIRWAYS.some(f=>inP(f,tx,ty)))continue;if(obst.some(g=>Math.hypot(tx-g.cx,ty-g.cy)<g.R+8))continue;if(PATHS.some(p=>dPL(tx,ty,p)<3))continue;ok=r<.55;}
  else if(PAR3&&inP(PAR3,tx,ty)){if(P3HOLES.some(l=>dPL(tx,ty,l.p)<12))continue;if(obst.some(g=>Math.hypot(tx-g.cx,ty-g.cy)<g.R+5))continue;ok=r<.2;}
  else{if(PATHS.some(p=>dPL(tx,ty,p)<3))continue;ok=r<(WOODS.some(w=>inP(w,tx,ty))?.62:.26);}
  if(!ok)continue;const fir=rnd()<.68;
  const t={x:tx,y:ty,gz:H(tx,ty),fir,h:fir?12+rnd()*13:10+rnd()*8,r:fir?2.6+rnd()*1.8:3.4+rnd()*2.4,v:Math.floor(rnd()*3)};t.r=fir?t.h*.2:t.h*.4;TREES.push(t);
  const R=Math.ceil(t.r/10)+1,cx=Math.floor(tx/10),cy=Math.floor(ty/10);
  for(let i=-R;i<=R;i++)for(let j=-R;j<=R;j++){const k=(cx+i)+','+(cy+j);if(!THASH.has(k))THASH.set(k,[]);THASH.get(k).push(t);}}
 /* tree-line fill: where the aerial canopy map is solid near the course, pack trees tightly (rows of conifers between fairways) */
 if(CAN&&D.canopy){const c=D.canopy,near=(x,y)=>inP(MAIN,x,y)||lines.some(l=>dPL(x,y,l.p)<75),tooClose=(x,y,r)=>{const k=Math.floor(x/10)+','+Math.floor(y/10),L=THASH.get(k);return L?L.some(t=>Math.hypot(t.x-x,t.y-y)<r):false;};
   const tall=/Jefferson/i.test(D.name||'')?1.18:1;let added=0;
   for(let j=0;j<c.ny;j++)for(let i=0;i<c.nx;i++){const cv=CAN[j*c.nx+i]/255;if(cv<.45)continue;const x=c.x0+i*c.sx+(rnd()-.5)*c.sx,y=c.y0+j*c.sy+(rnd()-.5)*c.sy;if(!near(x,y))continue;if(rnd()>(cv-.3)*.55)continue;
     if(WATER.some(w=>inP(w,x,y))||FAIRWAYS.some(f=>inP(f,x,y))||obst.some(g=>Math.hypot(x-g.cx,y-g.cy)<g.R+4)||PATHS.some(p=>dPL(x,y,p)<2.5)||lines.some(l=>dPL(x,y,l.p)<(l.w>20?11:8))||tooClose(x,y,4.2))continue;
     const fir=rnd()<.7,t={x,y,gz:H(x,y),fir,h:(fir?15+rnd()*12:12+rnd()*8)*tall,r:0,v:Math.floor(rnd()*3)};t.r=fir?t.h*.2:t.h*.4;TREES.push(t);added++;const R2=Math.ceil(t.r/10)+1,cx=Math.floor(x/10),cy=Math.floor(y/10);for(let a=-R2;a<=R2;a++)for(let b=-R2;b<=R2;b++){const k=(cx+a)+','+(cy+b);if(!THASH.has(k))THASH.set(k,[]);THASH.get(k).push(t);}}
   console.log('tree-line fill',added,'total',TREES.length);}
 /* each tree is a camera-facing card cut from an 8-angle (fir) / 4-angle (broadleaf) atlas, blended between neighbouring angles */
 const firs=TREES.filter(t=>t.fir),decs=TREES.filter(t=>!t.fir);
 const iq=new THREE.PlaneGeometry(1,1);iq.translate(0,.5,0);
 const impMat=(tex,frames,rows)=>{const m=new THREE.MeshBasicMaterial({map:tex,alphaTest:.42,side:THREE.DoubleSide,toneMapped:false});m.userData.lin=1;
   m.onBeforeCompile=sh=>{sh.uniforms.uF={value:frames};sh.uniforms.uR={value:rows};
     sh.uniforms.uCamP=OCC.uCamP;sh.uniforms.uTgt=OCC.uTgt;sh.uniforms.uOccOn=OCC.uOccOn;sh.uniforms.uOccK=OCC.uOccK;sh.uniforms.uOccDk=OCC.uOccDk;
     sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aVar;uniform float uF,uR;varying vec2 vA,vB;varying float vM,vY;\n'+OCC_VS).replace('#include <project_vertex>',
       'vec3 ctr=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;float sx=length(instanceMatrix[0].xyz),sy=length(instanceMatrix[1].xyz);vec3 toC=cameraPosition-ctr;vec2 hz=normalize(toC.xz+vec2(1e-4,0.));vec3 rt=vec3(hz.y,0.,-hz.x);\n vec3 wp=ctr+rt*position.x*sx+vec3(0.,position.y*sy,0.);vec4 mvPosition=viewMatrix*vec4(wp,1.);gl_Position=projectionMatrix*mvPosition;\n float f=mod(atan(hz.y,hz.x)/6.2831853*uF+uF,uF),f0=floor(f),f1=mod(f0+1.,uF),row=uR-1.-aVar;vM=f-f0;vA=vec2((f0+uv.x)/uF,(row+uv.y)/uR);vB=vec2((f1+uv.x)/uF,(row+uv.y)/uR);vY=uv.y;vOcc=occAt(ctr,sx,sy);');
     sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vA,vB;varying float vM,vY;\n'+OCC_FS).replace('#include <map_fragment>',OCC_DISCARD+'vec4 texelColor=mix(texture2D(map,vA),texture2D(map,vB),vM);texelColor=mapTexelToLinear(texelColor);diffuseColor*=texelColor;diffuseColor.rgb*=.8+.2*smoothstep(0.,.45,vY);'+OCC_DARK);};
   m.customProgramCacheKey=()=>'imp'+frames+'x'+rows;return m;};
 const ldT=k=>{const t=TL0.load(ASSETS[k]);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;};
 const mkImp=(list,tex,frames,rows,ratio,aspect)=>{const M=new THREE.InstancedMesh(iq,impMat(tex,frames,rows),Math.max(1,list.length)),av=new Float32Array(Math.max(1,list.length)),m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),c=new THREE.Color();
   list.forEach((t,i)=>{const v=rows>1?t.v:0,hh=t.h*ratio[v];av[i]=v;m.compose(V(t.x,t.y,t.gz-.3),q,s.set(hh*aspect,hh,1));M.setMatrixAt(i,m);const k=.84+rnd()*.16;M.setColorAt(i,rows>1?c.setRGB(k*(.96+rnd()*.06),k,k*(.94+rnd()*.06)):c.setRGB(k*.82,k*.95,k*.74));});
   iq.setAttribute('aVar',new THREE.InstancedBufferAttribute(av,1));M.geometry=iq.clone();M.geometry.setAttribute('aVar',new THREE.InstancedBufferAttribute(av,1));M.count=list.length;M.frustumCulled=false;M.userData.lin=1;M.userData.imp={list,tex,frames,rows,ratio,aspect,av,mats:M.instanceMatrix.array.slice(),cols:M.instanceColor?M.instanceColor.array.slice():null};IMPS.push(M);return M;};
 if(HASA){scene.add(mkImp(firs,ldT('firAtlas'),8,3,[1.267,1.161,1.546],.8),mkImp(decs,ldT('broadAtlas'),4,1,[1.03],1));}
 const SD=[.8,.6],SA=Math.atan2(SD[1],SD[0]);
 for(const t of TREES){if(t.x<X0-30||t.x>X1+30||t.y<Y0-30||t.y>Y1+30)continue;const len=t.h*.83;
   ctx.save();ctx.translate(t.x+SD[0]*len*.5,t.y+SD[1]*len*.5);ctx.rotate(SA);ctx.scale(len*.55+t.r*.7,t.r*.95);
   const gr=ctx.createRadialGradient(0,0,0,0,0,1);gr.addColorStop(0,'rgba(8,26,6,.4)');gr.addColorStop(.65,'rgba(8,26,6,.22)');gr.addColorStop(1,'rgba(8,26,6,0)');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(0,0,1,0,7);ctx.fill();ctx.restore();}
 tex.needsUpdate=true;}
/* sky with drifting clouds */
const sunDir=new THREE.Vector3(-200,300,150).normalize();
let skyRes;const skyReady=new Promise(r=>skyRes=r);const skyT=HASA?TL0.load(ASSETS.sky,()=>skyRes(),undefined,()=>skyRes()):(skyRes(),null);if(skyT){skyT.minFilter=THREE.LinearFilter;skyT.generateMipmaps=false;}
const SKYROT=-.298;
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{sunDir:{value:sunDir},t:{value:0},sky:{value:skyT},rot:{value:SKYROT},uLin:LINQ,uWarm:WARM},
  vertexShader:'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec3 vD;uniform sampler2D sky;uniform float rot,uLin,uWarm;void main(){vec3 d=normalize(vD);float u=fract(atan(d.z,d.x)*.1591549+.5+rot);float v=max(asin(clamp(d.y,-1.,1.))*.3183099+.5,.503);vec3 sc=texture2D(sky,vec2(u,v)).rgb;sc=mix(vec3(dot(sc,vec3(.299,.587,.114))),sc,.8);float hz=1.-smoothstep(.5,.72,v);sc=mix(sc,vec3(.8,.83,.86),.18*hz);sc*=mix(vec3(1.),mix(vec3(.78,.8,.92),vec3(1.16,.9,.66),hz),uWarm);if(uLin>.5)sc=pow(sc,vec3(2.2));gl_FragColor=vec4(sc,1.);}'});
const sky=new THREE.Mesh(new THREE.SphereGeometry(4000,32,16),skyMat);sky.frustumCulled=false;sky.renderOrder=-1;scene.add(sky);
/* ponds: animated ripples, fresnel sky reflection and a sun glint */
if(WATER.length&&skyT){const wm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{sky:{value:skyT},rot:{value:SKYROT},t:WT,sun:{value:sunDir},uLin:LINQ,fogC:{value:new THREE.Color(SKY)},fogN:{value:scene.fog.near},fogF:{value:scene.fog.far}},
  vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:'uniform sampler2D sky;uniform float rot,t,uLin,fogN,fogF;uniform vec3 sun,fogC;varying vec3 vW;vec3 skyS(vec3 d){float u=fract(atan(d.z,d.x)*.1591549+.5+rot);float v=max(asin(clamp(d.y,-1.,1.))*.3183099+.5,.503);return texture2D(sky,vec2(u,v)).rgb;}\n'+
   'void main(){vec2 p=vW.xz;float a=t*1.2;vec3 n=normalize(vec3(.05*sin(p.x*1.7+a)+.035*sin(p.x*3.1-p.y*2.3+a*1.7)+.018*sin(p.y*7.+a*2.3),1.,.045*cos(p.y*1.9+a*1.1)+.03*sin(p.x*2.7+p.y*1.3-a*1.4)+.018*cos(p.x*6.3-a*2.)));'+
   'vec3 v=normalize(cameraPosition-vW);vec3 r=reflect(-v,n);r.y=abs(r.y);float fr=.03+.97*pow(1.-max(dot(n,v),0.),5.);vec3 c=mix(vec3(.03,.075,.08),skyS(r),clamp(fr*1.1+.1,0.,1.));c+=vec3(1.,.95,.85)*pow(max(dot(r,normalize(sun)),0.),180.)*1.5;'+
   'c=mix(c,fogC,smoothstep(fogN,fogF,length(cameraPosition-vW)));if(uLin>.5)c=pow(c,vec3(2.2));gl_FragColor=vec4(c,.95);}'});
  for(const w of WATER){if(w.creek){const l=w.line,P=[],I=[];for(let i=0;i<l.length;i++){const a=l[Math.max(0,i-1)],b=l[Math.min(l.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy)||1,nx=-dy/n,ny=dx/n;for(const s of[-1.5,1.5]){const x=l[i][0]+nx*s,y=l[i][1]+ny*s,v=V(x,y,H(l[i][0],l[i][1])+.05);P.push(v.x,v.y,v.z);}if(i){const k=(i-1)*2;I.push(k,k+1,k+2,k+1,k+3,k+2);}}
      const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(P,3));cg.setIndex(I);const cm=new THREE.Mesh(cg,wm);cm.renderOrder=1;scene.add(cm);continue;}
    const g=new THREE.ShapeGeometry(new THREE.Shape(w.p.map(q=>new THREE.Vector2(q[0],q[1]))),2);g.rotateX(-Math.PI/2);let lv=1e9;for(const q of w.p)lv=Math.min(lv,baseH(q[0],q[1]));const m=new THREE.Mesh(g,wm);m.position.y=lv-.12;m.renderOrder=1;scene.add(m);}}
/* distant horizon: hills, Mount Rainier to the southeast, downtown skyline to the north */
const CEN={x:MAIN.cx,y:MAIN.cy};
{const N=160,pos=[],idx=[],R=2250;for(let i=0;i<=N;i++){const a=i/N*Math.PI*2,x=CEN.x+Math.cos(a)*R,y=CEN.y+Math.sin(a)*R,top=12+22*Math.abs(Math.sin(a*7.3)*Math.cos(a*3.1))+8*Math.sin(a*19);pos.push(x,HZ-60,-y,x,HZ+top,-y);if(i<N){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);scene.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x8ea4a4,fog:false,side:THREE.DoubleSide})));}
{const g=new THREE.ConeGeometry(430,140,72,8),p=g.attributes.position,col=[],cS=new THREE.Color(0xeef3f6).convertSRGBToLinear(),cR=new THREE.Color(0x8497a8).convertSRGBToLinear(),tmp=new THREE.Color();
 for(let i=0;i<p.count;i++){const y=p.getY(i),x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z);if(r>1){const a=Math.atan2(z,x),k=1+.08*Math.sin(a*9)+.05*Math.sin(a*23);p.setX(i,x*k);p.setZ(i,z*k);}const u=(y+70)/140+.06*Math.sin(Math.atan2(z,x)*13);tmp.copy(u>.5?cS:cR);col.push(tmp.r,tmp.g,tmp.b);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();const rn=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,fog:false}));rn.userData.lin=1;rn.material.userData.lin=1;
 rn.position.copy(V(CEN.x+.574*2450,CEN.y-.819*2450,40+HZ));if(!ASSETS.rainier)scene.add(rn);}
/* Mount Rainier: a public-domain NPS photograph ("Mount Rainier in Winter"), cut out of its sky and stood on the south-east horizon */
if(ASSETS.rainier){const t=new THREE.TextureLoader().load(ASSETS.rainier);t.encoding=THREE.sRGBEncoding;t.anisotropy=8;const Wm=880,Hm=Wm*2/3;
  const mm=new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,fog:false,toneMapped:false,color:new THREE.Color(.86,.9,.98)});mm.userData.lin=1;
  const pl=new THREE.Mesh(new THREE.PlaneGeometry(Wm,Hm),mm);const dx=.574,dy=-.819,D=2600;pl.position.copy(V(CEN.x+dx*D,CEN.y+dy*D,HZ+Hm*.5-Hm*.34));pl.lookAt(V(CEN.x,CEN.y,HZ+Hm*.3));pl.renderOrder=-1;pl.frustumCulled=false;scene.add(pl);}
{const grp=new THREE.Group(),bm=new THREE.MeshLambertMaterial({color:0xa3b2bc,fog:false}),bm2=new THREE.MeshLambertMaterial({color:0x93a6b4,fog:false}),dx=window.COURSE.down[0],dy=window.COURSE.down[1],px=-dy,py=dx,D=2300;
 for(let i=0;i<34;i++){const off=(rnd()-.5)*520,dep=(rnd()-.5)*140,tall=Math.abs(off)<120?40+rnd()*85:14+rnd()*45,w=16+rnd()*26;const b=new THREE.Mesh(new THREE.BoxGeometry(w,tall,w*(.7+rnd()*.6)),rnd()<.5?bm:bm2);b.position.copy(V(CEN.x+dx*(D+dep)+px*off,CEN.y+dy*(D+dep)+py*off,tall/2-4));grp.add(b);}
 const nx=window.COURSE.needle[0],ny=window.COURSE.needle[1],sm=new THREE.MeshLambertMaterial({color:0xc2ccd2,fog:false}),NP=V(CEN.x+nx*2350+px*-260,CEN.y+ny*2350+py*-260,0);
 const sh=new THREE.Mesh(new THREE.CylinderGeometry(2.2,3.4,52,8),sm);sh.position.copy(NP).add(new THREE.Vector3(0,26,0));grp.add(sh);const sc=new THREE.Mesh(new THREE.CylinderGeometry(11,8,4,20),sm);sc.position.copy(NP).add(new THREE.Vector3(0,53,0));grp.add(sc);const sp=new THREE.Mesh(new THREE.CylinderGeometry(.4,.9,10,6),sm);sp.position.copy(NP).add(new THREE.Vector3(0,60,0));grp.add(sp);grp.position.y=HZ;scene.add(grp);}
/* grass tufts around the ball in play */
const bladeTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');for(let i=0;i<14;i++){const bx=10+Math.random()*108,tx=bx+(Math.random()-.5)*30,ty=10+Math.random()*55,w=1.6+Math.random()*2.2;const gr=g.createLinearGradient(0,128,0,ty);gr.addColorStop(0,'rgb(150,170,125)');gr.addColorStop(1,'rgb(255,255,225)');g.fillStyle=gr;g.beginPath();g.moveTo(bx-w,128);g.quadraticCurveTo((bx+tx)/2-w*.5,(128+ty)/2,tx,ty);g.quadraticCurveTo((bx+tx)/2+w*.5,(128+ty)/2,bx+w,128);g.fill();}return new THREE.CanvasTexture(c);})();
const tuftGeo=(()=>{const g=new THREE.BufferGeometry(),P=[],U=[],N=[],I=[];for(let k=0;k<2;k++){const a=k*Math.PI/2,cx=Math.cos(a)*.5,cz=Math.sin(a)*.5,b=k*4;P.push(-cx,0,-cz,cx,0,cz,cx,1,cz,-cx,1,-cz);U.push(k*.5,0,k*.5+.5,0,k*.5+.5,.25,k*.5,.25);N.push(0,1,0,0,1,0,0,1,0,0,1,0);I.push(b,b+1,b+2,b,b+2,b+3);}
 g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setIndex(I);return g;})();
const grassAt=HASA?(()=>{const t=TL0.load(ASSETS.grassAtlas);t.anisotropy=4;return t;})():bladeTex;const tuftMat=new THREE.MeshLambertMaterial({map:grassAt,alphaTest:.4,side:THREE.DoubleSide});swayMat(tuftMat,.09);{const ob=tuftMat.onBeforeCompile;tuftMat.onBeforeCompile=sh=>{ob(sh);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aTV;').replace('#include <uv_vertex>','#include <uv_vertex>\nvUv.y+=aTV*.25;');sh.fragmentShader=sh.fragmentShader.replace(/gl_FrontFacing/g,'true');};tuftMat.customProgramCacheKey=()=>'tuft2';}let tufts=null;
const TUFT={rough:{p:.34,h:[.14,.22],c:0xcfe0b6,v:[2,3]},fairway:{p:.2,h:[.07,.11],c:0xd6e6c0,v:[0,1]},fringe:{p:.26,h:[.09,.13],c:0xd3e4bc,v:[0,1]},tee:{p:.1,h:[.06,.09],c:0xd6e6c0,v:[0,1]}};
const PGRID=new Uint8Array(WW*HH);for(const p of PATHS)for(let i=1;i<p.length;i++){const ax=p[i-1][0],ay=p[i-1][1],L=Math.hypot(p[i][0]-ax,p[i][1]-ay);for(let t=0;t<=L;t+=.5){const x=ax+(p[i][0]-ax)*t/(L||1),y=ay+(p[i][1]-ay)*t/(L||1);for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++){const gx=Math.floor(x-X0)+dx,gy=Math.floor(y-Y0)+dy;if(gx>=0&&gy>=0&&gx<WW&&gy<HH)PGRID[gy*WW+gx]=1;}}}
function onPath(x,y){const gx=Math.floor(x-X0),gy=Math.floor(y-Y0);return gx>=0&&gy>=0&&gx<WW&&gy<HH&&PGRID[gy*WW+gx]===1;}
function buildTufts(x0,y0){if(tufts){scene.remove(tufts);tufts.geometry.dispose();}const list=[];
 for(let i=0,NT=MOBILE?13000:20000,NN=MOBILE?5000:7000;i<NT;i++){const r=(i<NN?6:26)*Math.sqrt(Math.random()),a=Math.random()*6.283,x=x0+Math.cos(a)*r,y=y0+Math.sin(a)*r;if(r<.6)continue;if(GREENS.some(g=>Math.hypot(x-g.cx,y-g.cy)<g.R+4)||onPath(x,y))continue;const L=TUFT[lieAt(x,y)];if(!L||Math.random()>L.p)continue;list.push([x,y,L]);}
 const M=new THREE.InstancedMesh(tuftGeo,tuftMat,Math.max(1,list.length)),m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),c=new THREE.Color(),AX=new THREE.Vector3(0,1,0);
 const tv=new Float32Array(Math.max(1,list.length));list.forEach((t,i)=>{const L=t[2],hh=L.h[0]+Math.random()*(L.h[1]-L.h[0]);tv[i]=L.v[Math.random()<.5?0:1];q.setFromAxisAngle(AX,Math.random()*6.28);m.compose(V(t[0],t[1],H(t[0],t[1])-.015),q,s.set(hh,hh,hh));M.setMatrixAt(i,m);c.set(L.c).offsetHSL((Math.random()-.5)*.03,0,(Math.random()-.5)*.06);M.setColorAt(i,c);});M.geometry=tuftGeo.clone();M.geometry.setAttribute('aTV',new THREE.InstancedBufferAttribute(tv,1));
 M.count=list.length;M.frustumCulled=false;tufts=M;linearize(M);scene.add(M);}
/* sRGB authoring -> linear lighting */
const _c=new THREE.Color();
function linearize(root){root.traverse(o=>{if(o.isInstancedMesh&&o.instanceColor&&!o.userData.lin){o.userData.lin=1;const a=o.instanceColor.array;for(let i=0;i<a.length;i+=3){_c.fromArray(a,i).convertSRGBToLinear().toArray(a,i);}o.instanceColor.needsUpdate=true;}
  const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of ms){if(m.userData.lin||m.isShaderMaterial)continue;m.userData.lin=1;if(m.color)m.color.convertSRGBToLinear();if(m.emissive)m.emissive.convertSRGBToLinear();if(m.map){m.map.encoding=THREE.sRGBEncoding;m.map.needsUpdate=true;}m.needsUpdate=true;}});}
/* trunks are solid; crowns are foliage and thin branches the ball can pass through (slowed), with a small chance of catching a thick limb */
function treePart(x,y,z){const a=THASH.get(Math.floor(x/10)+','+Math.floor(y/10));if(!a)return null;let fol=null;
  for(const t of a){const d=Math.hypot(x-t.x,y-t.y);if(d>t.r+.5)continue;const zz=z-t.gz;if(zz<0)continue;
    const top=t.fir?t.h*.7:t.h*.5,tr=(.13+t.h*.007)*(1-.75*Math.min(1,zz/top));if(zz<top&&d<tr)return{t,trunk:true};/* trunk tapers toward the top */
    if(t.fir){if(zz>2&&zz<t.h){const r=t.r*.85*(t.h-zz)/(t.h-2);if(d<r)fol=fol||{t,trunk:false};}}
    else{const dz=zz-t.h*.62;if(Math.hypot(d,dz/.92)<t.r*.8)fol=fol||{t,trunk:false};}}
  return fol;}
function trunkSeg(x0,y0,z0,x1,y1,z1){const cells=new Set([Math.floor(x0/10)+','+Math.floor(y0/10),Math.floor(x1/10)+','+Math.floor(y1/10)]);const vx=x1-x0,vy=y1-y0,L2=vx*vx+vy*vy||1e-9;
  for(const key of cells){const a=THASH.get(key);if(!a)continue;for(const t of a){let u=((t.x-x0)*vx+(t.y-y0)*vy)/L2;u=Math.max(0,Math.min(1,u));const cx=x0+vx*u,cy=y0+vy*u,d=Math.hypot(t.x-cx,t.y-cy);if(d>1.2)continue;
    const zz=z0+(z1-z0)*u-t.gz,top=t.fir?t.h*.7:t.h*.5;if(zz<0||zz>top)continue;const tr=(.13+t.h*.007)*(1-.75*zz/top)+.021;if(d<tr)return{t,u,x:cx,y:cy,z:z0+(z1-z0)*u};}}return null;}
function treeHit(x,y,z){const a=THASH.get(Math.floor(x/10)+','+Math.floor(y/10));if(!a)return null;
  for(const t of a){const d=Math.hypot(x-t.x,y-t.y);if(d>t.r+.5)continue;const zz=z-t.gz;
    if(d<.35&&zz<(t.fir?2.5:t.h*.55))return t;
    if(t.fir){if(zz>2&&zz<t.h){const r=t.r*(t.h-zz)/(t.h-2);if(d<r)return t;}}
    else{const dz=zz-t.h*.62;if(Math.hypot(d,dz/.92)<t.r*.9)return t;}}
  return null;}

/* flag, cup, markers */
const flagG=new THREE.Group();
{const pole=new THREE.Mesh(new THREE.CylinderGeometry(.013,.017,2.32,12),new THREE.MeshStandardMaterial({color:0xf4f3ee,roughness:.35,metalness:.1}));pole.position.y=1.16;pole.castShadow=true;flagG.add(pole);
 const FW=.78,FH=.5,fg=new THREE.PlaneGeometry(FW,FH,30,12);fg.translate(FW/2,-FH/2,0);fg.userData.rest=fg.attributes.position.array.slice();
 const fc=document.createElement('canvas');fc.width=512;fc.height=328;const ftex=new THREE.CanvasTexture(fc);ftex.encoding=THREE.sRGBEncoding;ftex.anisotropy=4;
 const fm=new THREE.MeshStandardMaterial({map:ftex,side:THREE.DoubleSide,roughness:.72,metalness:0});fm.userData.lin=1;fm.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','vec2 fUv=gl_FrontFacing?vUv:vec2(1.-vUv.x,vUv.y);vec4 texelColor=texture2D(map,fUv);texelColor=mapTexelToLinear(texelColor);diffuseColor*=texelColor;');};fm.customProgramCacheKey=()=>'flag2s';
 const fl=new THREE.Mesh(fg,fm);fl.position.y=2.3;fl.castShadow=true;flagG.add(fl);flagG.userData.fl=fl;flagG.userData.fc=fc;flagG.userData.ftex=ftex;
 const liner=new THREE.Mesh(new THREE.RingGeometry(.052,.058,28),new THREE.MeshBasicMaterial({color:0xf2f2ee}));liner.rotation.x=-Math.PI/2;liner.position.y=.013;flagG.add(liner);
 const cup=new THREE.Mesh(new THREE.CircleGeometry(.056,24),new THREE.MeshBasicMaterial({color:0x1a1a1a}));cup.rotation.x=-Math.PI/2;cup.position.y=.012;flagG.add(cup);
 flagG.position.copy(V(PIN.x,PIN.y,H(PIN.x,PIN.y)));scene.add(flagG);}

/* flag artwork: deep red with a gold edge, a cream roundel and the hole number */
function drawFlag(n){const c=flagG.userData.fc,x=c.getContext('2d'),W=c.width,H2=c.height;const gr=x.createLinearGradient(0,0,W,H2);gr.addColorStop(0,'#c21f2b');gr.addColorStop(1,'#9d1320');x.fillStyle=gr;x.fillRect(0,0,W,H2);
  x.fillStyle='rgba(255,255,255,.06)';for(let i=0;i<W;i+=6)x.fillRect(i,0,1,H2);
  const cx=W*.5,cy=H2*.52,r=H2*.3;x.fillStyle='#f6f1e4';x.beginPath();x.arc(cx,cy,r,0,7);x.fill();
  x.fillStyle='#9d1320';x.font='800 '+Math.round(r*1.25)+'px "Barlow Condensed","Arial Narrow",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(String(n),cx,cy+r*.06);flagG.userData.ftex.needsUpdate=true;}
/* cloth motion: in calm air the flag hangs against the pole; with wind it streams out, with travelling ripples that grow toward the fly end */
function animFlag(now){const fl=flagG.userData.fl;if(!fl)return;const g=fl.geometry,P=g.attributes.position,R=g.userData.rest,W=.78,sp=Math.max(0,wind.sp||0),lift=Math.min(1,sp/13),hang=(1-lift)*1.25+.06,ch=Math.cos(hang),shn=Math.sin(hang),amp=.025+.045*lift,w1=3.2+sp*.28,w2=5.1+sp*.35;
  for(let i=0;i<P.count;i++){const x=R[i*3],y=R[i*3+1],u=x/W,a=Math.pow(u,1.15);let px=x*ch,py=y-x*shn;
    const z=amp*a*(Math.sin(u*9-now*w1)+.45*Math.sin(u*15.3-now*w2+y*7)+.25*Math.sin(u*23-now*(w2*1.3)+1.3));py+=a*.02*Math.sin(u*11-now*w1+.7)*lift;px-=Math.abs(z)*.35*u;P.setXYZ(i,px,py,z);}
  P.needsUpdate=true;g.computeVertexNormals();}
function spriteTex(draw){const c=document.createElement('canvas');c.width=c.height=64;draw(c.getContext('2d'));return new THREE.CanvasTexture(c);}
const pinMark=new THREE.Sprite(new THREE.SpriteMaterial({map:spriteTex(g=>{g.fillStyle='#f2c230';g.beginPath();g.moveTo(32,60);g.lineTo(10,22);g.arc(32,24,22,Math.PI,0);g.closePath();g.fill();g.fillStyle='#16302a';g.beginPath();g.arc(32,24,8,0,7);g.fill();}),sizeAttenuation:false,depthTest:false}));
pinMark.material.toneMapped=false;pinMark.scale.set(.045,.045,1);pinMark.center.set(.5,0);pinMark.position.copy(V(PIN.x,PIN.y,H(PIN.x,PIN.y)+2.6));pinMark.renderOrder=10;scene.add(pinMark);
const ring=new THREE.Mesh(new THREE.RingGeometry(3.1,3.8,48),new THREE.MeshBasicMaterial({color:0xf2c230,transparent:true,opacity:.9,depthTest:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.renderOrder=9;ring.material.toneMapped=false;scene.add(ring);
function mkLine(color,n,dashed){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setDrawRange(0,0);
  const mat=dashed?new THREE.LineDashedMaterial({color,dashSize:1.2,gapSize:.9,depthTest:false,transparent:true}):new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.85});
  mat.toneMapped=false;const l=new THREE.Line(g,mat);l.renderOrder=8;l.frustumCulled=false;scene.add(l);return l;}
const aimLine=mkLine(0xf2c230,120,true),readLine=mkLine(0xffffff,600,false);
const TRN=700,trGeo=new THREE.BufferGeometry();trGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(TRN*2*3),3));{const I=[];for(let i=0;i<TRN-1;i++){const a=i*2;I.push(a,a+1,a+2,a+1,a+3,a+2);}trGeo.setIndex(I);}trGeo.setDrawRange(0,0);
trGeo.setAttribute('aTS',new THREE.BufferAttribute(new Float32Array(TRN*2*2),2));
const tracer=new THREE.Mesh(trGeo,new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uGlow:{value:new THREE.Color(0x3ccfff)},uCore:{value:new THREE.Color(0xecfcff)},uLin:LINQ},
  vertexShader:'attribute vec2 aTS;varying vec2 vTS;void main(){vTS=aTS;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 uGlow,uCore;uniform float uLin;varying vec2 vTS;void main(){float s=abs(vTS.y),t=vTS.x;float core=1.-smoothstep(0.,.3,s),glow=pow(max(0.,1.-s),1.8);float fade=smoothstep(0.,.5,t)*(.3+.7*t);vec3 tc=mix(uGlow,uCore,core);if(uLin>.5)tc=pow(tc,vec3(2.2));gl_FragColor=vec4(tc,max(core,glow*.85)*fade);}'}));tracer.frustumCulled=false;tracer.renderOrder=7;scene.add(tracer);
const _rv=new THREE.Vector3(),_rt=new THREE.Vector3(),_rs=new THREE.Vector3();
function setRibbon(pts){const a=trGeo.attributes.position,ts=trGeo.attributes.aTS,n=Math.min(pts.length,TRN);for(let i=0;i<n;i++){const q=pts[i],p0=pts[Math.max(0,i-1)],p1=pts[Math.min(n-1,i+1)];_rt.subVectors(p1,p0);if(_rt.lengthSq()<1e-10)_rt.set(1,0,0);_rv.subVectors(camera.position,q);_rs.crossVectors(_rt,_rv);const L=_rs.length()||1,w=Math.max(.03,camera.position.distanceTo(q)*.0065);_rs.multiplyScalar(w/L);a.setXYZ(i*2,q.x+_rs.x,q.y+_rs.y,q.z+_rs.z);a.setXYZ(i*2+1,q.x-_rs.x,q.y-_rs.y,q.z-_rs.z);const t=n>1?i/(n-1):1;ts.setXY(i*2,t,1);ts.setXY(i*2+1,t,-1);}a.needsUpdate=true;ts.needsUpdate=true;trGeo.setDrawRange(0,Math.max(0,(n-1)*6));}
function setLine(l,pts){const a=l.geometry.attributes.position;const n=Math.min(pts.length,a.count);for(let i=0;i<n;i++)a.setXYZ(i,pts[i].x,pts[i].y,pts[i].z);a.needsUpdate=true;l.geometry.setDrawRange(0,n);if(l.material.isLineDashedMaterial)l.computeLineDistances();}

/* golfer avatar: sculpted body, real face from the group photo */
const TEXL=new THREE.TextureLoader(),FACE_T={};
function faceTex(id){const F=window.FACES&&FACES[id];if(!F)return null;if(!FACE_T[id]){FACE_T[id]=TEXL.load(F.tex);FACE_T[id].anisotropy=4;}return FACE_T[id];}
const v3=(x,y,z)=>new THREE.Vector3(x,y,z),UP=v3(0,1,0);
function limb(a,b,r0,r1,mat,par){const d=v3(0,0,0).subVectors(b,a),L=d.length(),m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,L,14),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(UP,d.normalize());par.add(m);return m;}
function blob(p,r,mat,par,sx,sy,sz){const m=new THREE.Mesh(new THREE.SphereGeometry(r,18,14),mat);m.position.copy(p);if(sx)m.scale.set(sx,sy,sz);par.add(m);return m;}
let ENV=null;
function getEnv(){if(ENV)return ENV;try{const img=skyT&&skyT.image;if(!img||!img.width)return null;const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d'),o=-SKYROT*1024;x.drawImage(img,o,0,1024,512);x.drawImage(img,o-1024,0,1024,512);
  const gr=x.createLinearGradient(0,256,0,512);gr.addColorStop(0,'#9aa493');gr.addColorStop(.06,'#557440');gr.addColorStop(1,'#35502a');x.fillStyle=gr;x.fillRect(0,257,1024,255);
  const t=new THREE.CanvasTexture(c);t.mapping=THREE.EquirectangularReflectionMapping;t.encoding=THREE.sRGBEncoding;const pm=new THREE.PMREMGenerator(renderer);ENV=pm.fromEquirectangular(t).texture;pm.dispose();t.dispose();}catch(e){console.warn(e);ENV=null;}return ENV;}
function clubType(i){return i===0?'driver':i<=3?'wood':i<=8?'iron':i<=12?'wedge':'putter';}
const CLUB_LEN={driver:1.1,wood:1.03,iron:.95,wedge:.9,putter:.89};
/* one club built in its own frame: lead hand at origin, shaft down -Y, face toward +X, toe toward +Z */
function fitPutterNeck(hb){const n=hb.userData.neck;if(!n)return;const t=hb.rotation.x,top=new THREE.Vector3(0,.075*Math.cos(t),-.075*Math.sin(t)),A=new THREE.Vector3(.009,.025,.007),B=new THREE.Vector3(.009,.04,.007),C=new THREE.Vector3(.002,.046,.005);
  placeSeg(n[0],A,B);placeSeg(n[1],B,C);placeSeg(n[2],C,top);hb.userData.jn[0].position.copy(B);hb.userData.jn[1].position.copy(C);}
function makeClubs(){const env=getEnv(),S=o=>{const m=new THREE.MeshStandardMaterial(o);if(env)m.envMap=env;return m;};
  const cv=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;f(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=8;return t;};
  if(!window._clubTex){window._clubTex={
    face:cv(512,320,(x,W,H)=>{x.fillStyle='#c4c9ce';x.fillRect(0,0,W,H);for(let y=0;y<H;y++){x.fillStyle=Math.random()<.5?'rgba(255,255,255,.07)':'rgba(0,0,0,.06)';x.fillRect(0,y,W,1);}
      const gr=x.createRadialGradient(W*.5,H*.5,10,W*.5,H*.5,W*.45);gr.addColorStop(0,'rgba(255,255,255,.12)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,W,H);
      for(let k=0;k<15;k++){const y=58+k*14.5;x.fillStyle='rgba(40,44,50,.9)';x.fillRect(72,y,W-150,3.2);x.fillStyle='rgba(255,255,255,.25)';x.fillRect(72,y+3.2,W-150,1);}}),
    badge:cv(512,224,(x,W,H)=>{const r=46;x.beginPath();x.moveTo(r,6);x.lineTo(W-r,6);x.quadraticCurveTo(W-6,6,W-6,r);x.lineTo(W-6,H-r);x.quadraticCurveTo(W-6,H-6,W-r,H-6);x.lineTo(r,H-6);x.quadraticCurveTo(6,H-6,6,H-r);x.lineTo(6,r);x.quadraticCurveTo(6,6,r,6);x.closePath();
      const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#4b5058');g.addColorStop(.5,'#23262b');g.addColorStop(1,'#15171a');x.fillStyle=g;x.fill();x.lineWidth=5;x.strokeStyle='#8d949c';x.stroke();
      x.fillStyle='#d23a2a';x.fillRect(40,H-52,W-80,7);const tg=x.createLinearGradient(0,50,0,160);tg.addColorStop(0,'#ffffff');tg.addColorStop(.5,'#a9b0b8');tg.addColorStop(1,'#eef1f4');
      x.fillStyle=tg;x.font='italic 800 118px "Barlow Condensed","Arial Narrow",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('790',W/2,H/2-10);x.font='700 26px "Barlow Condensed",sans-serif';x.fillStyle='#c6ccd2';x.fillText('D E G E N   F O R G E D',W/2,34);}),
    carbon:cv(128,128,(x,W,H)=>{x.fillStyle='#0d0f12';x.fillRect(0,0,W,H);for(let i=0;i<8;i++)for(let j=0;j<8;j++){const g=x.createLinearGradient(i*16,j*16,i*16+16,j*16+16);const a=(i+j)%2;g.addColorStop(0,a?'#1c1f24':'#0a0b0d');g.addColorStop(1,a?'#2a2e35':'#15171b');x.fillStyle=g;x.fillRect(i*16+1,j*16+1,14,14);}}),
    grip:cv(256,512,(x,W,H)=>{x.fillStyle='#16171a';x.fillRect(0,0,W,H);for(let y=0;y<H;y+=10)for(let xx=(y/10)%2*10;xx<W;xx+=20){x.fillStyle='#24262a';x.beginPath();x.moveTo(xx,y);x.lineTo(xx+10,y+5);x.lineTo(xx,y+10);x.lineTo(xx-10,y+5);x.fill();}
      x.fillStyle='#8a9096';x.fillRect(0,H*.12,W,10);x.fillRect(0,H*.82,W,6);x.fillStyle='#d23a2a';x.fillRect(0,H*.12+14,W,4);})};
    for(const k in window._clubTex){const t=window._clubTex[k];t.encoding=THREE.sRGBEncoding;}window._clubTex.carbon.wrapS=window._clubTex.carbon.wrapT=THREE.RepeatWrapping;window._clubTex.carbon.repeat.set(5,3);}
  const T=window._clubTex;
  const satin=S({color:0xe6e9ec,metalness:.88,roughness:.3}),mirror=S({color:0xeef1f4,metalness:.95,roughness:.1}),steel=S({color:0xe2e5e9,metalness:.9,roughness:.2}),
    faceM=S({map:T.face,color:0xffffff,metalness:1,roughness:.34,side:THREE.DoubleSide}),badgeM=S({map:T.badge,color:0xffffff,metalness:.75,roughness:.3,transparent:true}),
    carbon=S({map:T.carbon,color:0xffffff,metalness:.3,roughness:.22}),blk=S({color:0x17181b,metalness:.6,roughness:.3}),ferr=S({color:0x0c0c0d,metalness:.2,roughness:.25}),
    gripM=S({map:T.grip,color:0xffffff,metalness:0,roughness:.8}),accent=S({color:0xd23a2a,metalness:.3,roughness:.35}),white=S({color:0xf4f4f4,metalness:0,roughness:.5});
  T.face.repeat.set(1/.084,1/.056);T.face.offset.set(-.002/.084,0);
  const out={};
  const seg=(y0,y1,r0,r1,m,par,sg)=>{const c=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,Math.abs(y1-y0),sg||20),m);c.position.y=(y0+y1)/2;par.add(c);return c;};
  const mk=(type,build)=>{const L=CLUB_LEN[type],cg=new THREE.Group();
    const gp=seg(.11,-.165,.0132,.0104,gripM,cg,24);if(type==='putter')gp.scale.set(1.32,1,.95);const cap=new THREE.Mesh(new THREE.SphereGeometry(.0133,20,10,0,Math.PI*2,0,Math.PI/2),gripM);cap.position.y=.11;cg.add(cap);
    const top=-.165,bot=-L+.075;seg(top,bot,.0064,.0045,type==='putter'?mirror:steel,cg,18);
    if(type!=='putter')for(let k=0;k<5;k++){const y=bot+.12+k*.055;const rr=.0045+(.0064-.0045)*((y-bot)/(top-bot));const r=new THREE.Mesh(new THREE.TorusGeometry(rr+.0003,.00045,6,20),steel);r.rotation.x=Math.PI/2;r.position.y=y;cg.add(r);}
    const hg=new THREE.Group(),hb=new THREE.Group();hg.position.y=-L;hb.rotation.x=type==='putter'?.3:.44;hg.add(hb);build(hg,hb);cg.add(hg);cg.userData.hb=hb;cg.userData.hg=hg;cg.visible=false;cg.userData.L=L;out[type]=cg;};
  const wood=k=>(hg,hb)=>{const b=new THREE.Mesh(new THREE.SphereGeometry(.058*k,40,24),carbon);b.scale.set(1.02,.54,1.12);b.position.set(-.035*k,.028*k,.052*k);hb.add(b);
    const sk=new THREE.Mesh(new THREE.SphereGeometry(.0585*k,40,12,0,Math.PI*2,Math.PI*.55,Math.PI*.45),satin);sk.scale.set(1.02,.54,1.12);sk.position.copy(b.position);hb.add(sk);
    const f=new THREE.Mesh(new THREE.SphereGeometry(.0585*k,32,16,-Math.PI*.3,Math.PI*.6,Math.PI*.3,Math.PI*.42),faceM);f.scale.set(1.03,.55,1.13);f.rotation.y=Math.PI/2;f.position.set(-.035*k,.028*k,.052*k);hb.add(f);
    const st=new THREE.Mesh(new THREE.BoxGeometry(.05*k,.0025,.006),accent);st.position.set(-.03*k,.058*k,.052*k);hb.add(st);
    const dot=new THREE.Mesh(new THREE.CylinderGeometry(.0025,.0025,.001,12),white);dot.position.set(.005*k,.059*k,.052*k);hb.add(dot);
    const hs=new THREE.Mesh(new THREE.CylinderGeometry(.0072,.011,.058,16),blk);hs.position.set(0,.029,0);hg.add(hs);const fe=new THREE.Mesh(new THREE.CylinderGeometry(.0068,.0072,.012,16),ferr);fe.position.set(0,.064,0);hg.add(fe);};
  /* hollow-body players iron: thin top line, wide sole, rounded toe, scored satin face, gunmetal badge on the back */
  const blade=(loft,sc)=>(hg,hb)=>{const s=new THREE.Shape();s.moveTo(.006,.004);s.lineTo(.068,.0012);s.bezierCurveTo(.081,.0008,.087,.011,.087,.026);s.bezierCurveTo(.087,.043,.081,.053,.07,.054);
      s.lineTo(.02,.037);s.bezierCurveTo(.012,.0355,.007,.033,.005,.028);s.lineTo(.003,.012);s.bezierCurveTo(.003,.007,.004,.004,.006,.004);
      const D=.02,bt=.0022,eg=new THREE.ExtrudeGeometry(s,{depth:D,bevelEnabled:true,bevelThickness:bt,bevelSize:.0018,bevelSegments:3,curveSegments:18});
      const pa=eg.attributes.position;for(let i=0;i<pa.count;i++){const y=pa.getY(i),z=pa.getZ(i);if(z>0){const t=1-.72*Math.min(1,Math.max(0,y/.055));pa.setZ(i,z*t);}}eg.computeVertexNormals();
      const bl=new THREE.Group();bl.add(new THREE.Mesh(eg,satin));
      const fs=new THREE.Shape(s.getPoints(40).map(p=>new THREE.Vector2(.0435+(p.x-.0435)*.97,.027+(p.y-.027)*.95)));const fg=new THREE.ShapeGeometry(fs,6);const face=new THREE.Mesh(fg,faceM);face.position.z=-bt-.0004;face.rotation.y=Math.PI;face.position.x=0;
      fg.scale(-1,1,1);bl.add(face);
      const bd=new THREE.Mesh(new THREE.PlaneGeometry(.05,.022),badgeM);bd.position.set(.047,.021,D*(1-.72*.021/.055)+bt+.0006);bl.add(bd);
      bl.rotation.y=-Math.PI/2;const lg=new THREE.Group();lg.add(bl);lg.rotation.z=loft;lg.scale.setScalar(sc);hb.add(lg);
      const hs=new THREE.Mesh(new THREE.CylinderGeometry(.0062,.0078,.068,18),satin);hs.position.set(0,.036,.002);hg.add(hs);const fe=new THREE.Mesh(new THREE.CylinderGeometry(.0058,.0062,.012,18),ferr);fe.position.set(0,.075,.002);hg.add(fe);};
  mk('driver',wood(1));mk('wood',wood(.8));mk('iron',blade(.5,1));mk('wedge',blade(.92,1.05));
  mk('putter',(hg,hb)=>{const sat=S({color:0xd6dadf,metalness:.92,roughness:.3}),dk=S({color:0x1a1b1e,metalness:.5,roughness:.35}),red=S({color:0xc8202c,metalness:.2,roughness:.35});
    const rr=(w,h,r)=>{const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);return s;};
    const blade=new THREE.Group();
    /* face bar: 9 cm heel to toe, 2.5 cm tall, soft radii on every edge */
    const fg=new THREE.ExtrudeGeometry(rr(.012,.025,.0035),{depth:.088,bevelEnabled:true,bevelThickness:.002,bevelSize:.0012,bevelSegments:3,curveSegments:6});const fb=new THREE.Mesh(fg,sat);fb.position.set(.009,.0135,.004);blade.add(fb);
    /* flange behind the face, lower, with the sightline and two cherry dots */
    const flg=new THREE.ExtrudeGeometry(rr(.026,.082,.007),{depth:.0085,bevelEnabled:true,bevelThickness:.0012,bevelSize:.0012,bevelSegments:2,curveSegments:6});flg.rotateX(Math.PI/2);flg.translate(0,.0097,0);const fl=new THREE.Mesh(flg,sat);fl.position.set(-.008,0,.049);blade.add(fl);
    const cav=new THREE.Mesh(new THREE.BoxGeometry(.01,.0012,.058),dk);cav.position.set(-.001,.0108,.049);blade.add(cav);
    const sl=new THREE.Mesh(new THREE.BoxGeometry(.016,.0008,.0022),S({color:0xf4f4f2,roughness:.4}));sl.position.set(-.013,.0103,.049);blade.add(sl);
    for(const z of[.028,.07]){const d=new THREE.Mesh(new THREE.CylinderGeometry(.0024,.0024,.0008,14),red);d.position.set(-.012,.0104,z);blade.add(d);}
    const fc=new THREE.Mesh(new THREE.PlaneGeometry(.084,.02),S({color:0xc9ced4,metalness:.85,roughness:.5}));fc.rotation.y=Math.PI/2;fc.position.set(.0172,.0135,.049);blade.add(fc);
    hb.add(blade);
    /* plumber's neck: up from the heel, a short jog, then into the shaft (re-fitted whenever the lie changes) */
    hb.userData.neck=[segMesh(.0042,.0042,sat,hb),segMesh(.0042,.0042,sat,hb),segMesh(.0046,.0042,sat,hb)];hb.userData.jn=[new THREE.Mesh(new THREE.SphereGeometry(.0043,12,8),sat),new THREE.Mesh(new THREE.SphereGeometry(.0043,12,8),sat)];hb.userData.jn.forEach(m=>hb.add(m));fitPutterNeck(hb);
    const hs=new THREE.Mesh(new THREE.CylinderGeometry(.005,.0052,.03,14),dk);hs.position.set(0,.09,.0);hg.add(hs);});
  return out;}

/* ---- rig geometry helpers ---- */
const UPV=new THREE.Vector3(0,1,0),_q=new THREE.Quaternion(),_m4=new THREE.Matrix4();
function segMesh(r0,r1,mat,par){const g=new THREE.CylinderGeometry(r1,r0,1,18,1,true);g.translate(0,.5,0);const m=new THREE.Mesh(g,mat);par.add(m);return m;}
function placeSeg(m,a,b){const d=v3(0,0,0).subVectors(b,a),L=d.length();m.position.copy(a);m.quaternion.setFromUnitVectors(UPV,d.divideScalar(L||1));m.scale.set(1,L,1);}
function ik(A,T,l1,l2,pole){const d=A.distanceTo(T),k=d>(l1+l2)*.999?d/((l1+l2)*.999):1;l1*=k;l2*=k;const a=(l1*l1-l2*l2+d*d)/(2*d),hh=Math.sqrt(Math.max(0,l1*l1-a*a));
  const dir=v3(0,0,0).subVectors(T,A).divideScalar(d||1),pp=pole.clone().sub(A);pp.addScaledVector(dir,-pp.dot(dir));if(pp.lengthSq()<1e-6)pp.set(0,-1,0);pp.normalize();return A.clone().addScaledVector(dir,a).addScaledVector(pp,hh);}
const SW_U=new THREE.Vector3(0,.9067,-.4219),SW_E=new THREE.Vector3(1,0,0),SW_B=new THREE.Vector3(0,.02,.78),SW_R=.615;

function buildAvatarOld(p){const g=new THREE.Group(),lk=p.look,F=window.FACES&&FACES[p.id],env=getEnv();
  const cloth=c=>new THREE.MeshLambertMaterial({color:c});
  const skinC=F?F.skin:lk.skin,skin=new THREE.MeshLambertMaterial({color:skinC});
  const L=cloth,pants=cloth(lk.legs.color),vest=lk.top.type==='vest',top=cloth(lk.top.color),sleeve=cloth(lk.top.arms||lk.top.color),hair=cloth(lk.hair||'#1b1512'),shoe=cloth(lk.shoes||'#f2f2f2'),sole=cloth('#e9e9e6'),glove=cloth('#f6f6f3');
  const longSl=['zip','fleece','hoodie','vest'].includes(lk.top.type),bare=lk.top.color===skinC;
  const R={};g.userData.rig=R;
  /* pelvis -> spine (bent) -> torso (twists) */
  const PV=new THREE.Group();PV.position.set(0,.96,-.02);g.add(PV);R.pelvis=PV;
  const hipM=new THREE.Mesh(new THREE.SphereGeometry(.19,24,16),pants);hipM.scale.set(1,.6,.78);PV.add(hipM);
  const SP=new THREE.Group();SP.rotation.x=.38;PV.add(SP);R.spine=SP;
  const TO=new THREE.Group();SP.add(TO);R.torso=TO;
  const prof=[[.172,0],[.176,.08],[.184,.2],[.205,.31],[.222,.39],[.224,.43],[.205,.475],[.13,.515],[.064,.53]].map(q=>new THREE.Vector2(q[0],q[1]));
  const tor=new THREE.Mesh(new THREE.LatheGeometry(prof,28),vest?sleeve:top);tor.scale.set(1,1,.68);TO.add(tor);
  if(vest){const vv=new THREE.Mesh(new THREE.LatheGeometry(prof.slice(0,7).map(q=>new THREE.Vector2(q.x*1.05,q.y)),28),top);vv.scale.set(1,1,.7);TO.add(vv);}
  const belt=new THREE.Mesh(new THREE.CylinderGeometry(.176,.176,.038,28,1,true),cloth('#232323'));belt.scale.set(1,1,.7);belt.position.y=.01;TO.add(belt);
  const bk=new THREE.Mesh(new THREE.BoxGeometry(.04,.028,.01),new THREE.MeshStandardMaterial({color:0xc9ccd0,metalness:1,roughness:.3,envMap:env||null}));bk.position.set(0,.01,.125);TO.add(bk);
  if(lk.top.type==='polo'||lk.top.type==='tee'){if(!bare){const c=new THREE.Mesh(new THREE.TorusGeometry(.07,.016,8,24),top);c.rotation.x=Math.PI/2;c.position.set(0,.52,.005);c.scale.set(1,.72,1);TO.add(c);}
    if(lk.top.type==='polo'){const pk=new THREE.Mesh(new THREE.BoxGeometry(.03,.1,.008),top);pk.position.set(0,.46,.118);pk.rotation.x=-.25;TO.add(pk);for(let i=0;i<2;i++){const bt=new THREE.Mesh(new THREE.SphereGeometry(.006,8,6),cloth('#f0f0ec'));bt.position.set(0,.48-i*.04,.124);TO.add(bt);}}}
  if(lk.top.type==='zip'||lk.top.type==='fleece'){const c=new THREE.Mesh(new THREE.CylinderGeometry(.07,.088,.085,20,1,true),top);c.position.set(0,.535,.005);c.scale.set(1,1,.8);TO.add(c);const zp=new THREE.Mesh(new THREE.BoxGeometry(.006,.2,.006),cloth('#9a9da2'));zp.position.set(0,.45,.125);zp.rotation.x=-.3;TO.add(zp);}
  if(lk.top.type==='hoodie'){const hb=new THREE.Mesh(new THREE.SphereGeometry(.12,16,12),top);hb.scale.set(1.1,.7,.8);hb.position.set(0,.5,-.1);TO.add(hb);}
  /* neck + head (stays on the ball) */
  const nk=new THREE.Mesh(new THREE.CylinderGeometry(.048,.054,.13,16),skin);nk.position.set(0,.575,.01);SP.add(nk);
  const hd=new THREE.Group();hd.position.set(0,.71,.035);hd.rotation.x=-.3;SP.add(hd);R.head=hd;
  const RH=.112;const skull=new THREE.Mesh(new THREE.SphereGeometry(RH,32,24),skin);skull.scale.set(.93,1.1,1.02);hd.add(skull);
  const jaw=new THREE.Mesh(new THREE.SphereGeometry(RH*.78,24,16),skin);jaw.scale.set(.95,.7,.95);jaw.position.set(0,-.06,.018);hd.add(jaw);
  const ft=faceTex(p.id);
  if(ft){const fg=new THREE.SphereGeometry(RH*1.013,40,28,0,Math.PI,.3,2.4),pa=fg.attributes.position,uv=fg.attributes.uv;for(let i=0;i<pa.count;i++)uv.setXY(i,.5+pa.getX(i)/(2*RH*1.013),.5+pa.getY(i)/(2*RH*1.013));uv.needsUpdate=true;
    const fmat=new THREE.MeshLambertMaterial({map:ft});const fm=new THREE.Mesh(fg,fmat);fm.scale.set(.93,1.1,1.02);hd.add(fm);}
  for(const s of[-1,1]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.028,12,10),skin);ear.scale.set(.45,1,.7);ear.position.set(s*RH*.9,-.008,-.004);hd.add(ear);}
  const cap=lk.cap||{style:'none'};
  if(cap.style==='none'){const hm=new THREE.Mesh(new THREE.SphereGeometry(RH*1.045,28,16,0,Math.PI*2,0,1.0),hair);hm.scale.set(.95,1.1,1.03);hm.position.y=.004;hd.add(hm);
    const hbk=new THREE.Mesh(new THREE.SphereGeometry(RH*1.035,28,16,Math.PI,Math.PI,0,2.05),hair);hbk.scale.set(.95,1.1,1.02);hd.add(hbk);
    if(lk.longHair){const lh=new THREE.Mesh(new THREE.CylinderGeometry(.1,.085,.25,18,1,true,Math.PI*.6,Math.PI*1.8),hair);lh.position.set(0,-.12,-.03);hd.add(lh);}}
  else if(cap.style==='visor'){const cm=cloth(cap.color);cm.side=THREE.DoubleSide;const rimY=.008+.112*1.08*1.06*Math.cos(1.18);const bd=new THREE.Mesh(new THREE.CylinderGeometry(.112*1.08*.924*1.08,.112*1.08*.924*1.1,.032,48,1,true),cm);bd.scale.set(.97,1,1.06);bd.position.y=rimY+.018;hd.add(bd);
    const br=new THREE.Mesh(capBill(),cloth(cap.brim||cap.color));br.material.side=THREE.DoubleSide;br.scale.set(1.08,1,1.1);br.position.y=rimY+.004;hd.add(br);
    const tb=new THREE.Mesh(new THREE.TorusGeometry(.112*1.08*.924*1.08,.004,6,48),cloth(cap.brim||cap.color));tb.rotation.x=Math.PI/2;tb.scale.set(.97,1.06,1);tb.position.y=rimY+.034;hd.add(tb);}
  else{const cm=cloth(cap.color),back=cap.style==='back';const cr=new THREE.Mesh(new THREE.SphereGeometry(RH*1.08,32,16,0,Math.PI*2,0,1.18),cm);cr.scale.set(.96,1.06,1.04);cr.position.y=.008;hd.add(cr);
    const bt=new THREE.Mesh(new THREE.SphereGeometry(.011,8,6),cm);bt.position.set(0,.133,0);hd.add(bt);
    if(cap.style!=='band'){const br=new THREE.Mesh(capBill(),cloth(cap.brim||cap.color));br.material.side=THREE.DoubleSide;br.position.y=.008+.112*1.08*1.06*Math.cos(1.18)+.002;br.rotation.y=back?Math.PI:0;hd.add(br);}
    const hb=new THREE.Mesh(new THREE.SphereGeometry(RH*1.03,28,12,Math.PI*.9,Math.PI*1.2,.95,1.15),hair);hb.scale.set(.95,1.1,1);hd.add(hb);
    if(cap.patch&&!back){const pt=new THREE.Mesh(new THREE.BoxGeometry(.075,.036,.008),cloth(cap.patch));pt.position.set(0,.088,.106);pt.rotation.x=-.45;hd.add(pt);}
    if(cap.rope&&!back){const rp=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,.16,6),cloth('#f4f4f0'));rp.rotation.z=Math.PI/2;rp.position.set(0,.06,.17);hd.add(rp);}}
  /* limbs driven every frame by IK */
  const armTop=longSl||bare?sleeve:sleeve,fore=longSl?sleeve:skin;
  R.arms=[1,-1].map(s=>({s,up:segMesh(.066,.052,sleeve,g),upSkin:(!longSl&&!bare)?segMesh(.05,.046,skin,g):null,fo:segMesh(.049,.038,fore,g),el:new THREE.Mesh(new THREE.SphereGeometry(.05,14,10),longSl?sleeve:skin),sh:new THREE.Mesh(new THREE.SphereGeometry(.078,18,14),sleeve)}));
  R.arms.forEach(a=>{g.add(a.el,a.sh);});
  R.legs=[1,-1].map(s=>{const th=segMesh(.108,.082,pants,g),kn=new THREE.Mesh(new THREE.SphereGeometry(.078,16,12),lk.legs.shorts?skin:pants),sn=segMesh(lk.legs.shorts?.068:.078,.05,lk.legs.shorts?skin:pants,g);
    const ft2=new THREE.Group();const up=new THREE.Mesh(new THREE.BoxGeometry(.1,.07,.24),shoe);up.position.set(0,.02,.06);ft2.add(up);const toe=new THREE.Mesh(new THREE.SphereGeometry(.052,16,10),shoe);toe.scale.set(1,.7,1.2);toe.position.set(0,.01,.17);ft2.add(toe);
    const so=new THREE.Mesh(new THREE.BoxGeometry(.108,.022,.29),sole);so.position.set(0,-.02,.08);ft2.add(so);ft2.rotation.y=s*.18;g.add(kn,ft2);
    let short=null;if(lk.legs.shorts){short=segMesh(.115,.105,pants,g);}return{s,th,kn,sn,ft:ft2,short};});
  /* clubs + hands ride in the club frame */
  R.clubs=makeClubs();R.hands=[];
  for(const k in R.clubs){const cg=R.clubs[k];g.add(cg);
    const lh=new THREE.Mesh(new THREE.SphereGeometry(.046,16,12),lk.glove?glove:skin);lh.scale.set(1.15,1.5,.95);lh.position.set(-.012,-.01,0);cg.add(lh);
    const th2=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),lk.glove?glove:skin);th2.scale.set(1,2,1);th2.position.set(.02,-.045,.022);cg.add(th2);
    const rh=new THREE.Mesh(new THREE.SphereGeometry(.047,16,12),skin);rh.scale.set(1.15,1.5,.95);rh.position.set(-.012,-.095,0);cg.add(rh);}
  g.userData.pose=null;g.scale.setScalar(lk.tall||1);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});applyPose(g,swingPose('addr',0,0,false),'iron');return g;}

/* swing timeline -> pose (angles in radians; + = away from the target) */
function swingPose(ph,u,pw,putt){const _o=swingPose0(ph,u,pw,putt);_o._ph=ph;_o._u=u;_o._pw=pw;return _o;}
function swingPose0(ph,u,pw,putt){const P=Math.min(1.08,Math.max(.05,pw)),fs=Math.min(1,.35+P*.8);
  const Z={th:0,hg:0,hip:0,sh:0,shift:0,heel:0,look:0,tilt:0,kick:0,post:0,fin:0};
  if(putt){const top={th:.34*P,sh:.12*P},fin={th:-.38*P-.04,sh:-.13*P};
    if(ph==='back'){const e=Math.min(1,u);return Object.assign({},Z,{th:top.th*e,sh:top.sh*e});}
    if(ph==='down'){const d=Math.min(1,u);return Object.assign({},Z,{th:top.th*(1-d),sh:top.sh*(1-d)});}
    if(ph==='thru'){const f=1-Math.pow(1-Math.min(1,u),2);return Object.assign({},Z,{th:fin.th*f,sh:fin.sh*f});}
    return Z;}
  const top={th:2.0*P,hg:1.5*Math.min(1,P*1.15),hip:.72*Math.min(1,P),sh:1.8*Math.min(1.03,P),shift:-.035,tilt:-.03,kick:Math.min(1,P),post:0,heel:0,fin:0};
  const imp={th:0,hg:.04,hip:-.72*Math.min(1,P*1.2),sh:-.32,shift:.075,tilt:.15,kick:0,post:.55,heel:.28*Math.min(1,P),fin:0};
  const fin={th:-2.35*fs,hg:-1.3*fs,hip:-1.5*fs,sh:-1.85*fs,shift:.13,tilt:-.2*fs,kick:0,post:1,heel:fs,fin:fs};
  const mix=(a,b,t)=>a+(b-a)*t,M=(a,b,w)=>{const o={};for(const k in a)o[k]=mix(a[k],b[k],typeof w==='object'?w[k]:w);return o;};
  if(ph==='back'){const e=Math.min(1,u),E={th:e,hg:Math.pow(e,1.5),hip:Math.pow(e,1.1),sh:e,shift:Math.pow(e,.8),tilt:e,kick:Math.pow(e,1.3),post:0,heel:0,fin:0};return Object.assign({},Z,M(Object.assign({},Z,{th:0,hg:0,hip:0,sh:0,shift:0,tilt:0,kick:0,post:0,heel:0,fin:0}),top,E),{look:0});}
  if(ph==='down'){const d=Math.min(1,u),W={th:d*d,hg:Math.pow(d,3.2),hip:Math.pow(d,.6),sh:Math.pow(d,1.3),shift:Math.pow(d,.55),tilt:Math.pow(d,.9),kick:Math.pow(d,.5),post:Math.pow(d,1.6),heel:Math.pow(d,2.5),fin:0};return Object.assign({},Z,M(top,imp,W),{look:0});}
  if(ph==='thru'){const f=1-Math.pow(1-Math.min(1,u),2.1),W={th:f,hg:Math.pow(f,1.25),hip:f,sh:f,shift:f,tilt:Math.pow(f,1.2),kick:0,post:Math.pow(f,.7),heel:f,fin:Math.pow(f,1.4)};return Object.assign({},Z,M(imp,fin,W),{look:Math.max(0,(f-.15)/.85)*fs});}
  return Z;}
function applyPose(g,S,type){const R=g.userData.rig;if(R&&R.skel&&animPose(g,S,type))return;if(R&&R.skel)return applyPoseSkel(g,S,type);return applyPoseOld(g,S,type);}
function applyPoseOld(g,S,type){const R=g.userData.rig;if(!R)return;
  R.pelvis.rotation.y=-S.hip;R.pelvis.position.set(S.shift,.96-.012*S.heel,-.02);R.torso.rotation.y=-(S.sh-S.hip);R.head.rotation.y=S.hip*.92+S.look*1.1;R.head.rotation.x=-.3+S.look*.35;
  g.updateMatrixWorld(true);
  const toLocal=(obj,x,y,z)=>g.worldToLocal(obj.localToWorld(v3(x,y,z)));
  /* club on the swing plane */
  const Lc=CLUB_LEN[type],U=SW_U,E=SW_E,C=SW_B.clone().addScaledVector(U,Lc+SW_R);
  const H=C.clone().addScaledVector(U,-Math.cos(S.th)*SW_R).addScaledVector(E,-Math.sin(S.th)*SW_R);
  const ph=S.th+S.hg,sdir=U.clone().multiplyScalar(-Math.cos(ph)).addScaledVector(E,-Math.sin(ph));
  const xa=E.clone().multiplyScalar(Math.cos(ph)).addScaledVector(U,-Math.sin(ph)).normalize(),ya=sdir.clone().negate(),za=v3(0,0,0).crossVectors(xa,ya).normalize();xa.crossVectors(ya,za).normalize();
  _m4.makeBasis(xa,ya,za);for(const k in R.clubs){const cg=R.clubs[k];cg.visible=k===type;cg.position.copy(H);cg.quaternion.setFromRotationMatrix(_m4);}
  const grips=[H.clone(),H.clone().addScaledVector(sdir,.085)];
  /* arms */
  R.arms.forEach((a,i)=>{const sh=toLocal(R.torso,a.s*.205,.44,-.01),wr=grips[i].clone().addScaledVector(sdir,-.03);const pole=sh.clone().add(v3(a.s*.45,-1,-.55));
    const el=ik(sh,wr,.3,.27,pole);a.sh.position.copy(sh);a.el.position.copy(el);
    if(a.upSkin){const mid=sh.clone().lerp(el,.5);placeSeg(a.up,sh,mid);placeSeg(a.upSkin,mid,el);}else placeSeg(a.up,sh,el);placeSeg(a.fo,el,wr);});
  /* legs: feet planted, trail heel releases in the finish */
  R.legs.forEach(l=>{const hip=toLocal(R.pelvis,l.s*.1,-.04,0);let ank=v3(l.s*.17,.1,.02);if(l.s<0&&S.heel>0){ank=v3(-.17+.07*S.heel,.1+.09*S.heel,.02-.03*S.heel);}
    const kn=ik(hip,ank,.46,.44,hip.clone().add(v3(l.s*.25,-.3,1)));placeSeg(l.th,hip,kn);l.kn.position.copy(kn);placeSeg(l.sn,kn,ank);
    if(l.short)placeSeg(l.short,hip,hip.clone().lerp(kn,.8));l.ft.position.copy(ank).add(v3(0,-.06,-.04));l.ft.rotation.x=l.s<0?S.heel*.85:0;l.ft.rotation.y=l.s*.18+(l.s<0?-S.heel*.5:S.heel*.2);});}
function buildAvatar(p){const T=TPL[FEMALE.has(p.id)?'F':'M'];if(T&&window.FORCE_OLD!==1){try{return buildAvatarSkel(p);}catch(e){console.warn('rigged body failed, using the sculpted one',e);}}return buildAvatarOld(p);}
/* ---- realistic rigged body: Quaternius "Universal Base Characters" (CC0), recolored per golfer ---- */
const TPL={},FEMALE=new Set(['back-row','andrea']);
function getBuf(u){return u.startsWith('data:')?Promise.resolve(b64buf(u)):fetch(u).then(r=>r.arrayBuffer());}
function b64buf(u){const s=atob(u.slice(u.indexOf(',')+1)),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b.buffer;}
function loadBodies(){if(!THREE.GLTFLoader||!THREE.SkeletonUtils||!window.ASSETS)return Promise.resolve();const L=new THREE.GLTFLoader();
  const RBK=Object.keys(ASSETS).filter(k=>k.startsWith('bodyRB_')).map(k=>'RB_'+k.slice(7)).concat(ASSETS.bodyPRO_M?['PRO_M']:[]);
  return Promise.all(['M','F'].concat(RBK).map(k=>new Promise(res=>{try{getBuf(ASSETS[k.startsWith('RB_')?'bodyRB_'+k.slice(3):k==='PRO_M'?'bodyPRO_M':'body'+k]).then(buf=>L.parse(buf,'',g=>{try{TPL[k]=prepTemplate(g.scene,k);}catch(e){console.warn('body prep',e);}res();},e=>{console.warn('body parse',e);res();})).catch(e=>{console.warn(e);res();});}catch(e){console.warn(e);res();}})));}
const HAIRG={};
function loadHair(){if(!window.ASSETS||!THREE.GLTFLoader)return Promise.resolve();const L=new THREE.GLTFLoader();
  return Promise.all([['long','hairLong'],['parted','hairParted'],['buzz','hairBuzz']].map(([k,a])=>new Promise(res=>{try{getBuf(ASSETS[a]).then(buf=>L.parse(buf,'',g=>{let m=null;g.scene.updateMatrixWorld(true);g.scene.traverse(o=>{if(o.isMesh)m=o;});
    if(m){const geo=m.geometry.clone();geo.applyMatrix4(m.matrixWorld);if(k==='long'){const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(y<1.63){const d=1.63-y;p.setXYZ(i,x*(1+d*.9),1.63-d*2.3,z-(z<.04?d*.3:0));}}p.needsUpdate=true;geo.computeVertexNormals();}HAIRG[k]=geo;}res();},()=>res())).catch(()=>res());}catch(e){res();}})));}
function hairMat(hex,fem){const t=new THREE.TextureLoader().load(ASSETS[fem?'h2c':'h1c']),n=new THREE.TextureLoader().load(ASSETS[fem?'h2n':'h1n']);t.flipY=n.flipY=false;
  const m=new THREE.MeshStandardMaterial({map:t,normalMap:n,roughness:.5,metalness:0,side:THREE.DoubleSide,envMapIntensity:.6});m.userData.lin=1;const U={uHair:{value:new THREE.Color(hex).convertSRGBToLinear()}};
  m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uHair;').replace('#include <map_fragment>','#include <map_fragment>\n float hl=dot(diffuseColor.rgb,vec3(.3,.59,.11));diffuseColor.rgb=uHair*(.35+hl*2.1)+vec3(.012)*hl;');};m.customProgramCacheKey=()=>'hair2';return m;}
function prepTemplate(sc,k){sc.updateMatrixWorld(true);let body=null,eye=null,capFrontY=null,brimProf=null,headNC=null,plateZ=null;const PRO=k.startsWith('PRO_'),RB=k.startsWith('RB_')||PRO;
  if(PRO){const parts=[];sc.traverse(o=>{if(o.isSkinnedMesh)parts.push(o);});const A={position:[],normal:[],uv:[],skinIndex:[],skinWeight:[]},I=[],mats=[],groups=[];let off=0;
    for(const m of parts){const g=m.geometry,n=g.attributes.position.count;for(const a in A){const at=g.attributes[a],G4=['getX','getY','getZ','getW'];for(let i=0;i<n;i++)for(let c=0;c<at.itemSize;c++)A[a].push(at[G4[c]](i));}const ix=g.index?g.index.array:Array.from({length:n},(_,i)=>i),s0=I.length;for(let i=0;i<ix.length;i++)I.push(ix[i]+off);
      groups.push([s0,ix.length,mats.length]);mats.push(m.material);off+=n;}
    const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.Float32BufferAttribute(A.position,3));G.setAttribute('normal',new THREE.Float32BufferAttribute(A.normal,3));G.setAttribute('uv',new THREE.Float32BufferAttribute(A.uv,2));
    G.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(A.skinIndex,4));G.setAttribute('skinWeight',new THREE.Float32BufferAttribute(A.skinWeight,4));G.setIndex(I);groups.forEach(q=>G.addGroup(q[0],q[1],q[2]));
    {const Pp=G.attributes.position,Mw=parts[0].matrixWorld,v=new THREE.Vector3(),ix=G.index.array,keep=[],ng=[];
      const hidden=(nm,a,b,c)=>{const pts=[a,b,c].map(k=>v.fromBufferAttribute(Pp,k).applyMatrix4(Mw).clone());
        if(/ARM/.test(nm))return pts.every(q=>Math.abs(q.x)<.325);            /* upper arms and shoulders under the sleeves */
        if(/TSHIRT/.test(nm))return pts.every(q=>q.y<.985);                    /* shirt tail tucked inside the trousers */
        if(/HEAD/.test(nm))return pts.every(q=>q.y<1.385||(q.y<1.45&&Math.abs(q.x)>.072)||(q.y<1.47&&q.z<-.03));   /* neck base and the shoulder/trapezius skin under the collar and shoulders */
        return false;};
      for(const gr of G.groups){const nm=mats[gr.materialIndex].name||'',s0=keep.length;for(let t=gr.start;t<gr.start+gr.count;t+=3){const a=ix[t],b=ix[t+1],c=ix[t+2];if(hidden(nm,a,b,c))continue;keep.push(a,b,c);}ng.push([s0,keep.length-s0,gr.materialIndex]);}
      G.setIndex(keep);G.clearGroups();ng.forEach(q=>G.addGroup(q[0],q[1],q[2]));}
    const p0=parts[0],mb=new THREE.SkinnedMesh(G,mats);mb.name='PRO_Body';p0.parent.add(mb);mb.position.copy(p0.position);mb.quaternion.copy(p0.quaternion);mb.scale.copy(p0.scale);mb.bind(p0.skeleton,p0.bindMatrix);parts.forEach(m=>m.parent.remove(m));sc.updateMatrixWorld(true);}
  sc.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.position.count>5000)body=o;});
  sc.traverse(o=>{if(o.isMesh&&o!==body&&o.material&&/Eye/.test(o.material.name)){o.geometry.computeBoundingBox();eye=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);}});
  const bones={};body.skeleton.bones.forEach(b=>bones[b.name]=b);const wp=n=>bones[n].getWorldPosition(new THREE.Vector3());
  if(k==='F'&&!RB){const Pa=body.geometry.attributes.position,SIa=body.geometry.attributes.skinIndex,SWa=body.geometry.attributes.skinWeight,Mw=body.matrixWorld,Mi=Mw.clone().invert(),v=new THREE.Vector3(),n0=Pa.count;
    const dom=i=>{let bi=0,bw=-1;for(let j=0;j<4;j++){const w=GC4(SWa,i,j);if(w>bw){bw=w;bi=GC4(SIa,i,j);}}return body.skeleton.bones[bi].name;};
    const sp3=wp('spine_03'),W=[];for(let i=0;i<n0;i++){v.fromBufferAttribute(Pa,i).applyMatrix4(Mw);W.push([v.x,v.y,v.z,dom(i)]);}
    const cen={};for(const s of[1,-1]){let best=null;for(const q of W){if(!/spine/.test(q[3]))continue;const ax=q[0]*s;if(ax<.04||ax>.14||q[1]<sp3.y-.26||q[1]>sp3.y+.04)continue;if(!best||q[2]>best[2])best=q;}cen[s]=best;}
    const arm={l:[wp('upperarm_l'),wp('lowerarm_l'),wp('hand_l')],r:[wp('upperarm_r'),wp('lowerarm_r'),wp('hand_r')]};
    for(let i=0;i<n0;i++){const q=W[i];let [x,y,z,nm]=q;
      for(const s of[1,-1]){const c=cen[s];if(!c||!/spine|clavicle/.test(nm))continue;if(z<c[2]-.09)continue;const d2=(x-c[0])**2+(y-c[1]+.01)**2,w=Math.exp(-d2/(2*.052*.052));z+=.032*w;y-=.01*w;}
      const m=/^(upperarm|lowerarm)_(l|r)$/.exec(nm);if(m){const A=arm[m[2]],a0=A[0],a1=A[2],dv=a1.clone().sub(a0),L=dv.length();dv.divideScalar(L);const pv=new THREE.Vector3(x,y,z).sub(a0),t=pv.dot(dv)/L,ax=a0.clone().addScaledVector(dv,t*L),r=new THREE.Vector3(x,y,z).sub(ax);
        const f=1-.19*sstepJ(.02,.14,t)*(1-sstepJ(.9,.99,t));r.multiplyScalar(f);x=ax.x+r.x;y=ax.y+r.y;z=ax.z+r.z;}
      v.set(x,y,z).applyMatrix4(Mi);Pa.setXYZ(i,v.x,v.y,v.z);}
    Pa.needsUpdate=true;body.geometry.computeVertexNormals();}
  const P=body.geometry.attributes.position,N=body.geometry.attributes.normal,SI=body.geometry.attributes.skinIndex,SW=body.geometry.attributes.skinWeight,n=P.count;
  const pos=new Float32Array(n*3),nrm=new Float32Array(n*3),cls=new Uint8Array(n),M=body.matrixWorld,NM=new THREE.Matrix3().getNormalMatrix(M),v=new THREE.Vector3();
  const CL={Head:1,neck_01:1,spine_01:2,spine_02:2,spine_03:2,clavicle_l:2,clavicle_r:2,pelvis:3,thigh_l:4,thigh_r:4,calf_l:5,calf_r:5,foot_l:6,foot_r:6,ball_l:6,ball_r:6,upperarm_l:7,upperarm_r:7,lowerarm_l:8,lowerarm_r:8};
  for(let i=0;i<n;i++){v.fromBufferAttribute(P,i).applyMatrix4(M);pos[i*3]=v.x;pos[i*3+1]=v.y;pos[i*3+2]=v.z;v.fromBufferAttribute(N,i).applyMatrix3(NM).normalize();nrm[i*3]=v.x;nrm[i*3+1]=v.y;nrm[i*3+2]=v.z;
    let bi=0,bw=-1;for(let j=0;j<4;j++){const w=GC4(SW,i,j);if(w>bw){bw=w;bi=GC4(SI,i,j);}}const nm=body.skeleton.bones[bi].name;cls[i]=CL[nm]||(/hand|thumb|index|middle|ring|pinky/.test(nm)?9:2);}
  let eyeC=eye?eye.getCenter(new THREE.Vector3()):wp('Head').add(v3(0,.07,.08));
  let top=-1e9,zs=[],xs=[];for(let i=0;i<n;i++)if(cls[i]===1){top=Math.max(top,pos[i*3+1]);if(Math.abs(pos[i*3+1]-eyeC.y-.03)<.03){zs.push(pos[i*3+2]);xs.push(Math.abs(pos[i*3]));}}xs.sort((a,b)=>a-b);const halfW=xs[Math.floor(xs.length*.93)]||.08;
  zs.sort((a,b)=>a-b);const zFront=zs[Math.floor(zs.length*.98)]||eyeC.z+.02,zBack=zs[Math.floor(zs.length*.02)]||eyeC.z-.18;
  const tl=new THREE.TextureLoader();let map,nmap;if(RB){const ms=Array.isArray(body.material)?body.material:[body.material];map=ms[0].map;nmap=ms[0].normalMap;}else{map=tl.load(ASSETS['skin'+k]);map.encoding=THREE.sRGBEncoding;map.flipY=false;map.anisotropy=4;nmap=tl.load(ASSETS['nrm'+k]);nmap.flipY=false;}
  const ul=wp('upperarm_l'),ll=wp('lowerarm_l'),hl=wp('hand_l'),th=wp('thigh_l'),ca=wp('calf_l'),ft=wp('foot_l'),pv=wp('pelvis');
  const MEAS=(()=>{const q=(a,p)=>{if(!a.length)return 0;a.sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(a.length*p))];};
    const nk=wp('neck_01'),th=wp('thigh_l'),ca=wp('calf_l'),fo=wp('foot_l'),pv=wp('pelvis');const nx=[],nz=[],ch=[],rT=[],rK=[],rA=[],hx=[],hz=[],F={1:[1e9,-1e9,1e9,-1e9,1e9,-1e9],'-1':[1e9,-1e9,1e9,-1e9,1e9,-1e9]};
    const ax=(A,Bp,x,y,z)=>{const d=Bp.clone().sub(A),L=d.length();d.divideScalar(L);const v=new THREE.Vector3(x,y,z).sub(A),t=v.dot(d);return[t/L,v.addScaledVector(d,-t).length()];};
    for(let i=0;i<n;i++){const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2],c=cls[i];
      if(c===1&&Math.abs(y-(nk.y+.02))<.015){nx.push(x);nz.push(z);}
      if(c===2&&Math.abs(x)<.03&&Math.abs(y-(nk.y-.1))<.02)ch.push(z);
      if(x>0&&c===4){const[t,r]=ax(th,ca,x,y,z);if(t<.25)rT.push(r);if(t>.8)rK.push(r);}
      if(x>0&&c===5){const[t,r]=ax(ca,fo,x,y,z);if(t<.12)rK.push(r);if(t>.82&&t<.98)rA.push(r);}
      if((c===3||c===4)&&Math.abs(y-(pv.y-.02))<.04){hx.push(Math.abs(x));hz.push(z);}
      if(c===6){const b=F[x>0?1:-1];b[0]=Math.min(b[0],x);b[1]=Math.max(b[1],x);b[2]=Math.min(b[2],y);b[3]=Math.max(b[3],y);b[4]=Math.min(b[4],z);b[5]=Math.max(b[5],z);}}
    const ncz=nz.reduce((a,b)=>a+b,0)/Math.max(1,nz.length),nr=q(nx.map((x,i)=>Math.hypot(x,nz[i]-ncz)),.8);
    return{neckY:nk.y,neckZ:ncz,neckR:nr,chestZ:q(ch,.97),rT:q(rT,.9),rK:q(rK,.85),rA:q(rA,.85),hipX:q(hx,.97),hipZ0:q(hz,.02),hipZ1:q(hz,.98),crotchY:th.y-.1,foot:F};})();
  let eyeX=k==='F'?.0345:.0338,mouthY=k==='F'?1.5854:1.639;if(RB&&bones.Bip01_LEye&&bones.Bip01_REye){const a=wp('Bip01_LEye'),b=wp('Bip01_REye');eyeX=Math.abs(a.x-b.x)/2;eyeC.copy(a).add(b).multiplyScalar(.5);eyeC.z+=.012;mouthY=eyeC.y-.075;}let noseZ=-1e9;for(let i=0;i<n;i++)if(cls[i]===1&&Math.abs(pos[i*3])<.035&&pos[i*3+1]>eyeC.y-.07&&pos[i*3+1]<eyeC.y+.03)noseZ=Math.max(noseZ,pos[i*3+2]);
  if(PRO){/* face plate reference from the model's own face (below the cap brim) */const ms=Array.isArray(body.material)?body.material:[body.material],hi=ms.findIndex(m=>/HEAD/.test(m.name||'')),gr=body.geometry.groups.find(q=>q.materialIndex===hi),ix=body.geometry.index.array;
    if(gr){let top=-1e9;for(let t=gr.start;t<gr.start+gr.count;t++){const v=ix[t];top=Math.max(top,pos[v*3+1]);}let nz=-1e9,ny=0;for(let t=gr.start;t<gr.start+gr.count;t++){const v=ix[t],x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2];if(Math.abs(x)<.02&&y<top-.12&&y>top-.26&&z>nz){nz=z;ny=y;}}if(nz>-1e8){noseZ=nz;eyeC.set(0,ny+.036,nz-.028);mouthY=ny-.045;}}
    {const ci=ms.findIndex(m=>/CAP/.test(m.name||'')),cg=body.geometry.groups.find(q=>q.materialIndex===ci);if(cg){let lo=1e9;const bp=new Array(9).fill(1e9);for(let t=cg.start;t<cg.start+cg.count;t++){const v=ix[t],x=pos[v*3],y=pos[v*3+1];if(pos[v*3+2]>noseZ-.08){if(Math.abs(x)<.06)lo=Math.min(lo,y);for(let k=0;k<9;k++){if(Math.abs(x-(-.08+k*.02))<.013)bp[k]=Math.min(bp[k],y);}}}if(lo<1e8)capFrontY=lo;
      for(let k=0;k<9;k++)if(bp[k]>1e8)bp[k]=k>0&&bp[k-1]<1e8?bp[k-1]:lo;brimProf=bp;}
     if(gr){/* flatten the model's face just behind where the photo sits (the photo covers it) */const mpp=2*eyeX/66,pZ=noseZ-.022,yC=eyeC.y-26*mpp,Pp=body.geometry.attributes.position,Mw=body.matrixWorld,Mi=Mw.clone().invert(),w=new THREE.Vector3(),seen=new Set();
       for(let t=gr.start;t<gr.start+gr.count;t++){const v=ix[t];if(seen.has(v))continue;seen.add(v);w.fromBufferAttribute(Pp,v).applyMatrix4(Mw);if(Math.abs(w.x)>.085||w.y<yC-.11||w.y>eyeC.y+.055||w.z<0)continue;
         const zs=pZ-(w.x*w.x/.15+(w.y-yC)*(w.y-yC)/.4)-.005;if(w.z>zs){w.z=zs;w.applyMatrix4(Mi);Pp.setXYZ(v,w.x,w.y,w.z);pos[v*3+2]=zs;}}Pp.needsUpdate=true;plateZ=pZ;}
     if(gr){let top=-1e9,hw=0,zf=-1e9,zb=1e9;const ey=eyeC.y;for(let t=gr.start;t<gr.start+gr.count;t++){const v=ix[t],x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2];top=Math.max(top,y);if(y>ey-.01&&y<ey+.05){hw=Math.max(hw,Math.abs(x));zf=Math.max(zf,z);}if(y>ey){zb=Math.min(zb,z);}}headNC={top,halfW:hw,zF:zf,zB:zb,eyeY:ey};}}}
  return{MEAS,eyeX,noseZ,capFrontY,brimProf,headNC,plateZ,fsx:(33/256)/eyeX,fsy:(66/256)/(eyeC.y-mouthY),scene:sc,bodyName:body.name,pos,nrm,cls,map,nmap,texL:RB?.3:k==='F'?.225:.214,pro:PRO,rb:RB,rbMats:RB?(Array.isArray(body.material)?body.material:[body.material]):null,halfW,eyeY:eyeC.y,eyeZ:eyeC.z,top,zFront,zBack,
    J:{shoulderX:ul.x,elbowX:ll.x,wristX:hl.x,waistY:pv.y+.065,kneeY:ca.y,shoeY:ft.y+.02,sockY:ft.y+.075,ankY:ft.y,hipX:th.x}};}
function GC4(a,i,j){return j===0?a.getX(i):j===1?a.getY(i):j===2?a.getZ(i):a.getW(i);}
function capBill(){const rx=.112*1.08*.96*Math.sin(1.18),rz=.112*1.08*1.04*Math.sin(1.18),Lb=.074,N=26,s=new THREE.Shape();
  for(let i=0;i<=N;i++){const t=-1+2*i/N,a=t*1.12;const x=rx*Math.sin(a)*.985,z=rz*Math.cos(a)*.985;i?s.lineTo(x,z):s.moveTo(x,z);}
  for(let i=N;i>=0;i--){const t=-1+2*i/N,a=t*1.12,e=Math.pow(Math.max(0,Math.cos(t*Math.PI/2)),.6);s.lineTo(rx*Math.sin(a)+Math.sin(a)*.01*e,rz*Math.cos(a)+Lb*e+.003);}
  const g=new THREE.ExtrudeGeometry(s,{depth:.005,bevelEnabled:true,bevelThickness:.0015,bevelSize:.0015,bevelSegments:1,curveSegments:4});g.rotateX(Math.PI/2);
  const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),a=Math.atan2(x/rx,z/rz),d=Math.max(0,Math.hypot(x,z)-Math.hypot(rx*Math.sin(a),rz*Math.cos(a)));p.setY(i,p.getY(i)-d*.24-1.3*x*x*Math.min(1,d/.03));}
  g.computeVertexNormals();return g;}
function billGeo(){const s=new THREE.Shape();s.moveTo(-.1,0);s.bezierCurveTo(-.1,.07,-.05,.095,0,.095);s.bezierCurveTo(.05,.095,.1,.07,.1,0);s.lineTo(-.1,0);
  const g=new THREE.ExtrudeGeometry(s,{depth:.007,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:1,curveSegments:14});g.rotateX(Math.PI/2);
  const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);p.setY(i,p.getY(i)-1.6*x*x-.12*z*z);}g.computeVertexNormals();return g;}
function sstepJ(a,b,x){const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);}
function headwear(hd,lk,cloth,hair,RH,paint){const cap=lk.cap||{style:'none'};
  if(cap.style==='none'){if(paint){if(lk.longHair){const pt=new THREE.Mesh(new THREE.CylinderGeometry(.034,.012,.2,14),hair);pt.position.set(0,-.02,-.135);pt.rotation.x=.35;hd.add(pt);const kn=new THREE.Mesh(new THREE.SphereGeometry(.04,14,10),hair);kn.position.set(0,.07,-.118);hd.add(kn);const bd=new THREE.Mesh(new THREE.TorusGeometry(.03,.007,6,16),new THREE.MeshLambertMaterial({color:0x1b1b1d}));bd.position.set(0,.058,-.125);bd.rotation.x=1.2;hd.add(bd);}return;}const hm=new THREE.Mesh(new THREE.SphereGeometry(RH*1.045,28,16,0,Math.PI*2,0,1.0),hair);hm.scale.set(.95,1.1,1.03);hm.position.y=.004;hd.add(hm);
    const hbk=new THREE.Mesh(new THREE.SphereGeometry(RH*1.035,28,16,Math.PI,Math.PI,0,2.05),hair);hbk.scale.set(.95,1.1,1.02);hd.add(hbk);
    if(lk.longHair){const lh=new THREE.Mesh(new THREE.CylinderGeometry(.1,.09,.26,18,1,true,Math.PI*.72,Math.PI*1.56),hair);lh.position.set(0,-.11,-.02);hd.add(lh);}}
  else if(cap.style==='visor'){const cm=cloth(cap.color);cm.side=THREE.DoubleSide;const rimY=.008+.112*1.08*1.06*Math.cos(1.18);const bd=new THREE.Mesh(new THREE.CylinderGeometry(.112*1.08*.924*1.08,.112*1.08*.924*1.1,.032,48,1,true),cm);bd.scale.set(.97,1,1.06);bd.position.y=rimY+.018;hd.add(bd);
    const br=new THREE.Mesh(capBill(),cloth(cap.brim||cap.color));br.material.side=THREE.DoubleSide;br.scale.set(1.08,1,1.1);br.position.y=rimY+.004;hd.add(br);
    const tb=new THREE.Mesh(new THREE.TorusGeometry(.112*1.08*.924*1.08,.004,6,48),cloth(cap.brim||cap.color));tb.rotation.x=Math.PI/2;tb.scale.set(.97,1.06,1);tb.position.y=rimY+.034;hd.add(tb);}
  else{const cm=cloth(cap.color),back=cap.style==='back';const cr=new THREE.Mesh(new THREE.SphereGeometry(RH*1.08,32,16,0,Math.PI*2,0,1.18),cm);cr.scale.set(.96,1.06,1.04);cr.position.y=.008;hd.add(cr);
    const bt=new THREE.Mesh(new THREE.SphereGeometry(.011,8,6),cm);bt.position.set(0,.133,0);hd.add(bt);
    if(cap.style!=='band'){const br=new THREE.Mesh(capBill(),cloth(cap.brim||cap.color));br.material.side=THREE.DoubleSide;br.position.y=.008+.112*1.08*1.06*Math.cos(1.18)+.002;br.rotation.y=back?Math.PI:0;hd.add(br);}
    if(!paint){const hb=new THREE.Mesh(new THREE.SphereGeometry(RH*1.03,28,12,Math.PI*.9,Math.PI*1.2,.95,1.15),hair);hb.scale.set(.95,1.1,1);hd.add(hb);}
    if(cap.patch&&!back){const pt=new THREE.Mesh(new THREE.BoxGeometry(.075,.036,.008),cloth(cap.patch));pt.position.set(0,.088,.106);pt.rotation.x=-.45;hd.add(pt);}
    if(cap.rope&&!back){const rp=new THREE.Mesh(new THREE.CylinderGeometry(.003,.003,.16,6),cloth('#f4f4f0'));rp.rotation.z=Math.PI/2;rp.position.set(0,.06,.17);hd.add(rp);}}}

/* ---------- golf attire: shoes, trousers/shorts, collars, and the stand bag ---------- */
function attachRest(obj,bone,pos,quat){const want=new THREE.Matrix4().compose(pos,quat||new THREE.Quaternion(),v3(1,1,1));new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(want).decompose(obj.position,obj.quaternion,obj.scale);bone.add(obj);}
function fabricTex(){if(window._fabT)return window._fabT;const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,128,128);
  for(let i=-128;i<256;i+=4){x.strokeStyle='rgba(0,0,0,.06)';x.lineWidth=1.2;x.beginPath();x.moveTo(i,0);x.lineTo(i+128,128);x.stroke();}for(let i=0;i<500;i++){x.fillStyle=Math.random()<.5?'rgba(0,0,0,.04)':'rgba(255,255,255,.05)';x.fillRect(Math.random()*128,Math.random()*128,2,1);}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,6);return window._fabT=t;}
const SHOE_SCHEMES=[['#f4f4f2','#ffffff','#1b1d22'],['#1b1d22','#f4f4f2','#e9e9e6'],['#f4f4f2','#2a2c31','#f4f4f2'],['#9aa3ad','#f4f4f2','#1b1d22'],['#2d3748','#f4f4f2','#e9e9e6'],['#f4f4f2','#c9b28a','#3b3326']];
function hashId(s){let h=7;for(const ch of s)h=(h*31+ch.charCodeAt(0))>>>0;return h;}
function makeShoe(len,wid,up,sad,sole,lace){const G=new THREE.Group(),L=len/2,W=wid/2,SS=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const Mu=new THREE.MeshStandardMaterial({color:up,roughness:.38,metalness:0,envMapIntensity:.7}),Ms=new THREE.MeshStandardMaterial({color:sad,roughness:.4,metalness:0,envMapIntensity:.7}),
    Mo=new THREE.MeshStandardMaterial({color:sole,roughness:.6}),Mw=new THREE.MeshStandardMaterial({color:0x2a2420,roughness:.55}),Mi=new THREE.MeshStandardMaterial({color:0x2b2622,roughness:.9}),Ml=new THREE.MeshStandardMaterial({color:lace,roughness:.6});
  const hw=t=>W*(.8+.2*Math.sin(Math.PI*Math.min(1,t*1.15)))*(t<.1?Math.sqrt(t/.1):1)*(t>.84?Math.sqrt(Math.max(0,1-((t-.84)/.16)**2)):1),st=t=>.02-.008*SS(.2,.34,t),
    ht=t=>(.066-.036*SS(.42,1,t)+.012*Math.exp(-(((t-.42)/.13)**2)))*(t<.06?.9:1);
  const surf=(t0,t1,off,mat)=>{const nt=30,na=20,P=[],I=[];for(let i=0;i<=nt;i++){const t=t0+(t1-t0)*i/nt,z=-L+t*2*L,w=hw(t)+off,h=ht(t)+off,b=st(t);for(let k=0;k<=na;k++){const a=Math.PI*k/na,s=Math.sin(a);P.push(w*Math.cos(a),b+h*Math.pow(s,.75),z);}}
    for(let i=0;i<nt;i++)for(let k=0;k<na;k++){const a=i*(na+1)+k,b=a+na+1;I.push(a,a+1,b,a+1,b+1,b);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();const m=new THREE.Mesh(g,mat);G.add(m);return m;};
  surf(0,1,0,Mu);surf(.34,.62,.0016,Ms);
  /* the opening at the back and the lacing over the instep */
  const op=new THREE.Mesh(new THREE.CircleGeometry(1,28),Mi);op.rotation.x=-Math.PI/2;op.scale.set(W*.62,L*.26,1);op.position.set(0,st(.2)+ht(.2)+.003,-L+.2*2*L);op.rotation.x=-Math.PI/2+.12;G.add(op);
  for(let k=0;k<4;k++){const t=.38+k*.05,z=-L+t*2*L,y=st(t)+ht(t)+.0028;const lc=new THREE.Mesh(new THREE.BoxGeometry(W*.62,.0022,.0034),Ml);lc.position.set(0,y,z);lc.rotation.x=-.25;G.add(lc);}
  /* welted sole: thin at the toe, stacked heel */
  const fp=new THREE.Shape();const N=40;for(let i=0;i<=N;i++){const t=i/N;const z=-L+t*2*L,x=hw(t)*1.05+.002;i?fp.lineTo(x,z):fp.moveTo(x,z);}for(let i=N;i>=0;i--){const t=i/N;fp.lineTo(-(hw(t)*1.05+.002),-L+t*2*L);}
  const mk=(d,y,mat)=>{const g=new THREE.ExtrudeGeometry(fp,{depth:d,bevelEnabled:true,bevelThickness:.0015,bevelSize:.0012,bevelSegments:2,curveSegments:4});g.rotateX(Math.PI/2);g.translate(0,y+d,0);const m=new THREE.Mesh(g,mat);G.add(m);return m;};
  mk(.0105,0,Mo);mk(.0035,.0105,Mw);
  const hs=new THREE.Shape();for(let i=0;i<=16;i++){const t=.3*i/16;const z=-L+t*2*L,x=hw(Math.max(.02,t))*1.02;i?hs.lineTo(x,z):hs.moveTo(x,z);}for(let i=16;i>=0;i--){const t=.3*i/16;hs.lineTo(-hw(Math.max(.02,t))*1.02,-L+t*2*L);}
  const hg=new THREE.ExtrudeGeometry(hs,{depth:.008,bevelEnabled:false});hg.rotateX(Math.PI/2);hg.translate(0,.014,0);G.add(new THREE.Mesh(hg,Mo));
  G.traverse(o=>{if(o.isMesh)o.castShadow=true;});return G;}
const SHOE_CLASSIC=[['#f3f2ee','#1c1c1e','#ebe7dd','#1c1c1e'],['#f3f2ee','#6b4226','#e4dccb','#6b4226'],['#f4f4f1','#1f2a44','#f4f4f1','#1f2a44'],['#c9a57b','#5a3a22','#3a2a1c','#3a2a1c'],['#f4f4f1','#f4f4f1','#f4f4f1','#d8d8d4'],['#9aa1a8','#f3f2ee','#f3f2ee','#3b3f44']];
function buildAttire(p,lk,T,B,g,R){const J=T.J;const M=T.MEAS,dk=lk.shoes&&new THREE.Color(lk.shoes).getHSL({}).l<.4,sc=dk?(hashId(p.id)%2?['#1d1d1f','#1d1d1f','#1d1d1f','#1d1d1f']:['#f3f2ee','#1c1c1e','#1d1d1f','#1c1c1e']):SHOE_CLASSIC[hashId(p.id)%SHOE_CLASSIC.length];
  for(const s of[1,-1]){const b=M.foot[s],sd=s>0?'l':'r';if(!(b[1]>b[0]))continue;const len=(b[5]-b[4])*1.12,wid=(b[1]-b[0])*1.22,sh=makeShoe(len,wid,sc[0],sc[1],sc[2],sc[3]);
    const ctr=v3((b[0]+b[1])/2,b[2]-.012,(b[4]+b[5])/2+len*.02),holder=new THREE.Group();holder.add(sh);attachRest(holder,B['foot_'+sd],ctr);}
  /* trousers or golf shorts: loose segments that ride the leg joints */
  const pm=new THREE.MeshLambertMaterial({color:lk.legs.color,map:fabricTex(),side:THREE.DoubleSide}),shorts=!!lk.legs.shorts;R.pants=[];
  if(lk.legs.skirt){const top=T.J.waistY-.005,hem=wp2(B.thigh_l).y-.55*(wp2(B.thigh_l).y-wp2(B.calf_l).y),Lh=top-hem,N=48,prof=[];
    for(let j=0;j<=10;j++){const u=j/10;prof.push(new THREE.Vector2(M.hipX*(1.08+.42*Math.pow(u,1.25)),-u*Lh));}
    const sg=new THREE.LatheGeometry(prof,N),sp=sg.attributes.position;for(let i=0;i<sp.count;i++){const x=sp.getX(i),z=sp.getZ(i),y=sp.getY(i),a=Math.atan2(x,z),u=-y/Lh,pl=1+.045*u*Math.sin(a*22);sp.setX(i,x*pl);sp.setZ(i,z*pl*((M.hipZ1-M.hipZ0)/2/M.hipX)*1.08);}sg.computeVertexNormals();
    const sk=new THREE.Mesh(sg,pm);sk.castShadow=true;const sG=new THREE.Group();sG.add(sk);const hemB=new THREE.Mesh(new THREE.TorusGeometry(1,.006,6,56),pm);hemB.rotation.x=Math.PI/2;hemB.scale.set(M.hipX*1.5,M.hipX*1.5*((M.hipZ1-M.hipZ0)/2/M.hipX)*1.08,1);hemB.position.y=-Lh;sG.add(hemB);
    attachRest(sG,B.pelvis,v3(0,top,(M.hipZ0+M.hipZ1)/2));}
  for(const s of(lk.legs.skirt||R.shl?[]:[1,-1])){const sd=s>0?'l':'r',P={sd,shorts};
    if(shorts){P.th=segMesh(M.rT*1.02,M.rT*.92,pm,g);}
    else{P.th=segMesh(M.rT*.99,M.rK*1.06,pm,g);P.kn=new THREE.Mesh(new THREE.SphereGeometry(M.rK*1.06,18,12),pm);g.add(P.kn);P.sn=segMesh(M.rK*1.04,Math.max(M.rA*1.45,.046),pm,g);}
    R.pants.push(P);}
  if(!lk.legs.skirt&&!R.shl){const seat=new THREE.Mesh(new THREE.SphereGeometry(1,30,14,0,Math.PI*2,Math.PI/2,Math.PI/2),pm);seat.scale.set(M.hipX*1.02,Math.max(.1,(T.J.waistY-M.crotchY))*1.02,(M.hipZ1-M.hipZ0)/2*1.05);
  const seatG=new THREE.Group();seatG.add(seat);attachRest(seatG,B.pelvis,v3(0,T.J.waistY-.02,(M.hipZ0+M.hipZ1)/2));}
  const belt=new THREE.Mesh(new THREE.TorusGeometry(1,.02,8,40),new THREE.MeshStandardMaterial({color:0x1d1b1a,roughness:.45}));belt.rotation.x=Math.PI/2;belt.scale.set(M.hipX*(R.shl?1.13:1.04),(M.hipZ1-M.hipZ0)/2*(R.shl?1.16:1.07),1);const bG=new THREE.Group();bG.add(belt);
  const buck=new THREE.Mesh(new THREE.BoxGeometry(.04,.028,.006),new THREE.MeshStandardMaterial({color:0xcfd3d8,metalness:1,roughness:.25}));buck.position.set(0,0,(M.hipZ1-M.hipZ0)/2*(R.shl?1.2:1.14)+.004);bG.add(buck);if(lk.top.type==='hawaiian'){bG.visible=false;const hm=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide,map:(()=>{const t=hawaiiTex(lk.top.pat,true);t.repeat.set(4,.45);return t;})()}),ez=(M.hipZ1-M.hipZ0)/2/M.hipX;
    const hem=new THREE.Mesh(new THREE.CylinderGeometry(M.hipX*1.16,M.hipX*1.24,.11,44,1,true),hm);hem.scale.z=ez*1.06;hem.castShadow=true;const hG=new THREE.Group();hG.add(hem);attachRest(hG,B.pelvis,v3(0,T.J.waistY-.035,(M.hipZ0+M.hipZ1)/2));}
  attachRest(bG,B.pelvis,v3(0,T.J.waistY-.018,(M.hipZ0+M.hipZ1)/2));
  /* collar: a folded collar with thickness (stand + fall) that rises up the neck, points that lie on the chest */
  const ty=lk.top.type,hw=ty==='hawaiian',cc=hw?new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide,map:(()=>{const t=hawaiiTex(lk.top.pat,true);t.repeat.set(1.2,1.2);return t;})()}):new THREE.MeshLambertMaterial({color:ty==='vest'?(lk.top.arms||lk.top.color):lk.top.color,side:THREE.DoubleSide,map:fabricTex()}),r=M.neckR,C=new THREE.Group(),zip=ty==='zip'||ty==='fleece';
  const O=.013,gap=hw?.6:zip?.09:.34,prof=zip?[[r+O+.002,-.006],[r+.006,.05],[r+.008,.058],[r+.016,.057],[r+O+.006,-.006]]:[[r+O+.003,-.007],[r+.006,.034],[r+.008,.043],[r+.016,.045],[r+.025,.028],[r+.034,.004],[r+.032,-.008]];
  const lg=new THREE.LatheGeometry(prof.concat([prof[0]]).map(q=>new THREE.Vector2(q[0],q[1])),64,gap,Math.PI*2-2*gap);lg.computeVertexNormals();const band=new THREE.Mesh(lg,cc);C.add(band);
  if(!zip){const len=hw?.085:.066,drop=hw?.1:.072;for(const s of[-1,1]){const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(s*len,-.009);sh.quadraticCurveTo(s*len*.8,-drop*.6,s*len*.46,-drop);sh.lineTo(-s*.003,-drop*.72);sh.lineTo(0,0);
      const eg=new THREE.ExtrudeGeometry(sh,{depth:.0035,bevelEnabled:true,bevelThickness:.0012,bevelSize:.001,bevelSegments:2});const pt=new THREE.Mesh(eg,cc);const a=s*gap;pt.position.set(Math.sin(a)*(r+.03),-.002,Math.cos(a)*(r+.03)-.002);pt.rotation.set(-.5,s*.3,0);C.add(pt);}}
  /* placket, buttons or zipper follow the actual chest surface (outside the shirt layer) */
  const chestAt=y=>{let m=-1e9;for(let v=0;v<T.cls.length;v++){if(T.cls[v]!==2)continue;const x=T.pos[v*3],yy=T.pos[v*3+1],z=T.pos[v*3+2];if(Math.abs(x)<.03&&Math.abs(yy-y)<.012&&z>m)m=z;}return m>-1e8?m:M.chestZ;};
  const PK=new THREE.Group(),y0=M.neckY-.045,y1=M.neckY-(hw?.26:zip?.2:.15),A0=v3(0,y0,chestAt(y0)+O+.006),A1=v3(0,y1,chestAt(y1)+O+.016),seg=(len,w,d,m)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,len,d),m);return b;};
  const dir=A1.clone().sub(A0),L0=dir.length(),mid=A0.clone().lerp(A1,.5),q0=new THREE.Quaternion().setFromUnitVectors(v3(0,1,0),dir.clone().normalize());
  if(zip){const zl=seg(L0,.007,.004,new THREE.MeshStandardMaterial({color:0x9ea3a9,metalness:.85,roughness:.3}));zl.position.copy(mid);zl.quaternion.copy(q0);PK.add(zl);
    const pl=new THREE.Mesh(new THREE.BoxGeometry(.012,.022,.005),new THREE.MeshStandardMaterial({color:0xd0d4d9,metalness:1,roughness:.2}));pl.position.copy(A0).add(v3(0,.004,.004));PK.add(pl);}
  else{if(!hw){const pk=seg(L0,.028,.004,cc);pk.position.copy(mid);pk.quaternion.copy(q0);PK.add(pk);}
    const bm=new THREE.MeshStandardMaterial({color:hw?0xf3eee2:0xf4f3ef,roughness:.3});const nb=hw?3:3;for(let k=0;k<nb;k++){const t=hw?.25+k*.33:.12+k*.36,bp=A0.clone().lerp(A1,t);bp.z+=hw?.002:.004;const bt=new THREE.Mesh(new THREE.CylinderGeometry(.0052,.0052,.0026,14),bm);bt.position.copy(bp);bt.quaternion.copy(q0).multiply(new THREE.Quaternion().setFromAxisAngle(v3(1,0,0),Math.PI/2));PK.add(bt);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.0042,.0008,6,16),new THREE.MeshStandardMaterial({color:0xcfccc4,roughness:.4}));ring.position.copy(bp).add(v3(0,0,.0014));ring.quaternion.copy(bt.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(v3(1,0,0),Math.PI/2));PK.add(ring);}}
  PK.traverse(o=>{if(o.isMesh)o.castShadow=true;});attachRest(PK,B.spine_03,v3(0,0,0));
  attachRest(C,B.spine_03,v3(0,M.neckY-.006,M.neckZ),new THREE.Quaternion().setFromAxisAngle(v3(1,0,0),.28));
  C.traverse(o=>{if(o.isMesh)o.castShadow=true;});}
/* stand bag in the lightweight-carry style, loaded with a matching set */
function makeBag(p){const acc=new THREE.Color(p.color||'#e0a030'),main=new THREE.MeshStandardMaterial({color:0x1b1e23,roughness:.62,map:fabricTex()}),pan=new THREE.MeshStandardMaterial({color:acc,roughness:.5}),
    wht=new THREE.MeshStandardMaterial({color:0xf2f2ef,roughness:.45}),rub=new THREE.MeshStandardMaterial({color:0x111214,roughness:.8}),chrome=new THREE.MeshStandardMaterial({color:0xe5e8ec,metalness:.9,roughness:.25}),
    blk=new THREE.MeshStandardMaterial({color:0x121316,metalness:.4,roughness:.35});
  const O=new THREE.Group(),body=new THREE.Group();O.add(body);body.rotation.x=-.3;
  const prof=[[.105,0],[.118,.04],[.124,.2],[.119,.45],[.123,.72],[.128,.8]].map(q=>new THREE.Vector2(q[0],q[1]));const lb=new THREE.Mesh(new THREE.LatheGeometry(prof,40),main);lb.scale.z=.82;body.add(lb);
  const pnl=new THREE.Mesh(new THREE.LatheGeometry([[.1215,.2],[.126,.3],[.122,.45],[.125,.62],[.128,.7]].map(q=>new THREE.Vector2(q[0],q[1])),28,-.75,1.5),pan);pnl.scale.z=.84;body.add(pnl);
  const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.14,.13,.1,40,1,true),main);cuff.scale.z=.84;cuff.position.y=.85;body.add(cuff);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.14,.011,10,48),pan);rim.rotation.x=Math.PI/2;rim.scale.y=.84;rim.position.y=.9;body.add(rim);
  for(const y of[.12,.8]){const pp=new THREE.Mesh(new THREE.TorusGeometry(.123,.004,6,48),wht);pp.rotation.x=Math.PI/2;pp.scale.y=.82;pp.position.y=y;body.add(pp);}
  for(const a of[0,Math.PI/2]){const dv=new THREE.Mesh(new THREE.BoxGeometry(.26,.03,.006),rub);dv.position.y=.885;dv.rotation.y=a;dv.scale.set(a?.84:1,1,1);body.add(dv);}
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.11,.1,.05,32),rub);base.scale.z=.82;base.position.y=.02;body.add(base);
  const rr=(w,h,d,m,x,y,z)=>{const s=new THREE.Shape(),r=.02;s.moveTo(-w/2+r,-h/2);s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    const e=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:3}),m);e.position.set(x,y,z);body.add(e);return e;};
  rr(.15,.2,.03,main,0,.3,.085);rr(.13,.05,.012,pan,0,.44,.118);const zp=new THREE.Mesh(new THREE.BoxGeometry(.13,.004,.004),chrome);zp.position.set(0,.4,.132);body.add(zp);
  rr(.1,.32,.02,main,-.06,.52,.08).rotation.z=.08;
  const lab=(()=>{const c=document.createElement('canvas');c.width=256;c.height=96;const x=c.getContext('2d');x.fillStyle='#f2f2ef';x.font='italic 800 64px "Barlow Condensed","Arial Narrow",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('DEGEN',128,50);const t=new THREE.CanvasTexture(c);return t;})();
  const lm=new THREE.Mesh(new THREE.PlaneGeometry(.12,.045),new THREE.MeshStandardMaterial({map:lab,transparent:true,roughness:.5}));lm.position.set(0,.6,.113);body.add(lm);
  for(const s of[-1,1]){const cv=new THREE.CatmullRomCurve3([new THREE.Vector3(s*.05,.78,-.1),new THREE.Vector3(s*.09,.62,-.19),new THREE.Vector3(s*.07,.42,-.16),new THREE.Vector3(s*.04,.36,-.1)]);body.add(new THREE.Mesh(new THREE.TubeGeometry(cv,20,.018,8),blk));}
  /* legs: two carbon rods from the upper back to the turf behind */
  body.updateMatrixWorld(true);for(const s of[-1,1]){const top=body.localToWorld(v3(s*.06,.68,-.11)),foot=v3(s*.2,0,-.46),leg=segMesh(.008,.007,blk,O);placeSeg(leg,top,foot);const ft=new THREE.Mesh(new THREE.CylinderGeometry(.018,.02,.02,12),rub);ft.position.copy(foot).add(v3(0,.01,0));O.add(ft);}
  /* the set: headcovers for driver, fairway and hybrid, a putter cover, and a run of forged irons */
  const hcT=(()=>{const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');x.fillStyle='#16181c';x.fillRect(0,0,256,128);x.fillStyle='#'+acc.getHexString();x.fillRect(0,40,256,22);x.fillStyle='#f2f2ef';x.fillRect(0,66,256,6);x.fillRect(0,34,256,4);const t=new THREE.CanvasTexture(c);return t;})();
  const hcm=new THREE.MeshStandardMaterial({map:hcT,roughness:.55});
  [[-.06,1.13,-.03,1],[.04,1.1,-.06,.9],[.075,1.06,.02,.8]].forEach(([x,y,z,k])=>{const sh=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.26,12),hcm);sh.position.set(x,y-.2,z);body.add(sh);
    const hd=new THREE.Mesh(new THREE.SphereGeometry(.07*k,24,16),hcm);hd.scale.set(1,.85,1.25);hd.position.set(x,y,z+.03);hd.rotation.x=.4;body.add(hd);});
  const pc=new THREE.Mesh(new THREE.BoxGeometry(.11,.05,.06),new THREE.MeshStandardMaterial({color:0x1a1b1f,roughness:.4}));pc.position.set(-.05,.95,.03);pc.rotation.set(.3,.2,0);body.add(pc);
  const pcb=new THREE.Mesh(new THREE.BoxGeometry(.112,.012,.062),pan);pcb.position.copy(pc.position).add(v3(0,-.02,0));pcb.rotation.copy(pc.rotation);body.add(pcb);
  const bs=new THREE.Shape();bs.moveTo(0,0);bs.lineTo(.066,.002);bs.quadraticCurveTo(.078,.012,.074,.03);bs.lineTo(.064,.04);bs.lineTo(.012,.03);bs.lineTo(0,.02);const bgeo=new THREE.ExtrudeGeometry(bs,{depth:.016,bevelEnabled:true,bevelThickness:.002,bevelSize:.002,bevelSegments:1});
  for(let i=0;i<8;i++){const a=-.9+i*.26,x=Math.sin(a)*.07,z=.02+Math.cos(a)*.05-.03,y=.96+i*.008;const sh=new THREE.Mesh(new THREE.CylinderGeometry(.0045,.0045,.18,8),chrome);sh.position.set(x,y-.09,z);body.add(sh);
    const h=new THREE.Mesh(bgeo,chrome);h.position.set(x,y,z);h.rotation.set(-Math.PI/2+.2,a+.3,Math.PI/2);h.scale.setScalar(.9);body.add(h);}
  O.traverse(o=>{if(o.isMesh)o.castShadow=true;});return O;}
const SK={bend:.6,drop:.075,ballZ:.70,swR:.56,stance:.19,tilt:.13};

/* Hawaiian prints: tileable canvases, hibiscus or plumeria over palm and monstera leaves */
const HPAL={classic:{base:'#1b2a4e',fl:['#f4f1e8','#f7c948'],lf:['#2f8f83','#246b62'],ctr:'#e0533d',kind:'hib'},
  lagoon:{base:'#127c7a',fl:['#ff8a3d','#ffd166'],lf:['#0b4f4c','#3fb39a'],ctr:'#c2185b',kind:'hib'},
  sunset:{base:'#e2563f',fl:['#fff4e0','#ffd166'],lf:['#2e6b3a','#1f4f2a'],ctr:'#8e1c2b',kind:'plu'},
  nightbloom:{base:'#141418',fl:['#ff4fa3','#b36bff'],lf:['#1f7a4d','#2fb36b'],ctr:'#ffe066',kind:'hib'},
  pineapple:{base:'#f2c230',fl:['#e63946','#ffffff'],lf:['#2d6a4f','#40916c'],ctr:'#7a1f1f',kind:'hib'},
  plumeria:{base:'#4da3d9',fl:['#ffffff','#ffe29a'],lf:['#1b5e7a','#2a7fa0'],ctr:'#f4b400',kind:'plu'}};
const _hcan={};
function hawaiiCanvas(name){if(_hcan[name])return _hcan[name];if(name==='pinstripe'){const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#f1f3ee';x.fillRect(0,0,256,256);for(let i=0;i<256;i+=16){x.fillStyle='#8fa89a';x.fillRect(i,0,3,256);x.fillStyle='rgba(120,140,130,.35)';x.fillRect(i+8,0,1,256);}return _hcan[name]=c;}const P=HPAL[name]||HPAL.classic,N=512,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');
  let sd=0;for(const ch of name)sd=(sd*31+ch.charCodeAt(0))%2147483647;const R=()=>{sd=(sd*16807)%2147483647;return(sd-1)/2147483646;};
  x.fillStyle=P.base;x.fillRect(0,0,N,N);
  const wrap=f=>{for(const dx of[-N,0,N])for(const dy of[-N,0,N]){x.save();x.translate(dx,dy);f();x.restore();}};
  const leaf=(cx,cy,s,a,col)=>{x.save();x.translate(cx,cy);x.rotate(a);x.scale(s,s);x.fillStyle=col;x.beginPath();x.moveTo(0,-60);x.bezierCurveTo(40,-40,42,30,0,62);x.bezierCurveTo(-42,30,-40,-40,0,-60);x.fill();
    x.strokeStyle=P.base;x.lineWidth=4;for(let k=-3;k<=3;k++){if(!k)continue;const y=k*14;x.beginPath();x.moveTo(0,y-6);x.lineTo(Math.sign(k)*(k%2?46:40),y+8);x.stroke();x.beginPath();x.moveTo(0,y-6);x.lineTo(-Math.sign(k)*(k%2?40:46),y+8);x.stroke();}
    x.strokeStyle='rgba(255,255,255,.18)';x.lineWidth=2;x.beginPath();x.moveTo(0,-56);x.lineTo(0,58);x.stroke();x.restore();};
  const frond=(cx,cy,s,a,col)=>{x.save();x.translate(cx,cy);x.rotate(a);x.scale(s,s);x.strokeStyle=col;x.lineCap='round';x.lineWidth=3;x.beginPath();x.moveTo(0,70);x.quadraticCurveTo(6,0,0,-70);x.stroke();x.fillStyle=col;
    for(let k=0;k<11;k++){const y=-62+k*12;for(const sgn of[-1,1]){x.beginPath();x.moveTo(1,y);x.quadraticCurveTo(sgn*22,y-10,sgn*(40-k*1.6),y+6);x.quadraticCurveTo(sgn*18,y+2,1,y+5);x.fill();}}x.restore();};
  const hib=(cx,cy,s,a,col,col2)=>{x.save();x.translate(cx,cy);x.rotate(a);x.scale(s,s);for(let k=0;k<5;k++){x.save();x.rotate(k*Math.PI*2/5);const g=x.createRadialGradient(0,-10,2,0,-26,34);g.addColorStop(0,P.ctr);g.addColorStop(.28,col);g.addColorStop(1,col2);x.fillStyle=g;
    x.beginPath();x.moveTo(0,0);x.bezierCurveTo(-26,-12,-30,-44,-8,-52);x.quadraticCurveTo(0,-47,8,-52);x.bezierCurveTo(30,-44,26,-12,0,0);x.fill();x.strokeStyle='rgba(0,0,0,.12)';x.lineWidth=1.2;x.stroke();x.restore();}
    x.strokeStyle=P.ctr;x.lineWidth=3;x.beginPath();x.moveTo(0,0);x.lineTo(20,-30);x.stroke();x.fillStyle='#ffd23f';for(let k=0;k<6;k++){x.beginPath();x.arc(18+Math.cos(k)*5,-30+Math.sin(k)*5,2.6,0,7);x.fill();}x.restore();};
  const plu=(cx,cy,s,a,col,col2)=>{x.save();x.translate(cx,cy);x.rotate(a);x.scale(s,s);for(let k=0;k<5;k++){x.save();x.rotate(k*Math.PI*2/5+.2);const g=x.createLinearGradient(0,0,0,-40);g.addColorStop(0,col2);g.addColorStop(.45,col);g.addColorStop(1,col);x.fillStyle=g;
    x.beginPath();x.moveTo(0,0);x.bezierCurveTo(-18,-8,-22,-38,-2,-42);x.bezierCurveTo(16,-44,20,-18,0,0);x.fill();x.strokeStyle='rgba(0,0,0,.1)';x.lineWidth=1;x.stroke();x.restore();}
    const g=x.createRadialGradient(0,0,0,0,0,12);g.addColorStop(0,P.ctr);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.beginPath();x.arc(0,0,12,0,7);x.fill();x.restore();};
  for(let i=0;i<9;i++){const cx=R()*N,cy=R()*N,s=.7+R()*.6,a=R()*6.28,col=P.lf[i%2];wrap(()=>(i%3?leaf:frond)(cx,cy,s,a,col));}
  for(let i=0;i<13;i++){const cx=R()*N,cy=R()*N,s=.55+R()*.5,a=R()*6.28,k=R()<.7?0:1;wrap(()=>(P.kind==='plu'?plu:hib)(cx,cy,s,a,P.fl[k],P.fl[1-k]));}
  for(let i=0;i<40;i++){const cx=R()*N,cy=R()*N;wrap(()=>{x.fillStyle=P.fl[1];x.globalAlpha=.55;x.beginPath();x.arc(cx,cy,2+R()*2,0,7);x.fill();x.globalAlpha=1;});}
  return _hcan[name]=c;}
function hawaiiTex(name,srgb){const t=new THREE.CanvasTexture(hawaiiCanvas(name));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(srgb)t.encoding=THREE.sRGBEncoding;return t;}
function golfLook(lk0,skin){const lk=JSON.parse(JSON.stringify(lk0)),t=lk.top;if(lk.legs&&lk.legs.skirt)lk.legs.shorts=true;if(t.color===skin){t.color='#ece6d6';t.type='polo';}if(t.type==='tee')t.type='polo';if(t.type==='hoodie')t.type='zip';return lk;}

/* ---------- garments: smoothed, offset skinned shells of the body so shirts and trousers have real volume ---------- */
function makeShell(body,geo,mat,rg,region,T,J,opt){const idx=geo.index.array,n=geo.attributes.position.count,sel=[];
  for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],c=idx[t+2];if(rg[a]===region&&rg[b]===region&&rg[c]===region)sel.push(a,b,c);}
  if(sel.length<30)return null;
  const gid=new Int32Array(n).fill(-1),kmap=new Map(),gp=[];let ng=0;
  for(let k=0;k<sel.length;k++){const i=sel[k];if(gid[i]>=0)continue;const key=Math.round(T.pos[i*3]*2e3)+','+Math.round(T.pos[i*3+1]*2e3)+','+Math.round(T.pos[i*3+2]*2e3);let g=kmap.get(key);if(g===undefined){g=ng++;kmap.set(key,g);gp.push(T.pos[i*3],T.pos[i*3+1],T.pos[i*3+2]);}gid[i]=g;}
  const P=new Float32Array(gp),nb=Array.from({length:ng},()=>new Set()),ec=new Map();
  for(let t=0;t<sel.length;t+=3){const a=gid[sel[t]],b=gid[sel[t+1]],c=gid[sel[t+2]];nb[a].add(b);nb[a].add(c);nb[b].add(a);nb[b].add(c);nb[c].add(a);nb[c].add(b);
    for(const [u,v] of [[a,b],[b,c],[c,a]]){const k=u<v?u+'_'+v:v+'_'+u;ec.set(k,(ec.get(k)||0)+1);}}
  const bd=new Uint8Array(ng);ec.forEach((v,k)=>{if(v===1){const [u,w]=k.split('_');bd[+u]=1;bd[+w]=1;}});
  const tmp=new Float32Array(ng*3),step=lam=>{for(let g=0;g<ng;g++){if(bd[g]){tmp[g*3]=P[g*3];tmp[g*3+1]=P[g*3+1];tmp[g*3+2]=P[g*3+2];continue;}let sx=0,sy=0,sz=0,c=0;for(const h of nb[g]){sx+=P[h*3];sy+=P[h*3+1];sz+=P[h*3+2];c++;}
      tmp[g*3]=P[g*3]+lam*(sx/c-P[g*3]);tmp[g*3+1]=P[g*3+1]+lam*(sy/c-P[g*3+1]);tmp[g*3+2]=P[g*3+2]+lam*(sz/c-P[g*3+2]);}P.set(tmp);};
  for(let it=0;it<opt.smooth;it++){step(.55);step(-.57);}
  const N=new Float32Array(ng*3);for(let t=0;t<sel.length;t+=3){const a=gid[sel[t]],b=gid[sel[t+1]],c=gid[sel[t+2]];const ux=P[b*3]-P[a*3],uy=P[b*3+1]-P[a*3+1],uz=P[b*3+2]-P[a*3+2],vx=P[c*3]-P[a*3],vy=P[c*3+1]-P[a*3+1],vz=P[c*3+2]-P[a*3+2];
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;for(const g of[a,b,c]){N[g*3]+=nx;N[g*3+1]+=ny;N[g*3+2]+=nz;}}
  const Mi=body.matrixWorld.clone().invert(),Nm=new THREE.Matrix3().getNormalMatrix(Mi),pos=geo.attributes.position.array.slice(),nrm=geo.attributes.normal.array.slice(),v=new THREE.Vector3(),w=new THREE.Vector3();
  for(let g=0;g<ng;g++){const l=Math.hypot(N[g*3],N[g*3+1],N[g*3+2])||1;N[g*3]/=l;N[g*3+1]/=l;N[g*3+2]/=l;const y=P[g*3+1],o=opt.off(y,bd[g])||0;P[g*3]+=N[g*3]*o;P[g*3+1]+=N[g*3+1]*o;P[g*3+2]+=N[g*3+2]*o;}
  for(let i=0;i<n;i++){const g=gid[i];if(g<0)continue;v.set(P[g*3],P[g*3+1],P[g*3+2]).applyMatrix4(Mi);pos[i*3]=v.x;pos[i*3+1]=v.y;pos[i*3+2]=v.z;w.set(N[g*3],N[g*3+1],N[g*3+2]).applyMatrix3(Nm).normalize();nrm[i*3]=w.x;nrm[i*3+1]=w.y;nrm[i*3+2]=w.z;}
  const sg=new THREE.BufferGeometry();for(const k in geo.attributes)sg.setAttribute(k,geo.attributes[k]);sg.setAttribute('position',new THREE.BufferAttribute(pos,3));sg.setAttribute('normal',new THREE.BufferAttribute(nrm,3));sg.setIndex(sel);
  const sm=new THREE.SkinnedMesh(sg,mat);sm.position.copy(body.position);sm.quaternion.copy(body.quaternion);sm.scale.copy(body.scale);body.parent.add(sm);sm.bind(body.skeleton,body.bindMatrix);sm.frustumCulled=false;sm.castShadow=true;sm.receiveShadow=true;return sm;}
function dressBody(body,geo,mat,RG,T,J,lk){const sh=makeShell(body,geo,mat,RG,1,T,J,{smooth:6,off:(y,b)=>.011+.012*sstepJ(J.waistY+.28,J.waistY,y)+(b?.002:0)});
  const pa=makeShell(body,geo,mat,RG,2,T,J,{smooth:5,off:(y,b)=>.013+.008*sstepJ(J.kneeY,J.kneeY-.3,y)});
  if(!sh&&!pa)return false;const idx=geo.index.array,keep=[],foot=v=>T.cls[v]===6&&T.pos[v*3+1]<J.shoeY+.02;for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],c=idx[t+2],r=RG[a];if(r&&RG[b]===r&&RG[c]===r&&((r===1&&sh)||(r===2&&pa)))continue;if(foot(a)&&foot(b)&&foot(c))continue;keep.push(a,b,c);}geo.setIndex(keep);return{shirt:!!sh,pants:!!pa};}

/* ---------- 3D faces: each golfer's photo reconstructed into a 468-point face surface (MediaPipe landmarks), textured from the photo ---------- */
function buildFace3D(p,T,B){const FD=window.FACE3D&&FACE3D.faces&&FACE3D.faces[p.id];if(!FD||!T.cls)return false;
  try{const n=468,tri=FACE3D.tri,g=(i,k)=>FD[i*3+k];
    const lx=(g(33,0)+g(133,0))/2,ly=(g(33,1)+g(133,1))/2,rx=(g(362,0)+g(263,0))/2,ry=(g(362,1)+g(263,1))/2,cx=(lx+rx)/2,cy=(ly+ry)/2,dn=Math.hypot(rx-lx,ry-ly),s=2*T.eyeX*1.07/dn,zE=(g(33,2)+g(133,2)+g(362,2)+g(263,2))/4;
    const P=new Float32Array(n*3),UV=new Float32Array(n*2),A=new Float32Array(n);
    for(let i=0;i<n;i++){P[i*3]=(g(i,0)-cx)*s;P[i*3+1]=T.eyeY-(g(i,1)-cy)*s;P[i*3+2]=-(g(i,2)-zE)*s;UV[i*2]=g(i,0);UV[i*2+1]=1-g(i,1);}
    /* rings in from the face outline: fade and tuck the edge back into the head */
    const nb=Array.from({length:n},()=>new Set());for(let t=0;t<tri.length;t+=3){const a=tri[t],b=tri[t+1],c=tri[t+2];nb[a].add(b).add(c);nb[b].add(a).add(c);nb[c].add(a).add(b);}
    const d=new Int16Array(n).fill(99);let fr=[];for(const i of FACE3D.oval){d[i]=0;fr.push(i);}for(let k=1;k<4;k++){const nx=[];for(const i of fr)for(const j of nb[i])if(d[j]>k){d[j]=k;nx.push(j);}fr=nx;}
    for(let i=0;i<n;i++){A[i]=d[i]===0?0:d[i]===1?.45:d[i]===2?.85:1;P[i*3+2]-=d[i]===0?.014:d[i]===1?.006:d[i]===2?.002:0;}
    /* sit the surface just in front of the sculpted face: eyes at the eye line, then push forward until nothing pokes through */
    const z0=T.eyeZ+.012;let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;for(let i=0;i<n;i++){P[i*3+2]+=z0;if(d[i]>=2){mnx=Math.min(mnx,P[i*3]);mxx=Math.max(mxx,P[i*3]);mny=Math.min(mny,P[i*3+1]);mxy=Math.max(mxy,P[i*3+1]);}}
    let pen=0;const pos=T.pos,cls=T.cls,N=cls.length;for(let v=0;v<N;v++){if(cls[v]!==1)continue;const x=pos[v*3],y=pos[v*3+1],z=pos[v*3+2];if(x<mnx||x>mxx||y<mny||y>mxy||z<T.eyeZ-.035)continue;
      let bi=-1,bd=1e9;for(let i=0;i<n;i++){if(d[i]<2)continue;const dx=P[i*3]-x,dy=P[i*3+1]-y,q=dx*dx+dy*dy;if(q<bd){bd=q;bi=i;}}if(bi>=0&&bd<.0001){const pz=z-P[bi*3+2];if(pz>pen)pen=pz;}}
    const sh=Math.min(.03,pen+.003);for(let i=0;i<n;i++)P[i*3+2]+=sh;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3));geo.setAttribute('uv',new THREE.BufferAttribute(UV,2));geo.setAttribute('aA',new THREE.BufferAttribute(A,1));geo.setIndex(tri.slice());geo.computeVertexNormals();
    const tx=faceTex(p.id);tx.encoding=THREE.sRGBEncoding;const m=new THREE.MeshStandardMaterial({map:tx,emissive:0xffffff,emissiveMap:tx,emissiveIntensity:.2,roughness:.6,metalness:0,transparent:true,envMapIntensity:.3});m.userData.lin=1;
    m.onBeforeCompile=sh2=>{sh2.vertexShader=sh2.vertexShader.replace('#include <common>','#include <common>\nattribute float aA;varying float vA;').replace('#include <begin_vertex>','#include <begin_vertex>\nvA=aA;');
      sh2.fragmentShader=sh2.fragmentShader.replace('#include <common>','#include <common>\nvarying float vA;').replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a*=vA;');};m.customProgramCacheKey=()=>'face3d';
    const mesh=new THREE.Mesh(geo,m);mesh.renderOrder=2;attachRest(mesh,B.Head,v3(0,0,0));return true;}catch(e){console.warn('face3d',e);return false;}}
function buildAvatarSkel(p){const F=window.FACES&&FACES[p.id],lk=golfLook(p.look,F?F.skin:p.look.skin),T=(p.look.rb&&TPL['RB_'+p.look.rb])||(!FEMALE.has(p.id)&&TPL.PRO_M)||TPL[FEMALE.has(p.id)?'F':'M'];
  const g=new THREE.Group(),root=THREE.SkeletonUtils.clone(T.scene);g.add(root);root.updateMatrixWorld(true);
  let body=null;const capOn=!!(lk.cap&&lk.cap.style&&lk.cap.style!=='none'&&lk.cap.style!=='band');root.traverse(o=>{if(o.isMesh){if(o.isSkinnedMesh&&o.name===T.bodyName)body=o;else if(T.rb&&/Hair/.test(o.name)&&!capOn){o.visible=true;o.frustumCulled=false;o.castShadow=true;}else o.visible=false;}});
  /* per-vertex clothing colors + face-photo projection */
  const geo=body.geometry.clone();body.geometry=geo;const n=geo.attributes.position.count,aC=new Float32Array(n*3),aS=new Float32Array(n),aF=new Float32Array(n*3);
  const skinHex=F?F.skin:lk.skin,col=h=>new THREE.Color(h).convertSRGBToLinear(),ty=lk.top.type;
  const cTop=col(lk.top.color),cSl=col(lk.top.arms||lk.top.color),cP=col(lk.legs.color),cSh=col(lk.shoes||'#f2f2f2'),cBelt=col('#232323'),cGl=col('#f6f6f3'),cSock=col('#ecece8'),cHair=col(lk.hair||'#1b1512');
  const RG=new Uint8Array(n),longSl=['zip','fleece','hoodie','vest'].includes(ty),bare=lk.top.color===skinHex,armsBare=(lk.top.arms||lk.top.color)===skinHex,vest=ty==='vest',shorts=!!lk.legs.shorts,J=T.J,hawaii=ty==='hawaiian'||!!lk.top.pat,aSh=new Float32Array(n);
  const slEnd=longSl?J.wristX-.02:J.shoulderX+(J.elbowX-J.shoulderX)*(lk.legs.skirt?.3:.5),FW=.2255;
  for(let i=0;i<n;i++){const x=T.pos[i*3],y=T.pos[i*3+1],z=T.pos[i*3+2],c=T.cls[i],ax=Math.abs(x);let C=null;
    if(c===1){}
    else if(c===9){if(lk.glove&&x>0)C=cGl;}
    else if(c===7||c===8||(c===2&&ax>J.shoulderX)){if(ax<slEnd&&!armsBare)C=(vest&&ax<J.shoulderX+.03)?cTop:cSl;if(bare&&ax<J.shoulderX+.03)C=null;}
    else if(y<J.shoeY||(c===6&&(shorts||lk.legs.skirt||y<J.shoeY+.035)))C=cSock;
    else if(y<J.sockY+.03)C=(shorts||lk.legs.skirt)?cSock:cP;
    else if(y>J.waistY-(hawaii?.07:0))C=bare?null:cTop;
    else if(y>J.waistY-.035)C=cBelt;
    else if(shorts&&y<J.kneeY+.1)C=null;
    else C=cP;
    const isHair=c===1&&(y>T.eyeY+.058||(y>T.eyeY-.035&&z<T.eyeZ-.105));if(isHair)C=cHair;
    if(C){aC[i*3]=C.r;aC[i*3+1]=C.g;aC[i*3+2]=C.b;aS[i]=0;aSh[i]=hawaii&&(C===cTop||C===cSl)?1:0;RG[i]=(C===cTop||C===cSl)?1:(C===cP||C===cBelt)?2:0;}else aS[i]=1;
    if(c===1&&F&&!isHair){const u=.5+x*T.fsx,vv=(1-102/256)+(y-T.eyeY)*T.fsy,nz=T.nrm[i*3+2];let w=sstepJ(-.35,.1,nz)*sstepJ(T.eyeZ-.075,T.eyeZ-.03,z);w*=sstepJ(.1,.2,vv)*(1-sstepJ(T.eyeY+.036,T.eyeY+.06,y))*sstepJ(.1,.2,u)*(1-sstepJ(.8,.9,u));if(u<0||u>1||vv<0||vv>1)w=0;aF[i*3]=u;aF[i*3+1]=vv;aF[i*3+2]=w;}}
  geo.setAttribute('aCloth',new THREE.BufferAttribute(aC,3));geo.setAttribute('aShirt',new THREE.BufferAttribute(aSh,1));geo.setAttribute('aBP',new THREE.BufferAttribute(T.pos,3));geo.setAttribute('aBN',new THREE.BufferAttribute(T.nrm,3));geo.setAttribute('aSkinW',new THREE.BufferAttribute(aS,1));geo.setAttribute('aFace',new THREE.BufferAttribute(aF,3));
  const mat=new THREE.MeshStandardMaterial({skinning:true,map:T.map,normalMap:T.nmap,roughness:.72,metalness:0,envMapIntensity:.5,normalScale:new THREE.Vector2(.55,.55)});mat.userData.lin=1;
  const U={uSkin:{value:col(skinHex)},uTexL:{value:T.texL},uFaceT:{value:faceTex(p.id)||T.map},uHasF:{value:0},uPat:{value:hawaii?hawaiiTex(lk.top.pat):T.map},uHasPat:{value:hawaii?1:0}};
  mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>','vec3 geoN=normal;\n#include <normal_fragment_maps>\nnormal=normalize(mix(geoN,normal,.12+.88*clamp(vSkinW,0.,1.)));');
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 aCloth;attribute float aSkinW;attribute vec3 aFace;varying vec3 vCloth;varying float vSkinW;varying vec3 vFace;attribute float aShirt;attribute vec3 aBP;attribute vec3 aBN;varying float vShirt;varying vec3 vBP;varying vec3 vBN;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCloth=aCloth;vSkinW=aSkinW;vFace=aFace;vShirt=aShirt;vBP=aBP;vBN=aBN;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uSkin;uniform float uTexL;uniform sampler2D uFaceT;uniform float uHasF;varying vec3 vCloth;varying float vSkinW;varying vec3 vFace;uniform sampler2D uPat;uniform float uHasPat;varying float vShirt;varying vec3 vBP;varying vec3 vBN;').replace('#include <map_fragment>','#include <map_fragment>\n float tl=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));float shd=clamp(tl/uTexL,.62,1.15);vec3 sk=uSkin*shd;\n if(uHasF>.5&&vFace.z>.002){vec3 ph=pow(texture2D(uFaceT,vFace.xy).rgb,vec3(2.2))*1.12;sk=mix(sk,ph,clamp(vFace.z,0.,1.));}\n float kn=fract(sin(dot(floor(vUv*vec2(700.,700.)),vec2(12.9898,78.233)))*43758.5453);vec3 cl=vCloth*mix(1.,shd,.08)*(.965+.05*kn);if(uHasPat>.5&&vShirt>.01){vec3 bw=pow(abs(normalize(vBN)),vec3(4.));bw/=bw.x+bw.y+bw.z+1e-4;vec3 pp=vBP*3.1;vec3 pt=texture2D(uPat,pp.zy).rgb*bw.x+texture2D(uPat,pp.xz).rgb*bw.y+texture2D(uPat,pp.xy).rgb*bw.z;pt=pow(pt,vec3(2.2));cl=mix(cl,pt*(.97+.05*kn),clamp(vShirt,0.,1.));}diffuseColor.rgb=mix(cl,sk,clamp(vSkinW,0.,1.));');};
  mat.customProgramCacheKey=()=>'golfbody';body.material=mat;body.frustumCulled=false;body.castShadow=true;let SHL=false;
  if(T.pro){const src=T.rbMats,skin=new THREE.Color(lk.skin||'#c89170'),base=new THREE.Color(.86,.64,.53),tintS=new THREE.Color(Math.min(1.5,skin.r/base.r),Math.min(1.5,skin.g/base.g),Math.min(1.5,skin.b/base.b));
    const top=new THREE.Color(lk.top&&lk.top.color||'#ffffff'),pants=new THREE.Color(lk.legs&&lk.legs.color||'#2b2f36').multiplyScalar(2.6),capC=new THREE.Color(lk.cap&&lk.cap.color||p.color||'#1f2a44').multiplyScalar(2.4);
    body.material=src.map(m=>{const n=m.clone();n.userData.lin=1;const nm=n.name||'';if(/TSHIRT/.test(nm)){n.color.copy(top);if(lk.top&&lk.top.pat){const pt=hawaiiTex(lk.top.pat,true);pt.repeat.set(3.2,3.2);n.onBeforeCompile=sh=>{sh.uniforms.uPat={value:pt};sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D uPat;').replace('#include <map_fragment>','#include <map_fragment>\n{float l=dot(diffuseColor.rgb,vec3(.3,.59,.11));vec3 pc=texture2D(uPat,vUv*3.2).rgb;pc=pow(pc,vec3(2.2));diffuseColor.rgb=pc*clamp(l*1.25,0.,1.2);}');};const ck2='protshirt_'+p.id;n.customProgramCacheKey=()=>ck2;n.color.setRGB(1,1,1);}}
      else if(/PANT/.test(nm))n.color.copy(pants);else if(/CAP/.test(nm)){n.color.copy(capC);if(!(lk.cap&&lk.cap.style&&lk.cap.style!=='none'))n.visible=false;}else if(/HEAD|ARM/.test(nm)){n.color.copy(tintS);if(/HEAD/.test(nm)){/* the model's scalp/forehead under its cap is left unpainted (white): fill it with the golfer's skin */const sk=skin.clone();
        n.onBeforeCompile=sh=>{sh.uniforms.uSk={value:sk};sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uSk;').replace('#include <map_fragment>','#include <map_fragment>\n{float mn=min(min(texelColor.r,texelColor.g),texelColor.b),mx=max(max(texelColor.r,texelColor.g),texelColor.b);float w=smoothstep(.62,.8,mn)*(1.-smoothstep(.08,.2,mx-mn));diffuseColor.rgb=mix(diffuseColor.rgb,pow(uSk,vec3(2.2))*.92,w);}');};const ckH='proHead_'+p.id;n.customProgramCacheKey=()=>ckH;}}return n;});}
  else if(T.rb){/* Rocketbox: one body+head mesh shaded from its packed texture; the bare feet go (golf shoes replace them) */
    const idx=geo.index.array,foot=v=>T.cls[v]===6&&T.pos[v*3+1]<T.J.shoeY+.03,ni=[];for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],c=idx[t+2];if(foot(a)&&foot(b)&&foot(c))continue;ni.push(a,b,c);}geo.setIndex(ni);}
  else if(!T.pro){try{SHL=dressBody(body,geo,mat,RG,T,T.J,lk);}catch(e){console.warn('garments',e);}}
  /* rig bookkeeping */
  const B={},all=[];body.skeleton.bones.forEach(b=>{B[b.name]=b;all.push(b);b.userData.q0=b.quaternion.clone();b.userData.p0=b.position.clone();b.userData.r0=b.getWorldQuaternion(new THREE.Quaternion());});
  const gpR=nm=>B[nm].getWorldPosition(new THREE.Vector3());
  const R={skel:true,tpl:T,footPitch:(()=>{const o={};for(const s of['l','r']){const f=B['foot_'+s],b=B['ball_'+s];if(!f||!b)continue;const a=f.getWorldPosition(new THREE.Vector3()),c=b.getWorldPosition(new THREE.Vector3()),v=c.sub(a);o[s]=Math.atan2(v.y,Math.hypot(v.x,v.z));}return o;})(),footRestY:B.foot_l?B.foot_l.getWorldPosition(new THREE.Vector3()).y:undefined,pro:!!T.pro,rb:!!T.rb,shl:!!(SHL&&SHL.pants)||!!T.rb,B,all,ballZ:SK.ballZ*(lk.tall||1),pelvisPos:gpR('pelvis'),J_ankY:T.J.ankY,arms:{},legs:{}};g.userData.rig=R;
  for(const s of[1,-1]){const sd=s>0?'l':'r',u=gpR('upperarm_'+sd),l=gpR('lowerarm_'+sd),h=gpR('hand_'+sd),m=gpR('middle_01_'+sd);
    const f0=m.clone().sub(h).normalize(),n0=v3(0,-1,0);n0.addScaledVector(f0,-n0.dot(f0)).normalize();
    const hinge=v3(0,0,0).crossVectors(l.clone().sub(u).normalize(),v3(0,0,1)).normalize();
    const vV=B['thumb_01_'+sd]&&B['index_01_'+sd]?gpR('thumb_01_'+sd).add(gpR('index_01_'+sd)).multiplyScalar(.5):m.clone(),heel0=B['pinky_01_'+sd]?h.clone().lerp(gpR('pinky_01_'+sd),.22):h.clone(),u0=heel0.sub(vV).normalize();
    R.arms[sd]={l1:u.distanceTo(l),l2:l.distanceTo(h),hc:h.distanceTo(m)*.55,f0,n0,u0,hingeL:hinge.applyQuaternion(B['upperarm_'+sd].userData.r0.clone().invert())};
    const t=gpR('thigh_'+sd),c=gpR('calf_'+sd),f=gpR('foot_'+sd);
    const lh=v3(0,0,0).crossVectors(c.clone().sub(t).normalize(),v3(0,0,-1)).normalize();
    R.legs[sd]={l1:t.distanceTo(c),l2:c.distanceTo(f),hingeL:lh.applyQuaternion(B['thigh_'+sd].userData.r0.clone().invert()),ankZ:f.z};
    /* curl the fingers into a grip once, relative to the rest pose */
    for(const fn of['index','middle','ring','pinky','thumb'])for(let j=1;j<=3;j++){const b=B[fn+'_0'+j+'_'+sd];if(!b)continue;const ch=b.children.find(q=>q.isBone);if(!ch)continue;
      const d=ch.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3())).normalize(),ax=v3(0,0,0).crossVectors(d,n0);if(ax.lengthSq()<1e-6)continue;ax.normalize().applyQuaternion(b.userData.r0.clone().invert());
      const ang=fn==='thumb'?.55:[1.35,1.5,1.15][j-1];b.userData.qc=b.userData.q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(ax,ang));}}
  /* cap / hair from the original look, pinned to the head bone */
  const cloth=c=>new THREE.MeshLambertMaterial({color:c}),hair=cloth(lk.hair||'#1b1512');
  const kx=T.halfW*1.04/.104,ky=(T.top-T.eyeY)/.093,kz=(T.zFront-T.zBack)*1.02/2/.114,hd=new THREE.Group();if(!T.pro)headwear(hd,lk,cloth,hair,.112,true);if(lk.cap&&lk.cap.style&&lk.cap.style!=='none')hd.children.forEach(o=>{if(o.material!==hair)o.position.y+=.02;});hd.scale.multiplyScalar(1.1);
  const want=new THREE.Matrix4().compose(v3(0,T.top-.123*ky-.006,(T.zFront+T.zBack)/2),new THREE.Quaternion(),v3(kx*1.05,ky*1.03,kz*1.05));
  const loc=new THREE.Matrix4().copy(B.Head.matrixWorld).invert().multiply(want);loc.decompose(hd.position,hd.quaternion,hd.scale);B.Head.add(hd);
  if(F&&!buildFace3D(p,T,B)){const mpp=2*T.eyeX/66,Sz=256*mpp,pg=new THREE.PlaneGeometry(Sz,Sz,24,24),pp=pg.attributes.position;
    for(let i=0;i<pp.count;i++){const x=pp.getX(i),y=pp.getY(i);pp.setZ(i,-(x*x/(2*.075)+y*y/(2*.2)));}pg.computeVertexNormals();
    if(!window._plateA){window._plateA=new THREE.TextureLoader().load(ASSETS.plateA);}
    const fm=new THREE.MeshLambertMaterial({map:faceTex(p.id),alphaMap:window._plateA,transparent:true,depthWrite:true,alphaTest:.02});fm.map.encoding=THREE.sRGBEncoding;fm.userData.lin=1;
    const capped=!!(lk.cap&&lk.cap.style&&lk.cap.style!=='none');if(T.pro&&(capped?T.brimProf:lk.hairMesh)){const base=T.eyeY-26*mpp,bp=capped?T.brimProf.map(y=>y+.009-base):[0,1,2,3,4,5,6,7,8].map(k=>{const x=-.08+k*.02;return T.eyeY+.085-x*x*3-base;});/* photo stops at the brim, or at the hairline for golfers with hair */fm.onBeforeCompile=sh=>{sh.uniforms.uBrim={value:bp};sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vLP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvLP=position.xy;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uBrim[9];varying vec2 vLP;').replace('#include <alphamap_fragment>','#include <alphamap_fragment>\n{float fx=clamp((vLP.x+.08)/.02,0.,7.999);int k=int(floor(fx));float cut=0.;for(int i=0;i<8;i++){if(i==k)cut=mix(uBrim[i],uBrim[i+1],fx-float(i));}diffuseColor.a*=1.-smoothstep(cut-.006,cut,vLP.y);}');};fm.customProgramCacheKey=()=>'plateBrim';}
    const plate=new THREE.Mesh(pg,fm);plate.renderOrder=2;const want2=new THREE.Matrix4().compose(v3(0,T.eyeY-26*mpp,T.plateZ!=null?T.plateZ:T.noseZ+.006),new THREE.Quaternion(),v3(1,1,1));
    new THREE.Matrix4().copy(B.Head.matrixWorld).invert().multiply(want2).decompose(plate.position,plate.quaternion,plate.scale);B.Head.add(plate);}
  if(T.pro&&lk.hairMesh&&HAIRG[lk.hairMesh]&&!(lk.cap&&lk.cap.style&&lk.cap.style!=='none')&&TPL.M&&T.headNC){const key='pro_'+lk.hairMesh;
    if(!HAIRG[key]){const M=TPL.M,P=T.headNC,g2=HAIRG[lk.hairMesh].clone(),pa=g2.attributes.position,mz=(M.zFront+M.zBack)/2,pz=(P.zF+P.zB)/2,sx=P.halfW/M.halfW,sy=(P.top-P.eyeY)/(M.top-M.eyeY),sz=(P.zF-P.zB)/(M.zFront-M.zBack);
      for(let i=0;i<pa.count;i++){const zz=pz+(pa.getZ(i)-mz)*sz*1.05;pa.setXYZ(i,pa.getX(i)*sx*1.05,P.eyeY+(pa.getY(i)-M.eyeY)*sy*1.03-.02,zz+(zz>pz?.004:0));}g2.computeVertexNormals();g2.computeBoundingSphere();HAIRG[key]=g2;}
    const hm=new THREE.Mesh(HAIRG[key],hairMat(lk.hair||'#1b1512',false));hm.castShadow=true;attachRest(hm,B.Head,v3(0,0,0));}
  if(lk.hairMesh&&HAIRG[lk.hairMesh]&&!T.rb&&!T.pro){const hm=new THREE.Mesh(HAIRG[lk.hairMesh],hairMat(lk.hair||'#1b1512',FEMALE.has(p.id)));hm.castShadow=true;attachRest(hm,B.Head,v3(0,0,0));}
  if(!T.pro){try{buildAttire(p,lk,T,B,g,R);}catch(e){console.warn('attire',e);}}
  try{const bag=makeBag(p);bag.position.set(1.25,0,2.55);bag.rotation.y=-Math.PI/2;g.add(bag);g.userData.bag=bag;}catch(e){console.warn('bag',e);}
  R.clubs=makeClubs();for(const kk in R.clubs)g.add(R.clubs[kk]);
  g.scale.setScalar(lk.tall||1);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});applyPose(g,swingPose('addr',0,0,false),'iron');return g;}
const _Y=v3(0,1,0),_X=v3(1,0,0),_gq=new THREE.Quaternion(),_tq=new THREE.Quaternion(),_tv=new THREE.Vector3();
function applyPoseSkel(g,S,type){const R=g.userData.rig,B=R.B;
  for(const b of R.all){b.quaternion.copy(b.userData.qc||b.userData.q0);b.position.copy(b.userData.p0);}
  g.updateMatrixWorld(true);const gInv=g.getWorldQuaternion(new THREE.Quaternion()).invert();
  const rel=b=>gInv.clone().multiply(b.getWorldQuaternion(_tq));
  const setRel=(b,q)=>{b.quaternion.copy(rel(b.parent).invert().multiply(q));b.updateMatrixWorld(true);};
  const gp=b=>g.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
  const Ry=a=>new THREE.Quaternion().setFromAxisAngle(_Y,a),Rx=a=>new THREE.Quaternion().setFromAxisAngle(_X,a);
  const aim=(b,ch,tgt)=>{const o=gp(b),cur=gp(ch).sub(o).normalize(),des=tgt.clone().sub(o).normalize();setRel(b,new THREE.Quaternion().setFromUnitVectors(cur,des).multiply(rel(b)));};
  const twist=(b,hingeL,want)=>{if(want.lengthSq()<1e-6)return;const ax=gp(b.children.find(q=>q.isBone)).sub(gp(b)).normalize(),cur=hingeL.clone().applyQuaternion(rel(b));
    cur.addScaledVector(ax,-cur.dot(ax));const w=want.clone().normalize();w.addScaledVector(ax,-w.dot(ax));if(cur.lengthSq()<1e-6||w.lengthSq()<1e-6)return;cur.normalize();w.normalize();
    const a=Math.atan2(v3(0,0,0).crossVectors(cur,w).dot(ax),cur.dot(w));setRel(b,new THREE.Quaternion().setFromAxisAngle(ax,a).multiply(rel(b)));};
  const bend=SK.bend*(1-.62*(S.fin||0)),qH=Ry(-S.hip),tw=-(S.sh-S.hip),tiltT=SK.tilt+(S.tilt||0),Rz=a=>new THREE.Quaternion().setFromAxisAngle(v3(0,0,1),a);
  setRel(B.pelvis,qH.clone().multiply(B.pelvis.userData.r0));
  B.pelvis.position.copy(B.pelvis.parent.worldToLocal(g.localToWorld(R.pelvisPos.clone().add(v3(S.shift,-SK.drop*(1-.55*(S.post||0))-.02*(S.kick||0)-.012*S.heel,0)))));B.pelvis.updateMatrixWorld(true);
  [['spine_01',.35,.3],['spine_02',.7,.65],['spine_03',1,1]].forEach(([nm,fb,ft])=>setRel(B[nm],qH.clone().multiply(Rz(tiltT*fb)).multiply(Rx(bend*fb)).multiply(Ry(tw*ft)).multiply(B[nm].userData.r0)));
  const hy=S.hip*.95+(S.sh-S.hip)*.12+S.look*1.15,hx=(.4-bend)+(S.fin||0)*.08-S.look*.45,hq=Ry(hy).multiply(Rx(hx)),base=qH.clone().multiply(Rx(bend));
  setRel(B.neck_01,base.clone().multiply(new THREE.Quaternion().slerp(hq,.45)).multiply(B.neck_01.userData.r0));
  setRel(B.Head,base.clone().multiply(hq).multiply(B.Head.userData.r0));
  /* club on the swing plane (same plane as before, stance fitted to this body) */
  const Lc=CLUB_LEN[type],U=SW_U,E=SW_E,SB=v3(0,.02,SK.ballZ),C=SB.clone().addScaledVector(U,Lc+SK.swR);
  const H=C.clone().addScaledVector(U,-Math.cos(S.th)*SK.swR).addScaledVector(E,-Math.sin(S.th)*SK.swR);
  const ph=S.th+S.hg,sdir=U.clone().multiplyScalar(-Math.cos(ph)).addScaledVector(E,-Math.sin(ph));
  const xa=E.clone().multiplyScalar(Math.cos(ph)).addScaledVector(U,-Math.sin(ph)).normalize(),ya=sdir.clone().negate(),za=v3(0,0,0).crossVectors(xa,ya).normalize();xa.crossVectors(ya,za).normalize();
  _m4.makeBasis(xa,ya,za);let cgV=null;for(const kk in R.clubs){const cg=R.clubs[kk];cg.visible=kk===type;cg.position.copy(H);cg.quaternion.setFromRotationMatrix(_m4);if(kk===type)cgV=cg;}
  /* arms: IK to the grip, then twist so the elbows hinge the right way, then set each hand on the shaft */
  let shift=v3(0,0,0);
  [['l',1,0],['r',-1,.085]].forEach(([sd,s,off])=>{const A=R.arms[sd],up=B['upperarm_'+sd],lo=B['lowerarm_'+sd],ha=B['hand_'+sd];
    const f1=sdir.clone(),n1=(s>0?xa.clone().negate():xa.clone());const grip=H.clone().addScaledVector(sdir,off).add(shift);
    const tgt=grip.clone().addScaledVector(n1,-.03).addScaledVector(f1,-A.hc);const sh=gp(up);
    const el=ik(sh,tgt,A.l1,A.l2,sh.clone().add(v3(s*.45,-1,-.55)));
    aim(up,lo,el);twist(up,A.hingeL,v3(0,0,0).crossVectors(el.clone().sub(sh),tgt.clone().sub(el)));aim(lo,ha,tgt);
    const b0=new THREE.Matrix4().makeBasis(A.f0,A.n0,v3(0,0,0).crossVectors(A.f0,A.n0)),z1=v3(0,0,0).crossVectors(f1,n1).normalize(),nn=v3(0,0,0).crossVectors(z1,f1),b1=new THREE.Matrix4().makeBasis(f1,nn,z1);
    const qa=new THREE.Quaternion().setFromRotationMatrix(b1.multiply(b0.transpose()));
    /* split the hand roll with the forearm so the wrist doesn't candy-wrap */
    const want=qa.clone().multiply(ha.userData.r0),cur=rel(ha),d=want.clone().multiply(cur.clone().invert()),fa=gp(ha).sub(gp(lo)).normalize();
    const tw2=2*Math.atan2(v3(d.x,d.y,d.z).dot(fa),d.w);setRel(lo,new THREE.Quaternion().setFromAxisAngle(fa,tw2*.5).multiply(rel(lo)));setRel(ha,want);
    if(s>0){const got=gp(ha);shift=got.sub(tgt);if(cgV)cgV.position.add(shift);}});
  /* legs: planted feet, trail heel releases in the finish */
  [['l',1],['r',-1]].forEach(([sd,s])=>{const Lg=R.legs[sd],th=B['thigh_'+sd],ca=B['calf_'+sd],ft=B['foot_'+sd],ba=B['ball_'+sd];const hip=gp(th),he=s<0?S.heel:0;
    const ank=v3(s*SK.stance+(s<0?.07*he:0),R.J_ankY+.09*he,Lg.ankZ-.03*he);
    const kn=ik(hip,ank,Lg.l1,Lg.l2,hip.clone().add(v3(s*.25-(s>0?.6*(S.kick||0):0)+(s<0?.55*he:0),-.3,1)));aim(th,ca,kn);twist(th,Lg.hingeL,v3(0,0,0).crossVectors(kn.clone().sub(hip),ank.clone().sub(kn)));aim(ca,ft,ank);
    const yaw=s*.18+(s<0?-he*.5:0);setRel(ft,Ry(yaw).multiply(Rx(he*.85)).multiply(ft.userData.r0));setRel(ba,Ry(yaw).multiply(Rx(he*.1)).multiply(ba.userData.r0));});
  if(R.pants)for(const P of R.pants){const hip=gp(B['thigh_'+P.sd]),kn=gp(B['calf_'+P.sd]);if(P.shorts){placeSeg(P.th,hip.clone().add(v3(0,.03,0)),hip.clone().lerp(kn,.6));}else{const an=gp(B['foot_'+P.sd]);placeSeg(P.th,hip.clone().add(v3(0,.03,0)),kn);P.kn.position.copy(kn);placeSeg(P.sn,kn,an.clone().add(v3(0,.03,0)));}}}


/* ---------- motion-captured swings (Mixamo), retargeted onto each golfer's skeleton ---------- */
const ANIM=window.ANIMS&&window.ANIMS.clips?window.ANIMS:null;
function animClip(type){if(type==='putter')return'putt';if(type==='wedge')return'pitch';return'drive';}
function relQ(g,b){return g.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(b.getWorldQuaternion(new THREE.Quaternion()));}
function gpG(g,b){return g.worldToLocal(b.getWorldPosition(new THREE.Vector3()));}
function animReset(g){const R=g.userData.rig;for(const b of R.all){b.quaternion.copy(b.userData.qc||b.userData.q0);b.position.copy(b.userData.p0);}g.updateMatrixWorld(true);}
function animSetup(g){const R=g.userData.rig;if(R.anim)return R.anim;const B=R.B;animReset(g);const A={},restQ={};
  for(const n of ANIM.bones.concat(ANIM.fingers)){const b=B[n];if(!b)continue;restQ[n]=relQ(g,b);const c=ANIM.child[n],a=new THREE.Quaternion();
    if(c&&B[c]&&ANIM.rest[c]&&ANIM.rest[n]){const dt=gpG(g,B[c]).sub(gpG(g,b)).normalize(),s0=ANIM.rest[n],s1=ANIM.rest[c],ds=new THREE.Vector3(s1[0]-s0[0],s1[1]-s0[1],s1[2]-s0[2]).normalize();a.setFromUnitVectors(dt,ds);}A[n]=a;}
  R.anim={A,restQ,k:gpG(g,B.pelvis).y/ANIM.hipH,pelvis0:gpG(g,B.pelvis),cal:{},gnd:{}};return R.anim;}
const _aq1=new THREE.Quaternion(),_aq2=new THREE.Quaternion(),_aq3=new THREE.Quaternion();
function clipQ(C,bi,f,out){const n=ANIM.bones.length,f0=Math.max(0,Math.min(C.n-1,Math.floor(f))),f1=Math.min(C.n-1,f0+1),u=Math.max(0,Math.min(1,f-f0)),o0=(f0*n+bi)*4,o1=(f1*n+bi)*4;
  _aq1.set(C.E[o0],C.E[o0+1],C.E[o0+2],C.E[o0+3]);_aq2.set(C.E[o1],C.E[o1+1],C.E[o1+2],C.E[o1+3]);return out.copy(_aq1).slerp(_aq2,u);}
function clipP(C,f,out){const f0=Math.max(0,Math.min(C.n-1,Math.floor(f))),f1=Math.min(C.n-1,f0+1),u=Math.max(0,Math.min(1,f-f0));return out.set(C.P[f0*3]*(1-u)+C.P[f1*3]*u,C.P[f0*3+1]*(1-u)+C.P[f1*3+1]*u,C.P[f0*3+2]*(1-u)+C.P[f1*3+2]*u);}
function animApply(g,ck,f,f2,w,ctype){const R=g.userData.rig,B=R.B,An=animSetup(g),C=ANIM.clips[ck];animReset(g);
  const gInv=g.getWorldQuaternion(new THREE.Quaternion()).invert(),rel=b=>gInv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
  const setRel=(b,q)=>{b.quaternion.copy(rel(b.parent).invert().multiply(q));b.updateMatrixWorld(true);};
  const dp=clipP(C,f,new THREE.Vector3());if(f2!==undefined&&w>0)dp.lerp(clipP(C,f2,new THREE.Vector3()),w);
  const pp=An.pelvis0.clone().addScaledVector(dp,An.k);pp.y+=An.gnd[ck]||0;B.pelvis.position.copy(B.pelvis.parent.worldToLocal(g.localToWorld(pp)));B.pelvis.updateMatrixWorld(true);
  const q=new THREE.Quaternion();
  ANIM.bones.forEach((n,i)=>{const b=B[n];if(!b)return;clipQ(C,i,f,q);if(f2!==undefined&&w>0){clipQ(C,i,f2,_aq3);q.slerp(_aq3,w);}setRel(b,q.clone().multiply(An.A[n]).multiply(An.restQ[n]));});
  if(!R.pro)ANIM.fingers.forEach((n,i)=>{const b=B[n];if(!b)return;const o=i*4;q.set(C.FG[o],C.FG[o+1],C.FG[o+2],C.FG[o+3]);setRel(b,q.clone().multiply(An.A[n]).multiply(An.restQ[n]));});  /* the pro body keeps its own fist-around-the-grip finger curl */
  const bd=ctype&&An.bend?An.bend[ck+':'+ctype]:0;if(bd)setRel(B.spine_01,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),bd).multiply(rel(B.spine_01)));}
function soleH(g){const R=g.userData.rig;if(R.soleH!==undefined)return R.soleH;const T=R.tpl;let mn=1e9;if(T&&T.cls){for(let v=0;v<T.cls.length;v++)if(T.cls[v]===6&&T.pos[v*3+1]<mn)mn=T.pos[v*3+1];}
  const fy=R.footRestY!==undefined?R.footRestY:R.J_ankY;R.soleH=mn<1e8?Math.max(.03,fy-mn):R.J_ankY;return R.soleH;}
function animGround(g,ck){const An=animSetup(g),R=g.userData.rig,B=R.B;if(An.gnd[ck]!==undefined)return;An.gnd[ck]=0;const C=ANIM.clips[ck];animApply(g,ck,ck==='putt'?C.keys.imp:C.keys.addr);R.calib=0;flatFeet(g,1);
  An.gnd[ck]=soleH(g)-Math.min(gpG(g,B.foot_l).y,gpG(g,B.foot_r).y);}
function gripPt(g,s){const B=g.userData.rig.B;return gpG(g,B['hand_'+s]).lerp(gpG(g,B['middle_01_'+s]),.8);}
function clubFaceBall(g,cg,faceH){/* ball centre = middle of the head, pushed out to the leading edge of the face along the swing direction */
  const hg=cg.userData.hb||cg.userData.hg||cg,v=new THREE.Vector3();let mx=-1e9,sx=0,sy=0,sz=0,n=0;cg.updateMatrixWorld(true);
  hg.traverse(o=>{if(!o.isMesh||!o.geometry||!o.geometry.attributes.position)return;const P=o.geometry.attributes.position;for(let i=0;i<P.count;i+=Math.max(1,Math.floor(P.count/400))){v.fromBufferAttribute(P,i).applyMatrix4(o.matrixWorld);g.worldToLocal(v);const d=v.x*faceH.x+v.z*faceH.z;if(d>mx)mx=d;sx+=v.x;sy+=v.y;sz+=v.z;n++;}});
  if(!n)return null;const cx=sx/n,cz=sz/n,cd=cx*faceH.x+cz*faceH.z,push=mx-cd+.0214;return{bx:cx+faceH.x*push,bz:cz+faceH.z*push};}
function animCal(g,ck,type){const An=animSetup(g),key=ck+':'+type;if(An.cal[key])return An.cal[key];animGround(g,ck);const C=ANIM.clips[ck],B=g.userData.rig.B;
  if(type!=='putter'){const L0=CLUB_LEN[type],tgtY=.95*L0;An.bend=An.bend||{};An.bend[key]=0;animApply(g,ck,C.keys.imp,undefined,0,type);if(gripPt(g,'l').y>tgtY){let lo=0,hi=.16;for(let k=0;k<14;k++){const m=(lo+hi)/2;An.bend[key]=m;animApply(g,ck,C.keys.imp,undefined,0,type);if(gripPt(g,'l').y>tgtY)lo=m;else hi=m;}An.bend[key]=hi;}
    animApply(g,ck,C.keys.imp,undefined,0,type);const lg0=gripPt(g,'l'),L=Math.max(CLUB_LEN[type],(lg0.y-.012)/.93),lg=lg0,tY=type==='driver'?.034:type==='wood'?.016:.012,lean=type==='driver'?.0:type==='wood'?-.02:type==='wedge'?-.06:-.05,dy=lg.y-tY,hz=Math.sqrt(Math.max(.01,L*L-dy*dy-lean*lean));
    const head=new THREE.Vector3(lg.x+lean,tY,lg.z+hz),d1=head.clone().sub(lg).normalize(),face=new THREE.Vector3(1,0,0);face.addScaledVector(d1,-face.dot(d1)).normalize();
    const iq=relQ(g,B.hand_l).invert(),cal={dL:d1.clone().applyQuaternion(iq),fL:face.clone().applyQuaternion(iq),bx:head.x+.03,bz:head.z+.045,lie:Math.PI/2-Math.atan2(dy,Math.hypot(hz,lean)),len:L};An.cal[key]=cal;
    const cg=g.userData.rig.clubs[type];if(cg&&cg.userData.hb){cg.userData.hb.rotation.x=cal.lie;g.userData.rig.calib=1;animClub(g,ck,type);g.userData.rig.calib=0;const fb=clubFaceBall(g,cg,new THREE.Vector3(1,0,0));if(fb){cal.bx=fb.bx;cal.bz=fb.bz;}}
    return cal;}
  if(type==='putter'){animApply(g,ck,C.keys.imp);const L=CLUB_LEN.putter,lg=gripPt(g,'l'),tY=.012,dy=lg.y-tY,hz=Math.sqrt(Math.max(.01,L*L-dy*dy-.0004));const head=new THREE.Vector3(lg.x+.02,tY,lg.z+hz),d1=head.clone().sub(lg).normalize(),face=new THREE.Vector3(1,0,0);face.addScaledVector(d1,-face.dot(d1)).normalize();
    const iq=relQ(g,B.hand_l).invert(),cal={dL:d1.clone().applyQuaternion(iq),fL:face.clone().applyQuaternion(iq),bx:head.x+.039,bz:head.z+.047,lie:Math.PI/2-Math.atan2(dy,hz)};An.cal[key]=cal;const pc=g.userData.rig.clubs.putter;if(pc&&pc.userData.hb){pc.userData.hb.rotation.x=cal.lie;fitPutterNeck(pc.userData.hb);
    /* put the ball where the face actually is at impact: pose the club and measure the face centre */
    g.userData.rig.calib=1;animClub(g,ck,'putter');g.userData.rig.calib=0;pc.updateMatrixWorld(true);const fp=g.worldToLocal(pc.userData.hb.localToWorld(new THREE.Vector3(.0175+.0214,.013,.049)));cal.bx=fp.x;cal.bz=fp.z;}return cal;}
  animApply(g,ck,C.keys.imp);const L=CLUB_LEN[type],lg=gripPt(g,'l'),tg=gripPt(g,'r');let d0=tg.clone().sub(lg);if(d0.lengthSq()<1e-6)d0.set(0,-1,.3);d0.normalize();
  const face=new THREE.Vector3(1,0,0);face.addScaledVector(d0,-face.dot(d0)).normalize();const tY=type==='driver'?.035:.012,hy=th=>lg.y+d0.clone().applyAxisAngle(face,th).y*L;
  let best=0,bd=1e9;for(let k=0;k<=120;k++){const th=(k%2?1:-1)*Math.ceil(k/2)*.01,e=Math.abs(hy(th)-tY);if(e<.006){best=th;bd=e;break;}if(e<bd){bd=e;best=th;}}
  const d1=d0.clone().applyAxisAngle(face,best),iq=relQ(g,B.hand_l).invert(),head=lg.clone().addScaledVector(d1,L);
  const cal={dL:d1.clone().applyQuaternion(iq),fL:face.clone().applyQuaternion(iq),bx:head.x+face.x*.028,bz:head.z+face.z*.028};An.cal[key]=cal;return cal;}
function animClub(g,ck,type,wA){const R=g.userData.rig,cal=animCal(g,ck,type),hq=relQ(g,R.B.hand_l),grip=gripPt(g,'l');
  const sh=cal.dL.clone().applyQuaternion(hq).normalize(),fc=cal.fL.clone().applyQuaternion(hq);
  /* at address the club is soled right behind the ball, square to the target; it hands over to the captured hands during the takeaway */
  if(wA>0&&!R.calib){const tgt=new THREE.Vector3(cal.bx-.034,type==='driver'?.034:.013,cal.bz-.047);g.updateMatrixWorld(true);{const bw=g.localToWorld(new THREE.Vector3(cal.bx,0,cal.bz));tgt.y+=(H(bw.x,-bw.z)-g.position.y)/(g.scale.y||1);}const L0=cal.len||CLUB_LEN[type]||1,Lt=Math.max(L0*.85,Math.min(L0*1.15,tgt.distanceTo(grip)));R._lenA=L0+(Lt-L0)*wA;const dA=tgt.sub(grip).normalize();sh.lerp(dA,wA).normalize();fc.lerp(new THREE.Vector3(1,0,0),wA);}
  if(!(wA>0)||R.calib)R._lenA=0;let xa=fc.clone().addScaledVector(sh,-fc.dot(sh)).normalize();
  if(!R.calib){const L=R._lenA||cal.len||CLUB_LEN[type]||1,head=grip.clone().addScaledVector(sh,L);g.updateMatrixWorld(true);const hw=g.localToWorld(head.clone()),gy=(H(hw.x,-hw.z)-g.position.y)/(g.scale.y||1)+(type==='putter'?.004:.01);
    if(head.y<gy){const c=new THREE.Vector3().crossVectors(xa,sh),k=(gy-grip.y)/L,Rr=Math.hypot(sh.y,c.y);if(Rr>1e-4&&Math.abs(k)<=Rr){const ph=Math.atan2(c.y,sh.y),ac=Math.acos(k/Rr),t1=ph+ac,t2=ph-ac,th=Math.abs(t1)<Math.abs(t2)?t1:t2;sh.multiplyScalar(Math.cos(th)).addScaledVector(c,Math.sin(th)).normalize();xa=fc.clone().addScaledVector(sh,-fc.dot(sh)).normalize();}}}
  const ya=sh.clone().negate(),za=new THREE.Vector3().crossVectors(xa,ya).normalize();xa.crossVectors(ya,za).normalize();{const cgs=R.clubs[type],Lu=R._lenA||cal.len;if(cgs&&Lu)cgs.scale.set(1,Lu/(CLUB_LEN[type]||Lu),1);}
  _m4.makeBasis(xa,ya,za);for(const kk in R.clubs){const cg=R.clubs[kk];cg.visible=kk===type;if(kk===type){cg.position.copy(grip);cg.quaternion.setFromRotationMatrix(_m4);}}}

function setRelG(g,b,q){const gi=g.getWorldQuaternion(new THREE.Quaternion()).invert(),pr=gi.multiply(b.parent.getWorldQuaternion(new THREE.Quaternion()));b.quaternion.copy(pr.invert().multiply(q));b.updateMatrixWorld(true);}
function headLift(g,w){if(w<=.01)return;const R=g.userData.rig,B=R.B,An=R.anim;if(!B.Head||!B.neck_01||!An.restQ.Head)return;
  const hq=relQ(g,B.Head),face=new THREE.Vector3(0,0,1).applyQuaternion(hq.clone().multiply(An.restQ.Head.clone().invert())).normalize(),want=new THREE.Vector3(.5,.14,.86).normalize();
  const full=new THREE.Quaternion().setFromUnitVectors(face,want),part=new THREE.Quaternion().slerp(full,w),nq=relQ(g,B.neck_01);
  setRelG(g,B.neck_01,new THREE.Quaternion().slerp(part,.45).multiply(nq));setRelG(g,B.Head,part.clone().multiply(hq));}

/* golf grip: the trail hand is placed on the shaft just below the lead hand, palm facing the lead palm (overlap-style), every frame of the swing */
const LEAD_COCK=-.3;/* ~10 degrees more lead-wrist cock at address */
function gripFix(g,type){/* golf grip: in each hand the shaft runs from the "V" between thumb and index finger back out under the heel of the palm;
  lead palm faces away from the target, trail palm faces the target, and the trail hand sits just below the lead hand, its palm covering the lead thumb */
  const R=g.userData.rig,B=R.B,cg=R.clubs&&R.clubs[type];if(!cg||!cg.visible||!B.hand_r||!B.hand_l||typeof armTo!=='function'||!R.arms)return;
  const q=cg.quaternion,xa=new THREE.Vector3(1,0,0).applyQuaternion(q),ya=new THREE.Vector3(0,1,0).applyQuaternion(q);const put=type==='putter';
  const handQ=(s,n)=>{const A=R.arms[s],hb=B['hand_'+s];if(!A||!A.u0||!hb.userData.r0)return relQ(g,hb);const u=ya.clone();if(s==='l'){const ck=LEAD_COCK;if(ck)u.applyAxisAngle(n.clone().normalize(),ck);}const _u=u,nn=n.clone().addScaledVector(u,-n.dot(u)).normalize(),u0=A.u0.clone().normalize(),n0=A.n0.clone().addScaledVector(u0,-A.n0.dot(u0)).normalize();
    const Mt=new THREE.Matrix4().makeBasis(u,nn,new THREE.Vector3().crossVectors(u,nn)),M0=new THREE.Matrix4().makeBasis(u0,n0,new THREE.Vector3().crossVectors(u0,n0));
    return new THREE.Quaternion().setFromRotationMatrix(Mt).multiply(new THREE.Quaternion().setFromRotationMatrix(M0).invert()).multiply(hb.userData.r0);};
  const lineP=s=>{const hb=B['hand_'+s],t=B['thumb_01_'+s],ix=B['index_01_'+s],pk=B['pinky_01_'+s];if(!t||!ix)return gripPt(g,s);const w=gpG(g,hb),heel=pk?w.clone().lerp(gpG(g,pk),.22):w;return gpG(g,t).add(gpG(g,ix)).multiplyScalar(.5).add(heel).multiplyScalar(.5);};
  const place=(s,pt0,n,pole)=>{const hb=B['hand_'+s],cl=B['clavicle_'+s],pt=pt0.clone().addScaledVector(n,-.03);/* the grip sits in the palm, so the hand's bone line is half a hand behind the shaft */
    const reach=()=>{const S0=gpG(g,B['upperarm_'+s]),E0=gpG(g,B['lowerarm_'+s]),H0=gpG(g,hb);return{S0,short:S0.distanceTo(pt)-(S0.distanceTo(E0)+E0.distanceTo(H0)+lineP(s).distanceTo(H0)*.9)*.985};};
    if(cl){for(let it=0;it<2;it++){const r=reach();if(r.short<=0)break;const C=gpG(g,cl),v1=r.S0.clone().sub(C),L=v1.length();v1.normalize();const v2=pt.clone().sub(C).normalize(),tot=v1.angleTo(v2);if(tot<1e-3)break;
      const ang=Math.min(.55,tot,r.short/L*1.15);setRelG(g,cl,new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(v1,v2),ang/tot).multiply(relQ(g,cl)));}}
    for(let it=0;it<3;it++){setRelG(g,hb,handQ(s,n));const wr=gpG(g,hb),off=lineP(s).sub(wr),W=pt.clone().sub(off),hd=gpG(g,B['middle_01_'+s]).sub(wr).normalize(),l2=gpG(g,B['lowerarm_'+s]).distanceTo(wr);
      const pl=W.clone().addScaledVector(hd,-l2).add(new THREE.Vector3(0,-.08,0)).lerp(pole,R._gp!==undefined?R._gp:.6);armTo(g,s,W,pl);}setRelG(g,hb,handQ(s,n));};
  const top=cg.position.clone(),low=top.clone().addScaledVector(ya,put?-.075:-.062);
  const both=(tp,lw)=>{place('l',tp,xa.clone().negate(),(B.thigh_l?gpG(g,B.thigh_l):gpG(g,B.pelvis)).add(new THREE.Vector3(.05,-.15,.12)));
    place('r',lw,xa.clone(),(B.thigh_r?gpG(g,B.thigh_r):gpG(g,B.pelvis)).add(new THREE.Vector3(-.05,-.15,.12)));};
  both(top,low);
  /* if the trail hand fell short of its spot (arms fully extended through the finish), slide the club toward it and set both hands again, so the order on the grip never flips */
  {const pr=lineP('r').addScaledVector(xa,-.03),miss=pr.clone().sub(low);miss.addScaledVector(ya,0);if(miss.length()>.015){const mv=miss.clone();if(mv.length()>.16)mv.setLength(.16);cg.position.add(mv);top.add(mv);low.add(mv);both(top,low);}}
  /* thumbs sit on the grip pointing down the shaft (lead thumb under the trail palm, trail thumb just left of centre), each joint curled onto the grip */
  for(const [s,n] of [['l',xa.clone().negate()],['r',xa.clone()]]){const t1=B['thumb_01_'+s],t2=B['thumb_02_'+s],t3=B['thumb_03_'+s];if(!t1||!t2||!t3||typeof aimBoneG!=='function')continue;
    const p1=gpG(g,t1),l1=p1.distanceTo(gpG(g,t2)),d1=ya.clone().multiplyScalar(-.95).addScaledVector(n,.16).normalize();aimBoneG(g,t1,t2,p1.clone().addScaledVector(d1,l1));
    const p2=gpG(g,t2),l2=p2.distanceTo(gpG(g,t3)),d2=ya.clone().multiplyScalar(-.8).addScaledVector(n,.42).normalize();aimBoneG(g,t2,t3,p2.clone().addScaledVector(d2,l2));}}
function animAddr(g,ck,type){const An=animSetup(g),key='A:'+ck+':'+type;if(An.cal[key]!==undefined)return An.cal[key];const C=ANIM.clips[ck],K=C.keys,cal=animCal(g,ck,type),R=g.userData.rig,cg=R.clubs[type];
  if(!cg){An.cal[key]=ck==='putt'?K.imp:K.addr;return An.cal[key];}const tgt=new THREE.Vector3(cal.bx,type==='driver'?.034:.012,cal.bz),end=ck==='putt'?K.imp:K.addr+(K.top-K.addr)*.35;let best=K.addr,bd=1e9;R.calib=1;
  for(let f=Math.max(0,K.addr-2);f<=end;f+=1){animApply(g,ck,f,undefined,0,type);animClub(g,ck,type);cg.updateMatrixWorld(true);const hd=g.worldToLocal(cg.localToWorld(new THREE.Vector3(0,-(cg.userData.L||1),0)));
    const face=new THREE.Vector3(1,0,0),d=Math.hypot(hd.x+.03-tgt.x,hd.z+.045-tgt.z)+Math.abs(hd.y-tgt.y)*.5;if(d<bd){bd=d;best=f;}}
  R.calib=0;An.cal[key]=best;return best;}


function flatFeet(g,w){const R=g.userData.rig,B=R.B;if(!(w>0))return;for(const s of['l','r']){const ft=B['foot_'+s],bl=B['ball_'+s];if(!ft||!bl)continue;const a=gpG(g,ft),b=gpG(g,bl),v=b.clone().sub(a),hz=Math.hypot(v.x,v.z);if(hz<1e-4)continue;const pr=(R.footPitch&&R.footPitch[s])||0,hd=new THREE.Vector3(v.x,0,v.z).normalize();
    const want=hd.multiplyScalar(Math.cos(pr)).add(new THREE.Vector3(0,Math.sin(pr),0)),q=new THREE.Quaternion().setFromUnitVectors(v.clone().normalize(),want.normalize());const full=q,part=new THREE.Quaternion().slerp(full,w);setRelG(g,ft,part.multiply(relQ(g,ft)));}}
/* trail hand shaped onto the grip: hand continues the forearm (bent slightly toward the shaft), palm facing the target like the clubface */
function trailHandQ(g,cg){const R=g.userData.rig,B=R.B,AL=R.arms&&R.arms.l,AR=R.arms&&R.arms.r;if(!AL||!AR||!B.hand_r.userData.r0||!B.hand_l.userData.r0)return relQ(g,B.hand_r);
  const xa=new THREE.Vector3(1,0,0).applyQuaternion(cg.quaternion).normalize(),mir=v=>v.clone().addScaledVector(xa,-2*v.dot(xa));
  const dl=relQ(g,B.hand_l).multiply(B.hand_l.userData.r0.clone().invert()),fl=AL.f0.clone().applyQuaternion(dl).normalize(),nl=AL.n0.clone().applyQuaternion(dl).normalize();
  let f=mir(fl).normalize(),n=mir(nl);n.addScaledVector(f,-n.dot(f)).normalize();
  const f0=AR.f0.clone().normalize(),n0=AR.n0.clone().addScaledVector(f0,-AR.n0.dot(f0)).normalize();
  const Mt=new THREE.Matrix4().makeBasis(f,n,new THREE.Vector3().crossVectors(f,n)),M0=new THREE.Matrix4().makeBasis(f0,n0,new THREE.Vector3().crossVectors(f0,n0));
  return new THREE.Quaternion().setFromRotationMatrix(Mt).multiply(new THREE.Quaternion().setFromRotationMatrix(M0).invert()).multiply(B.hand_r.userData.r0);}
function feetToGround(g){const R=g.userData.rig,B=R.B;if(!B.thigh_l||!B.calf_l||!B.foot_l)return;const sc=g.scale.y||1;g.updateMatrixWorld(true);
  for(const s of['l','r']){const th=B['thigh_'+s],ca=B['calf_'+s],ft=B['foot_'+s],fq=relQ(g,ft),a=gpG(g,ft),w=g.localToWorld(a.clone()),d=(H(w.x,-w.z)-g.position.y)/sc,gy=a.y+d;
    if(Math.abs(d)<.004||Math.abs(d)>.25)continue;const S0=gpG(g,th),E0=gpG(g,ca),l1=S0.distanceTo(E0),l2=E0.distanceTo(a),T=a.clone();T.y=gy;const v=T.clone().sub(S0),D=Math.min(v.length(),l1+l2-.002);v.setLength(D);
    const dn=v.clone().normalize(),aa=(l1*l1-l2*l2+D*D)/(2*D),hh=Math.sqrt(Math.max(0,l1*l1-aa*aa)),pole=E0.clone().add(new THREE.Vector3(0,0,.4)).sub(S0);pole.addScaledVector(dn,-pole.dot(dn)).normalize();
    const E=S0.clone().addScaledVector(dn,aa).addScaledVector(pole,hh);aimBoneG(g,th,ca,E);aimBoneG(g,ca,ft,S0.clone().add(v));setRelG(g,ft,fq);}}
function animPose(g,S,type){if(!ANIM||!S||!S._ph)return false;const ck=animClip(type),C=ANIM.clips[ck];if(!C)return false;
  try{animSetup(g);animGround(g,ck);animCal(g,ck,type);const K=C.keys,p=Math.max(0,Math.min(1,S._pw||0)),ph=S._ph,u=S._u||0,A0=animAddr(g,ck,type);let f=A0,f2,w=0;
    if(ph==='back')f=A0+(K.top-A0)*p;
    else if(ph==='down'){const uu=Math.min(1,u);f=K.top+(K.imp-K.top)*uu;if(p<.98){f2=A0+(K.top-A0)*p;w=1-Math.min(1,uu/.5);w*=w;}}
    else if(ph==='thru'){f=u<=1?K.imp+(K.fin-K.imp)*u:Math.min(K.end,K.fin+(u-1)*(K.fin-K.imp)*.5);}
    g.userData.rig._gp=(ph==='addr'||ph==='back')?.6:ph==='down'?.6-.45*u:.15;animApply(g,ck,f,f2,w,type);if(!g.userData.rig.calib){try{flatFeet(g,ph==='addr'?1:ph==='back'?1:ph==='down'?Math.max(0,1-u*1.4):0);feetToGround(g);}catch(e){}}animClub(g,ck,type,ph==='addr'?1:ph==='back'?Math.max(0,1-p/.3):0);try{gripFix(g,type);}catch(e){}const R=g.userData.rig,tn=performance.now()/1000,dtl=Math.min(.12,tn-(R.hlT||tn));R.hlT=tn;const tgt=ph==='addr'?1:0;R.hlW=R.hlW===undefined?1:R.hlW+(tgt-R.hlW)*Math.min(1,dtl*8);if(ph==='addr')R.hlW=1;if(ph==='addr'||ph==='back')headLift(g,R.hlW);return true;}catch(e){console.warn('anim',e);return false;}}
function animBall(p){const g=p.av,R=g&&g.userData.rig;if(!ANIM||!R||!R.skel)return null;try{const t=clubType(p.club),ck=animClip(t);if(!ANIM.clips[ck])return null;const c=animCal(g,ck,t);return c;}catch(e){return null;}}
function makeGolfer(p){const g=buildAvatar(p);g.visible=false;scene.add(g);return g;}


/* ---------- golfers (placeholders until the real roster is in) ---------- */
const ABIL={rip:{n:'Grip it and rip it',d:'+12% carry on one shot'},dial:{n:'Dialed in',d:'near-perfect contact on one shot'},read:{n:'Green reader',d:'shows the true putt line for the rest of the hole'},hl:{n:'Lucky shot',d:'+10% carry and near-perfect contact on one shot'},bounce:{n:'Consistency King',d:'always on: contact tightens right after a bad shot',passive:true}};
const B=(pow,acc,sg,put,rec)=>({pow,acc,sg,put,rec});
const BASE=[
 {id:'grey-snap',name:'Sherif Reda',hcp:36,st:[71,38,40,56,26],ab:'rip',color:'#e67e22',look:{skin:'#d9a883',cap:{style:'back',color:'#8a9098'},top:{type:'hoodie',color:'#202024'},legs:{color:'#d9d9d6'},shoes:'#6b4a33'}},
 {id:'red-brim',name:'David Chen',hcp:36,st:[32,57,42,58,42],ab:'read',color:'#e74c3c',look:{skin:'#e3b48e',cap:{style:'fwd',color:'#1b1b1d',brim:'#b8352b'},top:{type:'tee',color:'#e4e4e1'},legs:{color:'#2b2f36'}}},
 {id:'ramble-on',name:'Benja B',hcp:15,st:[89,68,71,70,70],ab:'rip',color:'#f1c40f',look:{skin:'#e8b893',tall:1.06,cap:{style:'fwd',color:'#1b1b1d',patch:'#d9892b'},top:{type:'polo',color:'#24345c',arms:'#5a7299'},legs:{color:'#1d1d20'},shoes:'#2a2a2e'}},
 {id:'flag-holder',name:'Josh Seto',hcp:14,st:[71,83,73,72,75],ab:'dial',color:'#1abc9c',look:{skin:'#d9a47c',tall:1.05,cap:{style:'fwd',color:'#1b1b1d'},top:{type:'hawaiian',color:'#141418',pat:'nightbloom'},legs:{color:'#23262d'}}},
 {id:'white-snap',name:'Jason Fritz',hcp:22,st:[64,66,64,64,64],ab:'dial',color:'#3498db',look:{skin:'#e6b894',cap:{style:'back',color:'#efefeb'},top:{type:'zip',color:'#3552a0'},legs:{color:'#2b2f36'}}},
 {id:'the-bay',name:'Roby Jung',hcp:10,st:[97,78,65,80,80],ab:'rip',color:'#9b59b6',look:{skin:'#dfae86',cap:{style:'fwd',color:'#1b1b1d',rope:true},top:{type:'polo',color:'#f1f1ee'},legs:{color:'#2b2f36'}}},
 {id:'photobomber',name:'Shaw Wakayama',hcp:24,st:[63,70,63,54,59],ab:'dial',color:'#e84393',look:{skin:'#b87a62',hairMesh:'parted',hair:'#141011',top:{type:'polo',color:'#eef1ec',pat:'pinstripe'},legs:{color:'#5e5f45'}}},
 {id:'back-row',name:'Jacqueline Hwang',hcp:34,st:[36,68,48,47,45],ab:'dial',color:'#00cec9',look:{skin:'#c99c82',hair:'#2a1d16',hairMesh:'long',cap:{style:'visor',color:'#1f2a44'},top:{type:'polo',color:'#f4f4f1'},legs:{color:'#1f2a44',skirt:true},shoes:'#f4f4f2'}},
 {id:'green-fleece',name:'Justin Ahn',hcp:29,st:[67,42,70,42,55],ab:'hl',color:'#6ab04c',look:{skin:'#dcaa82',hairMesh:'parted',hair:'#141112',glove:true,top:{type:'fleece',color:'#5d6b4c'},legs:{color:'#1c1c1e',shorts:true},shoes:'#2a2a2e'}},
 {id:'shaka',name:'Brandon Kuntz',hcp:18,st:[79,75,64,64,66],ab:'rip',color:'#fd9644',look:{skin:'#f0c4a4',cap:{style:'fwd',color:'#1b1b1d'},top:{type:'polo',color:'#1b2640'},legs:{color:'#1d1d20'},shoes:'#f2f2f2'}},
 {id:'white-cap',name:'Darren Twanmoh',hcp:18,st:[91,54,69,68,66],ab:'rip',color:'#a29bfe',look:{skin:'#d7a17a',cap:{style:'fwd',color:'#f1f1ee'},top:{type:'vest',color:'#1d1d1f',arms:'#8a8d92'},legs:{color:'#1d1d20'},shoes:'#f2f2f2'}},
 {id:'selfie-cam',name:'Andrew Skalman',hcp:7,st:[72,89,89,89,81],ab:'bounce',color:'#ff7675',look:{skin:'#e6b58f',glasses:'#8a6e5a',stache:true,cap:{style:'fwd',color:'#1b1b1d',patch:'#eaeaea'},top:{type:'hawaiian',color:'#127c7a',pat:'lagoon'},legs:{color:'#1d1d20'}}},
 {id:'navy-cap',name:'Mo Reda',hcp:36,st:[47,46,46,46,46],ab:'dial',color:'#fdcb6e',look:{skin:'#b58a6c',cap:{style:'back',color:'#27324f'},top:{type:'tee',color:'#2a3350'},legs:{color:'#2b2f36'}}},
 {id:'jarrett',name:'Jarrett Arakawa',hcp:28,st:[77,46,53,53,54],ab:'rip',color:'#e17055',look:{skin:'#b98a6c',cap:{style:'band',color:'#c8342f'},top:{type:'hawaiian',color:'#f2c230',pat:'pineapple'},legs:{color:'#4b4a3a',shorts:true},shoes:'#f2f2f2'}},
 {id:'kanishka',name:'Kanishka Tiwari',hcp:36,st:[56,40,42,55,38],ab:'rip',color:'#20bf6b',look:{skin:'#af6f53',hairMesh:'parted',hair:'#221a16',top:{type:'polo',color:'#cfc3a8'},legs:{color:'#2b2f36'}}},
 {id:'peter',name:'Peter Merkel',hcp:18,st:[67,70,68,66,77],ab:'bounce',color:'#4b7bec',look:{skin:'#d9a089',hairMesh:'parted',hair:'#a07a4a',top:{type:'polo',color:'#4a4e55'},legs:{color:'#b3a585'}}},
 {id:'keegan',name:'Keegan Choy',hcp:18,st:[66,70,71,70,71],ab:'hl',color:'#00b894',look:{skin:'#c9977c',cap:{style:'fwd',color:'#e8e2d5',patch:'#3a3a3a'},top:{type:'hawaiian',color:'#e2563f',pat:'sunset'},legs:{color:'#3d4a5a'}}},
 {id:'brendan-ws',name:'Brendan Wesley-Smith',hcp:22,st:[62,69,63,63,65],ab:'dial',color:'#74b9ff',look:{skin:'#d0a08a',cap:{style:'fwd',color:'#f1f1ee',brim:'#1b1b1d'},top:{type:'hawaiian',color:'#1b2a4e',pat:'classic'},legs:{color:'#6b2f3e',shorts:true}}},
 {id:'andrea',name:'Andrea Wesley-Smith',hcp:36,st:[34,63,45,46,43],ab:'dial',color:'#fd79a8',look:{skin:'#d9a58f',hair:'#3b2a22',hairMesh:'long',cap:{style:'visor',color:'#f4f4f1',brim:'#f4f4f1'},top:{type:'polo',color:'#e8336f'},legs:{color:'#f4f4f1',skirt:true},shoes:'#f4f4f2'}},
 {id:'sheldon',name:'Sheldon Lee',hcp:24,st:[82,49,59,59,60],ab:'rip',color:'#0984e3',look:{skin:'#c48d6c',cap:{style:'back',color:'#1b1b1d'},top:{type:'hawaiian',color:'#4da3d9',pat:'plumeria'},legs:{color:'#2b2f36'}}},
 {id:'erik',name:'Erik Miller',hcp:32,st:[45,65,49,56,42],ab:'dial',color:'#686de0',look:{skin:'#6a4230',hairMesh:'buzz',hair:'#121010',top:{type:'polo',color:'#f1f1ec'},legs:{color:'#1d1d20'},shoes:'#1b1b1d'}}];
const SKEY='jp-golf-roster-v3';let saved={};try{saved=JSON.parse(localStorage.getItem(SKEY)||'{}')||{};}catch(e){saved={};}
if(saved['navy-cap']&&saved['navy-cap'].name==='Navy Cap')delete saved['navy-cap'].name;if(saved['shaka']&&saved['shaka'].name==='Brendan')delete saved['shaka'].name;for(const [id,o] of [['brendan-ws','Brendan Wesley Smith'],['andrea','Andrea Wesley Smith']])if(saved[id]&&saved[id].name===o)delete saved[id].name;
const ROSTER=BASE.map(b=>Object.assign({beerRange:[2,5]},b,B(...b.st),saved[b.id]||{}));
ROSTER.sort((a,b)=>a.name.localeCompare(b.name));ROSTER.forEach(r=>{r.abName=ABIL[r.ab].n;r.abDesc=ABIL[r.ab].d;});
function saveRoster(){const o={};for(const r of ROSTER)o[r.id]={name:r.name,pow:r.pow,acc:r.acc,sg:r.sg,put:r.put,rec:r.rec,ab:r.ab};try{localStorage.setItem(SKEY,JSON.stringify(o));}catch(e){}}
const CLUBS=[
 {n:'Driver',c:245,apex:30,T:6.4,roll:.13},{n:'3 wood',c:225,apex:29,T:6.2,roll:.10},{n:'5 wood',c:210,apex:29,T:6.0,roll:.08},
 {n:'4 hybrid',c:195,apex:28,T:5.8,roll:.07},{n:'5 iron',c:182,apex:28,T:5.7,roll:.06},{n:'6 iron',c:172,apex:29,T:5.6,roll:.05},
 {n:'7 iron',c:160,apex:30,T:5.5,roll:.045},{n:'8 iron',c:148,apex:30,T:5.4,roll:.035},{n:'9 iron',c:136,apex:30,T:5.3,roll:.03},
 {n:'Pitching wedge',c:124,apex:29,T:5.1,roll:.025,wedge:1},{n:'Gap wedge',c:108,apex:27,T:4.8,roll:.02,wedge:1},
 {n:'Sand wedge',c:90,apex:24,T:4.4,roll:.015,wedge:1,sand:1},{n:'Lob wedge',c:70,apex:22,T:4.0,roll:.01,wedge:1,sand:1},{n:'Putter',putt:1}];
const PUTTER=CLUBS.length-1;
const FR={water:3,green:.62,fringe:1.3,fairway:1.8,tee:1.8,rough:4.8,bunker:14,oob:3};
const SURF={water:0,fairway:1,tee:1,fringe:.8,green:.7,rough:.3,bunker:0};
const DRUNK={pow:6,acc:16,sg:14,put:16,rec:10};
const BLACKOUT=16;function ST(p,k){let v=Math.max(20,Math.min(99,p[k]-(p.over||0)*DRUNK[k]));if((p.beers||0)>=BLACKOUT)v*=.5;return v;}
function driverTotal(pw){return pw<=65?180+(pw-32)*70/33:250+(pw-65)*70/34;}
function powMult(p){return driverTotal(ST(p,'pow'))/(245*1.13)*(p.buzz>0?1.03:1);}
function lieMult(p,lie,c){if(lie==='rough')return(c===CLUBS[1]||c===CLUBS[2]?.82:.88)+ST(p,'rec')*.0007;if(lie==='bunker')return c.sand?.88+ST(p,'rec')*.001:.6+ST(p,'rec')*.0015;return 1;}
function carryOf(p,i){const c=CLUBS[i];return c.c*YD*powMult(p)*lieMult(p,p.lie,c);}
function clubsFor(p){const r=[];CLUBS.forEach((c,i)=>{if(c.putt)return;if(i===0&&p.lie!=='tee')return;r.push(i);});r.push(PUTTER);return r;}
function tolFor(p,c){let t;if(c.putt)t=.03+ST(p,'put')*.0007;else{t=.026+ST(p,'acc')*.0006;if(c.wedge)t*=.85+ST(p,'sg')*.004;if(p.lie==='rough')t*=.8+ST(p,'rec')*.003;if(p.lie==='bunker')t*=.65+ST(p,'rec')*.004;if(p.boost==='dial'||p.boost==='hl')t*=3;}if(p.ab==='bounce'&&Math.abs(p.lastErr||0)>1.2)t*=2.2;if(p.buzz>0)t*=1.25;return t;}

let MODE='click';try{MODE=localStorage.getItem('jp-swing-mode2')||'click';}catch(e){}let swipe=null;let flyStart=0,flyUntil=0,players=[],cur=null,state='menu',wind={x:0,y:0,sp:0,a:0},overhead=false,plan=null,flightT0=0,swingU=0,swingPow=0,swingAnim=null,readOn=false;
const picked=new Set();const MAXP=4;

function dist(p){return Math.hypot(PIN.x-p.x,PIN.y-p.y);}
function autoSetup(p){const d=dist(p);let tx=PIN.x,ty=PIN.y;
  if(p.lie==='green'||(p.lie==='fringe'&&d<20)||(p.lie!=='bunker'&&p.lie!=='rough'&&d<6))p.club=PUTTER;
  else{const al=clubsFor(p).filter(i=>i!==PUTTER);let pick=al[0];for(const i of al)if(carryOf(p,i)>=d*.97)pick=i;p.club=pick;
    const reach=carryOf(p,pick)*1.12;if(d>reach+25){const pt=plAt(H1,plProj(H1,p.x,p.y)+reach);tx=pt.x;ty=pt.y;}}
  p.aim=Math.atan2(ty-p.y,tx-p.x);p.pmax=Math.max(2.5,Math.min(40,d*1.3+.8));}

/* ---------- shot planning ---------- */
function simRoll(x,y,vx,vy,t,cupOK,noise,slopeK){if(slopeK===undefined)slopeK=1;const pts=[];const dt=1/90;let holed=false,oob=false;const t0=t,hist=[];
  for(let i=0;i<90*14;i++){const lie=lieAt(x,y);if(lie==='oob'||lie==='water'){oob=true;break;}
    const rt=t-t0,fr=FR[lie]*(rt>5?1+(rt-5)*1.3:1),g=grad(x,y),ax=-7*g[0]*slopeK,ay=-7*g[1]*slopeK;let sp=Math.hypot(vx,vy);
    /* at rest when slow and the turf can hold it on this slope (grass grips a stopped ball harder than a rolling one) */
    if(sp<.07&&Math.hypot(ax,ay)<fr*1.5)break;
    /* a ball rocking in a hollow or creeping in place is done */
    if(i%45===0){hist.push([x,y]);if(hist.length>5){const o=hist[hist.length-6];if(Math.hypot(x-o[0],y-o[1])<.3)break;}}
    if(sp>1e-6){const dec=Math.min(fr*dt,sp);vx-=vx/sp*dec;vy-=vy/sp*dec;}
    vx+=ax*dt;vy+=ay*dt;x+=vx*dt;y+=vy*dt;t+=dt;
    if(cupOK){const d=Math.hypot(x-PIN.x,y-PIN.y);sp=Math.hypot(vx,vy);
      if(d<.075){if(sp<1.35){holed=true;x=PIN.x;y=PIN.y;break;}else if(noise){vx*=.7;vy*=.7;const k=(Math.random()-.5)*.7,c=Math.cos(k),s=Math.sin(k);const nx=vx*c-vy*s;vy=vx*s+vy*c;vx=nx;}}}
    if(i%3===0)pts.push({t,x,y,z:H(x,y)+.021});}
  pts.push({t:t+.01,x,y,z:holed?H(x,y)-.06:H(x,y)+.021});return{pts,x,y,holed,oob};}

const TS=.72;
function planFull(p,power,err){const c=CLUBS[p.club];let carry=c.c*YD*powMult(p)*lieMult(p,p.lie,c)*power;if(p.boost==='rip')carry*=1.12;if(p.boost==='hl')carry*=1.10;
  const shp=p.shape||'Straight';if(shp==='Draw')carry*=1.02;if(shp==='Fade')carry*=.98;if(shp==='Punch')carry*=.9;
  const T=c.T*(.5+.5*Math.min(power,1.05))*(shp==='Punch'?.8:1),apex=c.apex*(.3+.7*Math.min(power,1.05))*(p.lie==='rough'?.85:1)*(shp==='Punch'?.5:1),wk=shp==='Punch'?.45:1;
  const a0=p.aim+err*.01-(shp==='Draw'?.035:shp==='Fade'?-.035:0),dx=Math.cos(a0),dy=Math.sin(a0),lx=-dy,ly=dx,curve=err*carry*.085+(shp==='Draw'?carry*.06:shp==='Fade'?-carry*.06:0),wx=wind.x*T*.3*wk,wy=wind.y*T*.3*wk;
  const x0=p.x,y0=p.y,h0=H(x0,y0)+.021;let ex=x0+dx*carry+lx*curve+wx,ey=y0+dy*carry+ly*curve+wy,h1=H(ex,ey);
  const baseXY=s=>[x0+dx*carry*s+lx*curve*s*s+wx*Math.pow(s,1.6),y0+dy*carry*s+ly*curve*s*s+wy*Math.pow(s,1.6)];
  /* after passing through foliage the rest of the flight is shortened (and nudged) by how much tree it went through */
  let cmp=null,leaf=0,inLeaf=false,lat=0;const pathAt=s=>{if(!cmp){const q=baseXY(s);return[q[0],q[1],h0+(h1-h0)*s+4*apex*s*(1-s)];}
    if(s<=cmp.se){const q=baseXY(s);return[q[0],q[1],h0+(h1-h0)*s+4*apex*s*(1-s)];}const u=Math.min(1,(s-cmp.se)/(1-cmp.se)),s2=cmp.se+(s-cmp.se)*cmp.f,q=baseXY(s2);
    return[q[0]+lx*cmp.lat*u,q[1]+ly*cmp.lat*u,cmp.ze+(cmp.hl-cmp.ze)*u+4*cmp.a2*u*(1-u)];};
  const pts=[],N=110;let hit=null,prev=null;
  for(let i=0;i<=N;i++){const s=i/N,P=pathAt(s),px=P[0],py=P[1],pz=P[2],t=s*T*TS;
    if(i>2&&i<N){const ts=prev?trunkSeg(prev[0],prev[1],prev[2],px,py,pz):null;if(ts){hit={x:ts.x,y:ts.y,z:ts.z,t,trunk:true};break;}const tp=treePart(px,py,pz);
      if(tp&&tp.trunk){hit={x:px,y:py,z:pz,t,trunk:true};break;}
      if(tp){const seg=prev?Math.hypot(px-prev[0],py-prev[1],pz-prev[2]):1;leaf+=seg;inLeaf=true;if(Math.random()<(tp.t.fir?.005:.008)*seg){hit={x:px,y:py,z:pz,t,trunk:false};break;}}
      else if(inLeaf){inLeaf=false;if(!cmp&&leaf>.3){const f=Math.max(.3,1-.055*leaf),se=s,sL=se+(1-se)*f,q=baseXY(sL);lat=(Math.random()-.5)*Math.min(4,leaf*.5);
        const hl=H(q[0]+lx*lat,q[1]+ly*lat);cmp={se,f,ze:pz,hl,a2:Math.max(0,apex*(1-se)*.9)*f*f,lat};ex=q[0]+lx*lat;ey=q[1]+ly*lat;h1=hl;carry*=se+(1-se)*f;}}}
    pts.push({t,x:px,y:py,z:pz});prev=[px,py,pz];}
  const res={pts,carry,club:c,putt:false,thruLeaves:leaf>.3&&!hit};
  if(hit&&!hit.trunk){/* caught a limb: drops out of the tree, carrying a little forward */const fwd=.6+Math.random()*1.6,fx=hit.x+dx*fwd,fy=hit.y+dy*fwd,gz=H(fx,fy)+.021;pts.push({t:hit.t+.08,x:hit.x+dx*fwd*.3,y:hit.y+dy*fwd*.3,z:hit.z-.3},{t:hit.t+.45,x:hit.x+dx*fwd*.75,y:hit.y+dy*fwd*.75,z:(hit.z+gz)/2},{t:hit.t+.75,x:fx,y:fy,z:gz});
    Object.assign(res,{x:fx,y:fy,tree:true,treeKind:'limb',holed:false,oob:['oob','water'].includes(lieAt(fx,fy))});return res;}
  if(hit){res.treeKind='trunk';const fx=hit.x-dx*.8,fy=hit.y-dy*.8,gz=H(fx,fy)+.021;pts.push({t:hit.t+.05,x:fx,y:fy,z:hit.z});pts.push({t:hit.t+.35,x:fx,y:fy,z:(hit.z+gz)/2});pts.push({t:hit.t+.6,x:fx,y:fy,z:gz});
    Object.assign(res,{x:fx,y:fy,tree:true,holed:false,oob:['oob','water'].includes(lieAt(fx,fy))});return res;}
  const land=lieAt(ex,ey);if(land==='oob'||land==='water'){Object.assign(res,{x:ex,y:ey,oob:true,holed:false});return res;}
  if(Math.hypot(ex-PIN.x,ey-PIN.y)<.09){pts.push({t:T*TS+.1,x:PIN.x,y:PIN.y,z:H(PIN.x,PIN.y)-.06});Object.assign(res,{x:PIN.x,y:PIN.y,holed:true});return res;}
  const rd=carry*c.roll*(SURF[land]??.3)*(c.wedge&&land==='green'?.6:1)*(shp==='Punch'?1.8:1);
  if(rd<.05){Object.assign(res,{x:ex,y:ey,holed:false});return res;}
  const a=pts[pts.length-1],b=pts[pts.length-4],L=Math.hypot(a.x-b.x,a.y-b.y)||1,ux=(a.x-b.x)/L,uy=(a.y-b.y)/L;
  const spin=((land==='green'||land==='fringe')&&carry>50&&(c.wedge||c.c<150))?(c.wedge?1:.5)*(Math.abs(err)<.6?1:.5)*(shp==='Punch'?.3:1):0;
  if(spin>.2){const hop=.5+.6*(1-spin),hx=ex+ux*hop,hy=ey+uy*hop,cx2=hx+ux*.25,cy2=hy+uy*.25;pts.push({t:a.t+.2,x:(ex+hx)/2,y:(ey+hy)/2,z:H((ex+hx)/2,(ey+hy)/2)+.021+.09*(1-spin*.5)},{t:a.t+.36,x:hx,y:hy,z:H(hx,hy)+.021},{t:a.t+.6,x:cx2,y:cy2,z:H(cx2,cy2)+.021});
    const back=spin*(carry>95?3.4:2.3)*(power>.95?1:.7),v0b=Math.sqrt(2*FR[land]*back),r=simRoll(cx2,cy2,-ux*v0b,-uy*v0b,a.t+.6,true,true);res.pts=pts.concat(r.pts);Object.assign(res,{x:r.x,y:r.y,holed:r.holed,oob:r.oob,spin:true});return res;}
  let sx=ex,sy=ey,st0=a.t,rd2=rd;if(land!=='rough'&&land!=='bunker'&&rd>1.2){const hl=Math.min(rd*.35,7),hh=land==='green'?.1:Math.min(.7,carry*.0045),hx=ex+ux*hl,hy=ey+uy*hl,dt2=.2+hl*.045;
    for(let k=1;k<=6;k++){const s2=k/6,qx=ex+ux*hl*s2,qy=ey+uy*hl*s2;pts.push({t:a.t+dt2*s2,x:qx,y:qy,z:H(qx,qy)+.021+4*hh*s2*(1-s2)});}sx=hx;sy=hy;st0=a.t+dt2;rd2=Math.max(.05,rd-hl);}
  const v0=Math.sqrt(2*FR[land]*rd2);
  const r=simRoll(sx,sy,ux*v0,uy*v0,st0,true,true);res.pts=pts.concat(r.pts);Object.assign(res,{x:r.x,y:r.y,holed:r.holed,oob:r.oob});return res;}
function planPutt(p,power,err){/* short-putt forgiveness: inside ~12 ft the pace is pulled toward a firm, holeable speed, the line tightens and the break softens, more so for better putters */
  const D0=dist(p),sk=Math.max(0,Math.min(1,ST(p,'put')/100)),near=(D0<=1.25?1-.25*D0/1.25:.75*Math.pow(Math.max(0,1-(D0-1.25)/1.6),2))*(p.lie==='green'?1:.6);
  let d=p.pmax*power;const ideal=D0+.33+.15*(1-sk);d+=(ideal-d)*near*(.35+.6*sk);
  const e2=err*(1-near*(.4+.55*sk)),a=p.aim+e2*.02*(1.3-ST(p,'put')*.007),v0=Math.sqrt(2*FR[p.lie]*Math.max(.05,d));
  const r=simRoll(p.x,p.y,Math.cos(a)*v0,Math.sin(a)*v0,0,true,true,1-near*(.35+.55*sk));return{pts:[{t:0,x:p.x,y:p.y,z:H(p.x,p.y)+.021}].concat(r.pts),x:r.x,y:r.y,holed:r.holed,oob:r.oob,putt:true};}

/* ---------- balls ---------- */
const ballGeo=new THREE.SphereGeometry(.0214,40,28),shadowGeo=new THREE.CircleGeometry(.03,16);

function ballPrint(p){const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d');x.fillStyle='#fbfbf9';x.fillRect(0,0,1024,512);
  x.fillStyle='#16171a';x.fillRect(150,253,300,6);                                   /* alignment line */
  x.font='italic 800 64px "Barlow Condensed","Arial Narrow",sans-serif';x.textAlign='center';x.textBaseline='alphabetic';x.fillText('Degen',300,238);
  x.font='700 30px "Barlow Condensed",sans-serif';x.fillStyle='#16171a';x.fillText('D1',300,300);x.fillStyle='#c8202c';x.beginPath();x.arc(336,289,5,0,7);x.fill();
  x.fillStyle='#16171a';x.font='800 58px "Barlow Condensed",sans-serif';x.fillText(String((p&&p.num)||1),812,276);
  x.fillStyle=(p&&p.color)||'#e5484d';x.beginPath();x.arc(812,196,9,0,7);x.fill();   /* player dot above the number */
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;}
function makeBall(p){const b=new THREE.Mesh(ballGeo,new THREE.MeshStandardMaterial({color:0xffffff,map:ballPrint(p),emissive:0x1c1c1c,roughness:.28,metalness:0,bumpMap:makeDimples(),bumpScale:.0019,envMapIntensity:.9}));b.userData.lin=1;b.castShadow=true;
  const sh=new THREE.Mesh(shadowGeo,new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.34,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-4}));sh.rotation.x=-Math.PI/2;
  const mk=new THREE.Mesh(new THREE.RingGeometry(.036,.041,40),new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.9,depthWrite:false}));mk.position.z=.001;sh.add(mk);scene.add(b,sh);return{b,sh};}
function placeBall(p,x,y,z){const b=p.ball.b,np=V(x,y,z),lp=b.userData.lp;
  if(lp){const mx=np.x-lp.x,mz=np.z-lp.z,d=Math.hypot(mx,mz);if(d>1e-5&&d<40){const g=H(x,y),onGround=z<g+.045,ax=new THREE.Vector3(mz/d,0,-mx/d);
      if(!onGround)ax.negate();b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(ax,Math.min(2.4,d/.0214*(onGround?1:.08))));}}
  b.userData.lp=np.clone();b.position.copy(np);p.ball.sh.position.copy(V(x,y,H(x,y)+.006));}
function scaleBalls(){for(const p of players){const d=camera.position.distanceTo(p.ball.b.position),s=Math.max(1,d*.0038/.0214);p.ball.b.scale.setScalar(s);p.ball.sh.scale.set(s,s,1);p.ball.b.visible=p.ball.sh.visible=!p.done||(state==='replay'&&RP&&RP.p===p);}}

/* ---------- game flow ---------- */
let ROUND=null;
function setHole(i){computeHole(i);FXC.grp.clear();FXC.list.length=0;const z=H(PIN.x,PIN.y);flagG.position.copy(V(PIN.x,PIN.y,z));try{drawFlag(HOLE.ref);}catch(e){}pinMark.position.copy(V(PIN.x,PIN.y,z+2.6));placeTeeDeco();
  $('hN').textContent=HOLE.ref;$('hC').textContent=D.short;$('holeMeta').textContent='Par '+PAR+'   '+Math.round(HOLE_LEN*TOYD)+' yds'+(HOLE.hcp?'   Hcp '+HOLE.hcp:'');}
function newGame(len){len=len||'18';for(const p of players){scene.remove(p.ball.b,p.ball.sh,p.av);}
  const n=HOLES.length,idx=[...Array(n).keys()],list=len==='f9'?idx.slice(0,9):len==='b9'?idx.slice(9):idx;ROUND={list:list.length?list:idx,k:0,len};
  players=ROSTER.filter(r=>picked.has(r.id)).map((r,i)=>{const p=Object.assign({},r,{x:0,y:0,strokes:0,done:false,abUsed:false,boost:null,lie:'tee',beers:0,buzz:0,over:0,drankTurn:false,card:{}});const br=r.beerRange||[2,5];p.limit=br[0]+Math.floor(Math.random()*(br[1]-br[0]+1));p.ball=makeBall(p);p.av=makeGolfer(p);linearize(p.ball.b);linearize(p.ball.sh);linearize(p.av);return p;});
  $('menu').hidden=true;$('card').hidden=true;$('courses').hidden=true;try{for(const p of players)p.av.visible=true;renderer.compile(scene,camera);try{const seen=new Set();scene.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of ms)for(const t of[m.map,m.normalMap,m.bumpMap,m.alphaMap,m.emissiveMap,m.roughnessMap])if(t&&!seen.has(t)&&t.image){seen.add(t);renderer.initTexture&&renderer.initTexture(t);}});}catch(e){}for(const p of players)p.av.visible=false;}catch(e){}startHole();}
function startHole(){setHole(ROUND.list[ROUND.k]);
  const wa=Math.random()*Math.PI*2,sp=Math.random()*6;wind={a:wa,sp,x:Math.cos(wa)*sp,y:Math.sin(wa)*sp};
  const t=H1[0],q=plAt(H1,15);
  players.forEach((p,i)=>{const o=(i-(players.length-1)/2)*.7;p.x=t[0]-q.ty*o;p.y=t[1]+q.tx*o;p.strokes=0;p.done=false;p.abUsed=false;p.boost=null;p.lie='tee';p.lastErr=0;p.av.visible=false;placeBall(p,p.x,p.y,H(p.x,p.y)+.05);});
  readOn=false;setRibbon([]);startTurn();flyStart=performance.now()/1000;flyUntil=flyStart+5.5;if(cur)cur.intro=flyUntil+2;
  showHoleCard();}

function drawHoleMap(cv){const x=cv.getContext('2d'),W=cv.width,Hh=cv.height,hp=HOLE.p,t=hp[0],gr=hp[hp.length-1],ang=Math.atan2(gr[1]-t[1],gr[0]-t[0]),len=Math.hypot(gr[0]-t[0],gr[1]-t[1])||1;
  const s=Math.min((Hh-44)/len,(W-20)/Math.max(60,len*.35)),cx=(t[0]+gr[0])/2,cy=(t[1]+gr[1])/2,rot=Math.PI/2-ang,co=Math.cos(rot),si=Math.sin(rot);
  const tf=(px,py)=>{const dx=px-cx,dy=py-cy;return[W/2+(dx*co-dy*si)*s,Hh/2-(dx*si+dy*co)*s];};
  x.fillStyle='#2b4a28';x.fillRect(0,0,W,Hh);
  const near=f=>f.p.some(q=>{const [u,v]=tf(q[0],q[1]);return u>-60&&u<W+60&&v>-60&&v<Hh+60;});
  const poly=(f,fill)=>{if(!near(f))return;x.beginPath();f.p.forEach((q,i)=>{const [u,v]=tf(q[0],q[1]);i?x.lineTo(u,v):x.moveTo(u,v);});x.closePath();x.fillStyle=fill;x.fill();};
  for(const f of WOODS)poly(f,'#1d3a1c');for(const f of FAIRWAYS)poly(f,'#5e9a44');for(const f of TEES)poly(f,'#6fae52');for(const f of WATER)poly(f,'#3f86c2');for(const f of GREENS)poly(f,'#86cc5e');for(const f of BUNKERS)poly(f,'#ecdfb8');
  x.setLineDash([5,5]);x.strokeStyle='rgba(255,255,255,.85)';x.lineWidth=2;x.beginPath();hp.forEach((q,i)=>{const [u,v]=tf(q[0],q[1]);i?x.lineTo(u,v):x.moveTo(u,v);});x.stroke();x.setLineDash([]);
  const [px,py]=tf(PIN.x,PIN.y);x.strokeStyle='#fff';x.lineWidth=1.5;x.beginPath();x.moveTo(px,py);x.lineTo(px,py-16);x.stroke();x.fillStyle='#e8412c';x.beginPath();x.moveTo(px,py-16);x.lineTo(px+10,py-12.5);x.lineTo(px,py-9);x.fill();
  const [tx,ty]=tf(t[0],t[1]);x.fillStyle='#fff';x.beginPath();x.arc(tx,ty,4,0,7);x.fill();}
function showHoleCard(){let el=$('holeCard');if(!el){el=document.createElement('div');el.id='holeCard';document.body.appendChild(el);const st=document.createElement('style');
    st.textContent='#holeCard{position:fixed;left:50%;top:max(12%,calc(env(safe-area-inset-top) + 64px));transform:translate(-50%,-10px);opacity:0;transition:opacity .4s,transform .4s;z-index:30;pointer-events:none;display:grid;grid-template-columns:auto auto;gap:14px;align-items:center;background:rgba(9,22,18,.84);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:12px 18px 12px 12px;color:#fff;box-shadow:0 12px 40px rgba(0,0,0,.35)}'+
    '#holeCard.on{opacity:1;transform:translate(-50%,0)}#holeCard canvas{width:92px;height:144px;border-radius:10px;display:block}#holeCard .hn{font:800 46px/.92 "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.01em}#holeCard .hs{font:700 19px/1.2 "Barlow Condensed",sans-serif;color:#f2c230;margin-top:4px}#holeCard .hk{font:500 13px/1.35 "Barlow",sans-serif;color:#b8c9bf;margin-top:6px;max-width:170px}';document.head.appendChild(st);}
  const cv=document.createElement('canvas');cv.width=184;cv.height=288;try{drawHoleMap(cv);}catch(e){}el.innerHTML='';el.appendChild(cv);const d=document.createElement('div');
  d.innerHTML='<div class="hn">Hole '+HOLE.ref+'</div><div class="hs">Par '+PAR+', '+Math.round(HOLE_LEN*TOYD)+' yds</div><div class="hk">'+(HOLE.hcp?'Handicap '+HOLE.hcp+'. ':'')+'Tap Swing to skip the flyover.</div>';el.appendChild(d);
  el.classList.add('on');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('on'),5200);}

let PG=null;
function buildPuttGrid(p){if(PG){scene.remove(PG.g);PG.g.traverse(o=>{if(o.geometry)o.geometry.dispose();});PG=null;}if(!p||!(p.lie==='green'||p.lie==='fringe'))return;
  const GG=GREENS.reduce((a,b)=>Math.hypot(b.cx-PIN.x,b.cy-PIN.y)<Math.hypot(a.cx-PIN.x,a.cy-PIN.y)?b:a),onG=(x,y)=>inP(GG,x,y)||Math.hypot(x-p.x,y-p.y)<1.5;
  const cx=(p.x+PIN.x)/2,cy=(p.y+PIN.y)/2,R=Math.max(5,Math.hypot(p.x-PIN.x,p.y-PIN.y)/2+3.5),st=.7,P=[],C=[];
  const col=(gx,gy)=>{const t=Math.min(1,Math.hypot(gx,gy)/.035);return t<.5?[.2+t*1.4,.85,1-t*1.6]:[1,1.6-t*1.3,.15];};
  for(let gx=-R;gx<=R;gx+=st)for(let gy=-R;gy<=R;gy+=st){if(Math.hypot(gx,gy)>R)continue;const x=cx+gx,y=cy+gy;if(!onG(x,y))continue;const g0=grad(x,y),c=col(g0[0],g0[1]);
    for(const [ax,ay] of [[st,0],[0,st]]){const x2=x+ax,y2=y+ay;if(!onG(x2,y2))continue;const A=V(x,y,H(x,y)+.014),B2=V(x2,y2,H(x2,y2)+.014);P.push(A.x,A.y,A.z,B2.x,B2.y,B2.z);C.push(...c,...c);}}
  const g=new THREE.Group(),lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(P,3));lg.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
  g.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.5,depthWrite:false,toneMapped:false})));
  const N=150,dp=new Float32Array(N*3),seed=[];for(let i=0;i<N;i++)seed.push({x:cx+(Math.random()*2-1)*R,y:cy+(Math.random()*2-1)*R,a:Math.random()});
  const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dp,3));const dots=new THREE.Points(dg,new THREE.PointsMaterial({color:0xffffff,size:.055,transparent:true,opacity:.85,depthWrite:false,toneMapped:false}));dots.frustumCulled=false;g.add(dots);
  scene.add(g);PG={g,dots,seed,cx,cy,R,onG};}
function updPuttGrid(dt){if(!PG)return;const on=!!(cur&&(state==='aim'||state==='s1'||state==='s2'||state==='sw')&&(cur.lie==='green'||cur.lie==='fringe'));PG.g.visible=on;if(!on)return;const a=PG.dots.geometry.attributes.position.array;
  PG.seed.forEach((s,i)=>{const g0=grad(s.x,s.y),m=Math.hypot(g0[0],g0[1])||1e-6;s.x-=g0[0]/m*dt*(.2+m*16);s.y-=g0[1]/m*dt*(.2+m*16);s.a+=dt*.45;
    if(s.a>1||Math.hypot(s.x-PG.cx,s.y-PG.cy)>PG.R||!PG.onG(s.x,s.y)){s.x=PG.cx+(Math.random()*2-1)*PG.R;s.y=PG.cy+(Math.random()*2-1)*PG.R;s.a=0;}
    const v=V(s.x,s.y,H(s.x,s.y)+.02);a[i*3]=v.x;a[i*3+1]=v.y;a[i*3+2]=v.z;});PG.dots.geometry.attributes.position.needsUpdate=true;}

/* crossed-plane trees: 4 planes (conifers) or 2 (broadleaf), each showing the atlas frame for its own facing */

/* ---------- see-through trees: any tree between the camera and what it's looking at (your golfer, or the ball in flight) dissolves out of the way ---------- */
const OCC={uCamP:{value:new THREE.Vector3()},uTgt:{value:new THREE.Vector3()},uOccOn:{value:0},uOccK:{value:.9},uOccDk:{value:0}};
const OCC_VS='uniform vec3 uCamP,uTgt;uniform float uOccOn;varying float vOcc;\nfloat occAt(vec3 base,float sx,float sy){vec3 sg=uTgt-uCamP;float L2=max(dot(sg,sg),1e-3),o=0.;for(int k=0;k<3;k++){vec3 c=base+vec3(0.,sy*(.3+.3*float(k)),0.);float t=clamp(dot(c-uCamP,sg)/L2,0.,1.);float d=length(c-(uCamP+sg*t));float r=max(sx*.45,1.4)+.6;o=max(o,(1.-step(.965,t))*(1.-smoothstep(r*.75,r*1.3,d)));}return o*uOccOn;}\n';
const OCC_FS='varying float vOcc;uniform float uOccK,uOccDk;\n';
const OCC_DISCARD='if(vOcc>.001){float ign=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));if(ign<vOcc*uOccK)discard;}';
const OCC_DARK='diffuseColor.rgb*=1.-vOcc*uOccDk;';
function updOcc(){let on=0;const p=cur;OCC.uCamP.value.copy(camera.position);
  if(p&&p.av&&(state==='aim'||state==='s1'||state==='s2')&&!(overhead&&state==='aim')){OCC.uTgt.value.copy(p.av.position).add(new THREE.Vector3(0,1.15,0));on=1;OCC.uOccK.value=.9;OCC.uOccDk.value=0;}
  else if(p&&p.ball&&(state==='flight'||state==='result'||state==='replay')){OCC.uTgt.value.copy(p.ball.b.position);on=1;OCC.uOccK.value=.62;OCC.uOccDk.value=.45;}
  OCC.uOccOn.value=on;}
function crossTreeMesh(imp,cap){const P=imp.frames===8?4:2,pos=[],uv=[],fr=[],idx=[];for(let k=0;k<P;k++){const a=k/imp.frames*Math.PI*2,rx=Math.sin(a),rz=-Math.cos(a),b=k*4;
    pos.push(-.5*rx,0,-.5*rz,.5*rx,0,.5*rz,.5*rx,1,.5*rz,-.5*rx,1,-.5*rz);uv.push(0,0,1,0,1,1,0,1);fr.push(k,k,k,k);idx.push(b,b+1,b+2,b,b+2,b+3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('aF',new THREE.Float32BufferAttribute(fr,1));g.setIndex(idx);
  g.setAttribute('aVar',new THREE.InstancedBufferAttribute(new Float32Array(cap),1));
  const m=new THREE.MeshBasicMaterial({map:imp.tex,alphaTest:.42,side:THREE.DoubleSide,toneMapped:false});m.userData.lin=1;
  m.onBeforeCompile=sh=>{sh.uniforms.uF={value:imp.frames};sh.uniforms.uR={value:imp.rows};sh.uniforms.uCamP=OCC.uCamP;sh.uniforms.uTgt=OCC.uTgt;sh.uniforms.uOccOn=OCC.uOccOn;sh.uniforms.uOccK=OCC.uOccK;sh.uniforms.uOccDk=OCC.uOccDk;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aVar;attribute float aF;uniform float uF,uR;varying vec2 vA2;varying float vY2;\n'+OCC_VS).replace('#include <uv_vertex>','#include <uv_vertex>\nvA2=vec2((aF+uv.x)/uF,(uR-1.-aVar+uv.y)/uR);vY2=uv.y;{vec3 ctr=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;vOcc=occAt(ctr,length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));}');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vA2;varying float vY2;\n'+OCC_FS).replace('#include <map_fragment>',OCC_DISCARD+'vec4 texelColor=texture2D(map,vA2);texelColor=mapTexelToLinear(texelColor);diffuseColor*=texelColor;diffuseColor.rgb*=.78+.22*smoothstep(0.,.45,vY2);'+OCC_DARK);};
  m.customProgramCacheKey=()=>'impx'+imp.frames+'x'+imp.rows;const M=new THREE.InstancedMesh(g,m,cap);M.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(cap*3).fill(1),3);M.count=0;M.frustumCulled=false;M.userData.lin=1;scene.add(M);return M;}
function updNearTrees(x,y){if(!IMPS.length)return;if(!NEAR)NEAR=IMPS.map(M=>({M,X:crossTreeMesh(M.userData.imp,260),hid:[]}));
  const m=new THREE.Matrix4(),q=new THREE.Quaternion(),s=new THREE.Vector3(),c=new THREE.Color(),R=58;
  for(const N of NEAR){const I=N.M.userData.imp,arr=N.M.instanceMatrix.array;for(const i of N.hid)arr.set(I.mats.subarray(i*16,i*16+16),i*16);N.hid=[];let n=0;const av=N.X.geometry.attributes.aVar.array;
    I.list.forEach((t,i)=>{if(n>=260||Math.abs(t.x-x)>R||Math.abs(t.y-y)>R||Math.hypot(t.x-x,t.y-y)>R)return;const v=I.rows>1?t.v:0,hh=t.h*I.ratio[v];m.compose(V(t.x,t.y,t.gz-.3),q,s.set(hh*I.aspect,hh,hh*I.aspect));N.X.setMatrixAt(n,m);av[n]=v;
      if(I.cols)N.X.setColorAt(n,c.fromArray(I.cols,i*3));arr.fill(0,i*16,i*16+16);N.hid.push(i);n++;});
    N.X.count=n;N.X.instanceMatrix.needsUpdate=true;if(N.X.instanceColor)N.X.instanceColor.needsUpdate=true;N.X.geometry.attributes.aVar.needsUpdate=true;N.M.instanceMatrix.needsUpdate=true;}}

/* ---------- beer animation: chug or shotgun ---------- */
let BEERA=null;
function beerCan(){const g=new THREE.Group(),c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');const gr=x.createLinearGradient(0,0,0,128);gr.addColorStop(0,'#c9d2da');gr.addColorStop(.5,'#eef2f5');gr.addColorStop(1,'#aeb8c2');x.fillStyle=gr;x.fillRect(0,0,256,128);
  x.fillStyle='#1c3d73';x.fillRect(0,34,256,62);x.fillStyle='#f2c230';x.fillRect(0,34,256,6);x.fillRect(0,90,256,6);x.fillStyle='#fff';x.font='800 34px "Barlow Condensed",sans-serif';x.textAlign='center';x.fillText('DEGEN LAGER',128,78);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;const body=new THREE.Mesh(new THREE.CylinderGeometry(.033,.033,.11,24,1,true),new THREE.MeshStandardMaterial({map:t,metalness:.6,roughness:.3}));g.add(body);
  const al=new THREE.MeshStandardMaterial({color:0xcfd5db,metalness:.9,roughness:.25});const top=new THREE.Mesh(new THREE.CylinderGeometry(.028,.033,.012,24),al);top.position.y=.061;g.add(top);const bot=new THREE.Mesh(new THREE.CylinderGeometry(.033,.029,.01,24),al);bot.position.y=-.06;g.add(bot);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function aimBoneG(g,b,child,tgt){const o=gpG(g,b),cur=gpG(g,child).sub(o).normalize(),des=tgt.clone().sub(o).normalize();setRelG(g,b,new THREE.Quaternion().setFromUnitVectors(cur,des).multiply(relQ(g,b)));}
function armTo(g,s,tgt,pole){const B=g.userData.rig.B,up=B['upperarm_'+s],lo=B['lowerarm_'+s],ha=B['hand_'+s],S0=gpG(g,up),E0=gpG(g,lo),H0=gpG(g,ha),l1=E0.distanceTo(S0),l2=H0.distanceTo(E0);
  const d=tgt.clone().sub(S0),D=Math.min(d.length(),l1+l2-.002);d.setLength(D);const dn=d.clone().normalize(),a=(l1*l1-l2*l2+D*D)/(2*D),h=Math.sqrt(Math.max(0,l1*l1-a*a)),pl=pole.clone().sub(S0);pl.addScaledVector(dn,-pl.dot(dn)).normalize();
  const E=S0.clone().addScaledVector(dn,a).addScaledVector(pl,h);aimBoneG(g,up,lo,E);aimBoneG(g,lo,ha,S0.clone().add(d));}
function startBeer(p){if(!p||!p.av||!p.av.userData.rig||!p.av.userData.rig.skel)return;if(BEERA&&BEERA.can)BEERA.can.parent&&BEERA.can.parent.remove(BEERA.can);const shot=Math.random()<.5,can=beerCan();p.av.add(can);
  BEERA={p,t0:performance.now()/1000,shot,dur:shot?2.6:3.4,can,gulp:0,cracked:false};for(const k in p.av.userData.rig.clubs)p.av.userData.rig.clubs[k].visible=false;p.intro=performance.now()/1000+(shot?2.8:3.6);return shot;}
function updBeer(now){const A=BEERA;if(!A)return;if(state!=='aim'){A.p.av.remove(A.can);BEERA=null;return;}
  const p=A.p,g=p.av,R=g.userData.rig,B=R.B,t=now-A.t0,u=t/A.dur;if(u>=1||!g.visible){g.remove(A.can);BEERA=null;if(cur===p&&state==='aim')posGolfer(p,0);return;}
  const ss=(a,b,x)=>{const k=Math.max(0,Math.min(1,(x-a)/(b-a)));return k*k*(3-2*k);},V3=(x,y,z)=>new THREE.Vector3(x,y,z);
  const out=ss(0,.14,u),up=ss(.14,.3,u),drink=ss(.28,.4,u)*(1-ss(.8,.9,u)),down=ss(.86,1,u);
  animReset(g);/* a relaxed, upright stance */
  const nk=B.neck_01,hd=B.Head,hq0=relQ(g,hd),back=(A.shot?.62:.48)*drink,Rx=a=>new THREE.Quaternion().setFromAxisAngle(V3(1,0,0),a);setRelG(g,nk,Rx(-back*.35).multiply(relQ(g,nk)));setRelG(g,hd,Rx(-back).multiply(hq0));
  if(!R.mouthL){animReset(g);const ey=gpG(g,hd);R.mouthL=hd.worldToLocal(g.localToWorld(V3(0,ey.y+.03,ey.z+.12)));const T0=g.userData.tpl;}
  const mouth=g.worldToLocal(hd.localToWorld(R.mouthL.clone())),shR=gpG(g,B.upperarm_r),shL=gpG(g,B.upperarm_l),pel=gpG(g,B.pelvis);
  const sideR=pel.clone().add(V3(-.26,-.05,.06)),sideL=pel.clone().add(V3(.26,-.05,.06)),hold=shR.clone().add(V3(.06,-.2,.4)),atMouth=mouth.clone().add(V3(-.02,-.07,.07));
  let tR=sideR.clone().lerp(hold,out).lerp(atMouth,up);tR.lerp(sideR,down);
  let tL=sideL.clone();if(A.shot){tL.lerp(atMouth.clone().add(V3(.07,-.02,.02)),up*(1-down));}
  armTo(g,'r',tR,shR.clone().add(V3(-.45,-.35,-.25)));armTo(g,'l',tL,shL.clone().add(V3(.45,-.35,-.3)));
  /* the can sits in the right palm: upright when held out, tipping bottom-up while glugging */
  const palm=gripPt(g,'r'),tilt=A.shot?1.45*up:(.35*up+1.25*drink),ax=V3(0,Math.cos(tilt),-Math.sin(tilt));A.can.position.copy(palm).addScaledVector(ax,.01).add(V3(.035,0,0));A.can.quaternion.setFromUnitVectors(V3(0,1,0),ax);
  if(!A.cracked&&u>.12){A.cracked=true;SND.crack&&SND.crack(A.shot);const w=g.localToWorld(palm.clone().addScaledVector(ax,.07));for(let i=0;i<(A.shot?40:14);i++){const R2=Math.random;emit('n',part(w.x,w.y,w.z,(R2()-.5)*.6,R2()*1.0,(R2()-.5)*.6,.5+R2()*.5,.008+R2()*.01,[.96,.94,.86],6,1.5,true));}}
  if(drink>.5&&t>A.gulp){A.gulp=t+(A.shot?.22:.36);SND.gulp&&SND.gulp();}}
function nextPlayer(){const live=players.filter(p=>!p.done);if(!live.length)return null;const fresh=live.find(p=>p.strokes===0);if(fresh)return fresh;return live.reduce((a,b)=>dist(b)>dist(a)?b:a);}
function startTurn(){for(const p of players)p.av.visible=false;cur=nextPlayer();if(!cur){finish();return;}
  buildTufts(cur.x,cur.y);try{updNearTrees(cur.x,cur.y);}catch(e){console.warn('near trees',e);}setRibbon([]);cur.shape='Straight';cur.drankTurn=false;cur.lie=cur.strokes===0?'tee':lieAt(cur.x,cur.y);autoSetup(cur);cur.av.visible=true;posGolfer(cur,0);cur.intro=performance.now()/1000+2.0;try{buildPuttGrid(cur);}catch(e){console.warn('grid',e);}toast(cur.name,'Handicap '+cur.hcp+(cur.strokes?', stroke '+(cur.strokes+1):', on the tee'));state='aim';swingU=0;swingPow=0;updMeter();refresh();}
function seatBag(p){const bg=p.av&&p.av.userData.bag;if(!bg)return;p.av.updateMatrixWorld(true);const w=p.av.localToWorld(v3(1.25,0,2.55));bg.position.y=(H(w.x,-w.z)-p.av.position.y)/(p.av.scale.x||1);}
function posGolfer(p,rot){const a=p.aim,pt=CLUBS[p.club].putt,off=(p.av.userData.rig&&p.av.userData.rig.skel)?p.av.userData.rig.ballZ:.78;let gx=p.x-Math.sin(a)*off,gy=p.y+Math.cos(a)*off;const ab=animBall(p);if(ab){const s=p.av.scale.x||1;gx=p.x-(ab.bx*Math.cos(a)+ab.bz*Math.sin(a))*s;gy=p.y+(-ab.bx*Math.sin(a)+ab.bz*Math.cos(a))*s;}
  {const sx=Math.cos(a)*.2,sy=Math.sin(a)*.2;p.av.position.copy(V(gx,gy,(H(gx+sx,gy+sy)+H(gx-sx,gy-sy)+H(gx,gy))/3));}p.av.rotation.y=a;applyPose(p.av,swingPose('addr',0,0,!!pt),clubType(p.club));seatBag(p);}
function scoreName(p){const d=p.strokes-PAR;if(p.strokes===1)return'Hole in one';return({'-3':'Albatross','-2':'Eagle','-1':'Birdie','0':'Par','1':'Bogey','2':'Double bogey','3':'Triple bogey'})[d]||('+'+d);}
function fmtDist(m,lie){return(lie==='green'||lie==='fringe'||m<18)?Math.round(m*TOFT)+' ft':Math.round(m*TOYD)+' yds';}

function press(){if(performance.now()/1000<flyUntil){flyUntil=0;if(cur)cur.intro=performance.now()/1000+1.8;return;}if(state==='aim'){if(cur)cur.intro=0;state='s1';swingU=0;overhead=false;$('viewBtn').setAttribute('aria-pressed','false');}
  else if(state==='s1'){swingPow=Math.max(.04,swingU);state='s2';}
  else if(state==='s2')fire(swingU);}
function fire(u){const p=cur,c=CLUBS[p.club],tol=tolFor(p,c);fireErr(u/tol);}
function fireErr(err){const p=cur,c=CLUBS[p.club];
  if(swingPow>1){err*=1+(swingPow-1)*8;err+=(Math.random()-.5)*(swingPow-1)*12;}
  err=Math.max(-3,Math.min(3,err));p.lastErr=err;p.prev={x:p.x,y:p.y};
  plan=c.putt?planPutt(p,swingPow,err):planFull(p,swingPow,err);plan.pure=!c.putt&&Math.abs(err)<.35&&swingPow>.8;plan.lie=p.lie;plan.type=clubType(p.club);plan.dir=p.aim;plan.startX=p.x;plan.startY=p.y;
  p.strokes++;if(p.boost){p.boost=null;}if(p.buzz>0)p.buzz--;
  state='flight';const _ck=ANIM&&p.av.userData.rig&&p.av.userData.rig.skel?animClip(clubType(p.club)):null,_K=_ck&&ANIM.clips[_ck]?ANIM.clips[_ck].keys:null;const DS=_K?Math.max(.12,(_K.imp-_K.top)/ANIM.fps):(c.putt?.34:.24);flightT0=performance.now()/1000+DS;swingAnim={t0:performance.now()/1000,pw:swingPow,putt:!!c.putt,ds:DS,ft:_K?(_K.fin-_K.imp)/ANIM.fps:0,type:clubType(p.club)};
  ring.visible=false;aimLine.visible=false;readLine.visible=false;trailPts=[];setRibbon([]);refresh();}
function contactWord(e){const a=Math.abs(e);if(a<.35)return'Pure';const s=e>0?'draw':'fade';if(a<1)return'Slight '+s;if(a<2)return s[0].toUpperCase()+s.slice(1);return e>0?'Hook':'Slice';}

let RP=null;
function worthReplay(r,p){if(r.oob)return false;const s0=r.pts&&r.pts[0]||{x:r.startX,y:r.startY},dp=Math.hypot(r.x-PIN.x,r.y-PIN.y),from=Math.hypot(s0.x-PIN.x,s0.y-PIN.y);
  if(r.holed)return r.putt?from>4:true;if(r.putt)return false;if(dp<2.4&&from>22)return true;if(r.spin&&dp<5)return true;return Math.hypot(r.x-r.startX,r.y-r.startY)*TOYD>=285&&Math.abs(p.lastErr||0)<.35;}
function replayBadge(on){let el=$('replayBadge');if(!el){el=document.createElement('div');el.id='replayBadge';el.innerHTML='<span class="rd"></span><b>REPLAY</b><i>Tap to skip</i>';document.body.appendChild(el);const st=document.createElement('style');
    st.textContent='#replayBadge{position:fixed;top:max(14px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:40;display:none;align-items:center;gap:8px;background:rgba(9,22,18,.85);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:7px 14px;color:#fff;font:700 15px "Barlow Condensed",sans-serif;letter-spacing:.08em}#replayBadge.on{display:flex}#replayBadge i{font:500 12px Barlow,sans-serif;letter-spacing:0;color:#b8c9bf;font-style:normal}#replayBadge .rd{width:9px;height:9px;border-radius:50%;background:#e8412c;animation:rpb 1s infinite}@keyframes rpb{50%{opacity:.25}}';document.head.appendChild(st);}
  el.classList.toggle('on',on);}
function startReplay(r,p,then){if(r.dir===undefined){const a=r.pts[0],b=r.pts[r.pts.length-1];r.dir=Math.atan2(b.y-a.y,b.x-a.x);r.startX=a.x;r.startY=a.y;}RP={r,p,then,t0:performance.now()/1000,sp:r.putt?.55:.42,trail:[]};state='replay';replayBadge(true);setRibbon([]);const pn=$('panel');if(pn)pn.style.visibility='hidden';}
function endReplay(){if(!RP)return;const R0=RP;RP=null;replayBadge(false);const pn=$('panel');if(pn)pn.style.visibility='';placeBall(R0.p,R0.p.x,R0.p.y,R0.r.holed?H(R0.p.x,R0.p.y)-.06:H(R0.p.x,R0.p.y)+.021);state='result';setRibbon(trailPts);setTimeout(safe(()=>{if(state==='result')R0.then();},'after replay'),650);}
document.addEventListener('pointerdown',()=>{if(state==='replay')endReplay();});

/* ---------- crash guard: errors are caught and listed behind a small Bug button; a watchdog keeps the round moving ---------- */
const DGERR=[];let STATE_T0=0,STATE_LAST='';
function dgErr(e,where){const msg=(where?where+': ':'')+(e&&e.message?e.message:String(e))+(e&&e.stack?'\n'+String(e.stack).split('\n').slice(0,4).join('\n'):'');if(DGERR.length&&DGERR[DGERR.length-1].m===msg)return;DGERR.push({m:msg,t:new Date().toLocaleTimeString(),st:state});if(DGERR.length>12)DGERR.shift();console.error('[degen]',msg);
  let b=$('bugPill');if(!b){b=document.createElement('button');b.id='bugPill';b.style.cssText='position:fixed;left:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:60;background:#e5484d;color:#fff;border:0;border-radius:999px;padding:6px 12px;font:700 13px Barlow,sans-serif';
    b.onclick=()=>{const txt='Degen Golfers bug report\nCourse: '+(window.COURSE_KEY||'')+'  State: '+state+'\n\n'+DGERR.map(x=>'['+x.t+' '+x.st+'] '+x.m).join('\n\n');try{navigator.clipboard&&navigator.clipboard.writeText(txt);}catch(_){}alert(txt+'\n\n(Copied to clipboard. Paste it to Claude.)');};document.body.appendChild(b);}
  b.textContent='Bug ('+DGERR.length+')';}
window.addEventListener('error',ev=>dgErr(ev.error||ev.message,'error'));window.addEventListener('unhandledrejection',ev=>dgErr(ev.reason,'promise'));
const safe=(fn,where)=>()=>{try{fn();}catch(e){dgErr(e,where);}};
function watchdog(now){if(state!==STATE_LAST){STATE_LAST=state;STATE_T0=now;return;}const age=now-STATE_T0;
  try{if(state==='flight'&&age>30){dgErr(new Error('flight never finished'),'watchdog');STATE_T0=now;finishShot();}
    else if(state==='result'&&age>9){dgErr(new Error('stuck after the shot'),'watchdog');STATE_T0=now;startTurn();}
    else if(state==='replay'&&age>25){STATE_T0=now;endReplay();}}catch(e){dgErr(e,'watchdog');}}
function finishShot(){const p=cur,r=plan;let big='',small='';
  if(r.holed){SND.cup();p.done=true;p.x=PIN.x;p.y=PIN.y;big=scoreName(p);small=p.name+' holes out in '+p.strokes;}
  else if(r.oob){p.strokes++;big=lieAt(r.x,r.y)==='water'?'In the water':'Out of bounds';p.x=p.prev.x;p.y=p.prev.y;small='Penalty stroke. Replaying from the previous spot.';}
  else{p.x=r.x;p.y=r.y;p.lie=lieAt(p.x,p.y);const d=dist(p);
    if(r.putt){big=fmtDist(d,'green')+' left';small=p.lie==='green'?'':LIE_NAME[p.lie];}
    else{const tot=Math.hypot(r.x-r.startX,r.y-r.startY);big=Math.round(tot*TOYD)+' yds';small=(r.tree?(r.treeKind==='trunk'?'Clanked off a trunk. ':'Caught a thick branch. '):r.thruLeaves?'Rattled through the leaves. ':'')+contactWord(p.lastErr)+', '+LIE_NAME[p.lie].toLowerCase()+', '+fmtDist(d,p.lie)+' to the pin';}
    if(p.strokes>=10){p.done=true;big='Picked up';small=p.name+' takes a 10';}}
  placeBall(p,p.x,p.y,r.holed?H(p.x,p.y)-.06:H(p.x,p.y)+.021);toast(big,small);state='result';refresh();
  let rp=false;try{rp=worthReplay(r,p);}catch(e){dgErr(e,'replay check');}if(rp){setTimeout(safe(()=>{if(state==='result')startReplay(r,p,safe(()=>startTurn(),'next turn'));},'replay'),1300);}else setTimeout(safe(()=>{if(state==='result')startTurn();},'next turn'),r.holed?2600:2100);}
function toPar(v){return v===0?'E':(v>0?'+':'')+v;}
function tally(p){let s=0,pr=0;for(const k in p.card){s+=p.card[k];pr+=+HOLES[k].par||4;}return{s,tp:s-pr};}
function finish(){state='done';const hi=ROUND.list[ROUND.k];for(const p of players)p.card[hi]=p.strokes;const last=ROUND.k>=ROUND.list.length-1;
  const b=$('cardBody');b.innerHTML='';
  players.slice().sort((a,c)=>tally(a).tp-tally(c).tp||tally(a).s-tally(c).s).forEach(p=>{const T=tally(p),tr=document.createElement('tr');tr.innerHTML='<td></td><td class="t"></td><td style="text-align:right"></td><td class="s"></td><td class="t"></td>';
    tr.children[0].textContent=p.name;tr.children[1].textContent=(p.strokes>=10?'Picked up':scoreName(p))+' ('+p.strokes+')';tr.children[2].textContent=p.beers+(p.over?' (over)':'');tr.children[3].textContent=T.s;tr.children[4].textContent=toPar(T.tp);b.appendChild(tr);});
  const G=$('cGrid'),done=ROUND.list.slice(0,ROUND.k+1);let h='<tr><th>Hole</th>'+done.map(i=>'<th>'+HOLES[i].ref+'</th>').join('')+'</tr><tr><td>Par</td>'+done.map(i=>'<td>'+HOLES[i].par+'</td>').join('')+'</tr>';
  for(const p of players)h+='<tr><td>'+esc(p.name.split(' ')[0])+'</td>'+done.map(i=>{const s=p.card[i],d=s-(+HOLES[i].par);return'<td style="color:'+(d<0?'#9be07a':d>1?'#ff9d8a':'inherit')+'">'+s+'</td>';}).join('')+'</tr>';G.innerHTML=h;
  $('cSub').textContent=last?'Round complete at '+D.short:'Hole '+HOLE.ref+' complete';$('cTitle').textContent=last?'Final card':'Scorecard';
  $('againBtn').textContent=last?'Back to the roster':'Next: hole '+HOLES[ROUND.list[ROUND.k+1]].ref;$('quitBtn').hidden=last;
  setTimeout(()=>{$('card').hidden=false;},1200);}
function toRoster(){state='menu';$('card').hidden=true;$('courses').hidden=true;$('menu').hidden=false;for(const p of players){p.av.visible=false;p.done=true;}cur=null;ROUND=null;setRibbon([]);buildMenu();}
let toastTimer;function toast(b,s){$('tB').textContent=b;$('tS').textContent=s;$('toast').classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('on'),1900);}

/* ---------- HUD ---------- */

function refresh(){const p=cur;if(!p)return;const c=CLUBS[p.club];const d=dist(p);
  $('who').style.setProperty('--pc',p.color);$('wName').textContent=p.name+'   Stroke '+(p.strokes+1);const bs=p.beers>=BLACKOUT?'BLACKOUT, '+p.beers+' beers. Every stat halved':p.over?'You’re wasted ('+p.beers+' beers)':p.buzz>0?'Buzzed, '+p.buzz+' shot'+(p.buzz>1?'s':'')+' left':p.beers?p.beers+' beer'+(p.beers>1?'s':''):'';$('wBeer').textContent=bs;$('wBeer').hidden=!bs;$('wBeer').dataset.bad=p.over?'1':'';const bb=$('beerBtn');bb.disabled=p.drankTurn||state!=='aim';$('wDist').textContent=fmtDist(d,p.lie)+' to pin';$('wLie').textContent=LIE_NAME[p.lie];
  const bd=$('board');bd.innerHTML='';for(const q of players){const s=document.createElement('span');s.style.setProperty('--pc',q.color);const fn=q.name.split(' ')[0],dup=players.filter(o=>o.name.split(' ')[0]===fn).length>1;s.textContent=(dup?fn+' '+q.name.split(' ').slice(-1)[0][0]+'.':fn)+' '+q.strokes+(q.done?' ✓':'');bd.appendChild(s);}
  $('wSpd').textContent=Math.round(wind.sp*2.237);
  if(c.putt){$('cName').innerHTML='Putter<small>Full power '+Math.round(p.pmax*TOFT)+' ft</small>';}
  else{$('cName').innerHTML=c.n+'<small>Carry '+Math.round(carryOf(p,p.club)*(p.boost==='rip'?1.12:p.boost==='hl'?1.1:1)*TOYD)+' yds</small>';}
  const ab=$('abBtn'),pas=ABIL[p.ab].passive;ab.textContent=p.abName;ab.disabled=pas||p.abUsed||state!=='aim';ab.setAttribute('aria-pressed',String(!!p.boost||(p.ab==='read'&&readOn)||(pas&&Math.abs(p.lastErr||0)>1.2)));
  $('swing').disabled=!(state==='aim'||state==='s1'||state==='s2'||state==='sw');const sb=$('shapeBtn');sb.textContent=p.shape||'Straight';sb.disabled=state!=='aim'||!!c.putt;sb.setAttribute('aria-pressed',String((p.shape||'Straight')!=='Straight'));
  let L='',R='';if(c.putt){const dx=Math.cos(p.aim),dy=Math.sin(p.aim),mx=p.x+dx*d/2,my=p.y+dy*d/2,g=grad(mx,my),up=g[0]*dx+g[1]*dy,side=g[0]*-dy+g[1]*dx;
      L=(Math.abs(up)<.003?'Flat':(up>0?'Uphill ':'Downhill ')+(Math.abs(up)*100).toFixed(1)+'%');R=Math.abs(side)<.003?'Straight':'Breaks '+(side>0?'right':'left')+' '+(Math.abs(side)*100).toFixed(1)+'%';}
  else{L='Lie: <b>'+LIE_NAME[p.lie]+'</b>'+(MODE==='swipe'&&state==='aim'?'  Swipe down on the course, then up':'');R=p.boost?'<b>'+p.abName+'</b> ready':(p.ab==='bounce'&&Math.abs(p.lastErr||0)>1.2?'<b>Consistency King</b> active':'');}
  $('iL').innerHTML=L;$('iR').innerHTML=R;updAim();}
function pct(u){return(u+.15)/1.25*100;}
function updMeter(){const p=cur;if(!p)return;const c=CLUBS[p.club],tol=tolFor(p,c);
  const sw=$('mSweet');sw.style.left=pct(-tol)+'%';sw.style.width=(pct(tol)-pct(-tol))+'%';
  $('mCur').style.left=pct(swingU)+'%';const pw=(state==='s1'||state==='sw')?swingU:(state==='s2'||state==='flight'?swingPow:0);$('mFill').style.width=Math.max(0,pct(pw)-12)+'%';
  const mk=$('mMark');if(c.putt&&(state==='aim'||state==='s1'||state==='s2')){mk.style.display='block';mk.style.left=pct(Math.min(1.1,dist(p)/p.pmax))+'%';}else mk.style.display='none';
  $('mLbl').textContent=pw>0?Math.round(pw*100)+'%':(c.putt?'Line marks the hole':'');}
function updAim(){const p=cur;if(!p||state!=='aim'){ring.visible=aimLine.visible=readLine.visible=false;return;}const c=CLUBS[p.club],dx=Math.cos(p.aim),dy=Math.sin(p.aim);
  if(c.putt){ring.visible=false;const d=dist(p),pts=[];for(let i=0;i<=30;i++){const s=d*i/30;pts.push(V(p.x+dx*s,p.y+dy*s,H(p.x+dx*s,p.y+dy*s)+.03));}setLine(aimLine,pts);aimLine.visible=true;
    if(readOn){const r=simRoll(p.x,p.y,0,0,0,true,false);const v0=Math.sqrt(2*FR[p.lie]*d);const rr=simRoll(p.x,p.y,dx*v0,dy*v0,0,true,false);setLine(readLine,rr.pts.map(q=>V(q.x,q.y,q.z+.02)));readLine.visible=true;}else readLine.visible=false;}
  else{const cr=carryOf(p,p.club)*(p.boost==='rip'?1.12:p.boost==='hl'?1.1:1),ex=p.x+dx*cr,ey=p.y+dy*cr;ring.position.copy(V(ex,ey,H(ex,ey)+.3));ring.visible=true;
    const pts=[];for(let i=0;i<=40;i++){const s=cr*i/40,x=p.x+dx*s,y=p.y+dy*s;pts.push(V(x,y,H(x,y)+.25));}setLine(aimLine,pts);aimLine.visible=true;readLine.visible=false;}
  posGolfer(p,0);}
function cycleClub(k){if(state!=='aim')return;const al=clubsFor(cur);let i=al.indexOf(cur.club);i=(i+k+al.length)%al.length;cur.club=al[i];if(CLUBS[cur.club].putt)cur.pmax=Math.max(2.5,Math.min(40,dist(cur)*1.3+.8));refresh();updMeter();}
function nudgeAim(k){if(state!=='aim')return;cur.aim+=k*(CLUBS[cur.club].putt?.004:.008);refresh();}

const SW=$('swing');
SW.addEventListener('pointerdown',e=>{e.preventDefault();const now=performance.now()/1000;if(now<flyUntil){press();return;}
  if(MODE!=='swipe'){press();return;}if(state!=='aim'||!cur)return;cur.intro=0;overhead=false;$('viewBtn').setAttribute('aria-pressed','false');
  toast('Swipe on the course','Put a finger high on the screen, pull straight down, then push back up.');});
function swipeScale(){return Math.max(140,innerHeight*.3);}
function swipeMove(e){if(state!=='sw'||!swipe)return;const now=performance.now()/1000,dy=e.clientY-swipe.y0;
  if(swipe.phase==='back'){if(dy>=swipe.max){swipe.max=dy;swipe.low={x:e.clientX,y:e.clientY,t:now};swingU=Math.min(1.1,dy/swipeScale());}else if(dy<swipe.max-14&&swipe.max>20)swipe.phase='down';}
  if(swipe&&swipe.phase==='down'&&dy<=0)finishSwipe(e.clientX,e.clientY,now);updMeter();}
function endSwipe(e){if(state!=='sw'||!swipe)return;const now=performance.now()/1000,dy=e.clientY-swipe.y0;
  if(swipe.phase==='down'&&dy<=swipe.max*.4)finishSwipe(e.clientX,e.clientY,now);else{state='aim';swipe=null;swingU=0;toast('Swing cancelled','Pull down, then push back up through the start.');refresh();updMeter();}}
function finishSwipe(x,y,now){trace=[];setTimeout(drawG,0);const p=cur,c=CLUBS[p.club],s=swipe;swipe=null;const up=Math.max(1,s.low.y-y),ang=Math.atan2(x-s.low.x,up),tp=now-s.low.t;
  let pw=Math.max(.04,swingU),tempo='Good tempo',terr=0;
  if(tp<.09){pw*=1.05;terr=(Math.random()<.5?-1:1)*(.09-tp)*25;tempo='Rushed';}else if(tp>.3){pw*=Math.max(.55,1-(tp-.3)*1.3);tempo='Slow tempo';}
  const tolA=tolFor(p,c)*2.4;let err=-ang/tolA+terr+(p.over?(Math.random()-.5)*p.over*1.2:0);swingPow=pw;
  toast(Math.abs(err)<.35&&tempo==='Good tempo'?'Pure strike':tempo,Math.round(pw*100)+'% power'+(Math.abs(ang)>.02?', path '+(ang>0?'right ':'left ')+Math.round(Math.abs(ang)*57.3)+'°':''));
  fireErr(err);}
$('cPrev').onclick=()=>cycleClub(-1);$('cNext').onclick=()=>cycleClub(1);
function holdBtn(el,k){let iv;const stop=()=>clearInterval(iv);el.addEventListener('pointerdown',e=>{e.preventDefault();nudgeAim(k);clearInterval(iv);iv=setInterval(()=>nudgeAim(k),45);});['pointerup','pointerleave','pointercancel'].forEach(t=>el.addEventListener(t,stop));}
holdBtn($('aimL'),1);holdBtn($('aimR'),-1);
const SHAPES=['Straight','Draw','Fade','Punch'];$('shapeBtn').onclick=()=>{if(!cur||state!=='aim'||CLUBS[cur.club].putt)return;cur.shape=SHAPES[(SHAPES.indexOf(cur.shape||'Straight')+1)%4];refresh();};
$('viewBtn').onclick=()=>{if(state!=='aim')return;overhead=!overhead;$('viewBtn').setAttribute('aria-pressed',String(overhead));};
$('beerBtn').onclick=()=>{const p=cur;if(!p||state!=='aim'||p.drankTurn)return;p.drankTurn=true;p.beers++;try{startBeer(p);}catch(e){console.warn(e);}
  if(p.beers>=BLACKOUT){p.over=p.beers-p.limit;p.buzz=0;toast(p.beers===BLACKOUT?'BLACKOUT':'Still blacked out','Sixteen beers deep. Every stat is cut in half.');}
  else if(p.beers>p.limit){p.over=p.beers-p.limit;p.buzz=0;toast('You’re wasted',p.over>1?'Even worse. Stats keep sliding for the rest of the round.':'All stats down for the rest of the round.');}
  else{p.buzz=3;toast('Beer '+p.beers,p.beers===p.limit?'Loose for 3 shots. That one hit, maybe slow down.':'Loose and locked in for the next 3 shots.');}
  refresh();updMeter();};
$('abBtn').onclick=()=>{const p=cur;if(!p||p.abUsed||state!=='aim'||ABIL[p.ab].passive)return;p.abUsed=true;if(p.ab==='read')readOn=true;else p.boost=p.ab;toast(p.abName,p.abDesc[0].toUpperCase()+p.abDesc.slice(1));refresh();updMeter();};
const GC=$('gest'),gx=GC.getContext('2d');function sizeG(){const d=Math.min(2,devicePixelRatio||1);GC.width=innerWidth*d;GC.height=innerHeight*d;gx.setTransform(d,0,0,d,0,0);}sizeG();addEventListener('resize',sizeG);
let g0=null,trace=[];
function drawG(){gx.clearRect(0,0,innerWidth,innerHeight);if(state!=='sw'||!swipe||!trace.length)return;const sc=swipeScale(),x0=swipe.x0,y0=swipe.y0;
  gx.lineCap='round';gx.setLineDash([6,8]);gx.strokeStyle='rgba(255,255,255,.35)';gx.lineWidth=2;gx.beginPath();gx.moveTo(x0,y0);gx.lineTo(x0,y0+sc*1.1);gx.stroke();gx.setLineDash([]);
  for(const f of[.5,1]){gx.strokeStyle=f===1?'rgba(242,194,48,.9)':'rgba(255,255,255,.5)';gx.lineWidth=2;gx.beginPath();gx.moveTo(x0-22,y0+sc*f);gx.lineTo(x0+22,y0+sc*f);gx.stroke();}
  gx.strokeStyle='rgba(255,255,255,.9)';gx.lineWidth=7;gx.shadowColor='rgba(0,0,0,.4)';gx.shadowBlur=6;gx.beginPath();trace.forEach((p,i)=>i?gx.lineTo(p[0],p[1]):gx.moveTo(p[0],p[1]));gx.stroke();gx.shadowBlur=0;
  gx.fillStyle='rgba(242,194,48,.95)';gx.beginPath();gx.arc(x0,y0,9,0,7);gx.fill();
  const t=trace[trace.length-1];gx.font='600 20px "Barlow Condensed",sans-serif';gx.fillStyle='#fff';gx.fillText(Math.round(swingU*100)+'%',t[0]+18,t[1]+6);}
canvas.addEventListener('pointerdown',e=>{if(performance.now()/1000<flyUntil){press();return;}g0={x:e.clientX,y:e.clientY,lx:e.clientX,mode:null};try{canvas.setPointerCapture(e.pointerId);}catch(_){}});
canvas.addEventListener('pointermove',e=>{if(!g0)return;const dx=e.clientX-g0.x,dy=e.clientY-g0.y,now=performance.now()/1000;
  if(!g0.mode){if(Math.hypot(dx,dy)<10)return;g0.mode=(MODE==='swipe'&&state==='aim'&&cur&&dy>0&&dy>Math.abs(dx)*1.3)?'swing':'aim';
    if(g0.mode==='swing'){cur.intro=0;overhead=false;$('viewBtn').setAttribute('aria-pressed','false');swipe={x0:g0.x,y0:g0.y,max:0,low:{x:g0.x,y:g0.y,t:now},phase:'back'};state='sw';swingU=0;trace=[[g0.x,g0.y]];refresh();}}
  if(g0.mode==='aim'){if(state==='aim'&&cur){const d=e.clientX-g0.lx;cur.aim-=d*(CLUBS[cur.club].putt?.0012:.0025);refresh();}g0.lx=e.clientX;}
  else{trace.push([e.clientX,e.clientY]);swipeMove(e);}drawG();});
function gEnd(e){if(g0&&g0.mode==='swing')endSwipe(e);g0=null;trace=[];drawG();}
canvas.addEventListener('pointerup',gEnd);canvas.addEventListener('pointercancel',gEnd);
addEventListener('keydown',e=>{if(state==='menu'||state==='done'||!$('edit').hidden)return;if(e.code==='Space'){e.preventDefault();if(!e.repeat)press();}else if(e.key==='ArrowLeft')nudgeAim(1);else if(e.key==='ArrowRight')nudgeAim(-1);else if(e.key==='q'||e.key==='Q')cycleClub(-1);else if(e.key==='e'||e.key==='E')cycleClub(1);});

/* menu */
const PORT={};for(const r of ROSTER)PORT[r.id]=(window.FACES&&FACES[r.id])?FACES[r.id].por:'';
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);}
const STATN=[['pow','Power'],['acc','Accuracy'],['sg','Short game'],['put','Putting'],['rec','Recovery']];
const STATS2=[['pow','PWR','Power'],['acc','ACC','Accuracy'],['sg','SHT','Short game'],['put','PUT','Putting'],['rec','REC','Recovery']];
function segBar(v){const full=Math.floor(v/20),c=full>=4?'#58c95e':full===3?'#f5d02f':full===2?'#f28c28':'#e5484d';let h='<span class="sbar" style="--sc:'+c+'">';for(let k=0;k<5;k++){const f=Math.max(0,Math.min(1,(v-k*20)/20));h+='<i><b style="width:'+(f*100).toFixed(0)+'%"></b></i>';}return h+'</span>';}
function buildMenu(){const w=$('picks');w.innerHTML='';const order=[...picked];for(const r of ROSTER){const on=picked.has(r.id),d=document.createElement('button');d.className='gc';d.setAttribute('aria-pressed',String(on));d.style.setProperty('--pc',r.color);
  d.innerHTML='<div class="hd"><img alt="" src="'+(PORT[r.id]||'')+'"><div><div class="nm">'+esc(r.name)+'</div><div class="hc">Hcp '+r.hcp+'</div></div></div><div class="abl">'+esc(ABIL[r.ab].n)+'</div>'+
    STATS2.map(s=>'<div class="sr" title="'+s[2]+' '+r[s[0]]+'"><span class="sl">'+s[1]+'</span><span class="sv">'+r[s[0]]+'</span>'+segBar(r[s[0]])+'</div>').join('')+(on?'<span class="pk">'+(order.indexOf(r.id)+1)+'</span>':'');
  d.onclick=()=>{if(picked.has(r.id))picked.delete(r.id);else if(picked.size<MAXP)picked.add(r.id);buildMenu();};w.appendChild(d);}
  $('cnt').textContent=picked.size?picked.size+' of '+MAXP+' golfers picked':'Pick up to '+MAXP+' golfers for this round';$('goBtn').disabled=picked.size===0;}
let editing=null;
function openEdit(r){editing=r;$('eImg').src=PORT[r.id]||'';$('eTitle').textContent=r.name;$('eName').value=r.name;
  $('eStats').innerHTML=STATN.map(s=>'<label class="rg">'+s[1]+'<input type="range" min="30" max="99" value="'+r[s[0]]+'" data-k="'+s[0]+'"><output>'+r[s[0]]+'</output></label>').join('');
  $('eStats').querySelectorAll('input').forEach(i=>i.oninput=()=>{i.nextElementSibling.textContent=i.value;});
  $('eAb').innerHTML=Object.keys(ABIL).map(k=>'<option value="'+k+'"'+(k===r.ab?' selected':'')+'>'+ABIL[k].n+': '+ABIL[k].d+'</option>').join('');
  $('edit').hidden=false;$('menu').hidden=true;}
$('eCancel').onclick=()=>{$('edit').hidden=true;$('menu').hidden=false;};
$('eSave').onclick=()=>{const r=editing;r.name=($('eName').value.trim()||r.name).slice(0,18);$('eStats').querySelectorAll('input').forEach(i=>r[i.dataset.k]=+i.value);r.ab=$('eAb').value;r.abName=ABIL[r.ab].n;r.abDesc=ABIL[r.ab].d;saveRoster();$('edit').hidden=true;$('menu').hidden=false;buildMenu();};
function modeLbl(){$('modeBtn').textContent=MODE==='swipe'?'Swing: swipe (Pure Strike style)':'Swing: classic 3-click';}{const gb=$('gfxBtn'),gl=()=>{if(gb)gb.textContent=GFX==='ultra'?'Graphics: Ultra (glow, film grade, sharper)':'Graphics: Smooth (faster on older phones)';};gl();if(gb)gb.onclick=()=>{GFX=GFX==='ultra'?'smooth':'ultra';try{localStorage.setItem('dg-gfx2',GFX);}catch(e){}renderer.setPixelRatio(basePR()*DRS);setupFX();resize();gl();};}
modeLbl();$('modeBtn').onclick=()=>{MODE=MODE==='swipe'?'click':'swipe';try{localStorage.setItem('jp-swing-mode2',MODE);}catch(e){}modeLbl();};
buildMenu();
$('againBtn').onclick=()=>{if(ROUND&&state==='done'&&ROUND.k<ROUND.list.length-1){ROUND.k++;$('card').hidden=true;startHole();}else toRoster();};
$('quitBtn').onclick=toRoster;
{let arm=0;$('quitPill').onclick=()=>{const b=$('quitPill');if(!ROUND)return;if(!arm){arm=1;b.textContent='Tap again to quit';setTimeout(()=>{arm=0;b.textContent='Quit round';},2600);return;}arm=0;b.textContent='Quit round';toRoster();};}
let selC=window.COURSE_KEY,selLen='18';
function drawThumb(cv,C){const x=cv.getContext('2d'),W=cv.width,Hh=cv.height;const gc=C.f.filter(f=>f.k==='golf_course'||f.k==='driving_range');let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const f of gc)for(const q of f.p){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}if(C.box){[x0,y0,x1,y1]=C.box;}
  const rot=(y1-y0)>(x1-x0),cx=(x0+x1)/2,cy=(y0+y1)/2,ex=rot?y1-y0:x1-x0,ey=rot?x1-x0:y1-y0,s=Math.min(W/ex,Hh/ey)*.9;
  const P=q=>{const dx=q[0]-cx,dy=q[1]-cy;return rot?[W/2-dy*s,Hh/2-dx*s]:[W/2+dx*s,Hh/2-dy*s];};
  const path=p=>{x.beginPath();p.forEach((q,i)=>{const r=P(q);i?x.lineTo(r[0],r[1]):x.moveTo(r[0],r[1]);});};
  x.fillStyle='#0f2420';x.fillRect(0,0,W,Hh);
  const fill=(k,c)=>{x.fillStyle=c;for(const f of C.f)if(f.k===k&&f.c){path(f.p);x.closePath();x.fill();}};
  fill('golf_course','#24462c');fill('driving_range','#24462c');fill('fairway','#5f9a45');fill('tee','#78ab55');fill('green','#9fd46e');fill('bunker','#eadfb8');fill('water','#4b8aa0');
  x.setLineDash([3,4]);x.lineWidth=1.2;x.strokeStyle='rgba(255,255,255,.55)';for(const h of C.holes)if(h.main){path(h.p);x.stroke();}x.setLineDash([]);
  x.font='600 12px "Barlow Condensed",sans-serif';x.textAlign='center';x.textBaseline='middle';
  for(const h of C.holes)if(h.main){const r=P(h.p[0]);x.fillStyle='#f2c230';x.beginPath();x.arc(r[0],r[1],7,0,7);x.fill();x.fillStyle='#16302a';x.fillText(h.ref,r[0],r[1]+.5);}}
function buildCourses(){const w=$('cCards');w.innerHTML='';for(const k of Object.keys(COURSES)){const C=COURSES[k],b=document.createElement('button');b.className='cc';b.setAttribute('aria-pressed',String(k===selC));
    b.innerHTML='<canvas width="480" height="300"></canvas><div><h3></h3><div class="a"></div><div class="s"></div></div>';b.querySelector('h3').textContent=C.short;b.querySelector('.a').textContent=C.area;
    b.querySelector('.s').textContent='Par '+C.par+', '+C.yd.toLocaleString()+' yards, 18 holes';drawThumb(b.querySelector('canvas'),C);b.onclick=()=>{selC=k;buildCourses();};w.appendChild(b);}
  $('cLen').querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.v===selLen));b.onclick=()=>{selLen=b.dataset.v;buildCourses();};});
  $('cNote').textContent=selC===window.COURSE_KEY?'':COURSES[selC].short+' loads fresh when you tee off (a few seconds).';}
$('goBtn').onclick=()=>{if(!picked.size)return;$('menu').hidden=true;$('courses').hidden=false;buildCourses();};
$('cBack').onclick=()=>{$('courses').hidden=true;$('menu').hidden=false;};
$('cGo').onclick=()=>{try{localStorage.setItem('dg-course',selC);}catch(e){}
  if(selC===window.COURSE_KEY){newGame(selLen);return;}
  const b=JSON.stringify({c:selC,p:[...picked],len:selLen});try{sessionStorage.setItem('dg-boot',b);}catch(e){}
  $('cGo').disabled=true;$('cNote').textContent='Loading '+COURSES[selC].short+'…';try{location.hash='dg='+encodeURIComponent(b);}catch(e){}
  setTimeout(()=>{location.reload();},60);setTimeout(()=>{$('cGo').disabled=false;$('cNote').textContent='Couldn\u2019t switch automatically. Reload the page to load '+COURSES[selC].short+'.';},6000);};
function bootStart(){const B=window.BOOT;if(!B)return;picked.clear();(B.p||[]).forEach(id=>{if(picked.size<MAXP&&ROSTER.some(r=>r.id===id))picked.add(id);});buildMenu();if(!picked.size)return;$('menu').hidden=true;newGame(B.len||'18');}


/* ---------- impact FX: turf, divots, sand, gold sparks ---------- */
const FXP=(()=>{const mk=(add,cap)=>{const g=new THREE.BufferGeometry(),a=(n,s)=>new THREE.BufferAttribute(new Float32Array(cap*s),s);g.setAttribute('position',a(0,3));g.setAttribute('pc',a(0,3));g.setAttribute('ps',a(0,1));g.setAttribute('pa',a(0,1));g.setDrawRange(0,0);
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending,uniforms:{uScale:{value:500},uLin:LINQ},
   vertexShader:'attribute vec3 pc;attribute float ps,pa;varying vec3 vC;varying float vA;uniform float uScale;void main(){vC=pc;vA=pa;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(ps*uScale/-mv.z,1.5,90.);gl_Position=projectionMatrix*mv;}',
   fragmentShader:'varying vec3 vC;varying float vA;uniform float uLin;void main(){vec2 d=gl_PointCoord-.5;float r=dot(d,d)*4.;if(r>1.)discard;vec3 pc2=vC;if(uLin>.5)pc2=pow(pc2,vec3(2.2));gl_FragColor=vec4(pc2,vA*(1.-r*r));}'});
  const pts=new THREE.Points(g,m);pts.frustumCulled=false;pts.renderOrder=6;scene.add(pts);return{g,m,cap,list:[]};};return{n:mk(false,2000),a:mk(true,1200)};})();
function emit(k,o){const S=FXP[k];if(S.list.length<S.cap)S.list.push(o);}
function part(x,y,z,vx,vy,vz,life,size,c,grav,drag,fade,extra){return Object.assign({x,y,z,vx,vy,vz,life,age:0,size,c,grav,drag,fade},extra||{});}
const FXC={list:[],grp:new THREE.Group()};scene.add(FXC.grp);
const fxDirt=new THREE.MeshLambertMaterial({color:0x5a4128}),fxTurf=new THREE.MeshLambertMaterial({color:0x557f35}),fxScar=new THREE.MeshLambertMaterial({color:0x3b2c1b,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-6});
function divotChunk(p0,d3){const m=new THREE.Mesh(new THREE.BoxGeometry(.07,.018,.13),[fxDirt,fxDirt,fxTurf,fxDirt,fxDirt,fxDirt]);m.position.copy(p0);m.castShadow=true;m.rotation.y=Math.atan2(d3.x,d3.z);FXC.grp.add(m);
  const v=d3.clone().multiplyScalar(2.4+Math.random()*1.8);v.y=2+Math.random()*1.6;FXC.list.push({m,v,w:new THREE.Vector3(Math.random()*16-8,Math.random()*6-3,Math.random()*16-8),rest:false});}
function divotScar(x,y,dir){const g=new THREE.Group(),m=new THREE.Mesh(new THREE.CircleGeometry(1,18),fxScar);m.rotation.x=-Math.PI/2;m.scale.set(.045,.12,1);g.add(m);g.position.copy(V(x,y,H(x,y)+.004));g.rotation.y=Math.atan2(-Math.cos(dir),Math.sin(dir));FXC.grp.add(g);}
function strikeFX(){const pl=plan;if(!pl||pl.putt)return;const R=Math.random,x=pl.startX,y=pl.startY,o=V(x,y,H(x,y)+.02),dx=Math.cos(pl.dir),dy=Math.sin(pl.dir),d3=new THREE.Vector3(dx,0,-dy),sd=new THREE.Vector3(dy,0,dx),ty=pl.type,lie=pl.lie;
  if(lie==='bunker'){for(let i=0;i<260;i++){const v=d3.clone().multiplyScalar(1.2+R()*4.8).addScaledVector(sd,(R()-.5)*3.2);const sh=.85+R()*.2;emit('n',part(o.x+(R()-.5)*.2,o.y,o.z+(R()-.5)*.2,v.x,1.4+R()*4.6,v.z,.8+R()*.9,.03+R()*.045,[.94*sh,.86*sh,.66*sh],9.8,.5,false,{ground:true}));}
    for(let i=0;i<12;i++){const v=d3.clone().multiplyScalar(.4+R()*1.3).addScaledVector(sd,(R()-.5)*.8);emit('n',part(o.x,o.y+.15,o.z,v.x,.4+R()*.9,v.z,1.5+R()*.8,.35+R()*.35,[.9,.84,.68],-.15,1.1,true,{grow:2.4,a0:.32}));}}
  else if((ty==='iron'||ty==='wedge')&&lie!=='green'){const n=lie==='rough'?70:55;for(let i=0;i<n;i++){const g=R()<.5,v=d3.clone().multiplyScalar(.8+R()*3.6).addScaledVector(sd,(R()-.5)*1.8);
      emit('n',part(o.x,o.y,o.z,v.x,.9+R()*3.2,v.z,.8+R()*.7,g?.022+R()*.026:.018+R()*.02,g?[.3+R()*.12,.5+R()*.14,.18]:[.36,.26,.15],9.8,.8,false,{ground:true}));}
    if(lie!=='tee'){divotChunk(o.clone().addScaledVector(d3,.1),d3);divotScar(x+dx*.16,y+dy*.16,pl.dir);}}
  else if(lie==='rough'){for(let i=0;i<24;i++){const v=d3.clone().multiplyScalar(.6+R()*2).addScaledVector(sd,(R()-.5)*1.6);emit('n',part(o.x,o.y,o.z,v.x,.8+R()*2,v.z,.7+R()*.5,.018+R()*.02,[.32+R()*.1,.52+R()*.12,.2],9.8,.9,false,{ground:true}));}}
  if(pl.pure){for(let i=0;i<60;i++){const v=new THREE.Vector3(R()-.5,R()*.9,R()-.5).normalize().multiplyScalar(1.5+R()*3.5).addScaledVector(d3,2.2);emit('a',part(o.x,o.y+.03,o.z,v.x,v.y,v.z,.3+R()*.5,.008+R()*.013,[1,.78+R()*.1,.32],3.5,1.8,true));}}}
function flightSparks(b,d){if(!plan||!plan.pure)return;const R=Math.random,k=Math.max(1,d*.0038/.0214);for(let i=0;i<3;i++)emit('a',part(b.x+(R()-.5)*.02*k,b.y+(R()-.5)*.02*k,b.z+(R()-.5)*.02*k,(R()-.5)*1.4*k*.4,(R()-.2)*1.2*k*.4,(R()-.5)*1.4*k*.4,.35+R()*.45,(.012+R()*.016)*k,[1,.8+R()*.12,.35],1.2*k*.4,.8,true));}
function updFX(dt){const us=renderer.getPixelRatio()*innerHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)));
  for(const k of['n','a']){const S=FXP[k],L=S.list,at=S.g.attributes,P=at.position.array,C=at.pc.array,Z=at.ps.array,A=at.pa.array;S.m.uniforms.uScale.value=us;let n=0;
    for(let i=L.length-1;i>=0;i--){const q=L[i];q.age+=dt;if(q.age>q.life){L.splice(i,1);continue;}
      q.vy-=q.grav*dt;const dr=Math.exp(-q.drag*dt);q.vx*=dr;q.vy*=dr;q.vz*=dr;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;
      if(q.ground){const gy=H(q.x,-q.z)+.008;if(q.y<gy){q.y=gy;q.vx*=.2;q.vz*=.2;q.vy=0;}}
      const u=q.age/q.life,al=q.fade?(1-u)*(1-u):1-Math.max(0,(u-.7)/.3);
      P[n*3]=q.x;P[n*3+1]=q.y;P[n*3+2]=q.z;C[n*3]=q.c[0];C[n*3+1]=q.c[1];C[n*3+2]=q.c[2];Z[n]=q.size*(q.grow?1+u*q.grow:1);A[n]=al*(q.a0||1);n++;}
    S.g.setDrawRange(0,n);for(const nm in at)at[nm].needsUpdate=true;}
  for(const c of FXC.list){if(c.rest)continue;c.v.y-=9.8*dt;c.m.position.addScaledVector(c.v,dt);c.m.rotation.x+=c.w.x*dt;c.m.rotation.y+=c.w.y*dt;c.m.rotation.z+=c.w.z*dt;
    const gy=H(c.m.position.x,-c.m.position.z)+.01;if(c.m.position.y<gy&&c.v.y<0){c.m.position.y=gy;c.rest=true;c.m.rotation.set(Math.random()<.35?Math.PI:0,c.m.rotation.y,0);}}}
/* ---------- over the limit: dizzy loop over the head, and a blackout at 16 ---------- */
const DZ=(()=>{const g=new THREE.Group();g.visible=false;g.renderOrder=11;
  const starT=spriteTex(x=>{x.translate(32,32);const gr=x.createRadialGradient(0,0,0,0,0,30);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.beginPath();for(let i=0;i<10;i++){const r=i%2?9:30,a=i/10*Math.PI*2-Math.PI/2;x.lineTo(Math.cos(a)*r,Math.sin(a)*r);}x.closePath();x.fill();});
  const stars=[];for(let i=0;i<14;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:starT,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));g.add(s);stars.push(s);}
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.22,.009,8,64),new THREE.MeshBasicMaterial({transparent:true,opacity:.75,toneMapped:false,depthWrite:false}));ring.rotation.x=Math.PI/2;g.add(ring);
  const ring2=ring.clone();ring2.material=ring.material.clone();g.add(ring2);
  const lab=(t,fill,glow)=>{const c=document.createElement('canvas');c.width=640;c.height=150;const x=c.getContext('2d');x.font='700 92px "Barlow Condensed","Arial Narrow",sans-serif';x.textAlign='center';x.textBaseline='middle';x.shadowColor=glow;x.shadowBlur=26;x.lineWidth=10;x.strokeStyle='rgba(10,20,18,.85)';x.strokeText(t,320,78);x.fillStyle=fill;x.fillText(t,320,78);
    const tx=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthWrite:false,toneMapped:false}));s.scale.set(1.15,.27,1);g.add(s);return s;};
  const lw=lab('You’re wasted','#ffd54a','rgba(255,200,40,.9)'),lb=lab('BLACKOUT','#ff4466','rgba(255,40,90,1)');scene.add(g);return{g,stars,ring,ring2,lw,lb};})();
const _hp=new THREE.Vector3();
function updDizzy(now){const p=cur,on=!!(p&&p.av&&p.av.visible&&p.over>0&&state!=='menu');DZ.g.visible=on;if(!on)return;const bo=p.beers>=16,R=p.av.userData.rig;
  if(R&&R.skel)R.B.Head.getWorldPosition(_hp);else if(R&&R.head)R.head.getWorldPosition(_hp);else _hp.copy(p.av.position).add(new THREE.Vector3(0,1.6,0));
  DZ.g.position.set(_hp.x,_hp.y+(bo?.34:.28),_hp.z);const n=bo?14:6,spd=bo?6.5:2.6,rad=bo?.34:.22;
  DZ.stars.forEach((s,i)=>{s.visible=i<n;if(i>=n)return;const a=now*spd*(bo&&i%2?-1:1)+i/n*6.283,rr=rad*(bo?1+.25*Math.sin(now*5+i):1);s.position.set(Math.cos(a)*rr,.05*Math.sin(now*3+i)+(bo?.09*Math.sin(a*3):0),Math.sin(a)*rr);s.material.color.set(bo?(i%3===0?0xff3355:i%3===1?0xb26bff:0xff9a2e):0xffe27a);s.material.rotation=now*5+i;s.scale.setScalar(bo?.13+.03*Math.sin(now*9+i):.09);});
  DZ.ring.scale.setScalar(rad/.22);DZ.ring.material.color.set(bo?0xff3355:0xffe27a);DZ.ring.rotation.set(Math.PI/2+Math.sin(now*(bo?7:2))*(bo?.55:.15),Math.cos(now*(bo?5:1.5))*(bo?.4:.1),0);
  DZ.ring2.visible=bo;if(bo){DZ.ring2.scale.setScalar(rad/.22*1.35);DZ.ring2.material.color.set(0xb26bff);DZ.ring2.rotation.set(Math.PI/2+Math.cos(now*6)*.6,Math.sin(now*4)*.5,0);}
  DZ.lw.visible=!bo;DZ.lb.visible=bo;DZ.lw.position.y=.26+.02*Math.sin(now*3);DZ.lw.material.rotation=Math.sin(now*2.2)*.08;
  if(bo){DZ.lb.position.y=.36;DZ.lb.material.opacity=.7+.3*Math.sin(now*11);DZ.lb.material.rotation=Math.sin(now*6)*.12;DZ.lb.scale.set(1.2+.1*Math.sin(now*8),.29,1);}}
/* ---------- sound (Web Audio, synthesised) ---------- */
const SND=(()=>{let ac=null,out=null,on=true,noise=null;try{on=localStorage.getItem('dg-snd')!=='off';}catch(e){}
  function init(){if(ac){if(ac.state==='suspended')ac.resume();return;}try{ac=new(window.AudioContext||window.webkitAudioContext)();out=ac.createGain();out.gain.value=on?.9:0;out.connect(ac.destination);
    const n=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;noise=n;amb();}catch(e){ac=null;}}
  const nz=(t,dur,f,q,g,type)=>{const s=ac.createBufferSource();s.buffer=noise;const b=ac.createBiquadFilter();b.type=type||'bandpass';b.frequency.value=f;b.Q.value=q;const e=ac.createGain();e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(g,t+.002);e.gain.exponentialRampToValueAtTime(.0005,t+dur);s.connect(b);b.connect(e);e.connect(out);s.start(t,Math.random());s.stop(t+dur+.05);};
  const tone=(t,f0,f1,dur,g,type)=>{const o=ac.createOscillator();o.type=type||'sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);const e=ac.createGain();e.gain.setValueAtTime(0,t);e.gain.linearRampToValueAtTime(g,t+.003);e.gain.exponentialRampToValueAtTime(.0005,t+dur);o.connect(e);e.connect(out);o.start(t);o.stop(t+dur+.05);};
  function strike(type,pw,lie){if(!ac)return;if(ac.state==='suspended')ac.resume();const t=ac.currentTime+.005,k=Math.min(1.1,Math.max(.25,pw||.8));
    if(type==='driver'||type==='wood'){nz(t,.09,3200,1.1,.9*k);tone(t,2600,1900,.22,.16*k,'triangle');tone(t,5200,4100,.12,.05*k);nz(t,.03,900,.7,.5*k,'lowpass');}
    else if(type==='putter'){nz(t,.05,1500,4,.35*k);tone(t,1100,900,.06,.1*k);}
    else{nz(t,.045,4200,1.6,.8*k);tone(t,3400,3000,.05,.07*k);if(lie!=='tee'&&lie!=='green')nz(t+.01,.16,700,.8,.45*k,'lowpass');if(lie==='bunker')nz(t+.005,.35,2400,.5,.5);}}
  function land(l){if(!ac)return;const t=ac.currentTime;if(l==='bunker')nz(t,.18,1800,.6,.25);else if(l==='water'){nz(t,.35,900,.5,.4);tone(t,420,160,.25,.08);}else nz(t,.07,380,.9,.3,'lowpass');}
  function cup(){if(!ac)return;const t=ac.currentTime;for(let i=0;i<3;i++){nz(t+i*.07,.05,2300-i*200,5,.3-.07*i);tone(t+i*.07,1800-i*150,1500,.06,.07);}}
  function amb(){const s=ac.createBufferSource();s.buffer=noise;s.loop=true;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=420;const g=ac.createGain();g.gain.value=.035;const lfo=ac.createOscillator();lfo.frequency.value=.08;const lg=ac.createGain();lg.gain.value=.02;lfo.connect(lg);lg.connect(g.gain);s.connect(f);f.connect(g);g.connect(out);s.start();lfo.start();
    const bird=()=>{if(!ac)return;const t=ac.currentTime+.05,n=2+Math.floor(Math.random()*4),b=2600+Math.random()*1800;for(let i=0;i<n;i++)tone(t+i*.13,b,b*(1.25+Math.random()*.3),.09,.03);setTimeout(bird,5000+Math.random()*11000);};setTimeout(bird,3000);}
  function crack(sh){if(!ac)return;const t=ac.currentTime;nz(t,.05,6000,1.2,.5);nz(t+.03,sh?.5:.25,3000,.5,sh?.35:.18);}
  function gulp(){if(!ac)return;const t=ac.currentTime;tone(t,220,120,.12,.12);nz(t,.08,500,1,.12,'lowpass');}
  function toggle(){on=!on;try{localStorage.setItem('dg-snd',on?'on':'off');}catch(e){}if(out)out.gain.value=on?.9:0;return on;}
  return{init,strike,land,cup,toggle,crack,gulp,get on(){return on;}};})();
document.addEventListener('pointerdown',()=>SND.init());
{const sp=$('sndPill');if(sp){const sl=()=>{sp.textContent=SND.on?'Sound on':'Sound off';sp.setAttribute('aria-pressed',String(SND.on));};sl();sp.onclick=()=>{SND.init();SND.toggle();sl();};}}
/* ambient life: a few crows now and then, and the odd jet crossing the sky */
const FLY={birds:[],nextB:performance.now()/1000+10+Math.random()*12,plane:null,nextP:performance.now()/1000+22+Math.random()*25};
const crowM=new THREE.MeshLambertMaterial({color:0x121315}),crowW=new THREE.MeshLambertMaterial({color:0x121315,side:THREE.DoubleSide});
const crowWG=(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.1,.3,0,.12,.58,0,.02,.64,0,-.08,.3,0,-.14,0,0,-.12],3));g.setIndex([0,1,5,1,4,5,1,2,4,2,3,4]);g.computeVertexNormals();return g;})();
function mkCrow(){const g=new THREE.Group();const b=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),crowM);b.scale.set(1,.95,2.4);g.add(b);const h=new THREE.Mesh(new THREE.SphereGeometry(.078,8,6),crowM);h.position.set(0,.035,.31);g.add(h);
  const bk=new THREE.Mesh(new THREE.ConeGeometry(.026,.1,6),crowM);bk.rotation.x=Math.PI/2;bk.position.set(0,.025,.42);g.add(bk);const tl=new THREE.Mesh(new THREE.BoxGeometry(.17,.014,.22),crowM);tl.position.set(0,0,-.36);g.add(tl);
  const L=new THREE.Mesh(crowWG,crowW),R=new THREE.Mesh(crowWG,crowW);R.scale.x=-1;g.add(L,R);g.userData={L,R,ph:Math.random()*6.28,glide:Math.random()*6.28};return g;}
function spawnBirds(now){const n=3+Math.floor(Math.random()*5),fw=new THREE.Vector3();camera.getWorldDirection(fw);fw.y=0;if(fw.lengthSq()<1e-4)fw.set(0,0,-1);fw.normalize();const sd=new THREE.Vector3(-fw.z,0,fw.x),dir=Math.random()<.5?1:-1;
  const c=camera.position.clone().addScaledVector(fw,22+Math.random()*30).addScaledVector(sd,-dir*70);c.y+=7+Math.random()*9;const v=sd.clone().multiplyScalar(dir*(9+Math.random()*3)).addScaledVector(fw,(Math.random()-.5)*5);
  for(let i=0;i<n;i++){const b=mkCrow();b.position.copy(c).add(new THREE.Vector3((Math.random()-.5)*9,(Math.random()-.5)*3,(Math.random()-.5)*9));b.userData.v=v.clone().multiplyScalar(.88+Math.random()*.24);b.userData.t0=now;b.scale.setScalar(1.15);linearize(b);scene.add(b);FLY.birds.push(b);}}
function spawnPlane(now){const g=new THREE.Group(),m=new THREE.MeshLambertMaterial({color:0xd9dee4,fog:false}),dk=new THREE.MeshLambertMaterial({color:0x8b96a3,fog:false});
  const fu=new THREE.Mesh(new THREE.CylinderGeometry(2,2,36,12),m);fu.rotation.x=Math.PI/2;g.add(fu);const no=new THREE.Mesh(new THREE.SphereGeometry(2,12,8),m);no.scale.set(1,1,2.2);no.position.z=18;g.add(no);
  const tc=new THREE.Mesh(new THREE.ConeGeometry(2,8,12),m);tc.rotation.x=-Math.PI/2;tc.position.z=-22;g.add(tc);
  const wg=new THREE.Shape();wg.moveTo(0,5);wg.lineTo(18,-4);wg.lineTo(18,-6.5);wg.lineTo(0,-1.5);wg.lineTo(-18,-6.5);wg.lineTo(-18,-4);wg.lineTo(0,5);const wgG=new THREE.ExtrudeGeometry(wg,{depth:.5,bevelEnabled:false});wgG.rotateX(Math.PI/2);
  const w=new THREE.Mesh(wgG,m);w.position.set(0,-.8,2);g.add(w);const st=new THREE.Mesh(wgG,m);st.scale.set(.36,.36,.36);st.position.set(0,.6,-20);g.add(st);
  const fin=new THREE.Mesh(new THREE.BoxGeometry(.5,7,5),dk);fin.position.set(0,4.5,-20);fin.rotation.x=-.45;g.add(fin);
  for(const s of[-1,1]){const en=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.1,5,10),dk);en.rotation.x=Math.PI/2;en.position.set(s*7,-2.3,3);g.add(en);}
  if(Math.random()<.65){const c=document.createElement('canvas');c.width=4;c.height=256;const x=c.getContext('2d'),gr=x.createLinearGradient(0,0,0,256);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.75,'rgba(255,255,255,.5)');gr.addColorStop(.97,'rgba(255,255,255,.2)');gr.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=gr;x.fillRect(0,0,4,256);
    const tm=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,fog:false,side:THREE.DoubleSide});for(const s of[-1,1]){const tr=new THREE.Mesh(new THREE.PlaneGeometry(4,900),tm);tr.rotation.x=-Math.PI/2;tr.position.set(s*7,-2.3,-455);g.add(tr);}}
  const fw=new THREE.Vector3();camera.getWorldDirection(fw);fw.y=0;if(fw.lengthSq()<1e-4)fw.set(0,0,-1);fw.normalize();const sd=new THREE.Vector3(-fw.z,0,fw.x),dir=Math.random()<.5?1:-1;
  g.position.copy(camera.position).addScaledVector(fw,1300+Math.random()*900).addScaledVector(sd,-dir*2600);g.position.y=camera.position.y+520+Math.random()*380;
  g.userData={v:sd.clone().multiplyScalar(dir*150).addScaledVector(fw,(Math.random()-.5)*40),t0:now};g.lookAt(g.position.clone().add(g.userData.v));linearize(g);scene.add(g);FLY.plane=g;}
function updFly(dt,now){if(state!=='menu'){if(now>FLY.nextB&&!FLY.birds.length){spawnBirds(now);FLY.nextB=now+28+Math.random()*40;}if(now>FLY.nextP&&!FLY.plane){spawnPlane(now);FLY.nextP=now+50+Math.random()*60;}}
  for(let i=FLY.birds.length-1;i>=0;i--){const b=FLY.birds[i],u=b.userData,t=now-u.t0;b.position.addScaledVector(u.v,dt);b.position.y+=Math.sin(t*1.7+u.ph)*.02;b.lookAt(b.position.clone().add(u.v));
    const flap=(Math.sin(t*.9+u.glide)>-.35)?Math.sin(t*10.5+u.ph)*.75:.12;u.L.rotation.z=flap;u.R.rotation.z=-flap;
    if(t>18){scene.remove(b);FLY.birds.splice(i,1);}}
  if(FLY.plane){const p=FLY.plane;p.position.addScaledVector(p.userData.v,dt);if(now-p.userData.t0>40){scene.remove(p);FLY.plane=null;}}}
/* ---------- loop ---------- */
const camPos=new THREE.Vector3(0,40,40),camLook=new THREE.Vector3();let trailPts=[],last=performance.now()/1000;
function interp(pts,t){if(t<=pts[0].t)return pts[0];for(let i=1;i<pts.length;i++){if(pts[i].t>=t){const a=pts[i-1],b=pts[i],u=(t-a.t)/((b.t-a.t)||1);return{x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};}}return pts[pts.length-1];}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(COMP){COMP.setSize(w,h);GRADE.uniforms.uAsp.value=w/h;}}
function setupFX(){let vg=document.getElementById('vig');if(!vg){vg=document.createElement('div');vg.id='vig';vg.style.cssText='position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 46%,rgba(0,0,0,0) 56%,rgba(10,14,12,.26) 100%)';renderer.domElement.insertAdjacentElement('afterend',vg);}vg.style.display=GFX==='ultra'?'none':'block';COMP=null;GRADE=null;LINQ.value=0;if(GFX!=='ultra'||!THREE.EffectComposer||!THREE.UnrealBloomPass)return;
  try{const gl2=renderer.capabilities.isWebGL2,sz=renderer.getDrawingBufferSize(new THREE.Vector2()),RT=gl2&&THREE.WebGLMultisampleRenderTarget?THREE.WebGLMultisampleRenderTarget:THREE.WebGLRenderTarget;
    const rt=new RT(sz.x,sz.y,{type:gl2&&!MOBILE?THREE.HalfFloatType:THREE.UnsignedByteType,format:THREE.RGBAFormat});if(rt.samples!==undefined)rt.samples=MOBILE?2:4;
    COMP=new THREE.EffectComposer(renderer,rt);COMP.addPass(new THREE.RenderPass(scene,camera));COMP.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(sz.x/(MOBILE?4:2),sz.y/(MOBILE?4:2)),.3,.55,.83));
    GRADE=new THREE.ShaderPass({uniforms:{tDiffuse:{value:null},uT:{value:0},uAsp:{value:sz.x/sz.y}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform sampler2D tDiffuse;uniform float uT,uAsp;varying vec2 vUv;vec3 toS(vec3 c){c=max(c,vec3(0.));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}float hs(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}\n'+
        'void main(){vec3 c=toS(texture2D(tDiffuse,vUv).rgb);float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.1);c=(c-.5)*1.07+.5;c*=mix(vec3(.97,.99,1.03),vec3(1.03,1.01,.97),smoothstep(.2,.9,l));'+
        'vec2 q=vUv-.5;q.x*=uAsp;c*=1.-.24*smoothstep(.4,1.05,length(q));c+=(hs(vUv*vec2(1733.,977.)+uT)-.5)*.016;gl_FragColor=vec4(clamp(c,0.,1.),1.);}'});
    COMP.addPass(GRADE);LINQ.value=1;}catch(e){console.warn('fx',e);COMP=null;GRADE=null;LINQ.value=0;}}
addEventListener('resize',resize);resize();
let PACE=1,paceSkip=false,paceT=0,paceN=0,paceAcc=0,paceSlow=0,paceHole=-1;
function pacing(ts){/* measure only while running every frame; decide over ~2.5 s windows */
  if(!MOBILE)return true;if(ROUND&&ROUND.k!==paceHole){paceHole=ROUND.k;PACE=1;paceN=0;paceAcc=0;paceSlow=0;}
  if(PACE===2){paceSkip=!paceSkip;return !paceSkip;}
  if(paceT){const d=ts-paceT;if(d<200){paceN++;paceAcc+=d;if(d>20.5)paceSlow++;}}paceT=ts;
  if(paceN>=150){const avg=paceAcc/paceN,slow=paceSlow/paceN;if(avg>18.5||slow>.22)PACE=2;paceN=0;paceAcc=0;paceSlow=0;}return true;}
function frame(ts){requestAnimationFrame(frame);if(!pacing(ts||performance.now()))return;try{frameInner();}catch(e){dgErr(e,'frame');}try{watchdog(performance.now()/1000);}catch(e){}}

let OVH_ON=false;
function overheadMode(on){if(on===OVH_ON)return;OVH_ON=on;try{if(tufts)tufts.visible=!on;renderer.shadowMap.autoUpdate=!on;renderer.shadowMap.needsUpdate=true;
  renderer.setPixelRatio(basePR()*DRS*(on?(MOBILE?.78:.88):1));resize();}catch(e){}}
function frameInner(){overheadMode(!!(overhead&&state==='aim'));const now=performance.now()/1000,rawDt=now-last,dt=Math.min(.05,rawDt);last=now;if(rawDt<.25){FT=FT*.92+rawDt*1000*.08;if(now>DRSnext){if(FT>21&&DRS>.6&&(!COMP||DRS>.85)){DRS=Math.max(.6,DRS-(COMP?.15:.1));renderer.setPixelRatio(basePR()*DRS);resize();DRSnext=now+(COMP?12:1.5);}else if(FT<14.5&&DRS<1&&!COMP){DRS=Math.min(1,DRS+.05);renderer.setPixelRatio(basePR()*DRS);resize();DRSnext=now+3;}}}
  let want=null,look=null;const fly=now<flyUntil;
  const p=cur;
  if(state==='menu'){const a=now*.05,cx=PIN.x-60,cy=PIN.y+140;want=V(cx+Math.cos(a)*160,cy+Math.sin(a)*160,90);look=V(cx,cy,0);}
  else if(p&&(state==='aim'||state==='s1'||state==='s2'||state==='sw'||state==='done')){const dx=Math.cos(p.aim),dy=Math.sin(p.aim),z=H(p.x,p.y),pt=CLUBS[p.club].putt;
    if(state==='s1'||state==='sw')applyPose(p.av,swingPose('back',1,swingU,!!pt),clubType(p.club));else if(state==='s2')applyPose(p.av,swingPose('back',1,swingPow,!!pt),clubType(p.club));
    if(state==='aim'&&p.intro&&now<p.intro){const P=p.av.position,k=p.look.tall||1,fx=Math.sin(p.aim),fz=Math.cos(p.aim),tx=Math.cos(p.aim),tz=-Math.sin(p.aim),Rg=p.av.userData.rig,hp=Rg&&Rg.B&&Rg.B.Head?Rg.B.Head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(fx*.06,.06,fz*.06)):new THREE.Vector3(P.x+fx*.28,P.y+1.5*k,P.z+fz*.28);
      const dx=fx*.86+tx*.5,dz=fz*.86+tz*.5,dl=Math.hypot(dx,dz)||1;want=new THREE.Vector3(hp.x+dx/dl*1.35,hp.y+.06,hp.z+dz/dl*1.35);look=hp.clone();}
    else if(overhead&&state==='aim'){const d=dist(p),mx=(p.x+PIN.x)/2,my=(p.y+PIN.y)/2;want=V(mx-dx*d*.25,my-dy*d*.25,z+Math.max(25,d*.85));look=V(mx,my,z);}
    else if(pt){want=V(p.x-dx*4.4,p.y-dy*4.4,z+1.75);look=V(p.x+dx*4,p.y+dy*4,z);}
    else{want=V(p.x-dx*7.5,p.y-dy*7.5,z+2.1);look=V(p.x+dx*40,p.y+dy*40,H(p.x+dx*40,p.y+dy*40)+1.2);}}
  else if(p&&(state==='flight'||state==='result')&&plan){
    const t=now-flightT0,pos=state==='flight'?interp(plan.pts,Math.max(0,t)):interp(plan.pts,1e9);placeBall(p,pos.x,pos.y,pos.z);
    if(state==='flight'&&t>0){if(!plan.landSnd&&!plan.putt&&plan.club&&t>=plan.club.T*TS*(.5+.5*Math.min(1,swingPow))){plan.landSnd=1;SND.land(lieAt(pos.x,pos.y));}if(t<2.6)flightSparks(p.ball.b.position,camera.position.distanceTo(p.ball.b.position));trailPts.push(V(pos.x,pos.y,pos.z));if(trailPts.length>690)trailPts.shift();setRibbon(trailPts);}
    else if(state==='result'&&trailPts.length>1)setRibbon(trailPts);
    const dx=Math.cos(plan.dir),dy=Math.sin(plan.dir),lastT=plan.pts[plan.pts.length-1].t,land=plan.pts.length>1?plan.pts[Math.min(plan.pts.length-1,111)]:pos;
    if(plan.putt){want=V(plan.startX-dx*3.2,plan.startY-dy*3.2,H(plan.startX,plan.startY)+1.6);look=V(pos.x,pos.y,pos.z);}
    else{const TT=plan.club.T*TS;if(!plan.cam)plan.cam={};
      if(plan.carry<=45||t<Math.min(1.15,TT*.32)){want=V(pos.x-dx*12,pos.y-dy*12,pos.z+4.5);look=V(pos.x+dx*10,pos.y+dy*10,pos.z);}
      else{if(!plan.cam.p){const appr=Math.hypot(land.x-PIN.x,land.y-PIN.y)<45&&plan.carry>40;plan.cam.snap=1;
          if(appr){const gx=PIN.x-dx*7-dy*15,gy=PIN.y-dy*7+dx*15;plan.cam.p=V(gx,gy,H(gx,gy)+1.7);}else{const lx=land.x+dx*24-dy*12,ly=land.y+dy*24+dx*12;plan.cam.p=V(lx,ly,H(lx,ly)+5.5);}}
        want=plan.cam.p.clone();look=V(pos.x,pos.y,pos.z);}}
    if(state==='flight'&&t>lastT+.25)finishShot();}
  if(state==='replay'&&RP){const R0=RP,r=R0.r,t=(now-R0.t0)*R0.sp,pos=interp(r.pts,t),lastT=r.pts[r.pts.length-1].t,dx=Math.cos(r.dir),dy=Math.sin(r.dir);placeBall(R0.p,pos.x,pos.y,pos.z);
    R0.trail.push(V(pos.x,pos.y,pos.z));if(R0.trail.length>690)R0.trail.shift();if(!r.putt)setRibbon(R0.trail);
    if(r.putt){const bx=PIN.x-dx*1.8-dy*1.6,by=PIN.y-dy*1.8+dx*1.6;want=V(bx,by,H(bx,by)+.45);look=V(pos.x,pos.y,pos.z);}
    else{const u=Math.min(1,t/Math.max(.1,r.club?r.club.T*TS:2));const side=10+Math.min(26,r.carry*.09);want=V(pos.x-dx*(9-7*u)-dy*side,pos.y-dy*(9-7*u)+dx*side,pos.z+2.2+2*u);look=V(pos.x+dx*2,pos.y+dy*2,pos.z);}
    if(t>lastT+.9)endReplay();}
  if(swingAnim&&p){const A=swingAnim,t=now-A.t0,ft=A.ft||(A.putt?.7:.8);if(!A.hit&&t>=A.ds){A.hit=1;try{strikeFX();SND.strike(A.type,A.pw,plan&&plan.lie);}catch(e){console.warn(e);}}const S=t<A.ds?swingPose('down',t/A.ds,A.pw,A.putt):swingPose('thru',(t-A.ds)/ft,A.pw,A.putt);applyPose(p.av,S,A.type);if(t>A.ds+ft+2.5)swingAnim=null;}
  const wob=p&&p.over?1+Math.min(.9,p.over*.35)*Math.sin(now*9.3)*Math.sin(now*3.1+1):1;
  if(state==='s1'){swingU+=dt*(p&&CLUBS[p.club].putt?.75:1.0)*wob;if(swingU>=1.1){swingU=1.1;swingPow=1.1;state='s2';}updMeter();}
  else if(state==='s2'){swingU-=dt*1.45*wob;if(swingU<-.15){swingU=-.15;fire(-.15);}updMeter();}
  else if(state==='flight')updMeter();
  if(fly){const u=Math.min(1,(now-flyStart)/(flyUntil-flyStart)),e=u*u*(3-2*u),L=HOLE_LEN,a=plAt(H1,e*L*.92),b=plAt(H1,Math.min(L,e*L*.92+70));want=V(a.x-a.tx*25,a.y-a.ty*25,H(a.x,a.y)+38-e*16);look=V(b.x,b.y,H(b.x,b.y)+2);}
  if(want&&look&&!fly&&state!=='menu'){for(let i=0;i<14;i++){if(!treeHit(want.x,-want.z,want.y))break;want.lerp(look,.12);want.y+=.35;}}
  if(want){const k=1-Math.exp(-dt*(fly?6:state==='flight'?4:3));if(state==='replay'&&RP&&!RP.snapped){camPos.copy(want);camLook.copy(look);RP.snapped=1;}else if(state==='replay'){camPos.lerp(want,Math.min(1,k*2.2));camLook.lerp(look,Math.min(1,k*3));}else if(plan&&plan.cam&&plan.cam.snap&&state==='flight'){camPos.copy(want);camLook.copy(look);plan.cam.snap=0;}else{camPos.lerp(want,k);camLook.lerp(look,plan&&plan.cam&&plan.cam.p&&state!=='aim'?Math.min(1,k*2.5):k);}}
  camera.position.copy(camPos);camera.lookAt(camLook);if(cur&&cur.av){const t=cur.av.position;sun.target.position.copy(t);sun.position.copy(t).add(SUNOFF);}if(p&&p.over&&state!=='flight')camera.rotateZ(Math.sin(now*1.3)*.025*Math.min(3,p.over));
  // wind arrow relative to view
  const fx=camLook.x-camPos.x,fy=-(camLook.z-camPos.z),cf=Math.atan2(fy,fx);$('wArrow').style.transform='rotate('+((cf-wind.a)*180/Math.PI)+'deg)';
  flagG.rotation.y=wind.a;try{animFlag(now);}catch(e){}
  sky.position.copy(camera.position);skyMat.uniforms.t.value=now;WT.value=now;scaleBalls();updFly(dt,now);updFX(dt);updDizzy(now);updPuttGrid(dt);try{updBeer(now);}catch(e){console.warn('beer',e);BEERA=null;}try{updOcc();updTerrain();}catch(e){}if(COMP){GRADE.uniforms.uT.value=now%10;COMP.render();}else renderer.render(scene,camera);}
{const L=c=>new THREE.MeshLambertMaterial({color:c});
 for(const c of CLUBH){const sh=new THREE.Shape(c.p.map(q=>new THREE.Vector2(q[0],q[1])));const base=Math.min(...c.p.map(q=>H(q[0],q[1])))-.5;
   const wall=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:5.5,bevelEnabled:false}),L(0xb9ad98));wall.geometry.rotateX(-Math.PI/2);wall.position.y=base;scene.add(wall);
   const roof=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.6,bevelEnabled:true,bevelSize:.8,bevelThickness:.3,bevelSegments:1}),L(0x4a4f52));roof.geometry.rotateX(-Math.PI/2);roof.position.y=base+5.5;scene.add(roof);}
}
let teeDeco=null;
function placeTeeDeco(){const L=c=>new THREE.MeshLambertMaterial({color:c});if(teeDeco)scene.remove(teeDeco);const G=teeDeco=new THREE.Group();
 const t0=H1[0],t1=plAt(H1,20),px=-t1.ty,py=t1.tx;
 for(const s of[-1,1]){const x=t0[0]+px*s*4+t1.tx*1.5,y=t0[1]+py*s*4+t1.ty*1.5;const mk=new THREE.Mesh(new THREE.SphereGeometry(.13,16,12),L(0x2f6fd0));mk.position.copy(V(x,y,H(x,y)+.1));G.add(mk);}
 {const x=t0[0]-px*7-t1.tx*3,y=t0[1]-py*7-t1.ty*3,z=H(x,y);const post=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1,8),L(0x2d2d2d));post.position.copy(V(x,y,z+.5));G.add(post);const bw=new THREE.Mesh(new THREE.BoxGeometry(.22,.3,.14),L(0x1f5a3a));bw.position.copy(V(x,y,z+1.05));G.add(bw);
  const bx=x-t1.tx*2.5,by=y-t1.ty*2.5,bz=H(bx,by),bench=new THREE.Group(),wd=L(0x7a5534);const seat=new THREE.Mesh(new THREE.BoxGeometry(1.6,.06,.4),wd);seat.position.y=.45;bench.add(seat);const back=new THREE.Mesh(new THREE.BoxGeometry(1.6,.35,.05),wd);back.position.set(0,.75,-.18);bench.add(back);for(const s of[-.7,.7]){const lg=new THREE.Mesh(new THREE.BoxGeometry(.06,.45,.4),L(0x2d2d2d));lg.position.set(s,.22,0);bench.add(lg);}bench.position.copy(V(bx,by,bz));bench.rotation.y=Math.atan2(t1.tx,t1.ty)+Math.PI;G.add(bench);}
  scene.add(G);linearize(G);}
setHole(0);linearize(scene);camLook.copy(V(PIN.x,PIN.y,0));

function applyTOD(){const g=TOD==='gold';WARM.value=g?1:0;sun.color.set(g?0xffb574:0xffeccf);sun.intensity=g?1.6:1.95;SUNOFF.set(g?-26:-15.4,g?10:23,g?18:11.5);HEMI.color.set(g?0xf0cfa8:0xd3dae2);HEMI.groundColor.set(g?0x5a5234:0x485a36);HEMI.intensity=g?.56:.62;
  scene.fog.color.set(g?0xd9b48e:SKY);renderer.toneMappingExposure=g?.9:.95;const tb=$('todBtn');if(tb)tb.textContent=g?'Tee time: Golden hour':'Tee time: Midday';}
{const tb=$('todBtn');if(tb)tb.onclick=()=>{TOD=TOD==='gold'?'mid':'gold';try{localStorage.setItem('dg-tod',TOD);}catch(e){}applyTOD();};}
applyTOD();setupFX();try{const wc=mkCrow();wc.position.set(0,-900,0);scene.add(wc);const fp=FLY.plane;spawnPlane(0);const wp=FLY.plane;FLY.plane=fp;renderer.compile(scene,camera);scene.remove(wc);if(wp)scene.remove(wp);}catch(e){console.warn('warm',e);}requestAnimationFrame(frame);
{let done=false;const fin=()=>{if(done)return;done=true;const e=getEnv();if(e)scene.environment=e;const l=$('load');if(l)l.remove();window.DG_READY=true;document.dispatchEvent(new Event('dg-ready'));try{bootStart();}catch(err){console.warn(err);}};
 Promise.all([skyReady,loadBodies().then(loadHair)]).then(fin,fin);setTimeout(fin,20000);}
},120);
