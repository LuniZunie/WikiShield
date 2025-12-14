const any = "\\*#\\-";
const a = `[${any}a4]`;
const b = `[${any}b6]`;
const c = `[${any}ck]`;
const d = `[${any}d6]`;
const e = `[${any}e3]`;
const f = `[${any}f]`;
const g = `[${any}g9]`;
const h = `[${any}h]`;
const i = `[${any}i1y]`;
const j = `[${any}j]`;
const k = `[${any}k]`;
const l = `[${any}l1]`;
const m = `[${any}m]`;
const n = `[${any}n]`;
const o = `[${any}o0]`;
const p = `[${any}p9]`;
const q = `[${any}q9]`;
const r = `[${any}r]`;
const s = `[${any}sz526]`;
const t = `[${any}t7]`;
const u = `[${any}uv]`;
const v = `[${any}vu]`;
const w = `[${any}w]`;
const x = `[${any}x]`;
const y = `[${any}y]`;
const z = `[${any}zs25]`;
const zero = `[${any}0]`;
const one = `[${any}1]`;
const two = `[${any}2]`;
const three = `[${any}3]`;
const four = `[${any}4]`;
const five = `[${any}5]`;
const six = `[${any}6]`;
const seven = `[${any}7]`;
const eight = `[${any}8]`;
const nine = `[${any}9]`;

const _ = {
    a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z,
    0: zero, 1: one, 2: two, 3: three, 4: four, 5: five, 6: six, 7: seven, 8: eight, 9: nine
};

const or = (...patterns) => new RegExp(patterns.map(p => p.source).join("|"));

class Profanity {
    // Severity levels:
    // 0.1 = minimal (context-dependent, rarely offensive)
    // 0.3 = low (mild, slang)
    // 0.5 = moderate (profanity, should be moderated)
    // 0.7 = high (offensive slurs, explicit content)
    // 1.0 = critical (hate speech, extreme violence, illegal content)
    static hits = [
        {
            name: "URL",
            regex: /(?:https?:\/\/(?:www\.)?[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*(?:\/[^\s]*)?|(?:www\.)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?:\/[^\s]*)?|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(?:com|org|net|edu|gov|mil|int|co|io|ai|app|dev|info|biz|name|pro|museum|aero|coop|jobs|mobi|travel|xxx|ac|ad|ae|af|ag|al|am|ao|aq|ar|as|at|au|aw|ax|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|cr|cu|cv|cw|cx|cy|cz|de|dj|dk|dm|do|dz|ec|ee|eg|er|es|et|eu|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|me|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|rs|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|sk|sl|sm|sn|so|sr|ss|st|su|sv|sx|sy|sz|tc|td|tf|tg|th|tj|tk|tl|tm|tn|to|tr|tt|tv|tw|tz|ua|ug|uk|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|za|zm|zw)(?:\/[^\s]*)?)/i,
            severity: 0.1,
            note: "URLs in usernames may indicate spam or advertising."
        },
        {
            name: "Phone number",
            regex: /(\+?\d{1,3}[-.\s]?|\(\+?\d{1,3}\)\s?)?(\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{4}[-.\s]?\d{3}[-.\s]?\d{3})/,
            severity: 0.3,
            note: "The pattern of numbers in this username resemble a phone number. Usernames containing personal information may be considered disruptive."
        },
        {
            name: "Email address",
            regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
            severity: 0.3,
            note: "Email addresses in usernames can indicate spam or contact sharing."
        },
        {
            term: "base64",
            severity: 0.2,
            note: "Base64 encoding may be used to obfuscate content to bypass filters."
        },
        {
            term: "fromhex",
            severity: 0.2,
            note: "Hex encoding may be used to obfuscate content to bypass filters."
        },
        {
            term: "1488",
            severity: 0.5,
            note: "Well-known Neo-Nazi symbol, however the number itself can appear in innocent contexts."
        },
        { term: "nazi", severity: 1.0 },
        {
            term: "swastika",
            severity: 0.8,
            note: "Symbol often associated with Nazism, however it has historical significance in other cultures."
        },
        {
            term: "卍",
            severity: 0.8,
            note: "Symbol often associated with Nazism, however it has historical significance in other cultures."
        },
        {
            term: "卐",
            severity: 0.8,
            note: "Symbol often associated with Nazism, however it has historical significance in other cultures."
        },
        {
            term: "࿕",
            severity: 0.8,
            note: "Symbol often associated with Nazism, however it has historical significance in other cultures."
        },
        {
            term: "࿖",
            severity: 0.8,
            note: "Symbol often associated with Nazism, however it has historical significance in other cultures."
        },
        {
            term: "࿗",
            severity: 0.8,
            note: "Symbol often associated with Nazism, however it has historical significance in other cultures."
        },
        {
            term: "࿘",
            severity: 0.8,
            note: "Symbol often associated with Nazism, however it has historical significance in other cultures."
        },
        {
            term: "aryan",
            severity: 0.7,
            note: "Associated with white supremacist ideology, though it can also be in reference to the self-designation of Indo-Iranian peoples."
        },
        { term: "fascism", severity: 0.5 },
        { term: "fascist", severity: 0.5 },
        { term: "facist", severity: 0.5 },
        {
            term: "☭",
            severity: 0.5,
            note: "Hammer and sickle symbol, politically charged but context-dependent."
        },
        {
            term: "✡",
            severity: 0.4,
            note: "Star of David, can be used respectfully or in antisemitic contexts."
        },
        {
            term: "44",
            severity: 0.1,
            note: "Obfuscated symbol of the Nazi SS division. If appears as 'ᛋᛋ' or similar, indicates intent to reference the SS."
        },
        {
            term: "imbo wales",
            severity: 0.2,
            multiWord: true,
            note: "Play on 'Jimbo Wales' name, may indicate mockery or impersonation."
        },
        {
            term: "sock",
            severity: 0.3,
            note: "May reference sockpuppet accounts but has innocent meanings."
        },
        {
            term: "puppet",
            severity: 0.3,
            note: "May reference sockpuppet accounts but has innocent meanings."
        },
        {
            term: "sock puppet",
            severity: 0.6,
            multiWord: true,
            note: "Often used in usernames by sockpuppeteers."
        },
        {
            term: "return",
            severity: 0.2,
            note: "Often used in usernames by sockpuppeteers."
        },
        {
            term: "is back",
            severity: 0.6,
            multiWord: true,
            note: "Often used in usernames by sockpuppeteers."
        },
        {
            term: "are back",
            severity: 0.6,
            multiWord: true,
            note: "Often used in usernames by sockpuppeteers."
        },
        {
            term: "timelash",
            severity: 1,
            note: "Well-known sockpuppeteer (\"Timelash\") on Wikipedia."
        },
        {
            term: "my little",
            severity: 0.8,
            multiWord: true,
            note: "If related to 'my little pony', indicates sockpuppeteer."
        },
        {
            term: "my little pony",
            severity: 1,
            multiWord: true,
            note: "Well-known sockpuppeteer on Wikipedia."
        },
        {
            term: "friendship is magic",
            severity: 1,
            multiWord: true,
            note: "Well-known sockpuppeteer on Wikipedia."
        },
        { term: "ass", severity: 0.6, ignore: [ "456" ] },
        { term: "arse", severity: 0.6 },
        { term: "anal", severity: 0.7 },
        { term: "anus", severity: 0.5 },
        { term: "sex", severity: 0.3 },
        {
            term: "secs",
            severity: 0.05,
            note: "Obfuscated form of 'sex'."
        },
        {
            term: "willy",
            severity: 0.2,
            note: "Slang for penis."
        },
        {
            term: "wank",
            severity: 0.6,
            note: "British sexual slang for masturbation."
        },
        {
            term: "ball",
            severity: 0.1,
            note: "Common word with mild innuendo potential."
        },
        { term: "balls", severity: 0.2 },
        { term: "barf", severity: 0.3 },
        { term: "bastard", severity: 0.5 },
        {
            term: "batty boy",
            severity: 0.7,
            multiWord: true,
            note: "Homophobic slur in British/Caribbean English."
        },
        {
            name: "bitch",
            regex: new RegExp(`${b+i}(${o}|${a})?${t}?${c+h}`),
            severity: 0.7
        },
        {
            term: "blow job",
            severity: 0.8,
            multiWord: true
        },
        {
            term: "blowing",
            severity: 0.2,
            note: "Sexual innuendo but common verb."
        },
        { term: "boner", severity: 0.4 },
        { term: "boob", severity: 0.4 },
        { term: "booty", severity: 0.3 },
        {
            term: "breast",
            severity: 0.4,
            note: "Anatomical term, but can be used inappropriately."
        },
        { term: "butt", severity: 0.2 },
        {
            term: "bite me",
            severity: 0.5,
            multiWord: true,
            note: "Often has defiant or provocative connotation."
        },
        {
            term: "butt plug",
            severity: 0.7,
            multiWord: true
        },
        {
            term: "bollock",
            severity: 0.5,
            note: "British slang for testicles."
        },
        {
            term: "bollox",
            severity: 0.5,
            note: "Variant spelling of 'bollocks'."
        },
        {
            term: "bollix",
            severity: 0.5,
            note: "Variant spelling of 'bollocks'."
        },
        { term: "clit", severity: 0.7 },
        { term: "cock", severity: 0.7 },
        { term: "cum", severity: 0.7 },
        {
            term: "brain dead",
            severity: 0.5,
            multiWord: true,
            note: "Derogatory medical reference."
        },
        { term: "bukake", severity: 0.7 },
        {
            term: "bully",
            severity: 0.5,
            note: "Indicates harassment behavior."
        },
        {
            term: "bullies",
            severity: 0.5,
            note: "Indicates harassment behavior."
        },
        {
            term: "bullied",
            severity: 0.3,
            note: "May indicate victimhood or boasting."
        },
        {
            term: "versus",
            severity: 0.4,
            note: "Combat/conflict framing, but legitimate word."
        },
        {
            term: "bumming",
            severity: 0.5,
            note: "British slang for anal sex or begging."
        },
        { term: "bunghole", severity: 0.5 },
        {
            term: "cesspool",
            severity: 0.3,
            note: "Derogatory term for filthy place."
        },
        {
            term: "cesspit",
            severity: 0.3,
            note: "Variant of cesspool."
        },
        { term: "dick", severity: 0.7 },
        { term: "prick", severity: 0.7 },
        { term: "dildo", severity: 0.7 },
        {
            term: "censor",
            severity: 0.1,
            note: "May indicate anti-censorship stance."
        },
        {
            term: "ching",
            severity: 0.8,
            note: "Part of racial slur against Asians."
        },
        {
            term: "ching chong",
            severity: 0.9,
            multiWord: true,
            note: "Racist mockery of Asian languages."
        },
        {
            term: "ching chang",
            severity: 0.9,
            multiWord: true,
            note: "Racist mockery of Asian languages."
        },
        {
            term: "wing wong",
            severity: 0.9,
            multiWord: true,
            note: "Racist mockery of Asian languages."
        },
        {
            term: "bot",
            severity: 0.4,
            note: "May indicate automated account claim."
        },
        {
            term: "ox long",
            severity: 0.5,
            multiWord: true,
            note: "Phonetic sexual innuendo for 'cock's long'."
        },
        { term: "douche", severity: 0.5 },
        {
            term: "cornhol",
            severity: 0.7,
            note: "Vulgar sexual term, variant of 'cornhole'."
        },
        { term: "cunt", severity: 0.7 },
        {
            term: "cvnt",
            severity: 0.7,
            note: "Obfuscated 'cunt'."
        },
        {
            term: "cuck",
            severity: 0.4,
            note: "Derogatory term from manosphere."
        },
        {
            term: "curry munch",
            severity: 0.9,
            multiWord: true,
            note: "Racist slur against South Asians."
        },
        {
            term: "constipat",
            severity: 0.2,
            note: "Medical term stem, crude context."
        },
        {
            term: "crime",
            severity: 0.3,
            note: "Negative connotation but legitimate word."
        },
        { term: "pussy", severity: 0.7 },
        {
            term: "deeznuts",
            severity: 0.3,
            note: "Crude joke phrase."
        },
        {
            term: "die",
            severity: 0.5,
            note: "Violent/threatening language, but legitimate word."
        },
        {
            term: "destroy",
            severity: 0.3,
            note: "Aggressive language."
        },
        {
            term: "destruction",
            severity: 0.3,
            note: "Aggressive language."
        },
        {
            term: "diaper",
            severity: 0.3,
            note: "Infantilization or fetish reference."
        },
        { term: "diarrhea", severity: 0.3 },
        {
            term: "throbbing",
            severity: 0.5,
            note: "Sexual innuendo term."
        },
        { term: "dimwit", severity: 0.3 },
        {
            term: "doo doo",
            severity: 0.3,
            multiWord: true
        },
        { term: "dookie", severity: 0.3 },
        { term: "fart", severity: 0.3 },
        { term: "ejaculat", severity: 0.7 },
        {
            term: "erect",
            severity: 0.5,
            note: "Sexual context or legitimate word."
        },
        { term: "erotic", severity: 0.5 },
        { term: "fuck", severity: 0.8 },
        {
            term: "fuk",
            severity: 0.8,
            note: "Phonetic spelling to evade filters."
        },
        {
            term: "fuc",
            severity: 0.8,
            note: "Shortened version to evade filters."
        },
        {
            term: "phuck",
            severity: 0.8,
            note: "Alternative spelling to bypass detection."
        },
        { term: "orgasm", severity: 0.7 },
        { term: "rape", severity: 1.0 },
        {
            term: "lawsuit",
            severity: 0.3,
            note: "Legal threat implication."
        },
        {
            term: "fraud",
            severity: 0.5,
            note: "Accusation of criminal behavior."
        },
        {
            term: "tard",
            severity: 0.5,
            note: "Ableist slur suffix."
        },
        {
            term: "terror",
            severity: 0.7,
            note: "Violence/terrorism reference."
        },
        {
            term: "mike hunt",
            severity: 0.5,
            multiWord: true,
            note: "Phonetic sexual innuendo for 'my cunt'."
        },
        {
            term: "mike ox",
            severity: 0.5,
            multiWord: true,
            note: "Phonetic sexual innuendo for 'my cock's'."
        },
        { term: "masturbat", severity: 0.7 },
        { term: "nutsack", severity: 0.5 },
        {
            term: "ophile",
            severity: 1.0,
            note: "Suffix for sexual predator terms like pedophile."
        },
        { term: "peeing", severity: 0.3 },
        {
            term: "peanus",
            severity: 0.5,
            note: "Intentional misspelling of 'penis'."
        },
        {
            term: "penis",
            severity: 0.5,
            note: "Anatomical term, inappropriate in usernames."
        },
        { term: "porn", severity: 0.7 },
        { term: "piss", severity: 0.5 },
        { term: "poop", severity: 0.3 },
        {
            term: "prison",
            severity: 0.3,
            note: "Criminal context, but legitimate word."
        },
        {
            term: "prostitute",
            severity: 0.5,
            note: "Sexual work reference or insult."
        },
        {
            term: "queer",
            severity: 0.5,
            note: "Can be slur or reclaimed identity."
        },
        {
            term: "rectum",
            severity: 0.3,
            note: "Anatomical term."
        },
        {
            term: "report me",
            severity: 0.3,
            multiWord: true,
            note: "Defiant/trolling phrase."
        },
        { term: "rimming", severity: 0.7 },
        {
            term: "scrotum",
            severity: 0.5,
            note: "Anatomical term, inappropriate in usernames."
        },
        { term: "semen", severity: 0.7 },
        { term: "slut", severity: 0.7 },
        {
            term: "sucks",
            severity: 0.3,
            note: "Mild profanity or legitimate verb."
        },
        {
            term: "sux",
            severity: 0.3,
            note: "Intentional misspelling of 'sucks'."
        },
        {
            term: "swallow",
            severity: 0.5,
            note: "Sexual innuendo or legitimate word."
        },
        { term: "tit", severity: 0.5 },
        {
            term: "vagina",
            severity: 0.5,
            note: "Anatomical term, inappropriate in usernames."
        },
        {
            term: "vadge",
            severity: 0.5,
            note: "Slang for vagina."
        },
        { term: "vomit", severity: 0.3 },
        {
            term: "vulva",
            severity: 0.5,
            note: "Anatomical term, inappropriate in usernames."
        },
        { term: "whore", severity: 0.7 },
        { term: "chink", severity: 1.0 },
        {
            term: "jew",
            severity: 0.3,
            note: "Legitimate religious/ethnic term but tracked for antisemitic usage patterns."
        },
        { term: "nigger", severity: 1.0 },
        { term: "nigga", severity: 1.0 },
        {
            term: "nigguh",
            severity: 1.0,
            note: "Phonetic spelling of racial slur."
        },
        { term: "niglet", severity: 1.0 },
        {
            term: "pajeet",
            severity: 0.7,
            note: "Derogatory term for South Asians."
        },
        {
            term: "slave",
            severity: 0.6,
            note: "Dehumanizing term with historical trauma, but legitimate historical uses."
        },
        {
            term: "master race",
            severity: 1.0,
            multiWord: true,
            note: "Nazi supremacist ideology phrase."
        },
        {
            term: "inferior race",
            severity: 1.0,
            multiWord: true
        },
        {
            term: "superior race",
            severity: 1.0,
            multiWord: true,
            note: "White supremacist ideology."
        },
        { term: "racist", severity: 0.8 },
        { term: "racism", severity: 0.7 },
        {
            term: "racial",
            severity: 0.3,
            note: "Neutral term but tracked for context in discriminatory language."
        },
        { term: "bigot", severity: 0.7 },
        { term: "fag", severity: 0.7 },
        {
            term: "taliban",
            severity: 0.7,
            note: "Terrorist organization reference."
        },
        {
            term: "isis",
            severity: 0.7,
            note: "Terrorist organization reference, though also Egyptian goddess."
        },
        { term: "antisemit", severity: 1.0 },
        {
            term: "bleed",
            severity: 0.3,
            note: "Can indicate violence or be medical."
        },
        {
            term: "bloody",
            severity: 0.3,
            note: "British profanity or literal blood reference."
        },
        {
            term: "hell",
            severity: 0.5,
            note: "Religious reference used as mild profanity, but legitimate uses."
        },
        { term: "damn", severity: 0.3 },
        { term: "crap", severity: 0.3 },
        {
            term: "darn",
            severity: 0.1,
            note: "Mild euphemism for 'damn'."
        },
        {
            term: "shutup",
            severity: 0.3,
            note: "Rude command indicating hostility."
        },
        {
            term: "spastic",
            severity: 0.5,
            note: "Ableist slur in British English, medical term in US."
        },
        {
            term: "disabled",
            severity: 0.1,
            note: "Legitimate disability term but tracked for ableist patterns."
        },
        { term: "loser", severity: 0.3 },
        {
            term: "abuse",
            severity: 0.5,
            note: "Indicates harmful behavior or accusations."
        },
        {
            term: "spam",
            severity: 0.3,
            note: "Indicates unwanted content or disruption."
        },
        {
            term: "abusi",
            severity: 0.5,
            note: "Variant of 'abuse/abusive'."
        },
        { term: "hitler", severity: 1.0 },
        {
            term: "adolf",
            severity: 0.4,
            note: "Common name but often used in Hitler references."
        },
        { term: "gestapo", severity: 1.0 },
        {
            term: "heil",
            severity: 0.8,
            note: "Nazi salute reference."
        },
        {
            term: "final solution",
            severity: 1.0,
            multiWord: true,
            note: "Nazi euphemism for genocide."
        },
        {
            term: "death camp",
            severity: 1.0,
            multiWord: true
        },
        {
            term: "concentration camp",
            severity: 1.0,
            multiWord: true,
            note: "Holocaust reference, legitimate historical use but concerning in usernames."
        },
        {
            term: "gas chamber",
            severity: 1.0,
            multiWord: true
        },
        {
            term: "holocaust",
            severity: 0.5,
            note: "Historical tragedy reference, legitimate historical use."
        },
        {
            term: "zionis",
            severity: 0.5,
            note: "Political term stem, can be antisemitic depending on context."
        },
        { term: "fuhrer", severity: 1.0 },
        {
            term: "reich",
            severity: 0.7,
            note: "Nazi Germany reference, though legitimate German word."
        },
        { term: "massacre", severity: 0.7 },
        { term: "slaughter", severity: 0.7 },
        { term: "torture", severity: 0.7 },
        {
            term: "lynch",
            severity: 1.0,
            note: "Racist mob killing reference, though also a surname."
        },
        {
            term: "mobster",
            severity: 0.5,
            note: "Organized crime reference."
        },
        {
            term: "gangster",
            severity: 0.3,
            note: "Criminal reference or slang."
        },
        {
            term: "druglord",
            severity: 0.5,
            note: "Drug trafficking reference."
        },
        {
            term: "drugs",
            severity: 0.3,
            note: "General term that can be legitimate or problematic."
        },
        {
            term: "meth",
            severity: 0.5,
            note: "Reference to illegal drug, though also shorthand for 'method'."
        },
        { term: "cocaine", severity: 0.5 },
        { term: "heroin", severity: 0.5 },
        {
            term: "weed",
            severity: 0.3,
            note: "Marijuana reference with varying legal status, also refers to plants."
        },
        {
            term: "marijuana",
            severity: 0.3,
            note: "Cannabis reference with complex legal status."
        },
        {
            term: "lsd",
            severity: 0.2,
            note: "Drug abbreviation with multiple meanings.",
            ignore: [ "166" ]
        },
        {
            term: "acid",
            severity: 0.3,
            note: "Drug slang or chemistry term."
        },
        {
            term: "crack",
            severity: 0.5,
            note: "Drug reference or legitimate verb."
        },
        { term: "amphetamine", severity: 0.5 },
        {
            term: "benzo",
            severity: 0.3,
            note: "Drug abbreviation or name prefix."
        },
        { term: "benzodiazepine", severity: 0.5 },
        {
            term: "opioid",
            severity: 0.3,
            note: "Drug class, medical term."
        },
        {
            term: "opiate",
            severity: 0.3,
            note: "Drug class, medical term."
        },
        {
            term: "pcp",
            severity: 0.2,
            note: "Drug abbreviation with multiple meanings."
        },
        {
            term: "ketamine",
            severity: 0.5,
            note: "Drug reference or medical use."
        },
        {
            term: "rohypnol",
            severity: 0.7,
            note: "Date rape drug reference."
        },
        {
            term: "you",
            severity: 0.1,
            note: "Common word but flagged to detect targeted harassment patterns."
        },
        {
            term: "minor",
            severity: 0.3,
            note: "Can refer to age or be innocent context like music or size."
        },
        {
            term: "i like",
            severity: 0.2,
            multiWord: true,
            note: "Flagged to detect inappropriate statements when combined with other terms."
        },
        {
            term: "i love",
            severity: 0.3,
            multiWord: true,
            note: "Flagged to detect inappropriate statements when combined with other terms."
        },
        {
            term: "i hate",
            severity: 0.5,
            multiWord: true,
            note: "Flagged to detect inappropriate statements when combined with other terms."
        },
        {
            term: "young",
            severity: 0.2,
            note: "Age reference with legitimate uses but flagged in combination."
        },
        {
            term: "children",
            severity: 0.1,
            note: "Legitimate word but flagged for context analysis."
        },
        {
            term: "child",
            severity: 0.2,
            note: "Legitimate word but tracked for concerning patterns."
        },
        {
            term: "underage",
            severity: 0.8,
            note: "Age reference with concerning implications in certain contexts."
        },
        {
            term: "teen",
            severity: 0.3,
            note: "Age reference, concerning in some contexts."
        },
        {
            term: "adolescent",
            severity: 0.2,
            note: "Age term, concerning in some contexts."
        },
        {
            term: "preteen",
            severity: 0.4,
            note: "Age reference with concerning implications in certain contexts."
        },
        { term: "rapist", severity: 1.0 },
        { term: "raping", severity: 1.0 },
        { term: "incest", severity: 1.0 },
        {
            term: "cult",
            severity: 0.3,
            note: "Religious/social group term with negative connotation."
        },
        {
            term: "sekt",
            severity: 0.3,
            note: "German for 'sect', cult reference."
        },
        { term: "disembowel", severity: 1.0 },
        { term: "behead", severity: 1.0 },
        {
            term: "traitor",
            severity: 0.5,
            note: "Accusatory term."
        },
        { term: "genocide", severity: 1.0 },
        {
            term: "ethnic clean",
            severity: 1.0,
            multiWord: true,
            note: "Euphemism for genocide."
        },
        { term: "klan", severity: 1.0 },
        { term: "klux", severity: 1.0 },
        { term: "kkk", severity: 1.0 },
        {
            term: "kill",
            severity: 0.5,
            note: "Violent language, but common word."
        },
        {
            term: "bomb",
            severity: 0.7,
            note: "Terrorism/violence reference."
        },
        {
            term: "organi",
            severity: 0.1,
            note: "Word stem for organization."
        },
        {
            term: "blog",
            severity: 0.1,
            note: "External site reference."
        },
        {
            term: "group",
            severity: 0.1,
            note: "Organizational term."
        },
        {
            term: "compan",
            severity: 0.1,
            note: "Company stem, spam indicator."
        },
        {
            term: "associat",
            severity: 0.1,
            note: "Association stem."
        },
        {
            term: "industr",
            severity: 0.1,
            note: "Industry stem, spam indicator."
        },
        {
            term: "corporate",
            severity: 0.1,
            note: "Business term, spam indicator."
        },
        {
            term: "famil",
            severity: 0.1,
            note: "Family stem, group indicator."
        },
        {
            term: "task",
            severity: 0.1,
            note: "Organizational term."
        },
        {
            term: "alliance",
            severity: 0.1,
            note: "Group term."
        },
        {
            term: "entertain",
            severity: 0.1,
            note: "Entertainment stem, promotional."
        },
        {
            term: "public",
            severity: 0.1,
            note: "Common term, promotional context."
        },
        {
            term: "private",
            severity: 0.1,
            note: "Common term, organizational."
        },
        {
            term: "troll",
            severity: 0.3,
            note: "Disruptive behavior indicator."
        },
        {
            term: "trolol",
            severity: 0.3,
            note: "Trolling variant/meme."
        },
        {
            term: "lmao",
            severity: 0.1,
            note: "Internet slang, mild."
        },
        {
            term: "lmfao",
            severity: 0.3,
            note: "Internet slang with profanity."
        },
        {
            term: "grief",
            severity: 0.3,
            note: "Gaming term for harassment."
        },
        {
            term: "password",
            severity: 0.3,
            note: "Security term, suspicious in username."
        },
        {
            term: "admin",
            severity: 0.7,
            note: "Role impersonation."
        },
        {
            term: "sysop",
            severity: 0.4,
            note: "Wikipedia role impersonation."
        },
        {
            term: "bureaucrat",
            severity: 0.5,
            note: "Wikipedia role impersonation."
        },
        {
            term: "moderator",
            severity: 0.5,
            note: "Role impersonation."
        },
        {
            term: "staff",
            severity: 0.5,
            note: "Role impersonation."
        },
        {
            term: "developer",
            severity: 0.5,
            note: "Role impersonation."
        },
        {
            term: "owner",
            severity: 0.4,
            note: "Role impersonation."
        },
        {
            term: "founder",
            severity: 0.3,
            note: "Role impersonation."
        },
        {
            term: "wmf",
            severity: 0.2,
            note: "Wikimedia Foundation impersonation."
        },
        {
            term: "foundation",
            severity: 0.3,
            note: "Organizational impersonation."
        },
        {
            term: "unblock",
            severity: 0.1,
            note: "Suggests blocked user."
        },
        {
            term: "4chan",
            severity: 0.5,
            note: "Imageboard site, trolling association."
        },
        {
            term: "8chan",
            severity: 0.3,
            note: "Controversial imageboard."
        },
        {
            term: "reddit",
            severity: 0.3,
            note: "External site reference."
        },
        {
            term: "plague",
            severity: 0.3,
            note: "Disease/attack term."
        },
        {
            term: "skibidi",
            severity: 0.1,
            note: "Internet meme reference."
        },
        { term: "milf", severity: 0.5 },
        { term: "dilf", severity: 0.5 },
        {
            term: "sext",
            severity: 0.5,
            note: "Sending sexual messages."
        },
        {
            term: "thot",
            severity: 0.3,
            note: "Derogatory sexual slang."
        },
        {
            term: "rizz",
            severity: 0.1,
            note: "Gen Z slang for charisma."
        },
        {
            term: "gyatt",
            severity: 0.1,
            note: "Sexualized Gen Z slang."
        },
        { term: "noob", severity: 0.1 },
        {
            term: "lyric",
            severity: 0.1,
            note: "Possible lyrics website spammer."
        },
        {
            term: "propaganda",
            severity: 0.5,
            note: "Misinformation term."
        },
        { term: "asshole", severity: 0.7 },
        { term: "fucktard", severity: 0.7 },
        { term: "retard", severity: 0.7 },
        { term: "imbecile", severity: 0.5 },
        { term: "moron", severity: 0.5 },
        { term: "chigga", severity: 1.0 },
        { term: "chigger", severity: 1.0 },
        { term: "wigga", severity: 1.0 },
        { term: "wigger", severity: 1.0 },
        {
            term: "igga",
            severity: 0.7,
            note: "Potential variant of racial slur."
        },
        {
            term: "igger",
            severity: 0.7,
            note: "Potential variant of racial slur."
        },
        {
            term: "mother fuck",
            severity: 0.7,
            multiWord: true
        },
        {
            term: "bull shit",
            severity: 0.6,
            multiWord: true
        },
        {
            term: "dumb ass",
            severity: 0.5,
            multiWord: true
        },
        {
            term: "dumb fuck",
            severity: 0.7,
            multiWord: true
        },
    ];

    constructor(lookalikes = {}) {
        this.conversion = {};
        for (const [key, variants] of Object.entries(lookalikes)) {
            for (const variant of variants) {
                if (this.conversion[variant]) {
                    console.warn(`Profanity lookalike collision: ${variant} is already mapped to ${this.conversion[variant]}, remapping to ${key}`);
                }

                this.conversion[variant] = key;
            }
        }
    }

    removeAccents(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    obscureReplacements(str) {
        return str
            .replace(/(\/[|\\]\/|\\[|\\]\\)/g, "n") // /\/ => n, /|/ => n, \/\ => n, \|\ => n
            .replace(/&/g, "and") // & => and
            .replace(/zero/g, "0") // zero => 0
            .replace(/one/g, "1") // one => 1
            .replace(/two/g, "2") // two => 2
            .replace(/three/g, "3") // three => 3
            .replace(/four/g, "4") // four => 4
            .replace(/five/g, "5") // five => 5
            .replace(/six/g, "6") // six => 6
            .replace(/seven/g, "7") // seven => 7
            .replace(/eight/g, "8") // eight => 8
            .replace(/nine/g, "9"); // nine => 9
    }

    parseString(str, preserveSpaces = false) {
        // Remove spaces and separator characters used for obfuscation
        // e.g., "h.e.l.l" or "h_e_l_l"
        // NOTE: Do NOT remove *, #, - as these are lookalike characters handled by pattern matching
        // For multi-word terms, preserve spaces by only removing other separators
        if (preserveSpaces) {
            // Replace separators with space, then normalize multiple spaces to single space
            str = str.replace(/[._,;:|]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
        } else {
            str = str.replace(/[\s._,;:|]/g, '').toLowerCase();
        }

        str = this.removeAccents(str);
        let result = "";
        for (const char of str) {
            if (this.conversion[char]) {
                result += this.conversion[char];
            } else {
                result += char;
            }
        }

        str = this.obscureReplacements(result);
        return str;
    }

    /**
     * Analyzes the original text for obfuscation indicators
     * Returns a score from 0-1 indicating how likely the match is intentional obfuscation
     */
    analyzeObfuscation(originalText, matchStart, matchEnd, matchedWord, isMultiWord = false) {
        const segment = originalText.substring(matchStart, matchEnd);
        let obfuscationScore = 0;
        let indicators = 0;

        // 0. CRITICAL: Check if the match spans across multiple words (crosses word boundaries)
        // Skip this check for legitimate multi-word terms like "concentration camp"
        const hasInternalSpaces = /\s/.test(segment);
        if (hasInternalSpaces && !isMultiWord) {
            // Match crosses word boundaries - very strong indicator of false positive
            // e.g., "is is" matching "isis" in "This is just"
            // Return immediately with very negative score
            return -0.95;
        }

        // 1. Case pattern analysis
        const caseChanges = this.countCaseChanges(segment);
        if (caseChanges > 0) {
            // Irregular case changes suggest obfuscation (e.g., "pAss", "AsS")
            const irregularCaseRatio = caseChanges / Math.max(1, segment.length - 1);
            if (irregularCaseRatio > 0.3) {
                obfuscationScore += 0.3;
                indicators++;
            }
        }

        // 2. Separator character insertion detection (intentional obfuscation)
        // e.g., "h.e.l.l", "a_s_s"
        // NOTE: Don't check for *, #, - as these could be part of normal obfuscation (f**k)
        const hasInternalSeparators = /[._,;:|]/.test(segment);
        if (hasInternalSeparators) {
            // Count how many separators vs letters
            const separatorCount = (segment.match(/[._,;:|]/g) || []).length;
            const letterCount = (segment.match(/[a-zA-Z0-9]/g) || []).length;

            if (letterCount > 0) {
                const separatorRatio = separatorCount / letterCount;

                // If there are many separators relative to letters, it's likely intentional
                // e.g., "h.e.l.l" has 3 separators for 4 letters = 0.75 ratio
                if (separatorRatio > 0.3) {
                    obfuscationScore += Math.min(0.5, separatorRatio * 0.7);
                    indicators++;
                }
            }
        }

        // 3. Check if match crosses word boundaries unnaturally
        const wordBoundaryScore = this.checkWordBoundaries(originalText, matchStart, matchEnd, matchedWord, isMultiWord);
        obfuscationScore += wordBoundaryScore;
        if (wordBoundaryScore !== 0) {
            indicators++;
        }

        // 4. Check for intentional character substitution (l33t speak)
        const substitutionScore = this.checkSubstitution(segment, matchedWord);
        if (substitutionScore > 0) {
            obfuscationScore += substitutionScore;
            indicators++;
        }

        // 5. Check if the match is a complete word vs part of a larger word
        // Skip this check if wordBoundaryScore is 0 or positive (padding/obfuscation detected)
        if (wordBoundaryScore < 0) {
            const isStandalone = this.isStandaloneWord(originalText, matchStart, matchEnd);
            if (!isStandalone) {
                // Part of a larger word - check if it's camelCase boundary
                const isCamelCaseBoundary = this.isCamelCaseBoundary(originalText, matchStart, matchEnd);
                if (isCamelCaseBoundary) {
                    obfuscationScore += 0.2;
                    indicators++;
                } else {
                    // Strong indicator it's NOT obfuscation (already added negative wordBoundaryScore)
                    // Don't double-penalize
                    obfuscationScore -= 0.2;
                    indicators++;
                }
            }
        }

        // Allow negative scores to indicate legitimate words
        return Math.max(-1, Math.min(1, obfuscationScore));
    }

    countCaseChanges(str) {
        let changes = 0;
        for (let i = 1; i < str.length; i++) {
            const prev = str[i - 1];
            const curr = str[i];
            if (/[a-zA-Z]/.test(prev) && /[a-zA-Z]/.test(curr)) {
                const prevUpper = prev === prev.toUpperCase();
                const currUpper = curr === curr.toUpperCase();
                if (prevUpper !== currUpper) {
                    changes++;
                }
            }
        }
        return changes;
    }

    checkWordBoundaries(text, start, end, matchedWord, isMultiWord = false) {
        const before = start > 0 ? text[start - 1] : '';
        const after = end < text.length ? text[end] : '';

        // ALWAYS check legitimate patterns first, regardless of boundaries
        const segment = text.substring(Math.max(0, start - 8), Math.min(text.length, end + 8)).toLowerCase();

        const legitimatePatterns = [
            /pass(word|phrase|port|enger|ion|ive|ed|ing|es|key|code)/i,
            /class(room|mate|ified|es|ic|y)/i,
            /grass(land|hopper|y|es)/i,
            /bass(ist|oon|line|es)/i,
            /mass(ive|acre|age|es|achusetts)/i,
            /assign(ment|ed|ing|s|ee|or)/i,
            /assess(ment|ed|ing|or|s)/i,
            /assemble|assembly|assertion|asset|assist|assume|assure/i,
            /brass|crass|harass|morass|surpass|trespass|compass/i,
        ];

        for (const pattern of legitimatePatterns) {
            if (pattern.test(segment)) {
                return -0.8; // Very strong indicator it's legitimate
            }
        }

        // Check if it's in the middle of a legitimate word
        const beforeIsAlpha = /[a-zA-Z]/.test(before);
        const afterIsAlpha = /[a-zA-Z]/.test(after);

        if (beforeIsAlpha && afterIsAlpha) {
            // Completely surrounded by letters
            // Analyze the surrounding context for legitimacy
            const beforeText = text.substring(Math.max(0, start - 8), start).toLowerCase();
            const afterText = text.substring(end, Math.min(text.length, end + 8)).toLowerCase();
            const fullContext = text.substring(Math.max(0, start - 8), Math.min(text.length, end + 8)).toLowerCase();

            // Check if surrounding text looks like random padding vs real words
            const paddingScore = this.analyzePaddingLikelihood(beforeText, afterText, matchedWord);

            if (paddingScore >= 0.4) {
                // Looks like intentional padding/obfuscation - don't penalize
                return 0;
            }

            // Check if the broader context looks like intentional concatenation
            // e.g., "letskillthatlittlefucker" vs "classroom"
            if (fullContext.length > 15 && fullContext === fullContext.toLowerCase() && !/\s/.test(fullContext)) {
                // Long lowercase string - likely intentional concatenation
                return 0;
            }

            // Otherwise, likely part of a legitimate word
            return -0.5;
        }

        if (beforeIsAlpha || afterIsAlpha) {
            // Partial word boundary
            // Check padding likelihood for partial boundaries too
            const beforeText = text.substring(Math.max(0, start - 8), start).toLowerCase();
            const afterText = text.substring(end, Math.min(text.length, end + 8)).toLowerCase();
            const paddingScore = this.analyzePaddingLikelihood(beforeText, afterText, matchedWord);

            if (paddingScore >= 0.4) {
                // Looks like padding - don't penalize
                return 0;
            }

            return 0;
        }

        // Check if the match spans across multiple words (crosses word boundaries)
        // Skip this check for legitimate multi-word terms like "concentration camp"
        const matchSegment = text.substring(start, end);
        const hasInternalSpaces = /\s/.test(matchSegment);

        if (hasInternalSpaces && !isMultiWord) {
            // Match crosses word boundaries - very strong indicator of false positive
            // e.g., "is is" matching "isis" in "This is just"
            return -0.9;
        }

        return 0;
    }

    /**
     * Analyzes if surrounding text looks like random padding/obfuscation
     * Returns a score from 0-1 where higher = more likely to be padding
     */
    analyzePaddingLikelihood(beforeText, afterText, matchedWord) {
        let paddingScore = 0;
        let indicators = 0;

        // 1. Check for excessive consonant clusters (unpronounceable patterns)
        // Real words rarely have 3+ consonants in a row
        const consonantCluster = /[bcdfghjklmnpqrstvwxyz]{3,}/i;

        if (consonantCluster.test(beforeText) || consonantCluster.test(afterText)) {
            paddingScore += 0.4;
            indicators++;
        }

        // 2. Check for doubled/repeated characters that don't make sense
        // "kerr" has "rr", which is uncommon except in specific words
        const suspiciousRepeats = /([a-z])\1{1,}/i;
        const afterRepeats = afterText.match(suspiciousRepeats);

        if (afterRepeats && afterRepeats[0].length >= 2) {
            // Check if it's at or near the end (common padding pattern)
            const repeatPos = afterText.indexOf(afterRepeats[0]);
            if (repeatPos >= afterText.length - 3) {
                // Double letters at the end are suspicious unless it's a common pattern
                const commonDoubles = /\b(ll|ss|tt|nn|mm|pp|dd|bb|gg|ff)$/i;
                if (!commonDoubles.test(afterRepeats[0]) || afterText.length <= 3) {
                    paddingScore += 0.35;
                    indicators++;
                }
            }
        }

        // 3. Check for very short prefix/suffix (1-2 chars)
        if (beforeText.length <= 2 && beforeText.length > 0) {
            paddingScore += 0.25;
            indicators++;
        }

        if (afterText.length <= 3 && afterText.length > 0) {
            // Short suffix - check if it looks like a real word ending
            const commonSuffixes = /^(er|ed|ing|ion|ly|al|ful|less|ness|ment|s)$/i;
            if (!commonSuffixes.test(afterText)) {
                paddingScore += 0.2;
                indicators++;
            }
        }

        // 4. Check for uncommon letter combinations
        const uncommonPatterns = /([qx][^u]|[jqxz]{2}|[bcdfghjklmnpqrstvwxz]{4,})/i;
        if (uncommonPatterns.test(beforeText + afterText)) {
            paddingScore += 0.3;
            indicators++;
        }

        // 5. Analyze vowel-consonant ratio
        const combined = beforeText + afterText;
        if (combined.length > 0) {
            const vowels = (combined.match(/[aeiou]/gi) || []).length;
            const ratio = vowels / combined.length;

            // Too few vowels suggests random consonants
            if (ratio < 0.2) {
                paddingScore += 0.3;
                indicators++;
            }
        }

        return Math.min(1, paddingScore);
    }

    checkSubstitution(segment, matchedWord) {
        const substitutionChars = /[0-9@$!]/;
        const hasSubstitution = substitutionChars.test(segment);

        if (!hasSubstitution) return 0;

        // Count how many characters are substitutions
        let subCount = 0;
        for (const char of segment) {
            if (substitutionChars.test(char)) {
                subCount++;
            }
        }

        const subRatio = subCount / segment.length;
        return Math.min(0.3, subRatio * 0.6);
    }

    isStandaloneWord(text, start, end) {
        const before = start > 0 ? text[start - 1] : ' ';
        const after = end < text.length ? text[end] : ' ';

        const wordBoundary = /[\s.,;:!?()[\]{}"'`~\-_]/;
        return wordBoundary.test(before) && wordBoundary.test(after);
    }

    isCamelCaseBoundary(text, start, end) {
        if (start === 0 || end === text.length) return false;

        const before = text[start - 1];
        const firstChar = text[start];
        const lastChar = text[end - 1];
        const after = text[end];

        // Check for camelCase pattern: lowerUpper or Upperlower boundaries
        const startsWithCapital = /[A-Z]/.test(firstChar);
        const beforeIsLower = /[a-z]/.test(before);
        const afterIsLower = /[a-z]/.test(after);
        const endsWithLower = /[a-z]/.test(lastChar);

        // Patterns like "myAss" or "AssHole" where the profanity is at a case boundary
        if ((beforeIsLower && startsWithCapital) || (endsWithLower && /[A-Z]/.test(after))) {
            return true;
        }

        return false;
    }

    findMatchPosition(originalText, matchedText, parsedOriginal, parsedMatch) {
        // Find where in the original text this match occurred
        // This is tricky because we've normalized the text
        const lowerOriginal = originalText.toLowerCase();

        // Try to find approximate position
        let bestStart = -1;
        let bestEnd = -1;
        let bestScore = -1;

        // Search for the match in the original text
        for (let i = 0; i <= lowerOriginal.length - matchedText.length; i++) {
            const candidate = this.parseString(originalText.substring(i, i + matchedText.length + 10));
            if (candidate.includes(parsedMatch)) {
                const score = this.calculateSimilarity(parsedMatch, candidate.substring(0, parsedMatch.length));
                if (score > bestScore) {
                    bestScore = score;
                    bestStart = i;
                    bestEnd = i + matchedText.length;
                }
            }
        }

        return { start: bestStart, end: bestEnd };
    }

    calculateSimilarity(str1, str2) {
        const len = Math.min(str1.length, str2.length);
        let matches = 0;
        for (let i = 0; i < len; i++) {
            if (str1[i] === str2[i]) matches++;
        }
        return matches / Math.max(str1.length, str2.length);
    }

    match(raw) {
        const str = this.parseString(raw);
        const found = [];

        for (const hit of Profanity.hits) {
            // Handle object format { term: "word", severity: 0.5, multiWord: true, note: "..." }
            if (hit.term) {
                const term = hit.term;
                const severity = hit.severity || 0.5; // Default to moderate severity
                const note = hit.note || null; // Extract note if available
                const isMultiWord = hit.multiWord || false;

                // Skip single-character hits that are special Unicode symbols
                if (term.length === 1 && /[^\x00-\x7F]/.test(term)) {
                    continue;
                }

                // For multi-word terms, we need to parse the input with spaces preserved
                const searchString = isMultiWord ? this.parseString(raw, true) : str;

                // Build pattern without repetition quantifiers
                // For multi-word terms, replace spaces with flexible pattern that matches:
                // - no space (concatenated), single/multiple spaces, or separator converted to space
                const pattern = term.split("").reduce((acc, char) => {
                    if (isMultiWord && char === ' ') {
                        // Match: no space, one or more spaces
                        return acc + ' *';
                    }
                    const charPattern = _[char] ?? char;
                    return acc + charPattern;
                }, "");

                const regex = new RegExp(pattern, "gi");

                let match;

                const positionMap = this.buildPositionMap(raw, isMultiWord);

                while ((match = regex.exec(searchString)) !== null) {
                    const matchedText = match[0];
                    const parsedStart = match.index;
                    const parsedEnd = parsedStart + matchedText.length;

                    const originalStart = positionMap[parsedStart] || parsedStart;
                    const originalEnd = positionMap[parsedEnd - 1] !== undefined ?
                        positionMap[parsedEnd - 1] + 1 : parsedEnd;

                    const obfuscationScore = this.analyzeObfuscation(
                        raw,
                        originalStart,
                        originalEnd,
                        term,
                        isMultiWord
                    );

                    let matchPercentage = this.calculateMatchPercentage(matchedText, term);

                    // Apply obfuscation modifier
                    if (obfuscationScore < -0.5) {
                        matchPercentage *= Math.max(0.01, 1 + obfuscationScore * 3);
                    } else if (obfuscationScore < -0.2) {
                        matchPercentage *= Math.max(0.1, 1 + obfuscationScore * 2);
                    } else if (obfuscationScore > 0.3) {
                        matchPercentage = Math.min(1, matchPercentage + obfuscationScore * 0.3);
                    }

                    const threshold = Math.max(0.02, 0.15 - (term.length * 0.02));

                    if (matchPercentage >= threshold) {
                        // Check if this match should be ignored
                        const originalSegment = raw.substring(originalStart, originalEnd);
                        if (hit.ignore && Array.isArray(hit.ignore)) {
                            if (hit.ignore.includes(originalSegment)) {
                                continue; // Skip this match
                            }
                        }

                        found.push({
                            name: term,
                            match: matchedText,
                            percentage: matchPercentage,
                            obfuscationScore: obfuscationScore,
                            severity: severity,
                            note: note,
                            originalSegment: originalSegment
                        });
                    }
                }
            }
            // Handle legacy string format for backward compatibility
            else if (typeof hit === "string") {
                // Skip single-character hits that are special Unicode symbols
                // These create too many false positives
                if (hit.length === 1 && /[^\x00-\x7F]/.test(hit)) {
                    continue;
                }

                // Build pattern without repetition quantifiers
                // Character classes like [${any}il1] match one character from the set
                const pattern = hit.split("").reduce((acc, char) => {
                    const charPattern = _[char] ?? char;
                    return acc + charPattern;
                }, "");

                const regex = new RegExp(pattern, "gi"); // Case insensitive for better position tracking
                let match;

                // Build a map from parsed position to original position
                const positionMap = this.buildPositionMap(raw);

                // Use exec to get match indices in parsed string
                while ((match = regex.exec(str)) !== null) {
                    const matchedText = match[0];
                    const parsedStart = match.index;
                    const parsedEnd = parsedStart + matchedText.length;

                    // Map back to original text positions
                    const originalStart = positionMap[parsedStart] || parsedStart;
                    const originalEnd = positionMap[parsedEnd - 1] !== undefined ?
                        positionMap[parsedEnd - 1] + 1 : parsedEnd;

                    // Analyze obfuscation in the original text
                    const obfuscationScore = this.analyzeObfuscation(
                        raw,
                        originalStart,
                        originalEnd,
                        hit
                    );

                    // Calculate base match percentage
                    let matchPercentage = this.calculateMatchPercentage(matchedText, hit);

                    // Apply obfuscation modifier
                    // If obfuscationScore is negative, reduce the match percentage (likely legitimate word)
                    // If positive, increase confidence (likely intentional obfuscation)
                    if (obfuscationScore < -0.5) {
                        // Very strongly reduce confidence for false positives (e.g., crossing word boundaries)
                        matchPercentage *= Math.max(0.01, 1 + obfuscationScore * 3);
                    } else if (obfuscationScore < -0.2) {
                        // Strongly reduce confidence for legitimate words
                        matchPercentage *= Math.max(0.1, 1 + obfuscationScore * 2);
                    } else if (obfuscationScore > 0.3) {
                        // Boost confidence for obvious obfuscation
                        matchPercentage = Math.min(1, matchPercentage + obfuscationScore * 0.3);
                    }

                    // Dynamic threshold: longer original words get lower thresholds
                    const threshold = Math.max(0.02, 0.15 - (hit.length * 0.02));

                    if (matchPercentage >= threshold) {
                        found.push({
                            name: hit,
                            match: matchedText,
                            percentage: matchPercentage,
                            obfuscationScore: obfuscationScore,
                            severity: 0.5, // Default severity for legacy strings
                            note: "Legacy term without specific note. Severity is default moderate (0.5). Confidence based on pattern matching; obfuscation detected through character substitutions.",
                            originalSegment: raw.substring(originalStart, originalEnd)
                        });
                    }
                }
            } else if (hit.regex) {
                // Apply regex to raw string to preserve formatting for URLs, emails, phone numbers
                const matches = raw.match(new RegExp(hit.regex.source, "g"));
                if (matches) {
                    for (const match of matches) {
                        found.push({
                            name: hit.name,
                            match: match,
                            percentage: 1.0,
                            obfuscationScore: 0.5,
                            severity: hit.severity || 0.5,
                            note: hit.note || "Pattern-based detection with high confidence. Obfuscation is moderate for formatted data.",
                            originalSegment: match
                        });
                    }
                }
            } else if (hit.test) {
                // Apply test to raw string to preserve formatting
                if (hit.test(raw)) {
                    found.push({
                        name: hit.name,
                        match: raw,
                        percentage: 1.0,
                        obfuscationScore: 0.5,
                        severity: hit.severity || 0.5,
                        note: hit.note || "Test-based detection with high confidence.",
                        originalSegment: raw
                    });
                }
            }
        }
        return found;
    }

    /**
     * Builds a map from parsed string positions to original string positions
     */
    buildPositionMap(original, preserveSpaces = false) {
        const map = {};
        let parsedIndex = 0;

        for (let i = 0; i < original.length; i++) {
            const char = original[i];
            // Skip separator characters that are removed during parsing
            // NOTE: *, #, - are NOT removed (they're lookalike chars)
            if (preserveSpaces) {
                // For multi-word terms, separators become spaces, spaces/separators map to space positions
                if (/[\s._,;:|]/.test(char)) {
                    // Check if this is part of a sequence of spaces/separators
                    // Only map the first one in a sequence (since multiple spaces collapse to one)
                    if (i === 0 || !/[\s._,;:|]/.test(original[i - 1])) {
                        map[parsedIndex] = i;
                        parsedIndex++;
                    }
                } else {
                    map[parsedIndex] = i;
                    parsedIndex++;
                }
            } else {
                // For single-word terms, remove all separators
                if (!/[\s._,;:|]/.test(char)) {
                    map[parsedIndex] = i;
                    parsedIndex++;
                }
            }
        }

        return map;
    }

    findOriginalPosition(original, normalizedIndex) {
        let count = 0;

        for (let i = 0; i < original.length; i++) {
            const char = original[i];
            if (!/\s/.test(char)) {
                if (count === normalizedIndex) {
                    return i;
                }
                count++;
            }
        }

        return normalizedIndex;
    }

    calculateMatchPercentage(matchedString, originalWord) {
        // Count how many characters in the match are actual letters/numbers vs special characters
        let actualChars = 0;
        let fillerChars = 0;
        let consecutiveFillers = 0;
        let maxConsecutiveFillers = 0;

        const fillerPattern = /[\*#_\-]/;

        for (let i = 0; i < matchedString.length; i++) {
            const char = matchedString[i];
            if (fillerPattern.test(char)) {
                fillerChars++;
                consecutiveFillers++;
                maxConsecutiveFillers = Math.max(maxConsecutiveFillers, consecutiveFillers);
            } else {
                actualChars++;
                consecutiveFillers = 0;
            }
        }

        const totalChars = actualChars + fillerChars;
        if (totalChars === 0) return 0;

        // 1. Character quality score - ratio of actual characters to total
        const charQuality = actualChars / totalChars;

        // 2. Length deviation - how much longer is the match than the original word
        const lengthDeviation = totalChars / originalWord.length;
        const lengthPenalty = Math.max(0, 1 - (lengthDeviation - 1) * 0.4); // Penalize excessive length

        // 3. Filler clustering penalty - consecutive fillers are more suspicious
        const clusterPenalty = maxConsecutiveFillers > 2 ?
            1 - Math.min(0.5, (maxConsecutiveFillers - 2) * 0.1) : 1;

        // 4. Character repetition detection
        const charCounts = {};
        for (const char of matchedString) {
            if (!fillerPattern.test(char)) {
                charCounts[char] = (charCounts[char] || 0) + 1;
            }
        }

        let totalRepetition = 0;
        let repetitionInstances = 0;
        for (const count of Object.values(charCounts)) {
            if (count > 2) { // More than 2 of the same character
                totalRepetition += count - 2; // Count excessive repetitions
                repetitionInstances++;
            }
        }

        const repetitionRatio = actualChars > 0 ? totalRepetition / actualChars : 0;
        const repetitionPenalty = Math.max(0.3, 1 - (repetitionRatio * 0.8)); // Heavy penalty for repetition

        // 5. Pattern disruption score - how much the match deviates from the original pattern
        let patternScore = 0;
        let originalIndex = 0;
        for (let i = 0; i < matchedString.length && originalIndex < originalWord.length; i++) {
            if (!fillerPattern.test(matchedString[i])) {
                if (matchedString[i] === originalWord[originalIndex]) {
                    patternScore++;
                }
                originalIndex++;
            }
        }
        const patternAccuracy = originalWord.length > 0 ? patternScore / originalWord.length : 0;

        // Weighted combination of all factors
        const weights = {
            charQuality: 0.25,
            lengthPenalty: 0.20,
            clusterPenalty: 0.15,
            repetitionPenalty: 0.25,
            patternAccuracy: 0.15
        };

        const finalScore =
            (charQuality * weights.charQuality) +
            (lengthPenalty * weights.lengthPenalty) +
            (clusterPenalty * weights.clusterPenalty) +
            (repetitionPenalty * weights.repetitionPenalty) +
            (patternAccuracy * weights.patternAccuracy);

        return Math.max(0, Math.min(1, finalScore)); // Clamp to [0, 1]
    }

    score(raw) {
        const matches = this.match(raw);

        // Sum up all the match percentages for a weighted score
        let totalScore = 0;
        for (const match of matches) {
            totalScore += match.percentage;
        }

        return totalScore;
    }

    getDetailedScore(raw) {
        const matches = this.match(raw);
        const score = this.score(raw);

        return {
            score: score,
            matchCount: matches.length,
            matches: matches,
            averageConfidence: matches.length > 0 ? score / matches.length : 0
        };
    }

    evaluate(raw) {
        const matches = this.match(raw);
        const str = this.parseString(raw);

        if (matches.length === 0) {
            return {
                finalScore: 0,
                risk: "No",
                matches: [],
                details: {
                    baseScore: 0,
                    weightedScore: 0,
                    severityScore: 0,
                    matchCount: 0,
                    averageConfidence: 0,
                    averageObfuscation: 0,
                    averageSeverity: 0,
                    textLength: raw.length,
                    densityPenalty: 0,
                    repetitionPenalty: 0,
                    diversityBonus: 0,
                    lengthModifier: 1,
                    highConfidenceMatches: 0,
                    mediumConfidenceMatches: 0,
                    lowConfidenceMatches: 0
                }
            };
        }

        // Categorize matches by confidence level and calculate severity
        let highConfidenceMatches = 0;
        let mediumConfidenceMatches = 0;
        let lowConfidenceMatches = 0;
        let weightedScore = 0;
        let totalObfuscation = 0;
        let severityScore = 0;
        const uniqueMatches = new Set();

        for (const match of matches) {
            const matchSeverity = match.severity || 0.5;

            // Weight the match by both confidence AND severity
            const weightedMatch = match.percentage * matchSeverity;
            weightedScore += match.percentage;
            severityScore += weightedMatch;
            totalObfuscation += match.obfuscationScore || 0;
            uniqueMatches.add(match.name);

            if (match.percentage >= 0.7) {
                highConfidenceMatches++;
            } else if (match.percentage >= 0.4) {
                mediumConfidenceMatches++;
            } else {
                lowConfidenceMatches++;
            }
        }

        const averageConfidence = weightedScore / matches.length;
        const averageObfuscation = totalObfuscation / matches.length;
        const averageSeverity = severityScore / weightedScore;

        // 1. Base score calculation with confidence AND severity weighting
        const baseScore =
            (highConfidenceMatches * averageSeverity * 1.0) +
            (mediumConfidenceMatches * averageSeverity * 0.5) +
            (lowConfidenceMatches * averageSeverity * 0.2);

        // 2. Match density analysis - detects spam-like behavior
        const textLength = str.length;
        const matchDensity = matches.length / Math.max(textLength / 5, 1);
        const densityPenalty = Math.tanh(matchDensity * 0.3) * 0.6; // Use tanh for smooth penalty curve

        // 3. Character repetition analysis across entire text
        const charFrequency = {};
        for (const char of str) {
            if (/[a-z0-9]/.test(char)) {
                charFrequency[char] = (charFrequency[char] || 0) + 1;
            }
        }

        let repetitionScore = 0;
        const totalChars = Object.values(charFrequency).reduce((a, b) => a + b, 0);

        for (const count of Object.values(charFrequency)) {
            if (count > 3) {
                // Exponential penalty for excessive character repetition
                repetitionScore += Math.pow((count - 3) / totalChars, 1.5);
            }
        }

        const repetitionPenalty = Math.min(0.8, repetitionScore * 2);

        // 4. Match diversity bonus - multiple different violations is worse
        const uniqueMatchRatio = uniqueMatches.size / matches.length;
        const diversityBonus = uniqueMatchRatio > 0.6 ?
            (uniqueMatchRatio - 0.6) * 1.5 : 0; // Bonus for diverse violations

        // 5. Text length modifier - scale based on text length
        const lengthModifier = Math.max(0.5, Math.min(1.5,
            1 + Math.log10(Math.max(10, textLength)) / 10
        ));

        // 6. Confidence distribution scoring - penalize inconsistent matches
        const confidenceVariance = matches.reduce((variance, match) => {
            return variance + Math.pow(match.percentage - averageConfidence, 2);
        }, 0) / matches.length;

        const consistencyBonus = averageConfidence > 0.5 && confidenceVariance < 0.1 ? 0.3 : 0;

        // 7. Critical pattern detection - severity >= 1.0 are automatically high risk
        const criticalPatterns = matches.filter(m =>
            m.severity >= 1.0 || m.percentage >= 0.9
        ).length;
        const criticalBonus = criticalPatterns * 1.2;

        // 8. Obfuscation modifier - high obfuscation scores indicate intentional evasion
        const obfuscationModifier = averageObfuscation > 0.3 ?
            averageObfuscation * 1.2 : averageObfuscation * 0.5;

        // Calculate base components before applying severity multiplier
        const baseComponents = (
            (baseScore * lengthModifier) +
            (severityScore * 0.8) + // Severity-weighted component
            (weightedScore * 0.1) + // Raw confidence score
            diversityBonus +
            consistencyBonus +
            obfuscationModifier -
            densityPenalty -
            repetitionPenalty
        );

        // Apply severity as a strong multiplier to the entire score
        // This ensures low severity (e.g., 0.1) drastically reduces the final score
        const severityMultiplier = Math.pow(averageSeverity, 1.5); // Exponential impact

        // Calculate final score with severity multiplier, plus critical bonus (which should override low severity)
        let finalScore = (baseComponents * severityMultiplier) + criticalBonus;

        // Apply non-linear scaling for better distribution
        if (finalScore > 3) {
            finalScore = 3 + Math.log10(finalScore - 2) * 1.5;
        } else if (finalScore > 1.5) {
            finalScore = 1.5 + Math.sqrt(finalScore - 1.5) * 0.8;
        }

        // Ensure minimum score for any matches
        finalScore = Math.max(0.1, finalScore);

        // Determine risk level with more granular thresholds
        let risk = "No";
        if (finalScore >= 4 || criticalPatterns >= 2) {
            risk = "Critical";
        } else if (finalScore >= 2.5) {
            risk = "High";
        } else if (finalScore >= 1.5) {
            risk = "Medium";
        } else if (finalScore >= 0.5) {
            risk = "Low";
        } else {
            risk = "Minimal";
        }

        return {
            finalScore: Math.round(finalScore * 100) / 100,
            risk: risk,
            matches: matches,
            details: {
                baseScore: Math.round(baseScore * 100) / 100,
                weightedScore: Math.round(weightedScore * 100) / 100,
                severityScore: Math.round(severityScore * 100) / 100,
                matchCount: matches.length,
                uniqueMatches: uniqueMatches.size,
                averageConfidence: Math.round(averageConfidence * 100) / 100,
                averageObfuscation: Math.round(averageObfuscation * 100) / 100,
                averageSeverity: Math.round(averageSeverity * 100) / 100,
                textLength: raw.length,
                densityPenalty: Math.round(densityPenalty * 100) / 100,
                repetitionPenalty: Math.round(repetitionPenalty * 100) / 100,
                diversityBonus: Math.round(diversityBonus * 100) / 100,
                lengthModifier: Math.round(lengthModifier * 100) / 100,
                consistencyBonus: Math.round(consistencyBonus * 100) / 100,
                obfuscationModifier: Math.round(obfuscationModifier * 100) / 100,
                criticalPatterns: criticalPatterns,
                highConfidenceMatches: highConfidenceMatches,
                mediumConfidenceMatches: mediumConfidenceMatches,
                lowConfidenceMatches: lowConfidenceMatches,
                confidenceVariance: Math.round(confidenceVariance * 1000) / 1000
            }
        };
    }
}

export const profanity = new Profanity({
    "a": ["ɑ","𝑎","𝗮","𝕒","𝖆","𝓪","𝚊","𝞪","А","а","𝔞","𝒂","𝘢","𝛼","𝒶","𝙖","𝜶","𝐚","𝖺","🄰","🅰️","🅰","Ⓐ","ⓐ","@"],
    "b": ["ｂ","𝑏","𝗯","𝕓","𝖇","𝓫","𝚋","𝞫","Ь","в","𝔟","𝒃","𝘣","𝛃","𝒷","𝙗","𝜷","𝐛","𝖻","🄱","🅱️","🅱","Ⓑ","ⓑ"],
    "c": ["ｃ","𝑐","𝗰","𝕔","𝖈","𝓬","𝚌","ϲ","с","𝔠","𝒄","𝘤","𝒸","𝙘","𝐜","𝖼","🄲","Ⓒ","ⓒ"],
    "d": ["ｄ","𝑑","𝗱","𝕕","𝖉","𝓭","𝚍","𝞭","ԁ","ԃ","𝔡","𝒅","𝘥","𝛿","𝒹","𝙙","𝜹","𝐝","𝖽","𝝏","🄳","Ⓓ","ⓓ"],
    "e": ["ｅ","𝑒","𝗲","𝕖","𝖊","𝓮","𝚎","𝞮","е","𝔢","𝒆","𝘦","𝛆","𝒺","𝙚","𝜺","𝐞","𝖾","з","𝝐","🄴","Ⓔ","ⓔ","€"],
    "f": ["ｆ","𝑓","𝗳","𝕗","𝖋","𝓯","𝚏","𝞯","ғ","ƒ","𝔣","𝒇","𝘧","𝒻","𝙛","𝜻","𝐟","𝖿","🄵","Ⓕ","ⓕ"],
    "g": ["ｇ","𝑔","𝗴","𝕘","𝖌","𝓰","𝚐","ɡ","Ԍ","ԍ","𝔤","𝒈","𝘨","𝙜","𝐠","𝗀","🄶","Ⓖ","ⓖ"],
    "h": ["ｈ","𝗵","𝕙","𝖍","𝓱","𝚑","һ","н","𝔥","𝒉","𝘩","ℎ","𝒽","𝙝","𝐡","𝗁","🄷","Ⓗ","ⓗ"],
    "i": ["ｉ","𝑖","𝗶","𝕚","𝖎","𝓲","𝚒","𝞲","і","𝔦","𝒊","𝘪","𝒾","𝙞","𝜾","𝐢","𝗂","🄸","ℹ️","ℹ","Ⓘ","ⓘ","!"],
    "j": ["ｊ","𝑗","𝗷","𝕛","𝖏","𝓳","𝚳","ј","𝔧","𝒋","𝘫","𝒿","𝙟","𝐣","𝗃","🄹","Ⓙ","ⓙ"],
    "k": ["ｋ","𝑘","𝗸","𝕜","𝖐","𝓴","κ","к","𝔨","𝒌","𝘬","𝓀","𝙠","𝝀","𝐤","𝗄","𝞳","𝜿","қ","🄺","Ⓚ","ⓚ"],
    "l": ["ｌ","𝑙","𝗹","𝕝","𝖑","𝓵","ⅼ","ӏ","𝔩","𝒍","𝘭","𝓁","𝙡","𝐥","𝗅","🄻","Ⓛ","ⓛ","|"],
    "m": ["ｍ","𝑚","𝗺","𝕞","𝖒","𝓶","𝚖","м","𝔪","𝒎","𝘮","𝓂","𝙢","𝐦","𝗆","🄼","Ⓜ️","Ⓜ","ⓜ"],
    "n": ["ｎ","𝑛","𝗻","𝕟","𝖓","𝓷","𝚗","ո","п","𝔫","𝒏","𝘯","𝓃","𝙣","𝐧","𝗇","𝞰","𝜼","🄽","Ⓝ","ⓝ"],
    "o": ["ｏ","𝑜","𝗼","𝕠","𝖔","𝓸","𝚘","ο","о","𝔬","𝒐","𝘰","𝙤","𝝈","𝐨","𝗈","𝜽","𝝄","𝝓","𝝑","𝝋","🄾","🅾️","🅾","Ⓞ","ⓞ"],
    "p": ["ｐ","𝑝","𝗽","𝕡","𝖕","𝓹","𝚙","ρ","р","𝔭","𝒑","𝘱","𝓅","𝙥","𝐩","𝗉","𝝆","🄿","🅿️","🅿","Ⓟ","ⓟ"],
    "q": ["ｑ","𝑞","𝗾","𝕢","𝖖","𝓺","𝚚","ԛ","𝔮","𝒒","𝘲","𝓆","𝙦","𝐪","𝗊","🅀","Ⓠ","ⓠ"],
    "r": ["ｒ","𝑟","𝗿","𝕣","𝖗","𝓻","𝚛","г","𝔯","𝒓","𝘳","𝓇","𝙧","𝐫","𝗋","𝞽","🅁","Ⓡ","ⓡ"],
    "s": ["ｓ","𝑠","𝗌","𝕤","𝖘","𝓼","𝚜","ѕ","𝔰","𝒔","𝘴","𝓈","𝙨","𝐬","🅂","Ⓢ","ⓢ","$"],
    "t": ["ｔ","𝑡","𝗍","𝕥","𝖙","𝓽","𝚝","τ","т","𝔱","𝒕","𝘵","𝓉","𝙩","𝐭","𝝉","🅃","Ⓣ","ⓣ","+"],
    "u": ["ｕ","𝑢","𝗎","𝕦","𝖚","𝓾","𝚞","υ","𝔲","𝒖","𝘶","𝓊","𝙪","𝐮","𝛍","🅄","Ⓤ","ⓤ"],
    "v": ["ｖ","𝑣","𝗏","𝕧","𝖛","𝓿","𝚟","ν","𝔳","𝒗","𝘷","𝓋","𝙫","𝐯","𝞶","𝝂","𝝊","🅅","Ⓥ","ⓥ"],
    "w": ["ｗ","𝑤","𝗐","𝕨","𝖜","𝔀","𝚠","ω","ш","𝔴","𝒘","𝘸","𝓌","𝙬","𝐰","𝝎","𝝍","🅆","Ⓦ","ⓦ"],
    "x": ["ｘ","𝑥","𝗑","𝕩","𝖝","𝔁","𝚡","χ","х","𝔵","𝒙","𝘹","𝓍","𝙭","𝐱","𝝒","𝝌","🅇","Ⓧ","ⓧ"],
    "y": ["ｙ","𝑦","𝗒","𝕪","𝖞","𝔂","𝚢","у","𝔶","𝒚","𝘺","𝓎","𝙮","𝐲","𝞬","𝜸","𝞴","🅈","Ⓨ","ⓨ"],
    "z": ["ｚ","𝑧","𝗓","𝕫","𝖟","𝔃","𝚣","ζ","𝔷","𝒛","𝘻","𝓏","𝙯","𝐳","🅉","Ⓩ","ⓩ"],
    "0": ["０","𝟎","𝟬","𝟢"],
    "1": ["１","𝟏","𝟭","𝟣","①","➀","❶","➊","⓵"],
    "2": ["２","𝟐","𝟮","𝟤","②","➁","❷","➋","⓶"],
    "3": ["３","𝟑","𝟯","𝟥","③","➂","❸","➌","⓷"],
    "4": ["４","𝟒","𝟰","𝟦","④","➃","❹","➍","⓸","ᛋ"],
    "5": ["５","𝟓","𝟱","𝟧","⑤","➄","❺","➎","⓹"],
    "6": ["６","𝟔","𝟲","𝟨","⑥","➅","❻","➏","⓺"],
    "7": ["７","𝟕","𝟳","𝟩","⑦","➆","❼","➐","⓻"],
    "8": ["８","𝟖","𝟴","𝟪","⑧","➇","❽","➑","⓼"],
    "9": ["９","𝟗","𝟵","𝟫","⑨","➈","❾","➒","⓽"],
});