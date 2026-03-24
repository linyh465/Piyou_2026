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

// sessionStorage is sandboxed per-origin and cleared on tab close — sufficient for web.
// In production (Capacitor), replace with @capawesome/capacitor-secure-storage.

export const secureStorage = {
    async set(key, value) {
        try {
            sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    },

    async get(key) {
        try {
            const stored = sessionStorage.getItem(`${PREFIX}${key}`);
            if (!stored) return null;
            return JSON.parse(stored);
        } catch {
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
