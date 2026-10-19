import * as vscode from 'vscode';
import * as path from 'path';
import { GmshRunner } from './gmshRunner';
import { ExtensionConfig, WebviewMessage } from './types';

export class GmshPreviewPanel {
  public static currentPanel: GmshPreviewPanel | undefined;
  public static readonly viewType = 'gmshPreview';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _gmshRunner: GmshRunner;
  private _disposables: vscode.Disposable[] = [];

  private _activeDocument: vscode.TextDocument | null = null;
  private _debounceTimer: NodeJS.Timeout | null = null;
  private _currentDimension: number = 2;
  private _isReady: boolean = false;

  public static createOrShow(extensionUri: vscode.Uri, document?: vscode.TextDocument) {
    const column = vscode.ViewColumn.Beside;

    // If panel already exists, show it
    if (GmshPreviewPanel.currentPanel) {
      GmshPreviewPanel.currentPanel._panel.reveal(column);
      if (document) {
        GmshPreviewPanel.currentPanel.setDocument(document);
      }
      return GmshPreviewPanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      GmshPreviewPanel.viewType,
      'Gmsh 3D Preview',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    GmshPreviewPanel.currentPanel = new GmshPreviewPanel(panel, extensionUri, document);
    return GmshPreviewPanel.currentPanel;
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, document?: vscode.TextDocument) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._gmshRunner = new GmshRunner();

    const config = this.getConfig();
    this._currentDimension = config.meshDimension;

    // Set webview HTML content
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Set panel icon
    // (can use standard Codicon or custom icon)

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this._handleMessage(message),
      null,
      this._disposables
    );

    // Watch for active document changes
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

  private isGmshFile(doc: vscode.TextDocument): boolean {
    const ext = path.extname(doc.fileName).toLowerCase();
    return ext === '.geo' || ext === '.msh' || doc.languageId === 'gmsh' || doc.languageId === 'geo';
  }

  public setDocument(document: vscode.TextDocument) {
    this._activeDocument = document;
    this._panel.title = `Preview: ${path.basename(document.fileName)}`;
    if (this._isReady) {
      this.updatePreviewImmediate();
    }
  }

  private getConfig(): ExtensionConfig {
    const cfg = vscode.workspace.getConfiguration('gmsh');
    return {
      executablePath: cfg.get<string>('executablePath', 'gmsh'),
      meshDimension: cfg.get<number>('meshDimension', 2),
      debounceDelay: cfg.get<number>('debounceDelay', 400),
      pointSize: cfg.get<number>('pointSize', 1.0),
      pointColor: cfg.get<string>('pointColor', '#38bdf8'),
      lineColor: cfg.get<string>('lineColor', '#f59e0b'),
      surfaceColor: cfg.get<string>('surfaceColor', '#475569'),
      meshWireframeColor: cfg.get<string>('meshWireframeColor', '#94a3b8'),
      backgroundColor: cfg.get<string>('backgroundColor', '#111827'),
      showLabels: cfg.get<boolean>('showLabels', true),
      showAxes: cfg.get<boolean>('showAxes', true),
      showGrid: cfg.get<boolean>('showGrid', true),
      showPoints: cfg.get<boolean>('showPoints', true),
      showLines: cfg.get<boolean>('showLines', true),
      showSurfaces: cfg.get<boolean>('showSurfaces', true),
      showMeshWireframe: cfg.get<boolean>('showMeshWireframe', true)
    };
  }

  public triggerUpdate() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    const delay = this.getConfig().debounceDelay;
    this._debounceTimer = setTimeout(() => {
      this.updatePreviewImmediate();
    }, delay);
  }

  public async updatePreviewImmediate() {
    if (!this._activeDocument) return;

    const content = this._activeDocument.getText();
    const filePath = this._activeDocument.fileName;
    const config = this.getConfig();

    // 3D volumetric meshing removed: strictly use 2D surface meshing so all models display clean planar surfaces
    this._currentDimension = 2;

    this._panel.webview.postMessage({ command: 'setLoading', loading: true });

    const result = await this._gmshRunner.runGmsh(
      content,
      filePath,
      config.executablePath,
      2
    );

    if (result.data) {
      this._panel.webview.postMessage({
        command: 'updateMesh',
        data: result.data,
        sourceFile: path.basename(filePath)
      });
    }

    if (result.error) {
      this._panel.webview.postMessage({
        command: 'showError',
        message: result.error,
        line: result.errorLine
      });
    } else {
      this._panel.webview.postMessage({ command: 'clearError' });
    }
  }

  private async _handleMessage(message: WebviewMessage) {
    switch (message.command) {
      case 'ready':
        this._isReady = true;
        if (this._activeDocument) {
          this.updatePreviewImmediate();
        }
        break;

      case 'selectEntity':
        this._jumpToEntityInEditor(message.entityType, message.tag);
        break;

      case 'jumpToLine':
        this._jumpToLineInEditor(message.line);
        break;

      case 'requestRemesh':
        this._currentDimension = message.dimension;
        this.updatePreviewImmediate();
        break;

      case 'export':
        this._handleExport(message.format, message.dimension ?? this._currentDimension);
        break;

      case 'openSettings':
        vscode.commands.executeCommand('workbench.action.openSettings', 'gmsh');
        break;

      case 'autoDetect':
        vscode.commands.executeCommand('gmshPreview.autoDetect');
        break;

      case 'browseExecutable':
        vscode.commands.executeCommand('gmshPreview.browseExecutable');
        break;
    }
  }

  private async _jumpToLineInEditor(lineNumber?: number) {
    if (!this._activeDocument) return;

    const editor = await vscode.window.showTextDocument(this._activeDocument, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false
    });

    if (lineNumber !== undefined && lineNumber > 0) {
      const targetLine = Math.min(lineNumber - 1, Math.max(0, this._activeDocument.lineCount - 1));
      const line = this._activeDocument.lineAt(targetLine);
      const range = line.range;

      editor.selection = new vscode.Selection(targetLine, 0, targetLine, line.text.length);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    }
  }

  private async _jumpToEntityInEditor(entityType: 'point' | 'line' | 'surface', tag: number) {
    if (!this._activeDocument) return;

    const editor = await vscode.window.showTextDocument(this._activeDocument, {
      viewColumn: vscode.ViewColumn.One,
      preserveFocus: false
    });

    const text = this._activeDocument.getText();
    const lines = text.split(/\r?\n/);

    // Build regex based on entity type
    let regex: RegExp;
    if (entityType === 'point') {
      regex = new RegExp(`\\bPoint\\s*\\(\\s*${tag}\\s*\\)`, 'i');
    } else if (entityType === 'line') {
      regex = new RegExp(`\\b(?:Line|Circle|Spline|BSpline)\\s*\\(\\s*${tag}\\s*\\)`, 'i');
    } else {
      regex = new RegExp(`\\b(?:Plane\\s+Surface|Surface|Box|Cylinder|Sphere)\\s*\\(\\s*${tag}\\s*\\)`, 'i');
    }

    let targetLine = -1;
    let targetCol = 0;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(regex);
      if (match && match.index !== undefined) {
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

  private async _handleExport(format: 'stl' | 'obj' | 'msh', dimension: number) {
    if (!this._activeDocument) return;

    const defaultFilename = path.basename(this._activeDocument.fileName, path.extname(this._activeDocument.fileName)) + `.${format}`;
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(path.dirname(this._activeDocument.fileName), defaultFilename)),
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
          this._activeDocument!.getText(),
          this._activeDocument!.fileName,
          uri.fsPath,
          format,
          config.executablePath,
          dimension
        );

        if (res.success) {
          vscode.window.showInformationMessage(`Successfully exported to ${path.basename(uri.fsPath)}`);
        } else {
          vscode.window.showErrorMessage(`Export failed: ${res.error}`);
        }
      }
    );
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'preview.bundle.js')).with({ query: `t=${Date.now()}` });
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'styles.css')).with({ query: `t=${Date.now()}` });

    // Nonce for CSP
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
      <button id="toggle-grid" class="toggle-btn" title="Grid & Origin Axes (0,0,0)">Grid</button>
    </div>

    <!-- Export & Settings -->
    <div class="toolbar-group">
      <div class="dropdown">
        <button class="btn" title="Export Model">Export ▾</button>
        <div class="dropdown-content">
          <button id="export-stl">Export STL (.stl)</button>
          <button id="export-obj">Export OBJ (.obj)</button>
          <button id="export-msh">Export Gmsh (.msh)</button>
        </div>
      </div>
      <button id="btn-settings" class="btn btn-icon" title="Configure Gmsh Path">⚙</button>
    </div>
  </div>

  <!-- Error Banner -->
  <div id="error-banner" class="error-banner" title="Click to jump to line in code">
    <span id="error-text">Syntax Error</span>
    <span class="badge" style="background: rgba(0,0,0,0.3); color: #fff;">Jump to line ↗</span>
  </div>

  <!-- Warning Banner -->
  <div id="warning-banner" class="warning-banner">
    <span id="warning-text">Gmsh CLI not detected. Using fast fallback preview.</span>
    <div style="display: flex; gap: 6px; align-items: center;">
      <button id="btn-autodetect" class="btn" style="padding: 2px 8px; font-size: 11px; background: rgba(0,0,0,0.2); color: #000;" title="Search system directories for gmsh">🔍 自動検出</button>
      <button id="btn-browse" class="btn" style="padding: 2px 8px; font-size: 11px; background: rgba(0,0,0,0.2); color: #000;" title="Browse for gmsh.exe">📁 参照...</button>
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

  public dispose() {
    GmshPreviewPanel.currentPanel = undefined;

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
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
