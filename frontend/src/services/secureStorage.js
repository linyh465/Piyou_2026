/**
 * Secure Storage Abstraction
 * Wraps device-native Keychain (iOS) / Keystore (Android) for credential storage.
 * Falls back to sessionStorage for web development mode.
 *
 * In production (Capacitor/React Native), replace the fallback with native plugins:
 * - @capacitor/preferences or @capawesome/capacitor-secure-storage
 * - react-native-keychain
 */

const PREFIX = 'piyou_secure_';

// Simple XOR obfuscation for dev fallback (NOT production-grade encryption)
function obfuscate(text) {
    const key = 'P1y0u_2026!';
    return btoa(
        text
            .split('')
            .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
            .join('')
    );
}

function deobfuscate(encoded) {
    const key = 'P1y0u_2026!';
    const decoded = atob(encoded);
    return decoded
        .split('')
        .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
        .join('');
}

export const secureStorage = {
    async set(key, value) {
        try {
            // In production, call native secure storage plugin here
            const stored = obfuscate(JSON.stringify(value));
            sessionStorage.setItem(`${PREFIX}${key}`, stored);
            return true;
        } catch {
            console.error('[SecureStorage] Failed to store value');
            return false;
        }
    },

    async get(key) {
        try {
            const stored = sessionStorage.getItem(`${PREFIX}${key}`);
            if (!stored) return null;
            return JSON.parse(deobfuscate(stored));
        } catch {
            console.error('[SecureStorage] Failed to retrieve value');
            return null;
        }
    },

    async remove(key) {
        try {
            sessionStorage.removeItem(`${PREFIX}${key}`);
            return true;
        } catch {
            return false;
        }
    },

    async clear() {
        try {
            Object.keys(sessionStorage)
                .filter((k) => k.startsWith(PREFIX))
                .forEach((k) => sessionStorage.removeItem(k));
            return true;
        } catch {
            return false;
        }
    },
};

export default secureStorage;
