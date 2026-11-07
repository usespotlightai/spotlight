import type { RunAttemptsPort } from '@integrations/application/ports/run-attempts.port';
import { RunAttemptRef } from '@integrations/domain/value-objects/run-attempt-ref.vo';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RunAttempts implements RunAttemptsPort {
  constructor(private readonly facts: RunFactsPort) {}

  async currentOf(runId: RunId): Promise<RunAttemptRef | null> {
    const [run] = await this.facts.of([runId]);

    return run && run.attempt >= 1
      ? RunAttemptRef.of(run.runId, run.attempt)
      : null;
  }
}
