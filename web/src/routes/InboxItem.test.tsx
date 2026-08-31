import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxItem } from '@/routes/InboxItem';

const answer = vi.fn();
const read = vi.fn();
const waiting = vi.fn();
const viewer = vi.fn();
const journal = vi.fn();

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({ data: viewer() }),
}));

vi.mock('@/hooks/api/useInbox', () => ({
  inboxKeys: { forWorkspace: () => ['inbox'] },
  useInbox: () => ({ data: waiting(), isPending: false }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
  }),
}));

vi.mock('@/hooks/api/useTaskJournal', () => ({
  useTaskJournal: () => ({ data: journal() }),
}));

vi.mock('@/hooks/api/useAnswerInboxItem', () => ({
  useAnswerInboxItem: () => ({ mutate: answer, isPending: false }),
}));

vi.mock('@/hooks/api/useReadInboxItem', () => ({
  useReadInboxItem: () => ({ mutate: read }),
}));

const message = (over: Record<string, unknown> = {}) => ({
  position: 0,
  kind: 'asked',
  station: 'Triage',
  stationColor: '#edc12b',
  stationPosition: 0,
  runId: 'run_1',
  body: 'Which queue should I drain?',
  at: '2026-08-29T12:00:00.000Z',
  author: null,
  ...over,
});

const item = (notes: unknown[], description: string | null = null) => [
  {
    id: 'task_1:0',
    taskId: 'task_1',
    teamId: 'team_1',
    title: 'Fix the queue',
    description,
    station: 'Implementation',
    stationColor: '#5c66d9',
    stationPosition: 2,
    stationCount: 4,
    standsAt: { name: 'Code Review', color: '#56b98d', position: 3 },
    raisedAt: { name: 'Triage', color: '#edc12b', position: 0 },
    createdAt: '2026-08-29T09:02:00.000Z',
    askedAt: '2026-08-29T12:00:00.000Z',
    resolved: false,
    working: false,
    unread: false,
    briefing: null,
    notes,
  },
];

const renderItem = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/inbox/task_1:0']}>
      <Routes>
        <Route path="/w/:slug/inbox/:itemId" element={<InboxItem />} />
      </Routes>
    </MemoryRouter>,
  );

// Switching item is a navigation, not a remount.
function Switch({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      switch
    </button>
  );
}

describe('InboxItem', () => {
  beforeEach(() => {
    answer.mockClear();
    read.mockClear();
    waiting.mockReturnValue(item([message()]));
    viewer.mockReturnValue({ user: { id: 'user_2' } });
    journal.mockReturnValue([]);
  });

  it('folds the work away behind what the station said', async () => {
    const person = userEvent.setup();
    journal.mockReturnValue([
      {
        runId: 'run_1',
        attempt: 1,
        readable: true,
        ms: 56_000,
        spent: {
          used: 12_173,
          size: 200_000,
          cost: 0.0664917,
          currency: 'USD',
        },
        steps: [
          {
            kind: 'thought',
            text: 'The queue looks stuck.',
            status: null,
            tool: null,
            detail: null,
            ms: 1_000,
          },
          {
            kind: 'tool',
            text: 'ls -la /workspaces',
            status: 'completed',
            tool: 'execute',
            detail: 'total 0',
            ms: 2_000,
          },
        ],
      },
    ]);

    renderItem();

    const holding = screen.getByRole('button', { name: /Worked for 56s/ });
    expect(holding).toHaveTextContent('2 steps');
    expect(holding).toHaveTextContent('12.2k/200k');
    expect(holding).toHaveAttribute('aria-expanded', 'false');

    await person.click(holding);

    expect(holding).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('The queue looks stuck.')).toBeInTheDocument();

    const ran = screen.getByRole('button', { name: /ls -la \/workspaces/ });
    expect(ran).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Ran')).toBeInTheDocument();

    await person.click(ran);

    expect(ran).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('total 0')).toBeInTheDocument();
  });

  it('shows nothing where a run left no readable journal', () => {
    journal.mockReturnValue([
      {
        runId: 'run_1',
        attempt: 1,
        readable: true,
        ms: null,
        spent: null,
        steps: [],
      },
    ]);

    renderItem();

    expect(screen.queryByText(/Worked/)).not.toBeInTheDocument();
  });

  it('shows what the station said, in the station’s name', () => {
    renderItem();

    const conversation = within(screen.getByRole('list'));

    expect(
      conversation.getByText('Which queue should I drain?'),
    ).toBeInTheDocument();
    expect(conversation.getByText('Triage')).toBeInTheDocument();
  });

  it('shows a person by name rather than by station', () => {
    waiting.mockReturnValue(
      item([
        message(),
        message({
          position: 1,
          body: 'The retry queue.',
          author: { id: 'user_1', name: 'Leon', image: null },
        }),
      ]),
    );

    renderItem();

    expect(screen.getByText('Leon')).toBeInTheDocument();
  });

  it('leaves your own words unnamed', () => {
    viewer.mockReturnValue({ user: { id: 'user_1' } });
    waiting.mockReturnValue(
      item([
        message({
          position: 1,
          body: 'The retry queue.',
          author: { id: 'user_1', name: 'Leon', image: null },
        }),
      ]),
    );

    renderItem();

    expect(screen.queryByText('Leon')).not.toBeInTheDocument();
    expect(screen.getByText('The retry queue.')).toBeInTheDocument();
  });

  // A conversation opens with what its own station was given, not with the
  // task, which is the prompt the first station received.
  it('opens on the prompt the station was given', () => {
    const [only] = item([message()]);
    waiting.mockReturnValue([
      { ...only, briefing: '## Code review\n\nReview the change.' },
    ]);

    renderItem();

    expect(screen.getByText(/Review the change\./)).toBeInTheDocument();
  });

  it('shows the task itself as the person’s own input', () => {
    waiting.mockReturnValue(item([message()], 'Write ACP.md, then hand over.'));

    renderItem();

    expect(
      screen.getByRole('heading', { name: 'Fix the queue' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Write ACP.md, then hand over.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Triage').length).toBeGreaterThan(0);
  });

  it('marks the time where one station takes over from another', () => {
    waiting.mockReturnValue(
      item([
        message(),
        message({ position: 1, body: 'Still Triage.' }),
        message({
          position: 2,
          station: 'Spec',
          stationPosition: 1,
          body: 'Spec now.',
          at: '2026-08-29T13:30:00.000Z',
        }),
      ]),
    );

    renderItem();

    const marks = within(screen.getByRole('list')).getAllByRole('time');

    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveAttribute('datetime', '2026-08-29T12:00:00.000Z');
    expect(marks[1]).toHaveAttribute('datetime', '2026-08-29T13:30:00.000Z');
  });

  it('shows the item switched to, not the one left behind', async () => {
    const person = userEvent.setup();
    waiting.mockReturnValue([
      ...item([message({ body: 'The first task said this.' })]),
      {
        ...item([message({ body: 'The second task said this.' })])[0],
        id: 'task_2:0',
        taskId: 'task_2',
        title: 'Another task',
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/w/acme/inbox/task_1:0']}>
        <Switch to="/w/acme/inbox/task_2:0" />
        <Routes>
          <Route path="/w/:slug/inbox/:itemId" element={<InboxItem />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('The first task said this.')).toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'switch' }));

    expect(screen.getByText('The second task said this.')).toBeInTheDocument();
    expect(
      screen.queryByText('The first task said this.'),
    ).not.toBeInTheDocument();
  });

  it('opens a turn of its own at every person’s word', () => {
    waiting.mockReturnValue(
      item([
        message({ body: 'Triage said this.' }),
        message({
          position: 1,
          body: 'A person asked this.',
          author: { id: 'user_2', name: 'Leon', image: null },
        }),
        message({ position: 2, body: 'And Triage answered.' }),
      ]),
    );

    renderItem();

    const turns = screen.getAllByRole('list');

    expect(turns).toHaveLength(2);
    expect(turns[0]).toHaveTextContent('Triage said this.');
    expect(turns[0]).not.toHaveTextContent('And Triage answered.');
    expect(turns[1]).toHaveTextContent('And Triage answered.');
  });

  it('can still be answered after a reply has been sent', () => {
    waiting.mockReturnValue(
      item([
        message(),
        message({
          position: 1,
          body: 'The retry queue.',
          author: { id: 'user_2', name: 'Leon', image: null },
        }),
      ]),
    );

    renderItem();

    expect(
      screen.getByRole('textbox', { name: 'Answer Implementation' }),
    ).toBeInTheDocument();
  });

  it('has nothing to answer once it has moved on', () => {
    const [only] = item([message()]);
    waiting.mockReturnValue([{ ...only, resolved: true }]);

    renderItem();

    expect(
      screen.queryByRole('textbox', { name: /Answer/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/moved on to Code Review/)).toBeInTheDocument();
  });

  it('says only that it is settled where it was closed in place', () => {
    const [only] = item([message()]);
    waiting.mockReturnValue([
      {
        ...only,
        resolved: true,
        standsAt: { name: only.station, color: '#56b98d', position: 3 },
      },
    ]);

    renderItem();

    expect(screen.getByText(/settled/)).toBeInTheDocument();
    expect(screen.queryByText(/moved on/)).not.toBeInTheDocument();
  });

  it('says when a reply was sent', () => {
    waiting.mockReturnValue(
      item([
        message({
          position: 1,
          body: 'The retry queue.',
          at: '2026-08-29T14:35:00.000Z',
          author: { id: 'user_2', name: 'Leon', image: null },
        }),
      ]),
    );

    renderItem();

    const said = screen
      .getAllByRole('time')
      .map((each) => each.getAttribute('datetime'));

    expect(said).toContain('2026-08-29T14:35:00.000Z');
  });

  it('says the station is working while a run is on it', () => {
    const [only] = item([message()]);
    waiting.mockReturnValue([{ ...only, working: true }]);

    renderItem();

    expect(screen.getByText('Implementation is working…')).toBeInTheDocument();
  });

  it('says nothing about working once it is idle', () => {
    renderItem();

    expect(screen.queryByText(/is working/)).not.toBeInTheDocument();
  });

  it('marks what was put to you as read on opening it', () => {
    waiting.mockReturnValue(
      item([message()]).map((each) => ({ ...each, unread: true })),
    );

    renderItem();

    expect(read).toHaveBeenCalledWith({ slug: 'acme', itemId: 'task_1:0' });
  });

  it('leaves what has already been read alone', () => {
    renderItem();

    expect(read).not.toHaveBeenCalled();
  });

  it('reads the conversation it opens with, not the task', () => {
    waiting.mockReturnValue(
      item([
        message({ position: 4 }),
        message({ position: 5, body: 'And this.' }),
      ]).map((each) => ({ ...each, id: 'task_1:4', unread: true })),
    );

    render(
      <MemoryRouter initialEntries={['/w/acme/inbox/task_1:4']}>
        <Routes>
          <Route path="/w/:slug/inbox/:itemId" element={<InboxItem />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(read).toHaveBeenCalledWith({ slug: 'acme', itemId: 'task_1:4' });
  });

  it('walks from the team to the task it is about', () => {
    renderItem();

    expect(screen.getByRole('link', { name: /Platform/ })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1',
    );
    expect(screen.getByRole('link', { name: 'Fix the queue' })).toHaveAttribute(
      'href',
      '/w/acme/team/team_1/tasks/task_1',
    );
  });

  it('sends what was typed', async () => {
    const person = userEvent.setup();
    renderItem();

    await person.type(
      screen.getByRole('textbox', { name: 'Answer Implementation' }),
      'The retry queue.',
    );
    await person.click(screen.getByRole('button', { name: 'Send' }));

    expect(answer).toHaveBeenCalledWith(
      { slug: 'acme', itemId: 'task_1:0', body: 'The retry queue.' },
      expect.anything(),
    );
  });

  it('sends on Enter, and keeps a newline on Shift+Enter', async () => {
    const person = userEvent.setup();
    renderItem();

    const box = screen.getByRole('textbox', { name: 'Answer Implementation' });

    await person.type(box, 'first{Shift>}{Enter}{/Shift}second');
    expect(answer).not.toHaveBeenCalled();

    await person.type(box, '{Enter}');
    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'first\nsecond' }),
      expect.anything(),
    );
  });

  it('will not send an empty answer', async () => {
    const person = userEvent.setup();
    renderItem();

    await person.type(
      screen.getByRole('textbox', { name: 'Answer Implementation' }),
      '   {Enter}',
    );

    expect(answer).not.toHaveBeenCalled();
  });
});
