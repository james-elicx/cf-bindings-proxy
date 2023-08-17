import { HOST, PORT, PROTOCOL } from './constants';
import { transformData } from './transform';

export type BindingResponse =
	| { success: false; data: string; transform?: never }
	| { success: true; data: unknown; transform?: { from: string; to: string } };

/**
 * Fetches data from the binding proxy.
 *
 * @param call The call to make to the proxy.
 * @returns The data returned from the proxy.
 */
const fetchData = async (call: BindingRequest): Promise<unknown> => {
	let resp: Response;
	try {
		resp = await fetch(`${PROTOCOL}://${HOST}:${PORT}`, {
			body: JSON.stringify(call),
			method: 'POST',
			cache: 'no-store',
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e) {
		throw new Error('Unable to connect to binding proxy');
	}

	const { success, data, transform } = await resp.json<BindingResponse>();

	if (!success) {
		throw new Error(data || 'Bad response from binding proxy');
	}

	return transform ? transformData(data, transform) : data;
};

export type PropertyCall = { prop: string; args: (unknown | BindingRequest[])[] };
export type BindingRequest = {
	__original_call?: BindingRequest;
	__bindingId: string;
	__calls: PropertyCall[];
	__chainUntil: string[];
};

/**
 * Creates a proxy object for the response data.
 *
 * @param bindingId Binding ID.
 * @param originalProxy Original proxy object.
 * @param data Data to proxy.
 * @returns A proxy object.
 */
const createResponseProxy = <T extends object>(
	bindingId: string,
	originalProxy: BindingRequest,
	data: T,
): T => {
	return new Proxy(data, {
		get(_, prop) {
			if (!data || ['then', Symbol.iterator, Symbol.toStringTag].includes(prop)) return undefined;

			if (prop in data || ['error', 'results'].includes(prop as string)) {
				return data[prop as keyof typeof data];
			}

			if (Array.isArray(data) && typeof prop === 'string' && !Number.isNaN(Number(prop))) {
				return data[Number(prop)];
			}

			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const newProxy = createBindingProxy<BindingRequest>(bindingId, true);

			newProxy.__original_call = originalProxy;

			return async (...args: unknown[]) => {
				newProxy.__calls.push({ prop: prop as string, args });

				return fetchData(newProxy);
			};
		},
	});
};

/**
 * Decides whether or not we should chain until a certain point for a property.
 *
 * @param prop Property to check.
 * @returns Whether or not we should chain until certain properties.
 */
const shouldChainUntil = (prop: string): string[] => {
	// d1 support for chaining the `prepare` method
	if (['prepare'].includes(prop)) {
		return ['first', 'run', 'all', 'raw'];
	}

	return [];
};

/**
 * Creates a proxy object for the binding.
 *
 * @param bindingId Binding ID.
 * @param notChainable Whether or not the proxy should be chainable.
 * @returns A proxy object.
 */
export const createBindingProxy = <T>(bindingId: string, notChainable = false): T => {
	return new Proxy({ __bindingId: bindingId, __calls: [], __chainUntil: [] } as BindingRequest, {
		get(target, prop: string) {
			// internal properties
			if (typeof prop === 'string' && prop.startsWith('__'))
				return target[prop as keyof BindingRequest];
			// ignore toJSON calls
			if (prop === 'toJSON') return undefined;
			if (notChainable) return undefined;

			// decide if we should chain until a certain point for this call
			if (!target.__chainUntil.length) {
				// eslint-disable-next-line no-param-reassign
				target.__chainUntil = shouldChainUntil(prop);
			}

			// if we haven't reached the point where we should stop chaining, return a new proxy
			if (target.__chainUntil.length && !target.__chainUntil.includes(prop)) {
				const newProxy = createBindingProxy<BindingRequest>(bindingId);

				newProxy.__chainUntil = target.__chainUntil;
				newProxy.__calls = target.__calls;

				return (...args: unknown[]) => {
					target.__calls.push({ prop, args });
					return newProxy;
				};
			}

			return async (...args: unknown[]) => {
				target.__calls.push({ prop, args });

				const data = await fetchData(target);

				if (typeof data !== 'object' || !data) {
					return data;
				}

				return createResponseProxy(bindingId, target, data);
			};
		},
	}) as T;
};
