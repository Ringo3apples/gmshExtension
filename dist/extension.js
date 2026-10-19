"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/previewPanel.ts
var vscode = __toESM(require("vscode"));
var path3 = __toESM(require("path"));

// src/gmshRunner.ts
var cp2 = __toESM(require("child_process"));
var fs2 = __toESM(require("fs"));
var os2 = __toESM(require("os"));
var path2 = __toESM(require("path"));

// src/mshParser.ts
function parseMsh(content) {
  if (content.includes("$MeshFormat")) {
    const formatLine = content.split(/\r?\n/).find((l) => !l.startsWith("$") && l.trim().length > 0);
    if (formatLine && formatLine.trim().startsWith("4.")) {
      return parseMsh4(content);
    }
  }
  return parseMsh2(content);
}
function parseMsh4(content) {
  const lines = content.split(/\r?\n/);
  let lineIdx = 0;
  let totalNodesCount = 0;
  const nodes = [];
  const nodeTagToIndex = /* @__PURE__ */ new Map();
  const nodeTags = [];
  const points = [];
  const lineMap = /* @__PURE__ */ new Map();
  const surfaceTriangles = [];
  const surfaceTags = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let numCurves = 0;
  let numSurfaces = 0;
  let numVolumes = 0;
  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx++].trim();
    if (!rawLine) continue;
    if (rawLine === "$Entities") {
      const header = lines[lineIdx++].trim().split(/\s+/).map(Number);
      numCurves = header[1] || 0;
      numSurfaces = header[2] || 0;
      numVolumes = header[3] || 0;
      while (lineIdx < lines.length && lines[lineIdx].trim() !== "$EndEntities") {
        lineIdx++;
      }
      lineIdx++;
    } else if (rawLine === "$Nodes") {
      const header = lines[lineIdx++].trim().split(/\s+/).map(Number);
      const numEntityBlocks = header[0] || 0;
      totalNodesCount = header[1] || 0;
      for (let b = 0; b < numEntityBlocks && lineIdx < lines.length; b++) {
        const blockHeader = lines[lineIdx++].trim().split(/\s+/).map(Number);
        const entityDim = blockHeader[0];
        const entityTag = blockHeader[1];
        const numNodesInBlock = blockHeader[3];
        const blockNodeTags = [];
        for (let n = 0; n < numNodesInBlock && lineIdx < lines.length; n++) {
          const tag = parseInt(lines[lineIdx++].trim(), 10);
          blockNodeTags.push(tag);
        }
        for (let n = 0; n < numNodesInBlock && lineIdx < lines.length; n++) {
          const coords = lines[lineIdx++].trim().split(/\s+/).map(Number);
          const x = coords[0] || 0;
          const y = coords[1] || 0;
          const z = coords[2] || 0;
          const globalNodeIndex = nodes.length / 3;
          nodes.push(x, y, z);
          const tag = blockNodeTags[n];
          nodeTagToIndex.set(tag, globalNodeIndex);
          nodeTags.push(tag);
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
          if (entityDim === 0) {
            points.push({
              tag: entityTag,
              nodeIndex: globalNodeIndex,
              x,
              y,
              z
            });
          }
        }
      }
      while (lineIdx < lines.length && lines[lineIdx].trim() !== "$EndNodes") {
        lineIdx++;
      }
      lineIdx++;
    } else if (rawLine === "$Elements") {
      const header = lines[lineIdx++].trim().split(/\s+/).map(Number);
      const numEntityBlocks = header[0] || 0;
      for (let b = 0; b < numEntityBlocks && lineIdx < lines.length; b++) {
        const blockHeader = lines[lineIdx++].trim().split(/\s+/).map(Number);
        const entityTag = blockHeader[1];
        const elementType = blockHeader[2];
        const numElementsInBlock = blockHeader[3];
        for (let e = 0; e < numElementsInBlock && lineIdx < lines.length; e++) {
          const elemParts = lines[lineIdx++].trim().split(/\s+/).map(Number);
          if (elementType === 15) {
            const nTag = elemParts[1];
            const idx = nodeTagToIndex.get(nTag);
            if (idx !== void 0 && !points.some((p) => p.tag === entityTag)) {
              points.push({
                tag: entityTag,
                nodeIndex: idx,
                x: nodes[idx * 3],
                y: nodes[idx * 3 + 1],
                z: nodes[idx * 3 + 2]
              });
            }
          } else if (elementType === 1) {
            const n1 = nodeTagToIndex.get(elemParts[1]);
            const n2 = nodeTagToIndex.get(elemParts[2]);
            if (n1 !== void 0 && n2 !== void 0) {
              if (!lineMap.has(entityTag)) lineMap.set(entityTag, []);
              lineMap.get(entityTag).push(n1, n2);
            }
          } else if (elementType === 2) {
            const n1 = nodeTagToIndex.get(elemParts[1]);
            const n2 = nodeTagToIndex.get(elemParts[2]);
            const n3 = nodeTagToIndex.get(elemParts[3]);
            if (n1 !== void 0 && n2 !== void 0 && n3 !== void 0) {
              surfaceTriangles.push(n1, n2, n3);
              surfaceTags.push(entityTag);
            }
          } else if (elementType === 3) {
            const n1 = nodeTagToIndex.get(elemParts[1]);
            const n2 = nodeTagToIndex.get(elemParts[2]);
            const n3 = nodeTagToIndex.get(elemParts[3]);
            const n4 = nodeTagToIndex.get(elemParts[4]);
            if (n1 !== void 0 && n2 !== void 0 && n3 !== void 0 && n4 !== void 0) {
              surfaceTriangles.push(n1, n2, n3);
              surfaceTags.push(entityTag);
              surfaceTriangles.push(n1, n3, n4);
              surfaceTags.push(entityTag);
            }
          } else if (elementType === 4) {
            const n1 = nodeTagToIndex.get(elemParts[1]);
            const n2 = nodeTagToIndex.get(elemParts[2]);
            const n3 = nodeTagToIndex.get(elemParts[3]);
            const n4 = nodeTagToIndex.get(elemParts[4]);
            if (n1 !== void 0 && n2 !== void 0 && n3 !== void 0 && n4 !== void 0) {
              surfaceTriangles.push(n1, n2, n3);
              surfaceTags.push(entityTag);
              surfaceTriangles.push(n1, n2, n4);
              surfaceTags.push(entityTag);
              surfaceTriangles.push(n2, n3, n4);
              surfaceTags.push(entityTag);
              surfaceTriangles.push(n3, n1, n4);
              surfaceTags.push(entityTag);
            }
          }
        }
      }
      while (lineIdx < lines.length && lines[lineIdx].trim() !== "$EndElements") {
        lineIdx++;
      }
      lineIdx++;
    }
  }
  const linesList = [];
  for (const [tag, nodeIndices] of lineMap.entries()) {
    linesList.push({ tag, nodeIndices });
  }
  if (minX === Infinity) {
    minX = -1;
    minY = -1;
    minZ = -1;
    maxX = 1;
    maxY = 1;
    maxZ = 1;
  }
  const bbox = {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };
  const stats = {
    numNodes: totalNodesCount || nodes.length / 3,
    numElements: surfaceTriangles.length / 3 + linesList.reduce((acc, l) => acc + l.nodeIndices.length / 2, 0),
    numPoints: points.length,
    numCurves: linesList.length || numCurves,
    numSurfaces,
    numVolumes
  };
  return {
    nodes,
    nodeTags,
    points,
    lines: linesList,
    surfaceTriangles,
    surfaceTags,
    bbox,
    stats
  };
}
function parseMsh2(content) {
  const lines = content.split(/\r?\n/);
  let lineIdx = 0;
  const nodes = [];
  const nodeTagToIndex = /* @__PURE__ */ new Map();
  const nodeTags = [];
  const points = [];
  const lineMap = /* @__PURE__ */ new Map();
  const surfaceTriangles = [];
  const surfaceTags = [];
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx++].trim();
    if (!rawLine) continue;
    if (rawLine === "$Nodes") {
      const numNodes = parseInt(lines[lineIdx++].trim(), 10) || 0;
      for (let i = 0; i < numNodes && lineIdx < lines.length; i++) {
        const parts = lines[lineIdx++].trim().split(/\s+/).map(Number);
        const tag = parts[0];
        const x = parts[1] || 0;
        const y = parts[2] || 0;
        const z = parts[3] || 0;
        const globalIdx = nodes.length / 3;
        nodes.push(x, y, z);
        nodeTagToIndex.set(tag, globalIdx);
        nodeTags.push(tag);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
      while (lineIdx < lines.length && lines[lineIdx].trim() !== "$EndNodes") {
        lineIdx++;
      }
      lineIdx++;
    } else if (rawLine === "$Elements") {
      const numElements = parseInt(lines[lineIdx++].trim(), 10) || 0;
      for (let i = 0; i < numElements && lineIdx < lines.length; i++) {
        const parts = lines[lineIdx++].trim().split(/\s+/).map(Number);
        const elmType = parts[1];
        const numTags = parts[2] || 0;
        const entityTag = numTags >= 2 ? parts[4] : numTags >= 1 ? parts[3] : 1;
        const nodeStart = 3 + numTags;
        if (elmType === 15) {
          const nTag = parts[nodeStart];
          const idx = nodeTagToIndex.get(nTag);
          if (idx !== void 0) {
            points.push({
              tag: entityTag,
              nodeIndex: idx,
              x: nodes[idx * 3],
              y: nodes[idx * 3 + 1],
              z: nodes[idx * 3 + 2]
            });
          }
        } else if (elmType === 1) {
          const n1 = nodeTagToIndex.get(parts[nodeStart]);
          const n2 = nodeTagToIndex.get(parts[nodeStart + 1]);
          if (n1 !== void 0 && n2 !== void 0) {
            if (!lineMap.has(entityTag)) lineMap.set(entityTag, []);
            lineMap.get(entityTag).push(n1, n2);
          }
        } else if (elmType === 2) {
          const n1 = nodeTagToIndex.get(parts[nodeStart]);
          const n2 = nodeTagToIndex.get(parts[nodeStart + 1]);
          const n3 = nodeTagToIndex.get(parts[nodeStart + 2]);
          if (n1 !== void 0 && n2 !== void 0 && n3 !== void 0) {
            surfaceTriangles.push(n1, n2, n3);
            surfaceTags.push(entityTag);
          }
        } else if (elmType === 3) {
          const n1 = nodeTagToIndex.get(parts[nodeStart]);
          const n2 = nodeTagToIndex.get(parts[nodeStart + 1]);
          const n3 = nodeTagToIndex.get(parts[nodeStart + 2]);
          const n4 = nodeTagToIndex.get(parts[nodeStart + 3]);
          if (n1 !== void 0 && n2 !== void 0 && n3 !== void 0 && n4 !== void 0) {
            surfaceTriangles.push(n1, n2, n3);
            surfaceTags.push(entityTag);
            surfaceTriangles.push(n1, n3, n4);
            surfaceTags.push(entityTag);
          }
        }
      }
      while (lineIdx < lines.length && lines[lineIdx].trim() !== "$EndElements") {
        lineIdx++;
      }
      lineIdx++;
    }
  }
  const linesList = [];
  for (const [tag, nodeIndices] of lineMap.entries()) {
    linesList.push({ tag, nodeIndices });
  }
  if (minX === Infinity) {
    minX = -1;
    minY = -1;
    minZ = -1;
    maxX = 1;
    maxY = 1;
    maxZ = 1;
  }
  const bbox = {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };
  const stats = {
    numNodes: nodes.length / 3,
    numElements: surfaceTriangles.length / 3 + linesList.reduce((acc, l) => acc + l.nodeIndices.length / 2, 0),
    numPoints: points.length,
    numCurves: linesList.length,
    numSurfaces: new Set(surfaceTags).size,
    numVolumes: 0
  };
  return {
    nodes,
    nodeTags,
    points,
    lines: linesList,
    surfaceTriangles,
    surfaceTags,
    bbox,
    stats
  };
}

// src/geoParserFallback.ts
function parseGeoFallback(geoContent) {
  const nodes = [];
  const nodeTags = [];
  const points = [];
  const lines = [];
  const surfaceTriangles = [];
  const surfaceTags = [];
  const pointMap = /* @__PURE__ */ new Map();
  const variables = /* @__PURE__ */ new Map();
  const cleanContent = geoContent.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const statements = cleanContent.split(";").map((s) => s.trim()).filter(Boolean);
  const evalExpr = (expr) => {
    try {
      let sanitized = expr.trim();
      for (const [vName, vVal] of variables.entries()) {
        sanitized = sanitized.replace(new RegExp(`\\b${vName}\\b`, "g"), vVal.toString());
      }
      const res = Function(`"use strict"; return (${sanitized});`)();
      return typeof res === "number" && !isNaN(res) ? res : 0;
    } catch {
      return 0;
    }
  };
  for (const stmt of statements) {
    const varMatch = stmt.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (varMatch && !stmt.includes("(")) {
      const name = varMatch[1];
      const val = evalExpr(varMatch[2]);
      variables.set(name, val);
    }
  }
  for (const stmt of statements) {
    const pointMatch = stmt.match(/Point\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (pointMatch) {
      const tag = parseInt(pointMatch[1], 10);
      const coords = pointMatch[2].split(",").map((s) => evalExpr(s));
      const x = coords[0] || 0;
      const y = coords[1] || 0;
      const z = coords[2] || 0;
      const nodeIndex = nodes.length / 3;
      nodes.push(x, y, z);
      nodeTags.push(tag);
      const pt = { tag, nodeIndex, x, y, z };
      points.push(pt);
      pointMap.set(tag, { x, y, z, nodeIndex });
      continue;
    }
    const lineMatch = stmt.match(/Line\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (lineMatch) {
      const tag = parseInt(lineMatch[1], 10);
      const ptTags = lineMatch[2].split(",").map((s) => parseInt(s.trim(), 10));
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
    const splineMatch = stmt.match(/(?:Circle|Spline|BSpline|Bezier)\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (splineMatch) {
      const tag = parseInt(splineMatch[1], 10);
      const ptTags = splineMatch[2].split(",").map((s) => parseInt(s.trim(), 10));
      const pairIndices = [];
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
    const boxMatch = stmt.match(/Box\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (boxMatch) {
      const tag = parseInt(boxMatch[1], 10);
      const params = boxMatch[2].split(",").map((s) => evalExpr(s));
      const [x, y, z, dx, dy, dz] = params;
      addBoxGeometry(tag, x || 0, y || 0, z || 0, dx || 1, dy || 1, dz || 1, nodes, nodeTags, points, lines, surfaceTriangles, surfaceTags);
      continue;
    }
    const cylMatch = stmt.match(/Cylinder\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (cylMatch) {
      const tag = parseInt(cylMatch[1], 10);
      const params = cylMatch[2].split(",").map((s) => evalExpr(s));
      const [x, y, z, dx, dy, dz, r] = params;
      addCylinderGeometry(tag, x || 0, y || 0, z || 0, dx || 0, dy || 0, dz || 1, r || 0.5, nodes, nodeTags, points, lines, surfaceTriangles, surfaceTags);
      continue;
    }
    const sphereMatch = stmt.match(/Sphere\s*\(\s*(\d+)\s*\)\s*=\s*\{\s*([^}]+)\s*\}/i);
    if (sphereMatch) {
      const tag = parseInt(sphereMatch[1], 10);
      const params = sphereMatch[2].split(",").map((s) => evalExpr(s));
      const [x, y, z, r] = params;
      addSphereGeometry(tag, x || 0, y || 0, z || 0, r || 1, nodes, nodeTags, points, lines, surfaceTriangles, surfaceTags);
      continue;
    }
  }
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
    minX = -1;
    minY = -1;
    minZ = -1;
    maxX = 1;
    maxY = 1;
    maxZ = 1;
  }
  const bbox = {
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ]
  };
  const stats = {
    numNodes: nodes.length / 3,
    numElements: surfaceTriangles.length / 3 + lines.length,
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
function addBoxGeometry(tag, x, y, z, dx, dy, dz, nodes, nodeTags, points, lines, triangles, surfaceTags) {
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
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    // bottom
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    // top
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7]
    // vertical
  ];
  const linePairs = [];
  edgeIndices.forEach(([a, b]) => {
    linePairs.push(baseIdx + a, baseIdx + b);
  });
  lines.push({ tag, nodeIndices: linePairs });
  const faces = [
    [0, 2, 1],
    [0, 3, 2],
    // bottom
    [4, 5, 6],
    [4, 6, 7],
    // top
    [0, 1, 5],
    [0, 5, 4],
    // front
    [2, 3, 7],
    [2, 7, 6],
    // back
    [0, 4, 7],
    [0, 7, 3],
    // left
    [1, 2, 6],
    [1, 6, 5]
    // right
  ];
  faces.forEach(([i1, i2, i3]) => {
    triangles.push(baseIdx + i1, baseIdx + i2, baseIdx + i3);
    surfaceTags.push(tag);
  });
}
function addCylinderGeometry(tag, x, y, z, dx, dy, dz, r, nodes, nodeTags, _points, lines, triangles, surfaceTags) {
  const segments = 16;
  const baseIdx = nodes.length / 3;
  for (let s = 0; s < segments; s++) {
    const theta = s / segments * 2 * Math.PI;
    const cx = Math.cos(theta) * r;
    const cy = Math.sin(theta) * r;
    nodes.push(x + cx, y + cy, z);
    nodeTags.push(baseIdx + s * 2 + 1);
    nodes.push(x + cx + dx, y + cy + dy, z + dz);
    nodeTags.push(baseIdx + s * 2 + 2);
  }
  const linePairs = [];
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
function addSphereGeometry(tag, cx, cy, cz, r, nodes, nodeTags, _points, _lines, triangles, surfaceTags) {
  const rings = 10;
  const segments = 16;
  const baseIdx = nodes.length / 3;
  for (let rIdx = 0; rIdx <= rings; rIdx++) {
    const phi = rIdx / rings * Math.PI;
    for (let sIdx = 0; sIdx <= segments; sIdx++) {
      const theta = sIdx / segments * 2 * Math.PI;
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

// src/gmshLocator.ts
var cp = __toESM(require("child_process"));
var fs = __toESM(require("fs"));
var os = __toESM(require("os"));
var path = __toESM(require("path"));
var GmshLocator = class {
  static cachedResult = null;
  /**
   * Reset the cached detection result.
   */
  static clearCache() {
    this.cachedResult = null;
  }
  /**
   * Find Gmsh executable automatically across standard directories and PATH.
   */
  static async findGmsh(configuredPath) {
    if (this.cachedResult && this.cachedResult.found) {
      if (!configuredPath || configuredPath === this.cachedResult.path) {
        return this.cachedResult;
      }
    }
    if (configuredPath && configuredPath !== "gmsh") {
      const verified = await this.verifyGmshExecutable(configuredPath);
      if (verified.found) {
        this.cachedResult = { ...verified, source: "config" };
        return this.cachedResult;
      }
    }
    const pathResult = await this.checkSystemPath();
    if (pathResult.found) {
      this.cachedResult = { ...pathResult, source: "path" };
      return this.cachedResult;
    }
    const candidatePaths = this.getCandidateSearchPaths();
    for (const cand of candidatePaths) {
      if (fs.existsSync(cand)) {
        const verified = await this.verifyGmshExecutable(cand);
        if (verified.found) {
          this.cachedResult = { ...verified, source: "auto-search" };
          return this.cachedResult;
        }
      }
    }
    this.cachedResult = {
      found: false,
      path: configuredPath || "gmsh",
      source: "fallback"
    };
    return this.cachedResult;
  }
  /**
   * Check if 'gmsh' is accessible via system PATH.
   */
  static async checkSystemPath() {
    const isWin = process.platform === "win32";
    const cmd = isWin ? "where.exe gmsh" : "which gmsh";
    return new Promise((resolve) => {
      cp.exec(cmd, { timeout: 2e3 }, async (err, stdout) => {
        if (!err && stdout) {
          const firstPath = stdout.trim().split(/\r?\n/)[0].trim();
          if (firstPath) {
            const verified = await this.verifyGmshExecutable(firstPath);
            if (verified.found) {
              resolve(verified);
              return;
            }
          }
        }
        resolve({ found: false, path: "gmsh" });
      });
    });
  }
  /**
   * Gather a list of candidate executable paths based on OS and wildcard directories.
   */
  static getCandidateSearchPaths() {
    const candidates = [];
    const isWin = process.platform === "win32";
    const isMac = process.platform === "darwin";
    if (isWin) {
      const userProfile = process.env.USERPROFILE || "";
      const localAppData = process.env.LOCALAPPDATA || "";
      const programFiles = process.env.ProgramFiles || "C:\\Program Files";
      const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
      const searchDirs = [
        programFiles,
        programFilesX86,
        "C:\\",
        path.join(userProfile, "Downloads"),
        path.join(userProfile, "Desktop"),
        userProfile,
        path.join(localAppData, "Programs"),
        "C:\\tools"
      ];
      for (const baseDir of searchDirs) {
        if (!fs.existsSync(baseDir)) continue;
        candidates.push(path.join(baseDir, "gmsh.exe"));
        candidates.push(path.join(baseDir, "gmsh", "gmsh.exe"));
        try {
          const entries = fs.readdirSync(baseDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && entry.name.toLowerCase().startsWith("gmsh")) {
              candidates.push(path.join(baseDir, entry.name, "gmsh.exe"));
              candidates.push(path.join(baseDir, entry.name, "bin", "gmsh.exe"));
            }
          }
        } catch {
        }
      }
      if (userProfile) {
        candidates.push(path.join(userProfile, "anaconda3", "Scripts", "gmsh.exe"));
        candidates.push(path.join(userProfile, "miniconda3", "Scripts", "gmsh.exe"));
        candidates.push(path.join(userProfile, "anaconda3", "Library", "bin", "gmsh.exe"));
        candidates.push(path.join(userProfile, "miniconda3", "Library", "bin", "gmsh.exe"));
        candidates.push(path.join(userProfile, "scoop", "shims", "gmsh.exe"));
      }
    } else if (isMac) {
      candidates.push("/Applications/Gmsh.app/Contents/MacOS/gmsh");
      const home = os.homedir();
      candidates.push(path.join(home, "Applications", "Gmsh.app", "Contents", "MacOS", "gmsh"));
      candidates.push("/usr/local/bin/gmsh");
      candidates.push("/opt/homebrew/bin/gmsh");
      candidates.push(path.join(home, ".local", "bin", "gmsh"));
    } else {
      candidates.push("/usr/bin/gmsh");
      candidates.push("/usr/local/bin/gmsh");
      candidates.push("/opt/gmsh/bin/gmsh");
      candidates.push(path.join(os.homedir(), ".local", "bin", "gmsh"));
    }
    return Array.from(new Set(candidates));
  }
  /**
   * Run candidate executable with -info to ensure it is a valid Gmsh binary and extract version.
   */
  static async verifyGmshExecutable(execPath) {
    return new Promise((resolve) => {
      if (!fs.existsSync(execPath)) {
        resolve({ found: false, path: execPath });
        return;
      }
      try {
        const proc = cp.spawn(execPath, ["-info"], {
          windowsHide: true,
          timeout: 4e3
        });
        let stdout = "";
        proc.stdout.on("data", (d) => {
          stdout += d.toString();
        });
        proc.on("close", (code) => {
          if (code === 0 && (stdout.includes("Gmsh") || stdout.includes("Version"))) {
            const versionMatch = stdout.match(/Version\s*:\s*([^\r\n]+)/i);
            const version = versionMatch ? versionMatch[1].trim() : "Gmsh";
            resolve({
              found: true,
              path: execPath,
              version
            });
          } else {
            resolve({ found: false, path: execPath });
          }
        });
        proc.on("error", () => {
          resolve({ found: false, path: execPath });
        });
      } catch {
        resolve({ found: false, path: execPath });
      }
    });
  }
};

// src/gmshRunner.ts
var GmshRunner = class {
  currentProcess = null;
  tempDir;
  constructor() {
    this.tempDir = path2.join(os2.tmpdir(), "vscode-gmsh-preview");
    if (!fs2.existsSync(this.tempDir)) {
      try {
        fs2.mkdirSync(this.tempDir, { recursive: true });
      } catch (e) {
        console.error("Failed to create temp directory for gmsh:", e);
      }
    }
  }
  /**
   * Check if gmsh executable is available using automatic locator.
   */
  async checkGmsh(executablePath) {
    return GmshLocator.findGmsh(executablePath);
  }
  /**
   * Run Gmsh to generate mesh and return parsed MeshData.
   */
  async runGmsh(geoContent, originalFilePath, executablePath = "gmsh", meshDimension = 2) {
    const startTime = Date.now();
    if (this.currentProcess) {
      try {
        this.currentProcess.kill();
      } catch {
      }
      this.currentProcess = null;
    }
    const detectResult = await GmshLocator.findGmsh(executablePath);
    const resolvedExecPath = detectResult.found ? detectResult.path : executablePath;
    const uniqueId = `gmsh_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    const tempGeoPath = path2.join(this.tempDir, `${uniqueId}.geo`);
    const tempMshPath = path2.join(this.tempDir, `${uniqueId}.msh`);
    try {
      const workingDir = originalFilePath ? path2.dirname(originalFilePath) : this.tempDir;
      await fs2.promises.writeFile(tempGeoPath, geoContent, "utf-8");
      const args = [
        tempGeoPath,
        "-format",
        "msh",
        "-o",
        tempMshPath
      ];
      if (meshDimension >= 0 && meshDimension <= 3) {
        args.push(`-${meshDimension}`);
      }
      const runPromise = new Promise((resolve, reject) => {
        const proc = cp2.spawn(resolvedExecPath, args, {
          cwd: workingDir,
          windowsHide: true
        });
        this.currentProcess = proc;
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (d) => {
          stdout += d.toString();
        });
        proc.stderr.on("data", (d) => {
          stderr += d.toString();
        });
        proc.on("close", (code) => {
          this.currentProcess = null;
          resolve({ code, stdout, stderr });
        });
        proc.on("error", (err) => {
          this.currentProcess = null;
          reject(err);
        });
      });
      let execResult;
      try {
        execResult = await runPromise;
      } catch (execErr) {
        const fallbackData = parseGeoFallback(geoContent);
        return {
          success: false,
          data: fallbackData,
          error: `Gmsh failed to launch (${execErr?.message || "ENOENT"}). Using fallback preview. Run 'Gmsh: Auto-Detect Gmsh Executable' or configure 'gmsh.executablePath'.`,
          durationMs: Date.now() - startTime
        };
      }
      const allOutput = `${execResult.stdout}
${execResult.stderr}`;
      const errorMatch = allOutput.match(/Error\s*:\s*(?:'[^']+',\s*)?line\s*(\d+)\s*:\s*([^\r\n]+)/i);
      const generalErrorMatch = allOutput.match(/Error\s*:\s*([^\r\n]+)/i);
      let parsedError;
      let errorLine;
      if (errorMatch) {
        errorLine = parseInt(errorMatch[1], 10);
        parsedError = `Line ${errorLine}: ${errorMatch[2].trim()}`;
      } else if (generalErrorMatch) {
        parsedError = generalErrorMatch[1].trim();
      }
      if (fs2.existsSync(tempMshPath)) {
        const mshContent = await fs2.promises.readFile(tempMshPath, "utf-8");
        const meshData = parseMsh(mshContent);
        this.cleanupFile(tempGeoPath);
        this.cleanupFile(tempMshPath);
        return {
          success: !parsedError,
          data: meshData,
          error: parsedError,
          errorLine,
          rawOutput: allOutput,
          durationMs: Date.now() - startTime
        };
      } else {
        const fallbackData = parseGeoFallback(geoContent);
        this.cleanupFile(tempGeoPath);
        return {
          success: false,
          data: fallbackData,
          error: parsedError || "Gmsh failed to generate mesh. Showing fallback preview.",
          errorLine,
          rawOutput: allOutput,
          durationMs: Date.now() - startTime
        };
      }
    } catch (err) {
      const fallbackData = parseGeoFallback(geoContent);
      return {
        success: false,
        data: fallbackData,
        error: `Unexpected error: ${err?.message || err}`,
        durationMs: Date.now() - startTime
      };
    }
  }
  /**
   * Export to file format (STL, OBJ, or MSH).
   */
  async exportFile(geoContent, originalFilePath, outputPath, format, executablePath = "gmsh", meshDimension = 2) {
    const tempGeoPath = path2.join(this.tempDir, `export_${Date.now()}.geo`);
    const workingDir = originalFilePath ? path2.dirname(originalFilePath) : this.tempDir;
    const detectResult = await GmshLocator.findGmsh(executablePath);
    const resolvedExecPath = detectResult.found ? detectResult.path : executablePath;
    try {
      await fs2.promises.writeFile(tempGeoPath, geoContent, "utf-8");
      const args = [
        tempGeoPath,
        "-format",
        format,
        "-o",
        outputPath
      ];
      if (meshDimension >= 0 && meshDimension <= 3) {
        args.push(`-${meshDimension}`);
      }
      return new Promise((resolve) => {
        cp2.execFile(resolvedExecPath, args, { cwd: workingDir }, (err, stdout, stderr) => {
          this.cleanupFile(tempGeoPath);
          if (err || !fs2.existsSync(outputPath)) {
            resolve({
              success: false,
              error: stderr || stdout || err?.message || "Export failed"
            });
          } else {
            resolve({ success: true });
          }
        });
      });
    } catch (err) {
      return { success: false, error: err?.message || "Export failed" };
    }
  }
  cleanupFile(filePath) {
    fs2.unlink(filePath, () => {
    });
  }
};

// src/previewPanel.ts
var GmshPreviewPanel = class _GmshPreviewPanel {
  static currentPanel;
  static viewType = "gmshPreview";
  _panel;
  _extensionUri;
  _gmshRunner;
  _disposables = [];
  _activeDocument = null;
  _debounceTimer = null;
  _currentDimension = 2;
  _isReady = false;
  static createOrShow(extensionUri, document) {
    const column = vscode.ViewColumn.Beside;
    if (_GmshPreviewPanel.currentPanel) {
      _GmshPreviewPanel.currentPanel._panel.reveal(column);
      if (document) {
        _GmshPreviewPanel.currentPanel.setDocument(document);
      }
      return _GmshPreviewPanel.currentPanel;
    }
    const panel = vscode.window.createWebviewPanel(
      _GmshPreviewPanel.viewType,
      "Gmsh 3D Preview",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist"),
          vscode.Uri.joinPath(extensionUri, "media")
        ]
      }
    );
    _GmshPreviewPanel.currentPanel = new _GmshPreviewPanel(panel, extensionUri, document);
    return _GmshPreviewPanel.currentPanel;
  }
  constructor(panel, extensionUri, document) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._gmshRunner = new GmshRunner();
    const config = this.getConfig();
    this._currentDimension = config.meshDimension;
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );
    vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (this._activeDocument && e.document.uri.toString() === this._activeDocument.uri.toString()) {
          this.triggerUpdate();
        }
      },
      null,
      this._disposables
    );
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor && this.isGmshFile(editor.document)) {
          this.setDocument(editor.document);
        }
      },
      null,
      this._disposables
    );
    if (document) {
      this.setDocument(document);
    } else if (vscode.window.activeTextEditor && this.isGmshFile(vscode.window.activeTextEditor.document)) {
      this.setDocument(vscode.window.activeTextEditor.document);
    }
  }
  isGmshFile(doc) {
    const ext = path3.extname(doc.fileName).toLowerCase();
    return ext === ".geo" || ext === ".msh" || doc.languageId === "gmsh" || doc.languageId === "geo";
  }
  setDocument(document) {
    this._activeDocument = document;
    this._panel.title = `Preview: ${path3.basename(document.fileName)}`;
    if (this._isReady) {
      this.updatePreviewImmediate();
    }
  }
  getConfig() {
    const cfg = vscode.workspace.getConfiguration("gmsh");
    return {
      executablePath: cfg.get("executablePath", "gmsh"),
      meshDimension: cfg.get("meshDimension", 2),
      debounceDelay: cfg.get("debounceDelay", 400),
      pointSize: cfg.get("pointSize", 1),
      pointColor: cfg.get("pointColor", "#38bdf8"),
      lineColor: cfg.get("lineColor", "#f59e0b"),
      surfaceColor: cfg.get("surfaceColor", "#475569"),
      meshWireframeColor: cfg.get("meshWireframeColor", "#94a3b8"),
      backgroundColor: cfg.get("backgroundColor", "#111827"),
      showLabels: cfg.get("showLabels", true),
      showAxes: cfg.get("showAxes", true),
      showGrid: cfg.get("showGrid", true),
      showPoints: cfg.get("showPoints", true),
      showLines: cfg.get("showLines", true),
      showSurfaces: cfg.get("showSurfaces", true),
      showMeshWireframe: cfg.get("showMeshWireframe", true)
    };
  }
  triggerUpdate() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    const delay = this.getConfig().debounceDelay;
    this._debounceTimer = setTimeout(() => {
      this.updatePreviewImmediate();
    }, delay);
  }
  async updatePreviewImmediate() {
    if (!this._activeDocument) return;
    const content = this._activeDocument.getText();
    const filePath = this._activeDocument.fileName;
    const config = this.getConfig();
    this._panel.webview.postMessage({ command: "setLoading", loading: true });
    const result = await this._gmshRunner.runGmsh(
      content,
      filePath,
      config.executablePath,
      this._currentDimension
    );
    if (result.data) {
      this._panel.webview.postMessage({
        command: "updateMesh",
        data: result.data,
        sourceFile: path3.basename(filePath)
      });
    }
    if (result.error) {
      this._panel.webview.postMessage({
        command: "showError",
        message: result.error,
        line: result.errorLine
      });
    } else {
      this._panel.webview.postMessage({ command: "clearError" });
    }
  }
  async _handleMessage(message) {
    switch (message.command) {
      case "ready":
        this._isReady = true;
        if (this._activeDocument) {
          this.updatePreviewImmediate();
        }
        break;
      case "selectEntity":
        this._jumpToEntityInEditor(message.entityType, message.tag);
        break;
      case "requestRemesh":
        this._currentDimension = message.dimension;
        this.updatePreviewImmediate();
        break;
      case "export":
        this._handleExport(message.format, message.dimension ?? this._currentDimension);
        break;
      case "openSettings":
        vscode.commands.executeCommand("workbench.action.openSettings", "gmsh");
        break;
      case "autoDetect":
        vscode.commands.executeCommand("gmshPreview.autoDetect");
        break;
      case "browseExecutable":
        vscode.commands.executeCommand("gmshPreview.browseExecutable");
        break;
    }
  }
  async _jumpToEntityInEditor(entityType, tag) {
    if (!this._activeDocument) return;
    const editor = await vscode.window.showTextDocument(this._activeDocument, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false
    });
    const text = this._activeDocument.getText();
    const lines = text.split(/\r?\n/);
    let regex;
    if (entityType === "point") {
      regex = new RegExp(`\\bPoint\\s*\\(\\s*${tag}\\s*\\)`, "i");
    } else if (entityType === "line") {
      regex = new RegExp(`\\b(?:Line|Circle|Spline|BSpline)\\s*\\(\\s*${tag}\\s*\\)`, "i");
    } else {
      regex = new RegExp(`\\b(?:Plane\\s+Surface|Surface|Box|Cylinder|Sphere)\\s*\\(\\s*${tag}\\s*\\)`, "i");
    }
    let targetLine = -1;
    let targetCol = 0;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(regex);
      if (match && match.index !== void 0) {
        targetLine = i;
        targetCol = match.index;
        break;
      }
    }
    if (targetLine !== -1) {
      const pos = new vscode.Position(targetLine, targetCol);
      editor.selection = new vscode.Selection(pos, new vscode.Position(targetLine, lines[targetLine].length));
      editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenter);
    } else {
      vscode.window.showInformationMessage(`Entity ${entityType.toUpperCase()}(${tag}) was generated automatically or not found by exact tag.`);
    }
  }
  async _handleExport(format, dimension) {
    if (!this._activeDocument) return;
    const defaultFilename = path3.basename(this._activeDocument.fileName, path3.extname(this._activeDocument.fileName)) + `.${format}`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path3.join(path3.dirname(this._activeDocument.fileName), defaultFilename)),
      filters: {
        [format.toUpperCase()]: [format]
      }
    });
    if (!uri) return;
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Exporting to ${format.toUpperCase()}...`,
        cancellable: false
      },
      async () => {
        const config = this.getConfig();
        const res = await this._gmshRunner.exportFile(
          this._activeDocument.getText(),
          this._activeDocument.fileName,
          uri.fsPath,
          format,
          config.executablePath,
          dimension
        );
        if (res.success) {
          vscode.window.showInformationMessage(`Successfully exported to ${path3.basename(uri.fsPath)}`);
        } else {
          vscode.window.showErrorMessage(`Export failed: ${res.error}`);
        }
      }
    );
  }
  _getHtmlForWebview(webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "dist", "preview.bundle.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, "dist", "styles.css"));
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Gmsh Realtime Preview</title>
</head>
<body>
  <!-- 3D Canvas Viewport -->
  <div id="viewport-container"></div>

  <!-- Loading Overlay -->
  <div id="loading-overlay" class="loading-overlay">
    <div class="spinner"></div>
  </div>

  <!-- Top Toolbar -->
  <div class="toolbar">
    <div class="toolbar-group">
      <span id="filename-badge" class="badge primary">Gmsh Model</span>
      <div class="segmented-control">
        <button data-dim="0" title="Geometry only (-0)">0D</button>
        <button data-dim="1" title="1D Mesh (-1)">1D</button>
        <button data-dim="2" class="active" title="2D Surface Mesh (-2)">2D</button>
        <button data-dim="3" title="3D Volume Mesh (-3)">3D</button>
      </div>
    </div>

    <!-- View & Projection Controls -->
    <div class="toolbar-group">
      <button id="view-top" class="btn" title="Top View (Z)">Top</button>
      <button id="view-front" class="btn" title="Front View (Y)">Front</button>
      <button id="view-side" class="btn" title="Side View (X)">Side</button>
      <button id="view-iso" class="btn" title="Isometric View">Iso</button>
      <button id="view-reset" class="btn" title="Fit to View">Fit</button>
      <button id="view-ortho" class="btn" title="Toggle Perspective / Orthographic">Persp</button>
    </div>

    <!-- Layer Toggles -->
    <div class="toolbar-group">
      <button id="toggle-points" class="toggle-btn" title="Points (P)">Points</button>
      <button id="toggle-lines" class="toggle-btn" title="Lines (L)">Lines</button>
      <button id="toggle-surfaces" class="toggle-btn" title="Surfaces (S)">Surfaces</button>
      <button id="toggle-wireframe" class="toggle-btn" title="Mesh Wireframe">Mesh</button>
      <button id="toggle-labels" class="toggle-btn" title="Point & Line ID Labels">Labels</button>
      <button id="toggle-axes" class="toggle-btn" title="Coordinate Axes">Axes</button>
      <button id="toggle-grid" class="toggle-btn" title="Grid Floor">Grid</button>
    </div>

    <!-- Export & Settings -->
    <div class="toolbar-group">
      <div class="dropdown">
        <button class="btn" title="Export Model">Export \u25BE</button>
        <div class="dropdown-content">
          <button id="export-stl">Export STL (.stl)</button>
          <button id="export-obj">Export OBJ (.obj)</button>
          <button id="export-msh">Export Gmsh (.msh)</button>
        </div>
      </div>
      <button id="btn-settings" class="btn btn-icon" title="Configure Gmsh Path">\u2699</button>
    </div>
  </div>

  <!-- Error Banner -->
  <div id="error-banner" class="error-banner" title="Click to jump to line in code">
    <span id="error-text">Syntax Error</span>
    <span class="badge" style="background: rgba(0,0,0,0.3); color: #fff;">Jump to line \u2197</span>
  </div>

  <!-- Warning Banner -->
  <div id="warning-banner" class="warning-banner">
    <span id="warning-text">Gmsh CLI not detected. Using fast fallback preview.</span>
    <div style="display: flex; gap: 6px; align-items: center;">
      <button id="btn-autodetect" class="btn" style="padding: 2px 8px; font-size: 11px; background: rgba(0,0,0,0.2); color: #000;" title="Search system directories for gmsh">\u{1F50D} \u81EA\u52D5\u691C\u51FA</button>
      <button id="btn-browse" class="btn" style="padding: 2px 8px; font-size: 11px; background: rgba(0,0,0,0.2); color: #000;" title="Browse for gmsh.exe">\u{1F4C1} \u53C2\u7167...</button>
    </div>
  </div>

  <!-- Bottom Inspector -->
  <div class="bottom-bar">
    <div id="inspector-text" class="inspector-text">Hover over points, lines or surfaces</div>
    <div class="toolbar-group">
      <span id="stats-nodes" class="badge">0 nodes</span>
      <span id="stats-elements" class="badge">0 elements</span>
    </div>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
  dispose() {
    _GmshPreviewPanel.currentPanel = void 0;
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }
};
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// src/extension.ts
function activate(context) {
  const runner = new GmshRunner();
  const config = vscode2.workspace.getConfiguration("gmsh");
  const configuredPath = config.get("executablePath", "gmsh");
  runner.checkGmsh(configuredPath).then((status) => {
    if (status.found) {
      console.log(`[Gmsh Preview] Detected Gmsh: ${status.path} (version: ${status.version || "unknown"}, source: ${status.source})`);
      if (status.source === "auto-search" && configuredPath === "gmsh") {
        vscode2.window.showInformationMessage(
          `Gmsh \u3092\u81EA\u52D5\u691C\u51FA\u3057\u307E\u3057\u305F: ${status.path} (${status.version || "OK"})`,
          "\u8A2D\u5B9A\u306B\u4FDD\u5B58\u3059\u308B"
        ).then((action) => {
          if (action === "\u8A2D\u5B9A\u306B\u4FDD\u5B58\u3059\u308B") {
            config.update("executablePath", status.path, vscode2.ConfigurationTarget.Global);
          }
        });
      }
    } else {
      console.log(`[Gmsh Preview] Gmsh executable not found. Fallback geometry preview will be used.`);
    }
  });
  const statusBarItem = vscode2.window.createStatusBarItem(vscode2.StatusBarAlignment.Right, 100);
  statusBarItem.command = "gmshPreview.open";
  statusBarItem.text = "$(eye) Gmsh Preview";
  statusBarItem.tooltip = "Open Gmsh 3D Realtime Preview";
  const updateStatusBarVisibility = () => {
    const editor = vscode2.window.activeTextEditor;
    if (editor && (editor.document.fileName.endsWith(".geo") || editor.document.fileName.endsWith(".msh"))) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };
  context.subscriptions.push(
    vscode2.window.onDidChangeActiveTextEditor(updateStatusBarVisibility),
    statusBarItem
  );
  updateStatusBarVisibility();
  context.subscriptions.push(
    vscode2.commands.registerCommand("gmshPreview.open", (uri) => {
      let doc;
      if (uri) {
        vscode2.workspace.openTextDocument(uri).then((d) => {
          GmshPreviewPanel.createOrShow(context.extensionUri, d);
        });
        return;
      }
      if (vscode2.window.activeTextEditor) {
        doc = vscode2.window.activeTextEditor.document;
      }
      GmshPreviewPanel.createOrShow(context.extensionUri, doc);
    })
  );
  context.subscriptions.push(
    vscode2.commands.registerCommand("gmshPreview.remesh", () => {
      if (GmshPreviewPanel.currentPanel) {
        GmshPreviewPanel.currentPanel.updatePreviewImmediate();
      }
    })
  );
  context.subscriptions.push(
    vscode2.commands.registerCommand("gmshPreview.autoDetect", async () => {
      GmshLocator.clearCache();
      const result = await vscode2.window.withProgress(
        {
          location: vscode2.ProgressLocation.Notification,
          title: "Searching for Gmsh executable across system directories..."
        },
        async () => {
          return await GmshLocator.findGmsh();
        }
      );
      if (result.found) {
        const choice = await vscode2.window.showInformationMessage(
          `Gmsh \u304C\u898B\u3064\u304B\u308A\u307E\u3057\u305F: ${result.path} (Version: ${result.version || "unknown"})`,
          "\u8A2D\u5B9A\u306B\u4FDD\u5B58\u3059\u308B",
          "\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u66F4\u65B0"
        );
        if (choice === "\u8A2D\u5B9A\u306B\u4FDD\u5B58\u3059\u308B") {
          await vscode2.workspace.getConfiguration("gmsh").update("executablePath", result.path, vscode2.ConfigurationTarget.Global);
        }
        if (choice === "\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u66F4\u65B0" || choice === "\u8A2D\u5B9A\u306B\u4FDD\u5B58\u3059\u308B") {
          if (GmshPreviewPanel.currentPanel) {
            GmshPreviewPanel.currentPanel.updatePreviewImmediate();
          }
        }
      } else {
        const choice = await vscode2.window.showWarningMessage(
          "Gmsh \u5B9F\u884C\u30D5\u30A1\u30A4\u30EB\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u624B\u52D5\u3067\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E\u3057\u307E\u3059\u304B\uFF1F",
          "\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E...",
          "Gmsh \u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u30DA\u30FC\u30B8"
        );
        if (choice === "\u30D5\u30A1\u30A4\u30EB\u3092\u9078\u629E...") {
          vscode2.commands.executeCommand("gmshPreview.browseExecutable");
        } else if (choice === "Gmsh \u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u30DA\u30FC\u30B8") {
          vscode2.env.openExternal(vscode2.Uri.parse("https://gmsh.info/#Download"));
        }
      }
    })
  );
  context.subscriptions.push(
    vscode2.commands.registerCommand("gmshPreview.browseExecutable", async () => {
      const isWin = process.platform === "win32";
      const fileUris = await vscode2.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: "Select Gmsh Executable",
        filters: isWin ? { "Executable": ["exe"] } : void 0
      });
      if (fileUris && fileUris.length > 0) {
        const selectedPath = fileUris[0].fsPath;
        const verified = await GmshLocator.verifyGmshExecutable(selectedPath);
        if (verified.found) {
          await vscode2.workspace.getConfiguration("gmsh").update("executablePath", selectedPath, vscode2.ConfigurationTarget.Global);
          vscode2.window.showInformationMessage(`Gmsh \u30D1\u30B9\u3092\u8A2D\u5B9A\u3057\u307E\u3057\u305F: ${selectedPath} (Version: ${verified.version || "OK"})`);
          if (GmshPreviewPanel.currentPanel) {
            GmshPreviewPanel.currentPanel.updatePreviewImmediate();
          }
        } else {
          vscode2.window.showErrorMessage(`\u9078\u629E\u3055\u308C\u305F\u30D5\u30A1\u30A4\u30EB\u306F\u6709\u52B9\u306A Gmsh \u5B9F\u884C\u30D5\u30A1\u30A4\u30EB\u3068\u3057\u3066\u8A8D\u8B58\u3055\u308C\u307E\u305B\u3093\u3067\u3057\u305F: ${selectedPath}`);
        }
      }
    })
  );
}
function deactivate() {
  if (GmshPreviewPanel.currentPanel) {
    GmshPreviewPanel.currentPanel.dispose();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
