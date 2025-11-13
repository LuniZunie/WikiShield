/**
 * @module core/killswitch
 * @description Global killswitch system for WikiShield.
 * 
 * This module provides a polling mechanism to check a remote Wikipedia page
 * for killswitch commands that can disable WikiShield functionality globally,
 * force a reload, or selectively disable specific features. This allows for
 * emergency shutdowns or forced updates without requiring users to manually reload.
 * 
 * @example
 * import { killswitch_status, startKillswitchPolling } from './core/killswitch.js';
 * 
 * // Check if rollback is disabled
 * if (killswitch_status.killed.rollback) {
 *   console.log("Rollback functionality is disabled by killswitch");
 *   return;
 * }
 * 
 * // Start monitoring the killswitch
 * startKillswitchPolling(api, (status) => {
 *   if (status.killed.edit) {
 *     alert("Edit functionality has been disabled");
 *   }
 * });
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
 *   "killed": {
 *     "rollback": false,
 *     "warn": false,
 *     "edit": false
 *   }
 * }
 */
export const killswitch_config = {
    killswitch_page: "User:Monkeysmashingkeyboards/killswitch.js",
    polling_interval: 60000 // Check every 60 seconds (changed from 1000ms)
};

/**
 * Killswitch status object containing fine-grained feature toggles.
 * Properties are updated by polling the remote killswitch page.
 * 
 * @type {Object}
 * @property {Object} killed - Object containing boolean flags for each feature
 * @property {boolean} killed.rollback - Disable rollback functionality
 * @property {boolean} killed.rollback_agf - Disable good-faith rollback
 * @property {boolean} killed.report_uaa - Disable UAA (Username) reports
 * @property {boolean} killed.report_aiv - Disable AIV (Vandalism) reports
 * @property {boolean} killed.report - Disable all reporting functionality
 * @property {boolean} killed.warn - Disable warning users
 * @property {boolean} killed.welcome - Disable welcoming new users
 * @property {boolean} killed.edit - Disable all edit operations
 * 
 * @example
 * // Check if a specific feature is disabled
 * if (killswitch_status.killed.rollback) {
 *   console.log("Rollback is disabled by killswitch");
 * }
 * 
 * // Check before performing an action
 * async function revertEdit(edit) {
 *   if (killswitch_status.killed.rollback || killswitch_status.killed.edit) {
 *     throw new Error("Rollback is currently disabled");
 *   }
 *   // ... perform rollback
 * }
 */
export const killswitch_status = {
    killed: {
        rollback: false,
        rollback_agf: false,
        undo: false,

        report_uaa: false,
        report_aiv: false,
        report_rpp: false,
        report: false,

        warn: false,
        welcome: false,
        thank: false,

        edit: false,
    }
};

/**
 * Check the remote killswitch page and update the global killswitch status.
 * 
 * This function fetches the killswitch configuration page from Wikipedia,
 * parses the JSON content, and updates the killswitch_status object accordingly.
 * All feature flags default to false if not present in the remote configuration.
 * 
 * @async
 * @param {WikiShieldAPI} api - The WikiShield API instance for fetching page content
 * @returns {Promise<Object>} The updated killswitch_status object
 * @throws {Error} If the page cannot be fetched or the JSON is invalid
 * 
 * @example
 * const status = await checkKillswitch(wikishield.api);
 * if (status.killed.warn) {
 *   console.log("Warning functionality is now disabled!");
 * }
 */
export async function checkKillswitch(api) {
    try {
        const content = await api.getSinglePageContent(killswitch_config.killswitch_page);
        const data = JSON.parse(content);
        
        // Update the exported killswitch_status object (mutations propagate to all modules)
        if (data.killed) {
            Object.assign(killswitch_status.killed, data.killed);
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
 * at the interval specified in killswitch_config. When the killswitch state changes,
 * the optional callback is invoked with the updated status.
 * 
 * @param {WikiShieldAPI} api - The WikiShield API instance for fetching page content
 * @param {Function} [onKillswitchChange] - Optional callback invoked when any killswitch flag changes
 * @param {Object} onKillswitchChange.status - The updated killswitch_status object
 * 
 * @example
 * startKillswitchPolling(wikishield.api, (status) => {
 *   if (status.killed.edit) {
 *     wikishield.interface.showToast(
 *       'Feature Disabled',
 *       'Edit functionality has been disabled by administrators',
 *       0,
 *       'warning'
 *     );
 *   }
 * });
 * 
 * @example
 * More granular response to specific features
 * startKillswitchPolling(wikishield.api, (status) => {
 *   const disabledFeatures = [];
 *   
 *   if (status.killed.rollback) disabledFeatures.push('Rollback');
 *   if (status.killed.warn) disabledFeatures.push('Warnings');
 *   if (status.killed.report) disabledFeatures.push('Reports');
 *   
 *   if (disabledFeatures.length > 0) {
 *     console.log('Disabled features:', disabledFeatures.join(', '));
 *   }
 * });
 */
export function startKillswitchPolling(api, onKillswitchChange) {
    const poll = async () => {
        const previousState = JSON.stringify(killswitch_status.killed);
        await checkKillswitch(api);
        const currentState = JSON.stringify(killswitch_status.killed);
        
        // Only trigger callback if state changed
        if (currentState !== previousState && onKillswitchChange) {
            onKillswitchChange(killswitch_status);
        }
        
        // Schedule next check
        setTimeout(poll, killswitch_config.polling_interval);
    };
    
    // Start polling
    poll();
}
