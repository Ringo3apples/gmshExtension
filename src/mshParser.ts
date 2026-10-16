import { MeshData, GeometricPoint, GeometricLine, BoundingBox, MeshStats } from './types';

/**
 * Parses Gmsh MSH files (supports MSH 4.1 and MSH 2.2 ASCII formats).
 */
export function parseMsh(content: string): MeshData {
  if (content.includes('$MeshFormat')) {
    const formatLine = content.split(/\r?\n/).find(l => !l.startsWith('$') && l.trim().length > 0);
    if (formatLine && formatLine.trim().startsWith('4.')) {
      return parseMsh4(content);
    }
  }
  // Fallback to MSH 2.2 parser
  return parseMsh2(content);
}

function parseMsh4(content: string): MeshData {
  const lines = content.split(/\r?\n/);
  let lineIdx = 0;

  let totalNodesCount = 0;
  const nodes: number[] = []; // flat [x, y, z, ...]
  const nodeTagToIndex = new Map<number, number>();
  const nodeTags: number[] = [];

  const points: GeometricPoint[] = [];
  const lineMap = new Map<number, number[]>(); // curveTag -> array of nodeIndices
  const surfaceTriangles: number[] = [];
  const surfaceTags: number[] = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  let numCurves = 0;
  let numSurfaces = 0;
  let numVolumes = 0;

  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx++].trim();
    if (!rawLine) continue;

    if (rawLine === '$Entities') {
      const header = lines[lineIdx++].trim().split(/\s+/).map(Number);
      // const numPoints = header[0] || 0;
      numCurves = header[1] || 0;
      numSurfaces = header[2] || 0;
      numVolumes = header[3] || 0;
      // Skip until $EndEntities
      while (lineIdx < lines.length && lines[lineIdx].trim() !== '$EndEntities') {
        lineIdx++;
      }
      lineIdx++; // skip $EndEntities
    } else if (rawLine === '$Nodes') {
      const header = lines[lineIdx++].trim().split(/\s+/).map(Number);
      const numEntityBlocks = header[0] || 0;
      totalNodesCount = header[1] || 0;

      for (let b = 0; b < numEntityBlocks && lineIdx < lines.length; b++) {
        const blockHeader = lines[lineIdx++].trim().split(/\s+/).map(Number);
        const entityDim = blockHeader[0];
        const entityTag = blockHeader[1];
        // const parametric = blockHeader[2];
        const numNodesInBlock = blockHeader[3];

        const blockNodeTags: number[] = [];
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
      // Skip to $EndNodes
      while (lineIdx < lines.length && lines[lineIdx].trim() !== '$EndNodes') {
        lineIdx++;
      }
      lineIdx++;
    } else if (rawLine === '$Elements') {
      const header = lines[lineIdx++].trim().split(/\s+/).map(Number);
      const numEntityBlocks = header[0] || 0;

      for (let b = 0; b < numEntityBlocks && lineIdx < lines.length; b++) {
        const blockHeader = lines[lineIdx++].trim().split(/\s+/).map(Number);
        // const entityDim = blockHeader[0];
        const entityTag = blockHeader[1];
        const elementType = blockHeader[2];
        const numElementsInBlock = blockHeader[3];

        for (let e = 0; e < numElementsInBlock && lineIdx < lines.length; e++) {
          const elemParts = lines[lineIdx++].trim().split(/\s+/).map(Number);
          // elemParts[0] is elementTag, remaining are node tags

          if (elementType === 15) {
            // 1-node point element
            const nTag = elemParts[1];
            const idx = nodeTagToIndex.get(nTag);
            if (idx !== undefined && !points.some(p => p.tag === entityTag)) {
              points.push({
                tag: entityTag,
                nodeIndex: idx,
                x: nodes[idx * 3],
                y: nodes[idx * 3 + 1],
                z: nodes[idx * 3 + 2]
              });
            }
          } else if (elementType === 1) {
            // 2-node line element
            const n1 = nodeTagToIndex.get(elemParts[1]);
            const n2 = nodeTagToIndex.get(elemParts[2]);
            if (n1 !== undefined && n2 !== undefined) {
              if (!lineMap.has(entityTag)) lineMap.set(entityTag, []);
              lineMap.get(entityTag)!.push(n1, n2);
            }
          } else if (elementType === 2) {
            // 3-node triangle
            const n1 = nodeTagToIndex.get(elemParts[1]);
            const n2 = nodeTagToIndex.get(elemParts[2]);
            const n3 = nodeTagToIndex.get(elemParts[3]);
            if (n1 !== undefined && n2 !== undefined && n3 !== undefined) {
              surfaceTriangles.push(n1, n2, n3);
              surfaceTags.push(entityTag);
            }
          } else if (elementType === 3) {
            // 4-node quadrangle (split into two triangles)
            const n1 = nodeTagToIndex.get(elemParts[1]);
            const n2 = nodeTagToIndex.get(elemParts[2]);
            const n3 = nodeTagToIndex.get(elemParts[3]);
            const n4 = nodeTagToIndex.get(elemParts[4]);
            if (n1 !== undefined && n2 !== undefined && n3 !== undefined && n4 !== undefined) {
              surfaceTriangles.push(n1, n2, n3);
              surfaceTags.push(entityTag);
              surfaceTriangles.push(n1, n3, n4);
              surfaceTags.push(entityTag);
            }
          } else if (elementType === 4) {
            // 4-node tetrahedron (add 4 faces)
            const n1 = nodeTagToIndex.get(elemParts[1]);
            const n2 = nodeTagToIndex.get(elemParts[2]);
            const n3 = nodeTagToIndex.get(elemParts[3]);
            const n4 = nodeTagToIndex.get(elemParts[4]);
            if (n1 !== undefined && n2 !== undefined && n3 !== undefined && n4 !== undefined) {
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
      while (lineIdx < lines.length && lines[lineIdx].trim() !== '$EndElements') {
        lineIdx++;
      }
      lineIdx++;
    }
  }

  const linesList: GeometricLine[] = [];
  for (const [tag, nodeIndices] of lineMap.entries()) {
    linesList.push({ tag, nodeIndices });
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
    numNodes: totalNodesCount || (nodes.length / 3),
    numElements: (surfaceTriangles.length / 3) + (linesList.reduce((acc, l) => acc + l.nodeIndices.length / 2, 0)),
    numPoints: points.length,
    numCurves: linesList.length || numCurves,
    numSurfaces: numSurfaces,
    numVolumes: numVolumes
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

function parseMsh2(content: string): MeshData {
  const lines = content.split(/\r?\n/);
  let lineIdx = 0;

  const nodes: number[] = [];
  const nodeTagToIndex = new Map<number, number>();
  const nodeTags: number[] = [];

  const points: GeometricPoint[] = [];
  const lineMap = new Map<number, number[]>();
  const surfaceTriangles: number[] = [];
  const surfaceTags: number[] = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx++].trim();
    if (!rawLine) continue;

    if (rawLine === '$Nodes') {
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
      while (lineIdx < lines.length && lines[lineIdx].trim() !== '$EndNodes') {
        lineIdx++;
      }
      lineIdx++;
    } else if (rawLine === '$Elements') {
      const numElements = parseInt(lines[lineIdx++].trim(), 10) || 0;
      for (let i = 0; i < numElements && lineIdx < lines.length; i++) {
        const parts = lines[lineIdx++].trim().split(/\s+/).map(Number);
        // parts: [elm-number, elm-type, num-tags, tags..., node-numbers...]
        const elmType = parts[1];
        const numTags = parts[2] || 0;
        // In MSH 2.2, tag 0 is typically physical tag, tag 1 is elementary entity tag
        const entityTag = numTags >= 2 ? parts[4] : (numTags >= 1 ? parts[3] : 1);
        const nodeStart = 3 + numTags;

        if (elmType === 15) {
          // 1-node point
          const nTag = parts[nodeStart];
          const idx = nodeTagToIndex.get(nTag);
          if (idx !== undefined) {
            points.push({
              tag: entityTag,
              nodeIndex: idx,
              x: nodes[idx * 3],
              y: nodes[idx * 3 + 1],
              z: nodes[idx * 3 + 2]
            });
          }
        } else if (elmType === 1) {
          // 2-node line
          const n1 = nodeTagToIndex.get(parts[nodeStart]);
          const n2 = nodeTagToIndex.get(parts[nodeStart + 1]);
          if (n1 !== undefined && n2 !== undefined) {
            if (!lineMap.has(entityTag)) lineMap.set(entityTag, []);
            lineMap.get(entityTag)!.push(n1, n2);
          }
        } else if (elmType === 2) {
          // 3-node triangle
          const n1 = nodeTagToIndex.get(parts[nodeStart]);
          const n2 = nodeTagToIndex.get(parts[nodeStart + 1]);
          const n3 = nodeTagToIndex.get(parts[nodeStart + 2]);
          if (n1 !== undefined && n2 !== undefined && n3 !== undefined) {
            surfaceTriangles.push(n1, n2, n3);
            surfaceTags.push(entityTag);
          }
        } else if (elmType === 3) {
          // 4-node quad
          const n1 = nodeTagToIndex.get(parts[nodeStart]);
          const n2 = nodeTagToIndex.get(parts[nodeStart + 1]);
          const n3 = nodeTagToIndex.get(parts[nodeStart + 2]);
          const n4 = nodeTagToIndex.get(parts[nodeStart + 3]);
          if (n1 !== undefined && n2 !== undefined && n3 !== undefined && n4 !== undefined) {
            surfaceTriangles.push(n1, n2, n3);
            surfaceTags.push(entityTag);
            surfaceTriangles.push(n1, n3, n4);
            surfaceTags.push(entityTag);
          }
        }
      }
      while (lineIdx < lines.length && lines[lineIdx].trim() !== '$EndElements') {
        lineIdx++;
      }
      lineIdx++;
    }
  }

  const linesList: GeometricLine[] = [];
  for (const [tag, nodeIndices] of lineMap.entries()) {
    linesList.push({ tag, nodeIndices });
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
    numElements: (surfaceTriangles.length / 3) + (linesList.reduce((acc, l) => acc + l.nodeIndices.length / 2, 0)),
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
