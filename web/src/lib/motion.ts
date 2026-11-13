export const TRANSITION_TIMING: KeyframeAnimationOptions = {
  duration: 200,
  easing: 'ease-out',
};

const ROW_DURATION = 200;

export const ROW_TRANSITION = `height ${ROW_DURATION}ms ease-out`;

export const ROW_SETTLED = ROW_DURATION + 50;

export const canAnimate = (
  element: HTMLElement | null,
): element is HTMLElement =>
  element !== null &&
  typeof element.animate === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const SPRING_MS = 350;

export const SPRING = 'duration-350 ease-spring motion-reduce:transition-none';

export const springMs = (): number =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 0
    : SPRING_MS;
