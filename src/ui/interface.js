/**
* WikiShieldInterface - Main UI management
* Handles rendering and managing the user interface
*/

import { WikiShieldEventManager } from '../core/event-manager.js';
import { WikiShieldSettingsInterface } from './settings.js';
import { wikishieldStyling } from './styles.js';
import { wikishieldHTML } from './templates.js';
import { __script__ } from '../index.js';
import { getWarningFromLookup, warnings, warningTemplateColors } from '../data/warnings.js';
import { colorPalettes } from '../config/defaults.js';
import { __pendingChangesServer__ } from '../core/api.js';
import { WikiShieldProgressBar } from './progress-bar.jsx';
import { fullTrim } from '../utils/formatting.js';

import React, { useEffect, useRef } from 'react';

export class WikiShieldInterface {
	constructor(wikishield) {
		this.wikishield = wikishield;
		this.selectedWidthAdjust = null;
		this.startingSectionWidth = null;
		this.startingMouseX = null;
		this.lastCurrentEdit = {
			recent: null,
			flagged: null,
			watchlist: null
		};
		this.newerRevisionInterval = null; // For periodic newer revision checking

		this.queueWidth = undefined;
		this.detailsWidth = undefined;

		this.eventManager = new WikiShieldEventManager(this.wikishield);
		this.settings = new WikiShieldSettingsInterface(this.wikishield);
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
		baseStyle.classList.add("this.wikishield-theme-base");
		baseStyle.innerHTML = wikishieldStyling.base;
		document.head.appendChild(baseStyle);
	}

	/**
	* Remove all theme stylesheets
	*/
	removeTheme() {
		document.querySelectorAll(".this.wikishield-theme-base").forEach(elem => elem.remove());
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
		const controller = new AbortController();
		this.wikishield.audioManager.playSound([ "startup" ], controller);

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
		let targetDotCount = 0; // adaptive target count
		const DPR = Math.min(window.devicePixelRatio || 1, 2); // cap DPR to avoid massive cost

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
				this.fill = `rgba(${this.color}, 0.8)`; // precompute style strings
				this.shadow = `rgba(${this.color}, 0.8)`;
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
				ctx.fillStyle = this.fill;
				// Drop shadow blur (expensive) in favor of simple fill
				ctx.fill();
			}
		}

		// Set canvas size
		// Throttled resize with DPR awareness
		let resizeRAF = null;
		const resizeCanvas = () => {
			if (resizeRAF) return;
			resizeRAF = requestAnimationFrame(() => {
				resizeRAF = null;
				const oldWidth = canvas.width;
				const oldHeight = canvas.height;

				canvas.width = Math.floor(window.innerWidth * DPR);
				canvas.height = Math.floor(window.innerHeight * DPR);
				canvas.style.width = `${window.innerWidth}px`;
				canvas.style.height = `${window.innerHeight}px`;

				ctx.setTransform(1, 0, 0, 1, 0, 0);
				ctx.scale(DPR, DPR); // keep drawing coordinates in CSS px

				const scaleX = canvas.width / (oldWidth || canvas.width);
				const scaleY = canvas.height / (oldHeight || canvas.height);

				// Rescale existing dots
				dots.forEach(dot => {
					dot.x *= scaleX;
					dot.y *= scaleY;
				});

				// Adaptive target count based on area and DPR
				targetDotCount = Math.floor((window.innerWidth * window.innerHeight) / 7000);
				targetDotCount = Math.max(40, Math.min(250, targetDotCount));

				// Grow/shrink to target
				if (targetDotCount > dots.length) {
					for (let i = dots.length; i < targetDotCount; i++) dots.push(new Dot());
				} else if (targetDotCount < dots.length) {
					dots.length = targetDotCount;
				}
			});
		};
		resizeCanvas();
		window.addEventListener('resize', resizeCanvas);

		let lastTimestamp = performance.now();
		const lastDeltaTimes = new Array(15).fill(1000 / 60); // Start with 60 FPS
		// Spatial hash grid for neighbor queries
		const GRID_SIZE = 160; // pixels, roughly link range
		let averageFPS = 60;
		let lowFpsStart = null; // timestamp when FPS fell below threshold
		const LOW_FPS_THRESHOLD = 30; // kill if sustained below this
		const LOW_FPS_DURATION_MS = 500; // duration to consider sustained
		const animate = () => {
			{ // FPS calculation
				const now = performance.now();

				const deltaTime = now - lastTimestamp;
				lastTimestamp = now;

				lastDeltaTimes.shift();
				lastDeltaTimes.push(deltaTime);

				const noOutliers = [ ...lastDeltaTimes ].sort((a, b) => a - b).slice(2, -2);

				const averageDeltaTime = noOutliers.reduce((a, b) => a + b, 0) / noOutliers.length;
				const fps = 1000 / averageDeltaTime;
				averageFPS = fps;

				// Kill animation if FPS stays too low for sustained period
				if (fps < LOW_FPS_THRESHOLD) { // FIX always kill probably
					if (lowFpsStart === null) lowFpsStart = now;
					if (now - lowFpsStart >= LOW_FPS_DURATION_MS) {
						if (animationFrame) cancelAnimationFrame(animationFrame);
						animationFrame = null;
						ctx.clearRect(0, 0, canvas.width, canvas.height);
						return; // stop scheduling frames
					}
				} else {
					lowFpsStart = null;
				}

				// If FPS tanks, reduce dot count a bit to recover
				if (fps < 45 && dots.length > 60) {
					dots.length = Math.max(60, Math.floor(dots.length * 0.9));
					targetDotCount = dots.length;
				}
			}

			ctx.clearRect(0, 0, canvas.width, canvas.height);

			// Update and draw dots
			dots.forEach(dot => {
				dot.update();
				dot.draw();
			});

			// Draw lines between close dots using spatial hashing
			const cols = Math.ceil(window.innerWidth / GRID_SIZE);
			const rows = Math.ceil(window.innerHeight / GRID_SIZE);
			const grid = new Array(cols * rows);
			for (let i = 0; i < grid.length; i++) grid[i] = [];

			// Assign dots to cells
			dots.forEach((d, index) => {
				const cx = Math.max(0, Math.min(cols - 1, Math.floor(d.x / GRID_SIZE)));
				const cy = Math.max(0, Math.min(rows - 1, Math.floor(d.y / GRID_SIZE)));
				grid[cy * cols + cx].push(index);
			});

			const linkRange = 150; // px
			const halfW = window.innerWidth / 2;
			const halfH = window.innerHeight / 2;
			for (let cy = 0; cy < rows; cy++) {
				for (let cx = 0; cx < cols; cx++) {
					const cellIdx = cy * cols + cx;
					const indices = grid[cellIdx];
					if (indices.length === 0) continue;

					// Neighbors: current cell + 8 surrounding cells
					for (let nyOff = -1; nyOff <= 1; nyOff++) {
						const ny = (cy + nyOff + rows) % rows; // wrap vertically
						for (let nxOff = -1; nxOff <= 1; nxOff++) {
							const nx = (cx + nxOff + cols) % cols; // wrap horizontally
							const nIdx = ny * cols + nx;
							const neighbors = grid[nIdx];
							if (neighbors.length === 0) continue;

							for (let ii = 0; ii < indices.length; ii++) {
								const a = dots[indices[ii]];
								for (let jj = 0; jj < neighbors.length; jj++) {
									const bi = neighbors[jj];
									if (bi <= indices[ii]) continue; // avoid duplicates
									const b = dots[bi];

									let dx = a.x - b.x;
									let dy = a.y - b.y;
									// Wrap horizontally
									if (dx > halfW) dx -= window.innerWidth;
									if (dx < -halfW) dx += window.innerWidth;
									// Wrap vertically
									if (dy > halfH) dy -= window.innerHeight;
									if (dy < -halfH) dy += window.innerHeight;

									const dist2 = dx * dx + dy * dy;
									if (dist2 < linkRange * linkRange) {
										const distance = Math.sqrt(dist2);
										const opacity = (1 - distance / linkRange) * 0.4;

										const aSplit = a.color.split(',');
										const bSplit = b.color.split(',');
										const avgR = (parseInt(aSplit[0]) + parseInt(bSplit[0])) / 2;
										const avgG = (parseInt(aSplit[1]) + parseInt(bSplit[1])) / 2;
										const avgB = (parseInt(aSplit[2]) + parseInt(bSplit[2])) / 2;

										ctx.beginPath();
										ctx.moveTo(a.x, a.y);
										ctx.lineTo(a.x - dx, a.y - dy);
										ctx.strokeStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${opacity})`;
										ctx.lineWidth = 1;
										ctx.stroke();
									}
								}
							}
						}
					}
				}
			}

			animationFrame = requestAnimationFrame(animate);
		};

		animate();

		if (this.wikishield.rights.rollback) {
			this.elem("#rollback-needed").style.display = "none";
			this.elem("#start-button").style.display = "";
		} else {
			this.elem("#rollback-needed").style.display = "";
			this.elem("#start-button").style.display = "none";
		}

		this.elem("#start-button").addEventListener("click", () => {
			this.wikishield.audioManager.playSound([ "ui", "click" ]);
			controller.abort();

			// Stop the dots animation
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
			this.wikishield.start();
		});

		this.loadTheme();
	}

	/**
	* Build the main interface, and link buttons to events
	*/
	start() {
		document.head.innerHTML = `
				<title>WikiShield</title>
				<style>${wikishieldStyling.main}</style>
				<style>${wikishieldStyling.musicToast}</style>
				${wikishieldHTML.head}
			`;

		this.loadTheme();
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
						this.createRevertMenu(menu, this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab]);
					} break;
					case "warn": {
						menu.innerHTML = "";
						this.createWarnMenu(menu, this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab]);
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
			this.elem("#alerts-icon"),
			this.elem("#notices-icon"),
			this.elem("#user-warn-level"),

			...document.querySelectorAll("#queue-tabs > .queue-tab"),
		].forEach(e => this.addTooltipListener(e));

		// Alert icon click handler
		this.elem("#alerts-icon").addEventListener("click", (e) => {
			const panel = this.elem("#alerts-panel");
			panel.classList.toggle("show");
		});

		// Mark all as read handler
		this.elem("#mark-all-alerts-read").addEventListener("click", () => {
			this.wikishield.markAllAlertsRead();
		});

		// Notices icon click handler
		this.elem("#notices-icon").addEventListener("click", (e) => {
			const panel = this.elem("#notices-panel");
			panel.classList.toggle("show");
			if (panel.classList.contains("show")) {
				this.wikishield.markAllNoticesSeen();
			}
		});

		// Mark all as read handler
		this.elem("#mark-all-notices-read").addEventListener("click", () => {
			this.wikishield.markAllNoticesRead();
		});

		// Close alerts panel when clicking outside
		document.addEventListener("click", (e) => {
			for (const id of [ "alerts", "notices" ]) {
				const panel = this.elem(`#${id}-panel`);
				const icon = this.elem(`#${id}-icon`);
				if (panel && !panel.contains(e.target) && !icon.contains(e.target)) {
					panel.classList.remove("show");
				}
			}

			if (!e.target.closest(".bottom-tool-menu")) {
				this.closeAllBottomMenus();
			}
		});

		const $latestTab = this.elem("#latest-edits-tab");
		$latestTab.addEventListener("click", event => {
			this.updateDiffContainer(this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab], false);
		});
		this.addTooltipListener($latestTab);

		const $consecutiveTab = this.elem("#consecutive-edits-tab");
		$consecutiveTab.addEventListener("click", event => {
			this.updateDiffContainer(this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab], true);
		});
		this.addTooltipListener($consecutiveTab);

		this.addTooltipListener(this.elem("#right-top > .icons > .created-page"));

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
			this.elem("#user-whitelist"),
			"whitelistUser"
		);

		this.eventManager.linkButton(
			this.elem("#user-unwhitelist"),
			"unwhitelistUser"
		);

		this.eventManager.linkButton(
			this.elem("#user-highlight"),
			"highlightUser"
		);

		this.eventManager.linkButton(
			this.elem("#user-unhighlight"),
			"unhighlightUser"
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

		this.createSubmenu(
			this.elem("#edit-rollback .submenu"),
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

		this.eventManager.linkButton(
			this.elem("#page-whitelist"),
			"whitelistPage"
		);

		this.eventManager.linkButton(
			this.elem("#page-unwhitelist"),
			"unwhitelistPage"
		);

		this.eventManager.linkButton(
			this.elem("#page-highlight"),
			"highlightPage"
		);

		this.eventManager.linkButton(
			this.elem("#page-unhighlight"),
			"unhighlightPage"
		);

		this.createSubmenu(
			this.elem("#page-request-protection .submenu"),
			"requestProtection"
		);

		this.createSubmenu(
			this.elem("#user-welcome .submenu"),
			"welcome"
		);

		this.elem("#pending-changes-container > .accept").addEventListener("click", (e) => {
			// TODO
			this.wikishield.audioManager.playSound([ "ui", "click" ]);
			const message = window.prompt("Enter an optional edit summary for accepting this flagged edit:");
			this.wikishield.executeScript({
				actions: [
					{
						name: "acceptFlaggedEdit",
						params: { reason: message }
					},
					{
						name: "nextEdit",
						params: {}
					}
				]
			});
		});

		this.elem("#pending-changes-container > .reject").addEventListener("click", (e) => {
			// TODO
			this.wikishield.audioManager.playSound([ "ui", "click" ]);
			const message = window.prompt("Enter an optional edit summary for rejecting this flagged edit:");
			this.wikishield.executeScript({
				actions: [
					{
						name: "rejectFlaggedEdit",
						params: { reason: message }
					},
					{
						name: "nextEdit",
						params: {}
					}
				]
			});
		});

		if (!this.wikishield.rights.block) {
			[...document.querySelectorAll(".tool-block")].forEach(elem => elem.style.display = "none");
		}

		if (!this.wikishield.rights.protect) {
			[...document.querySelectorAll(".tool-protect")].forEach(elem => elem.style.display = "none");
		}

		[...this.elem("#bottom-tools").querySelectorAll("[data-tooltip]")]
			.forEach(elem => this.addTooltipListener(elem));

		const queueWidthAdjust = this.elem("#queue-width-adjust");
		const queue = this.elem("#queue");

		const detailsWidthAdjust = this.elem("#details-width-adjust");
		const details = this.elem("#right-details");

		const savedQueueWidth = this.wikishield.storage.data.layout.queue.width;
		if (savedQueueWidth) {
			queue.style.width = savedQueueWidth;
			this.elem("#right-container").style.width = `calc(100% - ${savedQueueWidth})`;
		}

		const savedDetailsWidth = this.wikishield.storage.data.layout.details.width;
		if (savedDetailsWidth) {
			details.style.width = savedDetailsWidth;
			this.elem("#main-container").style.width = `calc(100% - ${savedDetailsWidth})`;
			this.elem("#middle-top").style.width = `calc(100% - ${savedDetailsWidth})`;
			this.elem("#right-top").style.width = savedDetailsWidth;
		}

		const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

		const startResize = (handle, section, event) => {
			event.preventDefault();

			this.activeHandle = handle;
			this.section = section;

			// fixed pixel baseline
			this.startX = event.clientX;
			this.startWidthPx = section.getBoundingClientRect().width;

			// fixed window width baseline (so vw conversion is stable)
			this.windowWidthPx = window.innerWidth;
		};

		queueWidthAdjust.addEventListener("pointerdown", (e) =>
			startResize(queueWidthAdjust, queue, e)
		);
		detailsWidthAdjust.addEventListener("pointerdown", (e) =>
			startResize(detailsWidthAdjust, details, e)
		);

		window.addEventListener("pointerup", () => {
			if (this.activeHandle === queueWidthAdjust) {
				this.wikishield.storage.data.layout.queue.width = queue.style.width;
			}

			if (this.activeHandle === detailsWidthAdjust) {
				this.wikishield.storage.data.layout.details.width = details.style.width;
			}

			this.activeHandle = null;
			this.section = null;
		});

		window.addEventListener("pointermove", (event) => {
			if (!this.activeHandle) return;

			const dx = event.clientX - this.startX;

			let newWidthPx;

			if (this.activeHandle === queueWidthAdjust) {
				// Left resizer increases with rightward drag
				newWidthPx = this.startWidthPx + dx;
			} else {
				// Right resizer increases with leftward drag
				newWidthPx = this.startWidthPx - dx;
			}

			// Clamp in pixels
			const minPx = this.windowWidthPx * 0.10; // 10vw
			const maxPx = this.windowWidthPx * 0.30; // 30vw
			newWidthPx = clamp(newWidthPx, minPx, maxPx);

			// Convert to vw once
			const newWidthVw = (newWidthPx / this.windowWidthPx) * 100;
			this.section.style.width = `${newWidthVw}vw`;

			// Update siblings based on section identity
			if (this.activeHandle === queueWidthAdjust) {
				this.elem("#right-container").style.width = `calc(100% - ${newWidthVw}vw)`;
			}

			if (this.activeHandle === detailsWidthAdjust) {
				this.elem("#main-container").style.width = `calc(100% - ${newWidthVw}vw)`;
				this.elem("#middle-top").style.width = `calc(100% - ${newWidthVw}vw)`;
				this.elem("#right-top").style.width = `${newWidthVw}vw`;
			}
		});

		window.addEventListener("click", () => {
			[...document.querySelectorAll(".context-menu")].forEach(elem => elem.remove());
		});

		if (__script__.changelog.version.endsWith("!") || this.wikishield.storage.data.changelog !== __script__.changelog.version) {
			this.settings.openSettings("about", ".settings-section:has(.changelog-content)");
		}

		this.updateZenModeDisplay(true);

		{ // build queue tabs
			this.eventManager.linkButton(
				this.elem("#queue-tab-recent"),
				"switchToRecentQueue",
				true
			);
			this.eventManager.linkButton(
				this.elem("#queue-tab-flagged"),
				"switchToFlaggedQueue",
				true
			);
			this.eventManager.linkButton(
				this.elem("#queue-tab-watchlist"),
				"switchToWatchlistQueue",
				true
			);
		}

		this.newEditSelected(null);

		this.update();
		setInterval(this.update.bind(this), 1000);
	}

	update() {
		try {
			{ // flagged
				const allowed = this.wikishield.rights.review && __pendingChangesServer__.has(mw.config.get("wgServerName"));
				this.elem("#queue-tab-flagged").classList.toggle("hidden", !allowed);
				if (!allowed && this.wikishield.queue.currentQueueTab === "flagged") {
					this.wikishield.queue.switchQueueTab("recent");
				}
			}
		} catch (err) {
			console.error(err);
		}
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

			requestAnimationFrame(() => position());
		};

		requestAnimationFrame(() => position());
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

			requestAnimationFrame(() => position());
		};

		requestAnimationFrame(() => position());
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
			const reportObject = {
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
			};

			const autoReporting = this.wikishield.storage.data.settings.auto_report;
			await this.wikishield.executeScript({
				actions: [
					{
						name: "nextEdit",
						params: {}
					},
					{
						name: "rollback",
						params: {
							summary: getWarningFromLookup(warningType).summary
						}
					},
					{
						name: "warn",
						params: {
							warningType,
							level,
						}
					},
					{
						name: "highlightUser",
						params: {}
					},
				].concat(autoReporting.enabled && autoReporting.for.has(warningType) ? [ reportObject ] : [])
			});

			this.selectedMenu = null;
		};

		let allMade = 0;
		for (const [ title, category ] of Object.entries(warnings.revert)) {
			const section = document.createElement("div");
			section.className = "warning-menu-section";

			const header = document.createElement("h2");
			header.textContent = title;
			section.appendChild(header);

			const divider = document.createElement("div");
			divider.className = "menu-divider";
			section.appendChild(divider);

			let made = 0;
			for (const warning of category) {
				if (warning.hide || (typeof warning.show === "function" && !warning.show(currentEdit))) {
					continue;
				}

				made++;
				allMade++;

				const item = document.createElement("div");
				item.className = "warning-menu-item";

				const icon = document.createElement("span");
				icon.className = `icon ${warning.icon}` ?? "icon fas fa-mouse-pointer";
				item.appendChild(icon);

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
					levelButton.className = `levels-menu-item colorize-level colorize-level-${templateLabel}`;
					levelButton.textContent = template.label || templateLabel;
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

			if (made > 0) {
				menu.appendChild(section);
			}
		}

		if (allMade === 0) {
			const noWarnings = document.createElement("div");
			noWarnings.className = "warning-menu-no-items";
			noWarnings.textContent = "No revert warnings available.";
			menu.appendChild(noWarnings);
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
			await this.wikishield.executeScript({
				actions: [
					{
						name: "warn",
						params: {
							warningType,
							level,
						}
					},
					{
						name: "highlightUser",
						params: {}
					}
				]
			});

			this.selectedMenu = null;
		};

		let allMade = 0;
		for (const [ title, category ] of Object.entries(warnings.warn)) {
			const section = document.createElement("div");
			section.className = "warning-menu-section";

			const header = document.createElement("h2");
			header.textContent = title;
			section.appendChild(header);

			const divider = document.createElement("div");
			divider.className = "menu-divider";
			section.appendChild(divider);

			let made = 0;
			for (const warning of category) {
				if (warning.hide || (typeof warning.show === "function" && !warning.show(currentEdit))) {
					continue;
				}

				made++;
				allMade++;

				const item = document.createElement("div");
				item.className = "warning-menu-item";

				const icon = document.createElement("span");
				icon.className = `icon ${warning.icon}` ?? "icon fas fa-mouse-pointer";
				item.appendChild(icon);

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
					levelButton.className = `levels-menu-item colorize-level colorize-level-${templateLabel}`;
					levelButton.textContent = template.label || templateLabel;
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

			if (made > 0) {
				menu.appendChild(section);
			}
		}

		if (allMade === 0) {
			const noWarnings = document.createElement("div");
			noWarnings.className = "warning-menu-no-items";
			noWarnings.textContent = "No warnings available.";
			menu.appendChild(noWarnings);
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
				case "choice": {
					let options = param.options ?? [ ];
					if (typeof param.showOption === "function") {
						options = options.filter(opt => param.showOption(this.wikishield, opt));
					}

					container.innerHTML += `
						<select data-paramid="${param.id}">
							${options.reduce((prev, cur) => prev + `<option>${cur}</option>`, "")}
						</select>
					`;
				} break;
				case "text": {
					container.innerHTML += `<input type="text" data-paramid="${param.id}">`;
				} break;
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
			this.wikishield.executeScript({
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

	updateQueueTabsCounts() {
		const $recent = this.elem("#queue-tab-recent > span > .icon-count");
		$recent.classList.toggle("hidden", this.wikishield.queue.queue.recent.length === 0);
		$recent.innerText = this.wikishield.queue.queue.recent.length;

		const $flagged = this.elem("#queue-tab-flagged > span > .icon-count");
		$flagged.classList.toggle("hidden", this.wikishield.queue.queue.flagged.length === 0);
		$flagged.innerText = this.wikishield.queue.queue.flagged.length;

		const $watchlist = this.elem("#queue-tab-watchlist > span > .icon-count");
		$watchlist.classList.toggle("hidden", this.wikishield.queue.queue.watchlist.length === 0);
		$watchlist.innerText = this.wikishield.queue.queue.watchlist.length;
	}
	/**
	* Add edits to the queue if they aren't already there
	* @param {Object} queue
	* @param {Object} currentEdit
	*/
	renderQueue(queue, currentEdit, type = this.wikishield.queue.currentQueueTab) {
		this.updateQueueTabsCounts();
		if (type !== this.wikishield.queue.currentQueueTab) {
			return;
		}

		const container = this.elem("#queue-items");
		if (queue.length === 0) {
			container.innerHTML = `
				<div class="queue-empty">
					No edits in queue.
				</div>
			`;

			if (this.lastCurrentEdit[this.wikishield.queue.currentQueueTab] !== currentEdit) {
				this.lastCurrentEdit[this.wikishield.queue.currentQueueTab] = currentEdit;
				this.newEditSelected(currentEdit);
			}

			return;
		}

		// Build a map of existing DOM elements
		const domMap = new Map();
		for (const el of container.children) {
			domMap.set(+el.dataset.revid, el);
		}

		let previous = null;
		for (const edit of queue) {
			let elem = domMap.get(edit.revid);
			if (!elem) {
				elem = document.createElement("div");
				elem.classList.add("queue-edit");
				elem.dataset.revid = edit.revid.toString();
				elem.dataset.type = type;
				elem.innerHTML = this.generateEditHTML(edit);

				if (edit.mentionsMe && this.wikishield.storage.data.settings.username_highlighting.enabled) {
					elem.classList.add("queue-edit-mentions-me");
					elem.dataset.tooltip = "This edit contains your username";
					this.addTooltipListener(elem);
				}

				// --- Attach context menu ---
				elem.addEventListener("contextmenu", (event) => {
					event.preventDefault();

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
					{ // users whitelist & highlight
						const username = edit.user.name;

						const contextWhitelistBtn = contextMenu.querySelector("#context-whitelist-user");
						if (contextWhitelistBtn) {
							contextWhitelistBtn.textContent = this.wikishield.storage.data.whitelist.users.has(username) ? "Unwhitelist user" : "Whitelist user";
							contextWhitelistBtn.addEventListener("click", () => {
								if (this.wikishield.whitelist.users.has(username)) {
									this.wikishield.executeScript({
										actions: [
											{
												name: "unwhitelistUser",
												params: {}
											}
										]
									}, undefined, undefined, edit);
								} else {
									this.wikishield.executeScript({
										actions: [
											{
												name: "whitelistUser",
												params: {}
											}
										]
									}, undefined, undefined, edit);
								}

								contextWhitelistBtn.textContent = this.wikishield.storage.data.whitelist.users.has(username) ? "Unwhitelist user" : "Whitelist user";

								this.renderQueue(this.wikishield.queue.queue[this.wikishield.queue.currentQueueTab], this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab]);
								contextMenu.remove();
							});
						}

						const contextHighlightBtn = contextMenu.querySelector("#context-highlight-user");
						if (contextHighlightBtn) {
							contextHighlightBtn.textContent = this.wikishield.storage.data.highlight.users.has(username) ? "Unhighlight user" : "Highlight user";
							contextHighlightBtn.addEventListener("click", () => {
								if (this.wikishield.storage.data.highlight.users.has(username)) {
									this.wikishield.executeScript({
										actions: [
											{
												name: "unhighlightUser",
												params: {}
											}
										]
									}, undefined, undefined, edit);
								} else {
									this.wikishield.executeScript({
										actions: [
											{
												name: "highlightUser",
												params: {}
											}
										]
									}, undefined, undefined, edit);
								}

								contextHighlightBtn.textContent = this.wikishield.storage.data.highlight.users.has(username) ? "Unhighlight user" : "Highlight user";

								this.renderQueue(this.wikishield.queue.queue[this.wikishield.queue.currentQueueTab], this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab]);
								contextMenu.remove();
							});
						}
					}

					{ // pages whitelist & highlight
						const pageTitle = edit.page.title;

						const contextWhitelistBtn = contextMenu.querySelector("#context-whitelist-page");
						if (contextWhitelistBtn) {
							contextWhitelistBtn.textContent = this.wikishield.storage.data.whitelist.pages.has(pageTitle) ? "Unwhitelist page" : "Whitelist page";
							contextWhitelistBtn.addEventListener("click", () => {
								if (this.wikishield.whitelist.pages.has(pageTitle)) {
									this.wikishield.executeScript({
										actions: [
											{
												name: "unwhitelistPage",
												params: {}
											}
										]
									}, undefined, undefined, edit);
								} else {
									this.wikishield.executeScript({
										actions: [
											{
												name: "whitelistPage",
												params: {}
											}
										]
									}, undefined, undefined, edit);
								}

								contextWhitelistBtn.textContent = this.wikishield.storage.data.whitelist.pages.has(pageTitle) ? "Unwhitelist page" : "Whitelist page";

								this.renderQueue(this.wikishield.queue.queue[this.wikishield.queue.currentQueueTab], this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab]);
								contextMenu.remove();
							});
						}

						const contextHighlightBtn = contextMenu.querySelector("#context-highlight-page");
						if (contextHighlightBtn) {
							contextHighlightBtn.textContent = this.wikishield.storage.data.highlight.pages.has(pageTitle) ? "Unhighlight page" : "Highlight page";
							contextHighlightBtn.addEventListener("click", () => {
								if (this.wikishield.storage.data.highlight.pages.has(pageTitle)) {
									this.wikishield.executeScript({
										actions: [
											{
												name: "unhighlightPage",
												params: {}
											}
										]
									}, undefined, undefined, edit);
								} else {
									this.wikishield.executeScript({
										actions: [
											{
												name: "highlightPage",
												params: {}
											}
										]
									}, undefined, undefined, edit);
								}

								contextHighlightBtn.textContent = this.wikishield.storage.data.highlight.pages.has(pageTitle) ? "Unhighlight page" : "Highlight page";

								const _queue_ = this.wikishield.queue;
								this.renderQueue(_queue_.queue[_queue_.currentQueueTab], _queue_.currentEdit[_queue_.currentQueueTab]);
								contextMenu.remove();
							});
						}
					}

					// Remove item
					contextMenu.querySelector("#context-remove").addEventListener("click", () => {
						this.wikishield.audioManager.playSound([ "ui", "click" ]);
						if (this.wikishield.AI) {
							this.wikishield.AI.cancel.edit(edit.revid);
						}

						const currentIndex = queue.findIndex(e => e.revid === edit.revid);
						if (currentIndex !== -1) {
							const _queue_ = this.wikishield.queue;

							queue.splice(currentIndex, 1);
							this.removeQueueItem(_queue_.currentQueueTab, edit.revid);

							if (edit === currentEdit) {
								if (queue.length > 0) {
									if (currentIndex < queue.length) {
										_queue_.currentEdit[_queue_.currentQueueTab] = queue[currentIndex];
									} else {
										_queue_.currentEdit[_queue_.currentQueueTab] = queue[queue.length - 1];
									}
								} else {
									_queue_.currentEdit[_queue_.currentQueueTab] = null;
								}
							}

							const previousItems = _queue_.previousItems[_queue_.currentQueueTab];
							previousItems.push({ ...editWeAreLeaving, fromHistory: Date.now() });
							if (previousItems.length > 1000) { // prevent theoretical memory leak, keep only the last 1000 previous items
								previousItems.shift();
							}

							this.renderQueue(_queue_.queue[_queue_.currentQueueTab], _queue_.currentEdit[_queue_.currentQueueTab]);
						}
						contextMenu.remove();
					});

					// Open history
					contextMenu.querySelector("#context-open-history").addEventListener("click", (e) => {
						const url = this.wikishield.util.pageLink(`Special:PageHistory/${edit.page.title}`);
						window.open(url, "_blank");
						contextMenu.remove();
					});

					// Open contributions
					contextMenu.querySelector("#context-open-contribs").addEventListener("click", (e) => {
						const url = this.wikishield.util.pageLink(`Special:Contributions/${edit.user.name}`);
						window.open(url, "_blank");
						contextMenu.remove();
					});

					contextMenu.addEventListener("click", e => e.stopPropagation());
				});

				elem.addEventListener("click", () => {
					this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab] = edit;
					this.renderQueue(this.wikishield.queue.queue[this.wikishield.queue.currentQueueTab], edit);
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

		if (this.lastCurrentEdit[this.wikishield.queue.currentQueueTab] !== currentEdit) {
			this.lastCurrentEdit[this.wikishield.queue.currentQueueTab] = currentEdit;
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
	generateEditHTML(edit, includeORES = true, includeTitle = true, includeUser = true, includeTime = true) {
		let tagHTML = "";

		const highlightedTags = this.wikishield.storage.data.highlight.tags;
		if (edit.tags && Array.isArray(edit.tags)) {
			const cache = new Map();
			edit.tags.sort((a, b) => {
				let aScore;
				if (cache.has(a)) {
					aScore = cache.get(a);
				} else {
					aScore = highlightedTags.has(a) ? 0 : 1;
					cache.set(a, aScore);
				}

				let bScore;
				if (cache.has(b)) {
					bScore = cache.get(b);
				} else {
					bScore = highlightedTags.has(b) ? 0 : 1;
					cache.set(b, bScore);
				}

				return aScore - bScore;
			});

			for (const tag of edit.tags) {
				tagHTML += `<span class="queue-edit-tag ${highlightedTags.has(tag) ? "queue-highlight" : ""}">${tag}</span>`;
			}
		}

		const diff = edit.sizediff || 0;
		const summaryTruncated = edit.comment ? this.wikishield.util.escapeHtml(this.wikishield.util.maxStringLength(edit.comment, 100)) : "";
		const summaryFull = edit.comment ? this.wikishield.util.escapeHtml(edit.comment) : "";

		// Add minor edit indicator before summary
		const minorIndicator = edit.minor ? `<span class="minor-indicator" data-tooltip="Minor edit">m</span> ` : "";

		// Format ORES score for display
		const oresScore = edit.ores || 0;
		const oresPercent = Math.round(oresScore * 100);

		const oresHTML = includeORES ? `<div class="queue-edit-color" data-ores-score="${oresPercent}%" data-raw-ores-score="${oresScore}" style="background: ${this.getORESColor(oresScore)};"></div>` : "";
		const titleHTML = includeTitle ? `
				<div
					class="queue-edit-title ${this.wikishield.storage.data.highlight.pages.has(edit.page ? edit.page.title : edit.title) ? "queue-highlight" : ""}"
					data-tooltip="${edit.page ? edit.page.title : edit.title}"
				>
					<span class="fa fa-file-lines queue-edit-icon"></span>
					${edit.page ? edit.page.title : edit.title}
				</div>` : "";

		// Determine user highlight classes
		let userClasses = "";
		if (edit.user && this.wikishield.storage.data.highlight.users.has(typeof edit.user === "string" ? edit.user : edit.user.name)) {
			userClasses += " queue-highlight";
		} else if (edit.user && typeof edit.user === "object" && edit.user.emptyTalkPage) {
			userClasses += " queue-user-empty-talk";
		}

		const userHTML = includeUser ? `
				<div class="queue-edit-user ${userClasses}">
					<span class="fa fa-user queue-edit-icon"></span>
					<span class=${edit.user?.blocked ? "user-blocked" : ""}>
						${!edit.user ? "<em>Username removed</em>" : typeof edit.user === "string" ? edit.user : edit.user.name}
					</span>
				</div>` : "";
		const timeHTML = includeTime ? `
				<div class="queue-edit-time" data-tooltip="${new Date(edit.timestamp).toUTCString()}">
					<span class="fa fa-clock queue-edit-icon"></span>
					${this.wikishield.util.timeAgo(edit.timestamp)}
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
				<div class="queue-edit-change" style="${Math.abs(diff) >= 500 ? "font-weight: bold;" : ""}color: ${this.wikishield.util.getChangeColor(diff)}">
					${this.wikishield.util.getChangeString(diff)}
				</div>
			`;
	}

	/**
	* Update the main container when a new edit is selected
	* @param {Object} edit
	*/
	async newEditSelected(edit) {
		this.currentEditAbortController?.abort();

		const abortController = new AbortController();
		this.currentEditAbortController = abortController;

		this.elem("#latest-edits-tab").classList.add("hidden");
		this.elem("#consecutive-edits-tab").classList.add("hidden");

		this.elem("#user-report-uaa").style.display = edit?.user?.name && (edit.user.ip || edit.user.temporary) ? "none" : "";

		document.querySelectorAll("#right-top > .icons > :not(.hidden)").forEach(el => el.classList.add("hidden"));

		this.hide3RRNotice();
		this.hideNewerEditButton();
		this.hideCannotReviewFlaggedRevisionNotice();

		// Close all bottom menu popups when switching pages
		this.closeAllMenus();

		const userContribsLevel = this.elem("#user-warn-level");
		const contribsContainer = this.elem("#user-contribs-content"),
		historyContainer = this.elem("#page-history-content");

		contribsContainer.innerHTML = "";
		historyContainer.innerHTML = "";

		// Remove any existing tooltips when switching diffs
		this.removeTooltips();

		document.querySelector("#pending-changes-container").classList.toggle("hidden", !this.wikishield.queue.flaggedRevisions.has(edit?.revid));
		if (edit === null) {
			this.elem("#middle-top").innerHTML = "";
			this.elem("#page-metadata").innerHTML = "";
			this.elem("#user-contribs-count").innerText = "";
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

			// Hide block count indicator
			const blockIndicator = document.querySelector("#user-contribs #user-block-count");
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

		if (this.wikishield.AI) {
			const storage = this.wikishield.storage.data;
			if (edit.AI.edit === null && storage.settings.AI.edit_analysis.enabled) {
				this.wikishield.AI.analyze.edit(edit)
					.then(analysis => {
						edit.AI.edit = analysis;
					})
					.catch(err => {
						edit.AI.edit = {
							error: err.message
						};
					})
					.finally(() => {
						if (this.currentEdit?.revid === edit.revid) {
							this.wikishield.interface.updateAIAnalysisDisplay(analysis);
						}
					});
			}

			if (edit.AI.username === null && !(edit.user.ip || edit.user.temporary) && !storage.whitelist.users.has(edit.user) && storage.settings.AI.username_analysis.enabled && false) { // TEMP remove false
				this.wikishield.AI.analyze.username(edit)
					.then(usernameAnalysis => {
						edit.AI.username = usernameAnalysis;

						// TODO add .promptForUAAReport() here
					})
					.catch(err => {
						edit.AI.username = {
							error: err.message
						};
					});
			}
		}

		if (!edit.seen) {
			edit.seen = true;

			this.wikishield.storage.data.statistics.edits_reviewed.total++;

			switch (this.wikishield.queue.currentQueueTab) {
				case "recent": {
					this.wikishield.storage.data.statistics.recent_changes_reviewed.total++;
				} break;
				case "flagged": {
					this.wikishield.storage.data.statistics.pending_changes_reviewed.total++;
				} break;
				case "watchlist": {
					this.wikishield.storage.data.statistics.watchlist_changes_reviewed.total++;
				} break;
			}
		}

		// Stop checking for newer revisions on the previous edit
		this.stopNewerRevisionCheck();

		// Start checking for newer revisions on THIS Wikipedia page
		this.startNewerRevisionCheck(edit);


		if (!edit.__FLAGGED__) {
			edit.consecutive.then(data => {
				// no longer most recent edit
				if (!Object.is(this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab], edit)) {
					return;
				}

				// don't show button if user created page, no longer most recent, or if there is only 1 edit
				if (data.count <= 1 || typeof data.priorRev === "string") {
					if (data.priorRev === "created") {
						this.elem("#right-top > .icons > .created-page").classList.remove("hidden");
					}

					return;
				}

				this.elem("#latest-edits-tab").classList.remove("hidden");
				this.elem("#consecutive-edits-tab").classList.remove("hidden");
			});
		}

		userContribsLevel.style.display = "initial";
		userContribsLevel.style.background = warningTemplateColors[edit.user.warningLevel] || "grey";
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
			const warningHistory = edit.user.warningHistory;
			if (warningHistory.length > 0) {
				let tooltipHtml = '<div class="tooltip-title">Warning History</div>';
				warningHistory.slice(0, 5).forEach(warning => {
					const templateDisplay = `${warning.template}${warning.level}`;
					const userInfo = warning.username ? `(User:${this.wikishield.util.escapeHtml(warning.username)})` : "";
					const timeInfo = warning.timestamp ? `${this.wikishield.formatNotificationTime(new Date(warning.timestamp))}` : "";
					tooltipHtml += `<div class="tooltip-item user-warnings">`;
					tooltipHtml += `<span class="tooltip-item-level">${this.wikishield.util.escapeHtml(templateDisplay)}</span>`;
					tooltipHtml += `<div class="tooltip-item-details">`;
					tooltipHtml += `<span class="tooltip-item-user">${this.wikishield.util.escapeHtml(userInfo)}</span>`;
					tooltipHtml += `<br><span class="tooltip-item-time">${this.wikishield.util.escapeHtml(timeInfo)}</span>`;
					tooltipHtml += `</div>`;
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

			addToolipToWarningLevel();
		} else {
			userContribsLevel.setAttribute("data-tooltip", "No warnings");
			userContribsLevel.setAttribute("data-tooltip-html", "false");

			addToolipToWarningLevel();
		}

		this.elem("#user-contribs-count").innerText = edit.user.editCount === -1 ? "N/A edits"
		: edit.user.editCount + " edit" + (edit.user.editCount === 1 ? "" : "s");

		const summaryTruncated = edit.comment ? this.wikishield.util.escapeHtml(this.wikishield.util.maxStringLength(edit.comment, 150)) : "";
		const summaryFull = edit.comment ? this.wikishield.util.escapeHtml(edit.comment) : "";
		const minorIndicator = edit.minor ? `<span class="minor-indicator" data-tooltip="Minor edit">m</span> ` : "";
		const title = this.wikishield.util.escapeHtml(this.wikishield.util.maxStringLength(edit.page.title, 50));
		const titleFull = this.wikishield.util.escapeHtml(edit.page.title);
		const username = this.wikishield.util.escapeHtml(this.wikishield.util.maxStringLength(edit.user.name, 30));
		const usernameFull = this.wikishield.util.escapeHtml(edit.user.name);

		this.elem("#middle-top").innerHTML = `
				<div class="middle-top-line">
					${edit.display.pageTitle}
					${edit.display.username}
					<div>
						<span class="fa fa-pencil"></span>
						<span id="diff-size-text" style="color: ${this.wikishield.util.getChangeColor(0)}">${this.wikishield.util.getChangeString(0)}</span>
					</div>
				</div>
				<div class="middle-top-comment">

				</div>
			`;

		{ // users whitelist & highlight buttons
			const addWhitelistButton = this.elem("#user-whitelist");
			const removeWhitelistButton = this.elem("#user-unwhitelist");
			if (addWhitelistButton && removeWhitelistButton) {
				const func = () => {
					const isWhitelisted = this.wikishield.storage.data.whitelist.users.has(edit.user.name);
					if (isWhitelisted) {
						addWhitelistButton.style = "display: none;";
						removeWhitelistButton.style = "";
					} else {
						addWhitelistButton.style = "";
						removeWhitelistButton.style = "display: none;";
					}
				};

				addWhitelistButton.onclick = func;
				removeWhitelistButton.onclick = func;

				func();
			}

			const highlightButton = this.elem("#user-highlight");
			const unhighlightButton = this.elem("#user-unhighlight");
			if (highlightButton && unhighlightButton) {
				const func = () => {
					const isHighlighted = this.wikishield.storage.data.highlight.users.has(edit.user.name);
					if (isHighlighted) {
						highlightButton.style = "display: none;";
						unhighlightButton.style = "";
					} else {
						highlightButton.style = "";
						unhighlightButton.style = "display: none;";
					}
				};

				highlightButton.onclick = func;
				unhighlightButton.onclick = func;

				func();
			}
		}

		{ // pages whitelist & highlight buttons
			const addWhitelistButton = this.elem("#page-whitelist");
			const removeWhitelistButton = this.elem("#page-unwhitelist");
			if (addWhitelistButton && removeWhitelistButton) {
				// FIX, broken by context menu (and vice versa)
				const func = () => {
					const isWhitelisted = this.wikishield.storage.data.whitelist.pages.has(edit.page.title);
					if (isWhitelisted) {
						addWhitelistButton.style = "display: none;";
						removeWhitelistButton.style = "";
					} else {
						addWhitelistButton.style = "";
						removeWhitelistButton.style = "display: none;";
					}
				};

				addWhitelistButton.onclick = func;
				removeWhitelistButton.onclick = func;

				func();
			}

			const highlightButton = this.elem("#page-highlight");
			const unhighlightButton = this.elem("#page-unhighlight");
			if (highlightButton && unhighlightButton) {
				// FIX, broken by context menu (and vice versa)
				const func = () => {
					const isHighlighted = this.wikishield.storage.data.highlight.pages.has(edit.page.title);
					if (isHighlighted) {
						highlightButton.style = "display: none;";
						unhighlightButton.style = "";
					} else {
						highlightButton.style = "";
						unhighlightButton.style = "display: none;";
					}
				};

				highlightButton.onclick = func;
				unhighlightButton.onclick = func;

				func();
			}
		}

		// Load protection info and display in page history header
		{
			const protIndicator = document.querySelector("#page-history #protection-indicator");
			if (protIndicator) {
				const protection = edit.page.protection;
				if (protection.protected) {
					let icon = "🔒";
					let tooltip = "Protected";

					if (protection.level === "full") {
						icon = "🔒";
						tooltip = "Fully protected";
					} else if (protection.level === "extended") {
						icon = "🔐";
						tooltip = "Extended confirmed protected";
					} else if (protection.level === "semi") {
						icon = "🔓";
						tooltip = "Semi-protected";
					}

					protIndicator.innerHTML = `<span style="cursor: help;" data-tooltip="${tooltip}">${icon}</span>`;
					this.addTooltipListener(protIndicator.querySelector("[data-tooltip]"));
				} else {
					protIndicator.innerHTML = "";
				}
			}
		};

		{
			const blockIndicator = document.querySelector("#user-contribs #user-block-count");
			if (blockIndicator) {
				const blocks = edit.user.blocks;
				if (blocks.length > 0) {
					let tooltipHtml = `<div class="tooltip-title">Block History</div>`;
					for (const block of blocks) {
						let blockerName = block.user || "Unknown";
						blockerName = blockerName.replace(/<[^>]*>/g, '');

						let duration = block.params?.duration || "Unknown duration";
						duration = duration.replace(/<[^>]*>/g, '');

						let reason = block.comment || "No reason specified";
						const timestamp = block.timestamp ? this.wikishield.formatNotificationTime(new Date(block.timestamp)) : "";

						const userInfo = blockerName ? `(User:${this.wikishield.util.escapeHtml(blockerName)})` : "";

						tooltipHtml += `<div class="tooltip-item user-blocks">`;

						// equivalent to template + level
						tooltipHtml += `<span class="tooltip-item-level">${this.wikishield.util.maxStringLength(reason, 100)}</span>`;

						// same formatting as warning username
						tooltipHtml += `<div class="tooltip-item-details">`;
						tooltipHtml += `<span class="tooltip-item-user">${this.wikishield.util.escapeHtml(userInfo)}</span>`;
						tooltipHtml += `<br><span class="tooltip-item-time">${this.wikishield.util.escapeHtml(duration)} (${this.wikishield.util.escapeHtml(timestamp)} ago)</span>`;
						tooltipHtml += `</div>`;

						tooltipHtml += `</div>`;
					}

					blockIndicator.style.display = "initial";
					blockIndicator.setAttribute("data-tooltip", tooltipHtml);
					blockIndicator.setAttribute("data-tooltip-html", "true");
					blockIndicator.innerHTML = `${blocks.length}&times;`;
					blockIndicator.style.cursor = "help";
					this.addTooltipListener(blockIndicator);
				} else {
					blockIndicator.style.display = "none";
					blockIndicator.innerHTML = "";
					blockIndicator.removeAttribute("data-tooltip");
					blockIndicator.removeAttribute("data-tooltip-html");
				}
			}
		};

		// Add tooltip listeners to the new elements
		[...this.elem("#middle-top").querySelectorAll("[data-tooltip]")].forEach(e => {
			this.addTooltipListener(e);
		});

		// Update page metadata display
		const metadataElem = this.elem("#page-metadata");
		if (metadataElem) {
			const parts = Object.values(edit.page.metadata).filter(v => v && v !== "Unknown");
			metadataElem.innerHTML = parts.join(" • ");
		}

		const loadUserContribs = async (signal) => {
			const _queue_ = this.wikishield.queue;
			const contribs = edit.user.contribs;

			const items = await _queue_.generateQueueItems(contribs.map(edit => ({ type: "contribs", edit, simple: true })));
			if (signal.aborted) return;

			for (const item of items) {
				const current = item.revid === _queue_.currentEdit[_queue_.currentQueueTab].revid ? "queue-edit-current" : "";
				const $edit = document.createElement("div");
				$edit.className = `queue-edit ${current}`;
				$edit.innerHTML = this.generateEditHTML(item);
				contribsContainer.appendChild($edit);

				$edit.addEventListener("click", () => _queue_.loadFromContribs(item));
			}
		};
		loadUserContribs(abortController.signal);

		const loadPageHistory = async (signal) => {
			const _queue_ = this.wikishield.queue;
			const history = edit.page.history;

			const items = await _queue_.generateQueueItems(history.map(edit => ({ type: "history", edit, simple: true })));
			if (signal.aborted) return;

			for (const item of items) {
				const current = item.revid === _queue_.currentEdit[_queue_.currentQueueTab].revid ? "queue-edit-current" : "";
				const $edit = document.createElement("div");
				$edit.className = `queue-edit ${current}`;
				$edit.innerHTML = this.generateEditHTML(item);
				historyContainer.appendChild($edit);

				$edit.addEventListener("click", () => _queue_.loadFromHistory(item));
			}
		};
		loadPageHistory(abortController.signal);

		[
			...contribsContainer.querySelectorAll("[data-tooltip]"),
			...historyContainer.querySelectorAll("[data-tooltip]")
		].forEach(elem => this.addTooltipListener(elem));

		[...contribsContainer.querySelectorAll(".queue-edit")].forEach(elem => {
			elem.addEventListener("click", () => this.wikishield.queue.loadFromContribs(elem.dataset.revid));
		});

		[...historyContainer.querySelectorAll(".queue-edit")].forEach(elem => {
			elem.addEventListener("click", () => this.wikishield.queue.loadFromHistory(elem.dataset.revid));
		});

		// Remove any existing old edit notice
		const existingNotice = document.querySelector("#old-edit-notice");
		if (existingNotice) {
			existingNotice.remove();
		}

		// Display AI analysis if available
		this.updateAIAnalysisDisplay(edit.aiAnalysis);

		this.hide3RRNotice();
		if (edit.reverts >= 3) {
			this.show3RRNotice(edit.reverts);
		}

		this.updateDiffContainer(edit, false);
	}

	updateDiffContainer(edit, showConsecutive = false) {
		if (!edit) {
			return;
		}

		const $diff = this.elem("#diff-container");

		document.querySelectorAll("#right-top > .tabs > .tab.selected").forEach(el => el.classList.remove("selected"));

		const flagged = this.wikishield.queue.flaggedRevisions.get(edit.revid);
		if (flagged) {
			const $diffSize = this.elem("#diff-size-text");
			const sizediff = flagged.diff_size || 0;
			$diffSize.innerHTML = this.wikishield.util.getChangeString(sizediff);
			$diffSize.style.color = this.wikishield.util.getChangeColor(sizediff);

			const numOfUsers = Object.values(flagged.users).length;

			this.elem("#middle-top > .middle-top-comment").innerHTML = `
				<div>
					<span class="fa fa-edit"></span>
					<span id="flagged-edits">${flagged.count} edit${flagged.count === 1 ? "" : "s"}</span>
				</div>
				<div>
					<span class="fa fa-user"></span>
					<span id="flagged-users">${numOfUsers} user${numOfUsers === 1 ? "" : "s"}</span>
				</div>
				<div>
					<span class="fa fa-clock"></span>
					<span id="consecutive-time" data-tooltip="${flagged.oldTimestamp}">
						over the course of ${this.wikishield.formatNotificationTime(new Date(flagged.oldTimestamp))}
					</span>
				</div>
			`;
			this.addTooltipListener(this.elem("#consecutive-time"));

			$diff.innerHTML = `<table>${edit.diff ?? "No diff could be found"}</table>`;
		} else if (showConsecutive) {
			this.elem("#consecutive-edits-tab").classList.add("selected");

			$diff.innerHTML = `<table></table>`;

			edit.consecutive.then(data => {
				if (!Object.is(this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab], edit)) {
					return; // no longer most recent edit
				}

				const $diffSize = this.elem("#diff-size-text");
				$diffSize.innerHTML = this.wikishield.util.getChangeString(data.totalSizediff || 0);
				$diffSize.style.color = this.wikishield.util.getChangeColor(data.totalSizediff || 0);

				this.elem("#middle-top > .middle-top-comment").innerHTML = `
					<div>
						<span class="fa fa-edit"></span>
						<span id="consecutive-edits">${data.count} edit${data.count === 1 ? "" : "s"}</span>
					</div>
					<div>
						<span class="fa fa-clock"></span>
						<span id="consecutive-time" data-tooltip="${data.oldestTimestamp}">
							over the course of ${this.wikishield.formatNotificationTime(new Date(data.oldestTimestamp))}
						</span>
					</div>
				`;
				this.addTooltipListener(this.elem("#consecutive-time"));

				$diff.innerHTML = `<table>${data.diff ?? "No diff could be found"}</table>`;
			});
		} else {
			this.elem("#latest-edits-tab").classList.add("selected");

			$diff.innerHTML = `<table>${edit.diff ?? "No diff could be found"}</table>`;

			const $diffSize = this.elem("#diff-size-text");
			$diffSize.innerHTML = this.wikishield.util.getChangeString(edit.sizediff || 0);
			$diffSize.style.color = this.wikishield.util.getChangeColor(edit.sizediff || 0);

			const minorIndicator = edit.minor ? `<span class="minor-indicator" data-tooltip="Minor edit">m</span> ` : "";
			const summaryTruncated = edit.comment ? this.wikishield.util.escapeHtml(this.wikishield.util.maxStringLength(edit.comment, 100)) : "";
			const summaryFull = edit.comment ? this.wikishield.util.escapeHtml(edit.comment) : "";

			const $summary = this.elem("#middle-top > .middle-top-comment");
			$summary.innerHTML = `
				<span class="fa fa-comment-dots"></span>
				<span class="summary" data-tooltip="${summaryFull}">${minorIndicator}${summaryTruncated || "<em>No summary provided</em>"}</span>
			`;

			this.addTooltipListener($summary.querySelector(".summary"));
		}

		$diff.querySelectorAll(":is(.mw-diff-movedpara-left, .mw-diff-movedpara-right)").forEach(elem => {
			const href = elem.href.split("#")[1];
			delete elem.href; // Remove default link behavior
			elem.addEventListener("click", (e) => {
				e.preventDefault();

				$diff.querySelector(`a[name="${href}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
			});
		});

		if (this.wikishield.storage.data.settings.username_highlighting.enabled) {
			const currentUsername = mw.config.get("wgUserName");
			if (currentUsername) {
				const diffContainer = this.elem("#diff-container");
				// Find all elements (typically td cells) in the diff
				const allElements = diffContainer.querySelectorAll("td");

				allElements.forEach(elem => {
					if (this.wikishield.util.usernameMatch(currentUsername, elem.textContent)) {
						elem.style.outline = "2px solid #ffc107";
						elem.style.outlineOffset = "-2px";
					}
				});
			}
		}

		const firstChange = $diff.querySelector(".diff-addedline, .diff-deletedline");
		if (firstChange) {
			// Use setTimeout to ensure the DOM is fully rendered before scrolling
			setTimeout(() => {
				firstChange.scrollIntoView({ behavior: "smooth", block: "center" });
			}, 100);
		}
	}

	/**
	* Update or create AI analysis display
	* @param {Object} analysis The AI analysis object
	*/
	updateAIAnalysisDisplay(analysis) {
		return; // AI analysis temporarily disabled

		// Find or create AI analysis container
		let aiContainer = document.querySelector("#ai-analysis-container");

		if (!analysis) {
			// Remove AI container if no analysis
			if (aiContainer) {
				aiContainer.remove();
			}
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
					-webkit-backdrop-filter: blur(20px);
					backdrop-filter: blur(20px);
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
					" data-tooltip="${this.wikishield.util.escapeHtml(issue.description)}"
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
			'welcome': 'fa-paper-plane'
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
				color: #fff;
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
		if (diffContainer?.parentElement) {
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
				background: rgba(139, 92, 0, .15);
				border-left: 4px solid #c5a000;
				border-radius: 4px;
				color: #f0d48a;
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 0.9em;
				flex-shrink: 0;
			`;

		noticeDiv.innerHTML = `
				<span class="fa fa-clock-rotate-left"></span>
				<span style="flex: 1;">Newer revision available on this page</span>
				<a href="#" id="view-newest-edit" style="color: #a3c5ff; font-weight: 600; text-decoration: none; white-space: nowrap;">
					View latest →
				</a>
			`;

		// Insert before the diff container
		const diffContainer = this.elem("#diff-container");
		if (diffContainer?.parentElement) {
			diffContainer.parentElement.insertBefore(noticeDiv, diffContainer);

			// Add click handler
			document.getElementById("view-newest-edit").addEventListener("click", (e) => {
				e.preventDefault();
				const targetRevid = noticeDiv.getAttribute("data-target-revid");
				const targetPage = noticeDiv.getAttribute("data-target-page");

				if (targetRevid && targetPage) {
					this.wikishield.queue.loadSpecificRevision(Number(targetRevid), targetPage, true);
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

	showCannotReviewFlaggedRevisionNotice() {
		// Remove any existing notice first
		this.hideCannotReviewFlaggedRevisionNotice();

		// Create the notice using the same style as old-edit-notice
		const noticeDiv = document.createElement("div");
		noticeDiv.id = "cannot-review-flagged-revision-notice";
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
				<span class="fa fa-shield-alt"></span>
				<span style="flex: 1;">This revision cannot be reviewed because it is outdated</span>
			`;

		const diffContainer = this.elem("#diff-container");
		if (diffContainer?.parentElement) {
			diffContainer.parentElement.insertBefore(noticeDiv, diffContainer);
		}

		document.querySelector("#pending-changes-container")?.classList.add("hidden");
	}

	hideCannotReviewFlaggedRevisionNotice() {
		const existingNotice = document.querySelector("#cannot-review-flagged-revision-notice");
		if (existingNotice) {
			existingNotice.remove();
		}

		document.querySelector("#pending-changes-container")?.classList.remove("hidden");
	}

	/**
	* Start periodic checking for newer revisions on the current Wikipedia page
	* @param {Object} edit The current edit being viewed
	*/
	startNewerRevisionCheck(edit) {
		this.stopNewerRevisionCheck();

		this.checkForNewerRevision(edit);

		this.newerRevisionInterval = setInterval(() => {
			if (this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab]?.revid === edit.revid) {
				this.checkForNewerRevision(edit);
			} else {
				this.stopNewerRevisionCheck();
			}
		}, 1000);
	}

	/**
	* Stop periodic checking for newer revisions and hide the button
	*/
	stopNewerRevisionCheck() {
		if (this.newerRevisionInterval) {
			clearInterval(this.newerRevisionInterval);
			this.newerRevisionInterval = null;
		}
		this.hideNewerEditButton();
	}

	/**
	* Check if there's a newer revision on the current Wikipedia page
	* @param {Object} edit The current edit being viewed
	*/
	async checkForNewerRevision(edit) {
		if (edit.__FLAGGED__) {
			if (this.wikishield.queue.flaggedRevisions.has(edit.revid)) {
				this.hideCannotReviewFlaggedRevisionNotice();
			} else {
				this.showCannotReviewFlaggedRevisionNotice();
			}

			return;
		}

		try {
			const pageTitle = edit.page.title;
			const currentRevid = edit.revid;

			const latestRevisions = await this.wikishield.api.getLatestRevisions(pageTitle);
			const latestRevid = latestRevisions[pageTitle];

			if (!latestRevid) {
				this.hideNewerEditButton();
				return;
			}

			if (latestRevid > currentRevid) {
				this.showNewerEditButton(latestRevid, pageTitle);
			} else {
				this.hideNewerEditButton();
			}
		} catch (err) {
			console.error("Failed to check for newer revision:", err);
			this.hideNewerEditButton();
		}
	}

	/**
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

			elem.addEventListener("mousewheel", e => {
				tooltip.scrollBy(0, e.deltaY);
			});
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
	removeQueueItem(type, revid) {
		const elem = this.elem(`.queue-edit[data-type="${type}"][data-revid="${revid}"]`);

		if (elem) {
			elem.remove();
			this.updateQueueTabsCounts();
		}
	}

	/**
	* From the ORES score, get the color to display
	* @param {Number} ores The ORES score
	* @returns {String} The color to display
	*/
	getORESColor(ores) {
		const colors = colorPalettes[this.wikishield.storage.data.settings.theme.palette];
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
	* Show a toast alert on screen
	* @param {String} title - Title of the alert
	* @param {String} message - Message content
	* @param {Number} duration - How long to show (ms), default 5000
	*/
	showToast(title, message, duration = 5000, type = "default") {
		const zenMode = this.wikishield.storage.data.settings.zen_mode;
		if (zenMode.enabled && !zenMode.toasts.enabled) {
			return false;
		}

		// Create toast element
		const toast = document.createElement("div");
		toast.classList.add("toast-alert");

		// Add type class for styling
		if (type === "success") toast.classList.add("success");
		else if (type === "error") toast.classList.add("error");
		else if (type === "warning") toast.classList.add("warning");

		// Select icon based on type
		let icon = "⚠️"; // TODO use font awesome
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

		return true;
	}

	/**
	* Hide and remove a toast alert
	*/
	hideToast(toast) {
		if (!toast?.parentElement) return;

		toast.classList.add("hidden");
		setTimeout(() => {
			if (toast.parentElement) {
				toast.remove();
			}
		}, 300);
	}

	updateZenModeDisplay(updateMusic) {
		const zenMode = this.wikishield.storage.data.settings.zen_mode;
		if (updateMusic) {
			if (zenMode.enabled && zenMode.music.enabled) {
				this.wikishield.audioManager.playPlaylist(["music", "zen_mode"]);
			} else {
				this.wikishield.audioManager.stopPlaylist(["music", "zen_mode"]);
			}
		}

		document.querySelectorAll("[data-zen-show]").forEach(elem => {
			elem.style.display = zenMode.enabled && !zenMode[elem.dataset.zenShow].enabled ? "none" : "";
		});
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
						<button class="confirmation-modal-button confirmation-modal-button-cancel" style="--background: 211, 51, 51;">Cancel</button>
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
	showConfirmationDialog(title, message, username = null, hideUaaButton = false) {
		return new Promise((resolve) => {
			// Create overlay
			const overlay = document.createElement("div");
			overlay.classList.add("confirmation-modal-overlay");

			// Create modal
			const modal = document.createElement("div");
			modal.classList.add("confirmation-modal");

			const uaaButton = username ? `<button class="confirmation-modal-button confirmation-modal-button-uaa" style="--background: 211, 51, 51">Report to UAA</button>` : '';

			modal.innerHTML = `
					<div class="confirmation-modal-header">
						<div class="confirmation-modal-title">${this.escapeHtml(title)}</div>
					</div>
					<div class="confirmation-modal-body">${message}</div>
					<div class="confirmation-modal-footer">
						${hideUaaButton ? '' : uaaButton}
						<div class="confirmation-modal-footer-right">
							<button class="confirmation-modal-button confirmation-modal-button-no">No</button>
							<button class="confirmation-modal-button confirmation-modal-button-yes" style="--background: 51, 102, 204;">Yes</button>
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
							this.wikishield.executeScript({
								name: "reportToUAA",
								params: {
									reportMessage: reason,
								}
							}, undefined, undefined, { user: { name: username } }); // fake edit object

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

	addMouseTiltEffect(elem, multX = 10, multY = 10) {
		elem.addEventListener("mousemove", (e) => {
			const rect = elem.getBoundingClientRect();
			const cx = rect.left + rect.width / 2;
			const cy = rect.top + rect.height / 2;

			const dx = e.clientX - cx;
			const dy = e.clientY - cy;

			const rotateX =  (dy / rect.height) * -2 * multY;
			const rotateY = (dx / rect.width)  *  2 * multX;

			elem.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
		});

		elem.addEventListener("mouseleave", (e) => {
			elem.style.transform = `rotateX(0deg) rotateY(0deg)`;
		});
	}
}
