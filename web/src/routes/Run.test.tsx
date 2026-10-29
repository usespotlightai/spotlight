import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamRun } from '@/lib/run';
import { progressOfState } from '@/mocks/world/run-progress';
import { Run } from '@/routes/Run';
import { write } from '@/test/lexical';

const runs = vi.fn();
const runsFailing = vi.fn();
const refetchRuns = vi.fn();
const conversation = vi.fn();
const conversationFailing = vi.fn();
const refetchConversation = vi.fn();
const journal = vi.fn();
const journalFailing = vi.fn();

vi.mock('@/hooks/api/useTeamRuns', () => ({
  teamRunKeys: { forTeam: () => ['runs'] },
  useTeamRuns: () => ({
    data: runs(),
    isPending: runs() === undefined,
    errorUpdateCount: runsFailing() ? 1 : 0,
    isFetching: false,
    refetch: refetchRuns,
  }),
}));

vi.mock('@/hooks/api/useRunNotes', () => ({
  runNotesKeys: { forRun: () => ['run-notes'] },
  useRunNotes: () => ({
    data: conversation(),
    isPending: conversation() === undefined,
    errorUpdateCount: conversationFailing() ? 1 : 0,
    isFetching: false,
    refetch: refetchConversation,
  }),
}));

vi.mock('@/hooks/api/useTaskJournal', () => ({
  journalKeys: { forTask: () => ['journal'] },
  useTaskJournal: () => ({
    data: journal(),
    isPending: journal() === undefined,
    errorUpdateCount: journalFailing() ? 1 : 0,
  }),
}));

vi.mock('@/hooks/api/useSession', () => ({
  useSession: () => ({
    data: { user: { id: 'user_1', name: 'Sam Rivera', image: null } },
  }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
  }),
}));

vi.mock('@/hooks/api/useRunStream', () => ({ useRunStream: () => undefined }));
vi.mock('@/hooks/api/useRunMemories', () => ({
  runMemoryKeys: { forRun: () => ['run-memories'] },
  useRunMemories: () => ({
    data: { briefed: [], omitted: [], recalled: [], proposed: [] },
    isPending: false,
    isFetching: false,
    errorUpdateCount: 0,
  }),
}));
vi.mock('@/hooks/api/useRunChangeStacks', () => ({
  changeStackKeys: { forRun: () => ['change-stacks'] },
  useRunChangeStacks: () => ({ data: undefined }),
}));

const taskStation = vi.fn((): Record<string, unknown> => ({}));

vi.mock('@/hooks/api/useTaskStation', () => ({
  useTaskStation: () => taskStation(),
}));

const send = vi.fn();
const inFlight = vi.fn((): unknown[] => []);

vi.mock('@/hooks/api/useSendMessage', () => ({
  useSendMessage: () => ({ mutate: send, isPending: false }),
  useMessagesInFlight: () => inFlight(),
}));

const answer = vi.fn();

vi.mock('@/hooks/api/useAnswerInboxItem', () => ({
  useAnswerInboxItem: () => ({ mutate: answer, isPending: false }),
}));

const stop = vi.fn();

vi.mock('@/hooks/api/useStopRun', () => ({
  useStopRun: () => ({ mutate: stop }),
  useStopInFlight: () => false,
}));

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({ data: [] }),
}));

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [] }),
}));

const STATION = {
  id: 'station_3',
  name: 'Implementation',
  color: '#5c66d9',
  position: 2,
  count: 4,
};

const run = (over: Record<string, unknown> = {}) => ({
  id: 'run_1',
  state: 'completed',
  progress: progressOfState((over.state ?? 'completed') as TeamRun['state']),
  attempt: 1,
  exitCode: 0,
  startedAt: '2026-08-29T09:02:00.000Z',
  updatedAt: '2026-08-29T12:00:00.000Z',
  harness: 'claude-code',
  station: STATION,
  review: null,
  taskId: 'task_1',
  taskTitle: 'Fix the queue',
  taskDescription: 'The retry queue is stuck.',
  ...over,
});

const conversationOf = (over: Record<string, unknown> = {}) => ({
  runId: 'run_1',
  taskId: 'task_1',
  title: 'Fix the queue',
  description: 'The retry queue is stuck.',
  attachments: [],
  station: STATION,
  createdAt: '2026-08-29T09:02:00.000Z',
  briefing: null,
  progress: null,
  notes: [
    {
      position: 0,
      kind: 'asked',
      form: 'words',
      voice: 'station',
      station: 'Implementation',
      stationColor: '#5c66d9',
      stationPosition: 2,
      runId: 'run_1',
      body: 'Which queue should I drain?',
      attachments: [],
      at: '2026-08-29T12:00:00.000Z',
      author: null,
      coAuthors: [],
    },
  ],
  ...over,
});

const step = {
  kind: 'tool',
  text: 'queue-stats --all',
  status: 'completed',
  tool: 'execute',
  detail: null,
  ms: 1_000,
  startedAt: '2026-08-29T10:00:00.000Z',
  locations: [],
  input: null,
  output: null,
  change: null,
};

const renderRun = (client = new QueryClient()) =>
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/w/acme/team/team_1/runs/run_1']}>
        <Routes>
          <Route path="/w/:slug/team/:teamId/runs/:runId" element={<Run />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('Run', () => {
  beforeEach(() => {
    taskStation.mockReturnValue({});
    send.mockReset();
    stop.mockReset();
    inFlight.mockReturnValue([]);
    runs.mockReturnValue([run()]);
    runsFailing.mockReturnValue(false);
    refetchRuns.mockReset();
    conversation.mockReturnValue(conversationOf());
    conversationFailing.mockReturnValue(false);
    refetchConversation.mockReset();
    journal.mockReturnValue([]);
    journalFailing.mockReturnValue(false);
  });

  describe('while it loads', () => {
    it('keeps the shape of the run rather than calling it gone', () => {
      runs.mockReturnValue(undefined);

      renderRun();

      expect(
        screen.getByRole('status', { name: 'Loading the run' }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/no such run/)).not.toBeInTheDocument();
    });

    it('waits for the conversation, so the footer does not change under the reader', () => {
      conversation.mockReturnValue(undefined);

      renderRun();

      expect(
        screen.getByRole('status', { name: 'Loading the run' }),
      ).toBeInTheDocument();
    });

    it('waits for the work too, so it does not open up beneath the reader', () => {
      journal.mockReturnValue(undefined);

      renderRun();

      expect(
        screen.getByRole('status', { name: 'Loading the run' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Which queue should I drain?'),
      ).not.toBeInTheDocument();
    });
  });

  describe('when it could not be loaded', () => {
    it('says so beneath a bar of its own, rather than calling the run gone', () => {
      runs.mockReturnValue(undefined);
      runsFailing.mockReturnValue(true);

      const { container } = renderRun();

      expect(container.querySelector('header')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'The run could not be loaded.',
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByText(/no such run/)).not.toBeInTheDocument();
    });

    it('tries the runs again on request', async () => {
      runs.mockReturnValue(undefined);
      runsFailing.mockReturnValue(true);

      renderRun();

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(refetchRuns).toHaveBeenCalledTimes(1);
    });

    it('tries the conversation again when only that is missing', async () => {
      conversation.mockReturnValue(undefined);
      conversationFailing.mockReturnValue(true);

      renderRun();

      expect(screen.getByRole('alert')).toHaveTextContent(
        'The run could not be loaded.',
      );

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(refetchConversation).toHaveBeenCalledTimes(1);
      expect(refetchRuns).not.toHaveBeenCalled();
    });

    it('still shows the conversation when only the work is missing', () => {
      journal.mockReturnValue(undefined);
      journalFailing.mockReturnValue(true);

      renderRun();

      expect(
        screen.getByText('Which queue should I drain?'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not call a run empty when only its work is missing', () => {
      conversation.mockReturnValue(conversationOf({ notes: [] }));
      journal.mockReturnValue(undefined);
      journalFailing.mockReturnValue(true);

      renderRun();

      expect(
        screen.queryByText(/before the agent started/),
      ).not.toBeInTheDocument();
    });
  });

  it('says there is no such run beneath a bar of its own', () => {
    runs.mockReturnValue([run({ id: 'run_2' })]);

    const { container } = renderRun();

    expect(container.querySelector('header')).toBeInTheDocument();
    expect(screen.getByText('This team has no such run.')).toBeInTheDocument();
  });

  it('shows the note of the station', () => {
    renderRun();

    expect(screen.getByText('Which queue should I drain?')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Message Implementation' }),
    ).toBeInTheDocument();
  });

  it('ends a finished run with a way to copy the whole conversation', () => {
    renderRun();

    expect(
      within(screen.getByRole('toolbar', { name: 'Run actions' })).getByRole(
        'button',
        { name: 'Copy the conversation' },
      ),
    ).toBeInTheDocument();
  });

  it('says how long ago the conversation last moved, beside its actions', () => {
    renderRun();

    expect(
      within(screen.getByRole('toolbar', { name: 'Run actions' })).getByText(
        /ago|just now|[A-Z][a-z]{2} \d/,
      ),
    ).toBeInTheDocument();
  });

  describe('once the station has run the task again', () => {
    const note = (position: number, over: Record<string, unknown>) => ({
      position,
      kind: 'message',
      form: 'words',
      voice: 'station',
      station: 'Implementation',
      stationColor: '#5c66d9',
      stationPosition: 2,
      runId: 'run_1',
      body: '',
      attachments: [],
      at: '2026-08-29T12:00:00.000Z',
      author: null,
      coAuthors: [],
      ...over,
    });

    beforeEach(() => {
      conversation.mockReturnValue(
        conversationOf({
          progress: 'in-progress',
          notes: [
            note(0, { body: 'The tests failed.' }),
            note(1, {
              voice: 'person',
              runId: null,
              body: 'try again',
              author: { id: 'user_1', name: 'Sam', image: null },
              coAuthors: [],
            }),
            note(2, { runId: 'run_2', body: 'The tests failed again.' }),
          ],
        }),
      );
    });

    it('shows the messages of the later runs at the station', () => {
      renderRun();

      expect(screen.getByText('try again')).toBeInTheDocument();
      expect(screen.getByText('The tests failed again.')).toBeInTheDocument();
    });

    const later = (latestRun: Record<string, unknown>) => {
      runs.mockReturnValue([run({ state: 'failed', exitCode: -1 })]);
      conversation.mockReturnValue({
        ...conversation(),
        latestRun: { id: 'run_2', progress: null, ...latestRun },
      });
    };

    it('stops the later run while it works', async () => {
      later({ state: 'claimed' });

      renderRun();
      await userEvent.click(screen.getByRole('button', { name: 'Stop' }));

      expect(stop).toHaveBeenCalledWith({ teamId: 'team_1', runId: 'run_2' });
    });

    it('keeps the work of a run that is stopping, without saying it is working', () => {
      later({ state: 'claimed', progress: 'stopping' });
      journal.mockReturnValue([
        {
          runId: 'run_2',
          attempt: 1,
          steps: [step],
          spans: [],
          marks: {
            startedAt: '2026-08-29T12:05:00.000Z',
            agentStoppedAt: null,
          },
        },
      ]);

      renderRun();

      expect(screen.getAllByText('queue-stats --all').length).toBeGreaterThan(
        0,
      );
      expect(screen.queryByText(/is working/)).not.toBeInTheDocument();
      expect(screen.getByText('Stopping…')).toBeInTheDocument();
    });

    it('says the run is finishing once the agent has stopped', () => {
      later({ state: 'claimed', progress: 'stopping' });
      journal.mockReturnValue([
        {
          runId: 'run_2',
          attempt: 1,
          steps: [step],
          spans: [],
          marks: {
            startedAt: '2026-08-29T12:05:00.000Z',
            agentStoppedAt: '2026-08-29T12:06:00.000Z',
          },
        },
      ]);

      renderRun();

      expect(
        screen.getByText('Agent stopped. Finishing the run…'),
      ).toBeInTheDocument();
    });

    it('no longer offers to stop the later run once it is stopping', () => {
      later({ state: 'claimed', progress: 'stopping' });

      renderRun();

      expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
    });

    it('sends a message to the later run', async () => {
      later({ state: 'failed' });

      renderRun();
      await write(
        screen.getByRole('textbox', { name: 'Message Implementation' }),
        'try again',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Send' }));

      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run_2', body: 'try again' }),
        expect.anything(),
      );
    });

    it('shows a message on its way before the server has it', () => {
      inFlight.mockReturnValue([
        {
          teamId: 'team_1',
          runId: 'run_1',
          body: 'and once more',
          attachments: [],
          sentAt: Date.parse('2026-08-29T12:10:00.000Z'),
        },
      ]);

      renderRun();

      expect(screen.getByText('and once more')).toBeInTheDocument();
    });

    it('ends the opened run with its actions before the later messages', () => {
      renderRun();

      const actions = screen.getByRole('toolbar', { name: 'Run actions' });

      expect(
        actions.compareDocumentPosition(screen.getByText('try again')) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it('keeps the run actions back until the run has finished', () => {
    runs.mockReturnValue([run({ state: 'claimed' })]);

    renderRun();

    expect(screen.queryByRole('toolbar', { name: 'Run actions' })).toBeNull();
  });

  it('leaves the config and the spend to the traces', () => {
    conversation.mockReturnValue(
      conversationOf({
        spend: {
          cost: 1.8742,
          currency: 'USD',
          inputTokens: 3_120,
          outputTokens: 18_840,
          cacheReadTokens: 2_412_300,
          cacheWriteTokens: 61_400,
        },
      }),
    );

    renderRun();

    expect(
      document.querySelector('[data-slot="run-config"]'),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="run-spend"]'),
    ).not.toBeInTheDocument();
  });

  it('opens with what was written for the task, not the whole prompt', () => {
    conversation.mockReturnValue(
      conversationOf({ briefing: 'You are the Implementation station…' }),
    );

    renderRun();

    expect(
      screen.getByRole('heading', { name: 'Fix the queue' }),
    ).toBeInTheDocument();
    expect(screen.getByText('The retry queue is stuck.')).toBeInTheDocument();
    expect(
      screen.queryByText('You are the Implementation station…'),
    ).not.toBeInTheDocument();
  });

  describe('when nothing was done', () => {
    it('says the run failed before the agent started, and leads to the task', () => {
      runs.mockReturnValue([run({ state: 'failed' })]);
      conversation.mockReturnValue(conversationOf({ notes: [] }));

      renderRun();

      expect(
        screen.getByText('The run failed before the agent started.'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Open the task' }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/tasks/task_1');
    });

    it('says nothing is queued once a stop for the queued run is on its way', () => {
      runs.mockReturnValue([run({ state: 'queued' })]);
      conversation.mockReturnValue(
        conversationOf({
          notes: [],
          latestRun: { id: 'run_1', state: 'queued', progress: 'stopping' },
        }),
      );

      renderRun();

      expect(screen.queryByText(/Queued\./)).not.toBeInTheDocument();
    });

    it('keeps a claimed run that is stopping under way, neither ended nor empty', () => {
      runs.mockReturnValue([run({ state: 'claimed', progress: null })]);
      conversation.mockReturnValue(
        conversationOf({
          notes: [],
          progress: null,
          latestRun: {
            id: 'run_1',
            state: 'claimed',
            progress: 'stopping',
          },
        }),
      );

      renderRun();

      expect(
        screen.queryByText(/ended before the agent started/),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('toolbar', { name: 'Run actions' })).toBeNull();
    });

    it('says the run is queued, not working, while it is still to start', () => {
      runs.mockReturnValue([run({ state: 'queued' })]);
      conversation.mockReturnValue(
        conversationOf({ notes: [], progress: 'queued' }),
      );

      renderRun();

      expect(
        screen.getByText(
          'Queued. Implementation starts when a runner is free.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/is working/)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/before the agent started/),
      ).not.toBeInTheDocument();
    });

    it('says nothing of the kind once the run has done something', () => {
      conversation.mockReturnValue(conversationOf({ notes: [] }));
      journal.mockReturnValue([
        { runId: 'run_1', attempt: 1, steps: [step], spans: [] },
      ]);

      renderRun();

      expect(screen.getByText('queue-stats --all')).toBeInTheDocument();
      expect(
        screen.queryByText(/before the agent started/),
      ).not.toBeInTheDocument();
    });
  });

  describe('once the task is idle at the station', () => {
    const idle = {
      station: { id: 'station_3', harness: 'claude-code', kind: 'work' },
      task: { id: 'task_1', progress: null, awaitingReview: null },
    };

    it('offers to send the work back to the station, which starts it again', () => {
      taskStation.mockReturnValue(idle);

      renderRun();

      expect(
        screen.getByRole('textbox', {
          name: 'Send it back to Implementation',
        }),
      ).toHaveAttribute(
        'aria-placeholder',
        'Say what to change. Implementation starts again…',
      );
    });

    it('says messages reach no one from a run at a station the task has left', () => {
      taskStation.mockReturnValue({
        ...idle,
        station: { ...idle.station, id: 'station_4' },
      });

      renderRun();

      expect(
        screen.getByText(
          'The task has moved to another station. Messages here reach no one.',
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: 'Message Implementation' }),
      ).toBeNull();
    });

    it('only says something to the station while a run still works the task', () => {
      taskStation.mockReturnValue({
        ...idle,
        task: { ...idle.task, progress: 'in-progress' },
      });

      renderRun();

      expect(
        screen.getByRole('textbox', {
          name: 'Message Implementation',
        }),
      ).toBeInTheDocument();
    });
  });

  describe('while it waits on a person', () => {
    const PENDING = { state: 'pending', conversationId: 'task_1:0' };

    it('says it is waiting for you where it paused, and leads to where to answer', () => {
      runs.mockReturnValue([run({ state: 'waiting', review: PENDING })]);

      const { container } = renderRun();

      expect(
        container.querySelector('[data-slot="run-waiting"]'),
      ).toHaveTextContent('Waiting for you');
      expect(
        screen.getByRole('link', { name: 'Answer in the inbox' }),
      ).toHaveAttribute('href', '/w/acme/inbox/task_1%3A0?run=run_1');
    });

    it('does not claim the agent is working, nor offer to stop it', () => {
      runs.mockReturnValue([run({ state: 'waiting', review: PENDING })]);

      renderRun();

      expect(
        screen.queryByText('Implementation is working…'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Stop' }),
      ).not.toBeInTheDocument();
    });

    it('offers to answer the question right here, so the run carries on', () => {
      runs.mockReturnValue([run({ state: 'waiting', review: PENDING })]);

      renderRun();

      expect(
        screen.getByRole('textbox', { name: 'Answer Implementation' }),
      ).toHaveAttribute(
        'aria-placeholder',
        'Answer the question to continue the run…',
      );
    });

    it('lets an approval be decided right here, through its inbox conversation', async () => {
      runs.mockReturnValue([run({ state: 'waiting', review: PENDING })]);
      const approval = conversationOf().notes.map((note) => ({
        ...note,
        form: 'approval',
        approval: {
          kind: 'tool-call' as const,
          name: 'linear.comment',
          because: 'It posts publicly, under the team’s name.',
          inputs: [{ name: 'body', value: 'Fixed.' }],
          status: 'pending' as const,
          edited: null,
          intent: null,
        },
      }));
      conversation.mockReturnValue(conversationOf({ notes: approval }));

      renderRun();

      await userEvent.click(
        screen.getByRole('button', { name: 'Approve linear.comment' }),
      );

      expect(answer).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'acme',
          itemId: 'task_1:0',
          approve: true,
        }),
      );

      expect(
        screen.getByRole('link', { name: 'Open in the inbox' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', {
          name: 'Message Implementation',
        }),
      ).toBeInTheDocument();
    });

    it('still waits for you once it is suspended, pointing at the inbox without a conversation to name', () => {
      runs.mockReturnValue([run({ state: 'suspended' })]);

      const { container } = renderRun();

      expect(
        container.querySelector('[data-slot="run-waiting"]'),
      ).toHaveTextContent('Waiting for you');
      expect(
        screen.getByRole('link', { name: 'Answer in the inbox' }),
      ).toHaveAttribute('href', '/w/acme/inbox');
    });

    it('does not call a run that asked before doing anything empty', () => {
      runs.mockReturnValue([run({ state: 'waiting' })]);
      conversation.mockReturnValue(conversationOf({ notes: [] }));

      renderRun();

      expect(
        screen.queryByText(/before the agent started/),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    });

    it('catches up on its work once it goes back to it', () => {
      const client = new QueryClient();
      const invalidated = vi.spyOn(client, 'invalidateQueries');
      runs.mockReturnValue([run({ state: 'waiting', review: PENDING })]);

      const { rerender } = renderRun(client);
      invalidated.mockClear();

      runs.mockReturnValue([run({ state: 'claimed', review: PENDING })]);
      rerender(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={['/w/acme/team/team_1/runs/run_1']}>
            <Routes>
              <Route
                path="/w/:slug/team/:teamId/runs/:runId"
                element={<Run />}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(invalidated).toHaveBeenCalledWith({ queryKey: ['journal'] });
    });
  });

  describe('once the person answered', () => {
    const asked = conversationOf().notes[0];
    const answered = {
      ...asked,
      position: 1,
      kind: 'answered',
      voice: 'person',
      runId: null,
      body: 'Drain webhook-retries first.',
      at: '2026-08-29T12:10:00.000Z',
      author: { id: 'user_1', name: 'Maya Chen', image: null },
      coAuthors: [],
    };
    const before = { ...step, text: 'queue-stats --all' };
    const after = {
      ...step,
      text: 'queue-drain webhook-retries',
      startedAt: '2026-08-29T12:15:00.000Z',
    };

    it('shows one run: its work before the question, the answer, then it carrying on', () => {
      runs.mockReturnValue([run({ state: 'claimed', attempt: 2 })]);
      conversation.mockReturnValue(
        conversationOf({ progress: 'in-progress', notes: [asked, answered] }),
      );
      journal.mockReturnValue([
        {
          runId: 'run_1',
          attempt: 1,
          steps: [before],
          spans: [],
          marks: { startedAt: '2026-08-29T09:02:00.000Z' },
        },
        {
          runId: 'run_1',
          attempt: 2,
          steps: [after],
          spans: [],
          marks: { startedAt: '2026-08-29T12:11:00.000Z' },
        },
      ]);

      renderRun();

      const question = screen.getByText('Which queue should I drain?');
      const answer = screen.getByText('Drain webhook-retries first.');
      const carrying = screen.getByText('queue-drain webhook-retries');

      expect(
        question.compareDocumentPosition(answer) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        answer.compareDocumentPosition(carrying) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(screen.getAllByText('queue-drain webhook-retries')).toHaveLength(
        1,
      );
      expect(screen.getAllByText('queue-stats --all')).toHaveLength(1);
      expect(
        screen.getByRole('button', { name: 'Worked · 1 step' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Implementation is working…'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Waiting for you')).not.toBeInTheDocument();
    });
  });
});
