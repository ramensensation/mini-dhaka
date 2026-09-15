import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.querySelector("#cityCanvas");
const sceneWrap = document.querySelector("#sceneWrap");
const hotspotLayer = document.querySelector("#hotspotLayer");
const stripScroll = document.querySelector("#stripScroll");
const card = document.querySelector("#landmarkCard");
const cardTitle = document.querySelector("#cardTitle");
const cardArea = document.querySelector("#cardArea");
const cardText = document.querySelector("#cardText");
const cardCount = document.querySelector("#cardCount");
const toast = document.querySelector("#toast");
const loadingScreen = document.querySelector("#loadingScreen");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0.2, 2.35, 9.8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 6.1;
controls.maxDistance = 12.8;
controls.target.set(0, 0, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.34;

scene.add(new THREE.HemisphereLight(0xf6fbff, 0x264a29, 2.55));

const sun = new THREE.DirectionalLight(0xfff1ce, 4.6);
sun.position.set(5, 8, 6);
sun.castShadow = true;
scene.add(sun);

const fill = new THREE.DirectionalLight(0x9ac5ff, 1.9);
fill.position.set(-5, 2, -4);
scene.add(fill);

const world = new THREE.Group();
world.rotation.z = -0.11;
world.rotation.x = -0.05;
scene.add(world);

const cloudLayer = new THREE.Group();
world.add(cloudLayer);

const planetRadius = 3.18;
const planet = new THREE.Mesh(
  new THREE.SphereGeometry(planetRadius, 72, 72),
  new THREE.MeshStandardMaterial({ color: 0x82aa61, roughness: 0.97, metalness: 0 })
);
planet.receiveShadow = true;
world.add(planet);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(planetRadius + 0.055, 48, 48),
  new THREE.MeshBasicMaterial({
    color: 0xb9e6ff,
    transparent: true,
    opacity: 0.055,
    side: THREE.BackSide
  })
);
world.add(atmosphere);

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

function makePatch(color, theta, phi, scaleX, scaleY, opacity = 1) {
  const geo = new THREE.CircleGeometry(0.72, 30);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity
  });
  const patch = new THREE.Mesh(geo, mat);
  patch.scale.set(scaleX, scaleY, 1);
  placeOnSphere(patch, theta, phi, planetRadius + 0.018);
  world.add(patch);
  return patch;
}

makePatch(0x55a9bd, 1.07, 1.24, 1.35, .58);
makePatch(0x55a9bd, -2.05, 1.73, .78, .42);
makePatch(0x6d9552, -.08, .56, 1.05, .55);
makePatch(0xa5bd75, -1.10, 1.12, .85, .55);

function roadArc(points, width = 0.1, color = 0x425657) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => p.normalize().multiplyScalar(planetRadius + 0.038))
  );
  const geo = new THREE.TubeGeometry(curve, 70, width, 8, false);
  const road = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness: 1 })
  );
  road.receiveShadow = true;
  world.add(road);
  return road;
}

roadArc([
  new THREE.Vector3(-1.8, 2.35, .6),
  new THREE.Vector3(-.7, 2.8, 1.3),
  new THREE.Vector3(.8, 2.72, 1.4),
  new THREE.Vector3(2.2, 2.0, .8)
], .115);

roadArc([
  new THREE.Vector3(-2.5, 1.2, 1.2),
  new THREE.Vector3(-1.0, 2.0, 2.1),
  new THREE.Vector3(.5, 2.3, 2.05),
  new THREE.Vector3(2.2, 1.55, 1.3)
], .098);

roadArc([
  new THREE.Vector3(-1.3, 2.5, -1.5),
  new THREE.Vector3(-.3, 3.0, -.7),
  new THREE.Vector3(.65, 3.0, .15),
  new THREE.Vector3(1.25, 2.55, 1.35)
], .083);

roadArc([
  new THREE.Vector3(-2.0, 2.0, -.2),
  new THREE.Vector3(-.7, 2.95, .0),
  new THREE.Vector3(.35, 2.92, .55),
  new THREE.Vector3(1.7, 2.1, .4)
], .079);

const clickable = [];
const landmarks = [];
let activeLandmarkIndex = -1;
let focusCameraTarget = null;
let focusLookTarget = null;
let toastTimer = null;

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
  group.userData.landmarkIndex = landmarks.length;
  landmarks.push(group);

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.userData.landmarkRoot = group;
      clickable.push(obj);
    }
  });

  const hotspot = document.createElement("button");
  hotspot.className = "hotspot";
  hotspot.type = "button";
  hotspot.innerHTML =
    '<span class="hotspot-inner"><span class="hotspot-dot"></span><span class="hotspot-label">' +
    data.short +
    "</span></span>";
  hotspot.addEventListener("click", () => focusLandmark(group.userData.landmarkIndex));
  hotspotLayer.appendChild(hotspot);
  group.userData.hotspot = hotspot;

  const quick = document.createElement("button");
  quick.className = "strip-btn";
  quick.type = "button";
  quick.textContent = data.short;
  quick.addEventListener("click", () => focusLandmark(group.userData.landmarkIndex));
  stripScroll.appendChild(quick);

  return group;
}

function addBuilding(theta, phi, options = {}) {
  const color = options.color ?? 0xe7d9a9;
  const width = options.width ?? .25;
  const depth = options.depth ?? .25;
  const height = options.height ?? .45;

  const g = new THREE.Group();
  const body = box(width, height, depth, color);
  body.geometry.translate(0, height / 2, 0);
  g.add(body);

  if (height > .33) {
    const roof = box(width * .72, .035, depth * .72, 0xe9e1c5);
    roof.position.y = height + .018;
    g.add(roof);
  }

  placeOnSphere(g, theta, phi, planetRadius + .02);
  world.add(g);
  return g;
}

function addTree(theta, phi, scale = 1) {
  const g = new THREE.Group();
  const trunk = cylinder(.032 * scale, .18 * scale, 0x775038, 7);
  trunk.position.y = .09 * scale;
  const crown = new THREE.Mesh(
    new THREE.IcosahedronGeometry(.14 * scale, 1),
    new THREE.MeshStandardMaterial({ color: 0x397843, roughness: 1 })
  );
  crown.position.y = .25 * scale;
  crown.castShadow = true;
  g.add(trunk, crown);
  placeOnSphere(g, theta, phi, planetRadius + .02);
  world.add(g);
}

function addStreetLight(theta, phi) {
  const g = new THREE.Group();
  const pole = cylinder(.008, .16, 0x4f5955, 6);
  pole.position.y = .08;
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(.018, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xffe38b, emissive: 0xffc53d, emissiveIntensity: 1.4 })
  );
  glow.position.y = .17;
  g.add(pole, glow);
  placeOnSphere(g, theta, phi, planetRadius + .03);
  world.add(g);
}

const buildingColors = [0xe7d49f, 0xe99878, 0xb2d1cc, 0xf0e5c2, 0x91b5bb, 0xd9c2a0];
const citySpots = [
  [-1.12,.97],[-.90,.90],[-.67,.94],[-.43,.95],[-.18,1.00],[.08,1.03],[.34,1.00],[.61,.94],[.89,1.03],
  [-1.28,1.20],[-1.04,1.18],[-.79,1.22],[-.54,1.28],[-.29,1.20],[-.04,1.27],[.23,1.31],[.50,1.20],[.78,1.24],[1.02,1.31],
  [-1.36,1.48],[-1.11,1.48],[-.87,1.54],[-.61,1.50],[-.36,1.55],[-.10,1.50],[.17,1.55],[.44,1.48],[.70,1.53],[.94,1.50],
  [-1.20,1.76],[-.95,1.78],[-.67,1.82],[-.40,1.77],[-.13,1.83],[.15,1.79],[.43,1.78],[.70,1.82]
];

citySpots.forEach(([theta, phi], i) => {
  const h = .16 + (i % 6) * .052;
  addBuilding(theta, phi, {
    color: buildingColors[i % buildingColors.length],
    width: .16 + (i % 3) * .042,
    depth: .16 + ((i + 1) % 3) * .035,
    height: h
  });
});

[
  [-1.52,1.05],[-1.33,.87],[-.98,.76],[-.63,.75],[-.28,.78],[.10,.77],[.52,.78],[.91,.84],
  [1.20,1.00],[1.31,1.27],[1.24,1.58],[1.04,1.79],[.77,1.91],[.44,1.96],[.08,1.98],
  [-.30,1.98],[-.68,1.95],[-1.00,1.88],[-1.30,1.76],[-1.51,1.58],[-1.64,1.34]
].forEach(([t,p],i) => addTree(t,p,.82 + (i % 4) * .09));

[
  [-1.04,1.07],[-.73,1.14],[-.39,1.12],[-.01,1.15],[.35,1.15],[.69,1.11],
  [-.95,1.58],[-.58,1.62],[-.22,1.64],[.18,1.62],[.55,1.60]
].forEach(([t,p]) => addStreetLight(t,p));

function addCloud(theta, phi, scale) {
  const g = new THREE.Group();
  for (const [x,y,s] of [[-.08,0,.10],[0,.025,.13],[.10,0,.095]]) {
    const cloud = new THREE.Mesh(
      new THREE.IcosahedronGeometry(s * scale, 1),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .72, roughness: 1 })
    );
    cloud.position.set(x * scale, y * scale, 0);
    g.add(cloud);
  }
  placeOnSphere(g, theta, phi, planetRadius + .68);
  cloudLayer.add(g);
}

[[-1.5,.75,1.2],[-.4,.53,.9],[.95,.72,1.1],[2.2,1.12,.85],[-2.3,1.48,.95]].forEach((v)=>addCloud(v[0],v[1],v[2]));

function makeSangsad() {
  const g = new THREE.Group();
  const plinth = box(.78,.12,.66,0xd9d3c0); plinth.position.y=.06;
  const core = box(.50,.46,.46,0xc9c4b5); core.position.y=.35;
  const sideL = box(.14,.30,.42,0xd1ccbd); sideL.position.set(-.32,.25,0);
  const sideR = box(.14,.30,.42,0xd1ccbd); sideR.position.set(.32,.25,0);
  g.add(plinth,core,sideL,sideR);
  const circleMat = new THREE.MeshStandardMaterial({ color:0x53625e, roughness:.7 });
  for (const [x,z] of [[.255,0],[-.255,0],[0,.235],[0,-.235]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.085,.020,10,26),circleMat);
    ring.rotation.x = Math.PI/2;
    ring.position.set(x,.37,z);
    g.add(ring);
  }
  placeOnSphere(g,-.20,.78,planetRadius+.018);
  world.add(g);
  return registerLandmark(g,{
    short:"Jatiyo Sangsad",
    title:"Jatiyo Sangsad Bhaban",
    area:"SHER-E-BANGLA NAGAR",
    text:"A defining work of modern architecture and one of the most recognizable symbols of Dhaka."
  });
}

function makeShaheedMinar() {
  const g = new THREE.Group();
  const base = box(.58,.055,.35,0xf0ede4); base.position.y=.028; g.add(base);
  for (let i=-2;i<=2;i++) {
    const h=.31+(2-Math.abs(i))*.06;
    const p=box(.055,h,.065,0xf7f5ef);
    p.position.set(i*.095,h/2+.055,0);
    p.rotation.z=i*.025;
    g.add(p);
  }
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(.108,.108,.024,32),
    new THREE.MeshStandardMaterial({color:0xd74e49,roughness:.78})
  );
  disc.rotation.x=Math.PI/2;
  disc.position.set(0,.29,-.055);
  g.add(disc);
  placeOnSphere(g,-.78,1.02,planetRadius+.02);
  world.add(g);
  return registerLandmark(g,{
    short:"Shaheed Minar",
    title:"Central Shaheed Minar",
    area:"DHAKA UNIVERSITY AREA",
    text:"A national symbol of the Bengali Language Movement and a central place of remembrance in the capital."
  });
}

function makeAhsan() {
  const g=new THREE.Group();
  const body=box(.56,.25,.33,0xe38da1); body.position.y=.155;
  const wing1=box(.18,.17,.29,0xdb8196); wing1.position.set(-.36,.11,0);
  const wing2=box(.18,.17,.29,0xdb8196); wing2.position.set(.36,.11,0);
  const dome=new THREE.Mesh(
    new THREE.SphereGeometry(.13,24,16,0,Math.PI*2,0,Math.PI/2),
    new THREE.MeshStandardMaterial({color:0xf0b0bd,roughness:.82})
  );
  dome.position.y=.41;
  const crown=cylinder(.018,.10,0xd9c9b5,10); crown.position.y=.49;
  g.add(body,wing1,wing2,dome,crown);
  placeOnSphere(g,.42,1.06,planetRadius+.02);
  world.add(g);
  return registerLandmark(g,{
    short:"Ahsan Manzil",
    title:"Ahsan Manzil",
    area:"OLD DHAKA",
    text:"The iconic pink palace beside the Buriganga, carrying the character and history of Old Dhaka."
  });
}

function makeLalbagh() {
  const g=new THREE.Group();
  const base=box(.60,.10,.43,0xb96545); base.position.y=.05;
  const hall=box(.35,.18,.28,0xc66e4e); hall.position.y=.15;
  g.add(base,hall);
  for(const x of [-.16,0,.16]) {
    const dome=new THREE.Mesh(
      new THREE.SphereGeometry(.055,16,10,0,Math.PI*2,0,Math.PI/2),
      new THREE.MeshStandardMaterial({color:0xeadac3,roughness:.85})
    );
    dome.position.set(x,.27,0);
    g.add(dome);
  }
  placeOnSphere(g,.89,1.28,planetRadius+.02);
  world.add(g);
  return registerLandmark(g,{
    short:"Lalbagh Fort",
    title:"Lalbagh Fort",
    area:"LALBAGH · OLD DHAKA",
    text:"A Mughal-era fort complex that remains one of Dhaka's most distinctive historic places."
  });
}

function makeBaitul() {
  const g=new THREE.Group();
  const plinth=box(.50,.075,.50,0xe6e2d7); plinth.position.y=.038;
  const cube=box(.34,.35,.34,0xf2f0e7); cube.position.y=.25;
  const band=box(.355,.055,.355,0x737972); band.position.y=.25;
  const top=box(.24,.06,.24,0xd8d8d0); top.position.y=.455;
  g.add(plinth,cube,band,top);
  placeOnSphere(g,-1.12,1.35,planetRadius+.02);
  world.add(g);
  return registerLandmark(g,{
    short:"Baitul Mukarram",
    title:"Baitul Mukarram",
    area:"PALTAN · CENTRAL DHAKA",
    text:"The national mosque of Bangladesh, known for its monumental cubic architectural form."
  });
}

function makeMetro() {
  const g=new THREE.Group();
  const deck=box(1.22,.055,.09,0xc3c8c7); deck.position.y=.34; g.add(deck);
  for(const x of [-.48,0,.48]) {
    const pillar=box(.045,.34,.045,0xb7bcbb); pillar.position.set(x,.17,0); g.add(pillar);
  }
  const train=box(.37,.115,.105,0xf0f2f0); train.position.set(.15,.43,0);
  const stripe=box(.38,.025,.11,0xd94e4d); stripe.position.set(.15,.43,.002);
  const windshield=box(.07,.055,.112,0x547b8f); windshield.position.set(.31,.445,.002);
  g.add(train,stripe,windshield);
  placeOnSphere(g,-.34,1.45,planetRadius+.02);
  world.add(g);
  return registerLandmark(g,{
    short:"Metro Rail",
    title:"Dhaka Metro Rail",
    area:"MRT LINE 6",
    text:"A visible symbol of a changing Dhaka and a major new chapter in the city's everyday movement."
  });
}

function makeSadarghat() {
  const g=new THREE.Group();
  const pier=box(.49,.055,.21,0x8a6e53); pier.position.y=.027;
  const hull=box(.33,.075,.105,0xe8e0c8); hull.position.set(.05,.105,-.15);
  const roof=box(.23,.052,.085,0x4f8e9d); roof.position.set(.05,.17,-.15);
  const cabin=box(.11,.07,.08,0xf2ead8); cabin.position.set(-.05,.145,-.15);
  g.add(pier,hull,roof,cabin);
  placeOnSphere(g,.95,1.62,planetRadius+.02);
  world.add(g);
  return registerLandmark(g,{
    short:"Sadarghat",
    title:"Sadarghat",
    area:"BURIGANGA RIVERFRONT",
    text:"One of Dhaka's busiest river gateways, shaped by launches, ferries, trade and constant movement."
  });
}

function makeCurzon() {
  const g=new THREE.Group();
  const body=box(.53,.22,.29,0xb95840); body.position.y=.14; g.add(body);
  for(const x of [-.19,0,.19]) {
    const tower=cylinder(.044,.26,0xd47554,12); tower.position.set(x,.19,.13);
    const cap=new THREE.Mesh(
      new THREE.ConeGeometry(.064,.078,12),
      new THREE.MeshStandardMaterial({color:0xe2b38d,roughness:.85})
    );
    cap.position.set(x,.36,.13);
    g.add(tower,cap);
  }
  placeOnSphere(g,.18,.90,planetRadius+.02);
  world.add(g);
  return registerLandmark(g,{
    short:"Curzon Hall",
    title:"Curzon Hall",
    area:"DHAKA UNIVERSITY",
    text:"A historic red-brick academic landmark and a beloved part of the Dhaka University landscape."
  });
}

makeSangsad();
makeShaheedMinar();
makeAhsan();
makeLalbagh();
makeBaitul();
makeMetro();
makeSadarghat();
makeCurzon();

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}

function showLandmark(index) {
  const group = landmarks[index];
  const data = group.userData.landmark;
  activeLandmarkIndex = index;
  cardArea.textContent = data.area;
  cardTitle.textContent = data.title;
  cardText.textContent = data.text;
  cardCount.textContent = String(index + 1).padStart(2, "0") + " / " + String(landmarks.length).padStart(2, "0");
  card.hidden = false;
}

function focusLandmark(index) {
  const group = landmarks[index];
  if (!group) return;

  controls.autoRotate = false;
  const pos = new THREE.Vector3();
  group.getWorldPosition(pos);
  const outward = pos.clone().normalize();
  focusCameraTarget = outward.multiplyScalar(7.45);
  focusCameraTarget.y += .42;
  focusLookTarget = pos.clone().multiplyScalar(.34);
  showLandmark(index);
}

function nextLandmark() {
  focusLandmark((activeLandmarkIndex + 1 + landmarks.length) % landmarks.length);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

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
  if (root) focusLandmark(root.userData.landmarkIndex);
});

controls.addEventListener("start", () => {
  controls.autoRotate = false;
  focusCameraTarget = null;
  focusLookTarget = null;
});

document.querySelector("#cardClose").addEventListener("click", () => { card.hidden = true; });
document.querySelector("#nextLandmark").addEventListener("click", nextLandmark);

document.querySelector("#resetBtn").addEventListener("click", () => {
  focusCameraTarget = new THREE.Vector3(.2,2.35,9.8);
  focusLookTarget = new THREE.Vector3(0,0,0);
  controls.autoRotate = true;
  card.hidden = true;
});

document.querySelector("#exploreBtn").addEventListener("click", () => {
  focusLandmark(0);
  if (window.innerWidth <= 920) sceneWrap.scrollIntoView({ behavior:"smooth", block:"start" });
});

document.querySelector("#tourBtn").addEventListener("click", () => {
  nextLandmark();
});

document.querySelector("#randomBtn").addEventListener("click", () => {
  let next = Math.floor(Math.random() * landmarks.length);
  if (next === activeLandmarkIndex) next = (next + 1) % landmarks.length;
  focusLandmark(next);
});

const aboutPanel = document.querySelector("#aboutPanel");
document.querySelector("#aboutBtn").addEventListener("click", () => { aboutPanel.hidden = false; });
document.querySelector("#aboutClose").addEventListener("click", () => { aboutPanel.hidden = true; });

const soundBtn = document.querySelector("#soundBtn");
let soundState = false;
soundBtn.addEventListener("click", () => {
  soundState = !soundState;
  soundBtn.textContent = soundState ? "♫" : "♪";
  showToast(soundState ? "Ambient sound mode will arrive in the next build." : "Sound mode off.");
});

const tempPos = new THREE.Vector3();
const camDir = new THREE.Vector3();

function updateHotspots() {
  const width = sceneWrap.clientWidth;
  const height = sceneWrap.clientHeight;
  camDir.copy(camera.position).normalize();

  landmarks.forEach((group) => {
    group.getWorldPosition(tempPos);
    const facing = tempPos.clone().normalize().dot(camDir);
    const projected = tempPos.clone().project(camera);
    const hotspot = group.userData.hotspot;

    const visible = facing > .14 && projected.z < 1;
    hotspot.style.opacity = visible ? "1" : "0";
    hotspot.style.pointerEvents = visible ? "auto" : "none";
    hotspot.style.left = ((projected.x * .5 + .5) * width) + "px";
    hotspot.style.top = ((-projected.y * .5 + .5) * height) + "px";
  });
}

function resize() {
  const width = sceneWrap.clientWidth;
  const height = sceneWrap.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

let firstFrame = true;

function animate() {
  if (focusCameraTarget) {
    camera.position.lerp(focusCameraTarget, .055);
    controls.target.lerp(focusLookTarget, .055);

    if (camera.position.distanceTo(focusCameraTarget) < .035) {
      focusCameraTarget = null;
      focusLookTarget = null;
    }
  }

  cloudLayer.rotation.y += .0006;
  controls.update();
  updateHotspots();
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    setTimeout(() => loadingScreen.classList.add("is-done"), 240);
  }

  requestAnimationFrame(animate);
}

animate();
