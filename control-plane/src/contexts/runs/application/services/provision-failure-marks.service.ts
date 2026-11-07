import type {
  ControlPlaneEntry,
  RunJournalPort,
} from '@runs/application/ports/run-journal.port';
import type { RunStreamPort } from '@runs/application/ports/run-stream.port';
import { controlPlaneEntryText } from '@runs/application/rendering/journal-entry.text';
import type { RunProvisionFailed } from '@runs/domain/events/run-provision-failed.event';
import { PROVISION_FAILED } from '@runs/domain/value-objects/journal-entry-type';

export class ProvisionFailureMarks {
  constructor(
    private readonly journal: RunJournalPort,
    private readonly stream: RunStreamPort,
  ) {}

  async onProvisionFailed(event: RunProvisionFailed): Promise<void> {
    const entry: ControlPlaneEntry = {
      type: PROVISION_FAILED,
      failure: event.failure,
      detail: event.detail,
      at: event.at,
    };
    const written = await this.journal.appendControlPlaneEntry(
      event.attempt,
      entry,
    );

    this.stream.publish(event.runId.value, [
      {
        type: written.type,
        data: written.data,
        message: controlPlaneEntryText(entry),
        seq: written.seq,
        attempt: event.attempt.number,
        at: event.at.toISOString(),
      },
    ]);
  }
}
