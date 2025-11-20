// HTML templates for WikiShield UI

export const wikishieldHTML = {
	"changelog": `
		<h1 style="
			text-align:center;
			margin:25px 0 30px;
			font-size:32px;
			font-weight:800;
			color:var(--title-color, #fff);
			letter-spacing:0.5px;
		">
			Changelog
		</h1>

		<div style="
			max-width:1350px;
			margin:0 auto;
			display:grid;
			grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));
			gap:24px;
			padding:0 10px;
			font-family:system-ui, sans-serif;
			color:var(--text-color, inherit);
		">

			<style>
			:root {
				--card-bg: rgba(255,255,255,0.04);
				--card-border: rgba(255,255,255,0.10);
				--card-shadow: 0 6px 20px rgba(0,0,0,0.25);
				--text-color: #e5e5e5;
				--title-color: #ffffff;
				--accent-color: #76a8ff;
				--code-bg: rgba(255,255,255,0.15);
			}
			</style>

			<!-- CARD -->
			<div style="
			background:var(--card-bg);
			border:1px solid var(--card-border);
			border-radius:14px;
			padding:22px 24px;
			box-shadow:var(--card-shadow);
			backdrop-filter:blur(8px);
			">
			<h2 style="margin:0 0 10px; font-size:20px; font-weight:700; color:var(--title-color);">Zen Mode</h2>
			<p style="margin:0 0 14px; font-size:15px; font-weight:600; color:var(--accent-color);">
				UI Improvements & Minimalism Tools
			</p>
			<ul style="margin:0; padding-left:20px; line-height:1.6; font-size:15px;">
				<li>New <code style="background:var(--code-bg); padding:2px 5px; border-radius:4px;">Zen Mode</code> tab in the settings panel.</li>
				<li>Toggle visibility of watchlist, notifications, edit count, and toasts.</li>
			</ul>
			</div>

			<div style="
			background:var(--card-bg);
			border:1px solid var(--card-border);
			border-radius:14px;
			padding:22px 24px;
			box-shadow:var(--card-shadow);
			backdrop-filter:blur(8px);
			">
			<h2 style="margin:0 0 10px; font-size:20px; font-weight:700; color:var(--title-color);">Highlighting & Whitelisting</h2>
			<p style="margin:0 0 14px; font-size:15px; font-weight:600; color:var(--accent-color);">
				More Control Over Categories
			</p>
			<ul style="margin:0; padding-left:20px; line-height:1.6; font-size:15px;">
				<li>Pages and tags can now be whitelisted or highlighted.</li>
				<li>Settings reorganized into clearer category groups.</li>
			</ul>
			</div>

			<div style="
			background:var(--card-bg);
			border:1px solid var(--card-border);
			border-radius:14px;
			padding:22px 24px;
			box-shadow:var(--card-shadow);
			backdrop-filter:blur(8px);
			">
			<h2 style="margin:0 0 10px; font-size:20px; font-weight:700; color:var(--title-color);">Sound System Upgrade</h2>
			<p style="margin:0 0 14px; font-size:15px; font-weight:600; color:var(--accent-color);">
				Layered Audio Format
			</p>
			<ul style="margin:0; padding-left:20px; line-height:1.6; font-size:15px;">
				<li>Sounds now support multiple layers for richer effects.</li>
				<li>Updated every sound to use the new system.</li>
				<li>Added <code style="background:var(--code-bg); padding:2px 5px; border-radius:4px;">success</code> and <code style="background:var(--code-bg); padding:2px 5px; border-radius:4px;">error</code> tones.</li>
			</ul>
			</div>

			<div style="
			background:var(--card-bg);
			border:1px solid var(--card-border);
			border-radius:14px;
			padding:22px 24px;
			box-shadow:var(--card-shadow);
			backdrop-filter:blur(8px);
			">
			<h2 style="margin:0 0 10px; font-size:20px; font-weight:700; color:var(--title-color);">Save System Fixes</h2>
			<p style="margin:0 0 14px; font-size:15px; font-weight:600; color:var(--accent-color);">
				More Reliable Loading
			</p>
			<ul style="margin:0; padding-left:20px; line-height:1.6; font-size:15px;">
				<li>Namespace preferences may have reset due to a bug.</li>
				<li>Invalid or unsupported settings now auto-remove during load.</li>
			</ul>
			</div>

			<div style="
			background:var(--card-bg);
			border:1px solid var(--card-border);
			border-radius:14px;
			padding:22px 24px;
			box-shadow:var(--card-shadow);
			backdrop-filter:blur(8px);
			">
			<h2 style="margin:0 0 10px; font-size:20px; font-weight:700; color:var(--title-color);">Miscellaneous Improvements</h2>
			<p style="margin:0 0 14px; font-size:15px; font-weight:600; color:var(--accent-color);">
				General Enhancements
			</p>
			<ul style="margin:0; padding-left:20px; line-height:1.6; font-size:15px;">
				<li>Script now works across all Wikimedia Foundation wikis.</li>
				<li>Rearranged and cleaned up the settings panel.</li>
				<li>Fixed several minor bugs.</li>
			</ul>
			</div>

		</div>
	`,
	"head": `
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css">
	`,
	"initial": (version) => `
		<div id="container">
			<canvas id="dots-canvas"></canvas>
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
					<span class="about-link">v${version}</span>
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
						<span class="fa fa-book-bookmark" id="watchlist-icon" data-tooltip="Watchlist" style="position: relative;" data-zen-show="watchlist">
							<span id="watchlist-count" style="display: none; position: absolute; top: -5px; right: -5px; background: dodgerblue; color: white; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; text-align: center; line-height: 16px; font-family: sans-serif;"></span>
						</span>
						<span class="fa fa-bell" id="notifications-icon" data-tooltip="Notifications" style="position: relative;" data-zen-show="notifications">
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
					<span id="mark-all-notifications-read" style="font-size: 0.85em; font-weight: normal; cursor: pointer; color: dodgerblue;">Mark all as read</span>
				</div>
				<div id="notifications-list"></div>
			</div>
			<div id="watchlist-panel">
				<div id="watchlist-header">
					<span>Watchlist</span>
					<span id="mark-all-watchlist-read" style="font-size: 0.85em; font-weight: normal; cursor: pointer; color: dodgerblue;">Mark all as read</span>
				</div>
				<div id="watchlist-list"></div>
			</div>
			<div id="right-container">
				<div id="middle-top"></div>
				<div id="right-top">
					<div class="tabs">
						<div id="latest-edits-tab" class="tab hidden selected" data-tooltip="Latest edit">
							<i class="fas fa-user"></i>
						</div>
						<div id="consecutive-edits-tab" class="tab hidden" data-tooltip="Consecutive edits">
							<i class="fas fa-users"></i>
						</div>
					</div>

					<div class="icons">
						<i class="created-page hidden fas fa-file-circle-plus" data-tooltip="No other users have edited this page"></i>
					</div>
				</div>
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

							<div id="bottom-tools-stats" data-zen-show="editCount">
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
			<div id="user-whitelist" class="menu-option">
				<i class="fas fa-check"></i>
				<span>Whitelist user</span>
			</div>
			<div id="user-unwhitelist" class="menu-option" style="display: none;">
				<i class="fas fa-xmark"></i>
				<span>Unwhitelist user</span>
			</div>
			<div id="user-highlight" class="menu-option">
				<i class="fas fa-star"></i>
				<span>Highlight user</span>
			</div>
			<div id="user-unhighlight" class="menu-option" style="display: none;">
				<i class="fas fa-star"></i>
				<span>Unhighlight user</span>
			</div>
			<div class="menu-divider"></div>
			<div id="user-welcome" class="menu-option submenu-trigger">
				<i class="fas fa-paper-plane"></i>
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
			<div id="page-whitelist" class="menu-option">
				<i class="fas fa-check"></i>
				<span>Whitelist page</span>
			</div>
			<div id="page-unwhitelist" class="menu-option" style="display: none;">
				<i class="fas fa-xmark"></i>
				<span>Unwhitelist page</span>
			</div>
			<div id="page-highlight" class="menu-option">
				<i class="fas fa-star"></i>
				<span>Highlight page</span>
			</div>
			<div id="page-unhighlight" class="menu-option" style="display: none;">
				<i class="fas fa-star"></i>
				<span>Unhighlight page</span>
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
			<div id="edit-rollback" class="menu-option submenu-trigger">
				<i class="fas fa-rotate-left"></i>
				<span>Rollback</span>
				<i class="fas fa-chevron-right menu-option-chevron"></i>
				<div class="submenu"></div>
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
		<div class="menu-divider"></div>
		<div id="context-whitelist-user">Whitelist user</div>
		<div id="context-highlight-user">Highlight user</div>
		<div class="menu-divider"></div>
		<div id="context-whitelist-page">Whitelist page</div>
		<div id="context-highlight-page">Highlight page</div>
		<div class="menu-divider"></div>
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
						<span><i class="fas fa-gear"></i>General</span>
					</div>
					<div class="settings-left-menu-item" id="settings-audio-button">
						<span><i class="fas fa-volume-high"></i>Audio</span>
					</div>
					<div class="settings-left-menu-item" id="settings-controls-button">
						<span><i class="fas fa-keyboard"></i>Controls</span>
					</div>
				</div>

				<div class="settings-category">
					<div class="settings-category-header">
						<span>APPEARANCE</span>
					</div>
					<div class="settings-left-menu-item" id="settings-palette-button">
						<span><i class="fas fa-palette"></i>Palette</span>
					</div>
					<div class="settings-left-menu-item" id="settings-zen-mode-button">
						<span><i class="fas fa-spa"></i>Zen Mode</span>
					</div>
				</div>

				<div class="settings-category">
					<div class="settings-category-header">
						<span>TOOLS</span>
					</div>
					<div class="settings-left-menu-item" id="settings-ai-button">
						<span><i class="fas fa-robot"></i>AI Analysis</span>
					</div>
					<div class="settings-left-menu-item" id="settings-auto-reporting-button">
						<span><i class="fas fa-flag"></i>Auto Reporting</span>
					</div>
					<div class="settings-left-menu-item" id="settings-gadgets-button">
						<span><i class="fas fa-toolbox"></i>Gadgets</span>
					</div>
				</div>

				<div class="settings-category">
					<div class="settings-category-header">
						<span>WHITELIST</span>
					</div>
					<div class="settings-left-menu-item" id="settings-whitelist-users-button">
						<span><i class="fas fa-user"></i>Users</span>
					</div>
					<div class="settings-left-menu-item" id="settings-whitelist-pages-button">
						<span><i class="fas fa-file"></i>Pages</span>
					</div>
					<div class="settings-left-menu-item" id="settings-whitelist-tags-button">
						<span><i class="fas fa-tag"></i>Tags</span>
					</div>
				</div>

				<div class="settings-category">
					<div class="settings-category-header">
						<span>HIGHLIGHT</span>
					</div>
					<div class="settings-left-menu-item" id="settings-highlight-users-button">
						<span><i class="fas fa-user"></i>Users</span>
					</div>
					<div class="settings-left-menu-item" id="settings-highlight-pages-button">
						<span><i class="fas fa-file"></i>Pages</span>
					</div>
					<div class="settings-left-menu-item" id="settings-highlight-tags-button">
						<span><i class="fas fa-tag"></i>Tags</span>
					</div>
				</div>

				<div class="settings-category">
					<div class="settings-category-header">
						<span>INFO</span>
					</div>
					<div class="settings-left-menu-item" id="settings-statistics-button">
						<span><i class="fas fa-chart-area"></i>Statistics</span>
					</div>
					<div class="settings-left-menu-item" id="settings-about-button">
						<span><i class="fas fa-info"></i>About</span>
					</div>
				</div>

				<div class="settings-category">
					<div class="settings-category-header">
						<span>MISC</span>
					</div>
					<div class="settings-left-menu-item" id="settings-save-button">
						<span><i class="fas fa-floppy-disk"></i>Save</span>
					</div>
				</div>
			</div>
			<div class="settings-right"></div>
		</div>
	`
};
