/**
 * 任務管理頁面 / Task Management Page
 * 本地 CRUD 操作、篩選、匯出 Markdown
 * Local CRUD operations, filtering, and Markdown export.
 */
import { useEffect, useState } from 'react';
import useTaskStore from '../stores/taskStore';

// ── 新增/編輯表單 / Add/Edit Form ──
function TaskForm({ editTask, onClose }) {
    const addTask = useTaskStore((s) => s.addTask);
    const updateTask = useTaskStore((s) => s.updateTask);

    const [title, setTitle] = useState(editTask?.title || '');
    const [description, setDescription] = useState(editTask?.description || '');
    const [category, setCategory] = useState(editTask?.category || 'general');
    const [priority, setPriority] = useState(editTask?.priority || 0);
    const [dueDate, setDueDate] = useState(editTask?.due_date || '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        const data = { title, description, category, priority, due_date: dueDate || null };

        if (editTask) {
            await updateTask(editTask.id, data);
        } else {
            await addTask(data);
        }
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="glass-card p-4 space-y-3 animate-fade-in-up">
            <h3 className="text-sm font-semibold text-text-secondary">
                {editTask ? '✏️ 編輯任務 / Edit Task' : '➕ 新增任務 / New Task'}
            </h3>

            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="任務標題 / Task title..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary-light transition-colors"
                autoFocus
            />

            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述（選填）/ Description (optional)..."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary-light transition-colors resize-none"
            />

            <div className="flex gap-3">
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary-light"
                >
                    <option value="general">📁 一般 / General</option>
                    <option value="homework">📝 作業 / Homework</option>
                    <option value="exam">📖 考試 / Exam</option>
                    <option value="project">🚀 專案 / Project</option>
                    <option value="personal">👤 個人 / Personal</option>
                </select>

                <select
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary-light"
                >
                    <option value={0}>普通 / Normal</option>
                    <option value={1}>⭐ 重要</option>
                    <option value={2}>⭐⭐ 緊急</option>
                    <option value={3}>⭐⭐⭐ 最高</option>
                </select>
            </div>

            <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-primary-light"
            />

            <div className="flex gap-2 justify-end">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
                >
                    取消 / Cancel
                </button>
                <button
                    type="submit"
                    className="px-4 py-1.5 text-sm bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors"
                >
                    {editTask ? '更新 / Update' : '新增 / Add'}
                </button>
            </div>
        </form>
    );
}

// ── 單一任務項目 / Task Item ──
function TaskItem({ task, onEdit }) {
    const toggleTask = useTaskStore((s) => s.toggleTask);
    const deleteTask = useTaskStore((s) => s.deleteTask);

    const categoryIcons = {
        general: '📁', homework: '📝', exam: '📖', project: '🚀', personal: '👤',
    };

    return (
        <div className={`glass-card glass-card-hover p-3 flex items-start gap-3 ${task.completed ? 'opacity-60' : ''}`}>
            {/* 完成勾選 / Completion toggle */}
            <button
                onClick={() => toggleTask(task.id)}
                className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${task.completed
                        ? 'bg-success border-success text-white'
                        : 'border-text-muted hover:border-primary-light'
                    }`}
            >
                {task.completed && <span className="text-xs">✓</span>}
            </button>

            {/* 內容 / Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm">{categoryIcons[task.category] || '📁'}</span>
                    <p className={`text-sm font-medium truncate ${task.completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                        {task.title}
                    </p>
                    {'⭐'.repeat(task.priority || 0) && (
                        <span className="text-xs flex-shrink-0">{'⭐'.repeat(Math.min(task.priority || 0, 3))}</span>
                    )}
                </div>
                {task.description && (
                    <p className="text-xs text-text-muted mt-0.5 truncate">{task.description}</p>
                )}
                {task.due_date && (
                    <p className="text-xs text-secondary mt-0.5">📅 {task.due_date}</p>
                )}
            </div>

            {/* 操作按鈕 / Actions */}
            <div className="flex gap-1 flex-shrink-0">
                <button
                    onClick={() => onEdit(task)}
                    className="w-7 h-7 flex items-center justify-center text-xs rounded-md hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                >
                    ✏️
                </button>
                <button
                    onClick={() => deleteTask(task.id)}
                    className="w-7 h-7 flex items-center justify-center text-xs rounded-md hover:bg-danger/20 text-text-muted hover:text-danger transition-colors"
                >
                    🗑️
                </button>
            </div>
        </div>
    );
}

// ── 主頁面 / Main Page ──
export default function Tasks() {
    const {
        isLoading,
        filter,
        setFilter,
        loadTasks,
        getFilteredTasks,
        exportToMarkdown,
    } = useTaskStore();

    const [showForm, setShowForm] = useState(false);
    const [editTask, setEditTask] = useState(null);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const filteredTasks = getFilteredTasks();

    const filters = [
        { key: 'all', label: '全部 / All' },
        { key: 'active', label: '進行中 / Active' },
        { key: 'completed', label: '已完成 / Done' },
    ];

    return (
        <div className="space-y-4">
            {/* 標題與操作 / Header & actions */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary">✅ 任務管理 / Tasks</h2>
                <div className="flex gap-2">
                    <button
                        onClick={exportToMarkdown}
                        className="text-sm bg-secondary/20 hover:bg-secondary/30 text-secondary px-3 py-1.5 rounded-lg transition-colors"
                        title="匯出為 Markdown / Export as Markdown"
                    >
                        📄 MD
                    </button>
                    <button
                        onClick={() => { setEditTask(null); setShowForm(true); }}
                        className="text-sm bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                        ➕ 新增
                    </button>
                </div>
            </div>

            {/* 篩選器 / Filters */}
            <div className="flex gap-2">
                {filters.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`text-xs px-3 py-1.5 rounded-full transition-all ${filter === f.key
                                ? 'bg-primary/30 text-primary-light border border-primary/30'
                                : 'bg-white/5 text-text-muted hover:bg-white/10 border border-transparent'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* 新增/編輯表單 / Form */}
            {showForm && (
                <TaskForm
                    editTask={editTask}
                    onClose={() => { setShowForm(false); setEditTask(null); }}
                />
            )}

            {/* 任務列表 / Task list */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="glass-card p-3">
                            <div className="skeleton h-5 w-3/4 mb-2" />
                            <div className="skeleton h-3 w-1/2" />
                        </div>
                    ))}
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="glass-card p-8 text-center animate-fade-in-up">
                    <p className="text-4xl mb-3">📝</p>
                    <p className="text-text-secondary">沒有任務 / No tasks</p>
                    <p className="text-sm text-text-muted mt-1">按「新增」建立第一個任務 / Click "+" to create one</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filteredTasks.map((task, i) => (
                        <div key={task.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                            <TaskItem
                                task={task}
                                onEdit={(t) => { setEditTask(t); setShowForm(true); }}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* 底部統計 / Bottom stats */}
            {filteredTasks.length > 0 && (
                <div className="text-center text-xs text-text-muted pt-2">
                    📊 {filteredTasks.filter((t) => t.completed).length}/{filteredTasks.length} 已完成 / completed
                </div>
            )}
        </div>
    );
}
