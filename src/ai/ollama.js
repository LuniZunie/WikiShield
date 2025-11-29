/**
* WikiShieldOllamaAI - Ollama AI integration
* Handles AI-powered edit and username analysis using local Ollama models
*/
import { BuildAIAnalysisPrompt, BuildAIUsernamePrompt } from './prompts.js';

export class WikiShieldOllamaAI {
	constructor(serverUrl, model, options = {}) {
		this.serverUrl = serverUrl || "http://localhost:11434";
		this.model = model || "";
		this.cache = new Map(); // Cache results to avoid repeated API calls
		this.rateLimitDelay = 1000; // Minimum delay between API calls
		this.lastCallTime = 0;
		this.availableModels = [];
		this.activeRequests = new Map(); // Track active requests by revid for cancellation
		this.options = options;
	}

	/**
	* Fetch available models from Ollama server
	* @returns {Promise<Array>} List of available models
	*/
	async fetchModels() {
		try {
			const response = await fetch(`${this.serverUrl}/api/tags`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			this.availableModels = data.models || [];
			return this.availableModels;
		} catch (err) {
			console.error('Error fetching Ollama models:', err);
			throw err;
		}
	}

	/**
	* Test connection to Ollama server
	* @returns {Promise<boolean>} True if server is reachable
	*/
	async testConnection() {
		try {
			const response = await fetch(`${this.serverUrl}/api/version`, {
				method: 'GET'
			});
			return response.ok;
		} catch (err) {
			console.error('Ollama connection test failed:', err);
			return false;
		}
	}

	/**
	* Analyze an edit using Ollama AI
	* @param {Object} edit The edit object containing diff, title, user, comment, etc.
	* @returns {Promise<Object>} Analysis result with issues array and summary
	*/
	async analyzeEdit(edit) {
		if (!this.options.enableOllamaAI || !this.options.enableEditAnalysis) {
			return null;
		}

		if (!this.model) {
			console.error('No Ollama model selected');
			return null;
		}

		// Check cache
		const cacheKey = `${edit.revid}`;
		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey);
		}

		// Cancel any existing request for this edit
		if (this.activeRequests.has(cacheKey)) {
			this.activeRequests.get(cacheKey).abort();
			this.activeRequests.delete(cacheKey);
		}

		// Create abort controller for this request
		const abortController = new AbortController();
		this.activeRequests.set(cacheKey, abortController);

		// Rate limiting
		const now = Date.now();
		const timeSinceLastCall = now - this.lastCallTime;
		if (timeSinceLastCall < this.rateLimitDelay) {
			await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastCall));
		}

		// Check if request was cancelled during rate limit delay
		if (abortController.signal.aborted) {
			this.activeRequests.delete(cacheKey);
			return null;
		}

		try {
			const prompt = this.buildAnalysisPrompt(edit);
			const response = await this.callOllamaAI(prompt, abortController.signal);
			const analysis = this.parseOllamaResponse(response);

			// Cache the result
			this.cache.set(cacheKey, analysis);

			// Limit cache size
			if (this.cache.size > 100) {
				const firstKey = this.cache.keys().next().value;
				this.cache.delete(firstKey);
			}

			this.lastCallTime = Date.now();

			// Clean up active request
			this.activeRequests.delete(cacheKey);

			return analysis;
		} catch (err) {
			// Clean up active request
			this.activeRequests.delete(cacheKey);

			// If request was aborted, return null instead of error
			if (err.name === 'AbortError' || err.message?.includes('aborted')) {
				return null;
			}

			return {
				hasIssues: false,
				issues: [],
				summary: "Analysis failed",
				error: err.message
			};
		}
	}

	/**
	* Convert HTML diff to human-readable text format with context
	* @param {String} diffHTML The HTML diff from MediaWiki
	* @returns {String} Readable text representation
	*/
	convertDiffToReadable(diffHTML) {
		if (!diffHTML) return "No changes visible";

		// Create a temporary div to parse HTML
		const tempDiv = document.createElement('div');
		// Wrap in table since the diff HTML is just table rows
		tempDiv.innerHTML = `<table>${diffHTML}</table>`;

		let readableLines = [];
		let contextBuffer = []; // Buffer for context lines
		const MAX_CONTEXT = 2; // Number of context lines before/after changes

		// Get all table rows
		const rows = tempDiv.querySelectorAll('tr');

		const length = rows.length;
		for (let i = 0; i < length; i++) {
			const row = rows[i];

			// Skip line number rows
			if (row.querySelector('.diff-lineno')) {
				continue;
			}

			// Get the cells from both sides
			const marker = row.querySelector('.diff-marker');
			const leftCell = row.querySelector('.diff-side-deleted');
			const rightCell = row.querySelector('.diff-side-added');

			if (!leftCell || !rightCell) continue;

			// Check if this is a context line (unchanged on both sides)
			const isContext = leftCell.classList.contains('diff-context') &&
			rightCell.classList.contains('diff-context');

			if (isContext) {
				// Get the text content
				const contextText = this.cleanDiffText(leftCell);

				// Skip empty lines
				if (!contextText.trim() || contextText === '<br />') {
					continue;
				}

				// Add to context buffer
				contextBuffer.push(`  ${contextText}`);

				// Keep only last MAX_CONTEXT lines in buffer
				if (contextBuffer.length > MAX_CONTEXT) {
					contextBuffer.shift();
				}
			} else {
				// This is a change line
				// First, flush context buffer if we have any
				if (contextBuffer.length > 0) {
					// Add spacing if not first group
					if (readableLines.length > 0) {
						readableLines.push('');
					}
					readableLines.push(...contextBuffer);
					contextBuffer = [];
				}

				// Process the change
				const markerText = marker?.getAttribute('data-marker') || '';

				if (markerText === '−' || leftCell.classList.contains('diff-deletedline')) {
					// Deleted line
					const text = this.cleanDiffText(leftCell, true);
					if (text.trim() && text !== '<br />') {
						readableLines.push(`- ${text}`);
					}
				}

				if (markerText === '+' || rightCell.classList.contains('diff-addedline')) {
					// Added line
					const text = this.cleanDiffText(rightCell, true);
					if (text.trim() && text !== '<br />') {
						readableLines.push(`+ ${text}`);
					}
				}

				// Clear context buffer after changes (we'll start fresh)
				contextBuffer = [];

				// Look ahead for immediate context after this change
				let contextLinesAfter = 0;
				const count = Math.min(i + 1 + MAX_CONTEXT, rows.length);
				for (let j = i + 1; j < count; j++) {
					const nextRow = rows[j];
					const nextLeft = nextRow.querySelector('.diff-side-deleted');
					const nextRight = nextRow.querySelector('.diff-side-added');

					if (!nextLeft || !nextRight) continue;

					const isNextContext = nextLeft.classList.contains('diff-context') &&
					nextRight.classList.contains('diff-context');

					if (isNextContext) {
						const nextText = this.cleanDiffText(nextLeft);
						if (nextText.trim() && nextText !== '<br />') {
							readableLines.push(`  ${nextText}`);
							contextLinesAfter++;
						}
					} else {
						break; // Stop at next change
					}
				}

				// Skip the context lines we just added
				i += contextLinesAfter;
			}
		}

		// If no changes were found
		if (readableLines.length === 0) {
			return "No significant changes detected in diff";
		}

		// Limit output to prevent token explosion
		if (readableLines.length > 60) {
			const kept = readableLines.slice(0, 60);
			kept.push(`\n... (${readableLines.length - 60} more lines omitted)`);
			return kept.join('\n');
		}

		return readableLines.join('\n');
	}

	/**
	* Clean and extract text from a diff cell
	* @param {Element} cell The diff cell element
	* @param {Boolean} highlightChanges Whether to highlight ins/del tags
	* @returns {String} Clean text content
	*/
	cleanDiffText(cell, highlightChanges = false) {
		if (!cell) return '';

		const div = cell.querySelector('div');
		if (!div) {
			const text = cell.textContent || '';
			return text.trim();
		}

		const clone = div.cloneNode(true);

		if (highlightChanges) {
			// Highlight inline insertions
			const insElements = clone.querySelectorAll('ins');
			insElements.forEach(ins => {
				const text = ins.textContent || '';
				ins.replaceWith(`[[${text}]]`);
			});

			// Highlight inline deletions
			const delElements = clone.querySelectorAll('del');
			delElements.forEach(del => {
				const text = del.textContent || '';
				del.replaceWith(`~~${text}~~`);
			});
		} else {
			// For context lines, just remove the tags
			const insElements = clone.querySelectorAll('ins');
			insElements.forEach(ins => {
				ins.replaceWith(ins.textContent || '');
			});

			const delElements = clone.querySelectorAll('del');
			delElements.forEach(del => {
				del.replaceWith(del.textContent || '');
			});
		}

		// Get text and clean up
		let text = clone.textContent || clone.innerText || '';

		// Clean up excessive whitespace but preserve structure
		text = text.replace(/\s+/g, ' ').trim();

		// Limit line length
		if (text.length > 500) {
			text = text.substring(0, 500) + '...';
		}

		return text;
	}		/**
	* Build the prompt for AI analysis
	* @param {Object} edit The edit object
	* @returns {String} The prompt text
	*/
	buildAnalysisPrompt(edit) {
		return BuildAIAnalysisPrompt(edit, this.convertDiffToReadable.bind(this));
	}

	/**
	* Generate prompt for username analysis
	* @param {String} username The username to analyze
	* @param {String} pageTitle The page the user was editing
	* @returns {String} The prompt for username analysis
	*/
	buildUsernamePrompt(username, pageTitle) {
		return BuildAIUsernamePrompt(username, pageTitle);
	}

	/**
	* Call Ollama AI API
	* @param {String} prompt The prompt to send
	* @param {AbortSignal} signal Optional abort signal for cancellation
	* @returns {Promise<String>} The AI response text
	*/
	async callOllamaAI(prompt, signal = null) {
		try {
			const fetchOptions = {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: this.model,
					prompt: prompt,
					format: { // json schema for response
						"type": "object",
						"properties": {
							"hasIssues": {
								"type": "boolean"
							},
							"probability": {
								"type": "number",
								"minimum": 0,
								"maximum": 100
							},
							"confidence": {
								"type": "string",
								"enum": ["high", "medium", "low"]
							},
							"reasoning": {
								"type": "string"
							},
							"issues": {
								"type": "array",
								"items": {
									"type": "object",
									"properties": {
										"type": {
											"type": "string",
											"enum": ["vandalism", "spam", "pov", "unsourced", "attack", "copyright", "disruptive", "factual-error", "policy", "username"]
										},
										"severity": {
											"type": "string",
											"enum": ["critical", "major", "minor"]
										},
										"description": {
											"type": "string"
										}
									},
									"required": ["type", "severity", "description"]
								}
							},
							"constructive": {
								"type": "boolean"
							},
							"flagUsername": {
								"type": "boolean"
							},
							"summary": {
								"type": "string"
							},
							"action": {
								"type": "string",
								"enum": ["approve", "thank", "review", "warn", "warn-and-revert", "rollback", "report-aiv", "welcome"]
							},
							"recommendation": {
								"type": "string"
							}
						},
						"required": ["hasIssues", "probability", "confidence", "reasoning", "issues", "constructive", "summary", "action", "recommendation"]
					},
					stream: false,
					options: {
						temperature: 0.1,
						top_p: 0.9,
						num_predict: 1024
					}
				})
			};

			// Add abort signal if provided
			if (signal) {
				fetchOptions.signal = signal;
			}

			const response = await fetch(`${this.serverUrl}/api/generate`, fetchOptions).catch(err => {
				if (err.name === 'AbortError') {
					throw err; // Rethrow abort errors
				}
				throw new Error(`Ollama API fetch error: ${err.message}`);
			});

			if (!response.ok) {
				throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();

			if (!data.response) {
				throw new Error('Empty response from Ollama');
			}

			return data.response;
		} catch (error) {
			throw error;
		}
	}

	/**
	* Parse the Ollama API response
	* @param {String|Object} responseText The response from Ollama AI
	* @returns {Object} Parsed analysis object
	*/
	parseOllamaResponse(responseText) {
		try {
			// Handle if responseText is an object (shouldn't happen but just in case)
			if (typeof responseText === 'object' && responseText !== null) {
				if (responseText.content) {
					responseText = responseText.content;
				} else {
					responseText = JSON.stringify(responseText);
				}
			}

			// Ensure responseText is a string
			if (typeof responseText !== 'string') {
				responseText = String(responseText);
			}

			// Try to extract JSON from markdown code blocks if present
			let jsonText = responseText.trim();
			const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
			if (jsonMatch) {
				jsonText = jsonMatch[1];
			} else {
				// Try to find JSON object - be more aggressive about finding the complete object
				// Match opening brace to closing brace, handling nested objects/arrays
				const startIdx = jsonText.indexOf('{');
				if (startIdx !== -1) {
					let depth = 0;
					let inString = false;
					let escapeNext = false;
					let foundComplete = false;

					const length = jsonText.length;
					for (let i = startIdx; i < length; i++) {
						const char = jsonText[i];

						if (escapeNext) {
							escapeNext = false;
							continue;
						}

						if (char === '\\') {
							escapeNext = true;
							continue;
						}

						if (char === '"') {
							inString = !inString;
							continue;
						}

						if (inString) continue;

						if (char === '{' || char === '[') depth++;
						if (char === '}' || char === ']') depth--;

						if (depth === 0 && i > startIdx) {
							jsonText = jsonText.substring(startIdx, i + 1);
							foundComplete = true;
							break;
						}
					}

					// If we didn't find a complete JSON object, try to fix it
					if (!foundComplete) {
						jsonText = jsonText.substring(startIdx);
						// Count unclosed braces and brackets
						let openBraces = 0;
						let openBrackets = 0;
						inString = false;
						escapeNext = false;

						const length = jsonText.length;
						for (let i = 0; i < length; i++) {
							const char = jsonText[i];

							if (escapeNext) {
								escapeNext = false;
								continue;
							}

							if (char === '\\') {
								escapeNext = true;
								continue;
							}

							if (char === '"') {
								inString = !inString;
								continue;
							}

							if (inString) continue;

							if (char === '{') openBraces++;
							if (char === '}') openBraces--;
							if (char === '[') openBrackets++;
							if (char === ']') openBrackets--;
						}

						// Add missing closing brackets and braces
						while (openBrackets > 0) {
							jsonText += ']';
							openBrackets--;
						}
						while (openBraces > 0) {
							jsonText += '}';
							openBraces--;
						}
					}
				}
			}

			// Remove JavaScript-style comments that may be in the JSON
			// This handles both // single-line and /* multi-line */ comments
			jsonText = jsonText
			// Remove single-line comments (// ...) but not inside strings
			.split('\n')
			.map(line => {
				// Simple approach: remove // comments if not inside quotes
				let inString = false;
				let result = '';

				const length = line.length;
				for (let i = 0; i < length; i++) {
					if (line[i] === '"' && (i === 0 || line[i - 1] !== '\\')) {
						inString = !inString;
					}
					if (!inString && line[i] === '/' && line[i + 1] === '/') {
						break; // Stop processing this line
					}
					result += line[i];
				}
				return result;
			})
			.join('\n')
			// Remove multi-line comments /* ... */
			.replace(/\/\*[\s\S]*?\*\//g, '');

			const parsed = JSON.parse(jsonText);

			return {
				hasIssues: parsed.hasIssues || false,
				probability: parsed.probability || 0,
				confidence: parsed.confidence || 'low',
				reasoning: parsed.reasoning || '',
				issues: parsed.issues || [],
				constructive: parsed.constructive !== undefined ? parsed.constructive : true,
				summary: parsed.summary || 'No issues detected',
				action: parsed.action || 'review',
				recommendation: parsed.recommendation || 'No specific recommendation',
				rawResponse: responseText
			};
		} catch (err) {
			console.error("Failed to parse Ollama response:", err);

			// Ensure responseText is a string for fallback processing
			const textStr = String(responseText);

			// Fallback: try to determine if there are issues from the text
			const hasIssues = textStr.toLowerCase().includes('issue') ||
			textStr.toLowerCase().includes('problem') ||
			textStr.toLowerCase().includes('vandalism');

			return {
				hasIssues: hasIssues,
				probability: hasIssues ? 50 : 10,
				confidence: 'low',
				issues: [],
				summary: hasIssues ? 'Potential issues detected (parsing failed)' : 'No clear issues detected',
				action: 'review',
				recommendation: 'Manual review recommended due to parsing error',
				rawResponse: responseText,
				parseError: err.message
			};
		}
	}

	/**
	* Analyze a username to determine if it violates Wikipedia's username policy
	* @param {String} username The username to analyze
	* @param {String} pageTitle The page the user was editing
	* @returns {Promise<Object>} Analysis result with shouldFlag, confidence, and reasoning
	*/
	async analyzeUsername(username, pageTitle) {
		if (!this.options.enableOllamaAI || !this.options.enableEditAnalysis) {
			return null;
		}

		try {
			// Build the username analysis prompt
			const prompt = this.buildUsernamePrompt(username, pageTitle);

			// Create abort controller for this request
			const controller = new AbortController();
			const cacheKey = `username:${username}`;
			this.activeRequests.set(cacheKey, controller);

			try {
				// Call Ollama AI with username-specific format
				const response = await fetch(`${this.serverUrl}/api/generate`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						model: this.model,
						prompt: prompt,
						format: {
							"type": "object",
							"properties": {
								"shouldFlag": {
									"type": "boolean"
								},
								"confidence": {
									"type": "number",
									"minimum": 0,
									"maximum": 1
								},
								"violationType": {
									"type": "string",
									"enum": ["promotional", "impersonation", "offensive", "confusing", "shared", "none"]
								},
								"reasoning": {
									"type": "string"
								},
								"recommendation": {
									"type": "string"
								}
							},
							"required": ["shouldFlag", "confidence", "violationType", "reasoning", "recommendation"]
						},
						stream: false,
						options: {
							temperature: 0.1,
							top_p: 0.9,
							num_predict: 512
						}
					}),
					signal: controller.signal
				}).catch(err => {
					if (err.name === 'AbortError') {
						throw err; // Rethrow abort errors
					}
					throw new Error(`Ollama API fetch error: ${err.message}`);
				});

				if (!response.ok) {
					throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
				}

				const data = await response.json();

				if (!data.response) {
					throw new Error('Empty response from Ollama');
				}

				// Parse the response
				const parsed = JSON.parse(data.response);

				return {
					shouldFlag: parsed.shouldFlag || false,
					confidence: parsed.confidence || 0,
					violationType: parsed.violationType || 'none',
					reasoning: parsed.reasoning || '',
					recommendation: parsed.recommendation || ''
				};
			} finally {
				this.activeRequests.delete(cacheKey);
			}
		} catch (error) {
			// If the analysis was aborted (e.g., user cleared queue), don't log as error
			if (error.name === 'AbortError') {
				return {
					shouldFlag: false,
					confidence: 0,
					violationType: 'none',
					reasoning: 'Analysis cancelled',
					recommendation: '',
					cancelled: true
				};
			}

			return {
				shouldFlag: false,
				confidence: 0,
				violationType: 'none',
				reasoning: `Error analyzing username: ${error.message}`,
				recommendation: 'Manual review recommended due to analysis error',
				error: error.message
			};
		}
	}

	/**
	* Clear the analysis cache
	*/
	clearCache() {
		this.cache.clear();
	}

	/**
	* Cancel a specific edit analysis request
	* @param {String|Number} revid The revision ID to cancel
	*/
	cancelAnalysis(revid) {
		const cacheKey = `${revid}`;
		if (this.activeRequests.has(cacheKey)) {
			this.activeRequests.get(cacheKey).abort();
			this.activeRequests.delete(cacheKey);
		}
	}

	/**
	* Cancel all active analysis requests
	*/
	cancelAllAnalyses() {
		for (const [, controller] of this.activeRequests.entries()) {
			controller.abort();
		}
		this.activeRequests.clear();
	}
}
