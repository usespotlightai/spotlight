import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxItem } from '@/routes/InboxItem';

const answer = vi.fn();
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

vi.mock('@/hooks/api/useTaskJournal', () => ({
  useTaskJournal: () => ({ data: journal() }),
}));

vi.mock('@/hooks/api/useAnswerInboxItem', () => ({
  useAnswerInboxItem: () => ({ mutate: answer, isPending: false }),
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
    raisedAt: {
      station: 'Triage',
      stationColor: '#edc12b',
      stationPosition: 0,
    },
    createdAt: '2026-08-29T09:02:00.000Z',
    askedAt: '2026-08-29T12:00:00.000Z',
    resolved: false,
    working: false,
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

// Switching item is a navigation, not a remount: what breaks under it is a
// message reconciled into place while its editor keeps its first content.
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
    waiting.mockReturnValue(item([message()]));
    viewer.mockReturnValue({ user: { id: 'user_2' } });
    journal.mockReturnValue([]);
  });

  // How the work was done is folded away: it is not the answer.
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

    // How long it took, and how much of the context window it was holding.
    const holding = screen.getByRole('button', { name: /Worked for 56s/ });
    expect(holding).toHaveTextContent('2 steps');
    expect(holding).toHaveTextContent('12.2k/200k');
    expect(holding).toHaveAttribute('aria-expanded', 'false');

    await person.click(holding);

    expect(holding).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('The queue looks stuck.')).toBeInTheDocument();

    // The command it ran, said the way a person would say it, and what came
    // back only once asked for.
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

  // Yours read as yours by where they sit, so a name would only be noise.
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

  // What the person asked for: its title, what it says, and where it was
  // raised, which is not always where it now stands.
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

  // A station taking over is a break worth seeing, so it is marked by when.
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

    // One where Triage takes the work up, one where Spec takes over.
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

  /*
  A prompt holds the top only until the next one arrives, and it can travel no
  further than the stretch it opens. So each person's word starts a stretch of
  its own, carrying the work that followed it — which is what lets the next one
  push it out of view rather than sit on top of it.
  */
  it('opens a stretch of its own at every person’s word', () => {
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

    const stretches = screen.getAllByRole('list');

    expect(stretches).toHaveLength(2);
    expect(stretches[0]).toHaveTextContent('Triage said this.');
    expect(stretches[0]).not.toHaveTextContent('And Triage answered.');
    expect(stretches[1]).toHaveTextContent('And Triage answered.');
  });

  // Answering does not end it: the task is still theirs until it moves on.
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
    expect(screen.getByText(/moved on to Implementation/)).toBeInTheDocument();
  });

  // A reply says when it was said, the same as everything else.
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

  // An answered question should not look like an ignored one.
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

  it('sends what was typed', async () => {
    const person = userEvent.setup();
    renderItem();

    await person.type(
      screen.getByRole('textbox', { name: 'Answer Implementation' }),
      'The retry queue.',
    );
    await person.click(screen.getByRole('button', { name: 'Send' }));

    expect(answer).toHaveBeenCalledWith(
      { slug: 'acme', taskId: 'task_1', body: 'The retry queue.' },
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

  // Nothing to say is not an answer, and would put the task back to work on it.
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
