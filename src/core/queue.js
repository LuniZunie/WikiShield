/**
 * WikiShieldQueue - Edit queue management
 * Manages the queue of edits to review and provides queue operations
 */
export class WikiShieldQueue {
	constructor(wikishield) {
		this.wikishield = wikishield;
		this.queue = [];
		this.previousItems = [];
		this.editsSince = "";
		this.lastRevid = 0;
		this.currentEdit = null;
		this.backoff = 2000;
	}

	/**
	 * Fetch recent changes from the API
	 */
	async fetchRecentChanges() {
		if (this.queue.length >= this.wikishield.options.maxQueueSize) {
			window.setTimeout(this.fetchRecentChanges.bind(this), this.wikishield.__script__.config.refresh);
			return;
		}

		try {
			this.editsSince = this.wikishield.util.utcString(new Date());

			const namespaceString = this.wikishield.options.namespacesShown.join("|");
			const recentChanges = (await this.wikishield.api.recentChanges(namespaceString))
				.filter(edit => edit.revid > this.lastRevid);

			this.lastRevid = Math.max(...recentChanges.map(edit => edit.revid));

			// remove outdated edits
			for (const recentChange of recentChanges) {
				const itemsToRemove = [];
				for (const queueItem of this.queue) {
					// Skip the currently selected edit
					if (this.currentEdit && queueItem.revid === this.currentEdit.revid) {
						continue;
					}
					// Remove if same page and older revision
					if (queueItem.page.title === recentChange.title && queueItem.revid < recentChange.revid) {
						itemsToRemove.push(queueItem);
					}
				}

				// Remove the outdated items
				for (const oldItem of itemsToRemove) {
					const index = this.queue.indexOf(oldItem);
					if (index > -1) {
						this.queue.splice(index, 1);
						this.wikishield.interface.removeQueueItem(oldItem.revid);
					}
				}
			}

			const usersToFetch = recentChanges.reduce((str, edit) => str + (str === "" ? "" : "|") + edit.user, "");
			const editCounts = (await this.wikishield.api.editCount(usersToFetch))
				.filter(user => user.invalid || user.editcount <= this.wikishield.options.maxEditCount);

			const dict = editCounts
				.reduce((a, v) => ({ ...a, [v.name]: v.editcount }), {});

			const warnings = (await this.wikishield.api.getText(
				recentChanges.reduce((str, edit) => str + (str === "" ? "" : "|") + `User_talk:${edit.user}`, "")
			));

			const blocks = await this.wikishield.api.usersBlocked(usersToFetch);

			const ores = (await this.wikishield.api.ores(recentChanges.reduce((str, edit) => str + (str === "" ? "" : "|") + edit.revid, "")));

			recentChanges
				.filter(edit => edit.user in dict)
				.filter(edit => (ores[edit.revid] || 0) >= this.wikishield.options.minimumORESScore || this.wikishield.highlighted.has(edit.user))
				.filter(edit => !this.wikishield.whitelist.has(edit.user))
				.forEach(async edit => {
					const talkPageText = warnings[`User talk:${edit.user}`] || "";

					this.addQueueItem(
						edit,
						dict[edit.user] || -1,
						this.getWarningLevel(talkPageText),
						ores[edit.revid] || 0,
						blocks[edit.user] || false,
						!(await this.wikishield.api.pageExists(`User talk:${edit.user}`))
					);
				});

			// Check for outdated edits in queue
			await this.checkForOutdatedEdits();

			this.backoff = this.wikishield.__script__.config.refresh;
		} catch (err) {
			console.log("Error while fetching recent changes", err);
			this.backoff = Math.min(this.backoff * 2, 120000);
		}

		window.setTimeout(this.fetchRecentChanges.bind(this), this.backoff);
	}

	/**
	 * Add an edit to the queue
	 * @param {Object} edit The edit to add
	 * @param {Number} count The edit count of the user
	 * @param {String} warningLevel The warning level of the user
	 * @param {Number} ores The ORES score of the edit
	 * @param {Boolean} blocked Whether the user is blocked
	 * @param {Boolean} emptyTalkPage Whether the user's talk page is empty
	 */
	async addQueueItem(edit, count, warningLevel, ores, blocked, emptyTalkPage) {
		if (this.queue.filter(e => e.revid === edit.revid).length > 0 ||
			this.previousItems.filter(e => e.revid === edit.revid).length > 0) {
			return;
		}

		const item = await this.generateQueueItem(edit, count, warningLevel, ores, blocked, null, null, emptyTalkPage);

		this.queue.push(item);

		const currentIndex = this.queue.findIndex(e => e.revid === this.currentEdit?.revid);
		let sorted;
		if (currentIndex === -1) {
			sorted = this.queue;
		} else {
			sorted = this.queue.slice(0, currentIndex).concat(this.queue.slice(currentIndex + 1));
		}

		sorted = sorted.sort((a, b) => {
			const score = +b.fromHistory - +a.fromHistory;
			if (score !== 0) {
				return score;
			}

			let aScore = a.ores;
			if (this.wikishield.highlighted.has(a.user.name)) {
				aScore += 100;
			} else if (a.mentionsMe) {
				aScore += 50;
			}

			let bScore = b.ores;
			if (this.wikishield.highlighted.has(b.user.name)) {
				bScore += 100;
			} else if (b.mentionsMe) {
				bScore += 50;
			}

			return bScore - aScore;
		});

		if (currentIndex >= 0) {
			sorted.splice(currentIndex, 0, this.currentEdit);
		}

		this.queue = [ ...sorted ];

		// Only auto-select first edit if no edit is currently selected
		if (this.queue.length === 1 && !this.currentEdit) {
			this.currentEdit = this.queue[0];
		}

		// Play sound alert if ORES score is above threshold (but not on welcome screen)
		const welcomeScreen = document.getElementById("welcome-container");
		const isOnWelcomeScreen = welcomeScreen && welcomeScreen.style.display !== "none";

		if (this.wikishield.options.enableSoundAlerts && ores >= this.wikishield.options.soundAlertORESScore && !isOnWelcomeScreen) {
			this.playAlertSound();
		}

		this.wikishield.interface.renderQueue(this.queue, this.currentEdit);
	}

	/**
	 * Standardized sound playing function
	 * @param {String} triggerKey The trigger key (e.g., 'click', 'alert', etc.)
	 */
	playSound(triggerKey) {
		if (!this.wikishield.soundEnabled) return;

		const soundKey = this.wikishield.options.soundMappings?.[triggerKey] || triggerKey;
		const soundConfig = this.wikishield.wikishieldData.sounds[soundKey];
		if (!soundConfig || soundKey === 'none') return;

		try {
			const AudioCtx = window.AudioContext || window.webkitAudioContext;
			const audioContext = new AudioCtx();

			const masterVol = this.wikishield.options.masterVolume ?? 0.5;
			const soundVol = this.wikishield.options.volumes?.[triggerKey] ?? 0.5;
			const volume = masterVol * soundVol * (soundConfig.volume ?? 1);

			const repeats = soundConfig.repeats || [0];
			const freqs = soundConfig.frequencies;

			repeats.forEach((offset, i) => {
				const freq = freqs[i % freqs.length];
				const osc = audioContext.createOscillator();
				const gain = audioContext.createGain();

				osc.connect(gain);
				gain.connect(audioContext.destination);
				osc.type = soundConfig.type;

				const start = audioContext.currentTime + offset;

				// Frequency sweep or fixed frequency
				if (soundConfig.sweep) {
					osc.frequency.setValueAtTime(soundConfig.sweep.from, start);
					osc.frequency.exponentialRampToValueAtTime(
						soundConfig.sweep.to,
						start + soundConfig.duration
					);
				} else {
					osc.frequency.setValueAtTime(freq, start);
				}

				// Apply envelope first, then scale by volume
				if (typeof soundConfig.envelope === 'function') {
					soundConfig.envelope(gain, audioContext, start, volume);
				}

				osc.start(start);
				osc.stop(start + soundConfig.duration);
			});
		} catch (err) {
			console.error(`Could not play ${soundKey}:`, err);
		}
	}

	/**
	 * Play an alert sound for high ORES scores
	 */
	playAlertSound() {
		this.playSound('alert');
	}

	/**
	 * Play a pleasant notification sound (two-tone chime)
	 */
	playNotificationSound() {
		this.playSound('notification');
	}

	/**
	 * Play a pleasant watchlist sound (two-tone chime)
	 */
	playWatchlistSound() {
		this.playSound('watchlist');
	}

	/**
	 * Play a click sound (short pop)
	 */
	playClickSound() {
		this.playSound('click');
	}

	/**
	 * Play a whoosh sound (item removed/cleared)
	 */
	playWhooshSound() {
		this.playSound('whoosh');
	}

	/**
	 * Play a warning sound (for warn action)
	 */
	playWarnSound() {
		this.playSound('warn');
	}

	/**
	 * Play a rollback sound (swoosh with descending tone)
	 */
	playRollbackSound() {
		this.playSound('rollback');
	}

	/**
	 * Play a report sound (ascending alert)
	 */
	playReportSound() {
		this.playSound('report');
	}

	/**
	 * Play a thank sound (gentle chime)
	 */
	playThankSound() {
		this.playSound('thank');
	}

	/**
	 * Play a protection sound (shield sound)
	 */
	playProtectionSound() {
		this.playSound('protection');
	}

	/**
	 * Play a block sound (heavy impact)
	 */
	playBlockSound() {
		this.playSound('block');
	}

	/**
	 * Play a highlight/whitelist sound (sparkle)
	 */
	playSparkleSound() {
		this.playSound('sparkle');
	}

	/**
	 * Check and remove edits that have been superseded by newer edits on the same page
	 * NOTE: This now only removes edits that are NOT currently being viewed
	 */
	async checkForOutdatedEdits() {
		if (this.queue.length === 0) return;

		// Get all unique page titles from queue, filtering out invalid ones
		const allPageTitles = [...new Set(this.queue.map(item => item.page.title))];
		const pageTitles = allPageTitles;

		if (pageTitles.length === 0) return;

		// Fetch latest revision for each page
		const latestRevisions = await this.wikishield.api.getLatestRevisions(pageTitles.join("|"));

		// Track items to remove (but NOT the current edit being viewed)
		const itemsToRemove = [];

		for (const item of this.queue) {
			// Don't remove the edit that's currently being viewed
			if (this.currentEdit && item.revid === this.currentEdit.revid) {
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
				const index = this.queue.indexOf(item);
				if (index > -1) {
					this.queue.splice(index, 1);
					this.wikishield.interface.removeQueueItem(item.revid);
				}
			}

			this.wikishield.interface.renderQueue(this.queue, this.currentEdit);
		}
	}

	/**
	 * Generate a queue item from an edit
	 * @param {Object} edit The edit to generate the queue item from
	 * @param {Number} count The edit count of the user
	 * @param {String} warningLevel The warning level of the user
	 * @param {Number} ores The ORES score of the edit
	 * @param {Boolean} blocked Whether the user is blocked
	 * @param {Boolean} emptyTalkPage Whether the user's talk page is empty
	 * @returns {Object} The queue item
	 */
	async generateQueueItem(edit, count, warningLevel, ores, blocked, contribs, history, emptyTalkPage) {
		contribs = contribs || await this.wikishield.api.contribs(edit.user);
		history = history || await this.wikishield.api.history(edit.title);
		const diff = await this.wikishield.api.diff(edit.title, edit.old_revid || edit.parentid, edit.revid);
		const metadata = await this.wikishield.api.getPageMetadata(edit.title);

		const categories = await this.wikishield.api.categories(edit.old_revid || edit.parentid) ?? [];

		// Check if diff mentions current user
		const currentUsername = mw.config.get("wgUserName");
		const reverts = await this.wikishield.api.countReverts(edit.title, currentUsername);

		let mentionsMe = false;
		if (currentUsername && diff) {
			// Create a temporary div to parse HTML and get text content
			const tempDiv = document.createElement("div");
			tempDiv.innerHTML = diff;
			const diffText = tempDiv.textContent || tempDiv.innerText || "";
			// Case-insensitive search for username
			mentionsMe = diffText.toLowerCase().includes(currentUsername.toLowerCase());
		}

		const queueItem = {
			page: {
				title: edit.title,
				history: history,
				dateFormat: metadata.dateFormat,
				englishVariant: metadata.englishVariant,
				categories: categories,
				namespace: edit.ns
			},
			user: {
				name: edit.user,
				contribs: contribs,
				editCount: count,
				warningLevel: warningLevel,
				originalWarningLevel: warningLevel, // Store the warning level at time of queueing
				blocked: blocked,
				emptyTalkPage: emptyTalkPage !== undefined ? emptyTalkPage : false
			},
			ores: ores,
			revid: edit.revid,
			timestamp: edit.timestamp,
			comment: edit.comment,
			minor: "minor" in edit, // Store whether this is a minor edit (check if property exists)
			sizediff: (edit.newlen ? edit.newlen - edit.oldlen : edit.sizediff) || 0,
			diff: diff,
			tags: edit.tags,
			reviewed: false,
			mentionsMe: mentionsMe, // Flag if diff mentions current user
			aiAnalysis: null, // Will be populated asynchronously
			usernameAnalysis: null, // Will be populated asynchronously
			isBLP: categories.some(cat => cat.title === "Category:Living people"),
			reverts: reverts,
			consecutive: this.wikishield.api.consecutiveEdits(edit.title, edit.user),
			fromHistory: false,
			isTalk: edit.ns % 2 === 1
		};

		// Perform AI analysis asynchronously if enabled
		if (this.wikishield.options.enableOllamaAI && this.wikishield.ollamaAI) {
			// Don't await - let it run in background and update when ready
			this.wikishield.ollamaAI.analyzeEdit(queueItem).then(analysis => {
				queueItem.aiAnalysis = analysis;
				// Update UI if this edit is currently being displayed
				if (this.currentEdit && this.currentEdit.revid === queueItem.revid) {
					this.wikishield.interface.updateAIAnalysisDisplay(analysis);
				}
			}).catch(err => {
				console.error("AI analysis failed:", err);
				queueItem.aiAnalysis = {
					hasIssues: false,
					error: err.message
				};
			});

			// Perform username analysis for registered users (not TEMPs) and not whitelisted
			if (!mw.util.isTemporaryUser(edit.user) && !this.wikishield.whitelist.has(edit.user)) {
				this.wikishield.ollamaAI.analyzeUsername(edit.user, edit.title).then(usernameAnalysis => {
					queueItem.usernameAnalysis = usernameAnalysis;

					// If username is flagged and not cancelled, prompt for UAA report
					if (usernameAnalysis && !usernameAnalysis.cancelled &&
						usernameAnalysis.shouldFlag && usernameAnalysis.confidence >= 0.5) {
						this.promptForUAAReport(queueItem);
					}
				}).catch(err => {
					console.error("Username analysis failed:", err);
					queueItem.usernameAnalysis = {
						shouldFlag: false,
						error: err.message
					};
				});
			}
		}

		return queueItem;
	}

	/**
	 * Given the text of a user talk page, get the warning level of the user
	 * @param {String} text The text of the user talk page
	 * @returns {String} The warning level of the user
	 */
	getWarningLevel(text) {
		const monthSections = text.split(/(?=== ?[\w\d ]+ ?==)/g);

		for (let section of monthSections) {
			if (new RegExp("== ?" + this.wikishield.util.monthSectionName() + " ?==").test(section)) {
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
			const isCurrentMonth = new RegExp("== ?" + currentMonthName + " ?==").test(section);

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
		if (this.queue.length === 0) {
			return;
		}

		// If no current edit, select the first item
		if (!this.currentEdit) {
			this.currentEdit = this.queue[0];
			this.wikishield.interface.renderQueue(this.queue, this.currentEdit);
			return;
		}

		// Find where the current edit is in the queue
		const currentIndex = this.queue.findIndex(e => e.revid === this.currentEdit.revid);

		// If current edit is not in queue, select the first item
		if (currentIndex === -1) {
			this.currentEdit = this.queue[0];
			this.wikishield.interface.renderQueue(this.queue, this.currentEdit);
			return;
		}

		// Store the edit we're leaving
		const editWeAreLeaving = this.currentEdit;

		// Cancel AI analysis for the edit we're leaving
		if (editWeAreLeaving && this.wikishield.ollamaAI) {
			this.wikishield.ollamaAI.cancelAnalysis(editWeAreLeaving.revid);
		}

		// Mark as reviewed if moving away from the first item
		if (currentIndex === 0 && !editWeAreLeaving.reviewed) {
			editWeAreLeaving.reviewed = true;
			this.wikishield.statistics.reviewed += 1;
			this.wikishield.saveStats(this.wikishield.statistics);
		}

		// Remove the current item from the queue
		this.queue.splice(currentIndex, 1);
		this.wikishield.interface.removeQueueItem(editWeAreLeaving.revid);

		// Update currentEdit to the item now at the current position
		if (this.queue.length > 0) {
			if (currentIndex < this.queue.length) {
				// Move to the item that's now at the current position
				this.currentEdit = this.queue[currentIndex];
			} else {
				// We removed the last item, go to the new last item
				this.currentEdit = this.queue[this.queue.length - 1];
			}
		} else {
			// Queue is empty
			this.currentEdit = null;
		}

		// Store the edit we left in previousItems
		this.previousItems.push({ ...editWeAreLeaving, fromHistory: true });

		this.wikishield.interface.renderQueue(this.queue, this.currentEdit);

		// Auto-welcome the user we left
		if (editWeAreLeaving) {
			this.checkAndAutoWelcome(editWeAreLeaving);
			this.checkAndAutoReportUAA(editWeAreLeaving);
		}
	}

	/**
	 * Set the current edit to the previous item in the queue
	 * This only changes which edit is selected, it does NOT remove anything
	 */
	prevItem() {
		// If no current edit and queue has items, select the first item
		if (!this.currentEdit && this.queue.length > 0) {
			this.currentEdit = this.queue[0];
			this.wikishield.interface.renderQueue(this.queue, this.currentEdit);
			return;
		}

		// Find where the current edit is in the queue
		const currentIndex = this.currentEdit ? this.queue.findIndex(e => e.revid === this.currentEdit.revid) : -1;

		// Store the edit we're leaving
		const editWeAreLeaving = this.currentEdit;

		// If we're at the first item (or not found), try to go to previousItems
		if (currentIndex <= 0) {
			// No previous items available, can't go back
			if (this.previousItems.length === 0) {
				return;
			}

			// Cancel AI analysis for the edit we're leaving
			if (editWeAreLeaving && this.wikishield.ollamaAI) {
				this.wikishield.ollamaAI.cancelAnalysis(editWeAreLeaving.revid);
			}

			// Pull an item from previousItems and add it to the front of the queue
			this.queue.unshift(this.previousItems.pop());
			this.currentEdit = this.queue[0];
			this.wikishield.interface.renderQueue(this.queue, this.currentEdit);

			// Auto-welcome the user we left
			if (editWeAreLeaving) {
				this.checkAndAutoWelcome(editWeAreLeaving);
				this.checkAndAutoReportUAA(editWeAreLeaving);
			}

			return;
		}

		// Cancel AI analysis for the edit we're leaving
		if (editWeAreLeaving && this.wikishield.ollamaAI) {
			this.wikishield.ollamaAI.cancelAnalysis(editWeAreLeaving.revid);
		}

		// Simply move selection to the previous item
		this.currentEdit = this.queue[currentIndex - 1];
		this.wikishield.interface.renderQueue(this.queue, this.currentEdit);

		// Auto-welcome the user we left
		if (editWeAreLeaving) {
			this.checkAndAutoWelcome(editWeAreLeaving);
			this.checkAndAutoReportUAA(editWeAreLeaving);
		}
	}

	/**
	 * Check if user should be auto-welcomed and do so if needed
	 * @param {Object} edit The edit object to check
	 */
	async checkAndAutoWelcome(edit) {
		// Check if auto-welcome is enabled
		if (!this.wikishield.options.enableAutoWelcome) {
			return;
		}

		// Only auto-welcome registered users (not TEMPs) with empty talk pages
		if (!edit.user || !edit.user.name || mw.util.isTemporaryUser(edit.user.name)) {
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

		// Only auto-welcome if the edit was constructive (according to AI analysis)
		if (edit.aiAnalysis && edit.aiAnalysis.constructive === false) {
			return;
		}

		// Double-check by fetching the talk page to see if it exists
		try {
			// If the talk page exists, don't auto-welcome
			if (await this.wikishield.api.pageExists(`User talk:${edit.user.name}`)) {
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

			if (!confirmed) {
				// Add user to no-auto-welcome list
				this.wikishield.noAutoWelcomeList.add(edit.user.name);
				return;
			}

			// Show progress notification
			const progressBar = new this.wikishield.WikiShieldProgressBar();
			progressBar.set("Auto-welcoming...", 0.5, "var(--main-blue)");

			let template = null;
			if (this.wikishield.options.enableWelcomeLatin) {
				// Determine which template to use based on username characters and mentorship
				// Check if username contains non-Latin characters (takes precedence)
				const hasNonLatin = /[^\u0000-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F]/.test(edit.user.name);
				if (hasNonLatin) {
					template = "Latin";
				}
			}

			if (template === null) {
				template = "Default";
			}

			// Auto-welcome with appropriate template
			await this.wikishield.welcomeUser(edit.user.name, template);

			// Update progress to complete
			progressBar.set(`Welcomed ${edit.user.name}`, 1, "var(--main-green)");
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
		if (!edit.user || !edit.user.name || mw.util.isTemporaryUser(edit.user.name)) {
			return;
		}

		// Check if user is in the no-auto-welcome list (also used for UAA to avoid duplicate prompts)
		if (this.wikishield.noAutoWelcomeList.has(edit.user.name)) {
			return;
		}

		// Check if we have username analysis results
		const usernameAnalysis = edit.usernameAnalysis;
		if (!usernameAnalysis || !usernameAnalysis.shouldFlag) {
			return;
		}

		// Check if user is already reported to UAA
		if (this.wikishield.uaaReports && this.wikishield.uaaReports.includes(edit.user.name)) {
			// Add to no-auto-welcome list to avoid future prompts
			this.wikishield.noAutoWelcomeList.add(edit.user.name);
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
			<strong>Reasoning:</strong> ${this.wikishield.util.escapeHtml(usernameAnalysis.reasoning)}<br>
			<strong>Recommendation:</strong> ${this.wikishield.util.escapeHtml(usernameAnalysis.recommendation)}`,
			edit.user.name
		);

		if (!confirmed) {
			// Add user to no-auto-welcome list to avoid future prompts
			this.wikishield.noAutoWelcomeList.add(edit.user.name);
			return;
		}

		// Open UAA report interface
		try {
			// Use the existing event system to trigger UAA report
			const reportEvent = this.wikishield.events.events.reportUserUAA;
			if (reportEvent && reportEvent.func) {
				await reportEvent.func(edit);
			}

			// Add user to no-auto-welcome list after reporting
			this.wikishield.noAutoWelcomeList.add(edit.user.name);
		} catch (err) {
			console.log("Error during auto UAA report:", err);
		}
	}

	/**
	 * Check if user should be reported to UAA based on username analysis
	 * This is called when moving away from an edit
	 * @param {Object} edit The edit object to check
	 */
	async checkAndAutoReportUAA(edit) {
		// If username analysis has already flagged this user, prompt for report
		if (edit.usernameAnalysis && edit.usernameAnalysis.shouldFlag &&
			edit.usernameAnalysis.confidence >= 0.5 && !edit.usernameAnalysis.cancelled) {
			await this.promptForUAAReport(edit);
		}
	}

	/**
	 * Clear the queue
	 */
	delete() {
		// Play whoosh sound for clearing
		this.playWhooshSound();

		// Cancel all active AI analyses
		if (this.wikishield.ollamaAI) {
			this.wikishield.ollamaAI.cancelAllAnalyses();
		}

		this.queue = [];
		this.currentEdit = null;
		this.wikishield.interface.clearQueue();
		this.wikishield.interface.renderQueue(this.queue, this.currentEdit);
	}

	/**
	 * Load an edit from the user contributions list
	 * @param {Number} revid
	 */
	async loadFromContribs(revid) {
		const edit = this.currentEdit.user.contribs.filter(e => e.revid === Number(revid))[0];

		const diffContainer = this.wikishield.interface.elem("#diff-container");
		diffContainer.innerHTML = ``;

		this.currentEdit = await this.generateQueueItem(
			edit,
			this.currentEdit.user.editCount,
			this.currentEdit.user.warningLevel,
			null,
			this.currentEdit.user.blocked,
			null,
			null,
			this.currentEdit.user.emptyTalkPage
		);
		this.wikishield.interface.renderQueue(this.queue, this.currentEdit);
	}

	/**
	 * Load an edit from the page history list
	 * @param {Number} revid
	 */
	async loadFromHistory(revid) {
		const edit = this.currentEdit.page.history.filter(e => e.revid === Number(revid))[0];
		edit.title = this.currentEdit.page.title;

		const diffContainer = this.wikishield.interface.elem("#diff-container");
		diffContainer.innerHTML = ``;

		const results = await Promise.all([
			this.wikishield.api.editCount(edit.user),
			this.wikishield.api.getSinglePageContent(`User talk:${edit.user}`),
			this.wikishield.api.contribs(edit.user),
			this.wikishield.api.history(edit.title)
		]);

		const talkPageText = results[1];

		this.currentEdit = await this.generateQueueItem(
			edit,
			results[0][0].editcount,
			this.getWarningLevel(talkPageText),
			null, false, results[2], results[3],
			!(await this.wikishield.api.pageExists(`User talk:${edit.user}`))
		);
		this.wikishield.interface.renderQueue(this.queue, this.currentEdit);
	}

	/**
	 * Load a specific revision by revid and page title (for loading newest revision)
	 * @param {Number} revid The revision ID to load
	 * @param {String} pageTitle The page title
	 */
	async loadSpecificRevision(revid, pageTitle) {
		try {
			const diffContainer = this.wikishield.interface.elem("#diff-container");
			diffContainer.innerHTML = `<div class="loading-spinner">Loading revision...</div>`;

			// Fetch the revision data from the API
			const revisionData = await this.wikishield.api.getRevisionData(revid);

			if (!revisionData) {
				diffContainer.innerHTML = `<div class="error">Failed to load revision</div>`;
				return;
			}

			// Fetch all necessary data
			const results = await Promise.all([
				this.wikishield.api.editCount(revisionData.user),
				this.wikishield.api.getSinglePageContent(`User talk:${revisionData.user}`),
				this.wikishield.api.contribs(revisionData.user),
				this.wikishield.api.history(pageTitle)
			]);

			const talkPageText = results[1];

			// Create a proper edit object
			const edit = {
				revid: revisionData.revid,
				parentid: revisionData.parentid,  // Include parentid for diff generation
				user: revisionData.user,
				comment: revisionData.comment,
				timestamp: revisionData.timestamp,
				size: revisionData.size,
				oldlen: revisionData.oldlen || 0,
				newlen: revisionData.size,
				title: pageTitle
			};

			this.currentEdit = await this.generateQueueItem(
				edit,
				results[0][0].editcount,
				this.getWarningLevel(talkPageText),
				null, false, results[2], results[3],
				!(await this.wikishield.api.pageExists(`User talk:${edit.user}`))
			);

			this.wikishield.interface.renderQueue(this.queue, this.currentEdit);
		} catch (err) {
			console.error("Failed to load specific revision:", err);
			this.wikishield.interface.elem("#diff-container").innerHTML = `<div class="error">Failed to load revision</div>`;
		}
	}
}