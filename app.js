import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";

const canvas=document.querySelector("#cityCanvas");
const stage=document.querySelector(".stage");
const loader=document.querySelector("#loader");
const miniMap=document.querySelector("#miniMapCanvas");
const mapCtx=miniMap.getContext("2d");
const mapStatus=document.querySelector("#mapStatus");
const pop=document.querySelector("#landmarkPop");
const popArea=document.querySelector("#popArea");
const popTitle=document.querySelector("#popTitle");
const popText=document.querySelector("#popText");
const storyTitle=document.querySelector("#storyTitle");
const storyText=document.querySelector("#storyText");
const storyProgress=document.querySelector("#storyProgress");
const nextStoryLabel=document.querySelector("#nextStoryLabel");
const storyCard=document.querySelector("#storyCard");

const GEO={
  "Central Shaheed Minar":{lat:23.72721,lon:90.39664},
  "Curzon Hall":{lat:23.72738,lon:90.40193},
  "Ahsan Manzil":{lat:23.70855,lon:90.40615},
  "Jatiya Sangsad Bhaban":{lat:23.76231,lon:90.37873},
  "Baitul Mukarram":{lat:23.72949,lon:90.41262}
};
const CENTER={lat:23.730188,lon:90.399214};
const SCALE=.0026;
const METERS_LAT=111320;
const METERS_LON=111320*Math.cos(THREE.MathUtils.degToRad(CENTER.lat));
function geoToScene(lat,lon){
  return new THREE.Vector3((lon-CENTER.lon)*METERS_LON*SCALE,0,-(lat-CENTER.lat)*METERS_LAT*SCALE);
}
Object.values(GEO).forEach(v=>Object.assign(v,{p:geoToScene(v.lat,v.lon)}));

const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0xcbdce2,.017);
const camera=new THREE.PerspectiveCamera(40,1,.1,180);
camera.position.set(.5,5.8,12.8);

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setClearColor(0xc6dce5,1);

const controls=new OrbitControls(camera,canvas);
controls.enableDamping=true;
controls.dampingFactor=.075;
controls.enablePan=false;
controls.rotateSpeed=.55;
controls.zoomSpeed=.70;
controls.minDistance=4.5;
controls.maxDistance=31;
controls.minPolarAngle=Math.PI*.16;
controls.maxPolarAngle=Math.PI*.48;
controls.target.set(.3,.8,1.6);

const sky=new Sky(); sky.scale.setScalar(450000); scene.add(sky);
const su=sky.material.uniforms;
su.turbidity.value=8.2; su.rayleigh.value=1.25; su.mieCoefficient.value=.006; su.mieDirectionalG.value=.80;
const sunVec=new THREE.Vector3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(53),THREE.MathUtils.degToRad(142));
su.sunPosition.value.copy(sunVec);

scene.add(new THREE.HemisphereLight(0xf8fbff,0x55634c,1.55));
const sunlight=new THREE.DirectionalLight(0xffedcf,3.8);
sunlight.position.set(-8,15,8); sunlight.castShadow=true; sunlight.shadow.mapSize.set(1024,1024);
sunlight.shadow.camera.left=-18; sunlight.shadow.camera.right=18; sunlight.shadow.camera.top=18; sunlight.shadow.camera.bottom=-18; sunlight.shadow.bias=-.0003;
scene.add(sunlight);
const fill=new THREE.DirectionalLight(0xb7d7ff,.75); fill.position.set(9,7,-10); scene.add(fill);

const world=new THREE.Group(); scene.add(world);
const clickable=[],landmarks=[],animatedVehicles=[],walkers=[];
let activeIndex=-1,walkMode=false,walkT=0,focusCamera=null,focusTarget=null;

function mat(color,rough=.76,metal=.02){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal})}
function box(w,h,d,color,rough=.76){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,rough));m.castShadow=true;m.receiveShadow=true;return m;
}
function cyl(rt,rb,h,color,seg=18,rough=.76){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat(color,rough));m.castShadow=true;m.receiveShadow=true;return m;
}
function sphere(r,color,seg=14){const m=new THREE.Mesh(new THREE.SphereGeometry(r,seg,Math.max(8,seg/2)),mat(color,.84));m.castShadow=true;return m}
function plane(w,d,material){const p=new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);p.rotation.x=-Math.PI/2;p.receiveShadow=true;return p}
function win(w,h,color=0x49636d){return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({color,roughness:.22,metalness:.14}))}

function ground(){
  const p=plane(25,28,mat(0x718b5e,.96)); p.position.y=-.01; world.add(p);
  const river=plane(25,3.8,new THREE.MeshPhysicalMaterial({color:0x557f8a,roughness:.18,metalness:.02,clearcoat:.45}));
  river.position.set(0,.005,8.25); world.add(river);
  const bank=plane(25,.45,mat(0xb9aa88,.90)); bank.position.set(0,.012,6.30); world.add(bank);
}

function roadFallback(){
  const roads=[
    [[-7,-9],[-4,-5],[-1,0],[2,4],[5,7]],
    [[-5,-8],[-2,-5],[1,-2],[4,0],[7,2]],
    [[-6,2],[-2,1],[2,0],[6,-1]],
    [[-4,6],[-1,4],[2,2],[5,0]]
  ];
  roads.forEach(points=>addRoadPolyline(points,.24));
}
function addRoadPolyline(points,width=.22){
  const verts=[],inds=[]; let vi=0;
  for(let i=0;i<points.length-1;i++){
    const a=new THREE.Vector2(points[i][0],points[i][1]),b=new THREE.Vector2(points[i+1][0],points[i+1][1]);
    const d=b.clone().sub(a); const len=d.length(); if(len<.001)continue; d.multiplyScalar(1/len);
    const n=new THREE.Vector2(-d.y,d.x).multiplyScalar(width/2);
    const q=[a.clone().add(n),a.clone().sub(n),b.clone().sub(n),b.clone().add(n)];
    q.forEach(v=>verts.push(v.x,.025,v.y));
    inds.push(vi,vi+1,vi+2,vi,vi+2,vi+3); vi+=4;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));g.setIndex(inds);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mat(0x303538,.91));mesh.receiveShadow=true;world.add(mesh);return mesh;
}
function widthFor(highway){
  if(highway==="trunk"||highway==="primary")return .32;
  if(highway==="secondary")return .27;
  return .21;
}
async function loadRealRoads(){
  const bbox="23.7018,90.3715,23.7690,90.4195";
  const query='[out:json][timeout:18];way["highway"~"^(trunk|primary|secondary|tertiary)$"]('+bbox+');out geom;';
  try{
    const res=await fetch("https://overpass-api.de/api/interpreter?data="+encodeURIComponent(query));
    if(!res.ok)throw new Error("map");
    const data=await res.json();
    const roads=data.elements.filter(e=>e.geometry&&e.geometry.length>1);
    roads.forEach(r=>{
      const pts=r.geometry.map(p=>{const v=geoToScene(p.lat,p.lon);return[v.x,v.z]});
      addRoadPolyline(pts,widthFor(r.tags?.highway));
    });
    drawMiniMap(roads);
    mapStatus.textContent="REAL";
  }catch(e){
    roadFallback(); drawMiniMap([]); mapStatus.textContent="FALLBACK";
  }
}

function drawMiniMap(roads){
  const w=miniMap.width,h=miniMap.height;
  mapCtx.clearRect(0,0,w,h); mapCtx.fillStyle="#e7ece4"; mapCtx.fillRect(0,0,w,h);
  const xs=[],zs=[];
  Object.values(GEO).forEach(g=>{xs.push(g.p.x);zs.push(g.p.z)});
  const minX=Math.min(...xs)-1,maxX=Math.max(...xs)+1,minZ=Math.min(...zs)-1,maxZ=Math.max(...zs)+1;
  const mapP=p=>[(p.x-minX)/(maxX-minX)*w,(p.z-minZ)/(maxZ-minZ)*h];
  mapCtx.strokeStyle="#7d8bb0";mapCtx.lineCap="round";
  roads.forEach(r=>{
    const pts=r.geometry.map(p=>geoToScene(p.lat,p.lon));
    if(!pts.length)return;
    mapCtx.beginPath();pts.forEach((p,i)=>{const [x,y]=mapP(p);i?mapCtx.lineTo(x,y):mapCtx.moveTo(x,y)});
    mapCtx.lineWidth=r.tags?.highway==="primary"?5:r.tags?.highway==="secondary"?4:3;mapCtx.stroke();
  });
  Object.entries(GEO).forEach(([name,g])=>{
    const [x,y]=mapP(g.p);
    mapCtx.beginPath();mapCtx.fillStyle="#ffdc54";mapCtx.strokeStyle="#243dba";mapCtx.lineWidth=3;mapCtx.arc(x,y,6,0,Math.PI*2);mapCtx.fill();mapCtx.stroke();
  });
}

function tree(x,z,s=.75){const g=new THREE.Group();const tr=cyl(.045,.07,.58,0x6c4c39,9,.9);tr.position.y=.29;g.add(tr);
  [[-.14,.74,.20],[.12,.78,.23],[0,.95,.20],[.24,.88,.17],[-.23,.87,.16]].forEach((v,i)=>{const f=sphere(v[2],i%2?0x4f7a43:0x406d3c,12);f.position.set(v[0],v[1],0);g.add(f)});
  g.scale.setScalar(s);g.position.set(x,0,z);world.add(g);return g}
function lamp(x,z){const g=new THREE.Group();const p=cyl(.014,.02,.74,0x454b4c,7,.55);p.position.y=.37;const hd=box(.14,.035,.06,0x505759,.55);hd.position.set(.05,.74,0);g.add(p,hd);g.position.set(x,0,z);world.add(g)}

function apartment(x,z,w,d,floors,body,rot=0){
  const g=new THREE.Group(),fh=.37,h=floors*fh;
  const shell=box(w,h,d,body,.82);shell.position.y=h/2;g.add(shell);
  const base=box(w+.05,.10,d+.05,0x8d8a82,.92);base.position.y=.05;g.add(base);
  for(let f=0;f<floors;f++){const y=.20+f*fh;const cols=Math.max(2,Math.floor(w/.34));
    for(let c=0;c<cols;c++){const px=-w*.36+(cols===1?0:c*w*.72/(cols-1));const ww=win(.13,.17);ww.position.set(px,y,d/2+.006);g.add(ww)}
  }
  const tank=cyl(.10,.12,.15,0x777d7d,12,.6);tank.position.set(w*.24,h+.08,-d*.16);g.add(tank);
  const ac=box(.16,.10,.10,0xd4d3cb,.75);ac.position.set(-w*.25,h+.05,d*.15);g.add(ac);
  g.position.set(x,0,z);g.rotation.y=rot;world.add(g);return g
}

function register(g,data){g.userData.info=data;g.userData.index=landmarks.length;landmarks.push(g);g.traverse(o=>{if(o.isMesh){o.userData.landmarkRoot=g;clickable.push(o)}});return g}

function shaheed(p){
  const g=new THREE.Group(),white=0xf7f6f0;
  const plaza=box(2.3,.08,1.20,0xe8e5dc,.92);plaza.position.y=.04;g.add(plaza);
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.05,40),mat(0xc93432,.62));disc.rotation.x=Math.PI/2;disc.position.set(0,1.02,-.06);g.add(disc);
  [1.16,1.36,1.62,1.36,1.16].forEach((h,i)=>{const x=(i-2)*.25;const l=box(.05,h,.07,white,.84);l.position.set(x-.05,h/2+.16,0);l.rotation.z=.055;const r=box(.05,h,.07,white,.84);r.position.set(x+.05,h/2+.16,0);r.rotation.z=-.055;const cap=box(.16,.05,.07,white,.84);cap.position.set(x,h+.16,0);g.add(l,r,cap)});
  g.position.copy(p);world.add(g);return register(g,{area:"DHAKA UNIVERSITY AREA",title:"Central Shaheed Minar",text:"Placed at its real Dhaka coordinates, with the white columns, red disc and memorial plaza kept prominent."})
}
function curzon(p){
  const g=new THREE.Group(),brick=0x9b4937,brick2=0xb76047,cream=0xe4bd92;
  const b=box(2.25,.72,.88,brick,.82);b.position.y=.47;const c=box(.62,.98,.94,brick2,.80);c.position.y=.60;g.add(b,c);
  [-.75,-.36,.36,.75].forEach(x=>{const t=cyl(.08,.11,.82,brick2,14,.78);t.position.set(x,.53,.28);const cap=new THREE.Mesh(new THREE.ConeGeometry(.12,.26,14),mat(cream,.74));cap.position.set(x,1.07,.28);g.add(t,cap)});
  for(let x=-.78;x<=.78;x+=.39){const w=win(.14,.20,0x425d66);w.position.set(x,.40,.446);g.add(w)}
  g.position.copy(p);g.rotation.y=.10;world.add(g);return register(g,{area:"DHAKA UNIVERSITY",title:"Curzon Hall",text:"Positioned from its real map coordinate, just east of Shaheed Minar as in Dhaka."})
}
function ahsan(p){
  const g=new THREE.Group(),pink=0xd67c90,pink2=0xe59aae,cream=0xf0d7c1;
  const base=box(2.55,.16,1.12,0xc98a90,.86);base.position.y=.08;const body=box(1.60,.82,.84,pink,.80);body.position.y=.57;const L=box(.58,.64,.80,pink2,.80);L.position.set(-1.0,.49,0);const R=L.clone();R.position.x=1.0;g.add(base,body,L,R);
  for(let x=-.55;x<=.55;x+=.22){const col=cyl(.03,.04,.55,cream,12,.78);col.position.set(x,.50,.50);g.add(col)}
  const drum=cyl(.26,.28,.17,pink2,28,.76);drum.position.y=1.06;const dome=new THREE.Mesh(new THREE.SphereGeometry(.31,28,16,0,Math.PI*2,0,Math.PI/2),mat(pink2,.70));dome.position.y=1.15;g.add(drum,dome);
  g.position.copy(p);world.add(g);return register(g,{area:"OLD DHAKA · BURIGANGA",title:"Ahsan Manzil",text:"Placed at its real position in Old Dhaka beside the Buriganga, south of the university area."})
}
function sangsad(p){
  const g=new THREE.Group(),con=0xbab7ad,con2=0xc9c5bb,dark=0x41545a;
  const pool=plane(3.6,2.8,new THREE.MeshPhysicalMaterial({color:0x638f9b,roughness:.18,clearcoat:.42}));pool.position.y=.015;g.add(pool);
  const island=box(2.4,.14,1.75,0xaaa79f,.90);island.position.y=.08;const cen=box(1.08,1.38,1.12,con,.80);cen.position.y=.78;const L=box(.48,.98,1.18,con2,.80);L.position.set(-.86,.57,0);const R=L.clone();R.position.x=.86;g.add(island,cen,L,R);
  [[-.31,.86,.57,.18],[.31,.86,.57,.18],[0,.46,.57,.23],[0,1.20,.57,.15]].forEach(v=>{const r=new THREE.Mesh(new THREE.TorusGeometry(v[3],.043,10,30),mat(dark,.58));r.position.set(v[0],v[1],v[2]);g.add(r)});
  g.position.copy(p);g.rotation.y=.18;world.add(g);return register(g,{area:"SHER-E-BANGLA NAGAR",title:"Jatiya Sangsad Bhaban",text:"Placed north-west of central Dhaka at its real geographic position, not moved just to fit the scene."})
}
function baitul(p){
  const g=new THREE.Group(),light=0xeeeae1,green=0x385d51,stone=0xc6c1b7;
  const plaza=box(1.58,.10,1.40,stone,.90);plaza.position.y=.05;const cube=box(.95,1.18,.92,light,.84);cube.position.y=.66;const belt=box(.99,.17,.96,green,.75);belt.position.y=.70;g.add(plaza,cube,belt);
  for(let x=-.30;x<=.30;x+=.15){const slit=box(.045,.48,.02,0x59605d,.65);slit.position.set(x,.64,.47);g.add(slit)}
  const min=cyl(.065,.09,1.45,light,18,.82);min.position.set(.67,.78,.27);const cap=new THREE.Mesh(new THREE.ConeGeometry(.11,.25,18),mat(green,.75));cap.position.set(.67,1.62,.27);g.add(min,cap);
  g.position.copy(p);g.rotation.y=-.12;world.add(g);return register(g,{area:"PALTAN · CENTRAL DHAKA",title:"Baitul Mukarram",text:"Placed east of the university area at its real map coordinate in Paltan."})
}

function person(x,z,shirt=0x315f98,skin=0xb77a57,rot=0,scale=1){
  const g=new THREE.Group();
  const head=sphere(.055,skin,12);head.position.y=.39;
  const body=cyl(.065,.08,.18,shirt,10,.78);body.position.y=.25;
  const leg1=box(.025,.15,.03,0x30343a,.72);leg1.position.set(-.025,.09,0);const leg2=leg1.clone();leg2.position.x=.025;
  g.add(head,body,leg1,leg2);g.scale.setScalar(scale);g.position.set(x,.03,z);g.rotation.y=rot;world.add(g);return g
}
function rickshaw(x,z,rot=0,color=0x21876f){
  const g=new THREE.Group();
  const frame=box(.34,.08,.45,0x65393a,.55);frame.position.y=.14;
  const seat=box(.30,.27,.30,color,.58);seat.position.set(0,.31,-.07);
  const back=box(.31,.30,.04,0xe8b73d,.62);back.position.set(0,.37,-.24);
  const hood=new THREE.Mesh(new THREE.CylinderGeometry(.20,.20,.30,18,1,false,0,Math.PI),mat(0xdba83b,.65));hood.rotation.z=Math.PI/2;hood.position.set(0,.51,-.05);
  const handle=box(.36,.025,.025,0x45484a,.45);handle.position.set(0,.29,.32);
  g.add(frame,seat,back,hood,handle);
  [[-.20,-.14],[.20,-.14],[0,.30]].forEach(([wx,wz],i)=>{const wh=cyl(.11,.11,.035,0x222526,16,.55);wh.rotation.z=Math.PI/2;wh.position.set(wx,.12,wz);if(i===2){wh.rotation.z=0;wh.rotation.x=Math.PI/2}g.add(wh)});
  g.position.set(x,.02,z);g.rotation.y=rot;world.add(g);return g
}
function cng(x,z,rot=0){const g=new THREE.Group();const b=box(.38,.29,.28,0x2d7f60,.55);b.position.y=.22;const roof=box(.36,.10,.30,0xddd0a3,.72);roof.position.y=.40;g.add(b,roof);g.position.set(x,.02,z);g.rotation.y=rot;world.add(g);return g}
function bus(x,z,rot=0,color=0xbe4439){const g=new THREE.Group();const b=box(.88,.38,.32,color,.46);b.position.y=.28;const r=box(.84,.05,.30,0xe2ddd2,.62);r.position.y=.50;g.add(b,r);g.position.set(x,.02,z);g.rotation.y=rot;world.add(g);return g}

ground();
loadRealRoads();

shaheed(GEO["Central Shaheed Minar"].p);
curzon(GEO["Curzon Hall"].p);
ahsan(GEO["Ahsan Manzil"].p);
sangsad(GEO["Jatiya Sangsad Bhaban"].p);
baitul(GEO["Baitul Mukarram"].p);

// district character based on real landmark geography
function addBlockAround(p,defs){defs.forEach(d=>apartment(p.x+d[0],p.z+d[1],d[2],d[3],d[4],d[5],d[6]||0))}
addBlockAround(GEO["Jatiya Sangsad Bhaban"].p,[[-2.0,-.4,1.2,.9,7,0xaab1ad],[1.8,.7,1.1,.9,6,0xb6afa4],[-1.3,1.8,1.0,.8,5,0xb9b5a9]]);
addBlockAround(GEO["Central Shaheed Minar"].p,[[-2.0,-1.5,1.0,.8,4,0xb7b7ac],[1.9,-1.3,1.0,.8,4,0xc7a789],[-2.2,1.8,1.1,.85,5,0xb7b9af]]);
addBlockAround(GEO["Ahsan Manzil"].p,[[-1.8,-.9,1.0,.75,5,0xcaa785],[1.5,-1.2,1.0,.78,6,0xbab6aa],[-2.2,.8,1.1,.8,5,0xb8b9ad],[2.1,.6,1.0,.8,7,0xa9b0ad]]);
addBlockAround(GEO["Baitul Mukarram"].p,[[-1.7,-1.2,1.05,.8,8,0xa9b0ad],[1.7,-.8,1.0,.8,10,0x9fa9ac],[-1.8,1.4,1.05,.85,7,0xb9b2a6],[1.6,1.4,1.0,.8,8,0xa8b0ae]]);

// streetscape
[[-3.0,-2.2],[-2.6,.8],[-2.8,4.1],[2.8,-2.3],[2.7,.6],[2.9,3.7],[-5.5,-7.1],[-4.5,-9.3],[4.7,5.1],[2.9,6.1]].forEach(v=>tree(v[0],v[1],.8));
[[-2.2,-3.1],[-2.0,0],[2.1,-1.6],[2.2,2.4]].forEach(v=>lamp(v[0],v[1]));

// visible people: university, Paltan, Old Dhaka, parliament plaza
const shirts=[0x2d67a1,0xa13f4c,0x2f8066,0xd39138,0x74599b,0x557e9c];
function crowd(p,count,rx,rz,seed){
  let s=seed;
  const rand=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
  for(let i=0;i<count;i++){
    const x=p.x+(rand()-.5)*rx,z=p.z+(rand()-.5)*rz;
    person(x,z,shirts[i%shirts.length],i%3===0?0x8b5c45:0xb77a57,rand()*Math.PI*2,.9+rand()*.18);
  }
}
crowd(GEO["Central Shaheed Minar"].p,18,3.0,2.1,11);
crowd(GEO["Curzon Hall"].p,12,2.5,1.8,22);
crowd(GEO["Baitul Mukarram"].p,16,2.8,2.0,33);
crowd(GEO["Ahsan Manzil"].p,12,2.5,1.5,44);
crowd(GEO["Jatiya Sangsad Bhaban"].p,8,3.0,2.0,55);

// rickshaws deliberately large and visible
const R=[
  rickshaw(-1.5,2.9,0,.0),
  rickshaw(.8,3.7,Math.PI,0x2b866c),
  rickshaw(2.1,5.4,-.25,0x247a8b),
  rickshaw(3.0,.0,Math.PI*.8,0x33855c),
  rickshaw(-2.5,.5,.15,0x257f73),
  rickshaw(1.2,6.8,Math.PI,.0)
];
animatedVehicles.push({obj:R[0],axis:"z",min:-1,max:5.8,speed:.006,dir:1});
animatedVehicles.push({obj:R[3],axis:"z",min:-2,max:4.0,speed:.005,dir:-1});
animatedVehicles.push({obj:R[4],axis:"x",min:-4,max:2.5,speed:.0045,dir:1});

cng(-.9,1.5,0);cng(1.3,4.8,Math.PI);cng(3.4,-.9,Math.PI*.4);
const busA=bus(1.1,-3.8,0);const busB=bus(-1.1,4.7,Math.PI,0x3d785e);
animatedVehicles.push({obj:busA,axis:"z",min:-5.0,max:5.5,speed:.0065,dir:1});
animatedVehicles.push({obj:busB,axis:"z",min:-4.5,max:5.0,speed:.0055,dir:-1});

// walking pedestrians
for(let i=0;i<10;i++){
  const g=person(-2.1+(i%5)*.85,-2.8+Math.floor(i/5)*.75,shirts[(i+2)%shirts.length],0xb77a57,0,.95);
  walkers.push({obj:g,baseZ:g.position.z,phase:i*.7,speed:.65+((i%3)*.15)});
}

function showLandmark(index){
  const item=landmarks[index];if(!item)return;
  const data=item.userData.info;activeIndex=index;
  popArea.textContent=data.area;popTitle.textContent=data.title;popText.textContent=data.text;pop.hidden=false;
  storyTitle.textContent=data.title;storyText.textContent=data.text;storyProgress.textContent=(index+1)+" / "+landmarks.length;
  nextStoryLabel.textContent="Next: "+landmarks[(index+1)%landmarks.length].userData.info.title;
  const p=new THREE.Vector3();item.getWorldPosition(p);
  focusTarget=p.clone().add(new THREE.Vector3(0,.55,0));
  const side=p.x>0?-1:1;
  focusCamera=p.clone().add(new THREE.Vector3(side*2.3,3.6,4.5));
}
function nextLandmark(){showLandmark((activeIndex+1+landmarks.length)%landmarks.length)}

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
function pointerFromEvent(e){const r=canvas.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1}
canvas.addEventListener("pointermove",e=>{pointerFromEvent(e);raycaster.setFromCamera(pointer,camera);canvas.style.cursor=raycaster.intersectObjects(clickable,false).length?"pointer":"grab"});
canvas.addEventListener("click",e=>{pointerFromEvent(e);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(clickable,false)[0];if(hit?.object?.userData?.landmarkRoot)showLandmark(hit.object.userData.landmarkRoot.userData.index)});
controls.addEventListener("start",()=>{focusCamera=null;focusTarget=null;walkMode=false;document.querySelector("#walkBtn").textContent="Walk"});

document.querySelector("#popClose").addEventListener("click",()=>pop.hidden=true);
document.querySelector("#nextStory").addEventListener("click",nextLandmark);
document.querySelector("#minStory").addEventListener("click",()=>storyCard.classList.toggle("minimized"));
document.querySelector("#zoomIn").addEventListener("click",()=>{const d=camera.position.clone().sub(controls.target).multiplyScalar(.84);camera.position.copy(controls.target.clone().add(d))});
document.querySelector("#zoomOut").addEventListener("click",()=>{const d=camera.position.clone().sub(controls.target).multiplyScalar(1.16);camera.position.copy(controls.target.clone().add(d))});
document.querySelector("#cityBtn").addEventListener("click",()=>{focusCamera=new THREE.Vector3(1.5,10.8,21.5);focusTarget=new THREE.Vector3(0,.6,-1.2);pop.hidden=true});
document.querySelector("#storyBtn").addEventListener("click",nextLandmark);
document.querySelector("#walkBtn").addEventListener("click",()=>{walkMode=!walkMode;document.querySelector("#walkBtn").textContent=walkMode?"Stop":"Walk";focusCamera=null;focusTarget=null});
document.querySelector("#mapBtn").addEventListener("click",()=>document.querySelector("#mapCard").classList.toggle("hidden"));
document.querySelector("#helpBtn").addEventListener("click",()=>{storyTitle.textContent="Map-accurate layout";storyText.textContent="Landmark coordinates are real and primary roads are loaded live from OpenStreetMap. Walk mode moves the camera down to street level so people and rickshaws are easy to see.";storyProgress.textContent="TIP";nextStoryLabel.textContent="Start with Shaheed Minar"});
document.querySelector("#soundBtn").addEventListener("click",e=>e.currentTarget.textContent=e.currentTarget.textContent==="♪"?"♫":"♪");

function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
window.addEventListener("resize",resize);resize();

function animate(t){
  animatedVehicles.forEach(v=>{
    v.obj.position[v.axis]+=v.speed*v.dir;
    if(v.obj.position[v.axis]>v.max||v.obj.position[v.axis]<v.min)v.dir*=-1;
    if(v.axis==="z")v.obj.rotation.y=v.dir>0?0:Math.PI;else v.obj.rotation.y=v.dir>0?Math.PI/2:-Math.PI/2;
  });
  walkers.forEach(w=>{w.obj.position.z=w.baseZ+Math.sin(t*.00035*w.speed+w.phase)*1.4;w.obj.position.y=.03+Math.abs(Math.sin(t*.003+w.phase))*.018});

  if(focusCamera&&focusTarget){camera.position.lerp(focusCamera,.055);controls.target.lerp(focusTarget,.06);if(camera.position.distanceTo(focusCamera)<.04){focusCamera=null;focusTarget=null}}
  if(walkMode){
    walkT+=.0018;const z=-1.0+Math.sin(walkT)*4.5;
    camera.position.lerp(new THREE.Vector3(.72,1.35,z+2.2),.04);
    controls.target.lerp(new THREE.Vector3(.45,.70,z-.6),.045);
  }
  controls.update();renderer.render(scene,camera);requestAnimationFrame(animate);
}
requestAnimationFrame(t=>{loader.classList.add("done");animate(t)});
