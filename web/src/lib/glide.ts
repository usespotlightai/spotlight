export const GLIDE: KeyframeAnimationOptions = {
  duration: 200,
  easing: 'ease-out',
};

export const canGlide = (element: HTMLElement | null): element is HTMLElement =>
  element !== null &&
  typeof element.animate === 'function' &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
