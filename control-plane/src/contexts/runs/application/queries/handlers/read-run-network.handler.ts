import type { RunNetworkDto } from '@runs/application/dto/run-network.dto';
import type { RunConnectionsPort } from '@runs/application/ports/run-connections.port';
import type { RunJournalEntryReaderPort } from '@runs/application/ports/run-journal-entry-reader.port';
import type { ReadRunNetworkQuery } from '@runs/application/queries/read-run-network.query';
import type { RunViewing } from '@runs/application/services/run-viewing.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadRunNetworkHandler
  implements QueryHandlerPort<ReadRunNetworkQuery, RunNetworkDto | null>
{
  constructor(
    private readonly runs: RunViewing,
    private readonly events: RunJournalEntryReaderPort,
    private readonly connections: RunConnectionsPort,
  ) {}

  async execute(query: ReadRunNetworkQuery): Promise<RunNetworkDto | null> {
    try {
      const runId = RunId.of(query.runId);
      const found = await this.runs.watchedBy(runId, UserId.of(query.viewerId));

      const team = found?.requester.team ?? null;

      if (!found || (team !== null && team !== query.teamId)) {
        return null;
      }

      const egressEnforcement = await this.events.egressEnforcementOf(
        runId,
        found.attempt,
      );
      const recorded = await this.connections.of(runId.value);

      return {
        runId: found.runId.value,
        attempt: found.attempt,
        egressEnforcement,
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
