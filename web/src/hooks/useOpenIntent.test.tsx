import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOpenIntent } from '@/hooks/useOpenIntent';

function Row({ onIntent }: { onIntent: () => void }) {
  const intent = useOpenIntent(onIntent);

  return (
    <div data-testid="row" {...intent}>
      <a href="#x">Open</a>
    </div>
  );
}

describe('useOpenIntent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls the intent after a short hover', () => {
    const onIntent = vi.fn();
    render(<Row onIntent={onIntent} />);

    fireEvent.pointerEnter(screen.getByTestId('row'));
    expect(onIntent).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(onIntent).toHaveBeenCalledOnce();
  });

  it('does not call it when the pointer only passes over', () => {
    const onIntent = vi.fn();
    render(<Row onIntent={onIntent} />);

    fireEvent.pointerEnter(screen.getByTestId('row'));
    fireEvent.pointerLeave(screen.getByTestId('row'));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onIntent).not.toHaveBeenCalled();
  });

  it('calls it at once on keyboard focus', () => {
    const onIntent = vi.fn();
    render(<Row onIntent={onIntent} />);

    fireEvent.focus(screen.getByRole('link', { name: 'Open' }));

    expect(onIntent).toHaveBeenCalledOnce();
  });
});
