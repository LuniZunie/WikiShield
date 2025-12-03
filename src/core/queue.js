/**
* WikiShieldQueue - Edit queue management
* Manages the queue of edits to review and provides queue operations
*/
export class WikiShieldQueue {
	constructor(wikishield) {
		this.wikishield = wikishield;
		this.hasBeenInQueue = {
			recent: new Set(),
			flagged: new Set(),
			watchlist: new Set()
		};
		this.queue = {
			recent: [],
			flagged: [],
			watchlist: []
		};
		this.previousItems = {
			recent: [],
			flagged: [],
			watchlist: []
		};
		this.lastRevid = {
			recent: 0,
			flagged: 0,
			watchlist: 0
		};
		this.lastTimestamp = {
			recent: wikishield.util.utcString(new Date()),
			flagged: null,
			watchlist: wikishield.util.utcString(new Date())
		};
		this.currentEdit = {
			recent: null,
			flagged: null,
			watchlist: null
		};

		this.backoff = 2000;

		this.flaggedRevisions = new Map();

		this.currentQueueTab = "recent"; // recent, flagged, watchlist
	}

	switchQueueTab(tabName) {
		if (this.currentQueueTab === tabName) return;
		else if (this.currentQueueTab === "flagged") {
			this.queue.flagged = this.queue.flagged.filter(edit => this.flaggedRevisions.has(edit.revid));
		}

		this.currentQueueTab = tabName;
		this.currentEdit[tabName] = this.queue[tabName][0] || null;

		this.wikishield.interface.renderQueue(this.queue[tabName], this.currentEdit[tabName]);
		document.querySelectorAll("#queue-tabs > .queue-tab.selected").forEach(elem => elem.classList.remove("selected"));
		document.querySelector(`#queue-tab-${tabName}`).classList.add("selected");

		this.wikishield.interface.newEditSelected(this.currentEdit[tabName]);
	}

	/**
	* Fetch recent changes from the API
	*/
	async fetchRecentChanges(type = "recent") {
		if (!this.wikishield.storage.data.settings.queue[type].enabled) {
			window.setTimeout(this.fetchRecentChanges.bind(this, type), this.wikishield.__script__.config.refresh[type]);
			return;
		}

		// TODO, instead of rejecting new edits when queue is full, remove edits at the bottom of the queue
		if (this.queue[type].length >= this.wikishield.storage.data.settings.queue.max_size) {
			window.setTimeout(this.fetchRecentChanges.bind(this, type), this.wikishield.__script__.config.refresh[type]);
			return;
		}

		try {
			const whitelist = this.wikishield.storage.data.whitelist;
			const namespaceString = type === "watchlist" ? "*" : this.wikishield.storage.data.settings.namespaces.join("|");

			if (type === "flagged") {
				const flagged = await this.wikishield.api.queueList(type, namespaceString, undefined, true);
				this.flaggedRevisions.clear();
				Object.values(flagged).forEach(edit => this.flaggedRevisions.set(edit.newRevid, edit));
			}

			const lastRevid = this.lastRevid[type] || 0;
			let recentChanges = (await this.wikishield.api.queueList(type, namespaceString, this.lastTimestamp[type] || undefined) ?? [])
				.filter(edit => edit.revid > lastRevid && (type !== "recent" ||!whitelist.pages.has(edit.title)));

			if (recentChanges[0]) {
				const time = new Date(recentChanges[0].timestamp);
				this.lastTimestamp[type] = this.wikishield.util.utcString(time);
			}

			switch (type) {
				default:
				case "recent": {
					for (const recentChange of recentChanges) {
						const itemsToRemove = [];
						for (const queueItem of this.queue[type]) {
							// Skip the currently selected edit
							if (this.currentEdit[type] && queueItem.revid === this.currentEdit[type].revid) {
								continue;
							}
							// Remove if same page and older revision
							if (queueItem.page.title === recentChange.title && queueItem.revid < recentChange.revid) {
								itemsToRemove.push(queueItem);
							}
						}

						// Remove the outdated items
						for (const oldItem of itemsToRemove) {
							const index = this.queue[type].indexOf(oldItem);
							if (index > -1) {
								this.queue[type].splice(index, 1);
								this.wikishield.interface.removeQueueItem(type, oldItem.revid);
							}
						}
					}
				} break;
				case "flagged": {
					for (const queueItem of this.queue[type]) {
						if (!(queueItem.fromHistory === true || this.currentEdit[type]?.revid === queueItem.revid || this.flaggedRevisions.has(queueItem.revid))) {
							const index = this.queue[type].indexOf(queueItem);
							if (index > -1) {
								this.wikishield.interface.removeQueueItem(type, queueItem.revid);
								this.queue[type].splice(index, 1);
							}
						}
					}
				} break;
				case "watchlist": {
					for (const recentChange of recentChanges) {
						const itemsToRemove = [];
						for (const queueItem of this.queue[type]) {
							// Skip the currently selected edit
							if (this.currentEdit[type] && queueItem.revid === this.currentEdit[type].revid) {
								continue;
							}
							// Remove if same page and older revision
							if (queueItem.page.title === recentChange.title && queueItem.revid < recentChange.revid) {
								itemsToRemove.push(queueItem);
							}
						}

						// Remove the outdated items
						for (const oldItem of itemsToRemove) {
							const index = this.queue[type].indexOf(oldItem);
							if (index > -1) {
								this.queue[type].splice(index, 1);
								this.wikishield.interface.removeQueueItem(type, oldItem.revid);
							}
						}
					}
				} break;
			}

			if (recentChanges.length === 0) {
				window.setTimeout(this.fetchRecentChanges.bind(this, type), this.wikishield.__script__.config.refresh[type]);
				return;
			}

			this.lastRevid[type] = Math.max(...recentChanges.map(edit => edit.revid));

			recentChanges = recentChanges.filter(edit => !(whitelist.users.has(edit.user) || edit.tags?.some(tag => whitelist.tags.has(tag))));
			const usersToFetch = recentChanges.reduce((str, edit) => str + (str === "" ? "" : "|") + edit.user, "");

			// Fetch edit counts, warnings (user talk text), blocks and ores in parallel
			const editCountsPromise = type === "recent" ? this.wikishield.api.editCount(usersToFetch) : Promise.resolve([ ]);
			const oresPromise = this.wikishield.api.ores(recentChanges.reduce((str, edit) => str + (str === "" ? "" : "|") + edit.revid, ""));

			const [editCountsRes, oresRes] = await Promise.allSettled([
				editCountsPromise,
				oresPromise
			]);

			const editCounts = editCountsRes.status === 'fulfilled' ? editCountsRes.value : { };
			if (editCountsRes.status === 'rejected') console.error('editCounts failed:', editCountsRes.reason);

			const ores = oresRes.status === 'fulfilled' ? oresRes.value : {};
			if (oresRes.status === 'rejected') console.error('ores failed:', oresRes.reason);

			const highlight = this.wikishield.storage.data.highlight;
			const minORES = this.wikishield.storage.data.settings.queue.min_ores;

			const hasHighlight = edit => highlight.users.has(edit.user) || highlight.pages.has(edit.title) || edit.tags?.some(tag => highlight.tags.has(tag));

			let filtered = [];
			if (type === "recent") {
				const max = this.wikishield.storage.data.settings.queue.max_edits;
				recentChanges.forEach(edit => {
					if (editCounts[edit.user] <= max && ((ores[edit.revid] || 0) >= minORES || hasHighlight(edit))) {
						filtered.push({ type, edit });
					}
				});
			} else {
				filtered = recentChanges.map(edit => ({ type, edit }));
			}

			if (filtered.length > 0) {
				this.wikishield.audioManager.playSound([ "queue", type ]);
			}

			this.addQueueItems(type, filtered);

			// Check for outdated edits in queue
			await this.checkForOutdatedEdits(type);

			this.backoff = this.wikishield.__script__.config.refresh[type];
		} catch (err) {
			console.log("Error while fetching recent changes", err);
			this.backoff = Math.min(this.backoff * 2, 120000);
		}

		window.setTimeout(this.fetchRecentChanges.bind(this, type), this.backoff);
	}

	async addQueueItems(type, edits) {
		edits = edits.filter(({ type, edit }) => !this.hasBeenInQueue[type].has(edit.revid));
		if (edits.length === 0) return;

		let playOres = false;
		const oresThreshold = this.wikishield.storage.data.settings.audio.ores_alert.threshold;

		const toSort = new Set();

		const items = await this.generateQueueItems(edits);
		const length = items.length;
		for (let i = 0; i < length; i++) {
			const item = items[i];
			const type = edits[i].type;

			this.queue[type].push(item);

			const hasBeenInQueue = this.hasBeenInQueue[type];
			hasBeenInQueue.add(item.revid);
			if (hasBeenInQueue.size > 5000) { // when over 5000 items, trim down to 2500
				const temp = new Set();

				let i = 0;
				for (const revid of hasBeenInQueue) {
					if (i++ >= 2500) break;
					temp.add(revid);
				}

				this.hasBeenInQueue[type] = temp;
			}

			toSort.add(type);
			if (type === "recent" && item.ores >= oresThreshold) {
				playOres = true;
			}
		}

		for (const sortType of toSort) {
			this.sortQueue(sortType);
		}

		if (playOres) {
			this.wikishield.audioManager.playSound([ "queue", "ores" ]);
		}

		this.wikishield.interface.renderQueue(this.queue[type], this.currentEdit[type], type);
	}

	sortQueue(type) {
		const currentIndex = this.queue[type].findIndex(e => e.revid === this.currentEdit[type]?.revid);
		let sorted;
		if (currentIndex === -1) {
			sorted = this.queue[type];
		} else {
			sorted = this.queue[type].slice(0, currentIndex).concat(this.queue[type].slice(currentIndex + 1));
		}

		const highlight = this.wikishield.storage.data.highlight;
		const usernameHighlighting = this.wikishield.storage.data.settings.username_highlighting.enabled;
		sorted = sorted.sort((a, b) => {
			const aHistory = a.fromHistory;
			const bHistory = b.fromHistory;
			if (aHistory && bHistory) { // both are from history
				return aHistory - bHistory;
			} else if (aHistory) { // only a is from history
				return -1;
			} else if (bHistory) { // only b is from history
				return 1;
			}

			let aScore = a.ores;
			if (highlight.users.has(a.user.name)) {
				aScore += 100;
			}
			if (highlight.pages.has(a.page.title)) {
				aScore += 75;
			}
			aScore += a.tags.filter(tag => highlight.tags.has(tag)).length * 25;

			if (usernameHighlighting && a.mentionsMe) {
				aScore += 50;
			}

			let bScore = b.ores;
			if (highlight.users.has(b.user.name)) {
				bScore += 100;
			}
			if (highlight.pages.has(b.page.title)) {
				bScore += 75;
			}
			bScore += b.tags.filter(tag => highlight.tags.has(tag)).length * 25;

			if (usernameHighlighting && b.mentionsMe) {
				bScore += 50;
			}

			if (aScore === bScore) {
				return b.revid - a.revid; // Newer edits first
			}

			return bScore - aScore;
		});

		if (currentIndex >= 0) {
			sorted.splice(currentIndex, 0, this.currentEdit[type]);
		}

		this.queue[type] = [ ...sorted ];

		if (!this.currentEdit[type]) {
			this.currentEdit[type] = this.queue[type][0];
		}
	}

	/**
	* Check and remove edits that have been superseded by newer edits on the same page
	* NOTE: This now only removes edits that are NOT currently being viewed
	*/
	async checkForOutdatedEdits(type) {
		if (this.queue[type].length === 0) return;

		// Get all unique page titles from queue, filtering out invalid ones
		const allPageTitles = [...new Set(this.queue[type].map(item => item.page.title))];
		const pageTitles = allPageTitles;

		if (pageTitles.length === 0) return;

		// Fetch latest revision for each page
		const latestRevisions = await this.wikishield.api.getLatestRevisions(pageTitles.join("|"));

		// Track items to remove (but NOT the current edit being viewed)
		const itemsToRemove = [];

		for (const item of this.queue[type]) {
			// Don't remove the edit that's currently being viewed
			if (this.currentEdit[type] && item.revid === this.currentEdit[type].revid) {
				continue;
			}

			const latestRevid = latestRevisions[item.page.title];
			if (latestRevid && latestRevid > item.revid) {
				// This edit has been superseded
				itemsToRemove.push(item);
			}
		}

		// Remove outdated items
		if (itemsToRemove.length > 0) {
			for (const item of itemsToRemove) {
				const index = this.queue[type].indexOf(item);
				if (index > -1) {
					this.queue[type].splice(index, 1);
					this.wikishield.interface.removeQueueItem(item.revid);
				}
			}

			this.wikishield.interface.renderQueue(type, this.queue[type], this.currentEdit[type], type);
		}
	}

	async generateQueueItems(edits) {
		const username = mw.config.get("wgUserName");

		edits = edits.map(({ type, edit, simple }) => {
			let prevId = null;
			if (edit.__FLAGGED__) {
				prevId = this.flaggedRevisions.get(edit.revid)?.priorRevid;
			}
			prevId ??= edit.old_revid || edit.parentid;

			return { edit, prevId, type, simple };
		});

		const responses = await this.wikishield.api.getMultipleRevisionsInfo(edits);

		const queueItems = [];
		for (const response of responses) {
			const { edit, prevId, type, simple } = edits.shift();

			const wikishield = this.wikishield;
			const util = wikishield.util;

			let mentions = false;
			if (username && response.editDiff) {
				const $div = document.createElement("div");
				$div.innerHTML = response.editDiff;
				mentions = util.usernameMatch(username, $div.textContent || $div.innerText || "");
			}

			const queueItem = {
				display: {
					get pageTitle() {
						return `<div
							class="page-title ${wikishield.storage.data.highlight.pages.has(edit.title) ? 'queue-highlight' : ''}"
						>
							<span class="fa fa-file-alt queue-edit-icon"></span>
							<a
								href="${util.pageLink(edit.title)}"
								target="_blank"
								data-tooltip="${util.escapeHtml(edit.title)}"
							>
								${util.escapeHtml(util.maxStringLength(edit.title, 40))}
							</a>
						</div>`;
					},

					get username() {
						return `<div
							class="username ${wikishield.storage.data.highlight.users.has(edit.user) ? 'queue-highlight' : (
								response.userTalk === false ? 'queue-user-empty-talk' : ''
							)}"
						>
							<span class="fa fa-user queue-edit-icon"></span>
							<a
								class=${response.userBlocked ? "user-blocked" : ""}
								href="${util.pageLink(`Special:Contributions/${edit.user}`)}"
								target="_blank"
								data-tooltip="${util.escapeHtml(edit.user)}"
							>
								${util.escapeHtml(util.maxStringLength(edit.user, 30))}
							</a>
						</div>`;
					},
					get tags() {
						return `<div class="tags">
							${edit.tags.map(tag => {
								const highlight = wikishield.storage.data.highlight.tags.has(tag);

								return {
									highlight,
									html: `<span
												class="tag ${highlight ? 'queue-highlight' : ''}"
												data-tooltip="${util.escapeHtml(tag)}"
											>
												${util.escapeHtml(util.maxStringLength(tag, 20))}
											</span>`
								}
							}).sort((a, b) => b.highlight - a.highlight).reduce((str, obj) => str + obj.html, '')}
						</div>`;
					}
				},
				page: {
					namespace: edit.ns,
					title: edit.title,
					protection: response.pageProtection,

					history: response.pageHistory,

					categories: response.pageCategories,
					metadata: response.pageMetadata,
				},
				user: {
					ip: mw.util.isIPAddress(edit.user),
					temporary: mw.util.isTemporaryUser(edit.user),

					name: edit.user,
					editCount: response.userEditCount,

					contribs: response.userContribs,

					warningLevel: this.getWarningLevel(response.userTalk || ""),
					warningHistory: this.getWarningHistory(response.userTalk || ""),

					blocked: response.userBlocked,
					blocks: response.userBlocks,

					emptyTalkPage: response.userTalk === false,
				},
				ores: response.editOres,
				revid: edit.revid,
				previousRevid: prevId,
				timestamp: edit.timestamp,
				comment: edit.comment,
				minor: edit.minor || false,
				sizediff: (edit.newlen ? edit.newlen - edit.oldlen : edit.sizediff) || 0,
				diff: response.editDiff,
				tags: edit.tags,
				reviewed: false,
				mentionsMe: mentions,

				AI: {
					edit: null, // will be populated asynchronously
					username: null // will be populated asynchronously
				},

				isBLP: response.pageCategories.some(cat => cat.title === "Category:Living people"), // TODO can be done better?
				reverts: response.revertCount,
				consecutive: this.wikishield.api.consecutive(edit.title, edit.user),
				fromHistory: false,
				isTalk: edit.ns % 2 === 1,

				__FLAGGED__: edit.__FLAGGED__ || false,
				__fromQueue__: type
			};
			queueItems.push(queueItem);

			const storage = this.wikishield.storage.data;
			if (!simple && this.wikishield.AI) {
				if (storage.settings.AI.edit_analysis.enabled) {
					this.wikishield.AI.analyze.edit(queueItem)
						.then(analysis => {
							queueItem.AI.edit = analysis;
						})
						.catch(err => {
							queueItem.AI.edit = {
								error: err.message
							};
						})
						.finally(() => {
							if (this.currentEdit?.revid === queueItem.revid) {
								this.wikishield.interface.updateAIAnalysisDisplay(analysis);
							}
						});
				}

				if (!(queueItem.user.ip || queueItem.user.temporary) && !storage.whitelist.users.has(edit.user) && storage.settings.AI.username_analysis.enabled && false) { // TEMP remove false
					this.wikishield.AI.analyze.username(edit)
						.then(usernameAnalysis => {
							queueItem.AI.username = usernameAnalysis;

							// TODO add .promptForUAAReport() here
						})
						.catch(err => {
							queueItem.AI.username = {
								error: err.message
							};
						});
				}
			}
		}

		return queueItems;
	}

	/**
	* Given the text of a user talk page, get the warning level of the user
	* @param {String} text The text of the user talk page
	* @returns {String} The warning level of the user
	*/
	getWarningLevel(text) {
		const monthSections = text.split(/(?=== ?[\w\d ]+ ?==)/g);

		for (let section of monthSections) {
			if (new RegExp(`== ?${this.wikishield.util.monthSectionName()} ?==`).test(section)) {
				// Only match templates with numbered warning levels (e.g., uw-vandalism1, uw-test4im)
				// Excludes templates without numbers like uw-minor
				const templates = section.match(/<\!-- Template:[\w-]+?(\d(?:i?m)?) -->/g);
				if (templates === null) {
					return "0";
				}
				const filteredTemplates = templates.map(t => {
					const match = t.match(/<\!-- Template:[\w-]+?(\d(?:i?m)?) -->/);
					return match ? match[1] : "0";
				});
				return filteredTemplates.sort()[filteredTemplates.length - 1].toString();
			}
		}

		return "0";
	}

	/**
	* Get detailed warning history from user talk page
	* @param {String} text - User talk page content
	* @returns {Array} Array of warning objects with template name, level, and timestamp
	*/
	getWarningHistory(text) {
		const warnings = [];
		const monthSections = text.split(/(?=== ?[\w\d ]+ ?==)/g);
		const currentMonthName = this.wikishield.util.monthSectionName();

		for (let section of monthSections) {
			// Check if this is the current month section
			const isCurrentMonth = new RegExp(`== ?${currentMonthName} ?==`).test(section);

			// Only process warnings from the current month (those that count toward warning level)
			if (!isCurrentMonth) {
				continue;
			}

			// Extract section title (month/year)
			const sectionMatch = section.match(/== ?([\w\d ]+) ?==/);
			const sectionTitle = sectionMatch ? sectionMatch[1] : "Unknown";

			// Find all warning templates with their full context
			const templateMatches = section.matchAll(/<\!-- Template:([\w-]+?)(\d(?:i?m)?) -->(.+?)(?=<\!-- Template:|$)/gs);

			for (let match of templateMatches) {
				const templateName = match[1]; // e.g., "uw-vandalism"
				const level = match[2]; // e.g., "1", "4", "4im"
				const content = match[3]; // Content after template

				// Try to extract timestamp (looks for signature pattern)
				// Extract the timestamp and remove any HTML tags
				const timestampMatch = content.match(/(\d{2}:\d{2}.*?\d{4} \(UTC\))/);
				let timestamp = timestampMatch ? timestampMatch[1] : null;
				if (timestamp) {
					// Remove any HTML tags from the timestamp
					timestamp = timestamp.replace(/<[^>]*>/g, '');
				}

				{ // get proper timestamp
					const [ , time, day, monthName, year ] = timestamp.match(/(\d{2}:\d{2}), (\d{1,2}) ([A-Za-z]+) (\d{4})/);

					const monthIndex = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ].indexOf(monthName);
					timestamp = new Date(Date.UTC(year, monthIndex, day, ...time.split(":"))).toUTCString();
				}

				// Extract username from signature (look for User: or User talk: links)
				let username = null;
				const userLinkMatch = content.match(/\[\[User(?:[ _]talk)?:([^\]|]+)/i);
				if (userLinkMatch) {
					username = userLinkMatch[1].trim();
				}

				// Try to extract article name if present
				const articleMatch = content.match(/\[\[([^\]]+?)\]\]/);
				const article = articleMatch ? articleMatch[1] : null;

				warnings.push({
					template: templateName,
					level: level,
					timestamp: timestamp,
					username: username,
					article: article,
					section: sectionTitle,
					isCurrentMonth: isCurrentMonth
				});
			}
		}

		// Warnings are already from current month, just return them in order
		return warnings;
	}

	/**
	* Set the current edit to the next item in the queue
	* This only changes which edit is selected, it does NOT remove anything
	*/
	nextItem() {
		// If queue is empty, nothing to do
		if (this.queue[this.currentQueueTab].length === 0) {
			return;
		}

		// If no current edit, select the first item
		if (!this.currentEdit[this.currentQueueTab]) {
			this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][0];
			this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);
			return;
		}

		// Find where the current edit is in the queue
		const currentIndex = this.queue[this.currentQueueTab].findIndex(e => e.revid === this.currentEdit[this.currentQueueTab].revid);

		// If current edit is not in queue, select the first item
		if (currentIndex === -1) {
			this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][0];
			this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);
			return;
		}

		// Store the edit we're leaving
		const editWeAreLeaving = this.currentEdit[this.currentQueueTab];

		// Cancel AI analysis for the edit we're leaving
		if (editWeAreLeaving && this.wikishield.AI) {
			this.wikishield.AI.cancel.edit(editWeAreLeaving.revid);
		}

		// Mark as reviewed if moving away from the first item
		if (currentIndex === 0 && !editWeAreLeaving.reviewed) {
			editWeAreLeaving.reviewed = true;
		}

		// Remove the current item from the queue
		this.queue[this.currentQueueTab].splice(currentIndex, 1);
		this.wikishield.interface.removeQueueItem(this.currentQueueTab, editWeAreLeaving.revid);

		// Update currentEdit to the item now at the current position
		if (this.queue[this.currentQueueTab].length > 0) {
			if (currentIndex < this.queue[this.currentQueueTab].length) {
				// Move to the item that's now at the current position
				this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][currentIndex];
			} else {
				// We removed the last item, go to the new last item
				this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][this.queue.length - 1];
			}
		} else {
			// Queue is empty
			this.currentEdit[this.currentQueueTab] = null;
		}

		// Store the edit we left in previousItems
		const previousItems = this.previousItems[this.currentQueueTab];
		previousItems.push({ ...editWeAreLeaving, fromHistory: Date.now() });
		if (previousItems.length > 1000) { // prevent theoretical memory leak, keep only the last 1000 previous items
			previousItems.shift();
		}

		this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);

		// Auto-welcome the user we left
		if (editWeAreLeaving) {
			this.checkAndAutoWelcome(editWeAreLeaving);
		}
	}

	/**
	* Set the current edit to the previous item in the queue
	* This only changes which edit is selected, it does NOT remove anything
	*/
	prevItem() {
		// If no current edit and queue has items, select the first item
		if (!this.currentEdit[this.currentQueueTab] && this.queue[this.currentQueueTab].length > 0) {
			this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][0];
			this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);
			return;
		}

		// Find where the current edit is in the queue
		const currentIndex = this.currentEdit[this.currentQueueTab] ? this.queue[this.currentQueueTab].findIndex(e => e.revid === this.currentEdit[this.currentQueueTab].revid) : -1;

		// Store the edit we're leaving
		const editWeAreLeaving = this.currentEdit[this.currentQueueTab];

		// If we're at the first item (or not found), try to go to previousItems
		if (currentIndex <= 0) {
			// No previous items available, can't go back
			if (this.previousItems[this.currentQueueTab].length === 0) {
				return;
			}

			// Cancel AI analysis for the edit we're leaving
			if (editWeAreLeaving && this.wikishield.AI) {
				this.wikishield.AI.cancel.edit(editWeAreLeaving.revid);
			}

			// Pull an item from previousItems and add it to the front of the queue
			this.queue[this.currentQueueTab].unshift(this.previousItems[this.currentQueueTab].pop());
			this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][0];
			this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);

			// Auto-welcome the user we left
			if (editWeAreLeaving) {
				this.checkAndAutoWelcome(editWeAreLeaving);
			}

			return;
		}

		// Cancel AI analysis for the edit we're leaving
		if (editWeAreLeaving && this.wikishield.AI) {
			this.wikishield.AI.cancel.edit(editWeAreLeaving.revid);
		}

		// Simply move selection to the previous item
		this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][currentIndex - 1];
		this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);

		// Auto-welcome the user we left
		if (editWeAreLeaving) {
			this.checkAndAutoWelcome(editWeAreLeaving);
		}
	}

	/**
	* Check if user should be auto-welcomed and do so if needed
	* @param {Object} edit The edit object to check
	*/
	async checkAndAutoWelcome(edit) {
		// Check if auto-welcome is enabled
		if (!this.wikishield.storage.data.settings.auto_welcome.enabled) {
			return;
		}

		// Only auto-welcome registered users (not TEMPs or IPs) with empty talk pages
		if (!edit.user?.name || mw.util.isTemporaryUser(edit.user.name) || mw.util.isIPAddress(edit.user.name)) {
			return;
		}

		// Don't welcome users editing a sandbox (possibly gaming system)
		const pageTitle = edit.page?.title || "unknown";
		if (pageTitle.toLowerCase().includes('/sandbox') || pageTitle.toLowerCase().endsWith(":sandbox")) {
			return;
		}

		// Check if user is in the no-auto-welcome list
		if (this.wikishield.noAutoWelcomeList.has(edit.user.name)) {
			return;
		}

		// Check if talk page appears empty
		if (!edit.user.emptyTalkPage) {
			return;
		}

		// Double-check by fetching the talk page to see if it exists
		try {
			// If the talk page exists, don't auto-welcome
			if (await this.wikishield.api.pageExists(`User talk:${edit.user.name}`) === false) {
				edit.user.emptyTalkPage = false;
				return;
			}

			// Show confirmation dialog
			const confirmed = await this.wikishield.interface.showConfirmationDialog(
				"Auto-welcome User",
				`Would you like to welcome <span class="confirmation-modal-username">${this.wikishield.util.escapeHtml(edit.user.name)}</span>?<br><br>
					<span style="font-size: 0.9em; color: #888;">Editing: <strong>${this.wikishield.util.escapeHtml(edit.page.title)}</strong></span>`,
				edit.user.name
			);

			// even IF confirmed or not, add to no-auto-welcome list to avoid future prompts (like if user talk page is deleted)
			this.wikishield.noAutoWelcomeList.add(edit.user.name);
			if (!confirmed) {
				return;
			}

			this.wikishield.executeScript({
				actions: [
					{
						name: "welcome",
						params: {
							template: "auto"
						}
					},
				],
			}, undefined, undefined, edit);
		} catch (err) {
			console.log("Error during auto-welcome check:", err);
		}
	}

	/**
	* Prompt user to report a username to UAA
	* This is called when username analysis flags a username
	* @param {Object} edit The edit object with username analysis
	*/
	async promptForUAAReport(edit) {
		// Only check registered users (not TEMPs)
		if (!edit.user?.name || mw.util.isTemporaryUser(edit.user.name) || mw.util.isIPAddress(edit.user.name)) {
			return;
		}

		if (this.wikishield.uaaReports && this.wikishield.uaaReports.includes(edit.user.name)) {
			return;
		}

		// Show confirmation dialog with AI analysis
		const violationLabel = usernameAnalysis.violationType !== 'none'
		? ` (${usernameAnalysis.violationType})`
		: '';
		const confidencePercent = Math.round(usernameAnalysis.confidence * 100);

		const confirmed = await this.wikishield.interface.showConfirmationDialog(
			"Report Username to UAA",
			`The username <span class="confirmation-modal-username">${this.wikishield.util.escapeHtml(edit.user.name)}</span> may violate Wikipedia's username policy${violationLabel}.<br><br>
				<span style="font-size: 0.9em; color: #888;">Would you like to report it to <a href="https://en.wikipedia.org/wiki/Wikipedia:Usernames_for_administrator_attention" target="_blank" style="color: #0645ad;">Usernames for administrator attention (UAA)</a>?</span><br><br>
				<strong>AI Confidence:</strong> ${confidencePercent}%<br>
				<strong>Reasoning:</strong> ${this.wikishield.util.escapeHtml(usernameAnalysis.reasoning)}<br>`,
			edit.user.name,
			true
		);

		if (confirmed) {
			const reason = await this.wikishield.interface.showUAAReasonDialog(username);
			if (reason) {
				await this.wikishield.executeScript({
					name: "reportToUAA",
					params: {
						reportMessage: reason,
					}
				}, undefined, undefined, edit);
			}
		}
	}

	/**
	* Clear the queue
	*/
	delete() {
		const type = this.currentQueueTab;

		for (const item of this.queue[type]) {
			if (this.wikishield.AI) {
				this.wikishield.AI.cancel.edit(item.revid);
			}
		}

		this.queue[type] = [];
		this.currentEdit[type] = null;
		this.wikishield.interface.clearQueue();
		this.wikishield.interface.renderQueue(this.queue[type], this.currentEdit[type], type);
	}

	/**
	* Load an edit from the user contributions list
	* @param {Number} revid
	*/
	async loadFromContribs(edit) {
		const type = this.currentQueueTab;
		this.currentEdit[type] = edit;

		const index = this.queue[type].findIndex(item => item.revid === this.currentEdit[type]?.revid);
		if (index > -1) {
			this.queue[type][index] = edit;
		}

		this.wikishield.interface.renderQueue(this.queue[type], edit);
	}

	/**
	* Load an edit from the page history list
	* @param {Number} revid
	*/
	async loadFromHistory(edit) {
		const type = this.currentQueueTab;
		this.currentEdit[type] = edit;

		const index = this.queue[type].findIndex(item => item.revid === this.currentEdit[type]?.revid);
		if (index > -1) {
			this.queue[type][index] = edit;
		}

		this.wikishield.interface.renderQueue(this.queue[type], edit);
	}

	/**
	* Load a specific revision by revid and page title (for loading newest revision)
	* @param {Number} revid The revision ID to load
	* @param {String} pageTitle The page title
	*/
	async loadSpecificRevision(revid, pageTitle, replace = true) {
		const type = this.currentQueueTab;

		try {
			const diffContainer = this.wikishield.interface.elem("#diff-container");
			diffContainer.innerHTML = `<div class="loading-spinner">Loading revision...</div>`;

			// Fetch the revision data from the API
			const revisionData = await this.wikishield.api.getRevisionData(revid);
			if (!revisionData) {
				diffContainer.innerHTML = `<div class="error">Failed to load revision</div>`;
				return;
			}

			// Create a proper edit object
			const edit = {
				revid: revisionData.revid,
				parentid: revisionData.parentid,  // Include parentid for diff generation
				user: revisionData.user,
				comment: revisionData.comment,
				timestamp: revisionData.timestamp,
				tags: revisionData.tags || [],
				size: revisionData.size,
				oldlen: revisionData.oldlen || 0,
				newlen: revisionData.size,
				title: pageTitle,
				minor: revisionData.minor || false,
			};

			const item = (await this.generateQueueItems([{ type, edit }]))[0];

			const index = this.queue[type].findIndex(item => item.revid === this.currentEdit[type]?.revid);
			if (replace && index > -1) {
				this.queue[type][index] = item;
			}

			this.currentEdit[type] = item;
			this.wikishield.interface.renderQueue(this.queue[type], item);
		} catch (err) {
			console.error("Failed to load specific revision:", err);
			this.wikishield.interface.elem("#diff-container").innerHTML = `<div class="error">Failed to load revision</div>`;
		}
	}
}