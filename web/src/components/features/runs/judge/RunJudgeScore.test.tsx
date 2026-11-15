import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RunJudgeScore } from '@/components/features/runs/judge/RunJudgeScore';
import { runScoresOf } from '@/test/fixtures/run-scores';

const scores = vi.fn<(...args: unknown[]) => unknown>();
const scoresFailing = vi.fn();
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

vi.mock('@/hooks/api/useMembers', () => ({
  useMembers: () => ({
    data: [{ id: 'user_2', name: 'Priya Nair', image: null }],
  }),
}));

const GRADE = {
  by: 'user_1',
  mine: true,
  value: 2 / 3,
  claimResults: [true, true, false],
  passes: false,
  label: '2 of 3 claims met',
  at: '2026-09-30T12:00:00.000Z',
};

const showing = () => render(<RunJudgeScore teamId="team_1" runId="run_1" />);

beforeEach(() => {
  scores.mockReturnValue(runScoresOf('run_1', 'task_1'));
  scoresFailing.mockReturnValue(false);
  scoresError.mockReturnValue(null);
  refetch.mockClear();
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
    expect(
      document.querySelector('[data-slot="claim-verdict-scorers"]'),
    ).not.toBeInTheDocument();
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

  it('marks each claim by the judge and by the grade, opening only the claims they mark otherwise', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', {
        grades: [{ ...GRADE, by: 'user_2', mine: false }],
        outcome: { source: 'grade', passes: false },
        agrees: true,
      }),
    );
    showing();

    expect(
      document.querySelector('[data-slot="claim-verdict-scorers"]'),
    ).toHaveTextContent('JudgePriya');
    const claims = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="claim-verdict"]'),
    ];
    expect(
      claims.map((each) =>
        [...each.querySelectorAll('[data-slot="claim-mark"]')].map((mark) =>
          mark.getAttribute('aria-label'),
        ),
      ),
    ).toEqual([
      ['Judge: Not met', 'Priya: Met'],
      ['Judge: Met', 'Priya: Met'],
      ['Judge: Not met', 'Priya: Not met'],
    ]);
    expect(claims.map((each) => each.dataset.open === 'true')).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('greys out its See links when the page around it shows no steps or files', () => {
    showing();

    expect(screen.getByRole('button', { name: 'step 1' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
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

  it('gives each grade a row named by its grader, people first, then the judge', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', {
        grades: [GRADE, { ...GRADE, by: 'user_2', mine: false }],
        outcome: { source: 'grade', passes: false },
      }),
    );

    showing();

    const names = [...document.querySelectorAll('dt')].map(
      (each) => each.textContent,
    );
    expect(names).toEqual(['You', 'Priya Nair', 'Judge']);
    expect(
      screen.getByText('You', { selector: 'dt' }).nextSibling,
    ).toHaveTextContent('Failed');
    expect(screen.queryByText('2 of 3 claims met')).not.toBeInTheDocument();
    expect(screen.queryByText('People')).not.toBeInTheDocument();
  });

  it('keeps each grade’s claim count on hover while the judge is hidden', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', {
        judge: null,
        grades: [GRADE],
        outcome: { source: 'grade', passes: false },
      }),
    );

    showing();

    expect(
      document.querySelector('[data-slot="grade-verdict"]'),
    ).toHaveTextContent('Failed');
    expect(screen.getByText('2 of 3 claims met')).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="claim-verdicts"]'),
    ).not.toBeInTheDocument();
  });

  it.each([
    [{ source: 'accepted', passes: true }, 'Accepted'],
    [{ source: 'sent-back', passes: false }, 'Sent back'],
    [{ source: 'merged', passes: true }, 'Pull request merged'],
    [{ source: 'closed', passes: false }, 'Pull request closed'],
    [{ source: 'grade', passes: true }, 'Passed by people'],
    [{ source: 'grade', passes: false }, 'Failed by people'],
  ] as const)(
    'shows what people said of the run before the judge’s verdict: %o',
    (outcome, shown) => {
      scores.mockReturnValue(
        runScoresOf('run_1', 'task_1', { outcome, agrees: !outcome.passes }),
      );
      showing();

      const names = [...document.querySelectorAll('dt')].map(
        (each) => each.textContent,
      );
      expect(names).toEqual(['People', 'Judge']);
      expect(
        document.querySelector('[data-slot="run-outcome"]'),
      ).toHaveTextContent(shown);
    },
  );

  it('marks a verdict of the judge that people disagree with', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', {
        outcome: { source: 'accepted', passes: true },
        agrees: false,
      }),
    );
    showing();

    expect(
      screen.getByRole('img', { name: 'The judge disagrees with people' }),
    ).toBeInTheDocument();
  });

  it('shows no outcome and no mark where people said nothing yet', () => {
    showing();

    expect(screen.queryByText('People')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'The judge disagrees with people' }),
    ).not.toBeInTheDocument();
  });

  it('shows nothing for a run no judge checked', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', { judged: false, judge: null }),
    );

    const { container } = showing();

    expect(container).toBeEmptyDOMElement();
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
