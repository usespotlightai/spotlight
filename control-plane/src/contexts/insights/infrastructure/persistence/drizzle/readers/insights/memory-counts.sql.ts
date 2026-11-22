import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import {
  type GroupCounts,
  NO_GROUP,
} from '@insights/domain/services/change-verdict';
import type {
  CutThenRead,
  MemoryCounts,
  UseCount,
} from '@insights/domain/services/memory-comparison';
import {
  type MemoryVia,
  USED,
  type UsedVia,
} from '@insights/domain/value-objects/run-memories.vo';
import {
  counted,
  endedIn,
  type GroupColumns,
  groupCountsOfRow,
  measuredColumns,
  onTeam,
  ran,
  tallyColumns,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { runFact } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { type SQL, sql } from 'drizzle-orm';

const MOST_READ_CUTS = 5;

interface GroupRow extends GroupColumns, Record<string, unknown> {
  readonly with_memories: boolean;
}

interface CutRow extends Record<string, unknown> {
  readonly memory: string;
  readonly runs: number;
}

const endedInWindow = (team: TeamInPeriod): SQL => {
  const { current } = team.period;

  return sql`(
    select ${runFact}.* from ${runFact}
    where ${onTeam(team)} and ${endedIn(current.from, current.to)}
  ) as ${runFact}`;
};

type StoredList = MemoryVia | 'cutThenRead';

const listOf = (list: StoredList): SQL =>
  sql`(${runFact.memories}->${sql.raw(`'${list}'`)})`;

const usedAny = (via: MemoryVia): SQL =>
  sql`jsonb_array_length(${listOf(via)}) > 0`;

const groupsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly GroupRow[]> => {
  const withMemories = sql`(${runFact.memories}->>'used')::boolean`;
  const result = await db.execute<GroupRow>(sql`
    select
      ${withMemories} as with_memories,
      ${tallyColumns},
      ${measuredColumns}
    from ${endedInWindow(team)}
    where ${ran}
    group by ${withMemories}
  `);

  return result.rows;
};

const useOf = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  via: MemoryVia,
): Promise<UseCount> => {
  const result = await db.execute<{ runs: number; memories: number }>(sql`
    select
      ${counted(sql`${ran} and ${usedAny(via)}`)} as runs,
      (
        select count(distinct used.memory)::int
        from ${endedInWindow(team)}
        cross join lateral jsonb_array_elements_text(${listOf(via)}) as used(memory)
      ) as memories
    from ${endedInWindow(team)}
  `);
  const [row] = result.rows;

  return { runs: row?.runs ?? 0, memories: row?.memories ?? 0 };
};

const cutsReadIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<CutThenRead> => {
  const cuts = sql`(
    select ${runFact.runId} as run, cut.memory
    from ${endedInWindow(team)}
    cross join lateral jsonb_array_elements_text(${listOf('cutThenRead')}) as cut(memory)
    where ${ran}
  ) as cut_read`;
  const totals = await db.execute<{ runs: number; memories: number }>(sql`
    select count(distinct run)::int as runs, count(distinct memory)::int as memories
    from ${cuts}
  `);
  const most = await db.execute<CutRow>(sql`
    select memory, count(distinct run)::int as runs
    from ${cuts}
    group by memory
    order by runs desc, memory
    limit ${MOST_READ_CUTS}
  `);
  const [total] = totals.rows;

  return {
    runs: total?.runs ?? 0,
    memories: total?.memories ?? 0,
    most: most.rows.map((row) => ({ memoryId: row.memory, runs: row.runs })),
  };
};

const groupOf = (row: GroupRow | undefined): GroupCounts =>
  row ? groupCountsOfRow(row) : NO_GROUP;

export const memoryCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<MemoryCounts> => {
  const groups = await groupsIn(db, team);
  const uses = new Map<UsedVia, UseCount>(
    await Promise.all(
      USED.map(async (via) => [via, await useOf(db, team, via)] as const),
    ),
  );
  const useBy = (via: UsedVia): UseCount =>
    uses.get(via) ?? { runs: 0, memories: 0 };

  return {
    withMemories: groupOf(groups.find((each) => each.with_memories)),
    withoutMemories: groupOf(groups.find((each) => !each.with_memories)),
    briefed: useBy('briefed'),
    read: useBy('read'),
    recalled: useBy('recalled'),
    delivered: useBy('delivered'),
    cutThenRead: await cutsReadIn(db, team),
  };
};
