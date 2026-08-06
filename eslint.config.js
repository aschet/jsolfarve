// SPDX-FileCopyrightText: 2026 Thomas Ascher <thomas.ascher@gmx.at>
//
// SPDX-License-Identifier: MIT

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // Numbers in messages and help text are unambiguous; everything else
      // still has to be stringified deliberately.
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Config files are plain JS and outside the type-checked program.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
