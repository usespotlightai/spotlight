import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StationIcon } from '@/components/features/board/column/StationIcon';

const drawn = (share: number) => {
  const { container } = render(<StationIcon share={share} />);
  return container.querySelector('[data-slot="station-icon"]');
};

describe('StationIcon', () => {
  it('draws the ring even with nothing filled', () => {
    const icon = drawn(0);

    expect(icon?.querySelectorAll('circle')).toHaveLength(1);
    expect(icon?.querySelector('path')).toBeNull();
  });

  it('sweeps a quarter for the first of four stations', () => {
    const icon = drawn(0.25);

    expect(icon?.querySelector('path')).toHaveAttribute(
      'd',
      'M 8 8 L 8 4.5 A 3.5 3.5 0 0 1 11.500 8.000 Z',
    );
  });

  it('takes the long way round once past halfway', () => {
    const icon = drawn(0.75);

    expect(icon?.querySelector('path')?.getAttribute('d')).toContain(
      'A 3.5 3.5 0 1 1',
    );
  });

  it('fills the last station solid rather than leaving a seam', () => {
    const icon = drawn(1);

    expect(icon?.querySelectorAll('circle')).toHaveLength(2);
    expect(icon?.querySelector('path')).toBeNull();
  });
});
