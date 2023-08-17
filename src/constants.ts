export const PROTOCOL = process.env.BINDINGS_PROXY_PROTOCOL || 'http';
export const HOST = process.env.BINDINGS_PROXY_HOST || '127.0.0.1';
export const PORT = Number(process.env.BINDINGS_PROXY_PORT) || 8799;
