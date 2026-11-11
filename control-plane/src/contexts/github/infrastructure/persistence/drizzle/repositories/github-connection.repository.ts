import { GitHubConnection } from '@github/domain/aggregates/github-connection.aggregate';
import { GitHubConnectionVersionConflictError } from '@github/domain/exceptions/github-connection-version-conflict.error';
import { InstallationAlreadyConnectedError } from '@github/domain/exceptions/installation-already-connected.error';
import type { GitHubConnectionRepository } from '@github/domain/repositories/github-connection.repository';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { githubConnection } from '@github/infrastructure/persistence/drizzle/schemas/github-connection.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

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

  async connectedWorkspaceOf(
    installation: GitHubInstallation,
  ): Promise<WorkspaceId | null> {
    const [found] = await this.context.db
      .select({ workspaceId: githubConnection.workspaceId })
      .from(githubConnection)
      .where(eq(githubConnection.installationId, installation.value))
      .limit(1);

    return found ? WorkspaceId.of(found.workspaceId) : null;
  }

  async lockedConnectedWorkspaceOf(
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
    await this.context.inTransaction(async () => {
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

    if (removed.length === 0 && connection.isStored) {
      throw new GitHubConnectionVersionConflictError();
    }
  }

  private async written(
    connection: GitHubConnection,
    installation: GitHubInstallation,
  ): Promise<void> {
    try {
      const written = connection.isStored
        ? await this.context.db
            .update(githubConnection)
            .set({
              installationId: installation.value,
              version: connection.version + 1,
            })
            .where(
              and(
                eq(githubConnection.workspaceId, connection.workspaceId.value),
                eq(githubConnection.version, connection.version),
              ),
            )
            .returning({ workspaceId: githubConnection.workspaceId })
        : await this.context.db
            .insert(githubConnection)
            .values({
              workspaceId: connection.workspaceId.value,
              installationId: installation.value,
              version: connection.version,
            })
            .onConflictDoNothing({ target: githubConnection.workspaceId })
            .returning({ workspaceId: githubConnection.workspaceId });

      if (written.length === 0) {
        throw new GitHubConnectionVersionConflictError();
      }
    } catch (error) {
      if (violates(error, UNIQUE_VIOLATION, 'installation')) {
        throw new InstallationAlreadyConnectedError(installation.value);
      }
      throw error;
    }
  }
}
