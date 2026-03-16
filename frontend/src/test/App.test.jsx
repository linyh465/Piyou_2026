/**
 * App.jsx 路由渲染測試 / App.jsx Route Rendering Tests
 * 驗證主要頁面是否正確渲染。
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders the layout without crashing', async () => {
    render(<App />);
    // Lazy-loaded — 等待 Layout 渲染完成
    const homeLinks = await screen.findAllByText('首頁');
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the dashboard route by default', async () => {
    render(<App />);
    // Dashboard 的標題「今天」
    const title = await screen.findByText('今天');
    expect(title).toBeInTheDocument();
  });
});
