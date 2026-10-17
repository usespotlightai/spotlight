import type { RunnerEgressPort } from '@runners/application/ports/runner-egress.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RecordEgressConnectionsCommand } from '@work/application/commands/egress.commands';
import type {
  EgressConnectionRecord,
  EgressConnectionsRecordedDto,
} from '@work/application/dto/egress-connections.dto';
import type { RunConnectionsPort } from '@work/application/ports/run-connections.port';
import type { EgressRedemptions } from '@work/application/services/egress-redemptions.service';
import { InvalidRunConnectionError } from '@work/domain/exceptions/invalid-run-connection.error';
import { RunConnection } from '@work/domain/value-objects/run-connection.vo';

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

export class RecordEgressConnectionsHandler
  implements
    CommandHandlerPort<
      RecordEgressConnectionsCommand,
      EgressConnectionsRecordedDto
    >
{
  constructor(
    private readonly egress: RunnerEgressPort,
    private readonly redemptions: EgressRedemptions,
    private readonly connections: RunConnectionsPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: RecordEgressConnectionsCommand,
  ): Promise<EgressConnectionsRecordedDto> {
    try {
      const shared = await this.egress.sharedWith(command.token);

      if (!shared) {
        return { outcome: 'refused' };
      }

      if (command.records.length > MAX_CONNECTIONS_AT_ONCE) {
        return { outcome: 'too-many', max: MAX_CONNECTIONS_AT_ONCE };
      }

      const byCredential = new Map<string, EgressConnectionRecord[]>();

      for (const record of command.records) {
        const kept = byCredential.get(record.proxyCredential) ?? [];
        kept.push(record);
        byCredential.set(record.proxyCredential, kept);
      }

      let recorded = 0;

      for (const [credential, records] of byCredential) {
        const recording = await this.egress.recordsThrough(
          shared,
          credential,
          this.clock.now(),
        );
        const attempt =
          recording?.work?.kind === 'run'
            ? await this.redemptions.attemptWorkedBy(
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
