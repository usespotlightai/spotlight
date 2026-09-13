import type { GitGatewayPort } from '@application/ports/git-gateway.port';
import type {
  GitAnswer,
  GitCall,
  RepositoryGitPort,
} from '@application/ports/repository-git.port';
import type { RunAtHand } from '@application/services/run-at-hand.service';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { WorkspaceConnections } from '@domain/repositories/workspace.repository';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';

export class CarryGitCall implements GitGatewayPort {
  constructor(
    private readonly held: RunAtHand,
    private readonly lines: LineRepository,
    private readonly workspaces: WorkspaceConnections,
    private readonly git: RepositoryGitPort,
  ) {}

  async carry(
    runId: string,
    runnerId: string,
    repo: string,
    call: GitCall,
  ): Promise<GitAnswer | null> {
    const { run, task } = await this.held.heldBy(runId, runnerId);

    if (!task || !run.stationId) {
      return null;
    }

    const line = await this.lines.holding(run.stationId);
    const repository = line?.repositoryNamed(repo) ?? null;

    if (!repository) {
      return null;
    }

    const installation = GitHubInstallation.from(
      await this.workspaces.connectionTo(
        task.workspaceId,
        GitHubInstallation.SOURCE,
      ),
    );

    return installation ? this.git.call(installation, repository, call) : null;
  }
}
