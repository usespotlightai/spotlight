import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GradeRun } from '@/components/features/inbox/grades/GradeRun';
import {
  claimsScoresOf,
  RUBRIC,
  runScoresOf,
} from '@/stories/fixtures/run-scores';

const scores = vi.fn();
const scoresFailing = vi.fn();
const scoresError = vi.fn();
const mutate = vi.fn();
const gradeFailing = vi.fn();
const gradePending = vi.fn();

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
    isError: gradeFailing(),
  }),
}));

const showing = () =>
  render(<GradeRun slug="acme" teamId="team_1" runId="run_1" />);

beforeEach(() => {
  scores.mockReturnValue(runScoresOf('run_1', 'task_1'));
  scoresFailing.mockReturnValue(false);
  scoresError.mockReturnValue(null);
  gradeFailing.mockReturnValue(false);
  gradePending.mockReturnValue(false);
  mutate.mockClear();
});

describe('GradeRun', () => {
  it('asks for a grade beside the run’s changes, and never shows the judge’s score', () => {
    showing();

    expect(
      screen.getByRole('region', { name: 'Grade this run' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Judged/)).not.toBeInTheDocument();
  });

  it('shows the rubric the judge scored by, under a title asking whether the run meets it', () => {
    showing();

    expect(
      within(screen.getByRole('region', { name: 'Rubric' })).getByText(RUBRIC),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Does this run meet the rubric?' }),
    ).toBeInTheDocument();
  });

  it('asks whether it is a good run where there is no rubric to grade by', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', { rubricBody: null }),
    );

    showing();

    expect(
      screen.queryByRole('region', { name: 'Rubric' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Is this a good run?' }),
    ).toBeInTheDocument();
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

  it('grades a claims judge’s run claim by claim, saving as soon as every claim is answered', async () => {
    scores.mockReturnValue(claimsScoresOf('run_1', 'task_1'));

    showing();

    const answer = async (claim: string, said: 'Yes' | 'No') =>
      userEvent.click(
        within(screen.getByRole('group', { name: claim })).getByRole('button', {
          name: said,
        }),
      );
    await answer('Retries stop on a 410 Gone', 'Yes');
    await answer('Every other failure is retried later', 'No');
    expect(mutate).not.toHaveBeenCalled();
    await answer('The queue is drained', 'Yes');

    expect(mutate).toHaveBeenCalledWith({
      slug: 'acme',
      teamId: 'team_1',
      runId: 'run_1',
      stationId: 'station_implementation',
      claims: [true, false, true],
    });
  });

  it('asks about each claim once, as the title, over the rubric', () => {
    scores.mockReturnValue(claimsScoresOf('run_1', 'task_1'));

    showing();

    expect(screen.getAllByText('Does the run meet each claim?')).toHaveLength(
      1,
    );
    expect(
      screen.getByRole('heading', {
        name: 'Does the run meet each claim?',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Rubric' })).getByText(RUBRIC),
    ).toBeInTheDocument();
  });

  it('saves again as soon as you change an answer', async () => {
    scores.mockReturnValue({
      ...claimsScoresOf('run_1', 'task_1'),
      grades: [
        {
          by: 'user_1',
          mine: true,
          kind: 'claims',
          value: 2 / 3,
          marks: [true, true, false],
          label: '67% of claims met',
          at: '2026-09-30T12:00:00.000Z',
        },
      ],
    });

    showing();
    await userEvent.click(
      within(
        screen.getByRole('group', { name: 'The queue is drained' }),
      ).getByRole('button', { name: 'Yes' }),
    );

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ claims: [true, true, true] }),
    );
    expect(
      screen.queryByRole('button', { name: 'Save grade' }),
    ).not.toBeInTheDocument();
  });

  it('starts from the claims you marked before', () => {
    scores.mockReturnValue({
      ...claimsScoresOf('run_1', 'task_1'),
      grades: [
        {
          by: 'user_1',
          mine: true,
          kind: 'claims',
          value: 2 / 3,
          marks: [true, true, false],
          label: '67% of claims met',
          at: '2026-09-30T12:00:00.000Z',
        },
      ],
    });

    showing();

    expect(
      within(
        screen.getByRole('group', { name: 'The queue is drained' }),
      ).getByRole('button', { name: 'No' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/You graded it/)).not.toBeInTheDocument();
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
            marks: null,
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
    expect(screen.queryByText(/You graded it/)).not.toBeInTheDocument();
  });

  it('says it is saving beside the card’s title while a grade saves', () => {
    gradePending.mockReturnValue(true);

    showing();

    const saving = screen.getByRole('status');
    expect(saving).toHaveTextContent('Saving…');
    expect(saving.parentElement).toContainElement(
      screen.getByRole('heading', {
        name: 'Does this run meet the rubric?',
      }),
    );
  });

  it('says beside the card’s title when a grade could not be saved', () => {
    gradeFailing.mockReturnValue(true);

    showing();

    const failed = screen.getByRole('alert');
    expect(failed).toHaveTextContent('Your grade could not be saved.');
    expect(failed.parentElement).toContainElement(
      screen.getByRole('heading', {
        name: 'Does this run meet the rubric?',
      }),
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
      screen.getByText(
        'You’re no longer on this team, so you can’t grade this run',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Yes' }),
    ).not.toBeInTheDocument();
  });
});
