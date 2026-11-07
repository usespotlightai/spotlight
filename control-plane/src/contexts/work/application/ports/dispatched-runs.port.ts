import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { BriefedMemoriesParts } from '@work/domain/value-objects/briefed-memories.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export const DISPATCHED_RUNS = Symbol('DISPATCHED_RUNS');

export type DispatchedFor =
  | {
      readonly kind: 'task';
      readonly taskId: TaskId;
      readonly stationId: StationId;
    }
  | { readonly kind: 'chat'; readonly chatId: ChatId }
  | {
      readonly kind: 'trial';
      readonly stationId: StationId;
      readonly asOf: Date | null;
      readonly repositories: readonly Repository[];
    };

export interface DispatchedRun {
  readonly runId: RunId;
  readonly for: DispatchedFor;
  readonly briefedMemories: BriefedMemoriesParts;
}

export interface DispatchedRunsPort {
  of(runId: RunId): Promise<DispatchedRun | null>;
}
