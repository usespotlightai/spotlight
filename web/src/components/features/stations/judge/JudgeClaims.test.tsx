import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { JudgeClaims } from '@/components/features/stations/judge/JudgeClaims';

const CLAIMS = ['Leaves the tests passing', 'Says what it could not do'];

describe('JudgeClaims', () => {
  it('lists the claims the judge marks, in order', () => {
    render(<JudgeClaims claims={CLAIMS} />);

    expect(
      screen.getAllByRole('listitem').map((each) => each.textContent),
    ).toEqual(CLAIMS);
  });
});
