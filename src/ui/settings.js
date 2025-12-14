/**
* WikiShieldSettingsInterface - Settings UI management
* Handles the settings interface and user configuration
*/

import { h, render } from 'preact';
import { colorPalettes } from '../config/defaults.js';
import { namespaces } from '../data/namespaces.js';
import { wikishieldHTML } from './templates.js';
import { warningsLookup, getWarningFromLookup } from '../data/warnings.js';
import {
	GeneralSettings,
	PerformanceSettings,
	AudioSettings,

	QueueSettings,
	ZenSettings,

	WhitelistSettings,
	HighlightSettings,
	StatisticsSettings,
	AISettings,
	AutoReportingSettings,
	SaveSettings,
	AboutSettings
} from './settings-components.jsx';

import { AI } from '../ai/class.js';
import { validControlKeys } from '../config/control-keys.js';

export class WikiShieldSettingsInterface {
	constructor(wikishield) {
		this.wikishield = wikishield;
		this.contentContainer = null;
		this.isOpen = false;
		this.keypressCallback = null;
	}

	/**
	* Render a React component into a container
	* @param {Component} component The React component to render
	* @param {HTMLElement} container The container element (defaults to this.contentContainer)
	*/
	renderComponent(component, container = null) {
		const target = container || this.contentContainer;
		if (target) {
			// Unmount any previously-mounted Preact component and clear DOM to avoid
			// mixing manual innerHTML edits with Preact-managed DOM (causes
			// intermittent blank tabs).
			try {
				render(null, target);
			} catch (err) {
				// ignore unmount errors
			}
			while (target.firstChild) {
				target.removeChild(target.firstChild);
			}
			// Render the new component
			render(component, target);
		}
	}

	/**
	* Unmount any Preact component mounted in the content container and clear it.
	*/
	clearContent() {
		if (!this.contentContainer) return;
		try {
			render(null, this.contentContainer);
		} catch (err) {
			// ignore
		}
		while (this.contentContainer.firstChild) {
			this.contentContainer.removeChild(this.contentContainer.firstChild);
		}
	}

	setPath(...path) { // TODO
		return;
		const $content = document.querySelector(".settings-container > .settings > .settings-right");

		const $path = document.createElement("div");
		$path.classList.add("settings-path");

		let first = true;
		for (const segment of path) {
			if (first) {
				first = false;
			} else {
				const $divider = document.createElement("span");
				$divider.classList.add("settings-path-divider");
				$divider.innerHTML = "&rsaquo;";
				$path.appendChild($divider);
			}

			const $segment = document.createElement("span");
			$segment.classList.add("settings-path-segment");
			$segment.textContent = segment;
			$path.appendChild($segment);
		}

		$content.prepend($path);
	}

	createCollapsibleSection(container, callback, collapsed = true) {
		const content = container.querySelector(".collapsible-content");
		const header = container.querySelector(".collapse-title");

		// Dummy class for styling hooks
		content.classList.add("collapsible");

		// Set initial state instantly
		if (collapsed) {
			content.style.height = "0px";
			content.style.opacity = 0;
			content.style.overflow = "hidden";
			container.classList.add("collapsed");
		} else {
			content.style.height = "auto";
			content.style.opacity = 1;
			content.style.overflow = "visible";
			container.classList.remove("collapsed");
		}

		let animationFrame = null;
		let startTime = null;
		let startHeight = null;
		let targetHeight = null;
		let startOpacity = null;
		let targetOpacity = null;
		let isAnimating = false;

		const duration = 300; // ms
		const ease = t => t<.5 ? 2*t*t : -1+(4-2*t)*t; // easeInOut

		const animate = (timestamp) => {
			if (!startTime) startTime = timestamp;
			const elapsed = timestamp - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const eased = ease(progress);

			const currentHeight = startHeight + (targetHeight - startHeight) * eased;
			const currentOpacity = startOpacity + (targetOpacity - startOpacity) * eased;

			content.style.height = currentHeight + "px";
			content.style.opacity = currentOpacity;

			if (progress < 1) {
				animationFrame = requestAnimationFrame(animate);
			} else {
				// Finish animation
				if (!collapsed) {
					content.style.height = "auto"; // dynamic content can grow
					content.style.overflow = "visible";
				} else {
					content.style.overflow = "hidden";
				}
				isAnimating = false;
				animationFrame = null;
				startTime = null;
			}
		};

		const toggleDisplay = () => {
			if (isAnimating) {
				cancelAnimationFrame(animationFrame);
				// Compute current state for smooth reverse
				const computedHeight = content.getBoundingClientRect().height;
				startHeight = computedHeight;
				startOpacity = parseFloat(getComputedStyle(content).opacity);
			} else {
				startHeight = collapsed ? 0 : content.scrollHeight;
				startOpacity = collapsed ? 0 : 1;
			}

			collapsed = !collapsed;
			header.innerHTML = callback(collapsed);
			container.classList.toggle("collapsed", collapsed);

			if (collapsed) {
				targetHeight = 0;
				targetOpacity = 0;
				content.style.overflow = "hidden";
			} else {
				targetHeight = content.scrollHeight;
				targetOpacity = 1;
				content.style.overflow = "hidden";
			}

			isAnimating = true;
			startTime = null;
			animationFrame = requestAnimationFrame(animate);
		};

		// Initial render
		header.innerHTML = callback(collapsed);

		header.addEventListener("click", () => {
			toggleDisplay();
		});
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
			value = !value;
			if (value) {
				this.wikishield.audioManager.playSound([ "ui", "click" ]);
				toggle.classList.add("active");
			} else {
				this.wikishield.audioManager.playSound([ "ui", "click" ]);
				toggle.classList.remove("active");
			}
			onChange(value);
		});
	}

	createVolumeSlider(container, path, volume) {
		const key = [ "master", ...(path || []) ].join(".");

		const wrapper = document.createElement("div");
		wrapper.classList.add("audio-volume-control");
		container.appendChild(wrapper);

		const value = this.wikishield.storage.data.settings.audio.volume[key] ?? volume;

		wrapper.innerHTML = `
			<div class="audio-control-slider-container">
				<input type="range" class="audio-volume-slider" min="0" max="1" step="0.01" value="${value}" autoComplete="off">
				<input type="number" class="audio-volume-input" min="0" max="1" step="0.01" value="${value}" autoComplete="off">
			</div>
		`;

		const slider = wrapper.querySelector(".audio-volume-slider");
		const input = wrapper.querySelector(".audio-volume-input");

		const updateVolume = (newValue) => {
			const val = Math.max(0, Math.min(1, Number(newValue)));
			slider.value = val;
			input.value = val.toFixed(2);

			const currentVolume = this.wikishield.storage.data.settings.audio.volume[key];
			this.wikishield.storage.data.settings.audio.volume[key] = val;

			if (currentVolume !== val) {
				this.wikishield.audioManager.onvolumechanged();
			}
		};

		slider.addEventListener("input", () => updateVolume(slider.value));
		input.addEventListener("change", () => updateVolume(input.value));

		return wrapper;
	}

	createVolumeControl(container, path, title, description, volume) {
		const key = [ "master", ...(path || []) ].join(".");

		const wrapper = document.createElement("div");
		wrapper.classList.add("audio-volume-control");
		container.appendChild(wrapper);

		const value = this.wikishield.storage.data.settings.audio.volume[key] ?? volume;

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
			<div class="audio-control-slider-container">
				<input type="range" class="audio-volume-slider" min="0" max="1" step="0.01" value="${value}" autoComplete="off">
				<input type="number" class="audio-volume-input" min="0" max="1" step="0.01" value="${value}" autoComplete="off">
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

			this.wikishield.storage.data.settings.audio.volume ??= {};

			const currentVolume = this.wikishield.storage.data.settings.audio.volume[key];
			this.wikishield.storage.data.settings.audio.volume[key] = val;

			if (currentVolume !== val) {
				this.wikishield.audioManager.onvolumechanged();
			}
		};

		slider.addEventListener("input", () => updateVolume(slider.value));
		input.addEventListener("change", () => updateVolume(input.value));

		// Preview button - do NOT play click sound
		previewBtn.addEventListener("click", () => {
			if (previewBtn.classList.contains("playing")) return;
			previewBtn.classList.add("playing");

			const icon = previewBtn.querySelector(".fa");
			if (icon) {
				icon.classList.remove("fa-play");
				icon.classList.add("fa-stop");
			}

			const controller = new AbortController();
			previewBtn.onclick = () => {
				controller.abort();
			};

			this.wikishield.audioManager.stopPreviews();
			this.wikishield.audioManager.playSound(path, controller, true)
				.finally(() => {
					previewBtn.onclick = null;
					previewBtn.classList.remove("playing");
					if (icon) {
						icon.classList.remove("fa-stop");
						icon.classList.add("fa-play");
					}
				});
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
			<input type="text" class="numeric-input" value=${value} autoComplete="off">
			<span class="fa fa-plus numeric-input-button"></span>
		`;

		const inputElem = input.querySelector("input");

		input.querySelector(".fa-minus").addEventListener("click", () => {
			this.wikishield.audioManager.playSound([ "ui", "click" ]);
			value = Math.round(Math.max(value - step, min) * 100) / 100;
			inputElem.value = value;
			onChange(value);
		});

		input.querySelector(".fa-plus").addEventListener("click", () => {
			this.wikishield.audioManager.playSound([ "ui", "click" ]);
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

	scrollToSelector(selector) {
		const element = this.contentContainer.querySelector(selector);
		if (element) {
			element.scrollIntoView({ behavior: "smooth", block: "start" });
			element.classList.add("highlight");
		}
	}

	/**
	* Open settings container and go to general settings
	*/
	openSettings(tab = "general", scrollSelector = null) {
		this.closeSettings();
		this.isOpen = true;

		const container = document.createElement("div");
		container.classList.add("settings-container");
		document.body.appendChild(container);
		container.innerHTML = wikishieldHTML.settings;

		container.addEventListener("click", this.closeSettings.bind(this));
		container.querySelector(".settings").addEventListener("click", (event) => event.stopPropagation());

		const $tab = container.querySelector(`#settings-${tab}-button`) ?? container.querySelector("#settings-general-button");
		$tab.classList.add("selected");

		this.contentContainer = container.querySelector(".settings-right");

		[
			["#settings-general-button", this.openGeneral.bind(this)],
			["#settings-performance-button", this.openPerformance.bind(this)],
			["#settings-audio-button", this.openAudio.bind(this)],
			["#settings-controls-button", this.openControls.bind(this)],

			["#settings-queue-button", this.openQueue.bind(this)],
			["#settings-zen-mode-button", this.openZen.bind(this)],

			["#settings-ai-button", this.openAI.bind(this)],
			["#settings-auto-reporting-button", this.openAutoReporting.bind(this)],
			["#settings-gadgets-button", this.openGadgets.bind(this)],

			["#settings-whitelist-users-button", this.openWhitelist.bind(this, "users")],
			["#settings-whitelist-pages-button", this.openWhitelist.bind(this, "pages")],
			["#settings-whitelist-tags-button", this.openWhitelist.bind(this, "tags")],

			["#settings-highlight-users-button", this.openHighlight.bind(this, "users")],
			["#settings-highlight-pages-button", this.openHighlight.bind(this, "pages")],
			["#settings-highlight-tags-button", this.openHighlight.bind(this, "tags")],

			["#settings-statistics-button", this.openStatistics.bind(this)],
			["#settings-about-button", this.openAbout.bind(this)],

			["#settings-save-button", this.openSaveSettings.bind(this)],
		].forEach(([sel, func]) => container.querySelector(sel).addEventListener("click", () => {
			if (sel !== "#settings-audio-button") {
				this.wikishield.audioManager.stopPreviews();
			}

			this.wikishield.audioManager.playSound([ "ui", "click" ]);

			// Clear/unmount any previous content before switching tabs
			this.clearContent();

			[...document.querySelectorAll(".settings-left-menu-item.selected")]
				.forEach(e => e.classList.remove("selected"));
			container.querySelector(sel).classList.add("selected");

			func();
		}));

		$tab.click();
		if (scrollSelector) {
			container.querySelector(".settings").addEventListener("animationend", () => {
				this.scrollToSelector(scrollSelector);
			}, { once: true });
		}
	}

	/**
	* Open general settings section
	*/
	openGeneral() {
		const settings = this.wikishield.storage.data.settings;
		this.renderComponent(
			h(GeneralSettings, {
				wikishield: this.wikishield,

				maxEditCount: settings.queue.max_edits,
				onMaxEditCountChange: (value) => {
					settings.queue.max_edits = value;
				},

				maxQueueSize: settings.queue.max_size,
				onMaxQueueSizeChange: (value) => {
					settings.queue.max_size = value;
				},

				minOresScore: settings.queue.min_ores,
				onMinOresScoreChange: (value) => {
					settings.queue.min_ores = value;
				},

				watchlistExpiry: settings.expiry.watchlist,
				onWatchlistExpiryChange: (value) => {
					settings.expiry.watchlist = value;
				},

				namespaces,
				selectedNamespaces: settings.namespaces,
				onNamespaceToggle: (nsid, checked) => {
					if (checked) {
						const set = new Set(settings.namespaces);
						set.add(nsid);
						settings.namespaces = [...set];
					} else {
						settings.namespaces = settings.namespaces.filter(n => n !== nsid);
					}
				},
			})
		);

		this.setPath("#Core", "General");
	}

	openPerformance() {
		const settings = this.wikishield.storage.data.settings;
		this.renderComponent(
			h(PerformanceSettings, {
				wikishield: this.wikishield,

				startup: settings.performance.startup,
				onStartupChange: (value) => {
					settings.performance.startup = value;
				}
			})
		);

		this.setPath("#Core", "Performance");
	}

	/**
	* Open audio settings section
	*/
	openAudio() {
		this.clearContent();
		this.contentContainer.innerHTML = `
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
				<div class="settings-section-title">Master Volume</div>
				<div class="settings-section-desc">Controls the overall volume of all sounds</div>
				<div id="master-volume-control"></div>
			</div>

			<div id="sound-volumes-container" class="settings-section">

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

		const masterValue = this.wikishield.storage.data.settings.audio.volume.master ?? 1;

		wrapper.innerHTML = `
			<div class="audio-control-slider-container">
				<input type="range" class="audio-volume-slider" min="0" max="1" step="0.01" value="${masterValue}" autoComplete="off">
				<input type="number" class="audio-volume-input" min="0" max="1" step="0.01" value="${masterValue}" autoComplete="off">
			</div>
		`;

		const masterSlider = wrapper.querySelector(".audio-volume-slider");
		const masterInput = wrapper.querySelector(".audio-volume-input");

		const updateMasterVolume = (newValue) => {
			const val = Math.max(0, Math.min(1, Number(newValue)));
			masterSlider.value = val;
			masterInput.value = val.toFixed(2);

			const currentVolume = this.wikishield.storage.data.settings.audio.volume.master;
			this.wikishield.storage.data.settings.audio.volume.master = val;

			if (currentVolume !== val) {
				this.wikishield.audioManager.onvolumechanged();
			}
		};

		masterSlider.addEventListener("input", () => updateMasterVolume(masterSlider.value));
		masterInput.addEventListener("change", () => updateMasterVolume(masterInput.value));

		// ORES alert toggle
		this.createToggle(
			this.contentContainer.querySelector("#sound-alert-toggle"),
			this.wikishield.storage.data.settings.audio.ores_alert.enabled,
			(newValue) => {
				this.wikishield.storage.data.settings.audio.ores_alert.enabled = newValue;
			}
		);

		// ORES alert threshold
		this.createNumericInput(
			this.contentContainer.querySelector("#sound-alert-ores-score"),
			this.wikishield.storage.data.settings.audio.ores_alert.threshold, 0, 1, .05,
			(newValue) => {
				this.wikishield.storage.data.settings.audio.ores_alert.threshold = newValue;
			}
		);

		const formatTime = seconds => {
			const hours = Math.floor(seconds / 3600);
			const mins = Math.floor(seconds / 60);
			const secs = seconds % 60;

			let str = "";
			if (hours > 0) str += `${hours}h `;
			if (mins > 0) str += `${mins}m `;
			str += `${secs}s`;

			return str.trim();
		};

		const buildCategory = (container, path, title, description, volume) => {
			const categoryContainer = document.createElement("div");
			categoryContainer.classList.add("settings-section", "collapsible");
			container.appendChild(categoryContainer);

			categoryContainer.innerHTML = `
				<div class="settings-section-header collapse-title"></div>
				<div class="collapsible-content">
					<div class="settings-section-desc">${description}</div>
				</div>
			`;

			this.createCollapsibleSection(categoryContainer, () => title, true);

			const content = categoryContainer.querySelector(".collapsible-content");
			this.createVolumeSlider(
				content,
				path,
				title,
				description,
				volume
			);

			const settingsContent = document.createElement("div");
			settingsContent.classList.add("settings-content");
			content.appendChild(settingsContent);

			return settingsContent;
		};

		const buildSound = (container, path, title, description, volume) => {
			if (!title || !description) return;

			return this.createVolumeControl(
				container,
				path,
				title,
				description,
				volume
			);
		};

		const buildPlaylist = (container, path, title, description, volume, tracks) => {
			if (!title || !description) return;

			const categoryContainer = document.createElement("div");
			categoryContainer.classList.add("settings-section", "collapsible");
			container.appendChild(categoryContainer);

			categoryContainer.innerHTML = `
				<div class="settings-section-header collapse-title"></div>
				<div class="collapsible-content">
					<div class="settings-section-desc">${description}</div>
				</div>
			`;

			this.createCollapsibleSection(categoryContainer, collapsed => {
				if (collapsed) {
					return title;
				} else {
					return `${title} (${tracks.length} tracks, total ${formatTime(tracks.reduce((a, b) => a + b.length, 0))})`;
				}
			}, true);

			const content = categoryContainer.querySelector(".collapsible-content");
			this.createVolumeSlider(
				content,
				path,
				title,
				description,
				volume
			);

			const trackContent = document.createElement("div");
			trackContent.classList.add("settings-content", "playlist-track-grid");
			content.appendChild(trackContent);

			tracks.forEach((track, index) => {
				const trackElem = document.createElement("div");
				trackElem.classList.add("playlist-track-item");
				trackContent.appendChild(trackElem);

				trackElem.innerHTML = `
					<div class="playlist-track-thumbnail">
						<img src="${track.thumbnail}" alt="Track thumbnail">
					</div>
					<div class="playlist-track-info">
						<div class="playlist-track-title">${track.title}</div>
						<div class="playlist-track-artist">${track.artist ?? ''}</div>
						<div class="playlist-track-length">Length: ${formatTime(track.length)}</div>
					</div>
					<button class="audio-preview-button">
						<span class="fa fa-play"></span>
					</button>
				`;
				const previewBtn = trackElem.querySelector(".audio-preview-button");

				// Preview button - do NOT play click sound
				previewBtn.addEventListener("click", () => {
					if (previewBtn.classList.contains("playing")) return;
					previewBtn.classList.add("playing");

					const icon = previewBtn.querySelector(".fa");
					if (icon) {
						icon.classList.remove("fa-play");
						icon.classList.add("fa-stop");
					}

					const controller = new AbortController();
					previewBtn.onclick = () => {
						controller.abort();
					};

					this.wikishield.audioManager.stopPreviews();
					this.wikishield.audioManager.playSound([ ...path, index ], controller, true)
						.finally(() => {
							previewBtn.onclick = null;
							previewBtn.classList.remove("playing");
							if (icon) {
								icon.classList.remove("fa-stop");
								icon.classList.add("fa-play");
							}
						});
				});
			});

			return trackContent;
		};

		function loopThrough(obj, currentPath = [], container) {
			for (const [ key, value ] of Object.entries(obj)) {
				switch (value.type) {
					case "sound": {
						buildSound(
							container,
							[ ...currentPath, key ],
							value.title,
							value.description,
							value.volume
						);
					} break;
					case "playlist": {
						buildPlaylist(
							container,
							[ ...currentPath, key ],
							value.title,
							value.description,
							value.volume,
							value.tracks
						);
					} break;
					case "category": {
						const newContainer = buildCategory(
							container,
							[ ...currentPath, key ],
							value.title,
							value.description,
							value.volume
						);

						loopThrough(value.properties, [ ...currentPath, key ], newContainer);
					} break;
				}
			}
		}

		loopThrough(this.wikishield.audioManager.audio, [], this.contentContainer.querySelector("#sound-volumes-container"));

		this.setPath("#Core", "Audio");
	}

	/**
	* Open appearance settings section (Dark mode only)
	*/
	openQueue() {
		const queueNames = { recent: "Recent changes", flagged: "Pending changes", users: "User creation logs", watchlist: "Watchlist" };
		const queues = Object.entries(queueNames).map(([ key, name ]) => [ key, { key, name, ...this.wikishield.storage.data.settings.queue[key] } ]);
		queues.sort((a, b) => a[1].order - b[1].order);

		this.renderComponent(
			h(QueueSettings, {
				wikishield: this.wikishield,

				queues,
				onQueueToggle: (queueKey, enabled) => {
					this.wikishield.storage.data.settings.queue[queueKey].enabled = enabled;
					this.wikishield.interface.updateQueueTabs();
				},
				onQueueReorder: (newOrder) => {
					newOrder.forEach(([ queueKey ], index) => {
						this.wikishield.storage.data.settings.queue[queueKey].order = index;
					});

					this.wikishield.interface.updateQueueTabs();
				},

				selectedPalette: this.wikishield.storage.data.UI.theme.palette,
				colorPalettes,
				onPaletteChange: (paletteIndex) => {
					this.wikishield.audioManager.playSound([ "ui", "click" ]);
					this.wikishield.storage.data.UI.theme.palette = paletteIndex;
					document.querySelectorAll(".queue-edit-color").forEach(el => {
						el.style.background = this.wikishield.interface.getORESColor(+el.dataset.rawOresScore);
					});
					// Re-render queue to show new colors
					if (this.wikishield.interface) {
						this.wikishield.interface.renderQueue(
							this.wikishield.queue.queue[this.wikishield.queue.currentQueueTab],
							this.wikishield.queue.currentEdit[this.wikishield.queue.currentQueueTab]
						);
					}
				}
			})
		);

		this.setPath("#Appearance", "Queue");
	}

	openZen() {
		this.renderComponent(
			h(ZenSettings, {
				wikishield: this.wikishield,
				...this.wikishield.storage.data.settings.zen_mode,

				onEnableChange: value => {
					this.wikishield.storage.data.settings.zen_mode.enabled = value;
					this.wikishield.interface.updateZenModeDisplay(true);
				},

				onSoundChange: value => {
					this.wikishield.storage.data.settings.zen_mode.sound.enabled = value;
					this.wikishield.interface.updateZenModeDisplay();
				},
				onMusicChange: value => {
					this.wikishield.storage.data.settings.zen_mode.music.enabled = value;
					this.wikishield.interface.updateZenModeDisplay(true);
				},

				onAlertsChange: value => {
					this.wikishield.storage.data.settings.zen_mode.alerts.enabled = value;
					this.wikishield.interface.updateZenModeDisplay();
				},
				onNoticesChange: value => {
					this.wikishield.storage.data.settings.zen_mode.notices.enabled = value;
					this.wikishield.interface.updateZenModeDisplay();
				},
				onToastsChange: value => {
					this.wikishield.storage.data.settings.zen_mode.toasts.enabled = value;
					this.wikishield.interface.updateZenModeDisplay();
				},

				onBadgesChange: value => {
					this.wikishield.storage.data.settings.zen_mode.badges.enabled = value;
					this.wikishield.interface.updateZenModeDisplay();
				},
			})
		);

		this.setPath("#Appearance", "Zen Mode");
	}

	/**
	* Open controls settings section
	*/
	openControls() {
		this.clearContent();
		this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Control scripts</div>
					<div class="settings-section-desc">Below you can change what actions are completed when a key is pressed.</div>
					<button class="add-action-button new-control-script">
						<span class="fa fa-plus"></span>
						New control script
					</button>
				</div>
			`;

		for (const control of this.wikishield.storage.data.control_scripts) {
			const container = document.createElement("div");
			container.classList.add("settings-section");
			this.contentContainer.appendChild(container);

			this.createControlInterface(container, control);
		}

		this.updateDuplicateControls();

		const addButton = this.contentContainer.querySelector(".new-control-script");

		addButton.addEventListener("click", () => {
			this.wikishield.storage.data.control_scripts.unshift({
				keys: [],
				actions: []
			});
			this.openControls();
		});

		this.setPath("#Core", "Controls");
	}

	/**
	* Find which, if any, keys are used for more than one control
	* @returns {String[]} List of keys used more than once
	*/
	findDuplicateControls() {
		const keys = {};

		for (const control of this.wikishield.storage.data.control_scripts) {
			for (const key of control.keys) {
				keys[key] ??= 0;
				keys[key]++;
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
			elem.classList.toggle("key-duplicate", duplicateControls.includes(elem.dataset.key));
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
			};
		});

		for (const action of control.actions) {
			this.createActionItem(
				actionContainer,
				action,
				control,
				() => {
					this.createControlInterface(container, control);
				}
			);
		}

		const bottomContainer = document.createElement("div");
		bottomContainer.classList.add("control-bottom-container");
		bottomContainer.innerHTML = `
				<div class="add-action-container"></div>
				<div>
					<button class="add-action-button control-delete" style="--background: 211, 51, 51;">Delete</button>
				</div>
			`;
		actionContainer.appendChild(bottomContainer);

		bottomContainer.querySelector(".control-delete").addEventListener("click", () => {
			this.wikishield.audioManager.playSound([ "ui", "click" ]);
			this.wikishield.storage.data.control_scripts.splice(this.wikishield.storage.data.control_scripts.indexOf(control), 1);
			this.openControls();
		});

		const addContainer = bottomContainer.querySelector(".add-action-container");

		const resetAddContainer = () => {
			addContainer.innerHTML = `<button class="add-action-button new-button">Add new action</button>`;

			addContainer.querySelector(".new-button").addEventListener("click", () => {
				this.wikishield.audioManager.playSound([ "ui", "click" ]);
				addContainer.innerHTML = `
						<select style="height: 35px;"></select>
						<button class="add-action-button cancel-button" style="margin-left: 10px;">Cancel</button>
						<button class="add-action-button create-button" style="margin-left: 10px;">Create</button>
					`;

				const select = addContainer.querySelector("select");

				Object.keys(this.wikishield.interface.eventManager.events).forEach(name => {
					const event = this.wikishield.interface.eventManager.events[name];
					if ("description" in event) {
						select.innerHTML += `<option value="${name}">${this.wikishield.interface.eventManager.events[name].description}</option>`;
					}
				});
				select.innerHTML += `<option value="if">If condition</option>`;

				addContainer.querySelector(".cancel-button").addEventListener("click", () => {
					this.wikishield.audioManager.playSound([ "ui", "click" ]);
					resetAddContainer();
				});
				addContainer.querySelector(".create-button").addEventListener("click", () => {
					this.wikishield.audioManager.playSound([ "ui", "click" ]);
					const action = {
						name: select.value,
						params: {}
					};
					if (select.value === "if") {
						action.actions = [];
						action.condition = "operatorNonAdmin";
					}

					control.actions.push(action);
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

			for (const key in this.wikishield.interface.eventManager.conditions) {
				const condition = this.wikishield.interface.eventManager.conditions[key];
				if ("desc" in condition) {
					select.innerHTML += `<option value=${key}>${condition.desc}</option>`;
				}
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
			const event = this.wikishield.interface.eventManager.events[action.name];
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

			let options = parameter.options ?? [ ];
			if (typeof parameter.showOption === "function") {
				options = options.filter(opt => parameter.showOption(this.wikishield, opt));
			}

			for (const choice of options) {
				select.innerHTML += `<option>${choice}</option>`;
			}

			if (value) {
				select.value = value;
			} else {
				select.value = parameter.options[0];
				onChange(select.value);
			}

			select.addEventListener("change", () => onChange(select.value));
		} else if (parameter.type === "text") {
			parameterElem.innerHTML += `<input type="text" autoComplete="off">`;
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
	openAI() { // TODO: Refactor into component, also allow for other AI providers
		const settings = this.wikishield.storage.data.settings.AI;
		const defaults = this.wikishield.defaultStorage.data.settings.AI;

		this.clearContent();
		this.contentContainer.innerHTML = `
				<div class="settings-section" id="enable-ollama-ai">
					<div class="settings-section-title">Enable Ollama AI Analysis (<a href="https://ollama.com" target="_blank">ollama.com</a>)</div>
					<div class="settings-section-desc">Use local AI models with complete privacy. Free & fast.</div>
				</div>

				<div class="settings-toggles-section">
					<div class="settings-section-header">
						<span class="settings-section-header-icon">Tools</span>
					</div>
					<div class="settings-section compact inline" id="edit-analysis-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Edit Analysis</div>
							<div class="settings-section-desc">Suggests actions to take on edits, such as "welcome", "thank", "rollback", "revert-and-warn"</div>
						</div>
					</div>
					<div class="settings-section compact inline" id="username-analysis-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Username Analysis</div>
							<div class="settings-section-desc">Flags potentially problematic usernames and prompts you to report them to UAA</div>
						</div>
					</div>
				</div>

				<div class="settings-section" id="ollama-server-url">
					<div class="settings-section-title">Server URL</div>
					<div class="settings-section-desc">The URL of your local Ollama server (default: <code>${defaults.Ollama.server}</code>)</div>
					<div class="text-input-container">
						<input type="text" id="ollama-url-input" value="${settings.Ollama.server}" placeholder="${defaults.Ollama.server}" autoComplete="off">
						<button id="test-connection-btn">Test Connection</button>
					</div>
					<div class="settings-section compact connection-status-container">
						<p id="connection-status"></p>
					</div>
				</div>

				<div class="settings-section" id="ollama-model-select">
					<div class="settings-section-title">
						Model Selection
						<button id="refresh-models-btn" style="float: right; font-size: 1rem;">
							<span class="fa fa-sync"></span> Refresh Models
						</button>
					</div>
					<div class="settings-section-desc">Select which Ollama model to use for edit analysis</div>
					<div class="settings-section compact models-container">
						<p id="models-status">Click "Refresh Models" to load available models</p>
						<div id="models"></div>
					</div>
				</div>

				<div class="settings-section" id="ollama-cors-setup">
					<div class="settings-section-title">CORS Setup Required</div>
					<div class="settings-section-desc">
						<strong>Environment Variable:</strong> <code>OLLAMA_ORIGINS</code><br>
						<strong>Value:</strong> <code>https://*.wikipedia.org</code>

						<br><br>

						<details>
							<summary><strong>Windows (Permanent)</strong></summary>
							<ol style="margin: 8px 0; padding-left: 20px; font-size: 0.85em;">
								<li>Open <em>System Properties → Environment Variables</em></li>
								<li>Create a new variable named <code>OLLAMA_ORIGINS</code></li>
								<li>Set the value to <code>https://*.wikipedia.org</code></li>
								<li>Restart Ollama</li>
							</ol>
						</details>

						<details>
							<summary><strong>Windows (Temporary)</strong></summary>
<pre>
$env:OLLAMA_ORIGINS="https://*.wikipedia.org"
ollama serve
</pre>
						</details>

						<details>
							<summary><strong>macOS / Linux</strong></summary>
							Add the following to <code>~/.bashrc</code> or <code>~/.zshrc</code>:
							<pre>export OLLAMA_ORIGINS="https://*.wikipedia.org"</pre>
							Then run:
							<pre>source ~/.bashrc && ollama serve</pre>
						</details>
					</div>
				</div>
			`;

		this.createToggle(
			this.contentContainer.querySelector("#edit-analysis-toggle"),
			settings.edit_analysis.enabled,
			(newValue) => {
				settings.edit_analysis.enabled = newValue;
			}
		);
		this.createToggle(
			this.contentContainer.querySelector("#username-analysis-toggle"),
			settings.username_analysis.enabled,
			(newValue) => {
				settings.username_analysis.enabled = newValue;
			}
		);

		// Enable/disable toggle
		this.createToggle(
			this.contentContainer.querySelector("#enable-ollama-ai"),
			settings.enabled,
			(newValue) => {
				settings.enabled = newValue;

				if (newValue) {
					switch (settings.provider) {
						case "Ollama": {
							this.wikishield.AI = new AI.providers.Ollama(
								this.wikishield,
								settings.Ollama,
							);
						} break;
						default: {
							this.wikishield.AI?.cancel.all(true);
							this.wikishield.AI = null;
						} break;
					}
				} else {
					this.wikishield.AI?.cancel.all(true);
					this.wikishield.AI = null;
				}
			}
		);

		// Server URL input handler
		const urlInput = this.contentContainer.querySelector("#ollama-url-input");
		urlInput.addEventListener('change', () => {
			settings.Ollama.server = urlInput.value.trim();
			if (settings.provider === "Ollama" && this.wikishield.AI) {
				this.wikishield.AI.cancel.all(true);
			}
		});

		// Test connection button
		const testBtn = this.contentContainer.querySelector("#test-connection-btn");
		const statusSpan = this.contentContainer.querySelector("#connection-status");
		const statusContainer = statusSpan.parentElement;

		testBtn.addEventListener('click', async () => {
			// Cancel all active AI requests
			this.wikishield.AI?.cancel.all(true);

			statusContainer.classList.add("testing");
			statusContainer.classList.remove("connected", "failed");

			statusSpan.innerHTML = 'Testing...';
			testBtn.disabled = true;

			let tempAI;
			switch (settings.provider) {
				case "Ollama": {
					tempAI = new AI.providers.Ollama(this.wikishield, settings.Ollama);
				} break;
			}

			const connected = tempAI instanceof AI && await tempAI.test();
			if (connected) {
				statusContainer.classList.add("connected");
				statusContainer.classList.remove("testing", "failed");

				statusSpan.innerHTML = '<span class="fa fa-check-circle"></span> Connected!';
			} else {
				statusContainer.classList.add("failed");
				statusContainer.classList.remove("testing", "connected");

				statusSpan.innerHTML = `
						<span class="fa fa-times-circle"></span> Failed to connect
						<br><small>Make sure Ollama is running with CORS enabled (see instructions below)</small>
					`;
			}

			testBtn.disabled = false;
		});

		// Refresh models button
		const refreshBtn = this.contentContainer.querySelector("#refresh-models-btn");
		const modelsStatus = this.contentContainer.querySelector("#models-status");

		const $models = this.contentContainer.querySelector("#models");
		const $modelsContainer = $models.parentElement;

		refreshBtn.addEventListener('click', async () => {
			// Cancel all active AI requests
			this.wikishield.AI?.cancel.all(true);

			$modelsContainer.classList.add("searching");
			$modelsContainer.classList.remove("none", "error");

			modelsStatus.innerHTML = 'Searching...';

			refreshBtn.disabled = true;

			try {
				let tempAI;
				switch (settings.provider) {
					case "Ollama": {
						tempAI = new AI.providers.Ollama(this.wikishield, settings.Ollama);
					} break;
				}

				const models = (tempAI instanceof AI && await tempAI.models()) || [ ];
				if (models.length === 0) {
					$modelsContainer.classList.add("none");
					$modelsContainer.classList.remove("searching", "error");

					modelsStatus.innerHTML = 'No models found';
				} else {
					$modelsContainer.classList.remove("searching", "none", "error");

					modelsStatus.innerHTML = `<span class="fa fa-check-circle"></span> Found ${models.length} model${models.length > 1 ? 's' : ''}`;

					$models.innerHTML = "";
					models.forEach(model => {
						const isSelected = model.name === this.wikishield.storage.data.settings.AI.Ollama.model;
						const size = this.wikishield.util.formatBytes(model.size);

						const $model = document.createElement("div");
						$model.classList.add("model");
						$model.classList.toggle("selected", isSelected);
						$model.dataset.model = model.name;

						const $top = document.createElement("div");
						$top.classList.add("model-top");
						$model.appendChild($top);

						const $button = document.createElement("span");
						$button.classList.add("indicator", "fa", isSelected ? "fa-check-circle" : "fa-circle");
						$top.appendChild($button);

						const $name = document.createElement("span");
						$name.classList.add("model-name");
						$name.textContent = model.name;
						$top.appendChild($name);

						// i don't feel like figuring out the css to truly center the model name, so just add an invisible element to take up space
						const $pseudoButton = document.createElement("span");
						$pseudoButton.classList.add("pseudo-indicator", "fa", "fa-circle");
						$top.appendChild($pseudoButton);

						const $bottom = document.createElement("div");
						$bottom.classList.add("model-bottom");
						$model.appendChild($bottom);

						const $size = document.createElement("span");
						$size.classList.add("model-size");
						$size.textContent = size;
						$bottom.appendChild($size);

						const $modified = document.createElement("div");
						$modified.classList.add("model-modified");
						$modified.textContent = new Date(model.modified_at).toLocaleDateString();
						$bottom.appendChild($modified);

						$models.appendChild($model);

						$model.addEventListener('click', () => {
							this.wikishield.AI?.cancel.all(true);

							const modelName = model.name;
							switch (settings.provider) {
								case "Ollama": {
									settings.Ollama.model = modelName;
								} break;
							}

							$models.querySelectorAll(".model.selected").forEach(elem => {
								elem.classList.remove("selected");

								const $indicator = elem.querySelector(".indicator");
								$indicator.classList.remove("fa-check-circle");
								$indicator.classList.add("fa-circle");
							});

							$model.classList.add("selected");

							const $indicator = $model.querySelector(".indicator");
							$indicator.classList.remove("fa-circle");
							$indicator.classList.add("fa-check-circle");
						});
					});
				}
			} catch (err) {
				$modelsContainer.classList.add("error");
				$modelsContainer.classList.remove("searching", "none");

				modelsStatus.innerHTML = '<span class="fa fa-times-circle"></span> Error loading models';
			}

			refreshBtn.disabled = false;
		});

		this.setPath("#Tools", "AI Analysis");
	}

	openAutoReporting() {
		this.renderComponent(
			h(AutoReportingSettings, {
				wikishield: this.wikishield,
				enableAutoReporting: this.wikishield.storage.data.settings.auto_report.enabled,
				autoReportReasons: Object.keys(warningsLookup).filter(id => getWarningFromLookup(id).reportable),
				selectedAutoReportReasons: this.wikishield.storage.data.settings.auto_report.for,

				onEnableChange: (newValue) => {
					this.wikishield.storage.data.settings.auto_report.enabled = newValue;
				},
				onWarningToggle: (key, isEnabled) => {
					if (isEnabled) {
						this.wikishield.storage.data.settings.auto_report.for.add(key);
					} else {
						this.wikishield.storage.data.settings.auto_report.for.delete(key);
					}
				}
			})
		);

		this.setPath("#Tools", "Auto Reporting");
	}

	/**
	* Open gadgets settings seciton
	*/
	openGadgets() {
		const settings = this.wikishield.storage.data.settings;

		this.clearContent();
		this.contentContainer.innerHTML = `
				<div class="settings-toggles-section">
					<div class="settings-section-title">Gadgets</div>
					<div class="settings-section-desc">Toggle various Wikishield features.</div>
					<div class="settings-section compact inline" id="auto-welcome-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Automatic welcoming of new users</div>
							<div class="settings-section-desc">Automatically welcome new users with empty talk pages when moving past their constructive edits</div>
						</div>
					</div>
				</div>
				<div class="settings-toggles-section">
					<div class="settings-section-title">Username Highlighting</div>
					<div class="settings-section compact inline" id="username-highlighting-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Enable username highlighting</div>
							<div class="settings-section-desc">Highlights usernames in edit summaries, edit diffs, and user creation logs.</div>
						</div>
					</div>
					<div class="settings-section compact inline" id="username-highlighting-mode-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Toggle fuzzy matching mode</div>
							<div class="settings-section-desc">
								When enabled, highlights similar usernames. Not recommended for users with short usernames.<br/>
								<strong>NOTE:</strong> This may cause performance issues for those with long usernames, or users on weaker devices.
							</div>
						</div>
					</div>
				</div>
			`;

		this.createToggle(
			this.contentContainer.querySelector("#auto-welcome-toggle"),
			settings.auto_welcome.enabled,
			(newValue) => {
				settings.auto_welcome.enabled = newValue;
			}
		);

		this.createToggle(
			this.contentContainer.querySelector("#username-highlighting-toggle"),
			settings.username_highlighting.enabled,
			(newValue) => {
				settings.username_highlighting.enabled = newValue;
				this.wikishield.interface.renderQueue();
			}
		);
		this.createToggle(
			this.contentContainer.querySelector("#username-highlighting-mode-toggle"),
			settings.username_highlighting.fuzzy,
			(newValue) => {
				settings.username_highlighting.fuzzy = newValue;
			}
		);

		this.setPath("#Core", "Gadgets");
	}

	openWhitelist(key) {
		const descriptionMap = {
			users: {
				button: "Add User",
				input: "username",
				short: "How long to whitelist a user",
				long: "This is a list of users you have whitelisted. Edits from these users will not appear in your queue. Whitelists expire based on your configured expiry time."
			},
			pages: {
				button: "Add Page",
				input: "page title",
				short: "How long to whitelist a page",
				long: "This is a list of pages you have whitelisted. Edits to these pages will not appear in your queue. Whitelists expire based on your configured expiry time."
			},
			tags: {
				button: "Add Tag",
				input: "tag id",
				short: "How long to whitelist a tag",
				long: "This is a list of tags you have whitelisted. Edits with these tags will not appear in your queue. Whitelists expire based on your configured expiry time."
			}
		};

		const expiryString = this.wikishield.storage.data.settings.expiry.whitelist[key];
		this.clearContent();
		this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">
						Whitelisted ${key}
						<div title="Whitelist expiry for ${key}" description="${descriptionMap[key].short}" style="float: right; font-size: 0.8em; font-weight: normal; opacity: 0.7;">
							<select id="whitelist-expiry">
								<option value="none">None</option>
								<option value="1 hour">1 hour</option>
								<option value="1 day">1 day</option>
								<option value="1 week">1 week</option>
								<option value="1 month">1 month</option>
								<option value="3 months">3 months</option>
								<option value="6 months">6 months</option>
								<option value="indefinite">Indefinite</option>
							</select>
						</div>
					</div>
					<div class="settings-section-desc">${descriptionMap[key].long} (currently: ${expiryString}).</div>
					<div class="text-input-container">
						<input type="text" id="whitelist-input" placeholder="Enter ${descriptionMap[key].input} to whitelist..." class="username-input" autoComplete="off">
						<button id="add-whitelist" class="add-user-button">
							${descriptionMap[key].button}
						</button>
					</div>
				</div>
				<div class="settings-section user-container"></div>
			`;

		const container = this.contentContainer.querySelector(".user-container");
		const input = this.contentContainer.querySelector("#whitelist-input");
		const button = this.contentContainer.querySelector("#add-whitelist");

		const add = () => {
			const value = input.value.trim();
			if (value) {
				const expiryMs = this.wikishield.util.expiryToMilliseconds(this.wikishield.storage.data.settings.expiry.whitelist[key]);

				const now = Date.now();
				this.wikishield.storage.data.whitelist[key].set(value, [ now, now + expiryMs ]);

				this.wikishield.storage.data.statistics.items_whitelisted.total++;
				this.wikishield.storage.data.statistics.items_whitelisted[key]++;

				input.value = "";
				this.openWhitelist(key); // Refresh the list
			}
		};

		button.addEventListener("click", add);
		input.addEventListener("keypress", (e) => {
			if (e.key === "Enter") add();
		});

		const whitelistExpiry = this.contentContainer.querySelector("#whitelist-expiry");
		whitelistExpiry.value = this.wikishield.storage.data.settings.expiry.whitelist[key];
		whitelistExpiry.addEventListener("change", () => {
			this.wikishield.storage.data.settings.expiry.whitelist[key] = whitelistExpiry.value;
		});

		this.createWhitelistList(container, key);

		this.setPath("#Tools", `Whitelisted ${key.charAt(0).toUpperCase() + key.slice(1)}`);
	}

	/**
	* Create a list of highlights with expiration times
	* @param {HTMLElement} container
	*/
	createWhitelistList(container, key) {
		container.innerHTML = "";

		// Sort by most recent first
		const sortedEntries = [ ...this.wikishield.storage.data.whitelist[key].entries() ].sort((a, b) => b[1][1] - a[1][1]);

		const createHref = value => {
			switch (key) {
				case "users":
					return this.wikishield.util.pageLink(`Special:Contributions/${value}`);
				case "pages":
					return this.wikishield.util.pageLink(value);
				case "tags":
					return this.wikishield.util.pageLink(`Special:Tags/${value}`);
			}
		};

		for (const [ whitelist, time ] of sortedEntries) {
			const item = document.createElement("div");

			const date = new Date(time[0]);
			const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();

			const expiresDate = new Date(time[1]);
			const expiresStr = time[1] === Infinity ? "Never" : expiresDate.toLocaleDateString() + " " + expiresDate.toLocaleTimeString();
			const isExpired = Date.now() > time[1];

			container.appendChild(item);
			item.innerHTML = `
					<div>
						<a target="_blank" href="${createHref(whitelist)}">${whitelist}</a>
						<span style="font-size: 0.85em; opacity: 0.7;">Added: ${dateStr}</span>
						<span style="font-size: 0.85em; opacity: 0.7; color: ${isExpired ? '#ff6b6b' : '#51cf66'};">
							${isExpired ? 'Expired' : 'Expires'}: ${expiresStr}
						</span>
					</div>
					<button class="add-action-button remove-button">Remove</button>
				`;
			item.querySelector(".remove-button").addEventListener("click", () => {
				this.wikishield.storage.data.whitelist[key].delete(whitelist);
				item.remove();

				this.createWhitelistList(container, key); // Refresh the list
			});
		}

		if (sortedEntries.length === 0) {
			container.innerHTML = `<div style="opacity: 0.6; text-align: center; padding: 20px;">No ${key} whitelisted</div>`;
		}
	}

	/**
	* Open highlight settings section
	*/
	openHighlight(key) {
		const descriptionMap = {
			users: {
				button: "Add User",
				input: "username",
				short: "How long to highlight a user after issuing a warning",
				long: "This is a list of users you have highlight. Edits by these users will appear before other edits in your queue. Highlights expire based on your configured expiry time."
			},
			pages: {
				button: "Add Page",
				input: "page title",
				short: "How long to highlight a page",
				long: "This is a list of pages you have highlight. Edits on these pages will appear before other edits in your queue. Highlights expire based on your configured expiry time."
			},
			tags: {
				button: "Add Tag",
				input: "tag id",
				short: "How long to highlight a tag",
				long: "This is a list of tags you have highlight. Edits with these tags will appear before other edits in your queue. Highlights expire based on your configured expiry time."
			}
		};

		const expiryString = this.wikishield.storage.data.settings.expiry.highlight[key];
		this.clearContent();
		this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">
						Highlighted ${key}
						<div title="Highlight expiry for warned ${key}" description="${descriptionMap[key].short}" style="float: right; font-size: 0.8em; font-weight: normal; opacity: 0.7;">
							<select id="highlight-expiry">
								<option value="none">None</option>
								<option value="1 hour">1 hour</option>
								<option value="1 day">1 day</option>
								<option value="1 week">1 week</option>
								<option value="1 month">1 month</option>
								<option value="3 months">3 months</option>
								<option value="6 months">6 months</option>
								<option value="indefinite">Indefinite</option>
							</select>
						</div>
					</div>
					<div class="settings-section-desc">${descriptionMap[key].long} (currently: ${expiryString}).</div>
					<div class="text-input-container">
						<input type="text" id="highlight-input" placeholder="Enter ${descriptionMap[key].input} to highlight..." class="username-input" autoComplete="off">
						<button id="add-highlight" class="add-user-button">
							${descriptionMap[key].button}
						</button>
					</div>
				</div>
				<div class="settings-section user-container"></div>
			`;

		const container = this.contentContainer.querySelector(".user-container");
		const input = this.contentContainer.querySelector("#highlight-input");
		const button = this.contentContainer.querySelector("#add-highlight");

		const add = () => {
			const value = input.value.trim();
			if (value) {
				const expiryMs = this.wikishield.util.expiryToMilliseconds(this.wikishield.storage.data.settings.expiry.highlight[key]);

				const now = Date.now();
				this.wikishield.storage.data.highlight[key].set(value, [ now, now + expiryMs ]);

				this.wikishield.storage.data.statistics.items_highlighted.total++;
				this.wikishield.storage.data.statistics.items_highlighted[key]++;

				input.value = "";
				this.openHighlight(key); // Refresh the list
			}
		};

		button.addEventListener("click", add);
		input.addEventListener("keypress", (e) => {
			if (e.key === "Enter") add();
		});

		const highlightExpiry = this.contentContainer.querySelector("#highlight-expiry");
		highlightExpiry.value = this.wikishield.storage.data.settings.expiry.highlight[key];
		highlightExpiry.addEventListener("change", () => {
			this.wikishield.storage.data.settings.expiry.highlight[key] = highlightExpiry.value;
		});

		this.createHighlightList(container, key);

		this.setPath("#Tools", `Highlighted ${key.charAt(0).toUpperCase() + key.slice(1)}`);
	}

	/**
	* Create a list of highlights with expiration times
	* @param {HTMLElement} container
	*/
	createHighlightList(container, key) {
		container.innerHTML = "";

		// Sort by most recent first
		const sortedEntries = [ ...this.wikishield.storage.data.highlight[key].entries() ].sort((a, b) => b[1][1] - a[1][1]);

		const createHref = value => {
			switch (key) {
				case "users":
					return this.wikishield.util.pageLink(`Special:Contributions/${value}`);
				case "pages":
					return this.wikishield.util.pageLink(value);
				case "tags":
					return this.wikishield.util.pageLink(`Special:Tags/${value}`);
			}
		};

		for (const [ highlight, time ] of sortedEntries) {
			const item = document.createElement("div");

			const date = new Date(time[0]);
			const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();

			const expiresDate = new Date(time[1]);
			const expiresStr = time[1] === Infinity ? "Never" : expiresDate.toLocaleDateString() + " " + expiresDate.toLocaleTimeString();
			const isExpired = Date.now() > time[1];

			container.appendChild(item);
			item.innerHTML = `
					<div>
						<a target="_blank" href="${createHref(highlight)}">${highlight}</a>
						<span style="font-size: 0.85em; opacity: 0.7;">Added: ${dateStr}</span>
						<span style="font-size: 0.85em; opacity: 0.7; color: ${isExpired ? '#ff6b6b' : '#51cf66'};">
							${isExpired ? 'Expired' : 'Expires'}: ${expiresStr}
						</span>
					</div>
					<button class="add-action-button remove-button">Remove</button>
				`;
			item.querySelector(".remove-button").addEventListener("click", () => {
				this.wikishield.storage.data.highlight[key].delete(highlight);
				item.remove();

				this.createHighlightList(container, key); // Refresh the list
			});
		}

		if (sortedEntries.length === 0) {
			container.innerHTML = `<div style="opacity: 0.6; text-align: center; padding: 20px;">No ${key} highlight</div>`;
		}
	}

	/**
	* Open statistics settings section
	*/
	openStatistics() {
		const stats = this.wikishield.storage.data.statistics;

		const formatTime = ms => {
			const seconds = Math.floor(ms / 1000);

			const days = Math.floor(seconds / 86400);
			const hours = Math.floor((seconds % 86400) / 3600);
			const mins = Math.floor((seconds % 3600) / 60);
			const secs = seconds % 60;

			let str = "";
			if (days > 0) str += `${days}d `;
			if (hours > 0) str += `${hours}h `;
			if (mins > 0) str += `${mins}m `;
			str += `${secs}s`;

			return str.trim();
		};

		const sessionTime = this.wikishield.storage.data.statistics.session_time + (performance.now() - this.wikishield.loadTime);

		this.clearContent();
		this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">
						Statistics Overview
						<button id="reset-stats-button" style="float: right; font-size: 1rem; --background: 211, 51, 51;">Reset Statistics</button>
					</div>
					<div class="stats-grid">
						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.edits_reviewed.total}</div>
									<div class="stat-label">Edits Reviewed</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										You have thanked ${
											((stats.edits_reviewed.thanked / stats.edits_reviewed.total * 100) || 0).toFixed(1)
										}% of the edits you reviewed
									</div>
								</div>
							</div>
						</div>

						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.recent_changes_reviewed.total}</div>
									<div class="stat-label">Recent Changes Reviewed</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										Recent changes make up ${
											((stats.recent_changes_reviewed.total / stats.edits_reviewed.total * 100) || 0).toFixed(1)
										}% of your reviewed edits
									</div>
								</div>
							</div>
						</div>
						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.pending_changes_reviewed.total}</div>
									<div class="stat-label">Pending Changes Reviewed</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										You have accepted ${
											stats.pending_changes_reviewed.accepted
										} (${
											((stats.pending_changes_reviewed.accepted / stats.pending_changes_reviewed.total * 100) || 0).toFixed(1)
										}%) pending changes
									</div>
									<div class="stat-sublabel">
										You stopped ${
											stats.pending_changes_reviewed.rejected
										} (${
											((stats.pending_changes_reviewed.rejected / stats.pending_changes_reviewed.total * 100) || 0).toFixed(1)
										}%) pending changes from entering the public eye
									</div>
									<div class="stat-sublabel">
										Out of all the edits you've reviewed, ${
											((stats.pending_changes_reviewed.total / stats.edits_reviewed.total * 100) || 0).toFixed(1)
										}% of them were pending
									</div>
								</div>
							</div>
						</div>
						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.watchlist_changes_reviewed.total}</div>
									<div class="stat-label">Watchlist Changes Reviewed</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										${
											((stats.watchlist_changes_reviewed.total / stats.edits_reviewed.total * 100) || 0).toFixed(1)
										}% of your reviews came from your watchlist
									</div>
								</div>
							</div>
						</div>
						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.users_reviewed.total}</div>
									<div class="stat-label">Users Reviewed</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										${
											((stats.users_reviewed.total / stats.edits_reviewed.total * 100) || 0).toFixed(1)
										}% of your reviews were from the user creation log
									</div>
								</div>
							</div>
						</div>

						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.reverts_made.total}</div>
									<div class="stat-label">Reverts Made</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										${
											((stats.reverts_made.total / stats.edits_reviewed.total * 100) || 0).toFixed(1)
										}% of edits that cross your path are reverted
									</div>
									<div class="stat-sublabel">
										You assumed good faith ${
											((stats.reverts_made.good_faith / stats.reverts_made.total * 100) || 0).toFixed(1)
										}% of the time
									</div>
									<div class="stat-sublabel">
										${
											((stats.reverts_made.from_recent_changes / stats.reverts_made.total * 100) || 0).toFixed(1)
										}% of your reverts are from recent changes
									</div>
									<div class="stat-sublabel">
										${
											((stats.reverts_made.from_pending_changes / stats.reverts_made.total * 100) || 0).toFixed(1)
										}% of your reverts were pending
									</div>
									<div class="stat-sublabel">
										${
											((stats.reverts_made.from_watchlist / stats.reverts_made.total * 100) || 0).toFixed(1)
										}% of your reverts were from your watchlist
									</div>
									<div class="stat-sublabel">
										and the last ${
											((stats.reverts_made.from_loaded_edits / stats.reverts_made.total * 100) || 0).toFixed(1)
										}% weren't even in your queue!
									</div>
								</div>
							</div>
						</div>

						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.users_welcomed.total}</div>
									<div class="stat-label">Users Welcomed</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										${stats.edits_reviewed.total === stats.users_welcomed.total ?
											`You welcome every user whose edit you review! (${stats.users_welcomed.total})` :
											`For every ${
												((stats.edits_reviewed.total / stats.users_welcomed.total) || 0).toFixed(3)
											} edits you review, you ${stats.users_welcomed.total === 0 ? "still won't " : ""}welcome a new user`
										}
									</div>
								</div>
							</div>
						</div>

						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.warnings_issued.total}</div>
									<div class="stat-label">Warnings Issued</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										${
											((stats.warnings_issued.level_1 / stats.warnings_issued.total * 100) || 0).toFixed(1)
										}% were level 1
									</div>
									<div class="stat-sublabel">
										${
											((stats.warnings_issued.level_2 / stats.warnings_issued.total * 100) || 0).toFixed(1)
										}% were level 2
									</div>
									<div class="stat-sublabel">
										${
											((stats.warnings_issued.level_3 / stats.warnings_issued.total * 100) || 0).toFixed(1)
										}% were level 3
									</div>
									<div class="stat-sublabel">
										${
											((stats.warnings_issued.level_4 / stats.warnings_issued.total * 100) || 0).toFixed(1)
										}% were level 4
									</div>
									<div class="stat-sublabel">
										${
											((stats.warnings_issued.level_4im / stats.warnings_issued.total * 100) || 0).toFixed(1)
										}% were level 4im
									</div>
									<div class="stat-sublabel">
										...and the rest we were too lazy to track =)
									</div>
								</div>
							</div>
						</div>
						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.reports_filed.total}</div>
									<div class="stat-label">Reports Filed</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										AIV accounted for ${
											((stats.reports_filed.AIV / stats.reports_filed.total * 100) || 0).toFixed(1)
										}% of your reports
									</div>
									<div class="stat-sublabel">
										another ${
											((stats.reports_filed.UAA / stats.reports_filed.total * 100) || 0).toFixed(1)
										}% were for UAA
									</div>
									<div class="stat-sublabel">
										and the last ${
											((stats.reports_filed.RFPP / stats.reports_filed.total * 100) || 0).toFixed(1)
										}% were posted at RFPP (yes, we count that as a report)
									</div>
								</div>
							</div>
						</div>

						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.watchlist.watched}</div>
									<div class="stat-label">Pages Watched</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										${stats.watchlist.unwatched} pages were annoying enough to unwatch
									</div>
								</div>
							</div>
						</div>
						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.items_whitelisted.total}</div>
									<div class="stat-label">Items Whitelisted</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										${stats.items_whitelisted.users} (${
											((stats.items_whitelisted.users / stats.items_whitelisted.total * 100) || 0).toFixed(1)
										}%) users whitelisted
									</div>
									<div class="stat-sublabel">
										${stats.items_whitelisted.pages} (${
											((stats.items_whitelisted.pages / stats.items_whitelisted.total * 100) || 0).toFixed(1)
										}%) pages whitelisted
									</div>
									<div class="stat-sublabel">
										${stats.items_whitelisted.tags} (${
											((stats.items_whitelisted.tags / stats.items_whitelisted.total * 100) || 0).toFixed(1)
										}%) tags whitelisted
									</div>
								</div>
							</div>
						</div>
						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${stats.items_highlighted.total}</div>
									<div class="stat-label">Items Highlighted</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										${stats.items_highlighted.users} (${
											((stats.items_highlighted.users / stats.items_highlighted.total * 100) || 0).toFixed(1)
										}%) users highlighted
									</div>
									<div class="stat-sublabel">
										${stats.items_highlighted.pages} (${
											((stats.items_highlighted.pages / stats.items_highlighted.total * 100) || 0).toFixed(1)
										}%) pages highlighted
									</div>
									<div class="stat-sublabel">
										${stats.items_highlighted.tags} (${
											((stats.items_highlighted.tags / stats.items_highlighted.total * 100) || 0).toFixed(1)
										}%) tags highlighted
									</div>
								</div>
							</div>
						</div>
						<div class="stat-card">
							<div class="inside shimmer shimmer-border">
								<div class="front">
									<div class="stat-value">${formatTime(sessionTime)}</div>
									<div class="stat-label">Session Time</div>
								</div>
								<div class="back">
									<div class="stat-sublabel">
										${
											(stats.reports_filed.total / (sessionTime / 8.64e+7 || 1) || 0).toFixed(2)
										} reports per day
									</div>
									<div class="stat-sublabel">
										${
											(stats.reverts_made.total / (sessionTime / 3.6e+6 || 1) || 0).toFixed(2)
										} reverts per hour
									</div>
									<div class="stat-sublabel">
										${
											(stats.edits_reviewed.total / (sessionTime / 6e+4 || 1) || 0).toFixed(2)
										} reviews per minute
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			`;

		this.contentContainer.querySelector("#reset-stats-button").addEventListener("click", () => {
			if (confirm("Are you sure you want to reset all statistics? This cannot be undone.")) {
				this.wikishield.loadTime = performance.now();
				this.wikishield.storage.data.statistics = { };
				this.wikishield.storage.load(this.wikishield.storage.data);

				this.openStatistics();
			}
		});

		this.setPath("#Statistics", "Overview");
	}

	/**
	* Open about settings section
	*/
	openAbout() {
		this.renderComponent(
			h(AboutSettings, {
				wikishield: this.wikishield,
				version: this.wikishield.__script__.version,
				changelog: this.wikishield.__script__.changelog.HTML,
			})
		);

		this.setPath("#About", "WikiShield");
	}

	/**
	* Open import/export settings section
	*/
	openSaveSettings() {
		this.clearContent();
		this.contentContainer.innerHTML = `
			<div id="save-settings" class="settings-section">
				<div class="save-settings-header">
					<div class="settings-section-title">Save Settings</div>
					<div class="settings-section-desc">Manage how and where your WikiShield settings are stored.</div>
				</div>

				<div class="save-settings-content">
					<div class="save-settings-card cloud-storage-card">
						<div class="card-header">
							<div class="card-icon">
								<i class="fa fa-cloud"></i>
							</div>
							<div class="card-header-content">
								<div class="card-title">Cloud Storage</div>
								<div class="card-desc">Store your settings in the cloud for access across multiple browsers and devices.</div>
							</div>
							<div class="card-toggle" id="enable-cloud-storage"></div>
						</div>
					</div>

					<div class="save-settings-card data-management-card">
						<div class="card-header">
							<div class="card-icon">
								<i class="fa fa-database"></i>
							</div>
							<div class="card-header-content">
								<div class="card-title">Data Management</div>
								<div class="card-desc">Import, export, or reset your WikiShield settings. Settings are encoded as base64 for easy sharing.</div>
							</div>
						</div>

						<div class="card-body">
							<div class="action-buttons-grid">
								<button id="export-settings-btn" class="action-card export-card">
									<div class="action-card-icon">
										<i class="fa fa-download"></i>
									</div>
									<div class="action-card-content">
										<div class="action-card-title">Export Settings</div>
										<div class="action-card-desc">Save your configuration</div>
									</div>
								</button>

								<button id="import-settings-btn" class="action-card import-card">
									<div class="action-card-icon">
										<i class="fa fa-upload"></i>
									</div>
									<div class="action-card-content">
										<div class="action-card-title">Import Settings</div>
										<div class="action-card-desc">Load saved configuration</div>
									</div>
								</button>

								<button id="reset-settings-btn" class="action-card reset-card">
									<div class="action-card-icon">
										<i class="fa fa-undo"></i>
									</div>
									<div class="action-card-content">
										<div class="action-card-title">Reset Settings</div>
										<div class="action-card-desc">Restore to defaults</div>
									</div>
								</button>
							</div>

							<div id="import-export-status" class="status-message hidden"></div>

							<textarea
								id="import-settings-input"
								class="import-textarea hidden"
								placeholder="Paste your base64 settings string here..."
								rows="8"
							></textarea>
						</div>
					</div>
				</div>
			</div>
		`;

		this.createToggle(
			this.contentContainer.querySelector("#enable-cloud-storage"),
			this.wikishield.storage.data.settings.cloud_storage.enabled,
			(newValue) => {
				this.wikishield.storage.data.settings.cloud_storage.enabled = newValue;
				mw.storage.store.setItem("WikiShield:CloudStorage", newValue);
			}
		);

		// Import/Export handlers
		const exportBtn = this.contentContainer.querySelector('#export-settings-btn');
		const importBtn = this.contentContainer.querySelector('#import-settings-btn');
		const resetBtn = this.contentContainer.querySelector('#reset-settings-btn');
		const statusDiv = this.contentContainer.querySelector('#import-export-status');
		const importInput = this.contentContainer.querySelector('#import-settings-input');

		exportBtn.addEventListener('click', async () => {
			try {
				const base64String = await this.wikishield.save(true); // Export current settings as base64

				const tempTextarea = document.createElement('textarea');
				tempTextarea.value = base64String;
				document.body.appendChild(tempTextarea);
				tempTextarea.select();
				document.execCommand('copy');
				document.body.removeChild(tempTextarea);

				statusDiv.classList.remove("hidden", "error");
				statusDiv.classList.add("success");
				statusDiv.innerHTML = `
					<div class="status-content">
						<i class="fa fa-check-circle status-icon"></i>
						<div class="status-text">
							<div class="status-title">Settings exported successfully!</div>
							<div class="status-desc">The base64 string has been copied to your clipboard.</div>
						</div>
					</div>
				`;
			} catch (error) {
				statusDiv.classList.remove("hidden", "success");
				statusDiv.classList.add("error");
				statusDiv.innerHTML = `
					<div class="status-content">
						<i class="fa fa-times-circle status-icon"></i>
						<div class="status-text">
							<div class="status-title">Export failed!</div>
							<div class="status-desc">${error.message}</div>
						</div>
					</div>
				`;
			}
		});

		importBtn.addEventListener('click', async () => {
			if (importInput.classList.contains("hidden")) {
				statusDiv.classList.add("hidden");
				importInput.value = "";
				importInput.classList.remove("hidden");
				importBtn.querySelector('.action-card-title').textContent = 'Apply Import';
				importBtn.querySelector('.action-card-icon i').className = 'fa fa-check';
				importBtn.classList.add('active');
			} else {
				const base64 = importInput.value.trim();
				if (!base64) {
					statusDiv.classList.remove("hidden", "success");
					statusDiv.classList.add("error");
					statusDiv.innerHTML = `
						<div class="status-content">
							<i class="fa fa-exclamation-circle status-icon"></i>
							<div class="status-text">
								<div class="status-title">No input provided!</div>
								<div class="status-desc">Please paste a base64 settings string.</div>
							</div>
						</div>
					`;
					return;
				}

				try {
					const logs = await this.wikishield.init(base64, true); // Try to import settings

					const [ expected, unexpected ] = logs.reduce((acc, log) => {
						if (log.expected) {
							acc[0].push(log);
						} else {
							acc[1].push(log);
						}

						return acc;
					}, [ [ ], [ ] ]);

					statusDiv.classList.remove("hidden", "error");
					statusDiv.classList.add("success");
					statusDiv.innerHTML = `
						<div class="status-content">
							<i class="fa fa-check-circle status-icon"></i>
							<div class="status-text">
								<div class="status-title">Settings imported successfully!</div>
								<div class="status-desc">${unexpected.length} issue${unexpected.length === 1 ? '' : 's'} encountered during import.</div>
							</div>
						</div>
					`;
				} catch (error) {
					statusDiv.classList.remove("hidden", "success");
					statusDiv.classList.add("error");
					statusDiv.innerHTML = `
						<div class="status-content">
							<i class="fa fa-times-circle status-icon"></i>
							<div class="status-text">
								<div class="status-title">Import failed!</div>
								<div class="status-desc">${error.message}</div>
							</div>
						</div>
					`;
				}

				importInput.classList.add("hidden");
				importBtn.querySelector('.action-card-title').textContent = 'Import Settings';
				importBtn.querySelector('.action-card-icon i').className = 'fa fa-upload';
				importBtn.classList.remove('active');
			}
		});

		resetBtn.addEventListener('click', async () => {
			if (confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
				await this.wikishield.init("e30=", true);

				statusDiv.classList.remove("hidden", "success");
				statusDiv.classList.add("info");
				statusDiv.innerHTML = `
					<div class="status-content">
						<i class="fa fa-info-circle status-icon"></i>
						<div class="status-text">
							<div class="status-title">Settings reset successfully!</div>
							<div class="status-desc">All settings have been restored to their default values.</div>
						</div>
					</div>
				`;
			}
		});

		this.setPath("#Misc", "Save");
	}

	/**
	* Remove all existing settings containers
	*/
	closeSettings() {
		this.wikishield.audioManager.stopPreviews();
		this.isOpen = false;
		document.body.classList.remove("settings-open"); // Remove blur class
		[...document.querySelectorAll(".settings-container")].forEach(elem => elem.remove());

		// Trigger dialog queue processing now that settings are closed
		if (this.wikishield.interface) {
			this.wikishield.interface._processDialogQueue();
		}
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

		if (this.keypressCallback && validControlKeys.has(event.key.toLowerCase())) {
			this.keypressCallback(event.key.toLowerCase());
			event.preventDefault();
		}
	}
}
