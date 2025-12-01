import { namespaces } from "./namespaces.js";
import { warningsLookup } from "./warnings.js";
import { validControlKeys } from "../config/control-keys.js";
import { validEvents, validConditions } from "../config/events.js";

const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
const isURL = str => {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
};

class Logger {
    constructor() {
        this.logs = [];
    }

    getLogs() {
        return [ ...this.logs ];
    }

    #log(type, message, expected = false) {
        const timestamp = new Date().toISOString();
        this.logs.push({ type, timestamp, message, expected });
    }

    log(message, expected) {
        this.#log("log", message, expected);
    }

    warn(message, expected) {
        this.#log("warn", message, expected);
    }
    error(message, expected) {
        this.#log("error", message, expected);
    }
    dev(message, expected) {
        this.#log("dev", message, expected);
    }
}

class Version {
    static loadedLogger = new Logger();
    static loadedData = { };

    static sanitize(path, fallback, callback = null) {
        const value = path.reduce((scope, key) => (scope?.[key] !== undefined) ? scope[key] : undefined, this.loadedData);
        if (value === undefined) {
            this.loadedLogger.warn(`Missing expected key path [ ${path.join(" -> ")} ] in stored data, defaulting to fallback value.`);
            return fallback;
        }

        if (typeof callback === "function") {
            const modValue = callback(value);
            if (modValue === undefined) {
                this.loadedLogger.warn(`Invalid value at key path [ ${path.join(" -> ")} ] in stored data, defaulting to fallback value.`);
                return fallback;
            }

            return modValue;
        }

        return value;
    }

    static exists(...path) {
        const value = path.reduce((scope, key) => (scope?.[key] !== undefined) ? scope[key] : undefined, this.loadedData);
        return value !== undefined;
    }

    static deprecated(...path) {
        if (this.exists(...path)) {
            this.loadedLogger.warn(`Skipped deprecated key path [ ${path.join(" -> ")} ] in stored data.`, true);
            return true;
        }

        return false;
    }

    static reset(...path) {
        this.loadedLogger.warn(`Resetting key path [ ${path.join(" -> ")} ] in stored data to default value.`);
        const value = path.reduce((scope, key) => (scope?.[key] !== undefined) ? scope[key] : undefined, this.default);
        if (value === undefined) {
            this.loadedLogger.dev(`Could not find default value for key path [ ${path.join(" -> ")} ] in stored data.`);
            return;
        }

        const final = path.pop();
        const scope = path.reduce((scope, key) => {
            if (scope[key] === undefined) {
                scope[key] = { };
            }
            return scope[key];
        }, this.loadedData);

        scope[final] = value;
    }

    static restrictObject(obj, ...path) {
        if (!isObject(obj)) {
            this.reset(...path);
            return false;
        }

        const keys = Object.keys(path.reduce((scope, key) => (scope?.[key] !== undefined) ? scope[key] : undefined, this.default));
        Object.keys(obj).forEach(key => {
            if (!keys.includes(key)) {
                this.loadedLogger.warn(`Removing unexpected key [ ${[ ...path, key ].join(" -> ")} ] from stored data.`);
                delete obj[key]; // remove unexpected keys
            }
        });

        return true;
    }

    static number = 0;
    static get default() {
        return {
            version: 0,
            changelog: "0",

            options: {
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
                    "AI-generated": true,
                    "AI-generated (talk)": true,
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
                                    template: "Mentor"
                                }
                            }
                        ]
                    }
                ],
                selectedPalette: 0,
                theme: "theme-light"
            },
            statistics: {
                reviewed: 0,
                reverts: 0,
                reverts: 0,
                reports: 0,
                warnings: 0,
                welcomes: 0,
                whitelisted: 0,
                highlighted: 0,
                blocks: 0,
                sessionStart: Date.now()
            },
            whitelist: {
                users: [ ],
                pages: [ ],
                tags: [ ]
            },
            highlighted: {
                users: [ ],
                pages: [ ],
                tags: [ ]
            },
            queueWidth: "15vw",
            detailsWidth: "15vw"
        };
    }

    static init(logger, data) {
        this.loadedLogger = logger;
        this.loadedData = data;

        return true;
    }

    // upgrade from previous version to this version
    static upgrade() {
        if (this.loadedData.version !== this.number - 1) {
            this.loadedLogger.dev(`[INVALID_UPGRADE_ATTEMPT] Attempted to upgrade from version ${this.loadedData.version} to version ${this.number}, but this upgrade method only supports upgrades from version ${this.number - 1}.`);
            throw new Error("INVALID_UPGRADE_ATTEMPT");
        }

        return { };
    }

    static validate() {
        const root = this.loadedData;
        this.restrictObject(root, );

        if (root.version !== this.number) {
            this.loadedLogger.error(`Stored data version ${root.version} does not match expected version ${this.number}.`);
            return false;
        }

        return true;
    }
}
class Version1 extends Version {
    static number = 1;
    static get default() {
        return {
            version: 1,
            changelog: "3",

            settings: {
                theme: { // TODO move theme to root.layout, then move root.layout to root.UI
                    palette: 0,
                },

                namespaces: [ 0 ],

                queue: {
                    max_size: 100,
                    max_edits: 50,
                    min_ores: 0.0
                },

                cloud_storage: {
                    enabled: true,
                },

                username_highlighting: {
                    enabled: true,
                },

                auto_welcome: {
                    enabled: true,
                },

                expiry: {
                    watchlist: "1 week",

                    whitelist: {
                        users: "indefinite",
                        pages: "indefinite",
                        tags: "indefinite",
                    },
                    highlight: {
                        users: "1 week",
                        pages: "1 week",
                        tags: "1 week",
                    },
                },

                auto_report: {
                    enabled: true,

                    for: [
                        "Vandalism", "Subtle vandalism", "Image vandalism", "Sandbox",

                        "Unsourced", "Unsourced (BLP)", "Unsourced genre", /* "POV", */ "Commentary",
                        "AI-generated", "AI-generated (talk)", /* "MOS violation", */ "Censoring",

                        "Disruption", "Deleting", "Errors", "Editing tests", /* "Chatting", */
                        "Jokes", /* "Owning", */

                        "Advertising", "Spam links",

                        "Personal attacks", "TPO", "AfD removal",
                    ], // imported as array, stored as Set
                },

                AI: {
                    enabled: false,
                    provider: "Ollama",

                    edit_analysis: {
                        enabled: true,
                    },
                    username_analysis: {
                        enabled: true,
                    },

                    Ollama: {
                        "server": "http://localhost:11434",
                        "model": "",
                    }
                },

                audio: {
                    ores_alert: {
                        enabled: true,
                        threshold: 0.95
                    },

                    volume: {
                        "master": 1,
                        "master.startup": 1,

                        "master.music": 1,
                        "master.music.zen_mode": 1,

                        "master.ui": 1,
                        "master.ui.click": 1,
                        "master.ui.select": 1,
                        "master.ui.on": 1,
                        "master.ui.off": 1,

                        "master.queue": 1,
                        "master.queue.ores": 1,
                        "master.queue.mention": 1,
                        "master.queue.recent": 0,
                        "master.queue.flagged": 0,
                        "master.queue.watchlist": 0,

                        "master.notification": 1,
                        "master.notification.alert": 1,
                        "master.notification.notice": 1,

                        "master.action": 1,
                        "master.action.default": 1,
                        "master.action.failed": 1,
                        "master.action.report": 1,
                        "master.action.block": 1,
                        "master.action.protect": 1,

                        "master.other": 1,
                        "master.other.success": 1,
                        "master.other.error": 1
                    }
                },

                zen_mode: {
                    enabled: false,

                    sound: {
                        enabled: true,
                    },
                    music: {
                        enabled: true,
                    },

                    alerts: {
                        enabled: true,
                    },
                    notices: {
                        enabled: false,
                    },
                    watchlist: {
                        enabled: false,
                    },

                    edit_counter: {
                        enabled: false,
                    },
                    toasts: {
                        enabled: false,
                    },
                }
            },
            layout: {
                queue: {
                    width: "15vw",
                },
                details: {
                    width: "15vw",
                }
            },
            control_scripts: [
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
                                template: "Auto"
                            }
                        }
                    ]
                }
            ],
            statistics: {
                edits_reviewed: {
                    total: 0,

                    thanked: 0,
                },

                recent_changes_reviewed: {
                    total: 0,
                },
                pending_changes_reviewed: {
                    total: 0,

                    accepted: 0,
                    rejected: 0,
                },
                watchlist_changes_reviewed: {
                    total: 0,
                },

                reverts_made: {
                    total: 0,
                    good_faith: 0,

                    from_recent_changes: 0,
                    from_pending_changes: 0,
                    from_watchlist: 0,
                    from_loaded_edits: 0,
                },

                users_welcomed: {
                    total: 0,
                },

                warnings_issued: {
                    total: 0,

                    level_1: 0,
                    level_2: 0,
                    level_3: 0,
                    level_4: 0,
                    level_4im: 0,
                },
                reports_filed: {
                    total: 0,

                    AIV: 0,
                    UAA: 0,
                    RFPP: 0,
                },

                items_whitelisted: {
                    total: 0,

                    users: 0,
                    pages: 0,
                    tags: 0,
                },
                items_highlighted: {
                    total: 0,

                    users: 0,
                    pages: 0,
                    tags: 0,
                },

                blocks_issued: {
                    total: 0,
                },
                pages_protected: {
                    total: 0,
                },

                actions_executed: {
                    total: 0,

                    successful: 0
                },

                session_time: 0 // in milliseconds
            },
            highlight: {
                users: [ ], // imported as array, stored as Map
                pages: [ ], // imported as array, stored as Map
                tags: [ ], // imported as array, stored as Map
            },
            whitelist: {
                users: [ ], // imported as array, stored as Map
                pages: [ ], // imported as array, stored as Map
                tags: [ ], // imported as array, stored as Map
            }
        };
    }

    static upgrade() {
        if (this.loadedData.version !== this.number - 1) {
            this.loadedLogger.dev(`[INVALID_UPGRADE_ATTEMPT] Attempted to upgrade from version ${this.loadedData.version} to version ${this.number}, but this upgrade method only supports upgrades from version ${this.number - 1}.`);
            throw new Error("INVALID_UPGRADE_ATTEMPT");
        }

        this.deprecated("options", "enableWelcomeLatin");

        this.deprecated("options", "volumes", "whoosh");
        this.deprecated("options", "volumes", "warn");
        this.deprecated("options", "volumes", "rollback");
        this.deprecated("options", "volumes", "thank");
        this.deprecated("options", "volumes", "sparkle");

        this.deprecated("options", "soundMappings");

        this.deprecated("options", "wiki");

        this.deprecated("options", "showTemps");
        this.deprecated("options", "showUsers");

        this.deprecated("options", "sortQueueItems");

        this.deprecated("options", "theme");

        const defaults = this.default;
        return {
            changelog: this.sanitize([ "changelog" ], defaults.changelog),

            settings: {
                theme: {
                    palette: this.sanitize([ "options", "selectedPalette" ], defaults.settings.theme.palette),
                },

                namespaces: this.sanitize([ "options", "namespacesShown" ], defaults.settings.namespaces),

                queue: {
                    max_size: this.sanitize([ "options", "maxQueueSize" ], defaults.settings.queue.max_size),
                    max_edits: this.sanitize([ "options", "maxEditCount" ], defaults.settings.queue.max_edits),
                    min_ores: this.sanitize([ "options", "minimumORESScore" ], defaults.settings.queue.min_ores)
                },

                cloud_storage: {
                    enabled: this.sanitize([ "options", "enableCloudStorage" ], defaults.settings.cloud_storage.enabled),
                },

                username_highlighting: {
                    enabled: this.sanitize([ "options", "enableUsernameHighlighting" ], defaults.settings.username_highlighting.enabled),
                },

                auto_welcome: {
                    enabled: this.sanitize([ "options", "enableAutoWelcome" ], defaults.settings.auto_welcome.enabled),
                },

                expiry: {
                    watchlist: this.sanitize([ "options", "watchlistExpiry" ], defaults.settings.expiry.watchlist),

                    whitelist: {
                        users: this.sanitize([ "options", "whitelistExpiry", "users" ], defaults.settings.expiry.whitelist.users),
                        pages: this.sanitize([ "options", "whitelistExpiry", "pages" ], defaults.settings.expiry.whitelist.pages),
                        tags: this.sanitize([ "options", "whitelistExpiry", "tags" ], defaults.settings.expiry.whitelist.tags),
                    },
                    highlight: {
                        users: this.sanitize([ "options", "highlightedExpiry", "users" ], defaults.settings.expiry.highlight.users),
                        pages: this.sanitize([ "options", "highlightedExpiry", "pages" ], defaults.settings.expiry.highlight.pages),
                        tags: this.sanitize([ "options", "highlightedExpiry", "tags" ], defaults.settings.expiry.highlight.tags),
                    },
                },

                auto_report: {
                    enabled: this.sanitize([ "options", "enableAutoReporting" ], defaults.settings.auto_report.enabled),

                    for: this.sanitize([ "options", "selectedAutoReportReasons" ], defaults.settings.auto_report.for, (value) => {
                        if (isObject(value)) {
                            value["AI-generated"] = value["AI-Generated"];
                            delete value["AI-Generated"];

                            value["AI-generated (talk)"] = value["AI-Generated (talk)"];
                            delete value["AI-Generated (talk)"];

                            return Object.keys(value).filter(key => value?.[key] === true);
                        }

                        return undefined;
                    }),
                },

                AI: {
                    enabled: this.sanitize([ "options", "enableOllamaAI" ], defaults.settings.AI.enabled),
                    provider: defaults.settings.AI.provider, // did not exist in v0

                    edit_analysis: {
                        enabled: this.sanitize([ "options", "enableEditAnalysis" ], defaults.settings.AI.edit_analysis.enabled),
                    },
                    username_analysis: {
                        enabled: this.sanitize([ "options", "enableUsernameAnalysis" ], defaults.settings.AI.username_analysis.enabled),
                    },

                    Ollama: {
                        "server": this.sanitize([ "options", "ollamaServerUrl" ], defaults.settings.AI.Ollama.server),
                        "model": this.sanitize([ "options", "ollamaModel" ], defaults.settings.AI.Ollama.model),
                    }
                },

                audio: {
                    ores_alert: {
                        enabled: this.sanitize([ "options", "enableSoundAlerts" ], defaults.settings.audio.ores_alert.enabled),
                        threshold: this.sanitize([ "options", "soundAlertORESScore" ], defaults.settings.audio.ores_alert.threshold)
                    },

                    volume: {
                        "master": this.sanitize([ "options", "masterVolume" ], defaults.settings.audio.volume.master),
                        "master.startup": defaults.settings.audio.volume["master.startup"], // did not exist in v0

                        "master.music": defaults.settings.audio.volume["master.music"], // did not exist in v0
                        "master.music.zen_mode": defaults.settings.audio.volume["master.music.zen_mode"], // did not exist in v0

                        "master.ui": defaults.settings.audio.volume["master.ui"], // did not exist in v0
                        "master.ui.click": this.sanitize([ "options", "volumes", "click" ], defaults.settings.audio.volume["master.ui.click"]),
                        "master.ui.select": defaults.settings.audio.volume["master.ui.select"], // did not exist in v0
                        "master.ui.on": defaults.settings.audio.volume["master.ui.on"], // did not exist in v0
                        "master.ui.off": defaults.settings.audio.volume["master.ui.off"], // did not exist in v0

                        "master.queue": defaults.settings.audio.volume["master.queue"], // did not exist in v0
                        "master.queue.ores": this.sanitize([ "options", "volumes", "alert" ], defaults.settings.audio.volume["master.queue.ores"]),
                        "master.queue.mention": defaults.settings.audio.volume["master.queue.mention"], // did not exist in v0
                        "master.queue.recent": defaults.settings.audio.volume["master.queue.recent"], // did not exist in v0
                        "master.queue.flagged": defaults.settings.audio.volume["master.queue.flagged"], // did not exist in v0
                        "master.queue.watchlist": this.sanitize([ "options", "volumes", "watchlist" ], defaults.settings.audio.volume["master.queue.watchlist"]),

                        "master.notification": defaults.settings.audio.volume["master.notification"], // did not exist in v0
                        "master.notification.alert": this.sanitize([ "options", "volumes", "notification" ], defaults.settings.audio.volume["master.notification.alert"]),
                        "master.notification.notice": this.sanitize([ "options", "volumes", "notification" ], defaults.settings.audio.volume["master.notification.notice"]),

                        "master.action": defaults.settings.audio.volume["master.action"], // did not exist in v0
                        "master.action.default": defaults.settings.audio.volume["master.action.default"], // did not exist in v0
                        "master.action.failed": defaults.settings.audio.volume["master.action.failed"], // did not exist in v0
                        "master.action.report": this.sanitize([ "options", "volumes", "report" ], defaults.settings.audio.volume["master.action.report"]),
                        "master.action.block": this.sanitize([ "options", "volumes", "block" ], defaults.settings.audio.volume["master.action.block"]),
                        "master.action.protect": this.sanitize([ "options", "volumes", "protection" ], defaults.settings.audio.volume["master.action.protect"]),

                        "master.other": defaults.settings.audio.volume["master.other"], // did not exist in v0
                        "master.other.success": this.sanitize([ "options", "volumes", "success" ], defaults.settings.audio.volume["master.other.success"]),
                        "master.other.error": this.sanitize([ "options", "volumes", "error" ], defaults.settings.audio.volume["master.other.error"])
                    },
                },

                zen_mode: {
                    enabled: this.sanitize([ "options", "zen", "enabled" ], defaults.settings.zen_mode.enabled),

                    sound: {
                        enabled: this.sanitize([ "options", "zen", "sounds" ], defaults.settings.zen_mode.sound.enabled),
                    },
                    music: {
                        enabled: defaults.settings.zen_mode.music.enabled, // did not exist in v0
                    },

                    alerts: {
                        enabled: this.sanitize([ "options", "zen", "notifications" ], defaults.settings.zen_mode.alerts.enabled),
                    },
                    notices: {
                        enabled: this.sanitize([ "options", "zen", "notifications" ], defaults.settings.zen_mode.notices.enabled),
                    },
                    watchlist: {
                        enabled: this.sanitize([ "options", "zen", "watchlist" ], defaults.settings.zen_mode.watchlist.enabled),
                    },

                    edit_counter: {
                        enabled: this.sanitize([ "options", "zen", "editCount" ], defaults.settings.zen_mode.edit_counter.enabled),
                    },
                    toasts: {
                        enabled: this.sanitize([ "options", "zen", "toasts" ], defaults.settings.zen_mode.toasts.enabled),
                    },
                }
            },
            layout: {
                queue: {
                    width: this.sanitize([ "queueWidth" ], defaults.layout.queue.width),
                },
                details: {
                    width: this.sanitize([ "detailsWidth" ], defaults.layout.details.width),
                }
            },
            control_scripts: this.sanitize([ "options", "controlScripts" ], defaults.control_scripts, (value) => {
                if (Array.isArray(value)) {
                    function updateActions(actions, ...path) {
                        return actions.filter((action, index) => {
                            index = +index;

                            if (!isObject(action)) {
                                return true; // malformed but don't care here
                            }

                            if (action.name === "if") {
                                if (!(action.condition in validConditions)) {
                                    return true; // malformed but don't care here
                                }

                                if (!Array.isArray(action.actions)) {
                                    return true; // malformed but don't care here
                                }

                                action.actions = updateActions.call(this, action.actions, ...path, index, "actions");
                            } else {
                                switch (action.name) {
                                    case "welcome": {
                                        if (!isObject(action.params)) {
                                            return true; // malformed but don't care here
                                        }

                                        switch (action.params.template) {
                                            case "Links": {
                                                action.params.template = "Graphical";
                                            } break;
                                            case "Latin": {
                                                action.params.template = "Non-Latin";
                                            } break;
                                            case "Mentor": { // deprecated =(
                                                this.loadedLogger.warn(`Skipped deprecated "Mentor" welcome template at key [${[...path, index, "params", "template"].join(" -> ")}].`, true);
                                                return false;
                                            } break;
                                        }
                                    } break;
                                    case "warn": {
                                        if (!isObject(action.params)) {
                                            return true; // malformed but don't care here
                                        }

                                        switch (action.params.warningType) {
                                            case "AI-Generated": {
                                                action.params.warningType = "AI-generated";
                                            } break;
                                            case "AI-Generated (talk)": {
                                                action.params.warningType = "AI-generated (talk)";
                                            } break;
                                        }
                                    } break;
                                }
                            }

                            return true;
                        });
                    }

                    value.forEach((scope2, index) => {
                        index = +index;
                        if (!isObject(scope2)) {
                            return;
                        }

                        if (!Array.isArray(scope2.keys)) {
                            return;
                        }

                        if (!Array.isArray(scope2.actions)) {
                            return;
                        }

                        scope2.actions = updateActions.call(this, scope2.actions, "control_scripts", index, "actions");
                    });

                    return value;
                }

                return undefined;
            }),
            statistics: {
                edits_reviewed: {
                    total: this.sanitize([ "statistics", "reviewed" ], defaults.statistics.edits_reviewed.total),

                    thanked: defaults.statistics.edits_reviewed.thanked, // did not exist in v0
                },
                recent_changes_reviewed: {
                    total: this.sanitize([ "statistics", "reviewed" ], defaults.statistics.recent_changes_reviewed.total),
                },
                pending_changes_reviewed: {
                    total: defaults.statistics.pending_changes_reviewed.total, // did not exist in v0

                    accepted: defaults.statistics.pending_changes_reviewed.accepted, // did not exist in v0
                    rejected: defaults.statistics.pending_changes_reviewed.rejected, // did not exist in v0
                },
                watchlist_changes_reviewed: {
                    total: defaults.statistics.watchlist_changes_reviewed.total, // did not exist in v0
                },
                reverts_made: {
                    total: this.sanitize([ "statistics", "reverts" ], defaults.statistics.reverts_made.total),
                    good_faith: defaults.statistics.reverts_made.good_faith, // did not exist in v0

                    from_recent_changes: this.sanitize([ "statistics", "reverts" ], defaults.statistics.reverts_made.total),
                    from_pending_changes: defaults.statistics.reverts_made.from_pending_changes, // did not exist in v0
                    from_watchlist: defaults.statistics.reverts_made.from_watchlist, // did not exist in v0
                    from_loaded_edits: defaults.statistics.reverts_made.from_loaded_edits, // did not exist in v0
                },
                users_welcomed: {
                    total: this.sanitize([ "statistics", "welcomes" ], defaults.statistics.users_welcomed.total),
                },
                warnings_issued: {
                    total: this.sanitize([ "statistics", "warnings" ], defaults.statistics.warnings_issued.total),

                    level_1: defaults.statistics.warnings_issued.level_1, // did not exist in v0
                    level_2: defaults.statistics.warnings_issued.level_2, // did not exist in v0
                    level_3: defaults.statistics.warnings_issued.level_3, // did not exist in v0
                    level_4: defaults.statistics.warnings_issued.level_4, // did not exist in v0
                    level_4im: defaults.statistics.warnings_issued.level_4im, // did not exist in v0
                },
                reports_filed: {
                    total: this.sanitize([ "statistics", "reports" ], defaults.statistics.reports_filed.total),

                    AIV: this.sanitize([ "statistics", "reports" ], defaults.statistics.reports_filed.total),
                    UAA: defaults.statistics.reports_filed.UAA, // did not exist in v0
                    RFPP: defaults.statistics.reports_filed.RFPP // did not exist in v0
                },
                items_whitelisted: {
                    total: this.sanitize([ "statistics", "whitelisted" ], defaults.statistics.items_whitelisted.total),

                    users: this.sanitize([ "statistics", "whitelisted" ], defaults.statistics.items_whitelisted.users),
                    pages: defaults.statistics.items_whitelisted.pages, // did not exist in v0
                    tags: defaults.statistics.items_whitelisted.tags, // did not exist in v0
                },
                items_highlighted: {
                    total: this.sanitize([ "statistics", "highlighted" ], defaults.statistics.items_highlighted.total),

                    users: this.sanitize([ "statistics", "highlighted", ], defaults.statistics.items_highlighted.users),
                    pages: defaults.statistics.items_highlighted.pages, // did not exist in v0
                    tags: defaults.statistics.items_highlighted.tags, // did not exist in v0
                },

                blocks_issued: {
                    total: this.sanitize([ "statistics", "blocks" ], defaults.statistics.blocks_issued.total),
                },
                pages_protected: {
                    total: defaults.statistics.pages_protected.total, // did not exist in v0
                },

                actions_executed: {
                    total: defaults.statistics.actions_executed.total, // did not exist in v0

                    successful: defaults.statistics.actions_executed.successful, // did not exist in v0
                },

                session_time: defaults.statistics.session_time, // was not stored properly in v0
            },
            highlight: {
                users: this.sanitize([ "highlighted", "users" ], defaults.highlight.users),
                pages: this.sanitize([ "highlighted", "pages" ], defaults.highlight.pages),
                tags: this.sanitize([ "highlighted", "tags" ], defaults.highlight.tags),
            },
            whitelist: {
                users: this.sanitize([ "whitelist", "users" ], defaults.whitelist.users),
                pages: this.sanitize([ "whitelist", "pages" ], defaults.whitelist.pages),
                tags: this.sanitize([ "whitelist", "tags" ], defaults.whitelist.tags),
            }
        };
    }

    static validate() {
        const root = this.loadedData;
        this.restrictObject(root, );

        if (root.version !== this.number) {
            this.loadedLogger.error(`Stored data version ${root.version} does not match expected version ${this.number}.`);
            return false;
        }

        if (typeof root.changelog !== "string") {
            this.reset("changelog");
        }

        { // root.settings
            const scope1 = root.settings;
            this.restrictObject(scope1, "settings");

            { // root.settings.theme
                const scope2 = scope1.theme;
                this.restrictObject(scope2, "settings", "theme");

                { // root.settings.theme.palette
                    const value = scope2.palette;
                    if (!(typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3)) {
                        this.reset("settings", "theme", "palette");
                    }
                }
            }

            { // root.settings.namespaces
                const value = scope1.namespaces;
                if (!Array.isArray(value)) {
                    this.reset("settings", "namespaces");
                }

                scope1.namespaces = [ ...new Set(value) ].filter(v => {
                    const valid = namespaces.some(ns => ns.id === v);
                    if (!valid) {
                        this.loadedLogger.warn(`Removing invalid namespace ID [ ${v} ] from stored data.`);
                    }

                    return valid;
                });
            }

            { // root.settings.queue
                const scope2 = scope1.queue;
                this.restrictObject(scope2, "settings", "queue");

                { // root.settings.queue.max_size
                    const value = scope2.max_size;
                    if (!(typeof value === "number" && Number.isInteger(value) && value > 0)) {
                        this.reset("settings", "queue", "max_size");
                    }
                }

                { // root.settings.queue.max_edits
                    const value = scope2.max_edits;
                    if (!(typeof value === "number" && Number.isInteger(value) && value > 0)) {
                        this.reset("settings", "queue", "max_edits");
                    }
                }

                { // root.settings.queue.min_ores
                    const value = scope2.min_ores;
                    if (!(typeof value === "number" && value >= 0.0 && value <= 1.0)) {
                        this.reset("settings", "queue", "min_ores");
                    }
                }
            }

            { // root.settings.cloud_storage
                const scope2 = scope1.cloud_storage;
                this.restrictObject(scope2, "settings", "cloud_storage");

                { // root.settings.cloud_storage.enabled
                    const value = scope2.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "cloud_storage", "enabled");
                    }
                }
            }

            { // root.settings.username_highlighting
                const scope2 = scope1.username_highlighting;
                this.restrictObject(scope2, "settings", "username_highlighting");

                { // root.settings.username_highlighting.enabled
                    const value = scope2.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "username_highlighting", "enabled");
                    }
                }
            }

            { // root.settings.auto_welcome
                const scope2 = scope1.auto_welcome;
                this.restrictObject(scope2, "settings", "auto_welcome");

                { // root.settings.auto_welcome.enabled
                    const value = scope2.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "auto_welcome", "enabled");
                    }
                }
            }

            { // root.settings.expiry
                const expiries = new Set([ "none", "1 hour", "1 day", "1 week", "1 month", "3 months", "6 months", "indefinite" ]);

                const scope2 = scope1.expiry;
                this.restrictObject(scope2, "settings", "expiry");

                { // root.settings.expiry.watchlist
                    const value = scope2.watchlist;
                    if (!expiries.has(value)) {
                        this.reset("settings", "expiry", "watchlist");
                    }
                }

                { // root.settings.expiry.whitelist
                    const scope3 = scope2.whitelist;
                    this.restrictObject(scope3, "settings", "expiry", "whitelist");

                    { // root.settings.expiry.whitelist.users
                        const value = scope3.users;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "whitelist", "users");
                        }
                    }

                    { // root.settings.expiry.whitelist.pages
                        const value = scope3.pages;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "whitelist", "pages");
                        }
                    }

                    { // root.settings.expiry.whitelist.tags
                        const value = scope3.tags;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "whitelist", "tags");
                        }
                    }
                }

                { // root.settings.expiry.highlight
                    const scope3 = scope2.highlight;
                    this.restrictObject(scope3, "settings", "expiry", "highlight");

                    { // root.settings.expiry.highlight.users
                        const value = scope3.users;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "highlight", "users");
                        }
                    }

                    { // root.settings.expiry.highlight.pages
                        const value = scope3.pages;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "highlight", "pages");
                        }
                    }

                    { // root.settings.expiry.highlight.tags
                        const value = scope3.tags;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "highlight", "tags");
                        }
                    }
                }
            }

            { // root.settings.auto_report
                const scope2 = scope1.auto_report;
                this.restrictObject(scope2, "settings", "auto_report");

                { // root.settings.auto_report.enabled
                    const value = scope2.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "auto_report", "enabled");
                    }
                }

                { // root.settings.auto_report.for
                    const value = scope2.for;
                    if (!Array.isArray(value)) {
                        this.reset("settings", "auto_report", "for");
                    }

                    scope2.for = [ ...new Set(scope2.for) ].filter(v => {
                        const valid = v in warningsLookup;
                        if (!valid) {
                            this.loadedLogger.warn(`Removing invalid auto-report reason [ ${v} ] from stored data.`);
                        }

                        return valid;
                    });
                }
            }

            { // root.settings.AI
                const scope2 = scope1.AI;
                this.restrictObject(scope2, "settings", "AI");

                { // root.settings.AI.enabled
                    const value = scope2.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "AI", "enabled");
                    }
                }

                { // root.settings.AI.provider
                    const value = scope2.provider;
                    if (value !== "Ollama") {
                        this.reset("settings", "AI", "provider");
                    }
                }

                { // root.settings.AI.edit_analysis
                    const scope3 = scope2.edit_analysis;
                    this.restrictObject(scope3, "settings", "AI", "edit_analysis");

                    { // root.settings.AI.edit_analysis.enabled
                        const value = scope3.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "AI", "edit_analysis", "enabled");
                        }
                    }
                }

                { // root.settings.AI.username_analysis
                    const scope3 = scope2.username_analysis;
                    this.restrictObject(scope3, "settings", "AI", "username_analysis");
                    { // root.settings.AI.username_analysis.enabled
                        const value = scope3.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "AI", "username_analysis", "enabled");
                        }
                    }
                }

                { // root.settings.AI.Ollama
                    const scope3 = scope2.Ollama;
                    this.restrictObject(scope3, "settings", "AI", "Ollama");

                    { // root.settings.AI.Ollama.server
                        const value = scope3.server;
                        if (!isURL(value)) {
                            this.reset("settings", "AI", "Ollama", "server");
                        }
                    }

                    { // root.settings.AI.Ollama.model
                        const value = scope3.model;
                        if (typeof value !== "string") {
                            this.reset("settings", "AI", "Ollama", "model");
                        }
                    }
                }
            }

            { // root.settings.audio
                const scope2 = scope1.audio;
                this.restrictObject(scope2, "settings", "audio");

                { // root.settings.audio.ores_alert
                    const scope3 = scope2.ores_alert;
                    this.restrictObject(scope3, "settings", "audio", "ores_alert");

                    { // root.settings.audio.ores_alert.enabled
                        const value = scope3.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "audio", "ores_alert", "enabled");
                        }
                    }

                    { // root.settings.audio.ores_alert.threshold
                        const value = scope3.threshold;
                        if (!(typeof value === "number" && value >= 0.0 && value <= 1.0)) {
                            this.reset("settings", "audio", "ores_alert", "threshold");
                        }
                    }
                }

                { // root.settings.audio.volume
                    const scope3 = scope2.volume;
                    this.restrictObject(scope3, "settings", "audio", "volume");
                    const volumeKeys = [
                        "master",
                        "master.startup",

                        "master.music",
                        "master.music.zen_mode",

                        "master.ui",
                        "master.ui.click",
                        "master.ui.select",
                        "master.ui.on",
                        "master.ui.off",

                        "master.queue",
                        "master.queue.ores",
                        "master.queue.mention",
                        "master.queue.recent",
                        "master.queue.flagged",
                        "master.queue.watchlist",

                        "master.notification",
                        "master.notification.alert",
                        "master.notification.notice",

                        "master.action",
                        "master.action.default",
                        "master.action.failed",
                        "master.action.report",
                        "master.action.block",
                        "master.action.protect",

                        "master.other",
                        "master.other.success",
                        "master.other.error"
                    ];

                    for (const key of volumeKeys) {
                        const value = scope3[key];
                        if (!(typeof value === "number" && value >= 0 && value <= 1)) {
                            this.reset("settings", "audio", "volume", key);
                        }
                    }
                }
            }

            { // root.settings.zen_mode
                const scope2 = scope1.zen_mode;
                this.restrictObject(scope2, "settings", "zen_mode");

                { // root.settings.zen_mode.enabled
                    const value = scope2.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "zen_mode", "enabled");
                    }
                }

                { // root.settings.zen_mode.sound
                    const scope3 = scope2.sound;
                    this.restrictObject(scope3, "settings", "zen_mode", "sound");

                    { // root.settings.zen_mode.sound.enabled
                        const value = scope3.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "sound", "enabled");
                        }
                    }
                }

                { // root.settings.zen_mode.music
                    const scope3 = scope2.music;
                    this.restrictObject(scope3, "settings", "zen_mode", "music");

                    { // root.settings.zen_mode.music.enabled
                        const value = scope3.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "music", "enabled");
                        }
                    }
                }

                { // root.settings.zen_mode.alerts
                    const scope3 = scope2.alerts;
                    this.restrictObject(scope3, "settings", "zen_mode", "alerts");

                    { // root.settings.zen_mode.alerts.enabled
                        const value = scope3.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "alerts", "enabled");
                        }
                    }
                }

                { // root.settings.zen_mode.notices
                    const scope3 = scope2.notices;
                    this.restrictObject(scope3, "settings", "zen_mode", "notices");

                    { // root.settings.zen_mode.notices.enabled
                        const value = scope3.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "notices", "enabled");
                        }
                    }
                }

                { // root.settings.zen_mode.watchlist
                    const scope3 = scope2.watchlist;
                    this.restrictObject(scope3, "settings", "zen_mode", "watchlist");
                    { // root.settings.zen_mode.watchlist.enabled
                        const value = scope3.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "watchlist", "enabled");
                        }
                    }
                }

                { // root.settings.zen_mode.edit_counter
                    const scope3 = scope2.edit_counter;
                    this.restrictObject(scope3, "settings", "zen_mode", "edit_counter");
                    { // root.settings.zen_mode.edit_counter.enabled
                        const value = scope3.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "edit_counter", "enabled");
                        }
                    }
                }

                { // root.settings.zen_mode.toasts
                    const scope3 = scope2.toasts;
                    this.restrictObject(scope3, "settings", "zen_mode", "toasts");
                    { // root.settings.zen_mode.toasts.enabled
                        const value = scope3.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "toasts", "enabled");
                        }
                    }
                }
            }
        }

        { // root.layout
            const scope1 = root.layout;
            this.restrictObject(scope1, "layout");

            { // root.layout.queue
                const scope2 = scope1.queue;
                this.restrictObject(scope2, "layout", "queue");

                { // root.layout.queue.width
                    const value = scope2.width;
                    if (!(typeof value === "string" && value.endsWith("vw"))) {
                        this.reset("layout", "queue", "width");
                    }

                    const numericPart = parseFloat(value.slice(0, -2));
                    if (!(typeof numericPart === "number" && !isNaN(numericPart) && numericPart >= 10 && numericPart <= 30)) {
                        this.reset("layout", "queue", "width");
                    }
                }
            }

            { // root.layout.details
                const scope2 = scope1.details;
                this.restrictObject(scope2, "layout", "details");

                { // root.layout.details.width
                    const value = scope2.width;
                    if (!(typeof value === "string" && value.endsWith("vw"))) {
                        this.reset("layout", "details", "width");
                    }

                    const numericPart = parseFloat(value.slice(0, -2));
                    if (!(typeof numericPart === "number" && !isNaN(numericPart) && numericPart >= 10 && numericPart <= 30)) {
                        this.reset("layout", "details", "width");
                    }
                }
            }
        }

        { // root.control_scripts
            const scope1 = root.control_scripts;
            if (!Array.isArray(scope1)) {
                this.reset("control_scripts");
            }

            function sanitizeActions(actions, ...path) {
                return actions.filter((action, index) => {
                    index = +index;

                    if (!isObject(action)) {
                        this.loadedLogger.warn(`Removing invalid action at path [ ${[ ...path, index ].join(" -> ")} ] from stored data.`);
                        return false;
                    }

                    if (action.name === "if") {
                        if (!(action.condition in validConditions)) {
                            this.loadedLogger.warn(`Removing invalid condition [ ${action.condition} ] at path [ ${[ ...path, index, "condition" ].join(" -> ")} ] from stored data.`);
                            return false;
                        }

                        if (!Array.isArray(action.actions)) {
                            this.loadedLogger.warn(`Resetting invalid actions array at path [ ${[ ...path, index, "actions" ].join(" -> ")} ] in stored data.`);
                            action.actions = [ ];
                        }

                        action.actions = sanitizeActions.call(this, action.actions, ...path, index, "actions");
                    } else {
                        if (!(action.name in validEvents)) {
                            this.loadedLogger.warn(`Removing invalid action at path [ ${[ ...path, index, "name" ].join(" -> ")} ] from stored data.`);
                            return false;
                        }

                        if (!isObject(action.params)) {
                            this.loadedLogger.warn(`Resetting invalid params object at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                            action.params = { };
                        }

                        const references = validEvents[action.name].parameters ?? [ ];
                        const validIds = new Set();
                        for (const reference of references) {
                            validIds.add(reference.id);
                            if (reference.type === "choice") {
                                if (!(reference.id in action.params)) {
                                    this.loadedLogger.warn(`Resetting missing choice parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                    action.params[reference.id] = reference.options[0];
                                }

                                if (!reference.options.includes(action.params[reference.id])) {
                                    this.loadedLogger.warn(`Resetting invalid choice parameter [ ${reference.id} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] in stored data.`);
                                    action.params[reference.id] = reference.options[0];
                                }
                            }
                        }

                        for (const paramKey of Object.keys(action.params)) {
                            if (!validIds.has(paramKey)) {
                                this.loadedLogger.warn(`Removing invalid parameter [ ${paramKey} ] at path [ ${[ ...path, index, "params" ].join(" -> ")} ] from stored data.`);
                                delete action.params[paramKey];
                            }
                        }
                    }

                    return true;
                });
            }

            root.control_scripts = root.control_scripts.filter((scope2, index) => {
                index = +index;
                if (!isObject(scope2)) {
                    this.loadedLogger.warn(`Removing invalid control script at path [ ${[ "control_scripts", index ].join(" -> ")} ] from stored data.`);
                    return false;
                }

                if (!Array.isArray(scope2.keys)) {
                    this.loadedLogger.warn(`Removing invalid keys array from control script at index [ ${index} ] in stored data.`);
                    root.control_scripts[index].keys = [ ];
                }

                if (!Array.isArray(scope2.actions)) {
                    this.loadedLogger.warn(`Removing invalid actions array from control script at index [ ${index} ] in stored data.`);
                    root.control_scripts[index].actions = [ ];
                }

                root.control_scripts[index].keys = scope2.keys.filter((key) => validControlKeys.has(key));
                root.control_scripts[index].actions = sanitizeActions.call(this, scope2.actions, "control_scripts", index, "actions");

                return true;
            });
        }

        { // root.statistics
            const isValidStatistic = v => typeof v === "number" && Number.isInteger(v) && v >= 0;

            const scope1 = root.statistics;
            this.restrictObject(scope1, "statistics");

            { // root.statistics.edits_reviewed
                const scope2 = scope1.edits_reviewed;
                this.restrictObject(scope2, "statistics", "edits_reviewed");

                { // root.statistics.edits_reviewed.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "edits_reviewed", "total");
                    }
                }

                { // root.statistics.edits_reviewed.thanked
                    const value = scope2.thanked;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "edits_reviewed", "thanked");
                    }
                }
            }

            { // root.statistics.recent_changes_reviewed
                const scope2 = scope1.recent_changes_reviewed;
                this.restrictObject(scope2, "statistics", "recent_changes_reviewed");

                { // root.statistics.recent_changes_reviewed.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "recent_changes_reviewed", "total");
                    }
                }
            }
            { // root.statistics.pending_changes_reviewed
                const scope2 = scope1.pending_changes_reviewed;
                this.restrictObject(scope2, "statistics", "pending_changes_reviewed");

                { // root.statistics.pending_changes_reviewed.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "pending_changes_reviewed", "total");
                    }
                }

                { // root.statistics.pending_changes_reviewed.accepted
                    const value = scope2.accepted;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "pending_changes_reviewed", "accepted");
                    }
                }
                { // root.statistics.pending_changes_reviewed.rejected
                    const value = scope2.rejected;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "pending_changes_reviewed", "rejected");
                    }
                }
            }
            { // root.statistics.watchlist_changes_reviewed
                const scope2 = scope1.watchlist_changes_reviewed;
                this.restrictObject(scope2, "statistics", "watchlist_changes_reviewed");

                { // root.statistics.watchlist_changes_reviewed.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "watchlist_changes_reviewed", "total");
                    }
                }
            }

            { // root.statistics.reverts_made
                const scope2 = scope1.reverts_made;
                this.restrictObject(scope2, "statistics", "reverts_made");

                { // root.statistics.reverts_made.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "total");
                    }
                }
                { // root.statistics.reverts_made.good_faith
                    const value = scope2.good_faith;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "good_faith");
                    }
                }

                { // root.statistics.reverts_made.from_recent_changes
                    const value = scope2.from_recent_changes;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "from_recent_changes");
                    }
                }
                { // root.statistics.reverts_made.from_pending_changes
                    const value = scope2.from_pending_changes;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "from_pending_changes");
                    }
                }
                { // root.statistics.reverts_made.from_watchlist
                    const value = scope2.from_watchlist;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "from_watchlist");
                    }
                }
                { // root.statistics.reverts_made.from_loaded_edits
                    const value = scope2.from_loaded_edits;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "from_loaded_edits");
                    }
                }
            }

            { // root.statistics.users_welcomed
                const scope2 = scope1.users_welcomed;
                this.restrictObject(scope2, "statistics", "users_welcomed");

                { // root.statistics.users_welcomed.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "users_welcomed", "total");
                    }
                }
            }

            { // root.statistics.warnings_issued
                const scope2 = scope1.warnings_issued;
                this.restrictObject(scope2, "statistics", "warnings_issued");

                { // root.statistics.warnings_issued.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "total");
                    }
                }

                { // root.statistics.warnings_issued.level_1
                    const value = scope2.level_1;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "level_1");
                    }
                }
                { // root.statistics.warnings_issued.level_2
                    const value = scope2.level_2;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "level_2");
                    }
                }
                { // root.statistics.warnings_issued.level_3
                    const value = scope2.level_3;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "level_3");
                    }
                }
                { // root.statistics.warnings_issued.level_4
                    const value = scope2.level_4;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "level_4");
                    }
                }
                { // root.statistics.warnings_issued.level_4im
                    const value = scope2.level_4im;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "level_4im");
                    }
                }
            }

            { // root.statistics.reports_filed
                const scope2 = scope1.reports_filed;
                this.restrictObject(scope2, "statistics", "reports_filed");

                { // root.statistics.reports_filed.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reports_filed", "total");
                    }
                }

                { // root.statistics.reports_filed.AIV
                    const value = scope2.AIV;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reports_filed", "AIV");
                    }
                }
                { // root.statistics.reports_filed.UAA
                    const value = scope2.UAA;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reports_filed", "UAA");
                    }
                }
                { // root.statistics.reports_filed.RFPP
                    const value = scope2.RFPP;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reports_filed", "RFPP");
                    }
                }
            }

            { // root.statistics.items_whitelisted
                const scope2 = scope1.items_whitelisted;
                this.restrictObject(scope2, "statistics", "items_whitelisted");

                { // root.statistics.items_whitelisted.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_whitelisted", "total");
                    }
                }

                { // root.statistics.items_whitelisted.users
                    const value = scope2.users;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_whitelisted", "users");
                    }
                }
                { // root.statistics.items_whitelisted.pages
                    const value = scope2.pages;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_whitelisted", "pages");
                    }
                }
                { // root.statistics.items_whitelisted.tags
                    const value = scope2.tags;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_whitelisted", "tags");
                    }
                }
            }
            { // root.statistics.items_highlighted
                const scope2 = scope1.items_highlighted;
                this.restrictObject(scope2, "statistics", "items_highlighted");

                { // root.statistics.items_highlighted.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_highlighted", "total");
                    }
                }

                { // root.statistics.items_highlighted.users
                    const value = scope2.users;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_highlighted", "users");
                    }
                }
                { // root.statistics.items_highlighted.pages
                    const value = scope2.pages;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_highlighted", "pages");
                    }
                }
                { // root.statistics.items_highlighted.tags
                    const value = scope2.tags;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_highlighted", "tags");
                    }
                }
            }

            { // root.statistics.blocks_issued
                const scope2 = scope1.blocks_issued;
                this.restrictObject(scope2, "statistics", "blocks_issued");

                { // root.statistics.blocks_issued.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "blocks_issued", "total");
                    }
                }
            }
            { // root.statistics.pages_protected
                const scope2 = scope1.pages_protected;
                this.restrictObject(scope2, "statistics", "pages_protected");

                { // root.statistics.pages_protected.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "pages_protected", "total");
                    }
                }
            }

            { // root.statistics.actions_executed
                const scope2 = scope1.actions_executed;
                this.restrictObject(scope2, "statistics", "actions_executed");

                { // root.statistics.actions_executed.total
                    const value = scope2.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "actions_executed", "total");
                    }
                }

                { // root.statistics.actions_executed.successful
                    const value = scope2.successful;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "actions_executed", "successful");
                    }
                }
            }

            { // root.statistics.session_time
                const value = scope1.session_time;
                if (!isValidStatistic(value)) {
                    this.reset("statistics", "session_time");
                }
            }
        }

        const isValidExpiryMap = root => {
            // [ username, [ timestamp, timestamp ] ]

            if (!(Array.isArray(root) && root.length === 2)) {
                return false;
            } else if (typeof root[0] !== "string") {
                return false;
            }

            {
                const scope = root[1];
                if (!(Array.isArray(scope) && scope.length === 2)) {
                    return false;
                }

                const isTimestamp = v => typeof v === "number" && Number.isInteger(v) && v >= 0;
                if (!(isTimestamp(scope[0]) && isTimestamp(scope[1]))) {
                    return false;
                }
            }

            return true;
        }

        { // root.highlight
            const scope1 = root.highlight;
            this.restrictObject(scope1, "highlight");

            { // root.highlight.users
                const value = scope1.users;
                if (!Array.isArray(value)) {
                    this.reset("highlight", "users");
                }

                scope1.users = scope1.users.filter(v => isValidExpiryMap(v));
            }

            { // root.highlight.pages
                const value = scope1.pages;
                if (!Array.isArray(value)) {
                    this.reset("highlight", "pages");
                }

                scope1.pages = scope1.pages.filter(v => isValidExpiryMap(v));
            }

            { // root.highlight.tags
                const value = scope1.tags;
                if (!Array.isArray(value)) {
                    this.reset("highlight", "tags");
                }

                scope1.tags = scope1.tags.filter(v => isValidExpiryMap(v));
            }
        }

        { // root.whitelist
            const scope1 = root.whitelist;
            this.restrictObject(scope1, "whitelist");

            { // root.whitelist.users
                const value = scope1.users;
                if (!Array.isArray(value)) {
                    this.reset("whitelist", "users");
                }

                scope1.users = scope1.users.filter(v => isValidExpiryMap(v));
            }

            { // root.whitelist.pages
                const value = scope1.pages;
                if (!Array.isArray(value)) {
                    this.reset("whitelist", "pages");
                }

                scope1.pages = scope1.pages.filter(v => isValidExpiryMap(v));
            }

            { // root.whitelist.tags
                const value = scope1.tags;
                if (!Array.isArray(value)) {
                    this.reset("whitelist", "tags");
                }

                scope1.tags = scope1.tags.filter(v => isValidExpiryMap(v));
            }
        }

        return true;
    }

    static construct() {
        const root = this.loadedData;
        if (root?.version !== this.number) {
            this.loadedLogger.error(`Stored data version ${root?.version} does not match expected version ${this.number}.`);
            return false;
        }

        root.settings.auto_report.for = new Set(root.settings.auto_report.for);

        root.highlight.users = new Map(root.highlight.users);
        root.highlight.pages = new Map(root.highlight.pages);
        root.highlight.tags = new Map(root.highlight.tags);

        root.whitelist.users = new Map(root.whitelist.users);
        root.whitelist.pages = new Map(root.whitelist.pages);
        root.whitelist.tags = new Map(root.whitelist.tags);

        return root;
    }

    static deconstruct() {
        const root = this.loadedData;
        if (root?.version !== this.number) {
            this.loadedLogger.error(`Stored data version ${root?.version} does not match expected version ${this.number}.`);
            return false;
        }

        root.settings.auto_report.for = [ ...root.settings.auto_report.for ];

        root.highlight.users = [ ...root.highlight.users ];
        root.highlight.pages = [ ...root.highlight.pages ];
        root.highlight.tags = [ ...root.highlight.tags ];

        root.whitelist.users = [ ...root.whitelist.users ];;
        root.whitelist.pages = [ ...root.whitelist.pages ];
        root.whitelist.tags = [ ...root.whitelist.tags ];

        const data = structuredClone(root);
        this.construct(); // reconstruct to restore Maps and Sets

        return data;
    }
}

export class StorageManager {
    static version = Version1;
    static versions = new Map([
        [ 0, Version ],
        [ 1, Version1 ]
    ]);

    constructor() {
        this.reset();
    }

    reset(logger) {
        logger?.log(`Resetting storage to default.`);
        this.data = StorageManager.version.default;
        return this.data;
    }

    load(data = { }) {
        const logger = new Logger();

        let version = data.version ??= 0;
        if (StorageManager.versions.has(version)) {
            const expectedVersion = StorageManager.version.number;
            while (version !== expectedVersion) {
                const StorageClass = StorageManager.versions.get(version + 1);
                if (typeof StorageClass?.constructor === "function" && new StorageClass() instanceof Version) {
                    logger.log(`Upgrading storage from version ${version} to ${version + 1}`, true);
                    try {
                        if (!StorageClass.init(logger, data)) {
                            data = this.reset(logger);
                            break;
                        }

                        data = StorageClass.upgrade();
                        data.version = ++version; // we do this here to avoid infinite loops in case of upgrade failure
                    } catch (err) {
                        logger.error(`Error upgrading storage from version ${version} to ${version + 1}: ${err}`);
                        data = this.reset(logger);
                        break;
                    }
                } else {
                    logger.dev(`[MISSING_UPGRADE_METHOD] Uh oh! Something has gone wrong; this message should never appear. Please report this to the WikiShield developers.`);
                    data = this.reset(logger);
                    break;
                }
            }

            version = data.version;
            logger.log(`Initializing storage at version ${version}.`, true);
            StorageManager.version.init(logger, data);
            logger.log(`Validating storage at version ${version}.`, true);
            StorageManager.version.validate();
            logger.log(`Constructing storage at version ${version}.`, true);
            data = StorageManager.version.construct();

            logger.log(`Storage loaded successfully at version ${version}.`, true);
            this.data = data;
        } else {
            logger.error(`Storage version ${version} is corrupted or unsupported.`);
            this.reset(logger);
        }

        return { data: this.data, logs: logger.getLogs() };
    }

    save() {
        const logger = new Logger();

        const version = StorageManager.version.number;
        logger.log(`Initializing storage at version ${version}.`, true);
        StorageManager.version.init(logger, this.data);
        logger.log(`Deconstructing storage at version ${version}.`, true);
        const data = StorageManager.version.deconstruct();

        logger.log(`Storage saved successfully at version ${version}.`, true);
        return { data, logs: logger.getLogs() };
    }

    decode(string) {
        const json = window.atob(string);
        const data = JSON.parse(json);

        return this.load(data);
    }

    encode() {
        const { data, logs } = this.save();
        const json = JSON.stringify(data);
        const string = window.btoa(json);

        return { string, logs };
    }

    static outputLogs(logs, name = "<unknown>") { // TEMP
        const allExpected = !logs.some(log => !log.expected);

        console.groupCollapsed(`[${allExpected ? "✓" : "✗"}] WikiShield Storage Logs: ${name}`);
        for (const log of logs) {
            let prefix = `[${log.expected ? "✓" : "✗"}][${log.timestamp}][Storage]`;

            let type = log.type;
            if (type === "dev") {
                type = "error";
                prefix = `#DEV# ${prefix}`;
            }

            console[type](`${prefix} ${log.message}`);
        }
        console.groupEnd();
    }
}

// TODO, gotta test all versions properly, disable script if storage is acting up bc we don't want to corrupt data
function Test(obj = Version.default, name = "default") {
    // load from version 0 to latest
    const storage = new StorageManager();
    const logs = storage.load(obj).logs

    const allExpected = !logs.some(log => !log.expected);

    console.groupCollapsed(`[${allExpected ? "✓" : "✗"}] WikiShield Storage Logs: ${name}`);
    for (const log of logs) {
        let prefix = `[${log.expected ? "✓" : "✗"}][${log.timestamp}][Storage]`;

        let type = log.type;
        if (type === "dev") {
            type = "error";
            prefix = `#DEV# ${prefix}`;
        }

        console[type](`${prefix} ${log.message}`);
    }
    console.groupEnd();

    console.log(storage.data);
}
Test();