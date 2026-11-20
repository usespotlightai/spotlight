import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JudgeDisagreementThread } from '@/components/features/inbox/disagreements/JudgeDisagreementThread';
import { failedDisagreementOf } from '@/test/fixtures/judge-disagreement';

const disagreement = vi.fn<() => unknown>();
const disagreementError = vi.fn<() => unknown>();
const scoresPending = vi.fn<() => boolean>();

vi.mock('@/hooks/api/useRunScores', () => ({
  useRunScores: () => ({
    data: scoresPending() ? undefined : { claims: [] },
    isPending: scoresPending(),
    errorUpdateCount: 0,
  }),
}));

vi.mock('@/hooks/api/useJudgeDisagreement', () => ({
  useJudgeDisagreement: () => ({
    data: disagreement(),
    isPending: disagreement() === undefined && disagreementError() === null,
    errorUpdateCount: disagreementError() === null ? 0 : 1,
    error: disagreementError(),
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/components/features/inbox/RunThread', () => ({
  RunThread: ({
    runId,
    after,
    docked,
    pending,
  }: {
    runId: string;
    after: unknown;
    docked: { id: string; label: string; content: unknown }[];
    pending?: boolean;
  }) => (
    <div>
      <p>The thread of run {runId}</p>
      {pending && <p>Waiting for the judge</p>}
      {after as never}
      <ol aria-label="Tray">
        {docked.map((page) => (
          <li key={page.id} aria-label={page.label}>
            {page.content as never}
          </li>
        ))}
      </ol>
    </div>
  ),
}));

vi.mock(
  '@/components/features/inbox/disagreements/JudgeDisagreementItem',
  () => ({
    JudgeDisagreementItem: ({ claim }: { claim?: number }) => (
      <p>{claim === undefined ? 'The question' : `Claim ${claim + 1} only`}</p>
    ),
  }),
);

vi.mock('@/components/shell/layout/Breadcrumbs', () => ({
  Breadcrumbs: () => null,
}));

vi.mock('@/components/shell/layout/PageHeader', () => ({
  PageHeader: () => null,
}));

const showing = () =>
  render(
    <JudgeDisagreementThread
      slug="acme"
      teamId="team_1"
      disagreementId="disagreement_1"
      trail={[]}
    />,
  );

beforeEach(() => {
  disagreement.mockReturnValue(failedDisagreementOf());
  disagreementError.mockReturnValue(null);
  scoresPending.mockReturnValue(false);
});

describe('JudgeDisagreementThread', () => {
  it('asks the question under the run the judge disagreed on', () => {
    showing();

    expect(screen.getByText('The thread of run run_1')).toBeInTheDocument();
    expect(screen.getByText('The question')).toBeInTheDocument();
  });

  it('keeps the thread waiting until the judge’s reasons load', () => {
    scoresPending.mockReturnValue(true);

    showing();

    expect(screen.getByText('Waiting for the judge')).toBeInTheDocument();
  });

  it('gives each disputed claim its own page in the tray', () => {
    showing();

    expect(
      within(
        screen.getByRole('listitem', { name: 'Disagreement on claim 1' }),
      ).getByText('Claim 1 only'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('listitem', { name: 'Disagreement on claim 3' }),
      ).getByText('Claim 3 only'),
    ).toBeInTheDocument();
  });

  it('takes an answered claim out of the tray', () => {
    disagreement.mockReturnValue(
      failedDisagreementOf({
        answers: [
          {
            claim: 0,
            answer: 'judge-right',
            note: null,
            answeredBy: 'user_sam',
            answeredAt: new Date().toISOString(),
          },
        ],
      }),
    );
    showing();

    expect(
      within(screen.getByRole('list', { name: 'Tray' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(1);
    expect(screen.getByText('Claim 3 only')).toBeInTheDocument();
  });

  it('keeps the shape of the thread while the question loads', () => {
    disagreement.mockReturnValue(undefined);
    showing();

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('says only team members can answer, to someone off the team', () => {
    disagreement.mockReturnValue(undefined);
    disagreementError.mockReturnValue({ status: 404 });
    showing();

    expect(
      screen.getByText('You cannot see this question'),
    ).toBeInTheDocument();
  });

  it('offers to try again when the question does not load', () => {
    disagreement.mockReturnValue(undefined);
    disagreementError.mockReturnValue({ status: 500 });
    showing();

    expect(
      screen.getByRole('button', { name: /Try again/ }),
    ).toBeInTheDocument();
  });
});
