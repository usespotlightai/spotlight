import type {
  ChangeMarkerResponseDto,
  HarnessResponseDto,
  InsightsChangesResponseDto,
  InsightsSetupsResponseDto,
  JudgeShareResponseDto,
  SetupOutcomeResponseDto,
  SizeBoundResponseDto,
  StationStandingResponseDto,
} from '@/lib/api';
import { deltaOf, harnessShown, modelShown, shareShown } from '@/lib/insights';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import type { ComparedRow } from '@/lib/tally-comparison';

export type InsightsChanges = InsightsChangesResponseDto;
export type ChangeMarker = ChangeMarkerResponseDto;
export type InsightsSetups = InsightsSetupsResponseDto;
export type SetupOutcome = SetupOutcomeResponseDto;
export type StationStanding = StationStandingResponseDto;
export type SizeBound = SizeBoundResponseDto;
type JudgeShare = JudgeShareResponseDto;
export type RunSize = SizeBound['size'];
export type OutcomeMeasure = SetupOutcome['frontier'][number];

export type ChangeAt = {
  readonly stationId: string;
  readonly runId: string;
};

export const changeKey = (change: ChangeAt): string =>
  `${change.stationId}:${change.runId}`;

export const markerOf = (
  changes: InsightsChanges,
  at: ChangeAt,
): ChangeMarker | null =>
  changes.markers.find((each) => changeKey(each) === changeKey(at)) ?? null;

export const OUTCOME_MEASURES: readonly {
  readonly id: OutcomeMeasure;
  readonly label: string;
  readonly lowerIsBetter: boolean;
}[] = [
  { id: 'accepted', label: 'Accepted', lowerIsBetter: false },
  { id: 'sent_back', label: 'Sent back', lowerIsBetter: true },
  { id: 'handed_on', label: 'Handed on', lowerIsBetter: false },
  { id: 'checks_passed', label: 'Checks passed', lowerIsBetter: false },
  { id: 'merged', label: 'Merged', lowerIsBetter: false },
  { id: 'judge', label: 'Judge score', lowerIsBetter: false },
];

export const DEFAULT_OUTCOME: OutcomeMeasure = 'accepted';

export const outcomeLabel = (measure: OutcomeMeasure): string =>
  OUTCOME_MEASURES.find((each) => each.id === measure)?.label ?? measure;

export const lowerIsBetter = (measure: OutcomeMeasure): boolean =>
  OUTCOME_MEASURES.find((each) => each.id === measure)?.lowerIsBetter ?? false;

export const asOutcome = (raw: string): OutcomeMeasure =>
  OUTCOME_MEASURES.find((each) => each.id === raw)?.id ?? DEFAULT_OUTCOME;

const SIZES: Record<RunSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
};

export const RUN_SIZES: readonly RunSize[] = ['small', 'medium', 'large'];

export const sizeShown = (size: RunSize): string => SIZES[size];

export const asSize = (raw: string): RunSize | null =>
  RUN_SIZES.find((each) => each === raw) ?? null;

export const sizeRuleShown = (bound: SizeBound): string =>
  bound.mostLines === null || bound.mostSteps === null
    ? `${sizeShown(bound.size)}: anything bigger`
    : `${sizeShown(bound.size)}: up to ${bound.mostLines} changed lines, or ${bound.mostSteps} steps for a run that changed none`;

export const setupKey = (setup: SetupOutcome): string =>
  JSON.stringify([setup.harness, setup.model, setup.effort, setup.profileKey]);

export const setupWithinShown = (setup: SetupOutcome): string =>
  [
    modelShown(setup.model),
    setup.effort ? `${setup.effort} effort` : null,
    setup.profileKey ? `${setup.profileKey} profile` : null,
  ]
    .filter(Boolean)
    .join(' · ');

export const setupShown = (
  setup: SetupOutcome,
  harnesses: readonly HarnessResponseDto[] | undefined,
): string =>
  `${harnessShown(harnesses, setup.harness)} · ${setupWithinShown(setup)}`;

export type HarnessGroup = {
  readonly harness: string;
  readonly setups: readonly SetupOutcome[];
};

export const harnessGroupsOf = (
  setups: readonly SetupOutcome[],
): HarnessGroup[] => {
  const grouped = new Map<string, SetupOutcome[]>();

  for (const setup of setups) {
    grouped.set(setup.harness, [...(grouped.get(setup.harness) ?? []), setup]);
  }

  return [...grouped].map(([harness, each]) => ({ harness, setups: each }));
};

export const shownMeasures = (judged: boolean) =>
  OUTCOME_MEASURES.filter((each) => each.id !== 'judge' || judged);

export const setupHeadings = (judged: boolean): readonly NestedHeading[] => [
  { label: 'Setup', indent: 'outer', size: 'minmax(12rem,2fr)' },
  { label: 'Runs', numeric: true, size: SPREAD },
  { label: 'Cost per run', numeric: true, size: SPREAD },
  ...shownMeasures(judged).map((each) => ({
    label: each.label,
    numeric: true,
    size: SPREAD,
  })),
];

export type SetupPoint = {
  readonly key: string;
  readonly label: string;
  readonly cost: number;
  readonly value: number;
  readonly runs: number;
  readonly frontier: boolean;
};

const DOT_AREA: readonly [number, number] = [40, 240];

export type RunsScale = {
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  readonly legend: readonly number[];
};

export const runsScaleOf = (points: readonly SetupPoint[]): RunsScale => {
  const runs = points.map((each) => each.runs);
  const least = Math.min(...runs);
  const most = Math.max(...runs);
  const middle = Math.round((least + most) / 2);

  return {
    domain: [least, most],
    range: DOT_AREA,
    legend: [...new Set([least, middle, most])],
  };
};

export const dotRadius = (scale: RunsScale, runs: number): number => {
  const [least, most] = scale.domain;
  const [small, large] = scale.range;
  const share = most === least ? 1 : (runs - least) / (most - least);

  return Math.sqrt((small + share * (large - small)) / Math.PI);
};

export const setupPoints = (
  setups: readonly SetupOutcome[],
  measure: OutcomeMeasure,
  harnesses: readonly HarnessResponseDto[] | undefined,
  currency: string | null,
): SetupPoint[] =>
  setups.flatMap((setup) => {
    const value = setup.outcomes[measure];

    return setup.costPerRun === null ||
      value === null ||
      setup.currency !== currency
      ? []
      : [
          {
            key: setupKey(setup),
            label: setupShown(setup, harnesses),
            cost: setup.costPerRun,
            value,
            runs: setup.tally.runs,
            frontier: setup.frontier.includes(measure),
          },
        ];
  });

export const frontierOf = (points: readonly SetupPoint[]): SetupPoint[] =>
  points
    .filter((each) => each.frontier)
    .sort((a, b) => a.cost - b.cost || a.value - b.value);

export const outcomeShown = (value: number | null): string => shareShown(value);

const judgeCount = (share: JudgeShare | null): number => share?.judged ?? 0;

export const judgeRow = (marker: ChangeMarker, to: string): ComparedRow => ({
  id: 'judge',
  label: 'Judge score',
  one: shareShown(marker.judgeBefore?.mean ?? null),
  other: shareShown(marker.judgeAfter?.mean ?? null),
  delta: deltaOf(
    marker.judgeAfter?.mean ?? null,
    marker.judgeBefore?.mean ?? null,
    'up',
  ),
  note: `Over ${judgeCount(marker.judgeBefore)} judged runs before and ${judgeCount(marker.judgeAfter)} after. Opens how often the judge agrees with people.`,
  to,
});

export const CHANGE_HEADINGS: readonly NestedHeading[] = [
  { label: 'First run', indent: 'edge' },
  { label: 'Line', size: 'minmax(6rem,10rem)' },
  { label: 'Station', size: 'minmax(8rem,14rem)' },
  { label: 'What changed', size: 'minmax(16rem,3fr)' },
  { label: 'Runs before', numeric: true, size: SPREAD },
  { label: 'Runs after', numeric: true, size: SPREAD },
];
