import type { ReplayFacts } from '@work/domain/services/replay-block';

export const REPLAY_FACTS = Symbol('REPLAY_FACTS');

export interface KnownRun extends ReplayFacts {
  readonly title: string | null;
  readonly state: string;
  readonly endedAt: Date | null;
  readonly origin: string | null;
}

export interface ReplayFactsPort {
  of(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, KnownRun>>;
}
