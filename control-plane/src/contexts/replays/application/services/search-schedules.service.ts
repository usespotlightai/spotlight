import type { StationConfigs } from '@replays/application/services/station-configs.service';
import type { ConfigPullRequestClosed } from '@replays/domain/events/config-pull-request-closed.event';
import type { ConfigPullRequestMerged } from '@replays/domain/events/config-pull-request-merged.event';
import type { ConfigPullRequestReopened } from '@replays/domain/events/config-pull-request-reopened.event';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class SearchSchedules {
  constructor(
    private readonly schedules: StationSearchScheduleRepository,
    private readonly configs: StationConfigs,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  alerted(stationId: StationId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const schedule = await this.schedules.locked(stationId);

      if (schedule) {
        await this.schedules.save(schedule.alerted(this.clock.now()));
      }
    });
  }

  improved(event: ConfigPullRequestMerged): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const schedule = await this.schedules.locked(event.stationId);

      if (schedule) {
        await this.schedules.save(schedule.improved(event.at));
      }
    });
  }

  async rejected(event: ConfigPullRequestClosed): Promise<void> {
    if (event.because !== 'by-person') {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const schedule = await this.schedules.locked(event.stationId);

      if (schedule) {
        await this.schedules.save(
          schedule.configRejected(event.proposing, event.basedOn, event.at),
        );
      }
    });
  }

  async reopened(event: ConfigPullRequestReopened): Promise<void> {
    if (event.closedBecause !== 'by-person') {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const schedule = await this.schedules.locked(event.stationId);

      if (schedule) {
        await this.schedules.save(schedule.configReopened(event.proposing));
      }
    });
  }

  async lineChanged(lineId: LineId): Promise<void> {
    const now = this.clock.now();

    for (const each of await this.schedules.ofLine(lineId)) {
      const live = await this.configs.live(lineId, each.stationId);

      await this.transaction.inTransaction(async () => {
        const locked = await this.schedules.locked(each.stationId);

        if (!locked) {
          return;
        }

        const pruned = locked.liveChanged(live?.fingerprint ?? null);
        const looked = pruned.isDue(now) ? pruned : pruned.postponed(now);

        if (looked !== locked) {
          await this.schedules.save(looked);
        }
      });
    }
  }

  async setGone(setId: ReplaySetId): Promise<void> {
    const schedule = await this.schedules.ofSet(setId);

    if (schedule) {
      await this.deleted(schedule.stationId);
    }
  }

  async ofTeam(teamId: TeamId): Promise<void> {
    for (const schedule of await this.schedules.ofTeam(teamId)) {
      await this.transaction.inTransaction(() =>
        this.schedules.save(schedule.delete()),
      );
    }
  }

  private deleted(stationId: StationId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const locked = await this.schedules.locked(stationId);

      if (locked) {
        await this.schedules.save(locked.delete());
      }
    });
  }
}
