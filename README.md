# olfarve

[![npm version](https://img.shields.io/npm/v/olfarve)](https://www.npmjs.com/package/olfarve)

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

The package requires Node.js 22.12 or newer and has no runtime dependencies. It
ships both ESM and CommonJS builds along with TypeScript declarations.

## Usage

```js
import { srmToSrgb, ebcToSrgb, absorptionToSrgb } from 'olfarve';

srmToSrgb(10).toHex();
ebcToSrgb(20).toHex();

// The default path length is 5 cm, the width of a typical sample glass
srmToSrgb(10, 1.0).toHex();

// Results are SrgbColor instances of gamma encoded components in [0, 1]
const color = srmToSrgb(10);
color.r;
color.g;
color.b;
color.toRgb8();

// Or start from an absorbance measured at 430 nm
absorptionToSrgb(0.7874);
```

CommonJS works the same way:

```js
const { srmToSrgb } = require('olfarve');
```

So does a plain HTML page, via [jsDelivr](https://www.jsdelivr.com/):

```html
<script type="module">
  import { srmToSrgb } from 'https://cdn.jsdelivr.net/npm/olfarve@1.0.0/dist/index.mjs';
  document.body.style.background = srmToSrgb(10).toHex();
</script>
```

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
