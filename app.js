// -----------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------
const BACKEND_URL = "http://127.0.0.1:8000"; // change si le backend tourne ailleurs

const CLASS_COLORS = ["#2C5F8A", "#A63446", "#C98A2B", "#4C7A57", "#6C4F77"];
const PADDING_RATIO = 0.12;
const GRID_RESOLUTION = 55;

// -----------------------------------------------------------------------
// State
// -----------------------------------------------------------------------
const state = {
  header: null,
  xTrainFull: null, // toutes les colonnes numériques
  yTrainFull: null,
  featureIndex: { x: 0, y: 1 },
  k: 3,
  distanceFn: "euclidian",
  colorByLabel: new Map(),
  transform: null, // { toPixel(dataX, dataY), toData(px, py) }
  trainPointsPixel: [], // [{x,y,label,point}] pour dessiner les lignes de voisinage
};

// -----------------------------------------------------------------------
// DOM refs
// -----------------------------------------------------------------------
const el = {
  dropzone: document.getElementById("dropzone"),
  dropzoneLabel: document.getElementById("dropzone-label"),
  fileInput: document.getElementById("file-input"),
  datasetStatus: document.getElementById("dataset-status"),
  featurePanel: document.getElementById("feature-panel"),
  featureX: document.getElementById("feature-x"),
  featureY: document.getElementById("feature-y"),
  paramsPanel: document.getElementById("params-panel"),
  kSlider: document.getElementById("k-slider"),
  kValue: document.getElementById("k-value"),
  distanceFn: document.getElementById("distance-fn"),
  redrawBtn: document.getElementById("redraw-btn"),
  evalPanel: document.getElementById("eval-panel"),
  evalBtn: document.getElementById("eval-btn"),
  evalResult: document.getElementById("eval-result"),
  canvas: document.getElementById("plot"),
  canvasHint: document.getElementById("canvas-hint"),
  legend: document.getElementById("legend"),
  logEntries: document.getElementById("log-entries"),
  voteResult: document.getElementById("vote-result"),
};

const ctx = el.canvas.getContext("2d");

// -----------------------------------------------------------------------
// Upload
// -----------------------------------------------------------------------
el.dropzone.addEventListener("click", () => el.fileInput.click());
el.dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  el.dropzone.classList.add("dragover");
});
el.dropzone.addEventListener("dragleave", () =>
  el.dropzone.classList.remove("dragover"),
);
el.dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  el.dropzone.classList.remove("dragover");
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
el.fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) handleFile(e.target.files[0]);
});

async function handleFile(file) {
  el.dropzoneLabel.textContent = file.name;
  setStatus("Envoi au backend…");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${BACKEND_URL}/dataset/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    if (!data.x_train.length || data.x_train[0].length < 2) {
      setStatus(
        "Le fichier doit avoir au moins 2 colonnes numériques + 1 colonne label.",
        true,
      );
      return;
    }

    state.header = data.header;
    state.xTrainFull = data.x_train;
    state.yTrainFull = data.y_train;

    const classes = [...new Set(state.yTrainFull)];
    classes.forEach((c, i) =>
      state.colorByLabel.set(c, CLASS_COLORS[i % CLASS_COLORS.length]),
    );

    setStatus(
      `${data.x_train.length} observations · ${classes.length} classes · ${state.header.length - 1} colonnes`,
    );
    populateFeatureSelects();

    el.featurePanel.hidden = false;
    el.paramsPanel.hidden = false;
    el.evalPanel.hidden = false;

    drawEverything();
  } catch (err) {
    console.error(err);
    setStatus(
      `Erreur : impossible de joindre le backend (${BACKEND_URL}). Vérifie qu'il tourne.`,
      true,
    );
  }
}

function setStatus(msg, isError = false) {
  el.datasetStatus.textContent = msg;
  el.datasetStatus.style.color = isError ? "#D77" : "";
}

function populateFeatureSelects() {
  const featureNames = state.header.slice(0, -1);
  [el.featureX, el.featureY].forEach((select) => (select.innerHTML = ""));
  featureNames.forEach((name, i) => {
    el.featureX.add(new Option(name, i));
    el.featureY.add(new Option(name, i));
  });
  el.featureX.value = 0;
  el.featureY.value = featureNames.length > 1 ? 1 : 0;
  state.featureIndex = { x: 0, y: featureNames.length > 1 ? 1 : 0 };
}

// -----------------------------------------------------------------------
// Controls
// -----------------------------------------------------------------------
el.featureX.addEventListener("change", () => {
  state.featureIndex.x = Number(el.featureX.value);
  drawEverything();
});
el.featureY.addEventListener("change", () => {
  state.featureIndex.y = Number(el.featureY.value);
  drawEverything();
});
el.kSlider.addEventListener("input", () => {
  el.kValue.textContent = el.kSlider.value;
});
el.kSlider.addEventListener("change", () => {
  state.k = Number(el.kSlider.value);
  drawEverything();
});
el.distanceFn.addEventListener("change", () => {
  state.distanceFn = el.distanceFn.value;
  drawEverything();
});
el.redrawBtn.addEventListener("click", drawEverything);

// -----------------------------------------------------------------------
// Reduced 2D dataset (selon les 2 colonnes choisies)
// -----------------------------------------------------------------------
function reduced2D() {
  const { x, y } = state.featureIndex;
  return state.xTrainFull.map((row) => [row[x], row[y]]);
}

// -----------------------------------------------------------------------
// Dessin : frontière de décision + points
// -----------------------------------------------------------------------
async function drawEverything() {
  if (!state.xTrainFull) return;
  el.canvasHint.textContent = "Calcul de la frontière…";
  el.canvasHint.hidden = false;

  const points2D = reduced2D();
  const xs = points2D.map((p) => p[0]);
  const ys = points2D.map((p) => p[1]);
  const xMin = Math.min(...xs),
    xMax = Math.max(...xs);
  const yMin = Math.min(...ys),
    yMax = Math.max(...ys);
  const xPad = (xMax - xMin) * PADDING_RATIO || 1;
  const yPad = (yMax - yMin) * PADDING_RATIO || 1;
  const bounds = {
    xMin: xMin - xPad,
    xMax: xMax + xPad,
    yMin: yMin - yPad,
    yMax: yMax + yPad,
  };

  setTransform(bounds);

  try {
    const res = await fetch(`${BACKEND_URL}/decision-boundary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x_train: points2D,
        y_train: state.yTrainFull,
        k: state.k,
        distance_fn: state.distanceFn,
        x_min: bounds.xMin,
        x_max: bounds.xMax,
        y_min: bounds.yMin,
        y_max: bounds.yMax,
        resolution: GRID_RESOLUTION,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const boundary = await res.json();

    paintCanvas(boundary, points2D);
    el.canvasHint.hidden = true;
  } catch (err) {
    console.error(err);
    el.canvasHint.textContent = "Erreur lors du calcul de la frontière.";
  }

  clearLog();
}

function setTransform(bounds) {
  const w = el.canvas.width,
    h = el.canvas.height;
  const toPixel = (dx, dy) => [
    ((dx - bounds.xMin) / (bounds.xMax - bounds.xMin)) * w,
    h - ((dy - bounds.yMin) / (bounds.yMax - bounds.yMin)) * h,
  ];
  const toData = (px, py) => [
    bounds.xMin + (px / w) * (bounds.xMax - bounds.xMin),
    bounds.yMin + ((h - py) / h) * (bounds.yMax - bounds.yMin),
  ];
  state.transform = { toPixel, toData, bounds };
}

function paintCanvas(boundary, points2D) {
  state.lastBoundary = boundary;
  const w = el.canvas.width,
    h = el.canvas.height;
  ctx.clearRect(0, 0, w, h);

  // heatmap
  const cellW = w / boundary.grid_x.length;
  const cellH = h / boundary.grid_y.length;
  for (let row = 0; row < boundary.predictions.length; row++) {
    for (let col = 0; col < boundary.predictions[row].length; col++) {
      const label = boundary.predictions[row][col];
      ctx.fillStyle = hexToRgba(colorFor(label), 0.16);
      const px = col * cellW;
      const py = h - (row + 1) * cellH;
      ctx.fillRect(px, py, cellW + 1, cellH + 1);
    }
  }

  // training points
  state.trainPointsPixel = [];
  points2D.forEach((p, i) => {
    const label = state.yTrainFull[i];
    const [px, py] = state.transform.toPixel(p[0], p[1]);
    state.trainPointsPixel.push({ x: px, y: py, label, point: p });
    drawDot(px, py, colorFor(label), 5);
  });

  renderLegend();
}

function drawDot(px, py, color, r) {
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#EDEAE0";
  ctx.stroke();
}

function colorFor(label) {
  if (!state.colorByLabel.has(label)) {
    state.colorByLabel.set(
      label,
      CLASS_COLORS[state.colorByLabel.size % CLASS_COLORS.length],
    );
  }
  return state.colorByLabel.get(label);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderLegend() {
  el.legend.innerHTML = "";
  state.colorByLabel.forEach((color, label) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `<span class="legend-swatch" style="background:${color}"></span>${label}`;
    el.legend.appendChild(item);
  });
}

// -----------------------------------------------------------------------
// Clic sur le graphe → test d'un nouveau point + animation des voisins
// -----------------------------------------------------------------------
el.canvas.addEventListener("click", async (e) => {
  if (!state.transform) return;
  const rect = el.canvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (el.canvas.width / rect.width);
  const py = (e.clientY - rect.top) * (el.canvas.height / rect.height);
  const [dataX, dataY] = state.transform.toData(px, py);

  await runNeighborQuery([dataX, dataY], px, py);
});

async function runNeighborQuery(point, px, py) {
  clearLog();
  el.voteResult.hidden = true;

  try {
    const res = await fetch(`${BACKEND_URL}/neighbors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x_train: reduced2D(),
        y_train: state.yTrainFull,
        k: state.k,
        distance_fn: state.distanceFn,
        point,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();

    // redessine le fond propre avant l'animation
    redrawStaticLayer();
    drawDot(px, py, "#16212B", 6);

    animateNeighbors(data.neighbors, px, py, data.prediction);
  } catch (err) {
    console.error(err);
    appendLogLine("Erreur lors de la requête au backend.", false);
  }
}

function redrawStaticLayer() {
  // redessine la heatmap + les points déjà calculés, sans re-solliciter le backend
  if (state.lastBoundary) {
    paintCanvas(state.lastBoundary, reduced2D());
  }
}

function animateNeighbors(neighbors, testPx, testPy, prediction) {
  clearLog();
  let i = 0;
  const step = () => {
    if (i >= neighbors.length) {
      showVoteResult(prediction);
      return;
    }
    const n = neighbors[i];
    const [nx, ny] = state.transform.toPixel(n.point[0], n.point[1]);

    ctx.beginPath();
    ctx.moveTo(testPx, testPy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = n.is_selected ? colorFor(n.label) : "rgba(22,33,43,0.15)";
    ctx.lineWidth = n.is_selected ? 2 : 1;
    ctx.stroke();

    appendLogLine(`${n.label} · d=${n.distance.toFixed(3)}`, n.is_selected);

    i++;
    setTimeout(step, n.is_selected ? 160 : 25);
  };
  step();
}

function appendLogLine(text, selected) {
  const line = document.createElement("div");
  line.className = "log-entry" + (selected ? " selected" : "");
  line.textContent = text;
  el.logEntries.appendChild(line);
  el.logEntries.scrollTop = el.logEntries.scrollHeight;
}

function clearLog() {
  el.logEntries.innerHTML = "";
  el.voteResult.hidden = true;
}

function showVoteResult(prediction) {
  el.voteResult.hidden = false;
  el.voteResult.innerHTML = `
    <p class="label">Vote des ${state.k} voisins</p>
    <p class="value" style="color:${colorFor(prediction)}">${prediction}</p>
  `;
}

// -----------------------------------------------------------------------
// Évaluation : split 80/20 sur TOUTES les colonnes (pas juste les 2 tracées)
// -----------------------------------------------------------------------
el.evalBtn.addEventListener("click", async () => {
  if (!state.xTrainFull) return;
  el.evalResult.textContent = "Évaluation en cours…";

  const n = state.xTrainFull.length;
  const indices = [...Array(n).keys()];
  shuffle(indices);
  const splitAt = Math.floor(n * 0.8);
  const trainIdx = indices.slice(0, splitAt);
  const testIdx = indices.slice(splitAt);

  if (testIdx.length === 0) {
    el.evalResult.textContent = "Dataset trop petit pour un split 80/20.";
    return;
  }

  const payload = {
    x_train: trainIdx.map((i) => state.xTrainFull[i]),
    y_train: trainIdx.map((i) => state.yTrainFull[i]),
    k: state.k,
    distance_fn: state.distanceFn,
    x_test: testIdx.map((i) => state.xTrainFull[i]),
  };

  try {
    const res = await fetch(`${BACKEND_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    const { predictions } = await res.json();

    const actual = testIdx.map((i) => state.yTrainFull[i]);
    const correct = predictions.filter((p, i) => p === actual[i]).length;
    const accuracy = (correct / actual.length) * 100;

    el.evalResult.textContent = `${accuracy.toFixed(1)}% (${correct}/${actual.length}) — toutes colonnes, k=${state.k}`;
  } catch (err) {
    console.error(err);
    el.evalResult.textContent = "Erreur pendant l'évaluation.";
  }
});

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
