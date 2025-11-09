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
	// wikishieldEventData will be created after wikishield instance is initialized
	// This avoids circular dependency issues
	let wikishieldEventData;

	class WikiShieldEventManager {
		constructor() {
			/**
			 * Helper function to open Wikipedia links in iframe or new tab
			 * @param {String} url - The URL to open
			 * @param {String} title - The title to display in iframe
			 * @param {Event} event - Optional event object for middle-click detection
			 */
			this.openWikipediaLink = (url, title, event = null) => {
				// Middle click should open in new tab
				if (event && event.button === 1) {
					window.open(url);
					return;
				}

				// Ctrl/Cmd + click should open in new tab
				if (event && (event.ctrlKey || event.metaKey)) {
					window.open(url);
					return;
				}

				// Otherwise open in new tab
				window.open(url, "_blank");
			};

			// Events object will be initialized later via initializeEvents()
			// This avoids circular dependency with wikishieldEventData
			this.events = null;
		}

		/**
		 * Initialize the events object with event data
		 * Must be called after wikishieldEventData is created
		 */
		initializeEvents(eventData) {
			this.events = {
				prevEdit: {
					description: "Go to the previous edit in the queue",
					icon: "fas fa-arrow-left",
					runWithoutEdit: true,
					func: () => {
						wikishield.queue.prevItem();
					}
				},
				nextEdit: {
					description: "Go to the next edit in the queue",
					icon: "fas fa-arrow-right",
					func: () => {
						wikishield.queue.nextItem();
					}
				},
				deleteQueue: {
					description: "Remove all items from the queue",
					icon: "fas fa-trash-can",
					runWithoutEdit: true,
					func: () => {
						wikishield.queue.delete();
					}
				},
				openRevertMenu: {
					description: "Toggle the revert & warn menu",
					icon: "fas fa-undo",
					runWithoutEdit: true,
					func: () => {
						const menuItem = document.querySelector('[data-menu="revert"]');

						const revertMenu = wikishield.interface.elem("#revert-menu");
						revertMenu.innerHTML = "";
						wikishield.interface.createRevertMenu(revertMenu, wikishield.queue.currentEdit);

						if (menuItem) {
							const trigger = menuItem.querySelector('.bottom-tool-trigger');
							const menu = document.querySelector(`#${menuItem.dataset.menu}-menu`);
							if (trigger && menu) {
								// Toggle: if already open, close it; otherwise open it
								if (menu.classList.contains('show')) {
									menu.classList.remove('show');
									trigger.classList.remove('active');
								} else {
									// Close all other menus first
									wikishield.interface.closeAllBottomMenus();
									menu.classList.add('show');
									trigger.classList.add('active');
									wikishield.interface.positionBottomMenu(menuItem, menu);
								}
							}
						}
					}
				},
				openWarnMenu: {
					description: "Toggle the warn-only menu",
					icon: "fas fa-triangle-exclamation",
					runWithoutEdit: true,
					func: () => {
						const menuItem = document.querySelector('[data-menu="warn"]');

						const warnMenu = wikishield.interface.elem("#warn-menu");
						warnMenu.innerHTML = "";
						wikishield.interface.createWarnMenu(warnMenu, wikishield.queue.currentEdit);

						if (menuItem) {
							const trigger = menuItem.querySelector('.bottom-tool-trigger');
							const menu = document.querySelector(`#${menuItem.dataset.menu}-menu`);
							if (trigger && menu) {
								// Toggle: if already open, close it; otherwise open it
								if (menu.classList.contains('show')) {
									menu.classList.remove('show');
									trigger.classList.remove('active');
								} else {
									// Close all other menus first
									wikishield.interface.closeAllBottomMenus();
									menu.classList.add('show');
									trigger.classList.add('active');
									wikishield.interface.positionBottomMenu(menuItem, menu);
								}
							}
						}
					}
				},
				openReportMenu: {
					description: "Toggle the report menu",
					icon: "fas fa-flag",
					runWithoutEdit: true,
					func: () => {
						const menuItem = document.querySelector('[data-menu="report"]');
						if (menuItem) {
							const trigger = menuItem.querySelector('.bottom-tool-trigger');
							const menu = document.querySelector(`#${menuItem.dataset.menu}-menu`);
							if (trigger && menu) {
								// Toggle: if already open, close it; otherwise open it
								if (menu.classList.contains('show')) {
									menu.classList.remove('show');
									trigger.classList.remove('active');
								} else {
									// Close all other menus first
									wikishield.interface.closeAllBottomMenus();
									menu.classList.add('show');
									trigger.classList.add('active');
									wikishield.interface.positionBottomMenu(menuItem, menu);
								}
							}
						}
					}
				},
				openSettings: {
					description: "Open the settings interface",
					icon: "fas fa-gear",
					runWithoutEdit: true,
					func: () => {
						wikishield.interface.settings.openSettings();
					}
				},
				openUserPage: {
					description: "Open user page in a new tab",
					icon: "fas fa-circle-user",
					func: (event) => {
						const username = this.getRelevantEdit().user.name;
						const url = wikishield.util.pageLink(`User:${username}`);
						this.openWikipediaLink(url, `User:${username}`, event);
					}
				},
				openUserTalk: {
					description: "Open user talk page in a new tab",
					icon: "fas fa-comment",
					func: (event) => {
						const username = this.getRelevantEdit().user.name;
						const url = wikishield.util.pageLink(`User talk:${username}`);
						this.openWikipediaLink(url, `User talk:${username}`, event);
					}
				},
				openUserContribs: {
					description: "Open user contributions page in a new tab",
					icon: "fas fa-list",
					func: (event) => {
						const username = this.getRelevantEdit().user.name;
						const url = wikishield.util.pageLink(`Special:Contributions/${username}`);
						this.openWikipediaLink(url, `Contributions: ${username}`, event);
					}
				},
				openFilterLog: {
					description: "Open user filter log in a new tab",
					icon: "fas fa-filter",
					func: (event) => {
						const encodedName = wikishield.util.encodeuri(this.getRelevantEdit().user.name);
						const url = wikishield.util.pageLink(
							`?title=Special:AbuseLog&wpSearchUser=${encodedName}`,
							true
						);
						const username = this.getRelevantEdit().user.name;
						this.openWikipediaLink(url, `Filter Log: ${username}`, event);
					}
				},
				addToWhitelist: {
					description: "Add user to the whitelist",
					icon: "fas fa-thumbs-up",
					includeInProgress: true,
					progressDesc: "Whitelisting...",
					func: () => {
						wikishield.queue.playSparkleSound();
						const username = this.getRelevantEdit().user.name;

						// Toggle whitelist status
						if (wikishield.whitelist.has(username)) {
							wikishield.whitelist.delete(username);
							wikishield.saveWhitelist();
							wikishield.logger.log(`Removed ${username} from whitelist`);
						} else {
							wikishield.whitelist.set(username, Date.now());
							wikishield.saveWhitelist();
							wikishield.statistics.whitelisted++;
							wikishield.saveStats(wikishield.statistics);
							wikishield.logger.log(`Added ${username} to whitelist`);
						}

						// Refresh the interface to update button text
						wikishield.interface.renderQueue(wikishield.queue.queue, wikishield.queue.currentEdit);
					}
				},
				highlight: {
					description: "Highlight this user's contributions",
					icon: "fas fa-highlighter",
					includeInProgress: true,
					progressDesc: "Highlighting...",
					func: () => {
						wikishield.queue.playSparkleSound();
						const username = this.getRelevantEdit().user.name;

						// Toggle highlight status
						if (wikishield.highlighted.has(username)) {
							wikishield.highlighted.delete(username);
							wikishield.saveHighlighted();
							wikishield.logger.log(`Removed highlight from ${username}`);
						} else {
							// Set highlight to expire based on user setting
							const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.options.highlightedExpiry);
							const expirationTime = Date.now() + expiryMs;
							wikishield.highlighted.set(username, expirationTime);
							wikishield.saveHighlighted();
							wikishield.statistics.highlighted++;
							wikishield.saveStats(wikishield.statistics);
							wikishield.logger.log(`Highlighted user ${username} until ${new Date(expirationTime).toLocaleString()}`);
						}

						// Trigger immediate UI refresh
						wikishield.interface.renderQueue(wikishield.queue.queue, wikishield.queue.currentEdit);
					}
				},
				openPage: {
					description: "Open page being edited in new tab",
					icon: "fas fa-file-lines",
					func: (event) => {
						const page = this.getRelevantEdit().page;
						const url = wikishield.util.pageLink(page.title);
						this.openWikipediaLink(url, page.title, event);
					}
				},
				openTalk: {
					description: "Open talk page in new tab",
					icon: "fas fa-comments",
					func: (event) => {
						const pageTitle = this.getRelevantEdit().page.title.split(":");
						let talkNamespace = "Talk";
						if (pageTitle.length > 1) {
							talkNamespace = pageTitle[0].toLowerCase().includes("talk")
								? pageTitle[0]
								: pageTitle[0] + " talk";
						}
						const talkTitle = `${talkNamespace}:${pageTitle.length === 1 ? pageTitle[0] : pageTitle[1]}`;
						const url = wikishield.util.pageLink(talkTitle);
						this.openWikipediaLink(url, talkTitle, event);
					}
				},
				openHistory: {
					description: "Open page history in new tab",
					icon: "fas fa-clock-rotate-left",
					func: (event) => {
						const page = this.getRelevantEdit().page;
						const url = wikishield.util.pageLink(`Special:PageHistory/${page.title}`);
						this.openWikipediaLink(url, `History: ${page.title}`, event);
					}
				},
				openRevision: {
					description: "Open revision in new tab",
					icon: "fas fa-pen-to-square",
					func: (event) => {
						const revid = this.getRelevantEdit().revid;
						const url = wikishield.util.pageLink(`Special:PermanentLink/${revid}`);
						this.openWikipediaLink(url, `Revision ${revid}`, event);
					}
				},
				openDiff: {
					description: "Open diff in new tab",
					icon: "fas fa-code-commit",
					func: (event) => {
						const revid = this.getRelevantEdit().revid;
						const url = wikishield.util.pageLink(`Special:Diff/${revid}`);
						this.openWikipediaLink(url, `Diff ${revid}`, event);
					}
				},
				thankUser: {
					description: "Thank user",
					icon: "fas fa-user-check",
					includeInProgress: true,
					progressDesc: "Thanking...",
					func: async () => {
						wikishield.queue.playThankSound();
						const edit = this.getRelevantEdit();

						// Check if user is an TEMP
						if (mw.util.isTemporaryUser(edit.user.name)) {
							// For TEMP users, leave a thank you message on their talk page
							const talkPageName = `User talk:${edit.user.name}`;
							const talkPageContent = await wikishield.api.getSinglePageContent(talkPageName) || "";

							await wikishield.api.edit(
								talkPageName,
								talkPageContent + `\n{{subst:Thanks-autosign}}`,
								`Thanking for edit to [[${edit.page.title}]] ([[WP:WikiShield|WS]])`
							);
						} else {
							// For registered users, use the API thank function
							await wikishield.api.thank(edit.revid);
						}
					}
				},
				warn: {
					description: "Warn user",
					icon: "fas fa-triangle-exclamation",
					parameters: [
						{
							title: "Warning type",
							id: "warningType",
							type: "choice",
							options: Object.keys(wikishieldData.warnings)
						},
						{
							title: "Level",
							id: "level",
							type: "choice",
							options: ["auto", "0", "1", "2", "3", "4", "4im"]
						}
					],
					includeInProgress: true,
					progressDesc: "Warning...",
					needsContinuity: true,
					validateParameters: (params) => {
						// If custom templates are provided, skip validation
						if (params.warningTemplates) {
							return true;
						}

						return params.level === "auto" || getWarningFromLookup(params.warningType)?.templates[params.level] !== null;
					},
					func: async (params) => {
						wikishield.queue.playWarnSound();

						const warning = getWarningFromLookup(params.warningType);
						const edit = this.getRelevantEdit();

						// Store the original warning level before warning
						const originalLevel = edit.user.warningLevel;

						await wikishield.warnUser(
							edit.user.name,
							warning,
							params.level || "auto",
							edit.page.title,
							edit.revid
						);

						return edit.user.atFinalWarning = (warning?.auto?.[originalLevel.toString()] === "report");
					}
				},
				rollback: {
					description: "Rollback edits",
					icon: "fas fa-backward",
					includeInProgress: true,
					progressDesc: "Rolling back...",
					func: async (params = {}) => {
						wikishield.queue.playRollbackSound();
						return await wikishield.revert(this.getRelevantEdit(), params.label || "");
					}
				},
				rollbackAndWarn: {
					description: "Rollback and warn for edits",
					icon: "fas fa-backward",
					includeInProgress: true,
					progressDesc: "Rolling back and warning...",
					parameters: [
						{
							title: "Warning type",
							id: "warningType",
							type: "choice",
							options: Object.keys(wikishieldData.warningsLookup)
						},
						{
							title: "Level",
							id: "level",
							type: "choice",
							options: ["auto", "0", "1", "2", "3", "4", "4im"]
						}
					],
					validateParameters: (params) => {
						return params.level === "auto" || getWarningFromLookup(params.warningType)?.templates[params.level] !== null;
					},
					func: async (params = {}) => {
						const warning = getWarningFromLookup(params.warningType);
						const edit = this.getRelevantEdit();

						wikishield.queue.playRollbackSound();

						const result = await wikishield.revert(edit, warning.summary || "");
						if (result === false) {
							return;
						}

						wikishield.queue.playWarnSound();

						// Store the original warning level before warning
						const originalLevel = edit.user.warningLevel;

						await wikishield.warnUser(
							edit.user.name,
							warning,
							params.level || "auto",
							edit.page.title,
							edit.revid
						);

						// Return whether they were already at final warning
						return edit.user.atFinalWarning = (warning?.auto?.[originalLevel.toString()] === "report");
					}
				},
				rollbackGoodFaith: {
					description: "Rollback edits (good faith)",
					icon: "fas fa-arrow-rotate-left",
					parameters: [
						{
							title: "Summary (optional)",
							id: "summary",
							type: "text"
						}
					],
					includeInProgress: true,
					progressDesc: "Rolling back...",
					func: async (params) => {
						wikishield.queue.playRollbackSound();
						const edit = this.getRelevantEdit();

						return await wikishield.revert(edit, params.summary || "", true);
					}
				},
				undo: {
					description: "Undo this edit only",
					icon: "fas fa-undo",
					parameters: [
						{
							title: "Reason",
							id: "reason",
							type: "text"
						}
					],
					includeInProgress: true,
					progressDesc: "Undoing...",
					func: async (params) => {
						wikishield.queue.playRollbackSound();
						const edit = this.getRelevantEdit();
						return await wikishield.api.undoEdit(edit, params.reason || `Undid edit by ${edit.user.name} ([[WP:WikiShield|WS]])`);
					}
				},
				reportToAIV: {
					description: "Report user to AIV",
					icon: "fas fa-flag",
					parameters: [
						{
							title: "Report message",
							id: "reportMessage",
							type: "choice",
							options: [
								"Vandalism past final warning",
								"Vandalism-only account",
								"Long-term abuse"
							]
						}
					],
					includeInProgress: true,
					progressDesc: "Reporting...",
					func: async (params) => {
						wikishield.queue.playReportSound();
						await wikishield.reportToAIV(
							this.getRelevantEdit().user.name,
							params.reportMessage
						);
					}
				},
				reportToUAA: {
					description: "Report user to UAA",
					icon: "fas fa-flag",
					parameters: [
						{
							title: "Report message",
							id: "reportMessage",
							type: "choice",
							options: [
								"Disruptive username",
								"Offensive username",
								"Promotional username",
								"Misleading username"
							]
						}
					],
					includeInProgress: true,
					progressDesc: "Reporting...",
					func: async (params) => {
						wikishield.queue.playReportSound();
						await wikishield.reportToUAA(
							this.getRelevantEdit().user.name,
							params.reportMessage
						);
					}
				},
				requestProtection: {
					description: "Request protection",
					icon: "fas fa-shield",
					parameters: [
						{
							title: "Level",
							id: "level",
							type: "choice",
							options: [
								"Semi-protection",
								"Extended-confirmed protection",
								"Full protection",
								"Pending changes protection"
							]
						},
						{
							title: "Reason",
							id: "reason",
							type: "choice",
							options: [
								"Persistent vandalism",
								"Edit warring",
								"BLP violations",
								"Sockpuppetry"
							]
						}
					],
					includeInProgress: true,
					progressDesc: "Requesting protection...",
					func: async (params) => {
						wikishield.queue.playProtectionSound();
						await wikishield.requestProtection(
							this.getRelevantEdit().page.title,
							params.level,
							params.reason
						);
					}
				},
				block: {
					description: "Block user",
					icon: "fas fa-ban",
					parameters: [
						{
							title: "Block summary",
							id: "blockSummary",
							type: "choice",
							options: [
								"[[Wikipedia:Vandalism|Vandalism]]",
								"[[Wikipedia:DISRUPTONLY|Vandalism-only account]]",
								"Long-term abuse"
							]
						},
						{
							title: "Duration",
							id: "duration",
							type: "choice",
							options: [
								"31 hours",
								"1 week",
								"2 weeks",
								"1 month",
								"3 months",
								"6 months",
								"1 year",
								"3 years",
								"infinite"
							]
						}
					],
					includeInProgress: true,
					progressDesc: "Blocking...",
					func: async (params) => {
						wikishield.queue.playBlockSound();
						const success = await wikishield.api.block(
							this.getRelevantEdit().user.name,
							params.blockSummary,
							params.duration,
							true, false, false, true
						);
						if (success) {
							wikishield.statistics.blocks++;
							wikishield.saveStats(wikishield.statistics);
						}
					}
				},
				protect: {
					description: "Protect page",
					icon: "fas fa-lock",
					includeInProgress: true,
					progressDesc: "Protecting...",
					func: async () => {
						wikishield.queue.playProtectionSound();
					}
				},
				welcome: {
					description: "Welcome user",
					icon: "fas fa-door-open",
					parameters: [
						{
							title: "Template",
							id: "template",
							type: "choice",
							options: Object.keys(eventData.welcomeTemplates)
						}
					],
					includeInProgress: true,
					progressDesc: "Welcoming...",
					func: async (params) => {
						wikishield.queue.playSparkleSound();
						await wikishield.welcomeUser(
							this.getRelevantEdit().user.name,
							params.template
						);
					}
				}
			};
		}

		/**
		 * Returns the edit events should be actioned on
		 */
		getRelevantEdit() {
			return wikishield.tempCurrentEdit || wikishield.queue.currentEdit;
		}

		/**
		 * When a button is clicked, trigger the given event
		 * @param {HTMLElement} elem Button to add listener to
		 * @param {String} event Event to trigger
		 * @param {Boolean} runWithoutEdit Whether this event can be run with no edit selected
		 */
		linkButton(elem, event, runWithoutEdit) {
			const handleClick = (e, forceNewTab = false) => {
				// Check if this is an action that opens a page
				const pageOpenEvents = ["openUserPage", "openUserTalk", "openUserContribs", "openFilterLog", "openPage", "openPageHistory", "openDiff"];
				const shouldOpenInNewTab = forceNewTab || pageOpenEvents.includes(event);

				if (shouldOpenInNewTab && this.events[event]?.func) {
					// For page-opening actions, call the function directly which already handles new tabs
					if (e.button === 1 || e.ctrlKey || e.metaKey || forceNewTab) {
						// Middle click or Ctrl/Cmd+click - let the function handle it
						this.events[event].func();
						e.preventDefault();
						return;
					}
				}

				wikishield.interface.selectedMenu = null;
				wikishield.interface.updateMenuElements();
				if (runWithoutEdit) {
					this.events[event].func();
				} else {
					wikishield.executeScript({
						actions: [
							{
								name: event,
								params: {}
							}
						]
					});
				}
			};

			elem.addEventListener("click", (e) => handleClick(e, false));
			elem.addEventListener("auxclick", (e) => {
				if (e.button === 1) { // Middle click
					handleClick(e, true);
				}
			});
		}
	}

	const wikishieldSettingsAllowedKeys = [
		"!", "@", "#", "$", "%", "^", "&", "*", "(", ")",
		"1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
		"q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
		"a", "s", "d", "f", "g", "h", "j", "k", "l",
		"z", "x", "c", "v", "b", "n", "m",
		"-", "=", "[", "]", "\\", ";", "'", ",", ".", "/", "enter",
		"_", "+", "{", "}", "|", ":", "\"", "<", ">", "?", " ",
		"arrowleft", "arrowup", "arrowdown", "arrowright"
	];

	class WikiShieldSettingsInterface {
		constructor() {
			this.contentContainer = null;
			this.isOpen = false;
			this.keypressCallback = null;
		}

		/**
		 * Create a toggle switch
		 * @param {HTMLElement} container The container to add the toggle to
		 * @param {Boolean} value The initial value
		 * @param {Function} onChange Callback when value changes
		 */
		createToggle(container, value, onChange) {
			const toggle = document.createElement("div");
			toggle.classList.add("settings-toggle");
			if (value) toggle.classList.add("active");
			container.appendChild(toggle);

			toggle.innerHTML = `
				<div class="toggle-switch">
					<div class="toggle-slider"></div>
				</div>
			`;

			toggle.addEventListener("click", () => {
				wikishield.queue.playClickSound();
				value = !value;
				if (value) {
					toggle.classList.add("active");
				} else {
					toggle.classList.remove("active");
				}
				onChange(value);
			});
		}

		/**
		 * Create a volume slider control with preview button and sound selector
		 * @param {Element} container The container element
		 * @param {String} triggerKey The trigger key (e.g., 'click', 'alert', etc.)
		 * @param {String} title The title of the control
		 * @param {String} description The description of what the sound is for
		 * @param {Function} playFunction The function to play the sound
		 */
		createVolumeControl(container, triggerKey, title, description, playFunction) {
			const wrapper = document.createElement("div");
			wrapper.classList.add("audio-volume-control");
			container.appendChild(wrapper);

			const value = wikishield.options.volumes?.[triggerKey] ?? 0.5;
			const currentSound = wikishield.options.soundMappings?.[triggerKey] || triggerKey;

			// Build sound selector options grouped by category
			const soundsByCategory = {};
			Object.entries(wikishieldData.sounds).forEach(([key, sound]) => {
				const category = sound.category || 'other';
				if (!soundsByCategory[category]) soundsByCategory[category] = [];
				soundsByCategory[category].push({ key, sound });
			});

			const categoryOrder = ['ui', 'alert', 'warning', 'action', 'notification', 'positive', 'negative', 'other'];
			const categoryNames = {
				ui: 'UI Sounds',
				alert: 'Alerts',
				warning: 'Warnings',
				action: 'Actions',
				notification: 'Notifications',
				positive: 'Positive',
				negative: 'Negative',
				other: 'Other'
			};

			let soundOptions = '';
			categoryOrder.forEach(category => {
				if (soundsByCategory[category]) {
					soundOptions += `<optgroup label="${categoryNames[category] || category}">`;
					soundsByCategory[category].forEach(({ key, sound }) => {
						const selected = key === currentSound ? 'selected' : '';
						soundOptions += `<option value="${key}" ${selected}>${sound.name}</option>`;
					});
					soundOptions += '</optgroup>';
				}
			});

			wrapper.innerHTML = `
				<div class="audio-control-header">
					<div class="audio-control-info">
						<div class="audio-control-title">${title}</div>
						<div class="audio-control-desc">${description}</div>
					</div>
					<button class="audio-preview-button">
						<span class="fa fa-play"></span>
						Preview
					</button>
				</div>
				<select class="audio-sound-selector">
					${soundOptions}
				</select>
				<div class="audio-control-slider-container">
					<input type="range" class="audio-volume-slider" min="0" max="1" step="0.01" value="${value}">
					<input type="number" class="audio-volume-input" min="0" max="1" step="0.01" value="${value}">
				</div>
			`;

			const slider = wrapper.querySelector(".audio-volume-slider");
			const input = wrapper.querySelector(".audio-volume-input");
			const previewBtn = wrapper.querySelector(".audio-preview-button");
			const soundSelector = wrapper.querySelector(".audio-sound-selector");

			const updateVolume = (newValue) => {
				const val = Math.max(0, Math.min(1, Number(newValue)));
				slider.value = val;
				input.value = val.toFixed(2);

				if (!wikishield.options.volumes) wikishield.options.volumes = {};
				wikishield.options.volumes[triggerKey] = val;
				wikishield.saveOptions(wikishield.options);
			};

			slider.addEventListener("input", () => updateVolume(slider.value));
			input.addEventListener("change", () => updateVolume(input.value));

			// Sound selector
			soundSelector.addEventListener("change", () => {
				if (!wikishield.options.soundMappings) wikishield.options.soundMappings = {};
				wikishield.options.soundMappings[triggerKey] = soundSelector.value;
				wikishield.saveOptions(wikishield.options);
			});

			// Preview button - do NOT play click sound
			previewBtn.addEventListener("click", () => {
				if (playFunction) playFunction.call(wikishield.queue);
			});
		}

		/**
		 * Create an input with +/- buttons
		 * @param {HTMLElement} container Element to add the input to
		 * @param {Number} value Initial value for the input
		 * @param {Number} min Minimum input value
		 * @param {Number} max Maximum input value
		 * @param {Number} step Amount the +/- buttons change value by
		 * @param {(newValue: number) => void} onChange Callback function for input change
		 */
		createNumericInput(container, value, min, max, step, onChange) {
			const input = document.createElement("div");
			input.classList.add("numeric-input-container");
			container.appendChild(input);

			input.innerHTML = `
				<span class="fa fa-minus numeric-input-button"></span>
				<input type="text" class="numeric-input" value=${value}>
				<span class="fa fa-plus numeric-input-button"></span>
			`;

			const inputElem = input.querySelector("input");

			input.querySelector(".fa-minus").addEventListener("click", () => {
				wikishield.queue.playClickSound();
				value = Math.round(Math.max(value - step, min) * 100) / 100;
				inputElem.value = value;
				onChange(value);
			});

			input.querySelector(".fa-plus").addEventListener("click", () => {
				wikishield.queue.playClickSound();
				value = Math.round(Math.min(value + step, max) * 100) / 100;
				inputElem.value = value;
				onChange(value);
			});

			const onInputChange = () => {
				if (isNaN(Number(inputElem.value))) {
					inputElem.value = value;
				}

				value = Math.round(Math.min(Math.max(Number(inputElem.value), min), max) * 100) / 100;
				value = step >= 1 ? Math.round(value) : value;
				inputElem.value = value;
				onChange(value);
			};

			inputElem.addEventListener("blur", onInputChange);
			inputElem.addEventListener("keyup", (event) => {
				if (event.key.toLowerCase() === "enter") {
					onInputChange();
					inputElem.blur();
				}
			});
		}

		/**
		 * Open settings container and go to general settings
		 */
		openSettings() {
			this.closeSettings();
			this.isOpen = true;

			const container = document.createElement("div");
			container.classList.add("settings-container");
			document.body.appendChild(container);
			document.body.classList.add("settings-open"); // Add class to blur bottom bar
			container.innerHTML = wikishieldHTML.settings;

			container.addEventListener("click", this.closeSettings.bind(this));
			container.querySelector(".settings").addEventListener("click", (event) => event.stopPropagation());
			container.querySelector("#settings-general-button").classList.add("selected");

			this.contentContainer = container.querySelector(".settings-right");

			[
				["#settings-general-button", this.openGeneral.bind(this)],
				["#settings-audio-button", this.openAudio.bind(this)],
				["#settings-appearance-button", this.openAppearance.bind(this)],
				["#settings-controls-button", this.openControls.bind(this)],
				["#settings-ai-button", this.openAI.bind(this)],
				["#settings-gadgets-button", this.openGadgets.bind(this)],
				["#settings-whitelist-button", this.openWhitelist.bind(this)],
				["#settings-highlight-button", this.openHighlighted.bind(this)],
				["#settings-statistics-button", this.openStatistics.bind(this)],
				["#settings-about-button", this.openAbout.bind(this)],
				["#settings-import-export-button", this.openImportExport.bind(this)],
			].forEach(([sel, func]) => container.querySelector(sel).addEventListener("click", () => {
				wikishield.queue.playClickSound();
				this.contentContainer.innerHTML = "";

				[...document.querySelectorAll(".settings-left-menu-item.selected")]
					.forEach(e => e.classList.remove("selected"));
				container.querySelector(sel).classList.add("selected");

				func();
			}));

			this.openGeneral();
		}

		/**
		 * Open general settings section
		 */
		openGeneral() {
			this.contentContainer.innerHTML = `
				<div class="settings-compact-grid">
					<div class="settings-section compact" id="maximum-edit-count">
						<div class="settings-section-title">Maximum edit count</div>
						<div class="settings-section-desc">Edits from users with more than this edit count will not be shown</div>
					</div>
					<div class="settings-section compact" id="maximum-queue-size">
						<div class="settings-section-title">Maximum queue size</div>
						<div class="settings-section-desc">The queue will not load additional edits after reaching this size</div>
					</div>
					<div class="settings-section compact" id="minimum-ores-score">
						<div class="settings-section-title">Minimum ORES score</div>
						<div class="settings-section-desc">Edits with an <a href="https://www.mediawiki.org/wiki/ORES" target="_blank">ORES score</a> below this threshold will not be shown</div>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title">Expiries</div>
					<div class="settings-compact-grid">
						<div class="settings-section compact" id="watchlist-expiry">
							<div class="settings-section-title">Watchlist expiry for warned users</div>
							<div class="settings-section-desc">How long to watch user talk pages after issuing warnings</div>
						</div>
						<div class="settings-section compact" id="highlighted-expiry">
							<div class="settings-section-title">Highlighted user expiry</div>
							<div class="settings-section-desc">How long to keep users highlighted before expiration</div>
						</div>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title">Namespaces to show</div>
					<div class="settings-section-desc">Only edits from the selected namespaces will be shown in your queue.</div>
					<div id="namespace-container"></div>
				</div>
			`;

			this.createNumericInput(
				this.contentContainer.querySelector("#maximum-edit-count"),
				wikishield.options.maxEditCount, 0, 500, 5,
				(newValue) => {
					wikishield.options.maxEditCount = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			this.createNumericInput(
				this.contentContainer.querySelector("#maximum-queue-size"),
				wikishield.options.maxQueueSize, 10, 100, 5,
				(newValue) => {
					wikishield.options.maxQueueSize = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			this.createNumericInput(
				this.contentContainer.querySelector("#minimum-ores-score"),
				wikishield.options.minimumORESScore, 0, 1, 0.05,
				(newValue) => {
					wikishield.options.minimumORESScore = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			// Create watchlist expiry dropdown
			const watchlistContainer = this.contentContainer.querySelector("#watchlist-expiry");
			const watchlistSelect = document.createElement("select");
			watchlistSelect.innerHTML = `
				<option value="none">None</option>
				<option value="1 hour">1 hour</option>
				<option value="1 day">1 day</option>
				<option value="1 week">1 week</option>
				<option value="1 month">1 month</option>
				<option value="3 months">3 months</option>
				<option value="6 months">6 months</option>
				<option value="indefinite">Indefinite</option>
			`;
			watchlistSelect.value = wikishield.options.watchlistExpiry;
			watchlistSelect.addEventListener("change", () => {
				wikishield.options.watchlistExpiry = watchlistSelect.value;
				wikishield.saveOptions(wikishield.options);
			});
			watchlistContainer.appendChild(watchlistSelect);

			// Create highlighted expiry dropdown
			const highlightedContainer = this.contentContainer.querySelector("#highlighted-expiry");
			const highlightedSelect = document.createElement("select");
			highlightedSelect.innerHTML = `
				<option value="none">None</option>
				<option value="1 hour">1 hour</option>
				<option value="1 day">1 day</option>
				<option value="1 week">1 week</option>
				<option value="1 month">1 month</option>
				<option value="3 months">3 months</option>
				<option value="6 months">6 months</option>
				<option value="indefinite">Indefinite</option>
			`;
			highlightedSelect.value = wikishield.options.highlightedExpiry;
			highlightedSelect.addEventListener("change", () => {
				wikishield.options.highlightedExpiry = highlightedSelect.value;
				wikishield.saveOptions(wikishield.options);
			});
			highlightedContainer.appendChild(highlightedSelect);

			wikishieldData.namespaces.forEach(ns => {
				this.contentContainer.querySelector("#namespace-container").innerHTML += `
					<div>
						<input
							type="checkbox"
							data-nsid="${ns.id}"
							class="ns-checkbox"
							${wikishield.options.namespacesShown.includes(ns.id) ? "checked" : ""}>
						<label>${ns.name}</label>
					</div>
				`;
			});

			[...this.contentContainer.querySelectorAll(".ns-checkbox")].forEach(elem => {
				elem.addEventListener("change", () => {
					if (elem.checked) {
						const set = new Set(wikishield.options.namespacesShown);
						set.add(Number(elem.dataset.nsid));
						wikishield.options.namespacesShown = [...set];
					} else {
						wikishield.options.namespacesShown = wikishield.options.namespacesShown
							.filter(n => n !== Number(elem.dataset.nsid));
					}
					wikishield.saveOptions(wikishield.options);
				});
			});
		}

		/**
		 * Open audio settings section
		 */
		openAudio() {
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Master Volume</div>
					<div class="settings-section-desc">Controls the overall volume of all sounds</div>
					<div id="master-volume-control"></div>
				</div>

				<div class="settings-toggles-section">
					<div class="settings-section-header">
						<span class="settings-section-header-icon">ORES</span>
						<span>ORES Alerts</span>
					</div>
					<div class="settings-section compact inline" id="sound-alert-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Sound alerts for high ORES scores</div>
							<div class="settings-section-desc">Play a sound when an edit above the threshold is added to the queue</div>
						</div>
					</div>
					<div class="settings-section compact inline" id="sound-alert-ores-score">
						<div class="settings-section-content">
							<div class="settings-section-title">ORES score threshold</div>
							<div class="settings-section-desc">Play a sound alert when an edit with an ORES score above this value is added</div>
						</div>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title">Individual Sound Volumes</div>
					<div class="settings-section-desc">Adjust the volume for each sound effect and preview them</div>
					<div id="sound-volumes-container"></div>
				</div>
			`;

			// Master volume control
			this.createVolumeControl(
				this.contentContainer.querySelector("#master-volume-control"),
				null,
				"Master Volume",
				"Controls all sound volumes",
				null
			);

			// Override the createVolumeControl for master volume
			const masterContainer = this.contentContainer.querySelector("#master-volume-control");
			masterContainer.innerHTML = "";
			const wrapper = document.createElement("div");
			wrapper.classList.add("audio-volume-control");
			masterContainer.appendChild(wrapper);

			const masterValue = wikishield.options.masterVolume ?? 0.5;

			wrapper.innerHTML = `
				<div class="audio-control-slider-container">
					<input type="range" class="audio-volume-slider" min="0" max="1" step="0.01" value="${masterValue}">
					<input type="number" class="audio-volume-input" min="0" max="1" step="0.01" value="${masterValue}">
				</div>
			`;

			const masterSlider = wrapper.querySelector(".audio-volume-slider");
			const masterInput = wrapper.querySelector(".audio-volume-input");

			const updateMasterVolume = (newValue) => {
				const val = Math.max(0, Math.min(1, Number(newValue)));
				masterSlider.value = val;
				masterInput.value = val.toFixed(2);
				wikishield.options.masterVolume = val;
				wikishield.saveOptions(wikishield.options);
			};

			masterSlider.addEventListener("input", () => updateMasterVolume(masterSlider.value));
			masterInput.addEventListener("change", () => updateMasterVolume(masterInput.value));

			// ORES alert toggle
			this.createToggle(
				this.contentContainer.querySelector("#sound-alert-toggle"),
				wikishield.options.enableSoundAlerts,
				(newValue) => {
					wikishield.options.enableSoundAlerts = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			// ORES alert threshold
			this.createNumericInput(
				this.contentContainer.querySelector("#sound-alert-ores-score"),
				wikishield.options.soundAlertORESScore, 0, 1, 0.05,
				(newValue) => {
					wikishield.options.soundAlertORESScore = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			// Individual sound controls
			const soundsContainer = this.contentContainer.querySelector("#sound-volumes-container");

			const sounds = [
				{ key: "click", title: "Click Sound", desc: "Played when clicking buttons and UI elements", fn: wikishield.queue.playClickSound },
				{ key: "notification", title: "Notification Sound", desc: "Played when you recieve an alert or notice", fn: wikishield.queue.playNotificationSound },
				{ key: "alert", title: "Alert Sound", desc: "Played when a high ORES score edit is added to the queue", fn: wikishield.queue.playAlertSound },
				{ key: "whoosh", title: "Whoosh Sound", desc: "Played when items are removed or cleared", fn: wikishield.queue.playWhooshSound },
				{ key: "warn", title: "Warn Sound", desc: "Played when issuing a warning to a user", fn: wikishield.queue.playWarnSound },
				{ key: "rollback", title: "Rollback Sound", desc: "Played when performing a rollback action", fn: wikishield.queue.playRollbackSound },
				{ key: "report", title: "Report Sound", desc: "Played when reporting a user or page", fn: wikishield.queue.playReportSound },
				{ key: "thank", title: "Thank Sound", desc: "Played when thanking a user for their edit", fn: wikishield.queue.playThankSound },
				{ key: "protection", title: "Protection Sound", desc: "Played when requesting page protection", fn: wikishield.queue.playProtectionSound },
				{ key: "block", title: "Block Sound", desc: "Played when blocking a user", fn: wikishield.queue.playBlockSound },
				{ key: "sparkle", title: "Sparkle Sound", desc: "Played when highlighting or whitelisting users", fn: wikishield.queue.playSparkleSound }
			];

			sounds.forEach(sound => {
				this.createVolumeControl(
					soundsContainer,
					sound.key,
					sound.title,
					sound.desc,
					sound.fn
				);
			});
		}

		/**
		 * Open appearance settings section (Dark mode only)
		 */
		openAppearance() {
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Appearance</div>
					<div class="settings-section-desc">
						Light mode will come to WikiShield in a future release.
					</div>
					<div style="
						margin-top: 24px;
						padding: 20px;
						background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(240, 147, 251, 0.15));
						border: 1px solid rgba(102, 126, 234, 0.3);
						border-radius: 12px;
						text-align: center;
					">
						<div style="font-size: 2em; margin-bottom: 12px;">🌙</div>
						<div style="font-weight: 600; font-size: 1.1em; margin-bottom: 8px; color: #e0e0e0;">Dark Mode Active</div>
						<div style="opacity: 0.8; font-size: 0.9em; color: #c0c0c0;">The ultimate viewing experience</div>
					</div>
				</div>
			`;
		}

		/**
		 * Open controls settings section
		 */
		openControls() {
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Control scripts</div>
					<div class="settings-section-desc">Below you can change what actions are completed when a key is pressed.</div>
					<div class="add-action-button new-control-script">
						<span class="fa fa-plus"></span>
						New control script
					</div>
				</div>
			`;

			for (const control of wikishield.options.controlScripts) {
				const container = document.createElement("div");
				container.classList.add("settings-section");
				this.contentContainer.appendChild(container);

				this.createControlInterface(container, control);
			}

			this.updateDuplicateControls();

			const addButton = this.contentContainer.querySelector(".new-control-script");

			addButton.addEventListener("click", () => {
				wikishield.options.controlScripts.unshift({
					keys: [],
					actions: []
				});
				this.openControls();
			});
		}

		/**
		 * Find which, if any, keys are used for more than one control
		 * @returns {String[]} List of keys used more than once
		 */
		findDuplicateControls() {
			const keys = {};

			for (const control of wikishield.options.controlScripts) {
				for (const key of control.keys) {
					if (!keys[key]) {
						keys[key] = 0;
					}

					keys[key] += 1;
				}
			}

			const multiples = [];
			Object.keys(keys).forEach(key => {
				if (keys[key] > 1) {
					multiples.push(key);
				}
			});
			return multiples;
		}

		/**
		 * Highlight any duplicated control keys
		 */
		updateDuplicateControls() {
			const duplicateControls = this.findDuplicateControls();
			[...document.querySelectorAll(".control-keys > div[data-key]")].forEach(elem => {
				if (duplicateControls.includes(elem.dataset.key)) {
					elem.classList.add("key-duplicate");
				} else {
					elem.classList.remove("key-duplicate");
				}
			});
		}

		/**
		 * Create interface for changing what a control does
		 * @param {HTMLElement} container Parent element
		 * @param {Object} control The control object, see wikishieldData.controlScripts
		 */
		createControlInterface(container, control) {
			container.innerHTML = `
				<div class="control-container">
					<div class="control-container-title">When these keys are pressed</div>
					<div class="control-keys"></div>
					<div class="control-container-title" style="margin-top: 10px;">Complete these actions</div>
					<div class="control-actions"></div>
				</div>
			`;

			const keyContainer = container.querySelector(".control-keys");
			const actionContainer = container.querySelector(".control-actions");

			for (const key of control.keys) {
				const keyElem = document.createElement("div");
				keyContainer.appendChild(keyElem);
				keyElem.innerHTML = `
					<div class="key-elem-title">${key === " " ? "space" : key}</div>
					<span class="fas fa-trash-can remove"></span>
				`;
				keyElem.dataset.key = key;

				keyElem.querySelector(".remove").addEventListener("click", () => {
					const set = new Set(control.keys);
					set.delete(key);
					control.keys = [...set];
					this.createControlInterface(container, control);
					this.updateDuplicateControls();
					wikishield.saveOptions(wikishield.options);
				});
			}

			const plusElem = document.createElement("div");
			keyContainer.appendChild(plusElem);
			plusElem.innerHTML = `<span class="fas fa-plus"></span>`;
			plusElem.style.cursor = "pointer";

			plusElem.addEventListener("click", () => {
				[...document.querySelectorAll(".key-select")].forEach(elem => elem.remove());
				const keySelect = document.createElement("div");
				keySelect.classList.add("key-select");
				keySelect.innerHTML = "Press a key...";
				plusElem.parentElement.insertBefore(keySelect, plusElem);

				keySelect.addEventListener("click", () => keySelect.remove());
				this.keypressCallback = (key) => {
					const set = new Set(control.keys);
					set.add(key);
					control.keys = [...set];

					this.createControlInterface(container, control);
					this.updateDuplicateControls();
					this.keypressCallback = null;
					wikishield.saveOptions(wikishield.options);
				};
			});

			for (const action of control.actions) {
				this.createActionItem(
					actionContainer,
					action,
					control,
					() => {
						wikishield.saveOptions(wikishield.options);
						this.createControlInterface(container, control);
					}
				);
			}

			const bottomContainer = document.createElement("div");
			bottomContainer.classList.add("control-bottom-container");
			bottomContainer.innerHTML = `
				<div class="add-action-container"></div>
				<div>
					<div class="add-action-button control-delete">Delete</div>
				</div>
			`;
			actionContainer.appendChild(bottomContainer);

			bottomContainer.querySelector(".control-delete").addEventListener("click", () => {
				wikishield.queue.playClickSound();
				wikishield.options.controlScripts.splice(wikishield.options.controlScripts.indexOf(control), 1);
				wikishield.saveOptions(wikishield.options);
				this.openControls();
			});

			const addContainer = bottomContainer.querySelector(".add-action-container");

			const resetAddContainer = () => {
				addContainer.innerHTML = `<div class="add-action-button new-button">Add new action</div>`;

				addContainer.querySelector(".new-button").addEventListener("click", () => {
					wikishield.queue.playClickSound();
					addContainer.innerHTML = `
						<select style="height: 35px;"></select>
						<div class="add-action-button cancel-button">Cancel</div>
						<div class="add-action-button create-button">Create</div>
					`;

					const select = addContainer.querySelector("select");

					Object.keys(wikishield.interface.eventManager.events).forEach(name => {
						select.innerHTML += `<option value="${name}">${wikishield.interface.eventManager.events[name].description}</option>`;
					});
					select.innerHTML += `<option value="if">If condition</option>`;

					addContainer.querySelector(".cancel-button").addEventListener("click", () => {
						wikishield.queue.playClickSound();
						resetAddContainer();
					});
					addContainer.querySelector(".create-button").addEventListener("click", () => {
						wikishield.queue.playClickSound();
						const action = {
							name: select.value,
							params: {}
						};
						if (select.value === "if") {
							action.actions = [];
							action.condition = "operatorNonAdmin";
						}

						control.actions.push(action);
						wikishield.saveOptions(wikishield.options);
						this.createControlInterface(container, control);
					});
				});
			};

			resetAddContainer();
		}

		/**
		 * Given an action, find its parent
		 * @param {Object} action
		 * @param {Object} parent Object to search through
		 * @returns {Object} The parent action
		 */
		findParentOfAction(action, parent) {
			if (parent.actions.indexOf(action) !== -1) {
				return parent;
			}

			for (const act of parent.actions) {
				if (act.name === "if") {
					const result = this.findParentOfAction(action, act);
					if (result) {
						return result;
					}
				}
			}
		}

		/**
		 * Create the interface for a single action
		 * @param {HTMLElement} container Parent element
		 * @param {Object} action
		 * @param {Object} control The parent control object
		 * @param {() => void} onChange Function to callback if the action is modified
		 */
		createActionItem(container, action, control, onChange) {
			const itemContainer = document.createElement("div");
			itemContainer.classList.add("control-action");
			container.appendChild(itemContainer);

			if (action.name === "if") {
				itemContainer.innerHTML = `
					<div class="control-action-title">
						<div class="control-action-title-left">
							<span class="fas fa-circle-question"></span>
							If <select></select> then:
						</div>
						<div class="control-action-title-right"></div>
					</div>
				`;

				const select = itemContainer.querySelector("select");

				for (const key in wikishieldEventData.conditions) {
					select.innerHTML += `<option value=${key}>${wikishieldEventData.conditions[key].desc}</option>`;
				}

				select.value = action.condition;

				select.addEventListener("change", () => {
					action.condition = select.value;
					onChange();
				});

				for (const subaction of action.actions) {
					this.createActionItem(itemContainer, subaction, control, onChange);
				}
			} else {
				const event = wikishield.interface.eventManager.events[action.name];
				itemContainer.innerHTML = `
					<div class="control-action-title">
						<div class="control-action-title-left">
							<span class="${event.icon}"></span>
							${event.description}
						</div>
						<div class="control-action-title-right"></div>
					</div>
				`;

				for (const param of (event.parameters || [])) {
					this.createItemParameter(itemContainer, param, action.params[param.id] || "", (value) => {
						action.params[param.id] = value;
						wikishield.saveOptions(wikishield.options);
					});
				}
			}

			itemContainer.querySelector(".control-action-title-right").innerHTML = `
				<span class="fas fa-chevron-up move-action-up"></span>
				<span class="fas fa-chevron-down move-action-down"></span>
				<span class="fas fa-trash-can delete-action"></span>
			`;

			itemContainer.querySelector(".move-action-down").addEventListener("click", () => {
				const parent = this.findParentOfAction(action, control);
				const actionIndex = parent.actions.indexOf(action);

				if (parent.actions.indexOf(action) === parent.actions.length - 1) {
					if (parent.name !== "if") {
						return;
					}

					const grandparent = this.findParentOfAction(parent, control);
					grandparent.actions.splice(grandparent.actions.indexOf(parent) + 1, 0, action);
					parent.actions.splice(actionIndex, 1);
				} else {
					const nextSibling = parent.actions[actionIndex + 1];
					if (nextSibling.name === "if") {
						nextSibling.actions.unshift(action);
						parent.actions.splice(actionIndex, 1);
					} else {
						parent.actions.splice(actionIndex, 1);
						parent.actions.splice(actionIndex + 1, 0, action);
					}
				}

				onChange();
			});

			itemContainer.querySelector(".move-action-up").addEventListener("click", () => {
				const parent = this.findParentOfAction(action, control);
				const actionIndex = parent.actions.indexOf(action);

				if (parent.actions.indexOf(action) === 0) {
					if (parent.name !== "if") {
						return;
					}

					const grandparent = this.findParentOfAction(parent, control);
					grandparent.actions.splice(grandparent.actions.indexOf(parent), 0, action);
					parent.actions.splice(actionIndex, 1);
				} else {
					const prevSibling = parent.actions[actionIndex - 1];
					if (prevSibling.name === "if") {
						prevSibling.actions.push(action);
						parent.actions.splice(actionIndex, 1);
					} else {
						parent.actions.splice(actionIndex, 1);
						parent.actions.splice(actionIndex - 1, 0, action);
					}
				}

				onChange();
			});

			itemContainer.querySelector(".delete-action").addEventListener("click", () => {
				const parent = this.findParentOfAction(action, control);
				parent.actions.splice(parent.actions.indexOf(action), 1);
				onChange();
			});
		}

		/**
		 * Given a parameter, create a label and input
		 * @param {HTMLElement} container
		 * @param {Object} parameter
		 * @param {String} value
		 * @param {(value: string) => void} onChange
		 */
		createItemParameter(container, parameter, value, onChange) {
			const parameterElem = document.createElement("div");
			parameterElem.classList.add("action-parameter");
			container.appendChild(parameterElem);
			parameterElem.innerHTML = `
				<div class="parameter-title">${parameter.title}</div>
			`;

			if (parameter.type === "choice") {
				parameterElem.innerHTML += `<select></select>`;
				const select = parameterElem.querySelector("select");

				for (const choice of parameter.options) {
					select.innerHTML += `<option>${choice}</option>`;
				}

				select.value = value;
				select.addEventListener("change", () => onChange(select.value));
			} else if (parameter.type === "text") {
				parameterElem.innerHTML += `<input type="text">`;
				const input = parameterElem.querySelector("input");
				input.value = value;

				input.addEventListener("keydown", (event) => {
					if (event.key.toLowerCase() === "enter") {
						onChange(input.value);
						input.blur();
					}
				});
				input.addEventListener("blur", () => onChange(input.value));
			}
		}

		/**
		 * Open AI Analysis settings section
		 */
		openAI() {
			this.contentContainer.innerHTML = `
				<div class="settings-section" id="enable-ollama-ai">
					<div class="settings-section-title">Enable Ollama AI Analysis</div>
					<div class="settings-section-desc">Use local AI models with complete privacy. Free & fast.</div>
				</div>

				<div class="settings-section" id="ollama-server-url">
					<div class="settings-section-title">Server URL</div>
					<div class="settings-section-desc">
						<input type="text" id="ollama-url-input" value="${wikishield.options.ollamaServerUrl}"
							style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; margin-bottom: 8px;"
							placeholder="http://localhost:11434">
						<button id="test-connection-btn" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em;">
							Test Connection
						</button>
						<span id="connection-status" style="margin-left: 8px; font-size: 0.9em;"></span>
					</div>
				</div>

				<div class="settings-section" id="ollama-model-select">
					<div class="settings-section-title">Model Selection</div>
					<div class="settings-section-desc">
						<button id="refresh-models-btn" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em;">
							<span class="fa fa-sync"></span> Refresh Models
						</button>
						<span id="models-status" style="margin-left: 8px; font-size: 0.9em;"></span>
						<div style="margin-top: 12px;" id="models-container">
							<div style="color: #666; font-style: italic; font-size: 0.9em;">Click "Refresh Models" to load available models</div>
						</div>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title" style="color: #dc3545;">CORS Setup Required</div>
					<div class="settings-section-desc" style="background: #fff3cd20; padding: 10px; border-radius: 6px; border-left: 4px solid #ffc107; font-size: 0.9em; color: #333;">
						<strong>Set environment variable:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; color: #333;">OLLAMA_ORIGINS</code>
						<br><strong>Value:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; color: #333;">https://en.wikipedia.org,https://*.wikipedia.org</code>
						<br><br>
						<details style="cursor: pointer;">
							<summary style="font-weight: 600; margin-bottom: 6px;">Windows (Permanent)</summary>
							<ol style="margin: 6px 0; padding-left: 20px; font-size: 0.85em;">
								<li>System Properties → Environment Variables</li>
								<li>New Variable: <code style="color: #333;">OLLAMA_ORIGINS</code></li>
								<li>Value: <code style="color: #333;">https://en.wikipedia.org,https://*.wikipedia.org</code></li>
								<li>Restart Ollama</li>
							</ol>
						</details>
						<details style="cursor: pointer;">
							<summary style="font-weight: 600; margin-bottom: 6px;">Windows (Temporary)</summary>
							<pre style="background: #2d2d2d; color: #f8f8f2; padding: 8px; border-radius: 4px; font-size: 0.8em; margin: 6px 0;">$env:OLLAMA_ORIGINS="https://en.wikipedia.org,https://*.wikipedia.org"
	ollama serve</pre>
						</details>
						<details style="cursor: pointer;">
							<summary style="font-weight: 600; margin-bottom: 6px;">macOS/Linux</summary>
							Add to <code>~/.bashrc</code> or <code>~/.zshrc</code>:
							<pre style="background: #2d2d2d; color: #f8f8f2; padding: 8px; border-radius: 4px; font-size: 0.8em; margin: 6px 0;">export OLLAMA_ORIGINS="https://en.wikipedia.org,https://*.wikipedia.org"</pre>
							Then: <code>source ~/.bashrc && ollama serve</code>
						</details>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title">Quick Info</div>
					<div class="settings-section-desc" style="font-size: 0.9em;">
						<strong>Get Ollama:</strong> <a href="https://ollama.com" target="_blank" style="color: #667eea; font-weight: bold;">ollama.com</a>
						<br><strong>Popular models:</strong> llama3.2, mistral, gemma2, qwen2.5
						<br><strong>Detects:</strong> Vandalism, spam, POV, attacks, copyright issues, policy violations
					</div>
				</div>
			`;

			// Enable/disable toggle
			this.createToggle(
				this.contentContainer.querySelector("#enable-ollama-ai"),
				wikishield.options.enableOllamaAI,
				(newValue) => {
					wikishield.options.enableOllamaAI = newValue;
					wikishield.saveOptions(wikishield.options);

				// Initialize or destroy Ollama AI instance
				if (newValue) {
					wikishield.ollamaAI = new WikiShieldOllamaAI(
						wikishield.options.ollamaServerUrl,
						wikishield.options.ollamaModel,
						{
							enableOllamaAI: wikishield.options.enableOllamaAI,
							enableEditAnalysis: wikishield.options.enableEditAnalysis
						}
					);
					wikishield.logger.log("Ollama AI integration enabled");
				} else {
					wikishield.ollamaAI = null;
					wikishield.logger.log("Ollama AI integration disabled");
					}
				}
			);

			// Server URL input handler
			const urlInput = this.contentContainer.querySelector("#ollama-url-input");
			urlInput.addEventListener('change', () => {
				wikishield.options.ollamaServerUrl = urlInput.value.trim();
				wikishield.saveOptions(wikishield.options);
				if (wikishield.ollamaAI) {
					wikishield.ollamaAI.serverUrl = wikishield.options.ollamaServerUrl;
				}
				wikishield.logger.log(`Ollama server URL updated: ${wikishield.options.ollamaServerUrl}`);
			});

			// Test connection button
			const testBtn = this.contentContainer.querySelector("#test-connection-btn");
			const statusSpan = this.contentContainer.querySelector("#connection-status");
			testBtn.addEventListener('click', async () => {
				// Cancel all active AI requests
				if (wikishield.ollamaAI) {
					wikishield.ollamaAI.cancelAllAnalyses();
				}

			statusSpan.innerHTML = '<span style="color: #ffc107;">Testing...</span>';
			testBtn.disabled = true;

			const tempAI = new WikiShieldOllamaAI(wikishield.options.ollamaServerUrl, "", {});
			const connected = await tempAI.testConnection();

				if (connected) {
					statusSpan.innerHTML = '<span style="color: #28a745;"><span class="fa fa-check-circle"></span> Connected!</span>';
				} else {
					statusSpan.innerHTML = `
						<span style="color: #dc3545;">
							<span class="fa fa-times-circle"></span> Failed to connect
							<br><small style="font-size: 0.85em;">Make sure Ollama is running with CORS enabled (see instructions above)</small>
						</span>
					`;
				}
				testBtn.disabled = false;
			});

			// Refresh models button
			const refreshBtn = this.contentContainer.querySelector("#refresh-models-btn");
			const modelsStatus = this.contentContainer.querySelector("#models-status");
			const modelsContainer = this.contentContainer.querySelector("#models-container");

			refreshBtn.addEventListener('click', async () => {
				// Cancel all active AI requests
				if (wikishield.ollamaAI) {
					wikishield.ollamaAI.cancelAllAnalyses();
				}

			modelsStatus.innerHTML = '<span style="color: #ffc107;">Loading...</span>';
			refreshBtn.disabled = true;

			try {
				const tempAI = new WikiShieldOllamaAI(wikishield.options.ollamaServerUrl, "", {});
				const models = await tempAI.fetchModels();

					if (models.length === 0) {
						modelsContainer.innerHTML = '<div style="color: #dc3545;">No models found. Please install models using: <code>ollama pull [model-name]</code></div>';
						modelsStatus.innerHTML = '<span style="color: #dc3545;">No models found</span>';
					} else {
						modelsStatus.innerHTML = `<span style="color: #28a745;"><span class="fa fa-check-circle"></span> Found ${models.length} model(s)</span>`;

						let modelsHTML = '<div style="display: grid; gap: 8px; margin-top: 8px;">';
						models.forEach(model => {
							const isSelected = model.name === wikishield.options.ollamaModel;
							const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(1);
							modelsHTML += `
								<div class="ollama-model-item" data-model="${model.name}" style="
									padding: 12px;
									border: 2px solid ${isSelected ? '#667eea' : 'rgba(128, 128, 128, 0.3)'};
									border-radius: 6px;
									cursor: pointer;
									background: ${isSelected ? 'rgba(102, 126, 234, 0.15)' : 'transparent'};
									transition: all 0.2s;
								">
									<div style="display: flex; align-items: center; gap: 8px;">
										<span class="fa ${isSelected ? 'fa-check-circle' : 'fa-circle'}" style="color: ${isSelected ? '#667eea' : 'rgba(128, 128, 128, 0.5)'};"></span>
										<strong style="flex: 1;">${model.name}</strong>
										<span style="font-size: 0.85em; opacity: 0.7;">${sizeGB} GB</span>
									</div>
									<div style="font-size: 0.85em; opacity: 0.6; margin-top: 4px;">
										Modified: ${new Date(model.modified_at).toLocaleDateString()}
									</div>
								</div>
							`;
						});
						modelsHTML += '</div>';
						modelsContainer.innerHTML = modelsHTML;

						// Add click handlers for model selection
						modelsContainer.querySelectorAll('.ollama-model-item').forEach(item => {
							item.addEventListener('click', () => {
								// Cancel all active AI requests when switching models
								if (wikishield.ollamaAI) {
									wikishield.ollamaAI.cancelAllAnalyses();
								}

								const modelName = item.dataset.model;
								wikishield.options.ollamaModel = modelName;
								wikishield.saveOptions(wikishield.options);
								if (wikishield.ollamaAI) {
									wikishield.ollamaAI.model = modelName;
								}
								wikishield.logger.log(`Ollama model selected: ${modelName}`);

								// Update UI
								modelsContainer.querySelectorAll('.ollama-model-item').forEach(i => {
									i.style.border = '2px solid rgba(128, 128, 128, 0.3)';
									i.style.background = 'transparent';
									i.querySelector('.fa').classList.remove('fa-check-circle');
									i.querySelector('.fa').classList.add('fa-circle');
									i.querySelector('.fa').style.color = 'rgba(128, 128, 128, 0.5)';
								});
								item.style.border = '2px solid #667eea';
								item.style.background = 'rgba(102, 126, 234, 0.15)';
								item.querySelector('.fa').classList.remove('fa-circle');
								item.querySelector('.fa').classList.add('fa-check-circle');
								item.querySelector('.fa').style.color = '#667eea';
							});

							// Hover effects
							item.addEventListener('mouseenter', () => {
								if (item.dataset.model !== wikishield.options.ollamaModel) {
									item.style.borderColor = '#667eea';
								}
							});
							item.addEventListener('mouseleave', () => {
								if (item.dataset.model !== wikishield.options.ollamaModel) {
									item.style.borderColor = 'rgba(128, 128, 128, 0.3)';
								}
							});
						});
					}
				} catch (err) {
					modelsContainer.innerHTML = `
						<div class="error-box" style="color: #721c24; padding: 12px; background: #fff3cd20; border-radius: 6px; border-left: 4px solid #dc3545;">
							<strong>Error:</strong> ${err.message}
							<br><br>
							<strong>Troubleshooting:</strong>
							<ul style="margin: 8px 0; padding-left: 20px;">
								<li>Make sure Ollama is running</li>
								<li>Check that CORS is enabled (see instructions above)</li>
								<li>Verify the server URL is correct</li>
								<li>Try the "Test Connection" button first</li>
							</ul>
						</div>
					`;
					modelsStatus.innerHTML = '<span style="color: #dc3545;"><span class="fa fa-times-circle"></span> Error loading models</span>';
				}

				refreshBtn.disabled = false;
			});
		}

		/**
		 * Open gadgets settings seciton
		 */
		openGadgets() {
			this.contentContainer.innerHTML = `
				<div class="settings-toggles-section">
					<div class="settings-section-header">
						<span class="settings-section-header-icon">Simple</span>
						<span></span>
					</div>
                    <div class="settings-section compact inline" id="username-highlighting-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Highlight username</div>
							<div class="settings-section-desc">If your username appears in a diff, the edit is highlighted in the queue and outlined in the diff.</div>
						</div>
					</div>
                    <div class="settings-section compact inline" id="welcome-latin-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Latin welcome</div>
							<div class="settings-section-desc">When a Latin character is detected in a username, the Latin welcome template will be used instead of the default.</div>
						</div>
					</div>
					<div class="settings-section compact inline" id="auto-welcome-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Automatic welcoming of new users</div>
							<div class="settings-section-desc">Automatically welcome new users with empty talk pages when moving past their constructive edits</div>
						</div>
					</div>
				</div>

				<div class="settings-toggles-section">
					<div class="settings-section-header">
						<span class="settings-section-header-icon">AI</span>
						<span>Requires AI Analysis to be enabled</span>
					</div>
					<div class="settings-section compact inline" id="edit-analysis-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Edit Analysis</div>
							<div class="settings-section-desc">Suggests actions to take on edits, such as "welcome", "thank", "rollback", "rever-and-warn"</div>
						</div>
					</div>
					<div class="settings-section compact inline" id="username-analysis-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Username Analysis</div>
							<div class="settings-section-desc">Flags potentially problematic usernames and prompts you to report them to UAA</div>
						</div>
					</div>
				</div>
			`;

            this.createToggle(
				this.contentContainer.querySelector("#username-highlighting-toggle"),
				wikishield.options.enableUsernameHighlighting,
				(newValue) => {
					wikishield.options.enableUsernameHighlighting = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

            this.createToggle(
				this.contentContainer.querySelector("#welcome-latin-toggle"),
				wikishield.options.enableWelcomeLatin,
				(newValue) => {
					wikishield.options.enableWelcomeLatin = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);
			this.createToggle(
				this.contentContainer.querySelector("#auto-welcome-toggle"),
				wikishield.options.enableAutoWelcome,
				(newValue) => {
					wikishield.options.enableAutoWelcome = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			this.createToggle(
				this.contentContainer.querySelector("#edit-analysis-toggle"),
				wikishield.options.enableEditAnalysis,
				(newValue) => {
					wikishield.options.enableEditAnalysis = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);
			this.createToggle(
				this.contentContainer.querySelector("#username-analysis-toggle"),
				wikishield.options.enableUsernameAnalysis,
				(newValue) => {
					wikishield.options.enableUsernameAnalysis = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);
		}

		/**
		 * Open whitelist settings section
		 */
		openWhitelist() {
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Whitelisted users</div>
					<div class="settings-section-desc">This is a list of users you have whitelisted. Edits by these users will not appear in your queue.</div>
					<div class="user-input-container">
						<input type="text" id="whitelist-username-input" placeholder="Enter username to whitelist..." class="username-input">
						<button id="add-whitelist-user" class="add-user-button">
							Add User
						</button>
					</div>
				</div>
				<div class="settings-section user-container"></div>
			`;

			const container = this.contentContainer.querySelector(".user-container");
			const input = this.contentContainer.querySelector("#whitelist-username-input");
			const button = this.contentContainer.querySelector("#add-whitelist-user");

			const addUser = () => {
				const username = input.value.trim();
				if (username) {
					wikishield.whitelist.set(username, Date.now());
					wikishield.saveWhitelist();
					input.value = "";
					this.openWhitelist(); // Refresh the list
					wikishield.sounds.success();
				}
			};

			button.addEventListener("click", addUser);
			input.addEventListener("keypress", (e) => {
				if (e.key === "Enter") addUser();
			});

			this.createUserListWithDates(container, wikishield.whitelist, wikishield.saveWhitelist.bind(wikishield));
		}

		/**
		 * Create a list of users given a set of usernames (old format)
		 * @param {HTMLElement} container
		 * @param {Set<string>} set
		 */
		createUserList(container, set) {
			for (const user of [...set]) {
				const userItem = document.createElement("div");
				container.appendChild(userItem);
				userItem.innerHTML = `
					<div>
						<a target="_blank" href="${wikishield.util.pageLink(`Special:Contributions/${user}`)}">${user}</a>
					</div>
					<div class="add-action-button remove-button">Remove</div>
				`;
				userItem.querySelector(".remove-button").addEventListener("click", () => {
					set.delete(user);
					userItem.remove();
				});
			}
		}

		/**
		 * Create a list of users with timestamps
		 * @param {HTMLElement} container
		 * @param {Map<string, number>} map Map of username to timestamp
		 * @param {Function} saveCallback Function to call when list is modified
		 */
		createUserListWithDates(container, map, saveCallback) {
			// Sort by most recent first
			const sortedEntries = [...map.entries()].sort((a, b) => b[1] - a[1]);

			for (const [user, timestamp] of sortedEntries) {
				const userItem = document.createElement("div");
				userItem.style.display = "flex";
				userItem.style.justifyContent = "space-between";
				userItem.style.alignItems = "center";
				userItem.style.padding = "8px 12px";
				userItem.style.marginBottom = "6px";
				userItem.style.background = "rgba(255, 255, 255, 0.05)";
				userItem.style.borderRadius = "8px";
				userItem.style.border = "1px solid rgba(255, 255, 255, 0.1)";

				const date = new Date(timestamp);
				const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();

				container.appendChild(userItem);
				userItem.innerHTML = `
					<div style="display: flex; flex-direction: column; gap: 4px;">
						<a target="_blank" href="${wikishield.util.pageLink(`Special:Contributions/${user}`)}" style="font-weight: 600;">${user}</a>
						<span style="font-size: 0.85em; opacity: 0.7;">Added: ${dateStr}</span>
					</div>
					<div class="add-action-button remove-button">Remove</div>
				`;
				userItem.querySelector(".remove-button").addEventListener("click", () => {
					map.delete(user);
					userItem.remove();
					if (saveCallback) saveCallback();
				});
			}

			if (sortedEntries.length === 0) {
				container.innerHTML = '<div style="opacity: 0.6; text-align: center; padding: 20px;">No users in list</div>';
			}
		}

		/**
		 * Open highlighted settings section
		 */
		openHighlighted() {
			const expiryString = wikishield.options.highlightedExpiry;
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Highlighted users</div>
					<div class="settings-section-desc">This is a list of users you have highlighted. Edits by these users will appear before other edits in your queue. Highlights expire based on your configured expiry time (currently: ${expiryString}).</div>
					<div class="user-input-container">
						<input type="text" id="highlighted-username-input" placeholder="Enter username to highlight..." class="username-input">
						<button id="add-highlighted-user" class="add-user-button">
							Add User
						</button>
					</div>
				</div>
				<div class="settings-section user-container"></div>
			`;

			const container = this.contentContainer.querySelector(".user-container");
			const input = this.contentContainer.querySelector("#highlighted-username-input");
			const button = this.contentContainer.querySelector("#add-highlighted-user");

			const addUser = () => {
				const username = input.value.trim();
				if (username) {
					const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.options.highlightedExpiry);
					const expirationTime = Date.now() + expiryMs;
					wikishield.highlighted.set(username, expirationTime);
					wikishield.saveHighlighted();
					input.value = "";
					this.openHighlighted(); // Refresh the list
					wikishield.sounds.success();
				}
			};

			button.addEventListener("click", addUser);
			input.addEventListener("keypress", (e) => {
				if (e.key === "Enter") addUser();
			});

			this.createHighlightedUserList(container);
		}

		/**
		 * Create a list of highlighted users with expiration times
		 * @param {HTMLElement} container
		 */
		createHighlightedUserList(container) {
			// Sort by most recent first
			const sortedEntries = [...wikishield.highlighted.entries()].sort((a, b) => b[1] - a[1]);

			for (const [user, expirationTime] of sortedEntries) {
				const userItem = document.createElement("div");
				userItem.style.display = "flex";
				userItem.style.justifyContent = "space-between";
				userItem.style.alignItems = "center";
				userItem.style.padding = "8px 12px";
				userItem.style.marginBottom = "6px";
				userItem.style.background = "rgba(255, 255, 255, 0.05)";
				userItem.style.borderRadius = "8px";
				userItem.style.border = "1px solid rgba(255, 255, 255, 0.1)";

				// Calculate added time by using current expiry setting (approximation)
				const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.options.highlightedExpiry);
				const addedTime = expirationTime - expiryMs;
				const date = new Date(addedTime);
				const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();

				const expiresDate = new Date(expirationTime);
				const expiresStr = expiresDate.toLocaleDateString() + " " + expiresDate.toLocaleTimeString();
				const isExpired = Date.now() > expirationTime;

				container.appendChild(userItem);
				userItem.innerHTML = `
					<div style="display: flex; flex-direction: column; gap: 4px;">
						<a target="_blank" href="${wikishield.util.pageLink(`Special:Contributions/${user}`)}" style="font-weight: 600;">${user}</a>
						<span style="font-size: 0.85em; opacity: 0.7;">Added: ${dateStr}</span>
						<span style="font-size: 0.85em; opacity: 0.7; color: ${isExpired ? '#ff6b6b' : '#51cf66'};">
							${isExpired ? 'Expired' : 'Expires'}: ${expiresStr}
						</span>
					</div>
					<div class="add-action-button remove-button">Remove</div>
				`;
				userItem.querySelector(".remove-button").addEventListener("click", () => {
					wikishield.highlighted.delete(user);
					userItem.remove();
					wikishield.saveHighlighted();
				});
			}

			if (sortedEntries.length === 0) {
				container.innerHTML = '<div style="opacity: 0.6; text-align: center; padding: 20px;">No users highlighted</div>';
			}
		}

		/**
		 * Open statistics settings section
		 */
		openStatistics() {
			const stats = wikishield.statistics;
			const revertRate = stats.reviewed > 0 ? Math.round(stats.reverts / stats.reviewed * 1000) / 10 : 0;
			const sessionTime = Date.now() - (stats.sessionStart || Date.now());
			const hours = Math.floor(sessionTime / (1000 * 60 * 60));
			const minutes = Math.floor((sessionTime % (1000 * 60 * 60)) / (1000 * 60));
			const editsPerHour = hours > 0 ? Math.round(stats.reviewed / hours * 10) / 10 : 0;

			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Statistics Overview</div>
					<div class="stats-grid">
						<div class="stat-card">
							<div class="stat-value">${stats.reviewed}</div>
							<div class="stat-label">Edits Reviewed</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.reverts}</div>
							<div class="stat-label">Reverts Made</div>
							<div class="stat-sublabel">${revertRate}% revert rate</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.warnings}</div>
							<div class="stat-label">Warnings Issued</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.reports}</div>
							<div class="stat-label">Reports Filed</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.welcomes}</div>
							<div class="stat-label">Users Welcomed</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.blocks}</div>
							<div class="stat-label">Blocks Issued</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.whitelisted}</div>
							<div class="stat-label">Users Whitelisted</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.highlighted}</div>
							<div class="stat-label">Users Highlighted</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${hours}h ${minutes}m</div>
							<div class="stat-label">Session Time</div>
							<div class="stat-sublabel">${editsPerHour} edits/hour</div>
						</div>
					</div>
				</div>
				<div class="settings-section">
					<button id="reset-stats-button" class="danger-button">Reset Statistics</button>
				</div>
			`;

			this.contentContainer.querySelector("#reset-stats-button").addEventListener("click", () => {
				if (confirm("Are you sure you want to reset all statistics? This cannot be undone.")) {
					wikishield.statistics = {
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
					wikishield.saveStats(wikishield.statistics);
					this.openStatistics();
					wikishield.sounds.success();
				}
			});
		}

		/**
		 * Open about settings section
		 */
		openAbout() {
			this.contentContainer.innerHTML = `
				<div class="settings-section" style="text-align: center; padding: 40px 20px;">
					<div style="margin-bottom: 24px;">
						<div style="font-size: 3em; margin-bottom: 12px;">🛡️</div>
						<div style="font-size: 2em; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px;">
							WikiShield
						</div>
						<div style="font-size: 1.1em; color: #666; font-weight: 500;">
							Advanced Anti-Vandalism Tool
						</div>
					</div>

					<div style="display: inline-flex; gap: 12px; margin: 24px 0; flex-wrap: wrap; justify-content: center;">
						<div style="padding: 8px 16px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.2);">
							<span style="font-weight: 600;">Version</span>
							<span style="margin-left: 8px; color: #667eea;">${__script__.version}</span>
						</div>
						<div style="padding: 8px 16px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.2);">
							<span style="font-weight: 600;">Created by</span>
							<a href="https://en.wikipedia.org/wiki/User:LuniZunie" target="_blank" style="margin-left: 8px; color: #667eea; text-decoration: none; font-weight: 600;">User:LuniZunie</a>
						</div>
					</div>

					<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 32px 0; text-align: center;">
						<div style="padding: 24px 16px; background: rgba(102, 126, 234, 0.05); border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.15);">
							<div style="font-size: 2em; margin-bottom: 8px;">⚡</div>
							<div style="font-weight: 600; margin-bottom: 4px; color: #aaa;">Real-time Detection</div>
							<div style="font-size: 0.9em; color: #888;">Monitor edits as they happen</div>
						</div>
						<div style="padding: 24px 16px; background: rgba(102, 126, 234, 0.05); border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.15);">
							<div style="font-size: 2em; margin-bottom: 8px;">🤖</div>
							<div style="font-weight: 600; margin-bottom: 4px; color: #aaa;">AI-Powered ORES</div>
							<div style="font-size: 0.9em; color: #888;">Intelligent edit scoring</div>
						</div>
						<div style="padding: 24px 16px; background: rgba(102, 126, 234, 0.05); border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.15);">
							<div style="font-size: 2em; margin-bottom: 8px;">🎨</div>
							<div style="font-weight: 600; margin-bottom: 4px; color: #aaa;">Modern Interface</div>
							<div style="font-size: 0.9em; color: #888;">Beautiful and intuitive</div>
						</div>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title">Changelog</div>
					<div style="max-height: 400px; overflow-y: auto; padding: 16px; background: rgba(248, 249, 252, 0.15); border-radius: 8px;">
						${__script__.changelog.HTML || "<p style='text-align: center; opacity: 0.6;'>No changelog is available.</p>"}
					</div>
				</div>
			`;

			// Add hover effects to links
			const links = this.contentContainer.querySelectorAll('a');
			links.forEach(link => {
				if (link.style.padding) { // Only for buttons
					link.addEventListener('mouseenter', () => {
						link.style.transform = 'translateY(-2px)';
						link.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
					});
					link.addEventListener('mouseleave', () => {
						link.style.transform = 'translateY(0)';
						link.style.boxShadow = 'none';
					});
				}
			});
		}

		/**
		 * Validate and merge imported settings with current settings
		 * @param {Object} importedSettings The imported settings object
		 * @returns {Object} Result object with success status, merged settings, warnings, and applied count
		 */
		validateAndMergeSettings(importedSettings) {
			const result = {
				success: false,
				settings: JSON.parse(JSON.stringify(wikishield.options)), // Start with current settings
				warnings: [],
				appliedCount: 0,
				error: null
			};

			if (!importedSettings || typeof importedSettings !== 'object') {
				result.error = 'Invalid settings format';
				return result;
			}

			const defaults = wikishieldData.defaultSettings;
			const soundKeys = Object.keys(wikishieldData.sounds);
			const namespaceIds = wikishieldData.namespaces.map(ns => ns.id);
			const expiryOptions = ["none", "1 hour", "1 day", "1 week", "1 month", "3 months", "6 months", "indefinite"];

			// Validate and apply each setting
			for (const [key, value] of Object.entries(importedSettings)) {
				// Skip if key doesn't exist in defaults (unknown setting)
				if (!(key in defaults)) {
					result.warnings.push(`${key}: Unknown setting, ignored`);
					continue;
				}

				try {
					switch (key) {
						case 'maxQueueSize':
						case 'maxEditCount':
							if (typeof value === 'number' && value >= 1 && value <= 500) {
								result.settings[key] = Math.floor(value);
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be 1-500`);
							}
							break;

						case 'minimumORESScore':
						case 'soundAlertORESScore':
						case 'masterVolume':
							if (typeof value === 'number' && value >= 0 && value <= 1) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be 0-1`);
							}
							break;

						case 'enableSoundAlerts':
                        case 'enableUsernameHighlighting':
                        case 'enableLatinWelcome':
						case 'enableAutoWelcome':
						case 'enableEditAnalysis':
						case 'enableUsernameAnalysis':
						case 'showTemps':
						case 'showUsers':
						case 'sortQueueItems':
						case 'enableOllamaAI':
							if (typeof value === 'boolean') {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be boolean`);
							}
							break;

						case 'volumes':
							if (typeof value === 'object' && value !== null) {
								let volumeCount = 0;
								for (const [volumeKey, volumeValue] of Object.entries(value)) {
									if (typeof volumeValue === 'number' && volumeValue >= 0 && volumeValue <= 1) {
										if (!result.settings.volumes) result.settings.volumes = {};
										result.settings.volumes[volumeKey] = volumeValue;
										volumeCount++;
									} else {
										result.warnings.push(`volumes.${volumeKey}: Invalid value (${volumeValue}), must be 0-1`);
									}
								}
								if (volumeCount > 0) result.appliedCount++;
							} else {
								result.warnings.push(`volumes: Invalid format, must be object`);
							}
							break;

						case 'soundMappings':
							if (typeof value === 'object' && value !== null) {
								let mappingCount = 0;
								for (const [triggerKey, soundKey] of Object.entries(value)) {
									if (soundKeys.includes(soundKey)) {
										if (!result.settings.soundMappings) result.settings.soundMappings = {};
										result.settings.soundMappings[triggerKey] = soundKey;
										mappingCount++;
									} else {
										result.warnings.push(`soundMappings.${triggerKey}: Invalid sound (${soundKey})`);
									}
								}
								if (mappingCount > 0) result.appliedCount++;
							} else {
								result.warnings.push(`soundMappings: Invalid format, must be object`);
							}
							break;

						case 'watchlistExpiry':
						case 'highlightedExpiry':
							if (typeof value === 'string' && expiryOptions.includes(value)) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be one of: ${expiryOptions.join(', ')}`);
							}
							break;

						case 'wiki':
							if (typeof value === 'string' && value.length >= 2 && value.length <= 20) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be 2-20 characters`);
							}
							break;

						case 'namespacesShown':
							if (Array.isArray(value)) {
								const validNamespaces = value.filter(id => namespaceIds.includes(id));
								if (validNamespaces.length > 0) {
									result.settings[key] = validNamespaces;
									result.appliedCount++;
									if (validNamespaces.length < value.length) {
										result.warnings.push(`namespacesShown: Some invalid namespace IDs were excluded`);
									}
								} else {
									result.warnings.push(`namespacesShown: No valid namespace IDs found`);
								}
							} else {
								result.warnings.push(`namespacesShown: Invalid format, must be array`);
							}
							break;

						case 'ollamaServerUrl':
							if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid URL format`);
							}
							break;

						case 'ollamaModel':
							if (typeof value === 'string') {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value, must be string`);
							}
							break;

						case 'controlScripts':
							if (Array.isArray(value)) {
								// Basic validation for control scripts structure
								const validScripts = value.filter(script => {
									return script &&
										Array.isArray(script.keys) &&
										Array.isArray(script.actions) &&
										script.keys.length > 0;
								});
								if (validScripts.length > 0) {
									result.settings[key] = validScripts;
									result.appliedCount++;
									if (validScripts.length < value.length) {
										result.warnings.push(`controlScripts: Some invalid scripts were excluded`);
									}
								} else {
									result.warnings.push(`controlScripts: No valid control scripts found`);
								}
							} else {
								result.warnings.push(`controlScripts: Invalid format, must be array`);
							}
							break;

						case 'selectedPalette':
							if (typeof value === 'number' && value >= 0 && value < wikishieldData.colorPalettes.length) {
								result.settings[key] = Math.floor(value);
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be 0-${wikishieldData.colorPalettes.length - 1}`);
							}
							break;

						case 'theme':
							const validThemes = ['theme-light', 'theme-dark'];
							if (typeof value === 'string' && validThemes.includes(value)) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be 'theme-light' or 'theme-dark'`);
							}
							break;

						default:
							// For any other setting in defaults that we haven't explicitly handled,
							// just copy it if the type matches
							if (typeof value === typeof defaults[key]) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Type mismatch, expected ${typeof defaults[key]}, got ${typeof value}`);
							}
							break;
					}
				} catch (error) {
					result.warnings.push(`${key}: Error validating - ${error.message}`);
				}
			}

			result.success = result.appliedCount > 0;
			if (!result.success && result.warnings.length === 0) {
				result.error = 'No valid settings found in import';
			}

			return result;
		}		/**
		 * Open import/export settings section
		 */
		openImportExport() {
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Import/Export Settings</div>
					<div class="settings-section-desc">
						Import, export, or reset your WikiShield settings. Settings are encoded as a base64 string for easy sharing.
					</div>
					<div style="display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap;">
						<button id="export-settings-btn" class="add-action-button" style="flex: 1; min-width: 120px;">
							<span class="fa fa-download"></span> Export Settings
						</button>
						<button id="import-settings-btn" class="add-action-button" style="flex: 1; min-width: 120px;">
							<span class="fa fa-upload"></span> Import Settings
						</button>
						<button id="reset-settings-btn" class="add-action-button" style="flex: 1; min-width: 120px; background: #dc3545;">
							<span class="fa fa-undo"></span> Reset to Default
						</button>
					</div>
					<div id="import-export-status" style="margin-top: 12px; padding: 12px; border-radius: 6px; display: none;"></div>
					<textarea id="import-settings-input"
						placeholder="Paste base64 settings string here..."
						style="
							width: 100%;
							min-height: 100px;
							margin-top: 12px;
							padding: 12px;
							border: 2px solid rgba(128, 128, 128, 0.3);
							border-radius: 6px;
							font-family: 'Courier New', monospace;
							font-size: 0.85em;
							background: rgba(0, 0, 0, 0.2);
							color: inherit;
							display: none;
						"></textarea>
				</div>
			`;

			// Import/Export handlers
			const exportBtn = this.contentContainer.querySelector('#export-settings-btn');
			const importBtn = this.contentContainer.querySelector('#import-settings-btn');
			const resetBtn = this.contentContainer.querySelector('#reset-settings-btn');
			const statusDiv = this.contentContainer.querySelector('#import-export-status');
			const importInput = this.contentContainer.querySelector('#import-settings-input');

			exportBtn.addEventListener('click', () => {
				try {
					const settingsJson = JSON.stringify(wikishield.options);
					const base64String = btoa(settingsJson);

					// Create a temporary textarea to copy to clipboard
					const tempTextarea = document.createElement('textarea');
					tempTextarea.value = base64String;
					document.body.appendChild(tempTextarea);
					tempTextarea.select();
					document.execCommand('copy');
					document.body.removeChild(tempTextarea);

					statusDiv.style.display = 'block';
					statusDiv.style.background = 'rgba(40, 167, 69, 0.2)';
					statusDiv.style.border = '2px solid #28a745';
					statusDiv.style.color = '#28a745';
					statusDiv.innerHTML = `
						<div style="display: flex; align-items: center; gap: 8px;">
							<span class="fa fa-check-circle"></span>
							<div>
								<strong>Settings exported successfully!</strong>
								<div style="font-size: 0.9em; margin-top: 4px;">The base64 string has been copied to your clipboard.</div>
							</div>
						</div>
					`;

					setTimeout(() => {
						statusDiv.style.display = 'none';
					}, 5000);
				} catch (error) {
					statusDiv.style.display = 'block';
					statusDiv.style.background = 'rgba(220, 53, 69, 0.2)';
					statusDiv.style.border = '2px solid #dc3545';
					statusDiv.style.color = '#dc3545';
					statusDiv.innerHTML = `
						<div style="display: flex; align-items: center; gap: 8px;">
							<span class="fa fa-times-circle"></span>
							<div>
								<strong>Export failed!</strong>
								<div style="font-size: 0.9em; margin-top: 4px;">${error.message}</div>
							</div>
						</div>
					`;
				}
			});

			importBtn.addEventListener('click', () => {
				if (importInput.style.display === 'none') {
					importInput.style.display = 'block';
					importBtn.innerHTML = '<span class="fa fa-check"></span> Apply Import';
					importBtn.style.background = '#28a745';
					statusDiv.style.display = 'none';
				} else {
					const base64String = importInput.value.trim();
					if (!base64String) {
						statusDiv.style.display = 'block';
						statusDiv.style.background = 'rgba(220, 53, 69, 0.2)';
						statusDiv.style.border = '2px solid #dc3545';
						statusDiv.style.color = '#dc3545';
						statusDiv.innerHTML = `
							<div style="display: flex; align-items: center; gap: 8px;">
								<span class="fa fa-exclamation-circle"></span>
								<div>
									<strong>No input!</strong>
									<div style="font-size: 0.9em; margin-top: 4px;">Please paste a base64 settings string.</div>
								</div>
							</div>
						`;
						return;
					}

					try {
						const settingsJson = atob(base64String);
						const importedSettings = JSON.parse(settingsJson);

						// Validate and merge settings
						const validationResult = this.validateAndMergeSettings(importedSettings);

						if (validationResult.success) {
							wikishield.options = validationResult.settings;
							wikishield.saveOptions(wikishield.options);

							statusDiv.style.display = 'block';
							statusDiv.style.background = 'rgba(40, 167, 69, 0.2)';
							statusDiv.style.border = '2px solid #28a745';
							statusDiv.style.color = '#28a745';

							let warningsHtml = '';
							if (validationResult.warnings.length > 0) {
								warningsHtml = `
									<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(40, 167, 69, 0.3);">
										<strong>Warnings:</strong>
										<ul style="margin: 4px 0 0 20px; font-size: 0.9em;">
											${validationResult.warnings.map(w => `<li>${w}</li>`).join('')}
										</ul>
									</div>
								`;
							}

							statusDiv.innerHTML = `
								<div style="display: flex; align-items: start; gap: 8px;">
									<span class="fa fa-check-circle" style="margin-top: 2px;"></span>
									<div style="flex: 1;">
										<strong>Settings imported successfully!</strong>
										<div style="font-size: 0.9em; margin-top: 4px;">
											${validationResult.appliedCount} setting(s) applied.
										</div>
										${warningsHtml}
									</div>
								</div>
							`;
						} else {
							throw new Error(validationResult.error);
						}
					} catch (error) {
						statusDiv.style.display = 'block';
						statusDiv.style.background = 'rgba(220, 53, 69, 0.2)';
						statusDiv.style.border = '2px solid #dc3545';
						statusDiv.style.color = '#dc3545';
						statusDiv.innerHTML = `
							<div style="display: flex; align-items: center; gap: 8px;">
								<span class="fa fa-times-circle"></span>
								<div>
									<strong>Import failed!</strong>
									<div style="font-size: 0.9em; margin-top: 4px;">${error.message}</div>
								</div>
							</div>
						`;
					}

					importInput.style.display = 'none';
					importInput.value = '';
					importBtn.innerHTML = '<span class="fa fa-upload"></span> Import Settings';
					importBtn.style.background = '';
				}
			});

			resetBtn.addEventListener('click', () => {
				if (confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
					wikishield.options = JSON.parse(JSON.stringify(wikishieldData.defaultSettings));
					wikishield.saveOptions(wikishield.options);

					statusDiv.style.display = 'block';
					statusDiv.style.background = 'rgba(255, 193, 7, 0.2)';
					statusDiv.style.border = '2px solid #ffc107';
					statusDiv.style.color = '#ffc107';
					statusDiv.innerHTML = `
						<div style="display: flex; align-items: center; gap: 8px;">
							<span class="fa fa-info-circle"></span>
							<div>
								<strong>Settings reset to default!</strong>
								<div style="font-size: 0.9em; margin-top: 4px;">Settings have been reset.</div>
							</div>
						</div>
					`;
				}
			});
		}

		/**
		 * Remove all existing settings containers
		 */
		closeSettings() {
			this.isOpen = false;
			document.body.classList.remove("settings-open"); // Remove blur class
			[...document.querySelectorAll(".settings-container")].forEach(elem => elem.remove());
		}

		/**
		 * Handle a keypress while settings are open
		 * @param {KeyboardEvent} event
		 */
		handleKeypress(event) {
			if (event.key.toLowerCase() === "escape") {
				this.closeSettings();
				return;
			}

			if (this.keypressCallback && wikishieldSettingsAllowedKeys.includes(event.key.toLowerCase())) {
				this.keypressCallback(event.key.toLowerCase());
				event.preventDefault();
			}
		}
	}

	class WikiShieldInterface {
		constructor() {
			this.selectedWidthAdjust = null;
			this.startingSectionWidth = null;
			this.startingMouseX = null;
			this.lastCurrentEdit = null;
			this.newerRevisionInterval = null; // For periodic newer revision checking

			this.eventManager = new WikiShieldEventManager();
			this.settings = new WikiShieldSettingsInterface();
			this.selectedMenu = null;
			this.selectedSubmenu = null;
		}

		/**
		 * Create a stylesheet with the given theme's style
		 * @param {String} name
		 */
		loadTheme(name) {
			this.removeTheme();

			// Apply base styles first
			const baseStyle = document.createElement("style");
			baseStyle.classList.add("wikishield-theme-base");
			baseStyle.innerHTML = wikishieldStyling.base;
			document.head.appendChild(baseStyle);

			// Always apply dark theme
			const style = document.createElement("style");
			style.classList.add("wikishield-theme");
			style.innerHTML = wikishieldStyling["theme-dark"];
			document.head.appendChild(style);

			// Set the data-theme attribute to dark
			document.documentElement.setAttribute("data-theme", "dark");

			// Add dark-mode class to body
			document.body.classList.add("dark-mode");

			// Save the theme preference (always dark)
			wikishield.options.theme = "theme-dark";
			wikishield.saveOptions(wikishield.options);
		}

		/**
		 * Remove all theme stylesheets
		 */
		removeTheme() {
			document.querySelectorAll(".wikishield-theme, .wikishield-theme-base").forEach(elem => elem.remove());
			document.documentElement.removeAttribute("data-theme");
			document.body.classList.remove("dark-mode");
		}

		/**
		 * Open a Wikipedia page in a floating iframe
		 * @param {String} url The URL to open
		 * @param {String} title The title to display in the header
		 */
		openFloatingIframe(url, title) {
			// Remove any existing iframe overlay
			this.closeFloatingIframe();

			// Create overlay
			const overlay = document.createElement("div");
			overlay.classList.add("wiki-iframe-overlay");
			overlay.id = "wiki-iframe-overlay";

			// Create container
			const container = document.createElement("div");
			container.classList.add("wiki-iframe-container");

			// Create header
			const header = document.createElement("div");
			header.classList.add("wiki-iframe-header");

			const titleDiv = document.createElement("div");
			titleDiv.classList.add("wiki-iframe-title");
			titleDiv.innerHTML = `
				<span class="fa fa-book"></span>
				<span class="wiki-iframe-title-text">${this.escapeHTML(title)}</span>
			`;

			const controls = document.createElement("div");
			controls.classList.add("wiki-iframe-controls");

			const openNewTabBtn = document.createElement("button");
			openNewTabBtn.classList.add("wiki-iframe-btn");
			openNewTabBtn.innerHTML = `<span class="fa fa-external-link-alt"></span> Open in New Tab`;
			openNewTabBtn.addEventListener("click", () => {
				window.open(url, "_blank");
			});

			const closeBtn = document.createElement("button");
			closeBtn.classList.add("wiki-iframe-btn", "close-btn");
			closeBtn.innerHTML = `<span class="fa fa-times"></span> Close`;
			closeBtn.addEventListener("click", () => {
				this.closeFloatingIframe();
			});

			controls.appendChild(openNewTabBtn);
			controls.appendChild(closeBtn);

			header.appendChild(titleDiv);
			header.appendChild(controls);

			// Create content area with loading indicator
			const content = document.createElement("div");
			content.classList.add("wiki-iframe-content");

			const loading = document.createElement("div");
			loading.classList.add("wiki-iframe-loading");
			loading.innerHTML = `
				<div class="wiki-iframe-spinner"></div>
				<span>Loading Wikipedia page...</span>
			`;

			content.appendChild(loading);

			// Create iframe
			const iframe = document.createElement("iframe");
			iframe.src = url;
			iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox");

			// Track if iframe loaded successfully
			let iframeLoaded = false;

			// Remove loading indicator when iframe loads successfully
			iframe.addEventListener("load", () => {
				iframeLoaded = true;
				loading.remove();
			});

			// Handle iframe load errors
			iframe.addEventListener("error", () => {
				loading.innerHTML = `
					<span class="fa fa-exclamation-triangle" style="color: var(--danger); font-size: 2rem;"></span>
					<span>This page cannot be displayed in a frame. <a href="${url}" target="_blank" style="color: var(--primary); text-decoration: underline;">Open in new tab instead</a></span>
				`;
			});

			// Detect X-Frame-Options blocking (iframe doesn't fire error for this)
			// If iframe hasn't loaded after 3 seconds, assume it's blocked
			setTimeout(() => {
				if (!iframeLoaded) {
					// Wikipedia likely blocked the iframe due to X-Frame-Options
					this.closeFloatingIframe();
					window.open(url, "_blank");

					// Show a toast notification explaining what happened
					this.showToast("Wikipedia doesn't allow embedding. Opening in a new tab instead.", "info");
				}
			}, 3000);

			content.appendChild(iframe);

			// Assemble the modal
			container.appendChild(header);
			container.appendChild(content);
			overlay.appendChild(container);

			// Close on overlay click (but not container click)
			overlay.addEventListener("click", (e) => {
				if (e.target === overlay) {
					this.closeFloatingIframe();
				}
			});

			// Prevent clicks inside container from closing
			container.addEventListener("click", (e) => {
				e.stopPropagation();
			});

			// Close on Escape key
			const escapeHandler = (e) => {
				if (e.key === "Escape") {
					this.closeFloatingIframe();
				}
			};
			document.addEventListener("keydown", escapeHandler);
			overlay.dataset.escapeHandler = "true";

			// Add to document
			document.body.appendChild(overlay);
		}	/**
		* Close the floating iframe if it exists
		*/
		closeFloatingIframe() {
			const overlay = document.getElementById("wiki-iframe-overlay");
			if (overlay) {
				// Remove escape key handler
				if (overlay.dataset.escapeHandler) {
					document.removeEventListener("keydown", this.closeFloatingIframe);
				}
				overlay.remove();
			}
		}

		/**
		 * Escape HTML to prevent XSS
		 * @param {String} text
		 * @returns {String}
		 */
		escapeHTML(text) {
			const div = document.createElement("div");
			div.textContent = text;
			return div.innerHTML;
		}

		/**
		 * Build the starting page
		 */
	async build() {
		document.head.innerHTML = `
			<title>WikiShield</title>
			<style>${wikishieldStyling.initial}</style>
		`;

		document.body.innerHTML = wikishieldHTML.initial(__script__.version);

		// Initialize animated dots background
			const canvas = document.getElementById('dots-canvas');
			const ctx = canvas.getContext('2d');
			let dots = [];
			let animationFrame;

			// Set canvas size
			const resizeCanvas = () => {
				canvas.width = window.innerWidth;
				canvas.height = window.innerHeight;
			};
			resizeCanvas();
			window.addEventListener('resize', resizeCanvas);

			// Create dots
			class Dot {
				constructor() {
					this.x = Math.random() * canvas.width;
					this.y = Math.random() * canvas.height;
					this.vx = (Math.random() - 0.5) * 0.5;
					this.vy = (Math.random() - 0.5) * 0.5;
					this.radius = 2;
					// Random neon color
					const colors = [
						'102, 126, 234',  // Blue
						'240, 147, 251',  // Pink
						'118, 75, 162',   // Purple
						'217, 70, 239'    // Magenta
					];
					this.color = colors[Math.floor(Math.random() * colors.length)];
				}

				update() {
					this.x += this.vx;
					this.y += this.vy;

					// Wrap around edges
					if (this.x < 0) this.x = canvas.width;
					if (this.x > canvas.width) this.x = 0;
					if (this.y < 0) this.y = canvas.height;
					if (this.y > canvas.height) this.y = 0;
				}

				draw() {
					ctx.beginPath();
					ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(${this.color}, 0.8)`;
					ctx.shadowBlur = 10;
					ctx.shadowColor = `rgba(${this.color}, 0.8)`;
					ctx.fill();
					ctx.shadowBlur = 0;
				}
			}

			// Initialize dots (one per 5000 pixels)
			const numDots = Math.floor((canvas.width * canvas.height) / 5000);
			for (let i = 0; i < numDots; i++) {
				dots.push(new Dot());
			}

			// Animation loop
			const animate = () => {
				ctx.clearRect(0, 0, canvas.width, canvas.height);

				// Update and draw dots
				dots.forEach(dot => {
					dot.update();
					dot.draw();
				});

				// Draw lines between close dots
				const length = dots.length;
				for (let i = 0; i < length; i++) {
					for (let j = i + 1; j < length; j++) {
						const dx = dots[i].x - dots[j].x;
						const dy = dots[i].y - dots[j].y;
						const distance = Math.sqrt(dx * dx + dy * dy);

						if (distance < 150) {
							ctx.beginPath();
							ctx.moveTo(dots[i].x, dots[i].y);
							ctx.lineTo(dots[j].x, dots[j].y);
							const opacity = (1 - distance / 150) * 0.4;
							// Blend colors between dots
							const avgR = (parseInt(dots[i].color.split(',')[0]) + parseInt(dots[j].color.split(',')[0])) / 2;
							const avgG = (parseInt(dots[i].color.split(',')[1]) + parseInt(dots[j].color.split(',')[1])) / 2;
							const avgB = (parseInt(dots[i].color.split(',')[2]) + parseInt(dots[j].color.split(',')[2])) / 2;
							ctx.strokeStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${opacity})`;
							ctx.lineWidth = 1;
							ctx.stroke();
						}
					}
				}

				animationFrame = requestAnimationFrame(animate);
			};

			animate();

			// Sound design - create audio context for sound effects
			let audioContext = null;
			wikishield.soundEnabled = true; // Make sound state globally accessible

			// Function to play a synth tone
			const playSynthTone = (frequency, duration, volume = 0.15, type = 'sine') => {
				if (!wikishield.soundEnabled || !audioContext) return;

				const oscillator = audioContext.createOscillator();
				const gainNode = audioContext.createGain();

				oscillator.connect(gainNode);
				gainNode.connect(audioContext.destination);

				oscillator.frequency.value = frequency;
				oscillator.type = type;

				gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
				gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

				oscillator.start(audioContext.currentTime);
				oscillator.stop(audioContext.currentTime + duration);
			};

			// Play startup sound sequence
			const playStartupSound = () => {
				if (!audioContext) {
					try {
						const construct = window.AudioContext || window.webkitAudioContext;
						audioContext = new construct();
					} catch (e) {
						return;
					}
				}

				// Epic startup sequence
				playSynthTone(523.25, 0.15, 0.12, 'sine'); // C5
				setTimeout(() => playSynthTone(659.25, 0.15, 0.12, 'sine'), 150); // E5
				setTimeout(() => playSynthTone(783.99, 0.15, 0.12, 'sine'), 300); // G5
				setTimeout(() => playSynthTone(1046.50, 0.4, 0.15, 'sine'), 450); // C6
			};

			// Play hover sound
			const playHoverSound = () => {
				playSynthTone(800, 0.05, 0.08, 'sine');
			};

			// Play click sound
			const playClickSound = () => {
				playSynthTone(1200, 0.1, 0.1, 'square');
				setTimeout(() => playSynthTone(1000, 0.08, 0.08, 'square'), 50);
			};

			// Initialize audio on first user interaction
			const initAudio = () => {
				if (!audioContext) {
					try {
						const construct = window.AudioContext || window.webkitAudioContext;
						audioContext = new construct();
						playStartupSound();
					} catch (e) {
						// Audio not supported - silently fail
					}
				}
			};

			// Sound toggle button
			const soundToggle = this.elem("#sound-toggle");
			soundToggle.addEventListener("click", () => {
				wikishield.soundEnabled = !wikishield.soundEnabled;
				soundToggle.classList.toggle("muted");

				if (wikishield.soundEnabled) {
					initAudio();
					playClickSound();
				}
			});

			// Add sound effects to buttons and links
			const addSoundToElement = (selector, soundType) => {
				const elem = this.elem(selector);
				if (elem) {
					if (soundType === 'hover') {
						elem.addEventListener("mouseenter", playHoverSound);
					} else if (soundType === 'click') {
						elem.addEventListener("click", () => {
							initAudio();
							playClickSound();
						});
					}
				}
			};

			// Add sounds to interactive elements
			addSoundToElement("#start-button", "hover");
			addSoundToElement("#start-button", "click");

			document.querySelectorAll(".about-link").forEach(link => {
				link.addEventListener("mouseenter", playHoverSound);
				link.addEventListener("click", () => {
					initAudio();
					playClickSound();
				});
			});

			// Play startup sound after a short delay
			setTimeout(() => {
				initAudio();
			}, 500);

			if (wikishield.rights.rollback) {
				this.elem("#rollback-needed").style.display = "none";
			} else {
				this.elem("#start-button").style.display = "none";
			}

			this.elem("#start-button").addEventListener("click", () => {
				// Stop the dots animation
				if (animationFrame) {
					cancelAnimationFrame(animationFrame);
				}
				wikishield.start();
			});

			this.loadTheme("theme-dark");
		}

		/**
		 * Build the main interface, and link buttons to events
		 */
		start() {
			document.head.innerHTML = `
				<title>WikiShield</title>
				<style>${wikishieldStyling.main}</style>
				${wikishieldHTML.head}
			`;

			this.loadTheme("theme-dark");

			document.body.innerHTML = wikishieldHTML.main;

			// Modern bottom menu system
			[...document.querySelectorAll(".bottom-tool-trigger")].forEach(trigger => {
				trigger.addEventListener("click", (e) => {
					e.stopPropagation();
					const item = trigger.closest(".bottom-tool-item");
					const menu = document.querySelector(`#${item.dataset.menu}-menu`);
					const isOpen = menu.classList.contains("show");

					switch (item.dataset.menu) {
						case "revert": {
							menu.innerHTML = "";
							this.createRevertMenu(menu, wikishield.queue.currentEdit);
						} break;
						case "warn": {
							menu.innerHTML = "";
							this.createWarnMenu(menu, wikishield.queue.currentEdit);
						} break;
					}

					// Close all menus
					this.closeAllBottomMenus();

					// Toggle this menu
					if (!isOpen) {
						menu.classList.add("show");
						trigger.classList.add("active");

						// Position menu based on available space
						this.positionBottomMenu(item, menu);
					}
				});
			});

			// Submenu triggers
			[...document.querySelectorAll(".submenu-trigger")].forEach(trigger => {
				trigger.addEventListener("mouseenter", () => {
					// Close other submenus
					const parentMenu = trigger.closest(".bottom-tool-menu");
					if (parentMenu) {
						parentMenu.querySelectorAll(".submenu").forEach(s => s.classList.remove("show"));
					}

					// Show this submenu
					const submenu = trigger.querySelector(".submenu");
					if (submenu) {
						submenu.classList.add("show");
						this.positionSubmenu(submenu, trigger);
					}
				});
			});

			// Menu options that close on click
			[...document.querySelectorAll(".menu-option:not(.submenu-trigger)")].forEach(option => {
				option.addEventListener("click", () => {
					this.closeAllBottomMenus();
				});
			});

			// Prevent submenu clicks from closing menu
			[...document.querySelectorAll(".submenu")].forEach(submenu => {
				submenu.addEventListener("click", (e) => e.stopPropagation());
			});

			[
				this.elem("#delete-queue"),
				this.elem("#open-settings"),
				this.elem("#notifications-icon"),
				this.elem("#user-contribs-level")
			].forEach(e => this.addTooltipListener(e));

			// Notification icon click handler
			this.elem("#notifications-icon").addEventListener("click", (e) => {
				e.stopPropagation();
				const panel = this.elem("#notifications-panel");
				panel.classList.toggle("show");
			});

			// Mark all as read handler
			this.elem("#mark-all-read").addEventListener("click", () => {
				wikishield.markAllNotificationsRead();
			});

			// Close notifications panel when clicking outside
			document.addEventListener("click", (e) => {
				const panel = this.elem("#notifications-panel");
				const icon = this.elem("#notifications-icon");
				if (panel && !panel.contains(e.target) && !icon.contains(e.target)) {
					panel.classList.remove("show");
				}

				if (!e.target.closest(".bottom-tool-menu")) {
					this.closeAllBottomMenus();
				}
			});

			this.eventManager.linkButton(
				this.elem("#delete-queue"),
				"deleteQueue", true
			);

			this.eventManager.linkButton(
				this.elem("#open-settings"),
				"openSettings", true
			);

			this.eventManager.linkButton(
				this.elem("#user-open-user-page"),
				"openUserPage"
			);

			this.eventManager.linkButton(
				this.elem("#user-open-user-talk"),
				"openUserTalk"
			);

			this.eventManager.linkButton(
				this.elem("#user-view-contribs"),
				"openUserContribs"
			);

			this.eventManager.linkButton(
				this.elem("#user-view-filter-log"),
				"openFilterLog"
			);

			this.eventManager.linkButton(
				this.elem("#user-add-whitelist"),
				"addToWhitelist"
			);

			this.eventManager.linkButton(
				this.elem("#user-highlight"),
				"highlight"
			);

			this.eventManager.linkButton(
				this.elem("#page-open-page"),
				"openPage"
			);

			this.eventManager.linkButton(
				this.elem("#page-open-talk"),
				"openTalk"
			);

			this.eventManager.linkButton(
				this.elem("#page-view-history"),
				"openHistory"
			);

			this.eventManager.linkButton(
				this.elem("#edit-view-revision"),
				"openRevision"
			);

			this.eventManager.linkButton(
				this.elem("#edit-view-diff"),
				"openDiff"
			);

			this.eventManager.linkButton(
				this.elem("#edit-thank-user"),
				"thankUser"
			);

			this.eventManager.linkButton(
				this.elem("#edit-rollback"),
				"rollback"
			);

			this.createSubmenu(
				this.elem("#edit-rollback-goodfaith .submenu"),
				"rollbackGoodFaith"
			);

			this.createSubmenu(
				this.elem("#edit-undo .submenu"),
				"undo"
			);

			this.createSubmenu(
				this.elem("#user-report-aiv .submenu"),
				"reportToAIV"
			);

			this.createSubmenu(
				this.elem("#user-report-uaa .submenu"),
				"reportToUAA"
			);

			this.createSubmenu(
				this.elem("#page-request-protection .submenu"),
				"requestProtection"
			);

			this.createSubmenu(
				this.elem("#user-welcome .submenu"),
				"welcome"
			);

			if (!wikishield.rights.block) {
				[...document.querySelectorAll(".tool-block")].forEach(elem => elem.style.display = "none");
			}

			if (!wikishield.rights.protect) {
				[...document.querySelectorAll(".tool-protect")].forEach(elem => elem.style.display = "none");
			}

			[...this.elem("#bottom-tools").querySelectorAll("[data-tooltip]")]
				.forEach(elem => this.addTooltipListener(elem));

			const queueWidthAdjust = this.elem("#queue-width-adjust");
			const queue = this.elem("#queue");

			const detailsWidthAdjust = this.elem("#details-width-adjust");
			const details = this.elem("#right-details");

			const savedQueueWidth = mw.storage.store.getItem("WikiShield:QueueWidth");
			const savedDetailsWidth = mw.storage.store.getItem("WikiShield:DetailsWidth");

			if (savedQueueWidth) {
				queue.style.width = savedQueueWidth;
				this.elem("#right-container").style.width = `calc(100% - ${savedQueueWidth})`;
			}

			if (savedDetailsWidth) {
				details.style.width = savedDetailsWidth;
				this.elem("#main-container").style.width = `calc(100% - ${savedDetailsWidth})`;
				this.elem("#middle-top").style.width = `calc(100% - ${savedDetailsWidth})`;
				this.elem("#right-top").style.width = savedDetailsWidth;
			}

			queueWidthAdjust.addEventListener("mousedown", (event) => {
				this.selectedWidthAdjust = queueWidthAdjust;
				this.startingMouseX = event.clientX;
				this.startingSectionWidth = queue.getBoundingClientRect().width;
			});

			detailsWidthAdjust.addEventListener("mousedown", (event) => {
				this.selectedWidthAdjust = detailsWidthAdjust;
				this.startingMouseX = event.clientX;
				this.startingSectionWidth = details.getBoundingClientRect().width;
			});

			window.addEventListener("mouseup", () => {
				if (this.selectedWidthAdjust === queueWidthAdjust) {
					mw.storage.store.setItem("WikiShield:QueueWidth", queue.style.width);
				}
				if (this.selectedWidthAdjust === detailsWidthAdjust) {
					mw.storage.store.setItem("WikiShield:DetailsWidth", details.style.width);
				}
				this.selectedWidthAdjust = null;
			});

			window.addEventListener("mousemove", (event) => {
				if (this.selectedWidthAdjust === queueWidthAdjust) {
					const newWidth = event.clientX - this.startingMouseX + this.startingSectionWidth;
					queue.style.width = `${Math.min(Math.max(newWidth / window.innerWidth * 100, 10), 30)}vw`;
					this.elem("#right-container").style.width = `calc(100% - ${queue.style.width})`;
				}

				if (this.selectedWidthAdjust === detailsWidthAdjust) {
					const newWidth = this.startingMouseX - event.clientX + this.startingSectionWidth;
					details.style.width = `${Math.min(Math.max(newWidth / window.innerWidth * 100, 10), 30)}vw`;
					this.elem("#main-container").style.width = `calc(100% - ${details.style.width})`;
					this.elem("#middle-top").style.width = `calc(100% - ${details.style.width})`;
					this.elem("#right-top").style.width = details.style.width;
				}
			});

			window.addEventListener("click", () => {
				[...document.querySelectorAll(".context-menu")].forEach(elem => elem.remove());
			});

			// Intercept Wikipedia links for floating iframe
			document.addEventListener("click", (e) => {
				// Check if the click was on a link or inside a link
				const link = e.target.closest("a[href][target='_blank']");

				if (!link) return;

				const url = link.getAttribute("href");

				// Only intercept Wikipedia links
				if (!url || !url.includes("wikipedia.org")) return;

				// Middle click (button 1) should open in new tab normally
				if (e.button === 1) return;

				// Ctrl/Cmd + click should open in new tab normally
				if (e.ctrlKey || e.metaKey) return;

				// Prevent default behavior and open in floating iframe
				e.preventDefault();
				e.stopPropagation();

				// Extract page title from URL for display
				let pageTitle = "Wikipedia";
				try {
					const urlObj = new URL(url);
					const pathParts = urlObj.pathname.split("/");
					if (pathParts.length > 2) {
						pageTitle = decodeURIComponent(pathParts[pathParts.length - 1]).replace(/_/g, " ");
					}
				} catch (err) {
					console.error("Failed to parse URL:", err);
				}

				// Open Wikipedia links in new tab
				window.open(url, "_blank");
			}, true); // Use capture phase to intercept before other handlers

			// Also handle auxclick for middle mouse button
			document.addEventListener("auxclick", (e) => {
				const link = e.target.closest("a[href][target='_blank']");
				if (!link) return;

				const url = link.getAttribute("href");
				if (!url || !url.includes("wikipedia.org")) return;

				// Middle click (button 1) - allow default behavior (open in new tab)
				if (e.button === 1) {
					// Default behavior will handle this
					return;
				}
			}, true);

			if (wikishield.getChangelogVersion() !== __script__.changelog.version) {
				const container = document.createElement("div");
				container.classList.add("settings-container");
				document.body.appendChild(container);

				container.innerHTML = `
					<div class="settings">
						<div class="settings-section changelog">
							${__script__.changelog.HTML}
							<button id="close-changelog" class="add-action-button">Close</button>
						</div>
					</div>
				`;

				document.getElementById("close-changelog").addEventListener("click", () => {
					container.remove();
					wikishield.updateChangelogVersion();
				});
			}
		}

		/**
		 * Update which menu elements are selected and open
		 */
		updateMenuElements() {
			// Legacy function kept for compatibility
			// Modern menu system uses closeAllBottomMenus()
		}

		/**
		 * Close all bottom menu popups
		 */
		closeAllMenus() {
			this.closeAllBottomMenus();
		}

		/**
		 * Close all bottom menus (modern system)
		 */
		closeAllBottomMenus() {
			document.querySelectorAll(".bottom-tool-menu").forEach(menu => menu.classList.remove("show"));
			document.querySelectorAll(".bottom-tool-trigger").forEach(trigger => trigger.classList.remove("active"));
			document.querySelectorAll(".submenu").forEach(submenu => submenu.classList.remove("show"));
		}

		/**
		 * Position bottom menu based on available space
		 * @param {HTMLElement} menu The menu to position
		 */
		positionBottomMenu(button, menu) {
			// Reset positioning
			menu.style.left = '';
			menu.style.right = '';
			menu.style.top = '';
			menu.style.bottom = '';

			const position = () => {
				if (!menu.classList.contains("show")) return;

				const menuRect = menu.getBoundingClientRect();
				const btnRect = button.getBoundingClientRect();
				const vw = window.innerWidth;
				const vh = window.innerHeight;

				// Horizontal alignment
				const fitsLeft = btnRect.left + menuRect.width <= vw;
				if (fitsLeft) {
					menu.style.left = `${btnRect.left}px`;
					menu.style.right = 'auto';
				} else {
					menu.style.right = `${vw - btnRect.right}px`;
					menu.style.left = 'auto';
				}

				// Vertical alignment
				const fitsAbove = btnRect.top >= menuRect.height;
				if (fitsAbove) {
					// Align bottom of menu with top of button
					menu.style.bottom = `${vh - btnRect.top}px`;
					menu.style.top = 'auto';
				} else {
					// Align top of menu with bottom of button
					menu.style.top = `${btnRect.bottom}px`;
					menu.style.bottom = 'auto';
				}

				requestAnimationFrame(position);
			};

			requestAnimationFrame(position);
		}

		/**
		 * Position submenu based on available space
		 * @param {HTMLElement} submenu The submenu to position
		 * @param {HTMLElement} trigger The trigger element
		 */
		positionSubmenu(submenu, trigger) {
			// Reset positioning
			submenu.style.left = '';
			submenu.style.right = '';
			submenu.style.top = '';
			submenu.style.bottom = '';

			const position = () => {
				if (!submenu.classList.contains("show")) {
					return;
				}

				const submenuRect = submenu.getBoundingClientRect();
				const triggerRect = trigger.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				// Check horizontal space
				const spaceRight = viewportWidth - triggerRect.right;
				const spaceLeft = triggerRect.left;

				// Position to left if not enough space on right
				if (spaceRight < submenuRect.width + 20 && spaceLeft > spaceRight) {
					submenu.style.left = 'auto';
					submenu.style.right = 'calc(100% + 4px)';
				}

				// Check vertical space
				const spaceBelow = viewportHeight - triggerRect.bottom;
				const spaceAbove = triggerRect.top;

				// Adjust vertical position if menu goes off screen
				if (submenuRect.bottom > viewportHeight && spaceAbove > spaceBelow) {
					submenu.style.top = 'auto';
					submenu.style.bottom = '0';
				}

				requestAnimationFrame(() => position());
			};

			requestAnimationFrame(() => position());
		}

		/**
		 * Position submenu based on available space
		 * @param {HTMLElement} submenu The submenu to position
		 * @param {HTMLElement} trigger The trigger element
		 */
		positionLevelsMenu(button, menu) {
			// Reset previous positioning
			menu.style.left = '';
			menu.style.right = '';
			menu.style.top = '';
			menu.style.bottom = '';

			const position = () => {
				if (!menu.classList.contains("show")) return;

				const menuRect = menu.getBoundingClientRect();
				const btnRect = button.getBoundingClientRect();
				const vw = window.innerWidth;
				const vh = window.innerHeight;

				// Horizontal alignment
				const fitsRight = btnRect.right + menuRect.width <= vw;
				if (fitsRight) {
					// Align menu's left with button's right
					menu.style.left = `${btnRect.right + 8}px`;
					menu.style.right = 'auto';
				} else {
					// Align menu's right with button's left
					menu.style.right = `${vw - btnRect.left - 8}px`;
					menu.style.left = 'auto';
				}

				// Vertical alignment - centered
				let top = btnRect.top + (btnRect.height - menuRect.height) / 2;
				// Prevent menu from going off the top
				if (top < 0) top = 0;
				// Prevent menu from going off the bottom
				if (top + menuRect.height > vh) top = vh - menuRect.height;

				menu.style.top = `${top}px`;
				menu.style.bottom = 'auto';

				requestAnimationFrame(position);
			};

			requestAnimationFrame(position);
		}

		/**
		 * Create the menu for warning types
		 * @param {HTMLElement} container
		 */
		createRevertMenu(container, currentEdit) {
			document.querySelectorAll(".levels-menu").forEach(menu => menu.remove());

			const menu = document.createElement("div");
			menu.className = "warning-menu";
			container.appendChild(menu);

			menu.addEventListener("click", (e) => {
				document.body.querySelectorAll(".levels-menu.show").forEach(menu => menu.classList.remove("show"));
			});

			const execute = async (warningType, level) => {
				await wikishield.executeScript({
					actions: [
						{
							name: "rollbackAndWarn",
							params: {
								warningType,
								level,
							}
						},
						{
							name: "highlight",
							params: {}
						},
						{
							name: "if",
							condition: "atFinalWarning",
							actions: [
								{
									name: "if",
									condition: "operatorNonAdmin",
									actions: [
										{
											name: "reportToAIV",
											params: {
												reportMessage: "Vandalism past final warning"
											}
										}
									]
								}
							]
						},
						{
							name: "nextEdit",
							params: {}
						}
					]
				});

				this.selectedMenu = null;
				this.updateMenuElements();
			};

			for (const [ title, category ] of Object.entries(warnings.revert)) {
				const section = document.createElement("div");
				section.className = "warning-menu-section";

				const header = document.createElement("h2");
				header.textContent = title;
				section.appendChild(header);

				const divider = document.createElement("div");
				divider.className = "menu-divider";
				section.appendChild(divider);

				for (const warning of category) {
					if (typeof warning.show === "function" && !warning.show(currentEdit)) {
						continue;
					}

					const item = document.createElement("div");
					item.className = "warning-menu-item";

					const mouseIcon = document.createElement("span");
					mouseIcon.className = "fas fa-mouse-pointer";
					item.appendChild(mouseIcon);

					const label = document.createElement("span");
					label.className = "warning-menu-title";
					label.textContent = warning.title;
					item.appendChild(label);

					const helpIcon = document.createElement("span");
					helpIcon.className = "fas fa-circle-question";
					helpIcon.dataset.tooltip = warning.description;
					item.appendChild(helpIcon);
					this.addTooltipListener(helpIcon);

					const levelsButton = document.createElement("span");
					levelsButton.className = "warning-menu-button warning-menu-levels-button";
					levelsButton.textContent = "advanced";
					item.appendChild(levelsButton);

					const levelsMenu = document.createElement("div");
					levelsMenu.className = "levels-menu bottom-tool-menu";

					for (const [ templateLabel, template ] of Object.entries(warning.templates || { })) {
						if (template === null || template.exists === false) continue;

						const levelButton = document.createElement("span");
						levelButton.className = "levels-menu-item";
						levelButton.textContent = template.label || templateLabel;
						levelButton.style.backgroundColor = warningTemplateColors[templateLabel];
						levelsMenu.appendChild(levelButton);

						levelButton.addEventListener("click", async () => {
							await execute(warning.title, templateLabel);
						});
					}

					document.body.appendChild(levelsMenu);

					levelsButton.addEventListener("click", e => {
						e.stopPropagation();

						levelsMenu.classList.toggle("show");
						document.body.querySelectorAll(".levels-menu.show").forEach(menu => {
							if (menu !== levelsMenu) {
								menu.classList.remove("show");
							}
						});

						this.positionLevelsMenu(levelsButton, levelsMenu);
					});

					item.addEventListener("click", async e => {
						if (e.target.closest(".warning-menu-levels-button")) {
							return;
						}

						await execute(warning.title, "auto");
					});

					section.appendChild(item);
				}

				menu.appendChild(section);
			}
		}

		/**
		 * Create the warn menu (without rollback)
		 * @param {HTMLElement} container Container element for the menu
		 */
		createWarnMenu(container, currentEdit) {
			document.querySelectorAll(".levels-menu").forEach(menu => menu.remove());

			const menu = document.createElement("div");
			menu.className = "warning-menu";
			container.appendChild(menu);

			menu.addEventListener("click", (e) => {
				document.body.querySelectorAll(".levels-menu.show").forEach(menu => menu.classList.remove("show"));
			});

			const execute = async (warningType, level) => {
				await wikishield.executeScript({
					actions: [
						{
							name: "warn",
							params: {
								warningType,
								level,
							}
						},
						{
							name: "highlight",
							params: {}
						},
						{
							name: "nextEdit",
							params: {}
						}
					]
				});

				this.selectedMenu = null;
				this.updateMenuElements();
			};

			for (const [ title, category ] of Object.entries(warnings.warn)) {
				const section = document.createElement("div");
				section.className = "warning-menu-section";

				const header = document.createElement("h2");
				header.textContent = title;
				section.appendChild(header);

				const divider = document.createElement("div");
				divider.className = "menu-divider";
				section.appendChild(divider);

				for (const warning of category) {
					if (typeof warning.show === "function" && !warning.show(currentEdit)) {
						continue;
					}

					const item = document.createElement("div");
					item.className = "warning-menu-item";

					const label = document.createElement("span");
					label.className = "warning-menu-title";
					label.textContent = warning.title;
					item.appendChild(label);

					const helpIcon = document.createElement("span");
					helpIcon.className = "fas fa-circle-question";
					helpIcon.setAttribute("data-tooltip", warning.description);
					item.appendChild(helpIcon);
					this.addTooltipListener(helpIcon);

					const levelsButton = document.createElement("span");
					levelsButton.className = "warning-menu-button warning-menu-levels-button";
					levelsButton.textContent = "advanced";
					item.appendChild(levelsButton);

					const levelsMenu = document.createElement("div");
					levelsMenu.className = "levels-menu bottom-tool-menu";

					for (const [ templateLabel, template ] of Object.entries(warning.templates || { })) {
						if (template === null || template.exists === false) continue;

						const levelButton = document.createElement("span");
						levelButton.className = "levels-menu-item";
						levelButton.textContent = template.label || templateLabel;
						levelButton.style.backgroundColor = warningTemplateColors[templateLabel];
						levelsMenu.appendChild(levelButton);

						levelButton.addEventListener("click", async () => {
							await execute(warning.title, templateLabel);
						});
					}

					document.body.appendChild(levelsMenu);

					levelsButton.addEventListener("click", e => {
						e.stopPropagation();

						levelsMenu.classList.toggle("show");
						document.body.querySelectorAll(".levels-menu.show").forEach(menu => {
							if (menu !== levelsMenu) {
								menu.classList.remove("show");
							}
						});

						this.positionLevelsMenu(levelsButton, levelsMenu);
					});

					item.addEventListener("click", async e => {
						if (e.target.closest(".warning-menu-levels-button")) {
							return;
						}

						await execute(warning.title, "auto");
					});

					section.appendChild(item);
				}

				menu.appendChild(section);
			}
		}

		/**
		 * Create a form for a submenu based on an event
		 * @param {HTMLElement} container Container element for the submenu
		 * @param {String} eventName EventManager event name
		 */
		createSubmenu(container, eventName) {
			if (!container) return; // Safety check

			const event = this.eventManager.events[eventName];
			container.innerHTML = `
				<div class="bottom-subcontent-title">${event.description}</div>
			`;

			for (const param of (event.parameters || [])) {
				container.innerHTML += `<div class="bottom-subcontent-input-title">${param.title}</div>`;

				switch (param.type) {
					case "choice":
						const optionHTML = param.options.reduce((prev, cur) => prev + `<option>${cur}</option>`, "");
						container.innerHTML += `
							<select data-paramid="${param.id}">
								${optionHTML}
							</select>
						`;
						break;
					case "text":
						container.innerHTML += `<input type="text" data-paramid="${param.id}">`;
						break;
					default:
						break;
				}
			}

			const button = document.createElement("button");
			button.innerText = "Submit";
			button.classList.add("bottom-subcontent-button");
			container.appendChild(button);
			button.addEventListener("click", () => {
				const params = {};
				for (const param of (event.parameters || [])) {
					const input = container.querySelector(`[data-paramid="${param.id}"]`);
					params[param.id] = input.value;
				}
				wikishield.executeScript({
					actions: [
						{
							name: eventName,
							params
						}
					]
				});
				this.closeAllBottomMenus();
			});
		}

		/**
		 * Add edits to the queue if they aren't already there
		 * @param {Object} queue
		 * @param {Object} currentEdit
		 */
		renderQueue(queue, currentEdit) {
			const container = this.elem("#queue-items");
			this.elem("#queue-top-items").innerText = queue.length + " item" + (queue.length === 1 ? "" : "s");

			// Build a map of existing DOM elements
			const domMap = new Map();
			for (const el of container.children) {
				domMap.set(+el.dataset.revid, el);
			}

			let previous = null;
			for (const edit of queue) {
				let elem = domMap.get(edit.revid);

				// Create DOM element if it doesn't exist
				if (!elem) {
					elem = document.createElement("div");
					elem.classList.add("queue-edit");
					elem.dataset.revid = edit.revid.toString();
					elem.innerHTML = this.generateEditHTML(edit);

					if (edit.mentionsMe && wikishield.options.enableUsernameHighlighting) {
						elem.classList.add("queue-edit-mentions-me");
						elem.dataset.tooltip = "This edit contains your username";
						this.addTooltipListener(elem);
					}

					// --- Attach context menu ---
					elem.addEventListener("contextmenu", (event) => {
						event.preventDefault();
						wikishield.queue.playClickSound();

						// Remove existing menus
						[...document.querySelectorAll(".context-menu")].forEach(e => e.remove());

						const contextMenu = document.createElement("div");
						contextMenu.classList.add("context-menu");
						contextMenu.innerHTML = wikishieldHTML["edit-context-menu"];
						document.body.appendChild(contextMenu);

						contextMenu.style.left = event.clientX + "px";
						contextMenu.style.top = event.clientY + "px";

						contextMenu.querySelector("#context-ores-number").innerText = Math.round(edit.ores * 100) || 0;
						contextMenu.querySelector("#context-ores-number").style.color = this.getORESColor(edit.ores || 0);

						// whitelist button text
						const contextWhitelistBtn = contextMenu.querySelector("#context-whitelist");
						if (contextWhitelistBtn) {
							if (wikishield.whitelist.has(edit.user.name)) {
								contextWhitelistBtn.textContent = "Remove from whitelist";
							} else {
								contextWhitelistBtn.textContent = "Whitelist user";
							}
						}

						// Remove item
						contextMenu.querySelector("#context-remove").addEventListener("click", () => {
							wikishield.queue.playClickSound();
							if (wikishield.ollamaAI) {
								wikishield.ollamaAI.cancelAnalysis(edit.revid);
							}

							const currentIndex = queue.findIndex(e => e.revid === edit.revid);
							if (currentIndex !== -1) {
								queue.splice(currentIndex, 1);
								this.removeQueueItem(edit.revid);

								if (edit === currentEdit) {
									if (queue.length > 0) {
										if (currentIndex < queue.length) {
											wikishield.queue.currentEdit = queue[currentIndex];
										} else {
											wikishield.queue.currentEdit = queue[queue.length - 1];
										}
									} else {
										wikishield.queue.currentEdit = null;
									}
								}
								wikishield.queue.previousItems.push(edit);
								this.renderQueue(queue, wikishield.queue.currentEdit);
							}
							contextMenu.remove();
						});

						// Whitelist toggle
						contextMenu.querySelector("#context-whitelist").addEventListener("click", () => {
							wikishield.queue.playSparkleSound();

							if (wikishield.whitelist.has(edit.user.name)) {
								wikishield.whitelist.delete(edit.user.name);
								wikishield.saveWhitelist();
								wikishield.logger.log(`Removed ${edit.user.name} from whitelist`);
							} else {
								wikishield.whitelist.set(edit.user.name, Date.now());
								wikishield.saveWhitelist();
								wikishield.logger.log(`Added ${edit.user.name} to whitelist`);
							}

							this.renderQueue(wikishield.queue.queue, wikishield.queue.currentEdit);
							contextMenu.remove();
						});

						// Open history
						contextMenu.querySelector("#context-open-history").addEventListener("click", (e) => {
							wikishield.queue.playClickSound();
							const url = wikishield.util.pageLink(`Special:PageHistory/${edit.page.title}`);
							wikishield.interface.eventManager.openWikipediaLink(url, `History: ${edit.page.title}`, e);
							contextMenu.remove();
						});

						// Open contributions
						contextMenu.querySelector("#context-open-contribs").addEventListener("click", (e) => {
							wikishield.queue.playClickSound();
							const url = wikishield.util.pageLink(`Special:Contributions/${edit.user.name}`);
							wikishield.interface.eventManager.openWikipediaLink(url, `Contributions: ${edit.user.name}`, e);
							contextMenu.remove();
						});

						contextMenu.addEventListener("click", (mevent) => mevent.stopPropagation());
					});

					// --- Click to select ---
					elem.addEventListener("click", () => {
						wikishield.queue.currentEdit = edit;
						this.renderQueue(wikishield.queue.queue, edit);

						if (edit && wikishield.options.enableOllamaAI && wikishield.ollamaAI) {
							wikishield.ollamaAI.analyzeEdit(edit)
								.then(analysis => {
									edit.aiAnalysis = analysis;
									if (wikishield.queue.currentEdit === edit && wikishield.interface) {
										wikishield.interface.updateAIAnalysisDisplay(analysis);
									}
								})
								.catch(err => console.error("AI analysis failed:", err));
						}
					});

					// Add to DOM (temporarily append)
					container.appendChild(elem);
				}

				// Move to correct position in DOM to match queue order
				if (previous === null) {
					if (elem !== container.firstChild) {
						container.insertBefore(elem, container.firstChild);
					}
				} else if (elem.previousSibling !== previous) {
					container.insertBefore(elem, previous.nextSibling);
				}

				elem.classList.toggle("queue-edit-current", edit === currentEdit);
				previous = elem;
			}

			// Remove stale DOM nodes not in queue
			for (const [revid, el] of domMap.entries()) {
				if (!queue.find(e => e.revid === revid)) el.remove();
			}

			if (this.lastCurrentEdit !== currentEdit) {
				this.lastCurrentEdit = currentEdit;
				this.newEditSelected(currentEdit);
			}
		}

		/**
		 * Generate the HTML for a single edit in the queue, user edits, or page history sections
		 * @param {Object} edit
		 * @param {Boolean} includeORES include the ORES score of the edit
		 * @param {Boolean} includeTitle include the page title
		 * @param {Boolean} includeUser include the name of the user who made the edit
		 * @param {Boolean} includeTime include the edit's timestamp
		 */
		generateEditHTML(edit, includeORES = true, includeTitle = true, includeUser = true, includeTime = false) {
			let tagHTML = "";
			// Ensure edit.tags is an array before iterating
			if (edit.tags && Array.isArray(edit.tags)) {
				for (const tag of edit.tags) {
					tagHTML += `<span class="queue-edit-tag">${tag}</span>`;
				}
			}

			const diff = edit.sizediff || 0;
			const summaryTruncated = edit.comment ? wikishield.util.escapeHtml(wikishield.util.maxStringLength(edit.comment, 100)) : "";
			const summaryFull = edit.comment ? wikishield.util.escapeHtml(edit.comment) : "";

			// Add minor edit indicator before summary
			const minorIndicator = edit.minor ? `<span class="minor-indicator" data-tooltip="Minor edit">m</span> ` : "";

			// Format ORES score for display
			const oresScore = edit.ores || 0;
			const oresPercent = Math.round(oresScore * 100);
			const oresLabel = oresPercent < 30 ? "Good" : oresPercent < 70 ? "Review" : "Likely Bad";

			const oresHTML = includeORES ? `<div class="queue-edit-color" data-ores-score="${oresPercent}%" style="background: ${this.getORESColor(oresScore)};"></div>` : "";
			const titleHTML = includeTitle ? `
				<div class="queue-edit-title" data-tooltip="${edit.page ? edit.page.title : edit.title}">
					<span class="fa fa-file-lines queue-edit-icon"></span>
					${edit.page ? edit.page.title : edit.title}
				</div>` : "";

			// Determine user highlight classes
			let userClasses = "";
			if (edit.user && wikishield.highlighted.has(edit.user.name)) {
				userClasses = "queue-edit-user-highlight";
			} else if (edit.user && typeof edit.user === "object" && edit.user.emptyTalkPage) {
				userClasses = "queue-edit-user-empty-talk";
			}

			const userHTML = includeUser ? `
				<div class="queue-edit-user ${userClasses}">
					<span class="fa fa-user queue-edit-icon"></span>
					${!edit.user ? "<em>Username removed</em>" : typeof edit.user === "string" ? edit.user : edit.user.name}
				</div>` : "";
			const timeHTML = includeTime ? `
				<div class="queue-edit-time" data-tooltip="${edit.timestamp}">
					<span class="fa fa-clock queue-edit-icon"></span>
					${wikishield.util.timeAgo(edit.timestamp)}
				</div>` : "";

			return `
				${oresHTML}
				<div class="queue-edit-content">
					${titleHTML}
					${userHTML}
					<div class="queue-edit-summary" data-tooltip="${summaryFull}">
						<span class="fa fa-comment-dots queue-edit-icon"></span>
						${minorIndicator}${summaryTruncated || "<em>No summary provided</em>"}
					</div>
					${timeHTML}
					<div class="queue-edit-tags">
						${tagHTML}
					</div>
				</div>
				<div class="queue-edit-change" style="${Math.abs(diff) >= 500 ? "font-weight: bold;" : ""}color: ${wikishield.util.getChangeColor(diff)}">
					${wikishield.util.getChangeString(diff)}
				</div>
			`;
		}

		/**
		 * Update the main container when a new edit is selected
		 * @param {Object} edit
		 */
		async newEditSelected(edit) {
			// Close all bottom menu popups when switching pages
			this.closeAllMenus();

			const userContribsLevel = this.elem("#user-contribs-level");
			const contribsContainer = this.elem("#user-contribs-content"),
				historyContainer = this.elem("#page-history-content");

			contribsContainer.innerHTML = "";
			historyContainer.innerHTML = "";

			// Remove any existing tooltips when switching diffs
			this.removeTooltips();

			if (edit === null) {
				this.elem("#middle-top").innerHTML = "";
				this.elem("#right-top").innerHTML = "";
				this.elem("#page-metadata").innerHTML = "";
				this.elem("#user-contribs-count").innerText = "_ edits";
				userContribsLevel.style.display = "none";
				this.elem("#diff-container").innerHTML = "";
				this.elem("#protection-indicator").innerHTML = "";

				// Remove AI analysis container when no edit
				const aiContainer = document.querySelector("#ai-analysis-container");
				if (aiContainer) {
					aiContainer.remove();
				}

				// Remove old edit notice when no edit
				const noticeContainer = document.querySelector("#old-edit-notice");
				if (noticeContainer) {
					noticeContainer.remove();
				}

				// Update diff height
				this.updateDiffContainerHeight();

				// Hide block count indicator
				const blockIndicator = document.querySelector("#user-contribs #block-count-indicator");
				if (blockIndicator) {
					blockIndicator.style.display = "none";
					blockIndicator.innerHTML = "";
				}
				// Clear protection indicator
				const protIndicator = document.querySelector("#page-history #protection-indicator");
				if (protIndicator) {
					protIndicator.innerHTML = "";
				}
				return;
			}

			// Stop checking for newer revisions on the previous edit
			this.stopNewerRevisionCheck();

			// Start checking for newer revisions on THIS Wikipedia page
			this.startNewerRevisionCheck(edit);

			userContribsLevel.style.display = "initial";
			userContribsLevel.style.background = wikishieldData.warningTemplateColors[edit.user.warningLevel] || "grey";
			userContribsLevel.innerText = edit.user.warningLevel;

			const addToolipToWarningLevel = () => {
				// Clone and replace the element to remove old event listeners (prevents memory leak/crash)
				const newUserContribsLevel = userContribsLevel.cloneNode(true);
				userContribsLevel.parentNode.replaceChild(newUserContribsLevel, userContribsLevel);

				// Add tooltip listener to the fresh warning level indicator
				this.addTooltipListener(newUserContribsLevel);
			};

			// Fetch warning history for tooltip
			if (edit.user.warningLevel !== "0") {
				wikishield.api.getSinglePageContent(`User talk:${edit.user.name}`).then(talkContent => {
					const warningHistory = wikishield.queue.getWarningHistory(talkContent);
					if (warningHistory.length > 0) {
						let tooltipHtml = '<div class="tooltip-title">Warning History</div>';
						warningHistory.slice(0, 5).forEach(warning => {
							const templateDisplay = `${warning.template}${warning.level}`;
							const articleInfo = warning.article ? `<span class="tooltip-item-article"> (${wikishield.util.escapeHtml(warning.article)})</span>` : "";
							const userInfo = warning.username ? `User:${wikishield.util.escapeHtml(warning.username)}` : (warning.timestamp || warning.section);
							tooltipHtml += `<div class="tooltip-item">`;
							tooltipHtml += `<span class="tooltip-item-level">${wikishield.util.escapeHtml(templateDisplay)}</span>`;
							tooltipHtml += articleInfo;
							tooltipHtml += `<br><span class="tooltip-item-time">${wikishield.util.escapeHtml(userInfo)}</span>`;
							tooltipHtml += `</div>`;
						});
						if (warningHistory.length > 5) {
							tooltipHtml += `<div class="tooltip-more">... and ${warningHistory.length - 5} more</div>`;
						}
						userContribsLevel.setAttribute("data-tooltip", tooltipHtml);
						userContribsLevel.setAttribute("data-tooltip-html", "true");
					} else {
						userContribsLevel.setAttribute("data-tooltip", `Warning level: ${edit.user.warningLevel}`);
						userContribsLevel.setAttribute("data-tooltip-html", "false");
					}
				}).catch(() => {
					userContribsLevel.setAttribute("data-tooltip", `Warning level: ${edit.user.warningLevel}`);
					userContribsLevel.setAttribute("data-tooltip-html", "false");
				}).finally(addToolipToWarningLevel);
			} else {
				userContribsLevel.setAttribute("data-tooltip", "No warnings");
				userContribsLevel.setAttribute("data-tooltip-html", "false");

				addToolipToWarningLevel();
			}

			this.elem("#user-contribs-count").innerText = edit.user.editCount === -1 ? "N/A edits"
				: edit.user.editCount + " edit" + (edit.user.editCount === 1 ? "" : "s");

			const summaryTruncated = edit.comment ? wikishield.util.escapeHtml(wikishield.util.maxStringLength(edit.comment, 150)) : "";
			const summaryFull = edit.comment ? wikishield.util.escapeHtml(edit.comment) : "";
			const minorIndicator = edit.minor ? `<span class="minor-indicator" data-tooltip="Minor edit">m</span> ` : "";
			const title = wikishield.util.escapeHtml(wikishield.util.maxStringLength(edit.page.title, 50));
			const titleFull = wikishield.util.escapeHtml(edit.page.title);
			const username = wikishield.util.escapeHtml(wikishield.util.maxStringLength(edit.user.name, 30));
			const usernameFull = wikishield.util.escapeHtml(edit.user.name);

			// Fetch page protection info and user block count
			const protectionPromise = wikishield.api.getPageProtection(edit.page.title);
			const blockCountPromise = wikishield.api.getBlockCount(edit.user.name);

			this.elem("#middle-top").innerHTML = `
				<div style="display: flex; overflow: auto hidden; white-space: nowrap">
					<div>
						<span class="fa fa-file-lines"></span>
						<a href="${wikishield.util.pageLink(edit.page.title)}" target="_blank" data-tooltip="${titleFull}">${title}</a>
					</div>
					<div>
						<span class="fa fa-user"></span>
						<a href="${wikishield.util.pageLink("Special:Contributions/" + edit.user.name)}" target="_blank" data-tooltip="${usernameFull}">${username}</a>
					</div>
					<div>
						<span class="fa fa-pencil"></span>
						<span style="color: ${wikishield.util.getChangeColor(edit.sizediff || 0)}">${wikishield.util.getChangeString(edit.sizediff || 0)}</span>
					</div>
				</div>
				<div class="middle-top-comment" data-tooltip="${summaryFull}">
					<span class="fa fa-comment-dots"></span>
					${minorIndicator}${summaryTruncated || "<em>No summary provided</em>"}
				</div>
			`;

			const $rightTop = this.elem("#right-top");
			$rightTop.innerHTML = `
				<div class="right-top-comment">
					Consecutive edits
				</div>
				<div>
					<span class="fa fa-clock"></span>
					<span id="consecutive-time">-</span>
				</div>
				<div>
					<span class="fa fa-edit"></span>
					<span id="consecutive-edits">-</span>
				</div>
				<div>
					<span class="fa fa-pencil"></span>
					<span id="consecutive-sizediff" style="color: ${wikishield.util.getChangeColor(0)}">-</span>
				</div>
			`;

			edit.consecutive.then((object) => {
				if (object === null) { // failed
					$rightTop.querySelector("#consecutive-time").innerHTML = "?";
					$rightTop.querySelector("#consecutive-edits").innerHTML = "?";
					$rightTop.querySelector("#consecutive-sizediff").innerHTML = "?";

					return;
				}

				let { timestamp, count, sizediff } = object;

				const $consecutiveTime = $rightTop.querySelector("#consecutive-time");
				$consecutiveTime.innerHTML = wikishield.formatNotificationTimeShort(new Date(timestamp));
				$consecutiveTime.parentElement.dataset.tooltip = timestamp;
				this.addTooltipListener($consecutiveTime.parentElement);

				if (count === __script__.config.historyCount) {
					count += "+";
				}
				$rightTop.querySelector("#consecutive-edits").innerHTML = count;

				const $sizediff = $rightTop.querySelector("#consecutive-sizediff");
				$sizediff.style.color = wikishield.util.getChangeColor(sizediff);
				$sizediff.innerHTML = wikishield.util.getChangeString(edit.sizediff || 0);
			});

			// Highlight username in top bar based on status (same as queue highlighting)
			// Use requestAnimationFrame to ensure DOM has been updated
			requestAnimationFrame(() => {
				const middleTop = this.elem("#middle-top");
				const userDiv = middleTop.children[1]; // Second div contains the username
				const userLink = userDiv ? userDiv.querySelector("a") : null; // Get the <a> tag inside
				const userIcon = userDiv ? userDiv.querySelector(".fa-user") : null; // Get the icon

				if (userLink) {
					// Clear previous styles
					userLink.style.color = "";
					userLink.style.fontWeight = "";
					if (userIcon) {
						userIcon.style.color = "";
					}

					// Check if user is highlighted (yellow) or has empty talk page (red)
					if (wikishield.highlighted.has(edit.user.name)) {
						userLink.style.setProperty("color", "#f4c430", "important");
						userLink.style.setProperty("font-weight", "600", "important");
						if (userIcon) {
							userIcon.style.setProperty("color", "#f4c430", "important");
						}
					} else if (edit.user.emptyTalkPage) {
						userLink.style.setProperty("color", "#ff6b6b", "important");
						userLink.style.setProperty("font-weight", "600", "important");
						if (userIcon) {
							userIcon.style.setProperty("color", "#ff6b6b", "important");
						}
					}
				}
			});

			// Update whitelist and highlight button text based on current status
			const whitelistButton = this.elem("#user-add-whitelist");
			const highlightButton = this.elem("#user-highlight");

			if (whitelistButton) {
				const isWhitelisted = wikishield.whitelist.has(edit.user.name);
				const whitelistIcon = whitelistButton.querySelector("i");
				const whitelistSpan = whitelistButton.querySelector("span");

				if (isWhitelisted) {
					whitelistSpan.textContent = "Remove from whitelist";
					if (whitelistIcon) {
						whitelistIcon.className = "fas fa-user-xmark";
					}
				} else {
					whitelistSpan.textContent = "Add to whitelist";
					if (whitelistIcon) {
						whitelistIcon.className = "fas fa-user-check";
					}
				}
			}

			if (highlightButton) {
				const isHighlighted = wikishield.highlighted.has(edit.user.name);
				const highlightIcon = highlightButton.querySelector("i");
				const highlightSpan = highlightButton.querySelector("span");

				if (isHighlighted) {
					highlightSpan.textContent = "Remove highlight";
					if (highlightIcon) {
						highlightIcon.className = "fas fa-star-half-stroke";
					}
				} else {
					highlightSpan.textContent = "Highlight user";
					if (highlightIcon) {
						highlightIcon.className = "fas fa-star";
					}
				}
			}

			// Load protection info and display in page history header
			protectionPromise.then(protection => {
				const protIndicator = document.querySelector("#page-history #protection-indicator");
				if (protIndicator) {
					if (protection.protected) {
						let icon = "🔒";
						let tooltip = "Protected";

						if (protection.level === "full") {
							icon = "🔒";
							tooltip = "Fully protected";
						} else if (protection.level === "semi") {
							icon = "🔓";
							tooltip = "Semi-protected";
						} else if (protection.level === "extended") {
							icon = "🔐";
							tooltip = "Extended confirmed protected";
						}

						protIndicator.innerHTML = `<span style="cursor: help;" data-tooltip="${tooltip}">${icon}</span>`;
						this.addTooltipListener(protIndicator.querySelector("[data-tooltip]"));
					} else {
						protIndicator.innerHTML = "";
					}
				}
			});

			// Load block count and display next to warning level
			blockCountPromise.then(async blockCount => {
				const blockIndicator = document.querySelector("#user-contribs #block-count-indicator");
				if (blockIndicator) {
					if (blockCount > 0) {
						// Fetch detailed block history for tooltip
						const blockHistory = await wikishield.api.getBlockHistory(edit.user.name);

						let tooltipHtml = `<div class="tooltip-title">🚫 Block History (${blockCount} total)</div>`;

						if (blockHistory.length > 0) {
							blockHistory.forEach(block => {
								// Extract plain text from blocker name (remove any HTML tags)
								let blockerName = block.user || "Unknown";
								blockerName = blockerName.replace(/<[^>]*>/g, '');

								const timestamp = new Date(block.timestamp).toLocaleString('en-US', {
									month: 'short',
									day: 'numeric',
									year: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								});

								// Extract plain text from duration (remove any HTML tags)
								let duration = block.params?.duration || "Unknown duration";
								duration = duration.replace(/<[^>]*>/g, '');

								// Extract plain text from reason (remove any HTML tags)
								let reason = block.comment || "No reason specified";
								reason = reason.replace(/<[^>]*>/g, '');

								tooltipHtml += `<div class="tooltip-item">`;
								tooltipHtml += `<span class="tooltip-item-level">By ${wikishield.util.escapeHtml(blockerName)}</span><br>`;
								tooltipHtml += `<span class="tooltip-item-time">${timestamp} • ${wikishield.util.escapeHtml(duration)}</span><br>`;
								tooltipHtml += `<span class="tooltip-item-article">${wikishield.util.escapeHtml(reason)}</span>`;
								tooltipHtml += `</div>`;
							});

							if (blockCount > blockHistory.length) {
								tooltipHtml += `<div class="tooltip-more">... and ${blockCount - blockHistory.length} more</div>`;
							}
						}

						blockIndicator.style.display = "initial";
						blockIndicator.setAttribute("data-tooltip", tooltipHtml);
						blockIndicator.setAttribute("data-tooltip-html", "true");
						blockIndicator.innerHTML = `${blockCount}×`;
						blockIndicator.style.cursor = "help";
						this.addTooltipListener(blockIndicator);
					} else {
						blockIndicator.style.display = "none";
						blockIndicator.innerHTML = "";
						blockIndicator.removeAttribute("data-tooltip");
						blockIndicator.removeAttribute("data-tooltip-html");
					}
				}
			});

			// Add tooltip listeners to the new elements
			[...this.elem("#middle-top").querySelectorAll("[data-tooltip]")].forEach(e => {
				this.addTooltipListener(e);
			});

			// Update page metadata display
			const metadataElem = this.elem("#page-metadata");
			if (metadataElem) {
				const parts = [];
				if (edit.page.dateFormat && edit.page.dateFormat !== "Unknown") {
					parts.push(edit.page.dateFormat);
				}
				if (edit.page.englishVariant && edit.page.englishVariant !== "Unknown") {
					parts.push(edit.page.englishVariant);
				}
				metadataElem.innerHTML = parts.length > 0 ? parts.join(" • ") : "";
			}

			for (const cedit of edit.user.contribs) {
				const current = cedit.revid === wikishield.queue.currentEdit.revid ? "queue-edit-current" : "";

				contribsContainer.innerHTML += `
					<div class="queue-edit ${current}" data-revid="${cedit.revid}">
						${this.generateEditHTML(cedit, false, true, false, true)}
					</div>
				`;
			}

			for (const hedit of edit.page.history) {
				const current = hedit.revid === wikishield.queue.currentEdit.revid ? "queue-edit-current" : "";

				historyContainer.innerHTML += `
					<div class="queue-edit ${current}" data-revid="${hedit.revid}">
						${this.generateEditHTML(hedit, false, false, true, true)}
					</div>
				`;
			}

			[
				...contribsContainer.querySelectorAll("[data-tooltip]"),
				...historyContainer.querySelectorAll("[data-tooltip]")
			].forEach(elem => this.addTooltipListener(elem));

			[...contribsContainer.querySelectorAll(".queue-edit")].forEach(elem => {
				elem.addEventListener("click", () => wikishield.queue.loadFromContribs(elem.dataset.revid));
			});

			[...historyContainer.querySelectorAll(".queue-edit")].forEach(elem => {
				elem.addEventListener("click", () => wikishield.queue.loadFromHistory(elem.dataset.revid));
			});

			this.elem("#diff-container").innerHTML = `<table>${edit.diff}</table>`;

			// Remove any existing old edit notice
			const existingNotice = document.querySelector("#old-edit-notice");
			if (existingNotice) {
				existingNotice.remove();
			}

			// Update diff height
			this.updateDiffContainerHeight();		// Highlight elements containing current user's username in the diff

            if (wikishield.options.enableUsernameHighlighting) {
                const currentUsername = mw.config.get("wgUserName");
                if (currentUsername) {
                    const diffContainer = this.elem("#diff-container");
                    // Find all elements (typically td cells) in the diff
                    const allElements = diffContainer.querySelectorAll("td");

                    allElements.forEach(elem => {
                        if (elem.textContent.includes(currentUsername)) {
                            elem.style.outline = "2px solid #ffc107";
                            elem.style.outlineOffset = "-2px";
                        }
                    });
                }
            }

			// Scroll to the first changed line in the diff
			const diffContainer = this.elem("#diff-container");
			const firstChange = diffContainer.querySelector(".diff-addedline, .diff-deletedline");
			if (firstChange) {
				// Use setTimeout to ensure the DOM is fully rendered before scrolling
				setTimeout(() => {
					firstChange.scrollIntoView({ behavior: "smooth", block: "center" });
				}, 100);
			}

			// Display AI analysis if available
			this.updateAIAnalysisDisplay(edit.aiAnalysis);

			this.hide3RRNotice();
			if (edit.reverts >= 3) {
				this.show3RRNotice(edit.reverts);
			}
		}

		/**
		 * Update or create AI analysis display
		 * @param {Object} analysis The AI analysis object
		 */
		updateAIAnalysisDisplay(analysis) {
			// Find or create AI analysis container
			let aiContainer = document.querySelector("#ai-analysis-container");

			if (!analysis) {
				// Remove AI container if no analysis
				if (aiContainer) {
					aiContainer.remove();
				}
				this.updateDiffContainerHeight();
				return;
			}

			if (!aiContainer) {
				// Create container if it doesn't exist
				const diffContainer = document.querySelector("#diff-container");
				if (!diffContainer) return;

				aiContainer = document.createElement("div");
				aiContainer.id = "ai-analysis-container";
				aiContainer.style.cssText = `
					margin: 12px;
					padding: 0;
					border-radius: 12px;
					background: linear-gradient(135deg,
						rgba(102, 126, 234, 0.95) 0%,
						rgba(118, 75, 162, 0.95) 50%,
						rgba(102, 126, 234, 0.9) 100%);
					backdrop-filter: blur(20px);
					-webkit-backdrop-filter: blur(20px);
					color: white;
					box-shadow:
						0 8px 24px rgba(102, 126, 234, 0.4),
						inset 0 1px 0 rgba(255, 255, 255, 0.2),
						inset 0 -1px 0 rgba(0, 0, 0, 0.1);
					border: 1px solid rgba(255, 255, 255, 0.15);
					overflow: hidden;
					flex-shrink: 0;
					transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
				`;
				diffContainer.parentElement.insertBefore(aiContainer, diffContainer);
			}

			if (analysis.error) {
				aiContainer.innerHTML = `
					<div style="display: flex; align-items: center; gap: 10px; padding: 16px; background: rgba(220, 53, 69, 0.15); border-left: 4px solid #dc3545;">
						<span class="fa fa-exclamation-triangle" style="font-size: 1.3em; color: #ff6b6b;"></span>
						<span style="font-weight: 500;">AI analysis failed: ${analysis.error}</span>
					</div>
				`;
				this.updateDiffContainerHeight();
				return;
			}

			// Build issue badges
			let issueHTML = '';
			if (analysis.hasIssues && analysis.issues && analysis.issues.length > 0) {
				const severityColors = {
					'critical': 'rgba(220, 53, 69, 0.95)',
					'major': 'rgba(253, 126, 20, 0.95)',
					'minor': 'rgba(255, 193, 7, 0.95)'
				};

				const typeIcons = {
					'vandalism': 'fa-skull-crossbones',
					'spam': 'fa-spam',
					'pov': 'fa-balance-scale',
					'unsourced': 'fa-question-circle',
					'attack': 'fa-bomb',
					'copyright': 'fa-copyright',
					'disruptive': 'fa-circle-exclamation',
					'error': 'fa-bug',
					'policy': 'fa-gavel',
					'ai-generated': 'fa-robot'
				};

				issueHTML = '<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">';
				for (const issue of analysis.issues.slice(0, 5)) {
					const iconClass = typeIcons[issue.type] || 'fa-exclamation-circle';
					const bgColor = severityColors[issue.severity] || 'rgba(108, 117, 125, 0.95)';
					issueHTML += `
					<span style="
						display: inline-flex;
						align-items: center;
						gap: 4px;
						padding: 4px 8px;
						background: ${bgColor};
						border-radius: 6px;
						font-size: 0.75em;
						font-weight: 600;
						letter-spacing: 0.2px;
						box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
						border: 1px solid rgba(255, 255, 255, 0.2);
						cursor: help;
						transition: all 0.2s ease;
					" data-tooltip="${wikishield.util.escapeHtml(issue.description)}"
					onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 3px 10px rgba(0, 0, 0, 0.3)';"
					onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 6px rgba(0, 0, 0, 0.2)';">
						<span class="fa ${iconClass}"></span>
						${issue.type}
					</span>
				`;
				}
				if (analysis.issues.length > 5) {
					issueHTML += `<span style="opacity: 0.85; font-size: 0.75em; padding: 4px 8px; background: rgba(0, 0, 0, 0.15); border-radius: 6px; font-weight: 500;">+${analysis.issues.length - 5} more</span>`;
				}
				issueHTML += '</div>';
			}

			// Build recommendation/action badge
			const actionColors = {
				'rollback': 'rgba(220, 53, 69, 0.95)',
				'warn-and-revert': 'rgba(231, 76, 60, 0.95)',
				'warn': 'rgba(253, 126, 20, 0.95)',
				'report-aiv': 'rgba(142, 68, 173, 0.95)',
				'review': 'rgba(255, 193, 7, 0.95)',
				'approve': 'rgba(40, 167, 69, 0.95)',
				'thank': 'rgba(23, 162, 184, 0.95)',
				'welcome': 'rgba(32, 201, 151, 0.95)'
			};
			const actionIcons = {
				'rollback': 'fa-rotate-left',
				'warn-and-revert': 'fa-exclamation-triangle',
				'warn': 'fa-exclamation-triangle',
				'report-aiv': 'fa-gavel',
				'review': 'fa-eye',
				'approve': 'fa-check-circle',
				'thank': 'fa-heart',
				'welcome': 'fa-hand-wave'
			};

			const action = analysis.action || 'review';
			const actionColor = actionColors[action] || 'rgba(108, 117, 125, 0.95)';
			const actionIcon = actionIcons[action] || 'fa-question';
			const probability = analysis.probability || 0;

			aiContainer.innerHTML = `
			<div style="padding: 10px 12px;">
				<!-- Compact Header -->
				<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
					<div style="display: flex; align-items: center; gap: 6px;">
						<span class="fa fa-robot" style="font-size: 1.1em;"></span>
						<strong style="font-size: 0.95em; letter-spacing: 0.3px;">AI Analysis</strong>
						<span style="padding: 3px 8px; background: rgba(255,255,255,0.25); border-radius: 6px; font-size: 0.8em; font-weight: 700;">
							${probability}%
						</span>
						<span style="padding: 3px 8px; background: rgba(255,255,255,0.18); border-radius: 6px; font-size: 0.75em; font-weight: 600; text-transform: uppercase;">
							${analysis.confidence || 'unknown'}
						</span>
					</div>
					<span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: ${actionColor}; border-radius: 6px; font-size: 0.8em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">
						<span class="fa ${actionIcon}"></span>
						${action.replace(/-/g, ' ')}
					</span>
				</div>

				<!-- Compact Summary -->
				<div style="font-size: 0.85em; line-height: 1.4; margin-bottom: 6px; opacity: 0.95;">
					${analysis.summary}
				</div>

				${analysis.reasoning ? `
				<div style="font-size: 0.8em; line-height: 1.3; padding: 6px 8px; background: rgba(0,0,0,0.15); border-radius: 4px; margin-bottom: 6px; border-left: 3px solid rgba(143,163,255,0.5); opacity: 0.9;">
					<strong style="font-size: 0.85em;">🔍</strong> ${analysis.reasoning}
				</div>
				` : ''}

				<!-- Compact Recommendation -->
				<div style="font-size: 0.82em; line-height: 1.3; padding: 6px 8px; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: ${analysis.hasIssues && analysis.issues && analysis.issues.length > 0 ? '8px' : '0'}; border-left: 3px solid rgba(40,167,69,0.6); opacity: 0.95;">
					<strong style="font-size: 0.85em;">💡</strong> ${analysis.recommendation}
				</div>

				<!-- Compact Issues -->
				${issueHTML}
			</div>
		`;

			// Add tooltip listeners to issue badges
			aiContainer.querySelectorAll('[data-tooltip]').forEach(elem => {
				this.addTooltipListener(elem);
			});

			// Update diff container height after AI analysis is displayed
			this.updateDiffContainerHeight();
		}

		/**
		 * Show a notice that you have broken 3RR
		 * @param {Number} count The revision ID of the newer edit
		 */
		show3RRNotice(count) {
			// Remove any existing notice first
			this.hide3RRNotice();

			// Validate inputs
			if (count < 3) {
				console.error("Cannot show 3RR notice: improper revert count");
				return;
			}

			// Create the notice using the same style as old-edit-notice
			const noticeDiv = document.createElement("div");
			noticeDiv.id = "warn-3RR-notice";

			noticeDiv.style.cssText = `
				margin: 10px 10px 0 10px;
				padding: 8px 12px;
				background: #f73214;
				border-radius: 4px;
				color: #0c5460;
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 0.9em;
				flex-shrink: 0;
			`;

			noticeDiv.innerHTML = `
				<span class="fa fa-warning"></span>
				<span style="flex: 1;"><b>3RR:</b> You have made ${count} reverts on this article in the last 24 hours.</span>
			`;

			// Insert before the diff container
			const diffContainer = this.elem("#diff-container");
			if (diffContainer && diffContainer.parentElement) {
				diffContainer.parentElement.insertBefore(noticeDiv, diffContainer);
			}
		}

		/**
		 * Hide the newer edit button if it exists
		 */
		hide3RRNotice() {
			const existingNotice = document.querySelector("#warn-3RR-notice");
			if (existingNotice) {
				existingNotice.remove();
			}
		}

		/**
		 * Show a button indicating there's a newer revision on the current Wikipedia page
		 * @param {Number} newerRevid The revision ID of the newer edit
		 * @param {String} pageTitle The title of the Wikipedia page
		 */
		showNewerEditButton(newerRevid, pageTitle) {
			// Remove any existing notice first
			this.hideNewerEditButton();

			// Validate inputs
			if (!newerRevid || !pageTitle) {
				console.error("Cannot show newer edit button: missing revid or page title");
				return;
			}

			// Create the notice using the same style as old-edit-notice
			const noticeDiv = document.createElement("div");
			noticeDiv.id = "old-edit-notice";
			noticeDiv.setAttribute("data-newer-revision", "true"); // Mark this as a newer revision notice
			noticeDiv.setAttribute("data-target-revid", newerRevid);
			noticeDiv.setAttribute("data-target-page", pageTitle);

			noticeDiv.style.cssText = `
				margin: 10px 10px 0 10px;
				padding: 8px 12px;
				background: #d1ecf1;
				border-left: 4px solid #17a2b8;
				border-radius: 4px;
				color: #0c5460;
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 0.9em;
				flex-shrink: 0;
			`;

			noticeDiv.innerHTML = `
				<span class="fa fa-clock-rotate-left"></span>
				<span style="flex: 1;">Newer revision available on this page</span>
				<a href="#" id="view-newest-edit" style="color: #004085; font-weight: 600; text-decoration: none; white-space: nowrap;">
					View latest →
				</a>
			`;

			// Insert before the diff container
			const diffContainer = this.elem("#diff-container");
			if (diffContainer && diffContainer.parentElement) {
				diffContainer.parentElement.insertBefore(noticeDiv, diffContainer);

				// Add click handler
				document.getElementById("view-newest-edit").addEventListener("click", (e) => {
					e.preventDefault();
					const targetRevid = noticeDiv.getAttribute("data-target-revid");
					const targetPage = noticeDiv.getAttribute("data-target-page");

					if (targetRevid && targetPage) {
						wikishield.queue.loadSpecificRevision(Number(targetRevid), targetPage);
					}
				});
			}
		}

		/**
		 * Hide the newer edit button if it exists
		 */
		hideNewerEditButton() {
			const existingNotice = document.querySelector("#old-edit-notice[data-newer-revision='true']");
			if (existingNotice) {
				existingNotice.remove();
			}
		}

		/**
		 * Start periodic checking for newer revisions on the current Wikipedia page
		 * @param {Object} edit The current edit being viewed
		 */
		startNewerRevisionCheck(edit) {
			// Clear any existing interval and hide any old buttons
			this.stopNewerRevisionCheck();

			// Immediately check for newer revisions
			this.checkForNewerRevision(edit);

			// Set up periodic checking every 10 seconds
			this.newerRevisionInterval = setInterval(() => {
				// Only continue checking if we're still viewing the exact same edit
				if (wikishield.queue.currentEdit && wikishield.queue.currentEdit.revid === edit.revid) {
					this.checkForNewerRevision(edit);
				} else {
					// We've switched to a different edit, stop this check
					this.stopNewerRevisionCheck();
				}
			}, 10000);
		}

		/**
		 * Stop periodic checking for newer revisions and hide the button
		 */
		stopNewerRevisionCheck() {
			// Clear the interval timer
			if (this.newerRevisionInterval) {
				clearInterval(this.newerRevisionInterval);
				this.newerRevisionInterval = null;
			}
			// Always remove the button when stopping
			this.hideNewerEditButton();
		}

		/**
		 * Check if there's a newer revision on the current Wikipedia page
		 * @param {Object} edit The current edit being viewed
		 */
		async checkForNewerRevision(edit) {
			try {
				const pageTitle = edit.page.title;
				const currentRevid = edit.revid;

				// Fetch the ACTUAL latest revision ID from Wikipedia API
				const latestRevisions = await wikishield.api.getLatestRevisions(pageTitle);
				const latestRevid = latestRevisions[pageTitle];

				if (!latestRevid) {
					// API call failed or page doesn't exist
					this.hideNewerEditButton();
					return;
				}

				// Simple check: is there a revision with a higher ID than the one we're viewing?
				if (latestRevid > currentRevid) {
					// YES - there's a newer revision on this Wikipedia page
					this.showNewerEditButton(latestRevid, pageTitle);
				} else {
					// NO - we're viewing the latest revision
					this.hideNewerEditButton();
				}
			} catch (err) {
				console.error("Failed to check for newer revision:", err);
				this.hideNewerEditButton();
			}
		}

		/**
		 * Dynamically adjust diff container height based on AI analysis and notices
		 */
		updateDiffContainerHeight() {
			// Since we're using flexbox, we don't need to manually calculate height
			// The diff-container will automatically fill available space
			// This method is kept for potential future use or other adjustments
		}	/**
		* Create a tooltip when an element is hovered over
		* @param {HTMLElement} elem
		*/
		addTooltipListener(elem) {
			elem.addEventListener("mouseenter", () => {
				this.removeTooltips();

				if (!elem.dataset.tooltip) {
					return;
				}

				const tooltip = document.createElement("div");
				tooltip.classList.add("tooltip");

				// Check if tooltip content is HTML or plain text
				if (elem.dataset.tooltipHtml === "true") {
					tooltip.innerHTML = elem.dataset.tooltip;
				} else {
					tooltip.innerText = elem.dataset.tooltip;
				}

				document.body.appendChild(tooltip);

				// Force a reflow to ensure dimensions are calculated
				tooltip.offsetHeight;

				const tooltipWidth = tooltip.getBoundingClientRect().width,
					tooltipHeight = tooltip.getBoundingClientRect().height;
				const elemBox = elem.getBoundingClientRect();

				// Calculate center position for the tooltip
				const centerLeft = (elemBox.left + elemBox.right - tooltipWidth) / 2;

				const canFitRight = elemBox.right < window.innerWidth - tooltipWidth - 30;
				const canFitLeft = elemBox.left > tooltipWidth + 30;
				// Check if tooltip can fit centered AND if centered position is actually on screen
				const canFitMiddle = centerLeft > 10 && centerLeft + tooltipWidth < window.innerWidth - 10;
				const canFitTop = canFitMiddle && elemBox.top > tooltipHeight + 30;
				const canFitBottom = canFitMiddle && elemBox.bottom < window.innerHeight - tooltipHeight - 30;

				// Position the tooltip
				if (canFitTop) {
					tooltip.style.left = (elemBox.left + elemBox.right - tooltipWidth) / 2 + "px";
					tooltip.style.top = (elemBox.top - tooltipHeight - 10) + "px";
				} else if (canFitBottom) {
					tooltip.style.left = (elemBox.left + elemBox.right - tooltipWidth) / 2 + "px";
					tooltip.style.top = (elemBox.bottom + 10) + "px";
				} else if (canFitRight) {
					tooltip.style.left = (elemBox.right + 10) + "px";
					tooltip.style.top = (elemBox.top - 4) + "px";
				} else if (canFitLeft) {
					tooltip.style.left = (elemBox.left - 10 - tooltipWidth) + "px";
					tooltip.style.top = (elemBox.top - 4) + "px";
				} else {
					// Fallback: center on element, clip if necessary
					tooltip.style.left = Math.max(10, (elemBox.left + elemBox.right - tooltipWidth) / 2) + "px";
					tooltip.style.top = Math.max(10, elemBox.bottom + 10) + "px";
				}

				tooltip.style.opacity = 1;
			});

			elem.addEventListener("mouseleave", () => {
				this.removeTooltips();
			});
		}

		/**
		 * Delete all existing tooltip elements
		 */
		removeTooltips() {
			[...document.querySelectorAll(".tooltip")].forEach(elem => {
				elem.style.opacity = 0;
				window.setTimeout(() => elem.remove(), 200);
			});
		}

		/**
		 * Remove all elements from the queue
		 */
		clearQueue() {
			this.elem("#queue-items").innerHTML = "";
		}

		/**
		 * Remove a specific item from the queue
		 * @param {Number} revid
		 */
		removeQueueItem(revid) {
			const elem = this.elem(`.queue-edit[data-revid="${revid}"]`);

			if (elem) {
				elem.remove();
			}
		}

		/**
		 * From the ORES score, get the color to display
		 * @param {Number} ores The ORES score
		 * @returns {String} The color to display
		 */
		getORESColor(ores) {
			const colors = wikishieldData.colorPalettes[wikishield.options.selectedPalette];
			return colors[Math.floor(ores * colors.length)];
		}

		/**
		 * Return a specific element
		 * @param {String} selector
		 * @returns
		 */
		elem(selector) {
			return document.querySelector(selector);
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
		 * Show a toast notification on screen
		 * @param {String} title - Title of the notification
		 * @param {String} message - Message content
		 * @param {Number} duration - How long to show (ms), default 5000
		 */
		showToast(title, message, duration = 5000, type = "default") {
			// Create toast element
			const toast = document.createElement("div");
			toast.classList.add("toast-notification");

			// Add type class for styling
			if (type === "success") toast.classList.add("success");
			else if (type === "error") toast.classList.add("error");
			else if (type === "warning") toast.classList.add("warning");

			// Select icon based on type
			let icon = "⚠️";
			if (type === "success") icon = "✓";
			else if (type === "error") icon = "✕";
			else if (type === "warning") icon = "⚠️";

			toast.innerHTML = `
				<div class="toast-icon">${icon}</div>
				<div class="toast-content">
					<div class="toast-title">${this.escapeHtml(title)}</div>
					<div class="toast-message">${this.escapeHtml(message)}</div>
				</div>
				<div class="toast-close">×</div>
			`;

			document.body.appendChild(toast);

			// Trigger animation
			setTimeout(() => toast.classList.add("show"), 10);

			// Close button handler
			const closeBtn = toast.querySelector(".toast-close");
			closeBtn.addEventListener("click", () => {
				this.hideToast(toast);
			});

			// Auto-hide after duration
			setTimeout(() => {
				this.hideToast(toast);
			}, duration);
		}

		/**
		 * Hide and remove a toast notification
		 */
		hideToast(toast) {
			if (!toast || !toast.parentElement) return;

			toast.classList.add("hide");
			setTimeout(() => {
				if (toast.parentElement) {
					toast.remove();
				}
			}, 300);
		}

		/**
		 * Show UAA reason selection dialog
		 * @param {String} username - Username to report
		 * @returns {Promise<String|null>} Selected reason or null if cancelled
		 */
		showUAAReasonDialog(username) {
			return new Promise((resolve) => {
				// Create overlay
				const overlay = document.createElement("div");
				overlay.classList.add("confirmation-modal-overlay");

				// Create modal
				const modal = document.createElement("div");
				modal.classList.add("confirmation-modal");
				modal.innerHTML = `
					<div class="confirmation-modal-header">
						<div class="confirmation-modal-title">Report to UAA</div>
					</div>
					<div class="confirmation-modal-body">
						Select reason for reporting <span class="confirmation-modal-username">${this.escapeHtml(username)}</span>:
					</div>
					<div class="confirmation-modal-footer confirmation-modal-footer-vertical">
						<button class="confirmation-modal-button confirmation-modal-button-reason" data-reason="Disruptive username">Disruptive username</button>
						<button class="confirmation-modal-button confirmation-modal-button-reason" data-reason="Offensive username">Offensive username</button>
						<button class="confirmation-modal-button confirmation-modal-button-reason" data-reason="Promotional username">Promotional username</button>
						<button class="confirmation-modal-button confirmation-modal-button-reason" data-reason="Misleading username">Misleading username</button>
						<button class="confirmation-modal-button confirmation-modal-button-cancel">Cancel</button>
					</div>
				`;

				overlay.appendChild(modal);
				document.body.appendChild(overlay);

				// Disable all keybinds while modal is open
				const keyHandler = (e) => {
					if (e.key === "Escape") {
						e.preventDefault();
						e.stopPropagation();
						closeModal(null);
						return false;
					} else if (e.key !== "Tab") {
						e.preventDefault();
						e.stopPropagation();
						return false;
					}
				};

				document.addEventListener("keydown", keyHandler, true);

				const closeModal = (result) => {
					document.removeEventListener("keydown", keyHandler, true);
					overlay.classList.add("closing");
					modal.classList.add("closing");
					setTimeout(() => {
						overlay.remove();
						resolve(result);
					}, 200);
				};

				// Handle reason button clicks
				modal.querySelectorAll(".confirmation-modal-button-reason").forEach(btn => {
					btn.addEventListener("click", () => {
						closeModal(btn.dataset.reason);
					});
				});

				// Handle cancel button
				modal.querySelector(".confirmation-modal-button-cancel").addEventListener("click", () => {
					closeModal(null);
				});

				// Close on overlay click
				overlay.addEventListener("click", (e) => {
					if (e.target === overlay) {
						closeModal(null);
					}
				});
			});
		}

		/**
		 * Show a confirmation dialog and return a promise that resolves to true (Yes) or false (No)
		 * @param {String} title - Dialog title
		 * @param {String} message - Dialog message (can include HTML)
		 * @param {String} username - Optional username to enable UAA report button
		 */
		showConfirmationDialog(title, message, username = null) {
			return new Promise((resolve) => {
				// Create overlay
				const overlay = document.createElement("div");
				overlay.classList.add("confirmation-modal-overlay");

				// Create modal
				const modal = document.createElement("div");
				modal.classList.add("confirmation-modal");

				const uaaButton = username ? `<button class="confirmation-modal-button confirmation-modal-button-uaa">Report to UAA</button>` : '';

				modal.innerHTML = `
					<div class="confirmation-modal-header">
						<div class="confirmation-modal-title">${this.escapeHtml(title)}</div>
					</div>
					<div class="confirmation-modal-body">${message}</div>
					<div class="confirmation-modal-footer">
						${uaaButton}
						<div class="confirmation-modal-footer-right">
							<button class="confirmation-modal-button confirmation-modal-button-no">No</button>
							<button class="confirmation-modal-button confirmation-modal-button-yes">Yes</button>
						</div>
					</div>
				`;

				overlay.appendChild(modal);
				document.body.appendChild(overlay);

				// Disable all keybinds while modal is open
				const keyHandler = (e) => {
					// Only allow Tab, Enter, Escape
					if (e.key === "Enter") {
						e.preventDefault();
						e.stopPropagation();
						closeModal(true);
						return false;
					} else if (e.key === "Escape") {
						e.preventDefault();
						e.stopPropagation();
						closeModal(false);
						return false;
					} else if (e.key !== "Tab") {
						// Block all other keys
						e.preventDefault();
						e.stopPropagation();
						return false;
					}
				};

				document.addEventListener("keydown", keyHandler, true);

				// Handle button clicks
				const yesBtn = modal.querySelector(".confirmation-modal-button-yes");
				const noBtn = modal.querySelector(".confirmation-modal-button-no");
				const uaaBtn = modal.querySelector(".confirmation-modal-button-uaa");

				const closeModal = (result) => {
					// Remove key handler
					document.removeEventListener("keydown", keyHandler, true);

					overlay.classList.add("closing");
					modal.classList.add("closing");
					setTimeout(() => {
						overlay.remove();
						resolve(result);
					}, 200);
				};

				yesBtn.addEventListener("click", () => closeModal(true));
				noBtn.addEventListener("click", () => closeModal(false));

				// UAA report button
				if (uaaBtn && username) {
					uaaBtn.addEventListener("click", async () => {
						// Close the current modal first
						document.removeEventListener("keydown", keyHandler, true);
						overlay.classList.add("closing");
						modal.classList.add("closing");

						setTimeout(async () => {
							overlay.remove();

							// Show UAA reason selection dialog
							const reason = await this.showUAAReasonDialog(username);

							if (reason) {
								// User selected a reason, proceed with report
								const progressBar = new WikiShieldProgressBar();
								progressBar.set("Reporting to UAA...", 0.5, "var(--main-blue)");

								try {
									await wikishield.reportToUAA(username, reason);
									progressBar.set(`Reported ${username} to UAA`, 1, "var(--main-green)");
								} catch (err) {
									progressBar.set("Report failed", 1, "var(--main-red)");
									console.error("UAA report error:", err);
								}

								resolve(false);
							} else {
								// User cancelled, show the welcome dialog again
								const confirmed = await this.showConfirmationDialog(title, message, username);
								resolve(confirmed);
							}
						}, 200);
					});
				}

				// Close on overlay click
				overlay.addEventListener("click", (e) => {
					if (e.target === overlay) {
						closeModal(false);
					}
				});

				// Focus the Yes button by default
				setTimeout(() => yesBtn.focus(), 50);
			});
		}
	}

	class WikiShieldProgressBar {
		constructor() {
			this.element = document.createElement("div");
			this.element.className = "progress-bar"; this.overlay = document.createElement("div");
			this.overlay.className = "progress-bar-overlay";

			this.text = document.createElement("div");
			this.text.className = "progress-bar-text";

			wikishield.interface.elem("#progress-bar-container").appendChild(this.element);
			this.element.appendChild(this.overlay);
			this.element.appendChild(this.text);

			this.nextChangeTime = 0;
		}

		/**
		 * Set the progress bar's text, width, and color; remove after 2s if at 100%
		 * @param {String} text The text to display
		 * @param {Number} width The width of the progress bar
		 * @param {String} color The color of the progress bar
		 */
		set(text, width, color) {
			const delay = Math.max(0, this.nextChangeTime - Date.now());

			window.setTimeout(() => {
				this.text.innerHTML = text;
				this.overlay.style.width = `${Math.round(width * 100)}%`;
				this.overlay.style.background = color;

				if (width === 1) {
					this.remove(2000);
				}
			}, delay);

			this.nextChangeTime = Math.max(Date.now() + 200, this.nextChangeTime + 200);
		}

		/**
		 * Remove the progress bar after a given time
		 * @param {Number} time The time to wait before removing the progress bar
		 */
		remove(time) {
			window.setTimeout(() => {
				this.element.style.opacity = "0";
			}, time - 300);

			window.setTimeout(() => {
				this.element.remove();
			}, time);
		}
	}

	class WikiShield {
		constructor() {
			this.__script__ = __script__;

			this.options = this.loadOptions();
			this.statistics = this.loadStats();
			this.interface = new WikiShieldInterface();
			this.logger = new WikiShieldLog();
			this.util = new WikiShieldUtil();

			// Initialize API with dependencies
			this.api = new WikiShieldAPI(new mw.Api(), {
				testingMode: this.testingMode || false,
				logger: this.logger,
				util: this.util,
				historyCount: __script__.config.historyCount
			});

			// Initialize queue - will be set after wikishield global is assigned
			this.queue = null;

			// Load whitelist and highlighted from storage
			this.whitelist = this.loadWhitelist();
			this.highlighted = this.loadHighlighted();
			this.noAutoWelcomeList = new Set(); // Track users who shouldn't be auto-welcomed

			// Start periodic cleanup of expired highlights (every 30 seconds)
			this.highlightCleanupInterval = setInterval(() => {
				this.cleanupExpiredHighlights();
			}, 30000);

			// Initialize Ollama AI if enabled (preserves last saved state)
			this.ollamaAI = null;
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

			this.aivReports = [];
			this.uaaReports = [];

			this.rights = {
				rollback: false,
				protect: false,
				block: false
			};
			this.username = mw.config.values.wgUserName;
			this.handleLoadingReported();
			this.handleLoadingNotifications();
			this.testingMode = false;
			this.tempCurrentEdit = null;
			this.notifications = [];
			this.lastSeenRevision = null;

			this.wikishieldData = wikishieldData;
			this.WikiShieldProgressBar = WikiShieldProgressBar;
		}

		/**
		 * Create the interface for checking if the user is allowed to use wikishield
		 */
		async startInterface() {
			const userRights = await mw.user.getRights();
			this.rights.rollback = userRights.includes("rollback");
			this.rights.protect = userRights.includes("protect");
			this.rights.block = userRights.includes("block");

			this.interface.build();
			this.handleUpdatingContributions();
		}

		/**
		 * Fetch and display the current user's total contribution count
		 */
		async updateMyContributions() {
			try {
				const result = await this.api.api.get({
					action: "query",
					list: "users",
					ususers: this.username,
					usprop: "editcount"
				});

				if (result.query && result.query.users && result.query.users[0]) {
					const editCount = result.query.users[0].editcount || 0;
					const statElem = document.querySelector("#stat-total-contribs");
					if (statElem) {
						statElem.textContent = editCount.toLocaleString();
					}
				}
			} catch (err) {
				console.log("Failed to fetch user contribution count:", err);
			}
		}

		/**
		 * Start periodic updates of contribution count every 10 seconds
		 */
		handleUpdatingContributions() {
			this.updateMyContributions();

			window.setTimeout(() => {
				this.handleUpdatingContributions();
			}, 10000); // Update every 10 seconds
		}

		/**
		 * Clean up expired highlights and refresh UI if needed
		 */
		cleanupExpiredHighlights() {
			const now = Date.now();
			let needsRefresh = false;

			for (const [username, expirationTime] of this.highlighted.entries()) {
				if (now >= expirationTime) {
					this.highlighted.delete(username);
					needsRefresh = true;
					this.logger.log(`Removed expired highlight for user: ${username}`);
				}
			}

			if (needsRefresh) {
				this.saveHighlighted();
				// Refresh the queue UI to update highlighting
				if (this.queue && this.interface) {
					this.interface.renderQueue(this.queue.queue, this.queue.currentEdit);
				}
			}
		}

		/**
		 * Create the main interface
		 */
		start() {
			this.interface.start();
			this.queue.fetchRecentChanges();
		}

		/**
		 * Load options from storage; if an option is missing, add it with the default value
		 * @returns {Object} The options object
		 */
		loadOptions() {
			let options = {};
			try {
				options = JSON.parse(mw.storage.store.getItem("WikiShield:Settings") || mw.storage.store.getItem("wikishieldSettings")); // TEMP
			} catch (err) { }

			if (!options) {
				options = {};
			}

			for (const item in wikishieldData.defaultSettings) {
				const option = options[item];
				if (typeof option === "undefined" || option === null) {
					options[item] = wikishieldData.defaultSettings[item];
				} else if (typeof option === "object" && !Array.isArray(option)) {
					for (const subitem in wikishieldData.defaultSettings[item]) {
						if (typeof option[subitem] === "undefined") {
							option[subitem] = wikishieldData.defaultSettings[item][subitem];
						}
					}
				}
			}

			for (const item in options.controls) {
				if (typeof options.controls[item] === "string") {
					options.controls[item] = [options.controls[item]];
				}
				const length = options.controls[item].length;
				for (let i = 0; i < length; i++) {
					options.controls[item][i] = options.controls[item][i].toLowerCase();
				}
			}

			this.saveOptions(options);
			return options;
		}

		/**
		 * Save options to storage
		 * @param {Object} options The options object
		 */
		saveOptions(options) {
			mw.storage.store.setItem("WikiShield:Settings", JSON.stringify(options));
		}

		/**
		 * Save whitelist to storage
		 */
		saveWhitelist() {
			const data = [...this.whitelist.entries()]; // Convert Map to array of [key, value] pairs
			mw.storage.store.setItem("WikiShield:Whitelist", JSON.stringify(data));
		}

		/**
		 * Load whitelist from storage
		 * @returns {Map} The whitelist map with timestamps
		 */
		loadWhitelist() {
			try {
				const data = JSON.parse(mw.storage.store.getItem("WikiShield:Whitelist") || mw.storage.store.getItem("wikishieldWhitelist")); // TEMP
				// Support old Set format (array of usernames) and new Map format (array of [username, timestamp])
				if (data && data.length > 0) {
					if (typeof data[0] === 'string') {
						// Old format: convert to Map with current timestamp
						return new Map(data.map(username => [username, Date.now()]));
					} else {
						// New format: already [key, value] pairs
						return new Map(data);
					}
				}
				return new Map();
			} catch (err) {
				return new Map();
			}
		}

		/**
		 * Save highlighted users to storage
		 */
		saveHighlighted() {
			const data = [...this.highlighted.entries()]; // Convert Map to array of [key, value] pairs
			mw.storage.store.setItem("WikiShield:Highlighted", JSON.stringify(data));
		}

		/**
		 * Load highlighted users from storage
		 * @returns {Map} The highlighted map
		 */
		loadHighlighted() {
			try {
				const data = JSON.parse(mw.storage.store.getItem("WikiShield:Highlighted") || mw.storage.store.getItem("wikishieldHighlighted")); // TEMP
				return new Map(data || []);
			} catch (err) {
				return new Map();
			}
		}

		/**
		 * Load the changelog version from storage
		 * @returns {String} The changelog version
		 */
		getChangelogVersion() {
			const version = mw.storage.store.getItem("WikiShield:ChangelogVersion");

			if (!version) {
				mw.storage.store.setItem("WikiShield:ChangelogVersion", 0);
				return 0;
			}

			return version;
		}

		/**
		 * Update changelog version to hide popup
		 */
		updateChangelogVersion() {
			mw.storage.store.setItem("WikiShield:ChangelogVersion", __script__.changelog.version);
		}

		/**
		 * Load statistics from storage
		 * @returns {Object} The statistics object
		 */
		loadStats() {
			let stats;
			try {
				stats = JSON.parse(mw.storage.store.getItem("WikiShield:Statistics") || mw.storage.store.getItem("wikishieldStats")); // TEMP
			} catch (err) { }

			if (!stats) {
				stats = {
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
			}

			// Ensure all properties exist (for backward compatibility)
			if (stats.warnings === undefined) stats.warnings = 0;
			if (stats.welcomes === undefined) stats.welcomes = 0;
			if (stats.whitelisted === undefined) stats.whitelisted = 0;
			if (stats.highlighted === undefined) stats.highlighted = 0;
			if (stats.blocks === undefined) stats.blocks = 0;
			if (stats.sessionStart === undefined) stats.sessionStart = Date.now();

			this.saveStats(stats);
			return stats;
		}

		/**
		 * Save statistics to storage
		 * @param {Object} stats The statistics object
		 */
		saveStats(stats) {
			mw.storage.store.setItem("WikiShield:Statistics", JSON.stringify(stats));
		}

		/**
		 * Revert an edit, using either rollback or manual reverting
		 * @param {Object} edit The edit object
		 * @param {String} message Message to use in the edit summary
		 * @return {Promise<Boolean>} If the rollback succeded
		 */
		async revert(edit, message, goodFaith = false) {
			if (!edit) {
				return;
			}

			const gfStr = goodFaith ? "[[WP:AGF|good faith]] " : "";
			const summary = `Reverted ${gfStr}edits by [[Special:Contributions/${edit.user.name}|${edit.user.name}]] ([[User talk:${edit.user.name}|talk]])${message ? ": " + message : ""} ([[WP:WikiShield|WS]])`;

			if (this.rights.rollback) {
				const result = await this.api.rollback(edit.page.title, edit.user.name, summary);

				if (!result) {
					// Rollback failed - show toast notification
					this.interface.showToast(
						"Revert Failed",
						`Could not revert edits on "${edit.page.title}" - a newer edit may have been made`
					);
					return false;
				}
			} else {
				return false;
			}

			this.statistics.reverts++;
			this.saveStats(this.statistics);
			// Update contribution count after successful revert
			this.updateMyContributions();

			return true;
		}

		/**
		 * Warn a user with the given template
		 * @param {String} user The username to warn
		 * @param {String[]} warningTemplates The warning template set to use
		 * @param {String|Number} warnLevel Level of warning to use; 1-5 or "auto"
		 * @param {String} articleName The article name to use in the warning
		 * @param {Number} revid Edit revid to use in edit summary
		 */
		async warnUser(user, warningObject, warnLevel, articleName, revid) {
			if (!warningObject) {
				return;
			}

			let userTalkContent = await this.api.getSinglePageContent(`User talk:${user}`);
			let warnTemplate = "";

			// Handle manual level selection (not "auto")
			if (warnLevel !== "auto") {
				warnTemplate = warningObject.templates[warnLevel];
			}

			// Handle auto level selection
			if (warnLevel === "auto") {
				const warningLevel = this.queue.getWarningLevel(userTalkContent).toString();

				if (typeof warningObject.auto === "function") {
					warnTemplate = warningObject.templates[warningObject.auto(this.queue.currentEdit)];
				} else {
					warnTemplate = warningObject.templates[warningObject.auto[warningLevel]];
				}
			}

			if (!warnTemplate) {
				return;
			}

			if (!userTalkContent.match("== ?" + wikishield.util.monthSectionName() + " ?==")) {
				userTalkContent += `\n== ${wikishield.util.monthSectionName()} ==\n`;
			}

			const sections = userTalkContent.split(/(?=== ?[\w\d ]+ ?==)/g);

			for (let section in sections) {
				if (sections[section].match(new RegExp("== ?" + wikishield.util.monthSectionName() + " ?=="))) {
					// If articleName is null, template doesn't take a parameter
					sections[section] += `\n\n{{${warnTemplate.template}|${articleName}|${warnTemplate.additional || ""}}} ~~~~`;
					break;
				}
			}

			const newContent = sections.join("")
				.replace(/(\n){3,}/g, "\n\n");

			const levelMatch = warnTemplate.template.match(/(\d(?:im)?)$/);
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
			this.saveStats(this.statistics);

			// Add user talk page to watchlist with configured expiry
			try {
				if (wikishield.options.watchlistExpiry > 0) {
					await this.api.postWithToken("watch", {
						"action": "watch",
						"titles": `User talk:${user}`,
						"expiry": wikishield.options.watchlistExpiry
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
							</div>
						`;
					}).join("");

					// Add click handlers
					listElem.querySelectorAll(".notification-item").forEach(item => {
						item.addEventListener("click", () => {
							const notifId = item.dataset.notifId;
							const notifType = item.dataset.notifType;

							this.markNotificationRead(notifId);

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
				this.saveStats(this.statistics);

				// Update all edits from this user to reflect that the talk page is no longer empty
				// Update tempCurrentEdit if it exists (during script execution)
				if (this.tempCurrentEdit && this.tempCurrentEdit.user && this.tempCurrentEdit.user.name === name) {
					this.tempCurrentEdit.user.emptyTalkPage = false;
				}

				// Update currentEdit
				if (this.queue.currentEdit && this.queue.currentEdit.user.name === name) {
					this.queue.currentEdit.user.emptyTalkPage = false;
				}

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
			this.saveStats(this.statistics);
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
			this.saveStats(this.statistics);
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
			this.saveStats(this.statistics);
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

			if (!this.tempCurrentEdit) {
				for (const script of this.options.controlScripts) {
					if (script.keys.includes(event.key.toLowerCase())) {
						this.executeScript(script);
					}
				}
			}
		}

		/**
		 * Execute a control script
		 * @param {Object} script
		 */
		async executeScript(script, hasContinuity = true, updateProgress = null) {
			const base = updateProgress === null;

			if (base && this.tempCurrentEdit) {
				return;
			}

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

				this.tempCurrentEdit = this.queue.currentEdit || 1;
			}

			const ifAndTrue = script.name && script.name === "if"
				&& wikishieldEventData.conditions[script.condition].check(this.tempCurrentEdit);

			if (ifAndTrue || !script.name) {
				for (const action of script.actions) {
					if (action.name === "if") {
						hasContinuity = this.executeScript(action, hasContinuity, updateProgress);
					} else {
						const event = this.interface.eventManager.events[action.name];

						if (hasContinuity || !event.needsContinuity) {
							if (event.includeInProgress) {
								updateProgress(event.progressDesc);
							}

							if (this.tempCurrentEdit !== 1 || event.runWithoutEdit) {
								const result = await event.func(action.params);

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

			if (base) {
				this.tempCurrentEdit = null;
			}

			return hasContinuity;
		}
	}

	let wikishield;

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
		
		wikishield.startInterface();

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
