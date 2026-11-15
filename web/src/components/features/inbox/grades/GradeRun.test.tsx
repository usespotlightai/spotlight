import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GradeRun } from '@/components/features/inbox/grades/GradeRun';
import { runScoresOf } from '@/test/fixtures/run-scores';

const scores = vi.fn<(...args: unknown[]) => unknown>();
const scoresFailing = vi.fn();
const scoresError = vi.fn<(...args: unknown[]) => unknown>();
const mutate = vi.fn();
const gradePending = vi.fn<(...args: unknown[]) => unknown>();
const gradeFailed = vi.fn<(...args: unknown[]) => unknown>();

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

vi.mock('@/hooks/api/useGradeRun', () => ({
  useGradeRun: () => ({
    mutate,
    isPending: gradePending(),
    isError: gradeFailed(),
    error: gradeFailed() ? new Error('boom') : null,
  }),
}));

const SENT = {
  slug: 'acme',
  teamId: 'team_1',
  runId: 'run_1',
  stationId: 'station_implementation',
  claims: [true, false, true],
};

const showing = () =>
  render(<GradeRun slug="acme" teamId="team_1" runId="run_1" />);

const radio = (claim: string, choice: 'Yes' | 'No') =>
  within(screen.getByRole('radiogroup', { name: claim })).getByRole('radio', {
    name: choice,
  });

const answer = async (claim: string, choice: 'Yes' | 'No') =>
  userEvent.click(radio(claim, choice));

const gradedAs = (claimResults: boolean[]) => ({
  ...runScoresOf('run_1', 'task_1'),
  grades: [
    {
      by: 'user_1',
      mine: true,
      value: claimResults.filter(Boolean).length / claimResults.length,
      claimResults,
      passes: claimResults.every(Boolean),
      label: `${claimResults.filter(Boolean).length} of ${claimResults.length} claims met`,
      at: '2026-09-30T12:00:00.000Z',
    },
  ],
});

beforeEach(() => {
  scores.mockReturnValue(runScoresOf('run_1', 'task_1'));
  scoresFailing.mockReturnValue(false);
  scoresError.mockReturnValue(null);
  gradePending.mockReturnValue(false);
  gradeFailed.mockReturnValue(false);
  mutate.mockClear();
});

describe('GradeRun', () => {
  it('asks for a grade beside the run’s changes, and never shows the judge’s verdict', () => {
    showing();

    expect(
      screen.getByRole('region', { name: 'Grade this run' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Judged/)).not.toBeInTheDocument();
  });

  it('sends nothing when every claim is answered, and sends the answers on Save grade', async () => {
    showing();

    await answer('Retries stop on a 410 Gone', 'Yes');
    await answer('Every other failure is retried later', 'No');
    await answer('The queue is drained', 'Yes');
    expect(mutate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Save grade' }));

    expect(mutate).toHaveBeenCalledWith(SENT);
  });

  it('says to answer every claim while a claim has no answer', async () => {
    showing();

    await answer('Retries stop on a 410 Gone', 'Yes');

    const save = screen.getByRole('button', { name: 'Save grade' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription('Answer every claim to save');
  });

  it('waits for your grade in the title, and asks about each claim once', () => {
    showing();

    expect(
      screen.getByRole('heading', { name: 'Waiting for your grade' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Does the run meet each claim?')).toHaveLength(
      1,
    );
    expect(
      screen.getByRole('list', { name: 'Does the run meet each claim?' }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="earlier-claims"]'),
    ).not.toBeInTheDocument();
  });

  it('says you graded the run, and on which day, once the grade is saved', () => {
    scores.mockReturnValue({
      ...runScoresOf('run_1', 'task_1'),
      grades: [
        {
          by: 'user_1',
          mine: true,
          value: 1,
          claimResults: [true, true, true],
          passes: true,
          label: '3 of 3 claims met',
          at: '2026-11-15T12:00:00.000Z',
        },
      ],
    });

    showing();

    expect(
      screen.getByRole('heading', { name: 'Graded by you' }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="grade-saving"]'),
    ).toHaveTextContent(/15/);
  });

  it('notes a run that ran on earlier claims beside the title', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', { earlierClaims: true }),
    );

    showing();

    expect(
      document.querySelector('[data-slot="earlier-claims"]'),
    ).toBeInTheDocument();
  });

  it('keeps the answers and Save grade after a failed save, with no inline error', async () => {
    gradeFailed.mockReturnValue(true);

    showing();
    await answer('Retries stop on a 410 Gone', 'Yes');
    await answer('Every other failure is retried later', 'No');
    await answer('The queue is drained', 'Yes');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(radio('The queue is drained', 'Yes')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Save grade' })).toBeEnabled();
  });

  it('sends the same answers again on Save grade after a failed save', async () => {
    gradeFailed.mockReturnValue(true);

    showing();
    await answer('Retries stop on a 410 Gone', 'Yes');
    await answer('Every other failure is retried later', 'No');
    await answer('The queue is drained', 'Yes');
    await userEvent.click(screen.getByRole('button', { name: 'Save grade' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save grade' }));

    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate).toHaveBeenNthCalledWith(1, SENT);
    expect(mutate).toHaveBeenNthCalledWith(2, SENT);
  });

  it('says the run cannot be graded when its station has no judge with claims', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', { gradable: false, claims: [] }),
    );

    showing();

    expect(
      screen.getByText(
        'This run cannot be graded. Its station has no judge with claims.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: 'Yes' }),
    ).not.toBeInTheDocument();
  });

  it('keeps Save grade off until an answer differs from the saved grade', async () => {
    scores.mockReturnValue(gradedAs([true, true, false]));

    showing();

    const save = screen.getByRole('button', { name: 'Save grade' });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription('Change an answer to save again');

    await answer('The queue is drained', 'Yes');

    expect(screen.getByRole('button', { name: 'Save grade' })).toBeEnabled();
    expect(mutate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Save grade' }));
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ claims: [true, true, true] }),
    );
  });

  it('starts from the claims you marked before', () => {
    scores.mockReturnValue(gradedAs([true, true, false]));

    showing();

    expect(radio('The queue is drained', 'No')).toBeChecked();
    expect(screen.queryByText(/You graded it/)).not.toBeInTheDocument();
  });

  it('says it is saving beside the card’s title while a grade saves', () => {
    gradePending.mockReturnValue(true);

    showing();

    const saving = screen.getByText('Saving…');
    expect(saving).toHaveAttribute('role', 'status');
    expect(saving.parentElement).toContainElement(
      screen.getByRole('heading', { name: 'Waiting for your grade' }),
    );
  });

  it('keeps its place while the run loads', () => {
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
      screen.getByText('Only team members can grade this run'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', { name: 'Yes' }),
    ).not.toBeInTheDocument();
  });
});
