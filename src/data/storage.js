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

export class Logger {
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
                performance: {
                    startup: "adaptive",
                },

                namespaces: [ 0 ],

                queue: {
                    max_size: 100,
                    max_edits: 50,
                    min_ores: 0.0,

                    recent: {
                        enabled: true,
                        order: 0,
                    },
                    flagged: {
                        enabled: true,
                        order: 1,
                    },
                    users: {
                        enabled: true,
                        order: 2,
                    },
                    watchlist: {
                        enabled: true,
                        order: 3,
                    },
                },

                cloud_storage: {
                    enabled: true,
                },

                username_highlighting: {
                    enabled: true,
                    fuzzy: true,
                },

                auto_welcome: {
                    enabled: false,
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
                        "AI-generated", "AI-generated (talk)", /* "MOS violation", */ "Censoring", /* "Not English" */,

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
                        "master.ui.click": 0.05,

                        "master.queue": 1,
                        "master.queue.ores": 1,
                        "master.queue.mention": 1,

                        "master.notification": 1,
                        "master.notification.alert": 0.7,
                        "master.notification.notice": 0.5,
                        "master.notification.toast": 0.5,

                        "master.action": 1,
                        "master.action.default": 0.6,
                        "master.action.failed": 0.85,
                        "master.action.report": 1,
                        "master.action.block": 1,
                        "master.action.protect": 1,
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
                    toasts: {
                        enabled: false,
                    },

                    badges: {
                        enabled: false,
                    },
                }
            },
            UI: {
                theme: {
                    palette: 0,
                },
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
                users_reviewed: {
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

                watchlist: {
                    watched: 0,
                    unwatched: 0
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
        this.deprecated("options", "volumes", "watchlist");
        this.deprecated("options", "volumes", "success");
        this.deprecated("options", "volumes", "error");

        this.deprecated("options", "soundMappings");

        this.deprecated("options", "wiki");

        this.deprecated("options", "showTemps");
        this.deprecated("options", "showUsers");

        this.deprecated("options", "sortQueueItems");

        this.deprecated("options", "theme");

        this.deprecated("options", "zen", "editCount");
        this.deprecated("options", "zen", "watchlist");

        const defaults = this.default;
        return {
            changelog: this.sanitize([ "changelog" ], defaults.changelog),

            settings: {
                performance: {
                    startup: defaults.settings.performance.startup, // did not exist in v0
                },

                namespaces: this.sanitize([ "options", "namespacesShown" ], defaults.settings.namespaces),

                queue: {
                    max_size: this.sanitize([ "options", "maxQueueSize" ], defaults.settings.queue.max_size),
                    max_edits: this.sanitize([ "options", "maxEditCount" ], defaults.settings.queue.max_edits),
                    min_ores: this.sanitize([ "options", "minimumORESScore" ], defaults.settings.queue.min_ores),

                    recent: {
                        enabled: defaults.settings.queue.recent.enabled, // did not exist in v0
                        order: defaults.settings.queue.recent.order, // did not exist in v0
                    },
                    flagged: {
                        enabled: defaults.settings.queue.flagged.enabled, // did not exist in v0
                        order: defaults.settings.queue.flagged.order, // did not exist in v0
                    },
                    users: {
                        enabled: defaults.settings.queue.users.enabled, // did not exist in v0
                        order: defaults.settings.queue.users.order, // did not exist in v0
                    },
                    watchlist: {
                        enabled: defaults.settings.queue.watchlist.enabled, // did not exist in v0
                        order: defaults.settings.queue.watchlist.order, // did not exist in v0
                    },
                },

                cloud_storage: {
                    enabled: this.sanitize([ "options", "enableCloudStorage" ], defaults.settings.cloud_storage.enabled),
                },

                username_highlighting: {
                    enabled: this.sanitize([ "options", "enableUsernameHighlighting" ], defaults.settings.username_highlighting.enabled),
                    fuzzy: defaults.settings.username_highlighting.fuzzy, // did not exist in v0
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

                        "master.queue": defaults.settings.audio.volume["master.queue"], // did not exist in v0
                        "master.queue.ores": this.sanitize([ "options", "volumes", "alert" ], defaults.settings.audio.volume["master.queue.ores"]),
                        "master.queue.mention": defaults.settings.audio.volume["master.queue.mention"], // did not exist in v0

                        "master.notification": defaults.settings.audio.volume["master.notification"], // did not exist in v0
                        "master.notification.alert": this.sanitize([ "options", "volumes", "notification" ], defaults.settings.audio.volume["master.notification.alert"]),
                        "master.notification.notice": this.sanitize([ "options", "volumes", "notification" ], defaults.settings.audio.volume["master.notification.notice"]),
                        "master.notification.toast": this.sanitize([ "options", "volumes", "notification" ], defaults.settings.audio.volume["master.notification.toast"]),

                        "master.action": defaults.settings.audio.volume["master.action"], // did not exist in v0
                        "master.action.default": defaults.settings.audio.volume["master.action.default"], // did not exist in v0
                        "master.action.failed": defaults.settings.audio.volume["master.action.failed"], // did not exist in v0
                        "master.action.report": this.sanitize([ "options", "volumes", "report" ], defaults.settings.audio.volume["master.action.report"]),
                        "master.action.block": this.sanitize([ "options", "volumes", "block" ], defaults.settings.audio.volume["master.action.block"]),
                        "master.action.protect": this.sanitize([ "options", "volumes", "protection" ], defaults.settings.audio.volume["master.action.protect"]),
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
                    toasts: {
                        enabled: this.sanitize([ "options", "zen", "toasts" ], defaults.settings.zen_mode.toasts.enabled),
                    },

                    badges: {
                        enabled: defaults.settings.zen_mode.badges.enabled, // did not exist in v0
                    },
                }
            },
            UI: {
                theme: {
                    palette: this.sanitize([ "options", "selectedPalette" ], defaults.UI.theme.palette),
                },
                queue: {
                    width: this.sanitize([ "queueWidth" ], defaults.UI.queue.width),
                },
                details: {
                    width: this.sanitize([ "detailsWidth" ], defaults.UI.details.width),
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
                    total: defaults.statistics.edits_reviewed.total,

                    thanked: defaults.statistics.edits_reviewed.thanked,
                },
                recent_changes_reviewed: {
                    total: defaults.statistics.recent_changes_reviewed.total,
                },
                pending_changes_reviewed: {
                    total: defaults.statistics.pending_changes_reviewed.total,

                    accepted: defaults.statistics.pending_changes_reviewed.accepted,
                    rejected: defaults.statistics.pending_changes_reviewed.rejected,
                },
                watchlist_changes_reviewed: {
                    total: defaults.statistics.watchlist_changes_reviewed.total,
                },
                users_reviewed: {
                    total: defaults.statistics.users_reviewed.total,
                },
                reverts_made: {
                    total: defaults.statistics.reverts_made.total,
                    good_faith: defaults.statistics.reverts_made.good_faith,

                    from_recent_changes: defaults.statistics.reverts_made.from_recent_changes,
                    from_pending_changes: defaults.statistics.reverts_made.from_pending_changes,
                    from_watchlist: defaults.statistics.reverts_made.from_watchlist,
                    from_loaded_edits: defaults.statistics.reverts_made.from_loaded_edits,
                },
                users_welcomed: {
                    total: defaults.statistics.users_welcomed.total,
                },
                warnings_issued: {
                    total: defaults.statistics.warnings_issued.total,

                    level_1: defaults.statistics.warnings_issued.level_1,
                    level_2: defaults.statistics.warnings_issued.level_2,
                    level_3: defaults.statistics.warnings_issued.level_3,
                    level_4: defaults.statistics.warnings_issued.level_4,
                    level_4im: defaults.statistics.warnings_issued.level_4im,
                },
                reports_filed: {
                    total: defaults.statistics.reports_filed.total,

                    AIV: defaults.statistics.reports_filed.AIV,
                    UAA: defaults.statistics.reports_filed.UAA,
                    RFPP: defaults.statistics.reports_filed.RFPP
                },

                watchlist: {
                    watched: defaults.statistics.watchlist.watched,
                    unwatched: defaults.statistics.watchlist.unwatched,
                },

                items_whitelisted: {
                    total: defaults.statistics.items_whitelisted.total,

                    users: defaults.statistics.items_whitelisted.users,
                    pages: defaults.statistics.items_whitelisted.pages,
                    tags: defaults.statistics.items_whitelisted.tags,
                },
                items_highlighted: {
                    total: defaults.statistics.items_highlighted.total,

                    users: defaults.statistics.items_highlighted.users,
                    pages: defaults.statistics.items_highlighted.pages,
                    tags: defaults.statistics.items_highlighted.tags,
                },

                blocks_issued: {
                    total: defaults.statistics.blocks_issued.total,
                },
                pages_protected: {
                    total: defaults.statistics.pages_protected.total,
                },

                actions_executed: {
                    total: defaults.statistics.actions_executed.total,

                    successful: defaults.statistics.actions_executed.successful,
                },

                session_time: defaults.statistics.session_time,
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
            const scope = root.settings;
            this.restrictObject(scope, "settings");

            { // root.settings.performance
                const scope = root.settings.performance;
                this.restrictObject(scope, "settings", "performance");

                { // root.settings.performance.startup
                    const validValues = new Set([ "always_off", "adaptive", "always_on" ]);
                    const value = root.settings.performance.startup;

                    if (!validValues.has(value)) {
                        this.reset("settings", "performance", "startup");
                    }
                }
            }

            { // root.settings.namespaces
                const value = root.settings.namespaces;
                if (!Array.isArray(value)) {
                    this.reset("settings", "namespaces");
                }

                root.settings.namespaces = [ ...new Set(root.settings.namespaces) ].filter(v => {
                    const valid = namespaces.some(ns => ns.id === v);
                    if (!valid) {
                        this.loadedLogger.warn(`Removing invalid namespace ID [ ${v} ] from stored data.`);
                    }

                    return valid;
                });
            }

            { // root.settings.queue
                const scope = root.settings.queue;
                this.restrictObject(scope, "settings", "queue");

                { // root.settings.queue.max_size
                    const value = root.settings.queue.max_size;
                    if (!(typeof value === "number" && Number.isInteger(value) && value > 0)) {
                        this.reset("settings", "queue", "max_size");
                    }
                }

                { // root.settings.queue.max_edits
                    const value = root.settings.queue.max_edits;
                    if (!(typeof value === "number" && Number.isInteger(value) && value > 0)) {
                        this.reset("settings", "queue", "max_edits");
                    }
                }

                { // root.settings.queue.min_ores
                    const value = root.settings.queue.min_ores;
                    if (!(typeof value === "number" && value >= 0.0 && value <= 1.0)) {
                        this.reset("settings", "queue", "min_ores");
                    }
                }

                [ "recent", "flagged", "users", "watchlist" ].forEach((section, _, queues) => {
                    { // root.settings.queue[section]
                        const scope = root.settings.queue[section];
                        this.restrictObject(scope, "settings", "queue", section);

                        { // root.settings.queue[section].enabled
                            const value = root.settings.queue[section].enabled;
                            if (typeof value !== "boolean") {
                                this.reset("settings", "queue", section, "enabled");
                            }
                        }

                        { // root.settings.queue[section].order
                            const value = root.settings.queue[section].order;
                            if (!(typeof value === "number" && Number.isInteger(value) && value >= 0 && value < queues.length)) {
                                this.reset("settings", "queue", section, "order");
                            }
                        }
                    }
                });
            }

            { // root.settings.cloud_storage
                const scope = root.settings.cloud_storage;
                this.restrictObject(scope, "settings", "cloud_storage");

                { // root.settings.cloud_storage.enabled
                    const value = root.settings.cloud_storage.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "cloud_storage", "enabled");
                    }
                }
            }

            { // root.settings.username_highlighting
                const scope = root.settings.username_highlighting;
                this.restrictObject(scope, "settings", "username_highlighting");

                { // root.settings.username_highlighting.enabled
                    const value = root.settings.username_highlighting.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "username_highlighting", "enabled");
                    }
                }

                { // root.settings.username_highlighting.fuzzy
                    const value = root.settings.username_highlighting.fuzzy;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "username_highlighting", "fuzzy");
                    }
                }
            }

            { // root.settings.auto_welcome
                const scope = root.settings.auto_welcome;
                this.restrictObject(scope, "settings", "auto_welcome");

                { // root.settings.auto_welcome.enabled
                    const value = root.settings.auto_welcome.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "auto_welcome", "enabled");
                    }
                }
            }

            { // root.settings.expiry
                const expiries = new Set([ "none", "1 hour", "1 day", "1 week", "1 month", "3 months", "6 months", "indefinite" ]);

                const scope = root.settings.expiry;
                this.restrictObject(scope, "settings", "expiry");

                { // root.settings.expiry.watchlist
                    const value = root.settings.expiry.watchlist;
                    if (!expiries.has(value)) {
                        this.reset("settings", "expiry", "watchlist");
                    }
                }

                { // root.settings.expiry.whitelist
                    const scope = root.settings.expiry.whitelist;
                    this.restrictObject(scope, "settings", "expiry", "whitelist");

                    { // root.settings.expiry.whitelist.users
                        const value = root.settings.expiry.whitelist.users;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "whitelist", "users");
                        }
                    }

                    { // root.settings.expiry.whitelist.pages
                        const value = root.settings.expiry.whitelist.pages;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "whitelist", "pages");
                        }
                    }

                    { // root.settings.expiry.whitelist.tags
                        const value = root.settings.expiry.whitelist.tags;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "whitelist", "tags");
                        }
                    }
                }

                { // root.settings.expiry.highlight
                    const scope = root.settings.expiry.highlight;
                    this.restrictObject(scope, "settings", "expiry", "highlight");

                    { // root.settings.expiry.highlight.users
                        const value = root.settings.expiry.highlight.users;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "highlight", "users");
                        }
                    }

                    { // root.settings.expiry.highlight.pages
                        const value = root.settings.expiry.highlight.pages;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "highlight", "pages");
                        }
                    }

                    { // root.settings.expiry.highlight.tags
                        const value = root.settings.expiry.highlight.tags;
                        if (!expiries.has(value)) {
                            this.reset("settings", "expiry", "highlight", "tags");
                        }
                    }
                }
            }

            { // root.settings.auto_report
                const scope = root.settings.auto_report;
                this.restrictObject(scope, "settings", "auto_report");

                { // root.settings.auto_report.enabled
                    const value = root.settings.auto_report.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "auto_report", "enabled");
                    }
                }

                { // root.settings.auto_report.for
                    const value = root.settings.auto_report.for;
                    if (!Array.isArray(value)) {
                        this.reset("settings", "auto_report", "for");
                    }

                    root.settings.auto_report.for = [ ...new Set(root.settings.auto_report.for) ].filter(v => {
                        const valid = v in warningsLookup;
                        if (!valid) {
                            this.loadedLogger.warn(`Removing invalid auto-report reason [ ${v} ] from stored data.`);
                        }

                        return valid;
                    });
                }
            }

            { // root.settings.AI
                const scope = root.settings.AI;
                this.restrictObject(scope, "settings", "AI");

                { // root.settings.AI.enabled
                    const value = root.settings.AI.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "AI", "enabled");
                    }
                }

                { // root.settings.AI.provider
                    const value = root.settings.AI.provider;
                    if (value !== "Ollama") {
                        this.reset("settings", "AI", "provider");
                    }
                }

                { // root.settings.AI.edit_analysis
                    const scope = root.settings.AI.edit_analysis;
                    this.restrictObject(scope, "settings", "AI", "edit_analysis");

                    { // root.settings.AI.edit_analysis.enabled
                        const value = root.settings.AI.edit_analysis.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "AI", "edit_analysis", "enabled");
                        }
                    }
                }

                { // root.settings.AI.username_analysis
                    const scope = root.settings.AI.username_analysis;
                    this.restrictObject(scope, "settings", "AI", "username_analysis");
                    { // root.settings.AI.username_analysis.enabled
                        const value = root.settings.AI.username_analysis.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "AI", "username_analysis", "enabled");
                        }
                    }
                }

                { // root.settings.AI.Ollama
                    const scope = root.settings.AI.Ollama;
                    this.restrictObject(scope, "settings", "AI", "Ollama");

                    { // root.settings.AI.Ollama.server
                        const value = root.settings.AI.Ollama.server;
                        if (!isURL(value)) {
                            this.reset("settings", "AI", "Ollama", "server");
                        }
                    }

                    { // root.settings.AI.Ollama.model
                        const value = root.settings.AI.Ollama.model;
                        if (typeof value !== "string") {
                            this.reset("settings", "AI", "Ollama", "model");
                        }
                    }
                }
            }

            { // root.settings.audio
                const scope = root.settings.audio;
                this.restrictObject(scope, "settings", "audio");

                { // root.settings.audio.ores_alert
                    const scope = root.settings.audio.ores_alert;
                    this.restrictObject(scope, "settings", "audio", "ores_alert");

                    { // root.settings.audio.ores_alert.enabled
                        const value = root.settings.audio.ores_alert.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "audio", "ores_alert", "enabled");
                        }
                    }

                    { // root.settings.audio.ores_alert.threshold
                        const value = root.settings.audio.ores_alert.threshold;
                        if (!(typeof value === "number" && value >= 0.0 && value <= 1.0)) {
                            this.reset("settings", "audio", "ores_alert", "threshold");
                        }
                    }
                }

                { // root.settings.audio.volume
                    const scope = root.settings.audio.volume;
                    this.restrictObject(scope, "settings", "audio", "volume");

                    const volumeKeys = [
                        "master",
                        "master.startup",

                        "master.music",
                        "master.music.zen_mode",

                        "master.ui",
                        "master.ui.click",

                        "master.queue",
                        "master.queue.ores",
                        "master.queue.mention",

                        "master.notification",
                        "master.notification.alert",
                        "master.notification.notice",
                        "master.notification.toast",

                        "master.action",
                        "master.action.default",
                        "master.action.failed",
                        "master.action.report",
                        "master.action.block",
                        "master.action.protect",
                    ];

                    for (const key of volumeKeys) {
                        const value = root.settings.audio.volume[key];
                        if (!(typeof value === "number" && value >= 0 && value <= 1)) {
                            this.reset("settings", "audio", "volume", key);
                        }
                    }
                }
            }

            { // root.settings.zen_mode
                const scope = root.settings.zen_mode;
                this.restrictObject(scope, "settings", "zen_mode");

                { // root.settings.zen_mode.enabled
                    const value = scope.enabled;
                    if (typeof value !== "boolean") {
                        this.reset("settings", "zen_mode", "enabled");
                    }
                }

                { // root.settings.zen_mode.sound
                    const scope = root.settings.zen_mode.sound;
                    this.restrictObject(scope, "settings", "zen_mode", "sound");

                    { // root.settings.zen_mode.sound.enabled
                        const value = root.settings.zen_mode.sound.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "sound", "enabled");
                        }
                    }
                }
                { // root.settings.zen_mode.music
                    const scope = root.settings.zen_mode.music;
                    this.restrictObject(scope, "settings", "zen_mode", "music");

                    { // root.settings.zen_mode.music.enabled
                        const value = root.settings.zen_mode.music.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "music", "enabled");
                        }
                    }
                }

                { // root.settings.zen_mode.alerts
                    const scope = root.settings.zen_mode.alerts;
                    this.restrictObject(scope, "settings", "zen_mode", "alerts");

                    { // root.settings.zen_mode.alerts.enabled
                        const value = root.settings.zen_mode.alerts.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "alerts", "enabled");
                        }
                    }
                }
                { // root.settings.zen_mode.notices
                    const scope = root.settings.zen_mode.notices;
                    this.restrictObject(scope, "settings", "zen_mode", "notices");

                    { // root.settings.zen_mode.notices.enabled
                        const value = root.settings.zen_mode.notices.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "notices", "enabled");
                        }
                    }
                }
                { // root.settings.zen_mode.toasts
                    const scope = root.settings.zen_mode.toasts;
                    this.restrictObject(scope, "settings", "zen_mode", "toasts");
                    { // root.settings.zen_mode.toasts.enabled
                        const value = root.settings.zen_mode.toasts.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "toasts", "enabled");
                        }
                    }
                }

                { // root.settings.zen_mode.badges
                    const scope = root.settings.zen_mode.badges;
                    this.restrictObject(scope, "settings", "zen_mode", "badges");
                    { // root.settings.zen_mode.badges.enabled
                        const value = root.settings.zen_mode.badges.enabled;
                        if (typeof value !== "boolean") {
                            this.reset("settings", "zen_mode", "badges", "enabled");
                        }
                    }
                }
            }
        }

        { // root.UI
            const scope = root.UI;
            this.restrictObject(scope, "UI");

            { // root.UI.theme
                const scope = root.UI.theme;
                this.restrictObject(scope, "UI", "theme");

                { // root.UI.theme.palette
                    const value = root.UI.theme.palette;
                    if (!(typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3)) {
                        this.reset("UI", "theme", "palette");
                    }
                }
            }

            { // root.UI.queue
                const scope = root.UI.queue;
                this.restrictObject(scope, "UI", "queue");

                { // root.UI.queue.width
                    const value = root.UI.queue.width;
                    if (!(typeof value === "string" && value.endsWith("vw"))) {
                        this.reset("UI", "queue", "width");
                    }

                    const numericPart = parseFloat(value.slice(0, -2));
                    if (!(typeof numericPart === "number" && !isNaN(numericPart) && numericPart >= 10 && numericPart <= 30)) {
                        this.reset("UI", "queue", "width");
                    }
                }
            }

            { // root.UI.details
                const scope = root.UI.details;
                this.restrictObject(scope, "UI", "details");

                { // root.UI.details.width
                    const value = root.UI.details.width;
                    if (!(typeof value === "string" && value.endsWith("vw"))) {
                        this.reset("UI", "details", "width");
                    }

                    const numericPart = parseFloat(value.slice(0, -2));
                    if (!(typeof numericPart === "number" && !isNaN(numericPart) && numericPart >= 10 && numericPart <= 30)) {
                        this.reset("UI", "details", "width");
                    }
                }
            }
        }

        { // root.control_scripts
            const scope = root.control_scripts;
            if (!Array.isArray(scope)) {
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

            root.control_scripts = root.control_scripts.filter((scope, index) => {
                index = +index;
                if (!isObject(scope)) {
                    this.loadedLogger.warn(`Removing invalid control script at path [ ${[ "control_scripts", index ].join(" -> ")} ] from stored data.`);
                    return false;
                }

                if (!Array.isArray(scope.keys)) {
                    this.loadedLogger.warn(`Removing invalid keys array from control script at index [ ${index} ] in stored data.`);
                    root.control_scripts[index].keys = [ ];
                }

                if (!Array.isArray(scope.actions)) {
                    this.loadedLogger.warn(`Removing invalid actions array from control script at index [ ${index} ] in stored data.`);
                    root.control_scripts[index].actions = [ ];
                }

                root.control_scripts[index].keys = scope.keys.filter((key) => validControlKeys.has(key));
                root.control_scripts[index].actions = sanitizeActions.call(this, scope.actions, "control_scripts", index, "actions");

                return true;
            });
        }

        { // root.statistics
            const isValidStatistic = v => typeof v === "number" && Number.isInteger(v) && v >= 0;

            const scope = root.statistics;
            this.restrictObject(scope, "statistics");

            { // root.statistics.edits_reviewed
                const scope = root.statistics.edits_reviewed;
                this.restrictObject(scope, "statistics", "edits_reviewed");

                { // root.statistics.edits_reviewed.total
                    const value = root.statistics.edits_reviewed.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "edits_reviewed", "total");
                    }
                }

                { // root.statistics.edits_reviewed.thanked
                    const value = root.statistics.edits_reviewed.thanked;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "edits_reviewed", "thanked");
                    }
                }
            }

            { // root.statistics.recent_changes_reviewed
                const scope = root.statistics.recent_changes_reviewed;
                this.restrictObject(scope, "statistics", "recent_changes_reviewed");

                { // root.statistics.recent_changes_reviewed.total
                    const value = root.statistics.recent_changes_reviewed.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "recent_changes_reviewed", "total");
                    }
                }
            }
            { // root.statistics.pending_changes_reviewed
                const scope = root.statistics.pending_changes_reviewed;
                this.restrictObject(scope, "statistics", "pending_changes_reviewed");

                { // root.statistics.pending_changes_reviewed.total
                    const value = root.statistics.pending_changes_reviewed.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "pending_changes_reviewed", "total");
                    }
                }

                { // root.statistics.pending_changes_reviewed.accepted
                    const value = root.statistics.pending_changes_reviewed.accepted;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "pending_changes_reviewed", "accepted");
                    }
                }
                { // root.statistics.pending_changes_reviewed.rejected
                    const value = root.statistics.pending_changes_reviewed.rejected;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "pending_changes_reviewed", "rejected");
                    }
                }
            }
            { // root.statistics.watchlist_changes_reviewed
                const scope = root.statistics.watchlist_changes_reviewed;
                this.restrictObject(scope, "statistics", "watchlist_changes_reviewed");

                { // root.statistics.watchlist_changes_reviewed.total
                    const value = root.statistics.watchlist_changes_reviewed.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "watchlist_changes_reviewed", "total");
                    }
                }
            }
            { // root.statistics.users_reviewed
                const scope = root.statistics.users_reviewed;
                this.restrictObject(scope, "statistics", "users_reviewed");

                { // root.statistics.users_reviewed.total
                    const value = root.statistics.users_reviewed.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "users_reviewed", "total");
                    }
                }
            }

            { // root.statistics.reverts_made
                const scope = root.statistics.reverts_made;
                this.restrictObject(scope, "statistics", "reverts_made");

                { // root.statistics.reverts_made.total
                    const value = root.statistics.reverts_made.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "total");
                    }
                }
                { // root.statistics.reverts_made.good_faith
                    const value = root.statistics.reverts_made.good_faith;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "good_faith");
                    }
                }

                { // root.statistics.reverts_made.from_recent_changes
                    const value = root.statistics.reverts_made.from_recent_changes;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "from_recent_changes");
                    }
                }
                { // root.statistics.reverts_made.from_pending_changes
                    const value = root.statistics.reverts_made.from_pending_changes;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "from_pending_changes");
                    }
                }
                { // root.statistics.reverts_made.from_watchlist
                    const value = root.statistics.reverts_made.from_watchlist;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "from_watchlist");
                    }
                }
                { // root.statistics.reverts_made.from_loaded_edits
                    const value = root.statistics.reverts_made.from_loaded_edits;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reverts_made", "from_loaded_edits");
                    }
                }
            }

            { // root.statistics.users_welcomed
                const scope = root.statistics.users_welcomed;
                this.restrictObject(scope, "statistics", "users_welcomed");

                { // root.statistics.users_welcomed.total
                    const value = root.statistics.users_welcomed.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "users_welcomed", "total");
                    }
                }
            }

            { // root.statistics.warnings_issued
                const scope = root.statistics.warnings_issued;
                this.restrictObject(scope, "statistics", "warnings_issued");

                { // root.statistics.warnings_issued.total
                    const value = root.statistics.warnings_issued.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "total");
                    }
                }

                { // root.statistics.warnings_issued.level_1
                    const value = root.statistics.warnings_issued.level_1;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "level_1");
                    }
                }
                { // root.statistics.warnings_issued.level_2
                    const value = root.statistics.warnings_issued.level_2;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "level_2");
                    }
                }
                { // root.statistics.warnings_issued.level_3
                    const value = root.statistics.warnings_issued.level_3;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "level_3");
                    }
                }
                { // root.statistics.warnings_issued.level_4
                    const value = root.statistics.warnings_issued.level_4;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "level_4");
                    }
                }
                { // root.statistics.warnings_issued.level_4im
                    const value = root.statistics.warnings_issued.level_4im;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "warnings_issued", "level_4im");
                    }
                }
            }

            { // root.statistics.reports_filed
                const scope = root.statistics.reports_filed;
                this.restrictObject(scope, "statistics", "reports_filed");

                { // root.statistics.reports_filed.total
                    const value = root.statistics.reports_filed.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reports_filed", "total");
                    }
                }

                { // root.statistics.reports_filed.AIV
                    const value = root.statistics.reports_filed.AIV;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reports_filed", "AIV");
                    }
                }
                { // root.statistics.reports_filed.UAA
                    const value = root.statistics.reports_filed.UAA;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reports_filed", "UAA");
                    }
                }
                { // root.statistics.reports_filed.RFPP
                    const value = root.statistics.reports_filed.RFPP;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "reports_filed", "RFPP");
                    }
                }
            }

            { // root.statistics.watchlist
                const scope = root.statistics.watchlist;
                this.restrictObject(scope, "statistics", "watchlist");

                { // root.statistics.watchlist.watched
                    const value = root.statistics.watchlist.watched;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "watchlist", "watched");
                    }
                }

                { // root.statistics.watchlist.unwatched
                    const value = root.statistics.watchlist.unwatched;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "watchlist", "unwatched");
                    }
                }
            }

            { // root.statistics.items_whitelisted
                const scope = root.statistics.items_whitelisted;
                this.restrictObject(scope, "statistics", "items_whitelisted");

                { // root.statistics.items_whitelisted.total
                    const value = root.statistics.items_whitelisted.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_whitelisted", "total");
                    }
                }

                { // root.statistics.items_whitelisted.users
                    const value = root.statistics.items_whitelisted.users;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_whitelisted", "users");
                    }
                }
                { // root.statistics.items_whitelisted.pages
                    const value = root.statistics.items_whitelisted.pages;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_whitelisted", "pages");
                    }
                }
                { // root.statistics.items_whitelisted.tags
                    const value = root.statistics.items_whitelisted.tags;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_whitelisted", "tags");
                    }
                }
            }
            { // root.statistics.items_highlighted
                const scope = root.statistics.items_highlighted;
                this.restrictObject(scope, "statistics", "items_highlighted");

                { // root.statistics.items_highlighted.total
                    const value = root.statistics.items_highlighted.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_highlighted", "total");
                    }
                }

                { // root.statistics.items_highlighted.users
                    const value = root.statistics.items_highlighted.users;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_highlighted", "users");
                    }
                }
                { // root.statistics.items_highlighted.pages
                    const value = root.statistics.items_highlighted.pages;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_highlighted", "pages");
                    }
                }
                { // root.statistics.items_highlighted.tags
                    const value = root.statistics.items_highlighted.tags;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "items_highlighted", "tags");
                    }
                }
            }

            { // root.statistics.blocks_issued
                const scope = root.statistics.blocks_issued;
                this.restrictObject(scope, "statistics", "blocks_issued");

                { // root.statistics.blocks_issued.total
                    const value = root.statistics.blocks_issued.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "blocks_issued", "total");
                    }
                }
            }
            { // root.statistics.pages_protected
                const scope = root.statistics.pages_protected;
                this.restrictObject(scope, "statistics", "pages_protected");

                { // root.statistics.pages_protected.total
                    const value = root.statistics.pages_protected.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "pages_protected", "total");
                    }
                }
            }

            { // root.statistics.actions_executed
                const scope = root.statistics.actions_executed;
                this.restrictObject(scope, "statistics", "actions_executed");

                { // root.statistics.actions_executed.total
                    const value = root.statistics.actions_executed.total;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "actions_executed", "total");
                    }
                }

                { // root.statistics.actions_executed.successful
                    const value = root.statistics.actions_executed.successful;
                    if (!isValidStatistic(value)) {
                        this.reset("statistics", "actions_executed", "successful");
                    }
                }
            }

            { // root.statistics.session_time
                const value = root.statistics.session_time;
                if (!(typeof value === "number" && value >= 0)) {
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
            const scope = root.highlight;
            this.restrictObject(scope, "highlight");

            { // root.highlight.users
                const value = root.highlight.users;
                if (!Array.isArray(value)) {
                    this.reset("highlight", "users");
                }

                root.highlight.users = root.highlight.users.filter(v => isValidExpiryMap(v));
            }

            { // root.highlight.pages
                const value = root.highlight.pages;
                if (!Array.isArray(value)) {
                    this.reset("highlight", "pages");
                }

                root.highlight.pages = root.highlight.pages.filter(v => isValidExpiryMap(v));
            }

            { // root.highlight.tags
                const value = root.highlight.tags;
                if (!Array.isArray(value)) {
                    this.reset("highlight", "tags");
                }

                root.highlight.tags = root.highlight.tags.filter(v => isValidExpiryMap(v));
            }
        }

        { // root.whitelist
            const scope = root.whitelist;
            this.restrictObject(scope, "whitelist");

            { // root.whitelist.users
                const value = root.whitelist.users;
                if (!Array.isArray(value)) {
                    this.reset("whitelist", "users");
                }

                root.whitelist.users = root.whitelist.users.filter(v => isValidExpiryMap(v));
            }

            { // root.whitelist.pages
                const value = root.whitelist.pages;
                if (!Array.isArray(value)) {
                    this.reset("whitelist", "pages");
                }

                root.whitelist.pages = root.whitelist.pages.filter(v => isValidExpiryMap(v));
            }

            { // root.whitelist.tags
                const value = root.whitelist.tags;
                if (!Array.isArray(value)) {
                    this.reset("whitelist", "tags");
                }

                root.whitelist.tags = root.whitelist.tags.filter(v => isValidExpiryMap(v));
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
        const json = window.atob(string.trim() || "e30=");
        try {
            const data = JSON.parse(json);
            return this.load(data);
        } catch (err) {
            return this.load({});
        }
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