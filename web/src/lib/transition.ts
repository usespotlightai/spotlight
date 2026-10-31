import { canAnimate } from '@/lib/motion';

const MOVE_TIMING: KeyframeAnimationOptions = {
  duration: 200,
  easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  fill: 'forwards',
};

export type MoveEnd = 'finished' | 'cancelled';

const transitionEnded = (expanding: HTMLElement | null): Promise<void> =>
  new Promise((resolve) => {
    if (!expanding) {
      resolve();
      return;
    }
    const done = () => {
      expanding.removeEventListener('transitionend', onEnd);
      resolve();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === expanding) {
        done();
      }
    };
    expanding.addEventListener('transitionend', onEnd);
    setTimeout(done, Number(MOVE_TIMING.duration) + 100);
  });

export const transitionMove = (
  from: DOMRect,
  to: HTMLElement,
  expanding: HTMLElement | null,
  landed: (end: MoveEnd) => void,
): (() => void) | null => {
  if (!canAnimate(to)) {
    return null;
  }

  const end = to.getBoundingClientRect();
  const dx = from.left - end.left;
  const dy = from.top - end.top;

  if (dx === 0 && dy === 0) {
    return null;
  }

  const ghost = to.cloneNode(true) as HTMLElement;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${end.left}px`,
    top: `${end.top}px`,
    width: `${end.width}px`,
    height: `${end.height}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: '50',
  });
  document.body.append(ghost);

  const moving = ghost.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
    MOVE_TIMING,
  );
  const expanded = transitionEnded(expanding);
  let done = false;
  const land = (end: MoveEnd) => {
    if (!done) {
      done = true;
      landed(end);
      ghost.remove();
    }
  };

  moving.oncancel = () => land('cancelled');
  moving.onfinish = () => {
    void expanded.then(() => land('finished'));
  };

  return () => {
    done = true;
    moving.cancel();
    ghost.remove();
  };
};
