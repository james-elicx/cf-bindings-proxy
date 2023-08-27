import type { PropertyCall } from './proxy';

/**
 * Transforms data from one format to another.
 *
 * @param data Data to transform.
 * @param transform Transform to apply.
 * @returns Transformed data.
 */
export const transformData = async (
	data: unknown,
	transform: { from: string; to: string },
): Promise<unknown> => {
	if (transform.from === 'buffer' && transform.to === 'base64') {
		const bytes = new Uint8Array(data as ArrayBuffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i] as number);
		}
		return btoa(binary);
	}

	if (transform.from === 'base64' && transform.to === 'buffer') {
		return Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0)).buffer;
	}

	if (transform.from === 'blob' && transform.to === 'base64') {
		const buffer = await (data as Blob).arrayBuffer();
		return transformData(buffer, { from: 'buffer', to: 'base64' });
	}

	if (transform.from === 'base64' && transform.to === 'blob') {
		const buffer = (await transformData(data, { from: 'base64', to: 'buffer' })) as ArrayBuffer;
		return new Blob([buffer]);
	}

	return data;
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

	return fallback;
};

type PropertyCallArg = PropertyCall['args'][0];
