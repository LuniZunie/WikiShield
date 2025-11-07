// AI prompt building functions for edit and username analysis
import { fullTrim } from '../utils/formatting.js';

/**
 * Generate prompt for edit analysis
 * @param {Object} edit The edit object to analyze
 * @returns {String} The prompt for analysis
 */
export const BuildAIAnalysisPrompt = (edit) => {
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
export const BuildAIUsernamePrompt = (username, pageTitle) => {
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

