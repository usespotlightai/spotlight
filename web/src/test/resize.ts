import { act } from '@testing-library/react';
import { vi } from 'vitest';

export const watchResizes = () => {
  const notices: (() => void)[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        notices.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );

  return (element: HTMLElement, sizes: Record<string, number>) => {
    for (const [name, value] of Object.entries(sizes)) {
      Object.defineProperty(element, name, { configurable: true, value });
    }
    act(() => {
      for (const notice of notices) {
        notice();
      }
    });
  };
};

export const scrollViewport = (container: HTMLElement): HTMLElement => {
  const viewport = container.querySelector<HTMLElement>(
    '[data-slot="scroll-area-viewport"]',
  );
  if (!viewport) {
    throw new Error('no viewport');
  }

  return viewport;
};
