import { __script__ } from '../index.js';
import { WikiShieldInterface } from '../ui/interface.js';
import { WikiShieldLog } from '../utils/logger.js';
import { WikiShieldUtil } from '../utils/helpers.js';
import { WikiShieldAPI } from './api.js';
import { WikiShieldProgressBar } from '../ui/progress-bar.jsx';
import { notificationIcons } from '../data/notification-icons.js';
import { AudioManager } from '../audio/manager.js';
import { warnings } from '../data/warnings.js';
import { welcomes } from '../data/welcomes.js';

import { AI } from '../ai/class.js';
import { StorageManager } from '../data/storage.js';

export class WikiShield {
	constructor() {
		this.__script__ = __script__;

		this.storage = new StorageManager();

		this.defaultStorage = new StorageManager();
		this.defaultStorage.load();

		this.interface = new WikiShieldInterface(this);
		this.logger = new WikiShieldLog();
		this.util = new WikiShieldUtil(this);
		this.audioManager = new AudioManager(this);

		// Initialize API with dependencies
		this.api = new WikiShieldAPI(this, new mw.Api(), {
			testingMode: this.testingMode || false,
			logger: this.logger,
			util: this.util,
			historyCount: __script__.config.historyCount
		});
		this.checkWarningTemplates();
		this.checkWelcomeTemplates();

		// Initialize queue - will be set after wikishield global is assigned
		this.queue = null;

		// Load whitelist and highlight from storage
		this.noAutoWelcomeList = new Set(); // Track users who shouldn't be auto-welcomed

		this.AI = null;

		this.aivReports = [];
		this.uaaReports = [];

		this.rights = {
			rollback: false,
			protect: false,
			block: false,
			review: false
		};
		this.username = mw.config.values.wgUserName;

		this.alerts = [];
		this.notices = [];

		this.testingMode = false;
		this.tempCurrentEdit = null;

		this.lastSeenRevision = null;

		this.WikiShieldProgressBar = WikiShieldProgressBar;
	}

	checkWarningTemplates() {
		for (const [ type, categories ] of Object.entries(warnings)) {
			for (const [ category, categoryWarnings ] of Object.entries(categories)) {
				const length = categoryWarnings.length;
				for (let i = 0; i < length; i++) {
					const warning = categoryWarnings[i];
					const load = key => {
						if (warning.templates[key] === null) {
							return Promise.resolve(true);
						}

						const title = warning.templates[key]?.template.replace(/^subst:/, "Template:");
						return this.api.pageExists(title).then(exists => {
							return exists[title];
						});
					}

					{ // template lookup
						// check if ANY templates are missing
						Promise.allSettled([
							load("0"),
							load("1"),
							load("2"),
							load("3"),
							load("4"),
							load("4im")
						])
							.then(results => {
								if (results.some(res => res.status !== "fulfilled" || res.value === false)) {
									warning.hide = true;
								}
							});
					}
				}
			}
		}
	}

	checkWelcomeTemplates() {
		for (const welcome of Object.values(welcomes)) {
			if (typeof welcome.template === "string") {
				const title = welcome.template.replace(/^subst:/, "Template:");
				this.api.pageExists(title)
					.then(exists => {
						if (exists[title] === false) {
							welcome.hide = true;
						}
					});
			}
		}
	}

	async init(override = null, noInit = false) {
		const logs = this.storage.decode(override ?? await this.load()).logs;

		if (this.storage.data.settings.AI.enabled) {
			switch (this.storage.data.settings.AI.provider) {
				case "Ollama": {
					this.AI = new AI.providers.Ollama(
						this,
						this.storage.data.settings.AI.Ollama
					);
				} break;
				default: {
					this.AI?.cancel.all();
					this.AI = null;
				} break;
			}
		} else {
			this.AI?.cancel.all();
			this.AI = null;
		}

		if (noInit) {
			const queueWidth = this.storage.data.UI.queue.width;
			document.body.querySelector("#queue").style.width = queueWidth;
			document.body.querySelector("#right-container").style.width = `calc(100% - ${queueWidth})`;

			const detailsWidth = this.storage.data.UI.details.width;
			document.body.querySelector("#right-details").style.width = detailsWidth;
			document.body.querySelector("#main-container").style.width = `calc(100% - ${detailsWidth})`;
			document.body.querySelector("#middle-top").style.width = `calc(100% - ${detailsWidth})`;
			document.body.querySelector("#right-top").style.width = detailsWidth;

			return logs;
		}

		this.handleLoadingReported();

		this.entriesCleanupInterval = setInterval(() => {
			this.cleanupExpiredEntries();
		}, 30000);

		this.startInterface();

		return logs;
	}

	/**
	 * Initialize the interface and start WikiShield
	 */
	async startInterface() {
		// Get user rights
		const rights = await mw.user.getRights();
		this.rights.rollback = rights.includes("rollback");
		this.rights.review = rights.includes("review");
		this.rights.protect = rights.includes("protect");
		this.rights.block = rights.includes("block");

		this.interface.build();
	}

	/**
	 * Clean up expired highlights & whitelist entries
	 */
	cleanupExpiredEntries() {
		const now = Date.now();
		let changed = false;

		for (const [ key, value ] of Object.entries(this.storage.data.highlight)) {
			for (const [ name, time ] of value.entries()) {
				if (now >= time[1]) {
					value.delete(name);
					changed = true;
					this.logger.log(`Removed expired highlight for ${key}: ${name}`);
				}
			}
		}

		for (const [ key, value ] of Object.entries(this.storage.data.whitelist)) {
			for (const [ name, time ] of value.entries()) {
				if (now >= time[1]) {
					value.delete(name);
					changed = true;
					this.logger.log(`Removed expired whitelist for ${key}: ${name}`);
				}
			}
		}

		if (changed) {
			// Refresh the queue display if needed
			if (this.queue[this.currentQueueTab] && this.interface) {
				this.interface.renderQueue(this.queue.queue[this.queue.currentQueueTab], this.queue.currentEdit[this.queue.currentQueueTab]);
			}
		}
	}

	/**
	 * Start the queue and interface
	 */
	start() {
		this.interface.start();
		this.queue.fetchRecentChanges("recent");
		this.queue.fetchRecentChanges("flagged");
		this.queue.fetchRecentChanges("users");
		this.queue.fetchRecentChanges("watchlist");

		this.handleLoadingAlerts();
		this.handleLoadingNotices();
	}

	/**
	 * Revert an edit
	 * @param {Object} edit The edit to revert
	 * @param {String} summary Additional summary text
	 * @param {Boolean} goodFaith Whether this is a good faith revert
	 * @returns {Boolean} Whether the revert was successful
	 */
	async revert(edit, summary, goodFaith = false) {
		if (!edit) {
			return false;
		}

		if (!this.rights.rollback) {
			return false;
		}

		const message = `Reverted ${goodFaith ? "[[WP:AGF|good faith]] " : ""}edits by ${this.api.buildUser(edit.user.name)}`;
		const success = await this.api.rollback(edit.page.title, edit.user.name, this.api.buildMessage(message, summary));

		if (!success) {
			this.interface.showToast(
				"Revert Failed",
				`Could not revert edits on "${edit.page.title}" - a newer edit may have been made`,
				5000,
				"error"
			);

			return false;
		}

		// Update statistics
		this.storage.data.statistics.reverts_made.total++;
		if (goodFaith) {
			this.storage.data.statistics.reverts_made.good_faith++;
		}

		switch (edit.__fromQueue__) {
			case "recent": {
				this.storage.data.statistics.reverts_made.from_recent_changes++;
			} break;
			case "flagged": {
				this.storage.data.statistics.reverts_made.from_flagged++;
			} break;
			case "loaded": {
				this.storage.data.statistics.reverts_made.from_loaded_edits++;
			} break;
			case "watchlist": {
				this.storage.data.statistics.reverts_made.from_watchlist++;
			} break;
		}

		return true;
	}

	async warnUser(user, warning, level, articleName, revid) {
		// Get current talk page content
		let talkPageContent = await this.api.getSinglePageContent(`User talk:${user}`);

		// Ensure month section exists
		const monthSection = this.util.monthSectionName();
		if (!talkPageContent.match(`== ?${monthSection} ?==`)) {
			talkPageContent += `\n== ${monthSection} ==\n`;
		}

		// Split by section headers to find the current month section
		const sections = talkPageContent.split(/(?=== ?[\w\d ]+ ?==)/g);

		let warningLevel = null;
		if (level !== "auto") {
			warningLevel = level;
		} else {
			const currentLevel = this.queue.getWarningLevel(talkPageContent).toString();
			if (typeof warning.auto === "function") {
				warningLevel = warning.auto(this.queue.currentEdit, currentLevel);
			} else {
				warningLevel = warning.auto[currentLevel];
			}
		}

		const templateToUse = warning.templates[warningLevel];
		if (!templateToUse) {
			if (level !== "auto") {
				this.interface.showToast(
					"Warning Failed",
					`Could not find ${level} template for warning type "${warning.title}"`,
					5000,
					"error"
				);
			}

			return;
		}

		// Find the month section and append the warning
		for (let i in sections) {
			if (sections[i].match(new RegExp(`== ?${monthSection} ?==`))) {
				sections[i] += `\n\n{{${templateToUse.template}|${articleName}|${templateToUse.additional || ""}}} ~~~~`;
				break;
			}
		}

		// Join sections and clean up excessive newlines
		const newContent = sections.join("").replace(/(\n){3,}/g, "\n\n");

		const levelName = templateToUse.level ?? `level ${warningLevel}`;

		const message = `Message about ${articleName ? `[[Special:Diff/${revid}|your edit]] on [[${articleName}]]` : `[[Special:Contributions/${user}|your contributions]]`}`;
		await this.api.edit(`User talk:${user}`, newContent, this.api.buildMessage(message, levelName));

		// Increment warning statistic
		this.storage.data.statistics.warnings_issued.total++;
		if (!("level" in templateToUse)) {
			const key = `level_${warningLevel}`;
			if (key in this.storage.data.statistics.warnings_issued) {
				this.storage.data.statistics.warnings_issued[key]++;
			}
		}


		// Add user talk page to watchlist with configured expiry
		try {
			const expiry = this.util.expiryToMilliseconds(this.storage.data.settings.expiry.watchlist);
			if (expiry > 0) {
				const toExpire = new Date(Date.now() + expiry);

				await this.api.postWithToken("watch", {
					"action": "watch",
					"titles": `User talk:${user}`,
					"expiry": expiry === Infinity ? "infinity" : this.util?.utcString(toExpire)
				});
			}
		} catch (err) {
			console.log(`Could not add User talk:${user} to watchlist:`, err);
		}

		// Update the warning level in the current edit object (only if the template has a numbered level)
		if (!("level" in templateToUse) && this.queue.currentEdit[this.queue.currentQueueTab]?.user?.name === user) {
			this.queue.currentEdit[this.queue.currentQueueTab].user.warningLevel = levelName;
		}
	}

	/**
	 * Load the users currently reported to AIV and UAA
	 */
	async loadReportedUsers() {
		try {
			const content = await this.api.getText(`${__script__.pages.AVI}|${__script__.pages.UAA}`);

			const regex = new RegExp(`{{(?:(?:ip)?vandal|user-uaa)\\|(?:1=)?(.+?)}}`, "gi");

			// Check if AVI content exists before trying to match
			if (content && content[__script__.pages.AVI]) {
				this.aivReports = [...content[__script__.pages.AVI].matchAll(regex)]
					.map(report => report[1]);
			} else {
				console.warn("AVI content not found, skipping AVI reports");
				this.aivReports = [];
			}

			// Check if UAA content exists before trying to match
			if (content && content[__script__.pages.UAA]) {
				this.uaaReports = [...content[__script__.pages.UAA].matchAll(regex)]
					.map(report => report[1]);
			} else {
				console.warn("UAA content not found, skipping UAA reports");
				this.uaaReports = [];
			}
		} catch (err) {
			console.log("Error while fetching reported users", err);
			// Initialize as empty arrays on error
			this.aivReports = this.aivReports || [];
			this.uaaReports = this.uaaReports || [];
		}
	}

	/**
	 * Every 15 seconds, call loadReportedUsers
	 */
	async handleLoadingReported() {
		await this.loadReportedUsers();

		window.setTimeout(() => {
			this.handleLoadingReported();
		}, 15000);
	}

	/**
	 * Escape HTML to prevent XSS
	 */
	escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	formatNotificationTime(date) {
		const diff = Math.floor((Date.now() - date) / 1000); // seconds

		// Handle future timestamps (clock skew)
		if (diff < 0) return "0s";

		if (diff < 60) {
			return `${diff}s`;
		} else if (diff < 3600) {
			const mins = Math.floor(diff / 60);
			return `${mins}m`;
		} else if (diff < 86400) {
			const hours = Math.floor(diff / 3600);
			return `${hours}h`;
		}

		const days = Math.floor(diff / 86400);
		return `${days}d`;
	}

	updateNotificationsCount() {
		let totalUnread = 0;
		const zenMode = this.storage.data.settings.zen_mode;
		if (!zenMode.enabled || zenMode.alerts.enabled) {
			totalUnread += this.alerts.filter(n => !n.read).length;
		}

		if (!zenMode.enabled || zenMode.notices.enabled) {
			totalUnread += this.notices.filter(n => !n.read).length;
		}

		if (totalUnread === 0) {
			document.title = "WikiShield";
		} else {
			document.title = `(${totalUnread}) WikiShield`;
		}
	}

	/**
	 * Load alerts from Wikipedia
	 */
	async loadAlerts() {
		try {
			const [ alertsResponse ] = await Promise.all([
				this.api.api.get({
					action: "query",
					meta: "notifications",
					notlimit: 20,
					notprop: "list",
					notfilter: "!read",
					notsections: "alert",
					notformat: "model"
				})
			]);

			const alerts = alertsResponse.query?.notifications?.list ?? [];
			await Promise.all(alerts.map(async n => {
				return this.api.parseWikitext(n["*"].body).then(parsed => {
					n["*"].body = parsed;
					return n;
				});
			}));

			let hasNewAlerts = false;
			for (const alert of alerts) {
				const existing = this.alerts.find(n => n.id === alert.id);
				if (!existing) {
					this.alerts.unshift(alert);
					hasNewAlerts = true;
				}
			}

			if (hasNewAlerts && this.alerts.length > 0) {
				const zenMode = this.storage.data.settings.zen_mode;
				if (!zenMode.enabled || zenMode.alerts.enabled) {
					this.audioManager.playSound([ "notification", "alert" ]);
				}
			}

			this.alerts.sort((a, b) => {
				return b.timestamp.utcunix - a.timestamp.utcunix;
			});

			if (this.alerts.length > 25) {
				this.alerts = this.alerts.slice(0, 25);
			}

			this.updateAlertsDisplay();
		} catch (err) {
			console.log("Error while fetching alerts", err);
		}
	}

	/**
	 * Every 10 seconds, call loadAlerts
	 */
	async handleLoadingAlerts() {
		await this.loadAlerts();

		window.setTimeout(() => {
			this.handleLoadingAlerts();
		}, 10000);
	}

	/**
	 * Update the alerts count and list display
	 */
	updateAlertsDisplay() {
		this.updateNotificationsCount();

		const unreadCount = this.alerts.filter(n => !n.read).length;
		const countElem = document.querySelector("#alerts-count");
		const listElem = document.querySelector("#alerts-list");

		// Check if elements exist (UI might not be ready yet)
		if (!countElem || !listElem) {
			return;
		}

		if (unreadCount > 0) {
			countElem.textContent = unreadCount;
			countElem.classList.remove("hidden");
		} else {
			countElem.classList.add("hidden");
		}

		// Update list
		if (listElem) {
			if (this.alerts.length === 0) {
				listElem.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No new alerts</div>';
			} else {
				listElem.innerHTML = "";
				this.alerts.forEach(alert => {
					const model = alert["*"];

					// Parse timestamp
					const timeStr = this.formatNotificationTime(new Date(alert.timestamp.utciso8601));

					{ // create element
						const $alert = document.createElement("div");
						$alert.classList.add("notification");
						$alert.classList.add(alert.read ? "read" : "unread");
						$alert.addEventListener("click", () => {
							this.markAlertItemRead(alert);
							window.open(model.links.primary.url, "_blank");
						});

						{ // icon
							const $icon = document.createElement("div");
							$icon.classList.add("notification-icon");
							$icon.innerHTML = `<img src="${model.iconUrl}" alt="Icon">`;
							$alert.appendChild($icon);
						}

						{ // content
							const $content = document.createElement("div");
							$content.classList.add("notification-content");
							$alert.appendChild($content);

							{ // header
								const $header = document.createElement("div");
								$header.classList.add("notification-header");
								$header.innerHTML = this.util.maxStringLength(model.header, 100);
								$content.appendChild($header);
							}

							{ // body
								const $body = document.createElement("div");
								$body.classList.add("notification-body");
								$body.innerHTML = model.body;
								$content.appendChild($body);

								$body.querySelectorAll("a").forEach(link => {
									link.target = "_blank";
								});
							}

							{ // links
								const $links = document.createElement("div");
								$links.classList.add("notification-links");

								model.links.secondary.forEach(link => {
									const $link = document.createElement("a");
									$link.href = link.url;
									$link.target = "_blank";
									$link.textContent = link.label;
									$links.appendChild($link);
								});

								$content.appendChild($links);
							}
						}

						{ // right
							const $right = document.createElement("div");
							$right.classList.add("notification-right");
							$alert.appendChild($right);

							if (!alert.read) {
								{ // unread indicator
									const $unread = document.createElement("div");
									$unread.classList.add("notification-unread-indicator");

									$unread.addEventListener("click", (e) => {
										e.stopPropagation();
										this.markAlertItemRead(alert);
									});

									$right.appendChild($unread);
								}
							}

							{ // time
								const $time = document.createElement("div");
								$time.classList.add("notification-timestamp");
								$time.dataset.time = alert.timestamp.utciso8601;
								$time.dataset.timeFormat = "notification";
								$time.textContent = timeStr;
								$right.appendChild($time);
							}
						}

						listElem.appendChild($alert);
					}
				});
			}
		}
	}

	/**
	 * Mark a alert as read
	 */
	markAlertItemRead(alert) {
		alert.read = true;
		this.api.api.postWithEditToken({
			action: "echomarkread",
			sections: "alert",
			list: alert.id
		});
		this.updateAlertsDisplay();
	}

	/**
	 * Mark all alerts as read
	 */
	markAllAlertsRead() {
		this.alerts.forEach(n => n.read = true);
		this.api.api.postWithEditToken({
			action: "echomarkread",
			sections: "alert",
			all: true
		});
		this.updateAlertsDisplay();
	}

	markAllAlertsSeen() {
		this.api.api.postWithEditToken({
			action: "echomarkseen",
			type: "alert",
		});
	}

	/**
	 * Load notices from Wikipedia
	 */
	async loadNotices() {
		try {
			const [ noticesResponse ] = await Promise.all([
				this.api.api.get({
					action: "query",
					meta: "notifications",
					notlimit: 20,
					notprop: "list",
					notfilter: "!read",
					notsections: "message",
					notformat: "model"
				})
			]);

			const notices = noticesResponse.query?.notifications?.list ?? [];
			await Promise.all(notices.map(async n => {
				return this.api.parseWikitext(n["*"].body).then(parsed => {
					n["*"].body = parsed;
					return n;
				});
			}));

			let hasNewNotices = false;
			for (const notice of notices) {
				const existing = this.notices.find(n => n.id === notice.id);
				if (!existing) {
					this.notices.unshift(notice);
					hasNewNotices = true;
				}
			}

			if (hasNewNotices && this.notices.length > 0) {
				const zenMode = this.storage.data.settings.zen_mode;
				if (!zenMode.enabled || zenMode.notices.enabled) {
					this.audioManager.playSound([ "notification", "notice" ]);
				}
			}

			this.notices.sort((a, b) => {
				return b.timestamp.utcunix - a.timestamp.utcunix;
			});

			if (this.notices.length > 25) {
				this.notices = this.notices.slice(0, 25);
			}

			this.updateNoticesDisplay();
		} catch (err) {
			console.log("Error while fetching notices", err);
		}
	}

	/**
	 * Every 10 seconds, call loadNotices
	 */
	async handleLoadingNotices() {
		await this.loadNotices();

		window.setTimeout(() => {
			this.handleLoadingNotices();
		}, 10000);
	}

	/**
	 * Update the notices count and list display
	 */
	updateNoticesDisplay() {
		this.updateNotificationsCount();

		const unreadCount = this.notices.filter(n => !n.read).length;
		const countElem = document.querySelector("#notices-count");
		const listElem = document.querySelector("#notices-list");

		// Check if elements exist (UI might not be ready yet)
		if (!countElem || !listElem) {
			return;
		}

		if (unreadCount > 0) {
			countElem.textContent = unreadCount;
			countElem.classList.remove("hidden");
		} else {
			countElem.classList.add("hidden");
		}

		// Update list
		if (listElem) {
			if (this.notices.length === 0) {
				listElem.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No new notices</div>';
			} else {
				listElem.innerHTML = "";
				this.notices.forEach(notice => {
					const model = notice["*"];

					// Parse timestamp
					const timeStr = this.formatNotificationTime(new Date(notice.timestamp.utciso8601));

					{ // create element
						const $notice = document.createElement("div");
						$notice.classList.add("notification");
						$notice.classList.add(notice.read ? "read" : "unread");
						$notice.addEventListener("click", () => {
							this.markNoticeItemRead(notice);
							window.open(model.links.primary.url, "_blank");
						});

						{ // icon
							const $icon = document.createElement("div");
							$icon.classList.add("notification-icon");
							$icon.innerHTML = `<img src="${model.iconUrl}" alt="Icon">`;
							$notice.appendChild($icon);
						}

						{ // content
							const $content = document.createElement("div");
							$content.classList.add("notification-content");
							$notice.appendChild($content);

							{ // header
								const $header = document.createElement("div");
								$header.classList.add("notification-header");
								$header.innerHTML = this.util.maxStringLength(model.header, 100);
								$content.appendChild($header);
							}

							{ // body
								const $body = document.createElement("div");
								$body.classList.add("notification-body");
								$body.innerHTML = model.body;
								$content.appendChild($body);

								$body.querySelectorAll("a").forEach(link => {
									link.target = "_blank";
								});
							}

							{ // links
								const $links = document.createElement("div");
								$links.classList.add("notification-links");

								model.links.secondary.forEach(link => {
									const $link = document.createElement("a");
									$link.href = link.url;
									$link.target = "_blank";
									$link.textContent = link.label;
									$links.appendChild($link);
								});

								$content.appendChild($links);
							}
						}

						{ // right
							const $right = document.createElement("div");
							$right.classList.add("notification-right");
							$notice.appendChild($right);

							if (!notice.read) {
								{ // unread indicator
									const $unread = document.createElement("div");
									$unread.classList.add("notification-unread-indicator");

									$unread.addEventListener("click", (e) => {
										e.stopPropagation();
										this.markNoticeItemRead(notice);
									});

									$right.appendChild($unread);
								}
							}

							{ // time
								const $time = document.createElement("div");
								$time.classList.add("notification-timestamp");
								$time.dataset.time = notice.timestamp.utciso8601;
								$time.dataset.timeFormat = "notification";
								$time.textContent = timeStr;
								$right.appendChild($time);
							}
						}

						listElem.appendChild($notice);
					}
				});
			}
		}
	}

	/**
	 * Mark a alert as read
	 */
	markNoticeItemRead(notice) {
		notice.read = true;
		this.api.api.postWithEditToken({
			action: "echomarkread",
			sections: "message",
			list: notice.id
		});
		this.updateNoticesDisplay();
	}

	/**
	 * Mark all notices as read
	 */
	markAllNoticesRead() {
		this.notices.forEach(n => n.read = true);
		this.api.api.postWithEditToken({
			action: "echomarkread",
			sections: "message",
			all: true
		});
		this.updateNoticesDisplay();
	}

	markAllNoticesSeen() {
		this.api.api.postWithEditToken({
			action: "echomarkseen",
			type: "message",
		});
	}

	/**
	 * Check if a user is reported to AIV
	 * @param {String} name The username to check
	 * @param {Boolean} recheck Whether to recheck the reports
	 * @returns {Promise<Boolean>} Whether the user is reported to AIV
	 */
	async userReportedToAiv(name, recheck = true) {
		if (recheck) {
			await this.loadReportedUsers();
		}

		return this.aivReports.some((report) => report.toLowerCase() === name.toLowerCase());
	}

	/**
	 * Check if a user is reported to UAA
	 * @param {String} name The username to check
	 * @param {Boolean} recheck Whether to recheck the reports
	 * @returns {Promise<Boolean>} Whether the user is reported to UAA
	 */
	async userReportedToUaa(name, recheck = true) {
		if (recheck) {
			await this.loadReportedUsers();
		}

		return this.uaaReports.some((report) => report.toLowerCase() === name.toLowerCase());
	}

	/**
	 * Give a user a welcome template, if not already given
	 * @param {Object} user The user to welcome
	 * @param {String} template Which welcome template to use
	 */
	async welcomeUser(user, templateName) {
		try {
			const talkPageName = `User talk:${user.name}`;
			if ((await this.api.pageExists(talkPageName))[talkPageName]) {
				return false;
			}

			let template = welcomes[templateName];
			if (!template || template.hide) {
				return false;
			}

			const checkForLoop = new Set([ template ]);
			while (typeof template?.template === "function") {
				template = welcomes[template.template(user)];
				if (checkForLoop.has(template)) {
					this.interface.showToast(
						"REPORT TO DEVELOPER",
						`Uh oh! Something has gone catastrophically wrong. Please report this to a developer, and include the error code below:<br><br><code>WELCOME_TEMPLATE_LOOP</code>`,
						-1,
						"developer"
					);
					return false;
				}

				if (!template || template.hide) {
					return false;
				} else {
					checkForLoop.add(template);
				}
			}

			const content = `{{${template.template}}}${template.sign ? ` ~~~~` : ""}`;

			await this.api.edit(
				talkPageName,
				content,
				this.api.buildMessage("Welcoming to Wikipedia")
			);

			// Increment welcome statistic
			this.storage.data.statistics.users_welcomed.total++;

			// Update all edits in the queue from this user
			this.queue.queue[this.queue.currentQueueTab].forEach(edit => {
				if (edit.user && edit.user.name === name) {
					edit.user.emptyTalkPage = false;
					// Remove the existing DOM element so it gets re-rendered
					const elem = document.querySelector(`.queue-edit[data-revid="${edit.revid}"]`);
					if (elem) {
						elem.remove();
					}
				}
			});

			// Re-render the queue to update the display
			this.interface.renderQueue(this.queue.queue[this.queue.currentQueueTab], this.queue.currentEdit[this.queue.currentQueueTab]);

			return true;
		} catch (err) {
			console.log("Error while welcoming user", err);
		}

		return false;
	}

	/**
	 * Check if protection has already been requested at RFPP
	 * @param {String} title Page to check
	 * @returns {Promise<Boolean>} Whether there is an existing request
	 */
	async checkIfProtectionRequested(title) {
		const rfppContent = await this.api.getSinglePageContent(__script__.pages.RFPP);
		const pageRegex = new RegExp(`= ?${RegExp.escape(title)} ?=`, "i");

		return rfppContent.match(pageRegex) !== null;
	}

	/**
	 * Add a new request for protection at RFPP
	 * @param {String} title Page to request protection for
	 * @param {String} level Semi, pending, extended, full
	 * @param {String} reason Reason for requesting protection
	 */
	async requestProtection(title, level, reason) {
		if (await this.checkIfProtectionRequested(title)) {
			return false;
		}

		await this.api.appendText(__script__.pages.RFPP, `
			=== [[${title}]] ===
			* {{pagelinks|${title}}}
			'''${level}'''${reason ? `: ${reason}` : "."} ~~~~
		`.replaceAll("\t", ""), this.api.buildMessage(`Requesting protection for [[${title}]]`));

		this.storage.data.statistics.reports_filed.total++;
		this.storage.data.statistics.reports_filed.RFPP++;

		return true;
	}

	/**
	 * Report a user to AIV
	 * @param {String} name The username to report
	 * @param {String} message The message to use in the report
	 */
	async reportToAIV(user, message) {
		const blocked = await this.api.getBlocks(user);

		if (blocked[user]) {
			return false;
		}

		if (await this.userReportedToAiv(user)) {
			return false;
		}

		const content = `* {{vandal|${user}}} &ndash; ${message} ~~~~`;

		await this.api.appendText(
			__script__.pages.AVI,
			content,
			this.api.buildMessage(`Reporting [[Special:Contributions/${user}|${user}]]`)
		);

		this.audioManager.playSound([ "action", "report" ]);

		this.storage.data.statistics.reports_filed.total++;
		this.storage.data.statistics.reports_filed.AVI++;

		return true;
	}

	/**
	 * Report a user to UAA
	 * @param {String} name The username to report
	 * @param {String} message The message to use in the report
	 */
	async reportToUAA(user, message) {
		const blocked = await this.api.getBlocks(user);

		if (blocked[user]) {
			// already blocked
			return false;
		}

		if (await this.userReportedToUaa(user)) {
			// already reported
			return false;
		}

		const content = `* {{user-uaa|${user}}} &ndash; ${message} ~~~~`;

		await this.api.appendText(
			__script__.pages.UAA,
			content,
			this.api.buildMessage(`Reporting [[Special:Contributions/${user}|${user}]]`)
		);

		this.audioManager.playSound([ "action", "report" ]);

		// Add user to no-auto-welcome list since they were reported to UAA
		this.noAutoWelcomeList.add(user);

		this.storage.data.statistics.reports_filed.total++;
		this.storage.data.statistics.reports_filed.UAA++;

		return true;
	}

	/**
	 * Handle a keypress
	 * @param {KeyboardEvent} event The keypress event
	 */
	keyPressed(event) {
		if (this.interface.settings.isOpen) {
			this.interface.settings.handleKeypress(event);
			return;
		}

		if (document.activeElement.tagName.toLowerCase() === "input") {
			return;
		}

		if (event.ctrlKey || event.altKey || event.metaKey) {
			return;
		}

		if (event.key === " " && event.target === document.body) {
			event.preventDefault();
		}

		for (const script of this.storage.data.control_scripts) {
			if (script.keys.includes(event.key.toLowerCase())) {
				this.executeScript(script);
			}
		}
	}

	/**
	 * Execute a control script
	 * @param {Object} script
	 */
	async executeScript(script, hasContinuity = true, updateProgress = null, currentEdit = null) {
		const base = updateProgress === null;

		if (base) {
			const allScripts = [script];
			let totalActions = 0;

			while (allScripts.length > 0) {
				const current = allScripts[0];
				const willBeRun = (current.name && current.name === "if"
					&& this.interface.eventManager.conditions[current.condition].check(this, this.queue.currentEdit[this.queue.currentQueueTab])) || !current.name;

				if (willBeRun) {
					allScripts.push(...current.actions);
				}

				if (current.name && current.name !== "if"
					&& this.interface.eventManager.events[current.name].includeInProgress) {
					totalActions++;
				}

				allScripts.splice(0, 1);
			}

			if (totalActions > 0) {
				let actionsCompleted = 0;
				const progressBar = new WikiShieldProgressBar();

				updateProgress = (text) => {
					const portion = text === "Done" ? 1 : actionsCompleted / totalActions;
					progressBar.set(text, portion, "var(--main-blue)");
					actionsCompleted++;
				};
			} else {
				updateProgress = (_) => { };
			}

			currentEdit ??= this.queue.currentEdit[this.queue.currentQueueTab] || 1;
		}

		const ifAndTrue = script.name && script.name === "if" && this.interface.eventManager.conditions[script.condition].check(this, currentEdit);

		if (ifAndTrue || !script.name) {
			for (const action of script.actions) {
				if (action.name === "if") {
					hasContinuity = await this.executeScript(action, hasContinuity, updateProgress, currentEdit);
				} else {
					const event = this.interface.eventManager.events[action.name];

					if (hasContinuity || !event.needsContinuity) {
						if (currentEdit !== 1 || event.runWithoutEdit) {
							updateProgress(event.progressDesc);

							if (event.includeInProgress) {
								this.audioManager.playSound([ "action", "default" ]);
							}

							const result = await event.func(this, action.params, currentEdit);

							this.storage.data.statistics.actions_executed.total++;
							if (result === false) {
								hasContinuity = false;
								this.audioManager.playSound([ "action", "failed" ]);
							} else {
								this.storage.data.statistics.actions_executed.successful++;
							}
						}
					}
				}
			}
		}

		if (!script.name) {
			updateProgress("Done");
		}

		return hasContinuity;
	}

	async save(noSave = false) {
		const { string, logs } = this.storage.encode();

		StorageManager.outputLogs(logs); // TEMP

		if (noSave) {
			return string;
		}

		if (mw.storage.store.getItem("WikiShield:CloudStorage") === "false") {
			mw.storage.store.setItem("WikiShield:Storage", string);
			return true;
		} else {
			return await this.api.edit(
				`User:${mw.config.values.wgUserName}/ws-save.js`,
				string,
				this.api.buildMessage("Updating WikiShield save"),
				{ minor: true }
			);
		}
	}

	async load() {
		if (mw.storage.store.getItem("WikiShield:CloudStorage") === "false") {
			return mw.storage.store.getItem("WikiShield:Storage") ?? "e30=";
		} else {
			return await this.api.getSinglePageContent(`User:${mw.config.values.wgUserName}/ws-save.js`) ?? "e30=";
		}
	}
}