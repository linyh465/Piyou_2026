/**
 * Local SQLite Database Service
 * Uses sql.js (Emscripten-compiled SQLite) for in-browser task caching and offline data.
 * WASM 檔案從本地載入，支援離線使用 / WASM loaded locally for offline support.
 */
import initSqlJs from 'sql.js';

let db = null;

async function getDb() {
    if (db) return db;

    const SQL = await initSqlJs({
        // 使用本地 WASM 檔案，離線可用 / Use local WASM file for offline support
        locateFile: (file) => `/${file}`,
    });

    // Try to restore from localStorage
    const saved = localStorage.getItem('piyou_db');
    if (saved) {
        const buf = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
        db = new SQL.Database(buf);
    } else {
        db = new SQL.Database();
    }

    // Initialize tables
    db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      priority INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      due_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      expires_at TEXT
    );
  `);

    persist();
    return db;
}

function persist() {
    if (!db) return;
    const data = db.export();
    const encoded = btoa(String.fromCharCode(...data));
    localStorage.setItem('piyou_db', encoded);
}

// ── Task CRUD Operations ──
export const localDb = {
    async createTask(task) {
        const d = await getDb();
        const id = task.id || crypto.randomUUID();
        d.run(
            `INSERT INTO tasks (id, title, description, category, priority, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id, task.title, task.description || '', task.category || 'general', task.priority || 0, task.due_date || null]
        );
        persist();
        return id;
    },

    async getAllTasks() {
        const d = await getDb();
        const result = d.exec('SELECT * FROM tasks ORDER BY completed ASC, priority DESC, created_at DESC');
        if (!result.length) return [];
        return result[0].values.map((row) => {
            const obj = {};
            result[0].columns.forEach((col, i) => (obj[col] = row[i]));
            obj.completed = !!obj.completed;
            return obj;
        });
    },

    async updateTask(id, updates) {
        const d = await getDb();
        const ALLOWED_COLUMNS = ['title', 'description', 'category', 'priority', 'completed', 'due_date'];
        const fields = Object.keys(updates).filter((f) => ALLOWED_COLUMNS.includes(f));
        if (!fields.length) return;
        const setClause = fields.map((f) => `${f} = ?`).join(', ');
        d.run(
            `UPDATE tasks SET ${setClause}, updated_at = datetime('now') WHERE id = ?`,
            [...fields.map((f) => updates[f]), id]
        );
        persist();
    },

    async deleteTask(id) {
        const d = await getDb();
        d.run('DELETE FROM tasks WHERE id = ?', [id]);
        persist();
    },

    async toggleTask(id) {
        const d = await getDb();
        d.run("UPDATE tasks SET completed = NOT completed, updated_at = datetime('now') WHERE id = ?", [id]);
        persist();
    },

    // ── Cache Operations ──
    async setCache(key, value, ttlSeconds = 300) {
        const d = await getDb();
        const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        d.run(
            `INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)`,
            [key, JSON.stringify(value), expires]
        );
        persist();
    },

    async getCache(key) {
        const d = await getDb();
        const result = d.exec('SELECT value, expires_at FROM cache WHERE key = ?', [key]);
        if (!result.length || !result[0].values.length) return null;
        const [value, expires] = result[0].values[0];
        if (new Date(expires) < new Date()) {
            d.run('DELETE FROM cache WHERE key = ?', [key]);
            persist();
            return null;
        }
        return JSON.parse(value);
    },
};

export default localDb;
