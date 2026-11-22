import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { TaskState } from '@/components/features/board/task/TaskState';
import { RunRow } from '@/components/features/runs/RunRow';
import { WorkspaceContextMenu } from '@/components/shell/context-menu/WorkspaceContextMenu';
import type { Run } from '@/lib/run';
import type { Task } from '@/lib/task';
import { progressOfState } from '@/mocks/world/run-progress';

const stop = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/api/useStopRun', () => ({
  useStopRun: () => ({ mutate: stop }),
  useStopInFlight: () => false,
}));

const run = (
  state: Run['state'],
  review: Run['review'] = null,
  waitingForYou = state === 'suspended' || review?.state === 'pending',
) =>
  ({
    id: 'run_1',
    state,
    progress: progressOfState(state),
    exitCode: null,
    startedAt: new Date().toISOString(),
    station: null,
    review,
    waitingForYou,
    stoppableByYou: true,
  }) as unknown as Run;

const PENDING = { state: 'pending', conversationId: 'task_1:3' } as const;

const shown = (ui: React.ReactNode) => {
  const { container } = render(<MemoryRouter>{ui}</MemoryRouter>);

  return container;
};

describe('RunRow, what a run is doing', () => {
  it('shows the same pill that a task in progress shows on the board', () => {
    const inRuns = shown(<RunRow run={run('claimed')} to="/runs/run_1" />);
    const onBoard = shown(
      <TaskState
        task={
          { progress: 'in-progress', awaitingReview: false } as unknown as Task
        }
      />,
    );

    const pill = (container: HTMLElement) =>
      screen
        .getAllByText('In progress')
        .find((each) => container.contains(each))?.outerHTML;

    expect(pill(inRuns)).toBeDefined();
    expect(pill(inRuns)).toEqual(pill(onBoard));
  });

  it('shows the same queued pill that a queued task shows on the board', () => {
    const inRuns = shown(<RunRow run={run('queued')} to="/runs/run_1" />);
    const onBoard = shown(
      <TaskState
        task={
          {
            progress: 'queued',
            awaitingReview: false,
          } as unknown as Task
        }
      />,
    );

    const pill = (container: HTMLElement) =>
      screen.getAllByText('Queued').find((each) => container.contains(each))
        ?.outerHTML;

    expect(pill(inRuns)).toBeDefined();
    expect(pill(inRuns)).toEqual(pill(onBoard));
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
  });

  it('says nothing of a run that has ended', () => {
    shown(<RunRow run={run('completed')} to="/runs/run_1" />);

    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Queued')).not.toBeInTheDocument();
  });

  it('says a run that asked a person is waiting for you, neither in progress nor queued', () => {
    shown(<RunRow run={run('suspended')} to="/runs/run_1" />);

    expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Queued')).not.toBeInTheDocument();
  });

  it.each([
    ['cancelled', 'Cancelled', 'lucide-circle-slash'],
    ['superseded', 'Superseded', 'lucide-circle-arrow-right'],
  ] as const)(
    'shows a %s run in the same pill as waiting for you, with its own icon',
    (state, label, icon) => {
      const inRuns = shown(<RunRow run={run(state)} to="/runs/run_1" />);
      const waiting = shown(<RunRow run={run('suspended')} to="/runs/run_1" />);

      const pill = within(inRuns).getByText(label);

      expect(pill.className).toEqual(
        within(waiting).getByText('Waiting for you').className,
      );
      expect(pill.querySelector(`svg.${icon}`)).not.toBeNull();
    },
  );

  it('leads from waiting for you to where the person answers', () => {
    shown(
      <RunRow
        run={run('suspended', PENDING)}
        to="/runs/run_1"
        reviewTo="/inbox/task_1:3"
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Waiting for you' }),
    ).toHaveAttribute('href', '/inbox/task_1:3');
  });

  it('says nothing is waiting for you while the answer is someone else’s to give', () => {
    shown(
      <RunRow
        run={run('suspended', PENDING, false)}
        to="/runs/run_1"
        reviewTo="/inbox/task_1:3"
      />,
    );

    expect(screen.queryByText('Waiting for you')).not.toBeInTheDocument();
  });

  it('says waiting for you for a run that is over and still waits for an answer', () => {
    shown(
      <RunRow
        run={run('completed', PENDING)}
        to="/runs/run_1"
        reviewTo="/inbox/task_1:3"
      />,
    );

    expect(
      screen.getByRole('link', { name: 'Waiting for you' }),
    ).toHaveAttribute('href', '/inbox/task_1:3');
  });
});

describe('RunRow, its menu', () => {
  const rightClick = (state: Run['state']) => {
    render(
      <MemoryRouter>
        <WorkspaceContextMenu slug="acme" onOpenTab={() => {}}>
          <ul>
            <RunRow
              run={run(state)}
              teamId="team_1"
              to="/w/acme/team/team_1/runs/run_1"
            />
          </ul>
        </WorkspaceContextMenu>
      </MemoryRouter>,
    );
    fireEvent.contextMenu(screen.getByRole('link'), {
      clientX: 10,
      clientY: 10,
    });
  };

  it('stops a run in progress', async () => {
    const user = userEvent.setup();
    stop.mockClear();
    rightClick('claimed');

    await user.click(await screen.findByRole('menuitem', { name: 'Stop run' }));

    expect(stop).toHaveBeenCalledExactlyOnceWith({
      teamId: 'team_1',
      runId: 'run_1',
    });
  });

  it.each(['queued', 'suspended', 'completed'] as const)(
    'offers no stop for a %s run',
    async (state) => {
      rightClick(state);

      expect(
        (await screen.findAllByRole('menuitem')).map(
          (item) => item.textContent,
        ),
      ).toEqual(['Copy link', 'Open in']);
    },
  );
});

describe('RunRow, a turn a person drove', () => {
  it('marks the run as a turn', () => {
    shown(
      <RunRow
        run={{ ...run('completed'), driver: 'person' }}
        to="/runs/run_1"
      />,
    );

    expect(screen.getByText('Turn')).toBeInTheDocument();
  });

  it('marks no run the line drove as a turn', () => {
    shown(
      <RunRow run={{ ...run('completed'), driver: 'line' }} to="/runs/run_1" />,
    );

    expect(screen.queryByText('Turn')).toBeNull();
  });
});
