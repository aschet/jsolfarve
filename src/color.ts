// SPDX-FileCopyrightText: 2026 Thomas Ascher <thomas.ascher@gmx.at>
//
// SPDX-License-Identifier: MIT

/**
 * sRGB rendering of SRM and EBC beer color values.
 *
 * The spectral model is A. J. de Lange, "Color," in *Brewing Materials and
 * Processes*, Elsevier, 2016, pp. 199-249: beer's transmittance across the
 * visible range is approximated from its absorption at 430 nm. Integrating that
 * against the CIE 1931 color matching functions under illuminant D65 gives XYZ
 * tristimulus values, which are then transformed to sRGB.
 *
 * The sRGB primaries, white point and gamma encoding follow
 * https://www.w3.org/Graphics/Color/srgb. The colorimetric data is documented in
 * the internal `cie` module.
 *
 * @packageDocumentation
 */

import {
  CIE_SAMPLES,
  FIRST_WAVELENGTH_NM,
  WAVELENGTH_STEP_NM,
  type CieSample,
} from './cie.js';

/**
 * Default optical path length in cm, set to the typical sample glass width
 * specified by the BJCP color guide.
 *
 * @see https://www.bjcp.org/education-training/education-resources/color-guide
 */
export const DEFAULT_PATH_LENGTH_CM = 5.0;

// Both scales are defined as a multiple of the absorbance at 430 nm measured
// over a 1 cm path: SRM = 12.7 * A430 and EBC = 25.0 * A430.
const SRM_PER_ABSORBANCE = 12.7;
const EBC_PER_ABSORBANCE = 25.0;

// The de Lange approximation sums two exponentials decaying away from 430 nm,
// giving absorption at any wavelength relative to the absorption there.
const REFERENCE_WAVELENGTH_NM = 430.0;
const SHORT_DECAY_WEIGHT = 0.02465;
const SHORT_DECAY_NM = 17.591;
const LONG_DECAY_WEIGHT = 0.97535;
const LONG_DECAY_NM = 82.122;

// Piecewise sRGB gamma encoding: linear below the threshold, a power law above
// it.
const GAMMA_THRESHOLD = 0.0031308;
const GAMMA_SLOPE = 12.92;
const GAMMA_SCALE = 1.055;
const GAMMA_OFFSET = 0.055;
const GAMMA_EXPONENT = 1.0 / 2.4;

/**
 * Return the normalizing constant for illuminant D65.
 *
 * CIE defines `k = 100 / sum(S(lambda) * yBar(lambda))`, putting the luminance
 * of a perfectly transmitting sample at 100. Dropping the factor of 100 puts it
 * at 1.0 instead, which is the range sRGB expects.
 *
 * @internal
 */
function calculateK(): number {
  let luminance = 0.0;
  for (const sample of CIE_SAMPLES) {
    luminance += sample.sD65 * sample.yBar;
  }
  return 1.0 / luminance;
}

/**
 * Return absorption at `wavelengthNm` relative to that at 430 nm.
 *
 * @internal
 */
export function absorptionRatio(wavelengthNm: number): number {
  const offsetNm = wavelengthNm - REFERENCE_WAVELENGTH_NM;
  return (
    SHORT_DECAY_WEIGHT * Math.exp(-offsetNm / SHORT_DECAY_NM) +
    LONG_DECAY_WEIGHT * Math.exp(-offsetNm / LONG_DECAY_NM)
  );
}

/**
 * One precomputed wavelength term of the integration: a colorimetric sample
 * plus the absorption ratio at its wavelength.
 *
 * @internal
 */
interface SpectrumEntry extends CieSample {
  readonly absorptionRatio: number;
}

/**
 * Precompute the wavelength dependent terms of the integration.
 *
 * Only the absorbance varies between conversions. The absorption ratios and the
 * colorimetric weights depend solely on wavelength, so they are evaluated once
 * at module load rather than on every call.
 *
 * @internal
 */
function buildSpectrum(): readonly SpectrumEntry[] {
  const spectrum: SpectrumEntry[] = [];
  let wavelengthNm = FIRST_WAVELENGTH_NM;
  for (const sample of CIE_SAMPLES) {
    spectrum.push({ ...sample, absorptionRatio: absorptionRatio(wavelengthNm) });
    wavelengthNm += WAVELENGTH_STEP_NM;
  }
  return spectrum;
}

/** @internal */
export const SPECTRUM = buildSpectrum();

const K = calculateK();

/** Quantize one gamma encoded component to an integer in `[0, 255]`. */
function to8Bit(component: number): number {
  if (Number.isNaN(component)) {
    return 0;
  }
  // Math.round is half-up. A half to even rule would disagree only on exact
  // .5 boundaries, which the model never produces.
  return Math.min(255, Math.max(0, Math.round(component * 255.0)));
}

/**
 * Gamma encode one linear component, clamping it to `[0, 1]` first.
 *
 * This is the inverse of the sRGB EOTF: it maps a linear tristimulus component
 * to the non-linear signal a display decodes.
 *
 * @internal
 */
export function encodeGamma(linear: number): number {
  const clamped = Math.max(0.0, Math.min(1.0, linear));
  if (clamped <= GAMMA_THRESHOLD) {
    return clamped * GAMMA_SLOPE;
  }
  return GAMMA_SCALE * Math.pow(clamped, GAMMA_EXPONENT) - GAMMA_OFFSET;
}

/** A color quantized to 8 bits per channel, as a `[r, g, b]` triplet. */
export type Rgb8 = readonly [r: number, g: number, b: number];

/**
 * An sRGB color, gamma encoded, with components in `[0, 1]`.
 *
 * Instances are immutable and iterable, so they destructure like a plain
 * triplet:
 *
 * ```ts
 * const [red, green, blue] = srmToSrgb(10);
 * ```
 */
export class SrgbColor {
  /** The red component, gamma encoded, in `[0, 1]`. */
  readonly r: number;

  /** The green component, gamma encoded, in `[0, 1]`. */
  readonly g: number;

  /** The blue component, gamma encoded, in `[0, 1]`. */
  readonly b: number;

  constructor(r: number, g: number, b: number) {
    this.r = r;
    this.g = g;
    this.b = b;
    Object.freeze(this);
  }

  /**
   * Return the color quantized to 8 bits per channel.
   *
   * Components are clamped into gamut first, so the result is a valid 8 bit
   * triplet even for an instance built by hand out of range.
   *
   * ```ts
   * new SrgbColor(1.0, 0.5, 0.0).toRgb8(); // [255, 128, 0]
   * new SrgbColor(2.0, -1.0, 0.0).toRgb8(); // [255, 0, 0]
   * ```
   */
  toRgb8(): Rgb8 {
    return [to8Bit(this.r), to8Bit(this.g), to8Bit(this.b)];
  }

  /**
   * Return the color as a `#rrggbb` string.
   *
   * ```ts
   * new SrgbColor(1.0, 0.5, 0.0).toHex(); // '#ff8000'
   * new SrgbColor(2.0, -1.0, 0.0).toHex(); // '#ff0000'
   * ```
   */
  toHex(): string {
    return `#${this.toRgb8()
      .map((component) => component.toString(16).padStart(2, '0'))
      .join('')}`;
  }

  /** Return the `#rrggbb` string, so the color interpolates into templates. */
  toString(): string {
    return this.toHex();
  }

  /** Serialize as a `[r, g, b]` array, matching the iteration order. */
  toJSON(): readonly [number, number, number] {
    return [this.r, this.g, this.b];
  }

  /** Iterate the components in red, green, blue order. */
  *[Symbol.iterator](): IterableIterator<number> {
    yield this.r;
    yield this.g;
    yield this.b;
  }
}

function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0.0) {
    throw new RangeError(`${name} must be a non-negative finite number, got ${value}`);
  }
}

/**
 * Convert a beer's absorption at 430 nm into an sRGB color.
 *
 * Prefer {@link srmToSrgb} or {@link ebcToSrgb} when you have a color value,
 * which is what brewing software reports. This function is for a photometer
 * reading taken directly, where the absorbance is the measurement and the SRM or
 * EBC value is derived from it.
 *
 * @param absorption430 - Linear decadic absorption coefficient at 430 nm, in
 *   cm^-1. Numerically this is the ASBC/EBC absorbance A430, which is defined
 *   for a 1 cm path length.
 * @param pathLengthCm - Optical path length in cm, e.g. the glass width.
 * @returns The gamma encoded color, with components in `[0, 1]`.
 * @throws RangeError If either argument is negative or not finite.
 *
 * ```ts
 * absorptionToSrgb(10.0 / 12.7).toHex(); // '#ba5b00'
 * ```
 */
export function absorptionToSrgb(
  absorption430: number,
  pathLengthCm: number = DEFAULT_PATH_LENGTH_CM,
): SrgbColor {
  assertNonNegative('absorption430', absorption430);
  assertNonNegative('pathLengthCm', pathLengthCm);

  // Beer-Lambert law: absorbance A = a * l, and transmittance T = 10 ** -A.
  const absorbance430 = absorption430 * pathLengthCm;

  let tristimulusX = 0.0;
  let tristimulusY = 0.0;
  let tristimulusZ = 0.0;
  for (const entry of SPECTRUM) {
    // Deliberately Math.pow with base 10, matching the 10 ** -A of the
    // Beer-Lambert law as written. Math.exp(x * Math.LN10) computes the same
    // quantity and makes this loop roughly twice as fast, but shifts every
    // component by a few ULP. Likewise, do not fold K or sD65 into the
    // precomputed weights: floating point multiplication does not reassociate
    // exactly. A conversion costs about a microsecond either way, so the speed
    // is not worth changing the numbers this function returns.
    const transmittedPower =
      entry.sD65 * Math.pow(10.0, -absorbance430 * entry.absorptionRatio);
    tristimulusX += transmittedPower * entry.xBar;
    tristimulusY += transmittedPower * entry.yBar;
    tristimulusZ += transmittedPower * entry.zBar;
  }

  tristimulusX *= K;
  tristimulusY *= K;
  tristimulusZ *= K;

  // XYZ to linear sRGB, D65 white point.
  return new SrgbColor(
    encodeGamma(
      tristimulusX * 3.2406255 + tristimulusY * -1.537208 + tristimulusZ * -0.4986286,
    ),
    encodeGamma(
      tristimulusX * -0.9689307 + tristimulusY * 1.8757561 + tristimulusZ * 0.0415175,
    ),
    encodeGamma(
      tristimulusX * 0.0557101 + tristimulusY * -0.2040211 + tristimulusZ * 1.0569959,
    ),
  );
}

/**
 * Convert a Standard Reference Method color value into an sRGB color.
 *
 * @param srm - The SRM color value.
 * @param pathLengthCm - Optical path length in cm, e.g. the glass width.
 * @returns The gamma encoded color, with components in `[0, 1]`.
 * @throws RangeError If either argument is negative or not finite.
 *
 * ```ts
 * srmToSrgb(10).toHex(); // '#ba5b00'
 * ```
 */
export function srmToSrgb(
  srm: number,
  pathLengthCm: number = DEFAULT_PATH_LENGTH_CM,
): SrgbColor {
  assertNonNegative('srm', srm);
  return absorptionToSrgb(srm / SRM_PER_ABSORBANCE, pathLengthCm);
}

/**
 * Convert a European Brewery Convention color value into an sRGB color.
 *
 * @param ebc - The EBC color value.
 * @param pathLengthCm - Optical path length in cm, e.g. the glass width.
 * @returns The gamma encoded color, with components in `[0, 1]`.
 * @throws RangeError If either argument is negative or not finite.
 *
 * ```ts
 * ebcToSrgb(20).toHex(); // '#b95900'
 * ```
 */
export function ebcToSrgb(
  ebc: number,
  pathLengthCm: number = DEFAULT_PATH_LENGTH_CM,
): SrgbColor {
  assertNonNegative('ebc', ebc);
  return absorptionToSrgb(ebc / EBC_PER_ABSORBANCE, pathLengthCm);
}
