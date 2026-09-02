import type { RunDigestWriterPort } from '@application/ports/run-digest-writer.port';
import type { RunOutcomes } from '@application/services/run-outcomes';
import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import type { RunCompleted } from '@domain/events/run-completed.event';

/**
 * Works out what a run came to as soon as it is over, so nothing has to read
 * its journal again, and so that reading a trace never has to write one.
 */
export class DigestRun implements RunOutcomes {
  constructor(private readonly digests: RunDigestWriterPort) {}

  async onRunCompleted(event: RunCompleted): Promise<void> {
    await this.digests.ensure([event.runId]);
  }

  async onRunAbandoned(event: RunAbandoned): Promise<void> {
    await this.digests.ensure([event.runId]);
  }
}
