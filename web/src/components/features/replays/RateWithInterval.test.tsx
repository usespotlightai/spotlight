import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RateWithInterval } from '@/components/features/replays/RateWithInterval';

describe('RateWithInterval', () => {
  it('shows a rate with its likely range', () => {
    const { container } = render(
      <RateWithInterval
        rate={0.62}
        interval={{ rate: 0.62, low: 0.48, high: 0.75 }}
      />,
    );

    expect(
      container.querySelector('[data-slot="rate-with-interval"]'),
    ).toHaveTextContent('62% (48–75%)');
    expect(
      container.querySelector('[data-slot="rate-interval"]'),
    ).toHaveAccessibleDescription(/^The likely range/);
  });

  it('leaves the range out where there is none, and a dash for no rate', () => {
    const { container, rerender } = render(
      <RateWithInterval rate={0.5} interval={null} />,
    );

    expect(container).toHaveTextContent(/^50%$/);
    expect(container.querySelector('[data-slot="rate-interval"]')).toBeNull();

    rerender(
      <RateWithInterval
        rate={null}
        interval={{ rate: 0.5, low: 0.4, high: 0.6 }}
      />,
    );

    expect(container).toHaveTextContent(/^–$/);
  });
});
