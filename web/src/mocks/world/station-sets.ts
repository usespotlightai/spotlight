import type {
  ReplayableRunResponseDto,
  ReplayCandidateResourceResponseDto,
  ReplayCheckSummaryResponseDto,
  ReplaySetEntryResponseDto,
  ReplaySetResponseDto,
  SetCompositionResponseDto,
  SetHealthResponseDto,
  StationRunOutcomeResponseDto,
  SuggestedRunResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { DELIVERY_ID, PLATFORM_ID, perWorld, SLUG } from '@/mocks/world';
import {
  added,
  changed,
  FINGERPRINTS,
  IMPLEMENTATION_ID,
  STATION_ADDRESS,
} from '@/mocks/world/station-history';
import { intervalOf, MIN_GAIN, rounded } from '@/mocks/world/station-measures';
import { stationRuns } from '@/mocks/world/station-outcomes';
import { taskNote } from '@/mocks/world/station-tasks';

type Outcome = ReplaySetEntryResponseDto['outcome'];

export type StationRunFound = {
  readonly runId: string;
  readonly taskId: string;
  readonly title: string;
  readonly endedAt: string;
  readonly state: string;
  readonly outcome: Outcome;
  readonly note: ReturnType<typeof taskNote>;
};

const outcomeOf = (run: StationRunOutcomeResponseDto): Outcome => {
  if (run.ending === 'failed') {
    return 'failed';
  }
  if (run.next?.act === 'closed') {
    return 'accepted';
  }
  if (run.next?.act === 'sent-back') {
    return 'sent-back';
  }
  if (run.next?.act === 'answered') {
    return 'asked';
  }

  return 'other';
};

const implementationRuns = (): StationRunFound[] =>
  stationRuns(PLATFORM_ID, DELIVERY_ID, IMPLEMENTATION_ID).runs.map(
    ({ title, outcome }) => ({
      runId: outcome.runId,
      taskId: outcome.taskId,
      title,
      endedAt: outcome.endedAt,
      state: outcome.ending,
      outcome: outcomeOf(outcome),
      note: taskNote(outcome.taskId),
    }),
  );

export const runOfStation = (runId: string): StationRunFound | undefined =>
  implementationRuns().find((each) => each.runId === runId);

type SetEntrySpec = {
  readonly runId: string;
  readonly addedHoursAgo: number;
  readonly origin: string;
};

export type SetSpec = {
  readonly id: string;
  name: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly createdHoursAgo: number;
  guardsChanges: boolean;
  entries: SetEntrySpec[];
  readonly health: SetHealthResponseDto;
};

export const NO_HEALTH: SetHealthResponseDto = {
  noise: null,
  saturation: null,
  judge: null,
  checks: null,
  sanity: null,
};

const BILLING_HEALTH: SetHealthResponseDto = {
  noise: null,
  saturation: {
    replayId: 'replay_live_4',
    rate: rounded(5 / 7),
    interval: intervalOf(5, 7),
    saturated: false,
    measuredAt: hoursAgo(48.8),
  },
  judge: {
    replayId: 'replay_live_4',
    compared: 7,
    agreed: 6,
    pending: 0,
    agreement: rounded(6 / 7),
    unstable: false,
  },
  checks: { replayId: 'replay_live_4', rechecked: 7, pending: 0, flaky: [] },
  sanity: null,
};

const entry = (
  runId: string,
  addedHoursAgo: number,
  origin = 'person',
): SetEntrySpec => ({ runId, addedHoursAgo, origin });

const SEEDED_SETS: readonly SetSpec[] = [
  {
    id: 'set_billing_work',
    name: 'Billing work',
    lineId: DELIVERY_ID,
    stationId: IMPLEMENTATION_ID,
    createdHoursAgo: 140,
    guardsChanges: true,
    entries: [
      entry('run_flaky_billing_2', 108),
      entry('run_invoice_split_1', 139, 'slack'),
      entry('run_billing_worker_1', 139),
      entry('run_pricing_cache_1', 139),
      entry('run_refunds_1', 139, 'slack'),
      entry('run_coupons_1', 139),
      entry('run_vat_1', 139),
    ],
    health: BILLING_HEALTH,
  },
  {
    id: 'set_docs',
    name: 'Two docs tasks',
    lineId: DELIVERY_ID,
    stationId: IMPLEMENTATION_ID,
    createdHoursAgo: 40,
    guardsChanges: false,
    entries: [
      entry('run_webhook_docs_1', 40),
      entry('run_export_docs_1', 39.8),
    ],
    health: NO_HEALTH,
  },
];

export const setStore = perWorld((kind): SetSpec[] =>
  kind === 'empty' ? [] : structuredClone([...SEEDED_SETS]),
);

export const setSpec = (setId: string): SetSpec | undefined =>
  setStore().find((each) => each.id === setId);

const OUTCOMES: readonly Outcome[] = [
  'accepted',
  'sent-back',
  'asked',
  'failed',
  'other',
];

const compositionOf = (
  entries: readonly ReplaySetEntryResponseDto[],
): SetCompositionResponseDto => {
  const ended = entries
    .flatMap((each) => (each.endedAt ? [each.endedAt] : []))
    .sort();
  const origins = [...new Set(entries.map((each) => each.origin ?? 'person'))];
  const counts = OUTCOMES.map((outcome) => ({
    outcome,
    count: entries.filter((each) => each.outcome === outcome).length,
  }));
  const dominant = counts.find(
    (each) => entries.length >= 6 && each.count / entries.length > 0.7,
  );

  return {
    outcomes: counts,
    origins: origins.map((origin) => ({
      origin,
      count: entries.filter((each) => (each.origin ?? 'person') === origin)
        .length,
    })),
    oldest: ended[0] ?? null,
    median: ended[Math.floor(ended.length / 2)] ?? null,
    newest: ended[ended.length - 1] ?? null,
    balanceWarning: dominant
      ? {
          dominant: dominant.outcome,
          count: dominant.count,
          entries: entries.length,
        }
      : null,
  };
};

const entryOfSet = (entrySpec: SetEntrySpec): ReplaySetEntryResponseDto => {
  const run = runOfStation(entrySpec.runId);

  return {
    runId: entrySpec.runId,
    taskId: run?.taskId ?? '',
    title: run?.title ?? null,
    state: run?.state ?? null,
    endedAt: run?.endedAt ?? null,
    addedAt: hoursAgo(entrySpec.addedHoursAgo),
    refusal: null,
    reason: null,
    outcome: run?.outcome ?? 'other',
    origin: entrySpec.origin,
  };
};

export const replaySetOf = (spec: SetSpec): ReplaySetResponseDto => {
  const entries = spec.entries.map(entryOfSet);

  return {
    id: spec.id,
    lineId: spec.lineId,
    stationId: spec.stationId,
    name: spec.name,
    createdAt: hoursAgo(spec.createdHoursAgo),
    stationGone: false,
    guardsChanges: spec.guardsChanges,
    health: spec.health,
    minGain: MIN_GAIN,
    composition: compositionOf(entries),
    entries,
  };
};

const ARCHIVE_KEPT_HOURS = 700;

export const replayableRuns = (
  stationId: string,
): ReplayableRunResponseDto[] =>
  stationId === IMPLEMENTATION_ID
    ? implementationRuns().map((run) => {
        const gone =
          Date.now() - Date.parse(run.endedAt) > ARCHIVE_KEPT_HOURS * 3_600_000;

        return {
          runId: run.runId,
          taskId: run.taskId,
          title: run.title,
          state: run.state,
          endedAt: run.endedAt,
          refusal: gone ? 'archive-gone' : null,
          reason: gone
            ? 'the workspace archive it started from is no longer kept'
            : null,
        };
      })
    : [];

const SUGGESTED: Record<string, readonly string[]> = {
  set_billing_work: [
    'run_billing_1',
    'run_invoice_rounding_1',
    'run_refunds_2',
  ],
};

export const suggestionsFor = (spec: SetSpec): SuggestedRunResponseDto[] =>
  (SUGGESTED[spec.id] ?? [])
    .filter((runId) => !spec.entries.some((each) => each.runId === runId))
    .flatMap((runId) => {
      const run = runOfStation(runId);

      return run
        ? [
            {
              runId,
              taskId: run.taskId,
              title: run.title,
              state: run.state,
              endedAt: run.endedAt,
              refusal: null,
              reason: null,
              outcome: run.outcome,
            },
          ]
        : [];
    });

const replayUrl = (replayId: string): string =>
  `/w/${SLUG}/team/${PLATFORM_ID}/lines/${DELIVERY_ID}/stations/${IMPLEMENTATION_ID}/replays/${replayId}`;

const check = (
  over: Partial<ReplayCheckSummaryResponseDto> &
    Pick<ReplayCheckSummaryResponseDto, 'id' | 'verdict' | 'reference'> & {
      hoursAgo: number;
    },
): ReplayCheckSummaryResponseDto => {
  const { hoursAgo: at, ...rest } = over;

  return {
    stationId: IMPLEMENTATION_ID,
    stationKey: 'implementation',
    undecidedBecause: null,
    regressions: 0,
    attempt: 1,
    createdAt: hoursAgo(at),
    replayUrl: null,
    ...rest,
  };
};

const CHECKS: Record<string, readonly ReplayCheckSummaryResponseDto[]> = {
  set_billing_work: [
    check({
      id: 'check_shorter_prompt',
      verdict: 'running',
      reference: { commit: '9f1c2ab7d3e4', pullRequest: 61 },
      hoursAgo: 0.3,
    }),
    check({
      id: 'check_tests_first',
      verdict: 'passed',
      reference: { commit: '41d0e9c2b6aa', pullRequest: 58 },
      hoursAgo: 88,
      replayUrl: replayUrl('replay_tf_tests_first'),
    }),
    check({
      id: 'check_haiku',
      verdict: 'failed',
      regressions: 2,
      reference: { commit: 'c07a55e1f9b2', pullRequest: 55 },
      hoursAgo: 102,
      replayUrl: replayUrl('replay_sl_haiku'),
    }),
    check({
      id: 'check_effort_bump',
      verdict: 'undecided',
      undecidedBecause: 'over-ceiling',
      attempt: 2,
      reference: { commit: '7ad3e90b14c2', pullRequest: null },
      hoursAgo: 130,
    }),
  ],
};

export const checksFor = (
  setId: string,
  limit: number,
  before: string | undefined,
): ReplayCheckSummaryResponseDto[] => {
  const all = setSpec(setId) ? (CHECKS[setId] ?? []) : [];
  const from = before ? all.findIndex((each) => each.id === before) + 1 : 0;

  return all.slice(from, from + limit);
};

const resource = (
  id: string,
  name: string,
  slug: string,
  fingerprint: string,
  changes: ReplayCandidateResourceResponseDto['changedFrom']['changes'],
  createdHoursAgo: number,
): ReplayCandidateResourceResponseDto => ({
  id,
  version: 0,
  address: `${STATION_ADDRESS}/${slug}`,
  warnings: [],
  teamId: PLATFORM_ID,
  lineId: DELIVERY_ID,
  stationId: IMPLEMENTATION_ID,
  stationAddress: STATION_ADDRESS,
  name,
  kind: 'proposed',
  station: { key: 'implementation' },
  fingerprint,
  changedFrom: { fingerprint: FINGERPRINTS.tests, changes },
  createdAt: hoursAgo(createdHoursAgo),
});

const RESOURCES: readonly ReplayCandidateResourceResponseDto[] = [
  resource(
    'candidate_shorter_prompt',
    'Shorter prompt',
    'shorter-prompt',
    FINGERPRINTS.shorter,
    [changed('prompt'), changed('effort', 'high', 'medium')],
    5,
  ),
  resource(
    'candidate_migrations_skill',
    'Migrations skill',
    'migrations-skill',
    'f2a4c6e8b0d1f3a5c7e9b2d4f6a8c0e1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f2a4',
    [added('skill', 'our-migrations')],
    20,
  ),
];

export const resourceCandidates = perWorld((kind) =>
  kind === 'empty' ? [] : [...RESOURCES],
);
