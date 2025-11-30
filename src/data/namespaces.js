
// Wikipedia namespace configurations

/*
TODO: for all talk pages:

edit: "Flag edits that do not discuss the relevant page. Flag personal attacks against other users. Flag removals and edits of signed comments if the username does not match the signature.",
username: "Check whether the username is insulting, inappropriate, misleading, or another way in violation of Wikipedia's username policies."

*/

export const namespaces = [
	{
		name: "Main",
		id: 0,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "Talk",
		id: 1,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "User",
		id: 2,
		analysis_description: {
			edit: "Flag content unrelated to Wikipedia, such as self-promotion. If the page looks like a Wikipedia article, check that it isn't an obvious hoax, and that it is a subpage. Do not follow strict standards for these pages.",
			username: "Check whether the username matches the base page title. Most often, a user page should only be edited by that user. Consider alternative accounts, like User:Example creating User:Example (alt)."
		}
	},
	{
		name: "User talk",
		id: 3,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "Project",
		id: 4,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "Project talk",
		id: 5,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "File",
		id: 6,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "File talk",
		id: 7,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "MediaWiki",
		id: 8,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "MediaWiki talk",
		id: 9,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "Template",
		id: 10,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "Template talk",
		id: 11,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "Help",
		id: 12,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "Help talk",
		id: 13,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "Category",
		id: 14,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "Category talk",
		id: 15,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "Portal",
		id: 100,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "Portal talk",
		id: 101,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "Draft",
		id: 118,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "Draft talk",
		id: 119,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "MOS",
		id: 126,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "MOS talk",
		id: 127,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "TimedText",
		id: 710,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "TimedText talk",
		id: 711,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "Module",
		id: 828,
		analysis_description: {
			edit: "Check whether the edit is meaningful Lua code. In this namespace, anything that isn't written in Lua can be safely assumed to be vandalism. Be careful about multi-line strings, as they might contain non-Lua code: check the context of the edit to make sure. Additionally, check if the edit introduces any obvious Lua syntax errors.",
			username: ""
		}
	},
	{
		name: "Module talk",
		id: 829,
		analysis_description: {
			edit: "",
			username: ""
		}
	},

	{
		name: "Event",
		id: 1728,
		analysis_description: {
			edit: "",
			username: ""
		}
	},
	{
		name: "Event talk",
		id: 1729,
		analysis_description: {
			edit: "",
			username: ""
		}
	}
];
