import type { PeoplePort } from '@replays/application/ports/people.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { StationHasReplaySetError } from '@replays/domain/exceptions/station-has-replay-set.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class KeepReplaySets {
  constructor(
    private readonly sets: ReplaySetRepository,
    private readonly schedules: StationSearchScheduleRepository,
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async onRunEnded(
    stationId: string | null,
    workspaceId: WorkspaceId,
  ): Promise<void> {
    if (!stationId) {
      return;
    }

    const kept = await this.sets.ofStation(stationId);

    if (kept) {
      await this.scheduled(kept);
      return;
    }

    const station = await this.work.findStation(stationId);

    if (
      !station?.workspaceId.equals(workspaceId) ||
      (await this.people.teamKey(station.teamId)) === null
    ) {
      return;
    }

    const created = ReplaySet.create({
      id: ReplaySetId.of(this.ids.generate()),
      station: {
        workspaceId: station.workspaceId,
        teamId: station.teamId,
        lineId: station.lineId,
        stationId: station.stationId,
      },
      at: this.clock.now(),
    });

    try {
      await this.sets.add(created);
    } catch (error) {
      if (!(error instanceof StationHasReplaySetError)) {
        throw error;
      }
      return;
    }

    await this.scheduled(created);
  }

  private async scheduled(set: ReplaySet): Promise<void> {
    if (set.isAtGoneStation || (await this.schedules.ofSet(set.id))) {
      return;
    }

    await this.schedules.add(
      StationSearchSchedule.create({
        station: set.station,
        setId: set.id,
        at: this.clock.now(),
      }),
    );
  }
}
