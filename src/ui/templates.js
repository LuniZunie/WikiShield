// HTML templates for WikiShield UI

export const wikishieldHTML = {
	"changelog": `
		<div class="changelog-grid">
			<div class="card">
				<h2>Pending Changes</h2>
				<p>Ability to accept or reject pending changes.</p>
				<ul>
					<li>View pending changes in a dedicated tab.</li>
					<li>Accept or reject changes with an optional reason.</li>
					<li><strong>Note:</strong> This feature requires the <code>review</code> user right.</li>
				</ul>
			</div>
			<div class="card">
				<h2>Notices, Alerts, & Watchlist</h2>
				<p>Notices & alerts separated, new watchlist queue.</p>
				<ul>
					<li>Separate panels for notices and alerts.</li>
					<li>Watchlist edits now have their own queue tab.</li>
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
			<div id="welcome-container" class="shimmer shimmer-border">
				<div class="shield-container">
					<div class="glow-ring"></div>
					<div class="glow-ring"></div>
					<div class="glow-ring"></div>
					<div class="sparkle"></div>
					<div class="sparkle"></div>
					<div class="sparkle"></div>
					<div class="sparkle"></div>
					<div class="shield-icon">
						<img src="https://media.luni.me/image/icon/WikiShield" alt="WikiShield Logo">
					</div>
				</div>
				<h1>Welcome to WikiShield</h1>
				<div class="about-links">
					<a href="https://en.wikipedia.org/wiki/Wikipedia:WikiShield" target="_blank" class="about-link">About</a>
					<a href="https://en.wikipedia.org/wiki/Wikipedia talk:WikiShield" target="_blank" class="about-link">Discuss</a>
					<span class="about-link">v${version}</span>
				</div>
				<div id="rollback-needed" style="display: none;">
					<p><span class="fa fa-exclamation-triangle"></span> You must have rollback or admin rights to use this script.</p>
					<p>You can apply for rollback rights <a href="/wiki/Wikipedia:PERM/R" target="_blank">here</a>.</p>
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
						<span class="fa fa-gear" id="open-settings" data-tooltip="Open settings"></span>
						<span class="fa fa-trash" id="delete-queue" data-tooltip="Clear queue"></span>
					</div>
					<div id="queue-top-right">
						<span class="fa fa-inbox" id="notices-icon" data-tooltip="Notices" style="position: relative; display: none;" data-zen-show="notices">
							<span id="notices-count" class="icon-count blue" style="display: none;"></span>
						</span>
						<span class="fa fa-bell" id="alerts-icon" data-tooltip="Alerts" style="position: relative;" data-zen-show="alerts">
							<span id="alerts-count" class="icon-count red" style="display: none;"></span>
						</span>
					</div>
				</div>
				<div id="queue-tabs">
					<div id="queue-tab-recent" class="queue-tab selected" data-tooltip="Recent edits">
						<span class="fas fa-stopwatch" style="position: relative;">
							<span class="icon-count hidden red"></span>
						</span>
					</div>
					<div id="queue-tab-flagged" class="queue-tab" data-tooltip="Pending edits">
						<span class="fas fa-flag" style="position: relative;">
							<span class="icon-count hidden orange"></span>
						</span>
					</div>
					<div id="queue-tab-watchlist" class="queue-tab" data-tooltip="Watchlist edits" data-zen-show="watchlist">
						<span class="fas fa-book-bookmark" style="position: relative;">
							<span class="icon-count hidden blue"></span>
						</span>
					</div>
				</div>
				<div id="queue-items" class="queue-list">
					<div class="queue-empty">
						No edits in queue.
					</div>
				</div>
				<div class="width-adjust" id="queue-width-adjust"></div>
			</div>
			<div id="alerts-panel" class="notification-panel">
				<div id="alerts-header" class="notification-header">
					<span>Alerts</span>
					<span id="mark-all-alerts-read" style="font-size: 0.85em; font-weight: normal; cursor: pointer; color: dodgerblue;">Mark all as read</span>
				</div>
				<div id="alerts-list" class="notification-list"></div>
			</div>
			<div id="notices-panel" class="notification-panel">
				<div id="notices-header" class="notification-header">
					<span>Notices</span>
					<span id="mark-all-notices-read" style="font-size: 0.85em; font-weight: normal; cursor: pointer; color: dodgerblue;">Mark all as read</span>
				</div>
				<div id="notices-list" class="notification-list"></div>
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
						<div id="ai-analysis-container" class="hidden shimmer shimmer-border">
							<div class="header">
								<i class="fas fa-robot"></i>
								<span class="title">AI Analysis</span>
								<span class="assessment"></span>
								<span class="confidence"></span>
							</div>
							<div class="explanation"></div>
							<div class="issues"></div>
						</div>
						<div id="diff-container"></div>
						<div id="pending-changes-container" class="hidden">
							<div class="accept">Accept</div>
							<div class="reject">Reject</div>
						</div>
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
						<div id="user-contribs" class="right-detail">
							<div id="user-contribs-top" class="right-detail-top">
								<div class="right-detail-left">
									<div id="user-contribs-title" class="right-detail-title">User Contributions</div>
									<div id="user-contribs-count">_ edits</div>
								</div>
								<div id="user-block-count" style="display: none;"></div>
								<div id="user-warn-level" data-tooltip="Warning level">0</div>
							</div>
							<div id="user-contribs-content" class="queue-list"></div>
						</div>
						<div class="height-adjust"></div>
						<div id="page-history" class="right-detail">
							<div id="page-history-top" class="right-detail-top">
								<div class="right-detail-left">
									<div id="page-history-title" class="right-detail-title">Page History</div>
									<div id="page-metadata"></div>
								</div>
								<div id="protection-indicator"></div>
							</div>
							<div id="page-history-content" class="queue-list"></div>
						</div>
						<div class="width-adjust" id="details-width-adjust"></div>
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
					<div class="settings-left-menu-item" id="settings-performance-button">
						<span><i class="fas fa-tachometer-alt"></i>Performance</span>
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
					<div class="settings-left-menu-item" id="settings-queue-button">
						<span><i class="fas fa-list"></i>Queue</span>
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
					<div class="settings-left-menu-compact">
						<div class="settings-left-menu-item" id="settings-whitelist-users-button">
							<i class="fas fa-user" title="Users"></i>
						</div>
						<div class="settings-left-menu-item" id="settings-whitelist-pages-button">
							<i class="fas fa-file" title="Pages"></i>
						</div>
						<div class="settings-left-menu-item" id="settings-whitelist-tags-button">
							<i class="fas fa-tag" title="Tags"></i>
						</div>
					</div>
				</div>

				<div class="settings-category">
					<div class="settings-category-header">
						<span>HIGHLIGHT</span>
					</div>
					<div class="settings-left-menu-compact">
						<div class="settings-left-menu-item" id="settings-highlight-users-button">
							<i class="fas fa-user" title="Users"></i>
						</div>
						<div class="settings-left-menu-item" id="settings-highlight-pages-button">
							<i class="fas fa-file" title="Pages"></i>
						</div>
						<div class="settings-left-menu-item" id="settings-highlight-tags-button">
							<i class="fas fa-tag" title="Tags"></i>
						</div>
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
