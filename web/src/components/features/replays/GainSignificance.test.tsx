import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GainSignificance } from '@/components/features/replays/GainSignificance';
import type { GainEstimate } from '@/lib/replay';

const reading = (over: Partial<GainEstimate>): GainEstimate => ({
  gain: 0.12,
  low: 0.03,
  high: 0.21,
  significance: 'better',
  minGain: 0.05,
  tasks: 20,
  ...over,
});

const significanceOf = (container: HTMLElement) =>
  container.querySelector('[data-slot="gain-significance"]');

const wordOf = (container: HTMLElement) =>
  container.querySelector('[data-slot="gain-significance-word"]');

describe('GainSignificance', () => {
  it('shows a real gain with its range, against what it is compared with', () => {
    const { container } = render(
      <GainSignificance gain={reading({})} against="baseline 50%" />,
    );

    expect(significanceOf(container)).toHaveAttribute(
      'data-significance',
      'better',
    );
    expect(significanceOf(container)).toHaveTextContent(
      '+12 pts(+3 to +21)vs baseline 50%· Better',
    );
    expect(wordOf(container)).toHaveAccessibleDescription(
      'The gain on 20 tasks with a score on both sides is real. The likely range stays above zero and reaches the minimum. Minimum real gain: +5 pts',
    );
  });

  it('says a change that could be chance is within noise', () => {
    const { container } = render(
      <GainSignificance
        gain={reading({
          gain: 0.04,
          low: -0.08,
          high: 0.15,
          significance: 'within-noise',
        })}
      />,
    );

    expect(significanceOf(container)).toHaveTextContent(
      '+4 pts(−8 to +15)· within noise',
    );
    expect(wordOf(container)).toHaveAccessibleDescription(/can be chance/);
  });

  it('says a real loss is worse', () => {
    const { container } = render(
      <GainSignificance
        gain={reading({
          gain: -0.2,
          low: -0.3,
          high: -0.1,
          significance: 'worse',
        })}
      />,
    );

    expect(significanceOf(container)).toHaveTextContent(
      '−20 pts(−30 to −10)· Worse',
    );
  });
});
