# 🔴 MAREX — Martian Area Risk Evaluation eXplorer

<div align="center">

<!-- 🖼️ ضع صورة بانر عريضة (حوالي 1600×500) في docs/screenshots/banner.png -->
<img src="docs/screenshots/banner.png" alt="MAREX – Martian Area Risk Evaluation eXplorer" width="100%">

**An interactive web map for exploring Mars terrain, comparing landing sites and evaluating surface risk — right in your browser.**

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Visit_Site-c1440e?style=for-the-badge)](https://abdulrahmanalainfc-pixel.github.io/martian-map-/)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)
![NASA Trek](https://img.shields.io/badge/Data-NASA_Trek-0B3D91?logo=nasa&logoColor=white)
![No build](https://img.shields.io/badge/Build-None-brightgreen)
![NASA Space Apps](https://img.shields.io/badge/NASA_Space_Apps-2026-0078D4)
![AI-assisted](https://img.shields.io/badge/AI--Assisted-8A2BE2)

[Live Demo](#-live-demo) · [Features](#-features) · [Screenshots](#-screenshots) · [Getting Started](#-getting-started) · [AI Disclosure](#-ai-disclosure)

</div>

---

## 📖 About

**MAREX** is a lightweight, dependency-free web application that lets you explore the surface of Mars on an interactive map. It is built on **Leaflet** and powered by **NASA Solar System Treks** map tiles, combining terrain layers, points of interest, hazard overlays and measurement tools in one clean interface.

The goal is simple: make Martian terrain data **easy to explore, easy to understand, and useful for evaluating where it is safe to land or travel**.

> 💡 It runs from a single HTML file. **No server, no build tools, no installation.**

---

## 🌐 Live Demo

👉 **[Open MAREX](https://abdulrahmanalainfc-pixel.github.io/martian-map-/)**

> The demo is hosted on GitHub Pages. To enable it: **Settings → Pages → Deploy from branch → `main` / root**.

---

## ✨ Features

| | Feature | Description |
|---|---------|-------------|
| 🗺️ | **Interactive Mars map** | Smooth pan and zoom over real NASA Trek Mars tiles |
| 🧱 | **Multiple base layers** | Switch between terrain and surface base layers, plus toggleable overlays |
| ⛰️ | **Terrain analysis** | Slope and elevation evaluation built into the map |
| 🌦️ | **Weather layer** | Mars weather context to support risk assessment |
| 📍 | **Sites of interest** | Browse landing sites and notable locations on the planet |
| ⚠️ | **Hazard overlays** | Visualize risk areas to support landing and route decisions |
| 🔎 | **Terrain inspector** | Click anywhere to inspect the coordinates and data at that point |
| 🧭 | **Route planning** | Draw a path between two points and see its details |
| 📏 | **Measure tool** | Measure distances and areas directly on the map |
| 🔍 | **Search** | Jump quickly to a named location or coordinates |
| 🎨 | **Clean UI/UX** | Responsive, modern interface that works on desktop and mobile |

---

## 📸 Screenshots

<!-- 📁 ضع الصور داخل docs/screenshots/ -->
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
<summary>🎬 Demo GIF</summary>
<br>
<img src="docs/screenshots/demo.gif" alt="MAREX demo" width="100%">
</details>

---

## 🚀 Getting Started

### Option 1: Just open it (easiest)

1. Clone the repository:
   ```bash
   git clone https://github.com/abdulrahmanalainfc-pixel/martian-map-.git
   cd martian-map-
   ```
2. Open **`marex.html`** in any modern browser (Chrome, Edge, Firefox, Safari).

> An internet connection is needed to load the map tiles and the Leaflet library.

### Option 2: Run with a local server

Useful if your browser blocks some features when opening files directly:

```bash
# Python
python -m http.server 8000

# or Node.js
npx serve .
```

Then visit **http://localhost:8000/marex.html**.

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

- **[Leaflet](https://leafletjs.com/)** — interactive mapping library
- **[NASA Solar System Treks](https://trek.nasa.gov/)** — Mars map tiles and terrain data
- **Vanilla JavaScript (ES modules)** — no framework, no build step
- **HTML5 & CSS3**

---

## 📁 Project Structure

```text
martian-map-/
├── marex.html          # Entry point (the whole app loads from here)
├── css/
│   └── style.css       # Styling
├── js/
│   ├── config.js       # Settings and constants
│   ├── utils.js        # Helper and math functions
│   ├── state.js        # App state
│   ├── mapview.js      # Map setup
│   ├── tiles.js        # NASA Trek tile sources
│   ├── layers.js       # Base layers and overlays
│   ├── terrain.js      # Slope / elevation analysis
│   ├── weather.js      # Mars weather layer
│   ├── sites.js        # Points of interest
│   ├── hazards.js      # Risk / hazard data
│   ├── inspector.js    # Point inspector
│   ├── route.js        # Route planning
│   ├── measure.js      # Distance / area tools
│   ├── search.js       # Search
│   ├── ui.js           # Interface components
│   └── main.js         # App bootstrap
├── assets/             # Visual resources (images, icons, UI graphics)
├── data/               # NASA datasets (elevation, terrain, slope…)
└── docs/
    └── screenshots/    # Images used in this README
```

---

## 🤖 AI Disclosure

Transparency matters to us, so here is exactly how AI was used in this project.

**We used AI tools as a development assistant** for parts of this project, including:

- 🔍 Code review and auditing of the logic and calculations
- 🐛 Finding and fixing bugs
- 💡 Brainstorming and implementing features
- 🎨 UI/UX suggestions and polish
- 📝 Help writing documentation, including this README

**What this means in practice:**

- The idea, direction, design decisions and final choices are **ours**.
- AI-generated suggestions were **reviewed, tested and edited** by the team before being included.
- We are **responsible for the final result**, including any remaining mistakes.

If you spot a bug or an inaccuracy, please [open an issue](../../issues).

---

## 🙏 Credits & Data Sources

- Map tiles and imagery: **[NASA Solar System Treks (Mars Trek)](https://trek.nasa.gov/)**, courtesy of NASA/JPL-Caltech and the mission teams behind the datasets.
- Mapping library: **[Leaflet](https://leafletjs.com/)** (BSD-2-Clause license).
- Project built for the **NASA Space Apps Challenge 2026**.
- AI assistance used in development, as detailed in the [AI Disclosure](#-ai-disclosure) section.

> ⚠️ This is an educational project. It is **not** an official NASA product, and its risk evaluations should **not** be used for real mission planning.

---

## 🗺️ Roadmap

- [ ] Add real NASA elevation datasets to `data/`
- [ ] Landing-site comparison scoring
- [ ] Export map snapshots as images
- [ ] Offline mode with cached tiles

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

- **Abdulrahman** — [@abdulrahmanalainfc-pixel](https://github.com/abdulrahmanalainfc-pixel)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">

**Made with ❤️ and a lot of curiosity about the Red Planet 🔴**

</div>
