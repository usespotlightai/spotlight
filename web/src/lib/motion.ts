export const TRANSITION_TIMING: KeyframeAnimationOptions = {
  duration: 200,
  easing: 'ease-out',
};

const ROW_DURATION = 200;

export const ROW_TRANSITION = `height ${ROW_DURATION}ms ease-out`;

export const ROW_SETTLED = ROW_DURATION + 50;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

export const canAnimate = (
  element: HTMLElement | null,
): element is HTMLElement =>
  element !== null &&
  typeof element.animate === 'function' &&
  !prefersReducedMotion();

export const SPRING_MS = 350;

export const SPRING_EASE = 'ease-spring motion-reduce:transition-none';

export const SPRING = `duration-(--spring-duration) ${SPRING_EASE}`;

export const springMs = (): number => (prefersReducedMotion() ? 0 : SPRING_MS);
