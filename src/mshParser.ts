import { MeshData, GeometricPoint, GeometricLine, PhysicalSurfaceLabel, BoundingBox, MeshStats } from './types';

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

  // Physical names: key = `${dim}:${physTag}` -> name
  const physicalNames = new Map<string, string>();
  const pointPhysNames = new Map<number, string>();
  const curvePhysNames = new Map<number, string>();
  const surfacePhysNames = new Map<number, string>();

  const points: GeometricPoint[] = [];
  const lineMap = new Map<number, number[]>(); // curveTag -> array of nodeIndices
  const surfaceTriangles: number[] = [];
  const surfaceTags: number[] = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  let numCurves = 0;
  let numSurfaces = 0;
  let numVolumes = 0;

  const resolvePhysicalName = (dim: number, physTags: number[]): string | undefined => {
    const names: string[] = [];
    for (const pTag of physTags) {
      const name = physicalNames.get(`${dim}:${pTag}`);
      if (name && !names.includes(name)) {
        names.push(name);
      }
    }
    return names.length > 0 ? names.join(', ') : undefined;
  };

  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx++].trim();
    if (!rawLine) continue;

    if (rawLine === '$PhysicalNames') {
      const count = parseInt(lines[lineIdx++]?.trim() || '0', 10);
      for (let i = 0; i < count && lineIdx < lines.length; i++) {
        const line = lines[lineIdx++].trim();
        if (line === '$EndPhysicalNames') break;
        const m = line.match(/^(\d+)\s+(\d+)\s+"([^"]*)"/);
        if (m) {
          const dim = parseInt(m[1], 10);
          const pTag = parseInt(m[2], 10);
          const name = m[3];
          physicalNames.set(`${dim}:${pTag}`, name);
        }
      }
      while (lineIdx < lines.length && lines[lineIdx].trim() !== '$EndPhysicalNames') {
        lineIdx++;
      }
      lineIdx++; // skip $EndPhysicalNames
    } else if (rawLine === '$Entities') {
      const header = lines[lineIdx++].trim().split(/\s+/).map(Number);
      const numPoints = header[0] || 0;
      numCurves = header[1] || 0;
      numSurfaces = header[2] || 0;
      numVolumes = header[3] || 0;

      // Points: tag X Y Z numPhysicalTags [physicalTag...]
      for (let i = 0; i < numPoints && lineIdx < lines.length; i++) {
        const parts = lines[lineIdx++].trim().split(/\s+/).map(Number);
        const tag = parts[0];
        const numPhys = parts[4] || 0;
        if (numPhys > 0) {
          const physTags = parts.slice(5, 5 + numPhys);
          const name = resolvePhysicalName(0, physTags);
          if (name) pointPhysNames.set(tag, name);
        }
      }

      // Curves: tag minX minY minZ maxX maxY maxZ numPhysicalTags [physicalTag...] numBoundingPoints [pointTag...]
      for (let i = 0; i < numCurves && lineIdx < lines.length; i++) {
        const parts = lines[lineIdx++].trim().split(/\s+/).map(Number);
        const tag = parts[0];
        const numPhys = parts[7] || 0;
        if (numPhys > 0) {
          const physTags = parts.slice(8, 8 + numPhys);
          const name = resolvePhysicalName(1, physTags);
          if (name) curvePhysNames.set(tag, name);
        }
      }

      // Surfaces: tag minX minY minZ maxX maxY maxZ numPhysicalTags [physicalTag...] numBoundingCurves [curveTag...]
      for (let i = 0; i < numSurfaces && lineIdx < lines.length; i++) {
        const parts = lines[lineIdx++].trim().split(/\s+/).map(Number);
        const tag = parts[0];
        const numPhys = parts[7] || 0;
        if (numPhys > 0) {
          const physTags = parts.slice(8, 8 + numPhys);
          const name = resolvePhysicalName(2, physTags);
          if (name) surfacePhysNames.set(tag, name);
        }
      }

      // Skip remaining (Volumes) until $EndEntities
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
              z,
              physicalName: pointPhysNames.get(entityTag)
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
        const entityTag = blockHeader[1];
        const elementType = blockHeader[2];
        const numElementsInBlock = blockHeader[3];

        for (let e = 0; e < numElementsInBlock && lineIdx < lines.length; e++) {
          const elemParts = lines[lineIdx++].trim().split(/\s+/).map(Number);

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
                z: nodes[idx * 3 + 2],
                physicalName: pointPhysNames.get(entityTag)
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
          }
        }
      }
      while (lineIdx < lines.length && lines[lineIdx].trim() !== '$EndElements') {
        lineIdx++;
      }
      lineIdx++;
    }
  }

  // Ensure point physical names are applied even if $Entities came after $Nodes
  if (pointPhysNames.size > 0) {
    for (const pt of points) {
      if (!pt.physicalName) {
        pt.physicalName = pointPhysNames.get(pt.tag);
      }
    }
  }

  const linesList: GeometricLine[] = [];
  for (const [tag, nodeIndices] of lineMap.entries()) {
    linesList.push({
      tag,
      nodeIndices,
      physicalName: curvePhysNames.get(tag)
    });
  }

  const surfaceLabels = buildSurfaceLabels(nodes, surfaceTriangles, surfaceTags, surfacePhysNames);

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
    numSurfaces: new Set(surfaceTags).size || numSurfaces,
    numVolumes: numVolumes
  };

  return {
    nodes,
    nodeTags,
    points,
    lines: linesList,
    surfaceTriangles,
    surfaceTags,
    surfaceLabels,
    bbox,
    stats,
    labelMode: 'physical'
  };
}

function parseMsh2(content: string): MeshData {
  const lines = content.split(/\r?\n/);
  let lineIdx = 0;

  const nodes: number[] = [];
  const nodeTagToIndex = new Map<number, number>();
  const nodeTags: number[] = [];

  const physicalNames = new Map<string, string>();
  const pointPhysNames = new Map<number, string>();
  const curvePhysNames = new Map<number, string>();
  const surfacePhysNames = new Map<number, string>();

  const points: GeometricPoint[] = [];
  const lineMap = new Map<number, number[]>();
  const surfaceTriangles: number[] = [];
  const surfaceTags: number[] = [];

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  while (lineIdx < lines.length) {
    const rawLine = lines[lineIdx++].trim();
    if (!rawLine) continue;

    if (rawLine === '$PhysicalNames') {
      const count = parseInt(lines[lineIdx++]?.trim() || '0', 10);
      for (let i = 0; i < count && lineIdx < lines.length; i++) {
        const line = lines[lineIdx++].trim();
        if (line === '$EndPhysicalNames') break;
        const m = line.match(/^(\d+)\s+(\d+)\s+"([^"]*)"/);
        if (m) {
          physicalNames.set(`${parseInt(m[1], 10)}:${parseInt(m[2], 10)}`, m[3]);
        }
      }
      while (lineIdx < lines.length && lines[lineIdx].trim() !== '$EndPhysicalNames') {
        lineIdx++;
      }
      lineIdx++;
    } else if (rawLine === '$Nodes') {
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
        const elmType = parts[1];
        const numTags = parts[2] || 0;
        const physTag = numTags >= 1 ? parts[3] : 0;
        const entityTag = numTags >= 2 ? parts[4] : (numTags >= 1 ? parts[3] : 1);
        const nodeStart = 3 + numTags;

        if (elmType === 15) {
          const nTag = parts[nodeStart];
          const idx = nodeTagToIndex.get(nTag);
          if (idx !== undefined) {
            const name = physTag > 0 ? physicalNames.get(`0:${physTag}`) : undefined;
            if (name) pointPhysNames.set(entityTag, name);
            points.push({
              tag: entityTag,
              nodeIndex: idx,
              x: nodes[idx * 3],
              y: nodes[idx * 3 + 1],
              z: nodes[idx * 3 + 2],
              physicalName: name
            });
          }
        } else if (elmType === 1) {
          const n1 = nodeTagToIndex.get(parts[nodeStart]);
          const n2 = nodeTagToIndex.get(parts[nodeStart + 1]);
          if (n1 !== undefined && n2 !== undefined) {
            if (!lineMap.has(entityTag)) lineMap.set(entityTag, []);
            lineMap.get(entityTag)!.push(n1, n2);
            const name = physTag > 0 ? physicalNames.get(`1:${physTag}`) : undefined;
            if (name) curvePhysNames.set(entityTag, name);
          }
        } else if (elmType === 2) {
          const n1 = nodeTagToIndex.get(parts[nodeStart]);
          const n2 = nodeTagToIndex.get(parts[nodeStart + 1]);
          const n3 = nodeTagToIndex.get(parts[nodeStart + 2]);
          if (n1 !== undefined && n2 !== undefined && n3 !== undefined) {
            surfaceTriangles.push(n1, n2, n3);
            surfaceTags.push(entityTag);
            const name = physTag > 0 ? physicalNames.get(`2:${physTag}`) : undefined;
            if (name) surfacePhysNames.set(entityTag, name);
          }
        } else if (elmType === 3) {
          const n1 = nodeTagToIndex.get(parts[nodeStart]);
          const n2 = nodeTagToIndex.get(parts[nodeStart + 1]);
          const n3 = nodeTagToIndex.get(parts[nodeStart + 2]);
          const n4 = nodeTagToIndex.get(parts[nodeStart + 3]);
          if (n1 !== undefined && n2 !== undefined && n3 !== undefined && n4 !== undefined) {
            surfaceTriangles.push(n1, n2, n3);
            surfaceTags.push(entityTag);
            surfaceTriangles.push(n1, n3, n4);
            surfaceTags.push(entityTag);
            const name = physTag > 0 ? physicalNames.get(`2:${physTag}`) : undefined;
            if (name) surfacePhysNames.set(entityTag, name);
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
    linesList.push({
      tag,
      nodeIndices,
      physicalName: curvePhysNames.get(tag)
    });
  }

  const surfaceLabels = buildSurfaceLabels(nodes, surfaceTriangles, surfaceTags, surfacePhysNames);

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
    surfaceLabels,
    bbox,
    stats,
    labelMode: 'physical'
  };
}

/**
 * Computes surface label anchor positions at the area-weighted centroid of each physical surface,
 * snapping to the nearest triangle centroid if the weighted centroid falls outside (e.g. hollow/L-shaped surfaces).
 */
function buildSurfaceLabels(
  nodes: number[],
  surfaceTriangles: number[],
  surfaceTags: number[],
  surfacePhysNames: Map<number, string>
): PhysicalSurfaceLabel[] {
  if (surfacePhysNames.size === 0 || surfaceTriangles.length === 0) return [];

  const surfAccum = new Map<
    number,
    {
      sumX: number;
      sumY: number;
      sumZ: number;
      sumArea: number;
      triCenters: [number, number, number][];
    }
  >();

  for (let i = 0; i < surfaceTags.length; i++) {
    const tag = surfaceTags[i];
    if (!surfacePhysNames.has(tag)) continue;

    const i1 = surfaceTriangles[i * 3];
    const i2 = surfaceTriangles[i * 3 + 1];
    const i3 = surfaceTriangles[i * 3 + 2];

    const ax = nodes[i1 * 3], ay = nodes[i1 * 3 + 1], az = nodes[i1 * 3 + 2];
    const bx = nodes[i2 * 3], by = nodes[i2 * 3 + 1], bz = nodes[i2 * 3 + 2];
    const cx = nodes[i3 * 3], cy = nodes[i3 * 3 + 1], cz = nodes[i3 * 3 + 2];

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const crossX = aby * acz - abz * acy;
    const crossY = abz * acx - abx * acz;
    const crossZ = abx * acy - aby * acx;
    const area = 0.5 * Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);

    const triCx = (ax + bx + cx) / 3;
    const triCy = (ay + by + cy) / 3;
    const triCz = (az + bz + cz) / 3;

    let entry = surfAccum.get(tag);
    if (!entry) {
      entry = { sumX: 0, sumY: 0, sumZ: 0, sumArea: 0, triCenters: [] };
      surfAccum.set(tag, entry);
    }
    entry.sumX += triCx * area;
    entry.sumY += triCy * area;
    entry.sumZ += triCz * area;
    entry.sumArea += area;
    entry.triCenters.push([triCx, triCy, triCz]);
  }

  const labels: PhysicalSurfaceLabel[] = [];
  for (const [tag, entry] of surfAccum.entries()) {
    const name = surfacePhysNames.get(tag);
    if (!name || entry.triCenters.length === 0) continue;

    let lx = entry.triCenters[0][0];
    let ly = entry.triCenters[0][1];
    let lz = entry.triCenters[0][2];

    if (entry.sumArea > 0) {
      const avgX = entry.sumX / entry.sumArea;
      const avgY = entry.sumY / entry.sumArea;
      const avgZ = entry.sumZ / entry.sumArea;

      // Pick the triangle centroid closest to the area-weighted centroid so label always stays on the surface
      let bestDistSq = Infinity;
      for (const tc of entry.triCenters) {
        const dx = tc[0] - avgX;
        const dy = tc[1] - avgY;
        const dz = tc[2] - avgZ;
        const dSq = dx * dx + dy * dy + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          lx = tc[0];
          ly = tc[1];
          lz = tc[2];
        }
      }
      // If a triangle centroid is very close to avg (or mesh is convex), use smooth avg for centered look
      const approxCellSizeSq = (entry.sumArea / entry.triCenters.length) * 1.5;
      if (bestDistSq <= approxCellSizeSq) {
        lx = avgX;
        ly = avgY;
        lz = avgZ;
      }
    }

    labels.push({ tag, physicalName: name, x: lx, y: ly, z: lz });
  }

  return labels;
}
