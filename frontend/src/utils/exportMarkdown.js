/**
 * Markdown 匯出工具 / Markdown Export Utility
 * 將任務清單匯出為 Markdown 格式檔案
 * Exports task list to a downloadable Markdown file.
 */

/**
 * 將任務陣列轉換為 Markdown 字串 / Convert task array to Markdown string
 * @param {Array} tasks - 任務陣列 / Array of task objects
 * @returns {string} Markdown 格式的任務清單 / Markdown formatted task list
 */
export function tasksToMarkdown(tasks) {
    const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

    let md = `# 📋 披呦任務清單 / Piyou Task List\n\n`;
    md += `> 匯出時間 / Exported at: ${now}\n\n`;

    // 按類別分組 / Group by category
    const grouped = {};
    tasks.forEach((task) => {
        const cat = task.category || '一般 / General';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(task);
    });

    Object.entries(grouped).forEach(([category, categoryTasks]) => {
        md += `## ${category}\n\n`;

        categoryTasks.forEach((task) => {
            const checkbox = task.completed ? '[x]' : '[ ]';
            const priority = '⭐'.repeat(Math.min(task.priority || 0, 3));
            const due = task.due_date ? ` 📅 ${task.due_date}` : '';

            md += `- ${checkbox} **${task.title}**${priority}${due}\n`;
            if (task.description) {
                md += `  > ${task.description}\n`;
            }
            md += `\n`;
        });
    });

    // 統計 / Statistics
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed).length;
    md += `---\n\n`;
    md += `📊 **進度 / Progress:** ${done}/${total} (${total ? Math.round((done / total) * 100) : 0}%)\n`;

    return md;
}

/**
 * 觸發 Markdown 檔案下載 / Trigger Markdown file download
 */
export function downloadMarkdown(tasks, filename = 'piyou_tasks.md') {
    const md = tasksToMarkdown(tasks);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
