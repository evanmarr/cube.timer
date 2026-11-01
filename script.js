"use strict";

/* =========================================================
   CUBE.TIMER
   Timer, statistics, history, simulator and settings
========================================================= */

const $ = id => document.getElementById(id);
const STORAGE_KEY = "cubeTimerSolves";
const SETTINGS_KEY = "cubeTimerSettings";

const DEFAULT_SETTINGS = {
  cubeSize: 3,
  animationSpeed: 260,
  inspection: true,
  confetti: true,
  precision: 2,
  theme: "dark",
  layout: "standard",
  dailyGoal: 20
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
   TIMER AND INSPECTION
   First press starts inspection. A quick tap leaves inspection running.
   Press and hold during inspection to prepare; release starts the solve.
========================================================= */
let inspecting = false;
let inspectionStart = 0;
let timerInputHeld = false;
let timerTouchHeld = false;
let holdStartedAt = 0;
let holdPrepared = false;
let finishedDisplay = false;

function updateTimer() {
  if (inspecting) {
    const elapsed = (performance.now() - inspectionStart) / 1000;
    const remaining = Math.max(0, 15 - elapsed);
    $("timer").textContent = String(Math.ceil(remaining));
    $("timer-label").textContent = remaining <= 3 ? "INSPECTION ENDING" : "INSPECTION";
    if (remaining <= 0) {
      inspecting = false;
      holdPrepared = false;
      $("timer").textContent = "0";
      $("timer").className = "";
      $("timer-label").textContent = "Inspection finished. Press and hold to prepare.";
      return;
    }
  } else if (running) {
    $("timer").textContent = formatTime(performance.now() - startTime);
  } else return;
  animationFrame = requestAnimationFrame(updateTimer);
}

function beginInspection() {
  if (running || inspecting) return;
  finishedDisplay = false;
  ready = false;
  inspecting = true;
  inspectionStart = performance.now();
  $("timer").className = "ready";
  $("timer-label").textContent = "INSPECTION · 15";
  cancelAnimationFrame(animationFrame);
  updateTimer();
}

function startTimer() {
  if (running) return;
  inspecting = false;
  ready = false;
  finishedDisplay = false;
  cancelAnimationFrame(animationFrame);
  running = true;
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
  finishedDisplay = true;
  $("timer").textContent = formatTime(elapsed);
  $("timer").className = "";
  $("timer-label").textContent = "Solve saved";
  addSolve(elapsed, scramble);
  // Keep the completed time visible. Only the scramble changes.
  setTimeout(() => { if (!running && finishedDisplay) newScramble(); }, 800);
}

function timerKeyDown() {
  if (running) { stopTimer(); return; }
  if (!inspecting) {
    if (!settings.inspection) { startTimer(); return; }
    beginInspection();
    holdStartedAt = performance.now();
    holdPrepared = false;
    clearTimeout(holdTimeout);
    holdTimeout = setTimeout(() => {
      if (timerInputHeld && inspecting) {
        holdPrepared = true;
        ready = true;
        $("timer-label").textContent = "READY · release to start";
      }
    }, 250);
    return;
  }
  holdStartedAt = performance.now();
  holdPrepared = true;
  ready = true;
  $("timer-label").textContent = "READY · release to start";
}

function timerKeyUp() {
  clearTimeout(holdTimeout);
  if (running) return;
  if (!inspecting || !holdPrepared) return;
  holdPrepared = false;
  startTimer();
}

document.addEventListener("keydown", event => {
  if (event.code !== "Space" || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
  event.preventDefault();
  if (event.repeat || timerInputHeld) return;
  timerInputHeld = true;
  timerKeyDown();
});
document.addEventListener("keyup", event => {
  if (event.code !== "Space" || !timerInputHeld) return;
  timerInputHeld = false;
  timerKeyUp();
});
window.addEventListener("blur", () => { timerInputHeld = false; timerTouchHeld = false; clearTimeout(holdTimeout); });

const timerElement = $("timer");
timerElement.addEventListener("pointerdown", event => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  if (timerTouchHeld) return;
  timerTouchHeld = true;
  timerElement.setPointerCapture(event.pointerId);
  if (running) stopTimer();
  else if (!inspecting) {
    if (!settings.inspection) { startTimer(); return; }
    beginInspection(); holdPrepared = false;
    clearTimeout(holdTimeout);
    holdTimeout = setTimeout(() => {
      if (timerTouchHeld && inspecting) { holdPrepared = true; ready = true; $("timer-label").textContent = "READY · release to start"; }
    }, 250);
  } else { holdPrepared = true; ready = true; $("timer-label").textContent = "READY · release to start"; }
});
timerElement.addEventListener("pointerup", () => {
  if (!timerTouchHeld) return;
  timerTouchHeld = false;
  clearTimeout(holdTimeout);
  if (inspecting && holdPrepared) { holdPrepared = false; startTimer(); }
});
timerElement.addEventListener("pointercancel", () => { timerTouchHeld = false; });

/* Custom in-page dialogs */
function showDialog(title, message, options={}) {
  return new Promise(resolve => {
    const root=$("app-dialog"), input=$("dialog-input"), cancel=$("dialog-cancel"), ok=$("dialog-ok");
    $("dialog-title").textContent=title; $("dialog-message").textContent=message;
    input.hidden=!options.input; input.value=options.value||"";
    cancel.hidden=options.confirm===false && !options.input;
    ok.textContent=options.input?"Save":options.confirm===false?"Close":"OK";
    root.hidden=false;
    const finish=value=>{root.hidden=true;ok.onclick=null;cancel.onclick=null;resolve(value);};
    ok.onclick=()=>finish(options.input?input.value:true);
    cancel.onclick=()=>finish(options.input?null:false);
    root.onclick=e=>{if(e.target===root)finish(options.input?null:false);};
    if(options.input){input.focus();input.select();}else ok.focus();
  });
}

/* =========================================================
   SOLVE MANAGEMENT
========================================================= */


function celebratePB() {
  if (!settings.confetti) return;
  const canvas = $("confetti");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pieces = Array.from({length: 150}, () => ({
    x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .4,
    vx: (Math.random() - .5) * 5, vy: 2 + Math.random() * 5,
    size: 4 + Math.random() * 6, angle: Math.random() * 6,
    spin: (Math.random() - .5) * .2,
    color: ["#70e1c1", "#e6bd69", "#7da8ff", "#ff8c9b", "#ffffff"][Math.floor(Math.random()*5)]
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.angle += p.spin; p.vy += .035;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size*1.5);
      ctx.restore();
    });
    frame++;
    if (frame < 150 && pieces.some(p => p.y < innerHeight + 20)) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
  requestAnimationFrame(draw);
}

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

async function editSolve(id) {
  const solve = solves.find(s => s.id === id);
  if (!solve) return;

  const input = await showDialog("Edit solve", "Enter the new solve time in seconds.", {input:true, value:formatTime(solve.time)});

  if (input === null) return;

  const time = parseTime(input);

  if (time === null) {
    return showDialog("Invalid time", "Enter a valid time greater than zero.", {confirm:false});
  }

  solve.time = time;

  previousBest = solves.length
    ? Math.min(...solves.map(s => s.time))
    : Infinity;

  saveSolves();
  render();
}

async function deleteSolve(id) {
  if (!await showDialog("Delete solve?", "This solve will be removed from your history.")) return;

  solves = solves.filter(s => s.id !== id);

  previousBest = solves.length
    ? Math.min(...solves.map(s => s.time))
    : Infinity;

  saveSolves();
  render();
}

async function manualAdd() {
  const input = await showDialog("Add solve", "Enter the solve time in seconds.", {input:true});
  if (input === null) return;

  const time = parseTime(input);

  if (time === null) {
    return showDialog("Invalid time", "Enter a valid time greater than zero.", {confirm:false});
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

function applyTheme() {
  document.documentElement.dataset.theme = settings.theme === "light" ? "light" : "dark";
}

function applyLayout() {
  const card = document.querySelector(".timer-card");
  if (!card) return;
  card.classList.remove("minimal", "statistics-focused");
  if (settings.layout === "minimal") card.classList.add("minimal");
  if (settings.layout === "statistics") card.classList.add("statistics-focused");
}

function getTodaySolves() {
  const today = new Date().toLocaleDateString();
  return solves.filter(s => new Date(s.date).toLocaleDateString() === today).length;
}

function renderPracticeGoal() {
  const goal = Math.max(0, Math.min(1000, Number(settings.dailyGoal) || 0));
  const count = getTodaySolves();
  $("goal-progress-text").textContent = goal === 0 ? `${count} solves today` : `${count} / ${goal} solves`;
  $("goal-progress").max = Math.max(goal, 1);
  $("goal-progress").value = goal === 0 ? 0 : Math.min(count, goal);
  $("goal-remaining").textContent = goal === 0 ? "Daily goal disabled" :
    count >= goal ? "Daily goal completed!" : `${goal - count} solves remaining today`;
}


function renderAchievements() {
  const container = $("achievements");
  if (!container) return;
  container.replaceChildren();
  const best = solves.length ? Math.min(...solves.map(s => s.time)) / 1000 : Infinity;
  const milestones = [
    ["Sub-60", 60], ["Sub-40", 40], ["Sub-30", 30],
    ["Sub-25", 25], ["Sub-20", 20], ["Sub-15", 15],
    ["Sub-10", 10], ["Sub-5", 5]
  ];
  milestones.forEach(([name, threshold]) => {
    const unlocked = best < threshold;
    const item = document.createElement("div");
    item.className = "stat";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = name;
    const value = document.createElement("div");
    value.className = "value";
    value.textContent = unlocked ? "Unlocked" : "Locked";
    value.style.color = unlocked ? "var(--accent)" : "var(--muted)";
    item.append(label, value);
    container.appendChild(item);
  });
}

function render() {
  renderPracticeGoal();
  renderAchievements();
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

$("clear-solves").addEventListener("click", async () => {
  if (!await showDialog("Clear all solves?", "This permanently removes every solve in your history.")) return;

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

    if (!await showDialog("Import backup?", `Add ${valid.length} solves to your current history?`)) {
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

    await showDialog("Import complete", "Your solves were imported successfully.", {confirm:false});
  } catch {
    await showDialog("Import failed", "That file could not be imported.", {confirm:false});
  }

  event.target.value = "";
});

/* =========================================================
   SETTINGS
========================================================= */

function initializeSettings() {
  $("setting-cube-size").value = String(settings.cubeSize);
  $("setting-animation-speed").value = settings.animationSpeed;
  $("setting-inspection").checked = settings.inspection;
  $("setting-confetti").checked = settings.confetti;
  $("setting-precision").value = settings.precision;
  $("setting-theme").value = settings.theme || "dark";
  $("setting-layout").value = settings.layout || "standard";
  $("setting-daily-goal").value = settings.dailyGoal ?? 20;
  applyTheme();
  applyLayout();

  $("setting-theme").addEventListener("change", event => {
    settings.theme = event.target.value;
    saveSettings();
    applyTheme();
  });

  $("setting-layout").addEventListener("change", event => {
    settings.layout = event.target.value;
    saveSettings();
    applyLayout();
  });

  $("setting-daily-goal").addEventListener("change", event => {
    settings.dailyGoal = Math.max(0, Math.min(1000, Number(event.target.value) || 0));
    event.target.value = settings.dailyGoal;
    saveSettings();
    renderPracticeGoal();
  });

  $("setting-cube-size").addEventListener("change", event => {
    settings.cubeSize = ["pyraminx","megaminx"].includes(event.target.value) ? event.target.value : Number(event.target.value);
    saveSettings();

    cubeInitialized = false;
    if ($("sim-page").classList.contains("active")) createCube();
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
   3D SIMULATOR
   NxN cubes use real layer turns. Pyraminx and Megaminx use
   dedicated 3D solid models with whole-puzzle turn animation.
========================================================= */
let scene, camera, renderer, cubeGroup, cubeInitialized = false;
let drag = false, lastPointer = {x:0,y:0};
let cubeMoves = [], moveQueue = [], animating = false, paused = false;
let cubelets = [], activeCubeType = null;
const COLORS = {R:0xc62828,L:0xff8c00,U:0xffffff,D:0xffd500,F:0x159447,B:0x2455c5};

function selectedCubeType() { return settings.cubeSize || 3; }
function createCube() {
  const stage = $("cube-stage");
  if (!stage || !window.THREE) { if(stage) stage.textContent="3D library unavailable. Check your internet connection and reload."; return; }
  if (cubeInitialized && activeCubeType === selectedCubeType()) { resizeCubeRenderer(); return; }
  if (renderer) { renderer.dispose(); renderer.domElement.remove(); }
  scene = new THREE.Scene();
  const w = Math.max(stage.clientWidth, 1), h = Math.max(stage.clientHeight, 1);
  camera = new THREE.PerspectiveCamera(38, w/h, .1, 100);
  camera.position.set(5,5,7); camera.lookAt(0,0,0);
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w,h);
  stage.replaceChildren(renderer.domElement);
  scene.add(new THREE.AmbientLight(0xffffff, .85));
  const light = new THREE.DirectionalLight(0xffffff, .9); light.position.set(5,8,7); scene.add(light);
  cubeGroup = new THREE.Group(); scene.add(cubeGroup);
  cubelets = []; moveQueue=[]; animating=false; cubeMoves=[]; renderMoveList();
  activeCubeType = selectedCubeType();
  if (activeCubeType === "pyraminx") buildPyraminx();
  else if (activeCubeType === "megaminx") buildMegaminx();
  else buildNxNCube(Number(activeCubeType));
  cubeInitialized = true;
  renderer.setAnimationLoop(() => renderer.render(scene,camera));
  enableCubeDrag(stage);
}
function buildNxNCube(n) {
  const gap = 1.015, offset=(n-1)/2, size=Math.min(.94, 2.7/n);
  for(let x=0;x<n;x++) for(let y=0;y<n;y++) for(let z=0;z<n;z++) {
    const mats=[
      new THREE.MeshStandardMaterial({color:x===n-1?COLORS.R:0x17191d}),
      new THREE.MeshStandardMaterial({color:x===0?COLORS.L:0x17191d}),
      new THREE.MeshStandardMaterial({color:y===n-1?COLORS.U:0x17191d}),
      new THREE.MeshStandardMaterial({color:y===0?COLORS.D:0x17191d}),
      new THREE.MeshStandardMaterial({color:z===n-1?COLORS.F:0x17191d}),
      new THREE.MeshStandardMaterial({color:z===0?COLORS.B:0x17191d})
    ];
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),mats);
    mesh.position.set((x-offset)*gap,(y-offset)*gap,(z-offset)*gap);
    mesh.userData.grid={x,y,z}; cubeGroup.add(mesh); cubelets.push(mesh);
  }
  const scale=3.5/Math.max(3,n); cubeGroup.scale.setScalar(scale);
}
function buildPyraminx() {
  const geo=new THREE.TetrahedronGeometry(2.15,0);
  const mats=[0x22a06b,0xffd23f,0x3278d4,0xe74d4d].map(color=>new THREE.MeshStandardMaterial({color,flatShading:true}));
  const mesh=new THREE.Mesh(geo,mats); cubeGroup.add(mesh); cubelets.push(mesh);
  cubeGroup.rotation.set(.25,.55,0);
}
function buildMegaminx() {
  const geo=new THREE.DodecahedronGeometry(1.9,0);
  const mats=[0xffffff,0xffd23f,0x22a06b,0x3278d4,0xe74d4d,0xff8c00,0x9b59b6,0x20b8b0,0xe88aaf,0x8bc34a,0x6d83a8,0xdddddd].map(color=>new THREE.MeshStandardMaterial({color,flatShading:true}));
  const mesh=new THREE.Mesh(geo,mats); cubeGroup.add(mesh); cubelets.push(mesh);
  cubeGroup.rotation.set(.25,.55,0);
}
function resizeCubeRenderer() {
  if(!cubeInitialized || !renderer) return;
  const stage=$("cube-stage"), w=stage.clientWidth, h=stage.clientHeight;
  if(!w||!h)return;
  camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
}
function enableCubeDrag(stage) {
  stage.onpointerdown=e=>{if(animating)return;drag=true;lastPointer={x:e.clientX,y:e.clientY};stage.setPointerCapture(e.pointerId);};
  stage.onpointermove=e=>{if(!drag||!cubeGroup)return;const dx=e.clientX-lastPointer.x,dy=e.clientY-lastPointer.y;cubeGroup.rotation.y+=dx*.009;cubeGroup.rotation.x+=dy*.009;lastPointer={x:e.clientX,y:e.clientY};};
  stage.onpointerup=stage.onpointercancel=()=>{drag=false;};
}
function parseMove(token) {
  const m=token.match(/^([RLUDFBrludfbMESxyz])([2']?)$/); if(!m)return null;
  const f=m[1], suf=m[2], prime=suf==="'", twice=suf==="2";
  const n=Number(activeCubeType)||3;
  const defs={R:["x",n-1,-1],L:["x",0,1],U:["y",n-1,-1],D:["y",0,1],F:["z",n-1,-1],B:["z",0,1],
    r:["x",n-1,-1,2],l:["x",0,1,2],u:["y",n-1,-1,2],d:["y",0,1,2],f:["z",n-1,-1,2],b:["z",0,1,2],
    M:["x",Math.floor(n/2),1],E:["y",Math.floor(n/2),1],S:["z",Math.floor(n/2),-1],
    x:["x",-1,-1],y:["y",-1,-1],z:["z",-1,-1]};
  if(!defs[f])return null;
  let [axis,layer,dir,width]=defs[f];
  let layers;
  if(layer===-1) layers=Array.from({length:n},(_,i)=>i);
  else if(width) layers=dir<0?[n-width,n-1]:[0,width-1];
  else layers=[layer];
  return {axis,layers,angle:dir*(prime?-1:1)*Math.PI/2*(twice?2:1),poly:typeof activeCubeType==="string"};
}
function animateMove(token) {
  if(!cubeInitialized || animating || paused)return;
  const detail=parseMove(token); if(!detail)return;
  animating=true;
  if(detail.poly) {
    const axis=detail.axis==="x"?"x":detail.axis==="y"?"y":"z";
    const from=cubeGroup.rotation[axis], to=from+detail.angle, start=performance.now(), duration=settings.animationSpeed;
    function spin(now){const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);cubeGroup.rotation[axis]=from+(to-from)*e;if(t<1)requestAnimationFrame(spin);else{animating=false;processMoveQueue();}}
    requestAnimationFrame(spin);return;
  }
  const n=Number(activeCubeType), axis=detail.axis, pivot=new THREE.Group(); cubeGroup.add(pivot);
  const selected=cubelets.filter(c=>detail.layers.includes(c.userData.grid[axis]));
  selected.forEach(c=>{cubeGroup.remove(c);pivot.add(c);});
  const start=performance.now(),duration=settings.animationSpeed;
  function frame(now){const t=Math.min(1,(now-start)/duration),e=1-Math.pow(1-t,3);pivot.rotation[axis]=detail.angle*e;
    if(t<1){requestAnimationFrame(frame);return;}
    pivot.updateMatrixWorld(true);
    [...pivot.children].forEach(c=>{
      c.applyMatrix4(pivot.matrix); cubeGroup.add(c);
      const v=c.position; c.position.set(Math.round(v.x*1000)/1000,Math.round(v.y*1000)/1000,Math.round(v.z*1000)/1000);
      c.rotation.set(Math.round(c.rotation.x/(Math.PI/2))*Math.PI/2,Math.round(c.rotation.y/(Math.PI/2))*Math.PI/2,Math.round(c.rotation.z/(Math.PI/2))*Math.PI/2);
      const grid=c.userData.grid;
      let a=grid.x-(n-1)/2,b=grid.y-(n-1)/2,d=grid.z-(n-1)/2;
      const q=Math.round(detail.angle/(Math.PI/2));
      for(let i=0;i<((q%4)+4)%4;i++){if(axis==="x")[b,d]=[-d,b];if(axis==="y")[a,d]=[d,-a];if(axis==="z")[a,b]=[-b,a];}
      c.userData.grid={x:Math.round(a+(n-1)/2),y:Math.round(b+(n-1)/2),z:Math.round(d+(n-1)/2)};
    });
    cubeGroup.remove(pivot);animating=false;processMoveQueue();
  }
  requestAnimationFrame(frame);
}
function processMoveQueue(){if(paused||animating)return;const next=moveQueue.shift();if(next)animateMove(next);}
function playMove(move,record=true){if(!cubeInitialized)createCube();if(!parseMove(move))return false;if(record){cubeMoves.push(move);renderMoveList();}moveQueue.push(move);processMoveQueue();return true;}
function renderMoveList(){const c=$("sim-moves");if(!c)return;c.replaceChildren();if(!cubeMoves.length){c.textContent="No moves yet.";return;}cubeMoves.forEach(m=>{const chip=document.createElement("span");chip.className="move-chip";chip.textContent=m;c.appendChild(chip);});}
function parseAlgorithm(text){const tokens=text.trim().split(/\s+/).filter(Boolean);const invalid=tokens.filter(t=>!parseMove(t));if(invalid.length){showDialog("Invalid moves", "These moves are not supported for the selected puzzle: "+invalid.join(", "));return null;}return tokens;}
function runAlgorithm(text){const moves=parseAlgorithm(text);if(!moves||!moves.length)return;createCube();moves.forEach(m=>playMove(m));}
function inverseMove(m){return m.endsWith("2")?m:m.endsWith("'")?m.slice(0,-1):m+"'";}
$("sim-turn").addEventListener("click",()=>playMove($("move-select").value));
$("sim-run-algorithm").addEventListener("click",()=>runAlgorithm($("sim-algorithm").value));
$("sim-pause").addEventListener("click",()=>{paused=!paused;$("sim-pause").textContent=paused?"Resume":"Pause";if(!paused)processMoveQueue();});
$("sim-scramble").addEventListener("click",()=>{createCube();const n=Number(activeCubeType)||3;const seq=Array.from({length:Math.max(20,n*8)},()=>"RLUDFB"[Math.floor(Math.random()*6)]+["","'","2"][Math.floor(Math.random()*3)]);seq.forEach(m=>playMove(m));});
$("sim-reset").addEventListener("click",()=>{cubeInitialized=false;createCube();});
$("sim-undo").addEventListener("click",()=>{if(animating||moveQueue.length)return;const last=cubeMoves.pop();if(!last)return;renderMoveList();playMove(inverseMove(last),false);});

/* =========================================================
   INITIALIZATION
========================================================= */

$("scramble").textContent = scramble;

initializeSettings();
render();

window.addEventListener("resize", () => {
  render();
  resizeCubeRenderer();
});