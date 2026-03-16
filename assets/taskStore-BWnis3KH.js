import c from"./localDb-C4xuZCHi.js";import{c as u,w as d}from"./index-BvyNBGbR.js";function f(e){const r=new Date().toLocaleString("zh-TW",{timeZone:"Asia/Taipei"});let a=`# 📋 披呦任務清單 / Piyou Task List

`;a+=`> 匯出時間 / Exported at: ${r}

`;const t={};e.forEach(n=>{const l=n.category||"一般 / General";t[l]||(t[l]=[]),t[l].push(n)}),Object.entries(t).forEach(([n,l])=>{a+=`## ${n}

`,l.forEach(i=>{const k=i.completed?"[x]":"[ ]",y="⭐".repeat(Math.min(i.priority||0,3)),p=i.due_date?` 📅 ${i.due_date}`:"";a+=`- ${k} **${i.title}**${y}${p}
`,i.description&&(a+=`  > ${i.description}
`),a+=`
`})});const o=e.length,s=e.filter(n=>n.completed).length;return a+=`---

`,a+=`📊 **進度 / Progress:** ${s}/${o} (${o?Math.round(s/o*100):0}%)
`,a}function T(e,r="piyou_tasks.md"){const a=f(e),t=new Blob([a],{type:"text/markdown;charset=utf-8"}),o=URL.createObjectURL(t),s=document.createElement("a");s.href=o,s.download=r,s.click(),URL.revokeObjectURL(o)}const w=u((e,r)=>({tasks:[],isLoading:!1,isSyncing:!1,syncError:null,filter:"all",categoryFilter:"all",loadTasks:async()=>{e({isLoading:!0});try{const a=await c.getAllTasks();e({tasks:a,isLoading:!1})}catch{e({isLoading:!1})}},addTask:async a=>{await c.createTask(a),await r().loadTasks()},updateTask:async(a,t)=>{await c.updateTask(a,t),await r().loadTasks()},deleteTask:async a=>{await c.deleteTask(a),await r().loadTasks()},toggleTask:async a=>{const{tasks:t}=r(),o=t.map(s=>s.id===a?{...s,completed:!s.completed}:s);e({tasks:o});try{await c.toggleTask(a)}catch{e({tasks:t})}},exportToMarkdown:()=>{const{tasks:a}=r();T(a)},getFilteredTasks:()=>{const{tasks:a,filter:t,categoryFilter:o}=r();let s=a;return t==="active"&&(s=s.filter(n=>!n.completed)),t==="completed"&&(s=s.filter(n=>n.completed)),o!=="all"&&(s=s.filter(n=>n.category===o)),s},setFilter:a=>e({filter:a}),setCategoryFilter:a=>e({categoryFilter:a}),syncTasksToServer:async()=>{if(sessionStorage.getItem("piyou_token")){e({isSyncing:!0,syncError:null});try{const t=c.exportAllTasks();await d.put("/data/tasks",{tasks:t},{timeout:15e3}),e({isSyncing:!1})}catch(t){e({isSyncing:!1,syncError:t.response?.data?.detail||"任務上傳失敗 / Task upload failed"})}}},syncTasksFromServer:async()=>{if(sessionStorage.getItem("piyou_token")){e({isSyncing:!0,syncError:null});try{const o=(await d.get("/data/tasks",{timeout:15e3})).data.tasks||[];c.replaceAllTasks(o),await r().loadTasks(),e({isSyncing:!1})}catch(t){if(t.response?.status===404){e({isSyncing:!1,syncError:null});return}e({isSyncing:!1,syncError:t.response?.data?.detail||"任務下載失敗 / Task download failed"})}}}}));export{w as u};
