import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshData, GeometricPoint, GeometricLine } from '../types';
import { LabelManager } from './labelManager';

export interface GridInfo {
  size: number;
  divisions: number;
  step: number;
  visible: boolean;
}

export interface ViewerOptions {
  container: HTMLElement;
  onSelectEntity?: (entityType: 'point' | 'line' | 'surface', tag: number) => void;
  onHoverEntity?: (info: { type: string; tag: number; coords?: [number, number, number] } | null) => void;
  onGridUpdate?: (info: GridInfo) => void;
}

export class Viewer3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private perspectiveCamera: THREE.PerspectiveCamera;
  private orthographicCamera: THREE.OrthographicCamera;
  private currentCamera: THREE.Camera;
  private controls: OrbitControls;
  private labelManager: LabelManager;

  // Geometry groups
  private pointsGroup: THREE.Group;
  private linesGroup: THREE.Group;
  private surfacesGroup: THREE.Group;
  private wireframeGroup: THREE.Group;
  private helpersGroup: THREE.Group;
  private highlightGroup: THREE.Group;

  private gridLines: THREE.LineSegments | null = null;
  private lastGridSnapIdxX: number = NaN;
  private lastGridSnapIdxZ: number = NaN;
  private axesHelper: THREE.AxesHelper | null = null;
  private dirLight1!: THREE.DirectionalLight;
  private dirLight2!: THREE.DirectionalLight;

  // Stored active mesh data
  private currentMeshData: MeshData | null = null;
  private boundingSphere: THREE.Sphere = new THREE.Sphere();
  private boundingBox: THREE.Box3 = new THREE.Box3();

  // Interaction
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private onSelectEntity?: (entityType: 'point' | 'line' | 'surface', tag: number) => void;
  private onHoverEntity?: (info: { type: string; tag: number; coords?: [number, number, number] } | null) => void;
  private onGridUpdate?: (info: GridInfo) => void;
  private gridInfo: GridInfo = { size: 10, divisions: 20, step: 0.5, visible: true };
  private readonly pointPixelDiameter: number = 10;
  private readonly highlightPointPixelDiameter: number = 15;

  // Display toggles
  public showPoints: boolean = true;
  public showLines: boolean = true;
  public showSurfaces: boolean = true;
  public showWireframe: boolean = true;
  public showLabels: boolean = true;
  public showAxes: boolean = true;
  public showGrid: boolean = true;
  public isOrtho: boolean = false;

  constructor(options: ViewerOptions) {
    this.container = options.container;
    this.onSelectEntity = options.onSelectEntity;
    this.onHoverEntity = options.onHoverEntity;
    this.onGridUpdate = options.onGridUpdate;

    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111827); // Dark slate

    // 2. Cameras
    const aspect = width / height;
    this.perspectiveCamera = new THREE.PerspectiveCamera(45, aspect, 0.01, 10000);
    this.perspectiveCamera.position.set(5, 5, 5);

    const frustumSize = 10;
    this.orthographicCamera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.01,
      10000
    );
    this.orthographicCamera.position.set(5, 5, 5);
    this.currentCamera = this.perspectiveCamera;

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.currentCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomSpeed = 1.2;

    // 5. Lights (Simple, neutral reflected light suitable for CAD/FEM models)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    this.dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4625);
    this.dirLight1.position.set(10, 20, 15);
    this.scene.add(this.dirLight1);
    this.scene.add(this.dirLight1.target);

    this.dirLight2 = new THREE.DirectionalLight(0xffffff, 0.35);
    this.dirLight2.position.set(-10, -10, -10);
    this.scene.add(this.dirLight2);
    this.scene.add(this.dirLight2.target);

    // 6. Groups
    this.pointsGroup = new THREE.Group();
    this.linesGroup = new THREE.Group();
    this.surfacesGroup = new THREE.Group();
    this.wireframeGroup = new THREE.Group();
    this.helpersGroup = new THREE.Group();
    this.highlightGroup = new THREE.Group();

    this.scene.add(this.surfacesGroup);
    this.scene.add(this.wireframeGroup);
    this.scene.add(this.linesGroup);
    this.scene.add(this.pointsGroup);
    this.scene.add(this.helpersGroup);
    this.scene.add(this.highlightGroup);

    // 7. Label Manager
    this.labelManager = new LabelManager(this.scene);

    // 8. Raycaster
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points = { threshold: 0.15 };
    this.raycaster.params.Line = { threshold: 0.1 };
    this.mouse = new THREE.Vector2();

    this.setupEventListeners();
    this.animate();
  }

  private setupEventListeners() {
    window.addEventListener('resize', () => this.handleResize());

    const dom = this.renderer.domElement;
    let isDragging = false;
    let downPos = { x: 0, y: 0 };

    dom.addEventListener('pointerdown', (e) => {
      isDragging = false;
      downPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointermove', (e) => {
      if (Math.abs(e.clientX - downPos.x) > 4 || Math.abs(e.clientY - downPos.y) > 4) {
        isDragging = true;
      }
      this.handlePointerMove(e);
    });

    dom.addEventListener('pointerup', (e) => {
      if (!isDragging) {
        this.handleClick(e);
      }
    });
  }

  private handleResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    const aspect = width / height;

    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    if (this.isOrtho) {
      const halfHeight = (this.orthographicCamera.top - this.orthographicCamera.bottom) / 2;
      if (halfHeight > 0) {
        const halfWidth = halfHeight * aspect;
        const centerX = (this.orthographicCamera.left + this.orthographicCamera.right) / 2;
        this.orthographicCamera.left = centerX - halfWidth;
        this.orthographicCamera.right = centerX + halfWidth;
        this.orthographicCamera.updateProjectionMatrix();
      }
    }

    this.renderer.setSize(width, height);
  }

  private updateRaycastCoords(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private handlePointerMove(e: PointerEvent) {
    if (!this.onHoverEntity || !this.currentMeshData) return;
    this.updateRaycastCoords(e);
    this.raycaster.setFromCamera(this.mouse, this.currentCamera);

    // Check points first
    if (this.showPoints && this.pointsGroup.children.length > 0) {
      const hits = this.raycaster.intersectObjects(this.pointsGroup.children);
      if (hits.length > 0) {
        const hit = hits[0];
        const pt = hit.object.userData.point as GeometricPoint;
        if (pt) {
          this.onHoverEntity({ type: 'point', tag: pt.tag, coords: [pt.x, pt.y, pt.z] });
          this.renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }
    }

    // Check lines
    if (this.showLines && this.linesGroup.children.length > 0) {
      const hits = this.raycaster.intersectObjects(this.linesGroup.children);
      if (hits.length > 0) {
        const line = hits[0].object.userData.line as GeometricLine;
        if (line) {
          this.onHoverEntity({ type: 'line', tag: line.tag });
          this.renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }
    }

    // Check surfaces
    if (this.showSurfaces && this.surfacesGroup.children.length > 0) {
      const hits = this.raycaster.intersectObjects(this.surfacesGroup.children);
      if (hits.length > 0) {
        const faceIndex = hits[0].faceIndex;
        if (typeof faceIndex === 'number' && this.currentMeshData.surfaceTags[faceIndex]) {
          const tag = this.currentMeshData.surfaceTags[faceIndex];
          this.onHoverEntity({ type: 'surface', tag });
          this.renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }
    }

    this.onHoverEntity(null);
    this.renderer.domElement.style.cursor = 'default';
  }

  private handleClick(e: PointerEvent) {
    if (!this.currentMeshData || !this.onSelectEntity) return;
    this.updateRaycastCoords(e);
    this.raycaster.setFromCamera(this.mouse, this.currentCamera);

    // 1. Check points
    if (this.showPoints && this.pointsGroup.children.length > 0) {
      const hits = this.raycaster.intersectObjects(this.pointsGroup.children);
      if (hits.length > 0) {
        const pt = hits[0].object.userData.point as GeometricPoint;
        if (pt) {
          this.highlightEntity('point', pt.tag);
          this.onSelectEntity('point', pt.tag);
          return;
        }
      }
    }

    // 2. Check lines
    if (this.showLines && this.linesGroup.children.length > 0) {
      const hits = this.raycaster.intersectObjects(this.linesGroup.children);
      if (hits.length > 0) {
        const line = hits[0].object.userData.line as GeometricLine;
        if (line) {
          this.highlightEntity('line', line.tag);
          this.onSelectEntity('line', line.tag);
          return;
        }
      }
    }

    // 3. Check surfaces
    if (this.showSurfaces && this.surfacesGroup.children.length > 0) {
      const hits = this.raycaster.intersectObjects(this.surfacesGroup.children);
      if (hits.length > 0) {
        const faceIndex = hits[0].faceIndex;
        if (typeof faceIndex === 'number' && this.currentMeshData.surfaceTags[faceIndex]) {
          const tag = this.currentMeshData.surfaceTags[faceIndex];
          this.highlightEntity('surface', tag);
          this.onSelectEntity('surface', tag);
          return;
        }
      }
    }
  }

  public highlightEntity(type: 'point' | 'line' | 'surface', tag: number) {
    this.clearHighlight();
    if (!this.currentMeshData) return;

    if (type === 'point') {
      const pt = this.currentMeshData.points.find(p => p.tag === tag);
      if (pt) {
        const geom = new THREE.SphereGeometry(0.5, 16, 12);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0055, depthTest: false });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(pt.x, pt.y, pt.z);
        mesh.userData = { isHighlightPoint: true };
        this.highlightGroup.add(mesh);
        this.updatePointMarkerScales();
      }
    } else if (type === 'line') {
      const line = this.currentMeshData.lines.find(l => l.tag === tag);
      if (line) {
        const geom = new THREE.BufferGeometry();
        const positions: number[] = [];
        for (let i = 0; i < line.nodeIndices.length; i++) {
          const idx = line.nodeIndices[i];
          positions.push(
            this.currentMeshData.nodes[idx * 3],
            this.currentMeshData.nodes[idx * 3 + 1],
            this.currentMeshData.nodes[idx * 3 + 2]
          );
        }
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0xff0055, linewidth: 4, depthTest: false });
        const lineSeg = new THREE.LineSegments(geom, mat);
        this.highlightGroup.add(lineSeg);
      }
    }
  }

  public clearHighlight() {
    while (this.highlightGroup.children.length > 0) {
      const c = this.highlightGroup.children[0];
      this.highlightGroup.remove(c);
      if ((c as any).geometry) (c as any).geometry.dispose();
      if ((c as any).material) (c as any).material.dispose();
    }
  }

  public updateMesh(data: MeshData) {
    const isFirstLoad = this.currentMeshData === null;
    this.currentMeshData = data;

    // Clear old geometries
    this.clearGroup(this.pointsGroup);
    this.clearGroup(this.linesGroup);
    this.clearGroup(this.surfacesGroup);
    this.clearGroup(this.wireframeGroup);
    this.clearGroup(this.helpersGroup);
    this.gridLines = null;
    this.lastGridSnapIdxX = NaN;
    this.lastGridSnapIdxZ = NaN;
    this.axesHelper = null;
    this.clearHighlight();

    if (!data.nodes || data.nodes.length === 0) return;

    // 1. Calculate Bounding Box and Center
    const min = new THREE.Vector3(...data.bbox.min);
    const max = new THREE.Vector3(...data.bbox.max);
    this.boundingBox.set(min, max);
    this.boundingBox.getBoundingSphere(this.boundingSphere);

    const radius = this.getEffectiveRadius();
    const center = this.boundingSphere.center;

    // Adjust raycaster pick thresholds proportionally to model scale
    this.raycaster.params.Points = { threshold: radius * 0.05 };
    this.raycaster.params.Line = { threshold: radius * 0.03 };

    // 2. Setup Helpers (Grid and Axes)
    this.updateHelpers(center, radius);

    // 3. Render Points as unit spheres (diameter = 1.0) scaled to constant screen pixels
    const pointGeom = new THREE.SphereGeometry(0.5, 16, 12);
    const pointMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8 // Sky blue
    });

    data.points.forEach((pt) => {
      const pointMesh = new THREE.Mesh(pointGeom, pointMat);
      pointMesh.position.set(pt.x, pt.y, pt.z);
      pointMesh.userData = { point: pt };
      this.pointsGroup.add(pointMesh);
    });

    // 4. Render Lines
    data.lines.forEach((line) => {
      if (line.nodeIndices.length >= 2) {
        const positions: number[] = [];
        for (let i = 0; i < line.nodeIndices.length; i++) {
          const idx = line.nodeIndices[i];
          positions.push(
            data.nodes[idx * 3],
            data.nodes[idx * 3 + 1],
            data.nodes[idx * 3 + 2]
          );
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const mat = new THREE.LineBasicMaterial({
          color: 0xf59e0b, // Amber
          linewidth: 2
        });
        const lineSeg = new THREE.LineSegments(geom, mat);
        lineSeg.userData = { line };
        this.linesGroup.add(lineSeg);
      }
    });

    // 5. Render Surfaces (Diffuse reflection surface / Lambertian reflection)
    if (data.surfaceTriangles.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(data.nodes, 3));
      geom.setIndex(data.surfaceTriangles);
      geom.computeVertexNormals();

      // Front side: Vibrant CAD Blue (0x2563eb)
      const matFront = new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.5,
        metalness: 0.8,
        side: THREE.FrontSide,
        flatShading: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });
      const meshFront = new THREE.Mesh(geom, matFront);
      this.surfacesGroup.add(meshFront);

      // Back side: Distinct Red (0xdc2626)
      const matBack = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.5,
        metalness: 0.8,
        side: THREE.BackSide,
        flatShading: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });
      const meshBack = new THREE.Mesh(geom, matBack);
      this.surfacesGroup.add(meshBack);

      // 6. Mesh Wireframe
      const wireframeMat = new THREE.LineBasicMaterial({
        color: 0x94a3b8, // Light slate
        transparent: true,
        opacity: 0.6
      });
      const wireframeGeom = new THREE.WireframeGeometry(geom);
      const wireframe = new THREE.LineSegments(wireframeGeom, wireframeMat);
      this.wireframeGroup.add(wireframe);
    }

    // 7. Update Labels (linked with Points, Lines, and Surfaces visibility)
    this.labelManager.updateLabels(
      data.points,
      data.lines,
      data.nodes,
      radius,
      this.showPoints,
      this.showLines,
      this.showSurfaces,
      data.surfaceLabels || [],
      data.labelMode || 'geo'
    );
    this.labelManager.updateScales(this.currentCamera, this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight);

    // Apply visibility states
    this.pointsGroup.visible = this.showPoints;
    this.linesGroup.visible = this.showLines;
    this.surfacesGroup.visible = this.showSurfaces;
    this.wireframeGroup.visible = this.showWireframe;

    if (isFirstLoad) {
      this.setView('iso');
    }

    this.updatePointMarkerScales();
    this.labelManager.updateScales(this.currentCamera, this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight);
  }

  public getGridInfo(): GridInfo {
    return this.gridInfo;
  }

  private calculateNiceStep(idealStep: number): number {
    if (idealStep <= 0 || !isFinite(idealStep)) return 1;
    const exponent = Math.floor(Math.log10(idealStep));
    const pow10 = Math.pow(10, exponent);
    const frac = idealStep / pow10;

    let niceFrac = 1;
    // Standard geometric-mean thresholds for 1, 2, 5 x 10^n
    if (frac < 1.414) {
      niceFrac = 1;
    } else if (frac < 3.162) {
      niceFrac = 2;
    } else if (frac < 7.071) {
      niceFrac = 5;
    } else {
      niceFrac = 10;
    }
    const step = niceFrac * pow10;
    return parseFloat(step.toPrecision(8));
  }

  /**
   * Dynamically adapts the grid step (1, 2, 5 x 10^n) based on camera zoom / distance,
   * aligns main grid lines strictly to the world origin (0, 0, 0), and ensures full viewport coverage.
   */
  private updateAdaptiveGrid() {
    if (!this.showGrid) return;

    const cam = this.currentCamera;
    const target = this.controls.target;
    const aspect = (this.container.clientWidth || 800) / (this.container.clientHeight || 600);

    let viewHeight: number;
    if (cam instanceof THREE.PerspectiveCamera) {
      const dist = cam.position.distanceTo(target);
      viewHeight = 2 * dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    } else if (cam instanceof THREE.OrthographicCamera) {
      viewHeight = (cam.top - cam.bottom) / cam.zoom;
    } else {
      return;
    }

    const viewWidth = viewHeight * aspect;
    const viewportH = this.container.clientHeight || 600;

    // Ideal step targeting ~65 pixels per cell on screen
    const idealStep = (viewHeight / viewportH) * 65;
    const step = this.calculateNiceStep(idealStep);

    // Ample size ensuring full screen coverage from any angle
    const diagonal = Math.sqrt(viewWidth * viewWidth + viewHeight * viewHeight);
    const requiredSize = diagonal * 2.8;

    let divisions = Math.ceil(requiredSize / step);
    if (divisions % 2 !== 0) divisions++;
    divisions = Math.min(Math.max(divisions, 40), 120);

    const size = step * divisions;

    // Snap center to step multiples so grid lines remain locked to world origin (0, 0, 0)
    const snapIdxX = Math.round(target.x / step);
    const snapIdxZ = Math.round(target.z / step);

    const stepOrDivChanged = !this.gridLines || this.gridInfo.step !== step || this.gridInfo.divisions !== divisions;
    const snapChanged = this.lastGridSnapIdxX !== snapIdxX || this.lastGridSnapIdxZ !== snapIdxZ;

    if (stepOrDivChanged || snapChanged) {
      this.rebuildOriginAlignedGrid(step, divisions, snapIdxX, snapIdxZ);
      this.lastGridSnapIdxX = snapIdxX;
      this.lastGridSnapIdxZ = snapIdxZ;

      if (stepOrDivChanged) {
        this.gridInfo = { size, divisions, step, visible: this.showGrid };
        this.onGridUpdate?.(this.gridInfo);
      }
    }
  }

  /**
   * Builds/updates grid geometry where origin lines (world x=0, z=0) and major intervals (every 5 cells)
   * are anchored to (0, 0, 0) regardless of camera panning.
   */
  private rebuildOriginAlignedGrid(step: number, divisions: number, snapIdxX: number, snapIdxZ: number) {
    const halfDiv = divisions / 2;
    const halfSize = halfDiv * step;
    const lineCount = (divisions + 1) * 2;
    const vertexCount = lineCount * 2;

    const colorOrigin = new THREE.Color(0x64748b); // Origin axes (x=0, z=0)
    const colorMajor = new THREE.Color(0x334155);  // Main grid lines every 5 steps from origin
    const colorMinor = new THREE.Color(0x1e293b);  // Sub grid lines

    const needsNewMesh = !this.gridLines || this.gridInfo.divisions !== divisions;

    let posArr: Float32Array;
    let colArr: Float32Array;

    if (needsNewMesh) {
      if (this.gridLines) {
        this.helpersGroup.remove(this.gridLines);
        this.gridLines.geometry.dispose();
        if (Array.isArray(this.gridLines.material)) {
          this.gridLines.material.forEach((m: any) => m.dispose());
        } else {
          this.gridLines.material.dispose();
        }
      }

      posArr = new Float32Array(vertexCount * 3);
      colArr = new Float32Array(vertexCount * 3);

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      geom.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

      const mat = new THREE.LineBasicMaterial({ vertexColors: true });
      this.gridLines = new THREE.LineSegments(geom, mat);
      this.gridLines.frustumCulled = false;
      this.gridLines.visible = this.showGrid;
      this.helpersGroup.add(this.gridLines);
    } else {
      const posAttr = this.gridLines!.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = this.gridLines!.geometry.getAttribute('color') as THREE.BufferAttribute;
      posArr = posAttr.array as Float32Array;
      colArr = colAttr.array as Float32Array;
    }

    let offset = 0;

    // Lines parallel to Z axis (varying X)
    for (let i = -halfDiv; i <= halfDiv; i++) {
      const localX = i * step;
      const worldIdxX = snapIdxX + i;
      const c = worldIdxX === 0 ? colorOrigin : (worldIdxX % 5 === 0 ? colorMajor : colorMinor);

      posArr[offset] = localX;
      posArr[offset + 1] = 0;
      posArr[offset + 2] = -halfSize;
      colArr[offset] = c.r;
      colArr[offset + 1] = c.g;
      colArr[offset + 2] = c.b;

      posArr[offset + 3] = localX;
      posArr[offset + 4] = 0;
      posArr[offset + 5] = halfSize;
      colArr[offset + 3] = c.r;
      colArr[offset + 4] = c.g;
      colArr[offset + 5] = c.b;

      offset += 6;
    }

    // Lines parallel to X axis (varying Z)
    for (let i = -halfDiv; i <= halfDiv; i++) {
      const localZ = i * step;
      const worldIdxZ = snapIdxZ + i;
      const c = worldIdxZ === 0 ? colorOrigin : (worldIdxZ % 5 === 0 ? colorMajor : colorMinor);

      posArr[offset] = -halfSize;
      posArr[offset + 1] = 0;
      posArr[offset + 2] = localZ;
      colArr[offset] = c.r;
      colArr[offset + 1] = c.g;
      colArr[offset + 2] = c.b;

      posArr[offset + 3] = halfSize;
      posArr[offset + 4] = 0;
      posArr[offset + 5] = localZ;
      colArr[offset + 3] = c.r;
      colArr[offset + 4] = c.g;
      colArr[offset + 5] = c.b;

      offset += 6;
    }

    const geom = this.gridLines!.geometry;
    (geom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geom.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    this.gridLines!.position.set(snapIdxX * step, 0, snapIdxZ * step);
  }

  private updateHelpers(_center: THREE.Vector3, radius: number) {
    // Axes at origin (0, 0, 0)
    this.axesHelper = new THREE.AxesHelper(radius * 0.8);
    this.axesHelper.position.set(0, 0, 0);
    this.helpersGroup.add(this.axesHelper);

    // Initial adaptive grid setup
    this.updateAdaptiveGrid();

    // Grid and Axes visibility linked together
    this.helpersGroup.visible = this.showGrid;
    if (this.gridLines) this.gridLines.visible = this.showGrid;
    this.axesHelper.visible = this.showGrid;
  }

  private getEffectiveRadius(): number {
    // Only fallback to 1.0 for degenerate zero-size geometry (e.g., a single point)
    return this.boundingSphere.radius > 1e-7 ? this.boundingSphere.radius : 1.0;
  }

  private updateClippingPlanes() {
    const radius = this.getEffectiveRadius();
    if (this.currentCamera instanceof THREE.PerspectiveCamera) {
      const dist = this.perspectiveCamera.position.distanceTo(this.controls.target);
      const safeDist = Math.max(dist, 1e-7);
      const desiredNear = Math.max(Math.min(safeDist * 0.002, radius * 0.002), 1e-7);
      const desiredFar = Math.max(safeDist * 200, radius * 500, 100);

      if (
        Math.abs(this.perspectiveCamera.near - desiredNear) > desiredNear * 0.1 ||
        Math.abs(this.perspectiveCamera.far - desiredFar) > desiredFar * 0.1
      ) {
        this.perspectiveCamera.near = desiredNear;
        this.perspectiveCamera.far = desiredFar;
        this.perspectiveCamera.updateProjectionMatrix();
      }
    } else if (this.currentCamera instanceof THREE.OrthographicCamera) {
      const dist = this.orthographicCamera.position.distanceTo(this.controls.target);
      const extent = Math.max(dist, radius) * 50;
      if (
        Math.abs(this.orthographicCamera.near - (-extent)) > extent * 0.1 ||
        Math.abs(this.orthographicCamera.far - extent) > extent * 0.1
      ) {
        this.orthographicCamera.near = -extent;
        this.orthographicCamera.far = extent;
        this.orthographicCamera.updateProjectionMatrix();
      }
    }
  }

  public resetView() {
    if (!this.currentMeshData) return;
    const center = this.boundingSphere.center;
    const radius = this.getEffectiveRadius();

    // Keep current camera view angle relative to target
    const currentDir = new THREE.Vector3().subVectors(this.currentCamera.position, this.controls.target);
    if (currentDir.lengthSq() < 1e-12) {
      currentDir.set(1, 0.85, 1);
    }
    currentDir.normalize();

    const aspect = (this.container.clientWidth || 800) / (this.container.clientHeight || 600);
    const fovRad = (this.perspectiveCamera.fov * Math.PI) / 180;
    const halfFovV = fovRad / 2;
    const halfFovH = Math.atan(Math.tan(halfFovV) * aspect);
    const minHalfFov = Math.min(halfFovV, halfFovH);
    const fallbackDist = (radius / Math.sin(minHalfFov)) * 1.15;

    this.controls.target.copy(center);

    const box = this.boundingBox;
    const corners: THREE.Vector3[] = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];

    const margin = 1.15;

    if (this.isOrtho) {
      // 1. Position camera along current direction and aim at center
      this.orthographicCamera.position.copy(center).addScaledVector(currentDir, fallbackDist);
      this.orthographicCamera.lookAt(center);
      this.orthographicCamera.updateMatrixWorld();

      // 2. Project 3D bounding box corners into camera's local space to find oriented screen extents
      const invMat = this.orthographicCamera.matrixWorldInverse;
      let maxExtentX = 0;
      let maxExtentY = 0;
      for (const corner of corners) {
        const p = corner.clone().applyMatrix4(invMat);
        maxExtentX = Math.max(maxExtentX, Math.abs(p.x));
        maxExtentY = Math.max(maxExtentY, Math.abs(p.y));
      }

      // Safeguard for degenerate/edge-on geometries scaled proportionally to radius
      const minExtent = Math.max(radius * 0.01, 1e-7);
      if (maxExtentX < minExtent) maxExtentX = Math.max(maxExtentY, radius * 0.1, 1e-6);
      if (maxExtentY < minExtent) maxExtentY = Math.max(maxExtentX, radius * 0.1, 1e-6);

      const reqHalfW = maxExtentX * margin;
      const reqHalfH = maxExtentY * margin;

      let halfW = reqHalfW;
      let halfH = reqHalfH;

      if (reqHalfW / reqHalfH > aspect) {
        halfH = reqHalfW / aspect;
      } else {
        halfW = reqHalfH * aspect;
      }

      // Reset zoom to 1 so OrbitControls zoom doesn't break Fit
      this.orthographicCamera.zoom = 1;
      this.orthographicCamera.left = -halfW;
      this.orthographicCamera.right = halfW;
      this.orthographicCamera.top = halfH;
      this.orthographicCamera.bottom = -halfH;
      const extent = Math.max(fallbackDist, radius) * 50;
      this.orthographicCamera.near = -extent;
      this.orthographicCamera.far = extent;
      this.orthographicCamera.updateProjectionMatrix();
    } else {
      // Fit Perspective camera tightly using oriented bounding box corners
      const tempDist = radius * 2;
      this.perspectiveCamera.position.copy(center).addScaledVector(currentDir, tempDist);
      this.perspectiveCamera.lookAt(center);
      this.perspectiveCamera.updateMatrixWorld();

      const invMat = this.perspectiveCamera.matrixWorldInverse;
      const tanHalfV = Math.tan(halfFovV);
      const tanHalfH = tanHalfV * aspect;

      let boxFitDist = 0;
      for (const c of corners) {
        const p = c.clone().applyMatrix4(invMat);
        const zFromCenter = p.z + tempDist;
        const reqZ = Math.max(
          (Math.abs(p.x) * margin) / tanHalfH,
          (Math.abs(p.y) * margin) / tanHalfV
        );
        boxFitDist = Math.max(boxFitDist, zFromCenter + reqZ);
      }

      const fitDist = boxFitDist > 1e-7 ? boxFitDist : fallbackDist;
      this.perspectiveCamera.position.copy(center).addScaledVector(currentDir, fitDist);
      this.perspectiveCamera.lookAt(center);
      this.perspectiveCamera.near = Math.max(Math.min(fitDist * 0.002, radius * 0.002), 1e-7);
      this.perspectiveCamera.far = Math.max(fitDist * 200, radius * 500, 100);
      this.perspectiveCamera.updateProjectionMatrix();
    }

    this.controls.update();
  }

  public setView(view: 'top' | 'front' | 'side' | 'iso') {
    if (!this.currentMeshData) return;
    const center = this.boundingSphere.center;
    const radius = this.getEffectiveRadius();
    const aspect = (this.container.clientWidth || 800) / (this.container.clientHeight || 600);
    const fovRad = (this.perspectiveCamera.fov * Math.PI) / 180;
    const halfFovV = fovRad / 2;
    const halfFovH = Math.atan(Math.tan(halfFovV) * aspect);
    const minHalfFov = Math.min(halfFovV, halfFovH);
    const dist = (radius / Math.sin(minHalfFov)) * 1.15;

    this.controls.target.copy(center);

    const dir = new THREE.Vector3();
    if (view === 'top') {
      dir.set(0, 1, 0.0001).normalize();
    } else if (view === 'front') {
      dir.set(0, 0, 1);
    } else if (view === 'side') {
      dir.set(1, 0, 0);
    } else if (view === 'iso') {
      dir.set(1, 0.85, 1).normalize();
    }

    this.currentCamera.position.copy(center).addScaledVector(dir, dist);
    this.currentCamera.lookAt(center);

    // Call resetView to fit the oriented geometry properly in both Ortho and Perspective
    this.resetView();
  }

  public toggleProjection() {
    this.isOrtho = !this.isOrtho;
    const aspect = (this.container.clientWidth || 800) / (this.container.clientHeight || 600);
    const radius = this.getEffectiveRadius();

    if (this.isOrtho) {
      // Perspective -> Orthographic transition: maintain apparent size at target
      const dist = this.perspectiveCamera.position.distanceTo(this.controls.target);
      const halfHeight = dist * Math.tan(THREE.MathUtils.degToRad(this.perspectiveCamera.fov / 2));
      const halfWidth = halfHeight * aspect;

      this.orthographicCamera.position.copy(this.perspectiveCamera.position);
      this.orthographicCamera.rotation.copy(this.perspectiveCamera.rotation);
      this.orthographicCamera.zoom = 1;
      this.orthographicCamera.left = -halfWidth;
      this.orthographicCamera.right = halfWidth;
      this.orthographicCamera.top = halfHeight;
      this.orthographicCamera.bottom = -halfHeight;
      const extent = Math.max(dist, radius) * 50;
      this.orthographicCamera.near = -extent;
      this.orthographicCamera.far = extent;
      this.orthographicCamera.updateProjectionMatrix();

      this.currentCamera = this.orthographicCamera;
      this.controls.object = this.orthographicCamera;
    } else {
      // Orthographic -> Perspective transition: maintain apparent size at target
      const halfHeight = (this.orthographicCamera.top - this.orthographicCamera.bottom) / (2 * this.orthographicCamera.zoom);
      const targetDist = halfHeight / Math.tan(THREE.MathUtils.degToRad(this.perspectiveCamera.fov / 2));

      const dir = new THREE.Vector3().subVectors(this.orthographicCamera.position, this.controls.target).normalize();
      if (dir.lengthSq() < 1e-12) dir.set(1, 0.85, 1).normalize();

      this.perspectiveCamera.position.copy(this.controls.target).addScaledVector(dir, targetDist);
      this.perspectiveCamera.rotation.copy(this.orthographicCamera.rotation);
      this.perspectiveCamera.near = Math.max(Math.min(targetDist * 0.002, radius * 0.002), 1e-7);
      this.perspectiveCamera.far = Math.max(targetDist * 200, radius * 500, 100);
      this.perspectiveCamera.updateProjectionMatrix();

      this.currentCamera = this.perspectiveCamera;
      this.controls.object = this.perspectiveCamera;
    }
    this.controls.update();
  }

  public toggleLayer(layer: 'points' | 'lines' | 'surfaces' | 'wireframe' | 'labels' | 'grid' | 'axes', enabled: boolean) {
    switch (layer) {
      case 'points':
        this.showPoints = enabled;
        this.pointsGroup.visible = enabled;
        this.labelManager.setPointLabelsVisible(enabled);
        if (enabled) this.updatePointMarkerScales();
        break;
      case 'lines':
        this.showLines = enabled;
        this.linesGroup.visible = enabled;
        this.labelManager.setLineLabelsVisible(enabled);
        break;
      case 'surfaces':
        this.showSurfaces = enabled;
        this.surfacesGroup.visible = enabled;
        this.labelManager.setSurfaceLabelsVisible(enabled);
        break;
      case 'wireframe':
        this.showWireframe = enabled;
        this.wireframeGroup.visible = enabled;
        break;
      case 'labels':
        this.showLabels = enabled;
        this.labelManager.setVisible(enabled);
        break;
      case 'grid':
      case 'axes':
        this.showGrid = enabled;
        this.showAxes = enabled;
        this.gridInfo.visible = enabled;
        this.onGridUpdate?.(this.gridInfo);
        this.helpersGroup.visible = enabled;
        if (this.gridLines) this.gridLines.visible = enabled;
        if (this.axesHelper) this.axesHelper.visible = enabled;
        if (enabled) this.updateAdaptiveGrid();
        break;
    }
  }

  private clearGroup(group: THREE.Group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) {
        if (Array.isArray((child as any).material)) {
          (child as any).material.forEach((m: any) => m.dispose());
        } else {
          (child as any).material.dispose();
        }
      }
    }
  }

  private updateLights() {
    // Keep lights aligned with the current camera view for clean, consistent CAD-style illumination
    const cam = this.currentCamera;
    const target = this.controls.target;

    const forward = new THREE.Vector3().subVectors(cam.position, target).normalize();
    if (forward.lengthSq() < 1e-4) forward.set(0, 0, 1);
    const up = cam.up.clone().normalize();
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const actualUp = new THREE.Vector3().crossVectors(forward, right).normalize();

    // Key light: slightly upper-right relative to camera view
    this.dirLight1.position.copy(target).addScaledVector(forward, 20).addScaledVector(right, 8).addScaledVector(actualUp, 12);
    this.dirLight1.target.position.copy(target);

    // Fill light: slightly lower-left relative to camera view (neutral white)
    this.dirLight2.position.copy(target).addScaledVector(forward, 20).addScaledVector(right, -8).addScaledVector(actualUp, -6);
    this.dirLight2.target.position.copy(target);
  }

  /**
   * Keep point marker spheres at a constant screen-space diameter (10px) regardless of camera zoom
   */
  private updatePointMarkerScales() {
    const viewportHeight = this.renderer.domElement.clientHeight;
    if (viewportHeight <= 0) return;

    const hasPoints = this.showPoints && this.pointsGroup.children.length > 0;
    const hasHighlight = this.highlightGroup.children.length > 0;
    if (!hasPoints && !hasHighlight) return;

    const cam = this.currentCamera;
    if (cam instanceof THREE.PerspectiveCamera) {
      const fovFactor = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / viewportHeight;
      const camPos = cam.position;

      if (hasPoints) {
        const factor = this.pointPixelDiameter * fovFactor;
        const children = this.pointsGroup.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const dist = camPos.distanceTo(child.position);
          child.scale.setScalar(Math.max(dist * factor, 1e-9));
        }
      }

      if (hasHighlight) {
        const factor = this.highlightPointPixelDiameter * fovFactor;
        const children = this.highlightGroup.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.userData.isHighlightPoint) {
            const dist = camPos.distanceTo(child.position);
            child.scale.setScalar(Math.max(dist * factor, 1e-9));
          }
        }
      }
    } else if (cam instanceof THREE.OrthographicCamera) {
      const frustumHeight = (cam.top - cam.bottom) / cam.zoom;
      const unitPerPx = frustumHeight / viewportHeight;

      if (hasPoints) {
        const diameter = Math.max(this.pointPixelDiameter * unitPerPx, 1e-9);
        const children = this.pointsGroup.children;
        for (let i = 0; i < children.length; i++) {
          children[i].scale.setScalar(diameter);
        }
      }

      if (hasHighlight) {
        const diameter = Math.max(this.highlightPointPixelDiameter * unitPerPx, 1e-9);
        const children = this.highlightGroup.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.userData.isHighlightPoint) {
            child.scale.setScalar(diameter);
          }
        }
      }
    }
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.updateClippingPlanes();
    this.updateLights();
    this.updateAdaptiveGrid();
    this.updatePointMarkerScales();
    this.labelManager.updateScales(this.currentCamera, this.renderer.domElement.clientWidth, this.renderer.domElement.clientHeight);
    this.renderer.render(this.scene, this.currentCamera);
  };
}
