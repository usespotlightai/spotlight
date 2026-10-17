import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { PendingMessageDto } from '@work/application/dto/pending-message.dto';
import type { LeasedRunReaderPort } from '@work/application/ports/leased-run-reader.port';
import type { PendingMessagesQuery } from '@work/application/queries/pending-messages.query';
import { Attached } from '@work/application/rendering/attached';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class PendingMessagesHandler
  implements QueryHandlerPort<PendingMessagesQuery, PendingMessageDto[]>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly leasedRuns: LeasedRunReaderPort,
  ) {}

  async execute(query: PendingMessagesQuery): Promise<PendingMessageDto[]> {
    try {
      const runId = RunId.of(query.runId);
      const runner = RunnerId.of(query.runnerId);
      const run = await this.runs.findById(runId);

      if (run?.pausedBy(runner)) {
        return [];
      }

      const pending = await this.leasedRuns.pendingFor(runId, runner);

      if (!pending) {
        throw new UnknownRunError(
          `Runner ${query.runnerId} has no lease on run ${query.runId}.`,
        );
      }

      return pending.map((each) => ({
        position: each.position,
        body: Attached.beside(each.body, each.attachments),
        attachments: Attached.shapes(each.attachments),
      }));
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
