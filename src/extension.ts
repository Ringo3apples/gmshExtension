import * as vscode from 'vscode';
import { GmshPreviewPanel } from './previewPanel';
import { GmshRunner } from './gmshRunner';

export function activate(context: vscode.ExtensionContext) {
  const runner = new GmshRunner();

  // Check gmsh status on activation
  const config = vscode.workspace.getConfiguration('gmsh');
  const gmshPath = config.get<string>('executablePath', 'gmsh');

  runner.checkGmsh(gmshPath).then((status) => {
    if (status.available) {
      console.log(`Gmsh detected: ${status.path} (version: ${status.version || 'unknown'})`);
    } else {
      console.log(`Gmsh executable not found at "${gmshPath}". Fallback parser will be used.`);
    }
  });

  // Status Bar Item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'gmshPreview.open';
  statusBarItem.text = '$(eye) Gmsh Preview';
  statusBarItem.tooltip = 'Open Gmsh 3D Realtime Preview';

  const updateStatusBarVisibility = () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && (editor.document.fileName.endsWith('.geo') || editor.document.fileName.endsWith('.msh'))) {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBarVisibility),
    statusBarItem
  );
  updateStatusBarVisibility();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('gmshPreview.open', (uri?: vscode.Uri) => {
      let doc: vscode.TextDocument | undefined;
      if (uri) {
        vscode.workspace.openTextDocument(uri).then((d) => {
          GmshPreviewPanel.createOrShow(context.extensionUri, d);
        });
        return;
      }

      if (vscode.window.activeTextEditor) {
        doc = vscode.window.activeTextEditor.document;
      }
      GmshPreviewPanel.createOrShow(context.extensionUri, doc);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gmshPreview.remesh', () => {
      if (GmshPreviewPanel.currentPanel) {
        GmshPreviewPanel.currentPanel.updatePreviewImmediate();
      }
    })
  );
}

export function deactivate() {
  if (GmshPreviewPanel.currentPanel) {
    GmshPreviewPanel.currentPanel.dispose();
  }
}
