import type { RecordRunUsage } from '@runs/application/events/handlers/record-run-usage.handler';
import type { PauseMarks } from '@runs/application/services/pause-marks.service';
import type { ProvisionFailureMarks } from '@runs/application/services/provision-failure-marks.service';
import type { RunCredentials } from '@runs/application/services/run-credentials.service';
import type { RunnerLeases } from '@runs/application/services/runner-leases.service';
import type { SandboxLeases } from '@runs/application/services/sandbox-leases.service';
import type { RunCancelled } from '@runs/domain/events/run-cancelled.event';
import type { RunEnded } from '@runs/domain/events/run-ended.event';
import type { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import type { RunLeaseExpired } from '@runs/domain/events/run-lease-expired.event';
import type { RunPaused } from '@runs/domain/events/run-paused.event';
import type { RunProvisionFailed } from '@runs/domain/events/run-provision-failed.event';
import type { RunReservationDropped } from '@runs/domain/events/run-reservation-dropped.event';
import type { RunSuspended } from '@runs/domain/events/run-suspended.event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';

const ENDED = ['run.ended', 'run.exhausted', 'run.cancelled'];

const LEFT = ['run.lease-expired', 'run.suspended'];

type Ended = RunEnded | RunExhausted | RunCancelled;

type Left = RunLeaseExpired | RunSuspended;

export const runsSubscribers = (reactions: {
  credentials: RunCredentials;
  runners: RunnerLeases;
  sandboxes: SandboxLeases;
  pauseMarks: PauseMarks;
  provisionFailures: ProvisionFailureMarks;
  usages: RecordRunUsage;
}): readonly DomainEventSubscriber[] => [
  subscribing<Ended>('runs.end-secret-grants-of-ended-run', ENDED, (event) =>
    reactions.credentials.endGrantsOf(event),
  ),
  subscribing<Ended>(
    'runs.revoke-tokens-of-ended-run',
    ENDED,
    (event) => reactions.credentials.revokeTokensOf(event),
    { callsOut: true },
  ),
  subscribing<Left>('runs.lose-secret-lease-of-ended-attempt', LEFT, (event) =>
    reactions.credentials.loseGrantLeaseOf(event),
  ),
  subscribing<Left>(
    'runs.revoke-tokens-of-ended-attempt',
    LEFT,
    (event) => reactions.credentials.revokeAttemptTokensOf(event),
    { callsOut: true },
  ),
  subscribing<Ended>('runs.end-runner-of-ended-run', ENDED, (event) =>
    reactions.runners.runEnded(event.runId),
  ),
  subscribing<Ended>('runs.release-sandbox-of-ended-run', ENDED, (event) =>
    reactions.sandboxes.runEnded(event.runId),
  ),
  subscribing<Left>('runs.release-sandbox-of-left-run', LEFT, (event) =>
    reactions.sandboxes.runLeft(event.runId),
  ),
  subscribing<Left>('runs.release-runner-that-left-its-run', LEFT, (event) =>
    reactions.runners.runLeft(event.runner, event.at),
  ),
  subscribing<RunPaused>(
    'runs.journal-when-a-run-paused',
    ['run.paused'],
    (event) => reactions.pauseMarks.onRunPaused(event),
  ),
  subscribing<RunProvisionFailed>(
    'runs.journal-when-provisioning-failed',
    ['run.provision-failed'],
    (event) => reactions.provisionFailures.onProvisionFailed(event),
  ),
  subscribing<RunReservationDropped>(
    'runs.release-reserved-runner',
    ['run.reservation-dropped'],
    (event) => reactions.runners.reservationDropped(event.runner.value),
  ),
  subscribing<RunEnded>(
    'runs.record-run-usage.completed',
    ['run.ended'],
    (event) => reactions.usages.onRunEnded(event),
  ),
  subscribing<RunExhausted>(
    'runs.record-run-usage.exhausted',
    ['run.exhausted'],
    (event) => reactions.usages.onRunExhausted(event),
  ),
];
