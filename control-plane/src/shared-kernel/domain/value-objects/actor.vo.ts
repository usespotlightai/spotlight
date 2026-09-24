import type { Client } from '@shared-kernel/domain/value-objects/client.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class Actor {
  private constructor(
    readonly principal: Principal,
    readonly client: Client,
  ) {}

  static of(principal: Principal, client: Client): Actor {
    return new Actor(principal, client);
  }
}
