import {
  type ChangeNoticeMapper,
  changedIn,
  noticing,
} from '@platform/live/change-notices';
import type { RunAskedAPerson } from '@runs/domain/events/run-asked-a-person.event';
import type { RunCancelled } from '@runs/domain/events/run-cancelled.event';
import type { RunClaimed } from '@runs/domain/events/run-claimed.event';
import type { RunEnded } from '@runs/domain/events/run-ended.event';
import type { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import type { RunLeaseExpired } from '@runs/domain/events/run-lease-expired.event';
import type { RunPaused } from '@runs/domain/events/run-paused.event';
import type { RunProvisionFailed } from '@runs/domain/events/run-provision-failed.event';
import type { RunRequeued } from '@runs/domain/events/run-requeued.event';
import type { RunReservationDropped } from '@runs/domain/events/run-reservation-dropped.event';
import type { RunReserved } from '@runs/domain/events/run-reserved.event';
import type { RunResumed } from '@runs/domain/events/run-resumed.event';
import type { RunStarted } from '@runs/domain/events/run-started.event';
import type { RunStartingPointRecorded } from '@runs/domain/events/run-starting-point-recorded.event';
import type { RunStopRequested } from '@runs/domain/events/run-stop-requested.event';
import type { RunSuspended } from '@runs/domain/events/run-suspended.event';
import type { RunUnclaimed } from '@runs/domain/events/run-unclaimed.event';
import type { RunUsageRecorded } from '@runs/domain/events/run-usage-recorded.event';

type RunEvent =
  | RunAskedAPerson
  | RunCancelled
  | RunClaimed
  | RunEnded
  | RunExhausted
  | RunLeaseExpired
  | RunPaused
  | RunProvisionFailed
  | RunRequeued
  | RunReservationDropped
  | RunReserved
  | RunResumed
  | RunStarted
  | RunStartingPointRecorded
  | RunStopRequested
  | RunSuspended
  | RunUnclaimed
  | RunUsageRecorded;

const RUN_KINDS = [
  'run.asked-a-person',
  'run.cancelled',
  'run.claimed',
  'run.ended',
  'run.exhausted',
  'run.lease-expired',
  'run.paused',
  'run.provision-failed',
  'run.requeued',
  'run.reservation-dropped',
  'run.reserved',
  'run.resumed',
  'run.started',
  'run.starting-point-recorded',
  'run.stop-requested',
  'run.suspended',
  'run.unclaimed',
  'run.usage-recorded',
];

export const RUNS_CHANGE_NOTICES: readonly ChangeNoticeMapper[] = [
  noticing<RunEvent>('runs.run-changed', RUN_KINDS, (event) =>
    changedIn(event.workspaceId.value, 'run', { runId: event.runId.value }),
  ),
];
