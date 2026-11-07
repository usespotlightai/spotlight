import { RunCancelled } from '@runs/domain/events/run-cancelled.event';
import { RunCompleted } from '@runs/domain/events/run-completed.event';
import { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import { RunLeaseExpired } from '@runs/domain/events/run-lease-expired.event';
import { RunPaused } from '@runs/domain/events/run-paused.event';
import { RunReservationDropped } from '@runs/domain/events/run-reservation-dropped.event';
import { RunSuspended } from '@runs/domain/events/run-suspended.event';
import { RunUsageRecorded } from '@runs/domain/events/run-usage-recorded.event';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { CallSecretsClaim } from '@runs/domain/value-objects/call-secrets-claim.vo';
import { CallingHost } from '@runs/domain/value-objects/calling-host.vo';
import { HandedOverFile as RunHandedOverFile } from '@runs/domain/value-objects/handed-over-file.vo';
import { Handover as RunHandover } from '@runs/domain/value-objects/handover.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { Harness } from '@runs/domain/value-objects/harness.vo';
import { HarnessCommand } from '@runs/domain/value-objects/harness-command.vo';
import { HarnessName } from '@runs/domain/value-objects/harness-name.vo';
import { HarnessSession as RunHarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { Money } from '@runs/domain/value-objects/money.vo';
import { NetworkCallId } from '@runs/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@runs/domain/value-objects/network-request.vo';
import { NetworkResponse } from '@runs/domain/value-objects/network-response.vo';
import { RequeueCount } from '@runs/domain/value-objects/requeue-count.vo';
import { RestoredArchive } from '@runs/domain/value-objects/restored-archive.vo';
import { Resume as RunResume } from '@runs/domain/value-objects/resume.vo';
import { RunApiGrant } from '@runs/domain/value-objects/run-api-grant.vo';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { RunConnection } from '@runs/domain/value-objects/run-connection.vo';
import { RunExtensions } from '@runs/domain/value-objects/run-extensions.vo';
import { RunFailure } from '@runs/domain/value-objects/run-failure.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { RunPolicy } from '@runs/domain/value-objects/run-policy.vo';
import { RunPriority as RunsPriority } from '@runs/domain/value-objects/run-priority.vo';
import {
  RequesterOwner,
  RunRequester,
} from '@runs/domain/value-objects/run-requester.vo';
import { RunSpec } from '@runs/domain/value-objects/run-spec.vo';
import { RunTags } from '@runs/domain/value-objects/run-tags.vo';
import { RunTurn } from '@runs/domain/value-objects/run-turn.vo';
import { RunUsage } from '@runs/domain/value-objects/run-usage.vo';
import { StartedCheckout } from '@runs/domain/value-objects/started-checkout.vo';
import { StartingPoint } from '@runs/domain/value-objects/starting-point.vo';
import { Tokens } from '@runs/domain/value-objects/tokens.vo';
import { ToolUse } from '@runs/domain/value-objects/tool-use.vo';
import { WorkspaceArchiveId } from '@runs/domain/value-objects/workspace-archive-id.vo';
import {
  RunWorkspace,
  WorkspaceKey,
} from '@runs/domain/value-objects/workspace-key.vo';

export const RUNS_PAYLOAD_TYPES = [
  RunHandedOverFile,
  RunHandover,
  RunHarnessSession,
  RunResume,
  RunsPriority,
  ArchiveDigest,
  ArchiveGrantee,
  ArchiveSize,
  CallSecretsClaim,
  CallingHost,
  RequeueCount,
  HandoverReport,
  Harness,
  HarnessCommand,
  HarnessName,
  Money,
  Tokens,
  ToolUse,
  RunUsage,
  NetworkResponse,
  NetworkCallId,
  NetworkRequest,
  RunAttempt,
  RunApiGrant,
  RunExtensions,
  RunTags,
  RunWorkspace,
  WorkspaceKey,
  RunConnection,
  RunOutcome,
  RunFailure,
  RunSpec,
  WorkspaceArchiveId,
  RestoredArchive,
  StartedCheckout,
  StartingPoint,
  RunExhausted,
  RunCancelled,
  RunPolicy,
  RunTurn,
  RequesterOwner,
  RunRequester,
  RunCompleted,
  RunUsageRecorded,
  RunLeaseExpired,
  RunSuspended,
  RunPaused,
  RunReservationDropped,
] as const;
