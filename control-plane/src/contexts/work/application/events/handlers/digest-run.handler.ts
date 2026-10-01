import type { RunDigestReaderPort } from '@work/application/ports/run-digest-reader.port';
import type { RunDigestWriterPort } from '@work/application/ports/run-digest-writer.port';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunDigested } from '@work/domain/events/run-digested.event';

export class DigestRun {
  constructor(
    private readonly digests: RunDigestWriterPort,
    private readonly written: RunDigestReaderPort,
  ) {}

  onRunCompleted(event: RunCompleted): Promise<readonly RunDigested[]> {
    return this.digested(event);
  }

  onRunAbandoned(event: RunAbandoned): Promise<readonly RunDigested[]> {
    return this.digested(event);
  }

  private async digested(
    event: RunCompleted | RunAbandoned,
  ): Promise<readonly RunDigested[]> {
    await this.digests.ensure([event.runId]);

    const digest = (await this.written.forRuns([event.runId])).get(
      event.runId.value,
    );

    return digest
      ? [
          new RunDigested(
            event.runId,
            event.workspaceId,
            event.taskId,
            digest.ms,
            digest.steps,
            digest.faults,
            digest.used,
            digest.size,
            digest.cost,
            digest.tokens,
          ),
        ]
      : [];
  }
}
