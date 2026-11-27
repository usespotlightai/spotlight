import type {
  ConnectedInstallation,
  GitHubConnectionReaderPort,
} from '@github/application/ports/github-connection-reader.port';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { githubConnection } from '@github/infrastructure/persistence/drizzle/schemas/github-connection.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { firstOf } from '@shared-kernel/domain/item-at';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleGitHubConnectionReader implements GitHubConnectionReaderPort {
  constructor(private readonly context: DrizzleContext) {}

  async installationOf(
    workspaceId: WorkspaceId,
  ): Promise<GitHubInstallation | null> {
    const found = firstOf(
      await this.context.db
        .select({ installationId: githubConnection.installationId })
        .from(githubConnection)
        .where(eq(githubConnection.workspaceId, workspaceId.value))
        .limit(1),
    );

    return found ? GitHubInstallation.of(found.installationId) : null;
  }

  async connectionsOf(
    installations: readonly GitHubInstallation[],
  ): Promise<readonly ConnectedInstallation[]> {
    if (installations.length === 0) {
      return [];
    }

    const found = await this.context.db
      .select({
        installationId: githubConnection.installationId,
        workspaceId: githubConnection.workspaceId,
      })
      .from(githubConnection)
      .where(
        inArray(
          githubConnection.installationId,
          installations.map((each) => each.value),
        ),
      );

    return found.map((each) => ({
      installation: GitHubInstallation.of(each.installationId),
      workspaceId: WorkspaceId.of(each.workspaceId),
    }));
  }
}
