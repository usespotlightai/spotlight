import type { GitGatewayPort } from '@application/ports/git-gateway.port';
import type {
  GitAnswer,
  GitCall,
  RepositoryGitPort,
} from '@application/ports/repository-git.port';
import type { RunWorks } from '@application/services/run-works.service';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';

export class CarryGitCall implements GitGatewayPort {
  constructor(
    private readonly works: RunWorks,
    private readonly workspaces: WorkspaceConnections,
    private readonly git: RepositoryGitPort,
  ) {}

  async carry(
    runId: string,
    runnerId: string,
    repo: string,
    call: GitCall,
  ): Promise<GitAnswer | null> {
    const { work } = await this.works.heldBy(runId, runnerId);
    const repository = work ? await work.repositoryNamed(repo) : null;

    if (!work || !repository) {
      return null;
    }

    const installation = GitHubInstallation.from(
      await this.workspaces.connectionTo(
        work.workspaceId,
        GitHubInstallation.SOURCE,
      ),
    );

    return installation ? this.git.call(installation, repository, call) : null;
  }
}
