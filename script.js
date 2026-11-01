"use strict";

/* =========================================================
   CUBE.TIMER
   Timer, statistics, history, simulator, trainer and settings
========================================================= */

const $ = id => document.getElementById(id);
const STORAGE_KEY = "cubeTimerSolves";
const SETTINGS_KEY = "cubeTimerSettings";

const DEFAULT_SETTINGS = {
  cubeSize: 3,
  animationSpeed: 260,
  inspection: false,
  confetti: true,
  precision: 2
};

let settings = loadSettings();
let solves = loadSolves();
let scramble = generateScramble();
let running = false;
let ready = false;
let startTime = 0;
let animationFrame = null;
let spaceHeld = false;
let holdTimeout = null;
let previousBest = solves.length
  ? Math.min(...solves.map(s => s.time))
  : Infinity;

function loadSolves() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data)
      ? data.filter(s =>
          s &&
          Number.isFinite(s.time) &&
          s.time > 0 &&
          typeof s.date === "string"
        )
      : [];
  } catch {
    return [];
  }
}

function saveSolves() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
}

function loadSettings() {
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function makeId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function formatTime(ms) {
  if (!Number.isFinite(ms)) return "--";
  return (ms / 1000).toFixed(settings.precision);
}

function parseTime(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n * 1000 : null;
}

/* =========================================================
   SCRAMBLES
========================================================= */

function generateScramble(length = 20) {
  const faces = ["R", "L", "U", "D", "F", "B"];
  const suffixes = ["", "'", "2"];
  const axis = {
    R: 0, L: 0,
    U: 1, D: 1,
    F: 2, B: 2
  };

  const result = [];
  let lastFace = "";
  let lastAxis = -1;

  while (result.length < length) {
    const face = faces[Math.floor(Math.random() * faces.length)];

    if (face === lastFace || axis[face] === lastAxis) continue;

    result.push(
      face + suffixes[Math.floor(Math.random() * suffixes.length)]
    );

    lastFace = face;
    lastAxis = axis[face];
  }

  return result.join(" ");
}

function newScramble() {
  scramble = generateScramble();
  $("scramble").textContent = scramble;
}

/* =========================================================
   TIMER
========================================================= */

function updateTimer() {
  if (!running) return;

  $("timer").textContent = formatTime(
    performance.now() - startTime
  );

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
    if (!$("timer-label")) return;

    if (!$("timer-label").textContent.includes("PERSONAL BEST")) {
      $("timer-label").textContent =
        "Hold SPACE, then release to start";
    }

    newScramble();
  }, 1200);
}

function prepareTimer() {
  if (running || ready) return;

  ready = true;

  $("timer").textContent = "0.00";
  $("timer").className = "ready";
  $("timer-label").textContent = "READY";
}

document.addEventListener("keydown", event => {
  if (
    event.code !== "Space" ||
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

  if (ready && !running) {
    startTimer();
  }
});

window.addEventListener("blur", () => {
  spaceHeld = false;
  clearTimeout(holdTimeout);
});

/* =========================================================
   CONFETTI
========================================================= */

function celebratePB() {
  if (!settings.confetti) return;

  const canvas = $("confetti");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = [
    "#70e1c1",
    "#e6bd69",
    "#83aaff",
    "#ef8aab",
    "#ffffff"
  ];

  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * innerWidth,
    y: -20 - Math.random() * innerHeight,
    size: 4 + Math.random() * 7,
    speed: 2 + Math.random() * 5,
    drift: (Math.random() - 0.5) * 3,
    angle: Math.random() * 6,
    spin: (Math.random() - 0.5) * 0.15,
    color: colors[Math.floor(Math.random() * colors.length)]
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
      ctx.fillRect(
        -p.size / 2,
        -p.size / 2,
        p.size,
        p.size * 0.65
      );
      ctx.restore();
    });

    frame++;

    if (frame < 180) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }

  draw();
}

/* =========================================================
   SOLVE MANAGEMENT
========================================================= */

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

  const input = prompt(
    "Enter the new solve time in seconds:",
    formatTime(solve.time)
  );

  if (input === null) return;

  const time = parseTime(input);

  if (time === null) {
    return alert("Enter a valid time greater than zero.");
  }

  solve.time = time;

  previousBest = solves.length
    ? Math.min(...solves.map(s => s.time))
    : Infinity;

  saveSolves();
  render();
}

function deleteSolve(id) {
  if (!confirm("Delete this solve?")) return;

  solves = solves.filter(s => s.id !== id);

  previousBest = solves.length
    ? Math.min(...solves.map(s => s.time))
    : Infinity;

  saveSolves();
  render();
}

function manualAdd() {
  const input = prompt("Enter solve time in seconds:");
  if (input === null) return;

  const time = parseTime(input);

  if (time === null) {
    return alert("Enter a valid time greater than zero.");
  }

  addSolve(time, "Manual entry");
}

/* =========================================================
   AVERAGES
========================================================= */

function trimmedAverage(group) {
  if (group.length < 3) return null;

  const values = group
    .map(s => s.time)
    .sort((a, b) => a - b);

  values.shift();
  values.pop();

  return values.reduce((a, b) => a + b, 0) / values.length;
}

function getAverage(n) {
  return solves.length < n
    ? null
    : trimmedAverage(solves.slice(0, n));
}

function rollingValues(n) {
  const chronological = [...solves].reverse();
  const result = [];

  for (let i = n - 1; i < chronological.length; i++) {
    result.push({
      value: trimmedAverage(
        chronological.slice(i - n + 1, i + 1)
      ) / 1000
    });
  }

  return result;
}

/* =========================================================
   STATISTICS AND GRAPHS
========================================================= */

function renderStats() {
  $("solve-count").textContent = solves.length;

  $("best-single").textContent = solves.length
    ? formatTime(Math.min(...solves.map(s => s.time)))
    : "--";

  [5, 12, 50, 100].forEach(n => {
    const average = getAverage(n);
    const element = $("ao" + n);

    if (element) {
      element.textContent = average === null
        ? "--"
        : formatTime(average);
    }
  });
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

  return {
    ctx,
    w: rect.width,
    h: rect.height
  };
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

  if (!all.length) {
    return drawEmpty(ctx, w, h, emptyMessage);
  }

  const left = 42;
  const right = 12;
  const top = 20;
  const bottom = 25;

  const gw = w - left - right;
  const gh = h - top - bottom;

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

    ctx.fillText(
      (max - (max - min) * i / 4).toFixed(0) + "s",
      left - 6,
      y + 4
    );
  }

  datasets.forEach(dataset => {
    if (!dataset.values.length) return;

    ctx.strokeStyle = dataset.color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    dataset.values.forEach((v, i) => {
      const x = left + gw * i /
        Math.max(1, dataset.values.length - 1);

      const y = top + gh *
        (1 - (v - min) / (max - min || 1));

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  });
}

function drawTrendGraph() {
  drawLineGraph("trendGraph", [
    {
      values: rollingValues(5).map(x => x.value),
      color: "#70e1c1"
    },
    {
      values: rollingValues(12).map(x => x.value),
      color: "#e6bd69"
    }
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

  if (!times.length) {
    return drawEmpty(
      ctx,
      w,
      h,
      "Your solve distribution will appear here"
    );
  }

  let min = Math.floor(Math.min(...times) / 5) * 5;
  let max = Math.ceil(Math.max(...times) / 5) * 5;

  if (min === max) max += 5;

  const bins = [];

  for (let t = min; t < max; t += 5) {
    bins.push({
      label: `${t}-${t + 5}`,
      count: 0
    });
  }

  if (!bins.length) {
    bins.push({ label: `${min}-${min + 5}`, count: 0 });
  }

  times.forEach(t => {
    const i = Math.min(
      Math.floor((t - min) / 5),
      bins.length - 1
    );

    bins[i].count++;
  });

  const left = 35;
  const right = 10;
  const top = 15;
  const bottom = 35;

  const gw = w - left - right;
  const gh = h - top - bottom;

  const highest = Math.max(...bins.map(b => b.count), 1);
  const slot = gw / bins.length;

  bins.forEach((b, i) => {
    const barHeight = b.count / highest * gh;
    const x = left + i * slot;

    ctx.fillStyle = "#70e1c1";
    ctx.fillRect(
      x + 2,
      top + gh - barHeight,
      Math.max(1, slot - 5),
      barHeight
    );

    if (bins.length <= 12 || i % 2 === 0) {
      ctx.fillStyle = "#8995a8";
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(b.label, x + slot / 2, h - 10);
    }
  });
}

/* =========================================================
   CALENDAR AND RECORDS
========================================================= */

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

    const level = count
      ? Math.min(4, Math.ceil(count / max * 4))
      : 0;

    const square = document.createElement("div");
    square.className = "calendar-day";
    square.dataset.level = level;
    square.title = `${key}: ${count} solves`;

    grid.appendChild(square);
  }

  container.appendChild(grid);

  const labels = document.createElement("div");
  labels.className = "calendar-labels";
  labels.innerHTML =
    "<span>84 days ago</span><span>Today</span>";

  container.appendChild(labels);
}

function renderRecords() {
  const container = $("personalRecords");
  container.replaceChildren();

  const chronological = [...solves].reverse();
  const records = [];

  if (solves.length) {
    const best = solves.reduce(
      (a, b) => a.time < b.time ? a : b
    );

    records.push({
      name: "Best Single",
      value: best.time,
      date: best.date
    });
  }

  [5, 12, 50, 100].forEach(n => {
    if (chronological.length < n) return;

    let best = null;

    for (let i = n - 1; i < chronological.length; i++) {
      const value = trimmedAverage(
        chronological.slice(i - n + 1, i + 1)
      );

      if (best === null || value < best.value) {
        best = {
          value,
          date: chronological[i].date
        };
      }
    }

    records.push({
      name: `Best Ao${n}`,
      ...best
    });
  });

  if (!records.length) {
    container.textContent =
      "Complete some solves to establish your records.";
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
    date.textContent =
      "Achieved: " + new Date(r.date).toLocaleDateString();

    item.append(title, value, date);
    container.appendChild(item);
  });
}

/* =========================================================
   HISTORY
========================================================= */

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

/* =========================================================
   NAVIGATION
========================================================= */

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab =>
      tab.classList.remove("active")
    );

    document.querySelectorAll(".page").forEach(page =>
      page.classList.remove("active")
    );

    button.classList.add("active");
    $(button.dataset.page).classList.add("active");

    if (button.dataset.page === "sim-page") {
      setTimeout(() => {
        createCube();
        resizeCubeRenderer();
      }, 60);
    }

    render();
  });
});

/* =========================================================
   BACKUPS AND BUTTONS
========================================================= */

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
  const blob = new Blob(
    [JSON.stringify(solves, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "cube-timer-backup.json";
  link.click();

  URL.revokeObjectURL(url);
});

$("import-data").addEventListener("click", () => {
  $("import-file").click();
});

$("import-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const imported = JSON.parse(await file.text());

    if (!Array.isArray(imported)) {
      throw new Error("Invalid backup");
    }

    const valid = imported.filter(s =>
      s &&
      Number.isFinite(s.time) &&
      s.time > 0 &&
      typeof s.date === "string"
    );

    if (!confirm(
      `Import ${valid.length} solves? They will be added to your current history.`
    )) {
      event.target.value = "";
      return;
    }

    const ids = new Set(solves.map(s => s.id));

    valid.forEach(s => {
      if (!s.id || ids.has(s.id)) s.id = makeId();
      solves.push(s);
    });

    solves.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    previousBest = solves.length
      ? Math.min(...solves.map(s => s.time))
      : Infinity;

    saveSolves();
    render();

    alert("Backup imported successfully.");
  } catch {
    alert("That file could not be imported.");
  }

  event.target.value = "";
});

/* =========================================================
   SETTINGS
========================================================= */

function initializeSettings() {
  $("setting-cube-size").value = settings.cubeSize;
  $("setting-animation-speed").value = settings.animationSpeed;
  $("setting-inspection").checked = settings.inspection;
  $("setting-confetti").checked = settings.confetti;
  $("setting-precision").value = settings.precision;

  $("setting-cube-size").addEventListener("change", event => {
    settings.cubeSize = Number(event.target.value);
    saveSettings();

    alert(
      "The current 3D simulator is designed for a 3×3 cube. " +
      "Other cube sizes are saved as preferences but are not implemented yet."
    );

    event.target.value = "3";
    settings.cubeSize = 3;
    saveSettings();
  });

  $("setting-animation-speed").addEventListener("change", event => {
    settings.animationSpeed = Number(event.target.value);
    saveSettings();
  });

  $("setting-inspection").addEventListener("change", event => {
    settings.inspection = event.target.checked;
    saveSettings();
  });

  $("setting-confetti").addEventListener("change", event => {
    settings.confetti = event.target.checked;
    saveSettings();
  });

  $("setting-precision").addEventListener("change", event => {
    settings.precision = Number(event.target.value);
    saveSettings();
    render();
  });
}

/* =========================================================
   3D CUBE SIMULATOR
========================================================= */

let scene;
let camera;
let renderer;
let cubeGroup;
let cubeInitialized = false;
let drag = false;
let lastPointer = { x: 0, y: 0 };

let cubeMoves = [];
let moveQueue = [];
let animating = false;
let paused = false;

const cubelets = [];

const COLORS = {
  R: 0xc62828,
  L: 0xff8c00,
  U: 0xffffff,
  D: 0xffd500,
  F: 0x159447,
  B: 0x2455c5
};

function createCube() {
  const stage = $("cube-stage");

  if (!stage || cubeInitialized || !window.THREE) return;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    40,
    stage.clientWidth / stage.clientHeight,
    0.1,
    100
  );

  camera.position.set(5, 5, 7);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
  });

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

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });

  cubeInitialized = true;
  enableCubeDrag(stage);
}

function buildCubelets() {
  cubelets.length = 0;

  while (cubeGroup.children.length) {
    cubeGroup.remove(cubeGroup.children[0]);
  }

  const gap = 1.02;

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const materials = [
          new THREE.MeshStandardMaterial({
            color: x === 1 ? COLORS.R : 0x17191d
          }),
          new THREE.MeshStandardMaterial({
            color: x === -1 ? COLORS.L : 0x17191d
          }),
          new THREE.MeshStandardMaterial({
            color: y === 1 ? COLORS.U : 0x17191d
          }),
          new THREE.MeshStandardMaterial({
            color: y === -1 ? COLORS.D : 0x17191d
          }),
          new THREE.MeshStandardMaterial({
            color: z === 1 ? COLORS.F : 0x17191d
          }),
          new THREE.MeshStandardMaterial({
            color: z === -1 ? COLORS.B : 0x17191d
          })
        ];

        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.96, 0.96, 0.96),
          materials
        );

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
    if (animating) return;

    drag = true;

    lastPointer = {
      x: event.clientX,
      y: event.clientY
    };

    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointermove", event => {
    if (!drag || !cubeGroup) return;

    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;

    cubeGroup.rotation.y += dx * 0.009;
    cubeGroup.rotation.x += dy * 0.009;

    lastPointer = {
      x: event.clientX,
      y: event.clientY
    };
  });

  stage.addEventListener("pointerup", () => {
    drag = false;
  });

  stage.addEventListener("pointercancel", () => {
    drag = false;
  });
}

/*
  Move definitions.

  R/L/U/D/F/B = outer faces
  r/l/u/d/f/b = wide turns
  M/E/S = middle slices
  x/y/z = whole cube rotations

  Wide, slice and whole-cube moves are animated
  as visual layer rotations.
*/

function moveDetails(move) {
  const match = move.match(/^([RLUDFBrludfbMESxyz])([2']?)$/);
  if (!match) return null;

  const face = match[1];
  const suffix = match[2];

  const twice = suffix === "2";
  const prime = suffix === "'";

  const direction = prime ? -1 : 1;
  const turns = twice ? 2 : 1;

  const definitions = {
    R: { axis: "x", layers: [1], direction: -1 },
    L: { axis: "x", layers: [-1], direction: 1 },

    U: { axis: "y", layers: [1], direction: -1 },
    D: { axis: "y", layers: [-1], direction: 1 },

    F: { axis: "z", layers: [1], direction: -1 },
    B: { axis: "z", layers: [-1], direction: 1 },

    r: { axis: "x", layers: [0, 1], direction: -1 },
    l: { axis: "x", layers: [-1, 0], direction: 1 },

    u: { axis: "y", layers: [0, 1], direction: -1 },
    d: { axis: "y", layers: [-1, 0], direction: 1 },

    f: { axis: "z", layers: [0, 1], direction: -1 },
    b: { axis: "z", layers: [-1, 0], direction: 1 },

    M: { axis: "x", layers: [0], direction: 1 },
    E: { axis: "y", layers: [0], direction: 1 },
    S: { axis: "z", layers: [0], direction: -1 },

    x: { axis: "x", layers: [-1, 0, 1], direction: -1 },
    y: { axis: "y", layers: [-1, 0, 1], direction: -1 },
    z: { axis: "z", layers: [-1, 0, 1], direction: -1 }
  };

  const definition = definitions[face];
  if (!definition) return null;

  return {
    ...definition,
    angle:
      definition.direction *
      direction *
      Math.PI / 2 *
      turns
  };
}

function animateMove(move) {
  if (!cubeInitialized || animating || paused) return;

  const detail = moveDetails(move);
  if (!detail) return;

  animating = true;

  const axis = detail.axis;
  const layer = new THREE.Group();

  cubeGroup.add(layer);

  const selected = cubelets.filter(c => {
    const coordinate = Math.round(c.position[axis]);
    return detail.layers.includes(coordinate);
  });

  selected.forEach(c => {
    cubeGroup.remove(c);
    layer.add(c);
  });

  const start = performance.now();
  const duration = settings.animationSpeed;
  const totalAngle = detail.angle;

  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);

    layer.rotation.set(0, 0, 0);
    layer.rotation[axis] = totalAngle * eased;

    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }

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

    processMoveQueue();
  }

  requestAnimationFrame(frame);
}

function processMoveQueue() {
  if (paused || animating) return;

  const next = moveQueue.shift();

  if (next) {
    animateMove(next);
  }
}

function playMove(move, record = true) {
  if (!moveDetails(move)) return false;

  if (!cubeInitialized) createCube();

  if (record) {
    cubeMoves.push(move);
    renderMoveList();
  }

  moveQueue.push(move);
  processMoveQueue();

  return true;
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

function parseAlgorithm(text) {
  const cleaned = text
    .replace(/\([^)]*\)/g, match => match.slice(1, -1))
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  const tokens = cleaned.split(" ");

  const valid = /^[RLUDFBrludfbMESxyz][2']?$/;

  const invalid = tokens.filter(token => !valid.test(token));

  if (invalid.length) {
    alert("Unrecognized moves: " + invalid.join(", "));
    return null;
  }

  return tokens;
}

function runAlgorithm(text) {
  const moves = parseAlgorithm(text);

  if (!moves || !moves.length) return;

  if (!cubeInitialized) createCube();

  moves.forEach(move => {
    playMove(move);
  });
}

function inverseMove(move) {
  if (move.endsWith("2")) return move;

  if (move.endsWith("'")) {
    return move.slice(0, -1);
  }

  return move + "'";
}

$("sim-turn").addEventListener("click", () => {
  playMove($("move-select").value);
});

$("sim-run-algorithm").addEventListener("click", () => {
  runAlgorithm($("sim-algorithm").value);
});

$("sim-pause").addEventListener("click", () => {
  paused = !paused;

  $("sim-pause").textContent = paused
    ? "Resume"
    : "Pause";

  if (!paused) {
    processMoveQueue();
  }
});

$("sim-scramble").addEventListener("click", () => {
  if (!cubeInitialized) createCube();

  moveQueue = [];
  cubeMoves = [];

  renderMoveList();

  const moves = generateScramble().split(" ");

  moves.forEach(move => {
    playMove(move);
  });
});

$("sim-reset").addEventListener("click", () => {
  if (!cubeInitialized) createCube();

  moveQueue = [];
  cubeMoves = [];
  animating = false;
  paused = false;

  $("sim-pause").textContent = "Pause";

  buildCubelets();

  cubeGroup.rotation.set(0, 0, 0);

  renderMoveList();
});

$("sim-undo").addEventListener("click", () => {
  if (animating || moveQueue.length) return;

  const last = cubeMoves.pop();
  if (!last) return;

  renderMoveList();

  playMove(inverseMove(last), false);

  cubeMoves.pop();
  renderMoveList();
});

/* =========================================================
   ALGORITHM TRAINER
========================================================= */

const TRAINER_CASES = {
  OLL: [
    {
      number: 1,
      name: "Anti-Sune",
      group: "Sune / Anti-Sune",
      description: "One corner is twisted the opposite direction from a Sune pattern.",
      recognition: "Look for a single yellow corner on the top face, with the adjacent stickers forming an anti-clockwise pattern.",
      alg: "R U2 R' U' R U' R'",
      setup: "",
      solution: "R U2 R' U' R U' R'",
      probability: "~2.8%",
      pattern: [0,0,0,0,1,0,1,1,0],
      type: "OLL"
    },
    {
      number: 2,
      name: "Sune",
      group: "Sune / Anti-Sune",
      description: "A classic one-corner orientation case with an L-shaped yellow pattern.",
      recognition: "The yellow stickers form a clock-wise corner and the remaining top face is mostly grey.",
      alg: "R U R' U R U2 R'",
      setup: "",
      solution: "R U R' U R U2 R'",
      probability: "~4.0%",
      pattern: [0,0,0,0,1,1,0,1,0],
      type: "OLL"
    },
    {
      number: 3,
      name: "Headlights",
      group: "Bar / Line",
      description: "The top face has a pair of oriented edge stickers on the front and back.",
      recognition: "Two opposite top edges are solved and the other four are not; this creates a visible headlight look.",
      alg: "R U2 R2 U' R2 U' R2 U2 R",
      setup: "",
      solution: "R U2 R2 U' R2 U' R2 U2 R",
      probability: "~2.6%",
      pattern: [0,1,0,0,1,0,0,1,0],
      type: "OLL"
    },
    {
      number: 4,
      name: "T-Pattern",
      group: "T / C / Bomb",
      description: "An oriented T-shaped arrangement of yellow stickers on the top face.",
      recognition: "There are three yellow stickers touching in a T, with the center of the top face oriented yellow.",
      alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
      setup: "",
      solution: "R U R' U' R' F R2 U' R' U' R U R' F'",
      probability: "~5.2%",
      pattern: [0,1,0,1,1,1,0,1,0],
      type: "OLL"
    },
    {
      number: 5,
      name: "P-Pattern",
      group: "P / Pi",
      description: "A paired corner and edge pattern that looks like a P shape.",
      recognition: "Two adjacent yellow stickers on the top face create a P-like shape with the center side sticker unmatched.",
      alg: "R2 D' R U2 R' D R U2 R",
      setup: "",
      solution: "R2 D' R U2 R' D R U2 R",
      probability: "~2.9%",
      pattern: [1,0,0,1,1,1,0,0,0],
      type: "OLL"
    },
    {
      number: 6,
      name: "C-Pattern",
      group: "T / C / Bomb",
      description: "A nearly solved top layer with a yellow C shape.",
      recognition: "A loop of three yellow stickers remains open on one side, resembling a C.",
      alg: "R U2 R' U' R U' R'",
      setup: "",
      solution: "R U2 R' U' R U' R'",
      probability: "~2.2%",
      pattern: [0,0,1,0,1,1,1,0,0],
      type: "OLL"
    },
    {
      number: 7,
      name: "L-Pattern",
      group: "L / U / Fish",
      description: "A small L on the top face that is commonly solved with a quick trigger.",
      recognition: "Two yellow stickers form an L in one corner and the remaining face is largely grey.",
      alg: "R U2 R' U' R U' R'",
      setup: "",
      solution: "R U2 R' U' R U' R'",
      probability: "~2.5%",
      pattern: [1,0,0,1,1,0,0,0,0],
      type: "OLL"
    },
    {
      number: 8,
      name: "H-Pattern",
      group: "H / Lights",
      description: "A straight bar of yellow stickers across the face, sometimes called H.",
      recognition: "Two yellow stickers on the left and right edges line up with the center, making a cross-like H.",
      alg: "R U R' U R U2 R' U2 R U' R'",
      setup: "",
      solution: "R U R' U R U2 R' U2 R U' R'",
      probability: "~3.1%",
      pattern: [0,1,0,0,1,0,0,1,0],
      type: "OLL"
    },
    {
      number: 9,
      name: "Fish",
      group: "L / U / Fish",
      description: "An asymmetrical pattern with a fish-like shape built from yellow stickers.",
      recognition: "The three-yellow arrangement resembles a fish shape, usually with one side extended.",
      alg: "R U R' U' R' F R F'",
      setup: "",
      solution: "R U R' U' R' F R F'",
      probability: "~2.0%",
      pattern: [0,1,1,1,1,0,0,0,0],
      type: "OLL"
    },
    {
      number: 10,
      name: "U-Pattern",
      group: "L / U / Fish",
      description: "The top face has a U-like arrangement that is solved by a simple trigger.",
      recognition: "A large U-shape remains on the face, with yellow stickers at the top and sides.",
      alg: "R U2 R2 U' R2 U' R2 U2 R",
      setup: "",
      solution: "R U2 R2 U' R2 U' R2 U2 R",
      probability: "~2.8%",
      pattern: [1,1,1,0,1,0,0,1,0],
      type: "OLL"
    },
    {
      number: 11,
      name: "Flash",
      group: "Pi / Bar",
      description: "A bar-and-corner pattern that is often solved with a right-hand trigger.",
      recognition: "The face shows a bar and a corner with a visible broken line.",
      alg: "R U2 R' U' R U' R'",
      setup: "",
      solution: "R U2 R' U' R U' R'",
      probability: "~1.5%",
      pattern: [0,1,0,0,1,1,1,0,0],
      type: "OLL"
    }
  ],

  PLL: [
    {
      number: "Aa",
      name: "Aa Perm",
      group: "Adjacent Cycles",
      description: "Three adjacent corners cycle around the cube, leaving the top face aesthetically similar.",
      recognition: "Look for a headlight pattern plus a shifted corner pair; the affected corners are adjacent.",
      alg: "x R' U R' D2 R U' R' D2 R2 x'",
      setup: "",
      solution: "x R' U R' D2 R U' R' D2 R2 x'",
      probability: "~7.1%",
      pattern: [0,1,0,1,1,1,0,1,0],
      type: "PLL"
    },
    {
      number: "Ab",
      name: "Ab Perm",
      group: "Adjacent Cycles",
      description: "The opposite adjacent corner cycle is solved by a mirrored version of Aa.",
      recognition: "The top face looks like a bar with a shifted corner and the affected corners are adjacent.",
      alg: "x' R U' R D2 R' U R D2 R2 x",
      setup: "",
      solution: "x' R U' R D2 R' U R D2 R2 x",
      probability: "~6.4%",
      pattern: [0,1,0,1,1,1,0,1,0],
      type: "PLL"
    },
    {
      number: "E",
      name: "E Perm",
      group: "Edges",
      description: "The four top-layer edges are permuted with a central 3-cycle pattern.",
      recognition: "This is a pure edge permutation; the corners are already solved, and the top face has a bar-like pattern.",
      alg: "x' R U' R D2 R' U R D2 R2 x",
      setup: "",
      solution: "x' R U' R D2 R' U R D2 R2 x",
      probability: "~5.6%",
      pattern: [0,1,0,1,1,1,0,1,0],
      type: "PLL"
    },
    {
      number: "T",
      name: "T Perm",
      group: "Swap 2 corners + 2 edges",
      description: "Two corners and two edges swap, leaving the rest of the face intact.",
      recognition: "A central line or corner shape is preserved, but a diagonal pair is swapped.",
      alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
      setup: "",
      solution: "R U R' U' R' F R2 U' R' U' R U R' F'",
      probability: "~8.3%",
      pattern: [1,0,1,0,1,0,1,0,1],
      type: "PLL"
    },
    {
      number: "Ua",
      name: "Ua Perm",
      group: "U / Corner Cycles",
      description: "A U-turn style perm of the top-layer pieces with a 3-cycle effect.",
      recognition: "The top face has a visible U-shape, usually with one corner and edge pair moved correctly.",
      alg: "R2 U R U R' U' R' U' R' U R'",
      setup: "",
      solution: "R2 U R U R' U' R' U' R' U R'",
      probability: "~9.0%",
      pattern: [0,1,0,1,1,1,0,1,0],
      type: "PLL"
    },
    {
      number: "Ub",
      name: "Ub Perm",
      group: "U / Corner Cycles",
      description: "The opposite U-permutation of the top face.",
      recognition: "The same general pattern as Ua, but mirrored around the front-right axis.",
      alg: "R2 U' R' U' R U R U R U' R",
      setup: "",
      solution: "R2 U' R' U' R U R U R U' R",
      probability: "~8.6%",
      pattern: [0,1,0,1,1,1,0,1,0],
      type: "PLL"
    },
    {
      number: "H",
      name: "H Perm",
      group: "Edges",
      description: "Two pairs of opposite edges swap as a set.",
      recognition: "The top face shows a headlight-like pattern, but the edge swap is only present as a pair.",
      alg: "M2 U M2 U2 M2 U M2",
      setup: "",
      solution: "M2 U M2 U2 M2 U M2",
      probability: "~2.3%",
      pattern: [0,1,0,1,1,1,0,1,0],
      type: "PLL"
    }
  ],

  F2L: [
    {
      number: 1,
      name: "Solved Pair",
      group: "Basic Insertions",
      description: "A corner and matching edge are already paired and can be slotted without rotation.",
      recognition: "The pair sits in the correct slot and only needs a final alignment nudge.",
      alg: "R U' R'",
      setup: "",
      solution: "R U' R'",
      probability: "n/a",
      pattern: [0,0,0,0,1,0,0,0,0],
      type: "F2L"
    },
    {
      number: 2,
      name: "Right Pair Insert",
      group: "Basic Insertions",
      description: "The corner-edge pair lies on the right side of the cube and is inserted with a standard trigger.",
      recognition: "The corner sits in the right slot or just above it; the edge is already matched to the same face.",
      alg: "U R U' R'",
      setup: "",
      solution: "U R U' R'",
      probability: "n/a",
      pattern: [0,1,0,0,1,0,0,0,0],
      type: "F2L"
    },
    {
      number: 3,
      name: "Left Pair Insert",
      group: "Basic Insertions",
      description: "The pair is on the left side and uses the mirrored insertion pattern.",
      recognition: "The edge and corner are paired on the left side and can be inserted with a left-hand trigger.",
      alg: "U' L' U L",
      setup: "",
      solution: "U' L' U L",
      probability: "n/a",
      pattern: [0,1,0,0,1,0,0,0,0],
      type: "F2L"
    },
    {
      number: 4,
      name: "Pair Above Slot",
      group: "Above Slot",
      description: "The pair is directly above its target slot and is inserted by a short setup move.",
      recognition: "The corner sits above the correct position and the edge is attached to it.",
      alg: "U R U' R' U' F' U F",
      setup: "",
      solution: "U R U' R' U' F' U F",
      probability: "n/a",
      pattern: [0,0,0,0,1,0,0,1,0],
      type: "F2L"
    }
  ]
};

const trainerCaseIndex = {
  OLL: 0,
  PLL: 0,
  F2L: 0
};

function getTrainerCategoryCases() {
  const category = $("trainer-category").value;
  return TRAINER_CASES[category] || [];
}

function getCurrentFilteredCases() {
  const category = $("trainer-category").value;
  const search = ($("trainer-search")?.value || "").trim().toLowerCase();
  const group = $("trainer-group")?.value || "all";

  return (TRAINER_CASES[category] || []).filter(item => {
    const matchesGroup = group === "all" || item.group === group;
    const haystack = [
      item.name,
      item.number,
      item.group,
      item.alg,
      item.description,
      item.recognition
    ].join(" ").toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    return matchesGroup && matchesSearch;
  });
}

function populateTrainerGroups() {
  const category = $("trainer-category").value;
  const select = $("trainer-group");
  const groups = new Set((TRAINER_CASES[category] || []).map(item => item.group));

  const current = select.value || "all";
  select.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All groups";
  select.appendChild(allOption);

  [...groups].sort().forEach(group => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    if (group === current) option.selected = true;
    select.appendChild(option);
  });

  if (!current || ![...groups].includes(current)) {
    select.value = "all";
  }
}

function updateTrainerCaseSelector() {
  const filtered = getCurrentFilteredCases();
  const select = $("trainer-case");
  const currentIndex = trainerCaseIndex[$("trainer-category").value] || 0;

  select.replaceChildren();

  filtered.forEach((item, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${item.number ? item.number + " - " : ""}${item.name}`;
    select.appendChild(option);
  });

  const safeIndex = filtered.length ? Math.min(currentIndex, filtered.length - 1) : 0;
  trainerCaseIndex[$("trainer-category").value] = safeIndex;

  if (filtered.length === 0) {
    $("case-title").textContent = "No matching cases";
    $("case-description").textContent = "Try a different filter or search.";
    $("case-recognition").textContent = "";
    $("case-number").textContent = "Case #";
    $("case-group").textContent = "Group";
    $("case-probability").textContent = "Probability";
    $("case-algorithm").textContent = "No result";
    $("case-image").innerHTML = "";
    return;
  }

  select.value = String(safeIndex);
  showTrainerCase(filtered[safeIndex]);
}

function buildColor(value) {
  if (value === 1) return "#f3d343";
  if (value === 2) return "#67d3ff";
  if (value === 3) return "#9cf5c0";
  return "#3c4657";
}

function makeTopFacePatternGrid(pattern, options = {}) {
  const cellSize = 32;
  const gap = 4;
  const cols = 3;
  const rows = 3;
  const offsetX = 10;
  const offsetY = 10;

  let cells = "";

  pattern.forEach((value, idx) => {
    const x = offsetX + (idx % cols) * (cellSize + gap);
    const y = offsetY + Math.floor(idx / rows) * (cellSize + gap);
    const fill = buildColor(value);

    cells += `
      <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="5"
        fill="${fill}" stroke="#1f2936" stroke-width="2" />
    `;
  });

  const sideColor = options.sideColor || "#79e4c6";
  const sideStrip = options.sideStrip || {}

  return `
    <svg viewBox="0 0 240 240" role="img" aria-label="Top face case diagram">
      <rect x="0" y="0" width="240" height="240" rx="12" fill="#111722" stroke="#303a4b" stroke-width="2"/>
      <rect x="35" y="35" width="128" height="128" rx="8" fill="#252d3b"/>
      ${cells}
      <rect x="170" y="35" width="26" height="128" rx="7" fill="${sideColor}" opacity="0.95"/>
      <rect x="35" y="170" width="128" height="26" rx="7" fill="${sideColor}" opacity="0.95"/>
      <rect x="35" y="8" width="128" height="18" rx="6" fill="#3d4c5c"/>
      <rect x="8" y="35" width="18" height="128" rx="6" fill="#3d4c5c"/>
      <rect x="170" y="170" width="26" height="26" rx="6" fill="#3d4c5c"/>
    </svg>
  `;
}

function makeOLLDiagram(caseData) {
  const pattern = caseData.pattern || [0,0,0,0,0,0,0,0,0];
  const accent = caseData.group.includes("Sune") ? "#f3d343" : "#79e4c6";
  return makeTopFacePatternGrid(pattern, { sideColor: accent });
}

function makePLLDiagram(caseData) {
  const pattern = caseData.pattern || [0,0,0,0,0,0,0,0,0];
  const svg = `
    <svg viewBox="0 0 300 220" role="img" aria-label="PLL case pattern">
      <rect x="0" y="0" width="300" height="220" rx="12" fill="#111722" stroke="#303a4b" stroke-width="2"/>
      <rect x="38" y="45" width="150" height="150" rx="8" fill="#252d3b"/>
      ${[0,1,2,3,4,5,6,7,8].map(index => {
        const x = 38 + (index % 3) * 48;
        const y = 45 + Math.floor(index / 3) * 48;
        const fill = buildColor(pattern[index]);
        return `<rect x="${x}" y="${y}" width="40" height="40" rx="5" fill="${fill}" stroke="#1d2631" stroke-width="2" />`;
      }).join("")}
      <rect x="198" y="45" width="25" height="150" rx="6" fill="#3c63d6"/>
      <rect x="228" y="45" width="25" height="150" rx="6" fill="#f1c458"/>
      <rect x="258" y="45" width="25" height="150" rx="6" fill="#7ee7c1"/>
      <path d="M 38 200 L 78 156 L 118 200 Z" fill="none" stroke="#edb95d" stroke-width="3" stroke-linejoin="round"/>
      <path d="M 118 200 L 178 150" fill="none" stroke="#edb95d" stroke-width="3" stroke-linecap="round"/>
      <path d="M 118 200 L 158 168" fill="none" stroke="#edb95d" stroke-width="3" stroke-linecap="round"/>
      <circle cx="78" cy="156" r="6" fill="#edb95d"/>
      <circle cx="118" cy="200" r="6" fill="#edb95d"/>
      <circle cx="178" cy="150" r="6" fill="#edb95d"/>
    </svg>
  `;

  return svg;
}

function makeF2LDiagram(caseData) {
  const accent = "#79e4c6";
  const accent2 = "#f3d343";

  return `
    <svg viewBox="0 0 280 220" role="img" aria-label="F2L case diagram">
      <rect x="0" y="0" width="280" height="220" rx="12" fill="#111722" stroke="#303a4b" stroke-width="2"/>
      <polygon points="60,120 140,80 140,160 60,200" fill="#1f2935" stroke="#40536a" stroke-width="2"/>
      <polygon points="140,80 220,120 220,200 140,160" fill="#233548" stroke="#40536a" stroke-width="2"/>
      <polygon points="60,120 140,80 220,120 140,160" fill="#2c3b4d" stroke="#40536a" stroke-width="2"/>
      <polygon points="140,80 140,160 220,200 220,120" fill="#3a4b5f" stroke="#40536a" stroke-width="2"/>
      <rect x="86" y="102" width="32" height="32" rx="4" fill="${accent2}" stroke="#d9ad33" stroke-width="2"/>
      <rect x="156" y="120" width="32" height="32" rx="4" fill="${accent}" stroke="#68d9b9" stroke-width="2"/>
      <path d="M 120 160 L 166 138" stroke="#edf2fa" stroke-width="3" stroke-linecap="round"/>
      <circle cx="118" cy="147" r="7" fill="#edf2fa"/>
      <circle cx="167" cy="138" r="7" fill="#edf2fa"/>
      <text x="110" y="45" fill="#c8d5e8" font-size="14" font-family="system-ui">Corner + edge</text>
      <text x="70" y="198" fill="#c8d5e8" font-size="12" font-family="system-ui">Target slot</text>
    </svg>
  `;
}

function renderCaseDiagram(caseData) {
  if (!caseData) {
    $("case-image").innerHTML = "";
    return;
  }

  const type = caseData.type || "OLL";

  if (type === "OLL") {
    $("case-image").innerHTML = makeOLLDiagram(caseData);
    return;
  }

  if (type === "PLL") {
    $("case-image").innerHTML = makePLLDiagram(caseData);
    return;
  }

  $("case-image").innerHTML = makeF2LDiagram(caseData);
}

function showTrainerCase(caseData) {
  if (!caseData) {
    return;
  }

  currentTrainerCase = caseData;
  algorithmVisible = false;

  $("case-title").textContent = `${caseData.name}`;
  $("case-number").textContent = `Case #${caseData.number}`;
  $("case-group").textContent = caseData.group;
  $("case-probability").textContent = caseData.probability || "Reference";
  $("case-description").textContent = caseData.description;
  $("case-recognition").textContent = caseData.recognition || "Use the visible sticker pattern to identify the case.";
  $("case-algorithm").textContent = "Algorithm hidden";
  $("show-algorithm").textContent = "Show algorithm";
  $("trainer-note").textContent = "Try to recognize the case before revealing the algorithm.";

  renderCaseDiagram(caseData);
}

function updateTrainerSelectionFromFilter() {
  const category = $("trainer-category").value;
  const filtered = getCurrentFilteredCases();

  if (!filtered.length) {
    $("trainer-case").replaceChildren();
    $("case-title").textContent = "No matching cases";
    $("case-description").textContent = "Try a different search or category filter.";
    $("case-algorithm").textContent = "No result";
    $("case-recognition").textContent = "";
    return;
  }

  trainerCaseIndex[category] = Math.min(trainerCaseIndex[category] || 0, filtered.length - 1);
  const selected = filtered[trainerCaseIndex[category]];

  $("trainer-case").value = String(filtered.indexOf(selected));
  showTrainerCase(selected);
}

function seedTrainerCaseUI() {
  populateTrainerGroups();
  updateTrainerCaseSelector();
}

$("trainer-category").addEventListener("change", () => {
  populateTrainerGroups();
  updateTrainerCaseSelector();
});

$("trainer-group").addEventListener("change", () => {
  updateTrainerCaseSelector();
});

$("trainer-search").addEventListener("input", () => {
  updateTrainerCaseSelector();
});

$("trainer-case").addEventListener("change", () => {
  const filtered = getCurrentFilteredCases();
  const index = Number($("trainer-case").value);
  const category = $("trainer-category").value;

  if (filtered[index]) {
    trainerCaseIndex[category] = index;
    showTrainerCase(filtered[index]);
  }
});

$("prev-case").addEventListener("click", () => {
  const category = $("trainer-category").value;
  const filtered = getCurrentFilteredCases();
  if (!filtered.length) return;

  trainerCaseIndex[category] = (trainerCaseIndex[category] - 1 + filtered.length) % filtered.length;
  const selected = filtered[trainerCaseIndex[category]];
  $("trainer-case").value = String(filtered.indexOf(selected));
  showTrainerCase(selected);
});

$("next-case").addEventListener("click", () => {
  const category = $("trainer-category").value;
  const filtered = getCurrentFilteredCases();
  if (!filtered.length) return;

  trainerCaseIndex[category] = (trainerCaseIndex[category] + 1) % filtered.length;
  const selected = filtered[trainerCaseIndex[category]];
  $("trainer-case").value = String(filtered.indexOf(selected));
  showTrainerCase(selected);
});

$("random-case").addEventListener("click", () => {
  const category = $("trainer-category").value;
  const filtered = getCurrentFilteredCases();
  if (!filtered.length) return;

  const nextIndex = Math.floor(Math.random() * filtered.length);
  trainerCaseIndex[category] = nextIndex;
  $("trainer-case").value = String(nextIndex);
  showTrainerCase(filtered[nextIndex]);
});

$("show-algorithm").addEventListener("click", () => {
  if (!currentTrainerCase) return;

  algorithmVisible = !algorithmVisible;
  $("case-algorithm").textContent = algorithmVisible
    ? currentTrainerCase.alg || "No algorithm provided for this case."
    : "Algorithm hidden";
  $("show-algorithm").textContent = algorithmVisible
    ? "Hide algorithm"
    : "Show algorithm";
});

$("practice-case").addEventListener("click", () => {
  if (!currentTrainerCase) return;

  $("sim-algorithm").value = currentTrainerCase.alg || "";

  document.querySelectorAll(".tab").forEach(tab =>
    tab.classList.remove("active")
  );

  document.querySelectorAll(".page").forEach(page =>
    page.classList.remove("active")
  );

  document.querySelector('[data-page="sim-page"]').classList.add("active");
  $("sim-page").classList.add("active");

  setTimeout(() => {
    createCube();
    resizeCubeRenderer();
    runAlgorithm(currentTrainerCase.alg || "");
  }, 80);
});

/* =========================================================
   INITIALIZATION
========================================================= */

let currentTrainerCase = null;
let algorithmVisible = false;

$("scramble").textContent = scramble;

initializeSettings();
seedTrainerCaseUI();
render();

window.addEventListener("resize", () => {
  render();
  resizeCubeRenderer();
});
