export const TRANSITION_TIMING: KeyframeAnimationOptions = {
  duration: 200,
  easing: 'ease-out',
};

export const canAnimate = (
  element: HTMLElement | null,
): element is HTMLElement =>
  element !== null &&
  typeof element.animate === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
