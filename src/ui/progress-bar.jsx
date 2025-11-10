/**
 * WikiShieldProgressBar - React/Preact component for progress indicators
 * Provides both a React component and an imperative API for backward compatibility
 */
import { h, Component } from 'preact';
import { render } from 'preact';

/**
 * Progress Bar Component
 */
class ProgressBarComponent extends Component {
	constructor(props) {
		super(props);
		this.state = {
			text: '',
			width: 0,
			color: 'var(--main-blue)',
			opacity: 1,
			isVisible: true
		};
	}

	componentDidMount() {
		// Notify parent that component is ready
		if (this.props.onMount) {
			this.props.onMount(this);
		}
	}

	/**
	 * Update the progress bar
	 * @param {String} text The text to display
	 * @param {Number} width Percentage (0-1)
	 * @param {String} color CSS color for the bar
	 */
	updateProgress(text, width, color) {
		this.setState({
			text,
			width: Math.round(width * 100),
			color,
			opacity: 1,
			isVisible: true
		});

		// Auto-remove when complete
		if (width === 1) {
			this.scheduleRemoval(2000);
		}
	}

	/**
	 * Schedule removal of the progress bar
	 * @param {Number} time Time in ms before removal
	 */
	scheduleRemoval(time) {
		// Fade out
		setTimeout(() => {
			this.setState({ opacity: 0 });
		}, time - 300);

		// Remove
		setTimeout(() => {
			this.setState({ isVisible: false });
			if (this.props.onRemove) {
				this.props.onRemove();
			}
		}, time);
	}

	render() {
		const { text, width, color, opacity, isVisible } = this.state;

		if (!isVisible) {
			return null;
		}

		return (
			<div 
				className="progress-bar" 
				style={{ opacity, transition: 'opacity 0.3s ease' }}
			>
				<div 
					className="progress-bar-overlay"
					style={{ 
						width: `${width}%`,
						background: color,
						transition: 'width 0.2s ease, background 0.2s ease'
					}}
				/>
				<div className="progress-bar-text">
					{text}
				</div>
			</div>
		);
	}
}

/**
 * Imperative API wrapper for WikiShieldProgressBar
 * Maintains backward compatibility with the original class-based API
 */
export class WikiShieldProgressBar {
	constructor() {
		this.nextChangeTime = 0;
		this.updateQueue = [];
		this.componentRef = null;

		// Find or create container
		this.container = document.querySelector('#progress-bar-container');
		if (!this.container) {
			console.warn('Progress bar container not found');
			return;
		}

		// Create a wrapper div for this progress bar instance
		this.element = document.createElement('div');
		this.container.appendChild(this.element);

		// Render the React component
		render(
			<ProgressBarComponent 
				onMount={(ref) => {
					this.componentRef = ref;
					this.processQueue();
				}}
				onRemove={() => {
					this.cleanup();
				}}
			/>,
			this.element
		);
	}

	/**
	 * Set the progress bar
	 * @param {String} text The text to display
	 * @param {Number} width Percentage (0-1)
	 * @param {String} color CSS color for the bar
	 */
	set(text, width, color) {
		const delay = Math.max(0, this.nextChangeTime - Date.now());

		this.updateQueue.push({
			text,
			width,
			color,
			delay
		});

		this.nextChangeTime = Math.max(Date.now() + 200, this.nextChangeTime + 200);

		// Process queue if component is ready
		if (this.componentRef) {
			this.processQueue();
		}
	}

	/**
	 * Process queued updates
	 */
	processQueue() {
		while (this.updateQueue.length > 0 && this.componentRef) {
			const update = this.updateQueue.shift();
			
			setTimeout(() => {
				if (this.componentRef) {
					this.componentRef.updateProgress(update.text, update.width, update.color);
				}
			}, update.delay);
		}
	}

	/**
	 * Remove the progress bar after a given time
	 * @param {Number} time The time to wait before removing the progress bar
	 */
	remove(time) {
		if (this.componentRef) {
			this.componentRef.scheduleRemoval(time);
		}
	}

	/**
	 * Cleanup when removing
	 */
	cleanup() {
		if (this.element && this.element.parentNode) {
			// Unmount React component and remove element
			render(null, this.element);
			this.element.parentNode.removeChild(this.element);
		}
		this.componentRef = null;
		this.updateQueue = [];
	}
}

/**
 * React Hook for using progress bars in functional components
 * Example usage:
 * 
 * const MyComponent = () => {
 *   const [progress, setProgress] = useProgressBar();
 *   
 *   const doWork = async () => {
 *     setProgress('Working...', 0.5, 'blue');
 *     await someAsyncWork();
 *     setProgress('Done!', 1.0, 'green');
 *   };
 *   
 *   return <button onClick={doWork}>Start</button>;
 * };
 */
export function useProgressBar() {
	const progressBarRef = { current: null };

	const setProgress = (text, width, color = 'var(--main-blue)') => {
		if (!progressBarRef.current) {
			progressBarRef.current = new WikiShieldProgressBar();
		}
		progressBarRef.current.set(text, width, color);
	};

	return [progressBarRef, setProgress];
}

/**
 * Functional component version for direct use in JSX
 * Example:
 * 
 * <ProgressBar text="Loading..." width={0.5} color="blue" />
 */
export const ProgressBar = ({ text, width, color = 'var(--main-blue)', onComplete }) => {
	return (
		<div className="progress-bar">
			<div 
				className="progress-bar-overlay"
				style={{ 
					width: `${Math.round(width * 100)}%`,
					background: color,
					transition: 'width 0.2s ease'
				}}
			/>
			<div className="progress-bar-text">
				{text}
			</div>
		</div>
	);
};

