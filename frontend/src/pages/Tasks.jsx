/**
 * 任務管理頁面 / Task Management Page
 * 間距參考 Dcard / Instagram
 */
import { useEffect, useState, useRef } from 'react';
import useTaskStore from '../stores/taskStore';
import {
    IconCheckSquare, IconPlus, IconEdit, IconTrash,
    IconCheck, IconDownload, IconStar,
    IconFolder, IconBook, IconCalendar, IconUser,
    IconDotsVertical,
} from '../components/Icons';

const categoryIcons = {
    general: IconFolder, homework: IconEdit, exam: IconBook,
    project: IconCheckSquare, personal: IconUser,
};

// ── 表單 / Form ──
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
        if (editTask) { await updateTask(editTask.id, data); }
        else { await addTask(data); }
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {editTask ? '編輯任務 Edit Task' : '新增任務 New Task'}
            </h3>

            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="任務標題 Task title..." className="input" autoFocus aria-label="任務標題" />

            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="描述（選填）Description (optional)..."
                rows={2} className="input" style={{ resize: 'none' }} aria-label="任務描述" />

            <div style={{ display: 'flex', gap: '12px' }}>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input" style={{ flex: 1 }} aria-label="任務類別">
                    <option value="general">一般 General</option>
                    <option value="homework">作業 Homework</option>
                    <option value="exam">考試 Exam</option>
                    <option value="project">專案 Project</option>
                    <option value="personal">個人 Personal</option>
                </select>
                <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="input" style={{ width: '130px' }} aria-label="任務優先順序">
                    <option value={0}>普通 Normal</option>
                    <option value={1}>重要 High</option>
                    <option value={2}>緊急 Urgent</option>
                    <option value={3}>最高 Critical</option>
                </select>
            </div>

            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" aria-label="截止日期" />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                <button type="button" onClick={onClose} className="btn btn-ghost" style={{ fontSize: '13px' }}>取消 Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '13px' }}>
                    {editTask ? '更新 Update' : '新增 Add'}
                </button>
            </div>
        </form>
    );
}

// ── 任務項目 / Task Item ──
function TaskItem({ task, onEdit }) {
    const toggleTask = useTaskStore((s) => s.toggleTask);
    const deleteTask = useTaskStore((s) => s.deleteTask);
    const CatIcon = categoryIcons[task.category] || IconFolder;

    return (
        <div
            className="card card-hover"
            style={{
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                opacity: task.completed ? 0.5 : 1,
            }}
        >
            {/* 完成勾選 */}
            <button
                onClick={() => toggleTask(task.id)}
                aria-label={task.completed ? '取消完成' : '標記完成'}
                style={{
                    width: '22px', height: '22px', marginTop: '2px', borderRadius: '7px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, cursor: 'pointer',
                    border: `2px solid ${task.completed ? 'var(--color-success)' : 'var(--border)'}`,
                    background: task.completed ? 'var(--color-success)' : 'transparent',
                    color: task.completed ? 'white' : 'transparent',
                }}
            >
                {task.completed && <IconCheck size={12} />}
            </button>

            {/* 內容 */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CatIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <p style={{
                        fontSize: '14px', fontWeight: 500, color: task.completed ? 'var(--text-muted)' : 'var(--text)',
                        textDecoration: task.completed ? 'line-through' : 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {task.title}
                    </p>
                    {task.priority > 0 && (
                        <span style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                            {Array.from({ length: Math.min(task.priority, 3) }, (_, i) => (
                                <IconStar key={i} size={10} style={{ color: 'var(--color-warning)', fill: 'var(--color-warning)' }} />
                            ))}
                        </span>
                    )}
                </div>
                {task.description && (
                    <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</p>
                )}
                {task.due_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                        <IconCalendar size={11} style={{ color: 'var(--color-warning)' }} />
                        <span style={{ fontSize: '12px', color: 'var(--color-warning)' }}>{task.due_date}</span>
                    </div>
                )}
            </div>

            {/* 操作 */}
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => onEdit(task)}
                    aria-label="編輯任務"
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <IconEdit size={14} />
                </button>
                <button onClick={() => deleteTask(task.id)}
                    aria-label="刪除任務"
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <IconTrash size={14} />
                </button>
            </div>
        </div>
    );
}

// ── 主頁面 / Main Page ──
export default function Tasks() {
    const { isLoading, filter, setFilter, loadTasks, getFilteredTasks, exportToMarkdown } = useTaskStore();
    const [showForm, setShowForm] = useState(false);
    const [editTask, setEditTask] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    useEffect(() => {
        if (!showMenu) return;
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showMenu]);
    const filteredTasks = getFilteredTasks();

    const filters = [
        { key: 'all', label: '全部 All' },
        { key: 'active', label: '進行中 Active' },
        { key: 'completed', label: '已完成 Done' },
    ];

    return (
        <div className="section-stack animate-fade-in">
            {/* 標題 */}
            <div className="page-header">
                <div className="page-title-group">
                    <IconCheckSquare size={22} style={{ color: 'var(--text-muted)' }} />
                    <h2 className="page-title">任務管理</h2>
                    <span className="page-subtitle">Tasks</span>
                </div>
                <div className="page-menu-wrapper" ref={menuRef}>
                    {/* 桌面：直接顯示按鈕 */}
                    <div className="page-header-actions">
                        <button onClick={exportToMarkdown} className="btn btn-ghost" style={{ fontSize: '13px' }} aria-label="匯出為 Markdown">
                            <IconDownload size={15} /> MD
                        </button>
                        <button onClick={() => { setEditTask(null); setShowForm(true); }} className="btn btn-primary" style={{ fontSize: '13px' }} aria-label="新增任務">
                            <IconPlus size={15} /> 新增
                        </button>
                    </div>
                    {/* 手機：收納按鈕 */}
                    <button className="page-header-menu-btn" onClick={() => setShowMenu(v => !v)} aria-label="更多操作">
                        <IconDotsVertical size={18} />
                    </button>
                    {showMenu && (
                        <div className="page-menu-dropdown">
                            <button onClick={() => { exportToMarkdown(); setShowMenu(false); }} className="btn btn-ghost">
                                <IconDownload size={14} /> 匯出 Markdown
                            </button>
                            <button onClick={() => { setEditTask(null); setShowForm(true); setShowMenu(false); }} className="btn btn-primary">
                                <IconPlus size={14} /> 新增任務
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 篩選器 */}
            <div style={{ display: 'flex', gap: '8px' }}>
                {filters.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        style={{
                            fontSize: '12px', padding: '8px 16px', borderRadius: '999px',
                            fontWeight: 500, cursor: 'pointer', border: 'none',
                            transition: 'all 0.15s',
                            background: filter === f.key ? 'var(--color-brand-subtle)' : 'var(--bg-secondary)',
                            color: filter === f.key ? 'var(--color-brand)' : 'var(--text-muted)',
                            outline: filter === f.key ? '1.5px solid var(--color-brand)' : 'none',
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* 表單 */}
            {showForm && (
                <TaskForm editTask={editTask} onClose={() => { setShowForm(false); setEditTask(null); }} />
            )}

            {/* 任務列表 */}
            {isLoading ? (
                <div className="card-stack">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div className="skeleton" style={{ height: '20px', width: '75%' }} />
                            <div className="skeleton" style={{ height: '14px', width: '50%' }} />
                        </div>
                    ))}
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="card animate-fade-in" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <IconCheckSquare size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>沒有任務</p>
                    <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>按「新增」建立第一個任務</p>
                </div>
            ) : (
                <div className="card-stack">
                    {filteredTasks.map((task, i) => (
                        <div key={task.id} className="animate-fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
                            <TaskItem task={task} onEdit={(t) => { setEditTask(t); setShowForm(true); }} />
                        </div>
                    ))}
                </div>
            )}

            {filteredTasks.length > 0 && (
                <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', paddingTop: '4px' }}>
                    {filteredTasks.filter((t) => t.completed).length}/{filteredTasks.length} 已完成 completed
                </p>
            )}
        </div>
    );
}
