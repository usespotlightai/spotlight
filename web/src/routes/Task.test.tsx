import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandsProvider } from '@/components/shell/command/CommandsProvider';
import { Task } from '@/routes/Task';

const task = {
  id: 'task_1',
  stationId: 'station_1',
  revision: 2,
  title: 'Fix the queue',
  description: '## Steps\n\nReproduce, then fix.',
  attachments: [],
  createdAt: '2026-08-04T09:15:00.000Z',
  pullRequests: [],
};

const worked = vi.fn((): unknown[] => []);
const journalled = vi.fn((): unknown[] => []);
const moved = vi.fn();
const deleted = vi.fn();
const tookOver = vi.fn();
const gaveBack = vi.fn();
const listed = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();
const LEON = { id: 'user_1', name: 'Leon', image: null };
const members = vi.fn((): unknown[] => [LEON]);
const stacked = vi.fn((): unknown => ({ latest: null }));

vi.mock('@/hooks/api/useStopRun', () => ({
  useStopRun: () => ({ mutate: () => {} }),
  useStopInFlight: () => false,
}));

vi.mock('@/hooks/api/useTasks', () => ({
  useTask: (_teamId: string, taskId: string) => ({
    data: (listed() as { id: string }[] | undefined)?.find(
      (each) => each.id === taskId,
    ),
    isPending: listed() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));
vi.mock('@/hooks/api/useEditorConnection', () => ({
  useEditorConnection: () => ({ data: undefined }),
}));
vi.mock('@/hooks/api/useMoveTask', () => ({
  useMoveTask: () => ({ mutate: moved }),
}));
vi.mock('@/hooks/api/useDeleteTask', () => ({
  useDeleteTask: () => ({ mutate: deleted }),
}));
vi.mock('@/hooks/api/useTakeover', () => ({
  useTakeOverTask: () => ({ mutate: tookOver, isPending: false }),
  useHandBackTask: () => ({ mutate: gaveBack, isPending: false }),
}));
vi.mock('@/hooks/useMe', () => ({
  useMe: () => ({ id: 'user_1', name: 'Leon', image: null }),
}));
vi.mock('@/hooks/api/useMembers', () => ({
  useMembers: () => ({ data: members() }),
}));
vi.mock('@/hooks/api/useAssignTask', () => ({
  useAssignTask: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [] }),
}));
vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: [
      {
        id: 'line_1',
        name: 'Default',
        stations: [
          { id: 'station_0', name: 'Backlog', position: 0, kind: 'backlog' },
          {
            id: 'station_1',
            name: 'Triage',
            position: 1,
            kind: 'work',
            harness: 'claude-code',
            passesTo: ['station_2'],
          },
          {
            id: 'station_2',
            name: 'Spec',
            position: 2,
            kind: 'work',
            harness: 'claude-code',
            passesTo: [],
          },
          {
            id: 'station_3',
            name: 'Completed',
            position: 3,
            kind: 'completed',
          },
        ],
      },
    ],
    isPending: false,
    errorUpdateCount: 0,
  }),
}));
vi.mock('@/hooks/api/useTaskRuns', () => ({
  useTaskRuns: () => ({ data: worked() }),
}));
vi.mock('@/hooks/api/useTaskChangeStack', () => ({
  useTaskChangeStack: () => ({ data: stacked() }),
}));
vi.mock('@/hooks/api/useTaskJournal', () => ({
  useTaskJournal: () => ({
    data: journalled(),
    demand: { runs: [], want: () => {} },
  }),
}));

vi.mock('@/hooks/api/useConfiguration', () => ({
  useConfiguration: () => ({
    data: {
      integrations: [{ integration: 'linear', name: 'Linear', logo: null }],
    },
  }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
    isPending: false,
  }),
}));

const renderAt = (taskId: string) =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/team/team_1/tasks/${taskId}`]}>
      <Routes>
        <Route path="/w/:slug/team/:teamId/tasks/:taskId" element={<Task />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  moved.mockClear();
  deleted.mockClear();
  tookOver.mockClear();
  gaveBack.mockClear();
  worked.mockReturnValue([]);
  listed.mockReturnValue([task]);
  failing.mockReturnValue(false);
  refetch.mockClear();
  stacked.mockReturnValue({ latest: null });
  members.mockReturnValue([LEON]);
});

const run = (over: Record<string, unknown> = {}) => ({
  id: 'run_1',
  state: 'completed',
  attempt: 1,
  exitCode: 0,
  startedAt: '2026-08-30T09:00:00.000Z',
  updatedAt: '2026-08-30T09:00:56.000Z',
  harness: 'claude-code',
  station: {
    name: 'Implementation',
    color: '#edc12b',
    position: 3,
    count: 5,
  },
  review: null as { state: string; conversationId: string } | null,
  ...over,
});

const giveBackFromTheMenu = async (
  user: ReturnType<typeof userEvent.setup>,
) => {
  await user.click(screen.getByRole('button', { name: 'Task options' }));
  await screen.findByRole('menu');
  await user.click(screen.getByRole('menuitem', { name: /Give it back/ }));
};

describe('Task', () => {
  describe('taking it over', () => {
    it('offers to take over a task at a station where an agent works', async () => {
      const user = userEvent.setup();
      renderAt('task_1');

      await user.click(screen.getByRole('button', { name: 'Task options' }));
      await screen.findByRole('menu');
      await user.click(screen.getByRole('menuitem', { name: /Take over/ }));

      expect(
        await screen.findByRole('dialog', { name: 'Take over at Triage' }),
      ).toBeInTheDocument();
    });

    it('offers nobody off the team to take it over', async () => {
      const user = userEvent.setup();
      members.mockReturnValue([]);
      renderAt('task_1');

      await user.click(screen.getByRole('button', { name: 'Task options' }));
      await screen.findByRole('menu');

      expect(
        screen.queryByRole('menuitem', { name: /Take over/ }),
      ).not.toBeInTheDocument();
    });

    it('sends the reason and the first message to the agent', async () => {
      const user = userEvent.setup();
      renderAt('task_1');

      await user.click(screen.getByRole('button', { name: 'Task options' }));
      await screen.findByRole('menu');
      await user.click(screen.getByRole('menuitem', { name: /Take over/ }));
      await user.click(
        await screen.findByRole('radio', { name: /try something/ }),
      );
      await user.type(
        screen.getByRole('textbox', { name: 'First message to the agent' }),
        'Use a bounded queue.',
      );
      await user.click(screen.getByRole('button', { name: 'Take over' }));

      expect(tookOver).toHaveBeenCalledWith(
        {
          teamId: 'team_1',
          taskId: 'task_1',
          verdict: 'exploring',
          body: 'Use a bounded queue.',
        },
        expect.anything(),
      );
    });

    it('marks the session in Activity, and gives the task back to its station', async () => {
      const user = userEvent.setup();
      listed.mockReturnValue([
        {
          ...task,
          progress: null,
          takeover: {
            by: { id: 'user_1', name: 'Leon', image: null },
            verdict: 'not-right',
            startedAt: new Date().toISOString(),
            runId: 'run_turn',
            heldMoveTo: null,
          },
        },
      ]);
      worked.mockReturnValue([run({ id: 'run_turn', state: 'running' })]);
      renderAt('task_1');

      expect(
        screen.getByRole('link', { name: 'Implementation' }).closest('li'),
      ).toHaveTextContent('Taken over');

      await giveBackFromTheMenu(user);
      const dialog = await screen.findByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Give it back' }),
      );

      expect(gaveBack).toHaveBeenCalledWith(
        { teamId: 'team_1', taskId: 'task_1', next: 'continue' },
        expect.anything(),
      );
    });

    it('says an event asked to finish the task while the person had it', async () => {
      const user = userEvent.setup();
      listed.mockReturnValue([
        {
          ...task,
          progress: null,
          takeover: {
            by: { id: 'user_1', name: 'Leon', image: null },
            verdict: 'not-right',
            startedAt: new Date().toISOString(),
            runId: 'run_turn',
            heldMoveTo: 'station_3',
          },
        },
      ]);
      renderAt('task_1');

      await giveBackFromTheMenu(user);
      const dialog = await screen.findByRole('dialog');

      expect(
        within(dialog).getByText(
          'An event asked to finish the task while you had it. The task moves to Completed.',
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText('Give it back to the line'),
      ).toBeInTheDocument();
    });

    it('keeps the task assigned to the person who has it', () => {
      listed.mockReturnValue([
        {
          ...task,
          takeover: {
            by: { id: 'user_1', name: 'Leon', image: null },
            verdict: 'not-right',
            startedAt: new Date().toISOString(),
            runId: 'run_turn',
            heldMoveTo: null,
          },
        },
      ]);
      renderAt('task_1');

      for (const picker of screen.getAllByRole('button', {
        name: /Assign/,
      })) {
        expect(picker).toBeDisabled();
      }
    });

    it('keeps the task at its station while the person has it', () => {
      listed.mockReturnValue([
        {
          ...task,
          takeover: {
            by: { id: 'user_1', name: 'Leon', image: null },
            verdict: 'not-right',
            startedAt: new Date().toISOString(),
            runId: 'run_turn',
            heldMoveTo: null,
          },
        },
      ]);
      renderAt('task_1');

      expect(screen.getByRole('button', { name: 'Station' })).toBeDisabled();
    });

    it('lets only the person who took the task over give it back', async () => {
      const user = userEvent.setup();
      listed.mockReturnValue([
        {
          ...task,
          takeover: {
            by: { id: 'user_2', name: 'Maya', image: null },
            verdict: 'not-right',
            startedAt: new Date().toISOString(),
            runId: 'run_turn',
            heldMoveTo: null,
          },
        },
      ]);
      renderAt('task_1');

      await user.click(screen.getByRole('button', { name: 'Task options' }));
      await screen.findByRole('menu');

      expect(
        screen.queryByRole('menuitem', { name: /Give it back/ }),
      ).not.toBeInTheDocument();
    });

    it('waits for a turn in progress before it gives the task back', async () => {
      const user = userEvent.setup();
      listed.mockReturnValue([
        {
          ...task,
          progress: 'in-progress',
          takeover: {
            by: { id: 'user_1', name: 'Leon', image: null },
            verdict: 'not-right',
            startedAt: new Date().toISOString(),
            runId: 'run_turn',
            heldMoveTo: null,
          },
        },
      ]);
      renderAt('task_1');

      await giveBackFromTheMenu(user);
      const dialog = await screen.findByRole('dialog');

      expect(
        within(dialog).getByText(
          'A turn is in progress. You can give the task back when it ends.',
        ),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByRole('button', { name: 'Give it back' }),
      ).toBeDisabled();
    });
  });

  describe('the runs it has been through', () => {
    it('says nothing while none have been worked', () => {
      worked.mockReturnValue([]);
      renderAt('task_1');

      expect(screen.queryByText('Activity')).not.toBeInTheDocument();
    });

    it('heads the list once there are some', () => {
      worked.mockReturnValue([run(), run({ id: 'run_2' })]);
      renderAt('task_1');

      expect(
        screen.getByRole('heading', { name: 'Activity' }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('leads to the run’s own page', () => {
      worked.mockReturnValue([run()]);
      renderAt('task_1');

      expect(
        screen.getByRole('link', { name: /Implementation/ }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_1');
    });

    it('names the station each ran at', () => {
      worked.mockReturnValue([run()]);
      renderAt('task_1');

      expect(screen.getByText('Implementation')).toBeInTheDocument();
    });

    it('marks each run that put the task to a person', () => {
      worked.mockReturnValue([
        run({ review: { state: 'pending', conversationId: 'task_1:5' } }),
        run({ id: 'run_2' }),
        run({
          id: 'run_3',
          review: { state: 'answered', conversationId: 'task_1:0' },
        }),
      ]);
      renderAt('task_1');

      expect(screen.getAllByText('Waiting for you')).toHaveLength(1);
      expect(screen.getByText('Answered')).toBeInTheDocument();
    });

    it('opens the conversation where that run asked', () => {
      worked.mockReturnValue([
        run({
          id: 'run_7',
          review: { state: 'pending', conversationId: 'task_1:5' },
        }),
      ]);
      renderAt('task_1');

      expect(
        screen.getByRole('link', { name: /Waiting for you/ }),
      ).toHaveAttribute('href', '/w/acme/inbox/task_1%3A5?run=run_7');
    });

    it('says nothing of a review where none was asked for', () => {
      worked.mockReturnValue([run()]);
      renderAt('task_1');

      expect(screen.queryByText('Waiting for you')).not.toBeInTheDocument();
    });

    it('puts the asking above the run that raised it', () => {
      worked.mockReturnValue([
        run({ id: 'run_2' }),
        run({ review: { state: 'pending', conversationId: 'task_1:5' } }),
      ]);
      renderAt('task_1');

      const rows = screen
        .getAllByRole('listitem')
        .map((each) => each.textContent);

      expect(rows[1]).toContain('Waiting for you');
      expect(rows[2]).toContain('Implementation');
    });
  });

  it('links the changes of the newest stack generated for the task', () => {
    stacked.mockReturnValue({
      latest: {
        runId: 'run_9',
        repository: 'spotlight',
        state: 'ready',
        checkStatus: 'checked',
        added: 61,
        removed: 4,
      },
    });
    renderAt('task_1');

    const changes = screen.getByRole('link', { name: /Changes/ });

    expect(changes).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/runs/run_9/changes?repository=spotlight',
    );
    expect(changes).toHaveTextContent('+61');
    expect(changes).toHaveTextContent('−4');
  });

  it('offers no change stack where none was generated', () => {
    renderAt('task_1');

    expect(
      screen.queryByRole('link', { name: /Changes/ }),
    ).not.toBeInTheDocument();
  });

  it('leads with the task title', () => {
    renderAt('task_1');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Fix the queue' }),
    ).toBeInTheDocument();
  });

  it('opens the task’s workspace in VS Code', () => {
    renderAt('task_1');

    expect(
      screen.getByRole('link', { name: 'Open in VS Code' }),
    ).toHaveAttribute(
      'href',
      'vscode://vscode-remote/ssh-remote+task-task_1.acme.spotlight/workspace',
    );
  });

  it('names the line it came from in the breadcrumbs', () => {
    renderAt('task_1');

    expect(screen.getByRole('link', { name: 'Default' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1',
    );
  });

  it('names the station it is at', () => {
    renderAt('task_1');

    expect(screen.getByRole('button', { name: /Station/ })).toHaveTextContent(
      'Triage',
    );
  });

  it('moves the task to a station picked from the sidebar', async () => {
    const user = userEvent.setup();
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: /Station/ }));
    await screen.findByRole('menu');
    await user.click(screen.getByRole('menuitemradio', { name: 'Backlog' }));

    expect(moved).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      taskId: 'task_1',
      revision: 2,
      stationId: 'station_0',
      afterTaskId: null,
    });
  });

  it('offers only the backlog, completed and its current station to a task at a work station', async () => {
    const user = userEvent.setup();
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: /Station/ }));
    await screen.findByRole('menu');

    expect(
      screen.getAllByRole('menuitemradio').map((each) => each.textContent),
    ).toEqual(['Backlog', 'Triage', 'Completed']);
  });

  it('offers nothing to move to once a task is completed', async () => {
    const user = userEvent.setup();
    listed.mockReturnValue([{ ...task, stationId: 'station_3' }]);
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: /Station/ }));
    await screen.findByRole('menu');

    expect(
      screen.getAllByRole('menuitemradio').map((each) => each.textContent),
    ).toEqual(['Completed']);
  });

  it('confirms before taking a task away', async () => {
    const user = userEvent.setup();
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: 'Task options' }));
    await screen.findByRole('menu');
    await user.click(screen.getByRole('menuitem', { name: /Delete task/ }));

    expect(
      await screen.findByRole('heading', { name: /Delete/ }),
    ).toBeInTheDocument();
    expect(deleted).not.toHaveBeenCalled();
  });

  it('takes the task away once the person confirms', async () => {
    const user = userEvent.setup();
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: 'Task options' }));
    await screen.findByRole('menu');
    await user.click(screen.getByRole('menuitem', { name: /Delete task/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Delete task' }),
    );

    expect(deleted).toHaveBeenCalledWith(
      { teamId: 'team_1', taskId: 'task_1' },
      expect.anything(),
    );
  });

  it('keeps the task when the person declines', async () => {
    const user = userEvent.setup();
    renderAt('task_1');

    await user.click(screen.getByRole('button', { name: 'Task options' }));
    await screen.findByRole('menu');
    await user.click(screen.getByRole('menuitem', { name: /Delete task/ }));
    await user.click(await screen.findByRole('button', { name: 'Keep it' }));

    expect(deleted).not.toHaveBeenCalled();
  });

  it('says so when there is no task at that address', () => {
    renderAt('task_missing');

    expect(
      screen.getByRole('heading', { name: 'Task not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the team' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
  });

  it('keeps the shape of a task while it loads, keeping what never changes', () => {
    listed.mockReturnValue(undefined);

    renderAt('task_1');

    expect(
      screen.getByRole('status', { name: 'Loading the task' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Properties' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Task not found' }),
    ).not.toBeInTheDocument();
  });

  it('says the task could not be loaded, and tries again on request', async () => {
    const user = userEvent.setup();
    listed.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    renderAt('task_1');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The task could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('keeps the task up when a later refresh fails', () => {
    failing.mockReturnValue(true);

    renderAt('task_1');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Fix the queue' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  describe('keyboard', () => {
    const renderWithKeys = () =>
      render(
        <CommandsProvider>
          <MemoryRouter initialEntries={['/w/acme/team/team_1/tasks/task_1']}>
            <Routes>
              <Route
                path="/w/:slug/team/:teamId/tasks/:taskId"
                element={<Task />}
              />
            </Routes>
          </MemoryRouter>
        </CommandsProvider>,
      );

    const press = (key: string, init: KeyboardEventInit = {}) =>
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key,
        ...init,
      });

    it('opens the stations to move to with S', async () => {
      renderWithKeys();

      press('s');

      expect(
        await screen.findByRole('menuitemradio', { name: 'Backlog' }),
      ).toBeInTheDocument();
    });

    it('opens the assignees with A', async () => {
      renderWithKeys();

      press('a');

      expect(
        await screen.findByRole('menuitem', { name: /No assignee/ }),
      ).toBeInTheDocument();
    });

    it('asks before it deletes the task with Command Backspace', async () => {
      renderWithKeys();

      press('Backspace', { metaKey: true });

      expect(
        await screen.findByRole('heading', { name: /Delete/ }),
      ).toBeInTheDocument();
      expect(deleted).not.toHaveBeenCalled();
    });

    it('shows the key in the task options', async () => {
      const user = userEvent.setup();
      renderWithKeys();

      await user.click(screen.getByRole('button', { name: 'Task options' }));

      expect(
        await screen.findByRole('menuitem', { name: /Delete task/ }),
      ).toHaveTextContent(/⌘⌫|Ctrl\s*Backspace/);
    });
  });
});

describe('where a task came from', () => {
  it('names the integration that opened it, with a link to the team integrations', () => {
    listed.mockReturnValue([{ ...task, source: 'linear' }]);

    renderAt('task_1');

    expect(screen.getByRole('link', { name: 'Linear' })).toHaveAttribute(
      'href',
      '/w/acme/settings/team/team_1/integrations',
    );
  });

  it('names no source for a task a person created', () => {
    listed.mockReturnValue([{ ...task, source: null }]);

    renderAt('task_1');

    expect(
      screen.queryByRole('link', { name: 'Linear' }),
    ).not.toBeInTheDocument();
  });
});
