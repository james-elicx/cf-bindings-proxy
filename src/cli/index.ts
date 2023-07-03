import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Spawns wrangler dev mode with the binding proxy template.
 */
export const spawnDevMode = async () => {
	const passThroughArgs = process.argv.slice(2);

	const suffix = process.platform === 'win32' ? '.cmd' : '';
	const executor = `npx${suffix}`;

	const wrangler = spawn(
		executor,
		['wrangler', 'pages', 'dev', resolve('./template'), '--port=8799', ...passThroughArgs],
		{ stdio: 'inherit' },
	);

	await new Promise((res) => {
		wrangler.on('close', (code) => {
			res(code);
		});
	});
};

spawnDevMode();
