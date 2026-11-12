import * as THREE from 'three';
import { GeometricPoint, GeometricLine, PhysicalSurfaceLabel } from '../types';

interface LineLabelData {
  sprite: THREE.Sprite;
  nodeIndices: number[];
  fallbackPos: THREE.Vector3;
  aspect: number;
}

export class LabelManager {
  private group: THREE.Group;
  private pointGroup: THREE.Group;
  private lineGroup: THREE.Group;
  private surfaceGroup: THREE.Group;
  private pointSprites: THREE.Sprite[] = [];
  private lineLabels: LineLabelData[] = [];
  private surfaceSprites: THREE.Sprite[] = [];
  private nodes: number[] = [];
  private visible: boolean = true;
  private targetPixelHeight: number = 20;

  // Reusable temporary objects to avoid per-frame GC allocations
  private readonly _vA = new THREE.Vector3();
  private readonly _vB = new THREE.Vector3();
  private readonly _camA = new THREE.Vector3();
  private readonly _camB = new THREE.Vector3();
  private readonly _clipA = new THREE.Vector4();
  private readonly _clipB = new THREE.Vector4();
  private readonly _midWorld = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'labelsGroup';

    this.pointGroup = new THREE.Group();
    this.pointGroup.name = 'pointLabelsGroup';
    this.group.add(this.pointGroup);

    this.lineGroup = new THREE.Group();
    this.lineGroup.name = 'lineLabelsGroup';
    this.group.add(this.lineGroup);

    this.surfaceGroup = new THREE.Group();
    this.surfaceGroup.name = 'surfaceLabelsGroup';
    this.group.add(this.surfaceGroup);

    scene.add(this.group);
  }

  public setVisible(visible: boolean) {
    this.visible = visible;
    this.group.visible = visible;
  }

  public setPointLabelsVisible(visible: boolean) {
    this.pointGroup.visible = visible;
  }

  public setLineLabelsVisible(visible: boolean) {
    this.lineGroup.visible = visible;
  }

  public setSurfaceLabelsVisible(visible: boolean) {
    this.surfaceGroup.visible = visible;
  }

  public clear() {
    this.clearGroup(this.pointGroup);
    this.clearGroup(this.lineGroup);
    this.clearGroup(this.surfaceGroup);
    this.pointSprites = [];
    this.lineLabels = [];
    this.surfaceSprites = [];
  }

  private clearGroup(g: THREE.Group) {
    while (g.children.length > 0) {
      const child = g.children[0];
      g.remove(child);
      if (child instanceof THREE.Sprite) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    }
  }

  public updateLabels(
    points: GeometricPoint[],
    lines: GeometricLine[],
    nodes: number[],
    _scale: number,
    showPoints: boolean = true,
    showLines: boolean = true,
    showSurfaces: boolean = true,
    surfaceLabels: PhysicalSurfaceLabel[] = [],
    labelMode: 'geo' | 'physical' = 'geo'
  ) {
    this.clear();
    this.nodes = nodes;
    this.group.visible = this.visible;
    this.setPointLabelsVisible(showPoints);
    this.setLineLabelsVisible(showLines);
    this.setSurfaceLabelsVisible(showSurfaces);

    // Point labels: "P1", "P2"... in geo mode, or Physical Name in physical mode
    points.forEach((pt) => {
      const labelText = labelMode === 'physical' ? pt.physicalName : `P${pt.tag}`;
      if (!labelText) return;

      const { sprite, aspect } = this.createTextSprite(labelText, '#38bdf8');
      sprite.position.set(pt.x, pt.y, pt.z);
      // Point marker is 10px diameter (5px radius). Place label bottom 7px above point center.
      sprite.center.set(0.5, -0.35);
      sprite.userData = { entityType: 'point', tag: pt.tag, aspect };
      this.pointGroup.add(sprite);
      this.pointSprites.push(sprite);
    });

    // Line / Curve labels: "L1", "L2"... in geo mode, or Physical Name in physical mode
    lines.forEach((line) => {
      const labelText = labelMode === 'physical' ? line.physicalName : `L${line.tag}`;
      if (!labelText || line.nodeIndices.length < 2) return;

      const midIdx = Math.floor((line.nodeIndices.length / 2) / 2) * 2;
      const n1 = line.nodeIndices[midIdx] ?? line.nodeIndices[0];
      const n2 = line.nodeIndices[midIdx + 1] ?? line.nodeIndices[1];
      const fallbackPos = new THREE.Vector3(
        (nodes[n1 * 3] + nodes[n2 * 3]) / 2,
        (nodes[n1 * 3 + 1] + nodes[n2 * 3 + 1]) / 2,
        (nodes[n1 * 3 + 2] + nodes[n2 * 3 + 2]) / 2
      );

      const { sprite, aspect } = this.createTextSprite(labelText, '#f59e0b');
      sprite.position.copy(fallbackPos);
      sprite.userData = { entityType: 'line', tag: line.tag, aspect };
      this.lineGroup.add(sprite);
      this.lineLabels.push({
        sprite,
        nodeIndices: line.nodeIndices,
        fallbackPos,
        aspect
      });
    });

    // Surface Physical labels (physical mode only)
    if (labelMode === 'physical' && surfaceLabels.length > 0) {
      surfaceLabels.forEach((sl) => {
        if (!sl.physicalName) return;
        const { sprite, aspect } = this.createTextSprite(sl.physicalName, '#34d399');
        sprite.position.set(sl.x, sl.y, sl.z);
        sprite.center.set(0.5, 0.5);
        sprite.userData = { entityType: 'surface', tag: sl.tag, aspect };
        this.surfaceGroup.add(sprite);
        this.surfaceSprites.push(sprite);
      });
    }
  }

  /**
   * Update label screen-space position (for lines) and constant pixel scale (for points, lines, & surfaces)
   */
  public updateScales(camera: THREE.Camera, viewportWidth: number, viewportHeight: number) {
    if (!this.visible || viewportWidth <= 0 || viewportHeight <= 0) return;

    const hasPoints = this.pointGroup.visible && this.pointSprites.length > 0;
    const hasLines = this.lineGroup.visible && this.lineLabels.length > 0;
    const hasSurfaces = this.surfaceGroup.visible && this.surfaceSprites.length > 0;
    if (!hasPoints && !hasLines && !hasSurfaces) return;

    camera.updateMatrixWorld();

    // Reposition line labels at the center of their visible portion on screen
    if (hasLines) {
      this.updateLineLabelPlacements(camera, viewportWidth, viewportHeight);
    }

    if (camera instanceof THREE.PerspectiveCamera) {
      const factor = (this.targetPixelHeight / viewportHeight) * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const camPos = camera.position;

      if (hasPoints) {
        for (let i = 0; i < this.pointSprites.length; i++) {
          const s = this.pointSprites[i];
          const aspect = (s.userData.aspect as number) || 2;
          const dist = camPos.distanceTo(s.position);
          const h = dist * factor;
          s.scale.set(h * aspect, h, 1);
        }
      }

      if (hasLines) {
        for (let i = 0; i < this.lineLabels.length; i++) {
          const item = this.lineLabels[i];
          const dist = camPos.distanceTo(item.sprite.position);
          const h = dist * factor;
          item.sprite.scale.set(h * item.aspect, h, 1);
        }
      }

      if (hasSurfaces) {
        for (let i = 0; i < this.surfaceSprites.length; i++) {
          const s = this.surfaceSprites[i];
          const aspect = (s.userData.aspect as number) || 2;
          const dist = camPos.distanceTo(s.position);
          const h = dist * factor;
          s.scale.set(h * aspect, h, 1);
        }
      }
    } else if (camera instanceof THREE.OrthographicCamera) {
      const frustumHeight = (camera.top - camera.bottom) / camera.zoom;
      const h = (this.targetPixelHeight / viewportHeight) * frustumHeight;

      if (hasPoints) {
        for (let i = 0; i < this.pointSprites.length; i++) {
          const s = this.pointSprites[i];
          const aspect = (s.userData.aspect as number) || 2;
          s.scale.set(h * aspect, h, 1);
        }
      }

      if (hasLines) {
        for (let i = 0; i < this.lineLabels.length; i++) {
          const item = this.lineLabels[i];
          item.sprite.scale.set(h * item.aspect, h, 1);
        }
      }

      if (hasSurfaces) {
        for (let i = 0; i < this.surfaceSprites.length; i++) {
          const s = this.surfaceSprites[i];
          const aspect = (s.userData.aspect as number) || 2;
          s.scale.set(h * aspect, h, 1);
        }
      }
    }
  }

  /**
   * Place each line label at the midpoint of the currently visible portion of the line:
   * - If the visible segment is vertical on screen (|dy| >= |dx|), place label to the right.
   * - If the visible segment is horizontal on screen (|dx| > |dy|), place label below.
   */
  private updateLineLabelPlacements(camera: THREE.Camera, viewportWidth: number, viewportHeight: number) {
    const halfW = viewportWidth * 0.5;
    const halfH = viewportHeight * 0.5;
    const isPersp = camera instanceof THREE.PerspectiveCamera;
    const nearZ = isPersp ? -(camera as THREE.PerspectiveCamera).near : -Infinity;
    const invMat = camera.matrixWorldInverse;
    const projMat = camera.projectionMatrix;
    const worldMat = camera.matrixWorld;
    const nodes = this.nodes;

    const visibleSegs: {
      camA: THREE.Vector3;
      camB: THREE.Vector3;
      wA: number;
      wB: number;
      s0: number;
      s1: number;
      dx: number;
      dy: number;
      len: number;
    }[] = [];

    for (let i = 0; i < this.lineLabels.length; i++) {
      const item = this.lineLabels[i];
      const indices = item.nodeIndices;
      visibleSegs.length = 0;
      let totalVisibleLen = 0;

      for (let j = 0; j + 1 < indices.length; j += 2) {
        const idxA = indices[j];
        const idxB = indices[j + 1];
        this._vA.set(nodes[idxA * 3], nodes[idxA * 3 + 1], nodes[idxA * 3 + 2]);
        this._vB.set(nodes[idxB * 3], nodes[idxB * 3 + 1], nodes[idxB * 3 + 2]);

        this._camA.copy(this._vA).applyMatrix4(invMat);
        this._camB.copy(this._vB).applyMatrix4(invMat);

        if (isPersp) {
          const aBehind = this._camA.z > nearZ;
          const bBehind = this._camB.z > nearZ;
          if (aBehind && bBehind) continue;
          if (aBehind) {
            const t = (nearZ - this._camA.z) / (this._camB.z - this._camA.z);
            this._camA.lerp(this._camB, t);
          } else if (bBehind) {
            const t = (nearZ - this._camB.z) / (this._camA.z - this._camB.z);
            this._camB.lerp(this._camA, t);
          }
        }

        this._clipA.set(this._camA.x, this._camA.y, this._camA.z, 1).applyMatrix4(projMat);
        this._clipB.set(this._camB.x, this._camB.y, this._camB.z, 1).applyMatrix4(projMat);

        if (Math.abs(this._clipA.w) < 1e-9 || Math.abs(this._clipB.w) < 1e-9) continue;

        const ndcAx = this._clipA.x / this._clipA.w;
        const ndcAy = this._clipA.y / this._clipA.w;
        const ndcBx = this._clipB.x / this._clipB.w;
        const ndcBy = this._clipB.y / this._clipB.w;

        const clipped = this.clipSegment2D(ndcAx, ndcAy, ndcBx, ndcBy);
        if (!clipped) continue;

        const [s0, s1] = clipped;
        const visAx = (ndcAx + s0 * (ndcBx - ndcAx)) * halfW;
        const visAy = (ndcAy + s0 * (ndcBy - ndcAy)) * halfH;
        const visBx = (ndcAx + s1 * (ndcBx - ndcAx)) * halfW;
        const visBy = (ndcAy + s1 * (ndcBy - ndcAy)) * halfH;

        const dx = visBx - visAx;
        const dy = visBy - visAy;
        const len = Math.hypot(dx, dy);

        if (len > 1e-3) {
          visibleSegs.push({
            camA: this._camA.clone(),
            camB: this._camB.clone(),
            wA: this._clipA.w,
            wB: this._clipB.w,
            s0,
            s1,
            dx,
            dy,
            len
          });
          totalVisibleLen += len;
        }
      }

      if (visibleSegs.length === 0 || totalVisibleLen <= 0) {
        item.sprite.position.copy(item.fallbackPos);
        item.sprite.center.set(0.5, 0.5);
        continue;
      }

      // Find the segment containing the halfway point along visible screen length
      const targetLen = totalVisibleLen * 0.5;
      let accum = 0;
      let chosen = visibleSegs[visibleSegs.length - 1];
      let localRatio = 0.5;

      for (let k = 0; k < visibleSegs.length; k++) {
        const seg = visibleSegs[k];
        if (accum + seg.len >= targetLen) {
          localRatio = (targetLen - accum) / seg.len;
          chosen = seg;
          break;
        }
        accum += seg.len;
      }

      const s = chosen.s0 + localRatio * (chosen.s1 - chosen.s0);
      // Perspective-correct interpolation parameter u in camera space
      const denom = (1 - s) * chosen.wB + s * chosen.wA;
      const u = Math.abs(denom) > 1e-9 ? (s * chosen.wA) / denom : s;

      this._midWorld.copy(chosen.camA).lerp(chosen.camB, u).applyMatrix4(worldMat);
      item.sprite.position.copy(this._midWorld);

      // Anchor relative to line orientation on screen
      const spriteWidthPx = this.targetPixelHeight * item.aspect;
      if (Math.abs(chosen.dy) >= Math.abs(chosen.dx)) {
        // Vertical line on screen -> place label to the right (5px gap)
        const gapRatioX = 5 / Math.max(spriteWidthPx, 1);
        item.sprite.center.set(-gapRatioX, 0.5);
      } else {
        // Horizontal line on screen -> place label below (3px gap)
        const gapRatioY = 3 / this.targetPixelHeight;
        item.sprite.center.set(0.5, 1 + gapRatioY);
      }
    }
  }

  private clipSegment2D(x0: number, y0: number, x1: number, y1: number): [number, number] | null {
    let t0 = 0;
    let t1 = 1;
    const dx = x1 - x0;
    const dy = y1 - y0;

    const pArr = [-dx, dx, -dy, dy];
    const qArr = [x0 + 1, 1 - x0, y0 + 1, 1 - y0];

    for (let i = 0; i < 4; i++) {
      const p = pArr[i];
      const q = qArr[i];
      if (Math.abs(p) < 1e-12) {
        if (q < 0) return null;
      } else {
        const r = q / p;
        if (p < 0) {
          if (r > t1) return null;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return null;
          if (r < t1) t1 = r;
        }
      }
    }

    return t0 <= t1 ? [t0, t1] : null;
  }

  private createTextSprite(text: string, textColor: string): { sprite: THREE.Sprite; aspect: number } {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const font = 'bold 28px "Segoe UI", Inter, sans-serif';
    ctx.font = font;

    const textWidth = ctx.measureText(text).width;
    const width = Math.max(Math.ceil(textWidth + 12), 24);
    const height = 40;

    canvas.width = width;
    canvas.height = height;

    // Re-apply font after canvas resize
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Subtle dark halo for crisp legibility without any box or border
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeText(text, width / 2, height / 2);

    ctx.fillStyle = textColor;
    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false
    });

    const sprite = new THREE.Sprite(material);
    return { sprite, aspect: width / height };
  }
}
