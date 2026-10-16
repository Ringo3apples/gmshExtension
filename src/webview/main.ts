import { Viewer3D } from './viewer3d';
import { ExtensionMessage, WebviewMessage, MeshData } from '../types';

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewMessage): void;
  getState(): any;
  setState(state: any): void;
};

const vscode = acquireVsCodeApi();

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('viewport-container')!;
  const errorBanner = document.getElementById('error-banner')!;
  const errorText = document.getElementById('error-text')!;
  const warningBanner = document.getElementById('warning-banner')!;
  const warningText = document.getElementById('warning-text')!;
  const loadingOverlay = document.getElementById('loading-overlay')!;
  const inspectorText = document.getElementById('inspector-text')!;

  const statsNodes = document.getElementById('stats-nodes')!;
  const statsElements = document.getElementById('stats-elements')!;
  const filenameBadge = document.getElementById('filename-badge')!;

  let currentMeshDimension = 2;
  let lastErrorLine: number | undefined;

  // Initialize Viewer3D
  const viewer = new Viewer3D({
    container,
    onSelectEntity: (entityType, tag) => {
      vscode.postMessage({ command: 'selectEntity', entityType, tag });
    },
    onHoverEntity: (info) => {
      if (!info) {
        inspectorText.textContent = 'Hover over points, lines or surfaces';
        return;
      }
      if (info.type === 'point' && info.coords) {
        inspectorText.textContent = `Point #${info.tag} [${info.coords[0].toFixed(2)}, ${info.coords[1].toFixed(2)}, ${info.coords[2].toFixed(2)}]`;
      } else if (info.type === 'line') {
        inspectorText.textContent = `Line #${info.tag}`;
      } else if (info.type === 'surface') {
        inspectorText.textContent = `Surface #${info.tag}`;
      }
    }
  });

  // Layer toggle buttons
  const setupToggle = (btnId: string, layer: 'points' | 'lines' | 'surfaces' | 'wireframe' | 'labels' | 'grid' | 'axes', initial: boolean = true) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    let state = initial;
    if (state) btn.classList.add('active');

    btn.addEventListener('click', () => {
      state = !state;
      btn.classList.toggle('active', state);
      viewer.toggleLayer(layer, state);
    });
  };

  setupToggle('toggle-points', 'points', true);
  setupToggle('toggle-lines', 'lines', true);
  setupToggle('toggle-surfaces', 'surfaces', true);
  setupToggle('toggle-wireframe', 'wireframe', true);
  setupToggle('toggle-labels', 'labels', true);
  setupToggle('toggle-grid', 'grid', true);
  setupToggle('toggle-axes', 'axes', true);

  // View buttons
  document.getElementById('view-top')?.addEventListener('click', () => viewer.setView('top'));
  document.getElementById('view-front')?.addEventListener('click', () => viewer.setView('front'));
  document.getElementById('view-side')?.addEventListener('click', () => viewer.setView('side'));
  document.getElementById('view-iso')?.addEventListener('click', () => viewer.setView('iso'));
  document.getElementById('view-reset')?.addEventListener('click', () => viewer.resetView());

  const orthoBtn = document.getElementById('view-ortho');
  orthoBtn?.addEventListener('click', () => {
    viewer.toggleProjection();
    orthoBtn.classList.toggle('active', viewer.isOrtho);
    orthoBtn.textContent = viewer.isOrtho ? 'Ortho' : 'Persp';
  });

  // Dimension buttons
  const dimButtons = document.querySelectorAll<HTMLButtonElement>('.segmented-control button');
  dimButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      dimButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const dim = parseInt(btn.dataset.dim || '2', 10);
      currentMeshDimension = dim;
      vscode.postMessage({ command: 'requestRemesh', dimension: dim });
    });
  });

  // Export buttons
  document.getElementById('export-stl')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'export', format: 'stl', dimension: currentMeshDimension });
  });
  document.getElementById('export-obj')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'export', format: 'obj', dimension: currentMeshDimension });
  });
  document.getElementById('export-msh')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'export', format: 'msh', dimension: currentMeshDimension });
  });

  // Settings button
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'openSettings' });
  });

  // Warning banner click -> settings
  warningBanner.addEventListener('click', () => {
    vscode.postMessage({ command: 'openSettings' });
  });

  // Error banner click -> jump to line
  errorBanner.addEventListener('click', () => {
    if (lastErrorLine !== undefined) {
      vscode.postMessage({ command: 'selectEntity', entityType: 'point', tag: lastErrorLine });
    }
  });

  // Handle messages from Extension
  window.addEventListener('message', (event: MessageEvent<ExtensionMessage>) => {
    const message = event.data;
    switch (message.command) {
      case 'updateMesh': {
        const data: MeshData = message.data;
        filenameBadge.textContent = message.sourceFile || 'Gmsh Model';
        statsNodes.textContent = `${data.stats.numNodes} nodes`;
        statsElements.textContent = `${data.stats.numElements} elements`;

        if (data.isFallback) {
          warningBanner.style.display = 'flex';
          warningText.textContent = 'Gmsh CLI not detected. Using built-in fast geometry preview. Click here to configure Gmsh path.';
        } else {
          warningBanner.style.display = 'none';
        }

        viewer.updateMesh(data);
        loadingOverlay.style.display = 'none';
        break;
      }
      case 'showError': {
        lastErrorLine = message.line;
        errorText.textContent = message.message;
        errorBanner.style.display = 'flex';
        loadingOverlay.style.display = 'none';
        break;
      }
      case 'clearError': {
        errorBanner.style.display = 'none';
        break;
      }
      case 'setLoading': {
        loadingOverlay.style.display = message.loading ? 'flex' : 'none';
        break;
      }
      case 'highlightEntity': {
        viewer.highlightEntity(message.entityType, message.tag);
        break;
      }
    }
  });

  // Signal ready to extension
  vscode.postMessage({ command: 'ready' });
});
