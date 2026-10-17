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

export const LABEL_SIZE = 11;
const CHARACTER_WIDTH = 6.2;
const GAP = 15;
const SIDE_GAP = 14;
const ACCESS = 2;

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

export const placeLabels = (
  points: readonly LabelledPoint[],
): PlacedLabel[] => {
  const placed: PlacedLabel[] = [];

  for (const point of points) {
    const taken = placed.map(boxOf);
    const options = spotsFor(point).map((spot) => ({
      ...spot,
      key: point.key,
      text: point.text,
    }));
    const free = options.find(
      (option) => !taken.some((box) => overlap(box, boxOf(option))),
    );
    placed.push(free ?? (options[0] as PlacedLabel));
  }

  return placed;
};
