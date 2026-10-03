import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GainVerdict } from '@/components/features/replays/GainVerdict';
import type { GainReading } from '@/lib/replay';

const reading = (over: Partial<GainReading>): GainReading => ({
  gain: 0.12,
  low: 0.03,
  high: 0.21,
  verdict: 'better',
  minGain: 0.05,
  tasks: 20,
  ...over,
});

const verdictOf = (container: HTMLElement) =>
  container.querySelector('[data-slot="gain-verdict"]');

const wordOf = (container: HTMLElement) =>
  container.querySelector('[data-slot="gain-verdict-word"]');

describe('GainVerdict', () => {
  it('shows a real gain with its range, against what it is compared with', () => {
    const { container } = render(
      <GainVerdict gain={reading({})} against="baseline 50%" />,
    );

    expect(verdictOf(container)).toHaveAttribute('data-verdict', 'better');
    expect(verdictOf(container)).toHaveTextContent(
      '+12 pts(+3 to +21)vs baseline 50%· Better',
    );
    expect(wordOf(container)).toHaveAccessibleDescription(
      'A real gain over 20 tasks both scored: its likely range stays above no change, and it reaches the +5 pts the line counts as real.',
    );
  });

  it('says a change that could be chance is within noise', () => {
    const { container } = render(
      <GainVerdict
        gain={reading({
          gain: 0.04,
          low: -0.08,
          high: 0.15,
          verdict: 'within-noise',
        })}
      />,
    );

    expect(verdictOf(container)).toHaveTextContent(
      '+4 pts(−8 to +15)· Within noise',
    );
    expect(wordOf(container)).toHaveAccessibleDescription(/^Could be chance/);
  });

  it('says a real loss is worse', () => {
    const { container } = render(
      <GainVerdict
        gain={reading({ gain: -0.2, low: -0.3, high: -0.1, verdict: 'worse' })}
      />,
    );

    expect(verdictOf(container)).toHaveTextContent(
      '−20 pts(−30 to −10)· Worse',
    );
  });
});
