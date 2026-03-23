/**
 * 主應用入口 / Main Application Entry
 * 路由配置與佈局組合 / Route configuration and layout composition.
 * 登入/同步功能已移至系統設定 / Login/sync moved to Settings page.
 */
import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import useAuthStore from './stores/authStore';
import { trackEvent } from './services/analytics';
// 提早載入主題，確保初始即套用系統/使用者偏好 / Eagerly load theme store so theme is applied on first render
import './stores/themeStore';

// ── Lazy-loaded 頁面 / Lazy-loaded pages ──
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Timetable = lazy(() => import('./pages/Timetable'));
const Grades = lazy(() => import('./pages/Grades'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Transport = lazy(() => import('./pages/Transport'));
const Library = lazy(() => import('./pages/Library'));
const Settings = lazy(() => import('./pages/Settings'));
const Share = lazy(() => import('./pages/Share'));
const Admin = lazy(() => import('./pages/Admin'));

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

// 頁面瀏覽追蹤元件（掛在 HashRouter 內才能使用 useLocation）
// Page view tracker (must be inside HashRouter to use useLocation)
function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    trackEvent('page_view', {}, location.pathname);
  }, [location.pathname]);
  return null;
}

export default function App() {
  useEffect(() => {
    useAuthStore.getState().tryAutoLogin();
  }, []);

  return (
    <HashRouter>
      <PageViewTracker />
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
              <Route path="library" element={<Library />} />
              <Route path="settings" element={<Settings />} />
              <Route path="share" element={<Share />} />
            </Route>

            {/* 管理員頁面（獨立，不套 Layout）/ Admin page (standalone, no Layout) */}
            <Route path="/admin" element={<Admin />} />

            {/* 未知路由導回首頁 / Unknown routes redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  );
}
