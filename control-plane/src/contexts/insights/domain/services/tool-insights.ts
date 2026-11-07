import { rateOf } from '@insights/domain/services/measures';
import {
  type SkillTrend,
  skillTrendOf,
} from '@insights/domain/services/skill-trend';
import type { StationLocation } from '@insights/domain/services/station-ranking';
import type { Window } from '@insights/domain/value-objects/insights-period.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';

export interface SkillWeek {
  readonly week: string;
  readonly runs: number;
  readonly enabled: number;
  readonly used: number;
  readonly usedRate: number | null;
  readonly partial: boolean;
}

export interface SkillAtStation {
  readonly lineId: string;
  readonly stationId: string;
  readonly runs: number;
  readonly enabled: number;
  readonly used: number;
  readonly usedRate: number | null;
  readonly trend: SkillTrend | null;
}

export interface SkillReport {
  readonly key: string;
  readonly defined: boolean;
  readonly enabled: number;
  readonly used: number;
  readonly usedRate: number | null;
  readonly weeks: readonly SkillWeek[];
  readonly trend: SkillTrend | null;
  readonly stations: readonly SkillAtStation[];
}

export interface ServerReport {
  readonly server: string;
  readonly runs: number;
  readonly calls: number;
  readonly callsPerRun: number | null;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
  readonly failedCalls: number;
  readonly errorRate: number | null;
  readonly failingRuns: number;
  readonly failingRunRate: number | null;
  readonly dismissed: number;
  readonly dismissedRate: number | null;
}

export interface ToolDismissals {
  readonly tool: string;
  readonly server: string | null;
  readonly dismissed: number;
}

export interface RunCount {
  readonly stationId: string | null;
  readonly week: string | null;
  readonly runs: number;
}

export interface SkillUseCount {
  readonly key: string;
  readonly stationId: string | null;
  readonly week: string | null;
  readonly enabled: number;
  readonly used: number;
}

export interface ServerCounts {
  readonly server: string;
  readonly runs: number;
  readonly calls: number;
  readonly failedCalls: number;
  readonly latency: readonly number[];
  readonly failingRuns: number;
  readonly dismissed: number;
}

export interface ToolCounts {
  readonly runs: readonly RunCount[];
  readonly stations: readonly StationLocation[];
  readonly skills: readonly SkillUseCount[];
  readonly servers: readonly ServerCounts[];
  readonly dismissals: readonly ToolDismissals[];
}

export interface ToolInsights {
  readonly runs: number;
  readonly skills: readonly SkillReport[];
  readonly unused: readonly string[];
  readonly servers: readonly ServerReport[];
  readonly dismissals: readonly ToolDismissals[];
}

const byUseThenName = (one: SkillReport, other: SkillReport): number =>
  other.used - one.used || one.key.localeCompare(other.key);

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const partialWeek = (week: string, window: Window): boolean => {
  const start = Date.parse(`${week}T00:00:00.000Z`);

  return start < window.from.getTime() || start + WEEK_MS > window.to.getTime();
};

export const toolInsightsFrom = (
  counts: ToolCounts,
  weeks: readonly string[],
  defined: readonly string[],
  window: Window,
): ToolInsights => {
  const keyOf = (...parts: readonly (string | null)[]) => JSON.stringify(parts);
  const runs = new Map(
    counts.runs.map((each) => [keyOf(each.stationId, each.week), each.runs]),
  );
  const uses = new Map(
    counts.skills.map((each) => [
      keyOf(each.key, each.stationId, each.week),
      each,
    ]),
  );
  const runsAt = (stationId: string | null, week: string | null): number =>
    runs.get(keyOf(stationId, week)) ?? 0;
  const useAt = (key: string, stationId: string | null, week: string | null) =>
    uses.get(keyOf(key, stationId, week)) ?? { enabled: 0, used: 0 };
  const weekly = (key: string, stationId: string | null): SkillWeek[] =>
    weeks.map((week) => {
      const inWeek = runsAt(stationId, week);
      const { enabled, used } = useAt(key, stationId, week);

      return {
        week,
        runs: inWeek,
        enabled,
        used,
        usedRate: rateOf(used, inWeek),
        partial: partialWeek(week, window),
      };
    });
  const definedKeys = new Set(defined);
  const skills = [...new Set(counts.skills.map((each) => each.key))]
    .map((key): SkillReport => {
      const team = weekly(key, null);
      const all = useAt(key, null, null);

      return {
        key,
        defined: definedKeys.has(key),
        enabled: all.enabled,
        used: all.used,
        usedRate: rateOf(all.used, runsAt(null, null)),
        weeks: team,
        trend: skillTrendOf(team),
        stations: counts.stations.flatMap((location) => {
          const there = useAt(key, location.stationId, null);

          return there.enabled + there.used === 0
            ? []
            : [
                {
                  ...location,
                  runs: runsAt(location.stationId, null),
                  enabled: there.enabled,
                  used: there.used,
                  usedRate: rateOf(
                    there.used,
                    runsAt(location.stationId, null),
                  ),
                  trend: skillTrendOf(weekly(key, location.stationId)),
                },
              ];
        }),
      };
    })
    .sort(byUseThenName);
  const used = new Set(
    skills.filter((each) => each.used > 0).map((each) => each.key),
  );

  return {
    runs: runsAt(null, null),
    skills,
    unused: [...definedKeys]
      .filter((each) => !used.has(each))
      .sort((one, other) => one.localeCompare(other)),
    servers: counts.servers
      .map((each): ServerReport => {
        const latency = LatencyHistogram.of(each.latency);

        return {
          server: each.server,
          runs: each.runs,
          calls: each.calls,
          callsPerRun: rateOf(each.calls, each.runs),
          p50Ms: latency.percentile(50),
          p95Ms: latency.percentile(95),
          failedCalls: each.failedCalls,
          errorRate: rateOf(each.failedCalls, each.calls),
          failingRuns: each.failingRuns,
          failingRunRate: rateOf(each.failingRuns, each.runs),
          dismissed: each.dismissed,
          dismissedRate: rateOf(each.dismissed, each.runs),
        };
      })
      .sort(
        (one, other) =>
          other.runs - one.runs || one.server.localeCompare(other.server),
      ),
    dismissals: [...counts.dismissals].sort(
      (one, other) =>
        other.dismissed - one.dismissed ||
        one.tool.localeCompare(other.tool) ||
        (one.server ?? '').localeCompare(other.server ?? ''),
    ),
  };
};
