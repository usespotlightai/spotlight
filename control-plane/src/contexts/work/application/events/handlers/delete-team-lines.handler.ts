import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { StationNotEmptyError } from '@work/domain/exceptions/station-not-empty.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';

export class DeleteTeamLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly tallies: StationTalliesPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async deleteForTeam(teamId: TeamId): Promise<void> {
    for (const line of await this.lines.ofTeam(teamId)) {
      try {
        await this.transaction.inTransaction(async () => {
          const tasks = await this.tallies.lockedTaskCountsAt(
            line.stations.map((each) => each.id),
          );

          await this.lines.save(
            line.delete(tasks, ChangeActor.spotlight(line.workspaceId)),
          );
        });
      } catch (error) {
        if (
          !(error instanceof LineInUseError) &&
          !(error instanceof StationNotEmptyError)
        ) {
          throw error;
        }

        this.logger.warn(
          { lineId: line.id.value, teamId: teamId.value },
          'A deleted team’s line still has tasks, so it stays',
        );
      }
    }
  }
}
