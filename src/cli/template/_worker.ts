import type { BindingRequest, BindingResponse, PropertyCall } from '../../proxy';
import { transformData } from '../../transform';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Env = { [key: string]: any };

/**
 * Reduces and reconstructs the calls that the proxy destructured.
 *
 * @param callee The object to call the function on.
 * @param callsToProcess Function calls to process.
 * @returns The result of the function calls.
 */
const reduceCalls = (callee: Env, callsToProcess: PropertyCall[]): unknown => {
	return callsToProcess.reduce((acc, { prop, args }) => {
		return acc[prop](
			...args.map((arg) => {
				if (Array.isArray(arg.data)) {
					return arg.data.map((a) => ('__bindingId' in a ? reduceCalls(callee, a.__calls) : a));
				}

				if (arg.transform) {
					return transformData(arg.data, arg.transform);
				}

				return arg.data;
			}),
		);
	}, callee);
};

export default {
	async fetch(request, env) {
		if (request.method !== 'POST') {
			return new Response('Method not allowed', { status: 405 });
		}

		try {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			const { __original_call, __bindingId, __calls } = await request.json<BindingRequest>();

			const callee = __original_call
				? await reduceCalls(env[__original_call.__bindingId], __original_call.__calls)
				: env[__bindingId];

			const rawData = await reduceCalls(callee, __calls);
			const resp: BindingResponse = { success: true, data: rawData };

			if (resp.success) {
				if (rawData instanceof ArrayBuffer) {
					resp.transform = { from: 'base64', to: 'buffer' };
					resp.data = transformData(rawData, { from: 'buffer', to: 'base64' });
				} else if (rawData instanceof Blob) {
					resp.transform = { from: 'base64', to: 'blob' };
					resp.data = transformData(await rawData.arrayBuffer(), { from: 'buffer', to: 'base64' });
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
