// Warning templates and colors

export const warningTemplateColors = {
	"0": "grey",
	"1": "#4169e1",
	"2": "#ff8c00",
	"3": "#ff4500",
	"4": "#b22222",
	"4im": "#000000"
};

const defaultAuto = {
	"0": "1",
	"1": "2",
	"2": "3",
	"3": "4",
	"4": "report",
	"4im": "report"
};

export const warnings = {
	"Vandalism": {
		title: "Vandalism",
		icon: "fas fa-skull-crossbones",
		description: "Warnings for different types of vandalism.",

		warnings: [
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Vandalism",
				icon: "fas fa-skull-crossbones",
				description: "Warning for general vandalism.",

				summary: "vandalism",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-vandalism1" },
					{ name: "2", template: "subst:uw-vandalism2" },
					{ name: "3", template: "subst:uw-vandalism3" },
					{ name: "4", template: "subst:uw-vandalism4" },
					{ name: "4im", template: "subst:uw-vandalism4im" }
				],
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Subtle vandalism",
				icon: "fas fa-user-secret",
				description: "Warning for subtle vandalism.",

				summary: "subtle vandalism",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-subtle1" },
					{ name: "2", template: "subst:uw-subtle2" },
					{ name: "3", template: "subst:uw-subtle3" },
					{ name: "4", template: "subst:uw-subtle4" }
				],
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Image vandalism",
				icon: "fas fa-image",
				description: "Warning for image vandalism.",

				summary: "image vandalism",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-image1" },
					{ name: "2", template: "subst:uw-image2" },
					{ name: "3", template: "subst:uw-image3" },
					{ name: "4", template: "subst:uw-image4" },
					{ name: "4im", template: "subst:uw-image4im" }
				],
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Sandbox",
				icon: "fas fa-vial",
				description: "Warning for vandalism, libelous, or defamatory content added to sandbox",

				summary: "[[WP:BADSAND|inappropriate]] sandbox use",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-sandbox1" },
					{ name: "2", template: "subst:uw-sandbox2" },
					{ name: "3", template: "subst:uw-sandbox3" },
					{ name: "4", template: "subst:uw-sandbox4" },
					{ name: "4im", template: "subst:uw-sandbox4im" }
				],
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Deliberate errors",
				icon: "fas fa-bug",
				description: "Adding deliberate errors to articles.",

				summary: "deliberate errors",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-error1" },
					{ name: "2", template: "subst:uw-error2" },
					{ name: "3", template: "subst:uw-error3" },
					{ name: "4", template: "subst:uw-error4" }
				],
			},
		]
	},
	"Disruption": {
		title: "Disruption",
		icon: "fas fa-exclamation",
		description: "Warnings for different types of disruptive behavior.",

		warnings: [
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Disruptive editing",
				icon: "fas fa-exclamation",
				description: "Default warning for making disruptive edits but may be good faith.",

				summary: "[[WP:DE|disruptive editing]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-disruptive1" },
					{ name: "2", template: "subst:uw-disruptive2" },
					{ name: "3", template: "subst:uw-disruptive3" },
					{ name: "4", template: "subst:uw-generic4", generic: "''Disruptive editing. ([[WP:WikiShield|WS]])''" },
				],
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Editing tests",
				icon: "fas fa-flask",
				description: "Making test edits on live articles.",

				summary: "test edits",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-test1" },
					{ name: "2", template: "subst:uw-test2" },
					{ name: "3", template: "subst:uw-test3" },
					{ name: "4", template: "subst:uw-generic4", generic: "''Test edits. ([[WP:WikiShield|WS]])''" }
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Commentary",
				icon: "fas fa-comment-alt",
				description: "Adding opinion or commentary to articles.",

				summary: "[[WP:Commentary|commentary]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-talkinarticle1" },
					{ name: "2", template: "subst:uw-talkinarticle2" },
					{ name: "3", template: "subst:uw-talkinarticle3" },
					{ name: "4", template: "subst:uw-generic4", generic: "''Adding commentary to articles. ([[WP:WikiShield|WS]])''" },
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Inappropriate jokes",
				icon: "fas fa-grin-squint",
				description: "Adding inappropriate humor to an article.",

				summary: "inappropriate humor",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-jokes1" },
					{ name: "2", template: "subst:uw-jokes2" },
					{ name: "3", template: "subst:uw-jokes3" },
					{ name: "4", template: "subst:uw-jokes4" },
					{ name: "4im", template: "subst:uw-jokes4im" }
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Deleting",
				icon: "fas fa-trash",
				description: "Used when a user does not explain deletion of part of an article.",

				summary: "unexplained deletion",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-delete1" },
					{ name: "2", template: "subst:uw-delete2" },
					{ name: "3", template: "subst:uw-delete3" },
					{ name: "4", template: "subst:uw-delete4" },
					{ name: "4im", template: "subst:uw-delete4im" }
				],
			},
		]
	},
	"Content Issues": {
		title: "Content Issues",
		icon: "fas fa-file-alt",
		description: "Warnings for different types of content issues.",

		warnings: [
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Unsourced",
				icon: "fas fa-question",
				description: "Warning for unsourced content.",

				summary: "unsourced changes",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-unsourced1" },
					{ name: "2", template: "subst:uw-unsourced2" },
					{ name: "3", template: "subst:uw-unsourced3" },
					{ name: "4", template: "subst:uw-unsourced4" }
				],

				show(edit) {
					return !edit?.isBLP;
				}
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Unsourced (BLP)",
				icon: "fas fa-person-circle-question",
				description: "Warning for unsourced BLP content.",

				summary: "unsourced [[WP:BLP|biographies of living persons']] changes",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-biog1" },
					{ name: "2", template: "subst:uw-biog2" },
					{ name: "3", template: "subst:uw-biog3" },
					{ name: "4", template: "subst:uw-biog4" },
					{ name: "4im", template: "subst:uw-biog4im" }
				],

				show(edit) {
					return edit?.isBLP;
				}
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Unsourced genre",
				icon: "fas fa-music",
				description: "Warning for unsourced genre changes.",

				summary: "unsourced genre changes",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-genre1" },
					{ name: "2", template: "subst:uw-genre2" },
					{ name: "3", template: "subst:uw-genre3" },
					{ name: "4", template: "subst:uw-genre4" }
				],
			},

			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Original research",
				icon: "fas fa-lightbulb",
				description: "Adding original research or synthesis.",

				summary: "[[WP:OR|original research]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-nor1" },
					{ name: "2", template: "subst:uw-nor2" },
					{ name: "3", template: "subst:uw-nor3" },
					{ name: "4", template: "subst:uw-nor4" }
				]
			},

			{
				reportable: true,

				queueType: [ "edit" ],

				title: "POV",
				icon: "fas fa-balance-scale-left",
				description: "Adding content which violates the neutral point of view policy.",

				summary: "[[WP:NPOV|non-neutral changes]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-npov1" },
					{ name: "2", template: "subst:uw-npov2" },
					{ name: "3", template: "subst:uw-npov3" },
					{ name: "4", template: "subst:uw-npov4" }
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Censoring",
				icon: "fas fa-ban",
				description: "Censoring topically-relevant content.",

				summary: "[[WP:NOTCENSORED|censoring content]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-notcensored1" },
					{ name: "2", template: "subst:uw-notcensored2" },
					{ name: "3", template: "subst:uw-notcensored3" },
					{ name: "4", template: "subst:uw-notcensored4" }
				]
			},

			{
				reportable: true,

				queueType: [ "edit" ],

				title: "AI-generated",
				icon: "fas fa-robot",
				description: "Adding AI-generated content.",

				summary: "[[WP:LLM|AI-generated content]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-ai1" },
					{ name: "2", template: "subst:uw-ai2" },
					{ name: "3", template: "subst:uw-ai3" },
					{ name: "4", template: "subst:uw-ai4" }
				],

				show(edit) {
					return !edit?.isTalk;
				}
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "AI-generated (talk)",
				icon: "fas fa-robot",
				description: "Writing an AI-generated comment.",

				summary: "[[WP:LLM|AI-generated content]] in a discussion",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-aitalk1" },
					{ name: "2", template: "subst:uw-aitalk2" },
					{ name: "3", template: "subst:uw-aitalk3" },
					{ name: "4", template: "subst:uw-aitalk4" }
				],

				show(edit) {
					return edit?.isTalk;
				}
			},

			{
				reportable: true,

				queueType: [ "edit" ],

				title: "MOS violation",
				icon: "fas fa-spell-check",
				description: "Not following the Manual of Style.",

				summary: "[[WP:MOS|manual of style]] violation",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-mos1" },
					{ name: "2", template: "subst:uw-mos2" },
					{ name: "3", template: "subst:uw-mos3" },
					{ name: "4", template: "subst:uw-mos4" }
				],
			},
			{
				reportable: false,

				queueType: [ "edit" ],

				title: "English variant",
				icon: "fas fa-globe",
				description: "Content added in a different English variant than the rest of the article.",

				summary: "different English variant",
				auto: "notice",

				templates: [
					{ name: "notice", template: "subst:uw-engvar" }
				]
			},
			{
				reportable: false,

				queueType: [ "edit" ],

				title: "Not English",
				icon: "fas fa-language",
				description: "Content added in a language other than English.",

				summary: "non-English",
				auto: "notice",

				templates: [
					{ name: "notice", template: "subst:uw-lang-noteng" }
				]
			}
		]
	},
	"Conduct": {
		title: "Conduct",
		icon: "fas fa-user-shield",
		description: "Warnings for different types of conduct issues.",

		warnings: [
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Personal attacks",
				icon: "fas fa-bomb",
				description: "Personal attacks towards another user.",

				summary: "[[WP:NPA|personal attacks]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-npa1" },
					{ name: "2", template: "subst:uw-npa2" },
					{ name: "3", template: "subst:uw-npa3" },
					{ name: "4", template: "subst:uw-npa4" },
					{ name: "4im", template: "subst:uw-npa4im" }
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Harassment",
				icon: "fas fa-shield-alt",
				description: "Harassment of another user.",

				summary: "[[WP:HARASS|harassment]] of another user",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-harass1" },
					{ name: "2", template: "subst:uw-harass2" },
					{ name: "3", template: "subst:uw-harass3" },
					{ name: "4", template: "subst:uw-harass4" },
					{ name: "4im", template: "subst:uw-harass4im" }
				]
			},

			{
				reportable: true,

				queueType: [ "edit" ],

				title: "TPO",
				icon: "fas fa-hand-paper",
				description: "Removing or editing others' posts.",

				summary: "[[WP:TPO|removing or editing]] others' posts",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-tpo1" },
					{ name: "2", template: "subst:uw-tpo2" },
					{ name: "3", template: "subst:uw-tpo3" },
					{ name: "4", template: "subst:uw-tpo4" },
					{ name: "4im", template: "subst:uw-tpo4im" }
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Chatting",
				icon: "fas fa-comments",
				description: "Using article talk pages for inappropriate discussion.",

				summary: "inappropriate use of article talk pages",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-chat1" },
					{ name: "2", template: "subst:uw-chat2" },
					{ name: "3", template: "subst:uw-chat3" },
					{ name: "4", template: "subst:uw-chat4" }
				],

				show(edit) {
					return edit?.isTalk;
				}
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Owning",
				icon: "fas fa-user-shield",
				description: "Assuming ownership of articles.",

				summary: "assuming [[WP:OWN|ownership of articles]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-own1" },
					{ name: "2", template: "subst:uw-own2" },
					{ name: "3", template: "subst:uw-own3" },
					{ name: "4", template: "subst:uw-own4" }
				],
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "AfD removal",
				icon: "fas fa-gavel",
				description: "Removing AfD templates or other users' comments from AfD discussions.",

				summary: "removing AfD templates or comments",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-afd1" },
					{ name: "2", template: "subst:uw-afd2" },
					{ name: "3", template: "subst:uw-afd3" },
					{ name: "4", template: "subst:uw-afd4" }
				]
			},
			{
				reportable: false,

				queueType: [ "edit" ],

				title: "Edit warring",
				icon: "fas fa-jet-fighter",
				description: "Engaging in edit warring.",

				summary: "[[WP:EW|edit warring]]",

				auto(edit) {
					return edit?.user?.editCount < 500 ? "notice" : "warning";
				},
				templates: [
					{ name: "notice", template: "subst:uw-ew-soft", color: "grey" },
					{ name: "warning", template: "subst:uw-ew", color: "#ff4500" }
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Gaming the system",
				icon: "fas fa-chess-knight",
				description: "Attempting to game Wikipedia's policies or guidelines.",

				summary: "[[WP:GAME|gaming the system]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-gaming1" },
					{ name: "2", template: "subst:uw-gaming2" },
					{ name: "3", template: "subst:uw-gaming3" },
					{ name: "4", template: "subst:uw-gaming4" },
					{ name: "4im", template: "subst:uw-gaming4im" }
				]
			}
		]
	},
	"Promotional": {
		title: "Promotional",
		icon: "fas fa-bullhorn",
		description: "Warnings for promotional content.",

		warnings: [
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Advertising",
				icon: "fas fa-ad",
				description: "Adding advertising or promotional content.",

				summary: "[[WP:PROMO|advertising or promotion]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-advert1" },
					{ name: "2", template: "subst:uw-advert2" },
					{ name: "3", template: "subst:uw-advert3" },
					{ name: "4", template: "subst:uw-advert4" },
					{ name: "4im", template: "subst:uw-advert4im" }
				]
			},
			{
				reportable: true,

				queueType: [ "edit" ],

				title: "Spam links",
				icon: "fas fa-link",
				description: "Adding spam or promotional links.",

				summary: "adding [[WP:ELNO|inappropriate links]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-spam1" },
					{ name: "2", template: "subst:uw-spam2" },
					{ name: "3", template: "subst:uw-spam3" },
					{ name: "4", template: "subst:uw-spam4" },
					{ name: "4im", template: "subst:uw-spam4im" }
				]
			},

			{
				reportable: false,

				queueType: [ "edit" ],

				title: "COI edits",
				icon: "fas fa-user-tie",
				description: "Editing with a conflict of interest.",

				summary: "editing with a [[WP:COI|conflict of interest]]",

				auto: "notice",
				templates: [
					{ name: "notice", template: "subst:uw-coi" },
					{ name: "warning", template: "subst:uw-coi-warn" },
					{ name: "username", template: "subst:uw-coi-username" },
				]
			},
			{
				reportable: false,

				queueType: [ "logevent" ],

				title: "COI user",
				icon: "fas fa-user-tie",
				description: "Apparent conflict of interest.",

				summary: "apparent [[WP:COI|conflict of interest]]",

				auto: "username",
				templates: [
					{ name: "username", template: "subst:uw-coi-username" },
				]
			}
		]
	},
	"Edit Summary": {
		title: "Edit Summary",
		icon: "fas fa-pen-alt",
		description: "Warnings for inappropriate edit summaries.",

		warnings: [
			{
				reportable: false,

				queueType: [ "edit" ],

				title: "No edit summary",
				icon: "fas fa-pen-nib",
				description: "Making an edit without providing an edit summary.",

				summary: "no [[WP:ES|edit summary]] provided",

				auto(edit) {
					return edit?.user?.editCount < 500 ? "newcomer" : "experienced";
				},
				templates: [
					{ name: "newcomer", template: "subst:uw-es" },
					{ name: "experienced", template: "subst:uw-es2" }
				],
			},
			{
				reportable: true,

				queueType: [ "edit", "logevent" ],

				title: "Inappropriate edit summary",
				icon: "fas fa-pen-alt",
				description: "Using an inappropriate edit summary.",

				summary: "inappropriate [[WP:ES|edit summary]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-bes1" },
					{ name: "2", template: "subst:uw-bes2" },
					{ name: "3", template: "subst:uw-bes3" },
					{ name: "4", template: "subst:uw-bes4" },
					{ name: "4im", template: "subst:uw-bes4im" }
				],
			},
			{
				reportable: true,

				queueType: [ "edit", "logevent" ],

				title: "Misleading edit summary",
				icon: "fas fa-mask",
				description: "Using a misleading edit summary.",

				summary: "misleading [[WP:ES|edit summary]]",

				auto: defaultAuto,
				templates: [
					{ name: "1", template: "subst:uw-mislead1" },
					{ name: "2", template: "subst:uw-mislead2" },
					{ name: "3", template: "subst:uw-mislead3" },
					{ name: "4", template: "subst:uw-generic4", generic: "''Misleading edit summary. ([[WP:WikiShield|WS]])''" },
				]
			},

			{
				reportable: false,

				queueType: [ "edit" ],

				title: "Minor edit abuse",
				icon: "fas fa-m",
				description: "Non-minor edit marked as minor",

				summary: "improper use of [[WP:ME|minor edit]] checkbox",

				auto: "notice",
				templates: [
					{ name: "notice", template: "subst:uw-minor" }
				]
			}
		]
	}
};

const lookup = {};
for (const [ type, category ] of Object.entries(warnings)) {
	const len = category.warnings.length;
	for (let i = 0; i < len; i++) {
		const warning = category.warnings[i];
		lookup[warning.title] = warning;
	}
}

export const warningsLookup = lookup;

export function getWarningFromLookup(title) {
	return warningsLookup[title];
}
