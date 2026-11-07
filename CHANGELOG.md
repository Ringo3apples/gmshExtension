# Changelog

All notable changes to the **Gmsh (Language Support & 3D Preview)** extension will be documented in this file.

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
