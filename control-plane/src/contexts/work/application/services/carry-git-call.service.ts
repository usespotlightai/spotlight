import type { RepositoryGitPort } from '@github/application/ports/repository-git.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  GitAnswerDto,
  GitCallDto,
  GitService,
} from '@work/application/dto/git-call.dto';
import type { CheckAccessPort } from '@work/application/ports/check-access.port';
import type {
  CheckedRepository,
  RunWorks,
} from '@work/application/services/run-works.service';
import { CheckGitAccess } from '@work/domain/services/check-git-access';

export class CarryGitCall {
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
    call: GitCallDto,
  ): Promise<GitAnswerDto | null> {
    const allowed = await this.allowedRepository(
      runId,
      runnerId,
      repo,
      service,
    ).catch(rethrowAsApplicationError);

    if (!allowed) {
      return null;
    }

    if (!(await this.workspaces.isConnected(allowed.workspaceId))) {
      return null;
    }

    const answer = await this.git.call(
      allowed.workspaceId,
      allowed.repository,
      {
        method: call.method,
        path: call.path,
        search: call.search,
        headers: call.headers,
        body: call.body,
      },
    );

    return (
      answer && {
        status: answer.status,
        headers: answer.headers,
        body: answer.body,
      }
    );
  }

  private async allowedRepository(
    runId: string,
    runnerId: string,
    repo: string,
    service: GitService,
  ): Promise<CheckedRepository | null> {
    const leased = await this.works.leasedRunWork(runId, runnerId);

    if (leased) {
      const { work } = leased;

      const repository = work
        ? await work.repositoryNamed(repo, service)
        : null;

      return work && repository
        ? { workspaceId: work.workspaceId, repository }
        : null;
    }

    if (
      CheckGitAccess.mayCall(service) &&
      (await this.checking.isCheckOfRunLeasedBy(
        RunId.of(runId),
        RunnerId.of(runnerId),
        this.clock.now(),
      ))
    ) {
      return this.works.repositoryForCheck(RunId.of(runId), repo);
    }

    await this.works.leasedBy(runId, runnerId);

    return null;
  }
}
