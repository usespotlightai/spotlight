import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunJudgeScore } from '@/components/features/runs/judge/RunJudgeScore';
import { ChangesPanelContext } from '@/lib/changes-panel';
import { StepAnchorsContext } from '@/lib/step-anchors';
import { claimsScoresOf, runScoresOf } from '@/stories/fixtures/run-scores';

const scores = vi.fn();
const scoresFailing = vi.fn();
const scoresError = vi.fn();
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

const FILE = {
  path: '/workspace/worker/services/retry.ts',
  before: 'a\n',
  after: 'b\n',
};

const open = vi.fn();

const showing = () =>
  render(
    <ChangesPanelContext
      value={{ selected: null, lines: null, open, close: () => {} }}
    >
      <RunJudgeScore teamId="team_1" runId="run_1" files={[FILE]} />
    </ChangesPanelContext>,
  );

beforeEach(() => {
  scores.mockReturnValue(runScoresOf('run_1', 'task_1'));
  scoresFailing.mockReturnValue(false);
  scoresError.mockReturnValue(null);
  open.mockClear();
  refetch.mockClear();
});

describe('RunJudgeScore', () => {
  it('lists each claim a claims judge marked, met or not in words, with its reasons under it', () => {
    scores.mockReturnValue(claimsScoresOf('run_1', 'task_1'));

    showing();

    expect(
      document.querySelector('[data-slot="judge-verdict"]'),
    ).toHaveTextContent('1 of 3 claims met');
    const claims = within(screen.getByRole('list', { name: 'Claims' }))
      .getAllByRole('listitem')
      .filter((each) => each.dataset.slot === 'claim-verdict');
    expect(
      claims.map(
        (each) => each.querySelector('[data-slot="claim-mark"]')?.textContent,
      ),
    ).toEqual(['Not met', 'Met', 'Not met']);
    expect(claims[2]).toHaveTextContent('Claim 3');
    expect(
      screen
        .getByRole('list', { name: 'Why, on Retries stop on a 410 Gone' })
        .querySelectorAll('[data-slot="judge-reason"]'),
    ).toHaveLength(1);
    expect(screen.queryByRole('list', { name: 'Why' })).not.toBeInTheDocument();
  });

  it('shows a trusted judge’s score and each reason it gave', () => {
    showing();

    expect(
      document.querySelector('[data-slot="judge-verdict"]'),
    ).toHaveTextContent('No');
    expect(
      document.querySelectorAll('[data-slot="judge-reason"]'),
    ).toHaveLength(2);
  });

  it('shows the journal step a reason cites', async () => {
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Step 1' }));

    expect(
      document.querySelector('[data-slot="cited-step"]'),
    ).toHaveTextContent('queue-drain webhook-retries');
  });

  it('opens the changed file a reason’s hunk sits in, at the hunk’s lines', async () => {
    showing();

    await userEvent.click(
      screen.getByRole('button', { name: 'retry.ts @@ -1,3 +1,4 @@' }),
    );

    expect(open).toHaveBeenCalledWith(FILE, { start: 1, end: 4 });
  });

  it('scrolls to the journal step a reason cites where the run page shows it', async () => {
    const focus = vi.fn();

    render(
      <StepAnchorsContext
        value={{
          focused: null,
          anchorOf: () => null,
          holds: () => true,
          focus,
        }}
      >
        <RunJudgeScore teamId="team_1" runId="run_1" files={[FILE]} />
      </StepAnchorsContext>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Step 1' }));

    expect(focus).toHaveBeenCalledWith(1);
    expect(
      document.querySelector('[data-slot="cited-step"]'),
    ).not.toBeInTheDocument();
  });

  it('keeps an untrusted judge’s score hidden, and says why', () => {
    scores.mockReturnValue(
      runScoresOf('run_1', 'task_1', {
        judge: null,
        standing: {
          trusted: false,
          measure: 'kappa',
          agreement: 0.38,
          pairs: 24,
          trust: 0.6,
          hiddenBecause: 'below-trust',
        },
      }),
    );

    showing();

    expect(screen.getByText('score hidden')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Hidden: Cohen’s kappa is 0.38, below the 0.60 it needs.',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="judge-verdict"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Show/ }),
    ).not.toBeInTheDocument();
  });

  it('says what people graded the run', () => {
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

    expect(screen.getByText(/People said Yes \(you\)/)).toBeInTheDocument();
  });

  it('shows nothing for a run no judge scored', () => {
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

  it('holds its place while the score loads, and offers to try again when it fails', async () => {
    scores.mockReturnValue(undefined);
    const { rerender } = showing();

    expect(
      screen.getByRole('status', { name: 'Loading the judge’s score' }),
    ).toBeInTheDocument();

    scoresFailing.mockReturnValue(true);
    rerender(
      <ChangesPanelContext
        value={{ selected: null, lines: null, open, close: () => {} }}
      >
        <RunJudgeScore teamId="team_1" runId="run_1" files={[FILE]} />
      </ChangesPanelContext>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });
});
