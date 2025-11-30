import { h, render } from 'preact';
import { MusicToast } from "./toast.jsx";

import { _dev_alert } from './sfx/_dev.js';

import { startup } from "./sfx/startup.js";

import { click } from "./sfx/click.js";
import { link } from "./sfx/link.js";
import { select } from "./sfx/select.js";

import { alert } from "./sfx/alert.js";
import { notice } from "./sfx/notice.js";
import { ores } from "./sfx/ores.js";
import { mention } from "./sfx/mention.js";

import { action } from "./sfx/action.js";
import { warn } from "./sfx/warn.js";
import { report } from "./sfx/report.js";
import { type } from 'jquery';
import { generateRandomUUID } from '../utils/UUID.js';

const audio = {
    _dev_alert: {
        type: "sound",
        volume: 1,
        data: _dev_alert
    },
    startup: {
        type: "sound",
        title: "Startup Sound",
        description: "Sound played when WikiShield starts up.",
        volume: 1,
        data: startup
    },
    music: {
        type: "category",
        title: "Music",
        description: "Background music tracks.",
        volume: 1,
        properties: {
            zen_mode: {
                type: "playlist",
                title: "Zen Mode Music",
                description: "Music played in Zen mode.",
                volume: 1,
                tracks: [
                    {
                        type: "music",
                        title: "Whispers of Memories",
                        artist: "Restum-Anoush",
                        thumbnail: "https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png",
                        length: 126,
                        data: "https://media.luni.me/audio/music/whispers-of-memories",
                    },
                    {
                        type: "music",
                        title: "Perfect Beauty",
                        artist: "Grand Project",
                        thumbnail: "https://media.luni.me/image/cover/perfect-beauty",
                        length: 440,
                        data: "https://media.luni.me/audio/music/perfect-beauty",
                    },
                    {
                        type: "music",
                        title: "Morning in the Forest",
                        artist: "Good B Music",
                        thumbnail: "https://media.luni.me/image/cover/morning-in-the-forest",
                        length: 655,
                        data: "https://media.luni.me/audio/music/morning-in-the-forest",
                    },
                ]
            }
        }
    },
    ui: {
        type: "category",
        title: "User Interface Sounds",
        description: "Sounds used for user interface interactions.",
        volume: 1,
        properties: {
            click: {
                type: "sound",
                title: "Click Sound",
                description: "Sound played when clicking on interface elements.",
                volume: 1,
                data: click
            },
            select: {
                type: "sound",
                title: "Select Sound",
                description: "Sound played when selecting options.",
                volume: 1,
                data: select
            },
            on: {
                type: "sound",
                title: "Toggle On Sound",
                description: "Sound played when toggling something on.",
                volume: 1,
                data: null
            },
            off: {
                type: "sound",
                title: "Toggle Off Sound",
                description: "Sound played when toggling something off.",
                volume: 1,
                data: null
            }
        }
    },
    queue: {
        type: "category",
        title: "Queue Sounds",
        description: "Sounds played for queue events.",
        volume: 1,
        properties: {
            ores: {
                type: "sound",
                title: "ORES Alert",
                description: "Sound played due to a high ORES score.",
                volume: 1,
                data: ores
            },
            mention: {
                type: "sound",
                title: "Mention Alert",
                description: "Sound played when your username is mentioned in an edit.", // TODO add mention check to edit summary
                volume: 1,
                data: mention
            },
            recent: {
                type: "sound",
                title: "Recent Changes Alert",
                description: "Sound played when there are new edits in the recent changes queue.",
                volume: 0,
                data: null
            },
            flagged: {
                type: "sound",
                title: "Flagged Revisions Alert",
                description: "Sound played when there are new edits in the flagged revisions queue.",
                volume: 0,
                data: null
            },
            watchlist: {
                type: "sound",
                title: "Watchlist Alert",
                description: "Sound played when there are new edits in the watchlist queue.",
                volume: 0,
                data: null
            }
        }
    },
    notification: {
        type: "category",
        title: "Notification Sounds",
        description: "Sounds played for various notifications.",
        volume: 1,
        properties: {
            alert: {
                type: "sound",
                title: "Alert Sound",
                description: "Sound played for alerts.",
                volume: 1,
                data: alert
            },
            notice: {
                type: "sound",
                title: "Notice Sound",
                description: "Sound played for notices.",
                volume: 1,
                data: notice
            }
        },
    },
    action: {
        type: "category",
        title: "Action Sounds",
        description: "Sounds played for various user actions.",
        volume: 1,
        properties: {
            default: {
                type: "sound",
                title: "Default Action Sound",
                description: "Sound played for default actions.",
                volume: 1,
                data: action
            },
            failed: {
                type: "sound",
                title: "Failed Action Sound",
                description: "Sound played when an action fails.",
                volume: 1,
                data: null
            },
            report: {
                type: "sound",
                title: "Report Action Sound",
                description: "Sound played for report actions.",
                volume: 1,
                data: report
            },
            block: {
                type: "sound",
                title: "Block Action Sound",
                description: "Sound played for block actions.",
                volume: 1,
                data: null
            },
            protect: {
                type: "sound",
                title: "Protect Action Sound",
                description: "Sound played for protect actions.",
                volume: 1,
                data: null
            }
        }
    },
    other: {
        type: "category",
        title: "Other Sounds",
        description: "Miscellaneous sounds.",
        volume: 1,
        properties: {
            success: {
                type: "sound",
                title: "Success Sound",
                description: "Sound played for success notifications.",
                volume: 1,
                data: null
            },
            warn: {
                type: "sound",
                title: "Warning Sound",
                description: "Sound played for warning notifications.",
                volume: 1,
                data: null
            }
        }
    }
};

/**
 * Playlist controller class that manages a single playlist's state and playback
 */
class PlaylistController {
    constructor(playlistKey, tracks, audioManager) {
        this.playlistKey = playlistKey;
        this.tracks = tracks;
        this.audioManager = audioManager;

        this.history = [];
        this.future = [];
        this.currentTrackIndex = null;
        this.currentAudio = null;
        this.isActive = false;
        this.toast = null;
        this.consecutiveErrors = 0;
    }

    start() {
        this.isActive = true;
        const index = this._pickRandomIndex();
        this._playTrack(index);
    }

    stop() {
        this.isActive = false;

        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.src = "";
            this.currentAudio = null;
        }

        if (this.toast) {
            this.toast.remove();
            this.toast = null;
        }

        this.currentTrackIndex = null;
        this.history = [];
        this.future = [];
    }

    next() {
        if (!this.isActive) return;

        let nextIndex;
        if (this.future.length > 0) {
            nextIndex = this.future.pop();
        } else {
            nextIndex = this._pickRandomIndex();
        }

        this._playTrack(nextIndex);
    }

    previous() {
        if (!this.isActive) return;

        if (this.history.length <= 1) {
            // Restart current track
            if (this.currentAudio) {
                this.currentAudio.currentTime = 0;
                this.currentAudio.play();
            }
            return;
        }

        const current = this.history.pop();
        this.future.push(current);
        const prevIndex = this.history[this.history.length - 1];

        this._playTrack(prevIndex, true);
    }

    _pickRandomIndex() {
        const length = this.tracks.length;
        if (length <= 1) return 0;

        const avoidWindow = Math.max(1, Math.floor(length / 2));
        const recentIndices = new Set(this.history.slice(-avoidWindow));

        for (let i = 0; i < 8; i++) {
            const idx = Math.floor(Math.random() * length);
            if (!recentIndices.has(idx)) return idx;
        }

        return Math.floor(Math.random() * length);
    }

    _playTrack(index, skipHistory = false) {
        if (!this.isActive) return;

        // Stop current audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.src = "";
        }

        // Remove old toast
        if (this.toast) {
            this.toast.remove();
            this.toast = null;
        }

        // Update state
        this.currentTrackIndex = index;
        if (!skipHistory) {
            if (this.history[this.history.length - 1] !== index) {
                this.history.push(index);
                this.future = [];
            }
        }

        // Get track data
        const track = this.tracks[index];
        const volume = this.audioManager.getVolume([...this.playlistKey.split('.'), String(index)]);

        // Create audio element
        const audio = new Audio(track.data);
        audio.volume = volume;
        this.currentAudio = audio;

        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artist,
                album: "WikiShield", // TODO allow custom album name
                artwork: [
                    { src: track.thumbnail, sizes: "512x512", type: "image/png" }
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => {
                return;
            });

            navigator.mediaSession.setActionHandler('pause', () => {
                return;
            });

            navigator.mediaSession.setActionHandler('previoustrack', () => {
                this.previous();
            });

            navigator.mediaSession.setActionHandler('nexttrack', () => {
                this.next();
            });
        }

        // Setup event handlers
        audio.onended = () => {
            if (this.isActive && this.currentAudio === audio) {
                this.consecutiveErrors = 0; // Reset on success
                this.next();
            }
        };

        audio.onerror = (e) => {
            if (this.isActive && this.currentAudio === audio) {
                this.consecutiveErrors++;

                // Stop after 3 consecutive errors to prevent infinite loop
                if (this.consecutiveErrors >= 3) {
                    console.error('Too many consecutive audio errors. Stopping playlist.');
                    this.stop();
                    return;
                }

                this.next();
            }
        };

        // Play audio and reset error counter on successful play
        audio.play()
            .then(() => {
                this.consecutiveErrors = 0; // Reset when play succeeds
            })
            .catch((e) => {
                console.error('Failed to start playback:', e);
            });

        // Show toast
        this.toast = this.audioManager._createToast(track, audio, this);
    }
}

/**
 * Main audio manager class
 */
export class AudioManager {
    constructor(wikishield) {
        this.wikishield = wikishield;
        this.audio = audio;

        // Simple tracking maps
        this.activePlaylists = new Map(); // playlistKey -> PlaylistController
        this.soundEffects = new Set(); // Set of active audio elements
        this.previews = new Set(); // Set of preview audio elements

        this.previewing = false;
    }

    // ========================================
    // PUBLIC API
    // ========================================

    async playSound(soundPath, abortController, preview = false) {
        const sound = this.getSound(soundPath);
        if (!sound || !sound.data) return;

        const volume = this.getVolume(soundPath);
        const audio = new Audio(sound.data);
        audio.volume = !preview && this.previewing ? 0 : volume;

        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => {
                return;
            });

            navigator.mediaSession.setActionHandler('pause', () => {
                return;
            });

            navigator.mediaSession.setActionHandler('previoustrack', () => {
                return;
            });

            navigator.mediaSession.setActionHandler('nexttrack', () => {
                return;
            });
        }

        const muteId = generateRandomUUID();
        if (preview) {
            this.muteId = muteId;
            this.previewing = true;

            this.stopPreviews();
            this._muteAll();

            this.previews.add(audio);
        }

        this.soundEffects.add(audio);

        const promise = new Promise((resolve, reject) => {
            audio.resolve = resolve;
            audio.reject = reject;
        });

        audio.onended = () => {
            audio.resolve();
            this.soundEffects.delete(audio);

            if (preview) {
                this.previewing = false;

                setTimeout(() => {
                    if (this.muteId === muteId) {
                        this._unmuteAll();
                    }
                }, 250);

                this.previews.delete(audio);
            }
        };

        audio.onerror = () => {
            audio.resolve();
            this.soundEffects.delete(audio);

            if (preview) {
                this.previewing = false;

                setTimeout(() => {
                    if (this.muteId === muteId) {
                        this._unmuteAll();
                    }
                }, 250);

                this.previews.delete(audio);
            }
        };

        abortController?.signal?.addEventListener('abort', () => {
            audio.pause();
            audio.onerror();
            audio.src = "";
        });

        audio.play();

        return promise;
    }

    async playPlaylist(soundPath) {
        const sound = this.getSound(soundPath);
        if (!sound || sound.type !== 'playlist') return;

        const playlistKey = soundPath.join('.');

        // Stop existing playlist if running
        if (this.activePlaylists.has(playlistKey)) {
            this.stopPlaylist(soundPath);
        }

        // Stop all other music
        this._stopAllMusic();

        // Create and start new playlist controller
        const controller = new PlaylistController(playlistKey, sound.tracks, this);
        this.activePlaylists.set(playlistKey, controller);
        controller.start();
    }

    stopPlaylist(soundPath) {
        const playlistKey = soundPath.join('.');
        const controller = this.activePlaylists.get(playlistKey);

        if (controller) {
            controller.stop();
            this.activePlaylists.delete(playlistKey);
        }
    }

    async previewSound(soundPath) {
        const sound = this.getSound(soundPath);
        if (!sound || !sound.data) return;

        // Mute all active sounds
        this._muteAll();

        const audio = new Audio(sound.data);
        audio.volume = this.getVolume(soundPath);
        this.previews.add(audio);

        const cleanup = () => {
            this.previews.delete(audio);
            if (this.previews.size === 0) {
                this._unmuteAll();
            }
        };

        audio.onended = cleanup;
        audio.onerror = cleanup;

        await audio.play();
    }

    stopPreviews() {
        for (const audio of this.previews) {
            audio.pause();
            audio.src = "";
        }
        this.previews.clear();
        this._unmuteAll();
    }

    onvolumechanged() { // FIX
        // Update all active playlist volumes
        for (const controller of this.activePlaylists.values()) {
            if (controller.currentAudio) {
                const soundPath = [...controller.playlistKey.split('.'), String(controller.currentTrackIndex)];
                controller.currentAudio.volume = this.getVolume(soundPath);
            }
        }
    }

    // ========================================
    // INTERNAL METHODS
    // ========================================

    _stopAllMusic() {
        for (const [key, controller] of this.activePlaylists.entries()) {
            controller.stop();
            this.activePlaylists.delete(key);
        }
    }

    _muteAll() {
        for (const controller of this.activePlaylists.values()) {
            if (controller.currentAudio) {
                controller.currentAudio.volume = 0;
            }
        }

        for (const audio of this.soundEffects) {
            audio.volume = 0;
        }
    }

    _unmuteAll() {
        for (const controller of this.activePlaylists.values()) {
            if (controller.currentAudio) {
                const soundPath = [...controller.playlistKey.split('.'), String(controller.currentTrackIndex)];
                controller.currentAudio.volume = this.getVolume(soundPath);
            }
        }

        // Sound effects will get proper volume on next play
    }

    _createToast(track, audio, controller) {
        const container = document.createElement("div");
        document.body.appendChild(container);

        const toast = {
            remove: () => {
                const toastEl = container.querySelector(".music-toast");
                if (toastEl) {
                    toastEl.classList.add("music-toast-leave");
                }

                container.onanimationend = () => {
                    try {
                        render(null, container);
                    } catch {}

                    if (container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                };
            }
        };

        const onPrevious = () => controller.previous();
        const onNext = () => controller.next();

        render(
            <MusicToast
                title={track.title}
                artist={track.artist}
                thumbnail={track.thumbnail}
                audio={audio}
                onPrevious={onPrevious}
                onNext={onNext}
            />,
            container
        );

        setTimeout(toast.remove, 3000);

        return toast;
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    getSound(path) {
        // TODO dont play if muted by zen_mode

        let current = { type: "category", properties: this.audio };

        for (const segment of path) {
            if (current.type === "category") {
                current = current.properties[segment];
            } else if (current.type === "playlist") {
                current = current.tracks[parseInt(segment)];
            } else {
                return null;
            }

            if (!current) return null;
        }

        return current;
    }

    getVolume(path) {
        path = [ "master", ...path ];

        let volume = 1;
        let current = { type: "category", properties: this.audio };
        const pathParts = [];
        for (const segment of path) {
            pathParts.push(segment);

            if (current.type === "category") {
                current = current.properties[segment];
            } else if (current.type === "playlist") {
                return volume;
            } else {
                return volume;
            }

            if (!current) break;

            const specificVolume = this.wikishield.storage.data.settings.audio.volume[pathParts.join(".")];
            if (specificVolume !== undefined) {
                volume *= specificVolume;
            }
        }

        return volume;
    }
}