import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { byText, rateOf } from '@outcomes/domain/services/measures';
import { weekOf } from '@outcomes/domain/services/pull-request-insights';
import {
  type SkillTrend,
  skillTrendOf,
} from '@outcomes/domain/services/skill-trend';
import {
  endedWithin,
  type StationPlace,
  stationsOf,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';

export interface SkillWeek {
  readonly week: string;
  readonly runs: number;
  readonly enabled: number;
  readonly used: number;
  readonly usedShare: number | null;
}

export interface SkillAtStation {
  readonly lineId: string;
  readonly stationId: string;
  readonly runs: number;
  readonly enabled: number;
  readonly used: number;
  readonly trend: SkillTrend | null;
}

export interface SkillReport {
  readonly key: string;
  readonly defined: boolean;
  readonly enabled: number;
  readonly used: number;
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
  readonly refused: number;
}

export interface ToolRefusals {
  readonly tool: string;
  readonly server: string | null;
  readonly refused: number;
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
  readonly refused: number;
}

export interface ToolCounts {
  readonly runs: readonly RunCount[];
  readonly stations: readonly StationPlace[];
  readonly skills: readonly SkillUseCount[];
  readonly servers: readonly ServerCounts[];
  readonly refusals: readonly ToolRefusals[];
}

export interface ToolInsights {
  readonly runs: number;
  readonly skills: readonly SkillReport[];
  readonly unused: readonly string[];
  readonly servers: readonly ServerReport[];
  readonly refusals: readonly ToolRefusals[];
}

const enabledFor = (record: RunRecord, skill: string): boolean =>
  record.end?.setup.skills.includes(skill) === true;

const usedBy = (record: RunRecord, skill: string): boolean =>
  record.tools?.read(skill) === true;

const count = (
  records: readonly RunRecord[],
  matches: (record: RunRecord) => boolean,
): number => records.filter(matches).length;

const nullsFirst = (one: string | null, other: string | null): number =>
  one === null || other === null
    ? Number(other === null) - Number(one === null)
    : byText(one, other);

const inCountOrder = (
  one: { readonly stationId: string | null; readonly week: string | null },
  other: { readonly stationId: string | null; readonly week: string | null },
): number =>
  nullsFirst(one.stationId, other.stationId) ||
  nullsFirst(one.week, other.week);

const groupsOf = (
  records: readonly RunRecord[],
): readonly {
  readonly stationId: string | null;
  readonly week: string | null;
  readonly records: readonly RunRecord[];
}[] => {
  const byKey = new Map<string, RunRecord[]>();
  const keyOf = (stationId: string | null, week: string | null) =>
    JSON.stringify([stationId, week]);

  for (const record of records) {
    if (record.end) {
      const { stationId } = record.end.place;
      const week = weekOf(record.end.endedAt);

      for (const key of [
        keyOf(null, null),
        keyOf(null, week),
        keyOf(stationId, null),
        keyOf(stationId, week),
      ]) {
        const grouped = byKey.get(key) ?? [];

        grouped.push(record);
        byKey.set(key, grouped);
      }
    }
  }

  return [...byKey.entries()]
    .map(([key, grouped]) => {
      const [stationId, week] = JSON.parse(key) as [
        string | null,
        string | null,
      ];

      return { stationId, week, records: grouped };
    })
    .sort(inCountOrder);
};

const skillUseOf = (
  records: readonly RunRecord[],
): readonly SkillUseCount[] => {
  const keys = [
    ...new Set(
      records.flatMap((each) => [
        ...(each.end?.setup.skills ?? []),
        ...(each.tools?.skillsRead ?? []),
      ]),
    ),
  ].sort(byText);
  const groups = groupsOf(records);

  return keys.flatMap((key) =>
    groups.flatMap(({ stationId, week, records: grouped }) => {
      const enabled = count(grouped, (each) => enabledFor(each, key));
      const used = count(grouped, (each) => usedBy(each, key));

      return enabled + used === 0
        ? []
        : [{ key, stationId, week, enabled, used }];
    }),
  );
};

const refusalsOf = (records: readonly RunRecord[]): readonly ToolRefusals[] => {
  const tools = new Map<string, ToolRefusals>();

  for (const record of records) {
    const named = new Map(
      record.refusals.map((refusal) => [
        JSON.stringify([refusal.server, refusal.tool]),
        refusal,
      ]),
    );

    for (const [key, refusal] of named) {
      tools.set(key, {
        tool: refusal.tool,
        server: refusal.server,
        refused: (tools.get(key)?.refused ?? 0) + 1,
      });
    }
  }

  return [...tools.values()].sort(
    (one, other) =>
      byText(one.tool, other.tool) || nullsFirst(one.server, other.server),
  );
};

const refusedAt = (record: RunRecord, server: string): boolean =>
  record.refusals.some((each) => each.server === server);

const serverCountsOf = (
  records: readonly RunRecord[],
): readonly ServerCounts[] =>
  [
    ...new Set(
      records.flatMap((each) =>
        (each.tools?.servers ?? []).map((calls) => calls.server),
      ),
    ),
  ]
    .sort(byText)
    .map((server): ServerCounts => {
      const calling = records.flatMap((each) => {
        const calls = each.tools?.callsTo(server);
        return calls ? [calls] : [];
      });

      return {
        server,
        runs: calling.length,
        calls: calling.reduce((sum, each) => sum + each.calls, 0),
        failedCalls: calling.reduce((sum, each) => sum + each.failed, 0),
        latency: calling.reduce(
          (merged, each) => merged.plus(each.latency),
          LatencyHistogram.EMPTY,
        ).counts,
        failingRuns: count(records, (each) =>
          each.failedAfterCallingTo(server),
        ),
        refused: count(records, (each) => refusedAt(each, server)),
      };
    });

export const toolCountsOf = (
  history: TeamHistory,
  window: Window,
): ToolCounts => {
  const ran = endedWithin(history.records, window).filter((each) => each.ran);

  return {
    runs: groupsOf(ran).map(({ stationId, week, records: grouped }) => ({
      stationId,
      week,
      runs: grouped.length,
    })),
    stations: stationsOf(ran),
    skills: skillUseOf(ran),
    servers: serverCountsOf(ran),
    refusals: refusalsOf(ran),
  };
};

const byUseThenName = (one: SkillReport, other: SkillReport): number =>
  other.used - one.used || one.key.localeCompare(other.key);

export const toolInsightsFrom = (
  counts: ToolCounts,
  weeks: readonly string[],
  defined: readonly string[],
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
        usedShare: rateOf(used, inWeek),
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
        weeks: team,
        trend: skillTrendOf(team),
        stations: counts.stations.flatMap((place) => {
          const there = useAt(key, place.stationId, null);

          return there.enabled + there.used === 0
            ? []
            : [
                {
                  ...place,
                  runs: runsAt(place.stationId, null),
                  enabled: there.enabled,
                  used: there.used,
                  trend: skillTrendOf(weekly(key, place.stationId)),
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
          refused: each.refused,
        };
      })
      .sort(
        (one, other) =>
          other.runs - one.runs || one.server.localeCompare(other.server),
      ),
    refusals: [...counts.refusals].sort(
      (one, other) =>
        other.refused - one.refused ||
        one.tool.localeCompare(other.tool) ||
        (one.server ?? '').localeCompare(other.server ?? ''),
    ),
  };
};
