/**
 * 任務管理頁面 / Task Management Page
 */
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useTaskStore from '../stores/taskStore';
import { trackEvent } from '../services/analytics';
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
    const { t } = useTranslation('tasks');
    const { t: tCommon } = useTranslation('common');
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
        if (editTask) { await updateTask(editTask.id, data); trackEvent('button_click', { action: 'task_edit' }, '/tasks'); }
        else { await addTask(data); trackEvent('button_click', { action: 'task_add' }, '/tasks'); }
        onClose();
    };

    return (
        <form onSubmit={handleSubmit} className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {editTask ? t('editTask') : t('addTask')}
            </h3>

            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={t('taskTitlePlaceholder')} className="input" autoFocus aria-label={t('taskTitlePlaceholder')} />

            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={t('taskDescPlaceholder')}
                rows={2} className="input" style={{ resize: 'none' }} aria-label={t('taskDescPlaceholder')} />

            <div style={{ display: 'flex', gap: '12px' }}>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="input" style={{ flex: 1 }} aria-label="category">
                    <option value="general">{t('category.general')}</option>
                    <option value="homework">{t('category.homework')}</option>
                    <option value="exam">{t('category.exam')}</option>
                    <option value="project">{t('category.project')}</option>
                    <option value="personal">{t('category.personal')}</option>
                </select>
                <select value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="input" style={{ width: '130px' }} aria-label="priority">
                    <option value={0}>{t('priority.normal')}</option>
                    <option value={1}>{t('priority.high')}</option>
                    <option value={2}>{t('priority.urgent')}</option>
                    <option value={3}>{t('priority.critical')}</option>
                </select>
            </div>

            <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    {t('dueDate')}
                </label>
                <div style={{ position: 'relative' }}>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" aria-label="due date" />
                    {!dueDate && (
                        <span style={{
                            position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                            color: 'var(--text-muted)', opacity: 0.45, fontSize: '13px',
                            pointerEvents: 'none', userSelect: 'none',
                        }}>
                            請選擇截止日期（可不填）
                        </span>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                <button type="button" onClick={onClose} className="btn btn-ghost" style={{ fontSize: '13px' }}>{tCommon('cancel')}</button>
                <button type="submit" className="btn btn-primary" style={{ fontSize: '13px' }}>
                    {editTask ? t('update') : t('add')}
                </button>
            </div>
        </form>
    );
}

// ── 任務項目 / Task Item ──
function TaskItem({ task, onEdit }) {
    const { t } = useTranslation('tasks');
    const toggleTask = useTaskStore((s) => s.toggleTask);
    const deleteTask = useTaskStore((s) => s.deleteTask);
    const handleToggle = (id, completed) => { toggleTask(id); trackEvent('button_click', { action: completed ? 'task_uncomplete' : 'task_complete' }, '/tasks'); };
    const handleDelete = (id) => { deleteTask(id); trackEvent('button_click', { action: 'task_delete' }, '/tasks'); };
    const CatIcon = categoryIcons[task.category] || IconFolder;

    return (
        <div
            className="card card-hover"
            style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', opacity: task.completed ? 0.5 : 1 }}
        >
            <button
                onClick={() => handleToggle(task.id, task.completed)}
                aria-label={task.completed ? t('cancelDone') : t('markDone')}
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

            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => onEdit(task)}
                    aria-label="edit"
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <IconEdit size={14} />
                </button>
                <button onClick={() => handleDelete(task.id)}
                    aria-label="delete"
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <IconTrash size={14} />
                </button>
            </div>
        </div>
    );
}

// ── 主頁面 / Main Page ──
export default function Tasks() {
    const { t } = useTranslation('tasks');
    const { t: tCommon } = useTranslation('common');
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
        { key: 'all', label: t('filter.all') },
        { key: 'active', label: t('filter.active') },
        { key: 'completed', label: t('filter.done') },
    ];

    return (
        <div className="section-stack animate-fade-in">
            <div className="page-header">
                <div className="page-title-group">
                    <IconCheckSquare size={22} style={{ color: 'var(--text-muted)' }} />
                    <h2 className="page-title">{t('title')}</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => { setEditTask(null); setShowForm(true); }} className="btn btn-primary" style={{ fontSize: '13px' }} aria-label={t('addTask')}>
                        <IconPlus size={15} /> {t('addTask')}
                    </button>
                    <div className="page-menu-wrapper" ref={menuRef}>
                        <div className="page-header-actions">
                            <button onClick={exportToMarkdown} className="btn btn-ghost" style={{ fontSize: '13px' }} aria-label={tCommon('exportMarkdown')}>
                                <IconDownload size={15} /> MD
                            </button>
                        </div>
                        <button className="page-header-menu-btn" onClick={() => setShowMenu(v => !v)} aria-label={tCommon('moreActions')}>
                            <IconDotsVertical size={18} />
                        </button>
                        {showMenu && (
                            <div className="page-menu-dropdown">
                                <button onClick={() => { exportToMarkdown(); setShowMenu(false); }} className="btn btn-ghost">
                                    <IconDownload size={14} /> {tCommon('exportMarkdown')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{
                background: 'rgba(99,102,241,0.06)', borderRadius: '12px', padding: '10px 14px',
                border: '1px solid rgba(99,102,241,0.18)', fontSize: '12px',
                color: 'var(--text-muted)', lineHeight: '1.6',
            }}>
                由於本程式不存取使用者帳號資料，任務資料僅儲存於此裝置，<strong style={{ color: 'var(--text-secondary)' }}>無法跨裝置同步</strong>。
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                {filters.map((f) => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        style={{
                            fontSize: '12px', padding: '8px 16px', borderRadius: '999px',
                            fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                            background: filter === f.key ? 'var(--color-brand-subtle)' : 'var(--bg-secondary)',
                            color: filter === f.key ? 'var(--color-brand)' : 'var(--text-muted)',
                            outline: filter === f.key ? '1.5px solid var(--color-brand)' : 'none',
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {showForm && (
                <TaskForm editTask={editTask} onClose={() => { setShowForm(false); setEditTask(null); }} />
            )}

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
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>{t('noTasks')}</p>
                    <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--text-muted)' }}>{t('noTasksHint')}</p>
                </div>
            ) : (
                <div className="card-stack">
                    {filteredTasks.map((task, i) => (
                        <div key={task.id} className="animate-fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
                            <TaskItem task={task} onEdit={(tt) => { setEditTask(tt); setShowForm(true); }} />
                        </div>
                    ))}
                </div>
            )}

            {filteredTasks.length > 0 && (
                <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', paddingTop: '4px' }}>
                    {t('completedCount', { done: filteredTasks.filter((tt) => tt.completed).length, total: filteredTasks.length })}
                </p>
            )}
        </div>
    );
}
