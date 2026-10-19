import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const isWatch = process.argv.includes('--watch');

async function build() {
  const distDir = path.resolve('dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy CSS to dist
  fs.copyFileSync(
    path.resolve('src/webview/styles.css'),
    path.resolve('dist/styles.css')
  );

  const syncToInstalled = () => {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const targetDirs = [
      path.join(home, '.antigravity-ide', 'extensions', 'local.gmsh-preview-0.2.0', 'dist'),
      path.join(home, '.vscode', 'extensions', 'local.gmsh-preview-0.2.0', 'dist')
    ];

    for (const installedExtDist of targetDirs) {
      if (fs.existsSync(installedExtDist)) {
        try {
          if (fs.existsSync('dist/extension.js')) fs.copyFileSync('dist/extension.js', path.join(installedExtDist, 'extension.js'));
          if (fs.existsSync('dist/preview.bundle.js')) fs.copyFileSync('dist/preview.bundle.js', path.join(installedExtDist, 'preview.bundle.js'));
          if (fs.existsSync('dist/styles.css')) fs.copyFileSync('dist/styles.css', path.join(installedExtDist, 'styles.css'));
          console.log(`Synced to installed extension: ${installedExtDist}`);
        } catch (e) {
          console.warn('Failed to sync to installed extension:', e);
        }
      }
    }
  };

  const syncPlugin = {
    name: 'sync-extension',
    setup(build) {
      build.onEnd(() => {
        syncToInstalled();
      });
    }
  };

  // 1. Build Extension Host (Node)
  const extensionCtx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: true,
    minify: !isWatch,
    plugins: [syncPlugin]
  });

  // 2. Build Webview UI (Browser with Three.js)
  const webviewCtx = await esbuild.context({
    entryPoints: ['src/webview/main.ts'],
    bundle: true,
    outfile: 'dist/preview.bundle.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    minify: !isWatch,
    plugins: [syncPlugin]
  });

  if (isWatch) {
    console.log('Watching for changes...');
    await extensionCtx.watch();
    await webviewCtx.watch();
  } else {
    await extensionCtx.rebuild();
    await webviewCtx.rebuild();
    await extensionCtx.dispose();
    await webviewCtx.dispose();
    syncToInstalled();
    console.log('Build completed successfully!');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
