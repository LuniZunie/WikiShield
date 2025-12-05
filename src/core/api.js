/**
* WikiShieldAPI - MediaWiki API wrapper
* Provides methods for interacting with the Wikipedia/MediaWiki API
*/

const serversWithTags = new Set([ "en.wikipedia.org" ]);
const __TAGS__ = serversWithTags.has(mw.config.get("wgServerName")) ? "WikiShield script" : "";

export const __pendingChangesServer__ = new Set([ "en.wikipedia.org", "de.wikipedia.org" ]);

class Memory {
	constructor(options = {}) {
		this.order = [ ];
		this.store = new Map();
		this.timeouts = new Map();

		this.timeout = options.timeout || 5 * 60 * 1000; // Default 5 minutes
		this.maxSize = options.size || 1000; // Default max 1000 items
	}

	clear() {
		this.store.clear();
		this.timeouts.clear();
	}

	has(key) {
		return this.store.has(key);
	}

	get(key) {
		return this.store.get(key);
	}

	set(key, value) {
		this.order.push(key);
		this.store.set(key, value);

		this.timeouts.set(key, setTimeout(() => { this.delete(key); }, this.timeout));

		if (this.store.size > this.maxSize) {
			const oldestKey = this.order.shift();
			this.delete(oldestKey);
		}
	}

	delete(key) {
		this.store.delete(key);

		clearTimeout(this.timeouts.get(key));
		this.timeouts.delete(key);
	}

	size() {
		return this.store.size;
	}
}

const CACHE = {
	diffs: new Memory(),
	revSize: new Memory(),
	revidToTitle: new Memory(),
	categories: new Memory(),
};

export class WikiShieldAPI {
	constructor(wikishield, api, options = {}) {
		this.wikishield = wikishield;
		this.api = api;
		this.cache = new Map();
		this.logger = options.logger;
		this.util = options.util;
		this.historyCount = options.historyCount || 10;
	}

	buildMessage(base, custom) {
		const watermark = " ([[:en:WP:WikiShield|WS]])";

		const message = `${base}${custom ? `: ${custom}` : ""}`;
		return `${this.wikishield.util.maxStringLength(message, 500 - watermark.length)}${watermark}`; // limit to 500 chars, watermark should always be included hehe
	}
	buildUser(username) {
		return `[[Special:Contribs/${username}|${username}]] ([[User talk:${username}|talk]])`;
	}

	async getMultipleRevisionsInfo(requests) {
		const username = mw.config.get("wgUserName");

		const titles = [ ...new Set(requests.map(r => r.edit.title)) ];
		const users = [ ...new Set(requests.map(r => r.edit.user)) ];
		const revids = [ ...new Set(requests.map(r => r.edit.revid)) ];

		const result = Array.from({ length: requests.length }, () => ({}));
		const promises = [ ];

		promises.push(this.editCount(users.join("|")).then(data => {
			requests.forEach((request, index) => {
				result[index].userEditCount = data[request.edit.user];
			});
		}));
		promises.push(this.pageExists(users.map(u => `User talk:${u}`).join("|")).then(data => {
			requests.forEach((request, index) => {
				result[index].userTalk = data[`User talk:${request.edit.user}`];
			});
		}));
		promises.push(this.isBlocked(users.join("|")).then(data => {
			requests.forEach((request, index) => {
				result[index].userBlocked = Boolean(data[request.edit.user]);
			});
		}));

		promises.push(this.categories(titles.join("|")).then(data => {
			requests.forEach((request, index) => {
				result[index].pageCategories = data[request.edit.title];
			});
		}));
		promises.push(this.getPageProtection(titles.join("|")).then(data => {
			requests.forEach((request, index) => {
				result[index].pageProtection = data[request.edit.title];
			});
		}));

		promises.push(this.ores(revids.join("|")).then(data => {
			requests.forEach((request, index) => {
				result[index].editOres = data[request.edit.revid] || 0;
			});
		}));

		for (const user of users) {
			promises.push(this.contribs(user).then(data => {
				requests.forEach((request, index) => {
					if (request.edit.user === user) {
						result[index].userContribs = data;
					}
				});
			}));
			promises.push(this.getBlocks(user).then(data => {
				requests.forEach((request, index) => {
					if (request.edit.user === user) {
						result[index].userBlocks = data;
					}
				});
			}));
		}

		for (const title of titles) {
			promises.push(this.countReverts(title, username).then(data => {
				requests.forEach((request, index) => {
					if (request.edit.title === title) {
						result[index].revertCount = data;
					}
				});
			}));

			promises.push(this.getPageMetadata(title).then(data => {
				requests.forEach((request, index) => {
					if (request.edit.title === title) {
						result[index].pageMetadata = data;
					}
				});
			}));
			promises.push(this.history(title).then(data => {
				requests.forEach((request, index) => {
					if (request.edit.title === title) {
						result[index].pageHistory = data;
					}
				});
			}));
		}

		const length = requests.length;
		for (let i = 0; i < length; i++) {
			const request = requests[i];
			promises.push(this.diff(request.edit.title, request.prevId, request.edit.revid).then(data => {
				result[i].editDiff = data;
			}));
		}

		await Promise.all(promises);

		return result;
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
		try {
			await this.api.postWithEditToken(Object.assign({}, {
				"action": "edit",
				"title": title,
				"text": content,
				"summary": summary,
				"format": "json",
				"tags": __TAGS__
			}, params));

			return true;
		} catch (err) {
			console.log(`Could not edit page ${title}: ${err}`);
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
		try {
			await this.api.postWithEditToken({
				"action": "edit",
				"title": title,
				"appendtext": "\n" + content,
				"summary": summary,
				"format": "json",
				"tags": __TAGS__
			});

			return true;
		} catch (err) {
			console.log(`Could not append text to page ${title}: ${err}`);
			return false;
		}
	}

	async newSection(title, sectionTitle, content, summary) {
		try {
			await this.api.postWithEditToken({
				"action": "edit",
				"title": title,
				"section": "new",
				"sectiontitle": sectionTitle,
				"text": content,
				"summary": summary,
				"format": "json",
				"tags": __TAGS__
			});

			return true;
		} catch (err) {
			console.log(`Could not create new section on page ${title}: ${err}`);
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

			return pages.reduce((a, v) => ({ ...a, [v[0]]: v[1] }), {});
		} catch (err) {
			console.log(`Could not fetch page ${titles}: ${err}`);
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
	* @param {String} titles The titles of the pages to check, separated by "|"
	* @returns {Promise<Boolean>} Whether the page exists
	*/
	async pageExists(titles) {
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
				return [page.title, page.missing ? false : page.revisions[0].slots.main.content];
			});

			return pages.reduce((a, v) => ({ ...a, [v[0]]: v[1] }), {});
		} catch (err) {
			console.log(`Could not check if page ${titles} exists: ${err}`);
			return false;
		}
	}

	/**
	* Get the content of the given revision id
	* @param {Number} revid The revision id to get
	* @returns {Promise<String>} The content of the revision
	*/
	async getTextByRevid(revid) {
		if (revid === "") {
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
			console.log(`Could not fetch page with revid ${revid}: ${err}`);
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
				"rvprop": "ids|user|comment|timestamp|size|tags|flags",
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
				oldlen: rev.parentid ? await this.getRevisionSize(rev.parentid) : 0,
				tags: rev.tags || [],
				minor: rev.minor || false
			};
		} catch (err) {
			console.log(`Could not fetch revision data for revid ${revid}: ${err}`);
			return null;
		}
	}

	async getRevisionSize(revid) {
		try {
			if (CACHE.revSize.has(revid)) {
				return CACHE.revSize.get(revid);
			}

			const response = await this.api.get({
				"action": "query",
				"prop": "revisions",
				"revids": revid,
				"rvprop": "size",
				"format": "json",
				"formatversion": 2
			});

			const page = response.query.pages[0];
			if (page.missing || !page.revisions || page.revisions.length === 0) {
				CACHE.revSize.set(revid, 0);
				return 0;
			}

			const size = page.revisions[0].size;
			CACHE.revSize.set(revid, size);
			return size;
		} catch (err) {
			console.log(`Could not fetch revision size for revid ${revid}: ${err}`);
			return 0;
		}
	}

	async getPageTitleFromRevid(revid) {
		try {
			if (CACHE.revidToTitle.has(revid)) {
				return CACHE.revidToTitle.get(revid);
			}

			const response = await this.api.get({
				"action": "query",
				"prop": "revisions",
				"revids": revid,
				"format": "json",
				"formatversion": 2
			});

			const title = response.query.pages[0].title;
			CACHE.revidToTitle.set(revid, title);
			return title;
		} catch (err) {
			console.log(`Could not fetch page title for revid ${revid}: ${err}`);
		}
	}

	/**
	* Get the difference between two revisions of the given page
	* @param {String} title The title of the page
	* @param {Number} old_revid The old revision ID
	* @param {Number} revid The new revision ID
	* @returns {Promise<String>} The difference between the two revisions, in HTML format
	*/
	async diff(title, old_revid, revid, difftype = "table") {
		try {
			const cacheKey = `${old_revid}-${revid}`;
			if (CACHE.diffs.has(cacheKey)) {
				return CACHE.diffs.get(cacheKey);
			}

			const params = {
				"action": "compare",
				"torev": revid,
				"prop": "diff",
				"format": "json",
				"difftype": difftype,
				"formatversion": 2
			};
			if (old_revid) {
				params.fromrev = old_revid;
			} else {
				params.fromslots = "main";
				params["fromtext-main"] = "";
			}

			const response = await this.api.get(params);

			const rtn = response.compare.body;
			CACHE.diffs.set(cacheKey, rtn);
			return rtn;
		} catch (err) {
			console.log(`Could not fetch diff for page ${title}: ${err}`);
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
			console.log(`Could not fetch revert count for page ${title}: ${err}`);
		}
	}

	/**
	* Get the categories of the title
	* @param {String} titles The titles to get categories for, separated by "|"
	* @returns {Promise<Object>} The categories object
	*/
	async categories(titles) {
		try {
			if (CACHE.categories.has(titles)) {
				return CACHE.categories.get(titles);
			}

			const response = await this.api.get({
				"action": "query",
				"prop": "categories",
				"titles": titles,
				"cllimit": "max",
				"format": "json",
				"formatversion": 2
			});

			const categories = response.query.pages.reduce((acc, page) => ({ ...acc, [page.title]: page.categories ? page.categories.map(cat => cat.title) : [] }), {});
			CACHE.categories.set(titles, categories);
			return categories;
		} catch (err) {
			console.log(`Could not fetch categories for revision ${titles}: ${err}`);
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
			} else if (!foundEnd) { // TODO remove "user created this page" icon
				priorRevision = 0; // Created
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
			console.log(`Could not fetch contributions for user ${user}: ${err}`);
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

			return response.query.users.reduce((acc, user) => ({ ...acc, [user.name]: user.editcount }), {});
		} catch (err) {
			console.log(`Could not fetch edit count for users ${users}: ${err}`);
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
			console.log(`Could not fetch filter log for user ${user}: ${err}`);
		}
	}

	/**
	* Get detailed block history for a user
	* @param {String} user The username
	* @returns {Promise<Array>} Array of block log entries
	*/
	async getBlocks(user) {
		try {
			const response = await this.api.get({
				"action": "query",
				"list": "logevents",
				"letype": "block",
				"letitle": `User:${user}`,
				"leaction": "block/block",
				"lelimit": "max",
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
				"rvprop": "title|ids|timestamp|comment|flags|user|tags|size",
				"rvlimit": 11,
				"format": "json",
				"formatversion": 2
			});

			const pageData = response.query.pages[0];
			const revisions = pageData.revisions;

			const count = Math.min(this.historyCount, revisions.length);
			for (let i = 0; i < count; i++) {
				revisions[i].ns = pageData.ns;
				revisions[i].pageid = pageData.pageid;
				revisions[i].title = pageData.title;

				if (i + 1 < revisions.length) {
					revisions[i].sizediff = revisions[i].size - revisions[i + 1].size;
				} else {
					revisions[i].sizediff = revisions[i].size;
				}
			}

			return revisions.splice(0, this.historyCount);
		} catch (err) {
			console.log(`Could not fetch history for page ${page}: ${err}`);
		}
	}

	/**
	* Get page protection information
	* @param {String} titles The page titles
	* @returns {Promise<Object>} Protection info with level and type
	*/
	async getPageProtection(titles) {
		try {
			const response = await this.api.get({
				"action": "query",
				"titles": titles,
				"prop": "info",
				"inprop": "protection",
				"format": "json",
				"formatversion": 2
			});

			return response.query.pages.reduce((acc, page) => {
				if (page.protection && page.protection.length > 0) {
					// Get the highest protection level
					const protections = page.protection;
					let highestLevel = null;
					let types = [];

					for (const prot of protections) {
						if (prot.type !== "edit") {
							continue;
						}

						if (prot.level === "sysop") {
							highestLevel = "full";
						} else if (prot.level === "autoconfirmed" && highestLevel !== "full") {
							highestLevel = "semi";
						} else if (prot.level === "extendedconfirmed" && highestLevel !== "full") {
							highestLevel = "extended";
						}
					}

					acc[page.title] = { protected: true, level: highestLevel };
				} else {
					acc[page.title] = { protected: false };
				}

				return acc;
			}, {});
		} catch (err) {
			console.log(`Could not fetch protection info for ${page}:`, err);
			return {};
		}
	}

	/**
	* Get latest revision IDs for multiple pages
	* @param {String} pages Pipe-separated list of page titles
	* @returns {Promise<Object>} Object mapping page titles to latest revision IDs
	*/
	async getLatestRevisions(pages) {
		try {
			if (!pages) return {};

			// Split pages string into trimmed array and remove empty entries
			const pageArray = pages.split("|").map(s => s.trim()).filter(Boolean);

			const result = {};
			const chunkSize = 50;
			const chunks = [];
			for (let i = 0; i < pageArray.length; i += chunkSize) {
				chunks.push(pageArray.slice(i, i + chunkSize));
			}

			// Fire all chunk requests in parallel and wait for completion
			const promises = chunks.map(chunk => {
				return this.api.get({
					"action": "query",
					"titles": chunk.join("|"),
					"prop": "revisions",
					"rvprop": "ids",
					"format": "json",
					"formatversion": 2
				});
			});

			const settled = await Promise.allSettled(promises);
			for (const res of settled) {
				if (res.status !== "fulfilled" || !res.value) {
					console.log(`Failed to fetch a revision chunk: ${res.status === "rejected" ? res.reason : "no response"}`);
					continue;
				}

				const response = res.value;
				if (response.query && response.query.pages) {
					for (const pageId in response.query.pages) {
						const pageData = response.query.pages[pageId];
						if (pageData && pageData.revisions && pageData.revisions.length > 0 && pageData.title) {
							result[pageData.title] = pageData.revisions[0].revid;
						}
					}
				}
			}

			return result;
		} catch (err) {
			console.log(`Could not fetch latest revisions: ${err}`);
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
			console.log(`Could not fetch metadata for page ${page}: ${err}`);
			return { dateFormat: "Unknown", englishVariant: "Unknown" };
		}
	}

	async parseWikitext(wikitext) {
		try {
			const response = await this.api.get({
				"action": "parse",
				"text": wikitext,
				"prop": "text",
				"format": "json",
				"formatversion": 2
			});
			return response.parse?.text || "";
		} catch (err) {
			console.log(`Could not parse wikitext: ${err}`);
			return "";
		}
	}

	/**
	* Get recent edits to Wikipedia
	* @param {String} namespaces The namespaces to get recent changes for, separated by "|"
	* @param {String} since The timestamp to start from
	* @returns {Promise<Array>} The recent changes
	*/
	async queueList(listType, namespaces, since, full = false) {
		const options = {
			get recent() {
				return {
					"action": "query",
					"list": "recentchanges",
					"rcnamespace": namespaces,
					"rclimit": 50,
					"rcprop": "title|ids|sizes|flags|user|tags|comment|timestamp",
					"rctype": "edit",
					"rctoponly": true,
					"format": "json",
					"rcstart": since || "",
					"rcdir": since ? "newer" : "older"
				};
			},
			get flagged() {
				return {
					"action": "query",
					"list": "oldreviewedpages",
					"ornamespace": namespaces,
					"orlimit": "max",
					"format": "json",
					"orstart": since,
					"ordir": since ? "newer" : "older"
				};
			},
			get watchlist() {
				return {
					"action": "query",
					"list": "watchlist",
					"wlnamespace": namespaces,
					"wllimit": 25,
					"wlprop": "title|ids|sizes|flags|user|tags|comment|timestamp",
					"wltype": "edit",
					"format": "json",
					"wlstart": since || "",
					"wldir": since ? "newer" : "older",
					"wlexcludeuser": mw.config.get("wgUserName") || ""
				};
			}
		};

		if (listType === "flagged" && !__pendingChangesServer__.has(mw.config.get("wgServerName"))) {
			return [];
		}

		try {
			const response = await this.api.get(options[listType]);

			switch (listType) {
				case "recent": {
					return response.query.recentchanges;
				} break;
				case "flagged": {
					const promise = await Promise.allSettled(response.query.oldreviewedpages.map(async obj => {
						let revision;
						if (this.cache.has(`flaggedRev:${obj.revid}`)) {
							revision = this.cache.get(`flaggedRev:${obj.revid}`);
						} else {
							revision = await this.api.get({
								"action": "query",
								"prop": "revisions",
								"titles": obj.title,
								"rvstartid": obj.revid,
								"rvlimit": 1,
								"rvprop": "title|ids|size|flags|user|tags|comment|timestamp",
								"format": "json",
								"formatversion": 2
							});
							this.cache.set(`flaggedRev:${obj.revid}`, revision);
						}

						const page = revision.query.pages[0];
						return {
							title: obj.title,
							sizediff: obj.diff_size,
							...page.revisions[0],
							__FLAGGED__: obj
						};
					}));

					const list = promise.filter(p => p.status === "fulfilled").map(p => p.value);
					if (full === false) {
						return list;
					}

					const cache = { };
					await Promise.allSettled(list.map(async item => {
						const between = await this.getRevisionsBetween(item.title, item.__FLAGGED__.stable_revid, item.revid); // newest first
						if (between.length < 2) {
							return;
						}

						const stable = between.pop(); // Remove the stable revision itself
						cache[item.title] = {
							count: between.length,
							users: between.reduce((acc, rev) => {
								if (rev.user in acc) {
									acc[rev.user]++;
								} else {
									acc[rev.user] = 1;
								}
								return acc;
							}, { }),

							newRevid: item.revid,
							priorRevid: stable.revid,

							diff_size: item.size - stable.size,

							newTimestamp: item.timestamp,
							oldTimestamp: between[between.length - 1].timestamp,
						};
					}));

					return cache;
				} break;
				case "watchlist": {
					return response.query.watchlist;
				} break;
			}
		} catch (err) {
			console.log(`Could not fetch recent changes: ${err}`);
		}
	}

	async acceptFlaggedEdit(edit, summary) {
		try {
			const res = await this.api.postWithToken("csrf", {
				"action": "review",
				"revid": edit.revid,
				"comment": summary,
				"tags": __TAGS__
			});

			return true;
		} catch (err) {
			console.error(err);
			return false;
		}
	}

	async rejectFlaggedEdit(edit, summary, stableId) {
		try {
			const stableText = await this.getTextByRevid(stableId);
			const res = await this.api.postWithToken("csrf", {
				"action": "edit",
				"title": edit.page.title,
				"text": stableText,
				"summary": summary,
				"starttimestamp": edit.__FLAGGED__.oldTimestamp,
				"tags": __TAGS__
			});

			return true;
		} catch (err) {
			console.error(err);
			return false;
		}
	}

	async getRevisionsBetween(page, startRevid, endRevid) {
		try {
			const response = await this.api.get({
				"action": "query",
				"prop": "revisions",
				"titles": page,
				"rvstartid": endRevid,
				"rvendid": startRevid,
				"rvprop": "title|ids|size|flags|user|tags|comment|timestamp",
				"rvlimit": "max",
				"format": "json",
				"formatversion": 2
			});
			const revisions = response.query.pages[0].revisions;
			return revisions;
		} catch (err) {
			console.log(`Could not fetch revisions between ${startRevid} and ${endRevid} for page ${page}: ${err}`);
			return [];
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

			const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
			const scores = response.query.pages.map(page => {
				const scores = [];
				if ("damaging" in page.revisions[0].oresscores) {
					scores.push(page.revisions[0].oresscores.damaging.true);
				}
				if ("goodfaith" in page.revisions[0].oresscores) {
					scores.push(page.revisions[0].oresscores.goodfaith.false);
				}

				return [ page.revisions[0].revid, scores.length > 0 ? avg(scores) : NaN ];
			});

			return scores.reduce((a, v) => ({ ...a, [v[0]]: v[1] }), {});
		} catch (err) {
			console.log(`Could not fetch ORES scores for revision ${revids}: ${err}`);
		}
	}

	/**
	* Check if the given user is blocked
	* @param {String} users The users to check
	* @returns {Promise<Object>} The blocks
	*/
	async isBlocked(users) {
		try {
			const response = await this.api.get({
				"action": "query",
				"list": "blocks",
				"bkusers": users,
				"bkprop": "id|user|by|timestamp|expiry|reason",
				"format": "json",
				"formatversion": 2
			});

			return response.query.blocks.reduce((acc, block) => ({ ...acc, [block.user]: block }), {});
		} catch (err) {
			console.log(`Could not fetch blocks for users ${users}: ${err}`);
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
		try {
			const res = await this.api.rollback(title, user, {
				"summary": summary,
				"tags": __TAGS__
			});

			if (!res?.revid) {
				throw new Error("Possible edit conflict.");
			}

			const revData = await this.getRevisionData(res.revid);
			if (revData?.user !== this.wikishield.username) {
				throw new Error("Possible edit conflict.");
			}

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
		try {
			// Get the revision ID to undo and the previous revision
			const revid = edit.revid;
			const title = edit.page.title;

			// Use the MediaWiki API to undo the edit
			const res = await this.api.postWithToken("csrf", {
				"action": "edit",
				"title": title,
				"undo": revid,
				"summary": reason,
				"tags": __TAGS__
			});

			if (!res?.edit?.newrevid) {
				throw new Error("Possible edit conflict.");
			}

			const revData = await this.getRevisionData(res.edit.newrevid);
			if (revData?.user !== this.wikishield.username) {
				throw new Error("Possible edit conflict.");
			}

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
		try {
			await this.api.postWithToken("csrf", Object.assign(
				{
					"action": "block",
					"user": user,
					"expiry": duration,
					"reason": summary,
					"tags": __TAGS__
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
		try {
			await this.api.postWithToken("csrf", {
				"action": "protect",
				"title": page,
				"reason": summary,
				"protections": `edit=${details.edit}|move=${details.move}`,
				"expiry": `${details.editExpiry}|${details.moveExpiry}`,
				"tags": __TAGS__
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
