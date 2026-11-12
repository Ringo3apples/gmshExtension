export interface GeometricPoint {
  tag: number;
  nodeIndex: number;
  x: number;
  y: number;
  z: number;
  physicalName?: string;
}

export interface GeometricLine {
  tag: number;
  nodeIndices: number[]; // pairs of node indices [n1, n2, n2, n3, ...]
  physicalName?: string;
}

export interface PhysicalSurfaceLabel {
  tag: number;
  physicalName: string;
  x: number;
  y: number;
  z: number;
}

export interface GeometricSurface {
  tag: number;
  triangleIndices: number[]; // triplets of node indices [t0, t1, t2, ...]
}

export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
}

export interface MeshStats {
  numNodes: number;
  numElements: number;
  numPoints: number;
  numCurves: number;
  numSurfaces: number;
  numVolumes: number;
}

export interface MeshData {
  nodes: number[]; // Flat array [x0, y0, z0, x1, y1, z1, ...]
  nodeTags: number[];
  points: GeometricPoint[];
  lines: GeometricLine[];
  surfaceTriangles: number[]; // Flat node index array for all surface triangles
  surfaceTags: number[]; // Surface entity tag corresponding to each triangle
  surfaceLabels?: PhysicalSurfaceLabel[];
  volumeTriangles?: number[]; // Triangles on volume boundary or tetrahedra wireframe
  bbox: BoundingBox;
  stats: MeshStats;
  isFallback?: boolean;
  labelMode?: 'geo' | 'physical';
}

export interface GmshResult {
  success: boolean;
  data?: MeshData;
  error?: string;
  errorLine?: number;
  rawOutput?: string;
  durationMs: number;
}

export interface ExtensionConfig {
  executablePath: string;
  meshDimension: number; // 0: geometry only, 1: 1D, 2: 2D, 3: 3D
  debounceDelay: number;
  pointSize: number;
  pointColor: string;
  lineColor: string;
  surfaceColor: string;
  meshWireframeColor: string;
  backgroundColor: string;
  showLabels: boolean;
  showAxes: boolean;
  showGrid: boolean;
  showPoints: boolean;
  showLines: boolean;
  showSurfaces: boolean;
  showMeshWireframe: boolean;
}

export type WebviewMessage =
  | { command: 'selectEntity'; entityType: 'point' | 'line' | 'surface'; tag: number }
  | { command: 'jumpToLine'; line?: number }
  | { command: 'requestRemesh'; dimension: number }
  | { command: 'openSettings' }
  | { command: 'autoDetect' }
  | { command: 'browseExecutable' }
  | { command: 'ready' }
  | { command: 'gridInfo'; step: number; size: number; visible: boolean }
  | { command: 'setGmshEnabled'; enabled: boolean };

export type ExtensionMessage =
  | { command: 'updateMesh'; data: MeshData; sourceFile: string }
  | { command: 'showError'; message: string; line?: number }
  | { command: 'clearError' }
  | { command: 'setLoading'; loading: boolean; message?: string }
  | { command: 'highlightEntity'; entityType: 'point' | 'line' | 'surface'; tag: number }
  | { command: 'updateConfig'; config: Partial<ExtensionConfig> };
