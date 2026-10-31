
"use strict";

// ==========================================
// CUBE TIMER
// ==========================================

const $ = id => document.getElementById(id);

const STORAGE_KEY = "cubeTimerSolves";

let solves = loadSolves();
let scramble = generateScramble();

let running = false;
let startTime = 0;
let animationFrame = null;
let spaceHeld = false;
let holdTimeout = null;
let ready = false;

// ==========================================
// DATA STORAGE
// ==========================================

function loadSolves() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (!Array.isArray(data)) return [];

    return data.filter(s =>
      s &&
      Number.isFinite(s.time) &&
      s.time > 0 &&
      typeof s.date === "string"
    );
  } catch {
    return [];
  }
}

function saveSolves() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
}

function makeId() {
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

// ==========================================
// TIME FORMATTING
// ==========================================

function formatTime(ms) {
  if (!Number.isFinite(ms)) return "--";

  return (ms / 1000).toFixed(2);
}

function parseTime(value) {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }

  return n * 1000;
}

// ==========================================
// SCRAMBLE GENERATOR
// ==========================================

function generateScramble() {
  const faces = ["R", "L", "U", "D", "F", "B"];
  const suffixes = ["", "'", "2"];

  const opposite = {
    R: "L",
    L: "R",
    U: "D",
    D: "U",
    F: "B",
    B: "F"
  };

  const moves = [];
  let previous = "";
  let previousAxis = "";

  while (moves.length < 20) {
    const face = faces[Math.floor(Math.random() * faces.length)];

    // Prevent consecutive turns of the same face.
    if (face === previous) continue;

    // Avoid some redundant opposite-face sequences.
    const axis =
      ["R", "L"].includes(face) ? "x" :
      ["U", "D"].includes(face) ? "y" : "z";

    if (axis === previousAxis &&
        opposite[face] === previous) {
      continue;
    }

    const suffix =
      suffixes[Math.floor(Math.random() * suffixes.length)];

    moves.push(face + suffix);

    previous = face;
    previousAxis = axis;
  }

  return moves.join(" ");
}

function newScramble() {
  scramble = generateScramble();
  $("scramble").textContent = scramble;
}

// ==========================================
// TIMER
// ==========================================

function updateTimer() {
  if (!running) return;

  const elapsed = performance.now() - startTime;

  $("timer").textContent = formatTime(elapsed);

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
    $("timer-label").textContent =
      "Press and hold SPACE, then release to start";

    newScramble();
  }, 800);
}

function prepareTimer() {
  if (running || ready) return;

  ready = true;

  $("timer").textContent = "0.00";
  $("timer").className = "ready";
  $("timer-label").textContent = "READY";
}

// Spacebar controls.
document.addEventListener("keydown", event => {
  if (event.code !== "Space") return;

  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
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
  if (event.code !== "Space") return;

  if (!spaceHeld) return;

  spaceHeld = false;

  clearTimeout(holdTimeout);

  if (ready && !running) {
    startTimer();
  }
});

// ==========================================
// SOLVE MANAGEMENT
// ==========================================

function addSolve(time, scrambleText = "") {
  solves.unshift({
    id: makeId(),
    time,
    date: new Date().toISOString(),
    scramble: scrambleText
  });

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

  const newTime = parseTime(input);

  if (newTime === null) {
    alert("Please enter a valid time greater than zero.");
    return;
  }

  solve.time = newTime;

  saveSolves();
  render();
}

function deleteSolve(id) {
  if (!confirm("Delete this solve?")) return;

  solves = solves.filter(s => s.id !== id);

  saveSolves();
  render();
}

function manualAdd() {
  const input = prompt("Enter solve time in seconds:");

  if (input === null) return;

  const time = parseTime(input);

  if (time === null) {
    alert("Please enter a valid time greater than zero.");
    return;
  }

  addSolve(time, "Manual entry");
}

// ==========================================
// AVERAGES
// ==========================================

// WCA-style trimmed average:
// Remove fastest and slowest, average the rest.
// This function is also used for Ao50 and Ao100
// as personal training metrics.

function trimmedAverage(group) {
  if (group.length < 3) return null;

  const values = group
    .map(s => s.time)
    .sort((a, b) => a - b);

  values.shift();
  values.pop();

  return values.reduce((a, b) => a + b, 0) /
    values.length;
}

function getAverage(n) {
  if (solves.length < n) return null;

  return trimmedAverage(solves.slice(0, n));
}

function rollingValues(n) {
  const chronological = [...solves].reverse();
  const result = [];

  for (let i = n - 1; i < chronological.length; i++) {
    const group = chronological.slice(i - n + 1, i + 1);

    result.push({
      date: chronological[i].date,
      value: trimmedAverage(group) / 1000
    });
  }

  return result;
}

// ==========================================
// MAIN STATISTICS
// ==========================================

function renderStats() {
  $("solve-count").textContent = solves.length;

  if (!solves.length) {
    $("best-single").textContent = "--";
  } else {
    const best = Math.min(...solves.map(s => s.time));
    $("best-single").textContent = formatTime(best);
  }

  const ao5 = getAverage(5);
  const ao12 = getAverage(12);

  $("ao5").textContent =
    ao5 === null ? "--" : formatTime(ao5);

  $("ao12").textContent =
    ao12 === null ? "--" : formatTime(ao12);
}

// ==========================================
// ADVANCED ANALYTICS
// ==========================================

function renderAnalytics() {
  const ao50 = getAverage(50);
  const ao100 = getAverage(100);

  $("ao50").textContent =
    ao50 === null ? "--" : formatTime(ao50);

  $("ao100").textContent =
    ao100 === null ? "--" : formatTime(ao100);

  drawTrendGraph();
  drawDistribution();
  drawGraph();
  renderCalendar();
  renderRecords();
}

// ==========================================
// CANVAS GRAPH HELPERS
// ==========================================

function setupCanvas(id) {
  const canvas = $(id);
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();

  if (!rect.width || !rect.height) return null;

  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, rect.width, rect.height);

  return {
    canvas,
    ctx,
    width: rect.width,
    height: rect.height
  };
}

function drawEmpty(ctx, w, h, message) {
  ctx.fillStyle = "#8995a8";
  ctx.font = "13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(message, w / 2, h / 2);
}

// ==========================================
// ROLLING AVERAGE GRAPH
// ==========================================

function drawTrendGraph() {
  const result = setupCanvas("trendGraph");
  if (!result) return;

  const { ctx, width: w, height: h } = result;

  const ao5 = rollingValues(5);
  const ao12 = rollingValues(12);

  const all = [...ao5, ...ao12];

  if (!all.length) {
    drawEmpty(ctx, w, h, "Complete at least 12 solves to see trends");
    return;
  }

  const left = 42;
  const right = 12;
  const top = 25;
  const bottom = 25;

  const gw = w - left - right;
  const gh = h - top - bottom;

  const min = Math.max(
    0,
    Math.floor(Math.min(...all.map(x => x.value)) - 2)
  );

  const max = Math.ceil(
    Math.max(...all.map(x => x.value)) + 2
  );

  // Grid lines.
  for (let i = 0; i <= 4; i++) {
    const y = top + gh * i / 4;

    ctx.strokeStyle = "#303a4b";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();

    ctx.fillStyle = "#8995a8";
    ctx.textAlign = "right";
    ctx.font = "11px system-ui";

    const value = max - (max - min) * i / 4;
    ctx.fillText(value.toFixed(0) + "s", left - 7, y + 4);
  }

  function plot(data, color) {
    if (!data.length) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((p, i) => {
      const x = left + gw * i / Math.max(1, data.length - 1);

      const y = top + gh *
        (1 - (p.value - min) / (max - min || 1));

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  plot(ao5, "#70e1c1");
  plot(ao12, "#e6bd69");

  ctx.font = "11px system-ui";
  ctx.textAlign = "left";

  ctx.fillStyle = "#70e1c1";
  ctx.fillText("Ao5", left, 12);

  ctx.fillStyle = "#e6bd69";
  ctx.fillText("Ao12", left + 38, 12);
}

// ==========================================
// SOLVE DISTRIBUTION
// ==========================================

function drawDistribution() {
  const result = setupCanvas("distributionGraph");
  if (!result) return;

  const { ctx, width: w, height: h } = result;

  const times = solves.map(s => s.time / 1000);

  if (!times.length) {
    drawEmpty(ctx, w, h, "Your solve distribution will appear here");
    return;
  }

  const min = Math.floor(Math.min(...times) / 5) * 5;
  const max = Math.ceil(Math.max(...times) / 5) * 5;

  const bins = [];

  for (let i = min; i <= max; i += 5) {
    bins.push({
      label: i + "-" + (i + 5),
      count: 0
    });
  }

  times.forEach(t => {
    let index = Math.floor((t - min) / 5);
    index = Math.min(index, bins.length - 1);
    bins[index].count++;
  });

  const left = 38;
  const right = 10;
  const top = 15;
  const bottom = 40;

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

    ctx.fillStyle = "#8995a8";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";

    if (bins.length <= 12 || i % 2 === 0) {
      ctx.fillText(b.label, x + slot / 2, h - 12);
    }
  });
}

// ==========================================
// ALL SOLVES GRAPH
// ==========================================

function drawGraph() {
  const result = setupCanvas("graph");
  if (!result) return;

  const { ctx, width: w, height: h } = result;

  const chronological = [...solves].reverse();

  if (!chronological.length) {
    drawEmpty(ctx, w, h, "Complete a solve to begin your graph");
    return;
  }

  const values = chronological.map(s => s.time / 1000);

  const min = Math.max(0, Math.floor(Math.min(...values) - 2));
  const max = Math.ceil(Math.max(...values) + 2);

  const left = 42;
  const right = 12;
  const top = 15;
  const bottom = 25;

  const gw = w - left - right;
  const gh = h - top - bottom;

  for (let i = 0; i <= 4; i++) {
    const y = top + gh * i / 4;

    ctx.strokeStyle = "#303a4b";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();

    ctx.fillStyle = "#8995a8";
    ctx.font = "11px system-ui";
    ctx.textAlign = "right";

    const value = max - (max - min) * i / 4;
    ctx.fillText(value.toFixed(0) + "s", left - 7, y + 4);
  }

  const points = values.map((value, i) => ({
    x: left + gw * i / Math.max(1, values.length - 1),
    y: top + gh * (1 - (value - min) / (max - min || 1))
  }));

  ctx.strokeStyle = "#70e1c1";
  ctx.lineWidth = 2;
  ctx.beginPath();

  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });

  ctx.stroke();

  points.forEach(p => {
    ctx.fillStyle = "#70e1c1";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ==========================================
// PRACTICE CALENDAR
// ==========================================

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

    const level = count === 0
      ? 0
      : Math.min(4, Math.ceil(count / max * 4));

    const square = document.createElement("div");

    square.className = "calendar-day";
    square.dataset.level = level;
    square.title = key + ": " + count + " solves";

    grid.appendChild(square);
  }

  container.appendChild(grid);

  const labels = document.createElement("div");
  labels.className = "calendar-labels";

  labels.innerHTML =
    "<span>84 days ago</span><span>Today</span>";

  container.appendChild(labels);
}

// ==========================================
// PERSONAL RECORDS
// ==========================================

function renderRecords() {
  const container = $("personalRecords");
  container.replaceChildren();

  const chronological = [...solves].reverse();

  const records = [];

  if (solves.length) {
    const best = solves.reduce((a, b) =>
      a.time < b.time ? a : b
    );

    records.push({
      name: "Best Single",
      value: best.time,
      date: best.date
    });
  }

  for (const n of [5, 12, 50, 100]) {
    if (chronological.length < n) continue;

    let best = null;

    for (let i = n - 1; i < chronological.length; i++) {
      const group = chronological.slice(i - n + 1, i + 1);
      const value = trimmedAverage(group);

      if (best === null || value < best.value) {
        best = {
          value,
          date: chronological[i].date
        };
      }
    }

    records.push({
      name: "Best Ao" + n,
      value: best.value,
      date: best.date
    });
  }

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

// ==========================================
// SOLVE HISTORY
// ==========================================

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

// ==========================================
// RENDER EVERYTHING
// ==========================================

function render() {
  renderStats();
  renderHistory();
  renderAnalytics();
}

// ==========================================
// TAB NAVIGATION
// ==========================================

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

    // Recalculate canvas dimensions when switching tabs.
    renderAnalytics();
  });
});

// ==========================================
// BUTTONS
// ==========================================

$("new-scramble").addEventListener("click", newScramble);

$("manual-add").addEventListener("click", manualAdd);
$("manual-add-history").addEventListener("click", manualAdd);

$("clear-solves").addEventListener("click", () => {
  if (!confirm("Permanently delete all saved solves?")) return;

  solves = [];
  saveSolves();
  render();
});

// ==========================================
// EXPORT AND IMPORT
// ==========================================

$("export-data").addEventListener("click", () => {
  const data = JSON.stringify(solves, null, 2);

  const blob = new Blob([data], {
    type: "application/json"
  });

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
      "Import " + valid.length +
      " solves? They will be added to your current history."
    )) return;

    const existingIds = new Set(solves.map(s => s.id));

    valid.forEach(s => {
      if (!s.id || existingIds.has(s.id)) {
        s.id = makeId();
      }

      solves.push(s);
    });

    solves.sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );

    saveSolves();
    render();

    alert("Backup imported successfully.");
  } catch {
    alert("That file could not be imported.");
  }

  event.target.value = "";
});

// ==========================================
// RESIZE
// ==========================================

window.addEventListener("resize", () => {
  renderAnalytics();
});

// ==========================================
// INITIALIZE
// ==========================================

$("scramble").textContent = scramble;

render();
