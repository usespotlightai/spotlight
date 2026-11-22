import type { ConversationViewer } from '@work/domain/services/conversation-audience';
import type { ReviewState } from '@work/domain/services/conversations';
import type {
  MessageAddress,
  MessagedTask,
} from '@work/domain/services/message-effect';
import {
  TaskWaits,
  type ViewerWaiting,
} from '@work/domain/services/task-waits';
import type { Progress } from '@work/domain/value-objects/progress';
import type { TaskRunState } from '@work/domain/value-objects/task-run-state';

export interface RunConversation {
  readonly waits: boolean;
  readonly task: MessagedTask;
  readonly to: MessageAddress;
}

export const runWaitsOnAPerson = (run: {
  readonly state: TaskRunState;
  readonly progress: Progress | null;
  readonly review: ReviewState | null;
  readonly holdsRun: boolean;
}): boolean =>
  (run.holdsRun && run.state === 'suspended' && run.progress === null) ||
  run.review === 'pending';

export const RunWaits = {
  forViewer(
    { waits, task, to }: RunConversation,
    viewer: ConversationViewer,
  ): ViewerWaiting {
    const onTask = TaskWaits.forViewer(task, viewer, to);

    return { ...onTask, waitingForYou: waits && onTask.waitingForYou };
  },
};
