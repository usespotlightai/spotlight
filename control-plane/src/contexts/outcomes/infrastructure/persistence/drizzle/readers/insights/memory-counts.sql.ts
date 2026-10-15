import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import {
  type GroupCounts,
  NO_GROUP,
} from '@outcomes/domain/services/change-verdict';
import type { MemoryCounts } from '@outcomes/domain/services/memory-comparison';
import type { MemoryWay } from '@outcomes/domain/value-objects/run-memories.vo';
import {
  counted,
  endedIn,
  type GroupColumns,
  groupCountsOf,
  onTeam,
  ran,
  settledColumns,
  tallyColumns,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { runFact } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

interface GroupRow extends GroupColumns, Record<string, unknown> {
  readonly with_memories: boolean;
}

interface UseRow extends Record<string, unknown> {
  readonly runs_briefed: number;
  readonly runs_recalled: number;
  readonly memories_briefed: number;
  readonly memories_recalled: number;
}

const endedInWindow = (team: TeamInPeriod): SQL => {
  const { current } = team.period;

  return sql`(
    select ${runFact}.* from ${runFact}
    where ${onTeam(team)} and ${endedIn(current.from, current.to)}
  ) as ${runFact}`;
};

const usedAny = (way: MemoryWay): SQL =>
  sql`jsonb_array_length(${runFact.memories}->${sql.raw(`'${way}'`)}) > 0`;

const groupsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly GroupRow[]> => {
  const withMemories = sql`(${usedAny('briefed')} or ${usedAny('recalled')})`;
  const result = await db.execute<GroupRow>(sql`
    select
      ${withMemories} as with_memories,
      ${tallyColumns},
      ${settledColumns}
    from ${endedInWindow(team)}
    where ${ran}
    group by ${withMemories}
  `);

  return result.rows;
};

const usesIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<UseRow> => {
  const distinct = (way: MemoryWay): SQL => sql`(
    select count(distinct used.memory)::int
    from ${endedInWindow(team)}
    cross join lateral jsonb_array_elements_text(${runFact.memories}->${sql.raw(`'${way}'`)}) as used(memory)
  )`;
  const result = await db.execute<UseRow>(sql`
    select
      ${counted(sql`${ran} and ${usedAny('briefed')}`)} as runs_briefed,
      ${counted(sql`${ran} and ${usedAny('recalled')}`)} as runs_recalled,
      ${distinct('briefed')} as memories_briefed,
      ${distinct('recalled')} as memories_recalled
    from ${endedInWindow(team)}
  `);
  const [row] = result.rows;

  return (
    row ?? {
      runs_briefed: 0,
      runs_recalled: 0,
      memories_briefed: 0,
      memories_recalled: 0,
    }
  );
};

const groupOf = (row: GroupRow | undefined): GroupCounts =>
  row ? groupCountsOf(row) : NO_GROUP;

export const memoryCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<MemoryCounts> => {
  const groups = await groupsIn(db, team);
  const uses = await usesIn(db, team);

  return {
    withMemories: groupOf(groups.find((each) => each.with_memories)),
    withoutMemories: groupOf(groups.find((each) => !each.with_memories)),
    runsBriefed: uses.runs_briefed,
    runsRecalled: uses.runs_recalled,
    memoriesBriefed: uses.memories_briefed,
    memoriesRecalled: uses.memories_recalled,
  };
};
