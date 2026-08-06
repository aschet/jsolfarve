# olfarve

[![CI](https://github.com/aschet/olfarvejs/actions/workflows/ci.yml/badge.svg)](https://github.com/aschet/olfarvejs/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/olfarve.svg)](https://www.npmjs.com/package/olfarve)

_Øl farve_ ("beer color") renders SRM and EBC beer color values as sRGB colors,
following the spectral model described by A. J. de Lange, "Color," in _Brewing
Materials and Processes_, Elsevier, 2016, pp. 199-249.

Given a color value and an optical path length (the width of the glass the beer
is viewed through), the sample's spectral transmittance is derived from its
absorption coefficient at 430 nm via the Beer-Lambert law, integrated against
the CIE 1931 color matching functions of the 2 degree standard colorimetric
observer under illuminant D65, and the resulting XYZ tristimulus values are
transformed to sRGB.

## Installation

```bash
npm install olfarve
```

The package requires Node.js 20.19 or newer and has no runtime dependencies. It
ships both ESM and CommonJS builds along with TypeScript declarations.

## Usage

```js
import { srmToSrgb, ebcToSrgb, absorptionToSrgb, SrgbColor } from 'olfarve';

srmToSrgb(10).toHex(); // '#ba5b00'
ebcToSrgb(20).toHex(); // '#b95900'

// The default path length is 5 cm, the width of a typical sample glass
srmToSrgb(10, 1.0).toHex(); // '#f4d180'

// Results are SrgbColor instances of gamma encoded components in [0, 1]
const color = srmToSrgb(10);
color.r; // 0.7309...
color.toRgb8(); // [186, 91, 0]
color.toHex(); // '#ba5b00'
`${color}`; // '#ba5b00'

// They are iterable, so they destructure like a plain triplet
const [r, g, b] = color;

// Or start from an absorbance measured at 430 nm
absorptionToSrgb(0.7874).toHex();
```

CommonJS works the same way:

```js
const { srmToSrgb } = require('olfarve');
```

So does a plain HTML page, straight from a CDN:

```html
<script type="module">
  import { srmToSrgb } from 'https://esm.sh/olfarve';
  document.body.style.background = srmToSrgb(10).toHex();
</script>
```

### API

| Export                                           | Description                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| `srmToSrgb(srm, pathLengthCm?)`                  | Convert a Standard Reference Method value.                               |
| `ebcToSrgb(ebc, pathLengthCm?)`                  | Convert a European Brewery Convention value.                             |
| `absorptionToSrgb(absorption430, pathLengthCm?)` | Convert a photometer absorbance at 430 nm, in cm⁻¹.                      |
| `DEFAULT_PATH_LENGTH_CM`                         | `5.0`, the BJCP sample glass width, used when `pathLengthCm` is omitted. |
| `SrgbColor`                                      | Immutable, iterable color with `r`, `g`, `b`, `toRgb8()`, `toHex()`.     |
| `VERSION`                                        | The package version.                                                     |

All three conversions throw a `RangeError` if an argument is negative, `NaN` or
infinite.

## Command line

Installing the package provides an `olfarve` command. It takes one or more color
values and prints them as CSV:

```bash
npx olfarve 1 2 10
```

```
1,#fae8b6
2,#f4d180
10,#ba5b00
```

Pick a scale and a path length:

```bash
npx olfarve --scale ebc --path-length 1.0 8 20 40
```

Run `npx olfarve --help` for the full list of options.

## Development

```bash
npm install
npm run check
```

`npm run check` runs lint, type checking, format checking, the build, the
package validators and the test suite with coverage. The individual steps are
also available as `npm run lint`, `npm run typecheck`, `npm run format`,
`npm run build`, `npm run lint:package` and `npm test`.

The end to end tests exercise the built files in `dist/`, so run `npm run build`
before `npm test` if you want them to execute rather than skip.

Two dependency constraints are deliberate. TypeScript stays on 5.x because
`typescript-eslint` declares `typescript <6.1.0`, so type aware linting breaks on
TypeScript 7; the peer range makes the conflict an install error rather than a
silent one. `@types/node` tracks the oldest runtime in `engines` rather than the
newest release, so an API missing from that runtime fails type checking here
instead of at a user's.

## License

MIT
