import type { ConfigPullRequestDto } from '@replays/application/dto/config-pull-requests.dto';
import type {
  SearchObjectiveDto,
  SearchWarningDto,
} from '@replays/application/dto/searches.dto';
import type {
  Forbidden,
  ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

type Planned<T> = T | Forbidden;

export type SetOpened = Planned<{
  readonly outcome: 'opened';
  readonly id: string;
}>;

export type SetChanged = Planned<{ readonly outcome: 'changed' }>;

export type SetDeleted = Planned<{ readonly outcome: 'deleted' }>;

interface StartedSpend {
  readonly amount: number;
  readonly currency: string;
}

export type ReplayStarted = Planned<{
  readonly outcome: 'started';
  readonly id: string;
  readonly ceiling: StartedSpend;
  readonly baseline: {
    readonly id: string;
    readonly ceiling: StartedSpend;
    readonly status: 'started' | 'starting';
  } | null;
}>;

export type ReplayStoppedOutcome = Planned<{ readonly outcome: 'stopped' }>;

export interface SearchRefused {
  readonly outcome: 'invalid';
  readonly problems: readonly ConfigurationProblem[];
}

export type SearchStartedOutcome = Planned<
  | {
      readonly outcome: 'started';
      readonly id: string;
      readonly seedReplayId: string;
      readonly objective: SearchObjectiveDto;
      readonly warnings: readonly SearchWarningDto[];
    }
  | SearchRefused
>;

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
      readonly keptLive: readonly string[];
    };

export type CandidatePicked = Planned<{
  readonly outcome: 'picked' | 'already';
  readonly pullRequest: ConfigPullRequestDto;
}>;

export interface SearchCauseRecorded {
  readonly taskId: string;
  readonly cause: string;
  readonly replayRunId: string;
}
