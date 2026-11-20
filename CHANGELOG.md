# Changelog

All notable changes to the **Gmsh (Language Support & 3D Preview)** extension will be documented in this file.

## [0.6.0] - 2026-11-21
### Added
- **Per-Surface Visibility Popover & Checkboxes**:
  - Hovering over the **Surfaces** toolbar button opens a checklist of all surface regions (`Physical Surface` names or `Surface #tag`) with **All** / **None** quick toggles.
  - Unchecking a surface hides its front/back faces, wireframe mesh, and Physical label, excludes it from raycasting, and persists across live `.geo` edits.
- **Interactive Per-Surface Color Picker**:
  - Clicking any surface's color swatch in the **Surfaces** popover opens a native color picker to customize its 3D color in real time (updating both planar and cylindrical front/back surfaces and persisting across edits).
- **3-State `Cylindrical` (Y-Axis Revolution) Display**:
  - Added a **Cylindrical** toolbar button cycling through **Off** → **Translucent (`◐`)** (overlaying translucent 3D revolved solids around the Y-axis while keeping the original 2D cross-section visible) → **Opaque (`●`)** (solid 3D revolved view).
- **2-Stage `Fit` & Direction-Only View Presets**:
  - **Top / Front / Side / Iso** buttons now change only the camera viewing direction while preserving current zoom and target.
  - **Fit** button toggles between fitting the **entire model** (1st click) and fitting **only the currently visible surfaces** (2nd click, including cylindrical revolved geometry when enabled).

## [0.5.0] - 2026-11-17
### Added
- **Per-Region Surface Color Coding**:
  - Automatically assigns distinct colors from a 12-color CAD palette (with golden-angle HSL expansion for 13+ regions) to each `Physical Surface` (when `Gmsh` is ON) or each `Surface` tag (when `Gmsh` is OFF).
  - Back faces are rendered using the same hue as the front face with saturation reduced to 60% and lightness to 80%, preserving region identity while clearly indicating surface normal orientation.
- **Cursor-Centered Zoom (`zoomToCursor`)**:
  - Mouse wheel zooming in both Perspective and Orthographic camera projections now zooms directly toward/away from the 3D world point under the mouse cursor.
- **Coplanar Overlapping Surface Layering**:
  - Computes surface areas and applies area-ranked `polygonOffset` and raycasting priority so smaller coplanar regions (such as coils and iron cores inside an air box) always render and select cleanly on top of larger background surfaces without Z-fighting.
- **Enhanced Fallback `.geo` Parser**:
  - Added support for `newreg`, `newl`, and `newll` auto-ID keywords, brace-aware statement splitting (handling `;` inside `{ ... }`), and `Extrude {dx, dy, dz} { Curve{...}; }` surface/curve generation.
- **Physical Name Hover Inspector**:
  - Displays Physical Names alongside entity tags (e.g. `Surface #1 (ironCore)`) in the bottom inspector bar when hovering over points, lines, or surfaces.

### Fixed
- **Exact Error Line Number Alignment on Windows**:
  - Normalizes temporary `.geo` files to `LF (\n)` line endings before invoking Gmsh, preventing Windows `CRLF (\r\n)` line-counting offsets in Gmsh's lexer so reported error lines match editor line numbers 100%.

## [0.4.0] - 2026-11-11
### Added
- **Gmsh Mode Toggle (`Gmsh` & `Mesh` Coupling)**:
  - Replaced toolbar `Grid` toggle with `Gmsh` toggle (grid visibility remains toggleable via the status bar badge).
  - **Gmsh OFF**: Skips running Gmsh CLI on `.geo` edits; previews all `.geo` Points, Lines, true 3D Circles, Splines, Curve Loops, and Surfaces (including holes) with `P#` / `L#` ID labels.
  - **Gmsh ON**: Runs Gmsh on `.geo` changes, displays `.msh` Points/Curves/Surfaces, and shows **Physical Names** as entity labels.
  - Turning `Mesh` ON automatically turns `Gmsh` ON; turning `Gmsh` OFF automatically turns `Mesh` OFF.
- **Automatic `.msh` Output**: Writes `<filename>.msh` in the same folder as the source `.geo` file upon successful Gmsh execution (replacing the toolbar Export menu).
- **Fixed 10px Point Markers**: Point markers (and 15px selection highlights) stay at a constant screen pixel diameter regardless of zoom.
- **Borderless Smart Labels**: Removed label boxes/borders; Point labels sit cleanly above markers, and Line labels dynamically track the center of the visible segment on screen (right of vertical lines, below horizontal lines).
- **Origin-Aligned Infinite Adaptive Grid & `mm/div` Scale**: Grid lines adapt across `1, 2, 5 × 10^n`, cover the full viewport, keep origin `(0, 0, 0)` and 5-step major lines anchored in world space, and display grid spacing in `mm/div` (1000× scaled) on the status bar.

### Changed
- **Non-Blocking Status Bar Indicators**: Removed full-screen loading blur and top error banner; Gmsh running state and clickable error messages are shown cleanly in the status bar.

### Fixed
- **Micro-Scale Model Fit & Zoom**: Removed hardcoded `0.5` minimum radius and `0.01` near-clip limits; added dynamic clipping planes and bounding-box perspective fitting for millimeter/micrometer-scale models.
- **Single-Run Debounce Guard**: Ignored metadata-only document change events (e.g. Auto Save) and duplicate content runs so editing triggers Gmsh only once.

## [0.3.0] - 2026-11-08
### Added
- **Screen-Space Constant Size Labels**: Point (`P#`) and line (`L#`) labels maintain a crisp, constant pixel height regardless of camera zoom level or perspective distance.
- **Intuitive CAD-Grade Grid Spacing**: Ground grid dimensions automatically adapt to standard increments (`1, 2, 5 × 10^n`), ensuring 1 cell corresponds directly to natural model units (e.g. 1 unit in `Box(1) = {0,0,0, 2,2,1};`).
- **Tri-Location Grid Scale Indicators**:
  - Interactive overlay badge directly on the 3D viewport canvas (`📏 Grid 1マス = 1`).
  - Highlighted badge in the bottom preview inspector bar (`Grid 1マス: 1 (全体: 10)`).
  - Synchronized item on the VS Code main status bar (`$(symbol-ruler) Grid: 1マス = 1`).
  - Click any badge to instantly toggle ground grid visibility.

## [0.2.1] - 2026-10-24
### Added
- **Two-Tone Surface Rendering**: Front and back faces are rendered in distinct colors (Vibrant CAD Blue on front, Crimson Red on back) for instant surface normal identification.
- **PBR Flat Shading & Optimized Lighting**: Flat-shaded MeshStandardMaterial with calibrated ambient and directional lights for sharp, clear planar recognition without specular glare.

### Fixed
- **Clean 2D Surface Meshing**: Streamlined MSH parser to ensure planar surfaces render without internal volumetric mesh clutter.
- **CI / Package Lock Sync**: Resolved dependency lockfile discrepancies for GitHub Actions builds.

## [0.2.0] - 2026-10-20
### Added
- **IntelliSense Autocompletion**: Full command autocompletion for Gmsh primitives, OpenCASCADE CAD shapes, Boolean operations, and mesh controls.
- **Dynamic Variable Suggestions**: Automatically detects and autocompletes user-defined variables and arrays in the current document.
- **Comprehensive Snippets**: Ready-to-use snippets for `Point`, `Line`, `Circle`, `Curve Loop`, `Plane Surface`, `Extrude`, `Rotate`, `Box`, `Sphere`, `Cylinder`, `MeshSize`, and more.
- **Hover Documentation**: Interactive tooltips showing signatures, parameter descriptions, and examples for Gmsh commands.
- **Syntax Optimization**: Improved word patterns and auto-indentation rules in `language-configuration.json` to prevent unwanted auto-replacements.

## [0.1.0] - 2026-10-15
### Added
- Real-time 3D interactive preview for `.geo` and `.msh` files.
- Two-way code navigation: click on 3D geometry entities to jump to the corresponding code lines.
- Mesh visualization across 0D, 1D, 2D, and 3D dimensions.
- 3D entity ID labels (Points, Curves/Lines).
- Automatic detection and locator for local Gmsh executables.
- Model export support: STL, OBJ, and Gmsh MSH.
- Built-in syntax highlighting for Gmsh `.geo` files.
