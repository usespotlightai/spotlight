import { canGlide } from '@/lib/glide';

const TRAVEL: KeyframeAnimationOptions = {
  duration: 200,
  easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  fill: 'forwards',
};

const transitionEnded = (unfolding: HTMLElement | null): Promise<void> =>
  new Promise((resolve) => {
    if (!unfolding) {
      resolve();
      return;
    }
    const done = () => {
      unfolding.removeEventListener('transitionend', onEnd);
      resolve();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === unfolding) {
        done();
      }
    };
    unfolding.addEventListener('transitionend', onEnd);
    setTimeout(done, Number(TRAVEL.duration) + 100);
  });

export const travel = (
  from: DOMRect,
  to: HTMLElement,
  unfolding: HTMLElement | null,
  landed: () => void,
): (() => void) | null => {
  if (!canGlide(to)) {
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
    TRAVEL,
  );
  const unfolded = transitionEnded(unfolding);
  let done = false;
  const land = (fade: () => void) => {
    if (!done) {
      done = true;
      landed();
      fade();
    }
  };
  const afterPaint = () =>
    requestAnimationFrame(() => requestAnimationFrame(() => ghost.remove()));

  moving.oncancel = () => land(() => ghost.remove());
  moving.onfinish = () => {
    void unfolded.then(() => land(afterPaint));
  };

  return () => {
    land(() => ghost.remove());
    moving.cancel();
  };
};
