import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JudgeClaims } from '@/components/features/stations/judge/JudgeClaims';

const CLAIMS = ['Leaves the tests passing', 'Says what it could not do'];

describe('JudgeClaims', () => {
  it('lists the claims the judge marks, in order', () => {
    render(<JudgeClaims claims={CLAIMS} passThreshold={1} />);

    expect(
      within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map((each) => each.textContent),
    ).toEqual(CLAIMS);
    expect(
      screen.getByText('A run passes when it meets every claim.'),
    ).toBeInTheDocument();
  });

  it('says what share of claims a run must meet when it is not all of them', () => {
    render(<JudgeClaims claims={CLAIMS} passThreshold={0.5} />);

    expect(
      screen.getByText(
        'A run passes when it meets at least 50% of its claims.',
      ),
    ).toBeInTheDocument();
  });
});
