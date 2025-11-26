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
	"4": null,
	"4im": null
};

/*
templates: 0, 1, 2, 3, 4, 4im
- null (do not add as option)
- { exists: false, template: <string> } (do not add as option but use this template when clicking auto)
- { exists: true, template: <string> } (add as option)
*/

export const warnings = {
	// Warnings to go in "Revert & Warn" menu (will revert when used)
	revert: {
		"Vandalism": [
			{
				title: "Vandalism",
				summary: "vandalism",
				description: "Warning for general vandalism.",
				icon: "fas fa-skull-crossbones",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-vandalism1" },
					"2": { exists: true, template: "subst:uw-vandalism2" },
					"3": { exists: true, template: "subst:uw-vandalism3" },
					"4": { exists: true, template: "subst:uw-vandalism4" },
					"4im": { exists: true, template: "subst:uw-vandalism4im" }
				}
			},
			{
				title: "Subtle vandalism",
				summary: "subtle vandalism",
				description: "Warning for subtle vandalism.",
				icon: "fas fa-user-secret",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-subtle1" },
					"2": { exists: true, template: "subst:uw-subtle2" },
					"3": { exists: true, template: "subst:uw-subtle3" },
					"4": { exists: true, template: "subst:uw-subtle4" },
					"4im": null
				}
			},
			{
				title: "Image vandalism",
				summary: "image vandalism",
				description: "Warning for image vandalism.",
				icon: "fas fa-image",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-image1" },
					"2": { exists: true, template: "subst:uw-image2" },
					"3": { exists: true, template: "subst:uw-image3" },
					"4": { exists: true, template: "subst:uw-image4" },
					"4im": { exists: true, template: "subst:uw-image4im" }
				}
			},
			{
				title: "Sandbox",
				summary: "[[WP:BADSAND|inappropriate]] use of sandbox",
				description: "Warning for vandalism, libelous, or defamatory content added to sandbox",
				icon: "fas fa-vial",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-sandbox1" },
					"2": { exists: true, template: "subst:uw-sandbox2" },
					"3": { exists: true, template: "subst:uw-sandbox3" },
					"4": { exists: true, template: "subst:uw-sandbox4" },
					"4im": { exists: true, template: "subst:uw-sandbox4im" }
				}
			}
		],
		"Content Issues": [
			{
				title: "Unsourced",
				summary: "adding unsourced content",
				description: "Warning for unsourced content.",
				icon: "fas fa-question",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-unsourced1" },
					"2": { exists: true, template: "subst:uw-unsourced2" },
					"3": { exists: true, template: "subst:uw-unsourced3" },
					"4": { exists: true, template: "subst:uw-unsourced4" },
					"4im": null
				},
				show: edit => !edit?.isBLP
			},
			{
				title: "Unsourced (BLP)",
				summary: "adding unsourced content to [[WP:BLP|biographies of living persons]]",
				description: "Warning for unsourced BLP content.",
				icon: "fas fa-person-circle-question",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-biog1" },
					"2": { exists: true, template: "subst:uw-biog2" },
					"3": { exists: true, template: "subst:uw-biog3" },
					"4": { exists: true, template: "subst:uw-biog4" },
					"4im": { exists: true, template: "subst:uw-biog4im" }
				},
				show: edit => edit?.isBLP
			},
			{
				title: "Unsourced genre",
				summary: "unsourced genre changes",
				description: "Warning for unsourced genre changes.",
				icon: "fas fa-music",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-genre1" },
					"2": { exists: true, template: "subst:uw-genre2" },
					"3": { exists: true, template: "subst:uw-genre3" },
					"4": { exists: true, template: "subst:uw-genre4" },
					"4im": null
				}
			},
			{
				title: "POV",
				summary: "adding [[WP:NPOV|non-neutral content]]",
				description: "Adding content which violates the neutral point of view policy.",
				icon: "fas fa-balance-scale-left",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-npov1" },
					"2": { exists: true, template: "subst:uw-npov2" },
					"3": { exists: true, template: "subst:uw-npov3" },
					"4": { exists: true, template: "subst:uw-npov4" },
					"4im": null
				}
			},
			{
				title: "Commentary",
				summary: "adding commentary",
				description: "Adding opinion or commentary to articles.",
				icon: "fas fa-comment-alt",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-talkinarticle1" },
					"2": { exists: true, template: "subst:uw-talkinarticle2" },
					"3": { exists: true, template: "subst:uw-talkinarticle3" },
					"4": { exists: false, template: "subst:uw-generic4", additional: "''Stop adding commentary to articles.''" },
					"4im": null
				}
			},
			{
				title: "AI-Generated",
				summary: "adding [[WP:LLM|AI-generated content]]",
				description: "Adding AI-generated content.",
				icon: "fas fa-robot",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-ai1" },
					"2": { exists: true, template: "subst:uw-ai2" },
					"3": { exists: true, template: "subst:uw-ai3" },
					"4": { exists: true, template: "subst:uw-ai4" },
					"4im": null
				},
				show: edit => !edit?.isTalk
			},
			{
				title: "AI-generated (talk)",
				summary: "adding [[WP:LLM|AI-generated content]] to a discussion",
				description: "Writing an AI-generated comment.",
				icon: "fas fa-robot",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-aitalk1" },
					"2": { exists: true, template: "subst:uw-aitalk2" },
					"3": { exists: true, template: "subst:uw-aitalk3" },
					"4": { exists: true, template: "subst:uw-aitalk4" },
					"4im": null
				},
				show: edit => edit?.isTalk
			},
			{
				title: "MOS violation",
				summary: "[[WP:MOS|manual of style]] violation",
				description: "Not following the Manual of Style.",
				icon: "fas fa-spell-check",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-mos1" },
					"2": { exists: true, template: "subst:uw-mos2" },
					"3": { exists: true, template: "subst:uw-mos3" },
					"4": { exists: true, template: "subst:uw-mos4" },
					"4im": null
				}
			},
			{
				title: "Censoring",
				summary: "[[WP:NOTCENSORED|censoring content]]",
				description: "Censoring topically-relevant content.",
				icon: "fas fa-ban",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-notcensored1" },
					"2": { exists: true, template: "subst:uw-notcensored2" },
					"3": { exists: true, template: "subst:uw-notcensored3" },
					"4": { exists: true, template: "subst:uw-notcensored4" },
					"4im": null
				}
			}
		],
		"Disruptive Behavior": [
			{
				title: "Disruption",
				summary: "[[WP:DE|disruptive editing]]",
				description: "Default warning for making disruptive edits (not always vandalism).",
				icon: "fas fa-exclamation",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-disruptive1" },
					"2": { exists: true, template: "subst:uw-disruptive2" },
					"3": { exists: true, template: "subst:uw-disruptive3" },
					"4": { exists: false, template: "subst:uw-generic4", additional: "''Stop making disruptive edits to Wikipedia.''" },
					"4im": null
				}
			},
			{
				title: "Deleting",
				summary: "unexplained deletion",
				description: "Used when a user does not explain deletion of part of an article.",
				icon: "fas fa-trash",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-delete1" },
					"2": { exists: true, template: "subst:uw-delete2" },
					"3": { exists: true, template: "subst:uw-delete3" },
					"4": { exists: true, template: "subst:uw-delete4" },
					"4im": { exists: true, template: "subst:uw-delete4im" }
				}
			},
			{
				title: "Errors",
				summary: "adding deliberate errors to articles",
				description: "Adding deliberate errors to articles.",
				icon: "fas fa-bug",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-error1" },
					"2": { exists: true, template: "subst:uw-error2" },
					"3": { exists: true, template: "subst:uw-error3" },
					"4": { exists: true, template: "subst:uw-error4" },
					"4im": null
				}
			},
			{
				title: "Editing tests",
				summary: "test edits",
				description: "Making test edits on live articles.",
				icon: "fas fa-flask",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-test1" },
					"2": { exists: true, template: "subst:uw-test2" },
					"3": { exists: true, template: "subst:uw-test3" },
					"4": { exists: false, template: "subst:uw-generic4", additional: "''Stop making test edits to Wikipedia.''" },
					"4im": null
				}
			},
			{
				title: "Chatting",
				summary: "conversation in article talk space",
				description: "Using article talk pages for inappropriate discussion.",
				icon: "fas fa-comments",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-chat1" },
					"2": { exists: true, template: "subst:uw-chat2" },
					"3": { exists: true, template: "subst:uw-chat3" },
					"4": { exists: true, template: "subst:uw-chat4" },
					"4im": null
				},
				show: edit => edit?.isTalk
			},
			{
				title: "Jokes",
				summary: "adding inappropriate humor",
				description: "Adding inappropriate humor to an article.",
				icon: "fas fa-grin-squint",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-joke1" },
					"2": { exists: true, template: "subst:uw-joke2" },
					"3": { exists: true, template: "subst:uw-joke3" },
					"4": { exists: true, template: "subst:uw-joke4" },
					"4im": { exists: true, template: "subst:uw-joke4im" }
				}
			},
			{
				title: "Owning",
				summary: "assuming [[WP:OWN|ownership of articles]]",
				description: "Assuming ownership of articles.",
				icon: "fas fa-user-shield",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-own1" },
					"2": { exists: true, template: "subst:uw-own2" },
					"3": { exists: true, template: "subst:uw-own3" },
					"4": { exists: true, template: "subst:uw-own4" },
					"4im": { exists: true, template: "subst:uw-own4im" }
				}
			},
		],
		"Spam & Promotion": [
			{
				title: "Advertising",
				summary: "[[WP:PROMO|advertising or promotion]]",
				description: "Adding promotional content to an article.",
				icon: "fas fa-bullhorn",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-advert1" },
					"2": { exists: true, template: "subst:uw-advert2" },
					"3": { exists: true, template: "subst:uw-advert3" },
					"4": { exists: true, template: "subst:uw-advert4" },
					"4im": { exists: true, template: "subst:uw-advert4im" }
				}
			},
			{
				title: "Spam links",
				summary: "adding [[WP:ELNO|inappropriate links]]",
				description: "Adding external links that could be considered spam.",
				icon: "fas fa-link",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-spam1" },
					"2": { exists: true, template: "subst:uw-spam2" },
					"3": { exists: true, template: "subst:uw-spam3" },
					"4": { exists: true, template: "subst:uw-spam4" },
					"4im": { exists: true, template: "subst:uw-spam4im" }
				}
			}
		],
		"Conduct": [
			{
				title: "Personal attacks",
				summary: "[[WP:NPA|personal attacks]]",
				description: "Personal attacks towards another user.",
				icon: "fas fa-bomb",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-npa1" },
					"2": { exists: true, template: "subst:uw-npa2" },
					"3": { exists: true, template: "subst:uw-npa3" },
					"4": { exists: true, template: "subst:uw-npa4" },
					"4im": { exists: true, template: "subst:uw-npa4im" }
				}
			},
			{
				title: "TPO",
				summary: "[[WP:TPO|removing or editing]] others' posts",
				description: "Removing or editing others' posts.",
				icon: "fas fa-hand-paper",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-tpv1" },
					"2": { exists: true, template: "subst:uw-tpv2" },
					"3": { exists: true, template: "subst:uw-tpv3" },
					"4": { exists: true, template: "subst:uw-tpv4" },
					"4im": { exists: true, template: "subst:uw-tpv4im" }
				},
				show: edit => edit?.isTalk
			},
			{
				title: "AfD removal",
				summary: "removing AfD templates or comments",
				description: "Removing AfD templates or other users' comments from AfD discussions.",
				icon: "fas fa-gavel",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-afd1" },
					"2": { exists: true, template: "subst:uw-afd2" },
					"3": { exists: true, template: "subst:uw-afd3" },
					"4": { exists: true, template: "subst:uw-afd4" },
					"4im": null
				}
			}
		]
	},

	// Warnings to go in "Warn" menu (will not revert when used)
	warn: {
		"Edit summary": [
			{
				title: "Misleading",
				summary: "misleading [[WP:ES|edit summary]]",
				description: "Misleading edit summaries.",
				icon: "fas fa-eye-slash",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-mislead1" },
					"2": { exists: true, template: "subst:uw-mislead2" },
					"3": { exists: true, template: "subst:uw-mislead3" },
					"4": { exists: false, template: "subst:uw-generic4", additional: "''Stop using misleading edit summaries on your edits.''" },
					"4im": null
				},
				onlyWarn: true,
			},
			{
				title: "Inappropriate",
				summary: "inappropriate [[WP:ES|edit summary]]",
				description: "Edit summaries that appear to not be appropriate, civil, or otherwise constructive.",
				icon: "fas fa-exclamation-circle",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-bes1" },
					"2": { exists: true, template: "subst:uw-bes2" },
					"3": { exists: true, template: "subst:uw-bes3" },
					"4": { exists: true, template: "subst:uw-bes4" },
					"4im": { exists: true, template: "subst:uw-bes4im" },
				},
				onlyWarn: true,
			},
			{
				title: "Minor edit",
				summary: "improper use of [[WP:ME|minor edit]] checkbox",
				description: "Non-minor edit marked as minor",
				icon: "fas fa-pen",
				auto: () => "0",
				templates: {
					"0": { exists: true, template: "subst:uw-minor" },
					"1": null,
					"2": null,
					"3": null,
					"4": null,
					"4im": null
				},
				onlyWarn: true,
			}
		],
		"Behavior": [
			{
				title: "Conflict of interest",
				summary: "[[WP:COI|conflict of interest]]",
				description: "Edits or username suggest an external relationship with the article.",
				icon: "fas fa-user-tie",
				auto: () => "0",
				templates: {
					"0": { exists: true, template: "subst:uw-coi", label: "Notice" },
					"1": { exists: true, template: "subst:uw-coi-username", label: "Username" },
					"2": null,
					"3": null,
					"4": { exists: true, template: "subst:uw-coi-warn", label: "Warn" },
					"4im": null
				},
				onlyWarn: true,
			},
			{
				title: "Gaming the system",
				summary: "[[WP:GAME|gaming the system]]",
				description: "Deliberately made edits to game Wikipedia's policies.",
				icon: "fas fa-chess-knight",
				auto: defaultAuto,
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-gaming1" },
					"2": { exists: true, template: "subst:uw-gaming2" },
					"3": { exists: true, template: "subst:uw-gaming3" },
					"4": { exists: true, template: "subst:uw-gaming4" },
					"4im": { exists: true, template: "subst:uw-gaming4im" }
				},
				onlyWarn: true,
			},
			{
				title: "Edit Warring",
				summary: "[[WP:EW|edit warring]]",
				description: "User is edit warring.",
				icon: "fas fa-people-arrows",
				auto: (edit) => edit?.user?.editCount < 500 ? "1" : "4",
				templates: {
					"0": null,
					"1": { exists: true, template: "subst:uw-ewsoft", label: "Soft" },
					"2": null,
					"3": null,
					"4": { exists: true, template: "subst:uw-ew", label: "Normal" },
					"4im": null
				},
				onlyWarn: true,
			},
			{
				title: "Not English",
				summary: "non-English",
				description: "Content added in a language other than English.",
				icon: "fas fa-globe",
				auto: () => "0",
				templates: {
					"0": { exists: true, template: "subst:uw-lang-noteng" },
					"1": null,
					"2": null,
					"3": null,
					"4": null,
					"4im": null
				},
				onlyWarn: true,
			},
		],
	}
};

const lookup = {};
for (const [ type, categories ] of Object.entries(warnings)) {
	for (const [ category, categoryWarnings ] of Object.entries(categories)) {
		const length = categoryWarnings.length;
		for (let i = 0; i < length; i++) {
			lookup[categoryWarnings[i].title] = [ type, category, i ];
		}
	}
}

export const warningsLookup = lookup;

export function getWarningFromLookup(title) {
	if (!(title in warningsLookup)) {
		return undefined;
	}

	const path = warningsLookup[title];
	return path.reduce((obj, key) => obj[key], warnings);
}
