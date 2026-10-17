import type { PullRequestType } from '@/lib/insights-pull-requests';
import type { FlowStage } from '@/lib/insights-shipping';

export const TYPE_COLORS: Record<PullRequestType, string> = {
  feature: 'var(--chart-primary)',
  fix: 'var(--chart-success)',
  refactor: 'var(--chart-4)',
  tests: 'var(--chart-3)',
  chore: 'var(--chart-2)',
  other: 'var(--chart-5)',
};

export const jamColor = (jam: number): string =>
  `color-mix(in oklab, var(--destructive) ${Math.round(jam ** 2 * 100)}%, var(--chart-2))`;

const GUTTER = 28;
const FREE_HALF = 40;
const JAMMED_HALF = 14;
const FASTEST_S = 0.9;
const SLOWEST_S = 11;
const DOTS_PER_PX = 0.45;

export type FlowGeometry = {
  readonly width: number;
  readonly centers: readonly number[];
  readonly bounds: readonly number[];
  readonly halves: readonly number[];
  readonly seconds: readonly number[];
};

export const geometryOf = (
  stages: readonly FlowStage[],
  width: number,
): FlowGeometry => {
  const count = Math.max(1, stages.length);
  const span = Math.max(0, width - GUTTER * 2) / count;
  const centers = stages.map((_, at) => GUTTER + (at + 0.5) * span);
  const bounds = [
    0,
    ...stages.slice(1).map((_, at) => GUTTER + (at + 1) * span),
    width,
  ];

  return {
    width,
    centers,
    bounds,
    halves: stages.map(
      (stage) => FREE_HALF - (FREE_HALF - JAMMED_HALF) * stage.jam,
    ),
    seconds: stages.map(
      (stage) => FASTEST_S + (SLOWEST_S - FASTEST_S) * stage.jam ** 0.8,
    ),
  };
};

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

export const halfAt = (geometry: FlowGeometry, x: number): number => {
  const { centers, halves } = geometry;

  if (centers.length === 0) {
    return FREE_HALF;
  }
  if (x <= centers[0]) {
    return halves[0];
  }

  for (let at = 0; at < centers.length - 1; at++) {
    if (x <= centers[at + 1]) {
      const t = (x - centers[at]) / (centers[at + 1] - centers[at]);
      return halves[at] + (halves[at + 1] - halves[at]) * smoothstep(t);
    }
  }

  return halves[halves.length - 1];
};

const stageAt = (geometry: FlowGeometry, x: number): number => {
  const { bounds } = geometry;

  for (let at = 0; at < bounds.length - 2; at++) {
    if (x < bounds[at + 1]) {
      return at;
    }
  }

  return Math.max(0, bounds.length - 2);
};

const speedAt = (geometry: FlowGeometry, x: number): number => {
  const at = stageAt(geometry, x);
  const length = geometry.bounds[at + 1] - geometry.bounds[at];

  return length / (geometry.seconds[at] ?? FASTEST_S);
};

export const bandEdge = (
  geometry: FlowGeometry,
  middle: number,
  side: 1 | -1,
): string => {
  const points: string[] = [];

  for (let x = 0; x <= geometry.width; x += 4) {
    points.push(`${x},${(middle + side * halfAt(geometry, x)).toFixed(1)}`);
  }

  return `M${points.join('L')}`;
};

export type Dot = {
  x: number;
  lane: number;
  radius: number;
  type: PullRequestType;
};

export type TypeShare = {
  readonly type: PullRequestType;
  readonly merged: number;
};

const typeFrom = (shares: readonly TypeShare[], roll: number) => {
  const total = shares.reduce((sum, each) => sum + each.merged, 0);
  let left = roll * total;

  for (const share of shares) {
    left -= share.merged;
    if (left <= 0) {
      return share.type;
    }
  }

  return shares[shares.length - 1]?.type ?? 'other';
};

const freshDot = (
  shares: readonly TypeShare[],
  x: number,
  random: () => number = Math.random,
): Dot => ({
  x,
  lane: random() + random() - 1,
  radius: 1.4 + random() * 1.6,
  type: typeFrom(shares, random()),
});

export const spreadDots = (
  geometry: FlowGeometry,
  shares: readonly TypeShare[],
  random: () => number = Math.random,
): Dot[] => {
  const total = geometry.seconds.reduce((sum, each) => sum + each, 0);
  const count = Math.round(geometry.width * DOTS_PER_PX);

  return Array.from({ length: count }, () => {
    let left = random() * total;
    let at = 0;

    while (at < geometry.seconds.length - 1 && left > geometry.seconds[at]) {
      left -= geometry.seconds[at];
      at++;
    }

    const from = geometry.bounds[at];
    const to = geometry.bounds[at + 1];
    const x = from + (to - from) * (left / geometry.seconds[at]);

    return freshDot(shares, Math.min(x, to), random);
  });
};

export const advance = (
  dots: Dot[],
  geometry: FlowGeometry,
  shares: readonly TypeShare[],
  seconds: number,
): void => {
  for (let at = 0; at < dots.length; at++) {
    const dot = dots[at];
    dot.x += speedAt(geometry, dot.x) * seconds;

    if (dot.x > geometry.width) {
      dots[at] = freshDot(shares, dot.x - geometry.width);
    }
  }
};
