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
import { WikiShield } from './core/wikishield.js';
import { killswitch_status, checkKillswitch, startKillswitchPolling } from './core/killswitch.js';

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



	let wikishield;
	let wikishieldEventData;

	if (mw.config.get("wgRelevantPageName") === "Wikipedia:WikiShield/run" && mw.config.get("wgAction") === "view") {
		// Create a temporary API instance to check killswitch before full initialization
		const tempApi = new WikiShieldAPI(null, new mw.Api());

		// Check killswitch before initializing
		checkKillswitch(tempApi, true).then(() => {
			if (killswitch_status.disabled) {
				console.log("WikiShield: Disabled by killswitch");
				mw.notify("WikiShield is currently disabled by the development team.", { type: 'error' });
				return;
			}

			if (window.sessionStorage.getItem("WikiShield:SendHardReloadNotification"))  {
				window.sessionStorage.removeItem("WikiShield:SendHardReloadNotification");
				killswitch_status.notifications.push({
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
				window.addEventListener("beforeunload", () => wikishield.save());

				for (const notification of killswitch_status.notifications) {
					wikishield.notifications.unshift(notification);
				}

				killswitch_status.notifications = [ ];

				// Start killswitch polling after successful initialization
				startKillswitchPolling(wikishield.api, data => {
					for (const notification of data.notifications) {
						wikishield.notifications.unshift(notification);
					}

					data.notifications = [ ];
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
				window.addEventListener("beforeunload", () => wikishield.save());
				startKillswitchPolling(wikishield.api);
			});
			window.addEventListener("keydown", wikishield.keyPressed.bind(wikishield));
		});
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
