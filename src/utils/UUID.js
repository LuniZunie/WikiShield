function GenerateUUID() {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const __size = 256;
const cache = [ ];

function Fill() {
    if (cache.length < __size) {
        cache.push(GenerateUUID());
    }
    window.requestIdleCallback(Fill);
}
if (typeof requestIdleCallback === "function") {
    window.requestIdleCallback(Fill);
}

export function generateRandomUUID() {
    if (cache.length === 0) {
        return GenerateUUID();
    }
    return cache.pop();
}