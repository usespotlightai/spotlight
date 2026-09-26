import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LineBoard } from '@/routes/LineBoard';

const line = {
  id: 'line_1',
  name: 'Default',
  stations: [
    { id: 'station_0', name: 'Backlog', position: 0, kind: 'backlog' },
    { id: 'station_1', name: 'Triage', position: 1, kind: 'work' },
    { id: 'station_2', name: 'Spec', position: 2, kind: 'work' },
    { id: 'station_3', name: 'Implementation', position: 3, kind: 'work' },
    { id: 'station_4', name: 'Code Review', position: 4, kind: 'work' },
    { id: 'station_5', name: 'Completed', position: 5, kind: 'completed' },
  ],
};

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [] }),
}));
const lined = vi.fn();
const linesFailing = vi.fn();
const refetchLines = vi.fn();

vi.mock('@/hooks/api/useLines', () => ({
  useLines: () => ({
    data: lined(),
    isPending: lined() === undefined,
    errorUpdateCount: linesFailing() ? 1 : 0,
    isFetching: false,
    refetch: refetchLines,
  }),
}));
vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
    isPending: false,
  }),
}));
vi.mock('@/hooks/api/useMembers', () => ({
  useMembers: () => ({ data: [] }),
}));

vi.mock('@/hooks/api/useAssignTask', () => ({
  useAssignTask: () => ({ mutate: vi.fn() }),
}));

const standing = [
  {
    id: 'task_1',
    stationId: 'station_1',
    revision: 2,
    title: 'Fix the queue',
    description: null,
    createdAt: '2026-08-04T09:15:00.000Z',
  },
  {
    id: 'task_2',
    stationId: 'station_2',
    title: 'Sort the inbox',
    description: null,
    createdAt: '2026-08-05T09:15:00.000Z',
  },
  {
    id: 'task_3',
    stationId: 'station_1',
    title: 'Drain the backlog',
    description: null,
    createdAt: '2026-08-06T09:15:00.000Z',
  },
  {
    id: 'task_4',
    stationId: 'station_0',
    title: 'Groom the idea',
    description: null,
    createdAt: '2026-08-07T09:15:00.000Z',
  },
];

const added = vi.fn();
const moved = vi.fn();
const listed = vi.fn();
const tasksFailing = vi.fn();
const refetchTasks = vi.fn();

vi.mock('@/hooks/api/useTasks', () => ({
  useTasks: () => ({
    data: listed(),
    isPending: listed() === undefined,
    errorUpdateCount: tasksFailing() ? 1 : 0,
    isFetching: false,
    refetch: refetchTasks,
  }),
}));
vi.mock('@/hooks/api/useAddTask', () => ({
  useAddTask: () => ({ mutate: added }),
}));
vi.mock('@/hooks/api/useMoveTask', () => ({
  useMoveTask: () => ({ mutate: moved }),
}));
vi.mock('@/hooks/api/useUploadAttachment', () => ({
  useUploadAttachment: () => ({ mutateAsync: vi.fn() }),
}));

const renderAt = (lineId: string) =>
  render(
    <MemoryRouter initialEntries={[`/w/acme/team/team_1/lines/${lineId}`]}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/lines/:lineId"
          element={<LineBoard />}
        />
      </Routes>
    </MemoryRouter>,
  );

const sections = () =>
  Array.from(document.querySelectorAll('[data-slot="station-section"]'));

const named = () =>
  sections().map((section) => section.querySelector('h2')?.textContent);

describe('LineBoard', () => {
  it('does not open the backlog', () => {
    renderAt('line_1');

    expect(
      screen.queryByRole('link', { name: 'Backlog' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Triage' })).toBeInTheDocument();
  });

  beforeEach(() => {
    localStorage.clear();
    added.mockClear();
    moved.mockClear();
    lined.mockReturnValue([line]);
    linesFailing.mockReturnValue(false);
    refetchLines.mockClear();
    listed.mockReturnValue(standing);
    tasksFailing.mockReturnValue(false);
    refetchTasks.mockClear();
  });

  it('holds the shape of a station while the line loads, keeping what never changes', () => {
    lined.mockReturnValue(undefined);

    renderAt('line_1');

    expect(
      screen.getByRole('status', { name: 'Loading the line' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
    expect(sections()).toHaveLength(0);
    expect(
      screen.queryByRole('heading', { name: 'Line not found' }),
    ).not.toBeInTheDocument();
  });

  it('names the line while its tasks are still loading', () => {
    listed.mockReturnValue(undefined);

    renderAt('line_1');

    expect(
      screen.getByRole('status', { name: 'Loading the line' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Platform\s*Default/ }),
    ).toBeInTheDocument();
  });

  it('says the line could not be loaded, and tries again when asked', async () => {
    const user = userEvent.setup();
    lined.mockReturnValue(undefined);
    linesFailing.mockReturnValue(true);

    renderAt('line_1');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The line could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetchLines).toHaveBeenCalled();
  });

  it('says the tasks could not be loaded, and tries again when asked', async () => {
    const user = userEvent.setup();
    listed.mockReturnValue(undefined);
    tasksFailing.mockReturnValue(true);

    renderAt('line_1');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The tasks could not be loaded.',
    );

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetchTasks).toHaveBeenCalled();
  });

  it('keeps the board up when a later refresh fails', () => {
    tasksFailing.mockReturnValue(true);

    renderAt('line_1');

    expect(sections()).toHaveLength(4);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows only the stations when the line holds no tasks', () => {
    listed.mockReturnValue([]);

    renderAt('line_1');

    expect(sections()).toHaveLength(4);
    expect(screen.queryByText('No tasks')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Create a task' }),
    ).not.toBeInTheDocument();
  });

  it('gives every station its own section, in board order', () => {
    renderAt('line_1');

    expect(sections()).toHaveLength(4);
    expect(named()).toEqual([
      'Triage',
      'Spec',
      'Implementation',
      'Code Review',
    ]);
  });

  it('names the team and the line it is showing', () => {
    renderAt('line_1');

    expect(
      screen.getByRole('heading', { name: /Platform\s*Default/ }),
    ).toBeInTheDocument();
  });

  it('folds a station away and leaves the others open', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(screen.getByRole('button', { name: 'Triage' }));

    expect(screen.getByRole('button', { name: 'Triage' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Spec' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('adds the task to the station whose plus was pressed', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(screen.getByRole('button', { name: 'Add task to Spec' }));

    const heading = await screen.findByRole('heading', { name: /New task/ });
    expect(heading).toHaveTextContent('Spec');

    await user.type(
      screen.getByRole('textbox', { name: 'Task title' }),
      'Write the spec',
    );
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    expect(added).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      stationId: 'station_2',
      task: { title: 'Write the spec', description: '', attachments: [] },
    });
  });

  it('stands each task at the station it belongs to', () => {
    renderAt('line_1');

    const [triage, spec] = sections();

    expect(triage?.textContent).toContain('Fix the queue');
    expect(spec?.textContent).not.toContain('Fix the queue');
  });

  it('counts the tasks a station holds', () => {
    renderAt('line_1');

    expect(sections()[0]?.textContent).toContain('2');
  });

  it('fills each station’s icon by how far along the line it stands', () => {
    renderAt('line_1');

    expect(
      sections().map(
        (section) =>
          section.querySelector('[data-slot="station-icon"] path') !== null,
      ),
    ).toEqual([true, true, true, true]);
  });

  it('shows nothing to act on until a task is picked', () => {
    renderAt('line_1');

    expect(
      document.querySelector('[data-slot="selection-bar"]'),
    ).not.toBeInTheDocument();
  });

  it('offers the backlog to a task standing further along', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(
      screen.getByRole('checkbox', { name: 'Select Fix the queue' }),
    );

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Move to Backlog/ }),
    ).toBeInTheDocument();
  });

  it('offers the station after it to a task waiting in the backlog', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(screen.getByRole('button', { name: 'Backlog' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Groom the idea' }),
    );

    expect(
      screen.getByRole('button', { name: /Move to Triage/ }),
    ).toBeInTheDocument();
  });

  it('moves every task that was picked', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(
      screen.getByRole('checkbox', { name: 'Select Fix the queue' }),
    );
    await user.click(screen.getByRole('button', { name: /Move to Backlog/ }));

    expect(moved).toHaveBeenCalledWith({
      teamId: 'team_1',
      lineId: 'line_1',
      taskId: 'task_1',
      revision: 2,
      stationId: 'station_0',
      afterTaskId: null,
    });
  });

  it('puts the selection down once it has been acted on', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(
      screen.getByRole('checkbox', { name: 'Select Fix the queue' }),
    );
    await user.click(screen.getByRole('button', { name: /Move to Backlog/ }));

    expect(
      document.querySelector('[data-slot="selection-bar"]'),
    ).not.toBeInTheDocument();
  });

  it('lets the selection be dropped without moving anything', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(
      screen.getByRole('checkbox', { name: 'Select Fix the queue' }),
    );
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));

    expect(moved).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-slot="selection-bar"]'),
    ).not.toBeInTheDocument();
  });

  it('joins the backgrounds of tasks picked next to each other', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(
      screen.getByRole('checkbox', { name: 'Select Fix the queue' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Drain the backlog' }),
    );

    const [first, second] = Array.from(
      document.querySelectorAll('[data-slot="task-row"]'),
    );

    expect(first?.className).toContain('rounded-b-none');
    expect(first?.className).not.toContain('rounded-t-none');
    expect(second?.className).toContain('rounded-t-none');
    expect(second?.className).not.toContain('rounded-b-none');
  });

  it('leaves a lone pick rounded on every corner', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(
      screen.getByRole('checkbox', { name: 'Select Fix the queue' }),
    );

    const [first] = Array.from(
      document.querySelectorAll('[data-slot="task-row"]'),
    );

    expect(first?.className).not.toContain('rounded-t-none');
    expect(first?.className).not.toContain('rounded-b-none');
  });

  it('holds back the backlog until it is asked for', () => {
    renderAt('line_1');

    expect(named()).toEqual([
      'Triage',
      'Spec',
      'Implementation',
      'Code Review',
    ]);
  });

  it('shows the backlog on its own when picked', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(screen.getByRole('button', { name: 'Backlog' }));

    expect(named()).toEqual(['Backlog']);
    expect(screen.getByText('Groom the idea')).toBeInTheDocument();
  });

  it('holds back what is completed until it is asked for', () => {
    renderAt('line_1');

    expect(named()).not.toContain('Completed');
  });

  it('shows what is completed on its own when picked', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(screen.getByRole('button', { name: 'Completed' }));

    expect(named()).toEqual(['Completed']);
  });

  it('opens on the view last looked at, however it is reached', () => {
    localStorage.setItem('spotlight.board-view', 'completed');
    renderAt('line_1');

    expect(named()).toEqual(['Completed']);
  });

  it('drops the selection when the view changes under it', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(
      screen.getByRole('checkbox', { name: 'Select Fix the queue' }),
    );
    await user.click(screen.getByRole('button', { name: 'Backlog' }));

    expect(
      document.querySelector('[data-slot="selection-bar"]'),
    ).not.toBeInTheDocument();
  });

  it('says how many are picked inside a station folded away', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(
      screen.getByRole('checkbox', { name: 'Select Fix the queue' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Drain the backlog' }),
    );
    await user.click(screen.getByRole('button', { name: 'Triage' }));

    const triage = sections()[0] as HTMLElement;

    expect(within(triage).getByText(/2 selected/)).toBeInTheDocument();
  });

  it('keeps the count to itself while the station is open', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(
      screen.getByRole('checkbox', { name: 'Select Fix the queue' }),
    );

    const triage = sections()[0] as HTMLElement;

    expect(within(triage).queryByText(/1 selected/)).not.toBeInTheDocument();
  });

  it('lets each task be picked up', () => {
    renderAt('line_1');

    expect(
      document
        .querySelector('[data-slot="task-row"]')
        ?.getAttribute('aria-roledescription'),
    ).toBe('sortable');
  });

  it('shows no landing mark until something is dragged', () => {
    renderAt('line_1');

    expect(
      document.querySelector('[data-slot="drop-indicator"]'),
    ).not.toBeInTheDocument();
  });

  it('says when each task was raised', () => {
    renderAt('line_1');

    expect(screen.getByText('Aug 4')).toBeInTheDocument();
  });

  it('opens a task in its own page', () => {
    renderAt('line_1');

    expect(screen.getByRole('link', { name: /Fix the queue/ })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/tasks/task_1',
    );
  });

  it('walks back to the team from the breadcrumbs', () => {
    renderAt('line_1');

    expect(screen.getByRole('link', { name: /Platform/ })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
  });

  it('opens a station from its title', () => {
    renderAt('line_1');

    expect(screen.getByRole('link', { name: 'Triage' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/lines/line_1/stations/station_1',
    );
  });

  it('folds from the chevron rather than the title, which navigates', async () => {
    const user = userEvent.setup();
    renderAt('line_1');

    await user.click(screen.getByRole('button', { name: 'Spec' }));

    expect(screen.getByRole('button', { name: 'Spec' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('link', { name: 'Spec' })).toBeInTheDocument();
  });

  it('says so when there is no line at that address', () => {
    renderAt('line_missing');

    expect(sections()).toHaveLength(0);
    expect(
      screen.getByRole('heading', { name: 'Line not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the team' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
  });
});
