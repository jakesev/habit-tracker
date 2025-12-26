/* ================= CONFIG ================= */
const ROWS = 6;
const SIZE = 40;
const H = SIZE * Math.sqrt(3) / 2;
const MAX_TRIANGLES = ROWS * ROWS;

/* ================= COLOUR THEMES ================= */
const THEMES = {
  green: {
    active: "#66BB6A",
    recent: "#81C784",
    settled: "#4CAF50",
    inverted: "#A5D6A7",
    stroke: "rgba(0,0,0,0.35)"
  },
  blue: {
    active: "#42A5F5",
    recent: "#64B5F6",
    settled: "#1E88E5",
    inverted: "#90CAF9",
    stroke: "rgba(0,0,0,0.35)"
  },
  purple: {
    active: "#AB47BC",
    recent: "#BA68C8",
    settled: "#8E24AA",
    inverted: "#CE93D8",
    stroke: "rgba(0,0,0,0.35)"
  },
  amber: {
    active: "#FFB300",
    recent: "#FFD54F",
    settled: "#FFA000",
    inverted: "#FFE082",
    stroke: "rgba(0,0,0,0.35)"
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

/* ================= LEVEL ANIM ================= */
let lastLevel = 0;
let levelPulse = 0; // 0..1

/* ================= SOUND ================= */
let rewardSound;
let completeOsc1, completeOsc2, completeOsc3;

/* ================= PRELOAD ================= */
function preload() {
  rewardSound = new p5.Oscillator("triangle");
  completeOsc1 = new p5.Oscillator("sine");
  completeOsc2 = new p5.Oscillator("sine");
  completeOsc3 = new p5.Oscillator("sine");
}

/* ================= SETUP ================= */
function setup() {
  let c = createCanvas(700, 500);
  c.parent("canvas-container");

  rewardSound.start();
  rewardSound.amp(0);

  completeOsc1.start(); completeOsc1.amp(0);
  completeOsc2.start(); completeOsc2.amp(0);
  completeOsc3.start(); completeOsc3.amp(0);

  loadData();

  // set lastLevel from stored XP so it doesn't "level-up" instantly on load
  lastLevel = getLevelInfo().level;

  updateStatus();

  document.getElementById("addBtn").onclick = addProgress;
  document.getElementById("focusBtn").onclick = () => viewMode = "focus";
  document.getElementById("showAllBtn").onclick = () => viewMode = "all";
  document.getElementById("resetBtn").onclick = resetAll;
}

/* ================= DRAW ================= */
function draw() {
  background(255);

  // Smooth camera
  camScale = lerp(camScale, targetCamScale, 0.08);

  // Level pulse (small camera pop)
  if (levelPulse > 0.001) {
    levelPulse *= 0.90;
    camScale *= (1 + levelPulse * 0.06);
  } else {
    levelPulse = 0;
  }

  push();
  translate(width / 2, 80);
  scale(camScale);

  if (viewMode === "all") drawAllPyramids();
  else drawActivePyramid();

  pop();
}

/* ================= DRAW MODES ================= */
function drawActivePyramid() {
  targetCamScale = 1;
  drawPyramid(active, false);
}

function drawAllPyramids() {
  targetCamScale = computeAutoScale();

  let count = 0;
  let pw = SIZE * ROWS;
  let ph = H * ROWS;

  for (let row = 0; ; row++) {
    let slotsInRow = row * 2 + 1;

    // correct triangular vertical spacing
    let y = row * (ph * 1);


    // center the row
    let startX = -((slotsInRow - 1) * (pw / 2)) / 2;

    for (let i = 0; i < slotsInRow; i++) {
      let x = startX + i * (pw / 2);

      // orientation rule that WORKS for triangular lattices
      let isEdge = i === 0 || i === slotsInRow - 1;
      let up = isEdge || i % 2 === 0;

      if (count < pyramids.length) {
        drawMetaPyramid(pyramids[count], x, y, up);
        count++;
        } else {
        // Only draw active pyramid if this row still has capacity
            if (count < (row + 1) * (row + 1)) {
                drawMetaPyramid(active, x, y, up);
            }
            return;
        }
    }
  }
}

/* ================= META PYRAMID ================= */
function drawMetaPyramid(pyramid, x, y, up) {
  let pw = SIZE * ROWS;
  let ph = H * ROWS;

  push();
  translate(x, y);

  // flip inside slot (doesn't affect layout)
  if (!up) {
    translate(pw / 2, ph / 2);
    scale(1, -1);
    translate(-pw / 2, -ph / 2);
  }

  // inverted meta-slot builds "from the tip" visually
  drawPyramid(pyramid, !up);

  pop();
}

/* ================= PYRAMID ================= */
function drawPyramid(tris, invertBuild = false) {
  let filled = tris.length;
  let threshold = MAX_TRIANGLES - filled;
  let count = 0;

  for (let row = 0; row < ROWS; row++) {
    let inRow = row * 2 + 1;
    let y = row * H;
    let startX = -(inRow * SIZE) / 4;

    for (let i = 0; i < inRow; i++) {
      if (!invertBuild && count >= filled) return;

      // For inverted build, draw only the "last N" cells, which become the "top" after flipping
      if (invertBuild && count < threshold) {
        count++;
        continue;
      }

      let isEdge = i === 0 || i === inRow - 1;
      let up = isEdge || i % 2 === 0;
      let x = startX + i * (SIZE / 2);

      fill(up ? "#4CAF50" : "#A5D6A7");
      stroke(0);

      if (up) triangle(x, y + H, x + SIZE / 2, y, x + SIZE, y + H);
      else triangle(x, y, x + SIZE, y, x + SIZE / 2, y + H);

      count++;
    }
  }
}

/* ================= PROGRESS ================= */
function addProgress() {
  active.push(1);
  playReward();

  // Level up check (based on total XP, not pyramids)
  let before = getLevelInfo().level;

  if (active.length === MAX_TRIANGLES) {
    pyramids.push([...active]);
    active = [];
    playCompletionChord();
  }

  saveData();

  let after = getLevelInfo().level;
  if (after > before) {
    levelPulse = 1;          // start pulse
    playLevelUpSound();      // special sound
    lastLevel = after;
  }

  updateStatus();
}

/* ================= SOUND ================= */
function playReward() {
  rewardSound.freq(random(650, 900));
  rewardSound.amp(0.4, 0.01);
  rewardSound.amp(0, 0.2);
}

function playCompletionChord() {
  completeOsc1.freq(440);
  completeOsc2.freq(554);
  completeOsc3.freq(659);

  completeOsc1.amp(0.3, 0.05);
  completeOsc2.amp(0.3, 0.05);
  completeOsc3.amp(0.3, 0.05);

  completeOsc1.amp(0, 0.6);
  completeOsc2.amp(0, 0.6);
  completeOsc3.amp(0, 0.6);
}

function playLevelUpSound() {
  // slightly brighter "level-up" chord
  completeOsc1.freq(523); // C
  completeOsc2.freq(659); // E
  completeOsc3.freq(784); // G

  completeOsc1.amp(0.35, 0.03);
  completeOsc2.amp(0.35, 0.03);
  completeOsc3.amp(0.35, 0.03);

  completeOsc1.amp(0, 0.7);
  completeOsc2.amp(0, 0.7);
  completeOsc3.amp(0, 0.7);
}

/* ================= LEVEL SYSTEM ================= */
function getTotalXP() {
  return pyramids.length * MAX_TRIANGLES + active.length;
}

function getLevelInfo() {
  let xp = getTotalXP();

  // Level is the largest L such that L(L+1)/2 <= xp
  let level = Math.floor((Math.sqrt(8 * xp + 1) - 1) / 2);

  // next threshold for level+1
  let currentThreshold = (level * (level + 1)) / 2;


  // current threshold for this level
  let nextThreshold = ((level + 1) * (level + 2)) / 2;


  return {
    level,
    xp,
    currentThreshold,
    nextThreshold
  };
}

/* ================= UI ================= */
function updateStatus() {
  let info = getLevelInfo();

  document.getElementById("statusText").innerText =
    `Level ${info.level} — ${info.xp}/${info.nextThreshold} XP ` +
    `(Active: ${active.length} | Completed Pyramids: ${pyramids.length})`;

  // XP bar
  let bar = document.getElementById("xp-bar");
  if (bar) {
    let pct = (info.xp / info.nextThreshold) * 100;
    bar.style.width = constrain(pct, 0, 100) + "%";
  }
}


/* ================= STORAGE ================= */
function saveData() {
  localStorage.setItem("triangleSystem", JSON.stringify({ pyramids, active }));
}

function loadData() {
  let saved = localStorage.getItem("triangleSystem");
  if (saved) {
    let data = JSON.parse(saved);
    pyramids = data.pyramids || [];
    active = data.active || [];
  }
}

/* ================= RESET ================= */
function resetAll() {
  pyramids = [];
  active = [];
  saveData();

  lastLevel = getLevelInfo().level;
  levelPulse = 0;

  updateStatus();
}

/* ================= AUTO CAMERA ================= */
function computeAutoScale() {
  // total meta slots (completed + active)
  let total = pyramids.length + 1;

  // number of meta rows needed (1, 3, 5, ... → r²)
  let rows = Math.ceil(Math.sqrt(total));

  let pw = SIZE * ROWS;
  let ph = H * ROWS;

  // REAL bounds based on YOUR layout
  let totalWidth =
    (2 * rows - 1) * (pw / 2) + pw;

  let totalHeight =
    rows * ph;

  let scaleX = (width * 0.8) / totalWidth;
  let scaleY = (height * 0.8) / totalHeight;

  return min(scaleX, scaleY, 1);
}



function getTriangleColor(isUp, pyramidIndex) {
  let theme = THEMES[currentTheme];

  // Active pyramid
  if (pyramidIndex === pyramids.length) {
    return isUp ? theme.active : theme.inverted;
  }

  // Most recently completed pyramid
  if (pyramidIndex === pyramids.length - 1) {
    return isUp ? theme.recent : theme.inverted;
  }

  // Older pyramids
  return isUp ? theme.settled : theme.inverted;
}
