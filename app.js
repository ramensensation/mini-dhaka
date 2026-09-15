import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
scene.fog = new THREE.Fog(0xc8edf6, 18, 32);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0.2, 7.2, 13.4);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xbde5f3, 0);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 8.5;
controls.maxDistance = 18;
controls.minPolarAngle = Math.PI * .20;
controls.maxPolarAngle = Math.PI * .47;
controls.target.set(0, 0.6, -1.2);

scene.add(new THREE.HemisphereLight(0xfafcff, 0x52643a, 2.6));

const sun = new THREE.DirectionalLight(0xfff1ca, 4.5);
sun.position.set(-5, 10, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xa9d4ff, 1.6);
fill.position.set(7, 5, -8);
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

function mat(color, roughness=.85, metalness=0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w,h,d,color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, color, seg=20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function sphere(r,color,detail=1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r,detail), mat(color));
  m.castShadow = true;
  return m;
}

function addGround() {
  const lawn = new THREE.Mesh(
    new THREE.BoxGeometry(21, .55, 17),
    mat(0x82a85e)
  );
  lawn.position.set(0,-.4,-1);
  lawn.receiveShadow = true;
  world.add(lawn);

  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(21.2,.28,17.2),
    mat(0x6f8d50)
  );
  edge.position.set(0,-.78,-1);
  world.add(edge);
}

function road(x,z,w,d,rotation=0) {
  const g = new THREE.Group();
  const r = box(w,.05,d,0x374645);
  r.position.y = .03;
  g.add(r);

  const curb = box(w+.26,.06,d+.26,0xc9c8b8);
  curb.position.y = .005;
  g.add(curb);
  r.renderOrder = 2;

  g.rotation.y = rotation;
  g.position.set(x,.02,z);
  world.add(g);
  return g;
}

function laneDash(x,z,w,d,rotation=0) {
  const dash = box(w,.014,d,0xf4efc7);
  dash.position.set(x,.075,z);
  dash.rotation.y = rotation;
  world.add(dash);
}

function zebra(x,z,acrossX=true) {
  const g = new THREE.Group();
  for (let i=-4;i<=4;i++) {
    const stripe = box(acrossX ? .12 : .65, .018, acrossX ? .65 : .12, 0xf2f0dc);
    stripe.position.set(acrossX ? i*.18 : 0, .087, acrossX ? 0 : i*.18);
    g.add(stripe);
  }
  g.position.set(x,0,z);
  world.add(g);
}

function sidewalk(x,z,w,d) {
  const s = box(w,.10,d,0xd9d4be);
  s.position.set(x,.08,z);
  world.add(s);
}

function tree(x,z,scale=1) {
  const g = new THREE.Group();
  const trunk = cyl(.05,.07,.65,0x745139,7);
  trunk.position.y = .34;
  g.add(trunk);

  const foliage = new THREE.Group();
  [
    [-.16,.92,0,.29],
    [.12,.98,.02,.34],
    [.02,1.17,0,.27],
    [.26,1.08,.02,.23],
    [-.27,1.08,.03,.22]
  ].forEach(([px,py,pz,r],i)=>{
    const f=sphere(r*scale, i%2?0x456f37:0x547e3e,1);
    f.position.set(px*scale,py*scale,pz);
    foliage.add(f);
  });
  g.add(foliage);
  g.scale.setScalar(scale);
  g.position.set(x,0,z);
  world.add(g);
  return g;
}

function lamp(x,z) {
  const g = new THREE.Group();
  const pole = cyl(.018,.022,.85,0x39484a,7);
  pole.position.y=.425;
  const head = box(.18,.05,.08,0x4a5555);
  head.position.set(.06,.86,0);
  g.add(pole,head);
  g.position.set(x,0,z);
  world.add(g);
}

function house(x,z,w=1.1,d=.85,h=.75,body=0xe6c18c,roof=0xa64e38,rot=0) {
  const g = new THREE.Group();
  const base = box(w,h,d,body);
  base.position.y=h/2;
  g.add(base);

  const roofMesh = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(w,d)*.74,.42,4),
    mat(roof)
  );
  roofMesh.rotation.y=Math.PI/4;
  roofMesh.scale.set(1,.9,d/w);
  roofMesh.position.y=h+.20;
  roofMesh.castShadow=true;
  g.add(roofMesh);

  for (const sx of [-.28,.28]) {
    const window = box(.18,.22,.025,0x6b91a1);
    window.position.set(sx,h*.55,d/2+.015);
    g.add(window);
  }

  const door=box(.18,.32,.03,0x6b4b38);
  door.position.set(0,.16,d/2+.02);
  g.add(door);

  g.position.set(x,0,z);
  g.rotation.y=rot;
  world.add(g);
  return g;
}

function commercial(x,z,w,d,h,body,accent) {
  const g=new THREE.Group();
  const b=box(w,h,d,body); b.position.y=h/2; g.add(b);
  const aw=box(w*.86,.10,.16,accent); aw.position.set(0,h*.52,d/2+.09); g.add(aw);
  const roof=box(w+.06,.07,d+.06,0xe8e1c5); roof.position.y=h+.035; g.add(roof);

  for(let floor=.26;floor<h-.12;floor+=.28){
    for(let px=-w*.3;px<=w*.3;px+=w*.3){
      const win=box(.14,.12,.02,0x6b93a6); win.position.set(px,floor,d/2+.012); g.add(win);
    }
  }

  g.position.set(x,0,z);
  world.add(g);
  return g;
}

function bus(x,z,color=0xd85143) {
  const g=new THREE.Group();
  const body=box(.72,.34,.28,color); body.position.y=.28;
  const roof=box(.70,.06,.26,0xf1e4c7); roof.position.y=.48;
  const front=box(.18,.18,.03,0x86aebe); front.position.set(.27,.31,.155);
  g.add(body,roof,front);
  for(const sx of [-.24,.24]) {
    const wh=cyl(.07,.07,.06,0x222627,12); wh.rotation.z=Math.PI/2; wh.position.set(sx,.12,.15); g.add(wh);
  }
  g.position.set(x,.03,z);
  world.add(g);
  return g;
}

function rickshaw(x,z,rot=0) {
  const g=new THREE.Group();
  const seat=box(.30,.26,.25,0x2d8a72); seat.position.y=.26;
  const canopy=box(.32,.06,.28,0xe3b73d); canopy.position.y=.47;
  const front=box(.24,.08,.08,0xb94544); front.position.set(0,.13,.23);
  g.add(seat,canopy,front);
  g.position.set(x,.03,z);
  g.rotation.y=rot;
  world.add(g);
}

function stall(x,z,rot=0) {
  const g=new THREE.Group();
  const counter=box(.42,.38,.30,0x765038); counter.position.y=.19;
  const roof=box(.54,.07,.42,0x2c7c70); roof.position.y=.55;
  const pole1=box(.03,.45,.03,0xe5d8b5); pole1.position.set(-.20,.38,.12);
  const pole2=pole1.clone(); pole2.position.x=.20;
  g.add(counter,roof,pole1,pole2);
  g.position.set(x,0,z);
  g.rotation.y=rot;
  world.add(g);
}

function register(group, data) {
  group.userData.info = data;
  group.userData.index = landmarks.length;
  landmarks.push(group);
  group.traverse(o=>{
    if(o.isMesh){
      o.userData.landmarkRoot=group;
      clickable.push(o);
    }
  });
  return group;
}

function shaheedMinar(x,z) {
  const g=new THREE.Group();
  const platform=box(1.85,.10,.82,0xe8e4d8); platform.position.y=.05; g.add(platform);
  const stairs=box(1.55,.08,.28,0xf1eee6); stairs.position.set(0,.10,.48); g.add(stairs);

  const disc=new THREE.Mesh(
    new THREE.CylinderGeometry(.28,.28,.06,32),
    mat(0xd84643)
  );
  disc.rotation.x=Math.PI/2;
  disc.position.set(0,.98,-.04);
  g.add(disc);

  const heights=[1.25,1.45,1.65,1.45,1.25];
  heights.forEach((h,i)=>{
    const px=(i-2)*.25;
    const left=box(.06,h,.07,0xf7f4ea); left.position.set(px-.055,h/2+.13,0); left.rotation.z=.06; g.add(left);
    const right=box(.06,h,.07,0xf7f4ea); right.position.set(px+.055,h/2+.13,0); right.rotation.z=-.06; g.add(right);
    const cap=box(.17,.06,.07,0xf7f4ea); cap.position.set(px,h+.10,0); g.add(cap);
  });

  g.position.set(x,0,z);
  world.add(g);
  return register(g,{
    area:"DHAKA UNIVERSITY AREA",
    title:"Central Shaheed Minar",
    text:"A national symbol of the Language Movement and one of the most meaningful public spaces in Dhaka."
  });
}

function ahsanManzil(x,z) {
  const g=new THREE.Group();
  const pink=0xde7f96, pink2=0xea9caf, cream=0xf4e0cc;
  const base=box(2.15,.20,.95,pink2); base.position.y=.10; g.add(base);
  const body=box(1.55,.80,.78,pink); body.position.y=.60; g.add(body);
  const wingL=box(.55,.62,.72,pink2); wingL.position.set(-1.0,.50,0); g.add(wingL);
  const wingR=box(.55,.62,.72,pink2); wingR.position.set(1.0,.50,0); g.add(wingR);

  for(let px=-.60;px<=.60;px+=.30){
    const col=cyl(.035,.045,.48,cream,10); col.position.set(px,.48,.43); g.add(col);
  }

  const dome=new THREE.Mesh(
    new THREE.SphereGeometry(.30,24,16,0,Math.PI*2,0,Math.PI/2),
    mat(pink2)
  );
  dome.position.set(0,1.10,0); g.add(dome);
  const finial=cyl(.025,.03,.30,cream,10); finial.position.set(0,1.37,0); g.add(finial);

  for(const px of [-1.05,-.55,-.2,.2,.55,1.05]){
    const win=box(.14,.20,.025,0x6d809a); win.position.set(px,.62,.405); g.add(win);
  }

  g.position.set(x,0,z);
  world.add(g);
  return register(g,{
    area:"OLD DHAKA",
    title:"Ahsan Manzil",
    text:"The famous pink palace beside the Buriganga, carrying the visual identity and history of Old Dhaka."
  });
}

function curzonHall(x,z) {
  const g=new THREE.Group();
  const red=0xa94f36, red2=0xc16a49, cream=0xe7c197;
  const body=box(1.75,.72,.80,red); body.position.y=.50; g.add(body);
  const center=box(.56,.96,.86,red2); center.position.y=.60; g.add(center);

  for(const px of [-.68,-.35,.35,.68]){
    const tower=cyl(.09,.11,.82,red2,12); tower.position.set(px,.51,.30); g.add(tower);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(.13,.28,12),mat(cream)); cap.position.set(px,.99,.30); g.add(cap);
  }

  for(const px of [-.52,0,.52]){
    const arch=box(.22,.28,.03,cream); arch.position.set(px,.35,.415); g.add(arch);
  }

  g.position.set(x,0,z);
  world.add(g);
  return register(g,{
    area:"DHAKA UNIVERSITY",
    title:"Curzon Hall",
    text:"A red-brick landmark of Dhaka University, known for its distinctive historic academic architecture."
  });
}

function sangsad(x,z) {
  const g=new THREE.Group();
  const concrete=0xc9c5b8, dark=0x4f605c;
  const base=box(2.15,.20,1.45,0xbdb7aa); base.position.y=.10; g.add(base);
  const main=box(1.20,1.20,1.05,concrete); main.position.y=.72; g.add(main);
  const sideL=box(.42,.86,1.10,0xd1cdbf); sideL.position.set(-.83,.55,0); g.add(sideL);
  const sideR=box(.42,.86,1.10,0xd1cdbf); sideR.position.set(.83,.55,0); g.add(sideR);
  const top=box(.95,.18,.92,0xb9b4a9); top.position.y=1.38; g.add(top);

  const ringMat=mat(dark);
  const fronts=[
    [-.34,.86,.535,.18],[.34,.86,.535,.18],
    [0,.48,.535,.22],[0,1.16,.535,.16]
  ];
  fronts.forEach(([px,py,pz,r])=>{
    const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.045,12,28),ringMat);
    ring.position.set(px,py,pz);
    g.add(ring);
  });

  g.position.set(x,0,z);
  world.add(g);
  return register(g,{
    area:"SHER-E-BANGLA NAGAR",
    title:"Jatiyo Sangsad Bhaban",
    text:"One of Dhaka's defining modern landmarks and a globally recognized work of architecture."
  });
}

function baitulMukarram(x,z) {
  const g=new THREE.Group();
  const cream=0xf0ede2, stone=0xb9b8ad, green=0x4b7160;
  const base=box(1.25,.16,1.15,stone); base.position.y=.08; g.add(base);
  const cube=box(.80,1.05,.80,cream); cube.position.y=.67; g.add(cube);
  const band=box(.84,.16,.84,green); band.position.y=.68; g.add(band);
  const top=box(.62,.16,.62,stone); top.position.y=1.27; g.add(top);

  const minaret=cyl(.08,.10,1.45,cream,16); minaret.position.set(.62,.72,.32); g.add(minaret);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.12,.22,16),mat(green)); cap.position.set(.62,1.55,.32); g.add(cap);

  g.position.set(x,0,z);
  world.add(g);
  return register(g,{
    area:"PALTAN · CENTRAL DHAKA",
    title:"Baitul Mukarram",
    text:"The national mosque of Bangladesh, recognized by its strong cubic form in central Dhaka."
  });
}

addGround();

road(0,-1.1,3.1,17);
road(-5.4,-1.2,2.4,10.8,Math.PI*.13);
road(5.4,-1.3,2.3,11.3,-Math.PI*.12);
road(0,-5.6,14.2,2.4);

sidewalk(-1.95,-1.1,.65,17);
sidewalk(1.95,-1.1,.65,17);
sidewalk(-5.4,-4.25,2.7,.55);
sidewalk(5.4,-4.25,2.7,.55);

for(let z=-7.1;z<5.8;z+=1.35){
  laneDash(0,z,.08,.62);
}
for(let x=-5.5;x<=5.5;x+=1.2){
  laneDash(x,-5.6,.58,.08);
}

zebra(0,-4.72,true);
zebra(-4.55,-5.6,false);
zebra(4.55,-5.6,false);

const houses = [
  [-7.6,-4.6,1.4,.9,.82,0xe9bf83,0x9f4635,.05],
  [-6.6,-2.9,1.25,.85,.75,0xc6d1a0,0x8e4936,.1],
  [-6.7,-.9,1.35,.9,.86,0xe4a785,0xa44b38,.1],
  [-6.2,1.1,1.2,.8,.72,0xd0b18b,0x8d4a38,.18],
  [-5.6,2.7,1.15,.8,.70,0xb8c7a0,0x8e4833,.12],
  [7.5,-4.8,1.4,.9,.78,0xe1b782,0x9a4534,-.05],
  [6.6,-3.0,1.25,.85,.80,0xc5cf9a,0x954b39,-.08],
  [6.8,-1.0,1.35,.9,.85,0xe0a48a,0x9e4436,-.08],
  [6.2,1.0,1.2,.82,.76,0xd9bb93,0x984b37,-.16],
  [5.7,2.8,1.18,.82,.72,0xbac8a6,0x8d4737,-.1]
];
houses.forEach(h=>house(...h));

commercial(-4.0,2.7,1.45,.85,1.15,0xe2b88d,0x4d907d);
commercial(4.0,2.65,1.45,.85,1.20,0xd4c7a1,0xcf6f4e);
commercial(-7.5,1.5,1.30,.80,.95,0xaac0a0,0xd88a50);
commercial(7.4,1.6,1.35,.80,1.0,0xe7b996,0x4f8e95);

shaheedMinar(-2.0,2.0);
ahsanManzil(2.8,2.3);
curzonHall(-4.1,.3);
sangsad(4.25,.15);
baitulMukarram(1.0,4.0);

[
  [-8.1,-2.1,1.0],[-7.4,-.3,.9],[-7.0,2.8,1.05],[-5.1,3.9,.95],[-2.9,4.2,1.0],
  [2.6,4.45,.95],[5.2,3.9,1.05],[7.3,3.1,1.0],[8.0,.5,.95],[7.8,-2.2,1.0],
  [-2.7,-6.9,.9],[2.8,-6.8,.95],[-4.7,-6.9,.9],[5.0,-6.85,.9]
].forEach(v=>tree(...v));

[
  [-1.55,-3.9],[-1.55,-2.1],[-1.55,.2],[-1.55,3.6],
  [1.55,-3.7],[1.55,-1.8],[1.55,.7],[1.55,3.2]
].forEach(v=>lamp(...v));

stall(-2.45,-3.9,.1);
stall(2.55,-3.7,-.15);
stall(-6.0,-5.05,.05);

rickshaw(-.65,-2.7,0);
rickshaw(.75,.5,Math.PI);
rickshaw(-4.8,-4.8,Math.PI*.48);

const busA=bus(.55,-4.8,0xd94d41);
animatedVehicles.push({obj:busA, axis:"x", min:-4.0,max:4.1,speed:.010,dir:1});
const busB=bus(-.55,2.6,0x4f8e70);
busB.rotation.y=Math.PI;
animatedVehicles.push({obj:busB, axis:"z", min:-3.5,max:3.6,speed:.008,dir:-1});

function metroLine() {
  const g=new THREE.Group();
  const deck=box(8.6,.14,.42,0xbfc6c5); deck.position.y=2.15;
  g.add(deck);
  for(let x=-3.8;x<=3.8;x+=1.9){
    const p=box(.18,2.15,.18,0xaeb6b5); p.position.set(x,1.08,0); g.add(p);
  }
  const rail1=box(8.6,.05,.05,0x5b6262); rail1.position.set(0,2.24,-.12);
  const rail2=rail1.clone(); rail2.position.z=.12;
  g.add(rail1,rail2);

  const train=new THREE.Group();
  const body=box(1.6,.45,.38,0xe9eeee); body.position.y=2.48; train.add(body);
  const stripe=box(1.62,.08,.39,0xd54f4c); stripe.position.y=2.48; train.add(stripe);
  const wind=box(.30,.22,.40,0x5f8da0); wind.position.set(.62,2.54,0); train.add(wind);
  train.position.x=-2.8;
  g.add(train);

  g.position.set(0,0,5.0);
  world.add(g);
  animatedVehicles.push({obj:train, axis:"x", min:-3.1,max:3.1,speed:.013,dir:1});
}
metroLine();

function showLandmark(index) {
  const item=landmarks[index];
  if(!item) return;
  const data=item.userData.info;
  activeIndex=index;

  popArea.textContent=data.area;
  popTitle.textContent=data.title;
  popText.textContent=data.text;
  pop.hidden=false;

  storyTitle.textContent=data.title;
  storyText.textContent=data.text;
  storyProgress.textContent=(index+1)+" / 5";
  nextStoryLabel.textContent="Next: "+landmarks[(index+1)%landmarks.length].userData.info.title;

  const pos=new THREE.Vector3();
  item.getWorldPosition(pos);
  focusTarget=pos.clone();
  focusTarget.y=.55;
  const dir=new THREE.Vector3(pos.x*.30+0.3,6.2,pos.z+9.5);
  focusCamera=dir;
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
  focusCamera=null;
  focusTarget=null;
  walkMode=false;
  document.querySelector("#walkBtn").textContent="Walk";
});

document.querySelector("#popClose").addEventListener("click",()=>{pop.hidden=true;});
document.querySelector("#nextStory").addEventListener("click",nextLandmark);

document.querySelector("#minStory").addEventListener("click",()=>{
  storyCard.classList.toggle("minimized");
});

document.querySelector("#zoomIn").addEventListener("click",()=>{
  camera.position.lerp(controls.target,.12);
});
document.querySelector("#zoomOut").addEventListener("click",()=>{
  const away=camera.position.clone().sub(controls.target).multiplyScalar(1.12);
  camera.position.copy(controls.target.clone().add(away));
});

document.querySelector("#cityBtn").addEventListener("click",()=>{
  focusCamera=new THREE.Vector3(.2,7.2,13.4);
  focusTarget=new THREE.Vector3(0,.6,-1.2);
  pop.hidden=true;
});

document.querySelector("#storyBtn").addEventListener("click",()=>{
  nextLandmark();
});

document.querySelector("#walkBtn").addEventListener("click",()=>{
  walkMode=!walkMode;
  document.querySelector("#walkBtn").textContent=walkMode?"Stop":"Walk";
  focusCamera=null;
  focusTarget=null;
});

document.querySelector("#mapBtn").addEventListener("click",()=>{
  document.querySelector("#mapCard").classList.toggle("hidden");
});

document.querySelector("#helpBtn").addEventListener("click",()=>{
  storyTitle.textContent="How to explore";
  storyText.textContent="Drag the city to look around, scroll to zoom, and click the major landmarks for stories.";
  storyProgress.textContent="TIP";
  nextStoryLabel.textContent="Start with Shaheed Minar";
});

document.querySelector("#soundBtn").addEventListener("click",(e)=>{
  e.currentTarget.textContent=e.currentTarget.textContent==="♪"?"♫":"♪";
});

function resize(){
  const w=stage.clientWidth;
  const h=stage.clientHeight;
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

  if(focusCamera && focusTarget){
    camera.position.lerp(focusCamera,.055);
    controls.target.lerp(focusTarget,.055);
    if(camera.position.distanceTo(focusCamera)<.035){
      focusCamera=null;
      focusTarget=null;
    }
  }

  if(walkMode){
    walkT+=.0022;
    const z=3.2-Math.sin(walkT)*5.3;
    camera.position.lerp(new THREE.Vector3(.25,2.35,z+5.8),.025);
    controls.target.lerp(new THREE.Vector3(.15,.55,z),.03);
  }

  controls.update();
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}

requestAnimationFrame(()=>{
  loader.classList.add("done");
  animate();
});
