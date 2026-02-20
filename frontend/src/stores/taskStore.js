/**
 * 任務管理狀態 / Task Management Store
 * 基於本地 SQLite 的 CRUD 操作，含 Markdown 匯出功能
 * Local SQLite-based CRUD operations with Markdown export capability.
 */
import { create } from 'zustand';
import localDb from '../services/localDb';
import { downloadMarkdown } from '../utils/exportMarkdown';

const useTaskStore = create((set, get) => ({
    // 狀態 / State
    tasks: [],
    isLoading: false,
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
     */
    toggleTask: async (id) => {
        await localDb.toggleTask(id);
        await get().loadTasks();
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
}));

export default useTaskStore;
