// SPDX-FileCopyrightText: 2026 Thomas Ascher <thomas.ascher@gmx.at>
//
// SPDX-License-Identifier: MIT

/** Tests for the command line interface. */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { type CliIo, errorMessage, main, processIo } from '../src/cli.js';
import { ebcToSrgb, srmToSrgb } from '../src/color.js';
import { VERSION } from '../src/version.js';

interface Result {
  code: number;
  out: string[];
  err: string[];
}

/** Run the CLI with captured output instead of the process streams. */
function run(...argv: string[]): Result {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = { out: (line) => out.push(line), err: (line) => err.push(line) };
  return { code: main(argv, io), out, err };
}

describe('successful conversions', () => {
  it('converts explicit color values', () => {
    const result = run('4', '10');
    expect(result.code).toBe(0);
    expect(result.out).toEqual(['4,#e7aa31', '10,#ba5b00']);
  });

  it('honours the EBC scale', () => {
    expect(run('--scale', 'ebc', '20').out).toEqual([`20,${ebcToSrgb(20).toHex()}`]);
  });

  it('honours the path length option', () => {
    expect(run('--path-length', '1.0', '10').out).toEqual([
      `10,${srmToSrgb(10, 1.0).toHex()}`,
    ]);
  });

  it('formats fractional values compactly', () => {
    expect(run('3.50').out[0]).toMatch(/^3\.5,#[0-9a-f]{6}$/);
  });

  it('treats short and long options identically', () => {
    expect(run('-s', 'ebc', '-p', '1', '20')).toEqual(
      run('--scale', 'ebc', '--path-length', '1', '20'),
    );
  });
});

describe('informational options', () => {
  it('prints the version', () => {
    const result = run('--version');
    expect(result.code).toBe(0);
    expect(result.out.join('\n')).toContain(VERSION);
  });

  it('accepts the short version flag', () => {
    expect(run('-V')).toEqual(run('--version'));
  });

  it('prints help listing every option', () => {
    const result = run('--help');
    expect(result.code).toBe(0);
    const help = result.out.join('\n');
    for (const fragment of [
      'usage:',
      '--scale',
      '--path-length',
      '--version',
      'VALUE',
    ]) {
      expect(help).toContain(fragment);
    }
  });

  it('accepts the short help flag', () => {
    expect(run('-h')).toEqual(run('--help'));
  });

  it('prefers help over conversion', () => {
    expect(run('--help', '10').out).toEqual(run('--help').out);
  });
});

describe('usage errors', () => {
  it.each([
    ['no values at all', []],
    ['a negative value', ['-1']],
    ['a negative value after the separator', ['--', '-1']],
    ['a negative path length', ['--path-length', '-1', '10']],
    ['a negative path length in the inline form', ['--path-length=-1', '10']],
    ['a non-numeric value', ['abc']],
    ['an empty value', ['']],
    ['a non-numeric path length', ['--path-length', 'abc', '10']],
    ['an unknown scale', ['--scale', 'lovibond', '10']],
    ['an unknown option', ['--nope', '10']],
    ['a missing option argument', ['--scale']],
  ])('exits with status 2 on %s', (_label, argv) => {
    const result = run(...argv);
    expect(result.code).toBe(2);
    expect(result.err.join('\n')).toContain('usage:');
    expect(result.out).toEqual([]);
  });

  it('says a negative number must not be negative', () => {
    expect(run('--', '-1').err.join('\n')).toContain('must not be negative');
    expect(run('--path-length=-1', '10').err.join('\n')).toContain(
      'must not be negative',
    );
  });

  it('says which argument is required', () => {
    expect(run().err.join('\n')).toContain('required');
  });

  it('lists the valid scales', () => {
    const message = run('--scale', 'lovibond', '10').err.join('\n');
    expect(message).toContain("'srm'");
    expect(message).toContain("'ebc'");
  });
});

describe('errorMessage', () => {
  it('unwraps an Error', () => {
    expect(errorMessage(new RangeError('too small'))).toBe('too small');
  });

  it('stringifies anything else', () => {
    expect(errorMessage('plain string')).toBe('plain string');
  });
});

describe('process defaults', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes successful output to stdout', () => {
    const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    expect(main(['10'])).toBe(0);
    expect(write).toHaveBeenCalledWith(`10,${srmToSrgb(10).toHex()}\n`);
  });

  it('writes errors to stderr', () => {
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(main(['--nope'])).toBe(2);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('usage:'));
  });

  it('falls back to the process arguments', () => {
    // Under the test runner argv holds no color values, so this must be a
    // usage error rather than a crash.
    const write = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(main()).toBe(2);
    expect(write).toHaveBeenCalled();
  });

  it('exposes the process streams as the default sinks', () => {
    expect(typeof processIo.out).toBe('function');
    expect(typeof processIo.err).toBe('function');
  });
});
