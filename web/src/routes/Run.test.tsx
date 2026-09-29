import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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

const standing = vi.fn((): Record<string, unknown> => ({}));

vi.mock('@/hooks/api/useTaskStation', () => ({
  useTaskStation: () => standing(),
}));

vi.mock('@/hooks/api/useSayToRun', () => ({
  useSayToRun: () => ({ mutate: vi.fn(), isPending: false }),
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

vi.mock('@/hooks/api/useUploadAttachment', () => ({
  useUploadAttachment: () => ({ mutateAsync: vi.fn() }),
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

const said = (over: Record<string, unknown> = {}) => ({
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
  given: null,
  returned: null,
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
    standing.mockReturnValue({});
    runs.mockReturnValue([run()]);
    runsFailing.mockReturnValue(false);
    refetchRuns.mockReset();
    conversation.mockReturnValue(said());
    conversationFailing.mockReturnValue(false);
    refetchConversation.mockReset();
    journal.mockReturnValue([]);
    journalFailing.mockReturnValue(false);
  });

  describe('while it loads', () => {
    it('holds the shape of the run rather than calling it gone', () => {
      runs.mockReturnValue(undefined);

      renderRun();

      expect(
        screen.getByRole('status', { name: 'Loading the run' }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/no such run/)).not.toBeInTheDocument();
    });

    it('waits for what was said, so the footer does not change under the reader', () => {
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

    it('tries the runs again when asked', async () => {
      runs.mockReturnValue(undefined);
      runsFailing.mockReturnValue(true);

      renderRun();

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(refetchRuns).toHaveBeenCalledTimes(1);
    });

    it('tries what was said again when only that is missing', async () => {
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
      conversation.mockReturnValue(said({ notes: [] }));
      journal.mockReturnValue(undefined);
      journalFailing.mockReturnValue(true);

      renderRun();

      expect(
        screen.queryByText(/before any work was done/),
      ).not.toBeInTheDocument();
    });
  });

  it('says there is no such run beneath a bar of its own', () => {
    runs.mockReturnValue([run({ id: 'run_2' })]);

    const { container } = renderRun();

    expect(container.querySelector('header')).toBeInTheDocument();
    expect(
      screen.getByText('There is no such run for this team.'),
    ).toBeInTheDocument();
  });

  it('shows what the station said', () => {
    renderRun();

    expect(screen.getByText('Which queue should I drain?')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Say something to Implementation' }),
    ).toBeInTheDocument();
  });

  describe('when nothing was done', () => {
    it('says the run failed before any work was done, and leads to the task', () => {
      runs.mockReturnValue([run({ state: 'failed' })]);
      conversation.mockReturnValue(said({ notes: [] }));

      renderRun();

      expect(
        screen.getByText('This run failed before any work was done.'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Open the task' }),
      ).toHaveAttribute('href', '/w/acme/team/team_1/tasks/task_1');
    });

    it('says nothing of the kind while the run is still to start', () => {
      runs.mockReturnValue([run({ state: 'queued' })]);
      conversation.mockReturnValue(said({ notes: [] }));

      renderRun();

      expect(
        screen.getByText('Implementation is working…'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/before any work was done/),
      ).not.toBeInTheDocument();
    });

    it('says nothing of the kind once the run has done something', () => {
      conversation.mockReturnValue(said({ notes: [] }));
      journal.mockReturnValue([
        { runId: 'run_1', attempt: 1, steps: [step], spans: [] },
      ]);

      renderRun();

      expect(screen.getByText('queue-stats --all')).toBeInTheDocument();
      expect(
        screen.queryByText(/before any work was done/),
      ).not.toBeInTheDocument();
    });
  });

  describe('once the task stands idle at the station', () => {
    const idle = {
      station: { id: 'station_3', harness: 'claude-code', kind: 'work' },
      task: { id: 'task_1', running: false, awaitingReview: null },
    };

    it('offers to send the work back to the station, which starts it again', () => {
      standing.mockReturnValue(idle);

      renderRun();

      expect(
        screen.getByRole('textbox', {
          name: 'Send it back to Implementation',
        }),
      ).toHaveAttribute(
        'placeholder',
        'Say what to change, and Implementation starts again…',
      );
    });

    it('does not offer to send work back from a run at a station the task has left', () => {
      standing.mockReturnValue({
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
      standing.mockReturnValue({
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
    const OWED = { state: 'owed', conversationId: 'task_1:0' };

    it('says it is waiting for you where it paused, and leads to where to answer', () => {
      runs.mockReturnValue([run({ state: 'waiting', review: OWED })]);

      const { container } = renderRun();

      expect(
        container.querySelector('[data-slot="run-waiting"]'),
      ).toHaveTextContent('Waiting for you');
      expect(
        screen.getByRole('link', { name: 'Answer in the inbox' }),
      ).toHaveAttribute('href', '/w/acme/inbox/task_1%3A0?run=run_1');
    });

    it('does not claim the agent is working, nor offer to stop it', () => {
      runs.mockReturnValue([run({ state: 'waiting', review: OWED })]);

      renderRun();

      expect(
        screen.queryByText('Implementation is working…'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Stop' }),
      ).not.toBeInTheDocument();
    });

    it('offers to answer the question right here, so the run carries on', () => {
      runs.mockReturnValue([run({ state: 'waiting', review: OWED })]);

      renderRun();

      expect(
        screen.getByRole('textbox', { name: 'Answer Implementation' }),
      ).toHaveAttribute(
        'placeholder',
        'Answer the question, and the run carries on…',
      );
    });

    it('leaves an approval to be decided in the inbox, rather than answered here', () => {
      runs.mockReturnValue([run({ state: 'waiting', review: OWED })]);
      const approval = said().notes.map((note) => ({
        ...note,
        form: 'approval',
      }));
      conversation.mockReturnValue(said({ notes: approval }));

      renderRun();

      expect(
        screen.getByRole('link', { name: 'Approve or deny in the inbox' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('textbox', {
          name: 'Say something to Implementation',
        }),
      ).toBeInTheDocument();
    });

    it('still waits for you once it is parked, pointing at the inbox without a conversation to name', () => {
      runs.mockReturnValue([run({ state: 'parked' })]);

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
      conversation.mockReturnValue(said({ notes: [] }));

      renderRun();

      expect(
        screen.queryByText(/before any work was done/),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Waiting for you')).toBeInTheDocument();
    });

    it('catches up on its work once it goes back to it', () => {
      const client = new QueryClient();
      const invalidated = vi.spyOn(client, 'invalidateQueries');
      runs.mockReturnValue([run({ state: 'waiting', review: OWED })]);

      const { rerender } = renderRun(client);
      invalidated.mockClear();

      runs.mockReturnValue([run({ state: 'claimed', review: OWED })]);
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
    const asked = said().notes[0];
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
        said({ working: true, notes: [asked, answered] }),
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
