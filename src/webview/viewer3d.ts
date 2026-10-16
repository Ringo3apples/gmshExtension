import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshData, GeometricPoint, GeometricLine } from '../types';
import { LabelManager } from './labelManager';

export interface ViewerOptions {
  container: HTMLElement;
  onSelectEntity?: (entityType: 'point' | 'line' | 'surface', tag: number) => void;
  onHoverEntity?: (info: { type: string; tag: number; coords?: [number, number, number] } | null) => void;
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

  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;

  // Stored active mesh data
  private currentMeshData: MeshData | null = null;
  private boundingSphere: THREE.Sphere = new THREE.Sphere();

  // Interaction
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private onSelectEntity?: (entityType: 'point' | 'line' | 'surface', tag: number) => void;
  private onHoverEntity?: (info: { type: string; tag: number; coords?: [number, number, number] } | null) => void;

  // Display toggles
  public showPoints: boolean = true;
  public showLines: boolean = true;
  public showSurfaces: boolean = true;
  public showWireframe: boolean = true;
  public showAxes: boolean = true;
  public showGrid: boolean = true;
  public isOrtho: boolean = false;

  constructor(options: ViewerOptions) {
    this.container = options.container;
    this.onSelectEntity = options.onSelectEntity;
    this.onHoverEntity = options.onHoverEntity;

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

    // 5. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(10, 20, 15);
    this.scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.4);
    dirLight2.position.set(-10, -10, -10);
    this.scene.add(dirLight2);

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

    const d = this.boundingSphere.radius || 5;
    this.orthographicCamera.left = -d * aspect;
    this.orthographicCamera.right = d * aspect;
    this.orthographicCamera.top = d;
    this.orthographicCamera.bottom = -d;
    this.orthographicCamera.updateProjectionMatrix();

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
        const geom = new THREE.SphereGeometry(this.boundingSphere.radius * 0.035, 16, 16);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0055, depthTest: false });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(pt.x, pt.y, pt.z);
        this.highlightGroup.add(mesh);
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
    this.clearHighlight();

    if (!data.nodes || data.nodes.length === 0) return;

    // 1. Calculate Bounding Box and Center
    const min = new THREE.Vector3(...data.bbox.min);
    const max = new THREE.Vector3(...data.bbox.max);
    const box = new THREE.Box3(min, max);
    box.getBoundingSphere(this.boundingSphere);

    const radius = Math.max(this.boundingSphere.radius, 0.5);
    const center = this.boundingSphere.center;

    // 2. Setup Helpers (Grid and Axes)
    this.updateHelpers(center, radius);

    // 3. Render Points as small spheres or custom meshes for high visibility
    const pointGeom = new THREE.SphereGeometry(radius * 0.015, 12, 12);
    const pointMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8, // Sky blue
      roughness: 0.3,
      metalness: 0.2
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

    // 5. Render Surfaces
    if (data.surfaceTriangles.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(data.nodes, 3));
      geom.setIndex(data.surfaceTriangles);
      geom.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        color: 0x475569, // Slate
        roughness: 0.5,
        metalness: 0.1,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });

      const mesh = new THREE.Mesh(geom, mat);
      this.surfacesGroup.add(mesh);

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

    // 7. Update Labels
    this.labelManager.updateLabels(data.points, data.lines, data.nodes, radius);

    // Apply visibility states
    this.pointsGroup.visible = this.showPoints;
    this.linesGroup.visible = this.showLines;
    this.surfacesGroup.visible = this.showSurfaces;
    this.wireframeGroup.visible = this.showWireframe;

    if (isFirstLoad) {
      this.resetView();
    }
  }

  private updateHelpers(center: THREE.Vector3, radius: number) {
    const size = Math.max(radius * 2.5, 5);
    const divisions = 20;

    this.gridHelper = new THREE.GridHelper(size, divisions, 0x334155, 0x1e293b);
    this.gridHelper.position.set(center.x, center.y - radius, center.z);
    this.helpersGroup.add(this.gridHelper);

    this.axesHelper = new THREE.AxesHelper(radius * 0.8);
    this.axesHelper.position.set(center.x - radius, center.y - radius, center.z - radius);
    this.helpersGroup.add(this.axesHelper);

    this.helpersGroup.visible = this.showAxes || this.showGrid;
    this.gridHelper.visible = this.showGrid;
    this.axesHelper.visible = this.showAxes;
  }

  public resetView() {
    if (!this.currentMeshData) return;
    const center = this.boundingSphere.center;
    const radius = Math.max(this.boundingSphere.radius, 0.5);

    this.controls.target.copy(center);

    const dist = radius * 2.8;
    this.perspectiveCamera.position.set(center.x + dist, center.y + dist * 0.8, center.z + dist);
    this.perspectiveCamera.near = Math.max(radius * 0.001, 0.01);
    this.perspectiveCamera.far = radius * 50;
    this.perspectiveCamera.updateProjectionMatrix();

    this.controls.update();
  }

  public setView(view: 'top' | 'front' | 'side' | 'iso') {
    const center = this.boundingSphere.center;
    const dist = Math.max(this.boundingSphere.radius, 0.5) * 2.8;

    this.controls.target.copy(center);
    if (view === 'top') {
      this.currentCamera.position.set(center.x, center.y + dist, center.z + 0.0001);
    } else if (view === 'front') {
      this.currentCamera.position.set(center.x, center.y, center.z + dist);
    } else if (view === 'side') {
      this.currentCamera.position.set(center.x + dist, center.y, center.z);
    } else if (view === 'iso') {
      this.currentCamera.position.set(center.x + dist, center.y + dist * 0.8, center.z + dist);
    }
    this.controls.update();
  }

  public toggleProjection() {
    this.isOrtho = !this.isOrtho;
    const aspect = this.container.clientWidth / this.container.clientHeight;
    const d = this.boundingSphere.radius || 5;

    if (this.isOrtho) {
      this.orthographicCamera.left = -d * aspect;
      this.orthographicCamera.right = d * aspect;
      this.orthographicCamera.top = d;
      this.orthographicCamera.bottom = -d;
      this.orthographicCamera.position.copy(this.perspectiveCamera.position);
      this.orthographicCamera.rotation.copy(this.perspectiveCamera.rotation);
      this.orthographicCamera.updateProjectionMatrix();

      this.currentCamera = this.orthographicCamera;
      this.controls.object = this.orthographicCamera;
    } else {
      this.perspectiveCamera.position.copy(this.orthographicCamera.position);
      this.perspectiveCamera.rotation.copy(this.orthographicCamera.rotation);
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
        break;
      case 'lines':
        this.showLines = enabled;
        this.linesGroup.visible = enabled;
        break;
      case 'surfaces':
        this.showSurfaces = enabled;
        this.surfacesGroup.visible = enabled;
        break;
      case 'wireframe':
        this.showWireframe = enabled;
        this.wireframeGroup.visible = enabled;
        break;
      case 'labels':
        this.labelManager.setVisible(enabled);
        break;
      case 'grid':
        this.showGrid = enabled;
        if (this.gridHelper) this.gridHelper.visible = enabled;
        break;
      case 'axes':
        this.showAxes = enabled;
        if (this.axesHelper) this.axesHelper.visible = enabled;
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

  private animate = () => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.currentCamera);
  };
}
