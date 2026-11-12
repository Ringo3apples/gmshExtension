import * as THREE from 'three';
import { MeshData, GeometricPoint, GeometricLine, BoundingBox, MeshStats } from './types';

/**
 * Geometry parser for .geo files (used when Gmsh CLI is disabled or as fallback).
 * Extracts Points, Lines, Circles (true 3D arcs), Splines, Curve Loops, Plane Surfaces / Surfaces,
 * and basic OpenCASCADE primitives (Box, Cylinder, Sphere, Rectangle, Disk).
 */
export function parseGeoFallback(geoContent: string): MeshData {
  const nodes: number[] = [];
  const nodeTags: number[] = [];
  const points: GeometricPoint[] = [];
  const lines: GeometricLine[] = [];
  const surfaceTriangles: number[] = [];
  const surfaceTags: number[] = [];

  const pointMap = new Map<number, { x: number; y: number; z: number; nodeIndex: number }>();
  const curvePolylines = new Map<number, number[]>(); // curveTag -> sequential nodeIndices
  const curveLoops = new Map<number, number[]>();     // loopTag -> closed sequential nodeIndices (unique loop)
  const variables = new Map<string, number>();

  let nextPointTag = 1;
  let nextCurveTag = 1;
  let nextLoopTag = 1;
  let nextSurfaceTag = 1;
  let nextVolumeTag = 1;

  // Strip single-line (//) and multi-line (/* ... */) comments
  const cleanContent = geoContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const statements = cleanContent.split(';').map(s => s.trim()).filter(Boolean);

  const evalExpr = (expr: string): number => {
    try {
      let sanitized = expr.trim();
      if (!sanitized) return 0;

      // Replace Gmsh built-in auto-id keywords if encountered directly in expressions
      if (sanitized === 'newp') return nextPointTag;
      if (sanitized === 'newc') return nextCurveTag;
      if (sanitized === 'newcl') return nextLoopTag;
      if (sanitized === 'news') return nextSurfaceTag;
      if (sanitized === 'newv') return nextVolumeTag;

      // Normalize array index syntax e.g. s_shaft[0] -> s_shaft__0
      sanitized = sanitized.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*(\d+)\s*\]/g, '$1__$2');

      // Substitute known variables (longest names first to avoid partial matches)
      const sortedVars = Array.from(variables.entries()).sort((a, b) => b[0].length - a[0].length);
      for (const [vName, vVal] of sortedVars) {
        sanitized = sanitized.replace(new RegExp(`\\b${vName}\\b`, 'g'), `(${vVal})`);
      }

      // Map Gmsh math constants & functions to JS Math
      sanitized = sanitized
        .replace(/\bPi\b/g, 'Math.PI')
        .replace(/\bCos\b/gi, 'Math.cos')
        .replace(/\bSin\b/gi, 'Math.sin')
        .replace(/\bTan\b/gi, 'Math.tan')
        .replace(/\bAcos\b/gi, 'Math.acos')
        .replace(/\bAsin\b/gi, 'Math.asin')
        .replace(/\bAtan2\b/gi, 'Math.atan2')
        .replace(/\bAtan\b/gi, 'Math.atan')
        .replace(/\bSqrt\b/gi, 'Math.sqrt')
        .replace(/\bFabs\b/gi, 'Math.abs')
        .replace(/\bAbs\b/gi, 'Math.abs')
        .replace(/\bPow\b/gi, 'Math.pow')
        .replace(/\bExp\b/gi, 'Math.exp')
        .replace(/\bLog10\b/gi, 'Math.log10')
        .replace(/\bLog\b/gi, 'Math.log')
        .replace(/\bFloor\b/gi, 'Math.floor')
        .replace(/\bCeil\b/gi, 'Math.ceil')
        .replace(/\bRound\b/gi, 'Math.round')
        .replace(/\bMin\b/gi, 'Math.min')
        .replace(/\bMax\b/gi, 'Math.max');

      // eslint-disable-next-line no-new-func
      const res = Function(`"use strict"; return (${sanitized});`)();
      return typeof res === 'number' && !isNaN(res) && isFinite(res) ? res : 0;
    } catch {
      return 0;
    }
  };

  const bumpTag = (kind: 'p' | 'c' | 'cl' | 's' | 'v', tag: number) => {
    if (kind === 'p' && tag >= nextPointTag) nextPointTag = tag + 1;
    if (kind === 'c' && tag >= nextCurveTag) nextCurveTag = tag + 1;
    if (kind === 'cl' && tag >= nextLoopTag) nextLoopTag = tag + 1;
    if (kind === 's' && tag >= nextSurfaceTag) nextSurfaceTag = tag + 1;
    if (kind === 'v' && tag >= nextVolumeTag) nextVolumeTag = tag + 1;
  };

  const addNode = (x: number, y: number, z: number): number => {
    const idx = nodes.length / 3;
    nodes.push(x, y, z);
    nodeTags.push(idx + 1);
    return idx;
  };

  const addPolylineAsLine = (tag: number, poly: number[]) => {
    if (poly.length < 2) return;
    const pairs: number[] = [];
    for (let i = 0; i < poly.length - 1; i++) {
      pairs.push(poly[i], poly[i + 1]);
    }
    lines.push({ tag, nodeIndices: pairs });
    curvePolylines.set(tag, poly);
  };

  // Single-pass sequential evaluation so variables, newp/newc/news, and geometry stay in order
  for (const stmt of statements) {
    // Array element assignment: arr[] = {news} or arr[] = {expr}
    const arrAssignMatch = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*\]\s*=\s*\{\s*([^}]+)\s*\}$/);
    if (arrAssignMatch) {
      const baseName = arrAssignMatch[1];
      const items = arrAssignMatch[2].split(',');
      items.forEach((item, idx) => {
        const val = evalExpr(item);
        variables.set(`${baseName}__${idx}`, val);
      });
      continue;
    }

    // Scalar variable assignment: x = expr (excluding commands with parentheses on LHS)
    const varMatch = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (varMatch && !varMatch[1].match(/^(Point|Line|Circle|Spline|BSpline|Bezier|Curve|Plane|Surface|Box|Cylinder|Sphere|Rectangle|Disk|Volume|Physical|Mesh)/i)) {
      const name = varMatch[1];
      const rhs = varMatch[2].trim();
      if (rhs === 'newp') {
        variables.set(name, nextPointTag++);
        continue;
      } else if (rhs === 'newc') {
        variables.set(name, nextCurveTag++);
        continue;
      } else if (rhs === 'newcl') {
        variables.set(name, nextLoopTag++);
        continue;
      } else if (rhs === 'news') {
        variables.set(name, nextSurfaceTag++);
        continue;
      } else if (rhs === 'newv') {
        variables.set(name, nextVolumeTag++);
        continue;
      } else if (!rhs.startsWith('{') && !/\b(?:Boundary|Extrude|Rotate|Translate|Boolean|Fillet)\b/i.test(rhs)) {
        const val = evalExpr(rhs);
        variables.set(name, val);
        continue;
      }
    }

    // Point(tag) = {x, y, z, ...}
    const pointMatch = stmt.match(/Point\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (pointMatch) {
      const tag = Math.round(evalExpr(pointMatch[1]));
      bumpTag('p', tag);
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
    const lineMatch = stmt.match(/^Line\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (lineMatch) {
      const tag = Math.round(evalExpr(lineMatch[1]));
      bumpTag('c', tag);
      const ptTags = lineMatch[2].split(',').map(s => Math.round(evalExpr(s)));
      if (ptTags.length >= 2) {
        const poly: number[] = [];
        for (const ptTag of ptTags) {
          const p = pointMap.get(ptTag);
          if (p) poly.push(p.nodeIndex);
        }
        addPolylineAsLine(tag, poly);
      }
      continue;
    }

    // Circle(tag) = {pStart, pCenter, pEnd} OR OpenCASCADE Circle(tag) = {x, y, z, r [, a1, a2]}
    const circleMatch = stmt.match(/^Circle\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (circleMatch) {
      const tag = Math.round(evalExpr(circleMatch[1]));
      bumpTag('c', tag);
      const rawArgs = circleMatch[2].split(',').map(s => evalExpr(s));

      if (rawArgs.length === 3) {
        // Standard 3-point arc: {startTag, centerTag, endTag}
        const pStart = pointMap.get(Math.round(rawArgs[0]));
        const pCenter = pointMap.get(Math.round(rawArgs[1]));
        const pEnd = pointMap.get(Math.round(rawArgs[2]));

        if (pStart && pCenter && pEnd) {
          const sVec = new THREE.Vector3(pStart.x, pStart.y, pStart.z);
          const cVec = new THREE.Vector3(pCenter.x, pCenter.y, pCenter.z);
          const eVec = new THREE.Vector3(pEnd.x, pEnd.y, pEnd.z);

          const u = sVec.clone().sub(cVec);
          const v = eVec.clone().sub(cVec);
          const rStart = u.length();

          if (rStart > 1e-12) {
            const uDir = u.clone().normalize();
            let normal = new THREE.Vector3().crossVectors(u, v);
            if (normal.lengthSq() < 1e-18) {
              // Collinear (e.g. 180 deg arc): pick an orthogonal axis
              normal.set(0, 0, 1);
              if (Math.abs(uDir.dot(normal)) > 0.99) normal.set(0, 1, 0);
              normal.crossVectors(uDir, normal).normalize();
            } else {
              normal.normalize();
            }

            const wDir = new THREE.Vector3().crossVectors(normal, uDir).normalize();
            let angle = Math.atan2(v.dot(wDir), v.dot(uDir));
            if (angle <= 1e-9) angle += 2 * Math.PI;

            const segs = Math.max(8, Math.min(48, Math.ceil((angle / Math.PI) * 24)));
            const poly: number[] = [pStart.nodeIndex];

            for (let s = 1; s < segs; s++) {
              const t = (s / segs) * angle;
              const ptPos = cVec
                .clone()
                .addScaledVector(uDir, rStart * Math.cos(t))
                .addScaledVector(wDir, rStart * Math.sin(t));
              poly.push(addNode(ptPos.x, ptPos.y, ptPos.z));
            }
            poly.push(pEnd.nodeIndex);
            addPolylineAsLine(tag, poly);
          } else {
            addPolylineAsLine(tag, [pStart.nodeIndex, pEnd.nodeIndex]);
          }
        }
      } else if (rawArgs.length >= 4) {
        // OpenCASCADE Circle(tag) = {x, y, z, r [, angle1, angle2]}
        const cx = rawArgs[0] || 0;
        const cy = rawArgs[1] || 0;
        const cz = rawArgs[2] || 0;
        const r = Math.abs(rawArgs[3] || 1);
        const a1 = rawArgs.length >= 5 ? rawArgs[4] : 0;
        const a2 = rawArgs.length >= 6 ? rawArgs[5] : 2 * Math.PI;
        const span = a2 - a1;
        const segs = Math.max(12, Math.min(64, Math.ceil((Math.abs(span) / Math.PI) * 24)));
        const poly: number[] = [];
        for (let s = 0; s <= segs; s++) {
          const theta = a1 + (s / segs) * span;
          poly.push(addNode(cx + r * Math.cos(theta), cy + r * Math.sin(theta), cz));
        }
        addPolylineAsLine(tag, poly);
      }
      continue;
    }

    // Spline / BSpline / Bezier(tag) = {p1, p2, p3...}
    const splineMatch = stmt.match(/^(?:Spline|BSpline|Bezier)\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (splineMatch) {
      const tag = Math.round(evalExpr(splineMatch[1]));
      bumpTag('c', tag);
      const ptTags = splineMatch[2].split(',').map(s => Math.round(evalExpr(s)));
      const poly: number[] = [];
      for (const ptTag of ptTags) {
        const p = pointMap.get(ptTag);
        if (p) poly.push(p.nodeIndex);
      }
      addPolylineAsLine(tag, poly);
      continue;
    }

    // Curve Loop / Line Loop(tag) = {c1, c2, ...}
    const loopMatch = stmt.match(/^(?:Curve|Line)\s+Loop\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (loopMatch) {
      const tag = Math.round(evalExpr(loopMatch[1]));
      bumpTag('cl', tag);
      const curveRefs = loopMatch[2].split(',').map(s => Math.round(evalExpr(s)));
      const loopNodes: number[] = [];

      for (const ref of curveRefs) {
        const cTag = Math.abs(ref);
        const seg = curvePolylines.get(cTag);
        if (!seg || seg.length === 0) continue;

        const ordered = ref < 0 ? [...seg].reverse() : seg;
        for (const nIdx of ordered) {
          if (loopNodes.length === 0 || loopNodes[loopNodes.length - 1] !== nIdx) {
            loopNodes.push(nIdx);
          }
        }
      }

      // Remove duplicate closing vertex if it wraps back to the first vertex
      if (loopNodes.length > 2 && loopNodes[loopNodes.length - 1] === loopNodes[0]) {
        loopNodes.pop();
      }

      if (loopNodes.length >= 3) {
        curveLoops.set(tag, loopNodes);
      }
      continue;
    }

    // Plane Surface / Surface(tag) = {loop1, loop2, ...}
    const surfMatch = stmt.match(/^(?:Plane\s+)?Surface\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (surfMatch) {
      const tag = Math.round(evalExpr(surfMatch[1]));
      bumpTag('s', tag);
      const loopRefs = surfMatch[2].split(',').map(s => Math.round(evalExpr(s)));

      const outerLoop = curveLoops.get(Math.abs(loopRefs[0]));
      if (outerLoop && outerLoop.length >= 3) {
        const holeLoops: number[][] = [];
        for (let h = 1; h < loopRefs.length; h++) {
          const hl = curveLoops.get(Math.abs(loopRefs[h]));
          if (hl && hl.length >= 3) holeLoops.push(hl);
        }
        triangulateSurfaceLoops(tag, outerLoop, holeLoops, nodes, surfaceTriangles, surfaceTags);
      }
      continue;
    }

    // OpenCASCADE Rectangle(tag) = {x, y, z, dx, dy}
    const rectMatch = stmt.match(/^Rectangle\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (rectMatch) {
      const tag = Math.round(evalExpr(rectMatch[1]));
      bumpTag('s', tag);
      const params = rectMatch[2].split(',').map(s => evalExpr(s));
      const [x = 0, y = 0, z = 0, dx = 1, dy = 1] = params;
      addRectangleGeometry(tag, x, y, z, dx, dy, nodes, nodeTags, points, lines, surfaceTriangles, surfaceTags);
      continue;
    }

    // OpenCASCADE Disk(tag) = {x, y, z, rx [, ry]}
    const diskMatch = stmt.match(/^Disk\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (diskMatch) {
      const tag = Math.round(evalExpr(diskMatch[1]));
      bumpTag('s', tag);
      const params = diskMatch[2].split(',').map(s => evalExpr(s));
      const [x = 0, y = 0, z = 0, rx = 1, ry = rx] = params;
      addDiskGeometry(tag, x, y, z, rx, ry, nodes, nodeTags, lines, surfaceTriangles, surfaceTags);
      continue;
    }

    // OpenCASCADE Box(tag) = {x, y, z, dx, dy, dz}
    const boxMatch = stmt.match(/^Box\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (boxMatch) {
      const tag = Math.round(evalExpr(boxMatch[1]));
      bumpTag('v', tag);
      const params = boxMatch[2].split(',').map(s => evalExpr(s));
      const [x = 0, y = 0, z = 0, dx = 1, dy = 1, dz = 1] = params;
      addBoxGeometry(tag, x, y, z, dx, dy, dz, nodes, nodeTags, points, lines, surfaceTriangles, surfaceTags);
      continue;
    }

    // OpenCASCADE Cylinder(tag) = {x, y, z, dx, dy, dz, r}
    const cylMatch = stmt.match(/^Cylinder\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (cylMatch) {
      const tag = Math.round(evalExpr(cylMatch[1]));
      bumpTag('v', tag);
      const params = cylMatch[2].split(',').map(s => evalExpr(s));
      const [x = 0, y = 0, z = 0, dx = 0, dy = 0, dz = 1, r = 0.5] = params;
      addCylinderGeometry(tag, x, y, z, dx, dy, dz, r, nodes, nodeTags, points, lines, surfaceTriangles, surfaceTags);
      continue;
    }

    // OpenCASCADE Sphere(tag) = {x, y, z, r}
    const sphereMatch = stmt.match(/^Sphere\s*\(\s*([^)]+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (sphereMatch) {
      const tag = Math.round(evalExpr(sphereMatch[1]));
      bumpTag('v', tag);
      const params = sphereMatch[2].split(',').map(s => evalExpr(s));
      const [x = 0, y = 0, z = 0, r = 1] = params;
      addSphereGeometry(tag, x, y, z, r, nodes, nodeTags, points, lines, surfaceTriangles, surfaceTags);
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
    isFallback: true,
    labelMode: 'geo'
  };
}

/**
 * Projects 3D curve loop (and optional hole loops) onto its best-fit plane via Newell's method
 * and triangulates using THREE.ShapeUtils.triangulateShape.
 */
function triangulateSurfaceLoops(
  surfaceTag: number,
  outerLoop: number[],
  holeLoops: number[][],
  nodes: number[],
  triangles: number[],
  surfaceTags: number[]
) {
  // Compute polygon normal using Newell's method on outer loop
  let nx = 0, ny = 0, nz = 0;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < outerLoop.length; i++) {
    const iCurr = outerLoop[i];
    const iNext = outerLoop[(i + 1) % outerLoop.length];
    const ax = nodes[iCurr * 3], ay = nodes[iCurr * 3 + 1], az = nodes[iCurr * 3 + 2];
    const bx = nodes[iNext * 3], by = nodes[iNext * 3 + 1], bz = nodes[iNext * 3 + 2];
    nx += (ay - by) * (az + bz);
    ny += (az - bz) * (ax + bx);
    nz += (ax - bx) * (ay + by);
    cx += ax;
    cy += ay;
    cz += az;
  }

  const normal = new THREE.Vector3(nx, ny, nz);
  if (normal.lengthSq() < 1e-18) {
    normal.set(0, 0, 1);
  } else {
    normal.normalize();
  }

  const origin = new THREE.Vector3(
    cx / outerLoop.length,
    cy / outerLoop.length,
    cz / outerLoop.length
  );

  // Build orthonormal 2D basis (e1, e2) in the plane perpendicular to normal
  const ref = Math.abs(normal.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
  const e1 = new THREE.Vector3().crossVectors(ref, normal).normalize();
  const e2 = new THREE.Vector3().crossVectors(normal, e1).normalize();

  const to2D = (nodeIdx: number): THREE.Vector2 => {
    const dx = nodes[nodeIdx * 3] - origin.x;
    const dy = nodes[nodeIdx * 3 + 1] - origin.y;
    const dz = nodes[nodeIdx * 3 + 2] - origin.z;
    return new THREE.Vector2(
      dx * e1.x + dy * e1.y + dz * e1.z,
      dx * e2.x + dy * e2.y + dz * e2.z
    );
  };

  const contour2D = outerLoop.map(to2D);
  const holes2D = holeLoops.map(hl => hl.map(to2D));
  const combinedIndices = [...outerLoop];
  for (const hl of holeLoops) {
    combinedIndices.push(...hl);
  }

  const faces = THREE.ShapeUtils.triangulateShape(contour2D, holes2D);
  for (const face of faces) {
    const i0 = combinedIndices[face[0]];
    const i1 = combinedIndices[face[1]];
    const i2 = combinedIndices[face[2]];
    if (i0 !== undefined && i1 !== undefined && i2 !== undefined) {
      triangles.push(i0, i1, i2);
      surfaceTags.push(surfaceTag);
    }
  }
}

function addRectangleGeometry(
  tag: number,
  x: number, y: number, z: number,
  dx: number, dy: number,
  nodes: number[], nodeTags: number[],
  points: GeometricPoint[], lines: GeometricLine[],
  triangles: number[], surfaceTags: number[]
) {
  const baseIdx = nodes.length / 3;
  const corners = [
    [x, y, z],
    [x + dx, y, z],
    [x + dx, y + dy, z],
    [x, y + dy, z]
  ];
  corners.forEach((c, idx) => {
    nodes.push(c[0], c[1], c[2]);
    nodeTags.push(baseIdx + idx + 1);
    points.push({
      tag: baseIdx + idx + 1,
      nodeIndex: baseIdx + idx,
      x: c[0], y: c[1], z: c[2]
    });
  });

  lines.push({
    tag,
    nodeIndices: [baseIdx, baseIdx + 1, baseIdx + 1, baseIdx + 2, baseIdx + 2, baseIdx + 3, baseIdx + 3, baseIdx]
  });

  triangles.push(baseIdx, baseIdx + 1, baseIdx + 2);
  surfaceTags.push(tag);
  triangles.push(baseIdx, baseIdx + 2, baseIdx + 3);
  surfaceTags.push(tag);
}

function addDiskGeometry(
  tag: number,
  cx: number, cy: number, cz: number,
  rx: number, ry: number,
  nodes: number[], nodeTags: number[],
  lines: GeometricLine[],
  triangles: number[], surfaceTags: number[]
) {
  const segments = 32;
  const centerIdx = nodes.length / 3;
  nodes.push(cx, cy, cz);
  nodeTags.push(centerIdx + 1);

  const ringStartIdx = nodes.length / 3;
  const linePairs: number[] = [];
  for (let s = 0; s < segments; s++) {
    const theta = (s / segments) * 2 * Math.PI;
    nodes.push(cx + rx * Math.cos(theta), cy + ry * Math.sin(theta), cz);
    nodeTags.push(ringStartIdx + s + 1);

    const curr = ringStartIdx + s;
    const next = ringStartIdx + ((s + 1) % segments);
    linePairs.push(curr, next);
    triangles.push(centerIdx, curr, next);
    surfaceTags.push(tag);
  }
  lines.push({ tag, nodeIndices: linePairs });
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

  const edgeIndices = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  const linePairs: number[] = [];
  edgeIndices.forEach(([a, b]) => {
    linePairs.push(baseIdx + a, baseIdx + b);
  });
  lines.push({ tag, nodeIndices: linePairs });

  const faces = [
    [0, 2, 1], [0, 3, 2],
    [4, 5, 6], [4, 6, 7],
    [0, 1, 5], [0, 5, 4],
    [2, 3, 7], [2, 7, 6],
    [0, 4, 7], [0, 7, 3],
    [1, 2, 6], [1, 6, 5]
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

  for (let s = 0; s < segments; s++) {
    const theta = (s / segments) * 2 * Math.PI;
    const cx = Math.cos(theta) * r;
    const cy = Math.sin(theta) * r;

    nodes.push(x + cx, y + cy, z);
    nodeTags.push(baseIdx + s * 2 + 1);

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

    linePairs.push(b1, b2);
    linePairs.push(t1, t2);
    linePairs.push(b1, t1);

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
