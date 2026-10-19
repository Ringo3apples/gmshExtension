# Gmsh (Language Support & 3D Interactive Preview)

<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="Gmsh Extension Logo" />
</p>

<p align="center">
  <strong>The definitive Visual Studio Code extension for Gmsh.</strong><br/>
  Featuring comprehensive language support (IntelliSense autocompletion, snippets, hover docs) alongside real-time 3D geometry and finite element mesh visualization.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#snippets--shortcuts">Snippets</a> •
  <a href="#japanese-日本語">日本語ドキュメント</a>
</p>

---

## ✨ Features

### 1. 🧠 Comprehensive Gmsh Language Support (IntelliSense)
- **Keyword & Primitive Autocompletion**: Instant suggestions for `Point`, `Line`, `Circle`, `Spline`, `Curve Loop`, `Plane Surface`, `Surface`, `Volume`, and OpenCASCADE primitives (`Box`, `Cylinder`, `Sphere`, etc.).
- **Dynamic Variable Detection**: Automatically scans your open `.geo` file to suggest user-defined variables and arrays (e.g., `out[]`, `lc`, `r`).
- **Context-Aware Safety**: Autocompletion is intelligently suppressed inside comments (`//`) to prevent unwanted popup interruptions.
- **Hover Documentation**: Hover over any Gmsh command to view its syntax, parameters, and example code in formatted Markdown.
- **Auto-Closing & Indentation Rules**: Optimized brackets, quotes, and `{}` indentation hierarchy tailored for Gmsh syntax.

### 2. ⚡ Real-Time 3D Geometry & Mesh Preview
- **Live Sync**: As you edit `.geo` files, the 3D preview automatically updates in milliseconds (debounced).
- **Two-Way Code Navigation**: Click on any point, curve, or surface in the 3D viewport to immediately jump and focus the editor cursor on its definition line!
- **Mesh Dimension Switching**: Toggle between 0D (geometry points/curves), 1D (line elements), 2D (surface triangles/quads), and 3D (volume tetrahedra/hexahedra).
- **3D Entity Labels**: Visual tags for points (`P1`, `P2`...) and curves (`C1`, `C2`...) directly overlaid in 3D space.
- **Display Toggles**: Easily toggle points, boundary curves, surface faces, mesh wireframe, labels, ground grid, and coordinate axes.
- **Multi-Angle Camera**: Instant presets for Top, Front, Side, Isometric, and Fit-to-Screen views, plus Perspective / Orthographic projection toggle.
- **Export Options**: Export the current model to **STL (`.stl`)**, **Wavefront OBJ (`.obj`)**, or **Gmsh Mesh (`.msh`)** directly from the preview toolbar.
- **Built-in Fallback Parser**: Even if Gmsh CLI is not yet installed or has syntax errors, an internal fallback parser keeps basic geometry visible.

---

## 🚀 Getting Started

### Installation
1. Install this extension from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/) (or download the `.vsix`).
2. Open any `.geo` or `.msh` file. The language mode is automatically set to **Gmsh**.

### Opening the 3D Preview
Choose any of these methods:
- Click the **eye icon** (`$(eye)`) at the top-right corner of the editor title bar.
- Click **`$(eye) Gmsh Preview`** in the status bar (bottom right).
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) and run:
  ```text
  Gmsh: Open 3D Realtime Preview to the Side
  ```

### Automatic Gmsh CLI Detection
The extension automatically searches common system paths, `C:\Program Files\gmsh*`, Conda environments, Downloads, and system `PATH` for the `gmsh` executable:
- When found, you will be prompted to save it to your settings.
- To re-scan manually: Run `Gmsh: Auto-Detect Gmsh Executable` in the command palette.
- To select manually: Run `Gmsh: Browse for Gmsh Executable...`.

---

## ⚙️ Configuration (`settings.json`)

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `gmsh.executablePath` | `string` | `"gmsh"` | Path to the Gmsh executable (e.g., `gmsh` or `C:\gmsh\gmsh.exe`) |
| `gmsh.meshDimension` | `number` | `2` | Default mesh dimension (`0`: Geometry, `1`: 1D, `2`: 2D, `3`: 3D) |
| `gmsh.debounceDelay` | `number` | `400` | Delay (ms) after code edits before refreshing the preview |

---

## ⌨️ Snippets & Shortcuts

Type the prefix and press `Tab` or `Enter` to expand:

| Prefix | Expands To | Description |
| :--- | :--- | :--- |
| `Point` | `Point(1) = {x, y, z, lc};` | Point primitive |
| `Line` | `Line(1) = {start, end};` | Line segment |
| `Circle` | `Circle(1) = {start, center, end};` | Circular arc |
| `Curve Loop` | `Curve Loop(1) = {c1, c2, ...};` | Closed curve boundary |
| `Plane Surface` | `Plane Surface(1) = {loop1};` | Planar surface |
| `Surface Loop` | `Surface Loop(1) = {s1, s2, ...};` | Enclosed surface shell |
| `Volume` | `Volume(1) = {loop1};` | 3D Volume |
| `Extrude` | `Extrude {dx, dy, dz} { ... };` | Translation extrusion |
| `Rotate` | `Rotate { {ax,ay,az}, {px,py,pz}, angle } { ... }` | Rotation transform |
| `Box` | `Box(1) = {x, y, z, dx, dy, dz};` | OpenCASCADE 3D box |
| `Cylinder` | `Cylinder(1) = {x, y, z, dx, dy, dz, r};` | OpenCASCADE cylinder |
| `Sphere` | `Sphere(1) = {x, y, z, r};` | OpenCASCADE sphere |
| `BooleanDifference` | `BooleanDifference(1) = { ... } { ... };` | OpenCASCADE Boolean cut |
| `MeshSize` | `MeshSize {points} = size;` | Prescribed element size |
| `Transfinite Curve` | `Transfinite Curve {curves} = n;` | Structured 1D discretization |
| `For` | `For i In {1:10} ... EndFor` | Loop iteration |
| `If` | `If (cond) ... EndIf` | Conditional branch |
| `Printf` | `Printf("value: %g", var);` | Formatted console output |

---

## 🇯🇵 日本語

[Gmsh](https://gmsh.info/) のジオメトリスクリプト（`.geo`）およびメッシュファイル（`.msh`）に対応した VS Code 拡張機能です。
構文ハイライト・入力補完・スニペット・ホバー解説といった**言語サポート**と、Three.js を用いた**リアルタイム 3D プレビュー・双方向コードジャンプ**を1つの拡張機能に統合しています。

- **IntelliSense 補完**: `Point`, `Circle`, `Extrude`, `MeshSize` 等の主要コマンドおよびファイル内で定義した変数を自動補完。
- **ホバー表示**: コマンドの上にマウスを置くだけで構文仕様・引数の意味・使用例を表示。
- **3D プレビュー**: コード編集時にミリ秒単位で再描画。3D 上の点・線・面をクリックするとコードの該当行へ即座にジャンプ。
- **Gmsh 自動検出**: お使いの PC 内の `gmsh.exe` を自動検出するため、環境変数の事前設定が不要です。

---

## 🛠️ Development & Building

```bash
# Clone the repository
git clone https://github.com/USERNAME/gmsh-preview.git
cd gmsh-preview

# Install dependencies
npm install

# Build the extension and Webview bundle
npm run build

# Watch mode for rapid development
npm run watch

# Type-check TypeScript
npm run compile
```

Press **`F5`** in VS Code to launch the Extension Development Host window for live debugging.

---

## 📄 License

This extension is licensed under the [MIT License](LICENSE).
