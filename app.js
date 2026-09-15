import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.querySelector("#cityCanvas");
const sceneWrap = document.querySelector(".scene-wrap");
const card = document.querySelector("#landmarkCard");
const cardTitle = document.querySelector("#cardTitle");
const cardArea = document.querySelector("#cardArea");
const cardText = document.querySelector("#cardText");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 2.4, 9.7);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 6.3;
controls.maxDistance = 13;
controls.target.set(0, 0, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.48;

const ambient = new THREE.HemisphereLight(0xf7fbff, 0x24451f, 2.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff5d7, 4.5);
sun.position.set(5, 8, 6);
sun.castShadow = true;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xa7c8ff, 1.8);
fill.position.set(-5, 1, -4);
scene.add(fill);

const world = new THREE.Group();
world.rotation.z = -0.14;
world.rotation.x = -0.08;
scene.add(world);

const planetRadius = 3.2;
const planet = new THREE.Mesh(
  new THREE.SphereGeometry(planetRadius, 64, 64),
  new THREE.MeshStandardMaterial({
    color: 0x86ad61,
    roughness: 0.98,
    metalness: 0
  })
);
planet.receiveShadow = true;
world.add(planet);

function makePatch(color, theta, phi, scaleX, scaleY) {
  const geo = new THREE.CircleGeometry(0.72, 28);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    side: THREE.DoubleSide
  });
  const patch = new THREE.Mesh(geo, mat);
  patch.scale.set(scaleX, scaleY, 1);
  placeOnSphere(patch, theta, phi, planetRadius + 0.012, 0);
  world.add(patch);
  return patch;
}

function sphericalPoint(theta, phi, radius) {
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function orientOutward(obj, position) {
  const normal = position.clone().normalize();
  const q = new THREE.Quaternion();
  q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  obj.quaternion.copy(q);
}

function placeOnSphere(obj, theta, phi, radius = planetRadius, lift = 0) {
  const pos = sphericalPoint(theta, phi, radius + lift);
  obj.position.copy(pos);
  orientOutward(obj, pos);
  return obj;
}

makePatch(0x5faec0, 1.07, 1.23, 1.2, .55);
makePatch(0x5faec0, -2.0, 1.72, .65, .38);

function roadArc(points, width = 0.12) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => p.normalize().multiplyScalar(planetRadius + 0.032)));
  const geo = new THREE.TubeGeometry(curve, 60, width, 8, false);
  const mat = new THREE.MeshStandardMaterial({ color: 0x435557, roughness: 1 });
  const road = new THREE.Mesh(geo, mat);
  road.receiveShadow = true;
  world.add(road);
  return road;
}

roadArc([
  new THREE.Vector3(-1.8, 2.35, .6),
  new THREE.Vector3(-.7, 2.8, 1.3),
  new THREE.Vector3(.8, 2.72, 1.4),
  new THREE.Vector3(2.2, 2.0, .8)
], .12);

roadArc([
  new THREE.Vector3(-2.5, 1.2, 1.2),
  new THREE.Vector3(-1.0, 2.0, 2.1),
  new THREE.Vector3(.5, 2.3, 2.05),
  new THREE.Vector3(2.2, 1.55, 1.3)
], .105);

roadArc([
  new THREE.Vector3(-1.3, 2.5, -1.5),
  new THREE.Vector3(-.3, 3.0, -.7),
  new THREE.Vector3(.65, 3.0, .15),
  new THREE.Vector3(1.25, 2.55, 1.35)
], .09);

roadArc([
  new THREE.Vector3(-2.0, 2.0, -.2),
  new THREE.Vector3(-.7, 2.95, .0),
  new THREE.Vector3(.35, 2.92, .55),
  new THREE.Vector3(1.7, 2.1, .4)
], .085);

const clickable = [];

function box(w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: .82 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(r, h, color, segments = 20) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, segments),
    new THREE.MeshStandardMaterial({ color, roughness: .78 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function registerLandmark(group, data) {
  group.userData.landmark = data;
  group.traverse(obj => {
    if (obj.isMesh) {
      obj.userData.landmarkRoot = group;
      clickable.push(obj);
    }
  });
  return group;
}

function addBuilding(theta, phi, options = {}) {
  const { color = 0xe7d9a9, width = .25, depth = .25, height = .45 } = options;
  const b = box(width, height, depth, color);
  b.geometry.translate(0, height / 2, 0);
  placeOnSphere(b, theta, phi, planetRadius + .02);
  world.add(b);
  return b;
}

function addTree(theta, phi, scale = 1) {
  const g = new THREE.Group();
  const trunk = cylinder(.035 * scale, .20 * scale, 0x7d5134, 8);
  trunk.position.y = .10 * scale;
  const crown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(.14 * scale, 1),
    new THREE.MeshStandardMaterial({ color: 0x3c7b43, roughness: 1 })
  );
  crown.position.y = .27 * scale;
  crown.castShadow = true;
  g.add(trunk, crown);
  placeOnSphere(g, theta, phi, planetRadius + .02);
  world.add(g);
  return g;
}

const buildingColors = [0xe7d49f, 0xe79b79, 0xb7d5d1, 0xf3e7c4, 0x8db4b8];
const citySpots = [
  [-1.10,1.00],[-.82,.91],[-.45,.96],[-.10,1.05],[.30,1.04],[.62,.95],[.94,1.06],
  [-1.24,1.27],[-.94,1.22],[-.56,1.30],[-.18,1.24],[.18,1.31],[.57,1.23],[.94,1.29],
  [-1.34,1.52],[-1.03,1.50],[-.70,1.55],[-.35,1.52],[.02,1.54],[.39,1.51],[.79,1.55],
  [-1.15,1.79],[-.82,1.78],[-.46,1.82],[-.08,1.80],[.31,1.78],[.66,1.83]
];

citySpots.forEach(([theta,phi], i) => {
  const h = .18 + (i % 5) * .055;
  addBuilding(theta, phi, {
    color: buildingColors[i % buildingColors.length],
    width: .18 + (i % 3) * .04,
    depth: .18 + ((i + 1) % 3) * .035,
    height: h
  });
});

[
  [-1.48,1.08],[-1.32,.90],[-.65,.76],[-.25,.80],[.18,.79],[.68,.80],
  [1.15,.98],[1.27,1.25],[1.20,1.62],[.95,1.78],[.48,1.93],[-.10,1.94],
  [-.62,1.96],[-1.06,1.88],[-1.44,1.72],[-1.60,1.42]
].forEach(([t,p],i)=>addTree(t,p, .9 + (i%3)*.12));

function makeSangsad() {
  const g = new THREE.Group();
  const base = box(.72, .13, .62, 0xd8d2bd);
  base.position.y = .065;
  const core = box(.48, .44, .44, 0xc8c3b3);
  core.position.y = .35;

  const circleMat = new THREE.MeshStandardMaterial({ color: 0x4c5e59, roughness: .7 });
  for (const [x,z] of [[.245,0],[-.245,0],[0,.225],[0,-.225]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.085,.022,10,24), circleMat);
    ring.rotation.x = Math.PI/2;
    ring.position.set(x,.38,z);
    g.add(ring);
  }
  g.add(base, core);
  placeOnSphere(g, -.2, .78, planetRadius + .015);
  world.add(g);
  return registerLandmark(g,{
    title:"Jatiyo Sangsad Bhaban",
    area:"SHER-E-BANGLA NAGAR",
    text:"A landmark of modern Dhaka and one of the city's most recognizable architectural forms."
  });
}
makeSangsad();

function makeShaheedMinar() {
  const g = new THREE.Group();
  const base = box(.56,.06,.34,0xf1ede2);
  base.position.y=.03;
  g.add(base);
  for (let i=-2;i<=2;i++) {
    const p = box(.06,.34 + (2-Math.abs(i))*.06,.07,0xf8f6ef);
    p.position.set(i*.09,.18 + (2-Math.abs(i))*.03,0);
    p.rotation.z = i*.02;
    g.add(p);
  }
  const sunDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(.105,.105,.025,32),
    new THREE.MeshStandardMaterial({color:0xd34e47, roughness:.8})
  );
  sunDisc.rotation.x = Math.PI/2;
  sunDisc.position.set(0,.28,-.055);
  g.add(sunDisc);
  placeOnSphere(g, -.78, 1.02, planetRadius + .02);
  world.add(g);
  return registerLandmark(g,{
    title:"Central Shaheed Minar",
    area:"DHAKA UNIVERSITY AREA",
    text:"A powerful symbol of the Bengali Language Movement and a central place of remembrance in Dhaka."
  });
}
makeShaheedMinar();

function makeAhsan() {
  const g = new THREE.Group();
  const body = box(.58,.26,.34,0xe58b9d);
  body.position.y=.16;
  const wing1 = box(.19,.18,.30,0xdd8295); wing1.position.set(-.36,.12,0);
  const wing2 = box(.19,.18,.30,0xdd8295); wing2.position.set(.36,.12,0);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(.13,24,16,0,Math.PI*2,0,Math.PI/2),
    new THREE.MeshStandardMaterial({color:0xe1a5b2,roughness:.8})
  );
  dome.position.y=.42;
  g.add(body,wing1,wing2,dome);
  placeOnSphere(g, .42, 1.06, planetRadius + .02);
  world.add(g);
  return registerLandmark(g,{
    title:"Ahsan Manzil",
    area:"OLD DHAKA",
    text:"The iconic pink palace on the Buriganga side of Old Dhaka, now preserved as a museum."
  });
}
makeAhsan();

function makeLalbagh() {
  const g = new THREE.Group();
  const base = box(.58,.11,.42,0xb96445); base.position.y=.055;
  const hall = box(.34,.19,.27,0xc36d4e); hall.position.y=.16;
  g.add(base,hall);
  for(const x of [-.16,0,.16]) {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(.055,16,10,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshStandardMaterial({color:0xe9d7bf,roughness:.85})
    );
    dome.position.set(x,.285,0);
    g.add(dome);
  }
  placeOnSphere(g, .89, 1.28, planetRadius + .02);
  world.add(g);
  return registerLandmark(g,{
    title:"Lalbagh Fort",
    area:"LALBAGH · OLD DHAKA",
    text:"A Mughal-era fort complex that remains one of the most distinctive historic sites in the capital."
  });
}
makeLalbagh();

function makeBaitul() {
  const g = new THREE.Group();
  const plinth = box(.48,.08,.48,0xe8e4d8); plinth.position.y=.04;
  const cube = box(.33,.34,.33,0xf5f2e8); cube.position.y=.24;
  const band = box(.35,.05,.35,0x6e756d); band.position.y=.24;
  g.add(plinth,cube,band);
  placeOnSphere(g, -1.12, 1.35, planetRadius + .02);
  world.add(g);
  return registerLandmark(g,{
    title:"Baitul Mukarram",
    area:"MOTIJHEEL / PALTAN",
    text:"The national mosque of Bangladesh, known for its monumental cubic architectural character."
  });
}
makeBaitul();

function makeMetro() {
  const g = new THREE.Group();
  const deck = box(1.25,.055,.09,0xc4c8c6); deck.position.y=.34;
  g.add(deck);
  for (const x of [-.48,0,.48]) {
    const pillar = box(.045,.34,.045,0xb5bab8);
    pillar.position.set(x,.17,0);
    g.add(pillar);
  }
  const train = box(.36,.11,.10,0xf2f2ee);
  train.position.set(.18,.43,0);
  const stripe = box(.37,.025,.104,0xe03838);
  stripe.position.set(.18,.43,.001);
  g.add(train,stripe);
  placeOnSphere(g, -.34, 1.45, planetRadius + .02);
  world.add(g);
  return registerLandmark(g,{
    title:"Dhaka Metro Rail",
    area:"MRT LINE 6",
    text:"A symbol of a changing Dhaka and one of the most visible additions to the city's transport network."
  });
}
makeMetro();

function makeSadarghat() {
  const g = new THREE.Group();
  const pier = box(.48,.06,.20,0x8b6f52); pier.position.y=.03;
  const boat = box(.32,.08,.10,0xe8e0c7); boat.position.set(.05,.11,-.15);
  const roof = box(.22,.055,.08,0x5a8b9a); roof.position.set(.05,.175,-.15);
  g.add(pier,boat,roof);
  placeOnSphere(g, .95, 1.62, planetRadius + .02);
  world.add(g);
  return registerLandmark(g,{
    title:"Sadarghat",
    area:"BURIGANGA RIVERFRONT",
    text:"One of Dhaka's busiest river gateways, shaped by launches, ferries, trade and everyday movement."
  });
}
makeSadarghat();

function makeCurzon() {
  const g = new THREE.Group();
  const body = box(.52,.22,.28,0xb9573e); body.position.y=.14;
  g.add(body);
  for (const x of [-.19,0,.19]) {
    const tower = cylinder(.045,.26,0xd47554,12);
    tower.position.set(x,.19,.13);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(.065,.08,12),
      new THREE.MeshStandardMaterial({color:0xe4b591,roughness:.85})
    );
    cap.position.set(x,.36,.13);
    g.add(tower,cap);
  }
  placeOnSphere(g, .18, .90, planetRadius + .02);
  world.add(g);
  return registerLandmark(g,{
    title:"Curzon Hall",
    area:"DHAKA UNIVERSITY",
    text:"A historic red-brick academic landmark and one of the most recognizable buildings around Dhaka University."
  });
}
makeCurzon();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function showLandmark(data) {
  cardArea.textContent = data.area;
  cardTitle.textContent = data.title;
  cardText.textContent = data.text;
  card.hidden = false;
}

function pointerToNDC(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

canvas.addEventListener("pointermove", (event) => {
  pointerToNDC(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickable, false);
  canvas.style.cursor = hits.length ? "pointer" : "grab";
});

canvas.addEventListener("click", (event) => {
  pointerToNDC(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickable, false);
  if (!hits.length) return;
  const root = hits[0].object.userData.landmarkRoot;
  if (root?.userData?.landmark) {
    controls.autoRotate = false;
    showLandmark(root.userData.landmark);
  }
});

document.querySelector("#cardClose").addEventListener("click", () => card.hidden = true);

document.querySelector("#resetBtn").addEventListener("click", () => {
  camera.position.set(0, 2.4, 9.7);
  controls.target.set(0, 0, 0);
  controls.autoRotate = true;
  card.hidden = true;
});

document.querySelector("#exploreBtn").addEventListener("click", () => {
  controls.autoRotate = false;
  camera.position.set(0, 1.6, 7.25);
  controls.update();
  if (window.innerWidth <= 920) {
    sceneWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

const aboutPanel = document.querySelector("#aboutPanel");
document.querySelector("#aboutBtn").addEventListener("click", () => aboutPanel.hidden = false);
document.querySelector("#aboutClose").addEventListener("click", () => aboutPanel.hidden = true);

const soundBtn = document.querySelector("#soundBtn");
let soundState = false;
soundBtn.addEventListener("click", () => {
  soundState = !soundState;
  soundBtn.textContent = soundState ? "♫" : "♪";
  soundBtn.title = soundState
    ? "Sound UI on — ambient audio comes in V0.2"
    : "Sound prototype";
});

function resize() {
  const width = sceneWrap.clientWidth;
  const height = sceneWrap.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
