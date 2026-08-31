import type { GitGatewayPort } from '@application/ports/git-gateway.port';
import type {
  GitAnswer,
  GitCall,
  RepositoryGitPort,
} from '@application/ports/repository-git.port';
import type { RunAtHand } from '@application/services/run-at-hand.service';

export class CarryGitCall implements GitGatewayPort {
  constructor(
    private readonly held: RunAtHand,
    private readonly git: RepositoryGitPort,
  ) {}

  async carry(
    runId: string,
    runnerId: string,
    call: GitCall,
  ): Promise<GitAnswer | null> {
    const { task } = await this.held.heldBy(runId, runnerId);
    const repository = task?.repository;

    return repository ? this.git.call(repository, call) : null;
  }
}
