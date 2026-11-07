import type { HookRunAttempt } from '@integrations/domain/value-objects/hook-run-attempt.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const RUN_ATTEMPTS = Symbol('RUN_ATTEMPTS');

export interface RunAttemptsPort {
  currentOf(runId: RunId): Promise<HookRunAttempt | null>;
}
