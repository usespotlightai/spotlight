import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export type AssistResultSubmitted =
  | { readonly outcome: 'accepted' }
  | {
      readonly outcome: 'invalid';
      readonly problems: readonly ConfigurationProblem[];
    }
  | { readonly outcome: 'not-leased' }
  | { readonly outcome: 'not-an-assist-run' }
  | { readonly outcome: 'not-accepted' };
