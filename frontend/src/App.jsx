/**
 * 主應用入口 / Main Application Entry
 * 路由配置與佈局組合 / Route configuration and layout composition.
 * 登入/同步功能已移至系統設定 / Login/sync moved to Settings page.
 */
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

// ── Lazy-loaded 頁面 / Lazy-loaded pages ──
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Timetable = lazy(() => import('./pages/Timetable'));
const Grades = lazy(() => import('./pages/Grades'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Transport = lazy(() => import('./pages/Transport'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const Settings = lazy(() => import('./pages/Settings'));

// ── 載入中佔位 / Loading fallback ──
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '60vh', color: 'var(--text-muted, #999)',
      fontSize: '0.875rem',
    }}>
      載入中…
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  );
}
