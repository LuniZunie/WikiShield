/**
* WikiShieldEventManager - Manages user interface events and actions
* Handles all user-triggered events like reverting, warning, reporting, etc.
*/
import { validEvents, validConditions } from '../config/events.js';

export class WikiShieldEventManager {
	constructor(wikishield) {
		this.wikishield = wikishield;

		this.events = validEvents;
		this.conditions = validConditions;
	}

	/**
	* When a button is clicked, trigger the given event
	* @param {HTMLElement} elem Button to add listener to
	* @param {String} event Event to trigger
	* @param {Boolean} runWithoutEdit Whether this event can be run with no edit selected
	*/
	linkButton(elem, event, runWithoutEdit) {
		const wikishield = this.wikishield;

		const handleClick = (e, forceNewTab = false) => {
			// Check if this is an action that opens a page
			const pageOpenEvents = ["openUserPage", "openUserTalk", "openUserContribs", "openFilterLog", "openPage", "openPageHistory", "openDiff"];
			const shouldOpenInNewTab = forceNewTab || pageOpenEvents.includes(event);

			if (shouldOpenInNewTab && this.events[event]?.func) {
				// For page-opening actions, call the function directly which already handles new tabs
				if (e.button === 1 || e.ctrlKey || e.metaKey || forceNewTab) {
					// Middle click or Ctrl/Cmd+click - let the function handle it
					this.events[event].func();
					e.preventDefault();
					return;
				}
			}

			wikishield.interface.selectedMenu = null;
			if (runWithoutEdit) {
				this.events[event].func(wikishield);
			} else {
				wikishield.executeScript({
					actions: [
						{
							name: event,
							params: {}
						}
					]
				});
			}
		};

		elem.addEventListener("click", (e) => handleClick(e, false));
		elem.addEventListener("auxclick", (e) => {
			if (e.button === 1) { // Middle click
				handleClick(e, true);
			}
		});
	}
}
