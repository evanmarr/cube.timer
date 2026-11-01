const STORAGE_KEY = "cubeTimerSolves";
const SETTINGS_KEY = "cubeTimerSettings";
const GOAL_KEY = "cubeTimerDailyGoal";
const MILESTONES_KEY = "cubeTimerMilestones";
const ACHIEVEMENTS_KEY = "cubeTimerAchievements";

const DEFAULT_SETTINGS = {
  theme: "dark",
  inspection: true,
  precision: 2,
  showScramble: true,
  showStats: true,
  layoutPreset: "classic",
  confetti: true,
  animationSpeed: 260,
  cubeSize: 3,
  cubeFaceColors: {
    U: "#ffffff",
    D: "#ffd500",
    F: "#159447",
    B: "#2455c5",
    R: "#c62828",
    L: "#ff8c00"
  },
  stickerStyle: "solid"
};

const MILESTONE_DEFS = [
  { key: "first-solve", name: "First Solve", description: "Complete your first solve." },
  { key: "sub-60", name: "Sub-60", description: "Finish a solve under 60 seconds." },
  { key: "sub-50", name: "Sub-50", description: "Finish a solve under 50 seconds." },
  { key: "sub-40", name: "Sub-40", description: "Finish a solve under 40 seconds." },
  { key: "sub-30", name: "Sub-30", description: "Finish a solve under 30 seconds." },
  { key: "sub-25", name: "Sub-25", description: "Finish a solve under 25 seconds." },
  { key: "sub-20", name: "Sub-20", description: "Finish a solve under 20 seconds." },
  { key: "sub-15", name: "Sub-15", description: "Finish a solve under 15 seconds." },
  { key: "sub-10", name: "Sub-10", description: "Finish a solve under 10 seconds." },
  { key: "pb", name: "New Personal Best", description: "Set a new best single." },
  { key: "ao5", name: "New Ao5 Record", description: "Set a new average-of-5 record." },
  { key: "ao12", name: "New Ao12 Record", description: "Set a new average-of-12 record." }
];

const BADGES = [
  { key: "consistency-10", name: "Consistency", description: "Complete 10 solves in one session.", condition: "10 solves in a session" },
  { key: "dedication-3", name: "Dedication", description: "Practice on 3 days in a row.", condition: "3 consecutive days" },
  { key: "persistence", name: "Persistence", description: "Complete 25 solves in one session.", condition: "25 resolves in one session" },
  { key: "improvement", name: "Improvement", description: "Achieve a new personal best.", condition: "Beat your best single" },
  { key: "goal", name: "Practice", description: "Reach your daily or weekly goal.", condition: "Complete your goal" }
];

const TRAINER_CASES = [
  { category: "OLL", group: "Dot", number: "1", name: "Dot OLL", probability: "1/54", description: "The dot pattern with no faces solved.", recognition: "Look for the center dot and uneven edge orientation on the top layer.", algorithm: "R U2 R' U' R U' R'" },
  { category: "OLL", group: "CMLL", number: "2", name: "CMLL 2", probability: "1/54", description: "A simple corner and edge orientation pattern.", recognition: "The top face is nearly solved with one asymmetrical shape.", algorithm: "R U R' U' R' F R F'" },
  { category: "PLL", group: "Adjacent", number: "A", name: "A Perm", probability: "1/18", description: "Adjacent corner swap.", recognition: "Two corners are swapped on the top face.", algorithm: "x L2 D2 L' U' L D2 L' U L'" },
  { category: "F2L", group: "1", number: "1", name: "F2L 1", probability: "1/5", description: "A basic first-layer pair insertion.", recognition: "One corner and edge are already paired together.", algorithm: "U R U' R'" }
];

const $ = (id) => document.getElementById(id);

let solves = loadSolves();
let settings = loadSettings();
let unlockedMilestones = loadMilestones();
let dailyGoal = loadDailyGoal();
let scramble = generateScramble();
let timerState = "idle";
let startTime = 0;
let inspectStart = 0;
let animFrame = null;
let inspectFrame = null;
let pointerActive = false;
let lastBestSingle = getBestSingle();

let scene, camera, renderer, cubeGroup, cubeInitialized = false;
let cubeMoves = [];
let moveQueue = [];
let animating = false;
let paused = false;
let drag = false;
let lastPointer = { x: 0, y: 0 };

function loadSolves() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((solve) => solve && solve.time && solve.date);
  } catch {
    return [];
  }
}

function saveSolves() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(solves));
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...parsed, cubeFaceColors: { ...DEFAULT_SETTINGS.cubeFaceColors, ...(parsed.cubeFaceColors || {}) } };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadDailyGoal() {
  try {
    const parsed = Number(localStorage.getItem(GOAL_KEY) || '0');
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveDailyGoal() {
  localStorage.setItem(GOAL_KEY, String(dailyGoal));
}

function loadMilestones() {
  try {
    return JSON.parse(localStorage.getItem(MILESTONES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveMilestones() {
  localStorage.setItem(MILESTONES_KEY, JSON.stringify(unlockedMilestones));
}

function getBestSingle() {
  if (!solves.length) return Infinity;
  return Math.min(...solves.map((solve) => solve.time));
}

function formatTime(ms) {
  if (!Number.isFinite(ms)) return '--';
  return (ms / 1000).toFixed(settings.precision);
}

function parseTime(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n * 1000 : null;
}

function updateNetworkStatus() {
  const el = $("network-status");
  if (!el) return;
  const online = navigator.onLine;
  el.textContent = online ? "Online" : "Offline";
  el.classList.toggle("online", online);
  el.classList.toggle("offline", !online);
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", settings.theme || 'dark');
  const themeSelect = $("theme-select");
  if (themeSelect) themeSelect.value = settings.theme || 'dark';
}

function applyLayout() {
  document.body.dataset.layoutPreset = settings.layoutPreset || "classic";
  const scrambleEl = $("scramble");
  if (scrambleEl) scrambleEl.style.display = settings.showScramble ? "block" : "none";

  const statsCard = document.querySelector("#timer-page .card:last-child");
  if (statsCard) statsCard.style.display = settings.showStats ? "block" : "none";

  const preset = $("layout-preset");
  if (preset) preset.value = settings.layoutPreset || "classic";
}

function generateScramble(length = 20) {
  const faces = ["R", "L", "U", "D", "F", "B"];
  const modifiers = ["", "'", "2"];
  const axis = { R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 };
  const result = [];
  let lastFace = "";
  let lastAxis = -1;

  while (result.length < length) {
    const face = faces[Math.floor(Math.random() * faces.length)];
    if (face === lastFace || axis[face] === lastAxis) continue;
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    result.push(face + modifier);
    lastFace = face;
    lastAxis = axis[face];
  }

  return result.join(" ");
}

function newScramble() {
  scramble = generateScramble();
  const el = $("scramble");
  if (el) el.textContent = scramble;
}

function setTimerStateVisual(state) {
  const timer = $("timer");
  const label = $("timer-label");
  if (!timer || !label) return;

  timer.classList.remove("ready", "running", "warning");

  if (state === "ready") {
    timer.classList.add("ready");
    label.textContent = "Ready";
  } else if (state === "inspection") {
    timer.classList.add("warning");
    label.textContent = "Inspection";
  } else if (state === "running") {
    timer.classList.add("running");
    label.textContent = "Timing...";
  } else {
    label.textContent = "Hold or tap to start";
  }
}

function updateTimerDisplay() {
  const timer = $("timer");
  if (!timer) return;

  if (timerState === "idle") {
    timer.textContent = "0.00";
    timer.classList.remove("ready", "running", "warning");
    $("timer-label").textContent = "Hold or tap to start";
    return;
  }

  if (timerState === "ready") {
    timer.textContent = "0.00";
    timer.classList.add("ready");
    $("timer-label").textContent = "Release to start";
    return;
  }

  if (timerState === "inspection") {
    const remaining = Math.max(0, 15000 - (performance.now() - inspectStart));
    const value = (remaining / 1000).toFixed(1);
    timer.textContent = value;
    timer.classList.add("warning");
    $("timer-label").textContent = remaining < 3000 ? "Final seconds" : "Inspection";
    return;
  }

  if (timerState === "running") {
    timer.textContent = formatTime(performance.now() - startTime);
    timer.classList.add("running");
    $("timer-label").textContent = "Timing...";
  }
}

function enterInspection() {
  if (timerState === "running" || timerState === "inspection") return;
  timerState = "inspection";
  inspectStart = performance.now();
  updateTimerDisplay();
  cancelAnimationFrame(inspectFrame);
  inspectFrame = requestAnimationFrame(runInspectionCountdown);
}

function runInspectionCountdown() {
  if (timerState !== "inspection") return;
  const elapsed = performance.now() - inspectStart;
  if (elapsed >= 15000) {
    timerState = "running";
    startTime = performance.now();
    updateTimerDisplay();
    cancelAnimationFrame(inspectFrame);
    animFrame = requestAnimationFrame(updateTimer);
    return;
  }
  updateTimerDisplay();
  inspectFrame = requestAnimationFrame(runInspectionCountdown);
}

function startSolveTimer() {
  if (timerState === "running") return;
  timerState = "running";
  startTime = performance.now();
  cancelAnimationFrame(inspectFrame);
  updateTimerDisplay();
  cancelAnimationFrame(animFrame);
  animFrame = requestAnimationFrame(updateTimer);
}

function updateTimer() {
  if (timerState !== "running") return;
  const elapsed = performance.now() - startTime;
  $("timer").textContent = formatTime(elapsed);
  animFrame = requestAnimationFrame(updateTimer);
}

function stopTimer() {
  if (timerState !== "running") return;
  cancelAnimationFrame(animFrame);
  const elapsed = performance.now() - startTime;
  const solveEntry = { id: makeId(), time: elapsed, date: new Date().toISOString(), scramble };
  solves.unshift(solveEntry);
  saveSolves();
  timerState = "idle";
  updateAllMilestones();
  render();
  $("timer").textContent = formatTime(elapsed);
  $("timer-label").textContent = "Solve recorded";
  setTimeout(() => {
    newScramble();
    timerState = "idle";
    updateTimerDisplay();
  }, 700);
}

function beginPress() {
  if (timerState === "running") return;
  pointerActive = true;
  if (settings.inspection) {
    if (timerState !== "inspection") enterInspection();
  } else {
    if (timerState !== "ready") {
      timerState = "ready";
      updateTimerDisplay();
    }
  }
}

function endPress() {
  if (!pointerActive) return;
  pointerActive = false;
  if (timerState === "inspection") {
    cancelAnimationFrame(inspectFrame);
    startSolveTimer();
  } else if (timerState === "ready") {
    startSolveTimer();
  }
}

function handleTimerPointerDown(event) {
  if (event && event.target && event.target.closest("button")) return;
  if (event && event.type === "mousedown" && event.button !== 0) return;
  beginPress();
}

function handleTimerPointerUp() {
  endPress();
}

function bindTimerInput() {
  const timerCard = $("timer-card");
  if (!timerCard) return;
  timerCard.addEventListener("pointerdown", handleTimerPointerDown);
  timerCard.addEventListener("pointerup", handleTimerPointerUp);
  timerCard.addEventListener("pointerleave", handleTimerPointerUp);
  timerCard.addEventListener("pointercancel", handleTimerPointerUp);
}

function handleKeydown(event) {
  if (event.code !== "Space") return;
  const tag = event.target && event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  event.preventDefault();

  if (event.repeat) return;

  if (timerState === "running") {
    stopTimer();
    return;
  }

  if (timerState === "idle" || timerState === "ready" || timerState === "inspection") {
    if (timerState === "idle") {
      beginPress();
    } else {
      endPress();
    }
  }
}

function handleKeyup(event) {
  if (event.code === "Space" && (timerState === "inspection" || timerState === "ready")) {
    endPress();
  }
}

window.addEventListener("keydown", handleKeydown);
window.addEventListener("keyup", handleKeyup);
window.addEventListener("blur", () => {
  pointerActive = false;
  if (timerState === "inspection" || timerState === "ready") endPress();
});

function showToast(message) {
  const existing = document.getElementById("toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "toast";
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "var(--panel2)";
  toast.style.border = "1px solid var(--border)";
  toast.style.borderRadius = "999px";
  toast.style.padding = "10px 14px";
  toast.style.zIndex = "80";
  toast.style.color = "var(--text)";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function celebratePB() {
  if (!settings.confetti) return;
  const canvas = $("confetti");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const colors = ["#70e1c1", "#e6bd69", "#83aaff", "#ef8aab", "#ffffff"];
  const pieces = Array.from({ length: 160 }, () => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    size: 4 + Math.random() * 7,
    speed: 2 + Math.random() * 5,
    drift: (Math.random() - 0.5) * 3,
    angle: Math.random() * 6,
    spin: (Math.random() - 0.5) * 0.15,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));

  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    pieces.forEach((p) => {
      p.y += p.speed;
      p.x += p.drift;
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctx.restore();
    });
    frame++;
    if (frame < 180) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
  draw();
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function manualAdd() {
  const raw = window.prompt("Enter solve time in seconds:");
  if (raw === null) return;
  const time = parseTime(raw);
  if (time === null) return alert("Enter a valid time greater than zero.");

  solves.unshift({ id: makeId(), time, date: new Date().toISOString(), scramble: "Manual entry" });
  saveSolves();
  updateAllMilestones();
  render();
}

function editSolve(id) {
  const target = solves.find((solve) => solve.id === id);
  if (!target) return;
  const raw = window.prompt("Enter the new solve time in seconds:", (target.time / 1000).toFixed(settings.precision));
  if (raw === null) return;
  const time = parseTime(raw);
  if (time === null) return alert("Enter a valid time greater than zero.");

  target.time = time;
  saveSolves();
  updateAllMilestones();
  render();
}

function deleteSolve(id) {
  if (!window.confirm("Delete this solve?")) return;
  solves = solves.filter((solve) => solve.id !== id);
  saveSolves();
  updateAllMilestones();
  render();
}

function trimmedAverage(group) {
  if (group.length < 3) return null;
  const values = group.map((x) => x.time).sort((a, b) => a - b);
  const trimmed = values.slice(1, -1);
  if (!trimmed.length) return null;
  return trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
}

function getAverageForN(n) {
  if (solves.length < n) return null;
  const latest = [...solves].slice(0, n);
  return trimmedAverage(latest);
}

function rollingAverage(n, list = solves) {
  if (!Array.isArray(list) || list.length < n) return [];
  const ordered = [...list].reverse();
  const result = [];
  for (let start = n - 1; start < ordered.length; start++) {
    const slice = ordered.slice(start - n + 1, start + 1);
    const avg = trimmedAverage(slice);
    if (avg !== null) result.push(avg);
  }
  return result;
}

function filterSolvesByRange(list, range) {
  if (!Array.isArray(list) || !list.length) return [];
  if (range === "all") return [...list];
  const now = new Date();
  const cutoff = new Date(now);

  switch (range) {
    case "7": cutoff.setDate(cutoff.getDate() - 7); break;
    case "30": cutoff.setDate(cutoff.getDate() - 30); break;
    case "90": cutoff.setDate(cutoff.getDate() - 90); break;
    case "365": cutoff.setFullYear(cutoff.getFullYear() - 1); break;
    default: return [...list];
  }

  return list.filter((solve) => new Date(solve.date) >= cutoff);
}

function getAverageByRange(range) {
  const filtered = filterSolvesByRange(solves, range);
  if (!filtered.length) return null;
  return filtered.reduce((sum, solve) => sum + solve.time, 0) / filtered.length;
}

function drawLineGraph(canvasId, datasets, emptyMessage) {
  const canvas = $(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const values = datasets.flatMap((ds) => ds.values || []);
  if (!values.length) {
    ctx.fillStyle = "#8995a8";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(emptyMessage, rect.width / 2, rect.height / 2);
    return;
  }

  const left = 36;
  const right = 12;
  const top = 18;
  const bottom = 24;
  const innerW = rect.width - left - right;
  const innerH = rect.height - top - bottom;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  ctx.strokeStyle = "#303a4b";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = top + (innerH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(rect.width - right, y);
    ctx.stroke();
  }

  datasets.forEach((dataset) => {
    if (!dataset.values || !dataset.values.length) return;
    ctx.beginPath();
    dataset.values.forEach((value, index) => {
      const x = left + (innerW * index) / Math.max(dataset.values.length - 1, 1);
      const y = top + innerH - ((value - min) / range) * innerH;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = dataset.color;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawTrendGraph() {
  const range = $("progress-range")?.value || "7";
  const filtered = filterSolvesByRange(solves, range);
  const vals = rollingAverage(5, filtered).map((value) => value / 1000);
  const vals12 = rollingAverage(12, filtered).map((value) => value / 1000);
  drawLineGraph("trendGraph", [
    { values: vals, color: "#70e1c1" },
    { values: vals12, color: "#e6bd69" }
  ], "Complete more solves to view trends");
}

function drawGraph() {
  const range = $("progress-range")?.value || "7";
  const filtered = filterSolvesByRange(solves, range);
  const values = [...filtered].reverse().map((solve) => solve.time / 1000);
  drawLineGraph("graph", [{ values, color: "#70e1c1" }], "Complete a solve to begin your graph");
}

function drawDistribution() {
  const canvas = $("distributionGraph");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const times = solves.map((solve) => solve.time / 1000);
  if (!times.length) {
    ctx.fillStyle = "#8995a8";
    ctx.textAlign = "center";
    ctx.font = "13px sans-serif";
    ctx.fillText("Your solve distribution will appear here", rect.width / 2, rect.height / 2);
    return;
  }

  const min = Math.floor(Math.min(...times) / 5) * 5;
  const max = Math.ceil(Math.max(...times) / 5) * 5;
  const bins = [];
  for (let value = min; value < max; value += 5) {
    bins.push({ label: `${value}-${value + 5}`, count: 0 });
  }
  times.forEach((time) => {
    const index = Math.min(Math.max(Math.floor((time - min) / 5), 0), bins.length - 1);
    bins[index].count += 1;
  });

  const left = 30;
  const right = 10;
  const top = 15;
  const bottom = 26;
  const innerW = rect.width - left - right;
  const innerH = rect.height - top - bottom;
  const highest = Math.max(...bins.map((bin) => bin.count), 1);

  bins.forEach((bin, index) => {
    const barWidth = (innerW / bins.length) * 0.72;
    const x = left + (innerW / bins.length) * index + 4;
    const barHeight = (bin.count / highest) * innerH;
    ctx.fillStyle = "#70e1c1";
    ctx.fillRect(x, rect.height - bottom - barHeight, barWidth, barHeight);
    ctx.fillStyle = "#8995a8";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    if (bins.length <= 12 || index % 2 === 0) {
      ctx.fillText(bin.label, x + barWidth / 2, rect.height - 8);
    }
  });
}

function renderCalendar() {
  const cal = $("calendar");
  if (!cal) return;
  cal.innerHTML = "";
  const counts = {};
  solves.forEach((solve) => {
    const key = new Date(solve.date).toISOString().slice(0, 10);
    counts[key] = (counts[key] || 0) + 1;
  });

  const max = Math.max(1, ...Object.values(counts));
  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  for (let i = 83; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const count = counts[key] || 0;
    const level = count ? Math.min(4, Math.ceil((count / max) * 4)) : 0;
    const square = document.createElement("div");
    square.className = "calendar-day";
    square.dataset.level = String(level);
    square.title = `${key}: ${count} solves`;
    grid.appendChild(square);
  }

  cal.appendChild(grid);
  const labels = document.createElement("div");
  labels.className = "calendar-labels";
  labels.innerHTML = "<span>84 days ago</span><span>Today</span>";
  cal.appendChild(labels);
}

function renderRecords() {
  const container = $("personalRecords");
  if (!container) return;
  container.innerHTML = "";

  if (!solves.length) {
    container.textContent = "Complete some solves to establish your records.";
    return;
  }

  const best = getBestSingle();
  const records = [{ name: "Best Single", value: best }];

  [5, 12, 50, 100].forEach((windowSize) => {
    if (solves.length < windowSize) return;
    const ordered = [...solves].reverse();
    let bestAvg = null;
    for (let i = windowSize - 1; i < ordered.length; i++) {
      const slice = ordered.slice(i - windowSize + 1, i + 1);
      const avg = trimmedAverage(slice);
      if (avg !== null && (bestAvg === null || avg < bestAvg)) bestAvg = avg;
    }
    if (bestAvg !== null) records.push({ name: `Best Ao${windowSize}`, value: bestAvg });
  });

  records.forEach((record) => {
    const card = document.createElement("div");
    card.className = "record-item";
    card.innerHTML = `
      <div class="label">${record.name}</div>
      <div class="value">${formatTime(record.value)}</div>
    `;
    container.appendChild(card);
  });
}

function renderHistory() {
  const container = $("solve-list");
  if (!container) return;
  container.innerHTML = "";

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
    row.innerHTML = `
      <div>#${solves.length - index}</div>
      <div>
        <div class="solve-time">${formatTime(solve.time)}</div>
        <div class="solve-date">${new Date(solve.date).toLocaleString()}</div>
      </div>
      <div class="solve-actions">
        <button type="button" data-action="edit" data-id="${solve.id}">Edit</button>
        <button type="button" class="danger" data-action="delete" data-id="${solve.id}">Delete</button>
      </div>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll("[data-action='edit']").forEach((button) => {
    button.addEventListener("click", () => editSolve(button.dataset.id));
  });
  container.querySelectorAll("[data-action='delete']").forEach((button) => {
    button.addEventListener("click", () => deleteSolve(button.dataset.id));
  });
}

function renderStats() {
  const count = solves.length;
  $("solve-count").textContent = count;
  $("best-single").textContent = count ? formatTime(getBestSingle()) : "--";
  $("ao5").textContent = getAverageForN(5) === null ? "--" : formatTime(getAverageForN(5));
  $("ao12").textContent = getAverageForN(12) === null ? "--" : formatTime(getAverageForN(12));
  $("ao50").textContent = getAverageForN(50) === null ? "--" : formatTime(getAverageForN(50));
  $("ao100").textContent = getAverageForN(100) === null ? "--" : formatTime(getAverageForN(100));
  const avg = count ? solves.reduce((sum, solve) => sum + solve.time, 0) / count : null;
  $("avg-solve").textContent = avg === null ? "--" : formatTime(avg);

  const recentAverage = getAverageByRange($("progress-range")?.value || "7");
  $("progress-rate").textContent = recentAverage === null ? "--" : `${(recentAverage / 1000).toFixed(2)}s avg`;
}

function updateGoalStats() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = solves.filter((solve) => solve.date.slice(0, 10) === todayKey).length;
  $("goal-progress").textContent = `${todayCount} / ${dailyGoal || 0} solves`;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekCount = solves.filter((solve) => new Date(solve.date) >= weekStart).length;
  $("weekly-summary").textContent = `${weekCount} solves this week`;

  const goalInput = $("daily-goal");
  if (goalInput) goalInput.value = String(dailyGoal || 0);
}

function updateAchievementsUI() {
  const container = $("achievement-list");
  if (!container) return;
  container.innerHTML = "";

  const all = [
    ...MILESTONE_DEFS.map((item) => ({ ...item, type: "milestone" })),
    ...BADGES.map((item) => ({ ...item, type: "badge" }))
  ];

  all.forEach((item) => {
    const card = document.createElement("div");
    const unlocked = Boolean(unlockedMilestones[item.key]);
    card.className = `badge-card ${unlocked ? "unlocked" : "locked"}`;
    card.innerHTML = `
      <strong>${item.name}</strong>
      <div class="muted">${item.description || item.desc || item.condition}</div>
    `;
    container.appendChild(card);
  });
}

function updateAllMilestones() {
  const recent = [...solves].sort((a, b) => new Date(b.date) - new Date(a.date));
  const now = new Date().toISOString();
  const best = getBestSingle();

  if (solves.length && !unlockedMilestones["first-solve"]) unlockedMilestones["first-solve"] = now;

  [
    ["sub-60", () => recent.some((solve) => solve.time < 60000)],
    ["sub-50", () => recent.some((solve) => solve.time < 50000)],
    ["sub-40", () => recent.some((solve) => solve.time < 40000)],
    ["sub-30", () => recent.some((solve) => solve.time < 30000)],
    ["sub-25", () => recent.some((solve) => solve.time < 25000)],
    ["sub-20", () => recent.some((solve) => solve.time < 20000)],
    ["sub-15", () => recent.some((solve) => solve.time < 15000)],
    ["sub-10", () => recent.some((solve) => solve.time < 10000)],
    ["pb", () => best < lastBestSingle],
    ["ao5", () => {
      const ao5 = rollingAverage(5);
      return ao5.length > 0 && ao5[ao5.length - 1] < (recent[0]?.time || Infinity);
    }],
    ["ao12", () => {
      const ao12 = rollingAverage(12);
      return ao12.length > 0 && ao12[ao12.length - 1] < (recent[0]?.time || Infinity);
    }]
  ].forEach(([key, check]) => {
    if (check() && !unlockedMilestones[key]) {
      unlockedMilestones[key] = now;
      const meta = MILESTONE_DEFS.find((entry) => entry.key === key);
      if (meta) {
        if (key === "pb") celebratePB();
        showToast(`Milestone: ${meta.name}`);
      }
    }
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = solves.filter((solve) => solve.date.slice(0, 10) === todayKey).length;
  if (todayCount >= 10 && !unlockedMilestones["consistency-10"]) unlockedMilestones["consistency-10"] = now;
  if (solves.length >= 25 && !unlockedMilestones["persistence"]) unlockedMilestones["persistence"] = now;
  if (best < lastBestSingle && !unlockedMilestones["improvement"]) unlockedMilestones["improvement"] = now;
  if (dailyGoal && todayCount >= dailyGoal && !unlockedMilestones["goal"]) unlockedMilestones["goal"] = now;

  saveMilestones();
  updateAchievementsUI();
  lastBestSingle = best;
}

function render() {
  updateTimerDisplay();
  renderStats();
  renderHistory();
  renderRecords();
  renderCalendar();
  drawTrendGraph();
  drawDistribution();
  drawGraph();
  updateGoalStats();
  updateAchievementsUI();
  applyLayout();
}

function initializeSettingsUI() {
  const themeSelect = $("theme-select");
  if (themeSelect) {
    themeSelect.value = settings.theme;
    themeSelect.addEventListener("change", (event) => {
      settings.theme = event.target.value;
      saveSettings();
      applyTheme();
    });
  }

  const inspection = $("setting-inspection");
  if (inspection) {
    inspection.checked = settings.inspection;
    inspection.addEventListener("change", (event) => {
      settings.inspection = event.target.checked;
      saveSettings();
    });
  }

  const precision = $("setting-precision");
  if (precision) {
    precision.value = String(settings.precision);
    precision.addEventListener("change", (event) => {
      settings.precision = Number(event.target.value);
      saveSettings();
      render();
    });
  }

  const animationSpeed = $("setting-animation-speed");
  if (animationSpeed) {
    animationSpeed.value = String(settings.animationSpeed);
    animationSpeed.addEventListener("change", (event) => {
      settings.animationSpeed = Number(event.target.value);
      saveSettings();
    });
  }

  const confetti = $("setting-confetti");
  if (confetti) {
    confetti.checked = settings.confetti;
    confetti.addEventListener("change", (event) => {
      settings.confetti = event.target.checked;
      saveSettings();
    });
  }

  const showScramble = $("show-scramble");
  if (showScramble) {
    showScramble.checked = settings.showScramble;
    showScramble.addEventListener("change", (event) => {
      settings.showScramble = event.target.checked;
      saveSettings();
      applyLayout();
    });
  }

  const showStats = $("show-stats");
  if (showStats) {
    showStats.checked = settings.showStats;
    showStats.addEventListener("change", (event) => {
      settings.showStats = event.target.checked;
      saveSettings();
      applyLayout();
    });
  }

  const layoutPreset = $("layout-preset");
  if (layoutPreset) {
    layoutPreset.value = settings.layoutPreset;
    layoutPreset.addEventListener("change", (event) => {
      settings.layoutPreset = event.target.value;
      saveSettings();
      applyLayout();
    });
  }

  const dailyGoalInput = $("daily-goal");
  if (dailyGoalInput) {
    dailyGoalInput.value = String(dailyGoal || 0);
    dailyGoalInput.addEventListener("change", (event) => {
      dailyGoal = Math.max(0, Number(event.target.value) || 0);
      saveDailyGoal();
      updateGoalStats();
    });
  }

  const todo = $("toggle-shortcuts");
  if (todo) {
    todo.addEventListener("click", () => alert("Space: start/hold/stop\nN: new scramble\nM: manual add"));
  }

  const cubeSizeSetting = $("setting-cube-size");
  if (cubeSizeSetting) {
    cubeSizeSetting.value = String(settings.cubeSize);
    cubeSizeSetting.addEventListener("change", (event) => {
      settings.cubeSize = Number(event.target.value) || 3;
      saveSettings();
      if (cubeInitialized) rebuildCube();
    });
  }
}

function setupCubeFaceColors() {
  document.querySelectorAll("[data-face]").forEach((element) => {
    const face = element.dataset.face;
    element.value = settings.cubeFaceColors[face] || "#ffffff";
    element.addEventListener("input", (event) => {
      const color = event.target.value;
      settings.cubeFaceColors[face] = color;
      saveSettings();
      if (cubeInitialized) rebuildCube();
    });
  });

  const stickerStyle = $("sticker-style");
  if (stickerStyle) {
    stickerStyle.value = settings.stickerStyle || "solid";
    stickerStyle.addEventListener("change", (event) => {
      settings.stickerStyle = event.target.value;
      saveSettings();
      if (cubeInitialized) rebuildCube();
    });
  }

  const simCubeSize = $("sim-cube-size");
  if (simCubeSize) {
    simCubeSize.value = String(settings.cubeSize);
    simCubeSize.addEventListener("change", (event) => {
      settings.cubeSize = Number(event.target.value) || 3;
      saveSettings();
      if (cubeInitialized) rebuildCube();
    });
  }
}

function createTexture(color, style = "solid") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (style === "striped") {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  } else if (style === "checker") {
    for (let x = 0; x < canvas.width; x += 32) {
      for (let y = 0; y < canvas.height; y += 32) {
        ctx.fillStyle = (x + y) % 64 === 0 ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.12)";
        ctx.fillRect(x, y, 32, 32);
      }
    }
  } else if (style === "dots") {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    for (let x = 16; x < canvas.width; x += 52) {
      for (let y = 16; y < canvas.height; y += 52) {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function buildCubelets() {
  if (!cubeGroup) return;
  while (cubeGroup.children.length > 0) {
    cubeGroup.remove(cubeGroup.children[0]);
  }

  const cubeSize = Number(settings.cubeSize) || 3;
  const half = Math.floor(cubeSize / 2);
  const step = 0.9;

  for (let x = -half; x <= half; x++) {
    for (let y = -half; y <= half; y++) {
      for (let z = -half; z <= half; z++) {
        const group = new THREE.Group();
        const stickerStyle = settings.stickerStyle || "solid";

        const createSticker = (face, position, rotation) => {
          const geo = new THREE.PlaneGeometry(0.62, 0.62);
          const material = new THREE.MeshPhysicalMaterial({
            map: createTexture(settings.cubeFaceColors[face] || "#ffffff", stickerStyle),
            side: THREE.DoubleSide,
            transparent: true,
            roughness: 0.55,
            metalness: 0.08,
            clearcoat: 0.2
          });
          const mesh = new THREE.Mesh(geo, material);
          mesh.position.copy(position);
          mesh.rotation.set(rotation.x, rotation.y, rotation.z);
          group.add(mesh);
        };

        if (x === half) createSticker("R", new THREE.Vector3(0.46, 0, 0), { x: 0, y: Math.PI / 2, z: 0 });
        if (x === -half) createSticker("L", new THREE.Vector3(-0.46, 0, 0), { x: 0, y: -Math.PI / 2, z: 0 });
        if (y === half) createSticker("U", new THREE.Vector3(0, 0.46, 0), { x: Math.PI / 2, y: 0, z: 0 });
        if (y === -half) createSticker("D", new THREE.Vector3(0, -0.46, 0), { x: -Math.PI / 2, y: 0, z: 0 });
        if (z === half) createSticker("F", new THREE.Vector3(0, 0, 0.46), { x: 0, y: 0, z: 0 });
        if (z === -half) createSticker("B", new THREE.Vector3(0, 0, -0.46), { x: 0, y: Math.PI, z: 0 });

        const base = new THREE.Mesh(
          new THREE.BoxGeometry(step, step, step),
          new THREE.MeshPhysicalMaterial({ color: 0x1b1d22, roughness: 0.7, metalness: 0.1 })
        );

        base.position.set(x * step, y * step, z * step);
        base.userData.home = { x, y, z };
        group.add(base);
        cubeGroup.add(group);
      }
    }
  }
}

function createCube() {
  const stage = $("cube-stage");
  if (!stage || !window.THREE) return;

  scene = new THREE.Scene();
  scene.background = null;
  camera = new THREE.PerspectiveCamera(40, stage.clientWidth / stage.clientHeight, 0.1, 100);
  camera.position.set(5, 5, 7);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  stage.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 1.3);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(4, 5, 6);
  scene.add(dir);

  cubeGroup = new THREE.Group();
  scene.add(cubeGroup);
  buildCubelets();
  renderer.render(scene, camera);
  cubeInitialized = true;
  enableCubeDrag(stage);
}

function rebuildCube() {
  if (!cubeInitialized || !cubeGroup) return;
  buildCubelets();
}

function resizeCubeRenderer() {
  if (!cubeInitialized || !renderer) return;
  const stage = $("cube-stage");
  if (!stage) return;
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function enableCubeDrag(stage) {
  stage.addEventListener("pointerdown", (event) => {
    if (animating) return;
    drag = true;
    lastPointer = { x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointermove", (event) => {
    if (!drag || !cubeGroup) return;
    const dx = event.clientX - lastPointer.x;
    const dy = event.clientY - lastPointer.y;
    cubeGroup.rotation.y += dx * 0.01;
    cubeGroup.rotation.x += dy * 0.01;
    lastPointer = { x: event.clientX, y: event.clientY };
  });

  stage.addEventListener("pointerup", () => { drag = false; });
  stage.addEventListener("pointercancel", () => { drag = false; });
}

function moveDetails(move) {
  const match = /^([RLUDFBrludfbMESxyz])([2']?)$/.exec(move);
  if (!match) return null;
  const face = match[1];
  const suffix = match[2];
  const turns = suffix === "2" ? 2 : 1;
  const dir = suffix === "'" ? -1 : 1;

  const axisMap = {
    R: "x", L: "x", U: "y", D: "y", F: "z", B: "z",
    r: "x", l: "x", u: "y", d: "y", f: "z", b: "z",
    M: "x", E: "y", S: "z", x: "x", y: "y", z: "z"
  };
  const axis = axisMap[face];
  if (!axis) return null;

  return {
    axis,
    angle: (Math.PI / 2) * turns * dir,
    layers: [0, 1, -1]
  };
}

function animateMove(move) {
  if (!cubeGroup || animating || paused) return;
  const detail = moveDetails(move);
  if (!detail) return;

  animating = true;
  const group = new THREE.Group();
  cubeGroup.add(group);

  const selected = cubeGroup.children.filter((child) => {
    const pos = child.position[detail.axis];
    return Math.abs(pos) < 0.01 || detail.layers.includes(Math.round(pos));
  });

  selected.forEach((child) => {
    cubeGroup.remove(child);
    group.add(child);
  });

  const startTime = performance.now();
  const duration = settings.animationSpeed || 260;
  const endAngle = detail.angle;

  function frame(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    group.rotation[detail.axis] = endAngle * eased;

    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }

    const children = [...group.children];
    children.forEach((child) => {
      group.remove(child);
      cubeGroup.add(child);
    });

    cubeGroup.remove(group);
    animating = false;
    processMoveQueue();
  }

  requestAnimationFrame(frame);
}

function processMoveQueue() {
  if (paused || animating) return;
  const next = moveQueue.shift();
  if (next) animateMove(next);
}

function playMove(move, record = true) {
  if (!moveDetails(move)) return;
  if (!cubeInitialized) createCube();
  if (record) {
    cubeMoves.push(move);
    renderMoveList();
  }
  moveQueue.push(move);
  processMoveQueue();
}

function renderMoveList() {
  const container = $("sim-moves");
  if (!container) return;
  container.innerHTML = "";
  cubeMoves.forEach((move) => {
    const chip = document.createElement("span");
    chip.className = "move-chip";
    chip.textContent = move;
    container.appendChild(chip);
  });
}

function parseAlgorithm(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return cleaned.split(" ").filter(Boolean);
}

function runAlgorithm(text) {
  const moves = parseAlgorithm(text);
  if (!moves.length) return;
  cubeMoves = [];
  moveQueue = [];
  renderMoveList();
  moves.forEach((move) => playMove(move, true));
}

function inverseMove(move) {
  if (move.endsWith("2")) return move;
  return move.endsWith("'") ? move.slice(0, -1) : `${move}'`;
}

function initializeSimulator() {
  const simTurn = $("sim-turn");
  if (simTurn) {
    simTurn.addEventListener("click", () => {
      const move = $("move-select").value;
      playMove(move);
    });
  }

  const runButton = $("sim-run-algorithm");
  if (runButton) {
    runButton.addEventListener("click", () => {
      const text = $("sim-algorithm").value;
      runAlgorithm(text);
    });
  }

  const scrambleButton = $("sim-scramble");
  if (scrambleButton) {
    scrambleButton.addEventListener("click", () => {
      if (!cubeInitialized) createCube();
      cubeMoves = [];
      moveQueue = [];
      renderMoveList();
      const moves = generateScramble().split(" ");
      moves.forEach((move) => playMove(move, false));
    });
  }

  const resetButton = $("sim-reset");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (!cubeInitialized) createCube();
      cubeMoves = [];
      moveQueue = [];
      animating = false;
      paused = false;
      $("sim-pause").textContent = "Pause";
      if (cubeGroup) cubeGroup.rotation.set(0, 0, 0);
      rebuildCube();
      renderMoveList();
    });
  }

  const pauseButton = $("sim-pause");
  if (pauseButton) {
    pauseButton.addEventListener("click", () => {
      paused = !paused;
      pauseButton.textContent = paused ? "Resume" : "Pause";
      if (!paused) processMoveQueue();
    });
  }

  const undoButton = $("sim-undo");
  if (undoButton) {
    undoButton.addEventListener("click", () => {
      if (animating || moveQueue.length) return;
      const last = cubeMoves.pop();
      if (!last) return;
      renderMoveList();
      playMove(inverseMove(last), false);
    });
  }
}

function initializeTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === button.dataset.page));
    });
  });
}

function initializeTrainer() {
  const category = $("trainer-category");
  const group = $("trainer-group");
  const caseSelect = $("trainer-case");
  const search = $("trainer-search");
  const title = $("case-title");
  const description = $("case-description");
  const recognition = $("case-recognition");
  const algorithm = $("case-algorithm");
  const caseNumber = $("case-number");
  const caseGroup = $("case-group");
  const probability = $("case-probability");
  const image = $("case-image");

  let currentIndex = 0;
  let currentCases = TRAINER_CASES.filter((item) => item.category === "OLL");

  function renderCase(caseData) {
    if (!caseData) return;
    title.textContent = caseData.name;
    caseNumber.textContent = `Case #${caseData.number}`;
    caseGroup.textContent = caseData.group;
    probability.textContent = caseData.probability;
    description.textContent = caseData.description;
    recognition.textContent = caseData.recognition;
    algorithm.textContent = caseData.algorithm;

    const svg = `<svg viewBox="0 0 180 180" aria-label="${caseData.name}">
      <rect x="0" y="0" width="180" height="180" fill="#111722"/>
      <g stroke="#dce7f9" stroke-width="2">
        <rect x="18" y="18" width="144" height="144" rx="8" fill="none"/>
        <path d="M90 18v144M18 90h144" />
      </g>
      <g>
        <rect x="18" y="18" width="72" height="72" fill="#70e1c1" opacity="0.9"/>
        <rect x="90" y="18" width="72" height="72" fill="#ffd500" opacity="0.85"/>
        <rect x="18" y="90" width="72" height="72" fill="#ff8c00" opacity="0.8"/>
        <rect x="90" y="90" width="72" height="72" fill="#159447" opacity="0.8"/>
      </g>
    </svg>`;
    image.innerHTML = svg;
  }

  function refreshCases() {
    let items = TRAINER_CASES.filter((item) => item.category === category.value);
    if (group.value !== "all") items = items.filter((item) => item.group === group.value);
    const query = search.value.trim().toLowerCase();
    if (query) items = items.filter((item) => `${item.name} ${item.algorithm} ${item.number}`.toLowerCase().includes(query));
    currentCases = items.length ? items : TRAINER_CASES;
    currentIndex = Math.min(currentIndex, currentCases.length - 1);

    caseSelect.innerHTML = currentCases.map((item, idx) => `<option value="${idx}">${item.name}</option>`).join("");
    if (currentCases.length) renderCase(currentCases[currentIndex]);
  }

  category.addEventListener("change", () => {
    const cats = [...new Set(TRAINER_CASES.filter((item) => item.category === category.value).map((item) => item.group))];
    group.innerHTML = ['<option value="all">All groups</option>'].concat(cats.map((name) => `<option value="${name}">${name}</option>`)).join("");
    currentIndex = 0;
    refreshCases();
  });

  group.addEventListener("change", refreshCases);
  search.addEventListener("input", refreshCases);
  caseSelect.addEventListener("change", (event) => {
    currentIndex = Number(event.target.value);
    if (currentCases.length) renderCase(currentCases[currentIndex]);
  });

  $("next-case").addEventListener("click", () => {
    if (!currentCases.length) return;
    currentIndex = (currentIndex + 1) % currentCases.length;
    caseSelect.value = String(currentIndex);
    renderCase(currentCases[currentIndex]);
  });

  $("prev-case").addEventListener("click", () => {
    if (!currentCases.length) return;
    currentIndex = (currentIndex - 1 + currentCases.length) % currentCases.length;
    caseSelect.value = String(currentIndex);
    renderCase(currentCases[currentIndex]);
  });

  $("random-case").addEventListener("click", () => {
    if (!currentCases.length) return;
    currentIndex = Math.floor(Math.random() * currentCases.length);
    caseSelect.value = String(currentIndex);
    renderCase(currentCases[currentIndex]);
  });

  $("show-algorithm").addEventListener("click", () => {
    if (currentCases.length) algorithm.textContent = currentCases[currentIndex].algorithm;
  });

  $("practice-case").addEventListener("click", () => {
    if (currentCases.length) {
      $("sim-algorithm").value = currentCases[currentIndex].algorithm;
      document.querySelector('[data-page="sim-page"]').click();
    }
  });

  const cats = [...new Set(TRAINER_CASES.filter((item) => item.category === category.value).map((item) => item.group))];
  group.innerHTML = ['<option value="all">All groups</option>'].concat(cats.map((name) => `<option value="${name}">${name}</option>`)).join("");
  refreshCases();
}

function installServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function initializeApp() {
  bindTimerInput();
  initializeTabs();
  initializeSettingsUI();
  setupCubeFaceColors();
  initializeSimulator();
  initializeTrainer();
  applyTheme();
  applyLayout();
  if (!scramble) newScramble();
  else {
    const el = $("scramble");
    if (el) el.textContent = scramble;
  }
  updateNetworkStatus();
  render();
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  window.addEventListener("resize", () => {
    resizeCubeRenderer();
    render();
  });
  installServiceWorker();
}

initializeApp();
$("new-scramble").addEventListener("click", newScramble);
$("manual-add").addEventListener("click", manualAdd);
$("manual-add-history").addEventListener("click", manualAdd);
$("export-data").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(solves, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cube-timer-backup.json";
  link.click();
  URL.revokeObjectURL(url);
});
$("import-data").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error("Invalid JSON");
    const valid = data.filter((item) => item && item.date && item.time);
    if (!valid.length) throw new Error("No valid solves");
    solves.push(...valid.map((item) => ({ ...item, id: item.id || makeId() })));
    saveSolves();
    updateAllMilestones();
    render();
    alert(`Imported ${valid.length} solves.`);
  } catch {
    alert("That file could not be imported.");
  }
  event.target.value = "";
});
$("clear-solves").addEventListener("click", () => {
  if (!window.confirm("Delete all saved solves?")) return;
  solves = [];
  saveSolves();
  updateAllMilestones();
  render();
});

setInterval(() => {
  updateNetworkStatus();
  if (timerState === "inspection") updateTimerDisplay();
}, 1000);

window.addEventListener("load", () => {
  if (!cubeInitialized) createCube();
  resizeCubeRenderer();
});

