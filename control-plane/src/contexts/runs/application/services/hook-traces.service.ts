import type {
  HookCallTrace,
  HookTracesPort,
} from '@runs/application/ports/hook-traces.port';
import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import type { RunStreamPort } from '@runs/application/ports/run-stream.port';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { HOOK_CALLED } from '@runs/domain/value-objects/journal-entry-type';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const hookCalled = (call: HookCallTrace): string =>
  `Hook ${call.hook} · ${call.step} → ${call.target}`;

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

    const entry = {
      type: HOOK_CALLED,
      message: hookCalled(call),
      data: Buffer.from(
        JSON.stringify({ ...call, startedAt: call.startedAt.toISOString() }),
        'utf8',
      ).toString('base64'),
    };
    const at = new Date(call.startedAt.getTime() + call.ms);

    const seq = await this.journal.appendControlPlaneEntry(attempt, {
      ...entry,
      at,
    });
    this.stream.publish(run.id.value, [
      { ...entry, seq, attempt: call.attempt, at: at.toISOString() },
    ]);
  }
}
