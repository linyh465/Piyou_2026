/**
 * 靜宜大學大樓代碼對照表
 * Providence University Building Code Reference
 */
export const BUILDINGS = {
    AK: { zh: '任垣樓', en: 'Anthony Kuo Hall' },
    SP: { zh: '伯鐸樓', en: 'St. Peter Hall' },
    JA: { zh: '靜安樓', en: 'Jing An Hall' },
    TG: { zh: '格倫樓', en: 'Theodore Guerin Hall' },
    PH: { zh: '主顧樓', en: 'Providence Hall' },
    SF: { zh: '方濟樓', en: 'St. Francis Hall' },
    SY: { zh: '思源樓', en: 'Si Yuan Hall' },
    '2R': { zh: '第二研究大樓', en: 'The 2nd Research Building' },
    'AK-3C': { zh: '計算機中心', en: 'Computer Center' },
    '1R': { zh: '第一研究大樓', en: 'The 1st Research Building' },
    ST: { zh: '體育館', en: 'John Paul II Sports Hall' },
    SD: { zh: '田徑場', en: 'Athletic Field' },
};

/**
 * 從教室代碼解析大樓資訊
 * e.g. "AK-101" → { code: "AK", room: "101", zh: "任垣樓", en: "Anthony Kuo Hall" }
 */
export function parseRoom(location) {
    if (!location) return null;
    // 優先匹配多字元代碼（AK-3C、2R、1R）
    for (const code of Object.keys(BUILDINGS).sort((a, b) => b.length - a.length)) {
        if (location.toUpperCase().startsWith(code.toUpperCase())) {
            const room = location.slice(code.length).replace(/^[-\s]/, '');
            return { code, room, ...BUILDINGS[code] };
        }
    }
    return { code: null, room: location, zh: location, en: location };
}
