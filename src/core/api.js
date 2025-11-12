/**
 * WikiShieldAPI - MediaWiki API wrapper
 * Provides methods for interacting with the Wikipedia/MediaWiki API
 */
export class WikiShieldAPI {
	constructor(wikishield, api, options = {}) {
		this.wikishield = wikishield;
		this.api = api;
		this.testingMode = options.testingMode || false;
		this.logger = options.logger;
		this.util = options.util;
		this.historyCount = options.historyCount || 10;
	}

	/**
	 * Edit the given page with the given content and summary
	 * @param {String} title The title of the page to edit
	 * @param {String} content The content to edit the page with
	 * @param {String} summary The edit summary
	 * @param {Object} params Any additional parameters to pass to the API
	 * @returns {Promise<Boolean>}
	 */
	async edit(title, content, summary, params = {}) {
		if (this.testingMode) {
			console.log("Edit", { title, content, summary });
			return true;
		}

		try {
			await this.api.postWithEditToken(Object.assign({}, {
				"action": "edit",
				"title": title,
				"text": content,
				"summary": summary,
				"format": "json",
				"tags": "WikiShield script"
			}, params));

			return true;
		} catch (err) {
			this.logger?.log(`Could not edit page ${title}: ${err}`);
			return false;
		}
	}

		/**
		 * Edit a page to append text
		 * @param {String} title The title of the page to edit
		 * @param {String} content Content to append to the page
		 * @param {String} summary Edit summary to use
		 * @returns {Promise<Boolean>}
		 */
		async appendText(title, content, summary) {
			if (this.testingMode) {
				console.log("Append text", { title, content, summary });
				return true;
			}

			try {
				await this.api.postWithEditToken({
					"action": "edit",
					"title": title,
					"appendtext": "\n" + content,
					"summary": summary,
					"format": "json",
					"tags": "WikiShield script"
				});

				return true;
			} catch (err) {
				console.log(`Could not append text to page ${title}: ${err}`);
				return false;
			}
		}

		/**
		 * Get the content of the given pages
		 * @param {String} titles The titles of the pages to get, separated by "|"
		 * @returns {Promise<Object>} The content of the pages
		 */
		async getText(titles) {
			if (titles === "") {
				return;
			}

			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "revisions",
					"titles": titles,
					"rvprop": "content",
					"rvslots": "*",
					"format": "json",
					"formatversion": 2
				});

				const pages = response.query.pages.map(page => {
					return [page.title, page.missing ? "" : page.revisions[0].slots.main.content];
				});

				return pages
					.reduce((a, v) => ({ ...a, [v[0]]: v[1] }), {});
			} catch (err) {
				this.logger?.log(`Could not fetch page ${titles}: ${err}`);
			}
		}

		/**
		 * Get the content of a single page
		 * @param {String} title
		 * @returns {Promise<String>} The page content
		 */
		async getSinglePageContent(title) {
			try {
				const data = await this.getText(title);
				return data[title];
			} catch (err) {
				console.log("Could not fetch page", err);
			}
		}

		/**
		 * Check if a page exists
		 * @param {String} title The title of the page to check
		 * @returns {Promise<Boolean>} Whether the page exists
		 */
		async pageExists(title) {
			try {
				const response = await this.api.get({
					"action": "query",
					"titles": title,
					"format": "json",
					"formatversion": 2
				});

				return response.query.pages[0].missing !== true;
			} catch (err) {
				this.logger?.log(`Could not check if page ${title} exists: ${err}`);
				return false;
			}
		}

		/**
		 * Get the content of the given revision id
		 * @param {Number} revid The revision id to get
		 * @returns {Promise<String>} The content of the revision
		 */
		async getTextByRevid(revid) {
			if (revids === "") {
				return;
			}

			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "revisions",
					"revids": revid,
					"rvprop": "content",
					"rvslots": "*",
					"format": "json",
					"formatversion": 2
				});

				const page = response.query.pages[0];
				return page.missing ? "" : page.revisions[0].slots.main.content;
			} catch (err) {
				this.logger?.log(`Could not fetch page with revid ${revid}: ${err}`);
			}
		}

		/**
		 * Get full revision data by revision ID
		 * @param {Number} revid The revision ID
		 * @returns {Promise<Object>} Revision data including user, comment, timestamp, size
		 */
		async getRevisionData(revid) {
			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "revisions",
					"revids": revid,
					"rvprop": "ids|user|comment|timestamp|size",
					"format": "json",
					"formatversion": 2
				});

				const page = response.query.pages[0];
				if (page.missing || !page.revisions || page.revisions.length === 0) {
					return null;
				}

				const rev = page.revisions[0];
				return {
					revid: rev.revid,
					parentid: rev.parentid,
					user: rev.user,
					comment: rev.comment || "",
					timestamp: rev.timestamp,
					size: rev.size,
					oldlen: rev.parentid ? null : 0  // Will need to fetch parent for actual oldlen
				};
			} catch (err) {
				this.logger?.log(`Could not fetch revision data for revid ${revid}: ${err}`);
				return null;
			}
		}

		/**
		 * Get the difference between two revisions of the given page
		 * @param {String} title The title of the page
		 * @param {Number} old_revid The old revision ID
		 * @param {Number} revid The new revision ID
		 * @returns {Promise<String>} The difference between the two revisions, in HTML format
		 */
		async diff(title, old_revid, revid) {
			try {
				const response = await this.api.get({
					"action": "compare",
					"fromrev": old_revid,
					"torev": revid,
					"prop": "diff",
					"format": "json",
					"formatversion": 2
				});

				return response.compare.body;
			} catch (err) {
				this.logger?.log(`Could not fetch diff for page ${title}: ${err}`);
			}
		}

		/**
		 * Get the number of reverts
		 * @param {String} title The title of the page
		 * @param {String} user The username to check for reverts
		 */
		async countReverts(title, user) {
			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "revisions",
					"titles": title,
					"rvstart": this.util?.utcString(new Date(Date.now() - 8.64e+7)),
					"rvdir": "newer",
					"rvuser": user,
					"rvprop": "timestamp|tags",
					"rvlimit": "max",
					"format": "json",
					"formatversion": 2
				});

				const revisions = response.query.pages[0].revisions;
				if (revisions === undefined) {
					return 0;
				}

				return revisions.filter(revision => revision.tags.some(tag => tag === "mw-undo" || tag === "mw-rollback" || tag === "mw-manual-revert")).length;
			} catch (err) {
				this.logger?.log(`Could not fetch revert count for page ${title}: ${err}`);
			}
		}

		/**
		 * Get the categories of the revision
		 * @param {Number} revid The revision ID
		 * @returns {Promise<Object>} The categories object
		 */
		async categories(revid) {
			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "categories",
					"revids": revid,
					"cllimit": "max",
					"format": "json",
					"formatversion": 2
				});

				return response.query.pages[0].categories;
			} catch (err) {
				this.logger?.log(`Could not fetch categories for revision ${revid}: ${err}`);
			}
		}

		/**
		 * Counts consecutive edits by the latest editor using the MediaWiki API.
		 * @param {string} page - Page title to analyze.
		 * @param {object} api - MediaWiki API object with a `.get()` method.
		 * @returns {object} Result containing count, totalSizediff, oldestTimestamp, oldestRev, priorRev (or 'created').
		 */
		async consecutive(page, user) {
			let consecutiveCount = 0;
			let totalSizediff = 0;
			let newestRevision = null;
			let oldestTimestamp = null;
			let oldestRevision = null;
			let priorRevision = null;
			let latestEditor = user;
			let continueObj = {};
			let foundEnd = false;

			while (!foundEnd) {
				// Fetch 10 revisions at a time
				const response = await this.api.get({
					action: "query",
					prop: "revisions",
					titles: page,
					rvprop: "ids|timestamp|user|size",
					rvlimit: 10,
					format: "json",
					formatversion: 2,
					...continueObj
				});
				const revisions = response.query.pages[0].revisions;

				for (let i = 0; i < revisions.length; i++) {
					const rev = revisions[i];
					if (rev.user === latestEditor) {
						if (newestRevision === null) {
							newestRevision = rev;
						}

						consecutiveCount++;
						oldestTimestamp = rev.timestamp;
						oldestRevision = rev;

						let sizediff;
						if (i + 1 < revisions.length) {
							sizediff = rev.size - revisions[i + 1].size;
						} else if (!response.continue) {
							sizediff = rev.size;
						} else {
							sizediff = null;
						}

						if (sizediff !== null) totalSizediff += sizediff;
					} else {
						// Streak broke, set priorRevision
						priorRevision = rev;
						foundEnd = true;
						break;
					}
				}

				if (!foundEnd && response.continue) {
					continueObj = response.continue;
				} else if (!foundEnd) {
					priorRevision = "created";
					foundEnd = true;
				}
			}

			if (newestRevision === null) {
				priorRevision = "outdated";
			}

			// Return results
			return {
				count: consecutiveCount,
				totalSizediff: totalSizediff,
				newestRevision: newestRevision,
				oldestTimestamp: oldestTimestamp,
				oldestRev: oldestRevision,
				priorRev: priorRevision,
				diff: typeof priorRevision === "string" ? null : await this.diff(page, priorRevision.revid, newestRevision.revid)
			};
		}

		/**
		 * Get the contributions of the given user
		 * @param {String} user The user to get contributions for
		 * @returns {Promise<Array>} The contributions
		 */
		async contribs(user) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "usercontribs",
					"ucuser": user,
					"uclimit": 10,
					"ucprop": "title|ids|timestamp|comment|flags|sizediff|tags",
					"format": "json",
					"formatversion": 2
				});

				return response.query.usercontribs;
			} catch (err) {
				this.logger?.log(`Could not fetch contributions for user ${user}: ${err}`);
			}
		}

		/**
		 * Get the edit count of the given users
		 * @param {String} users The users to get edit counts for, separated by "|"
		 * @returns {Promise<Array>} The edit counts
		 */
		async editCount(users) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "users",
					"ususers": users,
					"usprop": "editcount",
					"format": "json",
					"formatversion": 2
				});

				return response.query.users;
			} catch (err) {
				this.logger?.log(`Could not fetch edit count for users ${users}: ${err}`);
			}
		}

		/**
		 * Get the filter log of the given user
		 * @param {String} user The user to get the filter log for
		 * @returns {Promise<Array>} The filter log
		 */
		async filterLog(user) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "logevents",
					"letype": "filter",
					"leuser": user,
					"lelimit": 50,
					"format": "json",
					"formatversion": 2
				});

				return response.query.logevents;
			} catch (err) {
				this.logger?.log(`Could not fetch filter log for user ${user}: ${err}`);
			}
		}

		/**
		 * Get the number of times a user has been blocked
		 * @param {String} user The username to check
		 * @returns {Promise<Number>} The number of blocks
		 */
		async getBlockCount(user) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "logevents",
					"letype": "block",
					"letitle": `User:${user}`,
					"leaction": "block/block",
					"lelimit": "max",
					"format": "json",
					"formatversion": 2
				});

				return response.query.logevents ? response.query.logevents.length : 0;
			} catch (err) {
				console.log(`Could not fetch block count for user ${user}:`, err);
				return 0;
			}
		}

		/**
		 * Get detailed block history for a user
		 * @param {String} user The username
		 * @returns {Promise<Array>} Array of block log entries
		 */
		async getBlockHistory(user) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "logevents",
					"letype": "block",
					"letitle": `User:${user}`,
					"leaction": "block/block",
					"lelimit": 10,
					"leprop": "user|timestamp|comment|details",
					"format": "json",
					"formatversion": 2
				});

				return response.query.logevents || [];
			} catch (err) {
				console.log(`Could not fetch block history for user ${user}:`, err);
				return [];
			}
		}

		/**
		 * Get the history of the given page
		 * @param {String} page The page to get the history for
		 * @returns {Promise<Array>} The history
		 */
		async history(page) {
			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "revisions",
					"titles": page,
					"rvprop": "title|ids|timestamp|comment|flags|sizediff|user|tags|size",
					"rvlimit": 11,
					"format": "json",
					"formatversion": 2
				});

				const revisions = response.query.pages[0].revisions;

				const count = Math.min(this.historyCount, revisions.length);
				for (let i = 0; i < count; i++) {
					if (i + 1 < revisions.length) {
						revisions[i].sizediff = revisions[i].size - revisions[i + 1].size;
					} else {
						revisions[i].sizediff = revisions[i].size;
					}
				}

				return revisions.splice(0, this.historyCount);
			} catch (err) {
				this.logger?.log(`Could not fetch history for page ${page}: ${err}`);
			}
		}

		/**
		 * Get page protection information
		 * @param {String} page The page title
		 * @returns {Promise<Object>} Protection info with level and type
		 */
		async getPageProtection(page) {
			try {
				const response = await this.api.get({
					"action": "query",
					"titles": page,
					"prop": "info",
					"inprop": "protection",
					"format": "json",
					"formatversion": 2
				});

				const pageData = response.query.pages[0];
				if (pageData && pageData.protection && pageData.protection.length > 0) {
					// Get the highest protection level
					const protections = pageData.protection;
					let highestLevel = null;
					let types = [];

					for (const prot of protections) {
						types.push(prot.type);
						if (prot.level === "sysop") {
							highestLevel = "full";
						} else if (prot.level === "autoconfirmed" && highestLevel !== "full") {
							highestLevel = "semi";
						} else if (prot.level === "extendedconfirmed" && highestLevel !== "full") {
							highestLevel = "extended";
						}
					}

					return {
						protected: true,
						level: highestLevel,
						types: types
					};
				}

				return { protected: false };
			} catch (err) {
				console.log(`Could not fetch protection info for ${page}:`, err);
				return { protected: false };
			}
		}

		/**
		 * Get latest revision IDs for multiple pages
		 * @param {String} pages Pipe-separated list of page titles
		 * @returns {Promise<Object>} Object mapping page titles to latest revision IDs
		 */
		async getLatestRevisions(pages) {
			try {
				// Split pages string into array
				const pageArray = pages.split("|");

				const result = {};

				// Make individual requests for each page to avoid API parameter issues
				for (const page of pageArray) {
					try {
						const response = await this.api.get({
							"action": "query",
							"titles": page,
							"prop": "revisions",
							"rvprop": "ids",
							"rvlimit": 1,
							"format": "json"
						});

						if (response.query && response.query.pages) {
							for (const pageId in response.query.pages) {
								const pageData = response.query.pages[pageId];
								if (pageData.revisions && pageData.revisions.length > 0 && pageData.title) {
									result[pageData.title] = pageData.revisions[0].revid;
								}
							}
						}
					} catch (pageErr) {
						// Skip pages that fail individually
						console.log(`Failed to fetch revision for ${page}: ${pageErr}`);
					}
				}

				return result;
			} catch (err) {
				this.logger?.log(`Could not fetch latest revisions: ${err}`);
				return {};
			}
		}

		/**
		 * Get page metadata including date format and English variant
		 * @param {String} page The page title
		 * @returns {Promise<Object>} Object with dateFormat and englishVariant, plus any other detected templates
		 */
		async getPageMetadata(page) {
			try {
				// Get the page content to check for templates
				const contentResponse = await this.api.get({
					"action": "parse",
					"page": page,
					"prop": "wikitext",
					"format": "json",
					"formatversion": 2
				});

				const wikitext = contentResponse.parse ? contentResponse.parse.wikitext : "";

				// Define template patterns to search for
				const templatePatterns = {
					dateFormat: {
						patterns: [
							{ regex: /\{\{Use dmy dates/i, value: "dmy (day-month-year)" },
							{ regex: /\{\{Use mdy dates/i, value: "mdy (month-day-year)" },
							{ regex: /\{\{Use ymd dates/i, value: "ymd (year-month-day)" },
							{ regex: /\{\{Use dMy dates/i, value: "dMy (day Month year)" }
						],
						default: "Unknown"
					},
					englishVariant: {
						patterns: [
							{ regex: /\{\{Use British English/i, value: "British English" },
							{ regex: /\{\{Use American English/i, value: "American English" },
							{ regex: /\{\{Use Canadian English/i, value: "Canadian English" },
							{ regex: /\{\{Use Australian English/i, value: "Australian English" },
							{ regex: /\{\{Use New Zealand English/i, value: "New Zealand English" },
							{ regex: /\{\{Use Irish English/i, value: "Irish English" },
							{ regex: /\{\{Use South African English/i, value: "South African English" },
							{ regex: /\{\{Use Indian English/i, value: "Indian English" },
							{ regex: /\{\{Use Hong Kong English/i, value: "Hong Kong English" },
							{ regex: /\{\{Use Singapore English/i, value: "Singapore English" }
						],
						default: "Unknown"
					}
				};

				// Function to find matching template
				const findMatch = (patterns, text) => {
					for (const pattern of patterns) {
						if (pattern.regex.test(text)) {
							return pattern.value;
						}
					}
					return null;
				};

				// Build result object dynamically
				const result = {};

				for (const [key, config] of Object.entries(templatePatterns)) {
					const match = findMatch(config.patterns, wikitext);
					result[key] = match || config.default;
				}

				// Extract any other "Use" templates generically
				const otherUseTemplates = [];
				const useTemplateRegex = /\{\{Use ([^}|]+)(?:\|[^}]*)?\}\}/gi;
				let match;

				while ((match = useTemplateRegex.exec(wikitext)) !== null) {
					const templateName = match[1].trim();
					// Skip templates we've already categorized
					const alreadyCategorized = Object.values(templatePatterns)
						.flatMap(config => config.patterns)
						.some(pattern => pattern.regex.test(match[0]));

					if (!alreadyCategorized) {
						otherUseTemplates.push(templateName);
					}
				}

				if (otherUseTemplates.length > 0) {
					result.otherTemplates = otherUseTemplates;
				}

				return result;
			} catch (err) {
				this.logger?.log(`Could not fetch metadata for page ${page}: ${err}`);
				return { dateFormat: "Unknown", englishVariant: "Unknown" };
			}
		}

		/**
		 * Get recent edits to Wikipedia
		 * @param {String} namespaces The namespaces to get recent changes for, separated by "|"
		 * @param {String} since The timestamp to start from
		 * @returns {Promise<Array>} The recent changes
		 */
		async recentChanges(namespaces, since) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "recentchanges",
					"rcnamespace": namespaces,
					"rclimit": 50,
					"rcprop": "title|ids|sizes|flags|user|tags|comment|timestamp",
					"rctype": "edit",
					"format": "json",
					"rcstart": since || "",
					"rcdir": since ? "newer" : "older"
				});

				return response.query.recentchanges;
			} catch (err) {
				this.logger?.log(`Could not fetch recent changes: ${err}`);
			}
		}

		/**
		 * Get your watchlist from Wikipedia
		 * @param {String} since The timestamp to start from
		 * @returns {Promise<Array>} The watchlist
		 */
		async watchlist(since) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "watchlist",
					"wlnamespace": "*",
					"allrev": true,
					"wllimit": 25,
					"wlprop": "title|ids|sizes|flags|user|tags|comment|timestamp",
					"wltype": "edit",
					"format": "json",
					"wlstart": since || "",
					"wldir": since ? "newer" : "older",
					"wlexcludeuser": this.wikishield.username
				});

				return response.query.watchlist;
			} catch (err) {
				this.logger?.log(`Could not fetch watchlist: ${err}`);
			}
		}

		/**
		 * Get the ORES scores for the given revisions
		 * @param {String} revids The revision IDs to get ORES scores for, separated by "|"
		 * @returns {Promise<Object>} The ORES scores
		 */
		async ores(revids) {
			if (revids === "") {
				return;
			}

			try {
				const response = await this.api.get({
					"action": "query",
					"format": "json",
					"formatversion": 2,
					"prop": "revisions",
					"revids": revids,
					"rvprop": "oresscores|ids",
					"rvslots": "*"
				});

				const scores = response.query.pages.map(page => {
					return "goodfaith" in page.revisions[0].oresscores ? [
						page.revisions[0].revid,
						page.revisions[0].oresscores.goodfaith.false
					] : [page.revisions[0].revid, 0];
				});

				return scores
					.reduce((a, v) => ({ ...a, [v[0]]: v[1] }), {});
			} catch (err) {
				this.logger?.log(`Could not fetch ORES scores for revision ${revids}: ${err}`);
			}
		}

		/**
		 * Check if the given users are blocked
		 * @param {String} users The users to get blocks for, separated by "|"
		 * @returns {Promise<Object>} The blocks
		 */
		async usersBlocked(users) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "blocks",
					"bkusers": users,
					"bkprop": "id|user|by|timestamp|expiry|reason",
					"format": "json",
					"formatversion": 2
				});

				const blocks = {};
				users.split("|").forEach(user => blocks[user] = false);
				response.query.blocks.forEach(block => blocks[block.user] = !block.partial);
				return blocks;
			} catch (err) {
				this.logger?.log(`Could not fetch blocks for users ${users}: ${err}`);
			}
		}

		/**
		 * Rollback the user's edits
		 * @param {String} title The title of the page to rollback
		 * @param {String} user The user to rollback
		 * @param {String} summary The summary to use for the rollback
		 * @returns {Promise<Boolean>} Whether the rollback was successful
		 */
		async rollback(title, user, summary) {
			if (this.testingMode) {
				console.log("Rollback", { title, user, summary });
				return true;
			}

			try {
				await this.api.rollback(title, user, {
					"summary": summary,
					"tags": "WikiShield script"
				});

				return true;
			} catch (err) {
				console.log(err);
				return false;
			}
		}

		/**
		 * Undo a single edit
		 * @param {Object} edit The edit object to undo
		 * @param {String} reason The reason for undoing
		 * @returns {Promise<Boolean>} Whether the undo was successful
		 */
		async undoEdit(edit, reason) {
			if (this.testingMode) {
				console.log("Undo", { edit, reason });
				return true;
			}

			try {
				// Get the revision ID to undo and the previous revision
				const revid = edit.revid;
				const title = edit.page.title;

				// Use the MediaWiki API to undo the edit
				await this.api.postWithToken("csrf", {
					"action": "edit",
					"title": title,
					"undo": revid,
					"summary": reason,
					"tags": "WikiShield script"
				});

				return true;
			} catch (err) {
				console.log("Error undoing edit:", err);
				return false;
			}
		}

		/**
		 * Block a user with the given details
		 * @param {String} user User to block
		 * @param {String} summary Reason to use when blocking
		 * @param {String} duration Length of time to block the user
		 * @param {Boolean} blockCreation Prevent user from creating accounts when blocked
		 * @param {Boolean} blockEmail Prevent user from sending emails
		 * @param {Boolean} blockTalk Prevent user from editing their own talk page
		 * @param {Boolean} anonOnly
		 * @returns {Promise<Boolean>} Whether the block was successful
		 */
		async block(user, summary, duration, blockCreation = false, blockEmail = false, blockTalk = false, anonOnly = true) {
			if (this.testingMode) {
				console.log("Block", { user, summary, duration });
				return true;
			}

			try {
				await this.api.postWithToken("csrf", Object.assign(
					{
						"action": "block",
						"user": user,
						"expiry": duration,
						"reason": summary,
						"tags": "WikiShield script"
					},
					blockCreation ? { "nocreate": "" } : {},
					blockEmail ? { "noemail": "" } : {},
					blockTalk ? {} : { "allowusertalk": "" },
					anonOnly ? { "anononly": "" } : {}
				));

				return true;
			} catch (err) {
				console.log(err);
				return false;
			}
		}

		/**
		 * Thank a user for the given edit
		 * @param {Number} revid
		 * @returns {Promise<Boolean>} Whether the action was successful
		 */
		async thank(revid) {
			if (this.testingMode) {
				console.log("Thank", { revid });
				return true;
			}

			try {
				await this.api.postWithToken("csrf", {
					"action": "thank",
					"rev": revid
				});

				return true;
			} catch (err) {
				console.log(err);
				return false;
			}
		}

		/**
		 * Get level and expiry of edit and move protections for a page
		 * @param {String} page Name of the page to get details for
		 * @returns {Promise<Object>} The details of the protection
		 */
		async getProtectionDetails(page) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "logevents",
					"letype": "protect",
					"letitle": page,
					"lelimit": 1
				});

				const details = {
					edit: "all", editExpiry: "infinite",
					move: "all", moveExpiry: "infinite"
				};

				if (Object.keys(response).includes("params") && Object.keys(response.params).includes("details")) {
					for (const item of response.params.details) {
						if (item.type === "edit") {
							details.edit = item.level;
							details.editExpiry = item.expiry;
						}

						if (item.type === "move") {
							details.move = item.level;
							details.moveExpiry = item.expiry;
						}
					}
				}

				return details;
			} catch (err) {
				console.log(err);
			}
		}

		/**
		 * Protect a page with the given details
		 * @param {String} page Page to protect
		 * @param {String} summary Summary to use in protection
		 * @param {Object} details Levels and expiry of protection
		 * @returns {Promise<Boolean>} Whether the protection was successful
		 */
		async protect(page, summary, details) {
			if (this.testingMode) {
				console.log("Protect", { page, summary, details });
				return true;
			}

			try {
				await this.api.postWithToken("csrf", {
					"action": "protect",
					"title": page,
					"reason": summary,
					"protections": `edit=${details.edit}|move=${details.move}`,
					"expiry": `${details.editExpiry}|${details.moveExpiry}`,
					"tags": "WikiShield script"
				});

				return true;
			} catch (err) {
				console.log(err);
				return false;
			}
		}

		/**
		 * Make a GET request to the MediaWiki API
		 * @param {Object} params The parameters for the API request
		 * @returns {Promise<Object>} The API response
		 */
		async get(params) {
			return await this.api.get(params);
		}

		/**
		 * Make a POST request to the MediaWiki API with a token
		 * @param {String} tokenType The type of token to use
		 * @param {Object} params The parameters for the API request
		 * @returns {Promise<Object>} The API response
		 */
		async postWithToken(tokenType, params) {
			return await this.api.postWithToken(tokenType, params);
		}
	}
