import type { PropertyCall } from './proxy';

export type TransformDataType =
	| 'buffer'
	| 'blob'
	| 'stream'
	| 'base64'
	| 'text'
	| 'json'
	| 'url'
	| 'request'
	| 'response';

export type TransformRawType =
	| ArrayBuffer
	| Blob
	| string
	| NonNullable<object>
	| URL
	| Request
	| Response;

type ParseTransformFrom<T extends TransformDataType> = T extends 'buffer'
	? Extract<TransformDataType, 'base64' | 'text' | 'json'>
	: T extends 'blob' | 'stream'
	? Extract<TransformDataType, 'base64'>
	: T extends 'base64'
	? Extract<TransformDataType, 'buffer' | 'blob' | 'stream'>
	: T extends 'text'
	? Extract<TransformDataType, 'url' | 'request' | 'response'>
	: T extends 'url' | 'request' | 'response'
	? Extract<TransformDataType, 'text'>
	: never;

export type TransformRule<
	From extends TransformDataType = TransformDataType,
	To extends ParseTransformFrom<From> = ParseTransformFrom<From>,
> = { from: From; to: To };

export type ParseType<T extends TransformDataType> = T extends 'buffer'
	? ArrayBuffer
	: T extends 'blob'
	? Blob
	: T extends 'stream'
	? ReadableStream
	: T extends 'base64' | 'text'
	? string
	: T extends 'json'
	? NonNullable<object>
	: T extends 'url'
	? URL
	: T extends 'request'
	? Request
	: T extends 'response'
	? Response
	: never;

export type Functions = 'arrayBuffer' | 'blob' | 'json' | 'text' | 'body';
export type FunctionInfo<
	DataTransformRule extends TransformRule | undefined = TransformRule | undefined,
	Data = DataTransformRule extends TransformRule ? ParseType<DataTransformRule['to']> : undefined,
> = ({ data: Data; takeDataFrom?: never } | { data?: never; takeDataFrom: Functions }) & {
	transform?: DataTransformRule;
	asAccessor?: boolean;
};

type DeserializedRequest = {
	url: string;
	method: string;
	headers: [string, string][];
	body: string;
};
type DeserializedResponse = {
	status: number;
	statusText: string;
	headers: [string, string][];
	body: string;
};

/**
 * Transforms data from one format to another.
 *
 * @param data Data to transform.
 * @param transform Transform to apply.
 * @returns Transformed data.
 */
export const transformData = async <
	From extends TransformDataType,
	To extends ParseTransformFrom<From>,
>(
	data: ParseType<From>,
	transform: TransformRule<From, To>,
): Promise<ParseType<To>> => {
	switch (transform.from) {
		case 'buffer': {
			if (transform.to === 'blob') {
				return new Blob([data as ParseType<'buffer'>]) as ParseType<To>;
			}

			if (transform.to === 'base64') {
				const bytes = new Uint8Array(data as ParseType<'buffer'>);
				let binary = '';
				for (let i = 0; i < bytes.byteLength; i++) {
					binary += String.fromCharCode(bytes[i] as number);
				}
				return btoa(binary) as ParseType<To>;
			}

			const asText = new TextDecoder().decode(data as ParseType<'buffer'>);
			if (transform.to === 'text') return asText as ParseType<To>;
			if (transform.to === 'json') return JSON.parse(asText) as ParseType<To>;
			break;
		}
		case 'blob': {
			if (transform.to === 'base64') {
				const buffer = await (data as Blob).arrayBuffer();
				return transformData(buffer, { from: 'buffer', to: 'base64' }) as Promise<ParseType<To>>;
			}
			break;
		}
		case 'stream': {
			if (transform.to === 'base64') {
				const buffer = await (data as ReadableStream).getReader().read();
				return transformData(buffer.value as ArrayBuffer, {
					from: 'buffer',
					to: 'base64',
				}) as Promise<ParseType<To>>;
			}
			break;
		}
		case 'base64': {
			if (transform.to === 'buffer') {
				return Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0))
					.buffer as ParseType<To>;
			}

			if (transform.to === 'blob') {
				const buffer = await transformData(data as ParseType<'base64'>, {
					from: 'base64',
					to: 'buffer',
				});
				return new Blob([buffer]) as ParseType<To>;
			}

			if (transform.to === 'stream') {
				const buffer = await transformData(data as ParseType<'base64'>, {
					from: 'base64',
					to: 'buffer',
				});
				const { readable, writable } = new FixedLengthStream(buffer.byteLength);
				const writer = writable.getWriter();
				writer.write(buffer);
				writer.close();
				return readable as ParseType<To>;
			}

			if (transform.to === 'url') {
				return new URL(data as string) as ParseType<To>;
			}
			break;
		}
		case 'url': {
			if (transform.to === 'text') {
				return (data as URL).toString() as ParseType<To>;
			}
			break;
		}
		case 'request': {
			if (transform.to === 'text') {
				const asReq = data as Request;
				return JSON.stringify({
					url: asReq.url,
					method: asReq.method,
					headers: [...asReq.headers.entries()],
					body: await transformData(await asReq.arrayBuffer(), {
						from: 'buffer',
						to: 'base64',
					}),
				} satisfies DeserializedRequest) as ParseType<To>;
			}
			break;
		}
		case 'response': {
			if (transform.to === 'text') {
				const asResp = data as Response;
				return JSON.stringify({
					status: asResp.status,
					statusText: asResp.statusText,
					headers: [...asResp.headers.entries()],
					body: await transformData(await asResp.arrayBuffer(), { from: 'buffer', to: 'base64' }),
				} satisfies DeserializedResponse) as ParseType<To>;
			}
			break;
		}
		case 'text': {
			if (transform.to === 'url') {
				return new URL(data as string) as ParseType<To>;
			}

			if (transform.to === 'request') {
				const deserialized = JSON.parse(data as string) as DeserializedRequest;
				return new Request(deserialized.url, {
					method: deserialized.method,
					headers: Object.fromEntries(deserialized.headers),
					body: deserialized.body
						? await transformData(deserialized.body, { from: 'base64', to: 'buffer' })
						: undefined,
				}) as ParseType<To>;
			}

			if (transform.to === 'response') {
				const deserialized = JSON.parse(data as string) as DeserializedResponse;
				return new Response(
					deserialized.body
						? await transformData(deserialized.body, { from: 'base64', to: 'buffer' })
						: undefined,
					{
						status: deserialized.status,
						statusText: deserialized.statusText,
						headers: Object.fromEntries(deserialized.headers),
					},
				) as ParseType<To>;
			}
			break;
		}
		default:
		// no default
	}

	return data as unknown as ParseType<To>;
};

/**
 * Prepares the argument's data to be sent over HTTP via the binding proxy.
 * This will transform any `ArrayBuffer` or `Blob` to `base64` and add the `transform` property.
 *
 * @param data The data to prepare.
 */
export const prepareDataForProxy = async (
	rawData: PropertyCallArg['data'],
	fallback: PropertyCallArg,
): Promise<PropertyCallArg> => {
	if (rawData instanceof ArrayBuffer) {
		return {
			transform: { from: 'base64', to: 'buffer' },
			data: await transformData(rawData, { from: 'buffer', to: 'base64' }),
		};
	}

	if (rawData instanceof Blob) {
		return {
			transform: { from: 'base64', to: 'blob' },
			data: await transformData(rawData, { from: 'blob', to: 'base64' }),
		};
	}

	if (rawData instanceof URL) {
		return {
			transform: { from: 'text', to: 'url' },
			data: await transformData(rawData, { from: 'url', to: 'text' }),
		};
	}

	if (rawData instanceof Request) {
		return {
			transform: { from: 'text', to: 'request' },
			data: await transformData(rawData, { from: 'request', to: 'text' }),
		};
	}

	if (rawData instanceof Response) {
		return {
			transform: { from: 'text', to: 'response' },
			data: await transformData(rawData, { from: 'response', to: 'text' }),
		};
	}

	// NOTE: We can't use `instanceof` here as the value may not strictly be an instance of `ReadableStream`.
	if (
		rawData !== null &&
		typeof rawData === 'object' &&
		'getReader' in rawData &&
		typeof rawData.getReader === 'function'
	) {
		return {
			transform: { from: 'base64', to: 'stream' },
			data: await transformData(rawData as ReadableStream, { from: 'stream', to: 'base64' }),
		};
	}

	return fallback;
};

type PropertyCallArg = PropertyCall['args'][0];

export const transformFunctionInfo = async <Fn extends FunctionInfo>(
	{ data, takeDataFrom, transform }: Fn,
	fns: { [key in Functions]?: FunctionInfo },
) => {
	// eslint-disable-next-line no-nested-ternary
	const takenData = (
		takeDataFrom ? await transformFunctionInfo(fns[takeDataFrom] as FunctionInfo, fns) : data
	) as TransformRawType | (() => TransformRawType | Promise<TransformRawType>);

	const transformDataFn =
		takenData && transform
			? async () => {
					const derivedData =
						typeof takenData === 'function' && !(takenData instanceof Blob)
							? await Promise.resolve(takenData())
							: takenData;

					return Promise.resolve(transformData(derivedData, transform));
			  }
			: takenData ?? data;

	return transformDataFn as TransformRawType | (() => TransformRawType | Promise<TransformRawType>);
};
