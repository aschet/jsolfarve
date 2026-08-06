// SPDX-FileCopyrightText: 2026 Thomas Ascher <thomas.ascher@gmx.at>
//
// SPDX-License-Identifier: MIT

/**
 * Command line interface for `olfarve`.
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util';

import { DEFAULT_PATH_LENGTH_CM, ebcToSrgb, srmToSrgb } from './color.js';
import { VERSION } from './version.js';

/** Exit status for a usage error, matching the convention of `argparse`. */
const EXIT_USAGE = 2;

const SCALES = ['srm', 'ebc'] as const;

type Scale = (typeof SCALES)[number];

const USAGE = `usage: olfarve [-h] [-s {srm,ebc}] [-p CM] [-V] VALUE [VALUE ...]`;

const HELP = `${USAGE}

Render SRM/EBC beer color values as sRGB colors.

positional arguments:
  VALUE                 one or more color values to convert

options:
  -h, --help            show this help message and exit
  -s, --scale {srm,ebc} color scale of the values (default: srm)
  -p, --path-length CM  optical path length in cm (default: ${DEFAULT_PATH_LENGTH_CM.toFixed(1)})
  -V, --version         show program's version number and exit
`;

/**
 * Sinks the CLI writes to.
 *
 * Injecting these keeps {@link main} free of side effects on the process, which
 * is what makes it directly testable.
 */
export interface CliIo {
  /** Write one line to standard output. */
  out(line: string): void;
  /** Write one line to standard error. */
  err(line: string): void;
}

/** Writes to the real process streams. @internal */
export const processIo: CliIo = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

/** Raised for anything that should end in a usage error. */
class UsageError extends Error {}

/**
 * Describe a thrown value, whatever it turns out to be.
 *
 * `parseArgs` throws `TypeError`, so the fallback only guards against a
 * non-`Error` escaping from somewhere unexpected.
 *
 * @internal
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Parse one argument as a non-negative number, the way `argparse` would. */
function parseNonNegative(label: string, text: string): number {
  const value = Number(text);
  if (text.trim() === '' || !Number.isFinite(value)) {
    throw new UsageError(`argument ${label}: '${text}' is not a number`);
  }
  if (value < 0.0) {
    throw new UsageError(`argument ${label}: '${text}' must not be negative`);
  }
  return value;
}

function parseScale(text: string): Scale {
  const scale = SCALES.find((candidate) => candidate === text);
  if (scale === undefined) {
    throw new UsageError(
      `argument -s/--scale: invalid choice: '${text}' (choose from ${SCALES.map((s) => `'${s}'`).join(', ')})`,
    );
  }
  return scale;
}

/**
 * Format a color value compactly, dropping insignificant trailing zeros.
 *
 * Six significant digits, so `1` stays `1` and `3.50` becomes `3.5`.
 */
function formatValue(value: number): string {
  return String(Number(value.toPrecision(6)));
}

/**
 * Run the command line interface.
 *
 * @param argv - Arguments to parse, excluding the executable and script.
 * @param io - Where to write output; defaults to the process streams.
 * @returns The process exit status.
 */
export function main(
  argv: string[] = process.argv.slice(2),
  io: CliIo = processIo,
): number {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      options: {
        help: { type: 'boolean', short: 'h' },
        scale: { type: 'string', short: 's' },
        'path-length': { type: 'string', short: 'p' },
        version: { type: 'boolean', short: 'V' },
      },
      allowPositionals: true,
      strict: true,
    });

    if (values.help === true) {
      io.out(HELP.trimEnd());
      return 0;
    }
    if (values.version === true) {
      io.out(`olfarve ${VERSION}`);
      return 0;
    }
    if (positionals.length === 0) {
      throw new UsageError('the following arguments are required: VALUE');
    }

    const scale = parseScale(values.scale ?? 'srm');
    const pathLengthCm =
      values['path-length'] === undefined
        ? DEFAULT_PATH_LENGTH_CM
        : parseNonNegative('-p/--path-length', values['path-length']);
    const colorValues = positionals.map((text) => parseNonNegative('VALUE', text));

    const convert = scale === 'ebc' ? ebcToSrgb : srmToSrgb;
    for (const colorValue of colorValues) {
      io.out(`${formatValue(colorValue)},${convert(colorValue, pathLengthCm).toHex()}`);
    }
    return 0;
  } catch (error) {
    io.err(USAGE);
    io.err(`olfarve: error: ${errorMessage(error)}`);
    return EXIT_USAGE;
  }
}
