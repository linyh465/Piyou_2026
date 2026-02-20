/**
 * AI 助理頁面 / AI Assistant Page
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    IconBot, IconSend, IconCalendar, IconChartBar,
    IconBus, IconCheckSquare,
} from '../components/Icons';

const INTENT_RULES = [
    { keywords: ['課表', 'schedule', 'timetable', 'class'], response: '好的，幫你開啟課表！', action: '/timetable' },
    { keywords: ['成績', 'grade', 'score', 'GPA'], response: '幫你查詢成績！', action: '/grades' },
    { keywords: ['任務', 'task', 'todo', '作業'], response: '開啟任務管理！', action: '/tasks' },
    { keywords: ['公車', 'bus', '到站'], response: '查看公車即時資訊！', action: '/' },
    { keywords: ['你好', 'hello', 'hi', '嗨'], response: '你好！我是披呦 AI 助理，有什麼可以幫忙的？', action: null },
    { keywords: ['謝謝', 'thanks'], response: '不客氣！還需要什麼幫助嗎？', action: null },
];

function parseIntent(input) {
    const n = input.toLowerCase().trim();
    for (const r of INTENT_RULES) {
        if (r.keywords.some((k) => n.includes(k))) return r;
    }
    return { response: `我還不太理解「${input}」，但我可以幫你查課表、成績、任務或公車資訊！`, action: null };
}

function MessageBubble({ message }) {
    const isUser = message.role === 'user';
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
                maxWidth: '72%', borderRadius: '20px', padding: '12px 18px',
                fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-line',
                background: isUser ? 'var(--color-brand)' : 'var(--bg-card)',
                color: isUser ? 'white' : 'var(--text)',
                border: isUser ? 'none' : '1px solid var(--border)',
                borderBottomRightRadius: isUser ? '6px' : undefined,
                borderBottomLeftRadius: !isUser ? '6px' : undefined,
            }}>
                {message.content}
                {message.action && (
                    <a href={`#${message.action}`} style={{
                        display: 'block', marginTop: '10px', fontSize: '12px',
                        borderRadius: '10px', padding: '8px 0', textAlign: 'center',
                        fontWeight: 500, textDecoration: 'none',
                        background: isUser ? 'rgba(255,255,255,0.15)' : 'var(--color-brand-subtle)',
                        color: isUser ? 'white' : 'var(--color-brand)',
                    }}>前往 →</a>
                )}
            </div>
        </div>
    );
}

function QuickSuggestions({ onSelect }) {
    const items = [
        { icon: IconCalendar, text: '查課表' },
        { icon: IconChartBar, text: '看成績' },
        { icon: IconBus, text: '公車到站' },
        { icon: IconCheckSquare, text: '管理任務' },
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

export default function AIAssistant() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([{
        role: 'assistant',
        content: '嗨！我是披呦 AI 助理。\n你可以問我課表、成績、任務或公車資訊！',
        action: null,
    }]);
    const [input, setInput] = useState('');
    const endRef = useRef(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleSend = (text) => {
        const msg = text || input.trim();
        if (!msg) return;
        const result = parseIntent(msg);
        setMessages((p) => [...p, { role: 'user', content: msg }, { role: 'assistant', content: result.response, action: result.action }]);
        setInput('');
        if (result.action) setTimeout(() => navigate(result.action), 1500);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', margin: 'calc(-1 * var(--space-page))' }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <IconBot size={22} style={{ color: 'var(--text-muted)' }} />
                <div>
                    <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text)' }}>AI 助理</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>語意辨識 · 智慧導航</p>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '16px' }}>
                {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
                <div ref={endRef} />
            </div>

            {messages.length <= 2 && <div style={{ padding: '0 20px 12px' }}><QuickSuggestions onSelect={handleSend} /></div>}

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="問我任何問題..." className="input" style={{ flex: 1 }} />
                    <button onClick={() => handleSend()} disabled={!input.trim()} className="btn btn-primary"
                        style={{ padding: '0 14px', opacity: input.trim() ? 1 : 0.3 }}>
                        <IconSend size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
