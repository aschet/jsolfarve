// SPDX-FileCopyrightText: 2026 Thomas Ascher <thomas.ascher@gmx.at>
//
// SPDX-License-Identifier: MIT

/**
 * Øl farve: sRGB color rendering of SRM/EBC beer color values.
 *
 * Basic usage:
 *
 * ```ts
 * import { srmToSrgb, ebcToSrgb } from 'olfarve';
 *
 * srmToSrgb(10).toHex(); // '#ba5b00'
 * ebcToSrgb(20, 1.0).toHex(); // '#f4d17e'
 * ```
 *
 * @packageDocumentation
 */

export {
  DEFAULT_PATH_LENGTH_CM,
  SrgbColor,
  absorptionToSrgb,
  ebcToSrgb,
  srmToSrgb,
  type Rgb8,
} from './color.js';
export { VERSION } from './version.js';
