# Gmsh (Language Support & 3D Interactive Preview)

<p align="center">
  <img src="resources/icon.png" width="128" height="128" alt="Gmsh Extension Logo" />
</p>

<p align="center">
  <strong>The definitive Visual Studio Code extension for Gmsh.</strong><br/>
  Featuring comprehensive language support (IntelliSense autocompletion, snippets, hover docs) alongside real-time 3D geometry and finite element mesh visualization.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=Ringo3Apples.gmsh-preview"><img src="https://img.shields.io/visual-studio-marketplace/v/Ringo3Apples.gmsh-preview?label=VS%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace" /></a>
  <a href="https://open-vsx.org/extension/Ringo3Apples/gmsh-preview"><img src="https://img.shields.io/open-vsx/v/Ringo3Apples/gmsh-preview?label=Open%20VSX&logo=eclipse-ide" alt="Open VSX" /></a>
  <a href="https://github.com/Ringo3apples/gmshExtension/releases"><img src="https://img.shields.io/github/v/release/Ringo3apples/gmshExtension?label=GitHub%20Release" alt="GitHub Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
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
- **Screen-Space Constant Labels**: Visual tags for points (`P1`, `P2`...) and lines (`L1`, `L2`...) automatically maintain an optimal, readable pixel size regardless of camera zoom or perspective distance.
- **Adaptive Ground Grid & Scale Bar**: Smart grid stepping (`1, 2, 5 × 10^n`) ensures 1 cell corresponds directly to natural model units (e.g. 1 unit in `Box`). Scale indicator overlay directly on the 3D viewport, preview inspector, and status bar.
- **Display Toggles**: Easily toggle points, boundary curves, surface faces, mesh wireframe, labels, ground grid, and coordinate axes.
- **Multi-Angle Camera**: Instant presets for Top, Front, Side, Isometric, and Fit-to-Screen views, plus Perspective / Orthographic projection toggle.
- **Automatic `.msh` Output**: Automatically writes the generated `.msh` file alongside your `.geo` file (same directory and base filename) whenever Gmsh succeeds.
- **Built-in Fallback Parser**: Even if Gmsh CLI is not yet installed or has syntax errors, an internal fallback parser keeps basic geometry visible.

---

## 🚀 Getting Started

### Installation

#### Method 1: Visual Studio Code Marketplace (Recommended for VS Code)
Search for **`Gmsh`** or **`gmsh-preview`** in the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`) and click **Install**.

Or install directly from your terminal:
```bash
code --install-extension Ringo3Apples.gmsh-preview
```
👉 [View on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Ringo3Apples.gmsh-preview)

#### Method 2: Open VSX Registry (Recommended for VSCodium, Gitpod, Theia)
Search for **`gmsh-preview`** in the Open VSX Extensions view, or install from the terminal:
```bash
codium --install-extension Ringo3Apples.gmsh-preview
```
👉 [View on Open VSX Registry](https://open-vsx.org/extension/Ringo3Apples/gmsh-preview)

#### Method 3: Install from GitHub Releases (.vsix)
1. Download the latest `gmsh-preview-*.vsix` from [GitHub Releases](https://github.com/Ringo3apples/gmshExtension/releases).
2. In VS Code, open Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Click the **`...`** (Views and More Actions) menu in the top right, then select **Install from VSIX...** (or simply drag and drop the `.vsix` file into the VS Code window).

#### Method 4: Build and Install from Source
```bash
git clone https://github.com/Ringo3apples/gmshExtension.git
cd gmshExtension
npm install
npm run build
npm run package
code --install-extension gmsh-preview-*.vsix
```

---

### Usage
1. Open any `.geo` or `.msh` file. The language mode is automatically set to **Gmsh**.

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
- **画面固定サイズのラベル表示**: ズーム倍率に関わらず、点（`P1`）や線（`L1`）のラベルが常に読みやすい一定ピクセルサイズを維持。
- **直感的なグリッド＆スケール表示**: モデル寸法に応じたキリの良いマス目単位（`1, 2, 5 × 10^n`）を自動算出。3D 画面上・インスペクター・VS Code 最下部ステータスバーの3箇所で「1マスの長さ」を確認可能。
- **Gmsh 自動検出**: お使いの PC 内の `gmsh.exe` を自動検出するため、環境変数の事前設定が不要です。

#### インストール方法（日本語）

##### 方法 1: Visual Studio Code マーケットプレイスからインストール（推奨）
VS Code の拡張機能ビュー（`Ctrl+Shift+X`）で **`gmsh-preview`** または **`Gmsh`** を検索し、「**インストール**」をクリックします。
ターミナルから直接インストールすることも可能です：
```bash
code --install-extension Ringo3Apples.gmsh-preview
```
👉 [Visual Studio Marketplace で見る](https://marketplace.visualstudio.com/items?itemName=Ringo3Apples.gmsh-preview)

##### 方法 2: Open VSX レジストリからインストール（VSCodium / Gitpod / Eclipse Theia 等）
VSCodium 等の拡張機能ビューから **`gmsh-preview`** を検索してインストール、またはターミナルから：
```bash
codium --install-extension Ringo3Apples.gmsh-preview
```
👉 [Open VSX Registry で見る](https://open-vsx.org/extension/Ringo3Apples/gmsh-preview)

##### 方法 3: GitHub Releases (.vsix) からの手動インストール
1. [GitHub Releases](https://github.com/Ringo3apples/gmshExtension/releases) から最新の `gmsh-preview-*.vsix` パッケージをダウンロードします。
2. VS Code の拡張機能ビュー（`Ctrl+Shift+X`）の右上「**…**」メニューから「**VSIX からのインストール...**」を選択します（またはファイルを VS Code ウィンドウへドラッグ＆ドロップ）。

---

## 🛠️ Development & Building

```bash
# Clone the repository
git clone https://github.com/Ringo3apples/gmshExtension.git
cd gmshExtension

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
