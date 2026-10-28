import type { PeoplePort } from '@replays/application/ports/people.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { StationHasReplaySetError } from '@replays/domain/exceptions/station-has-replay-set.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class KeepReplaySets {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async onRunEnded(
    stationId: string | null,
    workspaceId: WorkspaceId,
  ): Promise<void> {
    if (!stationId || (await this.sets.ofStation(stationId))) {
      return;
    }

    const station = await this.work.findStation(stationId);

    if (
      !station?.workspaceId.equals(workspaceId) ||
      (await this.people.teamKey(station.teamId)) === null
    ) {
      return;
    }

    try {
      await this.sets.add(
        ReplaySet.create({
          id: ReplaySetId.of(this.ids.generate()),
          station: {
            workspaceId: station.workspaceId,
            teamId: station.teamId,
            lineId: station.lineId,
            stationId: station.stationId,
          },
          at: this.clock.now(),
        }),
      );
    } catch (error) {
      if (!(error instanceof StationHasReplaySetError)) {
        throw error;
      }
    }
  }
}
