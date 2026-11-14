<div align="center">

<!-- 🖼️ BANNER: put a wide screenshot (about 1600×500) at docs/screenshots/banner.png -->
<img src="docs/screenshots/banner.png" alt="MAREX – Martian Area Risk Evaluation eXplorer" width="100%">

# 🔴 MAREX
### Martian Area Risk Evaluation eXplorer

**An interactive web map for exploring Mars terrain, comparing landing sites and evaluating surface risk, right in your browser.**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-199900?logo=leaflet&logoColor=white)
![NASA Trek](https://img.shields.io/badge/Data-NASA%20Trek-0B3D91?logo=nasa&logoColor=white)
![No build step](https://img.shields.io/badge/build-none-brightgreen)
![AI-assisted](https://img.shields.io/badge/AI-assisted-8A2BE2)

[Live Demo](#-live-demo) · [Features](#-features) · [Screenshots](#-screenshots) · [Getting Started](#-getting-started) · [AI Disclosure](#-ai-disclosure)

</div>

---

## 📖 About

**MAREX** is a lightweight, dependency-free web application that lets you explore the surface of Mars on an interactive map. It is built on **Leaflet** and uses **NASA Trek** map tiles, and it combines terrain layers, points of interest, hazard overlays and measurement tools in one clean interface.

The goal is simple: make Martian terrain data **easy to explore, easy to understand, and useful for evaluating where it is safe to land or travel**.

> 💡 It runs from a single HTML file. No server, no build tools, no installation.

---

## 🌐 Live Demo

<!-- Enable GitHub Pages: Settings → Pages → Deploy from branch → main / root -->
👉 **[Open MAREX](https://abdulrahmanalainfc-pixel.github.io/martian-map-/)**

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🗺️ | **Interactive Mars map** | Smooth pan and zoom over real NASA Trek Mars tiles |
| 🧱 | **Multiple layers** | Switch between terrain and surface base layers and toggle overlays |
| 📍 | **Sites of interest** | Browse landing sites and notable locations on the planet |
| ⚠️ | **Hazard overlays** | Visualize risk areas to support landing and route decisions |
| 🔎 | **Terrain inspector** | Click anywhere to inspect the coordinates and data at that point |
| 🧭 | **Route planning** | Draw a path between two points and see its details |
| 📏 | **Measure tool** | Measure distances and areas directly on the map |
| 🔍 | **Search** | Jump quickly to a named location or coordinates |
| 🎨 | **Clean UI/UX** | Responsive, modern interface that works on desktop and mobile |

<!-- ✏️ Edit this table so it matches exactly what your final version does. -->

---

## 📸 Screenshots

<div align="center">

| Main map view | Layers panel |
|:---:|:---:|
| <img src="docs/screenshots/map-overview.png" alt="Main map view" width="100%"> | <img src="docs/screenshots/layers.png" alt="Layers panel" width="100%"> |

| Hazard overlay | Terrain inspector |
|:---:|:---:|
| <img src="docs/screenshots/hazards.png" alt="Hazard overlay" width="100%"> | <img src="docs/screenshots/inspector.png" alt="Terrain inspector" width="100%"> |

| Route planning | Measure tool |
|:---:|:---:|
| <img src="docs/screenshots/route.png" alt="Route planning" width="100%"> | <img src="docs/screenshots/measure.png" alt="Measure tool" width="100%"> |

</div>

<details>
<summary>🎬 Demo GIF (optional)</summary>

<br>

<img src="docs/screenshots/demo.gif" alt="MAREX demo" width="100%">

</details>

---

## 🚀 Getting Started

### Option 1: Just open it (easiest)

1. Download or clone the repository:
   ```bash
   git clone https://github.com/abdulrahmanalainfc-pixel/martian-map-.git
   cd martian-map-
   ```
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).

An internet connection is needed to load the map tiles and the Leaflet library.

### Option 2: Run with a local server

Useful if your browser blocks some features when opening files directly:

```bash
# Python
python -m http.server 8000

# or Node.js
npx serve .
```

Then visit **http://localhost:8000**.

---

## 🕹️ How to Use

1. **Pan and zoom** with the mouse, touch, or the on-screen controls.
2. **Open the layers panel** to change the base map and toggle overlays.
3. **Click a site marker** to see its details.
4. **Use the inspector** to read data at any point on the surface.
5. **Plan a route** or **measure** distances using the toolbar tools.
6. **Search** for a place or coordinates from the search box.

---

## 🧱 Tech Stack

- **[Leaflet](https://leafletjs.com/)** for the interactive map
- **[NASA Solar System Treks](https://trek.nasa.gov/)** for Mars map tiles
- **Vanilla JavaScript (ES modules)** with no framework and no build step
- **HTML5 and CSS3**

---

## 📁 Project Structure

```text
martian-map-/
├── index.html          # Entry point
├── css/
│   └── style.css       # Styling
├── js/
│   ├── config.js       # Settings and constants
│   ├── utils.js        # Helper and math functions
│   ├── state.js        # App state
│   ├── mapview.js      # Map setup
│   ├── layers.js       # Base layers and overlays
│   ├── sites.js        # Points of interest
│   ├── hazards.js      # Risk / hazard data
│   ├── inspector.js    # Point inspector
│   ├── route.js        # Route planning
│   ├── measure.js      # Distance / area tools
│   ├── search.js       # Search
│   ├── ui.js           # Interface components
│   └── main.js         # App bootstrap
└── docs/
    └── screenshots/    # Images used in this README
```

<!-- ✏️ Adjust to your real folder layout. If you ship only one HTML file, replace this tree with that file. -->

---

## 🤖 AI Disclosure

Transparency matters to us, so here is how AI was used in this project.

**We used AI tools (Anthropic's Claude) as a development assistant** for parts of this project, including:

- 🔍 Code review and auditing of the logic and calculations
- 🐛 Finding and fixing bugs
- 💡 Brainstorming and implementing features
- 🎨 UI/UX suggestions and polish
- 📝 Help writing documentation, including this README

**What this means in practice:**

- The idea, direction, design decisions and final choices are ours.
- AI-generated suggestions were reviewed, tested and edited by the team before being included.
- We are responsible for the final result, including any remaining mistakes.

If you spot a bug or an inaccuracy, please [open an issue](../../issues).

---

## 🙏 Credits and Data Sources

- Map tiles and imagery: **NASA Solar System Treks (Mars Trek)**, courtesy of NASA/JPL-Caltech and the mission teams behind the datasets.
- Mapping library: **[Leaflet](https://leafletjs.com/)** (BSD-2-Clause license).
- AI assistance: **[Claude](https://www.anthropic.com/claude)** by Anthropic.

> This is an educational project. It is **not** an official NASA product, and its risk evaluations should **not** be used for real mission planning.

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "Add my feature"`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 👥 Team

<!-- ✏️ Add your names and links -->
- **Abdulrahman** ([@abdulrahmanalainfc-pixel](https://github.com/abdulrahmanalainfc-pixel))

---

## 📄 License

This project is licensed under the **MIT License**, see the [LICENSE](LICENSE) file for details.

<!-- ✏️ If you don't have a LICENSE file yet: GitHub → Add file → Create new file → name it LICENSE → choose a template. -->

<div align="center">

**Made with ❤️ and a lot of curiosity about the Red Planet 🔴**

</div>
