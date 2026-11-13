import { DndContext } from '@dnd-kit/core';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SplitDropZones } from '@/components/shell/tabs/SplitDropZones';
import type { SplitSide } from '@/lib/app-tabs';

const paneWidth = (width: number) =>
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);

const zones = () =>
  document.querySelectorAll('[data-slot="split-drop-zone"]').length;

const zonesIn = (sides: readonly SplitSide[]) => {
  render(
    <DndContext>
      <SplitDropZones sides={sides} />
    </DndContext>,
  );

  return zones();
};

const resizedTo = (width: number) => {
  let observed: ResizeObserverCallback = () => {};
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        observed = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );

  return (next = width) =>
    act(() =>
      observed(
        [{ contentRect: { width: next } } as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    );
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SplitDropZones', () => {
  it('offers both sides when the pane has room for two', () => {
    paneWidth(648);

    expect(zonesIn(['left', 'right'])).toBe(2);
  });

  it('offers no split when the pane has no room for two', () => {
    paneWidth(647);

    expect(zonesIn(['left', 'right'])).toBe(0);
  });

  it('keeps the zone of a pane that is already split', () => {
    paneWidth(320);

    expect(zonesIn(['right'])).toBe(1);
  });

  it('follows the pane across the width for two', () => {
    paneWidth(800);
    const resize = resizedTo(800);
    zonesIn(['left', 'right']);

    resize(600);
    expect(zones()).toBe(0);

    resize(700);
    expect(zones()).toBe(2);
  });
});
