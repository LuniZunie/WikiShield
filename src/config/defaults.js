// Default settings and configurations

export const defaultSettings = {
	maxQueueSize: 50,
	maxEditCount: 50,
	minimumORESScore: 0,

	enableSoundAlerts: true,
	soundAlertORESScore: 0.95,

	enableUsernameHighlighting: true,
	enableWelcomeLatin: false,
	enableAutoWelcome: false,
	enableEditAnalysis: false,
	enableUsernameAnalysis: false,

	enableAutoReporting: true,
	selectedAutoReportReasons: {
		"Vandalism": true,
		"Subtle vandalism": true,
		"Image vandalism": true,
		"Sandbox": true,

		"Unsourced": true,
		"Unsourced (BLP)": true,
		"Unsourced genre": true,
		"POV": false,
		"Commentary": true,
		"AI-Generated": true,
		"AI-Generated (talk)": true,
		"MOS violation": false,
		"Censoring": false,

		"Disruption": true,
		"Deleting": true,
		"Errors": true,
		"Editing tests": true,
		"Chatting": false,
		"Jokes": true,
		"Owning": false,

		"Advertising": true,
		"Spam links": true,

		"Personal attacks": true,
		"TPO": true,
		"AfD removal": true,
	},

	zen: {
		enabled: false,
		sounds: true,

		watchlist: false,
		notifications: true,
		editCount: false,
		toasts: false,
	},

	enableCloudStorage: true,

	masterVolume: 0.5,
	volumes: {
		click: 0.5,
		notification: 0.5,
		watchlist: 0.5,
		alert: 0.5,
		whoosh: 0.5,
		warn: 0.5,
		rollback: 0.5,
		report: 0.5,
		thank: 0.5,
		protection: 0.5,
		block: 0.5,
		sparkle: 0.5,
		success: 0.5,
		error: 0.5
	},
	soundMappings: {
		click: 'click',
		notification: 'notify',
		watchlist: 'ping',
		alert: 'alert',
		whoosh: 'whoosh',
		warn: 'warn',
		rollback: 'rollback',
		report: 'report',
		thank: 'thank',
		protection: 'protection',
		block: 'block',
		sparkle: 'sparkle',
		success: 'success',
		error: 'error'
	},
	watchlistExpiry: "1 week",
	whitelistExpiry: {
		users: "indefinite",
		pages: "indefinite",
		tags: "indefinite",
	},
	highlightedExpiry: {
		users: "1 week",
		pages: "1 week",
		tags: "1 week",
	},
	wiki: "en",
	namespacesShown: [ 0 ],
	showTemps: true,
	showUsers: true,
	sortQueueItems: true,
	enableOllamaAI: false,
	ollamaServerUrl: "http://localhost:11434",
	ollamaModel: "",
	controlScripts: [
		{
			keys: ["arrowright"],
			actions: [
				{
					name: "nextEdit",
					params: {}
				}
			]
		},
		{
			keys: [" "],
			actions: [
				{
					name: "nextEdit",
					params: {}
				}
			]
		},
		{
			keys: ["q"],
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
						warningType: "Vandalism",
						level: "auto"
					}
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
				},
				{
					name: "highlightUser",
					params: {}
				}
			]
		},
		{
			keys: ["arrowleft"],
			actions: [
				{
					name: "prevEdit",
					params: {}
				}
			]
		},
		{
			keys: ["h"],
			actions: [
				{
					name: "openHistory",
					params: {}
				}
			]
		},
		{
			keys: ["c"],
			actions: [
				{
					name: "openUserContribs",
					params: {}
				}
			]
		},
		{
			keys: ["t"],
			actions: [
				{
					name: "thankUser",
					params: {}
				}
			]
		},
		{
			keys: ["w"],
			actions: [
				{
					name: "welcome",
					params: {
						template: "default"
					}
				}
			]
		}
	],
	selectedPalette: 0,
	theme: "theme-light"
};

export const colorPalettes = [
	["#78c675", "#fdff7a", "#fcff54", "#fbff12", "#ffc619", "#ff8812", "#f56214", "#f73214", "#fc0303", "#fc0303"],
	["#bfbfbf", "#ffd9d9", "#ffc9c9", "#ffb0b0", "#ff9797", "#ff7d7d", "#ff6464", "#ff4b4b", "#ff3131", "#ff1818"],
	["#bfbfbf", "#d9ffd9", "#c9ffc9", "#b0ffb0", "#97ff97", "#7dff7d", "#64ff64", "#4bff4b", "#31ff31", "#18ff18"],
	["#bfbfbf", "#d9d9ff", "#c9c9ff", "#b0b0ff", "#9797ff", "#7d7dff", "#6464ff", "#4b4bff", "#3131ff", "#1818ff"]
];
