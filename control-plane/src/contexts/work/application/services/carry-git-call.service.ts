import type {
  GitAnswer,
  GitCall,
  RepositoryGitPort,
} from '@github/application/ports/repository-git.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { CheckAccessPort } from '@work/application/ports/check-access.port';
import type {
  GitGatewayPort,
  GitService,
} from '@work/application/ports/git-gateway.port';
import type {
  CheckedRepository,
  RunWorks,
} from '@work/application/services/run-works.service';

export class CarryGitCall implements GitGatewayPort {
  constructor(
    private readonly works: RunWorks,
    private readonly workspaces: WorkspaceConnectionsPort,
    private readonly git: RepositoryGitPort,
    private readonly checking: CheckAccessPort,
    private readonly clock: ClockPort,
  ) {}

  async carry(
    runId: string,
    runnerId: string,
    repo: string,
    service: GitService,
    call: GitCall,
  ): Promise<GitAnswer | null> {
    const reached = await this.reaching(runId, runnerId, repo, service).catch(
      rethrowAsApplicationError,
    );

    if (!reached) {
      return null;
    }

    return (await this.workspaces.isConnected(reached.workspaceId))
      ? this.git.call(reached.workspaceId, reached.repository, call)
      : null;
  }

  private async reaching(
    runId: string,
    runnerId: string,
    repo: string,
    service: GitService,
  ): Promise<CheckedRepository | null> {
    const leased = await this.works
      .leasedBy(runId, runnerId)
      .then((worked) => ({ worked }))
      .catch((error: unknown) => ({ error }));

    if ('worked' in leased) {
      const { work } = leased.worked;

      const repository = work
        ? await work.repositoryNamed(repo, service)
        : null;

      return work && repository
        ? { workspaceId: work.workspaceId, repository }
        : null;
    }

    if (
      service === 'git-receive-pack' ||
      !(await this.checking.isCheckOfRunLeasedBy(
        RunId.of(runId),
        RunnerId.of(runnerId),
        this.clock.now(),
      ))
    ) {
      throw leased.error;
    }

    return this.works.repositoryForCheck(RunId.of(runId), repo);
  }
}
