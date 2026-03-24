/**
 * 同步完成 Toast 狀態 / Sync completion toast store
 * 供 userSyncService 在同步成功後呼叫，顯示短暫提示。
 */
import { create } from 'zustand';

let _dismissTimer = null;

const useSyncToastStore = create((set) => ({
    visible: false,
    message: '',
    showToast: (message = '同步完成') => {
        if (_dismissTimer) clearTimeout(_dismissTimer);
        set({ visible: true, message });
        _dismissTimer = setTimeout(() => {
            set({ visible: false });
            _dismissTimer = null;
        }, 3000);
    },
}));

export default useSyncToastStore;
