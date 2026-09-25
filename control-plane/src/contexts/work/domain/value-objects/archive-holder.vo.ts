import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export type ArchiveHolder =
  | {
      readonly kind: 'task';
      readonly taskId: TaskId;
      readonly stationId: StationId;
    }
  | { readonly kind: 'chat'; readonly chatId: ChatId };

export interface HolderState {
  readonly stationId: StationId | null;
  readonly conversing: boolean;
  readonly finished: boolean;
  readonly changedAt: Date;
}
