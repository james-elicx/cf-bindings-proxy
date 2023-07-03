import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename);

/**
 * Spawns wrangler dev mode with the binding proxy template.
 */
export const spawnDevMode = async () => {
	const passThroughArgs = process.argv.slice(2);

	const suffix = process.platform === 'win32' ? '.cmd' : '';
	const executor = `npx${suffix}`;

	// eslint-disable-next-line no-console
	console.log(resolve());

	const wrangler = spawn(
		executor,
		['wrangler', 'pages', 'dev', resolve(__dirname, 'template'), '--port=8799', ...passThroughArgs],
		{ stdio: 'inherit' },
	);

	await new Promise((res) => {
		wrangler.on('close', (code) => {
			res(code);
		});
	});
};

spawnDevMode();
