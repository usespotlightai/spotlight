export type LabelledPoint = {
  readonly key: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
};

export type PlacedLabel = {
  readonly key: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
};

type Box = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

export const LABEL_SIZE = 12;
const CHARACTER_WIDTH = 6.2;
const GAP = 15;
const SIDE_GAP = 14;
const ACCESS = 2;
const DOT = 4;

const LINE = LABEL_SIZE + 2;

const spotsFor = (
  point: LabelledPoint,
): Omit<PlacedLabel, 'key' | 'text'>[] => [
  { x: point.x, y: point.y - GAP, anchor: 'middle' },
  { x: point.x, y: point.y + GAP + LABEL_SIZE, anchor: 'middle' },
  { x: point.x, y: point.y - GAP - LINE, anchor: 'middle' },
  { x: point.x, y: point.y + GAP + LABEL_SIZE + LINE, anchor: 'middle' },
  { x: point.x + SIDE_GAP, y: point.y + LABEL_SIZE / 3, anchor: 'start' },
  { x: point.x - SIDE_GAP, y: point.y + LABEL_SIZE / 3, anchor: 'end' },
  { x: point.x - DOT, y: point.y - GAP, anchor: 'start' },
  { x: point.x + DOT, y: point.y - GAP, anchor: 'end' },
  { x: point.x - DOT, y: point.y + GAP + LABEL_SIZE, anchor: 'start' },
  { x: point.x + DOT, y: point.y + GAP + LABEL_SIZE, anchor: 'end' },
];

const boxOf = (label: PlacedLabel): Box => {
  const width = label.text.length * CHARACTER_WIDTH;
  const left =
    label.anchor === 'middle'
      ? label.x - width / 2
      : label.anchor === 'start'
        ? label.x
        : label.x - width;

  return {
    left,
    right: left + width,
    top: label.y - LABEL_SIZE * 0.8,
    bottom: label.y + LABEL_SIZE * 0.2,
  };
};

const overlap = (a: Box, b: Box): boolean =>
  a.left < b.right + ACCESS &&
  b.left < a.right + ACCESS &&
  a.top < b.bottom + ACCESS &&
  b.top < a.bottom + ACCESS;

const inside = (box: Box, plot: Box | undefined): boolean =>
  !plot ||
  (box.left >= plot.left &&
    box.right <= plot.right &&
    box.top >= plot.top &&
    box.bottom <= plot.bottom);

const dotOf = (point: LabelledPoint): Box => ({
  left: point.x - DOT,
  right: point.x + DOT,
  top: point.y - DOT,
  bottom: point.y + DOT,
});

export const placeLabels = (
  points: readonly LabelledPoint[],
  plot?: Box,
): PlacedLabel[] => {
  const taken = points.map(dotOf);
  const placed: PlacedLabel[] = [];

  for (const point of points) {
    const free = spotsFor(point)
      .map((spot) => ({ ...spot, key: point.key, text: point.text }))
      .find((option) => {
        const box = boxOf(option);
        return inside(box, plot) && !taken.some((other) => overlap(other, box));
      });

    if (free) {
      placed.push(free);
      taken.push(boxOf(free));
    }
  }

  return placed;
};
