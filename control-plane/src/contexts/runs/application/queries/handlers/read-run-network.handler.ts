import {
  EGRESS_CHECKED,
  parseEnforcement,
} from '@runs/application/contracts/run-journal.contract';
import type { RunNetworkDto } from '@runs/application/dto/run-network.dto';
import type { RunConnectionsPort } from '@runs/application/ports/run-connections.port';
import type { RunEventReaderPort } from '@runs/application/ports/run-event-reader.port';
import type { RunViewersPort } from '@runs/application/ports/run-viewers.port';
import type { ReadRunNetworkQuery } from '@runs/application/queries/read-run-network.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadRunNetworkHandler
  implements QueryHandlerPort<ReadRunNetworkQuery, RunNetworkDto | null>
{
  constructor(
    private readonly runs: RunViewersPort,
    private readonly events: RunEventReaderPort,
    private readonly connections: RunConnectionsPort,
  ) {}

  async execute(query: ReadRunNetworkQuery): Promise<RunNetworkDto | null> {
    try {
      const runId = RunId.of(query.runId);
      const found = await this.runs.watchedBy(runId, UserId.of(query.viewerId));

      if (!found) {
        return null;
      }

      const checked = await this.events.lastOfType(
        runId,
        found.attempt,
        EGRESS_CHECKED,
      );
      const recorded = await this.connections.of(runId.value);

      return {
        runId: found.runId.value,
        attempt: found.attempt,
        egressEnforcement: parseEnforcement(checked?.data),
        connections: recorded
          .filter((each) => each.attempt === found.attempt)
          .map(({ connection }) => ({
            host: connection.host,
            port: connection.port,
            bytesOut: connection.bytesOut,
            bytesIn: connection.bytesIn,
            ms: connection.ms,
            outcome: connection.outcome,
            status: connection.status,
            reason: connection.reason,
            error: connection.error,
            at: connection.at.toISOString(),
          })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
