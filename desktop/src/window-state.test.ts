import { describe, expect, it } from 'vitest';

import { restorable, type WindowState } from './window-state';

const LAPTOP = { x: 0, y: 25, width: 1512, height: 920 };
const MONITOR = { x: -2560, y: 0, width: 2560, height: 1409 };

const at = (x: number, y: number, width = 1280, height = 800): WindowState => ({
  bounds: { x, y, width, height },
  maximized: false,
  fullScreen: false,
});

describe('restorable', () => {
  it('restores a window that is on a display', () => {
    expect(restorable(at(100, 100), [LAPTOP])).toEqual(at(100, 100));
  });

  it('restores a window on a second display left of the main one', () => {
    expect(restorable(at(-1800, 200), [LAPTOP, MONITOR])).toEqual(
      at(-1800, 200),
    );
  });

  it('opens fresh when the display the window was on is gone', () => {
    expect(restorable(at(-1800, 200), [LAPTOP])).toBeNull();
  });

  it('opens fresh when only a sliver of the window would show', () => {
    expect(restorable(at(1460, 100), [LAPTOP])).toBeNull();
  });

  it('opens fresh for a window smaller than the app allows', () => {
    expect(restorable(at(100, 100, 400, 300), [LAPTOP])).toBeNull();
  });

  it('opens fresh with nothing stored', () => {
    expect(restorable(null, [LAPTOP])).toBeNull();
  });
});
