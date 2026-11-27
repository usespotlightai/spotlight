import type { RecordRunVerdictCommand } from '@insights/application/commands/record-run-verdict.command';
import type { TeamRunRecords } from '@insights/application/services/team-run-records.service';
import type { RunRecordRepository } from '@insights/domain/repositories/run-record.repository';
import { PersonVerdict } from '@insights/domain/value-objects/person-verdict.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class RecordRunVerdictHandler implements CommandHandlerPort<
  RecordRunVerdictCommand,
  void
> {
  constructor(
    private readonly onTeam: TeamRunRecords,
    private readonly records: RunRecordRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RecordRunVerdictCommand): Promise<void> {
    try {
      const { access, record } = await this.onTeam.onTeam(command);
      const marked = record.recordVerdict(
        PersonVerdict.of({
          right: command.right,
          reason: command.reason,
          by: access.by,
          at: this.clock.now(),
        }),
      );

      if (marked !== record) {
        await this.transaction.inTransaction(() => this.records.save(marked));
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
