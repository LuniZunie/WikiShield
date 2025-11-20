/**
 * @module core/killswitch
 * @description Global killswitch system for WikiShield.
 *
 * This module provides a simple polling mechanism to check a remote Wikipedia page
 * for killswitch commands that can either disable WikiShield entirely or force a reload.
 *
 * @example
 * import { killswitch_status, startKillswitchPolling } from './core/killswitch.js';
 *
 * // Check if WikiShield is disabled
 * if (killswitch_status.disabled) {
 *   console.log("WikiShield is disabled by killswitch");
 *   return;
 * }
 *
 * // Start monitoring the killswitch
 * startKillswitchPolling(api);
 */

/**
 * Configuration for the killswitch polling system.
 *
 * @type {Object}
 * @property {string} killswitch_page - Wikipedia page containing killswitch configuration JSON
 * @property {number} polling_interval - How often to check the killswitch page (milliseconds)
 *
 * @example
 * // To set up the killswitch, create a page at the configured location with this content:
 * // Page: User:LuniZunie/killswitch.js
 * // Content:
 * {
 *   "disabled": false,
 *   "forceReload": false
 * }
 *
 * // To disable WikiShield:
 * {
 *   "disabled": true,
 *   "forceReload": false
 * }
 *
 * // To force all users to reload:
 * {
 *   "disabled": false,
 *   "forceReload": true
 * }
 */
export const killswitch_config = {
    killswitch_page: "User:LuniZunie/killswitch.js",
    polling_interval: 10000 // Check every 10 seconds
};

/**
 * @typedef {ReloadObject}
 * @property {number} soft - soft reload version
 * @property {number} hard - hard reload version
 */

/**
 * Killswitch status object with two simple options.
 *
 * @type {Object}
 * @property {boolean} disabled - If true, WikiShield should not load or operate
 * @property {ReloadObject} reload - Reload options
 *
 * @example
 * // Check if WikiShield is disabled
 * if (killswitch_status.disabled) {
 *   console.log("WikiShield is disabled");
 *   return;
 * }
 */

export const killswitch_status = {
    disabled: false,
    reload: {
        soft: false,
        hard: false,
    },

    notifications: [ ]
};

/**
 * Check the remote killswitch page and update the global killswitch status.
 *
 * This function fetches the killswitch configuration page from Wikipedia,
 * parses the JSON content, and updates the killswitch_status object.
 * If forceReload is detected, it will reload the page immediately.
 *
 * @async
 * @param {WikiShieldAPI} api - The WikiShield API instance for fetching page content
 * @returns {Promise<Object>} The updated killswitch_status object
 *
 * @example
 * const status = await checkKillswitch(wikishield.api);
 * if (status.disabled) {
 *   console.log("WikiShield has been disabled!");
 * }
 */
export async function checkKillswitch(api, startup = true) {
    try {
        const content = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&format=json&origin=*&titles=${encodeURIComponent(killswitch_config.killswitch_page)}`)
            .then(response => response.json())
            .then(data => {
                const pages = data.query.pages;
                const pageId = Object.keys(pages)[0];
                return pages[pageId].revisions[0]['*'];
            });

        // Check if content was successfully fetched
        if (!content) {
            console.warn("WikiShield: Killswitch page not found or could not be fetched");
            return killswitch_status;
        }

        const data = JSON.parse(content)?.WikiShield;

        // Update status
        if (typeof data.disabled === 'boolean') {
            killswitch_status.disabled = data.disabled;
        }

        const soft = data.reload?.soft;
        const hard = data.reload?.hard;

        if (startup) {
            if (typeof soft === "number") {
                window.sessionStorage.setItem("WikiShield:SoftReload", soft);
            }
            if (typeof hard === "number") {
                window.sessionStorage.setItem("WikiShield:HardReload", hard);
            }
        } else {
            if (typeof soft === "number") {
                const current = +window.sessionStorage.getItem("WikiShield:SoftReload");
                if (soft > current) {
                    window.sessionStorage.setItem("WikiShield:SoftReload", soft);

                    console.log("WikiShield: Soft reload triggered by killswitch");
                    killswitch_status.notifications.push({
                        id: `app-${performance.now()}`,
                        type: "app",
                        subtype: "soft-reload",
                        timestamp: Date.now(),
                        title: "A newer version of WikiShield has been released! Reload to update.",
                        agent: "WikiShield Development",
                        category: "WikiShield",
                        read: false
                    });
                }
            }
            if (typeof hard === "number") {
                const current = +window.sessionStorage.getItem("WikiShield:HardReload");
                if (hard > current) {
                    window.sessionStorage.setItem("WikiShield:HardReload", hard);
                    window.sessionStorage.setItem("WikiShield:SendHardReloadNotification", true);

                    console.log("WikiShield: Hard reload triggered by killswitch");
                    location.reload();
                }
            }
        }

        return killswitch_status;
    } catch (err) {
        console.error("WikiShield: Failed to check killswitch:", err);
        // Return current state on error (don't disable WikiShield on network failures)
        return killswitch_status;
    }
}

/**
 * Start polling the killswitch page at regular intervals.
 *
 * This function begins a polling loop that checks the killswitch configuration
 * at the interval specified in killswitch_config.
 *
 * @param {WikiShieldAPI} api - The WikiShield API instance for fetching page content
 *
 * @example
 * startKillswitchPolling(wikishield.api);
 */
export function startKillswitchPolling(api, callback) {
    const poll = async () => {
        await checkKillswitch(api, false);

        if (typeof callback === "function") {
            callback(killswitch_status);
        }

        // Schedule next check (only if not force reloaded)
        setTimeout(poll, killswitch_config.polling_interval);
    };

    // Start polling
    poll();
}
