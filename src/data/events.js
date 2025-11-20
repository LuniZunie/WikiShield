/**
 * Event conditions and welcome templates for WikiShield automation
 */

/**
 * Factory function to create condition checks that have access to the wikishield instance
 * @param {Object} wikishield - The main wikishield instance
 * @returns {Object} Object containing condition check functions
 */
export const createConditions = (wikishield) => ({
	"operatorNonAdmin": {
		desc: "You are not an admin",
		check: (_) => !wikishield.rights.block
	},
	"operatorAdmin": {
		desc: "You are an admin",
		check: (_) => wikishield.rights.block
	},
	"userIsHighlighted": {
		desc: "User is highlighted",
		check: (edit) => wikishield.highlighted.users.has(edit.user.name)
	},
	"pageIsHighlighted": {
		desc: "Page is highlighted",
		check: (edit) => wikishield.highlighted.pages.has(edit.page.title)
	},
	"userIsWhitelisted": {
		desc: "User is whitelisted",
		check: (edit) => wikishield.whitelist.users.has(edit.user.name)
	},
	"pageIsWhitelisted": {
		desc: "Page is whitelisted",
		check: (edit) => wikishield.whitelist.pages.has(edit.page.title)
	},
	"userIsAnon": {
		desc: "User is anonymous (temporary account)",
		check: (edit) => mw.util.isTemporaryUser(edit.user.name)
	},
	"userIsRegistered": {
		desc: "User is registered (not temporary account)",
		check: (edit) => !mw.util.isTemporaryUser(edit.user.name)
	},
	"userHasEmptyTalkPage": {
		desc: "User has an empty talk page",
		check: (edit) => edit.user.emptyTalkPage
	},
	"editIsMinor": {
		desc: "Edit is marked as minor",
		check: (edit) => edit.minor
	},
	"editIsMajor": {
		desc: "Edit is not marked as minor",
		check: (edit) => !edit.minor
	},
	"editSizeNegative": {
		desc: "Edit removes content (negative bytes)",
		check: (edit) => (edit.sizediff || 0) < 0
	},
	"editSizePositive": {
		desc: "Edit adds content (positive bytes)",
		check: (edit) => (edit.sizediff || 0) > 0
	},
	"editSizeLarge": {
		desc: "Edit is large (>1000 bytes change)",
		check: (edit) => Math.abs(edit.sizediff || 0) > 1000
	},
	"userEditCountLow": {
		desc: "User has less than 10 edits",
		check: (edit) => edit.user.editCount < 10 && edit.user.editCount >= 0
	},
	"userEditCountHigh": {
		desc: "User has 100 or more edits",
		check: (edit) => edit.user.editCount >= 100
	},
	"atFinalWarning": {
		desc: "User already has a final warning (before any new warnings)",
		check: (edit) => {
			// Check the ORIGINAL warning level from when edit was first queued
			// This ensures we only report if they ALREADY had a final warning
			// Not if they just received one in this action sequence
			const original = edit.user.originalWarningLevel?.toString() || edit.user.warningLevel.toString();
			const result = ["4", "4im"].includes(original);
			return result;
		}
	},
	"userHasWarnings": {
		desc: "User has received warnings (level 1+)",
		check: (edit) => {
			const level = edit.user.warningLevel?.toString() || "0";
			return !["0", ""].includes(level);
		}
	},
	"userNoWarnings": {
		desc: "User has no warnings (level 0)",
		check: (edit) => {
			const level = edit.user.warningLevel?.toString() || "0";
			return ["0", ""].includes(level);
		}
	}
});

/**
 * Static welcome templates (no dependencies)
 */
export const welcomeTemplates = {
	"Default": "{{subst:Welcome}} ~~~~",
	"Basic": "{{subst:W-basic}}",
	"Links": "{{subst:W-graphical}}",
	"Latin": "{{subst:welcome non-latin}} ~~~~",
	"COI": "{{subst:welcome-coi}} ~~~~",
	"Mentor": "{{subst:Mentor welcome-autosign}}"
};
