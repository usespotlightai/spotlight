import type {
  HookCallTrace,
  HookTracesPort,
} from '@runs/application/ports/hook-traces.port';
import type {
  ControlPlaneEntry,
  RunJournalPort,
} from '@runs/application/ports/run-journal.port';
import type { RunStreamPort } from '@runs/application/ports/run-stream.port';
import { controlPlaneEntryText } from '@runs/application/rendering/journal-entry.text';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { HOOK_CALLED } from '@runs/domain/value-objects/journal-entry-type';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class HookTraces implements HookTracesPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly journal: RunJournalPort,
    private readonly stream: RunStreamPort,
  ) {}

  async record(runId: string, call: HookCallTrace): Promise<void> {
    const run = await this.runs.findById(RunId.of(runId));

    const attempt = run?.attemptNumbered(call.attempt);

    if (!run || !attempt) {
      return;
    }

    const at = new Date(call.startedAt.getTime() + call.ms);
    const entry: ControlPlaneEntry = { type: HOOK_CALLED, call, at };

    const written = await this.journal.appendControlPlaneEntry(attempt, entry);
    this.stream.publish(run.id.value, [
      {
        type: written.type,
        data: written.data,
        message: controlPlaneEntryText(entry),
        seq: written.seq,
        attempt: call.attempt,
        at: at.toISOString(),
      },
    ]);
  }
}
