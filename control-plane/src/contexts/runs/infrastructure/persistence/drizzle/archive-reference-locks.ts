import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { ArchiveReferenceLocksPort } from '@runs/application/ports/archive-reference-locks.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { sql } from 'drizzle-orm';

const keyOf = (workspaceId: WorkspaceId) =>
  sql`hashtextextended(${`workspace-archive-references:${workspaceId.value}`}, 0)`;

@Injectable()
export class DrizzleArchiveReferenceLocks implements ArchiveReferenceLocksPort {
  constructor(private readonly context: DrizzleContext) {}

  referencing<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T> {
    return this.context.inTransaction(async () => {
      await this.context.db.execute(
        sql`select pg_advisory_xact_lock_shared(${keyOf(workspaceId)})`,
      );

      return work();
    });
  }

  removing<T>(workspaceId: WorkspaceId, work: () => Promise<T>): Promise<T> {
    return this.context.inTransaction(async () => {
      await this.context.db.execute(
        sql`select pg_advisory_xact_lock(${keyOf(workspaceId)})`,
      );

      return work();
    });
  }
}
