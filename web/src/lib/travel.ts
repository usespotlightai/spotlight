import { canGlide, GLIDE } from '@/lib/glide';

export const travel = (from: DOMRect, to: HTMLElement): void => {
  if (!canGlide(to)) {
    return;
  }

  const end = to.getBoundingClientRect();
  const dx = from.left - end.left;
  const dy = from.top - end.top;

  if (dx === 0 && dy === 0) {
    return;
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
  to.style.visibility = 'hidden';

  const moving = ghost.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
    GLIDE,
  );
  const landed = () => {
    ghost.remove();
    to.style.visibility = '';
  };
  moving.onfinish = landed;
  moving.oncancel = landed;
};
