/**
 * AI 助理頁面 / AI Assistant Page
 * 語意解析使用者輸入，判斷意圖並觸發對應 UI 元件或導航
 * Parses user input semantically to detect intent and trigger corresponding UI or navigation.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ── 意圖規則 / Intent Rules ──
const INTENT_RULES = [
    {
        keywords: ['課表', '課程', 'schedule', 'timetable', 'class', '上課'],
        intent: 'timetable',
        response: '📅 好的，幫你開啟課表！ / Opening your timetable!',
        action: '/timetable',
    },
    {
        keywords: ['成績', '分數', 'grade', 'score', 'GPA'],
        intent: 'grades',
        response: '📊 幫你查詢成績！ / Fetching your grades!',
        action: '/grades',
    },
    {
        keywords: ['任務', '待辦', 'task', 'todo', '作業', 'homework', '新增'],
        intent: 'tasks',
        response: '✅ 開啟任務管理！ / Opening task manager!',
        action: '/tasks',
    },
    {
        keywords: ['公車', 'bus', '到站', '幾分鐘', '交通'],
        intent: 'bus',
        response: '🚌 查看公車即時資訊！ / Checking bus arrivals!',
        action: '/',
    },
    {
        keywords: ['你好', 'hello', 'hi', '嗨', '哈囉'],
        intent: 'greeting',
        response: '🐾 你好！我是披呦 AI 助理，有什麼我可以幫忙的嗎？\nHi! I\'m Piyou AI assistant, how can I help?',
        action: null,
    },
    {
        keywords: ['謝謝', 'thanks', 'thank', '感謝'],
        intent: 'thanks',
        response: '😊 不客氣！還需要什麼幫助嗎？\nYou\'re welcome! Need anything else?',
        action: null,
    },
];

/**
 * 語意解析 / Semantic parser
 * 比對使用者輸入與意圖關鍵字
 * Matches user input against intent keywords.
 */
function parseIntent(input) {
    const normalized = input.toLowerCase().trim();

    for (const rule of INTENT_RULES) {
        if (rule.keywords.some((kw) => normalized.includes(kw))) {
            return rule;
        }
    }

    return {
        intent: 'unknown',
        response: `🤔 我還不太理解「${input}」，但我可以幫你查課表、成績、任務或公車資訊！\nI'm not sure about "${input}", but I can help with timetable, grades, tasks, or bus info!`,
        action: null,
    };
}

// ── 訊息氣泡 / Message Bubble ──
function MessageBubble({ message }) {
    const isUser = message.role === 'user';

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
            <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${isUser
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'glass-card rounded-bl-sm'
                    }`}
            >
                {message.content}

                {/* 快速動作按鈕 / Quick action button */}
                {message.action && (
                    <a
                        href={`#${message.action}`}
                        className="mt-2 block text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 text-center transition-colors"
                    >
                        👉 前往 / Go there →
                    </a>
                )}
            </div>
        </div>
    );
}

// ── 快速建議 / Quick Suggestions ──
function QuickSuggestions({ onSelect }) {
    const suggestions = [
        { icon: '📅', text: '查課表' },
        { icon: '📊', text: '看成績' },
        { icon: '🚌', text: '公車到站' },
        { icon: '✅', text: '管理任務' },
    ];

    return (
        <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map((s) => (
                <button
                    key={s.text}
                    onClick={() => onSelect(s.text)}
                    className="glass-card glass-card-hover px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                    {s.icon} {s.text}
                </button>
            ))}
        </div>
    );
}

// ── 主頁面 / Main Page ──
export default function AIAssistant() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: '🐾 嗨！我是披呦 AI 助理。\n你可以問我課表、成績、任務或公車資訊！\n\nHi! I\'m the Piyou AI Assistant.\nAsk me about timetable, grades, tasks, or bus info!',
            action: null,
        },
    ]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (text) => {
        const msg = text || input.trim();
        if (!msg) return;

        // 加入使用者訊息 / Add user message
        const userMsg = { role: 'user', content: msg, action: null };

        // 語意解析 / Semantic parsing
        const result = parseIntent(msg);
        const aiMsg = { role: 'assistant', content: result.response, action: result.action };

        setMessages((prev) => [...prev, userMsg, aiMsg]);
        setInput('');

        // 延遲導航 / Delayed navigation
        if (result.action) {
            setTimeout(() => navigate(result.action), 1500);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full -m-4">
            {/* 標題 / Header */}
            <div className="px-5 py-3">
                <h2 className="text-xl font-bold text-text-primary">🤖 AI 助理 / Assistant</h2>
                <p className="text-xs text-text-muted mt-0.5">語意辨識 · 智慧導航 / Semantic AI · Smart Navigation</p>
            </div>

            {/* 訊息區 / Messages area */}
            <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
                {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} />
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* 快速建議 / Quick suggestions */}
            {messages.length <= 2 && (
                <div className="px-4 pb-3">
                    <QuickSuggestions onSelect={handleSend} />
                </div>
            )}

            {/* 輸入框 / Input area */}
            <div className="p-4 glass-card rounded-none" style={{ borderRadius: 0 }}>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="問我任何問題... / Ask me anything..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary-light transition-colors"
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim()}
                        className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <span className="text-lg">↑</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
