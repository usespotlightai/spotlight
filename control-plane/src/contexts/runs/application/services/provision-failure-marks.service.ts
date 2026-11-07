import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import type { RunStreamPort } from '@runs/application/ports/run-stream.port';
import { journalEntryText } from '@runs/application/rendering/journal-entry.text';
import type { RunProvisionFailed } from '@runs/domain/events/run-provision-failed.event';
import { PROVISION_FAILED } from '@runs/domain/value-objects/journal-entry-type';

export class ProvisionFailureMarks {
  constructor(
    private readonly journal: RunJournalPort,
    private readonly stream: RunStreamPort,
  ) {}

  async onProvisionFailed(event: RunProvisionFailed): Promise<void> {
    const entry = {
      type: PROVISION_FAILED,
      data: Buffer.from(
        JSON.stringify({ failure: event.failure, detail: event.detail }),
        'utf8',
      ).toString('base64'),
    };
    const seq = await this.journal.appendControlPlaneEntry(event.attempt, {
      ...entry,
      at: event.at,
    });

    this.stream.publish(event.runId.value, [
      {
        ...entry,
        message: journalEntryText(entry),
        seq,
        attempt: event.attempt.number,
        at: event.at.toISOString(),
      },
    ]);
  }
}
