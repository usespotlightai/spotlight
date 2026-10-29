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
