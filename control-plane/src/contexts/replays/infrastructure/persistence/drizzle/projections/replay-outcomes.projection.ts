import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { storedOutcome } from '@replays/infrastructure/persistence/drizzle/mappers/replay-outcome.mapper';
import { replayOutcome } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';

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
}
