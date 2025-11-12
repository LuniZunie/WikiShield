/**
* WikiShieldInterface - Main UI management
* Handles rendering and managing the user interface
*/

import { WikiShieldEventManager } from '../core/event-manager.js';
import { WikiShieldSettingsInterface } from './settings.js';
import { wikishieldStyling } from './styles.js';
import { wikishieldHTML } from './templates.js';
import { __script__ } from '../index.js';
import { warnings, warningTemplateColors } from '../data/warnings.js';
import { colorPalettes } from '../config/defaults.js';

export class WikiShieldInterface {
	constructor(wikishield) {
		this.wikishield = wikishield;
		this.selectedWidthAdjust = null;
		this.startingSectionWidth = null;
		this.startingMouseX = null;
		this.lastCurrentEdit = null;
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

		// Always apply dark theme
		const style = document.createElement("style");
		style.classList.add("this.wikishield-theme");
		style.innerHTML = wikishieldStyling["theme-dark"];
		document.head.appendChild(style);

		// Set the data-theme attribute to dark
		document.documentElement.setAttribute("data-theme", "dark");

		// Add dark-mode class to body
		document.body.classList.add("dark-mode");

		// Save the theme preference (always dark)
		this.wikishield.options.theme = "theme-dark";
	}

	/**
	* Remove all theme stylesheets
	*/
	removeTheme() {
		document.querySelectorAll(".this.wikishield-theme, .this.wikishield-theme-base").forEach(elem => elem.remove());
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
		this.wikishield.soundEnabled = true; // Make sound state globally accessible

		// Function to play a synth tone
		const playSynthTone = (frequency, duration, volume = 0.15, type = 'sine') => {
			if (!this.wikishield.soundEnabled || !audioContext) return;

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
			this.wikishield.soundEnabled = !this.wikishield.soundEnabled;
			soundToggle.classList.toggle("muted");

			if (this.wikishield.soundEnabled) {
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

		if (this.wikishield.rights.rollback) {
			this.elem("#rollback-needed").style.display = "none";
			this.elem("#start-button").style.display = "";
		} else {
			this.elem("#rollback-needed").style.display = "";
			this.elem("#start-button").style.display = "none";
		}

		this.elem("#start-button").addEventListener("click", () => {
			// Stop the dots animation
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
			this.wikishield.start();
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
						this.createRevertMenu(menu, this.wikishield.queue.currentEdit);
					} break;
					case "warn": {
						menu.innerHTML = "";
						this.createWarnMenu(menu, this.wikishield.queue.currentEdit);
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
			this.elem("#watchlist-icon"),
			this.elem("#user-contribs-level")
		].forEach(e => this.addTooltipListener(e));

		// Notification icon click handler
		this.elem("#notifications-icon").addEventListener("click", (e) => {
			const panel = this.elem("#notifications-panel");
			panel.classList.toggle("show");
		});

		// Mark all as read handler
		this.elem("#mark-all-notifications-read").addEventListener("click", () => {
			this.wikishield.markAllNotificationsRead();
		});

		// Watchlist icon click handler
		this.elem("#watchlist-icon").addEventListener("click", (e) => {
			const panel = this.elem("#watchlist-panel");
			panel.classList.toggle("show");
		});

		// Mark all as read handler
		this.elem("#mark-all-watchlist-read").addEventListener("click", () => {
			this.wikishield.markAllWatchlistRead();
		});

		// Close notifications panel when clicking outside
		document.addEventListener("click", (e) => {
			for (const id of [ "notifications", "watchlist" ]) {
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
			this.updateDiffContainer(this.wikishield.queue.currentEdit, false);
		});
		this.addTooltipListener($latestTab);

		const $consecutiveTab = this.elem("#consecutive-edits-tab");
		$consecutiveTab.addEventListener("click", event => {
			this.updateDiffContainer(this.wikishield.queue.currentEdit, true);
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

		const savedQueueWidth = this.wikishield.queueWidth;
		const savedDetailsWidth = this.wikishield.detailsWidth;

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
				this.wikishield.queueWidth = queue.style.width;
			}
			if (this.selectedWidthAdjust === detailsWidthAdjust) {
				this.wikishield.detailsWidth = details.style.width;
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

		if (this.wikishield.loadedChangelog !== __script__.changelog.version) {
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
			await this.wikishield.executeScript({
				actions: [
					{
						name: "nextEdit",
						params: {}
					},
					{
						name: "rollback",
						params: {}
					},
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
						name: "highlight",
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

				const mouseIcon = document.createElement("span");
				mouseIcon.className = "fas fa-mouse-pointer";
				item.appendChild(mouseIcon);

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

				if (edit.mentionsMe && this.wikishield.options.enableUsernameHighlighting) {
					elem.classList.add("queue-edit-mentions-me");
					elem.dataset.tooltip = "This edit contains your username";
					this.addTooltipListener(elem);
				}

				// --- Attach context menu ---
				elem.addEventListener("contextmenu", (event) => {
					event.preventDefault();
					this.wikishield.queue.playClickSound();

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
						if (this.wikishield.whitelist.has(edit.user.name)) {
							contextWhitelistBtn.textContent = "Remove from whitelist";
						} else {
							contextWhitelistBtn.textContent = "Whitelist user";
						}
					}

					// Remove item
					contextMenu.querySelector("#context-remove").addEventListener("click", () => {
						this.wikishield.queue.playClickSound();
						if (this.wikishield.ollamaAI) {
							this.wikishield.ollamaAI.cancelAnalysis(edit.revid);
						}

						const currentIndex = queue.findIndex(e => e.revid === edit.revid);
						if (currentIndex !== -1) {
							queue.splice(currentIndex, 1);
							this.removeQueueItem(edit.revid);

							if (edit === currentEdit) {
								if (queue.length > 0) {
									if (currentIndex < queue.length) {
										this.wikishield.queue.currentEdit = queue[currentIndex];
									} else {
										this.wikishield.queue.currentEdit = queue[queue.length - 1];
									}
								} else {
									this.wikishield.queue.currentEdit = null;
								}
							}
							this.wikishield.queue.previousItems.push(edit);
							this.renderQueue(queue, this.wikishield.queue.currentEdit);
						}
						contextMenu.remove();
					});

					// Whitelist toggle
					contextMenu.querySelector("#context-whitelist").addEventListener("click", () => {
						this.wikishield.queue.playSparkleSound();

						if (this.wikishield.whitelist.has(edit.user.name)) {
							this.wikishield.whitelist.delete(edit.user.name);
							this.wikishield.logger.log(`Removed ${edit.user.name} from whitelist`);
						} else {
							this.wikishield.whitelist.set(edit.user.name, Date.now());
							this.wikishield.logger.log(`Added ${edit.user.name} to whitelist`);
						}

						this.renderQueue(this.wikishield.queue.queue, this.wikishield.queue.currentEdit);
						contextMenu.remove();
					});

					// Open history
					contextMenu.querySelector("#context-open-history").addEventListener("click", (e) => {
						this.wikishield.queue.playClickSound();
						const url = this.wikishield.util.pageLink(`Special:PageHistory/${edit.page.title}`);
						this.wikishield.interface.eventManager.openWikipediaLink(url, `History: ${edit.page.title}`, e);
						contextMenu.remove();
					});

					// Open contributions
					contextMenu.querySelector("#context-open-contribs").addEventListener("click", (e) => {
						this.wikishield.queue.playClickSound();
						const url = this.wikishield.util.pageLink(`Special:Contributions/${edit.user.name}`);
						this.wikishield.interface.eventManager.openWikipediaLink(url, `Contributions: ${edit.user.name}`, e);
						contextMenu.remove();
					});

					contextMenu.addEventListener("click", (mevent) => mevent.stopPropagation());
				});

				// --- Click to select ---
				elem.addEventListener("click", () => {
					this.wikishield.queue.currentEdit = edit;
					this.renderQueue(this.wikishield.queue.queue, edit);

					if (edit && this.wikishield.options.enableOllamaAI && this.wikishield.ollamaAI) {
						this.wikishield.ollamaAI.analyzeEdit(edit)
						.then(analysis => {
							edit.aiAnalysis = analysis;
							if (this.wikishield.queue.currentEdit === edit && this.wikishield.interface) {
								this.wikishield.interface.updateAIAnalysisDisplay(analysis);
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
		const summaryTruncated = edit.comment ? this.wikishield.util.escapeHtml(this.wikishield.util.maxStringLength(edit.comment, 100)) : "";
		const summaryFull = edit.comment ? this.wikishield.util.escapeHtml(edit.comment) : "";

		// Add minor edit indicator before summary
		const minorIndicator = edit.minor ? `<span class="minor-indicator" data-tooltip="Minor edit">m</span> ` : "";

		// Format ORES score for display
		const oresScore = edit.ores || 0;
		const oresPercent = Math.round(oresScore * 100);
		const oresLabel = oresPercent < 30 ? "Good" : oresPercent < 70 ? "Review" : "Likely Bad";

		const oresHTML = includeORES ? `<div class="queue-edit-color" data-ores-score="${oresPercent}%" data-raw-ores-score="${oresScore}" style="background: ${this.getORESColor(oresScore)};"></div>` : "";
		const titleHTML = includeTitle ? `
				<div class="queue-edit-title" data-tooltip="${edit.page ? edit.page.title : edit.title}">
					<span class="fa fa-file-lines queue-edit-icon"></span>
					${edit.page ? edit.page.title : edit.title}
				</div>` : "";

		// Determine user highlight classes
		let userClasses = "";
		if (edit.user && this.wikishield.highlighted.has(edit.user.name)) {
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
		this.elem("#latest-edits-tab").classList.add("hidden");
		this.elem("#consecutive-edits-tab").classList.add("hidden");

		document.querySelectorAll("#right-top > .icons > :not(.hidden)").forEach(el => el.classList.add("hidden"));

		this.hide3RRNotice();
		this.hideNewerEditButton();

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

		if (edit !== null) {
			edit.consecutive.then(data => {
				// no longer most recent edit
				if (!Object.is(this.wikishield.queue.currentEdit, edit)) {
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
			this.wikishield.api.getSinglePageContent(`User talk:${edit.user.name}`).then(talkContent => {
				const warningHistory = this.wikishield.queue.getWarningHistory(talkContent);
				if (warningHistory.length > 0) {
					let tooltipHtml = '<div class="tooltip-title">Warning History</div>';
					warningHistory.slice(0, 5).forEach(warning => {
						const templateDisplay = `${warning.template}${warning.level}`;
						const articleInfo = warning.article ? `<span class="tooltip-item-article"> (${this.wikishield.util.escapeHtml(warning.article)})</span>` : "";
						const userInfo = warning.username ? `User:${this.wikishield.util.escapeHtml(warning.username)}` : (warning.timestamp || warning.section);
						tooltipHtml += `<div class="tooltip-item">`;
						tooltipHtml += `<span class="tooltip-item-level">${this.wikishield.util.escapeHtml(templateDisplay)}</span>`;
						tooltipHtml += articleInfo;
						tooltipHtml += `<br><span class="tooltip-item-time">${this.wikishield.util.escapeHtml(userInfo)}</span>`;
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

		const summaryTruncated = edit.comment ? this.wikishield.util.escapeHtml(this.wikishield.util.maxStringLength(edit.comment, 150)) : "";
		const summaryFull = edit.comment ? this.wikishield.util.escapeHtml(edit.comment) : "";
		const minorIndicator = edit.minor ? `<span class="minor-indicator" data-tooltip="Minor edit">m</span> ` : "";
		const title = this.wikishield.util.escapeHtml(this.wikishield.util.maxStringLength(edit.page.title, 50));
		const titleFull = this.wikishield.util.escapeHtml(edit.page.title);
		const username = this.wikishield.util.escapeHtml(this.wikishield.util.maxStringLength(edit.user.name, 30));
		const usernameFull = this.wikishield.util.escapeHtml(edit.user.name);

		// Fetch page protection info and user block count
		const protectionPromise = this.wikishield.api.getPageProtection(edit.page.title);
		const blockCountPromise = this.wikishield.api.getBlockCount(edit.user.name);

		this.elem("#middle-top").innerHTML = `
				<div style="display: flex; overflow: auto hidden; white-space: nowrap">
					<div>
						<span class="fa fa-file-lines"></span>
						<a href="${this.wikishield.util.pageLink(edit.page.title)}" target="_blank" data-tooltip="${titleFull}">${title}</a>
					</div>
					<div>
						<span class="fa fa-user"></span>
						<a href="${this.wikishield.util.pageLink("Special:Contributions/" + edit.user.name)}" target="_blank" data-tooltip="${usernameFull}">${username}</a>
					</div>
					<div>
						<span class="fa fa-pencil"></span>
						<span id="diff-size-text" style="color: ${this.wikishield.util.getChangeColor(0)}">${this.wikishield.util.getChangeString(0)}</span>
					</div>
				</div>
				<div class="middle-top-comment">

				</div>
			`;

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
				if (this.wikishield.highlighted.has(edit.user.name)) {
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
			const isWhitelisted = this.wikishield.whitelist.has(edit.user.name);
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
			const isHighlighted = this.wikishield.highlighted.has(edit.user.name);
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
					const blockHistory = await this.wikishield.api.getBlockHistory(edit.user.name);

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
							tooltipHtml += `<span class="tooltip-item-level">By ${this.wikishield.util.escapeHtml(blockerName)}</span><br>`;
							tooltipHtml += `<span class="tooltip-item-time">${timestamp} • ${this.wikishield.util.escapeHtml(duration)}</span><br>`;
							tooltipHtml += `<span class="tooltip-item-article">${this.wikishield.util.escapeHtml(reason)}</span>`;
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
			const current = cedit.revid === this.wikishield.queue.currentEdit.revid ? "queue-edit-current" : "";

			contribsContainer.innerHTML += `
					<div class="queue-edit ${current}" data-revid="${cedit.revid}">
						${this.generateEditHTML(cedit, false, true, false, true)}
					</div>
				`;
		}

		for (const hedit of edit.page.history) {
			const current = hedit.revid === this.wikishield.queue.currentEdit.revid ? "queue-edit-current" : "";

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

		if (this.wikishield.options.enableUsernameHighlighting) {
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

		this.updateDiffContainer(edit, false);
	}

	updateDiffContainer(edit, showConsecutive = false) {
		if (!edit) {
			return;
		}

		document.querySelectorAll("#right-top > .tabs > .tab.selected").forEach(el => el.classList.remove("selected"));

		if (showConsecutive) {
			this.elem("#consecutive-edits-tab").classList.add("selected");

			this.elem("#diff-container").innerHTML = `<table></table>`;

			edit.consecutive.then(data => {
				if (!Object.is(this.wikishield.queue.currentEdit, edit)) {
					return; // no longer most recent edit
				}

				const $diffSize = this.elem("#diff-size-text");
				$diffSize.innerHTML = this.wikishield.util.getChangeString(data.totalSizediff || 0);
				$diffSize.style.color = this.wikishield.util.getChangeColor(data.totalSizediff || 0);

				this.elem("#middle-top > .middle-top-comment").innerHTML = `
					<div>
						<span class="fa fa-clock"></span>
						<span id="consecutive-time" data-tooltip="${data.oldestTimestamp}">${this.wikishield.formatNotificationTimeShort(new Date(data.oldestTimestamp))}</span>
					</div>
					<div>
						<span class="fa fa-edit"></span>
						<span id="consecutive-edits">${data.count}</span>
					</div>
				`;
				this.addTooltipListener(this.elem("#consecutive-time"));

				this.elem("#diff-container").innerHTML = `<table>${data.diff}</table>`;
			});
		} else {
			this.elem("#latest-edits-tab").classList.add("selected");

			this.elem("#diff-container").innerHTML = `<table>${edit.diff}</table>`;

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
					this.wikishield.queue.loadSpecificRevision(Number(targetRevid), targetPage);
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
			if (this.wikishield.queue.currentEdit && this.wikishield.queue.currentEdit.revid === edit.revid) {
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
			const latestRevisions = await this.wikishield.api.getLatestRevisions(pageTitle);
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
		const colors = colorPalettes[this.wikishield.options.selectedPalette];
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
								await this.wikishield.reportToUAA(username, reason);
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
