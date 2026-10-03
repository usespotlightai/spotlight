import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClaimAgreements } from '@/components/features/stations/judge/ClaimAgreements';

describe('ClaimAgreements', () => {
  it('shows how often the judge agrees with people on each claim, naming claims it no longer knows by place', () => {
    render(
      <ClaimAgreements
        claims={['Leaves the tests passing']}
        agreements={[
          { index: 0, pairs: 12, observed: 0.75, kappa: 0.5 },
          { index: 1, pairs: 0, observed: null, kappa: null },
        ]}
      />,
    );

    const rows = within(
      screen.getByRole('table', { name: 'Agreement claim by claim' }),
    ).getAllByRole('row');

    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      'Leaves the tests passing0.5075%12',
      'Claim 2––0',
    ]);
  });
});
