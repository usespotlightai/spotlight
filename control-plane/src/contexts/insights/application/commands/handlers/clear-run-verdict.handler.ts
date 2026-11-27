import type { ClearRunVerdictCommand } from '@insights/application/commands/clear-run-verdict.command';
import type { TeamRunRecords } from '@insights/application/services/team-run-records.service';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class ClearRunVerdictHandler implements CommandHandlerPort<
  ClearRunVerdictCommand,
  void
> {
  constructor(
    private readonly onTeam: TeamRunRecords,
    private readonly records: RunRecordRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: ClearRunVerdictCommand): Promise<void> {
    try {
      const { record } = await this.onTeam.onTeam(command);
      const cleared = record.clearVerdict();

      if (cleared !== record) {
        await this.transaction.inTransaction(() => this.records.save(cleared));
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
