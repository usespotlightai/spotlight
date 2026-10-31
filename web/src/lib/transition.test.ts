import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type MoveEnd, transitionMove } from '@/lib/transition';

type FakeAnimation = {
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
  cancel: () => void;
};

let animation: FakeAnimation;
const realAnimate = HTMLElement.prototype.animate;

const ghosts = () => document.body.querySelectorAll('[aria-hidden="true"]');

const target = () => {
  const button = document.createElement('button');
  button.textContent = 'Connect your account';
  document.body.append(button);

  return button;
};

const moving = (landed: (end: MoveEnd) => void) =>
  transitionMove(new DOMRect(40, 80, 120, 24), target(), null, landed);

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('transitionMove', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    HTMLElement.prototype.animate = vi.fn(() => {
      animation = {
        onfinish: null,
        oncancel: null,
        cancel: vi.fn(() => animation.oncancel?.()),
      };

      return animation as unknown as Animation;
    });
  });

  afterEach(() => {
    HTMLElement.prototype.animate = realAnimate;
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('flies a copy of the element from where it was', () => {
    moving(vi.fn());

    expect(ghosts()).toHaveLength(1);
    expect(HTMLElement.prototype.animate).toHaveBeenCalledWith(
      [{ transform: 'translate(40px, 80px)' }, { transform: 'none' }],
      expect.objectContaining({ duration: 200 }),
    );
  });

  it('shows the element before it removes the copy once the move finishes', async () => {
    const copiesWhenLanded: number[] = [];
    const landed = vi.fn(() => copiesWhenLanded.push(ghosts().length));
    moving(landed);

    animation.onfinish?.();
    await settle();

    expect(landed).toHaveBeenCalledWith('finished');
    expect(copiesWhenLanded).toEqual([1]);
    expect(ghosts()).toHaveLength(0);
  });

  it('tells the caller when something else cancels the move', () => {
    const landed = vi.fn();
    moving(landed);

    animation.oncancel?.();

    expect(landed).toHaveBeenCalledWith('cancelled');
    expect(ghosts()).toHaveLength(0);
  });

  it('removes the copy without landing when the caller stops the move', async () => {
    const landed = vi.fn();
    const stop = moving(landed);

    stop?.();
    animation.onfinish?.();
    await settle();

    expect(animation.cancel).toHaveBeenCalled();
    expect(landed).not.toHaveBeenCalled();
    expect(ghosts()).toHaveLength(0);
  });

  it('does nothing when the element has not moved', () => {
    const stop = transitionMove(
      new DOMRect(0, 0, 120, 24),
      target(),
      null,
      vi.fn(),
    );

    expect(stop).toBeNull();
    expect(ghosts()).toHaveLength(0);
  });
});
