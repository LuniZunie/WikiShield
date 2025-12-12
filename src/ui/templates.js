// HTML templates for WikiShield UI

export const wikishieldHTML = {
	"changelog": `
		<div class="changelog-header">
			<h1><i class="fas fa-rocket"></i> What's New in WikiShield</h1>
			<p class="changelog-subtitle">Discover the latest features and improvements</p>
		</div>
		<div id="changelog-version-5" class="changelog-version">
			<div class="changelog-version-header">
				<h1>Version 1.1.2</h1>
				<p class="changelog-version-subtitle">12 December 2025, 00:30 UTC</p>
			</div>
			<div class="changelog-grid">
				<div class="card featured">
					<div class="card-icon"><i class="fas fa-eye"></i></div>
					<h2>Watchlist Enhancements</h2>
					<p>Pages can now be watched or unwatched directly from the queue.</p>
					<ul>
						<li>In the page menu, <code>Watch page</code> and <code>Unwatch page</code> options has been added</li>
						<li>When a page is unwatched, all edits in the watchlist queue for that page are removed</li>
						<li>Watchlist statistics are now tracked</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-user"></i></div>
					<h2>User Creations</h2>
					<p>User creation profanity filter improvements.</p>
					<ul>
						<li>A "note on file" has been added to certain filter hits</li>
						<li>Slight improvements to filter accuracy</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-list-check"></i></div>
					<h2>Queue Navigation Improvements</h2>
					<p>Multiple bugs have been fixed.</p>
					<ul>
						<li>Pending changes are no longer removed when navigating between edits</li>
						<li>When clicking on user contributions or the page history, the current edit is replaced rather than removed</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-shield-alt"></i></div>
					<h2>Security Fixes</h2>
					<p>Multiple security fixes.</p>
					<ul>
						<li>Fixed an issue where a user could log out while still maintaining access to WikiShield features</li>
						<li>Fixed an issue where a user who lost rollback rights while running the script could still access WikiShield features</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-ellipsis"></i></div>
					<h2>Miscellaneous</h2>
					<p>Other changes and improvements.</p>
					<ul>
						<li>Fixed a bug where usernames in accepted and rejected pending changes were occasionally not built correctly</li>
						<li>Fixed an issue with the display for session time in statistics</li>
					</ul>
				</div>
			</div>
		</div>
		<div id="changelog-version-4" class="changelog-version">
			<div class="changelog-version-header">
				<h1>Version 1.1.1</h1>
				<p class="changelog-version-subtitle">9 December 2025, 16:00 UTC</p>
			</div>
			<div class="changelog-grid">
				<div class="card featured">
					<div class="card-icon"><i class="fas fa-cloud"></i></div>
					<h2>Storage Improvements</h2>
					<p>Cloud storage no longer increases edit count.</p>
					<ul>
						<li>Storing user data will no longer increase the user's edit count when cloud storage is enabled</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-ellipsis"></i></div>
					<h2>Miscellaneous</h2>
					<p>Other changes and improvements.</p>
					<ul>
						<li>The changelog UI has been updated
							<ul>
								<li>All previous changelogs will now be available</li>
							</ul>
						</li>
						<li>Minor data sanitization fixes</li>
					</ul>
				</div>
			</div>
		</div>
		<div id="changelog-version-3" class="changelog-version">
			<div class="changelog-version-header">
				<h1>Version 1.1.0</h1>
				<p class="changelog-version-subtitle">9 December 2025, 00:00 UTC</p>
			</div>
			<div class="changelog-grid">
				<div class="card featured">
					<div class="card-icon"><i class="fas fa-layer-group"></i></div>
					<h2>New Queues!</h2>
					<p>Introducing: pending changes, user creation, and watchlist queues.</p>
					<ul>
						<li>Queues can be toggled and rearranged in the new "Queue" appearance settings page</li>
						<li>Badge icons indicate number of items in each queue</li>
						<li><strong>Note:</strong> The pending changes tab requires the <code>review</code> user right</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-bell"></i></div>
					<h2>Notices & Alerts</h2>
					<p>Multiple improvements to notices and alerts</p>
					<ul>
						<li>All notifications have an updated style to align with Wikipedia</li>
						<li>Notices and alerts have been separated into distinct panels</li>
						<li>Notifications read on WikiShield are now read on Wikipedia</li>
						<li>Added the ability to mark individual notifications as read or unread</li>
						<li>Tab title now includes the number of unread notifications</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-music"></i></div>
					<h2>New Audio</h2>
					<p>Sounds have been updated and music (?!) has been added.</p>
					<ul>
						<li>Sound quality has been improved</li>
						<li>Music has now been added to Zen Mode for some reason...</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-at"></i></div>
					<h2>Username Mentions</h2>
					<p>Improved handling of username mentions</p>
					<ul>
						<li>A new option has been added for fuzzy matching usernames
							<ul>
								<li>Available in the "Gadgets" settings page</li>
								<li>When enabled, WikiShield will match usernames that are <i>similar</i> to your own</li>
							</ul>
						</li>
						<li>Edit summaries now include username mentions</li>
						<li>In the user creation tab, usernames similar to yours are highlighted</li>
						<li>Added an indicator to tab icons when there are edits mentioning your username</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-ban"></i></div>
					<h2>User Blocks</h2>
					<p>More functionality related to user blocks</p>
					<ul>
						<li>Users who are currently blocked now have their name struck through</li>
						<li>Improved block detection, you can now see all the blocks by hovering over the block indicator</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-robot"></i></div>
					<h2>AI Analysis</h2>
					<p>AI analysis has been improved and expanded</p>
					<ul>
						<li>Fine tuning has been done to improve accuracy</li>
						<li>AI analysis is now available in the user creation, pending changes, and watchlist queues</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-list-check"></i></div>
					<h2>Queue Items</h2>
					<p>Various improvements to queue items</p>
					<ul>
						<li>Added ORES score to user contributions and page history items</li>
						<li>Timestamps have been added to queue items</li>
						<li>Cutoff text can now be hovered to see the full text</li>
						<li>Items in the queue should no longer be repeated</li>
						<li>Fixed navigation bugs</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-chart-line"></i></div>
					<h2>Statistics</h2>
					<p>Statistics have been completely revamped</p>
					<ul>
						<li>More detailed statistics have been added</li>
						<li>Fixed various bugs with statistics calculations</li>
						<li>(Yes, this does mean your stats have been reset)</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-palette"></i></div>
					<h2>UI Improvements</h2>
					<p>Various improvements to the user interface</p>
					<ul>
						<li>New welcome screen design</li>
						<li>Multiple new settings options have been added</li>
						<li>Styling has been improved throughout the interface</li>
						<li>Various bug fixes and performance improvements</li>
					</ul>
				</div>
				<div class="card">
					<div class="card-icon"><i class="fas fa-ellipsis"></i></div>
					<h2>Miscellaneous</h2>
					<p>Other changes and improvements</p>
					<ul>
						<li>RfPP now has "Generic" and "Disruptive Edits" subcategories</li>
						<li>Not English warning has been moved to the "Revert" menu</li>
						<li>Removed personal edit count from the bottom tool bar</li>
						<li>"Time ago" now updates dynamically without needing to refresh</li>
						<li>Buttons that cannot be used for the current queue item are now hidden</li>
						<li>Fixed bug related to Zen Mode on startup</li>
						<li>Fixed bug where ORES scores would not load properly</li>
						<li>Changed multiple edit summaries to be more standardized</li>
						<li>Numerous other small bug fixes and improvements</li>
					</ul>
				</div>
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
						<img src="https://upload.wikimedia.org/wikipedia/commons/a/ae/WikiShield_Logo.png" alt="WikiShield Logo">
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
							<span id="notices-count" class="icon-count hidden blue" data-zen-show="badges"></span>
						</span>
						<span class="fa fa-bell" id="alerts-icon" data-tooltip="Alerts" style="position: relative;" data-zen-show="alerts">
							<span id="alerts-count" class="icon-count hidden red" data-zen-show="badges"></span>
						</span>
					</div>
				</div>
				<div id="queue-tabs">
					<div id="queue-tab-recent" class="queue-tab selected" data-tooltip="Recent edits">
						<span class="fas fa-stopwatch" style="position: relative;">
							<span class="icon-count hidden red" data-zen-show="badges"></span>
						</span>
					</div>
					<div id="queue-tab-flagged" class="queue-tab" data-tooltip="Pending edits">
						<span class="fas fa-flag" style="position: relative;">
							<span class="icon-count hidden orange" data-zen-show="badges"></span>
						</span>
					</div>
					<div id="queue-tab-users" class="queue-tab" data-tooltip="User creation logs">
						<span class="fas fa-user" style="position: relative;">
							<span class="icon-count hidden grey" data-zen-show="badges"></span>
						</span>
					</div>
					<div id="queue-tab-watchlist" class="queue-tab" data-tooltip="Watchlist edits">
						<span class="fas fa-book-bookmark" style="position: relative;">
							<span class="icon-count hidden blue" data-zen-show="badges"></span>
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

					<div class="icons"></div>
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
						<div id="bottom-tools" data-queue-type="edit,logevent">
							<div class="bottom-tool-item" data-menu="revert" data-queue-type="edit">
								<div class="bottom-tool-trigger">
									<i class="fas fa-undo"></i>
									<span>Revert & Warn</span>
									<i class="fas fa-chevron-up bottom-tool-chevron"></i>
								</div>
							</div>

							<div class="bottom-tool-item" data-menu="warn" data-queue-type="edit,logevent">
								<div class="bottom-tool-trigger">
									<i class="fas fa-exclamation-triangle"></i>
									<span>Warn</span>
									<i class="fas fa-chevron-up bottom-tool-chevron"></i>
								</div>
							</div>

							<div class="bottom-tool-item" data-menu="user" data-queue-type="edit,logevent">
								<div class="bottom-tool-trigger">
									<i class="fas fa-user"></i>
									<span>User</span>
									<i class="fas fa-chevron-up bottom-tool-chevron"></i>
								</div>
							</div>

							<div class="bottom-tool-item" data-menu="page" data-queue-type="edit">
								<div class="bottom-tool-trigger">
									<i class="fas fa-file-lines"></i>
									<span>Page</span>
									<i class="fas fa-chevron-up bottom-tool-chevron"></i>
								</div>
							</div>

							<div class="bottom-tool-item" data-menu="edit" data-queue-type="edit">
								<div class="bottom-tool-trigger">
									<i class="fas fa-pen-to-square"></i>
									<span>Edit</span>
									<i class="fas fa-chevron-up bottom-tool-chevron"></i>
								</div>
							</div>
						</div>
					</div>
					<div id="right-details">
						<div id="user-contribs" class="right-detail" data-queue-type="edit,logevent">
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
						<div id="right-height-adjust" class="height-adjust" data-queue-type="edit"></div>
						<div id="page-history" class="right-detail" data-queue-type="edit">
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
			<div id="page-watch" class="menu-option submenu-trigger">
				<i class="fas fa-eye"></i>
				<span>Watch page</span>
				<i class="fas fa-chevron-right menu-option-chevron"></i>
				<div class="submenu"></div>
			</div>
			<div id="page-unwatch" class="menu-option">
				<i class="fas fa-eye-slash"></i>
				<span>Unwatch page</span>
			</div>
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
