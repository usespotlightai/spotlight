import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Run } from '@/routes/Run';

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

vi.mock('@/hooks/api/useRunConversation', () => ({
  runConversationKeys: { forRun: () => ['run-conversation'] },
  useRunConversation: () => ({
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
  useSession: () => ({ data: { user: { id: 'user_1' } } }),
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: { teams: [{ id: 'team_1', name: 'Platform' }] },
  }),
}));

const replayRun = vi.fn((): unknown => undefined);
const replayRunMissing = vi.fn(() => true);
const replayOfRun = vi.fn((): unknown => undefined);

vi.mock('@/hooks/api/useReplayRun', () => ({
  replayRunKeys: {
    forRun: () => ['replay-run'],
    replayOf: () => ['replay-run', 'replay'],
  },
  useReplayRun: () => ({
    data: replayRun(),
    isPending: replayRun() === undefined,
    errorUpdateCount: replayRunMissing() ? 1 : 0,
    error: replayRunMissing() ? { status: 404 } : null,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

const searchRun = vi.fn((): unknown => undefined);

vi.mock('@/hooks/api/useSearchRun', () => ({
  useSearchRun: () => ({
    data: searchRun(),
    isPending: false,
    errorUpdateCount: searchRun() ? 0 : 1,
    error: searchRun() ? null : { status: 404 },
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useSearches', () => ({
  useSearches: () => ({
    data: [{ id: 'search_1', startedAt: '2026-08-29T09:00:00.000Z' }],
  }),
}));

vi.mock('@/hooks/api/useReplayOfRun', () => ({
  useReplayOfRun: () => ({
    data: replayOfRun(),
    isPending: replayOfRun() === undefined,
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useRunStream', () => ({ useRunStream: () => undefined }));
vi.mock('@/hooks/api/useRunMemories', () => ({
  runMemoryKeys: { forRun: () => ['run-memories'] },
  useRunMemories: () => ({
    data: { briefed: [], cut: [], recalled: [], proposed: [] },
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

vi.mock('@/hooks/api/useSendMessage', () => ({
  useSendMessage: () => ({ mutate: vi.fn(), isPending: false }),
}));

const answer = vi.fn();

vi.mock('@/hooks/api/useAnswerInboxItem', () => ({
  useAnswerInboxItem: () => ({ mutate: answer, isPending: false }),
}));

vi.mock('@/hooks/api/useStopRun', () => ({
  useStopRun: () => ({ mutate: vi.fn() }),
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
  working: false,
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
    runs.mockReturnValue([run()]);
    runsFailing.mockReturnValue(false);
    refetchRuns.mockReset();
    conversation.mockReturnValue(conversationOf());
    conversationFailing.mockReturnValue(false);
    refetchConversation.mockReset();
    journal.mockReturnValue([]);
    journalFailing.mockReturnValue(false);
    replayRun.mockReturnValue(undefined);
    replayRunMissing.mockReturnValue(true);
    replayOfRun.mockReturnValue(undefined);
    searchRun.mockReturnValue(undefined);
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

  describe('a replay run', () => {
    const replay = (over: Record<string, unknown> = {}) => ({
      ...run({ id: 'run_1', taskId: null, taskTitle: null }),
      original: {
        runId: 'run_original',
        taskId: 'task_1',
        title: 'Fix the queue',
      },
      spend: null,
      journals: [{ runId: 'run_1', attempt: 1, steps: [step], spans: [] }],
      briefing: '## Implementation\n\nDrain the stuck retry queues.',
      agent: { harness: 'claude-code', model: 'opus', effort: 'medium' },
      repositories: ['acme/worker'],
      ...over,
    });

    beforeEach(() => {
      runs.mockReturnValue([run({ id: 'run_2' })]);
      replayRun.mockReturnValue(replay());
      replayRunMissing.mockReturnValue(false);
      replayOfRun.mockReturnValue({
        replayId: 'replay_1',
        setId: 'set_1',
        setName: 'Queue fixes',
        lineId: 'line_1',
        stationId: 'station_3',
        candidate: {
          id: 'candidate_1',
          name: 'Shorter prompt',
          kind: 'proposed',
          fingerprint: 'abc',
          station: {},
          createdAt: '2026-08-29T09:00:00.000Z',
        },
        startedAsBaseline: false,
        isBaseline: false,
        state: 'running',
        entry: null,
      });
    });

    it('says which run it replays, and leads to it', () => {
      const { container } = renderRun();
      const banner = container.querySelector(
        '[data-slot="replay-run-banner"]',
      ) as HTMLElement;

      expect(
        within(banner).getByRole('link', { name: 'Fix the queue' }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/runs/run_original');
    });

    it('names its candidate and leads to its replay', () => {
      renderRun();

      expect(screen.getByText('Shorter prompt')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'a replay of Queue fixes' }),
      ).toHaveAttribute(
        'href',
        '/w/acme/team/team_1/lines/line_1/stations/station_3/replays/replay_1',
      );
    });

    it('shows its briefing and what it did, with a composer nobody can use', () => {
      renderRun();

      expect(
        screen.getByText(/Drain the stuck retry queues\./),
      ).toBeInTheDocument();
      expect(screen.getByText('queue-stats --all')).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', { name: 'Message the agent' }),
      ).toHaveAttribute('contenteditable', 'false');
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    });
  });

  it('shows the note of the station', () => {
    renderRun();

    expect(screen.getByText('Which queue should I drain?')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Say something to Implementation' }),
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

    it('says nothing of the kind while the run is still to start', () => {
      runs.mockReturnValue([run({ state: 'queued' })]);
      conversation.mockReturnValue(conversationOf({ notes: [] }));

      renderRun();

      expect(
        screen.getByText('Implementation is working…'),
      ).toBeInTheDocument();
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
      task: { id: 'task_1', running: false, awaitingReview: null },
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

    it('does not offer to send work back from a run at a station the task has left', () => {
      taskStation.mockReturnValue({
        ...idle,
        station: { ...idle.station, id: 'station_4' },
      });

      renderRun();

      expect(
        screen.getByRole('textbox', {
          name: 'Say something to Implementation',
        }),
      ).toBeInTheDocument();
    });

    it('only says something to the station while a run still works the task', () => {
      taskStation.mockReturnValue({
        ...idle,
        task: { ...idle.task, running: true },
      });

      renderRun();

      expect(
        screen.getByRole('textbox', {
          name: 'Say something to Implementation',
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
          status: 'asked' as const,
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
          name: 'Say something to Implementation',
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
        conversationOf({ working: true, notes: [asked, answered] }),
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

  describe('a search run', () => {
    beforeEach(() => {
      runs.mockReturnValue([run({ id: 'run_2' })]);
      searchRun.mockReturnValue({
        ...run({ id: 'run_1', taskId: null, taskTitle: null }),
        searchId: 'search_1',
        iteration: 2,
        agent: { harness: 'claude-code', model: 'opus', effort: null },
        failure: 'runner-lost',
        endedAt: '2026-08-29T10:00:00.000Z',
        spent: {
          spentCosts: [{ amount: 0.5, currency: 'USD' }],
          unpricedCalls: 1,
        },
        spend: null,
        journals: [{ runId: 'run_1', attempt: 1, steps: [step], spans: [] }],
        briefing: '# Searching for a better station',
      });
    });

    it('leaves which iteration it is to the breadcrumbs, and says how it failed at the end', () => {
      const { container } = renderRun();

      expect(
        container.querySelector('[data-slot="search-run-banner"]'),
      ).toBeNull();
      expect(screen.getByText('Runner lost (not scored).')).toBeInTheDocument();
    });

    it('shows the briefing of its agent, and a composer nobody can use', () => {
      renderRun();

      expect(
        screen.getByText(/Searching for a better station/),
      ).toBeInTheDocument();
      const composer = screen.getByRole('textbox', {
        name: 'Message the agent',
      });
      expect(composer).toHaveAttribute('contenteditable', 'false');
      expect(composer).toHaveAttribute(
        'aria-placeholder',
        'The agent runs autonomously. It can’t receive messages.',
      );
      expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    });
  });
});
