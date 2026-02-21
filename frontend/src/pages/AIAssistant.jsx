/**
 * AI 助理頁面 / AI Assistant Page
 * 功能：
 *  1. 語意辨識與智慧導航
 *  2. 資料查詢 — 查詢課表、成績、公車、任務的實際數據
 *  3. 成績分析 — GPA 統計、最高/最低分、學分總計
 *  4. 課表摘要 — 今日/明日課程、下一堂課
 *  5. 任務管理 — 查詢任務
 *  6. 打字機效果 — 逐字顯示 AI 回覆
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useTimetableStore from '../stores/timetableStore';
import useBusStore from '../stores/busStore';
import useTaskStore from '../stores/taskStore';
import {
    IconBot, IconSend, IconCalendar, IconChartBar,
    IconBus, IconCheckSquare,
} from '../components/Icons';

// ══════════════════════════════════════════
//  資料存取 / Data Access Helpers
// ══════════════════════════════════════════

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function getTodayTimetable() {
    const timetable = useTimetableStore.getState().timetable;
    const dayIndex = new Date().getDay();
    return timetable
        .filter((c) => c.day === dayIndex)
        .sort((a, b) => a.startMinute - b.startMinute);
}

function getTomorrowTimetable() {
    const timetable = useTimetableStore.getState().timetable;
    const dayIndex = (new Date().getDay() + 1) % 7;
    return timetable
        .filter((c) => c.day === dayIndex)
        .sort((a, b) => a.startMinute - b.startMinute);
}

function getNextClass() {
    return useTimetableStore.getState().getNextClass?.() ?? null;
}

function getGradesSummary() {
    const grades = useTimetableStore.getState().grades;
    if (!grades.length) return null;

    const scoreToGPA = (sc) => {
        if (sc >= 90) return 4.3; if (sc >= 85) return 4.0; if (sc >= 80) return 3.7;
        if (sc >= 77) return 3.3; if (sc >= 73) return 3.0; if (sc >= 70) return 2.7;
        if (sc >= 67) return 2.3; if (sc >= 63) return 2.0; if (sc >= 60) return 1.7;
        if (sc >= 50) return 1.0; return 0.0;
    };

    return grades.map((sem) => {
        const numeric = (sem.courses || []).filter((c) => c.score != null && c.score_text == null);
        const totalCredits = (sem.courses || []).reduce((s, c) => s + (c.credits || 0), 0);
        let gpa = sem.gpa;
        let avg = sem.weighted_average;
        if (!gpa && numeric.length) {
            const credits = numeric.reduce((s, c) => s + (c.credits || 0), 0);
            gpa = credits ? (numeric.reduce((s, c) => s + scoreToGPA(c.score) * (c.credits || 0), 0) / credits).toFixed(2) : null;
            avg = credits ? (numeric.reduce((s, c) => s + c.score * (c.credits || 0), 0) / credits).toFixed(1) : null;
        }
        const highest = numeric.length ? numeric.reduce((a, b) => a.score > b.score ? a : b) : null;
        const lowest = numeric.length ? numeric.reduce((a, b) => a.score < b.score ? a : b) : null;
        return { name: sem.name, courses: sem.courses, gpa, avg, totalCredits, highest, lowest, rank: sem.rank };
    });
}

function getBusInfo() {
    const { arrivals } = useBusStore.getState();
    return arrivals
        .filter((a) => a.estimatedMinutes != null || a.stopStatus === '進站中')
        .slice(0, 5);
}

function getTasksSummary() {
    const { tasks } = useTaskStore.getState();
    const pending = tasks.filter((t) => !t.completed);
    const completed = tasks.filter((t) => t.completed);
    const overdue = pending.filter((t) => t.due_date && new Date(t.due_date) < new Date());
    return { total: tasks.length, pending: pending.length, completed: completed.length, overdue: overdue.length, pendingTasks: pending.slice(0, 5), overdueTasks: overdue.slice(0, 3) };
}

// ══════════════════════════════════════════
//  意圖解析引擎 / Intent Engine
// ══════════════════════════════════════════

const INTENTS = [
    // ── 課表相關 ──
    {
        keywords: ['今天課', '今日課表', '今天有什麼課', '今天上什麼'],
        handler() {
            const classes = getTodayTimetable();
            if (!classes.length) return { text: '今天沒有課喔！好好休息吧 🎉', action: null };
            const list = classes.map((c) => `• ${c.time || ''} ${c.name}${c.location ? `（${c.location}）` : ''}`).join('\n');
            return { text: `今天有 ${classes.length} 堂課：\n${list}`, action: '/timetable' };
        },
    },
    {
        keywords: ['明天課', '明天有什麼課', '明日課表'],
        handler() {
            const classes = getTomorrowTimetable();
            if (!classes.length) return { text: '明天沒有課！可以好好安排其他事 😎', action: null };
            const list = classes.map((c) => `• ${c.time || ''} ${c.name}${c.location ? `（${c.location}）` : ''}`).join('\n');
            return { text: `明天有 ${classes.length} 堂課：\n${list}`, action: '/timetable' };
        },
    },
    {
        keywords: ['下一堂', '下堂課', '接下來', '下一節'],
        handler() {
            const next = getNextClass();
            if (!next) return { text: '接下來沒有更多課程了 🎉', action: null };
            const when = next.minutesUntil != null
                ? `還有 ${next.minutesUntil} 分鐘`
                : (next.isToday === false ? '明天' : '');
            return {
                text: `下一堂：${next.name}\n📍 ${next.location || '未指定'}\n🕐 ${next.time || ''} ${when}`,
                action: '/timetable',
            };
        },
    },
    {
        keywords: ['課表', 'schedule', 'timetable', 'class'],
        handler() {
            const timetable = useTimetableStore.getState().timetable;
            if (!timetable.length) return { text: '尚未載入課表，請先到設定頁面登入同步。', action: '/settings' };
            const days = {};
            timetable.forEach((c) => {
                const d = DAY_NAMES[c.day] || '?';
                if (!days[d]) days[d] = [];
                days[d].push(c);
            });
            const summary = Object.entries(days)
                .map(([d, cs]) => `星期${d}：${cs.map((c) => c.name).join('、')}`)
                .join('\n');
            return { text: `你的課表概覽：\n${summary}\n\n共 ${timetable.length} 堂課`, action: '/timetable' };
        },
    },

    // ── 成績相關 ──
    {
        keywords: ['GPA', 'gpa', '績點'],
        handler() {
            const semesters = getGradesSummary();
            if (!semesters) return { text: '尚未載入成績，請先登入同步。', action: '/settings' };
            const lines = semesters.map((s) => `${s.name}：GPA ${s.gpa ?? '--'} ｜加權 ${s.avg ?? '--'}`);
            return { text: `📊 GPA 總覽\n${lines.join('\n')}`, action: '/grades' };
        },
    },
    {
        keywords: ['最高分', '最好成績', '最強'],
        handler() {
            const semesters = getGradesSummary();
            if (!semesters) return { text: '尚無成績資料。', action: '/grades' };
            const lines = semesters
                .filter((s) => s.highest)
                .map((s) => `${s.name} 最高：${s.highest.name} ${s.highest.score}分`);
            return { text: lines.length ? lines.join('\n') : '找不到數字成績', action: '/grades' };
        },
    },
    {
        keywords: ['最低分', '最差', '最爛'],
        handler() {
            const semesters = getGradesSummary();
            if (!semesters) return { text: '尚無成績資料。', action: '/grades' };
            const lines = semesters
                .filter((s) => s.lowest)
                .map((s) => `${s.name} 最低：${s.lowest.name} ${s.lowest.score}分`);
            return { text: lines.length ? lines.join('\n') : '找不到數字成績', action: '/grades' };
        },
    },
    {
        keywords: ['成績', 'grade', 'score', '分數'],
        handler() {
            const semesters = getGradesSummary();
            if (!semesters) return { text: '尚未載入成績，請先登入同步。', action: '/settings' };
            const lines = semesters.map((s) => {
                const courseCount = (s.courses || []).length;
                return `📚 ${s.name}\n   GPA ${s.gpa ?? '--'} ｜加權 ${s.avg ?? '--'} ｜${courseCount} 門 ${s.totalCredits} 學分${s.rank ? ` ｜排名 ${s.rank}` : ''}`;
            });
            return { text: `成績總覽：\n${lines.join('\n\n')}`, action: '/grades' };
        },
    },

    // ── 公車相關 ──
    {
        keywords: ['公車', 'bus', '到站', '幾分鐘'],
        handler() {
            const buses = getBusInfo();
            if (!buses.length) return { text: '目前沒有即時公車資訊，可能服務暫停或資料尚未載入。', action: '/transport' };
            const list = buses.map((b) => {
                const status = b.stopStatus === '進站中' ? '🟢 進站中' : `⏱ ${b.estimatedMinutes} 分鐘`;
                return `• ${b.routeName}${b.direction ? ` (${b.direction})` : ''} — ${status}`;
            }).join('\n');
            return { text: `🚌 公車即時資訊：\n${list}`, action: '/transport' };
        },
    },

    // ── 任務相關 ──
    {
        keywords: ['任務', 'task', 'todo', '作業', '待辦'],
        handler() {
            const info = getTasksSummary();
            if (!info.total) return { text: '目前沒有任何任務。要新增嗎？', action: '/tasks' };
            let text = `📋 任務概覽：${info.pending} 件待完成、${info.completed} 件已完成`;
            if (info.overdue > 0) text += `\n⚠️ ${info.overdue} 件已逾期！`;
            if (info.pendingTasks.length) {
                text += '\n\n待辦事項：';
                text += info.pendingTasks.map((t) => `\n• ${t.title}${t.due_date ? ` (截止 ${t.due_date})` : ''}`).join('');
            }
            return { text, action: '/tasks' };
        },
    },

    // ── 幫助 ──
    {
        keywords: ['幫助', 'help', '功能', '你能做什麼', '你會什麼'],
        handler() {
            return {
                text: `我可以幫你：
📅 查課表 — 「今天有什麼課」「下一堂」
📊 查成績 — 「GPA 多少」「最高分」「成績概覽」
🚌 查公車 — 「公車幾分鐘」
📋 查任務 — 「待辦事項」「有什麼作業」
🧭 導航 — 「開課表」「去設定」

試試看吧！`,
                action: null,
            };
        },
    },

    // ── 日常 ──
    { keywords: ['你好', 'hello', 'hi', '嗨', '哈囉'], handler: () => ({ text: '你好！我是披呦 AI 助理 🤖\n有什麼可以幫忙的？輸入「幫助」看我能做什麼！', action: null }) },
    { keywords: ['謝謝', 'thanks', '感謝'], handler: () => ({ text: '不客氣！有需要隨時問我 😊', action: null }) },
    { keywords: ['掰掰', 'bye', '再見'], handler: () => ({ text: '掰掰！有問題再找我 👋', action: null }) },
    {
        keywords: ['天氣', 'weather', '下雨'],
        handler: () => ({ text: '我目前還沒有天氣功能，但未來可能會加入！你可以先查成績或課表 📚', action: null }),
    },
    {
        keywords: ['笑話', 'joke', '有趣'],
        handler: () => {
            const jokes = [
                'AI 助理不會累，但我會覺得你的 GPA 很累 😂',
                '為什麼程式設計師喜歡暗色模式？因為 bug 在暗處比較好藏 🐛',
                '什麼時候的公車最準時？在 Mock 資料裡的時候 🚌',
            ];
            return { text: jokes[Math.floor(Math.random() * jokes.length)], action: null };
        },
    },
];

function parseIntent(input) {
    const n = input.toLowerCase().trim();

    // 先精確匹配意圖 / Exact intent match first
    for (const intent of INTENTS) {
        if (intent.keywords.some((k) => n.includes(k.toLowerCase()))) {
            return intent.handler();
        }
    }

    // Fallback — 模糊提示
    return {
        text: `抱歉，我不太理解「${input}」。\n\n我可以幫你查：\n📅 課表 · 📊 成績 · 🚌 公車 · 📋 任務\n\n輸入「幫助」看完整功能列表！`,
        action: null,
    };
}

// ══════════════════════════════════════════
//  打字機效果 Hook / Typewriter Effect Hook
// ══════════════════════════════════════════

function useTypewriter(text, speed = 20) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!text) { setDisplayed(''); setDone(true); return; }
        setDisplayed('');
        setDone(false);
        let i = 0;
        const id = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) { clearInterval(id); setDone(true); }
        }, speed);
        return () => clearInterval(id);
    }, [text, speed]);

    return { displayed, done };
}

// ══════════════════════════════════════════
//  UI 元件 / UI Components
// ══════════════════════════════════════════

function TypewriterBubble({ message, isLatest }) {
    const isUser = message.role === 'user';
    const shouldAnimate = !isUser && isLatest;
    const { displayed, done } = useTypewriter(
        shouldAnimate ? message.content : null,
        15,
    );
    const text = shouldAnimate ? displayed : message.content;

    return (
        <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }} className="animate-fade-in">
            {!isUser && (
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    marginRight: '10px', marginTop: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--color-brand-subtle)', color: 'var(--color-brand)',
                }}>
                    <IconBot size={16} />
                </div>
            )}
            <div style={{
                maxWidth: '78%', borderRadius: '20px', padding: '12px 18px',
                fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-line',
                background: isUser ? 'var(--color-brand)' : 'var(--bg-card)',
                color: isUser ? 'white' : 'var(--text)',
                border: isUser ? 'none' : '1px solid var(--border)',
                borderBottomRightRadius: isUser ? '6px' : undefined,
                borderBottomLeftRadius: !isUser ? '6px' : undefined,
            }}>
                {text}
                {shouldAnimate && !done && <span style={{ opacity: 0.5, animation: 'blink 1s infinite' }}>▌</span>}
                {message.action && (done || !shouldAnimate) && (
                    <a href={`#${message.action}`} style={{
                        display: 'block', marginTop: '10px', fontSize: '12px',
                        borderRadius: '10px', padding: '8px 0', textAlign: 'center',
                        fontWeight: 500, textDecoration: 'none',
                        background: isUser ? 'rgba(255,255,255,0.15)' : 'var(--color-brand-subtle)',
                        color: isUser ? 'white' : 'var(--color-brand)',
                    }}>前往查看 →</a>
                )}
            </div>
        </div>
    );
}

function QuickSuggestions({ onSelect }) {
    const items = [
        { icon: IconCalendar, text: '今天有什麼課' },
        { icon: IconChartBar, text: 'GPA 多少' },
        { icon: IconBus, text: '公車幾分鐘' },
        { icon: IconCheckSquare, text: '待辦事項' },
    ];
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
            {items.map((s) => (
                <button key={s.text} onClick={() => onSelect(s.text)} className="card card-hover"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    <s.icon size={16} style={{ color: 'var(--color-brand)' }} />{s.text}
                </button>
            ))}
        </div>
    );
}

function FollowUpChips({ suggestions, onSelect }) {
    if (!suggestions?.length) return null;
    return (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingLeft: '42px' }}>
            {suggestions.map((s) => (
                <button key={s} onClick={() => onSelect(s)} className="card-hover"
                    style={{
                        padding: '6px 12px', fontSize: '12px', borderRadius: '16px',
                        border: '1px solid var(--border)', background: 'var(--bg-card)',
                        color: 'var(--color-brand)', cursor: 'pointer',
                    }}>
                    {s}
                </button>
            ))}
        </div>
    );
}

// ═══ 追蹤建議 / Follow-up suggestions mapping ═══
function getFollowUps(text) {
    if (text.includes('課表') || text.includes('堂課')) return ['下一堂', 'GPA 多少', '公車幾分鐘'];
    if (text.includes('GPA') || text.includes('成績')) return ['最高分', '最低分', '今天有什麼課'];
    if (text.includes('公車')) return ['今天有什麼課', '待辦事項'];
    if (text.includes('任務') || text.includes('待辦')) return ['今天有什麼課', '公車幾分鐘'];
    return [];
}

// ══════════════════════════════════════════
//  主元件 / Main Component
// ══════════════════════════════════════════

export default function AIAssistant() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([{
        role: 'assistant',
        content: '嗨！我是披呦 AI 助理 🤖\n\n我可以幫你查詢課表、成績、公車和任務，試試看下面的按鈕，或直接輸入問題！',
        action: null,
    }]);
    const [input, setInput] = useState('');
    const [followUps, setFollowUps] = useState([]);
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = useCallback((text) => {
        const msg = text || input.trim();
        if (!msg) return;
        const result = parseIntent(msg);
        setMessages((p) => [
            ...p,
            { role: 'user', content: msg },
            { role: 'assistant', content: result.text, action: result.action },
        ]);
        setInput('');
        setFollowUps(getFollowUps(result.text));
        if (result.action) setTimeout(() => navigate(result.action), 2500);
    }, [input, navigate]);

    const latestAssistantIdx = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') return i;
        }
        return -1;
    })();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: 'calc(-1 * var(--space-page))' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IconBot size={22} style={{ color: 'var(--text-muted)' }} />
                <div>
                    <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text)' }}>AI 助理</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>資料查詢 · 智慧分析 · 導航</p>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '16px' }}>
                {messages.map((m, i) => (
                    <TypewriterBubble key={i} message={m} isLatest={i === latestAssistantIdx} />
                ))}
                <FollowUpChips suggestions={followUps} onSelect={handleSend} />
                <div ref={endRef} />
            </div>

            {/* Quick suggestions on first visit */}
            {messages.length <= 2 && (
                <div style={{ padding: '0 20px 12px' }}>
                    <QuickSuggestions onSelect={handleSend} />
                </div>
            )}

            {/* Input */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="問我任何問題… 例如「今天有什麼課」" className="input" style={{ flex: 1 }} />
                    <button onClick={() => handleSend()} disabled={!input.trim()} className="btn btn-primary"
                        style={{ padding: '0 14px', opacity: input.trim() ? 1 : 0.3 }}>
                        <IconSend size={18} />
                    </button>
                </div>
            </div>

            {/* Blink cursor animation */}
            <style>{`
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}</style>
        </div>
    );
}
