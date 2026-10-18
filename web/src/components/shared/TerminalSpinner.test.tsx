import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TerminalSpinner } from '@/components/shared/TerminalSpinner';

const preferringStill = (still: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: still })),
  );

describe('TerminalSpinner', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('steps through the braille frames', () => {
    vi.useFakeTimers();
    preferringStill(false);
    const { container } = render(<TerminalSpinner />);

    expect(container.textContent).toBe('⠋');
    act(() => {
      vi.advanceTimersByTime(80);
    });
    expect(container.textContent).toBe('⠙');
  });

  it('shows one frame for someone who prefers less motion', () => {
    vi.useFakeTimers();
    preferringStill(true);
    const { container } = render(<TerminalSpinner />);

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(container.textContent).toBe('⠋');
  });

  it('is hidden from assistive technology', () => {
    preferringStill(false);
    const { container } = render(<TerminalSpinner />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('fills all six dots once stopped, and greys them when faded', () => {
    vi.useFakeTimers();
    preferringStill(false);
    const { container, rerender } = render(
      <TerminalSpinner stopped="filled" />,
    );

    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(container.textContent).toBe('⠿');
    expect(container.firstElementChild).not.toHaveClass('text-faint');

    rerender(<TerminalSpinner stopped="faded" />);
    expect(container.textContent).toBe('⠿');
    expect(container.firstElementChild).toHaveClass('text-faint');
  });
});
