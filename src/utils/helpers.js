/**
* WikiShieldUtil - Utility helper functions
* Collection of helper methods for string manipulation, formatting, and conversions
*/

function hasApproxSubstring(needle, haystack, k) {
	const n = needle.length;
	const m = haystack.length;
	if (n === 0) return true;       // empty pattern always matches
	if (m === 0) return n <= k;     // only deletions possible

	// DP rows
	let prev = new Array(m + 1).fill(0);
	let curr = new Array(m + 1).fill(0);

	// Sellers-style init: distance from empty needle to any haystack prefix is 0
	for (let j = 0; j <= m; j++) prev[j] = 0;

	for (let i = 1; i <= n; i++) {
		curr[0] = i; // distance to empty haystack prefix

		let rowMin = curr[0];

		for (let j = 1; j <= m; j++) {
			const cost = needle[i - 1] === haystack[j - 1] ? 0 : 1;

			const del = prev[j] + 1;      // delete from needle
			const ins = curr[j - 1] + 1;  // insert into needle
			const sub = prev[j - 1] + cost;

			const d = Math.min(del, ins, sub);
			curr[j] = d;
			if (d < rowMin) rowMin = d;

			// if any cell in this row is already <= k, we know there's some
			// substring ending at j with distance <= k when i == n
			if (i === n && d <= k) return true;
		}

		// If the best value in this row already exceeds k and we're not
		// at the last row, then any longer alignment only gets worse.
		if (rowMin > k) return false;

		[prev, curr] = [curr, prev];
	}

	return false;
}

export class WikiShieldUtil {
	/**
	* Given a Date object, return a string in the format YYYY-MM-DDTHH:MM:SS
	* @param {Date} date The date to convert
	* @returns {String} The date in the format YYYY-MM-DDTHH:MM:SS
	*/
	utcString(date) {
		return date.getUTCFullYear() + "-" +
		this.padString(date.getUTCMonth() + 1, 2) + "-" +
		this.padString(date.getUTCDate(), 2) + "T" +
		this.padString(date.getUTCHours(), 2) + ":" +
		this.padString(date.getUTCMinutes(), 2) + ":" +
		this.padString(date.getUTCSeconds(), 2);
	}

	/**
	* Given a string and a length, pad the string with 0s to the left until it is the given length
	* @param {String} str The string to pad
	* @param {Number} len The length to pad to
	* @returns {String} The padded string
	*/
	padString(str, len) {
		str = str.toString();
		while (str.length < len) {
			str = "0" + str;
		}
		return str;
	}

	/**
	* Given a string, encode it for use in a URL
	* @param {String} str The string to encode
	* @returns {String} The encoded string
	*/
	encodeuri(str) {
		return encodeURIComponent(str);
	}

	/**
	* Get the section name for the current month and year
	* @returns {String} The section name
	*/
	monthSectionName() {
		const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		const currentMonth = months[new Date().getUTCMonth()];
		const currentYear = new Date().getUTCFullYear();

		return currentMonth + " " + currentYear;
	}

	/**
	* Convert expiry time string to milliseconds
	* @param {String} expiryString The expiry string (e.g., "1 hour", "30 minutes", "1 week")
	* @returns {Number} The number of milliseconds
	*/
	expiryToMilliseconds(expiryString) {
		const conversions = {
			"none": 0,
			"1 hour": 60 * 60 * 1000,
			"1 day": 24 * 60 * 60 * 1000,
			"1 week": 7 * 24 * 60 * 60 * 1000,
			"1 month": 4 * 7 * 24 * 60 * 60 * 1000,
			"3 months": 4 * 7 * 24 * 60 * 60 * 1000,
			"6 months": 4 * 7 * 24 * 60 * 60 * 1000,
			"indefinite": Infinity,
		};
		return conversions[expiryString] ?? conversions["1 hour"]; // Default to 1 hour
	}

	/**
	* Given a string, escape it for use in HTML
	* @param {String} str The string to escape
	* @returns {String} The escaped string
	*/
	escapeHtml(str) {
		return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
	}

	/**
	* Given the title of a page, return the URL to that page
	* @param {String} title The title of the page
	* @param {String} wiki The wiki subdomain (e.g., "en")
	* @param {Boolean} usePhpString Whether to use /w/index.php in the link
	* @returns {String} The URL to the page
	*/
	pageLink(title, wiki = 'en', usePhpString = false) {
		return usePhpString
		? `https://${mw.config.get("wgServerName")}/w/index.php${title}`
		: `https://${mw.config.get("wgServerName")}/wiki/${this.encodeuri(title)}`;
	}

	/**
	* If the given string is longer than the given length, truncate it and add "..." to the end
	* @param {String} str The string to truncate
	* @param {Number} len The length to truncate to
	* @returns {String} The truncated string
	*/
	// FIX will cutoff html tags awkwardly; consider a more robust solution if needed
	maxStringLength(str, len) {
		return str.length > len ? `${str.substring(0, len - 3).trimEnd()}...` : str;
	}

	formatBytes(bytes) {
		const sizes = [ "B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB", "RiB", "QiB" ];
		if (bytes === 0) return "0 B";
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
	}

	/**
	* Given the number of bytes changed in an edit, return the color
	* @param {Number} delta The number of bytes changed
	* @returns {String} The color
	*/
	getChangeColor(delta) {
		if (delta === 0) return "#888"; // Gray for no change
		if (delta > 0) {
			// Green scale for additions
			if (delta >= 1000) return "#00b894"; // Bright green for large additions
			if (delta >= 500) return "#00d4a1"; // Medium-bright green
			if (delta >= 100) return "#26de81"; // Light green
			return "#55efc4"; // Very light green for small additions
		} else {
			// Red scale for deletions
			const absDelta = Math.abs(delta);
			if (absDelta >= 1000) return "#d63031"; // Deep red for large deletions
			if (absDelta >= 500) return "#e74c3c"; // Medium red
			if (absDelta >= 100) return "#ff6b6b"; // Light red
			return "#ff8787"; // Very light red for small deletions
		}
	}

	/**
	* Given the number of bytes changed in an edit, return the string (eg. "+100")
	* @param {Number} delta The number of bytes changed
	* @returns {String} The string
	*/
	getChangeString(delta) {
		return delta > 0 ? "+" + delta : (delta === 0 ? "0" : "&ndash;" + Math.abs(delta).toString());
	}

	/**
	* Given a timestamp, return a string representing how long ago it was
	* @param {String} timestamp The timestamp
	* @returns {String} Time ago
	*/
	timeAgo(timestamp) {
		const difference = Date.now() - new Date(timestamp);
		const seconds = Math.floor(difference / 1000);

		// Handle future timestamps (clock skew)
		if (seconds < 0) {
			return "just now";
		}

		if (seconds > 60) {
			if (seconds > 60 * 60) {
				if (seconds > 60 * 60 * 24) {
					const val = Math.floor(seconds / 60 / 60 / 24);
					return val + " day" + (val !== 1 ? "s" : "") + " ago";
				}
				const val = Math.floor(seconds / 60 / 60);
				return val + " hour" + (val !== 1 ? "s" : "") + " ago";
			}
			const val = Math.floor(seconds / 60);
			return val + " minute" + (val !== 1 ? "s" : "") + " ago";
		}
		return seconds + " second" + (seconds !== 1 ? "s" : "") + " ago";
	}

	usernameMatch(needle, haystack) {
		return hasApproxSubstring(needle, haystack, 2);
	}
}
