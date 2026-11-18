import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Disclosure,
  LONGEST_DISCLOSURE_MS,
} from '@/components/shell/layout/Disclosure';

const OPEN_HEIGHT = 600;

let top = 100;
let shownHeight = 0;
let reducedMotion = false;
let playState: AnimationPlayState = 'finished';
const cancel = vi.fn();
const animate = vi.fn<
  (keyframes: Keyframe[], options: KeyframeAnimationOptions) => Animation
>(
  () =>
    ({
      get playState() {
        return playState;
      },
      cancel,
    }) as unknown as Animation,
);

function section(open: boolean) {
  return (
    <Disclosure open={open}>
      <li>Row</li>
    </Disclosure>
  );
}

function heights() {
  return animate.mock.calls.map(([keyframes]) =>
    keyframes.map((frame) => frame.height),
  );
}

beforeEach(() => {
  top = 100;
  shownHeight = 0;
  reducedMotion = false;
  playState = 'finished';
  animate.mockClear();
  cancel.mockClear();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const height = this.style.height === 'auto' ? OPEN_HEIGHT : shownHeight;
      return { top, height } as DOMRect;
    },
  );
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: animate,
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reducedMotion })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
});

describe('Disclosure', () => {
  it('does not animate on first render', () => {
    render(section(true));

    expect(animate).not.toHaveBeenCalled();
  });

  it('opens from zero to the height it will show', () => {
    const { rerender } = render(section(false));

    rerender(section(true));

    expect(heights()).toEqual([['0px', `${OPEN_HEIGHT}px`]]);
  });

  it('closes from the height it shows to zero', () => {
    const { rerender } = render(section(true));

    rerender(section(false));

    expect(heights()).toEqual([[`${OPEN_HEIGHT}px`, '0px']]);
  });

  it('animates only the part above the bottom of the window', () => {
    top = window.innerHeight - 200;
    const { rerender } = render(section(false));

    rerender(section(true));

    expect(heights()).toEqual([['0px', '200px']]);
  });

  it('scales the duration with the distance, up to the longest', () => {
    top = window.innerHeight - 200;
    const short = render(section(false));
    short.rerender(section(true));
    short.unmount();
    top = 100;
    const long = render(section(false));
    long.rerender(section(true));

    expect(animate.mock.calls.map(([, options]) => options)).toMatchObject([
      { duration: 260 },
      { duration: LONGEST_DISCLOSURE_MS },
    ]);
  });

  it('reverses from the current height when toggled mid-way', () => {
    const { rerender } = render(section(false));
    rerender(section(true));
    playState = 'running';
    shownHeight = 120;

    rerender(section(false));

    expect(cancel).toHaveBeenCalled();
    expect(heights()[1]).toEqual(['120px', '0px']);
  });

  it('does not animate a section that opens below the window', () => {
    top = window.innerHeight + 10;
    const { rerender } = render(section(false));

    rerender(section(true));

    expect(animate).not.toHaveBeenCalled();
  });

  it('does not animate when reduced motion is set', () => {
    reducedMotion = true;
    const { rerender } = render(section(false));

    rerender(section(true));

    expect(animate).not.toHaveBeenCalled();
  });
});
