import * as vscode from 'vscode';
import { GmshPreviewPanel } from './previewPanel';
import { GmshRunner } from './gmshRunner';
import { GmshLocator } from './gmshLocator';

export function activate(context: vscode.ExtensionContext) {
  const runner = new GmshRunner();

  // Check and auto-detect Gmsh on startup
  const config = vscode.workspace.getConfiguration('gmsh');
  const configuredPath = config.get<string>('executablePath', 'gmsh');

  runner.checkGmsh(configuredPath).then((status) => {
    if (status.found) {
      console.log(`[Gmsh Preview] Detected Gmsh: ${status.path} (version: ${status.version || 'unknown'}, source: ${status.source})`);

      // If it was discovered via auto-search and user hasn't explicitly configured a custom path, prompt user to save
      if (status.source === 'auto-search' && configuredPath === 'gmsh') {
        vscode.window.showInformationMessage(
          `Gmsh を自動検出しました: ${status.path} (${status.version || 'OK'})`,
          '設定に保存する'
        ).then((action) => {
          if (action === '設定に保存する') {
            config.update('executablePath', status.path, vscode.ConfigurationTarget.Global);
          }
        });
      }
    } else {
      console.log(`[Gmsh Preview] Gmsh executable not found. Fallback geometry preview will be used.`);
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

  // 1. Open Preview Command
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

  // 2. Re-mesh Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gmshPreview.remesh', () => {
      if (GmshPreviewPanel.currentPanel) {
        GmshPreviewPanel.currentPanel.updatePreviewImmediate();
      }
    })
  );

  // 3. Auto-Detect Gmsh Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gmshPreview.autoDetect', async () => {
      GmshLocator.clearCache();
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Searching for Gmsh executable across system directories...'
        },
        async () => {
          return await GmshLocator.findGmsh();
        }
      );

      if (result.found) {
        const choice = await vscode.window.showInformationMessage(
          `Gmsh が見つかりました: ${result.path} (Version: ${result.version || 'unknown'})`,
          '設定に保存する',
          'プレビューを更新'
        );
        if (choice === '設定に保存する') {
          await vscode.workspace.getConfiguration('gmsh').update('executablePath', result.path, vscode.ConfigurationTarget.Global);
        }
        if (choice === 'プレビューを更新' || choice === '設定に保存する') {
          if (GmshPreviewPanel.currentPanel) {
            GmshPreviewPanel.currentPanel.updatePreviewImmediate();
          }
        }
      } else {
        const choice = await vscode.window.showWarningMessage(
          'Gmsh 実行ファイルが見つかりませんでした。手動でファイルを選択しますか？',
          'ファイルを選択...',
          'Gmsh ダウンロードページ'
        );
        if (choice === 'ファイルを選択...') {
          vscode.commands.executeCommand('gmshPreview.browseExecutable');
        } else if (choice === 'Gmsh ダウンロードページ') {
          vscode.env.openExternal(vscode.Uri.parse('https://gmsh.info/#Download'));
        }
      }
    })
  );

  // 4. Browse for Gmsh Executable Command
  context.subscriptions.push(
    vscode.commands.registerCommand('gmshPreview.browseExecutable', async () => {
      const isWin = process.platform === 'win32';
      const fileUris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Select Gmsh Executable',
        filters: isWin ? { 'Executable': ['exe'] } : undefined
      });

      if (fileUris && fileUris.length > 0) {
        const selectedPath = fileUris[0].fsPath;
        const verified = await GmshLocator.verifyGmshExecutable(selectedPath);

        if (verified.found) {
          await vscode.workspace.getConfiguration('gmsh').update('executablePath', selectedPath, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(`Gmsh パスを設定しました: ${selectedPath} (Version: ${verified.version || 'OK'})`);
          if (GmshPreviewPanel.currentPanel) {
            GmshPreviewPanel.currentPanel.updatePreviewImmediate();
          }
        } else {
          vscode.window.showErrorMessage(`選択されたファイルは有効な Gmsh 実行ファイルとして認識されませんでした: ${selectedPath}`);
        }
      }
    })
  );
}

export function deactivate() {
  if (GmshPreviewPanel.currentPanel) {
    GmshPreviewPanel.currentPanel.dispose();
  }
}
