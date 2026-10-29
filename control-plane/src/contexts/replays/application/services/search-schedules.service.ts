import type { WorkPort } from '@replays/application/ports/work.port';
import type { ConfigPullRequestClosed } from '@replays/domain/events/config-pull-request-closed.event';
import type { ConfigPullRequestMerged } from '@replays/domain/events/config-pull-request-merged.event';
import type { ConfigPullRequestReopened } from '@replays/domain/events/config-pull-request-reopened.event';
import { StationSearchScheduleDeletionRequested } from '@replays/domain/events/station-search-schedule-deletion-requested.event';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import type { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class SearchSchedules {
  constructor(
    private readonly schedules: StationSearchScheduleRepository,
    private readonly work: WorkPort,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  alerted(stationId: string): Promise<void> {
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

  async lineChanged(lineId: string): Promise<void> {
    const now = this.clock.now();

    for (const each of await this.schedules.ofLine(lineId)) {
      const live = await this.work.live(lineId, each.stationId);

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

  async deleteForTeam(
    teamId: TeamId,
    workspaceId: WorkspaceId,
  ): Promise<readonly DomainEvent[]> {
    return (await this.schedules.ofTeam(teamId)).map(
      (each) =>
        new StationSearchScheduleDeletionRequested(each.stationId, workspaceId),
    );
  }

  delete(stationId: string): Promise<void> {
    return this.deleted(stationId);
  }

  private deleted(stationId: string): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const locked = await this.schedules.locked(stationId);

      if (locked) {
        await this.schedules.save(locked.delete());
      }
    });
  }
}
