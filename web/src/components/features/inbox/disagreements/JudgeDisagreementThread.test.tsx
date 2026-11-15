import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JudgeDisagreementThread } from '@/components/features/inbox/disagreements/JudgeDisagreementThread';
import { failedDisagreementOf } from '@/test/fixtures/judge-disagreement';

const disagreement = vi.fn<() => unknown>();
const disagreementError = vi.fn<() => unknown>();

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
  RunThread: ({ runId, after }: { runId: string; after: unknown }) => (
    <div>
      <p>The thread of run {runId}</p>
      {after as never}
    </div>
  ),
}));

vi.mock(
  '@/components/features/inbox/disagreements/JudgeDisagreementItem',
  () => ({
    JudgeDisagreementItem: () => <p>The question</p>,
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
});

describe('JudgeDisagreementThread', () => {
  it('asks the question under the run the judge disagreed on', () => {
    showing();

    expect(screen.getByText('The thread of run run_1')).toBeInTheDocument();
    expect(screen.getByText('The question')).toBeInTheDocument();
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
