/**
 * React/Preact components for WikiShield settings interface
 */

import { h, Component } from 'preact';

/**
 * Toggle Switch Component
 */
export class Toggle extends Component {
	render() {
		const { value, onChange, label, description } = this.props;

		return (
			<div
				class={`settings-toggle ${value ? 'active' : ''}`}
				onClick={() => onChange(!value)}
			>
				<div class="toggle-switch">
					<div class="toggle-slider"></div>
				</div>
			</div>
		);
	}
}

/**
 * Numeric Input Component
 */
export class NumericInput extends Component {
	constructor(props) {
		super(props);
		this.state = {
			inputValue: props.value
		};
	}

	componentDidUpdate(prevProps) {
		if (prevProps.value !== this.props.value) {
			this.setState({ inputValue: this.props.value });
		}
	}

	handleMinus = () => {
		const { min, step, onChange } = this.props;
		const currentValue = Number(this.state.inputValue);
		const newValue = Math.round(Math.max(currentValue - step, min) * 100) / 100;
		this.setState({ inputValue: newValue });
		onChange(newValue);
	}

	handlePlus = () => {
		const { max, step, onChange } = this.props;
		const currentValue = Number(this.state.inputValue);
		const newValue = Math.round(Math.min(currentValue + step, max) * 100) / 100;
		this.setState({ inputValue: newValue });
		onChange(newValue);
	}

	handleInputChange = () => {
		const { min, max, step, onChange } = this.props;
		const { inputValue } = this.state;

		if (isNaN(Number(inputValue))) {
			this.setState({ inputValue: this.props.value });
			return;
		}

		let newValue = Math.round(Math.min(Math.max(Number(inputValue), min), max) * 100) / 100;
		newValue = step >= 1 ? Math.round(newValue) : newValue;

		this.setState({ inputValue: newValue });
		onChange(newValue);
	}

	handleKeyUp = (e) => {
		if (e.key.toLowerCase() === "enter") {
			this.handleInputChange();
			e.target.blur();
		}
	}

	render() {
		const { inputValue } = this.state;

		return (
			<div class="numeric-input-container">
				<span
					class="fa fa-minus numeric-input-button"
					onClick={this.handleMinus}
				></span>
				<input
					type="text"
					class="numeric-input"
					value={inputValue}
					onInput={(e) => this.setState({ inputValue: e.target.value })}
					onBlur={this.handleInputChange}
					onKeyUp={this.handleKeyUp}
				/>
				<span
					class="fa fa-plus numeric-input-button"
					onClick={this.handlePlus}
				></span>
			</div>
		);
	}
}

/**
 * Volume Control Component
 */
export class VolumeControl extends Component {
	constructor(props) {
		super(props);
		this.state = {
			currentSound: props.currentSound || props.triggerKey
		};
	}

	playSound = () => {
		const { playFunction } = this.props;
		if (playFunction) playFunction();
	}

	render() {
		const { title, description, value, soundOptions, onVolumeChange, onSoundChange, sounds } = this.props;
		const { currentSound } = this.state;

		return (
			<div class="audio-volume-control">
				<div class="volume-control-header">
					<div class="volume-control-info">
						<div class="volume-control-title">{title}</div>
						<div class="volume-control-desc">{description}</div>
					</div>
					<button
						class="volume-control-preview"
						onClick={this.playSound}
						title="Preview sound"
					>
						<span class="fa fa-play"></span>
					</button>
				</div>

				<div class="volume-control-main">
					<select
						class="volume-control-sound-select"
						value={currentSound}
						onChange={(e) => {
							this.setState({ currentSound: e.target.value });
							onSoundChange(e.target.value);
						}}
					>
						{soundOptions}
					</select>

					<div class="volume-control-slider-container">
						<span class="fa fa-volume-down"></span>
						<input
							type="range"
							class="volume-control-slider"
							min="0"
							max="1"
							step="0.01"
							value={value}
							onInput={(e) => onVolumeChange(parseFloat(e.target.value))}
						/>
						<span class="fa fa-volume-up"></span>
						<span class="volume-control-value">{Math.round(value * 100)}%</span>
					</div>
				</div>
			</div>
		);
	}
}

/**
 * Settings Section Component
 */
export class SettingsSection extends Component {
	render() {
		const { title, description, compact, children, id } = this.props;

		return (
			<div class={`settings-section ${compact ? 'compact' : ''}`} id={id}>
				{title && <div class="settings-section-title">{title}</div>}
				{description && <div class="settings-section-desc">{description}</div>}
				{children}
			</div>
		);
	}
}

/**
 * Settings Compact Grid Component
 */
export class SettingsCompactGrid extends Component {
	render() {
		return (
			<div class="settings-compact-grid">
				{this.props.children}
			</div>
		);
	}
}

/**
 * General Settings Panel Component
 */
export class GeneralSettings extends Component {
	render() {
		const {
			maxEditCount,
			maxQueueSize,
			minOresScore,
			watchlistExpiry,
			highlightedExpiry,
			namespaces,
			selectedNamespaces,
			enableUsernameHighlighting,
			onMaxEditCountChange,
			onMaxQueueSizeChange,
			onMinOresScoreChange,
			onWatchlistExpiryChange,
			onHighlightedExpiryChange,
			onNamespaceToggle,
			onUsernameHighlightingChange
		} = this.props;

		return (
			<div>
				<SettingsCompactGrid>
					<SettingsSection
						compact
						id="maximum-edit-count"
						title="Maximum edit count"
						description="Edits from users with more than this edit count will not be shown"
					>
						<NumericInput
							value={maxEditCount}
							min={0}
							max={100000}
							step={100}
							onChange={onMaxEditCountChange}
						/>
					</SettingsSection>

					<SettingsSection
						compact
						id="maximum-queue-size"
						title="Maximum queue size"
						description="The queue will not load additional edits after reaching this size"
					>
						<NumericInput
							value={maxQueueSize}
							min={1}
							max={500}
							step={1}
							onChange={onMaxQueueSizeChange}
						/>
					</SettingsSection>

					<SettingsSection
						compact
						id="minimum-ores-score"
						title="Minimum ORES score"
						description={
							<span>
								Edits with an <a href="https://www.mediawiki.org/wiki/ORES" target="_blank">ORES score</a> below this threshold will not be shown
							</span>
						}
					>
						<NumericInput
							value={minOresScore}
							min={0}
							max={1}
							step={0.01}
							onChange={onMinOresScoreChange}
						/>
					</SettingsSection>
				</SettingsCompactGrid>

				<SettingsSection title="Expiries">
					<SettingsCompactGrid>
						<SettingsSection
							compact
							id="watchlist-expiry"
							title="Watchlist expiry for warned users"
							description="How long to watch user talk pages after issuing warnings"
						>
							<select
								value={watchlistExpiry}
								onChange={(e) => onWatchlistExpiryChange(e.target.value)}
							>
								<option value="none">None</option>
								<option value="1 hour">1 hour</option>
								<option value="1 day">1 day</option>
								<option value="1 week">1 week</option>
								<option value="1 month">1 month</option>
								<option value="3 months">3 months</option>
								<option value="6 months">6 months</option>
								<option value="indefinite">Indefinite</option>
							</select>
						</SettingsSection>

						<SettingsSection
							compact
							id="highlighted-expiry"
							title="Highlighted user expiry"
							description="How long to keep users highlighted before expiration"
						>
							<select
								value={highlightedExpiry}
								onChange={(e) => onHighlightedExpiryChange(e.target.value)}
							>
								<option value="none">None</option>
								<option value="1 hour">1 hour</option>
								<option value="1 day">1 day</option>
								<option value="1 week">1 week</option>
								<option value="1 month">1 month</option>
								<option value="3 months">3 months</option>
								<option value="6 months">6 months</option>
								<option value="indefinite">Indefinite</option>
							</select>
						</SettingsSection>
					</SettingsCompactGrid>
				</SettingsSection>

				<SettingsSection
					title="Namespaces to show"
					description="Only edits from the selected namespaces will be shown in your queue."
				>
					<div id="namespace-container">
						{Object.entries(namespaces).map(([key, namespace]) => (
							<div class="namespace-item" key={key}>
								<label>
									<input
										type="checkbox"
										checked={selectedNamespaces.includes(parseInt(key))}
										onChange={(e) => onNamespaceToggle(parseInt(key), e.target.checked)}
									/>
									<span class="namespace-label">{namespace.name}</span>
								</label>
							</div>
						))}
					</div>
				</SettingsSection>

				<SettingsSection
					title="Username Highlighting"
					description="Highlight edits that contain your username in the diff"
				>
					<Toggle
						value={enableUsernameHighlighting}
						onChange={onUsernameHighlightingChange}
					/>
				</SettingsSection>
			</div>
		);
	}
}

/**
 * Audio Settings Panel Component
 */
export class AudioSettings extends Component {
	render() {
		const {
			volumes,
			soundMappings,
			sounds,
			onVolumeChange,
			onSoundChange,
			playSound
		} = this.props;

		// Build sound selector options grouped by category
		const soundsByCategory = {};
		Object.entries(sounds).forEach(([key, sound]) => {
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

		const buildSoundOptions = () => {
			const options = [];
			options.push(<option value="none">🔇 Disabled</option>);

			categoryOrder.forEach(category => {
				if (soundsByCategory[category]) {
					const categoryItems = soundsByCategory[category].map(({ key, sound }) => (
						<option value={key} key={key}>
							{sound.icon || '🔊'} {sound.name || key}
						</option>
					));
					options.push(
						<optgroup label={categoryNames[category] || category} key={category}>
							{categoryItems}
						</optgroup>
					);
				}
			});

			return options;
		};

		const soundOptions = buildSoundOptions();

		const audioControls = [
			{ key: 'click', title: 'Button Click Sound', description: 'Played when clicking buttons' },
			{ key: 'alert', title: 'Alert Sound', description: 'Played for important alerts' },
			{ key: 'sparkle', title: 'Sparkle Sound', description: 'Played for positive actions' },
			{ key: 'error', title: 'Error Sound', description: 'Played when an error occurs' },
			{ key: 'notification', title: 'Notification Sound', description: 'Played for new notifications' },
			{ key: 'warning', title: 'Warning Sound', description: 'Played when issuing warnings' },
			{ key: 'rollback', title: 'Rollback Sound', description: 'Played when rolling back edits' },
			{ key: 'queue', title: 'Queue Update Sound', description: 'Played when the queue updates' }
		];

		return (
			<div>
				<SettingsSection
					title="Audio Controls"
					description="Configure volume and sounds for different actions"
				>
					{audioControls.map(({ key, title, description }) => (
						<VolumeControl
							key={key}
							triggerKey={key}
							title={title}
							description={description}
							value={volumes[key] ?? 0.5}
							currentSound={soundMappings[key] || key}
							soundOptions={soundOptions}
							sounds={sounds}
							onVolumeChange={(value) => onVolumeChange(key, value)}
							onSoundChange={(soundKey) => onSoundChange(key, soundKey)}
							playFunction={() => playSound(key)}
						/>
					))}
				</SettingsSection>
			</div>
		);
	}
}

/**
 * Appearance Settings Panel Component
 */
export class AppearanceSettings extends Component {
	constructor(props) {
		super(props);
		this.state = {
			selectedPalette: props.selectedPalette
		};
	}

	handlePaletteChange = (index) => {
		this.setState({ selectedPalette: index });
		this.props.onPaletteChange(index);
	}

	render() {
		const { colorPalettes } = this.props;
		const { selectedPalette } = this.state;

		return (
			<div>
				<SettingsSection
					title="Color Palette"
					description="Choose how ORES scores are displayed visually"
				>
					<div class="palette-selector">
						{colorPalettes.map((colors, index) => (
							<div
								key={index}
								class={`palette-option ${selectedPalette === index ? 'selected' : ''}`}
								onClick={() => this.handlePaletteChange(index)}
							>
								<div class="palette-preview">
									{colors.map((color, i) => (
										<div
											key={i}
											class="palette-color"
											style={{ backgroundColor: color }}
										/>
									))}
								</div>
								<div class="palette-name">Palette {index + 1}</div>
							</div>
						))}
					</div>
				</SettingsSection>
			</div>
		);
	}
}

/**
 * User List Component (for whitelist/highlighted users)
 */
export class UserList extends Component {
	render() {
		const { users, onRemove, showDates } = this.props;

		if (users.length === 0) {
			return <div class="user-list-empty">No users in this list</div>;
		}

		return (
			<div class="user-list">
				{users.map((user) => (
					<div class="user-list-item" key={user.name}>
						<span class="user-list-name">{user.name}</span>
						{showDates && user.date && (
							<span class="user-list-date">{new Date(user.date).toLocaleDateString()}</span>
						)}
						<button
							class="user-list-remove"
							onClick={() => onRemove(user.name)}
							title="Remove user"
						>
							<span class="fa fa-times"></span>
						</button>
					</div>
				))}
			</div>
		);
	}
}

/**
 * Whitelist Panel Component
 */
export class WhitelistSettings extends Component {
	constructor(props) {
		super(props);
		this.state = {
			newUsername: ''
		};
	}

	handleAdd = () => {
		const { newUsername } = this.state;
		if (newUsername.trim()) {
			this.props.onAdd(newUsername.trim());
			this.setState({ newUsername: '' });
		}
	}

	render() {
		const { users, onRemove } = this.props;
		const { newUsername } = this.state;

		return (
			<div>
				<SettingsSection
					title="Whitelist"
					description="Users on the whitelist will not appear in your queue"
				>
					<div class="user-list-controls">
						<input
							type="text"
							class="user-list-input"
							placeholder="Enter username..."
							value={newUsername}
							onInput={(e) => this.setState({ newUsername: e.target.value })}
							onKeyDown={(e) => {
								if (e.key === 'Enter') this.handleAdd();
							}}
						/>
						<button
							class="user-list-add-button"
							onClick={this.handleAdd}
						>
							<span class="fa fa-plus"></span> Add User
						</button>
					</div>
					<UserList
						users={users}
						onRemove={onRemove}
						showDates={true}
					/>
				</SettingsSection>
			</div>
		);
	}
}

/**
 * Highlighted Users Panel Component
 */
export class HighlightedSettings extends Component {
	constructor(props) {
		super(props);
		this.state = {
			newUsername: ''
		};
	}

	handleAdd = () => {
		const { newUsername } = this.state;
		if (newUsername.trim()) {
			this.props.onAdd(newUsername.trim());
			this.setState({ newUsername: '' });
		}
	}

	render() {
		const { users, onRemove } = this.props;
		const { newUsername } = this.state;

		return (
			<div>
				<SettingsSection
					title="Highlighted Users"
					description="Edits from highlighted users will be shown with a yellow indicator"
				>
					<div class="user-list-controls">
						<input
							type="text"
							class="user-list-input"
							placeholder="Enter username..."
							value={newUsername}
							onInput={(e) => this.setState({ newUsername: e.target.value })}
							onKeyDown={(e) => {
								if (e.key === 'Enter') this.handleAdd();
							}}
						/>
						<button
							class="user-list-add-button"
							onClick={this.handleAdd}
						>
							<span class="fa fa-plus"></span> Add User
						</button>
					</div>
					<UserList
						users={users}
						onRemove={onRemove}
						showDates={true}
					/>
				</SettingsSection>
			</div>
		);
	}
}

/**
 * Statistics Panel Component
 */
export class StatisticsSettings extends Component {
	render() {
		const { stats } = this.props;

		return (
			<div>
				<SettingsSection
					title="Your Statistics"
					description="Your WikiShield usage statistics"
				>
					<div class="stats-grid">
						<div class="stat-item">
							<div class="stat-value">{stats.editsReviewed || 0}</div>
							<div class="stat-label">Edits Reviewed</div>
						</div>
						<div class="stat-item">
							<div class="stat-value">{stats.editsReverted || 0}</div>
							<div class="stat-label">Edits Reverted</div>
						</div>
						<div class="stat-item">
							<div class="stat-value">{stats.warningsIssued || 0}</div>
							<div class="stat-label">Warnings Issued</div>
						</div>
						<div class="stat-item">
							<div class="stat-value">{stats.usersReported || 0}</div>
							<div class="stat-label">Users Reported</div>
						</div>
						<div class="stat-item">
							<div class="stat-value">{stats.pagesProtected || 0}</div>
							<div class="stat-label">Pages Protected</div>
						</div>
						<div class="stat-item">
							<div class="stat-value">{stats.thanksGiven || 0}</div>
							<div class="stat-label">Thanks Given</div>
						</div>
					</div>
				</SettingsSection>
			</div>
		);
	}
}

/**
 * AI Settings Panel Component
 */
export class AISettings extends Component {
	constructor(props) {
		super(props);
		this.state = {
			connectionStatus: '',
			modelsStatus: '',
			availableModels: [],
			testingConnection: false,
			loadingModels: false
		};
	}

	testConnection = async () => {
		const { ollamaServerUrl, onTestConnection } = this.props;
		this.setState({ testingConnection: true, connectionStatus: 'Testing...' });

		const result = await onTestConnection();

		this.setState({
			testingConnection: false,
			connectionStatus: result ? 'Connected!' : 'Failed to connect'
		});
	}

	refreshModels = async () => {
		const { onRefreshModels } = this.props;
		this.setState({ loadingModels: true, modelsStatus: 'Loading...' });

		const models = await onRefreshModels();

		this.setState({
			loadingModels: false,
			availableModels: models || [],
			modelsStatus: models ? `Found ${models.length} models` : 'Failed to load models'
		});
	}

	render() {
		const {
			enableOllamaAI,
			ollamaServerUrl,
			selectedModel,
			onEnableChange,
			onServerUrlChange,
			onModelSelect
		} = this.props;

		const { connectionStatus, modelsStatus, availableModels, testingConnection, loadingModels } = this.state;

		return (
			<div>
				<SettingsSection
					id="enable-ollama-ai"
					title="Enable Ollama AI Analysis"
					description="Use local AI models with complete privacy. Free & fast."
				>
					<Toggle
						value={enableOllamaAI}
						onChange={onEnableChange}
					/>
				</SettingsSection>

				<SettingsSection
					id="ollama-server-url"
					title="Server URL"
				>
					<div class="ollama-url-controls">
						<input
							type="text"
							id="ollama-url-input"
							value={ollamaServerUrl}
							onInput={(e) => onServerUrlChange(e.target.value)}
							placeholder="http://localhost:11434"
							style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; margin-bottom: 8px;"
						/>
						<button
							id="test-connection-btn"
							onClick={this.testConnection}
							disabled={testingConnection}
							style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em;"
						>
							Test Connection
						</button>
						<span id="connection-status" style="margin-left: 8px; font-size: 0.9em;">
							{connectionStatus}
						</span>
					</div>
				</SettingsSection>

				<SettingsSection
					id="ollama-model-select"
					title="Model Selection"
				>
					<div class="ollama-model-controls">
						<button
							id="refresh-models-btn"
							onClick={this.refreshModels}
							disabled={loadingModels}
							style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9em;"
						>
							<span class="fa fa-sync"></span> Refresh Models
						</button>
						<span id="models-status" style="margin-left: 8px; font-size: 0.9em;">
							{modelsStatus}
						</span>
						<div style="margin-top: 12px;" id="models-container">
							{availableModels.length === 0 ? (
								<div style="color: #666; font-style: italic; font-size: 0.9em;">
									Click "Refresh Models" to load available models
								</div>
							) : (
								<div class="models-list">
									{availableModels.map((model) => (
										<div
											key={model.name}
											class={`model-item ${selectedModel === model.name ? 'selected' : ''}`}
											onClick={() => onModelSelect(model.name)}
										>
											<div class="model-name">{model.name}</div>
											<div class="model-size">{model.size}</div>
										</div>
									))}
								</div>
							)}
						</div>
					</div>
				</SettingsSection>

				<SettingsSection>
					<div class="settings-section-title" style="color: #dc3545;">CORS Setup Required</div>
					<div class="settings-section-desc" style="background: rgba(255, 243, 205, 0.2); padding: 10px; border-radius: 6px; border-left: 4px solid #ffc107; font-size: 0.9em;">
						<strong>Set environment variable:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; color: #333;">OLLAMA_ORIGINS</code>
						<br /><strong>Value:</strong> <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; color: #333;">https://en.wikipedia.org,https://*.wikipedia.org</code>
						<br /><br />
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
							<pre style="background: #2d2d2d; color: #f8f8f2; padding: 8px; border-radius: 4px; font-size: 0.8em; margin: 6px 0;">{`$env:OLLAMA_ORIGINS="https://en.wikipedia.org,https://*.wikipedia.org"
ollama serve`}</pre>
						</details>
						<details style="cursor: pointer;">
							<summary style="font-weight: 600; margin-bottom: 6px;">macOS/Linux</summary>
							Add to <code>~/.bashrc</code> or <code>~/.zshrc</code>:
							<pre style="background: #2d2d2d; color: #f8f8f2; padding: 8px; border-radius: 4px; font-size: 0.8em; margin: 6px 0;">{`export OLLAMA_ORIGINS="https://en.wikipedia.org,https://*.wikipedia.org"`}</pre>
							Then: <code>source ~/.bashrc && ollama serve</code>
						</details>
					</div>
				</SettingsSection>

				<SettingsSection title="Quick Info">
					<div class="settings-section-desc" style="font-size: 0.9em;">
						<strong>Get Ollama:</strong> <a href="https://ollama.com" target="_blank" style="color: #667eea; font-weight: bold;">ollama.com</a>
						<br /><strong>Popular models:</strong> llama3.2, mistral, gemma2, qwen2.5
						<br /><strong>Detects:</strong> Vandalism, spam, POV, attacks, copyright issues, policy violations
					</div>
				</SettingsSection>
			</div>
		);
	}
}

/**
 * Import/Export Settings Panel Component
 */
export class ImportExportSettings extends Component {
	constructor(props) {
		super(props);
		this.state = {
			showImportInput: false,
			importValue: '',
			statusMessage: null
		};
	}

	handleExport = () => {
		try {
			const result = this.props.onExport();
			this.setState({
				statusMessage: {
					type: 'success',
					title: 'Settings exported successfully!',
					message: 'The base64 string has been copied to your clipboard.'
				}
			});
			setTimeout(() => this.setState({ statusMessage: null }), 5000);
		} catch (error) {
			this.setState({
				statusMessage: {
					type: 'error',
					title: 'Export failed!',
					message: error.message
				}
			});
		}
	}

	handleImportToggle = () => {
		if (!this.state.showImportInput) {
			this.setState({ showImportInput: true, statusMessage: null });
		} else {
			this.handleImportApply();
		}
	}

	handleImportApply = () => {
		const { importValue } = this.state;

		if (!importValue.trim()) {
			this.setState({
				statusMessage: {
					type: 'error',
					title: 'No input!',
					message: 'Please paste a base64 settings string.'
				}
			});
			return;
		}

		try {
			const result = this.props.onImport(importValue);

			let warningsHtml = '';
			if (result.warnings && result.warnings.length > 0) {
				warningsHtml = `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(40, 167, 69, 0.3);">
					<strong>Warnings:</strong>
					<ul style="margin: 4px 0 0 20px; font-size: 0.9em;">
						${result.warnings.map(w => `<li>${w}</li>`).join('')}
					</ul>
				</div>`;
			}

			this.setState({
				statusMessage: {
					type: 'success',
					title: 'Settings imported successfully!',
					message: 'Please reload the page for all changes to take effect.',
					extra: warningsHtml
				},
				showImportInput: false,
				importValue: ''
			});
		} catch (error) {
			this.setState({
				statusMessage: {
					type: 'error',
					title: 'Import failed!',
					message: error.message
				}
			});
		}
	}

	handleReset = async () => {
		if (await this.props.onReset()) {
			this.setState({
				statusMessage: {
					type: 'success',
					title: 'Settings reset successfully!',
					message: 'All settings have been restored to default values.'
				}
			});
		}
	}

	render() {
		const { showImportInput, importValue, statusMessage } = this.state;

		return (
			<div>
				<SettingsSection
					title="Import/Export Settings"
					description="Import, export, or reset your WikiShield settings. Settings are encoded as a base64 string for easy sharing."
				>
					<div style="display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap;">
						<button
							id="export-settings-btn"
							class="add-action-button"
							onClick={this.handleExport}
							style="flex: 1; min-width: 120px;"
						>
							<span class="fa fa-download"></span> Export Settings
						</button>
						<button
							id="import-settings-btn"
							class="add-action-button"
							onClick={this.handleImportToggle}
							style={`flex: 1; min-width: 120px; ${showImportInput ? 'background: #28a745;' : ''}`}
						>
							<span class={`fa ${showImportInput ? 'fa-check' : 'fa-upload'}`}></span>
							{showImportInput ? ' Apply Import' : ' Import Settings'}
						</button>
						<button
							id="reset-settings-btn"
							class="add-action-button"
							onClick={this.handleReset}
							style="flex: 1; min-width: 120px; background: #dc3545;"
						>
							<span class="fa fa-undo"></span> Reset to Default
						</button>
					</div>

					{statusMessage && (
						<div
							id="import-export-status"
							style={`
								margin-top: 12px;
								padding: 12px;
								border-radius: 6px;
								background: ${statusMessage.type === 'success' ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)'};
								border: 2px solid ${statusMessage.type === 'success' ? '#28a745' : '#dc3545'};
								color: ${statusMessage.type === 'success' ? '#28a745' : '#dc3545'};
							`}
						>
							<div style="display: flex; align-items: start; gap: 8px;">
								<span class={`fa ${statusMessage.type === 'success' ? 'fa-check-circle' : 'fa-times-circle'}`} style="margin-top: 2px;"></span>
								<div style="flex: 1;">
									<strong>{statusMessage.title}</strong>
									<div style="font-size: 0.9em; margin-top: 4px;">{statusMessage.message}</div>
									{statusMessage.extra && (
										<div dangerouslySetInnerHTML={{ __html: statusMessage.extra }} />
									)}
								</div>
							</div>
						</div>
					)}

					{showImportInput && (
						<textarea
							id="import-settings-input"
							placeholder="Paste base64 settings string here..."
							value={importValue}
							onInput={(e) => this.setState({ importValue: e.target.value })}
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
							"
						/>
					)}
				</SettingsSection>
			</div>
		);
	}
}

/**
 * About Panel Component
 */
export class AboutSettings extends Component {
	render() {
		const { version, changelog } = this.props;

		return (
			<div>
				<SettingsSection title="About WikiShield">
					<div class="about-content">
						<div class="about-version">
							<span class="fa fa-shield-alt"></span>
							<span>WikiShield v{version}</span>
						</div>
						<div class="about-description">
							<p>WikiShield is a powerful tool for patrolling Wikipedia edits in real-time.</p>
							<p>Developed with ❤️ for the Wikipedia community.</p>
						</div>
						<div class="about-links">
							<a href="https://en.wikipedia.org/wiki/User:MonkeysmashingKeyboards/WikiShield" target="_blank">
								<span class="fa fa-book"></span> Documentation
							</a>
							<a href="https://github.com/monkeysmashingkeyboards/WikiShield" target="_blank">
								<span class="fa fa-code-branch"></span> Source Code
							</a>
							<a href="https://en.wikipedia.org/wiki/User_talk:MonkeysmashingKeyboards" target="_blank">
								<span class="fa fa-comments"></span> Feedback
							</a>
						</div>
					</div>
				</SettingsSection>

				{changelog && (
					<SettingsSection title="Changelog">
						<div class="changelog-content" dangerouslySetInnerHTML={{ __html: changelog }} />
					</SettingsSection>
				)}
			</div>
		);
	}
}
