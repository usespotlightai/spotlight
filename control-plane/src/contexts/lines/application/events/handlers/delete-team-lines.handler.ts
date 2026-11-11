import type { ApplyLines } from '@lines/application/services/apply-lines.service';
import { LineInUseError } from '@lines/domain/exceptions/line-in-use.error';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class DeleteTeamLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly applying: ApplyLines,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async deleteForTeam(teamId: TeamId): Promise<void> {
    for (const line of await this.lines.ofTeam(teamId)) {
      try {
        await this.transaction.inTransaction(() =>
          this.applying.delete(line, ChangeActor.spotlight(line.workspaceId)),
        );
      } catch (error) {
        if (!(error instanceof LineInUseError)) {
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
