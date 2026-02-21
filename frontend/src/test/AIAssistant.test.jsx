/**
 * AI 助理頁面 Smoke Test / AIAssistant Page Smoke Test
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// jsdom 不支援 scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

import AIAssistant from '../pages/AIAssistant';

describe('AIAssistant Page', () => {
  it('renders page title', () => {
    render(
      <MemoryRouter>
        <AIAssistant />
      </MemoryRouter>
    );
    expect(screen.getByText('AI 助理')).toBeInTheDocument();
  });

  it('renders initial greeting message', async () => {
    render(
      <MemoryRouter>
        <AIAssistant />
      </MemoryRouter>
    );
    // 打字機效果需要等待 / Wait for typewriter animation
    expect(await screen.findByText(/我是披呦 AI 助理/, {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders quick suggestion buttons', async () => {
    render(
      <MemoryRouter>
        <AIAssistant />
      </MemoryRouter>
    );
    expect(await screen.findByText('今天有什麼課')).toBeInTheDocument();
    expect(screen.getByText('GPA 多少')).toBeInTheDocument();
    expect(screen.getByText('公車幾分鐘')).toBeInTheDocument();
    expect(screen.getByText('待辦事項')).toBeInTheDocument();
  });

  it('sends a message and receives response', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AIAssistant />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/問我任何問題/);
    await user.type(input, '你好');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/你好！我是披呦 AI 助理/)).toBeInTheDocument();
  });

  it('clicking quick suggestion sends message', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AIAssistant />
      </MemoryRouter>
    );

    await user.click(screen.getByText('今天有什麼課'));
    // Should respond with either "今天沒有課" or "今天有 N 堂課"
    expect(await screen.findByText(/今天/)).toBeInTheDocument();
  });

  it('shows help text on help command', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AIAssistant />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/問我任何問題/);
    await user.type(input, '幫助');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/我可以幫你/)).toBeInTheDocument();
  });

  it('shows fallback for unknown input', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AIAssistant />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/問我任何問題/);
    await user.type(input, '量子力學');
    await user.keyboard('{Enter}');

    expect(await screen.findByText(/我不太理解/)).toBeInTheDocument();
  });
});
