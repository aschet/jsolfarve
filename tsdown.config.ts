// SPDX-FileCopyrightText: 2026 Thomas Ascher <thomas.ascher@gmx.at>
//
// SPDX-License-Identifier: MIT

import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    // The library: dual ESM/CJS so both `import` and `require` resolve.
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: 'node22.12',
  },
  {
    // The executable: ESM only, since nothing imports it.
    entry: ['src/bin.ts'],
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    target: 'node22.12',
  },
]);
