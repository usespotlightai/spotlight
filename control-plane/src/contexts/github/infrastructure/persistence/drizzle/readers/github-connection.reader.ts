import type { GitHubConnectionReaderPort } from '@github/application/ports/github-connection-reader.port';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { githubConnection } from '@github/infrastructure/persistence/drizzle/schemas/github-connection.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { eq } from 'drizzle-orm';

@Injectable()
export class DrizzleGitHubConnectionReader
  implements GitHubConnectionReaderPort
{
  constructor(private readonly context: DrizzleContext) {}

  async installationOf(
    workspaceId: WorkspaceId,
  ): Promise<GitHubInstallation | null> {
    const [found] = await this.context.db
      .select({ installationId: githubConnection.installationId })
      .from(githubConnection)
      .where(eq(githubConnection.workspaceId, workspaceId.value))
      .limit(1);

    return found ? GitHubInstallation.of(found.installationId) : null;
  }
}
