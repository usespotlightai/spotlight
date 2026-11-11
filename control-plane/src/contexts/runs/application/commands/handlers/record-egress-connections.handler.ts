import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import type { RecordEgressConnectionsCommand } from '@runs/application/commands/egress.commands';
import type {
  EgressConnectionRecord,
  EgressConnectionsRecordedDto,
} from '@runs/application/dto/egress-connections.dto';
import type { RunConnectionLedgerPort } from '@runs/application/ports/run-connection-ledger.port';
import type { EgressSecretFetches } from '@runs/application/services/egress-secret-fetches.service';
import { InvalidRunConnectionError } from '@runs/domain/exceptions/invalid-run-connection.error';
import { RunConnection } from '@runs/domain/value-objects/run-connection.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const MAX_CONNECTIONS_AT_ONCE = 2_000;

const connectionOf = (
  record: EgressConnectionRecord,
  now: Date,
): RunConnection | null => {
  try {
    return RunConnection.record(
      {
        ...record,
        status: record.status ?? null,
        reason: record.reason ?? null,
        at: new Date(record.at),
      },
      now,
    );
  } catch (error) {
    if (error instanceof InvalidRunConnectionError) {
      return null;
    }

    throw error;
  }
};

export class RecordEgressConnectionsHandler implements CommandHandlerPort<
  RecordEgressConnectionsCommand,
  EgressConnectionsRecordedDto
> {
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly fetches: EgressSecretFetches,
    private readonly connections: RunConnectionLedgerPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: RecordEgressConnectionsCommand,
  ): Promise<EgressConnectionsRecordedDto> {
    try {
      const shared = await this.egress.sharedWith(command.token);

      if (!shared) {
        return { outcome: 'unauthorized' };
      }

      if (command.records.length > MAX_CONNECTIONS_AT_ONCE) {
        return { outcome: 'too-many', max: MAX_CONNECTIONS_AT_ONCE };
      }

      const byCredential = new Map<string, EgressConnectionRecord[]>();

      for (const record of command.records) {
        const grouped = byCredential.get(record.proxyCredential) ?? [];
        grouped.push(record);
        byCredential.set(record.proxyCredential, grouped);
      }

      let recorded = 0;

      for (const [credential, records] of byCredential) {
        const recording = await this.egress.runnerForConnectionRecords(
          shared,
          credential,
          this.clock.now(),
        );
        const attempt =
          recording?.work?.kind === 'run'
            ? await this.fetches.attemptClaimedBy(
                RunId.of(recording.work.id),
                RunnerId.of(recording.runnerId),
                recording.workspaceId,
              )
            : null;

        if (!attempt) {
          continue;
        }

        const connections = records
          .map((each) => connectionOf(each, this.clock.now()))
          .filter((each): each is RunConnection => each !== null);

        await this.connections.record(attempt, connections);
        recorded += connections.length;
      }

      return {
        outcome: 'recorded',
        recorded,
        dropped: command.records.length - recorded,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
