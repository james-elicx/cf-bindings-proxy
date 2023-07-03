import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { resolve } from 'path';

const packageJsonPath = resolve('package.json');

const hash = process.argv[2];
if (typeof hash !== 'string' || hash.length === 0) {
	throw new Error('Hash is required');
}

const tag = process.argv[3];
if (typeof tag !== 'string' || tag.length === 0) {
	throw new Error('Tag is required');
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

packageJson.version = `${packageJson.version}-${hash.trim()}`;
packageJson.versionMetadata = {
	type: tag,
};

writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
