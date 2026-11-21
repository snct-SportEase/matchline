import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'es2020',
  onSuccess: async () => {
    // デフォルトスタイルシートを dist/style.css に出力する
    const distDir = resolve('dist');
    mkdirSync(distDir, { recursive: true });
    copyFileSync(resolve('src/style.css'), resolve(distDir, 'style.css'));
  },
});
