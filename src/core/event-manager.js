/**
 * WikiShieldEventManager - Manages user interface events and actions
 * Handles all user-triggered events like reverting, warning, reporting, etc.
 */
import { warnings, getWarningFromLookup, warningsLookup } from '../data/warnings.js';

export class WikiShieldEventManager {
	constructor(wikishield) {
		this.wikishield = wikishield;

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
		const wikishield = this.wikishield;

		this.events = {
			prevEdit: {
				description: "Go to the previous edit in the queue",
				icon: "fas fa-arrow-left",
				runWithoutEdit: true,
				func: () => {
					wikishield.queue.prevItem();

					return true;
				}
			},
			nextEdit: {
				description: "Go to the next edit in the queue",
				icon: "fas fa-arrow-right",
				func: () => {
					wikishield.queue.nextItem();

					return true;
				}
			},
			deleteQueue: {
				description: "Remove all items from the queue",
				icon: "fas fa-trash-can",
				runWithoutEdit: true,
				func: () => {
					wikishield.queue.delete();

					return true;
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

					return true;
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

					return true;
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

					return true;
				}
			},
			openSettings: {
				description: "Open the settings interface",
				icon: "fas fa-gear",
				runWithoutEdit: true,
				func: () => {
					wikishield.interface.settings.openSettings();

					return true;
				}
			},
			openUserPage: {
				description: "Open user page in a new tab",
				icon: "fas fa-circle-user",
				func: (event, currentEdit) => {
					const username = currentEdit.user.name;
					const url = wikishield.util.pageLink(`User:${username}`);
					this.openWikipediaLink(url, `User:${username}`, event);

					return true;
				}
			},
			openUserTalk: {
				description: "Open user talk page in a new tab",
				icon: "fas fa-comment",
				func: (event, currentEdit) => {
					const username = currentEdit.user.name;
					const url = wikishield.util.pageLink(`User talk:${username}`);
					this.openWikipediaLink(url, `User talk:${username}`, event);

					return true;
				}
			},
			openUserContribs: {
				description: "Open user contributions page in a new tab",
				icon: "fas fa-list",
				func: (event, currentEdit) => {
					const username = currentEdit.user.name;
					const url = wikishield.util.pageLink(`Special:Contributions/${username}`);
					this.openWikipediaLink(url, `Contributions: ${username}`, event);

					return true;
				}
			},
			openFilterLog: {
				description: "Open user filter log in a new tab",
				icon: "fas fa-filter",
				func: (event, currentEdit) => {
					const encodedName = wikishield.util.encodeuri(currentEdit.user.name);
					const url = wikishield.util.pageLink(
						`?title=Special:AbuseLog&wpSearchUser=${encodedName}`,
						true
					);
					const username = currentEdit.user.name;
					this.openWikipediaLink(url, `Filter Log: ${username}`, event);

					return true;
				}
			},
			addToWhitelist: {
				description: "Add user to the whitelist",
				icon: "fas fa-thumbs-up",
				includeInProgress: true,
				progressDesc: "Whitelisting...",
				func: (event, currentEdit) => {
					wikishield.queue.playSparkleSound();
					const username = currentEdit.user.name;

					// Toggle whitelist status
					if (wikishield.whitelist.has(username)) {
						wikishield.whitelist.delete(username);
						wikishield.logger.log(`Removed ${username} from whitelist`);
					} else {
						wikishield.whitelist.set(username, Date.now());
						wikishield.statistics.whitelisted++;
						wikishield.logger.log(`Added ${username} to whitelist`);
					}

					// Refresh the interface to update button text
					wikishield.interface.renderQueue(wikishield.queue.queue, wikishield.queue.currentEdit);

					return true;
				}
			},
			highlight: {
				description: "Highlight this user's contributions",
				icon: "fas fa-highlighter",
				includeInProgress: true,
				progressDesc: "Highlighting...",
				func: (event, currentEdit) => {
					wikishield.queue.playSparkleSound();
					const username = currentEdit.user.name;

					// Toggle highlight status
					if (wikishield.highlighted.has(username)) {
						wikishield.highlighted.delete(username);
						wikishield.logger.log(`Removed highlight from ${username}`);
					} else {
						// Set highlight to expire based on user setting
						const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.options.highlightedExpiry);
						const expirationTime = Date.now() + expiryMs;
						wikishield.highlighted.set(username, expirationTime);
						wikishield.statistics.highlighted++;
						wikishield.logger.log(`Highlighted user ${username} until ${new Date(expirationTime).toLocaleString()}`);
					}

					// Trigger immediate UI refresh
					wikishield.interface.renderQueue(wikishield.queue.queue, wikishield.queue.currentEdit);

					return true;
				}
			},
			openPage: {
				description: "Open page being edited in new tab",
				icon: "fas fa-file-lines",
				func: (event, currentEdit) => {
					const page = currentEdit.page;
					const url = wikishield.util.pageLink(page.title);
					this.openWikipediaLink(url, page.title, event);

					return true;
				}
			},
			openTalk: {
				description: "Open talk page in new tab",
				icon: "fas fa-comments",
				func: (event, currentEdit) => {
					const pageTitle = currentEdit.page.title.split(":");
					let talkNamespace = "Talk";
					if (pageTitle.length > 1) {
						talkNamespace = pageTitle[0].toLowerCase().includes("talk")
							? pageTitle[0]
							: pageTitle[0] + " talk";
					}
					const talkTitle = `${talkNamespace}:${pageTitle.length === 1 ? pageTitle[0] : pageTitle[1]}`;
					const url = wikishield.util.pageLink(talkTitle);
					this.openWikipediaLink(url, talkTitle, event);

					return true;
				}
			},
			openHistory: {
				description: "Open page history in new tab",
				icon: "fas fa-clock-rotate-left",
				func: (event, currentEdit) => {
					const page = currentEdit.page;
					const url = wikishield.util.pageLink(`Special:PageHistory/${page.title}`);
					this.openWikipediaLink(url, `History: ${page.title}`, event);

					return true;
				}
			},
			openRevision: {
				description: "Open revision in new tab",
				icon: "fas fa-pen-to-square",
				func: (event, currentEdit) => {
					const revid = currentEdit.revid;
					const url = wikishield.util.pageLink(`Special:PermanentLink/${revid}`);
					this.openWikipediaLink(url, `Revision ${revid}`, event);

					return true;
				}
			},
			openDiff: {
				description: "Open diff in new tab",
				icon: "fas fa-code-commit",
				func: (event, currentEdit) => {
					const revid = currentEdit.revid;
					const url = wikishield.util.pageLink(`Special:Diff/${revid}`);
					this.openWikipediaLink(url, `Diff ${revid}`, event);

					return true;
				}
			},
			thankUser: {
				description: "Thank user",
				icon: "fas fa-user-check",
				includeInProgress: true,
				progressDesc: "Thanking...",
				func: async (event, currentEdit) => {
					wikishield.queue.playThankSound();

					// Check if user is an TEMP
					if (mw.util.isTemporaryUser(currentEdit.user.name)) {
						// For TEMP users, leave a thank you message on their talk page
						const talkPageName = `User talk:${currentEdit.user.name}`;
						const talkPageContent = await wikishield.api.getSinglePageContent(talkPageName) || "";

						await wikishield.api.edit(
							talkPageName,
							talkPageContent + `\n{{subst:Thanks-autosign}}`,
							`Thanking for edit to [[${currentEdit.page.title}]] ([[WP:WikiShield|WS]])`
						);

						return true;
					} else {
						// For registered users, use the API thank function
						await wikishield.api.thank(currentEdit.revid);

						return true;
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
						options: Object.keys(warningsLookup)
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
				validateParameters: (params, currentEdit) => {
					// If custom templates are provided, skip validation
					if (params.warningTemplates) {
						return true;
					}

					return params.level === "auto" || getWarningFromLookup(params.warningType)?.templates[params.level] !== null;
				},
				func: async (params, currentEdit) => {
					wikishield.queue.playWarnSound();

					const warning = getWarningFromLookup(params.warningType);

					// Store the original warning level before warning
					const originalLevel = currentEdit.user.warningLevel;
					currentEdit.user.atFinalWarning = (warning?.auto?.[originalLevel.toString()] === "report");

					return await wikishield.warnUser(
						currentEdit.user.name,
						warning,
						params.level || "auto",
						currentEdit.page.title,
						currentEdit.revid
					);
				}
			},
			rollback: {
				description: "Rollback edits",
				icon: "fas fa-backward",
				includeInProgress: true,
				progressDesc: "Rolling back...",
				func: async (params = {}, currentEdit) => {
					wikishield.queue.playRollbackSound();
					return await wikishield.revert(currentEdit, params.label || "");
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
				func: async (params, currentEdit) => {
					wikishield.queue.playRollbackSound();
					return await wikishield.revert(currentEdit, params.summary || "", true);
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
				func: async (params, currentEdit) => {
					wikishield.queue.playRollbackSound();
					return await wikishield.api.undoEdit(currentEdit, params.reason || `Undid edit by ${currentEdit.user.name} ([[WP:WikiShield|WS]])`);
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
					},
					{
						title: "Comment (optional)",
						id: "comment",
						type: "text",
					}
				],
				includeInProgress: true,
				needsContinuity: true,
				progressDesc: "Reporting...",
				func: async (params, currentEdit) => {
					wikishield.queue.playReportSound();

					const reason = params.comment ? `${params.reportMessage}: ${params.comment}` : params.reportMessage;
					await wikishield.reportToUAA(
						currentEdit.user.name,
						reason
					);

					return true;
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
					},
					{
						title: "Comment (optional)",
						id: "comment",
						type: "text",
					}
				],
				includeInProgress: true,
				progressDesc: "Reporting...",
				func: async (params, currentEdit) => {
					wikishield.queue.playReportSound();

					const reason = params.comment ? `${params.reportMessage}: ${params.comment}` : params.reportMessage;
					await wikishield.reportToUAA(
						currentEdit.user.name,
						reason
					);

					return true;
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
							"Sockpuppetry",
							"Arbitration enforcement"
						]
					},
					{
						title: "Comment (optional)",
						id: "comment",
						type: "text",
					}
				],
				includeInProgress: true,
				progressDesc: "Requesting protection...",
				func: async (params, currentEdit) => {
					wikishield.queue.playProtectionSound();

					const reason = params.comment ? `${params.reason}: ${params.comment}` : params.reason;
					await wikishield.requestProtection(
						currentEdit.page.title,
						params.level,
						reason
					);

					return true;
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
				func: async (params, currentEdit) => {
					wikishield.queue.playBlockSound();
					const success = await wikishield.api.block(
						currentEdit.user.name,
						params.blockSummary,
						params.duration,
						true, false, false, true
					);
					if (success) {
						wikishield.statistics.blocks++;
					}

					return true;
				}
			},
			protect: {
				description: "Protect page",
				icon: "fas fa-lock",
				includeInProgress: true,
				progressDesc: "Protecting...",
				func: async () => {
					wikishield.queue.playProtectionSound();

					return true;
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
				func: async (params, currentEdit) => {
					wikishield.queue.playSparkleSound();
					await wikishield.welcomeUser(
						currentEdit.user.name,
						params.template
					);

				currentEdit.user.emptyTalkPage = false;

				return true;
			}
		}
	};

	// Merge the eventData (conditions, welcomeTemplates, etc.) into this.events
	if (eventData) {
		Object.assign(this.events, eventData);
	}
}

	/**
	 * When a button is clicked, trigger the given event
	 * @param {HTMLElement} elem Button to add listener to
	 * @param {String} event Event to trigger
	 * @param {Boolean} runWithoutEdit Whether this event can be run with no edit selected
	 */
	linkButton(elem, event, runWithoutEdit) {
		const wikishield = this.wikishield;

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
