import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentChats } from '@/components/features/agent/AgentChats';
import type { ChatSummary } from '@/lib/chat';

const chats = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useChats', () => ({
  useChats: () => ({
    data: chats(),
    isPending: chats() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

vi.mock('@/components/features/agent/NewChatComposer', () => ({
  NewChatComposer: () => <p>Plan with the agent</p>,
}));

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
  targetStation: null,
  setup: null,
};

const showing = () =>
  render(
    <MemoryRouter>
      <AgentChats slug="acme" teamId="team_1" />
    </MemoryRouter>,
  );

beforeEach(() => {
  chats.mockReturnValue([chat]);
  failing.mockReturnValue(false);
  refetch.mockClear();
});

describe('AgentChats', () => {
  it('lists the team’s chats, each leading to its conversation', () => {
    showing();

    expect(
      screen.getByRole('link', { name: 'Rate limiting for the public API' }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/agent/chat_1');
  });

  it('keeps the shape of a chat while they load, keeping the composer', () => {
    chats.mockReturnValue(undefined);
    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the chats' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Plan with the agent')).toBeInTheDocument();
    expect(screen.queryByText('No chats yet')).not.toBeInTheDocument();
  });

  it('says the chats could not be loaded, and tries again on request', async () => {
    chats.mockReturnValue(undefined);
    failing.mockReturnValue(true);
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Chats could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Plan with the agent')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the chats it has when a later refresh fails', () => {
    failing.mockReturnValue(true);
    showing();

    expect(
      screen.getByText('Rate limiting for the public API'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a chat whose run waits for a runner as queued, the same as on the board', () => {
    chats.mockReturnValue([{ ...chat, progress: 'queued' }]);

    showing();

    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('says there are no chats yet and leaves the composer to start one', () => {
    chats.mockReturnValue([]);
    showing();

    expect(screen.getByText('No chats yet')).toBeInTheDocument();
    expect(screen.getByText('Plan with the agent')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
