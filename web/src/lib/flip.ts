import { GLIDE } from '@/lib/glide';

type Box = { readonly top: number; readonly height: number };

export type Placement = ReadonlyMap<HTMLElement, Box>;

const SETTLED = 0.5;

const boxOf = (element: HTMLElement): Box => {
  const { top, height } = element.getBoundingClientRect();

  return { top, height };
};

const ancestorsOf = (element: HTMLElement): HTMLElement[] => {
  const found: HTMLElement[] = [];

  for (
    let at = element.parentElement;
    at && at !== document.body;
    at = at.parentElement
  ) {
    found.push(at);
  }

  return found;
};

const followersOf = (element: HTMLElement): HTMLElement[] => {
  const found: HTMLElement[] = [];

  for (
    let at = element.nextElementSibling;
    at !== null;
    at = at.nextElementSibling
  ) {
    if (at instanceof HTMLElement) {
      found.push(at);
    }
  }

  return found;
};

export const placementOf = (
  target: HTMLElement,
  parts: readonly HTMLElement[] = [],
): Placement => {
  const ancestors = ancestorsOf(target);

  return new Map(
    [
      target,
      ...parts,
      ...ancestors,
      ...[target, ...ancestors].flatMap(followersOf),
    ].map((element) => [element, boxOf(element)]),
  );
};

export const placementWithout = (target: HTMLElement): Placement => {
  const shown = boxOf(target);
  const display = target.style.display;
  target.style.display = 'none';
  const placed = new Map(placementOf(target));
  target.style.display = display;
  placed.set(target, { top: shown.top, height: 0 });

  return placed;
};

const clipOf = (element: HTMLElement, by: number): string => {
  const radius = getComputedStyle(element).borderBottomLeftRadius;
  const round = radius === '0px' ? '' : ` round ${radius}`;

  return `inset(0 0 ${Math.max(0, by)}px 0${round})`;
};

const apart = (one: number, other: number): boolean =>
  Math.abs(one - other) > SETTLED;

export const glideBetween = (
  now: Placement,
  from: Placement,
  to: Placement,
): Animation[] =>
  [...now].flatMap(([element, at]) => {
    const one = from.get(element);
    const other = to.get(element);

    if (!one || !other) {
      return [];
    }

    const moves = apart(one.top, other.top);
    const resizes = apart(one.height, other.height);

    if (!moves && !resizes) {
      return [];
    }

    const frames = [one, other].map((box) => ({
      ...(moves ? { transform: `translateY(${box.top - at.top}px)` } : {}),
      ...(resizes ? { clipPath: clipOf(element, at.height - box.height) } : {}),
    }));

    return [element.animate(frames, { ...GLIDE, fill: 'both' })];
  });
