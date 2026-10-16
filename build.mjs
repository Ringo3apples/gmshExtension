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
    minify: !isWatch
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
    minify: !isWatch
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
    console.log('Build completed successfully!');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
