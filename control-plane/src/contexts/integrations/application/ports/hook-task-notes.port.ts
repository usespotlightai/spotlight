import type { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const HOOK_TASK_NOTES = Symbol('HOOK_TASK_NOTES');

export interface LoopNoticeReport {
  readonly taskId: TaskId;
  readonly stationKey: StationKey;
  readonly hook: HookKey;
  readonly loop: HookFailure;
  readonly receivedAs: string;
}

export type LoopNotice =
  | {
      readonly kind: 'sent';
      readonly onTask: 'reported' | 'superseded' | 'gone';
    }
  | { readonly kind: 'failed'; readonly failure: HookFailure };

export interface HookTaskNotesPort {
  loopNotice(report: LoopNoticeReport): Promise<LoopNotice>;

  movedOn(taskId: TaskId, stationKey: StationKey): Promise<boolean>;
}
