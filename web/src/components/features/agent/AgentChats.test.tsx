import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentChats } from '@/components/features/agent/AgentChats';
import { TabPane } from '@/components/shell/tabs/TabPane';
import { useAppTabs } from '@/hooks/useAppTabs';
import type { ChatSummary } from '@/lib/chat';

const chats = vi.fn<(...args: unknown[]) => unknown>();
const failing = vi.fn();
const refetch = vi.fn();
const older = vi.fn<(...args: unknown[]) => unknown>();
const load = vi.fn();

vi.mock('@/hooks/api/useChats', () => ({
  useChats: () => ({
    data: chats(),
    isPending: chats() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
    more: { available: older(), loading: false, load },
  }),
}));

vi.mock('@/components/features/agent/NewChatComposer', () => ({
  NewChatComposer: ({
    defaultPrompt,
    defaultRepositories,
  }: {
    defaultPrompt: string | null;
    defaultRepositories: string[];
  }) => (
    <>
      <p>Plan with the agent</p>
      {defaultPrompt && <p>{defaultPrompt}</p>}
      {defaultRepositories.length > 0 && (
        <p>{defaultRepositories.join(', ')}</p>
      )}
    </>
  ),
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
  waitingForYou: false,
  targetStation: null,
  setup: null,
};

const showing = () =>
  render(
    <MemoryRouter>
      <AgentChats slug="acme" teamId="team_1" />
    </MemoryRouter>,
  );

function InTab() {
  const tabs = useAppTabs('acme', []);
  const tab = tabs.tabs.find((each) => each.id === tabs.activeId);

  return (
    tab && (
      <TabPane
        tab={tab}
        pages={
          <Route
            path="team/:teamId/agent"
            element={<AgentChats slug="acme" teamId="team_1" />}
          />
        }
        focused
        onFocus={() => {}}
        onVisit={tabs.visit}
        onReports={tabs.reportsFor(tab.id)}
      />
    )
  );
}

beforeEach(() => {
  localStorage.clear();
  chats.mockReturnValue([chat]);
  failing.mockReturnValue(false);
  older.mockReturnValue(false);
  load.mockClear();
  refetch.mockClear();
});

describe('AgentChats', () => {
  it('marks a chat that waits for you, and one that is in progress', () => {
    chats.mockReturnValue([
      { ...chat, id: 'chat_1', waitingForYou: true },
      { ...chat, id: 'chat_2', title: 'Second', progress: 'in-progress' },
      { ...chat, id: 'chat_3', title: 'Third' },
    ]);
    showing();

    expect(screen.getAllByText('Waiting for you')).toHaveLength(1);
    expect(screen.getAllByText('In progress')).toHaveLength(1);
  });

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

  it('starts the composer with what the tab was opened with', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/w/acme/team/team_1/agent',
            state: {
              prompt: 'Set up our configuration as code.',
              repositories: ['acme/api', 'acme/web'],
            },
          },
        ]}
      >
        <InTab />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Set up our configuration as code.'),
    ).toBeInTheDocument();
    expect(screen.getByText('acme/api, acme/web')).toBeInTheDocument();
  });
});
