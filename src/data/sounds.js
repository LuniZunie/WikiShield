// Sound definitions with their audio properties
// Redesigned with professional quality sounds using musical intervals and smooth envelopes

export const sounds = {
	// UI sounds - Subtle, non-intrusive clicks and taps
	click: {
		name: "Click",
		description: "Crisp UI click",
		category: "ui",
		type: 'sine',
		frequencies: [600],
		duration: 0.15,
		volume: 1,
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.06);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.15);
		}
	},
	tap: {
		name: "Tap",
		description: "Soft tap",
		category: "ui",
		type: 'sine',
		frequencies: [440],
		duration: 0.15,
		volume: 1,
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.06);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.15);
		}
	},
	pop: {
		name: "Pop",
		description: "Bouncy pop",
		category: "ui",
		type: 'sine',
		frequencies: [660, 528], // E5 to C5
		duration: 0.2,
		volume: 1,
		repeats: [0, 0.1],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.2);
		}
	},

	// alert sounds - Attention-grabbing but not harsh
	alert: {
		name: "Alert",
		description: "Urgent notification",
		category: "alert",
		type: 'sine',
		frequencies: [440, 523.25], // A4 to C5 (major third)
		duration: 0.15,
		volume: 1,
		repeats: [0, 0.18],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.3);
		}
	},
	bell: {
		name: "Bell",
		description: "Notification bell",
		category: "alert",
		type: 'sine',
		frequencies: [523.25, 659.25], // C5 to E5 (major third)
		duration: 0.35,
		volume: 1,
		repeats: [0, 0.18],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.8 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.35);
		}
	},
	ping: {
		name: "Ping",
		description: "High ping",
		category: "alert",
		type: 'sine',
		frequencies: [784], // G5
		duration: 0.3,
		volume: 1,
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.3);
		}
	},

	// warning sounds - More serious but still musical
	warn: {
		name: "Warning",
		description: "Caution tone",
		category: "warning",
		type: 'sine',
		frequencies: [587.33, 523.25], // D5 to C5 (minor second down)
		duration: 0.18,
		volume: 1,
		repeats: [0, 0.2],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.18);
		}
	},
	beep: {
		name: "Beep",
		description: "Simple beep",
		category: "warning",
		type: 'sine',
		frequencies: [784], // G5
		duration: 0.12,
		volume: 1,
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.12);
		}
	},
	buzz: {
		name: "Buzz",
		description: "Attention buzz",
		category: "warning",
		type: 'sine',
		frequencies: [440], // A4
		duration: 0.15,
		volume: 1,
		repeats: [0, 0.08, 0.16],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.05);
		}
	},

	// ACTION SOUNDS - Smooth transitions and movements
	whoosh: {
		name: "Whoosh",
		description: "Smooth transition",
		category: "action",
		type: 'sine',
		frequencies: [600],
		duration: 0.25,
		volume: 1,
		sweep: { from: 600, to: 250 },
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.8 * vol, start + 0.04);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.25);
		}
	},
	swoosh: {
		name: "Swoosh",
		description: "Quick swipe",
		category: "action",
		type: 'sine',
		frequencies: [800],
		duration: 0.18,
		volume: 1,
		sweep: { from: 800, to: 400 },
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.18);
		}
	},
	swipe: {
		name: "Swipe",
		description: "Fast swipe",
		category: "action",
		type: 'sine',
		frequencies: [750],
		duration: 0.12,
		volume: 1,
		sweep: { from: 750, to: 400 },
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.5 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.12);
		}
	},
	rollback: {
		name: "Rollback",
		description: "Reverse action",
		category: "action",
		type: 'sine',
		frequencies: [400],
		duration: 0.22,
		volume: 1,
		sweep: { from: 400, to: 800 },
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.65 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.22);
		}
	},

	// notification sounds - Pleasant and informative
	notify: {
		name: "Notify",
		description: "Soft notification",
		category: "notification",
		type: 'sine',
		frequencies: [523.25, 392], // C5 to G4
		duration: 0.2,
		volume: 1,
		repeats: [0, 0.12],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.8 * vol, start + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.2);
		}
	},
	chime: {
		name: "Chime",
		description: "Pleasant chime",
		category: "notification",
		type: 'sine',
		frequencies: [523.25, 659.25, 783.99], // C5-E5-G5 (C major chord)
		duration: 0.3,
		volume: 1,
		repeats: [0, 0.08, 0.16],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.3);
		}
	},
	ding: {
		name: "Ding",
		description: "Gentle ding",
		category: "notification",
		type: 'sine',
		frequencies: [523.25], // C5
		duration: 0.28,
		volume: 1,
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.28);
		}
	},

	// positive sounds - Success and achievements
	success: {
		name: "Success",
		description: "Achievement",
		category: "positive",
		type: 'sine',
		frequencies: [523.25, 659.25, 783.99, 523.25], // C5-E5-G5-C5 arpeggio
		duration: 0.18,
		volume: 1,
		repeats: [0, 0.06, 0.12, 0.18],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.25);
		}
	},
	complete: {
		name: "Complete",
		description: "Task complete",
		category: "positive",
		type: 'sine',
		frequencies: [659.25, 440, 659.25], // E5-A4-E5 (fifth)
		duration: 0.25,
		volume: 1,
		repeats: [0, 0.08, 0.16],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.65 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.28);
		}
	},
	sparkle: {
		name: "Sparkle",
		description: "Magical sparkle",
		category: "positive",
		type: 'sine',
		frequencies: [659.25, 784, 988, 1175], // E5-G5-B5-D6
		duration: 0.15,
		volume: 1,
		repeats: [0, 0.04, 0.08, 0.12],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.12);
		}
	},
	twinkle: {
		name: "Twinkle",
		description: "Soft twinkle",
		category: "positive",
		type: 'sine',
		frequencies: [784, 1047, 1319], // G5-C6-E6
		duration: 0.2,
		volume: 1,
		repeats: [0, 0.07, 0.14],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.6 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.18);
		}
	},

	// negative sounds - Errors and blocks
	error: {
		name: "Error",
		description: "Error tone",
		category: "negative",
		type: 'sine',
		frequencies: [392], // G4
		duration: 0.25,
		volume: 1,
		sweep: { from: 392, to: 294 }, // G4 to D4 (tritone, dissonant)
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.25);
		}
	},
	denied: {
		name: "Denied",
		description: "Access denied",
		category: "negative",
		type: 'sine',
		frequencies: [330, 311], // E4 to Eb4 (semitone)
		duration: 0.2,
		volume: 1,
		repeats: [0, 0.12],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.18);
		}
	},
	thud: {
		name: "Thud",
		description: "Heavy thud",
		category: "negative",
		type: 'sine',
		frequencies: [165], // E3
		duration: 0.18,
		volume: 1,
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.8 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.25);
		}
	},

	// special sounds
	report: {
		name: "Report",
		description: "Report sent",
		category: "notification",
		type: 'sine',
		frequencies: [587.33, 698.46, 880], // D5-F5-A5
		duration: 0.16,
		volume: 1,
		repeats: [0, 0.08, 0.16],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.65 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.2);
		}
	},
	thank: {
		name: "Thank",
		description: "Thank you",
		category: "positive",
		type: 'sine',
		frequencies: [523.25, 659.25], // C5 to E5 (major third)
		duration: 0.3,
		volume: 1,
		repeats: [0, 0.15],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.3);
		}
	},
	protection: {
		name: "Protection",
		description: "Shield up",
		category: "action",
		type: 'sine',
		frequencies: [440, 554, 659], // A4-C#5-E5 (A major chord)
		duration: 0.3,
		volume: 1,
		repeats: [0, 0.1, 0.2],
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.7 * vol, start + 0.04);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.25);
		}
	},
	block: {
		name: "Block",
		description: "Blocked",
		category: "negative",
		type: 'sine',
		frequencies: [220], // A3
		duration: 0.2,
		volume: 1,
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0.001 * vol, start);
			gain.gain.exponentialRampToValueAtTime(0.8 * vol, start + 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001 * vol, start + 0.2);
		}
	},

	// silent option
	none: {
		name: "None (Silent)",
		description: "No sound",
		category: "other",
		type: 'sine',
		frequencies: [440],
		duration: 0.001,
		volume: 1,
		envelope: (gain, ctx, start, vol) => {
			gain.gain.setValueAtTime(0, start);
		}
	}
};

