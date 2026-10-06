import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';

export class Webhook {
  private constructor(readonly declares: readonly DeclaredHappening[]) {}

  static of(input: { declares: readonly DeclaredHappening[] }): Webhook {
    if (input.declares.length === 0) {
      throw new InvalidIntegrationPartError('webhook', 'raises no events');
    }

    return new Webhook(input.declares);
  }
}
