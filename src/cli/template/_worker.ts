import type { CacheStorage } from '@cloudflare/workers-types';
import type { BindingRequest, BindingResponse, PropertyCall } from '../../proxy';
import type { FunctionInfo, TransformRule } from '../../transform';
import { prepareDataForProxy, transformData } from '../../transform';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Env = { [key: string]: any };

/**
 * Reduces and reconstructs the calls that the proxy destructured.
 *
 * @param callee The object to call the function on.
 * @param callsToProcess Function calls to process.
 * @returns The result of the function calls.
 */
const reduceCalls = async (callee: Env, callsToProcess: PropertyCall[]): Promise<unknown> => {
	return callsToProcess.reduce(async (acc, { prop, args }) => {
		return (await acc)[prop](
			...(await Promise.all(
				args.map(async (arg) => {
					if (Array.isArray(arg.data)) {
						return Promise.all(
							arg.data.map((a) => ('__bindingId' in a ? reduceCalls(callee, a.__calls) : a)),
						);
					}

					// @ts-expect-error - We don't know the type of the data.
					return arg.transform ? transformData(arg.data, arg.transform) : arg.data;
				}),
			)),
		);
	}, Promise.resolve(callee));
};

export default {
	async fetch(request, env) {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		try {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			const { __original_call, __proxyType, __bindingId, __calls } =
				await request.json<BindingRequest>();

			const baseId = __original_call ? __original_call.__bindingId : __bindingId;

			let base;
			switch (__proxyType) {
				case 'caches': {
					const asCacheStorage = caches as unknown as CacheStorage;
					base = baseId === 'default' ? asCacheStorage.default : await asCacheStorage.open(baseId);
					break;
				}
				case 'binding': {
					base = env[baseId];
					break;
				}
				default: {
					throw new Error('Unknown proxy type');
				}
			}

			const callee = __original_call ? await reduceCalls(base, __original_call.__calls) : base;

			const rawData = await reduceCalls(callee, __calls);
			const resp: BindingResponse = { success: true, data: rawData, functions: {} };

			if (resp.success) {
				const transformedResp = await prepareDataForProxy(rawData, { data: rawData });
				resp.transform = transformedResp.transform;
				resp.data = transformedResp.data;

				if (
					rawData &&
					typeof rawData === 'object' &&
					!Array.isArray(rawData) &&
					![Response, Request, URL].find((t) => rawData instanceof t)
				) {
					// resp.arrayBuffer() => Promise<ArrayBuffer>
					if ('arrayBuffer' in rawData && typeof rawData.arrayBuffer === 'function') {
						const buffer = await rawData.arrayBuffer();
						resp.functions.arrayBuffer = (await prepareDataForProxy(buffer, {
							data: buffer,
						})) as FunctionInfo<TransformRule<'buffer', 'base64'>>;
					}

					// NOTE: We can assume that we always have an arrayBuffer if we have any of the following.

					// resp.blob() => Promise<Blob>
					if ('blob' in rawData && typeof rawData.blob === 'function') {
						resp.functions.blob = {
							takeDataFrom: 'arrayBuffer',
							transform: { from: 'buffer', to: 'blob' },
						};
					}

					// resp.text() => Promise<string>
					if ('text' in rawData && typeof rawData.text === 'function') {
						resp.functions.text = {
							takeDataFrom: 'arrayBuffer',
							transform: { from: 'buffer', to: 'text' },
						};
					}

					// resp.json<T>() => Promise<T>
					if ('json' in rawData && typeof rawData.json === 'function') {
						resp.functions.json = {
							takeDataFrom: 'arrayBuffer',
							transform: { from: 'buffer', to: 'json' },
						};
					}

					// resp.body => ReadableStream
					if ('body' in rawData && typeof rawData.body === 'object') {
						resp.functions.body = {
							takeDataFrom: 'arrayBuffer',
							asAccessor: true,
						};
					}
				}
			}

			return new Response(JSON.stringify(resp), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error(e);

			const resp = JSON.stringify({
				success: false,
				data: e instanceof Error ? e.message : 'Failed to access binding',
			});

			return new Response(resp, {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	},
} as ExportedHandler<Env>;
