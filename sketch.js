/* ================= CONFIG ================= */
const ROWS = 6;
const SIZE = 40;
const H = SIZE * Math.sqrt(3) / 2;
const MAX_TRIANGLES = ROWS * ROWS;

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

/* ================= PRELOAD ================= */
function preload() {
  rewardSound = new p5.Oscillator("triangle");
  osc1 = new p5.Oscillator("sine");
  osc2 = new p5.Oscillator("sine");
  osc3 = new p5.Oscillator("sine");
}

/* ================= SETUP ================= */
function setup() {
  createCanvas(700, 500).parent("canvas-container");

  [rewardSound, osc1, osc2, osc3].forEach(o => {
    o.start();
    o.amp(0);
  });

  loadData();
  updateStatus();

  document.getElementById("addBtn").onclick = addProgress;
  document.getElementById("focusBtn").onclick = () => viewMode = "focus";
  document.getElementById("showAllBtn").onclick = () => viewMode = "all";
  document.getElementById("resetBtn").onclick = resetAll;
  document.getElementById("themeBtn").onclick = cycleTheme;
}

/* ================= DRAW ================= */
function draw() {
  background(255);

  camScale = lerp(camScale, targetCamScale, 0.08);

  if (levelPulse > 0.01) {
    camScale *= 1 + levelPulse * 0.05;
    levelPulse *= 0.88;
  }

  push();
  translate(width / 2, 90);
  scale(camScale);

  viewMode === "all" ? drawAllPyramids() : drawActivePyramid();
  pop();

  if (viewMode === "focus") drawFocusInfo();
}

/* ================= DRAW PYRAMIDS ================= */
function drawActivePyramid() {
  targetCamScale = 1;
  drawPyramid(active, false, pyramids.length);
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

      let glow = theme.glow;
      drawingContext.shadowBlur = index === pyramids.length ? 10 : 6;
      drawingContext.shadowColor = `rgba(${glow[0]},${glow[1]},${glow[2]},0.4)`;

      stroke(glow[0], glow[1], glow[2], 140);
      strokeWeight(index === pyramids.length ? 1.8 : 1.2);
      fill(up ? theme.fill : theme.inverted);

      up
        ? triangle(x, y + H, x + SIZE / 2, y, x + SIZE, y + H)
        : triangle(x, y, x + SIZE, y, x + SIZE / 2, y + H);

      count++;
    }
  }
}

/* ================= PROGRESS ================= */
function addProgress() {
  active.push(1);
  playReward();

  let before = getLevelInfo().level;

  if (active.length === MAX_TRIANGLES) {
    pyramids.push([...active]);
    active = [];
    playCompletionChord();
  }

  let after = getLevelInfo().level;
  if (after > before) {
    levelPulse = 1;
    playLevelUpSound();
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

  document.getElementById("statusText").innerText =
    `Level ${info.level} — ${info.xp}/${info.next} XP | Active: ${active.length} | Completed: ${pyramids.length}`;

  let pct = (into / size) * 100;

/* UX FIX:
   If next action completes the level,
   show the bar as full */
if (info.xp + 1 >= info.next) {
  pct = 100;
}

document.getElementById("xp-bar").style.width =
  constrain(pct, 0, 100) + "%";

}

function drawFocusInfo() {
  fill(50);
  textAlign(CENTER);
  textSize(15);
  text(
    `Pyramid ${pyramids.length + 1}\n${active.length}/${MAX_TRIANGLES} triangles`,
    width / 2,
    height - 60
  );
}

/* ================= UTIL ================= */
function computeAutoScale() {
  let rows = Math.ceil(Math.sqrt(pyramids.length + 1));
  let pw = SIZE * ROWS;
  let ph = H * ROWS;
  return min((width * 0.75) / ((2 * rows - 1) * pw / 2), (height * 0.75) / (rows * ph), 1);
}

function cycleTheme() {
  let keys = Object.keys(THEMES);
  currentTheme = keys[(keys.indexOf(currentTheme) + 1) % keys.length];
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
  rewardSound.freq(random(700, 900));
  rewardSound.amp(0.4, 0.01);
  rewardSound.amp(0, 0.2);
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
