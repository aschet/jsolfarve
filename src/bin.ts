#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Thomas Ascher <thomas.ascher@gmx.at>
//
// SPDX-License-Identifier: MIT

/**
 * Executable entry point for the `olfarve` command.
 *
 * @packageDocumentation
 */

import { main } from './cli.js';

process.exitCode = main();
