import type { ReplayFacts } from '@work/domain/services/replay-standing';

export const REPLAY_FACTS = Symbol('REPLAY_FACTS');

export interface KnownRun extends ReplayFacts {
  readonly title: string | null;
  readonly state: string;
  readonly endedAt: Date | null;
}

export interface ReplayFactsPort {
  of(
    workspaceId: string,
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, KnownRun>>;
}
