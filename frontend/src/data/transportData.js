/**
 * 交通頁面資料設定 / Transport Page Data Configuration
 * 定義校園周邊公車路線
 * 路線站牌名稱由 TDX StopOfRoute API 動態取得
 */

export const busRoutes = [
    {
        id: '301', name: '301',
        description: '靜宜大學 — 新光里',
        from: '靜宜大學靜園餐廳', to: '新光里(新福路)',
        color: '#f97316',
    },
    {
        id: '368', name: '368',
        description: '巨業沙鹿站 — 靜宜大學',
        from: '巨業沙鹿站', to: '靜宜大學主顧聖母堂',
        color: '#3b82f6',
    },
    {
        id: '162', name: '162',
        description: '靜宜大學 — 嘉陽高中',
        from: '靜宜大學主顧聖母堂', to: '嘉陽高中',
        color: '#10b981',
    },
];
