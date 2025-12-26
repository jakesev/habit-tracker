/* ================= CONFIG ================= */
const ROWS = 6;
const SIZE = 40;
const H = SIZE * Math.sqrt(3) / 2;
const MAX_TRIANGLES = ROWS * ROWS;


/* ================= GLOW CONTROL ================= */
// 1.0 = current look
// 1.5 = strong
// 2.0 = very intense
const GLOW_INTENSITY = 1.6;


/* ================= THEMES ================= */
const THEMES = {
  green: {
    fill: "#4CAF50",
    inverted: "#A5D6A7",
    glow: [244, 208, 63] // gold
  },
  blue: {
    fill: "#1E88E5",
    inverted: "#90CAF9",
    glow: [241, 196, 15]
  },
  purple: {
    fill: "#8E24AA",
    inverted: "#CE93D8",
    glow: [255, 215, 0]
  }
};

let currentTheme = "green";

/* ================= STATE ================= */
let pyramids = [];
let active = [];
let viewMode = "focus";

/* ================= CAMERA ================= */
let camScale = 1;
let targetCamScale = 1;

/* ================= LEVEL FX ================= */
let levelPulse = 0;

/* ================= SOUND ================= */
let rewardSound, osc1, osc2, osc3;

/* ================= VISUAL FX (NEW) =================
   - sparkles: ambient floating lights around pyramid
   - confetti: burst when level increases
   - glowPulse: stronger halo moment on level up
*/
let sparkles = [];
let confetti = [];
let glowPulse = 0;

/* ================= Unlock Audio ================= */
let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;

  const ctx = getAudioContext();
  if (ctx.state !== "running") {
    ctx.resume();
  }

  audioUnlocked = true;
}


/* ================= PRELOAD ================= */
function preload() {
  rewardSound = new p5.Oscillator("sine");
  osc1 = new p5.Oscillator("sine");
  osc2 = new p5.Oscillator("sine");
  osc3 = new p5.Oscillator("sine");
}

/* ================= SETUP ================= */
function setup() {
  // Canvas size (desktop friendly). We'll also support resize for mobile.
  const { w, h } = getCanvasSize();
  createCanvas(w, h).parent("canvas-container");

  document.body.classList.add("dark");
  localStorage.setItem("triangle_darkmode", "1");

  // Audio setup
  [rewardSound, osc1, osc2, osc3].forEach(o => {
    o.start();
    o.amp(0);
  });

  loadData();

  const toggleBtn = document.getElementById("viewToggleBtn");
  toggleBtn.innerText = viewMode === "focus" ? "Show All" : "Focus";

  updateStatus();
  seedSparkles();

  // Buttons
  document.getElementById("addBtn").onclick = addProgress;
  document.getElementById("viewToggleBtn").onclick = toggleViewMode;
  document.getElementById("resetBtn").onclick = resetAll;
  document.getElementById("themeBtn").onclick = cycleTheme;

  // Dark mode toggle (NEW)
  const modeBtn = document.getElementById("modeBtn");
  if (modeBtn) {
    modeBtn.onclick = toggleDarkMode;
    syncModeButton();
  }
}

function getCanvasSize() {
  const isMobile = window.innerWidth < 768;

  const maxW = 700;
  const w = isMobile
    ? window.innerWidth - 24
    : maxW;

  const h = isMobile
    ? window.innerHeight * 0.45
    : 500;

  return {
    w: Math.max(320, Math.min(w, maxW)),
    h: Math.max(300, h)
  };
}


/* ================= DRAW ================= */
function draw() {
  // Background of the canvas (matches the card style)
  drawCanvasBackground();

  // Smooth camera scale transitions
  camScale = lerp(camScale, targetCamScale, 0.08);

  // Level pulse (your existing zoom pulse)
  if (levelPulse > 0.01) {
    camScale *= 1 + levelPulse * 0.05;
    levelPulse *= 0.88;
  }

  // Additional glow pulse (NEW)
  if (glowPulse > 0.01) {
    glowPulse *= 0.90;
  }

  // Draw sparkles + confetti in canvas-space (not affected by camScale)
  updateAndDrawSparkles();
  updateAndDrawConfetti();

  // Draw pyramid in pyramid-space (affected by camScale)
  push();
  const isMobile = window.innerWidth < 768;
  translate(width / 2, isMobile ? 50 : 90);

  scale(camScale);

  viewMode === "all" ? drawAllPyramids() : drawActivePyramid();
  pop();
  
  drawFocusInfo();

}

/* ================= DRAW PYRAMIDS ================= */
function drawActivePyramid() {
  targetCamScale = 1;

  // NEW: big outer halo glow around the whole pyramid (looks like your reference)
  drawPyramidHalo(false, pyramids.length);

  // Draw the triangles
  drawPyramid(active, false, pyramids.length);

  // NEW: base glow line under pyramid (reference has a ground glow)
  drawBaseGlow();
}

function drawAllPyramids() {
  targetCamScale = computeAutoScale();
  let count = 0;
  let pw = SIZE * ROWS;
  let ph = H * ROWS;

  for (let r = 0; ; r++) {
    let slots = r * 2 + 1;
    let y = r * ph;
    let startX = -((slots - 1) * pw) / 4;

    for (let i = 0; i < slots; i++) {
      let x = startX + i * (pw / 2);
      let up = i === 0 || i === slots - 1 || i % 2 === 0;

      if (count < pyramids.length) {
        drawMetaPyramid(pyramids[count], x, y, up, count);
        count++;
      } else {
        drawMetaPyramid(active, x, y, up, pyramids.length);
        return;
      }
    }
  }
}

function drawMetaPyramid(pyr, x, y, up, index) {
  push();
  translate(x, y);

  if (!up) {
    translate(SIZE * ROWS / 2, H * ROWS / 2);
    scale(1, -1);
    translate(-SIZE * ROWS / 2, -H * ROWS / 2);
  }

  // NEW: slightly softer halo for “all view”
  drawPyramidHalo(!up, index, true);
  drawPyramid(pyr, !up, index);

  pop();
}

/* ================= DRAW TRIANGLES ================= */
function drawPyramid(tris, invert, index) {
  let theme = THEMES[currentTheme];
  let filled = tris.length;
  let skip = MAX_TRIANGLES - filled;
  let count = 0;

  for (let r = 0; r < ROWS; r++) {
    let n = r * 2 + 1;
    let y = r * H;
    let startX = -(n * SIZE) / 4;

    for (let i = 0; i < n; i++) {
      if (!invert && count >= filled) return;
      if (invert && count < skip) {
        count++;
        continue;
      }

      let up = i === 0 || i === n - 1 || i % 2 === 0;
      let x = startX + i * (SIZE / 2);

      let g = theme.glow;

      // 🔥 controlled triangle glow
      drawingContext.shadowBlur =
        (index === pyramids.length ? 8 : 5) * GLOW_INTENSITY;
      drawingContext.shadowColor =
        `rgba(${g[0]},${g[1]},${g[2]},${0.25 * GLOW_INTENSITY})`;

      stroke(g[0], g[1], g[2], 150);
      strokeWeight(index === pyramids.length ? 1.6 : 1.1);
      fill(up ? theme.fill : theme.inverted);

      up
        ? triangle(x, y + H, x + SIZE / 2, y, x + SIZE, y + H)
        : triangle(x, y, x + SIZE, y, x + SIZE / 2, y + H);

      count++;
    }
  }
}


/* ================= PYRAMID HALO (NEW) =================
   This draws a BIG glow around the outer triangle only,
   so it matches your reference better (not per triangle).
*/
function drawPyramidHalo(invert, index, isAllView = false) {
  // Only glow strongly for the active pyramid (focus),
  // and softer when showing all.
  const isActivePyramid = index === pyramids.length;
  const strength = isActivePyramid ? 1 : 0.55;

  let theme = THEMES[currentTheme];
  let g = theme.glow;

  // Outer triangle points in pyramid space
  const n = (ROWS * 2 - 1);
  const leftX = -(n * SIZE) / 4;
  const rightX = ((n + 2) * SIZE) / 4;
  const baseY = ROWS * H;
  const topX = SIZE / 4;
  const topY = 0;

  // If inverted in meta grid, halo should follow that orientation too.
  // (Our meta pyramid flips via transform before calling this, so coords still work.)

  push();
  noFill();

  // The reference has a warm gold bloom.
  // We layer strokes to create a “bloom” look.
  const pulseBoost = (glowPulse * 0.9);

  // Outer soft glow
  drawingContext.shadowColor = `rgba(${g[0]},${g[1]},${g[2]},${0.35 * strength})`;
  drawingContext.shadowBlur = (isAllView ? 18 : 32) * strength + 40 * pulseBoost;

  // Fat strokes behind
  stroke(g[0], g[1], g[2], 35 * strength);
  strokeWeight((isAllView ? 18 : 26) * strength + 10 * pulseBoost);
  triangle(leftX, baseY, topX, topY, rightX, baseY);

  // Mid glow
  drawingContext.shadowBlur = (isAllView ? 12 : 18) * strength + 22 * pulseBoost;
  stroke(g[0], g[1], g[2], 70 * strength);
  strokeWeight((isAllView ? 6 : 9) * strength + 4 * pulseBoost);
  triangle(leftX, baseY, topX, topY, rightX, baseY);

  // Crisp outline
  drawingContext.shadowBlur = (isAllView ? 6 : 10) * strength + 10 * pulseBoost;
  stroke(g[0], g[1], g[2], 160 * strength);
  strokeWeight((isAllView ? 1.6 : 2.2) * strength + 1.5 * pulseBoost);
  triangle(leftX, baseY, topX, topY, rightX, baseY);

  pop();
}

/* ================= BASE GLOW (NEW) =================
   A subtle glow “ground line” under the pyramid.
*/
function drawBaseGlow() {
  let theme = THEMES[currentTheme];
  let g = theme.glow;

  const n = (ROWS * 2 - 1);
  const leftX = -(n * SIZE) / 4;
  const rightX = ((n + 2) * SIZE) / 4;
  const baseY = ROWS * H;

  push();
  noFill();
  strokeCap(ROUND);

  drawingContext.shadowColor = `rgba(${g[0]},${g[1]},${g[2]},0.35)`;
  drawingContext.shadowBlur = 22 + glowPulse * 35;

  stroke(g[0], g[1], g[2], 75);
  strokeWeight(10 + glowPulse * 10);
  line(leftX + 18, baseY + 18, rightX - 18, baseY + 18);

  pop();
}

/* ================= PROGRESS ================= */
function addProgress() {
  unlockAudio(); // 🔊 THIS FIXES THE ISSUE
  
  active.push(1);
  playReward();

  let before = getLevelInfo().level;
  let pyramidCompleted = false;

  // 🎯 PYRAMID COMPLETE
  if (active.length === MAX_TRIANGLES) {
    pyramids.push([...active]);
    active = [];
    pyramidCompleted = true;
    playCompletionChord();
  }

  let after = getLevelInfo().level;

  // 🎉 LEVEL UP
  if (after > before) {
    levelPulse = 1;
    glowPulse = 1;
    spawnConfettiBurst();
    playLevelUpSound();
  }

  // 🎊 PYRAMID COMPLETION CONFETTI (THIS WAS MISSING)
  if (pyramidCompleted) {
    glowPulse = 1;
    spawnConfettiBurst();
  }

  saveData();
  updateStatus();
}

/* ================= LEVEL SYSTEM ================= */
function getTotalXP() {
  return pyramids.length * MAX_TRIANGLES + active.length;
}

function getLevelInfo() {
  let xp = getTotalXP();
  let level = Math.floor((Math.sqrt(8 * xp + 1) - 1) / 2);
  let current = (level * (level + 1)) / 2;
  let next = ((level + 1) * (level + 2)) / 2;
  return { level, xp, current, next };
}

/* ================= UI ================= */
function updateStatus() {
  let info = getLevelInfo();
  let into = info.xp - info.current;
  let size = info.next - info.current;

  // % into current level
  let pct = (into / size) * 100;

  /* UX FIX:
     If next action completes the level,
     show the bar as full (so user “sees” completion) */
  if (info.xp + 1 >= info.next) pct = 100;

  pct = constrain(pct, 0, 100);

  // Top UI
  document.getElementById("levelText").innerText = `Lv ${info.level}`;
  document.getElementById("xpText").innerText = `${info.xp} / ${info.next} XP`;
  document.getElementById("xpPercent").innerText = `${Math.round(pct)}%`;
  
  const totalTriangles =
  pyramids.length * MAX_TRIANGLES + active.length;
  document.getElementById("activeCount").innerText = totalTriangles.toLocaleString();

  document.getElementById("completedCount").innerText = pyramids.length;

  // XP bar
  document.getElementById("xp-bar").style.width = pct + "%";
  document.getElementById("xp-bar-label").innerText = `${Math.round(pct)}%`;
}

function drawFocusInfo() {
  const el = document.getElementById("focusInfo");
  if (!el) return;

  const total = pyramids.length * MAX_TRIANGLES + active.length;

  if (viewMode === "all") {
    el.innerText = `Total progress • ${total} triangles`;
  } else {
    el.innerText =
      `Pyramid ${pyramids.length + 1} • ${active.length}/${MAX_TRIANGLES} triangles`;
  }
}


/* ================= UTIL ================= */
function computeAutoScale() {
  let rows = Math.ceil(Math.sqrt(pyramids.length + 1));
  let pw = SIZE * ROWS;
  let ph = H * ROWS;
  return min(
    (width * 0.75) / ((2 * rows - 1) * pw / 2),
    (height * 0.75) / (rows * ph),
    1
  );
}

function cycleTheme() {
  let keys = Object.keys(THEMES);
  currentTheme = keys[(keys.indexOf(currentTheme) + 1) % keys.length];

  // Refresh sparkles color vibe a bit when theme changes
  seedSparkles(true);
}

/* ================= STORAGE ================= */
function saveData() {
  localStorage.setItem("triangleSystem", JSON.stringify({ pyramids, active }));
}
function loadData() {
  let d = JSON.parse(localStorage.getItem("triangleSystem"));
  if (d) {
    pyramids = d.pyramids || [];
    active = d.active || [];
  }
}
function resetAll() {
  pyramids = [];
  active = [];
  saveData();
  updateStatus();
}

/* ================= SOUND ================= */
function playReward() {
  rewardSound.amp(0.12, 0.025);
  rewardSound.amp(0, 0.24);
}
function playCompletionChord() {
  [osc1, osc2, osc3].forEach((o, i) => {
    o.freq([440, 554, 659][i]);
    o.amp(0.3, 0.05);
    o.amp(0, 0.6);
  });
}
function playLevelUpSound() {
  [osc1, osc2, osc3].forEach((o, i) => {
    o.freq([523, 659, 784][i]);
    o.amp(0.35, 0.03);
    o.amp(0, 0.7);
  });
}

/* ================= DARK MODE (NEW) ================= */
function toggleDarkMode() {
  document.body.classList.toggle("dark");
  localStorage.setItem("triangle_darkmode", document.body.classList.contains("dark") ? "1" : "0");
  syncModeButton();
}

function syncModeButton() {
  const modeBtn = document.getElementById("modeBtn");
  if (!modeBtn) return;

  const isDark = localStorage.getItem("triangle_darkmode") === "1";
  document.body.classList.toggle("dark", isDark);
  modeBtn.innerText = document.body.classList.contains("dark") ? "Light" : "Dark";
}

// Load saved dark mode on start
(function initDarkMode() {
  const isDark = localStorage.getItem("triangle_darkmode") === "1";
  document.body.classList.toggle("dark", isDark);
})();

/* ================= CANVAS BACKGROUND (NEW) =================
   Gives the canvas that subtle soft-card look.
*/
function drawCanvasBackground() {
  const isDark = document.body.classList.contains("dark");
  
  // Smooth gradient
  if (!isDark) {
      background(224, 228, 232); // darker than before (important)

    // subtle vignette
    noStroke();
    for (let i = 0; i < 12; i++) {
      fill(0, 0, 0, 4);
      rect(0 + i, 0 + i, width - i * 2, height - i * 2, 18);
    }
  } else {
    background(10, 14, 30);
    // subtle glow fog
    noStroke();
    for (let i = 0; i < 14; i++) {
      fill(255, 255, 255, 2);
      rect(0 + i, 0 + i, width - i * 2, height - i * 2, 18);
    }
  }
}

/* ================= SPARKLES (NEW) =================
   Floating lights/circles like the reference “particles”.
*/
function seedSparkles(softReset = false) {
  if (softReset) {
    // Keep some, don’t hard reset (nicer)
    sparkles = sparkles.slice(0, 12);
  } else {
    sparkles = [];
  }

  while (sparkles.length < 22) {
    sparkles.push(makeSparkle());
  }
}

function makeSparkle() {
  let theme = THEMES[currentTheme];
  let g = theme.glow;

  return {
    x: random(width),
    y: random(height),
    r: random(1.5, 4.5),
    a: random(40, 140),
    va: random(0.4, 1.2),
    vx: random(-0.22, 0.22),
    vy: random(-0.30, -0.06),
    hue: [g[0], g[1], g[2]],
  };
}

function updateAndDrawSparkles() {
  let theme = THEMES[currentTheme];
  let g = theme.glow;

  // Keep them “around the pyramid area”
  const centerX = width / 2;
  const centerY = height / 2;

  noStroke();
  for (let s of sparkles) {
    // twinkle
    s.a += sin(frameCount * 0.02) * s.va;

    // drift
    s.x += s.vx;
    s.y += s.vy;

    // wrap
    if (s.y < -20) {
      s.y = height + 20;
      s.x = random(width);
    }
    if (s.x < -20) s.x = width + 20;
    if (s.x > width + 20) s.x = -20;

    // draw
    drawingContext.shadowBlur = 18;
    drawingContext.shadowColor = `rgba(${g[0]},${g[1]},${g[2]},0.25)`;

    fill(g[0], g[1], g[2], constrain(s.a, 0, 170));
    circle(s.x, s.y, s.r);

    // small white core
    drawingContext.shadowBlur = 0;
    fill(255, 255, 255, 120);
    circle(s.x, s.y, s.r * 0.45);
  }
}

/* ================= CONFETTI (NEW) =================
   Burst on level up.
*/
function spawnConfettiBurst() {

    
  let theme = THEMES[currentTheme];
  let g = theme.glow;

  const burstX = width / 2;
  const burstY = height * 0.15;

  
  // 🔥 CONTROL THESE 4 VALUES 🔥
  const CONFETTI_COUNT = viewMode === "all" ? 60 : 120;  // amount
  const SIZE_MIN = 2.5;           // size
  const SIZE_MAX = 4.5;
  const LIFE_MIN = 50;            // lifetime
  const LIFE_MAX = 120;

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    confetti.push({
      x: burstX + random(-30, 30),
      y: burstY + random(-20, 20),

      // 🚀 BIGGER EXPLOSION
      vx: random(-6.0, 6.0),
      vy: random(-9.0, -3.5),

      grav: random(0.08, 0.16),
      life: random(LIFE_MIN, LIFE_MAX),

      size: random(SIZE_MIN, SIZE_MAX),

      rot: random(TWO_PI),
      vr: random(-0.35, 0.35),

      // gold + white mix
      c: random() < 0.6
        ? [g[0], g[1], g[2]]
        : [255, 255, 255],
    });
  }
}


function updateAndDrawConfetti() {
  if (confetti.length === 0) return;

  const useGlow = viewMode === "focus"; // 🔑 key optimisation

  for (let i = confetti.length - 1; i >= 0; i--) {
    const p = confetti[i];

    p.vy += p.grav;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 1;

    push();
    translate(p.x, p.y);
    rotate(p.rot);

    if (useGlow) {
      drawingContext.shadowBlur = 16;
      drawingContext.shadowColor = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},0.22)`;
    } else {
      drawingContext.shadowBlur = 0; // 🚀 removes lag
    }

    noStroke();
    fill(p.c[0], p.c[1], p.c[2], map(p.life, 0, 85, 0, 180));
    rectMode(CENTER);
    rect(0, 0, p.size * 1.6, p.size * 0.9, 2);
    pop();

    if (p.life <= 0 || p.y > height + 30) {
      confetti.splice(i, 1);
    }
  }
}


/* ================= RESIZE (NEW) =================
   Keeps it usable on mobile sizes.
*/
function windowResized() {
  const { w, h } = getCanvasSize();
  resizeCanvas(w, h);

  // Snap camera to avoid jitter
  if (viewMode === "all") {
    targetCamScale = computeAutoScale();
    camScale = targetCamScale;
  } else {
    targetCamScale = 1;
    camScale = 1;
  }

  seedSparkles(false);
}


function setViewMode(mode) {
  viewMode = mode;

  // Snap camera immediately to avoid rubber-band zoom
  if (mode === "focus") {
    targetCamScale = 1;
    camScale = 1;
  } else {
    targetCamScale = computeAutoScale();
    camScale = targetCamScale;
  }

  // Cancel pulses so they don’t fight the transition
  levelPulse = 0;
  glowPulse = 0;
}


function toggleViewMode() {
  if (viewMode === "focus") {
    setViewMode("all");
    document.getElementById("viewToggleBtn").innerText = "Focus";
  } else {
    setViewMode("focus");
    document.getElementById("viewToggleBtn").innerText = "Show All";
  }
}
