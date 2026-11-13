import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TerminalSpinner } from '@/components/shared/TerminalSpinner';

const preferringStill = (still: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: still })),
  );

const animating = () => {
  const animate = vi.fn(() => ({ cancel: vi.fn() }));
  HTMLElement.prototype.animate = animate as never;
  return animate;
};

describe('TerminalSpinner', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLElement.prototype, 'animate');
  });

  it('turns a strip of the braille frames, one step per frame', () => {
    preferringStill(false);
    const animate = animating();
    const { container } = render(<TerminalSpinner />);

    expect(container.textContent).toBe('⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏');
    expect(animate).toHaveBeenCalledWith(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
      expect.objectContaining({ duration: 800, easing: 'steps(10)' }),
    );
  });

  it('shows one frame for someone who prefers less motion', () => {
    preferringStill(true);
    const animate = animating();
    const { container } = render(<TerminalSpinner />);

    expect(container.textContent).toBe('⠋');
    expect(animate).not.toHaveBeenCalled();
  });

  it('is hidden from assistive technology', () => {
    preferringStill(false);
    const { container } = render(<TerminalSpinner />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('fills all six dots once stopped, and greys them when faded', () => {
    preferringStill(false);
    const animate = animating();
    const { container, rerender } = render(
      <TerminalSpinner stopped="filled" />,
    );

    expect(container.textContent).toBe('⠿');
    expect(container.firstElementChild).not.toHaveClass('text-faint');
    expect(animate).not.toHaveBeenCalled();

    rerender(<TerminalSpinner stopped="faded" />);
    expect(container.textContent).toBe('⠿');
    expect(container.firstElementChild).toHaveClass('text-faint');
  });
});
