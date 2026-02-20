/**
 * 主應用入口 / Main Application Entry
 * 路由配置與佈局組合
 * Route configuration and layout composition.
 */
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Timetable from './pages/Timetable';
import Grades from './pages/Grades';
import Tasks from './pages/Tasks';
import AIAssistant from './pages/AIAssistant';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="grades" element={<Grades />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="ai" element={<AIAssistant />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
