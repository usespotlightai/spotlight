import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SetSummary } from '@/components/features/insights/candidates/SetSummary';
import type { CandidatesSet } from '@/lib/insights-candidates';
import { CANDIDATES } from '@/test/fixtures/insights-candidates';

const noisy = CANDIDATES.stations[0]?.sets[0] as CandidatesSet;
const unchecked = CANDIDATES.stations[1]?.sets[0] as CandidatesSet;

const warning = () =>
  document.querySelector('[data-slot="set-warning"]')?.textContent ?? null;

describe('SetSummary', () => {
  it('names the first problem with the set in words and counts the rest', () => {
    render(<SetSummary set={noisy} />);

    expect(screen.getByText(/tasks replayed/)).toBeInTheDocument();
    expect(warning()).toBe(
      'Noise: Success moved 13 pts between 3 repeats, and 1 more',
    );
  });

  it('shows no warning where checks have only not run yet', () => {
    render(<SetSummary set={unchecked} />);

    expect(screen.getByText(/tasks replayed/)).toBeInTheDocument();
    expect(warning()).toBeNull();
  });
});
