import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { DrizzleReplayOutcomes } from '@replays/infrastructure/persistence/drizzle/projections/replay-outcomes.projection';
import { replay } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import { asc, eq } from 'drizzle-orm';

const BATCH = 100;

export class ReplayOutcomesRebuild {
  constructor(
    private readonly context: DrizzleContext,
    private readonly replays: ReplayRepository,
    private readonly outcomes: DrizzleReplayOutcomes,
  ) {}

  async teams(): Promise<readonly string[]> {
    const rows = await this.context.db
      .selectDistinct({ teamId: replay.teamId })
      .from(replay)
      .orderBy(asc(replay.teamId));

    return rows.map((each) => each.teamId);
  }

  async ofTeam(teamId: string): Promise<number> {
    const rows = await this.context.db
      .select({ id: replay.id })
      .from(replay)
      .where(eq(replay.teamId, teamId))
      .orderBy(asc(replay.id));
    const ids = rows.map((each) => ReplayId.of(each.id));

    for (let from = 0; from < ids.length; from += BATCH) {
      for (const each of await this.replays.findMany(
        ids.slice(from, from + BATCH),
      )) {
        await this.outcomes.put(each);
      }
    }

    return ids.length;
  }
}
