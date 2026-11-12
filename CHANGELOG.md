# Changelog

All notable changes to the **Gmsh (Language Support & 3D Preview)** extension will be documented in this file.

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
