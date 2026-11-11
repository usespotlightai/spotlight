import {
  type ChangeNoticeMapper,
  changedFor,
  changedIn,
  noticing,
} from '@platform/live/change-notices';
import type { ChatCiSetUp } from '@work/domain/events/chat-ci-set-up.event';
import type { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import type { ChatMessageSent } from '@work/domain/events/chat-message-sent.event';
import type { ChatMessagesAcknowledged } from '@work/domain/events/chat-messages-acknowledged.event';
import type { ChatRunAssigned } from '@work/domain/events/chat-run-assigned.event';
import type { ChatRunEnded } from '@work/domain/events/chat-run-ended.event';
import type { ChatRunNotStarted } from '@work/domain/events/chat-run-not-started.event';
import type { ChatStarted } from '@work/domain/events/chat-started.event';
import type { DispatchBriefed } from '@work/domain/events/dispatch-briefed.event';
import type { DispatchEnded } from '@work/domain/events/dispatch-ended.event';
import type { DispatchOrdered } from '@work/domain/events/dispatch-ordered.event';
import type { DispatchRefused } from '@work/domain/events/dispatch-refused.event';
import type { DispatchSuperseded } from '@work/domain/events/dispatch-superseded.event';
import type { InboxRequestMarkedRead } from '@work/domain/events/inbox-request-marked-read.event';
import type { InboxRequestOpened } from '@work/domain/events/inbox-request-opened.event';
import type { InboxRequestResolved } from '@work/domain/events/inbox-request-resolved.event';
import type { NoticeRaised } from '@work/domain/events/notice-raised.event';
import type { NoticeResolved } from '@work/domain/events/notice-resolved.event';
import type { ProposalAcceptanceFailed } from '@work/domain/events/proposal-acceptance-failed.event';
import type { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import type { ProposalBecameTask } from '@work/domain/events/proposal-became-task.event';
import type { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import type { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import type { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import type { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import type { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import type { TaskAnswered } from '@work/domain/events/task-answered.event';
import type { TaskApprovalClaimed } from '@work/domain/events/task-approval-claimed.event';
import type { TaskApprovalReturned } from '@work/domain/events/task-approval-returned.event';
import type { TaskAsked } from '@work/domain/events/task-asked.event';
import type { TaskAssigned } from '@work/domain/events/task-assigned.event';
import type { TaskConversationRead } from '@work/domain/events/task-conversation-read.event';
import type { TaskConversationReopened } from '@work/domain/events/task-conversation-reopened.event';
import type { TaskDeleted } from '@work/domain/events/task-deleted.event';
import type { TaskDraftSent } from '@work/domain/events/task-draft-sent.event';
import type { TaskFailed } from '@work/domain/events/task-failed.event';
import type { TaskFinished } from '@work/domain/events/task-finished.event';
import type { TaskMarkReleased } from '@work/domain/events/task-mark-released.event';
import type { TaskMarked } from '@work/domain/events/task-marked.event';
import type { TaskMoved } from '@work/domain/events/task-moved.event';
import type { TaskNoted } from '@work/domain/events/task-noted.event';
import type { TaskNotesAcknowledged } from '@work/domain/events/task-notes-acknowledged.event';
import type { TaskOpened } from '@work/domain/events/task-opened.event';
import type { TaskPassed } from '@work/domain/events/task-passed.event';
import type { TaskProposed } from '@work/domain/events/task-proposed.event';
import type { TaskPullRequestClosed } from '@work/domain/events/task-pull-request-closed.event';
import type { TaskPullRequestReopened } from '@work/domain/events/task-pull-request-reopened.event';
import type { TaskReordered } from '@work/domain/events/task-reordered.event';
import type { TaskRunAssigned } from '@work/domain/events/task-run-assigned.event';
import type { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import type { TaskRunEnded } from '@work/domain/events/task-run-ended.event';
import type { TaskSessionKept } from '@work/domain/events/task-session-kept.event';
import type { TaskTurnAwaited } from '@work/domain/events/task-turn-awaited.event';

type ChatEvent =
  | ChatCiSetUp
  | ChatDeleted
  | ChatMessagesAcknowledged
  | ProposalAcceptanceFailed
  | ProposalBecameTask
  | ProposalDismissed
  | ChatRunAssigned
  | ChatRunEnded
  | ChatRunNotStarted
  | SetupPullRequestOpened
  | ChatStarted
  | TaskProposed;

type TaskEvent =
  | InboxRequestResolved
  | InboxRequestMarkedRead
  | TaskNoted
  | TaskReordered
  | TaskPullRequestClosed
  | TaskPullRequestReopened
  | TaskConversationRead
  | TaskNotesAcknowledged
  | TaskRunEnded
  | TaskSessionKept
  | TaskDraftSent
  | TaskMarkReleased
  | TaskApprovalReturned
  | TaskApprovalClaimed
  | TaskTurnAwaited
  | InboxRequestOpened
  | TaskActedOn
  | TaskAnswered
  | TaskAsked
  | TaskAssigned
  | TaskConversationReopened
  | TaskDeleted
  | TaskFailed
  | TaskFinished
  | TaskMarked
  | TaskMoved
  | TaskOpened
  | TaskPassed
  | PullRequestOpened
  | PullRequestReviewTaken
  | TaskRunAssigned
  | TaskRunDetached;

type DispatchEvent =
  | DispatchBriefed
  | DispatchEnded
  | DispatchOrdered
  | DispatchRefused
  | DispatchSuperseded;

type InboxEvent = NoticeRaised | NoticeResolved;

const CHAT_KINDS = [
  'chat.ci-set-up',
  'chat.deleted',
  'chat.messages-acknowledged',
  'chat.proposal-acceptance-failed',
  'chat.proposal-became-task',
  'chat.proposal-dismissed',
  'chat.run-assigned',
  'chat.run-ended',
  'chat.run-not-started',
  'chat.setup-pull-request-opened',
  'chat.started',
  'chat.task-proposed',
];

const TASK_KINDS = [
  'inbox-request.resolved',
  'inbox-request.marked-read',
  'task.noted',
  'task.reordered',
  'task.pull-request-closed',
  'task.pull-request-reopened',
  'task.conversation-read',
  'task.notes-acknowledged',
  'task.run-ended',
  'task.session-kept',
  'task.draft-sent',
  'task.mark-released',
  'task.approval-returned',
  'task.approval-claimed',
  'task.turn-awaited',
  'inbox-request.opened',
  'task.acted-on',
  'task.answered',
  'task.asked',
  'task.assigned',
  'task.conversation-reopened',
  'task.deleted',
  'task.failed',
  'task.finished',
  'task.marked',
  'task.moved',
  'task.opened',
  'task.passed',
  'task.pull-request-opened',
  'task.pull-request-review-taken',
  'task.run-assigned',
  'task.run-detached',
];

const DISPATCH_KINDS = [
  'dispatch.briefed',
  'dispatch.ended',
  'dispatch.ordered',
  'dispatch.refused',
  'dispatch.superseded',
];

const INBOX_KINDS = ['notice.resolved', 'notice.raised'];

export const WORK_CHANGE_NOTICES: readonly ChangeNoticeMapper[] = [
  noticing<ChatEvent>('work.chat-changed', CHAT_KINDS, (event) =>
    changedFor(event.startedBy.value, 'chat', { chatId: event.chatId.value }),
  ),
  noticing<ChatMessageSent>(
    'work.chat-message-sent',
    ['chat.message-sent'],
    (event) =>
      changedFor(event.by.value, 'chat', { chatId: event.chatId.value }),
  ),
  noticing<ProposalAccepted>(
    'work.chat-proposal-accepted',
    ['chat.proposal-accepted'],
    (event) =>
      changedFor(event.acceptedBy.value, 'chat', {
        chatId: event.chatId.value,
      }),
  ),
  noticing<TaskEvent>('work.task-changed', TASK_KINDS, (event) =>
    changedIn(event.workspaceId.value, 'task', { taskId: event.taskId.value }),
  ),
  noticing<DispatchEvent>('work.dispatch-changed', DISPATCH_KINDS, (event) =>
    changedIn(event.workspaceId.value, 'run', { runId: event.runId.value }),
  ),
  noticing<InboxEvent>('work.inbox-changed', INBOX_KINDS, (event) =>
    changedIn(event.workspaceId.value, 'inbox', {}),
  ),
];
