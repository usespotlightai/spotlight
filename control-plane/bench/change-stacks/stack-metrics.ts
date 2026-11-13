export const OVERSIZED_LAYER_LINES = 400;

export type SizeBucket = 'small' | 'medium' | 'large';

export interface MeasuredHunk {
  readonly id: string;
  readonly path: string;
  readonly patch: string;
}

export interface MeasuredCohort {
  readonly kind: 'change' | 'incidental';
  readonly title: string;
  readonly layers: readonly {
    readonly title: string;
    readonly hunks: readonly { readonly hunk: string }[];
  }[];
}

export interface LayerShape {
  readonly cohort: number;
  readonly title: string;
  readonly lines: number;
  readonly hunks: number;
  readonly files: number;
}

export interface DiffShape {
  readonly hunks: number;
  readonly lines: number;
  readonly files: number;
  readonly largestHunkLines: number;
  readonly largestHunkShare: number;
  readonly bucket: SizeBucket;
}

export interface StackShape {
  readonly cohorts: number;
  readonly layers: number;
  readonly layerLines: readonly number[];
  readonly largestLayerShare: number;
  readonly effectiveLayers: number;
  readonly oversizedLayers: number;
  readonly incidentalShare: number;
  readonly layout: readonly LayerShape[];
}

export const changedLines = (patch: string): number =>
  patch
    .split('\n')
    .filter(
      (line) =>
        (line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---')),
    ).length;

export const bucketOf = (lines: number): SizeBucket =>
  lines < 300 ? 'small' : lines < 1500 ? 'medium' : 'large';

const share = (part: number, whole: number): number =>
  whole > 0 ? part / whole : 0;

export const diffShape = (
  hunks: readonly MeasuredHunk[],
  placed: ReadonlySet<string>,
): DiffShape => {
  const shown = hunks.filter((hunk) => placed.has(hunk.id));
  const sizes = shown.map((hunk) => changedLines(hunk.patch));
  const lines = sizes.reduce((total, each) => total + each, 0);
  const largestHunkLines = Math.max(0, ...sizes);

  return {
    hunks: shown.length,
    lines,
    files: new Set(shown.map((hunk) => hunk.path)).size,
    largestHunkLines,
    largestHunkShare: share(largestHunkLines, lines),
    bucket: bucketOf(lines),
  };
};

export const stackShape = (
  hunks: readonly MeasuredHunk[],
  placed: ReadonlySet<string>,
  cohorts: readonly MeasuredCohort[],
): StackShape => {
  const byId = new Map(hunks.map((hunk) => [hunk.id, hunk]));
  const linesOf = (ids: readonly string[]) =>
    ids.reduce(
      (total, id) => total + changedLines(byId.get(id)?.patch ?? ''),
      0,
    );

  const layout = cohorts.flatMap((cohort, c) =>
    cohort.kind === 'change'
      ? cohort.layers.map((layer): LayerShape => {
          const ids = layer.hunks
            .map((entry) => entry.hunk)
            .filter((id) => placed.has(id));

          return {
            cohort: c + 1,
            title: layer.title,
            lines: linesOf(ids),
            hunks: ids.length,
            files: new Set(ids.map((id) => byId.get(id)?.path)).size,
          };
        })
      : [],
  );

  const incidental = linesOf(
    cohorts
      .filter((cohort) => cohort.kind === 'incidental')
      .flatMap((cohort) => cohort.layers)
      .flatMap((layer) => layer.hunks.map((entry) => entry.hunk))
      .filter((id) => placed.has(id)),
  );

  const layerLines = layout.map((layer) => layer.lines);
  const reviewed = layerLines.reduce((total, each) => total + each, 0);
  const squares = layerLines.reduce((total, each) => total + each * each, 0);

  return {
    cohorts: new Set(layout.map((layer) => layer.cohort)).size,
    layers: layout.length,
    layerLines,
    largestLayerShare: share(Math.max(0, ...layerLines), reviewed),
    effectiveLayers: squares > 0 ? (reviewed * reviewed) / squares : 0,
    oversizedLayers: layerLines.filter((each) => each > OVERSIZED_LAYER_LINES)
      .length,
    incidentalShare: share(incidental, reviewed + incidental),
    layout,
  };
};

export const median = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

export const mean = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((total, each) => total + each, 0) / values.length;
