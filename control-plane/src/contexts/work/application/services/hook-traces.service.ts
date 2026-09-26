import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { HOOK_CALLED } from '@work/application/contracts/run-journal.contract';
import type {
  HookCallTrace,
  HookTracesPort,
} from '@work/application/ports/hook-traces.port';
import type { RunJournalPort } from '@work/application/ports/run-journal.port';
import type { RunStreamPort } from '@work/application/ports/run-stream.port';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';

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

    if (!run) {
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

    const seq = await this.journal.appendAside(
      RunAttempt.of(run.id, run.attempt),
      { ...entry, at },
    );
    this.stream.publish(run.id.value, [
      { ...entry, seq, attempt: run.attempt, at: at.toISOString() },
    ]);
  }
}
