import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line @typescript-eslint/naming-convention
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line @typescript-eslint/naming-convention
const __dirname = dirname(__filename);

const pad = (num: number) => (num < 10 ? `0${num}` : num);

/**
 * Spawns wrangler dev mode with the binding proxy template.
 */
export const spawnDevMode = async () => {
	const passThroughArgs = process.argv.slice(2);

	const suffix = process.platform === 'win32' ? '.cmd' : '';
	const executor = `npx${suffix}`;

	// eslint-disable-next-line no-console
	console.log(`
-----------------
Starting cf-bindings-proxy...

WARNING: This is an experimental proxy for interfacing with bindings remotely.

Please report any issues to https://github.com/james-elicx/cf-bindings-proxy
-----------------
`);

	if (!passThroughArgs.includes('compatibility-date')) {
		const date = new Date();
		const formatted = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
		passThroughArgs.push(`--compatibility-date=${formatted}`);
	}

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
