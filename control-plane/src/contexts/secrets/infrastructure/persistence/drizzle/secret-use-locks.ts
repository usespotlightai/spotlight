import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { SecretUseLocksPort } from '@secrets/application/ports/secret-use-locks.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { sql } from 'drizzle-orm';

@Injectable()
export class DrizzleSecretUseLocks implements SecretUseLocksPort {
  constructor(private readonly context: DrizzleContext) {}

  async lock(workspaceId: WorkspaceId): Promise<void> {
    if (!this.context.transacting) {
      throw new Error('A lock on the uses of secrets needs a transaction');
    }

    await this.context.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`secret-uses:${workspaceId.value}`}, 0))`,
    );
  }
}
