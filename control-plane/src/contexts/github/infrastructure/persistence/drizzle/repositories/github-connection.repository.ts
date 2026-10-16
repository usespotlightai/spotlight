import { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import { GitHubConnectionVersionConflictError } from '@github/domain/exceptions/github-connection-version-conflict.error';
import { InstallationClaimedError } from '@github/domain/exceptions/installation-claimed.error';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { githubConnection } from '@github/infrastructure/persistence/drizzle/schemas/github-connection.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

const UNIQUE_VIOLATION = '23505';

const isClaimCollision = (error: unknown): boolean => {
  const raised = ((error as { cause?: unknown } | null)?.cause ?? error) as {
    code?: string;
    constraint?: string;
  } | null;

  return (
    raised?.code === UNIQUE_VIOLATION &&
    String(raised.constraint ?? '').includes('installation')
  );
};

@Injectable()
export class DrizzleGitHubConnections implements GitHubConnectionRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async of(workspaceId: WorkspaceId): Promise<GitHubConnection> {
    const [found] = await this.context.db
      .select()
      .from(githubConnection)
      .where(eq(githubConnection.workspaceId, workspaceId.value))
      .limit(1);

    return found
      ? GitHubConnection.rehydrate({
          workspaceId,
          installation: GitHubInstallation.of(found.installationId),
          version: found.version,
        })
      : GitHubConnection.none(workspaceId);
  }

  async claimantOf(
    installation: GitHubInstallation,
  ): Promise<WorkspaceId | null> {
    const [found] = await this.context.db
      .select({ workspaceId: githubConnection.workspaceId })
      .from(githubConnection)
      .where(eq(githubConnection.installationId, installation.value))
      .limit(1);

    return found ? WorkspaceId.of(found.workspaceId) : null;
  }

  async heldClaimantOf(
    installation: GitHubInstallation,
  ): Promise<WorkspaceId | null> {
    const [found] = await this.context.db
      .select({ workspaceId: githubConnection.workspaceId })
      .from(githubConnection)
      .where(eq(githubConnection.installationId, installation.value))
      .limit(1)
      .for('share');

    return found ? WorkspaceId.of(found.workspaceId) : null;
  }

  async save(connection: GitHubConnection): Promise<void> {
    await this.context.run(async () => {
      await this.stored(connection);
      await this.events.dispatch(connection.pullEvents());
    });
  }

  private async stored(connection: GitHubConnection): Promise<void> {
    if (connection.installation) {
      await this.written(connection, connection.installation);
      return;
    }

    const removed = await this.context.db
      .delete(githubConnection)
      .where(
        and(
          eq(githubConnection.workspaceId, connection.workspaceId.value),
          eq(githubConnection.version, connection.version),
        ),
      )
      .returning({ workspaceId: githubConnection.workspaceId });

    if (removed.length === 0 && connection.version > 0) {
      throw new GitHubConnectionVersionConflictError();
    }
  }

  private async written(
    connection: GitHubConnection,
    installation: GitHubInstallation,
  ): Promise<void> {
    const next = connection.version + 1;

    try {
      const written = await this.context.db
        .insert(githubConnection)
        .values({
          workspaceId: connection.workspaceId.value,
          installationId: installation.value,
          version: next,
        })
        .onConflictDoUpdate({
          target: githubConnection.workspaceId,
          set: { installationId: installation.value, version: next },
          setWhere: eq(githubConnection.version, connection.version),
        })
        .returning({ workspaceId: githubConnection.workspaceId });

      if (written.length === 0) {
        throw new GitHubConnectionVersionConflictError();
      }
    } catch (error) {
      if (isClaimCollision(error)) {
        throw new InstallationClaimedError(installation.value);
      }
      throw error;
    }
  }
}
