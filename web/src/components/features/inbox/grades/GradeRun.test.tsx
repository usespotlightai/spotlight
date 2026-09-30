import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GradeRun } from '@/components/features/inbox/grades/GradeRun';
import { runScoresOf } from '@/stories/fixtures/run-scores';

const scores = vi.fn();
const scoresFailing = vi.fn();
const scoresError = vi.fn();
const journal = vi.fn();
const journalFailing = vi.fn();
const mutate = vi.fn();
const gradeFailing = vi.fn();

vi.mock('@/hooks/api/useRunScores', () => ({
  useRunScores: () => ({
    data: scores(),
    isPending: scores() === undefined,
    errorUpdateCount: scoresFailing() ? 1 : 0,
    error: scoresError(),
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useTaskJournal', () => ({
  useTaskJournal: () => ({
    data: journal(),
    isPending: journal() === undefined,
    errorUpdateCount: journalFailing() ? 1 : 0,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/hooks/api/useGradeRun', () => ({
  useGradeRun: () => ({
    mutate,
    isPending: false,
    isError: gradeFailing(),
  }),
}));

const stepOf = (over: Record<string, unknown>) => ({
  kind: 'tool',
  status: 'completed',
  tool: null,
  detail: null,
  ms: 0,
  startedAt: '2026-09-30T10:00:00.000Z',
  locations: [],
  given: null,
  returned: null,
  change: null,
  text: '',
  ...over,
});

const JOURNAL = [
  {
    runId: 'run_1',
    attempt: 1,
    ms: null,
    spans: [],
    marks: {
      startedAt: null,
      readyAt: null,
      spokeFrom: null,
      spokeTo: null,
      endedAt: null,
    },
    spent: null,
    steps: [
      stepOf({
        tool: 'edit',
        text: 'retry.ts',
        change: {
          path: '/workspace/worker/retry.ts',
          before: 'a\n',
          after: 'b\n',
        },
      }),
      stepOf({ kind: 'said', text: 'Retries stop on a 410 now.' }),
    ],
  },
  {
    runId: 'run_0',
    attempt: 1,
    ms: null,
    spans: [],
    marks: {
      startedAt: null,
      readyAt: null,
      spokeFrom: null,
      spokeTo: null,
      endedAt: null,
    },
    spent: null,
    steps: [stepOf({ kind: 'said', text: 'An earlier run.' })],
  },
];

const showing = () =>
  render(
    <GradeRun
      slug="acme"
      teamId="team_1"
      taskId="task_1"
      runId="run_1"
      title="Drain the stuck retry queues"
      description={null}
    />,
  );

beforeEach(() => {
  scores.mockReturnValue(runScoresOf('run_1', 'task_1'));
  scoresFailing.mockReturnValue(false);
  scoresError.mockReturnValue(null);
  journal.mockReturnValue(JOURNAL);
  gradeFailing.mockReturnValue(false);
  journalFailing.mockReturnValue(false);
  mutate.mockClear();
});

describe('GradeRun', () => {
  it('shows the run’s summary and its changes, and never the judge’s score', () => {
    showing();

    expect(
      document.querySelector('[data-slot="run-summary"]'),
    ).toHaveTextContent('Retries stop on a 410 now.');
    expect(screen.getByText('1 file changed')).toBeInTheDocument();
    expect(screen.queryByText(/Judged/)).not.toBeInTheDocument();
  });

  it('grades the run yes or no in one click', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'No' }));

    expect(mutate).toHaveBeenCalledWith({
      slug: 'acme',
      teamId: 'team_1',
      runId: 'run_1',
      stationId: 'station_implementation',
      value: false,
    });
  });

  it('grades from 1 to 5 where the judge does', async () => {
    scores.mockReturnValue(runScoresOf('run_1', 'task_1', { kind: 'number' }));

    showing();
    await userEvent.click(screen.getByRole('button', { name: '4' }));

    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ value: 4 }));
  });

  it('marks the grade you gave, and lets you change it', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', {
        grades: [
          {
            by: 'user_1',
            mine: true,
            kind: 'yes-no',
            value: 1,
            label: 'yes',
            at: '2026-09-30T12:00:00.000Z',
          },
        ],
      }),
    );

    showing();

    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/You graded it yes/)).toBeInTheDocument();
  });

  it('says when a grade could not be saved', () => {
    gradeFailing.mockReturnValue(true);

    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your grade could not be saved.',
    );
  });

  it('holds its place while the run loads', () => {
    scores.mockReturnValue(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the run to grade' }),
    ).toBeInTheDocument();
  });

  it('offers to try again when the run could not load', () => {
    scores.mockReturnValue(undefined);
    scoresFailing.mockReturnValue(true);

    showing();

    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });

  it('tells someone off the team that only its members can grade the run', () => {
    scores.mockReturnValue(undefined);
    scoresFailing.mockReturnValue(true);
    scoresError.mockReturnValue({ statusCode: 404 });

    showing();

    expect(
      screen.getByText('Only the team’s members can grade this run'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Yes' }),
    ).not.toBeInTheDocument();
  });

  it('offers to try again when what the run did could not load', () => {
    journal.mockReturnValue(undefined);
    journalFailing.mockReturnValue(true);

    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'What the run did could not be loaded.',
    );
  });

  it('says so when the run changed no files', () => {
    journal.mockReturnValue([]);

    showing();

    expect(screen.getByText('It changed no files.')).toBeInTheDocument();
  });
});
