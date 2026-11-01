
"use strict";

/* =========================================
   CUBE.TIMER
   ========================================= */

const $ = id => document.getElementById(id);

const STORAGE_KEY = "cubeTimerSolves";
const SETTINGS_KEY = "cubeTimerSettings";
const PROFILE_KEY = "cubeTimerProfiles";
const ALGORITHM_KEY = "cubeTimerAlgorithms";

let settings = loadJSON(SETTINGS_KEY, {
  precision: 2,
  sound: "on",
  pbAlert: "on",
  averageAlert: "on",
  averageMilestone: 30,
  inspection: 0
});

let profiles = loadJSON(PROFILE_KEY, [
  { id: "3x3-Normal", puzzle: "3x3", style: "Normal" },
  { id: "3x3-OH", puzzle: "3x3", style: "OH" },
  { id: "3x3-Blind", puzzle: "3x3", style: "Blind" }
]);

let activeProfile = localStorage.getItem("cubeTimerActiveProfile") || "3x3-Normal";

let allSolves = loadJSON(STORAGE_KEY, []);
let solves = [];

let scramble = generateScramble();
let running = false;
let ready = false;
let spaceHeld = false;
let startTime = 0;
let animationFrame = null;
let holdTimeout = null;

let customAlgorithms = loadJSON(ALGORITHM_KEY, []);
let currentCase = null;
let algorithmStart = 0;
let algorithmRunning = false;
let algorithmInterval = null;

let playbackQueue = [];
let playbackIndex = 0;
let cubeHistory = [];
let cubelets = [];
let cubeScene, cubeCamera, cubeRenderer, cubeGroup;
let cubeInitialized = false;

/* =========================================
   STORAGE
   ========================================= */

function loadJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getProfile() {
  return profiles.find(p => p.id === activeProfile) || profiles[0];
}

function profileSolves() {
  const profile = getProfile();
  return allSolves.filter(s =>
    s.profileId === profile.id ||
    (!s.profileId && profile.id === "3x3-Normal")
  );
}

function refreshSolves() {
  solves = profileSolves();
}

function saveSolves() {
  saveJSON(STORAGE_KEY, allSolves);
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* =========================================
   PROFILES
   ========================================= */

function renderProfiles() {
  const select = $("profileSelect");
  if (!select) return;

  select.replaceChildren();

  profiles.forEach(profile => {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = `${profile.puzzle} · ${profile.style}`;
    select.appendChild(option);
  });

  select.value = activeProfile;
}

function changeProfile(id) {
  if (!profiles.some(p => p.id === id)) return;

  activeProfile = id;
  localStorage.setItem("cubeTimerActiveProfile", id);

  refreshSolves();

  const profile = getProfile();
  $("timerPuzzle").value = profile.puzzle;
  $("timerStyle").value = profile.style;
  $("timer-heading").textContent = `${profile.puzzle} · ${profile.style}`;

  newScramble();
  render();
  renderProfiles();
}

function createProfile() {
  const puzzle = $("timerPuzzle").value;
  const style = $("timerStyle").value;
  const id = `${puzzle}-${style}`;

  if (profiles.some(p => p.id === id)) {
    alert("That profile already exists.");
    return;
  }

  profiles.push({ id, puzzle, style });
  saveJSON(PROFILE_KEY, profiles);
  changeProfile(id);
}

/* =========================================
   TIME AND SCRAMBLES
   ========================================= */

function formatTime(ms) {
  if (!Number.isFinite(ms)) return "--";
  return (ms / 1000).toFixed(settings.precision);
}

function parseTime(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number * 1000 : null;
}

function generateScramble() {
  const faces = ["R", "L", "U", "D", "F", "B"];
  const suffixes = ["", "'", "2"];
  const axes = { R: "x", L: "x", U: "y", D: "y", F: "z", B: "z" };

  const moves = [];
  let previous = "";
  let previousAxis = "";

  while (moves.length < 20) {
    const face = faces[Math.floor(Math.random() * faces.length)];
    if (face === previous) continue;

    const axis = axes[face];
    if (axis === previousAxis) continue;

    moves.push(face + suffixes[Math.floor(Math.random() * 3)]);
    previous = face;
    previousAxis = axis;
  }

  return moves.join(" ");
}

function newScramble() {
  scramble = generateScramble();
  $("scramble").textContent = scramble;
}

/* =========================================
   TIMER
   ========================================= */

function updateTimer() {
  if (!running) return;

  $("timer").textContent = formatTime(performance.now() - startTime);
  animationFrame = requestAnimationFrame(updateTimer);
}

function startTimer() {
  if (running) return;

  running = true;
  ready = false;
  startTime = performance.now();

  $("timer").className = "running";
  $("timer-label").textContent = "Timing...";

  updateTimer();
}

function stopTimer() {
  if (!running) return;

  const elapsed = performance.now() - startTime;

  running = false;
  cancelAnimationFrame(animationFrame);

  $("timer").textContent = formatTime(elapsed);
  $("timer").className = "";
  $("timer-label").textContent = "Solve recorded";

  addSolve(elapsed, scramble);

  setTimeout(() => {
    $("timer-label").textContent = "Hold SPACE, then release to start";
    newScramble();
  }, 900);
}

function prepareTimer() {
  if (running || ready) return;

  ready = true;
  $("timer").textContent = "0.00";
  $("timer").className = "ready";
  $("timer-label").textContent = "READY";
}

document.addEventListener("keydown", event => {
  if (event.code !== "Space") return;

  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement ||
    event.target instanceof HTMLSelectElement
  ) return;

  event.preventDefault();
  if (event.repeat) return;

  if (running) {
    stopTimer();
    return;
  }

  if (spaceHeld) return;

  spaceHeld = true;
  prepareTimer();

  holdTimeout = setTimeout(() => {
    if (spaceHeld && ready) {
      $("timer-label").textContent = "RELEASE TO START";
    }
  }, 300);
});

document.addEventListener("keyup", event => {
  if (event.code !== "Space" || !spaceHeld) return;

  spaceHeld = false;
  clearTimeout(holdTimeout);

  if (ready && !running) startTimer();
});

window.addEventListener("blur", () => {
  spaceHeld = false;
  clearTimeout(holdTimeout);
});

/* =========================================
   CUSTOM ALERTS
   ========================================= */

function playAlert(frequency = 700) {
  if (settings.sound !== "on") return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audio = new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.frequency.value = frequency;
    gain.gain.value = 0.08;

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.start();
    oscillator.stop(audio.currentTime + 0.18);
    oscillator.onended = () => audio.close();
  } catch {
    // Audio may be unavailable in some browsers.
  }
}

function showAlert(message) {
  $("timer-label").textContent = message;
  playAlert();
}

function checkAlerts(time) {
  const previousBest = solves.length
    ? Math.min(...solves.map(s => s.time))
    : Infinity;

  if (settings.pbAlert === "on" && time < previousBest) {
    showAlert("NEW PERSONAL BEST!");
  }

  const ao5 = getAverage(5);
  const milestone = Number(settings.averageMilestone) * 1000;

  if (
    settings.averageAlert === "on" &&
    ao5 !== null &&
    ao5 <= milestone
  ) {
    showAlert(`Ao5 milestone reached: ${formatTime(ao5)}`);
  }
}

/* =========================================
   SOLVE MANAGEMENT
   ========================================= */

function addSolve(time, scrambleText = "") {
  const profile = getProfile();

  const solve = {
    id: makeId(),
    time,
    date: new Date().toISOString(),
    scramble: scrambleText,
    profileId: profile.id,
    puzzle: profile.puzzle,
    style: profile.style
  };

  allSolves.push(solve);
  saveSolves();

  refreshSolves();
  checkAlerts(time);
  render();
}

function manualAdd() {
  const value = prompt("Enter solve time in seconds:");
  if (value === null) return;

  const time = parseTime(value);

  if (!time) {
    alert("Enter a valid time greater than zero.");
    return;
  }

  addSolve(time, "Manual entry");
}

function editSolve(id) {
  const solve = allSolves.find(s => s.id === id);
  if (!solve) return;

  const value = prompt("Enter the new time in seconds:", formatTime(solve.time));
  if (value === null) return;

  const time = parseTime(value);
  if (!time) {
    alert("Invalid time.");
    return;
  }

  solve.time = time;
  saveSolves();
  refreshSolves();
  render();
}

function deleteSolve(id) {
  if (!confirm("Delete this solve?")) return;

  allSolves = allSolves.filter(s => s.id !== id);
  saveSolves();
  refreshSolves();
  render();
}

/* =========================================
   AVERAGES AND STATISTICS
   ========================================= */

function trimmedAverage(group) {
  if (group.length < 3) return null;

  const values = group.map(s => s.time).sort((a, b) => a - b);
  values.shift();
  values.pop();

  return values.reduce((a, b) => a + b, 0) / values.length;
}

function getAverage(n) {
  if (solves.length < n) return null;
  return trimmedAverage(solves.slice(0, n));
}

function rollingValues(n) {
  const chronological = [...solves].reverse();
  const result = [];

  for (let i = n - 1; i < chronological.length; i++) {
    result.push({
      value: trimmedAverage(chronological.slice(i - n + 1, i + 1)) / 1000
    });
  }

  return result;
}

function renderStats() {
  $("solve-count").textContent = solves.length;

  $("best-single").textContent = solves.length
    ? formatTime(Math.min(...solves.map(s => s.time)))
    : "--";

  $("ao5").textContent = getAverage(5) === null ? "--" : formatTime(getAverage(5));
  $("ao12").textContent = getAverage(12) === null ? "--" : formatTime(getAverage(12));
  $("ao50").textContent = getAverage(50) === null ? "--" : formatTime(getAverage(50));
  $("ao100").textContent = getAverage(100) === null ? "--" : formatTime(getAverage(100));
}

/* =========================================
   GRAPHS
   ========================================= */

function setupCanvas(id) {
  const canvas = $(id);
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  return { ctx, width: rect.width, height: rect.height };
}

function drawEmpty(ctx, width, height, message) {
  ctx.fillStyle = "#8995a8";
  ctx.font = "13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(message, width / 2, height / 2);
}

function drawGraph() {
  const result = setupCanvas("graph");
  if (!result) return;

  const { ctx, width, height } = result;
  const values = [...solves].reverse().map(s => s.time / 1000);

  if (!values.length) {
    drawEmpty(ctx, width, height, "Complete a solve to see your progress");
    return;
  }

  const min = Math.max(0, Math.floor(Math.min(...values) - 2));
  const max = Math.ceil(Math.max(...values) + 2);
  const left = 42, right = 12, top = 15, bottom = 25;
  const graphWidth = width - left - right;
  const graphHeight = height - top - bottom;

  for (let i = 0; i <= 4; i++) {
    const y = top + graphHeight * i / 4;
    ctx.strokeStyle = "#303a4b";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();

    ctx.fillStyle = "#8995a8";
    ctx.textAlign = "right";
    ctx.font = "11px system-ui";
    ctx.fillText((max - (max - min) * i / 4).toFixed(0) + "s", left - 7, y + 4);
  }

  ctx.strokeStyle = "#70e1c1";
  ctx.lineWidth = 2;
  ctx.beginPath();

  values.forEach((value, i) => {
    const x = left + graphWidth * i / Math.max(1, values.length - 1);
    const y = top + graphHeight * (1 - (value - min) / (max - min || 1));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

function drawTrendGraph() {
  const result = setupCanvas("trendGraph");
  if (!result) return;

  const { ctx, width, height } = result;
  const ao5 = rollingValues(5);
  const ao12 = rollingValues(12);

  if (!ao5.length && !ao12.length) {
    drawEmpty(ctx, width, height, "Complete at least 5 solves to see averages");
    return;
  }

  const all = [...ao5, ...ao12].map(x => x.value);
  const min = Math.max(0, Math.floor(Math.min(...all) - 2));
  const max = Math.ceil(Math.max(...all) + 2);

  function plot(data, color) {
    if (!data.length) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, i) => {
      const x = 35 + (width - 50) * i / Math.max(1, data.length - 1);
      const y = 15 + (height - 40) * (1 - (point.value - min) / (max - min || 1));

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  plot(ao5, "#70e1c1");
  plot(ao12, "#e6bd69");
}

function drawDistribution() {
  const result = setupCanvas("distributionGraph");
  if (!result) return;

  const { ctx, width, height } = result;
  const values = solves.map(s => s.time / 1000);

  if (!values.length) {
    drawEmpty(ctx, width, height, "No solve data yet");
    return;
  }

  const min = Math.floor(Math.min(...values) / 5) * 5;
  const max = Math.ceil(Math.max(...values) / 5) * 5;
  const bins = [];

  for (let i = min; i <= max; i += 5) {
    bins.push({ label: `${i}-${i + 5}`, count: 0 });
  }

  values.forEach(value => {
    const index = Math.min(Math.floor((value - min) / 5), bins.length - 1);
    bins[index].count++;
  });

  const highest = Math.max(...bins.map(b => b.count), 1);
  const slot = (width - 45) / bins.length;

  bins.forEach((bin, i) => {
    const barHeight = bin.count / highest * (height - 45);
    const x = 35 + i * slot;

    ctx.fillStyle = "#70e1c1";
    ctx.fillRect(x + 2, height - 30 - barHeight, Math.max(1, slot - 5), barHeight);

    ctx.fillStyle = "#8995a8";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";

    if (bins.length <= 12 || i % 2 === 0) {
      ctx.fillText(bin.label, x + slot / 2, height - 10);
    }
  });
}

/* =========================================
   HISTORY AND RECORDS
   ========================================= */

function renderHistory() {
  const container = $("solve-list");
  container.replaceChildren();

  if (!solves.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No solves yet. Start cubing!";
    container.appendChild(empty);
    return;
  }

  solves.forEach((solve, index) => {
    const row = document.createElement("div");
    row.className = "solve";

    const number = document.createElement("div");
    number.className = "solve-number";
    number.textContent = "#" + (solves.length - index);

    const info = document.createElement("div");
    const time = document.createElement("div");
    time.className = "solve-time";
    time.textContent = formatTime(solve.time);

    const date = document.createElement("div");
    date.className = "solve-date";
    date.textContent = new Date(solve.date).toLocaleString();

    info.append(time, date);

    const actions = document.createElement("div");
    actions.className = "solve-actions";

    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editSolve(solve.id));

    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.className = "danger";
    remove.addEventListener("click", () => deleteSolve(solve.id));

    actions.append(edit, remove);
    row.append(number, info, actions);
    container.appendChild(row);
  });
}

function renderRecords() {
  const container = $("personalRecords");
  container.replaceChildren();

  const records = [];

  if (solves.length) {
    records.push({
      name: "Best Single",
      value: Math.min(...solves.map(s => s.time))
    });
  }

  for (const n of [5, 12, 50, 100]) {
    if (solves.length < n) continue;

    let best = Infinity;
    const chronological = [...solves].reverse();

    for (let i = n - 1; i < chronological.length; i++) {
      const value = trimmedAverage(chronological.slice(i - n + 1, i + 1));
      if (value !== null && value < best) best = value;
    }

    if (Number.isFinite(best)) {
      records.push({ name: `Best Ao${n}`, value: best });
    }
  }

  if (!records.length) {
    container.textContent = "Complete some solves to establish records.";
    return;
  }

  records.forEach(record => {
    const item = document.createElement("div");
    item.className = "record-item";

    const name = document.createElement("div");
    name.className = "label";
    name.textContent = record.name;

    const value = document.createElement("div");
    value.className = "value";
    value.textContent = formatTime(record.value);

    item.append(name, value);
    container.appendChild(item);
  });
}

function render() {
  renderStats();
  renderHistory();
  renderRecords();
  drawGraph();
  drawTrendGraph();
  drawDistribution();
}

/* =========================================
   3D CUBE SIMULATOR
   ========================================= */

const FACE_COLORS = {
  R: 0xd93636,
  L: 0xff8c20,
  U: 0xffffff,
  D: 0xf5d442,
  F: 0x28b879,
  B: 0x3478d4
};

function initializeCube() {
  if (cubeInitialized || !window.THREE) return;

  const canvas = $("cubeCanvas");
  if (!canvas) return;

  cubeScene = new THREE.Scene();
  cubeScene.background = new THREE.Color(0x111722);

  cubeCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  cubeCamera.position.set(5, 5, 7);
  cubeCamera.lookAt(0, 0, 0);

  cubeRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
  });

  cubeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  cubeScene.add(new THREE.AmbientLight(0xffffff, 1.2));

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(5, 8, 6);
  cubeScene.add(light);

  cubeGroup = new THREE.Group();
  cubeScene.add(cubeGroup);

  createCubelets();
  resizeCube();

  cubeInitialized = true;
  animateCube();
}

function createCubelets() {
  cubeGroup.clear();
  cubelets = [];

  const geometry = new THREE.BoxGeometry(0.96, 0.96, 0.96);

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const materials = [
          new THREE.MeshStandardMaterial({ color: x === 1 ? FACE_COLORS.R : 0x171717 }),
          new THREE.MeshStandardMaterial({ color: x === -1 ? FACE_COLORS.L : 0x171717 }),
          new THREE.MeshStandardMaterial({ color: y === 1 ? FACE_COLORS.U : 0x171717 }),
          new THREE.MeshStandardMaterial({ color: y === -1 ? FACE_COLORS.D : 0x171717 }),
          new THREE.MeshStandardMaterial({ color: z === 1 ? FACE_COLORS.F : 0x171717 }),
          new THREE.MeshStandardMaterial({ color: z === -1 ? FACE_COLORS.B : 0x171717 })
        ];

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.position.set(x, y, z);
        cubeGroup.add(mesh);

        cubelets.push(mesh);
      }
    }
  }
}

function resizeCube() {
  if (!cubeRenderer || !cubeCamera) return;

  const canvas = $("cubeCanvas");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  if (!width || !height) return;

  cubeRenderer.setSize(width, height, false);
  cubeCamera.aspect = width / height;
  cubeCamera.updateProjectionMatrix();
}

function animateCube() {
  if (!cubeRenderer) return;

  requestAnimationFrame(animateCube);
  cubeRenderer.render(cubeScene, cubeCamera);
}

function normalizeQuarterTurns(value) {
  return ((value % 4) + 4) % 4;
}

function rotateCubeLayer(move) {
  const face = move[0];
  const suffix = move.slice(1);

  const clockwise = suffix !== "'";
  const turns = suffix === "2" ? 2 : 1;

  const layerDefinitions = {
    R: { axis: "x", position: 1, sign: -1 },
    L: { axis: "x", position: -1, sign: 1 },
    U: { axis: "y", position: 1, sign: -1 },
    D: { axis: "y", position: -1, sign: 1 },
    F: { axis: "z", position: 1, sign: -1 },
    B: { axis: "z", position: -1, sign: 1 }
  };

  const definition = layerDefinitions[face];
  if (!definition) return;

  const axis = definition.axis;
  const direction = (clockwise ? definition.sign : -definition.sign) * turns;
  const angle = direction * Math.PI / 2;

  const selected = cubelets.filter(c =>
    Math.round(c.position[axis]) === definition.position
  );

  const pivot = new THREE.Group();
  cubeScene.add(pivot);

  selected.forEach(cubelet => {
    cubeGroup.remove(cubelet);
    pivot.add(cubelet);
  });

  pivot.rotation[axis] = angle;
  pivot.updateMatrixWorld(true);

  const moved = [...selected];

  moved.forEach(cubelet => {
    cubeScene.attach(cubelet);

    cubelet.position.set(
      Math.round(cubelet.position.x),
      Math.round(cubelet.position.y),
      Math.round(cubelet.position.z)
    );

    cubelet.rotation.set(
      Math.round(cubelet.rotation.x / (Math.PI / 2)) * Math.PI / 2,
      Math.round(cubelet.rotation.y / (Math.PI / 2)) * Math.PI / 2,
      Math.round(cubelet.rotation.z / (Math.PI / 2)) * Math.PI / 2
    );

    cubeGroup.attach(cubelet);
  });

  cubeScene.remove(pivot);
}

function applyAlgorithm(text) {
  if (!cubeInitialized) initializeCube();

  const moves = text.trim().split(/\s+/).filter(Boolean);

  moves.forEach(move => {
    rotateCubeLayer(move);
  });

  cubeHistory.push(text);
}

function resetCube() {
  if (!cubeInitialized) initializeCube();

  createCubelets();
  cubeHistory = [];
  playbackQueue = [];
  playbackIndex = 0;

  $("playbackStatus").textContent = "Cube reset.";
}

function undoCube() {
  cubeHistory.pop();
  createCubelets();

  const previousMoves = [...cubeHistory];
  cubeHistory = [];

  previousMoves.forEach(text => {
    text.split(/\s+/).filter(Boolean).forEach(rotateCubeLayer);
    cubeHistory.push(text);
  });
}

$("applyMoves").addEventListener("click", () => {
  const moves = $("cubeMoves").value.trim();
  if (!moves) return;

  applyAlgorithm(moves);
});

$("resetCube").addEventListener("click", resetCube);
$("undoMove").addEventListener("click", undoCube);

$("playAlgorithm").addEventListener("click", () => {
  const text = $("playbackMoves").value.trim();
  if (!text) return;

  resetCube();

  playbackQueue = text.split(/\s+/).filter(Boolean);
  playbackIndex = 0;

  $("playbackStatus").textContent = "Playback ready. Press Next Move.";
});

$("stepAlgorithm").addEventListener("click", () => {
  if (playbackIndex >= playbackQueue.length) {
    $("playbackStatus").textContent = "Algorithm finished.";
    return;
  }

  const move = playbackQueue[playbackIndex];
  applyAlgorithm(move);

  playbackIndex++;
  $("playbackStatus").textContent =
    `Move ${playbackIndex}/${playbackQueue.length}: ${move}`;
});

/* =========================================
   ALGORITHM TRAINER
   ========================================= */

const ALGORITHMS = {
  OLL: [
    { name: "Sune", alg: "R U R' U R U2 R'" },
    { name: "Anti-Sune", alg: "R U2 R' U' R U' R'" },
    { name: "H Shape", alg: "R U R' U R U' R' U R U2 R'" },
    { name: "T Shape", alg: "F R U R' U' F'" },
    { name: "Pi Shape", alg: "R U2 R2 U' R2 U' R2 U2 R" }
  ],
  PLL: [
    { name: "T Perm", alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
    { name: "Ua Perm", alg: "R U' R U R U R U' R' U' R2" },
    { name: "Ub Perm", alg: "R2 U R U R' U' R' U' R' U R'" },
    { name: "H Perm", alg: "M2 U M2 U2 M2 U M2" },
    { name: "Z Perm", alg: "M2 U M2 U M' U2 M2 U2 M' U2" }
  ],
  F2L: [
    { name: "Basic pair", alg: "U R U' R'" },
    { name: "Pair insertion", alg: "U' L' U L" },
    { name: "Corner and edge", alg: "R U R' U' R U R'" }
  ],
  Custom: []
};

function getAlgorithms(category) {
  return category === "Custom"
    ? customAlgorithms
    : ALGORITHMS[category] || [];
}

function nextCase() {
  const category = $("algorithmCategory").value;
  const list = getAlgorithms(category);

  if (!list.length) {
    $("caseName").textContent = "No algorithms in this category yet";
    $("caseAlgorithm").textContent = "";
    currentCase = null;
    return;
  }

  currentCase = list[Math.floor(Math.random() * list.length)];

  $("caseName").textContent = currentCase.name;
  $("caseAlgorithm").textContent = "Algorithm hidden. Try to recall it!";
}

function revealAlgorithm() {
  if (!currentCase) return;

  $("caseAlgorithm").textContent = currentCase.alg;
}

function renderAlgorithmProgress() {
  const container = $("algorithmProgress");
  container.replaceChildren();

  const learned = loadJSON("cubeTimerLearnedAlgorithms", []);

  Object.entries(ALGORITHMS).forEach(([category, list]) => {
    list.forEach(item => {
      const row = document.createElement("div");
      row.className = "algorithm";

      const name = document.createElement("span");
      name.textContent = `${category}: ${item.name}`;

      const button = document.createElement("button");
      const key = `${category}:${item.name}`;
      button.textContent = learned.includes(key) ? "Learned" : "Mark learned";

      button.addEventListener("click", () => {
        const updated = loadJSON("cubeTimerLearnedAlgorithms", []);
        if (updated.includes(key)) {
          saveJSON("cubeTimerLearnedAlgorithms", updated.filter(x => x !== key));
        } else {
          updated.push(key);
          saveJSON("cubeTimerLearnedAlgorithms", updated);
        }

        renderAlgorithmProgress();
      });

      row.append(name, button);
      container.appendChild(row);
    });
  });
}

function saveCustomAlgorithm() {
  const name = $("customName").value.trim();
  const alg = $("customAlgorithm").value.trim();

  if (!name || !alg) {
    alert("Enter both a case name and an algorithm.");
    return;
  }

  customAlgorithms.push({ name, alg });
  saveJSON(ALGORITHM_KEY, customAlgorithms);

  $("customName").value = "";
  $("customAlgorithm").value = "";

  alert("Algorithm saved!");
  renderAlgorithmProgress();
}

function startAlgorithmTimer() {
  if (algorithmRunning) return;

  algorithmRunning = true;
  algorithmStart = performance.now();

  algorithmInterval = setInterval(() => {
    $("algorithmTimer").textContent =
      ((performance.now() - algorithmStart) / 1000).toFixed(2);
  }, 20);
}

function stopAlgorithmTimer() {
  if (!algorithmRunning) return;

  algorithmRunning = false;
  clearInterval(algorithmInterval);

  const elapsed = performance.now() - algorithmStart;
  $("algorithmTimer").textContent = (elapsed / 1000).toFixed(2);
}

/* =========================================
   SETTINGS
   ========================================= */

function loadSettingsIntoUI() {
  $("precisionSetting").value = settings.precision;
  $("soundSetting").value = settings.sound;
  $("pbAlert").value = settings.pbAlert;
  $("averageAlert").value = settings.averageAlert;
  $("averageMilestone").value = settings.averageMilestone;
  $("inspectionSetting").value = settings.inspection;
}

function saveSettings() {
  settings = {
    precision: Number($("precisionSetting").value),
    sound: $("soundSetting").value,
    pbAlert: $("pbAlert").value,
    averageAlert: $("averageAlert").value,
    averageMilestone: Number($("averageMilestone").value),
    inspection: Number($("inspectionSetting").value)
  };

  saveJSON(SETTINGS_KEY, settings);
  $("settingsStatus").textContent = "Settings saved.";
  render();
}

/* =========================================
   NAVIGATION
   ========================================= */

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));

    button.classList.add("active");
    $(button.dataset.page).classList.add("active");

    if (button.dataset.page === "simulator-page") {
      initializeCube();
      resizeCube();
    }

    render();
  });
});

/* =========================================
   IMPORT AND EXPORT
   ========================================= */

$("export-data").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(allSolves, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "cube-timer-backup.json";
  link.click();

  URL.revokeObjectURL(url);
});

$("import-data").addEventListener("click", () => $("import-file").click());

$("import-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());

    if (!Array.isArray(imported)) throw new Error("Invalid file");

    const valid = imported.filter(s =>
      s && Number.isFinite(s.time) && s.time > 0 &&
      typeof s.date === "string"
    );

    if (!confirm(`Import ${valid.length} solves?`)) return;

    const existing = new Set(allSolves.map(s => s.id));

    valid.forEach(s => {
      const copy = { ...s };
      if (!copy.id || existing.has(copy.id)) copy.id = makeId();
      existing.add(copy.id);
      allSolves.push(copy);
    });

    allSolves.sort((a, b) => new Date(b.date) - new Date(a.date));

    saveSolves();
    refreshSolves();
    render();

    alert("Import successful.");
  } catch {
    alert("That file could not be imported.");
  }

  event.target.value = "";
});

$("clear-solves").addEventListener("click", () => {
  if (!confirm("Permanently delete all solves in this profile?")) return;

  allSolves = allSolves.filter(s => s.profileId !== activeProfile);
  saveSolves();
  refreshSolves();
  render();
});

/* =========================================
   BUTTON CONNECTIONS
   ========================================= */

$("new-scramble").addEventListener("click", newScramble);
$("manual-add").addEventListener("click", manualAdd);
$("manual-add-history").addEventListener("click", manualAdd);

$("nextCase").addEventListener("click", nextCase);
$("revealAlgorithm").addEventListener("click", revealAlgorithm);
$("saveCustomAlgorithm").addEventListener("click", saveCustomAlgorithm);

$("startAlgorithmTimer").addEventListener("click", startAlgorithmTimer);
$("stopAlgorithmTimer").addEventListener("click", stopAlgorithmTimer);

$("saveSettings").addEventListener("click", saveSettings);
$("profileSelect").addEventListener("change", event => changeProfile(event.target.value));
$("createProfile").addEventListener("click", createProfile);

$("timerPuzzle").addEventListener("change", () => {
  $("timer-heading").textContent =
    `${$("timerPuzzle").value} · ${$("timerStyle").value}`;
});

$("timerStyle").addEventListener("change", () => {
  $("timer-heading").textContent =
    `${$("timerPuzzle").value} · ${$("timerStyle").value}`;
});

$("algorithmCategory").addEventListener("change", nextCase);

window.addEventListener("resize", () => {
  render();
  resizeCube();
});

/* =========================================
   INITIALIZATION
   ========================================= */

refreshSolves();

renderProfiles();
loadSettingsIntoUI();

const initialProfile = getProfile();

$("timerPuzzle").value = initialProfile.puzzle;
$("timerStyle").value = initialProfile.style;
$("timer-heading").textContent =
  `${initialProfile.puzzle} · ${initialProfile.style}`;

newScramble();
render();
nextCase();
renderAlgorithmProgress();
