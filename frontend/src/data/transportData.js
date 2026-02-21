/**
 * 交通頁面資料設定 / Transport Page Data Configuration
 * 定義校園周邊公車路線
 * 路線站牌名稱由 TDX StopOfRoute API 動態取得
 */

export const busRoutes = [
    {
        id: '301', name: '301',
        description: '新民高中 — 新光里(新福路)',
        from: '新民高中', to: '新光里(新福路)',
        color: '#f97316',
    },
    {
        id: '368', name: '368',
        description: '臺中火車站 — 沙鹿',
        from: '臺中火車站(東站)', to: '沙鹿',
        color: '#3b82f6',
    },
    {
        id: '162', name: '162',
        description: '嘉陽高中 — 靜宜大學',
        from: '嘉陽高中', to: '靜宜大學(英才路)',
        color: '#10b981',
    },
];
