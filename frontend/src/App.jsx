/**
 * 主應用入口 / Main Application Entry
 * 路由配置與佈局組合 / Route configuration and layout composition.
 * 登入/同步功能已移至系統設定 / Login/sync moved to Settings page.
 */
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Timetable from './pages/Timetable';
import Grades from './pages/Grades';
import Tasks from './pages/Tasks';
import AIAssistant from './pages/AIAssistant';
import Settings from './pages/Settings';
import Transport from './pages/Transport';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* 主要路由 / Main routes — 同步功能在設定頁 */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="grades" element={<Grades />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="transport" element={<Transport />} />
          <Route path="ai" element={<AIAssistant />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* 未知路由導回首頁 / Unknown routes redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
