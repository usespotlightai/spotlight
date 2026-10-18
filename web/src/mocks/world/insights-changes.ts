import type {
  AgentConfigOutcomeResponseDto,
  ChangeMarkerResponseDto,
  InsightsAgentConfigsResponseDto,
  InsightsChangesResponseDto,
  JudgeRateResponseDto,
  StationJudgeCalibrationResponseDto,
} from '@/lib/api';
import type { HistoryRun, RunSize } from '@/mocks/world/insights-history';
import { runsOfTeam } from '@/mocks/world/insights-history';
import {
  CURRENCY,
  changeOf,
  DAY_MS,
  distinct,
  type PeriodName,
  shareOf,
  spanOf,
  sumOf,
  within,
} from '@/mocks/world/insights-measures';
import { IMPLEMENTATION_ID } from '@/mocks/world/insights-profiles';
import {
  costPerRunOf,
  runsIn,
  tallyOf,
  verdictsOf,
  versionChangesOf,
} from '@/mocks/world/insights-tally';
import { DELIVERY_ID } from '@/mocks/world/platform';

const IMPLEMENTATION_JUDGE: StationJudgeCalibrationResponseDto = {
  lineId: DELIVERY_ID,
  stationId: IMPLEMENTATION_ID,
  qualified: true,
  measure: 'kappa',
  agreement: 0.72,
  pairs: 24,
  minAgreement: 0.6,
  hiddenReason: null,
};

const JUDGES: readonly StationJudgeCalibrationResponseDto[] = [
  IMPLEMENTATION_JUDGE,
];

const judgeOf = (runs: readonly HistoryRun[]): JudgeRateResponseDto => {
  const scores = runs.flatMap((run) => (run.judge === null ? [] : [run.judge]));

  return {
    mean:
      scores.length === 0
        ? null
        : Math.round((sumOf(scores) / scores.length) * 100) / 100,
    judged: scores.length,
  };
};

const COMPARED_DAYS = 30;

export const changesOf = (
  teamId: string,
  name: PeriodName,
): InsightsChangesResponseDto => {
  const span = spanOf(name);
  const runs = runsOfTeam(teamId);
  const markers: ChangeMarkerResponseDto[] = versionChangesOf(teamId)
    .filter((change) => within(change.firstRunAt, span.now))
    .map((change) => {
      const atStation = runs.filter(
        (run) => run.stationId === change.profile.stationId,
      );
      const before = atStation.filter(
        (run) =>
          run.fingerprint === change.previous.fingerprint &&
          run.at >= change.firstRunAt - COMPARED_DAYS * DAY_MS,
      );
      const after = atStation.filter(
        (run) => run.fingerprint === change.version.fingerprint,
      );
      const judged = change.profile.judged;
      const judgeBefore = judged ? judgeOf(before) : null;
      const judgeAfter = judged ? judgeOf(after) : null;

      return {
        ...change.marker,
        before: tallyOf(before),
        after: tallyOf(after),
        verdicts: verdictsOf(before, after),
        judgeBefore,
        judgeAfter,
        judgeChange: changeOf(
          judgeAfter?.mean ?? null,
          judgeBefore?.mean ?? null,
          'up',
          'points',
        ),
        changes: [...change.version.changes],
      };
    })
    .sort((one, other) => other.firstRunAt.localeCompare(one.firstRunAt));

  return {
    period: span.period,
    markers,
    judges: runs.length === 0 ? [] : [...JUDGES],
  };
};

const SIZES: InsightsAgentConfigsResponseDto['sizes'] = [
  { size: 'small', maxLines: 50, maxSteps: 20 },
  { size: 'medium', maxLines: 400, maxSteps: 80 },
  { size: 'large', maxLines: null, maxSteps: null },
];

const MIN_RUNS = 3;

type Outcome = AgentConfigOutcomeResponseDto['frontier'][number];

const OUTCOMES: readonly Outcome[] = [
  'accepted',
  'sent_back',
  'passed',
  'checks_passed',
  'merged',
  'judge',
];

const agentConfigKeyOf = (run: HistoryRun): string =>
  [run.harness, run.model, run.effort, run.profileKey].join('|');

const rounded = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 100) / 100;

const agentConfigOf = (
  runs: readonly HistoryRun[],
  judged: boolean,
): AgentConfigOutcomeResponseDto => {
  const first = runs[0] as HistoryRun;
  const tally = tallyOf(runs);
  const costPerRun = costPerRunOf(runs);
  const judge = judged ? judgeOf(runs) : null;
  const tasks = distinct(runs.map((run) => run.taskId)).length;

  return {
    harness: first.harness,
    model: first.model,
    effort: first.effort,
    profileKey: first.profileKey,
    tally,
    costPerRun: rounded(costPerRun),
    currency: costPerRun === null ? null : CURRENCY,
    priced: costPerRun !== null,
    outcomes: {
      accepted: rounded(shareOf(tally.accepted, tally.runs)),
      sent_back: rounded(shareOf(tally.sentBack, tally.runs)),
      passed: rounded(shareOf(tally.passed, tally.runs)),
      checks_passed: rounded(
        shareOf(tally.checksPassed, tally.checksPassed + tally.checksFailed),
      ),
      merged: rounded(shareOf(tally.merged, tasks)),
      judge: judge?.mean ?? null,
    },
    judge,
    frontier: [],
  };
};

const scoreOf = (
  agentConfig: AgentConfigOutcomeResponseDto,
  outcome: Outcome,
) => {
  const value = agentConfig.outcomes[outcome];
  return value === null ? null : outcome === 'sent_back' ? -value : value;
};

const onFrontier = (
  agentConfig: AgentConfigOutcomeResponseDto,
  all: readonly AgentConfigOutcomeResponseDto[],
  outcome: Outcome,
): boolean => {
  const score = scoreOf(agentConfig, outcome);
  if (
    score === null ||
    agentConfig.costPerRun === null ||
    agentConfig.tally.runs < MIN_RUNS
  ) {
    return false;
  }

  return !all.some((other) => {
    const otherScore = scoreOf(other, outcome);
    return (
      other !== agentConfig &&
      other.tally.runs >= MIN_RUNS &&
      other.costPerRun !== null &&
      otherScore !== null &&
      other.costPerRun <= (agentConfig.costPerRun ?? 0) &&
      otherScore >= score &&
      (other.costPerRun < (agentConfig.costPerRun ?? 0) || otherScore > score)
    );
  });
};

export const agentConfigsOf = (
  teamId: string,
  name: PeriodName,
  stationId: string | null,
  size: RunSize | null,
): InsightsAgentConfigsResponseDto => {
  const span = spanOf(name);
  const runs = runsIn(teamId, span.now).filter(
    (run) =>
      (stationId === null || run.stationId === stationId) &&
      (size === null || run.size === size),
  );
  const judged = stationId === IMPLEMENTATION_ID;
  const agentConfigs = distinct(runs.map(agentConfigKeyOf))
    .map((key) =>
      agentConfigOf(
        runs.filter((run) => agentConfigKeyOf(run) === key),
        judged,
      ),
    )
    .sort((one, other) => other.tally.runs - one.tally.runs);

  return {
    period: span.period,
    stationId,
    size,
    sizes: SIZES,
    minRuns: MIN_RUNS,
    currency: agentConfigs.some((agentConfig) => agentConfig.priced)
      ? CURRENCY
      : null,
    agentConfigs: agentConfigs.map((agentConfig) => ({
      ...agentConfig,
      frontier: OUTCOMES.filter((outcome) =>
        onFrontier(agentConfig, agentConfigs, outcome),
      ),
    })),
    judgeOmitted: stationId === null ? 'no_station' : null,
    judges: judged && runs.length > 0 ? [IMPLEMENTATION_JUDGE] : [],
  };
};
