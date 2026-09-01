import type { GitGatewayPort } from '@application/ports/git-gateway.port';
import type {
  GitAnswer,
  GitCall,
  RepositoryGitPort,
} from '@application/ports/repository-git.port';
import type { RunAtHand } from '@application/services/run-at-hand.service';
import type { GitHubInstallations } from '@domain/repositories/workspace.repository';

export class CarryGitCall implements GitGatewayPort {
  constructor(
    private readonly held: RunAtHand,
    private readonly workspaces: GitHubInstallations,
    private readonly git: RepositoryGitPort,
  ) {}

  async carry(
    runId: string,
    runnerId: string,
    call: GitCall,
  ): Promise<GitAnswer | null> {
    const { task } = await this.held.heldBy(runId, runnerId);
    const repository = task?.repository;

    if (!task || !repository) {
      return null;
    }

    // Answered as nothing rather than refused: git is speaking its own
    // protocol here, and a workspace that reaches no GitHub has no remote.
    const installation = await this.workspaces.installationOf(task.workspaceId);

    return installation ? this.git.call(installation, repository, call) : null;
  }
}
