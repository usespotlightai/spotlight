import { RunAskedAPerson } from '@runs/domain/events/run-asked-a-person.event';
import { RunCancelled } from '@runs/domain/events/run-cancelled.event';
import { RunClaimed } from '@runs/domain/events/run-claimed.event';
import { RunEnded } from '@runs/domain/events/run-ended.event';
import { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import { RunLeaseExpired } from '@runs/domain/events/run-lease-expired.event';
import { RunPaused } from '@runs/domain/events/run-paused.event';
import { RunProvisionFailed } from '@runs/domain/events/run-provision-failed.event';
import { RunRequeued } from '@runs/domain/events/run-requeued.event';
import { RunReservationDropped } from '@runs/domain/events/run-reservation-dropped.event';
import { RunReserved } from '@runs/domain/events/run-reserved.event';
import { RunResumed } from '@runs/domain/events/run-resumed.event';
import { RunStarted } from '@runs/domain/events/run-started.event';
import { RunStartingPointRecorded } from '@runs/domain/events/run-starting-point-recorded.event';
import { RunStopRequested } from '@runs/domain/events/run-stop-requested.event';
import { RunSuspended } from '@runs/domain/events/run-suspended.event';
import { RunUnclaimed } from '@runs/domain/events/run-unclaimed.event';
import { RunUsageRecorded } from '@runs/domain/events/run-usage-recorded.event';
import { ArchiveDigest } from '@runs/domain/value-objects/archive-digest.vo';
import { ArchiveGrantee } from '@runs/domain/value-objects/archive-grantee.vo';
import { ArchiveSize } from '@runs/domain/value-objects/archive-size.vo';
import { CallSecretsClaim } from '@runs/domain/value-objects/call-secrets-claim.vo';
import { CallingHost } from '@runs/domain/value-objects/calling-host.vo';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { HandedOverFile as RunHandedOverFile } from '@runs/domain/value-objects/handed-over-file.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { Handover as RunHandover } from '@runs/domain/value-objects/handover.vo';
import { HarnessCommand } from '@runs/domain/value-objects/harness-command.vo';
import { HarnessSession as RunHarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { Money } from '@runs/domain/value-objects/money.vo';
import { NetworkCallId } from '@runs/domain/value-objects/network-call-id.vo';
import { NetworkRequest } from '@runs/domain/value-objects/network-request.vo';
import { NetworkResponse } from '@runs/domain/value-objects/network-response.vo';
import { RequeueCount } from '@runs/domain/value-objects/requeue-count.vo';
import { RestoredArchive } from '@runs/domain/value-objects/restored-archive.vo';
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
import { WorkingCopyArchiveId } from '@runs/domain/value-objects/working-copy-archive-id.vo';
import {
  RunWorkingCopy,
  WorkingCopyKey,
} from '@runs/domain/value-objects/working-copy-key.vo';

export const RUNS_PAYLOAD_TYPES = [
  RunHandedOverFile,
  RunHandover,
  RunHarnessSession,
  RunsPriority,
  ArchiveDigest,
  ArchiveGrantee,
  ArchiveSize,
  CallSecretsClaim,
  CallingHost,
  RequeueCount,
  HandoverReport,
  HarnessCommand,
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
  RunWorkingCopy,
  WorkingCopyKey,
  RunConnection,
  RunOutcome,
  ExitCode,
  RunFailure,
  RunSpec,
  WorkingCopyArchiveId,
  RestoredArchive,
  StartedCheckout,
  StartingPoint,
  RunExhausted,
  RunCancelled,
  RunPolicy,
  RunTurn,
  RequesterOwner,
  RunRequester,
  RunEnded,
  RunUsageRecorded,
  RunLeaseExpired,
  RunSuspended,
  RunPaused,
  RunProvisionFailed,
  RunReservationDropped,
  RunClaimed,
  RunReserved,
  RunRequeued,
  RunUnclaimed,
  RunStarted,
  RunStartingPointRecorded,
  RunAskedAPerson,
  RunStopRequested,
  RunResumed,
] as const;
