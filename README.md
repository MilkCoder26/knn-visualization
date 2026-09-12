# KNN Lab

Web interface to visualize a KNN (k-nearest-neighbors) model: upload a CSV
dataset, plot the decision boundary, and watch an animation of the
neighbors when you click on a new point.

This repo contains only the **frontend**. The KNN computation happens on
the backend, in a separate repo: [knn-visualization-api](https://github.com/MilkCoder26/knn-visualization-api.git).

## Prerequisites

First, install **uv** (the Python package/environment manager used by the
backend):

**macOS / Linux**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows (PowerShell)**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Cross-platform alternative (if you already have Python/pipx)**
```bash
pipx install uv
# or
pip install uv
```

Check the installation:
```bash
uv --version
```

You'll also need a modern browser and, optionally, [VS Code](https://code.visualstudio.com/)
with the **Live Server** extension to serve the frontend locally.

## Installation

Clone both repos, side by side:

```bash
git clone https://github.com/MilkCoder26/knn-visualization.git
git clone https://github.com/MilkCoder26/knn-visualization-api.git
```

Then install the backend's dependencies with uv:

```bash
cd knn-visualization-api
uv sync
```

`uv sync` reads the project's dependency file and automatically creates a
virtual environment with everything it needs (FastAPI, Uvicorn, etc.).

## Running the backend

Still from the backend folder:

```bash
uv run fastapi dev
```

The server starts by default on `http://127.0.0.1:8000`, with auto-reload
on every change. Interactive API docs are available at
`http://127.0.0.1:8000/docs`.

Keep this terminal open while you use the frontend.

## Running the frontend

From this repo's folder (`knn-visualization`), two options:

**Option 1 — VS Code + Live Server (recommended)**
1. Open the folder in VS Code.
2. Install the **Live Server** extension (Ritwick Dey) if you don't have it yet.
3. Right-click `index.html` → **Open with Live Server**.
4. Your browser opens automatically (usually at `http://127.0.0.1:5500`).

**Option 2 — open the file directly**
Just double-click `index.html`. Since the backend allows CORS from any
origin, this also works without a local server.

## Usage

1. Make sure the backend is running (`http://127.0.0.1:8000/health` should
   respond `{"status":"ok"}`).
2. Drop your `.csv` file into the upload zone (last column = label, all
   other columns must be numeric).
3. Pick the two columns to plot on the X and Y axes.
4. Adjust `k` and the distance metric, then click **Recalculer la
   frontière** (recompute the boundary).
5. Click anywhere on the chart to test a new point and watch the neighbor
   animation and final vote in the logbook panel.
6. Use **Évaluer sur données réelles** (evaluate on real data) to measure
   the model's accuracy on an 80/20 split using all columns of the dataset.

A sample dataset (`sample-flowers.csv`, synthetic Iris-like data) is
included in this repo so you can try it right away.

## Configuration

If your backend isn't running on `http://127.0.0.1:8000`, update the
`BACKEND_URL` constant at the top of `app.js`.
