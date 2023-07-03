/// <reference types="vitest" />
/* eslint-disable import/no-extraneous-dependencies */
import { readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { externalizeDeps } from 'vite-plugin-externalize-deps';

const normalizeResolve = (...path: string[]) => resolve(__dirname, ...path).replace(/\\/g, '/');

const getPathsRecursively = (baseDir: string): string[] =>
	readdirSync(normalizeResolve(baseDir))
		.map((p) => normalizeResolve(baseDir, p))
		.map((p) => (statSync(p).isDirectory() ? getPathsRecursively(p) : p))
		.flat()
		.filter((p) => !/(\.spec|test)\.tsx?$/gi.test(p))
		.filter((p) => /\.tsx?$/gi.test(p));

const resolveEntryPath = (path: string, baseDir: string) =>
	path
		.replace(normalizeResolve(baseDir), '')
		.replace(/^\//, '')
		.replace(/\.tsx?$/g, '');

const getEntryPoints = (baseDir: string) =>
	Object.fromEntries(getPathsRecursively(baseDir).map((p) => [resolveEntryPath(p, baseDir), p]));

export default defineConfig({
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		lib: {
			entry: getEntryPoints('src'),
		},
		sourcemap: true,
		minify: 'esbuild',
	},
	plugins: [
		externalizeDeps(),
		dts({
			tsConfigFilePath: normalizeResolve('tsconfig.json'),
			include: ['src/**/*.{ts,tsx}', 'env.d.ts'],
			entryRoot: 'src',
			outputDir: 'dist',
		}),
	],
	test: {
		environment: 'miniflare',
	},
});
