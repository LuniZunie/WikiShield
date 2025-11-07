// Import CSS files as raw text strings
import baseCSS from './styles/base.css';
import initialCSS from './styles/initial.css';
import mainCSS from './styles/main.css';
import themeDarkCSS from './styles/theme-dark.css';

/**
 * WikiShield styling object containing CSS for different parts of the application
 * Each property contains CSS as a string that can be injected into style tags
 */
export const wikishieldStyling = {
	/**
	 * Base styles - includes CSS variables, resets, and common utilities
	 * Used across all pages
	 */
	base: baseCSS,
	
	/**
	 * Initial/Welcome page styles
	 * Includes animated background, shield icon, and welcome UI
	 */
	initial: initialCSS,
	
	/**
	 * Main application styles
	 * The bulk of the UI including queue, diff viewer, settings, etc.
	 */
	main: mainCSS,
	
	/**
	 * Dark theme overrides
	 * Applied when dark mode is enabled
	 */
	"theme-dark": themeDarkCSS
};

/**
 * Helper function to load multiple styles at once
 * @param {...string} styleNames - Names of styles to load (e.g., 'base', 'main')
 * @returns {string} Combined CSS string
 */
export function loadStyles(...styleNames) {
	return styleNames
		.map(name => wikishieldStyling[name])
		.filter(Boolean)
		.join('\n\n');
}

/**
 * Helper function to inject styles into the document
 * @param {string} css - CSS string to inject
 * @param {string} id - Optional ID for the style tag
 * @returns {HTMLStyleElement} The created style element
 */
export function injectStyles(css, id = null) {
	const style = document.createElement('style');
	if (id) style.id = id;
	style.textContent = css;
	document.head.appendChild(style);
	return style;
}

/**
 * Helper function to inject multiple named styles
 * @param {...string} styleNames - Names of styles to inject
 * @returns {HTMLStyleElement} The created style element
 */
export function injectNamedStyles(...styleNames) {
	const css = loadStyles(...styleNames);
	return injectStyles(css, `wikishield-${styleNames.join('-')}`);
}
