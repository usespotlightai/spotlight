import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentChat } from '@/routes/AgentChat';
import { write } from '@/test/lexical';

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

const send = vi.fn();

vi.mock('@/hooks/api/useSendChatMessage', () => ({
  useSendChatMessage: () => ({ mutate: send, isPending: false }),
}));

vi.mock('@/hooks/api/useStopChat', () => ({
  useStopChat: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        models: [{ id: 'opus', name: 'Opus 5' }],
        defaultModel: '',
        efforts: ['low', 'high'],
      },
      {
        id: 'cursor',
        name: 'Cursor',
        models: [],
        defaultModel: '',
        efforts: [],
      },
    ],
  }),
}));

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [] }),
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
      kind: 'message',
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
    it('keeps the shape of the chat rather than calling it gone', () => {
      chat.mockReturnValue(undefined);

      renderChat();

      expect(
        screen.getByRole('status', { name: 'Loading the chat' }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Chat not found/)).not.toBeInTheDocument();
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
      expect(screen.queryByText(/Chat not found/)).not.toBeInTheDocument();
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
      screen.getByText('This team has no chat at that address.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the messages sent to the agent', () => {
    renderChat();

    expect(screen.getByText('Help me plan the retries.')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Say something to the agent' }),
    ).toBeInTheDocument();
  });

  it('shows the traces shared with the agent inside the message of the person, each leading to its trace', () => {
    renderChat();

    const trace = screen.getByRole('link', {
      name: /Drain the stuck retry queues/,
    });
    expect(trace).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/tasks/task_9/trace',
    );
    expect(trace.closest('p')).toHaveTextContent('Help me plan the retries.');
  });

  it('names the station it is improving in the first message, leading to it', () => {
    chat.mockReturnValue(
      planning({
        improving: {
          lineId: 'line_1',
          lineKey: 'delivery',
          lineName: 'Delivery',
          stationId: 'station_spec',
          stationKey: 'spec',
          stationName: 'Spec',
        },
      }),
    );

    renderChat();

    expect(
      screen.getByRole('link', { name: 'Spec on Delivery' }),
    ).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_spec',
    );
  });

  it('names no station where the chat improves none', () => {
    renderChat();

    expect(
      document.querySelector('[data-kind="station"]'),
    ).not.toBeInTheDocument();
  });

  it('says that nobody sent a message yet in a chat without messages', () => {
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

  it('answers with the model and effort picked, but keeps the chat on its harness', async () => {
    send.mockReset();
    renderChat();

    await userEvent.click(screen.getByRole('button', { name: /^Agent/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Harness/ }));
    expect(
      await screen.findByRole('menuitemradio', { name: /Cursor/ }),
    ).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(await screen.findByRole('menuitem', { name: /Model/ }));
    fireEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Opus 5' }),
    );
    fireEvent.click(await screen.findByRole('menuitem', { name: /Effort/ }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'High' }));

    expect(screen.getByRole('button', { name: /^Agent/ })).toHaveTextContent(
      'Claude Code Opus 5 High',
    );

    await write(
      screen.getByRole('textbox', { name: 'Say something to the agent' }),
      'Think harder.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'opus', effort: 'high' }),
      expect.anything(),
    );
  });
});
