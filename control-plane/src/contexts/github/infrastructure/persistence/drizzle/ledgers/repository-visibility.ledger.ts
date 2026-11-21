import type {
  RepositoryVisibilityStorePort,
  StoredVisibility,
} from '@github/application/ports/repository-visibility-store.port';
import type { RepositoryVisibility } from '@github/domain/value-objects/repository-visibility.vo';
import { repositoryVisibility } from '@github/infrastructure/persistence/drizzle/schemas/repository-visibility.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { and, eq, or, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleRepositoryVisibilityLedger implements RepositoryVisibilityStorePort {
  constructor(private readonly context: DrizzleContext) {}

  async find(
    repositories: readonly Repository[],
  ): Promise<ReadonlyMap<string, StoredVisibility>> {
    const rows = await this.context.db
      .select()
      .from(repositoryVisibility)
      .where(
        or(
          ...repositories.map((each) =>
            and(
              eq(repositoryVisibility.owner, each.owner.toLowerCase()),
              eq(repositoryVisibility.name, each.name.toLowerCase()),
            ),
          ),
        ),
      );

    return new Map(
      rows.map((row) => [
        `${row.owner}/${row.name}`,
        { visibility: row.visibility, checkedAt: row.checkedAt },
      ]),
    );
  }

  async save(
    repository: Repository,
    visibility: RepositoryVisibility,
    checkedAt: Date,
  ): Promise<void> {
    await this.context.db
      .insert(repositoryVisibility)
      .values({
        owner: repository.owner.toLowerCase(),
        name: repository.name.toLowerCase(),
        visibility,
        checkedAt,
      })
      .onConflictDoUpdate({
        target: [repositoryVisibility.owner, repositoryVisibility.name],
        set: { visibility, checkedAt },
        setWhere: sql`${repositoryVisibility.checkedAt} <= excluded.checked_at`,
      });
  }
}
