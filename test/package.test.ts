// SPDX-FileCopyrightText: 2026 Thomas Ascher <thomas.ascher@gmx.at>
//
// SPDX-License-Identifier: MIT

/** Tests for the package metadata and the public surface. */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as olfarve from '../src/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface PackageManifest {
  version: string;
  bin: { olfarve: string };
}

const manifest = JSON.parse(
  readFileSync(resolve(ROOT, 'package.json'), 'utf8'),
) as PackageManifest;

describe('package metadata', () => {
  it('keeps VERSION in step with package.json', () => {
    expect(olfarve.VERSION).toBe(manifest.version);
  });
});

describe('public surface', () => {
  it('exports exactly the documented API', () => {
    expect(Object.keys(olfarve).sort()).toEqual([
      'DEFAULT_PATH_LENGTH_CM',
      'SrgbColor',
      'VERSION',
      'absorptionToSrgb',
      'ebcToSrgb',
      'srmToSrgb',
    ]);
  });

  it('exports callable conversions', () => {
    expect(typeof olfarve.srmToSrgb).toBe('function');
    expect(typeof olfarve.ebcToSrgb).toBe('function');
    expect(typeof olfarve.absorptionToSrgb).toBe('function');
    expect(olfarve.srmToSrgb(10)).toBeInstanceOf(olfarve.SrgbColor);
  });
});

// The built executable only exists after `npm run build`; CI always builds
// first, so this runs there even when a bare `vitest` locally skips it.
const binPath = resolve(ROOT, manifest.bin.olfarve);

describe.skipIf(!existsSync(binPath))('built executable', () => {
  function runBin(...argv: string[]): string[] {
    return execFileSync(process.execPath, [binPath, ...argv], { encoding: 'utf8' })
      .split('\n')
      .filter((line) => line !== '');
  }

  it('converts a value end to end', () => {
    expect(runBin('1')).toEqual(['1,#fae8b6']);
  });

  it('reports its version', () => {
    expect(runBin('--version')).toEqual([`olfarve ${olfarve.VERSION}`]);
  });

  it('exits with status 2 on a usage error', () => {
    let status: number | undefined;
    try {
      execFileSync(process.execPath, [binPath], { stdio: 'pipe' });
    } catch (error) {
      status = (error as { status?: number }).status;
    }
    expect(status).toBe(2);
  });
});

describe.skipIf(!existsSync(resolve(ROOT, 'dist/index.cjs')))('built library', () => {
  it('is importable from CommonJS', () => {
    const entry = JSON.stringify(resolve(ROOT, 'dist/index.cjs'));
    const script = `console.log(require(${entry}).srmToSrgb(10).toHex());`;
    const output = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    expect(output.trim()).toBe('#ba5b00');
  });

  it('is importable from ESM', async () => {
    const built = (await import(resolve(ROOT, 'dist/index.mjs'))) as typeof olfarve;
    expect(built.srmToSrgb(10).toHex()).toBe('#ba5b00');
  });

  it.each(['dist/index.d.mts', 'dist/index.d.cts'])('ships %s', (declaration) => {
    expect(existsSync(resolve(ROOT, declaration))).toBe(true);
  });
});
