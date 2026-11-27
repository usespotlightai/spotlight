import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InboxItemFooter } from '@/components/features/inbox/conversation/InboxItemFooter';
import type { InboxItem } from '@/lib/inbox';
import { partial } from '@/test/partial';

const taskStation = {
  station: { id: 'station_build', name: 'Build' },
  task: { id: 'task_1', runNotStarted: null } as {
    id: string;
    runNotStarted: { harness: string } | null;
  },
};
const startRun = vi.fn();
const stop = vi.fn();

vi.mock('@/hooks/api/useStopRun', () => ({
  useStopRun: () => ({ mutate: stop }),
  useStopInFlight: () => false,
}));

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

const ITEM = partial<InboxItem>({
  id: 'task_1:0',
  taskId: 'task_1',
  teamId: 'team_1',
  station: 'Build',
  resolved: false,
  standing: 'assignee',
  answerable: true,
  runId: null,
});

const showing = (
  item: InboxItem = ITEM,
  progress: 'in-progress' | null = null,
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <InboxItemFooter slug="acme" item={item} progress={progress} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('InboxItemFooter', () => {
  beforeEach(() => {
    startRun.mockReset();
    taskStation.task = { id: 'task_1', runNotStarted: null };
  });

  it('offers a follower Stop beside the closed text bar while the run works, as the server lets them stop it', async () => {
    stop.mockReset();
    showing(
      {
        ...ITEM,
        kind: 'task',
        standing: 'following',
        answerable: false,
        runId: 'run_1',
        stoppableByYou: true,
      },
      'in-progress',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(stop).toHaveBeenCalledWith({ teamId: 'team_1', runId: 'run_1' });
  });

  it('offers a follower no Stop where the server does not let them stop the run', () => {
    showing(
      {
        ...ITEM,
        kind: 'task',
        standing: 'following',
        answerable: false,
        runId: 'run_1',
        stoppableByYou: false,
      },
      'in-progress',
    );

    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
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
