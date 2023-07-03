import { beforeAll } from 'vitest';

beforeAll(() => {
	process.env.ENABLE_BINDINGS_PROXY = 'true';
});
