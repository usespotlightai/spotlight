import type { Client } from '@shared-kernel/domain/value-objects/client.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import type { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';

export class Actor {
  private constructor(
    readonly principal: Principal,
    readonly client: Client,
    readonly commit: SourceCommit | null,
  ) {}

  static of(
    principal: Principal,
    client: Client,
    commit: SourceCommit | null = null,
  ): Actor {
    return new Actor(principal, client, commit);
  }
}
