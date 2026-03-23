/**
 * 共享平台 Smoke Test / Share Page Smoke Test
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock fetch — Share 頁面直接呼叫 apiFetch / Mock fetch used by apiFetch
const mockFetch = vi.fn();
beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    // 預設：GET /{code} 回傳 404（訂閱碼不存在）
    mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Share code not found' }),
    });
    // 清空 localStorage 的分享清單
    localStorage.removeItem('piyou_shares');
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

import Share from '../pages/Share';

describe('Share Page', () => {
    it('renders page title', () => {
        render(
            <MemoryRouter>
                <Share />
            </MemoryRouter>
        );
        expect(screen.getByText('共享平台')).toBeInTheDocument();
    });

    it('renders subscribe form hint', () => {
        render(
            <MemoryRouter>
                <Share />
            </MemoryRouter>
        );
        expect(screen.getByText(/輸入分享碼，即可訂閱/)).toBeInTheDocument();
    });

    it('renders subscribe input and button', () => {
        render(
            <MemoryRouter>
                <Share />
            </MemoryRouter>
        );
        expect(screen.getByPlaceholderText('輸入分享碼…')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '訂閱' })).toBeInTheDocument();
    });

    it('renders create share button', () => {
        render(
            <MemoryRouter>
                <Share />
            </MemoryRouter>
        );
        expect(screen.getByRole('button', { name: /建立分享/ })).toBeInTheDocument();
    });

    it('shows empty state when no subscriptions', () => {
        render(
            <MemoryRouter>
                <Share />
            </MemoryRouter>
        );
        expect(screen.getByText(/尚無訂閱的分享/)).toBeInTheDocument();
    });

    it('renders subscribed share cards from localStorage', () => {
        localStorage.setItem('piyou_shares', JSON.stringify([
            { code: 'mygroup', title: '小組資料', body: '期末報告連結', deleted: false, is_owner: false },
        ]));
        render(
            <MemoryRouter>
                <Share />
            </MemoryRouter>
        );
        expect(screen.getByText('小組資料')).toBeInTheDocument();
        expect(screen.getByText('#mygroup')).toBeInTheDocument();
    });

    it('shows deleted state for deleted shares', () => {
        localStorage.setItem('piyou_shares', JSON.stringify([
            { code: 'gone', title: '已刪除的分享', deleted: true, is_owner: false },
        ]));
        render(
            <MemoryRouter>
                <Share />
            </MemoryRouter>
        );
        expect(screen.getByText(/擁有者已刪除此分享/)).toBeInTheDocument();
    });
});
