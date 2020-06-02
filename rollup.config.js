import fs from 'fs';
import path from 'path';

import babel from 'rollup-plugin-babel';
import { terser } from 'rollup-plugin-terser';
import resolve from 'rollup-plugin-node-resolve';
import builtins from 'rollup-plugin-node-builtins';
import { sizeSnapshot } from 'rollup-plugin-size-snapshot';

const { version, license, name } = require('./package.json');
const licenseData = fs.readFileSync(path.join(process.cwd(), 'LICENSE.md'), {
  encoding: 'utf-8',
});

const bannerPlugin = {
  banner: `/**
 * @license ${name} ${version}
 * ${licenseData.split('\n', 1)}
 * License: ${license}
 */`,
};

const exportFormat = format => ({
  input: 'src/webrtc-wowza-player.ts',
  output: {
    name,
    format,
    file: `dist/${format}/wowza-webrtc-player.js`,
  },
  plugins: [
    builtins(),
    resolve({
      extensions: ['.ts'],
    }),
    babel({
      extensions: ['ts'],
      exclude: 'node_modules/**',
    }),
    bannerPlugin,
    terser({
      toplevel: true,
      compress: {
        unsafe: true,
      },
      output: { comments: /@license/ },
    }),
    sizeSnapshot(),
  ].filter(v => v),
});

export default ['umd', 'cjs', 'esm'].map(exportFormat);
