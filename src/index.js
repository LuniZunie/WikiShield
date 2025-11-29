// <nowiki>

import { fullTrim } from './utils/formatting.js';
import { BuildAIAnalysisPrompt, BuildAIUsernamePrompt } from './ai/prompts.js';
import { defaultSettings, colorPalettes } from './config/defaults.js';
import { warnings, warningTemplateColors, warningsLookup, getWarningFromLookup } from './data/warnings.js';
import { namespaces } from './data/namespaces.js';
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
import { WikiShield } from './core/wikishield.js';
import { killswitch_status, checkKillswitch, startKillswitchPolling } from './core/killswitch.js';

export const __script__ = {
	version: "1.0.0",

	changelog: {
		version: "2",
		date: new Date(Date.UTC(2025, 11, 28, 20)),
		HTML: wikishieldHTML.changelog
	},

	pages: {
		AVI: "Wikipedia:Administrator intervention against vandalism",
		UAA: "Wikipedia:Usernames for administrator attention",
		RFPP: "Wikipedia:Requests for page protection/Increase"
	},

	config: {
		refresh: {
			recent: 1000,
			flagged: 1000,
			watchlist: 1000,
		},
		historyCount: 10,
	},
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
	};


	let wikishield;
	let wikishieldEventData;

	const link1 = mw.util.addPortletLink(
		'p-personal',
		mw.util.getUrl('Wikipedia:WikiShield/run'),
		'🛡️ WikiShield',
		'pt-wikishield',
		'wikishield',
		null,
		'#pt-preferences'
	);

	// add link to sticky header for Vector2022
	const link2 = mw.util.addPortletLink(
		'p-personal-sticky-header',
		mw.util.getUrl('Wikipedia:WikiShield/run'),
		'🛡️ WikiShield',
		'pt-wikishield',
		'WikiShield',
		null,
		'#pt-preferences'
	);

	const load = () => {
		window.onpopstate = (event) => {
			if (event.state?.page !== "WikiShield") {
				window.location.reload();
				window.onpopstate = null;
			}
		};

		// Create a temporary API instance to check killswitch before full initialization
		const tempApi = new WikiShieldAPI(null, new mw.Api());

		// Check killswitch before initializing
		checkKillswitch(tempApi, true).then(() => {
			if (killswitch_status.disabled) {
				console.log("WikiShield: Disabled by killswitch");
				mw.notify("WikiShield is currently disabled by the development team.", { type: 'error' });
				return;
			}

			if (window.sessionStorage.getItem("WikiShield:SendHardReloadAlert"))  {
				window.sessionStorage.removeItem("WikiShield:SendHardReloadAlert");
				killswitch_status.alerts.push({
					id: `app-${performance.now()}`,
					type: "app",
					subtype: "hard-reload",
					timestamp: Date.now(),
					title: "The development team has forced a reload.",
					agent: "WikiShield Development",
					category: "WikiShield",
					read: false
				});
			}

			// Initialize WikiShield if not disabled
			wikishield = new WikiShield(wikishieldData);
			// Initialize queue after wikishield is created (needs reference to wikishield)
			wikishield.queue = new WikiShieldQueue(wikishield);

			// Initialize event data after wikishield is created (avoids circular dependency)
			wikishieldEventData = {
				conditions: createConditions(wikishield),
				welcomeTemplates: welcomeTemplates
			};

			// Set wikishieldEventData on the wikishield instance
			wikishield.wikishieldEventData = wikishieldEventData;

			// Initialize event manager's events with the event data
			wikishield.interface.eventManager.initializeEvents(wikishieldEventData);

			wikishield.init().then(() => {
				const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
				const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
				const isDesktop = !isIOS && !/android/i.test(navigator.userAgent);

				// SAFARI (non-iOS) – visibilitychange works
				if (isSafari && !isIOS) {
					document.addEventListener("visibilitychange", () => {
						if (document.visibilityState === "hidden") {
							wikishield.save();
						}
					});
				}

				// iOS – pagehide is required because visibilitychange is unreliable
				if (isIOS) {
					window.addEventListener("pagehide", () => {
						wikishield.save();
					});
				}

				// Desktop – beforeunload is the only consistent option
				if (isDesktop) {
					window.addEventListener("beforeunload", () => {
						wikishield.save();
					});
				}

				for (const alert of killswitch_status.alerts) {
					wikishield.alerts.unshift(alert);
				}

				killswitch_status.alerts = [ ];

				// Start killswitch polling after successful initialization
				startKillswitchPolling(wikishield.api, data => {
					if (data.disabled === true) {
						history.replaceState({ page: "WikiShield-reload" }, "", window.location.href);
                    	location.reload();
						return;
					}

					for (const alert of data.alerts) {
						wikishield.alerts.unshift(alert);
					}

					data.alerts = [ ];
				});
			});

			window.addEventListener("keydown", wikishield.keyPressed.bind(wikishield));
		}).catch((err) => {
			console.error("WikiShield: Failed to check killswitch:", err);
			mw.notify("WikiShield: Failed to check killswitch. Loading anyway...", { type: 'warn' });

			// Initialize anyway if killswitch check fails (network issues shouldn't prevent loading)
			wikishield = new WikiShield(wikishieldData);
			wikishield.queue = new WikiShieldQueue(wikishield);
			wikishieldEventData = {
				conditions: createConditions(wikishield),
				welcomeTemplates: welcomeTemplates
			};
			wikishield.wikishieldEventData = wikishieldEventData;
			wikishield.interface.eventManager.initializeEvents(wikishieldEventData);
			wikishield.init().then(() => {
				const isIOS = /iP(ad|hone|od)/.test(navigator.userAgent);
				const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
				const isDesktop = !isIOS && !/android/i.test(navigator.userAgent);

				// SAFARI (non-iOS) – visibilitychange works
				if (isSafari && !isIOS) {
					document.addEventListener("visibilitychange", () => {
						if (document.visibilityState === "hidden") {
							wikishield.save();
						}
					});
				}

				// iOS – pagehide is required because visibilitychange is unreliable
				if (isIOS) {
					window.addEventListener("pagehide", () => {
						wikishield.save();
					});
				}

				// Desktop – beforeunload is the only consistent option
				if (isDesktop) {
					window.addEventListener("beforeunload", () => {
						wikishield.save();
					});
				}

				startKillswitchPolling(wikishield.api);
			});
			window.addEventListener("keydown", wikishield.keyPressed.bind(wikishield));
		});
	};

	const onClick = (e) => {
		e.preventDefault();
		history.pushState({ page: "WikiShield" }, "", window.location.href);

		load();
	};
	link1?.addEventListener('click', onClick);
	link2?.addEventListener('click', onClick);

	window.addEventListener("popstate", (event) => {
		if (event.state?.page === "WikiShield") {
			load();
		}
	});

	// this switch statement handles incredibly unique edge cases that would be fucking annoying as shit for users to deal with
	switch (history.state?.page) {
		case "WikiShield": {
			history.replaceState(null, "", window.location.href);
		} break;
		case "WikiShield-reload": {
			history.replaceState({ page: "WikiShield" }, "", window.location.href);
			load();
		} break;
	}

	if (mw.config.get("wgRelevantPageName") === "Wikipedia:WikiShield/run" && mw.config.get("wgAction") === "view") {
		history.pushState({ page: "WikiShield" }, "", window.location.href);
		load();
	}
}

// </nowiki>
