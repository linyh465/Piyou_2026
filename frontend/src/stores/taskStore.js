/**
 * 任務管理狀態 / Task Management Store
 * 本地 localStorage CRUD 操作 + 雲端同步
 * Local localStorage-based CRUD with cloud sync capability.
 */
import { create } from 'zustand';
import localDb from '../services/localDb';
import { downloadMarkdown } from '../utils/exportMarkdown';
import { api } from '../services/apiClient';

const useTaskStore = create((set, get) => ({
    // 狀態 / State
    tasks: [],
    isLoading: false,
    isSyncing: false,
    syncError: null,
    filter: 'all', // all | active | completed
    categoryFilter: 'all',

    /**
     * 載入所有任務 / Load all tasks
     */
    loadTasks: async () => {
        set({ isLoading: true });
        try {
            const tasks = await localDb.getAllTasks();
            set({ tasks, isLoading: false });
        } catch {
            set({ isLoading: false });
        }
    },

    /**
     * 新增任務 / Create task
     */
    addTask: async (task) => {
        await localDb.createTask(task);
        await get().loadTasks();
    },

    /**
     * 更新任務 / Update task
     */
    updateTask: async (id, updates) => {
        await localDb.updateTask(id, updates);
        await get().loadTasks();
    },

    /**
     * 刪除任務 / Delete task
     */
    deleteTask: async (id) => {
        await localDb.deleteTask(id);
        await get().loadTasks();
    },

    /**
     * 切換完成狀態 / Toggle completion
     * 使用 Optimistic Update 提升體感速度 / Uses optimistic update for snappier UX
     */
    toggleTask: async (id) => {
        const { tasks } = get();
        // Optimistic: 立即更新 UI
        const optimistic = tasks.map((t) =>
            t.id === id ? { ...t, completed: !t.completed } : t
        );
        set({ tasks: optimistic });
        try {
            await localDb.toggleTask(id);
        } catch {
            // Rollback: 失敗時還原
            set({ tasks });
        }
    },

    /**
     * 匯出為 Markdown / Export as Markdown
     */
    exportToMarkdown: () => {
        const { tasks } = get();
        downloadMarkdown(tasks);
    },

    /**
     * 取得篩選後的任務 / Get filtered tasks
     */
    getFilteredTasks: () => {
        const { tasks, filter, categoryFilter } = get();
        let filtered = tasks;

        if (filter === 'active') filtered = filtered.filter((t) => !t.completed);
        if (filter === 'completed') filtered = filtered.filter((t) => t.completed);
        if (categoryFilter !== 'all') filtered = filtered.filter((t) => t.category === categoryFilter);

        return filtered;
    },

    setFilter: (filter) => set({ filter }),
    setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

    // ── 雲端同步 / Cloud Sync ──

    /**
     * 上傳本地任務至伺服器 / Upload local tasks to server
     */
    syncTasksToServer: async () => {
        const token = sessionStorage.getItem('piyou_token');
        if (!token) return;

        set({ isSyncing: true, syncError: null });
        try {
            const tasks = localDb.exportAllTasks();
            await api.put('/data/tasks', { tasks }, { timeout: 15000 });
            set({ isSyncing: false });
        } catch (err) {
            set({ isSyncing: false, syncError: err.response?.data?.detail || '任務上傳失敗 / Task upload failed' });
        }
    },

    /**
     * 從伺服器下載任務並覆蓋本地 / Download tasks from server and overwrite local
     */
    syncTasksFromServer: async () => {
        const token = sessionStorage.getItem('piyou_token');
        if (!token) return;

        set({ isSyncing: true, syncError: null });
        try {
            const res = await api.get('/data/tasks', { timeout: 15000 });
            const serverTasks = res.data.tasks || [];
            localDb.replaceAllTasks(serverTasks);
            await get().loadTasks();
            set({ isSyncing: false });
        } catch (err) {
            // 404 代表伺服器尚無此學號的任務資料（首次同步）
            // 404 means no server data for this student yet (first sync)
            if (err.response?.status === 404) {
                set({ isSyncing: false, syncError: null });
                return;
            }
            set({ isSyncing: false, syncError: err.response?.data?.detail || '任務下載失敗 / Task download failed' });
        }
    },
}));

export default useTaskStore;
