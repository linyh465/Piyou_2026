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
const LS_REMOVED_CODES = 'piyou_removed_share_codes';
const UPLOAD_DEBOUNCE_MS = 2_000;  // 2 秒 debounce，讓快速連續操作合併成一次上傳
const THROTTLE_MS = 10_000;        // 非即時上傳的間隔限制

let _uploadTimer = null;
let _uploadInProgress = false; // 防止並發上傳 / Prevent concurrent uploads

// 頁面卸載時取消待執行的 debounce timer，避免在 unload 後多送一次請求
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (_uploadTimer) { clearTimeout(_uploadTimer); _uploadTimer = null; }
    });
}

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

function getRemovedCodes() {
    try { return new Set(JSON.parse(localStorage.getItem(LS_REMOVED_CODES) || '[]')); } catch { return new Set(); }
}

/**
 * 將分享碼加入本地退訂紀錄，防止跨裝置同步時被重新加入。
 * Add share code to local removal tombstone to prevent re-sync from remote.
 */
export function markShareRemoved(code) {
    const codes = getRemovedCodes();
    codes.add(code);
    localStorage.setItem(LS_REMOVED_CODES, JSON.stringify([...codes]));
}

// ── 合併邏輯 ──

/**
 * 合併共享訂閱：以 code 為 key，取聯集；已退訂的 code 不從遠端恢復，
 * 且主動從本地清除（防止任何路徑導致 tombstone 碼殘留在 localStorage）。
 * Merge share subscriptions; tombstoned codes are filtered from both local AND remote.
 */
function mergeShares(local, remote) {
    const removed = getRemovedCodes();
    const map = new Map();
    for (const s of local) {
        if (!removed.has(s.code)) map.set(s.code, s); // 也清除本地殘留的 tombstone 碼
    }
    for (const s of remote) {
        if (!map.has(s.code) && !removed.has(s.code)) map.set(s.code, s);
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

    // 防止並發上傳（race condition guard）
    if (_uploadInProgress) return;

    if (!immediate) {
        const last = parseInt(localStorage.getItem(LS_LAST_USERSYNC) || '0', 10);
        if (Date.now() - last < THROTTLE_MS) return;
    }

    if (_uploadTimer) { clearTimeout(_uploadTimer); _uploadTimer = null; }

    _uploadInProgress = true;
    const tasks = readTasks();
    const shares = readShares();
    try {
        await api.put('/data/usersync', { tasks, shares });
        localStorage.setItem(LS_LAST_USERSYNC, String(Date.now()));
        // 顯示同步完成 toast（動態 import 避免循環依賴）
        try {
            const { default: useSyncToastStore } = await import('../stores/syncToastStore');
            useSyncToastStore.getState().showToast('同步完成');
        } catch { /* toast 失敗不影響同步 */ }
    } catch (err) {
        if (err?.response?.status === 503) {
            // 503 = 後端未設定（本地開發），靜默忽略
        } else {
            console.warn('[UserSync] upload failed:', err?.response?.data?.detail || err.message);
        }
    } finally {
        _uploadInProgress = false;
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

        // 合併共享訂閱（即使遠端為空也要跑 merge，確保 tombstone 清除本地殘留）
        {
            const local = readShares();
            const merged = mergeShares(local, remoteShares);
            // 長度不同 OR 內容不同（tombstone 清除了本地殘留）時才寫入
            if (merged.length !== local.length ||
                merged.some((s, i) => s.code !== (local[i]?.code))) {
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
 * 排隊上傳（debounce 2 秒）—— 任務或共享資料變更後呼叫。
 * 2 秒 debounce 讓連續快速操作合併成一次 API 呼叫，同時讓用戶感覺接近即時。
 */
export function scheduleUpload() {
    const token = sessionStorage.getItem('piyou_token');
    if (!token) return;
    if (_uploadTimer) clearTimeout(_uploadTimer);
    _uploadTimer = setTimeout(() => {
        _uploadTimer = null;
        uploadUserSync(true);
    }, UPLOAD_DEBOUNCE_MS);
}
