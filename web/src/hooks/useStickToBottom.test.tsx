import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStickToBottom } from '@/hooks/useStickToBottom';

let grow: () => void = () => {};
let observed: Element[] = [];

class GrowingObserver {
  constructor(callback: () => void) {
    grow = callback;
  }
  observe(target: Element) {
    observed.push(target);
  }
  unobserve() {}
  disconnect() {}
}

function Log({ sent = 0 }: { sent?: number }) {
  const scroller = useStickToBottom<HTMLDivElement>(sent);

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
  observed = [];
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

  it('keeps following when its own scroll lands after the log grew again', () => {
    render(<Log />);
    const box = screen.getByTestId('scroller');
    grown(box, 900);

    Object.defineProperty(box, 'scrollHeight', {
      configurable: true,
      value: 1400,
    });
    fireEvent.scroll(box);
    grow();

    expect(box.scrollTop).toBe(1400);
  });

  it('goes back to the bottom when the box itself changes size', () => {
    render(<Log />);
    const box = screen.getByTestId('scroller');

    expect(observed).toContain(box);
  });

  it('stops following when the person scrolls up', () => {
    render(<Log />);
    const box = screen.getByTestId('scroller');
    grown(box, 900);

    box.scrollTop = 300;
    fireEvent.scroll(box);
    grown(box, 1400);

    expect(box.scrollTop).toBe(300);
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

  it('goes to the bottom and follows again when a message is sent', () => {
    const { rerender } = render(<Log />);
    const box = screen.getByTestId('scroller');
    grown(box, 900);
    box.scrollTop = 100;
    fireEvent.scroll(box);

    grown(box, 1400);
    expect(box.scrollTop).toBe(100);

    rerender(<Log sent={1} />);
    expect(box.scrollTop).toBe(1400);

    grown(box, 1800);
    expect(box.scrollTop).toBe(1800);
  });
});
