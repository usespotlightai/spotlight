import type {
  RunnerEgressPort,
  SharedEgressAuthentication,
} from '@runners/application/ports/runner-egress.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunLeasedByRunner } from '@work/application/services/egress-secret-fetches.service';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';

export const NOW = new Date('2026-10-16T12:00:00.000Z');

export const SHARED_TOKEN = 'shared-token';

export const sharedEgress = (
  authorized: Record<string, SharedEgressAuthentication>,
  recording: Record<string, SharedEgressAuthentication> = authorized,
): RunnerEgressPort => ({
  authenticate: async () => null,
  sharedWith: async (token) =>
    token === SHARED_TOKEN ? { egressId: 'egress_1' } : null,
  authorizeRunner: async (egress, credential) =>
    egress.egressId === 'egress_1' ? (authorized[credential] ?? null) : null,
  runnerForConnectionRecords: async (egress, credential) =>
    egress.egressId === 'egress_1' ? (recording[credential] ?? null) : null,
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
) => ({
  leasedBy: async (runId: RunId): Promise<RunLeasedByRunner | null> =>
    leased.includes(runId.value)
      ? ({
          attempt: RunAttempt.of(RunId.of(runId.value), 1),
        } as RunLeasedByRunner)
      : null,
  attemptClaimedBy: async (runId: RunId): Promise<RunAttempt | null> =>
    claimed.includes(runId.value) ? RunAttempt.of(runId, 1) : null,
});
