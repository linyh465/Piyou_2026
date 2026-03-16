/**
 * Local Database Service (localStorage-based)
 * 純 localStorage JSON 實作，不依賴 sql.js / WASM。
 * Pure localStorage JSON implementation, no sql.js / WASM dependency.
 */

const STORAGE_KEY = 'piyou_tasks';

function readTasks() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

function writeTasks(tasks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ── Task CRUD Operations ──
export const localDb = {
    async getAllTasks() {
        const tasks = readTasks();
        // 排序：未完成在前、優先級高在前、建立時間新在前
        // Sort: incomplete first, higher priority first, newer first
        return tasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (b.priority !== a.priority) return b.priority - a.priority;
            return (b.created_at || '').localeCompare(a.created_at || '');
        });
    },

    async createTask(task) {
        const tasks = readTasks();
        const id = task.id || crypto.randomUUID();
        tasks.push({
            id,
            title: task.title,
            description: task.description || '',
            category: task.category || 'general',
            priority: task.priority || 0,
            completed: false,
            due_date: task.due_date || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        writeTasks(tasks);
        return id;
    },

    async updateTask(id, updates) {
        const tasks = readTasks();
        const idx = tasks.findIndex((t) => t.id === id);
        if (idx < 0) return;
        const ALLOWED = ['title', 'description', 'category', 'priority', 'completed', 'due_date'];
        ALLOWED.forEach((key) => {
            if (key in updates) tasks[idx][key] = updates[key];
        });
        tasks[idx].updated_at = new Date().toISOString();
        writeTasks(tasks);
    },

    async deleteTask(id) {
        const tasks = readTasks().filter((t) => t.id !== id);
        writeTasks(tasks);
    },

    async toggleTask(id) {
        const tasks = readTasks();
        const idx = tasks.findIndex((t) => t.id === id);
        if (idx < 0) return;
        tasks[idx].completed = !tasks[idx].completed;
        tasks[idx].updated_at = new Date().toISOString();
        writeTasks(tasks);
    },

    // ── Sync Helpers ──

    /**
     * 取得全部任務 JSON（用於上傳至伺服器）/ Export all tasks for server upload
     */
    exportAllTasks() {
        return readTasks();
    },

    /**
     * 覆蓋全部本地任務（用於伺服器同步下載）/ Replace all local tasks (server sync download)
     */
    replaceAllTasks(tasks) {
        writeTasks(Array.isArray(tasks) ? tasks : []);
    },
};

export default localDb;
