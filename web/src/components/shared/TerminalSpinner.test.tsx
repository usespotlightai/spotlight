import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TerminalSpinner } from '@/components/shared/TerminalSpinner';
import { partial } from '@/test/partial';

const preferringStill = (still: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: still })),
  );

const animating = () => {
  const animate = vi.fn<HTMLElement['animate']>(() =>
    partial<Animation>({ cancel: vi.fn() }),
  );
  HTMLElement.prototype.animate = animate;
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

  it('stops on a light symbol, as ora does: a check once done, a faint cross once dismissed', () => {
    preferringStill(false);
    const animate = animating();
    const { container, rerender } = render(
      <TerminalSpinner stopped="succeeded" />,
    );

    expect(container.textContent).toBe('✓\uFE0E');
    expect(container.firstElementChild).toHaveClass('text-muted-foreground');
    expect(animate).not.toHaveBeenCalled();

    rerender(<TerminalSpinner stopped="dismissed" />);
    expect(container.textContent).toBe('✕\uFE0E');
    expect(container.firstElementChild).toHaveClass('text-faint');
  });

  it('asks with a still question mark in the primary colour while it waits for someone', () => {
    preferringStill(false);
    const animate = animating();
    const { container } = render(<TerminalSpinner stopped="waiting" />);

    expect(container.textContent).toBe('?');
    expect(container.firstElementChild).toHaveClass('text-primary');
    expect(animate).not.toHaveBeenCalled();
  });
});
