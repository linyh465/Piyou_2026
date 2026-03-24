/**
 * 主應用入口 / Main Application Entry
 * 路由配置與佈局組合 / Route configuration and layout composition.
 * 登入/同步功能已移至系統設定 / Login/sync moved to Settings page.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import SyncToast from './components/SyncToast';
import useAuthStore from './stores/authStore';
import { trackEvent } from './services/analytics';
import apiClient from './services/apiClient';
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

// ── 維護頁面 / Maintenance Screen ──
function MaintenanceScreen({ message }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '32px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔧</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>系統維護中</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>System Maintenance</p>
      {message && (
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', maxWidth: '360px', lineHeight: 1.6 }}>{message}</p>
      )}
      {!message && (
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', maxWidth: '360px', lineHeight: 1.6 }}>
          系統目前正在進行維護，請稍後再試。<br />The system is temporarily unavailable. Please try again later.
        </p>
      )}
    </div>
  );
}

export default function App() {
  const [maintenance, setMaintenance] = useState(null); // null = loading, false = ok, {message} = in maintenance

  useEffect(() => {
    useAuthStore.getState().tryAutoLogin();
    // 檢查維護模式 / Check maintenance mode
    apiClient.get('/notify/config').then((res) => {
      const data = res.data || {};
      if (data.maintenance_mode === 'true') {
        setMaintenance({ message: data.maintenance_message || '' });
      } else {
        setMaintenance(false);
      }
    }).catch(() => {
      setMaintenance(false); // 無法取得設定時正常顯示
    });
  }, []);

  // 等待維護狀態確認（避免閃爍）/ Wait for maintenance check before rendering
  if (maintenance === null) return <PageLoader />;
  // /admin 路由永遠繞過維護模式，讓管理員可以登入後台關閉維護
  const isAdminRoute = window.location.hash.startsWith('#/admin');
  if (maintenance !== false && !isAdminRoute) return <MaintenanceScreen message={maintenance.message} />;

  return (
    <HashRouter>
      <PageViewTracker />
      <SyncToast />
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
