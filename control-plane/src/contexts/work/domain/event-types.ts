import { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { LineRepositoriesChanged } from '@work/domain/events/line-repositories-changed.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunStopRequested } from '@work/domain/events/run-stop-requested.event';
import { StationHarnessChanged } from '@work/domain/events/station-harness-changed.event';
import { StationRenamed } from '@work/domain/events/station-renamed.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import { TaskMarkTaken } from '@work/domain/events/task-mark-taken.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskProposed } from '@work/domain/events/task-proposed.event';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { Harness } from '@work/domain/value-objects/harness.vo';
import { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import { HarnessName } from '@work/domain/value-objects/harness-name.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { LinePlan } from '@work/domain/value-objects/line-plan.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { Money } from '@work/domain/value-objects/money.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { Remark } from '@work/domain/value-objects/remark.vo';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunPriority } from '@work/domain/value-objects/run-priority.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { Said } from '@work/domain/value-objects/said.vo';
import { Signing } from '@work/domain/value-objects/signing.vo';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationCheck } from '@work/domain/value-objects/station-check.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationDescription } from '@work/domain/value-objects/station-description.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Trail } from '@work/domain/value-objects/trail.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';

export const WORK_EVENT_TYPES = [
  AgentPrompt,
  AttachmentId,
  Attachment,
  Branch,
  ChatId,
  ChatMessageBody,
  ChatTitle,
  Concerns,
  Continuity,
  ContinuityKey,
  ConversationId,
  Declaration,
  DeclaredTool,
  Effort,
  HandoverOption,
  HandoverReport,
  Happening,
  Harness,
  HarnessCommand,
  HarnessName,
  HarnessSession,
  LineId,
  LineKey,
  LineName,
  LinePlan,
  LineRepositories,
  LineRole,
  Mark,
  MessagePosition,
  Money,
  NotePosition,
  ProposalOrigin,
  ProposalPlacement,
  Reaction,
  Remark,
  RunAttempt,
  RunOutcome,
  RunPriority,
  RunSpec,
  RunSubject,
  Said,
  Signing,
  SkillKey,
  StationCheck,
  StationColor,
  StationDescription,
  StationId,
  StationKey,
  StationName,
  TaskDescription,
  TaskNoteBody,
  TaskRank,
  TaskTitle,
  ToolInputs,
  Tool,
  Trail,
  Voice,
  WayOut,
  ChatHandedToRun,
  ChatStarted,
  LineRepositoriesChanged,
  ProposalAccepted,
  ProposalDismissed,
  PullRequestOpened,
  RunAbandoned,
  RunCompleted,
  RunStopRequested,
  StationHarnessChanged,
  StationRenamed,
  TaskAsked,
  TaskDeleted,
  TaskFinished,
  TaskHandedToRun,
  TaskLetGoOfRun,
  TaskMarkTaken,
  TaskOpened,
  TaskProposed,
] as const;
