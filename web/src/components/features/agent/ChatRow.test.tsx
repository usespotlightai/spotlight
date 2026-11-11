import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ChatRow } from '@/components/features/agent/ChatRow';
import type { ChatSummary } from '@/lib/chat';

const chat: ChatSummary = {
  id: 'chat_1',
  title: 'Rate limiting for the public API',
  harness: 'claude-code',
  model: null,
  effort: null,
  repositories: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  progress: null,
  waitingForYou: false,
  targetStation: null,
  setup: null,
};

const showing = (over: Partial<ChatSummary>) =>
  render(
    <MemoryRouter>
      <ul>
        <ChatRow chat={{ ...chat, ...over }} to="/chat_1" />
      </ul>
    </MemoryRouter>,
  );

describe('ChatRow', () => {
  it('shows "Waiting for you" when the chat waits for you', () => {
    showing({ waitingForYou: true });

    expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('shows "In progress" while a run works and nothing waits', () => {
    showing({ progress: 'in-progress' });

    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.queryByText('Waiting for you')).not.toBeInTheDocument();
  });

  it('shows only "Waiting for you" when a run works on a chat that waits', () => {
    showing({ waitingForYou: true, progress: 'in-progress' });

    expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('shows "Queued" when a message has no run yet and nothing waits', () => {
    showing({ progress: 'queued' });

    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.queryByText('Waiting for you')).not.toBeInTheDocument();
  });

  it('shows no pill for a chat that is neither', () => {
    showing({});

    expect(screen.queryByText('Waiting for you')).not.toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });
});
