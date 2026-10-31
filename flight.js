// Point-mass flight model for the printed EDF jet.
// Units are SI: metres, seconds, kilograms, newtons, degrees for angles the
// pilot sees. The sim runs the same equations whether the autopilot or the
// sliders are flying.

export const params = {
  mass: 1.2, // kg, printed airframe with two 80 mm fans and a battery
  g: 9.81,
  rho: 1.225, // kg/m³, sea level air
  area: 0.18, // m², wing reference area
  cl0: 0.25, // lift coefficient at zero angle of attack
  clAlpha: 0.085, // lift slope per degree (about 4.9 per radian)
  alphaStall: 14, // degrees
  clPostStall: 0.06, // how fast lift falls off past the stall
  cd0: 0.06, // parasite drag, printed skin and exposed gear
  k: 0.06, // induced drag factor, C_D = C_D0 + k C_L²
  thrustMax: 8, // N, both fans at full throttle
  rollFriction: 0.03,
  brakeFriction: 0.22,
  cruiseAltitude: 20, // m
  throttleRate: 0.5, // per second
  pitchRate: 10, // degrees per second
  bankRate: 45, // degrees per second
};

const DEG = Math.PI / 180;

export function liftCoefficient(alphaDeg) {
  const { cl0, clAlpha, alphaStall, clPostStall } = params;
  if (alphaDeg <= alphaStall) return cl0 + clAlpha * alphaDeg;
  const clMax = cl0 + clAlpha * alphaStall;
  return Math.max(0.3, clMax - (alphaDeg - alphaStall) * clPostStall);
}

export function dragCoefficient(cl) {
  return params.cd0 + params.k * cl * cl;
}

export function dynamicPressure(speed) {
  return 0.5 * params.rho * speed * speed;
}

export function weight() {
  return params.mass * params.g;
}

export function stallSpeed() {
  const clMax = liftCoefficient(params.alphaStall);
  return Math.sqrt((2 * weight()) / (params.rho * params.area * clMax));
}

export function rotationSpeed() {
  const cl = liftCoefficient(9);
  return 1.08 * Math.sqrt((2 * weight()) / (params.rho * params.area * cl));
}

export function createState() {
  return {
    phase: "parked", // parked | ground | takeoff | flying | landing | rollout
    auto: true,
    time: 0,
    speed: 0,
    altitude: 0,
    gamma: 0, // flight path angle, degrees
    heading: 0, // degrees, 0 = straight down the runway
    pitch: 0,
    bank: 0,
    throttle: 0,
    alpha: 0,
    lift: 0,
    drag: 0,
    thrust: 0,
    weight: weight(),
    verticalSpeed: 0,
    stalled: false,
    x: 0,
    z: 0,
    turnRate: 0,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function approach(current, target, rate, dt) {
  const delta = target - current;
  const step = rate * dt;
  if (Math.abs(delta) <= step) return target;
  return current + Math.sign(delta) * step;
}

// Solve the lift equation backwards: which pitch gives the lift needed to fly
// along the wanted path angle at the current speed? Then nudge toward it.
function pitchForPath(state, gammaTarget) {
  const q = dynamicPressure(Math.max(state.speed, 3));
  const bank = Math.cos(state.bank * DEG);
  const clNeeded = (state.weight * Math.cos(gammaTarget * DEG)) / (q * params.area * Math.max(bank, 0.5));
  const alphaNeeded = clamp((clNeeded - params.cl0) / params.clAlpha, -8, params.alphaStall - 1);
  return alphaNeeded + gammaTarget + 1.5 * (gammaTarget - state.gamma);
}

function pathForClimbRate(state, climbRate) {
  const ratio = clamp(climbRate / Math.max(state.speed, 3), -0.7, 0.7);
  return Math.asin(ratio) / DEG;
}

// Decide what the fans and control surfaces should be doing this frame.
function command(state, input) {
  const { phase } = state;
  if (phase === "takeoff") {
    const rotate = state.speed >= rotationSpeed();
    return { throttle: 1, pitch: rotate ? clamp(pitchForPath(state, 12), 0, 14) : 0, bank: 0 };
  }
  if (phase === "landing") {
    const target = 1.25 * stallSpeed();
    const sink = state.altitude > 4 ? -1.8 : -0.5;
    return {
      throttle: clamp(0.45 + 0.1 * (target - state.speed), 0, 1),
      pitch: clamp(pitchForPath(state, pathForClimbRate(state, sink)), -6, 12),
      bank: 0,
    };
  }
  if (phase === "rollout") {
    return { throttle: 0, pitch: 0, bank: 0 };
  }
  if (phase === "flying" && state.auto) {
    const climb = clamp(0.4 * (params.cruiseAltitude - state.altitude), -3, 3);
    return {
      throttle: 0.6,
      pitch: clamp(pitchForPath(state, pathForClimbRate(state, climb)), -6, 12),
      bank: 25 * Math.sin(0.35 * state.time),
    };
  }
  return {
    throttle: clamp(input.throttle, 0, 1),
    pitch: clamp(input.pitch, -15, 15),
    bank: clamp(input.bank, -45, 45),
  };
}

export function step(state, input, dt) {
  const p = params;
  dt = Math.min(dt, 0.05);
  state.time += dt;

  const want = command(state, input);
  state.throttle = approach(state.throttle, want.throttle, p.throttleRate, dt);
  state.pitch = approach(state.pitch, want.pitch, p.pitchRate, dt);
  state.bank = approach(state.bank, want.bank, p.bankRate, dt);

  const onGround = state.altitude <= 0 && state.gamma <= 0;
  if (onGround) {
    state.altitude = 0;
    state.gamma = 0;
    state.bank = 0;
    state.pitch = Math.max(0, state.pitch);
  }

  state.alpha = state.pitch - state.gamma;
  const cl = liftCoefficient(state.alpha);
  const cd = dragCoefficient(cl);
  const q = dynamicPressure(state.speed);
  state.lift = q * p.area * cl;
  state.drag = q * p.area * cd;
  state.thrust = p.thrustMax * state.throttle;
  state.stalled = state.alpha > p.alphaStall && state.speed > 2;

  const W = state.weight;
  const alphaRad = state.alpha * DEG;
  const bankRad = state.bank * DEG;
  const gammaRad = state.gamma * DEG;

  if (onGround) {
    const normal = Math.max(0, W - state.lift);
    const mu = state.phase === "rollout" ? p.brakeFriction : p.rollFriction;
    const accel = (state.thrust - state.drag - mu * normal) / p.mass;
    state.speed = Math.max(0, state.speed + accel * dt);
    state.verticalSpeed = 0;
    state.turnRate = 0;

    const lifting = state.lift > W && state.pitch > 1;
    if (lifting) {
      state.gamma = 0.5;
      state.altitude = 0.01;
      if (state.phase === "ground") {
        state.phase = "flying";
        state.auto = false;
      }
    } else if (state.phase === "rollout" && state.speed < 0.3) {
      state.phase = "parked";
      state.speed = 0;
      state.throttle = 0;
    } else if (state.phase === "ground" && state.speed < 0.2 && state.throttle === 0) {
      state.phase = "parked";
      state.speed = 0;
    }
  } else {
    const accel = (state.thrust * Math.cos(alphaRad) - state.drag) / p.mass - p.g * Math.sin(gammaRad);
    state.speed = Math.max(0.5, state.speed + accel * dt);

    const v = Math.max(state.speed, 2);
    const normalForce = state.lift * Math.cos(bankRad) + state.thrust * Math.sin(alphaRad) - W * Math.cos(gammaRad);
    const gammaDot = clamp((normalForce / (p.mass * v)) / DEG, -60, 60);
    state.gamma = clamp(state.gamma + gammaDot * dt, -60, 60);

    state.turnRate = clamp(((p.g * Math.tan(bankRad)) / v) / DEG, -90, 90);
    state.heading = (state.heading + state.turnRate * dt + 360) % 360;

    state.verticalSpeed = state.speed * Math.sin(state.gamma * DEG);
    state.altitude += state.verticalSpeed * dt;

    if (state.phase === "takeoff" && state.altitude >= 0.8 * p.cruiseAltitude) {
      state.phase = "flying";
      state.auto = true;
    }

    if (state.altitude <= 0) {
      state.altitude = 0;
      state.gamma = 0;
      state.verticalSpeed = 0;
      state.phase = "rollout";
    }
  }

  const ground = state.speed * Math.cos(state.gamma * DEG) * dt;
  const headingRad = state.heading * DEG;
  state.x += ground * Math.sin(headingRad);
  state.z -= ground * Math.cos(headingRad);

  return state;
}

export function takeOff(state) {
  if (state.phase === "parked" || state.phase === "ground" || state.phase === "rollout") {
    state.phase = "takeoff";
    state.auto = true;
  }
}

export function land(state) {
  if (state.phase === "flying" || state.phase === "takeoff") {
    state.phase = "landing";
    state.auto = true;
  }
}

export function takeControl(state) {
  if (state.phase === "parked") state.phase = "ground";
  if (state.phase === "flying" || state.phase === "ground") state.auto = false;
}

export function describe(state) {
  switch (state.phase) {
    case "parked":
      return "On the ground. Fans off.";
    case "ground":
      return state.speed > 0.5 ? "Rolling down the runway." : "On the ground, fans spooling.";
    case "takeoff":
      return state.altitude > 0 ? "Climbing out." : "Full power. Rolling for takeoff.";
    case "flying":
      if (state.stalled) return "Stalled. Lower the nose or add power.";
      return state.auto ? "Cruising. Move a slider to take the controls." : "You have the controls.";
    case "landing":
      return state.altitude > 4 ? "On approach, descending." : "Flaring for touchdown.";
    case "rollout":
      return "Down. Braking to a stop.";
    default:
      return "";
  }
}
