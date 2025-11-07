// Text formatting utilities

/**
 * Trims whitespace from a multi-line string while preserving relative indentation
 * @param {String} str - The string to trim
 * @returns {String} The trimmed string
 */
export const fullTrim = (str) => {
	const lines = str.split("\n"),
		  length = lines.length;

	let start = true,
		indent = Infinity;

	let temp = [],
		parsed = [];
	for (let i = 0; i < length; i++) {
		const line = lines[i];
		if (line.trim() === "") {
			if (start) {
				continue;
			} else {
				temp.push("");
			}
		} else {
			if (start) {
				start = false;
			} else {
				parsed = parsed.concat(temp);
				temp = [];
			}

			const leadingSpaces = line.match(/^(\s*)/)[0].length;
			indent = Math.min(indent, leadingSpaces);

			parsed.push(line);
		}
	}

	const parsedLength = parsed.length;
	if (parsedLength === 0) {
		return "";
	}

	const result = [];
	for (let i = 0; i < parsedLength; i++) {
		const line = parsed[i].trimEnd();
		if (line === "") {
			result.push("");
		} else {
			result.push(line.slice(indent));
		}
	}

	return result.join("\n");
};

