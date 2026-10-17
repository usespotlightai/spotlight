import type {
  RunnerEgressPort,
  SharedEgressFor,
} from '@runners/application/ports/runner-egress.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunHeldByRunner } from '@work/application/services/egress-redemptions.service';
import { RunAttempt } from '@work/domain/value-objects/run-attempt.vo';

export const NOW = new Date('2026-10-16T12:00:00.000Z');

export const SHARED_TOKEN = 'shared-token';

export const sharedEgress = (
  admitted: Record<string, SharedEgressFor>,
  recording: Record<string, SharedEgressFor> = admitted,
): RunnerEgressPort => ({
  admit: async () => null,
  sharedWith: async (token) =>
    token === SHARED_TOKEN ? { egressId: 'egress_1' } : null,
  admitThrough: async (egress, credential) =>
    egress.egressId === 'egress_1' ? (admitted[credential] ?? null) : null,
  recordsThrough: async (egress, credential) =>
    egress.egressId === 'egress_1' ? (recording[credential] ?? null) : null,
});

export const runOf = (
  credential: string,
  run: string,
  work: SharedEgressFor['work'] = { kind: 'run', id: run },
): [string, SharedEgressFor] => [
  credential,
  {
    egressId: 'egress_1',
    runnerId: `runner_${run}`,
    workspaceId: 'ws_1',
    work,
  },
];

export const holding = (
  held: readonly string[],
  worked: readonly string[] = held,
) => ({
  heldBy: async (runId: RunId): Promise<RunHeldByRunner | null> =>
    held.includes(runId.value)
      ? ({
          attempt: RunAttempt.of(RunId.of(runId.value), 1),
        } as RunHeldByRunner)
      : null,
  attemptWorkedBy: async (runId: RunId): Promise<RunAttempt | null> =>
    worked.includes(runId.value) ? RunAttempt.of(runId, 1) : null,
});
