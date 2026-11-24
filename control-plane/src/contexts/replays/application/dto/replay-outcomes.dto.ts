import type { ResourceCreated } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

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

export interface ChangedDependency {
  readonly kind:
    | 'secret'
    | 'skill'
    | 'harness-profile'
    | 'integration'
    | 'hook';
  readonly key: string;
}

export type ReplayCheckStartedOutcome =
  | ResourceCreated
  | { readonly outcome: 'reused'; readonly id: string }
  | {
      readonly outcome: 'unchanged';
      readonly scoringPinnedToLive: readonly string[];
    }
  | {
      readonly outcome: 'dependency-changed';
      readonly changed: readonly ChangedDependency[];
    }
  | NoRunsToReplay;

export interface NoRunsToReplay {
  readonly outcome: 'no-runs-to-replay';
  readonly stationKey: string;
  readonly set: 'none' | 'empty';
}

export interface FailureCauseRecorded {
  readonly taskId: string;
  readonly cause: string;
  readonly replayRunId: string;
}
