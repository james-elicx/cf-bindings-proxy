declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NODE_ENV?: string;
			DISABLE_BINDINGS_PROXY?: string;
			ENABLE_BINDINGS_PROXY?: string;
			BINDINGS_PROXY_PROTOCOL?: string;
			BINDINGS_PROXY_HOST?: string;
			BINDINGS_PROXY_PORT?: string;
		}
	}
}

export {};
