import type {
  CandidateResponseDto,
  ConfigChangeResponseDto,
  MoneyResponseDto,
  SetHealthResponseDto,
} from '@/lib/api';
import { hoursAgo } from '@/mocks/clock';
import { DELIVERY_ID, EXPERIMENTS_ID, INCIDENTS_ID } from '@/mocks/world';
import { profileOf } from '@/mocks/world/insights-profiles';
import { added, changed } from '@/mocks/world/station-history';
import { intervalOf, rounded } from '@/mocks/world/station-measures';
import type { SearchSpec } from '@/mocks/world/station-searches';

export type SetPick = {
  readonly id: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly createdHoursAgo: number;
  readonly count: number;
  readonly matching: RegExp;
  readonly origins: readonly string[];
  readonly health: SetHealthResponseDto;
};

export type SetPart = 'all' | 'searched' | 'held-out';

export type ReplaySeed = {
  readonly id: string;
  readonly setId: string;
  readonly candidate: CandidateResponseDto;
  readonly agent: { readonly model: string; readonly effort: string };
  readonly part: SetPart;
  readonly marks: string;
  readonly startedHoursAgo: number;
  readonly endedHoursAgo: number | null;
  readonly costFactor: number;
  readonly baseline?: boolean;
  readonly referenceReplayId?: string;
  readonly listed?: boolean;
  readonly search?: { searchId: string; candidateName: string };
};

export type SearchSeed = Omit<SearchSpec, 'searched' | 'heldOut'>;

const TRIAGE_ID = 'station_triage';
const SPEC_ID = 'station_spec';
const REVIEW_ID = 'station_review';
const INVESTIGATE_ID = 'station_investigate';
const MITIGATE_ID = 'station_mitigate';
const DESIGN_ID = 'station_design';
const BUILD_ID = 'station_build';

const health = (
  replayId: string,
  succeeded: number,
  of: number,
  measuredHoursAgo: number,
  over: Partial<SetHealthResponseDto> = {},
): SetHealthResponseDto => ({
  noise: null,
  saturation: {
    replayId,
    rate: rounded(succeeded / of),
    interval: intervalOf(succeeded, of),
    saturated: false,
    measuredAt: hoursAgo(measuredHoursAgo),
  },
  judge: null,
  checks: null,
  oracle: null,
  ...over,
});

const agreement = (replayId: string, compared: number, agreed: number) => ({
  replayId,
  compared,
  agreed,
  pending: 0,
  agreement: rounded(agreed / compared),
  unstable: false,
});

export const SET_PICKS: readonly SetPick[] = [
  {
    id: 'set_triage_billing',
    lineId: DELIVERY_ID,
    stationId: TRIAGE_ID,
    createdHoursAgo: 130,
    count: 6,
    matching:
      /refund|charge|invoice|payment|stripe|coupon|dunning|billing|pricing|plan|receipt|credit/i,
    origins: ['person', 'slack', 'github'],
    health: health('replay_triage_live_1', 4, 6, 127.8),
  },
  {
    id: 'set_spec_api',
    lineId: DELIVERY_ID,
    stationId: SPEC_ID,
    createdHoursAgo: 110,
    count: 7,
    matching: /api|post |get |429|endpoint|webhook|subscriptions/i,
    origins: ['station'],
    health: health('replay_spec_live_1', 5, 7, 107.6),
  },
  {
    id: 'set_review_money',
    lineId: DELIVERY_ID,
    stationId: REVIEW_ID,
    createdHoursAgo: 100,
    count: 7,
    matching:
      /payment|refund|charge|invoice|index|table|backfill|card|balance|credit/i,
    origins: ['station'],
    health: health('replay_review_live_2', 5, 7, 97.7, {
      judge: agreement('replay_review_live_2', 7, 6),
    }),
  },
  {
    id: 'set_incident_data',
    lineId: INCIDENTS_ID,
    stationId: INVESTIGATE_ID,
    createdHoursAgo: 100,
    count: 6,
    matching: /database|replica|queue|cron|disk|memory|worker/i,
    origins: ['slack'],
    health: health('replay_investigate_live_1', 4, 6, 95.7),
  },
  {
    id: 'set_incident_customer',
    lineId: INCIDENTS_ID,
    stationId: MITIGATE_ID,
    createdHoursAgo: 90,
    count: 6,
    matching: /checkout|502|webhook|payments|logins|gateway/i,
    origins: ['station'],
    health: health('replay_mitigate_live_1', 5, 6, 87.8),
  },
  {
    id: 'set_experiment_pricing',
    lineId: EXPERIMENTS_ID,
    stationId: DESIGN_ID,
    createdHoursAgo: 70,
    count: 6,
    matching: /pricing|plans|trial|cancellation|savings|sign-up|usage/i,
    origins: ['person', 'person', 'slack'],
    health: health('replay_design_live_1', 4, 6, 67.6, {
      judge: agreement('replay_design_live_1', 6, 5),
    }),
  },
  {
    id: 'set_experiment_variants',
    lineId: EXPERIMENTS_ID,
    stationId: BUILD_ID,
    createdHoursAgo: 80,
    count: 6,
    matching: /test|try|show|nudge|simplify/i,
    origins: ['station'],
    health: health('replay_build_live_1', 5, 6, 77.5, {
      checks: {
        replayId: 'replay_build_live_1',
        rechecked: 6,
        pending: 0,
        flaky: [],
      },
    }),
  },
];

const candidate = (
  stationKey: string,
  id: string,
  name: string,
  kind: CandidateResponseDto['kind'],
  fingerprint: string,
  createdHoursAgo: number,
): CandidateResponseDto => ({
  id,
  name,
  kind,
  fingerprint,
  station: { key: stationKey },
  createdAt: hoursAgo(createdHoursAgo),
});

const liveFingerprint = (stationId: string): string =>
  profileOf(stationId)?.versions.at(-1)?.fingerprint ?? '';

const PLATFORM_HISTORY_HOURS = 182 * 24;
const GROWTH_HISTORY_HOURS = 64 * 24;

const live = (stationId: string, key: string, version = 1, since?: number) =>
  candidate(
    key,
    `candidate_${key}_live_${version}`,
    `live-${version}`,
    'live',
    liveFingerprint(stationId),
    since ?? PLATFORM_HISTORY_HOURS,
  );

export const LIVE_CANDIDATES: Record<string, CandidateResponseDto> = {
  [TRIAGE_ID]: live(TRIAGE_ID, 'triage'),
  [SPEC_ID]: live(SPEC_ID, 'spec'),
  [REVIEW_ID]: live(REVIEW_ID, 'review', 2, 9 * 24),
  [INVESTIGATE_ID]: live(INVESTIGATE_ID, 'investigate'),
  [MITIGATE_ID]: live(MITIGATE_ID, 'mitigate'),
  [DESIGN_ID]: live(DESIGN_ID, 'design', 1, GROWTH_HISTORY_HOURS),
  [BUILD_ID]: live(BUILD_ID, 'build', 1, GROWTH_HISTORY_HOURS),
};

const liveOf = (stationId: string): CandidateResponseDto =>
  LIVE_CANDIDATES[stationId] as CandidateResponseDto;

const SEEDED = {
  triageSonnet: candidate(
    'triage',
    'candidate_triage_sonnet',
    'Sonnet for triage',
    'proposed',
    'a385f4fbf6ef442cb0bbc1396be3048dcafd7937114be53ceeb193611334ca42',
    31,
  ),
  triageRepro: candidate(
    'triage',
    'candidate_triage_repro_first',
    'repro-before-reading',
    'searched',
    'af3608df82962971b32ceed0e42c9ee8d9cc0cb16ca53b270f92eb53f70d3260',
    2.5,
  ),
  triageLogs: candidate(
    'triage',
    'candidate_triage_logs_first',
    'logs-first',
    'searched',
    '3a0925cc6313187406666299cf60df0456d1ae43984882f6dc2d99404fdf06dd',
    1.2,
  ),
  specSonnet: candidate(
    'spec',
    'candidate_spec_sonnet',
    'sonnet-specs',
    'searched',
    '00d74b08f04791c21c2c68efe6ef4b651bbb334ff2909c9c205f7670bbfc943f',
    79.5,
  ),
  specTemplate: candidate(
    'spec',
    'candidate_spec_template',
    'spec-template',
    'searched',
    '3d26970ccf18e7a01c89f5b11a1487943d79bc3a97c6fd47e21a29fdbd772e0e',
    79.5,
  ),
  specSonnetHigh: candidate(
    'spec',
    'candidate_spec_sonnet_high',
    'sonnet-high-effort',
    'searched',
    '577e2b83f9e12cf8319f6f97f7f5edada891c7b34b1cd6463d58a193adb1ec47',
    77.2,
  ),
  reviewChecklist: candidate(
    'review',
    'candidate_review_risk_checklist',
    'Risk checklist',
    'proposed',
    'c3fac256f0bff6a151eda368fd5ebaa2026d1ac8b30ff36475c54d573b872e78',
    41,
  ),
  reviewRisk: candidate(
    'review',
    'candidate_review_risk',
    'risk-checklist',
    'searched',
    'c3fac256f0bff6a151eda368fd5ebaa2026d1ac8b30ff36475c54d573b872e78',
    59.6,
  ),
  reviewHigh: candidate(
    'review',
    'candidate_review_high_effort',
    'high-effort',
    'searched',
    '2cba477c7a8b665832779f5277431f1a3a7640df7071e1400518c15d69b44c51',
    59.6,
  ),
  reviewMigrations: candidate(
    'review',
    'candidate_review_migrations',
    'migrations-skill',
    'searched',
    'e4d5c41f01f1f2cfe035683bb3e8e91fae590bc7289665d50343b19b78edb1d6',
    57.4,
  ),
  investigateLogs: candidate(
    'investigate',
    'candidate_investigate_logs_first',
    'logs-before-dashboards',
    'searched',
    'dd40f54e422526633e9dc0825a816c85bc2297e13c12e7d1406467166a7db27a',
    49.6,
  ),
  investigateOpus: candidate(
    'investigate',
    'candidate_investigate_opus',
    'opus',
    'searched',
    '9cf5927af982659b766ff15bc836748582c5e8aa82b41612e9896dbac4773681',
    47.4,
  ),
  mitigateRunbook: candidate(
    'mitigate',
    'candidate_mitigate_runbook',
    'Runbook first',
    'proposed',
    '263f69dde257cfdbde319ad653e5c99dd814997b684f67d2aae1c2566b5e9fe4',
    1,
  ),
  mitigateHaiku: candidate(
    'mitigate',
    'candidate_mitigate_haiku',
    'haiku',
    'searched',
    'ce74c6901f184e5bf5c0f5366b8b5ff3d3c457b1bcd5e5b9a62e49e472bc2099',
    19.6,
  ),
  designMetric: candidate(
    'design',
    'candidate_design_metric_first',
    'metric-reading-first',
    'searched',
    '5532eb5ef5b237b8e12d01424fb449bf1cb41e59cbfe6aa05044c4f8d9e11245',
    39.6,
  ),
  designBriefs: candidate(
    'design',
    'candidate_design_briefs',
    'experiment-briefs-skill',
    'searched',
    '4fe75c69f9c9894a78ad8523b560086c9e22cc9a3399841cf9262686e186a466',
    39.6,
  ),
  designSonnet: candidate(
    'design',
    'candidate_design_sonnet',
    'sonnet',
    'searched',
    '2f42ff1a1c20108628fc1be9ae22cfa0b4dab358a0cba8766f9f12fb8fdc4922',
    37.4,
  ),
  buildMedium: candidate(
    'build',
    'candidate_build_medium_effort',
    'medium-effort',
    'searched',
    'cc1e2a48d550b2707eb37e2dca8830d58c232066a8ddc21e2755cd0da49163a2',
    29.6,
  ),
  buildChecklist: candidate(
    'build',
    'candidate_build_flag_checklist',
    'flag-checklist',
    'searched',
    '6c650907d2eec58d2a827cb5fc2a0c6859c8a9d6459169a23b9306572418965c',
    29.6,
  ),
} as const;

export const PROPOSED_CHANGES: Record<
  string,
  readonly ConfigChangeResponseDto[]
> = {
  candidate_shorter_prompt: [
    changed('prompt'),
    changed('effort', 'high', 'medium'),
  ],
  candidate_triage_sonnet: [changed('model', 'haiku', 'sonnet')],
  candidate_review_risk_checklist: [changed('prompt')],
  candidate_mitigate_runbook: [added('skill', 'incident-runbooks')],
};

const HAIKU_LOW = { model: 'haiku', effort: 'low' };
const OPUS_MEDIUM = { model: 'opus', effort: 'medium' };
const SONNET_MEDIUM = { model: 'sonnet', effort: 'medium' };
const SONNET_HIGH = { model: 'sonnet', effort: 'high' };
const GPT_MEDIUM = { model: 'gpt-5', effort: 'medium' };

const ofSearch = (searchId: string, candidateName: string) => ({
  searchId,
  candidateName,
});

export const REPLAY_SEEDS: readonly ReplaySeed[] = [
  {
    id: 'replay_triage_live_1',
    setId: 'set_triage_billing',
    candidate: liveOf(TRIAGE_ID),
    agent: HAIKU_LOW,
    part: 'all',
    marks: 'SSFSSF',
    startedHoursAgo: 128,
    endedHoursAgo: 127.8,
    costFactor: 0.2,
    baseline: true,
    listed: true,
  },
  {
    id: 'replay_triage_sonnet',
    setId: 'set_triage_billing',
    candidate: SEEDED.triageSonnet,
    agent: { model: 'sonnet', effort: 'low' },
    part: 'all',
    marks: 'SSSSSF',
    startedHoursAgo: 30,
    endedHoursAgo: 29.7,
    costFactor: 0.6,
    referenceReplayId: 'replay_triage_live_1',
    listed: true,
  },
  {
    id: 'replay_str_seed',
    setId: 'set_triage_billing',
    candidate: liveOf(TRIAGE_ID),
    agent: HAIKU_LOW,
    part: 'searched',
    marks: 'SSFSF',
    startedHoursAgo: 3,
    endedHoursAgo: 2.8,
    costFactor: 0.2,
    search: ofSearch('search_triage_repro', 'seed'),
  },
  {
    id: 'replay_str_repro_first',
    setId: 'set_triage_billing',
    candidate: SEEDED.triageRepro,
    agent: HAIKU_LOW,
    part: 'searched',
    marks: 'SSSSF',
    startedHoursAgo: 2.4,
    endedHoursAgo: 2.1,
    costFactor: 0.25,
    referenceReplayId: 'replay_str_seed',
    search: ofSearch('search_triage_repro', SEEDED.triageRepro.name),
  },
  {
    id: 'replay_str_logs_first',
    setId: 'set_triage_billing',
    candidate: SEEDED.triageLogs,
    agent: HAIKU_LOW,
    part: 'searched',
    marks: 'SFrww',
    startedHoursAgo: 1.1,
    endedHoursAgo: null,
    costFactor: 0.25,
    referenceReplayId: 'replay_str_seed',
    search: ofSearch('search_triage_repro', SEEDED.triageLogs.name),
  },
  {
    id: 'replay_spec_live_1',
    setId: 'set_spec_api',
    candidate: liveOf(SPEC_ID),
    agent: OPUS_MEDIUM,
    part: 'all',
    marks: 'SFSSSFS',
    startedHoursAgo: 108,
    endedHoursAgo: 107.6,
    costFactor: 0.9,
    baseline: true,
    listed: true,
  },
  {
    id: 'replay_ssp_seed',
    setId: 'set_spec_api',
    candidate: liveOf(SPEC_ID),
    agent: OPUS_MEDIUM,
    part: 'searched',
    marks: 'SFSSS',
    startedHoursAgo: 80,
    endedHoursAgo: 79.6,
    costFactor: 0.9,
    search: ofSearch('search_spec_cost', 'seed'),
  },
  {
    id: 'replay_ssp_seed_held_out',
    setId: 'set_spec_api',
    candidate: liveOf(SPEC_ID),
    agent: OPUS_MEDIUM,
    part: 'held-out',
    marks: 'FS',
    startedHoursAgo: 75,
    endedHoursAgo: 74.8,
    costFactor: 0.9,
    search: ofSearch('search_spec_cost', 'seed'),
  },
  {
    id: 'replay_ssp_sonnet',
    setId: 'set_spec_api',
    candidate: SEEDED.specSonnet,
    agent: SONNET_MEDIUM,
    part: 'searched',
    marks: 'SFSSS',
    startedHoursAgo: 79.4,
    endedHoursAgo: 79,
    costFactor: 0.35,
    referenceReplayId: 'replay_ssp_seed',
    search: ofSearch('search_spec_cost', SEEDED.specSonnet.name),
  },
  {
    id: 'replay_ssp_sonnet_held_out',
    setId: 'set_spec_api',
    candidate: SEEDED.specSonnet,
    agent: SONNET_MEDIUM,
    part: 'held-out',
    marks: 'FS',
    startedHoursAgo: 75,
    endedHoursAgo: 74.9,
    costFactor: 0.35,
    referenceReplayId: 'replay_ssp_seed_held_out',
    search: ofSearch('search_spec_cost', SEEDED.specSonnet.name),
  },
  {
    id: 'replay_ssp_template',
    setId: 'set_spec_api',
    candidate: SEEDED.specTemplate,
    agent: OPUS_MEDIUM,
    part: 'searched',
    marks: 'SFFSS',
    startedHoursAgo: 79.4,
    endedHoursAgo: 78.9,
    costFactor: 0.8,
    referenceReplayId: 'replay_ssp_seed',
    search: ofSearch('search_spec_cost', SEEDED.specTemplate.name),
  },
  {
    id: 'replay_ssp_sonnet_high',
    setId: 'set_spec_api',
    candidate: SEEDED.specSonnetHigh,
    agent: SONNET_HIGH,
    part: 'searched',
    marks: 'SFSSF',
    startedHoursAgo: 77,
    endedHoursAgo: 76.5,
    costFactor: 0.55,
    referenceReplayId: 'replay_ssp_seed',
    search: ofSearch('search_spec_cost', SEEDED.specSonnetHigh.name),
  },
  {
    id: 'replay_review_live_2',
    setId: 'set_review_money',
    candidate: liveOf(REVIEW_ID),
    agent: GPT_MEDIUM,
    part: 'all',
    marks: 'SSFSFSS',
    startedHoursAgo: 98,
    endedHoursAgo: 97.7,
    costFactor: 0.6,
    baseline: true,
    listed: true,
  },
  {
    id: 'replay_review_risk_checklist',
    setId: 'set_review_money',
    candidate: SEEDED.reviewChecklist,
    agent: GPT_MEDIUM,
    part: 'all',
    marks: 'SSSSFSS',
    startedHoursAgo: 40,
    endedHoursAgo: 39.6,
    costFactor: 0.65,
    referenceReplayId: 'replay_review_live_2',
    listed: true,
  },
  {
    id: 'replay_srv_seed',
    setId: 'set_review_money',
    candidate: liveOf(REVIEW_ID),
    agent: GPT_MEDIUM,
    part: 'searched',
    marks: 'SSFSF',
    startedHoursAgo: 60,
    endedHoursAgo: 59.7,
    costFactor: 0.6,
    search: ofSearch('search_review_findings', 'seed'),
  },
  {
    id: 'replay_srv_seed_held_out',
    setId: 'set_review_money',
    candidate: liveOf(REVIEW_ID),
    agent: GPT_MEDIUM,
    part: 'held-out',
    marks: 'FS',
    startedHoursAgo: 53,
    endedHoursAgo: 52.8,
    costFactor: 0.6,
    search: ofSearch('search_review_findings', 'seed'),
  },
  {
    id: 'replay_srv_risk',
    setId: 'set_review_money',
    candidate: SEEDED.reviewRisk,
    agent: GPT_MEDIUM,
    part: 'searched',
    marks: 'SSSSF',
    startedHoursAgo: 59.5,
    endedHoursAgo: 59.1,
    costFactor: 0.65,
    referenceReplayId: 'replay_srv_seed',
    search: ofSearch('search_review_findings', SEEDED.reviewRisk.name),
  },
  {
    id: 'replay_srv_risk_held_out',
    setId: 'set_review_money',
    candidate: SEEDED.reviewRisk,
    agent: GPT_MEDIUM,
    part: 'held-out',
    marks: 'SS',
    startedHoursAgo: 53,
    endedHoursAgo: 52.7,
    costFactor: 0.65,
    referenceReplayId: 'replay_srv_seed_held_out',
    search: ofSearch('search_review_findings', SEEDED.reviewRisk.name),
  },
  {
    id: 'replay_srv_high_effort',
    setId: 'set_review_money',
    candidate: SEEDED.reviewHigh,
    agent: { model: 'gpt-5', effort: 'high' },
    part: 'searched',
    marks: 'SSFSS',
    startedHoursAgo: 59.5,
    endedHoursAgo: 58.9,
    costFactor: 1.4,
    referenceReplayId: 'replay_srv_seed',
    search: ofSearch('search_review_findings', SEEDED.reviewHigh.name),
  },
  {
    id: 'replay_srv_migrations',
    setId: 'set_review_money',
    candidate: SEEDED.reviewMigrations,
    agent: GPT_MEDIUM,
    part: 'searched',
    marks: 'SSFSF',
    startedHoursAgo: 57.3,
    endedHoursAgo: 56.9,
    costFactor: 0.7,
    referenceReplayId: 'replay_srv_seed',
    search: ofSearch('search_review_findings', SEEDED.reviewMigrations.name),
  },
  {
    id: 'replay_investigate_live_1',
    setId: 'set_incident_data',
    candidate: liveOf(INVESTIGATE_ID),
    agent: SONNET_HIGH,
    part: 'all',
    marks: 'SFSSFS',
    startedHoursAgo: 96,
    endedHoursAgo: 95.7,
    costFactor: 1.2,
    baseline: true,
    listed: true,
  },
  {
    id: 'replay_sin_seed',
    setId: 'set_incident_data',
    candidate: liveOf(INVESTIGATE_ID),
    agent: SONNET_HIGH,
    part: 'searched',
    marks: 'SFSSF',
    startedHoursAgo: 50,
    endedHoursAgo: 49.7,
    costFactor: 1.2,
    search: ofSearch('search_investigate_logs', 'seed'),
  },
  {
    id: 'replay_sin_logs_first',
    setId: 'set_incident_data',
    candidate: SEEDED.investigateLogs,
    agent: SONNET_HIGH,
    part: 'searched',
    marks: 'SFSSF',
    startedHoursAgo: 49.5,
    endedHoursAgo: 49.1,
    costFactor: 1.1,
    referenceReplayId: 'replay_sin_seed',
    search: ofSearch('search_investigate_logs', SEEDED.investigateLogs.name),
  },
  {
    id: 'replay_sin_opus',
    setId: 'set_incident_data',
    candidate: SEEDED.investigateOpus,
    agent: { model: 'opus', effort: 'high' },
    part: 'searched',
    marks: 'SFSFF',
    startedHoursAgo: 47.3,
    endedHoursAgo: 46.6,
    costFactor: 2.1,
    referenceReplayId: 'replay_sin_seed',
    search: ofSearch('search_investigate_logs', SEEDED.investigateOpus.name),
  },
  {
    id: 'replay_mitigate_live_1',
    setId: 'set_incident_customer',
    candidate: liveOf(MITIGATE_ID),
    agent: SONNET_MEDIUM,
    part: 'all',
    marks: 'SSSFSS',
    startedHoursAgo: 88,
    endedHoursAgo: 87.8,
    costFactor: 0.7,
    baseline: true,
    listed: true,
  },
  {
    id: 'replay_mitigate_runbook',
    setId: 'set_incident_customer',
    candidate: SEEDED.mitigateRunbook,
    agent: SONNET_MEDIUM,
    part: 'all',
    marks: 'SSFrww',
    startedHoursAgo: 0.5,
    endedHoursAgo: null,
    costFactor: 0.8,
    referenceReplayId: 'replay_mitigate_live_1',
    listed: true,
  },
  {
    id: 'replay_smi_seed',
    setId: 'set_incident_customer',
    candidate: liveOf(MITIGATE_ID),
    agent: SONNET_MEDIUM,
    part: 'searched',
    marks: 'SSSFS',
    startedHoursAgo: 20,
    endedHoursAgo: 19.7,
    costFactor: 0.7,
    search: ofSearch('search_mitigate_cost', 'seed'),
  },
  {
    id: 'replay_smi_haiku',
    setId: 'set_incident_customer',
    candidate: SEEDED.mitigateHaiku,
    agent: { model: 'haiku', effort: 'medium' },
    part: 'searched',
    marks: 'SFFnn',
    startedHoursAgo: 19.5,
    endedHoursAgo: 19.2,
    costFactor: 0.25,
    referenceReplayId: 'replay_smi_seed',
    search: ofSearch('search_mitigate_cost', SEEDED.mitigateHaiku.name),
  },
  {
    id: 'replay_design_live_1',
    setId: 'set_experiment_pricing',
    candidate: liveOf(DESIGN_ID),
    agent: OPUS_MEDIUM,
    part: 'all',
    marks: 'SFSSFS',
    startedHoursAgo: 68,
    endedHoursAgo: 67.6,
    costFactor: 1,
    baseline: true,
    listed: true,
  },
  {
    id: 'replay_sde_seed',
    setId: 'set_experiment_pricing',
    candidate: liveOf(DESIGN_ID),
    agent: OPUS_MEDIUM,
    part: 'searched',
    marks: 'SFSSF',
    startedHoursAgo: 40,
    endedHoursAgo: 39.7,
    costFactor: 1,
    search: ofSearch('search_design_metrics', 'seed'),
  },
  {
    id: 'replay_sde_seed_held_out',
    setId: 'set_experiment_pricing',
    candidate: liveOf(DESIGN_ID),
    agent: OPUS_MEDIUM,
    part: 'held-out',
    marks: 'F',
    startedHoursAgo: 34,
    endedHoursAgo: 33.9,
    costFactor: 1,
    search: ofSearch('search_design_metrics', 'seed'),
  },
  {
    id: 'replay_sde_metric_first',
    setId: 'set_experiment_pricing',
    candidate: SEEDED.designMetric,
    agent: OPUS_MEDIUM,
    part: 'searched',
    marks: 'SSSSF',
    startedHoursAgo: 39.5,
    endedHoursAgo: 39.1,
    costFactor: 1.05,
    referenceReplayId: 'replay_sde_seed',
    search: ofSearch('search_design_metrics', SEEDED.designMetric.name),
  },
  {
    id: 'replay_sde_metric_first_held_out',
    setId: 'set_experiment_pricing',
    candidate: SEEDED.designMetric,
    agent: OPUS_MEDIUM,
    part: 'held-out',
    marks: 'S',
    startedHoursAgo: 34,
    endedHoursAgo: 33.8,
    costFactor: 1.05,
    referenceReplayId: 'replay_sde_seed_held_out',
    search: ofSearch('search_design_metrics', SEEDED.designMetric.name),
  },
  {
    id: 'replay_sde_briefs',
    setId: 'set_experiment_pricing',
    candidate: SEEDED.designBriefs,
    agent: OPUS_MEDIUM,
    part: 'searched',
    marks: 'SFSSS',
    startedHoursAgo: 39.5,
    endedHoursAgo: 39,
    costFactor: 1.2,
    referenceReplayId: 'replay_sde_seed',
    search: ofSearch('search_design_metrics', SEEDED.designBriefs.name),
  },
  {
    id: 'replay_sde_sonnet',
    setId: 'set_experiment_pricing',
    candidate: SEEDED.designSonnet,
    agent: SONNET_MEDIUM,
    part: 'searched',
    marks: 'SFFSF',
    startedHoursAgo: 37.3,
    endedHoursAgo: 37,
    costFactor: 0.4,
    referenceReplayId: 'replay_sde_seed',
    search: ofSearch('search_design_metrics', SEEDED.designSonnet.name),
  },
  {
    id: 'replay_build_live_1',
    setId: 'set_experiment_variants',
    candidate: liveOf(BUILD_ID),
    agent: SONNET_HIGH,
    part: 'all',
    marks: 'SSFSSS',
    startedHoursAgo: 78,
    endedHoursAgo: 77.5,
    costFactor: 1.4,
    baseline: true,
    listed: true,
  },
  {
    id: 'replay_sbu_seed',
    setId: 'set_experiment_variants',
    candidate: liveOf(BUILD_ID),
    agent: SONNET_HIGH,
    part: 'searched',
    marks: 'SSFSS',
    startedHoursAgo: 30,
    endedHoursAgo: 29.6,
    costFactor: 1.4,
    search: ofSearch('search_build_cost', 'seed'),
  },
  {
    id: 'replay_sbu_seed_held_out',
    setId: 'set_experiment_variants',
    candidate: liveOf(BUILD_ID),
    agent: SONNET_HIGH,
    part: 'held-out',
    marks: 'S',
    startedHoursAgo: 25,
    endedHoursAgo: 24.8,
    costFactor: 1.4,
    search: ofSearch('search_build_cost', 'seed'),
  },
  {
    id: 'replay_sbu_medium_effort',
    setId: 'set_experiment_variants',
    candidate: SEEDED.buildMedium,
    agent: SONNET_MEDIUM,
    part: 'searched',
    marks: 'SSFSS',
    startedHoursAgo: 29.5,
    endedHoursAgo: 29.2,
    costFactor: 0.8,
    referenceReplayId: 'replay_sbu_seed',
    search: ofSearch('search_build_cost', SEEDED.buildMedium.name),
  },
  {
    id: 'replay_sbu_medium_effort_held_out',
    setId: 'set_experiment_variants',
    candidate: SEEDED.buildMedium,
    agent: SONNET_MEDIUM,
    part: 'held-out',
    marks: 'S',
    startedHoursAgo: 25,
    endedHoursAgo: 24.9,
    costFactor: 0.8,
    referenceReplayId: 'replay_sbu_seed_held_out',
    search: ofSearch('search_build_cost', SEEDED.buildMedium.name),
  },
  {
    id: 'replay_sbu_flag_checklist',
    setId: 'set_experiment_variants',
    candidate: SEEDED.buildChecklist,
    agent: SONNET_HIGH,
    part: 'searched',
    marks: 'SSSSS',
    startedHoursAgo: 29.5,
    endedHoursAgo: 28.9,
    costFactor: 1.5,
    referenceReplayId: 'replay_sbu_seed',
    search: ofSearch('search_build_cost', SEEDED.buildChecklist.name),
  },
];

const agentSpent = (amount: number) => ({
  spends: [{ amount, currency: 'USD' }],
  unpriced: 0,
});

const ceiling = (amount: number): MoneyResponseDto => ({
  amount,
  currency: 'USD',
});

const seedOf = (
  stationId: string,
  replayId: string,
  heldOutReplayId: string | null,
) => ({
  candidate: liveOf(stationId),
  isSeed: true,
  iteration: null,
  hypothesis: null,
  changes: [],
  replayId,
  heldOutReplayId,
  onFrontier: true,
  overfit: null,
  pullRequest: null,
});

const proposing = (
  searchId: string,
  number: number,
  proposed: readonly string[],
  spent: number | null,
  state: 'running' | 'ended' | 'failed' = 'ended',
) => ({
  number,
  kind: 'propose' as const,
  runId: `run_${searchId}_${number}`,
  state,
  attempts: proposed.length,
  proposed: [...proposed],
  agentSpent: spent === null ? null : agentSpent(spent),
  reflection: null,
});

const searched = (
  over: Pick<
    SearchSeed['candidates'][number],
    'candidate' | 'iteration' | 'hypothesis' | 'changes' | 'replayId'
  > &
    Partial<SearchSeed['candidates'][number]>,
): SearchSeed['candidates'][number] => ({
  isSeed: false,
  heldOutReplayId: null,
  onFrontier: false,
  overfit: null,
  pullRequest: null,
  ...over,
});

const AGENT = { harness: 'claude-code', model: 'opus', effort: 'high' };

export const SEARCH_SEEDS: readonly SearchSeed[] = [
  {
    id: 'search_triage_repro',
    setId: 'set_triage_billing',
    state: 'searching',
    stopReason: null,
    agent: AGENT,
    budget: {
      iterations: 3,
      perIteration: 1,
      ceiling: ceiling(8),
      concurrency: 4,
      repeats: 1,
    },
    objective: 'success',
    trigger: 'alert',
    startedHoursAgo: 3,
    endedHoursAgo: null,
    iterations: [
      proposing('search_triage_repro', 1, [SEEDED.triageRepro.id], 0.21),
      proposing('search_triage_repro', 2, [SEEDED.triageLogs.id], 0.18),
      proposing('search_triage_repro', 3, [], null, 'running'),
    ],
    seed: seedOf(TRIAGE_ID, 'replay_str_seed', null),
    candidates: [
      searched({
        candidate: SEEDED.triageRepro,
        iteration: 1,
        hypothesis:
          'Failed triages read the code before trying the request. Reproducing the report first should stop the guessed causes.',
        changes: [changed('prompt')],
        replayId: 'replay_str_repro_first',
        onFrontier: true,
      }),
      searched({
        candidate: SEEDED.triageLogs,
        iteration: 2,
        hypothesis:
          'The refund reports carry a request id. Reading its logs before the code should name the failing path sooner.',
        changes: [changed('prompt')],
        replayId: 'replay_str_logs_first',
      }),
    ],
    bestId: SEEDED.triageRepro.id,
    frontier: [liveOf(TRIAGE_ID).id, SEEDED.triageRepro.id],
  },
  {
    id: 'search_spec_cost',
    setId: 'set_spec_api',
    state: 'finished',
    stopReason: 'ceiling-reached',
    agent: AGENT,
    budget: {
      iterations: 4,
      perIteration: 2,
      ceiling: ceiling(12),
      concurrency: 4,
      repeats: 1,
    },
    objective: 'cost',
    trigger: 'schedule',
    startedHoursAgo: 80,
    endedHoursAgo: 74.7,
    iterations: [
      proposing(
        'search_spec_cost',
        1,
        [SEEDED.specSonnet.id, SEEDED.specTemplate.id],
        0.66,
      ),
      proposing('search_spec_cost', 2, [SEEDED.specSonnetHigh.id], 0.49),
    ],
    seed: seedOf(SPEC_ID, 'replay_ssp_seed', 'replay_ssp_seed_held_out'),
    candidates: [
      searched({
        candidate: SEEDED.specSonnet,
        iteration: 1,
        hypothesis:
          'API specs follow one shape: route, request, response, errors. Sonnet should write them as well as Opus for a third of the cost.',
        changes: [changed('model', 'opus', 'sonnet')],
        replayId: 'replay_ssp_sonnet',
        heldOutReplayId: 'replay_ssp_sonnet_held_out',
        onFrontier: true,
      }),
      searched({
        candidate: SEEDED.specTemplate,
        iteration: 1,
        hypothesis:
          'A fixed spec template should stop it from rewriting what stays the same.',
        changes: [changed('prompt')],
        replayId: 'replay_ssp_template',
      }),
      searched({
        candidate: SEEDED.specSonnetHigh,
        iteration: 2,
        hypothesis:
          'Sonnet missed the error cases on one webhook spec. High effort may catch them and still cost less than Opus.',
        changes: [
          changed('model', 'opus', 'sonnet'),
          changed('effort', 'medium', 'high'),
        ],
        replayId: 'replay_ssp_sonnet_high',
      }),
    ],
    bestId: SEEDED.specSonnet.id,
    frontier: [liveOf(SPEC_ID).id, SEEDED.specSonnet.id],
  },
  {
    id: 'search_review_findings',
    setId: 'set_review_money',
    state: 'finished',
    stopReason: 'iterations-spent',
    agent: AGENT,
    budget: {
      iterations: 2,
      perIteration: 2,
      ceiling: ceiling(20),
      concurrency: 4,
      repeats: 1,
    },
    objective: 'success',
    trigger: 'schedule',
    startedHoursAgo: 60,
    endedHoursAgo: 52.6,
    iterations: [
      proposing(
        'search_review_findings',
        1,
        [SEEDED.reviewRisk.id, SEEDED.reviewHigh.id],
        0.71,
      ),
      proposing(
        'search_review_findings',
        2,
        [SEEDED.reviewMigrations.id],
        0.52,
      ),
    ],
    seed: seedOf(REVIEW_ID, 'replay_srv_seed', 'replay_srv_seed_held_out'),
    candidates: [
      searched({
        candidate: SEEDED.reviewRisk,
        iteration: 1,
        hypothesis:
          'Missed findings all touch money or a shared table. A short checklist of what to look for there should catch them.',
        changes: [changed('prompt')],
        replayId: 'replay_srv_risk',
        heldOutReplayId: 'replay_srv_risk_held_out',
        onFrontier: true,
        overfit: 'likely',
      }),
      searched({
        candidate: SEEDED.reviewHigh,
        iteration: 1,
        hypothesis:
          'More effort should read the whole diff instead of the first files.',
        changes: [changed('effort', 'medium', 'high')],
        replayId: 'replay_srv_high_effort',
      }),
      searched({
        candidate: SEEDED.reviewMigrations,
        iteration: 2,
        hypothesis:
          'The index change locked a table in production. The team’s migrations skill says how to add one safely.',
        changes: [added('skill', 'our-migrations')],
        replayId: 'replay_srv_migrations',
      }),
    ],
    bestId: SEEDED.reviewRisk.id,
    frontier: [liveOf(REVIEW_ID).id, SEEDED.reviewRisk.id],
  },
  {
    id: 'search_investigate_logs',
    setId: 'set_incident_data',
    state: 'finished',
    stopReason: 'stalled',
    agent: AGENT,
    budget: {
      iterations: 4,
      perIteration: 1,
      ceiling: ceiling(15),
      concurrency: 2,
      repeats: 1,
    },
    objective: 'success',
    trigger: 'schedule',
    startedHoursAgo: 50,
    endedHoursAgo: 46.5,
    iterations: [
      proposing(
        'search_investigate_logs',
        1,
        [SEEDED.investigateLogs.id],
        0.44,
      ),
      proposing('search_investigate_logs', 2, [SEEDED.investigateOpus.id], 0.4),
    ],
    seed: seedOf(INVESTIGATE_ID, 'replay_sin_seed', null),
    candidates: [
      searched({
        candidate: SEEDED.investigateLogs,
        iteration: 1,
        hypothesis:
          'It opens dashboards before logs and blames the last deploy. Reading the logs first should find the real cause.',
        changes: [changed('prompt')],
        replayId: 'replay_sin_logs_first',
      }),
      searched({
        candidate: SEEDED.investigateOpus,
        iteration: 2,
        hypothesis:
          'The replica lag alerts need reasoning across three services. Opus may keep more of it in context at once.',
        changes: [changed('model', 'sonnet', 'opus')],
        replayId: 'replay_sin_opus',
      }),
    ],
    bestId: liveOf(INVESTIGATE_ID).id,
    frontier: [liveOf(INVESTIGATE_ID).id],
  },
  {
    id: 'search_mitigate_cost',
    setId: 'set_incident_customer',
    state: 'stopped',
    stopReason: 'stopped',
    agent: AGENT,
    budget: {
      iterations: 3,
      perIteration: 1,
      ceiling: ceiling(6),
      concurrency: 2,
      repeats: 1,
    },
    objective: 'cost',
    trigger: 'schedule',
    startedHoursAgo: 20,
    endedHoursAgo: 19.2,
    iterations: [
      proposing('search_mitigate_cost', 1, [SEEDED.mitigateHaiku.id], 0.27),
    ],
    seed: seedOf(MITIGATE_ID, 'replay_smi_seed', null),
    candidates: [
      searched({
        candidate: SEEDED.mitigateHaiku,
        iteration: 1,
        hypothesis:
          'Most mitigations are a config change or a rollback. Haiku should propose them for much less.',
        changes: [changed('model', 'sonnet', 'haiku')],
        replayId: 'replay_smi_haiku',
      }),
    ],
    bestId: liveOf(MITIGATE_ID).id,
    frontier: [liveOf(MITIGATE_ID).id],
  },
  {
    id: 'search_design_metrics',
    setId: 'set_experiment_pricing',
    state: 'finished',
    stopReason: 'iterations-spent',
    agent: AGENT,
    budget: {
      iterations: 2,
      perIteration: 2,
      ceiling: ceiling(18),
      concurrency: 4,
      repeats: 1,
    },
    objective: 'success',
    trigger: 'schedule',
    startedHoursAgo: 40,
    endedHoursAgo: 33.7,
    iterations: [
      proposing(
        'search_design_metrics',
        1,
        [SEEDED.designMetric.id, SEEDED.designBriefs.id],
        0.83,
      ),
      proposing('search_design_metrics', 2, [SEEDED.designSonnet.id], 0.47),
    ],
    seed: seedOf(DESIGN_ID, 'replay_sde_seed', 'replay_sde_seed_held_out'),
    candidates: [
      searched({
        candidate: SEEDED.designMetric,
        iteration: 1,
        hypothesis:
          'Designs fail the judge when they name a metric without today’s reading. Requiring the reading first should fix that.',
        changes: [changed('prompt')],
        replayId: 'replay_sde_metric_first',
        heldOutReplayId: 'replay_sde_metric_first_held_out',
        onFrontier: true,
        pullRequest: {
          id: 'config_pull_request_design_metric_first',
          state: 'opened',
          url: 'https://github.com/acme/config/pull/66',
          reason: null,
        },
      }),
      searched({
        candidate: SEEDED.designBriefs,
        iteration: 1,
        hypothesis:
          'The experiment-briefs skill already says how to set a stop rule. Enabling it outright should stop the missing ones.',
        changes: [added('skill', 'experiment-briefs')],
        replayId: 'replay_sde_briefs',
      }),
      searched({
        candidate: SEEDED.designSonnet,
        iteration: 2,
        hypothesis:
          'Designs are short. Sonnet may write them as well for less.',
        changes: [changed('model', 'opus', 'sonnet')],
        replayId: 'replay_sde_sonnet',
        onFrontier: true,
      }),
    ],
    bestId: SEEDED.designMetric.id,
    frontier: [
      liveOf(DESIGN_ID).id,
      SEEDED.designSonnet.id,
      SEEDED.designMetric.id,
    ],
  },
  {
    id: 'search_build_cost',
    setId: 'set_experiment_variants',
    state: 'finished',
    stopReason: 'iterations-spent',
    agent: AGENT,
    budget: {
      iterations: 1,
      perIteration: 2,
      ceiling: ceiling(20),
      concurrency: 4,
      repeats: 1,
    },
    objective: 'cost',
    trigger: 'schedule',
    startedHoursAgo: 30,
    endedHoursAgo: 24.7,
    iterations: [
      proposing(
        'search_build_cost',
        1,
        [SEEDED.buildMedium.id, SEEDED.buildChecklist.id],
        0.58,
      ),
    ],
    seed: seedOf(BUILD_ID, 'replay_sbu_seed', 'replay_sbu_seed_held_out'),
    candidates: [
      searched({
        candidate: SEEDED.buildMedium,
        iteration: 1,
        hypothesis:
          'Variants are small changes behind a flag. Medium effort should build them as reliably for less.',
        changes: [changed('effort', 'high', 'medium')],
        replayId: 'replay_sbu_medium_effort',
        heldOutReplayId: 'replay_sbu_medium_effort_held_out',
        onFrontier: true,
      }),
      searched({
        candidate: SEEDED.buildChecklist,
        iteration: 1,
        hypothesis:
          'The one failure shipped a variant outside its flag. A flag checklist before the pull request should catch it.',
        changes: [changed('prompt')],
        replayId: 'replay_sbu_flag_checklist',
        onFrontier: true,
      }),
    ],
    bestId: SEEDED.buildMedium.id,
    frontier: [
      liveOf(BUILD_ID).id,
      SEEDED.buildMedium.id,
      SEEDED.buildChecklist.id,
    ],
  },
];

export const SEARCH_NOTES: Record<string, readonly [string, string]> = {
  run_search_tests_first_1: [
    'Three of five searched tasks failed after editing billing code before reading its tests.',
    'Proposed tests-first; replaying it on 5 tasks',
  ],
  run_search_tests_first_2: [
    'tests-first leads. The refund task still fails on every candidate, so try a larger model and a review pass.',
    'Proposed opus and review-skill; replaying each on 5 tasks',
  ],
  run_search_triage_repro_1: [
    'Both failed triages named a cause without trying the request from the report.',
    'Proposed repro-before-reading; replaying it on 5 tasks',
  ],
  run_search_triage_repro_2: [
    'repro-before-reading leads. The refund report still fails: it has a request id nobody looked up.',
    'Proposed logs-first; replaying it on 5 tasks',
  ],
  run_search_spec_cost_1: [
    'Every searched spec follows the same route, request, response and errors shape.',
    'Proposed sonnet-specs and spec-template; replaying each on 5 tasks',
  ],
  run_search_review_findings_1: [
    'The missed findings all sit in changes to payments or to a shared table.',
    'Proposed risk-checklist and high-effort; replaying each on 5 tasks',
  ],
  run_search_investigate_logs_1: [
    'Both failed investigations blamed the last deploy before reading a log line.',
    'Proposed logs-before-dashboards; replaying it on 5 tasks',
  ],
  run_search_investigate_logs_2: [
    'logs-before-dashboards did no better. The replica lag alerts still fail.',
    'Proposed opus; replaying it on 5 tasks',
  ],
  run_search_design_metrics_1: [
    'Two of five designs named a metric without what it reads today.',
    'Proposed metric-reading-first and experiment-briefs-skill; replaying each on 5 tasks',
  ],
  run_search_build_cost_1: [
    'Every variant here is a small change behind a flag.',
    'Proposed medium-effort and flag-checklist; replaying each on 5 tasks',
  ],
};
