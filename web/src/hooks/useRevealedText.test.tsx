import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { REVEAL_MS, useRevealedText } from '@/hooks/useRevealedText';

const preferringStill = (still: boolean) =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: still })),
  );

describe('useRevealedText', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the text it starts with at once', () => {
    preferringStill(false);
    const { result } = renderHook(() => useRevealedText('Retries back off.'));

    expect(result.current).toBe('Retries back off.');
  });

  it('reveals added text word by word over the reveal time', () => {
    preferringStill(false);
    const { result, rerender } = renderHook(
      ({ text }) => useRevealedText(text),
      { initialProps: { text: 'Retries' } },
    );

    rerender({ text: 'Retries back off twice, then give up.' });
    act(() => {
      vi.advanceTimersByTime(REVEAL_MS / 2);
    });
    const half = result.current;

    expect(half.length).toBeGreaterThan('Retries'.length);
    expect(half.length).toBeLessThan(
      'Retries back off twice, then give up.'.length,
    );
    expect('Retries back off twice, then give up.'.startsWith(half)).toBe(true);
    expect(half.endsWith(' ')).toBe(false);

    act(() => {
      vi.advanceTimersByTime(REVEAL_MS);
    });
    expect(result.current).toBe('Retries back off twice, then give up.');
  });

  it('shows changed text in one step', () => {
    preferringStill(false);
    const { result, rerender } = renderHook(
      ({ text }) => useRevealedText(text),
      { initialProps: { text: 'Retries back off.' } },
    );

    rerender({ text: 'Uploads retry.' });
    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(result.current).toBe('Uploads retry.');
  });

  it('shows added text in one step for someone who prefers less motion', () => {
    preferringStill(true);
    const { result, rerender } = renderHook(
      ({ text }) => useRevealedText(text),
      { initialProps: { text: 'Retries' } },
    );

    rerender({ text: 'Retries back off twice, then give up.' });
    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(result.current).toBe('Retries back off twice, then give up.');
  });
});
