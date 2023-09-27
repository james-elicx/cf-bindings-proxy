import type { Cache, CacheStorage } from '@cloudflare/workers-types';
import { createBindingProxy } from './proxy';

/**
 * Whether the bindings proxy is enabled and currently active.
 *
 * The proxy is enabled by default in development mode, but can be disabled by setting
 * `DISABLE_BINDINGS_PROXY` to `true`.
 *
 * Alternatively, it can be enabled in other environments by setting `ENABLE_BINDINGS_PROXY` to
 * `true`.
 * */
export const isProxyEnabled = () =>
	process?.env?.ENABLE_BINDINGS_PROXY ||
	(!process?.env?.DISABLE_BINDINGS_PROXY && process?.env?.NODE_ENV === 'development');

/**
 * Interfaces with a binding from the environment.
 *
 * @example
 * ```ts
 * const value = await binding<KVNamespace>('MY_KV').get('key');
 * ```
 *
 * @example
 * By default, `process.env` is used in production, however, a custom fallback can be provided.
 * ```ts
 * const MY_KV = binding<KVNamespace>('MY_KV', { fallback: platform.env });
 * ```
 *
 * @param id Binding ID.
 * @param opts Binding options, such as a custom fallback.
 * @returns Binding value.
 */
export const binding = <T>(id: string, opts?: BindingOpts): T => {
	if (isProxyEnabled()) {
		return new Proxy(
			{},
			{
				get: (_, prop) => createBindingProxy<T>(id, { proxyType: 'binding' })[prop as keyof T],
			},
		) as T;
	}

	return (opts?.fallback ?? process?.env)?.[id] as T;
};

type DeriveCacheReturnType<T> = T extends 'default' | undefined ? Cache : Promise<Cache>;

export const cacheApi = <T extends string | undefined>(cacheName?: T): DeriveCacheReturnType<T> => {
	if (isProxyEnabled()) {
		return new Proxy(
			{},
			{
				get: (_, prop: keyof Cache) =>
					createBindingProxy<Cache>(cacheName ?? 'default', { proxyType: 'caches' })[prop],
			},
		) as DeriveCacheReturnType<T>;
	}

	const cachesInstance = caches as unknown as CacheStorage;

	return (
		cacheName === 'default' || cacheName === undefined
			? cachesInstance.default
			: cachesInstance.open(cacheName)
	) as DeriveCacheReturnType<T>;
};

type BindingOpts = {
	fallback: Record<string, unknown>;
};
