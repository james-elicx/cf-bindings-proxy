/**
 * Transforms data from one format to another.
 *
 * @param data Data to transform.
 * @param transform Transform to apply.
 * @returns Transformed data.
 */
export const transformData = (data: unknown, transform: { from: string; to: string }): unknown => {
	if (transform.from === 'buffer' && transform.to === 'base64') {
		return btoa(String.fromCharCode(...new Uint8Array(data as ArrayBuffer)));
	}

	if (transform.from === 'base64' && transform.to === 'buffer') {
		return Uint8Array.from(atob(data as string), (c) => c.charCodeAt(0)).buffer;
	}

	if (transform.from === 'blob' && transform.to === 'base64') {
		const buffer = (data as Blob).arrayBuffer();
		return transformData(buffer, { from: 'buffer', to: 'base64' });
	}

	if (transform.from === 'base64' && transform.to === 'blob') {
		const buffer = transformData(data, { from: 'base64', to: 'buffer' }) as ArrayBuffer;
		return new Blob([buffer]);
	}

	return data;
};
