import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const canvas = document.querySelector("#cityCanvas");
const stage = document.querySelector(".stage");
const loader = document.querySelector("#loader");
const pop = document.querySelector("#landmarkPop");
const popArea = document.querySelector("#popArea");
const popTitle = document.querySelector("#popTitle");
const popText = document.querySelector("#popText");
const storyTitle = document.querySelector("#storyTitle");
const storyText = document.querySelector("#storyText");
const storyProgress = document.querySelector("#storyProgress");
const nextStoryLabel = document.querySelector("#nextStoryLabel");
const storyCard = document.querySelector("#storyCard");

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xc7dce2, 0.018);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 180);
camera.position.set(0.8, 8.4, 16.8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xc4dce7, 1);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 7.0;
controls.maxDistance = 25;
controls.minPolarAngle = Math.PI * .18;
controls.maxPolarAngle = Math.PI * .47;
controls.target.set(0, 1.1, -1.4);

const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();

const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 7.5;
skyU.rayleigh.value = 1.35;
skyU.mieCoefficient.value = 0.006;
skyU.mieDirectionalG.value = 0.82;
const sunDir = new THREE.Vector3();
const elevation = 34;
const azimuth = 138;
const phi = THREE.MathUtils.degToRad(90 - elevation);
const theta = THREE.MathUtils.degToRad(azimuth);
sunDir.setFromSphericalCoords(1, phi, theta);
skyU.sunPosition.value.copy(sunDir);

scene.add(new THREE.HemisphereLight(0xf8fbff, 0x5d694b, 1.6));

const sun = new THREE.DirectionalLight(0xffedcf, 4.3);
sun.position.set(-9, 16, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 45;
sun.shadow.bias = -0.00025;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xb7d7ff, 0.9);
fill.position.set(10, 7, -10);
scene.add(fill);

const world = new THREE.Group();
scene.add(world);

const clickable = [];
const landmarks = [];
const animatedVehicles = [];
let activeIndex = -1;
let walkMode = false;
let walkT = 0;
let focusCamera = null;
let focusTarget = null;

const anisotropy = renderer.capabilities.getMaxAnisotropy();

function canvasTexture(base, flecks, size=256, density=1100) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0,0,size,size);
  for (let i=0;i<density;i++) {
    const col = flecks[i % flecks.length];
    const alpha = 0.03 + Math.random()*0.10;
    ctx.fillStyle = col.replace("ALPHA", alpha.toFixed(3));
    const s = Math.random()*2.2 + .35;
    ctx.fillRect(Math.random()*size, Math.random()*size, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const grassTex = canvasTexture("#6f8e59", ["rgba(255,255,255,ALPHA)","rgba(30,55,24,ALPHA)"], 256, 1500);
grassTex.repeat.set(12,10);

const asphaltTex = canvasTexture("#303437", ["rgba(255,255,255,ALPHA)","rgba(0,0,0,ALPHA)"], 256, 2200);
asphaltTex.repeat.set(5,12);

const concreteTex = canvasTexture("#b9b5a7", ["rgba(255,255,255,ALPHA)","rgba(72,68,61,ALPHA)"], 256, 1300);
concreteTex.repeat.set(6,6);

function mstd(color, roughness=.72, metalness=.02, map=null) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, map });
  return m;
}
function mphys(color, roughness=.45, metalness=.05, clearcoat=.05) {
  return new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat, clearcoatRoughness:.35 });
}
function box(w,h,d,color,rough=.72) {
  const g = new RoundedBoxGeometry(w,h,d,3,Math.min(.05, Math.min(w,h,d)*.12));
  const mesh = new THREE.Mesh(g,mstd(color,rough));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function plainBox(w,h,d,color,rough=.72) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mstd(color,rough));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function cyl(rt, rb, h, color, seg=24, rough=.72) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mstd(color,rough));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function sphere(r,color,seg=20) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r,seg,Math.max(10,seg/2)),mstd(color,.86));
  mesh.castShadow = true;
  return mesh;
}
function plane(w,d,material) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);
  p.rotation.x = -Math.PI/2;
  p.receiveShadow = true;
  return p;
}
function windowPane(w,h,color=0x42616c) {
  const p = new THREE.Mesh(
    new THREE.PlaneGeometry(w,h),
    new THREE.MeshPhysicalMaterial({
      color, roughness:.20, metalness:.15, clearcoat:.65, clearcoatRoughness:.12
    })
  );
  return p;
}
function addGround() {
  const ground = plane(36,28,mstd(0xffffff,.92,0,grassTex));
  ground.position.y = -.02;
  world.add(ground);

  const citySoil = plane(25,20,mstd(0x788c67,.95));
  citySoil.position.set(0,.002,-1);
  world.add(citySoil);
}

function road(x,z,w,d,rot=0) {
  const g = new THREE.Group();
  const curb = plane(w+.42,d+.42,mstd(0xffffff,.94,0,concreteTex));
  curb.position.y=.012;
  g.add(curb);
  const rmat = mstd(0xffffff,.92,0,asphaltTex);
  rmat.map.repeat.set(Math.max(1,w/2),Math.max(1,d/2));
  const asphalt = plane(w,d,rmat);
  asphalt.position.y=.028;
  g.add(asphalt);
  g.position.set(x,0,z);
  g.rotation.y=rot;
  world.add(g);
  return g;
}

function laneMark(x,z,w,d,rot=0,color=0xe9e6d5) {
  const p=plane(w,d,mstd(color,.62));
  p.position.set(x,.048,z);
  p.rotation.y=rot;
  world.add(p);
}
function zebra(x,z,acrossX=true,rot=0) {
  const g=new THREE.Group();
  for(let i=-5;i<=5;i++){
    const p=plane(acrossX?.12:.85,acrossX?.85:.12,mstd(0xe8e6dc,.65));
    p.position.set(acrossX?i*.19:0,.052,acrossX?0:i*.19);
    g.add(p);
  }
  g.position.set(x,0,z);
  g.rotation.y=rot;
  world.add(g);
}
function sidewalk(x,z,w,d,rot=0) {
  const p=plane(w,d,mstd(0xffffff,.9,0,concreteTex));
  p.position.set(x,.055,z);
  p.rotation.y=rot;
  world.add(p);
}
function median(x,z,w,d) {
  const g = new THREE.Group();
  const base=plainBox(w,.16,d,0x9c9a8f,.9); base.position.y=.08; g.add(base);
  const grass=plane(w-.10,d-.10,mstd(0x587a43,.9)); grass.position.y=.17; g.add(grass);
  g.position.set(x,0,z); world.add(g);
  return g;
}

function tree(x,z,scale=1) {
  const g=new THREE.Group();
  const trunk=cyl(.055,.085,.82,0x6b4d39,10,.9); trunk.position.y=.41; g.add(trunk);
  const greens=[0x436f3d,0x527d45,0x5f884d];
  const blobs=[
    [-.22,1.02,-.03,.32],[.13,1.10,.03,.38],[.34,1.00,0,.28],
    [-.02,1.36,0,.32],[-.37,1.28,.04,.24],[.24,1.36,.02,.25]
  ];
  blobs.forEach((b,i)=>{
    const f=sphere(b[3],greens[i%greens.length],16);
    f.position.set(b[0],b[1],b[2]);
    f.scale.y=.82;
    g.add(f);
  });
  g.scale.setScalar(scale);
  g.position.set(x,0,z);
  world.add(g);
  return g;
}
function palm(x,z,scale=1){
  const g=new THREE.Group();
  const trunk=cyl(.045,.075,1.15,0x73543c,10,.9); trunk.position.y=.575; g.add(trunk);
  for(let i=0;i<8;i++){
    const leaf=plainBox(.08,.025,.65,0x4d7c44,.9);
    leaf.position.set(0,1.18,0);
    leaf.rotation.y=i*Math.PI/4;
    leaf.rotation.x=.28;
    leaf.position.x=Math.sin(i*Math.PI/4)*.22;
    leaf.position.z=Math.cos(i*Math.PI/4)*.22;
    g.add(leaf);
  }
  g.scale.setScalar(scale); g.position.set(x,0,z); world.add(g); return g;
}

function lamp(x,z,rot=0) {
  const g=new THREE.Group();
  const pole=cyl(.018,.025,1.08,0x3d4547,8,.5); pole.position.y=.54;
  const arm=plainBox(.28,.025,.025,0x3d4547,.5); arm.position.set(.12,1.05,0);
  const head=plainBox(.15,.045,.08,0x535c5d,.45); head.position.set(.25,1.03,0);
  const lens=plainBox(.11,.012,.06,0xf5db98,.25); lens.position.set(.25,1.005,0);
  g.add(pole,arm,head,lens);
  g.position.set(x,0,z); g.rotation.y=rot; world.add(g);
}
function trafficLight(x,z,rot=0) {
  const g=new THREE.Group();
  const pole=cyl(.025,.03,1.15,0x454d4e,8,.55); pole.position.y=.575;
  const housing=plainBox(.16,.42,.14,0x242a2b,.45); housing.position.set(0,1.24,0);
  [0xdb3b35,0xe6bd3b,0x4ebd61].forEach((c,i)=>{
    const l=sphere(.042,c,14); l.position.set(0,1.36-i*.12,.075); g.add(l);
  });
  g.add(pole,housing);
  g.position.set(x,0,z); g.rotation.y=rot; world.add(g);
}

function rooftopDetails(g,w,d,h){
  const tank=cyl(.12,.14,.18,0x707779,16,.55); tank.position.set(w*.22,h+.11,-d*.18); g.add(tank);
  const ac=plainBox(.22,.13,.14,0xd5d4cb,.75); ac.position.set(-w*.25,h+.07,d*.18); g.add(ac);
  const parapet=plainBox(w+.04,.08,.06,0xc9c5b7,.88); parapet.position.set(0,h+.04,d/2); g.add(parapet);
}

function apartment(x,z,w,d,floors,body,trim=0xd8d1c1,rot=0,balconies=true) {
  const g=new THREE.Group();
  const floorH=.46;
  const h=floors*floorH;
  const shell=plainBox(w,h,d,body,.80); shell.position.y=h/2; g.add(shell);

  const plinth=plainBox(w+.08,.16,d+.08,0x8e8b83,.92); plinth.position.y=.08; g.add(plinth);
  const roof=plainBox(w+.06,.08,d+.06,trim,.86); roof.position.y=h+.04; g.add(roof);

  const frontZ=d/2+.006;
  for(let f=0;f<floors;f++){
    const y=.26+f*floorH;
    const cols=Math.max(2,Math.floor(w/.40));
    for(let c=0;c<cols;c++){
      const px=-w*.38 + (cols===1?0:c*(w*.76/(cols-1)));
      const win=windowPane(.18,.22,0x405d68);
      win.position.set(px,y,frontZ+.005);
      g.add(win);
      if (balconies && f>0 && (c+f)%3===0){
        const slab=plainBox(.34,.045,.24,0xb8b4a8,.88);
        slab.position.set(px,y-.12,frontZ+.12);
        g.add(slab);
        const rail=plainBox(.34,.16,.018,0x72787a,.4);
        rail.position.set(px,y-.035,frontZ+.23);
        g.add(rail);
      }
    }
  }

  // side windows
  for(let f=0;f<floors;f++){
    const y=.26+f*floorH;
    for(const sx of [-1,1]){
      const win=windowPane(.16,.20,0x455f68);
      win.rotation.y=sx>0?Math.PI/2:-Math.PI/2;
      win.position.set(sx*(w/2+.006),y,0);
      g.add(win);
    }
  }
  rooftopDetails(g,w,d,h);
  g.position.set(x,0,z);
  g.rotation.y=rot;
  world.add(g);
  return g;
}

function shopHouse(x,z,w,d,floors,body,accent,rot=0){
  const g=apartment(x,z,w,d,floors,body,0xd7d0c3,rot,false);
  const aw=plainBox(w*.88,.12,.30,accent,.7); aw.position.set(0,.52,d/2+.16); g.add(aw);
  const shutter=plainBox(w*.55,.42,.02,0x6a6c67,.55); shutter.position.set(-w*.12,.24,d/2+.012); g.add(shutter);
  return g;
}

function billboard(x,z,text,bg="#1565a7",rot=0){
  const c=document.createElement("canvas"); c.width=512; c.height=192;
  const ctx=c.getContext("2d");
  ctx.fillStyle=bg; ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle="#fff"; ctx.font="700 58px Arial, sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(text,c.width/2,c.height/2);
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=anisotropy;
  const g=new THREE.Group();
  const board=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.54),new THREE.MeshStandardMaterial({map:tex,roughness:.6}));
  board.position.y=1.42; g.add(board);
  for(const px of [-.5,.5]){ const p=cyl(.018,.025,1.18,0x54585a,8,.6); p.position.set(px,.59,0); g.add(p);}
  g.position.set(x,0,z); g.rotation.y=rot; world.add(g);
}

function register(group,data){
  group.userData.info=data;
  group.userData.index=landmarks.length;
  landmarks.push(group);
  group.traverse(o=>{
    if(o.isMesh){ o.userData.landmarkRoot=group; clickable.push(o); }
  });
  return group;
}

// --- Dhaka landmarks: higher-detail procedural representations ---
function shaheedMinar(x,z){
  const g=new THREE.Group();
  const stone=0xe8e5dc, white=0xf7f6f0;
  const plaza=plainBox(2.55,.10,1.35,stone,.92); plaza.position.y=.05; g.add(plaza);
  const step1=plainBox(2.15,.08,.28,0xefede5,.92); step1.position.set(0,.10,.72); g.add(step1);
  const step2=plainBox(1.85,.08,.24,0xf6f4ed,.92); step2.position.set(0,.17,.58); g.add(step2);

  const disc=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.055,48),mstd(0xc93432,.62));
  disc.rotation.x=Math.PI/2; disc.position.set(0,1.18,-.10); disc.castShadow=true; g.add(disc);

  const heights=[1.25,1.48,1.78,1.48,1.25];
  heights.forEach((h,i)=>{
    const px=(i-2)*.28;
    const l=plainBox(.055,h,.08,white,.83); l.position.set(px-.06,h/2+.20,0); l.rotation.z=.055; g.add(l);
    const r=plainBox(.055,h,.08,white,.83); r.position.set(px+.06,h/2+.20,0); r.rotation.z=-.055; g.add(r);
    const cap=plainBox(.18,.055,.08,white,.83); cap.position.set(px,h+.20,0); g.add(cap);
  });

  const sideWallL=plainBox(.18,1.0,.08,white,.83); sideWallL.position.set(-.88,.62,0); sideWallL.rotation.z=.12; g.add(sideWallL);
  const sideWallR=sideWallL.clone(); sideWallR.position.x=.88; sideWallR.rotation.z=-.12; g.add(sideWallR);

  g.position.set(x,0,z); world.add(g);
  return register(g,{area:"DHAKA UNIVERSITY AREA",title:"Central Shaheed Minar",text:"A national memorial to the Language Movement, recreated here with the white vertical forms, red sun disc and stepped plaza that define the real monument."});
}

function ahsanManzil(x,z){
  const g=new THREE.Group();
  const pink=0xd88092,pink2=0xe69aae,cream=0xf1d8c2,dark=0x645d61;
  const plinth=plainBox(2.75,.18,1.25,0xc98a90,.85); plinth.position.y=.09; g.add(plinth);
  const body=plainBox(1.75,.92,.95,pink,.78); body.position.y=.64; g.add(body);
  const left=plainBox(.66,.72,.88,pink2,.78); left.position.set(-1.12,.54,0); g.add(left);
  const right=plainBox(.66,.72,.88,pink2,.78); right.position.set(1.12,.54,0); g.add(right);

  const portico=plainBox(1.05,.12,.46,cream,.8); portico.position.set(0,.38,.64); g.add(portico);
  for(let px=-.44;px<=.44;px+=.22){ const col=cyl(.035,.045,.66,cream,14,.76); col.position.set(px,.56,.62); g.add(col); }

  for(let px=-1.26;px<=1.26;px+=.31){
    const win=windowPane(.15,.24,0x536574); win.position.set(px,.66,.481); g.add(win);
    const frame=plainBox(.19,.28,.022,cream,.8); frame.position.set(px,.66,.47); g.add(frame); win.position.z=.486;
  }

  const drum=cyl(.29,.31,.19,pink2,32,.76); drum.position.y=1.18; g.add(drum);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(.34,32,18,0,Math.PI*2,0,Math.PI/2),mstd(pink2,.68));
  dome.position.y=1.28; dome.castShadow=true; g.add(dome);
  const finial=cyl(.02,.028,.31,cream,12,.7); finial.position.y=1.62; g.add(finial);

  const stairs=plainBox(1.0,.08,.36,0xd3b4aa,.9); stairs.position.set(0,.12,.82); g.add(stairs);
  g.position.set(x,0,z); world.add(g);
  return register(g,{area:"OLD DHAKA",title:"Ahsan Manzil",text:"The pink Nawab palace on the Buriganga, represented with its central dome, classical portico, long façade and symmetrical wings."});
}

function curzonHall(x,z){
  const g=new THREE.Group();
  const brick=0x9b4937,brick2=0xb75f47,cream=0xe5bf94,dark=0x5f493d;
  const base=plainBox(2.65,.18,1.05,0x7e4639,.86); base.position.y=.09; g.add(base);
  const body=plainBox(2.22,.80,.92,brick,.82); body.position.y=.58; g.add(body);
  const center=plainBox(.68,1.08,.98,brick2,.80); center.position.y=.70; g.add(center);

  for(const px of [-.88,-.47,.47,.88]){
    const t=cyl(.095,.12,.94,brick2,16,.78); t.position.set(px,.62,.33); g.add(t);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(.14,.30,16),mstd(cream,.72)); cap.position.set(px,1.24,.33); cap.castShadow=true; g.add(cap);
  }
  for(let px=-.82;px<=.82;px+=.41){
    const frame=plainBox(.22,.32,.03,cream,.82); frame.position.set(px,.42,.476); g.add(frame);
    const inset=windowPane(.15,.23,0x405a64); inset.position.set(px,.42,.493); g.add(inset);
  }
  const cornice=plainBox(2.28,.10,1.00,cream,.82); cornice.position.y=.98; g.add(cornice);
  const door=plainBox(.28,.46,.035,dark,.75); door.position.set(0,.30,.505); g.add(door);
  g.position.set(x,0,z); world.add(g);
  return register(g,{area:"DHAKA UNIVERSITY",title:"Curzon Hall",text:"A red-brick academic landmark with towers, domed details, arches and cream trim inspired by the real Curzon Hall."});
}

function sangsad(x,z){
  const g=new THREE.Group();
  const concrete=0xbab7ad,concrete2=0xcac6bb,dark=0x40545a;
  const lawn=plane(4.0,3.2,mstd(0x63834f,.9)); lawn.position.y=.01; g.add(lawn);
  const poolMat=new THREE.MeshPhysicalMaterial({color:0x6ba1af,roughness:.16,metalness:.02,transparent:true,opacity:.82,clearcoat:.55});
  const pool=plane(3.35,2.45,poolMat); pool.position.y=.025; g.add(pool);

  const island=plainBox(2.55,.16,1.85,0xa9a69e,.92); island.position.y=.11; g.add(island);
  const center=plainBox(1.12,1.46,1.18,concrete,.78); center.position.y=.84; g.add(center);
  const left=plainBox(.52,1.02,1.28,concrete2,.78); left.position.set(-.92,.62,0); g.add(left);
  const right=plainBox(.52,1.02,1.28,concrete2,.78); right.position.set(.92,.62,0); g.add(right);
  const back=plainBox(1.35,.92,.52,concrete2,.78); back.position.set(0,.58,-.72); g.add(back);
  const roof=plainBox(.95,.18,.96,0xa9a69f,.78); roof.position.y=1.64; g.add(roof);

  const ringMat=mstd(dark,.55);
  [[-.34,.92,.60,.20],[.34,.92,.60,.20],[0,.48,.60,.25],[0,1.32,.60,.17]].forEach(v=>{
    const ring=new THREE.Mesh(new THREE.TorusGeometry(v[3],.047,12,36),ringMat);
    ring.position.set(v[0],v[1],v[2]); ring.castShadow=true; g.add(ring);
  });
  // diagonal concrete cut-outs
  for(const sx of [-1,1]){
    const d=plainBox(.12,.86,.06,dark,.62); d.position.set(sx*.64,.78,.62); d.rotation.z=sx*.42; g.add(d);
  }

  g.position.set(x,0,z); world.add(g);
  return register(g,{area:"SHER-E-BANGLA NAGAR",title:"Jatiyo Sangsad Bhaban",text:"A more architectural miniature of Louis Kahn's National Parliament complex, with monumental concrete volumes, geometric openings and surrounding water."});
}

function baitulMukarram(x,z){
  const g=new THREE.Group();
  const stone=0xe1ddd2,light=0xf0ede5,green=0x355c50,dark=0x59605d;
  const plaza=plainBox(1.75,.12,1.55,0xc7c2b7,.9); plaza.position.y=.06; g.add(plaza);
  const cube=plainBox(1.05,1.35,1.0,light,.82); cube.position.y=.75; g.add(cube);
  const belt=plainBox(1.09,.20,1.04,green,.74); belt.position.y=.80; g.add(belt);
  const top=plainBox(.84,.18,.82,stone,.84); top.position.y=1.48; g.add(top);

  for(let px=-.36;px<=.36;px+=.18){
    const slit=plainBox(.055,.56,.025,dark,.65); slit.position.set(px,.70,.515); g.add(slit);
  }

  const minaretBase=plainBox(.22,.26,.22,stone,.8); minaretBase.position.set(.74,.13,.30); g.add(minaretBase);
  const minaret=cyl(.075,.10,1.62,light,20,.8); minaret.position.set(.74,.95,.30); g.add(minaret);
  const balcony=cyl(.13,.13,.07,green,20,.7); balcony.position.set(.74,1.54,.30); g.add(balcony);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.13,.30,20),mstd(green,.74)); cap.position.set(.74,1.86,.30); cap.castShadow=true; g.add(cap);

  g.position.set(x,0,z); world.add(g);
  return register(g,{area:"PALTAN · CENTRAL DHAKA",title:"Baitul Mukarram",text:"The national mosque rendered with its massive cubic prayer hall, vertical façade slits, dark green banding and minaret."});
}

function car(x,z,color=0xd9d9d2,rot=0){
  const g=new THREE.Group();
  const body=box(.62,.20,.30,color,.38); body.position.y=.21; g.add(body);
  const cabin=box(.34,.18,.27,0x758b91,.20); cabin.position.set(-.02,.38,0); g.add(cabin);
  for(const sx of [-.20,.20]) for(const zz of [-.16,.16]){
    const wheel=cyl(.055,.055,.055,0x202324,14,.55); wheel.rotation.z=Math.PI/2; wheel.position.set(sx,.10,zz); g.add(wheel);
  }
  g.position.set(x,.02,z); g.rotation.y=rot; world.add(g); return g;
}
function bus(x,z,color=0xc54c3c,rot=0){
  const g=new THREE.Group();
  const body=box(.95,.42,.34,color,.42); body.position.y=.31; g.add(body);
  const roof=box(.90,.06,.32,0xe5dfd2,.6); roof.position.y=.55; g.add(roof);
  for(const px of [-.30,0,.30]){
    const win=windowPane(.20,.19,0x466b78); win.position.set(px,.37,.175); g.add(win);
  }
  for(const sx of [-.32,.32]) for(const zz of [-.18,.18]){
    const wheel=cyl(.065,.065,.06,0x202324,14,.55); wheel.rotation.z=Math.PI/2; wheel.position.set(sx,.11,zz); g.add(wheel);
  }
  g.position.set(x,.02,z); g.rotation.y=rot; world.add(g); return g;
}
function cng(x,z,rot=0){
  const g=new THREE.Group();
  const body=box(.40,.30,.28,0x2f7c62,.52); body.position.y=.24; g.add(body);
  const roof=box(.38,.12,.30,0xe6d5a8,.7); roof.position.y=.43; g.add(roof);
  const front=windowPane(.22,.15,0x4a6b73); front.position.set(0,.31,.146); g.add(front);
  g.position.set(x,.02,z); g.rotation.y=rot; world.add(g); return g;
}
function rickshaw(x,z,rot=0){
  const g=new THREE.Group();
  const frame=plainBox(.31,.10,.22,0x7d3331,.55); frame.position.y=.15; g.add(frame);
  const seat=box(.26,.26,.23,0x2f816d,.52); seat.position.y=.30; g.add(seat);
  const hood=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.22,18,1,false,0,Math.PI),mstd(0xd7ae3f,.66));
  hood.rotation.z=Math.PI/2; hood.position.set(0,.48,0); g.add(hood);
  g.position.set(x,.02,z); g.rotation.y=rot; world.add(g); return g;
}

function stall(x,z,rot=0){
  const g=new THREE.Group();
  const counter=box(.50,.42,.34,0x76523b,.8); counter.position.y=.22; g.add(counter);
  const top=plainBox(.64,.07,.46,0x296e63,.72); top.position.y=.67; g.add(top);
  for(const px of [-.24,.24]){ const p=plainBox(.025,.52,.025,0xc8b690,.82); p.position.set(px,.44,.13); g.add(p);}
  const light=sphere(.025,0xf0cf78,12); light.position.set(0,.60,.14); g.add(light);
  g.position.set(x,0,z); g.rotation.y=rot; world.add(g);
}

function metroLine(){
  const g=new THREE.Group();
  const deck=plainBox(11.2,.18,.54,0xaeb3b1,.85); deck.position.y=2.35; g.add(deck);
  for(let x=-5.0;x<=5.0;x+=2.0){
    const p=plainBox(.20,2.35,.22,0x9fa6a4,.84); p.position.set(x,1.18,0); g.add(p);
    const cap=plainBox(.46,.12,.50,0xaab0ae,.84); cap.position.set(x,2.26,0); g.add(cap);
  }
  const rail1=plainBox(11.2,.05,.06,0x4a5152,.45); rail1.position.set(0,2.48,-.14); g.add(rail1);
  const rail2=rail1.clone(); rail2.position.z=.14; g.add(rail2);

  const station=new THREE.Group();
  const floor=plainBox(2.25,.16,1.05,0xb9bfbd,.82); floor.position.y=2.58; station.add(floor);
  const roof=plainBox(2.45,.12,1.16,0x65818a,.58); roof.position.y=3.30; station.add(roof);
  for(const px of [-.9,.9]) for(const zz of [-.38,.38]){
    const p=plainBox(.06,.62,.06,0x677173,.5); p.position.set(px,2.95,zz); station.add(p);
  }
  station.position.x=2.65; g.add(station);

  const train=new THREE.Group();
  for(let i=0;i<3;i++){
    const car=box(1.20,.46,.42,0xe8eceb,.38); car.position.set(i*1.23,2.72,0); train.add(car);
    const stripe=plainBox(1.18,.08,.43,0xc9413f,.46); stripe.position.set(i*1.23,2.68,0); train.add(stripe);
    for(const px of [-.36,0,.36]){
      const win=windowPane(.24,.19,0x446975); win.position.set(i*1.23+px,2.78,.216); train.add(win);
    }
  }
  train.position.x=-4.4; g.add(train);
  g.position.set(0,0,6.1); world.add(g);
  animatedVehicles.push({obj:train,axis:"x",min:-5.1,max:1.4,speed:.010,dir:1});
}

addGround();

// road network
road(0,-1.2,4.25,22);
road(0,-6.0,17.5,3.0);
road(-6.3,-.8,2.85,12.2,Math.PI*.12);
road(6.2,-.8,2.85,12.2,-Math.PI*.12);

sidewalk(-2.50,-1.2,.70,22);
sidewalk(2.50,-1.2,.70,22);
median(0,-1.15,.42,21.6);
for(let z=-10.2;z<8.2;z+=1.18){
  laneMark(-1.02,z,.055,.58);
  laneMark(1.02,z,.055,.58);
}
for(let x=-7.8;x<7.8;x+=1.1){
  laneMark(x,-6.72,.52,.055);
  laneMark(x,-5.28,.52,.055);
}
zebra(0,-4.95,true);
zebra(-5.05,-6.0,false);
zebra(5.05,-6.0,false);

// realistic urban blocks
const blocks=[
  [-8.1,-5.1,1.7,1.15,4,0xd5c0a3,0xe4ddd1,.04],
  [-7.7,-2.8,1.65,1.12,6,0xb5c1b3,0xd7d2c6,.10],
  [-7.25,-.1,1.75,1.18,5,0xd2a888,0xe1d7c8,.14],
  [-6.65,2.8,1.65,1.10,4,0xc6b69e,0xd5cec3,.12],
  [-5.15,4.85,1.90,1.18,7,0xb9b8ad,0xd9d5c9,.02],
  [8.0,-5.0,1.75,1.15,5,0xc9b49a,0xe0d7c9,-.04],
  [7.55,-2.8,1.60,1.05,6,0xabbcb1,0xd6d2c7,-.10],
  [7.05,-.15,1.80,1.15,5,0xd4aa91,0xe2d8ca,-.14],
  [6.5,2.7,1.65,1.05,4,0xc9bca5,0xd5cec4,-.10],
  [5.1,4.8,1.90,1.20,8,0xb4b6b0,0xd9d6cb,-.02]
];
blocks.forEach(b=>apartment(...b));

shopHouse(-4.25,-3.2,1.55,1.0,3,0xc9aa83,0x2b746b,.03);
shopHouse(4.2,-3.15,1.55,1.0,3,0xc8b191,0xb94f3f,-.03);
shopHouse(-4.65,2.1,1.45,.95,4,0xb7bdaa,0x2f7180,.06);
shopHouse(4.5,2.15,1.45,.95,4,0xd2b18f,0xc16045,-.06);

// skyline beyond the main diorama
[
  [-10,6.7,1.35,1.25,12,0xa8b0ad],[ -8.1,7.6,1.45,1.15,15,0x9ca8aa],
  [-5.8,8.1,1.20,1.05,11,0xb2aaa0],[-3.5,8.8,1.45,1.20,16,0xa9b1b2],
  [3.2,8.7,1.40,1.20,14,0xa8b0b0],[5.8,8.2,1.25,1.10,12,0xb7afa4],
  [8.2,7.5,1.45,1.20,15,0xa0aaac],[10.0,6.5,1.35,1.10,11,0xb3a89f]
].forEach(b=>apartment(b[0],b[1],b[2],b[3],b[4],b[5],0xd4d1c8,0,false));

// landmarks, spaced like districts rather than random props
shaheedMinar(-2.5,2.15);
curzonHall(-5.0,.25);
ahsanManzil(3.7,2.4);
sangsad(4.9,-.55);
baitulMukarram(.8,4.35);

// trees, palms and streetscape
[
  [-3.0,-8.8,.95],[-2.8,-7.4,.85],[-2.9,-3.7,.82],[-2.8,-.2,.90],[-2.85,5.0,.95],
  [3.0,-8.6,.92],[2.9,-7.0,.84],[2.9,-3.2,.85],[2.85,.35,.90],[2.9,5.05,.90],
  [-9.5,-1.8,1.0],[-8.9,1.4,.92],[-7.8,4.4,1.0],[9.4,-1.7,1.0],[8.8,1.5,.92],[7.8,4.3,1.0]
].forEach(v=>tree(...v));

[[-3.35,3.6,.9],[-3.55,4.2,.86],[3.4,3.7,.88],[3.75,4.25,.9]].forEach(v=>palm(...v));

for(let z=-9.2;z<7.5;z+=2.1){
  lamp(-2.82,z,0); lamp(2.82,z,Math.PI);
}
trafficLight(-2.30,-5.0,0);
trafficLight(2.30,-5.0,Math.PI);
trafficLight(-.50,-7.35,Math.PI/2);
trafficLight(.50,-4.65,-Math.PI/2);

stall(-3.4,-4.0,.08);
stall(3.45,-3.8,-.08);
stall(-7.0,-5.25,.03);
billboard(-6.2,-4.45,"ঢাকা", "#2b6f86", .04);
billboard(6.1,-4.45,"DHAKA", "#2d7255", -.04);

rickshaw(-1.30,-3.9,0);
rickshaw(1.30,1.0,Math.PI);
rickshaw(-4.95,-5.65,Math.PI/2);
cng(-.92,-.8,0);
cng(.92,2.8,Math.PI);
car(-1.35,-7.8,0xb84a43,0);
car(1.35,-4.6,0xe0ded7,Math.PI);
car(-1.35,4.2,0x3e6980,0);

const busA=bus(1.35,-8.8,0xbf4338,0);
animatedVehicles.push({obj:busA,axis:"z",min:-9.2,max:5.4,speed:.009,dir:1});
const busB=bus(-1.35,4.9,0x397960,Math.PI);
animatedVehicles.push({obj:busB,axis:"z",min:-8.8,max:5.2,speed:.0075,dir:-1});

metroLine();

function showLandmark(index){
  const item=landmarks[index]; if(!item) return;
  const data=item.userData.info;
  activeIndex=index;
  popArea.textContent=data.area;
  popTitle.textContent=data.title;
  popText.textContent=data.text;
  pop.hidden=false;
  storyTitle.textContent=data.title;
  storyText.textContent=data.text;
  storyProgress.textContent=(index+1)+" / "+landmarks.length;
  nextStoryLabel.textContent="Next: "+landmarks[(index+1)%landmarks.length].userData.info.title;

  const pos=new THREE.Vector3();
  item.getWorldPosition(pos);
  focusTarget=pos.clone().add(new THREE.Vector3(0,.65,0));
  const cameraOffset=new THREE.Vector3(pos.x*.08,4.7,6.4);
  focusCamera=pos.clone().add(cameraOffset);
}
function nextLandmark(){
  showLandmark((activeIndex+1+landmarks.length)%landmarks.length);
}

const raycaster=new THREE.Raycaster();
const pointer=new THREE.Vector2();
function pointerFromEvent(event){
  const rect=canvas.getBoundingClientRect();
  pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
}
canvas.addEventListener("pointermove",(event)=>{
  pointerFromEvent(event);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(clickable,false);
  canvas.style.cursor=hits.length?"pointer":"grab";
});
canvas.addEventListener("click",(event)=>{
  pointerFromEvent(event);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(clickable,false);
  if(!hits.length) return;
  const root=hits[0].object.userData.landmarkRoot;
  if(root) showLandmark(root.userData.index);
});
controls.addEventListener("start",()=>{
  focusCamera=null; focusTarget=null; walkMode=false;
  document.querySelector("#walkBtn").textContent="Walk";
});

document.querySelector("#popClose").addEventListener("click",()=>{pop.hidden=true;});
document.querySelector("#nextStory").addEventListener("click",nextLandmark);
document.querySelector("#minStory").addEventListener("click",()=>storyCard.classList.toggle("minimized"));
document.querySelector("#zoomIn").addEventListener("click",()=>{
  const dir=camera.position.clone().sub(controls.target).multiplyScalar(.86);
  camera.position.copy(controls.target.clone().add(dir));
});
document.querySelector("#zoomOut").addEventListener("click",()=>{
  const dir=camera.position.clone().sub(controls.target).multiplyScalar(1.14);
  camera.position.copy(controls.target.clone().add(dir));
});
document.querySelector("#cityBtn").addEventListener("click",()=>{
  focusCamera=new THREE.Vector3(.8,8.4,16.8);
  focusTarget=new THREE.Vector3(0,1.1,-1.4);
  pop.hidden=true;
});
document.querySelector("#storyBtn").addEventListener("click",nextLandmark);
document.querySelector("#walkBtn").addEventListener("click",()=>{
  walkMode=!walkMode;
  document.querySelector("#walkBtn").textContent=walkMode?"Stop":"Walk";
  focusCamera=null; focusTarget=null;
});
document.querySelector("#mapBtn").addEventListener("click",()=>{
  document.querySelector("#mapCard").classList.toggle("hidden");
});
document.querySelector("#helpBtn").addEventListener("click",()=>{
  storyTitle.textContent="Explore real-feeling Mini Dhaka";
  storyText.textContent="Drag to orbit, scroll to zoom, use Walk for a lower street-level camera, and click the five detailed landmarks.";
  storyProgress.textContent="TIP";
  nextStoryLabel.textContent="Start with Shaheed Minar";
});
document.querySelector("#soundBtn").addEventListener("click",(e)=>{
  e.currentTarget.textContent=e.currentTarget.textContent==="♪"?"♫":"♪";
});

function resize(){
  const w=stage.clientWidth, h=stage.clientHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize",resize);
resize();

function animate(){
  animatedVehicles.forEach(v=>{
    if(v.axis==="x"){
      v.obj.position.x+=v.speed*v.dir;
      if(v.obj.position.x>v.max||v.obj.position.x<v.min) v.dir*=-1;
      v.obj.rotation.y=v.dir>0?0:Math.PI;
    } else {
      v.obj.position.z+=v.speed*v.dir;
      if(v.obj.position.z>v.max||v.obj.position.z<v.min) v.dir*=-1;
      v.obj.rotation.y=v.dir>0?0:Math.PI;
    }
  });

  if(focusCamera&&focusTarget){
    camera.position.lerp(focusCamera,.045);
    controls.target.lerp(focusTarget,.05);
    if(camera.position.distanceTo(focusCamera)<.045){focusCamera=null;focusTarget=null;}
  }

  if(walkMode){
    walkT+=.0018;
    const z=-8.5+(Math.sin(walkT)*.5+.5)*14.5;
    camera.position.lerp(new THREE.Vector3(.85,1.62,z+3.1),.035);
    controls.target.lerp(new THREE.Vector3(.55,.85,z-.2),.04);
  }

  controls.update();
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(()=>{
  loader.classList.add("done");
  animate();
});
