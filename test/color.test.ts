// SPDX-FileCopyrightText: 2026 Thomas Ascher <thomas.ascher@gmx.at>
//
// SPDX-License-Identifier: MIT

/** Tests for the color conversion functions. */

import { describe, expect, it } from 'vitest';

import { CIE_SAMPLES, FIRST_WAVELENGTH_NM, WAVELENGTH_STEP_NM } from '../src/cie.js';
import {
  DEFAULT_PATH_LENGTH_CM,
  SPECTRUM,
  SrgbColor,
  absorptionRatio,
  absorptionToSrgb,
  ebcToSrgb,
  encodeGamma,
  srmToSrgb,
} from '../src/color.js';

const SRM_REFERENCE: readonly (readonly [number, string])[] = [
  [1, '#fae8b6'],
  [2, '#f4d180'],
  [4, '#e7aa31'],
  [10, '#ba5b00'],
  [20, '#7d1900'],
  [30, '#540000'],
  [40, '#390000'],
  [50, '#270000'],
];

function luminanceSum(color: SrgbColor): number {
  return [...color].reduce((total, component) => total + component, 0);
}

describe('spectral data', () => {
  it('keeps the precomputed table in step with the model', () => {
    // The conversion reads SPECTRUM instead of recomputing the wavelength
    // dependent terms, so a drift here would silently change every result.
    expect(SPECTRUM).toHaveLength(CIE_SAMPLES.length);
    let wavelengthNm = FIRST_WAVELENGTH_NM;
    for (const [index, entry] of SPECTRUM.entries()) {
      const sample = CIE_SAMPLES[index];
      expect(entry.absorptionRatio).toBe(absorptionRatio(wavelengthNm));
      expect({
        sD65: entry.sD65,
        xBar: entry.xBar,
        yBar: entry.yBar,
        zBar: entry.zBar,
      }).toEqual(sample);
      wavelengthNm += WAVELENGTH_STEP_NM;
    }
  });

  it('tabulates 81 samples of four non-negative values', () => {
    expect(CIE_SAMPLES).toHaveLength(81);
    for (const sample of CIE_SAMPLES) {
      expect(Object.values(sample)).toHaveLength(4);
      expect(Object.values(sample).every((value) => value >= 0.0)).toBe(true);
    }
  });
});

describe('absorptionToSrgb', () => {
  it('renders an unabsorbing sample as white', () => {
    // The D65 normalization is exact only up to the tabulated 5 nm sampling.
    for (const component of absorptionToSrgb(0.0)) {
      expect(Math.abs(component - 1.0)).toBeLessThan(1e-4);
    }
    expect(absorptionToSrgb(0.0).toHex()).toBe('#ffffff');
  });

  it('agrees with the equivalent SRM value', () => {
    expect(absorptionToSrgb(10.0 / 12.7).toHex()).toBe('#ba5b00');
  });
});

describe('srmToSrgb', () => {
  it.each(SRM_REFERENCE)('renders SRM %d as %s', (srm, expected) => {
    expect(srmToSrgb(srm).toHex()).toBe(expected);
  });

  it('keeps every component within the unit range', () => {
    for (let srm = 0; srm <= 60; srm += 1) {
      for (const component of srmToSrgb(srm)) {
        expect(component).toBeGreaterThanOrEqual(0.0);
        expect(component).toBeLessThanOrEqual(1.0);
      }
    }
  });

  it('darkens monotonically as the color value grows', () => {
    let previous = Infinity;
    for (let srm = 0; srm <= 40; srm += 1) {
      const luminance = luminanceSum(srmToSrgb(srm));
      expect(luminance).toBeLessThan(previous);
      previous = luminance;
    }
  });
});

describe('ebcToSrgb', () => {
  it.each([1, 5, 10, 25, 40])(
    'matches the SRM %d equivalent up to the 25.0 / 12.7 factor',
    (srm) => {
      const ebc = (srm * 25.0) / 12.7;
      const actual = ebcToSrgb(ebc);
      const expected = srmToSrgb(srm);
      expect(actual.r).toBeCloseTo(expected.r, 12);
      expect(actual.g).toBeCloseTo(expected.g, 12);
      expect(actual.b).toBeCloseTo(expected.b, 12);
    },
  );

  it('renders EBC 20 at the documented color', () => {
    expect(ebcToSrgb(20).toHex()).toBe('#b95900');
    expect(ebcToSrgb(20, 1.0).toHex()).toBe('#f4d17e');
  });
});

describe('path length', () => {
  it('darkens the color as it grows', () => {
    const short = luminanceSum(srmToSrgb(10, 1.0));
    const long = luminanceSum(srmToSrgb(10, 10.0));
    expect(long).toBeLessThan(short);
  });

  it('renders a zero path length as white', () => {
    expect(srmToSrgb(20, 0.0).toHex()).toBe('#ffffff');
  });

  it('defaults to the BJCP sample glass width', () => {
    expect(DEFAULT_PATH_LENGTH_CM).toBe(5.0);
    expect(srmToSrgb(10).toJSON()).toEqual(
      srmToSrgb(10, DEFAULT_PATH_LENGTH_CM).toJSON(),
    );
  });
});

describe('input validation', () => {
  const invalid: readonly (readonly [string, () => unknown])[] = [
    ['negative absorption', () => absorptionToSrgb(-0.1)],
    ['negative path length with absorption', () => absorptionToSrgb(1.0, -1.0)],
    ['negative SRM', () => srmToSrgb(-1)],
    ['negative path length with SRM', () => srmToSrgb(1, -1.0)],
    ['negative EBC', () => ebcToSrgb(-1)],
    ['negative path length with EBC', () => ebcToSrgb(1, -1.0)],
    ['NaN SRM', () => srmToSrgb(NaN)],
    ['infinite EBC', () => ebcToSrgb(Infinity)],
    ['NaN path length', () => srmToSrgb(1, NaN)],
    ['infinite path length', () => absorptionToSrgb(1, Infinity)],
  ];

  it.each(invalid)('rejects %s', (_label, call) => {
    expect(call).toThrow(RangeError);
  });
});

describe('SrgbColor', () => {
  it('is iterable in red, green, blue order', () => {
    const color = srmToSrgb(10);
    expect([...color]).toEqual([color.r, color.g, color.b]);
    const [r, g, b] = color;
    expect([r, g, b]).toEqual([color.r, color.g, color.b]);
  });

  it('is immutable', () => {
    const color = srmToSrgb(10);
    expect(Object.isFrozen(color)).toBe(true);
    expect(() => {
      (color as { r: number }).r = 0;
    }).toThrow(TypeError);
  });

  it('serializes to a triplet through JSON', () => {
    const color = new SrgbColor(0.25, 0.5, 0.75);
    expect(JSON.stringify(color)).toBe('[0.25,0.5,0.75]');
  });

  it('stringifies to its hex form', () => {
    // Interpolating the color directly is the behaviour under test, so the
    // rule that normally demands an explicit conversion does not apply.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    expect(`${new SrgbColor(1.0, 0.5, 0.0)}`).toBe('#ff8000');
    expect(String(new SrgbColor(1.0, 0.5, 0.0))).toBe('#ff8000');
  });

  describe('toRgb8', () => {
    it('quantizes to 8 bits per channel', () => {
      expect(new SrgbColor(1.0, 0.5, 0.0).toRgb8()).toEqual([255, 128, 0]);
    });

    it('clamps out of gamut components', () => {
      expect(new SrgbColor(2.0, -1.0, 0.0).toRgb8()).toEqual([255, 0, 0]);
    });

    it('maps a NaN component to zero rather than NaN', () => {
      expect(new SrgbColor(NaN, 0.0, 1.0).toRgb8()).toEqual([0, 0, 255]);
    });
  });

  describe('toHex', () => {
    it('renders the endpoints', () => {
      expect(new SrgbColor(1.0, 1.0, 1.0).toHex()).toBe('#ffffff');
      expect(new SrgbColor(0.0, 0.0, 0.0).toHex()).toBe('#000000');
      expect(new SrgbColor(1.0, 0.0, 0.0).toHex()).toBe('#ff0000');
      expect(new SrgbColor(1.0, 0.5, 0.0).toHex()).toBe('#ff8000');
    });

    it('is lowercase and zero padded', () => {
      const text = new SrgbColor(0.04, 0.04, 0.04).toHex();
      expect(text).toBe(text.toLowerCase());
      expect(text).toHaveLength(7);
    });

    it('never disagrees with toRgb8', () => {
      for (let srm = 0; srm <= 60; srm += 1) {
        const color = srmToSrgb(srm);
        const expected = `#${color
          .toRgb8()
          .map((c) => c.toString(16).padStart(2, '0'))
          .join('')}`;
        expect(color.toHex()).toBe(expected);
      }
    });

    it.each([
      [new SrgbColor(2.0, 0.0, 0.0), '#ff0000'],
      [new SrgbColor(-1.0, -1.0, -1.0), '#000000'],
      [new SrgbColor(1.5, 0.0, 0.0), '#ff0000'],
    ])('clamps a hand built out of range color to %s', (color, expected) => {
      expect(color.toHex()).toBe(expected);
      expect(color.toHex()).toHaveLength(7);
      expect(color.toRgb8().every((c) => c >= 0 && c <= 255)).toBe(true);
    });
  });
});

describe('encodeGamma', () => {
  it('clamps out of range input', () => {
    expect(encodeGamma(-1.0)).toBe(0.0);
    expect(encodeGamma(2.0)).toBeCloseTo(1.0, 12);
  });

  it('is continuous at the knee', () => {
    // The two branches meet, up to the rounding of the sRGB constants.
    const knee = 0.0031308;
    expect(encodeGamma(knee)).toBeCloseTo(encodeGamma(knee + 1e-12), 7);
  });

  it('maps the endpoints to themselves', () => {
    expect(encodeGamma(0.0)).toBe(0.0);
    expect(encodeGamma(1.0)).toBeCloseTo(1.0, 12);
  });
});
