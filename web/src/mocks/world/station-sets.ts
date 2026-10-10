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
import { DELIVERY_ID, PLATFORM_ID, perWorld, SLUG, world } from '@/mocks/world';
import { history } from '@/mocks/world/insights-history';
import { historyRunOf } from '@/mocks/world/past-work';
import {
  added,
  changed,
  FINGERPRINTS,
  IMPLEMENTATION_ID,
  STATION_ADDRESS,
} from '@/mocks/world/station-history';
import { intervalOf, MIN_GAIN, rounded } from '@/mocks/world/station-measures';
import { stationRuns } from '@/mocks/world/station-outcomes';
import { SET_PICKS, type SetPick } from '@/mocks/world/station-seeds';
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
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly repositories: readonly string[];
};

export type StationPlace = {
  readonly teamId: string;
  readonly teamKey: string;
  readonly lineId: string;
  readonly lineKey: string;
  readonly lineName: string;
  readonly stationId: string;
  readonly stationKey: string;
  readonly stationName: string;
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

export const teamOfLine = (lineId: string): string | undefined =>
  Object.entries(world().lines).find(([, lines]) =>
    lines.some((line) => line.id === lineId),
  )?.[0];

const placeOf = (
  lineId: string,
  stationId: string,
): StationPlace | undefined => {
  const teamId = teamOfLine(lineId);
  const line = world().lines[teamId ?? '']?.find((each) => each.id === lineId);
  const station = line?.stations.find((each) => each.id === stationId);
  const team = world().workspace.teams.find((each) => each.id === teamId);

  return teamId && line && station && team
    ? {
        teamId,
        teamKey: team.name.toLowerCase(),
        lineId,
        lineKey: line.key,
        lineName: line.name,
        stationId,
        stationKey: station.key,
        stationName: station.name,
      }
    : undefined;
};

const found = new WeakMap<object, Map<string, StationRunFound[]>>();

const runsAt = (
  teamId: string,
  lineId: string,
  stationId: string,
): StationRunFound[] => {
  const source = history();
  const known = found.get(source) ?? new Map<string, StationRunFound[]>();
  const key = `${teamId}/${lineId}/${stationId}`;
  const cached = known.get(key);

  if (cached) {
    return cached;
  }

  const made = stationRuns(teamId, lineId, stationId).runs.map(
    ({ title, outcome }) => ({
      runId: outcome.runId,
      taskId: outcome.taskId,
      title,
      endedAt: outcome.endedAt,
      state: outcome.ending,
      outcome: outcomeOf(outcome),
      note: taskNote(outcome.taskId, stationId),
      teamId,
      lineId,
      stationId,
      repositories: historyRunOf(outcome.runId)?.repositories ?? [],
    }),
  );
  known.set(key, made);
  found.set(source, known);

  return made;
};

export const runOfStation = (runId: string): StationRunFound | undefined => {
  const run = historyRunOf(runId);

  return run
    ? runsAt(run.teamId, run.lineId, run.stationId).find(
        (each) => each.runId === runId,
      )
    : undefined;
};

const hoursSince = (at: string): number =>
  (Date.now() - Date.parse(at)) / 3_600_000;

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
      entry('run_invoice_split_1', 118, 'slack'),
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

const KEPT_FOR_SETS_HOURS = 600;

const TELLING: readonly Outcome[] = ['sent-back', 'failed'];

const matchingFirst = (
  runs: readonly StationRunFound[],
  matching: RegExp,
): StationRunFound[] => {
  const telling = (run: StationRunFound) => TELLING.includes(run.outcome);
  const matched = runs.filter((run) => matching.test(run.title));
  const ordered = [
    ...matched.filter(telling),
    ...matched,
    ...runs.filter((run) => !matching.test(run.title)),
  ];

  return ordered.filter(
    (run, place) =>
      ordered.findIndex((each) => each.taskId === run.taskId) === place,
  );
};

const runsOfPick = (pick: SetPick): StationRunFound[] =>
  runsAt(teamOfLine(pick.lineId) ?? '', pick.lineId, pick.stationId);

const setOfPick = (pick: SetPick): SetSpec => {
  const older = runsOfPick(pick).filter((run) => {
    const ago = hoursSince(run.endedAt);
    return ago > pick.createdHoursAgo + 2 && ago < KEPT_FOR_SETS_HOURS;
  });

  return {
    id: pick.id,
    name: pick.name,
    lineId: pick.lineId,
    stationId: pick.stationId,
    createdHoursAgo: pick.createdHoursAgo,
    guardsChanges: pick.guardsChanges,
    entries: matchingFirst(older, pick.matching)
      .slice(0, pick.count)
      .map((run, place) =>
        entry(
          run.runId,
          pick.createdHoursAgo - place * 0.01,
          pick.origins[place % pick.origins.length],
        ),
      ),
    health: pick.health,
  };
};

export const setStore = perWorld((kind): SetSpec[] =>
  kind === 'empty'
    ? []
    : [...structuredClone([...SEEDED_SETS]), ...SET_PICKS.map(setOfPick)],
);

export const setSpec = (setId: string): SetSpec | undefined =>
  setStore().find((each) => each.id === setId);

export const teamOfSet = (setId: string): string | undefined => {
  const set = setSpec(setId);
  return set ? teamOfLine(set.lineId) : undefined;
};

export const placeOfSet = (setId: string): StationPlace | undefined => {
  const set = setSpec(setId);
  return set ? placeOf(set.lineId, set.stationId) : undefined;
};

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
  teamId: string,
  lineId: string,
  stationId: string,
): ReplayableRunResponseDto[] =>
  runsAt(teamId, lineId, stationId).map((run) => {
    const gone = hoursSince(run.endedAt) > ARCHIVE_KEPT_HOURS;

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
  });

const SUGGESTED: Record<string, readonly string[]> = {
  set_billing_work: [
    'run_billing_1',
    'run_invoice_rounding_1',
    'run_refunds_2',
  ],
};

const SUGGESTED_PER_SET = 3;

const suggestedRuns = (spec: SetSpec): readonly string[] => {
  const pick = SET_PICKS.find((each) => each.id === spec.id);

  if (!pick) {
    return SUGGESTED[spec.id] ?? [];
  }

  const newer = runsOfPick(pick).filter(
    (run) =>
      hoursSince(run.endedAt) < pick.createdHoursAgo && run.state !== 'stopped',
  );

  return matchingFirst(newer, pick.matching)
    .slice(0, SUGGESTED_PER_SET)
    .map((run) => run.runId);
};

export const suggestionsFor = (spec: SetSpec): SuggestedRunResponseDto[] =>
  suggestedRuns(spec)
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

const replayUrl = (place: StationPlace, replayId: string): string =>
  `/w/${SLUG}/team/${place.teamId}/lines/${place.lineId}/stations/${place.stationId}/replays/${replayId}`;

type CheckSeed = Partial<
  Omit<ReplayCheckSummaryResponseDto, 'replayUrl' | 'createdAt'>
> &
  Pick<ReplayCheckSummaryResponseDto, 'id' | 'verdict' | 'reference'> & {
    readonly hoursAgo: number;
    readonly replayId?: string;
  };

const CHECKS: Record<string, readonly CheckSeed[]> = {
  set_billing_work: [
    {
      id: 'check_shorter_prompt',
      verdict: 'running',
      reference: { commit: '9f1c2ab7d3e4', pullRequest: 61 },
      hoursAgo: 0.3,
    },
    {
      id: 'check_tests_first',
      verdict: 'passed',
      reference: { commit: '41d0e9c2b6aa', pullRequest: 58 },
      hoursAgo: 88,
      replayId: 'replay_tf_tests_first',
    },
    {
      id: 'check_haiku',
      verdict: 'failed',
      regressions: 2,
      reference: { commit: 'c07a55e1f9b2', pullRequest: 55 },
      hoursAgo: 102,
      replayId: 'replay_sl_haiku',
    },
    {
      id: 'check_effort_bump',
      verdict: 'undecided',
      undecidedBecause: 'over-ceiling',
      attempt: 2,
      reference: { commit: '7ad3e90b14c2', pullRequest: null },
      hoursAgo: 130,
    },
  ],
  set_triage_billing: [
    {
      id: 'check_triage_sonnet',
      verdict: 'passed',
      reference: { commit: 'a41c7e9d02b5', pullRequest: null },
      hoursAgo: 29.7,
      replayId: 'replay_triage_sonnet',
    },
  ],
  set_review_money: [
    {
      id: 'check_review_risk_checklist',
      verdict: 'passed',
      reference: { commit: '3be81f0c5d27', pullRequest: null },
      hoursAgo: 39.6,
      replayId: 'replay_review_risk_checklist',
    },
  ],
  set_spec_api: [
    {
      id: 'check_spec_sonnet',
      verdict: 'undecided',
      undecidedBecause: 'too-few-scored',
      reference: { commit: 'e94a07d1c3b8', pullRequest: null },
      hoursAgo: 72,
    },
  ],
  set_incident_data: [
    {
      id: 'check_investigate_opus',
      verdict: 'failed',
      regressions: 1,
      reference: { commit: '0d6b3f8a91ce', pullRequest: null },
      hoursAgo: 46.6,
      replayId: 'replay_sin_opus',
    },
  ],
  set_incident_customer: [
    {
      id: 'check_mitigate_runbook',
      verdict: 'running',
      reference: { commit: '7e2a90c4b1d3', pullRequest: null },
      hoursAgo: 0.5,
    },
  ],
  set_experiment_variants: [
    {
      id: 'check_build_medium_effort',
      verdict: 'passed',
      reference: { commit: 'b59d1e7f3a06', pullRequest: null },
      hoursAgo: 29.2,
      replayId: 'replay_sbu_medium_effort',
    },
  ],
  set_experiment_pricing: [
    {
      id: 'check_design_metric_first',
      verdict: 'running',
      reference: { commit: '58c2d9e0a71f', pullRequest: 66 },
      hoursAgo: 0.2,
    },
  ],
};

const checkOf = (
  place: StationPlace,
  { hoursAgo: at, replayId, ...rest }: CheckSeed,
): ReplayCheckSummaryResponseDto => ({
  stationId: place.stationId,
  stationKey: place.stationKey,
  undecidedBecause: null,
  regressions: 0,
  attempt: 1,
  createdAt: hoursAgo(at),
  replayUrl: replayId ? replayUrl(place, replayId) : null,
  ...rest,
});

export const checksFor = (
  setId: string,
  limit: number,
  before: string | undefined,
): ReplayCheckSummaryResponseDto[] => {
  const place = placeOfSet(setId);
  const all = place
    ? (CHECKS[setId] ?? []).map((each) => checkOf(place, each))
    : [];
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
