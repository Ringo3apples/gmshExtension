import { Viewer3D, GridInfo } from './viewer3d';
import { ExtensionMessage, WebviewMessage, MeshData } from '../types';

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewMessage): void;
  getState(): any;
  setState(state: any): void;
};

const vscode = acquireVsCodeApi();

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('viewport-container')!;
  const warningBanner = document.getElementById('warning-banner')!;
  const warningText = document.getElementById('warning-text')!;
  const inspectorText = document.getElementById('inspector-text')!;

  const statusBadge = document.getElementById('status-badge');
  const statsGrid = document.getElementById('stats-grid');
  const statsNodes = document.getElementById('stats-nodes')!;
  const statsElements = document.getElementById('stats-elements')!;
  const filenameBadge = document.getElementById('filename-badge')!;

  let lastErrorLine: number | undefined;
  let hasError = false;

  const formatNum = (n: number) => parseFloat(n.toPrecision(6)).toString();
  const updateGridDisplay = (info: GridInfo) => {
    // 1. Bottom Inspector badge in Webview status bar
    if (statsGrid) {
      const stepMmStr = formatNum(info.step * 1000);
      const label = `${stepMmStr} mm/div`;
      statsGrid.textContent = info.visible ? label : `${label} [Off]`;
      statsGrid.style.opacity = info.visible ? '1' : '0.5';
      statsGrid.title = `Grid scale: ${stepMmStr} mm/div${info.visible ? ' (Click to toggle)' : ' (Off - Click to toggle)'}`;
    }

    // 2. Post to VS Code Status Bar
    vscode.postMessage({
      command: 'gridInfo',
      step: info.step,
      size: info.size,
      visible: info.visible
    });
  };

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
    },
    onGridUpdate: (info) => {
      updateGridDisplay(info);
    }
  });

  updateGridDisplay(viewer.getGridInfo());
  if (statsGrid) {
    statsGrid.addEventListener('click', () => {
      viewer.toggleLayer('grid', !viewer.showGrid);
    });
  }

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
  setupToggle('toggle-labels', 'labels', true);

  // Coupled Mesh & Gmsh buttons:
  // - Mesh ON  -> forces Gmsh ON
  // - Gmsh OFF -> forces Mesh OFF
  const meshBtn = document.getElementById('toggle-wireframe');
  const gmshBtn = document.getElementById('toggle-gmsh');
  let wireframeEnabled = true;
  let gmshEnabled = true;

  meshBtn?.classList.toggle('active', wireframeEnabled);
  gmshBtn?.classList.toggle('active', gmshEnabled);

  meshBtn?.addEventListener('click', () => {
    wireframeEnabled = !wireframeEnabled;
    meshBtn.classList.toggle('active', wireframeEnabled);
    viewer.toggleLayer('wireframe', wireframeEnabled);

    if (wireframeEnabled && !gmshEnabled) {
      gmshEnabled = true;
      gmshBtn?.classList.add('active');
      vscode.postMessage({ command: 'setGmshEnabled', enabled: true });
    }
  });

  gmshBtn?.addEventListener('click', () => {
    gmshEnabled = !gmshEnabled;
    gmshBtn.classList.toggle('active', gmshEnabled);

    if (!gmshEnabled && wireframeEnabled) {
      wireframeEnabled = false;
      meshBtn?.classList.remove('active');
      viewer.toggleLayer('wireframe', false);
    }

    vscode.postMessage({ command: 'setGmshEnabled', enabled: gmshEnabled });
  });

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

  // Settings & Discovery buttons
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    vscode.postMessage({ command: 'openSettings' });
  });

  document.getElementById('btn-autodetect')?.addEventListener('click', (e) => {
    e.stopPropagation();
    vscode.postMessage({ command: 'autoDetect' });
  });

  document.getElementById('btn-browse')?.addEventListener('click', (e) => {
    e.stopPropagation();
    vscode.postMessage({ command: 'browseExecutable' });
  });

  // Warning banner click -> settings
  warningBanner.addEventListener('click', () => {
    vscode.postMessage({ command: 'openSettings' });
  });

  // Status badge click -> jump to line on error
  if (statusBadge) {
    statusBadge.addEventListener('click', () => {
      if (hasError) {
        vscode.postMessage({ command: 'jumpToLine', line: lastErrorLine });
      }
    });
  }

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
        if (statusBadge && !hasError) {
          statusBadge.style.display = 'none';
        }
        break;
      }
      case 'showError': {
        hasError = true;
        lastErrorLine = message.line;
        if (statusBadge) {
          statusBadge.textContent = `⚠ ${message.message}`;
          statusBadge.className = 'badge status-badge error';
          statusBadge.title = `${message.message} (Click to jump to line)`;
          statusBadge.style.display = 'inline-flex';
        }
        break;
      }
      case 'clearError': {
        hasError = false;
        if (statusBadge) {
          statusBadge.style.display = 'none';
        }
        break;
      }
      case 'setLoading': {
        if (statusBadge) {
          if (message.loading) {
            hasError = false;
            statusBadge.textContent = 'Running Gmsh...';
            statusBadge.className = 'badge status-badge running';
            statusBadge.title = 'Executing Gmsh...';
            statusBadge.style.display = 'inline-flex';
          } else if (!hasError) {
            statusBadge.style.display = 'none';
          }
        }
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
