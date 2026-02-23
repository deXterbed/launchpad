/**
 * Line-buffered writer: emits only complete lines with a prefix so output
 * doesn't break mid-line when chunks don't align with newlines.
 */
export function createLineBufferedWriter(
	fire: (s: string) => void,
	prefix: string
): { write: (data: Buffer | string) => void; flush: () => void } {
	let buffer = '';
	return {
		write(data: Buffer | string) {
			const text = typeof data === 'string' ? data : data.toString('utf8');
			buffer += text;
			const lines = buffer.split(/\r?\n/);
			buffer = lines.pop() ?? '';
			for (const line of lines) {
				// Strip \r so it doesn't move cursor and overwrite the prefix (e.g. Ruby/Puma output)
				fire(`${prefix} ${line.replace(/\r/g, '')}\r\n`);
			}
		},
		flush() {
			if (buffer.length > 0) {
				fire(`${prefix} ${buffer.replace(/\r/g, '')}\r\n`);
				buffer = '';
			}
		},
	};
}
