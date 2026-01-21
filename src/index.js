// <nowiki>

import { wikishieldHTML } from './ui/templates.js';
import { WikiShieldAPI } from './core/api.js';
import { WikiShieldQueue } from './core/queue.js';
import { WikiShield } from './core/wikishield.js';
import { killswitch_status, checkKillswitch, startKillswitchPolling } from './core/killswitch.js';
import { StorageManager } from './data/storage.js';

export const __script__ = {
	version: "1.2.0",

	changelog: {
		version: "6",
		get HTML() { return wikishieldHTML.changelog; }
	},

	pages: {
		AIV: "Wikipedia:Administrator intervention against vandalism",
		UAA: "Wikipedia:Usernames for administrator attention",
		RFPP: "Wikipedia:Requests for page protection/Increase"
	},

	config: {
		refresh: {
			recent: 2000,
			flagged: 2000,
			watchlist: 2000,
			users: 2000,
		},
		historyCount: 10,
	},
};

{
	"use strict";

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
		const storageLogs = new StorageManager().load(StorageManager.versions.get(0).default).logs;
		if (storageLogs.some(log => !log.expected)) {
			StorageManager.outputLogs(storageLogs, "LoadTest");
			mw.notify("An error has occurred with the WikiShield storage system that could lead to data loss. For that reason, WikiShield has been automatically disabled. Please check your browser console for more information and immediately report this to the development team.", { type: 'error' });
			return;
		}

		window.onpopstate = (event) => {
			if (event.state?.page !== "WikiShield") {
				window.location.reload();
				window.onpopstate = null;
			}
		};

		fetch('https://ws.luni.me/changelog')
			.then(response => response.text())
			.then(data => {
				wikishieldHTML.changelog += `\n${data}`;
			})
			.catch(error => {
				console.error("WikiShield: Failed to load changelog:", error);
			});

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
			wikishield = new WikiShield();
			// Initialize queue after wikishield is created (needs reference to wikishield)
			wikishield.queue = new WikiShieldQueue(wikishield);

			wikishield.init().then(() => {
				// Setup save handlers for all devices and browsers
				// Use multiple event listeners for maximum compatibility

				// visibilitychange – works in all modern browsers
				document.addEventListener("visibilitychange", () => {
					if (document.visibilityState === "hidden") {
						wikishield.save();
					}
				});

				// pagehide – better for mobile and some edge cases
				window.addEventListener("pagehide", () => {
					wikishield.save();
				});

				// beforeunload – fallback for older browsers and desktop
				window.addEventListener("beforeunload", () => {
					wikishield.save();
				});

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
			wikishield = new WikiShield();
			wikishield.queue = new WikiShieldQueue(wikishield);

			wikishield.init().then(() => {
				// Setup save handlers for all devices and browsers
				// Use multiple event listeners for maximum compatibility

				// visibilitychange – works in all modern browsers
				document.addEventListener("visibilitychange", () => {
					if (document.visibilityState === "hidden") {
						wikishield.save();
					}
				});

				// pagehide – better for mobile and some edge cases
				window.addEventListener("pagehide", () => {
					wikishield.save();
				});

				// beforeunload – fallback for older browsers and desktop
				window.addEventListener("beforeunload", () => {
					wikishield.save();
				});

				startKillswitchPolling(wikishield.api);
			});
			window.addEventListener("keydown", wikishield.keyPressed.bind(wikishield));

			window.addEventListener("error", (event) => {
				console.error("WikiShield: Unhandled error:", event.error);
			});
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
