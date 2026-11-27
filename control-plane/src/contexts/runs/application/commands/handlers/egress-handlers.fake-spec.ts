import type {
  RunnerEgressPort,
  SharedEgressAuthentication,
} from '@runners/application/ports/runner-egress.port';
import type {
  EgressSecretFetches,
  RunLeasedByRunner,
} from '@runs/application/services/egress-secret-fetches.service';
import { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const NOW = new Date('2026-10-16T12:00:00.000Z');

export const SHARED_TOKEN = 'shared-token';

export const sharedEgress = (
  authorized: Record<string, SharedEgressAuthentication>,
  recording: Record<string, SharedEgressAuthentication> = authorized,
): RunnerEgressPort => ({
  authenticate: () => Promise.resolve(null),
  sharedWith: (token) =>
    Promise.resolve(token === SHARED_TOKEN ? { egressId: 'egress_1' } : null),
  authorizeRunner: (egress, credential) =>
    Promise.resolve(
      egress.egressId === 'egress_1' ? (authorized[credential] ?? null) : null,
    ),
  runnerForConnectionRecords: (egress, credential) =>
    Promise.resolve(
      egress.egressId === 'egress_1' ? (recording[credential] ?? null) : null,
    ),
});

export const runOf = (
  credential: string,
  run: string,
  work: SharedEgressAuthentication['work'] = { kind: 'run', id: run },
): [string, SharedEgressAuthentication] => [
  credential,
  {
    egressId: 'egress_1',
    runnerId: `runner_${run}`,
    workspaceId: 'ws_1',
    work,
  },
];

export const leasing = (
  leased: readonly string[],
  claimed: readonly string[] = leased,
): Pick<EgressSecretFetches, 'leasedBy' | 'attemptClaimedBy'> => ({
  leasedBy: (runId: RunId): Promise<RunLeasedByRunner | null> =>
    Promise.resolve(
      leased.includes(runId.value)
        ? partial<RunLeasedByRunner>({
            attempt: RunAttempt.of(RunId.of(runId.value), 1),
          })
        : null,
    ),
  attemptClaimedBy: (runId: RunId): Promise<RunAttempt | null> =>
    Promise.resolve(
      claimed.includes(runId.value) ? RunAttempt.of(runId, 1) : null,
    ),
});
