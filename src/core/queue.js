/**
* WikiShieldQueue - Edit queue management
* Manages the queue of edits to review and provides queue operations
*/

import { Memory } from "../utils/memory.js";
export class WikiShieldQueue {
	constructor(wikishield) {
		this.wikishield = wikishield;
		this.queueTypes = {
			"recent": "edit",
			"flagged": "edit",
			"watchlist": "edit",
			"contribs": "edit",
			"history": "edit",
			"loaded": "edit",

			"users": "logevent"
		};
		this.hasBeenInQueue = {
			recent: new Set(),
			flagged: new Set(),
			watchlist: new Set(),
			users: new Set()
		};
		this.haltedFetchedChanges = {
			recent: [],
			flagged: [],
			watchlist: [],
			users: []
		};
		this.haltedCount = {
			recent: { },
			flagged: { },
			watchlist: { },
			users: { }
		};
		this.queue = {
			recent: [],
			flagged: [],
			watchlist: [],
			users: []
		};
		this.previousItems = {
			recent: [],
			flagged: [],
			watchlist: [],
			users: []
		};
		this.lastRevid = {
			recent: 0,
			flagged: 0,
			watchlist: 0,
			users: 0
		};
		this.lastTimestamp = {
			recent: wikishield.util.utcString(new Date()),
			flagged: null,
			watchlist: wikishield.util.utcString(new Date()),
			users: wikishield.util.utcString(new Date())
		};
		this.currentEdit = {
			recent: null,
			flagged: null,
			watchlist: null,
			users: null
		};
		this.playedSoundFor = {
			mention: new Memory({ timeout: 60 * 1000 }) // 1 minute
		};

		this.watchlistOverride = { }; // title: true/false

		this.backoff = 2000;

		this.flaggedRevisions = new Map();

		this.currentQueueTab = "recent"; // recent, flagged, watchlist, users
	}

	areSameQueueTypes(typeA, typeB) {
		return this.queueTypes[typeA] === this.queueTypes[typeB];
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

		try {
			const whitelist = this.wikishield.storage.data.whitelist;
			const namespaceString = type === "recent" || type === "flagged" ? this.wikishield.storage.data.settings.namespaces.join("|") : "";

			if (type === "flagged") {
				const flagged = await this.wikishield.api.queueList(type, namespaceString, undefined, true);
				this.flaggedRevisions.clear();
				Object.values(flagged).forEach(edit => this.flaggedRevisions.set(edit.newRevid, edit));

				await this.checkForOutdatedEdits(type);
			}

			const lastRevid = this.lastRevid[type] || 0;
			let recentChanges = (await this.wikishield.api.queueList(type, namespaceString, this.lastTimestamp[type] || undefined) ?? []);
			switch (this.queueTypes[type]) {
				case "edit": {
					recentChanges = recentChanges.filter(edit => edit.revid > lastRevid && (type !== "recent" ||!whitelist.pages.has(edit.title)));
				} break;
				case "logevent": {
					recentChanges = recentChanges.filter(log => log.logid > lastRevid);
				} break;
			}

			if (recentChanges[0]) {
				const time = new Date(recentChanges[0].timestamp);
				this.lastTimestamp[type] = this.wikishield.util.utcString(time);
			}

			recentChanges = recentChanges.concat(this.haltedFetchedChanges[type]);
			if (recentChanges.length > 25) {
				this.haltedFetchedChanges[type] = recentChanges.splice(25).reverse();
			} else {
				this.haltedFetchedChanges[type] = [ ];
			}

			let changed = false;
			switch (type) {
				default:
				case "recent": {
					const itemsToRemove = new Set();

					for (const recentChange of recentChanges) {
						for (const queueItem of this.queue[type]) {
							if (itemsToRemove.has(queueItem)) continue;

							if (this.currentEdit[type] && queueItem.revid === this.currentEdit[type].revid) {
								continue;
							}

							if (queueItem.page.title === recentChange.title && queueItem.revid < recentChange.revid) {
								itemsToRemove.add(queueItem);
							}
						}
					}

					for (const oldItem of itemsToRemove) {
						const index = this.queue[type].indexOf(oldItem);
						if (index > -1) {
							this.queue[type].splice(index, 1);
							this.wikishield.interface.removeQueueItem(type, oldItem.revid);
						}
					}

					changed = itemsToRemove.size > 0;
				} break;
				case "flagged": {
					for (const queueItem of this.queue[type]) {
						if (!(this.currentEdit[type]?.revid === queueItem.revid || this.flaggedRevisions.has(queueItem.revid))) {
							const index = this.queue[type].indexOf(queueItem);
							if (index > -1) {
								this.wikishield.interface.removeQueueItem(type, queueItem.revid);
								this.queue[type].splice(index, 1);

								changed = true;
							}
						}
					}
				} break;
				case "users": {
					// TODO we can add options for this!!
					recentChanges = recentChanges.filter(log => !log.temp);
				} break;
				case "watchlist": {
					const itemsToRemove = new Set();
					for (const recentChange of recentChanges) {
						for (const queueItem of this.queue[type]) {
							if (itemsToRemove.has(queueItem)) continue;

							if (this.currentEdit[type] && queueItem.revid === this.currentEdit[type].revid) {
								continue;
							}

							if (queueItem.page.title === recentChange.title && queueItem.revid < recentChange.revid) {
								itemsToRemove.add(queueItem);
							}

							const watched = this.watchlistOverride[queueItem.page.title] ?? queueItem.page.watched;
							if (!watched) {
								itemsToRemove.add(queueItem);
							}
						}
					}

					if (recentChanges.length === 0) {
						for (const queueItem of this.queue[type]) {
							const watched = this.watchlistOverride[queueItem.page.title] ?? queueItem.page.watched;
							if (!watched) {
								itemsToRemove.add(queueItem);
							}
						}
					}

					for (const oldItem of itemsToRemove) {
						const index = this.queue[type].indexOf(oldItem);
						if (index > -1) {
							this.queue[type].splice(index, 1);
							this.wikishield.interface.removeQueueItem(type, oldItem.revid);
						}
					}

					changed = itemsToRemove.size > 0;
				} break;
			}

			if (recentChanges.length === 0) {
				if (changed) {
					this.wikishield.interface.renderQueue(this.queue[type], this.currentEdit[type], type);
				}

				window.setTimeout(this.fetchRecentChanges.bind(this, type), this.wikishield.__script__.config.refresh[type]);
				return;
			}

			switch (this.queueTypes[type]) {
				case "edit": {
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
					const haltedCount = this.haltedCount[type];
					if (type === "recent") {
						const max = this.wikishield.storage.data.settings.queue.max_edits;
						recentChanges.forEach(edit => {
							if (isNaN(ores[edit.revid]) && haltedCount[edit.revid] < 3) {
								this.haltedFetchedChanges[type].push(edit);
								haltedCount[edit.revid] = (haltedCount[edit.revid] || 0) + 1;
								return;
							}

							delete haltedCount[edit.revid];

							if (editCounts[edit.user] <= max && ((ores[edit.revid] || 0) >= minORES || hasHighlight(edit))) {
								filtered.push({ type, edit });
							}
						});
					} else {
						recentChanges.forEach(edit => {
							if (isNaN(ores[edit.revid]) && haltedCount[edit.revid] < 3) {
								this.haltedFetchedChanges[type].push(edit);
								haltedCount[edit.revid] = (haltedCount[edit.revid] || 0) + 1;
								return;
							}

							delete haltedCount[edit.revid];

							filtered.push({ type, edit });
						});
					}

					await this.addQueueItems(type, filtered);
				} break;
				case "logevent": {
					const set = new Set();
					recentChanges = recentChanges.filter(log => {
						if (set.has(log.logid)) {
							return false;
						}

						set.add(log.logid);
						return true;
					});

					this.lastRevid[type] = Math.max(...recentChanges.map(log => log.logid));

					await this.addQueueLogs(type, recentChanges.map(log => ({ type, log })));
				} break;
			}

			if (type !== "flagged") {
				await this.checkForOutdatedEdits(type);
			}

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

		const play = { ores: false, mention: false };
		const { enabled: oresEnabled, threshold: oresThreshold } = this.wikishield.storage.data.settings.audio.ores_alert;
		const mentionEnabled = this.wikishield.storage.data.settings.username_highlighting.enabled;

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
			if (type === "recent" && oresEnabled && item.ores >= oresThreshold) {
				play.ores = true;
			}

			if (mentionEnabled && item.mentionsMe && !this.playedSoundFor.mention.has(item.revid)) {
				this.playedSoundFor.mention.add(item.revid);
				play.mention = true;
			}
		}

		for (const sortType of toSort) {
			this.sortQueueEdits(sortType);
		}

		if (play.ores) {
			this.wikishield.audioManager.playSound([ "queue", "ores" ]);
		}
		if (play.mention) {
			this.wikishield.audioManager.playSound([ "queue", "mention" ]);
		}

		this.wikishield.interface.renderQueue(this.queue[type], this.currentEdit[type], type);
	}

	async addQueueLogs(type, logs) {
		const toSort = new Set();

		const play = { mention: false };
		const mentionEnabled = this.wikishield.storage.data.settings.username_highlighting.enabled;

		const items = await this.generateQueueLogs(logs);
		for (const item of items) {
			const type = item.__fromQueue__;
			this.queue[type].push(item);
			toSort.add(type);

			if (mentionEnabled && item.mentionsMe && !this.playedSoundFor.mention.has(item.revid)) {
				this.playedSoundFor.mention.add(item.revid);
				play.mention = true;
			}
		}

		for (const sortType of toSort) {
			this.sortQueueLogs(sortType);
		}

		if (play.mention) {
			this.wikishield.audioManager.playSound([ "queue", "mention" ]);
		}

		this.wikishield.interface.renderQueue(this.queue[type], this.currentEdit[type], type);
	}

	sortQueueEdits(type) {
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

		this.queue[type] = [ ...sorted.slice(0, this.wikishield.storage.data.settings.queue.max_size) ];

		if (!this.currentEdit[type]) {
			this.currentEdit[type] = this.queue[type][0];
		}
	}

	sortQueueLogs(type) {
		const currentIndex = this.queue[type].findIndex(l => l.revid === this.currentEdit[type]?.revid);
		let sorted;
		if (currentIndex === -1) {
			sorted = this.queue[type];
		} else {
			sorted = this.queue[type].slice(0, currentIndex).concat(this.queue[type].slice(currentIndex + 1));
		}

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

			let aScore = 0;
			if (usernameHighlighting && a.mentionsMe) {
				aScore += 50;
			}

			let bScore = 0;
			if (usernameHighlighting && b.mentionsMe) {
				bScore += 50;
			}

			if (aScore === bScore) {
				return new Date(b.timestamp) - new Date(a.timestamp); // Newer logs first
			}

			return bScore - aScore;
		});

		if (currentIndex >= 0) {
			sorted.splice(currentIndex, 0, this.currentEdit[type]);
		}

		this.queue[type] = [ ...sorted.slice(0, this.wikishield.storage.data.settings.queue.max_size) ];

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

		const allPageTitles = [...new Set(this.queue[type].map(item => item.page.title))];
		const pageTitles = allPageTitles;

		if (pageTitles.length === 0) return;

		const itemsToRemove = [];
		switch (type) {
			case "flagged": {
				for (const item of this.queue[type]) {
					if (!this.flaggedRevisions.has(item.revid)) {
						itemsToRemove.push(item);
					}
				}
			} break;
			default: {
				const latestRevisions = await this.wikishield.api.getLatestRevisions(pageTitles.join("|"));
				for (const item of this.queue[type]) {
					if (item.revid === this.currentEdit[type]?.revid) {
						continue;
					}

					const latestRevid = latestRevisions[item.page.title];
					if (latestRevid && latestRevid > item.revid) {
						itemsToRemove.push(item);
					}
				}
			} break;
		}

		if (itemsToRemove.length > 0) {
			for (const item of itemsToRemove) {
				const index = this.queue[type].indexOf(item);
				if (index > -1) {
					this.queue[type].splice(index, 1);
					this.wikishield.interface.removeQueueItem(item.revid);
				}
			}

			this.wikishield.interface.renderQueue(this.queue[type], this.currentEdit[type], type);
		}
	}

	async generateQueueItems(edits, simple = false) {
		if (edits.length === 0) return [];

		const username = mw.config.get("wgUserName");

		edits = edits.map(({ type, edit }) => {
			let prevId = null;
			if (edit.__FLAGGED__) {
				prevId = this.flaggedRevisions.get(edit.revid)?.priorRevid;
			}
			prevId ??= edit.old_revid || edit.parentid;

			return { edit, prevId, type };
		});

		const responses = await this.wikishield.api.getMultipleRevisionsInfo(edits, simple);

		const queueItems = [];
		for (const response of responses) {
			const { edit, prevId, type } = edits.shift();

			const wikishield = this.wikishield;
			const util = wikishield.util;

			const mentions = { comment: false, diff: false };
			if (username && edit.comment) {
				mentions.comment = util.usernameMatch(username, edit.comment);
			}
			if (username && response.editDiff) {
				const $div = document.createElement("div");
				$div.innerHTML = response.editDiff;
				mentions.diff = util.usernameMatch(username, $div.textContent || $div.innerText || "");
			}

			this.watchlistOverride[edit.title] = response.pageWatched;

			const queueItem = {
				display: {
					get pageTitle() {
						return `<div class="page-title ${wikishield.storage.data.highlight.pages.has(edit.title) ? 'queue-highlight' : ''}">
							<span class="fa fa-file-alt queue-edit-icon"></span>
							<a
								href="${util.pageLink(edit.title)}"
								data-tooltip="${util.escapeHtml(edit.title)}"
								data-multiple-hrefs="page;title=${encodeURIComponent(edit.title)}&revid=${edit.revid}"
							>
								${util.escapeHtml(util.maxStringLength(edit.title, 40))}
							</a>
						</div>`;
					},

					get username() {
						const classes = wikishield.storage.data.highlight.users.has(edit.user) ?
							'queue-highlight' : (response.userTalk === false ? 'queue-user-empty-talk' : '');

						return `<div class="username ${classes}" >
							<span class="fa fa-user queue-edit-icon"></span>
							<span class="${response.userBlocked ? "user-blocked" : ""}">
								<a
									href="${util.pageLink(`User:${edit.user}`)}"
									data-tooltip="${util.escapeHtml(edit.user)}"
									data-multiple-hrefs="user;username=${encodeURIComponent(edit.user)}"
								>${util.escapeHtml(util.maxStringLength(edit.user, 30))}</a>
							</span>
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

					watched: response.pageWatched,
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

				mentionsMe: mentions.comment || mentions.diff,
				mentions: mentions,

				AI: {
					edit: null, // will be populated asynchronously
					username: null // will be populated asynchronously
				},

				isBLP: response.pageCategories.includes("Category:Living people"),
				reverts: response.revertCount,
				consecutive: simple ? undefined : this.wikishield.api.consecutive(edit.title, edit.user),
				fromHistory: false,
				isTalk: edit.ns % 2 === 1,

				__FLAGGED__: edit.__FLAGGED__ || false,
				__fromQueue__: type,

				simple: simple,
				origin: edit,
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
							if (this.currentEdit[this.currentQueueTab]?.revid === queueItem.revid) {
								this.wikishield.interface.updateAIAnalysisDisplay(queueItem.AI.edit);
							}
						});
				}

				if (!(queueItem.user.ip || queueItem.user.temporary) && !storage.whitelist.users.has(edit.user) && storage.settings.AI.username_analysis.enabled) {
					this.wikishield.AI.analyze.username(queueItem)
						.then(usernameAnalysis => {
							queueItem.AI.username = usernameAnalysis;
							if (usernameAnalysis.flag) {
								this.promptForUAAReport(queueItem, usernameAnalysis);
							}
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

	async generateQueueLogs(logs, simple = false) {
		if (logs.length === 0) return [];

		const username = mw.config.get("wgUserName");

		const wikishield = this.wikishield;
		const util = wikishield.util;

		const responses = await this.wikishield.api.getUserInfo(logs.map(log => log.log.title.replace(/^(User|User talk):/, "")), simple);
		const performerResponses = await this.wikishield.api.getUserInfo(logs.map(({ log }) => log.user), simple);

		const queueItems = [];
		for (const response of responses) {
			const { log, type } = logs.shift();
			const performerResponse = performerResponses.shift();

			const user = log.title.replace(/^(User|User talk):/, "");

			const mentions = { username: false, comment: false };
			if (username && user) {
				mentions.username = util.usernameMatch(username, user);
			}
			if (username && log.comment) {
				mentions.comment = util.usernameMatch(username, log.comment);
			}

			const queueItem = {
				display: {
					get pageTitle() {
						return `<div class="page-title ${wikishield.storage.data.highlight.pages.has(log.title) ? 'queue-highlight' : ''}">
							<span class="fa fa-file-alt queue-edit-icon"></span>
							<a
								href="${util.pageLink(log.title)}"
								data-tooltip="${util.escapeHtml(log.title)}"
								data-multiple-hrefs="log;title=${encodeURIComponent(log.title)}&log=${util.escapeHtml(JSON.stringify(log))}"
							>
								${util.escapeHtml(util.maxStringLength(log.title, 40))}
							</a>
						</div>`;
					},
					get username() {
						const classes = wikishield.storage.data.highlight.users.has(user) ?
							'queue-highlight' : (response.userTalk === false ? 'queue-user-empty-talk' : '');

						return `<div class="username ${classes}">
							<span class="fa fa-user queue-edit-icon"></span>
							<span class="${response.userBlocked ? "user-blocked" : ""}">
								<a
									href="${util.pageLink(`User:${user}`)}"
									data-tooltip="${util.escapeHtml(user)}"
									data-multiple-hrefs="user;username=${encodeURIComponent(user)}"
								>${util.escapeHtml(util.maxStringLength(user, 30))}</a>
							</span>
						</div>`;
					},
					get performer() {
						const classes = wikishield.storage.data.highlight.users.has(log.user) ?
							'queue-highlight' : (performerResponse.userTalk === false ? 'queue-user-empty-talk' : '');

						return `<div class="username ${classes}">
							<span class="fa fa-user queue-edit-icon"></span>
							<span class="${performerResponse.userBlocked ? "user-blocked" : ""}">
								<a
									href="${util.pageLink(`User:${log.user}`)}"
									data-tooltip="${util.escapeHtml(log.user)}"
									data-multiple-hrefs="user;username=${encodeURIComponent(log.user)}"
								>${util.escapeHtml(util.maxStringLength(log.user, 30))}</a>
							</span>
						</div>`;
					},
				},
				page: {
					namespace: log.ns,
					title: log.title,
				},
				user: {
					ip: mw.util.isIPAddress(user),
					temporary: mw.util.isTemporaryUser(user),

					name: user,
					editCount: response.userEditCount,

					contribs: response.userContribs,

					warningLevel: this.getWarningLevel(response.userTalk || ""),
					warningHistory: this.getWarningHistory(response.userTalk || ""),

					blocked: response.userBlocked,
					blocks: response.userBlocks,

					emptyTalkPage: response.userTalk === false,
				},
				performer: {
					ip: mw.util.isIPAddress(log.user),
					temporary: mw.util.isTemporaryUser(log.user),

					name: log.user,
					editCount: performerResponse.userEditCount,

					contribs: performerResponse.userContribs,

					warningLevel: this.getWarningLevel(performerResponse.userTalk || ""),
					warningHistory: this.getWarningHistory(performerResponse.userTalk || ""),

					blocked: performerResponse.userBlocked,
					blocks: performerResponse.userBlocks,

					emptyTalkPage: performerResponse.userTalk === false,
				},

				revid: log.logid,

				timestamp: log.timestamp,
				comment: log.comment,

				mentionsMe: mentions.username || mentions.comment,
				mentions: mentions,

				isTalk: log.ns % 2 === 1,

				AI: {
					username: null // will be populated asynchronously
				},

				reviewed: false,
				fromHistory: false,
				__fromQueue__: type,

				simple: false,
				origin: log,
			};
			queueItems.push(queueItem);

			const storage = this.wikishield.storage.data;
			if (this.wikishield.AI) {
				if (!(queueItem.user.ip || queueItem.user.temporary) && !storage.whitelist.users.has(log.user) && storage.settings.AI.username_analysis.enabled) {
					this.wikishield.AI.analyze.username(queueItem)
						.then(usernameAnalysis => {
							queueItem.AI.username = usernameAnalysis;
							if (usernameAnalysis.flag) {
								this.promptForUAAReport(queueItem, usernameAnalysis);
							}
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

		const levels = [ "0", "1", "2", "3", "4", "4im" ];

		let highestLevel = "0";
		for (let section of monthSections) {
			if (new RegExp(`== ?${this.wikishield.util.monthSectionName()} ?==`).test(section)) {
				const templates = section.match(/<\!-- Template:[\w-]+?(\d(?:i?m)?) -->/g);
				if (templates === null) {
					break;
				}

				const filteredTemplates = [ ...templates.map(t => {
					const match = t.match(/<\!-- Template:[\w-]+?(\d(?:i?m)?) -->/);
					return match ? match[1].toString() : "0";
				}), highestLevel ].map(level => [ level, levels.indexOf(level) ]);

				highestLevel = filteredTemplates.sort((a, b) => b[1] - a[1])[0][0];
			}
		}

		return highestLevel;
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
		if (this.queue[this.currentQueueTab].length === 0) {
			return;
		}

		if (!this.currentEdit[this.currentQueueTab]) {
			this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][0];
			this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);
			return;
		}

		const currentIndex = this.queue[this.currentQueueTab].findIndex(e => e.revid === this.currentEdit[this.currentQueueTab]?.revid);
		if (currentIndex === -1) {
			this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][0];
			this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);
			return;
		}

		const editWeAreLeaving = this.currentEdit[this.currentQueueTab];
		if (currentIndex === 0 && !editWeAreLeaving.reviewed) {
			editWeAreLeaving.reviewed = true;
		}

		if (this.currentQueueTab === "flagged") {
			this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][Math.min(currentIndex + 1, this.queue[this.currentQueueTab].length - 1)];
			this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);
			return;
		}

		if (editWeAreLeaving && this.wikishield.AI) {
			this.wikishield.AI.cancel.edit(editWeAreLeaving.revid);
		}

		// Remove the current item from the queue
		this.queue[this.currentQueueTab].splice(currentIndex, 1);
		this.wikishield.interface.removeQueueItem(this.currentQueueTab, editWeAreLeaving.revid);

		if (this.queue[this.currentQueueTab].length > 0) {
			if (currentIndex < this.queue[this.currentQueueTab].length) {
				this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][currentIndex];
			} else {
				this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][this.queue.length - 1];
			}
		} else {
			this.currentEdit[this.currentQueueTab] = null;
		}

		const previousItems = this.previousItems[this.currentQueueTab];
		previousItems.push({ ...editWeAreLeaving, fromHistory: Date.now() });
		if (previousItems.length > 1000) {
			previousItems.shift();
		}

		this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);

		if (editWeAreLeaving && this.queueTypes[editWeAreLeaving.__fromQueue__] === "edit") {
			this.checkAndAutoWelcome(editWeAreLeaving);
		}
	}

	/**
	* Set the current edit to the previous item in the queue
	* This only changes which edit is selected, it does NOT remove anything
	*/
	prevItem() {
		if (!this.currentEdit[this.currentQueueTab] && this.queue[this.currentQueueTab].length > 0) {
			this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][0];
			this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);
			return;
		}

		const currentIndex = this.queue[this.currentQueueTab].findIndex(e => e.revid === this.currentEdit[this.currentQueueTab]?.revid);
		if (this.currentQueueTab === "flagged") {
			this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][Math.max(0, currentIndex - 1)];
			this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);
			return;
		}

		const editWeAreLeaving = this.currentEdit[this.currentQueueTab];
		if (currentIndex <= 0) {
			if (this.previousItems[this.currentQueueTab].length === 0) {
				return;
			}

			if (editWeAreLeaving && this.wikishield.AI) {
				this.wikishield.AI.cancel.edit(editWeAreLeaving.revid);
			}

			this.queue[this.currentQueueTab].unshift(this.previousItems[this.currentQueueTab].pop());
			this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][0];
			this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);

			if (editWeAreLeaving && this.queueTypes[editWeAreLeaving.__fromQueue__] === "edit") {
				this.checkAndAutoWelcome(editWeAreLeaving);
			}

			return;
		}

		if (editWeAreLeaving && this.wikishield.AI) {
			this.wikishield.AI.cancel.edit(editWeAreLeaving.revid);
		}

		this.currentEdit[this.currentQueueTab] = this.queue[this.currentQueueTab][currentIndex - 1];
		this.wikishield.interface.renderQueue(this.queue[this.currentQueueTab], this.currentEdit[this.currentQueueTab], this.currentQueueTab);

		if (editWeAreLeaving && this.queueTypes[editWeAreLeaving.__fromQueue__] === "edit") {
			this.checkAndAutoWelcome(editWeAreLeaving);
		}
	}

	/**
	* Check if user should be auto-welcomed and do so if needed
	* @param {Object} edit The edit object to check
	*/
	async checkAndAutoWelcome(edit) {
		if (!this.wikishield.storage.data.settings.auto_welcome.enabled) {
			return;
		}

		if (!edit.user || edit.user.temporary || edit.user.ip) {
			return;
		}

		if (this.wikishield.noAutoWelcomeList.has(edit.user.name)) {
			return;
		}

		if (!edit.user.emptyTalkPage) {
			return;
		}

		try {
			const title = `User talk:${edit.user.name}`;
			if ((await this.wikishield.api.pageExists(title))[title]) {
				edit.user.emptyTalkPage = false;
				return;
			}

			const confirmed = await this.wikishield.interface.showConfirmationDialog(
				"Auto-welcome User",
				`Would you like to welcome <span class="confirmation-modal-username">${this.wikishield.util.escapeHtml(edit.user.name)}</span>?<br><br>
					<span style="font-size: 0.9em; color: #888;">Editing: <strong>${this.wikishield.util.escapeHtml(edit.page.title)}</strong></span>`,
				edit.user.name
			);

			this.wikishield.noAutoWelcomeList.add(edit.user.name);
			if (!confirmed) {
				return;
			}

			this.wikishield.executeScript({
				actions: [
					{
						name: "welcome",
						params: {
							template: "Auto"
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
	async promptForUAAReport(edit, usernameAnalysis) { // TODO, allow for looking at recently edited pages
		// Only check registered users (not TEMPs)
		if (!edit.user?.name || mw.util.isTemporaryUser(edit.user.name) || mw.util.isIPAddress(edit.user.name)) {
			return;
		}

		if (this.wikishield.uaaReports && this.wikishield.uaaReports.includes(edit.user.name)) {
			return;
		}

		// Show confirmation dialog with AI analysis
		const violationLabel = usernameAnalysis.issues.map(issue => `${issue.severity} ${issue.policy} violation`).join(", ");
		const confidencePercent = Math.round(usernameAnalysis.confidence * 100);

		const confirmed = await this.wikishield.interface.showConfirmationDialog(
			"Report Username to UAA",
			`
				The username <span class="confirmation-modal-username">${this.wikishield.util.escapeHtml(edit.user.name)}</span> for ${violationLabel || "no specific issue"}.<br><br>
				<strong>AI Confidence:</strong> ${confidencePercent}%<br>
				<strong>Reasoning:</strong> ${this.wikishield.util.escapeHtml(usernameAnalysis.explanation)}<br>
			`,
			edit.user.name,
			true
		);

		if (confirmed) {
			const reason = await this.wikishield.interface.showUAAReasonDialog(edit.user.name);
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

	async propagateEdit(edit) {
		if (edit.propagating) {
			await edit.propagating;
			return;
		}

		if (edit.simple) {
			let resolvePropagate;
			edit.propagating = new Promise((resolve) => {
				resolvePropagate = resolve;
			});

			const loaded = (await this.generateQueueItems([{ type: edit.__fromQueue__, edit: edit.origin }]))[0];
			edit.page.history = loaded.page.history;
			edit.page.metadata = loaded.page.metadata;
			edit.reverts = loaded.reverts;

			edit.user.contribs = loaded.user.contribs;
			edit.user.blocks = loaded.user.blocks;

			edit.diff = loaded.diff;
			edit.consecutive = this.wikishield.api.consecutive(edit.page.title, edit.user.name);

			resolvePropagate();
			edit.simple = false;
			edit.propagating = null;
		}

		return;
	}

	/**
	* Load an edit from the user contributions list
	* @param {Number} revid
	*/
	async loadFromContribs(edit) {
		await this.propagateEdit(edit);

		const type = this.currentQueueTab;
		if (this.areSameQueueTypes(type, "contribs") && type !== "flagged") {
			this.queue[type] = this.queue[type].filter(item => item.revid !== edit.revid);
			const index = this.queue[type].findIndex(item => item.revid === this.currentEdit[type]?.revid);
			if (index > -1) {
				this.queue[type][index] = edit;
			}
		}

		this.currentEdit[type] = this.queue[type].find(item => item.revid === edit.revid) || edit;
		this.wikishield.interface.renderQueue(this.queue[type], this.currentEdit[type]);
	}

	/**
	* Load an edit from the page history list
	* @param {Number} revid
	*/
	async loadFromHistory(edit) {
		await this.propagateEdit(edit);

		const type = this.currentQueueTab;
		if (this.areSameQueueTypes(type, "history") && type !== "flagged") {
			this.queue[type] = this.queue[type].filter(item => item.revid !== edit.revid);
			const index = this.queue[type].findIndex(item => item.revid === this.currentEdit[type]?.revid);
			if (index > -1) {
				this.queue[type][index] = edit;
			}
		}

		this.currentEdit[type] = this.queue[type].find(item => item.revid === edit.revid) || edit;
		this.wikishield.interface.renderQueue(this.queue[type], this.currentEdit[type]);
	}

	/**
	* Load a specific revision by revid and page title (for loading newest revision)
	* @param {Number} revid The revision ID to load
	* @param {String} pageTitle The page title
	*/
	async loadSpecificRevision(revid, pageTitle) {
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

			if (this.areSameQueueTypes(type, "loaded") && type !== "flagged") {
				this.queue[type] = this.queue[type].filter(item => item.revid !== revid);
				const index = this.queue[type].findIndex(item => item.revid === this.currentEdit[type]?.revid);
				if (index > -1) {
					this.queue[type][index] = item;
				}
			}

			this.currentEdit[type] = this.queue[type].find(item => item.revid === revid) || item;
			this.wikishield.interface.renderQueue(this.queue[type], this.currentEdit[type]);
		} catch (err) {
			console.error("Failed to load specific revision:", err);
			this.wikishield.interface.elem("#diff-container").innerHTML = `<div class="error">Failed to load revision</div>`;
		}
	}
}