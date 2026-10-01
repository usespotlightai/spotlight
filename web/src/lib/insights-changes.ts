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
import { harnessShown, modelShown, shareShown } from '@/lib/insights';

export type InsightsChanges = InsightsChangesResponseDto;
export type ChangeMarker = ChangeMarkerResponseDto;
export type InsightsSetups = InsightsSetupsResponseDto;
export type SetupOutcome = SetupOutcomeResponseDto;
export type StationStanding = StationStandingResponseDto;
export type SizeBound = SizeBoundResponseDto;
export type JudgeShare = JudgeShareResponseDto;
export type RunSize = SizeBound['size'];
export type OutcomeMeasure = SetupOutcome['frontier'][number];

export type ChangeAt = {
  readonly stationId: string;
  readonly fingerprint: string;
};

export const changeKey = (change: ChangeAt): string =>
  `${change.stationId}:${change.fingerprint}`;

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

export const setupShown = (
  setup: SetupOutcome,
  harnesses: readonly HarnessResponseDto[] | undefined,
): string =>
  [
    harnessShown(harnesses, setup.harness),
    modelShown(setup.model),
    setup.effort ? `${setup.effort} effort` : null,
    setup.profileKey ? `${setup.profileKey} profile` : null,
  ]
    .filter(Boolean)
    .join(' · ');

export type SetupPoint = {
  readonly key: string;
  readonly label: string;
  readonly cost: number;
  readonly value: number;
  readonly runs: number;
  readonly frontier: boolean;
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

const JUDGE_WITHHELD: Record<
  NonNullable<InsightsSetups['judgeWithheld']>,
  string
> = {
  no_station: 'Pick a station to compare judge scores.',
};

export const judgeWithheldShown = (
  reason: InsightsSetups['judgeWithheld'],
): string | null => (reason ? JUDGE_WITHHELD[reason] : null);

export const judgeShown = (share: JudgeShare | null): string =>
  share && share.mean !== null
    ? `${shareShown(share.mean)} over ${share.judged} judged`
    : 'Not judged';
