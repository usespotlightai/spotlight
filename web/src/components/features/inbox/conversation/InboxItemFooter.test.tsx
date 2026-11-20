import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InboxItemFooter } from '@/components/features/inbox/conversation/InboxItemFooter';
import type { InboxItem } from '@/lib/inbox';

const taskStation = {
  station: { id: 'station_build', name: 'Build' },
  task: { id: 'task_1', runNotStarted: null } as {
    id: string;
    runNotStarted: { harness: string } | null;
  },
};
const startRun = vi.fn();

vi.mock('@/hooks/api/useTaskStation', () => ({
  useTaskStation: () => taskStation,
}));

vi.mock('@/hooks/api/useStartTaskRun', () => ({
  useStartTaskRun: () => ({
    mutate: startRun,
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({ data: [{ id: 'codex', name: 'Codex' }] }),
}));

vi.mock('@/components/features/inbox/conversation/InboxComposer', () => ({
  InboxComposer: ({ station }: { station: string }) => <p>Answer {station}</p>,
}));

const ITEM = {
  id: 'task_1:0',
  taskId: 'task_1',
  teamId: 'team_1',
  station: 'Build',
  resolved: false,
  standing: 'assignee',
  runId: null,
} as InboxItem;

const showing = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <InboxItemFooter slug="acme" item={ITEM} progress={null} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('InboxItemFooter', () => {
  beforeEach(() => {
    startRun.mockReset();
    taskStation.task = { id: 'task_1', runNotStarted: null };
  });

  it('shows only the text bar while the run of the station can start', () => {
    showing();

    expect(screen.getByText('Answer Build')).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'The run did not start' }),
    ).not.toBeInTheDocument();
  });

  it('says why the run did not start, above the text bar, and tries again', async () => {
    taskStation.task = { id: 'task_1', runNotStarted: { harness: 'codex' } };
    showing();

    expect(
      screen.getByRole('status', { name: 'The run did not start' }),
    ).toHaveTextContent(
      'Spotlight cannot start Codex at Build. Change the station’s agent, then try again.',
    );
    expect(screen.getByText('Answer Build')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(startRun).toHaveBeenCalledWith({
      teamId: 'team_1',
      taskId: 'task_1',
    });
  });
});
