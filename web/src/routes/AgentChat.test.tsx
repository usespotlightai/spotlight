import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentChat } from '@/routes/AgentChat';

const chat = vi.fn();
const chatError = vi.fn();
const refetch = vi.fn();
const journal = vi.fn();

vi.mock('@/hooks/api/useChats', () => ({
  chatKeys: {
    one: () => ['chat'],
    journal: () => ['chat-journal'],
  },
}));

vi.mock('@/hooks/api/useChat', () => ({
  useChat: () => ({
    data: chat(),
    error: chatError(),
    isPending: chat() === undefined,
    errorUpdateCount: chatError() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

vi.mock('@/hooks/api/useChatJournal', () => ({
  useChatJournal: () => ({
    data: journal(),
    isPending: journal() === undefined,
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
  }),
}));

vi.mock('@/hooks/api/useRunStream', () => ({ useRunStream: () => undefined }));

vi.mock('@/hooks/api/useSayInChat', () => ({
  useSayInChat: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/api/useStopChat', () => ({
  useStopChat: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({ data: [] }),
}));

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [] }),
}));

vi.mock('@/hooks/api/useUploadAttachment', () => ({
  useUploadAttachment: () => ({ mutateAsync: vi.fn() }),
}));

const planning = (over: Record<string, unknown> = {}) => ({
  id: 'chat_1',
  title: 'Plan the retries',
  harness: 'claude-code',
  model: null,
  effort: null,
  repositories: [],
  createdAt: '2026-08-29T09:00:00.000Z',
  updatedAt: '2026-08-29T09:00:00.000Z',
  working: false,
  runId: null,
  messages: [
    {
      position: 0,
      kind: 'said',
      body: 'Help me plan the retries.',
      at: '2026-08-29T09:00:00.000Z',
      author: { id: 'user_1', name: 'Leon', image: null },
      runId: null,
      attachments: [],
      traces: [{ taskId: 'task_9', title: 'Drain the stuck retry queues' }],
      proposal: null,
    },
  ],
  ...over,
});

const renderChat = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/w/acme/team/team_1/agent/chat_1']}>
        <Routes>
          <Route
            path="/w/:slug/team/:teamId/agent/:chatId"
            element={<AgentChat />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('AgentChat', () => {
  beforeEach(() => {
    chat.mockReturnValue(planning());
    chatError.mockReturnValue(null);
    refetch.mockReset();
    journal.mockReturnValue([]);
  });

  describe('while it loads', () => {
    it('holds the shape of the chat rather than calling it gone', () => {
      chat.mockReturnValue(undefined);

      renderChat();

      expect(
        screen.getByRole('status', { name: 'Loading the chat' }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/no such chat/)).not.toBeInTheDocument();
    });

    it('waits for the work too, so it does not open up beneath the reader', () => {
      journal.mockReturnValue(undefined);

      renderChat();

      expect(
        screen.getByRole('status', { name: 'Loading the chat' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Help me plan the retries.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('when it could not be loaded', () => {
    beforeEach(() => {
      chat.mockReturnValue(undefined);
      chatError.mockReturnValue({ statusCode: 500 });
    });

    it('says so beneath a bar of its own, rather than calling the chat gone', () => {
      const { container } = renderChat();

      expect(container.querySelector('header')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The chat could not be loaded.',
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByText(/no such chat/)).not.toBeInTheDocument();
    });

    it('tries again when asked', async () => {
      renderChat();

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(refetch).toHaveBeenCalledTimes(1);
    });
  });

  it('says there is no such chat where the team has none by that id', () => {
    chat.mockReturnValue(undefined);
    chatError.mockReturnValue({ statusCode: 404, message: 'Not Found' });

    const { container } = renderChat();

    expect(container.querySelector('header')).toBeInTheDocument();
    expect(
      screen.getByText('There is no such chat for this team.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows what was said to the agent', () => {
    renderChat();

    expect(screen.getByText('Help me plan the retries.')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Say something to the agent' }),
    ).toBeInTheDocument();
  });

  it('shows the traces shared with the agent, each leading to its trace', () => {
    renderChat();

    expect(
      screen.getByRole('link', { name: /Drain the stuck retry queues/ }),
    ).toHaveAttribute('href', '/w/acme/team/team_1/observability/tasks/task_9');
  });

  it('says nothing has been said yet in a chat without a word in it', () => {
    chat.mockReturnValue(planning({ messages: [] }));

    renderChat();

    expect(screen.getByText('Nothing said yet')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Say something to the agent' }),
    ).toBeInTheDocument();
  });

  it('says nothing of the kind while the agent is working', () => {
    chat.mockReturnValue(planning({ messages: [], working: true }));

    renderChat();

    expect(screen.queryByText('Nothing said yet')).not.toBeInTheDocument();
  });
});
