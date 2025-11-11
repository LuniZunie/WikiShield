/**
 * WikiShieldSettingsInterface - Settings UI management
 * Handles the settings interface and user configuration
 */

import { h, render } from 'preact';
import { defaultSettings, colorPalettes } from '../config/defaults.js';
import { namespaces } from '../data/namespaces.js';
import { sounds } from '../data/sounds.js';
import { wikishieldHTML } from './templates.js';
// import { wikishieldEventData } from '../core/event-manager.js';
import {
	GeneralSettings,
	AudioSettings,
	AppearanceSettings,
	WhitelistSettings,
	HighlightedSettings,
	StatisticsSettings,
	AISettings,
	ImportExportSettings,
	AboutSettings
} from './settings-components.jsx';

// Allowed keys for keyboard shortcuts
export const wikishieldSettingsAllowedKeys = [
	"!", "@", "#", "$", "%", "^", "&", "*", "(", ")",
	"1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
	"q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
	"a", "s", "d", "f", "g", "h", "j", "k", "l",
	"z", "x", "c", "v", "b", "n", "m",
	"-", "=", "[", "]", "\\", ";", "'", ",", ".", "/", "enter",
	"_", "+", "{", "}", "|", ":", "\"", "<", ">", "?", " ",
	"arrowleft", "arrowup", "arrowdown", "arrowright"
];

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
				this.wikishield.queue.playClickSound();
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

			const value = this.wikishield.options.volumes?.[triggerKey] ?? 0.5;
			const currentSound = this.wikishield.options.soundMappings?.[triggerKey] || triggerKey;

		// Build sound selector options grouped by category
		const soundsByCategory = {};
		Object.entries(sounds).forEach(([key, sound]) => {
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

				if (!this.wikishield.options.volumes) this.wikishield.options.volumes = {};
				this.wikishield.options.volumes[triggerKey] = val;
				this.wikishield.save();
			};

			slider.addEventListener("input", () => updateVolume(slider.value));
			input.addEventListener("change", () => updateVolume(input.value));

			// Sound selector
			soundSelector.addEventListener("change", () => {
				if (!this.wikishield.options.soundMappings) this.wikishield.options.soundMappings = {};
				this.wikishield.options.soundMappings[triggerKey] = soundSelector.value;
				this.wikishield.save();
			});

			// Preview button - do NOT play click sound
			previewBtn.addEventListener("click", () => {
				if (playFunction) playFunction.call(this.wikishield.queue);
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
				this.wikishield.queue.playClickSound();
				value = Math.round(Math.max(value - step, min) * 100) / 100;
				inputElem.value = value;
				onChange(value);
			});

			input.querySelector(".fa-plus").addEventListener("click", () => {
				this.wikishield.queue.playClickSound();
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
			this.wikishield.queue.playClickSound();

			// Clear/unmount any previous content before switching tabs
			this.clearContent();

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
		this.renderComponent(
			h(GeneralSettings, {
				maxEditCount: this.wikishield.options.maxEditCount,
				maxQueueSize: this.wikishield.options.maxQueueSize,
				minOresScore: this.wikishield.options.minimumORESScore,
				watchlistExpiry: this.wikishield.options.watchlistExpiry,
				highlightedExpiry: this.wikishield.options.highlightedExpiry,
				namespaces,
				selectedNamespaces: this.wikishield.options.namespacesShown,
				enableUsernameHighlighting: this.wikishield.options.enableUsernameHighlighting,
				onMaxEditCountChange: (value) => {
					this.wikishield.options.maxEditCount = value;
					this.wikishield.save();
				},
				onMaxQueueSizeChange: (value) => {
					this.wikishield.options.maxQueueSize = value;
					this.wikishield.save();
				},
				onMinOresScoreChange: (value) => {
					this.wikishield.options.minimumORESScore = value;
					this.wikishield.save();
				},
				onWatchlistExpiryChange: (value) => {
					this.wikishield.options.watchlistExpiry = value;
					this.wikishield.save();
				},
				onHighlightedExpiryChange: (value) => {
					this.wikishield.options.highlightedExpiry = value;
					this.wikishield.save();
				},
				onNamespaceToggle: (nsid, checked) => {
					if (checked) {
						const set = new Set(this.wikishield.options.namespacesShown);
						set.add(nsid);
						this.wikishield.options.namespacesShown = [...set];
					} else {
						this.wikishield.options.namespacesShown = this.wikishield.options.namespacesShown
							.filter(n => n !== nsid);
					}
					this.wikishield.save();
				},
				onUsernameHighlightingChange: (value) => {
					this.wikishield.options.enableUsernameHighlighting = value;
					this.wikishield.save();
				}
			})
		);
	}

		/**
		 * Open audio settings section
		 */
		openAudio() {
			this.clearContent();
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

			const masterValue = this.wikishield.options.masterVolume ?? 0.5;

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
				this.wikishield.options.masterVolume = val;
				this.wikishield.save();
			};

			masterSlider.addEventListener("input", () => updateMasterVolume(masterSlider.value));
			masterInput.addEventListener("change", () => updateMasterVolume(masterInput.value));

			// ORES alert toggle
			this.createToggle(
				this.contentContainer.querySelector("#sound-alert-toggle"),
				this.wikishield.options.enableSoundAlerts,
				(newValue) => {
					this.wikishield.options.enableSoundAlerts = newValue;
					this.wikishield.save();
				}
			);

			// ORES alert threshold
			this.createNumericInput(
				this.contentContainer.querySelector("#sound-alert-ores-score"),
				this.wikishield.options.soundAlertORESScore, 0, 1, 0.05,
				(newValue) => {
					this.wikishield.options.soundAlertORESScore = newValue;
					this.wikishield.save();
				}
			);

			// Individual sound controls
			const soundsContainer = this.contentContainer.querySelector("#sound-volumes-container");

			const sounds = [
				{ key: "click", title: "Click Sound", desc: "Played when clicking buttons and UI elements", fn: this.wikishield.queue.playClickSound },
				{ key: "notification", title: "Notification Sound", desc: "Played when you receive an alert or notice", fn: this.wikishield.queue.playNotificationSound },
				{ key: "watchlist", title: "Watchlist Sound", desc: "Played when you your watchlist is updated", fn: this.wikishield.queue.playWatchlistSound },
				{ key: "alert", title: "Alert Sound", desc: "Played when a high ORES score edit is added to the queue", fn: this.wikishield.queue.playAlertSound },
				{ key: "whoosh", title: "Whoosh Sound", desc: "Played when items are removed or cleared", fn: this.wikishield.queue.playWhooshSound },
				{ key: "warn", title: "Warn Sound", desc: "Played when issuing a warning to a user", fn: this.wikishield.queue.playWarnSound },
				{ key: "rollback", title: "Rollback Sound", desc: "Played when performing a rollback action", fn: this.wikishield.queue.playRollbackSound },
				{ key: "report", title: "Report Sound", desc: "Played when reporting a user or page", fn: this.wikishield.queue.playReportSound },
				{ key: "thank", title: "Thank Sound", desc: "Played when thanking a user for their edit", fn: this.wikishield.queue.playThankSound },
				{ key: "protection", title: "Protection Sound", desc: "Played when requesting page protection", fn: this.wikishield.queue.playProtectionSound },
				{ key: "block", title: "Block Sound", desc: "Played when blocking a user", fn: this.wikishield.queue.playBlockSound },
				{ key: "sparkle", title: "Sparkle Sound", desc: "Played when highlighting or whitelisting users", fn: this.wikishield.queue.playSparkleSound }
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
		this.renderComponent(
			h(AppearanceSettings, {
				selectedPalette: this.wikishield.options.selectedPalette,
				colorPalettes,
				onPaletteChange: (paletteIndex) => {
					this.wikishield.queue.playClickSound();
					this.wikishield.options.selectedPalette = paletteIndex;
					document.querySelectorAll(".queue-edit-color").forEach(el => {
						el.style.background = this.wikishield.interface.getORESColor(+el.dataset.rawOresScore);
					});
					this.wikishield.save();
					// Re-render queue to show new colors
					if (this.wikishield.interface) {
						this.wikishield.interface.renderQueue(
							this.wikishield.queue.queue,
							this.wikishield.queue.currentEdit
						);
					}
				}
			})
		);
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
					<div class="add-action-button new-control-script">
						<span class="fa fa-plus"></span>
						New control script
					</div>
				</div>
			`;

			for (const control of this.wikishield.options.controlScripts) {
				const container = document.createElement("div");
				container.classList.add("settings-section");
				this.contentContainer.appendChild(container);

				this.createControlInterface(container, control);
			}

			this.updateDuplicateControls();

			const addButton = this.contentContainer.querySelector(".new-control-script");

			addButton.addEventListener("click", () => {
				this.wikishield.options.controlScripts.unshift({
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

			for (const control of this.wikishield.options.controlScripts) {
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
					this.wikishield.save();
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
					this.wikishield.save();
				};
			});

			for (const action of control.actions) {
				this.createActionItem(
					actionContainer,
					action,
					control,
					() => {
						this.wikishield.save();
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
				this.wikishield.queue.playClickSound();
				this.wikishield.options.controlScripts.splice(this.wikishield.options.controlScripts.indexOf(control), 1);
				this.wikishield.save();
				this.openControls();
			});

			const addContainer = bottomContainer.querySelector(".add-action-container");

			const resetAddContainer = () => {
				addContainer.innerHTML = `<div class="add-action-button new-button">Add new action</div>`;

				addContainer.querySelector(".new-button").addEventListener("click", () => {
					this.wikishield.queue.playClickSound();
					addContainer.innerHTML = `
						<select style="height: 35px;"></select>
						<div class="add-action-button cancel-button">Cancel</div>
						<div class="add-action-button create-button">Create</div>
					`;

					const select = addContainer.querySelector("select");

					Object.keys(this.wikishield.interface.eventManager.events).forEach(name => {
						select.innerHTML += `<option value="${name}">${this.wikishield.interface.eventManager.events[name].description}</option>`;
					});
					select.innerHTML += `<option value="if">If condition</option>`;

					addContainer.querySelector(".cancel-button").addEventListener("click", () => {
						this.wikishield.queue.playClickSound();
						resetAddContainer();
					});
					addContainer.querySelector(".create-button").addEventListener("click", () => {
						this.wikishield.queue.playClickSound();
						const action = {
							name: select.value,
							params: {}
						};
						if (select.value === "if") {
							action.actions = [];
							action.condition = "operatorNonAdmin";
						}

						control.actions.push(action);
						this.wikishield.save();
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

			for (const key in this.wikishield.interface.eventManager.events.conditions) {
				select.innerHTML += `<option value=${key}>${this.wikishield.interface.eventManager.events.conditions[key].desc}</option>`;
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
						this.wikishield.save();
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
			this.clearContent();
			this.contentContainer.innerHTML = `
				<div class="settings-section" id="enable-ollama-ai">
					<div class="settings-section-title">Enable Ollama AI Analysis</div>
					<div class="settings-section-desc">Use local AI models with complete privacy. Free & fast.</div>
				</div>

				<div class="settings-section" id="ollama-server-url">
					<div class="settings-section-title">Server URL</div>
					<div class="settings-section-desc">
						<input type="text" id="ollama-url-input" value="${this.wikishield.options.ollamaServerUrl}"
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
				this.wikishield.options.enableOllamaAI,
				(newValue) => {
					this.wikishield.options.enableOllamaAI = newValue;
					this.wikishield.save();

				// Initialize or destroy Ollama AI instance
				if (newValue) {
					this.wikishield.ollamaAI = new WikiShieldOllamaAI(
						this.wikishield.options.ollamaServerUrl,
						this.wikishield.options.ollamaModel,
						{
							enableOllamaAI: this.wikishield.options.enableOllamaAI,
							enableEditAnalysis: this.wikishield.options.enableEditAnalysis
						}
					);
					this.wikishield.logger.log("Ollama AI integration enabled");
				} else {
					this.wikishield.ollamaAI = null;
					this.wikishield.logger.log("Ollama AI integration disabled");
					}
				}
			);

			// Server URL input handler
			const urlInput = this.contentContainer.querySelector("#ollama-url-input");
			urlInput.addEventListener('change', () => {
				this.wikishield.options.ollamaServerUrl = urlInput.value.trim();
				this.wikishield.save();
				if (this.wikishield.ollamaAI) {
					this.wikishield.ollamaAI.serverUrl = this.wikishield.options.ollamaServerUrl;
				}
				this.wikishield.logger.log(`Ollama server URL updated: ${this.wikishield.options.ollamaServerUrl}`);
			});

			// Test connection button
			const testBtn = this.contentContainer.querySelector("#test-connection-btn");
			const statusSpan = this.contentContainer.querySelector("#connection-status");
			testBtn.addEventListener('click', async () => {
				// Cancel all active AI requests
				if (this.wikishield.ollamaAI) {
					this.wikishield.ollamaAI.cancelAllAnalyses();
				}

			statusSpan.innerHTML = '<span style="color: #ffc107;">Testing...</span>';
			testBtn.disabled = true;

			const tempAI = new WikiShieldOllamaAI(this.wikishield.options.ollamaServerUrl, "", {});
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
				if (this.wikishield.ollamaAI) {
					this.wikishield.ollamaAI.cancelAllAnalyses();
				}

				modelsStatus.innerHTML = '<span style="color: #ffc107;">Loading...</span>';
				refreshBtn.disabled = true;

				try {
				const tempAI = new WikiShieldOllamaAI(this.wikishield.options.ollamaServerUrl, "", {});
				const models = await tempAI.fetchModels();

					if (models.length === 0) {
						modelsContainer.innerHTML = '<div style="color: #dc3545;">No models found. Please install models using: <code>ollama pull [model-name]</code></div>';
						modelsStatus.innerHTML = '<span style="color: #dc3545;">No models found</span>';
					} else {
						modelsStatus.innerHTML = `<span style="color: #28a745;"><span class="fa fa-check-circle"></span> Found ${models.length} model(s)</span>`;

						let modelsHTML = '<div style="display: grid; gap: 8px; margin-top: 8px;">';
						models.forEach(model => {
							const isSelected = model.name === this.wikishield.options.ollamaModel;
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
								if (this.wikishield.ollamaAI) {
									this.wikishield.ollamaAI.cancelAllAnalyses();
								}

								const modelName = item.dataset.model;
								this.wikishield.options.ollamaModel = modelName;
								this.wikishield.save();
								if (this.wikishield.ollamaAI) {
									this.wikishield.ollamaAI.model = modelName;
								}
								this.wikishield.logger.log(`Ollama model selected: ${modelName}`);

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
								if (item.dataset.model !== this.wikishield.options.ollamaModel) {
									item.style.borderColor = '#667eea';
								}
							});
							item.addEventListener('mouseleave', () => {
								if (item.dataset.model !== this.wikishield.options.ollamaModel) {
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
			this.clearContent();
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
				this.wikishield.options.enableUsernameHighlighting,
				(newValue) => {
					this.wikishield.options.enableUsernameHighlighting = newValue;
					this.wikishield.save();
				}
			);

            this.createToggle(
				this.contentContainer.querySelector("#welcome-latin-toggle"),
				this.wikishield.options.enableWelcomeLatin,
				(newValue) => {
					this.wikishield.options.enableWelcomeLatin = newValue;
					this.wikishield.save();
				}
			);
			this.createToggle(
				this.contentContainer.querySelector("#auto-welcome-toggle"),
				this.wikishield.options.enableAutoWelcome,
				(newValue) => {
					this.wikishield.options.enableAutoWelcome = newValue;
					this.wikishield.save();
				}
			);

			this.createToggle(
				this.contentContainer.querySelector("#edit-analysis-toggle"),
				this.wikishield.options.enableEditAnalysis,
				(newValue) => {
					this.wikishield.options.enableEditAnalysis = newValue;
					this.wikishield.save();
				}
			);
			this.createToggle(
				this.contentContainer.querySelector("#username-analysis-toggle"),
				this.wikishield.options.enableUsernameAnalysis,
				(newValue) => {
					this.wikishield.options.enableUsernameAnalysis = newValue;
					this.wikishield.save();
				}
			);
		}

		/**
		 * Open whitelist settings section
		 */
		openWhitelist() {
			this.clearContent();
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
					this.wikishield.whitelist.set(username, Date.now());
					this.wikishield.save();
					input.value = "";
					this.openWhitelist(); // Refresh the list
					this.wikishield.sounds.success();
				}
			};

			button.addEventListener("click", addUser);
			input.addEventListener("keypress", (e) => {
				if (e.key === "Enter") addUser();
			});

			this.createUserListWithDates(container, this.wikishield.whitelist, this.wikishield.save.bind(this.wikishield));
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
						<a target="_blank" href="${this.wikishield.util.pageLink(`Special:Contributions/${user}`)}">${user}</a>
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
						<a target="_blank" href="${this.wikishield.util.pageLink(`Special:Contributions/${user}`)}" style="font-weight: 600;">${user}</a>
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
			const expiryString = this.wikishield.options.highlightedExpiry;
			this.clearContent();
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
					const expiryMs = this.wikishield.util.expiryToMilliseconds(this.wikishield.options.highlightedExpiry);
					const expirationTime = Date.now() + expiryMs;
					this.wikishield.highlighted.set(username, expirationTime);
					this.wikishield.save();
					input.value = "";
					this.openHighlighted(); // Refresh the list
					this.wikishield.sounds.success();
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
			const sortedEntries = [...this.wikishield.highlighted.entries()].sort((a, b) => b[1] - a[1]);

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
				const expiryMs = this.wikishield.util.expiryToMilliseconds(this.wikishield.options.highlightedExpiry);
				const addedTime = expirationTime - expiryMs;
				const date = new Date(addedTime);
				const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();

				const expiresDate = new Date(expirationTime);
				const expiresStr = expiresDate.toLocaleDateString() + " " + expiresDate.toLocaleTimeString();
				const isExpired = Date.now() > expirationTime;

				container.appendChild(userItem);
				userItem.innerHTML = `
					<div style="display: flex; flex-direction: column; gap: 4px;">
						<a target="_blank" href="${this.wikishield.util.pageLink(`Special:Contributions/${user}`)}" style="font-weight: 600;">${user}</a>
						<span style="font-size: 0.85em; opacity: 0.7;">Added: ${dateStr}</span>
						<span style="font-size: 0.85em; opacity: 0.7; color: ${isExpired ? '#ff6b6b' : '#51cf66'};">
							${isExpired ? 'Expired' : 'Expires'}: ${expiresStr}
						</span>
					</div>
					<div class="add-action-button remove-button">Remove</div>
				`;
				userItem.querySelector(".remove-button").addEventListener("click", () => {
					this.wikishield.highlighted.delete(user);
					userItem.remove();
					this.wikishield.save();
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
			const stats = this.wikishield.statistics;
			const revertRate = stats.reviewed > 0 ? Math.round(stats.reverts / stats.reviewed * 1000) / 10 : 0;
			const sessionTime = Date.now() - (stats.sessionStart || Date.now());
			const hours = Math.floor(sessionTime / (1000 * 60 * 60));
			const minutes = Math.floor((sessionTime % (1000 * 60 * 60)) / (1000 * 60));
			const editsPerHour = hours > 0 ? Math.round(stats.reviewed / hours * 10) / 10 : 0;

			this.clearContent();
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
					this.wikishield.statistics = {
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
					this.wikishield.save();
					this.openStatistics();
					this.wikishield.sounds.success();
				}
			});
		}

	/**
	 * Open about settings section
	 */
	openAbout() {
		this.renderComponent(
			h(AboutSettings, {
				version: this.wikishield.__script__.version,
				changelog: this.wikishield.__script__.changelog.HTML
			})
		);
	}

		/**
		 * Validate and merge imported settings with current settings
		 * @param {Object} importedSettings The imported settings object
		 * @returns {Object} Result object with success status, merged settings, warnings, and applied count
		 */
		validateAndMergeSettings(importedSettings) {
			const result = {
				success: false,
				settings: JSON.parse(JSON.stringify(this.wikishield.options)), // Start with current settings
				warnings: [],
				appliedCount: 0,
				error: null
			};

			if (!importedSettings || typeof importedSettings !== 'object') {
				result.error = 'Invalid settings format';
				return result;
		}

		const defaults = defaultSettings;
		const soundKeys = Object.keys(sounds);
		const namespaceIds = namespaces.map(ns => ns.id);
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
						if (typeof value === 'number' && value >= 0 && value < colorPalettes.length) {
							result.settings[key] = Math.floor(value);
							result.appliedCount++;
						} else {
							result.warnings.push(`${key}: Invalid value (${value}), must be 0-${colorPalettes.length - 1}`);
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
			this.clearContent();
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
					const settingsJson = JSON.stringify(this.wikishield.options);
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
							this.wikishield.options = validationResult.settings;
							this.wikishield.save();

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
				this.wikishield.options = JSON.parse(JSON.stringify(defaultSettings));
				this.wikishield.save();

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
