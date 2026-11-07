import type { HookFailure } from '@integrations/domain/value-objects/hook-failure.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const LOOP_NOTICES = Symbol('LOOP_NOTICES');

export interface LoopNoticeReport {
  readonly taskId: TaskId;
  readonly stationKey: StationKey;
  readonly hook: string;
  readonly loop: HookFailure;
  readonly receivedAs: string;
}

export type LoopNotice =
  | {
      readonly kind: 'sent';
      readonly onTask: 'reported' | 'superseded' | 'gone';
    }
  | { readonly kind: 'failed'; readonly failure: HookFailure };

export interface LoopNoticesPort {
  send(report: LoopNoticeReport): Promise<LoopNotice>;
}
