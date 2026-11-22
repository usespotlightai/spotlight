import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export type RecordedDecisions =
  | {
      readonly outcome: 'recorded';
      /** The id each decision has in the task's decisions, in the order sent. */
      readonly ids: readonly string[];
    }
  | {
      readonly outcome: 'invalid';
      readonly problems: readonly ConfigurationProblem[];
    };
