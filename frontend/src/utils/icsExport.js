/**
 * ICS 行事曆匯出工具 / ICS Calendar Export Utility
 * 將課表資料轉換為標準 iCalendar (.ics) 格式
 * Converts timetable data to standard iCalendar (.ics) format
 */

const PERIOD_TIMES = {
    1: '08:10', 2: '09:10', 3: '10:10', 4: '11:10',
    5: '13:10', 6: '14:10', 7: '15:10', 8: '16:10',
    9: '17:10', 10: '18:05', 11: '19:00', 12: '19:55', 13: '20:50',
};
const PERIOD_END_TIMES = {
    1: '09:00', 2: '10:00', 3: '11:00', 4: '12:00',
    5: '14:00', 6: '15:00', 7: '16:00', 8: '17:00',
    9: '18:00', 10: '18:55', 11: '19:50', 12: '20:45', 13: '21:40',
};

function parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return { h, m };
}

function formatICSDateTime(date, timeStr) {
    const { h, m } = parseTime(timeStr);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(h)}${pad(m)}00`;
}

/** 取得學期開始後第一個符合星期幾的日期 */
function getFirstOccurrence(semesterStart, dayOfWeek) {
    // dayOfWeek: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
    const start = new Date(semesterStart);
    const startDay = start.getDay(); // 0=Sun, 1=Mon, ...
    let diff = dayOfWeek - startDay;
    if (diff < 0) diff += 7;
    const result = new Date(start);
    result.setDate(start.getDate() + diff);
    return result;
}

/** 將同一門課的連續節次合併為一個事件 */
function groupConsecutivePeriods(timetable) {
    const groups = {};
    for (const course of timetable) {
        const key = `${course.name}||${course.day}`;
        if (!groups[key]) {
            groups[key] = {
                name: course.name,
                name_en: course.name_en || '',
                day: course.day,
                location: course.location || '',
                teacher: course.teacher || '',
                periods: [],
            };
        }
        groups[key].periods.push(course.period);
    }

    const events = [];
    for (const g of Object.values(groups)) {
        const sorted = [...g.periods].sort((a, b) => a - b);
        let i = 0;
        while (i < sorted.length) {
            let j = i;
            while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
            events.push({
                name: g.name,
                name_en: g.name_en,
                day: g.day,
                location: g.location,
                teacher: g.teacher,
                startPeriod: sorted[i],
                endPeriod: sorted[j],
            });
            i = j + 1;
        }
    }
    return events;
}

/**
 * 產生 ICS 內容字串
 * @param {Array} timetable - 課表陣列
 * @param {string} semesterStartDate - 學期開始日期 'YYYY-MM-DD'
 * @param {number} semesterWeeks - 學期週數（預設 18）
 */
export function generateICS(timetable, semesterStartDate, semesterWeeks = 18) {
    const events = groupConsecutivePeriods(timetable);

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Piyou//Campus Calendar//ZH',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:披呦課表',
        'X-WR-TIMEZONE:Asia/Taipei',
        'BEGIN:VTIMEZONE',
        'TZID:Asia/Taipei',
        'BEGIN:STANDARD',
        'TZOFFSETFROM:+0800',
        'TZOFFSETTO:+0800',
        'TZNAME:CST',
        'DTSTART:19700101T000000',
        'END:STANDARD',
        'END:VTIMEZONE',
    ];

    for (const event of events) {
        if (!PERIOD_TIMES[event.startPeriod] || !PERIOD_END_TIMES[event.endPeriod]) continue;

        const firstDate = getFirstOccurrence(semesterStartDate, event.day);
        const dtStart = formatICSDateTime(firstDate, PERIOD_TIMES[event.startPeriod]);
        const dtEnd = formatICSDateTime(firstDate, PERIOD_END_TIMES[event.endPeriod]);
        const uid = `piyou-${event.day}-${event.startPeriod}-${encodeURIComponent(event.name)}@piyou.me`;

        const descParts = [];
        if (event.teacher) descParts.push(`授課教師：${event.teacher}`);
        if (event.name_en) descParts.push(event.name_en);
        const description = descParts.join('\\n');

        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`DTSTART;TZID=Asia/Taipei:${dtStart}`);
        lines.push(`DTEND;TZID=Asia/Taipei:${dtEnd}`);
        lines.push(`RRULE:FREQ=WEEKLY;COUNT=${semesterWeeks}`);
        lines.push(`SUMMARY:${event.name}`);
        if (event.location) lines.push(`LOCATION:${event.location}`);
        if (description) lines.push(`DESCRIPTION:${description}`);
        lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
}

/** 下載 .ics 檔案 */
export function downloadICS(timetable, semesterStartDate, semesterWeeks = 18) {
    const content = generateICS(timetable, semesterStartDate, semesterWeeks);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '披呦課表.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
