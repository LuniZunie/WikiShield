export class Memory {
	constructor(options = {}) {
		this.order = [ ];
		this.store = new Map();
		this.timeouts = new Map();

		this.timeout = options.timeout || 5 * 60 * 1000; // Default 5 minutes
		this.maxSize = options.size || 1000; // Default max 1000 items
	}

	clear() {
		this.order = [];
		this.store.clear();
		this.timeouts.clear();
	}

	has(key) {
		return this.store.has(key);
	}

	get(key) {
		return this.store.get(key);
	}

	set(key, value) {
		const existingIndex = this.order.indexOf(key);
		if (existingIndex !== -1) {
			this.order.splice(existingIndex, 1);
		}

		this.order.push(key);
		this.store.set(key, value);

		if (this.timeouts.has(key)) {
			clearTimeout(this.timeouts.get(key));
		}
		this.timeouts.set(key, setTimeout(() => { this.delete(key); }, this.timeout));

		if (this.store.size > this.maxSize) {
			const oldestKey = this.order.shift();
			this.delete(oldestKey);
		}
	}
    add(key) {
        if (!this.store.has(key)) {
            this.set(key, true);
        }
    }

	delete(key) {
		this.store.delete(key);

		clearTimeout(this.timeouts.get(key));
		this.timeouts.delete(key);
	}

	size() {
		return this.store.size;
	}
}