import { h, Component } from 'preact';
import { formatTime } from '../utils/formatting.js';

class Button extends Component {
    render() {
        const { onClick, children, className } = this.props;
        return (<button onClick={onClick} class={className ?? 'toast-audio-settings-button'}>{children}</button>);
    }
}

export class MusicToast extends Component {
    constructor(props) {
        super(props);

        const audio = props.audio;
        this.state = {
            currentTime: audio?.currentTime ?? 0,
            duration: Number.isFinite(audio?.duration) ? audio.duration : 0,
            playing: audio ? !audio.paused : false,
            // whether playlist controls are available (onPrevious/onNext may be null)
            hasPrevious: !!props.onPrevious,
            hasNext: !!props.onNext,
        };

        this._onTimeUpdate = this._onTimeUpdate.bind(this);
        this._onPlay = this._onPlay.bind(this);
        this._onPause = this._onPause.bind(this);
        this._onLoaded = this._onLoaded.bind(this);
    }

    componentDidMount() {
        this._attachAudioListeners(this.props.audio);
        // Listen for prop changes to update whether prev/next available
        this.setState({
            hasPrevious: !!this.props.onPrevious,
            hasNext: !!this.props.onNext,
        });
    }

    componentWillUnmount() {
        this._detachAudioListeners(this.props.audio);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.audio !== this.props.audio) {
            this._detachAudioListeners(prevProps.audio);
            this._attachAudioListeners(this.props.audio);

            const audio = this.props.audio;
            this.setState({
                currentTime: audio?.currentTime ?? 0,
                duration: Number.isFinite(audio?.duration) ? audio.duration : 0,
                playing: audio ? !audio.paused : false,
            });
        }

        // update control availability if handlers changed
        if (prevProps.onPrevious !== this.props.onPrevious || prevProps.onNext !== this.props.onNext) {
            this.setState({
                hasPrevious: !!this.props.onPrevious,
                hasNext: !!this.props.onNext,
            });
        }
    }

    _attachAudioListeners(audio) {
        if (!audio) return;
        audio.addEventListener('timeupdate', this._onTimeUpdate);
        audio.addEventListener('play', this._onPlay);
        audio.addEventListener('pause', this._onPause);
        audio.addEventListener('loadedmetadata', this._onLoaded);
        // If audio ends, update UI
        audio.addEventListener('ended', () => this.setState({ playing: false }));
    }

    _detachAudioListeners(audio) {
        if (!audio) return;
        audio.removeEventListener('timeupdate', this._onTimeUpdate);
        audio.removeEventListener('play', this._onPlay);
        audio.removeEventListener('pause', this._onPause);
        audio.removeEventListener('loadedmetadata', this._onLoaded);
    }

    _onTimeUpdate(e) {
        const audio = e.target || this.props.audio;
        if (!audio) return;
        this.setState({ currentTime: audio.currentTime });
    }

    _onPlay() {
        this.setState({ playing: true });
    }

    _onPause() {
        this.setState({ playing: false });
    }

    _onLoaded(e) {
        const audio = e.target || this.props.audio;
        if (!audio) return;
        if (Number.isFinite(audio.duration)) {
            this.setState({ duration: audio.duration });
        }
    }

    render() {
        const {
            title,
            artist,
            thumbnail,

            onPrevious,
            onNext,
        } = this.props;

        const { currentTime, duration, hasNext } = this.state;

        const percent = duration > 0 && Number.isFinite(duration) ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;

        const displayCurrent = Number.isFinite(currentTime) ? formatTime(currentTime) : '0:00';
        const displayDuration = duration > 0 && Number.isFinite(duration) ? formatTime(duration) : '0:00';

        return (
            <div class="music-toast">
                <div class="music-toast-header">
                    <div class="music-toast-info">
                        {thumbnail && (
                            <div class="music-toast-thumbnail">
                                <img src={thumbnail} alt="Thumbnail" />
                            </div>
                        )}
                        <div class="music-toast-details">
                            <div class="music-toast-title">{title}</div>
                            <div class="music-toast-artist">{artist}</div>
                        </div>
                    </div>
                    <div class="music-toast-controls">
                        <Button onClick={onPrevious}><span class="fas fa-backward"></span></Button>
                        <Button onClick={onNext}><span class="fas fa-forward"></span></Button>
                    </div>
                </div>
                <div class="music-toast-progress">
                    <div class="music-toast-progress-bar" aria-hidden="true">
                        <div class="music-toast-progress-fill" style={{ width: `${percent}%` }}></div>
                    </div>
                    <div class="music-toast-time">
                        <div class="music-toast-time-current">{displayCurrent}</div>
                        <div class="music-toast-time-duration">{displayDuration}</div>
                    </div>
                </div>
            </div>
        );
    }
}