import type {
  AgentConfigOutcomeResponseDto,
  ChangeMarkerResponseDto,
  HarnessResponseDto,
  InsightsAgentConfigsResponseDto,
  InsightsChangesResponseDto,
  JudgeRateResponseDto,
  SizeBoundResponseDto,
  StationJudgeCalibrationResponseDto,
} from '@/lib/api';
import {
  formatHarness,
  formatModel,
  formatShare,
  shownDeltaOf,
} from '@/lib/insights';
import { type NestedHeading, SPREAD } from '@/lib/nested-table';
import type { ComparedRow } from '@/lib/tally-comparison';

export type InsightsChanges = InsightsChangesResponseDto;
export type ChangeMarker = ChangeMarkerResponseDto;
export type InsightsAgentConfigs = InsightsAgentConfigsResponseDto;
export type AgentConfigOutcome = AgentConfigOutcomeResponseDto;
export type StationJudgeCalibration = StationJudgeCalibrationResponseDto;
export type SizeBound = SizeBoundResponseDto;
type JudgeRate = JudgeRateResponseDto;
export type RunSize = SizeBound['size'];
export type OutcomeMeasure = AgentConfigOutcome['frontier'][number];

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
  { id: 'passed', label: 'Passed on', lowerIsBetter: false },
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

export const formatSize = (size: RunSize): string => SIZES[size];

export const asSize = (raw: string): RunSize | null =>
  RUN_SIZES.find((each) => each === raw) ?? null;

export const formatSizeRule = (bound: SizeBound): string =>
  bound.maxLines === null || bound.maxSteps === null
    ? `${formatSize(bound.size)}: anything bigger`
    : `${formatSize(bound.size)}: up to ${bound.maxLines} changed lines, or ${bound.maxSteps} steps for a run that changed none`;

export const agentConfigKey = (agentConfig: AgentConfigOutcome): string =>
  JSON.stringify([
    agentConfig.harness,
    agentConfig.model,
    agentConfig.effort,
    agentConfig.profileKey,
  ]);

export const formatAgentConfigWithin = (
  agentConfig: AgentConfigOutcome,
): string =>
  [
    formatModel(agentConfig.model),
    agentConfig.effort ? `${agentConfig.effort} effort` : null,
    agentConfig.profileKey ? `${agentConfig.profileKey} profile` : null,
  ]
    .filter(Boolean)
    .join(' · ');

export const formatAgentConfig = (
  agentConfig: AgentConfigOutcome,
  harnesses: readonly HarnessResponseDto[] | undefined,
): string =>
  `${formatHarness(harnesses, agentConfig.harness)} · ${formatAgentConfigWithin(agentConfig)}`;

export type HarnessGroup = {
  readonly harness: string;
  readonly agentConfigs: readonly AgentConfigOutcome[];
};

export const harnessGroupsOf = (
  agentConfigs: readonly AgentConfigOutcome[],
): HarnessGroup[] => {
  const grouped = new Map<string, AgentConfigOutcome[]>();

  for (const agentConfig of agentConfigs) {
    grouped.set(agentConfig.harness, [
      ...(grouped.get(agentConfig.harness) ?? []),
      agentConfig,
    ]);
  }

  return [...grouped].map(([harness, each]) => ({
    harness,
    agentConfigs: each,
  }));
};

export const shownMeasures = (judged: boolean) =>
  OUTCOME_MEASURES.filter((each) => each.id !== 'judge' || judged);

export const agentConfigHeadings = (
  judged: boolean,
): readonly NestedHeading[] => [
  { label: 'Agent config', indent: 'outer', size: 'minmax(12rem,2fr)' },
  { label: 'Runs', numeric: true, size: SPREAD },
  { label: 'Cost per run', numeric: true, size: SPREAD },
  ...shownMeasures(judged).map((each) => ({
    label: each.label,
    numeric: true,
    size: SPREAD,
  })),
];

export type AgentConfigPoint = {
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

export const runsScaleOf = (points: readonly AgentConfigPoint[]): RunsScale => {
  const runs = points.map((each) => each.runs);
  const min = Math.min(...runs);
  const max = Math.max(...runs);
  const middle = Math.round((min + max) / 2);

  return {
    domain: [min, max],
    range: DOT_AREA,
    legend: [...new Set([min, middle, max])],
  };
};

export const dotRadius = (scale: RunsScale, runs: number): number => {
  const [min, max] = scale.domain;
  const [small, large] = scale.range;
  const share = max === min ? 1 : (runs - min) / (max - min);

  return Math.sqrt((small + share * (large - small)) / Math.PI);
};

export const agentConfigPoints = (
  agentConfigs: readonly AgentConfigOutcome[],
  measure: OutcomeMeasure,
  harnesses: readonly HarnessResponseDto[] | undefined,
): AgentConfigPoint[] =>
  agentConfigs.flatMap((agentConfig) => {
    const value = agentConfig.outcomes[measure];

    return !agentConfig.priced ||
      agentConfig.costPerRun === null ||
      value === null
      ? []
      : [
          {
            key: agentConfigKey(agentConfig),
            label: formatAgentConfig(agentConfig, harnesses),
            cost: agentConfig.costPerRun,
            value,
            runs: agentConfig.tally.runs,
            frontier: agentConfig.frontier.includes(measure),
          },
        ];
  });

export const frontierOf = (
  points: readonly AgentConfigPoint[],
): AgentConfigPoint[] =>
  points
    .filter((each) => each.frontier)
    .sort((a, b) => a.cost - b.cost || a.value - b.value);

export const formatOutcome = (value: number | null): string =>
  formatShare(value);

const judgeCount = (rate: JudgeRate | null): number => rate?.judged ?? 0;

export const judgeRow = (marker: ChangeMarker, to: string): ComparedRow => ({
  id: 'judge',
  label: 'Judge score',
  one: formatShare(marker.judgeBefore?.mean ?? null),
  other: formatShare(marker.judgeAfter?.mean ?? null),
  delta: shownDeltaOf(marker.judgeChange),
  tooltip: `Over ${judgeCount(marker.judgeBefore)} judged runs before and ${judgeCount(marker.judgeAfter)} after. Opens how often the judge agrees with people.`,
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
