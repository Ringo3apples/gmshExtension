import { Viewer3D, GridInfo, SurfaceRegionInfo, CylindricalMode } from './viewer3d';
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
      const nameSuffix = info.name ? ` (${info.name})` : '';
      if (info.type === 'point' && info.coords) {
        inspectorText.textContent = `Point #${info.tag}${nameSuffix} [${info.coords[0].toFixed(2)}, ${info.coords[1].toFixed(2)}, ${info.coords[2].toFixed(2)}]`;
      } else if (info.type === 'line') {
        inspectorText.textContent = `Line #${info.tag}${nameSuffix}`;
      } else if (info.type === 'surface') {
        inspectorText.textContent = `Surface #${info.tag}${nameSuffix}`;
      }
    },
    onGridUpdate: (info) => {
      updateGridDisplay(info);
    },
    onSurfacesUpdate: (surfaces) => {
      renderSurfacesList(surfaces);
    }
  });

  updateGridDisplay(viewer.getGridInfo());
  if (statsGrid) {
    statsGrid.addEventListener('click', () => {
      viewer.toggleLayer('grid', !viewer.showGrid);
    });
  }

  // Layer toggle buttons
  const setupToggle = (btnId: string, layer: 'points' | 'lines' | 'surfaces' | 'wireframe' | 'cylindrical' | 'labels' | 'grid' | 'axes', initial: boolean = true) => {
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
  setupToggle('toggle-labels', 'labels', true);

  // Cylindrical 3-state cycle button: Off -> Translucent (半透明) -> Opaque (不透明) -> Off
  const cylindricalBtn = document.getElementById('toggle-cylindrical');
  const cylindricalModes: CylindricalMode[] = ['off', 'translucent', 'opaque'];
  let cylindricalIdx = 0;

  const updateCylindricalBtnUI = (mode: CylindricalMode) => {
    if (!cylindricalBtn) return;
    cylindricalBtn.classList.toggle('active', mode !== 'off');
    if (mode === 'translucent') {
      cylindricalBtn.textContent = 'Cylindrical ◐';
      cylindricalBtn.title = 'Cylindrical: Translucent (Click for Opaque)';
    } else if (mode === 'opaque') {
      cylindricalBtn.textContent = 'Cylindrical ●';
      cylindricalBtn.title = 'Cylindrical: Opaque (Click to Hide)';
    } else {
      cylindricalBtn.textContent = 'Cylindrical';
      cylindricalBtn.title = 'Cylindrical: Off (Click for Translucent)';
    }
  };
  updateCylindricalBtnUI('off');

  cylindricalBtn?.addEventListener('click', () => {
    cylindricalIdx = (cylindricalIdx + 1) % cylindricalModes.length;
    const nextMode = cylindricalModes[cylindricalIdx];
    viewer.setCylindricalMode(nextMode);
    updateCylindricalBtnUI(nextMode);
  });

  // Surfaces toggle + hover checklist popover
  const surfacesBtn = document.getElementById('toggle-surfaces');
  const surfacesPopover = document.getElementById('surfaces-popover') as HTMLElement | null;
  const surfacesListEl = document.getElementById('surfaces-list');
  const surfacesSelectAllBtn = document.getElementById('surfaces-select-all');
  const surfacesSelectNoneBtn = document.getElementById('surfaces-select-none');

  const syncSurfacesBtnState = () => {
    if (!surfacesBtn) return;
    surfacesBtn.classList.toggle('active', viewer.showSurfaces);
  };
  syncSurfacesBtnState();

  surfacesBtn?.addEventListener('click', () => {
    viewer.toggleLayer('surfaces', !viewer.showSurfaces);
    syncSurfacesBtnState();
  });

  const supportsNativeAnchor = typeof CSS !== 'undefined' && CSS.supports('position-area: block-end');
  const supportsPopoverApi = Boolean(surfacesPopover && typeof (surfacesPopover as any).showPopover === 'function');
  let popoverCloseTimer: number | undefined;
  let popoverVisible = false;
  let isColorPickerActive = false;

  const positionPopoverFallback = () => {
    if (!surfacesBtn || !surfacesPopover || supportsNativeAnchor) return;
    const rect = surfacesBtn.getBoundingClientRect();
    const popWidth = surfacesPopover.offsetWidth || 210;
    const popHeight = surfacesPopover.offsetHeight || 160;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + popWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - popWidth - 12);
    }
    if (top + popHeight > window.innerHeight - 12) {
      top = Math.max(12, rect.top - popHeight - 6);
    }
    surfacesPopover.style.left = `${left}px`;
    surfacesPopover.style.top = `${top}px`;
  };

  const openSurfacesPopover = () => {
    if (!surfacesPopover) return;
    if (popoverCloseTimer !== undefined) {
      window.clearTimeout(popoverCloseTimer);
      popoverCloseTimer = undefined;
    }
    if (!popoverVisible) {
      popoverVisible = true;
      if (supportsPopoverApi) {
        try {
          (surfacesPopover as any).showPopover();
        } catch {
          surfacesPopover.style.display = 'block';
        }
      } else {
        surfacesPopover.style.display = 'block';
      }
    }
    positionPopoverFallback();
  };

  const scheduleCloseSurfacesPopover = () => {
    if (!surfacesPopover || isColorPickerActive) return;
    if (popoverCloseTimer !== undefined) {
      window.clearTimeout(popoverCloseTimer);
    }
    popoverCloseTimer = window.setTimeout(() => {
      popoverCloseTimer = undefined;
      if (!popoverVisible || isColorPickerActive) return;
      popoverVisible = false;
      if (supportsPopoverApi) {
        try {
          (surfacesPopover as any).hidePopover();
        } catch {
          surfacesPopover.style.display = 'none';
        }
      } else {
        surfacesPopover.style.display = 'none';
      }
    }, 180);
  };

  surfacesBtn?.addEventListener('mouseenter', openSurfacesPopover);
  surfacesBtn?.addEventListener('mouseleave', scheduleCloseSurfacesPopover);
  surfacesBtn?.addEventListener('focus', openSurfacesPopover);
  surfacesBtn?.addEventListener('blur', scheduleCloseSurfacesPopover);

  surfacesPopover?.addEventListener('mouseenter', openSurfacesPopover);
  surfacesPopover?.addEventListener('mouseleave', scheduleCloseSurfacesPopover);
  surfacesPopover?.addEventListener('focusin', openSurfacesPopover);
  surfacesPopover?.addEventListener('focusout', (e) => {
    const next = e.relatedTarget as Node | null;
    if (!next || (!surfacesPopover.contains(next) && next !== surfacesBtn)) {
      scheduleCloseSurfacesPopover();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popoverVisible && surfacesPopover) {
      popoverVisible = false;
      if (supportsPopoverApi) {
        try {
          (surfacesPopover as any).hidePopover();
        } catch {
          surfacesPopover.style.display = 'none';
        }
      } else {
        surfacesPopover.style.display = 'none';
      }
    }
  });

  function renderSurfacesList(surfaces: SurfaceRegionInfo[]) {
    if (!surfacesListEl) return;
    surfacesListEl.innerHTML = '';

    if (surfaces.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'surfaces-empty';
      empty.textContent = 'No surfaces';
      surfacesListEl.appendChild(empty);
      return;
    }

    surfaces.forEach((region, idx) => {
      const row = document.createElement('div');
      row.className = 'surface-item';

      const checkboxId = `surface-chk-${idx}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId;
      checkbox.checked = region.visible;
      checkbox.addEventListener('change', () => {
        viewer.setSurfaceRegionVisible(region.key, checkbox.checked);
        if (checkbox.checked && !viewer.showSurfaces) {
          viewer.toggleLayer('surfaces', true);
          syncSurfacesBtnState();
        }
      });

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.className = 'surface-color-picker';
      colorInput.value = region.color;
      colorInput.title = `Change color for ${region.label}`;
      colorInput.setAttribute('aria-label', `Change color for ${region.label}`);
      colorInput.addEventListener('click', (e) => {
        e.stopPropagation();
        isColorPickerActive = true;
      });
      colorInput.addEventListener('focus', () => {
        isColorPickerActive = true;
      });
      colorInput.addEventListener('input', () => {
        viewer.setSurfaceRegionColor(region.key, colorInput.value);
      });
      colorInput.addEventListener('change', () => {
        viewer.setSurfaceRegionColor(region.key, colorInput.value);
        isColorPickerActive = false;
      });
      colorInput.addEventListener('blur', () => {
        isColorPickerActive = false;
      });

      const labelText = document.createElement('label');
      labelText.className = 'surface-item-label';
      labelText.htmlFor = checkboxId;
      labelText.textContent = region.label;
      labelText.title = region.label;

      row.appendChild(checkbox);
      row.appendChild(colorInput);
      row.appendChild(labelText);
      surfacesListEl.appendChild(row);
    });

    if (popoverVisible) {
      positionPopoverFallback();
    }
  }

  surfacesSelectAllBtn?.addEventListener('click', () => {
    viewer.setAllSurfacesVisible(true);
    if (!viewer.showSurfaces) {
      viewer.toggleLayer('surfaces', true);
      syncSurfacesBtnState();
    }
    renderSurfacesList(viewer.getSurfaceRegions());
  });

  surfacesSelectNoneBtn?.addEventListener('click', () => {
    viewer.setAllSurfacesVisible(false);
    renderSurfacesList(viewer.getSurfaceRegions());
  });

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
