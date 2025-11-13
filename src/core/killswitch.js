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
 * // Expected format of the killswitch page content:
 * {
 *   "disabled": false,
 *   "forceReload": false
 * }
 */
export const killswitch_config = {
    killswitch_page: "User:Monkeysmashingkeyboards/killswitch.js",
    polling_interval: 60000 // Check every 60 seconds
};

/**
 * Killswitch status object with two simple options.
 * 
 * @type {Object}
 * @property {boolean} disabled - If true, WikiShield should not load or operate
 * @property {boolean} forceReload - If true, WikiShield should reload immediately
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
    forceReload: false
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
export async function checkKillswitch(api) {
    try {
        const content = await api.getSinglePageContent(killswitch_config.killswitch_page);
        const data = JSON.parse(content);
        
        // Update status
        if (typeof data.disabled === 'boolean') {
            killswitch_status.disabled = data.disabled;
        }
        if (typeof data.forceReload === 'boolean') {
            killswitch_status.forceReload = data.forceReload;
        }
        
        // If force reload is enabled, reload immediately
        if (killswitch_status.forceReload) {
            console.log("WikiShield: Force reload triggered by killswitch");
            location.reload();
        }
        
        return killswitch_status;
    } catch (err) {
        console.error("Failed to check killswitch:", err);
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
export function startKillswitchPolling(api) {
    const poll = async () => {
        await checkKillswitch(api);
        
        // Schedule next check (only if not force reloaded)
        setTimeout(poll, killswitch_config.polling_interval);
    };
    
    // Start polling
    poll();
}
