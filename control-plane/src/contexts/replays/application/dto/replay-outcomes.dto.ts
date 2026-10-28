import type {
  Forbidden,
  ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

type Planned<T> = T | Forbidden;

export type SetChanged = Planned<{ readonly outcome: 'changed' }>;

interface StartedMoney {
  readonly amount: number;
  readonly currency: string;
}

export type ReplayStarted = Planned<{
  readonly outcome: 'started';
  readonly id: string;
  readonly ceiling: StartedMoney;
  readonly baseline: {
    readonly id: string;
    readonly ceiling: StartedMoney;
    readonly status: 'started' | 'starting';
  } | null;
}>;

export type ReplayStoppedOutcome = Planned<{ readonly outcome: 'stopped' }>;

export type SearchStoppedOutcome = Planned<{ readonly outcome: 'stopped' }>;

export type SearchCandidateProposed =
  | {
      readonly outcome: 'proposed';
      readonly candidateId: string;
      readonly name: string;
      readonly replayId: string;
    }
  | {
      readonly outcome: 'invalid';
      readonly problems: readonly ConfigurationProblem[];
    };

export type ReplayCheckStartedOutcome =
  | ResourceCreated
  | { readonly outcome: 'reused'; readonly id: string }
  | {
      readonly outcome: 'unchanged';
      readonly scoringPinnedToLive: readonly string[];
    };

export interface FailureCauseRecorded {
  readonly taskId: string;
  readonly cause: string;
  readonly replayRunId: string;
}
