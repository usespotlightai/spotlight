import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';

export const BRIEFED_TASKS = Symbol('BRIEFED_TASKS');

export interface BriefedTasksPort {
  of(runId: RunId): Promise<BriefedTask | null>;
}
