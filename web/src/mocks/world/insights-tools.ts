import type {
  InsightsToolsResponseDto,
  ServerReportResponseDto,
  SkillReportResponseDto,
  TrendRuleResponseDto,
} from '@/lib/api';
import { GROWTH_ID, PLATFORM_ID } from '@/mocks/world';
import type { HistoryRun } from '@/mocks/world/insights-history';
import {
  distinct,
  mondaysOf,
  type PeriodName,
  quantile,
  shareOf,
  spanOf,
  sumOf,
  weekOf,
} from '@/mocks/world/insights-measures';
import { runsIn } from '@/mocks/world/insights-tally';

const TREND_RULE: TrendRuleResponseDto = {
  recentWeeks: 2,
  fewestRuns: 5,
  shiftPoints: 20,
};

const DEFINED: Record<string, readonly string[]> = {
  [PLATFORM_ID]: ['grafana-dashboards', 'our-migrations', 'release-notes'],
  [GROWTH_ID]: ['experiment-briefs'],
};

type Trend = SkillReportResponseDto['trend'];

const trendOf = (
  runs: readonly HistoryRun[],
  weeks: readonly string[],
  skill: string,
): Trend => {
  const recent = new Set(weeks.slice(-TREND_RULE.recentWeeks));
  const latest = runs.filter((run) => recent.has(weekOf(run.at)));
  const earlier = runs.filter((run) => !recent.has(weekOf(run.at)));
  if (
    latest.length < TREND_RULE.fewestRuns ||
    earlier.length < TREND_RULE.fewestRuns
  ) {
    return null;
  }
  const usedShare = (some: readonly HistoryRun[]) =>
    some.filter((run) => run.skillsUsed.includes(skill)).length / some.length;
  const moved = (usedShare(latest) - usedShare(earlier)) * 100;

  return moved >= TREND_RULE.shiftPoints
    ? 'spreading'
    : moved <= -TREND_RULE.shiftPoints
      ? 'fading'
      : 'steady';
};

const touches = (run: HistoryRun, skill: string): boolean =>
  run.skillsGiven.includes(skill) || run.skillsUsed.includes(skill);

const skillOf = (
  runs: readonly HistoryRun[],
  weeks: readonly string[],
  skill: string,
  defined: readonly string[],
): SkillReportResponseDto => {
  const countOf = (some: readonly HistoryRun[]) => ({
    given: some.filter((run) => run.skillsGiven.includes(skill)).length,
    used: some.filter((run) => run.skillsUsed.includes(skill)).length,
  });
  const stations = distinct(
    runs.filter((run) => touches(run, skill)).map((run) => run.stationId),
  );

  return {
    key: skill,
    defined: defined.includes(skill),
    ...countOf(runs),
    weeks: weeks.map((week) => {
      const inWeek = runs.filter((run) => weekOf(run.at) === week);
      const counted = countOf(inWeek);
      return {
        week,
        runs: inWeek.length,
        ...counted,
        usedShare: shareOf(counted.used, inWeek.length),
      };
    }),
    trend: trendOf(runs, weeks, skill),
    stations: stations.map((stationId) => {
      const atStation = runs.filter((run) => run.stationId === stationId);
      return {
        lineId: atStation[0]?.lineId ?? '',
        stationId,
        runs: atStation.length,
        ...countOf(atStation),
        trend: trendOf(atStation, weeks, skill),
      };
    }),
  };
};

const serverOf = (
  runs: readonly HistoryRun[],
  server: string,
): ServerReportResponseDto => {
  const calls = runs.flatMap((run) =>
    run.calls.filter((call) => call.server === server),
  );
  const total = sumOf(calls.map((call) => call.calls));
  const failedCalls = sumOf(calls.map((call) => call.failed));

  return {
    server,
    runs: calls.length,
    calls: total,
    callsPerRun: shareOf(total, calls.length),
    p50Ms: quantile(
      calls.map((call) => call.ms),
      0.5,
    ),
    p95Ms: quantile(
      calls.map((call) => call.ms * 2.4),
      0.95,
    ),
    failedCalls,
    errorRate: shareOf(failedCalls, total),
    failingRuns: calls.filter((call) => call.failed > 0).length,
    refused: calls.filter((call) => call.refused !== null).length,
  };
};

export const toolsOf = (
  teamId: string,
  name: PeriodName,
): InsightsToolsResponseDto => {
  const span = spanOf(name);
  const runs = runsIn(teamId, span.now);
  const weeks = mondaysOf(span);
  const defined = DEFINED[teamId] ?? [];
  const seen = distinct(
    runs.flatMap((run) => [...run.skillsGiven, ...run.skillsUsed]),
  );
  const refusals = runs.flatMap((run) =>
    run.calls.flatMap((call) =>
      call.refused ? [{ tool: call.refused, server: call.server }] : [],
    ),
  );

  return {
    period: span.period,
    truncated: false,
    weeks,
    runs: runs.length,
    trendRule: TREND_RULE,
    skills: seen
      .map((skill) => skillOf(runs, weeks, skill, defined))
      .sort((one, other) => other.used - one.used),
    unused: defined.filter(
      (skill) => !runs.some((run) => run.skillsUsed.includes(skill)),
    ),
    servers: distinct(
      runs.flatMap((run) => run.calls.map((call) => call.server)),
    )
      .map((server) => serverOf(runs, server))
      .sort((one, other) => other.calls - one.calls),
    refusals: distinct(refusals.map((each) => each.tool))
      .map((tool) => ({
        tool,
        server: refusals.find((each) => each.tool === tool)?.server ?? null,
        refused: refusals.filter((each) => each.tool === tool).length,
      }))
      .sort((one, other) => other.refused - one.refused),
  };
};
