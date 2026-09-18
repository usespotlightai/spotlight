import type { RunDigestWriterPort } from '@work/application/ports/run-digest-writer.port';
import type { RunOutcomes } from '@work/application/services/run-outcomes';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';

export class DigestRun implements RunOutcomes {
  constructor(private readonly digests: RunDigestWriterPort) {}

  async onRunCompleted(event: RunCompleted): Promise<void> {
    await this.digests.ensure([event.runId]);
  }

  async onRunAbandoned(event: RunAbandoned): Promise<void> {
    await this.digests.ensure([event.runId]);
  }
}
