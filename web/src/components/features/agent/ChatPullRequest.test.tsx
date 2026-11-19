import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatPullRequest } from '@/components/features/agent/ChatPullRequest';
import type { ChatPullRequest as PullRequest } from '@/lib/chat';

const resumed = vi.fn();

vi.mock('@/hooks/api/useHold', () => ({
  useResumeLine: () => ({ mutate: resumed, isPending: false }),
}));

const HELD: PullRequest = {
  taskId: 'task_1',
  url: 'https://github.com/acme/web/pull/7',
  state: 'held',
  lineName: 'Default',
  stationName: 'Code review',
  stationColor: '#edc12b',
  stationPosition: 3,
  stationCount: 5,
};

const showing = (pullRequest: PullRequest) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ChatPullRequest
          slug="acme"
          teamId="team_1"
          chatId="chat_1"
          title="Show video icons"
          pullRequest={pullRequest}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('ChatPullRequest', () => {
  beforeEach(() => {
    resumed.mockReset();
  });

  it('links the pull request and its task, and says the task waits for this chat', () => {
    showing(HELD);

    expect(screen.getByText('On hold for this chat')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Show video icons/ }),
    ).toHaveAttribute('href', HELD.url);
    expect(screen.getByRole('link', { name: 'Open task' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/tasks/task_1',
    );
    expect(screen.getByText('Default › Code review')).toBeInTheDocument();
  });

  it('hands the task to the line, so the station agent goes on', async () => {
    showing(HELD);

    await userEvent.click(
      screen.getByRole('button', { name: 'Hand to the line' }),
    );

    expect(resumed).toHaveBeenCalledWith(
      {
        teamId: 'team_1',
        taskId: 'task_1',
        next: 'continue',
      },
      expect.anything(),
    );
  });

  it('offers no hand-over once the line has the task', () => {
    showing({ ...HELD, state: 'line' });

    expect(screen.getByText('Handed to the line')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Hand to the line' }),
    ).not.toBeInTheDocument();
  });

  it('links no task that was deleted', () => {
    showing({ ...HELD, state: 'gone' });

    expect(screen.getByText('Task deleted')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Open task' }),
    ).not.toBeInTheDocument();
  });
});
