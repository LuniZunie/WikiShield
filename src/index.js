// <nowiki>
import { subdomains } from './data/wikis';
import { fullTrim } from './helpers/helpers';

{
	"use strict";


	

	/**
	 * Generate prompt for username analysis
	 * @param {Object} edit The edit object to analize
	 * @returns {String} The prompt for analysis
	 */
	const BuildAIAnalysisPrompt = (edit) => {
		const diffHTML = edit.diff;
		const sizediff = edit.sizediff || 0;
		const oresScore = edit.ores || 0;
		const pageTitle = edit.page?.title || 'Unknown';
		const userEditCount = edit.user?.editCount || 0;
		const warningLevel = edit.user?.warningLevel || '0';
		const userName = edit.user?.name || 'Unknown';
		const summary = edit.comment || 'No summary';
		const isTempUser = mw.util.isTemporaryUser(userName);

		// Determine namespace
		let namespace = "Main";
		let namespaceGuidance = "Main article namespace - STRICT standards. Accuracy, neutrality, verifiability required. Catch vandalism and policy violations.";

		if (pageTitle.includes(':')) {
			const prefix = pageTitle.split(':')[0];
			const namespaceMap = {
				'Talk': 'Talk',
				'User': 'User',
				'User talk': 'User talk',
				'Wikipedia': 'Project',
				'Wikipedia talk': 'Project talk',
				'File': 'File',
				'File talk': 'File talk',
				'Template': 'Template',
				'Template talk': 'Template talk',
				'Category': 'Category',
				'Category talk': 'Category talk',
				'Draft': 'Draft',
				'Draft talk': 'Draft talk',
				'Help': 'Help',
				'Portal': 'Portal'
			};
			namespace = namespaceMap[prefix] || prefix;

			// Provide namespace-specific guidance
			const guidanceMap = {
				'Talk': "Discussion/conversation page - VERY LENIENT. Opinions and debates are normal and expected. Only flag offensive/attack content.",
				'User': "User's personal sandbox - EXTREMELY LENIENT. Users can experiment here. Only flag severe policy violations or attack pages.",
				'User talk': "User communication page - VERY LENIENT. Direct messages to users. Only flag if attacking/harassing.",
				'Project': "Wikipedia policy/guideline space - MODERATE. Discussion and proposals are normal. Check for disruption.",
				'Project talk': "Project discussion page - VERY LENIENT. Policy debates happen here. Opinions expected.",
				'Draft': "Draft article space - LENIENT. Work in progress. Missing sources and formatting issues are NORMAL and ACCEPTABLE. Only flag clear vandalism.",
				'Draft talk': "Draft discussion page - VERY LENIENT. Feedback and questions are normal.",
				'File': "File description pages - MODERATE. Check for copyright issues and appropriate descriptions.",
				'File talk': "File discussion page - VERY LENIENT. Questions and discussions are normal.",
				'Template': "Template pages - MODERATE. Technical pages. Check for vandalism breaking functionality.",
				'Template talk': "Template discussion page - VERY LENIENT. Technical discussions are normal.",
				'Category': "Category pages - MODERATE. Check for inappropriate categorization.",
				'Category talk': "Category discussion page - VERY LENIENT. Discussions are normal."
			};
			namespaceGuidance = guidanceMap[namespace] || namespaceGuidance;
		}

		// Special check for sandbox pages
		if (pageTitle.toLowerCase().includes('/sandbox') || pageTitle.toLowerCase().endsWith(":sandbox")) {
			namespaceGuidance = "User sandbox - MAXIMUM LENIENCY. Test/practice space. Experiments and incomplete content are EXPECTED and FINE. Almost always approve.";
		}

		// Convert HTML diff to readable text
		const readableDiff = wikishield.ollamaAI.convertDiffToReadable(diffHTML);

		// Determine user experience level and risk profile
		let userProfile = "";
		if (isTempUser) {
			userProfile = "Anonymous temporary editor - could be anyone. Temporary accounts have higher vandalism rates but many make good edits. Judge the edit, not the editor.";
		} else if (userEditCount === 0) {
			userProfile = "Brand new account (0 edits) - First ever edit. Could be legitimate new user or sockpuppet/vandal. Higher scrutiny needed.";
		} else if (userEditCount < 10) {
			userProfile = "Very new user (< 10 edits) - Still learning. Expect mistakes but assume good faith unless clearly malicious.";
		} else if (userEditCount < 50) {
			userProfile = "New user (< 50 edits) - Gaining experience. Minor errors expected, likely good faith.";
		} else if (userEditCount < 500) {
			userProfile = "Intermediate user (50-500 edits) - Should understand basic policies. Mistakes possible but less common.";
		} else {
			userProfile = "Experienced user (500+ edits) - Knows Wikipedia policies well. Trust their judgment unless clearly problematic.";
		}

		// Warning level context
		let warningContext = "";
		switch (warningLevel) {
			case '0':
				warningContext = "No previous warnings - Clean record. First problematic edit (if any).";
				break;
			case '1':
				warningContext = "Warning level 1 - Minor previous issue. They've been notified once. Still assume good faith.";
				break;
			case '2':
				warningContext = "Warning level 2 - Has been warned twice. Pattern may be emerging. Less benefit of doubt.";
				break;
			case '3':
				warningContext = "Warning level 3 - Serious warnings given. Next vandalism = likely block. Watch closely.";
				break;
			case '4':
			case '4im':
				warningContext = "Warning level 4/4im - FINAL WARNING given. Any further vandalism should result in AIV report.";
				break;
			default:
				warningContext = `Warning level ${warningLevel} - Has received warnings previously.`;
		}

		return fullTrim(`
			You are an expert Wikipedia anti-vandalism reviewer. Analyze the provided edit decisively and produce a single JSON verdict (see schema at end). Be fast, precise, and conservative only when required. Default to APPROVE unless clear evidence of vandalism, policy violation, or harmful material appears.

			════════════════════════════════════════════════════════════════
			EDIT METADATA (inputs)
			════════════════════════════════════════════════════════════════
			Page:         "${pageTitle}"
			Namespace:    ${namespace}  — ${namespaceGuidance}
			Page title:   "${pageTitle}"
			Editor:       ${userName}${isTempUser ? " (TEMPORARY)" : ""} • ${userEditCount} edits
			User profile: ${userProfile}
			Summary:      "${summary}"
			Size change:  ${sizediff > 0 ? "+" : ""}${sizediff} bytes
			ORES score:   ${(oresScore * 100).toFixed(1)}%
			Readable diff:
			${readableDiff}

			If namespace is a talk, user, draft, or sandbox page, treat missing citations and opinion as acceptable. Flag only attacks, harassment, spam, or clear disruption on those pages.

			════════════════════════════════════════════════════════════════
			QUICK DECEPTIVE-SUMMARY CHECK
			════════════════════════════════════════════════════════════════
			Compare edit summary to byte delta. Treat large mismatches as red flags:
			• "typo/spelling/grammar" ≈ 5–20 bytes. Not 100+.
			• "nothing/minor/fix" should be tiny. Not 200+.
			• "punctuation/comma" < 50 bytes.
			• "formatting" < 500 bytes.
			If mismatch → treat as potential deception and escalate severity. (such as "fixed typo" but then adds new information)

			════════════════════════════════════════════════════════════════
			DIFF LEGEND
			════════════════════════════════════════════════════════════════
			"  " = unchanged context
			"- " = removed
			"+ " = added
			[[text]] = inline addition
			~~text~~ = inline removal

			════════════════════════════════════════════════════════════════
			DECISIVE RULES (apply in this order)
			════════════════════════════════════════════════════════════════

			1) Namespace rules (highest priority)
			- Main/article namespace: enforce strict standards (vandalism, unsourced BLP claims, POV).
			- Talk/User/Sandbox/Draft: extremely lenient for sourcing. Only flag attacks, harassment, spam, or clear disruption.

			2) Obvious vandalism → immediate rollback
			Rollback when any of:
			- Profanity or slurs.
			- Gibberish or repeated nonsense ("asdfgh", "lololol").
			- Graffiti signatures ("X was here").
			- Blank/erase content without reason.
			- Obvious jokes, memes, or patently false claims.
			- Summary explicitly says "test" or "vandalism".
			- Deceptive summary that masks a large change.

			3) Not vandalism (do not flag)
			- Poor grammar or style.
			- Unsourced but plausible claims (except BLP on main namespace).
			- Formatting fixes and rewording.
			- Minor POV or pushing a viewpoint without clear policy violation.
			- Any constructive edit on talk/user/sandbox/draft pages unless harassment or spam.

			4) Constructive signals (favor APPROVE)
			• Fixes to grammar, formatting, or readability.
			• Adding information that appears relevant.
			• Removing clear error or vandalism.
			• Detailed, honest edit summary.

			════════════════════════════════════════════════════════════════
			ACTIONS (use one)
			════════════════════════════════════════════════════════════════
			- approve: Default. Use for constructive or harmless edits.
			- thank: Exceptional contribution (added sources, major improvement).
			- welcome: New user (<50 edits) who made a good contribution.
			- warn-and-revert: Policy violation but possibly good faith (e.g., unsourced BLP, promotional content).
			- rollback: Definite vandalism (profanity, blanking, gibberish).
			- report-aiv: Serious malicious pattern or sustained bad actor (admin report needed).
			- review: Rare (<3%). Only when evaluation is truly impossible from the diff.

			Guideline: 85–90% of edits should be APPROVE. Use REVIEW under 3% of the time. When uncertain, APPROVE.

			════════════════════════════════════════════════════════════════
			EVIDENCE & REASONING
			════════════════════════════════════════════════════════════════
			When you flag or choose a non-approve action:
			• Quote the exact problematic text from the diff.
			• State the rule and namespace that justify the action.
			• Provide a concise one-sentence remediation recommendation (e.g., "Revert and warn; unsourced BLP on main page. Provide reliable references before re-adding.").

			════════════════════════════════════════════════════════════════
			RESPONSE FORMAT (strict JSON only)
			════════════════════════════════════════════════════════════════
			Return exactly one JSON object with these fields:

			{
			"hasIssues": boolean,
			"probability": 0-100,
			"confidence": "high" | "medium" | "low",
			"reasoning": "Concise statement of why",
			"issues": [
				{
				"type": "vandalism|spam|pov|unsourced|attack|copyright|disruptive|factual-error|policy|username",
				"severity": "critical|major|minor",
				"description": "Quoted evidence and brief note"
				}
			],
			"constructive": boolean,
			"summary": "One-sentence final assessment",
			"action": "approve|thank|review|warn-and-revert|rollback|report-aiv|welcome",
			"recommendation": "One-line explaining chosen action and next steps"
			}

			════════════════════════════════════════════════════════════════
			PERFORMANCE NOTES
			════════════════════════════════════════════════════════════════
			• Be decisive. Short, specific reasoning only.
			• Do not invent external facts. Judge only by the diff, metadata, and provided context.
			• If a claim requires external verification but is not obviously harmful, APPROVE.
			• Use "review" only when the diff cannot be judged at all from available inputs.

			Analyze now and return the JSON verdict.
		`);
	};

	/**
	 * Generate prompt for username analysis
	 * @param {String} username The username to analyze
	 * @param {String} pageTitle The page the user was editing
	 * @returns {String} The prompt for username analysis
	 */
	const BuildAIUsernamePrompt = (username, pageTitle) => {
		return fullTrim(`
			You are analyzing a Wikipedia username to determine if it violates Wikipedia's username policy.

			━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
			USERNAME TO ANALYZE
			━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

			Username: ${username}
			Currently editing: ${pageTitle}
			→ The page title should ONLY be taken onto account to detect promotional edits.

			━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
			WIKIPEDIA USERNAME POLICY
			━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

			VIOLATIONS TO FLAG:

			1. PROMOTIONAL/ADVERTISING
			• Company/organization names (e.g., "AppleInc", "CocaCola")
			• Product/brand names (e.g., "iPhone15Pro", "TeslaModelS")
			• Website/domain names (e.g., "ExampleDotCom", "MyWebsite123")
			• Commercial slogans or marketing language
			• Exception: Personal names that happen to match brands are usually OK

			2. IMPERSONATION
			• Claiming to be a famous person (e.g., "RealTaylorSwift", "ElonMusk")
			• Pretending to be a Wikipedia admin/official (e.g., "WikipediaAdmin")
			• Using "official" or "real" prefixes to imply authority
			• Exception: Obviously fictional/parody names are usually OK

			3. OFFENSIVE/INAPPROPRIATE
			• Profanity, slurs, or vulgar language
			• Sexual/explicit content in username
			• Hateful or discriminatory language
			• Attack usernames targeting individuals

			4. SHARED/ROLE ACCOUNTS
			• Implies multiple people (e.g., "MarketingTeam", "CompanyStaff")
			• Organization/group accounts

			ACCEPTABLE USERNAMES:

			✓ Personal names (even if unusual): "John Smith", "StardustDreamer"
			✓ Random/creative combinations: "PurpleCat42", "MountainReader"
			✓ Descriptive interests: "HistoryBuff", "ScienceFan2023"
			✓ Misspellings or variations of common words
			✓ Foreign language names/words (unless offensive)
			✓ Numbers and dates (birthdates, lucky numbers, etc.)

			━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
			ANALYSIS GUIDELINES
			━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

			BE CONSERVATIVE: When in doubt, DON'T flag
			• Most usernames are acceptable
			• Only flag clear violations
			• Consider context (editing relevant articles is OK)
			• Personal names that match brands are usually fine

			CONFIDENCE LEVELS:
			• 0.9-1.0: Obvious violation (company name, clear impersonation)
			• 0.7-0.9: Strong indicators (promotional with editing pattern)
			• 0.5-0.7: Moderate concern (borderline case)
			• 0.0-0.5: Acceptable or insufficient evidence

			CONTEXT MATTERS:
			• User editing related articles? (e.g., "AppleFan" editing Apple Inc.)
			• Username could be personal name? (e.g., "Jordan" is a name AND brand)
			• Is it obviously parody/fictional?

			═══════════════════════════════════════════════════════════
			RESPONSE FORMAT (JSON)
			═══════════════════════════════════════════════════════════

			{
				"shouldFlag": boolean,
				"confidence": 0.0-1.0,
				"violationType": "promotional|impersonation|offensive|confusing|shared|none",
				"reasoning": "Specific explanation of why username violates or doesn't violate policy",
				"recommendation": "Brief recommendation for action or why it's acceptable"
			}

			Analyze the username now. Be conservative and consider context.
		`);
	};


	const __script__ = {
		version: "1.0.0",

		changelog: {
			version: "1",
			HTML: `<h1 class="settings-section-title">Changelog</h1>
			<p>In development</p>`
		},

		pages: {
			AVI: "Wikipedia:Administrator intervention against vandalism",
			UAA: "Wikipedia:Usernames for administrator attention",
			RFPP: "Wikipedia:Requests for page protection/Increase"
		},

		config: {
			refresh: 1000,
			historyCount: 10,
		}
	};

	const wikishieldData = {
		defaultSettings: {
			maxQueueSize: 50,
			maxEditCount: 50,
			minimumORESScore: 0,
			soundAlertORESScore: 0.95,
			enableSoundAlerts: false,

            enableUsernameHighlighting: true,
            enableWelcomeLatin: false,
			enableAutoWelcome: false,
			enableEditAnalysis: false,
			enableUsernameAnalysis: false,

			masterVolume: 0.5,
			volumes: {
				click: 0.5,
				notification: 0.5,
				alert: 0.5,
				whoosh: 0.5,
				warn: 0.5,
				rollback: 0.5,
				report: 0.5,
				thank: 0.5,
				protection: 0.5,
				block: 0.5,
				sparkle: 0.5
			},
			soundMappings: {
				click: 'click',
				notification: 'notify',
				alert: 'alert',
				whoosh: 'whoosh',
				warn: 'warn',
				rollback: 'rollback',
				report: 'report',
				thank: 'thank',
				protection: 'protection',
				block: 'block',
				sparkle: 'sparkle'
			},
			watchlistExpiry: "1 week",
			highlightedExpiry: "1 hour",
			wiki: "en",
			namespacesShown: [
				0, 2, 4, 6, 8, 10, 12, 14, 100, 118,
				1, 3, 5, 7, 9, 11, 13, 15, 101, 119
			],
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
							name: "rollbackAndWarn",
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
							name: "highlight",
							params: {}
						},
						{
							name: "nextEdit",
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
								template: "default"
							}
						}
					]
				}
			],
			selectedPalette: 0,
			theme: "theme-light"
		},
		warningTemplateColors: {
			"0": "grey",
			"1": "#4169e1",
			"2": "#ff8c00",
			"3": "#ff4500",
			"4": "#b22222",
			"4im": "#000000"
		},
		colorPalettes: [
			["#78c675", "#fdff7a", "#fcff54", "#fbff12", "#ffc619", "#ff8812", "#f56214", "#f73214", "#fc0303", "#fc0303"],
			["#bfbfbf", "#ffd9d9", "#ffc9c9", "#ffb0b0", "#ff9797", "#ff7d7d", "#ff6464", "#ff4b4b", "#ff3131", "#ff1818"],
			["#bfbfbf", "#d9ffd9", "#c9ffc9", "#b0ffb0", "#97ff97", "#7dff7d", "#64ff64", "#4bff4b", "#31ff31", "#18ff18"],
			["#bfbfbf", "#d9d9ff", "#c9c9ff", "#b0b0ff", "#9797ff", "#7d7dff", "#6464ff", "#4b4bff", "#3131ff", "#1818ff"]
		],
		warnings: {
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
		},
		namespaces: [
			{
				name: "Main",
				id: 0
			},
			{
				name: "User",
				id: 2
			},
			{
				name: "Project",
				id: 4
			},
			{
				name: "File",
				id: 6
			},
			{
				name: "MediaWiki",
				id: 8
			},
			{
				name: "Template",
				id: 10
			},
			{
				name: "Help",
				id: 12
			},
			{
				name: "Category",
				id: 14
			},
			{
				name: "Portal",
				id: 100
			},
			{
				name: "Draft",
				id: 118
			},
			{
				name: "Talk",
				id: 1
			},
			{
				name: "User talk",
				id: 3
			},
			{
				name: "Project talk",
				id: 5
			},
			{
				name: "File talk",
				id: 7
			},
			{
				name: "MediaWiki talk",
				id: 9
			},
			{
				name: "Template talk",
				id: 11
			},
			{
				name: "Help talk",
				id: 13
			},
			{
				name: "Category talk",
				id: 15
			},
			{
				name: "Portal talk",
				id: 101
			},
			{
				name: "Draft talk",
				id: 119
			}
		],

		/**
		 * Sound definitions with their audio properties
		 * Redesigned with professional quality sounds using musical intervals and smooth envelopes
		 */
		sounds: {
		// UI sounds - Subtle, non-intrusive clicks and taps
			click: {
				name: "Click",
				description: "Crisp UI click",
				category: "ui",
				type: 'sine',
				frequencies: [600],
				duration: 0.15,
				volume: 1,
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.06);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.15);
				}
			},
			tap: {
				name: "Tap",
				description: "Soft tap",
				category: "ui",
				type: 'sine',
				frequencies: [440],
				duration: 0.15,
				volume: 1,
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.06);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.15);
				}
			},
			pop: {
				name: "Pop",
				description: "Bouncy pop",
				category: "ui",
				type: 'sine',
				frequencies: [660, 528], // E5 to C5
				duration: 0.2,
				volume: 1,
				repeats: [0, 0.1],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.2);
				}
			},

			// alert sounds - Attention-grabbing but not harsh
			alert: {
				name: "Alert",
				description: "Urgent notification",
				category: "alert",
				type: 'sine',
				frequencies: [440, 523.25], // A4 to C5 (major third)
				duration: 0.15,
                volume: 1,
                repeats: [0, 0.18],
                envelope: (gain, ctx, start, vol) => {
                    gain.gain.setValueAtTime(0.001 * vol, start);
                    gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.3);
                }
            },
            bell: {
                name: "Bell",
                description: "Notification bell",
                category: "alert",
                type: 'sine',
				frequencies: [523.25, 659.25], // C5 to E5 (major third)
				duration: 0.35,
				volume: 1,
				repeats: [0, 0.18],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.8 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.35);
				}
			},
			ping: {
				name: "Ping",
				description: "High ping",
				category: "alert",
				type: 'sine',
				frequencies: [784], // G5
				duration: 0.3,
				volume: 1,
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.3);
				}
			},

			// warning sounds - More serious but still musical
			warn: {
				name: "Warning",
				description: "Caution tone",
				category: "warning",
				type: 'sine',
				frequencies: [587.33, 523.25], // D5 to C5 (minor second down)
				duration: 0.18,
				volume: 1,
				repeats: [0, 0.2],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.18);
				}
			},
			beep: {
				name: "Beep",
				description: "Simple beep",
				category: "warning",
				type: 'sine',
				frequencies: [784], // G5
				duration: 0.12,
				volume: 1,
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.12);
				}
			},
			buzz: {
				name: "Buzz",
				description: "Attention buzz",
				category: "warning",
				type: 'sine',
				frequencies: [440], // A4
				duration: 0.15,
				volume: 1,
				repeats: [0, 0.08, 0.16],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.05);
				}
			},

			// ACTION SOUNDS - Smooth transitions and movements
			whoosh: {
				name: "Whoosh",
				description: "Smooth transition",
				category: "action",
				type: 'sine',
				frequencies: [600],
				duration: 0.25,
				volume: 1,
				sweep: { from: 600, to: 250 },
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.8 * vol, start + 0.04);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.25);
				}
			},
			swoosh: {
				name: "Swoosh",
				description: "Quick swipe",
				category: "action",
				type: 'sine',
				frequencies: [800],
				duration: 0.18,
				volume: 1,
				sweep: { from: 800, to: 400 },
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.18);
				}
			},
			swipe: {
				name: "Swipe",
				description: "Fast swipe",
				category: "action",
				type: 'sine',
				frequencies: [750],
				duration: 0.12,
				volume: 1,
				sweep: { from: 750, to: 400 },
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.5 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.12);
				}
			},
			rollback: {
				name: "Rollback",
				description: "Reverse action",
				category: "action",
				type: 'sine',
				frequencies: [400],
				duration: 0.22,
				volume: 1,
				sweep: { from: 400, to: 800 },
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.65 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.22);
				}
			},

			// notification sounds - Pleasant and informative
			notify: {
				name: "Notify",
				description: "Soft notification",
				category: "notification",
				type: 'sine',
				frequencies: [523.25, 392], // C5 to G4
				duration: 0.2,
				volume: 1,
				repeats: [0, 0.12],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.8 * vol, start + 0.02);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.2);
				}
			},
			chime: {
				name: "Chime",
				description: "Pleasant chime",
				category: "notification",
				type: 'sine',
				frequencies: [523.25, 659.25, 783.99], // C5-E5-G5 (C major chord)
				duration: 0.3,
				volume: 1,
				repeats: [0, 0.08, 0.16],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.3);
				}
			},
			ding: {
				name: "Ding",
				description: "Gentle ding",
				category: "notification",
				type: 'sine',
				frequencies: [523.25], // C5
				duration: 0.28,
				volume: 1,
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.28);
				}
			},

			// positive sounds - Success and achievements
			success: {
				name: "Success",
				description: "Achievement",
				category: "positive",
				type: 'sine',
				frequencies: [523.25, 659.25, 783.99, 523.25], // C5-E5-G5-C5 arpeggio
				duration: 0.18,
				volume: 1,
				repeats: [0, 0.06, 0.12, 0.18],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.25);
				}
			},
			complete: {
				name: "Complete",
				description: "Task complete",
				category: "positive",
				type: 'sine',
				frequencies: [659.25, 440, 659.25], // E5-A4-E5 (fifth)
				duration: 0.25,
				volume: 1,
				repeats: [0, 0.08, 0.16],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.65 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.28);
				}
			},
			sparkle: {
				name: "Sparkle",
				description: "Magical sparkle",
				category: "positive",
				type: 'sine',
				frequencies: [659.25, 784, 988, 1175], // E5-G5-B5-D6
				duration: 0.15,
				volume: 1,
				repeats: [0, 0.04, 0.08, 0.12],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.12);
				}
			},
			twinkle: {
				name: "Twinkle",
				description: "Soft twinkle",
				category: "positive",
				type: 'sine',
				frequencies: [784, 1047, 1319], // G5-C6-E6
				duration: 0.2,
				volume: 1,
				repeats: [0, 0.07, 0.14],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.18);
				}
			},

			// negative sounds - Errors and blocks
			error: {
				name: "Error",
				description: "Error tone",
				category: "negative",
				type: 'sine',
				frequencies: [392], // G4
				duration: 0.25,
				volume: 1,
				sweep: { from: 392, to: 294 }, // G4 to D4 (tritone, dissonant)
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.25);
				}
			},
			denied: {
				name: "Denied",
				description: "Access denied",
				category: "negative",
				type: 'sine',
				frequencies: [330, 311], // E4 to Eb4 (semitone)
				duration: 0.2,
				volume: 1,
				repeats: [0, 0.12],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.18);
				}
			},
			thud: {
				name: "Thud",
				description: "Heavy thud",
				category: "negative",
				type: 'sine',
				frequencies: [165], // E3
				duration: 0.18,
				volume: 1,
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.8 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.25);
				}
			},

			// special sounds
			report: {
				name: "Report",
				description: "Report sent",
				category: "notification",
				type: 'sine',
				frequencies: [587.33, 698.46, 880], // D5-F5-A5
				duration: 0.16,
				volume: 1,
				repeats: [0, 0.08, 0.16],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.65 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.2);
				}
			},
			thank: {
				name: "Thank",
				description: "Thank you",
				category: "positive",
				type: 'sine',
				frequencies: [523.25, 659.25], // C5 to E5 (major third)
				duration: 0.3,
				volume: 1,
				repeats: [0, 0.15],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.3);
				}
			},
			protection: {
				name: "Protection",
				description: "Shield up",
				category: "action",
				type: 'sine',
				frequencies: [440, 554, 659], // A4-C#5-E5 (A major chord)
				duration: 0.3,
				volume: 1,
				repeats: [0, 0.1, 0.2],
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.04);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.25);
				}
			},
			block: {
				name: "Block",
				description: "Blocked",
				category: "negative",
				type: 'sine',
				frequencies: [220], // A3
				duration: 0.2,
				volume: 1,
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0.001 * vol, start);
					gain.gain.exponentialRampToValueAtTime(0.8 * vol, start + 0.08);
					gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.2);
				}
			},

			// silent option
			none: {
				name: "None (Silent)",
				description: "No sound",
				category: "other",
				type: 'sine',
				frequencies: [440],
				duration: 0.001,
				volume: 1,
				envelope: (gain, ctx, start, vol) => {
					gain.gain.setValueAtTime(0, start);
				}
			}
		}
	};

	const wikishieldStyling = {
		"base": `
			/* Base theme configuration */
			:root {
				/* Light theme colors */
				--light-bg-primary: #ffffff;
				--light-bg-secondary: #f8f9fa;
				--light-bg-tertiary: #f1f3f5;
				--light-bg-hover: #e2e8f0;
				--light-text-primary: #1a1a1a;
				--light-text-secondary: #4a5568;
				--light-border: #e2e8f0;
				--light-primary: #2962ff;
				--light-primary-hover: #1e88e5;
				--light-danger: #dc3545;
				--light-warning: #f59e0b;
				--light-success: #22c55e;
				--light-surface: #ffffff;
				--light-shadow: rgba(0, 0, 0, 0.1);
				--light-shadow-hover: rgba(0, 0, 0, 0.15);
				--light-highlight: rgba(41, 98, 255, 0.1);

				/* Dark theme colors */
				--dark-bg-primary: #1a1a1a;
				--dark-bg-secondary: #242424;
				--dark-bg-tertiary: #2d2d2d;
				--dark-bg-hover: #333333;
				--dark-text-primary: #f8f9fa;
				--dark-text-secondary: #a0aec0;
				--dark-border: #404040;
				--dark-primary: #60a5fa;
				--dark-primary-hover: #3b82f6;
				--dark-danger: #ef4444;
				--dark-warning: #f59e0b;
				--dark-success: #10b981;
				--dark-surface: #242424;
				--dark-shadow: rgba(0, 0, 0, 0.3);
				--dark-shadow-hover: rgba(0, 0, 0, 0.4);
				--dark-highlight: rgba(96, 165, 250, 0.15);

				/* Default fallback values (will be overridden by theme) */
				--bg-primary: var(--light-bg-primary);
				--bg-secondary: var(--light-bg-secondary);
				--bg-tertiary: var(--light-bg-tertiary);
				--bg-hover: var(--light-bg-hover);
				--text-primary: var(--light-text-primary);
				--text-secondary: var(--light-text-secondary);
				--border-color: var(--light-border);
				--primary: var(--light-primary);
				--primary-hover: var(--light-primary-hover);
				--danger: var(--light-danger);
				--warning: var(--light-warning);
				--success: var(--light-success);
				--surface: var(--light-surface);
				--shadow: var(--light-shadow);
				--shadow-hover: var(--light-shadow-hover);
				--highlight: var(--light-highlight);

				/* Animation durations */
				--transition-fast: 0.15s;
				--transition-normal: 0.25s;
				--transition-slow: 0.4s;

				/* Border radius */
				--radius-sm: 4px;
				--radius-md: 8px;
				--radius-lg: 12px;

				/* Spacing */
				--space-1: 4px;
				--space-2: 8px;
				--space-3: 12px;
				--space-4: 16px;
				--space-5: 20px;
				--space-6: 24px;

				/* Elevation shadows */
				--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
				--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
				--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
				--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
			}

			/* Base styles */
			* {
				margin: 0;
				padding: 0;
				box-sizing: border-box;
				transition: background-color var(--transition-normal),
							border-color var(--transition-normal),
							color var(--transition-normal),
							box-shadow var(--transition-normal),
							transform var(--transition-fast);
			}

			body {
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
				line-height: 1.5;
				-webkit-font-smoothing: antialiased;
				-moz-osx-font-smoothing: grayscale;
			}

			/* Interactive elements */
			button,
			.interactive {
				cursor: pointer;
				border-radius: var(--radius-md);
				border: 1px solid transparent;
				padding: var(--space-2) var(--space-4);
				font-weight: 500;
				transition: all var(--transition-normal);
			}

			button:hover,
			.interactive:hover {
				transform: translateY(-1px);
			}

			button:active,
			.interactive:active {
				transform: translateY(0);
			}

			/* Accessibility */
			button:focus-visible,
			a:focus-visible,
			input:focus-visible,
			select:focus-visible {
				outline: 2px solid var(--light-primary);
				outline-offset: 2px;
			}

			[data-theme="dark"] button:focus-visible,
			[data-theme="dark"] a:focus-visible,
			[data-theme="dark"] input:focus-visible,
			[data-theme="dark"] select:focus-visible {
				outline-color: var(--dark-primary);
			}

			/* Scrollbars */
			::-webkit-scrollbar {
				width: 10px;
				height: 10px;
			}

			::-webkit-scrollbar-track {
				background: transparent;
			}

			::-webkit-scrollbar-thumb {
				background: var(--light-border);
				border-radius: var(--radius-lg);
				border: 2px solid transparent;
				background-clip: content-box;
			}

			::-webkit-scrollbar-thumb:hover {
				background: var(--light-text-secondary);
				border: 2px solid transparent;
				background-clip: content-box;
			}

			[data-theme="dark"] ::-webkit-scrollbar-thumb {
				background: var(--dark-border);
			}

			[data-theme="dark"] ::-webkit-scrollbar-thumb:hover {
				background: var(--dark-text-secondary);
			}

			/* Floating iframe modal */
			.wiki-iframe-overlay {
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.6);
				backdrop-filter: blur(4px);
				-webkit-backdrop-filter: blur(4px);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 10000;
				animation: fadeIn 0.2s ease;
			}

			@keyframes fadeIn {
				from {
					opacity: 0;
				}
				to {
					opacity: 1;
				}
			}

			.wiki-iframe-container {
				width: 90%;
				height: 90%;
				max-width: 1400px;
				max-height: 900px;
				background: var(--bg-primary);
				border-radius: var(--radius-lg);
				box-shadow: var(--shadow-xl);
				display: flex;
				flex-direction: column;
				overflow: hidden;
				animation: slideUp 0.3s ease;
			}

			@keyframes slideUp {
				from {
					transform: translateY(20px);
					opacity: 0;
				}
				to {
					transform: translateY(0);
					opacity: 1;
				}
			}

			.wiki-iframe-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: var(--space-3) var(--space-4);
				background: var(--bg-secondary);
				border-bottom: 1px solid var(--border-color);
			}

			.wiki-iframe-title {
				font-weight: 600;
				color: var(--text-primary);
				font-size: 0.95rem;
				display: flex;
				align-items: center;
				gap: var(--space-2);
				flex: 1;
				min-width: 0;
			}

			.wiki-iframe-title-text {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.wiki-iframe-controls {
				display: flex;
				gap: var(--space-2);
			}

			.wiki-iframe-btn {
				padding: var(--space-2) var(--space-3);
				background: transparent;
				border: 1px solid var(--border-color);
				border-radius: var(--radius-md);
				cursor: pointer;
				color: var(--text-primary);
				font-size: 0.9rem;
				transition: all var(--transition-fast);
				display: flex;
				align-items: center;
				gap: var(--space-2);
			}

			.wiki-iframe-btn:hover {
				background: var(--bg-hover);
				border-color: var(--primary);
			}

			.wiki-iframe-btn.close-btn {
				color: var(--danger);
			}

			.wiki-iframe-btn.close-btn:hover {
				background: var(--danger);
				color: white;
				border-color: var(--danger);
			}

			.wiki-iframe-content {
				flex: 1;
				position: relative;
				overflow: hidden;
			}

			.wiki-iframe-content iframe {
				width: 100%;
				height: 100%;
				border: none;
			}

			.wiki-iframe-loading {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				color: var(--text-secondary);
				font-size: 0.95rem;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--space-3);
			}

			.wiki-iframe-spinner {
				width: 40px;
				height: 40px;
				border: 3px solid var(--border-color);
				border-top-color: var(--primary);
				border-radius: 50%;
				animation: spin 0.8s linear infinite;
			}

			@keyframes spin {
				to {
					transform: rotate(360deg);
				}
			}

			/* Dark mode specific overrides for iframe modal */
			[data-theme="dark"] .wiki-iframe-overlay {
				background: rgba(0, 0, 0, 0.8);
			}

			[data-theme="dark"] .wiki-iframe-container {
				background: var(--dark-bg-primary);
			}

			[data-theme="dark"] .wiki-iframe-header {
				background: var(--dark-bg-secondary);
				border-bottom-color: var(--dark-border);
			}

			[data-theme="dark"] .wiki-iframe-title {
				color: var(--dark-text-primary);
			}

			[data-theme="dark"] .wiki-iframe-btn {
				color: var(--dark-text-primary);
				border-color: var(--dark-border);
				background: transparent;
			}

			[data-theme="dark"] .wiki-iframe-btn:hover {
				background: var(--dark-bg-hover);
				border-color: var(--dark-primary);
			}

			[data-theme="dark"] .wiki-iframe-btn.close-btn {
				color: var(--dark-danger);
			}

			[data-theme="dark"] .wiki-iframe-btn.close-btn:hover {
				background: var(--dark-danger);
				color: white;
				border-color: var(--dark-danger);
			}

			[data-theme="dark"] .wiki-iframe-loading {
				color: var(--dark-text-secondary);
			}

			[data-theme="dark"] .wiki-iframe-spinner {
				border-color: var(--dark-border);
				border-top-color: var(--dark-primary);
			}
		`,
		"initial": `
			* {
				margin: 0;
				padding: 0;
				box-sizing: border-box;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			}

			body, html, #container {
				width: 100%;
				height: 100%;
				overflow: hidden;
			}

			#container {
				display: flex;
				align-items: center;
				justify-content: center;
				background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
				position: relative;
			}

			/* Animated dots canvas background */
			#dots-canvas {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				z-index: 0;
			}

			/* Animated background particles */
			#container::before {
				content: '';
				position: absolute;
				width: 200%;
				height: 200%;
				background:
					radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.15) 0%, transparent 50%),
					radial-gradient(circle at 80% 80%, rgba(240, 147, 251, 0.15) 0%, transparent 50%),
					radial-gradient(circle at 40% 20%, rgba(118, 75, 162, 0.1) 0%, transparent 50%);
				animation: particles 20s ease-in-out infinite;
				z-index: 1;
			}

			@keyframes particles {
				0%, 100% {
					transform: translate(0, 0) rotate(0deg);
				}
				33% {
					transform: translate(30px, -30px) rotate(120deg);
				}
				66% {
					transform: translate(-20px, 20px) rotate(240deg);
				}
			}

			#welcome-container {
				position: relative;
				z-index: 1;
				text-align: center;
				padding: 60px;
				background: linear-gradient(135deg, rgba(15, 12, 41, 0.8), rgba(48, 43, 99, 0.8));
				backdrop-filter: blur(20px);
				-webkit-backdrop-filter: blur(20px);
				border-radius: 24px;
				box-shadow:
					0 20px 60px rgba(0, 0, 0, 0.5),
					0 0 40px rgba(102, 126, 234, 0.4),
					0 0 80px rgba(240, 147, 251, 0.3),
					inset 0 0 60px rgba(102, 126, 234, 0.15),
					inset 0 1px 0 rgba(255, 255, 255, 0.2),
					0 0 0 2px rgba(102, 126, 234, 0.6),
					0 0 0 4px rgba(240, 147, 251, 0.4);
				animation: containerFadeIn 1s ease-out, borderGlow 3s ease-in-out infinite;
				max-width: 500px;
				overflow: hidden;
			}

			#welcome-container::before {
				content: '';
				position: absolute;
				inset: -6px;
				background: linear-gradient(135deg, #667eea, #f093fb, #764ba2);
				border-radius: 28px;
				z-index: -1;
				filter: blur(12px);
				opacity: 0.5;
				animation: pulseGlow 2s ease-in-out infinite;
			}

			#welcome-container::after {
				content: '';
				position: absolute;
				top: 0;
				left: -100%;
				width: 100%;
				height: 100%;
				background: linear-gradient(90deg,
					transparent,
					rgba(255, 255, 255, 0.15),
					transparent
				);
				animation: shimmer 3s ease-in-out infinite;
				z-index: 1;
				pointer-events: none;
				border-radius: 24px;
			}

			#welcome-container > * {
				position: relative;
				z-index: 2;
			}

			@keyframes containerFadeIn {
				from {
					opacity: 0;
					transform: translateY(30px) scale(0.95);
				}
				to {
					opacity: 1;
					transform: translateY(0) scale(1);
				}
			}

			@keyframes pulseGlow {
				0%, 100% {
					opacity: 0.4;
					filter: blur(10px);
				}
				50% {
					opacity: 0.8;
					filter: blur(15px);
				}
			}

			@keyframes borderGlow {
				0%, 100% {
					box-shadow:
						0 20px 60px rgba(0, 0, 0, 0.5),
						0 0 40px rgba(102, 126, 234, 0.4),
						0 0 80px rgba(240, 147, 251, 0.3),
						inset 0 0 60px rgba(102, 126, 234, 0.15),
						inset 0 1px 0 rgba(255, 255, 255, 0.2);
				}
				50% {
					box-shadow:
						0 20px 60px rgba(0, 0, 0, 0.5),
						0 0 60px rgba(240, 147, 251, 0.6),
						0 0 120px rgba(102, 126, 234, 0.4),
						inset 0 0 80px rgba(240, 147, 251, 0.2),
						inset 0 1px 0 rgba(255, 255, 255, 0.3);
				}
			}

			@keyframes shimmer {
				0% {
					left: -100%;
				}
				50%, 100% {
					left: 100%;
				}
			}
				50%, 100% {
					left: 100%;
				}
			}

			/* Shield icon container */
			.shield-container {
				position: relative;
				width: 120px;
				height: 120px;
				margin: 0 auto 30px;
				animation: shieldEntrance 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
			}

			@keyframes shieldEntrance {
				0% {
					opacity: 0;
					transform: scale(0) rotate(-180deg);
				}
				60% {
					opacity: 1;
					transform: scale(1.15) rotate(10deg);
				}
				100% {
					transform: scale(1) rotate(0deg);
				}
			}

			.shield-icon {
				font-size: 100px;
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				z-index: 2;
				filter: drop-shadow(0 10px 20px rgba(102, 126, 234, 0.4));
				animation: shieldFloat 3s ease-in-out infinite;

				user-select: none;
				-webkit-user-select: none;
				-moz-user-select: none;
				-ms-user-select: none;
			}

			@keyframes shieldFloat {
				0%, 100% {
					transform: translate(-50%, -50%) translateY(0px);
				}
				50% {
					transform: translate(-50%, -50%) translateY(-10px);
				}
			}

			/* Pulsing glow rings */
			.glow-ring {
				position: absolute;
				top: 50%;
				left: 50%;
				width: 300px;
				height: 300px;
				border: 3px solid rgba(102, 126, 234, 0.6);
				border-radius: 50%;
				transform: translate(-50%, -50%);
				animation: pulse 2s ease-out infinite;
				pointer-events: none;
			}

			.glow-ring:nth-child(2) {
				animation-delay: 0.5s;
				border-color: rgba(240, 147, 251, 0.6);
			}

			.glow-ring:nth-child(3) {
				animation-delay: 1s;
				border-color: rgba(118, 75, 162, 0.6);
			}

			@keyframes pulse {
				0% {
					transform: translate(-50%, -50%) scale(0.8);
					opacity: 0;
				}
				50% {
					transform: translate(-50%, -50%) scale(1);
					opacity: 0.8;
				}
				100% {
					transform: translate(-50%, -50%) scale(1.5);
					opacity: 0;
				}
			}
					opacity: 0.8;
				}
				100% {
					transform: translate(-50%, -50%) scale(1.5);
					opacity: 0;
				}
			}

			/* Sparkles */
			.sparkle {
				position: absolute;
				width: 6px;
				height: 6px;
				border-radius: 50%;
				animation: sparkle 1.5s ease-in-out infinite;
			}

			.sparkle:nth-child(4) {
				top: 10%;
				left: 20%;
				background: #f093fb;
				box-shadow: 0 0 15px #f093fb;
				animation-delay: 0s;
			}

			.sparkle:nth-child(5) {
				top: 20%;
				right: 15%;
				background: #667eea;
				box-shadow: 0 0 15px #667eea;
				animation-delay: 0.3s;
			}

			.sparkle:nth-child(6) {
				bottom: 15%;
				left: 25%;
				background: #d946ef;
				box-shadow: 0 0 15px #d946ef;
				animation-delay: 0.6s;
			}

			.sparkle:nth-child(7) {
				bottom: 20%;
				right: 20%;
				background: #764ba2;
				box-shadow: 0 0 15px #764ba2;
				animation-delay: 0.9s;
			}

			@keyframes sparkle {
				0%, 100% {
					transform: scale(0);
					opacity: 0;
				}
				50% {
					transform: scale(1.5);
					opacity: 1;
				}
			}

			h1 {
				margin: 0 0 10px 0;
				font-size: 2.5em;
				font-weight: 700;
				color: white;
				text-shadow: 0 0 20px rgba(102, 126, 234, 0.5);
				animation: titleFadeIn 1s ease-out 0.3s both;
			}
				-webkit-text-fill-color: transparent;
				background-clip: text;
				animation: titleSlideIn 1s ease-out 0.3s both;
			}

			@keyframes titleSlideIn {
				from {
					opacity: 0;
					transform: translateY(-20px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			.about-links {
				display: flex;
				gap: 15px;
				justify-content: center;
				margin: 20px 0;
				animation: linksSlideIn 1s ease-out 0.5s both;
			}

			@keyframes linksSlideIn {
				from {
					opacity: 0;
					transform: translateY(-10px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			.about-links > .about-link {
				color: #a0a0ff;
				text-decoration: none;
				padding: 8px 16px;
				border-radius: 8px;
				font-weight: 500;
				font-size: 0.9em;
				transition: all 0.3s ease;
				background: rgba(102, 126, 234, 0.2);
				display: inline-block;
				text-align: center;
				border: 1px solid rgba(102, 126, 234, 0.3);
			}

			.about-link:hover {
				background: rgba(102, 126, 234, 0.3);
				transform: translateY(-2px);
				box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
				color: #c0c0ff;
			}

			#rollback-needed {
				margin: 25px 0;
				padding: 20px;
				background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 142, 83, 0.1));
				border-radius: 12px;
				border: 2px solid rgba(255, 107, 107, 0.3);
				animation: warningFadeIn 1s ease-out 0.7s both;
			}

			@keyframes warningFadeIn {
				from {
					opacity: 0;
					transform: scale(0.95);
				}
				to {
					opacity: 1;
					transform: scale(1);
				}
			}

			#rollback-needed p {
				margin: 8px 0;
				color: #e74c3c;
				font-weight: 500;
			}

			#rollback-needed a {
				color: #667eea !important;
				font-weight: 600;
			}

			button {
				width: 100%;
				padding: 16px 32px;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				border: none;
				border-radius: 12px;
				color: white;
				cursor: pointer;
				font-size: 1.1em;
				font-weight: 600;
				box-shadow:
					0 10px 30px rgba(102, 126, 234, 0.4),
					inset 0 1px 0 rgba(255, 255, 255, 0.3);
				transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
				position: relative;
				overflow: hidden;
				animation: buttonSlideIn 1s ease-out 0.9s both;
			}

			@keyframes buttonSlideIn {
				from {
					opacity: 0;
					transform: translateY(20px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			button::before {
				content: '';
				position: absolute;
				top: 0;
				left: -100%;
				width: 100%;
				height: 100%;
				background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
				transition: left 0.5s;
			}

			button:hover::before {
				left: 100%;
			}

			button:hover {
				transform: translateY(-3px) scale(1.02);
				box-shadow:
					0 15px 40px rgba(102, 126, 234, 0.5),
					inset 0 1px 0 rgba(255, 255, 255, 0.4);
			}

			button:active {
				transform: translateY(-1px) scale(1);
				box-shadow:
					0 8px 25px rgba(102, 126, 234, 0.4),
					inset 0 1px 0 rgba(255, 255, 255, 0.3);
			}

			/* Sound toggle button */
			.sound-toggle {
				position: absolute;
				top: 20px;
				right: 20px;
				background: rgba(255, 255, 255, 0.2);
				border: 2px solid rgba(255, 255, 255, 0.4);
				border-radius: 50%;
				width: 50px;
				height: 50px;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				transition: all 0.3s ease;
				z-index: 10;
				font-size: 1.5em;
				color: white;
				animation: soundButtonFadeIn 1s ease-out 1.2s both;
				box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
				backdrop-filter: blur(10px);
			}

			.sound-toggle::before {
				content: '🔊';
			}

			.sound-toggle.muted::before {
				content: '🔇';
			}

			@keyframes soundButtonFadeIn {
				from {
					opacity: 0;
					transform: scale(0) rotate(-180deg);
				}
				to {
					opacity: 1;
					transform: scale(1) rotate(0deg);
				}
			}

			.sound-toggle:hover {
				transform: scale(1.1);
				box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
				background: rgba(255, 255, 255, 0.3);
			}

			.sound-toggle.muted {
				opacity: 0.5;
				background: rgba(255, 255, 255, 0.1);
			}
		`,
		"main": `
			* {
				font-family: sans-serif;
				box-sizing: border-box;
			}

			body, html, #container {
				width: 100%;
				height: 100%;
				margin: 0;
				overflow: hidden;
			}

			body {
				background: #ffffff;
				color: #333;
				transition: background-color 0.3s ease, color 0.3s ease;
			}

			body.dark-mode {
				background: #1a1d24;
				color: #e0e0e0;
			}

			#container {
				display: flex;
			}

			#queue {
				width: 300px;
				height: 100%;
				border-right: 2px solid #bfbfbf;
				position: relative;
			}

			body.dark-mode #queue {
				border-right: 2px solid #3a3d4a;
			}

			#queue-top {
				height: 60px;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
				position: relative;
				z-index: 2;
				display: flex;
				align-items: center;
				padding: 15px;
				justify-content: space-between;
				user-select: none;
				background: rgba(255, 255, 255, 0.98);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
			}

			body.dark-mode #queue-top {
				background: rgba(30, 33, 42, 0.98);
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
			}

			#queue-top-left, #user-contribs-left {
				display: flex;
				flex-direction: column;
			}

			#queue-top-title {
				font-weight: bold;
				font-size: 1.1em;
			}

			body.dark-mode #queue-top-title {
				color: #e0e0e0;
			}

			#queue-top-items, #user-contribs-count {
				font-size: 0.85em;
			}

			body.dark-mode #queue-top-items,
			body.dark-mode #user-contribs-count {
				color: #999;
			}

			#queue-top-right {
				font-size: 1.4em;
			}

			#queue-top-right span {
				margin-left: 5px;
				cursor: pointer;
				color: #444;
				transition: 0.2s;
			}

			body.dark-mode #queue-top-right span {
				color: #c0c0c0;
			}

			#queue-top-right span:hover {
				color: black;
			}

			body.dark-mode #queue-top-right span:hover {
				color: #8fa3ff;
			}

			#notifications-panel {
				position: absolute;
				top: 55px;
				right: 15px;
				width: 380px;
				max-height: 550px;
				background: rgba(30, 33, 42, 0.97);
				backdrop-filter: blur(20px);
				-webkit-backdrop-filter: blur(20px);
				border: 1px solid rgba(255, 255, 255, 0.12);
				border-radius: 16px;
				box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
				display: none;
				z-index: 1000;
				flex-direction: column;
				overflow: hidden;
			}

			body.dark-mode #notifications-panel {
				background: rgba(30, 33, 42, 0.97);
				border: 1px solid rgba(255, 255, 255, 0.12);
				box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
			}

			#notifications-panel.show {
				display: flex;
				animation: slideDownFancy 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
			}

			@keyframes slideDownFancy {
				from {
					opacity: 0;
					transform: translateY(-20px) scale(0.95);
				}
				to {
					opacity: 1;
					transform: translateY(0) scale(1);
				}
			}

			#notifications-header {
				padding: 16px 18px;
				border-bottom: 1px solid rgba(255, 255, 255, 0.08);
				font-weight: 700;
				font-size: 1.05em;
				display: flex;
				justify-content: space-between;
				align-items: center;
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
			}

			body.dark-mode #notifications-header {
				border-bottom: 1px solid rgba(255, 255, 255, 0.08);
				color: #e8e8e8;
			}

			#notifications-list {
				overflow: hidden auto;
				max-height: 500px;
			}

			.notification-item {
				padding: 14px 18px;
				border-bottom: 1px solid rgba(255, 255, 255, 0.05);
				cursor: pointer;
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				position: relative;
			}

			body.dark-mode .notification-item {
				border-bottom: 1px solid rgba(255, 255, 255, 0.05);
			}

			.notification-item:hover {
				background: rgba(255, 255, 255, 0.06);
				transform: translateX(4px);
			}

			body.dark-mode .notification-item:hover {
				background: rgba(255, 255, 255, 0.06);
			}

			.notification-item.unread {
				background: linear-gradient(90deg, rgba(102, 126, 234, 0.2) 0%, rgba(102, 126, 234, 0.05) 100%);
				border-left: 3px solid #8fa3ff;
				padding-left: 15px;
			}

			.notification-item.unread::before {
				content: '';
				position: absolute;
				left: 0;
				top: 0;
				bottom: 0;
				width: 3px;
				background: linear-gradient(180deg, #8fa3ff 0%, rgba(143, 163, 255, 0.5) 100%);
			}

			body.dark-mode .notification-item.unread {
				background: linear-gradient(90deg, rgba(102, 126, 234, 0.2) 0%, rgba(102, 126, 234, 0.05) 100%);
				border-left: 3px solid #8fa3ff;
			}

			.notification-header {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				margin-bottom: 6px;
			}

			.notification-type {
				font-size: 0.7em;
				text-transform: uppercase;
				font-weight: 700;
				letter-spacing: 0.8px;
				opacity: 0.7;
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.25), rgba(118, 75, 162, 0.25));
				padding: 2px 8px;
				border-radius: 4px;
			}

			.notification-title {
				font-weight: 600;
				margin-bottom: 4px;
				font-size: 0.98em;
				line-height: 1.4;
				color: #222;
			}

			body.dark-mode .notification-title {
				color: #e8e8e8;
			}

			.notification-subtitle {
				font-size: 0.88em;
				color: #555;
				margin-bottom: 6px;
				line-height: 1.45;
			}

			body.dark-mode .notification-subtitle {
				color: #aaa;
			}

			.notification-time {
				font-size: 0.78em;
				color: #888;
				display: flex;
				align-items: center;
				gap: 5px;
				font-style: italic;
			}

			body.dark-mode .notification-time {
				color: #777;
			}

			.notification-time::before {
				content: '🕒';
				font-size: 1.1em;
				filter: grayscale(0.3);
			}

			.toast-notification {
				position: fixed;
				bottom: 100px;
				right: 30px;
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%);
				backdrop-filter: blur(20px);
				-webkit-backdrop-filter: blur(20px);
				color: white;
				padding: 18px 24px;
				border-radius: 16px;
				box-shadow: 0 12px 40px rgba(102, 126, 234, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
				border: 1px solid rgba(255, 255, 255, 0.2);
				z-index: 10000;
				display: flex;
				align-items: center;
				gap: 14px;
				min-width: 320px;
				max-width: 500px;
				animation: slideInBounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
				opacity: 0;
				transform: translateX(100%) scale(0.8);
			}

			.toast-notification.success {
				background: linear-gradient(135deg, rgba(76, 175, 80, 0.95) 0%, rgba(56, 142, 60, 0.95) 100%);
				box-shadow: 0 12px 40px rgba(76, 175, 80, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
			}

			.toast-notification.error {
				background: linear-gradient(135deg, rgba(244, 67, 54, 0.95) 0%, rgba(211, 47, 47, 0.95) 100%);
				box-shadow: 0 12px 40px rgba(244, 67, 54, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
			}

			.toast-notification.warning {
				background: linear-gradient(135deg, rgba(255, 152, 0, 0.95) 0%, rgba(245, 124, 0, 0.95) 100%);
				box-shadow: 0 12px 40px rgba(255, 152, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
			}

			.toast-notification.show {
				opacity: 1;
				transform: translateX(0) scale(1);
			}

			.toast-notification.hide {
				animation: slideOutBounce 0.4s cubic-bezier(0.6, -0.28, 0.735, 0.045) forwards;
			}

			@keyframes slideInBounce {
				0% {
					opacity: 0;
					transform: translateX(100%) scale(0.8);
				}
				60% {
					opacity: 1;
					transform: translateX(-10px) scale(1.05);
				}
				100% {
					opacity: 1;
					transform: translateX(0) scale(1);
				}
			}

			@keyframes slideOutBounce {
				0% {
					opacity: 1;
					transform: translateX(0) scale(1);
				}
				100% {
					opacity: 0;
					transform: translateX(150%) scale(0.7);
				}
			}

			.toast-icon {
				font-size: 1.8em;
				flex-shrink: 0;
				filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
			}

			.toast-content {
				flex: 1;
			}

			.toast-title {
				font-weight: 700;
				font-size: 1.05em;
				margin-bottom: 4px;
				letter-spacing: 0.3px;
			}

			.toast-message {
				font-size: 0.9em;
				opacity: 0.95;
				line-height: 1.4;
			}

			.toast-close {
				cursor: pointer;
				font-size: 1.3em;
				opacity: 0.8;
				transition: all 0.2s;
				flex-shrink: 0;
				padding: 4px;
				border-radius: 6px;
			}

			.toast-close:hover {
				opacity: 1;
				background: rgba(255, 255, 255, 0.15);
				transform: scale(1.1);
			}

			.confirmation-modal-overlay {
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.5);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 10001;
				animation: fadeIn 0.2s ease-out;
			}

			@keyframes fadeIn {
				from {
					opacity: 0;
				}
				to {
					opacity: 1;
				}
			}

			@keyframes fadeOut {
				from {
					opacity: 1;
				}
				to {
					opacity: 0;
				}
			}

			.confirmation-modal {
				background: rgba(255, 255, 255, 0.98);
				backdrop-filter: blur(20px);
				-webkit-backdrop-filter: blur(20px);
				border-radius: 16px;
				box-shadow: 0 12px 48px rgba(0, 0, 0, 0.25);
				border: 1px solid rgba(255, 255, 255, 0.8);
				min-width: 400px;
				max-width: 500px;
				animation: scaleIn 0.2s ease-out;
			}

			@keyframes scaleIn {
				from {
					transform: scale(0.9);
					opacity: 0;
				}
				to {
					transform: scale(1);
					opacity: 1;
				}
			}

			@keyframes scaleOut {
				from {
					transform: scale(1);
					opacity: 1;
				}
				to {
					transform: scale(0.9);
					opacity: 0;
				}
			}

			.confirmation-modal-overlay.closing {
				animation: fadeOut 0.2s ease-out forwards;
			}

			.confirmation-modal.closing {
				animation: scaleOut 0.2s ease-out forwards;
			}

			.confirmation-modal-header {
				padding: 20px 24px;
				border-bottom: 1px solid #e0e0e0;
			}

			.confirmation-modal-title {
				font-size: 1.2em;
				font-weight: bold;
				color: #333;
			}

			.confirmation-modal-body {
				padding: 24px;
				color: #555;
				line-height: 1.5;
			}

			.confirmation-modal-username {
				font-weight: bold;
				color: #0645ad;
			}

			.confirmation-modal-footer {
				padding: 16px 24px;
				border-top: 1px solid #e0e0e0;
				display: flex;
				justify-content: space-between;
				align-items: center;
				gap: 12px;
			}

			.confirmation-modal-footer-right {
				display: flex;
				gap: 12px;
			}

			.confirmation-modal-button {
				padding: 10px 24px;
				border-radius: 6px;
				font-weight: 500;
				cursor: pointer;
				border: none;
				font-size: 0.95em;
				transition: all 0.2s;
			}

			.confirmation-modal-button-no {
				background: #f5f5f5;
				color: #333;
			}

			.confirmation-modal-button-no:hover {
				background: #e0e0e0;
			}

			.confirmation-modal-button-yes {
				background: #36c;
				color: white;
			}

			.confirmation-modal-button-yes:hover {
				background: #2855a8;
			}

			.confirmation-modal-button-uaa {
				background: #d33;
				color: white;
			}

			.confirmation-modal-button-uaa:hover {
				background: #a82828;
			}

			.confirmation-modal-button-yes:hover {
				background: #2855a8;
			}

			.confirmation-modal-footer-vertical {
				flex-direction: column;
				align-items: stretch;
			}

			.confirmation-modal-footer-vertical .confirmation-modal-button {
				width: 100%;
			}

			.confirmation-modal-button-reason {
				background: #36c;
				color: white;
			}

			.confirmation-modal-button-reason:hover {
				background: #2855a8;
			}

			.confirmation-modal-button-cancel {
				background: #f5f5f5;
				color: #333;
			}

			.confirmation-modal-button-cancel:hover {
				background: #e0e0e0;
			}

			#queue-items {
				height: calc(100% - 60px);
				overflow-x: hidden;
				overflow-y: auto;
			}

			.width-adjust {
				width: 8px;
				height: 100%;
				position: absolute;
				top: 0;
				right: -4px;
				z-index: 3;
				cursor: col-resize;
			}

			#details-width-adjust {
				left: -4px;
			}

			#right-container {
				width: calc(100% - 300px);
				display: flex;
				flex-wrap: wrap;
			}

			#middle-top, #right-top {
				height: 60px;
				display: flex;
				align-items: center;
				flex-wrap: wrap;
				justify-content: center;
				padding: 8px 15px;
				background: rgba(255, 255, 255, 0.98);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				border-bottom: 2px solid #e0e0e0;
			}
			#middle-top {
				width: calc(100% - 300px);
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
			}
			#right-top {
				font-size: 0.8em;
				width: 300px;
				box-shadow: 0 2px 0px rgba(0, 0, 0, 0.08) !important;
			}

			#middle-top a, #right-top a {
				text-decoration: none;
				color: #0645ad;
				font-weight: 500;
				transition: color 0.2s ease;
			}

			#middle-top a:hover, #right-top a:hover {
				color: #0b7ad1;
			}

			#middle-top div, #right-top div {
				padding: 0 6px;
				display: flex;
				align-items: center;
				gap: 0px;
			}

			#middle-top .fa, #right-top .fa {
				margin-right: 6px;
				color: #555;
				font-size: 0.95em;
			}

			.middle-top-comment, .right-top-comment {
				flex-basis: 100%;
				text-align: center;
				justify-content: center;
				max-width: 100%;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			#right-content {
				width: 100%;
				height: calc(100% - 60px);
				display: flex;
			}

			#main-container {
				position: relative;
				width: calc(100% - 300px);
				display: flex;
				flex-direction: column;
				height: 100%;
			}

			/* Diff Container - Modern Redesign */
			#diff-container {
				overflow-y: auto;
				flex: 1;
				padding: 16px;
				scroll-behavior: smooth;
				background: linear-gradient(180deg,
					rgba(248, 249, 250, 0.3) 0%,
					rgba(241, 243, 245, 0.2) 100%);
			}

			body.dark-mode #diff-container {
				background: linear-gradient(180deg,
					rgba(30, 34, 45, 0.4) 0%,
					rgba(25, 28, 36, 0.3) 100%);
			}

			#diff-container table {
				width: 100%;
				border-collapse: separate;
				border-spacing: 0;
				background: rgba(255, 255, 255, 0.6);
				backdrop-filter: blur(20px);
				-webkit-backdrop-filter: blur(20px);
				border-radius: 12px;
				overflow: hidden;
				box-shadow:
					0 4px 20px rgba(0, 0, 0, 0.08),
					inset 0 1px 0 rgba(255, 255, 255, 0.4),
					inset 0 -1px 0 rgba(0, 0, 0, 0.05);
				border: 1px solid rgba(102, 126, 234, 0.15);
				margin-bottom: 16px;
			}

			body.dark-mode #diff-container table {
				background: rgba(35, 40, 52, 0.7);
				border: 1px solid rgba(143, 163, 255, 0.2);
				box-shadow:
					0 4px 20px rgba(0, 0, 0, 0.3),
					inset 0 1px 0 rgba(255, 255, 255, 0.08),
					inset 0 -1px 0 rgba(0, 0, 0, 0.3);
			}

			#diff-container td,
			#diff-container tr {
				overflow-wrap: anywhere;
				border: none;
			}

			#diff-container * {
				font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
				vertical-align: baseline;
				font-size: .95em;
				line-height: 1.5;
			}

			#diff-container td:not(.diff-marker) {
				width: 50%;
				padding: 8px 14px;
				transition: background 0.2s ease;
			}

			/* Diff Line Numbers */
			.diff-lineno {
				background: linear-gradient(135deg,
					rgba(102, 126, 234, 0.12) 0%,
					rgba(118, 75, 162, 0.08) 100%) !important;
				border-bottom: 1px solid rgba(102, 126, 234, 0.2) !important;
				color: #667eea !important;
				font-weight: 600;
				padding: 8px 16px !important;
				text-align: center;
				font-size: 0.85em;
				letter-spacing: 0.5px;
				user-select: none;
			}

			body.dark-mode .diff-lineno {
				background: linear-gradient(135deg,
					rgba(143, 163, 255, 0.15) 0%,
					rgba(158, 115, 212, 0.1) 100%) !important;
				border-bottom: 1px solid rgba(143, 163, 255, 0.25) !important;
				color: #8fa3ff !important;
			}

			/* Diff Marker Column */
			.diff-marker {
				width: 30px !important;
				text-align: center;
				font-weight: 700;
				user-select: none;
				padding: 6px 8px !important;
				background: rgba(0, 0, 0, 0.03);
				border-right: 1px solid rgba(0, 0, 0, 0.08);
			}

			body.dark-mode .diff-marker {
				background: rgba(0, 0, 0, 0.2);
				border-right: 1px solid rgba(255, 255, 255, 0.05);
			}

			/* Added Lines */
			.diff-addedline {
				background: linear-gradient(90deg,
					rgba(76, 175, 80, 0.15) 0%,
					rgba(76, 175, 80, 0.08) 100%) !important;
				border-left: 3px solid #4CAF50 !important;
				position: relative;
			}

			.diff-addedline::before {
				content: '';
				position: absolute;
				left: 0;
				top: 0;
				bottom: 0;
				width: 3px;
				background: linear-gradient(180deg,
					rgba(76, 175, 80, 0.8) 0%,
					rgba(76, 175, 80, 0.4) 100%);
				box-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
			}

			.diff-addedline:hover {
				background: linear-gradient(90deg,
					rgba(76, 175, 80, 0.22) 0%,
					rgba(76, 175, 80, 0.12) 100%) !important;
			}

			body.dark-mode .diff-addedline {
				background: linear-gradient(90deg,
					rgba(0, 164, 0, 0.25) 0%,
					rgba(0, 164, 0, 0.12) 100%) !important;
				border-left: 3px solid #00a400 !important;
			}

			body.dark-mode .diff-addedline:hover {
				background: linear-gradient(90deg,
					rgba(0, 164, 0, 0.32) 0%,
					rgba(0, 164, 0, 0.16) 100%) !important;
			}

			/* Deleted Lines */
			.diff-deletedline {
				background: linear-gradient(90deg,
					rgba(244, 67, 54, 0.15) 0%,
					rgba(244, 67, 54, 0.08) 100%) !important;
				border-left: 3px solid #f44336 !important;
				position: relative;
			}

			.diff-deletedline::before {
				content: '';
				position: absolute;
				left: 0;
				top: 0;
				bottom: 0;
				width: 3px;
				background: linear-gradient(180deg,
					rgba(244, 67, 54, 0.8) 0%,
					rgba(244, 67, 54, 0.4) 100%);
				box-shadow: 0 0 8px rgba(244, 67, 54, 0.4);
			}

			.diff-deletedline:hover {
				background: linear-gradient(90deg,
					rgba(244, 67, 54, 0.22) 0%,
					rgba(244, 67, 54, 0.12) 100%) !important;
			}

			body.dark-mode .diff-deletedline {
				background: linear-gradient(90deg,
					rgba(244, 67, 54, 0.25) 0%,
					rgba(244, 67, 54, 0.12) 100%) !important;
				border-left: 3px solid #f44336 !important;
			}

			body.dark-mode .diff-deletedline:hover {
				background: linear-gradient(90deg,
					rgba(244, 67, 54, 0.32) 0%,
					rgba(244, 67, 54, 0.16) 100%) !important;
			}

			/* Inline Changes Highlighting */
			ins {
				background: rgba(76, 175, 80, 0.35) !important;
				text-decoration: none;
				border-radius: 4px;
				padding: 0px 2px;
				font-weight: 600;
				box-shadow: 0 0 0 1px rgba(76, 175, 80, 0.3);
				transition: all 0.15s ease;
			}

			ins:hover {
				background: rgba(76, 175, 80, 0.5) !important;
				box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.5);
			}

			body.dark-mode ins {
				background: rgba(130, 169, 26, 0.45) !important;
				box-shadow: 0 0 0 1px rgba(130, 169, 26, 0.4);
			}

			body.dark-mode ins:hover {
				background: rgba(130, 169, 26, 0.6) !important;
				box-shadow: 0 0 0 2px rgba(130, 169, 26, 0.6);
			}

			del {
				background: rgba(244, 67, 54, 0.35) !important;
				text-decoration: none;
				border-radius: 4px;
				padding: 2px 4px;
				font-weight: 600;
				box-shadow: 0 0 0 1px rgba(244, 67, 54, 0.3);
				transition: all 0.15s ease;
			}

			del:hover {
				background: rgba(244, 67, 54, 0.5) !important;
				box-shadow: 0 0 0 2px rgba(244, 67, 54, 0.5);
			}

			body.dark-mode del {
				background: rgba(244, 67, 54, 0.45) !important;
				box-shadow: 0 0 0 1px rgba(244, 67, 54, 0.4);
			}

			body.dark-mode del:hover {
				background: rgba(244, 67, 54, 0.6) !important;
				box-shadow: 0 0 0 2px rgba(244, 67, 54, 0.6);
			}

			/* Context Lines (unchanged) */
			#diff-container tr:not(.diff-addedline):not(.diff-deletedline) td {
				color: #666;
				background: rgba(0, 0, 0, 0.02);
			}

			body.dark-mode #diff-container tr:not(.diff-addedline):not(.diff-deletedline) td {
				color: #aaa;
				background: rgba(255, 255, 255, 0.02);
			}

			#diff-container tr:hover td {
				background: rgba(102, 126, 234, 0.05);
			}

			body.dark-mode #diff-container tr:hover td {
				background: rgba(143, 163, 255, 0.08);
			}

			#bottom-tools {
				height: 50px;
				flex-shrink: 0;
			}

			#right-details {
				width: 300px;
				border-left: 2px solid #cfcfcf;
				position: relative;
			}

			#user-contribs, #page-history {
				height: 50%;
				display: flex;
				flex-direction: column;
			}

			#page-history {
				border-top: 2px solid rgba(102, 126, 234, 0.2);
			}

			body.dark-mode #page-history {
				border-top: 2px solid rgba(143, 163, 255, 0.25);
			}

			#user-contribs-top, #page-history-top {
				height: 70px;
				border-bottom: 1px solid rgba(102, 126, 234, 0.15);
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 0 16px;
				user-select: none;
				background: linear-gradient(135deg,
					rgba(102, 126, 234, 0.1) 0%,
					rgba(118, 75, 162, 0.08) 50%,
					rgba(102, 126, 234, 0.06) 100%);
				backdrop-filter: blur(25px);
				-webkit-backdrop-filter: blur(25px);
				box-shadow:
					0 2px 12px rgba(102, 126, 234, 0.1),
					inset 0 1px 0 rgba(255, 255, 255, 0.15),
					inset 0 -1px 0 rgba(102, 126, 234, 0.1);
				position: relative;
				flex-shrink: 0;
			}

			body.dark-mode #user-contribs-top,
			body.dark-mode #page-history-top {
				background: linear-gradient(135deg,
					rgba(143, 163, 255, 0.15) 0%,
					rgba(158, 115, 212, 0.12) 50%,
					rgba(143, 163, 255, 0.1) 100%);
				border-bottom: 1px solid rgba(143, 163, 255, 0.2);
				box-shadow:
					0 2px 16px rgba(0, 0, 0, 0.4),
					inset 0 1px 0 rgba(255, 255, 255, 0.08),
					inset 0 -1px 0 rgba(143, 163, 255, 0.15);
			}

			#user-contribs-title, #page-history-title {
				font-weight: 700;
				font-size: 1em;
				color: #2c3e50;
				letter-spacing: 0.5px;
				display: flex;
				align-items: center;
				gap: 10px;
				text-transform: uppercase;
				font-size: 0.85em;
			}

			body.dark-mode #user-contribs-title,
			body.dark-mode #page-history-title {
				color: #e8e8e8;
			}

			#user-contribs-title::before {
				content: "\f007";
				font-family: "Font Awesome 6 Free";
				font-weight: 900;
				color: #667eea;
				font-size: 1.2em;
				filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3));
			}

			body.dark-mode #user-contribs-title::before {
				color: #8fa3ff;
				filter: drop-shadow(0 2px 6px rgba(143, 163, 255, 0.4));
			}

			#page-history-title::before {
				content: "\f1da";
				font-family: "Font Awesome 6 Free";
				font-weight: 900;
				color: #667eea;
				font-size: 1.2em;
				filter: drop-shadow(0 2px 4px rgba(102, 126, 234, 0.3));
			}

			body.dark-mode #page-history-title::before {
				color: #8fa3ff;
				filter: drop-shadow(0 2px 6px rgba(143, 163, 255, 0.4));
			}

			#user-contribs-left {
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			#user-contribs-count {
				font-size: 0.8em;
				color: #777;
				font-weight: 500;
				letter-spacing: 0.3px;
			}

			body.dark-mode #user-contribs-count {
				color: #aaa;
			}

			/* Warn Level Badge - Modern Redesign */
			#user-contribs-level {
				padding: 4px 10px;
				border-radius: 10px;
				color: white;
				font-weight: 700;
				font-size: 0.8em;
				box-shadow:
					0 2px 8px rgba(0, 0, 0, 0.2),
					inset 0 1px 0 rgba(255, 255, 255, 0.2),
					inset 0 -1px 0 rgba(0, 0, 0, 0.1);
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				cursor: help;
				position: relative;
				letter-spacing: 0.3px;
				border: 1px solid rgba(255, 255, 255, 0.2);
			}

			#user-contribs-level:hover {
				transform: translateY(-1px) scale(1.03);
				box-shadow:
					0 4px 12px rgba(0, 0, 0, 0.25),
					inset 0 1px 0 rgba(255, 255, 255, 0.25),
					inset 0 -1px 0 rgba(0, 0, 0, 0.15);
				border-color: rgba(255, 255, 255, 0.3);
			}

			/* Block Count Badge - Modern Redesign */
			#block-count-indicator {
				padding: 4px 10px;
				border-radius: 10px;
				background: linear-gradient(135deg,
					rgba(255, 68, 68, 0.95) 0%,
					rgba(220, 38, 38, 0.95) 100%);
				color: white;
				font-weight: 700;
				font-size: 0.8em;
				margin-right: 6px;
				border: 1px solid rgba(255, 255, 255, 0.3);
				box-shadow:
					0 2px 8px rgba(255, 68, 68, 0.3),
					inset 0 1px 0 rgba(255, 255, 255, 0.2),
					inset 0 -1px 0 rgba(0, 0, 0, 0.15);
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				cursor: help;
				letter-spacing: 0.3px;
				position: relative;
			}

			#block-count-indicator::before {
				content: "🚫";
				margin-right: 4px;
				font-size: 0.9em;
				filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
			}

			#block-count-indicator:hover {
				transform: translateY(-1px) scale(1.03);
				box-shadow:
					0 4px 14px rgba(255, 68, 68, 0.4),
					inset 0 1px 0 rgba(255, 255, 255, 0.25),
					inset 0 -1px 0 rgba(0, 0, 0, 0.2);
				border-color: rgba(255, 255, 255, 0.4);
			}

			/* Protection Indicator - Modern Redesign */
			#protection-indicator {
				font-size: 1.6em;
				color: #667eea;
				filter: drop-shadow(0 2px 6px rgba(102, 126, 234, 0.4));
				transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
				cursor: help;
			}

			body.dark-mode #protection-indicator {
				color: #8fa3ff;
				filter: drop-shadow(0 2px 8px rgba(143, 163, 255, 0.5));
			}

			#protection-indicator:hover {
				transform: scale(1.15) rotate(5deg);
				filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.6));
			}

			body.dark-mode #protection-indicator:hover {
				filter: drop-shadow(0 4px 12px rgba(143, 163, 255, 0.7));
			}

			#user-contribs-content, #page-history-content {
				height: calc(100% - 70px);
				overflow-y: auto;
				overflow-x: hidden;
				flex: 1;
				background: rgba(248, 249, 252, 0.4);
				padding: 4px;
			}

			body.dark-mode #user-contribs-content,
			body.dark-mode #page-history-content {
				background: rgba(20, 22, 28, 0.3);
			}

			#user-contribs-content .queue-edit,
			#page-history-content .queue-edit {
				animation: none !important;
				margin: 4px 0;
				border-radius: 8px;
				overflow: hidden;
			}

			#bottom-tools {
				overflow: auto hidden;
				display: flex;
				align-items: center;
				justify-content: space-between;
				height: 56px;
				padding: 0 16px;
				border-top: 1px solid rgba(0, 0, 0, 0.1);
				background: rgba(255, 255, 255, 0.98);
				backdrop-filter: blur(12px);
				-webkit-backdrop-filter: blur(12px);
				box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
				position: relative;
				z-index: 10;
			}

			body.dark-mode #bottom-tools {
				background: rgba(30, 33, 42, 0.98);
				border-top: 1px solid rgba(255, 255, 255, 0.1);
				box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
			}

			/* Blur bottom bar when settings are open */
			body.settings-open #bottom-tools {
				filter: blur(4px);
				pointer-events: none;
			}

			#bottom-tools-left {
				display: flex;
				align-items: center;
				gap: 8px;
			}

			/* Menu Trigger Buttons */
			.bottom-tool-item {
				position: relative;
				white-space: nowrap;
			}

			.bottom-tool-trigger {
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 8px 14px;
				border-radius: 8px;
				cursor: pointer;
				user-select: none;
				transition: all 0.2s ease;
				font-weight: 500;
				font-size: 0.9em;
				color: #444;
				background: transparent;
			}

			body.dark-mode .bottom-tool-trigger {
				color: #c0c0c0;
			}

			.bottom-tool-trigger:hover {
				background: rgba(0, 0, 0, 0.05);
				color: #667eea;
			}

			body.dark-mode .bottom-tool-trigger:hover {
				background: rgba(255, 255, 255, 0.08);
				color: #8fa3ff;
			}

			.bottom-tool-trigger.active {
				background: rgba(102, 126, 234, 0.12);
				color: #667eea;
			}

			body.dark-mode .bottom-tool-trigger.active {
				background: rgba(102, 126, 234, 0.2);
				color: #8fa3ff;
			}

			.bottom-tool-trigger i:first-child {
				font-size: 1em;
			}

			.bottom-tool-chevron {
				font-size: 0.75em;
				transition: transform 0.2s ease;
			}

			.bottom-tool-trigger.active .bottom-tool-chevron {
				transform: rotate(180deg);
			}

			/* Dropdown Menus */
			.bottom-tool-menu {
				position: absolute;
				bottom: calc(100% + 8px);
				left: 0;
				min-width: 240px;
				max-width: calc(100vw - 40px);
				background: rgba(255, 255, 255, 0.98);
				backdrop-filter: blur(20px);
				-webkit-backdrop-filter: blur(20px);
				border: 1px solid rgba(0, 0, 0, 0.08);
				border-radius: 12px;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
				padding: 6px;
				display: none;
				z-index: 1000;
				animation: slideUpFadeIn 0.2s ease-out;
				overflow-y: visible;
			}

			.bottom-tool-menu::-webkit-scrollbar {
				height: 8px;
			}

			.bottom-tool-menu::-webkit-scrollbar-track {
				background: rgba(0, 0, 0, 0.05);
				border-radius: 4px;
			}

			.bottom-tool-menu::-webkit-scrollbar-thumb {
				background: rgba(0, 0, 0, 0.2);
				border-radius: 4px;
			}

			body.dark-mode .bottom-tool-menu::-webkit-scrollbar-track {
				background: rgba(255, 255, 255, 0.05);
			}

			body.dark-mode .bottom-tool-menu::-webkit-scrollbar-thumb {
				background: rgba(255, 255, 255, 0.2);
			}

			body.dark-mode .bottom-tool-menu {
				background: rgba(35, 38, 48, 0.98);
				border: 1px solid rgba(255, 255, 255, 0.1);
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
			}

			.bottom-tool-menu.show {
				display: block;
			}

			@keyframes slideUpFadeIn {
				from {
					opacity: 0;
					transform: translateY(10px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			/* Menu Options */
			.menu-option {
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 10px 12px;
				border-radius: 8px;
				cursor: pointer;
				user-select: none;
				transition: all 0.15s ease;
				font-size: 0.9em;
				color: #333;
				position: relative;
			}

			body.dark-mode .menu-option {
				color: #e0e0e0;
			}

			.menu-option:hover {
				background: rgba(102, 126, 234, 0.08);
				color: #667eea;
			}

			body.dark-mode .menu-option:hover {
				background: rgba(102, 126, 234, 0.15);
				color: #8fa3ff;
			}

			.menu-option i:first-child {
				width: 18px;
				font-size: 1.1em;
				text-align: center;
				opacity: 0.8;
			}

			.menu-option:hover i:first-child {
				opacity: 1;
			}

			.menu-option span {
				flex: 1;
			}

			.menu-option-icon,
			.menu-option-chevron {
				font-size: 0.85em;
				opacity: 0.5;
				margin-left: auto;
			}

			.menu-option:hover .menu-option-icon,
			.menu-option:hover .menu-option-chevron {
				opacity: 1;
			}

			/* Menu Divider */
			.menu-divider {
				height: 1px;
				background: rgba(0, 0, 0, 0.08);
				margin: 6px 8px;
			}

			body.dark-mode .menu-divider {
				background: rgba(255, 255, 255, 0.1);
			}

			/* Submenus */
			.submenu-trigger {
				position: relative;
			}

			.submenu {
				position: absolute;
				left: calc(100% + 4px);
				top: -6px;
				min-width: 240px;
				background: rgba(255, 255, 255, 0.98);
				backdrop-filter: blur(20px);
				-webkit-backdrop-filter: blur(20px);
				border: 1px solid rgba(0, 0, 0, 0.08);
				border-radius: 12px;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
				padding: 6px;
				display: none;
				z-index: 1100;
			}

			body.dark-mode .submenu {
				background: rgba(35, 38, 48, 0.98);
				border: 1px solid rgba(255, 255, 255, 0.1);
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
			}

			.submenu.show {
				display: block;
				animation: slideRightFadeIn 0.2s ease-out;
			}

			@keyframes slideRightFadeIn {
				from {
					opacity: 0;
					transform: translateX(-10px);
				}
				to {
					opacity: 1;
					transform: translateX(0);
				}
			}

			/* Stats Section */
			#bottom-tools-stats {
				display: flex;
				align-items: center;
				gap: 16px;
				font-size: 0.9em;
			}

			.stat-item {
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 6px 12px;
				background: rgba(0, 0, 0, 0.03);
				border-radius: 8px;
				color: #666;
			}

			body.dark-mode .stat-item {
				background: rgba(255, 255, 255, 0.05);
				color: #999;
			}

			.stat-item i {
				font-size: 1.1em;
			}

			.bottom-stat-value {
				font-weight: 700;
				color: #333;
				font-size: 1em;
			}

			body.dark-mode .bottom-stat-value {
				color: #e0e0e0;
			}

			.stat-value {
				font-weight: 700;
				color: #333;
			}

			body.dark-mode .stat-value {
				color: #e0e0e0;
			}

			.stat-label {
				opacity: 0.8;
			}

			/* Revert & Warn Menu Tables */
			.revert-menu-table {
				width: 100%;
				border-collapse: separate;
				border-spacing: 4px;
			}

			.revert-menu-table tr {
				border-bottom: none;
			}

			.revert-menu-table tr:last-child {
				border-bottom: none;
			}

			.revert-menu-title {
				padding: 8px 10px;
				font-weight: 500;
				font-size: 0.85em;
				color: #333;
				white-space: nowrap;
				background: transparent;
				border-radius: 0;
			}

			body.dark-mode .revert-menu-title {
				color: #e0e0e0;
				background: transparent;
			}

			.revert-menu-info {
				padding: 8px 6px;
				text-align: center;
				cursor: help;
				color: #667eea;
				font-size: 0.85em;
				width: 28px;
				background: transparent;
				border-radius: 0;
			}

			body.dark-mode .revert-menu-info {
				color: #8fa3ff;
				background: transparent;
			}

			.revert-menu-info:hover {
				color: #5a67d8;
			}

			body.dark-mode .revert-menu-info:hover {
				color: #a5b4ff;
			}

			.revert-menu-item {
				padding: 6px 8px;
				text-align: center;
				font-weight: 600;
				font-size: 0.8em;
				cursor: pointer;
				transition: all 0.15s ease;
				color: white;
				user-select: none;
				min-width: 38px;
				width: 38px;
				border-radius: 6px;
			}

			.revert-menu-item:hover {
				filter: brightness(1.15);
				transform: scale(1.08);
				box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
			}

			.revert-menu-item:active {
				transform: scale(0.98);
			}

			.revert-menu-category {
				padding: 10px 12px 6px 12px;
				font-weight: 700;
				font-size: 0.75em;
				text-transform: uppercase;
				letter-spacing: 0.5px;
				color: #667eea;
				background: rgba(102, 126, 234, 0.08);
				border-radius: 6px 6px 0 0;
			}

			body.dark-mode .revert-menu-category {
				color: #8fa3ff;
				background: rgba(143, 163, 255, 0.1);
			}

			select, input[type=text] {
				max-width: 250px;
				background: rgba(255, 255, 255, 0.95);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				border: 1px solid rgba(0, 0, 0, 0.15);
				padding: 8px 12px;
				border-radius: 8px;
				cursor: pointer;
				transition: all 0.2s ease;
				font-size: 0.95em;
				box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
			}

			body.dark-mode select,
			body.dark-mode input[type=text] {
				background: rgba(40, 43, 52, 0.95);
				border: 1px solid rgba(255, 255, 255, 0.15);
				color: #e0e0e0;
				box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
			}

			select:hover, input[type=text]:hover {
				border-color: rgba(0, 0, 0, 0.25);
				box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
			}

			body.dark-mode select:hover,
			body.dark-mode input[type=text]:hover {
				border-color: rgba(255, 255, 255, 0.25);
				box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
			}

			select:focus, input[type=text]:focus {
				outline: none;
				border-color: rgba(33, 150, 243, 0.6);
				box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.15);
				background: rgba(255, 255, 255, 1);
			}

			body.dark-mode select:focus,
			body.dark-mode input[type=text]:focus {
				border-color: rgba(102, 126, 234, 0.8);
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
				background: rgba(40, 43, 52, 1);
			}

			input[type=text] {
				cursor: text !important;
			}

			#revert-menu {
				max-height: calc(100vh - 120px);
				overflow: hidden auto;
			}

			#warn-menu {
				max-height: calc(100vh - 120px);
				overflow: hidden auto;
			}

			.revert-menu-table {
				padding: 12px;
			}

			.revert-menu-title, .revert-menu-info {
				padding-right: 15px;
			}

			.revert-menu-item {
				color: white;
				width: 35px;
				border-radius: 8px;
				height: 35px;
				font-size: 0.9em;
				text-align: center;
				user-select: none;
				cursor: pointer;
				transition: all 0.2s ease;
				box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				border: 1px solid rgba(255, 255, 255, 0.15);
			}

			.revert-menu-item:hover {
				filter: brightness(0.9);
				transform: translateY(-2px);
				box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
			}

			.revert-menu-item:active {
				transform: translateY(0);
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
			}

			/* Submenu Form Content */
			.bottom-subcontent-title {
				font-size: 0.95em;
				font-weight: 600;
				color: #333;
				margin-bottom: 12px;
				padding-bottom: 8px;
				border-bottom: 1px solid rgba(0, 0, 0, 0.08);
			}

			body.dark-mode .bottom-subcontent-title {
				color: #e0e0e0;
				border-bottom: 1px solid rgba(255, 255, 255, 0.1);
			}

			.bottom-subcontent-input-title {
				font-size: 0.9em;
				margin: 10px 0 2px 0;
				color: #666;
			}

			body.dark-mode .bottom-subcontent-input-title {
				color: #999;
			}

			.submenu select,
			.submenu input[type="text"] {
				width: 100%;
				padding: 8px 12px;
				border: 1px solid rgba(0, 0, 0, 0.15);
				border-radius: 8px;
				background: rgba(255, 255, 255, 0.8);
				font-size: 0.9em;
				transition: all 0.2s ease;
			}

			body.dark-mode .submenu select,
			body.dark-mode .submenu input[type="text"] {
				background: rgba(0, 0, 0, 0.3);
				border: 1px solid rgba(255, 255, 255, 0.2);
				color: #e0e0e0;
			}

			.submenu select:focus,
			.submenu input[type="text"]:focus {
				outline: none;
				border-color: #667eea;
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
			}

			.bottom-subcontent-button {
				font-size: 0.9em;
				margin: 10px 0 2px 0;
			}

			.bottom-subcontent-button {
				margin-top: 10px;
				display: block;
				width: 100%;
				background: linear-gradient(to bottom, #667eea, #5a67d8);
				border: 1px solid rgba(102, 126, 234, 0.3);
				border-radius: 8px;
				cursor: pointer;
				padding: 10px 16px;
				font-weight: 600;
				color: white;
				transition: all 0.2s ease;
				box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
			}

			.bottom-subcontent-button:hover {
				background: linear-gradient(to bottom, #5a67d8, #4c51bf);
				transform: translateY(-1px);
				box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
			}

			.bottom-subcontent-button:active {
				transform: translateY(0);
				box-shadow: 0 1px 4px rgba(102, 126, 234, 0.3);
			}

			body.dark-mode .bottom-subcontent-button {
				background: linear-gradient(to bottom, #8fa3ff, #7b8ff5);
				box-shadow: 0 2px 8px rgba(143, 163, 255, 0.3);
			}

			body.dark-mode .bottom-subcontent-button:hover {
				background: linear-gradient(to bottom, #7b8ff5, #667eea);
				box-shadow: 0 4px 12px rgba(143, 163, 255, 0.4);
			}

			.queue-edit {
				display: flex;
				position: relative;
				font-size: 0.95em;
				transition: all 0.2s ease;
				border-radius: 10px;
				margin: 8px;
				overflow: hidden;
				background: rgba(255, 255, 255, 0.6);
				backdrop-filter: blur(10px);
				-webkit-backdrop-filter: blur(10px);
				border: 1px solid rgba(0, 0, 0, 0.08);
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
			}

			body.dark-mode .queue-edit {
				color: #c0c0c0;
				background: rgba(40, 43, 52, 0.7);
				border: 1px solid rgba(255, 255, 255, 0.08);
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
			}

			.queue-edit:hover {
				background: rgba(255, 255, 255, 0.85);
				border-color: rgba(102, 126, 234, 0.3);
				box-shadow: 0 4px 16px rgba(102, 126, 234, 0.15);
				transform: translateX(2px);
			}

			body.dark-mode .queue-edit:hover {
				background: rgba(50, 54, 66, 0.85);
				border-color: rgba(143, 163, 255, 0.3);
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
			}

			.queue-edit:not(.queue-edit-current) {
				animation: fadein 0.5s ease-out 0s 1;
			}

			@keyframes fadein {
				from {
					background: #e8e8e8;
					transform: translateX(-5px);
				}

				to {
					background: transparent;
					transform: translateX(0);
				}
			}

			body.dark-mode .queue-edit:not(.queue-edit-current) {
				animation: fadeinDark 0.5s ease-out 0s 1;
			}

			@keyframes fadeinDark {
				from {
					background: rgba(255, 255, 255, 0.1);
					transform: translateX(-5px);
				}

				to {
					background: transparent;
					transform: translateX(0);
				}
			}

			.queue-edit-title, .queue-edit-user, .queue-edit-summary, .queue-edit-time {
				display: flex;
				align-items: center;
				white-space: nowrap;
				margin-bottom: 3px;
				position: relative;
				width: max-content;
				max-width: 100%;
				height: 22px;
			}

			.queue-edit-user, .queue-edit-summary, .queue-edit-time {
				font-size: 0.9em;
			}

		#user-contribs-content .queue-edit-content,
		#page-history-content .queue-edit-content {
			padding: 12px 14px;
			gap: 5px;
		}

		#user-contribs-content .queue-edit,
		#page-history-content .queue-edit {
			transition: all 0.2s ease;
		}

		#user-contribs-content .queue-edit:hover,
		#page-history-content .queue-edit:hover {
			transform: translateX(3px);
			background: rgba(102, 126, 234, 0.08) !important;
		}

		body.dark-mode #user-contribs-content .queue-edit:hover,
		body.dark-mode #page-history-content .queue-edit:hover {
			background: rgba(143, 163, 255, 0.12) !important;
		}

		#user-contribs-content .queue-edit-change,
		#page-history-content .queue-edit-change {
			font-size: 0.75em !important;
			min-width: 45px;
			padding: 2px 6px;
		}		.queue-edit-icon {
				width: 25px;
				flex-shrink: 0;
				color: #333;
			}

			body.dark-mode .queue-edit-icon {
				color: #c0c0c0;
			}

			.queue-edit-color {
				width: 8px;
				flex-shrink: 0;
				background: gray;
				transition: all 0.3s ease;
				position: relative;
			}

			.queue-edit-color::after {
				content: attr(data-ores-score);
				position: absolute;
				right: 10px;
				top: 50%;
				transform: translateY(-50%);
				font-size: 0.7em;
				font-weight: 700;
				color: white;
				background: rgba(0, 0, 0, 0.3);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				padding: 3px 6px;
				border-radius: 5px;
				opacity: 0;
				transition: opacity 0.3s ease;
				white-space: nowrap;
				pointer-events: none;
				z-index: 10;
			}

			.queue-edit:hover .queue-edit-color {
				width: 55px;
			}

			.queue-edit:hover .queue-edit-color::after {
				opacity: 1;
			}

			.queue-edit-content {
				padding: 14px 16px;
				width: 100%;
				border-bottom: none;
				display: flex;
				flex-direction: column;
				gap: 6px;
			}

			body.dark-mode .queue-edit-content {
				border-bottom: none;
			}

			.queue-edit-tags {
				display: flex;
			}

			.queue-edit-tag {
				font-size: 0.8em;
				padding: 3px 10px;
				flex-shrink: 0;
				margin-right: 5px;
				border-radius: 6px;
				background: rgba(234, 234, 234, 0.9);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				border: 1px solid rgba(0, 0, 0, 0.08);
				transition: all 0.2s ease;
			}

			body.dark-mode .queue-edit-tag {
				background: rgba(50, 54, 66, 0.9);
				border: 1px solid rgba(255, 255, 255, 0.1);
				color: #c0c0c0;
			}

			.queue-edit-tag:hover {
				background: rgba(220, 220, 220, 0.95);
			}

			body.dark-mode .queue-edit-tag:hover {
				background: rgba(60, 64, 76, 0.95);
			}

			.queue-edit-tag-minor {
				background: rgba(212, 212, 212, 0.95);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				border: 1px solid rgba(0, 0, 0, 0.1);
				font-weight: bold;
				color: #666;
				font-style: italic;
			}

			body.dark-mode .queue-edit-tag-minor {
				background: rgba(60, 64, 76, 0.95);
				border: 1px solid rgba(255, 255, 255, 0.15);
				color: #999;
			}

			.minor-indicator {
				font-weight: bold;
				color: #666;
				font-size: 0.9em;
				padding: 0px 4px;
				background: rgba(232, 232, 232, 0.9);
				backdrop-filter: blur(8px);
				-webkit-backdrop-filter: blur(8px);
				border: 1px solid rgba(0, 0, 0, 0.08);
				border-radius: 4px;
				margin-right: 4px;
			}

			body.dark-mode .minor-indicator {
				color: #999;
				background: rgba(60, 64, 76, 0.9);
				border: 1px solid rgba(255, 255, 255, 0.1);
			}

			.queue-edit-change {
				position: absolute;
				top: 0;
				height: calc(100% - 2px);
				right: 0;
				display: flex;
				width: 100px;
				align-items: center;
				justify-content: right;
				padding-right: 10px;
				background: linear-gradient(to right, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1));
			}

			.queue-edit-current {
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.08)) !important;
				border-left: 5px solid #667eea !important;
				box-shadow:
					inset 0 0 20px rgba(102, 126, 234, 0.1),
					0 4px 16px rgba(102, 126, 234, 0.2) !important;
				transform: translateX(0) !important;
			}

			body.dark-mode .queue-edit-current {
				background: linear-gradient(135deg, rgba(143, 163, 255, 0.15), rgba(158, 115, 212, 0.1)) !important;
				border-left: 5px solid #8fa3ff !important;
				box-shadow:
					inset 0 0 20px rgba(143, 163, 255, 0.15),
					0 4px 16px rgba(0, 0, 0, 0.5) !important;
			}

			.queue-edit:hover .queue-edit-color {
				width: 80px;
			}

			.tooltip {
				position: fixed;
				top: 0;
				left: 0;
				z-index: 10000;
				opacity: 0;
				transition: opacity 0.2s ease;
				font-size: 0.9em;
				max-width: 450px;
				min-width: 250px;
				padding: 10px 14px;
				background: rgba(44, 62, 80, 0.96);
				backdrop-filter: blur(12px);
				-webkit-backdrop-filter: blur(12px);
				border-radius: 10px;
				color: white;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
				border: 1px solid rgba(255, 255, 255, 0.1);
				white-space: normal;
				line-height: 1.5;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
				word-wrap: break-word;
			overflow-wrap: break-word;
		}

		/* Tooltip Content Styling - Modern Redesign */
		.tooltip-title {
			font-weight: 700;
			font-size: 1em;
			margin-bottom: 10px;
			border-bottom: 2px solid rgba(255, 255, 255, 0.25);
			padding-bottom: 6px;
			word-wrap: break-word;
			letter-spacing: 0.3px;
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.tooltip-item {
			margin: 8px 0;
			padding: 8px 10px;
			background: rgba(0, 0, 0, 0.15);
			border-radius: 6px;
			border-left: 3px solid rgba(255, 215, 0, 0.5);
			word-wrap: break-word;
			overflow-wrap: break-word;
			transition: all 0.2s ease;
		}

		.tooltip-item:hover {
			background: rgba(0, 0, 0, 0.25);
			border-left-color: rgba(255, 215, 0, 0.8);
			transform: translateX(2px);
		}

		.tooltip-item-level {
			display: inline-block;
			min-width: 65px;
			font-weight: 700;
			color: #ffd700;
			word-wrap: break-word;
			background: rgba(255, 215, 0, 0.15);
			padding: 2px 8px;
			border-radius: 4px;
			font-size: 0.95em;
			letter-spacing: 0.3px;
		}

		.tooltip-item-article {
			color: #87ceeb;
			word-wrap: break-word;
			font-weight: 500;
		}

		.tooltip-item-time {
			color: #c0c0c0;
			font-size: 0.85em;
			word-wrap: break-word;
			font-weight: 500;
			opacity: 0.9;
		}

		.tooltip-more {
			margin-top: 10px;
			padding-top: 8px;
			border-top: 1px solid rgba(255, 255, 255, 0.15);
			font-style: italic;
			color: #aaa;
			font-size: 0.9em;
			text-align: center;
		}

			.context-menu {
				position: fixed;
				padding: 8px;
				background: rgba(255, 255, 255, 0.95);
				backdrop-filter: blur(12px);
				-webkit-backdrop-filter: blur(12px);
				border: 1px solid rgba(0, 0, 0, 0.1);
				border-radius: 10px;
				z-index: 100;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
			}

			.context-menu div {
				padding: 8px 12px;
				margin: 4px;
				user-select: none;
				cursor: pointer;
				border-radius: 6px;
				transition: background 0.2s ease;
			}

			.context-menu div:not(#context-ores):hover {
				background: rgba(0, 0, 0, 0.08);
			}

			#context-ores {
				color: #444;
				font-size: 0.8em;
			}

			#context-ores-number {
				font-size: 1.2em;
				font-weight: bold;
				filter: brightness(0.6);
			}

			.settings-container {
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				display: flex;
				align-items: center;
				justify-content: center;
				backdrop-filter: blur(12px);
				background: rgba(0, 0, 0, 0.4);
				z-index: 10;
				animation: settingsBackdropFadeIn 0.3s ease-out;
			}

			body.dark-mode .settings-container {
				background: rgba(0, 0, 0, 0.7);
			}

			@keyframes settingsBackdropFadeIn {
				from {
					opacity: 0;
					backdrop-filter: blur(0px);
				}
				to {
					opacity: 1;
					backdrop-filter: blur(12px);
				}
			}

			.settings {
				display: flex;
				background: rgba(255, 255, 255, 0.95);
				backdrop-filter: blur(30px);
				-webkit-backdrop-filter: blur(30px);
				border: 1px solid rgba(255, 255, 255, 0.3);
				border-radius: 20px;
				box-shadow:
					0 20px 60px rgba(0, 0, 0, 0.3),
					0 0 1px rgba(255, 255, 255, 0.5) inset;
				overflow: hidden;
				animation: settingsPanelSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
				max-width: 1100px;
				width: 90vw;
			}

			body.dark-mode .settings {
				background: rgba(30, 33, 42, 0.95);
				border: 1px solid rgba(255, 255, 255, 0.1);
				box-shadow:
					0 20px 60px rgba(0, 0, 0, 0.6),
					0 0 1px rgba(102, 126, 234, 0.3) inset;
			}

			@keyframes settingsPanelSlideIn {
				from {
					opacity: 0;
					transform: scale(0.95) translateY(20px);
				}
				to {
					opacity: 1;
					transform: scale(1) translateY(0);
				}
			}

			.settings > div {
				height: 650px;
			}

			.settings-left {
				width: 240px;
				border-right: 1px solid rgba(0, 0, 0, 0.08);
				background: linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.05));
				padding: 20px 0;
				overflow-y: auto;
			}

			body.dark-mode .settings-left {
				border-right: 1px solid rgba(255, 255, 255, 0.1);
				background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.05));
			}

			.settings-category {
				margin-bottom: 20px;
			}

			.settings-category:last-child {
				margin-bottom: 0;
			}

			.settings-category-header {
				padding: 12px 20px;
				font-size: 0.7em;
				font-weight: 800;
				text-transform: uppercase;
				letter-spacing: 1.5px;
				color: #999;
				display: flex;
				align-items: center;
				gap: 8px;
				margin-bottom: 4px;
			}

			body.dark-mode .settings-category-header {
				color: #666;
			}

			.settings-category-header i {
				font-size: 1.1em;
				opacity: 0.7;
			}

			.settings-left-menu-item {
				padding: 12px 20px;
				user-select: none;
				cursor: pointer;
				transition: all 0.2s ease;
				margin: 2px 12px;
				border-radius: 10px;
				color: #444;
				font-weight: 500;
				font-size: 0.95em;
				position: relative;
				display: flex;
				align-items: center;
				gap: 12px;
			}

			body.dark-mode .settings-left-menu-item {
				color: #c0c0c0;
			}

			.settings-left-menu-item i {
				width: 20px;
				font-size: 1.1em;
				color: #666;
				transition: color 0.2s ease;
			}

			body.dark-mode .settings-left-menu-item i {
				color: #888;
			}

			.settings-left-menu-item:hover {
				background: rgba(102, 126, 234, 0.08);
				color: #667eea;
			}

			body.dark-mode .settings-left-menu-item:hover {
				background: rgba(102, 126, 234, 0.15);
				color: #8fa3ff;
			}

			.settings-left-menu-item:hover i {
				color: #667eea;
			}

			body.dark-mode .settings-left-menu-item:hover i {
				color: #8fa3ff;
			}

			.settings-left-menu-item.selected {
				background: rgba(102, 126, 234, 0.12) !important;
				color: #667eea !important;
				font-weight: 600;
			}

			body.dark-mode .settings-left-menu-item.selected {
				background: rgba(102, 126, 234, 0.2) !important;
				color: #8fa3ff !important;
				box-shadow: 0 0 20px rgba(102, 126, 234, 0.2);
			}

			.settings-left-menu-item.selected i {
				color: #667eea;
			}

			body.dark-mode .settings-left-menu-item.selected i {
				color: #8fa3ff;
			}

			.settings-right {
				flex: 1;
				overflow-y: auto;
				padding: 30px 40px;
				background: rgba(250, 250, 252, 0.5);
			}

			body.dark-mode .settings-right {
				background: rgba(20, 22, 28, 0.5);
			}

			.settings-section {
				margin-bottom: 30px;
				padding: 25px;
				background: rgba(255, 255, 255, 0.8);
				backdrop-filter: blur(10px);
				border-radius: 16px;
				border: 1px solid rgba(0, 0, 0, 0.06);
				box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
			}

			body.dark-mode .settings-section {
				background: rgba(35, 38, 48, 0.8) !important;
				border: 1px solid rgba(255, 255, 255, 0.08) !important;
				box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
			}

			.settings-section-title {
				font-size: 1.4em;
				margin-bottom: 8px;
				font-weight: 700;
				color: #1a1a1a;
				letter-spacing: -0.5px;
			}

			body.dark-mode .settings-section-title {
				color: #e0e0e0;
			}

			.settings-section-desc {
				font-size: 0.95em;
				margin-bottom: 20px;
				color: #666;
				line-height: 1.6;
			}

			body.dark-mode .settings-section-desc {
				color: #999;
			}

			body.dark-mode .settings-section a {
				color: #8fa3ff;
			}

			body.dark-mode .settings-section a:hover {
				color: #b0c0ff;
			}

			.stats-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
				gap: 16px;
				margin-top: 20px;
			}

			.stat-card {
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
				padding: 20px;
				border-radius: 12px;
				text-align: center;
				border: 2px solid rgba(102, 126, 234, 0.15);
				transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
			}

			body.dark-mode .stat-card {
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
				border: 2px solid rgba(102, 126, 234, 0.25);
			}

			.stat-card:hover {
				transform: translateY(-4px);
				border-color: rgba(102, 126, 234, 0.4);
				box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
			}

			body.dark-mode .stat-card:hover {
				border-color: rgba(102, 126, 234, 0.5);
				box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
			}

			.stat-value {
				font-size: 2.2em;
				font-weight: 700;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
				margin-bottom: 8px;
			}

			.stat-label {
				font-size: 0.95em;
				font-weight: 600;
				color: #555;
				margin-bottom: 4px;
			}

			body.dark-mode .stat-label {
				color: #aaa;
			}

			.stat-sublabel {
				font-size: 0.8em;
				color: #888;
				font-style: italic;
			}

			body.dark-mode .stat-sublabel {
				color: #777;
			}

			.danger-button {
				background: linear-gradient(135deg, #ff5252 0%, #f44336 100%) !important;
				color: white !important;
				border: none;
				padding: 12px 24px;
				border-radius: 10px;
				font-weight: 600;
				font-size: 0.95em;
				cursor: pointer;
				transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
				box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3) !important;
			}

			danger-button:hover {
				transform: translateY(-2px);
				box-shadow: 0 6px 16px rgba(244, 67, 54, 0.4) !important;
			}

			danger-button:active {
				transform: translateY(0);
			}

			.settings-compact-grid {
				display: grid;
				grid-template-columns: repeat(2, 1fr);
				gap: 18px;
				margin-bottom: 25px;
			}

			.settings-section.compact {
				margin-bottom: 0;
				padding: 18px;
			}

			.settings-section.compact .settings-section-title {
				font-size: 1.05em;
				margin-bottom: 5px;
			}

			.settings-section.compact .settings-section-desc {
				font-size: 0.85em;
				margin-bottom: 12px;
			}

			.settings-toggles-section {
				margin-bottom: 30px;
				padding: 20px;
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
				backdrop-filter: blur(10px);
				border-radius: 16px;
				border: 1px solid rgba(102, 126, 234, 0.2);
			}

			body.dark-mode .settings-toggles-section {
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
				border: 1px solid rgba(102, 126, 234, 0.3);
			}

			.settings-section-header {
				font-size: 1.2em;
				font-weight: 700;
				margin-bottom: 15px;
				display: flex;
				align-items: center;
				gap: 10px;
				color: #333;
			}

			body.dark-mode .settings-section-header {
				color: #e8e8e8;
			}

			.settings-section-header-icon {
				font-size: 1.3em;
				filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
			}

			.settings-section.inline {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 14px 16px;
				margin-bottom: 12px;
				background: rgba(255, 255, 255, 0.6);
			}

			body.dark-mode .settings-section.inline {
				background: rgba(35, 38, 48, 0.6) !important;
			}

			.settings-section.inline:last-child {
				margin-bottom: 0;
			}

			.settings-section.inline .settings-section-content {
				flex: 1;
			}

			.settings-section.inline .settings-section-title {
				font-size: 1em;
				margin-bottom: 3px;
			}

			.settings-section.inline .settings-section-desc {
				font-size: 0.82em;
				margin-bottom: 0;
			}

			#settings-general-button:nth-child(1) {
				border-top-left-radius: 8px;
			}

			#namespace-container {
				display: flex;
				flex-wrap: wrap;
			}

			#namespace-container > div {
				width: 200px;
				display: flex;
				align-items: center;
				gap: 10px;
				margin-bottom: 8px;
			}

			/* Custom checkbox styling */
			.ns-checkbox {
				appearance: none;
				-webkit-appearance: none;
				width: 22px;
				height: 22px;
				border: 2px solid rgba(102, 126, 234, 0.4);
				border-radius: 6px;
				background: rgba(255, 255, 255, 0.8);
				cursor: pointer;
				position: relative;
				transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
				flex-shrink: 0;
			}

			body.dark-mode .ns-checkbox {
				background: rgba(35, 38, 48, 0.8);
				border: 2px solid rgba(102, 126, 234, 0.5);
			}

			.ns-checkbox:hover {
				border-color: rgba(102, 126, 234, 0.7);
				background: rgba(255, 255, 255, 1);
				transform: scale(1.08);
			}

			body.dark-mode .ns-checkbox:hover {
				border-color: rgba(102, 126, 234, 0.8);
				background: rgba(35, 38, 48, 1);
			}

			.ns-checkbox:checked {
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				border-color: rgba(102, 126, 234, 0.8);
			}

			.ns-checkbox:checked::after {
				content: '✓';
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				color: white;
				font-size: 14px;
				font-weight: bold;
				text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
			}

			.ns-checkbox:focus {
				outline: none;
				box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
			}

			#namespace-container label {
				cursor: pointer;
				user-select: none;
				font-size: 0.95em;
				color: #333;
				transition: color 0.2s;
			}

			body.dark-mode #namespace-container label {
				color: #d5d5d5;
			}

			#namespace-container > div:hover label {
				color: #667eea;
			}

			body.dark-mode #namespace-container > div:hover label {
				color: #8fa3ff;
			}

			.numeric-input-container {
				display: flex;
			}

			.settings-toggle {
				width: 60px;
				height: 32px;
				cursor: pointer;
				position: relative;
				flex-shrink: 0;
			}

			.toggle-switch {
				width: 100%;
				height: 100%;
				background: rgba(200, 200, 200, 0.6);
				border-radius: 16px;
				position: relative;
				transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
				box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.15);
				border: 2px solid rgba(0, 0, 0, 0.06);
			}

			.settings-toggle.active .toggle-switch {
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				box-shadow:
					0 4px 12px rgba(102, 126, 234, 0.4),
					inset 0 1px 2px rgba(255, 255, 255, 0.2);
				border: 2px solid rgba(102, 126, 234, 0.3);
			}

			.toggle-slider {
				width: 24px;
				height: 24px;
				background: white;
				border-radius: 50%;
				position: absolute;
				top: 2px;
				left: 2px;
				transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
				box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.15);
			}

			.settings-toggle.active .toggle-slider {
				left: 30px;
				box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
			}

			.settings-toggle:hover .toggle-switch {
				transform: scale(1.02);
			}

			body.dark-mode .toggle-switch {
				background: rgba(60, 63, 75, 0.8);
				box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.4);
				border: 2px solid rgba(255, 255, 255, 0.08);
			}

			body.dark-mode .settings-toggle.active .toggle-switch {
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				box-shadow:
					0 4px 12px rgba(102, 126, 234, 0.5),
					inset 0 1px 2px rgba(255, 255, 255, 0.2);
				border: 2px solid rgba(102, 126, 234, 0.4);
			}

			.numeric-input-button {
				width: 35px;
				height: 35px;
				font-size: 1.3em;
				display: flex !important;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				border-radius: 8px;
				transition: all 0.2s ease;
				background: rgba(255, 255, 255, 0.6);
				border: 1px solid rgba(0, 0, 0, 0.1);
				color: #444;
			}

			body.dark-mode .numeric-input-button {
				background: rgba(50, 54, 66, 0.8);
				border: 1px solid rgba(255, 255, 255, 0.1);
				color: #c0c0c0;
			}

			.numeric-input-button:hover {
				background: rgba(102, 126, 234, 0.1);
				border-color: #667eea;
				color: #667eea;
				transform: scale(1.05);
			}

			body.dark-mode .numeric-input-button:hover {
				background: rgba(102, 126, 234, 0.2);
				border-color: #8fa3ff;
				color: #8fa3ff;
			}

			.numeric-input {
				background: rgba(255, 255, 255, 0.8);
				border: 1px solid rgba(0, 0, 0, 0.1);
				color: #333;
				font-size: 1.1em;
				padding: 6px 12px;
				width: 100px;
				border-radius: 8px;
				margin: 0 5px;
				transition: all 0.2s ease;
			}

			body.dark-mode .numeric-input {
				background: rgba(50, 54, 66, 0.8);
				border: 1px solid rgba(255, 255, 255, 0.1);
				color: #e0e0e0;
			}

			.numeric-input:focus {
				border: 1px solid #667eea !important;
				outline: none;
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
				background: white;
			}

			body.dark-mode .numeric-input:focus {
				background: rgba(50, 54, 66, 1);
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
			}

			/* Style number input arrows/spinners */
			input[type="number"]::-webkit-inner-spin-button,
			input[type="number"]::-webkit-outer-spin-button {
				-webkit-appearance: none;
				margin: 0;
			}

			input[type="number"] {
				-moz-appearance: textfield;
			}

			.audio-volume-input {
				position: relative;
			}

			/* Custom number input with styled arrows */
			.audio-volume-input-wrapper {
				position: relative;
				display: inline-block;
			}

			.audio-volume-input-arrows {
				position: absolute;
				right: 2px;
				top: 50%;
				transform: translateY(-50%);
				display: flex;
				flex-direction: column;
				gap: 1px;
			}

			.audio-volume-input-arrow {
				width: 20px;
				height: 14px;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				background: rgba(102, 126, 234, 0.1);
				border-radius: 3px;
				transition: all 0.2s ease;
				font-size: 10px;
				color: #667eea;
			}

			body.dark-mode .audio-volume-input-arrow {
				background: rgba(102, 126, 234, 0.15);
				color: #8898f0;
			}

			.audio-volume-input-arrow:hover {
				background: rgba(102, 126, 234, 0.25);
				color: #5568d3;
			}

			body.dark-mode .audio-volume-input-arrow:hover {
				background: rgba(102, 126, 234, 0.3);
				color: #a0aef5;
			}

			.audio-volume-input-arrow:active {
				background: rgba(102, 126, 234, 0.4);
				transform: scale(0.95);
			}

			/* Audio Volume Controls */
			.audio-volume-control {
				margin: 20px 0;
				padding: 20px;
				background: rgba(255, 255, 255, 0.6);
				border: 1px solid rgba(0, 0, 0, 0.08);
				border-radius: 12px;
				transition: all 0.2s ease;
			}

			body.dark-mode .audio-volume-control {
				background: rgba(40, 43, 52, 0.7);
				border: 1px solid rgba(255, 255, 255, 0.08);
			}

			.audio-volume-control:hover {
				background: rgba(255, 255, 255, 0.8);
				border-color: rgba(102, 126, 234, 0.2);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
			}

			body.dark-mode .audio-volume-control:hover {
				background: rgba(40, 43, 52, 0.9);
				border-color: rgba(102, 126, 234, 0.3);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
			}

			.audio-control-header {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				margin-bottom: 16px;
				gap: 20px;
			}

			.audio-control-info {
				flex: 1;
			}

			.audio-control-title {
				font-size: 1.05em;
				font-weight: 600;
				color: #1a1a1a;
				margin-bottom: 6px;
			}

			body.dark-mode .audio-control-title {
				color: #e0e0e0;
			}

			.audio-control-desc {
				font-size: 0.9em;
				color: #666;
				line-height: 1.4;
			}

			body.dark-mode .audio-control-desc {
				color: #999;
			}

			.audio-preview-button {
				padding: 10px 18px;
				background: linear-gradient(135deg, #667eea, #764ba2);
				color: white;
				border: none;
				border-radius: 8px;
				font-size: 0.9em;
				font-weight: 500;
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 8px;
				transition: all 0.2s ease;
				white-space: nowrap;
				box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
			}

			.audio-preview-button:hover {
				background: linear-gradient(135deg, #5568d3, #6a3f8f);
				box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
				transform: translateY(-1px);
			}

			.audio-preview-button:active {
				transform: translateY(0);
				box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
			}

			.audio-control-slider-container {
				display: flex;
				align-items: center;
				gap: 16px;
			}

			.audio-volume-slider {
				flex: 1;
				height: 6px;
				background: rgba(0, 0, 0, 0.1);
				border-radius: 3px;
				outline: none;
				-webkit-appearance: none;
				appearance: none;
			}

			body.dark-mode .audio-volume-slider {
				background: rgba(255, 255, 255, 0.1);
			}

			.audio-volume-slider::-webkit-slider-thumb {
				-webkit-appearance: none;
				appearance: none;
				width: 18px;
				height: 18px;
				background: linear-gradient(135deg, #667eea, #764ba2);
				border-radius: 50%;
				cursor: pointer;
				box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
				transition: all 0.2s ease;
			}

			.audio-volume-slider::-webkit-slider-thumb:hover {
				transform: scale(1.15);
				box-shadow: 0 3px 10px rgba(102, 126, 234, 0.5);
			}

			.audio-volume-slider::-moz-range-thumb {
				width: 18px;
				height: 18px;
				background: linear-gradient(135deg, #667eea, #764ba2);
				border-radius: 50%;
				cursor: pointer;
				border: none;
				box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
				transition: all 0.2s ease;
			}

			.audio-volume-slider::-moz-range-thumb:hover {
				transform: scale(1.15);
				box-shadow: 0 3px 10px rgba(102, 126, 234, 0.5);
			}

			.audio-volume-input {
				width: 70px;
				padding: 8px 12px;
				background: rgba(255, 255, 255, 0.8);
				border: 1px solid rgba(0, 0, 0, 0.1);
				border-radius: 8px;
				color: #333;
				font-size: 0.95em;
				text-align: center;
				transition: all 0.2s ease;
			}

			body.dark-mode .audio-volume-input {
				background: rgba(50, 54, 66, 0.8);
				border: 1px solid rgba(255, 255, 255, 0.1);
				color: #e0e0e0;
			}

			.audio-volume-input:focus {
				border: 1px solid #667eea;
				outline: none;
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
				background: white;
			}

			body.dark-mode .audio-volume-input:focus {
				background: rgba(50, 54, 66, 1);
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
			}

			/* Sound selector dropdown */
			.audio-sound-selector {
				padding: 8px 12px;
				background: rgba(255, 255, 255, 0.8);
				border: 1px solid rgba(0, 0, 0, 0.1);
				border-radius: 8px;
				color: #333;
				font-size: 0.95em;
				cursor: pointer;
				transition: all 0.2s ease;
				width: 100%;
				margin-top: 12px;
			}

			body.dark-mode .audio-sound-selector {
				background: rgba(50, 54, 66, 0.8);
				border: 1px solid rgba(255, 255, 255, 0.1);
				color: #e0e0e0;
			}

			.audio-sound-selector:hover {
				border-color: #667eea;
				background: rgba(255, 255, 255, 1);
			}

			body.dark-mode .audio-sound-selector:hover {
				background: rgba(50, 54, 66, 1);
				border-color: #667eea;
			}

			.audio-sound-selector:focus {
				border: 1px solid #667eea;
				outline: none;
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
			}

			body.dark-mode .audio-sound-selector:focus {
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
			}

			#sound-volumes-container {
				display: flex;
				flex-direction: column;
				gap: 0;
			}

			#sound-volumes-container .audio-volume-control:last-child {
				margin-bottom: 0;
			}

			.control-container {
				background: rgba(255, 255, 255, 0.6);
				border: 1px solid rgba(0, 0, 0, 0.08);
				padding: 18px 22px;
				border-radius: 12px;
				font-size: 0.9em;
				margin-bottom: 15px;
				transition: all 0.2s ease;
			}

			body.dark-mode .control-container {
				background: rgba(40, 43, 52, 0.7);
				border: 1px solid rgba(255, 255, 255, 0.08);
			}

			.control-container:hover {
				background: rgba(255, 255, 255, 0.8);
				border-color: rgba(102, 126, 234, 0.2);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
			}

			body.dark-mode .control-container:hover {
				background: rgba(40, 43, 52, 0.9);
				border-color: rgba(102, 126, 234, 0.3);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
			}

			.control-container-title {
				font-size: 1.1em;
				font-weight: 600;
				color: #1a1a1a;
				margin-bottom: 12px;
			}

			body.dark-mode .control-container-title {
				color: #e0e0e0;
			}

			.control-action {
				margin-top: 12px;
				padding: 0 0 0 16px;
				border-left: 2px solid rgba(102, 126, 234, 0.3);
			}

			body.dark-mode .control-action {
				border-left-color: rgba(102, 126, 234, 0.5);
			}

			.control-action-title {
				color: #666;
				margin-bottom: 8px;
				font-weight: 500;
			}

			body.dark-mode .control-action-title {
				color: #999;
			}

			.control-action-title span {
				margin-right: 5px;
			}

			.control-action-title-left span {
				width: 17px;
			}

			.control-action-title-left select {
				margin: 0 5px;
				background: rgba(255, 255, 255, 0.8);
				border: 1px solid rgba(0, 0, 0, 0.1);
				color: #333;
				padding: 6px 10px;
				border-radius: 6px;
				transition: all 0.2s ease;
			}

			body.dark-mode .control-action-title-left select {
				background: rgba(50, 54, 66, 0.8);
				border: 1px solid rgba(255, 255, 255, 0.1);
				color: #e0e0e0;
			}

			.control-action-title-left select:focus {
				outline: none;
				border-color: #667eea;
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
			}

			body.dark-mode .control-action-title-left select:focus {
				box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
			}

			.control-keys {
				display: flex;
				gap: 8px;
				flex-wrap: wrap;
			}

			.control-keys > div {
				display: flex;
				align-items: center;
				background: rgba(255, 255, 255, 0.9);
				border: 1px solid rgba(0, 0, 0, 0.1);
				width: max-content;
				padding: 8px 14px;
				border-radius: 8px;
				color: #444;
				font-weight: 500;
				transition: all 0.2s ease;
				box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
			}

			body.dark-mode .control-keys > div {
				background: rgba(50, 54, 66, 0.9);
				border: 1px solid rgba(255, 255, 255, 0.15);
				color: #c0c0c0;
				box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
			}

			.control-keys > div:hover {
				background: white;
				border-color: #667eea;
				box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
				transform: translateY(-1px);
			}

			body.dark-mode .control-keys > div:hover {
				background: rgba(60, 64, 76, 1);
				border-color: #8fa3ff;
				box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
			}
				margin: 5px 5px 5px 0;
				user-select: none;
				box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
				transition: all 0.2s ease;
			}

			.control-keys > div:hover {
				border-color: rgba(0, 0, 0, 0.25);
				box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
			}

			.control-keys .remove {
				cursor: pointer;
			}

			.key-elem-title {
				margin-right: 10px;
			}

			.key-select {
				font-style: italic;
				border: 2px solid #8989ec !important;
			}

			.key-duplicate {
				border: 2px solid red !important;
			}

			.control-action-title {
				display: flex;
				justify-content: space-between;
				align-items: center;
			}

			.control-action-title-right {
				display: flex;
			}

			.control-action-title-right span {
				font-size: 1.2em;
				width: 30px;
				height: 30px;
				margin-right: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
				border-radius: 5px;
				transition: 0.1s;
			}

			.control-action-title-right span:hover {
				background: #eaeaea;
			}

			.add-action-button {
				width: max-content;
				border: 1px solid rgba(0, 0, 0, 0.15);
				padding: 8px 16px;
				border-radius: 8px;
				background: linear-gradient(to bottom, #ffffff, #f5f5f5);
				cursor: pointer;
				user-select: none;
				transition: all 0.2s ease;
				font-weight: 500;
				box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
			}

			.add-action-button:hover {
				border-color: rgba(0, 0, 0, 0.2);
				transform: translateY(-1px);
				box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
			}

			.add-action-button:active {
				transform: translateY(0);
				box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
			}

			.add-action-button:hover {
				background: linear-gradient(to bottom, #ffffff, #f0f0f0);
				transform: translateY(-1px);
				box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
			}

			.add-action-button:active {
				transform: translateY(0);
				box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
			}

			.add-action-container {
				display: flex;
			}

			.cancel-button, .create-button {
				margin-left: 5px;
			}

			.control-delete {
				color: red;
			}

			.control-bottom-container {
				display: flex;
				justify-content: space-between;
				margin-top: 10px;
			}

			.new-control-script {
				font-size: 0.9em;
			}

			.new-control-script span {
				margin-right: 5px;
			}

			.action-parameter {
				margin-left: 26px;
				display: inline-block;
			}

			.parameter-title {
				margin: 5px 0 2px 0;
				font-size: 0.9em;
			}

			.user-input-container {
				display: flex;
				gap: 12px;
				margin-top: 18px;
				padding: 16px;
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
				border-radius: 12px;
				border: 2px dashed rgba(102, 126, 234, 0.25);
			}

			body.dark-mode .user-input-container {
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
				border: 2px dashed rgba(102, 126, 234, 0.35);
			}

			.username-input {
				flex: 1;
				padding: 10px 16px;
				border: 2px solid rgba(102, 126, 234, 0.3);
				border-radius: 10px;
				font-size: 0.95em;
				background: rgba(255, 255, 255, 0.9);
				transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
				outline: none;
			}

			.username-input:focus {
				border-color: rgba(102, 126, 234, 0.6);
				box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.15);
				background: white;
			}

			body.dark-mode .username-input {
				background: rgba(35, 38, 48, 0.9);
				border: 2px solid rgba(102, 126, 234, 0.4);
				color: #e8e8e8;
			}

			body.dark-mode .username-input:focus {
				border-color: rgba(102, 126, 234, 0.7);
				box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
				background: rgba(35, 38, 48, 1);
			}

			.add-user-button {
				padding: 10px 24px;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				color: white;
				border: none;
				border-radius: 10px;
				font-weight: 600;
				font-size: 0.95em;
				cursor: pointer;
				transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
				display: flex;
				align-items: center;
				justify-content: center;
				box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
				white-space: nowrap;
				flex-shrink: 0;
			}

			.add-user-button:hover {
				transform: translateY(-2px);
				box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
			}

			.add-user-button:active {
				transform: translateY(0);
			}

			.user-container > div {
				display: flex;
				justify-content: space-between;
				align-items: center;
				border: 1px solid rgba(0, 0, 0, 0.1);
				border-radius: 8px;
				padding: 8px 8px 8px 15px;
				margin-bottom: 8px;
				background: rgba(0, 0, 0, 0.02);
				transition: all 0.2s ease;
			}

			.user-container > div:hover {
				background: rgba(0, 0, 0, 0.04);
				border-color: rgba(0, 0, 0, 0.15);
				transform: translateX(2px);
			}

			.user-container a {
				color: black;
				text-decoration: none;
			}

		.queue-edit-user-highlight {
			color: #d4a400 !important;
			font-weight: 600 !important;
			background: none !important;
			backdrop-filter: none !important;
			-webkit-backdrop-filter: none !important;
			border: none !important;
			padding: 0 !important;
			border-radius: 0 !important;
			box-shadow: none !important;
		}

		.queue-edit-user-highlight .queue-edit-icon {
			color: #d4a400 !important;
		}

		.queue-edit-user-empty-talk {
			color: #d63031 !important;
			font-weight: 600 !important;
			background: none !important;
			backdrop-filter: none !important;
			-webkit-backdrop-filter: none !important;
			border: none !important;
			padding: 0 !important;
			border-radius: 0 !important;
			box-shadow: none !important;
		}

		.queue-edit-user-empty-talk .queue-edit-icon {
			color: #d63031 !important;
		}

		/* Special highlight for edits that mention current user */
		.queue-edit-mentions-me {
			border: 2px solid #667eea !important;
			background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%) !important;
			box-shadow: 0 0 20px rgba(102, 126, 234, 0.3), 0 4px 16px rgba(0, 0, 0, 0.1) !important;
			animation: pulse-mention 2s ease-in-out infinite !important;
		}

		body.dark-mode .queue-edit-mentions-me {
			border: 2px solid #8fa3ff !important;
			background: linear-gradient(135deg, rgba(143, 163, 255, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%) !important;
			box-shadow: 0 0 20px rgba(143, 163, 255, 0.4), 0 4px 16px rgba(0, 0, 0, 0.3) !important;
		}

		.queue-edit-mentions-me:hover {
			border-color: #764ba2 !important;
			box-shadow: 0 0 25px rgba(118, 75, 162, 0.5), 0 6px 20px rgba(0, 0, 0, 0.15) !important;
		}

		body.dark-mode .queue-edit-mentions-me:hover {
			border-color: #a855f7 !important;
			box-shadow: 0 0 25px rgba(168, 85, 247, 0.6), 0 6px 20px rgba(0, 0, 0, 0.4) !important;
		}

		@keyframes pulse-mention {
			0%, 100% {
				transform: scale(1);
				box-shadow: 0 0 20px rgba(102, 126, 234, 0.3), 0 4px 16px rgba(0, 0, 0, 0.1);
			}
			50% {
				transform: scale(1.01);
				box-shadow: 0 0 30px rgba(102, 126, 234, 0.5), 0 6px 20px rgba(0, 0, 0, 0.15);
			}
		}

		body.dark-mode @keyframes pulse-mention {
			0%, 100% {
				box-shadow: 0 0 20px rgba(143, 163, 255, 0.4), 0 4px 16px rgba(0, 0, 0, 0.3);
			}
			50% {
				box-shadow: 0 0 30px rgba(143, 163, 255, 0.6), 0 6px 20px rgba(0, 0, 0, 0.4);
			}
		}

		#progress-bar-container {
				position: absolute;
				top: calc(100% - 120px);
				height: 40px;
				display: flex;
				justify-content: flex-end;
				align-items: center;
				width: 100%;
				padding: 0px 20px;
			}

			.progress-bar {
				border-radius: 16px;
				width: 180px;
				height: 32px;
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
				backdrop-filter: blur(12px);
				-webkit-backdrop-filter: blur(12px);
				font-size: 0.85em;
				font-weight: 500;
				display: flex;
				align-items: center;
				justify-content: center;
				position: relative;
				margin-left: 10px;
				opacity: 1;
				transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
				overflow: hidden;
				border: 1px solid rgba(102, 126, 234, 0.2);
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
			}

			.progress-bar-overlay {
				position: absolute;
				top: 0;
				left: 0;
				border-radius: 16px;
				width: 0px;
				transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
				height: 100%;
				background: linear-gradient(90deg,
					rgba(102, 126, 234, 0.4),
					rgba(118, 75, 162, 0.4));
				box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.2);
			}

			.progress-bar-text {
				position: relative;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				padding: 0 12px;
				max-width: 100%;
				color: #ffffff;
				text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
			}

			.changelog {
				font-size: 0.9em;
				line-height: 1.6em;
			}

			.settings-appearance-box {
				display: inline-flex;
				width: 160px;
				height: 70px;
				justify-content: center;
				align-items: center;
				border-radius: 12px;
				margin: 10px 10px 0 0;
				cursor: pointer;
				user-select: none;
				transition: all 0.2s ease;
				font-weight: 600;
				font-size: 1em;
				border: 2px solid rgba(0, 0, 0, 0.08);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
			}

			body.dark-mode .settings-appearance-box {
				border: 2px solid rgba(255, 255, 255, 0.1);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
			}

			.settings-appearance-box:hover {
				transform: translateY(-3px);
				box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
				border-color: #667eea;
			}

			body.dark-mode .settings-appearance-box:hover {
				box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
				border-color: #8fa3ff;
			}

			#box-light {
				background: linear-gradient(135deg, #ffffff, #f5f5f5);
				color: #333 !important;
			}
			#box-light > div {
				color: #333 !important;
			}

			#box-dark {
				background: linear-gradient(135deg, #2a2d3a, #1f2229);
				color: white;
			}

			.add-action-button {
				width: max-content;
				border: 1px solid rgba(0, 0, 0, 0.15);
				padding: 8px 16px;
				border-radius: 8px;
				background: linear-gradient(to bottom, #ffffff, #f5f5f5);
				cursor: pointer;
				user-select: none;
				transition: all 0.2s ease;
				font-weight: 500;
				box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
			}

			body.dark-mode .add-action-button {
				border: 1px solid rgba(255, 255, 255, 0.15);
				background: linear-gradient(to bottom, #3a3d4a, #2f323e);
				color: #e0e0e0;
				box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
			}

			.add-action-button:hover {
				border-color: rgba(0, 0, 0, 0.2);
				transform: translateY(-1px);
				box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
				background: linear-gradient(to bottom, #ffffff, #f0f0f0);
			}

			body.dark-mode .add-action-button:hover {
				border-color: rgba(102, 126, 234, 0.5);
				box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5);
				background: linear-gradient(to bottom, #4a4d5a, #3f424e);
			}

			.add-action-button:active {
				transform: translateY(0);
				box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
			}

			.control-action-title-right span:hover {
				background: #eaeaea;
			}

			body.dark-mode .control-action-title-right span:hover {
				background: rgba(255, 255, 255, 0.1);
			}

			.user-container > div {
				display: flex;
				justify-content: space-between;
				align-items: center;
				border: 1px solid rgba(0, 0, 0, 0.1);
				border-radius: 8px;
				padding: 8px 8px 8px 15px;
				margin-bottom: 8px;
				background: rgba(0, 0, 0, 0.02);
				transition: all 0.2s ease;
			}

			body.dark-mode .user-container > div {
				border: 1px solid rgba(255, 255, 255, 0.1);
				background: rgba(255, 255, 255, 0.03);
			}

			.user-container > div:hover {
				background: rgba(0, 0, 0, 0.04);
				border-color: rgba(0, 0, 0, 0.15);
				transform: translateX(2px);
			}

			body.dark-mode .user-container > div:hover {
				background: rgba(255, 255, 255, 0.06);
				border-color: rgba(255, 255, 255, 0.15);
			}

			.user-container a {
				color: black;
				text-decoration: none;
			}

			body.dark-mode .user-container a {
				color: #c0c0c0;
			}

			::-webkit-scrollbar {
				width: 10px;
			}

			::-webkit-scrollbar-track {
				background: rgba(0, 0, 0, 0.03);
				border-radius: 10px;
			}

			body.dark-mode ::-webkit-scrollbar-track {
				background: rgba(255, 255, 255, 0.03);
			}

			::-webkit-scrollbar-thumb {
				background: rgba(0, 0, 0, 0.15);
				border-radius: 10px;
				transition: all 0.2s ease;
			}

			body.dark-mode ::-webkit-scrollbar-thumb {
				background: rgba(255, 255, 255, 0.2);
			}

			::-webkit-scrollbar-thumb:hover {
				background: rgba(102, 126, 234, 0.4);
			}

			body.dark-mode ::-webkit-scrollbar-thumb:hover {
				background: rgba(102, 126, 234, 0.6);
			}

			.settings-right::-webkit-scrollbar-track {
				background: transparent;
			}
		`,
		"theme-dark": `
			body {
				background: #22262f;
			}

			*, .about-link {
				color: #f1f5ff;
			}

			button {
				background: rgba(74, 125, 204, 0.95) !important;
				backdrop-filter: blur(8px) !important;
				-webkit-backdrop-filter: blur(8px) !important;
				border: 1px solid rgba(74, 125, 204, 0.3) !important;
				box-shadow: 0 2px 8px rgba(74, 125, 204, 0.3) !important;
			}

			button:hover {
				background: rgba(91, 154, 255, 0.95) !important;
				box-shadow: 0 4px 12px rgba(91, 154, 255, 0.4) !important;
			}

			.queue-edit-current, .progress-bar, .queue-edit-tag {
				background: rgba(41, 47, 60, 0.95) !important;
				backdrop-filter: blur(8px) !important;
				-webkit-backdrop-filter: blur(8px) !important;
				border: 1px solid rgba(255, 255, 255, 0.06) !important;
			}

			.queue-edit-tag-minor {
				background: rgba(31, 36, 48, 0.95) !important;
				backdrop-filter: blur(8px) !important;
				-webkit-backdrop-filter: blur(8px) !important;
				border: 1px solid rgba(255, 255, 255, 0.08) !important;
				color: #a8b0c0 !important;
			}

			.minor-indicator {
				background: rgba(54, 62, 81, 0.9) !important;
				backdrop-filter: blur(8px) !important;
				-webkit-backdrop-filter: blur(8px) !important;
				border: 1px solid rgba(255, 255, 255, 0.08) !important;
				color: #a8b0c0 !important;
			}

			.queue-edit-content {
				border-bottom: 2px solid #363e51 !important;
			}

			#queue {
				border-right: 2px solid #363e51 !important;
			}

			#right-details {
				border-left: 2px solid #363e51 !important;
			}

			#bottom-tools {
				border-top: 2px solid #363e51 !important;
			}

			#bottom-tools-stats {
				color: #aaa !important;
			}

			#bottom-tools-stats .bottom-stat-value {
				color: #e0e0e0 !important;
			}

			.toast-notification {
				background: rgba(211, 47, 47, 0.96) !important;
				backdrop-filter: blur(12px) !important;
				-webkit-backdrop-filter: blur(12px) !important;
				border: 1px solid rgba(255, 255, 255, 0.15) !important;
				box-shadow: 0 6px 20px rgba(211, 47, 47, 0.4) !important;
			}

			.confirmation-modal-overlay {
				background: rgba(0, 0, 0, 0.7) !important;
			}

			.confirmation-modal {
				background: rgba(41, 47, 60, 0.98) !important;
				backdrop-filter: blur(20px) !important;
				-webkit-backdrop-filter: blur(20px) !important;
				box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7) !important;
				border: 1px solid rgba(255, 255, 255, 0.1) !important;
			}

			.confirmation-modal-header {
				border-bottom: 1px solid #363e51 !important;
			}

			.confirmation-modal-title {
				color: #f1f5ff !important;
			}

			.confirmation-modal-body {
				color: #bbb !important;
			}

			.confirmation-modal-username {
				color: #5b9aff !important;
			}

			.confirmation-modal-footer {
				border-top: 1px solid #363e51 !important;
			}

			.confirmation-modal-button-no {
				background: #363e51 !important;
				color: #f1f5ff !important;
			}

			.confirmation-modal-button-no:hover {
				background: #4a5468 !important;
			}

			.confirmation-modal-button-yes {
				background: #4a7dcc !important;
			}

			.confirmation-modal-button-yes:hover {
				background: #5b9aff !important;
			}

			.confirmation-modal-button-uaa {
				background: #c13030 !important;
			}

			.confirmation-modal-button-uaa:hover {
				background: #d94444 !important;
			}

			.confirmation-modal-button-reason {
				background: #4a7dcc !important;
			}

			.confirmation-modal-button-reason:hover {
				background: #5b9aff !important;
			}

			.confirmation-modal-button-cancel {
				background: #363e51 !important;
				color: #f1f5ff !important;
			}

			.confirmation-modal-button-cancel:hover {
				background: #4a5468 !important;
			}

			#user-contribs-top, #page-history-top {
				border-bottom: 2px solid #363e51 !important;
			}

			#page-history {
				border-top: 2px solid #363e51 !important;
			}

			/* Legacy selectors for compatibility */
			.settings-left-menu-item:hover, .settings-left-menu-item.selected,
			.context-menu div:not(#context-ores):hover {
				background: #292f3c !important;
			}

			.numeric-input-button:hover {
				background: #2e3442 !important;
			}
				border: 1px solid rgba(255, 255, 255, 0.08) !important;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
			}

			.context-menu {
				background: rgba(41, 47, 60, 0.95) !important;
				backdrop-filter: blur(12px) !important;
				-webkit-backdrop-filter: blur(12px) !important;
				border: 1px solid rgba(255, 255, 255, 0.08) !important;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
			}

			.settings {
				background: rgba(41, 47, 60, 0.95) !important;
				backdrop-filter: blur(12px) !important;
				-webkit-backdrop-filter: blur(12px) !important;
				border: 1px solid rgba(255, 255, 255, 0.08) !important;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
			}

			#notifications-panel {
				background: rgba(41, 47, 60, 0.95) !important;
				backdrop-filter: blur(12px) !important;
				-webkit-backdrop-filter: blur(12px) !important;
				border: 1px solid rgba(255, 255, 255, 0.08) !important;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
			}

			select, input[type=text], .bottom-subcontent-button {
				background: rgba(46, 52, 66, 0.95) !important;
				border: 1px solid rgba(255, 255, 255, 0.08) !important;
				color: #e0e0e0 !important;
				border-radius: 8px !important;
			}

			select:hover, input[type=text]:focus, .bottom-subcontent-button:hover {
				border-color: rgba(91, 154, 255, 0.4) !important;
				background: rgba(46, 52, 66, 1) !important;
			}

			.queue-edit-change {
				background: linear-gradient(to right, rgba(34, 38, 47, 0), rgba(34, 38, 47, 1)) !important;
			}

			#middle-top, #queue-top, #right-top {
				box-shadow: none !important;
				border-bottom: 2px solid #363e51;
			}

			.queue-edit:not(.queue-edit-current) {
				animation: fadeindark 0.5s linear 0s 1 !important;
			}

			@keyframes fadeindark {
				from {
					background: #363e51;
				}

				to {
					background: transparent;
				}
			}

			.settings, .context-menu, .control-keys > div, .add-action-button, .control-container,
			.user-container > div {
				background: #22262f;
				border: 2px solid #363e51;
			}

			.settings-left {
				border-right: 2px solid #363e51;
			}

			.settings-section {
				background: rgba(35, 38, 48, 0.8) !important;
				border: 1px solid rgba(255, 255, 255, 0.08) !important;
				box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
			}

			.settings-section-title {
				color: #e0e0e0 !important;
			}

			.settings-section-desc {
				color: #999 !important;
			}

			.settings-section a {
				color: #8fa3ff !important;
			}

			.settings-section a:hover {
				color: #b0c0ff !important;
			}

			.settings-right {
				background: rgba(20, 22, 28, 0.5) !important;
			}

			#notifications-panel {
				background: rgba(34, 38, 47, 0.95) !important;
				backdrop-filter: blur(12px) !important;
				-webkit-backdrop-filter: blur(12px) !important;
				border: 1px solid rgba(255, 255, 255, 0.08) !important;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
			}

			#notifications-header {
				border-bottom: 1px solid #363e51 !important;
			}

			.notification-item {
				border-bottom: 1px solid #363e51 !important;
			}

			.notification-item:hover {
				background: #292f3c !important;
			}

			.notification-item.unread {
				background: #2a3a4a !important;
				border-left-color: #5588cc !important;
			}

			.notification-subtitle {
				color: #aaa !important;
			}

			.notification-time {
				color: #888 !important;
			}

			.notification-type {
				color: #999 !important;
			}

			#page-metadata {
				color: #999 !important;
			}

			#mark-all-read {
				color: #6ba3d8 !important;
			}

			.queue-edit-user-highlight {
				color: #f4c430 !important;
				font-weight: 600 !important;
				background: none !important;
				backdrop-filter: none !important;
				-webkit-backdrop-filter: none !important;
				border: none !important;
				padding: 0 !important;
				border-radius: 0 !important;
				box-shadow: none !important;
			}

			.queue-edit-user-empty-talk {
				color: #ff6b6b !important;
				font-weight: 600 !important;
				background: none !important;
				backdrop-filter: none !important;
				-webkit-backdrop-filter: none !important;
				border: none !important;
				padding: 0 !important;
				border-radius: 0 !important;
				box-shadow: none !important;
			}

			.toggle-switch {
				background: #363e51 !important;
			}

			.settings-toggle.active .toggle-switch {
				background: #4a7dcc !important;
			}

			.toggle-slider {
				background: #f1f5ff !important;
			}

			#block-count-indicator {
				background: #22262f !important;
				border-color: #ff6666 !important;
			}

			::-webkit-scrollbar {
				background: #22262f;
				width: 10px;
			}

			::-webkit-scrollbar-track {
				background: #1a1e27;
				border-radius: 10px;
			}

			::-webkit-scrollbar-thumb {
				background: #3a4052;
				border-radius: 10px;
				transition: background 0.2s;
			}

			::-webkit-scrollbar-thumb:hover {
				background: #4a5468;
			}

			.queue-edit-current {
				background: #2a3444 !important;
				border-left: 4px solid #5b9aff !important;
				box-shadow: inset 0 0 10px rgba(91, 154, 255, 0.15) !important;
			}

			#middle-top, #right-top {
				background: rgba(41, 47, 60, 0.98) !important;
				backdrop-filter: blur(8px) !important;
				-webkit-backdrop-filter: blur(8px) !important;
				border-bottom: 2px solid #363e51 !important;
			}

			#queue-top {
				background: rgba(41, 47, 60, 0.98) !important;
				backdrop-filter: blur(8px) !important;
				-webkit-backdrop-filter: blur(8px) !important;
			}

			#bottom-tools {
				background: rgba(41, 47, 60, 0.98) !important;
				backdrop-filter: blur(8px) !important;
				-webkit-backdrop-filter: blur(8px) !important;
			}

			#middle-top a, #right-top a {
				color: #6ba3d8 !important;
			}

			#middle-top a:hover, #right-top a:hover {
				color: #89b8e8 !important;
			}

			#middle-top .fa, #right-top .fa {
				color: #aaa !important;
			}

			/* Warning/Notice boxes - dark mode compatible */
			.warning-box, .notice-box {
				background: rgba(139, 92, 0, 0.15) !important;
				border-left-color: #c5a000 !important;
				color: #f0d48a !important;
			}

			.error-box {
				background: rgba(139, 0, 0, 0.15) !important;
				border-left-color: #dc3545 !important;
				color: #ffb3b3 !important;
			}

			/* Older edit notice */
			#old-edit-notice {
				background: rgba(139, 92, 0, 0.15) !important;
				border-left-color: #c5a000 !important;
				color: #f0d48a !important;
			}

			#old-edit-notice a {
				color: #a3c5ff !important;
			}

			/* Code blocks in light backgrounds */
			code {
				background: rgba(70, 80, 100, 0.5) !important;
				color: #e0e0e0 !important;
			}
		`,
	};

	const wikishieldHTML = {
		"head": `
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">
		`,
		"initial": `
			<div id="container">
				<canvas id="dots-canvas"></canvas>
				<div class="sound-toggle" id="sound-toggle" title="Toggle sound"></div>
				<div id="welcome-container">
					<div class="shield-container">
						<div class="glow-ring"></div>
						<div class="glow-ring"></div>
						<div class="glow-ring"></div>
						<div class="sparkle"></div>
						<div class="sparkle"></div>
						<div class="sparkle"></div>
						<div class="sparkle"></div>
						<div class="shield-icon">🛡️</div>
					</div>
					<h1>Welcome to WikiShield</h1>
					<div class="about-links">
						<a href="https://en.wikipedia.org/wiki/Wikipedia:WikiShield" target="_blank" class="about-link">About</a>
						<a href="https://en.wikipedia.org/wiki/Wikipedia talk:WikiShield" target="_blank" class="about-link">Discuss</a>
						<span class="about-link">v${__script__.version}</span>
					</div>
					<div id="rollback-needed" style="display: none;">
						<p><span class="fa fa-exclamation-triangle"></span> You must have rollback or admin rights to use this script.</p>
						<p>You can apply for rollback rights <a href="https://en.wikipedia.org/wiki/WP:PERM/R" target="_blank">here</a>.</p>
					</div>
					<button id="start-button">
						<span class="fa fa-play"></span> Start WikiShield
					</button>
				</div>
			</div>
		`,
		"main": `
			<div id="container">
				<div id="queue">
					<div id="queue-top">
						<div id="queue-top-left">
							<span id="queue-top-title">Queue</span>
							<span id="queue-top-items">0 items</span>
						</div>
						<div id="queue-top-right">
							<span class="fa fa-bell" id="notifications-icon" data-tooltip="Notifications" style="position: relative;">
								<span id="notification-count" style="display: none; position: absolute; top: -5px; right: -5px; background: red; color: white; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; text-align: center; line-height: 16px; font-family: sans-serif;"></span>
							</span>
							<span class="fa fa-trash" id="delete-queue" data-tooltip="Clear queue"></span>
							<span class="fa fa-gear" id="open-settings" data-tooltip="Open settings"></span>
						</div>
					</div>
					<div id="queue-items"></div>
					<div class="width-adjust" id="queue-width-adjust"></div>
				</div>
				<div id="notifications-panel">
					<div id="notifications-header">
						<span>Notifications</span>
						<span id="mark-all-read" style="font-size: 0.85em; font-weight: normal; cursor: pointer; color: #0645ad;">Mark all as read</span>
					</div>
					<div id="notifications-list"></div>
				</div>
				<div id="right-container">
					<div id="middle-top"></div>
					<div id="right-top"></div>
					<div id="right-content">
						<div id="main-container">
							<div id="diff-container"></div>
							<div id="progress-bar-container"></div>
							<div id="bottom-tools">
								<div id="bottom-tools-left">
									<div class="bottom-tool-item" data-menu="revert">
										<div class="bottom-tool-trigger">
											<i class="fas fa-undo"></i>
											<span>Revert & Warn</span>
											<i class="fas fa-chevron-up bottom-tool-chevron"></i>
										</div>
									</div>

									<div class="bottom-tool-item" data-menu="warn">
										<div class="bottom-tool-trigger">
											<i class="fas fa-exclamation-triangle"></i>
											<span>Warn</span>
											<i class="fas fa-chevron-up bottom-tool-chevron"></i>
										</div>
									</div>

									<div class="bottom-tool-item" data-menu="user">
										<div class="bottom-tool-trigger">
											<i class="fas fa-user"></i>
											<span>User</span>
											<i class="fas fa-chevron-up bottom-tool-chevron"></i>
										</div>
									</div>

									<div class="bottom-tool-item" data-menu="page">
										<div class="bottom-tool-trigger">
											<i class="fas fa-file-lines"></i>
											<span>Page</span>
											<i class="fas fa-chevron-up bottom-tool-chevron"></i>
										</div>
									</div>

									<div class="bottom-tool-item" data-menu="edit">
										<div class="bottom-tool-trigger">
											<i class="fas fa-pen-to-square"></i>
											<span>Edit</span>
											<i class="fas fa-chevron-up bottom-tool-chevron"></i>
										</div>
									</div>
								</div>

								<div id="bottom-tools-stats">
									<div class="stat-item">
										<i class="fas fa-user"></i>
										<span class="bottom-stat-value" id="stat-total-contribs">-</span>
										<span>edits</span>
									</div>
								</div>
							</div>
						</div>
						<div id="right-details">
							<div class="width-adjust" id="details-width-adjust"></div>
							<div id="user-contribs">
								<div id="user-contribs-top">
									<div id="user-contribs-left">
											<div id="user-contribs-title">User Contributions</div>
										<div id="user-contribs-count">_ edits</div>
									</div>
									<div id="block-count-indicator" style="display: none;"></div>
									<div id="user-contribs-level" data-tooltip="Warning level">0</div>
								</div>
								<div id="user-contribs-content"></div>
							</div>
							<div class="height-adjust"></div>
							<div id="page-history">
								<div id="page-history-top">
									<div>
										<div id="page-history-title">Page History</div>
										<div id="page-metadata" style="font-size: 0.75em; color: #666; margin-top: 3px;"></div>
									</div>
									<div id="protection-indicator"></div>
								</div>
								<div id="page-history-content"></div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="bottom-tool-menu" id="revert-menu"></div>
			<div class="bottom-tool-menu" id="warn-menu"></div>
			<div class="bottom-tool-menu" id="user-menu">
				<div id="user-open-user-page" class="menu-option">
					<i class="fas fa-user-circle"></i>
					<span>Open user page</span>
					<i class="fas fa-arrow-up-right-from-square menu-option-icon"></i>
				</div>
				<div id="user-open-user-talk" class="menu-option">
					<i class="fas fa-comments"></i>
					<span>Open user talk</span>
					<i class="fas fa-arrow-up-right-from-square menu-option-icon"></i>
				</div>
				<div id="user-view-contribs" class="menu-option">
					<i class="fas fa-list"></i>
					<span>View contributions</span>
					<i class="fas fa-arrow-up-right-from-square menu-option-icon"></i>
				</div>
				<div id="user-view-filter-log" class="menu-option">
					<i class="fas fa-filter"></i>
					<span>View filter log</span>
					<i class="fas fa-arrow-up-right-from-square menu-option-icon"></i>
				</div>
				<div class="menu-divider"></div>
				<div id="user-add-whitelist" class="menu-option">
					<i class="fas fa-user-check"></i>
					<span>Add to whitelist</span>
				</div>
				<div id="user-highlight" class="menu-option">
					<i class="fas fa-star"></i>
					<span>Highlight user</span>
				</div>
				<div class="menu-divider"></div>
				<div id="user-welcome" class="menu-option submenu-trigger">
					<i class="fas fa-hand-wave"></i>
					<span>Welcome</span>
					<i class="fas fa-chevron-right menu-option-chevron"></i>
					<div class="submenu"></div>
				</div>
				<div id="user-report-aiv" class="menu-option submenu-trigger">
					<i class="fas fa-flag"></i>
					<span>Report (AIV)</span>
					<i class="fas fa-chevron-right menu-option-chevron"></i>
					<div class="submenu"></div>
				</div>
				<div id="user-report-uaa" class="menu-option submenu-trigger">
					<i class="fas fa-user-slash"></i>
					<span>Report (UAA)</span>
					<i class="fas fa-chevron-right menu-option-chevron"></i>
					<div class="submenu"></div>
				</div>
			</div>
			<div class="bottom-tool-menu" id="page-menu">
				<div id="page-open-page" class="menu-option">
					<i class="fas fa-file"></i>
					<span>Open page</span>
					<i class="fas fa-arrow-up-right-from-square menu-option-icon"></i>
				</div>
				<div id="page-open-talk" class="menu-option">
					<i class="fas fa-comments"></i>
					<span>Open talk page</span>
					<i class="fas fa-arrow-up-right-from-square menu-option-icon"></i>
				</div>
				<div id="page-view-history" class="menu-option">
					<i class="fas fa-clock-rotate-left"></i>
					<span>View page history</span>
					<i class="fas fa-arrow-up-right-from-square menu-option-icon"></i>
				</div>
				<div class="menu-divider"></div>
				<div id="page-request-protection" class="menu-option submenu-trigger">
					<i class="fas fa-shield-halved"></i>
					<span>Request protection</span>
					<i class="fas fa-chevron-right menu-option-chevron"></i>
					<div class="submenu"></div>
				</div>
			</div>
			<div class="bottom-tool-menu" id="edit-menu">
				<div id="edit-view-revision" class="menu-option">
					<i class="fas fa-eye"></i>
					<span>View revision</span>
					<i class="fas fa-arrow-up-right-from-square menu-option-icon"></i>
				</div>
				<div id="edit-view-diff" class="menu-option">
					<i class="fas fa-code-compare"></i>
					<span>View diff</span>
					<i class="fas fa-arrow-up-right-from-square menu-option-icon"></i>
				</div>
				<div class="menu-divider"></div>
				<div id="edit-thank-user" class="menu-option">
					<i class="fas fa-heart"></i>
					<span>Thank user</span>
				</div>
				<div id="edit-rollback" class="menu-option">
					<i class="fas fa-rotate-left"></i>
					<span>Rollback</span>
				</div>
				<div id="edit-rollback-goodfaith" class="menu-option submenu-trigger">
					<i class="fas fa-handshake"></i>
					<span>Rollback (good faith)</span>
					<i class="fas fa-chevron-right menu-option-chevron"></i>
					<div class="submenu"></div>
				</div>
				<div id="edit-undo" class="menu-option submenu-trigger">
					<i class="fas fa-arrow-rotate-left"></i>
					<span>Undo</span>
					<i class="fas fa-chevron-right menu-option-chevron"></i>
					<div class="submenu"></div>
				</div>
			</div>
		`,
		"edit-context-menu": `
			<div id="context-ores"><span id="context-ores-number">0</span> ORES score</div>
			<div id="context-remove">Remove from queue</div>
			<div id="context-whitelist">Whitelist user</div>
			<div id="context-open-history">View page history</div>
			<div id="context-open-contribs">View user contribs</div>
		`,
		"settings": `
			<div class="settings">
				<div class="settings-left">
					<div class="settings-category">
						<div class="settings-category-header">
							<span>CORE</span>
						</div>
						<div class="settings-left-menu-item" id="settings-general-button">
							<span>General</span>
						</div>
						<div class="settings-left-menu-item" id="settings-audio-button">
							<span>Audio</span>
						</div>
						<div class="settings-left-menu-item" id="settings-appearance-button">
							<span>Appearance</span>
						</div>
						<div class="settings-left-menu-item" id="settings-controls-button">
							<span>Controls</span>
						</div>
					</div>

					<div class="settings-category">
						<div class="settings-category-header">
							<span>MODERATION</span>
						</div>
						<div class="settings-left-menu-item" id="settings-ai-button">
							<span>AI Analysis</span>
						</div>
						<div class="settings-left-menu-item" id="settings-gadgets-button">
							<span>Gadgets</span>
						</div>
						<div class="settings-left-menu-item" id="settings-whitelist-button">
							<span>Whitelist</span>
						</div>
						<div class="settings-left-menu-item" id="settings-highlight-button">
							<span>Highlighted</span>
						</div>
					</div>

					<div class="settings-category">
						<div class="settings-category-header">
							<span>INFO</span>
						</div>
						<div class="settings-left-menu-item" id="settings-statistics-button">
							<span>Statistics</span>
						</div>
						<div class="settings-left-menu-item" id="settings-about-button">
							<span>About</span>
						</div>
					</div>

					<div class="settings-category">
						<div class="settings-category-header">
							<span>MISC</span>
						</div>
						<div class="settings-left-menu-item" id="settings-import-export-button">
							<span>Import / Export</span>
						</div>
					</div>
				</div>
				<div class="settings-right"></div>
			</div>
		`
	};

	class WikiShieldUtil {
		/**
		 * Given a Date object, return a string in the format YYYY-MM-DDTHH:MM:SS
		 * @param {Date} date The date to convert
		 * @returns {String} The date in the format YYYY-MM-DDTHH:MM:SS
		 */
		utcString(date) {
			return date.getUTCFullYear() + "-" +
				this.padString(date.getUTCMonth() + 1, 2) + "-" +
				this.padString(date.getUTCDate(), 2) + "T" +
				this.padString(date.getUTCHours(), 2) + ":" +
				this.padString(date.getUTCMinutes(), 2) + ":" +
				this.padString(date.getUTCSeconds(), 2);
		}

		/**
		 * Given a string and a length, pad the string with 0s to the left until it is the given length
		 * @param {String} str The string to pad
		 * @param {Number} len The length to pad to
		 * @returns {String} The padded string
		 */
		padString(str, len) {
			str = str.toString();
			while (str.length < len) {
				str = "0" + str;
			}
			return str;
		}

		/**
		 * Given a string, encode it for use in a URL
		 * @param {String} str The string to encode
		 * @returns {String} The encoded string
		 */
		encodeuri(str) {
			return encodeURIComponent(str);
		}

		/**
		 * Get the section name for the current month and year
		 * @returns {String} The section name
		 */
		monthSectionName() {
			const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
			const currentMonth = months[new Date().getUTCMonth()];
			const currentYear = new Date().getUTCFullYear();

			return currentMonth + " " + currentYear;
		}

		/**
		 * Convert expiry time string to milliseconds
		 * @param {String} expiryString The expiry string (e.g., "1 hour", "30 minutes", "1 week")
		 * @returns {Number} The number of milliseconds
		 */
		expiryToMilliseconds(expiryString) {
			const conversions = {
				"none": 0,
				"1 hour": 60 * 60 * 1000,
				"1 day": 24 * 60 * 60 * 1000,
				"1 week": 7 * 24 * 60 * 60 * 1000,
				"1 month": 4 * 7 * 24 * 60 * 60 * 1000,
				"3 months": 4 * 7 * 24 * 60 * 60 * 1000,
				"6 months": 4 * 7 * 24 * 60 * 60 * 1000,
				"indefinite": Infinity,
			};
			return conversions[expiryString] || conversions["1 hour"]; // Default to 1 hour
		}

		/**
		 * Given a string, escape it for use in HTML
		 * @param {String} str The string to escape
		 * @returns {String} The escaped string
		 */
		escapeHtml(str) {
			return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
		}

		/**
		 * Given the title of a page, return the URL to that page
		 * @param {String} title The title of the page
		 * @param {Boolean} usePhpString Whether to use /w/index.php in the link
		 * @returns {String} The URL to the page
		 */
		pageLink(title, usePhpString = false) {
			return usePhpString
				? `https://${wikishield.options.wiki}.wikipedia.org/w/index.php${title}`
				: `https://${wikishield.options.wiki}.wikipedia.org/wiki/${this.encodeuri(title)}`;
		}

		/**
		 * If the given string is longer than the given length, truncate it and add "..." to the end
		 * @param {String} str The string to truncate
		 * @param {Number} len The length to truncate to
		 * @returns {String} The truncated string
		 */
		maxStringLength(str, len) {
			return str.length > len ? str.substring(0, len) + "..." : str;
		}

		/**
		 * Given the number of bytes changed in an edit, return the color
		 * @param {Number} delta The number of bytes changed
		 * @returns {String} The color
		 */
		getChangeColor(delta) {
			if (delta === 0) return "#888"; // Gray for no change
			if (delta > 0) {
				// Green scale for additions
				if (delta >= 1000) return "#00b894"; // Bright green for large additions
				if (delta >= 500) return "#00d4a1"; // Medium-bright green
				if (delta >= 100) return "#26de81"; // Light green
				return "#55efc4"; // Very light green for small additions
			} else {
				// Red scale for deletions
				const absDelta = Math.abs(delta);
				if (absDelta >= 1000) return "#d63031"; // Deep red for large deletions
				if (absDelta >= 500) return "#e74c3c"; // Medium red
				if (absDelta >= 100) return "#ff6b6b"; // Light red
				return "#ff8787"; // Very light red for small deletions
			}
		}

		/**
		 * Given the number of bytes changed in an edit, return the string (eg. "+100")
		 * @param {Number} delta The number of bytes changed
		 * @returns {String} The string
		 */
		getChangeString(delta) {
			return delta > 0 ? "+" + delta : (delta === 0 ? "0" : "&ndash;" + Math.abs(delta).toString());
		}

		/**
		 * Given a timestamp, return a string representing how long ago it was
		 * @param {String} timestamp The timestamp
		 * @returns {String} Time ago
		 */
		timeAgo(timestamp) {
			const difference = Date.now() - new Date(timestamp);
			const seconds = Math.floor(difference / 1000);

			// Handle future timestamps (clock skew)
			if (seconds < 0) {
				return "just now";
			}

			if (seconds > 60) {
				if (seconds > 60 * 60) {
					if (seconds > 60 * 60 * 24) {
						const val = Math.floor(seconds / 60 / 60 / 24);
						return val + " day" + (val !== 1 ? "s" : "") + " ago";
					}
					const val = Math.floor(seconds / 60 / 60);
					return val + " hour" + (val !== 1 ? "s" : "") + " ago";
				}
				const val = Math.floor(seconds / 60);
				return val + " minute" + (val !== 1 ? "s" : "") + " ago";
			}
			return seconds + " second" + (seconds !== 1 ? "s" : "") + " ago";
		}
	}

	class WikiShieldLog {
		/**
		 * Log a message to the console
		 * @param {String} text The message to log
		 */
		log(text) {
			console.log(`🛡️WikiShield: ${text}`);
		}
	}

	class WikiShieldAPI {
		constructor(api) {
			this.api = api;
		}

		/**
		 * Edit the given page with the given content and summary
		 * @param {String} title The title of the page to edit
		 * @param {String} content The content to edit the page with
		 * @param {String} summary The edit summary
		 * @param {Object} params Any additional parameters to pass to the API
		 * @returns {Promise<Boolean>}
		 */
		async edit(title, content, summary, params = {}) {
			if (wikishield.testingMode) {
				console.log("Edit", { title, content, summary });
				return true;
			}

			try {
				await this.api.postWithEditToken(Object.assign({}, {
					"action": "edit",
					"title": title,
					"text": content,
					"summary": summary,
					"format": "json",
					"tags": "WikiShield script"
				}, params));

				return true;
			} catch (err) {
				wikishield.logger.log(`Could not edit page ${title}: ${err}`);
				return false;
			}
		}

		/**
		 * Edit a page to append text
		 * @param {String} title The title of the page to edit
		 * @param {String} content Content to append to the page
		 * @param {String} summary Edit summary to use
		 * @returns {Promise<Boolean>}
		 */
		async appendText(title, content, summary) {
			if (wikishield.testingMode) {
				console.log("Append text", { title, content, summary });
				return true;
			}

			try {
				await this.api.postWithEditToken({
					"action": "edit",
					"title": title,
					"appendtext": "\n" + content,
					"summary": summary,
					"format": "json",
					"tags": "WikiShield script"
				});

				return true;
			} catch (err) {
				console.log(`Could not append text to page ${title}: ${err}`);
				return false;
			}
		}

		/**
		 * Get the content of the given pages
		 * @param {String} titles The titles of the pages to get, separated by "|"
		 * @returns {Promise<Object>} The content of the pages
		 */
		async getText(titles) {
			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "revisions",
					"titles": titles,
					"rvprop": "content",
					"rvslots": "*",
					"format": "json",
					"formatversion": 2
				});

				const pages = response.query.pages.map(page => {
					return [page.title, page.missing ? "" : page.revisions[0].slots.main.content];
				});

				return pages
					.reduce((a, v) => ({ ...a, [v[0]]: v[1] }), {});
			} catch (err) {
				wikishield.logger.log(`Could not fetch page ${titles}: ${err}`);
			}
		}

		/**
		 * Get the content of a single page
		 * @param {String} title
		 * @returns {Promise<String>} The page content
		 */
		async getSinglePageContent(title) {
			try {
				const data = await this.getText(title);
				return data[title];
			} catch (err) {
				console.log("Could not fetch page", err);
			}
		}

		/**
		 * Check if a page exists
		 * @param {String} title The title of the page to check
		 * @returns {Promise<Boolean>} Whether the page exists
		 */
		async pageExists(title) {
			try {
				const response = await this.api.get({
					"action": "query",
					"titles": title,
					"format": "json",
					"formatversion": 2
				});

				return response.query.pages[0].missing !== true;
			} catch (err) {
				wikishield.logger.log(`Could not check if page ${title} exists: ${err}`);
				return false;
			}
		}

		/**
		 * Get the content of the given revision id
		 * @param {Number} revid The revision id to get
		 * @returns {Promise<String>} The content of the revision
		 */
		async getTextByRevid(revid) {
			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "revisions",
					"revids": revid,
					"rvprop": "content",
					"rvslots": "*",
					"format": "json",
					"formatversion": 2
				});

				const page = response.query.pages[0];
				return page.missing ? "" : page.revisions[0].slots.main.content;
			} catch (err) {
				wikishield.logger.log(`Could not fetch page with revid ${revid}: ${err}`);
			}
		}

		/**
		 * Get full revision data by revision ID
		 * @param {Number} revid The revision ID
		 * @returns {Promise<Object>} Revision data including user, comment, timestamp, size
		 */
		async getRevisionData(revid) {
			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "revisions",
					"revids": revid,
					"rvprop": "ids|user|comment|timestamp|size",
					"format": "json",
					"formatversion": 2
				});

				const page = response.query.pages[0];
				if (page.missing || !page.revisions || page.revisions.length === 0) {
					return null;
				}

				const rev = page.revisions[0];
				return {
					revid: rev.revid,
					parentid: rev.parentid,
					user: rev.user,
					comment: rev.comment || "",
					timestamp: rev.timestamp,
					size: rev.size,
					oldlen: rev.parentid ? null : 0  // Will need to fetch parent for actual oldlen
				};
			} catch (err) {
				wikishield.logger.log(`Could not fetch revision data for revid ${revid}: ${err}`);
				return null;
			}
		}

		/**
		 * Get the difference between two revisions of the given page
		 * @param {String} title The title of the page
		 * @param {Number} old_revid The old revision ID
		 * @param {Number} revid The new revision ID
		 * @returns {Promise<String>} The difference between the two revisions, in HTML format
		 */
		async diff(title, old_revid, revid) {
			try {
				const response = await this.api.get({
					"action": "compare",
					"fromrev": old_revid,
					"torev": revid,
					"prop": "diff",
					"format": "json",
					"formatversion": 2
				});

				return response.compare.body;
			} catch (err) {
				wikishield.logger.log(`Could not fetch diff for page ${title}: ${err}`);
			}
		}

		/**
		 * Get the number of reverts
		 * @param {String} title The title of the page
		 * @param {String} user The username to check for reverts
		 */
		async countReverts(title, user) {
			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "revisions",
					"titles": title,
					"rvstart": wikishield.util.utcString(new Date(Date.now() - 8.64e+7)),
					"rvdir": "newer",
					"rvuser": user,
					"rvprop": "timestamp|tags",
					"rvlimit": "max",
					"format": "json",
					"formatversion": 2
				});

				const revisions = response.query.pages[0].revisions;
				if (revisions === undefined) {
					return 0;
				}

				return revisions.filter(revision => revision.tags.some(tag => tag === "mw-undo" || tag === "mw-rollback" || tag === "mw-manual-revert")).length;
			} catch (err) {
				wikishield.logger.log(`Could not fetch revert count for page ${title}: ${err}`);
			}
		}

		/**
		 * Get the categories of the revision
		 * @param {Number} revid The revision ID
		 * @returns {Promise<Object>} The categories object
		 */
		async categories(revid) {
			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "categories",
					"revids": revid,
					"cllimit": "max",
					"format": "json",
					"formatversion": 2
				});

				return response.query.pages[0].categories;
			} catch (err) {
				wikishield.logger.log(`Could not fetch categories for revision ${revid}: ${err}`);
			}
		}

		/**
		 * Check for consecutive edits
		 * @param {String} title The title of the page
		 * @param {String} user The user
		 * @returns {Promise<Object>} Return the consecutive edit object
		 */
		async consecutiveEdits(title, user) {
			try {
				const history = await this.history(title);
				if (history.length > 0 && history[0].user === user) {
					let count = 0;
					let sizediff = 0;
					let oldest;
					for (const item of history) {
						if (item.user !== user) {
							break;
						}

						count++;
						sizediff += item.sizediff;
						oldest = item;
					}

					return { timestamp: oldest.timestamp, count, sizediff };
				}

				return null;
			} catch (err) {
				console.log("Error geting consecutive edits:", err);
				return null;
			}
		}

		/**
		 * Get the contributions of the given user
		 * @param {String} user The user to get contributions for
		 * @returns {Promise<Array>} The contributions
		 */
		async contribs(user) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "usercontribs",
					"ucuser": user,
					"uclimit": 10,
					"ucprop": "title|ids|timestamp|comment|flags|sizediff|tags",
					"format": "json",
					"formatversion": 2
				});

				return response.query.usercontribs;
			} catch (err) {
				wikishield.logger.log(`Could not fetch contributions for user ${user}: ${err}`);
			}
		}

		/**
		 * Get the edit count of the given users
		 * @param {String} users The users to get edit counts for, separated by "|"
		 * @returns {Promise<Array>} The edit counts
		 */
		async editCount(users) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "users",
					"ususers": users,
					"usprop": "editcount",
					"format": "json",
					"formatversion": 2
				});

				return response.query.users;
			} catch (err) {
				wikishield.logger.log(`Could not fetch edit count for users ${users}: ${err}`);
			}
		}

		/**
		 * Get the filter log of the given user
		 * @param {String} user The user to get the filter log for
		 * @returns {Promise<Array>} The filter log
		 */
		async filterLog(user) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "logevents",
					"letype": "filter",
					"leuser": user,
					"lelimit": 50,
					"format": "json",
					"formatversion": 2
				});

				return response.query.logevents;
			} catch (err) {
				wikishield.logger.log(`Could not fetch filter log for user ${user}: ${err}`);
			}
		}

		/**
		 * Get the number of times a user has been blocked
		 * @param {String} user The username to check
		 * @returns {Promise<Number>} The number of blocks
		 */
		async getBlockCount(user) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "logevents",
					"letype": "block",
					"letitle": `User:${user}`,
					"leaction": "block/block",
					"lelimit": "max",
					"format": "json",
					"formatversion": 2
				});

				return response.query.logevents ? response.query.logevents.length : 0;
			} catch (err) {
				console.log(`Could not fetch block count for user ${user}:`, err);
				return 0;
			}
		}

		/**
		 * Get detailed block history for a user
		 * @param {String} user The username
		 * @returns {Promise<Array>} Array of block log entries
		 */
		async getBlockHistory(user) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "logevents",
					"letype": "block",
					"letitle": `User:${user}`,
					"leaction": "block/block",
					"lelimit": 10,
					"leprop": "user|timestamp|comment|details",
					"format": "json",
					"formatversion": 2
				});

				return response.query.logevents || [];
			} catch (err) {
				console.log(`Could not fetch block history for user ${user}:`, err);
				return [];
			}
		}

		/**
		 * Get the history of the given page
		 * @param {String} page The page to get the history for
		 * @returns {Promise<Array>} The history
		 */
		async history(page) {
			try {
				const response = await this.api.get({
					"action": "query",
					"prop": "revisions",
					"titles": page,
					"rvprop": "title|ids|timestamp|comment|flags|sizediff|user|tags|size",
					"rvlimit": 11,
					"format": "json",
					"formatversion": 2
				});

				const revisions = response.query.pages[0].revisions;

				const count = Math.min(__script__.config.historyCount, revisions.length);
				for (let i = 0; i < count; i++) {
					if (i + 1 < revisions.length) {
						revisions[i].sizediff = revisions[i].size - revisions[i + 1].size;
					} else {
						revisions[i].sizediff = revisions[i].size;
					}
				}

				return revisions.splice(0, __script__.config.historyCount);
			} catch (err) {
				wikishield.logger.log(`Could not fetch history for page ${page}: ${err}`);
			}
		}

		/**
		 * Get page protection information
		 * @param {String} page The page title
		 * @returns {Promise<Object>} Protection info with level and type
		 */
		async getPageProtection(page) {
			try {
				const response = await this.api.get({
					"action": "query",
					"titles": page,
					"prop": "info",
					"inprop": "protection",
					"format": "json",
					"formatversion": 2
				});

				const pageData = response.query.pages[0];
				if (pageData && pageData.protection && pageData.protection.length > 0) {
					// Get the highest protection level
					const protections = pageData.protection;
					let highestLevel = null;
					let types = [];

					for (const prot of protections) {
						types.push(prot.type);
						if (prot.level === "sysop") {
							highestLevel = "full";
						} else if (prot.level === "autoconfirmed" && highestLevel !== "full") {
							highestLevel = "semi";
						} else if (prot.level === "extendedconfirmed" && highestLevel !== "full") {
							highestLevel = "extended";
						}
					}

					return {
						protected: true,
						level: highestLevel,
						types: types
					};
				}

				return { protected: false };
			} catch (err) {
				console.log(`Could not fetch protection info for ${page}:`, err);
				return { protected: false };
			}
		}

		/**
		 * Get latest revision IDs for multiple pages
		 * @param {String} pages Pipe-separated list of page titles
		 * @returns {Promise<Object>} Object mapping page titles to latest revision IDs
		 */
		async getLatestRevisions(pages) {
			try {
				// Split pages string into array
				const pageArray = pages.split("|");

				const result = {};

				// Make individual requests for each page to avoid API parameter issues
				for (const page of pageArray) {
					try {
						const response = await this.api.get({
							"action": "query",
							"titles": page,
							"prop": "revisions",
							"rvprop": "ids",
							"rvlimit": 1,
							"format": "json"
						});

						if (response.query && response.query.pages) {
							for (const pageId in response.query.pages) {
								const pageData = response.query.pages[pageId];
								if (pageData.revisions && pageData.revisions.length > 0 && pageData.title) {
									result[pageData.title] = pageData.revisions[0].revid;
								}
							}
						}
					} catch (pageErr) {
						// Skip pages that fail individually
						console.log(`Failed to fetch revision for ${page}: ${pageErr}`);
					}
				}

				return result;
			} catch (err) {
				wikishield.logger.log(`Could not fetch latest revisions: ${err}`);
				return {};
			}
		}

		/**
		 * Get page metadata including date format and English variant
		 * @param {String} page The page title
		 * @returns {Promise<Object>} Object with dateFormat and englishVariant, plus any other detected templates
		 */
		async getPageMetadata(page) {
			try {
				// Get the page content to check for templates
				const contentResponse = await this.api.get({
					"action": "parse",
					"page": page,
					"prop": "wikitext",
					"format": "json",
					"formatversion": 2
				});

				const wikitext = contentResponse.parse ? contentResponse.parse.wikitext : "";

				// Define template patterns to search for
				const templatePatterns = {
					dateFormat: {
						patterns: [
							{ regex: /\{\{Use dmy dates/i, value: "dmy (day-month-year)" },
							{ regex: /\{\{Use mdy dates/i, value: "mdy (month-day-year)" },
							{ regex: /\{\{Use ymd dates/i, value: "ymd (year-month-day)" },
							{ regex: /\{\{Use dMy dates/i, value: "dMy (day Month year)" }
						],
						default: "Unknown"
					},
					englishVariant: {
						patterns: [
							{ regex: /\{\{Use British English/i, value: "British English" },
							{ regex: /\{\{Use American English/i, value: "American English" },
							{ regex: /\{\{Use Canadian English/i, value: "Canadian English" },
							{ regex: /\{\{Use Australian English/i, value: "Australian English" },
							{ regex: /\{\{Use New Zealand English/i, value: "New Zealand English" },
							{ regex: /\{\{Use Irish English/i, value: "Irish English" },
							{ regex: /\{\{Use South African English/i, value: "South African English" },
							{ regex: /\{\{Use Indian English/i, value: "Indian English" },
							{ regex: /\{\{Use Hong Kong English/i, value: "Hong Kong English" },
							{ regex: /\{\{Use Singapore English/i, value: "Singapore English" }
						],
						default: "Unknown"
					}
				};

				// Function to find matching template
				const findMatch = (patterns, text) => {
					for (const pattern of patterns) {
						if (pattern.regex.test(text)) {
							return pattern.value;
						}
					}
					return null;
				};

				// Build result object dynamically
				const result = {};

				for (const [key, config] of Object.entries(templatePatterns)) {
					const match = findMatch(config.patterns, wikitext);
					result[key] = match || config.default;
				}

				// Extract any other "Use" templates generically
				const otherUseTemplates = [];
				const useTemplateRegex = /\{\{Use ([^}|]+)(?:\|[^}]*)?\}\}/gi;
				let match;

				while ((match = useTemplateRegex.exec(wikitext)) !== null) {
					const templateName = match[1].trim();
					// Skip templates we've already categorized
					const alreadyCategorized = Object.values(templatePatterns)
						.flatMap(config => config.patterns)
						.some(pattern => pattern.regex.test(match[0]));

					if (!alreadyCategorized) {
						otherUseTemplates.push(templateName);
					}
				}

				if (otherUseTemplates.length > 0) {
					result.otherTemplates = otherUseTemplates;
				}

				return result;
			} catch (err) {
				wikishield.logger.log(`Could not fetch metadata for page ${page}: ${err}`);
				return { dateFormat: "Unknown", englishVariant: "Unknown" };
			}
		}

		/**
		 * Get recent edits to Wikipedia
		 * @param {String} namespaces The namespaces to get recent changes for, separated by "|"
		 * @param {String} since The timestamp to start from
		 * @returns {Promise<Array>} The recent changes
		 */
		async recentChanges(namespaces, since) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "recentchanges",
					"rcnamespace": namespaces,
					"rclimit": 50,
					"rcprop": "title|ids|sizes|flags|user|tags|comment|timestamp",
					"rctype": "edit",
					"format": "json",
					"rcstart": since || "",
					"rcdir": since ? "newer" : "older"
				});

				return response.query.recentchanges;
			} catch (err) {
				wikishield.logger.log(`Could not fetch recent changes: ${err}`);
			}
		}

		/**
		 * Get the ORES scores for the given revisions
		 * @param {String} revids The revision IDs to get ORES scores for, separated by "|"
		 * @returns {Promise<Object>} The ORES scores
		 */
		async ores(revids) {
			try {
				const response = await this.api.get({
					"action": "query",
					"format": "json",
					"formatversion": 2,
					"prop": "revisions",
					"revids": revids,
					"rvprop": "oresscores|ids",
					"rvslots": "*"
				});

				const scores = response.query.pages.map(page => {
					return "goodfaith" in page.revisions[0].oresscores ? [
						page.revisions[0].revid,
						page.revisions[0].oresscores.goodfaith.false
					] : [page.revisions[0].revid, 0];
				});

				return scores
					.reduce((a, v) => ({ ...a, [v[0]]: v[1] }), {});
			} catch (err) {
				wikishield.logger.log(`Could not fetch ORES scores for revision ${revids}: ${err}`);
			}
		}

		/**
		 * Check if the given users are blocked
		 * @param {String} users The users to get blocks for, separated by "|"
		 * @returns {Promise<Object>} The blocks
		 */
		async usersBlocked(users) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "blocks",
					"bkusers": users,
					"bkprop": "id|user|by|timestamp|expiry|reason",
					"format": "json",
					"formatversion": 2
				});

				const blocks = {};
				users.split("|").forEach(user => blocks[user] = false);
				response.query.blocks.forEach(block => blocks[block.user] = !block.partial);
				return blocks;
			} catch (err) {
				wikishield.logger.log(`Could not fetch blocks for users ${users}: ${err}`);
			}
		}

		/**
		 * Rollback the user's edits
		 * @param {String} title The title of the page to rollback
		 * @param {String} user The user to rollback
		 * @param {String} summary The summary to use for the rollback
		 * @returns {Promise<Boolean>} Whether the rollback was successful
		 */
		async rollback(title, user, summary) {
			if (wikishield.testingMode) {
				console.log("Rollback", { title, user, summary });
				return true;
			}

			try {
				await this.api.rollback(title, user, {
					"summary": summary,
					"tags": "WikiShield script"
				});

				return true;
			} catch (err) {
				console.log(err);
				return false;
			}
		}

		/**
		 * Undo a single edit
		 * @param {Object} edit The edit object to undo
		 * @param {String} reason The reason for undoing
		 * @returns {Promise<Boolean>} Whether the undo was successful
		 */
		async undoEdit(edit, reason) {
			if (wikishield.testingMode) {
				console.log("Undo", { edit, reason });
				return true;
			}

			try {
				// Get the revision ID to undo and the previous revision
				const revid = edit.revid;
				const title = edit.page.title;

				// Use the MediaWiki API to undo the edit
				await this.api.postWithToken("csrf", {
					"action": "edit",
					"title": title,
					"undo": revid,
					"summary": reason,
					"tags": "WikiShield script"
				});

				return true;
			} catch (err) {
				console.log("Error undoing edit:", err);
				return false;
			}
		}

		/**
		 * Block a user with the given details
		 * @param {String} user User to block
		 * @param {String} summary Reason to use when blocking
		 * @param {String} duration Length of time to block the user
		 * @param {Boolean} blockCreation Prevent user from creating accounts when blocked
		 * @param {Boolean} blockEmail Prevent user from sending emails
		 * @param {Boolean} blockTalk Prevent user from editing their own talk page
		 * @param {Boolean} anonOnly
		 * @returns {Promise<Boolean>} Whether the block was successful
		 */
		async block(user, summary, duration, blockCreation = false, blockEmail = false, blockTalk = false, anonOnly = true) {
			if (wikishield.testingMode) {
				console.log("Block", { user, summary, duration });
				return true;
			}

			try {
				await this.api.postWithToken("csrf", Object.assign(
					{
						"action": "block",
						"user": user,
						"expiry": duration,
						"reason": summary,
						"tags": "WikiShield script"
					},
					blockCreation ? { "nocreate": "" } : {},
					blockEmail ? { "noemail": "" } : {},
					blockTalk ? {} : { "allowusertalk": "" },
					anonOnly ? { "anononly": "" } : {}
				));

				return true;
			} catch (err) {
				console.log(err);
				return false;
			}
		}

		/**
		 * Thank a user for the given edit
		 * @param {Number} revid
		 * @returns {Promise<Boolean>} Whether the action was successful
		 */
		async thank(revid) {
			if (wikishield.testingMode) {
				console.log("Thank", { revid });
				return true;
			}

			try {
				await this.api.postWithToken("csrf", {
					"action": "thank",
					"rev": revid
				});

				return true;
			} catch (err) {
				console.log(err);
				return false;
			}
		}

		/**
		 * Get level and expiry of edit and move protections for a page
		 * @param {String} page Name of the page to get details for
		 * @returns {Promise<Object>} The details of the protection
		 */
		async getProtectionDetails(page) {
			try {
				const response = await this.api.get({
					"action": "query",
					"list": "logevents",
					"letype": "protect",
					"letitle": page,
					"lelimit": 1
				});

				const details = {
					edit: "all", editExpiry: "infinite",
					move: "all", moveExpiry: "infinite"
				};

				if (Object.keys(response).includes("params") && Object.keys(response.params).includes("details")) {
					for (const item of response.params.details) {
						if (item.type === "edit") {
							details.edit = item.level;
							details.editExpiry = item.expiry;
						}

						if (item.type === "move") {
							details.move = item.level;
							details.moveExpiry = item.expiry;
						}
					}
				}

				return details;
			} catch (err) {
				console.log(err);
			}
		}

		/**
		 * Protect a page with the given details
		 * @param {String} page Page to protect
		 * @param {String} summary Summary to use in protection
		 * @param {Object} details Levels and expiry of protection
		 * @returns {Promise<Boolean>} Whether the protection was successful
		 */
		async protect(page, summary, details) {
			if (wikishield.testingMode) {
				console.log("Protect", { page, summary, details });
				return true;
			}

			try {
				await this.api.postWithToken("csrf", {
					"action": "protect",
					"title": page,
					"reason": summary,
					"protections": `edit=${details.edit}|move=${details.move}`,
					"expiry": `${details.editExpiry}|${details.moveExpiry}`,
					"tags": "WikiShield script"
				});

				return true;
			} catch (err) {
				console.log(err);
				return false;
			}
		}

		/**
		 * Make a GET request to the MediaWiki API
		 * @param {Object} params The parameters for the API request
		 * @returns {Promise<Object>} The API response
		 */
		async get(params) {
			return await this.api.get(params);
		}

		/**
		 * Make a POST request to the MediaWiki API with a token
		 * @param {String} tokenType The type of token to use
		 * @param {Object} params The parameters for the API request
		 * @returns {Promise<Object>} The API response
		 */
		async postWithToken(tokenType, params) {
			return await this.api.postWithToken(tokenType, params);
		}
	}

	class WikiShieldOllamaAI {
		constructor(serverUrl, model) {
			this.serverUrl = serverUrl || "http://localhost:11434";
			this.model = model || "";
			this.cache = new Map(); // Cache results to avoid repeated API calls
			this.rateLimitDelay = 1000; // Minimum delay between API calls
			this.lastCallTime = 0;
			this.availableModels = [];
			this.activeRequests = new Map(); // Track active requests by revid for cancellation
		}

		/**
		 * Fetch available models from Ollama server
		 * @returns {Promise<Array>} List of available models
		 */
		async fetchModels() {
			try {
				const response = await fetch(`${this.serverUrl}/api/tags`, {
					method: 'GET',
					headers: {
						'Content-Type': 'application/json'
					}
				});

				if (!response.ok) {
					throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
				}

				const data = await response.json();
				this.availableModels = data.models || [];
				return this.availableModels;
			} catch (err) {
				console.error('Error fetching Ollama models:', err);
				throw err;
			}
		}

		/**
		 * Test connection to Ollama server
		 * @returns {Promise<boolean>} True if server is reachable
		 */
		async testConnection() {
			try {
				const response = await fetch(`${this.serverUrl}/api/version`, {
					method: 'GET'
				});
				return response.ok;
			} catch (err) {
				console.error('Ollama connection test failed:', err);
				return false;
			}
		}

		/**
		 * Analyze an edit using Ollama AI
		 * @param {Object} edit The edit object containing diff, title, user, comment, etc.
		 * @returns {Promise<Object>} Analysis result with issues array and summary
		 */
		async analyzeEdit(edit) {
			if (!wikishield.options.enableOllamaAI || !wikishield.options.enableEditAnalysis) {
				return null;
			}

			if (!this.model) {
				console.error('No Ollama model selected');
				return null;
			}

			// Check cache
			const cacheKey = `${edit.revid}`;
			if (this.cache.has(cacheKey)) {
				return this.cache.get(cacheKey);
			}

			// Cancel any existing request for this edit
			if (this.activeRequests.has(cacheKey)) {
				this.activeRequests.get(cacheKey).abort();
				this.activeRequests.delete(cacheKey);
			}

			// Create abort controller for this request
			const abortController = new AbortController();
			this.activeRequests.set(cacheKey, abortController);

			// Rate limiting
			const now = Date.now();
			const timeSinceLastCall = now - this.lastCallTime;
			if (timeSinceLastCall < this.rateLimitDelay) {
				await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastCall));
			}

			// Check if request was cancelled during rate limit delay
			if (abortController.signal.aborted) {
				this.activeRequests.delete(cacheKey);
				console.log(`AI analysis cancelled for edit ${cacheKey} (during rate limit)`);
				return null;
			}

			try {
				const prompt = this.buildAnalysisPrompt(edit);
				const response = await this.callOllamaAI(prompt, abortController.signal);
				const analysis = this.parseOllamaResponse(response);

				// Cache the result
				this.cache.set(cacheKey, analysis);

				// Limit cache size
				if (this.cache.size > 100) {
					const firstKey = this.cache.keys().next().value;
					this.cache.delete(firstKey);
				}

				this.lastCallTime = Date.now();

				// Clean up active request
				this.activeRequests.delete(cacheKey);

				return analysis;
			} catch (err) {
				// Clean up active request
				this.activeRequests.delete(cacheKey);

				// If request was aborted, return null instead of error
				if (err.name === 'AbortError' || err.message?.includes('aborted')) {
					console.log(`AI analysis cancelled for edit ${cacheKey}`);
					return null;
				}

				console.error("Ollama AI analysis error:", err);
				return {
					hasIssues: false,
					issues: [],
					summary: "Analysis failed",
					error: err.message
				};
			}
		}

		/**
		 * Convert HTML diff to human-readable text format with context
		 * @param {String} diffHTML The HTML diff from MediaWiki
		 * @returns {String} Readable text representation
		 */
		convertDiffToReadable(diffHTML) {
			if (!diffHTML) return "No changes visible";

			// Create a temporary div to parse HTML
			const tempDiv = document.createElement('div');
			// Wrap in table since the diff HTML is just table rows
			tempDiv.innerHTML = `<table>${diffHTML}</table>`;

			let readableLines = [];
			let contextBuffer = []; // Buffer for context lines
			const MAX_CONTEXT = 2; // Number of context lines before/after changes

			// Get all table rows
			const rows = tempDiv.querySelectorAll('tr');

			const length = rows.length;
			for (let i = 0; i < length; i++) {
				const row = rows[i];

				// Skip line number rows
				if (row.querySelector('.diff-lineno')) {
					continue;
				}

				// Get the cells from both sides
				const marker = row.querySelector('.diff-marker');
				const leftCell = row.querySelector('.diff-side-deleted');
				const rightCell = row.querySelector('.diff-side-added');

				if (!leftCell || !rightCell) continue;

				// Check if this is a context line (unchanged on both sides)
				const isContext = leftCell.classList.contains('diff-context') &&
					rightCell.classList.contains('diff-context');

				if (isContext) {
					// Get the text content
					const contextText = this.cleanDiffText(leftCell);

					// Skip empty lines
					if (!contextText.trim() || contextText === '<br />') {
						continue;
					}

					// Add to context buffer
					contextBuffer.push(`  ${contextText}`);

					// Keep only last MAX_CONTEXT lines in buffer
					if (contextBuffer.length > MAX_CONTEXT) {
						contextBuffer.shift();
					}
				} else {
					// This is a change line
					// First, flush context buffer if we have any
					if (contextBuffer.length > 0) {
						// Add spacing if not first group
						if (readableLines.length > 0) {
							readableLines.push('');
						}
						readableLines.push(...contextBuffer);
						contextBuffer = [];
					}

					// Process the change
					const markerText = marker?.getAttribute('data-marker') || '';

					if (markerText === '−' || leftCell.classList.contains('diff-deletedline')) {
						// Deleted line
						const text = this.cleanDiffText(leftCell, true);
						if (text.trim() && text !== '<br />') {
							readableLines.push(`- ${text}`);
						}
					}

					if (markerText === '+' || rightCell.classList.contains('diff-addedline')) {
						// Added line
						const text = this.cleanDiffText(rightCell, true);
						if (text.trim() && text !== '<br />') {
							readableLines.push(`+ ${text}`);
						}
					}

					// Clear context buffer after changes (we'll start fresh)
					contextBuffer = [];

					// Look ahead for immediate context after this change
					let contextLinesAfter = 0;
					const count = Math.min(i + 1 + MAX_CONTEXT, rows.length);
					for (let j = i + 1; j < count; j++) {
						const nextRow = rows[j];
						const nextLeft = nextRow.querySelector('.diff-side-deleted');
						const nextRight = nextRow.querySelector('.diff-side-added');

						if (!nextLeft || !nextRight) continue;

						const isNextContext = nextLeft.classList.contains('diff-context') &&
							nextRight.classList.contains('diff-context');

						if (isNextContext) {
							const nextText = this.cleanDiffText(nextLeft);
							if (nextText.trim() && nextText !== '<br />') {
								readableLines.push(`  ${nextText}`);
								contextLinesAfter++;
							}
						} else {
							break; // Stop at next change
						}
					}

					// Skip the context lines we just added
					i += contextLinesAfter;
				}
			}

			// If no changes were found
			if (readableLines.length === 0) {
				return "No significant changes detected in diff";
			}

			// Limit output to prevent token explosion
			if (readableLines.length > 60) {
				const kept = readableLines.slice(0, 60);
				kept.push(`\n... (${readableLines.length - 60} more lines omitted)`);
				return kept.join('\n');
			}

			return readableLines.join('\n');
		}

		/**
		 * Clean and extract text from a diff cell
		 * @param {Element} cell The diff cell element
		 * @param {Boolean} highlightChanges Whether to highlight ins/del tags
		 * @returns {String} Clean text content
		 */
		cleanDiffText(cell, highlightChanges = false) {
			if (!cell) return '';

			const div = cell.querySelector('div');
			if (!div) {
				const text = cell.textContent || '';
				return text.trim();
			}

			const clone = div.cloneNode(true);

			if (highlightChanges) {
				// Highlight inline insertions
				const insElements = clone.querySelectorAll('ins');
				insElements.forEach(ins => {
					const text = ins.textContent || '';
					ins.replaceWith(`[[${text}]]`);
				});

				// Highlight inline deletions
				const delElements = clone.querySelectorAll('del');
				delElements.forEach(del => {
					const text = del.textContent || '';
					del.replaceWith(`~~${text}~~`);
				});
			} else {
				// For context lines, just remove the tags
				const insElements = clone.querySelectorAll('ins');
				insElements.forEach(ins => {
					ins.replaceWith(ins.textContent || '');
				});

				const delElements = clone.querySelectorAll('del');
				delElements.forEach(del => {
					del.replaceWith(del.textContent || '');
				});
			}

			// Get text and clean up
			let text = clone.textContent || clone.innerText || '';

			// Clean up excessive whitespace but preserve structure
			text = text.replace(/\s+/g, ' ').trim();

			// Limit line length
			if (text.length > 500) {
				text = text.substring(0, 500) + '...';
			}

			return text;
		}	/**
		* Build the prompt for AI analysis
		* @param {Object} edit The edit object
		* @returns {String} The prompt text
		*/
		buildAnalysisPrompt(edit) {
			return BuildAIAnalysisPrompt(edit);
		}

		/**
		 * Generate prompt for username analysis
		 * @param {String} username The username to analyze
		 * @param {String} pageTitle The page the user was editing
		 * @returns {String} The prompt for username analysis
		 */
		buildUsernamePrompt(username, pageTitle) {
			return BuildAIUsernamePrompt(username, pageTitle);
		}

		/**
		 * Call Ollama AI API
		 * @param {String} prompt The prompt to send
		 * @param {AbortSignal} signal Optional abort signal for cancellation
		 * @returns {Promise<String>} The AI response text
		 */
		async callOllamaAI(prompt, signal = null) {
			try {
				const fetchOptions = {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						model: this.model,
						prompt: prompt,
						format: { // json schema for response
							"type": "object",
							"properties": {
								"hasIssues": {
									"type": "boolean"
								},
								"probability": {
									"type": "number",
									"minimum": 0,
									"maximum": 100
								},
								"confidence": {
									"type": "string",
									"enum": ["high", "medium", "low"]
								},
								"reasoning": {
									"type": "string"
								},
								"issues": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"type": {
												"type": "string",
												"enum": ["vandalism", "spam", "pov", "unsourced", "attack", "copyright", "disruptive", "factual-error", "policy", "username"]
											},
											"severity": {
												"type": "string",
												"enum": ["critical", "major", "minor"]
											},
											"description": {
												"type": "string"
											}
										},
										"required": ["type", "severity", "description"]
									}
								},
								"constructive": {
									"type": "boolean"
								},
								"flagUsername": {
									"type": "boolean"
								},
								"summary": {
									"type": "string"
								},
								"action": {
									"type": "string",
									"enum": ["approve", "thank", "review", "warn", "warn-and-revert", "rollback", "report-aiv", "welcome"]
								},
								"recommendation": {
									"type": "string"
								}
							},
							"required": ["hasIssues", "probability", "confidence", "reasoning", "issues", "constructive", "summary", "action", "recommendation"]
						},
						stream: false,
						options: {
							temperature: 0.1,
							top_p: 0.9,
							num_predict: 1024
						}
					})
				};

				// Add abort signal if provided
				if (signal) {
					fetchOptions.signal = signal;
				}

				const response = await fetch(`${this.serverUrl}/api/generate`, fetchOptions);

				if (!response.ok) {
					throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
				}

				const data = await response.json();

				if (!data.response) {
					throw new Error('Empty response from Ollama');
				}

				return data.response;
			} catch (error) {
				throw new Error(`Ollama AI error: ${error?.message || 'Unknown error'}`);
			}
		}

		/**
		 * Parse the Ollama API response
		 * @param {String|Object} responseText The response from Ollama AI
		 * @returns {Object} Parsed analysis object
		 */
		parseOllamaResponse(responseText) {
			try {
				// Handle if responseText is an object (shouldn't happen but just in case)
				if (typeof responseText === 'object' && responseText !== null) {
					if (responseText.content) {
						responseText = responseText.content;
					} else {
						responseText = JSON.stringify(responseText);
					}
				}

				// Ensure responseText is a string
				if (typeof responseText !== 'string') {
					responseText = String(responseText);
				}

				// Try to extract JSON from markdown code blocks if present
				let jsonText = responseText.trim();
				const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
				if (jsonMatch) {
					jsonText = jsonMatch[1];
				} else {
					// Try to find JSON object - be more aggressive about finding the complete object
					// Match opening brace to closing brace, handling nested objects/arrays
					const startIdx = jsonText.indexOf('{');
					if (startIdx !== -1) {
						let depth = 0;
						let inString = false;
						let escapeNext = false;
						let foundComplete = false;

						const length = jsonText.length;
						for (let i = startIdx; i < length; i++) {
							const char = jsonText[i];

							if (escapeNext) {
								escapeNext = false;
								continue;
							}

							if (char === '\\') {
								escapeNext = true;
								continue;
							}

							if (char === '"') {
								inString = !inString;
								continue;
							}

							if (inString) continue;

							if (char === '{' || char === '[') depth++;
							if (char === '}' || char === ']') depth--;

							if (depth === 0 && i > startIdx) {
								jsonText = jsonText.substring(startIdx, i + 1);
								foundComplete = true;
								break;
							}
						}

						// If we didn't find a complete JSON object, try to fix it
						if (!foundComplete) {
							jsonText = jsonText.substring(startIdx);
							// Count unclosed braces and brackets
							let openBraces = 0;
							let openBrackets = 0;
							inString = false;
							escapeNext = false;

							const length = jsonText.length;
							for (let i = 0; i < length; i++) {
								const char = jsonText[i];

								if (escapeNext) {
									escapeNext = false;
									continue;
								}

								if (char === '\\') {
									escapeNext = true;
									continue;
								}

								if (char === '"') {
									inString = !inString;
									continue;
								}

								if (inString) continue;

								if (char === '{') openBraces++;
								if (char === '}') openBraces--;
								if (char === '[') openBrackets++;
								if (char === ']') openBrackets--;
							}

							// Add missing closing brackets and braces
							while (openBrackets > 0) {
								jsonText += ']';
								openBrackets--;
							}
							while (openBraces > 0) {
								jsonText += '}';
								openBraces--;
							}
						}
					}
				}

				// Remove JavaScript-style comments that may be in the JSON
				// This handles both // single-line and /* multi-line */ comments
				jsonText = jsonText
					// Remove single-line comments (// ...) but not inside strings
					.split('\n')
					.map(line => {
						// Simple approach: remove // comments if not inside quotes
						let inString = false;
						let result = '';

						const length = line.length;
						for (let i = 0; i < length; i++) {
							if (line[i] === '"' && (i === 0 || line[i - 1] !== '\\')) {
								inString = !inString;
							}
							if (!inString && line[i] === '/' && line[i + 1] === '/') {
								break; // Stop processing this line
							}
							result += line[i];
						}
						return result;
					})
					.join('\n')
					// Remove multi-line comments /* ... */
					.replace(/\/\*[\s\S]*?\*\//g, '');

				const parsed = JSON.parse(jsonText);

				return {
					hasIssues: parsed.hasIssues || false,
					probability: parsed.probability || 0,
					confidence: parsed.confidence || 'low',
					reasoning: parsed.reasoning || '',
					issues: parsed.issues || [],
					constructive: parsed.constructive !== undefined ? parsed.constructive : true,
					summary: parsed.summary || 'No issues detected',
					action: parsed.action || 'review',
					recommendation: parsed.recommendation || 'No specific recommendation',
					rawResponse: responseText
				};
			} catch (err) {
				console.error("Failed to parse Ollama response:", err);
				console.log("Raw response:", responseText);

				// Ensure responseText is a string for fallback processing
				const textStr = String(responseText);

				// Fallback: try to determine if there are issues from the text
				const hasIssues = textStr.toLowerCase().includes('issue') ||
					textStr.toLowerCase().includes('problem') ||
					textStr.toLowerCase().includes('vandalism');

				return {
					hasIssues: hasIssues,
					probability: hasIssues ? 50 : 10,
					confidence: 'low',
					issues: [],
					summary: hasIssues ? 'Potential issues detected (parsing failed)' : 'No clear issues detected',
					action: 'review',
					recommendation: 'Manual review recommended due to parsing error',
					rawResponse: responseText,
					parseError: err.message
				};
			}
		}

		/**
		 * Analyze a username to determine if it violates Wikipedia's username policy
		 * @param {String} username The username to analyze
		 * @param {String} pageTitle The page the user was editing
		 * @returns {Promise<Object>} Analysis result with shouldFlag, confidence, and reasoning
		 */
		async analyzeUsername(username, pageTitle) {
			if (!wikishield.options.enableOllamaAI || !wikishield.options.enableEditAnalysis) {
				return null;
			}

			try {
				// Build the username analysis prompt
				const prompt = this.buildUsernamePrompt(username, pageTitle);

				// Create abort controller for this request
				const controller = new AbortController();
				const cacheKey = `username:${username}`;
				this.activeRequests.set(cacheKey, controller);

				try {
					// Call Ollama AI with username-specific format
					const response = await fetch(`${this.serverUrl}/api/generate`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							model: this.model,
							prompt: prompt,
							format: {
								"type": "object",
								"properties": {
									"shouldFlag": {
										"type": "boolean"
									},
									"confidence": {
										"type": "number",
										"minimum": 0,
										"maximum": 1
									},
									"violationType": {
										"type": "string",
										"enum": ["promotional", "impersonation", "offensive", "confusing", "shared", "none"]
									},
									"reasoning": {
										"type": "string"
									},
									"recommendation": {
										"type": "string"
									}
								},
								"required": ["shouldFlag", "confidence", "violationType", "reasoning", "recommendation"]
							},
							stream: false,
							options: {
								temperature: 0.1,
								top_p: 0.9,
								num_predict: 512
							}
						}),
						signal: controller.signal
					});

					if (!response.ok) {
						throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
					}

					const data = await response.json();

					if (!data.response) {
						throw new Error('Empty response from Ollama');
					}

					// Parse the response
					const parsed = JSON.parse(data.response);

					return {
						shouldFlag: parsed.shouldFlag || false,
						confidence: parsed.confidence || 0,
						violationType: parsed.violationType || 'none',
						reasoning: parsed.reasoning || '',
						recommendation: parsed.recommendation || ''
					};
				} finally {
					this.activeRequests.delete(cacheKey);
				}
			} catch (error) {
				// If the analysis was aborted (e.g., user cleared queue), don't log as error
				if (error.name === 'AbortError') {
					console.log('Username analysis cancelled for:', username);
					return {
						shouldFlag: false,
						confidence: 0,
						violationType: 'none',
						reasoning: 'Analysis cancelled',
						recommendation: '',
						cancelled: true
					};
				}

				console.error('Username analysis error:', error);
				return {
					shouldFlag: false,
					confidence: 0,
					violationType: 'none',
					reasoning: `Error analyzing username: ${error.message}`,
					recommendation: 'Manual review recommended due to analysis error',
					error: error.message
				};
			}
		}

		/**
		 * Clear the analysis cache
		 */
		clearCache() {
			this.cache.clear();
		}

		/**
		 * Cancel a specific edit analysis request
		 * @param {String|Number} revid The revision ID to cancel
		 */
		cancelAnalysis(revid) {
			const cacheKey = `${revid}`;
			if (this.activeRequests.has(cacheKey)) {
				console.log(`Cancelling AI analysis for edit ${cacheKey}`);
				this.activeRequests.get(cacheKey).abort();
				this.activeRequests.delete(cacheKey);
			}
		}

		/**
		 * Cancel all active analysis requests
		 */
		cancelAllAnalyses() {
			console.log(`Cancelling ${this.activeRequests.size} active AI analysis requests`);
			for (const [, controller] of this.activeRequests.entries()) {
				controller.abort();
			}
			this.activeRequests.clear();
		}
	}

	class WikiShieldQueue {
		constructor() {
			this.queue = [];
			this.previousItems = [];
			this.editsSince = "";
			this.lastRevid = 0;
			this.currentEdit = null;
			this.backoff = 2000;
		}

		/**
		 * Fetch recent changes from the API
		 */
		async fetchRecentChanges() {
			if (this.queue.length >= wikishield.options.maxQueueSize) {
				window.setTimeout(this.fetchRecentChanges.bind(this), __script__.config.refresh);
				return;
			}

			try {
				this.editsSince = wikishield.util.utcString(new Date());

				const namespaceString = wikishield.options.namespacesShown.join("|");
				const recentChanges = (await wikishield.api.recentChanges(namespaceString))
					.filter(edit => edit.revid > this.lastRevid);

				this.lastRevid = Math.max(...recentChanges.map(edit => edit.revid));

                // remove outdated edits
                for (const recentChange of recentChanges) {
                    const itemsToRemove = [];
                    for (const queueItem of this.queue) {
                        // Skip the currently selected edit
                        if (this.currentEdit && queueItem.revid === this.currentEdit.revid) {
                            continue;
                        }
                        // Remove if same page and older revision
                        if (queueItem.page.title === recentChange.title && queueItem.revid < recentChange.revid) {
                            itemsToRemove.push(queueItem);
                            console.log(`Removing outdated edit when adding new item: ${queueItem.page.title} (rev ${queueItem.revid}, newer is ${recentChange.revid})`);
                        }
                    }

                    // Remove the outdated items
                    for (const oldItem of itemsToRemove) {
                        const index = this.queue.indexOf(oldItem);
                        if (index > -1) {
                            this.queue.splice(index, 1);
                            wikishield.interface.removeQueueItem(oldItem.revid);
                        }
                    }
                }

                const usersToFetch = recentChanges.reduce((str, edit) => str + (str === "" ? "" : "|") + edit.user, "");
				const editCounts = (await wikishield.api.editCount(usersToFetch))
					.filter(user => user.invalid || user.editcount <= wikishield.options.maxEditCount);

				const dict = editCounts
					.reduce((a, v) => ({ ...a, [v.name]: v.editcount }), {});

				const warnings = (await wikishield.api.getText(
					recentChanges.reduce((str, edit) => str + (str === "" ? "" : "|") + `User_talk:${edit.user}`, "")
				));

				const blocks = await wikishield.api.usersBlocked(usersToFetch);

				const ores = (await wikishield.api.ores(recentChanges.reduce((str, edit) => str + (str === "" ? "" : "|") + edit.revid, "")));

				recentChanges
					.filter(edit => edit.user in dict)
					.filter(edit => (ores[edit.revid] || 0) >= wikishield.options.minimumORESScore || wikishield.highlighted.has(edit.user))
					.filter(edit => !wikishield.whitelist.has(edit.user))
					.forEach(async edit => {
						const talkPageText = warnings[`User talk:${edit.user}`] || "";

						this.addQueueItem(
							edit,
							dict[edit.user] || -1,
							this.getWarningLevel(talkPageText),
							ores[edit.revid] || 0,
							blocks[edit.user] || false,
							!(await wikishield.api.pageExists(`User talk:${edit.user}`))
						);
					});

				// Check for outdated edits in queue
				await this.checkForOutdatedEdits();

				this.backoff = __script__.config.refresh;
			} catch (err) {
				console.log("Error while fetching recent changes", err);
				this.backoff = Math.min(this.backoff * 2, 120000);
			}

			window.setTimeout(this.fetchRecentChanges.bind(this), this.backoff);
		}

		/**
		 * Add an edit to the queue
		 * @param {Object} edit The edit to add
		 * @param {Number} count The edit count of the user
		 * @param {String} warningLevel The warning level of the user
		 * @param {Number} ores The ORES score of the edit
		 * @param {Boolean} blocked Whether the user is blocked
		 * @param {Boolean} emptyTalkPage Whether the user's talk page is empty
		 */
		async addQueueItem(edit, count, warningLevel, ores, blocked, emptyTalkPage) {
			if (this.queue.filter(e => e.revid === edit.revid).length > 0 ||
				this.previousItems.filter(e => e.revid === edit.revid).length > 0) {
				return;
			}

			const item = await this.generateQueueItem(edit, count, warningLevel, ores, blocked, null, null, emptyTalkPage);

			this.queue.push(item);
			const sorted = this.queue.splice(1)
				.sort((a, b) => {
					const bScore = b.ores + (wikishield.highlighted.has(b.user.name) ? 100 : 0);
					const aScore = a.ores + (wikishield.highlighted.has(a.user.name) ? 100 : 0);
					return bScore - aScore;
				});
			this.queue = [this.queue[0], ...sorted];

			// Only auto-select first edit if no edit is currently selected
			if (this.queue.length === 1 && !this.currentEdit) {
				this.currentEdit = this.queue[0];
			}

			// Play sound alert if ORES score is above threshold (but not on welcome screen)
			const welcomeScreen = document.getElementById("welcome-container");
			const isOnWelcomeScreen = welcomeScreen && welcomeScreen.style.display !== "none";

			if (wikishield.options.enableSoundAlerts && ores >= wikishield.options.soundAlertORESScore && !isOnWelcomeScreen) {
				this.playAlertSound();
			}

			wikishield.interface.renderQueue(this.queue, this.currentEdit);
		}

		/**
		 * Standardized sound playing function
		 * @param {String} triggerKey The trigger key (e.g., 'click', 'alert', etc.)
		 */
		playSound(triggerKey) {
            if (!wikishield.soundEnabled) return;

            const soundKey = wikishield.options.soundMappings?.[triggerKey] || triggerKey;
            const soundConfig = wikishieldData.sounds[soundKey];
            if (!soundConfig || soundKey === 'none') return;

            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                const audioContext = new AudioCtx();

                const masterVol = wikishield.options.masterVolume ?? 0.5;
                const soundVol = wikishield.options.volumes?.[triggerKey] ?? 0.5;
                const volume = masterVol * soundVol * (soundConfig.volume ?? 1);

                const repeats = soundConfig.repeats || [0];
                const freqs = soundConfig.frequencies;

                repeats.forEach((offset, i) => {
                    const freq = freqs[i % freqs.length];
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();

                    osc.connect(gain);
                    gain.connect(audioContext.destination);
                    osc.type = soundConfig.type;

                    const start = audioContext.currentTime + offset;

                    // Frequency sweep or fixed frequency
                    if (soundConfig.sweep) {
                        osc.frequency.setValueAtTime(soundConfig.sweep.from, start);
                        osc.frequency.exponentialRampToValueAtTime(
                            soundConfig.sweep.to,
                            start + soundConfig.duration
                        );
                    } else {
                        osc.frequency.setValueAtTime(freq, start);
                    }

                    // Apply envelope first, then scale by volume
                    if (typeof soundConfig.envelope === 'function') {
                        soundConfig.envelope(gain, audioContext, start, volume);
                    }

                    osc.start(start);
                    osc.stop(start + soundConfig.duration);
                });
            } catch (err) {
                console.error(`Could not play ${soundKey}:`, err);
            }
        }

		/**
		 * Play an alert sound for high ORES scores
		 */
		playAlertSound() {
			this.playSound('alert');
		}

		/**
		 * Play a pleasant notification sound (two-tone chime)
		 */
		playNotificationSound() {
			this.playSound('notification');
		}

		/**
		 * Play a click sound (short pop)
		 */
		playClickSound() {
			this.playSound('click');
		}

		/**
		 * Play a whoosh sound (item removed/cleared)
		 */
		playWhooshSound() {
			this.playSound('whoosh');
		}

		/**
		 * Play a warning sound (for warn action)
		 */
		playWarnSound() {
			this.playSound('warn');
		}

		/**
		 * Play a rollback sound (swoosh with descending tone)
		 */
		playRollbackSound() {
			this.playSound('rollback');
		}

		/**
		 * Play a report sound (ascending alert)
		 */
		playReportSound() {
			this.playSound('report');
		}

		/**
		 * Play a thank sound (gentle chime)
		 */
		playThankSound() {
			this.playSound('thank');
		}

		/**
		 * Play a protection sound (shield sound)
		 */
		playProtectionSound() {
			this.playSound('protection');
		}

		/**
		 * Play a block sound (heavy impact)
		 */
		playBlockSound() {
			this.playSound('block');
		}

		/**
		 * Play a highlight/whitelist sound (sparkle)
		 */
		playSparkleSound() {
			this.playSound('sparkle');
		}

		/**
		 * Check and remove edits that have been superseded by newer edits on the same page
		 * NOTE: This now only removes edits that are NOT currently being viewed
		 */
		async checkForOutdatedEdits() {
			if (this.queue.length === 0) return;

			// Get all unique page titles from queue, filtering out invalid ones
			const allPageTitles = [...new Set(this.queue.map(item => item.page.title))];
			const pageTitles = allPageTitles;

			if (pageTitles.length === 0) return;

			// Fetch latest revision for each page
			const latestRevisions = await wikishield.api.getLatestRevisions(pageTitles.join("|"));

			// Track items to remove (but NOT the current edit being viewed)
			const itemsToRemove = [];

			for (const item of this.queue) {
				// Don't remove the edit that's currently being viewed
				if (this.currentEdit && item.revid === this.currentEdit.revid) {
					continue;
				}

				const latestRevid = latestRevisions[item.page.title];
				if (latestRevid && latestRevid > item.revid) {
					// This edit has been superseded
					itemsToRemove.push(item);
					console.log(`Removing outdated edit: ${item.page.title} (rev ${item.revid}, latest is ${latestRevid})`);
				}
			}

			// Remove outdated items
			if (itemsToRemove.length > 0) {
				for (const item of itemsToRemove) {
					const index = this.queue.indexOf(item);
					if (index > -1) {
						this.queue.splice(index, 1);
						wikishield.interface.removeQueueItem(item.revid);
					}
				}

				wikishield.interface.renderQueue(this.queue, this.currentEdit);
			}
		}

		/**
		 * Generate a queue item from an edit
		 * @param {Object} edit The edit to generate the queue item from
		 * @param {Number} count The edit count of the user
		 * @param {String} warningLevel The warning level of the user
		 * @param {Number} ores The ORES score of the edit
		 * @param {Boolean} blocked Whether the user is blocked
		 * @param {Boolean} emptyTalkPage Whether the user's talk page is empty
		 * @returns {Object} The queue item
		 */
		async generateQueueItem(edit, count, warningLevel, ores, blocked, contribs, history, emptyTalkPage) {
			contribs = contribs || await wikishield.api.contribs(edit.user);
			history = history || await wikishield.api.history(edit.title);
			const diff = await wikishield.api.diff(edit.title, edit.old_revid || edit.parentid, edit.revid);
			const metadata = await wikishield.api.getPageMetadata(edit.title);

			const categories = await wikishield.api.categories(edit.old_revid || edit.parentid) ?? [];

			// Check if diff mentions current user
			const currentUsername = mw.config.get("wgUserName");
			const reverts = await wikishield.api.countReverts(edit.title, currentUsername);

			let mentionsMe = false;
			if (currentUsername && diff) {
				// Create a temporary div to parse HTML and get text content
				const tempDiv = document.createElement("div");
				tempDiv.innerHTML = diff;
				const diffText = tempDiv.textContent || tempDiv.innerText || "";
				// Case-insensitive search for username
				mentionsMe = diffText.toLowerCase().includes(currentUsername.toLowerCase());
			}

			const queueItem = {
				page: {
					title: edit.title,
					history: history,
					dateFormat: metadata.dateFormat,
					englishVariant: metadata.englishVariant,
					categories: categories,
				},
				user: {
					name: edit.user,
					contribs: contribs,
					editCount: count,
					warningLevel: warningLevel,
					originalWarningLevel: warningLevel, // Store the warning level at time of queueing
					blocked: blocked,
					emptyTalkPage: emptyTalkPage !== undefined ? emptyTalkPage : false
				},
				ores: ores,
				revid: edit.revid,
				timestamp: edit.timestamp,
				comment: edit.comment,
				minor: "minor" in edit, // Store whether this is a minor edit (check if property exists)
				sizediff: (edit.newlen ? edit.newlen - edit.oldlen : edit.sizediff) || 0,
				diff: diff,
				tags: edit.tags,
				reviewed: false,
				mentionsMe: mentionsMe, // Flag if diff mentions current user
				aiAnalysis: null, // Will be populated asynchronously
				usernameAnalysis: null, // Will be populated asynchronously
				isBLP: categories.some(cat => cat.title === "Category:Living people"),
				reverts: reverts,
				consecutive: wikishield.api.consecutiveEdits(edit.title, edit.user)
			};

			// Perform AI analysis asynchronously if enabled
			if (wikishield.options.enableOllamaAI && wikishield.ollamaAI) {
				// Don't await - let it run in background and update when ready
				wikishield.ollamaAI.analyzeEdit(queueItem).then(analysis => {
					queueItem.aiAnalysis = analysis;
					// Update UI if this edit is currently being displayed
					if (this.currentEdit && this.currentEdit.revid === queueItem.revid) {
						wikishield.interface.updateAIAnalysisDisplay(analysis);
					}
				}).catch(err => {
					console.error("AI analysis failed:", err);
					queueItem.aiAnalysis = {
						hasIssues: false,
						error: err.message
					};
				});

				// Perform username analysis for registered users (not TEMPs) and not whitelisted
				if (!mw.util.isTemporaryUser(edit.user) && !wikishield.whitelist.has(edit.user)) {
					wikishield.ollamaAI.analyzeUsername(edit.user, edit.title).then(usernameAnalysis => {
						queueItem.usernameAnalysis = usernameAnalysis;

						// If username is flagged and not cancelled, prompt for UAA report
						if (usernameAnalysis && !usernameAnalysis.cancelled &&
							usernameAnalysis.shouldFlag && usernameAnalysis.confidence >= 0.5) {
							this.promptForUAAReport(queueItem);
						}
					}).catch(err => {
						console.error("Username analysis failed:", err);
						queueItem.usernameAnalysis = {
							shouldFlag: false,
							error: err.message
						};
					});
				}
			}

			return queueItem;
		}

		/**
		 * Given the text of a user talk page, get the warning level of the user
		 * @param {String} text The text of the user talk page
		 * @returns {String} The warning level of the user
		 */
		getWarningLevel(text) {
			const monthSections = text.split(/(?=== ?[\w\d ]+ ?==)/g);

			for (let section of monthSections) {
				if (new RegExp("== ?" + wikishield.util.monthSectionName() + " ?==").test(section)) {
					// Only match templates with numbered warning levels (e.g., uw-vandalism1, uw-test4im)
					// Excludes templates without numbers like uw-minor
					const templates = section.match(/<\!-- Template:[\w-]+?(\d(?:i?m)?) -->/g);
					if (templates === null) {
						return "0";
					}
					const filteredTemplates = templates.map(t => {
						const match = t.match(/<\!-- Template:[\w-]+?(\d(?:i?m)?) -->/);
						return match ? match[1] : "0";
					});
					return filteredTemplates.sort()[filteredTemplates.length - 1].toString();
				}
			}

			return "0";
		}

		/**
		 * Get detailed warning history from user talk page
		 * @param {String} text - User talk page content
		 * @returns {Array} Array of warning objects with template name, level, and timestamp
		 */
		getWarningHistory(text) {
			const warnings = [];
			const monthSections = text.split(/(?=== ?[\w\d ]+ ?==)/g);
			const currentMonthName = wikishield.util.monthSectionName();

			for (let section of monthSections) {
				// Check if this is the current month section
				const isCurrentMonth = new RegExp("== ?" + currentMonthName + " ?==").test(section);

				// Only process warnings from the current month (those that count toward warning level)
				if (!isCurrentMonth) {
					continue;
				}

				// Extract section title (month/year)
				const sectionMatch = section.match(/== ?([\w\d ]+) ?==/);
				const sectionTitle = sectionMatch ? sectionMatch[1] : "Unknown";

				// Find all warning templates with their full context
				const templateMatches = section.matchAll(/<\!-- Template:([\w-]+?)(\d(?:i?m)?) -->(.+?)(?=<\!-- Template:|$)/gs);

				for (let match of templateMatches) {
					const templateName = match[1]; // e.g., "uw-vandalism"
					const level = match[2]; // e.g., "1", "4", "4im"
					const content = match[3]; // Content after template

					// Try to extract timestamp (looks for signature pattern)
					// Extract the timestamp and remove any HTML tags
					const timestampMatch = content.match(/(\d{2}:\d{2}.*?\d{4} \(UTC\))/);
					let timestamp = timestampMatch ? timestampMatch[1] : null;
					if (timestamp) {
						// Remove any HTML tags from the timestamp
						timestamp = timestamp.replace(/<[^>]*>/g, '');
					}

					// Extract username from signature (look for User: or User talk: links)
					let username = null;
					const userLinkMatch = content.match(/\[\[User(?:[ _]talk)?:([^\]|]+)/i);
					if (userLinkMatch) {
						username = userLinkMatch[1].trim();
					}

					// Try to extract article name if present
					const articleMatch = content.match(/\[\[([^\]]+?)\]\]/);
					const article = articleMatch ? articleMatch[1] : null;

					warnings.push({
						template: templateName,
						level: level,
						timestamp: timestamp,
						username: username,
						article: article,
						section: sectionTitle,
						isCurrentMonth: isCurrentMonth
					});
				}
			}

			// Warnings are already from current month, just return them in order
			return warnings;
		}

		/**
		 * Set the current edit to the next item in the queue
		 * This only changes which edit is selected, it does NOT remove anything
		 */
		nextItem() {
			// If queue is empty, nothing to do
			if (this.queue.length === 0) {
				return;
			}

			// If no current edit, select the first item
			if (!this.currentEdit) {
				this.currentEdit = this.queue[0];
				wikishield.interface.renderQueue(this.queue, this.currentEdit);
				return;
			}

			// Find where the current edit is in the queue
			const currentIndex = this.queue.findIndex(e => e.revid === this.currentEdit.revid);

			// If current edit is not in queue, select the first item
			if (currentIndex === -1) {
				this.currentEdit = this.queue[0];
				wikishield.interface.renderQueue(this.queue, this.currentEdit);
				return;
			}

			// Store the edit we're leaving
			const editWeAreLeaving = this.currentEdit;

			// Cancel AI analysis for the edit we're leaving
			if (editWeAreLeaving && wikishield.ollamaAI) {
				wikishield.ollamaAI.cancelAnalysis(editWeAreLeaving.revid);
			}

			// Mark as reviewed if moving away from the first item
			if (currentIndex === 0 && !editWeAreLeaving.reviewed) {
				editWeAreLeaving.reviewed = true;
				wikishield.statistics.reviewed += 1;
				wikishield.saveStats(wikishield.statistics);
			}

			// Remove the current item from the queue
			this.queue.splice(currentIndex, 1);
			wikishield.interface.removeQueueItem(editWeAreLeaving.revid);

			// Update currentEdit to the item now at the current position
			if (this.queue.length > 0) {
				if (currentIndex < this.queue.length) {
					// Move to the item that's now at the current position
					this.currentEdit = this.queue[currentIndex];
				} else {
					// We removed the last item, go to the new last item
					this.currentEdit = this.queue[this.queue.length - 1];
				}
			} else {
				// Queue is empty
				this.currentEdit = null;
			}

			// Store the edit we left in previousItems
			this.previousItems.push(editWeAreLeaving);

			wikishield.interface.renderQueue(this.queue, this.currentEdit);

			// Auto-welcome the user we left
			if (editWeAreLeaving) {
				this.checkAndAutoWelcome(editWeAreLeaving);
				this.checkAndAutoReportUAA(editWeAreLeaving);
			}
		}

		/**
		 * Set the current edit to the previous item in the queue
		 * This removes the current item and moves to the previous one
		 */
		/**
		 * Set the current edit to the previous item in the queue
		 * This only changes which edit is selected, it does NOT remove anything
		 */
		prevItem() {
			// If no current edit and queue has items, select the first item
			if (!this.currentEdit && this.queue.length > 0) {
				this.currentEdit = this.queue[0];
				wikishield.interface.renderQueue(this.queue, this.currentEdit);
				return;
			}

			// Find where the current edit is in the queue
			const currentIndex = this.currentEdit ? this.queue.findIndex(e => e.revid === this.currentEdit.revid) : -1;

			// Store the edit we're leaving
			const editWeAreLeaving = this.currentEdit;

			// If we're at the first item (or not found), try to go to previousItems
			if (currentIndex <= 0) {
				// No previous items available, can't go back
				if (this.previousItems.length === 0) {
					return;
				}

				// Cancel AI analysis for the edit we're leaving
				if (editWeAreLeaving && wikishield.ollamaAI) {
					wikishield.ollamaAI.cancelAnalysis(editWeAreLeaving.revid);
				}

				// Pull an item from previousItems and add it to the front of the queue
				this.queue.unshift(this.previousItems.pop());
				this.currentEdit = this.queue[0];
				wikishield.interface.renderQueue(this.queue, this.currentEdit);

				// Auto-welcome the user we left
				if (editWeAreLeaving) {
					this.checkAndAutoWelcome(editWeAreLeaving);
					this.checkAndAutoReportUAA(editWeAreLeaving);
				}
				return;
			}

			// Cancel AI analysis for the edit we're leaving
			if (editWeAreLeaving && wikishield.ollamaAI) {
				wikishield.ollamaAI.cancelAnalysis(editWeAreLeaving.revid);
			}

			// Simply move selection to the previous item
			this.currentEdit = this.queue[currentIndex - 1];
			wikishield.interface.renderQueue(this.queue, this.currentEdit);

			// Auto-welcome the user we left
			if (editWeAreLeaving) {
				this.checkAndAutoWelcome(editWeAreLeaving);
				this.checkAndAutoReportUAA(editWeAreLeaving);
			}
		}

		/**
		 * Check if user should be auto-welcomed and do so if needed
		 * @param {Object} edit The edit object to check
		 */
		async checkAndAutoWelcome(edit) {
			// Check if auto-welcome is enabled
			if (!wikishield.options.enableAutoWelcome) {
				return;
			}

			// Only auto-welcome registered users (not TEMPs) with empty talk pages
			if (!edit.user || !edit.user.name || mw.util.isTemporaryUser(edit.user.name)) {
				return;
			}

			// Don't welcome users editing a sandbox (possibly gaming system)
			const pageTitle = edit.page?.title || "unknown";
			if (pageTitle.toLowerCase().includes('/sandbox') || pageTitle.toLowerCase().endsWith(":sandbox")) {
				return;
			}

			// Check if user is in the no-auto-welcome list
			if (wikishield.noAutoWelcomeList.has(edit.user.name)) {
				return;
			}

			// Check if talk page appears empty
			if (!edit.user.emptyTalkPage) {
				return;
			}

			// Only auto-welcome if the edit was constructive (according to AI analysis)
			if (edit.aiAnalysis && edit.aiAnalysis.constructive === false) {
				console.log(`Skipping auto-welcome for ${edit.user.name} - edit not constructive`);
				return;
			}

			// Double-check by fetching the talk page to see if it exists
			try {
				// If the talk page exists, don't auto-welcome
				if (await wikishield.api.pageExists(`User talk:${edit.user.name}`)) {
					edit.user.emptyTalkPage = false;
					return;
				}

				// Show confirmation dialog
				const confirmed = await wikishield.interface.showConfirmationDialog(
					"Auto-welcome User",
					`Would you like to welcome <span class="confirmation-modal-username">${wikishield.util.escapeHtml(edit.user.name)}</span>?<br><br>
					<span style="font-size: 0.9em; color: #888;">Editing: <strong>${wikishield.util.escapeHtml(edit.page.title)}</strong></span>`,
					edit.user.name
				);

				if (!confirmed) {
					console.log(`Auto-welcome cancelled for: ${edit.user.name}`);
					// Add user to no-auto-welcome list
					wikishield.noAutoWelcomeList.add(edit.user.name);
					return;
				}

				// Show progress notification
				const progressBar = new WikiShieldProgressBar();
				progressBar.set("Auto-welcoming...", 0.5, "var(--main-blue)");

				let template = null;
                if (wikishield.options.enableWelcomeLatin) {
                    // Determine which template to use based on username characters and mentorship
                    // Check if username contains non-Latin characters (takes precedence)
                    const hasNonLatin = /[^\u0000-\u007F\u0080-\u00FF\u0100-\u017F\u0180-\u024F]/.test(edit.user.name);
                    if (hasNonLatin) {
                        template = "Latin";
                    }
                }

                if (template === null) {
                    template = "Default";
                }

				// Auto-welcome with appropriate template
				await wikishield.welcomeUser(edit.user.name, template);

				// Update progress to complete
				progressBar.set(`Welcomed ${edit.user.name}`, 1, "var(--main-green)");

				console.log(`Auto-welcomed user: ${edit.user.name}`);
			} catch (err) {
				console.log("Error during auto-welcome check:", err);
			}
		}

		/**
		 * Prompt user to report a username to UAA
		 * This is called when username analysis flags a username
		 * @param {Object} edit The edit object with username analysis
		 */
		async promptForUAAReport(edit) {
			// Only check registered users (not TEMPs)
			if (!edit.user || !edit.user.name || mw.util.isTemporaryUser(edit.user.name)) {
				return;
			}

			// Check if user is in the no-auto-welcome list (also used for UAA to avoid duplicate prompts)
			if (wikishield.noAutoWelcomeList.has(edit.user.name)) {
				return;
			}

			// Check if we have username analysis results
			const usernameAnalysis = edit.usernameAnalysis;
			if (!usernameAnalysis || !usernameAnalysis.shouldFlag) {
				return;
			}

			// Check if user is already reported to UAA
			if (wikishield.uaaReports && wikishield.uaaReports.includes(edit.user.name)) {
				console.log(`User ${edit.user.name} is already reported to UAA, skipping prompt`);
				// Add to no-auto-welcome list to avoid future prompts
				wikishield.noAutoWelcomeList.add(edit.user.name);
				return;
			}

			// Show confirmation dialog with AI analysis
			const violationLabel = usernameAnalysis.violationType !== 'none'
				? ` (${usernameAnalysis.violationType})`
				: '';
			const confidencePercent = Math.round(usernameAnalysis.confidence * 100);

			const confirmed = await wikishield.interface.showConfirmationDialog(
				"Report Username to UAA",
				`The username <span class="confirmation-modal-username">${wikishield.util.escapeHtml(edit.user.name)}</span> may violate Wikipedia's username policy${violationLabel}.<br><br>
				<span style="font-size: 0.9em; color: #888;">Would you like to report it to <a href="https://en.wikipedia.org/wiki/Wikipedia:Usernames_for_administrator_attention" target="_blank" style="color: #0645ad;">Usernames for administrator attention (UAA)</a>?</span><br><br>
				<strong>AI Confidence:</strong> ${confidencePercent}%<br>
				<strong>Reasoning:</strong> ${wikishield.util.escapeHtml(usernameAnalysis.reasoning)}<br>
				<strong>Recommendation:</strong> ${wikishield.util.escapeHtml(usernameAnalysis.recommendation)}`,
				edit.user.name
			);

			if (!confirmed) {
				console.log(`UAA report cancelled for: ${edit.user.name}`);
				// Add user to no-auto-welcome list to avoid future prompts
				wikishield.noAutoWelcomeList.add(edit.user.name);
				return;
			}

			// Open UAA report interface
			try {
				// Use the existing event system to trigger UAA report
				const reportEvent = wikishield.events.events.reportUserUAA;
				if (reportEvent && reportEvent.func) {
					await reportEvent.func(edit);
				}

				// Add user to no-auto-welcome list after reporting
				wikishield.noAutoWelcomeList.add(edit.user.name);
			} catch (err) {
				console.log("Error during auto UAA report:", err);
			}
		}

		/**
		 * Check if user should be reported to UAA based on username analysis
		 * This is called when moving away from an edit
		 * @param {Object} edit The edit object to check
		 */
		async checkAndAutoReportUAA(edit) {
			// If username analysis has already flagged this user, prompt for report
			if (edit.usernameAnalysis && edit.usernameAnalysis.shouldFlag &&
				edit.usernameAnalysis.confidence >= 0.5 && !edit.usernameAnalysis.cancelled) {
				await this.promptForUAAReport(edit);
			}
		}

		/**
		 * Clear the queue
		 */
		delete() {
			// Play whoosh sound for clearing
			this.playWhooshSound();

			// Cancel all active AI analyses
			if (wikishield.ollamaAI) {
				wikishield.ollamaAI.cancelAllAnalyses();
			}

			this.queue = [];
			this.currentEdit = null;
			wikishield.interface.clearQueue();
			wikishield.interface.renderQueue(this.queue, this.currentEdit);
		}

		/**
		 * Load an edit from the user contributions list
		 * @param {Number} revid
		 */
		async loadFromContribs(revid) {
			const edit = this.currentEdit.user.contribs.filter(e => e.revid === Number(revid))[0];

			const diffContainer = wikishield.interface.elem("#diff-container");
			diffContainer.innerHTML = ``;

			this.currentEdit = await this.generateQueueItem(
				edit,
				this.currentEdit.user.editCount,
				this.currentEdit.user.warningLevel,
				null,
				this.currentEdit.user.blocked,
				null,
				null,
				this.currentEdit.user.emptyTalkPage
			);
			wikishield.interface.renderQueue(this.queue, this.currentEdit);
		}

		/**
		 * Load an edit from the page history list
		 * @param {Number} revid
		 */
		async loadFromHistory(revid) {
			const edit = this.currentEdit.page.history.filter(e => e.revid === Number(revid))[0];
			edit.title = this.currentEdit.page.title;

			const diffContainer = wikishield.interface.elem("#diff-container");
			diffContainer.innerHTML = ``;

			const results = await Promise.all([
				wikishield.api.editCount(edit.user),
				wikishield.api.getSinglePageContent(`User talk:${edit.user}`),
				wikishield.api.contribs(edit.user),
				wikishield.api.history(edit.title)
			]);

			const talkPageText = results[1];

			this.currentEdit = await this.generateQueueItem(
				edit,
				results[0][0].editcount,
				this.getWarningLevel(talkPageText),
				null, false, results[2], results[3],
				!(await wikishield.api.pageExists(`User talk:${edit.user}`))
			);
			wikishield.interface.renderQueue(this.queue, this.currentEdit);
		}

		/**
		 * Load a specific revision by revid and page title (for loading newest revision)
		 * @param {Number} revid The revision ID to load
		 * @param {String} pageTitle The page title
		 */
		async loadSpecificRevision(revid, pageTitle) {
			try {
				const diffContainer = wikishield.interface.elem("#diff-container");
				diffContainer.innerHTML = `<div class="loading-spinner">Loading revision...</div>`;

				// Fetch the revision data from the API
				const revisionData = await wikishield.api.getRevisionData(revid);

				if (!revisionData) {
					diffContainer.innerHTML = `<div class="error">Failed to load revision</div>`;
					return;
				}

				// Fetch all necessary data
				const results = await Promise.all([
					wikishield.api.editCount(revisionData.user),
					wikishield.api.getSinglePageContent(`User talk:${revisionData.user}`),
					wikishield.api.contribs(revisionData.user),
					wikishield.api.history(pageTitle)
				]);

				const talkPageText = results[1];

				// Create a proper edit object
				const edit = {
					revid: revisionData.revid,
					parentid: revisionData.parentid,  // Include parentid for diff generation
					user: revisionData.user,
					comment: revisionData.comment,
					timestamp: revisionData.timestamp,
					size: revisionData.size,
					oldlen: revisionData.oldlen || 0,
					newlen: revisionData.size,
					title: pageTitle
				};

				this.currentEdit = await this.generateQueueItem(
					edit,
					results[0][0].editcount,
					this.getWarningLevel(talkPageText),
					null, false, results[2], results[3],
					!(await wikishield.api.pageExists(`User talk:${edit.user}`))
				);

				wikishield.interface.renderQueue(this.queue, this.currentEdit);
			} catch (err) {
				console.error("Failed to load specific revision:", err);
				wikishield.interface.elem("#diff-container").innerHTML = `<div class="error">Failed to load revision</div>`;
			}
		}
	}

	const wikishieldEventData = {
		conditions: {
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
				check: (edit) => wikishield.highlighted.has(edit.user.name)
			},
			"userIsWhitelisted": {
				desc: "User is whitelisted",
				check: (edit) => wikishield.whitelist.has(edit.user.name)
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
					const current = edit.user.warningLevel.toString();
					const result = ["4", "4im"].includes(original);
					console.log(`[atFinalWarning] User: ${edit.user.name}, Original: ${original}, Current: ${current}, Result: ${result}`);
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
		},
		welcomeTemplates: {
			"Default": "{{subst:Welcome}} ~~~~",
			"Basic": "{{subst:W-basic}}",
			"Links": "{{subst:W-graphical}}",
			"Latin": "{{subst:welcome non-latin|LuniZunie}} ~~~~",
			"COI": "{{subst:welcome-coi}} ~~~~",
			"Mentor": "{{subst:Mentor welcome-autosign}}"
		}
	};

	class WikiShieldEventManager {
		constructor() {
			/**
			 * Helper function to open Wikipedia links in iframe or new tab
			 * @param {String} url - The URL to open
			 * @param {String} title - The title to display in iframe
			 * @param {Event} event - Optional event object for middle-click detection
			 */
			this.openWikipediaLink = (url, title, event = null) => {
				// Middle click should open in new tab
				if (event && event.button === 1) {
					window.open(url);
					return;
				}

				// Ctrl/Cmd + click should open in new tab
				if (event && (event.ctrlKey || event.metaKey)) {
					window.open(url);
					return;
				}

				// Otherwise open in new tab
				window.open(url, "_blank");
			};

			this.events = {
				prevEdit: {
					description: "Go to the previous edit in the queue",
					icon: "fas fa-arrow-left",
					runWithoutEdit: true,
					func: () => {
						wikishield.queue.prevItem();
					}
				},
				nextEdit: {
					description: "Go to the next edit in the queue",
					icon: "fas fa-arrow-right",
					func: () => {
						wikishield.queue.nextItem();
					}
				},
				deleteQueue: {
					description: "Remove all items from the queue",
					icon: "fas fa-trash-can",
					runWithoutEdit: true,
					func: () => {
						wikishield.queue.delete();
					}
				},
				openRevertMenu: {
					description: "Toggle the revert & warn menu",
					icon: "fas fa-undo",
					runWithoutEdit: true,
					func: () => {
						const menuItem = document.querySelector('[data-menu="revert"]');

						const revertMenu = wikishield.interface.elem("#revert-menu");
						revertMenu.innerHTML = "";
						wikishield.interface.createRevertMenu(revertMenu, wikishield.queue.currentEdit?.isBLP);

						if (menuItem) {
							const trigger = menuItem.querySelector('.bottom-tool-trigger');
							const menu = document.querySelector(`#${menuItem.dataset.menu}-menu`);
							if (trigger && menu) {
								// Toggle: if already open, close it; otherwise open it
								if (menu.classList.contains('show')) {
									menu.classList.remove('show');
									trigger.classList.remove('active');
								} else {
									// Close all other menus first
									wikishield.interface.closeAllBottomMenus();
									menu.classList.add('show');
									trigger.classList.add('active');
									wikishield.interface.positionBottomMenu(menuItem, menu);
								}
							}
						}
					}
				},
				openWarnMenu: {
					description: "Toggle the warn-only menu",
					icon: "fas fa-triangle-exclamation",
					runWithoutEdit: true,
					func: () => {
						const menuItem = document.querySelector('[data-menu="warn"]');
						if (menuItem) {
							const trigger = menuItem.querySelector('.bottom-tool-trigger');
							const menu = document.querySelector(`#${menuItem.dataset.menu}-menu`);
							if (trigger && menu) {
								// Toggle: if already open, close it; otherwise open it
								if (menu.classList.contains('show')) {
									menu.classList.remove('show');
									trigger.classList.remove('active');
								} else {
									// Close all other menus first
									wikishield.interface.closeAllBottomMenus();
									menu.classList.add('show');
									trigger.classList.add('active');
									wikishield.interface.positionBottomMenu(menuItem, menu);
								}
							}
						}
					}
				},
				openReportMenu: {
					description: "Toggle the report menu",
					icon: "fas fa-flag",
					runWithoutEdit: true,
					func: () => {
						const menuItem = document.querySelector('[data-menu="report"]');
						if (menuItem) {
							const trigger = menuItem.querySelector('.bottom-tool-trigger');
							const menu = document.querySelector(`#${menuItem.dataset.menu}-menu`);
							if (trigger && menu) {
								// Toggle: if already open, close it; otherwise open it
								if (menu.classList.contains('show')) {
									menu.classList.remove('show');
									trigger.classList.remove('active');
								} else {
									// Close all other menus first
									wikishield.interface.closeAllBottomMenus();
									menu.classList.add('show');
									trigger.classList.add('active');
									wikishield.interface.positionBottomMenu(menuItem, menu);
								}
							}
						}
					}
				},
				openSettings: {
					description: "Open the settings interface",
					icon: "fas fa-gear",
					runWithoutEdit: true,
					func: () => {
						wikishield.interface.settings.openSettings();
					}
				},
				openUserPage: {
					description: "Open user page in a new tab",
					icon: "fas fa-circle-user",
					func: (event) => {
						const username = this.getRelevantEdit().user.name;
						const url = wikishield.util.pageLink(`User:${username}`);
						this.openWikipediaLink(url, `User:${username}`, event);
					}
				},
				openUserTalk: {
					description: "Open user talk page in a new tab",
					icon: "fas fa-comment",
					func: (event) => {
						const username = this.getRelevantEdit().user.name;
						const url = wikishield.util.pageLink(`User talk:${username}`);
						this.openWikipediaLink(url, `User talk:${username}`, event);
					}
				},
				openUserContribs: {
					description: "Open user contributions page in a new tab",
					icon: "fas fa-list",
					func: (event) => {
						const username = this.getRelevantEdit().user.name;
						const url = wikishield.util.pageLink(`Special:Contributions/${username}`);
						this.openWikipediaLink(url, `Contributions: ${username}`, event);
					}
				},
				openFilterLog: {
					description: "Open user filter log in a new tab",
					icon: "fas fa-filter",
					func: (event) => {
						const encodedName = wikishield.util.encodeuri(this.getRelevantEdit().user.name);
						const url = wikishield.util.pageLink(
							`?title=Special:AbuseLog&wpSearchUser=${encodedName}`,
							true
						);
						const username = this.getRelevantEdit().user.name;
						this.openWikipediaLink(url, `Filter Log: ${username}`, event);
					}
				},
				addToWhitelist: {
					description: "Add user to the whitelist",
					icon: "fas fa-thumbs-up",
					includeInProgress: true,
					progressDesc: "Whitelisting...",
					func: () => {
						wikishield.queue.playSparkleSound();
						const username = this.getRelevantEdit().user.name;

						// Toggle whitelist status
						if (wikishield.whitelist.has(username)) {
							wikishield.whitelist.delete(username);
							wikishield.saveWhitelist();
							wikishield.logger.log(`Removed ${username} from whitelist`);
						} else {
							wikishield.whitelist.set(username, Date.now());
							wikishield.saveWhitelist();
							wikishield.statistics.whitelisted++;
							wikishield.saveStats(wikishield.statistics);
							wikishield.logger.log(`Added ${username} to whitelist`);
						}

						// Refresh the interface to update button text
						wikishield.interface.renderQueue(wikishield.queue.queue, wikishield.queue.currentEdit);
					}
				},
				highlight: {
					description: "Highlight this user's contributions",
					icon: "fas fa-highlighter",
					includeInProgress: true,
					progressDesc: "Highlighting...",
					func: () => {
						wikishield.queue.playSparkleSound();
						const username = this.getRelevantEdit().user.name;

						// Toggle highlight status
						if (wikishield.highlighted.has(username)) {
							wikishield.highlighted.delete(username);
							wikishield.saveHighlighted();
							wikishield.logger.log(`Removed highlight from ${username}`);
						} else {
							// Set highlight to expire based on user setting
							const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.options.highlightedExpiry);
							const expirationTime = Date.now() + expiryMs;
							wikishield.highlighted.set(username, expirationTime);
							wikishield.saveHighlighted();
							wikishield.statistics.highlighted++;
							wikishield.saveStats(wikishield.statistics);
							wikishield.logger.log(`Highlighted user ${username} until ${new Date(expirationTime).toLocaleString()}`);
						}

						// Trigger immediate UI refresh
						wikishield.interface.renderQueue(wikishield.queue.queue, wikishield.queue.currentEdit);
					}
				},
				openPage: {
					description: "Open page being edited in new tab",
					icon: "fas fa-file-lines",
					func: (event) => {
						const page = this.getRelevantEdit().page;
						const url = wikishield.util.pageLink(page.title);
						this.openWikipediaLink(url, page.title, event);
					}
				},
				openTalk: {
					description: "Open talk page in new tab",
					icon: "fas fa-comments",
					func: (event) => {
						const pageTitle = this.getRelevantEdit().page.title.split(":");
						let talkNamespace = "Talk";
						if (pageTitle.length > 1) {
							talkNamespace = pageTitle[0].toLowerCase().includes("talk")
								? pageTitle[0]
								: pageTitle[0] + " talk";
						}
						const talkTitle = `${talkNamespace}:${pageTitle.length === 1 ? pageTitle[0] : pageTitle[1]}`;
						const url = wikishield.util.pageLink(talkTitle);
						this.openWikipediaLink(url, talkTitle, event);
					}
				},
				openHistory: {
					description: "Open page history in new tab",
					icon: "fas fa-clock-rotate-left",
					func: (event) => {
						const page = this.getRelevantEdit().page;
						const url = wikishield.util.pageLink(`Special:PageHistory/${page.title}`);
						this.openWikipediaLink(url, `History: ${page.title}`, event);
					}
				},
				openRevision: {
					description: "Open revision in new tab",
					icon: "fas fa-pen-to-square",
					func: (event) => {
						const revid = this.getRelevantEdit().revid;
						const url = wikishield.util.pageLink(`Special:PermanentLink/${revid}`);
						this.openWikipediaLink(url, `Revision ${revid}`, event);
					}
				},
				openDiff: {
					description: "Open diff in new tab",
					icon: "fas fa-code-commit",
					func: (event) => {
						const revid = this.getRelevantEdit().revid;
						const url = wikishield.util.pageLink(`Special:Diff/${revid}`);
						this.openWikipediaLink(url, `Diff ${revid}`, event);
					}
				},
				thankUser: {
					description: "Thank user",
					icon: "fas fa-user-check",
					includeInProgress: true,
					progressDesc: "Thanking...",
					func: async () => {
						wikishield.queue.playThankSound();
						const edit = this.getRelevantEdit();

						// Check if user is an TEMP
						if (mw.util.isTemporaryUser(edit.user.name)) {
							// For TEMP users, leave a thank you message on their talk page
							const talkPageName = `User talk:${edit.user.name}`;
							const talkPageContent = await wikishield.api.getSinglePageContent(talkPageName) || "";

							await wikishield.api.edit(
								talkPageName,
								talkPageContent + `\n{{subst:Thanks-autosign}}`,
								`Thanking for edit to [[${edit.page.title}]] ([[WP:WikiShield|WS]])`
							);
						} else {
							// For registered users, use the API thank function
							await wikishield.api.thank(edit.revid);
						}
					}
				},
				rollback: {
					description: "Rollback edits",
					icon: "fas fa-backward",
					includeInProgress: true,
					progressDesc: "Rolling back...",
					func: async (params = {}) => {
						wikishield.queue.playRollbackSound();
						return await wikishield.revert(this.getRelevantEdit(), params.label || "");
					}
				},
				rollbackAndWarn: {
					description: "Rollback and warn for edits",
					icon: "fas fa-backward",
					includeInProgress: true,
					progressDesc: "Rolling back and warning...",
					parameters: [
						{
							title: "Warning type",
							id: "warningType",
							type: "choice",
							options: Object.keys(wikishieldData.warnings)
						},
						{
							title: "Level",
							id: "level",
							type: "choice",
							options: ["auto", 1, 2, 3, 4] // TODO needs IM
						}
					],
					validateParameters: (params) => {
						// If custom templates are provided, skip validation
						if (params.warningTemplates) {
							return true;
						}
						return params.level === "auto" ||
							wikishieldData.warnings[params.warningType].templates.length >= params.level;
					},
					func: async (params = {}) => {
						wikishield.queue.playRollbackSound();

						const result = await wikishield.revert(this.getRelevantEdit(), params.label || "");
						if (result === false) {
							return { wasAtFinalWarning: false }; // don't auto report either
						}

						wikishield.queue.playWarnSound();

						// Use custom templates if provided, otherwise use standard warning set
						let warningTemplates, warningLabel, requiresArticle;

						if (params.warningTemplates) {
							// Custom warning from warn menu
							warningTemplates = params.warningTemplates;
							warningLabel = params.warningLabel;
							requiresArticle = params.requiresArticle;
						} else {
							// Standard warning from revert menu
							const warningSet = params.warningType && Object.keys(wikishieldData.warnings).includes(params.warningType)
								? wikishieldData.warnings[params.warningType]
								: wikishieldData.warnings.Vandalism;
							warningTemplates = warningSet.templates;
							warningLabel = null; // Will use default behavior in warnUser
							requiresArticle = true;
						}

						// Store the original warning level before warning
						const originalLevel = this.getRelevantEdit().user.warningLevel;

						await wikishield.warnUser(
							this.getRelevantEdit().user.name,
							warningTemplates,
							params.level || "auto",
							requiresArticle !== false ? this.getRelevantEdit().page.title : null,
							this.getRelevantEdit().revid
						);

						// Return whether they were already at final warning
						return {
							wasAtFinalWarning: ["4", "4im"].includes(originalLevel.toString())
						};
					}
				},
				rollbackGoodFaith: {
					description: "Rollback edits (good faith)",
					icon: "fas fa-arrow-rotate-left",
					parameters: [
						{
							title: "Summary (optional)",
							id: "summary",
							type: "text"
						}
					],
					includeInProgress: true,
					progressDesc: "Rolling back...",
					func: async (params) => {
						wikishield.queue.playRollbackSound();
						const edit = this.getRelevantEdit();
						return await wikishield.revert(edit, params.summary || `Reverted good faith edits by ${edit.user.name} ([[WP:WikiShield|WS]])`);
					}
				},
				undo: {
					description: "Undo this edit only",
					icon: "fas fa-undo",
					parameters: [
						{
							title: "Reason",
							id: "reason",
							type: "text"
						}
					],
					includeInProgress: true,
					progressDesc: "Undoing...",
					func: async (params) => {
						wikishield.queue.playRollbackSound();
						const edit = this.getRelevantEdit();
						return await wikishield.api.undoEdit(edit, params.reason || `Undid edit by ${edit.user.name} ([[WP:WikiShield|WS]])`);
					}
				},
				warn: {
					description: "Warn user",
					icon: "fas fa-triangle-exclamation",
					parameters: [
						{
							title: "Warning type",
							id: "warningType",
							type: "choice",
							options: Object.keys(wikishieldData.warnings)
						},
						{
							title: "Level",
							id: "level",
							type: "choice",
							options: ["auto", 1, 2, 3, 4] // TODO needs IM
						}
					],
					includeInProgress: true,
					progressDesc: "Warning...",
					needsContinuity: true,
					validateParameters: (params) => {
						// If custom templates are provided, skip validation
						if (params.warningTemplates) {
							return true;
						}
						return params.level === "auto" ||
							wikishieldData.warnings[params.warningType].templates.length >= params.level;
					},
					func: async (params) => {
						wikishield.queue.playWarnSound();
						// Use custom templates if provided, otherwise use standard warning set
						let warningTemplates, warningLabel, requiresArticle;

						if (params.warningTemplates) {
							// Custom warning from warn menu
							warningTemplates = params.warningTemplates;
							warningLabel = params.warningLabel;
							requiresArticle = params.requiresArticle;
						} else {
							// Standard warning from revert menu
							const warningSet = params.warningType && Object.keys(wikishieldData.warnings).includes(params.warningType)
								? wikishieldData.warnings[params.warningType]
								: wikishieldData.warnings.Vandalism;
							warningTemplates = warningSet.templates;
							warningLabel = null; // Will use default behavior in warnUser
							requiresArticle = true;
						}

						// Store the original warning level before warning
						const originalLevel = this.getRelevantEdit().user.warningLevel;

						await wikishield.warnUser(
							this.getRelevantEdit().user.name,
							warningTemplates,
							params.level || "auto",
							requiresArticle !== false ? this.getRelevantEdit().page.title : null,
							this.getRelevantEdit().revid
						);

						// Return whether they were already at final warning
						return {
							wasAtFinalWarning: ["4", "4im"].includes(originalLevel.toString())
						};
					}
				},
				reportToAIV: {
					description: "Report user to AIV",
					icon: "fas fa-flag",
					parameters: [
						{
							title: "Report message",
							id: "reportMessage",
							type: "choice",
							options: [
								"Vandalism past final warning",
								"Vandalism-only account",
								"Long-term abuse"
							]
						}
					],
					includeInProgress: true,
					progressDesc: "Reporting...",
					func: async (params) => {
						console.log(`[reportToAIV] Executing report for user: ${this.getRelevantEdit().user.name}, Message: ${params.reportMessage}`);
						wikishield.queue.playReportSound();
						await wikishield.reportToAIV(
							this.getRelevantEdit().user.name,
							params.reportMessage
						);
					}
				},
				reportToUAA: {
					description: "Report user to UAA",
					icon: "fas fa-flag",
					parameters: [
						{
							title: "Report message",
							id: "reportMessage",
							type: "choice",
							options: [
								"Disruptive username",
								"Offensive username",
								"Promotional username",
								"Misleading username"
							]
						}
					],
					includeInProgress: true,
					progressDesc: "Reporting...",
					func: async (params) => {
						wikishield.queue.playReportSound();
						await wikishield.reportToUAA(
							this.getRelevantEdit().user.name,
							params.reportMessage
						);
					}
				},
				requestProtection: {
					description: "Request protection",
					icon: "fas fa-shield",
					parameters: [
						{
							title: "Level",
							id: "level",
							type: "choice",
							options: [
								"Semi-protection",
								"Extended-confirmed protection",
								"Full protection",
								"Pending changes protection"
							]
						},
						{
							title: "Reason",
							id: "reason",
							type: "choice",
							options: [
								"Persistent vandalism",
								"Edit warring",
								"BLP violations",
								"Sockpuppetry"
							]
						}
					],
					includeInProgress: true,
					progressDesc: "Requesting protection...",
					func: async (params) => {
						wikishield.queue.playProtectionSound();
						await wikishield.requestProtection(
							this.getRelevantEdit().page.title,
							params.level,
							params.reason
						);
					}
				},
				block: {
					description: "Block user",
					icon: "fas fa-ban",
					parameters: [
						{
							title: "Block summary",
							id: "blockSummary",
							type: "choice",
							options: [
								"[[Wikipedia:Vandalism|Vandalism]]",
								"[[Wikipedia:DISRUPTONLY|Vandalism-only account]]",
								"Long-term abuse"
							]
						},
						{
							title: "Duration",
							id: "duration",
							type: "choice",
							options: [
								"31 hours",
								"1 week",
								"2 weeks",
								"1 month",
								"3 months",
								"6 months",
								"1 year",
								"3 years",
								"infinite"
							]
						}
					],
					includeInProgress: true,
					progressDesc: "Blocking...",
					func: async (params) => {
						wikishield.queue.playBlockSound();
						const success = await wikishield.api.block(
							this.getRelevantEdit().user.name,
							params.blockSummary,
							params.duration,
							true, false, false, true
						);
						if (success) {
							wikishield.statistics.blocks++;
							wikishield.saveStats(wikishield.statistics);
						}
					}
				},
				protect: {
					description: "Protect page",
					icon: "fas fa-lock",
					includeInProgress: true,
					progressDesc: "Protecting...",
					func: async () => {
						wikishield.queue.playProtectionSound();
					}
				},
				welcome: {
					description: "Welcome user",
					icon: "fas fa-door-open",
					parameters: [
						{
							title: "Template",
							id: "template",
							type: "choice",
							options: Object.keys(wikishieldEventData.welcomeTemplates)
						}
					],
					includeInProgress: true,
					progressDesc: "Welcoming...",
					func: async (params) => {
						wikishield.queue.playSparkleSound();
						await wikishield.welcomeUser(
							this.getRelevantEdit().user.name,
							params.template
						);
					}
				}
			};
		}

		/**
		 * Returns the edit events should be actioned on
		 */
		getRelevantEdit() {
			return wikishield.tempCurrentEdit || wikishield.queue.currentEdit;
		}

		/**
		 * When a button is clicked, trigger the given event
		 * @param {HTMLElement} elem Button to add listener to
		 * @param {String} event Event to trigger
		 * @param {Boolean} runWithoutEdit Whether this event can be run with no edit selected
		 */
		linkButton(elem, event, runWithoutEdit) {
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
				wikishield.interface.updateMenuElements();
				if (runWithoutEdit) {
					this.events[event].func();
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

	const wikishieldSettingsAllowedKeys = [
		"!", "@", "#", "$", "%", "^", "&", "*", "(", ")",
		"1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
		"q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
		"a", "s", "d", "f", "g", "h", "j", "k", "l",
		"z", "x", "c", "v", "b", "n", "m",
		"-", "=", "[", "]", "\\", ";", "'", ",", ".", "/", "enter",
		"_", "+", "{", "}", "|", ":", "\"", "<", ">", "?", " ",
		"arrowleft", "arrowup", "arrowdown", "arrowright"
	];

	class WikiShieldSettingsInterface {
		constructor() {
			this.contentContainer = null;
			this.isOpen = false;
			this.keypressCallback = null;
		}

		/**
		 * Create a toggle switch
		 * @param {HTMLElement} container The container to add the toggle to
		 * @param {Boolean} value The initial value
		 * @param {Function} onChange Callback when value changes
		 */
		createToggle(container, value, onChange) {
			const toggle = document.createElement("div");
			toggle.classList.add("settings-toggle");
			if (value) toggle.classList.add("active");
			container.appendChild(toggle);

			toggle.innerHTML = `
				<div class="toggle-switch">
					<div class="toggle-slider"></div>
				</div>
			`;

			toggle.addEventListener("click", () => {
				wikishield.queue.playClickSound();
				value = !value;
				if (value) {
					toggle.classList.add("active");
				} else {
					toggle.classList.remove("active");
				}
				onChange(value);
			});
		}

		/**
		 * Create a volume slider control with preview button and sound selector
		 * @param {Element} container The container element
		 * @param {String} triggerKey The trigger key (e.g., 'click', 'alert', etc.)
		 * @param {String} title The title of the control
		 * @param {String} description The description of what the sound is for
		 * @param {Function} playFunction The function to play the sound
		 */
		createVolumeControl(container, triggerKey, title, description, playFunction) {
			const wrapper = document.createElement("div");
			wrapper.classList.add("audio-volume-control");
			container.appendChild(wrapper);

			const value = wikishield.options.volumes?.[triggerKey] ?? 0.5;
			const currentSound = wikishield.options.soundMappings?.[triggerKey] || triggerKey;

			// Build sound selector options grouped by category
			const soundsByCategory = {};
			Object.entries(wikishieldData.sounds).forEach(([key, sound]) => {
				const category = sound.category || 'other';
				if (!soundsByCategory[category]) soundsByCategory[category] = [];
				soundsByCategory[category].push({ key, sound });
			});

			const categoryOrder = ['ui', 'alert', 'warning', 'action', 'notification', 'positive', 'negative', 'other'];
			const categoryNames = {
				ui: 'UI Sounds',
				alert: 'Alerts',
				warning: 'Warnings',
				action: 'Actions',
				notification: 'Notifications',
				positive: 'Positive',
				negative: 'Negative',
				other: 'Other'
			};

			let soundOptions = '';
			categoryOrder.forEach(category => {
				if (soundsByCategory[category]) {
					soundOptions += `<optgroup label="${categoryNames[category] || category}">`;
					soundsByCategory[category].forEach(({ key, sound }) => {
						const selected = key === currentSound ? 'selected' : '';
						soundOptions += `<option value="${key}" ${selected}>${sound.name}</option>`;
					});
					soundOptions += '</optgroup>';
				}
			});

			wrapper.innerHTML = `
				<div class="audio-control-header">
					<div class="audio-control-info">
						<div class="audio-control-title">${title}</div>
						<div class="audio-control-desc">${description}</div>
					</div>
					<button class="audio-preview-button">
						<span class="fa fa-play"></span>
						Preview
					</button>
				</div>
				<select class="audio-sound-selector">
					${soundOptions}
				</select>
				<div class="audio-control-slider-container">
					<input type="range" class="audio-volume-slider" min="0" max="1" step="0.01" value="${value}">
					<input type="number" class="audio-volume-input" min="0" max="1" step="0.01" value="${value}">
				</div>
			`;

			const slider = wrapper.querySelector(".audio-volume-slider");
			const input = wrapper.querySelector(".audio-volume-input");
			const previewBtn = wrapper.querySelector(".audio-preview-button");
			const soundSelector = wrapper.querySelector(".audio-sound-selector");

			const updateVolume = (newValue) => {
				const val = Math.max(0, Math.min(1, Number(newValue)));
				slider.value = val;
				input.value = val.toFixed(2);

				if (!wikishield.options.volumes) wikishield.options.volumes = {};
				wikishield.options.volumes[triggerKey] = val;
				wikishield.saveOptions(wikishield.options);
			};

			slider.addEventListener("input", () => updateVolume(slider.value));
			input.addEventListener("change", () => updateVolume(input.value));

			// Sound selector
			soundSelector.addEventListener("change", () => {
				if (!wikishield.options.soundMappings) wikishield.options.soundMappings = {};
				wikishield.options.soundMappings[triggerKey] = soundSelector.value;
				wikishield.saveOptions(wikishield.options);
			});

			// Preview button - do NOT play click sound
			previewBtn.addEventListener("click", () => {
				if (playFunction) playFunction.call(wikishield.queue);
			});
		}

		/**
		 * Create an input with +/- buttons
		 * @param {HTMLElement} container Element to add the input to
		 * @param {Number} value Initial value for the input
		 * @param {Number} min Minimum input value
		 * @param {Number} max Maximum input value
		 * @param {Number} step Amount the +/- buttons change value by
		 * @param {(newValue: number) => void} onChange Callback function for input change
		 */
		createNumericInput(container, value, min, max, step, onChange) {
			const input = document.createElement("div");
			input.classList.add("numeric-input-container");
			container.appendChild(input);

			input.innerHTML = `
				<span class="fa fa-minus numeric-input-button"></span>
				<input type="text" class="numeric-input" value=${value}>
				<span class="fa fa-plus numeric-input-button"></span>
			`;

			const inputElem = input.querySelector("input");

			input.querySelector(".fa-minus").addEventListener("click", () => {
				wikishield.queue.playClickSound();
				value = Math.round(Math.max(value - step, min) * 100) / 100;
				inputElem.value = value;
				onChange(value);
			});

			input.querySelector(".fa-plus").addEventListener("click", () => {
				wikishield.queue.playClickSound();
				value = Math.round(Math.min(value + step, max) * 100) / 100;
				inputElem.value = value;
				onChange(value);
			});

			const onInputChange = () => {
				if (isNaN(Number(inputElem.value))) {
					inputElem.value = value;
				}

				value = Math.round(Math.min(Math.max(Number(inputElem.value), min), max) * 100) / 100;
				value = step >= 1 ? Math.round(value) : value;
				inputElem.value = value;
				onChange(value);
			};

			inputElem.addEventListener("blur", onInputChange);
			inputElem.addEventListener("keyup", (event) => {
				if (event.key.toLowerCase() === "enter") {
					onInputChange();
					inputElem.blur();
				}
			});
		}

		/**
		 * Open settings container and go to general settings
		 */
		openSettings() {
			this.closeSettings();
			this.isOpen = true;

			const container = document.createElement("div");
			container.classList.add("settings-container");
			document.body.appendChild(container);
			document.body.classList.add("settings-open"); // Add class to blur bottom bar
			container.innerHTML = wikishieldHTML.settings;

			container.addEventListener("click", this.closeSettings.bind(this));
			container.querySelector(".settings").addEventListener("click", (event) => event.stopPropagation());
			container.querySelector("#settings-general-button").classList.add("selected");

			this.contentContainer = container.querySelector(".settings-right");

			[
				["#settings-general-button", this.openGeneral.bind(this)],
				["#settings-audio-button", this.openAudio.bind(this)],
				["#settings-appearance-button", this.openAppearance.bind(this)],
				["#settings-controls-button", this.openControls.bind(this)],
				["#settings-ai-button", this.openAI.bind(this)],
				["#settings-gadgets-button", this.openGadgets.bind(this)],
				["#settings-whitelist-button", this.openWhitelist.bind(this)],
				["#settings-highlight-button", this.openHighlighted.bind(this)],
				["#settings-statistics-button", this.openStatistics.bind(this)],
				["#settings-about-button", this.openAbout.bind(this)],
				["#settings-import-export-button", this.openImportExport.bind(this)],
			].forEach(([sel, func]) => container.querySelector(sel).addEventListener("click", () => {
				wikishield.queue.playClickSound();
				this.contentContainer.innerHTML = "";

				[...document.querySelectorAll(".settings-left-menu-item.selected")]
					.forEach(e => e.classList.remove("selected"));
				container.querySelector(sel).classList.add("selected");

				func();
			}));

			this.openGeneral();
		}

		/**
		 * Open general settings section
		 */
		openGeneral() {
			this.contentContainer.innerHTML = `
				<div class="settings-compact-grid">
					<div class="settings-section compact" id="maximum-edit-count">
						<div class="settings-section-title">Maximum edit count</div>
						<div class="settings-section-desc">Edits from users with more than this edit count will not be shown</div>
					</div>
					<div class="settings-section compact" id="maximum-queue-size">
						<div class="settings-section-title">Maximum queue size</div>
						<div class="settings-section-desc">The queue will not load additional edits after reaching this size</div>
					</div>
					<div class="settings-section compact" id="minimum-ores-score">
						<div class="settings-section-title">Minimum ORES score</div>
						<div class="settings-section-desc">Edits with an <a href="https://www.mediawiki.org/wiki/ORES" target="_blank">ORES score</a> below this threshold will not be shown</div>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title">Expiries</div>
					<div class="settings-compact-grid">
						<div class="settings-section compact" id="watchlist-expiry">
							<div class="settings-section-title">Watchlist expiry for warned users</div>
							<div class="settings-section-desc">How long to watch user talk pages after issuing warnings</div>
						</div>
						<div class="settings-section compact" id="highlighted-expiry">
							<div class="settings-section-title">Highlighted user expiry</div>
							<div class="settings-section-desc">How long to keep users highlighted before expiration</div>
						</div>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title">Namespaces to show</div>
					<div class="settings-section-desc">Only edits from the selected namespaces will be shown in your queue.</div>
					<div id="namespace-container"></div>
				</div>
			`;

			this.createNumericInput(
				this.contentContainer.querySelector("#maximum-edit-count"),
				wikishield.options.maxEditCount, 0, 500, 5,
				(newValue) => {
					wikishield.options.maxEditCount = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			this.createNumericInput(
				this.contentContainer.querySelector("#maximum-queue-size"),
				wikishield.options.maxQueueSize, 10, 100, 5,
				(newValue) => {
					wikishield.options.maxQueueSize = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			this.createNumericInput(
				this.contentContainer.querySelector("#minimum-ores-score"),
				wikishield.options.minimumORESScore, 0, 1, 0.05,
				(newValue) => {
					wikishield.options.minimumORESScore = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			// Create watchlist expiry dropdown
			const watchlistContainer = this.contentContainer.querySelector("#watchlist-expiry");
			const watchlistSelect = document.createElement("select");
			watchlistSelect.innerHTML = `
				<option value="none">None</option>
				<option value="1 hour">1 hour</option>
				<option value="1 day">1 day</option>
				<option value="1 week">1 week</option>
				<option value="1 month">1 month</option>
				<option value="3 months">3 months</option>
				<option value="6 months">6 months</option>
				<option value="indefinite">Indefinite</option>
			`;
			watchlistSelect.value = wikishield.options.watchlistExpiry;
			watchlistSelect.addEventListener("change", () => {
				wikishield.options.watchlistExpiry = watchlistSelect.value;
				wikishield.saveOptions(wikishield.options);
			});
			watchlistContainer.appendChild(watchlistSelect);

			// Create highlighted expiry dropdown
			const highlightedContainer = this.contentContainer.querySelector("#highlighted-expiry");
			const highlightedSelect = document.createElement("select");
			highlightedSelect.innerHTML = `
				<option value="none">None</option>
				<option value="1 hour">1 hour</option>
				<option value="1 day">1 day</option>
				<option value="1 week">1 week</option>
				<option value="1 month">1 month</option>
				<option value="3 months">3 months</option>
				<option value="6 months">6 months</option>
				<option value="indefinite">Indefinite</option>
			`;
			highlightedSelect.value = wikishield.options.highlightedExpiry;
			highlightedSelect.addEventListener("change", () => {
				wikishield.options.highlightedExpiry = highlightedSelect.value;
				wikishield.saveOptions(wikishield.options);
			});
			highlightedContainer.appendChild(highlightedSelect);

			wikishieldData.namespaces.forEach(ns => {
				this.contentContainer.querySelector("#namespace-container").innerHTML += `
					<div>
						<input
							type="checkbox"
							data-nsid="${ns.id}"
							class="ns-checkbox"
							${wikishield.options.namespacesShown.includes(ns.id) ? "checked" : ""}>
						<label>${ns.name}</label>
					</div>
				`;
			});

			[...this.contentContainer.querySelectorAll(".ns-checkbox")].forEach(elem => {
				elem.addEventListener("change", () => {
					if (elem.checked) {
						const set = new Set(wikishield.options.namespacesShown);
						set.add(Number(elem.dataset.nsid));
						wikishield.options.namespacesShown = [...set];
					} else {
						wikishield.options.namespacesShown = wikishield.options.namespacesShown
							.filter(n => n !== Number(elem.dataset.nsid));
					}
					wikishield.saveOptions(wikishield.options);
				});
			});
		}

		/**
		 * Open audio settings section
		 */
		openAudio() {
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Master Volume</div>
					<div class="settings-section-desc">Controls the overall volume of all sounds</div>
					<div id="master-volume-control"></div>
				</div>

				<div class="settings-toggles-section">
					<div class="settings-section-header">
						<span class="settings-section-header-icon">ORES</span>
						<span>ORES Alerts</span>
					</div>
					<div class="settings-section compact inline" id="sound-alert-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Sound alerts for high ORES scores</div>
							<div class="settings-section-desc">Play a sound when an edit above the threshold is added to the queue</div>
						</div>
					</div>
					<div class="settings-section compact inline" id="sound-alert-ores-score">
						<div class="settings-section-content">
							<div class="settings-section-title">ORES score threshold</div>
							<div class="settings-section-desc">Play a sound alert when an edit with an ORES score above this value is added</div>
						</div>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title">Individual Sound Volumes</div>
					<div class="settings-section-desc">Adjust the volume for each sound effect and preview them</div>
					<div id="sound-volumes-container"></div>
				</div>
			`;

			// Master volume control
			this.createVolumeControl(
				this.contentContainer.querySelector("#master-volume-control"),
				null,
				"Master Volume",
				"Controls all sound volumes",
				null
			);

			// Override the createVolumeControl for master volume
			const masterContainer = this.contentContainer.querySelector("#master-volume-control");
			masterContainer.innerHTML = "";
			const wrapper = document.createElement("div");
			wrapper.classList.add("audio-volume-control");
			masterContainer.appendChild(wrapper);

			const masterValue = wikishield.options.masterVolume ?? 0.5;

			wrapper.innerHTML = `
				<div class="audio-control-slider-container">
					<input type="range" class="audio-volume-slider" min="0" max="1" step="0.01" value="${masterValue}">
					<input type="number" class="audio-volume-input" min="0" max="1" step="0.01" value="${masterValue}">
				</div>
			`;

			const masterSlider = wrapper.querySelector(".audio-volume-slider");
			const masterInput = wrapper.querySelector(".audio-volume-input");

			const updateMasterVolume = (newValue) => {
				const val = Math.max(0, Math.min(1, Number(newValue)));
				masterSlider.value = val;
				masterInput.value = val.toFixed(2);
				wikishield.options.masterVolume = val;
				wikishield.saveOptions(wikishield.options);
			};

			masterSlider.addEventListener("input", () => updateMasterVolume(masterSlider.value));
			masterInput.addEventListener("change", () => updateMasterVolume(masterInput.value));

			// ORES alert toggle
			this.createToggle(
				this.contentContainer.querySelector("#sound-alert-toggle"),
				wikishield.options.enableSoundAlerts,
				(newValue) => {
					wikishield.options.enableSoundAlerts = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			// ORES alert threshold
			this.createNumericInput(
				this.contentContainer.querySelector("#sound-alert-ores-score"),
				wikishield.options.soundAlertORESScore, 0, 1, 0.05,
				(newValue) => {
					wikishield.options.soundAlertORESScore = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			// Individual sound controls
			const soundsContainer = this.contentContainer.querySelector("#sound-volumes-container");

			const sounds = [
				{ key: "click", title: "Click Sound", desc: "Played when clicking buttons and UI elements", fn: wikishield.queue.playClickSound },
				{ key: "notification", title: "Notification Sound", desc: "Played when you recieve an alert or notice", fn: wikishield.queue.playNotificationSound },
				{ key: "alert", title: "Alert Sound", desc: "Played when a high ORES score edit is added to the queue", fn: wikishield.queue.playAlertSound },
				{ key: "whoosh", title: "Whoosh Sound", desc: "Played when items are removed or cleared", fn: wikishield.queue.playWhooshSound },
				{ key: "warn", title: "Warn Sound", desc: "Played when issuing a warning to a user", fn: wikishield.queue.playWarnSound },
				{ key: "rollback", title: "Rollback Sound", desc: "Played when performing a rollback action", fn: wikishield.queue.playRollbackSound },
				{ key: "report", title: "Report Sound", desc: "Played when reporting a user or page", fn: wikishield.queue.playReportSound },
				{ key: "thank", title: "Thank Sound", desc: "Played when thanking a user for their edit", fn: wikishield.queue.playThankSound },
				{ key: "protection", title: "Protection Sound", desc: "Played when requesting page protection", fn: wikishield.queue.playProtectionSound },
				{ key: "block", title: "Block Sound", desc: "Played when blocking a user", fn: wikishield.queue.playBlockSound },
				{ key: "sparkle", title: "Sparkle Sound", desc: "Played when highlighting or whitelisting users", fn: wikishield.queue.playSparkleSound }
			];

			sounds.forEach(sound => {
				this.createVolumeControl(
					soundsContainer,
					sound.key,
					sound.title,
					sound.desc,
					sound.fn
				);
			});
		}

		/**
		 * Open appearance settings section (Dark mode only)
		 */
		openAppearance() {
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Appearance</div>
					<div class="settings-section-desc">
						Light mode will come to WikiShield in a future release.
					</div>
					<div style="
						margin-top: 24px;
						padding: 20px;
						background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(240, 147, 251, 0.15));
						border: 1px solid rgba(102, 126, 234, 0.3);
						border-radius: 12px;
						text-align: center;
					">
						<div style="font-size: 2em; margin-bottom: 12px;">🌙</div>
						<div style="font-weight: 600; font-size: 1.1em; margin-bottom: 8px; color: #e0e0e0;">Dark Mode Active</div>
						<div style="opacity: 0.8; font-size: 0.9em; color: #c0c0c0;">The ultimate viewing experience</div>
					</div>
				</div>
			`;
		}

		/**
		 * Open controls settings section
		 */
		openControls() {
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Control scripts</div>
					<div class="settings-section-desc">Below you can change what actions are completed when a key is pressed.</div>
					<div class="add-action-button new-control-script">
						<span class="fa fa-plus"></span>
						New control script
					</div>
				</div>
			`;

			for (const control of wikishield.options.controlScripts) {
				const container = document.createElement("div");
				container.classList.add("settings-section");
				this.contentContainer.appendChild(container);

				this.createControlInterface(container, control);
			}

			this.updateDuplicateControls();

			const addButton = this.contentContainer.querySelector(".new-control-script");

			addButton.addEventListener("click", () => {
				wikishield.options.controlScripts.unshift({
					keys: [],
					actions: []
				});
				this.openControls();
			});
		}

		/**
		 * Find which, if any, keys are used for more than one control
		 * @returns {String[]} List of keys used more than once
		 */
		findDuplicateControls() {
			const keys = {};

			for (const control of wikishield.options.controlScripts) {
				for (const key of control.keys) {
					if (!keys[key]) {
						keys[key] = 0;
					}

					keys[key] += 1;
				}
			}

			const multiples = [];
			Object.keys(keys).forEach(key => {
				if (keys[key] > 1) {
					multiples.push(key);
				}
			});
			return multiples;
		}

		/**
		 * Highlight any duplicated control keys
		 */
		updateDuplicateControls() {
			const duplicateControls = this.findDuplicateControls();
			[...document.querySelectorAll(".control-keys > div[data-key]")].forEach(elem => {
				if (duplicateControls.includes(elem.dataset.key)) {
					elem.classList.add("key-duplicate");
				} else {
					elem.classList.remove("key-duplicate");
				}
			});
		}

		/**
		 * Create interface for changing what a control does
		 * @param {HTMLElement} container Parent element
		 * @param {Object} control The control object, see wikishieldData.controlScripts
		 */
		createControlInterface(container, control) {
			container.innerHTML = `
				<div class="control-container">
					<div class="control-container-title">When these keys are pressed</div>
					<div class="control-keys"></div>
					<div class="control-container-title" style="margin-top: 10px;">Complete these actions</div>
					<div class="control-actions"></div>
				</div>
			`;

			const keyContainer = container.querySelector(".control-keys");
			const actionContainer = container.querySelector(".control-actions");

			for (const key of control.keys) {
				const keyElem = document.createElement("div");
				keyContainer.appendChild(keyElem);
				keyElem.innerHTML = `
					<div class="key-elem-title">${key === " " ? "space" : key}</div>
					<span class="fas fa-trash-can remove"></span>
				`;
				keyElem.dataset.key = key;

				keyElem.querySelector(".remove").addEventListener("click", () => {
					const set = new Set(control.keys);
					set.delete(key);
					control.keys = [...set];
					this.createControlInterface(container, control);
					this.updateDuplicateControls();
					wikishield.saveOptions(wikishield.options);
				});
			}

			const plusElem = document.createElement("div");
			keyContainer.appendChild(plusElem);
			plusElem.innerHTML = `<span class="fas fa-plus"></span>`;
			plusElem.style.cursor = "pointer";

			plusElem.addEventListener("click", () => {
				[...document.querySelectorAll(".key-select")].forEach(elem => elem.remove());
				const keySelect = document.createElement("div");
				keySelect.classList.add("key-select");
				keySelect.innerHTML = "Press a key...";
				plusElem.parentElement.insertBefore(keySelect, plusElem);

				keySelect.addEventListener("click", () => keySelect.remove());
				this.keypressCallback = (key) => {
					const set = new Set(control.keys);
					set.add(key);
					control.keys = [...set];

					this.createControlInterface(container, control);
					this.updateDuplicateControls();
					this.keypressCallback = null;
					wikishield.saveOptions(wikishield.options);
				};
			});

			for (const action of control.actions) {
				this.createActionItem(
					actionContainer,
					action,
					control,
					() => {
						wikishield.saveOptions(wikishield.options);
						this.createControlInterface(container, control);
					}
				);
			}

			const bottomContainer = document.createElement("div");
			bottomContainer.classList.add("control-bottom-container");
			bottomContainer.innerHTML = `
				<div class="add-action-container"></div>
				<div>
					<div class="add-action-button control-delete">Delete</div>
				</div>
			`;
			actionContainer.appendChild(bottomContainer);

			bottomContainer.querySelector(".control-delete").addEventListener("click", () => {
				wikishield.queue.playClickSound();
				wikishield.options.controlScripts.splice(wikishield.options.controlScripts.indexOf(control), 1);
				wikishield.saveOptions(wikishield.options);
				this.openControls();
			});

			const addContainer = bottomContainer.querySelector(".add-action-container");

			const resetAddContainer = () => {
				addContainer.innerHTML = `<div class="add-action-button new-button">Add new action</div>`;

				addContainer.querySelector(".new-button").addEventListener("click", () => {
					wikishield.queue.playClickSound();
					addContainer.innerHTML = `
						<select style="height: 35px;"></select>
						<div class="add-action-button cancel-button">Cancel</div>
						<div class="add-action-button create-button">Create</div>
					`;

					const select = addContainer.querySelector("select");

					Object.keys(wikishield.interface.eventManager.events).forEach(name => {
						select.innerHTML += `<option value="${name}">${wikishield.interface.eventManager.events[name].description}</option>`;
					});
					select.innerHTML += `<option value="if">If condition</option>`;

					addContainer.querySelector(".cancel-button").addEventListener("click", () => {
						wikishield.queue.playClickSound();
						resetAddContainer();
					});
					addContainer.querySelector(".create-button").addEventListener("click", () => {
						wikishield.queue.playClickSound();
						const action = {
							name: select.value,
							params: {}
						};
						if (select.value === "if") {
							action.actions = [];
							action.condition = "operatorNonAdmin";
						}

						control.actions.push(action);
						wikishield.saveOptions(wikishield.options);
						this.createControlInterface(container, control);
					});
				});
			};

			resetAddContainer();
		}

		/**
		 * Given an action, find its parent
		 * @param {Object} action
		 * @param {Object} parent Object to search through
		 * @returns {Object} The parent action
		 */
		findParentOfAction(action, parent) {
			if (parent.actions.indexOf(action) !== -1) {
				return parent;
			}

			for (const act of parent.actions) {
				if (act.name === "if") {
					const result = this.findParentOfAction(action, act);
					if (result) {
						return result;
					}
				}
			}
		}

		/**
		 * Create the interface for a single action
		 * @param {HTMLElement} container Parent element
		 * @param {Object} action
		 * @param {Object} control The parent control object
		 * @param {() => void} onChange Function to callback if the action is modified
		 */
		createActionItem(container, action, control, onChange) {
			const itemContainer = document.createElement("div");
			itemContainer.classList.add("control-action");
			container.appendChild(itemContainer);

			if (action.name === "if") {
				itemContainer.innerHTML = `
					<div class="control-action-title">
						<div class="control-action-title-left">
							<span class="fas fa-circle-question"></span>
							If <select></select> then:
						</div>
						<div class="control-action-title-right"></div>
					</div>
				`;

				const select = itemContainer.querySelector("select");

				for (const key in wikishieldEventData.conditions) {
					select.innerHTML += `<option value=${key}>${wikishieldEventData.conditions[key].desc}</option>`;
				}

				select.value = action.condition;

				select.addEventListener("change", () => {
					action.condition = select.value;
					onChange();
				});

				for (const subaction of action.actions) {
					this.createActionItem(itemContainer, subaction, control, onChange);
				}
			} else {
				const event = wikishield.interface.eventManager.events[action.name];
				itemContainer.innerHTML = `
					<div class="control-action-title">
						<div class="control-action-title-left">
							<span class="${event.icon}"></span>
							${event.description}
						</div>
						<div class="control-action-title-right"></div>
					</div>
				`;

				for (const param of (event.parameters || [])) {
					this.createItemParameter(itemContainer, param, action.params[param.id] || "", (value) => {
						action.params[param.id] = value;
						wikishield.saveOptions(wikishield.options);
					});
				}
			}

			itemContainer.querySelector(".control-action-title-right").innerHTML = `
				<span class="fas fa-chevron-up move-action-up"></span>
				<span class="fas fa-chevron-down move-action-down"></span>
				<span class="fas fa-trash-can delete-action"></span>
			`;

			itemContainer.querySelector(".move-action-down").addEventListener("click", () => {
				const parent = this.findParentOfAction(action, control);
				const actionIndex = parent.actions.indexOf(action);

				if (parent.actions.indexOf(action) === parent.actions.length - 1) {
					if (parent.name !== "if") {
						return;
					}

					const grandparent = this.findParentOfAction(parent, control);
					grandparent.actions.splice(grandparent.actions.indexOf(parent) + 1, 0, action);
					parent.actions.splice(actionIndex, 1);
				} else {
					const nextSibling = parent.actions[actionIndex + 1];
					if (nextSibling.name === "if") {
						nextSibling.actions.unshift(action);
						parent.actions.splice(actionIndex, 1);
					} else {
						parent.actions.splice(actionIndex, 1);
						parent.actions.splice(actionIndex + 1, 0, action);
					}
				}

				onChange();
			});

			itemContainer.querySelector(".move-action-up").addEventListener("click", () => {
				const parent = this.findParentOfAction(action, control);
				const actionIndex = parent.actions.indexOf(action);

				if (parent.actions.indexOf(action) === 0) {
					if (parent.name !== "if") {
						return;
					}

					const grandparent = this.findParentOfAction(parent, control);
					grandparent.actions.splice(grandparent.actions.indexOf(parent), 0, action);
					parent.actions.splice(actionIndex, 1);
				} else {
					const prevSibling = parent.actions[actionIndex - 1];
					if (prevSibling.name === "if") {
						prevSibling.actions.push(action);
						parent.actions.splice(actionIndex, 1);
					} else {
						parent.actions.splice(actionIndex, 1);
						parent.actions.splice(actionIndex - 1, 0, action);
					}
				}

				onChange();
			});

			itemContainer.querySelector(".delete-action").addEventListener("click", () => {
				const parent = this.findParentOfAction(action, control);
				parent.actions.splice(parent.actions.indexOf(action), 1);
				onChange();
			});
		}

		/**
		 * Given a parameter, create a label and input
		 * @param {HTMLElement} container
		 * @param {Object} parameter
		 * @param {String} value
		 * @param {(value: string) => void} onChange
		 */
		createItemParameter(container, parameter, value, onChange) {
			const parameterElem = document.createElement("div");
			parameterElem.classList.add("action-parameter");
			container.appendChild(parameterElem);
			parameterElem.innerHTML = `
				<div class="parameter-title">${parameter.title}</div>
			`;

			if (parameter.type === "choice") {
				parameterElem.innerHTML += `<select></select>`;
				const select = parameterElem.querySelector("select");

				for (const choice of parameter.options) {
					select.innerHTML += `<option>${choice}</option>`;
				}

				select.value = value;
				select.addEventListener("change", () => onChange(select.value));
			} else if (parameter.type === "text") {
				parameterElem.innerHTML += `<input type="text">`;
				const input = parameterElem.querySelector("input");
				input.value = value;

				input.addEventListener("keydown", (event) => {
					if (event.key.toLowerCase() === "enter") {
						onChange(input.value);
						input.blur();
					}
				});
				input.addEventListener("blur", () => onChange(input.value));
			}
		}

		/**
		 * Open AI Analysis settings section
		 */
		openAI() {
			this.contentContainer.innerHTML = `
				<div class="settings-section" id="enable-ollama-ai">
					<div class="settings-section-title">Enable Ollama AI Analysis</div>
					<div class="settings-section-desc">Use local AI models with complete privacy. Free & fast.</div>
				</div>

				<div class="settings-section" id="ollama-server-url">
					<div class="settings-section-title">Server URL</div>
					<div class="settings-section-desc">
						<input type="text" id="ollama-url-input" value="${wikishield.options.ollamaServerUrl}"
							style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; margin-bottom: 8px;"
							placeholder="http://localhost:11434">
						<button id="test-connection-btn" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em;">
							Test Connection
						</button>
						<span id="connection-status" style="margin-left: 8px; font-size: 0.9em;"></span>
					</div>
				</div>

				<div class="settings-section" id="ollama-model-select">
					<div class="settings-section-title">Model Selection</div>
					<div class="settings-section-desc">
						<button id="refresh-models-btn" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em;">
							<span class="fa fa-sync"></span> Refresh Models
						</button>
						<span id="models-status" style="margin-left: 8px; font-size: 0.9em;"></span>
						<div style="margin-top: 12px;" id="models-container">
							<div style="color: #666; font-style: italic; font-size: 0.9em;">Click "Refresh Models" to load available models</div>
						</div>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title" style="color: #dc3545;">CORS Setup Required</div>
					<div class="settings-section-desc" style="background: #fff3cd20; padding: 10px; border-radius: 6px; border-left: 4px solid #ffc107; font-size: 0.9em; color: #333;">
						<strong>Set environment variable:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; color: #333;">OLLAMA_ORIGINS</code>
						<br><strong>Value:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; color: #333;">https://en.wikipedia.org,https://*.wikipedia.org</code>
						<br><br>
						<details style="cursor: pointer;">
							<summary style="font-weight: 600; margin-bottom: 6px;">Windows (Permanent)</summary>
							<ol style="margin: 6px 0; padding-left: 20px; font-size: 0.85em;">
								<li>System Properties → Environment Variables</li>
								<li>New Variable: <code style="color: #333;">OLLAMA_ORIGINS</code></li>
								<li>Value: <code style="color: #333;">https://en.wikipedia.org,https://*.wikipedia.org</code></li>
								<li>Restart Ollama</li>
							</ol>
						</details>
						<details style="cursor: pointer;">
							<summary style="font-weight: 600; margin-bottom: 6px;">Windows (Temporary)</summary>
							<pre style="background: #2d2d2d; color: #f8f8f2; padding: 8px; border-radius: 4px; font-size: 0.8em; margin: 6px 0;">$env:OLLAMA_ORIGINS="https://en.wikipedia.org,https://*.wikipedia.org"
	ollama serve</pre>
						</details>
						<details style="cursor: pointer;">
							<summary style="font-weight: 600; margin-bottom: 6px;">macOS/Linux</summary>
							Add to <code>~/.bashrc</code> or <code>~/.zshrc</code>:
							<pre style="background: #2d2d2d; color: #f8f8f2; padding: 8px; border-radius: 4px; font-size: 0.8em; margin: 6px 0;">export OLLAMA_ORIGINS="https://en.wikipedia.org,https://*.wikipedia.org"</pre>
							Then: <code>source ~/.bashrc && ollama serve</code>
						</details>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title">Quick Info</div>
					<div class="settings-section-desc" style="font-size: 0.9em;">
						<strong>Get Ollama:</strong> <a href="https://ollama.com" target="_blank" style="color: #667eea; font-weight: bold;">ollama.com</a>
						<br><strong>Popular models:</strong> llama3.2, mistral, gemma2, qwen2.5
						<br><strong>Detects:</strong> Vandalism, spam, POV, attacks, copyright issues, policy violations
					</div>
				</div>
			`;

			// Enable/disable toggle
			this.createToggle(
				this.contentContainer.querySelector("#enable-ollama-ai"),
				wikishield.options.enableOllamaAI,
				(newValue) => {
					wikishield.options.enableOllamaAI = newValue;
					wikishield.saveOptions(wikishield.options);

					// Initialize or destroy Ollama AI instance
					if (newValue) {
						wikishield.ollamaAI = new WikiShieldOllamaAI(
							wikishield.options.ollamaServerUrl,
							wikishield.options.ollamaModel
						);
						wikishield.logger.log("Ollama AI integration enabled");
					} else {
						wikishield.ollamaAI = null;
						wikishield.logger.log("Ollama AI integration disabled");
					}
				}
			);

			// Server URL input handler
			const urlInput = this.contentContainer.querySelector("#ollama-url-input");
			urlInput.addEventListener('change', () => {
				wikishield.options.ollamaServerUrl = urlInput.value.trim();
				wikishield.saveOptions(wikishield.options);
				if (wikishield.ollamaAI) {
					wikishield.ollamaAI.serverUrl = wikishield.options.ollamaServerUrl;
				}
				wikishield.logger.log(`Ollama server URL updated: ${wikishield.options.ollamaServerUrl}`);
			});

			// Test connection button
			const testBtn = this.contentContainer.querySelector("#test-connection-btn");
			const statusSpan = this.contentContainer.querySelector("#connection-status");
			testBtn.addEventListener('click', async () => {
				// Cancel all active AI requests
				if (wikishield.ollamaAI) {
					wikishield.ollamaAI.cancelAllAnalyses();
				}

				statusSpan.innerHTML = '<span style="color: #ffc107;">Testing...</span>';
				testBtn.disabled = true;

				const tempAI = new WikiShieldOllamaAI(wikishield.options.ollamaServerUrl, "");
				const connected = await tempAI.testConnection();

				if (connected) {
					statusSpan.innerHTML = '<span style="color: #28a745;"><span class="fa fa-check-circle"></span> Connected!</span>';
				} else {
					statusSpan.innerHTML = `
						<span style="color: #dc3545;">
							<span class="fa fa-times-circle"></span> Failed to connect
							<br><small style="font-size: 0.85em;">Make sure Ollama is running with CORS enabled (see instructions above)</small>
						</span>
					`;
				}
				testBtn.disabled = false;
			});

			// Refresh models button
			const refreshBtn = this.contentContainer.querySelector("#refresh-models-btn");
			const modelsStatus = this.contentContainer.querySelector("#models-status");
			const modelsContainer = this.contentContainer.querySelector("#models-container");

			refreshBtn.addEventListener('click', async () => {
				// Cancel all active AI requests
				if (wikishield.ollamaAI) {
					wikishield.ollamaAI.cancelAllAnalyses();
				}

				modelsStatus.innerHTML = '<span style="color: #ffc107;">Loading...</span>';
				refreshBtn.disabled = true;

				try {
					const tempAI = new WikiShieldOllamaAI(wikishield.options.ollamaServerUrl, "");
					const models = await tempAI.fetchModels();

					if (models.length === 0) {
						modelsContainer.innerHTML = '<div style="color: #dc3545;">No models found. Please install models using: <code>ollama pull [model-name]</code></div>';
						modelsStatus.innerHTML = '<span style="color: #dc3545;">No models found</span>';
					} else {
						modelsStatus.innerHTML = `<span style="color: #28a745;"><span class="fa fa-check-circle"></span> Found ${models.length} model(s)</span>`;

						let modelsHTML = '<div style="display: grid; gap: 8px; margin-top: 8px;">';
						models.forEach(model => {
							const isSelected = model.name === wikishield.options.ollamaModel;
							const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(1);
							modelsHTML += `
								<div class="ollama-model-item" data-model="${model.name}" style="
									padding: 12px;
									border: 2px solid ${isSelected ? '#667eea' : 'rgba(128, 128, 128, 0.3)'};
									border-radius: 6px;
									cursor: pointer;
									background: ${isSelected ? 'rgba(102, 126, 234, 0.15)' : 'transparent'};
									transition: all 0.2s;
								">
									<div style="display: flex; align-items: center; gap: 8px;">
										<span class="fa ${isSelected ? 'fa-check-circle' : 'fa-circle'}" style="color: ${isSelected ? '#667eea' : 'rgba(128, 128, 128, 0.5)'};"></span>
										<strong style="flex: 1;">${model.name}</strong>
										<span style="font-size: 0.85em; opacity: 0.7;">${sizeGB} GB</span>
									</div>
									<div style="font-size: 0.85em; opacity: 0.6; margin-top: 4px;">
										Modified: ${new Date(model.modified_at).toLocaleDateString()}
									</div>
								</div>
							`;
						});
						modelsHTML += '</div>';
						modelsContainer.innerHTML = modelsHTML;

						// Add click handlers for model selection
						modelsContainer.querySelectorAll('.ollama-model-item').forEach(item => {
							item.addEventListener('click', () => {
								// Cancel all active AI requests when switching models
								if (wikishield.ollamaAI) {
									wikishield.ollamaAI.cancelAllAnalyses();
								}

								const modelName = item.dataset.model;
								wikishield.options.ollamaModel = modelName;
								wikishield.saveOptions(wikishield.options);
								if (wikishield.ollamaAI) {
									wikishield.ollamaAI.model = modelName;
								}
								wikishield.logger.log(`Ollama model selected: ${modelName}`);

								// Update UI
								modelsContainer.querySelectorAll('.ollama-model-item').forEach(i => {
									i.style.border = '2px solid rgba(128, 128, 128, 0.3)';
									i.style.background = 'transparent';
									i.querySelector('.fa').classList.remove('fa-check-circle');
									i.querySelector('.fa').classList.add('fa-circle');
									i.querySelector('.fa').style.color = 'rgba(128, 128, 128, 0.5)';
								});
								item.style.border = '2px solid #667eea';
								item.style.background = 'rgba(102, 126, 234, 0.15)';
								item.querySelector('.fa').classList.remove('fa-circle');
								item.querySelector('.fa').classList.add('fa-check-circle');
								item.querySelector('.fa').style.color = '#667eea';
							});

							// Hover effects
							item.addEventListener('mouseenter', () => {
								if (item.dataset.model !== wikishield.options.ollamaModel) {
									item.style.borderColor = '#667eea';
								}
							});
							item.addEventListener('mouseleave', () => {
								if (item.dataset.model !== wikishield.options.ollamaModel) {
									item.style.borderColor = 'rgba(128, 128, 128, 0.3)';
								}
							});
						});
					}
				} catch (err) {
					modelsContainer.innerHTML = `
						<div class="error-box" style="color: #721c24; padding: 12px; background: #fff3cd20; border-radius: 6px; border-left: 4px solid #dc3545;">
							<strong>Error:</strong> ${err.message}
							<br><br>
							<strong>Troubleshooting:</strong>
							<ul style="margin: 8px 0; padding-left: 20px;">
								<li>Make sure Ollama is running</li>
								<li>Check that CORS is enabled (see instructions above)</li>
								<li>Verify the server URL is correct</li>
								<li>Try the "Test Connection" button first</li>
							</ul>
						</div>
					`;
					modelsStatus.innerHTML = '<span style="color: #dc3545;"><span class="fa fa-times-circle"></span> Error loading models</span>';
				}

				refreshBtn.disabled = false;
			});
		}

		/**
		 * Open gadgets settings seciton
		 */
		openGadgets() {
			this.contentContainer.innerHTML = `
				<div class="settings-toggles-section">
					<div class="settings-section-header">
						<span class="settings-section-header-icon">Simple</span>
						<span></span>
					</div>
                    <div class="settings-section compact inline" id="username-highlighting-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Highlight username</div>
							<div class="settings-section-desc">If your username appears in a diff, the edit is highlighted in the queue and outlined in the diff.</div>
						</div>
					</div>
                    <div class="settings-section compact inline" id="welcome-latin-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Latin welcome</div>
							<div class="settings-section-desc">When a Latin character is detected in a username, the Latin welcome template will be used instead of the default.</div>
						</div>
					</div>
					<div class="settings-section compact inline" id="auto-welcome-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Automatic welcoming of new users</div>
							<div class="settings-section-desc">Automatically welcome new users with empty talk pages when moving past their constructive edits</div>
						</div>
					</div>
				</div>

				<div class="settings-toggles-section">
					<div class="settings-section-header">
						<span class="settings-section-header-icon">AI</span>
						<span>Requires AI Analysis to be enabled</span>
					</div>
					<div class="settings-section compact inline" id="edit-analysis-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Edit Analysis</div>
							<div class="settings-section-desc">Suggests actions to take on edits, such as "welcome", "thank", "rollback", "rever-and-warn"</div>
						</div>
					</div>
					<div class="settings-section compact inline" id="username-analysis-toggle">
						<div class="settings-section-content">
							<div class="settings-section-title">Username Analysis</div>
							<div class="settings-section-desc">Flags potentially problematic usernames and prompts you to report them to UAA</div>
						</div>
					</div>
				</div>
			`;

            this.createToggle(
				this.contentContainer.querySelector("#username-highlighting-toggle"),
				wikishield.options.enableUsernameHighlighting,
				(newValue) => {
					wikishield.options.enableUsernameHighlighting = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

            this.createToggle(
				this.contentContainer.querySelector("#welcome-latin-toggle"),
				wikishield.options.enableWelcomeLatin,
				(newValue) => {
					wikishield.options.enableWelcomeLatin = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);
			this.createToggle(
				this.contentContainer.querySelector("#auto-welcome-toggle"),
				wikishield.options.enableAutoWelcome,
				(newValue) => {
					wikishield.options.enableAutoWelcome = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);

			this.createToggle(
				this.contentContainer.querySelector("#edit-analysis-toggle"),
				wikishield.options.enableEditAnalysis,
				(newValue) => {
					wikishield.options.enableEditAnalysis = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);
			this.createToggle(
				this.contentContainer.querySelector("#username-analysis-toggle"),
				wikishield.options.enableUsernameAnalysis,
				(newValue) => {
					wikishield.options.enableUsernameAnalysis = newValue;
					wikishield.saveOptions(wikishield.options);
				}
			);
		}

		/**
		 * Open whitelist settings section
		 */
		openWhitelist() {
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Whitelisted users</div>
					<div class="settings-section-desc">This is a list of users you have whitelisted. Edits by these users will not appear in your queue.</div>
					<div class="user-input-container">
						<input type="text" id="whitelist-username-input" placeholder="Enter username to whitelist..." class="username-input">
						<button id="add-whitelist-user" class="add-user-button">
							Add User
						</button>
					</div>
				</div>
				<div class="settings-section user-container"></div>
			`;

			const container = this.contentContainer.querySelector(".user-container");
			const input = this.contentContainer.querySelector("#whitelist-username-input");
			const button = this.contentContainer.querySelector("#add-whitelist-user");

			const addUser = () => {
				const username = input.value.trim();
				if (username) {
					wikishield.whitelist.set(username, Date.now());
					wikishield.saveWhitelist();
					input.value = "";
					this.openWhitelist(); // Refresh the list
					wikishield.sounds.success();
				}
			};

			button.addEventListener("click", addUser);
			input.addEventListener("keypress", (e) => {
				if (e.key === "Enter") addUser();
			});

			this.createUserListWithDates(container, wikishield.whitelist, wikishield.saveWhitelist.bind(wikishield));
		}

		/**
		 * Create a list of users given a set of usernames (old format)
		 * @param {HTMLElement} container
		 * @param {Set<string>} set
		 */
		createUserList(container, set) {
			for (const user of [...set]) {
				const userItem = document.createElement("div");
				container.appendChild(userItem);
				userItem.innerHTML = `
					<div>
						<a target="_blank" href="${wikishield.util.pageLink(`Special:Contributions/${user}`)}">${user}</a>
					</div>
					<div class="add-action-button remove-button">Remove</div>
				`;
				userItem.querySelector(".remove-button").addEventListener("click", () => {
					set.delete(user);
					userItem.remove();
				});
			}
		}

		/**
		 * Create a list of users with timestamps
		 * @param {HTMLElement} container
		 * @param {Map<string, number>} map Map of username to timestamp
		 * @param {Function} saveCallback Function to call when list is modified
		 */
		createUserListWithDates(container, map, saveCallback) {
			// Sort by most recent first
			const sortedEntries = [...map.entries()].sort((a, b) => b[1] - a[1]);

			for (const [user, timestamp] of sortedEntries) {
				const userItem = document.createElement("div");
				userItem.style.display = "flex";
				userItem.style.justifyContent = "space-between";
				userItem.style.alignItems = "center";
				userItem.style.padding = "8px 12px";
				userItem.style.marginBottom = "6px";
				userItem.style.background = "rgba(255, 255, 255, 0.05)";
				userItem.style.borderRadius = "8px";
				userItem.style.border = "1px solid rgba(255, 255, 255, 0.1)";

				const date = new Date(timestamp);
				const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();

				container.appendChild(userItem);
				userItem.innerHTML = `
					<div style="display: flex; flex-direction: column; gap: 4px;">
						<a target="_blank" href="${wikishield.util.pageLink(`Special:Contributions/${user}`)}" style="font-weight: 600;">${user}</a>
						<span style="font-size: 0.85em; opacity: 0.7;">Added: ${dateStr}</span>
					</div>
					<div class="add-action-button remove-button">Remove</div>
				`;
				userItem.querySelector(".remove-button").addEventListener("click", () => {
					map.delete(user);
					userItem.remove();
					if (saveCallback) saveCallback();
				});
			}

			if (sortedEntries.length === 0) {
				container.innerHTML = '<div style="opacity: 0.6; text-align: center; padding: 20px;">No users in list</div>';
			}
		}

		/**
		 * Open highlighted settings section
		 */
		openHighlighted() {
			const expiryString = wikishield.options.highlightedExpiry;
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Highlighted users</div>
					<div class="settings-section-desc">This is a list of users you have highlighted. Edits by these users will appear before other edits in your queue. Highlights expire based on your configured expiry time (currently: ${expiryString}).</div>
					<div class="user-input-container">
						<input type="text" id="highlighted-username-input" placeholder="Enter username to highlight..." class="username-input">
						<button id="add-highlighted-user" class="add-user-button">
							Add User
						</button>
					</div>
				</div>
				<div class="settings-section user-container"></div>
			`;

			const container = this.contentContainer.querySelector(".user-container");
			const input = this.contentContainer.querySelector("#highlighted-username-input");
			const button = this.contentContainer.querySelector("#add-highlighted-user");

			const addUser = () => {
				const username = input.value.trim();
				if (username) {
					const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.options.highlightedExpiry);
					const expirationTime = Date.now() + expiryMs;
					wikishield.highlighted.set(username, expirationTime);
					wikishield.saveHighlighted();
					input.value = "";
					this.openHighlighted(); // Refresh the list
					wikishield.sounds.success();
				}
			};

			button.addEventListener("click", addUser);
			input.addEventListener("keypress", (e) => {
				if (e.key === "Enter") addUser();
			});

			this.createHighlightedUserList(container);
		}

		/**
		 * Create a list of highlighted users with expiration times
		 * @param {HTMLElement} container
		 */
		createHighlightedUserList(container) {
			// Sort by most recent first
			const sortedEntries = [...wikishield.highlighted.entries()].sort((a, b) => b[1] - a[1]);

			for (const [user, expirationTime] of sortedEntries) {
				const userItem = document.createElement("div");
				userItem.style.display = "flex";
				userItem.style.justifyContent = "space-between";
				userItem.style.alignItems = "center";
				userItem.style.padding = "8px 12px";
				userItem.style.marginBottom = "6px";
				userItem.style.background = "rgba(255, 255, 255, 0.05)";
				userItem.style.borderRadius = "8px";
				userItem.style.border = "1px solid rgba(255, 255, 255, 0.1)";

				// Calculate added time by using current expiry setting (approximation)
				const expiryMs = wikishield.util.expiryToMilliseconds(wikishield.options.highlightedExpiry);
				const addedTime = expirationTime - expiryMs;
				const date = new Date(addedTime);
				const dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();

				const expiresDate = new Date(expirationTime);
				const expiresStr = expiresDate.toLocaleDateString() + " " + expiresDate.toLocaleTimeString();
				const isExpired = Date.now() > expirationTime;

				container.appendChild(userItem);
				userItem.innerHTML = `
					<div style="display: flex; flex-direction: column; gap: 4px;">
						<a target="_blank" href="${wikishield.util.pageLink(`Special:Contributions/${user}`)}" style="font-weight: 600;">${user}</a>
						<span style="font-size: 0.85em; opacity: 0.7;">Added: ${dateStr}</span>
						<span style="font-size: 0.85em; opacity: 0.7; color: ${isExpired ? '#ff6b6b' : '#51cf66'};">
							${isExpired ? 'Expired' : 'Expires'}: ${expiresStr}
						</span>
					</div>
					<div class="add-action-button remove-button">Remove</div>
				`;
				userItem.querySelector(".remove-button").addEventListener("click", () => {
					wikishield.highlighted.delete(user);
					userItem.remove();
					wikishield.saveHighlighted();
				});
			}

			if (sortedEntries.length === 0) {
				container.innerHTML = '<div style="opacity: 0.6; text-align: center; padding: 20px;">No users highlighted</div>';
			}
		}

		/**
		 * Open statistics settings section
		 */
		openStatistics() {
			const stats = wikishield.statistics;
			const revertRate = stats.reviewed > 0 ? Math.round(stats.reverts / stats.reviewed * 1000) / 10 : 0;
			const sessionTime = Date.now() - (stats.sessionStart || Date.now());
			const hours = Math.floor(sessionTime / (1000 * 60 * 60));
			const minutes = Math.floor((sessionTime % (1000 * 60 * 60)) / (1000 * 60));
			const editsPerHour = hours > 0 ? Math.round(stats.reviewed / hours * 10) / 10 : 0;

			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Statistics Overview</div>
					<div class="stats-grid">
						<div class="stat-card">
							<div class="stat-value">${stats.reviewed}</div>
							<div class="stat-label">Edits Reviewed</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.reverts}</div>
							<div class="stat-label">Reverts Made</div>
							<div class="stat-sublabel">${revertRate}% revert rate</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.warnings}</div>
							<div class="stat-label">Warnings Issued</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.reports}</div>
							<div class="stat-label">Reports Filed</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.welcomes}</div>
							<div class="stat-label">Users Welcomed</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.blocks}</div>
							<div class="stat-label">Blocks Issued</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.whitelisted}</div>
							<div class="stat-label">Users Whitelisted</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${stats.highlighted}</div>
							<div class="stat-label">Users Highlighted</div>
						</div>
						<div class="stat-card">
							<div class="stat-value">${hours}h ${minutes}m</div>
							<div class="stat-label">Session Time</div>
							<div class="stat-sublabel">${editsPerHour} edits/hour</div>
						</div>
					</div>
				</div>
				<div class="settings-section">
					<button id="reset-stats-button" class="danger-button">Reset Statistics</button>
				</div>
			`;

			this.contentContainer.querySelector("#reset-stats-button").addEventListener("click", () => {
				if (confirm("Are you sure you want to reset all statistics? This cannot be undone.")) {
					wikishield.statistics = {
						reviewed: 0,
						reverts: 0,
						reports: 0,
						warnings: 0,
						welcomes: 0,
						whitelisted: 0,
						highlighted: 0,
						blocks: 0,
						sessionStart: Date.now()
					};
					wikishield.saveStats(wikishield.statistics);
					this.openStatistics();
					wikishield.sounds.success();
				}
			});
		}

		/**
		 * Open about settings section
		 */
		openAbout() {
			this.contentContainer.innerHTML = `
				<div class="settings-section" style="text-align: center; padding: 40px 20px;">
					<div style="margin-bottom: 24px;">
						<div style="font-size: 3em; margin-bottom: 12px;">🛡️</div>
						<div style="font-size: 2em; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px;">
							WikiShield
						</div>
						<div style="font-size: 1.1em; color: #666; font-weight: 500;">
							Advanced Anti-Vandalism Tool
						</div>
					</div>

					<div style="display: inline-flex; gap: 12px; margin: 24px 0; flex-wrap: wrap; justify-content: center;">
						<div style="padding: 8px 16px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.2);">
							<span style="font-weight: 600;">Version</span>
							<span style="margin-left: 8px; color: #667eea;">${__script__.version}</span>
						</div>
						<div style="padding: 8px 16px; background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.2);">
							<span style="font-weight: 600;">Created by</span>
							<a href="https://en.wikipedia.org/wiki/User:LuniZunie" target="_blank" style="margin-left: 8px; color: #667eea; text-decoration: none; font-weight: 600;">User:LuniZunie</a>
						</div>
					</div>

					<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 32px 0; text-align: center;">
						<div style="padding: 24px 16px; background: rgba(102, 126, 234, 0.05); border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.15);">
							<div style="font-size: 2em; margin-bottom: 8px;">⚡</div>
							<div style="font-weight: 600; margin-bottom: 4px; color: #aaa;">Real-time Detection</div>
							<div style="font-size: 0.9em; color: #888;">Monitor edits as they happen</div>
						</div>
						<div style="padding: 24px 16px; background: rgba(102, 126, 234, 0.05); border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.15);">
							<div style="font-size: 2em; margin-bottom: 8px;">🤖</div>
							<div style="font-weight: 600; margin-bottom: 4px; color: #aaa;">AI-Powered ORES</div>
							<div style="font-size: 0.9em; color: #888;">Intelligent edit scoring</div>
						</div>
						<div style="padding: 24px 16px; background: rgba(102, 126, 234, 0.05); border-radius: 12px; border: 1px solid rgba(102, 126, 234, 0.15);">
							<div style="font-size: 2em; margin-bottom: 8px;">🎨</div>
							<div style="font-weight: 600; margin-bottom: 4px; color: #aaa;">Modern Interface</div>
							<div style="font-size: 0.9em; color: #888;">Beautiful and intuitive</div>
						</div>
					</div>
				</div>

				<div class="settings-section">
					<div class="settings-section-title">Changelog</div>
					<div style="max-height: 400px; overflow-y: auto; padding: 16px; background: rgba(248, 249, 252, 0.15); border-radius: 8px;">
						${__script__.changelog.HTML || "<p style='text-align: center; opacity: 0.6;'>No changelog is available.</p>"}
					</div>
				</div>
			`;

			// Add hover effects to links
			const links = this.contentContainer.querySelectorAll('a');
			links.forEach(link => {
				if (link.style.padding) { // Only for buttons
					link.addEventListener('mouseenter', () => {
						link.style.transform = 'translateY(-2px)';
						link.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
					});
					link.addEventListener('mouseleave', () => {
						link.style.transform = 'translateY(0)';
						link.style.boxShadow = 'none';
					});
				}
			});
		}

		/**
		 * Validate and merge imported settings with current settings
		 * @param {Object} importedSettings The imported settings object
		 * @returns {Object} Result object with success status, merged settings, warnings, and applied count
		 */
		validateAndMergeSettings(importedSettings) {
			const result = {
				success: false,
				settings: JSON.parse(JSON.stringify(wikishield.options)), // Start with current settings
				warnings: [],
				appliedCount: 0,
				error: null
			};

			if (!importedSettings || typeof importedSettings !== 'object') {
				result.error = 'Invalid settings format';
				return result;
			}

			const defaults = wikishieldData.defaultSettings;
			const soundKeys = Object.keys(wikishieldData.sounds);
			const namespaceIds = wikishieldData.namespaces.map(ns => ns.id);
			const expiryOptions = ["none", "1 hour", "1 day", "1 week", "1 month", "3 months", "6 months", "indefinite"];

			// Validate and apply each setting
			for (const [key, value] of Object.entries(importedSettings)) {
				// Skip if key doesn't exist in defaults (unknown setting)
				if (!(key in defaults)) {
					result.warnings.push(`${key}: Unknown setting, ignored`);
					continue;
				}

				try {
					switch (key) {
						case 'maxQueueSize':
						case 'maxEditCount':
							if (typeof value === 'number' && value >= 1 && value <= 500) {
								result.settings[key] = Math.floor(value);
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be 1-500`);
							}
							break;

						case 'minimumORESScore':
						case 'soundAlertORESScore':
						case 'masterVolume':
							if (typeof value === 'number' && value >= 0 && value <= 1) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be 0-1`);
							}
							break;

						case 'enableSoundAlerts':
                        case 'enableUsernameHighlighting':
                        case 'enableLatinWelcome':
						case 'enableAutoWelcome':
						case 'enableEditAnalysis':
						case 'enableUsernameAnalysis':
						case 'showTemps':
						case 'showUsers':
						case 'sortQueueItems':
						case 'enableOllamaAI':
							if (typeof value === 'boolean') {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be boolean`);
							}
							break;

						case 'volumes':
							if (typeof value === 'object' && value !== null) {
								let volumeCount = 0;
								for (const [volumeKey, volumeValue] of Object.entries(value)) {
									if (typeof volumeValue === 'number' && volumeValue >= 0 && volumeValue <= 1) {
										if (!result.settings.volumes) result.settings.volumes = {};
										result.settings.volumes[volumeKey] = volumeValue;
										volumeCount++;
									} else {
										result.warnings.push(`volumes.${volumeKey}: Invalid value (${volumeValue}), must be 0-1`);
									}
								}
								if (volumeCount > 0) result.appliedCount++;
							} else {
								result.warnings.push(`volumes: Invalid format, must be object`);
							}
							break;

						case 'soundMappings':
							if (typeof value === 'object' && value !== null) {
								let mappingCount = 0;
								for (const [triggerKey, soundKey] of Object.entries(value)) {
									if (soundKeys.includes(soundKey)) {
										if (!result.settings.soundMappings) result.settings.soundMappings = {};
										result.settings.soundMappings[triggerKey] = soundKey;
										mappingCount++;
									} else {
										result.warnings.push(`soundMappings.${triggerKey}: Invalid sound (${soundKey})`);
									}
								}
								if (mappingCount > 0) result.appliedCount++;
							} else {
								result.warnings.push(`soundMappings: Invalid format, must be object`);
							}
							break;

						case 'watchlistExpiry':
						case 'highlightedExpiry':
							if (typeof value === 'string' && expiryOptions.includes(value)) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be one of: ${expiryOptions.join(', ')}`);
							}
							break;

						case 'wiki':
							if (typeof value === 'string' && value.length >= 2 && value.length <= 20) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be 2-20 characters`);
							}
							break;

						case 'namespacesShown':
							if (Array.isArray(value)) {
								const validNamespaces = value.filter(id => namespaceIds.includes(id));
								if (validNamespaces.length > 0) {
									result.settings[key] = validNamespaces;
									result.appliedCount++;
									if (validNamespaces.length < value.length) {
										result.warnings.push(`namespacesShown: Some invalid namespace IDs were excluded`);
									}
								} else {
									result.warnings.push(`namespacesShown: No valid namespace IDs found`);
								}
							} else {
								result.warnings.push(`namespacesShown: Invalid format, must be array`);
							}
							break;

						case 'ollamaServerUrl':
							if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid URL format`);
							}
							break;

						case 'ollamaModel':
							if (typeof value === 'string') {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value, must be string`);
							}
							break;

						case 'controlScripts':
							if (Array.isArray(value)) {
								// Basic validation for control scripts structure
								const validScripts = value.filter(script => {
									return script &&
										Array.isArray(script.keys) &&
										Array.isArray(script.actions) &&
										script.keys.length > 0;
								});
								if (validScripts.length > 0) {
									result.settings[key] = validScripts;
									result.appliedCount++;
									if (validScripts.length < value.length) {
										result.warnings.push(`controlScripts: Some invalid scripts were excluded`);
									}
								} else {
									result.warnings.push(`controlScripts: No valid control scripts found`);
								}
							} else {
								result.warnings.push(`controlScripts: Invalid format, must be array`);
							}
							break;

						case 'selectedPalette':
							if (typeof value === 'number' && value >= 0 && value < wikishieldData.colorPalettes.length) {
								result.settings[key] = Math.floor(value);
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be 0-${wikishieldData.colorPalettes.length - 1}`);
							}
							break;

						case 'theme':
							const validThemes = ['theme-light', 'theme-dark'];
							if (typeof value === 'string' && validThemes.includes(value)) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Invalid value (${value}), must be 'theme-light' or 'theme-dark'`);
							}
							break;

						default:
							// For any other setting in defaults that we haven't explicitly handled,
							// just copy it if the type matches
							if (typeof value === typeof defaults[key]) {
								result.settings[key] = value;
								result.appliedCount++;
							} else {
								result.warnings.push(`${key}: Type mismatch, expected ${typeof defaults[key]}, got ${typeof value}`);
							}
							break;
					}
				} catch (error) {
					result.warnings.push(`${key}: Error validating - ${error.message}`);
				}
			}

			result.success = result.appliedCount > 0;
			if (!result.success && result.warnings.length === 0) {
				result.error = 'No valid settings found in import';
			}

			return result;
		}		/**
		 * Open import/export settings section
		 */
		openImportExport() {
			this.contentContainer.innerHTML = `
				<div class="settings-section">
					<div class="settings-section-title">Import/Export Settings</div>
					<div class="settings-section-desc">
						Import, export, or reset your WikiShield settings. Settings are encoded as a base64 string for easy sharing.
					</div>
					<div style="display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap;">
						<button id="export-settings-btn" class="add-action-button" style="flex: 1; min-width: 120px;">
							<span class="fa fa-download"></span> Export Settings
						</button>
						<button id="import-settings-btn" class="add-action-button" style="flex: 1; min-width: 120px;">
							<span class="fa fa-upload"></span> Import Settings
						</button>
						<button id="reset-settings-btn" class="add-action-button" style="flex: 1; min-width: 120px; background: #dc3545;">
							<span class="fa fa-undo"></span> Reset to Default
						</button>
					</div>
					<div id="import-export-status" style="margin-top: 12px; padding: 12px; border-radius: 6px; display: none;"></div>
					<textarea id="import-settings-input"
						placeholder="Paste base64 settings string here..."
						style="
							width: 100%;
							min-height: 100px;
							margin-top: 12px;
							padding: 12px;
							border: 2px solid rgba(128, 128, 128, 0.3);
							border-radius: 6px;
							font-family: 'Courier New', monospace;
							font-size: 0.85em;
							background: rgba(0, 0, 0, 0.2);
							color: inherit;
							display: none;
						"></textarea>
				</div>
			`;

			// Import/Export handlers
			const exportBtn = this.contentContainer.querySelector('#export-settings-btn');
			const importBtn = this.contentContainer.querySelector('#import-settings-btn');
			const resetBtn = this.contentContainer.querySelector('#reset-settings-btn');
			const statusDiv = this.contentContainer.querySelector('#import-export-status');
			const importInput = this.contentContainer.querySelector('#import-settings-input');

			exportBtn.addEventListener('click', () => {
				try {
					const settingsJson = JSON.stringify(wikishield.options);
					const base64String = btoa(settingsJson);

					// Create a temporary textarea to copy to clipboard
					const tempTextarea = document.createElement('textarea');
					tempTextarea.value = base64String;
					document.body.appendChild(tempTextarea);
					tempTextarea.select();
					document.execCommand('copy');
					document.body.removeChild(tempTextarea);

					statusDiv.style.display = 'block';
					statusDiv.style.background = 'rgba(40, 167, 69, 0.2)';
					statusDiv.style.border = '2px solid #28a745';
					statusDiv.style.color = '#28a745';
					statusDiv.innerHTML = `
						<div style="display: flex; align-items: center; gap: 8px;">
							<span class="fa fa-check-circle"></span>
							<div>
								<strong>Settings exported successfully!</strong>
								<div style="font-size: 0.9em; margin-top: 4px;">The base64 string has been copied to your clipboard.</div>
							</div>
						</div>
					`;

					setTimeout(() => {
						statusDiv.style.display = 'none';
					}, 5000);
				} catch (error) {
					statusDiv.style.display = 'block';
					statusDiv.style.background = 'rgba(220, 53, 69, 0.2)';
					statusDiv.style.border = '2px solid #dc3545';
					statusDiv.style.color = '#dc3545';
					statusDiv.innerHTML = `
						<div style="display: flex; align-items: center; gap: 8px;">
							<span class="fa fa-times-circle"></span>
							<div>
								<strong>Export failed!</strong>
								<div style="font-size: 0.9em; margin-top: 4px;">${error.message}</div>
							</div>
						</div>
					`;
				}
			});

			importBtn.addEventListener('click', () => {
				if (importInput.style.display === 'none') {
					importInput.style.display = 'block';
					importBtn.innerHTML = '<span class="fa fa-check"></span> Apply Import';
					importBtn.style.background = '#28a745';
					statusDiv.style.display = 'none';
				} else {
					const base64String = importInput.value.trim();
					if (!base64String) {
						statusDiv.style.display = 'block';
						statusDiv.style.background = 'rgba(220, 53, 69, 0.2)';
						statusDiv.style.border = '2px solid #dc3545';
						statusDiv.style.color = '#dc3545';
						statusDiv.innerHTML = `
							<div style="display: flex; align-items: center; gap: 8px;">
								<span class="fa fa-exclamation-circle"></span>
								<div>
									<strong>No input!</strong>
									<div style="font-size: 0.9em; margin-top: 4px;">Please paste a base64 settings string.</div>
								</div>
							</div>
						`;
						return;
					}

					try {
						const settingsJson = atob(base64String);
						const importedSettings = JSON.parse(settingsJson);

						// Validate and merge settings
						const validationResult = this.validateAndMergeSettings(importedSettings);

						if (validationResult.success) {
							wikishield.options = validationResult.settings;
							wikishield.saveOptions(wikishield.options);

							statusDiv.style.display = 'block';
							statusDiv.style.background = 'rgba(40, 167, 69, 0.2)';
							statusDiv.style.border = '2px solid #28a745';
							statusDiv.style.color = '#28a745';

							let warningsHtml = '';
							if (validationResult.warnings.length > 0) {
								warningsHtml = `
									<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(40, 167, 69, 0.3);">
										<strong>Warnings:</strong>
										<ul style="margin: 4px 0 0 20px; font-size: 0.9em;">
											${validationResult.warnings.map(w => `<li>${w}</li>`).join('')}
										</ul>
									</div>
								`;
							}

							statusDiv.innerHTML = `
								<div style="display: flex; align-items: start; gap: 8px;">
									<span class="fa fa-check-circle" style="margin-top: 2px;"></span>
									<div style="flex: 1;">
										<strong>Settings imported successfully!</strong>
										<div style="font-size: 0.9em; margin-top: 4px;">
											${validationResult.appliedCount} setting(s) applied.
										</div>
										${warningsHtml}
									</div>
								</div>
							`;
						} else {
							throw new Error(validationResult.error);
						}
					} catch (error) {
						statusDiv.style.display = 'block';
						statusDiv.style.background = 'rgba(220, 53, 69, 0.2)';
						statusDiv.style.border = '2px solid #dc3545';
						statusDiv.style.color = '#dc3545';
						statusDiv.innerHTML = `
							<div style="display: flex; align-items: center; gap: 8px;">
								<span class="fa fa-times-circle"></span>
								<div>
									<strong>Import failed!</strong>
									<div style="font-size: 0.9em; margin-top: 4px;">${error.message}</div>
								</div>
							</div>
						`;
					}

					importInput.style.display = 'none';
					importInput.value = '';
					importBtn.innerHTML = '<span class="fa fa-upload"></span> Import Settings';
					importBtn.style.background = '';
				}
			});

			resetBtn.addEventListener('click', () => {
				if (confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
					wikishield.options = JSON.parse(JSON.stringify(wikishieldData.defaultSettings));
					wikishield.saveOptions(wikishield.options);

					statusDiv.style.display = 'block';
					statusDiv.style.background = 'rgba(255, 193, 7, 0.2)';
					statusDiv.style.border = '2px solid #ffc107';
					statusDiv.style.color = '#ffc107';
					statusDiv.innerHTML = `
						<div style="display: flex; align-items: center; gap: 8px;">
							<span class="fa fa-info-circle"></span>
							<div>
								<strong>Settings reset to default!</strong>
								<div style="font-size: 0.9em; margin-top: 4px;">Settings have been reset.</div>
							</div>
						</div>
					`;
				}
			});
		}

		/**
		 * Remove all existing settings containers
		 */
		closeSettings() {
			this.isOpen = false;
			document.body.classList.remove("settings-open"); // Remove blur class
			[...document.querySelectorAll(".settings-container")].forEach(elem => elem.remove());
		}

		/**
		 * Handle a keypress while settings are open
		 * @param {KeyboardEvent} event
		 */
		handleKeypress(event) {
			if (event.key.toLowerCase() === "escape") {
				this.closeSettings();
				return;
			}

			if (this.keypressCallback && wikishieldSettingsAllowedKeys.includes(event.key.toLowerCase())) {
				this.keypressCallback(event.key.toLowerCase());
				event.preventDefault();
			}
		}
	}

	class WikiShieldInterface {
		constructor() {
			this.selectedWidthAdjust = null;
			this.startingSectionWidth = null;
			this.startingMouseX = null;
			this.lastCurrentEdit = null;
			this.newerRevisionInterval = null; // For periodic newer revision checking

			this.eventManager = new WikiShieldEventManager();
			this.settings = new WikiShieldSettingsInterface();
			this.selectedMenu = null;
			this.selectedSubmenu = null;
		}

		/**
		 * Create a stylesheet with the given theme's style
		 * @param {String} name
		 */
		loadTheme(name) {
			this.removeTheme();

			// Apply base styles first
			const baseStyle = document.createElement("style");
			baseStyle.classList.add("wikishield-theme-base");
			baseStyle.innerHTML = wikishieldStyling.base;
			document.head.appendChild(baseStyle);

			// Always apply dark theme
			const style = document.createElement("style");
			style.classList.add("wikishield-theme");
			style.innerHTML = wikishieldStyling["theme-dark"];
			document.head.appendChild(style);

			// Set the data-theme attribute to dark
			document.documentElement.setAttribute("data-theme", "dark");

			// Add dark-mode class to body
			document.body.classList.add("dark-mode");

			// Save the theme preference (always dark)
			wikishield.options.theme = "theme-dark";
			wikishield.saveOptions(wikishield.options);
		}

		/**
		 * Remove all theme stylesheets
		 */
		removeTheme() {
			document.querySelectorAll(".wikishield-theme, .wikishield-theme-base").forEach(elem => elem.remove());
			document.documentElement.removeAttribute("data-theme");
			document.body.classList.remove("dark-mode");
		}

		/**
		 * Open a Wikipedia page in a floating iframe
		 * @param {String} url The URL to open
		 * @param {String} title The title to display in the header
		 */
		openFloatingIframe(url, title) {
			// Remove any existing iframe overlay
			this.closeFloatingIframe();

			// Create overlay
			const overlay = document.createElement("div");
			overlay.classList.add("wiki-iframe-overlay");
			overlay.id = "wiki-iframe-overlay";

			// Create container
			const container = document.createElement("div");
			container.classList.add("wiki-iframe-container");

			// Create header
			const header = document.createElement("div");
			header.classList.add("wiki-iframe-header");

			const titleDiv = document.createElement("div");
			titleDiv.classList.add("wiki-iframe-title");
			titleDiv.innerHTML = `
				<span class="fa fa-book"></span>
				<span class="wiki-iframe-title-text">${this.escapeHTML(title)}</span>
			`;

			const controls = document.createElement("div");
			controls.classList.add("wiki-iframe-controls");

			const openNewTabBtn = document.createElement("button");
			openNewTabBtn.classList.add("wiki-iframe-btn");
			openNewTabBtn.innerHTML = `<span class="fa fa-external-link-alt"></span> Open in New Tab`;
			openNewTabBtn.addEventListener("click", () => {
				window.open(url, "_blank");
			});

			const closeBtn = document.createElement("button");
			closeBtn.classList.add("wiki-iframe-btn", "close-btn");
			closeBtn.innerHTML = `<span class="fa fa-times"></span> Close`;
			closeBtn.addEventListener("click", () => {
				this.closeFloatingIframe();
			});

			controls.appendChild(openNewTabBtn);
			controls.appendChild(closeBtn);

			header.appendChild(titleDiv);
			header.appendChild(controls);

			// Create content area with loading indicator
			const content = document.createElement("div");
			content.classList.add("wiki-iframe-content");

			const loading = document.createElement("div");
			loading.classList.add("wiki-iframe-loading");
			loading.innerHTML = `
				<div class="wiki-iframe-spinner"></div>
				<span>Loading Wikipedia page...</span>
			`;

			content.appendChild(loading);

			// Create iframe
			const iframe = document.createElement("iframe");
			iframe.src = url;
			iframe.setAttribute("sandbox", "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox");

			// Track if iframe loaded successfully
			let iframeLoaded = false;

			// Remove loading indicator when iframe loads successfully
			iframe.addEventListener("load", () => {
				iframeLoaded = true;
				loading.remove();
			});

			// Handle iframe load errors
			iframe.addEventListener("error", () => {
				loading.innerHTML = `
					<span class="fa fa-exclamation-triangle" style="color: var(--danger); font-size: 2rem;"></span>
					<span>This page cannot be displayed in a frame. <a href="${url}" target="_blank" style="color: var(--primary); text-decoration: underline;">Open in new tab instead</a></span>
				`;
			});

			// Detect X-Frame-Options blocking (iframe doesn't fire error for this)
			// If iframe hasn't loaded after 3 seconds, assume it's blocked
			setTimeout(() => {
				if (!iframeLoaded) {
					// Wikipedia likely blocked the iframe due to X-Frame-Options
					this.closeFloatingIframe();
					window.open(url, "_blank");

					// Show a toast notification explaining what happened
					this.showToast("Wikipedia doesn't allow embedding. Opening in a new tab instead.", "info");
				}
			}, 3000);

			content.appendChild(iframe);

			// Assemble the modal
			container.appendChild(header);
			container.appendChild(content);
			overlay.appendChild(container);

			// Close on overlay click (but not container click)
			overlay.addEventListener("click", (e) => {
				if (e.target === overlay) {
					this.closeFloatingIframe();
				}
			});

			// Prevent clicks inside container from closing
			container.addEventListener("click", (e) => {
				e.stopPropagation();
			});

			// Close on Escape key
			const escapeHandler = (e) => {
				if (e.key === "Escape") {
					this.closeFloatingIframe();
				}
			};
			document.addEventListener("keydown", escapeHandler);
			overlay.dataset.escapeHandler = "true";

			// Add to document
			document.body.appendChild(overlay);
		}	/**
		* Close the floating iframe if it exists
		*/
		closeFloatingIframe() {
			const overlay = document.getElementById("wiki-iframe-overlay");
			if (overlay) {
				// Remove escape key handler
				if (overlay.dataset.escapeHandler) {
					document.removeEventListener("keydown", this.closeFloatingIframe);
				}
				overlay.remove();
			}
		}

		/**
		 * Escape HTML to prevent XSS
		 * @param {String} text
		 * @returns {String}
		 */
		escapeHTML(text) {
			const div = document.createElement("div");
			div.textContent = text;
			return div.innerHTML;
		}

		/**
		 * Build the starting page
		 */
		async build() {
			document.head.innerHTML = `
				<title>WikiShield</title>
				<style>${wikishieldStyling.initial}</style>
			`;

			document.body.innerHTML = wikishieldHTML.initial;

			// Initialize animated dots background
			const canvas = document.getElementById('dots-canvas');
			const ctx = canvas.getContext('2d');
			let dots = [];
			let animationFrame;

			// Set canvas size
			const resizeCanvas = () => {
				canvas.width = window.innerWidth;
				canvas.height = window.innerHeight;
			};
			resizeCanvas();
			window.addEventListener('resize', resizeCanvas);

			// Create dots
			class Dot {
				constructor() {
					this.x = Math.random() * canvas.width;
					this.y = Math.random() * canvas.height;
					this.vx = (Math.random() - 0.5) * 0.5;
					this.vy = (Math.random() - 0.5) * 0.5;
					this.radius = 2;
					// Random neon color
					const colors = [
						'102, 126, 234',  // Blue
						'240, 147, 251',  // Pink
						'118, 75, 162',   // Purple
						'217, 70, 239'    // Magenta
					];
					this.color = colors[Math.floor(Math.random() * colors.length)];
				}

				update() {
					this.x += this.vx;
					this.y += this.vy;

					// Wrap around edges
					if (this.x < 0) this.x = canvas.width;
					if (this.x > canvas.width) this.x = 0;
					if (this.y < 0) this.y = canvas.height;
					if (this.y > canvas.height) this.y = 0;
				}

				draw() {
					ctx.beginPath();
					ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(${this.color}, 0.8)`;
					ctx.shadowBlur = 10;
					ctx.shadowColor = `rgba(${this.color}, 0.8)`;
					ctx.fill();
					ctx.shadowBlur = 0;
				}
			}

			// Initialize dots (one per 5000 pixels)
			const numDots = Math.floor((canvas.width * canvas.height) / 5000);
			for (let i = 0; i < numDots; i++) {
				dots.push(new Dot());
			}

			// Animation loop
			const animate = () => {
				ctx.clearRect(0, 0, canvas.width, canvas.height);

				// Update and draw dots
				dots.forEach(dot => {
					dot.update();
					dot.draw();
				});

				// Draw lines between close dots
				const length = dots.length;
				for (let i = 0; i < length; i++) {
					for (let j = i + 1; j < length; j++) {
						const dx = dots[i].x - dots[j].x;
						const dy = dots[i].y - dots[j].y;
						const distance = Math.sqrt(dx * dx + dy * dy);

						if (distance < 150) {
							ctx.beginPath();
							ctx.moveTo(dots[i].x, dots[i].y);
							ctx.lineTo(dots[j].x, dots[j].y);
							const opacity = (1 - distance / 150) * 0.4;
							// Blend colors between dots
							const avgR = (parseInt(dots[i].color.split(',')[0]) + parseInt(dots[j].color.split(',')[0])) / 2;
							const avgG = (parseInt(dots[i].color.split(',')[1]) + parseInt(dots[j].color.split(',')[1])) / 2;
							const avgB = (parseInt(dots[i].color.split(',')[2]) + parseInt(dots[j].color.split(',')[2])) / 2;
							ctx.strokeStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${opacity})`;
							ctx.lineWidth = 1;
							ctx.stroke();
						}
					}
				}

				animationFrame = requestAnimationFrame(animate);
			};

			animate();

			// Sound design - create audio context for sound effects
			let audioContext = null;
			wikishield.soundEnabled = true; // Make sound state globally accessible

			// Function to play a synth tone
			const playSynthTone = (frequency, duration, volume = 0.15, type = 'sine') => {
				if (!wikishield.soundEnabled || !audioContext) return;

				const oscillator = audioContext.createOscillator();
				const gainNode = audioContext.createGain();

				oscillator.connect(gainNode);
				gainNode.connect(audioContext.destination);

				oscillator.frequency.value = frequency;
				oscillator.type = type;

				gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
				gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

				oscillator.start(audioContext.currentTime);
				oscillator.stop(audioContext.currentTime + duration);
			};

			// Play startup sound sequence
			const playStartupSound = () => {
				if (!audioContext) {
					try {
						const construct = window.AudioContext || window.webkitAudioContext;
						audioContext = new construct();
					} catch (e) {
						return;
					}
				}

				// Epic startup sequence
				playSynthTone(523.25, 0.15, 0.12, 'sine'); // C5
				setTimeout(() => playSynthTone(659.25, 0.15, 0.12, 'sine'), 150); // E5
				setTimeout(() => playSynthTone(783.99, 0.15, 0.12, 'sine'), 300); // G5
				setTimeout(() => playSynthTone(1046.50, 0.4, 0.15, 'sine'), 450); // C6
			};

			// Play hover sound
			const playHoverSound = () => {
				playSynthTone(800, 0.05, 0.08, 'sine');
			};

			// Play click sound
			const playClickSound = () => {
				playSynthTone(1200, 0.1, 0.1, 'square');
				setTimeout(() => playSynthTone(1000, 0.08, 0.08, 'square'), 50);
			};

			// Initialize audio on first user interaction
			const initAudio = () => {
				if (!audioContext) {
					try {
						const construct = window.AudioContext || window.webkitAudioContext;
						audioContext = new construct();
						playStartupSound();
					} catch (e) {
						// Audio not supported - silently fail
					}
				}
			};

			// Sound toggle button
			const soundToggle = this.elem("#sound-toggle");
			soundToggle.addEventListener("click", () => {
				wikishield.soundEnabled = !wikishield.soundEnabled;
				soundToggle.classList.toggle("muted");

				if (wikishield.soundEnabled) {
					initAudio();
					playClickSound();
				}
			});

			// Add sound effects to buttons and links
			const addSoundToElement = (selector, soundType) => {
				const elem = this.elem(selector);
				if (elem) {
					if (soundType === 'hover') {
						elem.addEventListener("mouseenter", playHoverSound);
					} else if (soundType === 'click') {
						elem.addEventListener("click", () => {
							initAudio();
							playClickSound();
						});
					}
				}
			};

			// Add sounds to interactive elements
			addSoundToElement("#start-button", "hover");
			addSoundToElement("#start-button", "click");

			document.querySelectorAll(".about-link").forEach(link => {
				link.addEventListener("mouseenter", playHoverSound);
				link.addEventListener("click", () => {
					initAudio();
					playClickSound();
				});
			});

			// Play startup sound after a short delay
			setTimeout(() => {
				initAudio();
			}, 500);

			if (wikishield.rights.rollback) {
				this.elem("#rollback-needed").style.display = "none";
			} else {
				this.elem("#start-button").style.display = "none";
			}

			this.elem("#start-button").addEventListener("click", () => {
				// Stop the dots animation
				if (animationFrame) {
					cancelAnimationFrame(animationFrame);
				}
				wikishield.start();
			});

			this.loadTheme("theme-dark");
		}

		/**
		 * Build the main interface, and link buttons to events
		 */
		start() {
			document.head.innerHTML = `
				<title>WikiShield</title>
				<style>${wikishieldStyling.main}</style>
				${wikishieldHTML.head}
			`;

			this.loadTheme("theme-dark");

			document.body.innerHTML = wikishieldHTML.main;

			// Modern bottom menu system
			[...document.querySelectorAll(".bottom-tool-trigger")].forEach(trigger => {
				trigger.addEventListener("click", (e) => {
					e.stopPropagation();
					const item = trigger.closest(".bottom-tool-item");
					const menu = document.querySelector(`#${item.dataset.menu}-menu`);
					const isOpen = menu.classList.contains("show");

					// Close all menus
					this.closeAllBottomMenus();

					// Toggle this menu
					if (!isOpen) {
						menu.classList.add("show");
						trigger.classList.add("active");

						// Position menu based on available space
						this.positionBottomMenu(item, menu);
					}
				});
			});

			// Submenu triggers
			[...document.querySelectorAll(".submenu-trigger")].forEach(trigger => {
				trigger.addEventListener("mouseenter", () => {
					// Close other submenus
					const parentMenu = trigger.closest(".bottom-tool-menu");
					if (parentMenu) {
						parentMenu.querySelectorAll(".submenu").forEach(s => s.classList.remove("show"));
					}

					// Show this submenu
					const submenu = trigger.querySelector(".submenu");
					if (submenu) {
						submenu.classList.add("show");
						this.positionSubmenu(submenu, trigger);
					}
				});
			});

			// Menu options that close on click
			[...document.querySelectorAll(".menu-option:not(.submenu-trigger)")].forEach(option => {
				option.addEventListener("click", () => {
					this.closeAllBottomMenus();
				});
			});

			// Prevent submenu clicks from closing menu
			[...document.querySelectorAll(".submenu")].forEach(submenu => {
				submenu.addEventListener("click", (e) => e.stopPropagation());
			});

			[
				this.elem("#delete-queue"),
				this.elem("#open-settings"),
				this.elem("#notifications-icon"),
				this.elem("#user-contribs-level")
			].forEach(e => this.addTooltipListener(e));

			// Notification icon click handler
			this.elem("#notifications-icon").addEventListener("click", (e) => {
				e.stopPropagation();
				const panel = this.elem("#notifications-panel");
				panel.classList.toggle("show");
			});

			// Mark all as read handler
			this.elem("#mark-all-read").addEventListener("click", () => {
				wikishield.markAllNotificationsRead();
			});

			// Close notifications panel when clicking outside
			document.addEventListener("click", (e) => {
				const panel = this.elem("#notifications-panel");
				const icon = this.elem("#notifications-icon");
				if (panel && !panel.contains(e.target) && !icon.contains(e.target)) {
					panel.classList.remove("show");
				}

				// Close bottom menus when clicking outside
				const bottomTools = document.querySelector("#bottom-tools");
				if (bottomTools && !bottomTools.contains(e.target)) {
					this.closeAllBottomMenus();
				}
			});

			this.eventManager.linkButton(
				this.elem("#delete-queue"),
				"deleteQueue", true
			);

			this.eventManager.linkButton(
				this.elem("#open-settings"),
				"openSettings", true
			);

			this.eventManager.linkButton(
				this.elem("#user-open-user-page"),
				"openUserPage"
			);

			this.eventManager.linkButton(
				this.elem("#user-open-user-talk"),
				"openUserTalk"
			);

			this.eventManager.linkButton(
				this.elem("#user-view-contribs"),
				"openUserContribs"
			);

			this.eventManager.linkButton(
				this.elem("#user-view-filter-log"),
				"openFilterLog"
			);

			this.eventManager.linkButton(
				this.elem("#user-add-whitelist"),
				"addToWhitelist"
			);

			this.eventManager.linkButton(
				this.elem("#user-highlight"),
				"highlight"
			);

			this.eventManager.linkButton(
				this.elem("#page-open-page"),
				"openPage"
			);

			this.eventManager.linkButton(
				this.elem("#page-open-talk"),
				"openTalk"
			);

			this.eventManager.linkButton(
				this.elem("#page-view-history"),
				"openHistory"
			);

			this.eventManager.linkButton(
				this.elem("#edit-view-revision"),
				"openRevision"
			);

			this.eventManager.linkButton(
				this.elem("#edit-view-diff"),
				"openDiff"
			);

			this.eventManager.linkButton(
				this.elem("#edit-thank-user"),
				"thankUser"
			);

			this.eventManager.linkButton(
				this.elem("#edit-rollback"),
				"rollback"
			);

			this.createSubmenu(
				this.elem("#edit-rollback-goodfaith .submenu"),
				"rollbackGoodFaith"
			);

			this.createSubmenu(
				this.elem("#edit-undo .submenu"),
				"undo"
			);

			this.createSubmenu(
				this.elem("#user-report-aiv .submenu"),
				"reportToAIV"
			);

			this.createSubmenu(
				this.elem("#user-report-uaa .submenu"),
				"reportToUAA"
			);

			this.createSubmenu(
				this.elem("#page-request-protection .submenu"),
				"requestProtection"
			);

			this.createSubmenu(
				this.elem("#user-welcome .submenu"),
				"welcome"
			);

			if (!wikishield.rights.block) {
				[...document.querySelectorAll(".tool-block")].forEach(elem => elem.style.display = "none");
			}

			if (!wikishield.rights.protect) {
				[...document.querySelectorAll(".tool-protect")].forEach(elem => elem.style.display = "none");
			}

			[...this.elem("#bottom-tools").querySelectorAll("[data-tooltip]")]
				.forEach(elem => this.addTooltipListener(elem));

			this.createWarnMenu(this.elem("#warn-menu"));

			const queueWidthAdjust = this.elem("#queue-width-adjust");
			const queue = this.elem("#queue");

			const detailsWidthAdjust = this.elem("#details-width-adjust");
			const details = this.elem("#right-details");

			// Load saved widths from localStorage
			const savedQueueWidth = localStorage.getItem("WS:queueWidth");
			const savedDetailsWidth = localStorage.getItem("WS:detailsWidth");

			if (savedQueueWidth) {
				queue.style.width = savedQueueWidth;
				this.elem("#right-container").style.width = `calc(100% - ${savedQueueWidth})`;
			}

			if (savedDetailsWidth) {
				details.style.width = savedDetailsWidth;
				this.elem("#main-container").style.width = `calc(100% - ${savedDetailsWidth})`;
				this.elem("#middle-top").style.width = `calc(100% - ${savedDetailsWidth})`;
				this.elem("#right-top").style.width = savedDetailsWidth;
			}

			queueWidthAdjust.addEventListener("mousedown", (event) => {
				this.selectedWidthAdjust = queueWidthAdjust;
				this.startingMouseX = event.clientX;
				this.startingSectionWidth = queue.getBoundingClientRect().width;
			});

			detailsWidthAdjust.addEventListener("mousedown", (event) => {
				this.selectedWidthAdjust = detailsWidthAdjust;
				this.startingMouseX = event.clientX;
				this.startingSectionWidth = details.getBoundingClientRect().width;
			});

			window.addEventListener("mouseup", () => {
				// Save widths to localStorage when done resizing
				if (this.selectedWidthAdjust === queueWidthAdjust) {
					localStorage.setItem("WS:queueWidth", queue.style.width);
				}
				if (this.selectedWidthAdjust === detailsWidthAdjust) {
					localStorage.setItem("WS:detailsWidth", details.style.width);
				}
				this.selectedWidthAdjust = null;
			});

			window.addEventListener("mousemove", (event) => {
				if (this.selectedWidthAdjust === queueWidthAdjust) {
					const newWidth = event.clientX - this.startingMouseX + this.startingSectionWidth;
					queue.style.width = `${Math.min(Math.max(newWidth / window.innerWidth * 100, 10), 30)}vw`;
					this.elem("#right-container").style.width = `calc(100% - ${queue.style.width})`;
				}

				if (this.selectedWidthAdjust === detailsWidthAdjust) {
					const newWidth = this.startingMouseX - event.clientX + this.startingSectionWidth;
					details.style.width = `${Math.min(Math.max(newWidth / window.innerWidth * 100, 10), 30)}vw`;
					this.elem("#main-container").style.width = `calc(100% - ${details.style.width})`;
					this.elem("#middle-top").style.width = `calc(100% - ${details.style.width})`;
					this.elem("#right-top").style.width = details.style.width;
				}
			});

			window.addEventListener("click", () => {
				[...document.querySelectorAll(".context-menu")].forEach(elem => elem.remove());
			});

			// Intercept Wikipedia links for floating iframe
			document.addEventListener("click", (e) => {
				// Check if the click was on a link or inside a link
				const link = e.target.closest("a[href][target='_blank']");

				if (!link) return;

				const url = link.getAttribute("href");

				// Only intercept Wikipedia links
				if (!url || !url.includes("wikipedia.org")) return;

				// Middle click (button 1) should open in new tab normally
				if (e.button === 1) return;

				// Ctrl/Cmd + click should open in new tab normally
				if (e.ctrlKey || e.metaKey) return;

				// Prevent default behavior and open in floating iframe
				e.preventDefault();
				e.stopPropagation();

				// Extract page title from URL for display
				let pageTitle = "Wikipedia";
				try {
					const urlObj = new URL(url);
					const pathParts = urlObj.pathname.split("/");
					if (pathParts.length > 2) {
						pageTitle = decodeURIComponent(pathParts[pathParts.length - 1]).replace(/_/g, " ");
					}
				} catch (err) {
					console.error("Failed to parse URL:", err);
				}

				// Open Wikipedia links in new tab
				window.open(url, "_blank");
			}, true); // Use capture phase to intercept before other handlers

			// Also handle auxclick for middle mouse button
			document.addEventListener("auxclick", (e) => {
				const link = e.target.closest("a[href][target='_blank']");
				if (!link) return;

				const url = link.getAttribute("href");
				if (!url || !url.includes("wikipedia.org")) return;

				// Middle click (button 1) - allow default behavior (open in new tab)
				if (e.button === 1) {
					// Default behavior will handle this
					return;
				}
			}, true);

			if (wikishield.getChangelogVersion() !== __script__.changelog.version) {
				const container = document.createElement("div");
				container.classList.add("settings-container");
				document.body.appendChild(container);

				container.innerHTML = `
					<div class="settings">
						<div class="settings-section changelog">
							${__script__.changelog.HTML}
							<button id="close-changelog" class="add-action-button">Close</button>
						</div>
					</div>
				`;

				document.getElementById("close-changelog").addEventListener("click", () => {
					container.remove();
					wikishield.updateChangelogVersion();
				});
			}
		}

		/**
		 * Update which menu elements are selected and open
		 */
		updateMenuElements() {
			// Legacy function kept for compatibility
			// Modern menu system uses closeAllBottomMenus()
		}

		/**
		 * Close all bottom menu popups
		 */
		closeAllMenus() {
			this.closeAllBottomMenus();
		}

		/**
		 * Close all bottom menus (modern system)
		 */
		closeAllBottomMenus() {
			document.querySelectorAll(".bottom-tool-menu").forEach(menu => menu.classList.remove("show"));
			document.querySelectorAll(".bottom-tool-trigger").forEach(trigger => trigger.classList.remove("active"));
			document.querySelectorAll(".submenu").forEach(submenu => submenu.classList.remove("show"));
		}

		/**
		 * Position bottom menu based on available space
		 * @param {HTMLElement} menu The menu to position
		 */
		positionBottomMenu(button, menu) {
			// Reset positioning
			menu.style.bottom = '';
			menu.style.top = '';

			// Wait for next frame to get accurate measurements
			requestAnimationFrame(() => {
				const rect = menu.getBoundingClientRect();
				const buttonRect = button.getBoundingClientRect();

				menu.style.left = `${buttonRect.left}px`;
				menu.style.bottom = `${window.innerHeight - buttonRect.top}px`;
			});
		}

		/**
		 * Position submenu based on available space
		 * @param {HTMLElement} submenu The submenu to position
		 * @param {HTMLElement} trigger The trigger element
		 */
		positionSubmenu(submenu, trigger) {
			// Reset positioning
			submenu.style.left = '';
			submenu.style.right = '';
			submenu.style.top = '';
			submenu.style.bottom = '';

			requestAnimationFrame(() => {
				const submenuRect = submenu.getBoundingClientRect();
				const triggerRect = trigger.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.innerHeight;

				// Check horizontal space
				const spaceRight = viewportWidth - triggerRect.right;
				const spaceLeft = triggerRect.left;

				// Position to left if not enough space on right
				if (spaceRight < submenuRect.width + 20 && spaceLeft > spaceRight) {
					submenu.style.left = 'auto';
					submenu.style.right = 'calc(100% + 4px)';
				}

				// Check vertical space
				const spaceBelow = viewportHeight - triggerRect.bottom;
				const spaceAbove = triggerRect.top;

				// Adjust vertical position if menu goes off screen
				if (submenuRect.bottom > viewportHeight && spaceAbove > spaceBelow) {
					submenu.style.top = 'auto';
					submenu.style.bottom = '0';
				}
			});
		}

		/**
		 * Create the menu for warning types
		 * @param {HTMLElement} container
		 */
		createRevertMenu(container, isBLP = false) {
			const table = document.createElement("table");
			table.classList.add("revert-menu-table");
			container.appendChild(table);

			// Organize warnings by category
			const categories = {
				"Vandalism": ["Vandalism", "Subtle vandalism", "Editing tests", "Deleting", "Image vandalism", "Errors"],
				"Content Issues": [isBLP ? "Unsourced (BLP)" : "Unsourced", "POV", "Commentary", "MOS violation", "AI-generated content", "Censoring"],
				"Spam & Promotion": ["Advertising", "Spam links"],
				"Disruptive Behavior": ["Disruption", "Owning", "Chatting", "AfD removal", "Jokes"],
				"Personal Conduct": ["Personal attacks"]
			};

			for (const categoryName in categories) {
				// Add category header
				const categoryRow = document.createElement("tr");
				const categoryCell = document.createElement("td");
				categoryCell.colSpan = 8; // Span all columns
				categoryCell.classList.add("revert-menu-category");
				categoryCell.innerText = categoryName;
				categoryRow.appendChild(categoryCell);
				table.appendChild(categoryRow);

				// Add warnings in this category
				for (const warningType of categories[categoryName]) {
					if (!wikishieldData.warnings[warningType]) continue; // Skip if warning doesn't exist

					const row = document.createElement("tr");
					table.appendChild(row);
					const levels = ["Auto", "1", "2", "3", "4", "4im"];
					row.innerHTML += `
						<td class="revert-menu-title">${warningType}</td>
						<td class="revert-menu-info" data-tooltip="${wikishieldData.warnings[warningType].desc}">
							<span class="fas fa-circle-question"></span>
						</td>
					`;

					const templates = ["Auto", ...wikishieldData.warnings[warningType].templates];
					for (const template in templates) {
						const level = levels[template];

						const elem = document.createElement("td");
						row.appendChild(elem);
						elem.innerText = level;
						if (level === "Auto") {
							elem.style.backgroundColor = "#00a000";
						} else {
							elem.style.backgroundColor = wikishieldData.warningTemplateColors[level];
						}

						elem.classList.add("revert-menu-item");

						elem.addEventListener("click", async () => {
							await wikishield.executeScript({
								actions: [
									{
										name: "rollbackAndWarn",
										params: {
											"label": wikishieldData.warnings[warningType].label,

											warningType,
											level: level === "Auto" ? "auto" : (level === "4im" ? "4im" : Number(template) + 1)
										}
									},
									{
										name: "highlight",
										params: {}
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
										name: "nextEdit",
										params: {}
									}
								]
							});

							this.selectedMenu = null;
							this.updateMenuElements();
						});
					}
				}
			}

			[...container.querySelectorAll("[data-tooltip]")].forEach(e => {
				this.addTooltipListener(e);
			});
		}

		/**
		 * Create the warn menu (without rollback)
		 * @param {HTMLElement} container Container element for the menu
		 */
		createWarnMenu(container) {
			// Organize warnings by category with their data
			const categories = {
				"Disruptive Behavior": {
					"Gaming the system": {
						templates: [
							"subst:uw-gaming1",
							"subst:uw-gaming2",
							"subst:uw-gaming3",
							"subst:uw-gaming4",
							"subst:uw-gaming4im"
						],
						label: "[[WP:GAME|gaming the system]]",
						desc: "Warning for gaming the system or manipulating Wikipedia processes.",
						requiresArticle: true
					},
					"Misleading edit summaries": {
						templates: [
							"subst:uw-mislead1",
							"subst:uw-mislead2",
							"subst:uw-mislead3",
							"subst:uw-mislead4"
						],
						label: "using [[WP:EDITSUMMARY|misleading edit summaries]]",
						desc: "Warning for using misleading or false edit summaries.",
						requiresArticle: true
					}
				},
				"Editing Practice": {
					"Incorrect minor edits": {
						templates: [
							"subst:uw-minor"
						],
						label: "incorrect use of [[Help:Minor edit|minor edits]]",
						desc: "Warning for incorrectly marking edits as minor.",
						requiresArticle: false
					}
				}
			};

			const table = document.createElement("table");
			table.classList.add("revert-menu-table");
			container.appendChild(table);

			for (const categoryName in categories) {
				// Add category header
				const categoryRow = document.createElement("tr");
				const categoryCell = document.createElement("td");
				categoryCell.colSpan = 8; // Span all columns
				categoryCell.classList.add("revert-menu-category");
				categoryCell.innerText = categoryName;
				categoryRow.appendChild(categoryCell);
				table.appendChild(categoryRow);

				// Add warnings in this category
				const warnTypes = categories[categoryName];
				for (const warningType in warnTypes) {

					const row = document.createElement("tr");
					table.appendChild(row);
					const warningData = warnTypes[warningType];
					const templatesLength = warningData.templates.length;
					const levels = templatesLength === 1 ? ["0"] : ["1", "2", "3", "4", "4im"];

					row.innerHTML += `
						<td class="revert-menu-title">${warningType}</td>
						<td class="revert-menu-info" data-tooltip="${warningData.desc}">
							<span class="fas fa-circle-question"></span>
						</td>
					`;

					for (let i = 0; i < templatesLength; i++) {
						const template = warningData.templates[i];
						const level = levels[i];

						const elem = document.createElement("td");
						row.appendChild(elem);
						elem.innerText = level;

						// Color coding for levels
						if (templatesLength === 1) {
							elem.style.backgroundColor = "#4a90e2";
						} else if (level === "4im") {
							elem.style.backgroundColor = wikishieldData.warningTemplateColors["4im"];
						} else {
							elem.style.backgroundColor = wikishieldData.warningTemplateColors[level];
						}

						elem.classList.add("revert-menu-item");

						elem.addEventListener("click", async () => {
							await wikishield.executeScript({
								actions: [
									{
										name: "warn",
										params: {
											warningType: warningType,
											level: i + 1,
											warningTemplates: warningData.templates,
											warningLabel: warningData.label,
											requiresArticle: warningData.requiresArticle
										}
									},
									{
										name: "highlight",
										params: {}
									},
									{
										name: "nextEdit",
										params: {}
									}
								]
							});

							this.selectedMenu = null;
							this.updateMenuElements();
						});
					}
				}
			}

			[...container.querySelectorAll("[data-tooltip]")].forEach(e => {
				this.addTooltipListener(e);
			});
		}

		/**
		 * Create a form for a submenu based on an event
		 * @param {HTMLElement} container Container element for the submenu
		 * @param {String} eventName EventManager event name
		 */
		createSubmenu(container, eventName) {
			if (!container) return; // Safety check

			const event = this.eventManager.events[eventName];
			container.innerHTML = `
				<div class="bottom-subcontent-title">${event.description}</div>
			`;

			for (const param of (event.parameters || [])) {
				container.innerHTML += `<div class="bottom-subcontent-input-title">${param.title}</div>`;

				switch (param.type) {
					case "choice":
						const optionHTML = param.options.reduce((prev, cur) => prev + `<option>${cur}</option>`, "");
						container.innerHTML += `
							<select data-paramid="${param.id}">
								${optionHTML}
							</select>
						`;
						break;
					case "text":
						container.innerHTML += `<input type="text" data-paramid="${param.id}">`;
						break;
					default:
						break;
				}
			}

			const button = document.createElement("button");
			button.innerText = "Submit";
			button.classList.add("bottom-subcontent-button");
			container.appendChild(button);
			button.addEventListener("click", () => {
				const params = {};
				for (const param of (event.parameters || [])) {
					const input = container.querySelector(`[data-paramid="${param.id}"]`);
					params[param.id] = input.value;
				}
				wikishield.executeScript({
					actions: [
						{
							name: eventName,
							params
						}
					]
				});
				this.closeAllBottomMenus();
			});
		}

		/**
		 * Add edits to the queue if they aren't already there
		 * @param {Object} queue
		 * @param {Object} currentEdit
		 */
		renderQueue(queue, currentEdit) {
			let lastEditElem = null;

			this.elem("#queue-top-items").innerText = queue.length + " item" + (queue.length === 1 ? "" : "s");

			for (const edit of queue) {
				// Scope the selector to only search within #queue-items
				let elem = this.elem(`#queue-items .queue-edit[data-revid="${edit.revid}"]`);
				if (!elem) {
					elem = document.createElement("div");
					elem.classList.add("queue-edit");
					// Add special class if diff mentions current user
					if (edit.mentionsMe && wikishield.options.enableUsernameHighlighting) {
						elem.classList.add("queue-edit-mentions-me");
                        elem.dataset.tooltip = "This edit contains your username";
                        this.addTooltipListener(elem);
					}
					elem.dataset.revid = edit.revid.toString();
					elem.innerHTML = this.generateEditHTML(edit);

					if (lastEditElem) {
						lastEditElem.parentElement.insertBefore(elem, lastEditElem.nextSibling);
					} else {
						if (edit === currentEdit) {
							this.elem("#queue-items").prepend(elem);
						} else {
							this.elem("#queue-items").appendChild(elem);
						}
					}

					[...elem.querySelectorAll("[data-tooltip]")].forEach(e => {
						this.addTooltipListener(e);
					});

					elem.addEventListener("contextmenu", (event) => {
						event.preventDefault();
						wikishield.queue.playClickSound();

						[...document.querySelectorAll(".context-menu")].forEach(e => e.remove());
						const contextMenu = document.createElement("div");
						contextMenu.classList.add("context-menu");
						contextMenu.innerHTML = wikishieldHTML["edit-context-menu"];
						document.body.appendChild(contextMenu);

						contextMenu.style.left = event.clientX + "px";
						contextMenu.style.top = event.clientY + "px";

						contextMenu.querySelector("#context-ores-number").innerText = Math.round(edit.ores * 100) || 0;
						contextMenu.querySelector("#context-ores-number").style.color = this.getORESColor(edit.ores || 0);

						// Update whitelist button text based on current status
						const contextWhitelistBtn = contextMenu.querySelector("#context-whitelist");
						if (contextWhitelistBtn) {
							if (wikishield.whitelist.has(edit.user.name)) {
								contextWhitelistBtn.textContent = "Remove from whitelist";
							} else {
								contextWhitelistBtn.textContent = "Whitelist user";
							}
						}

						contextMenu.querySelector("#context-remove").addEventListener("click", () => {
							wikishield.queue.playClickSound();
							// Cancel AI analysis for the edit being removed
							if (wikishield.ollamaAI) {
								wikishield.ollamaAI.cancelAnalysis(edit.revid);
							}

							if (edit === currentEdit) {
								// Find current edit index
								const currentIndex = queue.findIndex(e => e.revid === edit.revid);
								if (currentIndex !== -1) {
									// Remove the current item from the queue
									queue.splice(currentIndex, 1);

									// Update currentEdit to the next item, or previous if no next
									if (queue.length > 0) {
										if (currentIndex < queue.length) {
											// Move to the item that's now at the current position
											wikishield.queue.currentEdit = queue[currentIndex];
										} else {
											// We removed the last item, go to the new last item
											wikishield.queue.currentEdit = queue[queue.length - 1];
										}
									} else {
										// Queue is empty
										wikishield.queue.currentEdit = null;
									}

									this.removeQueueItem(edit.revid);
									wikishield.interface.renderQueue(queue, wikishield.queue.currentEdit);
								}
							} else {
								const length = queue.length;
								for (let i = 0; i < length; i++) {
									if (queue[i] === edit) {
										queue.splice(i, 1);
										break;
									}
								}
								this.removeQueueItem(edit.revid);
							}
							wikishield.queue.previousItems.push(edit);
							contextMenu.remove();
						});

						contextMenu.querySelector("#context-whitelist").addEventListener("click", () => {
							wikishield.queue.playSparkleSound();

							// Toggle whitelist status
							if (wikishield.whitelist.has(edit.user.name)) {
								wikishield.whitelist.delete(edit.user.name);
								wikishield.saveWhitelist();
								wikishield.logger.log(`Removed ${edit.user.name} from whitelist`);
							} else {
								wikishield.whitelist.set(edit.user.name, Date.now());
								wikishield.saveWhitelist();
								wikishield.logger.log(`Added ${edit.user.name} to whitelist`);
							}

							// Refresh the interface to update button text
							wikishield.interface.renderQueue(wikishield.queue.queue, wikishield.queue.currentEdit);
							contextMenu.remove();
						});

						contextMenu.querySelector("#context-open-history").addEventListener("click", (e) => {
							wikishield.queue.playClickSound();
							const url = wikishield.util.pageLink(`Special:PageHistory/${edit.page.title}`);
							wikishield.interface.eventManager.openWikipediaLink(url, `History: ${edit.page.title}`, e);
							contextMenu.remove();
						});

						contextMenu.querySelector("#context-open-contribs").addEventListener("click", (e) => {
							wikishield.queue.playClickSound();
							const url = wikishield.util.pageLink(`Special:Contributions/${edit.user.name}`);
							wikishield.interface.eventManager.openWikipediaLink(url, `Contributions: ${edit.user.name}`, e);
							contextMenu.remove();
						});

						contextMenu.addEventListener("click", (mevent) => {
							mevent.stopPropagation();
						});
					});

					elem.addEventListener("click", () => {
						wikishield.queue.currentEdit = edit;
						this.renderQueue(wikishield.queue.queue, edit);

						// Trigger AI analysis when clicking to view a different edit
						if (edit && wikishield.options.enableOllamaAI && wikishield.ollamaAI) {
							wikishield.ollamaAI.analyzeEdit(edit).then(analysis => {
								edit.aiAnalysis = analysis;
								if (wikishield.queue.currentEdit === edit && wikishield.interface) {
									wikishield.interface.updateAIAnalysisDisplay(analysis);
								}
							}).catch(err => {
								console.error("AI analysis failed:", err);
							});
						}
					});
				}

				if (edit === currentEdit) {
					elem.classList.add("queue-edit-current");
				} else {
					elem.classList.remove("queue-edit-current");
				}

				lastEditElem = elem;
			}

			if (this.lastCurrentEdit !== currentEdit) {
				this.lastCurrentEdit = currentEdit;
				this.newEditSelected(currentEdit);
			}
		}

		/**
		 * Generate the HTML for a single edit in the queue, user edits, or page history sections
		 * @param {Object} edit
		 * @param {Boolean} includeORES include the ORES score of the edit
		 * @param {Boolean} includeTitle include the page title
		 * @param {Boolean} includeUser include the name of the user who made the edit
		 * @param {Boolean} includeTime include the edit's timestamp
		 */
		generateEditHTML(edit, includeORES = true, includeTitle = true, includeUser = true, includeTime = false) {
			let tagHTML = "";
			// Ensure edit.tags is an array before iterating
			if (edit.tags && Array.isArray(edit.tags)) {
				for (const tag of edit.tags) {
					tagHTML += `<span class="queue-edit-tag">${tag}</span>`;
				}
			}

			const diff = edit.sizediff || 0;
			const summaryTruncated = edit.comment ? wikishield.util.escapeHtml(wikishield.util.maxStringLength(edit.comment, 100)) : "";
			const summaryFull = edit.comment ? wikishield.util.escapeHtml(edit.comment) : "";

			// Add minor edit indicator before summary
			const minorIndicator = edit.minor ? `<span class="minor-indicator" data-tooltip="Minor edit">m</span> ` : "";

			// Format ORES score for display
			const oresScore = edit.ores || 0;
			const oresPercent = Math.round(oresScore * 100);
			const oresLabel = oresPercent < 30 ? "Good" : oresPercent < 70 ? "Review" : "Likely Bad";

			const oresHTML = includeORES ? `<div class="queue-edit-color" data-ores-score="${oresPercent}%" style="background: ${this.getORESColor(oresScore)};"></div>` : "";
			const titleHTML = includeTitle ? `
				<div class="queue-edit-title" data-tooltip="${edit.page ? edit.page.title : edit.title}">
					<span class="fa fa-file-lines queue-edit-icon"></span>
					${edit.page ? edit.page.title : edit.title}
				</div>` : "";

			// Determine user highlight classes
			let userClasses = "";
			if (edit.user && wikishield.highlighted.has(edit.user.name)) {
				userClasses = "queue-edit-user-highlight";
			} else if (edit.user && typeof edit.user === "object" && edit.user.emptyTalkPage) {
				userClasses = "queue-edit-user-empty-talk";
			}

			const userHTML = includeUser ? `
				<div class="queue-edit-user ${userClasses}">
					<span class="fa fa-user queue-edit-icon"></span>
					${!edit.user ? "<em>Username removed</em>" : typeof edit.user === "string" ? edit.user : edit.user.name}
				</div>` : "";
			const timeHTML = includeTime ? `
				<div class="queue-edit-time" data-tooltip="${edit.timestamp}">
					<span class="fa fa-clock queue-edit-icon"></span>
					${wikishield.util.timeAgo(edit.timestamp)}
				</div>` : "";

			return `
				${oresHTML}
				<div class="queue-edit-content">
					${titleHTML}
					${userHTML}
					<div class="queue-edit-summary" data-tooltip="${summaryFull}">
						<span class="fa fa-comment-dots queue-edit-icon"></span>
						${minorIndicator}${summaryTruncated || "<em>No summary provided</em>"}
					</div>
					${timeHTML}
					<div class="queue-edit-tags">
						${tagHTML}
					</div>
				</div>
				<div class="queue-edit-change" style="${Math.abs(diff) >= 500 ? "font-weight: bold;" : ""}color: ${wikishield.util.getChangeColor(diff)}">
					${wikishield.util.getChangeString(diff)}
				</div>
			`;
		}

		/**
		 * Update the main container when a new edit is selected
		 * @param {Object} edit
		 */
		async newEditSelected(edit) {
			// Close all bottom menu popups when switching pages
			this.closeAllMenus();

			const userContribsLevel = this.elem("#user-contribs-level");
			const contribsContainer = this.elem("#user-contribs-content"),
				historyContainer = this.elem("#page-history-content");

			contribsContainer.innerHTML = "";
			historyContainer.innerHTML = "";

			// Remove any existing tooltips when switching diffs
			this.removeTooltips();

			if (edit === null) {
				this.elem("#middle-top").innerHTML = "";
				this.elem("#right-top").innerHTML = "";
				this.elem("#page-metadata").innerHTML = "";
				this.elem("#user-contribs-count").innerText = "_ edits";
				userContribsLevel.style.display = "none";
				this.elem("#diff-container").innerHTML = "";
				this.elem("#protection-indicator").innerHTML = "";

				// Remove AI analysis container when no edit
				const aiContainer = document.querySelector("#ai-analysis-container");
				if (aiContainer) {
					aiContainer.remove();
				}

				// Remove old edit notice when no edit
				const noticeContainer = document.querySelector("#old-edit-notice");
				if (noticeContainer) {
					noticeContainer.remove();
				}

				// Update diff height
				this.updateDiffContainerHeight();

				// Hide block count indicator
				const blockIndicator = document.querySelector("#user-contribs #block-count-indicator");
				if (blockIndicator) {
					blockIndicator.style.display = "none";
					blockIndicator.innerHTML = "";
				}
				// Clear protection indicator
				const protIndicator = document.querySelector("#page-history #protection-indicator");
				if (protIndicator) {
					protIndicator.innerHTML = "";
				}
				return;
			}

			// Stop checking for newer revisions on the previous edit
			this.stopNewerRevisionCheck();

			// Start checking for newer revisions on THIS Wikipedia page
			this.startNewerRevisionCheck(edit);

			userContribsLevel.style.display = "initial";
			userContribsLevel.style.background = wikishieldData.warningTemplateColors[edit.user.warningLevel] || "grey";
			userContribsLevel.innerText = edit.user.warningLevel;

			const addToolipToWarningLevel = () => {
				// Clone and replace the element to remove old event listeners (prevents memory leak/crash)
				const newUserContribsLevel = userContribsLevel.cloneNode(true);
				userContribsLevel.parentNode.replaceChild(newUserContribsLevel, userContribsLevel);

				// Add tooltip listener to the fresh warning level indicator
				this.addTooltipListener(newUserContribsLevel);
			};

			// Fetch warning history for tooltip
			if (edit.user.warningLevel !== "0") {
				wikishield.api.getSinglePageContent(`User talk:${edit.user.name}`).then(talkContent => {
					const warningHistory = wikishield.queue.getWarningHistory(talkContent);
					if (warningHistory.length > 0) {
						let tooltipHtml = '<div class="tooltip-title">Warning History</div>';
						warningHistory.slice(0, 5).forEach(warning => {
							const templateDisplay = `${warning.template}${warning.level}`;
							const articleInfo = warning.article ? `<span class="tooltip-item-article"> (${wikishield.util.escapeHtml(warning.article)})</span>` : "";
							const userInfo = warning.username ? `User:${wikishield.util.escapeHtml(warning.username)}` : (warning.timestamp || warning.section);
							tooltipHtml += `<div class="tooltip-item">`;
							tooltipHtml += `<span class="tooltip-item-level">${wikishield.util.escapeHtml(templateDisplay)}</span>`;
							tooltipHtml += articleInfo;
							tooltipHtml += `<br><span class="tooltip-item-time">${wikishield.util.escapeHtml(userInfo)}</span>`;
							tooltipHtml += `</div>`;
						});
						if (warningHistory.length > 5) {
							tooltipHtml += `<div class="tooltip-more">... and ${warningHistory.length - 5} more</div>`;
						}
						userContribsLevel.setAttribute("data-tooltip", tooltipHtml);
						userContribsLevel.setAttribute("data-tooltip-html", "true");
					} else {
						userContribsLevel.setAttribute("data-tooltip", `Warning level: ${edit.user.warningLevel}`);
						userContribsLevel.setAttribute("data-tooltip-html", "false");
					}
				}).catch(() => {
					userContribsLevel.setAttribute("data-tooltip", `Warning level: ${edit.user.warningLevel}`);
					userContribsLevel.setAttribute("data-tooltip-html", "false");
				}).finally(addToolipToWarningLevel);
			} else {
				userContribsLevel.setAttribute("data-tooltip", "No warnings");
				userContribsLevel.setAttribute("data-tooltip-html", "false");

				addToolipToWarningLevel();
			}

			this.elem("#user-contribs-count").innerText = edit.user.editCount === -1 ? "N/A edits"
				: edit.user.editCount + " edit" + (edit.user.editCount === 1 ? "" : "s");

			const summaryTruncated = edit.comment ? wikishield.util.escapeHtml(wikishield.util.maxStringLength(edit.comment, 150)) : "";
			const summaryFull = edit.comment ? wikishield.util.escapeHtml(edit.comment) : "";
			const minorIndicator = edit.minor ? `<span class="minor-indicator" data-tooltip="Minor edit">m</span> ` : "";
			const title = wikishield.util.escapeHtml(wikishield.util.maxStringLength(edit.page.title, 50));
			const titleFull = wikishield.util.escapeHtml(edit.page.title);
			const username = wikishield.util.escapeHtml(wikishield.util.maxStringLength(edit.user.name, 30));
			const usernameFull = wikishield.util.escapeHtml(edit.user.name);

			// Fetch page protection info and user block count
			const protectionPromise = wikishield.api.getPageProtection(edit.page.title);
			const blockCountPromise = wikishield.api.getBlockCount(edit.user.name);

			this.elem("#middle-top").innerHTML = `
				<div style="display: flex; overflow: auto hidden; white-space: nowrap">
					<div>
						<span class="fa fa-file-lines"></span>
						<a href="${wikishield.util.pageLink(edit.page.title)}" target="_blank" data-tooltip="${titleFull}">${title}</a>
					</div>
					<div>
						<span class="fa fa-user"></span>
						<a href="${wikishield.util.pageLink("Special:Contributions/" + edit.user.name)}" target="_blank" data-tooltip="${usernameFull}">${username}</a>
					</div>
					<div>
						<span class="fa fa-pencil"></span>
						<span style="color: ${wikishield.util.getChangeColor(edit.sizediff || 0)}">${wikishield.util.getChangeString(edit.sizediff || 0)}</span>
					</div>
				</div>
				<div class="middle-top-comment" data-tooltip="${summaryFull}">
					<span class="fa fa-comment-dots"></span>
					${minorIndicator}${summaryTruncated || "<em>No summary provided</em>"}
				</div>
			`;

			const $rightTop = this.elem("#right-top");
			$rightTop.innerHTML = `
				<div class="right-top-comment">
					Consecutive edits
				</div>
				<div>
					<span class="fa fa-clock"></span>
					<span id="consecutive-time">-</span>
				</div>
				<div>
					<span class="fa fa-edit"></span>
					<span id="consecutive-edits">-</span>
				</div>
				<div>
					<span class="fa fa-pencil"></span>
					<span id="consecutive-sizediff" style="color: ${wikishield.util.getChangeColor(0)}">-</span>
				</div>
			`;

			edit.consecutive.then((object) => {
				if (object === null) { // failed
					$rightTop.querySelector("#consecutive-time").innerHTML = "?";
					$rightTop.querySelector("#consecutive-edits").innerHTML = "?";
					$rightTop.querySelector("#consecutive-sizediff").innerHTML = "?";

					return;
				}

				let { timestamp, count, sizediff } = object;

				const $consecutiveTime = $rightTop.querySelector("#consecutive-time");
				$consecutiveTime.innerHTML = wikishield.formatNotificationTimeShort(new Date(timestamp));
				$consecutiveTime.parentElement.dataset.tooltip = timestamp;
				this.addTooltipListener($consecutiveTime.parentElement);

				if (count === __script__.config.historyCount) {
					count += "+";
				}
				$rightTop.querySelector("#consecutive-edits").innerHTML = count;

				const $sizediff = $rightTop.querySelector("#consecutive-sizediff");
				$sizediff.style.color = wikishield.util.getChangeColor(sizediff);
				$sizediff.innerHTML = wikishield.util.getChangeString(edit.sizediff || 0);
			});

			// Highlight username in top bar based on status (same as queue highlighting)
			// Use requestAnimationFrame to ensure DOM has been updated
			requestAnimationFrame(() => {
				const middleTop = this.elem("#middle-top");
				const userDiv = middleTop.children[1]; // Second div contains the username
				const userLink = userDiv ? userDiv.querySelector("a") : null; // Get the <a> tag inside
				const userIcon = userDiv ? userDiv.querySelector(".fa-user") : null; // Get the icon

				if (userLink) {
					// Clear previous styles
					userLink.style.color = "";
					userLink.style.fontWeight = "";
					if (userIcon) {
						userIcon.style.color = "";
					}

					// Check if user is highlighted (yellow) or has empty talk page (red)
					if (wikishield.highlighted.has(edit.user.name)) {
						userLink.style.setProperty("color", "#f4c430", "important");
						userLink.style.setProperty("font-weight", "600", "important");
						if (userIcon) {
							userIcon.style.setProperty("color", "#f4c430", "important");
						}
					} else if (edit.user.emptyTalkPage) {
						userLink.style.setProperty("color", "#ff6b6b", "important");
						userLink.style.setProperty("font-weight", "600", "important");
						if (userIcon) {
							userIcon.style.setProperty("color", "#ff6b6b", "important");
						}
					}
				}
			});

			// Update whitelist and highlight button text based on current status
			const whitelistButton = this.elem("#user-add-whitelist");
			const highlightButton = this.elem("#user-highlight");

			if (whitelistButton) {
				const isWhitelisted = wikishield.whitelist.has(edit.user.name);
				const whitelistIcon = whitelistButton.querySelector("i");
				const whitelistSpan = whitelistButton.querySelector("span");

				if (isWhitelisted) {
					whitelistSpan.textContent = "Remove from whitelist";
					if (whitelistIcon) {
						whitelistIcon.className = "fas fa-user-xmark";
					}
				} else {
					whitelistSpan.textContent = "Add to whitelist";
					if (whitelistIcon) {
						whitelistIcon.className = "fas fa-user-check";
					}
				}
			}

			if (highlightButton) {
				const isHighlighted = wikishield.highlighted.has(edit.user.name);
				const highlightIcon = highlightButton.querySelector("i");
				const highlightSpan = highlightButton.querySelector("span");

				if (isHighlighted) {
					highlightSpan.textContent = "Remove highlight";
					if (highlightIcon) {
						highlightIcon.className = "fas fa-star-half-stroke";
					}
				} else {
					highlightSpan.textContent = "Highlight user";
					if (highlightIcon) {
						highlightIcon.className = "fas fa-star";
					}
				}
			}

			// Load protection info and display in page history header
			protectionPromise.then(protection => {
				const protIndicator = document.querySelector("#page-history #protection-indicator");
				if (protIndicator) {
					if (protection.protected) {
						let icon = "🔒";
						let tooltip = "Protected";

						if (protection.level === "full") {
							icon = "🔒";
							tooltip = "Fully protected";
						} else if (protection.level === "semi") {
							icon = "🔓";
							tooltip = "Semi-protected";
						} else if (protection.level === "extended") {
							icon = "🔐";
							tooltip = "Extended confirmed protected";
						}

						protIndicator.innerHTML = `<span style="cursor: help;" data-tooltip="${tooltip}">${icon}</span>`;
						this.addTooltipListener(protIndicator.querySelector("[data-tooltip]"));
					} else {
						protIndicator.innerHTML = "";
					}
				}
			});

			// Load block count and display next to warning level
			blockCountPromise.then(async blockCount => {
				const blockIndicator = document.querySelector("#user-contribs #block-count-indicator");
				if (blockIndicator) {
					if (blockCount > 0) {
						// Fetch detailed block history for tooltip
						const blockHistory = await wikishield.api.getBlockHistory(edit.user.name);

						let tooltipHtml = `<div class="tooltip-title">🚫 Block History (${blockCount} total)</div>`;

						if (blockHistory.length > 0) {
							blockHistory.forEach(block => {
								// Extract plain text from blocker name (remove any HTML tags)
								let blockerName = block.user || "Unknown";
								blockerName = blockerName.replace(/<[^>]*>/g, '');

								const timestamp = new Date(block.timestamp).toLocaleString('en-US', {
									month: 'short',
									day: 'numeric',
									year: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								});

								// Extract plain text from duration (remove any HTML tags)
								let duration = block.params?.duration || "Unknown duration";
								duration = duration.replace(/<[^>]*>/g, '');

								// Extract plain text from reason (remove any HTML tags)
								let reason = block.comment || "No reason specified";
								reason = reason.replace(/<[^>]*>/g, '');

								tooltipHtml += `<div class="tooltip-item">`;
								tooltipHtml += `<span class="tooltip-item-level">By ${wikishield.util.escapeHtml(blockerName)}</span><br>`;
								tooltipHtml += `<span class="tooltip-item-time">${timestamp} • ${wikishield.util.escapeHtml(duration)}</span><br>`;
								tooltipHtml += `<span class="tooltip-item-article">${wikishield.util.escapeHtml(reason)}</span>`;
								tooltipHtml += `</div>`;
							});

							if (blockCount > blockHistory.length) {
								tooltipHtml += `<div class="tooltip-more">... and ${blockCount - blockHistory.length} more</div>`;
							}
						}

						blockIndicator.style.display = "initial";
						blockIndicator.setAttribute("data-tooltip", tooltipHtml);
						blockIndicator.setAttribute("data-tooltip-html", "true");
						blockIndicator.innerHTML = `${blockCount}×`;
						blockIndicator.style.cursor = "help";
						this.addTooltipListener(blockIndicator);
					} else {
						blockIndicator.style.display = "none";
						blockIndicator.innerHTML = "";
						blockIndicator.removeAttribute("data-tooltip");
						blockIndicator.removeAttribute("data-tooltip-html");
					}
				}
			});

			// Add tooltip listeners to the new elements
			[...this.elem("#middle-top").querySelectorAll("[data-tooltip]")].forEach(e => {
				this.addTooltipListener(e);
			});

			// Update page metadata display
			const metadataElem = this.elem("#page-metadata");
			if (metadataElem) {
				const parts = [];
				if (edit.page.dateFormat && edit.page.dateFormat !== "Unknown") {
					parts.push(edit.page.dateFormat);
				}
				if (edit.page.englishVariant && edit.page.englishVariant !== "Unknown") {
					parts.push(edit.page.englishVariant);
				}
				metadataElem.innerHTML = parts.length > 0 ? parts.join(" • ") : "";
			}

			for (const cedit of edit.user.contribs) {
				const current = cedit.revid === wikishield.queue.currentEdit.revid ? "queue-edit-current" : "";

				contribsContainer.innerHTML += `
					<div class="queue-edit ${current}" data-revid="${cedit.revid}">
						${this.generateEditHTML(cedit, false, true, false, true)}
					</div>
				`;
			}

			for (const hedit of edit.page.history) {
				const current = hedit.revid === wikishield.queue.currentEdit.revid ? "queue-edit-current" : "";

				historyContainer.innerHTML += `
					<div class="queue-edit ${current}" data-revid="${hedit.revid}">
						${this.generateEditHTML(hedit, false, false, true, true)}
					</div>
				`;
			}

			[
				...contribsContainer.querySelectorAll("[data-tooltip]"),
				...historyContainer.querySelectorAll("[data-tooltip]")
			].forEach(elem => this.addTooltipListener(elem));

			[...contribsContainer.querySelectorAll(".queue-edit")].forEach(elem => {
				elem.addEventListener("click", () => wikishield.queue.loadFromContribs(elem.dataset.revid));
			});

			[...historyContainer.querySelectorAll(".queue-edit")].forEach(elem => {
				elem.addEventListener("click", () => wikishield.queue.loadFromHistory(elem.dataset.revid));
			});

			this.elem("#diff-container").innerHTML = `<table>${edit.diff}</table>`;

			// Remove any existing old edit notice
			const existingNotice = document.querySelector("#old-edit-notice");
			if (existingNotice) {
				existingNotice.remove();
			}

			// Update diff height
			this.updateDiffContainerHeight();		// Highlight elements containing current user's username in the diff

            if (wikishield.options.enableUsernameHighlighting) {
                const currentUsername = mw.config.get("wgUserName");
                if (currentUsername) {
                    const diffContainer = this.elem("#diff-container");
                    // Find all elements (typically td cells) in the diff
                    const allElements = diffContainer.querySelectorAll("td");

                    allElements.forEach(elem => {
                        if (elem.textContent.includes(currentUsername)) {
                            elem.style.outline = "2px solid #ffc107";
                            elem.style.outlineOffset = "-2px";
                        }
                    });
                }
            }

			// Scroll to the first changed line in the diff
			const diffContainer = this.elem("#diff-container");
			const firstChange = diffContainer.querySelector(".diff-addedline, .diff-deletedline");
			if (firstChange) {
				// Use setTimeout to ensure the DOM is fully rendered before scrolling
				setTimeout(() => {
					firstChange.scrollIntoView({ behavior: "smooth", block: "center" });
				}, 100);
			}

			// Display AI analysis if available
			this.updateAIAnalysisDisplay(edit.aiAnalysis);

			this.hide3RRNotice();
			if (edit.reverts >= 3) {
				this.show3RRNotice(edit.reverts);
			}
		}

		/**
		 * Update or create AI analysis display
		 * @param {Object} analysis The AI analysis object
		 */
		updateAIAnalysisDisplay(analysis) {
			// Find or create AI analysis container
			let aiContainer = document.querySelector("#ai-analysis-container");

			if (!analysis) {
				// Remove AI container if no analysis
				if (aiContainer) {
					aiContainer.remove();
				}
				this.updateDiffContainerHeight();
				return;
			}

			if (!aiContainer) {
				// Create container if it doesn't exist
				const diffContainer = document.querySelector("#diff-container");
				if (!diffContainer) return;

				aiContainer = document.createElement("div");
				aiContainer.id = "ai-analysis-container";
				aiContainer.style.cssText = `
					margin: 12px;
					padding: 0;
					border-radius: 12px;
					background: linear-gradient(135deg,
						rgba(102, 126, 234, 0.95) 0%,
						rgba(118, 75, 162, 0.95) 50%,
						rgba(102, 126, 234, 0.9) 100%);
					backdrop-filter: blur(20px);
					-webkit-backdrop-filter: blur(20px);
					color: white;
					box-shadow:
						0 8px 24px rgba(102, 126, 234, 0.4),
						inset 0 1px 0 rgba(255, 255, 255, 0.2),
						inset 0 -1px 0 rgba(0, 0, 0, 0.1);
					border: 1px solid rgba(255, 255, 255, 0.15);
					overflow: hidden;
					flex-shrink: 0;
					transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
				`;
				diffContainer.parentElement.insertBefore(aiContainer, diffContainer);
			}

			if (analysis.error) {
				aiContainer.innerHTML = `
					<div style="display: flex; align-items: center; gap: 10px; padding: 16px; background: rgba(220, 53, 69, 0.15); border-left: 4px solid #dc3545;">
						<span class="fa fa-exclamation-triangle" style="font-size: 1.3em; color: #ff6b6b;"></span>
						<span style="font-weight: 500;">AI analysis failed: ${analysis.error}</span>
					</div>
				`;
				this.updateDiffContainerHeight();
				return;
			}

			// Build issue badges
			let issueHTML = '';
			if (analysis.hasIssues && analysis.issues && analysis.issues.length > 0) {
				const severityColors = {
					'critical': 'rgba(220, 53, 69, 0.95)',
					'major': 'rgba(253, 126, 20, 0.95)',
					'minor': 'rgba(255, 193, 7, 0.95)'
				};

				const typeIcons = {
					'vandalism': 'fa-skull-crossbones',
					'spam': 'fa-spam',
					'pov': 'fa-balance-scale',
					'unsourced': 'fa-question-circle',
					'attack': 'fa-bomb',
					'copyright': 'fa-copyright',
					'disruptive': 'fa-circle-exclamation',
					'error': 'fa-bug',
					'policy': 'fa-gavel',
					'ai-generated': 'fa-robot'
				};

				issueHTML = '<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">';
				for (const issue of analysis.issues.slice(0, 5)) {
					const iconClass = typeIcons[issue.type] || 'fa-exclamation-circle';
					const bgColor = severityColors[issue.severity] || 'rgba(108, 117, 125, 0.95)';
					issueHTML += `
					<span style="
						display: inline-flex;
						align-items: center;
						gap: 4px;
						padding: 4px 8px;
						background: ${bgColor};
						border-radius: 6px;
						font-size: 0.75em;
						font-weight: 600;
						letter-spacing: 0.2px;
						box-shadow: 0 1px 6px rgba(0, 0, 0, 0.2);
						border: 1px solid rgba(255, 255, 255, 0.2);
						cursor: help;
						transition: all 0.2s ease;
					" data-tooltip="${wikishield.util.escapeHtml(issue.description)}"
					onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 3px 10px rgba(0, 0, 0, 0.3)';"
					onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 6px rgba(0, 0, 0, 0.2)';">
						<span class="fa ${iconClass}"></span>
						${issue.type}
					</span>
				`;
				}
				if (analysis.issues.length > 5) {
					issueHTML += `<span style="opacity: 0.85; font-size: 0.75em; padding: 4px 8px; background: rgba(0, 0, 0, 0.15); border-radius: 6px; font-weight: 500;">+${analysis.issues.length - 5} more</span>`;
				}
				issueHTML += '</div>';
			}

			// Build recommendation/action badge
			const actionColors = {
				'rollback': 'rgba(220, 53, 69, 0.95)',
				'warn-and-revert': 'rgba(231, 76, 60, 0.95)',
				'warn': 'rgba(253, 126, 20, 0.95)',
				'report-aiv': 'rgba(142, 68, 173, 0.95)',
				'review': 'rgba(255, 193, 7, 0.95)',
				'approve': 'rgba(40, 167, 69, 0.95)',
				'thank': 'rgba(23, 162, 184, 0.95)',
				'welcome': 'rgba(32, 201, 151, 0.95)'
			};
			const actionIcons = {
				'rollback': 'fa-rotate-left',
				'warn-and-revert': 'fa-exclamation-triangle',
				'warn': 'fa-exclamation-triangle',
				'report-aiv': 'fa-gavel',
				'review': 'fa-eye',
				'approve': 'fa-check-circle',
				'thank': 'fa-heart',
				'welcome': 'fa-hand-wave'
			};

			const action = analysis.action || 'review';
			const actionColor = actionColors[action] || 'rgba(108, 117, 125, 0.95)';
			const actionIcon = actionIcons[action] || 'fa-question';
			const probability = analysis.probability || 0;

			aiContainer.innerHTML = `
			<div style="padding: 10px 12px;">
				<!-- Compact Header -->
				<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
					<div style="display: flex; align-items: center; gap: 6px;">
						<span class="fa fa-robot" style="font-size: 1.1em;"></span>
						<strong style="font-size: 0.95em; letter-spacing: 0.3px;">AI Analysis</strong>
						<span style="padding: 3px 8px; background: rgba(255,255,255,0.25); border-radius: 6px; font-size: 0.8em; font-weight: 700;">
							${probability}%
						</span>
						<span style="padding: 3px 8px; background: rgba(255,255,255,0.18); border-radius: 6px; font-size: 0.75em; font-weight: 600; text-transform: uppercase;">
							${analysis.confidence || 'unknown'}
						</span>
					</div>
					<span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: ${actionColor}; border-radius: 6px; font-size: 0.8em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;">
						<span class="fa ${actionIcon}"></span>
						${action.replace(/-/g, ' ')}
					</span>
				</div>

				<!-- Compact Summary -->
				<div style="font-size: 0.85em; line-height: 1.4; margin-bottom: 6px; opacity: 0.95;">
					${analysis.summary}
				</div>

				${analysis.reasoning ? `
				<div style="font-size: 0.8em; line-height: 1.3; padding: 6px 8px; background: rgba(0,0,0,0.15); border-radius: 4px; margin-bottom: 6px; border-left: 3px solid rgba(143,163,255,0.5); opacity: 0.9;">
					<strong style="font-size: 0.85em;">🔍</strong> ${analysis.reasoning}
				</div>
				` : ''}

				<!-- Compact Recommendation -->
				<div style="font-size: 0.82em; line-height: 1.3; padding: 6px 8px; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: ${analysis.hasIssues && analysis.issues && analysis.issues.length > 0 ? '8px' : '0'}; border-left: 3px solid rgba(40,167,69,0.6); opacity: 0.95;">
					<strong style="font-size: 0.85em;">💡</strong> ${analysis.recommendation}
				</div>

				<!-- Compact Issues -->
				${issueHTML}
			</div>
		`;

			// Add tooltip listeners to issue badges
			aiContainer.querySelectorAll('[data-tooltip]').forEach(elem => {
				this.addTooltipListener(elem);
			});

			// Update diff container height after AI analysis is displayed
			this.updateDiffContainerHeight();
		}

		/**
		 * Show a notice that you have broken 3RR
		 * @param {Number} count The revision ID of the newer edit
		 */
		show3RRNotice(count) {
			// Remove any existing notice first
			this.hide3RRNotice();

			// Validate inputs
			if (count < 3) {
				console.error("Cannot show 3RR notice: improper revert count");
				return;
			}

			// Create the notice using the same style as old-edit-notice
			const noticeDiv = document.createElement("div");
			noticeDiv.id = "warn-3RR-notice";

			noticeDiv.style.cssText = `
				margin: 10px 10px 0 10px;
				padding: 8px 12px;
				background: #f73214;
				border-radius: 4px;
				color: #0c5460;
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 0.9em;
				flex-shrink: 0;
			`;

			noticeDiv.innerHTML = `
				<span class="fa fa-warning"></span>
				<span style="flex: 1;"><b>3RR:</b> You have made ${count} reverts on this article in the last 24 hours.</span>
			`;

			// Insert before the diff container
			const diffContainer = this.elem("#diff-container");
			if (diffContainer && diffContainer.parentElement) {
				diffContainer.parentElement.insertBefore(noticeDiv, diffContainer);
			}
		}

		/**
		 * Hide the newer edit button if it exists
		 */
		hide3RRNotice() {
			const existingNotice = document.querySelector("#warn-3RR-notice");
			if (existingNotice) {
				existingNotice.remove();
			}
		}

		/**
		 * Show a button indicating there's a newer revision on the current Wikipedia page
		 * @param {Number} newerRevid The revision ID of the newer edit
		 * @param {String} pageTitle The title of the Wikipedia page
		 */
		showNewerEditButton(newerRevid, pageTitle) {
			// Remove any existing notice first
			this.hideNewerEditButton();

			// Validate inputs
			if (!newerRevid || !pageTitle) {
				console.error("Cannot show newer edit button: missing revid or page title");
				return;
			}

			// Create the notice using the same style as old-edit-notice
			const noticeDiv = document.createElement("div");
			noticeDiv.id = "old-edit-notice";
			noticeDiv.setAttribute("data-newer-revision", "true"); // Mark this as a newer revision notice
			noticeDiv.setAttribute("data-target-revid", newerRevid);
			noticeDiv.setAttribute("data-target-page", pageTitle);

			noticeDiv.style.cssText = `
				margin: 10px 10px 0 10px;
				padding: 8px 12px;
				background: #d1ecf1;
				border-left: 4px solid #17a2b8;
				border-radius: 4px;
				color: #0c5460;
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 0.9em;
				flex-shrink: 0;
			`;

			noticeDiv.innerHTML = `
				<span class="fa fa-clock-rotate-left"></span>
				<span style="flex: 1;">Newer revision available on this page</span>
				<a href="#" id="view-newest-edit" style="color: #004085; font-weight: 600; text-decoration: none; white-space: nowrap;">
					View latest →
				</a>
			`;

			// Insert before the diff container
			const diffContainer = this.elem("#diff-container");
			if (diffContainer && diffContainer.parentElement) {
				diffContainer.parentElement.insertBefore(noticeDiv, diffContainer);

				// Add click handler
				document.getElementById("view-newest-edit").addEventListener("click", (e) => {
					e.preventDefault();
					const targetRevid = noticeDiv.getAttribute("data-target-revid");
					const targetPage = noticeDiv.getAttribute("data-target-page");

					if (targetRevid && targetPage) {
						wikishield.queue.loadSpecificRevision(Number(targetRevid), targetPage);
					}
				});
			}
		}

		/**
		 * Hide the newer edit button if it exists
		 */
		hideNewerEditButton() {
			const existingNotice = document.querySelector("#old-edit-notice[data-newer-revision='true']");
			if (existingNotice) {
				existingNotice.remove();
			}
		}

		/**
		 * Start periodic checking for newer revisions on the current Wikipedia page
		 * @param {Object} edit The current edit being viewed
		 */
		startNewerRevisionCheck(edit) {
			// Clear any existing interval and hide any old buttons
			this.stopNewerRevisionCheck();

			// Immediately check for newer revisions
			this.checkForNewerRevision(edit);

			// Set up periodic checking every 10 seconds
			this.newerRevisionInterval = setInterval(() => {
				// Only continue checking if we're still viewing the exact same edit
				if (wikishield.queue.currentEdit && wikishield.queue.currentEdit.revid === edit.revid) {
					this.checkForNewerRevision(edit);
				} else {
					// We've switched to a different edit, stop this check
					this.stopNewerRevisionCheck();
				}
			}, 10000);
		}

		/**
		 * Stop periodic checking for newer revisions and hide the button
		 */
		stopNewerRevisionCheck() {
			// Clear the interval timer
			if (this.newerRevisionInterval) {
				clearInterval(this.newerRevisionInterval);
				this.newerRevisionInterval = null;
			}
			// Always remove the button when stopping
			this.hideNewerEditButton();
		}

		/**
		 * Check if there's a newer revision on the current Wikipedia page
		 * @param {Object} edit The current edit being viewed
		 */
		async checkForNewerRevision(edit) {
			try {
				const pageTitle = edit.page.title;
				const currentRevid = edit.revid;

				// Fetch the ACTUAL latest revision ID from Wikipedia API
				const latestRevisions = await wikishield.api.getLatestRevisions(pageTitle);
				const latestRevid = latestRevisions[pageTitle];

				if (!latestRevid) {
					// API call failed or page doesn't exist
					this.hideNewerEditButton();
					return;
				}

				// Simple check: is there a revision with a higher ID than the one we're viewing?
				if (latestRevid > currentRevid) {
					// YES - there's a newer revision on this Wikipedia page
					this.showNewerEditButton(latestRevid, pageTitle);
				} else {
					// NO - we're viewing the latest revision
					this.hideNewerEditButton();
				}
			} catch (err) {
				console.error("Failed to check for newer revision:", err);
				this.hideNewerEditButton();
			}
		}

		/**
		 * Dynamically adjust diff container height based on AI analysis and notices
		 */
		updateDiffContainerHeight() {
			// Since we're using flexbox, we don't need to manually calculate height
			// The diff-container will automatically fill available space
			// This method is kept for potential future use or other adjustments
		}	/**
		* Create a tooltip when an element is hovered over
		* @param {HTMLElement} elem
		*/
		addTooltipListener(elem) {
			elem.addEventListener("mouseenter", () => {
				this.removeTooltips();

				if (!elem.dataset.tooltip) {
					return;
				}

				const tooltip = document.createElement("div");
				tooltip.classList.add("tooltip");

				// Check if tooltip content is HTML or plain text
				if (elem.dataset.tooltipHtml === "true") {
					tooltip.innerHTML = elem.dataset.tooltip;
				} else {
					tooltip.innerText = elem.dataset.tooltip;
				}

				document.body.appendChild(tooltip);

				// Force a reflow to ensure dimensions are calculated
				tooltip.offsetHeight;

				const tooltipWidth = tooltip.getBoundingClientRect().width,
					tooltipHeight = tooltip.getBoundingClientRect().height;
				const elemBox = elem.getBoundingClientRect();

				// Calculate center position for the tooltip
				const centerLeft = (elemBox.left + elemBox.right - tooltipWidth) / 2;

				const canFitRight = elemBox.right < window.innerWidth - tooltipWidth - 30;
				const canFitLeft = elemBox.left > tooltipWidth + 30;
				// Check if tooltip can fit centered AND if centered position is actually on screen
				const canFitMiddle = centerLeft > 10 && centerLeft + tooltipWidth < window.innerWidth - 10;
				const canFitTop = canFitMiddle && elemBox.top > tooltipHeight + 30;
				const canFitBottom = canFitMiddle && elemBox.bottom < window.innerHeight - tooltipHeight - 30;

				// Position the tooltip
				if (canFitTop) {
					tooltip.style.left = (elemBox.left + elemBox.right - tooltipWidth) / 2 + "px";
					tooltip.style.top = (elemBox.top - tooltipHeight - 10) + "px";
				} else if (canFitBottom) {
					tooltip.style.left = (elemBox.left + elemBox.right - tooltipWidth) / 2 + "px";
					tooltip.style.top = (elemBox.bottom + 10) + "px";
				} else if (canFitRight) {
					tooltip.style.left = (elemBox.right + 10) + "px";
					tooltip.style.top = (elemBox.top - 4) + "px";
				} else if (canFitLeft) {
					tooltip.style.left = (elemBox.left - 10 - tooltipWidth) + "px";
					tooltip.style.top = (elemBox.top - 4) + "px";
				} else {
					// Fallback: center on element, clip if necessary
					tooltip.style.left = Math.max(10, (elemBox.left + elemBox.right - tooltipWidth) / 2) + "px";
					tooltip.style.top = Math.max(10, elemBox.bottom + 10) + "px";
				}

				tooltip.style.opacity = 1;
			});

			elem.addEventListener("mouseleave", () => {
				this.removeTooltips();
			});
		}

		/**
		 * Delete all existing tooltip elements
		 */
		removeTooltips() {
			[...document.querySelectorAll(".tooltip")].forEach(elem => {
				elem.style.opacity = 0;
				window.setTimeout(() => elem.remove(), 200);
			});
		}

		/**
		 * Remove all elements from the queue
		 */
		clearQueue() {
			this.elem("#queue-items").innerHTML = "";
		}

		/**
		 * Remove a specific item from the queue
		 * @param {Number} revid
		 */
		removeQueueItem(revid) {
			const elem = this.elem(`.queue-edit[data-revid="${revid}"]`);

			if (elem) {
				elem.remove();
			}
		}

		/**
		 * From the ORES score, get the color to display
		 * @param {Number} ores The ORES score
		 * @returns {String} The color to display
		 */
		getORESColor(ores) {
			const colors = wikishieldData.colorPalettes[wikishield.options.selectedPalette];
			return colors[Math.floor(ores * colors.length)];
		}

		/**
		 * Return a specific element
		 * @param {String} selector
		 * @returns
		 */
		elem(selector) {
			return document.querySelector(selector);
		}

		/**
		 * Escape HTML to prevent XSS
		 */
		escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}

		/**
		 * Show a toast notification on screen
		 * @param {String} title - Title of the notification
		 * @param {String} message - Message content
		 * @param {Number} duration - How long to show (ms), default 5000
		 */
		showToast(title, message, duration = 5000, type = "default") {
			// Create toast element
			const toast = document.createElement("div");
			toast.classList.add("toast-notification");

			// Add type class for styling
			if (type === "success") toast.classList.add("success");
			else if (type === "error") toast.classList.add("error");
			else if (type === "warning") toast.classList.add("warning");

			// Select icon based on type
			let icon = "⚠️";
			if (type === "success") icon = "✓";
			else if (type === "error") icon = "✕";
			else if (type === "warning") icon = "⚠️";

			toast.innerHTML = `
				<div class="toast-icon">${icon}</div>
				<div class="toast-content">
					<div class="toast-title">${this.escapeHtml(title)}</div>
					<div class="toast-message">${this.escapeHtml(message)}</div>
				</div>
				<div class="toast-close">×</div>
			`;

			document.body.appendChild(toast);

			// Trigger animation
			setTimeout(() => toast.classList.add("show"), 10);

			// Close button handler
			const closeBtn = toast.querySelector(".toast-close");
			closeBtn.addEventListener("click", () => {
				this.hideToast(toast);
			});

			// Auto-hide after duration
			setTimeout(() => {
				this.hideToast(toast);
			}, duration);
		}

		/**
		 * Hide and remove a toast notification
		 */
		hideToast(toast) {
			if (!toast || !toast.parentElement) return;

			toast.classList.add("hide");
			setTimeout(() => {
				if (toast.parentElement) {
					toast.remove();
				}
			}, 300);
		}

		/**
		 * Show UAA reason selection dialog
		 * @param {String} username - Username to report
		 * @returns {Promise<String|null>} Selected reason or null if cancelled
		 */
		showUAAReasonDialog(username) {
			return new Promise((resolve) => {
				// Create overlay
				const overlay = document.createElement("div");
				overlay.classList.add("confirmation-modal-overlay");

				// Create modal
				const modal = document.createElement("div");
				modal.classList.add("confirmation-modal");
				modal.innerHTML = `
					<div class="confirmation-modal-header">
						<div class="confirmation-modal-title">Report to UAA</div>
					</div>
					<div class="confirmation-modal-body">
						Select reason for reporting <span class="confirmation-modal-username">${this.escapeHtml(username)}</span>:
					</div>
					<div class="confirmation-modal-footer confirmation-modal-footer-vertical">
						<button class="confirmation-modal-button confirmation-modal-button-reason" data-reason="Disruptive username">Disruptive username</button>
						<button class="confirmation-modal-button confirmation-modal-button-reason" data-reason="Offensive username">Offensive username</button>
						<button class="confirmation-modal-button confirmation-modal-button-reason" data-reason="Promotional username">Promotional username</button>
						<button class="confirmation-modal-button confirmation-modal-button-reason" data-reason="Misleading username">Misleading username</button>
						<button class="confirmation-modal-button confirmation-modal-button-cancel">Cancel</button>
					</div>
				`;

				overlay.appendChild(modal);
				document.body.appendChild(overlay);

				// Disable all keybinds while modal is open
				const keyHandler = (e) => {
					if (e.key === "Escape") {
						e.preventDefault();
						e.stopPropagation();
						closeModal(null);
						return false;
					} else if (e.key !== "Tab") {
						e.preventDefault();
						e.stopPropagation();
						return false;
					}
				};

				document.addEventListener("keydown", keyHandler, true);

				const closeModal = (result) => {
					document.removeEventListener("keydown", keyHandler, true);
					overlay.classList.add("closing");
					modal.classList.add("closing");
					setTimeout(() => {
						overlay.remove();
						resolve(result);
					}, 200);
				};

				// Handle reason button clicks
				modal.querySelectorAll(".confirmation-modal-button-reason").forEach(btn => {
					btn.addEventListener("click", () => {
						closeModal(btn.dataset.reason);
					});
				});

				// Handle cancel button
				modal.querySelector(".confirmation-modal-button-cancel").addEventListener("click", () => {
					closeModal(null);
				});

				// Close on overlay click
				overlay.addEventListener("click", (e) => {
					if (e.target === overlay) {
						closeModal(null);
					}
				});
			});
		}

		/**
		 * Show a confirmation dialog and return a promise that resolves to true (Yes) or false (No)
		 * @param {String} title - Dialog title
		 * @param {String} message - Dialog message (can include HTML)
		 * @param {String} username - Optional username to enable UAA report button
		 */
		showConfirmationDialog(title, message, username = null) {
			return new Promise((resolve) => {
				// Create overlay
				const overlay = document.createElement("div");
				overlay.classList.add("confirmation-modal-overlay");

				// Create modal
				const modal = document.createElement("div");
				modal.classList.add("confirmation-modal");

				const uaaButton = username ? `<button class="confirmation-modal-button confirmation-modal-button-uaa">Report to UAA</button>` : '';

				modal.innerHTML = `
					<div class="confirmation-modal-header">
						<div class="confirmation-modal-title">${this.escapeHtml(title)}</div>
					</div>
					<div class="confirmation-modal-body">${message}</div>
					<div class="confirmation-modal-footer">
						${uaaButton}
						<div class="confirmation-modal-footer-right">
							<button class="confirmation-modal-button confirmation-modal-button-no">No</button>
							<button class="confirmation-modal-button confirmation-modal-button-yes">Yes</button>
						</div>
					</div>
				`;

				overlay.appendChild(modal);
				document.body.appendChild(overlay);

				// Disable all keybinds while modal is open
				const keyHandler = (e) => {
					// Only allow Tab, Enter, Escape
					if (e.key === "Enter") {
						e.preventDefault();
						e.stopPropagation();
						closeModal(true);
						return false;
					} else if (e.key === "Escape") {
						e.preventDefault();
						e.stopPropagation();
						closeModal(false);
						return false;
					} else if (e.key !== "Tab") {
						// Block all other keys
						e.preventDefault();
						e.stopPropagation();
						return false;
					}
				};

				document.addEventListener("keydown", keyHandler, true);

				// Handle button clicks
				const yesBtn = modal.querySelector(".confirmation-modal-button-yes");
				const noBtn = modal.querySelector(".confirmation-modal-button-no");
				const uaaBtn = modal.querySelector(".confirmation-modal-button-uaa");

				const closeModal = (result) => {
					// Remove key handler
					document.removeEventListener("keydown", keyHandler, true);

					overlay.classList.add("closing");
					modal.classList.add("closing");
					setTimeout(() => {
						overlay.remove();
						resolve(result);
					}, 200);
				};

				yesBtn.addEventListener("click", () => closeModal(true));
				noBtn.addEventListener("click", () => closeModal(false));

				// UAA report button
				if (uaaBtn && username) {
					uaaBtn.addEventListener("click", async () => {
						// Close the current modal first
						document.removeEventListener("keydown", keyHandler, true);
						overlay.classList.add("closing");
						modal.classList.add("closing");

						setTimeout(async () => {
							overlay.remove();

							// Show UAA reason selection dialog
							const reason = await this.showUAAReasonDialog(username);

							if (reason) {
								// User selected a reason, proceed with report
								const progressBar = new WikiShieldProgressBar();
								progressBar.set("Reporting to UAA...", 0.5, "var(--main-blue)");

								try {
									await wikishield.reportToUAA(username, reason);
									progressBar.set(`Reported ${username} to UAA`, 1, "var(--main-green)");
								} catch (err) {
									progressBar.set("Report failed", 1, "var(--main-red)");
									console.error("UAA report error:", err);
								}

								resolve(false);
							} else {
								// User cancelled, show the welcome dialog again
								const confirmed = await this.showConfirmationDialog(title, message, username);
								resolve(confirmed);
							}
						}, 200);
					});
				}

				// Close on overlay click
				overlay.addEventListener("click", (e) => {
					if (e.target === overlay) {
						closeModal(false);
					}
				});

				// Focus the Yes button by default
				setTimeout(() => yesBtn.focus(), 50);
			});
		}
	}

	class WikiShieldProgressBar {
		constructor() {
			this.element = document.createElement("div");
			this.element.className = "progress-bar"; this.overlay = document.createElement("div");
			this.overlay.className = "progress-bar-overlay";

			this.text = document.createElement("div");
			this.text.className = "progress-bar-text";

			wikishield.interface.elem("#progress-bar-container").appendChild(this.element);
			this.element.appendChild(this.overlay);
			this.element.appendChild(this.text);

			this.nextChangeTime = 0;
		}

		/**
		 * Set the progress bar's text, width, and color; remove after 2s if at 100%
		 * @param {String} text The text to display
		 * @param {Number} width The width of the progress bar
		 * @param {String} color The color of the progress bar
		 */
		set(text, width, color) {
			const delay = Math.max(0, this.nextChangeTime - Date.now());

			window.setTimeout(() => {
				this.text.innerHTML = text;
				this.overlay.style.width = `${Math.round(width * 100)}%`;
				this.overlay.style.background = color;

				if (width === 1) {
					this.remove(2000);
				}
			}, delay);

			this.nextChangeTime = Math.max(Date.now() + 200, this.nextChangeTime + 200);
		}

		/**
		 * Remove the progress bar after a given time
		 * @param {Number} time The time to wait before removing the progress bar
		 */
		remove(time) {
			window.setTimeout(() => {
				this.element.style.opacity = "0";
			}, time - 300);

			window.setTimeout(() => {
				this.element.remove();
			}, time);
		}
	}

	class WikiShield {
		constructor() {
			this.options = this.loadOptions();
			this.statistics = this.loadStats();
			this.interface = new WikiShieldInterface();
			this.queue = new WikiShieldQueue();
			this.api = new WikiShieldAPI(new mw.Api());
			this.logger = new WikiShieldLog();
			this.util = new WikiShieldUtil();

			// Load whitelist and highlighted from storage
			this.whitelist = this.loadWhitelist();
			this.highlighted = this.loadHighlighted();
			this.noAutoWelcomeList = new Set(); // Track users who shouldn't be auto-welcomed

			// Start periodic cleanup of expired highlights (every 30 seconds)
			this.highlightCleanupInterval = setInterval(() => {
				this.cleanupExpiredHighlights();
			}, 30000);

			// Initialize Ollama AI if enabled (preserves last saved state)
			this.ollamaAI = null;
			if (this.options.enableOllamaAI) {
				this.ollamaAI = new WikiShieldOllamaAI(
					this.options.ollamaServerUrl,
					this.options.ollamaModel
				);
				this.logger.log("Ollama AI integration enabled");
			}

			this.aivReports = [];
			this.uaaReports = [];

			this.rights = {
				rollback: false,
				protect: false,
				block: false
			};
			this.username = mw.config.values.wgUserName;
			this.handleLoadingReported();
			this.handleLoadingNotifications();
			this.testingMode = false;
			this.tempCurrentEdit = null;
			this.notifications = [];
			this.lastSeenRevision = null;
		}

		/**
		 * Create the interface for checking if the user is allowed to use wikishield
		 */
		async startInterface() {
			const userRights = await mw.user.getRights();
			this.rights.rollback = userRights.includes("rollback");
			this.rights.protect = userRights.includes("protect");
			this.rights.block = userRights.includes("block");

			this.interface.build();
			this.handleUpdatingContributions();
		}

		/**
		 * Fetch and display the current user's total contribution count
		 */
		async updateMyContributions() {
			try {
				const result = await this.api.api.get({
					action: "query",
					list: "users",
					ususers: this.username,
					usprop: "editcount"
				});

				if (result.query && result.query.users && result.query.users[0]) {
					const editCount = result.query.users[0].editcount || 0;
					const statElem = document.querySelector("#stat-total-contribs");
					if (statElem) {
						statElem.textContent = editCount.toLocaleString();
					}
				}
			} catch (err) {
				console.log("Failed to fetch user contribution count:", err);
			}
		}

		/**
		 * Start periodic updates of contribution count every 10 seconds
		 */
		handleUpdatingContributions() {
			this.updateMyContributions();

			window.setTimeout(() => {
				this.handleUpdatingContributions();
			}, 10000); // Update every 10 seconds
		}

		/**
		 * Clean up expired highlights and refresh UI if needed
		 */
		cleanupExpiredHighlights() {
			const now = Date.now();
			let needsRefresh = false;

			for (const [username, expirationTime] of this.highlighted.entries()) {
				if (now >= expirationTime) {
					this.highlighted.delete(username);
					needsRefresh = true;
					this.logger.log(`Removed expired highlight for user: ${username}`);
				}
			}

			if (needsRefresh) {
				this.saveHighlighted();
				// Refresh the queue UI to update highlighting
				if (this.queue && this.interface) {
					this.interface.renderQueue(this.queue.queue, this.queue.currentEdit);
				}
			}
		}

		/**
		 * Create the main interface
		 */
		start() {
			this.interface.start();
			this.queue.fetchRecentChanges();
		}

		/**
		 * Load options from storage; if an option is missing, add it with the default value
		 * @returns {Object} The options object
		 */
		loadOptions() {
			let options = {};
			try {
				options = JSON.parse(mw.storage.store.getItem("wikishieldSettings"));
			} catch (err) { }

			if (!options) {
				options = {};
			}

			for (const item in wikishieldData.defaultSettings) {
				const option = options[item];
				if (typeof option === "undefined" || option === null) {
					options[item] = wikishieldData.defaultSettings[item];
				} else if (typeof option === "object" && !Array.isArray(option)) {
					for (const subitem in wikishieldData.defaultSettings[item]) {
						if (typeof option[subitem] === "undefined") {
							option[subitem] = wikishieldData.defaultSettings[item][subitem];
						}
					}
				}
			}

			for (const item in options.controls) {
				if (typeof options.controls[item] === "string") {
					options.controls[item] = [options.controls[item]];
				}
				const length = options.controls[item].length;
				for (let i = 0; i < length; i++) {
					options.controls[item][i] = options.controls[item][i].toLowerCase();
				}
			}

			this.saveOptions(options);
			return options;
		}

		/**
		 * Save options to storage
		 * @param {Object} options The options object
		 */
		saveOptions(options) {
			mw.storage.store.setItem("wikishieldSettings", JSON.stringify(options));
		}

		/**
		 * Save whitelist to storage
		 */
		saveWhitelist() {
			const data = [...this.whitelist.entries()]; // Convert Map to array of [key, value] pairs
			mw.storage.store.setItem("wikishieldWhitelist", JSON.stringify(data));
		}

		/**
		 * Load whitelist from storage
		 * @returns {Map} The whitelist map with timestamps
		 */
		loadWhitelist() {
			try {
				const data = JSON.parse(mw.storage.store.getItem("wikishieldWhitelist"));
				// Support old Set format (array of usernames) and new Map format (array of [username, timestamp])
				if (data && data.length > 0) {
					if (typeof data[0] === 'string') {
						// Old format: convert to Map with current timestamp
						return new Map(data.map(username => [username, Date.now()]));
					} else {
						// New format: already [key, value] pairs
						return new Map(data);
					}
				}
				return new Map();
			} catch (err) {
				return new Map();
			}
		}

		/**
		 * Save highlighted users to storage
		 */
		saveHighlighted() {
			const data = [...this.highlighted.entries()]; // Convert Map to array of [key, value] pairs
			mw.storage.store.setItem("wikishieldHighlighted", JSON.stringify(data));
		}

		/**
		 * Load highlighted users from storage
		 * @returns {Map} The highlighted map
		 */
		loadHighlighted() {
			try {
				const data = JSON.parse(mw.storage.store.getItem("wikishieldHighlighted"));
				return new Map(data || []);
			} catch (err) {
				return new Map();
			}
		}

		/**
		 * Load the changelog version from storage
		 * @returns {String} The changelog version
		 */
		getChangelogVersion() {
			const version = mw.storage.store.getItem("__script__.changelog.version");

			if (!version) {
				mw.storage.store.setItem("__script__.changelog.version", 0);
				return 0;
			}

			return version;
		}

		/**
		 * Update changelog version to hide popup
		 */
		updateChangelogVersion() {
			mw.storage.store.setItem("__script__.changelog.version", __script__.changelog.version);
		}

		/**
		 * Load statistics from storage
		 * @returns {Object} The statistics object
		 */
		loadStats() {
			let stats;
			try {
				stats = JSON.parse(mw.storage.store.getItem("wikishieldStats"));
			} catch (err) { }

			if (!stats) {
				stats = {
					reviewed: 0,
					reverts: 0,
					reports: 0,
					warnings: 0,
					welcomes: 0,
					whitelisted: 0,
					highlighted: 0,
					blocks: 0,
					sessionStart: Date.now()
				};
			}

			// Ensure all properties exist (for backward compatibility)
			if (stats.warnings === undefined) stats.warnings = 0;
			if (stats.welcomes === undefined) stats.welcomes = 0;
			if (stats.whitelisted === undefined) stats.whitelisted = 0;
			if (stats.highlighted === undefined) stats.highlighted = 0;
			if (stats.blocks === undefined) stats.blocks = 0;
			if (stats.sessionStart === undefined) stats.sessionStart = Date.now();

			this.saveStats(stats);
			return stats;
		}

		/**
		 * Save statistics to storage
		 * @param {Object} stats The statistics object
		 */
		saveStats(stats) {
			mw.storage.store.setItem("wikishieldStats", JSON.stringify(stats));
		}

		/**
		 * Revert an edit, using either rollback or manual reverting
		 * @param {Object} edit The edit object
		 * @param {String} message Message to use in the edit summary
		 * @return {Promise<Boolean>} If the rollback succeded
		 */
		async revert(edit, message, goodFaith = false) {
			if (!edit) {
				return;
			}

			const gfStr = goodFaith ? "[[WP:AGF|good faith]] " : "";
			const summary = `Reverted ${gfStr}edits by [[Special:Contributions/${edit.user.name}|${edit.user.name}]] ([[User talk:${edit.user.name}|talk]])${message ? ": " + message : ""} ([[WP:WikiShield|WS]])`;

			if (this.rights.rollback) {
				const result = await this.api.rollback(edit.page.title, edit.user.name, summary);

				if (!result) {
					// Rollback failed - show toast notification
					this.interface.showToast(
						"Revert Failed",
						`Could not revert edits on "${edit.page.title}" - a newer edit may have been made`
					);
					return false;
				}
			} else {
				return false;
			}

			this.statistics.reverts++;
			this.saveStats(this.statistics);
			// Update contribution count after successful revert
			this.updateMyContributions();

			return true;
		}

		/**
		 * Warn a user with the given template
		 * @param {String} user The username to warn
		 * @param {String[]} warningTemplates The warning template set to use
		 * @param {String|Number} warnLevel Level of warning to use; 1-5 or "auto"
		 * @param {String} articleName The article name to use in the warning
		 * @param {Number} revid Edit revid to use in edit summary
		 */
		async warnUser(user, warningTemplates, warnLevel, articleName, revid) {
			if (!warningTemplates) {
				return;
			}

			let userTalkContent = await this.api.getSinglePageContent(`User talk:${user}`);
			let warnTemplate = "";

			// Handle manual level selection (not "auto")
			if (warnLevel !== "auto") {
				if (warnLevel === "4im") {
					// 4im is the 5th template (index 4)
					if (warningTemplates.length >= 5) {
						warnTemplate = warningTemplates[4];
					} else {
						// If no 4im template exists, use the last available template
						warnTemplate = warningTemplates[warningTemplates.length - 1];
					}
				} else if (warnLevel > 0 && warnLevel <= warningTemplates.length) {
					// Standard numbered level (1-4)
					warnTemplate = warningTemplates[warnLevel - 1];
				}
			}

			// Handle auto level selection
			if (warnLevel === "auto") {
				const warningLevel = this.queue.getWarningLevel(userTalkContent);
				const levelAsNumber = warningLevel === "4im" ? 5 : Number(warningLevel);

				if (warningLevel === "4" || warningLevel === "4im" || levelAsNumber >= warningTemplates.length) {
					return;
				}

				warnTemplate = warningTemplates[levelAsNumber];
			}

			if (!warnTemplate) {
				return;
			}

			if (!userTalkContent.match("== ?" + wikishield.util.monthSectionName() + " ?==")) {
				userTalkContent += `\n== ${wikishield.util.monthSectionName()} ==\n`;
			}

			const sections = userTalkContent.split(/(?=== ?[\w\d ]+ ?==)/g);

			for (let section in sections) {
				if (sections[section].match(new RegExp("== ?" + wikishield.util.monthSectionName() + " ?=="))) {
					// If articleName is null, template doesn't take a parameter
					if (articleName) {
						sections[section] += `\n\n{{${warnTemplate}|${articleName}}} ~~~~`;
					} else {
						sections[section] += `\n\n{{${warnTemplate}}} ~~~~`;
					}
					break;
				}
			}

			const newContent = sections.join("")
				.replace(/(\n){3,}/g, "\n\n");

			const levelMatch = warnTemplate.match(/(\d(?:im)?)$/);
			const levelName = levelMatch ? levelMatch[1] : null;

			// Create edit summary based on whether article name is provided
			const editSummary = articleName
				? (levelName
					? `Message about [[Special:Diff/${revid}|your edit]] on [[${articleName}]] (level ${levelName}) ([[WP:WikiShield|WS]])`
					: `Message about [[Special:Diff/${revid}|your edit]] on [[${articleName}]] ([[WP:WikiShield|WS]])`)
				: (levelName
					? `Message about your edits (level ${levelName}) ([[WP:WikiShield|WS]])`
					: `Message about your edits ([[WP:WikiShield|WS]])`);

			await this.api.edit(
				`User talk:${user}`,
				newContent,
				editSummary
			);

			// Increment warning statistic
			this.statistics.warnings++;
			this.saveStats(this.statistics);

			// Add user talk page to watchlist with configured expiry
			try {
				await this.api.postWithToken("watch", {
					"action": "watch",
					"titles": `User talk:${user}`,
					"expiry": wikishield.options.watchlistExpiry
				});
			} catch (err) {
				console.log(`Could not add User talk:${user} to watchlist:`, err);
			}

			// Update the warning level in the current edit object (only if the template has a numbered level)
			if (levelName && this.queue.currentEdit && this.queue.currentEdit.user.name === user) {
				console.log(`[warnUser] Updating warning level for ${user} from ${this.queue.currentEdit.user.warningLevel} to ${levelName}`);
				console.log(`[warnUser] Original warning level: ${this.queue.currentEdit.user.originalWarningLevel}`);
				this.queue.currentEdit.user.warningLevel = levelName;
			}
		}

		/**
		 * Load the users currently reported to AIV and UAA
		 */
		async loadReportedUsers() {
			try {
				const content = await this.api.getText(`${__script__.pages.AVI}|${__script__.pages.UAA}`);

				const regex = new RegExp(`{{(?:(?:ip)?vandal|user-uaa)\\|(?:1=)?(.+?)}}`, "gi");

				// Check if AVI content exists before trying to match
				if (content && content[__script__.pages.AVI]) {
					this.aivReports = [...content[__script__.pages.AVI].matchAll(regex)]
						.map(report => report[1]);
				} else {
					console.warn("AVI content not found, skipping AVI reports");
					this.aivReports = [];
				}

				// Check if UAA content exists before trying to match
				if (content && content[__script__.pages.UAA]) {
					this.uaaReports = [...content[__script__.pages.UAA].matchAll(regex)]
						.map(report => report[1]);
				} else {
					console.warn("UAA content not found, skipping UAA reports");
					this.uaaReports = [];
				}
			} catch (err) {
				console.log("Error while fetching reported users", err);
				// Initialize as empty arrays on error
				this.aivReports = this.aivReports || [];
				this.uaaReports = this.uaaReports || [];
			}
		}

		/**
		 * Every 15 seconds, call loadReportedUsers
		 */
		async handleLoadingReported() {
			await this.loadReportedUsers();

			window.setTimeout(() => {
				this.handleLoadingReported();
			}, 15000);
		}

		/**
		 * Load notifications from Wikipedia
		 */
		async loadNotifications() {
			try {
				// Fetch both Echo notifications (alerts and notices) and talk page edits
				const [alertsResponse, noticesResponse, talkResponse] = await Promise.all([
					// Get Echo alert notifications (mentions, thanks, page links, etc.)
					this.api.api.get({
						action: "query",
						meta: "notifications",
						notlimit: 20,
						notprop: "list",
						notfilter: "!read",
						notsections: "alert"
					}),
					// Get Echo notice notifications (user rights, thanks, etc.)
					this.api.api.get({
						action: "query",
						meta: "notifications",
						notlimit: 20,
						notprop: "list",
						notfilter: "!read",
						notsections: "message"
					}),
					// Get talk page edits
					this.api.api.get({
						action: "query",
						prop: "revisions",
						titles: `User talk:${this.username}`,
						rvlimit: 10,
						rvprop: "timestamp|user|comment|ids",
						rvdir: "older"
					})
				]);

				const notifications = [];

				// Process Echo alert notifications
				if (alertsResponse.query?.notifications?.list) {
					const alertList = Object.values(alertsResponse.query.notifications.list);
					for (const notif of alertList) {
						// MediaWiki timestamps are in format: YYYYMMDDHHMMSS
						let timestamp = notif.timestamp?.mw || notif.timestamp?.utcmw;
						if (timestamp && typeof timestamp === 'string' && timestamp.length === 14) {
							// Convert YYYYMMDDHHMMSS to ISO format
							timestamp = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`;
						} else {
							timestamp = new Date().toISOString();
						}

						// Get notification type display name
						let categoryLabel = "Alert";

						if (notif.type === "mention" || notif.type === "mention-success") {
							categoryLabel = "Mention";
						} else if (notif.type === "thank-you-edit") {
							categoryLabel = "Thanks";
						} else if (notif.type === "page-linked") {
							categoryLabel = "Page Link";
						} else if (notif.type === "reverted") {
							categoryLabel = "Revert";
						} else if (notif.type === "edit-user-talk") {
							categoryLabel = "Talk";
						}

						notifications.push({
							id: `alert-${notif.id}`,
							type: "alert",
							subtype: notif.type,
							timestamp: timestamp,
							title: notif.title?.full || "Unknown page",
							agent: notif.agent?.name || "Someone",
							category: categoryLabel,
							read: false
						});
					}
				}

				// Process Echo notice notifications
				if (noticesResponse.query?.notifications?.list) {
					const noticeList = Object.values(noticesResponse.query.notifications.list);
					for (const notif of noticeList) {
						// MediaWiki timestamps are in format: YYYYMMDDHHMMSS
						let timestamp = notif.timestamp?.mw || notif.timestamp?.utcmw;
						if (timestamp && typeof timestamp === 'string' && timestamp.length === 14) {
							// Convert YYYYMMDDHHMMSS to ISO format
							timestamp = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`;
						} else {
							timestamp = new Date().toISOString();
						}

						let categoryLabel = "Notice";

						if (notif.type === "user-rights") {
							categoryLabel = "User Rights";
						} else if (notif.type === "emailuser") {
							categoryLabel = "Email";
						}

						notifications.push({
							id: `notice-${notif.id}`,
							type: "notice",
							subtype: notif.type,
							timestamp: timestamp,
							title: notif.title?.full || "Notification",
							agent: notif.agent?.name || "System",
							category: categoryLabel,
							read: false
						});
					}
				}

				// Process talk page edits
				const pages = talkResponse.query?.pages;
				if (pages) {
					const page = Object.values(pages)[0];
					const revisions = page.revisions || [];

					// Check if we have stored the last seen revision
					if (!this.lastSeenRevision) {
						// First load - just store the latest revision
						if (revisions.length > 0) {
							this.lastSeenRevision = revisions[0].revid;
						}
					} else {
						// Find new revisions since last check
						for (const rev of revisions) {
							if (rev.revid > this.lastSeenRevision) {
								// Skip self-edits
								if (rev.user !== this.username) {
									notifications.push({
										id: `talk-${rev.revid}`,
										type: "talk",
										revid: rev.revid,
										user: rev.user,
										comment: rev.comment || "Edit to your talk page",
										timestamp: rev.timestamp,
										read: false
									});
								}
							} else {
								break;
							}
						}

						// Update last seen revision
						if (revisions.length > 0) {
							this.lastSeenRevision = Math.max(this.lastSeenRevision, revisions[0].revid);
						}
					}
				}

				// Merge with existing notifications and remove duplicates
				let hasNewNotifications = false;
				for (const newNotif of notifications) {
					const existingNotif = this.notifications.find(n => n.id === newNotif.id);
					if (!existingNotif) {
						this.notifications.unshift(newNotif);
						hasNewNotifications = true;
					}
				}

				// Play sound if there are new notifications
				if (hasNewNotifications && this.notifications.length > 0) {
					wikishield.queue.playNotificationSound();
				}

				// Sort by timestamp
				this.notifications.sort((a, b) => {
					const timeA = new Date(a.timestamp);
					const timeB = new Date(b.timestamp);
					return timeB - timeA;
				});

				// Keep only last 25 notifications
				if (this.notifications.length > 25) {
					this.notifications = this.notifications.slice(0, 25);
				}

				this.updateNotificationDisplay();
			} catch (err) {
				console.log("Error while fetching notifications", err);
			}
		}

		/**
		 * Every 10 seconds, call loadNotifications
		 */
		async handleLoadingNotifications() {
			await this.loadNotifications();

			window.setTimeout(() => {
				this.handleLoadingNotifications();
			}, 10000);
		}

		/**
		 * Update the notification count and list display
		 */
		updateNotificationDisplay() {
			const unreadCount = this.notifications.filter(n => !n.read).length;
			const countElem = document.querySelector("#notification-count");
			const listElem = document.querySelector("#notifications-list");

			// Check if elements exist (UI might not be ready yet)
			if (!countElem || !listElem) {
				return;
			}

			if (unreadCount > 0) {
				countElem.textContent = unreadCount > 9 ? "9+" : unreadCount;
				countElem.style.display = "block";
			} else {
				countElem.style.display = "none";
			}

			// Update list
			if (listElem) {
				if (this.notifications.length === 0) {
					listElem.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No new notifications</div>';
				} else {
					listElem.innerHTML = this.notifications.map(notif => {
						// Parse timestamp
						const time = new Date(notif.timestamp);
						const timeStr = this.formatNotificationTime(time);

						let title, subtitle, typeLabel, clickData;

						if (notif.type === "alert") {
							// Echo alert notification (mentions, thanks, page links, etc.)
							typeLabel = notif.category || "Alert";
							if (notif.subtype === "mention" || notif.subtype === "mention-success") {
								title = `${notif.agent} mentioned you`;
								subtitle = `on ${notif.title}`;
							} else if (notif.subtype === "thank-you-edit") {
								title = `${notif.agent} thanked you`;
								subtitle = `for your edit on ${notif.title}`;
							} else if (notif.subtype === "page-linked") {
								title = `Your page was linked`;
								subtitle = `from ${notif.title}`;
							} else if (notif.subtype === "reverted") {
								title = `${notif.agent} reverted your edit`;
								subtitle = `on ${notif.title}`;
							} else if (notif.subtype === "edit-user-talk") {
								title = `${notif.agent} edited your talk page`;
								subtitle = notif.title;
							} else if (notif.subtype === "emailuser") {
								title = `${notif.agent} sent you an email`;
								subtitle = notif.title;
							} else if (notif.subtype === "foreign") {
								title = `Alert from ${notif.agent}`;
								subtitle = notif.title;
							} else {
								// Generic alert with more context
								title = `Alert: ${notif.subtype || 'notification'}`;
								subtitle = `${notif.agent} - ${notif.title}`;
							}
							clickData = `data-page="${this.escapeHtml(notif.title)}"`;
						} else if (notif.type === "notice") {
							// Echo notice notification (user rights, etc.)
							typeLabel = notif.category || "Notice";
							if (notif.subtype === "user-rights") {
								title = `Your user rights were changed`;
								subtitle = notif.title;
							} else if (notif.subtype === "emailuser") {
								title = `Email notification`;
								subtitle = notif.title;
							} else if (notif.subtype === "flow-discussion") {
								title = `New discussion activity`;
								subtitle = notif.title;
							} else {
								// Generic notice with more context
								title = `Notice: ${notif.subtype || 'system notification'}`;
								subtitle = `${notif.agent} - ${notif.title}`;
							}
							clickData = `data-page="${this.escapeHtml(notif.title)}"`;
						} else {
							// Talk page edit notification
							typeLabel = "Talk Page";
							title = `${notif.user} edited your talk page`;
							subtitle = notif.comment || "No edit summary";
							clickData = `data-revid="${notif.revid}"`;
						}

						const readClass = notif.read ? "" : "unread";

						return `
							<div class="notification-item ${readClass}" data-notif-id="${notif.id}" data-notif-type="${notif.type}" ${clickData}>
								<div class="notification-header">
									<span class="notification-type">${typeLabel}</span>
									<span class="notification-time">${timeStr}</span>
								</div>
								<div class="notification-title">${this.escapeHtml(title)}</div>
								${subtitle ? `<div class="notification-subtitle">${this.escapeHtml(subtitle)}</div>` : ''}
							</div>
						`;
					}).join("");

					// Add click handlers
					listElem.querySelectorAll(".notification-item").forEach(item => {
						item.addEventListener("click", () => {
							const notifId = item.dataset.notifId;
							const notifType = item.dataset.notifType;

							this.markNotificationRead(notifId);

							if (notifType === "alert" || notifType === "notice") {
								// Open the page for Echo notifications
								const page = item.dataset.page;
								if (page) {
									window.open(mw.util.getUrl(page), "_blank");
								}
							} else {
								// Open the diff for talk page edit
								const revid = item.dataset.revid;
								if (revid) {
									window.open(mw.util.getUrl(`Special:Diff/${revid}`), "_blank");
								}
							}
						});
					});
				}
			}
		}

		/**
		 * Add a local notification (not from Wikipedia API)
		 */
		addLocalNotification(config) {
			const notification = {
				id: `local-${Date.now()}-${Math.random()}`,
				type: config.type || "info",
				title: config.title || "Notification",
				subtitle: config.subtitle || "",
				page: config.page || "",
				timestamp: new Date().toISOString(),
				read: false
			};

			this.notifications.unshift(notification);
			this.updateNotificationDisplay();
		}

		/**
		 * Escape HTML to prevent XSS
		 */
		escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}

		/**
		 * Format notification timestamp as relative time
		 */
		formatNotificationTime(date) {
			const now = new Date();
			const diff = Math.floor((now - date) / 1000); // seconds

			// Handle future timestamps (clock skew)
			if (diff < 0) return "Just now";

			if (diff < 60) return "Just now";
			if (diff < 3600) {
				const mins = Math.floor(diff / 60);
				return `${mins} min${mins !== 1 ? 's' : ''} ago`;
			}
			if (diff < 86400) {
				const hours = Math.floor(diff / 3600);
				return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
			}
			if (diff < 604800) {
				const days = Math.floor(diff / 86400);
				return `${days} day${days !== 1 ? 's' : ''} ago`;
			}
			return date.toLocaleDateString();
		}

		formatNotificationTimeShort(date) {
			const now = new Date();
			const diff = Math.floor((now - date) / 1000); // seconds

			// Handle future timestamps (clock skew)
			if (diff < 0) return "Now";

			if (diff < 60) return "Now";
			if (diff < 3600) {
				const mins = Math.floor(diff / 60);
				return `${mins}m`;
			}
			if (diff < 86400) {
				const hours = Math.floor(diff / 3600);
				return `${hours}h`;
			}
			if (diff < 604800) {
				const days = Math.floor(diff / 86400);
				return `${days}d`;
			}
			return date.toLocaleDateString();
		}

		/**
		 * Mark a notification as read
		 */
		markNotificationRead(notifId) {
			const notif = this.notifications.find(n => n.id === notifId);
			if (notif) {
				notif.read = true;
			}
			this.updateNotificationDisplay();
		}

		/**
		 * Mark all notifications as read
		 */
		markAllNotificationsRead() {
			this.notifications.forEach(n => n.read = true);
			this.updateNotificationDisplay();
		}

		/**
		 * Check if a user is reported to AIV
		 * @param {String} name The username to check
		 * @param {Boolean} recheck Whether to recheck the reports
		 * @returns {Promise<Boolean>} Whether the user is reported to AIV
		 */
		async userReportedToAiv(name, recheck = true) {
			if (recheck) {
				await this.loadReportedUsers();
			}

			return this.aivReports.some((report) => report.toLowerCase() === name.toLowerCase());
		}

		/**
		 * Check if a user is reported to UAA
		 * @param {String} name The username to check
		 * @param {Boolean} recheck Whether to recheck the reports
		 * @returns {Promise<Boolean>} Whether the user is reported to UAA
		 */
		async userReportedToUaa(name, recheck = true) {
			if (recheck) {
				await this.loadReportedUsers();
			}

			return this.uaaReports.some((report) => report.toLowerCase() === name.toLowerCase());
		}

		/**
		 * Give a user a welcome template, if not already given
		 * @param {String} name The user to welcome
		 * @param {String} template Which welcome template to use
		 */
		async welcomeUser(name, template) {
			try {
				const talkPageName = `User talk:${name}`;
				const talkPageContent = await this.api.getSinglePageContent(talkPageName);

				if (await this.api.pageExists(talkPageName)) {
					return;
				}

				await this.api.edit(
					talkPageName,
					talkPageContent + `\n${wikishieldEventData.welcomeTemplates[template]}`,
					"Welcome to Wikipedia! ([[WP:WikiShield|WS]])"
				);

				// Increment welcome statistic
				this.statistics.welcomes++;
				this.saveStats(this.statistics);

				// Update all edits from this user to reflect that the talk page is no longer empty
				// Update tempCurrentEdit if it exists (during script execution)
				if (this.tempCurrentEdit && this.tempCurrentEdit.user && this.tempCurrentEdit.user.name === name) {
					this.tempCurrentEdit.user.emptyTalkPage = false;
				}

				// Update currentEdit
				if (this.queue.currentEdit && this.queue.currentEdit.user.name === name) {
					this.queue.currentEdit.user.emptyTalkPage = false;
				}

				// Update all edits in the queue from this user
				this.queue.queue.forEach(edit => {
					if (edit.user && edit.user.name === name) {
						edit.user.emptyTalkPage = false;
						// Remove the existing DOM element so it gets re-rendered
						const elem = document.querySelector(`.queue-edit[data-revid="${edit.revid}"]`);
						if (elem) {
							elem.remove();
						}
					}
				});

				// Re-render the queue to update the display
				this.interface.renderQueue(this.queue.queue, this.queue.currentEdit);
			} catch (err) {
				console.log("Error while welcoming user", err);
			}
		}

		/**
		 * Check if protection has already been requested at RFPP
		 * @param {String} title Page to check
		 * @returns {Promise<Boolean>} Whether there is an existing request
		 */
		async checkIfProtectionRequested(title) {
			const rfppContent = await this.api.getSinglePageContent(__script__.pages.RFPP);
			const pageRegex = new RegExp(`= ?${RegExp.escape(title)} ?=`, "i");

			return rfppContent.match(pageRegex) !== null;
		}

		/**
		 * Add a new request for protection at RFPP
		 * @param {String} title Page to request protection for
		 * @param {String} level Semi, pending, extended, full
		 * @param {String} reason Reason for requesting protection
		 */
		async requestProtection(title, level, reason) {
			if (await this.checkIfProtectionRequested(title)) {
				return false;
			}

			await this.api.appendText(__script__.pages.RFPP, `
				=== [[${title}]] ===
				* {{pagelinks|${title}}}
				'''${level}''': ${reason} ~~~~
			`.replaceAll("\t", ""), `Requesting protection for [[${title}]] ([[WP:WikiShield|WS]])`);

			this.statistics.reports++;
			this.saveStats(this.statistics);
		}

		/**
		 * Report a user to AIV
		 * @param {String} name The username to report
		 * @param {String} message The message to use in the report
		 */
		async reportToAIV(user, message) {
			const blocked = await this.api.usersBlocked(user);

			if (blocked[user]) {
				return;
			}

			if (await this.userReportedToAiv(user)) {
				return;
			}

			const content = `* {{vandal|${user}}} &ndash; ${message} ~~~~`;

			await this.api.appendText(
				__script__.pages.AVI,
				content,
				`Reporting [[Special:Contributions/${user}|${user}]] ([[WP:WikiShield|WS]])`
			);

			this.statistics.reports++;
			this.saveStats(this.statistics);
		}

		/**
		 * Report a user to UAA
		 * @param {String} name The username to report
		 * @param {String} message The message to use in the report
		 */
		async reportToUAA(user, message) {
			const blocked = await this.api.usersBlocked(user);

			if (blocked[user]) {
				// already blocked
				return;
			}

			if (await this.userReportedToUaa(user)) {
				// already reported
				return;
			}

			const content = `* {{user-uaa|${user}}} &ndash; ${message} ~~~~`;

			await this.api.appendText(
				__script__.pages.UAA,
				content,
				`Reporting [[Special:Contributions/${user}|${user}]] ([[WP:WikiShield|WS]])`
			);

			// Add user to no-auto-welcome list since they were reported to UAA
			this.noAutoWelcomeList.add(user);

			this.statistics.reports++;
			this.saveStats(this.statistics);
		}

		/**
		 * Handle a keypress
		 * @param {KeyboardEvent} event The keypress event
		 */
		keyPressed(event) {
			if (this.interface.settings.isOpen) {
				this.interface.settings.handleKeypress(event);
				return;
			}

			if (document.activeElement.tagName.toLowerCase() === "input") {
				return;
			}

			if (event.ctrlKey || event.altKey || event.metaKey) {
				return;
			}

			if (event.key === " " && event.target === document.body) {
				event.preventDefault();
			}

			if (!this.tempCurrentEdit) {
				for (const script of this.options.controlScripts) {
					if (script.keys.includes(event.key.toLowerCase())) {
						this.executeScript(script);
					}
				}
			}
		}

		/**
		 * Execute a control script
		 * @param {Object} script
		 */
		async executeScript(script, hasContinuity = true, updateProgress = null) {
			const base = updateProgress === null;

			if (base && this.tempCurrentEdit) {
				return;
			}

			if (base) {
				const allScripts = [script];
				let totalActions = 0;

				while (allScripts.length > 0) {
					const current = allScripts[0];
					const willBeRun = (current.name && current.name === "if"
						&& wikishieldEventData.conditions[current.condition].check(this.queue.currentEdit)) || !current.name;

					if (willBeRun) {
						allScripts.push(...current.actions);
					}

					if (current.name && current.name !== "if"
						&& this.interface.eventManager.events[current.name].includeInProgress) {
						totalActions++;
					}

					allScripts.splice(0, 1);
				}

				if (totalActions > 0) {
					let actionsCompleted = 0;
					const progressBar = new WikiShieldProgressBar();

					updateProgress = (text) => {
						const portion = text === "Done" ? 1 : actionsCompleted / totalActions;
						progressBar.set(text, portion, "var(--main-blue)");
						actionsCompleted++;
					};
				} else {
					updateProgress = (_) => { };
				}

				this.tempCurrentEdit = this.queue.currentEdit || 1;
			}

			const ifAndTrue = script.name && script.name === "if"
				&& wikishieldEventData.conditions[script.condition].check(this.tempCurrentEdit);

			if (script.name === "if") {
				console.log(`[executeScript] Evaluating condition: ${script.condition}, Result: ${ifAndTrue}`);
			}

			if (ifAndTrue || !script.name) {
				for (const action of script.actions) {
					if (action.name === "if") {
						hasContinuity = this.executeScript(action, hasContinuity, updateProgress);
					} else {
						const event = this.interface.eventManager.events[action.name];


						if (hasContinuity || !event.needsContinuity) {
							if (event.includeInProgress) {
								updateProgress(event.progressDesc);
							}

							if (this.tempCurrentEdit !== 1 || event.runWithoutEdit) {
								const result = await event.func(action.params);

								if (result === false) {
									hasContinuity = false;
								}
							}
						}
					}
				}
			}

			if (!script.name) {
				updateProgress("Done");
			}

			if (base) {
				this.tempCurrentEdit = null;
			}

			return hasContinuity;
		}
	}

	let wikishield;

	if (mw.config.get("wgRelevantPageName") === "Wikipedia:WikiShield/run" && mw.config.get("wgAction") === "view") {
		wikishield = new WikiShield();
		wikishield.startInterface();

		window.addEventListener("keydown", wikishield.keyPressed.bind(wikishield));
	} else {
		mw.util.addPortletLink(
			'p-personal',
			mw.util.getUrl('Wikipedia:WikiShield/run'),
			'🛡️ WikiShield',
			'pt-wikishield',
			'wikishield',
			null,
			'#pt-preferences'
		);

		// add link to sticky header for Vector2022
		mw.util.addPortletLink(
			'p-personal-sticky-header',
			mw.util.getUrl('Wikipedia:WikiShield/run'),
			'🛡️ WikiShield',
			'pt-wikishield',
			'WikiShield',
			null,
			'#pt-preferences'
		);
	}
}

// </nowiki>