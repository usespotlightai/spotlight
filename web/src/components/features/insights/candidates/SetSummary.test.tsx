import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SetSummary } from '@/components/features/insights/candidates/SetSummary';
import { CANDIDATES } from '@/test/fixtures/insights-candidates';

const noisy = CANDIDATES.stations[0]?.sets[0];
const unchecked = CANDIDATES.stations[1]?.sets[0];

const warning = () =>
  document.querySelector('[data-slot="set-warning"]')?.textContent ?? null;

describe('SetSummary', () => {
  it('marks a problem with the set by a warning icon, names it and counts the rest', () => {
    render(<SetSummary set={noisy} />);

    expect(screen.getByText(/tasks replayed/)).toBeInTheDocument();
    expect(warning()).toBe('Noise: 13 pts, and 1 more');
    expect(
      screen.getByRole('img', { name: 'Replay set warnings' }),
    ).toBeInTheDocument();
    expect(document.body).toHaveTextContent(
      'Warnings: Noise: 13 pts, Judge agreeing with itself:',
    );
  });

  it('shows no warning where one repeat can tell the minimum real gain from chance', () => {
    render(
      <SetSummary
        set={{
          ...noisy,
          health: {
            ...noisy.health,
            noise: noisy.health.noise && {
              ...noisy.health.noise,
              noisyInOneRepeat: false,
            },
            judge: null,
          },
        }}
      />,
    );

    expect(warning()).toBeNull();
    expect(document.body).toHaveTextContent('Noise: 13 pts');
  });

  it('explains a single warning with its measurements', () => {
    render(
      <SetSummary
        set={{ ...noisy, health: { ...noisy.health, judge: null } }}
      />,
    );

    expect(warning()).toBe('Noise: 13 pts');
    expect(document.body).toHaveTextContent(
      /moved 13 pts between repeats\. If a search replays each run once, it can’t tell a \+\d+ pts gain from chance\..*Success per repeat: 50%, 58%, 63%/,
    );
  });

  it('shows no warning where checks have only not run yet', () => {
    render(<SetSummary set={unchecked} />);

    expect(screen.getByText(/tasks replayed/)).toBeInTheDocument();
    expect(warning()).toBeNull();
  });
});
