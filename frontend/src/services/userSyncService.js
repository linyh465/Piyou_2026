/**
 * 跨裝置使用者資料同步服務 / Cross-Device User Data Sync Service
 *
 * 上傳：任務 + 共享訂閱 → PUT /api/v1/data/usersync
 * 下載：→ GET /api/v1/data/usersync，合併至本地
 *
 * 依賴 E 校園 JWT token（sessionStorage piyou_token）。
 * 無 token 時靜默跳過。
 */
import { api } from './apiClient';
import localDb from './localDb';

const LS_SHARES = 'piyou_shares';
const LS_LAST_USERSYNC = 'piyou_last_usersync';
const THROTTLE_MS = 10_000; // 10 秒內不重複上傳

let _uploadTimer = null;

// ── 本地資料讀取 ──

function readTasks() {
    try {
        return localDb.exportAllTasks?.() ?? [];
    } catch {
        return [];
    }
}

function readShares() {
    try { return JSON.parse(localStorage.getItem(LS_SHARES) || '[]'); } catch { return []; }
}

function saveShares(shares) {
    localStorage.setItem(LS_SHARES, JSON.stringify(shares));
}

// ── 合併邏輯 ──

/**
 * 合併共享訂閱：以 code 為 key，取聯集（包含已刪除/退訂）。
 */
function mergeShares(local, remote) {
    const map = new Map();
    for (const s of local) map.set(s.code, s);
    for (const s of remote) {
        if (!map.has(s.code)) map.set(s.code, s);
    }
    return Array.from(map.values());
}

// ── 主要 API ──

/**
 * 上傳本地任務與共享訂閱至 Google Sheets。
 * 有 throttle：10 秒內不重複觸發。
 * @param {boolean} immediate - 立即上傳，忽略 throttle
 */
export async function uploadUserSync(immediate = false) {
    const token = sessionStorage.getItem('piyou_token');
    if (!token) return;

    if (!immediate) {
        const last = parseInt(localStorage.getItem(LS_LAST_USERSYNC) || '0', 10);
        if (Date.now() - last < THROTTLE_MS) return;
    }

    if (_uploadTimer) { clearTimeout(_uploadTimer); _uploadTimer = null; }

    const tasks = readTasks();
    const shares = readShares();
    try {
        await api.put('/data/usersync', { tasks, shares });
        localStorage.setItem(LS_LAST_USERSYNC, String(Date.now()));
    } catch (err) {
        // 503 = not configured (local dev), 404 already handled - silently ignore
        if (err?.response?.status !== 503) {
            console.warn('[UserSync] upload failed:', err?.response?.data?.detail || err.message);
        }
    }
}

/**
 * 下載並合併遠端任務與共享訂閱。
 * @returns {boolean} true 若有資料被合併
 */
export async function downloadAndMergeUserSync() {
    const token = sessionStorage.getItem('piyou_token');
    if (!token) return false;

    try {
        const res = await api.get('/data/usersync');
        const { tasks: remoteTasks = [], shares: remoteShares = [] } = res.data;

        // 合併任務
        if (remoteTasks.length > 0) {
            if (localDb.mergeWithServer) {
                localDb.mergeWithServer(remoteTasks);
            }
        }

        // 合併共享訂閱
        if (remoteShares.length > 0) {
            const local = readShares();
            const merged = mergeShares(local, remoteShares);
            if (merged.length !== local.length) {
                saveShares(merged);
            }
        }

        return remoteTasks.length > 0 || remoteShares.length > 0;
    } catch (err) {
        if (err?.response?.status === 404 || err?.response?.status === 503) return false;
        console.warn('[UserSync] download failed:', err?.response?.data?.detail || err.message);
        return false;
    }
}

/**
 * 排隊上傳（debounce 10 秒）—— 任務變更後呼叫。
 */
export function scheduleUpload() {
    const token = sessionStorage.getItem('piyou_token');
    if (!token) return;
    if (_uploadTimer) clearTimeout(_uploadTimer);
    _uploadTimer = setTimeout(() => {
        _uploadTimer = null;
        uploadUserSync(true);
    }, THROTTLE_MS);
}
