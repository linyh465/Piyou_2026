/**
 * 主應用入口 / Main Application Entry
 * 路由配置與佈局組合 / Route configuration and layout composition.
 * 未登入時顯示登入頁 / Shows login page when not authenticated.
 */
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Timetable from './pages/Timetable';
import Grades from './pages/Grades';
import Tasks from './pages/Tasks';
import AIAssistant from './pages/AIAssistant';
import Settings from './pages/Settings';
import useAuthStore from './stores/authStore';

/**
 * 認證守衛 / Auth Guard
 * 未登入時導向登入頁 / Redirects to login when not authenticated.
 */
function RequireAuth({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  const tryAutoLogin = useAuthStore((s) => s.tryAutoLogin);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    tryAutoLogin();
  }, [tryAutoLogin]);

  return (
    <HashRouter>
      <Routes>
        {/* 登入頁（不含 Layout）/ Login page (no layout shell) */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
        />

        {/* 受保護路由 / Protected routes */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="grades" element={<Grades />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="ai" element={<AIAssistant />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
