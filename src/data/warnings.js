// Warning templates and colors

export const warningTemplateColors = {
	"0": "grey",
	"1": "#4169e1",
	"2": "#ff8c00",
	"3": "#ff4500",
	"4": "#b22222",
	"4im": "#000000"
};

export const warnings = {
	"Vandalism": {
		templates: [
			"subst:uw-vandalism1",
			"subst:uw-vandalism2",
			"subst:uw-vandalism3",
			"subst:uw-vandalism4",
			"subst:uw-vandalism4im"
		],
		label: "vandalism",
		desc: "Default warning for vandalism."
	},
	"Subtle vandalism": {
		templates: [
			"subst:uw-subtle1",
			"subst:uw-subtle2",
			"subst:uw-subtle3",
			"subst:uw-subtle4"
		],
		label: "subtle vandalism",
		desc: "Warning for subtle vandalism that may not be immediately obvious."
	},
	"AI-generated content": {
		templates: [
			"subst:uw-ai1",
			"subst:uw-ai2",
			"subst:uw-ai3",
			"subst:uw-ai4"
		],
		label: "adding [[WP:AIGEN|AI-generated content]]",
		desc: "Warning for adding AI-generated content without disclosure."
	},
	"Disruption": {
		templates: [
			"subst:uw-disruptive1",
			"subst:uw-disruptive2",
			"subst:uw-disruptive3",
			"subst:uw-generic4"
		],
		label: "[[WP:DE|disruptive editing]]",
		desc: "Default warning for making disruptive edits (not always vandalism)"
	},
	"Deleting": {
		templates: [
			"subst:uw-delete1",
			"subst:uw-delete2",
			"subst:uw-delete3",
			"subst:uw-delete4",
			"subst:uw-delete4im"
		],
		label: "unexplained deletion",
		desc: "Used when a user does not explain deletion of part of an article."
	},
	"Advertising": {
		templates: [
			"subst:uw-advert1",
			"subst:uw-advert2",
			"subst:uw-advert3",
			"subst:uw-advert4",
			"subst:uw-advert4im"
		],
		label: "[[WP:PROMO|advertising or promotion]]",
		desc: "Adding promotional content to an article."
	},
	"Spam links": {
		templates: [
			"subst:uw-spam1",
			"subst:uw-spam2",
			"subst:uw-spam3",
			"subst:uw-spam4",
			"subst:uw-spam4im"
		],
		label: "adding [[WP:ELNO|inappropriate links]]",
		desc: "Adding external links that could be considered spam."
	},
	"Unsourced": {
		templates: [
			"subst:uw-unsourced1",
			"subst:uw-unsourced2",
			"subst:uw-unsourced3",
			"subst:uw-unsourced4"
		],
		label: "adding [[WP:CITE|unsourced content]]",
		desc: "Adding unsourced, possibly defamatory, content to an article."
	},
	"Unsourced (BLP)": {
		templates: [
			"subst:uw-biog1",
			"subst:uw-biog2",
			"subst:uw-biog3",
			"subst:uw-biog4",
			"subst:uw-biog4im"
		],
		label: "adding unsourced content to [[WP:BLP|biographies of living persons]]",
		desc: "Adding unsourced content to biographies of living persons."
	},
	"Editing tests": {
		templates: [
			"subst:uw-test1",
			"subst:uw-test2",
			"subst:uw-test3",
			"subst:uw-vandalism4"
		],
		label: "making editing tests",
		desc: "Making editing tests to articles."
	},
	"Commentary": {
		templates: [
			"subst:uw-talkinarticle1",
			"subst:uw-talkinarticle2",
			"subst:uw-talkinarticle3",
			"subst:uw-generic4"
		],
		label: "adding commentary",
		desc: "Adding opinion or commentary to articles."
	},
	"POV": {
		templates: [
			"subst:uw-npov1",
			"subst:uw-npov2",
			"subst:uw-npov3",
			"subst:uw-npov4"
		],
		label: "adding [[WP:NPOV|non-neutral content]]",
		desc: "Adding content which violates the neutral point of view policy."
	},
	"Errors": {
		templates: [
			"subst:uw-error1",
			"subst:uw-error2",
			"subst:uw-error3",
			"subst:uw-error4"
		],
		label: "adding deliberate errors to articles",
		desc: "Adding deliberate errors to articles."
	},
	"Owning": {
		templates: [
			"subst:uw-own1",
			"subst:uw-own2",
			"subst:uw-own3",
			"subst:uw-own4"
		],
		label: "assuming [[WP:OWN|ownership of articles]]",
		desc: "Assuming ownership of articles."
	},
	"Chatting": {
		templates: [
			"subst:uw-chat1",
			"subst:uw-chat2",
			"subst:uw-chat3",
			"subst:uw-chat4"
		],
		label: "conversation in article talk space",
		desc: "Using article talk pages for inappropriate discussion."
	},
	"Image vandalism": {
		templates: [
			"subst:uw-image1",
			"subst:uw-image2",
			"subst:uw-image3",
			"subst:uw-image4"
		],
		label: "image vandalism",
		desc: "Image vandalism."
	},
	"AfD removal": {
		templates: [
			"subst:uw-afd1",
			"subst:uw-afd2",
			"subst:uw-afd3",
			"subst:uw-afd4"
		],
		label: "removing AfD templates or comments",
		desc: "Removing AfD templates or other users' comments from AfD discussions."
	},
	"Jokes": {
		templates: [
			"subst:uw-joke1",
			"subst:uw-joke2",
			"subst:uw-joke3",
			"subst:uw-joke4",
			"subst:uw-joke4im"
		],
		label: "adding inappropriate humor",
		desc: "Adding inappropriate humor to articles."
	},
	"Personal attacks": {
		templates: [
			"subst:uw-npa1",
			"subst:uw-npa2",
			"subst:uw-npa3",
			"subst:uw-npa4",
			"subst:uw-npa4im"
		],
		label: "[[WP:NPA|personal attacks]]",
		desc: "Personal attacks towards another user."
	},
	"MOS violation": {
		templates: [
			"subst:uw-mos1",
			"subst:uw-mos2",
			"subst:uw-mos3",
			"subst:uw-mos4"
		],
		label: "[[WP:MOS|manual of style]] violation",
		desc: "Not following the Manual of Style."
	},
	"Censoring": {
		templates: [
			"subst:uw-notcensored1",
			"subst:uw-notcensored2",
			"subst:uw-notcensored3",
			"subst-uw-generic4"
		],
		label: "[[WP:NOTCENSORED|Censoring content]]",
		desc: "Censoring topically-relevant content."
	}
};

