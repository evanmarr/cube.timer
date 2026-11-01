"use strict";

const $ = id => document.getElementById(id);
const STORAGE_KEY = "cubeTimerSolves";

let solves = loadSolves();
let scramble = generateScramble();
let running = false;
let ready = false;
let startTime = 0;
let animationFrame = null;
let spaceHeld = false;
let holdTimeout = null;
let previousBest = solves.length ? Math.min(...solves.map(s => s.time)) : Infinity;

function loadSolves() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data.filter(s =>
      s && Number.isFinite(s.time) && s.time > 0 &&
      typeof s.date === "string"
    ) : [];
  } catch {
    return [];
  }
}

function saveSolves() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatTime(ms) {
  return Number.isFinite(ms) ? (ms / 1000).toFixed(2) : "--";
}

function parseTime(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n * 1000 : null;
}

/* ---------------- SCRAMBLES ---------------- */

function generateScramble(length = 20) {
  const faces = ["R", "L", "U", "D", "F", "B"];
  const suffixes = ["", "'", "2"];
  const axis = { R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 };
  const result = [];
  let lastFace = "";
  let lastAxis = -1;

  while (result.length < length) {
    const face = faces[Math.floor(Math.random() * faces.length)];
    if (face === lastFace || axis[face] === lastAxis) continue;

    result.push(face + suffixes[Math.floor(Math.random() * 3)]);
    lastFace = face;
    lastAxis = axis[face];
  }
  return result.join(" ");
}

function newScramble() {
  scramble = generateScramble();
  $("scramble").textContent = scramble;
}

/* ---------------- TIMER ---------------- */

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
  if (event.code !== "Space" ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement) return;

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
    if (spaceHeld && ready) $("timer-label").textContent = "RELEASE TO START";
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

/* ---------------- CONFETTI + PERSONAL BEST ---------------- */

function celebratePB() {
  const canvas = $("confetti");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * innerWidth,
    y: -20 - Math.random() * innerHeight,
    size: 4 + Math.random() * 7,
    speed: 2 + Math.random() * 5,
    drift: (Math.random() - 0.5) * 3,
    angle: Math.random() * 6,
    spin: (Math.random() - 0.5) * 0.15,
    color: ["#70e1c1", "#e6bd69", "#83aaff", "#ef8aab", "#ffffff"][
      Math.floor(Math.random() * 5)
    ]
  }));

  let frame = 0;

  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    pieces.forEach(p => {
      p.y += p.speed;
      p.x += p.drift;
      p.angle += p.spin;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
      ctx.restore();
    });

    frame++;
    if (frame < 180) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  draw();
}

/* ---------------- SOLVE MANAGEMENT ---------------- */

function addSolve(time, scrambleText = "") {
  const isPB = time < previousBest;
  solves.unshift({
    id: makeId(),
    time,
    date: new Date().toISOString(),
    scramble: scrambleText
  });

  if (isPB) {
    previousBest = time;
    celebratePB();
    $("timer-label").textContent = "NEW PERSONAL BEST!";
  }

  saveSolves();
  render();
}

function editSolve(id) {
  const solve = solves.find(s => s.id === id);
  if (!solve) return;

  const input = prompt("Enter the new solve time in seconds:", formatTime(solve.time));
  if (input === null) return;

  const time = parseTime(input);
  if (time === null) return alert("Enter a valid time greater than zero.");

  solve.time = time;
  previousBest = solves.length ? Math.min(...solves.map(s => s.time)) : Infinity;
  saveSolves();
  render();
}

function deleteSolve(id) {
  if (!confirm("Delete this solve?")) return;
  solves = solves.filter(s => s.id !== id);
  previousBest = solves.length ? Math.min(...solves.map(s => s.time)) : Infinity;
  saveSolves();
  render();
}

function manualAdd() {
  const input = prompt("Enter solve time in seconds:");
  if (input === null) return;

  const time = parseTime(input);
  if (time === null) return alert("Enter a valid time greater than zero.");

  addSolve(time, "Manual entry");
}

/* ---------------- AVERAGES ---------------- */

function trimmedAverage(group) {
  if (group.length < 3) return null;
  const values = group.map(s => s.time).sort((a, b) => a - b);
  values.shift();
  values.pop();
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function getAverage(n) {
  return solves.length < n ? null : trimmedAverage(solves.slice(0, n));
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

/* ---------------- STATISTICS ---------------- */

function renderStats() {
  $("solve-count").textContent = solves.length;
  $("best-single").textContent = solves.length
    ? formatTime(Math.min(...solves.map(s => s.time))) : "--";

  $("ao5").textContent = getAverage(5) === null ? "--" : formatTime(getAverage(5));
  $("ao12").textContent = getAverage(12) === null ? "--" : formatTime(getAverage(12));
  $("ao50").textContent = getAverage(50) === null ? "--" : formatTime(getAverage(50));
  $("ao100").textContent = getAverage(100) === null ? "--" : formatTime(getAverage(100));
}

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

  return { ctx, w: rect.width, h: rect.height };
}

function drawEmpty(ctx, w, h, message) {
  ctx.fillStyle = "#8995a8";
  ctx.font = "13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(message, w / 2, h / 2);
}

function drawLineGraph(id, datasets, emptyMessage) {
  const result = setupCanvas(id);
  if (!result) return;

  const { ctx, w, h } = result;
  const all = datasets.flatMap(d => d.values);

  if (!all.length) return drawEmpty(ctx, w, h, emptyMessage);

  const left = 42, right = 12, top = 20, bottom = 25;
  const gw = w - left - right, gh = h - top - bottom;
  const min = Math.max(0, Math.floor(Math.min(...all) - 2));
  const max = Math.ceil(Math.max(...all) + 2);

  for (let i = 0; i <= 4; i++) {
    const y = top + gh * i / 4;
    ctx.strokeStyle = "#303a4b";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();

    ctx.fillStyle = "#8995a8";
    ctx.font = "10px system-ui";
    ctx.textAlign = "right";
    ctx.fillText((max - (max - min) * i / 4).toFixed(0) + "s", left - 6, y + 4);
  }

  datasets.forEach(dataset => {
    if (!dataset.values.length) return;

    ctx.strokeStyle = dataset.color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    dataset.values.forEach((v, i) => {
      const x = left + gw * i / Math.max(1, dataset.values.length - 1);
      const y = top + gh * (1 - (v - min) / (max - min || 1));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  });
}

function drawTrendGraph() {
  drawLineGraph("trendGraph", [
    { values: rollingValues(5).map(x => x.value), color: "#70e1c1" },
    { values: rollingValues(12).map(x => x.value), color: "#e6bd69" }
  ], "Complete 12 solves to see trends");
}

function drawGraph() {
  drawLineGraph("graph", [{
    values: [...solves].reverse().map(s => s.time / 1000),
    color: "#70e1c1"
  }], "Complete a solve to begin your graph");
}

function drawDistribution() {
  const result = setupCanvas("distributionGraph");
  if (!result) return;
  const { ctx, w, h } = result;
  const times = solves.map(s => s.time / 1000);

  if (!times.length) return drawEmpty(ctx, w, h, "Your solve distribution will appear here");

  const min = Math.floor(Math.min(...times) / 5) * 5;
  const max = Math.ceil(Math.max(...times) / 5) * 5;
  const bins = [];

  for (let t = min; t <= max; t += 5) bins.push({ label: `${t}-${t + 5}`, count: 0 });

  times.forEach(t => {
    const i = Math.min(Math.floor((t - min) / 5), bins.length - 1);
    bins[i].count++;
  });

  const left = 35, right = 10, top = 15, bottom = 35;
  const gw = w - left - right, gh = h - top - bottom;
  const highest = Math.max(...bins.map(b => b.count), 1);
  const slot = gw / bins.length;

  bins.forEach((b, i) => {
    const barHeight = b.count / highest * gh;
    const x = left + i * slot;
    ctx.fillStyle = "#70e1c1";
    ctx.fillRect(x + 2, top + gh - barHeight, Math.max(1, slot - 5), barHeight);

    if (bins.length <= 12 || i % 2 === 0) {
      ctx.fillStyle = "#8995a8";
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(b.label, x + slot / 2, h - 10);
    }
  });
}

/* ---------------- CALENDAR + RECORDS ---------------- */

function renderCalendar() {
  const container = $("calendar");
  container.replaceChildren();

  const counts = {};
  solves.forEach(s => {
    const day = new Date(s.date).toLocaleDateString("en-CA");
    counts[day] = (counts[day] || 0) + 1;
  });

  const max = Math.max(1, ...Object.values(counts));
  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  for (let i = 83; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);

    const key = d.toLocaleDateString("en-CA");
    const count = counts[key] || 0;
    const level = count ? Math.min(4, Math.ceil(count / max * 4)) : 0;

    const square = document.createElement("div");
    square.className = "calendar-day";
    square.dataset.level = level;
    square.title = `${key}: ${count} solves`;
    grid.appendChild(square);
  }

  container.appendChild(grid);

  const labels = document.createElement("div");
  labels.className = "calendar-labels";
  labels.innerHTML = "<span>84 days ago</span><span>Today</span>";
  container.appendChild(labels);
}

function renderRecords() {
  const container = $("personalRecords");
  container.replaceChildren();

  const chronological = [...solves].reverse();
  const records = [];

  if (solves.length) {
    const best = solves.reduce((a, b) => a.time < b.time ? a : b);
    records.push({ name: "Best Single", value: best.time, date: best.date });
  }

  [5, 12, 50, 100].forEach(n => {
    if (chronological.length < n) return;

    let best = null;
    for (let i = n - 1; i < chronological.length; i++) {
      const value = trimmedAverage(chronological.slice(i - n + 1, i + 1));
      if (best === null || value < best.value) {
        best = { value, date: chronological[i].date };
      }
    }
    records.push({ name: `Best Ao${n}`, ...best });
  });

  if (!records.length) {
    container.textContent = "Complete some solves to establish your records.";
    return;
  }

  records.forEach(r => {
    const item = document.createElement("div");
    item.className = "record-item";

    const title = document.createElement("div");
    title.className = "label";
    title.textContent = r.name;

    const value = document.createElement("div");
    value.className = "value";
    value.textContent = formatTime(r.value);

    const date = document.createElement("small");
    date.textContent = "Achieved: " + new Date(r.date).toLocaleDateString();

    item.append(title, value, date);
    container.appendChild(item);
  });
}

/* ---------------- HISTORY ---------------- */

function renderHistory() {
  const container = $("solve-list");
  container.replaceChildren();

  if (!solves.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
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
    remove.className = "danger";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteSolve(solve.id));

    actions.append(edit, remove);
    row.append(number, info, actions);
    container.appendChild(row);
  });
}

function render() {
  renderStats();
  renderHistory();
  renderRecords();
  renderCalendar();
  drawTrendGraph();
  drawDistribution();
  drawGraph();
}

/* ---------------- NAVIGATION ---------------- */

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));

    button.classList.add("active");
    $(button.dataset.page).classList.add("active");

    if (button.dataset.page === "sim-page") {
      setTimeout(resizeCubeRenderer, 50);
    }
    render();
  });
});

/* ---------------- BUTTONS + BACKUPS ---------------- */

$("new-scramble").addEventListener("click", newScramble);
$("manual-add").addEventListener("click", manualAdd);
$("manual-add-history").addEventListener("click", manualAdd);

$("clear-solves").addEventListener("click", () => {
  if (!confirm("Permanently delete all saved solves?")) return;
  solves = [];
  previousBest = Infinity;
  saveSolves();
  render();
});

$("export-data").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(solves, null, 2)], {
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
    if (!Array.isArray(imported)) throw new Error("Invalid backup");

    const valid = imported.filter(s =>
      s && Number.isFinite(s.time) && s.time > 0 && typeof s.date === "string"
    );

    if (!confirm(`Import ${valid.length} solves? They will be added to your current history.`)) {
      event.target.value = "";
      return;
    }

    const ids = new Set(solves.map(s => s.id));
    valid.forEach(s => {
      if (!s.id || ids.has(s.id)) s.id = makeId();
      solves.push(s);
    });

    solves.sort((a, b) => new Date(b.date) - new Date(a.date));
    previousBest = solves.length ? Math.min(...solves.map(s => s.time)) : Infinity;
    saveSolves();
    render();
    alert("Backup imported successfully.");
  } catch {
    alert("That file could not be imported.");
  }

  event.target.value = "";
});

/* ---------------- 3D CUBE ---------------- */

let scene, camera, renderer, cubeGroup;
let cubeInitialized = false;
let drag = false;
let lastPointer = { x: 0, y: 0 };
let cubeMoves = [];
let moveQueue = [];
let animating = false;

const cubelets = [];
const COLORS = {
  R: 0xc62828, L: 0xff8c00, U: 0xffffff,
  D: 0xffd500, F: 0x159447, B: 0x2455c5
};

function createCube() {
  const stage = $("cube-stage");
  if (!stage || cubeInitialized || !window.THREE) return;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, stage.clientWidth / stage.clientHeight, 0.1, 100);
  camera.position.set(5, 5, 7);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  stage.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(5, 8, 7);
  scene.add(light);

  cubeGroup = new THREE.Group();
  scene.add(cubeGroup);
  buildCubelets();

  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  cubeInitialized = true;
  enableCubeDrag(stage);
}

function buildCubelets() {
  cubelets.length = 0;
  while (cubeGroup.children.length) cubeGroup.remove(cubeGroup.children[0]);

  const gap = 1.02;
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const materials = [
          new THREE.MeshStandardMaterial({ color: x === 1 ? COLORS.R : 0x17191d }),
          new THREE.MeshStandardMaterial({ color: x === -1 ? COLORS.L : 0x17191d }),
          new THREE.MeshStandardMaterial({ color: y === 1 ? COLORS.U : 0x17191d }),
          new THREE.MeshStandardMaterial({ color: y === -1 ? COLORS.D : 0x17191d }),
          new THREE.MeshStandardMaterial({ color: z === 1 ? COLORS.F : 0x17191d }),
          new THREE.MeshStandardMaterial({ color: z === -1 ? COLORS.B : 0x17191d })
        ];

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.96, 0.96), materials);
        mesh.position.set(x * gap, y * gap, z * gap);
        mesh.userData.home = { x, y, z };
        cubeGroup.add(mesh);
        cubelets.push(mesh);
      }
    }
  }
}

function resizeCubeRenderer() {
  if (!cubeInitialized || !renderer) return;
  const stage = $("cube-stage");
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function enableCubeDrag(stage) {
  stage.addEventListener("pointerdown", event => {
    drag = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointermove", event => {
    if (!drag) return;

    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    cubeGroup.rotation.y += dx * 0.009;
    cubeGroup.rotation.x += dy * 0.009;
    lastPointer = { x: event.clientX, y: event.clientY };
  });

  stage.addEventListener("pointerup", () => drag = false);
  stage.addEventListener("pointercancel", () => drag = false);
}

function moveDetails(move) {
  const face = move[0];
  const prime = move.includes("'");
  const twice = move.includes("2");
  const turns = twice ? 2 : 1;

  const details = {
    R: { axis: "x", layer: 1, direction: -1 },
    L: { axis: "x", layer: -1, direction: 1 },
    U: { axis: "y", layer: 1, direction: -1 },
    D: { axis: "y", layer: -1, direction: 1 },
    F: { axis: "z", layer: 1, direction: -1 },
    B: { axis: "z", layer: -1, direction: 1 }
  }[face];

  return {
    ...details,
    angle: details.direction * (prime ? -1 : 1) * Math.PI / 2 * turns
  };
}

function animateMove(move) {
  if (!cubeInitialized || animating) return;
  const detail = moveDetails(move);
  if (!detail) return;

  animating = true;
  const axisVector = new THREE.Vector3(
    detail.axis === "x" ? 1 : 0,
    detail.axis === "y" ? 1 : 0,
    detail.axis === "z" ? 1 : 0
  );

  const layer = new THREE.Group();
  cubeGroup.add(layer);

  const selected = cubelets.filter(c =>
    Math.round(c.position[detail.axis]) === detail.layer
  );

  selected.forEach(c => {
    cubeGroup.remove(c);
    layer.add(c);
  });

  const start = performance.now();
  const duration = 240;
  const totalAngle = detail.angle;

  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    layer.rotation.set(0, 0, 0);
    layer.rotation[detail.axis] = totalAngle * eased;

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      layer.updateMatrixWorld(true);

      const children = [...layer.children];
      children.forEach(c => {
        c.applyMatrix4(layer.matrix);
        cubeGroup.add(c);
        c.position.set(
          Math.round(c.position.x * 100) / 100,
          Math.round(c.position.y * 100) / 100,
          Math.round(c.position.z * 100) / 100
        );
        c.rotation.set(
          Math.round(c.rotation.x / (Math.PI / 2)) * Math.PI / 2,
          Math.round(c.rotation.y / (Math.PI / 2)) * Math.PI / 2,
          Math.round(c.rotation.z / (Math.PI / 2)) * Math.PI / 2
        );
      });

      cubeGroup.remove(layer);
      animating = false;
      const next = moveQueue.shift();
      if (next) animateMove(next);
    }
  }

  requestAnimationFrame(frame);
}

function playMove(move) {
  if (!moveDetails(move)) return;
  cubeMoves.push(move);
  renderMoveList();
  if (!cubeInitialized) createCube();
  if (animating) moveQueue.push(move);
  else animateMove(move);
}

function renderMoveList() {
  const container = $("sim-moves");
  container.replaceChildren();

  if (!cubeMoves.length) {
    container.textContent = "No moves yet.";
    return;
  }

  cubeMoves.forEach(move => {
    const chip = document.createElement("span");
    chip.className = "move-chip";
    chip.textContent = move;
    container.appendChild(chip);
  });
}

$("sim-turn").addEventListener("click", () => playMove($("move-select").value));

$("sim-scramble").addEventListener("click", () => {
  if (!cubeInitialized) createCube();
  cubeMoves = [];
  moveQueue = [];
  renderMoveList();
  const moves = generateScramble().split(" ");
  moves.forEach((move, i) => setTimeout(() => playMove(move), i * 280));
});

$("sim-reset").addEventListener("click", () => {
  if (!cubeInitialized) createCube();
  moveQueue = [];
  cubeMoves = [];
  animating = false;
  buildCubelets();
  renderMoveList();
});

$("sim-undo").addEventListener("click", () => {
  const last = cubeMoves.pop();
  if (!last) return;

  renderMoveList();
  const inverse = last.endsWith("2")
    ? last
    : last.endsWith("'") ? last[0] : last + "'";

  playMove(inverse);
  cubeMoves.pop();
  renderMoveList();
});

/* ---------------- ALGORITHM TRAINER ---------------- */

const TRAINER_CASES = {
  OLL: [
    {
      name: "Anti-Sune (OLL 26)",
      description: "A last-layer orientation case. Recognize the top pattern before performing the algorithm.",
      alg: "R U2 R' U' R U' R'",
      pattern: [1,1,1,1,0,1,0,1,0]
    },
    {
      name: "H Pattern (OLL 21)",
      description: "A cross-shaped top pattern.",
      alg: "R U R' U R U' R' U R U2 R'",
      pattern: [0,1,0,1,1,1,0,1,0]
    },
    {
      name: "T Pattern (OLL 33)",
      description: "A T-shaped top pattern.",
      alg: "R U R' U' R' F R F'",
      pattern: [1,1,1,0,1,0,0,1,0]
    },
    {
      name: "Sune",
      description: "A familiar last-layer orientation pattern.",
      alg: "R U R' U R U2 R'",
      pattern: [1,1,0,1,1,0,0,1,1]
    }
  ],
  PLL: [
    {
      name: "Ua Perm",
      description: "Cycles three last-layer edges in one direction.",
      alg: "R U' R U R U R U' R' U' R2",
      pattern: [0,1,0,1,1,1,0,1,0]
    },
    {
      name: "Ub Perm",
      description: "Cycles three last-layer edges in the opposite direction.",
      alg: "R2 U R U R' U' R' U' R' U R'",
      pattern: [0,1,0,1,1,1,0,1,0]
    },
    {
      name: "T Perm",
      description: "Swaps two corners and two edges.",
      alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
      pattern: [1,0,1,0,1,0,1,0,1]
    }
  ],
  F2L: [
    {
      name: "Basic Pair Insert",
      description: "A basic example of pairing a corner and edge before inserting them.",
      alg: "U R U' R'",
      pattern: [1,0,1,0,1,0,0,1,0]
    },
    {
      name: "Right Pair Insert",
      description: "A simple right-side insertion sequence.",
      alg: "U R U' R' U' F' U F",
      pattern: [0,1,0,1,0,1,1,0,0]
    }
  ]
};

let currentTrainerCase = null;
let algorithmVisible = true;

function makeCaseDiagram(pattern) {
  const colors = ["#ffffff", "#f3d343"];
  let cells = "";

  pattern.forEach((value, i) => {
    const x = 20 + (i % 3) * 67;
    const y = 20 + Math.floor(i / 3) * 67;
    cells += `<rect x="${x}" y="${y}" width="61" height="61" rx="7" fill="${colors[value]}" stroke="#252d3b" stroke-width="4"/>`;
  });

  return `<svg viewBox="0 0 240 240" role="img" aria-label="Top-face case pattern">
    <rect x="9" y="9" width="222" height="222" rx="12" fill="#252d3b"/>
    ${cells}
  </svg>`;
}

function updateTrainerCases() {
  const category = $("trainer-category").value;
  const select = $("trainer-case");
  select.replaceChildren();

  TRAINER_CASES[category].forEach((item, index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = item.name;
    select.appendChild(option);
  });

  showTrainerCase(0);
}

function showTrainerCase(index) {
  const category = $("trainer-category").value;
  currentTrainerCase = TRAINER_CASES[category][index];
  if (!currentTrainerCase) return;

  $("case-title").textContent = currentTrainerCase.name;
  $("case-description").textContent = currentTrainerCase.description;
  $("case-image").innerHTML = makeCaseDiagram(currentTrainerCase.pattern);
  algorithmVisible = false;
  $("case-algorithm").textContent = "Algorithm hidden";
  $("trainer-note").textContent = "Try to recognize the pattern before revealing the algorithm.";
}

$("trainer-category").addEventListener("change", updateTrainerCases);
$("trainer-case").addEventListener("change", () => showTrainerCase(Number($("trainer-case").value)));

$("show-algorithm").addEventListener("click", () => {
  if (!currentTrainerCase) return;
  algorithmVisible = !algorithmVisible;
  $("case-algorithm").textContent = algorithmVisible
    ? currentTrainerCase.alg : "Algorithm hidden";
  $("show-algorithm").textContent = algorithmVisible ? "Hide Algorithm" : "Show Algorithm";
});

$("next-case").addEventListener("click", () => {
  const select = $("trainer-case");
  select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
  showTrainerCase(select.selectedIndex);
});

/* ---------------- INITIALIZATION ---------------- */

$("scramble").textContent = scramble;
updateTrainerCases();
render();

window.addEventListener("resize", () => {
  render();
  resizeCubeRenderer();
});
