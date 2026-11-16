import type { RepositoryGitPort } from '@github/application/ports/repository-git.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerLeasesPort } from '@runners/application/ports/runner-leases.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  GitAnswerDto,
  GitCallDto,
  GitService,
} from '@work/application/dto/git-call.dto';
import type {
  ReviewWorkAccessPort,
  LeasedReviewWork,
} from '@work/application/ports/review-work-access.port';
import type {
  CheckedRepository,
  RunWorks,
} from '@work/application/services/run-works.service';
import { WorkNotLeasedError } from '@work/domain/exceptions/work-not-leased.error';
import { ReviewGitAccess } from '@work/domain/services/review-git-access';

export class CarryGitCall {
  constructor(
    private readonly works: RunWorks,
    private readonly workspaces: WorkspaceConnectionsPort,
    private readonly git: RepositoryGitPort,
    private readonly reviewing: ReviewWorkAccessPort,
    private readonly leases: RunnerLeasesPort,
    private readonly clock: ClockPort,
  ) {}

  async carry(
    workId: string,
    runnerId: string,
    repo: string,
    service: GitService,
    call: GitCallDto,
  ): Promise<GitAnswerDto | null> {
    const allowed = await this.allowedRepository(
      workId,
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
    workId: string,
    runnerId: string,
    repo: string,
    service: GitService,
  ): Promise<CheckedRepository | null> {
    const runner = RunnerId.of(runnerId);
    const held = await this.leases.leaseOf(runner);

    return held && held.kind !== 'run' && ReviewGitAccess.mayCall(service)
      ? this.reviewWorkRepository(
          { kind: held.kind, id: held.id },
          workId,
          runner,
          repo,
        )
      : this.runRepository(workId, runnerId, repo, service);
  }

  private async runRepository(
    workId: string,
    runnerId: string,
    repo: string,
    service: GitService,
  ): Promise<CheckedRepository | null> {
    const leased = await this.works.leasedRunWork(workId, runnerId);

    if (!leased) {
      await this.works.leasedBy(workId, runnerId);

      return null;
    }

    const { work } = leased;
    const repository = work ? await work.repositoryNamed(repo, service) : null;

    return work && repository
      ? { workspaceId: work.workspaceId, repository }
      : null;
  }

  private async reviewWorkRepository(
    held: { readonly kind: 'check' | 'diff'; readonly id: string },
    workId: string,
    runner: RunnerId,
    repo: string,
  ): Promise<CheckedRepository | null> {
    const leased =
      held.id === workId
        ? await this.reviewing.leasedWork(held, runner, this.clock.now())
        : null;

    if (!leased) {
      throw new WorkNotLeasedError(workId);
    }

    return this.reviewedRepository(leased, repo);
  }

  private async reviewedRepository(
    leased: LeasedReviewWork,
    repo: string,
  ): Promise<CheckedRepository | null> {
    const found = leased.runId
      ? await this.works.repositoryForCheck(leased.runId, repo)
      : leased.taskId
        ? await this.works.repositoryForTask(leased.taskId, repo)
        : null;

    if (!found) {
      return null;
    }

    return ReviewGitAccess.mayRead(leased.repository, found.repository)
      ? found
      : null;
  }
}
