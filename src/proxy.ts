import type { FunctionInfo, Functions, ParseType, TransformRule } from './transform';
import { prepareDataForProxy, transformData, transformFunctionInfo } from './transform';

export type BindingResponse =
	| { success: false; data: string; transform?: never; functions?: never }
	| {
			success: true;
			data: unknown;
			transform?: TransformRule;
			functions: { [key in Functions]?: FunctionInfo };
	  };

/**
 * Prepares the binding request to be sent to the proxy.
 *
 * @param bindingRequest
 */
const prepareBindingRequest = async (bindingRequest: BindingRequest): Promise<BindingRequest> => {
	return {
		...bindingRequest,
		__calls: await Promise.all(
			bindingRequest.__calls.map(async (call) => ({
				...call,
				args: await Promise.all(call.args.map((arg) => prepareDataForProxy(arg.data, arg))),
			})),
		),
	};
};

/**
 * Fetches data from the binding proxy.
 *
 * @param call The call to make to the proxy.
 * @returns The data returned from the proxy.
 */
const fetchData = async (call: BindingRequest): Promise<unknown> => {
	const preparedCall = await prepareBindingRequest(call);
	const stringifiedCall = JSON.stringify(preparedCall);

	let resp: Response;
	try {
		resp = await fetch('http://127.0.0.1:8799', {
			body: stringifiedCall,
			method: 'POST',
			cache: 'no-store',
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e) {
		throw new Error('Unable to connect to binding proxy');
	}

	const { success, data, transform, functions } = await resp.json<BindingResponse>();

	if (!success) {
		throw new Error(data || 'Bad response from binding proxy');
	}

	// @ts-expect-error - We don't know the type of the data.
	const finalData = transform ? transformData(data, transform) : data;

	if (functions && finalData && typeof finalData === 'object' && !Array.isArray(finalData)) {
		for (const [key, fnInfo] of Object.entries(functions)) {
			const transformFn = await transformFunctionInfo(fnInfo, functions);

			if (fnInfo.asAccessor) {
				const value =
					typeof transformFn === 'function' && !(transformFn instanceof Blob)
						? await transformFn()
						: transformFn;

				if (key === 'body') {
					const body = new ReadableStream({
						start(controller) {
							controller.enqueue(value);
							controller.close();
						},
					});

					Object.defineProperties(finalData, {
						body: {
							get() {
								return body;
							},
						},
						bodyUsed: {
							get() {
								return body.locked;
							},
						},
					});
				} else {
					Object.defineProperty(finalData, key, {
						get() {
							return value;
						},
					});
				}
			} else {
				// @ts-expect-error - this should be fine
				finalData[key] = transformFn;
			}
		}
	}

	return finalData;
};

export type PropertyCall<Transform extends TransformRule | undefined = TransformRule | undefined> =
	{
		prop: string;
		args: {
			data:
				| (Transform extends TransformRule ? ParseType<Transform['from']> : unknown)
				| BindingRequest[];
			transform?: Transform;
		}[];
	};

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

			if (['toJSON'].includes(prop as string)) return data;

			// special handling for `writeHttpMetadata`
			if (prop === 'writeHttpMetadata' && data && typeof data === 'object') {
				// @ts-expect-error - this is fine
				const metadata = (data.httpMetadata || {}) as R2HTTPMetadata;
				return (headers: Headers) => {
					if (metadata.cacheControl) headers.set('cache-control', metadata.cacheControl);
					if (metadata.cacheExpiry) headers.set('expires', metadata.cacheExpiry.toUTCString());
					if (metadata.contentDisposition)
						headers.set('content-disposition', metadata.contentDisposition);
					if (metadata.contentEncoding) headers.set('content-encoding', metadata.contentEncoding);
					if (metadata.contentLanguage) headers.set('content-language', metadata.contentLanguage);
					if (metadata.contentType) headers.set('content-type', metadata.contentType);
				};
			}

			// eslint-disable-next-line @typescript-eslint/no-use-before-define
			const newProxy = createBindingProxy<BindingRequest>(bindingId, true);

			newProxy.__original_call = originalProxy;

			return async (...args: unknown[]) => {
				newProxy.__calls.push({ prop: prop as string, args: args.map((arg) => ({ data: arg })) });

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
			// ignore then calls if there are no calls yet
			if (target.__calls.length === 0 && prop === 'then') return undefined;

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
					target.__calls.push({ prop, args: args.map((arg) => ({ data: arg })) });
					return newProxy;
				};
			}

			return async (...args: unknown[]) => {
				target.__calls.push({ prop, args: args.map((arg) => ({ data: arg })) });

				const data = await fetchData(target);

				if (typeof data !== 'object' || !data) {
					return data;
				}

				return createResponseProxy(bindingId, target, data);
			};
		},
	}) as T;
};
