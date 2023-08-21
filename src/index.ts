import { createBindingProxy } from './proxy';

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
	if (
		process?.env?.ENABLE_BINDINGS_PROXY ||
		(!process?.env?.DISABLE_BINDINGS_PROXY && process?.env?.NODE_ENV === 'development')
	) {
		return new Proxy(
			{},
			{
				get: (_, prop) => createBindingProxy<T>(id)[prop as keyof T],
			},
		) as T;
	}

	return (opts?.fallback ?? process?.env)[id] as T;
};

type BindingOpts = {
	fallback: Record<string, unknown>;
};
