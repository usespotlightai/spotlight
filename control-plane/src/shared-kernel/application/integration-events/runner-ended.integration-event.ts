export const RUNNER_ENDED = 'runners.runner-ended.v1';

type RunnerWorkPublished = {
  readonly kind: 'run' | 'check' | 'diff';
  readonly id: string;
};

// One runner from start to end. A runner that Spotlight released before it claimed work has no work and no claim time. Platform: the runner came in through the platform pool that Spotlight adds to each workspace. EndedAt: when the runner ended, or, for a runner that stopped sending heartbeats or never claimed in time, when Spotlight last heard from it.
export type RunnerEndedIntegrationEvent = {
  readonly kind: typeof RUNNER_ENDED;
  readonly runnerId: string;
  readonly workspaceId: string;
  readonly poolId: string | null;
  readonly trustId: string | null;
  readonly platform: boolean;
  readonly work: RunnerWorkPublished | null;
  readonly startedAt: string;
  readonly claimedAt: string | null;
  readonly endedAt: string;
  // finished: its work ended while it still sent heartbeats. lost: it stopped sending heartbeats before its work ended. released: Spotlight let it go before it claimed work.
  readonly ending: 'finished' | 'lost' | 'released';
};
