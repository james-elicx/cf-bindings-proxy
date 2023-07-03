declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV?: string;
			DISABLE_BINDINGS_PROXY?: string;
			ENABLE_BINDINGS_PROXY?: string;
		}
	}
}

export {};
