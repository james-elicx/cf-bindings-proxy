import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve } from 'path';

// Strip dist from package.json exports
const packageJson = readFileSync(resolve('package.json'), 'utf-8');
const withoutDist = packageJson.replace(/dist\//g, '');
writeFileSync(resolve('dist', 'package.json'), withoutDist);

// Copy README and LICENSE
copyFileSync(resolve('README.md'), resolve('dist', 'README.md'));
copyFileSync(resolve('LICENSE.md'), resolve('dist', 'LICENSE.md'));

// Fix shebangs
const cliJs = readFileSync(resolve('dist', 'cli', 'index.js'), 'utf-8');
const cliJsFixed = `#!/usr/bin/env node\n${cliJs}`;
writeFileSync(resolve('dist', 'cli', 'index.js'), cliJsFixed);

// Fix shebangs
const cliCjs = readFileSync(resolve('dist', 'cli', 'index.cjs'), 'utf-8');
const cliCjsFixed = `#!/usr/bin/env node\n${cliCjs}`;
writeFileSync(resolve('dist', 'cli', 'index.cjs'), cliCjsFixed);
