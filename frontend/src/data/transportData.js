/**
 * 交通頁面資料設定 / Transport Page Data Configuration
 * 定義校園周邊公車路線與站點
 * 站牌名稱以 TDX API 實際回傳為準
 */

export const busRoutes = [
    {
        id: '301', name: '301',
        description: '新民高中 — 靜宜大學',
        from: '新民高中', to: '靜宜大學',
    },
    {
        id: '368', name: '368',
        description: '臺中火車站 — 沙鹿',
        from: '臺中火車站', to: '沙鹿',
    },
    {
        id: '162', name: '162',
        description: '嘉陽高中 — 靜宜大學',
        from: '嘉陽高中', to: '靜宜大學',
    },
];

/**
 * 靜宜大學附近站點 — 來自 TDX API 真實資料
 * 注意：TDX 回傳的站名沒有空格分隔，與校內慣用名不同
 */
export const busStops = [
    { id: 'stop-1', name: '靜宜大學(校門)' },
    { id: 'stop-2', name: '靜宜大學(英才路)' },
    { id: 'stop-3', name: '靜宜大學主顧樓' },
    { id: 'stop-4', name: '靜宜大學靜園餐廳' },
    { id: 'stop-5', name: '靜宜大學主顧聖母堂' },
    { id: 'stop-6', name: '靜宜會館' },
];
