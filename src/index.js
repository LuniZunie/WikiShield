// <nowiki>

import { subdomains } from './config/languages.js';
import { fullTrim } from './utils/formatting.js';
import { BuildAIAnalysisPrompt, BuildAIUsernamePrompt } from './ai/prompts.js';
import { defaultSettings, colorPalettes } from './config/defaults.js';
import { warnings, warningTemplateColors, warningsLookup, getWarningFromLookup } from './data/warnings.js';
import { namespaces } from './data/namespaces.js';
import { sounds } from './data/sounds.js';
import { wikishieldHTML } from './ui/templates.js';
import { wikishieldStyling } from './ui/styles.js';
import { WikiShieldUtil } from './utils/helpers.js';
import { WikiShieldLog } from './utils/logger.js';
import { WikiShieldAPI } from './core/api.js';
import { WikiShieldOllamaAI } from './ai/ollama.js';
import { WikiShieldQueue } from './core/queue.js';
import { createConditions, welcomeTemplates } from './data/events.js';
import { WikiShieldEventManager } from './core/event-manager.js';
import { WikiShieldSettingsInterface, wikishieldSettingsAllowedKeys } from './ui/settings.js';
import { WikiShieldInterface } from './ui/interface.js';
import { WikiShieldProgressBar } from './ui/progress-bar.jsx';

export const __script__ = {
	version: "1.0.0",

	changelog: {
		version: "1",
		HTML: `<h1 class="settings-section-title">Changelog</h1>
		<p>In development</p>`
	},

	pages: {
		AVI: "Wikipedia:Administrator intervention against vandalism",
		UAA: "Wikipedia:Usernames for administrator attention",
		RFPP: "Wikipedia:Requests for page protection/Increase"
	},

	config: {
		refresh: 1000,
		historyCount: 10,
	},

	tags: {
		whitelisted: [
			"OAuth CID: 4978", // dashboard.wikiedu.org [2.3]
		],
	}
};

{
	"use strict";

	// Construct wikishieldData from imported modules
	const wikishieldData = {
		defaultSettings,
		colorPalettes,
		warningTemplateColors,
		warnings,
		warningsLookup,
		namespaces,
		sounds
	};

	// Classes moved to separate files - see imports at top

	// WikiShieldEventManager moved to src/core/event-manager.js


	// WikiShieldSettingsInterface moved to src/ui/settings.js
	// WikiShieldInterface moved to src/ui/interface.js
	// WikiShieldProgressBar moved to src/ui/progress-bar.jsx (React component)

	class WikiShield {
		constructor() {
			this.__script__ = __script__;

			this.interface = new WikiShieldInterface(this);
			this.logger = new WikiShieldLog();
			this.util = new WikiShieldUtil();

			// Initialize API with dependencies
			this.api = new WikiShieldAPI(this, new mw.Api(), {
				testingMode: this.testingMode || false,
				logger: this.logger,
				util: this.util,
				historyCount: __script__.config.historyCount
			});

			// Initialize queue - will be set after wikishield global is assigned
			this.queue = null;

			// Load whitelist and highlighted from storage
			this.noAutoWelcomeList = new Set(); // Track users who shouldn't be auto-welcomed

			// Initialize Ollama AI if enabled (preserves last saved state)
			this.ollamaAI = null;

			this.aivReports = [];
			this.uaaReports = [];

			this.rights = {
				rollback: false,
				protect: false,
				block: false
			};
			this.username = mw.config.values.wgUserName;

			this.mostRecentWatchlist = this.util.utcString(new Date());

			this.notifications = [];
			this.watchlist = [];

			this.testingMode = false;
			this.tempCurrentEdit = null;

			this.lastSeenRevision = null;

			this.wikishieldData = wikishieldData;
			this.WikiShieldProgressBar = WikiShieldProgressBar;
		}

		async init() {
			const obj = await this.load();

			this.loadedChangelog = this.loadChangelogVersion(obj.changelog);

			this.whitelist = this.loadWhitelist(obj.whitelist);
			this.highlighted = this.loadHighlighted(obj.highlighted);

			this.queueWidth = obj.queueWidth || mw.storage.store.getItem("WikiShield:QueueWidth") || "15vw";
			this.detailsWidth = obj.detailsWidth || mw.storage.store.getItem("WikiShield:DetailsWidth") || "15vw";

			this.statistics = this.loadStats(obj.statistics);

			this.options = this.loadOptions(obj.options);

			this.handleLoadingReported();
			this.handleLoadingNotifications();
			this.handleLoadingWatchlist();

			this.highlightCleanupInterval = setInterval(() => {
				this.cleanupExpiredHighlights();
			}, 30000);

			if (this.options.enableOllamaAI) {
				this.ollamaAI = new WikiShieldOllamaAI(
					this.options.ollamaServerUrl,
					this.options.ollamaModel,
					{
						enableOllamaAI: this.options.enableOllamaAI,
						enableEditAnalysis: this.options.enableEditAnalysis
					}
				);
				this.logger.log("Ollama AI integration enabled");
			}

			this.startInterface();
		}

		/**
		 * Load the changelog version from storage
		 * @returns {String} The changelog version
		 */
		loadChangelogVersion(data) {
			const version = data ?? mw.storage.store.getItem("WikiShield:ChangelogVersion");

			if (!version) {
				mw.storage.store.setItem("WikiShield:ChangelogVersion", 0);
				return 0;
			}

			return version;
		}

		/**
		 * Load user options from storage
		 */
		loadOptions(data) {
			let options = {};
			try {
				options = data ?? JSON.parse(mw.storage.store.getItem("WikiShield:Settings"));
			} catch (err) {
				// Parsing error, use empty object
			}
			options = options || {};

			// Fill in missing options with defaults
			for (const key in defaultSettings) {
				const value = options[key];
				if (value === undefined) {
					options[key] = defaultSettings[key];
				} else if (typeof value === "object" && !Array.isArray(value)) {
					// For nested objects, fill in missing nested keys
					for (const nestedKey in defaultSettings[key]) {
						if (value[nestedKey] === undefined) {
							value[nestedKey] = defaultSettings[key][nestedKey];
						}
					}
				}
			}

			// Ensure controls are in the right format (array of arrays of strings)
			for (const script of options.controlScripts ?? []) {
				if (typeof script.keys === "string") {
					script.keys = [ script.keys ];
					script.keys = script.keys.map(key => key.toLowerCase());
				}

				script.actions = script.actions.flatMap(action => {
					if (action.name === "rollbackAndWarn") {
						action = [
							{
								name: "rollback",
								params: {}
							},
							{
								name: "warn",
								params: {
									warningType: action.params.warningType || "Vandalism",
									level: action.params.level || "auto"
								}
							},
						];
					}

					return action;
				});
			}

			return options;
		}

		/**
		 * Load whitelist from storage
		 */
		loadWhitelist(data) {
			try {
				const stored = data ?? JSON.parse(mw.storage.store.getItem("WikiShield:Whitelist"));
				if (stored && stored.length > 0) {
					// Check if it's old format (array of strings) or new format (array of [username, timestamp] pairs)
					if (typeof stored[0] === "string") {
						// Old format - convert to new format with current timestamp
						return new Map(stored.map(username => [username, Date.now()]));
					} else {
						// New format
						return new Map(stored);
					}
				}
				return new Map();
			} catch (err) {
				return new Map();
			}
		}

		/**
		 * Load highlighted users from storage
		 */
		loadHighlighted(data) {
			try {
				const stored = data ?? JSON.parse(mw.storage.store.getItem("WikiShield:Highlighted"));
				return new Map(stored || []);
			} catch (err) {
				return new Map();
			}
		}

		/**
		 * Load statistics from storage
		 */
		loadStats(data) {
			let stats;
			try {
				stats = data ?? JSON.parse(mw.storage.store.getItem("WikiShield:Statistics"));
			} catch (err) {
				// Parsing error
			}

			stats = stats || {
				reviewed: 0,
				reverts: 0,
				reports: 0,
				warnings: 0,
				welcomes: 0,
				whitelisted: 0,
				highlighted: 0,
				blocks: 0,
				sessionStart: Date.now()
			};

			// Add missing properties with defaults
			if (stats.warnings === undefined) stats.warnings = 0;
			if (stats.welcomes === undefined) stats.welcomes = 0;
			if (stats.whitelisted === undefined) stats.whitelisted = 0;
			if (stats.highlighted === undefined) stats.highlighted = 0;
			if (stats.blocks === undefined) stats.blocks = 0;
			if (stats.sessionStart === undefined) stats.sessionStart = Date.now();

			return stats;
		}

		/**
		 * Initialize the interface and start WikiShield
		 */
		async startInterface() {
			// Get user rights
			const rights = await mw.user.getRights();
			this.rights.rollback = rights.includes("rollback");
			this.rights.protect = rights.includes("protect");
			this.rights.block = rights.includes("block");

			// Build interface
			this.interface.build();

			// Start updating user contribution count
			this.handleUpdatingContributions();
		}

		/**
		 * Update user's total contribution count in the UI
		 */
		async updateMyContributions() {
			try {
				const response = await this.api.api.get({
					action: "query",
					list: "users",
					ususers: this.username,
					usprop: "editcount"
				});

				if (response.query && response.query.users && response.query.users[0]) {
					const editcount = response.query.users[0].editcount || 0;
					const statElem = document.querySelector("#stat-total-contribs");
					if (statElem) {
						statElem.textContent = editcount.toLocaleString();
					}
				}
			} catch (err) {
				console.log("Failed to fetch user contribution count:", err);
			}
		}

		/**
		 * Periodically update user contribution count (every 10 seconds)
		 */
		handleUpdatingContributions() {
			this.updateMyContributions();
			window.setTimeout(() => {
				this.handleUpdatingContributions();
			}, 10000);
		}

		/**
		 * Clean up expired user highlights
		 */
		cleanupExpiredHighlights() {
			const now = Date.now();
			let changed = false;

			for (const [username, expirationTime] of this.highlighted.entries()) {
				if (now >= expirationTime) {
					this.highlighted.delete(username);
					changed = true;
					this.logger.log(`Removed expired highlight for user: ${username}`);
				}
			}

			if (changed) {
				// Refresh the queue display if needed
				if (this.queue && this.interface) {
					this.interface.renderQueue(this.queue.queue, this.queue.currentEdit);
				}
			}
		}

		/**
		 * Start the queue and interface
		 */
		start() {
			this.interface.start();
			this.queue.fetchRecentChanges();
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

			const revertSummary = `Reverted ${goodFaith ? "[[WP:AGF|good faith]] " : ""}edits by [[Special:Contributions/${edit.user.name}|${edit.user.name}]] ([[User talk:${edit.user.name}|talk]])${summary ? ": " + summary : ""} ([[WP:WikiShield|WS]])`;

			// Check if we have rollback rights
			if (!this.rights.rollback) {
				return false;
			}

			// Attempt rollback
			const success = await this.api.rollback(
				edit.page.title,
				edit.user.name,
				revertSummary
			);

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
			this.statistics.reverts++;
			this.updateMyContributions();

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

			// Determine which template to use
			let templateToUse = "";
			if (level !== "auto") {
				templateToUse = warning.templates[level];
			} else {
				// Auto mode - get current warning level and use it
				const currentLevel = this.queue.getWarningLevel(talkPageContent).toString();
				if (typeof warning.auto === "function") {
					templateToUse = warning.templates[warning.auto(this.queue.currentEdit)];
				} else {
					templateToUse = warning.templates[warning.auto[currentLevel]];
				}
			}

			if (!templateToUse) {
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

			// Extract level from template if it has one
			const levelMatch = templateToUse.template.match(/(\d(?:im)?)\s*$/);
			const levelName = levelMatch ? levelMatch[1] : null;

			// Create edit summary based on whether article name is provided
			const editSummary = articleName
				? (levelName
					? `Message about [[Special:Diff/${revid}|your edit]] on [[${articleName}]] (level ${levelName}) ([[WP:WikiShield|WS]])`
					: `Message about [[Special:Diff/${revid}|your edit]] on [[${articleName}]] ([[WP:WikiShield|WS]])`)
				: (levelName
					? `Message about your edits (level ${levelName}) ([[WP:WikiShield|WS]])`
					: `Message about your edits ([[WP:WikiShield|WS]])`);

			await this.api.edit(
				`User talk:${user}`,
				newContent,
				editSummary
			);

			// Increment warning statistic
			this.statistics.warnings++;

			// Add user talk page to watchlist with configured expiry
			try {
				const expiry = wikishield.util.expiryToMilliseconds(wikishield.options.watchlistExpiry);
				if (expiry > 0) {
					const toExpire = new Date(Date.now() + expiry);

					await this.api.postWithToken("watch", {
						"action": "watch",
						"titles": `User talk:${user}`,
						"expiry": expiry === Infinity ? "infinity" : wikishield.util?.utcString(toExpire)
					});
				}
			} catch (err) {
				console.log(`Could not add User talk:${user} to watchlist:`, err);
			}

			// Update the warning level in the current edit object (only if the template has a numbered level)
			if (levelName && this.queue.currentEdit && this.queue.currentEdit.user.name === user) {
				this.queue.currentEdit.user.warningLevel = levelName;
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
		 * Load notifications from Wikipedia
		 */
		async loadNotifications() {
			try {
				// Fetch both Echo notifications (alerts and notices) and talk page edits
				const [alertsResponse, noticesResponse, talkResponse] = await Promise.all([
					// Get Echo alert notifications (mentions, thanks, page links, etc.)
					this.api.api.get({
						action: "query",
						meta: "notifications",
						notlimit: 20,
						notprop: "list",
						notfilter: "!read",
						notsections: "alert"
					}),
					// Get Echo notice notifications (user rights, thanks, etc.)
					this.api.api.get({
						action: "query",
						meta: "notifications",
						notlimit: 20,
						notprop: "list",
						notfilter: "!read",
						notsections: "message"
					}),
					// Get talk page edits
					this.api.api.get({
						action: "query",
						prop: "revisions",
						titles: `User talk:${this.username}`,
						rvlimit: 10,
						rvprop: "timestamp|user|comment|ids",
						rvdir: "older"
					})
				]);

				const notifications = [];

				// Process Echo alert notifications
				if (alertsResponse.query?.notifications?.list) {
					const alertList = Object.values(alertsResponse.query.notifications.list);
					for (const notif of alertList) {
						// MediaWiki timestamps are in format: YYYYMMDDHHMMSS
						let timestamp = notif.timestamp?.mw || notif.timestamp?.utcmw;
						if (timestamp && typeof timestamp === 'string' && timestamp.length === 14) {
							// Convert YYYYMMDDHHMMSS to ISO format
							timestamp = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`;
						} else {
							timestamp = new Date().toISOString();
						}

						// Get notification type display name
						let categoryLabel = "Alert";

						if (notif.type === "mention" || notif.type === "mention-success") {
							categoryLabel = "Mention";
						} else if (notif.type === "thank-you-edit") {
							categoryLabel = "Thanks";
						} else if (notif.type === "page-linked") {
							categoryLabel = "Page Link";
						} else if (notif.type === "reverted") {
							categoryLabel = "Revert";
						} else if (notif.type === "edit-user-talk") {
							categoryLabel = "Talk";
						}

						notifications.push({
							id: `alert-${notif.id}`,
							type: "alert",
							subtype: notif.type,
							timestamp: timestamp,
							title: notif.title?.full || "Unknown page",
							agent: notif.agent?.name || "Someone",
							category: categoryLabel,
							read: false
						});
					}
				}

				// Process Echo notice notifications
				if (noticesResponse.query?.notifications?.list) {
					const noticeList = Object.values(noticesResponse.query.notifications.list);
					for (const notif of noticeList) {
						// MediaWiki timestamps are in format: YYYYMMDDHHMMSS
						let timestamp = notif.timestamp?.mw || notif.timestamp?.utcmw;
						if (timestamp && typeof timestamp === 'string' && timestamp.length === 14) {
							// Convert YYYYMMDDHHMMSS to ISO format
							timestamp = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`;
						} else {
							timestamp = new Date().toISOString();
						}

						let categoryLabel = "Notice";

						if (notif.type === "user-rights") {
							categoryLabel = "User Rights";
						} else if (notif.type === "emailuser") {
							categoryLabel = "Email";
						}

						notifications.push({
							id: `notice-${notif.id}`,
							type: "notice",
							subtype: notif.type,
							timestamp: timestamp,
							title: notif.title?.full || "Notification",
							agent: notif.agent?.name || "System",
							category: categoryLabel,
							read: false
						});
					}
				}

				// Process talk page edits
				const pages = talkResponse.query?.pages;
				if (pages) {
					const page = Object.values(pages)[0];
					const revisions = page.revisions || [];

					// Check if we have stored the last seen revision
					if (!this.lastSeenRevision) {
						// First load - just store the latest revision
						if (revisions.length > 0) {
							this.lastSeenRevision = revisions[0].revid;
						}
					} else {
						// Find new revisions since last check
						for (const rev of revisions) {
							if (rev.revid > this.lastSeenRevision) {
								// Skip self-edits
								if (rev.user !== this.username) {
									notifications.push({
										id: `talk-${rev.revid}`,
										type: "talk",
										revid: rev.revid,
										user: rev.user,
										comment: rev.comment || "Edit to your talk page",
										timestamp: rev.timestamp,
										read: false
									});
								}
							} else {
								break;
							}
						}

						// Update last seen revision
						if (revisions.length > 0) {
							this.lastSeenRevision = Math.max(this.lastSeenRevision, revisions[0].revid);
						}
					}
				}

				// Merge with existing notifications and remove duplicates
				let hasNewNotifications = false;
				for (const newNotif of notifications) {
					const existingNotif = this.notifications.find(n => n.id === newNotif.id);
					if (!existingNotif) {
						this.notifications.unshift(newNotif);
						hasNewNotifications = true;
					}
				}

				// Play sound if there are new notifications
				if (hasNewNotifications && this.notifications.length > 0) {
					wikishield.queue.playNotificationSound();
				}

				// Sort by timestamp
				this.notifications.sort((a, b) => {
					const timeA = new Date(a.timestamp);
					const timeB = new Date(b.timestamp);
					return timeB - timeA;
				});

				// Keep only last 25 notifications
				if (this.notifications.length > 25) {
					this.notifications = this.notifications.slice(0, 25);
				}

				this.updateNotificationDisplay();
			} catch (err) {
				console.log("Error while fetching notifications", err);
			}
		}

		/**
		 * Every 10 seconds, call loadNotifications
		 */
		async handleLoadingNotifications() {
			await this.loadNotifications();

			window.setTimeout(() => {
				this.handleLoadingNotifications();
			}, 10000);
		}

		/**
		 * Update the notification count and list display
		 */
		updateNotificationDisplay() {
			const unreadCount = this.notifications.filter(n => !n.read).length;
			const countElem = document.querySelector("#notification-count");
			const listElem = document.querySelector("#notifications-list");

			// Check if elements exist (UI might not be ready yet)
			if (!countElem || !listElem) {
				return;
			}

			if (unreadCount > 0) {
				countElem.textContent = unreadCount > 9 ? "9+" : unreadCount;
				countElem.style.display = "block";
			} else {
				countElem.style.display = "none";
			}

			// Update list
			if (listElem) {
				if (this.notifications.length === 0) {
					listElem.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No new notifications</div>';
				} else {
					listElem.innerHTML = this.notifications.map(notif => {
						// Parse timestamp
						const time = new Date(notif.timestamp);
						const timeStr = this.formatNotificationTime(time);

						let title, subtitle, typeLabel, clickData;

						if (notif.type === "alert") {
							// Echo alert notification (mentions, thanks, page links, etc.)
							typeLabel = notif.category || "Alert";
							if (notif.subtype === "mention" || notif.subtype === "mention-success") {
								title = `${notif.agent} mentioned you`;
								subtitle = `on ${notif.title}`;
							} else if (notif.subtype === "thank-you-edit") {
								title = `${notif.agent} thanked you`;
								subtitle = `for your edit on ${notif.title}`;
							} else if (notif.subtype === "page-linked") {
								title = `Your page was linked`;
								subtitle = `from ${notif.title}`;
							} else if (notif.subtype === "reverted") {
								title = `${notif.agent} reverted your edit`;
								subtitle = `on ${notif.title}`;
							} else if (notif.subtype === "edit-user-talk") {
								title = `${notif.agent} edited your talk page`;
								subtitle = notif.title;
							} else if (notif.subtype === "emailuser") {
								title = `${notif.agent} sent you an email`;
								subtitle = notif.title;
							} else if (notif.subtype === "foreign") {
								title = `Alert from ${notif.agent}`;
								subtitle = notif.title;
							} else {
								// Generic alert with more context
								title = `Alert: ${notif.subtype || 'notification'}`;
								subtitle = `${notif.agent} - ${notif.title}`;
							}
							clickData = `data-page="${this.escapeHtml(notif.title)}"`;
						} else if (notif.type === "notice") {
							// Echo notice notification (user rights, etc.)
							typeLabel = notif.category || "Notice";
							if (notif.subtype === "user-rights") {
								title = `Your user rights were changed`;
								subtitle = notif.title;
							} else if (notif.subtype === "emailuser") {
								title = `Email notification`;
								subtitle = notif.title;
							} else if (notif.subtype === "flow-discussion") {
								title = `New discussion activity`;
								subtitle = notif.title;
							} else {
								// Generic notice with more context
								title = `Notice: ${notif.subtype || 'system notification'}`;
								subtitle = `${notif.agent} - ${notif.title}`;
							}
							clickData = `data-page="${this.escapeHtml(notif.title)}"`;
						} else {
							// Talk page edit notification
							typeLabel = "Talk Page";
							title = `${notif.user} edited your talk page`;
							subtitle = notif.comment || "No edit summary";
							clickData = `data-revid="${notif.revid}"`;
						}

						const readClass = notif.read ? "" : "unread";

						return `
							<div class="notification-item ${readClass}" data-notif-id="${notif.id}" data-notif-type="${notif.type}" ${clickData}>
								<div class="notification-header">
									<span class="notification-type">${typeLabel}</span>
									<span class="notification-time">${timeStr}</span>
								</div>
								<div class="notification-title">${this.escapeHtml(title)}</div>
								${subtitle ? `<div class="notification-subtitle">${this.escapeHtml(subtitle)}</div>` : ''}
								${notif.read ? "" : '<div class="notification-read">Mark as read</div>'}
							</div>
						`;
					}).join("");

					// Add click handlers
					listElem.querySelectorAll(".notification-item").forEach(item => {
						const read = item.querySelector(".notification-read");
						read?.addEventListener("click", e => {
							e?.stopPropagation();

							const notifId = item.dataset.notifId;
							this.markNotificationRead(notifId);
						});

						item.addEventListener("click", e => {
							e?.stopPropagation();

							const notifId = item.dataset.notifId;
							this.markNotificationRead(notifId);

							const notifType =  item.dataset.notifType;
							if (notifType === "alert" || notifType === "notice") {
								// Open the page for Echo notifications
								const page = item.dataset.page;
								if (page) {
									window.open(mw.util.getUrl(page), "_blank");
								}
							} else {
								// Open the diff for talk page edit
								const revid = item.dataset.revid;
								if (revid) {
									window.open(mw.util.getUrl(`Special:Diff/${revid}`), "_blank");
								}
							}
						});
					});
				}
			}
		}

		/**
		 * Add a local notification (not from Wikipedia API)
		 */
		addLocalNotification(config) {
			const notification = {
				id: `local-${Date.now()}-${Math.random()}`,
				type: config.type || "info",
				title: config.title || "Notification",
				subtitle: config.subtitle || "",
				page: config.page || "",
				timestamp: new Date().toISOString(),
				read: false
			};

			this.notifications.unshift(notification);
			this.updateNotificationDisplay();
		}

		/**
		 * Escape HTML to prevent XSS
		 */
		escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}

		/**
		 * Format notification timestamp as relative time
		 */
		formatNotificationTime(date) {
			const now = new Date();
			const diff = Math.floor((now - date) / 1000); // seconds

			// Handle future timestamps (clock skew)
			if (diff < 0) return "Just now";

			if (diff < 60) return "Just now";
			if (diff < 3600) {
				const mins = Math.floor(diff / 60);
				return `${mins} min${mins !== 1 ? 's' : ''} ago`;
			}
			if (diff < 86400) {
				const hours = Math.floor(diff / 3600);
				return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
			}
			if (diff < 604800) {
				const days = Math.floor(diff / 86400);
				return `${days} day${days !== 1 ? 's' : ''} ago`;
			}
			return date.toLocaleDateString();
		}

		formatNotificationTimeShort(date) {
			const now = new Date();
			const diff = Math.floor((now - date) / 1000); // seconds

			// Handle future timestamps (clock skew)
			if (diff < 0) return "Now";

			if (diff < 60) return "Now";
			if (diff < 3600) {
				const mins = Math.floor(diff / 60);
				return `${mins}m`;
			}
			if (diff < 86400) {
				const hours = Math.floor(diff / 3600);
				return `${hours}h`;
			}
			if (diff < 604800) {
				const days = Math.floor(diff / 86400);
				return `${days}d`;
			}
			return date.toLocaleDateString();
		}

		/**
		 * Mark a notification as read
		 */
		markNotificationRead(notifId) {
			const notif = this.notifications.find(n => n.id === notifId);
			if (notif) {
				notif.read = true;
			}
			this.updateNotificationDisplay();
		}

		/**
		 * Mark all notifications as read
		 */
		markAllNotificationsRead() {
			this.notifications.forEach(n => n.read = true);
			this.updateNotificationDisplay();
		}

		/**
		 * Load watchlist from Wikipedia
		 */
		async loadWatchlist() {
			try {
				const items = await this.api.watchlist(this.mostRecentWatchlist);

				const watchlist = [];
				for (const item of items ?? []) {
					let categoryLabel = "Alert";
					if (item.type === "edit") {
						categoryLabel = "Edit";
					} else if (item.type === "new") {
						categoryLabel = "New";
					} else if (item.type === "log") {
						categoryLabel = "Log";
					} else if (item.type === "external") {
						categoryLabel = "External";
					} else if (item.type === "categorize") {
						categoryLabel = "Categorize";
					}

					watchlist.push({
						id: `item-${item.revid}`,
						type: item.type,
						timestamp: item.timestamp,
						title: item.title || "Unknown page",
						agent: item.user || "Someone",
						category: categoryLabel,
						read: false,
						comment: item.comment,
						revid: item.revid
					});
				}

				// Merge with existing watchlist and remove duplicates
				let hasNewWatchlistItems = false;
				for (const item of watchlist) {
					const existingItem = this.watchlist.find(n => n.id === item.id);
					if (!existingItem) {
						this.watchlist.unshift(item);
						hasNewWatchlistItems = true;
					}
				}

				// Play sound if there are new watchlist
				if (hasNewWatchlistItems && this.watchlist.length > 0) {
					wikishield.queue.playWatchlistSound();
				}

				// Sort by timestamp
				this.watchlist.sort((a, b) => {
					const timeA = new Date(a.timestamp);
					const timeB = new Date(b.timestamp);
					return timeB - timeA;
				});

				// Keep only last 25 watchlist
				if (this.watchlist.length > 25) {
					this.watchlist = this.watchlist.slice(0, 25);
				}

				if (this.watchlist[0]) {
					this.mostRecentWatchlist = this.watchlist[0].timestamp;
				}

				this.updateWatchlistDisplay();
			} catch (err) {
				console.log("Error while fetching watchlist", err);
			}
		}

		/**
		 * Every 10 seconds, call loadWatchlist
		 */
		async handleLoadingWatchlist() {
			await this.loadWatchlist();

			window.setTimeout(() => {
				this.handleLoadingWatchlist();
			}, 10000);
		}

		/**
		 * Update the watchlist count and list display
		 */
		updateWatchlistDisplay() {
			const unreadCount = this.watchlist.filter(w => !w.read).length;
			const countElem = document.querySelector("#watchlist-count");
			const listElem = document.querySelector("#watchlist-list");

			// Check if elements exist (UI might not be ready yet)
			if (!countElem || !listElem) {
				return;
			}

			if (unreadCount > 0) {
				countElem.textContent = unreadCount > 9 ? "9+" : unreadCount;
				countElem.style.display = "block";
			} else {
				countElem.style.display = "none";
			}

			// Update list
			if (listElem) {
				if (this.watchlist.length === 0) {
					listElem.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No new watchlist items</div>';
				} else {
					listElem.innerHTML = this.watchlist.map(item => {
						// Parse timestamp
						const time = new Date(item.timestamp);
						const timeStr = this.formatNotificationTime(time);

						const title = item.title;
						const subtitle = item.comment;
						const typeLabel = item.category || "Watchlist item";
						const clickData = `data-page="${this.escapeHtml(item.title)}"`;

						const readClass = item.read ? "" : "unread";

						return `
							<div class="watchlist-item ${readClass}" data-watchlist-id="${item.id}" data-revid="${item.revid}" data-title="${item.title}" ${clickData}>
								<div class="watchlist-header">
									<span class="watchlist-type">${typeLabel}</span>
									<span class="watchlist-time">${timeStr}</span>
								</div>
								<div class="watchlist-title">${this.escapeHtml(title)}</div>
								<div class="watchlist-subtitle">By ${this.escapeHtml(item.agent)}${subtitle ? `<br>${this.escapeHtml(subtitle)}` : ''}</div>
								${item.read ? "" : '<div class="watchlist-read">Mark as read</div>'}
							</div>
						`;
					}).join("");

					// Add click handlers
					listElem.querySelectorAll(".watchlist-item").forEach(item => {
						const read = item.querySelector(".watchlist-read");
						read?.addEventListener("click", e => {
							e?.stopPropagation();

							const watchlistId = item.dataset.watchlistId;
							this.markWathlistItemRead(watchlistId);
						});

						item.addEventListener("click", e => {
							e?.stopPropagation();

							const watchlistId = item.dataset.watchlistId;
							this.markWathlistItemRead(watchlistId);

							const url = wikishield.util.pageLink(`Special:Diff/${item.dataset.revid}`);
							wikishield.interface.eventManager.openWikipediaLink(url, item.dataset.title, event);
						});
					});
				}
			}
		}

		/**
		 * Mark a notification as read
		 */
		markWathlistItemRead(watchlistId) {
			const item = this.watchlist.find(w => w.id === watchlistId);
			if (item) {
				item.read = true;
			}
			this.updateWatchlistDisplay();
		}

		/**
		 * Mark all watchlist as read
		 */
		markAllWatchlistRead() {
			this.watchlist.forEach(w => w.read = true);
			this.updateWatchlistDisplay();
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
		 * @param {String} name The user to welcome
		 * @param {String} template Which welcome template to use
		 */
		async welcomeUser(name, template) {
			try {
				const talkPageName = `User talk:${name}`;
				const talkPageContent = await this.api.getSinglePageContent(talkPageName);

				if (await this.api.pageExists(talkPageName)) {
					return;
				}

				await this.api.edit(
					talkPageName,
					talkPageContent + `\n${wikishieldEventData.welcomeTemplates[template]}`,
					"Welcome to Wikipedia! ([[WP:WikiShield|WS]])"
				);

				// Increment welcome statistic
				this.statistics.welcomes++;

				// Update all edits in the queue from this user
				this.queue.queue.forEach(edit => {
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
				this.interface.renderQueue(this.queue.queue, this.queue.currentEdit);
			} catch (err) {
				console.log("Error while welcoming user", err);
			}
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
				'''${level}''': ${reason} ~~~~
			`.replaceAll("\t", ""), `Requesting protection for [[${title}]] ([[WP:WikiShield|WS]])`);

			this.statistics.reports++;
		}

		/**
		 * Report a user to AIV
		 * @param {String} name The username to report
		 * @param {String} message The message to use in the report
		 */
		async reportToAIV(user, message) {
			const blocked = await this.api.usersBlocked(user);

			if (blocked[user]) {
				return;
			}

			if (await this.userReportedToAiv(user)) {
				return;
			}

			const content = `* {{vandal|${user}}} &ndash; ${message} ~~~~`;

			await this.api.appendText(
				__script__.pages.AVI,
				content,
				`Reporting [[Special:Contributions/${user}|${user}]] ([[WP:WikiShield|WS]])`
			);

			this.statistics.reports++;
		}

		/**
		 * Report a user to UAA
		 * @param {String} name The username to report
		 * @param {String} message The message to use in the report
		 */
		async reportToUAA(user, message) {
			const blocked = await this.api.usersBlocked(user);

			if (blocked[user]) {
				// already blocked
				return;
			}

			if (await this.userReportedToUaa(user)) {
				// already reported
				return;
			}

			const content = `* {{user-uaa|${user}}} &ndash; ${message} ~~~~`;

			await this.api.appendText(
				__script__.pages.UAA,
				content,
				`Reporting [[Special:Contributions/${user}|${user}]] ([[WP:WikiShield|WS]])`
			);

			// Add user to no-auto-welcome list since they were reported to UAA
			this.noAutoWelcomeList.add(user);

			this.statistics.reports++;
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

			for (const script of this.options.controlScripts) {
				if (script.keys.includes(event.key.toLowerCase())) {
					this.executeScript(script);
				}
			}
		}

		/**
		 * Execute a control script
		 * @param {Object} script
		 */
		async executeScript(script, hasContinuity = true, updateProgress = null, currentEdit) {
			const base = updateProgress === null;

			if (base) {
				const allScripts = [script];
				let totalActions = 0;

				while (allScripts.length > 0) {
					const current = allScripts[0];
					const willBeRun = (current.name && current.name === "if"
						&& wikishieldEventData.conditions[current.condition].check(this.queue.currentEdit)) || !current.name;

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

				currentEdit = this.queue.currentEdit || 1;
			}

			const ifAndTrue = script.name && script.name === "if"
				&& wikishieldEventData.conditions[script.condition].check(currentEdit);

			if (ifAndTrue || !script.name) {
				for (const action of script.actions) {
					if (action.name === "if") {
						hasContinuity = this.executeScript(action, hasContinuity, updateProgress, currentEdit);
					} else {
						const event = this.interface.eventManager.events[action.name];

						if (hasContinuity || !event.needsContinuity) {
							if (event.includeInProgress) {
								updateProgress(event.progressDesc);
							}

							if (currentEdit !== 1 || event.runWithoutEdit) {
								const result = await event.func(action.params, currentEdit);

								if (result === false) {
									hasContinuity = false;
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

		async save() {
			const obj = {
				changelog: __script__.changelog.version,

				options: this.options,
				whitelist: [ ...this.whitelist.entries() ],
				highlighted: [...this.highlighted.entries() ],

				queueWidth: this.queueWidth,
				detailsWidth: this.detailsWidth,

				statistics: this.statistics
			};
			const stringify = JSON.stringify(obj);

			return await this.api.edit(
				`User:${mw.config.values.wgUserName}/ws-save.js`,
				btoa(stringify),
				"Updating WikiShield save ([[WP:WikiShield|WS]])"
			);
		}

		async load() {
			const res = await this.api.getSinglePageContent(`User:${mw.config.values.wgUserName}/ws-save.js`);
			return JSON.parse(atob(res || "e30="));
		}
	}

	let wikishield;
	let wikishieldEventData;

	if (mw.config.get("wgRelevantPageName") === "Wikipedia:WikiShield/run" && mw.config.get("wgAction") === "view") {
		wikishield = new WikiShield();
		// Initialize queue after wikishield is created (needs reference to wikishield)
		wikishield.queue = new WikiShieldQueue(wikishield);

		// Initialize event data after wikishield is created (avoids circular dependency)
		wikishieldEventData = {
			conditions: createConditions(wikishield),
			welcomeTemplates: welcomeTemplates
		};

		// Initialize event manager's events with the event data
		wikishield.interface.eventManager.initializeEvents(wikishieldEventData);

		wikishield.init().then(() => {
			window.addEventListener("beforeunload", () => wikishield.save());
		});

		window.addEventListener("keydown", wikishield.keyPressed.bind(wikishield));
	} else {
		mw.util.addPortletLink(
			'p-personal',
			mw.util.getUrl('Wikipedia:WikiShield/run'),
			'🛡️ WikiShield',
			'pt-wikishield',
			'wikishield',
			null,
			'#pt-preferences'
		);

		// add link to sticky header for Vector2022
		mw.util.addPortletLink(
			'p-personal-sticky-header',
			mw.util.getUrl('Wikipedia:WikiShield/run'),
			'🛡️ WikiShield',
			'pt-wikishield',
			'WikiShield',
			null,
			'#pt-preferences'
		);
	}
}

// </nowiki>
