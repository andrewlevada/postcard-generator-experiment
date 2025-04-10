import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { Plugin, OutputBundle, OutputChunk } from 'rollup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Custom plugin to handle UI script inlining
const inlineUiPlugin: Plugin = {
  name: 'inline-ui',
  generateBundle(options, bundle: OutputBundle) {
    const uiChunk = bundle['ui.js'] as OutputChunk;
    if (!uiChunk) return;

    // Create the HTML with inlined script
    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Postcard Generator</title>
  </head>
  <body>
    <div id="react-page"></div>
    <script type="module">${uiChunk.code}</script>
  </body>
</html>`;

    // Add HTML file to the bundle
    this.emitFile({
      type: 'asset',
      fileName: 'ui.html',
      source: html
    });

    // Remove the original ui.js from the bundle
    delete bundle['ui.js'];
  }
};

export default defineConfig({
  plugins: [react(), inlineUiPlugin],
  build: {
    outDir: 'out',
    rollupOptions: {
      input: {
        'ui': resolve(__dirname, 'src/ui/ui.tsx'),
        'code': resolve(__dirname, 'src/code.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    target: 'chrome58',
    sourcemap: true,
    minify: false,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
}); 