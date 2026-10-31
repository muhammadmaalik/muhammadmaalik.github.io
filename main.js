import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as flight from "./flight.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const topics = {
  fan: {
    title: "Electric fans",
    lead:
      "Two small fans sit in round ducts and push the jet forward. A motor spins the blades, and the duct keeps the air in a tight stream.",
    note: "The fans are the part that moves the airplane.",
    facts: [
      {
        title: "What you are looking at",
        body: "Each fan is about 80 millimeters across. That is roughly the width of a coffee mug. The dark ring is the duct. The blades and the motor sit inside it.",
      },
      {
        title: "How it fits the airplane",
        body: "This model uses two of those fans, side by side. The rest of the airplane — the printed body and the wheels — is built around them.",
      },
      {
        title: "The larger project",
        body: "The jet is a custom airplane drawn in Fusion 360 and meant to be 3D printed. On my resume I describe it as a design for more than 70 km/h, with work underway on steering the thrust and on a network that could help it fly and land by itself.",
      },
    ],
  },
  airframe: {
    title: "Printed body",
    lead:
      "This is the airplane itself: wings, body, and the spaces that hold the fans. I modeled it in Fusion 360 so it can be printed and still stay in one piece.",
    note: "The body is the shape you are turning.",
    facts: [
      {
        title: "What the colors mean",
        body: "The file keeps the materials from the CAD model. White and pale parts are a printed plastic. Darker parts are the main structure. Red marks a few separate pieces on the airframe.",
      },
      {
        title: "Why the shape matters",
        body: "I also study the airplane in Ansys, looking at how the air flows around it and how the structure holds together. Those studies are how I decide which curves stay.",
      },
      {
        title: "Where it came from",
        body: "The view on this page is the Fusion 360 file in this folder, exported as a STEP model and shown here without redrawing it.",
      },
    ],
  },
  gear: {
    title: "Landing gear",
    lead:
      "The wheels and the small leg let the jet sit on the ground, roll, and come back down after a flight.",
    note: "The wheels are how it leaves the ground and returns.",
    facts: [
      {
        title: "What is in the file",
        body: "The exported model includes a landing-gear leg and a wheel. Turn the airplane and look underneath to see how they meet the body.",
      },
      {
        title: "Why it is simple",
        body: "The gear only needs to hold a light printed airplane. It is a small wheel on a short mount, not a system from a passenger plane.",
      },
      {
        title: "Related hardware",
        body: "A separate project of mine packages motors and boards into a small rocket so the engine can tilt and steer it. Same idea: fit moving parts into a tight space without breaking the structure.",
      },
    ],
  },
  satellite: {
    title: "A satellite the size of a mug",
    lead:
      "Away from this airplane, I am also designing a student satellite with classmates at Stony Brook. It is a metal box about ten centimeters on a side. It has not launched.",
    note: "The satellite is a separate project. It is still a design.",
    facts: [
      {
        title: "What it is for",
        body: "The idea is simple: orbit a few hundred kilometers up and notice short, bright flashes of high-energy light from space. Those flashes are called gamma-ray bursts. A small crystal inside the box lights up when a flash hits it, and a sensor reads that light.",
      },
      {
        title: "How big it is",
        body: "The box is a 1U CubeSat. Think of a large mug: about 10 by 10 by 11 centimeters, kept under roughly 1.3 kilograms, with an aluminum shell. The electronics stack inside in thin layers.",
      },
      {
        title: "Where the project stands",
        body: "I started the effort, wrote a technical proposal aimed at NASA’s student launch program, and the mechanical frame is modeled. It is still design work, with classmates Jackson Boyle and Christian Tumanda. Nothing has flown yet.",
      },
    ],
  },
};

const page = document.querySelector("#top");
const canvas = document.querySelector("#view");
const loading = document.querySelector("#loading");
const fallback = document.querySelector("#fallback");
const hotspotRoot = document.querySelector("#hotspots");
const panel = document.querySelector("#panel");
const panelTitle = document.querySelector("#panel-title");
const panelLead = document.querySelector("#panel-lead");
const panelFacts = document.querySelector("#panel-facts");
const panelClose = document.querySelector("#panel-close");
const status = document.querySelector("#status");
const baseline = document.querySelector("#baseline-note");

const buttons = new Map();
let activeId = null;
let returnFocus = null;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setClearColor(0xffffff, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = !reduceMotion;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 0.55;
controls.maxDistance = 3.4;
controls.minPolarAngle = 0.18;
controls.maxPolarAngle = Math.PI - 0.18;
controls.target.set(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.72));
const hemi = new THREE.HemisphereLight(0xf7fbfe, 0x5d7b90, 1.05);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.position.set(2.4, 3.2, 2.1);
scene.add(key);
const fill = new THREE.DirectionalLight(0xd7e6f0, 1.35);
fill.position.set(-2.8, 1.4, -1.2);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 1.1);
rim.position.set(-0.4, 1.8, -3);
scene.add(rim);

const modelRoot = new THREE.Group();
modelRoot.rotation.order = "YXZ";
scene.add(modelRoot);

// The nose points down -z in the exported model, so the camera starts behind
// and to the right of the jet and watches it fly away.
const NOSE_PITCH_SIGN = 1;
const GROUND_SPEED_SCALE = 0.1; // metres of real travel → scene units of grid scroll
const TILE_AT_GROUND = 0.6; // scene units per grid square when sitting on the runway

const ground = {
  mesh: null,
  texture: null,
  size: 60,
  y: 0,
  shadow: null,
  shadowRadius: 0.4,
  lastX: 0,
  lastZ: 0,
};
const fans = [];

const flightState = flight.createState();
const pilot = { throttle: 0, pitch: 0, bank: 0 };
const clock = new THREE.Clock();

const ui = {
  phase: document.querySelector("#flight-phase"),
  takeoff: document.querySelector("#takeoff"),
  land: document.querySelector("#land"),
  throttle: document.querySelector("#throttle"),
  pitch: document.querySelector("#pitch"),
  bank: document.querySelector("#bank"),
  throttleOut: document.querySelector("#throttle-out"),
  pitchOut: document.querySelector("#pitch-out"),
  bankOut: document.querySelector("#bank-out"),
  reads: Object.fromEntries(
    [...document.querySelectorAll("#readouts [data-read]")].map((el) => [el.dataset.read, el]),
  ),
  constants: document.querySelector("#constants"),
};

const anchors = {
  fan: new THREE.Vector3(),
  airframe: new THREE.Vector3(),
  gear: new THREE.Vector3(),
  satellite: new THREE.Vector3(),
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function partOf(name) {
  const n = name.toLowerCase();
  if (n.includes("wheel") || n.includes("landing")) return "gear";
  if (
    n.includes("edf") ||
    n.includes("duct") ||
    n.includes("blade") ||
    n.includes("dome") ||
    n.includes("bldc")
  ) {
    return "fan";
  }
  if (n.includes("bearing")) return "gear";
  return "airframe";
}

function groupBox(root, part) {
  const box = new THREE.Box3();
  let found = false;
  root.traverse((obj) => {
    if (obj.isMesh && obj.userData.part === part) {
      box.expandByObject(obj);
      found = true;
    }
  });
  return found ? box : null;
}

function makeHotspot(id, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hotspot";
  button.dataset.id = id;
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `<span class="disc" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M6 1.2v9.6M1.2 6h9.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></span><span class="hotspot-label">${label}</span>`;
  button.addEventListener("click", () => openTopic(id, button));
  button.addEventListener("focus", () => highlight(id));
  button.addEventListener("blur", () => {
    if (activeId !== id) highlight(activeId);
  });
  button.addEventListener("pointerenter", () => highlight(id));
  button.addEventListener("pointerleave", () => highlight(activeId));
  hotspotRoot.appendChild(button);
  buttons.set(id, button);
}

makeHotspot("fan", "Fans");
makeHotspot("airframe", "Body");
makeHotspot("gear", "Wheels");
makeHotspot("satellite", "Satellite");

function highlight(id) {
  modelRoot.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    const on = id && obj.userData.part === id;
    for (const material of materials) {
      if (!material.emissive) continue;
      material.emissive.set(on ? 0xffffff : 0x000000);
      material.emissiveIntensity = on ? 0.35 : 0;
    }
  });
}

function setStatus(text) {
  status.textContent = text;
  baseline.textContent = text;
}

function openTopic(id, source) {
  const topic = topics[id];
  if (!topic) return;
  returnFocus = source || buttons.get(id);
  activeId = id;
  for (const [key, button] of buttons) {
    button.classList.toggle("is-active", key === id);
    button.setAttribute("aria-pressed", key === id ? "true" : "false");
  }
  highlight(id === "satellite" ? null : id);
  panelTitle.textContent = topic.title;
  panelLead.textContent = topic.lead;
  panelFacts.replaceChildren();
  for (const fact of topic.facts) {
    const item = document.createElement("li");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = fact.title;
    trigger.setAttribute("aria-expanded", "false");
    const body = document.createElement("p");
    body.className = "fact-body";
    body.hidden = true;
    body.textContent = fact.body;
    trigger.addEventListener("click", () => {
      const open = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", open ? "false" : "true");
      body.hidden = open;
    });
    item.append(trigger, body);
    panelFacts.appendChild(item);
  }
  panel.hidden = false;
  page.classList.add("is-detail");
  setStatus(topic.note);
  panelClose.focus();
  if (!reduceMotion) {
    panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function closeTopic() {
  panel.hidden = true;
  page.classList.remove("is-detail");
  activeId = null;
  highlight(null);
  for (const button of buttons.values()) {
    button.classList.remove("is-active");
    button.setAttribute("aria-pressed", "false");
  }
  setStatus("Select a point to begin.");
  if (returnFocus) returnFocus.focus();
}

panelClose.addEventListener("click", closeTopic);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) {
    event.preventDefault();
    closeTopic();
  }
});

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
}

function projectAnchor(id) {
  const button = buttons.get(id);
  if (id === "satellite") return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const world = anchors[id].clone().applyMatrix4(modelRoot.matrixWorld);
  const vector = world.clone().project(camera);
  const x = (vector.x * 0.5 + 0.5) * width;
  const y = (-vector.y * 0.5 + 0.5) * height;
  const behind = vector.z > 1;
  button.style.left = `${x}px`;
  button.style.top = `${y}px`;
  button.hidden = behind || x < -20 || y < -20 || x > width + 20 || y > height + 20;

  if (behind) {
    button.classList.remove("is-dim");
    return;
  }
  const direction = world.clone().sub(camera.position);
  const distance = direction.length();
  direction.normalize();
  raycaster.set(camera.position, direction);
  const hits = raycaster.intersectObject(modelRoot, true);
  const blocked = hits.length > 0 && hits[0].distance < distance - 0.04;
  button.classList.toggle("is-dim", blocked);
}

canvas.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 0.08 : 0.16;
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  if (event.key === "ArrowLeft") spherical.theta -= step;
  else if (event.key === "ArrowRight") spherical.theta += step;
  else if (event.key === "ArrowUp") spherical.phi -= step;
  else if (event.key === "ArrowDown") spherical.phi += step;
  else return;
  event.preventDefault();
  spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, spherical.phi));
  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);
  controls.update();
});

function soften(material) {
  material.metalness = Math.min(material.metalness ?? 0.15, 0.45);
  material.roughness = Math.max(material.roughness ?? 0.55, 0.42);
  if (material.color) {
    const color = material.color;
    if (color.r < 0.08 && color.g < 0.08 && color.b < 0.08) {
      color.setRGB(0.16, 0.17, 0.18);
    }
  }
  if (material.emissive) material.emissive.set(0x000000);
}

const loader = new GLTFLoader();
loader.load(
  "./public/models/plane.glb",
  (gltf) => {
    const model = gltf.scene;
    model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.userData.part = partOf(obj.name || "");
      const lower = (obj.name || "").toLowerCase();
      if (lower.includes("blade") || lower.includes("dome")) fans.push(obj);
      obj.castShadow = false;
      obj.receiveShadow = false;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (material) soften(material);
      }
    });

    model.rotation.x = -Math.PI / 2;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    modelRoot.add(model);
    model.updateMatrixWorld(true);
    resize();

    const whole = new THREE.Box3().setFromObject(modelRoot);
    const size = whole.getSize(new THREE.Vector3());
    const fanBox = groupBox(modelRoot, "fan");
    const gearBox = groupBox(modelRoot, "gear");
    const bodyBox = groupBox(modelRoot, "airframe");
    if (fanBox) fanBox.getCenter(anchors.fan);
    if (gearBox) gearBox.getCenter(anchors.gear);
    if (bodyBox) {
      bodyBox.getCenter(anchors.airframe);
      anchors.airframe.x = THREE.MathUtils.lerp(anchors.airframe.x, bodyBox.max.x, 0.55);
    }
    buttons.get("satellite").classList.add("is-docked");

    const fitCenter = whole.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeight = maxSize / (2 * Math.tan((camera.fov * Math.PI) / 360));
    const fitWidth = fitHeight / camera.aspect;
    const distance = 1.42 * Math.max(fitHeight, fitWidth);
    camera.near = Math.max(0.01, distance / 80);
    camera.far = distance * 12;
    camera.position.set(fitCenter.x + distance * 0.42, fitCenter.y + distance * 0.28, fitCenter.z + distance * 0.86);
    camera.updateProjectionMatrix();
    controls.target.copy(fitCenter);
    controls.minDistance = distance * 0.45;
    controls.maxDistance = distance * 2.4;
    controls.update();

    const wheel = new THREE.Vector3();
    const wheelBox = new THREE.Box3();
    let wheelFound = false;
    modelRoot.traverse((obj) => {
      if (obj.isMesh && (obj.name || "").toLowerCase().includes("wheel")) {
        wheelBox.expandByObject(obj);
        wheelFound = true;
      }
    });
    if (wheelFound) wheelBox.getCenter(wheel);
    if (wheelFound) anchors.gear.copy(wheel);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(size.x, size.z) * 0.46, 48),
      new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = whole.min.y - 0.004;
    scene.add(shadow);
    ground.shadow = shadow;
    ground.y = whole.min.y;

    buildGround(whole.min.y - 0.006);
    scene.fog = new THREE.Fog(0xffffff, distance * 1.8, distance * 5);

    loading.hidden = true;
    resize();
  },
  undefined,
  () => {
    loading.hidden = true;
    fallback.hidden = false;
  },
);

function buildGround(y) {
  const tile = document.createElement("canvas");
  tile.width = 128;
  tile.height = 128;
  const ctx = tile.getContext("2d");
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = "rgba(17, 17, 17, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(1, 128);
  ctx.moveTo(0, 1);
  ctx.lineTo(128, 1);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(tile);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = THREE.SRGBColorSpace;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ground.size, ground.size),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = -1;
  scene.add(mesh);
  ground.mesh = mesh;
  ground.texture = texture;
  updateGround(0);
}

function updateGround(altitude) {
  if (!ground.texture) return;
  // Squares shrink as the jet climbs so the runway reads as farther away.
  const tile = TILE_AT_GROUND / (1 + altitude / 8);
  const repeat = ground.size / tile;
  ground.texture.repeat.set(repeat, repeat);

  const dx = (flightState.x - ground.lastX) * GROUND_SPEED_SCALE;
  const dz = (flightState.z - ground.lastZ) * GROUND_SPEED_SCALE;
  ground.lastX = flightState.x;
  ground.lastZ = flightState.z;
  ground.texture.offset.x += dx / tile;
  ground.texture.offset.y -= dz / tile;

  if (ground.shadow) {
    const s = 1 / (1 + altitude / 3);
    ground.shadow.scale.setScalar(Math.max(0.15, s));
    ground.shadow.material.opacity = 0.28 / (1 + altitude / 2);
  }
}

function visualAltitude(altitude) {
  return 0.8 * (1 - Math.exp(-altitude / 6));
}

function poseModel(dt) {
  const s = flightState;
  const rad = Math.PI / 180;
  modelRoot.rotation.y = -s.heading * rad;
  modelRoot.rotation.x = NOSE_PITCH_SIGN * s.pitch * rad;
  modelRoot.rotation.z = s.bank * rad;
  // Rotating about the centre would push the tail through the runway, so
  // lift the whole jet a little when it pitches up near the ground.
  const tailClearance = Math.sin(Math.abs(s.pitch) * rad) * 0.24;
  modelRoot.position.y = visualAltitude(s.altitude) + tailClearance * (s.altitude < 1 ? 1 : 0.4);
  modelRoot.updateMatrixWorld(true);

  const spin = (6 + 70 * s.throttle) * dt;
  for (const fan of fans) fan.rotateZ(spin);

  controls.target.y += (modelRoot.position.y - controls.target.y) * Math.min(1, dt * 4);
}

function syncControls() {
  const s = flightState;
  const automatic = s.auto || s.phase === "takeoff" || s.phase === "landing" || s.phase === "rollout";
  if (automatic) {
    ui.throttle.value = Math.round(s.throttle * 100);
    ui.pitch.value = Math.round(s.pitch);
    ui.bank.value = Math.round(s.bank);
    pilot.throttle = s.throttle;
    pilot.pitch = s.pitch;
    pilot.bank = s.bank;
  }
  ui.throttleOut.value = `${Math.round(Number(ui.throttle.value))}%`;
  ui.pitchOut.value = `${Math.round(Number(ui.pitch.value))}°`;
  ui.bankOut.value = `${Math.round(Number(ui.bank.value))}°`;

  const grounded = s.phase === "parked" || s.phase === "ground" || s.phase === "rollout";
  ui.takeoff.disabled = !grounded || s.phase === "rollout";
  ui.land.disabled = !(s.phase === "flying" || s.phase === "takeoff");
}

let lastReadout = 0;
function updateReadouts(now) {
  if (now - lastReadout < 120) return;
  lastReadout = now;
  const s = flightState;
  const r = ui.reads;
  r.speed.textContent = `${s.speed.toFixed(1)} m/s · ${(s.speed * 3.6).toFixed(0)} km/h`;
  r.altitude.textContent = `${s.altitude.toFixed(1)} m`;
  r.alpha.textContent = `${s.alpha.toFixed(1)}°${s.stalled ? " · stall" : ""}`;
  r.lift.textContent = `${s.lift.toFixed(1)} N`;
  r.drag.textContent = `${s.drag.toFixed(2)} N`;
  r.thrust.textContent = `${s.thrust.toFixed(1)} N`;
  r.weight.textContent = `${s.weight.toFixed(1)} N`;
  r.ratio.textContent = s.drag > 0.05 ? (s.lift / s.drag).toFixed(1) : "—";
  ui.phase.textContent = flight.describe(s);
}

function bindFlightControls() {
  const p = flight.params;
  ui.constants.textContent =
    `m = ${p.mass} kg, S = ${p.area} m², ρ = ${p.rho} kg/m³, ` +
    `C_L0 = ${p.cl0}, C_Lα = ${p.clAlpha} per degree, C_D0 = ${p.cd0}, k = ${p.k}, ` +
    `T_max = ${p.thrustMax} N. Rotation speed ${flight.rotationSpeed().toFixed(1)} m/s, ` +
    `stall speed ${flight.stallSpeed().toFixed(1)} m/s.`;

  ui.takeoff.addEventListener("click", () => {
    flight.takeOff(flightState);
    syncControls();
  });
  ui.land.addEventListener("click", () => {
    flight.land(flightState);
    syncControls();
  });

  const manual = (key, scale) => (event) => {
    flight.takeControl(flightState);
    pilot[key] = Number(event.target.value) * scale;
    syncControls();
  };
  ui.throttle.addEventListener("input", manual("throttle", 0.01));
  ui.pitch.addEventListener("input", manual("pitch", 1));
  ui.bank.addEventListener("input", manual("bank", 1));
  syncControls();
}

bindFlightControls();

function frame(now) {
  resize();
  controls.update();
  const dt = Math.min(clock.getDelta(), 0.05);
  if (modelRoot.children.length) {
    flight.step(flightState, pilot, dt);
    poseModel(dt);
    updateGround(flightState.altitude);
    syncControls();
    updateReadouts(now || 0);
    projectAnchor("fan");
    projectAnchor("airframe");
    projectAnchor("gear");
    projectAnchor("satellite");
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

canvas.addEventListener("pointerdown", (event) => {
  pointer.x = ((event.clientX - canvas.getBoundingClientRect().left) / canvas.clientWidth) * 2 - 1;
  pointer.y = -((event.clientY - canvas.getBoundingClientRect().top) / canvas.clientHeight) * 2 + 1;
});
