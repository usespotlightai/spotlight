import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import type { RunStreamPort } from '@runs/application/ports/run-stream.port';
import type { RunProvisionFailed } from '@runs/domain/events/run-provision-failed.event';
import { PROVISION_FAILED } from '@runs/domain/value-objects/journal-entry-type';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';

export class ProvisionFailureMarks {
  constructor(
    private readonly journal: RunJournalPort,
    private readonly stream: RunStreamPort,
  ) {}

  async onProvisionFailed(event: RunProvisionFailed): Promise<void> {
    const entry = {
      type: PROVISION_FAILED,
      message: `Provisioning failed · ${event.failure}`,
      data: Buffer.from(event.detail, 'utf8').toString('base64'),
    };
    const seq = await this.journal.appendControlPlaneEntry(
      RunAttempt.of(event.runId, event.attempt),
      { ...entry, at: event.at },
    );

    this.stream.publish(event.runId.value, [
      { ...entry, seq, attempt: event.attempt, at: event.at.toISOString() },
    ]);
  }
}
