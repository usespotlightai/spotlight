import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { rateOf } from '@outcomes/domain/services/measures';
import { weekWindowOf } from '@outcomes/domain/services/pull-request-insights';
import {
  type SkillTrend,
  skillTrendOf,
} from '@outcomes/domain/services/skill-trend';
import {
  type StationPlace,
  stationsOf,
} from '@outcomes/domain/services/team-history';
import { within } from '@outcomes/domain/value-objects/insights-period.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';

export interface SkillWeek {
  readonly week: string;
  readonly runs: number;
  readonly given: number;
  readonly used: number;
  readonly usedShare: number | null;
}

export interface SkillAtStation {
  readonly lineId: string;
  readonly stationId: string;
  readonly runs: number;
  readonly given: number;
  readonly used: number;
  readonly trend: SkillTrend | null;
}

export interface SkillReport {
  readonly key: string;
  readonly defined: boolean;
  readonly given: number;
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

export interface ToolInsights {
  readonly runs: number;
  readonly skills: readonly SkillReport[];
  readonly unused: readonly string[];
  readonly servers: readonly ServerReport[];
  readonly refusals: readonly ToolRefusals[];
}

const givenTo = (record: RunRecord, skill: string): boolean =>
  record.end?.setup.skills.includes(skill) === true;

const usedBy = (record: RunRecord, skill: string): boolean =>
  record.tools?.read(skill) === true;

const count = (
  records: readonly RunRecord[],
  holds: (record: RunRecord) => boolean,
): number => records.filter(holds).length;

const weekly = (
  records: readonly RunRecord[],
  weeks: readonly string[],
  skill: string,
): readonly SkillWeek[] =>
  weeks.map((week) => {
    const inWeek = records.filter((each) =>
      within(weekWindowOf(week), each.end?.endedAt ?? null),
    );

    const used = count(inWeek, (each) => usedBy(each, skill));

    return {
      week,
      runs: inWeek.length,
      given: count(inWeek, (each) => givenTo(each, skill)),
      used,
      usedShare: rateOf(used, inWeek.length),
    };
  });

const byUseThenName = (one: SkillReport, other: SkillReport): number =>
  other.used - one.used || one.key.localeCompare(other.key);

interface StationRecords {
  readonly place: StationPlace;
  readonly records: readonly RunRecord[];
}

const byStation = (
  records: readonly RunRecord[],
): readonly StationRecords[] => {
  const held = new Map<string, RunRecord[]>();

  for (const record of records) {
    const stationId = record.end?.place.stationId;

    if (stationId) {
      const there = held.get(stationId) ?? [];

      there.push(record);
      held.set(stationId, there);
    }
  }

  return stationsOf(records).map((place) => ({
    place,
    records: held.get(place.stationId) ?? [],
  }));
};

const skillReportsOf = (
  records: readonly RunRecord[],
  weeks: readonly string[],
  defined: ReadonlySet<string>,
): readonly SkillReport[] => {
  const keys = new Set(
    records.flatMap((each) => [
      ...(each.end?.setup.skills ?? []),
      ...(each.tools?.skillsRead ?? []),
    ]),
  );
  const stations = byStation(records);

  return [...keys]
    .map((key): SkillReport => {
      const team = weekly(records, weeks, key);
      const atStations = stations.flatMap(({ place, records: there }) => {
        const given = count(there, (each) => givenTo(each, key));
        const used = count(there, (each) => usedBy(each, key));

        return given + used === 0
          ? []
          : [
              {
                ...place,
                runs: there.length,
                given,
                used,
                trend: skillTrendOf(weekly(there, weeks, key)),
              },
            ];
      });

      return {
        key,
        defined: defined.has(key),
        given: count(records, (each) => givenTo(each, key)),
        used: count(records, (each) => usedBy(each, key)),
        weeks: team,
        trend: skillTrendOf(team),
        stations: atStations,
      };
    })
    .sort(byUseThenName);
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
      other.refused - one.refused ||
      one.tool.localeCompare(other.tool) ||
      (one.server ?? '').localeCompare(other.server ?? ''),
  );
};

const refusedAt = (record: RunRecord, server: string): boolean =>
  record.refusals.some((each) => each.server === server);

const serverReportsOf = (
  records: readonly RunRecord[],
): readonly ServerReport[] => {
  const servers = new Set(
    records.flatMap((each) =>
      (each.tools?.servers ?? []).map((calls) => calls.server),
    ),
  );

  return [...servers]
    .map((server): ServerReport => {
      const calling = records.flatMap((each) => {
        const calls = each.tools?.callsTo(server);
        return calls ? [calls] : [];
      });
      const calls = calling.reduce((sum, each) => sum + each.calls, 0);
      const failedCalls = calling.reduce((sum, each) => sum + each.failed, 0);
      const latency = calling.reduce(
        (merged, each) => merged.plus(each.latency),
        LatencyHistogram.EMPTY,
      );

      return {
        server,
        runs: calling.length,
        calls,
        callsPerRun: rateOf(calls, calling.length),
        p50Ms: latency.percentile(50),
        p95Ms: latency.percentile(95),
        failedCalls,
        errorRate: rateOf(failedCalls, calls),
        failingRuns: count(records, (each) =>
          each.failedAfterCallingTo(server),
        ),
        refused: count(records, (each) => refusedAt(each, server)),
      };
    })
    .sort(
      (one, other) =>
        other.runs - one.runs || one.server.localeCompare(other.server),
    );
};

export const toolInsightsOf = (
  records: readonly RunRecord[],
  weeks: readonly string[],
  defined: readonly string[],
): ToolInsights => {
  const ran = records.filter((each) => each.ran);
  const skills = skillReportsOf(ran, weeks, new Set(defined));
  const used = new Set(
    skills.filter((each) => each.used > 0).map((each) => each.key),
  );

  return {
    runs: ran.length,
    skills,
    unused: [...new Set(defined)]
      .filter((each) => !used.has(each))
      .sort((one, other) => one.localeCompare(other)),
    servers: serverReportsOf(ran),
    refusals: refusalsOf(ran),
  };
};
