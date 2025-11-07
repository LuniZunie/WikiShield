// Default settings and configurations

export const defaultSettings = {
	maxQueueSize: 50,
	maxEditCount: 50,
	minimumORESScore: 0,
	soundAlertORESScore: 0.95,
	enableSoundAlerts: false,

	enableUsernameHighlighting: true,
	enableWelcomeLatin: false,
	enableAutoWelcome: false,
	enableEditAnalysis: false,
	enableUsernameAnalysis: false,

	masterVolume: 0.5,
	volumes: {
		click: 0.5,
		notification: 0.5,
		alert: 0.5,
		whoosh: 0.5,
		warn: 0.5,
		rollback: 0.5,
		report: 0.5,
		thank: 0.5,
		protection: 0.5,
		block: 0.5,
		sparkle: 0.5
	},
	soundMappings: {
		click: 'click',
		notification: 'notify',
		alert: 'alert',
		whoosh: 'whoosh',
		warn: 'warn',
		rollback: 'rollback',
		report: 'report',
		thank: 'thank',
		protection: 'protection',
		block: 'block',
		sparkle: 'sparkle'
	},
	watchlistExpiry: "1 week",
	highlightedExpiry: "1 hour",
	wiki: "en",
	namespacesShown: [
		0, 2, 4, 6, 8, 10, 12, 14, 100, 118,
		1, 3, 5, 7, 9, 11, 13, 15, 101, 119
	],
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
					name: "rollbackAndWarn",
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
					name: "highlight",
					params: {}
				},
				{
					name: "nextEdit",
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

