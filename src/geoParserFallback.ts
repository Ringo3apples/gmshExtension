import { MeshData, GeometricPoint, GeometricLine, BoundingBox, MeshStats } from './types';

/**
 * Lightweight fallback parser for .geo files when Gmsh CLI is unavailable or failing.
 * Extracts Points, Lines, Splines, and basic OpenCASCADE primitives.
 */
export function parseGeoFallback(geoContent: string): MeshData {
  const nodes: number[] = [];
  const nodeTags: number[] = [];
  const points: GeometricPoint[] = [];
  const lines: GeometricLine[] = [];
  const surfaceTriangles: number[] = [];
  const surfaceTags: number[] = [];

  const pointMap = new Map<number, { x: number; y: number; z: number; nodeIndex: number }>();
  const variables = new Map<string, number>();

  // Strip single-line (//) and multi-line (/* ... */) comments
  const cleanContent = geoContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const statements = cleanContent.split(';').map(s => s.trim()).filter(Boolean);

  const evalExpr = (expr: string): number => {
    try {
      let sanitized = expr.trim();
      for (const [vName, vVal] of variables.entries()) {
        sanitized = sanitized.replace(new RegExp(`\\b${vName}\\b`, 'g'), vVal.toString());
      }
      // Simple math evaluation
      // eslint-disable-next-line no-eval
      const res = Function(`"use strict"; return (${sanitized});`)();
      return typeof res === 'number' && !isNaN(res) ? res : 0;
    } catch {
      return 0;
    }
  };

  // First pass: extract variable assignments (e.g., lc = 0.1; R = 2.5;)
  for (const stmt of statements) {
    const varMatch = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (varMatch && !stmt.includes('(')) {
      const name = varMatch[1];
      const val = evalExpr(varMatch[2]);
      variables.set(name, val);
    }
  }

  // Second pass: extract geometry
  for (const stmt of statements) {
    // Point(tag) = {x, y, z, ...}
    const pointMatch = stmt.match(/Point\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (pointMatch) {
      const tag = parseInt(pointMatch[1], 10);
      const coords = pointMatch[2].split(',').map(s => evalExpr(s));
      const x = coords[0] || 0;
      const y = coords[1] || 0;
      const z = coords[2] || 0;

      const nodeIndex = nodes.length / 3;
      nodes.push(x, y, z);
      nodeTags.push(tag);

      const pt: GeometricPoint = { tag, nodeIndex, x, y, z };
      points.push(pt);
      pointMap.set(tag, { x, y, z, nodeIndex });
      continue;
    }

    // Line(tag) = {p1, p2}
    const lineMatch = stmt.match(/Line\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (lineMatch) {
      const tag = parseInt(lineMatch[1], 10);
      const ptTags = lineMatch[2].split(',').map(s => parseInt(s.trim(), 10));
      if (ptTags.length >= 2) {
        const p1 = pointMap.get(ptTags[0]);
        const p2 = pointMap.get(ptTags[1]);
        if (p1 && p2) {
          lines.push({
            tag,
            nodeIndices: [p1.nodeIndex, p2.nodeIndex]
          });
        }
      }
      continue;
    }

    // Circle / Spline / BSpline(tag) = {p1, p2, p3...}
    const splineMatch = stmt.match(/(?:Circle|Spline|BSpline|Bezier)\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (splineMatch) {
      const tag = parseInt(splineMatch[1], 10);
      const ptTags = splineMatch[2].split(',').map(s => parseInt(s.trim(), 10));
      const pairIndices: number[] = [];
      for (let i = 0; i < ptTags.length - 1; i++) {
        const pa = pointMap.get(ptTags[i]);
        const pb = pointMap.get(ptTags[i + 1]);
        if (pa && pb) {
          pairIndices.push(pa.nodeIndex, pb.nodeIndex);
        }
      }
      if (pairIndices.length > 0) {
        lines.push({ tag, nodeIndices: pairIndices });
      }
      continue;
    }

    // OpenCASCADE Box(tag) = {x, y, z, dx, dy, dz}
    const boxMatch = stmt.match(/Box\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (boxMatch) {
      const tag = parseInt(boxMatch[1], 10);
      const params = boxMatch[2].split(',').map(s => evalExpr(s));
      const [x, y, z, dx, dy, dz] = params;
      addBoxGeometry(tag, x || 0, y || 0, z || 0, dx || 1, dy || 1, dz || 1, nodes, nodeTags, points, lines, surfaceTriangles, surfaceTags);
      continue;
    }

    // OpenCASCADE Cylinder(tag) = {x, y, z, dx, dy, dz, r}
    const cylMatch = stmt.match(/Cylinder\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (cylMatch) {
      const tag = parseInt(cylMatch[1], 10);
      const params = cylMatch[2].split(',').map(s => evalExpr(s));
      const [x, y, z, dx, dy, dz, r] = params;
      addCylinderGeometry(tag, x || 0, y || 0, z || 0, dx || 0, dy || 0, dz || 1, r || 0.5, nodes, nodeTags, points, lines, surfaceTriangles, surfaceTags);
      continue;
    }

    // OpenCASCADE Sphere(tag) = {x, y, z, r}
    const sphereMatch = stmt.match(/Sphere\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (sphereMatch) {
      const tag = parseInt(sphereMatch[1], 10);
      const params = sphereMatch[2].split(',').map(s => evalExpr(s));
      const [x, y, z, r] = params;
      addSphereGeometry(tag, x || 0, y || 0, z || 0, r || 1, nodes, nodeTags, points, lines, surfaceTriangles, surfaceTags);
      continue;
    }
  }

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < nodes.length; i += 3) {
    const x = nodes[i], y = nodes[i + 1], z = nodes[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  if (minX === Infinity) {
    minX = -1; minY = -1; minZ = -1;
    maxX = 1; maxY = 1; maxZ = 1;
  }

  const bbox: BoundingBox = {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };

  const stats: MeshStats = {
    numNodes: nodes.length / 3,
    numElements: (surfaceTriangles.length / 3) + lines.length,
    numPoints: points.length,
    numCurves: lines.length,
    numSurfaces: new Set(surfaceTags).size,
    numVolumes: 0
  };

  return {
    nodes,
    nodeTags,
    points,
    lines,
    surfaceTriangles,
    surfaceTags,
    bbox,
    stats,
    isFallback: true
  };
}

function addBoxGeometry(
  tag: number,
  x: number, y: number, z: number,
  dx: number, dy: number, dz: number,
  nodes: number[], nodeTags: number[],
  points: GeometricPoint[], lines: GeometricLine[],
  triangles: number[], surfaceTags: number[]
) {
  const baseIdx = nodes.length / 3;
  // 8 corners of the box
  const corners = [
    [x, y, z],
    [x + dx, y, z],
    [x + dx, y + dy, z],
    [x, y + dy, z],
    [x, y, z + dz],
    [x + dx, y, z + dz],
    [x + dx, y + dy, z + dz],
    [x, y + dy, z + dz]
  ];

  corners.forEach((c, idx) => {
    nodes.push(c[0], c[1], c[2]);
    nodeTags.push(baseIdx + idx + 1);
    points.push({
      tag: baseIdx + idx + 1,
      nodeIndex: baseIdx + idx,
      x: c[0],
      y: c[1],
      z: c[2]
    });
  });

  // 12 edges
  const edgeIndices = [
    [0, 1], [1, 2], [2, 3], [3, 0], // bottom
    [4, 5], [5, 6], [6, 7], [7, 4], // top
    [0, 4], [1, 5], [2, 6], [3, 7]  // vertical
  ];

  const linePairs: number[] = [];
  edgeIndices.forEach(([a, b]) => {
    linePairs.push(baseIdx + a, baseIdx + b);
  });
  lines.push({ tag, nodeIndices: linePairs });

  // 6 faces (12 triangles)
  const faces = [
    [0, 2, 1], [0, 3, 2], // bottom
    [4, 5, 6], [4, 6, 7], // top
    [0, 1, 5], [0, 5, 4], // front
    [2, 3, 7], [2, 7, 6], // back
    [0, 4, 7], [0, 7, 3], // left
    [1, 2, 6], [1, 6, 5]  // right
  ];

  faces.forEach(([i1, i2, i3]) => {
    triangles.push(baseIdx + i1, baseIdx + i2, baseIdx + i3);
    surfaceTags.push(tag);
  });
}

function addCylinderGeometry(
  tag: number,
  x: number, y: number, z: number,
  dx: number, dy: number, dz: number, r: number,
  nodes: number[], nodeTags: number[],
  _points: GeometricPoint[], lines: GeometricLine[],
  triangles: number[], surfaceTags: number[]
) {
  const segments = 16;
  const baseIdx = nodes.length / 3;

  // Simple approximation along Z or delta vector
  for (let s = 0; s < segments; s++) {
    const theta = (s / segments) * 2 * Math.PI;
    const cx = Math.cos(theta) * r;
    const cy = Math.sin(theta) * r;

    // Bottom circle
    nodes.push(x + cx, y + cy, z);
    nodeTags.push(baseIdx + s * 2 + 1);

    // Top circle
    nodes.push(x + cx + dx, y + cy + dy, z + dz);
    nodeTags.push(baseIdx + s * 2 + 2);
  }

  const linePairs: number[] = [];
  for (let s = 0; s < segments; s++) {
    const next = (s + 1) % segments;
    const b1 = baseIdx + s * 2;
    const t1 = baseIdx + s * 2 + 1;
    const b2 = baseIdx + next * 2;
    const t2 = baseIdx + next * 2 + 1;

    linePairs.push(b1, b2); // bottom ring
    linePairs.push(t1, t2); // top ring
    linePairs.push(b1, t1); // vertical seam

    // Side quad as 2 triangles
    triangles.push(b1, b2, t2);
    surfaceTags.push(tag);
    triangles.push(b1, t2, t1);
    surfaceTags.push(tag);
  }
  lines.push({ tag, nodeIndices: linePairs });
}

function addSphereGeometry(
  tag: number,
  cx: number, cy: number, cz: number, r: number,
  nodes: number[], nodeTags: number[],
  _points: GeometricPoint[], _lines: GeometricLine[],
  triangles: number[], surfaceTags: number[]
) {
  const rings = 10;
  const segments = 16;
  const baseIdx = nodes.length / 3;

  for (let rIdx = 0; rIdx <= rings; rIdx++) {
    const phi = (rIdx / rings) * Math.PI;
    for (let sIdx = 0; sIdx <= segments; sIdx++) {
      const theta = (sIdx / segments) * 2 * Math.PI;
      const x = cx + r * Math.sin(phi) * Math.cos(theta);
      const y = cy + r * Math.sin(phi) * Math.sin(theta);
      const z = cz + r * Math.cos(phi);

      nodes.push(x, y, z);
      nodeTags.push(nodes.length / 3);
    }
  }

  for (let rIdx = 0; rIdx < rings; rIdx++) {
    for (let sIdx = 0; sIdx < segments; sIdx++) {
      const first = baseIdx + rIdx * (segments + 1) + sIdx;
      const second = first + segments + 1;

      triangles.push(first, second, first + 1);
      surfaceTags.push(tag);
      triangles.push(second, second + 1, first + 1);
      surfaceTags.push(tag);
    }
  }
}
