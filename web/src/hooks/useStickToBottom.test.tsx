import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStickToBottom } from '@/hooks/useStickToBottom';

let grow: () => void = () => {};

class GrowingObserver {
  constructor(callback: () => void) {
    grow = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function Log() {
  const scroller = useStickToBottom<HTMLDivElement>();

  return (
    <div ref={scroller} data-testid="scroller">
      <div>
        <button type="button" aria-expanded={false}>
          Thought
        </button>
        <button type="button">Copy</button>
      </div>
    </div>
  );
}

const grown = (box: HTMLElement, height: number) => {
  Object.defineProperty(box, 'scrollHeight', {
    configurable: true,
    value: height,
  });
  grow();
};

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', GrowingObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useStickToBottom', () => {
  it('follows the log as it grows', () => {
    render(<Log />);
    const box = screen.getByTestId('scroller');

    grown(box, 900);

    expect(box.scrollTop).toBe(900);
  });

  it('stays in place when a step is opened', () => {
    render(<Log />);
    const box = screen.getByTestId('scroller');
    grown(box, 900);

    fireEvent.click(screen.getByRole('button', { name: 'Thought' }));
    grown(box, 1400);

    expect(box.scrollTop).toBe(900);
  });

  it('keeps following after a click on anything else', () => {
    render(<Log />);
    const box = screen.getByTestId('scroller');
    grown(box, 900);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    grown(box, 1400);

    expect(box.scrollTop).toBe(1400);
  });
});
