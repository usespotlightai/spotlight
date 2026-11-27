import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RunJudgeScore } from '@/components/features/runs/judge/RunJudgeScore';
import { runScoresOf } from '@/test/fixtures/run-scores';

const scores = vi.fn<(...args: unknown[]) => unknown>();
const scoresFailing = vi.fn<() => boolean>();
const scoresError = vi.fn<(...args: unknown[]) => unknown>();
const refetch = vi.fn();

vi.mock('@/hooks/api/useRunScores', () => ({
  useRunScores: () => ({
    data: scores(),
    isPending: scores() === undefined,
    errorUpdateCount: scoresFailing() ? 1 : 0,
    error: scoresError(),
    isFetching: false,
    refetch,
  }),
}));

const record = vi.fn();
const clear = vi.fn();

vi.mock('@/hooks/api/useRunVerdict', () => ({
  useRecordRunVerdict: () => ({
    mutate: record,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
  useClearRunVerdict: () => ({
    mutate: clear,
    reset: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

const showing = () => render(<RunJudgeScore teamId="team_1" runId="run_1" />);

beforeEach(() => {
  scores.mockReturnValue(runScoresOf('run_1', 'task_1'));
  scoresFailing.mockReturnValue(false);
  scoresError.mockReturnValue(null);
  refetch.mockClear();
  record.mockClear();
  clear.mockClear();
});

describe('RunJudgeScore', () => {
  it('lists each claim with a bare mark, opening the reasons of the claims the judge did not find met', () => {
    showing();

    expect(
      document.querySelector('[data-slot="judge-verdict"]'),
    ).toHaveTextContent('Failed');
    const claims = within(screen.getByRole('list', { name: 'Claims' }))
      .getAllByRole('listitem')
      .filter((each) => each.dataset.slot === 'claim-verdict');
    expect(
      claims.map((each) =>
        each
          .querySelector('[data-slot="claim-mark"]')
          ?.getAttribute('aria-label'),
      ),
    ).toEqual(['Judge: Not met', 'Judge: Met', 'Judge: Not met']);
    expect(claims[2]).toHaveTextContent('3. The queue is drained');
    expect(claims.map((each) => each.dataset.open === 'true')).toEqual([
      true,
      false,
      true,
    ]);
    expect(
      screen
        .getByRole('list', { name: 'The judge’s reasons on claim 1' })
        .querySelectorAll('[data-slot="judge-reason"]'),
    ).toHaveLength(1);
  });

  it('opens and closes the reasons of a claim', async () => {
    showing();

    expect(
      document.querySelectorAll('[data-slot="judge-reason"]'),
    ).toHaveLength(2);

    await userEvent.click(
      screen.getByRole('button', { name: /Every other failure/ }),
    );

    expect(
      document.querySelectorAll('[data-slot="judge-reason"]'),
    ).toHaveLength(3);
  });

  it('greys out its See links when the page around it shows no steps or files', () => {
    showing();

    expect(
      screen.getByRole('button', { name: 'execute step' }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('button', { name: 'retry.ts:1' }),
    ).toHaveAccessibleDescription(
      'The file is no longer in the run’s changes.',
    );
  });

  it('keeps an unqualified judge’s verdict hidden, and says why', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', {
        judge: null,
        calibration: {
          qualified: false,
          agreement: 0.38,
          reading: 'fair',
          pairs: 24,
          minPairs: 10,
          minAgreement: 0.6,
          hiddenReason: 'below-min-agreement',
          failing: true,
        },
      }),
    );

    showing();

    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Judge verdicts are hidden. Cohen’s kappa: 0.38. Minimum required: 0.60.',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="judge-verdict"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Show/ }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['accepted', 'Accepted'],
    ['sent-back', 'Sent back'],
    ['merged', 'Pull request merged'],
    ['held-as-wrong', 'Held as wrong'],
  ] as const)(
    'shows people’s verdict on the run before the judge’s verdict: %s',
    (labelFrom, shown) => {
      scores.mockReturnValue(
        runScoresOf('run_1', 'task_1', {
          labelFrom,
          peoplePass: labelFrom === 'accepted' || labelFrom === 'merged',
          implicitFrom: labelFrom,
        }),
      );
      showing();

      const names = [...document.querySelectorAll('dt')].map(
        (each) => each.textContent,
      );
      expect(names).toEqual(['People', 'Judge']);
      expect(
        document.querySelector('[data-slot="run-label"]'),
      ).toHaveTextContent(shown);
    },
  );

  it('marks a verdict of the judge that people disagree with', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', {
        labelFrom: 'accepted',
        peoplePass: true,
        agrees: false,
      }),
    );
    showing();

    expect(
      screen.getByRole('img', { name: 'The judge disagrees with people' }),
    ).toBeInTheDocument();
  });

  it('shows no label and no mark where people said nothing yet', () => {
    showing();

    expect(
      document.querySelector('[data-slot="run-label"]'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('None yet')).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'The judge disagrees with people' }),
    ).not.toBeInTheDocument();
  });

  it('shows nothing for a run no judge checked that takes no verdict', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', {
        judged: false,
        judge: null,
        takesVerdict: false,
      }),
    );

    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });

  it('asks for people’s verdict on a run no judge checked, and says that it teaches the judge', async () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', { judged: false, judge: null }),
    );
    showing();

    expect(
      [...document.querySelectorAll('dt')].map((each) => each.textContent),
    ).toEqual(['People']);
    expect(
      screen.getByText(/Your verdict teaches this station’s judge/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Wrong' }));

    expect(record).toHaveBeenCalledWith({
      teamId: 'team_1',
      runId: 'run_1',
      right: false,
      reason: null,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Right' }));

    expect(record).toHaveBeenLastCalledWith({
      teamId: 'team_1',
      runId: 'run_1',
      right: true,
      reason: null,
    });
  });

  it('shows a recorded verdict, who gave it and what it takes the place of, and lets a person give a reason or clear it', async () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', {
        labelFrom: 'marked-wrong',
        peoplePass: false,
        implicitFrom: 'merged',
        personVerdict: {
          right: false,
          reason: null,
          by: 'user_ada',
          byName: 'Ada Lovelace',
          at: '2026-10-02T09:00:00.000Z',
        },
      }),
    );
    showing();

    expect(document.querySelector('[data-slot="run-label"]')).toHaveTextContent(
      'Failed · Marked wrong by Ada Lovelace',
    );
    expect(
      screen.getByText('In place of: Pull request merged'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wrong' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.type(
      screen.getByLabelText('What was wrong (optional)'),
      'It planned the change.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save reason' }));

    expect(record).toHaveBeenCalledWith({
      teamId: 'team_1',
      runId: 'run_1',
      right: false,
      reason: 'It planned the change.',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(clear).toHaveBeenCalledWith({ teamId: 'team_1', runId: 'run_1' });
  });

  it('shows nothing to someone off the team', () => {
    scores.mockReturnValue(undefined);
    scoresFailing.mockReturnValue(true);
    scoresError.mockReturnValue({ statusCode: 404 });

    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
  });

  it('keeps its place while the verdict loads, and offers to try again when it fails', async () => {
    scores.mockReturnValue(undefined);
    const { rerender } = showing();

    expect(
      screen.getByRole('status', { name: 'Loading the verdicts' }),
    ).toBeInTheDocument();

    scoresFailing.mockReturnValue(true);
    rerender(<RunJudgeScore teamId="team_1" runId="run_1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });
});
