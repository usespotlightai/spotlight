import {
  ConversationAudience,
  type ConversationViewer,
} from '@work/domain/services/conversation-audience';
import {
  type MessageAddress,
  MessageEffect,
  type MessagedTask,
  type MessageOutcome,
  TO_THE_TASK,
} from '@work/domain/services/message-effect';

export interface ViewerWaiting {
  readonly waitingForYou: boolean;
  readonly yourMessage: MessageOutcome;
}

export const TaskWaits = {
  forViewer(
    task: MessagedTask,
    viewer: ConversationViewer,
    to: MessageAddress = TO_THE_TASK,
  ): ViewerWaiting {
    return {
      waitingForYou:
        task.pending !== null &&
        ConversationAudience.waitsFor(
          task.pending.assignee,
          task.pending.ask,
          viewer,
        ),
      yourMessage: MessageEffect.outcome(task, to, viewer),
    };
  },
};
