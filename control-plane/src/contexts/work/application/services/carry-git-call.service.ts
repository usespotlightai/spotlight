import type {
  GitAnswer,
  GitCall,
  RepositoryGitPort,
} from '@github/application/ports/repository-git.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { GitGatewayPort } from '@work/application/ports/git-gateway.port';
import type { RunWorks } from '@work/application/services/run-works.service';

export class CarryGitCall implements GitGatewayPort {
  constructor(
    private readonly works: RunWorks,
    private readonly workspaces: WorkspaceConnectionsPort,
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

    return (await this.workspaces.isConnected(work.workspaceId))
      ? this.git.call(work.workspaceId, repository, call)
      : null;
  }
}
