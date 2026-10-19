import * as THREE from 'three';
import { GeometricPoint, GeometricLine } from '../types';

export class LabelManager {
  private group: THREE.Group;
  private pointGroup: THREE.Group;
  private lineGroup: THREE.Group;
  private pointSprites: THREE.Sprite[] = [];
  private lineSprites: THREE.Sprite[] = [];
  private visible: boolean = true;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.name = 'labelsGroup';

    this.pointGroup = new THREE.Group();
    this.pointGroup.name = 'pointLabelsGroup';
    this.group.add(this.pointGroup);

    this.lineGroup = new THREE.Group();
    this.lineGroup.name = 'lineLabelsGroup';
    this.group.add(this.lineGroup);

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

  public clear() {
    this.clearGroup(this.pointGroup);
    this.clearGroup(this.lineGroup);
    this.pointSprites = [];
    this.lineSprites = [];
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
    scale: number,
    showPoints: boolean = true,
    showLines: boolean = true
  ) {
    this.clear();
    this.group.visible = this.visible;
    this.setPointLabelsVisible(showPoints);
    this.setLineLabelsVisible(showLines);

    const spriteScale = Math.max(scale * 0.06, 0.2);

    // Create Point labels: "P1", "P2", ...
    points.forEach((pt) => {
      const sprite = this.createTextSprite(`P${pt.tag}`, '#38bdf8', '#0f172a');
      sprite.position.set(pt.x, pt.y, pt.z);
      sprite.scale.set(spriteScale * 1.5, spriteScale * 0.75, 1);
      sprite.userData = { entityType: 'point', tag: pt.tag };
      this.pointGroup.add(sprite);
      this.pointSprites.push(sprite);
    });

    // Create Line labels: "L1", "L2", ... at midpoint of line
    lines.forEach((line) => {
      if (line.nodeIndices.length >= 2) {
        // Find midpoint of first segment
        const n1 = line.nodeIndices[0];
        const n2 = line.nodeIndices[1];
        const mx = (nodes[n1 * 3] + nodes[n2 * 3]) / 2;
        const my = (nodes[n1 * 3 + 1] + nodes[n2 * 3 + 1]) / 2;
        const mz = (nodes[n1 * 3 + 2] + nodes[n2 * 3 + 2]) / 2;

        const sprite = this.createTextSprite(`L${line.tag}`, '#f59e0b', '#0f172a');
        sprite.position.set(mx, my, mz);
        sprite.scale.set(spriteScale * 1.5, spriteScale * 0.75, 1);
        sprite.userData = { entityType: 'line', tag: line.tag };
        this.lineGroup.add(sprite);
        this.lineSprites.push(sprite);
      }
    });
  }

  private createTextSprite(text: string, textColor: string, bgColor: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Rounded pill background
    ctx.fillStyle = bgColor;
    ctx.globalAlpha = 0.85;
    this.roundRect(ctx, 4, 8, 120, 48, 12);
    ctx.fill();

    // Border
    ctx.lineWidth = 3;
    ctx.strokeStyle = textColor;
    ctx.globalAlpha = 1.0;
    ctx.stroke();

    // Text
    ctx.fillStyle = textColor;
    ctx.font = 'bold 26px "Segoe UI", Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      depthWrite: false
    });

    return new THREE.Sprite(material);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
