/**
 * WikiShieldLog - Simple logging utility
 * Provides consistent logging with WikiShield branding
 */
export class WikiShieldLog {
	/**
	 * Log a message to the console
	 * @param {String} text The message to log
	 */
	log(text) {
		console.log(`🛡️WikiShield: ${text}`);
	}
}

