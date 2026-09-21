import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const CHECK_ACCESS = Symbol('CHECK_ACCESS');

export interface CheckAccessPort {
  holdsCheckOfRun(runId: RunId, runner: RunnerId, now: Date): Promise<boolean>;
}
