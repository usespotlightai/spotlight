import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { storedOutcome } from '@replays/infrastructure/persistence/drizzle/mappers/replay-outcome.mapper';
import { replayOutcome } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import { and, inArray, isNotNull, lte, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleReplayOutcomes {
  constructor(private readonly context: DrizzleContext) {}

  async put(replay: Replay): Promise<void> {
    const outcome = replay.outcome();
    const columns = {
      workspaceId: replay.workspaceId.value,
      teamId: replay.teamId.value,
      lineId: replay.station.lineId.value,
      stationId: replay.station.stationId.value,
      setId: outcome.setId.value,
      candidateId: outcome.candidateId.value,
      searchId: outcome.searchId?.value ?? null,
      state: outcome.current,
      servesAsBaseline: outcome.servesAsBaseline,
      healthSampleGroup: outcome.healthSampleGroup?.value ?? null,
      sampledAt: outcome.sampledAt,
      startedAt: outcome.startedAt,
      endedAt: outcome.endedAt,
      outcome: storedOutcome(outcome),
    };

    await this.context.db
      .insert(replayOutcome)
      .values({ replayId: outcome.id.value, ...columns })
      .onConflictDoUpdate({ target: replayOutcome.replayId, set: columns });
  }

  async healthSampleCandidatesOf(
    setIds: readonly ReplaySetId[],
    perGroup: number,
  ): Promise<readonly ReplayId[]> {
    if (setIds.length === 0) {
      return [];
    }

    const ranked = this.context.db
      .select({
        replayId: replayOutcome.replayId,
        place:
          sql<number>`rank() over (partition by ${replayOutcome.setId}, ${replayOutcome.healthSampleGroup} order by ${replayOutcome.sampledAt} desc)`.as(
            'place',
          ),
      })
      .from(replayOutcome)
      .where(
        and(
          inArray(replayOutcome.setId, [
            ...new Set(setIds.map((each) => each.value)),
          ]),
          isNotNull(replayOutcome.healthSampleGroup),
        ),
      )
      .as('ranked');
    const rows = await this.context.db
      .select({ replayId: ranked.replayId })
      .from(ranked)
      .where(lte(ranked.place, perGroup));

    return rows.map((each) => ReplayId.of(each.replayId));
  }
}
