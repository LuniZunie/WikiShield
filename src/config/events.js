import { getWarningFromLookup, warningsLookup } from "../data/warnings.js";
import { welcomes } from "../data/welcomes.js";

export const validEvents = {
    toggleZenMode: {
        description: "Toggle Zen Mode",
        icon: "fas fa-spa",
        runWithoutEdit: true,
        func: (wikishield) => {
            wikishield.options.zen.enabled = !wikishield.options.zen.enabled;
            document.querySelector('#zen-mode-enable')?.classList.toggle('active', wikishield.options.zen.enabled);

            wikishield.interface.updateZenModeDisplay(true);
        }
    },

    acceptFlaggedEdit: {
        description: "Accept pending edit",
        icon: "fas fa-check",
        includeInProgress: true,
        runWithoutEdit: false,
        progressDesc: "Accepting...",
        parameters: [
            {
                title: "Reason (optional)",
                id: "reason",
                type: "text"
            }
        ],
        func: async (wikishield, event, currentEdit) => {
            const __FLAGGED__ = wikishield.queue.flaggedRevisions.get(currentEdit.revid);
            if (!__FLAGGED__) {
                return false;
            }

            wikishield.storage.data.statistics.pending_changes_reviewed.accepted++;

            const count = __FLAGGED__.count;
            const countSection = `${count ? `${count} ` : ""} pending edit${count === 1 ? "" : "s"}`;

            const sentenceJoin = (array) => {
                if (array.length === 1) {
                    return array[0];
                } else if (array.length === 2) {
                    return `${array[0]} and ${array[1]}`;
                } else {
                    return `${array.slice(0, -1).join(", ")}, and ${array[array.length - 1]}`;
                }
            };

            const users = Object.entries(__FLAGGED__.users || { }).map(u => [ wikishield.api.buildUser(u[0]), u[1] ]);
            users.sort((a, b) => b[1] - a[1]); // sort by number of edits descending
            const numberOfUsersBeforeOverflow = Math.max(users.reduce((acc, u) => {
                const usernameLen = u[0].length;
                if (acc[0] + usernameLen <= 50) {
                    return [ acc[0] + usernameLen, acc[1] + 1 ];
                }

                return acc;
            }, [ 0, 0 ])[1], 1);

            let userText = "";
            const len = users.length;
            if (len > numberOfUsersBeforeOverflow) {
                const topUsers = users.slice(0, numberOfUsersBeforeOverflow - 1).map(u => u[0]);
                const remaining = len - topUsers.length;
                userText = `${topUsers.join(", ")}, and ${remaining} other${remaining === 1 ? "" : "s"}`;
            } else {
                userText = sentenceJoin(users.map(u => u[0]));
            }

            const message = `Accepted ${countSection} by ${userText}`;
            return await wikishield.api.acceptFlaggedEdit(currentEdit, wikishield.api.buildMessage(message, event.reason));
        }
    },
    rejectFlaggedEdit: {
        description: "Reject pending edit",
        icon: "fas fa-xmark",
        includeInProgress: true,
        runWithoutEdit: false,
        progressDesc: "Rejecting...",
        parameters: [
            {
                title: "Reason (optional)",
                id: "reason",
                type: "text"
            }
        ],
        func: async (wikishield, event, currentEdit) => {
            const __FLAGGED__ = wikishield.queue.flaggedRevisions.get(currentEdit.revid);
            if (!__FLAGGED__) {
                return false;
            }

            wikishield.storage.data.statistics.pending_changes_reviewed.rejected++;

            const count = __FLAGGED__.count;
            const countSection = `${count ? `${count} ` : ""} pending edit${count === 1 ? "" : "s"}`;

            const sentenceJoin = (array) => {
                if (array.length === 1) {
                    return array[0];
                } else if (array.length === 2) {
                    return `${array[0]} and ${array[1]}`;
                } else {
                    return `${array.slice(0, -1).join(", ")}, and ${array[array.length - 1]}`;
                }
            };

            const users = Object.entries(__FLAGGED__.users || { }).map(u => [ wikishield.api.buildUser(u[0]), u[1] ]);
            users.sort((a, b) => b[1] - a[1]); // sort by number of edits descending
            const numberOfUsersBeforeOverflow = Math.max(users.reduce((acc, u) => {
                const usernameLen = u[0].length;
                if (acc[0] + usernameLen <= 50) {
                    return [ acc[0] + usernameLen, acc[1] + 1 ];
                }

                return acc;
            }, [ 0, 0 ])[1], 1);

            let userText = "";
            const len = users.length;
            if (len > numberOfUsersBeforeOverflow) {
                const topUsers = users.slice(0, numberOfUsersBeforeOverflow - 1).map(u => u[0]);
                const remaining = len - topUsers.length;
                userText = `${topUsers.join(", ")}, and ${remaining} other${remaining === 1 ? "" : "s"}`;
            } else {
                userText = sentenceJoin(users.map(u => u[0]));
            }

            const message = `Rejected ${countSection} by ${userText} to [[Special:Diff/${__FLAGGED__.priorRevid}|last stable revision]]`;
            return await wikishield.api.rejectFlaggedEdit(currentEdit, wikishield.api.buildMessage(message, event.reason), __FLAGGED__.priorRevid);
        }
    },

    prevEdit: {
        description: "Go to the previous edit in the queue",
        icon: "fas fa-arrow-left",
        runWithoutEdit: true,
        func: (wikishield) => {
            wikishield.queue.prevItem();

            return true;
        }
    },
    nextEdit: {
        description: "Go to the next edit in the queue",
        icon: "fas fa-arrow-right",
        func: (wikishield) => {
            wikishield.queue.nextItem();

            return true;
        }
    },
    deleteQueue: {
        description: "Remove all items from the queue",
        icon: "fas fa-trash-can",
        runWithoutEdit: true,
        func: (wikishield) => {
            wikishield.queue.delete();

            return true;
        }
    },
    openRevertMenu: {
        description: "Toggle the revert & warn menu",
        icon: "fas fa-undo",
        runWithoutEdit: true,
        func: (wikishield) => {
            const menuItem = document.querySelector('[data-menu="revert"]');

            const revertMenu = wikishield.interface.elem("#revert-menu");
            revertMenu.innerHTML = "";
            wikishield.interface.createRevertMenu(revertMenu, wikishield.queue.currentEdit[wikishield.queue.currentQueueTab]);

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
        func: (wikishield) => {
            const menuItem = document.querySelector('[data-menu="warn"]');

            const warnMenu = wikishield.interface.elem("#warn-menu");
            warnMenu.innerHTML = "";
            wikishield.interface.createWarnMenu(warnMenu, wikishield.queue.currentEdit[wikishield.queue.currentQueueTab]);

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
        func: (wikishield) => {
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
        func: (wikishield) => {
            wikishield.interface.settings.openSettings();

            return true;
        }
    },
    openUserPage: {
        description: "Open user page in a new tab",
        icon: "fas fa-circle-user",
        func: (wikishield, event, currentEdit) => {
            const username = currentEdit.user.name;
            const url = wikishield.util.pageLink(`User:${username}`);
            window.open(url, "_blank");

            return true;
        }
    },
    openUserTalk: {
        description: "Open user talk page in a new tab",
        icon: "fas fa-comment",
        func: (wikishield, event, currentEdit) => {
            const username = currentEdit.user.name;
            const url = wikishield.util.pageLink(`User talk:${username}`);
            window.open(url, "_blank");

            return true;
        }
    },
    openUserContribs: {
        description: "Open user contributions page in a new tab",
        icon: "fas fa-list",
        func: (wikishield, event, currentEdit) => {
            const username = currentEdit.user.name;
            const url = wikishield.util.pageLink(`Special:Contributions/${username}`);
            window.open(url, "_blank");

            return true;
        }
    },
    openFilterLog: {
        description: "Open user filter log in a new tab",
        icon: "fas fa-filter",
        func: (wikishield, event, currentEdit) => {
            const encodedName = wikishield.util.encodeuri(currentEdit.user.name);
            const url = wikishield.util.pageLink(
                `?title=Special:AbuseLog&wpSearchUser=${encodedName}`,
                true
            );
            const username = currentEdit.user.name;
            window.open(url, "_blank");

            return true;
        }
    },

    switchToRecentQueue: {
        description: "Switch to recent edits queue",
        icon: "fas fa-stopwatch",
        runWithoutEdit: true,
        func: (wikishield) => {
            wikishield.queue.switchQueueTab("recent");
            return true;
        }
    },
    switchToFlaggedQueue: {
        description: "Switch to flagged revisions queue",
        icon: "fas fa-flag",
        runWithoutEdit: true,
        func: (wikishield) => {
            wikishield.queue.switchQueueTab("flagged");
            return true;
        }
    },
    switchToWatchlistQueue: {
        description: "Switch to watchlist queue",
        icon: "fas fa-eye",
        runWithoutEdit: true,
        func: (wikishield) => {
            wikishield.queue.switchQueueTab("watchlist");
            return true;
        }
    },

    whitelistUser: {
        description: "Add user to the whitelist",
        icon: "fas fa-check",
        includeInProgress: true,
        progressDesc: "Whitelisting...",
        func: (wikishield, event, currentEdit) => {
            const username = currentEdit.user.name;

            const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.storage.data.settings.expiry.whitelist.users);

            const now = Date.now();
            wikishield.storage.data.whitelist.users.set(username, [ now, now + expiryMs ]);

            wikishield.storage.data.statistics.items_whitelisted.total++;
            wikishield.storage.data.statistics.items_whitelisted.users++;

            // Refresh the interface to update button text
            wikishield.interface.renderQueue(wikishield.queue.queue[wikishield.queue.currentQueueTab], wikishield.queue.currentEdit[wikishield.queue.currentQueueTab]);
            return true;
        }
    },
    whitelistPage: {
        description: "Add page to the whitelist",
        icon: "fas fa-check",
        includeInProgress: true,
        progressDesc: "Whitelisting...",
        func: (wikishield, event, currentEdit) => {
            const pageTitle = currentEdit.page.title;

            const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.storage.data.settings.expiry.whitelist.pages);

            const now = Date.now();
            wikishield.storage.data.whitelist.pages.set(pageTitle, [ now, now + expiryMs ]);

            wikishield.storage.data.statistics.items_whitelisted.total++;
            wikishield.storage.data.statistics.items_whitelisted.pages++;

            // Refresh the interface to update button text
            wikishield.interface.renderQueue(wikishield.queue.queue[wikishield.queue.currentQueueTab], wikishield.queue.currentEdit[wikishield.queue.currentQueueTab]);
            return true;
        }
    },

    unwhitelistUser: {
        description: "Remove user from the whitelist",
        icon: "fas fa-xmark",
        includeInProgress: true,
        progressDesc: "Unwhitelisting...",
        func: (wikishield, event, currentEdit) => {
            const username = currentEdit.user.name;

            // Toggle whitelist status
            wikishield.storage.data.whitelist.users.delete(username);

            // Refresh the interface to update button text
            wikishield.interface.renderQueue(wikishield.queue.queue[wikishield.queue.currentQueueTab], wikishield.queue.currentEdit[wikishield.queue.currentQueueTab]);
            return true;
        }
    },
    unwhitelistPage: {
        description: "Remove page from the whitelist",
        icon: "fas fa-xmark",
        includeInProgress: true,
        progressDesc: "Unwhitelisting...",
        func: (wikishield, event, currentEdit) => {
            const pageTitle = currentEdit.page.title;

            // Toggle whitelist status
            wikishield.storage.data.whitelist.pages.delete(pageTitle);

            // Refresh the interface to update button text
            wikishield.interface.renderQueue(wikishield.queue.queue[wikishield.queue.currentQueueTab], wikishield.queue.currentEdit[wikishield.queue.currentQueueTab]);
            return true;
        }
    },

    highlightUser: {
        description: "Highlight this user's contributions",
        icon: "fas fa-star",
        includeInProgress: true,
        progressDesc: "Highlighting...",
        func: (wikishield, event, currentEdit) => {
            const username = currentEdit.user.name;

            // Set highlight to expire based on user setting
            const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.storage.data.settings.expiry.highlight.users);

            const now = Date.now();
            wikishield.storage.data.highlight.users.set(username, [ now, now + expiryMs ]);

            wikishield.storage.data.statistics.items_highlighted.total++;
            wikishield.storage.data.statistics.items_highlighted.users++;

            // Trigger immediate UI refresh
            wikishield.interface.renderQueue(wikishield.queue.queue[wikishield.queue.currentQueueTab], wikishield.queue.currentEdit[wikishield.queue.currentQueueTab]);
            return true;
        }
    },
    highlightPage: {
        description: "Highlight this page's contributions",
        icon: "fas fa-star",
        includeInProgress: true,
        progressDesc: "Highlighting...",
        func: (wikishield, event, currentEdit) => {
            const pageTitle = currentEdit.page.title;

            // Set highlight to expire based on user setting
            const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.storage.data.settings.expiry.highlight.pages);

            const now = Date.now();
            wikishield.storage.data.highlight.pages.set(pageTitle, [ now, now + expiryMs ]);

            wikishield.storage.data.statistics.items_highlighted.total++;
            wikishield.storage.data.statistics.items_highlighted.pages++;

            // Trigger immediate UI refresh
            wikishield.interface.renderQueue(wikishield.queue.queue[wikishield.queue.currentQueueTab], wikishield.queue.currentEdit[wikishield.queue.currentQueueTab]);
            return true;
        }
    },

    unhighlightUser: {
        description: "Unhighlight this user's contributions",
        icon: "fas fa-star",
        includeInProgress: true,
        progressDesc: "Unhighlight...",
        func: (wikishield, event, currentEdit) => {
            const username = currentEdit.user.name;

            wikishield.storage.data.highlight.users.delete(username);

            // Trigger immediate UI refresh
            wikishield.interface.renderQueue(wikishield.queue.queue[wikishield.queue.currentQueueTab], wikishield.queue.currentEdit[wikishield.queue.currentQueueTab]);
            return true;
        }
    },
    unhighlightPage: {
        description: "Unhighlight this page's contributions",
        icon: "fas fa-star",
        includeInProgress: true,
        progressDesc: "Unhighlight...",
        func: (wikishield, event, currentEdit) => {
            const pageTitle = currentEdit.page.title;

            wikishield.storage.data.highlight.pages.delete(pageTitle);

            // Trigger immediate UI refresh
            wikishield.interface.renderQueue(wikishield.queue.queue[wikishield.queue.currentQueueTab], wikishield.queue.currentEdit[wikishield.queue.currentQueueTab]);
            return true;
        }
    },

    openPage: {
        description: "Open page being edited in new tab",
        icon: "fas fa-file",
        func: (wikishield, event, currentEdit) => {
            const page = currentEdit.page;
            const url = wikishield.util.pageLink(page.title);
            window.open(url, "_blank");

            return true;
        }
    },
    openTalk: {
        description: "Open talk page in new tab",
        icon: "fas fa-comments",
        func: (wikishield, event, currentEdit) => {
            const pageTitle = currentEdit.page.title.split(":");
            let talkNamespace = "Talk";
            if (pageTitle.length > 1) {
                talkNamespace = pageTitle[0].toLowerCase().includes("talk")
                ? pageTitle[0]
                : pageTitle[0] + " talk";
            }
            const talkTitle = `${talkNamespace}:${pageTitle.length === 1 ? pageTitle[0] : pageTitle[1]}`;
            const url = wikishield.util.pageLink(talkTitle);
            window.open(url, "_blank");

            return true;
        }
    },
    openHistory: {
        description: "Open page history in new tab",
        icon: "fas fa-clock-rotate-left",
        func: (wikishield, event, currentEdit) => {

            const page = currentEdit.page;
            const url = wikishield.util.pageLink(`Special:PageHistory/${page.title}`);
            window.open(url, "_blank");

            return true;
        }
    },
    openRevision: {
        description: "Open revision in new tab",
        icon: "fas fa-eye",
        func: (wikishield, event, currentEdit) => {
            const revid = currentEdit.revid;
            const url = wikishield.util.pageLink(`Special:PermanentLink/${revid}`);
            window.open(url, "_blank");

            return true;
        }
    },
    openDiff: {
        description: "Open diff in new tab",
        icon: "fas fa-code-compare",
        func: (wikishield, event, currentEdit) => {
            const revid = currentEdit.revid;
            const url = wikishield.util.pageLink(`Special:Diff/${revid}`);
            window.open(url, "_blank");

            return true;
        }
    },

    thankUser: {
        description: "Thank user",
        icon: "fas fa-heart",
        includeInProgress: true,
        progressDesc: "Thanking...",
        func: async (wikishield, event, currentEdit) => {
            wikishield.storage.data.statistics.edits_reviewed.thanked++;

            const message = `Thank you for [[Special:Diff/${currentEdit.revid}|your edit]] to [[${currentEdit.page.title}]]!`;
            if (mw.util.isTemporaryUser(currentEdit.user.name)) {
                await wikishield.api.thank(currentEdit.revid);

                const talkPageName = `User talk:${currentEdit.user.name}`;
                if (await wikishield.api.pageExists(talkPageName) === false) { // if talk page doesn't exist, we can use the welcome, thanks template =)
                    await wikishield.api.newSection(talkPageName, "Thank you!", `{{subst:Thanks-autosign}}`, wikishield.api.buildMessage(message));
                }
            } else if (mw.util.isIPAddress(currentEdit.user.name)) {
                const talkPageName = `User talk:${currentEdit.user.name}`;
                await wikishield.api.newSection(talkPageName, "Thank you!", `{{subst:Thanks-autosign}}`, wikishield.api.buildMessage(message));
            } else {
                await wikishield.api.thank(currentEdit.revid);
            }

            return true;
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
                options: Object.keys(warningsLookup),
                showOption: (wikishield, optionKey) => {
                    const warning = getWarningFromLookup(optionKey);
                    return warning && !warning.hide;
                },
            },
            {
                title: "Level",
                id: "level",
                type: "choice",
                options: ["auto", "0", "1", "2", "3", "4", "4im"],
            }
        ],
        includeInProgress: true,
        progressDesc: "Warning...",
        needsContinuity: true,
        validateParameters: (wikishield, params, currentEdit) => {
            return params.level === "auto" || getWarningFromLookup(params.warningType)?.templates[params.level] !== null;
        },
        func: async (wikishield, params, currentEdit) => {
            const warning = getWarningFromLookup(params.warningType);

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
        parameters: [
            {
                title: "Summary (optional)",
                id: "summary",
                type: "text"
            }
        ],
        includeInProgress: true,
        progressDesc: "Rolling back...",
        func: async (wikishield, params, currentEdit) => {
            return await wikishield.revert(currentEdit, params.summary || "", false);
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
        func: async (wikishield, params, currentEdit) => {
            return await wikishield.revert(currentEdit, params.summary || "", true);
        }
    },
    undo: {
        description: "Undo this edit only",
        icon: "fas fa-undo",
        parameters: [
            {
                title: "Reason (optional)",
                id: "reason",
                type: "text"
            }
        ],
        includeInProgress: true,
        progressDesc: "Undoing...",
        func: async (wikishield, params, currentEdit) => {
            const message = `Undid revision [[Special:Diff/${currentEdit.revid}|${currentEdit.revid}]] by ${wikishield.api.buildUser(currentEdit.user.name)}`;
            return await wikishield.api.undoEdit(currentEdit, wikishield.api.buildMessage(message, params.reason));
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
                ],
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
        func: async (wikishield, params, currentEdit) => {
            const reason = params.comment ? `${params.reportMessage}: ${params.comment}` : params.reportMessage;
            await wikishield.reportToAIV(
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
                ],
            },
            {
                title: "Comment (optional)",
                id: "comment",
                type: "text",
            }
        ],
        includeInProgress: true,
        progressDesc: "Reporting...",
        func: async (wikishield, params, currentEdit) => {
            if (mw.util.isTemporaryUser(currentEdit.user.name) || mw.util.isIPAddress(currentEdit.user.name)) {
                if (wikishield.interface.showToast(
                    "Report Failed",
                    `Can not file a report for a temporary account or an IP address (${currentEdit.user.name})`,
                    5000,
                    "error"
                )) {
                    wikishield.audioManager.playSound([ "other", "error" ]);
                }

                return false;
            }

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
        icon: "fas fa-shield-halved",
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
                ],
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
                ],
            },
            {
                title: "Comment (optional)",
                id: "comment",
                type: "text",
            }
        ],
        includeInProgress: true,
        progressDesc: "Requesting protection...",
        func: async (wikishield, params, currentEdit) => {
            const reason = params.comment ? `${params.reason}: ${params.comment}` : params.reason;
            await wikishield.requestProtection(
                currentEdit.page.title,
                params.level,
                reason
            );

            return true;
        }
    },
    block: { // TODO
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
        func: async (wikishield, params, currentEdit) => {
            const success = await wikishield.api.block(
                currentEdit.user.name,
                params.blockSummary,
                params.duration,
                true, false, false, true
            );
            if (success) {
                wikishield.storage.data.statistics.blocks_issued.total++;
                wikishield.audioManager.playSound([ "action", "block" ]);
            }

            return success;
        }
    },
    protect: { // TODO
        description: "Protect page",
        icon: "fas fa-lock",
        includeInProgress: true,
        progressDesc: "Protecting...",
        func: async () => {
            const success = false;
            if (success) {
                wikishield.storage.data.statistics.pages_protected.total++;
                wikishield.audioManager.playSound([ "action", "protect" ]);
            }

            return true;
        }
    },
    welcome: {
        description: "Welcome user",
        icon: "fas fa-paper-plane",
        parameters: [
            {
                title: "Template",
                id: "template",
                type: "choice",
                options: Object.keys(welcomes),
                showOption: (wikishield, optionKey) => {
                    const welcome = welcomes[optionKey];
                    return !welcome.hide;
                }
            }
        ],
        includeInProgress: true,
        progressDesc: "Welcoming...",
        func: async (wikishield, params, currentEdit) => {
            await wikishield.welcomeUser(
                currentEdit.user,
                params.template
            );

            return true;
        }
    },
    toggleConsecutive: {
        description: "Toggle consecutive edits",
        icon: "fas fa-users",
        parameters: [],
        func: async (wikishield, params, currentEdit) => {
            const latestEdits = document.querySelector("#latest-edits-tab");
            const consecutiveEdits = document.querySelector("#consecutive-edits-tab");

            if (!consecutiveEdits.classList.contains("hidden")) {
                if (consecutiveEdits.classList.contains("selected")) {
                    latestEdits.click();
                } else {
                    consecutiveEdits.click();
                }
            }

            return true;
        }
    }
};

export const validConditions = {
	"operatorNonAdmin": {
		desc: "You are not an admin",
		check: (wikishield) => !wikishield.rights.block
	},
	"operatorAdmin": {
		desc: "You are an admin",
		check: (wikishield) => wikishield.rights.block
	},
	"userIshighlight": {
		desc: "User is highlight",
		check: (wikishield, edit) => wikishield.storage.data.highlight.users.has(edit.user.name)
	},
	"pageIshighlight": {
		desc: "Page is highlight",
		check: (wikishield, edit) => wikishield.storage.data.highlight.pages.has(edit.page.title)
	},
	"userIsWhitelisted": {
		desc: "User is whitelisted",
		check: (wikishield, edit) => wikishield.storage.data.whitelist.users.has(edit.user.name)
	},
	"pageIsWhitelisted": {
		desc: "Page is whitelisted",
		check: (wikishield, edit) => wikishield.storage.data.whitelist.pages.has(edit.page.title)
	},
	"userIsAnon": {
		desc: "User is anonymous (temporary account)",
		check: (wikishield, edit) => mw.util.isTemporaryUser(edit.user.name) || mw.util.isIPAddress(edit.user.name)
	},
    "userIsIP": {
        desc: "User is an IP address",
        check: (wikishield, edit) => mw.util.isIPAddress(edit.user.name)
    },
    "userIsTemp": {
        desc: "User is a temporary account",
        check: (wikishield, edit) => mw.util.isTemporaryUser(edit.user.name)
    },
	"userIsRegistered": {
		desc: "User is registered (not temporary account)",
		check: (wikishield, edit) => !(mw.util.isTemporaryUser(edit.user.name) || mw.util.isIPAddress(edit.user.name))
	},
	"userHasEmptyTalkPage": {
		desc: "User has an empty talk page",
		check: (wikishield, edit) => edit.user.emptyTalkPage
	},
	"editIsMinor": {
		desc: "Edit is marked as minor",
		check: (wikishield, edit) => edit.minor
	},
	"editIsMajor": {
		desc: "Edit is not marked as minor",
		check: (wikishield, edit) => !edit.minor
	},
	"editSizeNegative": {
		desc: "Edit removes content (negative bytes)",
		check: (wikishield, edit) => (edit.sizediff || 0) < 0
	},
	"editSizePositive": {
		desc: "Edit adds content (positive bytes)",
		check: (wikishield, edit) => (edit.sizediff || 0) > 0
	},
	"editSizeLarge": {
		desc: "Edit is large (>1000 bytes change)",
		check: (wikishield, edit) => Math.abs(edit.sizediff || 0) > 1000
	},
	"userEditCountLow": {
		desc: "User has less than 10 edits",
		check: (wikishield, edit) => edit.user.editCount < 10 && edit.user.editCount >= 0
	},
	"userEditCountHigh": {
		desc: "User has 100 or more edits",
		check: (wikishield, edit) => edit.user.editCount >= 100
	},
	"atFinalWarning": {
		desc: "User already has a final warning (before any new warnings)",
		check: (wikishield, edit) => {
			const original = edit.user.warningLevel.toString() || "0";
			const result = ["4", "4im"].includes(original);
			return result;
		}
	},
	"userHasWarnings": {
		desc: "User has received warnings (level 1+)",
		check: (wikishield, edit) => {
			const level = edit.user.warningLevel?.toString() || "0";
			return !["0", ""].includes(level);
		}
	},
	"userNoWarnings": {
		desc: "User has no warnings (level 0)",
		check: (wikishield, edit) => {
			const level = edit.user.warningLevel?.toString() || "0";
			return ["0", ""].includes(level);
		}
	}
};