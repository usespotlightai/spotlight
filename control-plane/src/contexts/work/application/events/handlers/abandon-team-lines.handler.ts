import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { StrandedWorkError } from '@work/domain/exceptions/stranded-work.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';

export class AbandonTeamLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly tallies: StationTalliesPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async of(teamId: TeamId): Promise<void> {
    for (const line of await this.lines.ofTeam(teamId)) {
      try {
        await this.transaction.run(async () => {
          const tasks = await this.tallies.lockedStandingAt(
            line.stations.map((each) => each.id),
          );

          await this.lines.save(
            line.retired(tasks, Attribution.spotlight(line.workspaceId)),
          );
        });
      } catch (error) {
        if (
          !(error instanceof LineInUseError) &&
          !(error instanceof StrandedWorkError)
        ) {
          throw error;
        }

        this.logger.warn(
          { lineId: line.id.value, teamId: teamId.value },
          'A disbanded team’s line still has tasks, so it stays',
        );
      }
    }
  }
}
