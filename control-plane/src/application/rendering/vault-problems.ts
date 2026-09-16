import { SECRETS_VAULT } from '@application/contracts/configuration-layout.contract';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';

export interface VaultRefusal {
  readonly because:
    | 'unkeyed'
    | 'unreadable-key'
    | 'not-for-this-key'
    | 'unreadable';
  readonly detail?: string;
}

export const VaultProblems = {
  reason(refusal: VaultRefusal): string {
    switch (refusal.because) {
      case 'unkeyed':
        return `has a secrets vault encrypted with a key Spotlight does not hold: decrypt it with the key you kept and add the secrets again, or remove ${SECRETS_VAULT}`;
      case 'unreadable-key':
        return 'has a vault key this deployment cannot open: SPOTLIGHT_SECRETS_KEY is not the key it was sealed with';
      case 'not-for-this-key':
        return 'has a secrets vault that does not open with the vault key';
      case 'unreadable':
        return `has a secrets vault that could not be read: ${refusal.detail ?? 'it is not a vault'}`;
    }
  },

  problem(refusal: VaultRefusal): ConfigurationProblem {
    return ConfigurationProblem.of({
      path: SECRETS_VAULT,
      at: 'the file',
      reason: VaultProblems.reason(refusal),
    });
  },
};
